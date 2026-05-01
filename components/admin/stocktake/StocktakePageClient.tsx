"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import { applyStocktake } from "@/lib/stocktake-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple" | "black";
type StocktakeStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PAUSED"
  | "FINISHED"
  | "APPLIED"
  | "CANCELLED"
  | string;

type StocktakeRowStatus = "MATCH" | "MISMATCH" | "NOT_FOUND";

type RealtimeSession = {
  id: string;
  branchId: string;
  name: string;
  note?: string | null;
  status: StocktakeStatus;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
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
  status?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  displayDevice?: string;
  count?: number;
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
  workerId?: string | null;
  sku: string;
  counted: number;
  countedQty?: number;
  snapshotQty?: number;
  system?: number;
  diff?: number;
  movementDuringStocktake?: number;
  finalQty?: number;
  status: string;
  events: number;
  eventCount?: number;
  zone?: string | null;
  locationCode?: string | null;
  lastScannedAt?: string | null;
};

type ReviewRow = {
  sku: string;
  counted: number;
  system: number;
  totalSystem: number;
  diff: number;
  movementDuringStocktake: number;
  finalQty: number;
  status: StocktakeRowStatus;
  variant: any;
  reason: string;
  note: string;
  events: number;
  workerId?: string | null;
  zone?: string | null;
  lastScannedAt?: string | null;
};

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

const STOCKTAKE_STORAGE_SESSION_ID = "the1970_stocktake_session_id";
const STOCKTAKE_STORAGE_WORKER_ID = "the1970_stocktake_worker_id";
const STOCKTAKE_STORAGE_BRANCH_ID = "the1970_stocktake_branch_id";

function saveStocktakeResumeState(input: {
  sessionId?: string | null;
  workerId?: string | null;
  branchId?: string | null;
}) {
  if (typeof window === "undefined") return;

  if (input.sessionId) {
    localStorage.setItem(STOCKTAKE_STORAGE_SESSION_ID, input.sessionId);
  }

  if (input.workerId) {
    localStorage.setItem(STOCKTAKE_STORAGE_WORKER_ID, input.workerId);
  }

  if (input.branchId) {
    localStorage.setItem(STOCKTAKE_STORAGE_BRANCH_ID, input.branchId);
  }
}

function clearStocktakeResumeState() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STOCKTAKE_STORAGE_SESSION_ID);
  localStorage.removeItem(STOCKTAKE_STORAGE_WORKER_ID);
  localStorage.removeItem(STOCKTAKE_STORAGE_BRANCH_ID);
}


function formatTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

function diffText(value: number) {
  if (value > 0) return `+${value}`;
  return String(value || 0);
}

function isClosedStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();
  return ["FINISHED", "APPLIED", "CANCELLED"].includes(s);
}

function isPausedStatus(status?: string | null) {
  return String(status || "").toUpperCase() === "PAUSED";
}

function isRunningStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();
  return Boolean(s && !["FINISHED", "APPLIED", "CANCELLED"].includes(s));
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
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
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className={`w-full ${maxWidth} rounded-3xl bg-white p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight text-neutral-950">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IconBox({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: Exclude<Tone, "gray" | "black">;
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${styles[tone]}`}>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
  tone = "blue",
  icon,
}: {
  title: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  tone?: Exclude<Tone, "gray" | "black">;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-r border-neutral-200 px-6 py-5 last:border-r-0">
      <IconBox tone={tone}>{icon}</IconBox>
      <div>
        <p className="text-sm font-medium text-neutral-500">{title}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-950">{value}</p>
        {helper ? <p className="mt-1 text-xs font-medium text-neutral-500">{helper}</p> : null}
      </div>
    </div>
  );
}

