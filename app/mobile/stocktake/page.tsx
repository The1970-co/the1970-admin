"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import {
  getActiveBranchIdFromStorage,
  getCurrentUserFromStorage,
  getCurrentUserBranchLabel,
} from "@/lib/current-user";
import { Camera, Minus, Pause, Play, Plus, RotateCcw, Search, Square, StopCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RealtimeWorker = {
  id: string;
  sessionId?: string;
  name?: string | null;
  userId?: string | null;
  zone?: string | null;
  deviceName?: string | null;
  isActive?: boolean;
  status?: string | null;
};

type RealtimeSession = {
  id: string;
  branchId: string;
  name?: string | null;
  note?: string | null;
  status?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  workers?: RealtimeWorker[];
};

type SummaryItem = {
  variantId?: string | null;
  sku: string;
  barcode?: string | null;
  counted?: number;
  countedQty?: number;
  snapshotQty?: number;
  system?: number;
  diff?: number;
  status?: string;
  events?: number;
  eventCount?: number;
  productName?: string | null;
  variant?: any;
};

type ScanResult = {
  ok?: boolean;
  sku?: string;
  code?: string;
  qtyDelta?: number;
  counted?: number;
  countedQty?: number;
  variant?: {
    id?: string;
    sku?: string;
    barcode?: string | null;
    productName?: string | null;
    color?: string | null;
    size?: string | null;
  } | null;
  product?: {
    name?: string | null;
  } | null;
  event?: any;
};

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

const STORAGE_SESSION_ID = "the1970_mobile_stocktake_session_id";
const STORAGE_WORKER_ID = "the1970_mobile_stocktake_worker_id";
const STORAGE_BRANCH_ID = "the1970_mobile_stocktake_branch_id";

function numberText(value: unknown) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getDisplayName(user: any) {
  return (
    user?.name ||
    user?.fullName ||
    user?.username ||
    user?.email ||
    "Nhân viên kiểm kho"
  );
}

function statusText(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "Nháp";
  if (s === "IN_PROGRESS") return "Đang kiểm";
  if (s === "PAUSED") return "Tạm dừng";
  if (s === "FINISHED") return "Đã kết thúc";
  if (s === "APPLIED") return "Đã chốt tồn";
  if (s === "CANCELLED") return "Đã huỷ";
  return s || "—";
}

function isClosed(status?: string | null) {
  return ["FINISHED", "APPLIED", "CANCELLED"].includes(String(status || "").toUpperCase());
}

function countedOf(row: SummaryItem) {
  return Number(row.countedQty ?? row.counted ?? 0);
}

function systemOf(row: SummaryItem) {
  return Number(row.snapshotQty ?? row.system ?? 0);
}

function diffOf(row: SummaryItem) {
  const explicit = Number(row.diff);
  if (Number.isFinite(explicit)) return explicit;
  return countedOf(row) - systemOf(row);
}

function saveResumeState(input: { sessionId?: string | null; workerId?: string | null; branchId?: string | null }) {
  if (typeof window === "undefined") return;
  if (input.sessionId) window.localStorage.setItem(STORAGE_SESSION_ID, input.sessionId);
  if (input.workerId) window.localStorage.setItem(STORAGE_WORKER_ID, input.workerId);
  if (input.branchId) window.localStorage.setItem(STORAGE_BRANCH_ID, input.branchId);
}

function clearResumeState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_SESSION_ID);
  window.localStorage.removeItem(STORAGE_WORKER_ID);
  window.localStorage.removeItem(STORAGE_BRANCH_ID);
}

