"use client";
import { apiFetch, apiJson } from "@/lib/api";
import * as XLSX from "xlsx";
import { getBranches, type BranchItem } from "@/lib/products-api";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { addWorkspaceTab } from "@/lib/workspace-tabs";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import type {
  AdminOrder,
  OrderPaymentStatus,
  OrderStatus,
} from "@/lib/orders-api";
import { updateOrderPaymentStatus, updateOrderStatus } from "@/lib/orders-api";

import {
  findPrintTemplate,
  loadPrintTemplates,
  type PrintPaperSize,
} from "@/lib/print-template-config";
import {
  openPrintDocument,
  renderOrderTemplateHtml,
} from "@/lib/print-template-engine";

type QuickDateKey = "all" | "today" | "yesterday" | "7d" | "30d" | "month";

type QuickStatusKey =
  | "ALL"
  | "WAITING_APPROVE"
  | "WAITING_PAYMENT"
  | "WAITING_PACKING"
  | "WAITING_SHIP"
  | "DELIVERING"
  | "SOON_DELIVERY"
  | "FAIL"
  | "REDELIVERY"
  | "LOCAL_DELIVERY";

type ColumnKey =
  | "orderCode"
  | "createdAt"
  | "customerName"
  | "customerPhone"
  | "orderStatus"
  | "paymentDotStatus"
  | "paymentStatus"
  | "stockOutStatus"
  | "fulfillmentStatus"
  | "branch"
  | "createdBy"
  | "salesChannel"
  | "shippingMode"
  | "shippingPartner"
  | "trackingCode"
  | "printStatus"
  | "itemCount"
  | "shippingAddress"
  | "note"
  | "shippingFee"
  | "carrierShippingFee"
  | "assignedStaff"
  | "codAmount"
  | "amountDue"
  | "finalAmount";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  money?: boolean;
  defaultVisible: boolean;
};

type CurrentUserLite = {
  id?: string;
  code?: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  branchId?: string | null;
  permissions?: string[];
  permissionKeys?: string[];
  branchPermissions?: Array<{
    branchId?: string | null;
    permissionKeys?: string[];
    canViewOwnOrders?: boolean;
    canViewBranchOrders?: boolean;
    canCreateOrder?: boolean;
    canApproveOrder?: boolean;
    canCancelOrder?: boolean;
    canSell?: boolean;
  }>;
};

type StaffLite = {
  id: string;
  code?: string | null;
  name?: string | null;
  fullName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  isActive?: boolean;
};

type ParsedNote = {
  noteText: string;
  address: string;
  tags: string;
  shippingMode: string;
  shippingPartner: string;
  shippingNote: string;
};

type NormalizedOrder = AdminOrder & {
  _meta: ParsedNote;
  _createdByName: string;
  _shippingFee: number;
  _carrierShippingFee: number;
  _assignedStaffName: string;
  _codAmount: number;
  _amountDue: number;
  _createdAtDate: Date | null;
};

const TABLE_MIN_WIDTH = 2900;
const TABLE_SCROLL_STORAGE_KEY = "orders.tableScrollLeft";
const SALES_CHANNELS_STORAGE_KEY = "the1970_sales_channels";
const ORDER_PRINT_COUNT_STORAGE_KEY = "the1970_order_print_counts";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "orderCode", label: "Mã đơn", defaultVisible: true },
  { key: "createdAt", label: "Ngày tạo", defaultVisible: true },
  { key: "customerName", label: "Khách hàng", defaultVisible: true },
  { key: "customerPhone", label: "SĐT", defaultVisible: true },
  { key: "orderStatus", label: "Trạng thái đơn", defaultVisible: true },
  { key: "paymentDotStatus", label: "TT thanh toán", defaultVisible: true },
  { key: "paymentStatus", label: "Thanh toán", defaultVisible: true },
  { key: "stockOutStatus", label: "TT xuất kho", defaultVisible: true },
  { key: "fulfillmentStatus", label: "Giao vận", defaultVisible: true },
  { key: "branch", label: "Chi nhánh", defaultVisible: true },
  { key: "createdBy", label: "Nhân viên tạo đơn", defaultVisible: true },
  { key: "salesChannel", label: "Kênh bán", defaultVisible: true },
  { key: "shippingMode", label: "Cách giao", defaultVisible: true },
  { key: "shippingPartner", label: "Đơn vị VC", defaultVisible: true },
  { key: "trackingCode", label: "Mã vận đơn", defaultVisible: true },
  { key: "printStatus", label: "Số lần in tem", defaultVisible: true },
  { key: "itemCount", label: "Số món", defaultVisible: true },
  { key: "shippingAddress", label: "Địa chỉ giao", defaultVisible: true },
  { key: "note", label: "Ghi chú", defaultVisible: true },
  {
    key: "shippingFee",
    label: "Phí khách trả",
    money: true,
    defaultVisible: true,
  },
  {
    key: "carrierShippingFee",
    label: "Phí hãng VC",
    money: true,
    defaultVisible: true,
  },
  { key: "assignedStaff", label: "NV phụ trách", defaultVisible: true },
  { key: "codAmount", label: "Thu hộ COD", money: true, defaultVisible: true },
  {
    key: "amountDue",
    label: "Khách còn phải trả",
    money: true,
    defaultVisible: true,
  },
  { key: "finalAmount", label: "Tổng tiền", money: true, defaultVisible: true },
];

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

type ConfiguredSalesChannel = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  note?: string;
};

function loadConfiguredSalesChannels(): ConfiguredSalesChannel[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(SALES_CHANNELS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function salesChannelLabel(value?: string | null) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();

  const configured = loadConfiguredSalesChannels().find(
    (item) => String(item.code || "").toUpperCase() === upper,
  );

  if (configured?.name) return configured.name;

  switch (upper) {
    case "FACEBOOK_MANUAL":
    case "FACEBOOK":
      return "Facebook";
    case "POS":
      return "POS";
    case "SHOWROOM":
      return "Showroom";
    case "VN_WEB":
      return "Website VN";
    case "INTL_WEB":
      return "Website quốc tế";
    case "TIKTOK":
      return "TikTok";
    case "SHOPEE":
      return "Shopee";
    case "ZALO":
      return "Zalo";
    case "OTHER":
      return "Khác";
    default:
      return raw || "—";
  }
}

function shippingModeLabel(value?: string | null) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();

  switch (upper) {
    case "PARTNER":
    case "SHIP":
    case "DELIVERY":
    case "GHN":
    case "AHAMOVE":
      return "Giao hàng";
    case "PICKUP":
    case "STORE_PICKUP":
    case "IN_STORE":
      return "Nhận tại cửa hàng";
    case "POS":
      return "Bán tại quầy";
    default:
      return raw || "—";
  }
}

function carrierLabel(value?: string | null) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();

  if (upper.includes("AHAMOVE")) return "AhaMove";
  if (upper.includes("GHN")) return "GHN";
  if (upper.includes("GHTK")) return "GHTK";
  if (upper.includes("VIETTEL")) return "Viettel Post";
  if (upper.includes("GRAB")) return "Grab Express";
  if (upper.includes("SHIPPER")) return "Shipper riêng";

  return raw || "—";
}

function isLocalDeliveryCarrier(value?: string | null) {
  const upper = String(value || "").toUpperCase();
  return (
    upper.includes("AHAMOVE") ||
    upper.includes("GRAB") ||
    upper.includes("SHIPPER") ||
    upper.includes("INTERNAL")
  );
}

function shipmentExternalTrackingUrl(order: AdminOrder) {
  const carrier = String(order.shipment?.carrier || "").toUpperCase();
  const trackingCode = String(order.shipment?.trackingCode || "").trim();
  const anyShipment: any = order.shipment || {};

  if (carrier.includes("AHAMOVE")) {
    return anyShipment.ahamoveTrackingUrl || anyShipment.trackingUrl || "";
  }

  if (carrier.includes("GHN") && trackingCode) {
    return `https://donhang.ghn.vn/?order_code=${encodeURIComponent(trackingCode)}`;
  }

  return "";
}

type DotState = "empty" | "partial" | "filled";

function paymentDotState(status?: string | null): DotState {
  const value = String(status || "").toUpperCase();

  if (value === "PAID" || value === "REFUNDED") return "filled";
  if (value === "PARTIAL" || value === "PENDING_COD") return "partial";

  return "empty";
}

function stockOutDotState(status?: string | null): DotState {
  const value = String(status || "").toUpperCase();

  if (value === "SHIPPED" || value === "COMPLETED") return "filled";
  if (value === "PACKING") return "partial";

  return "empty";
}

function dotStateLabel(state: DotState) {
  if (state === "filled") return "Đã xong";
  if (state === "partial") return "Một phần / đang xử lý";
  return "Chưa";
}

function DotStatus({ state, title }: { state: DotState; title?: string }) {
  const label = dotStateLabel(state);

  if (state === "filled") {
    return (
      <span
        title={title || label}
        className="inline-flex h-4 w-4 rounded-full border border-neutral-900 bg-neutral-900"
        aria-label={label}
      />
    );
  }

  if (state === "partial") {
    return (
      <span
        title={title || label}
        className="relative inline-flex h-4 w-4 overflow-hidden rounded-full border border-neutral-900 bg-white"
        aria-label={label}
      >
        <span className="absolute left-0 top-0 h-full w-1/2 bg-neutral-900" />
      </span>
    );
  }

  return (
    <span
      title={title || label}
      className="inline-flex h-4 w-4 rounded-full border-2 border-neutral-700 bg-white"
      aria-label={label}
    />
  );
}

function getOrderItemCount(order: AdminOrder) {
  const anyOrder = order as any;

  const explicit = Number(
    anyOrder.itemCount ??
      anyOrder.itemsCount ??
      anyOrder.totalItems ??
      anyOrder.totalQuantity ??
      anyOrder.quantity ??
      0,
  );

  if (explicit > 0) return explicit;

  if (Array.isArray(order.items) && order.items.length) {
    const totalQty = order.items.reduce((sum: number, item: any) => {
      return (
        sum +
        Number(
          item.qty ??
            item.quantity ??
            item.quantityOrdered ??
            item.orderedQty ??
            1,
        )
      );
    }, 0);

    return totalQty || order.items.length;
  }

  return 0;
}

function getOrderPrintCounts(): Record<string, number> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(ORDER_PRINT_COUNT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getOrderPrintCount(orderId?: string | null) {
  if (!orderId) return 0;
  return Number(getOrderPrintCounts()[orderId] || 0);
}

function saveOrderPrintCount(orderId: string, nextCount: number) {
  if (typeof window === "undefined" || !orderId) return;
  const counts = getOrderPrintCounts();
  counts[orderId] = Math.max(0, Number(nextCount || 0));
  localStorage.setItem(ORDER_PRINT_COUNT_STORAGE_KEY, JSON.stringify(counts));
}

function bumpOrderPrintCount(orderId: string) {
  saveOrderPrintCount(orderId, getOrderPrintCount(orderId) + 1);
}

function PrintStatusBadge({ orderId }: { orderId: string }) {
  const count = getOrderPrintCount(orderId);

  if (count <= 0) {
    return (
      <span
        title="Chưa in tem"
        className="mx-auto inline-flex h-4 w-4 rounded-full border-2 border-neutral-700 bg-white"
        aria-label="Chưa in tem"
      />
    );
  }

  if (count === 1) {
    return (
      <span
        title="Đã in tem 1 lần"
        className="mx-auto inline-flex h-4 w-4 rounded-full border border-neutral-900 bg-neutral-900"
        aria-label="Đã in tem 1 lần"
      />
    );
  }

  return (
    <span
      title={`Đã in tem ${count} lần`}
      className="mx-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-neutral-900 bg-neutral-900 px-1.5 text-[11px] font-bold leading-none text-white"
      aria-label={`Đã in tem ${count} lần`}
    >
      {count}
    </span>
  );
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
      className={`rounded-[24px] border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
  size = "md",
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}) {
  const tones =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900"
      : variant === "success"
        ? "bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200"
        : variant === "danger"
          ? "bg-white text-red-600 hover:bg-red-50 border-red-200"
          : variant === "warning"
            ? "bg-white text-amber-700 hover:bg-amber-50 border-amber-200"
            : "bg-white text-neutral-900 hover:bg-neutral-50 border-neutral-300";

  const sizes =
    size === "lg"
      ? "px-4 py-3 text-[13px] rounded-2xl"
      : size === "sm"
        ? "px-2.5 py-1.5 text-[11px] rounded-xl"
        : "px-3.5 py-2.5 text-xs rounded-2xl";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border font-semibold transition ${tones} ${sizes} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

function SmallChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryIcon({
  active = false,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-[18px] ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-neutral-50 text-neutral-700"
      }`}
    >
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  active = false,
  onClick,
  icon,
}: {
  title: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] border px-4 py-4 text-left transition ${
        active
          ? "border-neutral-900 bg-neutral-50 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-4">
        <SummaryIcon active={active}>{icon}</SummaryIcon>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-neutral-600">{title}</p>
          <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight text-neutral-900">
            {value}
          </p>
          <p className="mt-3 text-[12px] font-medium text-neutral-500">
            Xem chi tiết
          </p>
        </div>
      </div>
    </button>
  );
}

function orderStatusLabel(status?: string) {
  switch (status) {
    case "NEW":
      return "Mới tạo";
    case "APPROVED":
      return "Đã duyệt";
    case "PACKING":
      return "Đang xử lý";
    case "SHIPPED":
      return "Đã xuất kho";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status || "—";
  }
}

function paymentStatusLabel(status?: string) {
  switch (status) {
    case "UNPAID":
      return "Chưa thanh toán";
    case "PARTIAL":
      return "Thanh toán một phần";
    case "PAID":
      return "Đã thanh toán";
    case "PENDING_COD":
      return "Chờ thu COD";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thanh toán lỗi";
    default:
      return status || "—";
  }
}

function fulfillmentStatusLabel(status?: string | null) {
  switch (status) {
    case "UNFULFILLED":
      return "Chưa giao";
    case "PROCESSING":
      return "Đang chuẩn bị";
    case "PARTIAL":
      return "Một phần";
    case "FULFILLED":
      return "Đã giao vận";
    case "RETURNED":
      return "Trả hàng";
    default:
      return status || "—";
  }
}

function shipmentStatusValue(order: AdminOrder) {
  const status = String(order.shipment?.shippingStatus || "").trim();
  if (status) return status;

  // Đã có mã vận đơn nhưng hãng chưa trả status rõ ràng:
  // coi là chờ lấy hàng, không dùng fulfillmentStatus PROCESSING nữa.
  if (order.shipment?.trackingCode) return "READY_TO_PICK";

  return "";
}

function shipmentDisplayStatusLabel(order: AdminOrder) {
  const value = shipmentStatusValue(order).toUpperCase();

  switch (value) {
    case "ASSIGNING":
    case "IDLE":
      return "Đang tìm tài xế";

    case "READY_TO_PICK":
    case "READY_TO_PICKING":
    case "WAITING_PICK":
    case "WAITING_TO_PICK":
    case "CREATED":
    case "PENDING":
      return "Chờ lấy hàng";

    case "PICKING":
    case "PICK":
    case "PICKED":
    case "ACCEPTED":
      return "Đang lấy hàng";

    case "STORING":
    case "IN_TRANSIT":
    case "TRANSPORTING":
    case "SORTING":
    case "DELIVERING":
    case "DELIVERY":
    case "IN_PROCESS":
    case "IN PROCESS":
      return "Đang giao hàng";

    case "DELIVERED":
    case "DELIVERY_SUCCESS":
    case "COMPLETED":
      return "Giao thành công";

    case "RETURN":
    case "RETURNING":
    case "WAITING_TO_RETURN":
      return "Đang hoàn hàng";

    case "RETURNED":
    case "RETURNED_TO_CLIENT":
      return "Đã hoàn hàng";

    case "CANCEL":
    case "CANCELLED":
      return "Đã huỷ vận đơn";

    case "FAILED":
    case "EXCEPTION":
    case "LOST":
    case "DAMAGE":
      return "Có sự cố";

    default:
      return value || fulfillmentStatusLabel(order.fulfillmentStatus);
  }
}