function MiniProgressCircle({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div className="relative h-28 w-28">
      <div
        className="h-28 w-28 rounded-full"
        style={{
          background: `conic-gradient(#111827 ${safe * 3.6}deg, #edf2f7 0deg)`,
        }}
      />
      <div className="absolute inset-3 flex items-center justify-center rounded-full bg-white">
        <span className="text-2xl font-extrabold text-neutral-950">{safe}%</span>
      </div>
    </div>
  );
}

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

  const [scannerName, setScannerName] = useState("Admin");
  const [scanZone, setScanZone] = useState("Khu chính");
  const [deviceName, setDeviceName] = useState("Máy scan 1");

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [workerDraftName, setWorkerDraftName] = useState("Admin");
  const [workerDraftZone, setWorkerDraftZone] = useState("Khu chính");
  const [workerDraftDevice, setWorkerDraftDevice] = useState("Máy scan 1");

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState("");
  const [joinWorkerName, setJoinWorkerName] = useState("Admin");
  const [joinWorkerZone, setJoinWorkerZone] = useState("Khu chính");
  const [joinDeviceName, setJoinDeviceName] = useState("Máy scan 1");

  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [worker, setWorker] = useState<RealtimeWorker | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [workerSummary, setWorkerSummary] = useState<SummaryItem[]>([]);
  const [stableWorkerSummary, setStableWorkerSummary] = useState<SummaryItem[]>([]);
  const [summaryMode, setSummaryMode] = useState<"SESSION" | "WORKER">("SESSION");

  const [scanCode, setScanCode] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastScannedSku, setLastScannedSku] = useState("");
  const [rowFilter, setRowFilter] = useState<"ALL" | "MISMATCH" | "MATCH" | "NOT_FOUND">("ALL");
  const [rowQuery, setRowQuery] = useState("");
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [scannerBufferTimer, setScannerBufferTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);

  const scanInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setRole(currentUser.role as AppRole);
    setCurrentBranchId(currentUser.branchId || null);

    if (currentUser.name) {
      setScannerName(currentUser.name);
      setWorkerDraftName(currentUser.name);
      setJoinWorkerName(currentUser.name);
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
          return data[0]?.id || "QO";
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
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu sản phẩm.");
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

  const selectedBranchName = useMemo(() => {
    return branches.find((item) => item.id === branchId)?.name || branchId || "—";
  }, [branches, branchId]);

  const allVariants = useMemo(
    () =>
      products.flatMap((product: any) =>
        (product.variants || []).map((variant: any) => ({
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
      allVariants.find((v: any) => String(v.barcode || "").toLowerCase() === q) ||
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

  const workerList = useMemo(() => {
    return (session?.workers || []).map((item, index) => ({
      ...item,
      displayDevice: item.deviceName || `Máy ${index + 1}`,
      count: workerStats.find(([name]) => name === item.name)?.[1] || 0,
    }));
  }, [session?.workers, workerStats]);

  const buildWorkerSummaryFromEvents = (selectedWorkerId?: string | null) => {
    if (!selectedWorkerId) return [];

    const filteredEvents = (session?.scanEvents || []).filter(
      (event) => event.workerId === selectedWorkerId
    );

    const grouped = new Map<string, SummaryItem>();

    filteredEvents.forEach((event) => {
      const key = event.variantId || event.sku;
      const current = grouped.get(key) || {
        variantId: event.variantId,
        workerId: event.workerId,
        sku: event.sku,
        counted: 0,
        status: event.status,
        events: 0,
        zone: event.zone,
        locationCode: event.locationCode,
        lastScannedAt: event.createdAt,
      };

      current.counted += event.qtyDelta;
      current.events += 1;
      current.lastScannedAt = event.createdAt;

      if (event.status !== "OK") current.status = event.status;

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).filter((row) => Number(row.counted || 0) > 0);
  };

  const zoneStats = useMemo(() => {
    const map = new Map<string, number>();

    latestEvents.forEach((event) => {
      const zone = event.zone || "Chưa chọn khu";
      map.set(zone, (map.get(zone) || 0) + event.qtyDelta);
    });

    return Array.from(map.entries());
  }, [latestEvents]);

  const fallbackWorkerSummary = useMemo(
    () => buildWorkerSummaryFromEvents(worker?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.scanEvents, worker?.id]
  );

  const activeSummary =
    summaryMode === "WORKER" && worker
      ? workerSummary.length > 0
        ? workerSummary
        : stableWorkerSummary.length > 0
          ? stableWorkerSummary
          : fallbackWorkerSummary
      : summary;

  const commitWorkerSummary = (rows: SummaryItem[]) => {
    const safeRows = Array.isArray(rows)
      ? rows.filter((row) => Number(row.counted ?? row.countedQty ?? 0) > 0)
      : [];

    if (safeRows.length > 0) {
      setWorkerSummary(safeRows);
      setStableWorkerSummary(safeRows);
    }
  };

  const rows = useMemo<ReviewRow[]>(() => {
    return activeSummary.map((item) => {
      const variant =
        allVariants.find((v: any) => v.id === item.variantId) ||
        allVariants.find((v: any) => v.sku === item.sku) ||
        null;

      const snapshotQty = Number(
        item.snapshotQty ?? item.system ?? getVariantBranchStock(variant, branchId)
      );
      const totalSystem = getVariantTotalStock(variant);
      const counted = Number(item.counted ?? item.countedQty ?? 0);
      const movementDuringStocktake = Number(item.movementDuringStocktake || 0);
      const diff =
        typeof item.diff === "number" ? Number(item.diff) : counted - snapshotQty;
      const finalQty =
        typeof item.finalQty === "number"
          ? Number(item.finalQty)
          : snapshotQty + diff + movementDuringStocktake;

      const status: StocktakeRowStatus = !variant
        ? "NOT_FOUND"
        : diff === 0
          ? "MATCH"
          : "MISMATCH";

      return {
        sku: variant?.sku || item.sku,
        counted,
        system: snapshotQty,
        totalSystem,
        diff,
        movementDuringStocktake,
        finalQty,
        status,
        variant,
        reason: status === "MATCH" ? "" : "Khác",
        note: "",
        events: Number(item.events ?? item.eventCount ?? 0),
        workerId: item.workerId,
        zone: item.zone,
        lastScannedAt: item.lastScannedAt,
      };
    });
  }, [activeSummary, allVariants, branchId]);

  const visibleRows = useMemo(() => {
    const q = rowQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (rowFilter !== "ALL" && row.status !== rowFilter) return false;
      if (!q) return true;

      return `${row.sku} ${row.variant?.productName || ""} ${row.variant?.color || ""} ${row.variant?.size || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, rowFilter, rowQuery]);

  const matchedCount = rows.filter((row) => row.status === "MATCH").length;
  const mismatchCount = rows.filter((row) => row.status === "MISMATCH").length;
  const notFoundCount = rows.filter((row) => row.status === "NOT_FOUND").length;
  const totalCounted = rows.reduce((sum, row) => sum + row.counted, 0);
  const totalDiff = rows.reduce((sum, row) => sum + row.diff, 0);
  const totalSystem = rows.reduce((sum, row) => sum + row.system, 0);
  const movementDuring = rows.reduce((sum, row) => sum + row.movementDuringStocktake, 0);
  const projectedFinal = rows.reduce((sum, row) => sum + row.finalQty, 0);
  const snapshotSkuCount = rows.filter(
    (row) => row.system !== null && row.system !== undefined
  ).length;

  const snapshotReady = Boolean(session?.id && snapshotSkuCount > 0);

  const branchScopedVariantCount = useMemo(() => {
    const countedSkuSet = new Set(rows.map((row) => row.sku));
    return allVariants.filter((variant: any) => {
      const branchStock = getVariantBranchStock(variant, branchId);
      return branchStock > 0 || countedSkuSet.has(String(variant.sku || ""));
    }).length;
  }, [allVariants, branchId, rows]);

  const progressPercent = branchScopedVariantCount
    ? Math.round((rows.length / branchScopedVariantCount) * 100)
    : 0;

  const runningSession = Boolean(session && isRunningStatus(session.status));
  const paused = isPausedStatus(session?.status);
  const closed = isClosedStatus(session?.status);
  const canCreateNewSession = !session || closed;
  const canCreateWorker = Boolean(session?.id && !closed);
  const canEditSessionMeta = !session || closed;
  const refreshWorkerSummary = async (sessionId?: string, workerId?: string) => {
    const id = sessionId || session?.id;
    const selectedWorkerId = workerId || worker?.id;

    if (!id || !selectedWorkerId) {
      setWorkerSummary([]);
      return;
    }

    try {
      const data = await apiRequest<SummaryItem[]>(
        `/stocktake-sessions/${id}/workers/${selectedWorkerId}/summary`
      );

      if (Array.isArray(data) && data.length > 0) {
        commitWorkerSummary(data);
      }
    } catch {
      const fallback = buildWorkerSummaryFromEvents(selectedWorkerId);
      if (fallback.length > 0) commitWorkerSummary(fallback);
    }
  };

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
      if (Array.isArray(summaryData) && summaryData.length > 0) {
        setSummary(summaryData);
      }
      setLastUpdatedAt(new Date().toISOString());

      const currentWorkerId = worker?.id;
      if (currentWorkerId) {
        try {
          const workerData = await apiRequest<SummaryItem[]>(
            `/stocktake-sessions/${id}/workers/${currentWorkerId}/summary`
          );

          if (Array.isArray(workerData) && workerData.length > 0) {
            commitWorkerSummary(workerData);
          } else {
            const grouped = new Map<string, SummaryItem>();
            (sessionData.scanEvents || [])
              .filter((event) => event.workerId === currentWorkerId)
              .forEach((event) => {
                const key = event.variantId || event.sku;
                const current = grouped.get(key) || {
                  variantId: event.variantId,
                  workerId: event.workerId,
                  sku: event.sku,
                  counted: 0,
                  status: event.status,
                  events: 0,
                  zone: event.zone,
                  locationCode: event.locationCode,
                  lastScannedAt: event.createdAt,
                };

                current.counted += event.qtyDelta;
                current.events += 1;
                current.lastScannedAt = event.createdAt;

                if (event.status !== "OK") current.status = event.status;

                grouped.set(key, current);
              });

            const fallbackRows = Array.from(grouped.values()).filter((row) => Number(row.counted || 0) > 0);
            if (fallbackRows.length > 0) commitWorkerSummary(fallbackRows);
          }
        } catch {
          const fallbackRows = buildWorkerSummaryFromEvents(currentWorkerId);
          if (fallbackRows.length > 0) commitWorkerSummary(fallbackRows);
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không refresh được session.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (resumeChecked || typeof window === "undefined") return;

    const savedSessionId = localStorage.getItem(STOCKTAKE_STORAGE_SESSION_ID);
    const savedWorkerId = localStorage.getItem(STOCKTAKE_STORAGE_WORKER_ID);
    const savedBranchId = localStorage.getItem(STOCKTAKE_STORAGE_BRANCH_ID);

    const restore = async () => {
      setResumeChecked(true);

      try {
        setMessage("Đang khôi phục phiên kiểm kho đang mở...");

        let restoreSessionId = savedSessionId;

        if (!restoreSessionId) {
          try {
            const active = await apiRequest<RealtimeSession | null>(
              `/stocktake-sessions/active/current${savedBranchId ? `?branchId=${savedBranchId}` : ""}`
            );

            if (active?.id) {
              restoreSessionId = active.id;
            }
          } catch {
            restoreSessionId = null;
          }
        }

        if (!restoreSessionId) {
          setMessage("");
          return;
        }

        const sessionData = await apiRequest<RealtimeSession>(
          `/stocktake-sessions/${restoreSessionId}`
        );
        if (isClosedStatus(sessionData.status)) {
          clearStocktakeResumeState();
          setSession(null);
          setWorker(null);
          setSummary([]);
          setWorkerSummary([]);
          setStableWorkerSummary([]);
          setMessage("");
          return;
        }

        setSession(sessionData);
        setBranchId(savedBranchId || sessionData.branchId || branchId);

        const savedWorker =
          sessionData.workers?.find((item) => item.id === savedWorkerId) ||
          sessionData.workers?.[0] ||
          null;

        if (savedWorker) {
          setWorker(savedWorker);
          setScannerName(savedWorker.name || scannerName);
          setScanZone(savedWorker.zone || scanZone);
          setDeviceName(savedWorker.deviceName || deviceName);
          setSummaryMode("WORKER");
          saveStocktakeResumeState({
            sessionId: restoreSessionId,
            workerId: savedWorker.id,
            branchId: savedBranchId || sessionData.branchId,
          });
        }

        await refreshSession(restoreSessionId);

        if (savedWorker?.id) {
          await refreshWorkerSummary(restoreSessionId, savedWorker.id);
        }

        setMessage("Đã khôi phục phiên kiểm kho. Có thể tiếp tục scan.");
        window.setTimeout(() => scanInputRef.current?.focus(), 120);
      } catch (err) {
        clearStocktakeResumeState();
        setMessage(
          err instanceof Error
            ? `Không khôi phục được phiên cũ: ${err.message}`
            : "Không khôi phục được phiên cũ."
        );
      }
    };

    void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeChecked]);


  useEffect(() => {
    if (!session?.id) return;

    const timer = window.setInterval(() => {
      void refreshSession(session.id);
    }, 3000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, worker?.id]);

  const createRealtimeSession = async () => {
    if (!branchId) {
      setMessage("Chưa chọn chi nhánh.");
      return;
    }

    try {
      setMessage("");

      // ❌ clear session cũ (rất quan trọng)
      clearStocktakeResumeState();
      setSession(null);
      setWorker(null);
      setSummary([]);
      setWorkerSummary([]);
      setStableWorkerSummary([]);

      // ✅ tạo session mới
      const created = await apiRequest<RealtimeSession>("/stocktake-sessions", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          name: sessionName || "Kiểm kho realtime",
          note: sessionNote,
        }),
      });

      // ✅ join worker
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

      // ✅ start session
      await apiRequest(`/stocktake-sessions/${created.id}/start`, {
        method: "PATCH",
      });

      // ✅ set state
      setSession(created);
      setWorker(joined);
      setSummary([]);
      setWorkerSummary([]);
      setStableWorkerSummary([]);
      setSummaryMode("WORKER");

      // 🔥 QUAN TRỌNG NHẤT: lưu session mới để không restore nhầm session cũ
      saveStocktakeResumeState({
        sessionId: created.id,
        workerId: joined.id,
        branchId,
      });

      setMessage(`Đã tạo phiên tổng và phiên con cho máy này: ${joined.name}.`);

      await refreshSession(created.id);
      await refreshWorkerSummary(created.id, joined.id);

      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được phiên.");
    }
  };

  const openJoinModal = () => {
    setJoinSessionId("");
    setJoinWorkerName(scannerName || "Nhân viên");
    setJoinWorkerZone(scanZone || "Khu chính");
    setJoinDeviceName(deviceName || "Máy scan 1");
    setJoinModalOpen(true);
  };

  const joinExistingSession = async () => {
    const id = joinSessionId.trim();

    if (!id) {
      setMessage("Chưa nhập sessionId phiên tổng.");
      return;
    }

    try {
      setMessage("");

      const joined = await apiRequest<RealtimeWorker>(
        `/stocktake-sessions/${id}/join`,
        {
          method: "POST",
          body: JSON.stringify({
            name: joinWorkerName || scannerName || "Nhân viên",
            zone: joinWorkerZone || scanZone || "Khu chính",
            deviceName: joinDeviceName || deviceName || "Máy scan",
          }),
        }
      );

      setWorker(joined);
      setScannerName(joined.name || joinWorkerName);
      setScanZone(joined.zone || joinWorkerZone);
      setDeviceName(joined.deviceName || joinDeviceName);
      setJoinModalOpen(false);
      setJoinSessionId("");
      setSummaryMode("WORKER");
      saveStocktakeResumeState({
        sessionId: id,
        workerId: joined.id,
        branchId,
      });

      await refreshSession(id);
      await refreshWorkerSummary(id, joined.id);

      setMessage(
        `Đã tham gia phiên tổng và tự tạo phiên con: ${joined.name} · ${joined.zone || joinWorkerZone} · ${joined.deviceName || joinDeviceName}.`
      );

      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không join được phiên.");
    }
  };

  const createWorkerSession = async () => {
    if (!session?.id) {
      setMessage("Chưa có phiên tổng. Tạo phiên realtime trước rồi mới tạo phiên con.");
      return;
    }

    try {
      const joined = await apiRequest<RealtimeWorker>(
        `/stocktake-sessions/${session.id}/join`,
        {
          method: "POST",
          body: JSON.stringify({
            name: workerDraftName || "Nhân viên",
            zone: workerDraftZone || "Khu chính",
            deviceName: workerDraftDevice || "Máy scan",
          }),
        }
      );

      setWorker(joined);
      setScannerName(joined.name);
      setScanZone(joined.zone || workerDraftZone);
      setDeviceName(joined.deviceName || workerDraftDevice);
      setWorkerModalOpen(false);
      setSummaryMode("WORKER");
      saveStocktakeResumeState({
        sessionId: session.id,
        workerId: joined.id,
        branchId,
      });
      await refreshSession(session.id);
      await refreshWorkerSummary(session.id, joined.id);
      setMessage(`Đã tạo phiên con: ${joined.name} · ${joined.zone || workerDraftZone} · ${joined.deviceName || workerDraftDevice}.`);
      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được phiên con.");
    }
  };

  const handleScanCode = async (codeInput?: string, qtyDelta = 1) => {
    const code = String(codeInput || scanCode).trim();
    if (!code) return;

    if (!session?.id) {
      setMessage("Chưa có phiên realtime. Hãy tạo phiên hoặc join phiên trước.");
      return;
    }

    if (paused) {
      setMessage("Phiên đang tạm dừng. Bấm tiếp tục để scan.");
      return;
    }

    if (!worker?.id) {
      setMessage("Chưa chọn phiên con. Tạo hoặc chọn phiên con trước khi scan.");
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
          workerId: worker.id,
          branchId,
          code: finalCode,
          zone: worker.zone || scanZone,
          qtyDelta,
        }),
      });

      if (scannerBufferTimer) clearTimeout(scannerBufferTimer);

      const scannedSku = result?.variant?.sku || finalCode;

      saveStocktakeResumeState({
        sessionId: session.id,
        workerId: worker.id,
        branchId,
      });

      setLastScannedSku(scannedSku);
      setScanCode("");
      setShowSuggestions(false);
      setMessage(`${qtyDelta > 0 ? "Đã scan" : "Đã trừ"} ${scannedSku}`);

      const buildOptimisticRows = (prev: SummaryItem[]) => {
        const found = prev.find((row) => row.sku === scannedSku);
        if (found) {
          return prev.map((row) =>
            row.sku === scannedSku
              ? { ...row, counted: Number(row.counted || 0) + qtyDelta, events: Number(row.events || 0) + 1 }
              : row
          );
        }

        return [
          ...prev,
          {
            variantId: result?.variant?.id,
            workerId: worker.id,
            sku: scannedSku,
            counted: qtyDelta,
            status: result?.variant ? "OK" : "NOT_FOUND",
            events: 1,
            zone: worker.zone || scanZone,
            lastScannedAt: new Date().toISOString(),
          },
        ];
      };

      setWorkerSummary((prev) => buildOptimisticRows(prev));
      setStableWorkerSummary((prev) => buildOptimisticRows(prev));

      await refreshSession(session.id);
      await refreshWorkerSummary(session.id, worker.id);
      window.setTimeout(() => scanInputRef.current?.focus(), 80);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Scan lỗi.");
    } finally {
      setScanning(false);
    }
  };

  const handleScannerInputChange = (value: string) => {
    setScanCode(value);
    setShowSuggestions(true);

    if (scannerBufferTimer) {
      clearTimeout(scannerBufferTimer);
    }

    const nextValue = value.trim();

    if (!nextValue || !session || paused || closed) return;

    const timer = setTimeout(() => {
      const finalValue = nextValue.trim();
      if (finalValue.length >= 3) {
        void handleScanCode(finalValue, 1);
      }
    }, 260);

    setScannerBufferTimer(timer);
  };

  const handlePickSuggestion = async (variant: any) => {
    await handleScanCode(String(variant?.sku || ""), 1);
  };

  const adjustRowCount = async (sku: string, delta: 1 | -1) => {
    await handleScanCode(sku, delta);
  };

  const pauseSession = async () => {
    if (!session?.id) return;

    await apiRequest(`/stocktake-sessions/${session.id}/pause`, {
      method: "PATCH",
    });

    await refreshSession(session.id);
    setMessage("Đã tạm dừng phiên kiểm kho.");
  };

  const resumeSession = async () => {
    if (!session?.id) return;

    await apiRequest(`/stocktake-sessions/${session.id}/resume`, {
      method: "PATCH",
    });

    await refreshSession(session.id);
    setMessage("Đã tiếp tục phiên kiểm kho.");
    window.setTimeout(() => scanInputRef.current?.focus(), 100);
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

    const ok = window.confirm(
      "Chốt phiên kiểm kho? Hệ thống sẽ cập nhật tồn kho theo số đã kiểm."
    );
    if (!ok) return;

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
    setWorkerSummary([]);
    setStableWorkerSummary([]);
    setSummaryMode("SESSION");
    setScanCode("");
    setShowSuggestions(false);
    setLastScannedSku("");
    clearStocktakeResumeState();
    setMessage("Đã reset UI local. Backend session không bị xóa.");
  };

  const setActiveWorker = async (item: RealtimeWorker) => {
    setWorker(item);
    setScannerName(item.name || scannerName);
    setScanZone(item.zone || scanZone);
    setDeviceName(item.deviceName || deviceName);
    setSummaryMode("WORKER");

    if (session?.id && item.id) {
      saveStocktakeResumeState({
        sessionId: session.id,
        workerId: item.id,
        branchId,
      });
    }

    if (session?.id && item.id) {
      await refreshWorkerSummary(session.id, item.id);
    }

    window.setTimeout(() => scanInputRef.current?.focus(), 80);
  };

  return (
    <div className="min-h-screen space-y-4 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-neutral-950">
            Kiểm kho realtime
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Command Center kiểm kho · phiên tổng + phiên con · máy tít tự cộng số lượng.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className={`inline-flex h-2 w-2 rounded-full ${paused ? "bg-amber-500" : "bg-green-500"}`} />
          Realtime: {paused ? "Đang tạm dừng" : "Đang kết nối"}
        </div>
      </div>

      <Panel className={`p-4 ${paused ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${paused ? "bg-amber-100" : "bg-emerald-100"}`}>
              {paused ? "⏸" : "⚡"}
            </div>
            <div>
              <p className={`text-base font-extrabold uppercase tracking-wide ${paused ? "text-amber-700" : "text-emerald-700"}`}>
                {paused
                  ? "Phiên kiểm đang tạm dừng"
                  : runningSession
                    ? "Hệ thống đang kiểm kho realtime"
                    : "Sẵn sàng tạo phiên kiểm kho realtime"}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-700">
                Bán hàng vẫn hoạt động bình thường. Scan lưu DB liên tục; tắt máy không mất phiên.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => scanInputRef.current?.focus()}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            Focus máy tít
          </button>
        </div>
      </Panel>

      {error ? (
        <Panel className="border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="p-4">
          <p className="text-sm font-medium text-neutral-700">{message}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-600">Phiên kiểm kho hiện tại</p>
                <Badge tone={paused ? "amber" : runningSession ? "green" : "gray"}>
                  {paused ? "Tạm dừng" : runningSession ? "Đang diễn ra" : session?.status || "Chưa bắt đầu"}
                </Badge>
                {worker ? <Badge tone="black">Máy này: phiên con</Badge> : null}
                {session?.id ? (
                  <Badge tone={snapshotReady ? "green" : "amber"}>
                    {snapshotReady
                      ? `Snapshot OK · ${snapshotSkuCount || rows.length} SKU`
                      : "Snapshot chưa thấy"}
                  </Badge>
                ) : null}
              </div>

              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-950">
                {session?.name || "Chưa có phiên tổng"}
              </h3>

              {session?.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs font-mono text-neutral-500">{session.id}</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(session.id)}
                    className="rounded-full border border-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50"
                  >
                    Copy session ID
                  </button>
                  <span className="text-[11px] font-semibold text-neutral-400">
                    Tắt tab mở lại sẽ tự khôi phục phiên này
                  </span>
                </div>
              ) : null}

              <div className="mt-7 grid gap-5 md:grid-cols-5">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Chi nhánh</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">{selectedBranchName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Khu đang scan</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">{worker?.zone || scanZone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Bắt đầu</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {formatDateTime(session?.startedAt || session?.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Máy này</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">{worker?.deviceName || deviceName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">Người kiểm</p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">{worker?.name || scannerName || "—"}</p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-3">
              <MiniProgressCircle percent={progressPercent} />
              <div className="text-center">
                <p className="text-xs font-medium text-neutral-500">Tiến độ {summaryMode === "WORKER" ? "phiên con" : "toàn phiên"}</p>
                <p className="mt-1 text-lg font-extrabold text-neutral-950">
                  {rows.length} / {branchScopedVariantCount || 0} SKU
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createRealtimeSession}
              disabled={!canCreateNewSession}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${!canCreateNewSession
                ? "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
                : "border border-neutral-900 bg-neutral-950 text-white hover:bg-neutral-800"
                }`}
            >
              Tạo phiên tổng
            </button>

            <button
              type="button"
              onClick={() => setWorkerModalOpen(true)}
              disabled={!canCreateWorker}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Tạo phiên con
            </button>

            <button
              type="button"
              onClick={openJoinModal}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Join phiên tổng
            </button>

            <button
              type="button"
              onClick={() => void refreshSession()}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {refreshing ? "Đang refresh..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={resetLocal}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Reset UI
            </button>

            <button
              type="button"
              onClick={() => void pauseSession()}
              disabled={!session?.id || paused || closed}
              className="ml-auto rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⏸ Tạm dừng
            </button>

            <button
              type="button"
              onClick={() => void resumeSession()}
              disabled={!session?.id || !paused || closed}
              className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ▶ Tiếp tục
            </button>

            <button
              type="button"
              onClick={() => void finishSession()}
              disabled={!rows.length || applying || !canApplyStocktake || paused}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {applying ? "Đang chốt..." : "✓ Chốt kiểm kho"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            <label className="text-xs font-semibold text-neutral-500">
              Tên phiên
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                disabled={!canEditSessionMeta}
              />
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Chi nhánh
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
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
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Người kiểm
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
                value={scannerName}
                onChange={(e) => setScannerName(e.target.value)}
                disabled={Boolean(worker)}
              />
            </label>

            <label className="text-xs font-semibold text-neutral-500">
              Khu mặc định
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
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
            </label>
          </div>

          <input
            className="mt-3 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder="Ghi chú phiên, ví dụ: kiểm cuối ngày, chia 5 người theo khu"
            disabled={!canEditSessionMeta}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={session ? "green" : "amber"}>
              {session ? `Session: ${session.id}` : "Chưa có session"}
            </Badge>
            <Badge tone={worker ? "black" : "amber"}>
              {worker ? `Máy này: ${worker.name}` : "Chưa join worker"}
            </Badge>
            <Badge tone={paused ? "amber" : "blue"}>{session?.status || "DRAFT"}</Badge>
            <Badge tone="gray">{session?.workers?.length || 0} phiên con</Badge>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-base font-bold text-neutral-950">
              Phiên con đang kiểm ({workerList.length || (worker ? 1 : 0)})
            </p>
            <Badge tone={worker ? "black" : "gray"}>
              {worker ? "Máy này đã chọn phiên con" : "Chưa chọn"}
            </Badge>
          </div>

          <div className="space-y-3">
            {workerList.length === 0 && !worker ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                Chưa có phiên con. Bấm “+ Tạo phiên con” để gán nhân viên, máy scan và khu kiểm.
              </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto pb-2">
              {(workerList.length > 0 ? workerList : worker ? [worker] : []).map((item: any) => {
                const active = worker?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void setActiveWorker(item)}
                    className={`min-w-[220px] rounded-2xl border p-4 text-left transition ${active
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold">{item.name}</p>
                        <p className={`mt-1 text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                          {item.displayDevice || item.deviceName || deviceName}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${active
                          ? "bg-white/15 text-white"
                          : "bg-green-50 text-green-700"
                          }`}
                      >
                        {active ? "Máy này" : "Online"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className={`text-xs font-semibold ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                        Khu kiểm
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {item.zone || "Chưa gán khu"}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className={`rounded-xl p-3 ${active ? "bg-white/10" : "bg-neutral-50"}`}>
                        <p className={`text-[11px] font-semibold ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                          Lượt scan
                        </p>
                        <p className="mt-1 text-lg font-extrabold">
                          {item.count || 0}
                        </p>
                      </div>

                      <div className={`rounded-xl p-3 ${active ? "bg-white/10" : "bg-neutral-50"}`}>
                        <p className={`text-[11px] font-semibold ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                          Trạng thái
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {item.isActive === false ? "Tạm dừng" : "Đang kiểm"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-neutral-700">Tổng lượt scan</p>
            <p className="text-lg font-extrabold text-blue-600">
              {session?._count?.scanEvents || latestEvents.length || totalCounted}
            </p>
          </div>
        </Panel>
      </div>

      <Panel className="grid overflow-hidden md:grid-cols-5">
        <StatCard
          title="SKU đã kiểm"
          value={rows.length}
          helper={`trên tổng ${branchScopedVariantCount || 0} SKU của kho này`}
          tone="blue"
          icon="▣"
        />
        <StatCard
          title="Tổng lượt scan"
          value={totalCounted}
          helper={summaryMode === "WORKER" ? "phiên con đang chọn" : "toàn phiên"}
          tone="green"
          icon="✓"
        />
        <StatCard
          title="Lệch"
          value={mismatchCount}
          helper={`${rows.length ? Math.round((mismatchCount / rows.length) * 100) : 0}% SKU đã kiểm`}
          tone="amber"
          icon="≠"
        />
        <StatCard
          title="Không tìm thấy"
          value={notFoundCount}
          helper="mã lạ hoặc sai SKU"
          tone="red"
          icon="!"
        />
        <StatCard
          title="Giao dịch trong lúc kiểm"
          value={movementDuring}
          helper="bán / nhập / chuyển"
          tone="purple"
          icon="↻"
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[0.55fr_1.05fr_0.45fr]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-bold text-neutral-950">Quét mã / tìm sản phẩm</p>
            <Badge tone={worker ? "black" : "amber"}>
              {worker ? `${worker.name} · ${worker.zone || "Chưa gán khu"}` : "Chưa chọn phiên con"}
            </Badge>
          </div>

          <div className="relative mt-4">
            <input
              ref={scanInputRef}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base font-semibold outline-none ring-blue-100 transition focus:border-blue-500 focus:ring-4 disabled:bg-neutral-50"
              value={scanCode}
              onChange={(e) => handleScannerInputChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (scannerBufferTimer) clearTimeout(scannerBufferTimer);
                  void handleScanCode(scanCode, 1);
                }

                if (e.key === "Escape") {
                  if (scannerBufferTimer) clearTimeout(scannerBufferTimer);
                  setShowSuggestions(false);
                }
              }}
              placeholder={
                paused
                  ? "Phiên đang tạm dừng"
                  : worker
                    ? "Quét mã barcode hoặc nhập SKU"
                    : "Chọn / tạo phiên con trước khi scan"
              }
              autoFocus
              disabled={!session || !worker || scanning || paused || closed}
            />

            {showSuggestions && scanCode.trim() && suggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[56px] z-50 max-h-80 overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
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
                      <p className="text-sm font-semibold text-neutral-900">
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
              <div className="absolute left-0 right-0 top-[56px] z-50 rounded-2xl border border-red-100 bg-white p-4 text-sm text-red-600 shadow-xl">
                Không tìm thấy sản phẩm phù hợp.
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Máy tít: quét mã sẽ tự +1. Nếu máy tít có suffix Enter thì lưu ngay; nếu không có Enter, hệ thống tự lưu sau khoảng 0.3 giây.
          </p>

          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold text-neutral-700">Scan gần đây</p>
            <div className="space-y-2">
              {latestEvents.length === 0 ? (
                <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p>
              ) : (
                latestEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{event.sku}</p>
                      <p className="text-xs text-neutral-500">{formatTime(event.createdAt)}</p>
                    </div>
                    <p className={event.qtyDelta >= 0 ? "text-sm font-bold text-green-700" : "text-sm font-bold text-red-700"}>
                      {event.qtyDelta > 0 ? `+${event.qtyDelta}` : event.qtyDelta}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-4">
            <div>
              <p className="text-base font-bold text-neutral-950">Kết quả kiểm kho realtime</p>
              <p className="mt-1 text-xs text-neutral-500">
                {summaryMode === "WORKER" && worker
                  ? `Đang xem phiên con: ${worker.name} · ${worker.zone || "Chưa gán khu"}`
                  : "Đang xem toàn phiên"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSummaryMode("SESSION")}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${summaryMode === "SESSION"
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
              >
                Toàn phiên
              </button>
              <button
                type="button"
                onClick={() => {
                  setSummaryMode("WORKER");
                  void refreshWorkerSummary();
                }}
                disabled={!worker}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${summaryMode === "WORKER"
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
              >
                Phiên con của máy này
              </button>

              {(["ALL", "MISMATCH", "MATCH", "NOT_FOUND"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRowFilter(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${rowFilter === item
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                >
                  {item === "ALL"
                    ? "Tất cả"
                    : item === "MISMATCH"
                      ? `Lệch (${mismatchCount})`
                      : item === "MATCH"
                        ? `Khớp (${matchedCount})`
                        : `Không tìm thấy (${notFoundCount})`}
                </button>
              ))}

              <input
                value={rowQuery}
                onChange={(e) => setRowQuery(e.target.value)}
                placeholder="Tìm SKU, tên sản phẩm..."
                className="w-56 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto">
            {loading ? (
              <div className="p-5 text-sm text-neutral-500">Đang tải dữ liệu...</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold">SKU</th>
                    <th className="px-4 py-3 font-bold">Sản phẩm</th>
                    <th className="px-4 py-3 font-bold">Snapshot</th>
                    <th className="px-4 py-3 font-bold">Counted</th>
                    <th className="px-4 py-3 font-bold">Giao dịch</th>
                    <th className="px-4 py-3 font-bold">Final</th>
                    <th className="px-4 py-3 font-bold">Chênh lệch</th>
                    <th className="px-4 py-3 font-bold">Trạng thái</th>
                    <th className="px-4 py-3 font-bold">Sửa nhanh</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-neutral-500">
                        Chưa có dòng kiểm kho.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, index) => (
                      <tr
                        key={`${row.workerId || "all"}-${row.sku}`}
                        className={`border-t border-neutral-200 align-top transition ${row.sku === lastScannedSku
                          ? "bg-green-100 ring-2 ring-green-300"
                          : row.status === "MISMATCH"
                            ? "bg-amber-50/40"
                            : row.status === "NOT_FOUND"
                              ? "bg-red-50/40"
                              : ""
                          }`}
                      >
                        <td className="px-4 py-3 text-neutral-500">{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-neutral-950">{row.sku}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-neutral-900">
                            {row.variant?.productName || "Không tìm thấy variant"}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {row.variant?.color || "—"} / {row.variant?.size || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-semibold">{row.system}</td>
                        <td className="px-4 py-3 font-semibold">{row.counted}</td>
                        <td className="px-4 py-3 font-semibold">{diffText(row.movementDuringStocktake)}</td>
                        <td className="px-4 py-3 font-extrabold text-neutral-950">{row.finalQty}</td>
                        <td
                          className={`px-4 py-3 font-extrabold ${row.diff === 0
                            ? "text-neutral-500"
                            : row.diff > 0
                              ? "text-green-700"
                              : "text-red-700"
                            }`}
                        >
                          {diffText(row.diff)}
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
                            {row.status === "MATCH"
                              ? "KHỚP"
                              : row.status === "MISMATCH"
                                ? "LỆCH"
                                : "KHÔNG THẤY"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => void adjustRowCount(row.sku, -1)}
                              className="rounded-xl border border-neutral-300 px-2.5 py-1.5 text-xs hover:bg-neutral-50"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => void adjustRowCount(row.sku, 1)}
                              className="rounded-xl border border-neutral-300 px-2.5 py-1.5 text-xs hover:bg-neutral-50"
                            >
                              +1
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="border-red-100 bg-red-50/70 p-4">
            <p className="text-sm font-extrabold text-red-700">△ Cảnh báo</p>
            <div className="mt-3 space-y-3 text-sm font-medium text-neutral-700">
              <p>△ {movementDuring} giao dịch phát sinh trong lúc kiểm</p>
              <p>△ {notFoundCount} SKU không tìm thấy</p>
              <p>△ {mismatchCount} SKU lệch tồn</p>
            </div>
          </Panel>

          <Panel className="border-green-100 bg-green-50/80 p-4">
            <p className="text-sm font-extrabold text-green-800">Tóm tắt dự kiến khi chốt</p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">Snapshot đầu phiên</span>
                <span className={`font-extrabold ${snapshotReady ? "text-green-700" : "text-amber-700"}`}>
                  {snapshotReady ? `${totalSystem} / ${snapshotSkuCount || rows.length} SKU` : "Chưa thấy"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">Counted</span>
                <span className="font-extrabold text-neutral-950">{totalCounted}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">Chênh lệch kiểm kho</span>
                <span className={`font-extrabold ${totalDiff === 0 ? "text-neutral-950" : totalDiff > 0 ? "text-green-700" : "text-red-700"}`}>
                  {diffText(totalDiff)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">Giao dịch trong lúc kiểm</span>
                <span className="font-extrabold text-neutral-950">{diffText(movementDuring)}</span>
              </div>
              <div className="border-t border-green-200 pt-3">
                <div className="flex justify-between gap-3">
                  <span className="font-extrabold text-neutral-800">Tồn kho dự kiến</span>
                  <span className="text-2xl font-extrabold text-green-700">{projectedFinal}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-neutral-500">Số liệu chỉ cập nhật vào inventory thật khi bấm chốt.</p>
          </Panel>

          <Panel className="p-4">
            <p className="text-sm font-bold text-neutral-900">Tiến độ theo khu kiểm</p>
            <div className="mt-3 space-y-2">
              {zoneStats.length === 0 ? (
                <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p>
              ) : (
                zoneStats.slice(0, 6).map(([zone, count]) => (
                  <div
                    key={zone}
                    className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                  >
                    <span>{zone}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Modal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Tham gia phiên tổng"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Máy này sẽ nhập sessionId của phiên tổng, sau đó hệ thống tự tạo một phiên con cho máy này.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Mỗi máy tính / điện thoại nên dùng một máy tít riêng. Scan sẽ gắn vào đúng workerId của phiên con này.
            </p>
          </div>

          <label className="block text-sm font-semibold text-neutral-700">
            Session ID phiên tổng
            <input
              value={joinSessionId}
              onChange={(e) => setJoinSessionId(e.target.value)}
              placeholder="Dán sessionId phiên tổng"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-500"
              autoFocus
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold text-neutral-700">
              Nhân viên / người kiểm
              <input
                value={joinWorkerName}
                onChange={(e) => setJoinWorkerName(e.target.value)}
                placeholder="Ví dụ: Hằng"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
              />
            </label>

            <label className="block text-sm font-semibold text-neutral-700">
              Máy scan
              <input
                value={joinDeviceName}
                onChange={(e) => setJoinDeviceName(e.target.value)}
                placeholder="Ví dụ: Máy scan 2"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-neutral-700">
            Khu kiểm của phiên con này
            <select
              value={joinWorkerZone}
              onChange={(e) => setJoinWorkerZone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
            >
              <option value="Khu chính">Khu chính</option>
              <option value="Kệ áo">Kệ áo</option>
              <option value="Kệ quần">Kệ quần</option>
              <option value="Kho sau">Kho sau</option>
              <option value="Khu sale">Khu sale</option>
              <option value="Quầy thu ngân">Quầy thu ngân</option>
              <option value="Khác">Khác</option>
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setJoinModalOpen(false)}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void joinExistingSession()}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
            >
              Tham gia & tạo phiên con
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={workerModalOpen}
        onClose={() => setWorkerModalOpen(false)}
        title="Tạo phiên con kiểm kho"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">
              Mỗi máy đọc mã vạch / mỗi nhân viên nên có một phiên con riêng.
            </p>
            <p className="mt-1 text-xs text-blue-700">
              Ví dụ: Admin kiểm Khu chính, Hùng kiểm Kệ áo, Lan kiểm Kho sau. Tất cả cùng thuộc một phiên tổng.
            </p>
          </div>

          <label className="block text-sm font-semibold text-neutral-700">
            Nhân viên kiểm
            <input
              value={workerDraftName}
              onChange={(e) => setWorkerDraftName(e.target.value)}
              placeholder="Ví dụ: Hùng"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="block text-sm font-semibold text-neutral-700">
            Khu kiểm
            <select
              value={workerDraftZone}
              onChange={(e) => setWorkerDraftZone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
            >
              <option value="Khu chính">Khu chính</option>
              <option value="Kệ áo">Kệ áo</option>
              <option value="Kệ quần">Kệ quần</option>
              <option value="Kho sau">Kho sau</option>
              <option value="Khu sale">Khu sale</option>
              <option value="Quầy thu ngân">Quầy thu ngân</option>
              <option value="Khác">Khác</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-neutral-700">
            Thiết bị / máy scan
            <input
              value={workerDraftDevice}
              onChange={(e) => setWorkerDraftDevice(e.target.value)}
              placeholder="Ví dụ: Máy scan 2"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setWorkerModalOpen(false)}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => void createWorkerSession()}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
            >
              Tạo phiên con
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <span>Realtime:</span>
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-amber-500" : "bg-green-500"}`} />
          <span>{paused ? "Tạm dừng" : "Đang kết nối"}</span>
        </div>
        <p>Dữ liệu tự động cập nhật mỗi 3 giây</p>
        <p>Last update: {formatTime(lastUpdatedAt)}</p>
      </div>
    </div>
  );
}
