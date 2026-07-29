"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { ArrowLeft, ClipboardList, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "black";

type DetailItem = {
  id?: string;
  sku?: string | null;
  barcode?: string | null;
  productName?: string | null;
  name?: string | null;
  counted?: number | null;
  countedQty?: number | null;
  snapshotQty?: number | null;
  system?: number | null;
  systemQty?: number | null;
  openingQty?: number | null;
  diff?: number | null;
  deltaQty?: number | null;
  status?: string | null;
  events?: number | null;
  eventCount?: number | null;
  lastScannedAt?: string | null;
  workerName?: string | null;
  zone?: string | null;
};

type LogItem = {
  id?: string;
  sku?: string | null;
  barcode?: string | null;
  qtyDelta?: number | null;
  workerName?: string | null;
  zone?: string | null;
  locationCode?: string | null;
  createdAt?: string | null;
};

type SessionDetail = {
  id?: string;
  branchId?: string | null;
  name?: string | null;
  note?: string | null;
  status?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  appliedAt?: string | null;
  code?: string | null;
  sessionCode?: string | null;
  items?: DetailItem[];
  summary?: DetailItem[];
  logs?: LogItem[];
  kpi?: {
    totalSku?: number;
    countedSku?: number;
    uncountedSku?: number;
    mismatchSku?: number;
    discrepancySku?: number;
    totalDiffQty?: number;
  } | null;
};

function statusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    IN_PROGRESS: "Đang kiểm",
    PAUSED: "Tạm dừng",
    FINISHED: "Đã kết thúc",
    APPLIED: "Đã chốt tồn",
    CANCELLED: "Đã huỷ",
  };
  return labels[s] || s || "—";
}

function statusTone(status?: string | null): Tone {
  const s = String(status || "").toUpperCase();
  if (s === "APPLIED") return "green";
  if (s === "FINISHED") return "blue";
  if (s === "IN_PROGRESS" || s === "PAUSED") return "amber";
  if (s === "CANCELLED") return "red";
  return "gray";
}

function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    black: "border-neutral-950 bg-neutral-950 text-white",
  };
  return map[tone];
}

