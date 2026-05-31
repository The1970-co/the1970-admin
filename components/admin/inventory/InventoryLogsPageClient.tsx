"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { getBranches, type BranchItem } from "@/lib/products-api";
import { getInventoryMovements, type InventoryMovement } from "@/lib/inventory-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getTokenFromStorage } from "@/lib/current-user";

const ALL_VALUE = "ALL";
const UNMAPPED_ACTOR_VALUE = "__UNMAPPED_ACTOR__";
const INVENTORY_LOG_FETCH_LIMIT = 50000;
const VISIBLE_LIMIT_OPTIONS = [50, 100] as const;
const DIRECTION_FILTER_OPTIONS: MultiFilterOption[] = [
  { value: "IN", label: "Cộng kho" },
  { value: "OUT", label: "Trừ kho" },
  { value: "ZERO", label: "Không đổi số lượng" },
];

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
  createdAtIso?: string | Date | null;
  createdAtText?: string | Date | null;
  loggedAt?: string | Date | null;
  recordedAt?: string | Date | null;
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


type MultiFilterOption = {
  value: string;
  label: string;
  count?: number;
};

function MultiFilter({
  label,
  allLabel,
  values,
  options,
  onChange,
  disabled = false,
  loading = false,
}: {
  label: string;
  allLabel: string;
  values: string[];
  options: MultiFilterOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const selectedSet = new Set(values);
  const selectedLabels = values
    .map((value) => options.find((option) => option.value === value)?.label || value)
    .filter(Boolean);
  const summary = selectedLabels.length
    ? selectedLabels.length <= 2
      ? selectedLabels.join(", ")
      : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`
    : allLabel;

  function toggle(value: string) {
    if (disabled) return;
    if (selectedSet.has(value)) {
      onChange(values.filter((item) => item !== value));
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <details className="group relative">
      <summary
        className={`flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition hover:border-neutral-900 ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="min-w-0 truncate">
          <span className="text-neutral-400">{label}: </span>
          <span className="font-medium text-neutral-900">{loading ? "Đang tải..." : summary}</span>
        </span>
        <span className="text-xs text-neutral-400">▾</span>
      </summary>

      <div className="absolute left-0 z-30 mt-2 max-h-72 w-full min-w-[280px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
        <button
          type="button"
          onClick={() => onChange([])}
          className="mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          {allLabel}
        </button>
        <div className="space-y-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={selectedSet.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.count !== undefined ? (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{option.count}</span>
              ) : null}
            </label>
          ))}
        </div>
      </div>
    </details>
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

function normalizeSearchValue(value: any) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchValue(value: any) {
  return normalizeSearchValue(value).replace(/\s+/g, "");
}

