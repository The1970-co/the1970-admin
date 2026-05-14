"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { getBranches, type BranchItem } from "@/lib/products-api";
import { getInventoryMovements, type InventoryMovement } from "@/lib/inventory-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getTokenFromStorage } from "@/lib/current-user";

const ALL_VALUE = "ALL";
const UNMAPPED_ACTOR_VALUE = "__UNMAPPED_ACTOR__";

type InventoryActorOption = {
  id: string;
  label: string;
  name?: string | null;
  email?: string | null;
  type?: string | null;
  branchId?: string | null;
};

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple";
type DirectionFilter = "ALL" | "IN" | "OUT" | "ZERO";

type InventoryMovementV2 = InventoryMovement & {
  created_at?: string | Date | null;
  updatedAt?: string | Date | null;
  updated_at?: string | Date | null;
  movedAt?: string | Date | null;
  movementAt?: string | Date | null;
  happenedAt?: string | Date | null;
  time?: string | Date | null;

  branchName?: string | null;
  productCode?: string | null;
  barcode?: string | null;
  variantName?: string | null;

  refCode?: string | null;
  referenceCode?: string | null;
  orderCode?: string | null;
  purchaseReceiptCode?: string | null;
  purchaseCode?: string | null;
  stocktakeCode?: string | null;
  stocktakeSessionCode?: string | null;
  stockTransferCode?: string | null;
  returnCode?: string | null;
  shipmentCode?: string | null;

  sourceType?: string | null;
  sourceCode?: string | null;
  status?: string | null;
  movementStatus?: string | null;

  beforeQty?: number | null;
  afterQty?: number | null;
  fromQty?: number | null;
  toQty?: number | null;
  availableBefore?: number | null;
  availableAfter?: number | null;
  reservedBefore?: number | null;
  reservedAfter?: number | null;
  incomingBefore?: number | null;
  incomingAfter?: number | null;

  costPrice?: number | null;
  unitCost?: number | null;
  salePrice?: number | null;
  totalCost?: number | null;

  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  staffEmail?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;

  metadata?: Record<string, any> | null;
  meta?: Record<string, any> | null;

  createdBy?: {
    id?: string | null;
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  actor?: {
    id?: string | null;
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  staff?: {
    id?: string | null;
    name?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
  user?: {
    id?: string | null;
    name?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
};

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
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
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function getMeta(row: InventoryMovementV2) {
  return row.metadata || row.meta || {};
}

function getNestedValue(source: any, paths: string[]) {
  if (!source || typeof source !== "object") return undefined;

  for (const path of paths) {
    const value = path.split(".").reduce((acc: any, key) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[key];
    }, source);

    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }

  return undefined;
}

function isBadDateText(value: any) {
  const text = String(value || "").trim().toLowerCase();
  return !text || text === "invalid date" || text === "null" || text === "undefined" || text === "nan";
}

function firstText(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text && !isBadDateText(text)) return text;
  }

  return "";
}

function firstNumber(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }

  return null;
}

function getMovementDateCandidates(row: InventoryMovementV2) {
  const meta = getMeta(row);

  return [
    row.createdAt,
    row.created_at,
    row.movedAt,
    row.movementAt,
    row.happenedAt,
    row.time,
    row.updatedAt,
    row.updated_at,
    meta.createdAt,
    meta.created_at,
    meta.movedAt,
    meta.movementAt,
    meta.happenedAt,
    meta.time,
    getNestedValue(meta, [
      "audit.createdAt",
      "audit.time",
      "audit.loggedAt",
      "inventory.createdAt",
      "movement.createdAt",
      "movement.time",
      "order.createdAt",
      "purchaseReceipt.createdAt",
      "stocktakeSession.createdAt",
      "stockTransfer.createdAt",
    ]),
  ];
}

function getMovementDate(row: InventoryMovementV2) {
  for (const value of getMovementDateCandidates(row)) {
    if (value === undefined || value === null || isBadDateText(value)) continue;
    const date = parseDate(value);
    if (date) return value;
  }

  return "";
}

function getRawTimeDebug(row: InventoryMovementV2) {
  return getMovementDateCandidates(row)
    .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
    .filter(Boolean)
    .join(" | ");
}

