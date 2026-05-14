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
  getStocktakeSessionItems,
  getStocktakeSessionLogs,
  type StocktakeDetailItem,
  type StocktakeLogItem,
  type StocktakeSessionDetail,
} from "@/lib/stocktake-api";

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
    uncountedSku: Math.max(totalRows - countedSku, 0),
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
      const [detailData, itemData] = await Promise.all([
        getStocktakeSessionDetail(sessionId),
        getStocktakeSessionItems(sessionId, { status: tab === "LOGS" ? "ALL" : tab, q: query.trim() || undefined }),
      ]);

      const rawItems = Array.isArray(itemData) ? itemData : [];
      const scopedItems = getBranchScopedStocktakeRows(rawItems, (detailData as any)?.branchId);
      const scopedKpi = buildBranchScopedKpiForDetail(scopedItems, (detailData as any)?.kpi);

      setDetail({ ...(detailData as any), kpi: scopedKpi });
      setItems(scopedItems);

      if (tab === "LOGS") {
        const logData = await getStocktakeSessionLogs(sessionId);
        setLogs(Array.isArray(logData) ? logData : []);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được chi tiết phiên kiểm.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(), 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tab, query]);

  const scopedItems = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const sessionBranchId = String((detail as any)?.branchId || "").trim();

    return rows.filter((item: any) => {
      const itemBranchId = String(item?.branchId || item?.branch?.id || item?.inventoryBranchId || "").trim();
      if (sessionBranchId && itemBranchId) return itemBranchId === sessionBranchId;

      const snapshotQty = Number(item?.snapshotQty ?? item?.systemQty ?? item?.openingQty ?? 0);
      const countedQty = Number(item?.countedQty ?? item?.counted ?? 0);
      const diff = Number(item?.diff ?? item?.deltaQty ?? (countedQty - snapshotQty));
      const status = String(item?.status || "").toUpperCase();

      // Fallback cho API cũ đang trả toàn bộ 6.184 variant:
      // chỉ giữ SKU có tồn snapshot của phiên/chi nhánh, đã kiểm, có lệch, mã lạ hoặc có log scan.
      // Những SKU toàn hệ thống snapshot=0/count=0/status=UNCOUNTED sẽ bị ẩn khỏi chi tiết phiên chi nhánh.
      return (
        snapshotQty !== 0 ||
        countedQty !== 0 ||
        diff !== 0 ||
        Boolean(item?.lastScannedAt) ||
        Boolean(item?.workerId) ||
        status === "NOT_FOUND" ||
        status === "MISMATCH" ||
        status === "OVER" ||
        status === "SHORT" ||
        status === "MATCH" ||
        status === "MATCHED"
      );
    });
  }, [items, detail]);

  const kpi = useMemo(() => {
    const rows = scopedItems;
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
      uncountedSku: Math.max(totalRows - countedSku, 0),
      mismatchSku,
      discrepancySku: mismatchSku,
      matchedSku,
      notFoundSku,
      totalDiffQty,
      totalDiffValue,
    };
  }, [detail, scopedItems]);
  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => `${log.sku} ${log.barcode || ""} ${log.workerName || ""} ${log.zone || ""} ${log.locationCode || ""}`.toLowerCase().includes(q));
  }, [logs, query]);

  const handleApply = async () => {
    if (!canApplyStocktake) {
      setMessage("Bạn không có quyền chốt tồn kiểm kho.");
      return;
    }
    if (!detail?.id) return;
    const ok = window.confirm("Chốt tồn kho thật cho phiên này? Hệ thống sẽ ghi chênh lệch vào tồn kho và chuyển trạng thái APPLIED.");
    if (!ok) return;

    try {
      setApplying(true);
      const result = await applyStocktakeSession(detail.id, "Chốt từ trang chi tiết phiên kiểm");
      setMessage(`Đã chốt tồn. Điều chỉnh ${result.adjustedCount} dòng, tổng lệch ${diffText(result.totalDelta)}.`);
      await loadDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không chốt được tồn kho.");
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
          {canExportStocktake ? <button onClick={() => void downloadStocktakeSessionExcel(sessionId, `kiem-kho-${sessionId}.xlsx`)} className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-100">Xuất Excel</button> : null}
          <button onClick={handleApply} disabled={!canApply || applying} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300">
            {applying ? "Đang chốt..." : "Chốt tồn kho thật"}
          </button>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-700 shadow-sm">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="SKU snapshot" value={formatNumber(kpi?.totalSnapshotSku ?? kpi?.totalSku)} helper="số SKU có trong ảnh chụp tồn" tone="blue" />
        <StatCard title="Đã kiểm" value={formatNumber(kpi?.countedSku)} helper="SKU đã có count" tone="green" />
        <StatCard title="Chưa kiểm" value={formatNumber(kpi?.uncountedSku)} helper="lọc sẵn ở tab Chưa kiểm" tone="amber" />
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
          <div><p className="text-xs font-medium text-neutral-500">Đã chốt tồn</p><p className="mt-1 text-sm font-bold text-neutral-900">{formatDateTime(detail?.appliedAt)}</p></div>
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
              ["UNCOUNTED", "Chưa kiểm", kpi?.uncountedSku],
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