function buildSearchTerms(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return [];

  const hasStrongSeparator = /[,;\n\r\t]+/.test(raw);
  const parts = hasStrongSeparator
    ? raw
        .split(/[,;\n\r\t]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [raw];

  // Trường hợp paste một loạt mã cách nhau bằng dấu cách: AP833 QS940 ORD-...
  // Không tách câu tên sản phẩm tiếng Việt có nhiều chữ, để paste nguyên tên vẫn tìm đúng.
  if (!hasStrongSeparator && parts.length === 1) {
    const tokens = raw.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    const codeLikeTokens = tokens.filter((token) =>
      /^[a-z0-9_-]{3,}$/i.test(token) &&
      (/[0-9]/.test(token) || /^(ord|qo|cl|xd|th|ap|qs|sm|sku)/i.test(token)),
    );

    if (tokens.length >= 2 && codeLikeTokens.length === tokens.length) {
      return Array.from(new Set(codeLikeTokens.map(normalizeSearchValue).filter(Boolean)));
    }
  }

  return Array.from(new Set(parts.map(normalizeSearchValue).filter(Boolean)));
}

function rowMatchesSearchTerms(row: InventoryMovementV2, branches: BranchItem[], terms: string[]) {
  if (!terms.length) return true;

  const blob = rowSearchBlob(row, branches);
  const compactBlob = compactSearchValue(blob);

  return terms.some((term) => {
    const normalizedTerm = normalizeSearchValue(term);
    if (!normalizedTerm) return true;

    const compactTerm = compactSearchValue(normalizedTerm);
    if (blob.includes(normalizedTerm)) return true;
    if (compactTerm && compactBlob.includes(compactTerm)) return true;

    const words = normalizedTerm.split(" ").filter(Boolean);
    // Hỗ trợ paste tên sản phẩm đầy đủ nhưng khác dấu/ký tự: chỉ cần toàn bộ từ đều nằm trong blob.
    return words.length >= 2 && words.every((word) => blob.includes(word));
  });
}


function getMovementDateCandidates(row: InventoryMovementV2) {
  const meta = getMeta(row);

  return [
    row.createdAt,
    row.createdAtIso,
    row.createdAtText,
    row.created_at,
    row.loggedAt,
    row.recordedAt,
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
    // Fallback cuối: Prisma CUID có timestamp, dùng để cứu dữ liệu cũ nếu BE chưa trả createdAt.
    row.id,
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

function parseCuidDate(value?: string | null) {
  const text = String(value || "").trim();
  // CUID dạng c + timestamp base36 + phần random. VD: cmp6hjt... có thể suy ra thời điểm tạo log.
  if (!/^c[a-z0-9]{8,}/i.test(text)) return null;

  const timestampText = text.slice(1, 9);
  const timestamp = Number.parseInt(timestampText, 36);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  // Chặn giá trị vô lý để không hiển thị sai nếu ID không phải CUID chuẩn.
  const year = date.getFullYear();
  if (year < 2020 || year > 2100) return null;

  return date;
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

  const cuidDate = parseCuidDate(text);
  if (cuidDate) return cuidDate;

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

  // Hỗ trợ chuỗi dd/mm/yyyy, dd/mm/yyyy hh:mm:ss hoặc dd/mm/yyyy, hh:mm:ss từ BE cũ.
  const cleanViText = text.replace(",", " ").replace(/\s+/g, " ").trim();
  const viMatch = cleanViText.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
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
    RETURN_EXCHANGE: "Đơn đổi / trả hàng",
    GHN_RETURN_RECEIVED: "Nhận hàng hoàn GHN",
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
    RECORDED: "Đã ghi nhận",
    SAVED: "Đã lưu",
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

  if (["COMPLETED", "CONFIRMED", "APPROVED", "IMPORTED", "RECEIVED", "Ghi nhậnED"].includes(key)) return "green";
  if (["CANCELLED", "DELETED", "FAILED"].includes(key)) return "red";
  if (["PENDING", "PROCESSING", "DRAFT", "NEW"].includes(key)) return "amber";

  return "gray";
}

function pickBusinessCodeFromText(...values: any[]) {
  const text = values
    .map((value) => String(value || ""))
    .filter(Boolean)
    .join(" | ");

  const patterns = [
    /\bORD[-_][A-Z0-9-]+\b/i,
    /\bRTN[-_][A-Z0-9-]+\b/i,
    /\bCVK[-_][A-Z0-9-]+\b/i,
    /\bSTK[-_][A-Z0-9-]+\b/i,
    /\bPNK[-_][A-Z0-9-]+\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].toUpperCase();
  }

  return "";
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
    getNestedValue(meta, [
      "order.code",
      "order.orderCode",
      "order.displayCode",
      "order.internalCode",
      "shipment.orderCode",
      "shipment.code",
      "return.orderCode",
      "return.code",
      "returnExchange.code",
      "purchaseReceipt.code",
      "stockTransfer.code",
      "stocktakeSession.code",
      "stocktakeSession.name",
    ]),
    pickBusinessCodeFromText(row.note, meta.note, meta.reason)
  );
}

function getSystemReferenceId(row: InventoryMovementV2) {
  const meta = getMeta(row);
  return firstText(row.refId, meta.refId, meta.referenceId, meta.orderId, meta.stocktakeSessionId, meta.stockTransferId);
}

function shortSystemId(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 14) return text;
  return `${text.slice(0, 10)}…`;
}