function orderStatusTone(status?: string) {
  switch (status) {
    case "NEW":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "APPROVED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "PACKING":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "SHIPPED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function paymentStatusTone(status?: string) {
  switch (status) {
    case "UNPAID":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "PARTIAL":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PENDING_COD":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "REFUNDED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    case "FAILED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function fulfillmentStatusTone(status?: string | null) {
  switch (status) {
    case "UNFULFILLED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    case "PROCESSING":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "PARTIAL":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "FULFILLED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "RETURNED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function shipmentDisplayStatusTone(order: AdminOrder) {
  const value = shipmentStatusValue(order).toUpperCase();

  switch (value) {
    case "ASSIGNING":
    case "IDLE":
    case "READY_TO_PICK":
    case "READY_TO_PICKING":
    case "WAITING_PICK":
    case "WAITING_TO_PICK":
    case "CREATED":
    case "PENDING":
    case "PICKING":
    case "PICK":
    case "PICKED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";

    case "STORING":
    case "IN_TRANSIT":
    case "TRANSPORTING":
    case "SORTING":
    case "DELIVERING":
    case "DELIVERY":
    case "IN_PROCESS":
    case "IN PROCESS":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "DELIVERED":
    case "DELIVERY_SUCCESS":
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "RETURN":
    case "RETURNING":
    case "WAITING_TO_RETURN":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "RETURNED":
    case "RETURNED_TO_CLIENT":
    case "CANCEL":
    case "CANCELLED":
    case "FAILED":
    case "EXCEPTION":
    case "LOST":
    case "DAMAGE":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return fulfillmentStatusTone(order.fulfillmentStatus);
  }
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

function getCurrentUserLite(): CurrentUserLite | null {
  try {
    if (typeof window === "undefined") return null;

    const raw =
      localStorage.getItem("the1970_current_user") ||
      localStorage.getItem("currentUser");

    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || parsed;
  } catch {
    return null;
  }
}

function saveCurrentUserLite(user: any) {
  if (typeof window === "undefined" || !user) return;
  try {
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.setItem("the1970_current_user", JSON.stringify(user));
  } catch {
    // ignore storage error
  }
}

function isOwnerOrAdminUser(user?: CurrentUserLite | null) {
  const role = String(user?.role || "").toLowerCase();
  return role === "owner" || role === "admin";
}

function normalizeId(value: any) {
  return String(value || "").trim();
}

function getScopedBranchPermissionRows(user?: CurrentUserLite | null) {
  const rows = Array.isArray(user?.branchPermissions)
    ? user.branchPermissions
    : [];
  const currentBranchId = normalizeId(user?.branchId);

  if (!currentBranchId) return rows;

  const scoped = rows.filter(
    (row) => normalizeId(row?.branchId) === currentBranchId,
  );
  return scoped.length ? scoped : rows;
}

function getCurrentUserPermissionKeys(user?: CurrentUserLite | null) {
  const keys = new Set<string>();

  if (Array.isArray(user?.permissions)) {
    user.permissions.forEach((permission) => {
      if (permission) keys.add(String(permission));
    });
  }

  if (Array.isArray(user?.permissionKeys)) {
    user.permissionKeys.forEach((permission) => {
      if (permission) keys.add(String(permission));
    });
  }

  getScopedBranchPermissionRows(user).forEach((row) => {
    if (Array.isArray(row?.permissionKeys)) {
      row.permissionKeys.forEach((permission) => {
        if (permission) keys.add(String(permission));
      });
    }
  });

  return keys;
}

function hasLegacyOrderPermission(
  user: CurrentUserLite | null,
  permission: string,
) {
  return getScopedBranchPermissionRows(user).some((row) => {
    if (permission === "orders.view_own") return !!row.canViewOwnOrders;
    if (permission === "orders.view") return !!row.canViewBranchOrders;
    if (permission === "orders.create") return !!row.canCreateOrder;
    if (permission === "orders.approve") return !!row.canApproveOrder;
    if (permission === "orders.cancel") return !!row.canCancelOrder;
    if (permission === "orders.pay") return false;
    if (permission === "orders.pack_ship") return false;
    if (permission === "pos.access") return !!row.canSell;
    return false;
  });
}

function hasOrderPermission(user: CurrentUserLite | null, permission: string) {
  if (isOwnerOrAdminUser(user)) return true;
  return (
    getCurrentUserPermissionKeys(user).has(permission) ||
    hasLegacyOrderPermission(user, permission)
  );
}

function normalizeComparableText(value?: string | null) {
  return String(value || "")
    .replace(/\s+-\s+[A-Za-z0-9À-ỹ]+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isOrderCreatedByCurrentUser(order: any, user: CurrentUserLite | null) {
  if (!user) return false;

  const userIds = [user.id, user.code, user.email]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const orderIds = [
    order?.createdByStaffId,
    order?.createdById,
    order?.staffUserId,
    order?.createdBy?.id,
    order?.createdBy?.code,
    order?.createdBy?.email,
    order?.staffUser?.id,
    order?.staffUser?.code,
    order?.staffUser?.email,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (userIds.some((id) => orderIds.includes(id))) return true;

  const userNames = [user.name, user.fullName]
    .map(normalizeComparableText)
    .filter(Boolean);

  const orderNames = [
    order?.createdByStaffName,
    order?.createdByName,
    order?.createdBy?.name,
    order?.createdBy?.fullName,
    order?.staffUser?.name,
    order?.staffUser?.fullName,
  ]
    .map(normalizeComparableText)
    .filter(Boolean);

  return userNames.some((name) => orderNames.includes(name));
}

function parseStructuredNote(note?: string): ParsedNote {
  const empty = {
    noteText: "",
    address: "",
    tags: "",
    shippingMode: "",
    shippingPartner: "",
    shippingNote: "",
  };

  if (!note) return empty;

  const parts = note
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  const getValue = (prefix: string) => {
    const found = parts.find((p) => p.startsWith(prefix));
    return found ? found.replace(prefix, "").trim() : "";
  };

  return {
    noteText:
      getValue("Ghi chú nội bộ:") ||
      getValue("Ghi chú đơn hàng:") ||
      getValue("Ghi chú:"),
    address: getValue("Địa chỉ:"),
    tags: getValue("Tags:"),
    shippingMode: getValue("Cách giao:"),
    shippingPartner: getValue("Đơn vị giao:"),
    shippingNote: getValue("Ghi chú giao hàng:"),
  };
}

function looksLikeSystemOrderNoteSegment(value: string) {
  const lower = value.toLowerCase().trim();

  return (
    lower.startsWith("địa chỉ:") ||
    lower.startsWith("tags:") ||
    lower.startsWith("cách giao:") ||
    lower.startsWith("đơn vị giao:") ||
    lower.startsWith("sđt:") ||
    lower.startsWith("sdt:") ||
    lower.startsWith("điện thoại:") ||
    lower.startsWith("phí ship:") ||
    lower.startsWith("phi ship:") ||
    lower.startsWith("phí vận chuyển:") ||
    lower.startsWith("phi van chuyen:") ||
    lower.startsWith("khách đã trả:") ||
    lower.startsWith("khach da tra:") ||
    lower.startsWith("khách trả:") ||
    lower.startsWith("khach tra:") ||
    lower.startsWith("khách còn phải trả:") ||
    lower.startsWith("khach con phai tra:") ||
    lower.startsWith("tổng tiền:") ||
    lower.startsWith("tong tien:") ||
    lower.startsWith("thu hộ cod:") ||
    lower.startsWith("thu ho cod:") ||
    lower.startsWith("cod:") ||
    lower.startsWith("customerid:") ||
    lower.startsWith("customer id:") ||
    lower.startsWith("customer_id:") ||
    lower.startsWith("customer:") ||
    lower.startsWith("khách hàng id:") ||
    lower.startsWith("customername:") ||
    lower.startsWith("customerphone:") ||
    lower.startsWith("customeraddressid:") ||
    lower.startsWith("customeraddress id:") ||
    lower.startsWith("customeraddress:") ||
    lower.startsWith("giảm giá tay:") ||
    lower.startsWith("giam gia tay:") ||
    lower.startsWith("giảm giá dòng:") ||
    lower.startsWith("giam gia dong:") ||
    lower.startsWith("giảm giá:") ||
    lower.startsWith("giam gia:") ||
    lower.startsWith("tự áp dụng khuyến mại:") ||
    lower.startsWith("tu ap dung khuyen mai:") ||
    lower.startsWith("khuyến mại:") ||
    lower.startsWith("khuyen mai:") ||
    lower.startsWith("mã giảm giá:") ||
    lower.startsWith("ma giam gia:") ||
    /^customer[a-z0-9_ -]*id:/.test(lower) ||
    /^[a-z0-9_ -]*addressid:/.test(lower)
  );
}

function extractPrefixedNoteValue(segment: string) {
  return segment
    .replace(/^Ghi chú nội bộ:\s*/i, "")
    .replace(/^Ghi chú đơn hàng:\s*/i, "")
    .replace(/^Ghi chú giao hàng:\s*/i, "")
    .replace(/^Ghi chú:\s*/i, "")
    .trim();
}

function getOrderUserNoteForTable(order: any, meta?: ParsedNote) {
  const directNote = [
    order?.internalNote,
    order?.orderNote,
    order?.customerNote,
    order?.shippingNote,
    meta?.noteText,
    meta?.shippingNote,
  ]
    .map((value) => String(value || "").trim())
    .find((value) => value && !looksLikeSystemOrderNoteSegment(value));

  if (directNote) return directNote;

  const raw = String(order?.note || "").trim();
  if (!raw) return "";

  const parts = raw
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  const explicitUserNotes = parts
    .filter((item) =>
      /^(Ghi chú nội bộ|Ghi chú đơn hàng|Ghi chú giao hàng|Ghi chú):/i.test(
        item,
      ),
    )
    .map(extractPrefixedNoteValue)
    .filter((item) => item && !looksLikeSystemOrderNoteSegment(item));

  if (explicitUserNotes.length) return explicitUserNotes.join(" | ");

  // Nếu note là chuỗi tổng hợp của hệ thống thì để trống.
  if (parts.length > 1 || looksLikeSystemOrderNoteSegment(raw)) return "";

  // Nếu người dùng nhập ghi chú tự do dạng plain text thì vẫn hiển thị.
  return raw;
}

function shortText(text?: string, max = 28) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function parseOrderDate(value?: string) {
  if (!value) return null;
  const normalized = value.replace(",", "").trim();

  const match1 = normalized.match(
    /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  );
  if (match1) {
    const [, hh, mm, ss = "0", d, m, y] = match1;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    );
  }

  const match2 = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/,
  );
  if (match2) {
    const [, d, m, y, hh, mm, ss = "0"] = match2;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    );
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
function formatOrderDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function amountCustomerStillOwes(order: AdminOrder) {
  if (order.status === "CANCELLED") return 0;
  if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") {
    return 0;
  }

  const codAmount = Number(order.shipment?.codAmount || 0);
  if (order.paymentStatus === "PENDING_COD" && codAmount > 0) {
    return codAmount;
  }

  return Number(order.finalAmount || 0);
}

function getCreatedByName(order: any) {
  return (
    order?.createdByStaffName ||
    order?.createdByName ||
    order?.createdBy?.name ||
    order?.createdBy?.fullName ||
    order?.staffUser?.name ||
    order?.staffUser?.fullName ||
    "—"
  );
}

function getQuickDateRange(key: QuickDateKey) {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  if (key === "today") return { from: todayStart, to: todayEnd };

  if (key === "yesterday") {
    const yStart = new Date(todayStart);
    yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(todayEnd);
    yEnd.setDate(yEnd.getDate() - 1);
    return { from: yStart, to: yEnd };
  }

  if (key === "7d") {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 6);
    return { from, to: todayEnd };
  }

  if (key === "30d") {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 29);
    return { from, to: todayEnd };
  }

  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { from, to: todayEnd };
  }

  return { from: null, to: null };
}

function toInputDateValue(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultVisibleColumns(canSeeMoney: boolean) {
  return COLUMN_DEFS.filter((col) => {
    if (col.money && !canSeeMoney) return false;
    return col.defaultVisible;
  }).map((col) => col.key);
}

function normalizeShipmentStatus(order: AdminOrder) {
  const status = String(
    order.shipment?.shippingStatus ||
      (order.shipment as any)?.partnerStatus ||
      "",
  ).toUpperCase();

  if (status) return status;
  if (order.shipment?.trackingCode) return "READY_TO_PICK";
  return "";
}

function isSoonDeliveryOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  return shipmentStatus.includes("DELIVERING");
}

function isFailedOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  return (
    order.status === "CANCELLED" ||
    order.paymentStatus === "FAILED" ||
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("RETURN") ||
    shipmentStatus.includes("CANCEL")
  );
}

function isRedeliveryOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  return (
    shipmentStatus.includes("RETURN") ||
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("DELIVERY_FAIL")
  );
}

type OrderExportScope = "filtered" | "current_page" | "checked";
type OrderExportSortMode = "created_desc" | "amount_desc" | "cod_desc";

type OrderExportColumnKey =
  | "orderCode"
  | "createdAt"
  | "customerName"
  | "customerPhone"
  | "orderStatus"
  | "paymentDotStatus"
  | "paymentStatus"
  | "stockOutStatus"
  | "fulfillmentStatus"
  | "branch"
  | "createdBy"
  | "salesChannel"
  | "shippingMode"
  | "shippingPartner"
  | "trackingCode"
  | "printStatus"
  | "itemCount"
  | "shippingAddress"
  | "note"
  | "shippingFee"
  | "carrierShippingFee"
  | "assignedStaff"
  | "codAmount"
  | "amountDue"
  | "finalAmount";

type OrderExportColumnState = Record<OrderExportColumnKey, boolean>;

const defaultOrderExportColumns: OrderExportColumnState = {
  orderCode: true,
  createdAt: true,
  customerName: true,
  customerPhone: true,
  orderStatus: true,
  paymentDotStatus: true,
  paymentStatus: true,
  stockOutStatus: true,
  fulfillmentStatus: true,
  branch: true,
  createdBy: true,
  salesChannel: true,
  shippingMode: true,
  shippingPartner: true,
  trackingCode: true,
  printStatus: true,
  itemCount: true,
  shippingAddress: true,
  note: true,
  shippingFee: true,
  carrierShippingFee: true,
  assignedStaff: true,
  codAmount: true,
  amountDue: true,
  finalAmount: true,
};

const orderExportColumnLabels: Record<OrderExportColumnKey, string> = {
  orderCode: "Mã đơn",
  createdAt: "Ngày tạo",
  customerName: "Khách hàng",
  customerPhone: "SĐT",
  orderStatus: "Trạng thái đơn",
  paymentDotStatus: "Trạng thái thanh toán",
  paymentStatus: "Thanh toán",
  stockOutStatus: "Trạng thái xuất kho",
  fulfillmentStatus: "Giao vận",
  branch: "Chi nhánh",
  createdBy: "Nhân viên tạo đơn",
  salesChannel: "Kênh bán",
  shippingMode: "Cách giao",
  shippingPartner: "Đơn vị VC",
  trackingCode: "Mã vận đơn",
  printStatus: "Số lần in tem",
  itemCount: "Số món",
  shippingAddress: "Địa chỉ giao",
  note: "Ghi chú",
  shippingFee: "Phí khách trả",
  carrierShippingFee: "Phí hãng VC",
  assignedStaff: "NV phụ trách",
  codAmount: "Thu hộ COD",
  amountDue: "Khách còn phải trả",
  finalAmount: "Tổng tiền",
};

function makeOrderWorksheet(rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ "Không có dữ liệu": "" }],
  );
  const firstRow = rows[0] || { "Không có dữ liệu": "" };
  const columnCount = Object.keys(firstRow).length;
  const rowCount = Math.max(rows.length, 1) + 1;

  ws["!cols"] = Object.keys(firstRow).map((key) => ({
    wch: Math.min(Math.max(String(key).length + 4, 14), 42),
  }));

  if (columnCount > 0) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rowCount - 1, c: columnCount - 1 },
      }),
    };
  }

  return ws;
}

