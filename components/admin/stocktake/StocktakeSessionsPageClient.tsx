"use client";

import Link from "next/link";
import { API_BASE } from "@/lib/api-base";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadStocktakeSessionExcel,
  getStocktakeSessionsOverview,
  type StocktakeSessionListItem,
  type StocktakeSessionsOverview,
} from "@/lib/stocktake-api";
import { getBranches, type BranchItem } from "@/lib/products-api";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import type { AppRole } from "@/lib/authz";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple" | "black";
type ApplyFilter = "ALL" | "APPLIED" | "NOT_APPLIED";
type ConfirmFilter = "ALL" | "FINISHED_OR_APPLIED" | "NOT_FINISHED";
type WorkerFilter = "ALL" | "HAS_WORKER" | "NO_WORKER";

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
    } catch {}
    throw new Error(message);
  }

  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

type EnrichedStocktakeSession = StocktakeSessionListItem & {
  note?: string | null;
  productMatches?: Array<{
    sku?: string | null;
    productName?: string | null;
    countedQty?: number | null;
    snapshotQty?: number | null;
    diff?: number | null;
  }>;
  matchedProducts?: Array<{
    sku?: string | null;
    productName?: string | null;
    countedQty?: number | null;
    snapshotQty?: number | null;
    diff?: number | null;
  }>;
  createdById?: string | null;
  createdByName?: string | null;
  createdBy?: { id?: string | null; name?: string | null; username?: string | null } | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  confirmedById?: string | null;
  confirmedByName?: string | null;
  finishedById?: string | null;
  finishedByName?: string | null;
  appliedById?: string | null;
  appliedByName?: string | null;
  cancelledById?: string | null;
  cancelledByName?: string | null;
  workers?: Array<{
    id?: string;
    name?: string | null;
    userId?: string | null;
    username?: string | null;
    staffName?: string | null;
    zone?: string | null;
    deviceName?: string | null;
    isActive?: boolean;
    status?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }>;
  kpi?: {
    totalSku?: number;
    totalRows?: number;
    countedSku?: number;
    uncountedSku?: number;
    mismatchSku?: number;
    discrepancySku?: number;
    matchedSku?: number;
    notFoundSku?: number;
    totalDiffQty?: number;
    totalDiffValue?: number;
  } | null;
  _count?: {
    scanEvents?: number;
    workers?: number;
    items?: number;
  };
};


type StocktakeSessionListResponse = {
  items?: EnrichedStocktakeSession[];
  total?: number;
  totalPages?: number;
};

function appendQueryParam(params: URLSearchParams, key: string, value?: string | number | null) {
  const text = String(value ?? "").trim();
  if (!text || text === "ALL") return;
  params.set(key, text);
}

function buildStocktakeSessionsPath(input: {
  branchId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  productQuery?: string;
}) {
  const params = new URLSearchParams();
  appendQueryParam(params, "branchId", input.branchId);
  appendQueryParam(params, "status", input.status);
  appendQueryParam(params, "from", input.from);
  appendQueryParam(params, "to", input.to);
  appendQueryParam(params, "page", input.page || 1);
  appendQueryParam(params, "limit", input.limit || 50);

  // Gửi nhiều alias để backend mới/cũ đều bắt được. Backend không dùng key nào sẽ tự bỏ qua.
  const productText = String(input.productQuery || "").trim();
  if (productText) {
    params.set("productQuery", productText);
    params.set("productQ", productText);
    params.set("sku", productText);
    params.set("q", productText);
  }

  const query = params.toString();
  return query ? `/stocktake-sessions?${query}` : "/stocktake-sessions";
}

