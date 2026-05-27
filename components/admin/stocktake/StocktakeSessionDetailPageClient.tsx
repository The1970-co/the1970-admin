"use client";



/* STOCKTAKE_V27_DETAIL_SCOPE */
function getScopedStocktakeRowsV27(detail: any, items: any[]) {
  const branchId = String(detail?.branchId || detail?.session?.branchId || '').trim();
  const raw = Array.isArray(items) ? items : [];

  const scoped = raw.filter((item: any) => {
    const itemBranchId = String(item?.branchId || item?.branch?.id || item?.inventoryItem?.branchId || '').trim();
    if (branchId && itemBranchId) return itemBranchId === branchId;

    const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
    const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
    const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
    const status = String(item?.status || '').toUpperCase();

    // Chặn catalog toàn hệ thống rỗng: snapshot=0, counted=0, diff=0, chưa có scan.
    return snapshotQty !== 0 || countedQty !== 0 || diff !== 0 || status === 'NOT_FOUND' || Boolean(item?.lastScannedAt || item?.workerId);
  });

  return scoped;
}

function buildScopedStocktakeKpiV27(detail: any, items: any[]) {
  const rows = getScopedStocktakeRowsV27(detail, items);
  const snapshotSku = rows.filter((item: any) => Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0) !== 0).length;
  const countedSku = rows.filter((item: any) => Number(item?.countedQty ?? item?.counted ?? 0) !== 0).length;
  const diffRows = rows.filter((item: any) => {
    const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
    const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
    const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
    return diff !== 0;
  });
  const totalDiffQty = diffRows.reduce((sum: number, item: any) => {
    const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
    const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
    const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
    return sum + diff;
  }, 0);

  return {
    totalSku: rows.length,
    totalSnapshotSku: rows.length,
    snapshotSku,
    countedSku,
    checkedSku: countedSku,
    uncountedSku: Math.max(rows.length - countedSku, 0),
    uncheckedSku: Math.max(rows.length - countedSku, 0),
    discrepancySku: diffRows.length,
    mismatchSku: diffRows.length,
    totalDiffQty,
  };
}

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import {
  applyStocktakeSession,
  downloadStocktakeSessionExcel,
  getStocktakeSessionDetail,
  getStocktakeSessionLogs,
  type StocktakeDetailItem,
  type StocktakeLogItem,
  type StocktakeSessionDetail,
} from "@/lib/stocktake-api";


const STOCKTAKE_EXCEL_TEMPLATE_FILE_NAME = "EXEL KIEM KHO THE 1970.xlsx";
const STOCKTAKE_EXCEL_TEMPLATE_BASE64 = "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";

function downloadStocktakeExcelTemplate() {
  if (typeof window === "undefined") return;

  const byteCharacters = window.atob(STOCKTAKE_EXCEL_TEMPLATE_BASE64);
  const buffer = new ArrayBuffer(byteCharacters.length);
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < byteCharacters.length; index += 1) {
    bytes[index] = byteCharacters.charCodeAt(index);
  }

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = STOCKTAKE_EXCEL_TEMPLATE_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple" | "black";
type TabKey = "ALL" | "COUNTED" | "MISMATCH" | "UNCOUNTED" | "MATCH" | "NOT_FOUND" | "LOGS";

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: Tone }) {
  const styles: Record<Tone, string> = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    black: "border-neutral-950 bg-neutral-950 text-white",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}

function statusTone(status?: string): Tone {
  const s = String(status || "").toUpperCase();
  if (s === "APPLIED" || s === "MATCH" || s === "MATCHED") return "green";
  if (s === "FINISHED") return "blue";
  if (s === "IN_PROGRESS" || s === "PAUSED" || s === "UNCOUNTED") return "amber";
  if (s === "CANCELLED" || s === "NOT_FOUND" || s === "MISMATCH" || s === "OVER" || s === "SHORT") return "red";
  return "gray";
}

function statusLabel(status?: string) {
  const s = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    IN_PROGRESS: "Đang kiểm",
    PAUSED: "Tạm dừng",
    FINISHED: "Đã kết thúc kiểm",
    APPLIED: "Đã chốt tồn",
    CANCELLED: "Đã huỷ",
    MATCH: "Khớp",
    MATCHED: "Khớp",
    MISMATCH: "Chênh lệch",
    OVER: "Thừa",
    SHORT: "Thiếu",
    UNCOUNTED: "Chưa kiểm",
    NOT_FOUND: "Mã lạ",
  };
  return labels[s] || s || "—";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function diffText(value?: number | null) {
  const n = Number(value || 0);
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n);
}

