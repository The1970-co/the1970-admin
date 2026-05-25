"use client";

import { apiFetch } from "@/lib/api";
import { updateOrderStatus } from "@/lib/orders-api";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ProductPicker from "./ProductPicker";
import { useRouter } from "next/navigation";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import { hasPermission } from "@/lib/authz";
import {
  findPrintTemplate,
  loadPrintTemplates,
} from "@/lib/print-template-config";
import {
  openPrintDocument,
  renderOrderTemplateHtml,
} from "@/lib/print-template-engine";

type OrderItem = {
  id: string;
  productName?: string;
  sku?: string;
  color?: string | null;
  size?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};
type ProvinceOption = {
  id: number;
  name: string;
};

type DistrictOption = {
  id: number;
  name: string;
  provinceId?: number;
};

type WardOption = {
  code: string;
  name: string;
  districtId?: number;
};

type ShipmentTimelineEntry = {
  id: string;
  shipmentId?: string;
  orderId?: string | null;
  carrier?: string | null;
  trackingCode?: string | null;
  status?: string | null;
  partnerStatus?: string | null;
  title?: string | null;
  description?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverPlate?: string | null;
  eta?: string | null;
  locationText?: string | null;
  source?: string | null;
  eventTime?: string | null;
  createdAt?: string | null;
};

type ShipmentItem = {
  id?: string;
  carrier?: string | null;
  trackingCode?: string | null;
  shippingStatus?: string | null;
  partnerStatus?: string | null;
  codAmount?: number | null;
  shippingFee?: number | null;
  codReconciliationStatus?: string | null;
  codReconciledAt?: string | null;
  codReconciliationBatchId?: string | null;
  codReconciliationRowId?: string | null;
  codReconciliationIssue?: string | null;
  codReconciliationAmount?: number | null;
  ahamoveOrderId?: string | null;
  ahamoveTrackingUrl?: string | null;
  ahamoveStatus?: string | null;
  ahamoveSubStatus?: string | null;
};

type PaymentItem = {
  id?: string;
  method?: string | null;
  amount?: number | null;
  status?: string | null;
  paidAt?: string | null;
  note?: string | null;
  paymentSourceId?: string | null;
  paymentSource?: {
    id?: string;
    code?: string | null;
    name?: string | null;
    type?: string | null;
  } | null;
};

type CustomerItem = {
  id?: string;
  fullName?: string | null;
  phone?: string | null;
};

type OrderDetail = {
  id: string;
  orderCode: string;
  createdAt?: string;
  updatedAt?: string;
  soldAt?: string | null;
  createdByStaffId?: string | null;
  createdByStaffName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  finalAmount?: number;
  totalAmount?: number;
  discountAmount?: number;
  shippingFee?: number;
  branchId?: string | null;
  salesChannel?: string | null;
  isPartialDelivery?: boolean;
  partialReason?: string | null;
  partialDeliveries?: PartialDeliveryRecord[];
  shippingGhnDistrictId?: number | null;
  shippingGhnWardCode?: string | null;
  shippingRecipientName?: string | null;
  shippingPhone?: string | null;
  shippingEmail?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingWard?: string | null;
  shippingDistrict?: string | null;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;

  items?: OrderItem[];
  shipment?: ShipmentItem | null;
  customer?: CustomerItem | null;
  payments?: PaymentItem[];
};

type ShipmentEditDraft = {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  ward: string;
  district: string;
  province: string;
  postalCode: string;
  shippingNote: string;
  codAmountInput: string;
  ghnDistrictId: string;
  ghnWardCode: string;
};

type PartialDeliveryItemDraft = {
  orderItemId: string;
  productName: string;
  sku?: string;
  orderedQty: number;
  deliveredQty: number;
  unitPrice: number;
};

type PartialDeliveryDraft = {
  originalCod: number;
  adjustedCod: number;
  reason: string;
  note: string;
  approvedBy: string;
  items: PartialDeliveryItemDraft[];
};


type PartialDeliveryRecordItem = {
  id?: string;
  orderItemId?: string | null;
  variantId?: string | null;
  productName?: string | null;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  orderedQty?: number | null;
  deliveredQty?: number | null;
  returnedQty?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  actionType?: "KEPT" | "RETURNED" | string | null;
};

type PartialDeliveryRecord = {
  id: string;
  code?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  ghnTrackingCode?: string | null;
  originalCod?: number | null;
  adjustedCod?: number | null;
  shippingFee?: number | null;
  reason?: string | null;
  note?: string | null;
  approvedBy?: string | null;
  approvedById?: string | null;
  handledAt?: string | null;
  createdAt?: string | null;
  returnOrderId?: string | null;
  returnOrderCode?: string | null;
  returnTrackingCode?: string | null;
  returnStatus?: string | null;
  returnReceivedAt?: string | null;
  items?: PartialDeliveryRecordItem[];
  keptItems?: PartialDeliveryRecordItem[];
  returnedItems?: PartialDeliveryRecordItem[];
  returnOrder?: {
    id?: string;
    orderCode?: string | null;
    status?: string | null;
    fulfillmentStatus?: string | null;
    paymentStatus?: string | null;
    createdAt?: string | null;
    shipment?: ShipmentItem | null;
  } | null;
};

type OrderHistoryEntry = {
  id: string;
  title: string;
  description: string;
  createdAt?: string;
  tone?: "default" | "success" | "warning";
};

type ReturnExchangeSummary = {
  id: string;
  code?: string | null;
  type?: string | null;
  status?: string | null;
  returnAmount?: number | string | null;
  exchangeAmount?: number | string | null;
  differenceAmount?: number | string | null;
  refundAmount?: number | string | null;
  extraChargeAmount?: number | string | null;
  shippingFee?: number | string | null;
  customerPayableAmount?: number | string | null;
  exchangeOrderId?: string | null;
  exchangeOrderCode?: string | null;
  exchangeShipmentId?: string | null;
  exchangeTrackingCode?: string | null;
  exchangeCarrier?: string | null;
  handledByStaffName?: string | null;
  returnReceiveBranchId?: string | null;
  createdAt?: string | null;
  note?: string | null;
  items?: Array<{
    sku?: string | null;
    productName?: string | null;
    qty?: number | string | null;
    itemType?: string | null;
  }>;
};

function currency(n?: number | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function returnExchangeTypeText(type?: string | null) {
  const value = String(type || "").toUpperCase();
  if (value === "RETURN_EXCHANGE") return "Đổi/trả hàng";
  if (value === "EXCHANGE") return "Đổi hàng";
  if (value === "RETURN") return "Trả hàng";
  return type || "Đổi/trả";
}

function returnExchangeStatusText(status?: string | null) {
  const value = String(status || "").toUpperCase();
  if (value === "COMPLETED") return "Đã xử lý";
  if (value === "DRAFT") return "Lưu nháp";
  if (value === "CANCELLED") return "Đã huỷ";
  if (value === "PENDING") return "Chờ xử lý";
  return status || "—";
}

function summarizeReturnItems(items?: ReturnExchangeSummary["items"]) {
  if (!Array.isArray(items) || !items.length) return "Chưa có dòng sản phẩm";

  return items
    .slice(0, 5)
    .map((item) => {
      const name = item.sku || item.productName || "Sản phẩm";
      const qty = Number(item.qty || 0);
      return `${name} x${qty}`;
    })
    .join(", ");
}
function normalizedCodReconciliationStatus(status?: string | null) {
  return String(status || "").trim().toUpperCase();
}

function isCodReconciled(status?: string | null) {
  const value = normalizedCodReconciliationStatus(status);
  return ["PAID", "CONFIRMED", "MATCHED", "MATCHED_BY_PARTIAL_DELIVERY"].includes(value);
}

function codReconciliationLabel(status?: string | null) {
  const value = normalizedCodReconciliationStatus(status);
  if (value === "PAID" || value === "CONFIRMED" || value === "MATCHED") return "✓ Đã đối soát COD";
  if (value === "MATCHED_BY_PARTIAL_DELIVERY") return "✓ Đã đối soát COD qua giao 1 phần";
  if (value === "SAVED") return "Đã lưu đối soát";
  if (value === "MISMATCH") return "Đối soát lệch";
  if (value === "NOT_FOUND") return "Không tìm thấy trong phiên GHN";
  return "Chưa đối soát";
}

function codReconciliationTone(
  status?: string | null,
): "gray" | "green" | "amber" | "red" | "blue" {
  const value = normalizedCodReconciliationStatus(status);
  if (["PAID", "CONFIRMED", "MATCHED", "MATCHED_BY_PARTIAL_DELIVERY"].includes(value))
    return "green";
  if (value === "SAVED") return "blue";
  if (value === "MISMATCH" || value === "NOT_FOUND") return "red";
  return "gray";
}

function getCarrierCode(order?: OrderDetail | null, meta?: ReturnType<typeof parseStructuredNote>) {
  return String(order?.shipment?.carrier || meta?.shippingPartner || "GHN").toUpperCase();
}

function getCarrierLabel(order?: OrderDetail | null, meta?: ReturnType<typeof parseStructuredNote>) {
  const code = getCarrierCode(order, meta);
  if (code.includes("AHAMOVE")) return "AhaMove";
  if (code.includes("GHN")) return "GHN";
  if (code.includes("GHTK")) return "GHTK";
  if (code.includes("VIETTEL")) return "Viettel Post";
  if (code.includes("GRAB")) return "Grab Express";
  return order?.shipment?.carrier || meta?.shippingPartner || "Vận chuyển";
}

function shipmentStatusText(status?: string | null, carrier?: string | null) {
  const s = String(status || "").toUpperCase();
  const c = String(carrier || "").toUpperCase();

  if (!s) return "—";

  if (s.includes("DELIVERED") || s.includes("COMPLETED") || s.includes("SUCCESS")) {
    return "Giao thành công";
  }
  if (s.includes("DELIVERING") || s.includes("IN_PROCESS") || s.includes("IN PROCESS")) {
    return "Đang giao";
  }
  if (s.includes("PICKING") || s.includes("ACCEPTED")) {
    return c.includes("AHAMOVE") ? "Tài xế đã nhận / đang lấy hàng" : "Đang lấy hàng";
  }
  if (s.includes("CREATED") || s.includes("ASSIGNING") || s.includes("IDLE")) {
    return c.includes("AHAMOVE") ? "Đang tìm tài xế" : "Chờ lấy hàng";
  }
  if (s.includes("CANCEL")) return "Đã huỷ vận đơn";
  if (s.includes("FAIL")) return "Giao thất bại";
  if (s.includes("RETURN")) return "Đang hoàn hàng";

  return status || "—";
}

const AHAMOVE_EXPRESS_TRACKING_BASE_URL = "https://express.ahamove.com/s";

function trackingLinkForShipment(shipment?: ShipmentItem | null) {
  if (!shipment) return "";
  const carrier = String(shipment.carrier || "").toUpperCase();

  if (carrier.includes("AHAMOVE")) {
    const directTrackingUrl = String(shipment.ahamoveTrackingUrl || "").trim();
    if (directTrackingUrl) return directTrackingUrl;

    const ahamoveCode = String(
      shipment.ahamoveOrderId || shipment.trackingCode || "",
    ).trim();

    return ahamoveCode
      ? `${AHAMOVE_EXPRESS_TRACKING_BASE_URL}/${encodeURIComponent(ahamoveCode)}`
      : "";
  }

  if (carrier.includes("GHN") && shipment.trackingCode) {
    return `https://donhang.ghn.vn/?order_code=${encodeURIComponent(
      shipment.trackingCode,
    )}`;
  }

  return shipment.trackingCode ? "" : "";
}

function carrierBadgeTone(carrier?: string | null): "gray" | "green" | "amber" | "red" | "blue" {
  const c = String(carrier || "").toUpperCase();
  if (c.includes("AHAMOVE")) return "blue";
  if (c.includes("GHN")) return "green";
  return "gray";
}

function latestShipmentTimelineEntry(timeline: ShipmentTimelineEntry[]) {
  return Array.isArray(timeline) && timeline.length ? timeline[0] : null;
}

function driverInfoFromTimeline(timeline: ShipmentTimelineEntry[]) {
  const found = timeline.find(
    (entry) => entry.driverName || entry.driverPhone || entry.driverPlate || entry.eta || entry.locationText,
  );

  return {
    name: found?.driverName || "Chưa có tài xế",
    phone: found?.driverPhone || "",
    plate: found?.driverPlate || "",
    eta: found?.eta || "",
    location: found?.locationText || "",
  };
}

function isFinalShipmentStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();
  return (
    s.includes("DELIVERED") ||
    s.includes("COMPLETED") ||
    s.includes("SUCCESS") ||
    s.includes("CANCEL") ||
    s.includes("FAILED") ||
    s.includes("RETURN")
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return String(value || "");
  }
}

function paymentSourceLabel(payment: PaymentItem) {
  return (
    payment.paymentSource?.name ||
    payment.paymentSource?.code ||
    payment.method ||
    payment.paymentSourceId ||
    "Nguồn tiền"
  );
}

function paymentStatusText(status?: string | null) {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PARTIAL":
      return "Một phần";
    case "PENDING_COD":
      return "Chờ đối soát COD";
    case "REFUNDED":
      return "Đã hoàn";
    case "FAILED":
      return "Lỗi";
    case "UNPAID":
      return "Chưa thanh toán";
    default:
      return status || "—";
  }
}

function orderStatusText(status?: string | null) {
  switch (status) {
    case "NEW":
      return "Mới tạo";
    case "APPROVED":
      return "Đã duyệt";
    case "PACKING":
      return "Đang đóng gói";
    case "SHIPPED":
      return "Đã xuất kho";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELLED":
      return "Đã huỷ";
    default:
      return status || "—";
  }
}

function fulfillmentStatusText(status?: string | null) {
  switch (status) {
    case "UNFULFILLED":
      return "Chưa giao";
    case "PROCESSING":
      return "Đang chuẩn bị";
    case "PARTIAL":
      return "Giao một phần";
    case "FULFILLED":
      return "Đã giao";
    case "RETURNED":
      return "Đã trả hàng";
    default:
      return status || "—";
  }
}


function partialReturnStatusText(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (!s || s === "PENDING_RETURN") return "Chờ đơn hoàn";
  if (s === "RETURNED" || s.includes("SUCCESS") || s.includes("COMPLETED")) return "Đã hoàn về";
  if (s.includes("CANCEL")) return "Đã huỷ hoàn";
  if (s.includes("FAIL") || s.includes("LOST") || s.includes("DAMAGE")) return "Hoàn lỗi / cần kiểm tra";
  if (s === "RETURNING" || s.includes("RETURN") || s.includes("TRANSIT") || s.includes("DELIVER") || s.includes("PICK")) return "Đang hoàn về";
  return status || "—";
}

function partialReturnStatusTone(status?: string | null): "gray" | "green" | "amber" | "red" | "blue" {
  const s = String(status || "").toUpperCase();
  if (s === "RETURNED" || s.includes("SUCCESS") || s.includes("COMPLETED")) return "green";
  if (s.includes("FAIL") || s.includes("LOST") || s.includes("DAMAGE") || s.includes("CANCEL")) return "red";
  if (s === "RETURNING" || s.includes("RETURN") || s.includes("TRANSIT") || s.includes("DELIVER")) return "amber";
  return "gray";
}

function getPartialRecordItems(record?: PartialDeliveryRecord | null, action?: "KEPT" | "RETURNED") {
  if (!record) return [];
  if (action === "KEPT" && Array.isArray(record.keptItems) && record.keptItems.length) return record.keptItems;
  if (action === "RETURNED" && Array.isArray(record.returnedItems) && record.returnedItems.length) return record.returnedItems;
  const rows = Array.isArray(record.items) ? record.items : [];
  if (!action) return rows;
  return rows.filter((item) => String(item.actionType || "").toUpperCase() === action || (action === "RETURNED" && Number(item.returnedQty || 0) > 0));
}

