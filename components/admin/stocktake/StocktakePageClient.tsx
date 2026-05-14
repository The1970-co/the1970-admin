"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
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

type StocktakeExcelImportRow = {
  rowNumber: number;
  sku: string;
  productName?: string;
  unit?: string;
  batchCode?: string;
  countedQty: number;
  systemQty?: number | null;
  diffQty?: number | null;
  reason?: string;
  note?: string;
};

type StocktakeExcelParseResult = {
  rows: StocktakeExcelImportRow[];
  headerRowNumber: number;
  sheetName: string;
  totalDataRows: number;
  skippedRows: number;
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
    } catch {}

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


function normalizeExcelHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeExcelText(value: unknown) {
  return String(value ?? "").trim();
}

function parseExcelNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const withoutSpaces = raw.replace(/\s/g, "");
  let normalized = withoutSpaces;

  if (withoutSpaces.includes(",") && withoutSpaces.includes(".")) {
    normalized = withoutSpaces.replace(/\./g, "").replace(",", ".");
  } else if (withoutSpaces.includes(",")) {
    const parts = withoutSpaces.split(",");
    normalized = parts.length === 2 && parts[1].length === 3
      ? withoutSpaces.replace(/,/g, "")
      : withoutSpaces.replace(",", ".");
  } else if (withoutSpaces.includes(".")) {
    const parts = withoutSpaces.split(".");
    normalized = parts.length > 2 || parts[parts.length - 1]?.length === 3
      ? withoutSpaces.replace(/\./g, "")
      : withoutSpaces;
  }

  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function findExcelColumnIndex(headerRow: unknown[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeExcelHeader);

  return headerRow.findIndex((cell) => {
    const normalized = normalizeExcelHeader(cell);
    if (!normalized) return false;
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias));
  });
}

function hasStocktakeHeaderSignal(row: unknown[]) {
  const headers = row.map(normalizeExcelHeader).filter(Boolean);
  const hasSku = headers.some((h) => h.includes("masku") || h === "sku" || h.includes("masanpham"));
  const hasName = headers.some((h) => h.includes("tensanpham") || h.includes("sanpham"));
  const hasCounted = headers.some((h) => h.includes("tonthucte") || h.includes("thucte") || h.includes("soluongthucte") || h.includes("demduoc"));

  return (hasSku && hasCounted) || (hasName && hasCounted) || (hasSku && hasName);
}

function findStocktakeHeaderRowIndex(rawRows: unknown[][]) {
  const preferred = rawRows[9];
  if (preferred && hasStocktakeHeaderSignal(preferred)) return 9;

  const limit = Math.min(rawRows.length, 60);
  for (let index = 0; index < limit; index += 1) {
    if (hasStocktakeHeaderSignal(rawRows[index] || [])) return index;
  }

  return -1;
}

async function parseStocktakeExcelFile(file: File): Promise<StocktakeExcelParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("Không đọc được sheet đầu tiên trong file Excel.");
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  const headerRowIndex = findStocktakeHeaderRowIndex(rawRows);
  if (headerRowIndex < 0) {
    throw new Error("Không tìm thấy header kiểm kho. File cần có cột Mã SKU và Tồn thực tế, hoặc header bắt đầu ở dòng 10.");
  }

  const headerRow = rawRows[headerRowIndex] || [];
  const skuIndex = findExcelColumnIndex(headerRow, ["Mã SKU", "SKU", "Mã sản phẩm", "Barcode", "Mã vạch"]);
  const productNameIndex = findExcelColumnIndex(headerRow, ["Tên sản phẩm", "Sản phẩm", "Tên hàng", "Tên SKU"]);
  const unitIndex = findExcelColumnIndex(headerRow, ["Đơn vị tính", "ĐVT", "Unit"]);
  const batchIndex = findExcelColumnIndex(headerRow, ["Mã lô", "Lô", "Batch"]);
  const countedIndex = findExcelColumnIndex(headerRow, ["Tồn thực tế", "Thực tế", "SL thực tế", "Số lượng thực tế", "Đếm được", "Số lượng kiểm"]);
  const systemIndex = findExcelColumnIndex(headerRow, ["Tồn chi nhánh", "Tồn hệ thống", "Tồn kho", "Tồn hiện tại"]);
  const diffIndex = findExcelColumnIndex(headerRow, ["Lệch", "Chênh lệch", "Sai lệch"]);
  const reasonIndex = findExcelColumnIndex(headerRow, ["Lý do", "Nguyên nhân"]);
  const noteIndex = findExcelColumnIndex(headerRow, ["Ghi chú", "Note"]);

  if (skuIndex < 0) {
    throw new Error("Không tìm thấy cột Mã SKU trong file kiểm kho.");
  }

  if (countedIndex < 0) {
    throw new Error("Không tìm thấy cột Tồn thực tế trong file kiểm kho.");
  }

  const rows: StocktakeExcelImportRow[] = [];
  let totalDataRows = 0;
  let skippedRows = 0;

  rawRows.slice(headerRowIndex + 1).forEach((row, rowOffset) => {
    const rowNumber = headerRowIndex + rowOffset + 2;
    const sku = normalizeExcelText(row?.[skuIndex]);
    const productName = productNameIndex >= 0 ? normalizeExcelText(row?.[productNameIndex]) : "";
    const countedRaw = row?.[countedIndex];
    const countedQty = parseExcelNumber(countedRaw);

    const hasAnyValue = Array.isArray(row) && row.some((cell) => normalizeExcelText(cell));
    if (!hasAnyValue) return;

    totalDataRows += 1;

    if (!sku) {
      skippedRows += 1;
      return;
    }

    if (!Number.isFinite(countedQty) || countedQty < 0) {
      skippedRows += 1;
      return;
    }

    rows.push({
      rowNumber,
      sku,
      productName,
      unit: unitIndex >= 0 ? normalizeExcelText(row?.[unitIndex]) : "",
      batchCode: batchIndex >= 0 ? normalizeExcelText(row?.[batchIndex]) : "",
      countedQty: Math.max(0, Math.floor(countedQty)),
      systemQty: systemIndex >= 0 ? parseExcelNumber(row?.[systemIndex]) : null,
      diffQty: diffIndex >= 0 ? parseExcelNumber(row?.[diffIndex]) : null,
      reason: reasonIndex >= 0 ? normalizeExcelText(row?.[reasonIndex]) : "",
      note: noteIndex >= 0 ? normalizeExcelText(row?.[noteIndex]) : "",
    });
  });

  return {
    rows,
    headerRowNumber: headerRowIndex + 1,
    sheetName,
    totalDataRows,
    skippedRows,
  };
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

function stocktakeStatusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "Nháp";
  if (s === "IN_PROGRESS") return "Đang kiểm";
  if (s === "PAUSED") return "Tạm dừng";
  if (s === "FINISHED") return "Đã kết thúc";
  if (s === "APPLIED") return "Đã chốt tồn";
  if (s === "CANCELLED") return "Đã hủy";
  return s || "—";
}

function statusTone(status?: string | null): Tone {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPLIED") return "green";
  if (normalized === "FINISHED") return "blue";
  if (normalized === "IN_PROGRESS") return "green";
  if (normalized === "PAUSED" || normalized === "DRAFT") return "amber";
  if (normalized === "CANCELLED") return "red";
  return "gray";
}

function workerStatusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "FINISHED") return "Đã xong";
  if (s === "PAUSED") return "Tạm dừng";
  if (s === "IN_PROGRESS" || s === "ACTIVE") return "Đang kiểm";
  return status || "Đang kiểm";
}