export default function MobileStocktakePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [branchId, setBranchId] = useState("");
  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [worker, setWorker] = useState<RealtimeWorker | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [code, setCode] = useState("");
  const [qtyDelta, setQtyDelta] = useState(1);
  const [zone, setZone] = useState("Khu chính");
  const [sessionName, setSessionName] = useState("Kiểm kho mobile");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [search, setSearch] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCameraCodeRef = useRef("");
  const lastCameraAtRef = useRef(0);
  const detectTimerRef = useRef<number | null>(null);

  const branchLabel = useMemo(() => {
    if (!currentUser) return branchId || "—";
    return getCurrentUserBranchLabel(currentUser, branchId) || branchId || "—";
  }, [branchId, currentUser]);

  const closed = isClosed(session?.status);
  const paused = String(session?.status || "").toUpperCase() === "PAUSED";
  const canScan = Boolean(session?.id && worker?.id && !closed && !paused);

  const kpi = useMemo(() => {
    const total = summary.length;
    const counted = summary.filter((row) => countedOf(row) !== 0).length;
    const mismatch = summary.filter((row) => diffOf(row) !== 0).length;
    const totalDiff = summary.reduce((sum, row) => sum + diffOf(row), 0);
    return { total, counted, mismatch, totalDiff };
  }, [summary]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...summary].sort((a, b) => {
      const ad = Math.abs(diffOf(a));
      const bd = Math.abs(diffOf(b));
      if (bd !== ad) return bd - ad;
      return String(a.sku || "").localeCompare(String(b.sku || ""));
    });
    if (!q) return rows.slice(0, 80);
    return rows
      .filter((row) => {
        const text = `${row.sku || ""} ${row.productName || ""} ${row.barcode || ""}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 80);
  }, [search, summary]);

  const loadSummary = useCallback(async (sessionId: string) => {
    try {
      const rows = await apiJson<SummaryItem[]>(`/stocktake-sessions/${sessionId}/summary`, {
        redirectOnUnauthorized: false,
      });
      if (Array.isArray(rows)) setSummary(rows);
    } catch (error) {
      console.warn("[MobileStocktake] summary failed", error);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    const data = await apiJson<RealtimeSession>(`/stocktake-sessions/${sessionId}`, {
      redirectOnUnauthorized: false,
    });
    setSession(data);
    setBranchId(data.branchId || branchId);

    const savedWorkerId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_WORKER_ID) : "";
    const foundWorker = data.workers?.find((item) => item.id === savedWorkerId) || data.workers?.[0] || null;
    if (foundWorker) {
      setWorker(foundWorker);
      saveResumeState({ sessionId: data.id, workerId: foundWorker.id, branchId: data.branchId });
    }

    await loadSummary(data.id);
    return data;
  }, [branchId, loadSummary]);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);
    const activeBranchId = getActiveBranchIdFromStorage(user);
    const savedBranchId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_BRANCH_ID) : "";
    setBranchId(savedBranchId || activeBranchId || user?.branchId || "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedSessionId = window.localStorage.getItem(STORAGE_SESSION_ID);
    if (!savedSessionId) return;

    let alive = true;
    (async () => {
      try {
        setMessage("Đang khôi phục phiên kiểm kho...");
        const data = await loadSession(savedSessionId);
        if (!alive) return;
        if (isClosed(data.status)) {
          clearResumeState();
          setMessage("Phiên cũ đã đóng. Tạo hoặc vào phiên mới để kiểm tiếp.");
          return;
        }
        setMessage("Đã khôi phục phiên kiểm kho. Có thể scan tiếp.");
      } catch (error) {
        if (!alive) return;
        clearResumeState();
        setMessage(error instanceof Error ? error.message : "Không khôi phục được phiên cũ.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadSession]);

  useEffect(() => {
    if (!session?.id) return;
    const timer = window.setInterval(() => {
      void loadSummary(session.id);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [loadSummary, session?.id]);

  async function joinSession(targetSession: RealtimeSession) {
    const joined = await apiJson<RealtimeWorker>(`/stocktake-sessions/${targetSession.id}/join`, {
      method: "POST",
      redirectOnUnauthorized: false,
      body: JSON.stringify({
        name: getDisplayName(currentUser),
        zone,
        deviceName: "iPhone mobile app",
      }),
    });
    setWorker(joined);
    saveResumeState({ sessionId: targetSession.id, workerId: joined.id, branchId: targetSession.branchId });
    return joined;
  }

  async function loadActiveSession() {
    if (!branchId) {
      setMessage("Tài khoản chưa có chi nhánh để kiểm kho.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Đang tìm phiên kiểm đang mở...");
      const active = await apiJson<RealtimeSession | null>(`/stocktake-sessions/active/current?branchId=${encodeURIComponent(branchId)}`, {
        redirectOnUnauthorized: false,
      });
      if (!active?.id) {
        setMessage("Chưa có phiên đang mở. Có thể tạo phiên mới trên điện thoại.");
        return;
      }
      setSession(active);
      setBranchId(active.branchId || branchId);
      const existingWorker = active.workers?.[0] || null;
      if (existingWorker) {
        setWorker(existingWorker);
        saveResumeState({ sessionId: active.id, workerId: existingWorker.id, branchId: active.branchId });
      } else {
        await joinSession(active);
      }
      await loadSummary(active.id);
      setMessage("Đã vào phiên kiểm đang mở.");
      window.setTimeout(() => inputRef.current?.focus(), 150);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được phiên kiểm đang mở.");
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    if (!branchId) {
      setMessage("Tài khoản chưa có chi nhánh để tạo phiên kiểm kho.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Đang tạo phiên kiểm kho mobile...");
      clearResumeState();
      const created = await apiJson<RealtimeSession>("/stocktake-sessions", {
        method: "POST",
        redirectOnUnauthorized: false,
        body: JSON.stringify({
          branchId,
          name: sessionName || "Kiểm kho mobile",
          note: "Tạo từ app mobile",
        }),
      });
      const joined = await joinSession(created);
      await apiJson(`/stocktake-sessions/${created.id}/start`, {
        method: "PATCH",
        redirectOnUnauthorized: false,
      });
      const fresh = await loadSession(created.id);
      setSession(fresh);
      setWorker(joined);
      setMessage("Đã tạo phiên. Đưa camera vào mã vạch hoặc nhập SKU để kiểm.");
      window.setTimeout(() => inputRef.current?.focus(), 150);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được phiên kiểm kho.");
    } finally {
      setLoading(false);
    }
  }

  async function scanCode(rawCode?: string, deltaInput?: number) {
    const nextCode = String(rawCode ?? code).trim();
   const delta = Number((deltaInput ?? qtyDelta) || 1);
    if (!nextCode) {
      setMessage("Chưa có mã SKU/mã vạch để scan.");
      inputRef.current?.focus();
      return;
    }
    if (!canScan || !session?.id || !worker?.id) {
      setMessage(paused ? "Phiên đang tạm dừng." : closed ? "Phiên đã đóng." : "Cần tạo hoặc vào phiên kiểm trước.");
      return;
    }

    try {
      setScanning(true);
      const result = await apiJson<ScanResult>("/stocktake-sessions/scan", {
        method: "POST",
        redirectOnUnauthorized: false,
        body: JSON.stringify({
          sessionId: session.id,
          workerId: worker.id,
          branchId: session.branchId || branchId,
          code: nextCode,
          zone,
          qtyDelta: delta,
          note: "Scan từ app mobile",
        }),
      });
      setLastScan(result);
      const scannedSku = result?.variant?.sku || result?.sku || nextCode;
      setMessage(`Đã ghi ${delta > 0 ? "+" : ""}${delta} cho ${scannedSku}.`);
      setCode("");
      await loadSummary(session.id);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không ghi được mã vừa scan.");
    } finally {
      setScanning(false);
    }
  }

  async function adjustRow(row: SummaryItem, delta: number) {
    await scanCode(row.sku, delta);
  }

  async function setRowCount(row: SummaryItem) {
    const current = countedOf(row);
    const input = window.prompt(`Nhập số lượng thực tế cho ${row.sku}`, String(current));
    if (input === null) return;
    const target = Number(input);
    if (!Number.isFinite(target) || target < 0) {
      setMessage("Số lượng không hợp lệ.");
      return;
    }
    const delta = target - current;
    if (delta === 0 && target !== 0) {
      setMessage("Số lượng không đổi.");
      return;
    }
    await scanCode(row.sku, delta);
  }

  async function pauseOrResume() {
    if (!session?.id) return;
    try {
      setLoading(true);
      await apiJson(`/stocktake-sessions/${session.id}/${paused ? "resume" : "pause"}`, {
        method: "PATCH",
        redirectOnUnauthorized: false,
      });
      await loadSession(session.id);
      setMessage(paused ? "Đã tiếp tục phiên kiểm." : "Đã tạm dừng phiên kiểm.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đổi trạng thái phiên.");
    } finally {
      setLoading(false);
    }
  }

  async function finishCounting() {
    if (!session?.id) return;
    const ok = window.confirm("Kết thúc phiên kiểm? Sau bước này nhân viên không scan thêm được, quản lý sẽ chốt/cân bằng tồn sau.");
    if (!ok) return;
    try {
      setLoading(true);
      await apiJson(`/stocktake-sessions/${session.id}/finish`, {
        method: "PATCH",
        redirectOnUnauthorized: false,
      });
      await loadSession(session.id);
      setMessage("Đã kết thúc phiên kiểm. Chờ quản lý kiểm tra và chốt tồn.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không kết thúc được phiên kiểm.");
    } finally {
      setLoading(false);
    }
  }

  function stopCamera() {
    if (detectTimerRef.current) {
      window.clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    if (!canScan) {
      setMessage("Cần vào phiên kiểm đang chạy trước khi bật camera.");
      return;
    }
    if (!window.BarcodeDetector) {
      setCameraMessage("Máy này chưa hỗ trợ quét barcode trực tiếp trong WebView. Dùng ô nhập mã/SKU hoặc cài plugin native ở bước sau.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Không mở được camera trên thiết bị này.");
      return;
    }

    try {
      setCameraMessage("Đang mở camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => null);
      }

      const detector = new window.BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code"] });
      setCameraMessage("Đưa mã vạch vào khung. App sẽ tự ghi +1 khi nhận mã.");

      const loop = async () => {
        const currentVideo = videoRef.current;
        if (!currentVideo || !streamRef.current) return;
        try {
          if (currentVideo.readyState >= 2) {
            const results = await detector.detect(currentVideo);
            const value = String(results?.[0]?.rawValue || "").trim();
            const now = Date.now();
            if (value && (value !== lastCameraCodeRef.current || now - lastCameraAtRef.current > 2500)) {
              lastCameraCodeRef.current = value;
              lastCameraAtRef.current = now;
              setCameraMessage(`Đã nhận mã ${value}, đang ghi...`);
              await scanCode(value, qtyDelta || 1);
            }
          }
        } catch (error) {
          console.warn("[MobileStocktake] camera detect failed", error);
        } finally {
          if (streamRef.current) detectTimerRef.current = window.setTimeout(loop, 450);
        }
      };

      void loop();
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : "Không mở được camera.");
      stopCamera();
    }
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <main className="min-h-[100dvh] bg-stone-100 px-4 py-4 pb-32 text-neutral-950">
      <section className="rounded-[2rem] bg-neutral-950 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-400">Mobile</p>
            <h1 className="mt-2 text-2xl font-black">Kiểm kho</h1>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Quét mã vạch bằng camera iPhone hoặc nhập SKU để ghi số lượng kiểm ngay tại kho.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">{statusText(session?.status)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/45">Chi nhánh</p>
            <p className="mt-1 font-black">{branchLabel}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-white/45">Phiên</p>
            <p className="mt-1 truncate font-mono font-black">{session?.id ? session.id.slice(-8).toUpperCase() : "Chưa có"}</p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="mt-3 rounded-3xl border border-stone-200 bg-white p-4 text-sm font-bold leading-6 text-stone-700 shadow-sm">
          {message}
        </div>
      ) : null}

      {!session?.id ? (
        <section className="mt-4 rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">Tên phiên</label>
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold outline-none focus:border-neutral-950"
              placeholder="Kiểm kho mobile"
            />
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">Khu vực</label>
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold outline-none focus:border-neutral-950"
              placeholder="Khu chính"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadActiveSession()}
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-900 disabled:opacity-50"
            >
              Vào phiên đang mở
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void createSession()}
              className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              Tạo phiên mới
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-3xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-stone-400">SKU</p>
              <p className="mt-1 text-xl font-black">{numberText(kpi.total)}</p>
            </div>
            <div className="rounded-3xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-stone-400">Đã kiểm</p>
              <p className="mt-1 text-xl font-black">{numberText(kpi.counted)}</p>
            </div>
            <div className="rounded-3xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-stone-400">Lệch</p>
              <p className="mt-1 text-xl font-black">{numberText(kpi.mismatch)}</p>
            </div>
            <div className="rounded-3xl bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-stone-400">Delta</p>
              <p className={`mt-1 text-xl font-black ${kpi.totalDiff > 0 ? "text-emerald-600" : kpi.totalDiff < 0 ? "text-red-600" : ""}`}>{kpi.totalDiff > 0 ? "+" : ""}{numberText(kpi.totalDiff)}</p>
            </div>
          </section>

          <section className="mt-4 rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Quét mã</p>
                <p className="text-sm font-bold text-stone-900">{worker?.name || "Máy kiểm mobile"}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={pauseOrResume} disabled={loading || closed} className="rounded-2xl border border-stone-200 p-3 text-stone-700 disabled:opacity-40">
                  {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </button>
                <button type="button" onClick={finishCounting} disabled={loading || closed} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-600 disabled:opacity-40">
                  <StopCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void scanCode();
                  }
                }}
                disabled={!canScan || scanning}
                className="min-w-0 flex-1 rounded-2xl border border-stone-200 px-4 py-3 text-base font-black outline-none focus:border-neutral-950 disabled:bg-stone-100"
                placeholder="Scan mã vạch / nhập SKU"
                autoCapitalize="characters"
                inputMode="text"
              />
              <input
                value={qtyDelta}
                onChange={(e) => setQtyDelta(Number(e.target.value || 1))}
                className="w-20 rounded-2xl border border-stone-200 px-3 py-3 text-center text-base font-black outline-none focus:border-neutral-950"
                type="number"
                step="1"
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[1, 2, 5, -1].map((value) => (
                <button key={value} type="button" onClick={() => setQtyDelta(value)} className={`rounded-2xl px-3 py-2 text-sm font-black ${qtyDelta === value ? "bg-neutral-950 text-white" : "bg-stone-100 text-stone-700"}`}>
                  {value > 0 ? `+${value}` : value}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void scanCode()}
              disabled={!canScan || scanning}
              className="mt-3 w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:bg-stone-300"
            >
              {scanning ? "Đang ghi..." : "Ghi số lượng kiểm"}
            </button>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => (cameraOn ? stopCamera() : void startCamera())}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-800"
              >
                <span className="inline-flex items-center gap-2"><Camera className="h-4 w-4" /> {cameraOn ? "Tắt camera" : "Mở camera"}</span>
              </button>
              <button
                type="button"
                onClick={() => void loadSummary(session.id)}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-800"
              >
                <span className="inline-flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Đồng bộ</span>
              </button>
            </div>

            {cameraOn || cameraMessage ? (
              <div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-black text-white">
                <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-white/75">
                  <span>{cameraMessage || "Đang quét..."}</span>
                  <button type="button" onClick={stopCamera} className="rounded-full bg-white/10 p-2"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ) : null}

            {lastScan ? (
              <div className="mt-3 rounded-3xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
                Vừa ghi: {lastScan.variant?.sku || lastScan.sku || code || "SKU"}
                {lastScan.variant?.productName ? ` · ${lastScan.variant.productName}` : ""}
              </div>
            ) : null}
          </section>

          <section className="mt-4 rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-stone-200 py-3 pl-9 pr-3 text-sm font-bold outline-none focus:border-neutral-950"
                  placeholder="Tìm SKU đã kiểm"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {visibleRows.length ? visibleRows.map((row) => {
                const counted = countedOf(row);
                const system = systemOf(row);
                const diff = diffOf(row);
                return (
                  <div key={`${row.variantId || row.sku}`} className="rounded-3xl border border-stone-200 bg-stone-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-950">{row.sku}</p>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-stone-500">{row.productName || row.variant?.productName || "—"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${diff === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {diff > 0 ? "+" : ""}{numberText(diff)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-2xl bg-white p-2"><p className="text-stone-400">HT</p><p className="font-black">{numberText(system)}</p></div>
                      <div className="rounded-2xl bg-white p-2"><p className="text-stone-400">Đếm</p><p className="font-black">{numberText(counted)}</p></div>
                      <div className="rounded-2xl bg-white p-2"><p className="text-stone-400">Lượt</p><p className="font-black">{numberText(row.events || row.eventCount || 0)}</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => void adjustRow(row, -1)} disabled={!canScan} className="rounded-2xl border border-stone-200 bg-white py-2 text-sm font-black disabled:opacity-40"><Minus className="mx-auto h-4 w-4" /></button>
                      <button type="button" onClick={() => void setRowCount(row)} disabled={!canScan} className="rounded-2xl border border-stone-200 bg-white py-2 text-sm font-black disabled:opacity-40">Nhập SL</button>
                      <button type="button" onClick={() => void adjustRow(row, 1)} disabled={!canScan} className="rounded-2xl border border-stone-200 bg-white py-2 text-sm font-black disabled:opacity-40"><Plus className="mx-auto h-4 w-4" /></button>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-3xl border border-dashed border-stone-300 p-6 text-center text-sm font-bold text-stone-500">
                  Chưa có dòng kiểm. Scan mã đầu tiên để bắt đầu.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <MobileBottomNav />
    </main>
  );
}