function hasRealPartialDeliveryItems(record?: PartialDeliveryRecord | null) {
  if (!record) return false;

  const rows = Array.isArray(record.items) ? record.items : [];
  const keptRows = getPartialRecordItems(record, "KEPT");
  const returnedRows = getPartialRecordItems(record, "RETURNED");

  if (keptRows.length > 0 || returnedRows.length > 0) return true;

  return rows.some((item) => {
    const orderedQty = Number(item.orderedQty || item.qty || 0);
    const deliveredQty = Number(item.deliveredQty || 0);
    const returnedQty = Number(item.returnedQty || 0);
    const actionType = String(item.actionType || "").toUpperCase();

    return (
      actionType === "KEPT" ||
      actionType === "RETURNED" ||
      returnedQty > 0 ||
      (orderedQty > 0 && deliveredQty >= 0 && deliveredQty < orderedQty)
    );
  });
}

function getRealPartialDeliveryRecord(order?: OrderDetail | null) {
  const rows = Array.isArray(order?.partialDeliveries)
    ? order?.partialDeliveries || []
    : [];

  return rows.find((record) => hasRealPartialDeliveryItems(record)) || null;
}

function hasRealPartialDelivery(order?: OrderDetail | null) {
  return Boolean(getRealPartialDeliveryRecord(order));
}