function safeOrderSheetName(name: string) {
  return (
    String(name || "Sheet")
      .replace(/[\/?*\[\]:]/g, " ")
      .trim()
      .slice(0, 31) || "Sheet"
  );
}

function getOrderExportRows(
  exportOrders: NormalizedOrder[],
  branches: BranchItem[],
  columns: OrderExportColumnState,
) {
  return exportOrders.map((order) => {
    const meta = order._meta;
    const row: Record<string, any> = {};

    if (columns.orderCode) row["Mã đơn"] = order.orderCode || "";
    if (columns.createdAt) row["Ngày tạo"] = order.createdAt || "";
    if (columns.customerName) row["Khách hàng"] = order.customerName || "";
    if (columns.customerPhone) row["SĐT"] = order.customerPhone || "";
    if (columns.orderStatus)
      row["Trạng thái đơn"] = orderStatusLabel(order.status);
    if (columns.paymentDotStatus)
      row["Trạng thái thanh toán"] = dotStateLabel(
        paymentDotState(order.paymentStatus),
      );
    if (columns.paymentStatus)
      row["Thanh toán"] = paymentStatusLabel(order.paymentStatus);
    if (columns.stockOutStatus)
      row["Trạng thái xuất kho"] = dotStateLabel(
        stockOutDotState(order.status),
      );
    if (columns.fulfillmentStatus)
      row["Giao vận"] = shipmentDisplayStatusLabel(order);
    if (columns.branch)
      row["Chi nhánh"] =
        branches.find((b) => b.id === order.branchId)?.name ||
        order.branchId ||
        "";
    if (columns.createdBy)
      row["Nhân viên tạo đơn"] = order._createdByName || "";
    if (columns.salesChannel)
      row["Kênh bán"] = salesChannelLabel(order.salesChannel);
    if (columns.shippingMode)
      row["Cách giao"] = shippingModeLabel(meta.shippingMode);
    if (columns.shippingPartner)
      row["Đơn vị VC"] = order.shipment?.carrier || meta.shippingPartner || "";
    if (columns.trackingCode)
      row["Mã vận đơn"] = order.shipment?.trackingCode || "";
    if (columns.printStatus)
      row["In đơn"] =
        getOrderPrintCount(order.id) > 0
          ? `Đã in ${getOrderPrintCount(order.id)} lần`
          : "Chưa in";
    if (columns.itemCount) row["Số món"] = getOrderItemCount(order);
    if (columns.shippingAddress) row["Địa chỉ giao"] = meta.address || "";
    if (columns.note) row["Ghi chú"] = getOrderUserNoteForTable(order, meta);
    if (columns.shippingFee) row["Phí khách trả"] = order._shippingFee;
    if (columns.carrierShippingFee)
      row["Phí hãng VC"] = order._carrierShippingFee;
    if (columns.assignedStaff)
      row["NV phụ trách"] = order._assignedStaffName || "";
    if (columns.codAmount) row["Thu hộ COD"] = order._codAmount;
    if (columns.amountDue) row["Khách còn phải trả"] = order._amountDue;
    if (columns.finalAmount) row["Tổng tiền"] = Number(order.finalAmount || 0);

    return row;
  });
}