function parseDate(value?: string | Date | number | null) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (isBadDateText(text)) return null;

  if (/^\d+$/.test(text)) {
    const num = Number(text);
    if (Number.isFinite(num)) {
      const date = new Date(num > 10_000_000_000 ? num : num * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  // Hỗ trợ BE trả "2026-05-14 13:45:12" không có chữ T.
  const normalized = text.replace(" ", "T");
  const normalizedDate = new Date(normalized);
  if (!Number.isNaN(normalizedDate.getTime())) return normalizedDate;

  // Hỗ trợ chuỗi dd/mm/yyyy hoặc dd/mm/yyyy hh:mm:ss.
  const viMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (viMatch) {
    const [, dd, mm, yyyy, hh = "0", min = "0", sec = "0"] = viMatch;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function formatDateTime(value?: string | Date | null) {
  const date = parseDate(value);
  if (!date) return "Chưa ghi nhận";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateOnlyInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatMoney(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("vi-VN").format(Number(value));
}

function movementLabel(type?: string | null) {
  const key = String(type || "").toUpperCase();

  const labels: Record<string, string> = {
    IMPORT: "Nhập kho",
    SALE: "Bán hàng",
    CANCEL: "Huỷ đơn / hoàn tồn",
    RETURN: "Trả hàng",
    ADJUSTMENT: "Điều chỉnh",
    RESERVE: "Giữ tồn",
    RELEASE: "Huỷ giữ tồn",
    TRANSFER_OUT: "Chuyển kho đi",
    TRANSFER_IN: "Nhận chuyển kho",
    STOCKTAKE: "Kiểm kho",
    STOCKTAKE_ADJUSTMENT: "Chênh lệch kiểm kho",
    PURCHASE_RECEIPT: "Phiếu nhập",
    PURCHASE_IMPORT: "Nhập hàng",
    MANUAL: "Thủ công",
    DAMAGE: "Hàng lỗi",
    LOST: "Thất thoát",
  };

  return labels[key] || key || "Chưa rõ";
}

function refTypeLabel(type?: string | null) {
  const key = String(type || "").toUpperCase();

  const labels: Record<string, string> = {
    ORDER: "Đơn hàng",
    PURCHASE_RECEIPT: "Phiếu nhập hàng",
    STOCKTAKE: "Phiếu kiểm kho",
    STOCKTAKE_SESSION: "Phiên kiểm kho",
    STOCK_TRANSFER: "Phiếu chuyển kho",
    RETURN: "Phiếu trả hàng",
    SHIPMENT: "Phiếu giao hàng",
    MANUAL: "Ghi nhận thủ công",
    ADJUSTMENT: "Phiếu điều chỉnh",
    PRODUCT_IMPORT: "Import sản phẩm",
  };

  return labels[key] || type || "—";
}

function statusLabel(status?: string | null) {
  const key = String(status || "").toUpperCase();

  const labels: Record<string, string> = {
    NEW: "Mới tạo",
    DRAFT: "Nháp",
    PENDING: "Chờ xử lý",
    PROCESSING: "Đang xử lý",
    APPROVED: "Đã duyệt",
    CONFIRMED: "Đã xác nhận",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã huỷ",
    DELETED: "Đã xoá",
    FAILED: "Lỗi",
    IMPORTED: "Đã nhập",
    COUNTED: "Đã kiểm",
    ADJUSTED: "Đã cân kho",
    RECEIVED: "Đã nhận",
    SENT: "Đã gửi",
  };

  return labels[key] || status || "—";
}

function movementTone(type: string, qty: number): Tone {
  const key = String(type || "").toUpperCase();

  if (["SALE", "TRANSFER_OUT", "DAMAGE", "LOST"].includes(key)) return "red";
  if (["CANCEL", "RETURN", "IMPORT", "TRANSFER_IN", "PURCHASE_RECEIPT", "PURCHASE_IMPORT"].includes(key)) return "green";
  if (["ADJUSTMENT", "STOCKTAKE", "STOCKTAKE_ADJUSTMENT"].includes(key)) return "amber";
  if (["RESERVE", "RELEASE"].includes(key)) return "blue";
  if (qty > 0) return "green";
  if (qty < 0) return "red";
  return "gray";
}

function statusTone(status?: string | null): Tone {
  const key = String(status || "").toUpperCase();

  if (["COMPLETED", "CONFIRMED", "APPROVED", "IMPORTED", "RECEIVED", "RECORDED"].includes(key)) return "green";
  if (["CANCELLED", "DELETED", "FAILED"].includes(key)) return "red";
  if (["PENDING", "PROCESSING", "DRAFT", "NEW"].includes(key)) return "amber";

  return "gray";
}

function getReferenceCode(row: InventoryMovementV2) {
  const meta = getMeta(row);

  return firstText(
    row.refCode,
    row.referenceCode,
    row.orderCode,
    row.purchaseReceiptCode,
    row.purchaseCode,
    row.stocktakeCode,
    row.stocktakeSessionCode,
    row.stockTransferCode,
    row.returnCode,
    row.shipmentCode,
    row.sourceCode,
    meta.refCode,
    meta.referenceCode,
    meta.orderCode,
    meta.purchaseReceiptCode,
    meta.purchaseCode,
    meta.stocktakeCode,
    meta.stocktakeSessionCode,
    meta.stockTransferCode,
    meta.returnCode,
    meta.shipmentCode,
    meta.sourceCode,
    row.refId
  );
}

function getActorLabel(row: InventoryMovementV2) {
  const meta = getMeta(row);

  return firstText(
    row.createdByName,
    row.actorName,
    row.staffName,
    row.userName,
    row.createdBy?.fullName,
    row.createdBy?.name,
    row.actor?.fullName,
    row.actor?.name,
    row.staff?.fullName,
    row.staff?.name,
    row.user?.fullName,
    row.user?.name,
    meta.createdByName,
    meta.actorName,
    meta.staffName,
    meta.userName,
    getNestedValue(meta, [
      "createdBy.fullName",
      "createdBy.name",
      "actor.fullName",
      "actor.name",
      "staff.fullName",
      "staff.name",
      "user.fullName",
      "user.name",
      "order.createdByStaffName",
      "order.assignedStaffName",
      "purchaseReceipt.createdBy.name",
      "stockTransfer.createdByName",
      "stockTransfer.confirmedByName",
      "stocktakeWorker.name",
    ]),
    row.createdByEmail,
    row.actorEmail,
    row.staffEmail,
    row.userEmail,
    row.createdBy?.email,
    row.actor?.email,
    row.staff?.email,
    row.user?.email,
    meta.createdByEmail,
    meta.actorEmail,
    meta.staffEmail,
    meta.userEmail,
    getNestedValue(meta, [
      "createdBy.email",
      "actor.email",
      "staff.email",
      "user.email",
      "purchaseReceipt.createdBy.email",
    ]),
    row.createdById,
    row.actorId,
    row.staffId,
    row.userId,
    row.createdBy?.id,
    row.actor?.id,
    row.staff?.id,
    row.user?.id,
    meta.createdById,
    meta.actorId,
    meta.staffId,
    meta.userId,
    getNestedValue(meta, [
      "order.createdByStaffId",
      "order.assignedStaffId",
      "purchaseReceipt.createdById",
      "stockTransfer.createdById",
      "stockTransfer.confirmedById",
      "stocktakeSession.createdById",
    ])
  );
}

function getStatus(row: InventoryMovementV2) {
  const meta = getMeta(row);
  const explicitStatus = firstText(
    row.status,
    row.movementStatus,
    meta.status,
    meta.movementStatus,
    getNestedValue(meta, ["order.status", "purchaseReceipt.status", "stocktakeSession.status", "stockTransfer.status"])
  );

  if (explicitStatus) return explicitStatus;

  const type = String(row.type || "").toUpperCase();
  if (["SALE", "CANCEL", "RETURN", "IMPORT", "TRANSFER_IN", "TRANSFER_OUT", "STOCKTAKE", "STOCKTAKE_ADJUSTMENT"].includes(type)) {
    return "RECORDED";
  }

  return "";
}

function getRefType(row: InventoryMovementV2) {
  const meta = getMeta(row);
  return firstText(row.refType, row.sourceType, meta.refType, meta.sourceType, meta.referenceType);
}

function getBeforeQty(row: InventoryMovementV2) {
  const meta = getMeta(row);
  return firstNumber(row.beforeQty, row.fromQty, row.availableBefore, meta.beforeQty, meta.fromQty, meta.availableBefore);
}

function getAfterQty(row: InventoryMovementV2) {
  const meta = getMeta(row);
  return firstNumber(row.afterQty, row.toQty, row.availableAfter, meta.afterQty, meta.toQty, meta.availableAfter);
}

function getBranchText(row: InventoryMovementV2, branches: BranchItem[]) {
  const meta = getMeta(row);
  const branchName = firstText(row.branchName, meta.branchName);
  if (branchName) return branchName;

  if (!row.branchId) return "";
  return branches.find((branch) => branch.id === row.branchId)?.name || row.branchId;
}

function rowSearchBlob(row: InventoryMovementV2, branches: BranchItem[]) {
  const meta = getMeta(row);

  return [
    row.sku,
    row.productName,
    row.productCode,
    row.barcode,
    row.color,
    row.size,
    row.variantName,
    row.type,
    movementLabel(row.type),
    getRefType(row),
    refTypeLabel(getRefType(row)),
    row.refId,
    getReferenceCode(row),
    row.note,
    getActorLabel(row),
    getStatus(row),
    getBranchText(row, branches),
    meta.note,
    meta.reason,
    meta.orderCode,
    meta.purchaseReceiptCode,
    meta.stocktakeSessionCode,
    meta.stockTransferCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getUniqueOptions(rows: InventoryMovementV2[], getter: (row: InventoryMovementV2) => string) {
  return Array.from(new Set(rows.map(getter).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi"));
}

export default function InventoryLogsPageClient() {
  const [rows, setRows] = useState<InventoryMovementV2[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [actorDirectory, setActorDirectory] = useState<InventoryActorOption[]>([]);
  const [loadingActors, setLoadingActors] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_VALUE);
  const [branchFilter, setBranchFilter] = useState<string>(ALL_VALUE);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const [refTypeFilter, setRefTypeFilter] = useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [actorFilter, setActorFilter] = useState(ALL_VALUE);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setRole(currentUser.role as AppRole);
    setCurrentBranchId(currentUser.branchId || null);

    if (currentUser.role !== "admin" && currentUser.role !== "owner" && currentUser.branchId) {
      setBranchFilter(currentUser.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";

  function getPermissionKeys() {
    const currentUser = getCurrentUserFromStorage();
    const keys = new Set<string>();

    if (Array.isArray((currentUser as any)?.permissions)) {
      (currentUser as any).permissions.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray((currentUser as any)?.permissionKeys)) {
      (currentUser as any).permissionKeys.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray((currentUser as any)?.branchPermissions)) {
      (currentUser as any).branchPermissions.forEach((row: any) => {
        if (Array.isArray(row?.permissionKeys)) {
          row.permissionKeys.forEach((key: any) => {
            if (key) keys.add(String(key));
          });
        }
      });
    }

    return keys;
  }

  function can(permission: string) {
    if (isOwner) return true;
    const keys = getPermissionKeys();
    return keys.has("*") || keys.has(permission) || hasPermission(role, permission as any);
  }

  const canViewLogs = can("inventory.logs.view");

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const data = await getBranches();
        setBranches(data);
      } finally {
        setLoadingBranches(false);
      }
    };

    void loadBranches();
  }, []);

  useEffect(() => {
    const loadActors = async () => {
      try {
        setLoadingActors(true);
        const token = getTokenFromStorage?.();
        const res = await fetch(`${API_BASE}/inventory/movements/actors`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) throw new Error("Không tải được danh sách nhân viên thao tác.");

        const data = await res.json();
        const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setActorDirectory(
          items
            .map((item: any) => {
              const name = firstText(item.label, item.name, item.fullName, item.username, item.email, item.id);
              if (!name) return null;
              return {
                id: String(item.id || name),
                label: String(name),
                name: item.name || item.fullName || item.username || null,
                email: item.email || null,
                type: item.type || item.role || null,
                branchId: item.branchId || null,
              } satisfies InventoryActorOption;
            })
            .filter(Boolean) as InventoryActorOption[]
        );
      } catch {
        // Không chặn màn lịch sử kho nếu API danh bạ nhân viên chưa có.
        setActorDirectory([]);
      } finally {
        setLoadingActors(false);
      }
    };

    if (canViewLogs) void loadActors();
  }, [canViewLogs]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getInventoryMovements();
        setRows(data as InventoryMovementV2[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được lịch sử kho.");
      } finally {
        setLoading(false);
      }
    };

    if (canViewLogs) {
      void load();
    }
  }, [canViewLogs]);

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const scopedRows = useMemo(() => {
    const base = isOwner ? rows : rows.filter((row) => row.branchId && row.branchId === currentBranchId);

    return [...base].sort((a, b) => {
      const dateA = parseDate(getMovementDate(a))?.getTime() || 0;
      const dateB = parseDate(getMovementDate(b))?.getTime() || 0;
      return dateB - dateA;
    });
  }, [rows, isOwner, currentBranchId]);

  const typeOptions = useMemo(() => getUniqueOptions(scopedRows, (row) => row.type), [scopedRows]);
  const refTypeOptions = useMemo(() => getUniqueOptions(scopedRows, (row) => getRefType(row)), [scopedRows]);
  const statusOptions = useMemo(() => getUniqueOptions(scopedRows, (row) => getStatus(row)), [scopedRows]);
  const actorOptions = useMemo(() => {
    const map = new Map<string, InventoryActorOption>();

    const push = (item: Partial<InventoryActorOption> | string | null | undefined) => {
      if (!item) return;
      const label = typeof item === "string" ? item : firstText(item.label, item.name, item.email, item.id);
      if (!label || label === "Chưa ghi nhận") return;
      const key = String(label).trim();
      if (!key || map.has(key)) return;
      map.set(key, {
        id: typeof item === "string" ? key : String(item.id || key),
        label: key,
        name: typeof item === "string" ? key : item.name || null,
        email: typeof item === "string" ? null : item.email || null,
        type: typeof item === "string" ? null : item.type || null,
        branchId: typeof item === "string" ? null : item.branchId || null,
      });
    };

    actorDirectory.forEach(push);
    getUniqueOptions(scopedRows, (row) => getActorLabel(row)).forEach(push);

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [actorDirectory, scopedRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return scopedRows.filter((row) => {
      const rowDate = parseDate(getMovementDate(row));
      const rowTime = rowDate?.getTime() || null;

      const matchQuery = !q || rowSearchBlob(row, branches).includes(q);
      const matchType = typeFilter === ALL_VALUE || row.type === typeFilter;
      const matchBranch = branchFilter === ALL_VALUE ? true : row.branchId === branchFilter;
      const matchRefType = refTypeFilter === ALL_VALUE || getRefType(row) === refTypeFilter;
      const matchStatus = statusFilter === ALL_VALUE || getStatus(row) === statusFilter;
      const rowActor = getActorLabel(row);
      const matchActor =
        actorFilter === ALL_VALUE ||
        (actorFilter === UNMAPPED_ACTOR_VALUE ? !rowActor : rowActor === actorFilter);

      const matchDirection =
        directionFilter === "ALL" ||
        (directionFilter === "IN" && row.qty > 0) ||
        (directionFilter === "OUT" && row.qty < 0) ||
        (directionFilter === "ZERO" && row.qty === 0);

      const matchFrom = !from || (rowTime !== null && rowTime >= from);
      const matchTo = !to || (rowTime !== null && rowTime <= to);

      return (
        matchQuery &&
        matchType &&
        matchBranch &&
        matchRefType &&
        matchStatus &&
        matchActor &&
        matchDirection &&
        matchFrom &&
        matchTo
      );
    });
  }, [
    scopedRows,
    query,
    branches,
    typeFilter,
    branchFilter,
    directionFilter,
    refTypeFilter,
    statusFilter,
    actorFilter,
    fromDate,
    toDate,
  ]);

  const totalIn = filtered.filter((r) => r.qty > 0).reduce((sum, r) => sum + r.qty, 0);
  const totalOut = Math.abs(filtered.filter((r) => r.qty < 0).reduce((sum, r) => sum + r.qty, 0));
  const adjustmentRows = filtered.filter((r) => String(r.type || "").toUpperCase().includes("ADJUSTMENT")).length;
  const missingTimeRows = filtered.filter((r) => !parseDate(getMovementDate(r))).length;
  const mappedActorRows = filtered.filter((r) => Boolean(getActorLabel(r))).length;
  const missingActorRows = filtered.length - mappedActorRows;

  const branchOptions = useMemo(() => {
    const scoped = visibleBranches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));

    if (isOwner) {
      return [{ value: ALL_VALUE, label: "Tất cả chi nhánh" }, ...scoped];
    }

    return scoped;
  }, [visibleBranches, isOwner]);

  function clearFilters() {
    setQuery("");
    setTypeFilter(ALL_VALUE);
    setDirectionFilter("ALL");
    setRefTypeFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
    setActorFilter(ALL_VALUE);
    setFromDate("");
    setToDate("");
    if (isOwner) setBranchFilter(ALL_VALUE);
  }

  function setToday() {
    const today = formatDateOnlyInput(new Date());
    setFromDate(today);
    setToDate(today);
  }

  function setLast7Days() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    setFromDate(formatDateOnlyInput(start));
    setToDate(formatDateOnlyInput(end));
  }

  if (!canViewLogs) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">Role hiện tại không có quyền xem lịch sử kho.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-neutral-900 bg-neutral-950 shadow-sm">
        <div className="flex flex-col gap-5 p-6 text-white lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-neutral-200">
              Lịch sử kho hàng V5 · Lọc nhân viên
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">Lịch sử kho hàng</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              Theo dõi thời gian ghi nhận, trạng thái, chứng từ, tồn trước/sau và nhân viên thao tác của từng biến động kho.
              Các dòng cũ chưa có actor sẽ được tách riêng để dễ kiểm tra backend.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={setToday}
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={setLast7Days}
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              7 ngày gần nhất
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
            >
              Xoá bộ lọc
            </button>
          </div>
        </div>

        <div className="grid border-t border-white/10 bg-white/[0.03] text-white md:grid-cols-4">
          <div className="border-white/10 p-4 md:border-r">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Dòng đang xem</p>
            <p className="mt-1 text-2xl font-semibold">{filtered.length}</p>
          </div>
          <div className="border-white/10 p-4 md:border-r">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Đã map nhân viên</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{mappedActorRows}</p>
          </div>
          <div className="border-white/10 p-4 md:border-r">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Chưa map nhân viên</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">{missingActorRows}</p>
          </div>
          <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Thiếu thời gian</p>
            <p className="mt-1 text-2xl font-semibold text-red-300">{missingTimeRows}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng dòng log</p>
          <h3 className="mt-2 text-2xl font-semibold">{filtered.length}</h3>
          <p className="mt-2 text-xs text-neutral-500">
            {isOwner
              ? "Toàn hệ thống"
              : `Scope: ${visibleBranches.map((b) => b.name).join(", ") || "Chưa gán chi nhánh"}`}
          </p>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng cộng kho</p>
          <h3 className="mt-2 text-2xl font-semibold text-green-700">+{totalIn}</h3>
          <p className="mt-2 text-xs text-neutral-500">Nhập / hoàn / điều chỉnh tăng</p>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng trừ kho</p>
          <h3 className="mt-2 text-2xl font-semibold text-red-700">-{totalOut}</h3>
          <p className="mt-2 text-xs text-neutral-500">Bán / chuyển / điều chỉnh giảm</p>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Dòng điều chỉnh</p>
          <h3 className="mt-2 text-2xl font-semibold text-amber-700">{adjustmentRows}</h3>
          <p className="mt-2 text-xs text-neutral-500">Kiểm kho / cân kho / thủ công</p>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Thiếu thời gian</p>
          <h3 className="mt-2 text-2xl font-semibold text-neutral-900">{missingTimeRows}</h3>
          <p className="mt-2 text-xs text-neutral-500">BE cần trả createdAt chuẩn ISO nếu còn thiếu</p>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 xl:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr]">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm SKU, sản phẩm, mã đơn, mã phiếu nhập, mã kiểm kho, nhân viên, ghi chú..."
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value={ALL_VALUE}>Tất cả loại biến động</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {movementLabel(type)} ({type})
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
          >
            <option value="ALL">Tất cả chiều biến động</option>
            <option value="IN">Cộng kho</option>
            <option value="OUT">Trừ kho</option>
            <option value="ZERO">Không đổi số lượng</option>
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={!isOwner && !loadingBranches}
          >
            {branchOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={refTypeFilter}
            onChange={(e) => setRefTypeFilter(e.target.value)}
          >
            <option value={ALL_VALUE}>Tất cả nguồn chứng từ</option>
            {refTypeOptions.map((type) => (
              <option key={type} value={type}>
                {refTypeLabel(type)} ({type})
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value={ALL_VALUE}>Tất cả trạng thái</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
          >
            <option value={ALL_VALUE}>Tất cả nhân viên thao tác{loadingActors ? " · đang tải" : ""}</option>
            <option value={UNMAPPED_ACTOR_VALUE}>Chưa map nhân viên ({missingActorRows})</option>
            {actorOptions.map((actor) => (
              <option key={actor.id || actor.label} value={actor.label}>
                {actor.label}{actor.type ? ` · ${actor.type}` : ""}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <input
            type="date"
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <div className="flex items-center justify-end whitespace-nowrap text-sm text-neutral-500">
            {filtered.length} dòng
          </div>
        </div>
      </Panel>

      {missingTimeRows > 0 ? (
        <Panel className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-1 text-sm text-amber-900">
            <p className="font-semibold">Còn {missingTimeRows} dòng chưa có thời gian ghi nhận từ backend.</p>
            <p>V4 đã bỏ qua giá trị rác như Invalid Date và dò thêm các trường createdAt / movementAt / movedAt / happenedAt trong metadata. Nếu vẫn hiện “Chưa ghi nhận” thì API đang không trả thời gian thật cho dòng đó.</p>
          </div>
        </Panel>
      ) : null}


      {missingActorRows > 0 ? (
        <Panel className="border-orange-200 bg-orange-50 p-4">
          <div className="flex flex-col gap-1 text-sm text-orange-900">
            <p className="font-semibold">Còn {missingActorRows} dòng chưa map được nhân viên thao tác.</p>
            <p>
              V5 đã tách danh sách nhân viên thao tác thành API riêng để dropdown luôn có nhân viên cho chọn, kể cả khi log cũ chưa map actor. Các dòng chưa map vẫn lọc riêng được bằng lựa chọn “Chưa map nhân viên”.
            </p>
          </div>
        </Panel>
      ) : null}
      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-neutral-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-medium text-neutral-900">Bảng lịch sử biến động chi tiết</p>
            <p className="mt-1 text-sm text-neutral-500">
              Dòng mới nhất ở trên cùng. Bấm vào một dòng để mở chi tiết chứng từ, tồn trước/sau và người thao tác. Bộ lọc nhân viên hỗ trợ cả dòng chưa map.
            </p>
          </div>
          <Badge tone="blue">V5 · Audit view</Badge>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">Đang tải lịch sử kho...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">Không có dòng lịch sử kho phù hợp bộ lọc.</div>
          ) : (
            <table className="min-w-[1500px] text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Thời gian ghi nhận</th>
                  <th className="px-4 py-3 font-medium">Chi nhánh</th>
                  <th className="px-4 py-3 font-medium">SKU / Barcode</th>
                  <th className="px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium">Phân loại</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">SL</th>
                  <th className="px-4 py-3 font-medium">Tồn trước → sau</th>
                  <th className="px-4 py-3 font-medium">Nguồn chứng từ</th>
                  <th className="px-4 py-3 font-medium">Mã chứng từ</th>
                  <th className="px-4 py-3 font-medium">Nhân viên thao tác</th>
                  <th className="px-4 py-3 font-medium">Ghi chú</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row) => {
                  const isExpanded = expandedId === row.id;
                  const beforeQty = getBeforeQty(row);
                  const afterQty = getAfterQty(row);
                  const refCode = getReferenceCode(row);
                  const actor = getActorLabel(row);
                  const status = getStatus(row);
                  const meta = getMeta(row);

                  return (
                    <Fragment key={row.id}>
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-neutral-200 hover:bg-neutral-50"
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-neutral-900">{formatDateTime(getMovementDate(row))}</div>
                          <div className="mt-1 text-xs text-neutral-400">ID: {row.id?.slice?.(0, 10) || "—"}</div>
                        </td>

                        <td className="px-4 py-3">
                          {getBranchText(row, branches) ? (
                            getBranchText(row, branches)
                          ) : (
                            <Badge tone="gray">Chưa map</Badge>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{row.sku || "—"}</div>
                          <div className="mt-1 text-xs text-neutral-500">{row.barcode || row.productCode || "—"}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[260px] font-medium text-neutral-900">{row.productName || "—"}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div>{row.variantName || `${row.color || "—"} / ${row.size || "—"}`}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1.5">
                            <Badge tone={movementTone(row.type, row.qty)}>{movementLabel(row.type)}</Badge>
                            {status ? <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge> : null}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={row.qty >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
                            {row.qty > 0 ? `+${row.qty}` : row.qty}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {beforeQty !== null || afterQty !== null ? (
                            <span>
                              {beforeQty ?? "—"} <span className="text-neutral-400">→</span> {afterQty ?? "—"}
                            </span>
                          ) : (
                            <span className="text-neutral-400">Chưa có snapshot</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div>{refTypeLabel(getRefType(row))}</div>
                          <div className="mt-1 text-xs text-neutral-400">{getRefType(row) || "—"}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[180px] break-all font-medium text-neutral-900">{refCode || "—"}</div>
                          {row.refId && row.refId !== refCode ? (
                            <div className="mt-1 text-xs text-neutral-400">Ref ID: {row.refId}</div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          {actor ? (
                            <div className="max-w-[190px] font-medium text-neutral-900">{actor}</div>
                          ) : (
                            <Badge tone="amber">Chưa map</Badge>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[260px]">{row.note || meta.reason || "—"}</div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr key={`${row.id}-detail`} className="border-t border-neutral-200 bg-neutral-50/70">
                          <td colSpan={12} className="px-5 py-4">
                            <div className="grid gap-4 lg:grid-cols-4">
                              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Chứng từ</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <p><span className="text-neutral-500">Nguồn:</span> {refTypeLabel(getRefType(row))}</p>
                                  <p><span className="text-neutral-500">Mã:</span> {refCode || "—"}</p>
                                  <p><span className="text-neutral-500">Ref ID:</span> {row.refId || "—"}</p>
                                  <p><span className="text-neutral-500">Trạng thái:</span> {status ? statusLabel(status) : "—"}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Snapshot tồn kho</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <p><span className="text-neutral-500">Tồn bán trước:</span> {firstNumber(row.availableBefore, meta.availableBefore) ?? "—"}</p>
                                  <p><span className="text-neutral-500">Tồn bán sau:</span> {firstNumber(row.availableAfter, meta.availableAfter) ?? "—"}</p>
                                  <p><span className="text-neutral-500">Đang giữ trước/sau:</span> {firstNumber(row.reservedBefore, meta.reservedBefore) ?? "—"} → {firstNumber(row.reservedAfter, meta.reservedAfter) ?? "—"}</p>
                                  <p><span className="text-neutral-500">Đang về trước/sau:</span> {firstNumber(row.incomingBefore, meta.incomingBefore) ?? "—"} → {firstNumber(row.incomingAfter, meta.incomingAfter) ?? "—"}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Giá trị</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <p><span className="text-neutral-500">Giá vốn:</span> {formatMoney(firstNumber(row.costPrice, row.unitCost, meta.costPrice, meta.unitCost))}</p>
                                  <p><span className="text-neutral-500">Giá bán:</span> {formatMoney(firstNumber(row.salePrice, meta.salePrice))}</p>
                                  <p><span className="text-neutral-500">Tổng giá vốn:</span> {formatMoney(firstNumber(row.totalCost, meta.totalCost))}</p>
                                  <p><span className="text-neutral-500">Số lượng:</span> {row.qty > 0 ? `+${row.qty}` : row.qty}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Audit</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <p><span className="text-neutral-500">Nhân viên:</span> {actor || "Chưa map từ backend"}</p>
                                  <p><span className="text-neutral-500">Thời gian:</span> {formatDateTime(getMovementDate(row))}</p>
                                  <p><span className="text-neutral-500">Raw time BE:</span> {getRawTimeDebug(row) || "BE chưa trả"}</p>
                                  <p><span className="text-neutral-500">Chi nhánh:</span> {getBranchText(row, branches) || "—"}</p>
                                  <p><span className="text-neutral-500">Ghi chú:</span> {row.note || meta.reason || "—"}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