function getProductMatches(item: EnrichedStocktakeSession) {
  const rows = Array.isArray(item.productMatches)
    ? item.productMatches
    : Array.isArray(item.matchedProducts)
      ? item.matchedProducts
      : [];

  return rows
    .map((row) => ({
      sku: String(row?.sku || "").trim(),
      productName: String(row?.productName || "").trim(),
      countedQty: Number(row?.countedQty ?? 0),
      snapshotQty: Number(row?.snapshotQty ?? 0),
      diff: Number(row?.diff ?? 0),
    }))
    .filter((row) => row.sku || row.productName);
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const styles: Record<Tone, string> = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    black: "border-neutral-950 bg-neutral-950 text-white",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status?: string): Tone {
  const s = String(status || "").toUpperCase();
  if (s === "APPLIED") return "green";
  if (s === "FINISHED") return "blue";
  if (s === "IN_PROGRESS") return "amber";
  if (s === "PAUSED") return "amber";
  if (s === "CANCELLED") return "red";
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

function compactText(value?: string | null) {
  const text = String(value || "").trim();
  return text || "—";
}

function collectPermissionKeys(user: any) {
  const keys = new Set<string>();
  if (Array.isArray(user?.permissions)) user.permissions.forEach((key: any) => key && keys.add(String(key)));
  if (Array.isArray(user?.permissionKeys)) user.permissionKeys.forEach((key: any) => key && keys.add(String(key)));
  if (Array.isArray(user?.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => {
      if (Array.isArray(row?.permissionKeys)) row.permissionKeys.forEach((key: any) => key && keys.add(String(key)));
      if (Array.isArray(row?.extraPermissionKeys)) row.extraPermissionKeys.forEach((key: any) => key && keys.add(String(key)));
      if (Array.isArray(row?.deniedPermissionKeys)) row.deniedPermissionKeys.forEach((key: any) => key && keys.delete(String(key)));
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

function getCreatorName(item: EnrichedStocktakeSession) {
  return (
    item.createdByName ||
    item.createdBy?.name ||
    item.createdBy?.username ||
    (item as any).creatorName ||
    (item as any).createdUserName ||
    (item as any).staffName ||
    ""
  );
}

function getFinishedByName(item: EnrichedStocktakeSession) {
  return (
    item.finishedByName ||
    item.confirmedByName ||
    item.approvedByName ||
    (item as any).closedByName ||
    (item as any).endedByName ||
    ""
  );
}

function getAppliedByName(item: EnrichedStocktakeSession) {
  return item.appliedByName || (item as any).applyByName || (item as any).stockAppliedByName || "";
}

function getWorkerNames(item: EnrichedStocktakeSession) {
  const workers = Array.isArray(item.workers) ? item.workers : [];

  return workers
    .map((worker) => {
      const row = worker as any;
      return (
        row.name ||
        row.staffName ||
        row.username ||
        row.userId ||
        ""
      );
    })
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getWorkerSummary(item: EnrichedStocktakeSession) {
  const names = getWorkerNames(item);
  if (!names.length) return "—";
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length <= 2) return uniqueNames.join(", ");
  return `${uniqueNames.slice(0, 2).join(", ")} +${uniqueNames.length - 2}`;
}

function getWorkerCount(item: EnrichedStocktakeSession) {
  return item.workers?.length || item._count?.workers || 0;
}

function getScanCount(item: EnrichedStocktakeSession) {
  return item._count?.scanEvents || (item as any).scanEventCount || (item as any).scanCount || 0;
}

function isFinished(item: EnrichedStocktakeSession) {
  const status = String(item.status || "").toUpperCase();
  return status === "FINISHED" || status === "APPLIED";
}

function isApplied(item: EnrichedStocktakeSession) {
  return String(item.status || "").toUpperCase() === "APPLIED" || Boolean(item.appliedAt);
}

export default function StocktakeSessionsPageClient() {
  const [sessions, setSessions] = useState<EnrichedStocktakeSession[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [productQueryDraft, setProductQueryDraft] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [editingNoteSessionId, setEditingNoteSessionId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [applyingSessionId, setApplyingSessionId] = useState<string | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [workerQuery, setWorkerQuery] = useState("");
  const [applyFilter, setApplyFilter] = useState<ApplyFilter>("ALL");
  const [confirmFilter, setConfirmFilter] = useState<ConfirmFilter>("ALL");
  const [workerFilter, setWorkerFilter] = useState<WorkerFilter>("ALL");
  const [minScanCount, setMinScanCount] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [overview, setOverview] = useState<StocktakeSessionsOverview | null>(null);

  const branchesLoadedRef = useRef(false);
  const inFlightSessionKeyRef = useRef("");
  const loadedSessionKeyRef = useRef("");
  const sessionRequestSeqRef = useRef(0);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);

    if (!user) {
      setReady(true);
      return;
    }

    const nextRole = (user.role || "admin") as AppRole;
    const nextBranchId = user.activeBranchId || user.workingBranchId || user.branchId || null;

    setRole(nextRole);
    setCurrentBranchId(nextBranchId);

    if (nextRole !== "admin" && nextRole !== "owner" && nextBranchId) {
      setBranchId(nextBranchId);
    }

    setReady(true);
  }, []);

  const isOwner = role === "admin" || role === "owner";
  const canOpenRealtime = hasUserPermission(currentUser, "stocktake.view");
  const canExportStocktake = hasUserPermission(currentUser, "stocktake.excel.export");
  const canApplyStocktake = hasUserPermission(currentUser, "stocktake.apply");
  const canCancelStocktake = hasUserPermission(currentUser, "stocktake.cancel");
  const canDeleteStocktake = hasUserPermission(currentUser, "stocktake.delete");

  const loadBranches = useCallback(async () => {
    if (branchesLoadedRef.current) return;

    try {
      branchesLoadedRef.current = true;
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      branchesLoadedRef.current = false;
    }
  }, []);

  const loadSessions = useCallback(
    async (options?: { force?: boolean }) => {
      if (!ready) return;

      const params = { branchId, status, from, to, page, limit, productQuery: productQuery.trim() };
      const summaryParams = { branchId, status, from, to };
      const requestKey = JSON.stringify(params);

      if (!options?.force && inFlightSessionKeyRef.current === requestKey) return;
      if (!options?.force && loadedSessionKeyRef.current === requestKey) return;

      const requestSeq = sessionRequestSeqRef.current + 1;
      sessionRequestSeqRef.current = requestSeq;
      inFlightSessionKeyRef.current = requestKey;

      try {
        setLoading(true);
        setMessage("");

        const [listData, overviewData] = await Promise.all([
          apiRequest<StocktakeSessionListResponse>(buildStocktakeSessionsPath(params)),
          getStocktakeSessionsOverview(summaryParams).catch(() => null),
        ]);

        if (sessionRequestSeqRef.current !== requestSeq) return;

        loadedSessionKeyRef.current = requestKey;
        setSessions(Array.isArray(listData.items) ? (listData.items as EnrichedStocktakeSession[]) : []);
        setTotalItems(Number(listData.total || 0));
        setTotalPages(Math.max(1, Number(listData.totalPages || 1)));
        setOverview(overviewData);
      } catch (err) {
        if (sessionRequestSeqRef.current !== requestSeq) return;

        setMessage(err instanceof Error ? err.message : "Không tải được lịch sử kiểm kho.");
        setSessions([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        if (sessionRequestSeqRef.current === requestSeq) {
          inFlightSessionKeyRef.current = "";
          setLoading(false);
        }
      }
    },
    [branchId, from, limit, page, productQuery, ready, status, to],
  );

  useEffect(() => {
    if (!ready) return;
    void loadBranches();
  }, [loadBranches, ready]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setPage(1);
    loadedSessionKeyRef.current = "";
  }, [branchId, status, from, to, productQuery]);


  useEffect(() => {
    if (!ready) return;
    void loadBranches();
  }, [loadBranches, ready]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const visibleSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const creator = creatorQuery.trim().toLowerCase();
    const worker = workerQuery.trim().toLowerCase();
    const minScan = Number(minScanCount || 0);

    return sessions.filter((item) => {
      const branchName = branchMap.get(item.branchId) || "";
      const creatorName = getCreatorName(item);
      const workerText = getWorkerNames(item).join(" ");
      const productMatchText = getProductMatches(item)
        .map((row) => `${row.sku} ${row.productName}`)
        .join(" ");
      const searchBlob = `${item.id} ${item.name} ${item.note || ""} ${item.branchId} ${branchName} ${creatorName} ${workerText} ${productMatchText}`.toLowerCase();

      if (q && !searchBlob.includes(q)) return false;
      if (creator && !creatorName.toLowerCase().includes(creator)) return false;
      if (worker && !workerText.toLowerCase().includes(worker)) return false;

      if (applyFilter === "APPLIED" && !isApplied(item)) return false;
      if (applyFilter === "NOT_APPLIED" && isApplied(item)) return false;

      if (confirmFilter === "FINISHED_OR_APPLIED" && !isFinished(item)) return false;
      if (confirmFilter === "NOT_FINISHED" && isFinished(item)) return false;

      if (workerFilter === "HAS_WORKER" && getWorkerCount(item) <= 0) return false;
      if (workerFilter === "NO_WORKER" && getWorkerCount(item) > 0) return false;

      if (minScan > 0 && getScanCount(item) < minScan) return false;

      return true;
    });
  }, [
    sessions,
    query,
    creatorQuery,
    workerQuery,
    minScanCount,
    applyFilter,
    confirmFilter,
    workerFilter,
    branchMap,
  ]);

  const total = overview?.total ?? totalItems;
  const applied = overview?.applied ?? visibleSessions.filter((s) => isApplied(s)).length;
  const running = overview?.running ?? visibleSessions.filter((s) =>
    ["DRAFT", "IN_PROGRESS", "PAUSED"].includes(String(s.status).toUpperCase()),
  ).length;
  const finished = overview?.finished ?? visibleSessions.filter((s) => String(s.status).toUpperCase() === "FINISHED").length;
  const cancelled = overview?.cancelled ?? visibleSessions.filter((s) => String(s.status).toUpperCase() === "CANCELLED").length;
  const totalScanEvents = overview?.totalScanEvents ?? visibleSessions.reduce((sum, item) => sum + getScanCount(item), 0);
  const totalWorkers = overview?.totalWorkers ?? visibleSessions.reduce((sum, item) => sum + getWorkerCount(item), 0);

  const handleApplySession = async (item: EnrichedStocktakeSession) => {
    if (!canApplyStocktake) {
      setMessage("Bạn không có quyền cân bằng kho.");
      return;
    }

    if (isApplied(item)) {
      setMessage("Phiên kiểm kho này đã cân bằng kho rồi.");
      return;
    }

    const itemStatus = String(item.status || "").toUpperCase();
    if (itemStatus === "CANCELLED") {
      setMessage("Phiên kiểm kho đã huỷ, không thể cân bằng kho.");
      return;
    }

    if (itemStatus !== "FINISHED") {
      setMessage("Phiên kiểm kho cần kết thúc/xác nhận trước khi cân bằng kho.");
      return;
    }

    const kpi = item.kpi || {};
    const mismatch = Number(kpi.discrepancySku ?? kpi.mismatchSku ?? 0);
    const diffQty = Number(kpi.totalDiffQty || 0);
    const ok = window.confirm(
      `Cân bằng kho cho phiên "${item.name || item.id}"?\n\n` +
        `SKU lệch: ${formatNumber(mismatch)}\n` +
        `Tổng lệch SL: ${diffText(diffQty)}\n\n` +
        "Sau khi cân bằng, hệ thống sẽ ghi nhận điều chỉnh tồn kho theo chênh lệch kiểm.",
    );
    if (!ok) return;

    try {
      setApplyingSessionId(item.id);
      setMessage("");
      await apiRequest(`/stocktake-sessions/${item.id}/apply`, {
        method: "PATCH",
        body: JSON.stringify({ note: item.note || "Cân bằng kho từ lịch sử kiểm kho" }),
      });
      setMessage("Đã cân bằng kho cho phiên kiểm kho.");
      loadedSessionKeyRef.current = "";
      await loadSessions({ force: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không cân bằng được kho cho phiên này.");
    } finally {
      setApplyingSessionId(null);
    }
  };

  const handleCancelSession = async (item: EnrichedStocktakeSession) => {
    if (!canCancelStocktake) {
      setMessage("Bạn không có quyền huỷ phiên kiểm kho.");
      return;
    }

    const ok = window.confirm(`Huỷ phiên kiểm kho "${item.name || item.id}"?`);
    if (!ok) return;

    try {
      setLoading(true);
      setMessage("");
      await apiRequest(`/stocktake-sessions/${item.id}/cancel`, {
        method: "PATCH",
      });
      setMessage("Đã huỷ phiên kiểm kho.");
      await loadSessions({ force: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không huỷ được phiên kiểm kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (item: EnrichedStocktakeSession) => {
    if (!canDeleteStocktake) {
      setMessage("Bạn không có quyền xoá phiên kiểm kho.");
      return;
    }

    const ok = window.confirm(
      `Xoá vĩnh viễn phiên kiểm kho "${item.name || item.id}"?

Không xoá phiên đã chốt tồn.`,
    );
    if (!ok) return;

    try {
      setLoading(true);
      setMessage("");
      await apiRequest(`/stocktake-sessions/${item.id}`, {
        method: "DELETE",
      });
      setMessage("Đã xoá phiên kiểm kho.");
      await loadSessions({ force: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không xoá được phiên kiểm kho.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setProductQueryDraft("");
    setProductQuery("");
    setCreatorQuery("");
    setWorkerQuery("");
    setStatus("ALL");
    setApplyFilter("ALL");
    setConfirmFilter("ALL");
    setWorkerFilter("ALL");
    setMinScanCount("");
    setFrom("");
    setTo("");
    setPage(1);
    loadedSessionKeyRef.current = "";
    if (isOwner) setBranchId("");
  };

  const applyProductSearch = () => {
    const nextQuery = productQueryDraft.trim();
    setPage(1);
    loadedSessionKeyRef.current = "";
    setProductQuery(nextQuery);
  };

  const startEditNote = (item: EnrichedStocktakeSession) => {
    setEditingNoteSessionId(item.id);
    setNoteDraft(String(item.note || ""));
    setMessage("");
  };

  const cancelEditNote = () => {
    setEditingNoteSessionId(null);
    setNoteDraft("");
  };

  const saveSessionNote = async (item: EnrichedStocktakeSession) => {
    const text = noteDraft.trim();

    try {
      setNoteSavingId(item.id);
      setMessage("");
      await apiRequest(`/stocktake-sessions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: text }),
      });

      setSessions((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, note: text || null } : row,
        ),
      );
      setEditingNoteSessionId(null);
      setNoteDraft("");
      setMessage("Đã lưu ghi chú phiên kiểm kho.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Không lưu được ghi chú phiên kiểm kho.",
      );
    } finally {
      setNoteSavingId(null);
    }
  };

  return (
    <div className="min-h-screen space-y-5 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-950">
            Lịch sử kiểm kho
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Theo dõi người tạo, nhân viên tham gia, trạng thái kết thúc/chốt tồn, lượt scan và lọc nhanh phiên kiểm.
          </p>
        </div>
        {canOpenRealtime ? (
          <Link href="/stocktake" prefetch={false} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">
            + Vào màn kiểm realtime
          </Link>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {message}
        </div>
      ) : null}

      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:grid-cols-4 xl:grid-cols-7">
        <div className="border-r border-neutral-200 p-5 last:border-r-0">
          <p className="text-sm font-medium text-neutral-500">Tổng phiên</p>
          <p className="mt-1 text-2xl font-extrabold">{total}</p>
        </div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0">
          <p className="text-sm font-medium text-neutral-500">Đang mở</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{running}</p>
        </div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0">
          <p className="text-sm font-medium text-neutral-500">Chờ chốt tồn</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-600">{finished}</p>
        </div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0">
          <p className="text-sm font-medium text-neutral-500">Đã chốt tồn</p>
          <p className="mt-1 text-2xl font-extrabold text-green-600">{applied}</p>
        </div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0">
          <p className="text-sm font-medium text-neutral-500">Đã huỷ</p>
          <p className="mt-1 text-2xl font-extrabold text-red-600">{cancelled}</p>
        </div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0">
          <p className="text-sm font-medium text-neutral-500">Tổng máy</p>
          <p className="mt-1 text-2xl font-extrabold text-neutral-900">{formatNumber(totalWorkers)}</p>
        </div>
        <div className="p-5">
          <p className="text-sm font-medium text-neutral-500">Tổng lượt scan</p>
          <p className="mt-1 text-2xl font-extrabold text-purple-700">{formatNumber(totalScanEvents)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-neutral-900">Bộ lọc phiên kiểm</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((value) => !value)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              {showAdvancedFilters ? "Thu gọn lọc" : "Mở lọc nâng cao"}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Xoá lọc
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-6">
          <label className="text-xs font-semibold text-neutral-500 md:col-span-2">
            Tìm kiếm chung
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mã phiên, tên phiên, ghi chú, người tạo, nhân viên..."
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
            />
          </label>

          <label className="text-xs font-semibold text-neutral-500 md:col-span-2">
            Tìm theo sản phẩm / SKU
            <div className="mt-1 flex gap-2">
              <input
                value={productQueryDraft}
                onChange={(e) => setProductQueryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyProductSearch();
                }}
                placeholder="Nhập mã SKU, mã vạch hoặc tên sản phẩm rồi bấm Tìm"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={applyProductSearch}
                disabled={loading}
                className="shrink-0 rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Tìm
              </button>
            </div>
            {productQuery ? (
              <p className="mt-1 text-[11px] font-semibold text-blue-600">
                Đang tìm sản phẩm: {productQuery}
              </p>
            ) : null}
          </label>

          <label className="text-xs font-semibold text-neutral-500">
            Chi nhánh
            <select
              value={branchId}
              onChange={(e) => { setPage(1); loadedSessionKeyRef.current = ""; setBranchId(e.target.value); }}
              disabled={!isOwner}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500 disabled:bg-neutral-50"
            >
              <option value="">Tất cả</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-neutral-500">
            Trạng thái
            <select
              value={status}
              onChange={(e) => { setPage(1); loadedSessionKeyRef.current = ""; setStatus(e.target.value); }}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
            >
              <option value="ALL">Tất cả</option>
              <option value="DRAFT">Nháp</option>
              <option value="IN_PROGRESS">Đang kiểm</option>
              <option value="PAUSED">Tạm dừng</option>
              <option value="FINISHED">Đã kết thúc kiểm</option>
              <option value="APPLIED">Đã chốt tồn</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-neutral-500">
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => { setPage(1); loadedSessionKeyRef.current = ""; setFrom(e.target.value); }}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
            />
          </label>

          <label className="text-xs font-semibold text-neutral-500">
            Đến ngày
            <input
              type="date"
              value={to}
              onChange={(e) => { setPage(1); loadedSessionKeyRef.current = ""; setTo(e.target.value); }}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
            />
          </label>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-3 grid gap-3 md:grid-cols-6">
            <label className="text-xs font-semibold text-neutral-500">
              Người tạo phiên
              <input
                value={creatorQuery}
                onChange={(e) => setCreatorQuery(e.target.value)}
                placeholder="Tên người tạo"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              />
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Nhân viên / máy scan
              <input
                value={workerQuery}
                onChange={(e) => setWorkerQuery(e.target.value)}
                placeholder="Tên nhân viên, máy, khu"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              />
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Trạng thái xác nhận
              <select
                value={confirmFilter}
                onChange={(e) => setConfirmFilter(e.target.value as ConfirmFilter)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="FINISHED_OR_APPLIED">Đã xác nhận/kết thúc</option>
                <option value="NOT_FINISHED">Chưa xác nhận/kết thúc</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Trạng thái chốt tồn
              <select
                value={applyFilter}
                onChange={(e) => setApplyFilter(e.target.value as ApplyFilter)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="APPLIED">Đã chốt tồn</option>
                <option value="NOT_APPLIED">Chưa chốt tồn</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Phiên con / nhân viên
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value as WorkerFilter)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="HAS_WORKER">Có nhân viên/máy scan</option>
                <option value="NO_WORKER">Chưa có nhân viên/máy scan</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Lượt scan tối thiểu
              <input
                type="number"
                min={0}
                value={minScanCount}
                onChange={(e) => setMinScanCount(e.target.value)}
                placeholder="VD: 10"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4">
          <div>
            <p className="text-base font-bold text-neutral-950">Danh sách phiên kiểm</p>
            <p className="mt-1 text-xs font-medium text-neutral-500">
              Đang hiển thị {formatNumber(visibleSessions.length)} / {formatNumber(sessions.length)} phiên ở trang {formatNumber(page)}.
              Tổng theo bộ lọc: {formatNumber(totalItems)} phiên.
              {productQuery ? ` Kết quả đã lọc theo sản phẩm/SKU: ${productQuery}.` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => {
                loadedSessionKeyRef.current = "";
                setPage((value) => Math.max(1, value - 1));
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trước
            </button>
            <span className="min-w-[92px] text-center text-xs font-bold text-neutral-500">
              {formatNumber(page)} / {formatNumber(totalPages)}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => {
                loadedSessionKeyRef.current = "";
                setPage((value) => Math.min(totalPages, value + 1));
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
            </button>
            <button
              onClick={() => {
                loadedSessionKeyRef.current = "";
                void loadSessions({ force: true });
              }}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1420px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-bold">Phiên</th>
                <th className="px-4 py-3 font-bold">Chi nhánh</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Người tạo</th>
                <th className="px-4 py-3 font-bold">Nhân viên / máy scan</th>
                <th className="px-4 py-3 font-bold">Bắt đầu</th>
                <th className="px-4 py-3 font-bold">Kết thúc / xác nhận</th>
                <th className="px-4 py-3 font-bold">Chốt tồn</th>
                <th className="px-4 py-3 font-bold">KPI kiểm kho</th>
                <th className="px-4 py-3 font-bold">Máy / lượt scan</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-neutral-500">
                    Đang tải lịch sử...
                  </td>
                </tr>
              ) : visibleSessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-neutral-500">
                    Không có phiên kiểm phù hợp.
                  </td>
                </tr>
              ) : (
                visibleSessions.map((item) => {
                  const workerNames = getWorkerNames(item);
                  const kpi = item.kpi || {};
                  const mismatch = kpi.mismatchSku ?? kpi.discrepancySku;
                  const scanCount = getScanCount(item);
                  const workerCount = getWorkerCount(item);
                  const creatorName = getCreatorName(item);
                  const finishedByName = getFinishedByName(item);
                  const appliedByName = getAppliedByName(item);

                  return (
                    <tr key={item.id} className="border-t border-neutral-100 align-top hover:bg-neutral-50/70">
                      <td className="px-4 py-3">
                        <Link href={`/stocktake-sessions/${item.id}`} prefetch={false} target="_blank" rel="noopener noreferrer" className="font-bold text-neutral-950 hover:underline">
                          {item.name || item.id}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-neutral-400">{item.id}</p>
                        {editingNoteSessionId === item.id ? (
                          <div className="mt-2 w-[280px] space-y-2">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              rows={3}
                              placeholder="VD: Phiên này kiểm áo phông kệ A, bỏ qua nhóm quần jeans..."
                              className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium outline-none focus:border-neutral-500"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void saveSessionNote(item)}
                                disabled={noteSavingId === item.id}
                                className="rounded-lg bg-neutral-950 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                              >
                                {noteSavingId === item.id ? "Đang lưu..." : "Lưu ghi chú"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditNote}
                                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                              >
                                Huỷ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 max-w-[280px] rounded-xl bg-neutral-50 p-2">
                            <p className="line-clamp-3 whitespace-pre-wrap text-xs text-neutral-600">
                              {item.note || "Chưa có ghi chú phiên."}
                            </p>
                            <button
                              type="button"
                              onClick={() => startEditNote(item)}
                              className="mt-1 text-[11px] font-bold text-blue-600 hover:underline"
                            >
                              {item.note ? "Sửa ghi chú" : "Thêm ghi chú"}
                            </button>
                          </div>
                        )}
                        {getProductMatches(item).length ? (
                          <div className="mt-2 max-w-[280px] rounded-xl border border-blue-100 bg-blue-50 p-2">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-blue-700">Sản phẩm khớp tìm kiếm</p>
                            <div className="mt-1 space-y-1">
                              {getProductMatches(item).slice(0, 3).map((row) => (
                                <p key={`${row.sku}-${row.productName}`} className="text-[11px] font-semibold text-blue-800">
                                  {row.sku || "—"}{row.productName ? ` · ${row.productName}` : ""}
                                  {Number.isFinite(row.countedQty) ? ` · Đếm ${formatNumber(row.countedQty)}` : ""}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-800">{branchMap.get(item.branchId) || item.branchId}</p>
                        <p className="mt-1 font-mono text-xs text-neutral-400">{item.branchId}</p>
                      </td>

                      <td className="px-4 py-3">
                        <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-800">{compactText(creatorName)}</p>
                        <p className="mt-1 text-xs text-neutral-500">{formatDateTime(item.createdAt)}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-800">{getWorkerSummary(item)}</p>
                        {workerNames.length > 0 ? (
                          <div className="mt-1 flex max-w-[260px] flex-wrap gap-1">
                            {workerNames.slice(0, 4).map((name) => (
                              <span key={name} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                                {name}
                              </span>
                            ))}
                            {workerNames.length > 4 ? (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                                +{workerNames.length - 4}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-neutral-400">Chưa có phiên con</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-neutral-600">
                        {formatDateTime(item.startedAt || item.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-800">{formatDateTime(item.finishedAt)}</p>
                        <div className="mt-1">
                          {isFinished(item) ? (
                            <Badge tone="blue">Đã xác nhận/kết thúc</Badge>
                          ) : (
                            <Badge tone="amber">Chưa kết thúc</Badge>
                          )}
                        </div>
                        {finishedByName ? <p className="mt-1 text-xs text-neutral-500">Bởi: {finishedByName}</p> : null}
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          {isApplied(item) ? (
                            <Badge tone="green">Đã chốt tồn</Badge>
                          ) : (
                            <Badge tone="gray">Chưa chốt</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">{formatDateTime(item.appliedAt)}</p>
                        {appliedByName ? <p className="mt-1 text-xs text-neutral-500">Bởi: {appliedByName}</p> : null}
                      </td>

                      <td className="px-4 py-3">
                        <div className="grid min-w-[190px] grid-cols-2 gap-1 text-xs">
                          <span className="rounded-lg bg-neutral-50 px-2 py-1 text-neutral-600">SKU: <b>{formatNumber(kpi.totalRows ?? kpi.totalSku)}</b></span>
                          <span className="rounded-lg bg-green-50 px-2 py-1 text-green-700">Đã kiểm: <b>{formatNumber(kpi.countedSku)}</b></span>
                          <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">Chưa: <b>{formatNumber(kpi.uncountedSku)}</b></span>
                          <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">Lệch: <b>{formatNumber(mismatch)}</b></span>
                          <span className="col-span-2 rounded-lg bg-purple-50 px-2 py-1 text-purple-700">Tổng lệch SL: <b>{diffText(kpi.totalDiffQty)}</b></span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-neutral-600">
                        <p className="font-semibold text-neutral-800">{workerCount} máy · {scanCount} lượt</p>
                        {item.workers?.length ? (
                          <p className="mt-1 max-w-[220px] truncate text-xs text-neutral-500">
                            {item.workers
                              .map((worker) => `${worker.deviceName || "Máy scan"}${worker.zone ? ` · ${worker.zone}` : ""}`)
                              .join(", ")}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canApplyStocktake && !isApplied(item) && String(item.status || "").toUpperCase() === "FINISHED" ? (
                            <button
                              type="button"
                              onClick={() => void handleApplySession(item)}
                              disabled={applyingSessionId === item.id}
                              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
                            >
                              {applyingSessionId === item.id ? "Đang cân bằng..." : "Cân bằng kho"}
                            </button>
                          ) : null}
                          <Link
                            href={`/stocktake-sessions/${item.id}`}
                            prefetch={false}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Xem chi tiết
                          </Link>
                          {canCancelStocktake && !isApplied(item) && String(item.status || "").toUpperCase() !== "CANCELLED" ? (
                            <button
                              type="button"
                              onClick={() => void handleCancelSession(item)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                            >
                              Huỷ
                            </button>
                          ) : null}
                          {canDeleteStocktake && !isApplied(item) ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteSession(item)}
                              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                            >
                              Xoá
                            </button>
                          ) : null}
                          {canExportStocktake ? (
                            <button
                              onClick={() => void downloadStocktakeSessionExcel(item.id, `kiem-kho-${item.id}.xlsx`)}
                              className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100"
                            >
                              Xuất Excel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