function exportOrdersExcel({
  orders,
  branches,
  columns,
  includeSummarySheet,
  includeBranchSheets,
  includeItemSheet,
  sortMode,
}: {
  orders: NormalizedOrder[];
  branches: BranchItem[];
  columns: OrderExportColumnState;
  includeSummarySheet: boolean;
  includeBranchSheets: boolean;
  includeItemSheet: boolean;
  sortMode: OrderExportSortMode;
}) {
  const sortedOrders = [...orders].sort((a, b) => {
    if (sortMode === "amount_desc")
      return Number(b.finalAmount || 0) - Number(a.finalAmount || 0);
    if (sortMode === "cod_desc")
      return Number(b._codAmount || 0) - Number(a._codAmount || 0);
    return (
      (b._createdAtDate?.getTime() || 0) - (a._createdAtDate?.getTime() || 0)
    );
  });

  const rows = getOrderExportRows(sortedOrders, branches, columns);
  const wb = XLSX.utils.book_new();

  const totalRevenue = sortedOrders.reduce(
    (sum, o) => sum + Number(o.finalAmount || 0),
    0,
  );
  const totalPaidRevenue = sortedOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);
  const totalCod = sortedOrders.reduce(
    (sum, o) => sum + Number(o._codAmount || 0),
    0,
  );
  const totalDue = sortedOrders.reduce(
    (sum, o) => sum + Number(o._amountDue || 0),
    0,
  );

  if (includeSummarySheet) {
    const summaryRows = [
      { "Chỉ số": "Tổng đơn", "Giá trị": sortedOrders.length },
      { "Chỉ số": "Tổng tiền", "Giá trị": totalRevenue },
      { "Chỉ số": "Doanh thu đã thanh toán", "Giá trị": totalPaidRevenue },
      { "Chỉ số": "Tổng COD", "Giá trị": totalCod },
      { "Chỉ số": "Khách còn phải trả", "Giá trị": totalDue },
      {
        "Chỉ số": "Thời gian xuất",
        "Giá trị": new Date().toLocaleString("vi-VN"),
      },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      makeOrderWorksheet(summaryRows),
      "Tổng quan",
    );
  }

  XLSX.utils.book_append_sheet(wb, makeOrderWorksheet(rows), "Danh sách đơn");

  const codRows = sortedOrders
    .filter(
      (o) =>
        o.paymentStatus === "PENDING_COD" ||
        Number(o._codAmount || 0) > 0 ||
        Number(o._amountDue || 0) > 0,
    )
    .map((o) => ({
      "Mã đơn": o.orderCode,
      "Khách hàng": o.customerName,
      SĐT: o.customerPhone,
      "Chi nhánh":
        branches.find((b) => b.id === o.branchId)?.name || o.branchId || "",
      "Thanh toán": paymentStatusLabel(o.paymentStatus),
      COD: o._codAmount,
      "Còn phải trả": o._amountDue,
      "Tổng tiền": Number(o.finalAmount || 0),
      "Mã vận đơn": o.shipment?.trackingCode || "",
    }));
  if (codRows.length)
    XLSX.utils.book_append_sheet(
      wb,
      makeOrderWorksheet(codRows),
      "COD - công nợ",
    );

  if (includeItemSheet) {
    const itemRows: Record<string, any>[] = [];
    for (const order of sortedOrders) {
      for (const item of order.items || []) {
        const anyItem = item as any;
        itemRows.push({
          "Mã đơn": order.orderCode,
          "Ngày tạo": order.createdAt,
          "Khách hàng": order.customerName,
          "Chi nhánh":
            branches.find((b) => b.id === order.branchId)?.name ||
            order.branchId ||
            "",
          SKU: anyItem.sku || anyItem.variant?.sku || "",
          "Sản phẩm":
            anyItem.productName || anyItem.name || anyItem.product?.name || "",
          Màu: anyItem.color || anyItem.variant?.color || "",
          Size: anyItem.size || anyItem.variant?.size || "",
          SL: Number(anyItem.quantity || anyItem.qty || 0),
          "Đơn giá": Number(anyItem.price || anyItem.unitPrice || 0),
          "Thành tiền": Number(
            anyItem.total ||
              anyItem.lineTotal ||
              Number(anyItem.quantity || anyItem.qty || 0) *
                Number(anyItem.price || anyItem.unitPrice || 0),
          ),
        });
      }
    }
    XLSX.utils.book_append_sheet(
      wb,
      makeOrderWorksheet(itemRows),
      "Sản phẩm trong đơn",
    );
  }

  if (includeBranchSheets) {
    for (const branch of branches) {
      const branchOrders = sortedOrders.filter((o) => o.branchId === branch.id);
      if (!branchOrders.length) continue;
      XLSX.utils.book_append_sheet(
        wb,
        makeOrderWorksheet(getOrderExportRows(branchOrders, branches, columns)),
        safeOrderSheetName(branch.name),
      );
    }
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  XLSX.writeFile(wb, `orders_export_${yyyy}${mm}${dd}_${hh}${mi}.xlsx`);
  return sortedOrders.length;
}

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [printVersion, setPrintVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [quickViewOrder, setQuickViewOrder] = useState<AdminOrder | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmText, setConfirmText] = useState("Xác nhận");
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    null | (() => Promise<void>)
  >(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [staffList, setStaffList] = useState<StaffLite[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assigningOrders, setAssigningOrders] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<OrderExportScope>("filtered");
  const [exportBranchIds, setExportBranchIds] = useState<string[]>([]);
  const [exportColumns, setExportColumns] = useState<OrderExportColumnState>({
    ...defaultOrderExportColumns,
  });
  const [exportOnlyUnpaid, setExportOnlyUnpaid] = useState(false);
  const [exportOnlyCod, setExportOnlyCod] = useState(false);
  const [exportIncludeSummarySheet, setExportIncludeSummarySheet] =
    useState(true);
  const [exportIncludeBranchSheets, setExportIncludeBranchSheets] =
    useState(true);
  const [exportIncludeItemSheet, setExportIncludeItemSheet] = useState(true);
  const [exportSortMode, setExportSortMode] =
    useState<OrderExportSortMode>("created_desc");
  const [exportingOrders, setExportingOrders] = useState(false);

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      setBranches([]);
    }
  };

  const loadStaffList = async () => {
    try {
      const json = await apiJson<any>("/staff");
      const data = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : [];
      setStaffList(data.filter((item: any) => item?.isActive !== false));
    } catch {
      setStaffList([]);
    }
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [orderFilter, setOrderFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<
    "ALL" | OrderPaymentStatus
  >("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickDate, setQuickDate] = useState<QuickDateKey>("all");
  const [quickStatus, setQuickStatus] = useState<QuickStatusKey>("ALL");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [createdByFilter, setCreatedByFilter] = useState("ALL");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("ALL");
  const [salesChannelFilter, setSalesChannelFilter] = useState("ALL");
  const [shippingModeFilter, setShippingModeFilter] = useState("ALL");
  const [shippingPartnerFilter, setShippingPartnerFilter] = useState("ALL");
  const [trackingFilter, setTrackingFilter] = useState("ALL");
  const [freeTextFilter, setFreeTextFilter] = useState("");

  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [savingOrderStatus, setSavingOrderStatus] = useState(false);
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserLite | null>(null);

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const isDraggingRef = useRef(false);

  const [tableScrollLeft, setTableScrollLeft] = useState(0);
  const [tableMaxScrollLeft, setTableMaxScrollLeft] = useState(0);
  const [isDraggingTable, setIsDraggingTable] = useState(false);

  const canViewAllOrders = hasOrderPermission(currentUser, "orders.view");
  const canViewOwnOrders = hasOrderPermission(currentUser, "orders.view_own");
  const canApproveOrder = hasOrderPermission(currentUser, "orders.approve");
  const canCancelOrder = hasOrderPermission(currentUser, "orders.cancel");
  const canPayOrder = hasOrderPermission(currentUser, "orders.pay");
  const canPackShipOrder = hasOrderPermission(currentUser, "orders.pack_ship");
  const canExportOrderExcel = hasOrderPermission(
    currentUser,
    "orders.excel.export",
  );

  const canSeeMoney = isOwnerOrAdminUser(currentUser);
  const canDeleteOrder = isOwnerOrAdminUser(currentUser);

  const userStorageSuffix = useMemo(() => {
    const userKey =
      currentUser?.id ||
      currentUser?.code ||
      currentUser?.email ||
      currentUser?.name ||
      currentUser?.fullName ||
      currentUser?.role ||
      "guest";

    return `${String(userKey).replace(/[^a-zA-Z0-9_-]/g, "_")}.${
      currentUser?.branchId || "all"
    }`;
  }, [currentUser]);

  const columnStorageKey = `orders.visibleColumns.${
    canSeeMoney ? "admin" : "staff"
  }.${userStorageSuffix}`;

  const scrollStorageKey = `${TABLE_SCROLL_STORAGE_KEY}.${userStorageSuffix}`;

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([]);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<ColumnKey[]>(
    [],
  );
  const dragColumnKeyRef = useRef<ColumnKey | null>(null);

  const branchLabel = (branchId?: string | null) => {
    if (!branchId) return "All";
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  const staffLabel = (staff?: StaffLite | null) => {
    if (!staff) return "—";
    return staff.name || staff.fullName || staff.code || staff.id;
  };

  const assignableStaffList = useMemo(() => {
    if (isOwnerOrAdminUser(currentUser) || branchFilter === "ALL")
      return staffList;
    return staffList.filter(
      (staff) => !staff.branchId || staff.branchId === branchFilter,
    );
  }, [staffList, currentUser, branchFilter]);

  const openOrderInNewTab = (order: AdminOrder, action?: string) => {
    const baseHref = `/orders/${encodeURIComponent(order.id)}`;
    const href = action
      ? `${baseHref}?action=${encodeURIComponent(action)}`
      : baseHref;

    addWorkspaceTab({
      id: action ? `${order.id}-${action}` : order.id,
      title:
        action === "redelivery"
          ? `${order.orderCode} · Giao lại`
          : order.orderCode,
      href,
      type: "order",
    });

    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copyOrderToNewTab = (order: AdminOrder) => {
    const href = `/orders/create?copyFrom=${encodeURIComponent(order.id)}`;

    addWorkspaceTab({
      id: `${order.id}-copy`,
      title: `${order.orderCode} · Sao chép`,
      href,
      type: "order",
    });

    window.open(href, "_blank", "noopener,noreferrer");
  };

  const fetchFullOrderDetail = async (
    order: AdminOrder,
  ): Promise<AdminOrder> => {
    const hasFullItems =
      Array.isArray(order.items) &&
      order.items.some((item: any) => item?.productName || item?.sku);

    if (hasFullItems) return order;

    const res = await apiFetch(
      `/orders/${encodeURIComponent(order.id)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || "Không tải được chi tiết đơn hàng.");
    }

    return json as AdminOrder;
  };

  const openQuickViewOrder = async (order: AdminOrder) => {
    try {
      setQuickViewLoading(true);
      setActionMessage("");
      const fullOrder = await fetchFullOrderDetail(order);
      setQuickViewOrder(fullOrder);
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? err.message
          : "Không mở được xem nhanh đơn hàng.",
      );
    } finally {
      setQuickViewLoading(false);
    }
  };

  const updateTableScrollState = () => {
    const el = tableScrollRef.current;
    if (!el) return;

    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = Math.max(0, Math.min(el.scrollLeft, max));

    setTableMaxScrollLeft(max);
    setTableScrollLeft(left);

    try {
      localStorage.setItem(scrollStorageKey, String(left));
    } catch {
      // ignore localStorage write errors
    }
  };

  const scrollTableTo = (left: number) => {
    const el = tableScrollRef.current;
    if (!el) return;

    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const safeLeft = Math.max(0, Math.min(left, max));

    el.scrollLeft = safeLeft;
    setTableMaxScrollLeft(max);
    setTableScrollLeft(safeLeft);

    try {
      localStorage.setItem(scrollStorageKey, String(safeLeft));
    } catch {
      // ignore localStorage write errors
    }
  };

  const scrollTableBy = (delta: number) => {
    const el = tableScrollRef.current;
    if (!el) return;
    scrollTableTo(el.scrollLeft + delta);
  };

  const handleTableMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;

    if (
      target?.closest(
        'button, a, input, select, textarea, label, [data-no-drag-scroll="true"]',
      )
    ) {
      return;
    }

    const el = tableScrollRef.current;
    if (!el) return;

    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.pageX;
    dragStartScrollRef.current = el.scrollLeft;
    setIsDraggingTable(true);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const currentEl = tableScrollRef.current;
      if (!currentEl) return;

      const deltaX = ev.pageX - dragStartXRef.current;
      currentEl.scrollLeft = dragStartScrollRef.current - deltaX;

      const rect = currentEl.getBoundingClientRect();
      if (ev.clientX > rect.right - 90) {
        currentEl.scrollLeft += 24;
        dragStartScrollRef.current = currentEl.scrollLeft;
        dragStartXRef.current = ev.pageX;
      } else if (ev.clientX < rect.left + 90) {
        currentEl.scrollLeft -= 24;
        dragStartScrollRef.current = currentEl.scrollLeft;
        dragStartXRef.current = ev.pageX;
      }

      updateTableScrollState();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDraggingTable(false);
      updateTableScrollState();

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const storedUser = getCurrentUserLite();
    setCurrentUser(storedUser);

    if (
      storedUser?.role !== "admin" &&
      storedUser?.role !== "owner" &&
      storedUser?.branchId
    ) {
      setBranchFilter(storedUser.branchId);
    }

    // Lấy lại auth/me để chắc chắn permissions mới nhất đã sync sau khi đổi role.
    // Nếu chỉ đọc localStorage cũ, orders.view_own có thể đã tick nhưng trang đơn vẫn báo không có quyền.
    apiJson("/auth/me")
      .then((data) => {
        const freshUser = data?.user || data;
        if (!freshUser) return;

        setCurrentUser(freshUser);
        saveCurrentUserLite(freshUser);

        if (
          freshUser?.role !== "admin" &&
          freshUser?.role !== "owner" &&
          freshUser?.branchId
        ) {
          setBranchFilter(freshUser.branchId);
        }
      })
      .catch(() => {
        // giữ user local nếu auth/me lỗi
      });

    void loadBranches();
    void loadStaffList();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(columnStorageKey);
      if (!raw) {
        const defaults = defaultVisibleColumns(canSeeMoney);
        setVisibleColumns(defaults);
        setDraftVisibleColumns(defaults);
        return;
      }

      const parsed = JSON.parse(raw) as ColumnKey[];
      const allowed = COLUMN_DEFS.filter((col) =>
        canSeeMoney ? true : !col.money,
      ).map((c) => c.key);
      const cleaned = parsed.filter((key) => allowed.includes(key));
      const defaults = defaultVisibleColumns(canSeeMoney);
      const merged = cleaned.length
        ? [...cleaned, ...defaults.filter((key) => !cleaned.includes(key))]
        : defaults;

      // Giữ đúng thứ tự đã kéo thả trong localStorage, không sort lại theo COLUMN_DEFS.
      const nextColumns = merged;
      setVisibleColumns(nextColumns);
      setDraftVisibleColumns(nextColumns);
    } catch {
      const defaults = defaultVisibleColumns(canSeeMoney);
      setVisibleColumns(defaults);
      setDraftVisibleColumns(defaults);
    }
  }, [canSeeMoney, columnStorageKey]);

  useEffect(() => {
    if (!visibleColumns.length) return;
    localStorage.setItem(columnStorageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns, columnStorageKey]);

  useEffect(() => {
    const restoreScroll = () => {
      const el = tableScrollRef.current;
      if (!el) return;

      let saved = 0;
      try {
        saved = Number(localStorage.getItem(scrollStorageKey) || 0);
      } catch {
        saved = 0;
      }

      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      const safeLeft = Math.max(0, Math.min(saved, max));
      el.scrollLeft = safeLeft;
      setTableMaxScrollLeft(max);
      setTableScrollLeft(safeLeft);
    };

    const raf = window.requestAnimationFrame(restoreScroll);
    window.addEventListener("resize", updateTableScrollState);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateTableScrollState);
    };
  }, [visibleColumns.length, orders.length, page, scrollStorageKey]);

  useEffect(() => {
    if (showColumnMenu) setDraftVisibleColumns(visibleColumns);
  }, [showColumnMenu]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(e.target as Node)
      ) {
        setShowColumnMenu(false);
      }
      if (
        printMenuRef.current &&
        !printMenuRef.current.contains(e.target as Node)
      ) {
        setShowPrintMenu(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        setOrders([]);
        return;
      }

      if (!canViewAllOrders && !canViewOwnOrders) {
        setError("Tài khoản chưa được cấp quyền xem đơn hàng.");
        setOrders([]);
        return;
      }

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (deferredQuery.trim()) params.set("q", deferredQuery.trim());

      if (!canViewAllOrders && canViewOwnOrders) {
        params.set("viewScope", "own");
        if (currentUser?.id) params.set("createdByStaffId", currentUser.id);
        if (currentUser?.code)
          params.set("createdByStaffCode", currentUser.code);
      }

      if (!canViewAllOrders && currentUser?.branchId) {
        params.set("branchId", currentUser.branchId);
      } else if (branchFilter !== "ALL") {
        params.set("branchId", branchFilter);
      }

      if (orderFilter !== "ALL") params.set("orderStatus", orderFilter);
      if (paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await apiFetch(`/orders?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const raw = await res.json();

      if (!res.ok) {
        throw new Error(
          raw?.message || `Tải /orders thất bại. Status ${res.status}`,
        );
      }

      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

      const scopedData =
        !canViewAllOrders && canViewOwnOrders
          ? data.filter((order: any) =>
              isOrderCreatedByCurrentUser(order, currentUser),
            )
          : data;

      setOrders(scopedData as AdminOrder[]);
      setTotalPages(Number(raw?.pagination?.totalPages || 1));
      setTotalItems(
        !canViewAllOrders && canViewOwnOrders
          ? scopedData.length
          : Number(raw?.pagination?.total || scopedData.length || 0),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không tải được đơn hàng.";
      setError(message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void loadOrders();
    }, 250);

    return () => clearTimeout(t);
  }, [
    deferredQuery,
    branchFilter,
    orderFilter,
    paymentFilter,
    dateFrom,
    dateTo,
    page,
    pageSize,
    currentUser,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    deferredQuery,
    branchFilter,
    orderFilter,
    paymentFilter,
    dateFrom,
    dateTo,
    createdByFilter,
    fulfillmentFilter,
    salesChannelFilter,
    shippingModeFilter,
    shippingPartnerFilter,
    trackingFilter,
    freeTextFilter,
  ]);

  const normalizedOrders = useMemo<NormalizedOrder[]>(() => {
    return orders.map((order) => {
      const meta = parseStructuredNote(order.note);
      return {
        ...order,
        _meta: meta,
        _createdByName: getCreatedByName(order),
        _assignedStaffName: String(
          (order as any).assignedStaffName ||
            (order as any).assignedStaff?.name ||
            (order as any).assignedToStaffName ||
            getCreatedByName(order) ||
            "",
        ).trim(),
        _shippingFee: Number(order.shippingFee || 0),
        _carrierShippingFee: Number(order.shipment?.shippingFee || 0),
        _codAmount: Number(order.shipment?.codAmount || 0),
        _amountDue: amountCustomerStillOwes(order),
        _createdAtDate: parseOrderDate(order.createdAt),
      };
    });
  }, [orders]);

  const branchOptions = useMemo(() => {
    return [
      { value: "ALL", label: "Tất cả chi nhánh" },
      ...branches.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ];
  }, [branches]);

  const uniqueOptions = (values: Array<string | null | undefined>) => {
    return Array.from(
      new Set(
        values
          .map((value) => String(value || "").trim())
          .filter((value) => value && value !== "—"),
      ),
    ).sort((a, b) => a.localeCompare(b, "vi"));
  };

  const createdByOptions = useMemo(
    () => uniqueOptions(normalizedOrders.map((o) => o._createdByName)),
    [normalizedOrders],
  );

  const salesChannelOptions = useMemo(
    () => uniqueOptions(normalizedOrders.map((o) => o.salesChannel)),
    [normalizedOrders],
  );

  const shippingModeOptions = useMemo(
    () => uniqueOptions(normalizedOrders.map((o) => o._meta.shippingMode)),
    [normalizedOrders],
  );

  const shippingPartnerOptions = useMemo(
    () =>
      uniqueOptions(
        normalizedOrders.map(
          (o) => o.shipment?.carrier || o._meta.shippingPartner,
        ),
      ),
    [normalizedOrders],
  );

  const activeAdvancedFilterCount =
    [
      createdByFilter,
      fulfillmentFilter,
      salesChannelFilter,
      shippingModeFilter,
      shippingPartnerFilter,
      trackingFilter,
    ].filter((value) => value !== "ALL").length +
    (freeTextFilter.trim() ? 1 : 0);

  const clearAdvancedFilters = () => {
    setCreatedByFilter("ALL");
    setFulfillmentFilter("ALL");
    setSalesChannelFilter("ALL");
    setShippingModeFilter("ALL");
    setShippingPartnerFilter("ALL");
    setTrackingFilter("ALL");
    setFreeTextFilter("");
  };

  const filteredOrders = useMemo(() => {
    let result = normalizedOrders;

    if (quickStatus !== "ALL") {
      result = result.filter((o) => {
        switch (quickStatus) {
          case "WAITING_APPROVE":
            return o.status === "NEW";
          case "WAITING_PAYMENT":
            return ["UNPAID", "PARTIAL", "PENDING_COD"].includes(
              o.paymentStatus,
            );
          case "WAITING_PACKING":
            return o.status === "PACKING";
          case "WAITING_SHIP":
            return ["APPROVED", "PACKING"].includes(o.status);
          case "DELIVERING":
            return o.status === "SHIPPED";
          case "SOON_DELIVERY":
            return isSoonDeliveryOrder(o);
          case "FAIL":
            return isFailedOrder(o);
          case "REDELIVERY":
            return isRedeliveryOrder(o);
          default:
            return true;
        }
      });
    }

    if (createdByFilter !== "ALL") {
      result = result.filter((o) => o._createdByName === createdByFilter);
    }

    if (fulfillmentFilter !== "ALL") {
      result = result.filter(
        (o) => String(o.fulfillmentStatus || "") === fulfillmentFilter,
      );
    }

    if (salesChannelFilter !== "ALL") {
      result = result.filter(
        (o) => String(o.salesChannel || "") === salesChannelFilter,
      );
    }

    if (shippingModeFilter !== "ALL") {
      result = result.filter(
        (o) => o._meta.shippingMode === shippingModeFilter,
      );
    }

    if (shippingPartnerFilter !== "ALL") {
      result = result.filter(
        (o) =>
          (o.shipment?.carrier || o._meta.shippingPartner || "") ===
          shippingPartnerFilter,
      );
    }

    if (trackingFilter !== "ALL") {
      result = result.filter((o) => {
        const hasTracking = Boolean(
          String(o.shipment?.trackingCode || "").trim(),
        );
        return trackingFilter === "HAS" ? hasTracking : !hasTracking;
      });
    }

    const keyword = freeTextFilter.trim().toLowerCase();
    if (keyword) {
      result = result.filter((o) => {
        const haystack = [
          o.orderCode,
          o.customerName,
          o.customerPhone,
          o.status,
          o.paymentStatus,
          o.fulfillmentStatus,
          o.branchId,
          branchLabel(o.branchId),
          o._createdByName,
          o.salesChannel,
          o._meta.address,
          o._meta.noteText,
          o._meta.shippingNote,
          o._meta.shippingMode,
          o._meta.shippingPartner,
          o.shipment?.carrier,
          o.shipment?.trackingCode,
          o.note,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(keyword);
      });
    }

    return result;
  }, [
    normalizedOrders,
    quickStatus,
    createdByFilter,
    fulfillmentFilter,
    salesChannelFilter,
    shippingModeFilter,
    shippingPartnerFilter,
    trackingFilter,
    freeTextFilter,
    branches,
  ]);

  const visibleOrders = filteredOrders;

  useEffect(() => {
    if (!filteredOrders.length) {
      setCheckedIds([]);
      return;
    }

    setCheckedIds((prev) =>
      prev.filter((id) => filteredOrders.some((o) => o.id === id)),
    );
  }, [filteredOrders]);

  const counts = useMemo(() => {
    let waitingApprove = 0;
    let waitingPayment = 0;
    let waitingPacking = 0;
    let waitingShip = 0;
    let delivering = 0;
    let soonDelivery = 0;
    let failed = 0;
    let redelivery = 0;
    let localDelivery = 0;

    for (const o of normalizedOrders) {
      if (o.status === "NEW") waitingApprove++;
      if (["UNPAID", "PARTIAL", "PENDING_COD"].includes(o.paymentStatus)) {
        waitingPayment++;
      }
      if (o.status === "PACKING") waitingPacking++;
      if (["APPROVED", "PACKING"].includes(o.status)) waitingShip++;
      if (o.status === "SHIPPED") delivering++;
      if (isSoonDeliveryOrder(o)) soonDelivery++;
      if (isFailedOrder(o)) failed++;
      if (isRedeliveryOrder(o)) redelivery++;
      if (isLocalDeliveryCarrier(o.shipment?.carrier || o._meta.shippingPartner)) {
        localDelivery++;
      }
    }

    return {
      waitingApprove,
      waitingPayment,
      waitingPacking,
      waitingShip,
      delivering,
      soonDelivery,
      failed,
      redelivery,
      localDelivery,
    };
  }, [normalizedOrders]);

  const allVisibleIds = visibleOrders.map((o) => o.id);
  const allChecked =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => checkedIds.includes(id));

  const checkedOrders = normalizedOrders.filter((o) =>
    checkedIds.includes(o.id),
  );
  const singleCheckedOrder =
    checkedOrders.length === 1 ? checkedOrders[0] : null;
  const canRedeliverySelected =
    !!singleCheckedOrder &&
    (isFailedOrder(singleCheckedOrder) ||
      isRedeliveryOrder(singleCheckedOrder));

  const toggleCheckOne = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleCheckAllVisible = () => {
    if (allChecked) {
      setCheckedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
      return;
    }

    setCheckedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
  };

  const updateOneStatus = async (id: string, status: OrderStatus) => {
    const updated = await updateOrderStatus(id, status);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const updateOnePaymentStatus = async (
    id: string,
    paymentStatus: OrderPaymentStatus,
  ) => {
    const updated = await updateOrderPaymentStatus(id, paymentStatus);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleBulkApprove = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingOrderStatus(true);
      setActionMessage("");

      let count = 0;
      for (const id of checkedIds) {
        const order = normalizedOrders.find((o) => o.id === id);
        if (order?.status === "NEW") {
          await updateOneStatus(id, "APPROVED");
          count += 1;
        }
      }

      setActionMessage(`Đã duyệt ${count} đơn.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi duyệt đơn hàng loạt.",
      );
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingPaymentStatus(true);
      setActionMessage("");

      let count = 0;
      for (const id of checkedIds) {
        const order = normalizedOrders.find((o) => o.id === id);
        if (
          order &&
          order.paymentStatus !== "PAID" &&
          order.paymentStatus !== "REFUNDED" &&
          order.status !== "CANCELLED"
        ) {
          await updateOnePaymentStatus(id, "PAID");
          count += 1;
        }
      }

      setActionMessage(`Đã cập nhật thanh toán cho ${count} đơn.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? err.message
          : "Lỗi cập nhật thanh toán hàng loạt.",
      );
    } finally {
      setSavingPaymentStatus(false);
    }
  };

  const sendOneOrderToCarrier = async (id: string) => {
    const res = await apiFetch(`/shipments/${id}/create`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        json?.message ||
        json?.error ||
        json?.details ||
        JSON.stringify(json || {});
      throw new Error(detail || "Gửi GHN thất bại.");
    }

    return json;
  };

  const cancelOneOrderOnCarrier = async (id: string) => {
    const res = await apiFetch(`/shipments/${id}/cancel`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        json?.message ||
        json?.error ||
        json?.details ||
        JSON.stringify(json || {});
      throw new Error(detail || "Hủy GHN thất bại.");
    }

    return json;
  };

  const deleteOneOrder = async (id: string) => {
    const res = await apiFetch(`/orders/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        json?.message ||
        json?.error ||
        json?.details ||
        JSON.stringify(json || {});
      throw new Error(detail || "Xóa đơn thất bại.");
    }

    return json;
  };

  const handleDeleteOrder = async (id: string) => {
    const order = normalizedOrders.find((o) => o.id === id);

    setConfirmTitle("Xóa đơn hàng");
    setConfirmDescription(
      `Bạn có chắc muốn xóa đơn ${order?.orderCode || ""}? Chỉ đơn đã hủy mới có thể xóa.`,
    );
    setConfirmText("Xóa đơn");
    setConfirmDanger(true);
    setConfirmAction(() => async () => {
      try {
        setDeletingOrders(true);
        setActionMessage("");
        await deleteOneOrder(id);
        await loadOrders();
        setActionMessage("Đã xóa đơn.");
      } catch (err) {
        setActionMessage(err instanceof Error ? err.message : "Lỗi xóa đơn.");
      } finally {
        setDeletingOrders(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleInternalCancelOrder = async (id: string) => {
    const order = normalizedOrders.find((o) => o.id === id);
    if (!order) return;

    setConfirmTitle("Huỷ đơn nội bộ");
    setConfirmDescription(
      `Huỷ nội bộ đơn ${order.orderCode || ""}? Nút này chỉ đổi trạng thái đơn trong hệ thống, không gửi lệnh huỷ sang GHN.`,
    );
    setConfirmText("Huỷ nội bộ");
    setConfirmDanger(true);
    setConfirmAction(() => async () => {
      try {
        setSavingOrderStatus(true);
        setActionMessage("");
        await updateOneStatus(id, "CANCELLED");
        await loadOrders();
        setActionMessage(`Đã huỷ nội bộ đơn ${order.orderCode}.`);
      } catch (err) {
        setActionMessage(
          err instanceof Error ? err.message : "Lỗi huỷ đơn nội bộ.",
        );
      } finally {
        setSavingOrderStatus(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleBulkInternalCancel = async () => {
    if (!checkedIds.length) return;

    setConfirmTitle("Huỷ đơn nội bộ");
    setConfirmDescription(
      `Huỷ nội bộ ${checkedIds.length} đơn đã chọn? Nút này chỉ đổi trạng thái trong hệ thống, không gửi lệnh huỷ sang GHN.`,
    );
    setConfirmText("Huỷ nội bộ");
    setConfirmDanger(true);
    setConfirmAction(() => async () => {
      try {
        setSavingOrderStatus(true);
        setActionMessage("");

        let successCount = 0;
        const failed: string[] = [];

        for (const id of checkedIds) {
          const order = normalizedOrders.find((o) => o.id === id);
          if (!order) continue;

          if (order.status === "COMPLETED") {
            failed.push(`${order.orderCode}: đơn đã hoàn thành`);
            continue;
          }

          try {
            await updateOneStatus(id, "CANCELLED");
            successCount += 1;
          } catch (err) {
            failed.push(
              `${order.orderCode}: ${
                err instanceof Error ? err.message : "Lỗi không rõ"
              }`,
            );
          }
        }

        await loadOrders();
        setCheckedIds([]);

        if (failed.length === 0) {
          setActionMessage(`Đã huỷ nội bộ ${successCount} đơn.`);
        } else {
          setActionMessage(
            `Đã huỷ nội bộ ${successCount} đơn. Lỗi: ${failed.join(" | ")}`,
          );
        }
      } catch (err) {
        setActionMessage(
          err instanceof Error ? err.message : "Lỗi huỷ đơn nội bộ hàng loạt.",
        );
      } finally {
        setSavingOrderStatus(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!checkedIds.length) return;

    setConfirmTitle("Xóa đơn hàng");
    setConfirmDescription(
      `Bạn đang xóa ${checkedIds.length} đơn đã chọn. Chỉ đơn đã hủy mới có thể xóa. Hành động này không thể hoàn tác.`,
    );
    setConfirmText("Xóa đơn");
    setConfirmDanger(true);
    setConfirmAction(() => async () => {
      try {
        setDeletingOrders(true);
        setActionMessage("");

        let successCount = 0;
        const failed: string[] = [];

        for (const id of checkedIds) {
          const order = normalizedOrders.find((o) => o.id === id);
          if (!order) continue;

          try {
            await deleteOneOrder(id);
            successCount += 1;
          } catch (err) {
            failed.push(
              `${order.orderCode}: ${
                err instanceof Error ? err.message : "Lỗi không rõ"
              }`,
            );
          }
        }

        await loadOrders();
        setCheckedIds([]);

        if (failed.length === 0) {
          setActionMessage(`Đã xóa ${successCount} đơn.`);
        } else {
          setActionMessage(
            `Đã xóa ${successCount} đơn. Lỗi: ${failed.join(" | ")}`,
          );
        }
      } catch (err) {
        setActionMessage(
          err instanceof Error ? err.message : "Lỗi xóa đơn hàng loạt.",
        );
      } finally {
        setDeletingOrders(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleBulkSendToCarrier = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingOrderStatus(true);
      setActionMessage("");

      let successCount = 0;
      const failed: string[] = [];

      for (const id of checkedIds) {
        const order = normalizedOrders.find((o) => o.id === id);
        if (!order) continue;

        try {
          await sendOneOrderToCarrier(id);
          successCount += 1;
        } catch {
          failed.push(order.orderCode || id);
        }
      }

      await loadOrders();

      if (failed.length === 0) {
        setActionMessage(`Đã gửi GHN thành công ${successCount} đơn.`);
      } else {
        setActionMessage(
          `Đã gửi GHN ${successCount} đơn. Thất bại: ${failed.join(", ")}`,
        );
      }
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi gửi sang HVC.",
      );
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const handleBulkCancel = async () => {
    if (!checkedIds.length) return;

    setConfirmTitle("Huỷ đơn GHN");
    setConfirmDescription(
      `Huỷ GHN cho ${checkedIds.length} đơn đã chọn? Nút này gửi yêu cầu huỷ sang GHN nếu đơn đã có mã vận đơn.`,
    );
    setConfirmText("Huỷ GHN");
    setConfirmDanger(false);
    setConfirmAction(() => async () => {
      try {
        setSavingOrderStatus(true);
        setActionMessage("");

        let successCount = 0;
        const failed: string[] = [];

        for (const id of checkedIds) {
          const order = normalizedOrders.find((o) => o.id === id);
          if (!order) continue;

          if (order.status === "COMPLETED") {
            failed.push(`${order.orderCode}: không thể hủy`);
            continue;
          }

          try {
            await cancelOneOrderOnCarrier(id);
            successCount += 1;
          } catch (err) {
            failed.push(
              `${order.orderCode}: ${
                err instanceof Error ? err.message : "Lỗi không rõ"
              }`,
            );
          }
        }

        await loadOrders();

        if (failed.length === 0) {
          setActionMessage(`Đã huỷ GHN ${successCount} đơn.`);
        } else {
          setActionMessage(
            `Đã huỷ GHN ${successCount} đơn. Lỗi: ${failed.join(" | ")}`,
          );
        }
      } catch (err) {
        setActionMessage(
          err instanceof Error ? err.message : "Lỗi hủy đơn hàng loạt.",
        );
      } finally {
        setSavingOrderStatus(false);
      }
    });

    setConfirmOpen(true);
  };
  const handlePrint = async (
    type: "shipping" | "sales",
    paper: PrintPaperSize,
    sourceOrders: NormalizedOrder[] = checkedOrders,
  ) => {
    if (!sourceOrders.length) return;

    const templates = loadPrintTemplates();

    const fullOrders = await Promise.all(
      sourceOrders.map((order) => fetchFullOrderDetail(order)),
    );

    const html = fullOrders
      .map((order) => {
        const template = findPrintTemplate({
          templates,
          branchId: order.branchId,
          templateType: type,
          paperSize: paper,
        });

        if (!template) return "";

        return `<div class="print-page">${renderOrderTemplateHtml({
          order,
          template,
        })}</div>`;
      })
      .join("");

    openPrintDocument({
      title: "In đơn",
      paperSize: paper,
      bodyHtml: html,
    });

    sourceOrders.forEach((order) => bumpOrderPrintCount(order.id));
    setPrintVersion((value) => value + 1);
    setActionMessage(`Đã gửi lệnh in ${sourceOrders.length} đơn.`);
  };

  const handleExportOrdersExcel = () => {
    try {
      setExportingOrders(true);
      setActionMessage("Đang tạo file Excel đơn hàng...");

      let sourceOrders =
        exportScope === "checked"
          ? checkedOrders
          : exportScope === "current_page"
            ? normalizedOrders
            : visibleOrders;

      if (exportBranchIds.length) {
        sourceOrders = sourceOrders.filter((order) =>
          exportBranchIds.includes(String(order.branchId || "")),
        );
      }

      if (exportOnlyUnpaid) {
        sourceOrders = sourceOrders.filter((order) =>
          ["UNPAID", "PARTIAL", "PENDING_COD"].includes(order.paymentStatus),
        );
      }

      if (exportOnlyCod) {
        sourceOrders = sourceOrders.filter(
          (order) =>
            order.paymentStatus === "PENDING_COD" ||
            Number(order._codAmount || 0) > 0,
        );
      }

      const branchListForExport = exportBranchIds.length
        ? branches.filter((branch) => exportBranchIds.includes(branch.id))
        : branches;

      const rowCount = exportOrdersExcel({
        orders: sourceOrders,
        branches: branchListForExport.length ? branchListForExport : branches,
        columns: exportColumns,
        includeSummarySheet: exportIncludeSummarySheet,
        includeBranchSheets: exportIncludeBranchSheets,
        includeItemSheet: exportIncludeItemSheet,
        sortMode: exportSortMode,
      });

      setExportOpen(false);
      setActionMessage(`Đã xuất Excel ${rowCount} đơn hàng.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Xuất Excel đơn hàng thất bại.",
      );
    } finally {
      setExportingOrders(false);
    }
  };

  const applyOrderExportPreset = (
    preset: "management" | "accounting" | "shipping" | "cod" | "full",
  ) => {
    if (preset === "management") {
      setExportScope("filtered");
      setExportOnlyUnpaid(false);
      setExportOnlyCod(false);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(true);
      setExportIncludeItemSheet(true);
      setExportSortMode("amount_desc");
      setExportColumns({ ...defaultOrderExportColumns });
      return;
    }

    if (preset === "accounting") {
      setExportScope("filtered");
      setExportOnlyUnpaid(false);
      setExportOnlyCod(false);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(true);
      setExportIncludeItemSheet(false);
      setExportSortMode("amount_desc");
      setExportColumns({
        ...defaultOrderExportColumns,
        shippingAddress: false,
        note: false,
      });
      return;
    }

    if (preset === "shipping") {
      setExportScope("filtered");
      setExportOnlyUnpaid(false);
      setExportOnlyCod(false);
      setExportIncludeSummarySheet(false);
      setExportIncludeBranchSheets(true);
      setExportIncludeItemSheet(false);
      setExportSortMode("created_desc");
      setExportColumns({
        ...defaultOrderExportColumns,
        shippingFee: false,
        codAmount: true,
        amountDue: false,
        finalAmount: false,
      });
      return;
    }

    if (preset === "cod") {
      setExportScope("filtered");
      setExportOnlyUnpaid(true);
      setExportOnlyCod(true);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(true);
      setExportIncludeItemSheet(false);
      setExportSortMode("cod_desc");
      setExportColumns({
        ...defaultOrderExportColumns,
        note: false,
      });
      return;
    }

    setExportScope("filtered");
    setExportOnlyUnpaid(false);
    setExportOnlyCod(false);
    setExportIncludeSummarySheet(true);
    setExportIncludeBranchSheets(true);
    setExportIncludeItemSheet(true);
    setExportSortMode("created_desc");
    setExportColumns(
      Object.fromEntries(
        (Object.keys(defaultOrderExportColumns) as OrderExportColumnKey[]).map(
          (key) => [key, true],
        ),
      ) as OrderExportColumnState,
    );
  };

  const toggleColumn = (key: ColumnKey) => {
    setDraftVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== key);
      }
      return [...prev, key];
    });
  };

  const resetColumns = () => {
    setDraftVisibleColumns(defaultVisibleColumns(canSeeMoney));
  };

  const saveColumns = () => {
    const allowed = COLUMN_DEFS.filter((col) =>
      canSeeMoney ? true : !col.money,
    ).map((col) => col.key);
    const cleaned = draftVisibleColumns.filter((key) => allowed.includes(key));
    const next = cleaned.length ? cleaned : defaultVisibleColumns(canSeeMoney);
    setVisibleColumns(next);
    localStorage.setItem(columnStorageKey, JSON.stringify(next));
    setShowColumnMenu(false);
    window.requestAnimationFrame(updateTableScrollState);
  };

  const moveColumn = (key: ColumnKey, direction: "up" | "down") => {
    setDraftVisibleColumns((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const handleColumnDragStart = (key: ColumnKey) => {
    dragColumnKeyRef.current = key;
  };

  const handleColumnDrop = (targetKey: ColumnKey) => {
    const sourceKey = dragColumnKeyRef.current;
    dragColumnKeyRef.current = null;
    if (!sourceKey || sourceKey === targetKey) return;

    setDraftVisibleColumns((prev) => {
      if (!prev.includes(sourceKey) || !prev.includes(targetKey)) return prev;
      const next = prev.filter((key) => key !== sourceKey);
      const targetIndex = next.indexOf(targetKey);
      next.splice(targetIndex, 0, sourceKey);
      return next;
    });
  };

  const isColumnVisible = (key: ColumnKey) => draftVisibleColumns.includes(key);

  const applyQuickDate = (key: QuickDateKey) => {
    setQuickDate(key);
    const range = getQuickDateRange(key);
    setDateFrom(toInputDateValue(range.from));
    setDateTo(toInputDateValue(range.to));
  };

  const paidRevenue = useMemo(
    () =>
      filteredOrders
        .filter((o) => o.paymentStatus === "PAID")
        .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0),
    [filteredOrders],
  );

  const columnWidthClass: Record<ColumnKey, string> = {
    orderCode: "w-[160px]",
    createdAt: "w-[170px]",
    customerName: "w-[150px]",
    customerPhone: "w-[120px]",
    orderStatus: "w-[140px]",
    paymentDotStatus: "w-[120px]",
    paymentStatus: "w-[150px]",
    stockOutStatus: "w-[115px]",
    fulfillmentStatus: "w-[135px]",
    branch: "w-[120px]",
    createdBy: "w-[155px]",
    salesChannel: "w-[120px]",
    shippingMode: "w-[115px]",
    shippingPartner: "w-[110px]",
    trackingCode: "w-[170px]",
    printStatus: "w-[120px]",
    itemCount: "w-[80px]",
    shippingAddress: "w-[260px]",
    note: "w-[230px]",
    shippingFee: "w-[120px]",
    carrierShippingFee: "w-[120px]",
    assignedStaff: "w-[150px]",
    codAmount: "w-[125px]",
    amountDue: "w-[150px]",
    finalAmount: "w-[130px]",
  };

  const applyCellFilter = (key: ColumnKey, value?: string | null) => {
    const safeValue = String(value || "").trim();
    if (!safeValue || safeValue === "—") return;

    setShowAdvancedFilters(true);

    switch (key) {
      case "branch":
        setBranchFilter(String(value));
        break;
      case "createdBy":
        setCreatedByFilter(safeValue);
        break;
      case "salesChannel":
        setSalesChannelFilter(safeValue);
        break;
      case "shippingMode":
        setShippingModeFilter(safeValue);
        break;
      case "shippingPartner":
        setShippingPartnerFilter(safeValue);
        break;
      case "fulfillmentStatus":
        setFulfillmentFilter(safeValue);
        break;
      default:
        setFreeTextFilter(safeValue);
        break;
    }
  };

  const filterButtonClass =
    "rounded-lg px-1 font-medium text-neutral-800 underline-offset-2 hover:bg-neutral-100 hover:underline";

  const stickyColumnClass = (key: ColumnKey, header = false) => {
    if (key !== "orderCode") return "";
    return `${header ? "sticky left-[44px] z-30 bg-neutral-50" : "sticky left-[44px] z-20 bg-white group-hover:bg-neutral-50"} shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]`;
  };

  const orderedVisibleColumns = visibleColumns.filter((key) => {
    const column = COLUMN_DEFS.find((col) => col.key === key);
    if (!column) return false;
    if (column.money && !canSeeMoney) return false;
    return true;
  });

  const renderColumnHeader = (key: ColumnKey) => {
    const column = COLUMN_DEFS.find((col) => col.key === key);
    if (!column) return null;
    const align = column.money
      ? "text-right"
      : key === "itemCount"
        ? "text-center"
        : "text-left";
    return (
      <th
        key={key}
        className={`${columnWidthClass[key]} border-b border-neutral-200 px-3 py-3 ${align} ${stickyColumnClass(key, true)}`}
      >
        {column.label}
      </th>
    );
  };

  const renderColumnCell = (order: NormalizedOrder, key: ColumnKey) => {
    const meta = order._meta;

    switch (key) {
      case "orderCode":
        return (
          <td
            key={key}
            className={`border-b border-neutral-100 px-3 py-3 font-semibold whitespace-nowrap ${stickyColumnClass(key)}`}
          >
            <button
              type="button"
              onClick={() => openOrderInNewTab(order)}
              className="text-left font-semibold text-neutral-900 underline-offset-2 hover:underline"
            >
              {order.orderCode}
            </button>
          </td>
        );
      case "createdAt":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap text-xs text-neutral-500"
          >
            {formatOrderDate(order.createdAt)}
          </td>
        );
      case "customerName":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            {order.customerName || "—"}
          </td>
        );
      case "customerPhone":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            {order.customerPhone || "—"}
          </td>
        );
      case "orderStatus":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <StatusBadge
              label={orderStatusLabel(order.status)}
              tone={orderStatusTone(order.status)}
            />
          </td>
        );
      case "paymentDotStatus":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center"
          >
            <DotStatus
              state={paymentDotState(order.paymentStatus)}
              title={`Thanh toán: ${paymentStatusLabel(order.paymentStatus)}`}
            />
          </td>
        );
      case "paymentStatus":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <StatusBadge
              label={paymentStatusLabel(order.paymentStatus)}
              tone={paymentStatusTone(order.paymentStatus)}
            />
          </td>
        );
      case "stockOutStatus":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center"
          >
            <DotStatus
              state={stockOutDotState(order.status)}
              title={`Xuất kho: ${orderStatusLabel(order.status)}`}
            />
          </td>
        );
      case "fulfillmentStatus":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => applyCellFilter(key, order.fulfillmentStatus)}
              title="Lọc theo trạng thái giao vận này"
            >
              <StatusBadge
                label={shipmentDisplayStatusLabel(order)}
                tone={shipmentDisplayStatusTone(order)}
              />
            </button>
          </td>
        );
      case "branch":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => {
                setBranchFilter(order.branchId || "ALL");
                setShowAdvancedFilters(true);
              }}
              className={filterButtonClass}
              title="Lọc theo chi nhánh này"
            >
              {branchLabel(order.branchId)}
            </button>
          </td>
        );
      case "createdBy":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => {
                setCreatedByFilter(order._createdByName);
                setShowAdvancedFilters(true);
              }}
              className={filterButtonClass}
              title="Lọc theo nhân viên này"
            >
              {order._createdByName}
            </button>
          </td>
        );
      case "salesChannel":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => applyCellFilter(key, order.salesChannel)}
              className={filterButtonClass}
              title="Lọc theo kênh bán này"
            >
              <span className="block max-w-[120px] truncate">
                {salesChannelLabel(order.salesChannel)}
              </span>
            </button>
          </td>
        );
      case "shippingMode":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() => applyCellFilter(key, meta.shippingMode)}
              className={filterButtonClass}
              title="Lọc theo cách giao này"
            >
              {shippingModeLabel(meta.shippingMode)}
            </button>
          </td>
        );
      case "shippingPartner":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap"
          >
            <button
              type="button"
              onClick={() =>
                applyCellFilter(
                  key,
                  order.shipment?.carrier || meta.shippingPartner,
                )
              }
              className={filterButtonClass}
              title="Lọc theo đơn vị vận chuyển này"
            >
              <span className="inline-flex items-center gap-1">
                <span>{carrierLabel(order.shipment?.carrier || meta.shippingPartner)}</span>
                {isLocalDeliveryCarrier(order.shipment?.carrier || meta.shippingPartner) ? (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                    Nội thành
                  </span>
                ) : null}
              </span>
            </button>
          </td>
        );
      case "trackingCode":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap text-xs"
          >
            {order.shipment?.trackingCode ? (
              order.shipment?.id ? (
                <span className="inline-flex items-center gap-1">
                  <Link
                    href={`/control/shipments/${order.shipment.id}`}
                    className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                    title="Mở phiếu giao hàng"
                  >
                    {order.shipment.trackingCode}
                  </Link>
                  {shipmentExternalTrackingUrl(order) ? (
                    <a
                      href={shipmentExternalTrackingUrl(order)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      title={`Mở ${carrierLabel(order.shipment?.carrier)} realtime`}
                    >
                      Mở
                    </a>
                  ) : null}
                </span>
              ) : (
                <span
                  className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700"
                  title="Mã vận đơn"
                >
                  {order.shipment.trackingCode}
                </span>
              )
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </td>
        );
      case "printStatus":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center"
          >
            <PrintStatusBadge orderId={order.id} />
          </td>
        );
      case "itemCount":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center whitespace-nowrap"
          >
            {getOrderItemCount(order) || "—"}
          </td>
        );
      case "shippingAddress":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 min-w-[240px]"
          >
            <span title={meta.address || ""}>
              {shortText(meta.address, 40)}
            </span>
          </td>
        );
      case "note":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 min-w-[200px]"
          >
            {(() => {
              const noteText = getOrderUserNoteForTable(order, meta);
              return <span title={noteText}>{shortText(noteText, 34)}</span>;
            })()}
          </td>
        );
      case "shippingFee":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
            title="Phí ship tính vào đơn khách thanh toán"
          >
            {currency(order._shippingFee)}
          </td>
        );
      case "carrierShippingFee":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
            title="Phí thực tế hãng vận chuyển trả về trên vận đơn"
          >
            {order._carrierShippingFee
              ? currency(order._carrierShippingFee)
              : "—"}
          </td>
        );
      case "assignedStaff":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap text-xs text-neutral-700"
          >
            {order._assignedStaffName || "—"}
          </td>
        );
      case "codAmount":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
          >
            {currency(order._codAmount)}
          </td>
        );
      case "amountDue":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
          >
            {currency(order._amountDue)}
          </td>
        );
      case "finalAmount":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
          >
            {currency(Number(order.finalAmount || 0))}
          </td>
        );
      default:
        return null;
    }
  };

  const openAssignDialog = () => {
    if (!checkedIds.length) {
      setActionMessage("Chọn ít nhất 1 đơn trước khi gán nhân viên.");
      return;
    }
    setAssignStaffId("");
    setAssignOpen(true);
  };

  const handleAssignOrders = async () => {
    if (!assignStaffId) {
      setActionMessage("Chưa chọn nhân viên để gán đơn.");
      return;
    }

    try {
      setAssigningOrders(true);
      await Promise.all(
        checkedIds.map(async (orderId) => {
          const res = await apiFetch(
            `/orders/${encodeURIComponent(orderId)}/assign-staff`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ assignedStaffId: assignStaffId }),
            },
          );
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.message || "Không gán được đơn.");
        }),
      );

      setAssignOpen(false);
      setActionMessage(`Đã gán ${checkedIds.length} đơn.`);
      setCheckedIds([]);
      await loadOrders();
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không gán được đơn.",
      );
    } finally {
      setAssigningOrders(false);
    }
  };

  const mobileSummaryCards = [
    {
      key: "WAITING_APPROVE" as QuickStatusKey,
      title: "Chờ duyệt",
      value: counts.waitingApprove,
      icon: "✓",
    },
    {
      key: "WAITING_PAYMENT" as QuickStatusKey,
      title: "Chờ thanh toán",
      value: counts.waitingPayment,
      icon: "₫",
    },
    {
      key: "WAITING_PACKING" as QuickStatusKey,
      title: "Chờ đóng gói",
      value: counts.waitingPacking,
      icon: "□",
    },
    {
      key: "WAITING_SHIP" as QuickStatusKey,
      title: "Chờ gửi hãng",
      value: counts.waitingShip,
      icon: "→",
    },
    {
      key: "DELIVERING" as QuickStatusKey,
      title: "Đang giao",
      value: counts.delivering,
      icon: "↗",
    },
    {
      key: "FAIL" as QuickStatusKey,
      title: "Giao lỗi",
      value: counts.failed,
      icon: "!",
    },
  ];

  const mobileQuickDates: Array<{ key: QuickDateKey; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "today", label: "Hôm nay" },
    { key: "yesterday", label: "Hôm qua" },
    { key: "7d", label: "7 ngày" },
    { key: "30d", label: "30 ngày" },
    { key: "month", label: "Tháng này" },
  ];

  if (loading) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-neutral-500">Đang tải đơn hàng...</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </Panel>
    );
  }

  return (
    <>
      <div className="space-y-3 lg:hidden">
        <Panel className="p-3">
          <div className="grid grid-cols-2 gap-2">
            {mobileSummaryCards.map((item) => {
              const active = quickStatus === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setQuickStatus((prev) =>
                      prev === item.key ? "ALL" : item.key,
                    )
                  }
                  className={`rounded-[22px] border p-3 text-left transition ${
                    active
                      ? "border-neutral-900 bg-neutral-950 text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-sm ${
                        active
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        active ? "text-white/70" : "text-neutral-500"
                      }`}
                    >
                      Xem
                    </span>
                  </div>
                  <p
                    className={`mt-3 text-[12px] font-medium ${
                      active ? "text-white/75" : "text-neutral-600"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight">
                    {item.value}
                  </p>
                </button>
              );
            })}
          </div>

          {quickStatus !== "ALL" ? (
            <button
              type="button"
              onClick={() => setQuickStatus("ALL")}
              className="mt-3 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700"
            >
              Bỏ lọc nhanh
            </button>
          ) : null}
        </Panel>

        <Panel className="p-3">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-[15px] outline-none"
            placeholder="Tìm mã đơn, khách hàng, SĐT..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {mobileQuickDates.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => applyQuickDate(item.key)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold ${
                  quickDate === item.key
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="min-w-0 rounded-2xl border border-neutral-300 px-3 py-3 text-xs outline-none"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={
                !!currentUser?.branchId &&
                currentUser?.role !== "admin" &&
                currentUser?.role !== "owner"
              }
            >
              {branchOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="min-w-0 rounded-2xl border border-neutral-300 px-3 py-3 text-xs outline-none"
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value as "ALL" | OrderPaymentStatus)
              }
            >
              <option value="ALL">Tất cả thanh toán</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PARTIAL">Một phần</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="PENDING_COD">Chờ COD</option>
              <option value="REFUNDED">Hoàn tiền</option>
              <option value="FAILED">Lỗi thanh toán</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              Trang {page}/{totalPages} · {totalItems} đơn
            </span>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-full border border-neutral-300 px-3 py-1.5 font-semibold text-neutral-700"
            >
              Làm mới
            </button>
          </div>
        </Panel>

        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        <div className="space-y-2">
          {visibleOrders.length === 0 ? (
            <Panel className="p-5 text-center text-sm text-neutral-500">
              Không có đơn hàng phù hợp bộ lọc.
            </Panel>
          ) : (
            visibleOrders.map((order) => {
              const checked = checkedIds.includes(order.id);
              return (
                <Panel key={order.id} className="overflow-hidden p-0">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openOrderInNewTab(order)}
                          className="block truncate text-left text-[16px] font-semibold tracking-tight text-neutral-950"
                        >
                          {order.orderCode}
                        </button>
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {order.createdAt || "—"} ·{" "}
                          {branchLabel(order.branchId)}
                        </p>
                      </div>

                      <label className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheckOne(order.id)}
                          className="h-4 w-4"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-neutral-600">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">
                          {order.customerName || "Khách lẻ"}
                        </span>
                        <span className="shrink-0 font-semibold text-neutral-900">
                          {order.customerPhone || "—"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={orderStatusLabel(order.status)}
                          tone={orderStatusTone(order.status)}
                        />
                        <span className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-1">
                          <DotStatus
                            state={stockOutDotState(order.status)}
                            title={`Xuất kho: ${orderStatusLabel(order.status)}`}
                          />
                          <span className="text-[10px] font-semibold text-neutral-500">
                            XK
                          </span>
                        </span>
                        <StatusBadge
                          label={paymentStatusLabel(order.paymentStatus)}
                          tone={paymentStatusTone(order.paymentStatus)}
                        />
                        <span className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-1">
                          <DotStatus
                            state={paymentDotState(order.paymentStatus)}
                            title={`Thanh toán: ${paymentStatusLabel(order.paymentStatus)}`}
                          />
                          <span className="text-[10px] font-semibold text-neutral-500">
                            TT
                          </span>
                        </span>
                        <StatusBadge
                          label={shipmentDisplayStatusLabel(order)}
                          tone={shipmentDisplayStatusTone(order)}
                        />
                        {order.shipment?.trackingCode ? (
                          <span className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                            {carrierLabel(order.shipment?.carrier)} · {order.shipment.trackingCode}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-neutral-50 p-3 text-xs">
                      <div>
                        <p className="text-neutral-500">Số món</p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {getOrderItemCount(order)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">COD</p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {canSeeMoney ? currency(order._codAmount) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Tổng</p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {canSeeMoney
                            ? currency(Number(order.finalAmount || 0))
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openOrderInNewTab(order)}
                        className="flex-1 rounded-2xl bg-neutral-900 px-4 py-3 text-xs font-semibold text-white"
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        onClick={() => copyOrderToNewTab(order)}
                        className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-xs font-semibold text-neutral-800"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                </Panel>
              );
            })
          )}
        </div>

        <Panel className="p-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-xs font-semibold text-neutral-700 disabled:opacity-40"
            >
              ← Trước
            </button>
            <p className="text-xs text-neutral-500">
              Trang {page}/{totalPages}
            </p>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-xs font-semibold text-neutral-700 disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        </Panel>
      </div>

      <div className="hidden lg:block">
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
              <SummaryCard
                title="Chờ duyệt"
                value={counts.waitingApprove}
                active={quickStatus === "WAITING_APPROVE"}
                icon="✓"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "WAITING_APPROVE" ? "ALL" : "WAITING_APPROVE",
                  )
                }
              />
              <SummaryCard
                title="Chờ thanh toán"
                value={counts.waitingPayment}
                active={quickStatus === "WAITING_PAYMENT"}
                icon="₫"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "WAITING_PAYMENT" ? "ALL" : "WAITING_PAYMENT",
                  )
                }
              />
              <SummaryCard
                title="Chờ đóng gói"
                value={counts.waitingPacking}
                active={quickStatus === "WAITING_PACKING"}
                icon="□"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "WAITING_PACKING" ? "ALL" : "WAITING_PACKING",
                  )
                }
              />
              <SummaryCard
                title="Chờ gửi hãng"
                value={counts.waitingShip}
                active={quickStatus === "WAITING_SHIP"}
                icon="→"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "WAITING_SHIP" ? "ALL" : "WAITING_SHIP",
                  )
                }
              />
              <SummaryCard
                title="Đang giao hàng"
                value={counts.delivering}
                active={quickStatus === "DELIVERING"}
                icon="↗"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "DELIVERING" ? "ALL" : "DELIVERING",
                  )
                }
              />
              <SummaryCard
                title="Sắp giao"
                value={counts.soonDelivery}
                active={quickStatus === "SOON_DELIVERY"}
                icon="◔"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "SOON_DELIVERY" ? "ALL" : "SOON_DELIVERY",
                  )
                }
              />
              <SummaryCard
                title="Đơn giao không thành công"
                value={counts.failed}
                active={quickStatus === "FAIL"}
                icon="!"
                onClick={() =>
                  setQuickStatus((prev) => (prev === "FAIL" ? "ALL" : "FAIL"))
                }
              />
              <SummaryCard
                title="Đơn giao lại"
                value={counts.redelivery}
                active={quickStatus === "REDELIVERY"}
                icon="↺"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "REDELIVERY" ? "ALL" : "REDELIVERY",
                  )
                }
              />
              <SummaryCard
                title="Nội thành"
                value={counts.localDelivery}
                active={quickStatus === "LOCAL_DELIVERY"}
                icon="⚡"
                onClick={() =>
                  setQuickStatus((prev) =>
                    prev === "LOCAL_DELIVERY" ? "ALL" : "LOCAL_DELIVERY",
                  )
                }
              />
            </div>

            {quickStatus !== "ALL" ? (
              <div className="mt-4">
                <Button onClick={() => setQuickStatus("ALL")} size="sm">
                  Bỏ lọc nhanh
                </Button>
              </div>
            ) : null}
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-wrap gap-2">
              <SmallChip
                active={quickDate === "all"}
                onClick={() => applyQuickDate("all")}
              >
                Tất cả
              </SmallChip>
              <SmallChip
                active={quickDate === "today"}
                onClick={() => applyQuickDate("today")}
              >
                Hôm nay
              </SmallChip>
              <SmallChip
                active={quickDate === "yesterday"}
                onClick={() => applyQuickDate("yesterday")}
              >
                Hôm qua
              </SmallChip>
              <SmallChip
                active={quickDate === "7d"}
                onClick={() => applyQuickDate("7d")}
              >
                7 ngày
              </SmallChip>
              <SmallChip
                active={quickDate === "30d"}
                onClick={() => applyQuickDate("30d")}
              >
                30 ngày
              </SmallChip>
              <SmallChip
                active={quickDate === "month"}
                onClick={() => applyQuickDate("month")}
              >
                Tháng này
              </SmallChip>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1.7fr_1fr_1fr_1fr_auto_auto]">
              <input
                className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                placeholder="Tìm mã đơn, khách hàng, SĐT, địa chỉ..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <select
                className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                disabled={
                  !!currentUser?.branchId &&
                  currentUser?.role !== "admin" &&
                  currentUser?.role !== "owner"
                }
              >
                {branchOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                value={orderFilter}
                onChange={(e) =>
                  setOrderFilter(e.target.value as "ALL" | OrderStatus)
                }
              >
                <option value="ALL">Tất cả trạng thái đơn</option>
                <option value="NEW">Mới tạo</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="PACKING">Đang xử lý</option>
                <option value="SHIPPED">Đã xuất kho</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>

              <select
                className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(e.target.value as "ALL" | OrderPaymentStatus)
                }
              >
                <option value="ALL">Tất cả thanh toán</option>
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="PARTIAL">Thanh toán một phần</option>
                <option value="PAID">Đã thanh toán</option>
                <option value="PENDING_COD">Chờ thu COD</option>
                <option value="REFUNDED">Đã hoàn tiền</option>
                <option value="FAILED">Thanh toán lỗi</option>
              </select>

              <Button onClick={() => void loadOrders()} size="md">
                Làm mới
              </Button>

              {canExportOrderExcel ? (
                <Button
                  onClick={() => setExportOpen(true)}
                  size="md"
                  variant="primary"
                >
                  Xuất Excel
                </Button>
              ) : null}

              <div className="w-full md:col-span-full" ref={columnMenuRef}>
                <Button onClick={() => setShowColumnMenu((v) => !v)} size="md">
                  Cột hiển thị
                </Button>

                {showColumnMenu ? (
                  <div className="mt-3 rounded-[24px] border border-neutral-200 bg-neutral-50 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">
                          Cột hiển thị
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Tích để hiện/ẩn, dùng ↑ ↓ hoặc nắm ⋮⋮ để đổi thứ tự,
                          bấm Lưu cột để áp dụng.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowColumnMenu(false)}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                      >
                        Đóng
                      </button>
                    </div>

                    <div className="max-h-[260px] overflow-y-auto pr-1">
                      <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-9">
                        {COLUMN_DEFS.filter((col) =>
                          canSeeMoney ? true : !col.money,
                        ).map((col) => {
                          const index = draftVisibleColumns.indexOf(col.key);
                          const visible = isColumnVisible(col.key);
                          return (
                            <div
                              key={col.key}
                              draggable={visible}
                              onDragStart={() => handleColumnDragStart(col.key)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleColumnDrop(col.key)}
                              className={`grid grid-cols-[18px_18px_minmax(0,1fr)_44px] items-center gap-1.5 rounded-2xl border px-2 py-2 text-[11px] transition ${
                                visible
                                  ? "border-neutral-200 bg-white hover:bg-neutral-50"
                                  : "border-neutral-100 bg-white/70 text-neutral-400"
                              }`}
                            >
                              <button
                                type="button"
                                className="cursor-grab rounded-lg px-0.5 text-xs leading-none text-neutral-400 active:cursor-grabbing"
                                title="Nắm để kéo thả cột"
                              >
                                ⋮⋮
                              </button>
                              <input
                                type="checkbox"
                                checked={visible}
                                onChange={() => toggleColumn(col.key)}
                              />
                              <span className="min-w-0 truncate font-semibold text-neutral-800">
                                {index >= 0 ? `${index + 1}. ` : ""}
                                {col.label}
                              </span>
                              <span className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={!visible || index <= 0}
                                  onClick={() => moveColumn(col.key, "up")}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 bg-white text-[10px] font-bold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-30"
                                  title="Đẩy cột lên trước"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    !visible ||
                                    index < 0 ||
                                    index >= draftVisibleColumns.length - 1
                                  }
                                  onClick={() => moveColumn(col.key, "down")}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 bg-white text-[10px] font-bold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-30"
                                  title="Đẩy cột xuống sau"
                                >
                                  ↓
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-200 pt-3">
                      <button
                        onClick={resetColumns}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                      >
                        Mặc định
                      </button>
                      <button
                        onClick={saveColumns}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        Lưu cột
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdvancedFilters((v) => !v)}
              >
                {showAdvancedFilters ? "Ẩn bộ lọc nâng cao" : "Bộ lọc nâng cao"}
                {activeAdvancedFilterCount
                  ? ` (${activeAdvancedFilterCount})`
                  : ""}
              </Button>

              {activeAdvancedFilterCount ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={clearAdvancedFilters}
                >
                  Xóa lọc nâng cao
                </Button>
              ) : null}

              <p className="text-xs text-neutral-500">
                Đang hiển thị {visibleOrders.length} / {totalItems} đơn theo bộ
                lọc hiện tại
              </p>
            </div>

            {showAdvancedFilters ? (
              <div className="mt-3 rounded-3xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <input
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    placeholder="Lọc mọi thông tin trong bảng..."
                    value={freeTextFilter}
                    onChange={(e) => setFreeTextFilter(e.target.value)}
                  />

                  <select
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    value={createdByFilter}
                    onChange={(e) => setCreatedByFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả nhân viên tạo đơn</option>
                    {createdByOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    value={fulfillmentFilter}
                    onChange={(e) => setFulfillmentFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả giao vận</option>
                    <option value="UNFULFILLED">Chưa giao</option>
                    <option value="PROCESSING">Đang chuẩn bị</option>
                    <option value="PARTIAL">Một phần</option>
                    <option value="FULFILLED">Đã giao vận</option>
                    <option value="RETURNED">Trả hàng</option>
                  </select>

                  <select
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    value={salesChannelFilter}
                    onChange={(e) => setSalesChannelFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả kênh bán</option>
                    {salesChannelOptions.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>

                  <select
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    value={shippingModeFilter}
                    onChange={(e) => setShippingModeFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả cách giao</option>
                    {shippingModeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>

                  <select
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    value={shippingPartnerFilter}
                    onChange={(e) => setShippingPartnerFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả đơn vị vận chuyển</option>
                    {shippingPartnerOptions.map((partner) => (
                      <option key={partner} value={partner}>
                        {partner}
                      </option>
                    ))}
                  </select>

                  <select
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none"
                    value={trackingFilter}
                    onChange={(e) => setTrackingFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả mã vận đơn</option>
                    <option value="HAS">Có mã vận đơn</option>
                    <option value="NONE">Chưa có mã vận đơn</option>
                  </select>
                </div>
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setQuickDate("all");
                    setDateFrom(e.target.value);
                  }}
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setQuickDate("all");
                    setDateTo(e.target.value);
                  }}
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuickDate("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Xóa lọc ngày
                </Button>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {canApproveOrder ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleBulkApprove()}
                  disabled={!checkedIds.length || savingOrderStatus}
                >
                  Duyệt đơn
                </Button>
              ) : null}

              {canPackShipOrder ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void handleBulkSendToCarrier()}
                  disabled={!checkedIds.length || savingOrderStatus}
                >
                  Gửi hãng vận chuyển
                </Button>
              ) : null}

              {canPayOrder ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void handleBulkMarkPaid()}
                  disabled={!checkedIds.length || savingPaymentStatus}
                >
                  Đánh dấu đã thanh toán
                </Button>
              ) : null}

              {singleCheckedOrder ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => copyOrderToNewTab(singleCheckedOrder)}
                >
                  Sao chép đơn
                </Button>
              ) : null}

              {canCancelOrder ? (
                <Button
                  variant="warning"
                  size="md"
                  onClick={() => void handleBulkInternalCancel()}
                  disabled={!checkedIds.length || savingOrderStatus}
                >
                  Huỷ nội bộ
                </Button>
              ) : null}

              {canRedeliverySelected && singleCheckedOrder ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    openOrderInNewTab(singleCheckedOrder, "redelivery")
                  }
                >
                  Giao lại
                </Button>
              ) : null}

              {canCancelOrder ? (
                <Button
                  variant="warning"
                  size="md"
                  onClick={() => void handleBulkCancel()}
                  disabled={!checkedIds.length || savingOrderStatus}
                >
                  Hủy GHN
                </Button>
              ) : null}

              {canDeleteOrder ? (
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => void handleBulkDelete()}
                  disabled={!checkedIds.length || deletingOrders}
                >
                  {deletingOrders ? "Đang xóa..." : "Xóa đơn"}
                </Button>
              ) : null}

              <Button
                variant="secondary"
                size="md"
                onClick={openAssignDialog}
                disabled={!checkedIds.length || assigningOrders}
              >
                Gán nhân viên
              </Button>

              <span
                className={`ml-2 rounded-full px-3 py-1 text-sm font-semibold ${
                  checkedIds.length
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {checkedIds.length
                  ? `Đã chọn ${checkedIds.length} kết quả`
                  : "Chưa chọn kết quả"}
              </span>

              <div className="relative" ref={printMenuRef}>
                <Button
                  onClick={() => setShowPrintMenu((v) => !v)}
                  disabled={!checkedIds.length}
                >
                  In đơn hàng
                </Button>

                {showPrintMenu ? (
                  <div className="absolute right-0 z-[200] mt-2 w-64 rounded-3xl border border-neutral-200 bg-white p-2 shadow-2xl">
                    <button
                      className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setShowPrintMenu(false);
                        void void handlePrint("shipping", "80mm");
                      }}
                    >
                      Phiếu giao hàng 80mm
                    </button>

                    <button
                      className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setShowPrintMenu(false);
                        void void handlePrint("shipping", "A4");
                      }}
                    >
                      Phiếu giao hàng A4
                    </button>

                    <button
                      className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setShowPrintMenu(false);
                        void void handlePrint("shipping", "A5");
                      }}
                    >
                      Phiếu giao hàng A5
                    </button>

                    <button
                      className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setShowPrintMenu(false);
                        void void handlePrint("sales", "80mm");
                      }}
                    >
                      Phiếu bán hàng 80mm
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {actionMessage ? (
            <Panel className="p-3">
              <p className="text-xs text-neutral-700">{actionMessage}</p>
            </Panel>
          ) : null}

          <Panel className="overflow-hidden">
            <div
              ref={tableScrollRef}
              onScroll={updateTableScrollState}
              onMouseDown={handleTableMouseDown}
              onDoubleClick={() => scrollTableTo(0)}
              className={`orders-table-scroll-hidden w-full overflow-auto scroll-smooth ${
                isDraggingTable ? "cursor-grabbing select-none" : "cursor-grab"
              }`}
              style={{ maxHeight: "calc(100vh - 430px)", minHeight: 360 }}
            >
              <table
                className="w-full border-collapse table-fixed"
                style={{ minWidth: TABLE_MIN_WIDTH }}
              >
                <thead className="sticky top-0 z-40 bg-neutral-50 shadow-[0_2px_0_rgba(0,0,0,0.08)]">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                    <th className="sticky left-0 z-20 w-[44px] border-b border-neutral-200 bg-neutral-50 px-3 py-3 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleCheckAllVisible}
                      />
                    </th>

                    {orderedVisibleColumns.map(renderColumnHeader)}

                    <th className="sticky right-0 z-30 w-[96px] border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                      Mở
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={orderedVisibleColumns.length + 2}
                        className="px-4 py-6 text-sm text-neutral-500"
                      >
                        Không có đơn phù hợp.
                      </td>
                    </tr>
                  ) : (
                    visibleOrders.map((order) => {
                      const checked = checkedIds.includes(order.id);
                      const canShowRedelivery =
                        isFailedOrder(order) || isRedeliveryOrder(order);

                      return (
                        <tr
                          key={order.id}
                          className="group bg-white text-sm transition hover:bg-neutral-50"
                        >
                          <td className="sticky left-0 z-30 border-b border-neutral-100 bg-white px-3 py-3 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)] group-hover:bg-neutral-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCheckOne(order.id)}
                            />
                          </td>

                          {orderedVisibleColumns.map((key) =>
                            renderColumnCell(order, key),
                          )}

                          <td className="sticky right-0 z-20 border-b border-neutral-100 bg-white px-3 py-3 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)] group-hover:bg-neutral-50">
                            <div className="flex justify-end">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => void openQuickViewOrder(order)}
                                  className="inline-flex items-center rounded-xl border border-neutral-900 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-neutral-800"
                                >
                                  Xem nhanh
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openOrderInNewTab(order)}
                                  className="inline-flex items-center rounded-xl border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                >
                                  Chi tiết
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-neutral-200 bg-white px-4 py-4">
              <input
                type="range"
                min={0}
                max={Math.max(tableMaxScrollLeft, 1)}
                step={1}
                value={Math.min(
                  tableScrollLeft,
                  Math.max(tableMaxScrollLeft, 0),
                )}
                onChange={(e) => scrollTableTo(Number(e.target.value))}
                className="orders-table-range orders-table-range-bottom w-full"
                aria-label="Kéo ngang bảng đơn hàng"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                <span>Đầu bảng</span>
                <span>Kéo thanh này để xem các cột bên phải</span>
                <span>Cuối bảng</span>
              </div>
            </div>
          </Panel>

          {assignOpen ? (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-md rounded-[28px] border border-neutral-200 bg-white p-5 shadow-2xl">
                <div className="mb-4">
                  <p className="text-lg font-semibold text-neutral-900">
                    Gán đơn cho nhân viên
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Đang chọn {checkedIds.length} đơn. Người tạo đơn vẫn giữ
                    nguyên, nhân viên phụ trách sẽ được cập nhật ở cột NV phụ
                    trách.
                  </p>
                </div>
                <select
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
                  value={assignStaffId}
                  onChange={(e) => setAssignStaffId(e.target.value)}
                >
                  <option value="">Chọn nhân viên nhận đơn</option>
                  {assignableStaffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staffLabel(staff)}
                      {staff.branchName ? ` · ${staff.branchName}` : ""}
                    </option>
                  ))}
                </select>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => setAssignOpen(false)}
                    disabled={assigningOrders}
                  >
                    Huỷ
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleAssignOrders}
                    disabled={assigningOrders || !assignStaffId}
                  >
                    {assigningOrders ? "Đang gán..." : "Gán đơn"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <style jsx global>{`
            .orders-table-scroll-hidden {
              scrollbar-width: thin;
              scrollbar-color: #c7c7c7 transparent;
            }

            .orders-table-scroll-hidden::-webkit-scrollbar:horizontal {
              height: 0;
            }

            .orders-table-scroll-hidden::-webkit-scrollbar:vertical {
              width: 10px;
            }

            .orders-table-scroll-hidden::-webkit-scrollbar-track {
              background: transparent;
            }

            .orders-table-scroll-hidden::-webkit-scrollbar-thumb {
              background: #c7c7c7;
              border-radius: 999px;
              border: 2px solid white;
            }

            .orders-table-scroll-hidden::-webkit-scrollbar-thumb:hover {
              background: #8f8f8f;
            }

            .orders-table-range {
              height: 28px;
              accent-color: #171717;
              cursor: pointer;
            }

            .orders-table-range::-webkit-slider-runnable-track {
              height: 16px;
              border-radius: 999px;
              background: #e5e7eb;
              border: 1px solid #d4d4d4;
            }

            .orders-table-range::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 34px;
              height: 34px;
              margin-top: -10px;
              border-radius: 999px;
              background: #171717;
              border: 4px solid white;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
            }

            .orders-table-range::-moz-range-track {
              height: 12px;
              border-radius: 999px;
              background: #e5e7eb;
              border: 1px solid #d4d4d4;
            }

            .orders-table-range::-moz-range-thumb {
              width: 18px;
              height: 18px;
              border-radius: 999px;
              background: #171717;
              border: 4px solid white;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
            }
          `}</style>

          <Panel className="sticky bottom-3 z-40 border-neutral-200 bg-white/95 p-3 backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="flex flex-wrap items-center gap-3 text-xs text-neutral-600"
                data-print-version={printVersion}
              >
                <span className="font-semibold text-neutral-900">Hiển thị</span>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value || 50));
                    setPage(1);
                  }}
                  disabled={loading}
                  className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-xs font-semibold outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <span>kết quả / trang</span>

                <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                  Từ {totalItems ? (page - 1) * pageSize + 1 : 0} đến{" "}
                  {Math.min(page * pageSize, totalItems)} trên tổng {totalItems}
                </span>

                <span
                  className={`rounded-full px-3 py-1 font-medium ${
                    checkedIds.length
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {checkedIds.length
                    ? `Đã chọn ${checkedIds.length} kết quả`
                    : "Chưa chọn kết quả"}
                </span>

                <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                  Trang {page} / {Math.max(totalPages, 1)}
                </span>

                <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-700">
                  Đang lọc: {visibleOrders.length} dòng
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(1)}
                  size="sm"
                >
                  « Đầu
                </Button>

                <Button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  size="sm"
                >
                  ‹ Trước
                </Button>

                {Array.from({
                  length: Math.min(5, Math.max(totalPages, 1)),
                }).map((_, index) => {
                  const maxPages = Math.max(totalPages, 1);
                  const start = Math.min(
                    Math.max(page - 2, 1),
                    Math.max(maxPages - 4, 1),
                  );
                  const pageNumber = start + index;

                  if (pageNumber > maxPages) return null;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      disabled={loading}
                      className={`h-9 min-w-9 rounded-xl border px-3 text-xs font-semibold transition ${
                        pageNumber === page
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <Button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  size="sm"
                >
                  Sau ›
                </Button>

                <Button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(totalPages)}
                  size="sm"
                >
                  Cuối »
                </Button>
              </div>
            </div>
          </Panel>

          {canSeeMoney ? (
            <Panel className="p-4">
              <p className="text-xs text-neutral-500">
                Doanh thu đã thanh toán theo bộ lọc hiện tại
              </p>
              <p className="mt-1 text-lg font-semibold">
                {currency(paidRevenue)}
              </p>
            </Panel>
          ) : null}

          {exportOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
              <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-3xl font-semibold tracking-tight">
                    Xuất Excel đơn hàng
                  </h3>
                  <button
                    onClick={() => setExportOpen(false)}
                    className="text-xl text-neutral-500"
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-5">
                  <Panel className="bg-neutral-50 p-4">
                    <div className="grid gap-3 md:grid-cols-5">
                      <Button
                        variant="secondary"
                        onClick={() => applyOrderExportPreset("management")}
                      >
                        Quản lý
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => applyOrderExportPreset("accounting")}
                      >
                        Kế toán
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => applyOrderExportPreset("shipping")}
                      >
                        Giao vận
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => applyOrderExportPreset("cod")}
                      >
                        COD / công nợ
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => applyOrderExportPreset("full")}
                      >
                        Full dữ liệu
                      </Button>
                    </div>
                  </Panel>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Panel className="p-4">
                      <p className="text-sm font-semibold text-neutral-900">
                        Phạm vi đơn hàng
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        {(
                          [
                            ["filtered", "Theo bộ lọc hiện tại"],
                            ["current_page", "Chỉ trang đang xem"],
                            [
                              "checked",
                              `Chỉ đơn đã tick (${checkedIds.length})`,
                            ],
                          ] as Array<[OrderExportScope, string]>
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2"
                          >
                            <input
                              type="radio"
                              checked={exportScope === value}
                              onChange={() => setExportScope(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exportOnlyUnpaid}
                            onChange={(e) =>
                              setExportOnlyUnpaid(e.target.checked)
                            }
                          />
                          Chỉ đơn chưa thanh toán / COD
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exportOnlyCod}
                            onChange={(e) => setExportOnlyCod(e.target.checked)}
                          />
                          Chỉ đơn có COD
                        </label>
                      </div>
                    </Panel>

                    <Panel className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">
                          Chi nhánh
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExportBranchIds(
                                branches.map((branch) => branch.id),
                              )
                            }
                            className="text-xs font-semibold text-neutral-700 underline"
                          >
                            Chọn tất cả
                          </button>
                          <button
                            type="button"
                            onClick={() => setExportBranchIds([])}
                            className="text-xs font-semibold text-neutral-500 underline"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1 text-sm">
                        {branches.length ? (
                          branches.map((branch) => (
                            <label
                              key={branch.id}
                              className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                checked={exportBranchIds.includes(branch.id)}
                                onChange={(e) => {
                                  setExportBranchIds((prev) =>
                                    e.target.checked
                                      ? Array.from(
                                          new Set([...prev, branch.id]),
                                        )
                                      : prev.filter((id) => id !== branch.id),
                                  );
                                }}
                              />
                              {branch.name}
                            </label>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                            Chưa tải được chi nhánh. Kiểm tra token hoặc API
                            /branches.
                          </div>
                        )}
                      </div>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-sm font-semibold text-neutral-900">
                        Sheet & sắp xếp
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exportIncludeSummarySheet}
                            onChange={(e) =>
                              setExportIncludeSummarySheet(e.target.checked)
                            }
                          />
                          Sheet tổng quan
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exportIncludeBranchSheets}
                            onChange={(e) =>
                              setExportIncludeBranchSheets(e.target.checked)
                            }
                          />
                          Sheet theo chi nhánh
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exportIncludeItemSheet}
                            onChange={(e) =>
                              setExportIncludeItemSheet(e.target.checked)
                            }
                          />
                          Sheet sản phẩm trong đơn
                        </label>
                        <select
                          className="mt-2 w-full rounded-2xl border border-neutral-300 px-3 py-2 outline-none"
                          value={exportSortMode}
                          onChange={(e) =>
                            setExportSortMode(
                              e.target.value as OrderExportSortMode,
                            )
                          }
                        >
                          <option value="created_desc">Mới nhất trước</option>
                          <option value="amount_desc">
                            Tổng tiền cao trước
                          </option>
                          <option value="cod_desc">COD cao trước</option>
                        </select>
                      </div>
                    </Panel>
                  </div>

                  <Panel className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-neutral-900">
                        Cột dữ liệu
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExportColumns({ ...defaultOrderExportColumns })
                          }
                          className="text-xs font-semibold text-neutral-700 underline"
                        >
                          Chọn mặc định
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExportColumns(
                              Object.fromEntries(
                                (
                                  Object.keys(
                                    defaultOrderExportColumns,
                                  ) as OrderExportColumnKey[]
                                ).map((key) => [key, true]),
                              ) as OrderExportColumnState,
                            )
                          }
                          className="text-xs font-semibold text-neutral-700 underline"
                        >
                          Chọn tất cả
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                      {(
                        Object.keys(
                          defaultOrderExportColumns,
                        ) as OrderExportColumnKey[]
                      )
                        .filter(
                          (key) =>
                            canSeeMoney ||
                            !COLUMN_DEFS.find((col) => col.key === key)?.money,
                        )
                        .map((key) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={exportColumns[key]}
                              onChange={(e) =>
                                setExportColumns((prev) => ({
                                  ...prev,
                                  [key]: e.target.checked,
                                }))
                              }
                            />
                            {orderExportColumnLabels[key]}
                          </label>
                        ))}
                    </div>
                  </Panel>

                  <div className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-neutral-600">
                      Xuất{" "}
                      {exportScope === "checked"
                        ? checkedIds.length
                        : exportScope === "current_page"
                          ? normalizedOrders.length
                          : visibleOrders.length}{" "}
                      đơn ·{" "}
                      {exportBranchIds.length
                        ? `${exportBranchIds.length} chi nhánh`
                        : "Tất cả chi nhánh"}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setExportOpen(false)}
                      >
                        Huỷ
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleExportOrdersExcel}
                        disabled={
                          exportingOrders ||
                          (exportScope === "checked" && !checkedIds.length)
                        }
                      >
                        {exportingOrders ? "Đang xuất..." : "Xuất Excel"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {quickViewOrder ? (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4">
              <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                      Xem nhanh đơn hàng
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold text-neutral-950">
                      {quickViewOrder.orderCode}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {quickViewOrder.customerName || "Khách lẻ"} ·{" "}
                      {quickViewOrder.customerPhone || "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => openOrderInNewTab(quickViewOrder)}
                    >
                      Mở chi tiết
                    </Button>
                    <button
                      type="button"
                      onClick={() => setQuickViewOrder(null)}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                    >
                      Đóng
                    </button>
                  </div>
                </div>

                <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Panel className="p-4">
                      <p className="text-xs text-neutral-500">Trạng thái đơn</p>
                      <div className="mt-2">
                        <StatusBadge
                          label={orderStatusLabel(quickViewOrder.status)}
                          tone={orderStatusTone(quickViewOrder.status)}
                        />
                      </div>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-xs text-neutral-500">Thanh toán</p>
                      <div className="mt-2">
                        <StatusBadge
                          label={paymentStatusLabel(
                            quickViewOrder.paymentStatus,
                          )}
                          tone={paymentStatusTone(quickViewOrder.paymentStatus)}
                        />
                      </div>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-xs text-neutral-500">Giao vận</p>
                      <div className="mt-2">
                        <StatusBadge
                          label={shipmentDisplayStatusLabel(quickViewOrder)}
                          tone={shipmentDisplayStatusTone(quickViewOrder)}
                        />
                      </div>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-xs text-neutral-500">Tổng tiền</p>
                      <p className="mt-2 text-lg font-semibold">
                        {currency(Number(quickViewOrder.finalAmount || 0))}
                      </p>
                    </Panel>
                  </div>

                  <Panel className="mt-4 overflow-hidden">
                    <div className="border-b border-neutral-100 p-4">
                      <h4 className="font-semibold text-neutral-950">
                        Sản phẩm trong đơn
                      </h4>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs text-neutral-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Sản phẩm</th>
                            <th className="px-4 py-3 font-medium">SKU</th>
                            <th className="px-4 py-3 font-medium">
                              Màu / Size
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              SL
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              Đơn giá
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              Thành tiền
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(quickViewOrder.items || []).length ? (
                            (quickViewOrder.items || []).map(
                              (item: any, index: number) => (
                                <tr
                                  key={item.id || `${item.sku}-${index}`}
                                  className="border-t border-neutral-100"
                                >
                                  <td className="px-4 py-3 font-medium text-neutral-900">
                                    {item.productName ||
                                      item.name ||
                                      item.product?.name ||
                                      "Sản phẩm"}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-600">
                                    {item.sku || item.variant?.sku || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-600">
                                    {[
                                      item.color || item.variant?.color,
                                      item.size || item.variant?.size,
                                    ]
                                      .filter(Boolean)
                                      .join(" / ") || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {Number(item.qty || item.quantity || 0)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {currency(
                                      Number(item.unitPrice || item.price || 0),
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold">
                                    {currency(
                                      Number(
                                        item.lineTotal ||
                                          item.total ||
                                          Number(
                                            item.qty || item.quantity || 0,
                                          ) *
                                            Number(
                                              item.unitPrice || item.price || 0,
                                            ),
                                      ),
                                    )}
                                  </td>
                                </tr>
                              ),
                            )
                          ) : (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-8 text-center text-neutral-500"
                              >
                                Chưa có dữ liệu sản phẩm.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Panel>

                  <Panel className="mt-4 p-4">
                    <h4 className="font-semibold text-neutral-950">
                      Thông tin giao hàng
                    </h4>
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <p className="text-neutral-500">Người nhận</p>
                        <p className="font-medium">
                          {quickViewOrder.shippingRecipientName ||
                            quickViewOrder.customerName ||
                            "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">SĐT nhận</p>
                        <p className="font-medium">
                          {quickViewOrder.shippingPhone ||
                            quickViewOrder.customerPhone ||
                            "—"}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-neutral-500">Địa chỉ</p>
                        <p className="font-medium">
                          {[
                            quickViewOrder.shippingAddressLine1,
                            quickViewOrder.shippingAddressLine2,
                            quickViewOrder.shippingWard,
                            quickViewOrder.shippingDistrict,
                            quickViewOrder.shippingProvince,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Mã vận đơn</p>
                        <p className="font-medium">
                          {quickViewOrder.shipment?.trackingCode || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Đơn vị vận chuyển</p>
                        <p className="font-medium">
                          {quickViewOrder.shipment?.carrier || "—"}
                        </p>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            </div>
          ) : null}

          {quickViewLoading ? (
            <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/20 p-4">
              <div className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold shadow-2xl">
                Đang tải nhanh đơn hàng...
              </div>
            </div>
          ) : null}

          <ConfirmDialog
            open={confirmOpen}
            title={confirmTitle}
            description={confirmDescription}
            confirmText={confirmText}
            cancelText="Đóng"
            danger={confirmDanger}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={async () => {
              await confirmAction?.();
              setConfirmOpen(false);
            }}
          />
        </div>
      </div>
    </>
  );
}
