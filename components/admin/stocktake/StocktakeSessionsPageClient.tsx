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
type SnapshotCleanupFilter = "ALL" | "CLEANED" | "NOT_CLEANED" | "NOT_APPLIED";
type ConfirmDialogState = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "purple" | "red" | "black";
  onConfirm: () => void | Promise<void>;
};

type ToastTone = "success" | "error" | "info";


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
  code?: string | null;
  sessionCode?: string | null;
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
  snapshotPurgedAt?: string | null;
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
  sessionQuery?: string;
}) {
  const params = new URLSearchParams();
  appendQueryParam(params, "branchId", input.branchId);
  appendQueryParam(params, "status", input.status);
  appendQueryParam(params, "from", input.from);
  appendQueryParam(params, "to", input.to);
  appendQueryParam(params, "page", input.page || 1);
  appendQueryParam(params, "limit", input.limit || 50);
  appendQueryParam(params, "query", input.sessionQuery);

  // Tìm sản phẩm/SKU tách riêng với tìm phiên. Không gửi key q để tránh backend hiểu nhầm là tìm phiên.
  const productText = String(input.productQuery || "").trim();
  if (productText) {
    params.set("productQuery", productText);
    params.set("productQ", productText);
    params.set("sku", productText);
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

function normalizeBranchCode(value?: string | null) {
  const text = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (text.includes("THAI HA") || text.includes("THÁI HÀ")) return "TH";
  if (text.includes("CHUA LANG") || text.includes("CHÙA LÁNG")) return "CL";
  if (text.includes("XA DAN") || text.includes("XÃ ĐÀN")) return "XD";
  if (text.includes("QUOC OAI") || text.includes("QUỐC OAI")) return "QO";

  const letters = text.replace(/[^A-Z0-9]+/g, "").slice(0, 2);
  return letters || "CN";
}

function getSessionDisplayCode(item: EnrichedStocktakeSession, branchName?: string) {
  const explicitCode = String((item as any).code || (item as any).sessionCode || "").trim();
  if (explicitCode) return explicitCode.toUpperCase();

  const branchCode = normalizeBranchCode(branchName || item.branchId);
  const shortId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return shortId ? `KK-${branchCode}-${shortId}` : `KK-${branchCode}`;
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

function isSnapshotCleaned(item: EnrichedStocktakeSession) {
  return Boolean((item as any).snapshotPurgedAt);
}

function snapshotCleanupLabel(item: EnrichedStocktakeSession) {
  if (!isApplied(item)) return "Chưa chốt tồn";
  return isSnapshotCleaned(item) ? "Đã dọn snapshot" : "Chưa dọn snapshot";
}

function snapshotCleanupTone(item: EnrichedStocktakeSession): Tone {
  if (!isApplied(item)) return "gray";
  return isSnapshotCleaned(item) ? "green" : "amber";
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
  const [cleanupAllRunning, setCleanupAllRunning] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"apply" | "cancel" | "delete" | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [workerQuery, setWorkerQuery] = useState("");
  const [applyFilter, setApplyFilter] = useState<ApplyFilter>("ALL");
  const [confirmFilter, setConfirmFilter] = useState<ConfirmFilter>("ALL");
  const [workerFilter, setWorkerFilter] = useState<WorkerFilter>("ALL");
  const [snapshotCleanupFilter, setSnapshotCleanupFilter] = useState<SnapshotCleanupFilter>("ALL");
  const [minScanCount, setMinScanCount] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [overview, setOverview] = useState<StocktakeSessionsOverview | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [toast, setToast] = useState<{ tone: ToastTone; title: string; description?: string } | null>(null);


  const branchesLoadedRef = useRef(false);
  const inFlightSessionKeyRef = useRef("");
  const loadedSessionKeyRef = useRef("");
  const sessionRequestSeqRef = useRef(0);
  const pendingScrollYRef = useRef<number | null>(null);
  const lastAppliedSessionIdRef = useRef<string | null>(null);

  const showToast = useCallback((tone: ToastTone, title: string, description?: string) => {
    setToast({ tone, title, description });
    window.setTimeout(() => {
      setToast((current) => (current?.title === title ? null : current));
    }, 3600);
  }, []);

  const preserveCurrentScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    pendingScrollYRef.current = window.scrollY;
  }, []);

  const restorePreservedScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    const y = pendingScrollYRef.current;
    if (typeof y !== "number") return;
    pendingScrollYRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, []);


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
    async (options?: { force?: boolean; silent?: boolean; preserveScroll?: boolean }) => {
      if (!ready) return;

      const params = { branchId, status, from, to, page, limit, productQuery: productQuery.trim(), sessionQuery: query.trim() };
      const summaryParams = { branchId, status, from, to, productQuery: productQuery.trim(), query: query.trim() } as any;
      const requestKey = JSON.stringify(params);

      if (!options?.force && inFlightSessionKeyRef.current === requestKey) return;
      if (!options?.force && loadedSessionKeyRef.current === requestKey) return;

      const requestSeq = sessionRequestSeqRef.current + 1;
      sessionRequestSeqRef.current = requestSeq;
      inFlightSessionKeyRef.current = requestKey;

      try {
        if (options?.preserveScroll) preserveCurrentScroll();
        if (!options?.silent) setLoading(true);
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
          if (!options?.silent) setLoading(false);
          if (options?.preserveScroll) restorePreservedScroll();
        }
      }
    },
    [branchId, from, limit, page, productQuery, query, ready, status, to],
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
  }, [branchId, status, from, to, productQuery, query]);


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
      const displayCode = getSessionDisplayCode(item, branchName);
      const searchBlob = `${displayCode} ${item.id} ${(item as any).code || ""} ${(item as any).sessionCode || ""} ${item.name} ${item.note || ""} ${item.branchId} ${branchName} ${creatorName} ${workerText} ${productMatchText}`.toLowerCase();

      if (q && !searchBlob.includes(q)) return false;
      if (creator && !creatorName.toLowerCase().includes(creator)) return false;
      if (worker && !workerText.toLowerCase().includes(worker)) return false;

      if (applyFilter === "APPLIED" && !isApplied(item)) return false;
      if (applyFilter === "NOT_APPLIED" && isApplied(item)) return false;

      if (confirmFilter === "FINISHED_OR_APPLIED" && !isFinished(item)) return false;
      if (confirmFilter === "NOT_FINISHED" && isFinished(item)) return false;

      if (workerFilter === "HAS_WORKER" && getWorkerCount(item) <= 0) return false;
      if (workerFilter === "NO_WORKER" && getWorkerCount(item) > 0) return false;

      if (snapshotCleanupFilter === "CLEANED" && !isSnapshotCleaned(item)) return false;
      if (snapshotCleanupFilter === "NOT_CLEANED" && (!isApplied(item) || isSnapshotCleaned(item))) return false;
      if (snapshotCleanupFilter === "NOT_APPLIED" && isApplied(item)) return false;

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
    snapshotCleanupFilter,
    branchMap,
  ]);

  const visibleSessionIds = useMemo(() => visibleSessions.map((item) => item.id), [visibleSessions]);
  const selectedSessionIdSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds]);
  const selectedSessions = useMemo(
    () => sessions.filter((item) => selectedSessionIdSet.has(item.id)),
    [sessions, selectedSessionIdSet],
  );
  const selectableVisibleIds = useMemo(() => visibleSessionIds, [visibleSessionIds]);
  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedSessionIdSet.has(id));
  const selectedApplySessions = selectedSessions.filter(
    (item) => !isApplied(item) && String(item.status || "").toUpperCase() === "FINISHED",
  );
  const selectedCancelSessions = selectedSessions.filter(
    (item) => !isApplied(item) && String(item.status || "").toUpperCase() !== "CANCELLED",
  );
  const selectedDeleteSessions = selectedSessions.filter((item) => !isApplied(item));
  const selectedCleanupSessions = selectedSessions.filter(
    (item) => isApplied(item) && !isSnapshotCleaned(item),
  );

  const total = overview?.total ?? totalItems;
  const applied = overview?.applied ?? visibleSessions.filter((s) => isApplied(s)).length;
  const running = overview?.running ?? visibleSessions.filter((s) =>
    ["DRAFT", "IN_PROGRESS", "PAUSED"].includes(String(s.status).toUpperCase()),
  ).length;
  const finished = overview?.finished ?? visibleSessions.filter((s) => String(s.status).toUpperCase() === "FINISHED").length;
  const cancelled = overview?.cancelled ?? visibleSessions.filter((s) => String(s.status).toUpperCase() === "CANCELLED").length;
  const totalScanEvents = overview?.totalScanEvents ?? visibleSessions.reduce((sum, item) => sum + getScanCount(item), 0);
  const totalWorkers = overview?.totalWorkers ?? visibleSessions.reduce((sum, item) => sum + getWorkerCount(item), 0);

  useEffect(() => {
    setSelectedSessionIds((current) => current.filter((id) => sessions.some((item) => item.id === id)));
  }, [sessions]);

  const toggleSelectSession = (id: string) => {
    setSelectedSessionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleSelectVisibleSessions = () => {
    setSelectedSessionIds((current) => {
      if (allVisibleSelected) {
        const visibleSet = new Set(selectableVisibleIds);
        return current.filter((id) => !visibleSet.has(id));
      }

      return Array.from(new Set([...current, ...selectableVisibleIds]));
    });
  };

  const clearSelectedSessions = () => setSelectedSessionIds([]);

  const handleBulkApplySessions = async () => {
    if (!canApplyStocktake) {
      setMessage("Bạn không có quyền cân bằng kho.");
      return;
    }

    if (!selectedApplySessions.length) {
      setMessage("Chưa có phiên hợp lệ để cân bằng kho. Chỉ cân bằng được phiên đã kết thúc và chưa chốt.");
      return;
    }

    const ok = window.confirm(
      `Cân bằng kho ${selectedApplySessions.length} phiên đã chọn?\n\n` +
        "Hệ thống sẽ bỏ qua các phiên không hợp lệ và ghi nhận điều chỉnh tồn kho theo chênh lệch kiểm.",
    );
    if (!ok) return;

    try {
      setBulkAction("apply");
      setMessage("");

      let success = 0;
      let failed = 0;

      for (const item of selectedApplySessions) {
        try {
          await apiRequest(`/stocktake-sessions/${item.id}/apply`, {
            method: "PATCH",
            body: JSON.stringify({ note: item.note || "Cân bằng kho hàng loạt từ lịch sử kiểm kho" }),
          });
          success += 1;
        } catch {
          failed += 1;
        }
      }

      setMessage(`Đã cân bằng ${success} phiên${failed ? `, lỗi ${failed} phiên` : ""}.`);
      setSelectedSessionIds([]);
      loadedSessionKeyRef.current = "";
      await loadSessions({ force: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không xử lý được các phiên đã chọn.");
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkCancelSessions = async () => {
    if (!canCancelStocktake) {
      setMessage("Bạn không có quyền huỷ phiên kiểm kho.");
      return;
    }

    if (!selectedCancelSessions.length) {
      setMessage("Chưa có phiên hợp lệ để huỷ.");
      return;
    }

    const ok = window.confirm(`Huỷ ${selectedCancelSessions.length} phiên kiểm kho đã chọn?`);
    if (!ok) return;

    try {
      setBulkAction("cancel");
      setMessage("");

      let success = 0;
      let failed = 0;

      for (const item of selectedCancelSessions) {
        try {
          await apiRequest(`/stocktake-sessions/${item.id}/cancel`, { method: "PATCH" });
          success += 1;
        } catch {
          failed += 1;
        }
      }

      setMessage(`Đã huỷ ${success} phiên${failed ? `, lỗi ${failed} phiên` : ""}.`);
      setSelectedSessionIds([]);
      loadedSessionKeyRef.current = "";
      await loadSessions({ force: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không huỷ được các phiên đã chọn.");
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkDeleteSessions = async () => {
    if (!canDeleteStocktake) {
      setMessage("Bạn không có quyền xoá phiên kiểm kho.");
      return;
    }

    if (!selectedDeleteSessions.length) {
      setMessage("Chưa có phiên hợp lệ để xoá. Không xoá phiên đã chốt tồn.");
      return;
    }

    const ok = window.confirm(
      `Xoá ${selectedDeleteSessions.length} phiên kiểm kho đã chọn?\n\nKhông xoá phiên đã chốt tồn.`,
    );
    if (!ok) return;

    try {
      setBulkAction("delete");
      setMessage("");

      let success = 0;
      let failed = 0;

      for (const item of selectedDeleteSessions) {
        try {
          await apiRequest(`/stocktake-sessions/${item.id}`, { method: "DELETE" });
          success += 1;
        } catch {
          failed += 1;
        }
      }

      setMessage(`Đã xoá ${success} phiên${failed ? `, lỗi ${failed} phiên` : ""}.`);
      setSelectedSessionIds([]);
      loadedSessionKeyRef.current = "";
      await loadSessions({ force: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không xoá được các phiên đã chọn.");
    } finally {
      setBulkAction(null);
    }
  };

  const applySessionWithoutPageJump = async (item: EnrichedStocktakeSession) => {
    preserveCurrentScroll();
    lastAppliedSessionIdRef.current = item.id;

    try {
      setApplyingSessionId(item.id);
      setMessage("");
      await apiRequest(`/stocktake-sessions/${item.id}/apply`, {
        method: "PATCH",
        body: JSON.stringify({ note: item.note || "Cân bằng kho từ lịch sử kiểm kho" }),
      });

      const appliedAt = new Date().toISOString();
      setSessions((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                status: "APPLIED",
                appliedAt,
                appliedById: currentUser?.id || row.appliedById || null,
                appliedByName: currentUser?.name || currentUser?.fullName || row.appliedByName || null,
              }
            : row,
        ),
      );

      showToast("success", "Đã cân bằng kho", `Phiên ${item.name || item.id} đã được chốt tồn.`);
      loadedSessionKeyRef.current = "";
      await loadSessions({ force: true, silent: true, preserveScroll: true });
    } catch (err) {
      showToast(
        "error",
        "Không cân bằng được kho",
        err instanceof Error ? err.message : "Không cân bằng được kho cho phiên này.",
      );
    } finally {
      setApplyingSessionId(null);
      restorePreservedScroll();
    }
  };

  const handleApplySession = async (item: EnrichedStocktakeSession) => {
    if (!canApplyStocktake) {
      showToast("error", "Không có quyền", "Bạn không có quyền cân bằng kho.");
      return;
    }

    if (isApplied(item)) {
      showToast("info", "Phiên đã chốt tồn", "Phiên kiểm kho này đã cân bằng kho rồi.");
      return;
    }

    const itemStatus = String(item.status || "").toUpperCase();
    if (itemStatus === "CANCELLED") {
      showToast("error", "Không thể cân bằng", "Phiên kiểm kho đã huỷ, không thể cân bằng kho.");
      return;
    }

    if (itemStatus !== "FINISHED") {
      showToast("info", "Chưa đủ điều kiện", "Phiên kiểm kho cần kết thúc/xác nhận trước khi cân bằng kho.");
      return;
    }

    const kpi = item.kpi || {};
    const mismatch = Number(kpi.discrepancySku ?? kpi.mismatchSku ?? 0);
    const diffQty = Number(kpi.totalDiffQty || 0);

    setConfirmDialog({
      title: "Xác nhận cân bằng kho",
      confirmLabel: applyingSessionId === item.id ? "Đang cân bằng..." : "Cân bằng kho",
      tone: "purple",
      description: (
        <div className="space-y-3">
          <p>
            Chốt tồn cho phiên <b>{item.name || item.id}</b>. Hệ thống sẽ ghi nhận điều chỉnh tồn kho theo chênh lệch kiểm.
          </p>
          <div className="grid gap-2 rounded-2xl border border-purple-100 bg-purple-50 p-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-purple-500">SKU lệch</p>
              <p className="mt-1 text-lg font-extrabold text-purple-900">{formatNumber(mismatch)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-purple-500">Tổng lệch SL</p>
              <p className="mt-1 text-lg font-extrabold text-purple-900">{diffText(diffQty)}</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-neutral-500">
            Sau khi xác nhận, dòng này sẽ được cập nhật tại chỗ và trang sẽ giữ nguyên vị trí đang xem.
          </p>
        </div>
      ),
      onConfirm: async () => {
        setConfirmDialog(null);
        await applySessionWithoutPageJump(item);
      },
    });
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
    setSnapshotCleanupFilter("ALL");
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


  const cleanupSelectedSnapshots = async () => {
    if (!canApplyStocktake) {
      showToast("error", "Không có quyền", "Bạn không có quyền dọn snapshot kiểm kho.");
      return;
    }

    if (!selectedCleanupSessions.length) {
      showToast("info", "Chưa chọn phiên hợp lệ", "Chỉ dọn snapshot cho các phiên đã chốt tồn và chưa dọn.");
      return;
    }

    const ok = window.confirm(
      `Dọn snapshot cho ${selectedCleanupSessions.length} phiên đã chọn?\n\n` +
        "Chỉ các phiên đã chốt tồn mới được xử lý. Hệ thống sẽ lưu kết quả nhẹ trước khi xoá snapshot nền.",
    );
    if (!ok) return;

    try {
      setCleanupAllRunning(true);
      const sessionIds = selectedCleanupSessions.map((item) => item.id);
      const result = await apiRequest<{ processedSessions?: number; deletedSnapshots?: number; resultItemCount?: number; failed?: number }>(
        "/stocktake-sessions/cleanup-snapshots",
        { method: "POST", body: JSON.stringify({ sessionIds }) },
      );

      const cleanedSet = new Set(sessionIds);
      setSessions((current) =>
        current.map((row) =>
          cleanedSet.has(row.id) ? { ...row, snapshotPurgedAt: new Date().toISOString() } : row,
        ),
      );

      showToast(
        "success",
        "Đã dọn snapshot đã chọn",
        `Xử lý ${formatNumber(result.processedSessions || 0)} phiên, xoá ${formatNumber(result.deletedSnapshots || 0)} snapshot, lưu ${formatNumber(result.resultItemCount || 0)} dòng kết quả${result.failed ? `, lỗi ${formatNumber(result.failed)} phiên` : ""}.`,
      );
      setSelectedSessionIds((current) => current.filter((id) => !cleanedSet.has(id)));
      loadedSessionKeyRef.current = "";
      await loadSessions({ force: true, silent: true, preserveScroll: true });
    } catch (err) {
      showToast("error", "Không dọn được snapshot đã chọn", err instanceof Error ? err.message : "Không dọn được snapshot đã chọn.");
    } finally {
      setCleanupAllRunning(false);
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
        <div className="flex flex-wrap gap-2">
          {canApplyStocktake ? (
            <button
              type="button"
              onClick={() => void cleanupSelectedSnapshots()}
              disabled={cleanupAllRunning || !selectedCleanupSessions.length}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cleanupAllRunning ? "Đang dọn snapshot..." : `Dọn snapshot đã chọn${selectedCleanupSessions.length ? ` (${selectedCleanupSessions.length})` : ""}`}
            </button>
          ) : null}
          {canOpenRealtime ? (
            <Link href="/stocktake" prefetch={false} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">
              + Vào màn kiểm realtime
            </Link>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-700 shadow-sm">
          {message}
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed right-5 top-5 z-50 w-[360px] rounded-2xl border bg-white p-4 shadow-2xl ${
            toast.tone === "success"
              ? "border-green-200"
              : toast.tone === "error"
                ? "border-red-200"
                : "border-blue-200"
          }`}
        >
          <div className="flex gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                toast.tone === "success"
                  ? "bg-green-50 text-green-700"
                  : toast.tone === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-neutral-950">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-sm font-medium text-neutral-500">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto rounded-lg px-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
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
              Trạng thái snapshot
              <select
                value={snapshotCleanupFilter}
                onChange={(e) => setSnapshotCleanupFilter(e.target.value as SnapshotCleanupFilter)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="CLEANED">Đã dọn snapshot</option>
                <option value="NOT_CLEANED">Chưa dọn snapshot</option>
                <option value="NOT_APPLIED">Chưa chốt tồn</option>
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

        {selectedSessionIds.length > 0 ? (
          <div className="mx-5 mb-4 flex flex-col gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-extrabold text-purple-900">Đã chọn {formatNumber(selectedSessionIds.length)} phiên</p>
              <p className="mt-0.5 text-xs text-purple-700">Có thể cân bằng kho, huỷ hoặc xoá hàng loạt. Phiên không hợp lệ sẽ được bỏ qua.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canApplyStocktake ? (
                <button
                  type="button"
                  onClick={() => void handleBulkApplySessions()}
                  disabled={bulkAction !== null || selectedApplySessions.length === 0}
                  className="rounded-xl border border-purple-300 bg-white px-3 py-2 text-xs font-extrabold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {bulkAction === "apply" ? "Đang cân bằng..." : `Cân bằng kho (${formatNumber(selectedApplySessions.length)})`}
                </button>
              ) : null}
              {canCancelStocktake ? (
                <button
                  type="button"
                  onClick={() => void handleBulkCancelSessions()}
                  disabled={bulkAction !== null || selectedCancelSessions.length === 0}
                  className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {bulkAction === "cancel" ? "Đang huỷ..." : `Huỷ (${formatNumber(selectedCancelSessions.length)})`}
                </button>
              ) : null}
              {canDeleteStocktake ? (
                <button
                  type="button"
                  onClick={() => void handleBulkDeleteSessions()}
                  disabled={bulkAction !== null || selectedDeleteSessions.length === 0}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-extrabold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {bulkAction === "delete" ? "Đang xoá..." : `Xoá (${formatNumber(selectedDeleteSessions.length)})`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearSelectedSessions}
                disabled={bulkAction !== null}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-extrabold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-auto">
          <table className="min-w-[1500px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-12 px-4 py-3 font-bold">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300"
                    checked={allVisibleSelected}
                    disabled={!visibleSessions.length || bulkAction !== null}
                    onChange={toggleSelectVisibleSessions}
                    aria-label="Chọn tất cả phiên đang hiển thị"
                  />
                </th>
                <th className="px-4 py-3 font-bold">Phiên</th>
                <th className="px-4 py-3 font-bold">Chi nhánh</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Người tạo</th>
                <th className="px-4 py-3 font-bold">Nhân viên / máy scan</th>
                <th className="px-4 py-3 font-bold">Bắt đầu</th>
                <th className="px-4 py-3 font-bold">Kết thúc / xác nhận</th>
                <th className="px-4 py-3 font-bold">Chốt tồn</th>
                <th className="px-4 py-3 font-bold">Snapshot</th>
                <th className="px-4 py-3 font-bold">KPI kiểm kho</th>
                <th className="px-4 py-3 font-bold">Máy / lượt scan</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-neutral-500">
                    Đang tải lịch sử...
                  </td>
                </tr>
              ) : visibleSessions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-neutral-500">
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
                  const sessionDisplayCode = getSessionDisplayCode(item, branchMap.get(item.branchId));

                  return (
                    <tr key={item.id} className={`border-t border-neutral-100 align-top hover:bg-neutral-50/70 ${selectedSessionIdSet.has(item.id) ? "bg-purple-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300"
                          checked={selectedSessionIdSet.has(item.id)}
                          onChange={() => toggleSelectSession(item.id)}
                          aria-label={`Chọn phiên ${item.name || item.id}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/stocktake-sessions/${item.id}`} prefetch={false} target="_blank" rel="noopener noreferrer" className="font-bold text-neutral-950 hover:underline">
                          {item.name || sessionDisplayCode}
                        </Link>
                        <p className="mt-1 font-mono text-xs font-bold text-neutral-500">{sessionDisplayCode}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-neutral-300">ID: {item.id}</p>
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
                        <Badge tone={snapshotCleanupTone(item)}>{snapshotCleanupLabel(item)}</Badge>
                        {item.snapshotPurgedAt ? (
                          <p className="mt-1 text-xs text-neutral-500">{formatDateTime(item.snapshotPurgedAt)}</p>
                        ) : isApplied(item) ? (
                          <p className="mt-1 text-xs text-amber-600">Có thể tích chọn để dọn</p>
                        ) : (
                          <p className="mt-1 text-xs text-neutral-400">Dọn sau khi chốt tồn</p>
                        )}
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
                              onClick={() => void downloadStocktakeSessionExcel(item.id, `kiem-kho-${sessionDisplayCode}.xlsx`)}
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

      {confirmDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/35 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-[28px] border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
                  confirmDialog.tone === "red"
                    ? "bg-red-50 text-red-700"
                    : confirmDialog.tone === "black"
                      ? "bg-neutral-950 text-white"
                      : "bg-purple-50 text-purple-700"
                }`}
              >
                !
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-extrabold text-neutral-950">{confirmDialog.title}</h3>
                <div className="mt-2 text-sm font-medium leading-6 text-neutral-600">{confirmDialog.description}</div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={() => void confirmDialog.onConfirm()}
                disabled={Boolean(applyingSessionId)}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirmDialog.tone === "red"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmDialog.tone === "black"
                      ? "bg-neutral-950 hover:bg-neutral-800"
                      : "bg-purple-700 hover:bg-purple-800"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
