"use client";

import Link from "next/link";
import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import { getBranches, type BranchItem } from "@/lib/products-api";
import { applyStocktake } from "@/lib/stocktake-api";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple" | "black";
type StocktakeRowStatus = "MATCH" | "MISMATCH" | "NOT_FOUND";

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
  counted?: number;
  countedQty?: number;
  snapshotQty?: number;
  system?: number;
  diff?: number;
  status?: string;
  events?: number;
  eventCount?: number;
  productName?: string | null;
};

type ExcelImportRow = {
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

type ExcelParseResult = {
  rows: ExcelImportRow[];
  headerRowNumber: number;
  sheetName: string;
  totalDataRows: number;
  skippedRows: number;
};

const STORAGE_SESSION_ID = "the1970_stocktake_session_id";
const STORAGE_WORKER_ID = "the1970_stocktake_worker_id";
const STORAGE_BRANCH_ID = "the1970_stocktake_branch_id";

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
      message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

function saveResumeState(input: { sessionId?: string | null; workerId?: string | null; branchId?: string | null }) {
  if (typeof window === "undefined") return;
  if (input.sessionId) localStorage.setItem(STORAGE_SESSION_ID, input.sessionId);
  if (input.workerId) localStorage.setItem(STORAGE_WORKER_ID, input.workerId);
  if (input.branchId) localStorage.setItem(STORAGE_BRANCH_ID, input.branchId);
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
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const withoutSpaces = raw.replace(/\s/g, "");
  let normalized = withoutSpaces;

  if (withoutSpaces.includes(",") && withoutSpaces.includes(".")) {
    normalized = withoutSpaces.replace(/\./g, "").replace(",", ".");
  } else if (withoutSpaces.includes(",")) {
    const parts = withoutSpaces.split(",");
    normalized = parts.length === 2 && parts[1].length === 3 ? withoutSpaces.replace(/,/g, "") : withoutSpaces.replace(",", ".");
  } else if (withoutSpaces.includes(".")) {
    const parts = withoutSpaces.split(".");
    normalized = parts.length > 2 || parts[parts.length - 1]?.length === 3 ? withoutSpaces.replace(/\./g, "") : withoutSpaces;
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

function hasHeaderSignal(row: unknown[]) {
  const headers = row.map(normalizeExcelHeader).filter(Boolean);
  const hasSku = headers.some((h) => h.includes("masku") || h === "sku" || h.includes("masanpham") || h.includes("mavach"));
  const hasName = headers.some((h) => h.includes("tensanpham") || h.includes("sanpham") || h.includes("tenhang"));
  const hasCounted = headers.some((h) => h.includes("tonthucte") || h.includes("thucte") || h.includes("soluongthucte") || h.includes("demduoc") || h.includes("soluongkiem"));
  return (hasSku && hasCounted) || (hasName && hasCounted) || (hasSku && hasName);
}

function findHeaderRowIndex(rawRows: unknown[][]) {
  const preferred = rawRows[9];
  if (preferred && hasHeaderSignal(preferred)) return 9;

  const limit = Math.min(rawRows.length, 80);
  for (let index = 0; index < limit; index += 1) {
    if (hasHeaderSignal(rawRows[index] || [])) return index;
  }

  return -1;
}

async function parseStocktakeExcelFile(file: File): Promise<ExcelParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) throw new Error("Không đọc được sheet đầu tiên trong file Excel.");

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  const headerRowIndex = findHeaderRowIndex(rawRows);
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

  if (skuIndex < 0) throw new Error("Không tìm thấy cột Mã SKU trong file kiểm kho.");
  if (countedIndex < 0) throw new Error("Không tìm thấy cột Tồn thực tế trong file kiểm kho.");

  const rows: ExcelImportRow[] = [];
  let totalDataRows = 0;
  let skippedRows = 0;

  rawRows.slice(headerRowIndex + 1).forEach((row, rowOffset) => {
    const rowNumber = headerRowIndex + rowOffset + 2;
    const hasAnyValue = Array.isArray(row) && row.some((cell) => normalizeExcelText(cell));
    if (!hasAnyValue) return;

    totalDataRows += 1;

    const sku = normalizeExcelText(row?.[skuIndex]);
    const countedQty = parseExcelNumber(row?.[countedIndex]);
    if (!sku || !Number.isFinite(countedQty) || countedQty < 0) {
      skippedRows += 1;
      return;
    }

    rows.push({
      rowNumber,
      sku,
      productName: productNameIndex >= 0 ? normalizeExcelText(row?.[productNameIndex]) : "",
      unit: unitIndex >= 0 ? normalizeExcelText(row?.[unitIndex]) : "",
      batchCode: batchIndex >= 0 ? normalizeExcelText(row?.[batchIndex]) : "",
      countedQty: Math.max(0, Math.floor(countedQty)),
      systemQty: systemIndex >= 0 ? parseExcelNumber(row?.[systemIndex]) : null,
      diffQty: diffIndex >= 0 ? parseExcelNumber(row?.[diffIndex]) : null,
      reason: reasonIndex >= 0 ? normalizeExcelText(row?.[reasonIndex]) : "",
      note: noteIndex >= 0 ? normalizeExcelText(row?.[noteIndex]) : "",
    });
  });

  return { rows, headerRowNumber: headerRowIndex + 1, sheetName, totalDataRows, skippedRows };
}

function isClosedStatus(status?: string | null) {
  return ["FINISHED", "APPLIED", "CANCELLED"].includes(String(status || "").toUpperCase());
}

function isPausedStatus(status?: string | null) {
  return String(status || "").toUpperCase() === "PAUSED";
}

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

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function diffText(value?: number | null) {
  const n = Number(value || 0);
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n);
}

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

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function StatBox({ label, value, tone = "gray", helper }: { label: string; value: React.ReactNode; tone?: Tone; helper?: React.ReactNode }) {
  const colors: Record<Tone, string> = {
    gray: "text-neutral-950 bg-white",
    green: "text-green-700 bg-green-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
    blue: "text-blue-700 bg-blue-50",
    purple: "text-purple-700 bg-purple-50",
    black: "text-white bg-neutral-950",
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-xl px-3 py-1 text-2xl font-extrabold ${colors[tone]}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs font-semibold text-neutral-500">{helper}</p> : null}
    </div>
  );
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

function hasStocktakePermission(user: any, permission: string) {
  if (isOwnerOrAdmin(user)) return true;
  const keys = collectPermissionKeys(user);
  return keys.has("*") || keys.has(permission);
}


function AdminMiniSidebar() {
  const groups: Array<{ title: string; items: Array<[string, string, boolean?]> }> = [
    {
      title: "Đơn hàng",
      items: [
        ["Danh sách", "/orders"],
        ["Tạo đơn", "/create-order"],
        ["POS bán tại quầy", "/pos"],
        ["Đơn trả hàng", "/returns"],
      ],
    },
    {
      title: "Sản phẩm",
      items: [
        ["Danh sách", "/products"],
        ["Khuyến mại", "/promotions"],
        ["Danh mục", "/control/product-categories"],
        ["Nhà cung cấp", "/control/suppliers"],
      ],
    },
    {
      title: "Kho",
      items: [
        ["Kho hàng", "/inventory"],
        ["Lịch sử kho", "/inventory-logs"],
        ["Phiếu nhập", "/control/purchase-receipts"],
        ["Phiếu chuyển kho", "/control/stock-transfers"],
        ["Kiểm kho realtime", "/stocktake"],
        ["Upload Excel kiểm kho", "/stocktake/excel-import", true],
        ["Lịch sử kiểm kho", "/stocktake-sessions"],
        ["Sơ đồ kho 3D", "/control/warehouse-map"],
      ],
    },
    {
      title: "Tài chính",
      items: [
        ["Tổng quan dòng tiền", "/finance/daily"],
        ["Phiếu thu", "/finance/cash-receipts"],
        ["Phiếu chi", "/finance/cash-payments"],
        ["Đối soát COD GHN", "/finance/ghn-reconciliation"],
      ],
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] overflow-y-auto border-r border-neutral-200 bg-white px-5 py-6 lg:block">
      <div className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-neutral-400">Admin Panel</div>
        <div className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-950">The 1970</div>
        <div className="mt-1 text-xs font-medium text-neutral-400">Core operations dashboard</div>
      </div>

      <Link href="/control" className="mb-3 block rounded-xl px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50">
        Tổng quan
      </Link>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.title} className="rounded-3xl border border-neutral-200 bg-white p-3">
            <div className="px-2 py-2 text-sm font-extrabold text-neutral-950">{group.title}</div>
            <div className="space-y-1">
              {group.items.map(([label, href, active]) => (
                <Link
                  key={`${group.title}-${href}`}
                  href={href}
                  className={`block rounded-xl px-3 py-2 text-sm font-semibold ${
                    active
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function StocktakeExcelImportPageClient() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [branchId, setBranchId] = useState("");
  const [sessionName, setSessionName] = useState("Kiểm kho Excel");
  const [sessionNote, setSessionNote] = useState("Import từ file Excel kiểm kho");
  const [workerName, setWorkerName] = useState("Admin");
  const [workerZone, setWorkerZone] = useState("Khu chính");
  const [deviceName, setDeviceName] = useState("Máy import Excel");

  const [sessionIdInput, setSessionIdInput] = useState("");
  const [session, setSession] = useState<RealtimeSession | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ExcelImportRow[]>([]);
  const [parseInfo, setParseInfo] = useState<Omit<ExcelParseResult, "rows"> | null>(null);
  const [message, setMessage] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);
    if (user?.name) setWorkerName(user.name);
    if (user?.branchId) setBranchId(user.branchId);

    void getBranches()
      .then((data) => {
        setBranches(Array.isArray(data) ? data : []);
        setBranchId((prev) => prev || data?.[0]?.id || "");
      })
      .catch(() => setBranches([]));

    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const querySessionId = params.get("sessionId") || "";
    const queryWorkerId = params.get("workerId") || "";
    const savedSessionId = localStorage.getItem(STORAGE_SESSION_ID) || "";
    const savedWorkerId = localStorage.getItem(STORAGE_WORKER_ID) || "";
    const savedBranchId = localStorage.getItem(STORAGE_BRANCH_ID) || "";
    const initialSessionId = querySessionId || savedSessionId;
    const initialWorkerId = queryWorkerId || savedWorkerId;

    if (savedBranchId) setBranchId(savedBranchId);
    setSessionIdInput(initialSessionId);
    setWorkerId(initialWorkerId);

    if (querySessionId) {
      setMessage("Đang mở đúng phiên kiểm vừa chọn từ màn realtime...");
      void loadSession(querySessionId, queryWorkerId);
      return;
    }

    if (savedSessionId) {
      void loadSession(savedSessionId, savedWorkerId);
      return;
    }

    const autoBranchId = savedBranchId || user?.branchId || "";
    const query = autoBranchId ? `?branchId=${encodeURIComponent(autoBranchId)}` : "";
    setMessage("Đang tìm phiên kiểm đang mở để tải vào trang Excel...");
    void apiRequest<RealtimeSession | null>(`/stocktake-sessions/active/current${query}`)
      .then((active) => {
        if (!active?.id) {
          setMessage("Chưa tải phiên kiểm. Hãy tạo phiên tổng ở màn realtime trước rồi bấm tải phiên tại đây.");
          return;
        }
        const firstWorkerId = active.workers?.[0]?.id || "";
        setSessionIdInput(active.id);
        setWorkerId(firstWorkerId);
        saveResumeState({ sessionId: active.id, workerId: firstWorkerId, branchId: active.branchId });
        void loadSession(active.id, firstWorkerId);
      })
      .catch(() => setMessage("Chưa tải phiên kiểm. Hãy tạo phiên tổng ở màn realtime trước rồi bấm tải phiên tại đây."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = hasStocktakePermission(currentUser, "stocktake.create");
  const canImport = hasStocktakePermission(currentUser, "stocktake.scan") || hasStocktakePermission(currentUser, "stocktake.edit") || hasStocktakePermission(currentUser, "stocktake.create");
  const canApply = hasStocktakePermission(currentUser, "stocktake.apply");
  const selectedWorker = useMemo(() => (session?.workers || []).find((item) => item.id === workerId) || null, [session?.workers, workerId]);
  const paused = isPausedStatus(session?.status);
  const closed = isClosedStatus(session?.status);
  const selectedBranchName = branches.find((branch) => branch.id === (session?.branchId || branchId))?.name || session?.branchId || branchId || "—";

  function getStableSnapshotForExcelRow(row: ExcelImportRow, item?: SummaryItem | null) {
    const excelSystemQty = Number(row.systemQty);

    // Với flow Excel, cột snapshot phải ưu tiên lấy từ file Phiếu kiểm hàng
    // (cột Tồn chi nhánh/Tồn hệ thống). Sau khi bấm ghi Excel vào phiên,
    // summary backend có thể trả về số đếm/stock hiện tại khác, không được dùng
    // để ghi đè snapshot preview vì sẽ làm nhảy số lung tung.
    if (row.systemQty !== null && row.systemQty !== undefined && Number.isFinite(excelSystemQty)) {
      return excelSystemQty;
    }

    return Number(item?.snapshotQty ?? item?.system ?? 0);
  }

  function isKnownExcelRow(row: ExcelImportRow, item?: SummaryItem | null) {
    const excelSystemQty = Number(row.systemQty);
    return Boolean(item?.variantId) || (row.systemQty !== null && row.systemQty !== undefined && Number.isFinite(excelSystemQty));
  }

  const currentCountBySku = useMemo(() => {
    const map = new Map<string, number>();
    summary.forEach((item) => map.set(String(item.sku || ""), Number(item.counted ?? item.countedQty ?? 0)));
    return map;
  }, [summary]);

  const excelSkuSet = useMemo(() => new Set(rows.map((row) => row.sku)), [rows]);

  const reconciledRows = useMemo(() => {
    const summaryMap = new Map<string, SummaryItem>();
    summary.forEach((item) => summaryMap.set(String(item.sku || ""), item));

    return rows.map((row) => {
      const item = summaryMap.get(row.sku);
      const counted = Number(item?.counted ?? item?.countedQty ?? currentCountBySku.get(row.sku) ?? 0);
      const snapshot = getStableSnapshotForExcelRow(row, item);
      const excelCounted = Number(row.countedQty || 0);

      // Preview phải so sánh Tồn thực tế trong Excel với snapshot đầu phiên.
      // Snapshot Excel là cột Tồn chi nhánh trong file, không lấy lại từ summary sau khi import.
      const diff = excelCounted - snapshot;
      const status: StocktakeRowStatus = !isKnownExcelRow(row, item) ? "NOT_FOUND" : diff === 0 ? "MATCH" : "MISMATCH";

      return { row, item, counted, snapshot, diff, status };
    });
  }, [rows, summary, currentCountBySku]);

  const summaryRowsOutsideExcel = useMemo(() => summary.filter((item) => item.sku && !excelSkuSet.has(item.sku)), [summary, excelSkuSet]);
  const previewRows = useMemo(() => (showOnlyDiff ? reconciledRows.filter((row) => row.diff !== 0 || row.status === "NOT_FOUND") : reconciledRows).slice(0, 300), [reconciledRows, showOnlyDiff]);

  const totalExcelQty = rows.reduce((sum, row) => sum + Number(row.countedQty || 0), 0);
  const totalCounted = reconciledRows.reduce((sum, row) => sum + row.counted, 0);
  const totalSnapshot = reconciledRows.reduce((sum, row) => sum + row.snapshot, 0);
  const totalDiff = reconciledRows.reduce((sum, row) => sum + row.diff, 0);
  const matchedCount = reconciledRows.filter((row) => row.status === "MATCH").length;
  const mismatchCount = reconciledRows.filter((row) => row.status === "MISMATCH").length;
  const notFoundCount = reconciledRows.filter((row) => row.status === "NOT_FOUND").length;
  const willWriteCount = rows.filter((row) => Number(row.countedQty || 0) !== (currentCountBySku.get(row.sku) || 0)).length;

  async function fetchSummaryRows(targetSessionId: string, targetWorkerId?: string) {
    if (!targetSessionId) return [];

    const path = targetWorkerId
      ? `/stocktake-sessions/${targetSessionId}/workers/${targetWorkerId}/summary`
      : `/stocktake-sessions/${targetSessionId}/summary`;
    const data = await apiRequest<SummaryItem[]>(path);
    return Array.isArray(data) ? data : [];
  }

  async function loadSummary(targetSessionId: string, targetWorkerId?: string) {
    try {
      const data = await fetchSummaryRows(targetSessionId, targetWorkerId);
      setSummary(data);
      return data;
    } catch {
      setSummary([]);
      return [];
    }
  }

  async function loadSession(targetSessionId?: string, preferredWorkerId?: string) {
    const finalSessionId = (targetSessionId || sessionIdInput).trim();
    if (!finalSessionId) {
      setMessage("Chưa có session ID. Hãy tạo phiên kiểm kho tổng ở màn kiểm kho realtime trước, hoặc dán Session ID phiên đang mở.");
      return;
    }

    try {
      setLoadingSession(true);
      setMessage("Đang tải phiên kiểm kho...");
      const data = await apiRequest<RealtimeSession>(`/stocktake-sessions/${finalSessionId}`);
      setSession(data);
      setSessionIdInput(data.id);
      setBranchId(data.branchId || branchId);

      const savedWorkerId = preferredWorkerId || workerId;
      const nextWorkerId = (data.workers || []).find((item) => item.id === savedWorkerId)?.id || data.workers?.[0]?.id || "";
      setWorkerId(nextWorkerId);
      saveResumeState({ sessionId: data.id, workerId: nextWorkerId, branchId: data.branchId });
      await loadSummary(data.id);
      setMessage("Đã tải phiên kiểm đã có snapshot. Có thể upload Excel vào phiên này.");
    } catch (err) {
      setSession(null);
      setSummary([]);
      setMessage(err instanceof Error ? err.message : "Không tải được phiên kiểm kho.");
    } finally {
      setLoadingSession(false);
    }
  }

  async function createExcelSession() {
    if (!canCreate) {
      setMessage("Bạn không có quyền tạo phiên kiểm kho.");
      return;
    }
    if (!branchId) {
      setMessage("Chưa chọn chi nhánh.");
      return;
    }

    try {
      setCreatingSession(true);
      setMessage("Đang tạo phiên kiểm kho Excel...");

      const created = await apiRequest<RealtimeSession>("/stocktake-sessions", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          name: sessionName || "Kiểm kho Excel",
          note: sessionNote || "Import từ file Excel kiểm kho",
        }),
      });

      const joined = await apiRequest<RealtimeWorker>(`/stocktake-sessions/${created.id}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: workerName || "Người import Excel",
          zone: workerZone || "Khu chính",
          deviceName: deviceName || "Máy import Excel",
        }),
      });

      await apiRequest(`/stocktake-sessions/${created.id}/start`, { method: "PATCH" });
      const fresh = await apiRequest<RealtimeSession>(`/stocktake-sessions/${created.id}`);
      setSession(fresh);
      setSessionIdInput(created.id);
      setWorkerId(joined.id);
      setSummary([]);
      saveResumeState({ sessionId: created.id, workerId: joined.id, branchId });
      setMessage("Đã tạo phiên kiểm Excel. Phiên này sẽ hiển thị trong Lịch sử kiểm kho như phiên realtime bình thường.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được phiên kiểm Excel.");
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleFileChange(nextFile?: File | null) {
    const selected = nextFile || null;
    setFile(selected);
    setRows([]);
    setParseInfo(null);
    setProgress({ done: 0, total: 0 });

    if (!selected) return;

    try {
      setMessage("Đang đọc file Excel kiểm kho...");
      const parsed = await parseStocktakeExcelFile(selected);
      setRows(parsed.rows);
      setParseInfo({
        headerRowNumber: parsed.headerRowNumber,
        sheetName: parsed.sheetName,
        totalDataRows: parsed.totalDataRows,
        skippedRows: parsed.skippedRows,
      });
      setMessage(`Đã đọc ${parsed.rows.length}/${parsed.totalDataRows} dòng. Header dòng ${parsed.headerRowNumber}.`);
    } catch (err) {
      setFile(null);
      setRows([]);
      setParseInfo(null);
      setMessage(err instanceof Error ? err.message : "Không đọc được file Excel kiểm kho.");
    }
  }

  async function refreshWorkerSummaryAfterChange() {
    if (!session?.id) return;
    await loadSummary(session.id);
  }

  async function ensureExcelWorkerId() {
    if (!session?.id) return "";
    if (workerId) return workerId;

    const existingWorkerId = session.workers?.[0]?.id || "";
    if (existingWorkerId) {
      setWorkerId(existingWorkerId);
      saveResumeState({ sessionId: session.id, workerId: existingWorkerId, branchId: session.branchId });
      return existingWorkerId;
    }

    const joined = await apiRequest<RealtimeWorker>(`/stocktake-sessions/${session.id}/join`, {
      method: "POST",
      body: JSON.stringify({
        name: workerName || "Người import Excel",
        zone: workerZone || "Khu chính",
        deviceName: deviceName || "Máy import Excel",
      }),
    });

    setWorkerId(joined.id);
    saveResumeState({ sessionId: session.id, workerId: joined.id, branchId: session.branchId });
    return joined.id;
  }

  async function importRows() {
    if (!canImport) {
      setMessage("Bạn không có quyền upload/ghi số lượng kiểm kho.");
      return;
    }
    if (!session?.id) {
      setMessage("Cần có phiên kiểm trước khi import.");
      return;
    }
    if (paused) {
      setMessage("Phiên đang tạm dừng. Quay lại màn realtime bấm tiếp tục rồi import.");
      return;
    }
    if (closed) {
      setMessage("Phiên đã đóng, không thể import Excel.");
      return;
    }

    const finalWorkerId = await ensureExcelWorkerId();
    if (!finalWorkerId) {
      setMessage("Không tạo được phiên con/máy import Excel cho phiên này.");
      return;
    }

    if (!rows.length) {
      setMessage("Chưa có dòng Excel hợp lệ để import.");
      return;
    }

    const ok = window.confirm(`Ghi ${rows.length} dòng từ Excel vào phiên kiểm hiện tại? Hệ thống sẽ set số lượng theo cột Tồn thực tế bằng delta so với số đã scan.`);
    if (!ok) return;

    try {
      setImporting(true);
      setProgress({ done: 0, total: rows.length });
      setMessage("Đang import Excel vào phiên kiểm...");

      const currentMap = new Map(currentCountBySku);
      let done = 0;
      let skipped = 0;
      let failed = 0;
      const failedSamples: string[] = [];

      for (const row of rows) {
        const sku = row.sku.trim();
        const targetQty = Number(row.countedQty || 0);
        const currentQty = currentMap.get(sku) || 0;
        const delta = targetQty - currentQty;

        if (!sku || delta === 0) {
          skipped += 1;
          done += 1;
          setProgress({ done, total: rows.length });
          continue;
        }

        try {
          const res = await apiRequest<any>("/stocktake-sessions/scan", {
            method: "POST",
            body: JSON.stringify({
              sessionId: session.id,
              workerId: finalWorkerId,
              branchId: session.branchId,
              code: sku,
              zone: selectedWorker?.zone || workerZone || "Khu chính",
              qtyDelta: delta,
              note: `Import Excel dòng ${row.rowNumber}${row.note ? ` · ${row.note}` : ""}`,
            }),
          });

          const scannedSku = res?.variant?.sku || sku;
          currentMap.set(scannedSku, targetQty);
        } catch (err) {
          failed += 1;
          if (failedSamples.length < 8) failedSamples.push(`${sku}: ${err instanceof Error ? err.message : "lỗi import"}`);
        } finally {
          done += 1;
          setProgress({ done, total: rows.length });
        }
      }

      saveResumeState({ sessionId: session.id, workerId: finalWorkerId, branchId: session.branchId });
      await refreshWorkerSummaryAfterChange();
      setMessage(`Import Excel xong: ${rows.length - failed - skipped} dòng đã ghi, ${skipped} dòng không đổi, ${failed} dòng lỗi.${failedSamples.length ? ` Lỗi mẫu: ${failedSamples.join(" | ")}` : ""}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import Excel thất bại.");
    } finally {
      setImporting(false);
    }
  }

  async function confirmAndApplySession() {
    if (!canApply) {
      setMessage("Bạn không có quyền xác nhận/chốt tồn kiểm kho.");
      return;
    }
    if (!session?.id) {
      setMessage("Chưa có phiên kiểm để xác nhận.");
      return;
    }
    if (!rows.length) {
      setMessage("Chưa có file Excel hợp lệ để xác nhận. Upload Excel trước rồi mới xác nhận.");
      return;
    }
    if (closed) {
      setMessage("Phiên đã đóng hoặc đã chốt tồn rồi.");
      return;
    }

    const freshSummary = await loadSummary(session.id);

    if (!freshSummary.length) {
      setMessage("Chưa ghi được dòng nào vào phiên kiểm. Bấm ‘Ghi Excel vào phiên kiểm’ trước rồi mới xác nhận.");
      return;
    }

    const freshSummaryMap = new Map<string, SummaryItem>();
    freshSummary.forEach((item) => freshSummaryMap.set(String(item.sku || ""), item));

    const payloadRows = rows
      .map((row) => {
        const item = freshSummaryMap.get(row.sku);
        const counted = Number(item?.counted ?? item?.countedQty ?? 0);
        const system = getStableSnapshotForExcelRow(row, item);
        const diff = counted - system;
        const status: StocktakeRowStatus = !isKnownExcelRow(row, item) ? "NOT_FOUND" : diff === 0 ? "MATCH" : "MISMATCH";

        return {
          variantId: item?.variantId || undefined,
          sku: row.sku,
          counted,
          system,
          diff,
          status,
          reason: status === "MATCH" ? "" : row.reason || "Khác",
          note: file?.name ? `Chốt từ Excel: ${file.name}` : row.note || "Chốt từ trang upload Excel",
        };
      })
      .filter((row) => row.status !== "NOT_FOUND" && (row.counted !== row.system || row.counted > 0 || row.system > 0));

    if (!payloadRows.length) {
      setMessage("Không có dòng hợp lệ để chốt. Kiểm tra lại file Excel hoặc bấm ‘Ghi Excel vào phiên kiểm’ trước.");
      return;
    }

    const ok = window.confirm(
      `Xác nhận kiểm kho và cập nhật tồn thật?\n\nSKU đã kiểm: ${payloadRows.length}\nLệch tổng: ${diffText(payloadRows.reduce((sum, row) => sum + Number(row.diff || 0), 0))}\n\nSau bước này phiên sẽ xuất hiện ở lịch sử với trạng thái đã kết thúc/chốt tồn.`,
    );
    if (!ok) return;

    try {
      setConfirming(true);
      setMessage("Đang xác nhận kiểm kho và cập nhật tồn...");

      const result = await applyStocktake({
        sessionName: session.name || sessionName || "Kiểm kho Excel",
        sessionNote: `${session.note || sessionNote || ""}${file?.name ? ` · File: ${file.name}` : ""}`,
        branchId: session.branchId,
        rows: payloadRows,
      });

      await apiRequest(`/stocktake-sessions/${session.id}/finish`, { method: "PATCH" });
      await loadSession(session.id, workerId);
      setMessage(
        `Đã xác nhận kiểm kho Excel. Điều chỉnh ${result.adjustedCount || 0} dòng, tổng delta ${diffText(result.totalDelta)}. Đang mở chi tiết phiên...`,
      );
      window.setTimeout(() => {
        window.location.href = `/stocktake-sessions/${session.id}`;
      }, 650);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không xác nhận được phiên kiểm Excel.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f7f7f8] text-neutral-950">
      <AdminMiniSidebar />
      <main className="h-screen overflow-y-auto overscroll-contain p-4 pb-24 lg:ml-[260px] lg:p-5 lg:pb-24">
        <div className="min-h-full space-y-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/stocktake" className="text-sm font-bold text-neutral-500 hover:text-neutral-950">← Quay lại kiểm kho realtime</Link>
            <Badge tone="blue">Excel</Badge>
            {session ? <Badge tone={closed ? "red" : paused ? "amber" : "green"}>{statusLabel(session.status)}</Badge> : null}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-neutral-950">Upload Excel kiểm kho</h1>
          <p className="mt-1 text-sm text-neutral-500">Flow chuẩn: tạo phiên/snapshot ở màn kiểm kho realtime → sang đây upload Excel → so sánh snapshot → xác nhận/chốt tồn.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/stocktake-sessions" className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50">Lịch sử kiểm kho</Link>
          <Link href="/stocktake" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">Màn scan realtime</Link>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-700 shadow-sm">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <StatBox label="Snapshot hệ thống" value={formatNumber(totalSnapshot)} tone="blue" helper="Tồn đầu phiên của các SKU trong Excel" />
        <StatBox label="Tồn thực tế Excel" value={formatNumber(totalExcelQty || totalCounted)} tone="green" helper="Lấy từ cột Tồn thực tế" />
        <StatBox label="Chênh lệch" value={diffText(totalDiff)} tone={totalDiff === 0 ? "gray" : totalDiff > 0 ? "green" : "red"} helper="Thực tế - snapshot" />
        <StatBox label="Lệch / không thấy" value={`${formatNumber(mismatchCount)} / ${formatNumber(notFoundCount)}`} tone={mismatchCount || notFoundCount ? "amber" : "green"} helper="Sau khi ghi vào phiên" />
        <StatBox label="Sẽ ghi" value={formatNumber(willWriteCount)} tone="purple" helper="Dòng có delta khác số đã ghi" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-neutral-950">1. Chọn phiên kiểm đã có snapshot</h2>
                <p className="mt-1 text-sm text-neutral-500">Snapshot chỉ tạo ở màn kiểm kho realtime. Trang này chỉ import Excel vào phiên đã tạo sẵn.</p>
              </div>
              <Badge tone={closed ? "red" : paused ? "amber" : session ? "green" : "gray"}>{statusLabel(session?.status)}</Badge>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <p className="font-extrabold">Flow chuẩn</p>
              <p className="mt-1">Vào màn kiểm kho realtime → tạo phiên tổng để chụp snapshot → quay lại đây upload Excel vào đúng phiên đó.</p>
              <Link href="/stocktake" className="mt-3 inline-flex rounded-xl bg-neutral-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-neutral-800">
                Mở màn tạo phiên / snapshot
              </Link>
            </div>

            <div className="mt-5 border-t border-neutral-100 pt-4">
              <label className="block text-sm font-bold text-neutral-700">
                Session ID phiên kiểm đã tạo
                <input value={sessionIdInput} onChange={(e) => setSessionIdInput(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" placeholder="Dán session ID nếu cần" />
              </label>
              <button type="button" onClick={() => void loadSession()} disabled={loadingSession} className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-extrabold text-neutral-800 hover:bg-neutral-50 disabled:bg-neutral-100">
                {loadingSession ? "Đang tải phiên..." : "Tải phiên kiểm đang mở"}
              </button>
              <p className="mt-2 text-xs font-semibold text-neutral-500">Nếu mở từ màn realtime, trang sẽ nhận đúng Session ID qua URL. Nếu tự vào trang này, hệ thống mới dùng session đã lưu trên máy.</p>
            </div>

            {session ? (
              <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm">
                <p className="font-extrabold text-neutral-950">{session.name || "Phiên kiểm kho"}</p>
                <p className="mt-1 font-mono text-xs text-neutral-500">{session.id}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-neutral-600">
                  <div>Chi nhánh: <span className="text-neutral-950">{selectedBranchName}</span></div>
                  <div>Trạng thái: <span className="text-neutral-950">{statusLabel(session.status)}</span></div>
                </div>

                {closed ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Phiên này đã đóng/chốt, không thể upload Excel thêm.</div>
                ) : paused ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Phiên đang tạm dừng. Quay lại màn realtime bấm tiếp tục trước khi import.</div>
                ) : null}

                <label className="mt-4 block text-sm font-bold text-neutral-700">
                  Phiên con / máy ghi dữ liệu
                  <select value={workerId} onChange={(e) => { setWorkerId(e.target.value); saveResumeState({ sessionId: session.id, workerId: e.target.value, branchId: session.branchId }); void loadSummary(session.id, e.target.value); }} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                    {(session.workers || []).length ? (session.workers || []).map((worker) => (
                      <option key={worker.id} value={worker.id}>{worker.name || worker.id}{worker.zone ? ` · ${worker.zone}` : ""}{worker.deviceName ? ` · ${worker.deviceName}` : ""}</option>
                    )) : <option value="">Chưa có phiên con</option>}
                  </select>
                </label>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-600">
                Chưa tải phiên kiểm. Hãy tạo phiên tổng ở màn realtime trước rồi bấm tải phiên tại đây.
              </div>
            )}
          </Panel>

          <Panel className="border-blue-100 bg-blue-50/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-blue-950">2. Upload file Excel</h2>
                <p className="mt-1 text-sm font-medium text-blue-800/80">Đọc Phiếu kiểm hàng, cột Mã SKU và Tồn thực tế.</p>
              </div>
              <Badge tone={rows.length ? "green" : "blue"}>{rows.length ? `${rows.length} dòng` : "Chưa chọn"}</Badge>
            </div>

            <label className="mt-4 flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-white p-5 text-center hover:bg-blue-50/40">
              <span className="text-base font-extrabold text-neutral-950">Chọn file Excel kiểm kho</span>
              <span className="mt-1 text-sm text-neutral-500">.xlsx / .xls · ưu tiên header dòng 10</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleFileChange(event.target.files?.[0] || null)} />
            </label>

            {file ? (
              <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-neutral-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => void handleFileChange(null)} disabled={importing} className="text-red-600 hover:underline">Xóa file</button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                  <span>Sheet: {parseInfo?.sheetName || "—"}</span>
                  <span>Header: dòng {parseInfo?.headerRowNumber || "—"}</span>
                  <span>Hợp lệ: {rows.length} / {parseInfo?.totalDataRows || 0}</span>
                  <span>Bỏ qua: {parseInfo?.skippedRows || 0}</span>
                </div>
              </div>
            ) : null}

            {importing ? <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-blue-700">Đang ghi {progress.done}/{progress.total} dòng vào phiên kiểm...</div> : null}

            <button type="button" onClick={() => void importRows()} disabled={!session || closed || importing || !rows.length || !canImport} className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
              {importing ? "Đang import Excel..." : "Ghi Excel vào phiên kiểm"}
            </button>

            <p className="mt-3 text-xs font-semibold text-blue-900/70">Sau khi ghi, bảng bên phải sẽ so sánh số Excel với snapshot đầu phiên của hệ thống.</p>
          </Panel>

          <Panel className="border-red-100 bg-red-50/60">
            <h2 className="text-lg font-extrabold text-red-950">4. Xác nhận kiểm kho</h2>
            <p className="mt-1 text-sm font-medium text-red-800/80">Bước này mới cập nhật tồn thật. Sau khi bấm “Ghi Excel vào phiên kiểm”, nút sẽ dùng dữ liệu đã ghi trong phiên để chốt.</p>
            <button type="button" onClick={() => void confirmAndApplySession()} disabled={!session || closed || confirming || importing || !rows.length || !canApply} className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300">
              {confirming ? "Đang xác nhận..." : "Xác nhận kiểm kho + cập nhật tồn"}
            </button>
            <p className="mt-3 text-xs font-semibold text-red-900/70">Sau khi xác nhận, phiên sẽ nằm trong Lịch sử kiểm kho và mở được trang chi tiết.</p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-neutral-950">3. So sánh với snapshot hệ thống</h2>
                <p className="mt-1 text-sm text-neutral-500">Snapshot là tồn hệ thống tại thời điểm tạo phiên kiểm. Import Excel sẽ ghi số thực tế, sau đó bảng này tự tính lệch.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { if (session?.id) void loadSummary(session.id, workerId || undefined); }} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50">Tải lại so sánh</button>
                <button type="button" onClick={() => setShowOnlyDiff((value) => !value)} className={`rounded-xl px-3 py-2 text-sm font-bold ${showOnlyDiff ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>{showOnlyDiff ? "Đang lọc lệch" : "Chỉ xem lệch"}</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-green-50 p-4"><p className="text-sm font-semibold text-green-700">Khớp</p><p className="mt-2 text-2xl font-extrabold text-green-700">{formatNumber(matchedCount)}</p></div>
              <div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-700">Lệch</p><p className="mt-2 text-2xl font-extrabold text-amber-700">{formatNumber(mismatchCount)}</p></div>
              <div className="rounded-2xl bg-red-50 p-4"><p className="text-sm font-semibold text-red-700">Không tìm thấy</p><p className="mt-2 text-2xl font-extrabold text-red-700">{formatNumber(notFoundCount)}</p></div>
              <div className="rounded-2xl bg-blue-50 p-4"><p className="text-sm font-semibold text-blue-700">Ngoài file Excel</p><p className="mt-2 text-2xl font-extrabold text-blue-700">{formatNumber(summaryRowsOutsideExcel.length)}</p></div>
            </div>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 p-5">
              <div>
                <h2 className="text-lg font-extrabold text-neutral-950">Preview & đối chiếu dữ liệu</h2>
                <p className="mt-1 text-sm text-neutral-500">Hiển thị tối đa 300 dòng để kiểm tra trước khi xác nhận.</p>
              </div>
              <Badge tone="gray">{formatNumber(previewRows.length)} dòng xem trước</Badge>
            </div>

            <div className="max-h-[650px] overflow-auto">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Dòng</th>
                    <th className="px-4 py-3 font-bold">SKU</th>
                    <th className="px-4 py-3 font-bold">Tên sản phẩm</th>
                    <th className="px-4 py-3 text-right font-bold">Snapshot hệ thống</th>
                    <th className="px-4 py-3 text-right font-bold">Tồn thực tế Excel</th>
                    <th className="px-4 py-3 text-right font-bold">Đã ghi vào phiên</th>
                    <th className="px-4 py-3 text-right font-bold">Lệch</th>
                    <th className="px-4 py-3 font-bold">Trạng thái</th>
                    <th className="px-4 py-3 font-bold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {!previewRows.length ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-neutral-500">Chưa có dữ liệu. Tạo phiên kiểm ở màn realtime rồi tải phiên vào đây, sau đó upload Excel để xem so sánh.</td></tr>
                  ) : previewRows.map(({ row, counted, snapshot, diff, status }) => (
                    <tr key={`${row.rowNumber}-${row.sku}`} className="border-t border-neutral-100 hover:bg-neutral-50/70">
                      <td className="px-4 py-3 text-neutral-500">{row.rowNumber}</td>
                      <td className="px-4 py-3 font-extrabold text-neutral-950">{row.sku}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-neutral-800">{row.productName || "—"}</p><p className="text-xs text-neutral-400">{[row.unit, row.batchCode].filter(Boolean).join(" · ")}</p></td>
                      <td className="px-4 py-3 text-right font-bold text-neutral-600">{formatNumber(snapshot)}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-neutral-950">{formatNumber(row.countedQty)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{formatNumber(counted)}</td>
                      <td className={`px-4 py-3 text-right font-extrabold ${diff === 0 ? "text-neutral-500" : diff > 0 ? "text-green-700" : "text-red-700"}`}>{diffText(diff)}</td>
                      <td className="px-4 py-3"><Badge tone={status === "MATCH" ? "green" : status === "NOT_FOUND" ? "red" : "amber"}>{status === "MATCH" ? "Khớp" : status === "NOT_FOUND" ? "Không tìm thấy" : "Lệch"}</Badge></td>
                      <td className="px-4 py-3 text-neutral-500">{row.note || row.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
        </div>
      </main>
    </div>
  );
}
