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
    const savedSessionId = localStorage.getItem(STORAGE_SESSION_ID) || "";
    const savedWorkerId = localStorage.getItem(STORAGE_WORKER_ID) || "";
    const savedBranchId = localStorage.getItem(STORAGE_BRANCH_ID) || "";
    if (savedBranchId) setBranchId(savedBranchId);
    setSessionIdInput(savedSessionId);
    setWorkerId(savedWorkerId);
    if (savedSessionId) void loadSession(savedSessionId, savedWorkerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = hasStocktakePermission(currentUser, "stocktake.create");
  const canImport = hasStocktakePermission(currentUser, "stocktake.scan") || hasStocktakePermission(currentUser, "stocktake.edit") || hasStocktakePermission(currentUser, "stocktake.create");
  const canApply = hasStocktakePermission(currentUser, "stocktake.apply");
  const selectedWorker = useMemo(() => (session?.workers || []).find((item) => item.id === workerId) || null, [session?.workers, workerId]);
  const paused = isPausedStatus(session?.status);
  const closed = isClosedStatus(session?.status);
  const selectedBranchName = branches.find((branch) => branch.id === (session?.branchId || branchId))?.name || session?.branchId || branchId || "—";

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
      const snapshot = Number(item?.snapshotQty ?? item?.system ?? row.systemQty ?? 0);
      const diff = typeof item?.diff === "number" ? Number(item.diff) : counted - snapshot;
      const status = !item?.variantId ? "NOT_FOUND" : diff === 0 ? "MATCH" : "MISMATCH";
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

  async function loadSummary(targetSessionId: string, targetWorkerId?: string) {
    if (!targetSessionId) return;

    try {
      const path = targetWorkerId
        ? `/stocktake-sessions/${targetSessionId}/workers/${targetWorkerId}/summary`
        : `/stocktake-sessions/${targetSessionId}/summary`;
      const data = await apiRequest<SummaryItem[]>(path);
      setSummary(Array.isArray(data) ? data : []);
    } catch {
      setSummary([]);
    }
  }

  async function loadSession(targetSessionId?: string, preferredWorkerId?: string) {
    const finalSessionId = (targetSessionId || sessionIdInput).trim();
    if (!finalSessionId) {
      setMessage("Chưa có session ID. Có thể tạo phiên Excel mới ở bước 1.");
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
      await loadSummary(data.id, nextWorkerId);
      setMessage("Đã tải phiên kiểm. Có thể upload Excel hoặc xác nhận chốt nếu đã import xong.");
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
    await loadSummary(session.id, workerId || undefined);
  }

  async function importRows() {
    if (!canImport) {
      setMessage("Bạn không có quyền upload/ghi số lượng kiểm kho.");
      return;
    }
    if (!session?.id || !workerId) {
      setMessage("Cần có phiên kiểm và phiên con/máy scan trước khi import.");
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
              workerId,
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

      saveResumeState({ sessionId: session.id, workerId, branchId: session.branchId });
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
    if (!summary.length) {
      setMessage("Chưa có dữ liệu đã ghi vào phiên. Upload Excel trước rồi mới xác nhận.");
      return;
    }
    if (closed) {
      setMessage("Phiên đã đóng hoặc đã chốt tồn rồi.");
      return;
    }

    await loadSummary(session.id, workerId || undefined);

    const payloadRows = summary.map((item) => {
      const counted = Number(item.counted ?? item.countedQty ?? 0);
      const system = Number(item.snapshotQty ?? item.system ?? 0);
      const diff = typeof item.diff === "number" ? Number(item.diff) : counted - system;
      const status: StocktakeRowStatus = !item.variantId ? "NOT_FOUND" : diff === 0 ? "MATCH" : "MISMATCH";
      return {
        variantId: item.variantId || undefined,
        sku: item.sku,
        counted,
        system,
        diff,
        status,
        reason: status === "MATCH" ? "" : "Khác",
        note: file?.name ? `Chốt từ Excel: ${file.name}` : "Chốt từ trang upload Excel",
      };
    });

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
    <div className="min-h-screen space-y-5 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/stocktake" className="text-sm font-bold text-neutral-500 hover:text-neutral-950">← Quay lại kiểm kho realtime</Link>
            <Badge tone="blue">Excel</Badge>
            {session ? <Badge tone={closed ? "red" : paused ? "amber" : "green"}>{statusLabel(session.status)}</Badge> : null}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-neutral-950">Upload Excel kiểm kho</h1>
          <p className="mt-1 text-sm text-neutral-500">Flow đầy đủ: tạo/chọn phiên tổng → upload Excel → so sánh snapshot → xác nhận kiểm kho → tự cập nhật tồn và lưu lịch sử.</p>
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

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-neutral-950">1. Tạo hoặc chọn phiên kiểm</h2>
                <p className="mt-1 text-sm text-neutral-500">Phiên tạo từ đây sẽ hiện ở Lịch sử kiểm kho như phiên scan realtime.</p>
              </div>
              <Badge tone={closed ? "red" : paused ? "amber" : session ? "green" : "gray"}>{statusLabel(session?.status)}</Badge>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block text-sm font-bold text-neutral-700">
                Chi nhánh
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={Boolean(session && !closed)} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-neutral-100">
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.id}</option>)}
                  {!branches.length ? <option value={branchId}>{branchId || "Chưa có chi nhánh"}</option> : null}
                </select>
              </label>

              <label className="block text-sm font-bold text-neutral-700">
                Tên phiên
                <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} disabled={Boolean(session && !closed)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-neutral-100" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-bold text-neutral-700">
                  Người kiểm
                  <input value={workerName} onChange={(e) => setWorkerName(e.target.value)} disabled={Boolean(session && !closed)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-neutral-100" />
                </label>
                <label className="block text-sm font-bold text-neutral-700">
                  Khu kiểm
                  <input value={workerZone} onChange={(e) => setWorkerZone(e.target.value)} disabled={Boolean(session && !closed)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-neutral-100" />
                </label>
              </div>

              <button type="button" onClick={() => void createExcelSession()} disabled={creatingSession || !canCreate || Boolean(session && !closed)} className="rounded-xl bg-neutral-950 px-4 py-3 text-sm font-extrabold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
                {creatingSession ? "Đang tạo phiên..." : "Tạo phiên kiểm Excel"}
              </button>
            </div>

            <div className="mt-5 border-t border-neutral-100 pt-4">
              <label className="block text-sm font-bold text-neutral-700">
                Hoặc dán Session ID có sẵn
                <input value={sessionIdInput} onChange={(e) => setSessionIdInput(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500" placeholder="Dán session ID nếu cần" />
              </label>
              <button type="button" onClick={() => void loadSession()} disabled={loadingSession} className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-extrabold text-neutral-800 hover:bg-neutral-50 disabled:bg-neutral-100">
                {loadingSession ? "Đang tải phiên..." : "Tải / đổi phiên kiểm"}
              </button>
            </div>

            {session ? (
              <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm">
                <p className="font-extrabold text-neutral-950">{session.name || "Phiên kiểm kho"}</p>
                <p className="mt-1 font-mono text-xs text-neutral-500">{session.id}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-neutral-600">
                  <div>Chi nhánh: <span className="text-neutral-950">{selectedBranchName}</span></div>
                  <div>Trạng thái: <span className="text-neutral-950">{statusLabel(session.status)}</span></div>
                </div>

                <label className="mt-4 block text-sm font-bold text-neutral-700">
                  Phiên con / máy ghi dữ liệu
                  <select value={workerId} onChange={(e) => { setWorkerId(e.target.value); saveResumeState({ sessionId: session.id, workerId: e.target.value, branchId: session.branchId }); void loadSummary(session.id, e.target.value); }} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                    {(session.workers || []).length ? (session.workers || []).map((worker) => (
                      <option key={worker.id} value={worker.id}>{worker.name || worker.id}{worker.zone ? ` · ${worker.zone}` : ""}{worker.deviceName ? ` · ${worker.deviceName}` : ""}</option>
                    )) : <option value="">Chưa có phiên con</option>}
                  </select>
                </label>
              </div>
            ) : null}
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

            <button type="button" onClick={() => void importRows()} disabled={!session || !workerId || paused || closed || importing || !rows.length || !canImport} className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
              {importing ? "Đang import Excel..." : "Ghi Excel vào phiên kiểm"}
            </button>

            <p className="mt-3 text-xs font-semibold text-blue-900/70">Sau khi ghi, bảng bên phải sẽ so sánh số Excel với snapshot đầu phiên của hệ thống.</p>
          </Panel>

          <Panel className="border-red-100 bg-red-50/60">
            <h2 className="text-lg font-extrabold text-red-950">4. Xác nhận kiểm kho</h2>
            <p className="mt-1 text-sm font-medium text-red-800/80">Bước này mới cập nhật tồn thật. Có thể kiểm tra preview và lệch trước khi bấm.</p>
            <button type="button" onClick={() => void confirmAndApplySession()} disabled={!session || closed || confirming || importing || !summary.length || !canApply} className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300">
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
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-neutral-500">Chưa có dữ liệu. Tạo/chọn phiên rồi upload Excel để xem so sánh.</td></tr>
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
  );
}