function formatVndInput(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function parseVndInput(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function isOwnerOrAdminUser(user: any) {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);
  return roles.includes("owner") || roles.includes("admin");
}

function normalizeId(value: any) {
  return String(value || "").trim();
}

function getScopedPermissionRows(user: any) {
  const rows = Array.isArray(user?.branchPermissions) ? user.branchPermissions : [];
  const branchId = normalizeId(user?.branchId || user?.workingBranchId || user?.currentBranchId);
  if (!branchId) return rows;
  const scoped = rows.filter((row: any) => normalizeId(row?.branchId) === branchId);
  return scoped.length ? scoped : rows;
}

function getUserPermissionKeys(user: any) {
  const keys = new Set<string>();

  if (Array.isArray(user?.permissions)) {
    user.permissions.forEach((permission: any) => {
      if (permission) keys.add(String(permission));
    });
  }

  if (Array.isArray(user?.permissionKeys)) {
    user.permissionKeys.forEach((permission: any) => {
      if (permission) keys.add(String(permission));
    });
  }

  getScopedPermissionRows(user).forEach((row: any) => {
    if (Array.isArray(row?.permissionKeys)) {
      row.permissionKeys.forEach((permission: any) => {
        if (permission) keys.add(String(permission));
      });
    }
  });

  return keys;
}

function hasOrderPermission(user: any, permission: string) {
  if (isOwnerOrAdminUser(user)) return true;
  if (getUserPermissionKeys(user).has(permission)) return true;

  return getScopedPermissionRows(user).some((row: any) => {
    if (permission === "orders.view_own") return !!row.canViewOwnOrders;
    if (permission === "orders.view") return !!row.canViewBranchOrders;
    if (permission === "orders.create") return !!row.canCreateOrder;
    if (permission === "orders.approve") return !!row.canApproveOrder;
    if (permission === "orders.cancel") return !!row.canCancelOrder;
    if (permission === "returns.create") return !!row.canHandleReturn;
    if (permission === "returns.view") return !!row.canHandleReturn;
    return false;
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-t-[18px] border-b border-neutral-200 bg-neutral-50/70 px-4 py-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function ActionButton({
  children,
  tone = "default",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  tone?: "default" | "dark" | "danger";
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
}) {
  const styles =
    tone === "dark"
      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick?.()}
      className={`inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-medium transition ${styles} ${disabled ? "cursor-not-allowed opacity-45" : ""
        }`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 text-[12px] leading-5">
      <div className="text-neutral-500">{label}</div>
      <div className="font-medium text-neutral-900">{value || "—"}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  const color =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-neutral-900";

  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p className={`mt-1 text-[16px] font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function EditInput({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
}: {
  value?: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      className="h-9 w-full rounded-xl border border-neutral-300 px-3 text-[12px] outline-none focus:border-neutral-500"
    />
  );
}

function EditTextarea({
  value,
  onChange,
  placeholder,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[88px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-[12px] outline-none focus:border-neutral-500"
    />
  );
}
function EditSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[12px] outline-none focus:border-neutral-500"
    >
      <option value="">{placeholder || "Chọn"}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}


function normalizeOptionSearch(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function SearchableEditSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((item) => String(item.value) === String(value || ""));
  const normalizedKeyword = normalizeOptionSearch(keyword);

  const filteredOptions = useMemo(() => {
    if (!normalizedKeyword) return options.slice(0, 80);

    return options
      .map((item) => {
        const labelKey = normalizeOptionSearch(item.label);
        const valueKey = normalizeOptionSearch(item.value);
        const score =
          labelKey === normalizedKeyword
            ? 0
            : labelKey.startsWith(normalizedKeyword)
              ? 1
              : labelKey.includes(normalizedKeyword)
                ? 2
                : valueKey.includes(normalizedKeyword)
                  ? 3
                  : 99;
        return { ...item, score };
      })
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "vi"))
      .slice(0, 80);
  }, [options, normalizedKeyword]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          setKeyword("");
        }}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-left text-[12px] outline-none transition focus:border-neutral-500 ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-neutral-400"}`}
      >
        <span className={selected ? "truncate text-neutral-900" : "truncate text-neutral-400"}>
          {selected?.label || placeholder || "Chọn"}
        </span>
        <span className="text-[10px] text-neutral-400">⌄</span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[42px] z-[90] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
          <div className="border-b border-neutral-100 p-2">
            <input
              autoFocus
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={searchPlaceholder || placeholder || "Tìm kiếm"}
              className="h-9 w-full rounded-xl border border-neutral-200 px-3 text-[12px] outline-none focus:border-neutral-500"
            />
          </div>

          <div className="max-h-[260px] overflow-auto py-1">
            {filteredOptions.length ? (
              filteredOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                    setKeyword("");
                  }}
                  className={`block w-full px-3 py-2 text-left text-[12px] hover:bg-neutral-50 ${String(item.value) === String(value || "") ? "bg-neutral-100 font-semibold text-neutral-950" : "text-neutral-700"}`}
                >
                  {item.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-[12px] text-neutral-500">
                Không tìm thấy kết quả phù hợp.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function normalizeCarrierRequiredNote(value?: string | null) {
  const raw = normalizeOptionSearch(value);
  if (raw.includes("cho xem hang") && raw.includes("cho thu") && !raw.includes("khong cho thu")) {
    return "CHOXEMHANG";
  }
  if (raw.includes("cho xem hang") && raw.includes("khong cho thu")) {
    return "CHOXEMHANGKHONGTHU";
  }
  return "KHONGCHOXEMHANG";
}

function carrierRequiredNoteLabel(value?: string | null) {
  const code = normalizeCarrierRequiredNote(value);
  if (code === "CHOXEMHANG") return "Cho xem hàng, cho thử";
  if (code === "CHOXEMHANGKHONGTHU") return "Cho xem hàng, không cho thử";
  return "Không cho xem hàng";
}

function parseStructuredNote(note?: string | null) {
  if (!note) {
    return {
      noteText: "",
      address: "",
      tags: "",
      shippingMode: "",
      shippingPartner: "",
      shippingNote: "",
      shippingPayer: "",
      amountDueText: "",
      customerPaidText: "",
    };
  }

  const parts = String(note)
    .split(" | ")
    .map((i) => i.trim())
    .filter(Boolean);

  const get = (prefix: string) => {
    const found = parts.find((p) => p.startsWith(prefix));
    return found ? found.replace(prefix, "").trim() : "";
  };

  return {
    noteText: get("Ghi chú:"),
    address: get("Địa chỉ:"),
    tags: get("Tags:"),
    shippingMode: get("Cách giao:"),
    shippingPartner: get("Đơn vị giao:"),
    shippingNote: get("Ghi chú giao hàng:"),
    shippingPayer: get("Người trả ship:"),
    amountDueText: get("Còn phải trả:"),
    customerPaidText: get("Khách đã trả:"),
  };
}

function buildAddress(
  order: OrderDetail,
  meta: ReturnType<typeof parseStructuredNote>,
) {
  const full = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    order.shippingWard,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return full || meta.address || "—";
}

function toneForOrderStatus(
  status?: string | null,
): "gray" | "green" | "amber" | "red" | "blue" {
  switch (status) {
    case "APPROVED":
      return "blue";
    case "PACKING":
      return "amber";
    case "SHIPPED":
    case "COMPLETED":
      return "green";
    case "CANCELLED":
      return "red";
    default:
      return "gray";
  }
}

function toneForPaymentStatus(
  status?: string | null,
): "gray" | "green" | "amber" | "red" | "blue" {
  switch (status) {
    case "PAID":
      return "green";
    case "PARTIAL":
      return "amber";
    case "UNPAID":
      return "red";
    default:
      return "gray";
  }
}

function stageIndex(status?: string | null) {
  switch (status) {
    case "NEW":
      return 1;
    case "APPROVED":
      return 2;
    case "PACKING":
      return 3;
    case "SHIPPED":
      return 4;
    case "COMPLETED":
      return 5;
    default:
      return 1;
  }
}

function Timeline({ order }: { order?: OrderDetail | null }) {
  const current = stageIndex(order?.status);
  const createdTime = formatDateTime(order?.createdAt) || "—";
  const updatedTime = formatDateTime(order?.updatedAt) || createdTime;
  const steps = [
    { key: 1, label: "Đặt hàng" },
    { key: 2, label: "Duyệt" },
    { key: 3, label: "Đóng gói" },
    { key: 4, label: "Xuất kho" },
    { key: 5, label: "Hoàn thành" },
  ];

  const timeForStep = (key: number) => {
    if (key === 1) return createdTime;
    if (current >= key && key === current) return updatedTime;
    if (current > key) return "Đã qua";
    return "—";
  };

  return (
    <div className="flex items-start">
      {steps.map((step, index) => {
        const active = current >= step.key;
        const last = index === steps.length - 1;

        return (
          <div key={step.key} className="flex items-start">
            <div className="flex min-w-[54px] flex-col items-center text-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${active
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-200 text-neutral-500"
                  }`}
              >
                {step.key}
              </div>
              <span className="mt-1 text-[10px] font-medium text-neutral-600">
                {step.label}
              </span>
              <span className="mt-0.5 max-w-[74px] text-[9px] leading-tight text-neutral-400">
                {timeForStep(step.key)}
              </span>
            </div>

            {!last ? (
              <div
                className={`mx-1.5 mt-3 h-[2px] w-7 md:w-9 ${current > step.key ? "bg-blue-600" : "bg-neutral-200"
                  }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function normalizeShipmentStatus(status?: string | null) {
  return String(status || "").toUpperCase();
}

function isShipmentFailed(status?: string | null) {
  const s = normalizeShipmentStatus(status);
  return (
    s.includes("FAIL") ||
    s.includes("RETURN") ||
    s.includes("CANCEL") ||
    s.includes("DELIVERY_FAIL")
  );
}

function isShipmentDelivered(status?: string | null) {
  const s = normalizeShipmentStatus(status);
  return s.includes("DELIVERED") || s.includes("SUCCESS");
}

function canEditShipmentInfo(order?: OrderDetail | null) {
  if (!order) return false;

  const orderStatus = String(order.status || "").toUpperCase();
  const shipmentStatus = normalizeShipmentStatus(
    order.shipment?.shippingStatus,
  );
  const hasShipment = !!order.shipment?.trackingCode;

  if (!hasShipment) return false;
  if (orderStatus === "CANCELLED" || orderStatus === "COMPLETED") return false;
  if (isShipmentDelivered(shipmentStatus)) return false;

  return true;
}

function canRedelivery(order?: OrderDetail | null) {
  if (!order) return false;
  if (!order.shipment?.trackingCode) return false;
  return isShipmentFailed(order.shipment?.shippingStatus);
}

function canEditCod(order?: OrderDetail | null) {
  if (!order) return false;
  if (!order.shipment?.trackingCode) return false;

  const orderStatus = String(order.status || "").toUpperCase();
  const shipmentStatus = normalizeShipmentStatus(
    order.shipment?.shippingStatus,
  );

  if (orderStatus === "CANCELLED" || orderStatus === "COMPLETED") return false;
  if (isShipmentDelivered(shipmentStatus)) return false;

  return true;
}
function isPartialDelivery(order?: OrderDetail | null) {
  // Không suy luận giao hàng 1 phần chỉ vì COD nhỏ hơn tổng đơn.
  // Sửa COD thường cũng làm COD nhỏ hơn tổng đơn, nhưng không được show phiếu 1 phần,
  // không được show sản phẩm hoàn về và không tự dựng đơn hoàn _PR.
  return hasRealPartialDelivery(order);
}

function buildShipmentEditDraft(order?: OrderDetail | null): ShipmentEditDraft {
  return {
    recipientName: order?.shippingRecipientName || order?.customerName || "",
    phone: order?.shippingPhone || order?.customerPhone || "",
    addressLine1: order?.shippingAddressLine1 || "",
    addressLine2: order?.shippingAddressLine2 || "",
    ward: order?.shippingWard || "",
    district: order?.shippingDistrict || "",
    province: order?.shippingProvince || "",
    postalCode: order?.shippingPostalCode || "",
    shippingNote: parseStructuredNote(order?.note).shippingNote || "",
    codAmountInput: formatVndInput(
      order?.shipment?.codAmount ??
      Math.max(
        0,
        Number(order?.finalAmount || 0) -
        (order?.payments || []).reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        ),
      ),
    ),
    ghnDistrictId: order?.shippingGhnDistrictId
      ? String(order.shippingGhnDistrictId)
      : "",
    ghnWardCode: order?.shippingGhnWardCode || "",
  };
}

function buildPartialDeliveryDraft(
  order?: OrderDetail | null,
  adjustedCod = 0,
): PartialDeliveryDraft {
  const items = (order?.items || []).map((item) => ({
    orderItemId: item.id,
    productName: item.productName || "",
    sku: item.sku || "",
    orderedQty: Number(item.qty || 0),
    deliveredQty: Number(item.qty || 0),
    unitPrice: Number(item.unitPrice || 0),
  }));

  const originalCod =
    (order?.items || []).reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0,
    ) + Number(order?.shippingFee || 0);

  return {
    originalCod,
    adjustedCod,
    reason: order?.partialReason || "Khách chỉ nhận một phần đơn hàng",
    note: "",
    approvedBy: "Admin / Owner",
    items,
  };
}

function upsertStructuredNotePart(
  note: string | null | undefined,
  prefix: string,
  value: string,
) {
  const parts = String(note || "")
    .split(" | ")
    .map((i) => i.trim())
    .filter(Boolean);

  const nextParts = parts.filter((p) => !p.startsWith(prefix));

  if (value.trim()) {
    nextParts.push(`${prefix}${value.trim()}`);
  }

  return nextParts.join(" | ");
}

type MobileOrderDetailViewProps = {
  viewOrder: OrderDetail;
  meta: ReturnType<typeof parseStructuredNote>;
  fullAddress: string;
  totalItems: number;
  itemsSubtotal: number;
  shownFinalAmount: number;
  customerPaid: number;
  amountDue: number;
  paymentsTotal: number;
  paymentLines: PaymentItem[];
  partialDelivery: boolean;
  saving: boolean;
  canEdit: boolean;
  shipmentEditable: boolean;
  codEditable: boolean;
  redeliveryAvailable: boolean;
  orderHistory: OrderHistoryEntry[];
  onPrint: () => void;
  onCopyOrder: () => void;
  onInternalCancel: () => void | Promise<void>;
  onCancelShipment: () => void | Promise<void>;
  onOpenShipmentEdit: () => void | Promise<void>;
  onOpenCodEdit: () => void;
  canCreateShipment: boolean;
  onCreateShipment: (carrier: "ghn" | "ahamove" | "viettelpost") => void | Promise<void>;
};

function MobileInfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-b-0">
      <span className="shrink-0 text-[11px] font-medium text-neutral-500">
        {label}
      </span>
      <span className="min-w-0 text-right text-[12px] font-semibold leading-5 text-neutral-900">
        {value || "—"}
      </span>
    </div>
  );
}

function MobileOrderCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <h3 className="text-[14px] font-semibold text-neutral-950">{title}</h3>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function MobileOrderDetailView({
  viewOrder,
  meta,
  fullAddress,
  totalItems,
  itemsSubtotal,
  shownFinalAmount,
  customerPaid,
  amountDue,
  paymentsTotal,
  paymentLines,
  partialDelivery,
  saving,
  canEdit,
  shipmentEditable,
  codEditable,
  redeliveryAvailable,
  orderHistory,
  onPrint,
  onCopyOrder,
  onInternalCancel,
  onCancelShipment,
  onOpenShipmentEdit,
  onOpenCodEdit,
  canCreateShipment,
  onCreateShipment,
}: MobileOrderDetailViewProps) {
  return (
    <div className="lg:hidden">
      <div className="space-y-3 pb-24">
        <div className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm">
          <Link
            href="/orders"
            className="text-[12px] font-medium text-neutral-500"
          >
            ← Danh sách đơn
          </Link>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold tracking-tight text-neutral-950">
                {viewOrder.orderCode}
              </h1>
              <p className="mt-1 text-[12px] text-neutral-500">
                {formatDateTime(viewOrder.createdAt) || "Chưa có thời gian"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-neutral-500">Còn phải thu</p>
              <p className="mt-1 text-[18px] font-semibold text-red-600">
                {currency(amountDue)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={toneForOrderStatus(viewOrder.status)}>
              {orderStatusText(viewOrder.status)}
            </Badge>
            <Badge tone={toneForPaymentStatus(viewOrder.paymentStatus)}>
              {paymentStatusText(viewOrder.paymentStatus)}
            </Badge>
            <Badge tone="blue">
              {fulfillmentStatusText(viewOrder.fulfillmentStatus)}
            </Badge>
            {partialDelivery ? (
              <Badge tone="amber">Giao hàng 1 phần</Badge>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <Timeline order={viewOrder} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[12px] font-semibold text-neutral-900 shadow-sm"
          >
            In đơn
          </button>
          <button
            type="button"
            onClick={onCopyOrder}
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[12px] font-semibold text-neutral-900 shadow-sm"
          >
            Sao chép
          </button>
          {canCreateShipment ? (
            <button
              type="button"
              onClick={() => void onCreateShipment("ghn")}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[12px] font-semibold text-emerald-700 shadow-sm"
            >
              Đẩy GHN
            </button>
          ) : null}
          <Link
            href={`/returns/create?orderId=${viewOrder.id}`}
            className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-center text-[12px] font-semibold text-blue-700 shadow-sm"
          >
            Đổi / Trả
          </Link>
          {shipmentEditable ? (
            <button
              type="button"
              onClick={() => void onOpenShipmentEdit()}
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[12px] font-semibold text-neutral-900 shadow-sm"
            >
              Sửa giao hàng
            </button>
          ) : (
            <button
              type="button"
              onClick={onInternalCancel}
              disabled={saving || !canEdit}
              className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-[12px] font-semibold text-red-700 shadow-sm disabled:opacity-50"
            >
              Huỷ nội bộ
            </button>
          )}
          {codEditable ? (
            <button
              type="button"
              onClick={onOpenCodEdit}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] font-semibold text-amber-700 shadow-sm"
            >
              Sửa COD
            </button>
          ) : null}
          {viewOrder.shipment?.trackingCode ? (
            <button
              type="button"
              onClick={onCancelShipment}
              disabled={saving}
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[12px] font-semibold text-neutral-900 shadow-sm disabled:opacity-50"
            >
              Huỷ {getCarrierLabel(viewOrder, meta)}
            </button>
          ) : null}
          {redeliveryAvailable ? (
            <Link
              href={`/orders/${viewOrder.id}?action=redelivery`}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-[12px] font-semibold text-emerald-700 shadow-sm"
            >
              Giao lại
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[20px] border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] text-neutral-500">Tổng tiền</p>
            <p className="mt-1 text-[18px] font-semibold text-neutral-950">
              {currency(shownFinalAmount)}
            </p>
          </div>
          <div className="rounded-[20px] border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] text-neutral-500">Đã trả</p>
            <p className="mt-1 text-[18px] font-semibold text-emerald-600">
              {currency(customerPaid)}
            </p>
          </div>
          <div className="rounded-[20px] border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] text-neutral-500">Tiền hàng</p>
            <p className="mt-1 text-[18px] font-semibold text-neutral-950">
              {currency(itemsSubtotal)}
            </p>
          </div>
          <div className="rounded-[20px] border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] text-neutral-500">Phí ship</p>
            <p className="mt-1 text-[18px] font-semibold text-neutral-950">
              {currency(viewOrder.shippingFee)}
            </p>
          </div>
        </div>

        <MobileOrderCard title="Khách hàng & giao hàng">
          <MobileInfoLine
            label="Khách"
            value={
              viewOrder.customerName || viewOrder.customer?.fullName || "—"
            }
          />
          <MobileInfoLine
            label="SĐT"
            value={viewOrder.customerPhone || viewOrder.customer?.phone || "—"}
          />
          <MobileInfoLine
            label="Người nhận"
            value={
              viewOrder.shippingRecipientName || viewOrder.customerName || "—"
            }
          />
          <MobileInfoLine
            label="SĐT nhận"
            value={viewOrder.shippingPhone || viewOrder.customerPhone || "—"}
          />
          <MobileInfoLine label="Địa chỉ" value={fullAddress} />
          <MobileInfoLine
            label="Ghi chú"
            value={meta.noteText || meta.shippingNote || "—"}
          />
        </MobileOrderCard>

        <MobileOrderCard title="Thanh toán">
          <MobileInfoLine
            label="Tổng cần thu"
            value={currency(shownFinalAmount)}
          />
          <MobileInfoLine
            label="Đã thanh toán"
            value={currency(customerPaid)}
          />
          <MobileInfoLine label="Còn phải trả" value={currency(amountDue)} />
          <MobileInfoLine
            label="COD"
            value={currency(viewOrder.shipment?.codAmount)}
          />
          <MobileInfoLine
            label="Nguồn tiền"
            value={`Tổng ${currency(paymentsTotal)}`}
          />

          {paymentLines.length ? (
            <div className="mt-3 space-y-2">
              {paymentLines.map((payment, index) => (
                <div
                  key={
                    payment.id || `${payment.paymentSourceId || "pay"}-${index}`
                  }
                  className="rounded-2xl bg-neutral-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-neutral-900">
                        {paymentSourceLabel(payment)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-500">
                        {paymentStatusText(payment.status)}
                      </p>
                    </div>
                    <p className="text-[12px] font-semibold text-neutral-900">
                      {currency(payment.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </MobileOrderCard>

        {!String(viewOrder.salesChannel || "")
          .toUpperCase()
          .includes("POS") ? (
          <MobileOrderCard title={`Vận đơn ${getCarrierLabel(viewOrder, meta)}`}>
            <MobileInfoLine
              label="Đơn vị"
              value={viewOrder.shipment?.carrier || meta.shippingPartner || "—"}
            />
            <MobileInfoLine
              label="Mã vận đơn"
              value={viewOrder.shipment?.trackingCode || "—"}
            />
            {trackingLinkForShipment(viewOrder.shipment) ? (
              <MobileInfoLine
                label="Tracking"
                value={
                  <a
                    href={trackingLinkForShipment(viewOrder.shipment)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    {String(viewOrder.shipment?.carrier || "").toUpperCase().includes("AHAMOVE")
                      ? "Mở AhaMove"
                      : "Mở tracking"}
                  </a>
                }
              />
            ) : null}
            <MobileInfoLine
              label="Trạng thái"
              value={shipmentStatusText(
                viewOrder.shipment?.shippingStatus || viewOrder.shipment?.partnerStatus,
                viewOrder.shipment?.carrier || meta.shippingPartner,
              )}
            />
            <MobileInfoLine
              label={`Phí ${getCarrierLabel(viewOrder, meta)}`}
              value={currency(viewOrder.shipment?.shippingFee)}
            />
            <MobileInfoLine
              label="Đối soát COD"
              value={
                <Badge tone={codReconciliationTone(viewOrder.shipment?.codReconciliationStatus)}>
                  {codReconciliationLabel(viewOrder.shipment?.codReconciliationStatus)}
                </Badge>
              }
            />
          </MobileOrderCard>
        ) : null}

        <MobileOrderCard title={`Sản phẩm (${totalItems})`}>
          <div className="space-y-2">
            {(viewOrder.items || []).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-neutral-50 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-5 text-neutral-950">
                      {item.productName || "Sản phẩm"}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {item.sku || "—"} · {item.color || "—"} ·{" "}
                      {item.size || "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-semibold text-neutral-900">
                      x{item.qty}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-neutral-950">
                      {currency(item.lineTotal)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MobileOrderCard>

        <MobileOrderCard title="Lịch sử">
          {orderHistory.length ? (
            <div className="space-y-2">
              {orderHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl bg-neutral-50 px-3 py-3"
                >
                  <p className="text-[12px] font-semibold text-neutral-950">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-neutral-600">
                    {entry.description}
                  </p>
                  {entry.createdAt ? (
                    <p className="mt-1 text-[10px] text-neutral-400">
                      {entry.createdAt}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-neutral-500">Chưa có lịch sử.</p>
          )}
        </MobileOrderCard>
      </div>
    </div>
  );
}

function ShipmentRealtimeTimeline({
  timeline,
  refreshing,
  message,
  onRefresh,
}: {
  timeline: ShipmentTimelineEntry[];
  refreshing: boolean;
  message?: string;
  onRefresh: () => void;
}) {
  return (
    <Panel>
      <SectionHeader
        title="Tracking realtime"
        subtitle="Tự cập nhật realtime, hiển thị tài xế/ETA khi hãng trả dữ liệu."
        action={
          <ActionButton disabled={refreshing} onClick={onRefresh}>
            {refreshing ? "Đang refresh..." : "Refresh"}
          </ActionButton>
        }
      />
      <div className="space-y-3 p-4">
        {message ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {message}
          </div>
        ) : null}

        {timeline.length ? (
          <div className="space-y-3">
            {timeline.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-950">
                        {entry.title || shipmentStatusText(entry.status)}
                      </p>
                      <Badge tone="blue">
                        {entry.carrier || "Vận chuyển"}
                      </Badge>
                    </div>

                    <p className="mt-1 text-xs text-neutral-500">
                      {shipmentStatusText(entry.status || entry.partnerStatus)}
                      {entry.partnerStatus ? ` · ${entry.partnerStatus}` : ""}
                    </p>

                    {entry.description ? (
                      <p className="mt-1 text-xs leading-5 text-neutral-600">
                        {entry.description}
                      </p>
                    ) : null}

                    {entry.driverName || entry.driverPhone || entry.driverPlate ? (
                      <div className="mt-2 grid gap-1 text-xs text-neutral-600 md:grid-cols-3">
                        <span>Tài xế: {entry.driverName || "—"}</span>
                        <span>SĐT: {entry.driverPhone || "—"}</span>
                        <span>Biển số: {entry.driverPlate || "—"}</span>
                      </div>
                    ) : null}

                    {entry.locationText || entry.eta ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        {entry.locationText ? `Vị trí: ${entry.locationText}` : ""}
                        {entry.locationText && entry.eta ? " · " : ""}
                        {entry.eta ? `ETA: ${entry.eta}` : ""}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right text-[11px] text-neutral-400">
                    {formatDateTime(entry.eventTime || entry.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            Chưa có timeline tracking từ hãng. Hệ thống vẫn đang theo dõi, bấm Refresh để đồng bộ ngay.
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function OrderDetailPageClient({
  orderId,
  created = false,
  tracking = "",
}: {
  orderId: string;
  created?: boolean;
  tracking?: string;
  shipment?: string;
  orderCode?: string;
}) {
  const router = useRouter();
  const currentUser = getCurrentUserFromStorage();
  const canEditOrderPermission = hasOrderPermission(currentUser, "orders.edit");
  const canCancelOrderPermission = hasOrderPermission(currentUser, "orders.cancel");
  const canPackShipOrderPermission = hasOrderPermission(currentUser, "orders.pack_ship");
  const canCreateReturnPermission = hasOrderPermission(currentUser, "returns.create");

  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<DistrictOption[]>([]);
  const [wardOptions, setWardOptions] = useState<WardOption[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedWardCode, setSelectedWardCode] = useState("");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [draftOrder, setDraftOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const createdToastShownRef = useRef(false);
  const loadProvinces = async () => {
    const res = await apiFetch("/shipping-addresses/provinces", {
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json().catch(() => []);
    setProvinceOptions(Array.isArray(json) ? json : []);
  };

  const loadDistricts = async (provinceId: string) => {
    if (!provinceId) {
      setDistrictOptions([]);
      return;
    }

    const res = await apiFetch(
      `/shipping-addresses/districts?provinceId=${provinceId}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const json = await res.json().catch(() => []);
    setDistrictOptions(Array.isArray(json) ? json : []);
  };

  const loadWards = async (districtId: string) => {
    if (!districtId) {
      setWardOptions([]);
      return;
    }

    const res = await apiFetch(
      `/shipping-addresses/wards?districtId=${districtId}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const json = await res.json().catch(() => []);
    setWardOptions(Array.isArray(json) ? json : []);
  };
  const resolveProvinceIdByDistrictId = async (districtId: string) => {
    if (!districtId) return "";

    const provinceRes = await apiFetch(
      "/shipping-addresses/provinces",
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const provinces = await provinceRes.json().catch(() => []);
    const provinceList = Array.isArray(provinces) ? provinces : [];
    setProvinceOptions(provinceList);

    for (const province of provinceList) {
      const districtRes = await apiFetch(
        `/shipping-addresses/districts?provinceId=${province.id}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      const districts = await districtRes.json().catch(() => []);
      const districtList = Array.isArray(districts) ? districts : [];

      const found = districtList.find(
        (d: any) => String(d.id) === String(districtId),
      );

      if (found) {
        setDistrictOptions(districtList);
        return String(province.id);
      }
    }

    return "";
  };
  const handleProvinceChange = async (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    setSelectedDistrictId("");
    setSelectedWardCode("");
    setDistrictOptions([]);
    setWardOptions([]);

    const province = provinceOptions.find((p) => String(p.id) === provinceId);

    setShipmentDraft((prev) => ({
      ...prev,
      province: province?.name || "",
      district: "",
      ward: "",
      ghnDistrictId: "",
      ghnWardCode: "",
    }));

    await loadDistricts(provinceId);
  };

  const handleDistrictChange = async (districtId: string) => {
    setSelectedDistrictId(districtId);
    setSelectedWardCode("");

    const district = districtOptions.find((d) => String(d.id) === districtId);

    setShipmentDraft((prev) => ({
      ...prev,
      district: district?.name || "",
      ward: "",
      ghnDistrictId: districtId,
      ghnWardCode: "",
    }));

    await loadWards(districtId);
  };
  const handleWardChange = (wardCode: string) => {
    setSelectedWardCode(wardCode);

    const ward = wardOptions.find((w) => w.code === wardCode);

    setShipmentDraft((prev) => ({
      ...prev,
      ward: ward?.name || "",
      ghnWardCode: wardCode,
    }));
  };

  const handleEditProvinceChange = async (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    setSelectedDistrictId("");
    setSelectedWardCode("");
    setDistrictOptions([]);
    setWardOptions([]);

    const province = provinceOptions.find((p) => String(p.id) === provinceId);

    setDraftOrder((prev) =>
      prev
        ? {
          ...prev,
          shippingProvince: province?.name || "",
          shippingDistrict: "",
          shippingWard: "",
          shippingGhnDistrictId: null,
          shippingGhnWardCode: null,
        }
        : prev,
    );

    await loadDistricts(provinceId);
  };

  const handleEditDistrictChange = async (districtId: string) => {
    setSelectedDistrictId(districtId);
    setSelectedWardCode("");
    setWardOptions([]);

    const district = districtOptions.find((d) => String(d.id) === districtId);

    setDraftOrder((prev) =>
      prev
        ? {
          ...prev,
          shippingDistrict: district?.name || "",
          shippingWard: "",
          shippingGhnDistrictId: districtId ? Number(districtId) : null,
          shippingGhnWardCode: null,
        }
        : prev,
    );

    await loadWards(districtId);
  };

  const handleEditWardChange = (wardCode: string) => {
    setSelectedWardCode(wardCode);

    const ward = wardOptions.find((w) => w.code === wardCode);

    setDraftOrder((prev) =>
      prev
        ? {
          ...prev,
          shippingWard: ward?.name || "",
          shippingGhnWardCode: wardCode || null,
        }
        : prev,
    );
  };
  const [showShipmentEditModal, setShowShipmentEditModal] = useState(false);
  const [showAuthConfirmModal, setShowAuthConfirmModal] = useState(false);
  const [showCodSuccessToast, setShowCodSuccessToast] = useState(false);
  const [codSuccessText, setCodSuccessText] = useState("");

  const [shipmentDraft, setShipmentDraft] = useState<ShipmentEditDraft>(
    buildShipmentEditDraft(null),
  );
  const [shipmentSaving, setShipmentSaving] = useState(false);

  const [editMode, setEditMode] = useState<"full" | "cod">("full");
  const [codEditFlow, setCodEditFlow] = useState<"normal" | "partial">("normal");
  const [authCode, setAuthCode] = useState("");
  const [authVerifying, setAuthVerifying] = useState(false);
  const [showPartialDeliveryModal, setShowPartialDeliveryModal] =
    useState(false);
  const [partialSaving, setPartialSaving] = useState(false);
  const [partialDraft, setPartialDraft] = useState<PartialDeliveryDraft>({
    originalCod: 0,
    adjustedCod: 0,
    reason: "",
    note: "",
    approvedBy: "",
    items: [],
  });
  const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>([]);
  const [relatedReturns, setRelatedReturns] = useState<ReturnExchangeSummary[]>([]);
  const [shipmentTimeline, setShipmentTimeline] = useState<ShipmentTimelineEntry[]>([]);
  const [trackingRefreshing, setTrackingRefreshing] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState("");
  const forcedTrackingRefreshRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");

        let success = false;
        let lastMessage = "Không tải được chi tiết đơn hàng.";

        for (let attempt = 0; attempt < (created ? 4 : 1); attempt += 1) {
          const res = await apiFetch(`/orders/${orderId}`, {
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          });

          const json = await res.json().catch(() => null);

          if (res.ok && json) {
            setOrder(json);
            setDraftOrder(json);
            success = true;
            break;
          }

          lastMessage = json?.message || "Không tải được chi tiết đơn hàng.";

          if (created && attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 350));
            continue;
          }

          break;
        }

        if (!success) {
          throw new Error(lastMessage);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được chi tiết đơn hàng.",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [orderId, created]);

  useEffect(() => {
    const run = async () => {
      if (!order?.id) {
        setRelatedReturns([]);
        return;
      }

      try {
        const res = await apiFetch(`/returns/by-order/${encodeURIComponent(order.id)}`, {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setRelatedReturns([]);
          return;
        }

        const rows = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.items)
              ? json.items
              : [];

        setRelatedReturns(rows);
      } catch {
        setRelatedReturns([]);
      }
    };

    void run();
  }, [order?.id]);

  const refreshShipmentTracking = async (force = false) => {
    try {
      if (force) {
        setTrackingRefreshing(true);
        setTrackingMessage("");
      }

      const endpoint = force
        ? `/shipments/order/${orderId}/tracking/refresh`
        : `/shipments/order/${orderId}/tracking`;

      const res = await apiFetch(endpoint, {
        method: force ? "POST" : "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (force) {
          throw new Error(json?.message || "Không refresh được tracking.");
        }
        return;
      }

      if (json?.shipment) {
        setOrder((prev) =>
          prev
            ? {
              ...prev,
              shipment: {
                ...(prev.shipment || {}),
                ...(json.shipment || {}),
              },
            }
            : prev,
        );

        setDraftOrder((prev) =>
          prev
            ? {
              ...prev,
              shipment: {
                ...(prev.shipment || {}),
                ...(json.shipment || {}),
              },
            }
            : prev,
        );
      }

      if (Array.isArray(json?.timeline)) {
        setShipmentTimeline(json.timeline);
      }

      if (force) {
        setTrackingMessage("Đã refresh tracking.");
      }
    } catch (err) {
      if (force) {
        setTrackingMessage(
          err instanceof Error ? err.message : "Không refresh được tracking.",
        );
      }
    } finally {
      if (force) {
        setTrackingRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!order?.shipment?.trackingCode) return;

    const status =
      order.shipment.shippingStatus ||
      order.shipment.partnerStatus ||
      latestShipmentTimelineEntry(shipmentTimeline)?.status ||
      latestShipmentTimelineEntry(shipmentTimeline)?.partnerStatus;

    if (isFinalShipmentStatus(status)) return;

    const forceKey = `${orderId}:${order.shipment.trackingCode}`;
    const shouldForceRefresh = !forcedTrackingRefreshRef.current[forceKey];
    forcedTrackingRefreshRef.current[forceKey] = true;

    // Lần đầu mở chi tiết đơn phải gọi force=true để bỏ qua cache cũ,
    // vì nhiều đơn GHN đã giao thành công trên web GHN nhưng cache nội bộ vẫn là DELIVERING.
    void refreshShipmentTracking(shouldForceRefresh);

    const intervalMs =
      typeof document !== "undefined" && document.hidden ? 60000 : 15000;

    const timer = window.setInterval(() => {
      void refreshShipmentTracking(false);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    orderId,
    order?.shipment?.trackingCode,
    order?.shipment?.shippingStatus,
    order?.shipment?.partnerStatus,
    shipmentTimeline,
  ]);

  useEffect(() => {
    if (!order) return;

    // Khi modal sửa giao hàng/COD đang mở, order detail có thể tự refresh tracking
    // mỗi vài giây. Không reset draft trong lúc đang nhập, tránh ô COD bị nháy
    // và nhảy về số cũ khiến không gõ được số mới.
    if (showShipmentEditModal) return;

    setShipmentDraft(buildShipmentEditDraft(order));
  }, [order, showShipmentEditModal]);

  useEffect(() => {
    if (!order) return;

    const entries: OrderHistoryEntry[] = [
      {
        id: `${order.id}-created`,
        title: "Tạo đơn hàng",
        description: `Đơn ${order.orderCode} được tạo trong hệ thống nội bộ.`,
        createdAt: order.createdAt,
        tone: "default",
      },
    ];

    if (order.updatedAt && order.updatedAt !== order.createdAt) {
      entries.push({
        id: `${order.id}-updated`,
        title: "Cập nhật đơn hàng",
        description: "Đơn đã được chỉnh sửa hoặc đồng bộ lại dữ liệu.",
        createdAt: order.updatedAt,
        tone: "default",
      });
    }

    const historyPartialRecord = getRealPartialDeliveryRecord(order);
    if (historyPartialRecord) {
      const partialRecord = historyPartialRecord;
      const kept = getPartialRecordItems(partialRecord, "KEPT").map((item) => `${item.sku || item.productName} x${Number(item.qty || item.deliveredQty || 0)}`).join(", ");
      const returned = getPartialRecordItems(partialRecord, "RETURNED").map((item) => `${item.sku || item.productName} x${Number(item.qty || item.returnedQty || 0)}`).join(", ");
      entries.push({
        id: partialRecord?.id || `${order.id}-partial`,
        title: "Giao hàng 1 phần",
        description:
          [
            partialRecord?.code ? `Phiếu ${partialRecord.code}` : null,
            partialRecord?.returnOrderCode ? `Đơn hoàn ${partialRecord.returnOrderCode}` : null,
            partialRecord?.returnStatus ? `Trạng thái: ${partialReturnStatusText(partialRecord.returnStatus)}` : null,
            kept ? `Khách nhận: ${kept}` : null,
            returned ? `Hoàn về: ${returned}` : null,
            order.partialReason || partialRecord?.reason || null,
          ].filter(Boolean).join(" · ") ||
          "Đơn đã được đánh dấu giao hàng 1 phần để khớp COD thực tế.",
        createdAt: partialRecord?.handledAt || partialRecord?.createdAt || order.updatedAt,
        tone: "warning",
      });
    }

    if (Number(order.shipment?.codAmount || 0) > 0) {
      entries.push({
        id: `${order.id}-cod`,
        title: "COD hiện tại",
        description: `COD đang ghi nhận là ${currency(order.shipment?.codAmount)}.`,
        createdAt: order.updatedAt,
        tone: "success",
      });
    }

    const returnEntries: OrderHistoryEntry[] = relatedReturns.map((row) => {
      const code = row.code || row.id || "";
      const returnAmount = Number(row.returnAmount || row.refundAmount || 0);
      const exchangeAmount = Number(row.exchangeAmount || 0);
      const shippingFee = Number(row.shippingFee || 0);
      const differenceAmount = Number(row.differenceAmount || 0);

      return {
        id: `return-${row.id || code}`,
        title: `Phiếu đổi/trả ${code}`.trim(),
        description: [
          `Loại: ${returnExchangeTypeText(row.type)}`,
          `Trạng thái: ${returnExchangeStatusText(row.status)}`,
          `Tiền trả: ${currency(returnAmount)}`,
          exchangeAmount > 0 ? `Tiền đổi: ${currency(exchangeAmount)}` : null,
          shippingFee > 0 ? `Phí ship: ${currency(shippingFee)}` : null,
          differenceAmount !== 0 ? `Chênh lệch: ${currency(Math.abs(differenceAmount))}` : null,
          row.customerPayableAmount ? `COD đơn đổi: ${currency(Number(row.customerPayableAmount || 0))}` : null,
          row.exchangeOrderCode ? `Đơn đổi: ${row.exchangeOrderCode}` : null,
          row.exchangeTrackingCode ? `Mã vận đơn: ${row.exchangeTrackingCode}` : null,
          row.exchangeCarrier ? `HVC: ${row.exchangeCarrier}` : null,
          row.handledByStaffName ? `Nhân viên xử lý: ${row.handledByStaffName}` : null,
          summarizeReturnItems(row.items),
          row.note || null,
        ]
          .filter(Boolean)
          .join(" · "),
        createdAt: row.createdAt || order.updatedAt || order.createdAt,
        tone: "warning",
      };
    });

    setOrderHistory([...returnEntries, ...entries.reverse()]);
  }, [order, relatedReturns]);

  const viewOrder = isEditing && draftOrder ? draftOrder : order;

  const shipmentEditable = useMemo(() => canEditShipmentInfo(order), [order]);
  const redeliveryAvailable = useMemo(() => canRedelivery(order), [order]);

  const codEditable = useMemo(() => {
    if (!currentUser) return false;
    const canRoleEdit = hasPermission(currentUser.role, "shipments.cod.edit");
    return canRoleEdit && canEditCod(order);
  }, [order, currentUser]);

  const codChanged = useMemo(() => {
    const currentCod = Number(order?.shipment?.codAmount || 0);
    const nextCod = parseVndInput(shipmentDraft.codAmountInput);
    return nextCod !== currentCod;
  }, [order, shipmentDraft.codAmountInput]);

  useEffect(() => {
    if (!created || loading || !viewOrder || createdToastShownRef.current)
      return;

    createdToastShownRef.current = true;
    setShowCreatedToast(true);

    const timer = window.setTimeout(() => {
      setShowCreatedToast(false);
    }, 8000);

    const cleanUrl = `/orders/${orderId}`;
    router.replace(cleanUrl);

    return () => window.clearTimeout(timer);
  }, [created, loading, viewOrder, orderId, router]);

  const meta = useMemo(
    () => parseStructuredNote(viewOrder?.note),
    [viewOrder?.note],
  );
  const isPOSOrder =
    String(viewOrder?.salesChannel || "").toUpperCase() === "POS";
  const isPaidOrder =
    String(viewOrder?.paymentStatus || "").toUpperCase() === "PAID";
  const fullAddress = useMemo(
    () => (viewOrder ? buildAddress(viewOrder, meta) : "—"),
    [viewOrder, meta],
  );

  const totalItems = useMemo(
    () =>
      (viewOrder?.items || []).reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0,
      ),
    [viewOrder],
  );

  const itemsSubtotal = useMemo(
    () =>
      (viewOrder?.items || []).reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0,
      ),
    [viewOrder],
  );

  const paymentLines = useMemo(
    () => (Array.isArray(viewOrder?.payments) ? viewOrder.payments : []),
    [viewOrder?.payments],
  );

  const paymentsTotal = useMemo(
    () =>
      paymentLines.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      ),
    [paymentLines],
  );

  const computedFinalAmount = Math.max(
    0,
    itemsSubtotal -
    Number(viewOrder?.discountAmount || 0) +
    Number(viewOrder?.shippingFee || 0),
  );

  const shipmentCodAmount = Number(viewOrder?.shipment?.codAmount || 0);

  // Số khách phải trả phải luôn cộng phí ship.
  // Một số đơn cũ/backend đang trả finalAmount thiếu shippingFee,
  // nên màn chi tiết không được lấy thẳng viewOrder.finalAmount để hiển thị.
  const shownFinalAmount = computedFinalAmount;

  const customerPaid = paymentLines.length
    ? paymentsTotal
    : isPOSOrder || isPaidOrder
      ? shownFinalAmount
      : meta.customerPaidText
        ? Number(String(meta.customerPaidText).replace(/[^\d]/g, "") || 0)
        : 0;

  const isCodCollectingOrder =
    !isPOSOrder &&
    !isPaidOrder &&
    String(viewOrder?.paymentStatus || "").toUpperCase() === "PENDING_COD" &&
    shipmentCodAmount > 0;

  const amountDue = isCodCollectingOrder
    ? shipmentCodAmount
    : Math.max(shownFinalAmount - customerPaid, 0);

  const partialDelivery = useMemo(
    () => hasRealPartialDelivery(viewOrder),
    [viewOrder],
  );


  const currentPartialDelivery = useMemo(
    () => getRealPartialDeliveryRecord(viewOrder),
    [viewOrder],
  );

  const latestShipmentEvent = latestShipmentTimelineEntry(shipmentTimeline);
  const driverInfo = driverInfoFromTimeline(shipmentTimeline);
  const currentShipmentLabel = shipmentStatusText(
    latestShipmentEvent?.status ||
    latestShipmentEvent?.partnerStatus ||
    viewOrder?.shipment?.shippingStatus ||
    viewOrder?.shipment?.partnerStatus,
    viewOrder?.shipment?.carrier || meta.shippingPartner,
  );
  const openTrackingUrl = trackingLinkForShipment(viewOrder?.shipment);

  const canEdit =
    canEditOrderPermission &&
    !!order &&
    order.status !== "CANCELLED" &&
    order.status !== "COMPLETED";

  const canCreateShipment =
    canPackShipOrderPermission &&
    !!viewOrder &&
    !isPOSOrder &&
    !viewOrder.shipment?.trackingCode &&
    String(viewOrder.status || "").toUpperCase() !== "CANCELLED" &&
    String(viewOrder.status || "").toUpperCase() !== "COMPLETED";

  const updateDraft = <K extends keyof OrderDetail>(
    key: K,
    value: OrderDetail[K],
  ) => {
    setDraftOrder((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateDraftItem = (itemId: string, patch: Partial<OrderItem>) => {
    setDraftOrder((prev) => {
      if (!prev) return prev;

      const nextItems = (prev.items || []).map((item) => {
        if (item.id !== itemId) return item;

        const next = { ...item, ...patch };
        const qty = Number(next.qty || 0);
        const unitPrice = Number(next.unitPrice || 0);

        return {
          ...next,
          qty,
          unitPrice,
          lineTotal: qty * unitPrice,
        };
      });

      const subtotal = nextItems.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0,
      );

      return {
        ...prev,
        items: nextItems,
        totalAmount: subtotal,
        finalAmount:
          subtotal -
          Number(prev.discountAmount || 0) +
          Number(prev.shippingFee || 0),
      };
    });
  };

  const removeDraftItem = (itemId: string) => {
    setDraftOrder((prev) => {
      if (!prev) return prev;

      const nextItems = (prev.items || []).filter((item) => item.id !== itemId);
      const subtotal = nextItems.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0,
      );

      return {
        ...prev,
        items: nextItems,
        totalAmount: subtotal,
        finalAmount:
          subtotal -
          Number(prev.discountAmount || 0) +
          Number(prev.shippingFee || 0),
      };
    });
  };

  const addDraftItem = () => {
    setDraftOrder((prev) => {
      if (!prev) return prev;

      const nextItems = [
        ...(prev.items || []),
        {
          id: `new-${uid()}`,
          productName: "",
          sku: "",
          color: "",
          size: "",
          qty: 1,
          unitPrice: 0,
          lineTotal: 0,
        },
      ];

      return {
        ...prev,
        items: nextItems,
      };
    });
  };

  const handleCancelEdit = () => {
    setDraftOrder(order);
    setIsEditing(false);
    setMessage("");
  };

  const handleOpenShipmentEdit = async () => {
    if (!order) return;

    const draft = buildShipmentEditDraft(order);
    setShipmentDraft(draft);
    setEditMode("full");
    setAuthCode("");
    setShowAuthConfirmModal(false);

    const nextDistrictId = draft.ghnDistrictId || "";
    const nextWardCode = draft.ghnWardCode || "";

    let nextProvinceId = "";
    if (nextDistrictId) {
      nextProvinceId = await resolveProvinceIdByDistrictId(nextDistrictId);
    } else {
      await loadProvinces();
    }

    setSelectedProvinceId(nextProvinceId);
    setSelectedDistrictId(nextDistrictId);
    setSelectedWardCode(nextWardCode);

    if (nextProvinceId) {
      await loadDistricts(nextProvinceId);
    }

    if (nextDistrictId) {
      await loadWards(nextDistrictId);
    }

    setShowShipmentEditModal(true);
  };
  const handleOpenCodEdit = (flow: "normal" | "partial" = "normal") => {
    if (!order) return;
    setShipmentDraft(buildShipmentEditDraft(order));
    setCodEditFlow(flow);
    setEditMode("cod");
    setAuthCode("");
    setShowAuthConfirmModal(false);
    setShowShipmentEditModal(true);
  };

  const handleCloseShipmentEdit = () => {
    setShowShipmentEditModal(false);
    setShowAuthConfirmModal(false);

    if (order) {
      setShipmentDraft(buildShipmentEditDraft(order));
    }

    setEditMode("full");
    setCodEditFlow("normal");
    setAuthCode("");
    setAuthVerifying(false);
  };

  const handleSaveShipmentDraftLocal = () => {
    if (!order) return;

    setShipmentSaving(true);

    try {
      const nextNote = upsertStructuredNotePart(
        order.note,
        "Ghi chú giao hàng:",
        shipmentDraft.shippingNote,
      );

      const nextOrder: OrderDetail = {
        ...order,
        shippingRecipientName: shipmentDraft.recipientName,
        shippingPhone: shipmentDraft.phone,
        shippingAddressLine1: shipmentDraft.addressLine1,
        shippingAddressLine2: shipmentDraft.addressLine2,
        shippingWard: shipmentDraft.ward,
        shippingDistrict: shipmentDraft.district,
        shippingProvince: shipmentDraft.province,
        shippingPostalCode: shipmentDraft.postalCode,
        shippingGhnDistrictId: shipmentDraft.ghnDistrictId
          ? Number(shipmentDraft.ghnDistrictId)
          : null,
        shippingGhnWardCode: shipmentDraft.ghnWardCode || null,
        note: nextNote,
        shipment: {
          ...order.shipment,
          codAmount: order.shipment?.codAmount,
        },
      };
      setOrder(nextOrder);

      if (draftOrder) {
        setDraftOrder({
          ...draftOrder,
          shippingRecipientName: shipmentDraft.recipientName,
          shippingPhone: shipmentDraft.phone,
          shippingAddressLine1: shipmentDraft.addressLine1,
          shippingAddressLine2: shipmentDraft.addressLine2,
          shippingWard: shipmentDraft.ward,
          shippingDistrict: shipmentDraft.district,
          shippingProvince: shipmentDraft.province,
          shippingPostalCode: shipmentDraft.postalCode,
          shippingGhnDistrictId: shipmentDraft.ghnDistrictId
            ? Number(shipmentDraft.ghnDistrictId)
            : null,
          shippingGhnWardCode: shipmentDraft.ghnWardCode || null,
          note: nextNote,
          shipment: {
            ...draftOrder.shipment,
            codAmount: draftOrder.shipment?.codAmount,
          },
        });
      }
      setShowShipmentEditModal(false);
      setMessage("Đã cập nhật giao hàng trên giao diện.");
      setEditMode("full");
    } finally {
      setShipmentSaving(false);
    }
  };

  const handleOpenAuthConfirm = () => {
    if (!codChanged) {
      setMessage("COD chưa thay đổi.");
      return;
    }

    setAuthCode("");
    setShowAuthConfirmModal(true);
  };

  const handleVerifyAndSaveCod = async () => {
    if (!order) return;

    try {
      setAuthVerifying(true);
      setMessage("");

      const oldCod = Number(order?.shipment?.codAmount || 0);
      const nextCod = parseVndInput(shipmentDraft.codAmountInput);

      const res = await apiFetch(
        `/shipments/${order.id}/cod/verify-and-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            codAmount: nextCod,
            code: authCode.trim(),
          }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.message || "Xác thực hoặc cập nhật COD thất bại.",
        );
      }

      const shouldOpenPartialDelivery = codEditFlow === "partial";

      const nextNote = shouldOpenPartialDelivery
        ? upsertStructuredNotePart(
          order.note,
          "Tình trạng giao:",
          nextCod < computedFinalAmount ? "Giao hàng 1 phần" : "",
        )
        : order.note;

      const nextOrder: OrderDetail = {
        ...order,
        // Sửa COD chỉ thay đổi số tiền GHN thu hộ, không đổi tổng giá trị đơn.
        finalAmount: order.finalAmount,
        note: nextNote,
        shipment: {
          ...order.shipment,
          codAmount: nextCod,
        },
      };

      setOrder(nextOrder);

      if (draftOrder) {
        setDraftOrder({
          ...draftOrder,
          // Không được biến finalAmount thành COD.
          finalAmount: draftOrder.finalAmount,
          note: nextNote,
          shipment: {
            ...draftOrder.shipment,
            codAmount: nextCod,
          },
        });
      }

      setCodSuccessText(
        `Đã cập nhật COD từ ${currency(oldCod)} → ${currency(nextCod)}`,
      );
      setShowCodSuccessToast(true);

      window.setTimeout(() => {
        setShowCodSuccessToast(false);
      }, 3500);

      if (shouldOpenPartialDelivery) {
        const nextPartialDraft = buildPartialDeliveryDraft(order, nextCod);
        setPartialDraft({
          ...nextPartialDraft,
          adjustedCod: nextCod,
          approvedBy: currentUser?.name || currentUser?.code || "Admin / Owner",
        });
      }

      setShowAuthConfirmModal(false);
      setShowShipmentEditModal(false);
      setShowPartialDeliveryModal(shouldOpenPartialDelivery);
      setMessage(
        shouldOpenPartialDelivery
          ? ""
          : `Đã sửa COD thường từ ${currency(oldCod)} → ${currency(nextCod)}.`,
      );
      setEditMode("full");
      setCodEditFlow("normal");
      setAuthCode("");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không cập nhật được COD.",
      );
    } finally {
      setAuthVerifying(false);
    }
  };

  const updatePartialDeliveredQty = (
    orderItemId: string,
    deliveredQty: number,
  ) => {
    setPartialDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.orderItemId === orderItemId
          ? {
            ...item,
            deliveredQty: Math.max(
              0,
              Math.min(Number(deliveredQty || 0), item.orderedQty),
            ),
          }
          : item,
      ),
    }));
  };

  const handleSavePartialDelivery = async () => {
    if (!order) return;

    try {
      setPartialSaving(true);

      const partialPayload = {
        orderId: order.id,
        orderCode: order.orderCode,
        ghnTrackingCode: order.shipment?.trackingCode || "",
        originalCod: partialDraft.originalCod,
        adjustedCod: partialDraft.adjustedCod,
        reason: partialDraft.reason,
        note: partialDraft.note,
        approvedBy: partialDraft.approvedBy,
        items: partialDraft.items.map((item) => ({
          orderItemId: item.orderItemId,
          productName: item.productName,
          sku: item.sku || "",
          orderedQty: item.orderedQty,
          deliveredQty: item.deliveredQty,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await apiFetch("/partial-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(partialPayload),
      });

      const savedRecord = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          savedRecord?.message || "Không lưu được phiếu giao hàng 1 phần.",
        );
      }

      const partialNoteValue = JSON.stringify({
        originalCod: partialDraft.originalCod,
        adjustedCod: partialDraft.adjustedCod,
        reason: partialDraft.reason,
        note: partialDraft.note,
        approvedBy: partialDraft.approvedBy,
        items: partialDraft.items,
        ghnTrackingCode: order.shipment?.trackingCode || "",
      });

      const nextNote = upsertStructuredNotePart(
        order.note,
        "PHIEU_GIAO_HANG_1_PHAN:",
        partialNoteValue,
      );

      const nextOrder: OrderDetail = {
        ...order,
        note: nextNote,
        isPartialDelivery: true,
        partialReason: partialDraft.reason || "Giao hàng 1 phần",
        partialDeliveries: savedRecord
          ? [savedRecord, ...(order.partialDeliveries || []).filter((item) => item.id !== savedRecord.id)]
          : order.partialDeliveries || [],
      };

      setOrder(nextOrder);
      if (draftOrder) {
        setDraftOrder({
          ...draftOrder,
          note: nextNote,
          isPartialDelivery: true,
          partialReason: partialDraft.reason || "Giao hàng 1 phần",
          partialDeliveries: nextOrder.partialDeliveries,
        });
      }

      setShowPartialDeliveryModal(false);
      setMessage("Đã lưu phiếu giao hàng 1 phần.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Không lưu được phiếu giao hàng 1 phần.",
      );
    } finally {
      setPartialSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!draftOrder || !order) return;

    try {
      setSaving(true);
      setMessage("");

      const sanitizedItems = (draftOrder.items || []).map((item) => {
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);

        return {
          id: String(item.id),
          productName: item.productName || "",
          sku: item.sku || "",
          color: item.color || "",
          size: item.size || "",
          qty,
          unitPrice,
          lineTotal: qty * unitPrice,
        };
      });

      const totalAmount = sanitizedItems.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0,
      );

      const payload = {
        customerName: draftOrder.customerName || "",
        customerPhone: draftOrder.customerPhone || "",
        salesChannel: draftOrder.salesChannel || "",
        note: draftOrder.note || "",
        shippingRecipientName: draftOrder.shippingRecipientName || "",
        shippingPhone: draftOrder.shippingPhone || "",
        shippingEmail: draftOrder.shippingEmail || "",
        shippingAddressLine1: draftOrder.shippingAddressLine1 || "",
        shippingAddressLine2: draftOrder.shippingAddressLine2 || "",
        shippingWard: draftOrder.shippingWard || "",
        shippingDistrict: draftOrder.shippingDistrict || "",
        shippingProvince: draftOrder.shippingProvince || "",
        shippingPostalCode: draftOrder.shippingPostalCode || "",
        shippingGhnDistrictId: draftOrder.shippingGhnDistrictId || null,
        shippingGhnWardCode: draftOrder.shippingGhnWardCode || null,
        shippingFee: Number(draftOrder.shippingFee || 0),
        discountAmount: Number(draftOrder.discountAmount || 0),
        totalAmount,
        finalAmount:
          totalAmount -
          Number(draftOrder.discountAmount || 0) +
          Number(draftOrder.shippingFee || 0),
        items: sanitizedItems,
      };

      const res = await apiFetch(`/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || "Lưu thay đổi thất bại.");
      }

      const nextOrder = json || { ...order, ...payload };
      setOrder(nextOrder);
      setDraftOrder(nextOrder);
      setIsEditing(false);
      setMessage("Đã lưu thay đổi đơn hàng.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lưu thay đổi thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyOrder = () => {
    if (!viewOrder) return;
    router.push(`/orders/create?copyFrom=${encodeURIComponent(viewOrder.id)}`);
  };

  const handleInternalCancelOrder = async () => {
    if (!order) return;
    const ok = window.confirm(
      `Huỷ nội bộ đơn ${order.orderCode}? Nút này chỉ đổi trạng thái trong hệ thống, không gửi lệnh huỷ sang GHN.`,
    );
    if (!ok) return;

    try {
      setSaving(true);
      setMessage("");
      const updated = await updateOrderStatus(order.id, "CANCELLED");
      const nextOrder = { ...order, ...updated } as OrderDetail;
      setOrder(nextOrder);
      setDraftOrder(nextOrder);
      setMessage("Đã huỷ đơn nội bộ.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không huỷ được đơn nội bộ.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!order) return;
    const carrierLabel = getCarrierLabel(order, meta);
    const carrierCode = getCarrierCode(order, meta);
    const ok = window.confirm(
      `Huỷ ${carrierLabel} cho đơn ${order.orderCode}? Nút này gửi yêu cầu huỷ vận đơn sang ${carrierLabel}.`,
    );
    if (!ok) return;

    try {
      setSaving(true);
      setMessage("");
      const cancelPath = carrierCode.includes("AHAMOVE")
        ? `/shipments/${order.id}/ahamove/cancel`
        : carrierCode.includes("VIETTEL")
          ? `/shipments/${order.id}/viettelpost/cancel`
          : `/shipments/${order.id}/cancel`;

      const res = await apiFetch(cancelPath, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || json?.error || `Huỷ ${carrierLabel} thất bại.`);
      }

      const nextOrder = {
        ...order,
        ...(json?.order || json || {}),
      } as OrderDetail;
      setOrder(nextOrder);
      setDraftOrder(nextOrder);
      setMessage(`Đã gửi yêu cầu huỷ ${carrierLabel}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Huỷ ${carrierLabel} thất bại.`);
    } finally {
      setSaving(false);
    }
  };


  const handleCreateShipmentFromOrder = async (carrier: "ghn" | "ahamove" | "viettelpost") => {
    if (!order) return;

    const carrierLabel =
      carrier === "ahamove"
        ? "AhaMove"
        : carrier === "viettelpost"
          ? "Viettel Post"
          : "GHN";

    if (!order.shippingPhone && !order.customerPhone) {
      setMessage("Thiếu số điện thoại người nhận, chưa thể đẩy vận chuyển.");
      return;
    }

    const address = buildAddress(order, parseStructuredNote(order.note));
    if (!address || address === "—") {
      setMessage("Thiếu địa chỉ giao hàng, chưa thể đẩy vận chuyển.");
      return;
    }

    const requiredNoteLabel = carrierRequiredNoteLabel(parseStructuredNote(order.note).shippingNote);
    const requiredNote = normalizeCarrierRequiredNote(parseStructuredNote(order.note).shippingNote);
    const customerFacingShippingNote = [
      requiredNoteLabel,
      parseStructuredNote(order.note).shippingNote,
    ]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join(" | ");

    if (carrier === "ghn" && (!order.shippingGhnDistrictId || !order.shippingGhnWardCode)) {
      setMessage("GHN cần đủ Quận/Huyện và Phường/Xã. Bấm Sửa đơn hàng hoặc Sửa giao hàng để chọn lại địa chỉ trước.");
      return;
    }

    const ok = window.confirm(`Đẩy đơn ${order.orderCode} qua ${carrierLabel}?`);
    if (!ok) return;

    try {
      setSaving(true);
      setMessage("");

      const items = (order.items || []).map((item) => ({
        name: item.productName || item.sku || "Sản phẩm",
        quantity: Number(item.qty || 1),
        qty: Number(item.qty || 1),
        num: Number(item.qty || 1),
        price: Number(item.unitPrice || 0),
        length: 10,
        width: 10,
        height: 10,
        weight: 200,
      }));

      const basePayload = {
        toName: order.shippingRecipientName || order.customerName || "Khách hàng",
        toPhone: order.shippingPhone || order.customerPhone || "",
        toAddress: address,
        codAmount: amountDue,
        clientOrderCode: order.orderCode,
        orderCode: order.orderCode,
        note: customerFacingShippingNote,
        shippingNote: customerFacingShippingNote,
        deliveryRequirement: requiredNote,
        requiredNote,
        required_note: requiredNote,
        requiredNoteLabel,
        content: order.orderCode,
        productPrice: shownFinalAmount,
        insuranceValue: shownFinalAmount,
        weight: 200,
        length: 10,
        width: 10,
        height: 10,
        items,
      };

      const path =
        carrier === "ahamove"
          ? `/shipments/${order.id}/ahamove/create`
          : carrier === "viettelpost"
            ? `/shipments/${order.id}/viettelpost/create`
            : `/shipments/${order.id}/ghn/create`;

      const payload =
        carrier === "ghn"
          ? {
              ...basePayload,
              toDistrictId: Number(order.shippingGhnDistrictId),
              toWardCode: String(order.shippingGhnWardCode || ""),
            }
          : carrier === "viettelpost"
            ? {
                ...basePayload,
                province: order.shippingProvince || "",
                district: order.shippingDistrict || "",
                ward: order.shippingWard || "",
                toProvince: order.shippingProvince || "",
                toDistrict: order.shippingDistrict || "",
                toWard: order.shippingWard || "",
              }
            : basePayload;

      const res = await apiFetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || json?.error || `Đẩy ${carrierLabel} thất bại.`);
      }

      const nextOrder = {
        ...order,
        ...(json?.order || {}),
        shipment: json?.shipment || json?.data?.shipment || json?.order?.shipment || json?.data || json || order.shipment,
      } as OrderDetail;

      setOrder(nextOrder);
      setDraftOrder(nextOrder);
      setMessage(`Đã đẩy đơn qua ${carrierLabel}.`);
      void refreshShipmentTracking(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Đẩy ${carrierLabel} thất bại.`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!viewOrder) return;

    const templates = loadPrintTemplates();

    const shippingTemplate = findPrintTemplate({
      templates,
      branchId: viewOrder.branchId || undefined,
      templateType: "shipping",
      paperSize: "80mm",
    });

    if (!shippingTemplate) {
      setMessage("Chưa có mẫu in phiếu giao hàng cho chi nhánh này.");
      return;
    }

    const html = renderOrderTemplateHtml({
      order: {
        ...viewOrder,
        totalAmount: Number(itemsSubtotal || viewOrder.totalAmount || 0),
        finalAmount: Number(shownFinalAmount || computedFinalAmount || 0),
        shippingFee: Number(viewOrder.shippingFee || 0),
        shipment: viewOrder.shipment || undefined,
        items: viewOrder.items || [],
        warehouseName:
          viewOrder.branchId === "b1"
            ? "THE 1970 - Hoàn Kiếm"
            : viewOrder.branchId === "b2"
              ? "THE 1970 - Thái Hà"
              : viewOrder.branchId === "b3"
                ? "THE 1970 - Chùa Láng"
                : viewOrder.branchId === "qo-warehouse"
                  ? "THE 1970 - Kho QO"
                  : "THE 1970",
        warehousePhone: "0975615475",
        warehouseAddress: "",
      },
      template: shippingTemplate,
    });

    openPrintDocument({
      title: `Phieu-giao-hang-${viewOrder.orderCode}`,
      paperSize: "80mm",
      bodyHtml: `<div class="print-page">${html}</div>`,
    });
  };

  if (loading) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-neutral-500">
          Đang tải chi tiết đơn hàng...
        </p>
      </Panel>
    );
  }

  if (error || !viewOrder) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-red-600">
          {error || "Không tìm thấy đơn hàng."}
        </p>
      </Panel>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-3 lg:space-y-3 lg:p-4">
      {showCreatedToast ? (
        <div className="fixed right-4 top-4 z-50 w-[360px] rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              ✓
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">
                Tạo đơn thành công
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Mã đơn: {viewOrder?.orderCode || "—"}
                {tracking ? ` • Mã vận đơn: ${tracking}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreatedToast(false)}
              className="text-sm text-neutral-400 hover:text-neutral-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {showCodSuccessToast ? (
        <div className="fixed right-4 top-20 z-[80] w-[390px] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              ✓
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">
                Sửa COD thành công
              </p>
              <p className="mt-1 text-xs text-neutral-600">{codSuccessText}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCodSuccessToast(false)}
              className="text-sm text-neutral-400 hover:text-neutral-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <MobileOrderDetailView
        viewOrder={viewOrder}
        meta={meta}
        fullAddress={fullAddress}
        totalItems={totalItems}
        itemsSubtotal={itemsSubtotal}
        shownFinalAmount={shownFinalAmount}
        customerPaid={customerPaid}
        amountDue={amountDue}
        paymentsTotal={paymentsTotal}
        paymentLines={paymentLines}
        partialDelivery={partialDelivery}
        saving={saving}
        canEdit={canEdit}
        shipmentEditable={shipmentEditable}
        codEditable={codEditable}
        redeliveryAvailable={redeliveryAvailable}
        orderHistory={orderHistory}
        onPrint={handlePrint}
        onCopyOrder={handleCopyOrder}
        onInternalCancel={handleInternalCancelOrder}
        onCancelShipment={handleCancelShipment}
        onOpenShipmentEdit={handleOpenShipmentEdit}
        onOpenCodEdit={() => handleOpenCodEdit("normal")}
        canCreateShipment={canCreateShipment}
        onCreateShipment={handleCreateShipmentFromOrder}
      />

      <div className="hidden lg:block">
        <div className="flex items-center justify-between rounded-[18px] border border-neutral-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="min-w-0">
            <Link
              href="/orders"
              className="text-[11px] text-neutral-500 transition hover:text-neutral-900"
            >
              ← Quay lại danh sách đơn hàng
            </Link>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-[16px] font-semibold tracking-tight text-neutral-900">
                {viewOrder.orderCode}
              </h1>
              <Badge tone={toneForOrderStatus(viewOrder.status)}>
                {orderStatusText(viewOrder.status)}
              </Badge>
              <Badge tone={toneForPaymentStatus(viewOrder.paymentStatus)}>
                {paymentStatusText(viewOrder.paymentStatus)}
              </Badge>
              {partialDelivery ? (
                <Badge tone="amber">Giao hàng 1 phần</Badge>
              ) : null}
            </div>
          </div>

          <div className="ml-4 flex items-start gap-3">
            <div className="hidden xl:block">
              <Timeline order={viewOrder} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={handlePrint}>In đơn hàng</ActionButton>
              <ActionButton onClick={handleCopyOrder}>
                Sao chép đơn
              </ActionButton>
              <ActionButton
                tone="danger"
                disabled={
                  saving ||
                  !canCancelOrderPermission ||
                  viewOrder.status === "CANCELLED" ||
                  viewOrder.status === "COMPLETED"
                }
                onClick={handleInternalCancelOrder}
              >
                Huỷ nội bộ
              </ActionButton>
              {viewOrder.shipment?.trackingCode && openTrackingUrl ? (
                <a
                  href={openTrackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
                >
                  {`Mở ${getCarrierLabel(viewOrder, meta)}`}
                </a>
              ) : null}
              {viewOrder.shipment?.trackingCode && canPackShipOrderPermission ? (
                <ActionButton disabled={saving} onClick={handleCancelShipment}>
                  {`Huỷ ${getCarrierLabel(viewOrder, meta)}`}
                </ActionButton>
              ) : null}
              {canCreateShipment ? (
                <>
                  <ActionButton
                    tone="dark"
                    disabled={saving}
                    onClick={() => void handleCreateShipmentFromOrder("ghn")}
                  >
                    Đẩy GHN
                  </ActionButton>
                  <ActionButton
                    disabled={saving}
                    onClick={() => void handleCreateShipmentFromOrder("viettelpost")}
                  >
                    Đẩy Viettel
                  </ActionButton>
                  <ActionButton
                    disabled={saving}
                    onClick={() => void handleCreateShipmentFromOrder("ahamove")}
                  >
                    Đẩy Aha
                  </ActionButton>
                </>
              ) : null}

              {canCreateReturnPermission ? (
                <Link
                  href={`/returns/create?orderId=${viewOrder.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  Đổi / Trả hàng
                </Link>
              ) : null}

              {!isEditing ? (
                <ActionButton
                  disabled={!canEdit}
                  onClick={() => {
                    if (!order) return;

                    const metaNote = parseStructuredNote(order.note);

                    setDraftOrder({
                      ...order,
                      shippingRecipientName:
                        order.shippingRecipientName || order.customerName || "",
                      shippingPhone:
                        order.shippingPhone || order.customerPhone || "",
                      shippingAddressLine1:
                        order.shippingAddressLine1 || metaNote.address || "",
                      shippingProvince: order.shippingProvince || "",
                      note: metaNote.noteText || metaNote.shippingNote || "",
                    });

                    setSelectedProvinceId("");
                    setSelectedDistrictId("");
                    setSelectedWardCode("");
                    void loadProvinces();

                    setIsEditing(true);
                    setMessage("");
                  }}
                >
                  Sửa đơn hàng
                </ActionButton>
              ) : (
                <>
                  <ActionButton
                    tone="dark"
                    disabled={saving}
                    onClick={() => void handleSaveEdit()}
                  >
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </ActionButton>
                  <ActionButton disabled={saving} onClick={handleCancelEdit}>
                    Huỷ
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        </div>

        {message ? (
          <Panel className="px-4 py-3">
            <p
              className={`text-sm ${message.includes("Đã lưu") ||
                  message.includes("Đã cập nhật") ||
                  message.includes("Đã xác thực")
                  ? "text-emerald-600"
                  : "text-red-600"
                }`}
            >
              {message}
            </p>
          </Panel>
        ) : null}

        {viewOrder.shipment?.trackingCode ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Panel className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                Đơn vị
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={carrierBadgeTone(viewOrder.shipment?.carrier)}>
                  {getCarrierLabel(viewOrder, meta)}
                </Badge>
                <span className="truncate text-xs font-semibold text-neutral-900">
                  {viewOrder.shipment?.trackingCode || "—"}
                </span>
              </div>
            </Panel>
            <Panel className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                Trạng thái realtime
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950">
                {currentShipmentLabel}
              </p>
            </Panel>
            <Panel className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                Tài xế
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-neutral-950">
                {driverInfo.name}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {driverInfo.plate || driverInfo.phone || "Đang chờ phân tài xế"}
              </p>
            </Panel>
            <Panel className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                ETA / vị trí
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-neutral-950">
                {driverInfo.eta || "—"}
              </p>
              <p className="mt-1 truncate text-[11px] text-neutral-500">
                {driverInfo.location || "Chưa có vị trí"}
              </p>
            </Panel>
          </div>
        ) : null}

        {viewOrder.shipment?.trackingCode ? (
          <div className="mt-4">
            <ShipmentRealtimeTimeline
              timeline={shipmentTimeline}
              refreshing={trackingRefreshing}
              message={trackingMessage}
              onRefresh={() => void refreshShipmentTracking(true)}
            />
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[2.3fr_0.6fr]">
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-[1.8fr_0.7fr]">
              <Panel>
                <SectionHeader
                  title="Thông tin khách hàng"
                  subtitle="Người mua, người nhận, địa chỉ."
                />
                <div className="space-y-3 px-4 py-3">
                  {isEditing ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Người nhận
                        </p>
                        <EditInput
                          value={draftOrder?.shippingRecipientName}
                          onChange={(v) =>
                            updateDraft("shippingRecipientName", v)
                          }
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] text-neutral-500">
                          SĐT nhận
                        </p>
                        <EditInput
                          value={draftOrder?.shippingPhone}
                          onChange={(v) => updateDraft("shippingPhone", v)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Địa chỉ dòng 1
                        </p>
                        <EditInput
                          value={draftOrder?.shippingAddressLine1}
                          onChange={(v) =>
                            updateDraft("shippingAddressLine1", v)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Địa chỉ dòng 2
                        </p>
                        <EditInput
                          value={draftOrder?.shippingAddressLine2}
                          onChange={(v) =>
                            updateDraft("shippingAddressLine2", v)
                          }
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Tỉnh / thành
                        </p>
                        <SearchableEditSelect
                          value={selectedProvinceId}
                          onChange={handleEditProvinceChange}
                          options={provinceOptions.map((item) => ({
                            value: String(item.id),
                            label: item.name,
                          }))}
                          placeholder="Chọn tỉnh / thành"
                          searchPlaceholder="Gõ tỉnh/thành, ví dụ: dak lak"
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Quận / huyện
                        </p>
                        <SearchableEditSelect
                          value={selectedDistrictId}
                          onChange={handleEditDistrictChange}
                          options={districtOptions.map((item) => ({
                            value: String(item.id),
                            label: item.name,
                          }))}
                          placeholder="Chọn quận / huyện"
                          searchPlaceholder="Gõ quận/huyện, ví dụ: krong bong"
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Phường / xã
                        </p>
                        <SearchableEditSelect
                          value={selectedWardCode}
                          onChange={handleEditWardChange}
                          options={wardOptions.map((item) => ({
                            value: item.code,
                            label: item.name,
                          }))}
                          placeholder="Chọn phường / xã"
                          searchPlaceholder="Gõ phường/xã, ví dụ: hoa phong"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] text-neutral-500">
                          Mã bưu chính
                        </p>
                        <EditInput
                          value={draftOrder?.shippingPostalCode}
                          onChange={(v) => updateDraft("shippingPostalCode", v)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <DataRow
                        label="Khách hàng"
                        value={
                          viewOrder.customerName ||
                          viewOrder.customer?.fullName ||
                          "—"
                        }
                      />
                      <DataRow
                        label="SĐT"
                        value={
                          viewOrder.customerPhone ||
                          viewOrder.customer?.phone ||
                          "—"
                        }
                      />
                      <DataRow
                        label="Người nhận"
                        value={
                          viewOrder.shippingRecipientName ||
                          viewOrder.customerName ||
                          "—"
                        }
                      />
                      <DataRow
                        label="SĐT nhận"
                        value={
                          viewOrder.shippingPhone ||
                          viewOrder.customerPhone ||
                          "—"
                        }
                      />
                      <DataRow label="Địa chỉ" value={fullAddress} />
                      <DataRow label="Ghi chú" value={meta.noteText || "—"} />
                    </>
                  )}
                </div>
              </Panel>

              <Panel>
                <SectionHeader title="Tổng quan" subtitle="Số liệu nhanh." />
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500">Nợ phải thu</span>
                    <span className="font-semibold text-red-600">
                      {currency(amountDue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500">Tổng chi tiêu</span>
                    <span className="font-semibold text-neutral-900">
                      {currency(shownFinalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500">Trả hàng</span>
                    <span className="font-semibold text-neutral-900">0đ</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500">Thất bại</span>
                    <span className="font-semibold text-neutral-900">0đ</span>
                  </div>
                </div>
              </Panel>
            </div>

            <Panel>
              <SectionHeader
                title="Thanh toán"
                subtitle="Tổng tiền, đã thanh toán và còn lại."
              />
              <div className="space-y-3 px-4 py-3">
                {isEditing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] text-neutral-500">
                        Giảm giá
                      </p>
                      <EditInput
                        type="number"
                        value={draftOrder?.discountAmount || 0}
                        onChange={(v) =>
                          updateDraft("discountAmount", Number(v || 0))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-neutral-500">
                        Phí ship
                      </p>
                      <EditInput
                        type="number"
                        value={draftOrder?.shippingFee || 0}
                        onChange={(v) =>
                          updateDraft("shippingFee", Number(v || 0))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 md:grid-cols-3">
                  <MiniStat label="Tiền hàng" value={currency(itemsSubtotal)} />
                  <MiniStat
                    label="Giảm giá"
                    value={currency(viewOrder.discountAmount)}
                  />
                  <MiniStat
                    label="Phí ship"
                    value={currency(viewOrder.shippingFee)}
                  />
                  <MiniStat
                    label="Tổng cần thu"
                    value={currency(shownFinalAmount)}
                  />
                  <MiniStat
                    label="Đã thanh toán"
                    value={currency(customerPaid)}
                  />
                  <MiniStat
                    label="Còn phải trả"
                    value={currency(amountDue)}
                    tone="danger"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={toneForPaymentStatus(viewOrder.paymentStatus)}>
                    {paymentStatusText(viewOrder.paymentStatus)}
                  </Badge>
                  {viewOrder.shipment?.codAmount ? (
                    <span className="text-[12px] text-neutral-600">
                      COD {currency(viewOrder.shipment.codAmount)}
                    </span>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-neutral-900">
                      Chi tiết nguồn tiền
                    </p>
                    <span className="text-[11px] text-neutral-500">
                      Tổng {currency(paymentsTotal)}
                    </span>
                  </div>

                  {paymentLines.length ? (
                    <div className="space-y-2">
                      {paymentLines.map((payment, index) => (
                        <div
                          key={
                            payment.id ||
                            `${payment.paymentSourceId || "pay"}-${index}`
                          }
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-[12px]"
                        >
                          <div>
                            <p className="font-semibold text-neutral-900">
                              {paymentSourceLabel(payment)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-neutral-500">
                              {paymentStatusText(payment.status)}
                              {payment.paidAt
                                ? ` · ${formatDateTime(payment.paidAt)}`
                                : ""}
                            </p>
                          </div>
                          <p className="font-semibold text-neutral-900">
                            {currency(payment.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-neutral-500">
                      Chưa có dòng thanh toán chi tiết.
                    </p>
                  )}
                </div>
              </div>
            </Panel>

            {!isPOSOrder ? (
              <Panel>
                <SectionHeader
                  title="Đóng gói và giao hàng"
                  subtitle="Mã vận đơn, đối tác, phí ship."
                  action={
                    <div className="flex flex-wrap gap-2">
                      {canCreateShipment ? (
                        <>
                          <ActionButton
                            tone="dark"
                            disabled={saving}
                            onClick={() => void handleCreateShipmentFromOrder("ghn")}
                          >
                            Đẩy GHN
                          </ActionButton>
                          <ActionButton
                            disabled={saving}
                            onClick={() => void handleCreateShipmentFromOrder("viettelpost")}
                          >
                            Đẩy Viettel
                          </ActionButton>
                          <ActionButton
                            disabled={saving}
                            onClick={() => void handleCreateShipmentFromOrder("ahamove")}
                          >
                            Đẩy Aha
                          </ActionButton>
                        </>
                      ) : null}
                      {shipmentEditable ? (
                        <ActionButton onClick={handleOpenShipmentEdit}>
                          Sửa giao hàng
                        </ActionButton>
                      ) : null}

                      {codEditable ? (
                        <>
                          <ActionButton onClick={() => handleOpenCodEdit("normal")}>
                            SỬA COD ĐỔI HÀNG
                          </ActionButton>
                          <ActionButton tone="danger" onClick={() => handleOpenCodEdit("partial")}>
                            SỬA COD GIAO HÀNG 1 PHẦN
                          </ActionButton>
                        </>
                      ) : null}

                      {redeliveryAvailable ? (
                        <ActionButton
                          tone="dark"
                          onClick={() =>
                            setMessage("Flow giao lại sẽ làm ở bước sau")
                          }
                        >
                          Giao lại
                        </ActionButton>
                      ) : null}
                    </div>
                  }
                />

                <div className="space-y-3 px-4 py-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <MiniStat
                      label="Cho đẩy hãng"
                      value={canCreateShipment ? "Có" : "Không"}
                      tone={canCreateShipment ? "success" : "default"}
                    />
                    <MiniStat
                      label="Cho sửa giao hàng"
                      value={shipmentEditable ? "Có" : "Không"}
                      tone={shipmentEditable ? "success" : "default"}
                    />
                    <MiniStat
                      label="Cho sửa COD"
                      value={codEditable ? "Có" : "Không"}
                      tone={codEditable ? "success" : "default"}
                    />
                    <MiniStat
                      label="Cho giao lại"
                      value={redeliveryAvailable ? "Có" : "Không"}
                      tone={redeliveryAvailable ? "danger" : "default"}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {viewOrder.shipment?.id ? (
                      <Link
                        href={`/control/shipments/${viewOrder.shipment.id}`}
                        className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {viewOrder.shipment?.trackingCode ||
                          tracking ||
                          "Chưa có mã vận đơn"}
                      </Link>
                    ) : (
                      <Badge
                        tone={
                          viewOrder.shipment?.trackingCode ? "blue" : "gray"
                        }
                      >
                        {viewOrder.shipment?.trackingCode ||
                          tracking ||
                          "Chưa có mã vận đơn"}
                      </Badge>
                    )}

                    <Badge
                      tone={
                        viewOrder.shipment?.shippingStatus ? "amber" : "gray"
                      }
                    >
                      {viewOrder.shipment?.shippingStatus ||
                        "Chưa đẩy trạng thái"}
                    </Badge>

                    <Badge
                      tone={codReconciliationTone(
                        viewOrder.shipment?.codReconciliationStatus,
                      )}
                    >
                      {codReconciliationLabel(
                        viewOrder.shipment?.codReconciliationStatus,
                      )}
                    </Badge>
                  </div>
                </div>
              </Panel>
            ) : null}

            {partialDelivery && currentPartialDelivery ? (
              <Panel>
                <SectionHeader
                  title="Phiếu giao hàng 1 phần"
                  subtitle="Ghi nhận phần khách thực nhận để điều chỉnh COD và phục vụ đối soát."
                />
                <div className="space-y-4 px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-[11px] text-neutral-500">
                        Tổng đơn gốc
                      </p>
                      <p className="mt-2 text-[18px] font-semibold text-neutral-900">
                        {currency(
                          itemsSubtotal + Number(viewOrder.shippingFee || 0),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-[11px] text-neutral-500">Phí ship</p>
                      <p className="mt-2 text-[18px] font-semibold text-neutral-900">
                        {currency(viewOrder.shippingFee)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-[11px] text-red-600">COD ban đầu</p>
                      <p className="mt-2 text-[18px] font-semibold text-red-700">
                        {currency(
                          itemsSubtotal + Number(viewOrder.shippingFee || 0),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[11px] text-emerald-600">
                        COD sau điều chỉnh
                      </p>
                      <p className="mt-2 text-[18px] font-semibold text-emerald-700">
                        {currency(viewOrder.shipment?.codAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-[12px]">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-neutral-500">Thông tin phiếu</p>
                          <p className="mt-1 text-[15px] font-semibold text-neutral-900">
                            {currentPartialDelivery?.code || "Phiếu giao hàng 1 phần"}
                          </p>
                        </div>
                        {currentPartialDelivery?.id ? (
                          <Link
                            href={`/orders/${viewOrder.id}/partial-deliveries/${currentPartialDelivery.id}`}
                            className="rounded-full border border-neutral-300 px-3 py-1 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50"
                          >
                            Xem chi tiết phiếu
                          </Link>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <DataRow label="Ngày xử lý" value={formatDateTime(currentPartialDelivery?.handledAt || currentPartialDelivery?.createdAt)} />
                        <DataRow label="Người xử lý" value={currentPartialDelivery?.approvedBy || "—"} />
                        <DataRow label="Mã vận đơn" value={currentPartialDelivery?.ghnTrackingCode || viewOrder.shipment?.trackingCode || "—"} />
                        <DataRow
                          label="Lý do"
                          value={currentPartialDelivery?.reason || viewOrder.partialReason || "Đơn đã được xử lý theo flow giao hàng 1 phần."}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12px]">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-amber-700">Đơn hoàn đuôi PR</p>
                          <p className="mt-1 text-[15px] font-semibold text-neutral-900">
                            {currentPartialDelivery?.returnTrackingCode || currentPartialDelivery?.returnOrderCode || currentPartialDelivery?.returnOrder?.shipment?.trackingCode || `${viewOrder.shipment?.trackingCode || viewOrder.orderCode}_PR`}
                          </p>
                        </div>
                        <Badge tone={partialReturnStatusTone(currentPartialDelivery?.returnStatus)}>
                          {partialReturnStatusText(currentPartialDelivery?.returnStatus)}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <DataRow
                          label="Mã hoàn"
                          value={
                            currentPartialDelivery?.returnTrackingCode ||
                            currentPartialDelivery?.returnOrderCode ||
                            currentPartialDelivery?.returnOrder?.shipment?.trackingCode ||
                            `${viewOrder.shipment?.trackingCode || viewOrder.orderCode}_PR`
                          }
                        />
                        <DataRow label="Vận đơn hoàn" value={currentPartialDelivery?.returnTrackingCode || currentPartialDelivery?.returnOrderCode || currentPartialDelivery?.returnOrder?.shipment?.trackingCode || `${viewOrder.shipment?.trackingCode || viewOrder.orderCode}_PR`} />
                        <DataRow label="Trạng thái hoàn" value={partialReturnStatusText(currentPartialDelivery?.returnStatus)} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                      <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-[12px] font-semibold text-emerald-800">
                        Sản phẩm khách lấy
                      </div>
                      <table className="w-full text-[12px]">
                        <thead className="bg-neutral-50 text-[10px] uppercase text-neutral-500">
                          <tr>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-left">Sản phẩm</th>
                            <th className="px-3 py-2 text-right">SL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getPartialRecordItems(currentPartialDelivery, "KEPT").length ? (
                            getPartialRecordItems(currentPartialDelivery, "KEPT").map((item, index) => (
                              <tr key={`${item.id || item.sku}-kept-${index}`} className="border-t border-neutral-100">
                                <td className="px-3 py-2 font-medium text-neutral-900">{item.sku || "—"}</td>
                                <td className="px-3 py-2 text-neutral-700">{item.productName || "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold">{Number(item.qty || item.deliveredQty || 0)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={3} className="px-3 py-4 text-center text-neutral-400">Chưa có dữ liệu khách lấy</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white">
                      <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-800">
                        Sản phẩm hoàn về
                      </div>
                      <table className="w-full text-[12px]">
                        <thead className="bg-neutral-50 text-[10px] uppercase text-neutral-500">
                          <tr>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-left">Sản phẩm</th>
                            <th className="px-3 py-2 text-right">SL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getPartialRecordItems(currentPartialDelivery, "RETURNED").length ? (
                            getPartialRecordItems(currentPartialDelivery, "RETURNED").map((item, index) => (
                              <tr key={`${item.id || item.sku}-returned-${index}`} className="border-t border-neutral-100">
                                <td className="px-3 py-2 font-medium text-neutral-900">{item.sku || "—"}</td>
                                <td className="px-3 py-2 text-neutral-700">{item.productName || "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold">{Number(item.qty || item.returnedQty || 0)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={3} className="px-3 py-4 text-center text-neutral-400">Chưa có dữ liệu hoàn về</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Panel>
            ) : null}

            <Panel className="overflow-visible">
              <SectionHeader
                title="Sản phẩm"
                subtitle={`${totalItems} món trong đơn hàng`}
                action={
                  isEditing ? (
                    <ActionButton onClick={addDraftItem}>
                      + Thêm sản phẩm
                    </ActionButton>
                  ) : null
                }
              />
              <div className={isEditing ? "overflow-visible" : "overflow-auto"}>
                <table className="w-full min-w-[1160px] border-collapse">
                  <thead className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="w-[56px] border-b border-neutral-200 px-3 py-2.5">
                        STT
                      </th>
                      <th className="w-[360px] border-b border-neutral-200 px-3 py-2.5">
                        Tên sản phẩm
                      </th>
                      <th className="w-[170px] border-b border-neutral-200 px-3 py-2.5">
                        SKU
                      </th>
                      <th className="w-[140px] border-b border-neutral-200 px-3 py-2.5">
                        Màu
                      </th>
                      <th className="w-[110px] border-b border-neutral-200 px-3 py-2.5">
                        Size
                      </th>
                      <th className="w-[100px] border-b border-neutral-200 px-3 py-2.5 text-center">
                        SL
                      </th>
                      <th className="w-[140px] border-b border-neutral-200 px-3 py-2.5 text-right">
                        Đơn giá
                      </th>
                      <th className="w-[140px] border-b border-neutral-200 px-3 py-2.5 text-right">
                        Thành tiền
                      </th>
                      {isEditing ? (
                        <th className="w-[110px] border-b border-neutral-200 px-3 py-2.5 text-right">
                          Thao tác
                        </th>
                      ) : null}
                    </tr>
                  </thead>

                  <tbody>
                    {(viewOrder.items || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={isEditing ? 9 : 8}
                          className="px-3 py-5 text-sm text-neutral-500"
                        >
                          Không có sản phẩm.
                        </td>
                      </tr>
                    ) : (
                      (viewOrder.items || []).map((item, index) => (
                        <tr
                          key={item.id}
                          className="transition hover:bg-neutral-50"
                        >
                          <td className="border-b border-neutral-100 px-3 py-2.5">
                            {index + 1}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 align-top">
                            {isEditing ? (
                              <div className="min-w-[340px]">
                                <ProductPicker
                                  value={item.productName || item.sku || ""}
                                  onSelect={(variant) => {
                                    updateDraftItem(item.id, {
                                      productName: variant.productName,
                                      sku: variant.sku,
                                      color: variant.color,
                                      size: variant.size,
                                      unitPrice: variant.price,
                                    });
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="font-medium text-[12px] text-neutral-900">
                                {item.productName || "—"}
                              </div>
                            )}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 text-[12px]">
                            {isEditing ? (
                              <input
                                value={item.sku || ""}
                                disabled
                                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3 text-[12px]"
                              />
                            ) : (
                              item.sku || "—"
                            )}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 text-[12px]">
                            {isEditing ? (
                              <input
                                value={item.color || ""}
                                disabled
                                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3 text-[12px]"
                              />
                            ) : (
                              item.color || "—"
                            )}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 text-[12px]">
                            {isEditing ? (
                              <input
                                value={item.size || ""}
                                disabled
                                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3 text-[12px]"
                              />
                            ) : (
                              item.size || "—"
                            )}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 text-center text-[12px]">
                            {isEditing ? (
                              <EditInput
                                type="number"
                                value={item.qty}
                                onChange={(v) =>
                                  updateDraftItem(item.id, {
                                    qty: Math.max(Number(v || 0), 0),
                                  })
                                }
                              />
                            ) : (
                              item.qty
                            )}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 text-right text-[12px]">
                            {isEditing ? (
                              <EditInput
                                type="number"
                                value={item.unitPrice}
                                onChange={(v) =>
                                  updateDraftItem(item.id, {
                                    unitPrice: Math.max(Number(v || 0), 0),
                                  })
                                }
                              />
                            ) : (
                              currency(item.unitPrice)
                            )}
                          </td>

                          <td className="border-b border-neutral-100 px-3 py-2.5 text-right text-[12px] font-medium">
                            {currency(item.lineTotal)}
                          </td>

                          {isEditing ? (
                            <td className="border-b border-neutral-100 px-3 py-2.5 text-right">
                              <ActionButton
                                tone="danger"
                                onClick={() => removeDraftItem(item.id)}
                              >
                                Xóa
                              </ActionButton>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-end justify-between px-4 py-3">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-neutral-900">
                    Tổng kết
                  </h3>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {totalItems} món · giảm giá{" "}
                    {currency(viewOrder.discountAmount)} · phí ship{" "}
                    {currency(viewOrder.shippingFee)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-neutral-500">Còn phải thu / COD</p>
                  <p className="mt-1 text-[20px] font-semibold tracking-tight text-red-600">
                    {currency(amountDue)}
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-3">
            <Panel>
              <SectionHeader
                title="Thông tin đơn hàng"
                subtitle="Thông tin vận hành và trạng thái."
              />
              <div className="space-y-3 px-4 py-3">
                {isEditing ? (
                  <>
                    <div>
                      <p className="mb-1 text-[11px] text-neutral-500">
                        Kênh bán
                      </p>
                      <EditInput
                        value={draftOrder?.salesChannel}
                        onChange={(v) => updateDraft("salesChannel", v)}
                      />
                    </div>
                    <DataRow label="Mã đơn" value={viewOrder.orderCode} />
                    <DataRow
                      label="Ngày bán"
                      value={
                        formatDateTime(viewOrder.soldAt) ||
                        viewOrder.createdAt ||
                        "—"
                      }
                    />
                    <DataRow
                      label="Ngày tạo"
                      value={viewOrder.createdAt || "—"}
                    />
                    <DataRow
                      label="Cập nhật"
                      value={viewOrder.updatedAt || "—"}
                    />
                    <DataRow
                      label="Nhân viên"
                      value={viewOrder.createdByStaffName || "—"}
                    />
                    <DataRow
                      label="Trạng thái"
                      value={orderStatusText(viewOrder.status)}
                    />
                    <DataRow
                      label="Thanh toán"
                      value={paymentStatusText(viewOrder.paymentStatus)}
                    />
                    <DataRow
                      label="Giao vận"
                      value={fulfillmentStatusText(viewOrder.fulfillmentStatus)}
                    />
                    <DataRow
                      label="Chi nhánh"
                      value={viewOrder.branchId || "—"}
                    />
                  </>
                ) : (
                  <>
                    <DataRow label="Mã đơn" value={viewOrder.orderCode} />
                    <DataRow
                      label="Ngày bán"
                      value={
                        formatDateTime(viewOrder.soldAt) ||
                        viewOrder.createdAt ||
                        "—"
                      }
                    />
                    <DataRow
                      label="Ngày tạo"
                      value={viewOrder.createdAt || "—"}
                    />
                    <DataRow
                      label="Cập nhật"
                      value={viewOrder.updatedAt || "—"}
                    />
                    <DataRow
                      label="Nhân viên"
                      value={viewOrder.createdByStaffName || "—"}
                    />
                    <DataRow
                      label="Trạng thái"
                      value={orderStatusText(viewOrder.status)}
                    />
                    <DataRow
                      label="Thanh toán"
                      value={paymentStatusText(viewOrder.paymentStatus)}
                    />
                    <DataRow
                      label="Giao vận"
                      value={fulfillmentStatusText(viewOrder.fulfillmentStatus)}
                    />
                    <DataRow
                      label="Chi nhánh"
                      value={viewOrder.branchId || "—"}
                    />
                    <DataRow
                      label="Kênh bán"
                      value={viewOrder.salesChannel || "—"}
                    />
                    <DataRow
                      label="Nguồn tiền"
                      value={
                        paymentLines.length
                          ? paymentLines
                            .map(
                              (p) =>
                                `${paymentSourceLabel(p)}: ${currency(p.amount)}`,
                            )
                            .join(" · ")
                          : "—"
                      }
                    />
                  </>
                )}
              </div>
            </Panel>

            {relatedReturns.length ? (
              <Panel>
                <SectionHeader
                  title="Phiếu đổi/trả liên quan"
                  subtitle="Các phiếu trả hàng, đổi hàng đã phát sinh từ đơn gốc này."
                />
                <div className="space-y-3 px-4 py-3">
                  {relatedReturns.map((row) => {
                    const returnAmount = Number(row.returnAmount || row.refundAmount || 0);
                    const exchangeAmount = Number(row.exchangeAmount || 0);
                    const shippingFee = Number(row.shippingFee || 0);
                    const differenceAmount = Number(row.differenceAmount || 0);

                    return (
                      <div
                        key={row.id || row.code}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Link
                              href={`/returns?returnId=${encodeURIComponent(row.id || row.code || "")}`}
                              className="text-[13px] font-bold text-blue-600 hover:underline"
                            >
                              {row.code || "Phiếu đổi/trả"}
                            </Link>
                            <p className="mt-1 text-[12px] text-neutral-700">
                              {returnExchangeTypeText(row.type)} · {returnExchangeStatusText(row.status)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-700">
                            Đổi/trả
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-[12px] text-neutral-700">
                          <DataRow label="Tiền trả" value={currency(returnAmount)} />
                          <DataRow label="Tiền đổi" value={currency(exchangeAmount)} />
                          <DataRow label="Phí ship" value={currency(shippingFee)} />
                          <DataRow
                            label="Chênh lệch"
                            value={differenceAmount ? currency(Math.abs(differenceAmount)) : "0đ"}
                          />
                          <DataRow
                            label="COD đơn đổi"
                            value={row.customerPayableAmount ? currency(Number(row.customerPayableAmount || 0)) : "—"}
                          />
                          <DataRow
                            label="Đơn đổi"
                            value={
                              row.exchangeOrderId || row.exchangeOrderCode ? (
                                <Link
                                  href={`/orders/${encodeURIComponent(row.exchangeOrderId || row.exchangeOrderCode || "")}`}
                                  className="font-semibold text-blue-600 hover:underline"
                                >
                                  {row.exchangeOrderCode || row.exchangeOrderId}
                                </Link>
                              ) : "—"
                            }
                          />
                          <DataRow label="HVC đơn đổi" value={row.exchangeCarrier || "—"} />
                          <DataRow label="Mã vận đơn" value={row.exchangeTrackingCode || "—"} />
                          <DataRow
                            label="Nhân viên xử lý"
                            value={row.handledByStaffName || "—"}
                          />
                          <DataRow label="Sản phẩm" value={summarizeReturnItems(row.items)} />
                          <DataRow label="Ngày tạo" value={row.createdAt || "—"} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ) : null}

            <Panel>
              <SectionHeader
                title="Lịch sử sửa đơn"
                subtitle="Theo dõi các mốc thay đổi quan trọng của đơn hàng."
              />
              <div className="space-y-3 px-4 py-3">
                {orderHistory.length ? (
                  orderHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-neutral-900">
                            {entry.title}
                          </p>
                          <p className="mt-1 text-[12px] text-neutral-600">
                            {entry.description}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-medium ${entry.tone === "success"
                              ? "bg-emerald-100 text-emerald-700"
                              : entry.tone === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-200 text-neutral-700"
                            }`}
                        >
                          {entry.tone === "success"
                            ? "Đã lưu"
                            : entry.tone === "warning"
                              ? "Cảnh báo"
                              : "Nội bộ"}
                        </span>
                      </div>
                      {entry.createdAt ? (
                        <p className="mt-2 text-[11px] text-neutral-500">
                          {entry.createdAt}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-neutral-500">
                    Chưa có lịch sử chỉnh sửa.
                  </p>
                )}
              </div>
            </Panel>

            <Panel>
              <SectionHeader title="Ghi chú" subtitle="Thông tin bổ sung." />
              <div className="space-y-3 px-4 py-3">
                {isEditing ? (
                  <EditTextarea
                    value={draftOrder?.note}
                    onChange={(v) => updateDraft("note", v)}
                    placeholder="Nhập ghi chú đơn hàng"
                  />
                ) : (
                  <>
                    <DataRow label="Ghi chú đơn" value={meta.noteText || "—"} />
                    <DataRow
                      label="Ghi chú giao"
                      value={meta.shippingNote || "—"}
                    />
                  </>
                )}
              </div>
            </Panel>

            <Panel>
              <SectionHeader title="Tags" subtitle="Phân loại nhanh." />
              <div className="space-y-2.5 px-4 py-3">
                <DataRow label="Tags" value={meta.tags || "Chưa có tag"} />
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {showPartialDeliveryModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[1080px] rounded-[24px] border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-[18px] font-semibold text-neutral-900">
                  Phiếu giao hàng 1 phần
                </p>
                <p className="mt-1 text-[12px] text-neutral-500">
                  Ghi nhận phần khách thực nhận để điều chỉnh COD và phục vụ đối
                  soát.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPartialDeliveryModal(false)}
                className="text-sm text-neutral-400 hover:text-neutral-700"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[1.8fr_0.9fr]">
              <div className="space-y-5">
                <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
                  <div className="border-b border-neutral-200 px-5 py-4">
                    <h2 className="text-lg font-semibold">
                      Phiếu giao hàng 1 phần
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Ghi nhận phần khách thực nhận để điều chỉnh COD và phục vụ
                      đối soát.
                    </p>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-2">
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Lý do</p>
                      <textarea
                        value={partialDraft.reason}
                        onChange={(e) =>
                          setPartialDraft((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                        className="mt-2 min-h-[88px] w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-500"
                      />
                    </div>

                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">
                        Người duyệt chỉnh COD
                      </p>
                      <input
                        value={partialDraft.approvedBy}
                        onChange={(e) =>
                          setPartialDraft((prev) => ({
                            ...prev,
                            approvedBy: e.target.value,
                          }))
                        }
                        className="mt-2 h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[13px] outline-none focus:border-neutral-500"
                      />
                      <p className="mt-2 text-xs text-neutral-500">
                        Google Authenticator đã xác thực
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden px-5 pb-5">
                    <div className="overflow-hidden rounded-2xl border border-neutral-200">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Sản phẩm</th>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3 text-center">Đặt</th>
                            <th className="px-4 py-3 text-center">Thực giao</th>
                            <th className="px-4 py-3 text-right">Đơn giá</th>
                            <th className="px-4 py-3 text-right">
                              Thành tiền giao
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {partialDraft.items.map((item, idx) => (
                            <tr
                              key={idx}
                              className="border-t border-neutral-200 bg-white"
                            >
                              <td className="px-4 py-4 font-medium">
                                {item.productName}
                              </td>
                              <td className="px-4 py-4 text-neutral-500">
                                {item.sku || "—"}
                              </td>
                              <td className="px-4 py-4 text-center">
                                {item.orderedQty}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.orderedQty}
                                  value={item.deliveredQty}
                                  onChange={(e) =>
                                    updatePartialDeliveredQty(
                                      item.orderItemId,
                                      Number(e.target.value || 0),
                                    )
                                  }
                                  className="mx-auto h-9 w-[88px] rounded-xl border border-neutral-300 px-3 text-center text-[13px] outline-none focus:border-neutral-500"
                                />
                              </td>
                              <td className="px-4 py-4 text-right">
                                {currency(item.unitPrice)}
                              </td>
                              <td className="px-4 py-4 text-right font-medium">
                                {currency(item.deliveredQty * item.unitPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
                  <div className="border-b border-neutral-200 px-5 py-4">
                    <h2 className="text-lg font-semibold">
                      Tác động thanh toán
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      So sánh giữa đơn gốc và số tiền thực thu sau điều chỉnh.
                    </p>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-4">
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Tổng đơn gốc</p>
                      <p className="mt-2 text-xl font-semibold">
                        {currency(
                          partialDraft.originalCod -
                          Number(order?.shippingFee || 0),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Phí ship</p>
                      <p className="mt-2 text-xl font-semibold">
                        {currency(order?.shippingFee)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-xs text-red-600">COD ban đầu</p>
                      <p className="mt-2 text-xl font-semibold text-red-700">
                        {currency(partialDraft.originalCod)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs text-emerald-600">
                        COD sau điều chỉnh
                      </p>
                      <p className="mt-2 text-xl font-semibold text-emerald-700">
                        {currency(partialDraft.adjustedCod)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold">Tóm tắt xử lý</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Khách hàng</p>
                      <p className="mt-1 font-medium">
                        {order?.customerName ||
                          order?.customer?.fullName ||
                          "—"}{" "}
                        •{" "}
                        {order?.customerPhone || order?.customer?.phone || "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Địa chỉ giao</p>
                      <p className="mt-1 font-medium">
                        {buildAddress(order!, parseStructuredNote(order?.note))}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">
                        Trạng thái vận đơn
                      </p>
                      <p className="mt-1 font-medium">
                        {order?.shipment?.shippingStatus || "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Mã vận đơn GHN</p>
                      <p className="mt-1 font-medium">
                        {order?.shipment?.trackingCode || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold">Hành động</h3>
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      disabled={partialSaving}
                      onClick={() => void handleSavePartialDelivery()}
                      className="w-full rounded-2xl border border-neutral-900 bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {partialSaving
                        ? "Đang lưu..."
                        : "Lưu phiếu giao hàng 1 phần"}
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium"
                      onClick={() =>
                        setMessage("Bước in phiếu sẽ nối tiếp ở bước sau.")
                      }
                    >
                      In phiếu
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium"
                      onClick={() =>
                        setMessage("Lịch sử chỉnh COD sẽ nối tiếp ở bước sau.")
                      }
                    >
                      Xem lịch sử chỉnh COD
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showShipmentEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[760px] rounded-[20px] border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-900">
                  {editMode === "cod"
                    ? codEditFlow === "partial"
                      ? "SỬA COD GIAO HÀNG 1 PHẦN"
                      : "SỬA COD ĐỔI HÀNG"
                    : "Chỉnh sửa giao hàng"}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {editMode === "cod"
                    ? codEditFlow === "partial"
                      ? "Luồng này giữ nguyên: sửa COD xong sẽ mở phiếu giao hàng 1 phần."
                      : "Chỉ cập nhật số tiền COD trên vận đơn, không tạo phiếu giao hàng 1 phần."
                    : "Sửa địa chỉ + ghi chú giao hàng"}
                </p>
              </div>

              <button
                onClick={handleCloseShipmentEdit}
                className="text-sm text-neutral-400 hover:text-neutral-700"
              >
                ×
              </button>
            </div>

            {editMode === "cod" ? (
              <div className="px-4 py-4">
                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">COD mới</p>

                  <EditInput
                    value={formatVndInput(shipmentDraft.codAmountInput)}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({
                        ...prev,
                        codAmountInput: v.replace(/\D/g, "").slice(0, 12),
                      }))
                    }
                    placeholder="Nhập COD mới"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {shipmentDraft.codAmountInput
                      ? `${formatVndInput(shipmentDraft.codAmountInput)}đ`
                      : "Chưa nhập COD"}
                  </p>
                </div>

                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-red-700">
                    Thay đổi COD là hành động nhạy cảm
                  </p>
                  <p className="mt-0.5 text-[11px] text-red-600">
                    Nhập COD mới trước, sau đó xác nhận bằng Google
                    Authenticator.
                  </p>
                </div>

                {codChanged ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-amber-800">
                      COD đang được thay đổi
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Chỉ lưu khi xác thực đúng mã authen.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Người nhận
                  </p>
                  <EditInput
                    value={shipmentDraft.recipientName}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({
                        ...prev,
                        recipientName: v,
                      }))
                    }
                  />
                </div>

                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">SĐT nhận</p>
                  <EditInput
                    value={shipmentDraft.phone}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({ ...prev, phone: v }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Địa chỉ dòng 1
                  </p>
                  <EditInput
                    value={shipmentDraft.addressLine1}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({ ...prev, addressLine1: v }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Địa chỉ dòng 2
                  </p>
                  <EditInput
                    value={shipmentDraft.addressLine2}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({ ...prev, addressLine2: v }))
                    }
                  />
                </div>

                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Tỉnh / thành
                  </p>
                  <SearchableEditSelect
                    value={selectedProvinceId}
                    onChange={handleProvinceChange}
                    options={provinceOptions.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                    placeholder="Chọn tỉnh / thành"
                    searchPlaceholder="Gõ tỉnh/thành, ví dụ: dak lak"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Quận / huyện
                  </p>
                  <SearchableEditSelect
                    value={selectedDistrictId}
                    onChange={handleDistrictChange}
                    options={districtOptions.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                    placeholder="Chọn quận / huyện"
                    searchPlaceholder="Gõ quận/huyện, ví dụ: krong bong"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Phường / xã
                  </p>
                  <SearchableEditSelect
                    value={selectedWardCode}
                    onChange={handleWardChange}
                    options={wardOptions.map((item) => ({
                      value: item.code,
                      label: item.name,
                    }))}
                    placeholder="Chọn phường / xã"
                    searchPlaceholder="Gõ phường/xã, ví dụ: hoa phong"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Mã bưu chính
                  </p>
                  <EditInput
                    value={shipmentDraft.postalCode}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({ ...prev, postalCode: v }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="mb-1 text-[11px] text-neutral-500">
                    Ghi chú giao hàng
                  </p>
                  <EditTextarea
                    value={shipmentDraft.shippingNote}
                    onChange={(v) =>
                      setShipmentDraft((prev) => ({ ...prev, shippingNote: v }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <ActionButton onClick={handleCloseShipmentEdit}>
                Đóng
              </ActionButton>

              {editMode === "cod" ? (
                <ActionButton
                  tone="dark"
                  disabled={!codChanged}
                  onClick={handleOpenAuthConfirm}
                >
                  Tiếp tục xác thực
                </ActionButton>
              ) : (
                <ActionButton
                  tone="dark"
                  disabled={shipmentSaving}
                  onClick={handleSaveShipmentDraftLocal}
                >
                  {shipmentSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showAuthConfirmModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[420px] rounded-[22px] border border-neutral-200 bg-white p-5 shadow-2xl">
            <div>
              <p className="text-[16px] font-semibold text-neutral-900">
                Xác nhận bằng Google Authenticator
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                {codEditFlow === "partial"
                  ? "Nhập mã 6 số để xác nhận thay đổi COD và mở phiếu giao hàng 1 phần."
                  : "Nhập mã 6 số để xác nhận sửa COD thường. Không tạo phiếu giao hàng 1 phần."}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-[11px] text-neutral-500">COD mới</p>
              <p className="mt-1 text-[16px] font-semibold text-neutral-900">
                {shipmentDraft.codAmountInput
                  ? `${formatVndInput(shipmentDraft.codAmountInput)}đ`
                  : "0đ"}
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-[11px] text-neutral-500">Mã authen</p>
              <EditInput
                value={authCode}
                onChange={(v) => setAuthCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="Nhập mã 6 số"
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <ActionButton onClick={() => setShowAuthConfirmModal(false)}>
                Đóng
              </ActionButton>
              <ActionButton
                tone="dark"
                disabled={!authCode.trim() || authVerifying}
                onClick={handleVerifyAndSaveCod}
              >
                {authVerifying ? "Đang xác thực..." : "Xác thực và lưu"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