function workerScanCount(worker?: RealtimeWorker | null, session?: RealtimeSession | null) {
  if (!worker) return 0;
  if (typeof worker.count === "number") return worker.count;
  const events = Array.isArray(session?.scanEvents) ? session!.scanEvents! : [];
  return events
    .filter((event) => event.workerId === worker.id && event.status === "OK")
    .reduce((sum, event) => sum + Number(event.qtyDelta || 0), 0);
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
      className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
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
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
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
          <h3 className="text-xl font-bold tracking-tight text-neutral-950">
            {title}
          </h3>
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
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${styles[tone]}`}
    >
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
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-950">
          {value}
        </p>
        {helper ? (
          <p className="mt-1 text-xs font-medium text-neutral-500">{helper}</p>
        ) : null}
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
        <span className="text-2xl font-extrabold text-neutral-950">
          {safe}%
        </span>
      </div>
    </div>
  );
}

export default function StocktakePageClient() {
  const canSeeAllStocktakeSessions = true;
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<AppRole>("admin");
  const [currentUser, setCurrentUser] = useState<any>(null);
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
  const [joinableSessions, setJoinableSessions] = useState<RealtimeSession[]>(
    [],
  );
  const [loadingJoinableSessions, setLoadingJoinableSessions] = useState(false);
  const [joinableSessionsError, setJoinableSessionsError] = useState("");

  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [worker, setWorker] = useState<RealtimeWorker | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [workerSummary, setWorkerSummary] = useState<SummaryItem[]>([]);
  const [stableWorkerSummary, setStableWorkerSummary] = useState<SummaryItem[]>(
    [],
  );
  const [summaryMode, setSummaryMode] = useState<"SESSION" | "WORKER">(
    "SESSION",
  );

  const [scanCode, setScanCode] = useState("");
  const [scanQty, setScanQty] = useState("1");
  const [stocktakeExcelFile, setStocktakeExcelFile] = useState<File | null>(null);
  const [stocktakeExcelRows, setStocktakeExcelRows] = useState<StocktakeExcelImportRow[]>([]);
  const [stocktakeExcelHeaderRow, setStocktakeExcelHeaderRow] = useState<number | null>(null);
  const [stocktakeExcelSheetName, setStocktakeExcelSheetName] = useState("");
  const [stocktakeExcelSkippedRows, setStocktakeExcelSkippedRows] = useState(0);
  const [stocktakeExcelTotalRows, setStocktakeExcelTotalRows] = useState(0);
  const [stocktakeExcelImporting, setStocktakeExcelImporting] = useState(false);
  const [stocktakeExcelProgress, setStocktakeExcelProgress] = useState({ done: 0, total: 0 });
  const [quickQtyBySku, setQuickQtyBySku] = useState<Record<string, string>>(
    {},
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastScannedSku, setLastScannedSku] = useState("");
  const [rowFilter, setRowFilter] = useState<
    "ALL" | "MISMATCH" | "MATCH" | "NOT_FOUND"
  >("ALL");
  const [rowQuery, setRowQuery] = useState("");
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [scannerBufferTimer, setScannerBufferTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [showAllOpenSessions, setShowAllOpenSessions] = useState(false);
  const [cleanupSessionsOpen, setCleanupSessionsOpen] = useState(false);
  const [sessionActionLoadingId, setSessionActionLoadingId] = useState("");
  const [optimisticQueue, setOptimisticQueue] = useState<Record<string, number>>({});
  const [finishingOnly, setFinishingOnly] = useState(false);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanAtRef = useRef(0);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setCurrentUser(currentUser);
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

  function collectPermissionKeys(user: any) {
    const keys = new Set<string>();

    if (Array.isArray(user?.permissions)) {
      user.permissions.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray(user?.permissionKeys)) {
      user.permissionKeys.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray(user?.branchPermissions)) {
      user.branchPermissions.forEach((row: any) => {
        if (Array.isArray(row?.permissionKeys)) {
          row.permissionKeys.forEach((key: any) => {
            if (key) keys.add(String(key));
          });
        }
      });
    }

    return keys;
  }

  function hasStocktakePermission(permission: string) {
    if (isOwner) return true;
    const keys = collectPermissionKeys(currentUser);
    return keys.has("*") || keys.has(permission);
  }

  const canCreateStocktake = hasStocktakePermission("stocktake.create");
  const canEditStocktake = hasStocktakePermission("stocktake.edit");
  const canScanStocktake =
    hasStocktakePermission("stocktake.scan") ||
    hasStocktakePermission("stocktake.edit") ||
    hasStocktakePermission("stocktake.create");
  const canApplyStocktake = hasStocktakePermission("stocktake.apply");
  const canExportStocktake = hasStocktakePermission("stocktake.excel.export");

  const excelImportHref = session?.id
    ? `/stocktake/excel-import?sessionId=${session.id}${worker?.id ? `&workerId=${worker.id}` : ""}`
    : "/stocktake/excel-import";

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
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được dữ liệu sản phẩm.",
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

  const selectedBranchName = useMemo(() => {
    return (
      branches.find((item) => item.id === branchId)?.name || branchId || "—"
    );
  }, [branches, branchId]);

  const branchMap = useMemo(() => {
    return new Map(branches.map((branch) => [branch.id, branch.name]));
  }, [branches]);

  const allVariants = useMemo(
    () =>
      products.flatMap((product: any) =>
        (product.variants || []).map((variant: any) => ({
          ...variant,
          productName: product.name,
        })),
      ),
    [products],
  );

  const getVariantBranchStock = (variant: any, selectedBranchId: string) => {
    return Number(variant?.branchStocks?.[selectedBranchId] || 0);
  };

  const getVariantTotalStock = (variant: any) => {
    if (!variant?.branchStocks) return 0;

    return Object.values(variant.branchStocks).reduce<number>(
      (sum, value) => sum + Number(value || 0),
      0,
    );
  };

  const findVariantByCode = (code: string) => {
    const q = code.trim().toLowerCase();
    if (!q) return null;

    return (
      allVariants.find((v: any) => String(v.sku || "").toLowerCase() === q) ||
      allVariants.find(
        (v: any) => String(v.barcode || "").toLowerCase() === q,
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
      (event) => event.workerId === selectedWorkerId,
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

    return Array.from(grouped.values()).filter(
      (row) => Number(row.counted || 0) > 0,
    );
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
    [session?.scanEvents, worker?.id],
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
        item.snapshotQty ??
          item.system ??
          getVariantBranchStock(variant, branchId),
      );
      const totalSystem = getVariantTotalStock(variant);
      const counted = Number(item.counted ?? item.countedQty ?? 0);
      const movementDuringStocktake = Number(item.movementDuringStocktake || 0);
      const diff =
        typeof item.diff === "number"
          ? Number(item.diff)
          : counted - snapshotQty;
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

    return rows
      .filter((row) => {
        if (rowFilter !== "ALL" && row.status !== rowFilter) return false;
        if (!q) return true;

        return `${row.sku} ${row.variant?.productName || ""} ${row.variant?.color || ""} ${row.variant?.size || ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (a.sku === lastScannedSku) return -1;
        if (b.sku === lastScannedSku) return 1;

        const aTime = a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0;
        const bTime = b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0;

        if (aTime !== bTime) return bTime - aTime;
        return String(a.sku || "").localeCompare(String(b.sku || ""));
      });
  }, [rows, rowFilter, rowQuery, lastScannedSku]);

  const matchedCount = rows.filter((row) => row.status === "MATCH").length;
  const mismatchCount = rows.filter((row) => row.status === "MISMATCH").length;
  const notFoundCount = rows.filter((row) => row.status === "NOT_FOUND").length;
  const totalCounted = rows.reduce((sum, row) => sum + row.counted, 0);
  const totalDiff = rows.reduce((sum, row) => sum + row.diff, 0);
  const totalSystem = rows.reduce((sum, row) => sum + row.system, 0);
  const movementDuring = rows.reduce(
    (sum, row) => sum + row.movementDuringStocktake,
    0,
  );
  const projectedFinal = rows.reduce((sum, row) => sum + row.finalQty, 0);
  const snapshotSkuCount = rows.filter(
    (row) => row.system !== null && row.system !== undefined,
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
  const canCreateNewSession = canCreateStocktake && (!session || closed);
  const canCreateWorker = canCreateStocktake && Boolean(session?.id && !closed);
  const canJoinWorker = canCreateStocktake && !closed;
  const canEditSessionMeta = canCreateStocktake && (!session || closed);
  const refreshWorkerSummary = async (
    sessionId?: string,
    workerId?: string,
  ) => {
    const id = sessionId || session?.id;
    const selectedWorkerId = workerId || worker?.id;

    if (!id || !selectedWorkerId) {
      setWorkerSummary([]);
      return;
    }

    try {
      const data = await apiRequest<SummaryItem[]>(
        `/stocktake-sessions/${id}/workers/${selectedWorkerId}/summary`,
      );

      if (Array.isArray(data) && data.length > 0) {
        commitWorkerSummary(data);
      }
    } catch {
      const fallback = buildWorkerSummaryFromEvents(selectedWorkerId);
      if (fallback.length > 0) commitWorkerSummary(fallback);
    }
  };

  const refreshSession = async (sessionId?: string, options?: { silent?: boolean }) => {
    const id = sessionId || session?.id;
    if (!id) return;

    try {
      if (!options?.silent) setRefreshing(true);
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
            `/stocktake-sessions/${id}/workers/${currentWorkerId}/summary`,
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

            const fallbackRows = Array.from(grouped.values()).filter(
              (row) => Number(row.counted || 0) > 0,
            );
            if (fallbackRows.length > 0) commitWorkerSummary(fallbackRows);
          }
        } catch {
          const fallbackRows = buildWorkerSummaryFromEvents(currentWorkerId);
          if (fallbackRows.length > 0) commitWorkerSummary(fallbackRows);
        }
      }
    } catch (err) {
      if (!options?.silent) setMessage(
        err instanceof Error ? err.message : "Không refresh được session.",
      );
    } finally {
      if (!options?.silent) setRefreshing(false);
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
              `/stocktake-sessions/active/current${savedBranchId ? `?branchId=${savedBranchId}` : ""}`,
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
          `/stocktake-sessions/${restoreSessionId}`,
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
      } catch (err) {
        clearStocktakeResumeState();
        setMessage(
          err instanceof Error
            ? `Không khôi phục được phiên cũ: ${err.message}`
            : "Không khôi phục được phiên cũ.",
        );
      }
    };

    void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeChecked]);

  useEffect(() => {
    if (!session?.id) return;

    const timer = window.setInterval(() => {
      // Không refresh đè ngay sau khi máy tít vừa scan, tránh dòng vừa hiện bị nháy mất.
      if (Date.now() - lastScanAtRef.current < 2500) return;
      void refreshSession(session.id, { silent: true });
    }, 6000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, worker?.id]);

  const createRealtimeSession = async () => {
    if (!canCreateStocktake) {
      setMessage("Bạn không có quyền tạo phiên kiểm kho.");
      return;
    }

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
        },
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

  const loadJoinableSessions = async (targetBranchId?: string) => {
    // Admin/Owner cần xem toàn bộ phiên tổng đang mở. Dùng __ALL__ để không bị fallback về branchId hiện tại.
    const finalBranchId = targetBranchId === "__ALL__" ? "" : targetBranchId || branchId || currentBranchId || "";

    try {
      setLoadingJoinableSessions(true);
      setJoinableSessionsError("");

      const query = finalBranchId
        ? `?branchId=${encodeURIComponent(finalBranchId)}`
        : "";
      const data = await apiRequest<RealtimeSession[]>(
        `/stocktake-sessions${query}`,
      );

      const activeRows = (Array.isArray(data) ? data : []).filter((item) =>
        ["IN_PROGRESS", "PAUSED"].includes(
          String(item.status || "").toUpperCase(),
        ),
      );

      setJoinableSessions(activeRows);
    } catch (err) {
      setJoinableSessions([]);
      setJoinableSessionsError(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách phiên tổng đang mở.",
      );
    } finally {
      setLoadingJoinableSessions(false);
    }
  };

  const openJoinModal = () => {
    if (!canJoinWorker) {
      setMessage("Bạn không có quyền join/tạo phiên con kiểm kho.");
      return;
    }

    setJoinSessionId("");
    setJoinWorkerName(scannerName || "Nhân viên");
    setJoinWorkerZone(scanZone || "Khu chính");
    setJoinDeviceName(deviceName || "Máy scan 1");
    setJoinModalOpen(true);
    void loadJoinableSessions(isOwner ? "__ALL__" : (branchId || currentBranchId || undefined));
  };

  const joinExistingSession = async () => {
    if (!canJoinWorker) {
      setMessage("Bạn không có quyền join/tạo phiên con kiểm kho.");
      return;
    }

    const id = joinSessionId.trim();

    if (!id) {
      setMessage("Chưa nhập sessionId phiên tổng.");
      return;
    }

    try {
      setMessage("");

      const selectedSession =
        joinableSessions.find((item) => item.id === id) ||
        (await apiRequest<RealtimeSession>(`/stocktake-sessions/${id}`));

      const joined = await apiRequest<RealtimeWorker>(
        `/stocktake-sessions/${id}/join`,
        {
          method: "POST",
          body: JSON.stringify({
            name: joinWorkerName || scannerName || "Nhân viên",
            zone: joinWorkerZone || scanZone || "Khu chính",
            deviceName: joinDeviceName || deviceName || "Máy scan",
          }),
        },
      );

      const finalBranchId = selectedSession?.branchId || branchId;
      if (finalBranchId) setBranchId(finalBranchId);

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
        branchId: finalBranchId || branchId,
      });

      await refreshSession(id);
      await refreshWorkerSummary(id, joined.id);

      setMessage(
        `Đã tham gia phiên tổng và tự tạo phiên con: ${joined.name} · ${joined.zone || joinWorkerZone} · ${joined.deviceName || joinDeviceName}.`,
      );

      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không join được phiên.");
    }
  };


  const quickJoinMasterSession = async (targetSession: RealtimeSession) => {
    if (!canJoinWorker) {
      setMessage("Bạn không có quyền tham gia phiên kiểm kho.");
      return;
    }

    if (!targetSession?.id) return;

    try {
      setMessage("");
      const fullSession = await apiRequest<RealtimeSession>(
        `/stocktake-sessions/${targetSession.id}`,
      );

      const existingWorker =
        fullSession.workers?.find((item: any) => {
          const sameUser = item.userId && currentUser?.id && item.userId === currentUser.id;
          const sameName =
            item.name &&
            scannerName &&
            String(item.name).trim().toLowerCase() === String(scannerName).trim().toLowerCase();
          const sameDevice =
            item.deviceName &&
            deviceName &&
            String(item.deviceName).trim().toLowerCase() === String(deviceName).trim().toLowerCase();
          return sameUser || (sameName && sameDevice);
        }) || null;

      const joined =
        existingWorker ||
        (await apiRequest<RealtimeWorker>(
          `/stocktake-sessions/${targetSession.id}/join`,
          {
            method: "POST",
            body: JSON.stringify({
              name: scannerName || currentUser?.name || "Nhân viên",
              zone: scanZone || "Khu chính",
              deviceName: deviceName || "Máy scan",
            }),
          },
        ));

      setSession(fullSession);
      setWorker(joined);
      setBranchId(fullSession.branchId || branchId);
      setScannerName(joined.name || scannerName);
      setScanZone(joined.zone || scanZone);
      setDeviceName(joined.deviceName || deviceName);
      setSummaryMode("WORKER");

      saveStocktakeResumeState({
        sessionId: fullSession.id,
        workerId: joined.id,
        branchId: fullSession.branchId || branchId,
      });

      await refreshSession(fullSession.id);
      await refreshWorkerSummary(fullSession.id, joined.id);
      await loadJoinableSessions(fullSession.branchId || branchId || currentBranchId || undefined);

      setMessage(
        existingWorker
          ? "Đã tiếp tục phiên con hiện tại của máy này."
          : "Đã tham gia phiên tổng và tạo phiên con cho máy này.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tham gia được phiên tổng.");
    }
  };

  const createWorkerSession = async () => {
    if (!canCreateStocktake) {
      setMessage("Bạn không có quyền tạo phiên con kiểm kho.");
      return;
    }

    if (!session?.id) {
      setMessage(
        "Chưa có phiên tổng. Tạo phiên realtime trước rồi mới tạo phiên con.",
      );
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
        },
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
      setMessage(
        `Đã tạo phiên con: ${joined.name} · ${joined.zone || workerDraftZone} · ${joined.deviceName || workerDraftDevice}.`,
      );
      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không tạo được phiên con.",
      );
    }
  };

  const normalizePositiveInt = (value: string, fallback = 1) => {
    const parsed = Math.floor(
      Number(String(value || "").replace(/[^0-9]/g, "")),
    );
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  };

  const getScanQty = () => normalizePositiveInt(scanQty, 1);

  const applyOptimisticScanRow = (variant: any, qtyDelta: number, selectedWorkerId?: string | null) => {
    const scannedSku = String(variant?.sku || "");
    if (!scannedSku) return;

    const now = new Date().toISOString();
    const buildOptimisticRows = (prev: SummaryItem[]) => {
      const found = prev.find((row) => row.sku === scannedSku);
      if (found) {
        return prev.map((row) =>
          row.sku === scannedSku
            ? {
                ...row,
                counted: Math.max(0, Number(row.counted || 0) + qtyDelta),
                events: Number(row.events || 0) + 1,
                lastScannedAt: now,
              }
            : row,
        );
      }

      return [
        ...prev,
        {
          variantId: variant.id,
          workerId: selectedWorkerId || worker?.id || null,
          sku: scannedSku,
          counted: Math.max(0, qtyDelta),
          status: "OK",
          events: 1,
          zone: worker?.zone || scanZone,
          lastScannedAt: now,
        },
      ];
    };

    setWorkerSummary((prev) => buildOptimisticRows(prev));
    setStableWorkerSummary((prev) => buildOptimisticRows(prev));
    setOptimisticQueue((prev) => ({ ...prev, [scannedSku]: Number(prev[scannedSku] || 0) + qtyDelta }));
    setLastScannedSku(scannedSku);
  };

  const handleScanCode = async (codeInput?: string, qtyDelta = 1) => {
    if (!canScanStocktake) {
      setMessage("Bạn không có quyền scan kiểm kho.");
      return;
    }

    const code = String(codeInput || scanCode).trim();
    if (!code) return;

    if (!session?.id) {
      setMessage(
        "Chưa có phiên realtime. Hãy tạo phiên hoặc join phiên trước.",
      );
      return;
    }

    if (paused) {
      setMessage("Phiên đang tạm dừng. Bấm tiếp tục để scan.");
      return;
    }

    if (!worker?.id) {
      setMessage(
        "Chưa chọn phiên con. Tạo hoặc chọn phiên con trước khi scan.",
      );
      return;
    }

    try {
      setScanning(true);

      const variant = findVariantByCode(code);

      if (!variant) {
        if (scannerBufferTimer) clearTimeout(scannerBufferTimer);
        setShowSuggestions(false);
        setMessage(`Không tìm thấy SKU/barcode: ${code}. Dòng này chưa được ghi vào phiên kiểm.`);
        window.setTimeout(() => scanInputRef.current?.focus(), 80);
        return;
      }

      const finalCode = variant.sku;
      lastScanAtRef.current = Date.now();

      // Cập nhật UI ngay khi mã hợp lệ để máy tít phản hồi tức thì; DB ghi nền phía sau.
      applyOptimisticScanRow(variant, qtyDelta, worker.id);
      setScanCode("");
      setShowSuggestions(false);
      setMessage(`${qtyDelta > 0 ? "Đã nhận" : "Đã trừ"} ${finalCode} · đang lưu nền`);
      window.setTimeout(() => scanInputRef.current?.focus(), 20);

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

      setOptimisticQueue((prev) => {
        const next = { ...prev };
        delete next[scannedSku];
        return next;
      });
      setMessage(`${qtyDelta > 0 ? "Đã lưu" : "Đã trừ"} ${scannedSku}`);

      window.setTimeout(() => {
        // Chỉ đồng bộ lại sau khi backend có thời gian ghi xong; nếu scan liên tiếp thì không đè UI lạc quan.
        if (Date.now() - lastScanAtRef.current < 2400) return;
        void refreshSession(session.id, { silent: true });
        void refreshWorkerSummary(session.id, worker.id);
      }, 2500);
      window.setTimeout(() => scanInputRef.current?.focus(), 20);
    } catch (err) {
      setMessage(err instanceof Error ? `${err.message} · dữ liệu sẽ được refresh lại` : "Scan lỗi.");
      if (session?.id) void refreshSession(session.id, { silent: true });
    } finally {
      setScanning(false);
    }
  };

  const handleStocktakeExcelFileChange = async (nextFile?: File | null) => {
    const selectedFile = nextFile || null;
    setStocktakeExcelFile(selectedFile);
    setStocktakeExcelRows([]);
    setStocktakeExcelHeaderRow(null);
    setStocktakeExcelSheetName("");
    setStocktakeExcelSkippedRows(0);
    setStocktakeExcelTotalRows(0);
    setStocktakeExcelProgress({ done: 0, total: 0 });

    if (!selectedFile) return;

    try {
      setMessage("Đang đọc file Excel kiểm kho...");
      const parsed = await parseStocktakeExcelFile(selectedFile);
      setStocktakeExcelRows(parsed.rows);
      setStocktakeExcelHeaderRow(parsed.headerRowNumber);
      setStocktakeExcelSheetName(parsed.sheetName);
      setStocktakeExcelSkippedRows(parsed.skippedRows);
      setStocktakeExcelTotalRows(parsed.totalDataRows);
      setMessage(
        `Đã đọc ${parsed.rows.length}/${parsed.totalDataRows} dòng từ Excel. Header dòng ${parsed.headerRowNumber}.`,
      );
    } catch (err) {
      setStocktakeExcelFile(null);
      setStocktakeExcelRows([]);
      setMessage(err instanceof Error ? err.message : "Không đọc được file Excel kiểm kho.");
    }
  };

  const importStocktakeExcelRows = async () => {
    if (!canScanStocktake) {
      setMessage("Bạn không có quyền upload/ghi số lượng kiểm kho.");
      return;
    }

    if (!session?.id || !worker?.id) {
      setMessage("Cần tạo hoặc join phiên kiểm kho trước khi upload Excel.");
      return;
    }

    if (paused) {
      setMessage("Phiên đang tạm dừng. Bấm tiếp tục rồi upload Excel.");
      return;
    }

    if (closed) {
      setMessage("Phiên đã đóng, không thể upload Excel vào phiên này.");
      return;
    }

    if (!stocktakeExcelRows.length) {
      setMessage("Chưa có dòng Excel hợp lệ để import.");
      return;
    }

    const ok = window.confirm(
      `Ghi ${stocktakeExcelRows.length} dòng từ Excel vào phiên kiểm hiện tại? Hệ thống sẽ set số lượng theo cột Tồn thực tế.`,
    );
    if (!ok) return;

    try {
      setStocktakeExcelImporting(true);
      setScanning(true);
      setMessage("Đang import số lượng từ Excel vào phiên kiểm...");
      setStocktakeExcelProgress({ done: 0, total: stocktakeExcelRows.length });

      const currentCountBySku = new Map<string, number>();
      rows.forEach((row) => currentCountBySku.set(row.sku, Number(row.counted || 0)));

      let imported = 0;
      let skipped = 0;
      let failed = 0;
      const failedSamples: string[] = [];

      for (const excelRow of stocktakeExcelRows) {
        const sku = excelRow.sku.trim();
        const targetQty = Number(excelRow.countedQty || 0);
        const currentQty = currentCountBySku.get(sku) || 0;
        const delta = targetQty - currentQty;

        if (!sku || delta === 0) {
          skipped += 1;
          imported += 1;
          setStocktakeExcelProgress({ done: imported, total: stocktakeExcelRows.length });
          continue;
        }

        try {
          const variant = findVariantByCode(sku);
          const finalCode = variant?.sku || sku;
          const result = await apiRequest<any>("/stocktake-sessions/scan", {
            method: "POST",
            body: JSON.stringify({
              sessionId: session.id,
              workerId: worker.id,
              branchId,
              code: finalCode,
              zone: worker.zone || scanZone,
              qtyDelta: delta,
              note: `Import Excel dòng ${excelRow.rowNumber}${excelRow.note ? ` · ${excelRow.note}` : ""}`,
            }),
          });

          const scannedSku = result?.variant?.sku || finalCode;
          currentCountBySku.set(scannedSku, targetQty);
          setLastScannedSku(scannedSku);
        } catch (err) {
          failed += 1;
          if (failedSamples.length < 5) {
            failedSamples.push(`${sku}: ${err instanceof Error ? err.message : "lỗi import"}`);
          }
        } finally {
          imported += 1;
          setStocktakeExcelProgress({ done: imported, total: stocktakeExcelRows.length });
        }
      }

      saveStocktakeResumeState({
        sessionId: session.id,
        workerId: worker.id,
        branchId,
      });

      await refreshSession(session.id);
      await refreshWorkerSummary(session.id, worker.id);
      setScanCode("");
      setShowSuggestions(false);

      setMessage(
        `Import Excel xong: ${stocktakeExcelRows.length - failed - skipped} dòng đã ghi, ${skipped} dòng không đổi, ${failed} dòng lỗi.${failedSamples.length ? ` Lỗi mẫu: ${failedSamples.join(" | ")}` : ""}`,
      );
      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } finally {
      setScanning(false);
      setStocktakeExcelImporting(false);
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

    // Nếu đang nhập số lượng nhanh khác 1 thì không tự bắn debounce,
    // tránh vừa gõ SKU đã tự +1 trước khi bấm "Ghi SL".
    if (getScanQty() !== 1) return;

    const timer = setTimeout(() => {
      const finalValue = nextValue.trim();
      if (finalValue.length >= 3) {
        void handleScanCode(finalValue, 1);
      }
    }, 260);

    setScannerBufferTimer(timer);
  };

  const handlePickSuggestion = async (variant: any) => {
    await handleScanCode(String(variant?.sku || ""), getScanQty());
  };

  const adjustRowCount = async (sku: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    await handleScanCode(sku, delta);
  };

  const setRowExactCount = async (row: ReviewRow) => {
    const targetQty = normalizePositiveInt(
      quickQtyBySku[row.sku] ?? String(row.counted || 0),
      row.counted || 0,
    );
    const delta = targetQty - Number(row.counted || 0);

    if (delta === 0) {
      setMessage(`SKU ${row.sku} đã đang là ${targetQty}.`);
      return;
    }

    await adjustRowCount(row.sku, delta);
  };

  const removeCountedRow = async (row: ReviewRow) => {
    const currentCount = Number(row.counted || 0);

    if (!currentCount) {
      setMessage(`SKU ${row.sku} chưa có số lượng để xoá.`);
      return;
    }

    if (!row.variant?.id) {
      setWorkerSummary((prev) => prev.filter((item) => item.sku !== row.sku));
      setStableWorkerSummary((prev) => prev.filter((item) => item.sku !== row.sku));
      setSummary((prev) => prev.filter((item) => item.sku !== row.sku));
      setMessage(`Đã xoá dòng mã lạ ${row.sku} khỏi giao diện. Mã lạ mới sẽ không được ghi vào phiên nữa.`);
      return;
    }

    const ok = window.confirm(`Xoá số kiểm của ${row.sku} khỏi phiên này? Hệ thống sẽ trừ lại ${currentCount}.`);
    if (!ok) return;

    await adjustRowCount(row.sku, -currentCount);
    setQuickQtyBySku((prev) => ({ ...prev, [row.sku]: "0" }));
    setMessage(`Đã xoá số kiểm của ${row.sku}.`);
  };

  const pauseSession = async () => {
    if (!canEditStocktake) {
      setMessage("Bạn không có quyền tạm dừng phiên kiểm kho.");
      return;
    }
    if (!session?.id) return;

    try {
      await apiRequest(`/stocktake-sessions/${session.id}/pause`, {
        method: "PATCH",
      });

      await refreshSession(session.id);
      setMessage("Đã tạm dừng phiên kiểm kho.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạm dừng được phiên kiểm.");
    }
  };

  const resumeSession = async () => {
    if (!canEditStocktake) {
      setMessage("Bạn không có quyền tiếp tục phiên kiểm kho.");
      return;
    }
    if (!session?.id) return;

    try {
      await apiRequest(`/stocktake-sessions/${session.id}/resume`, {
        method: "PATCH",
      });

      await refreshSession(session.id);
      setMessage("Đã tiếp tục phiên kiểm kho.");
      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tiếp tục được phiên kiểm.");
    }
  };


  useEffect(() => {
    if (!currentUser) return;
    void loadJoinableSessions(isOwner ? "__ALL__" : (branchId || currentBranchId || undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, branchId, currentBranchId, isOwner]);

  const finishCountingSession = async () => {
    if (!session?.id) {
      setMessage("Chưa có phiên để kết thúc.");
      return;
    }

    if (!rows.length) {
      setMessage("Chưa có dữ liệu kiểm kho để kết thúc phiên.");
      return;
    }

    if (!canEditStocktake) {
      setMessage("Bạn không có quyền kết thúc phiên kiểm kho.");
      return;
    }

    try {
      setFinishingOnly(true);

      if (paused) {
        await apiRequest(`/stocktake-sessions/${session.id}/resume`, {
          method: "PATCH",
        });
      }

      await apiRequest(`/stocktake-sessions/${session.id}/finish`, {
        method: "PATCH",
      });

      await refreshSession(session.id);
      setMessage("Đã kết thúc phiên kiểm. Kiểm tra lại kết quả rồi bấm Chốt tồn kho thật.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không kết thúc được phiên kiểm.");
    } finally {
      setFinishingOnly(false);
    }
  };

  const finishSession = async () => {
    if (!session?.id) {
      setMessage("Chưa có phiên để chốt tồn.");
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

    if (String(session.status || "").toUpperCase() !== "FINISHED") {
      setMessage("Cần bấm Kết thúc phiên kiểm trước, sau đó mới chốt tồn kho thật.");
      return;
    }

    const ok = window.confirm(
      `Chốt tồn kho thật cho phiên này?\n\nSKU đã kiểm: ${rows.length}\nTổng lệch: ${totalDiff > 0 ? `+${totalDiff}` : totalDiff}\n\nSau bước này hệ thống sẽ cập nhật tồn thật.`,
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

      await refreshSession(session.id);

      setMessage(
        `Đã chốt tồn kho thật. Điều chỉnh ${result.adjustedCount} dòng, tổng delta ${
          result.totalDelta > 0 ? `+${result.totalDelta}` : result.totalDelta
        }. Đang mở trang chi tiết phiên kiểm...`,
      );

      window.setTimeout(() => {
        window.location.href = `/stocktake-sessions/${session.id}`;
      }, 500);
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

  const closeOrDeleteSession = async (targetSession: RealtimeSession, mode: "cancel" | "delete") => {
    if (!isOwner) {
      setMessage("Chỉ admin/owner được xử lý phiên kiểm cũ.");
      return;
    }

    const label = mode === "delete" ? "xoá" : "huỷ";
    const ok = window.confirm(`${label === "xoá" ? "Xoá" : "Huỷ"} phiên ${targetSession.name || targetSession.id}?`);
    if (!ok) return;

    try {
      setSessionActionLoadingId(targetSession.id);
      if (mode === "delete") {
        await apiRequest(`/stocktake-sessions/${targetSession.id}`, { method: "DELETE" });
      } else {
        await apiRequest(`/stocktake-sessions/${targetSession.id}/cancel`, { method: "PATCH" });
      }

      setJoinableSessions((prev) =>
        mode === "delete"
          ? prev.filter((item) => item.id !== targetSession.id)
          : prev.map((item) =>
              item.id === targetSession.id ? { ...item, status: "CANCELLED" } : item,
            ),
      );

      if (session?.id === targetSession.id) {
        clearStocktakeResumeState();
        setSession(null);
        setWorker(null);
        setSummary([]);
        setWorkerSummary([]);
        setStableWorkerSummary([]);
      }

      setMessage(
        mode === "delete"
          ? `Đã xoá phiên ${targetSession.name || targetSession.id}.`
          : `Đã huỷ phiên ${targetSession.name || targetSession.id}.`,
      );
      await loadJoinableSessions(branchId || currentBranchId || undefined);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Không ${label} được phiên kiểm.`);
    } finally {
      setSessionActionLoadingId("");
    }
  };

  const recentJoinableSessions = useMemo(() => {
    const activeRows = joinableSessions.filter((item) =>
      ["IN_PROGRESS", "PAUSED"].includes(String(item.status || "").toUpperCase()),
    );

    const branchScopedRows = isOwner
      ? activeRows
      : activeRows.filter((item) => item.branchId === currentBranchId || item.branchId === branchId);

    const sortedRows = [...branchScopedRows].sort((a, b) => {
      const aTime = new Date(a.startedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.startedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return showAllOpenSessions ? sortedRows : sortedRows.slice(0, 3);
  }, [joinableSessions, isOwner, currentBranchId, branchId, showAllOpenSessions]);

  const cleanupCandidateSessions = useMemo(() => {
    return joinableSessions
      .filter((item) => ["DRAFT", "IN_PROGRESS", "PAUSED", "FINISHED"].includes(String(item.status || "").toUpperCase()))
      .sort((a, b) => new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime());
  }, [joinableSessions]);

  const visibleCleanupSessions = useMemo(() => {
    return cleanupCandidateSessions.slice(0, showAllOpenSessions ? 50 : 8);
  }, [cleanupCandidateSessions, showAllOpenSessions]);

  return (
    <div className="min-h-screen space-y-4 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-neutral-950">
            Kiểm kho realtime
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Command Center kiểm kho · phiên tổng + phiên con · máy tít tự cộng
            số lượng.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${paused ? "bg-amber-500" : "bg-green-500"}`}
          />
          Realtime: {paused ? "Đang tạm dừng" : "Đang kết nối"}
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-neutral-900 bg-neutral-950 text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]">
        <div className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-96 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.28),transparent_55%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-2xl shadow-inner">
                {paused ? "⏸" : "⚡"}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-300">
                  Hệ thống kiểm kho realtime
                </p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-tight">
                  {runningSession ? session?.name || "Phiên kiểm đang chạy" : "Command Center kiểm kho"}
                </h3>
                <p className="mt-1 text-sm font-semibold text-neutral-300">
                  Snapshot một lần · máy tít nhận tức thì · lưu DB nền · mã sai không ghi vào phiên.
                </p>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-neutral-200">
                {paused ? "Đang tạm dừng" : runningSession ? "Đang kiểm" : "Sẵn sàng"}
              </span>
              <button
                type="button"
                onClick={() => scanInputRef.current?.focus()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-neutral-950 shadow-sm hover:bg-neutral-100"
              >
                Focus máy tít
              </button>
            </div>
          </div>
        </div>
      </div>

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

      <Panel className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-neutral-950">
              Phiên tổng đang mở
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Chọn phiên tổng của kho rồi bấm tham gia. Admin thấy tất cả, nhân viên chỉ thấy chi nhánh của mình.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setCleanupSessionsOpen((value) => !value)}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                {cleanupSessionsOpen ? "Đóng quản lý" : "Quản lý phiên kiểm"}
              </button>
            ) : null}
            {joinableSessions.length > recentJoinableSessions.length ? (
              <button
                type="button"
                onClick={() => setShowAllOpenSessions((value) => !value)}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                {showAllOpenSessions ? "Thu gọn" : `Xem thêm ${joinableSessions.length - recentJoinableSessions.length}`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={createRealtimeSession}
              disabled={!canCreateNewSession}
              className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              Bắt đầu phiên kiểm
            </button>
          </div>
        </div>

        {cleanupSessionsOpen && isOwner ? (
          <div className="mb-4 overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
              <div>
                <p className="font-extrabold text-neutral-950">Quản lý phiên kiểm chưa chốt</p>
                <p className="text-xs font-semibold text-neutral-500">
                  Admin/Owner dọn các phiên nháp, đang kiểm, tạm dừng hoặc chờ chốt tồn. Phiên đã chốt tồn thật không hiện ở đây.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                  {cleanupCandidateSessions.length} phiên
                </span>
                {cleanupCandidateSessions.length > visibleCleanupSessions.length ? (
                  <button
                    type="button"
                    onClick={() => setShowAllOpenSessions(true)}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    Xem thêm
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-neutral-400 md:grid-cols-[1fr_130px_150px_130px_110px_220px]">
              <div>Phiên</div>
              <div>Chi nhánh</div>
              <div>Thời gian</div>
              <div>Máy / lượt</div>
              <div>Trạng thái</div>
              <div className="text-right">Thao tác</div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              {visibleCleanupSessions.map((item) => {
                const branchName = branchMap.get(item.branchId) || item.branchId;
                const isApplied = String(item.status || "").toUpperCase() === "APPLIED" || Boolean((item as any).appliedAt);
                const workerCount = item.workers?.length || 0;
                const scanCount = item._count?.scanEvents || item.scanEvents?.length || 0;
                return (
                  <div key={`cleanup-${item.id}`} className="grid gap-3 border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_130px_150px_130px_110px_220px] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-neutral-950">{item.name || "Kiểm kho realtime"}</p>
                      <p className="mt-1 font-mono text-[11px] text-neutral-400">{item.id}</p>
                    </div>
                    <div className="font-bold text-neutral-700">{branchName}</div>
                    <div className="text-xs font-semibold text-neutral-500">
                      <p>Bắt đầu: {formatDateTime(item.startedAt || item.createdAt)}</p>
                      {item.finishedAt ? <p>Kết thúc: {formatDateTime(item.finishedAt)}</p> : null}
                    </div>
                    <div className="text-xs font-semibold text-neutral-600">
                      <p>{workerCount} máy</p>
                      <p>{scanCount} lượt scan</p>
                    </div>
                    <Badge tone={statusTone(item.status)}>{stocktakeStatusLabel(item.status)}</Badge>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(`/stocktake-sessions/${item.id}`, "_blank")}
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => void closeOrDeleteSession(item, "cancel")}
                        disabled={isApplied || sessionActionLoadingId === item.id}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                      >
                        {sessionActionLoadingId === item.id ? "Đang xử lý" : "Huỷ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void closeOrDeleteSession(item, "delete")}
                        disabled={isApplied || sessionActionLoadingId === item.id}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-40"
                      >
                        {sessionActionLoadingId === item.id ? "Đang xử lý" : "Xoá"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!visibleCleanupSessions.length ? (
                <div className="px-4 py-8 text-center text-sm font-semibold text-neutral-500">
                  Không còn phiên nháp/đang kiểm/tạm dừng/chờ chốt cần xử lý.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {loadingJoinableSessions ? (
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 text-sm font-semibold text-neutral-500">
              Đang tải phiên tổng đang mở...
            </div>
          ) : recentJoinableSessions.length ? (
            recentJoinableSessions.map((item) => {
              const active = session?.id === item.id;
              const branchName = branchMap.get(item.branchId) || item.branchId;
              const workers = Array.isArray(item.workers) ? item.workers : [];
              const workerCount = workers.length;
              const scanCount = item._count?.scanEvents || item.scanEvents?.length || 0;
              const visibleWorkers = workers.slice(0, 4);

              return (
                <div
                  key={item.id}
                  className={`rounded-[28px] border bg-white p-4 shadow-sm transition hover:shadow-md ${
                    active ? "border-neutral-950 ring-2 ring-neutral-950/10" : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => window.open(`/stocktake-sessions/${item.id}`, "_blank")}
                      className="min-w-0 text-left"
                      title="Mở chi tiết phiên ở tab mới"
                    >
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        String(item.status || "").toUpperCase() === "PAUSED"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {stocktakeStatusLabel(item.status)}
                      </span>
                      <h4 className="mt-3 truncate text-lg font-extrabold text-neutral-950 hover:underline">
                        {item.name || "Kiểm kho realtime"}
                      </h4>
                      <p className="mt-1 text-xs font-semibold text-neutral-500">
                        {branchName} · {formatDateTime(item.startedAt || item.createdAt)}
                      </p>
                    </button>
                    <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-right">
                      <p className="text-[11px] font-bold uppercase text-neutral-400">Máy</p>
                      <p className="text-xl font-extrabold text-neutral-950">{workerCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-neutral-100">
                    <div className="border-r border-neutral-100 p-3">
                      <p className="text-[11px] font-bold uppercase text-neutral-400">Snapshot</p>
                      <p className="mt-1 font-extrabold text-emerald-700">OK</p>
                    </div>
                    <div className="border-r border-neutral-100 p-3">
                      <p className="text-[11px] font-bold uppercase text-neutral-400">Lượt scan</p>
                      <p className="mt-1 font-extrabold text-neutral-950">{scanCount}</p>
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] font-bold uppercase text-neutral-400">Phiên con</p>
                      <p className="mt-1 font-extrabold text-neutral-950">{workerCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wide text-neutral-400">
                        Máy đang kiểm
                      </p>
                      <button
                        type="button"
                        onClick={() => window.open(`/stocktake-sessions/${item.id}`, "_blank")}
                        className="text-xs font-bold text-neutral-500 hover:text-neutral-950"
                      >
                        Xem chi tiết →
                      </button>
                    </div>

                    {visibleWorkers.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {visibleWorkers.map((workerItem) => {
                          const currentWorker = active && worker?.id === workerItem.id;
                          const count = workerScanCount(workerItem, item);

                          return (
                            <button
                              key={`${item.id}-${workerItem.id}`}
                              type="button"
                              onClick={() => window.open(`/stocktake-sessions/${item.id}`, "_blank")}
                              className="rounded-2xl bg-neutral-950 p-3 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-900"
                              title="Mở chi tiết phiên ở tab mới"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-extrabold">
                                    {workerItem.name || "Máy kiểm"}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] font-semibold text-neutral-400">
                                    {workerItem.deviceName || "Máy scan"}
                                  </p>
                                </div>
                                {currentWorker ? (
                                  <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-black text-white">
                                    Máy này
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-white/10 p-2">
                                  <p className="text-[10px] font-bold text-neutral-400">Lượt scan</p>
                                  <p className="mt-1 text-base font-extrabold">{count}</p>
                                </div>
                                <div className="rounded-xl bg-white/10 p-2">
                                  <p className="text-[10px] font-bold text-neutral-400">Khu</p>
                                  <p className="mt-1 truncate text-xs font-extrabold">
                                    {workerItem.zone || "Khu chính"}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-2 text-[11px] font-bold text-emerald-300">
                                {workerStatusLabel(workerItem.status)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs font-semibold text-neutral-500">
                        Chưa có phiên con. Nhân viên bấm Tham gia kiểm để bắt đầu.
                      </div>
                    )}

                    {workerCount > visibleWorkers.length ? (
                      <button
                        type="button"
                        onClick={() => window.open(`/stocktake-sessions/${item.id}`, "_blank")}
                        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                      >
                        Xem thêm {workerCount - visibleWorkers.length} máy trong chi tiết phiên
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <button
                      type="button"
                      onClick={() => void quickJoinMasterSession(item)}
                      className={`rounded-2xl px-4 py-3 text-sm font-extrabold ${
                        active
                          ? "bg-neutral-100 text-neutral-800"
                          : "bg-neutral-950 text-white hover:bg-neutral-800"
                      }`}
                    >
                      {active ? "Đang làm việc trong phiên này" : "Tham gia kiểm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`/stocktake-sessions/${item.id}`, "_blank")}
                      className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-extrabold text-neutral-700 hover:bg-neutral-50"
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
              <p className="text-base font-extrabold text-neutral-950">Chưa có phiên tổng đang mở</p>
              <p className="mt-1 text-sm text-neutral-500">Tạo phiên tổng để chụp snapshot và bắt đầu kiểm kho.</p>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-600">
                  Phiên kiểm kho hiện tại
                </p>
                <Badge
                  tone={paused ? "amber" : runningSession ? "green" : "gray"}
                >
                  {paused
                    ? "Tạm dừng"
                    : runningSession
                      ? "Đang diễn ra"
                      : session?.status || "Chưa bắt đầu"}
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
                  <p className="text-xs font-mono text-neutral-500">
                    {session.id}
                  </p>
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
                  <p className="text-xs font-medium text-neutral-500">
                    Chi nhánh
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {selectedBranchName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    Khu đang scan
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {worker?.zone || scanZone}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    Bắt đầu
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {formatDateTime(session?.startedAt || session?.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    Máy này
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {worker?.deviceName || deviceName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    Người kiểm
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {worker?.name || scannerName || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-3">
              <MiniProgressCircle percent={progressPercent} />
              <div className="text-center">
                <p className="text-xs font-medium text-neutral-500">
                  Tiến độ{" "}
                  {summaryMode === "WORKER" ? "phiên con" : "toàn phiên"}
                </p>
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
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                !canCreateNewSession
                  ? "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
                  : "border border-neutral-900 bg-neutral-950 text-white hover:bg-neutral-800"
              }`}
            >
              Bắt đầu phiên kiểm
            </button>

            <button
              type="button"
              onClick={() => setWorkerModalOpen(true)}
              disabled={!canCreateWorker}
              className="hidden rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Tạo phiên con
            </button>

            <button
              type="button"
              onClick={openJoinModal}
              disabled={!canJoinWorker}
              className="hidden rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join phiên tổng
            </button>

            <button
              type="button"
              onClick={() => {
                window.open("/stocktake-sessions", "_blank", "noreferrer");
              }}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
            >
              Lịch sử kiểm kho
            </button>

            <button
              type="button"
              onClick={() => {
                if (session?.id) {
                  window.location.href = `/stocktake-sessions/${session.id}`;
                  return;
                }
                window.location.href = "/stocktake-sessions";
              }}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {session?.id ? "Chi tiết phiên" : "Xem phiên đã chốt"}
            </button>

            <button
              type="button"
              onClick={() => void refreshSession()}
              className="hidden rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {refreshing ? "Đang refresh..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={resetLocal}
              className="hidden rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Reset UI
            </button>

            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void pauseSession()}
                disabled={!session?.id || paused || closed || !canEditStocktake}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tạm dừng
              </button>

              <button
                type="button"
                onClick={() => void resumeSession()}
                disabled={!session?.id || !paused || closed || !canEditStocktake}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tiếp tục
              </button>

              <button
                type="button"
                onClick={() => void finishCountingSession()}
                disabled={!session?.id || closed || paused || finishingOnly || !rows.length || !canEditStocktake}
                className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {finishingOnly ? "Đang kết thúc..." : "Kết thúc phiên kiểm"}
              </button>

              <button
                type="button"
                onClick={() => void finishSession()}
                disabled={
                  String(session?.status || "").toUpperCase() !== "FINISHED" ||
                  applying ||
                  !canApplyStocktake
                }
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {applying ? "Đang chốt..." : "Chốt tồn kho thật"}
              </button>
            </div>
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
              <input
                list="stocktake-zone-options"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500"
                value={scanZone}
                onChange={(e) => setScanZone(e.target.value)}
                placeholder="VD: Kệ áo A, Kho sau, Tầng 2..."
              />
              <datalist id="stocktake-zone-options">
                <option value="Khu chính" />
                <option value="Kệ áo" />
                <option value="Kệ quần" />
                <option value="Kho sau" />
                <option value="Khu sale" />
                <option value="Quầy thu ngân" />
              </datalist>
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
            <Badge tone={paused ? "amber" : "blue"}>
              {session?.status || "DRAFT"}
            </Badge>
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
                Chưa có phiên con. Bấm “+ Tạo phiên con” để gán nhân viên, máy
                scan và khu kiểm.
              </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto pb-2">
              {(workerList.length > 0
                ? workerList
                : worker
                  ? [worker]
                  : []
              ).map((item: any) => {
                const active = worker?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void setActiveWorker(item)}
                    className={`min-w-[220px] rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
                        : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold">{item.name}</p>
                        <p
                          className={`mt-1 text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}
                        >
                          {item.displayDevice || item.deviceName || deviceName}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {active ? "Máy này" : "Online"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p
                        className={`text-xs font-semibold ${active ? "text-neutral-300" : "text-neutral-500"}`}
                      >
                        Khu kiểm
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {item.zone || "Chưa gán khu"}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div
                        className={`rounded-xl p-3 ${active ? "bg-white/10" : "bg-neutral-50"}`}
                      >
                        <p
                          className={`text-[11px] font-semibold ${active ? "text-neutral-300" : "text-neutral-500"}`}
                        >
                          Lượt scan
                        </p>
                        <p className="mt-1 text-lg font-extrabold">
                          {item.count || 0}
                        </p>
                      </div>

                      <div
                        className={`rounded-xl p-3 ${active ? "bg-white/10" : "bg-neutral-50"}`}
                      >
                        <p
                          className={`text-[11px] font-semibold ${active ? "text-neutral-300" : "text-neutral-500"}`}
                        >
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
            <p className="text-sm font-semibold text-neutral-700">
              Tổng lượt scan
            </p>
            <p className="text-lg font-extrabold text-blue-600">
              {session?._count?.scanEvents ||
                latestEvents.length ||
                totalCounted}
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
          helper={
            summaryMode === "WORKER" ? "phiên con đang chọn" : "toàn phiên"
          }
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

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-bold text-neutral-950">
              Quét mã / tìm sản phẩm
            </p>
            <Badge tone={worker ? "black" : "amber"}>
              {worker
                ? `${worker.name} · ${worker.zone || "Chưa gán khu"}`
                : "Chưa chọn phiên con"}
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
                  void handleScanCode(scanCode, getScanQty());
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
              disabled={!session || !worker || scanning || paused || closed || !canScanStocktake}
            />

            <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
              <label className="text-xs font-semibold text-neutral-500">
                SL nhanh
                <input
                  value={scanQty}
                  onChange={(e) =>
                    setScanQty(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  onFocus={() => setShowSuggestions(false)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                  inputMode="numeric"
                  placeholder="1"
                  disabled={!session || !worker || scanning || paused || closed || !canScanStocktake}
                />
              </label>

              <button
                type="button"
                onClick={() => void handleScanCode(scanCode, getScanQty())}
                disabled={
                  !session ||
                  !worker ||
                  !scanCode.trim() ||
                  scanning ||
                  paused ||
                  closed ||
                  !canScanStocktake
                }
                className="self-end rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Ghi SL theo mã đang nhập
              </button>
            </div>

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
                      <p>
                        Chi nhánh: {getVariantBranchStock(variant, branchId)}
                      </p>
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
            Máy tít: quét mã sẽ tự +1. Nếu máy tít có suffix Enter thì lưu ngay;
            nếu không có Enter, hệ thống tự lưu sau khoảng 0.3 giây.
          </p>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-blue-950">
                  Upload Excel kiểm kho nhanh
                </p>
                <p className="mt-1 text-xs font-medium text-blue-800/80">
                  Dùng file Phiếu kiểm hàng. Ưu tiên header dòng 10, nếu không thấy sẽ tự dò cột Mã SKU / Tên sản phẩm / Tồn thực tế.
                </p>
              </div>
              <Badge tone={stocktakeExcelRows.length ? "green" : "blue"}>
                {stocktakeExcelRows.length ? `${stocktakeExcelRows.length} dòng` : "Excel"}
              </Badge>
            </div>

            <Link
              href={excelImportHref}
              target="_blank"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-neutral-950 px-4 py-3 text-sm font-extrabold text-white hover:bg-neutral-800"
            >
              Mở trang Upload Excel kiểm kho
            </Link>

            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-white/80 p-4 text-center hover:bg-white">
              <span className="text-sm font-bold text-neutral-900">
                Chọn file Excel kiểm kho
              </span>
              <span className="mt-1 text-xs font-medium text-neutral-500">
                .xlsx / .xls · đọc cột Mã SKU và Tồn thực tế
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={!session || !worker || paused || closed || stocktakeExcelImporting || !canScanStocktake}
                onChange={(event) => void handleStocktakeExcelFileChange(event.target.files?.[0] || null)}
              />
            </label>

            {stocktakeExcelFile ? (
              <div className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-neutral-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{stocktakeExcelFile.name}</span>
                  <button
                    type="button"
                    onClick={() => void handleStocktakeExcelFileChange(null)}
                    className="shrink-0 text-red-600 hover:underline"
                    disabled={stocktakeExcelImporting}
                  >
                    Xóa file
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <span>Sheet: {stocktakeExcelSheetName || "—"}</span>
                  <span>Header: dòng {stocktakeExcelHeaderRow || "—"}</span>
                  <span>Bỏ qua: {stocktakeExcelSkippedRows}</span>
                </div>
                <div className="mt-1 text-neutral-500">
                  Hợp lệ: {stocktakeExcelRows.length} / {stocktakeExcelTotalRows} dòng có dữ liệu.
                </div>
              </div>
            ) : null}

            {stocktakeExcelRows.length ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-white">
                <div className="max-h-44 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-blue-50 text-left text-blue-900">
                      <tr>
                        <th className="px-3 py-2 font-bold">Dòng</th>
                        <th className="px-3 py-2 font-bold">SKU</th>
                        <th className="px-3 py-2 font-bold">Tên SP</th>
                        <th className="px-3 py-2 text-right font-bold">Tồn thực tế</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocktakeExcelRows.slice(0, 8).map((row) => (
                        <tr key={`${row.rowNumber}-${row.sku}`} className="border-t border-neutral-100">
                          <td className="px-3 py-2 text-neutral-500">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-bold text-neutral-900">{row.sku}</td>
                          <td className="max-w-[180px] truncate px-3 py-2 text-neutral-600">{row.productName || "—"}</td>
                          <td className="px-3 py-2 text-right font-extrabold text-neutral-950">{row.countedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {stocktakeExcelRows.length > 8 ? (
                  <div className="border-t border-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-500">
                    Còn {stocktakeExcelRows.length - 8} dòng nữa sẽ được import.
                  </div>
                ) : null}
              </div>
            ) : null}

            {stocktakeExcelImporting ? (
              <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700">
                Đang ghi {stocktakeExcelProgress.done}/{stocktakeExcelProgress.total} dòng vào phiên kiểm...
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void importStocktakeExcelRows()}
              disabled={
                !session ||
                !worker ||
                paused ||
                closed ||
                scanning ||
                stocktakeExcelImporting ||
                !stocktakeExcelRows.length ||
                !canScanStocktake
              }
              className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {stocktakeExcelImporting ? "Đang import Excel..." : "Ghi số lượng từ Excel vào phiên kiểm"}
            </button>

            <p className="mt-2 text-[11px] font-semibold text-blue-900/70">
              Lưu ý: hệ thống set đúng số lượng theo cột Tồn thực tế bằng cách tự tính delta so với số đã scan hiện tại.
            </p>
          </div>

          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold text-neutral-700">
              Scan gần đây
            </p>
            <div className="space-y-2">
              {latestEvents.length === 0 ? (
                <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p>
              ) : (
                latestEvents.slice(0, 8).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {event.sku}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatTime(event.createdAt)}
                      </p>
                    </div>
                    <p
                      className={
                        event.qtyDelta >= 0
                          ? "text-sm font-bold text-green-700"
                          : "text-sm font-bold text-red-700"
                      }
                    >
                      {event.qtyDelta > 0
                        ? `+${event.qtyDelta}`
                        : event.qtyDelta}
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
              <p className="text-base font-bold text-neutral-950">
                Kết quả kiểm kho realtime
              </p>
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
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                  summaryMode === "SESSION"
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
                className={`rounded-full border px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                  summaryMode === "WORKER"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Phiên con của máy này
              </button>

              {(["ALL", "MISMATCH", "MATCH", "NOT_FOUND"] as const).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRowFilter(item)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      rowFilter === item
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
                ),
              )}

              <input
                value={rowQuery}
                onChange={(e) => setRowQuery(e.target.value)}
                placeholder="Tìm SKU, tên sản phẩm..."
                className="w-56 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
          </div>

          <div className="max-h-[760px] overflow-auto">
            {loading ? (
              <div className="p-5 text-sm text-neutral-500">
                Đang tải dữ liệu...
              </div>
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
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-sm text-neutral-500"
                      >
                        Chưa có dòng kiểm kho.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, index) => (
                      <tr
                        key={`${row.workerId || "all"}-${row.sku}`}
                        className={`border-t border-neutral-200 align-top transition ${
                          row.sku === lastScannedSku
                            ? "bg-green-100 ring-2 ring-green-300"
                            : row.status === "MISMATCH"
                              ? "bg-amber-50/40"
                              : row.status === "NOT_FOUND"
                                ? "bg-red-50/40"
                                : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-neutral-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-950">
                          {row.sku}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-neutral-900">
                            {row.variant?.productName ||
                              "Không tìm thấy variant"}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {row.variant?.color || "—"} /{" "}
                            {row.variant?.size || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {row.system}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {row.counted}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {diffText(row.movementDuringStocktake)}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-neutral-950">
                          {row.finalQty}
                        </td>
                        <td
                          className={`px-4 py-3 font-extrabold ${
                            row.diff === 0
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
                          <div className="flex flex-wrap items-center gap-1">
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
                            <input
                              value={
                                quickQtyBySku[row.sku] ??
                                String(row.counted || 0)
                              }
                              onChange={(e) =>
                                setQuickQtyBySku((prev) => ({
                                  ...prev,
                                  [row.sku]: e.target.value.replace(
                                    /[^0-9]/g,
                                    "",
                                  ),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void setRowExactCount(row);
                                }
                              }}
                              className="w-16 rounded-xl border border-neutral-300 px-2 py-1.5 text-center text-xs font-bold outline-none focus:border-blue-500"
                              inputMode="numeric"
                            />
                            <button
                              type="button"
                              onClick={() => void setRowExactCount(row)}
                              className="rounded-xl bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
                            >
                              Ghi
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeCountedRow(row)}
                              className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                            >
                              Xoá
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
            <p className="text-sm font-extrabold text-green-800">
              Tóm tắt dự kiến khi chốt
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">
                  Snapshot đầu phiên
                </span>
                <span
                  className={`font-extrabold ${snapshotReady ? "text-green-700" : "text-amber-700"}`}
                >
                  {snapshotReady
                    ? `${totalSystem} / ${snapshotSkuCount || rows.length} SKU`
                    : "Chưa thấy"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">Counted</span>
                <span className="font-extrabold text-neutral-950">
                  {totalCounted}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">
                  Chênh lệch kiểm kho
                </span>
                <span
                  className={`font-extrabold ${totalDiff === 0 ? "text-neutral-950" : totalDiff > 0 ? "text-green-700" : "text-red-700"}`}
                >
                  {diffText(totalDiff)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-neutral-600">
                  Giao dịch trong lúc kiểm
                </span>
                <span className="font-extrabold text-neutral-950">
                  {diffText(movementDuring)}
                </span>
              </div>
              <div className="border-t border-green-200 pt-3">
                <div className="flex justify-between gap-3">
                  <span className="font-extrabold text-neutral-800">
                    Tồn kho dự kiến
                  </span>
                  <span className="text-2xl font-extrabold text-green-700">
                    {projectedFinal}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-neutral-500">
              Số liệu chỉ cập nhật vào inventory thật khi bấm chốt.
            </p>
          </Panel>

          <Panel className="p-4">
            <p className="text-sm font-bold text-neutral-900">
              Tiến độ theo khu kiểm
            </p>
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
              Máy này sẽ nhập sessionId của phiên tổng, sau đó hệ thống tự tạo
              một phiên con cho máy này.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Mỗi máy tính / điện thoại nên dùng một máy tít riêng. Scan sẽ gắn
              vào đúng workerId của phiên con này.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-neutral-900">
                  Phiên tổng đang mở cùng chi nhánh
                </p>
                <p className="mt-1 text-xs font-medium text-neutral-500">
                  Fulltime chỉ cần bấm chọn phiên tổng, không cần copy sessionId
                  thủ công.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void loadJoinableSessions(
                    branchId || currentBranchId || undefined,
                  )
                }
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Tải lại
              </button>
            </div>

            {loadingJoinableSessions ? (
              <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm font-semibold text-neutral-500">
                Đang tải phiên tổng...
              </p>
            ) : joinableSessionsError ? (
              <p className="rounded-xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">
                {joinableSessionsError}
              </p>
            ) : joinableSessions.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm font-semibold text-neutral-500">
                Chưa có phiên tổng nào đang mở ở chi nhánh này.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {joinableSessions.map((item) => {
                  const active = joinSessionId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setJoinSessionId(item.id);
                        if (item.branchId) setBranchId(item.branchId);
                      }}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200 bg-neutral-50 text-neutral-900 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">
                            {item.name || "Phiên kiểm kho"}
                          </p>
                          <p
                            className={`mt-1 truncate text-xs font-mono ${active ? "text-neutral-300" : "text-neutral-500"}`}
                          >
                            {item.id}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${active ? "bg-white/15 text-white" : "bg-green-50 text-green-700"}`}
                        >
                          {stocktakeStatusLabel(item.status)}
                        </span>
                      </div>
                      <div
                        className={`mt-3 grid grid-cols-3 gap-2 text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}
                      >
                        <span>
                          CN: <b>{item.branchId}</b>
                        </span>
                        <span>
                          Máy: <b>{item.workers?.length || 0}</b>
                        </span>
                        <span>
                          Scan: <b>{item._count?.scanEvents || 0}</b>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
              Ví dụ: Admin kiểm Khu chính, Hùng kiểm Kệ áo, Lan kiểm Kho sau.
              Tất cả cùng thuộc một phiên tổng.
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
          <span
            className={`h-2 w-2 rounded-full ${paused ? "bg-amber-500" : "bg-green-500"}`}
          />
          <span>{paused ? "Tạm dừng" : "Đang kết nối"}</span>
        </div>
        <p>Dữ liệu tự động cập nhật ngầm mỗi 3 giây</p>
        <p>Last update: {formatTime(lastUpdatedAt)}</p>
      </div>
    </div>
  );
}