function StatCard({ title, value, helper, tone = "blue" }: { title: string; value: React.ReactNode; helper?: React.ReactNode; tone?: Exclude<Tone, "gray" | "black"> }) {
  const colors: Record<Exclude<Tone, "gray" | "black">, string> = {
    blue: "text-blue-700 bg-blue-50",
    green: "text-green-700 bg-green-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
    purple: "text-purple-700 bg-purple-50",
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      <p className={`mt-2 inline-flex rounded-xl px-3 py-1 text-2xl font-extrabold ${colors[tone]}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs font-medium text-neutral-500">{helper}</p> : null}
    </div>
  );
}

function normalizeBranchId(value: any) {
  return String(value || "").trim();
}

function isCountedStocktakeRow(row: StocktakeDetailItem) {
  const status = String(row.status || "").toUpperCase();
  if (["COUNTED", "MATCH", "MATCHED", "MISMATCH", "OVER", "SHORT", "NOT_FOUND"].includes(status)) return true;
  if (row.isCounted === true) return true;
  if (row.lastScannedAt) return true;
  if (Number(row.eventCount || 0) > 0) return true;
  return Number(row.countedQty || 0) !== 0;
}

function getBranchScopedStocktakeRows(rows: StocktakeDetailItem[], branchId?: string | null) {
  const targetBranchId = normalizeBranchId(branchId);
  if (!targetBranchId) return rows;

  const rowsWithBranch = rows.filter((row) => normalizeBranchId((row as any).branchId));
  if (!rowsWithBranch.length) return rows;

  return rows.filter((row) => normalizeBranchId((row as any).branchId) === targetBranchId);
}

function buildBranchScopedKpiForDetail(rows: StocktakeDetailItem[], fallback?: any) {
  const totalRows = rows.length;
  const countedRows = rows.filter(isCountedStocktakeRow);
  const countedSku = countedRows.length;
  const notFoundSku = rows.filter((row) => String(row.status || "").toUpperCase() === "NOT_FOUND").length;
  const mismatchSku = rows.filter((row) => Number(row.diff || 0) !== 0).length;
  const matchedSku = rows.filter((row) => isCountedStocktakeRow(row) && Number(row.diff || 0) === 0 && String(row.status || "").toUpperCase() !== "NOT_FOUND").length;
  const totalSnapshotQty = rows.reduce((sum, row) => sum + Number(row.snapshotQty || 0), 0);
  const totalCountedQty = rows.reduce((sum, row) => sum + Number(row.countedQty || 0), 0);
  const totalDiffQty = rows.reduce((sum, row) => sum + Number(row.diff || 0), 0);
  const totalDiffValue = rows.reduce((sum, row) => sum + Number((row as any).diffValue ?? (row as any).valueDiff ?? 0), 0);

  return {
    ...(fallback || {}),
    totalRows,
    totalSku: totalRows,
    totalSnapshotSku: totalRows,
    countedSku,
    uncountedSku: 0,
    matchedSku,
    mismatchSku,
    discrepancySku: mismatchSku,
    notFoundSku,
    totalSnapshotQty,
    totalCountedQty,
    totalDiffQty,
    totalDiffValue,
  };
}

function collectPermissionKeys(user: any) {
  const keys = new Set<string>();
  if (Array.isArray(user?.permissions)) user.permissions.forEach((key: any) => key && keys.add(String(key)));
  if (Array.isArray(user?.permissionKeys)) user.permissionKeys.forEach((key: any) => key && keys.add(String(key)));
  if (Array.isArray(user?.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => {
      if (Array.isArray(row?.permissionKeys)) row.permissionKeys.forEach((key: any) => key && keys.add(String(key)));
    });
  }
  return keys;
}

function isOwnerOrAdmin(user: any) {
  const roles = [...(Array.isArray(user?.roles) ? user.roles : []), user?.role]
    .map((role: any) => String(role || "").toLowerCase())
    .filter(Boolean);
  return roles.includes("owner") || roles.includes("admin");
}

function hasUserPermission(user: any, permission: string) {
  if (isOwnerOrAdmin(user)) return true;
  const keys = collectPermissionKeys(user);
  return keys.has("*") || keys.has(permission);
}

export default function StocktakeSessionDetailPageClient({ sessionId }: { sessionId: string }) {
  const [detail, setDetail] = useState<StocktakeSessionDetail | null>(null);
  const [items, setItems] = useState<StocktakeDetailItem[]>([]);
  const [logs, setLogs] = useState<StocktakeLogItem[]>([]);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUserFromStorage());
  }, []);

  const canApplyStocktake = hasUserPermission(currentUser, "stocktake.apply");
  const canExportStocktake = hasUserPermission(currentUser, "stocktake.excel.export");
  const canSeeStocktakeValue =
    isOwnerOrAdmin(currentUser) ||
    hasUserPermission(currentUser, "stocktake.value.view") ||
    hasUserPermission(currentUser, "inventory.value.view") ||
    hasUserPermission(currentUser, "finance.view");

  const loadDetail = async () => {
    try {
      setLoading(true);
      setMessage("");

      // Fast mode: chỉ gọi detail 1 lần. Backend đã trả rows/items là các SKU có phát sinh
      // trong phiếu, không còn load toàn bộ snapshot 6.000+ SKU của kho.
      const detailData = await getStocktakeSessionDetail(sessionId);
      const rawItems = Array.isArray((detailData as any)?.items)
        ? (detailData as any).items
        : Array.isArray((detailData as any)?.rows)
          ? (detailData as any).rows
          : [];
      const scopedItems = getBranchScopedStocktakeRows(rawItems, (detailData as any)?.branchId);
      const scopedKpi = buildBranchScopedKpiForDetail(scopedItems, (detailData as any)?.kpi);

      setDetail({ ...(detailData as any), kpi: scopedKpi });
      setItems(scopedItems);

      if (tab === "LOGS") {
        const logData = Array.isArray((detailData as any)?.logs)
          ? (detailData as any).logs
          : await getStocktakeSessionLogs(sessionId);
        setLogs(Array.isArray(logData) ? logData : []);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được chi tiết phiên kiểm.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(), 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tab]);

  const scopedItems = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const sessionBranchId = String((detail as any)?.branchId || "").trim();
    const q = query.trim().toLowerCase();
    const currentTab = String(tab || "ALL").toUpperCase();

    return rows.filter((item: any) => {
      const itemBranchId = String(item?.branchId || item?.branch?.id || item?.inventoryBranchId || "").trim();
      if (sessionBranchId && itemBranchId && itemBranchId !== sessionBranchId) return false;

      const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
      const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
      const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
      const status = String(item?.status || "").toUpperCase();

      if (currentTab === "COUNTED" && !(countedQty !== 0 || Boolean(item?.lastScannedAt) || Boolean(item?.workerId))) return false;
      if (currentTab === "MISMATCH" && !(diff !== 0 || status === "MISMATCH" || status === "OVER" || status === "SHORT")) return false;
      if (currentTab === "MATCH" && !(diff === 0 && status !== "NOT_FOUND")) return false;
      if (currentTab === "NOT_FOUND" && status !== "NOT_FOUND") return false;

      if (!q) return true;
      return [
        item?.sku,
        item?.barcode,
        item?.productName,
        item?.color,
        item?.size,
        item?.zone,
        item?.rackCode,
        item?.locationCode,
        item?.workerName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, detail, query, tab]);

  const kpi = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const totalRows = rows.length;
    const countedSku = rows.filter((item: any) => Number(item?.countedQty ?? item?.counted ?? 0) !== 0 || Boolean(item?.lastScannedAt) || Boolean(item?.workerId)).length;
    const notFoundSku = rows.filter((item: any) => String(item?.status || "").toUpperCase() === "NOT_FOUND").length;
    const mismatchSku = rows.filter((item: any) => {
      const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
      const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
      const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
      const status = String(item?.status || "").toUpperCase();
      return diff !== 0 || status === "MISMATCH" || status === "OVER" || status === "SHORT";
    }).length;
    const matchedSku = rows.filter((item: any) => {
      const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
      const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
      const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
      return (countedQty !== 0 || Boolean(item?.lastScannedAt) || Boolean(item?.workerId)) && diff === 0;
    }).length;
    const totalDiffQty = rows.reduce((sum: number, item: any) => {
      const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
      const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
      return sum + Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
    }, 0);
    const totalDiffValue = rows.reduce((sum: number, item: any) => sum + Number(item?.diffValue ?? item?.valueDiff ?? 0), 0);

    return {
      ...(detail?.kpi || {}),
      totalRows,
      totalSku: totalRows,
      totalSnapshotSku: totalRows,
      countedSku,
      uncountedSku: 0,
      mismatchSku,
      discrepancySku: mismatchSku,
      matchedSku,
      notFoundSku,
      totalDiffQty,
      totalDiffValue,
    };
  }, [detail, items]);
  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => `${log.sku} ${log.barcode || ""} ${log.workerName || ""} ${log.zone || ""} ${log.locationCode || ""}`.toLowerCase().includes(q));
  }, [logs, query]);

  const handleApply = async () => {
    if (!canApplyStocktake) {
      setMessage("Bạn không có quyền cân bằng kho.");
      return;
    }
    if (!detail?.id) return;
    const ok = window.confirm("Cân bằng kho cho phiên này? Hệ thống sẽ áp chênh lệch đã kiểm vào tồn kho và chuyển trạng thái đã chốt.");
    if (!ok) return;

    try {
      setApplying(true);
      const result = await applyStocktakeSession(detail.id, "Cân bằng kho từ trang chi tiết phiên kiểm");
      setMessage(`Đã cân bằng kho. Điều chỉnh ${result.adjustedCount} dòng, tổng lệch ${diffText(result.totalDelta)}.`);
      await loadDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không cân bằng được kho.");
    } finally {
      setApplying(false);
    }
  };

  const canApply = canApplyStocktake && String(detail?.status || "").toUpperCase() === "FINISHED";

  return (
    <div className="min-h-screen space-y-5 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/stocktake-sessions" className="text-sm font-semibold text-neutral-500 hover:text-neutral-950">← Lịch sử kiểm kho</Link>
            {detail?.status ? <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge> : null}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-neutral-950">{detail?.name || "Chi tiết phiên kiểm kho"}</h1>
          <p className="mt-1 font-mono text-xs text-neutral-400">{sessionId}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/stocktake" className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50">Màn kiểm realtime</Link>
          <button type="button" onClick={downloadStocktakeExcelTemplate} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">Tải file mẫu</button>
          {canExportStocktake ? <button onClick={() => void downloadStocktakeSessionExcel(sessionId, `kiem-kho-${sessionId}.xlsx`)} className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-100">Xuất Excel</button> : null}
          <button onClick={handleApply} disabled={!canApply || applying} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-neutral-300">
            {applying ? "Đang cân bằng..." : "Cân bằng kho"}
          </button>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-700 shadow-sm">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="SKU trong phiếu" value={formatNumber(kpi?.totalSnapshotSku ?? kpi?.totalSku)} helper="chỉ SKU đã phát sinh kiểm" tone="blue" />
        <StatCard title="Đã kiểm" value={formatNumber(kpi?.countedSku)} helper="SKU đã có count" tone="green" />
        <StatCard title="Chênh lệch" value={formatNumber(kpi?.mismatchSku ?? kpi?.discrepancySku)} helper="thiếu / thừa so snapshot" tone="red" />
        <StatCard title="Tổng lệch SL" value={diffText(kpi?.totalDiffQty)} helper="counted - snapshot" tone="purple" />
        {canSeeStocktakeValue ? (
          <StatCard title="Giá trị lệch" value={formatNumber(kpi?.totalDiffValue)} helper="tạm tính theo giá vốn" tone="amber" />
        ) : null}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-5">
          <div><p className="text-xs font-medium text-neutral-500">Chi nhánh</p><p className="mt-1 text-sm font-bold text-neutral-900">{detail?.branchId || "—"}</p></div>
          <div><p className="text-xs font-medium text-neutral-500">Bắt đầu</p><p className="mt-1 text-sm font-bold text-neutral-900">{formatDateTime(detail?.startedAt || detail?.createdAt)}</p></div>
          <div><p className="text-xs font-medium text-neutral-500">Kết thúc</p><p className="mt-1 text-sm font-bold text-neutral-900">{formatDateTime(detail?.finishedAt)}</p></div>
          <div><p className="text-xs font-medium text-neutral-500">Đã cân bằng</p><p className="mt-1 text-sm font-bold text-neutral-900">{formatDateTime(detail?.appliedAt)}</p></div>
          <div><p className="text-xs font-medium text-neutral-500">Phiên con</p><p className="mt-1 text-sm font-bold text-neutral-900">{detail?.workers?.length || 0} máy</p></div>
        </div>
        {detail?.note ? <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">{detail.note}</p> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["ALL", "Toàn bộ", kpi?.totalRows ?? kpi?.totalSku],
              ["COUNTED", "Đã kiểm", kpi?.countedSku],
              ["MISMATCH", "Chênh lệch", kpi?.mismatchSku ?? kpi?.discrepancySku],
              ["MATCH", "Khớp", kpi?.matchedSku],
              ["NOT_FOUND", "Mã lạ", kpi?.notFoundSku],
              ["LOGS", "Log quét", undefined],
            ] as Array<[TabKey, string, number | undefined]>).map(([key, label, count]) => (
              <button key={key} onClick={() => setTab(key)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${tab === key ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                {label}{typeof count === "number" ? ` (${formatNumber(count)})` : ""}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm SKU, tên, khu, kệ..." className="w-64 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500" />
            <button onClick={() => void loadDetail()} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50">Refresh</button>
          </div>
        </div>

        <div className="max-h-[650px] overflow-auto">
          {tab === "LOGS" ? (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr><th className="px-4 py-3 font-bold">Thời gian</th><th className="px-4 py-3 font-bold">Nhân viên</th><th className="px-4 py-3 font-bold">SKU / Barcode</th><th className="px-4 py-3 font-bold">SL</th><th className="px-4 py-3 font-bold">Khu / vị trí</th><th className="px-4 py-3 font-bold">Trạng thái</th><th className="px-4 py-3 font-bold">Ghi chú</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">Đang tải...</td></tr> : filteredLogs.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">Chưa có log.</td></tr> : filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-neutral-100 hover:bg-neutral-50/70">
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-neutral-800">{log.workerName || log.workerId || "—"}</td>
                    <td className="px-4 py-3"><p className="font-bold text-neutral-950">{log.sku}</p><p className="text-xs text-neutral-400">{log.barcode || "—"}</p></td>
                    <td className={`px-4 py-3 font-extrabold ${Number(log.qtyDelta) >= 0 ? "text-green-700" : "text-red-700"}`}>{diffText(log.qtyDelta)}</td>
                    <td className="px-4 py-3 text-neutral-600">{log.zone || "—"} · {log.locationCode || "—"}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(log.status)}>{statusLabel(log.status)}</Badge></td>
                    <td className="px-4 py-3 text-neutral-500">{log.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr><th className="px-4 py-3 font-bold">SKU</th><th className="px-4 py-3 font-bold">Sản phẩm</th><th className="px-4 py-3 font-bold">Snapshot</th><th className="px-4 py-3 font-bold">Đã kiểm</th><th className="px-4 py-3 font-bold">Lệch</th>{canSeeStocktakeValue ? <th className="px-4 py-3 font-bold">Giá trị lệch</th> : null}<th className="px-4 py-3 font-bold">Vị trí</th><th className="px-4 py-3 font-bold">Người kiểm cuối</th><th className="px-4 py-3 font-bold">Trạng thái</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="px-4 py-10 text-center text-neutral-500">Đang tải...</td></tr> : scopedItems.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-neutral-500">Không có dòng phù hợp.</td></tr> : scopedItems.map((item) => (
                  <tr key={`${item.variantId || item.sku}-${item.status}`} className="border-t border-neutral-100 hover:bg-neutral-50/70">
                    <td className="px-4 py-3"><p className="font-bold text-neutral-950">{item.sku}</p><p className="text-xs text-neutral-400">{item.barcode || ""}</p></td>
                    <td className="px-4 py-3"><p className="font-semibold text-neutral-900">{item.productName || "—"}</p><p className="text-xs text-neutral-500">{[item.color, item.size].filter(Boolean).join(" · ")}</p></td>
                    <td className="px-4 py-3 font-bold text-neutral-700">{formatNumber(item.snapshotQty)}</td>
                    <td className="px-4 py-3 font-bold text-neutral-700">{formatNumber(item.countedQty)}</td>
                    <td className={`px-4 py-3 font-extrabold ${Number(item.diff) === 0 ? "text-neutral-500" : Number(item.diff) > 0 ? "text-green-700" : "text-red-700"}`}>{diffText(item.diff)}</td>
                    {canSeeStocktakeValue ? (
                      <td className="px-4 py-3 font-semibold text-neutral-700">{formatNumber(item.diffValue ?? item.valueDiff)}</td>
                    ) : null}
                    <td className="px-4 py-3 text-neutral-600">{[item.zone, item.rackCode, item.locationCode].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-4 py-3"><p className="font-semibold text-neutral-700">{item.workerName || item.workerId || "—"}</p><p className="text-xs text-neutral-400">{formatDateTime(item.lastScannedAt)}</p></td>
                    <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{item.statusLabel || statusLabel(item.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