function referenceLabelByType(type?: string | null) {
  const key = String(type || "").toUpperCase();

  if (key === "ORDER") return "Mã đơn";
  if (key === "RETURN" || key === "RETURN_EXCHANGE" || key === "GHN_RETURN_RECEIVED") return "Mã đơn/hoàn";
  if (key === "STOCKTAKE" || key === "STOCKTAKE_SESSION") return "Mã kiểm kho";
  if (key === "STOCK_TRANSFER") return "Mã chuyển kho";
  if (key === "PURCHASE_RECEIPT") return "Mã phiếu nhập";
  if (key === "SHIPMENT") return "Mã vận đơn";
  return "Mã nghiệp vụ";
}

function getReferenceDisplay(row: InventoryMovementV2) {
  const refType = getRefType(row);
  const code = getReferenceCode(row);
  const systemId = getSystemReferenceId(row);

  return {
    label: referenceLabelByType(refType),
    code,
    systemId,
    shortSystemId: shortSystemId(systemId),
  };
}

function cleanActorName(value?: string | null) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.;,]+$/g, "")
    .trim();

  if (!text) return "";

  const lowered = normalizeSearchValue(text);
  if (
    ["system", "unknown", "null", "undefined", "chua ghi nhan", "chua ro"].includes(lowered)
  ) {
    return "";
  }

  if (looksLikeSystemId(text)) return "";

  return text;
}

function extractActorNameFromText(...values: any[]) {
  const text = values
    .map((value) => String(value || ""))
    .filter(Boolean)
    .join(" | ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  const patterns: RegExp[] = [
    /(?:Người xác nhận|Nguoi xac nhan|Nhân viên xác nhận|Nhan vien xac nhan|Người thao tác|Nguoi thao tac|Nhân viên thao tác|Nhan vien thao tac|Người kiểm|Nguoi kiem|Người chốt|Nguoi chot|Người tạo|Nguoi tao|Người xử lý|Nguoi xu ly|Người huỷ|Nguoi huy|Người hủy|Nguoi huy|Thực hiện bởi|Thuc hien boi|Xác nhận bởi|Xac nhan boi)\s*:\s*([^|;,]+)/i,
    /(?:Nhân viên|Nhan vien)\s+([^|;,]+?)\s+(?:đã xác nhận|da xac nhan|đã chốt|da chot|đã xử lý|da xu ly)/i,
    /(?:Người xác nhận|Nguoi xac nhan)\s+([^|;,]+?)(?:\s+đã|\s+da|$)/i,
    /(?:confirmedByName|createdByName|actorName|staffName|userName)\s*["'=:\s]+\s*([^"',|;}]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const actor = cleanActorName(match?.[1]);
    if (actor) return actor;
  }

  return "";
}

function getActorLabel(row: InventoryMovementV2) {
  const meta = getMeta(row);
  const parsedActor = extractActorNameFromText(
    row.note,
    meta.note,
    meta.reason,
    meta.description,
    meta.message,
    getNestedValue(meta, [
      "audit.note",
      "audit.message",
      "movement.note",
      "movement.reason",
      "stockTransfer.note",
      "stocktakeSession.note",
      "return.note",
      "order.note",
    ]),
  );

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
    meta.returnReceivedByName,
    meta.confirmedByName,
    meta.createdByStaffName,
    meta.assignedStaffName,
    parsedActor,
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
      "order.createdBy.name",
      "order.createdBy.fullName",
      "purchaseReceipt.createdBy.name",
      "purchaseReceipt.createdBy.fullName",
      "stockTransfer.createdByName",
      "stockTransfer.confirmedByName",
      "stockTransfer.createdBy.name",
      "stockTransfer.confirmedBy.name",
      "stocktakeWorker.name",
      "stocktakeWorker.fullName",
      "stocktakeSession.createdByName",
      "stocktakeSession.confirmedByName",
      "stocktakeSession.staffName",
      "stocktakeSession.workerName",
      "worker.name",
      "worker.fullName",
      "confirmedBy.name",
      "confirmedBy.fullName",
      "handledByStaffName",
      "returnReceivedByName",
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
      "stockTransfer.createdBy.email",
      "stocktakeSession.createdBy.email",
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
    meta.returnReceivedById,
    getNestedValue(meta, [
      "order.createdByStaffId",
      "order.assignedStaffId",
      "order.createdBy.id",
      "purchaseReceipt.createdById",
      "stockTransfer.createdById",
      "stockTransfer.confirmedById",
      "stocktakeSession.createdById",
      "stocktakeSession.confirmedById",
      "stocktakeSession.staffId",
      "stocktakeSession.workerId",
      "stocktakeWorker.id",
      "worker.id",
      "createdBy.id",
      "confirmedBy.id",
      "returnReceivedById",
    ])
  );
}