function formatNumber(value?: number | string | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function diffText(value?: number | string | null) {
  const n = Number(value || 0);
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function countedOf(row: DetailItem) {
  return Number(row.countedQty ?? row.counted ?? 0);
}

function systemOf(row: DetailItem) {
  return Number(row.snapshotQty ?? row.systemQty ?? row.system ?? row.openingQty ?? 0);
}

function diffOf(row: DetailItem) {
  const explicit = Number(row.diff ?? row.deltaQty);
  if (Number.isFinite(explicit)) return explicit;
  return countedOf(row) - systemOf(row);
}

function sessionCode(detail: SessionDetail, id: string) {
  const explicit = String(detail.code || detail.sessionCode || "").trim();
  if (explicit) return explicit.toUpperCase();
  const shortId = String(detail.id || id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return shortId ? `KK-${shortId}` : "Phiên kiểm kho";
}

function normalizeDetail(input: any): SessionDetail {
  return input?.session || input?.detail || input?.data || input || {};
}

function normalizeItems(input: any, detail: SessionDetail): DetailItem[] {
  const raw = Array.isArray(input?.items)
    ? input.items
    : Array.isArray(input?.summary)
      ? input.summary
      : Array.isArray(input?.data)
        ? input.data
        : Array.isArray(detail.items)
          ? detail.items
          : Array.isArray(detail.summary)
            ? detail.summary
            : [];
  return raw;
}

function normalizeLogs(input: any, detail: SessionDetail): LogItem[] {
  const raw = Array.isArray(input?.logs)
    ? input.logs
    : Array.isArray(input?.items)
      ? input.items
      : Array.isArray(input?.data)
        ? input.data
        : Array.isArray(detail.logs)
          ? detail.logs
          : [];
  return raw;
}

export default function MobileStocktakeHistoryDetailPage() {
  const routeParams = useParams<{ id?: string | string[] }>();
  const rawSessionId = routeParams?.id;
  const sessionId = String(
    Array.isArray(rawSessionId) ? rawSessionId[0] || "" : rawSessionId || "",
  ).trim();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [items, setItems] = useState<DetailItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showOnlyDiff, setShowOnlyDiff] = useState(true);

  const loadDetail = async () => {
    if (!sessionId) {
      setLoading(false);
      setMessage("Không lấy được mã phiên kiểm kho từ đường dẫn.");
      return;
    }
    setLoading(true);
    setMessage("");
    setLogs([]);
    setLogsLoaded(false);

    try {
      const [detailResult, summaryResult] = await Promise.allSettled([
        apiJson<any>(`/stocktake-sessions/${sessionId}`, {
          redirectOnUnauthorized: true,
          timeoutMs: 30000,
        } as any),
        apiJson<any>(`/stocktake-sessions/${sessionId}/summary`, {
          redirectOnUnauthorized: true,
          timeoutMs: 30000,
        } as any),
      ]);

      if (detailResult.status === "rejected" && summaryResult.status === "rejected") {
        throw detailResult.reason || summaryResult.reason;
      }

      const detailData =
        detailResult.status === "fulfilled" ? detailResult.value : {};
      const nextDetail = normalizeDetail(detailData);

      const summaryData =
        summaryResult.status === "fulfilled" ? summaryResult.value : null;
      const summaryFromEndpoint = normalizeItems(summaryData, nextDetail);
      const summaryItems = summaryFromEndpoint.length
        ? summaryFromEndpoint
        : normalizeItems(detailData, nextDetail);

      setDetail(nextDetail);
      setItems(summaryItems);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được chi tiết kiểm kho.");
      setDetail(null);
      setItems([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!sessionId || logsLoading || logsLoaded) return;

    try {
      setLogsLoading(true);
      const logData = await apiJson<any>(`/stocktake-sessions/${sessionId}/logs`, {
        redirectOnUnauthorized: true,
        timeoutMs: 30000,
      } as any);
      const nextLogs = normalizeLogs(logData, detail || {});
      setLogs(nextLogs.slice(0, 80));
      setLogsLoaded(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được log scan.");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const scopedItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((row) => {
        const diff = diffOf(row);
        const text = `${row.sku || ""} ${row.barcode || ""} ${row.productName || row.name || ""} ${row.workerName || ""}`.toLowerCase();
        if (showOnlyDiff && diff === 0) return false;
        if (q && !text.includes(q)) return false;
        return true;
      })
      .slice(0, 80);
  }, [items, query, showOnlyDiff]);

  const kpi = useMemo(() => {
    const rows = items;
    const countedSku = rows.filter((row) => countedOf(row) !== 0).length;
    const diffRows = rows.filter((row) => diffOf(row) !== 0);
    return {
      totalSku: detail?.kpi?.totalSku ?? rows.length,
      countedSku: detail?.kpi?.countedSku ?? countedSku,
      mismatchSku: detail?.kpi?.mismatchSku ?? detail?.kpi?.discrepancySku ?? diffRows.length,
      totalDiffQty: detail?.kpi?.totalDiffQty ?? diffRows.reduce((sum, row) => sum + diffOf(row), 0),
    };
  }, [detail, items]);

  return (
    <main className="min-h-screen bg-[#f3f3f3] px-4 pb-32 pt-[calc(16px+env(safe-area-inset-top))] text-neutral-950">
      <section className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/mobile/stocktake-history"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Lịch sử
          </Link>
          <button
            type="button"
            onClick={() => loadDetail()}
            className="rounded-full bg-white/10 p-3 active:scale-95"
            aria-label="Tải lại"
          >
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.42em] text-white/50">
          {sessionCode(detail || {}, sessionId)}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          {detail?.name || "Chi tiết kiểm kho"}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClass(statusTone(detail?.status))}`}>
            {statusLabel(detail?.status)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/80">
            {formatDateTime(detail?.createdAt)}
          </span>
        </div>

        {String(detail?.note || "").trim() ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
              Ghi chú
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-white">
              {detail?.note}
            </p>
          </div>
        ) : null}
      </section>

      {message ? (
        <section className="mt-4 rounded-[1.5rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {message}
        </section>
      ) : null}

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Đã kiểm</p>
          <p className="mt-2 text-3xl font-black">{formatNumber(kpi.countedSku)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Lệch SKU</p>
          <p className="mt-2 text-3xl font-black">{formatNumber(kpi.mismatchSku)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Tổng SKU</p>
          <p className="mt-2 text-3xl font-black">{formatNumber(kpi.totalSku)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Lệch tồn</p>
          <p className="mt-2 text-3xl font-black">{diffText(kpi.totalDiffQty)}</p>
        </div>
      </section>

      <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm SKU / tên sản phẩm"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-neutral-200 px-4 text-sm font-bold outline-none"
          />
          <button
            type="button"
            onClick={() => setShowOnlyDiff((value) => !value)}
            className={`rounded-2xl px-4 text-xs font-black ${showOnlyDiff ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            Lệch
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-[1.5rem] bg-white p-5 text-sm font-bold text-neutral-500 shadow-sm">
            Đang tải chi tiết kiểm kho...
          </div>
        ) : scopedItems.length ? (
          scopedItems.map((row, index) => {
            const diff = diffOf(row);
            const sku = String(row.sku || row.barcode || `SKU-${index + 1}`);
            return (
              <article key={`${sku}-${index}`} className="rounded-[1.5rem] border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">{sku}</p>
                    <h2 className="mt-1 line-clamp-2 text-base font-black">
                      {row.productName || row.name || "Sản phẩm"}
                    </h2>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${diff === 0 ? toneClass("green") : diff > 0 ? toneClass("blue") : toneClass("red")}`}>
                    {diffText(diff)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[11px] font-bold text-neutral-400">Hệ thống</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(systemOf(row))}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[11px] font-bold text-neutral-400">Thực tế</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(countedOf(row))}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[11px] font-bold text-neutral-400">Scan</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(row.events || row.eventCount || 0)}</p>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[1.5rem] bg-white p-6 text-center shadow-sm">
            <ClipboardList className="mx-auto h-9 w-9 text-neutral-300" />
            <p className="mt-3 text-base font-black">Chưa có dòng phù hợp</p>
            <p className="mt-1 text-sm font-semibold text-neutral-500">Tắt lọc “Lệch” hoặc tìm SKU khác.</p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400">
              Log scan gần nhất
            </p>
            <p className="mt-1 text-xs font-semibold text-neutral-500">
              Chỉ tải khi cần để trang chi tiết mở nhanh hơn.
            </p>
          </div>
          {!logsLoaded ? (
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={logsLoading}
              className="shrink-0 rounded-2xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              {logsLoading ? "Đang tải..." : "Xem log"}
            </button>
          ) : null}
        </div>

        {logsLoaded ? (
          logs.length ? (
            <div className="mt-3 space-y-2">
              {logs.slice(0, 12).map((log, index) => (
                <div key={log.id || index} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-black">{log.sku || log.barcode || "SKU"}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-neutral-500">
                      {log.workerName || "Nhân viên"} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">
                    {diffText(log.qtyDelta || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-neutral-100 p-3 text-sm font-bold text-neutral-500">
              Phiên này chưa có log scan.
            </p>
          )
        ) : null}
      </section>

      <MobileBottomNav />
    </main>
  );
}
