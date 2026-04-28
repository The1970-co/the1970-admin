"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import { applyStocktake } from "@/lib/stocktake-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

function getTokenFromStorage() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getTokenFromStorage();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || message;
    } catch { }

    throw new Error(message);
  }

  return res.json();
}

function formatDate() {
  return new Date().toLocaleString("vi-VN");
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-500"
        : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state}`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

const mismatchReasons = [
  "Sai vị trí để hàng",
  "Thiếu hàng thực tế",
  "Dư hàng thực tế",
  "Lỗi nhập/xuất trước đó",
  "Mất tem / quét sai",
  "Khác",
];

type StocktakeRowStatus = "MATCH" | "MISMATCH" | "NOT_FOUND";

type RealtimeSession = {
  id: string;
  branchId: string;
  name: string;
  note?: string | null;
  status: string;
  workers?: RealtimeWorker[];
  scanEvents?: RealtimeScanEvent[];
  _count?: {
    scanEvents?: number;
  };
};

type RealtimeWorker = {
  id: string;
  sessionId: string;
  name: string;
  userId?: string | null;
  zone?: string | null;
  deviceName?: string | null;
  isActive?: boolean;
};

type RealtimeScanEvent = {
  id: string;
  sessionId: string;
  workerId?: string | null;
  branchId: string;
  variantId?: string | null;
  sku: string;
  barcode?: string | null;
  qtyDelta: number;
  zone?: string | null;
  locationCode?: string | null;
  status: string;
  note?: string | null;
  createdAt: string;
};

type SummaryItem = {
  variantId?: string | null;
  sku: string;
  counted: number;
  status: string;
  events: number;
};

type ReviewRow = {
  sku: string;
  counted: number;
  system: number;
  totalSystem: number;
  diff: number;
  status: StocktakeRowStatus;
  variant: any;
  reason: string;
  note: string;
  events: number;
};

export default function StocktakePageClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [sessionName, setSessionName] = useState("Kiểm kho realtime");
  const [sessionNote, setSessionNote] = useState("");

  const [scannerName, setScannerName] = useState("Nhân viên 1");
  const [scanZone, setScanZone] = useState("Khu chính");
  const [deviceName, setDeviceName] = useState("Máy scan 1");

  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [worker, setWorker] = useState<RealtimeWorker | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [scanCode, setScanCode] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastScannedSku, setLastScannedSku] = useState("");
  const [showOnlyMismatch, setShowOnlyMismatch] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setRole(currentUser.role as AppRole);
    setCurrentBranchId(currentUser.branchId || null);

    if (currentUser.name) {
      setScannerName(currentUser.name);
    }

    if (
      currentUser.role !== "admin" &&
      currentUser.role !== "owner" &&
      currentUser.branchId
    ) {
      setBranchId(currentUser.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";
  const canApplyStocktake = hasPermission(role, "stocktake.apply");

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const data = await getBranches();
        setBranches(data);

        setBranchId((prev) => {
          if (prev) return prev;
          if (!isOwner && currentBranchId) return currentBranchId;
          return data[0]?.id || "";
        });
      } finally {
        setLoadingBranches(false);
      }
    };

    void loadBranches();
  }, [isOwner, currentBranchId]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getProducts({ page: 1, limit: 1000 });
        setProducts(Array.isArray(result) ? result : result.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được dữ liệu sản phẩm."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, []);

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const allVariants = useMemo(
    () =>
      products.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          productName: product.name,
        }))
      ),
    [products]
  );

  const getVariantBranchStock = (variant: any, selectedBranchId: string) => {
    return Number(variant?.branchStocks?.[selectedBranchId] || 0);
  };

  const getVariantTotalStock = (variant: any) => {
    if (!variant?.branchStocks) return 0;

    return Object.values(variant.branchStocks).reduce<number>(
      (sum, value) => sum + Number(value || 0),
      0
    );
  };

  const findVariantByCode = (code: string) => {
    const q = code.trim().toLowerCase();
    if (!q) return null;

    return (
      allVariants.find((v: any) => String(v.sku || "").toLowerCase() === q) ||
      allVariants.find(
        (v: any) => String(v.barcode || "").toLowerCase() === q
      ) ||
      null
    );
  };

  const suggestions = useMemo(() => {
    const q = scanCode.trim().toLowerCase();
    if (!q) return [];

    return allVariants
      .filter((v: any) => {
        const sku = String(v.sku || "").toLowerCase();
        const barcode = String(v.barcode || "").toLowerCase();
        const name = String(v.productName || "").toLowerCase();
        const color = String(v.color || "").toLowerCase();
        const size = String(v.size || "").toLowerCase();

        return (
          sku.includes(q) ||
          barcode.includes(q) ||
          name.includes(q) ||
          color.includes(q) ||
          size.includes(q)
        );
      })
      .slice(0, 10);
  }, [allVariants, scanCode]);

  const rows = useMemo<ReviewRow[]>(() => {
    return summary.map((item) => {
      const variant =
        allVariants.find((v: any) => v.id === item.variantId) ||
        allVariants.find((v: any) => v.sku === item.sku) ||
        null;

      const system = getVariantBranchStock(variant, branchId);
      const totalSystem = getVariantTotalStock(variant);
      const diff = item.counted - system;

      const status: StocktakeRowStatus = !variant
        ? "NOT_FOUND"
        : diff === 0
          ? "MATCH"
          : "MISMATCH";

      return {
        sku: variant?.sku || item.sku,
        counted: item.counted,
        system,
        totalSystem,
        diff,
        status,
        variant,
        reason: status === "MATCH" ? "" : "Khác",
        note: "",
        events: item.events,
      };
    });
  }, [summary, allVariants, branchId]);

  const visibleRows = showOnlyMismatch
    ? rows.filter((row) => row.status !== "MATCH")
    : rows;

  const matchedCount = rows.filter((row) => row.status === "MATCH").length;
  const mismatchCount = rows.filter((row) => row.status === "MISMATCH").length;
  const notFoundCount = rows.filter((row) => row.status === "NOT_FOUND").length;
  const totalCounted = rows.reduce((sum, row) => sum + row.counted, 0);
  const totalDiff = rows.reduce((sum, row) => sum + row.diff, 0);

  const latestEvents = session?.scanEvents || [];

  const workerStats = useMemo(() => {
    const map = new Map<string, number>();
    const workerNameMap = new Map<string, string>();

    (session?.workers || []).forEach((item) => {
      workerNameMap.set(item.id, item.name);
    });

    latestEvents.forEach((event) => {
      const name = event.workerId
        ? workerNameMap.get(event.workerId) || event.workerId
        : "Không rõ";
      map.set(name, (map.get(name) || 0) + event.qtyDelta);
    });

    return Array.from(map.entries());
  }, [latestEvents, session?.workers]);

  const zoneStats = useMemo(() => {
    const map = new Map<string, number>();

    latestEvents.forEach((event) => {
      const zone = event.zone || "Chưa chọn khu";
      map.set(zone, (map.get(zone) || 0) + event.qtyDelta);
    });

    return Array.from(map.entries());
  }, [latestEvents]);

  const refreshSession = async (sessionId?: string) => {
    const id = sessionId || session?.id;
    if (!id) return;

    try {
      setRefreshing(true);
      const [sessionData, summaryData] = await Promise.all([
        apiRequest<RealtimeSession>(`/stocktake-sessions/${id}`),
        apiRequest<SummaryItem[]>(`/stocktake-sessions/${id}/summary`),
      ]);

      setSession(sessionData);
      setSummary(summaryData);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không refresh được session.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!session?.id) return;

    const timer = window.setInterval(() => {
      void refreshSession(session.id);
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const createRealtimeSession = async () => {
    if (!branchId) {
      setMessage("Chưa chọn chi nhánh.");
      return;
    }

    try {
      setMessage("");

      const created = await apiRequest<RealtimeSession>("/stocktake-sessions", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          name: sessionName || "Kiểm kho realtime",
          note: sessionNote,
        }),
      });

      const joined = await apiRequest<RealtimeWorker>(
        `/stocktake-sessions/${created.id}/join`,
        {
          method: "POST",
          body: JSON.stringify({
            name: scannerName || "Nhân viên",
            zone: scanZone,
            deviceName,
          }),
        }
      );

      await apiRequest(`/stocktake-sessions/${created.id}/start`, {
        method: "PATCH",
      });

      setSession(created);
      setWorker(joined);
      setSummary([]);
      setMessage(`✅ ĐÃ TẠO PHIÊN: ${created.name} · ${joined.name} có thể bắt đầu scan.`);
      await refreshSession(created.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được phiên.");
    }
  };

  const joinExistingSession = async () => {
    const id = window.prompt("Dán sessionId cần join:");
    if (!id) return;

    try {
      const joined = await apiRequest<RealtimeWorker>(
        `/stocktake-sessions/${id}/join`,
        {
          method: "POST",
          body: JSON.stringify({
            name: scannerName || "Nhân viên",
            zone: scanZone,
            deviceName,
          }),
        }
      );

      setWorker(joined);
      await refreshSession(id);
      setMessage(`Đã join phiên ${id}. Worker: ${joined.name}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không join được phiên.");
    }
  };

  const handleScanCode = async (codeInput?: string, qtyDelta = 1) => {
    const code = String(codeInput || scanCode).trim();
    if (!code) return;

    if (!session?.id) {
      setMessage("Chưa có phiên realtime. Hãy tạo phiên hoặc join phiên trước.");
      return;
    }

    try {
      setScanning(true);

      const variant = findVariantByCode(code);
      const finalCode = variant?.sku || code;

      const result = await apiRequest<any>("/stocktake-sessions/scan", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          workerId: worker?.id,
          branchId,
          code: finalCode,
          zone: scanZone,
          qtyDelta,
        }),
      });

      setLastScannedSku(result?.variant?.sku || finalCode);
      setScanCode("");
      setShowSuggestions(false);
      setMessage(
        `${qtyDelta > 0 ? "Đã scan" : "Đã trừ"} ${result?.variant?.sku || finalCode}`
      );

      await refreshSession(session.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Scan lỗi.");
    } finally {
      setScanning(false);
    }
  };

  const handlePickSuggestion = async (variant: any) => {
    await handleScanCode(String(variant?.sku || ""), 1);
  };

  const adjustRowCount = async (sku: string, delta: 1 | -1) => {
    await handleScanCode(sku, delta);
  };

  const finishSession = async () => {
    if (!session?.id) {
      setMessage("Chưa có phiên để chốt.");
      return;
    }

    if (!rows.length) {
      setMessage("Chưa có dữ liệu kiểm kho.");
      return;
    }

    if (!canApplyStocktake) {
      setMessage("Role hiện tại không có quyền chốt kiểm kho.");
      return;
    }

    try {
      setApplying(true);

      const payload = {
        sessionName: session.name,
        sessionNote: session.note || sessionNote,
        branchId,
        rows: rows.map((row) => ({
          variantId: row.variant?.id,
          sku: row.sku,
          counted: row.counted,
          system: row.system,
          diff: row.diff,
          status: row.status,
          reason: row.reason,
          note: row.note,
        })),
      };

      const result = await applyStocktake(payload);

      await apiRequest(`/stocktake-sessions/${session.id}/finish`, {
        method: "PATCH",
      });

      await refreshSession(session.id);

      setMessage(
        `Đã chốt kiểm kho. Điều chỉnh ${result.adjustedCount} dòng, tổng delta ${result.totalDelta > 0 ? `+${result.totalDelta}` : result.totalDelta
        }.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không chốt được phiên.");
    } finally {
      setApplying(false);
    }
  };

  const resetLocal = () => {
    setSession(null);
    setWorker(null);
    setSummary([]);
    setScanCode("");
    setShowSuggestions(false);
    setLastScannedSku("");
    setMessage("Đã reset UI local. Backend session không bị xóa.");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Kiểm kho realtime
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Phiên kiểm kho dùng backend session thật, nhiều người có thể scan cùng
          một session.
        </p>
      </div>

      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="p-4">
          <p className="text-sm text-neutral-700">{message}</p>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <div className="grid gap-4 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Tên phiên</label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              disabled={Boolean(session)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Chi nhánh</label>
            <select
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={!isOwner || loadingBranches || Boolean(session)}
            >
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Người kiểm</label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={scannerName}
              onChange={(e) => setScannerName(e.target.value)}
              placeholder="Ví dụ: Nhân viên 1"
              disabled={Boolean(worker)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Khu kiểm</label>
            <select
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={scanZone}
              onChange={(e) => setScanZone(e.target.value)}
            >
              <option value="Khu chính">Khu chính</option>
              <option value="Kệ áo">Kệ áo</option>
              <option value="Kệ quần">Kệ quần</option>
              <option value="Kho sau">Kho sau</option>
              <option value="Khu sale">Khu sale</option>
              <option value="Quầy thu ngân">Quầy thu ngân</option>
              <option value="Khác">Khác</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium">Ghi chú phiên</label>
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder="Ví dụ: kiểm cuối ngày, chia 5 người theo khu"
            disabled={Boolean(session)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={createRealtimeSession}
            disabled={Boolean(session)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition ${session
              ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
              : "bg-green-600 text-white hover:bg-green-500"
              }`}
          >
            🚀 Tạo phiên realtime
          </button>
          <Button
            variant="secondary"
            onClick={joinExistingSession}
            disabled={Boolean(session)}
          >
            Join phiên có sẵn
          </Button>
          <Button variant="secondary" onClick={() => void refreshSession()}>
            {refreshing ? "Đang refresh..." : "Refresh"}
          </Button>
          <Button variant="secondary" onClick={resetLocal}>
            Reset UI
          </Button>
        </div>

        {session ? (
          <div className="mt-4 rounded-3xl border border-green-200 bg-green-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-green-800">
                  ✅ Phiên kiểm kho đang chạy
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Có thể bắt đầu scan. Session ID:{" "}
                  <span className="font-mono font-semibold">{session.id}</span>
                </p>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-green-700 shadow-sm">
                {session.workers?.length || 1} người kiểm
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-lg font-semibold text-amber-800">
              Chưa bắt đầu phiên kiểm kho
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Bấm “Tạo phiên realtime” để bắt đầu.
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={session ? "green" : "amber"}>
            {session ? `Session: ${session.id}` : "Chưa có session"}
          </Badge>
          <Badge tone={worker ? "green" : "amber"}>
            {worker ? `Worker: ${worker.name}` : "Chưa join worker"}
          </Badge>
          <Badge tone="blue">{session?.status || "DRAFT"}</Badge>
          <Badge tone="gray">{session?.workers?.length || 0} người kiểm</Badge>
        </div>
      </Panel>

      <Panel className="p-5">
        <label className="mb-2 block text-sm font-medium">
          Ô nhận barcode / tìm sản phẩm
        </label>

        <div className="relative">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
            value={scanCode}
            onChange={(e) => {
              setScanCode(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleScanCode();
              }

              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Scan mã / hoặc gõ tên, SKU để tìm sản phẩm"
            autoFocus
            disabled={!session || scanning}
          />

          {showSuggestions && scanCode.trim() && suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-[52px] z-50 max-h-80 overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
              {suggestions.map((variant: any) => (
                <button
                  key={variant.id || variant.sku}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handlePickSuggestion(variant);
                  }}
                  className="flex w-full items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {variant.productName || "Sản phẩm"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      SKU: {variant.sku}
                      {variant.color ? ` · Màu: ${variant.color}` : ""}
                      {variant.size ? ` · Size: ${variant.size}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right text-xs text-neutral-500">
                    <p>Chi nhánh: {getVariantBranchStock(variant, branchId)}</p>
                    <p>Tổng: {getVariantTotalStock(variant)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {showSuggestions && scanCode.trim() && suggestions.length === 0 ? (
            <div className="absolute left-0 right-0 top-[52px] z-50 rounded-2xl border border-red-100 bg-white p-4 text-sm text-red-600 shadow-xl">
              Không tìm thấy sản phẩm phù hợp.
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-xs text-neutral-500">
          Máy tít bluetooth nhập mã rồi Enter. Mỗi lần scan sẽ ghi vào backend
          session, các máy khác refresh sẽ thấy cùng dữ liệu.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-4">
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Rows</p>
          <h3 className="mt-2 text-2xl font-semibold">{rows.length}</h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">MATCH</p>
          <h3 className="mt-2 text-2xl font-semibold text-green-700">
            {matchedCount}
          </h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">MISMATCH</p>
          <h3 className="mt-2 text-2xl font-semibold text-amber-700">
            {mismatchCount}
          </h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">NOT_FOUND</p>
          <h3 className="mt-2 text-2xl font-semibold text-red-700">
            {notFoundCount}
          </h3>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng đã scan</p>
          <h3 className="mt-2 text-2xl font-semibold">{totalCounted}</h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng lệch</p>
          <h3
            className={`mt-2 text-2xl font-semibold ${totalDiff === 0
              ? "text-green-700"
              : totalDiff > 0
                ? "text-blue-700"
                : "text-red-700"
              }`}
          >
            {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
          </h3>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="text-base font-semibold">Tiến độ theo người kiểm</h3>
          <div className="mt-3 space-y-2">
            {workerStats.length === 0 ? (
              <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p>
            ) : (
              workerStats.map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm"
                >
                  <span>{name}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <h3 className="text-base font-semibold">Tiến độ theo khu kiểm</h3>
          <div className="mt-3 space-y-2">
            {zoneStats.length === 0 ? (
              <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p>
            ) : (
              zoneStats.map(([zone, count]) => (
                <div
                  key={zone}
                  className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm"
                >
                  <span>{zone}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant={showOnlyMismatch ? "primary" : "secondary"}
            onClick={() => setShowOnlyMismatch((v) => !v)}
          >
            {showOnlyMismatch ? "Đang lọc mismatch" : "Hiện tất cả"}
          </Button>

          <Button
            onClick={() => void finishSession()}
            disabled={!rows.length || applying || !canApplyStocktake}
          >
            {applying ? "Đang chốt..." : "Chốt phiên kiểm kho"}
          </Button>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4">
          <p className="font-medium text-neutral-900">Review rows realtime</p>
          <p className="mt-1 text-sm text-neutral-500">
            {visibleRows.length} dòng hiển thị
          </p>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">
              Đang tải dữ liệu...
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Tồn chi nhánh</th>
                  <th className="px-4 py-3 font-medium">Kho tổng</th>
                  <th className="px-4 py-3 font-medium">Đã scan</th>
                  <th className="px-4 py-3 font-medium">Lệch</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Thao tác</th>
                  <th className="px-4 py-3 font-medium">Events</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.sku}
                    className={`border-t border-neutral-200 align-top transition ${row.sku === lastScannedSku ? "bg-amber-50" : ""
                      }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.sku}</p>
                      {row.variant?.productName ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          {row.variant.productName}
                          {row.variant.color ? ` · ${row.variant.color}` : ""}
                          {row.variant.size ? ` · ${row.variant.size}` : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-red-500">
                          Không tìm thấy variant
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">{row.system}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {row.totalSystem}
                    </td>
                    <td className="px-4 py-3 font-semibold">{row.counted}</td>

                    <td
                      className={`px-4 py-3 font-medium ${row.diff === 0
                        ? "text-emerald-600"
                        : row.diff > 0
                          ? "text-blue-600"
                          : "text-red-500"
                        }`}
                    >
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.status === "MATCH"
                            ? "green"
                            : row.status === "MISMATCH"
                              ? "amber"
                              : "red"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void adjustRowCount(row.sku, -1)}
                          className="rounded-xl border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => void adjustRowCount(row.sku, 1)}
                          className="rounded-xl border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
                        >
                          +1
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">{row.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <h3 className="text-lg font-semibold">100 lần quét gần nhất</h3>
        <div className="mt-4 space-y-2">
          {latestEvents.length === 0 ? (
            <p className="text-sm text-neutral-500">Chưa có lịch sử quét.</p>
          ) : (
            latestEvents.slice(0, 100).map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {event.qtyDelta > 0 ? "+1" : event.qtyDelta} · {event.sku}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {event.status}
                    {event.locationCode ? ` · ${event.locationCode}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-neutral-500">
                  <p>{event.zone || "Chưa chọn khu"}</p>
                  <p>{new Date(event.createdAt).toLocaleString("vi-VN")}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}