function getActorIds(row: InventoryMovementV2) {
  const meta = getMeta(row);

  return [
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
    meta.returnReceivedById,
    getNestedValue(meta, [
      "order.createdByStaffId",
      "order.assignedStaffId",
      "order.createdBy.id",
      "purchaseReceipt.createdById",
      "purchaseReceipt.createdBy.id",
      "stockTransfer.createdById",
      "stockTransfer.confirmedById",
      "stockTransfer.createdBy.id",
      "stockTransfer.confirmedBy.id",
      "stocktakeSession.createdById",
      "stocktakeSession.confirmedById",
      "stocktakeSession.staffId",
      "stocktakeSession.workerId",
      "stocktakeWorker.id",
      "worker.id",
      "createdBy.id",
      "confirmedBy.id",
      "returnReceivedById",
    ]),
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function looksLikeSystemId(value?: string | null) {
  const text = String(value || "").trim();
  return /^c[a-z0-9]{8,}$/i.test(text) || /^[0-9a-f]{24}$/i.test(text);
}

function getActorDisplayLabel(row: InventoryMovementV2, actors: InventoryActorOption[]) {
  const rawLabel = cleanActorName(getActorLabel(row));
  const ids = getActorIds(row);

  for (const id of ids) {
    const found = actors.find((actor) => String(actor.id) === String(id));
    if (found?.label) return found.label;
  }

  if (rawLabel) {
    const normalizedRaw = normalizeSearchValue(rawLabel);
    const foundByLabel = actors.find((actor) =>
      normalizeSearchValue(actor.label) === normalizedRaw ||
      normalizeSearchValue(actor.name) === normalizedRaw ||
      normalizeSearchValue(actor.email) === normalizedRaw,
    );
    if (foundByLabel?.label) return foundByLabel.label;

    return rawLabel;
  }

  return "";
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

  const values = [
    row.id,
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
    row.note,
    getActorLabel(row),
    getStatus(row),
    getBranchText(row, branches),
    meta.note,
    meta.reason,
    meta.refCode,
    meta.referenceCode,
    meta.orderCode,
    meta.orderId,
    meta.purchaseReceiptCode,
    meta.purchaseCode,
    meta.stocktakeCode,
    meta.stocktakeSessionCode,
    meta.stockTransferCode,
    meta.returnCode,
    meta.shipmentCode,
    meta.sourceCode,
    getNestedValue(meta, [
      "order.code",
      "order.orderCode",
      "order.id",
      "order.displayCode",
      "order.internalCode",
      "order.externalCode",
      "order.customerPhone",
      "shipment.orderCode",
      "shipment.code",
      "return.orderCode",
      "return.code",
      "purchaseReceipt.code",
      "stockTransfer.code",
      "stocktakeSession.code",
      "stocktakeSession.name",
    ]),
  ];

  return normalizeSearchValue(values.filter(Boolean).join(" "));
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

  // Draft filters: người dùng chọn/gõ trước, chưa chạy lọc ngay.
  const [query, setQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [branchFilters, setBranchFilters] = useState<string[]>([]);
  const [directionFilters, setDirectionFilters] = useState<string[]>([]);
  const [refTypeFilters, setRefTypeFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [actorFilters, setActorFilters] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Applied filters: chỉ cập nhật khi bấm nút Tìm kiếm.
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedTypeFilters, setAppliedTypeFilters] = useState<string[]>([]);
  const [appliedBranchFilters, setAppliedBranchFilters] = useState<string[]>([]);
  const [appliedDirectionFilters, setAppliedDirectionFilters] = useState<string[]>([]);
  const [appliedRefTypeFilters, setAppliedRefTypeFilters] = useState<string[]>([]);
  const [appliedStatusFilters, setAppliedStatusFilters] = useState<string[]>([]);
  const [appliedActorFilters, setAppliedActorFilters] = useState<string[]>([]);
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState<(typeof VISIBLE_LIMIT_OPTIONS)[number]>(50);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setRole(currentUser.role as AppRole);
    setCurrentBranchId(currentUser.branchId || null);

    if (currentUser.role !== "admin" && currentUser.role !== "owner" && currentUser.branchId) {
      setBranchFilters([currentUser.branchId]);
      setAppliedBranchFilters([currentUser.branchId]);
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
        const data = await getInventoryMovements(INVENTORY_LOG_FETCH_LIMIT);
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
    getUniqueOptions(scopedRows, (row) => getActorDisplayLabel(row, actorDirectory)).forEach(push);

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [actorDirectory, scopedRows]);

  const filtered = useMemo(() => {
    const searchTerms = buildSearchTerms(appliedQuery);
    const from = appliedFromDate ? new Date(`${appliedFromDate}T00:00:00`).getTime() : null;
    const to = appliedToDate ? new Date(`${appliedToDate}T23:59:59`).getTime() : null;

    return scopedRows.filter((row) => {
      const rowDate = parseDate(getMovementDate(row));
      const rowTime = rowDate?.getTime() || null;

      const matchQuery = rowMatchesSearchTerms(row, branches, searchTerms);
      const matchType = appliedTypeFilters.length === 0 || appliedTypeFilters.includes(String(row.type || ""));
      const matchBranch = appliedBranchFilters.length === 0 || appliedBranchFilters.includes(String(row.branchId || ""));
      const matchRefType = appliedRefTypeFilters.length === 0 || appliedRefTypeFilters.includes(String(getRefType(row) || ""));
      const matchStatus = appliedStatusFilters.length === 0 || appliedStatusFilters.includes(String(getStatus(row) || ""));
      const rowActor = getActorDisplayLabel(row, actorDirectory);
      const matchActor =
        appliedActorFilters.length === 0 ||
        appliedActorFilters.some((value) =>
          value === UNMAPPED_ACTOR_VALUE ? !rowActor : rowActor === value,
        );

      const matchDirection =
        appliedDirectionFilters.length === 0 ||
        appliedDirectionFilters.some((value) =>
          (value === "IN" && row.qty > 0) ||
          (value === "OUT" && row.qty < 0) ||
          (value === "ZERO" && row.qty === 0),
        );

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
    appliedQuery,
    branches,
    appliedTypeFilters,
    appliedBranchFilters,
    appliedDirectionFilters,
    appliedRefTypeFilters,
    appliedStatusFilters,
    appliedActorFilters,
    actorDirectory,
    appliedFromDate,
    appliedToDate,
  ]);

  const totalIn = filtered.filter((r) => r.qty > 0).reduce((sum, r) => sum + r.qty, 0);
  const totalOut = Math.abs(filtered.filter((r) => r.qty < 0).reduce((sum, r) => sum + r.qty, 0));
  const adjustmentRows = filtered.filter((r) => String(r.type || "").toUpperCase().includes("ADJUSTMENT")).length;
  const uniqueSkuRows = Array.from(new Set(filtered.map((r) => String(r.sku || "").trim()).filter(Boolean))).length;
  const missingActorRows = filtered.filter((r) => !getActorDisplayLabel(r, actorDirectory)).length;

  const branchOptions = useMemo<MultiFilterOption[]>(() => {
    return visibleBranches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));
  }, [visibleBranches]);

  const typeFilterOptions = useMemo<MultiFilterOption[]>(() => {
    return typeOptions.map((type) => ({ value: type, label: `${movementLabel(type)} (${type})` }));
  }, [typeOptions]);

  const refTypeFilterOptions = useMemo<MultiFilterOption[]>(() => {
    return refTypeOptions.map((type) => ({ value: type, label: `${refTypeLabel(type)} (${type})` }));
  }, [refTypeOptions]);

  const statusFilterOptions = useMemo<MultiFilterOption[]>(() => {
    return statusOptions.map((status) => ({ value: status, label: statusLabel(status) }));
  }, [statusOptions]);

  const actorFilterOptions = useMemo<MultiFilterOption[]>(() => {
    return [
      { value: UNMAPPED_ACTOR_VALUE, label: "Chưa ghi nhận nhân viên", count: missingActorRows },
      ...actorOptions.map((actor) => ({
        value: actor.label,
        label: `${actor.label}${actor.type ? ` · ${actor.type}` : ""}`,
      })),
    ];
  }, [actorOptions, missingActorRows]);

  const visibleRows = useMemo(() => {
    return filtered.slice(0, visibleLimit);
  }, [filtered, visibleLimit]);

  function applyFilters() {
    setAppliedQuery(query);
    setAppliedTypeFilters(typeFilters);
    setAppliedDirectionFilters(directionFilters);
    setAppliedRefTypeFilters(refTypeFilters);
    setAppliedStatusFilters(statusFilters);
    setAppliedActorFilters(actorFilters);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedBranchFilters(branchFilters);
    setExpandedId(null);
  }

  function clearFilters() {
    setQuery("");
    setTypeFilters([]);
    setDirectionFilters([]);
    setRefTypeFilters([]);
    setStatusFilters([]);
    setActorFilters([]);
    setFromDate("");
    setToDate("");
    setAppliedQuery("");
    setAppliedTypeFilters([]);
    setAppliedDirectionFilters([]);
    setAppliedRefTypeFilters([]);
    setAppliedStatusFilters([]);
    setAppliedActorFilters([]);
    setAppliedFromDate("");
    setAppliedToDate("");
    if (isOwner) {
      setBranchFilters([]);
      setAppliedBranchFilters([]);
    }
    setExpandedId(null);
  }

  function setToday() {
    const today = formatDateOnlyInput(new Date());
    setFromDate(today);
    setToDate(today);
    setAppliedFromDate(today);
    setAppliedToDate(today);
    setExpandedId(null);
  }

  function setLast7Days() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const startText = formatDateOnlyInput(start);
    const endText = formatDateOnlyInput(end);
    setFromDate(startText);
    setToDate(endText);
    setAppliedFromDate(startText);
    setAppliedToDate(endText);
    setExpandedId(null);
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
              Lịch sử kho hàng V8 · Bộ lọc nâng cao
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">Lịch sử kho hàng</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              Theo dõi đầy đủ nhập, xuất, hoàn, kiểm kho, chứng từ liên quan và nhân viên thao tác của từng biến động kho.
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
            <p className="text-xs uppercase tracking-wide text-neutral-400">Tổng biến động</p>
            <p className="mt-1 text-2xl font-semibold">{filtered.length}</p>
            <p className="mt-1 text-xs text-neutral-500">Theo bộ lọc hiện tại</p>
          </div>
          <div className="border-white/10 p-4 md:border-r">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Nhập / hoàn kho</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">+{totalIn}</p>
            <p className="mt-1 text-xs text-neutral-500">Tổng số lượng cộng kho</p>
          </div>
          <div className="border-white/10 p-4 md:border-r">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Bán / xuất kho</p>
            <p className="mt-1 text-2xl font-semibold text-red-300">-{totalOut}</p>
            <p className="mt-1 text-xs text-neutral-500">Tổng số lượng trừ kho</p>
          </div>
          <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Điều chỉnh / kiểm kho</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">{adjustmentRows}</p>
            <p className="mt-1 text-xs text-neutral-500">Dòng xử lý thủ công</p>
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
              : `Chi nhánh: ${visibleBranches.map((b) => b.name).join(", ") || "Chưa gán chi nhánh"}`}
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
          <p className="text-sm text-neutral-500">Mã hàng liên quan</p>
          <h3 className="mt-2 text-2xl font-semibold text-neutral-900">{uniqueSkuRows}</h3>
          <p className="mt-2 text-xs text-neutral-500">Số SKU phát sinh biến động</p>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr]">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            placeholder="Tìm SKU, tên sản phẩm, mã đơn. Nhập nhiều mã bằng dấu phẩy hoặc xuống dòng..."
          />

          <MultiFilter
            label="Loại"
            allLabel="Tất cả loại biến động"
            values={typeFilters}
            options={typeFilterOptions}
            onChange={setTypeFilters}
          />

          <MultiFilter
            label="Chiều"
            allLabel="Tất cả chiều biến động"
            values={directionFilters}
            options={DIRECTION_FILTER_OPTIONS}
            onChange={setDirectionFilters}
          />

          <MultiFilter
            label="Chi nhánh"
            allLabel="Tất cả chi nhánh"
            values={branchFilters}
            options={branchOptions}
            onChange={setBranchFilters}
            disabled={!isOwner && !loadingBranches}
          />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_0.9fr_1fr_0.75fr_0.75fr_0.75fr_auto_auto]">
          <MultiFilter
            label="Nguồn"
            allLabel="Tất cả nguồn chứng từ"
            values={refTypeFilters}
            options={refTypeFilterOptions}
            onChange={setRefTypeFilters}
          />

          <MultiFilter
            label="Trạng thái"
            allLabel="Tất cả trạng thái"
            values={statusFilters}
            options={statusFilterOptions}
            onChange={setStatusFilters}
          />

          <MultiFilter
            label="Nhân viên"
            allLabel={`Tất cả nhân viên thao tác${loadingActors ? " · đang tải" : ""}`}
            values={actorFilters}
            options={actorFilterOptions}
            onChange={setActorFilters}
            loading={loadingActors}
          />

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

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            value={visibleLimit}
            onChange={(e) => setVisibleLimit(Number(e.target.value) as (typeof VISIBLE_LIMIT_OPTIONS)[number])}
          >
            {VISIBLE_LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>Hiển thị {limit} dòng</option>
            ))}
          </select>

          <button
            type="button"
            onClick={applyFilters}
            className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Tìm kiếm
          </button>

          <div className="flex items-center justify-end whitespace-nowrap text-sm text-neutral-500">
            {Math.min(filtered.length, visibleLimit)} / {filtered.length} dòng
          </div>
        </div>
      </Panel>

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
              Dòng mới nhất ở trên cùng. Bộ lọc chỉ chạy sau khi bấm Tìm kiếm; bảng chỉ render số dòng đã chọn.
            </p>
          </div>
          <Badge tone="blue">V8 · Chi tiết kho</Badge>
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
                  <th className="px-4 py-3 font-medium">Loại nghiệp vụ</th>
                  <th className="px-4 py-3 font-medium">Mã nghiệp vụ</th>
                  <th className="px-4 py-3 font-medium">Nhân viên thao tác</th>
                  <th className="px-4 py-3 font-medium">Ghi chú</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => {
                  const isExpanded = expandedId === row.id;
                  const beforeQty = getBeforeQty(row);
                  const afterQty = getAfterQty(row);
                  const reference = getReferenceDisplay(row);
                  const refCode = reference.code;
                  const actor = getActorDisplayLabel(row, actorDirectory);
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
                            <Badge tone="gray">Chưa ghi nhận</Badge>
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
                          <div className="text-xs font-medium text-neutral-500">{reference.label}</div>
                          <div className="mt-1 max-w-[190px] break-all font-semibold text-neutral-900">
                            {refCode || (reference.shortSystemId ? `ID ${reference.shortSystemId}` : "—")}
                          </div>
                          {reference.systemId && reference.systemId !== refCode ? (
                            <div className="mt-1 text-xs text-neutral-400">ID hệ thống: {reference.shortSystemId}</div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          {actor ? (
                            <div className="max-w-[190px] font-medium text-neutral-900">{actor}</div>
                          ) : (
                            <Badge tone="amber">Chưa ghi nhận</Badge>
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
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Nghiệp vụ</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <p><span className="text-neutral-500">Loại:</span> {refTypeLabel(getRefType(row))}</p>
                                  <p><span className="text-neutral-500">{reference.label}:</span> {refCode || "—"}</p>
                                  <p><span className="text-neutral-500">ID hệ thống:</span> {reference.systemId || row.refId || "—"}</p>
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
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Thông tin ghi nhận</p>
                                <div className="mt-3 space-y-2 text-sm">
                                  <p><span className="text-neutral-500">Nhân viên:</span> {actor || "Chưa ghi nhận"}</p>
                                  <p><span className="text-neutral-500">Thời gian ghi nhận:</span> {formatDateTime(getMovementDate(row))}</p>
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
