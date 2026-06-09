"use client";
import { apiFetch, apiJson } from "@/lib/api";
import { getWorkingBranchId } from "@/lib/current-user";
import * as XLSX from "xlsx";
import { getBranches, type BranchItem } from "@/lib/products-api";

const ORDERS_BRANCH_CACHE_KEY = "the1970.orders.branches.v1";
const ORDERS_BRANCH_CACHE_TTL_MS = 10 * 60 * 1000;

function readTimedCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.ts || 0) > ORDERS_BRANCH_CACHE_TTL_MS) return null;
    return parsed.value as T;
  } catch {
    return null;
  }
}

function writeTimedCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {
    // ignore storage quota/private mode
  }
}
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { addWorkspaceTab } from "@/lib/workspace-tabs";
import {
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


type MultiFilterValue = string[];

type MultiFilterOption = {
  value: string;
  label: string;
};

type ProductFilterOption = {
  value: string;
  label: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
  productCode?: string;
  source?: "orders" | "catalog";
  searchText: string;
};

const ALL_MULTI_FILTER: MultiFilterValue = ["ALL"];

function normalizeMultiFilterValue(values?: string[] | string | null): MultiFilterValue {
  const list = Array.isArray(values) ? values : [values || "ALL"];
  const cleaned = Array.from(
    new Set(list.map((value) => String(value || "").trim()).filter(Boolean)),
  );

  if (!cleaned.length || cleaned.includes("ALL")) return ["ALL"];
  return cleaned;
}

function isAllMultiFilter(values?: string[] | string | null) {
  return normalizeMultiFilterValue(values).includes("ALL");
}

function selectedMultiFilterValues(values?: string[] | string | null) {
  const normalized = normalizeMultiFilterValue(values);
  return normalized.includes("ALL") ? [] : normalized;
}

function multiFilterIncludes(values: string[] | string | null | undefined, value: string | null | undefined) {
  const selected = selectedMultiFilterValues(values);
  if (!selected.length) return true;
  return selected.includes(String(value || ""));
}

function setMultiFilterValue(values: string[] | string | null | undefined, value: string) {
  const current = normalizeMultiFilterValue(values);
  if (value === "ALL") return ["ALL"];

  const withoutAll = current.filter((item) => item !== "ALL");
  const next = withoutAll.includes(value)
    ? withoutAll.filter((item) => item !== value)
    : [...withoutAll, value];

  return next.length ? next : ["ALL"];
}

function multiFilterEquals(a: string[] | string | null | undefined, b: string[] | string | null | undefined) {
  const aa = normalizeMultiFilterValue(a).slice().sort();
  const bb = normalizeMultiFilterValue(b).slice().sort();
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function singleSelectedMultiFilterValue(values: string[] | string | null | undefined) {
  const selected = selectedMultiFilterValues(values);
  return selected.length === 1 ? selected[0] : "";
}

function multiFilterSelectedLabel(values: string[] | string | null | undefined, options: MultiFilterOption[], allLabel: string) {
  const selected = selectedMultiFilterValues(values);
  if (!selected.length) return allLabel;
  if (selected.length === 1) {
    return options.find((option) => option.value === selected[0])?.label || selected[0];
  }
  return `${selected.length} mục đã chọn`;
}

function MultiFilterSelect({
  value,
  onChange,
  options,
  allLabel,
  disabled = false,
  className = "",
}: {
  value: MultiFilterValue;
  onChange: (value: MultiFilterValue) => void;
  options: MultiFilterOption[];
  allLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const normalized = normalizeMultiFilterValue(value);
  const label = multiFilterSelectedLabel(normalized, options, allLabel);

  return (
    <details className={`group relative ${className}`}>
      <summary
        className={`flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none marker:hidden ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-neutral-400">⌄</span>
      </summary>

      <div className="absolute left-0 z-40 mt-2 max-h-[280px] min-w-full overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50">
          <input
            type="checkbox"
            checked={isAllMultiFilter(normalized)}
            onChange={() => onChange(["ALL"])}
          />
          <span>{allLabel}</span>
        </label>

        {options.map((option) => {
          const checked = selectedMultiFilterValues(normalized).includes(option.value);
          return (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(setMultiFilterValue(normalized, option.value))}
              />
              <span className="whitespace-nowrap">{option.label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}


function ProductSkuSearchBox({
  value,
  onChange,
  selectedValues,
  onToggleValue,
  onClearSelected,
  options,
  placeholder,
  onEnter,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  selectedValues: string[];
  onToggleValue: (value: string) => void;
  onClearSelected: () => void;
  options: ProductFilterOption[];
  placeholder: string;
  onEnter: (value: string) => void;
  className?: string;
}) {
  const selectedSet = new Set(selectedValues.map(normalizeTrackingLikeText));
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const shouldShowDropdown = open && Boolean(value.trim() || selectedValues.length);

  useEffect(() => {
    if (!open) return;

    const closeWhenClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !wrapperRef.current || wrapperRef.current.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", closeWhenClickOutside);
    document.addEventListener("touchstart", closeWhenClickOutside);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickOutside);
      document.removeEventListener("touchstart", closeWhenClickOutside);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-3 py-2 focus-within:border-neutral-900">
        {selectedValues.length ? (
          <div className="flex max-w-full flex-wrap gap-1.5">
            {selectedValues.slice(0, 4).map((selected) => {
              const option = options.find((item) => item.value === selected);
              return (
                <button
                  key={selected}
                  type="button"
                  onClick={() => onToggleValue(selected)}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                  title={option?.label || selected}
                >
                  <span className="truncate">{option?.sku || option?.label || selected}</span>
                  <span aria-hidden="true">×</span>
                </button>
              );
            })}
            {selectedValues.length > 4 ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                +{selectedValues.length - 4} SKU
              </span>
            ) : null}
          </div>
        ) : null}
        <input
          className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          placeholder={selectedValues.length ? "Gõ thêm SKU/SP..." : placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              return;
            }

            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
              onEnter(e.currentTarget.value.trim());
            }
          }}
        />
        {selectedValues.length ? (
          <button
            type="button"
            onClick={() => {
              onClearSelected();
              setOpen(false);
            }}
            className="shrink-0 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Bỏ SKU
          </button>
        ) : null}
      </div>

      {shouldShowDropdown ? (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[320px] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-[11px] font-semibold text-neutral-500">
              Chọn được nhiều SKU con cùng lúc
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              Đóng
            </button>
          </div>

          {options.length ? (
            options.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-xs hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => onToggleValue(option.value)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-neutral-900">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
                      SKU con: {option.sku || "—"}
                      {option.color || option.size ? ` · ${[option.color, option.size].filter(Boolean).join(" - ")}` : ""}
                    </span>
                  </span>
                </label>
              );
            })
          ) : (
            <div className="px-3 py-4 text-xs font-medium text-neutral-500">
              Chưa thấy SKU phù hợp. Gõ mã sản phẩm/SKU rồi đợi hệ thống tải danh sách biến thể.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

type QuickDateKey = "all" | "today" | "yesterday" | "7d" | "30d" | "month";

type OrderSearchMode = "ALL" | "ORDER" | "PHONE" | "PRODUCT";

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
  | "codReconciliation"
  | "partialReturnOrder"
  | "partialDeliveryOrder"
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
  | "goodsSubtotal"
  | "productDiscount"
  | "goodsAfterDiscount"
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
  /**
   * Nhân viên phụ trách hiển thị để chốt lương:
   * - Nếu đơn đã được gán: lấy nhân viên được gán.
   * - Nếu chưa gán: fallback về nhân viên tạo đơn.
   */
  _assignedStaffName: string;
  /** Tên nhân viên được gán thật sự, dùng riêng cho filter "chưa gán". */
  _assignedStaffRawName: string;
  _goodsSubtotal: number;
  _productDiscount: number;
  _goodsAfterDiscount: number;
  _codAmount: number;
  _amountDue: number;
  _createdAtDate: Date | null;
};

const TABLE_MIN_WIDTH = 3600;
const TABLE_SCROLL_STORAGE_KEY = "orders.tableScrollLeft";
const SALES_CHANNELS_STORAGE_KEY = "the1970_sales_channels";
const ORDER_PRINT_COUNT_STORAGE_KEY = "the1970_order_print_counts";
const ORDER_FILTER_PRESETS_STORAGE_KEY = "the1970.orders.filterPresets.v1";
const ORDER_CLIENT_SEARCH_PAGE_SIZE = 1000;
const ORDER_CLIENT_SEARCH_MAX_PAGES = 5;
const ORDER_SUMMARY_CARD_PAGE_SIZE = 1000;
const ORDER_SUMMARY_CARD_MAX_PAGES = 12;

type QuickStatusCounts = {
  waitingApprove: number;
  waitingPayment: number;
  waitingPacking: number;
  waitingShip: number;
  delivering: number;
  soonDelivery: number;
  failed: number;
  redelivery: number;
  localDelivery: number;
};

type OrderFilterPresetFilters = {
  query: string;
  searchMode: OrderSearchMode;
  selectedProductSkuValues: string[];
  quickDate: QuickDateKey;
  dateFrom: string;
  dateTo: string;
  quickStatus: QuickStatusKey;
  branchFilter: MultiFilterValue;
  orderFilter: MultiFilterValue;
  paymentFilter: MultiFilterValue;
  createdByFilter: MultiFilterValue;
  assignedStaffFilter: MultiFilterValue;
  fulfillmentFilter: MultiFilterValue;
  deliveryStatusFilter: MultiFilterValue;
  salesChannelFilter: MultiFilterValue;
  shippingModeFilter: MultiFilterValue;
  shippingPartnerFilter: MultiFilterValue;
  trackingFilter: MultiFilterValue;
  printStatusFilter: MultiFilterValue;
  codFilter: MultiFilterValue;
  codReconciliationFilter: MultiFilterValue;
  amountDueFilter: MultiFilterValue;
  itemCountFilter: MultiFilterValue;
  freeTextFilter: string;
  smartSearchInput: string;
};

type OrderFilterPreset = {
  id: string;
  name: string;
  createdAt: string;
  filters: OrderFilterPresetFilters;
};

const EMPTY_QUICK_STATUS_COUNTS: QuickStatusCounts = {
  waitingApprove: 0,
  waitingPayment: 0,
  waitingPacking: 0,
  waitingShip: 0,
  delivering: 0,
  soonDelivery: 0,
  failed: 0,
  redelivery: 0,
  localDelivery: 0,
};

const CARD_DATE_FILTER_OPTIONS: Array<{ key: QuickDateKey; label: string }> = [
  { key: "all", label: "Tất cả ngày" },
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "month", label: "Tháng này" },
];


const QUICK_STATUS_LABELS: Record<QuickStatusKey, string> = {
  ALL: "Tất cả",
  WAITING_APPROVE: "Chờ duyệt",
  WAITING_PAYMENT: "Chờ thanh toán",
  WAITING_PACKING: "Chờ đóng gói",
  WAITING_SHIP: "Chờ gửi hãng",
  DELIVERING: "Đang giao hàng",
  SOON_DELIVERY: "Sắp giao",
  FAIL: "Đơn giao không thành công",
  REDELIVERY: "Đơn giao lại",
  LOCAL_DELIVERY: "Nội thành",
};

function isValidQuickDateKey(value: string | null): value is QuickDateKey {
  return CARD_DATE_FILTER_OPTIONS.some((item) => item.key === value);
}

function isValidQuickStatusKey(value: string | null): value is QuickStatusKey {
  return Boolean(value && Object.prototype.hasOwnProperty.call(QUICK_STATUS_LABELS, value));
}

function readOrdersPageInitialQuery() {
  if (typeof window === "undefined") {
    return {
      quickStatus: "ALL" as QuickStatusKey,
      cardDate: "all" as QuickDateKey,
      branchFilter: ["ALL"] as MultiFilterValue,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const quickStatusRaw = params.get("quickStatus");
  const cardDateRaw = params.get("cardDate");
  const branchId = String(params.get("branchId") || "").trim();

  return {
    quickStatus: isValidQuickStatusKey(quickStatusRaw) ? quickStatusRaw : ("ALL" as QuickStatusKey),
    cardDate: isValidQuickDateKey(cardDateRaw) ? cardDateRaw : ("all" as QuickDateKey),
    branchFilter: branchId ? [branchId] : (["ALL"] as MultiFilterValue),
  };
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: "orderCode", label: "Mã đơn", defaultVisible: true },
  { key: "createdAt", label: "Ngày tạo", defaultVisible: true },
  { key: "customerName", label: "Khách hàng", defaultVisible: true },
  { key: "customerPhone", label: "SĐT", defaultVisible: true },
  { key: "orderStatus", label: "Trạng thái đơn", defaultVisible: true },
  { key: "paymentDotStatus", label: "TT thanh toán", defaultVisible: true },
  { key: "paymentStatus", label: "Thanh toán", defaultVisible: true },
  { key: "codReconciliation", label: "Đối soát", defaultVisible: true },
  { key: "partialReturnOrder", label: "Đơn trả hàng", defaultVisible: true },
  { key: "partialDeliveryOrder", label: "Đơn giao 1 phần", defaultVisible: true },
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
  { key: "goodsSubtotal", label: "Tiền hàng", money: true, defaultVisible: true },
  { key: "productDiscount", label: "Chiết khấu sản phẩm", money: true, defaultVisible: true },
  { key: "goodsAfterDiscount", label: "Tiền hàng sau chiết khấu", money: true, defaultVisible: true },
  { key: "codAmount", label: "Tiền COD", money: true, defaultVisible: true },
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


function positiveNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getItemQuantity(item: any) {
  return positiveNumber(
    item?.quantity ?? item?.qty ?? item?.quantityOrdered ?? item?.orderedQty ?? 1,
  ) || 1;
}

function getItemUnitPrice(item: any) {
  return positiveNumber(
    item?.unitPrice ??
      item?.price ??
      item?.salePrice ??
      item?.sellingPrice ??
      item?.variant?.price ??
      item?.product?.price,
  );
}

function getItemOriginalUnitPrice(item: any) {
  return positiveNumber(
    item?.originalUnitPrice ??
      item?.originalPrice ??
      item?.listPrice ??
      item?.basePrice ??
      item?.compareAtPrice ??
      item?.variant?.originalPrice ??
      item?.product?.originalPrice,
  );
}

function getItemLineTotalAfterDiscount(item: any) {
  const explicit = positiveNumber(
    item?.lineTotal ??
      item?.total ??
      item?.finalLineTotal ??
      item?.amount ??
      item?.subtotalAfterDiscount,
  );

  if (explicit > 0) return explicit;

  return getItemQuantity(item) * getItemUnitPrice(item);
}

function getItemLineSubtotalBeforeDiscount(item: any) {
  const explicit = positiveNumber(
    item?.lineSubtotal ??
      item?.subtotal ??
      item?.originalLineTotal ??
      item?.beforeDiscountTotal ??
      item?.totalBeforeDiscount,
  );

  if (explicit > 0) return explicit;

  const originalUnitPrice = getItemOriginalUnitPrice(item);
  if (originalUnitPrice > 0) return getItemQuantity(item) * originalUnitPrice;

  const discount = getItemDiscountAmount(item);
  return getItemLineTotalAfterDiscount(item) + discount;
}

function getItemDiscountAmount(item: any) {
  const direct = positiveNumber(
    item?.discountAmount ??
      item?.productDiscountAmount ??
      item?.lineDiscountAmount ??
      item?.lineDiscount ??
      item?.discountValue,
  );

  if (direct > 0) return direct;

  const qty = getItemQuantity(item);
  const originalUnitPrice = getItemOriginalUnitPrice(item);
  const unitPrice = getItemUnitPrice(item);
  if (originalUnitPrice > unitPrice && unitPrice > 0) {
    return (originalUnitPrice - unitPrice) * qty;
  }

  return 0;
}

function getOrderGoodsSubtotal(order: AdminOrder) {
  const anyOrder: any = order || {};
  const itemSubtotal = Array.isArray(anyOrder.items)
    ? anyOrder.items.reduce(
        (sum: number, item: any) => sum + getItemLineSubtotalBeforeDiscount(item),
        0,
      )
    : 0;

  if (itemSubtotal > 0) return itemSubtotal;

  return positiveNumber(
    anyOrder.goodsSubtotal ??
      anyOrder.itemsSubtotal ??
      anyOrder.productSubtotal ??
      anyOrder.subtotalAmount ??
      anyOrder.subtotal ??
      anyOrder.totalBeforeDiscount,
  );
}

function getOrderProductDiscount(order: AdminOrder) {
  const anyOrder: any = order || {};
  const itemDiscount = Array.isArray(anyOrder.items)
    ? anyOrder.items.reduce(
        (sum: number, item: any) => sum + getItemDiscountAmount(item),
        0,
      )
    : 0;

  if (itemDiscount > 0) return itemDiscount;

  const direct = positiveNumber(
    anyOrder.productDiscountAmount ??
      anyOrder.itemsDiscountAmount ??
      anyOrder.discountAmount ??
      anyOrder.totalDiscount ??
      anyOrder.discountTotal,
  );

  if (direct > 0) return direct;

  const subtotal = getOrderGoodsSubtotal(order);
  const afterDiscount = getOrderGoodsAfterDiscount(order, true);
  return Math.max(0, subtotal - afterDiscount);
}

function getOrderGoodsAfterDiscount(order: AdminOrder, skipDiscountFallback = false) {
  const anyOrder: any = order || {};
  const itemTotal = Array.isArray(anyOrder.items)
    ? anyOrder.items.reduce(
        (sum: number, item: any) => sum + getItemLineTotalAfterDiscount(item),
        0,
      )
    : 0;

  if (itemTotal > 0) return itemTotal;

  const direct = positiveNumber(
    anyOrder.goodsAfterDiscount ??
      anyOrder.itemsTotalAfterDiscount ??
      anyOrder.productTotalAfterDiscount ??
      anyOrder.subtotalAfterDiscount,
  );

  if (direct > 0) return direct;

  const subtotal = getOrderGoodsSubtotal(order);
  if (subtotal > 0) {
    const discount = skipDiscountFallback ? 0 : getOrderProductDiscount(order);
    return Math.max(0, subtotal - discount);
  }

  const finalAmount = positiveNumber(anyOrder.finalAmount);
  const shippingFee = positiveNumber(anyOrder.shippingFee);
  return Math.max(0, finalAmount - shippingFee);
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

function normalizedCodReconciliationStatusFromOrder(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};

  const directStatusCandidates = [
    shipment.codReconciliationStatus,
    shipment.cod_reconciliation_status,
    shipment.codStatus,
    shipment.reconciliationStatus,
    anyOrder.codReconciliationStatus,
    anyOrder.cod_reconciliation_status,
    anyOrder.codStatus,
    anyOrder.reconciliationStatus,
    anyOrder.shipmentCodReconciliationStatus,
    anyOrder.shipment_cod_reconciliation_status,
  ];

  for (const raw of directStatusCandidates) {
    const status = String(raw || "").trim().toUpperCase();
    if (status) return status;
  }

  const issue = [
    shipment.codReconciliationIssue,
    shipment.cod_reconciliation_issue,
    anyOrder.codReconciliationIssue,
    anyOrder.cod_reconciliation_issue,
    anyOrder.shipmentCodReconciliationIssue,
  ]
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");

  if (issue.includes("COD_RECONCILIATION_PAID")) return "PAID";
  if (issue.includes("USER_CONFIRMED")) return "CONFIRMED";
  if (issue.includes("BATCH_SAVED")) return "SAVED";
  if (
    issue.includes("COD_MISMATCH") ||
    issue.includes("FEE_MISMATCH") ||
    issue.includes("PARTIAL_DELIVERY_AMOUNT_MISMATCH")
  ) {
    return "MISMATCH";
  }
  if (issue.includes("NOT_FOUND_INTERNAL_ORDER")) return "NOT_FOUND";
  if (issue.includes("MATCHED_BY_PARTIAL_DELIVERY")) return "MATCHED_BY_PARTIAL_DELIVERY";
  if (issue.includes("MATCHED")) return "MATCHED";

  const reconciledAt = [
    shipment.codReconciledAt,
    shipment.cod_reconciled_at,
    shipment.codReconciliationPaidAt,
    shipment.cod_reconciliation_paid_at,
    shipment.codReconciliationConfirmedAt,
    shipment.cod_reconciliation_confirmed_at,
    anyOrder.codReconciledAt,
    anyOrder.cod_reconciled_at,
    anyOrder.codReconciliationPaidAt,
    anyOrder.cod_reconciliation_paid_at,
    anyOrder.codReconciliationConfirmedAt,
    anyOrder.cod_reconciliation_confirmed_at,
    anyOrder.shipmentCodReconciledAt,
  ].some(Boolean);

  if (reconciledAt) return "PAID";

  const payments = Array.isArray(anyOrder.payments) ? anyOrder.payments : [];
  const hasGhnCodPayment = payments.some((payment: any) => {
    const paymentText = [
      payment?.method,
      payment?.transactionRef,
      payment?.note,
      payment?.paymentSourceId,
      payment?.paymentSource?.code,
      payment?.paymentSource?.name,
      payment?.sourceCode,
      payment?.sourceName,
    ]
      .map((item) => String(item || "").toUpperCase())
      .join(" ");

    return (
      paymentText.includes("COD_GHN") ||
      paymentText.includes("GHN_COD") ||
      paymentText.includes("COD GHN") ||
      paymentText.includes("ĐỐI SOÁT COD")
    );
  });

  if (hasGhnCodPayment) return "PAID";

  return "";
}

function isOrderCodReconciled(order: AdminOrder) {
  const status = normalizedCodReconciliationStatusFromOrder(order);
  // MATCHED/MATCHED_BY_PARTIAL_DELIVERY chỉ là kết quả đối chiếu nháp trong phiên GHN,
  // chưa phải trạng thái đã chốt. Không dùng paymentStatus=PAID + GHN làm fallback nữa
  // để tránh đội số "đã đối soát" ảo trên danh sách đơn hàng.
  return [
    "PAID",
    "CONFIRMED",
    "RECONCILED",
    "COD_RECONCILED",
    "COD_RECONCILIATION_PAID",
    "USER_CONFIRMED",
  ].includes(status);
}

function codReconciliationListLabel(order: AdminOrder) {
  const status = normalizedCodReconciliationStatusFromOrder(order);
  if (["PAID", "CONFIRMED", "RECONCILED", "COD_RECONCILED", "COD_RECONCILIATION_PAID", "USER_CONFIRMED"].includes(status)) {
    return "Đã đối soát COD";
  }
  if (status === "MATCHED_BY_PARTIAL_DELIVERY") return "Khớp nháp qua giao 1 phần";
  if (status === "MATCHED") return "Khớp nháp, chưa xác nhận";
  if (status === "MISMATCH") return "Lệch đối soát";
  if (status === "NOT_FOUND") return "Không tìm thấy";
  if (status === "SAVED") return "Đã lưu";
  return "Chưa đối soát";
}

function CodReconciliationDot({ order }: { order: AdminOrder }) {
  const done = isOrderCodReconciled(order);
  const label = codReconciliationListLabel(order);

  if (done) {
    return (
      <span
        title={label}
        className="mx-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-[12px] font-bold leading-none text-white"
        aria-label={label}
      >
        ✓
      </span>
    );
  }

  return (
    <span
      title={label}
      className="mx-auto inline-flex h-5 w-5 rounded-full border-2 border-neutral-300 bg-white"
      aria-label={label}
    />
  );
}


function normalizePartialOrderCode(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function getExplicitPartialReturnOrderCode(order: AdminOrder) {
  const anyOrder: any = order || {};
  const partialRows = Array.isArray(anyOrder.partialDeliveries)
    ? anyOrder.partialDeliveries
    : [];

  for (const row of partialRows) {
    const code = String(
      row?.returnOrderCode ||
        row?.returnTrackingCode ||
        row?.returnOrder?.orderCode ||
        row?.returnOrder?.shipment?.trackingCode ||
        "",
    ).trim();

    if (code) return code;
  }

  return "";
}

function isPartialDeliveryListOrder(order: AdminOrder) {
  const anyOrder: any = order || {};
  const noteText = String(anyOrder.note || "").toUpperCase();
  const statusText = String(anyOrder.fulfillmentStatus || "").toUpperCase();

  return Boolean(
    anyOrder.isPartialDelivery ||
      anyOrder.partialReason ||
      statusText === "PARTIAL" ||
      (Array.isArray(anyOrder.partialDeliveries) && anyOrder.partialDeliveries.length > 0) ||
      noteText.includes("PHIEU_GIAO_HANG_1_PHAN") ||
      noteText.includes("GIAO HANG 1 PHAN") ||
      noteText.includes("GIAO HÀNG 1 PHẦN"),
  );
}

function hasPartialReturnOrderInList(
  order: AdminOrder,
  returnOrderCodeSet: Set<string>,
) {
  const anyOrder: any = order || {};
  const orderCode = normalizePartialOrderCode(anyOrder.orderCode);
  if (!orderCode || orderCode.endsWith("_PR")) return false;

  const explicitReturnCode = normalizePartialOrderCode(
    getExplicitPartialReturnOrderCode(order),
  );

  if (explicitReturnCode && returnOrderCodeSet.has(explicitReturnCode)) {
    return true;
  }

  return returnOrderCodeSet.has(`${orderCode}_PR`);
}

function ListDot({ active, title }: { active: boolean; title: string }) {
  if (active) {
    return (
      <span
        title={title}
        className="mx-auto inline-flex h-4 w-4 rounded-full border border-neutral-900 bg-neutral-900"
        aria-label={title}
      />
    );
  }

  return (
    <span
      title={title}
      className="mx-auto inline-flex h-4 w-4 rounded-full border-2 border-neutral-300 bg-white"
      aria-label={title}
    />
  );
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border font-semibold transition ${tones} ${sizes} ${disabled ? "cursor-not-allowed opacity-50" : ""
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
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${active
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
      className={`flex h-9 w-9 items-center justify-center rounded-xl border text-[15px] ${active
          ? "border-white bg-white text-neutral-950"
          : "border-white/70 bg-transparent text-white"
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
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-neutral-950 px-3 py-3 text-left text-white transition ${active
          ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
          : "border-white/70 hover:border-white hover:bg-neutral-900"
        }`}
    >
      <div className="flex items-center gap-3">
        <SummaryIcon active={active}>{icon}</SummaryIcon>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-white/75">{title}</p>
          <p className="mt-0.5 text-[26px] font-semibold leading-none tracking-tight text-white">
            {value}
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
      return "Chờ đối soát COD";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thanh toán lỗi";
    default:
      return status || "—";
  }
}

function isDeliveredForCodReconciliation(order: AdminOrder) {
  const shipment = order.shipment || ({} as any);
  const statusText = [
    shipment.shippingStatus,
    shipment.partnerStatus,
    (shipment as any).ahamoveStatus,
    (shipment as any).status,
    (order as any).shippingStatus,
    (order as any).partnerStatus,
    (order as any).deliveryStatus,
    (order as any).shipmentStatus,
  ]
    .map((item) => String(item || "").toUpperCase())
    .join(" ");

  return (
    statusText.includes("DELIVERED") ||
    statusText.includes("DELIVERY_SUCCESS") ||
    statusText.includes("COMPLETED") ||
    statusText.includes("SUCCESS") ||
    statusText.includes("GIAO_THANH_CONG") ||
    statusText.includes("GIAO HANG THANH CONG") ||
    statusText.includes("GIAO THÀNH CÔNG")
  );
}

function shouldShowPendingCodReconciliation(order: AdminOrder) {
  return (
    String(order.paymentStatus || "").toUpperCase() === "PENDING_COD" &&
    isDeliveredForCodReconciliation(order)
  );
}

function orderPaymentStatusLabel(order: AdminOrder) {
  if (String(order.paymentStatus || "").toUpperCase() === "PENDING_COD") {
    return shouldShowPendingCodReconciliation(order)
      ? "Chờ đối soát COD"
      : "COD chưa thu";
  }

  return paymentStatusLabel(order.paymentStatus);
}

function orderPaymentStatusTone(order: AdminOrder) {
  if (String(order.paymentStatus || "").toUpperCase() === "PENDING_COD") {
    return shouldShowPendingCodReconciliation(order)
      ? paymentStatusTone(order.paymentStatus)
      : "bg-neutral-100 text-neutral-700 border-neutral-200";
  }

  return paymentStatusTone(order.paymentStatus);
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

function normalizeShipmentTextForUi(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function shipmentDisplayStatusLabel(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};
  const returnReceiveStatus = String(
    shipment.returnReceiveStatus ||
      shipment.return_receive_status ||
      shipment.metadata?.returnReceiveStatus ||
      shipment.metadata?.return_receive_status ||
      anyOrder.returnReceiveStatus ||
      anyOrder.return_receive_status ||
      "",
  )
    .toUpperCase()
    .trim();

  const value = shipmentStatusValue(order).toUpperCase();
  const normalizedValue = normalizeShipmentTextForUi(shipmentStatusValue(order));
  const fulfillmentStatus = String(anyOrder.fulfillmentStatus || "").toUpperCase().trim();
  const orderStatus = String(anyOrder.status || "").toUpperCase().trim();
  const looksLikeReturnShipment =
    normalizedValue.includes("CHUYEN HOAN") ||
    normalizedValue.includes("CHO HOAN") ||
    normalizedValue.includes("DANG HOAN") ||
    normalizedValue.includes("HOAN HANG") ||
    normalizedValue.includes("HANG HOAN") ||
    normalizedValue.includes("RETURN");

  if (returnReceiveStatus === "RECEIVED" || returnReceiveStatus === "RECEIVED_WITH_ISSUE") {
    return "Đã nhận hàng hoàn";
  }

  // Một số API danh sách đơn chưa trả metadata.returnReceiveStatus,
  // nhưng sau khi xác nhận nhận hoàn backend đã set fulfillmentStatus = RETURNED.
  // Ưu tiên hiển thị trạng thái vận hành cuối cùng để DS đơn đồng bộ với chi tiết đơn.
  if ((fulfillmentStatus === "RETURNED" || orderStatus === "RETURNED") && looksLikeReturnShipment) {
    return "Đã nhận hàng hoàn";
  }

  if (returnReceiveStatus === "WAITING_CONFIRM" || returnReceiveStatus === "CONFIRMED") {
    return "Chờ xác nhận hàng hoàn";
  }


  if (looksLikeReturnShipment) {
    return "Đang hoàn hàng";
  }

  if (
    normalizedValue.includes("KHONG LIEN LAC") ||
    normalizedValue.includes("KHONG NGHE MAY") ||
    normalizedValue.includes("CHAN SO") ||
    normalizedValue.includes("TU CHOI") ||
    normalizedValue.includes("DOI Y KHONG MUA") ||
    normalizedValue.includes("GIAO THAT BAI") ||
    normalizedValue.includes("DELIVERY FAIL") ||
    normalizedValue.includes("FAILED")
  ) {
    return "Có sự cố";
  }

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


function getShipmentStatusTextCandidates(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};

  return [
    shipment.shippingStatus,
    shipment.partnerStatus,
    shipment.status,
    shipment.currentStatus,
    shipment.current_status,
    shipment.lastStatus,
    shipment.last_status,
    shipment.ahamoveStatus,
    shipment.reason,
    shipment.failureReason,
    shipment.failReason,
    shipment.note,
    shipment.message,
    shipment.description,
    anyOrder.shippingStatus,
    anyOrder.partnerStatus,
    anyOrder.deliveryStatus,
    anyOrder.shipmentStatus,
    anyOrder.carrierStatus,
    anyOrder.carrierStatusName,
  ]
    .map((item) => {
      if (!item) return "";
      if (typeof item === "object") {
        try {
          return JSON.stringify(item);
        } catch {
          return "";
        }
      }
      return String(item);
    })
    .join(" ");
}

function getNormalizedShipmentStatusText(order: AdminOrder) {
  return normalizeShipmentTextForUi(getShipmentStatusTextCandidates(order));
}

function isShipmentDeliveredForOrderStatus(order: AdminOrder) {
  const text = getNormalizedShipmentStatusText(order);

  return (
    text.includes("DELIVERED") ||
    text.includes("DELIVERY SUCCESS") ||
    text.includes("GIAO THANH CONG") ||
    text.includes("HOAN THANH GIAO") ||
    text.includes("DA GIAO THANH CONG")
  );
}

function isShipmentActiveForOrderStatus(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};
  const trackingCode = String(
    shipment.trackingCode ||
      shipment.tracking_code ||
      anyOrder.trackingCode ||
      anyOrder.shipmentTrackingCode ||
      "",
  ).trim();

  if (!trackingCode) return false;
  if (isShipmentDeliveredForOrderStatus(order)) return false;

  const text = getNormalizedShipmentStatusText(order);

  if (
    text.includes("CANCELLED") ||
    text.includes("CANCEL") ||
    text.includes("HUY VAN DON") ||
    text.includes("DA HUY VAN DON")
  ) {
    return (
      text.includes("TRANSPORTING") ||
      text.includes("IN TRANSIT") ||
      text.includes("DANG TRUNG CHUYEN") ||
      text.includes("TRUNG CHUYEN") ||
      text.includes("DELIVERING") ||
      text.includes("DANG GIAO") ||
      text.includes("DANG PHAT") ||
      text.includes("PICKING") ||
      text.includes("PICKED") ||
      text.includes("LAY HANG") ||
      text.includes("DA LAY HANG") ||
      text.includes("STORING") ||
      text.includes("SORTING")
    );
  }

  return !(
    text.includes("RETURNED") ||
    text.includes("RETURN TO CLIENT") ||
    text.includes("DA HOAN HANG") ||
    text.includes("FAILED") ||
    text.includes("LOST") ||
    text.includes("DAMAGE")
  );
}

function getDisplayOrderStatus(order: AdminOrder): OrderStatus {
  const rawStatus = String(order.status || "") as OrderStatus;
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};
  const hasTracking = Boolean(
    String(
      shipment.trackingCode ||
        shipment.tracking_code ||
        anyOrder.trackingCode ||
        anyOrder.shipmentTrackingCode ||
        "",
    ).trim(),
  );

  // Chặn lỗi GHN: các trạng thái "lấy hàng thành công / đang trung chuyển"
  // chỉ được coi là ĐÃ XUẤT KHO, tuyệt đối không hiển thị Hoàn thành nếu hãng chưa giao thành công.
  if (hasTracking && isShipmentActiveForOrderStatus(order)) {
    if (
      rawStatus === "NEW" ||
      rawStatus === "APPROVED" ||
      rawStatus === "PACKING" ||
      rawStatus === "COMPLETED" ||
      rawStatus === "CANCELLED"
    ) {
      return "SHIPPED" as OrderStatus;
    }
  }

  if (rawStatus === "COMPLETED" && hasTracking && !isShipmentDeliveredForOrderStatus(order)) {
    return "SHIPPED" as OrderStatus;
  }

  return (rawStatus || "NEW") as OrderStatus;
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

const ORDER_STATUS_FILTER_OPTIONS: Array<{ value: "ALL" | OrderStatus; label: string }> = [
  { value: "ALL", label: "Tất cả trạng thái đơn" },
  { value: "NEW", label: "Mới tạo" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PACKING", label: "Đang xử lý / đóng gói" },
  { value: "SHIPPED", label: "Đã xuất kho / đang giao" },
  { value: "COMPLETED", label: "Hoàn thành / thành công" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const DELIVERY_STATUS_FILTER_OPTIONS = [
  "Chờ lấy hàng",
  "Đang lấy hàng",
  "Đang giao hàng",
  "Giao thành công",
  "Đang hoàn hàng",
  "Đã hoàn hàng",
  "Đã huỷ vận đơn",
  "Có sự cố",
];

const ORDER_SEARCH_MODE_OPTIONS: Array<{ value: OrderSearchMode; label: string }> = [
  { value: "ALL", label: "Tìm tất cả" },
  { value: "ORDER", label: "Theo đơn hàng / vận đơn" },
  { value: "PHONE", label: "Theo SĐT" },
  { value: "PRODUCT", label: "Theo sản phẩm / SKU" },
];

function shipmentDisplayStatusTone(order: AdminOrder) {
  const value = shipmentStatusValue(order).toUpperCase();
  const normalizedValue = normalizeShipmentTextForUi(shipmentStatusValue(order));

  if (
    normalizedValue.includes("CHUYEN HOAN") ||
    normalizedValue.includes("CHO HOAN") ||
    normalizedValue.includes("DANG HOAN") ||
    normalizedValue.includes("HOAN HANG") ||
    normalizedValue.includes("HANG HOAN") ||
    normalizedValue.includes("RETURN")
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (
    normalizedValue.includes("KHONG LIEN LAC") ||
    normalizedValue.includes("KHONG NGHE MAY") ||
    normalizedValue.includes("CHAN SO") ||
    normalizedValue.includes("TU CHOI") ||
    normalizedValue.includes("DOI Y KHONG MUA") ||
    normalizedValue.includes("GIAO THAT BAI") ||
    normalizedValue.includes("DELIVERY FAIL") ||
    normalizedValue.includes("FAILED")
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }

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

function getShipmentSyncIndicator(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};
  const trackingCode = String(
    shipment.trackingCode ||
      shipment.tracking_code ||
      anyOrder.trackingCode ||
      anyOrder.shipmentTrackingCode ||
      "",
  ).trim();

  if (!trackingCode) {
    return {
      ok: false,
      tone: "bg-neutral-300 border-neutral-400",
      label: "Chưa có vận đơn để kiểm tra đồng bộ trạng thái",
    };
  }

  const shipmentStatus = String(shipment.shippingStatus || "").toUpperCase().trim();
  const normalizedText = getNormalizedShipmentStatusText(order);
  const orderStatus = String(getDisplayOrderStatus(order) || "").toUpperCase();
  const fulfillmentStatus = String(order.fulfillmentStatus || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();
  const returnReceiveStatus = String(
    shipment.returnReceiveStatus ||
      shipment.return_receive_status ||
      anyOrder.returnReceiveStatus ||
      anyOrder.return_receive_status ||
      "",
  )
    .toUpperCase()
    .trim();

  const matchesAny = (values: string[]) =>
    values.some((value) => {
      const upper = String(value || "").toUpperCase();
      return shipmentStatus === upper || normalizedText.includes(upper.replace(/_/g, " "));
    });

  const isDelivered = matchesAny(["DELIVERED", "DELIVERY_SUCCESS", "COMPLETED"]);
  const isReturned = matchesAny(["RETURNED", "RETURNED_TO_CLIENT"]);
  const isReturning = matchesAny(["RETURNING", "RETURN", "WAITING_TO_RETURN"]);
  const isCancelled = matchesAny(["CANCELLED", "CANCEL"]);
  const isFailed = matchesAny(["FAILED", "DELIVERY_FAIL", "EXCEPTION", "LOST", "DAMAGE"]);
  const isActive = matchesAny([
    "READY_TO_PICK",
    "READY_TO_PICKING",
    "WAITING_PICK",
    "WAITING_TO_PICK",
    "CREATED",
    "PENDING",
    "PICKING",
    "PICK",
    "PICKED",
    "ACCEPTED",
    "STORING",
    "IN_TRANSIT",
    "TRANSPORTING",
    "SORTING",
    "DELIVERING",
    "DELIVERY",
    "IN_PROCESS",
  ]);

  let ok = false;
  let label = "Cần đồng bộ lại trạng thái đơn hàng";

  if (isDelivered) {
    ok = orderStatus === "COMPLETED" && fulfillmentStatus === "FULFILLED";
    label = ok
      ? "Đã đồng bộ đúng trạng thái giao thành công"
      : "GHN đã giao thành công nhưng đơn nội bộ chưa đồng bộ xong";
  } else if (isReturned) {
    ok = ["WAITING_CONFIRM", "RECEIVED", "RECEIVED_WITH_ISSUE", "CONFIRMED"].includes(returnReceiveStatus) || fulfillmentStatus === "RETURNED" || orderStatus === "SHIPPED";
    label = ok
      ? returnReceiveStatus === "RECEIVED" || returnReceiveStatus === "RECEIVED_WITH_ISSUE"
        ? "Đã đồng bộ trạng thái hoàn hàng và đã xác nhận nhận hoàn"
        : "Đã đồng bộ trạng thái đã hoàn hàng / chờ xác nhận nhận hoàn"
      : "GHN đã hoàn hàng nhưng đơn nội bộ chưa đồng bộ xong";
  } else if (isReturning) {
    ok = orderStatus === "SHIPPED" && fulfillmentStatus !== "FULFILLED";
    label = ok
      ? "Đã đồng bộ trạng thái đang hoàn hàng"
      : "GHN đang hoàn hàng nhưng đơn nội bộ chưa đồng bộ xong";
  } else if (isCancelled) {
    ok = orderStatus !== "COMPLETED";
    label = ok
      ? "Đã đồng bộ trạng thái huỷ vận đơn"
      : "Vận đơn đã huỷ nhưng trạng thái đơn nội bộ chưa khớp";
  } else if (isFailed) {
    ok = orderStatus !== "COMPLETED" && fulfillmentStatus !== "FULFILLED";
    label = ok
      ? "Đã đồng bộ trạng thái giao vận có sự cố"
      : "GHN báo sự cố nhưng đơn nội bộ chưa đồng bộ xong";
  } else if (isActive) {
    ok = orderStatus === "SHIPPED" && fulfillmentStatus !== "FULFILLED";
    label = ok
      ? "Đã đồng bộ trạng thái giao vận hiện tại"
      : "Trạng thái vận đơn đã đổi nhưng đơn nội bộ chưa đồng bộ xong";
  } else if (shipmentStatus) {
    ok = true;
    label = "Đã có trạng thái vận đơn, chưa phát hiện lệch đồng bộ";
  }

  if (isDelivered && paymentStatus === "PENDING_COD") {
    label = ok
      ? "Đã đồng bộ giao thành công, COD vẫn chờ đối soát"
      : label;
  }

  return {
    ok,
    tone: ok
      ? "bg-emerald-500 border-emerald-600"
      : "bg-amber-400 border-amber-500",
    label,
  };
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
    if (permission === "orders.delete") return false;
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


function normalizeSearchText(value?: string | number | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSearchDigits(value?: string | number | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function pushSearchValue(values: string[], value: any) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item) => pushSearchValue(values, item));
    return;
  }

  if (typeof value === "object") return;

  const text = String(value).trim();
  if (text) values.push(text);
}

function pushAllPrimitiveSearchValues(
  values: string[],
  value: any,
  depth = 0,
  seen = new WeakSet<object>(),
) {
  if (value === null || value === undefined || depth > 5) return;

  if (Array.isArray(value)) {
    value.forEach((item) => pushAllPrimitiveSearchValues(values, item, depth + 1, seen));
    return;
  }

  if (typeof value === "object") {
    if (seen.has(value)) return;
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
      // Bỏ qua blob/html dài để không làm chậm tìm kiếm.
      if (["html", "rawHtml", "bodyHtml"].includes(key)) return;
      pushAllPrimitiveSearchValues(values, child, depth + 1, seen);
    });
    return;
  }

  pushSearchValue(values, value);
}

function normalizeTrackingLikeText(value?: string | number | null) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function getShipmentExactSearchValues(order: NormalizedOrder) {
  const anyOrder = order as any;
  const shipment = anyOrder.shipment || {};
  const values: string[] = [];

  [
    shipment?.trackingCode,
    shipment?.tracking_code,
    shipment?.orderCode,
    shipment?.order_code,
    shipment?.clientOrderCode,
    shipment?.client_order_code,
    shipment?.partnerOrderCode,
    shipment?.partner_order_code,
    shipment?.partnerCode,
    shipment?.partner_code,
    shipment?.labelCode,
    shipment?.label_code,
    shipment?.waybillCode,
    shipment?.waybill_code,
    shipment?.billCode,
    shipment?.bill_code,
    shipment?.carrierOrderCode,
    shipment?.carrier_order_code,
    anyOrder?.trackingCode,
    anyOrder?.tracking_code,
    anyOrder?.shipmentTrackingCode,
    anyOrder?.shipment_tracking_code,
    anyOrder?.deliveryCode,
    anyOrder?.delivery_code,
  ].forEach((value) => pushSearchValue(values, value));

  // Fallback: gom toàn bộ primitive trong shipment vì mỗi hãng đặt tên field khác nhau.
  pushAllPrimitiveSearchValues(values, shipment);

  return Array.from(new Set(values.map(normalizeTrackingLikeText).filter(Boolean)));
}

function isLikelyExactCarrierCode(keyword: string) {
  const normalized = normalizeTrackingLikeText(keyword);
  // Mã GHN/VTP/Aha thường là chuỗi liền chữ+số, tối thiểu 6 ký tự.
  return normalized.length >= 6 && !String(keyword || "").trim().includes(" ");
}

function hasSearchKeyword(value?: string | null) {
  return Boolean(String(value || "").trim());
}

function shouldFallbackToClientOrderSearch(keyword?: string | null) {
  const raw = String(keyword || "").trim();
  if (!raw) return false;

  // SKU thường là mã ngắn/dài có chữ + số/ký tự phân tách. Backend /orders có thể
  // chưa join order items để search được SKU, nên nếu server trả rỗng sẽ tải rộng
  // theo các filter còn lại và lọc lại trên frontend.
  const normalized = normalizeTrackingLikeText(raw);
  const hasAlpha = /[A-Z]/.test(normalized);
  const hasDigit = /\d/.test(normalized);
  const hasSkuSeparator = /[-_.\/]/.test(raw);

  return (
    raw.toLowerCase().includes("sku") ||
    hasSkuSeparator ||
    (normalized.length >= 4 && hasAlpha && hasDigit)
  );
}

function orderMatchesExactCarrierCode(order: NormalizedOrder, keyword: string) {
  const needle = normalizeTrackingLikeText(keyword);
  if (!needle) return false;
  return getShipmentExactSearchValues(order).some((value) => value === needle);
}


function getOrderSearchValues(order: NormalizedOrder) {
  const anyOrder = order as any;
  const values: string[] = [];

  [
    order.id,
    order.orderCode,
    anyOrder.code,
    anyOrder.orderId,
    anyOrder.displayId,
    anyOrder.clientOrderCode,
    anyOrder.customerId,
    anyOrder.customer?.id,
    order.customerName,
    order.customerPhone,
    anyOrder.phone,
    anyOrder.receiverPhone,
    anyOrder.toPhone,
    anyOrder.customer?.phone,
    anyOrder.customer?.name,
    anyOrder.customer?.fullName,
    anyOrder.customer?.email,
    order.status,
    order.paymentStatus,
    order.fulfillmentStatus,
    order.branchId,
    order._createdByName,
    order._assignedStaffName,
    order.salesChannel,
    order._meta.address,
    order._meta.noteText,
    order._meta.shippingNote,
    order._meta.shippingMode,
    order._meta.shippingPartner,
    order.shipment?.carrier,
    order.shipment?.trackingCode,
    (order.shipment as any)?.orderCode,
    (order.shipment as any)?.clientOrderCode,
    (order.shipment as any)?.partnerOrderCode,
    (order.shipment as any)?.trackingUrl,
    order.note,
  ].forEach((value) => pushSearchValue(values, value));

  if (Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      [
        item?.sku,
        item?.skuCode,
        item?.barcode,
        item?.variantSku,
        item?.variantSKU,
        item?.productSku,
        item?.productSKU,
        item?.productName,
        item?.name,
        item?.variant?.sku,
        item?.variant?.skuCode,
        item?.variant?.barcode,
        item?.variant?.code,
        item?.variant?.color,
        item?.variant?.size,
        item?.product?.sku,
        item?.product?.skuCode,
        item?.product?.code,
        item?.product?.name,
      ].forEach((value) => pushSearchValue(values, value));
    });
  }

  // Fallback quan trọng: gom toàn bộ primitive field trong object đơn hàng.
  // Nhờ vậy tìm được mã GHN/VTP/Ahamove dù backend trả tên field khác
  // như order_code, client_order_code, sort_code, tracking_code, partnerCode...
  pushAllPrimitiveSearchValues(values, anyOrder);

  return Array.from(new Set(values));
}

function getOrderCodeSearchValues(order: NormalizedOrder) {
  const anyOrder = order as any;
  const shipment: any = anyOrder.shipment || {};
  const values: string[] = [];

  [
    order.id,
    order.orderCode,
    anyOrder.code,
    anyOrder.orderId,
    anyOrder.displayId,
    anyOrder.clientOrderCode,
    anyOrder.orderNo,
    anyOrder.orderNumber,
    shipment.trackingCode,
    shipment.tracking_code,
    shipment.orderCode,
    shipment.order_code,
    shipment.clientOrderCode,
    shipment.client_order_code,
    shipment.partnerOrderCode,
    shipment.partner_order_code,
    shipment.waybillCode,
    shipment.waybill_code,
    shipment.billCode,
    shipment.bill_code,
    shipment.carrierOrderCode,
    shipment.carrier_order_code,
    anyOrder.trackingCode,
    anyOrder.tracking_code,
    anyOrder.shipmentTrackingCode,
    anyOrder.shipment_tracking_code,
    anyOrder.deliveryCode,
    anyOrder.delivery_code,
  ].forEach((value) => pushSearchValue(values, value));

  getShipmentExactSearchValues(order).forEach((value) => pushSearchValue(values, value));

  return Array.from(new Set(values));
}

function getPhoneSearchValues(order: NormalizedOrder) {
  const anyOrder = order as any;
  const values: string[] = [];

  [
    order.customerPhone,
    anyOrder.phone,
    anyOrder.receiverPhone,
    anyOrder.toPhone,
    anyOrder.shippingPhone,
    anyOrder.customer?.phone,
    anyOrder.customer?.mobile,
    anyOrder.customer?.tel,
    anyOrder.customerAddress?.phone,
    anyOrder.address?.phone,
  ].forEach((value) => pushSearchValue(values, value));

  return Array.from(new Set(values));
}

function getProductSearchValues(order: NormalizedOrder) {
  const values: string[] = [];

  if (Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      [
        item?.sku,
        item?.skuCode,
        item?.sku_code,
        item?.barcode,
        item?.variantSku,
        item?.variantSKU,
        item?.variantCode,
        item?.productSku,
        item?.productSKU,
        item?.productCode,
        item?.productName,
        item?.name,
        item?.title,
        item?.color,
        item?.size,
        item?.variantName,
        item?.variant?.sku,
        item?.variant?.skuCode,
        item?.variant?.sku_code,
        item?.variant?.barcode,
        item?.variant?.code,
        item?.variant?.name,
        item?.variant?.color,
        item?.variant?.size,
        item?.product?.sku,
        item?.product?.skuCode,
        item?.product?.sku_code,
        item?.product?.code,
        item?.product?.name,
        item?.product?.title,
      ].forEach((value) => pushSearchValue(values, value));
    });
  }

  return Array.from(new Set(values));
}


function getProductItemPrimarySku(item: any) {
  return String(
    item?.sku ||
      item?.skuCode ||
      item?.sku_code ||
      item?.variantSku ||
      item?.variantSKU ||
      item?.variant?.sku ||
      item?.variant?.skuCode ||
      item?.variant?.sku_code ||
      item?.barcode ||
      item?.variant?.barcode ||
      item?.variantCode ||
      item?.variant?.code ||
      item?.productSku ||
      item?.productSKU ||
      item?.product?.sku ||
      item?.product?.skuCode ||
      item?.product?.sku_code ||
      item?.productCode ||
      item?.product?.code ||
      "",
  ).trim();
}

function getProductItemProductName(item: any) {
  return String(
    item?.productName ||
      item?.product?.name ||
      item?.product?.title ||
      item?.name ||
      item?.title ||
      item?.variantName ||
      item?.variant?.name ||
      "",
  ).trim();
}

function getProductItemColor(item: any) {
  return String(item?.color || item?.variant?.color || item?.colorName || item?.variant?.colorName || "").trim();
}

function getProductItemSize(item: any) {
  return String(item?.size || item?.variant?.size || item?.sizeName || item?.variant?.sizeName || "").trim();
}

function buildProductFilterOptionFromItem(item: any): ProductFilterOption | null {
  const sku = getProductItemPrimarySku(item);
  const productName = getProductItemProductName(item);
  const color = getProductItemColor(item);
  const size = getProductItemSize(item);

  if (!sku && !productName) return null;

  const value = normalizeTrackingLikeText(sku || `${productName}-${color}-${size}`);
  if (!value) return null;

  const variantText = [color, size].filter(Boolean).join(" - ");
  const productCode = pickFirstText(
    item?.productSku,
    item?.productSKU,
    item?.productCode,
    item?.product?.sku,
    item?.product?.skuCode,
    item?.product?.sku_code,
    item?.product?.code,
  );
  const label = [productName || "Sản phẩm", sku, variantText]
    .filter(Boolean)
    .join(" · ");
  const searchText = normalizeSearchText(
    [label, sku, productCode, productName, color, size, item?.variantName]
      .filter(Boolean)
      .join(" "),
  );

  return {
    value,
    label,
    sku,
    productName,
    color,
    size,
    productCode,
    source: "orders",
    searchText,
  };
}


function pickFirstText(...values: any[]) {
  return values
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function getProductCatalogRows(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.rows)) return raw.rows;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.products)) return raw.products;
  return [];
}

function getProductVariantRows(product: any): any[] {
  const variants =
    product?.variants ||
    product?.productVariants ||
    product?.skus ||
    product?.children ||
    product?.items ||
    [];
  return Array.isArray(variants) ? variants : [];
}

function buildProductFilterOptionFromCatalog(product: any, variant?: any): ProductFilterOption | null {
  const productName = pickFirstText(
    product?.name,
    product?.productName,
    product?.title,
    product?.displayName,
  );
  const productCode = pickFirstText(
    product?.sku,
    product?.skuCode,
    product?.sku_code,
    product?.code,
    product?.productCode,
    product?.product_code,
    product?.barcode,
  );
  const sku = pickFirstText(
    variant?.sku,
    variant?.skuCode,
    variant?.sku_code,
    variant?.code,
    variant?.variantCode,
    variant?.barcode,
    variant?.productSku,
    variant?.productSKU,
    productCode,
  );
  const color = pickFirstText(
    variant?.color,
    variant?.colorName,
    variant?.color_name,
    variant?.attributeColor,
    variant?.attributes?.color,
  );
  const size = pickFirstText(
    variant?.size,
    variant?.sizeName,
    variant?.size_name,
    variant?.attributeSize,
    variant?.attributes?.size,
  );

  if (!sku && !productCode && !productName) return null;

  const value = normalizeTrackingLikeText(sku || productCode || `${productName}-${color}-${size}`);
  if (!value) return null;

  const variantText = [color, size].filter(Boolean).join(" - ");
  const label = [productName || "Sản phẩm", sku || productCode, variantText]
    .filter(Boolean)
    .join(" · ");
  const searchText = normalizeSearchText(
    [
      label,
      sku,
      productCode,
      productName,
      color,
      size,
      variant?.name,
      variant?.title,
      variant?.variantName,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return {
    value,
    label,
    sku: sku || productCode,
    productName,
    color,
    size,
    productCode,
    source: "catalog",
    searchText,
  };
}

function buildProductFilterOptionsFromCatalogRows(rows: any[]): ProductFilterOption[] {
  const optionMap = new Map<string, ProductFilterOption>();

  rows.forEach((product) => {
    const variants = getProductVariantRows(product);

    if (variants.length) {
      variants.forEach((variant) => {
        const option = buildProductFilterOptionFromCatalog(product, variant);
        if (option && !optionMap.has(option.value)) optionMap.set(option.value, option);
      });
      return;
    }

    const option = buildProductFilterOptionFromCatalog(product);
    if (option && !optionMap.has(option.value)) optionMap.set(option.value, option);
  });

  return Array.from(optionMap.values()).sort((a, b) => {
    const byProduct = String(a.productCode || a.productName || "").localeCompare(
      String(b.productCode || b.productName || ""),
      "vi",
    );
    if (byProduct !== 0) return byProduct;
    return String(a.sku || "").localeCompare(String(b.sku || ""), "vi");
  });
}

function optionMatchesProductSkuKeyword(option: ProductFilterOption, rawKeyword: string) {
  const keyword = String(rawKeyword || "").trim();
  if (!keyword) return true;

  const textNeedle = normalizeSearchText(keyword);
  const trackingNeedle = normalizeTrackingLikeText(keyword);
  const searchText = option.searchText || "";
  const trackingValues = [option.sku, option.productCode, option.label, option.productName]
    .map(normalizeTrackingLikeText)
    .filter(Boolean);

  if (textNeedle && searchText.includes(textNeedle)) return true;
  if (trackingNeedle && trackingValues.some((value) => value.includes(trackingNeedle))) return true;

  return false;
}

function getOrderProductFilterValues(order: NormalizedOrder) {
  const values: string[] = [];

  if (Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      const option = buildProductFilterOptionFromItem(item);
      if (option?.value) values.push(option.value);

      [
        item?.sku,
        item?.skuCode,
        item?.sku_code,
        item?.variantSku,
        item?.variantSKU,
        item?.variant?.sku,
        item?.variant?.skuCode,
        item?.variant?.sku_code,
        item?.barcode,
        item?.variant?.barcode,
        item?.variantCode,
        item?.variant?.code,
        item?.productSku,
        item?.productSKU,
        item?.product?.sku,
        item?.product?.skuCode,
        item?.product?.sku_code,
        item?.productCode,
        item?.product?.code,
      ].forEach((value) => {
        const normalized = normalizeTrackingLikeText(value);
        if (normalized) values.push(normalized);
      });
    });
  }

  return Array.from(new Set(values));
}

function orderMatchesSelectedProductFilters(order: NormalizedOrder, selectedValues: string[]) {
  if (!selectedValues.length) return true;
  const orderValues = new Set(getOrderProductFilterValues(order));
  return selectedValues.some((value) => orderValues.has(normalizeTrackingLikeText(value)));
}

function valuesMatchKeyword(values: string[], keyword: string) {
  const rawKeyword = String(keyword || "").trim();
  if (!rawKeyword) return true;

  const normalizedTextValues = values.map(normalizeSearchText).filter(Boolean);
  const normalizedDigitValues = values.map(normalizeSearchDigits).filter(Boolean);
  const normalizedTrackingValues = values.map(normalizeTrackingLikeText).filter(Boolean);
  const haystackText = normalizedTextValues.join(" ");
  const haystackDigits = normalizedDigitValues.join(" ");
  const haystackTracking = normalizedTrackingValues.join(" ");

  const matchOne = (term: string, exactCodeMode = false) => {
    const textNeedle = normalizeSearchText(term);
    const digitNeedle = normalizeSearchDigits(term);
    const trackingNeedle = normalizeTrackingLikeText(term);

    if (exactCodeMode && trackingNeedle && isLikelyExactCarrierCode(term)) {
      return normalizedTrackingValues.some((value) => value === trackingNeedle);
    }

    return (
      Boolean(textNeedle && haystackText.includes(textNeedle)) ||
      Boolean(digitNeedle && haystackDigits.includes(digitNeedle)) ||
      Boolean(trackingNeedle && haystackTracking.includes(trackingNeedle))
    );
  };

  // Tìm nhiều mã đơn/GHN bằng dấu phẩy/chấm phẩy/xuống dòng: match kiểu OR.
  // Với mã vận đơn dạng chữ+số dài, dùng exact match để tránh ăn nhầm mã gần giống.
  const separatedTerms = rawKeyword
    .split(/[,;\n]+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (separatedTerms.length > 1) {
    return separatedTerms.some((term) => matchOne(term, true));
  }

  const fullTextNeedle = normalizeSearchText(rawKeyword);
  const fullDigitNeedle = normalizeSearchDigits(rawKeyword);
  const fullTrackingNeedle = normalizeTrackingLikeText(rawKeyword);

  if (fullTextNeedle && haystackText.includes(fullTextNeedle)) return true;
  if (fullDigitNeedle && haystackDigits.includes(fullDigitNeedle)) return true;
  if (fullTrackingNeedle && haystackTracking.includes(fullTrackingNeedle)) return true;

  const terms = rawKeyword
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) return true;

  return terms.every((term) => matchOne(term));
}

function orderMatchesKeyword(
  order: NormalizedOrder,
  keyword: string,
  branchName?: string,
  mode: OrderSearchMode = "ALL",
) {
  const rawKeyword = String(keyword || "").trim();
  if (!rawKeyword) return true;

  if (mode === "ORDER") {
    return valuesMatchKeyword(getOrderCodeSearchValues(order), rawKeyword);
  }

  if (mode === "PHONE") {
    return valuesMatchKeyword(getPhoneSearchValues(order), rawKeyword);
  }

  if (mode === "PRODUCT") {
    return valuesMatchKeyword(getProductSearchValues(order), rawKeyword);
  }

  const values = getOrderSearchValues(order);
  if (branchName) values.push(branchName);
  return valuesMatchKeyword(values, rawKeyword);
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

function getAssignedStaffRawName(order: any) {
  return String(
    order?.assignedStaffName ||
      order?.assignedStaff?.name ||
      order?.assignedStaff?.fullName ||
      order?.assignedToStaffName ||
      order?.assignedToStaff?.name ||
      order?.assignedToStaff?.fullName ||
      order?.assigneeName ||
      order?.assignee?.name ||
      order?.assignee?.fullName ||
      "",
  ).trim();
}

function getAssignedStaffDisplayName(order: any) {
  // Cột NV phụ trách dùng để chốt lương:
  // nếu chưa gán nhân viên phụ trách thì lấy nhân viên tạo đơn.
  return getAssignedStaffRawName(order) || getCreatedByName(order);
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

type SmartOrderSearch = {
  raw: string;
  terms: string[];
  hasMultiTerms: boolean;
  staffName: string;
  staffScope: "created" | "assigned" | "any";
  completedOnly: boolean;
  monthMode: "this_month" | "last_month" | "none";
  dateFrom: Date | null;
  dateTo: Date | null;
};

function smartDateRangeForMonth(mode: SmartOrderSearch["monthMode"]) {
  const now = new Date();

  if (mode === "this_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  if (mode === "last_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };
  }

  return { from: null, to: null };
}

function isLikelyOrderLookupTerm(value?: string | null) {
  const raw = String(value || "").trim();
  const normalized = normalizeTrackingLikeText(raw);
  return normalized.length >= 4 && /\d/.test(normalized);
}

function splitSmartOrderSearchTerms(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const hardSplit = text
    .split(/[\n,;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (hardSplit.length > 1) return Array.from(new Set(hardSplit));

  const looseParts = text
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (looseParts.length > 1 && looseParts.every(isLikelyOrderLookupTerm)) {
    return Array.from(new Set(looseParts));
  }

  return [text];
}

function parseSmartOrderSearch(raw: string, staffNames: string[]): SmartOrderSearch {
  const text = String(raw || "").trim();
  const normalized = normalizeSearchText(text);
  const terms = splitSmartOrderSearchTerms(text);
  const hasMultiTerms = terms.length > 1 && terms.every(isLikelyOrderLookupTerm);

  const sortedStaffNames = [...staffNames]
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const staffName =
    sortedStaffNames.find((name) => {
      const normalizedName = normalizeSearchText(name);
      return normalizedName && normalized.includes(normalizedName);
    }) || "";

  const staffScope = normalized.includes("gan") || normalized.includes("phu trach") || normalized.includes("assigned") || normalized.includes("assignee")
    ? "assigned"
    : normalized.includes("tao") || normalized.includes("created") || normalized.includes("luong") || normalized.includes("kpi") || normalized.includes("hoa hong")
      ? "created"
      : "any";

  let monthMode: SmartOrderSearch["monthMode"] = "none";
  if (normalized.includes("thang nay") || normalized.includes("this month")) monthMode = "this_month";
  if (normalized.includes("thang truoc") || normalized.includes("last month")) monthMode = "last_month";

  const dateRange = smartDateRangeForMonth(monthMode);

  const completedOnly =
    normalized.includes("thanh cong") ||
    normalized.includes("hoan thanh") ||
    normalized.includes("completed") ||
    normalized.includes("fulfilled") ||
    normalized.includes("giao thanh cong");

  return {
    raw: text,
    terms,
    hasMultiTerms,
    staffName,
    staffScope,
    completedOnly,
    monthMode,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  };
}

function getSmartSearchServerDateRange(raw: string) {
  const normalized = normalizeSearchText(raw);
  if (normalized.includes("thang nay") || normalized.includes("this month")) {
    return smartDateRangeForMonth("this_month");
  }
  if (normalized.includes("thang truoc") || normalized.includes("last month")) {
    return smartDateRangeForMonth("last_month");
  }
  return { from: null, to: null };
}

function orderMatchesSmartSearch(
  order: NormalizedOrder,
  smart: SmartOrderSearch,
  branchName?: string,
) {
  if (!smart.raw) return true;

  let matchedStructuredPart = false;

  if (smart.hasMultiTerms) {
    matchedStructuredPart = true;
    const matchedAnyTerm = smart.terms.some((term) => {
      if (isLikelyExactCarrierCode(term) && orderMatchesExactCarrierCode(order, term)) {
        return true;
      }
      return orderMatchesKeyword(order, term, branchName);
    });

    if (!matchedAnyTerm) return false;
  }

  if (smart.staffName) {
    matchedStructuredPart = true;
    const createdName = normalizeComparableText(order._createdByName);
    const assignedName = normalizeComparableText(order._assignedStaffName);
    const targetName = normalizeComparableText(smart.staffName);

    if (smart.staffScope === "created" && createdName !== targetName) return false;
    if (smart.staffScope === "assigned" && assignedName !== targetName) return false;
    if (smart.staffScope === "any" && createdName !== targetName && assignedName !== targetName) {
      return false;
    }
  }

  if (smart.dateFrom || smart.dateTo) {
    matchedStructuredPart = true;
    const createdAt = order._createdAtDate;
    if (!createdAt) return false;
    if (smart.dateFrom && createdAt < smart.dateFrom) return false;
    if (smart.dateTo && createdAt > smart.dateTo) return false;
  }

  if (smart.completedOnly) {
    matchedStructuredPart = true;
    const deliveryLabel = shipmentDisplayStatusLabel(order);
    const isCompleted =
      getDisplayOrderStatus(order) === "COMPLETED" ||
      order.fulfillmentStatus === "FULFILLED" ||
      deliveryLabel === "Giao thành công";
    if (!isCompleted) return false;
  }

  if (!matchedStructuredPart) {
    return orderMatchesKeyword(order, smart.raw, branchName);
  }

  return true;
}

function defaultVisibleColumns(canSeeMoney: boolean) {
  return COLUMN_DEFS.filter((col) => {
    if (col.money && !canSeeMoney) return false;
    return col.defaultVisible;
  }).map((col) => col.key);
}

function mergeStoredColumnsWithDefaults(storedColumns: ColumnKey[], defaults: ColumnKey[]) {
  const defaultSet = new Set(defaults);
  const next = storedColumns.filter((key, index, arr) => {
    return defaultSet.has(key) && arr.indexOf(key) === index;
  });

  for (const key of defaults) {
    if (next.includes(key)) continue;

    const defaultIndex = defaults.indexOf(key);
    let insertAt = next.length;

    for (let i = defaultIndex - 1; i >= 0; i -= 1) {
      const previousDefaultKey = defaults[i];
      const previousIndex = next.indexOf(previousDefaultKey);
      if (previousIndex >= 0) {
        insertAt = previousIndex + 1;
        break;
      }
    }

    next.splice(insertAt, 0, key);
  }

  return next;
}

function normalizeShipmentStatus(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};
  const status = String(
    shipment.shippingStatus ||
    shipment.partnerStatus ||
    shipment.status ||
    shipment.currentStatus ||
    shipment.current_status ||
    shipment.lastStatus ||
    shipment.last_status ||
    anyOrder.shippingStatus ||
    anyOrder.partnerStatus ||
    anyOrder.deliveryStatus ||
    anyOrder.shipmentStatus ||
    anyOrder.carrierStatus ||
    anyOrder.carrierStatusName ||
    "",
  ).toUpperCase();

  if (status) return status;
  if (order.shipment?.trackingCode) return "READY_TO_PICK";
  return "";
}

function getShipmentIssueText(order: AdminOrder) {
  const anyOrder: any = order || {};
  const shipment: any = anyOrder.shipment || {};
  const values = [
    shipment.shippingStatus,
    shipment.partnerStatus,
    shipment.status,
    shipment.currentStatus,
    shipment.current_status,
    shipment.lastStatus,
    shipment.last_status,
    shipment.reason,
    shipment.failureReason,
    shipment.failReason,
    shipment.note,
    shipment.message,
    shipment.description,
    shipment.metadata,
    anyOrder.shippingStatus,
    anyOrder.partnerStatus,
    anyOrder.deliveryStatus,
    anyOrder.shipmentStatus,
    anyOrder.carrierStatus,
    anyOrder.carrierStatusName,
    anyOrder.deliveryResult,
    anyOrder.deliveryReason,
    anyOrder.failReason,
    anyOrder.failureReason,
    anyOrder.note,
    anyOrder._meta?.noteText,
    anyOrder._meta?.shippingNote,
  ];

  return values
    .map((value) => {
      if (!value) return "";
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }
      return String(value);
    })
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isReturnOrWaitingReturnOrder(order: AdminOrder) {
  const text = getShipmentIssueText(order);
  return (
    text.includes("chuyen hoan") ||
    text.includes("cho hoan") ||
    text.includes("dang hoan") ||
    text.includes("hoan hang") ||
    text.includes("hang hoan") ||
    text.includes("luu tai buu cuc cho ap don") ||
    text.includes("returning") ||
    text.includes("waiting to return") ||
    text.includes("waiting return") ||
    text.includes("returned") ||
    text.includes("return")
  );
}

function isDeliveryFailureSignal(order: AdminOrder) {
  const text = getShipmentIssueText(order);
  return (
    text.includes("giao hang khong thanh cong") ||
    text.includes("giao khong thanh cong") ||
    text.includes("giao that bai") ||
    text.includes("that bai") ||
    text.includes("delivery fail") ||
    text.includes("delivery failed") ||
    text.includes("deliver fail") ||
    text.includes("khong lien lac duoc") ||
    text.includes("khong nghe may") ||
    text.includes("chan so") ||
    text.includes("tu choi nhan") ||
    text.includes("doi y khong mua") ||
    text.includes("khong mua nua") ||
    text.includes("nhan vien gap su co") ||
    text.includes("fail") ||
    text.includes("exception") ||
    text.includes("lost") ||
    text.includes("damage")
  );
}

function isSoonDeliveryOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  const text = getShipmentIssueText(order);
  return (
    shipmentStatus.includes("DELIVERING") ||
    text.includes("dang giao") ||
    text.includes("dang phat") ||
    text.includes("san sang giao") ||
    text.includes("ready to deliver")
  );
}

function isCurrentForwardShipmentStatus(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  if (!shipmentStatus) return false;

  if (
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("EXCEPTION") ||
    shipmentStatus.includes("RETURN") ||
    shipmentStatus.includes("CANCEL") ||
    shipmentStatus.includes("DELIVERED") ||
    shipmentStatus.includes("SUCCESS") ||
    shipmentStatus.includes("COMPLETED")
  ) {
    return false;
  }

  return (
    shipmentStatus.includes("CREATED") ||
    shipmentStatus.includes("READY_TO_PICK") ||
    shipmentStatus.includes("WAITING_TO_PICK") ||
    shipmentStatus.includes("PICKING") ||
    shipmentStatus.includes("PICKED") ||
    shipmentStatus.includes("STORING") ||
    shipmentStatus.includes("SORTING") ||
    shipmentStatus.includes("TRANSPORT") ||
    shipmentStatus.includes("IN_TRANSIT") ||
    shipmentStatus.includes("DELIVERING") ||
    shipmentStatus.includes("READY_TO_DELIVER") ||
    shipmentStatus.includes("WAITING_TO_DELIVER") ||
    shipmentStatus.includes("IN_PROCESS")
  );
}

function isFailedOrder(order: AdminOrder) {
  // Card "Đơn giao không thành công" chỉ tính lỗi giao vận thật ở trạng thái hiện tại.
  // Nếu vận đơn hiện đang lấy/giao/trung chuyển thì không được lọt vào nhóm fail,
  // dù metadata/log cũ còn chứa chữ fail/không thành công.
  if (String(order.status || "").toUpperCase() === "CANCELLED") return false;
  if (isCurrentForwardShipmentStatus(order)) return false;

  const shipmentStatus = normalizeShipmentStatus(order);
  return (
    order.paymentStatus === "FAILED" ||
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("EXCEPTION") ||
    isDeliveryFailureSignal(order)
  );
}

function isActiveForwardShipmentOrder(order: AdminOrder) {
  const text = getShipmentIssueText(order);
  const shipmentStatus = normalizeShipmentStatus(order);

  if (
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("EXCEPTION") ||
    shipmentStatus.includes("RETURN") ||
    shipmentStatus.includes("CANCEL") ||
    shipmentStatus.includes("DELIVERED") ||
    shipmentStatus.includes("SUCCESS") ||
    text.includes("that bai") ||
    text.includes("khong thanh cong") ||
    text.includes("hoan hang") ||
    text.includes("chuyen hoan") ||
    text.includes("cho hoan") ||
    text.includes("return")
  ) {
    return false;
  }

  return (
    shipmentStatus.includes("CREATED") ||
    shipmentStatus.includes("PICKING") ||
    shipmentStatus.includes("PICKED") ||
    shipmentStatus.includes("STORING") ||
    shipmentStatus.includes("SORTING") ||
    shipmentStatus.includes("TRANSPORT") ||
    shipmentStatus.includes("IN_TRANSIT") ||
    shipmentStatus.includes("DELIVERING") ||
    shipmentStatus.includes("READY_TO_DELIVER") ||
    shipmentStatus.includes("WAITING_TO_DELIVER") ||
    text.includes("cho lay") ||
    text.includes("dang lay") ||
    text.includes("lay hang") ||
    text.includes("dang giao") ||
    text.includes("dang phat") ||
    text.includes("san sang giao") ||
    text.includes("ready to deliver") ||
    text.includes("waiting to deliver") ||
    text.includes("transporting") ||
    text.includes("trung chuyen") ||
    text.includes("phan loai")
  );
}

function isRedeliveryOrder(order: AdminOrder) {
  if (String(order.status || "").toUpperCase() === "CANCELLED") return false;

  const text = getShipmentIssueText(order);
  const shipmentStatus = normalizeShipmentStatus(order);
  const hasExplicitRedeliverySignal =
    text.includes("giao lai") ||
    text.includes("giao hang lan") ||
    text.includes("hen lai ngay giao") ||
    text.includes("cho xac nhan giao lai") ||
    text.includes("re delivery") ||
    text.includes("redelivery") ||
    shipmentStatus.includes("REDELIVERY");

  if (hasExplicitRedeliverySignal) return true;

  // Đơn đang chạy tuyến bình thường như đang lấy hàng/đang giao không được đẩy vào card giao lại.
  // Card giao lại chỉ dành cho đơn fail/hoàn/chờ hoàn cần xử lý lại.
  if (isActiveForwardShipmentOrder(order)) return false;

  return isDeliveryFailureSignal(order) || isReturnOrWaitingReturnOrder(order);
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
  | "codReconciliation"
  | "partialReturnOrder"
  | "partialDeliveryOrder"
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
  | "goodsSubtotal"
  | "productDiscount"
  | "goodsAfterDiscount"
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
  codReconciliation: true,
  partialReturnOrder: true,
  partialDeliveryOrder: true,
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
  goodsSubtotal: true,
  productDiscount: true,
  goodsAfterDiscount: true,
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
  codReconciliation: "Đối soát COD",
  partialReturnOrder: "Đơn trả hàng",
  partialDeliveryOrder: "Đơn giao 1 phần",
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
  goodsSubtotal: "Tiền hàng",
  productDiscount: "Chiết khấu sản phẩm",
  goodsAfterDiscount: "Tiền hàng sau chiết khấu",
  codAmount: "Tiền COD",
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
  const partialReturnOrderCodeSet = new Set(
    exportOrders
      .map((order) => normalizePartialOrderCode(order.orderCode))
      .filter((code) => code.endsWith("_PR")),
  );

  return exportOrders.map((order) => {
    const meta = order._meta;
    const row: Record<string, any> = {};

    if (columns.orderCode) row["Mã đơn"] = order.orderCode || "";
    if (columns.createdAt)
      row["Ngày tạo"] = new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(order.createdAt));
    if (columns.customerName) row["Khách hàng"] = order.customerName || "";
    if (columns.customerPhone) row["SĐT"] = order.customerPhone || "";
    if (columns.orderStatus)
      row["Trạng thái đơn"] = orderStatusLabel(getDisplayOrderStatus(order));
    if (columns.paymentDotStatus)
      row["Trạng thái thanh toán"] = dotStateLabel(
        paymentDotState(order.paymentStatus),
      );
    if (columns.paymentStatus)
      row["Thanh toán"] = orderPaymentStatusLabel(order);
    if ((columns as any).codReconciliation)
      row["Đối soát COD"] = codReconciliationListLabel(order);
    if ((columns as any).partialReturnOrder)
      row["Đơn trả hàng"] = hasPartialReturnOrderInList(order, partialReturnOrderCodeSet)
        ? "Có"
        : "Không";
    if ((columns as any).partialDeliveryOrder)
      row["Đơn giao 1 phần"] = isPartialDeliveryListOrder(order) ? "Có" : "Không";
    if (columns.stockOutStatus)
      row["Trạng thái xuất kho"] = dotStateLabel(
        stockOutDotState(getDisplayOrderStatus(order)),
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
      "Thanh toán": orderPaymentStatusLabel(o),
      "Tiền COD": o._codAmount,
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
          "Ngày tạo": new Intl.DateTimeFormat("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(new Date(order.createdAt)),
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
  useEffect(() => {
    const handleActiveBranchChanged = () => {
      window.location.reload();
    };

    window.addEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
    return () => {
      window.removeEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
    };
  }, []);

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
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<OrderSearchMode>("ALL");
  const [submittedSearchMode, setSubmittedSearchMode] = useState<OrderSearchMode>("ALL");
  const [selectedProductSkuValues, setSelectedProductSkuValues] = useState<string[]>([]);
  const [appliedProductSkuValues, setAppliedProductSkuValues] = useState<string[]>([]);
  const [catalogProductSkuOptions, setCatalogProductSkuOptions] = useState<ProductFilterOption[]>([]);
  const [productSkuCatalogLoading, setProductSkuCatalogLoading] = useState(false);
  const productSkuCatalogQueryRef = useRef("");
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
    const cached = readTimedCache<BranchItem[]>(ORDERS_BRANCH_CACHE_KEY);
    if (cached?.length) {
      setBranches(cached);
      return;
    }

    try {
      const data = await getBranches();
      const normalized = Array.isArray(data) ? data : [];
      setBranches(normalized);
      if (normalized.length) writeTimedCache(ORDERS_BRANCH_CACHE_KEY, normalized);
    } catch {
      // Nếu mất mạng ngắn hạn, giữ branch cũ để UI không trắng và không giật layout.
      setBranches((prev) => prev);
    }
  };

  const normalizeStaffRows = (json: any) => {
    const data = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.items)
          ? json.items
          : [];

    return data.filter((item: any) => item?.isActive !== false);
  };

  const loadStaffList = async () => {
    try {
      // Nhân viên thường không nhất thiết có quyền mở toàn bộ /staff.
      // Endpoint này chỉ trả danh sách nhân viên có thể nhận đơn theo chi nhánh/quyền hiện tại.
      const json = await apiJson<any>("/orders/assignable-staff");
      setStaffList(normalizeStaffRows(json));
      return;
    } catch {
      // fallback cho owner/admin hoặc bản core cũ chưa có endpoint mới
    }

    try {
      const json = await apiJson<any>("/staff");
      setStaffList(normalizeStaffRows(json));
    } catch {
      setStaffList([]);
    }
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const initialQueryFilters = useMemo(() => readOrdersPageInitialQuery(), []);

  const [orderFilter, setOrderFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedOrderFilter, setAppliedOrderFilter] = useState<MultiFilterValue>(["ALL"]);
  const [paymentFilter, setPaymentFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedPaymentFilter, setAppliedPaymentFilter] = useState<MultiFilterValue>(["ALL"]);
  const [branchFilter, setBranchFilter] = useState<MultiFilterValue>(initialQueryFilters.branchFilter);
  const [appliedBranchFilter, setAppliedBranchFilter] = useState<MultiFilterValue>(initialQueryFilters.branchFilter);
  const [dateFrom, setDateFrom] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [quickDate, setQuickDate] = useState<QuickDateKey>("all");
  const [appliedQuickDate, setAppliedQuickDate] = useState<QuickDateKey>("all");
  const [cardDateFilter, setCardDateFilter] = useState<QuickDateKey>(initialQueryFilters.cardDate);
  const [cardCounts, setCardCounts] = useState<QuickStatusCounts>(EMPTY_QUICK_STATUS_COUNTS);
  const [cardCountsLoading, setCardCountsLoading] = useState(false);
  const [cardCountsLoaded, setCardCountsLoaded] = useState(false);
  const [quickStatus, setQuickStatus] = useState<QuickStatusKey>(initialQueryFilters.quickStatus);
  const [appliedQuickStatus, setAppliedQuickStatus] = useState<QuickStatusKey>(initialQueryFilters.quickStatus);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterPresets, setFilterPresets] = useState<OrderFilterPreset[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [createdByFilter, setCreatedByFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedCreatedByFilter, setAppliedCreatedByFilter] = useState<MultiFilterValue>(["ALL"]);
  const [assignedStaffFilter, setAssignedStaffFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedAssignedStaffFilter, setAppliedAssignedStaffFilter] = useState<MultiFilterValue>(["ALL"]);
  const [fulfillmentFilter, setFulfillmentFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedFulfillmentFilter, setAppliedFulfillmentFilter] = useState<MultiFilterValue>(["ALL"]);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedDeliveryStatusFilter, setAppliedDeliveryStatusFilter] = useState<MultiFilterValue>(["ALL"]);
  const [salesChannelFilter, setSalesChannelFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedSalesChannelFilter, setAppliedSalesChannelFilter] = useState<MultiFilterValue>(["ALL"]);
  const [shippingModeFilter, setShippingModeFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedShippingModeFilter, setAppliedShippingModeFilter] = useState<MultiFilterValue>(["ALL"]);
  const [shippingPartnerFilter, setShippingPartnerFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedShippingPartnerFilter, setAppliedShippingPartnerFilter] = useState<MultiFilterValue>(["ALL"]);
  const [trackingFilter, setTrackingFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedTrackingFilter, setAppliedTrackingFilter] = useState<MultiFilterValue>(["ALL"]);
  const [printStatusFilter, setPrintStatusFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedPrintStatusFilter, setAppliedPrintStatusFilter] = useState<MultiFilterValue>(["ALL"]);
  const [codFilter, setCodFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedCodFilter, setAppliedCodFilter] = useState<MultiFilterValue>(["ALL"]);
  const [codReconciliationFilter, setCodReconciliationFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedCodReconciliationFilter, setAppliedCodReconciliationFilter] = useState<MultiFilterValue>(["ALL"]);
  const [amountDueFilter, setAmountDueFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedAmountDueFilter, setAppliedAmountDueFilter] = useState<MultiFilterValue>(["ALL"]);
  const [itemCountFilter, setItemCountFilter] = useState<MultiFilterValue>(["ALL"]);
  const [appliedItemCountFilter, setAppliedItemCountFilter] = useState<MultiFilterValue>(["ALL"]);
  const [freeTextFilter, setFreeTextFilter] = useState("");
  const [appliedFreeTextFilter, setAppliedFreeTextFilter] = useState("");
  const [smartSearchInput, setSmartSearchInput] = useState("");
  const [smartSearch, setSmartSearch] = useState("");
  const [showSmartSearchHelp, setShowSmartSearchHelp] = useState(false);

  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [savingOrderStatus, setSavingOrderStatus] = useState(false);
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserLite | null>(null);

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const ordersRequestSeqRef = useRef(0);
  const ordersAbortRef = useRef<AbortController | null>(null);
  const cardCountsRequestSeqRef = useRef(0);
  const cardCountsAbortRef = useRef<AbortController | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const isDraggingRef = useRef(false);

  const [tableScrollLeft, setTableScrollLeft] = useState(0);
  const [tableMaxScrollLeft, setTableMaxScrollLeft] = useState(0);
  const [isDraggingTable, setIsDraggingTable] = useState(false);

  const canViewAllOrders = hasOrderPermission(currentUser, "orders.view");
  const canViewOwnOrders = hasOrderPermission(currentUser, "orders.view_own");
  const canCreateOrder = hasOrderPermission(currentUser, "orders.create");
  const canApproveOrder = hasOrderPermission(currentUser, "orders.approve");
  const canCancelOrder = hasOrderPermission(currentUser, "orders.cancel");
  const canPayOrder = hasOrderPermission(currentUser, "orders.pay");
  const canPackShipOrder = hasOrderPermission(currentUser, "orders.pack_ship");
  const canExportOrderExcel = hasOrderPermission(
    currentUser,
    "orders.excel.export",
  );

  const canSeeMoney = isOwnerOrAdminUser(currentUser);
  const canManageFilterPresets = isOwnerOrAdminUser(currentUser);
  const canDeleteOrder = hasOrderPermission(currentUser, "orders.delete");

  const userStorageSuffix = useMemo(() => {
    const userKey =
      currentUser?.id ||
      currentUser?.code ||
      currentUser?.email ||
      currentUser?.name ||
      currentUser?.fullName ||
      currentUser?.role ||
      "guest";

    return `${String(userKey).replace(/[^a-zA-Z0-9_-]/g, "_")}.${getWorkingBranchId(currentUser) || currentUser?.branchId || "all"
      }`;
  }, [currentUser]);

  const columnStorageKey = `orders.visibleColumns.${canSeeMoney ? "admin" : "staff"
    }.${userStorageSuffix}`;

  const scrollStorageKey = `${TABLE_SCROLL_STORAGE_KEY}.${userStorageSuffix}`;

  useEffect(() => {
    if (!canManageFilterPresets || typeof window === "undefined") {
      setFilterPresets([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(ORDER_FILTER_PRESETS_STORAGE_KEY);
      const parsed = JSON.parse(raw || "[]");
      setFilterPresets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFilterPresets([]);
    }
  }, [canManageFilterPresets]);

  const persistFilterPresets = (items: OrderFilterPreset[]) => {
    const safeItems = items.slice(0, 80);
    setFilterPresets(safeItems);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ORDER_FILTER_PRESETS_STORAGE_KEY, JSON.stringify(safeItems));
    } catch {
      // ignore storage quota/private mode
    }
  };

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([]);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<ColumnKey[]>(
    [],
  );
  const dragColumnKeyRef = useRef<ColumnKey | null>(null);

  const branchLabel = (branchId?: string | null) => {
    if (!branchId) return "All";
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  const toggleSelectedProductSku = (value: string) => {
    const normalized = normalizeTrackingLikeText(value);
    if (!normalized) return;
    setSelectedProductSkuValues((prev) =>
      prev.includes(normalized)
        ? prev.filter((item) => item !== normalized)
        : [...prev, normalized],
    );
  };


  const loadProductCatalogOptions = async (keyword: string) => {
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword.length < 2) {
      setCatalogProductSkuOptions([]);
      return;
    }

    productSkuCatalogQueryRef.current = normalizedKeyword;
    setProductSkuCatalogLoading(true);

    try {
      const params = new URLSearchParams({
        q: normalizedKeyword,
        search: normalizedKeyword,
        keyword: normalizedKeyword,
        includeVariants: "1",
        withVariants: "1",
        pageSize: "80",
        limit: "80",
      });

      const raw = await apiJson<any>(`/products?${params.toString()}`).catch(async () => {
        const fallbackParams = new URLSearchParams({
          q: normalizedKeyword,
          includeVariants: "1",
          pageSize: "80",
        });
        return apiJson<any>(`/control/products?${fallbackParams.toString()}`);
      });

      if (productSkuCatalogQueryRef.current !== normalizedKeyword) return;

      const options = buildProductFilterOptionsFromCatalogRows(getProductCatalogRows(raw))
        .filter((option) => optionMatchesProductSkuKeyword(option, normalizedKeyword));

      setCatalogProductSkuOptions(options);
    } catch {
      if (productSkuCatalogQueryRef.current === normalizedKeyword) {
        setCatalogProductSkuOptions([]);
      }
    } finally {
      if (productSkuCatalogQueryRef.current === normalizedKeyword) {
        setProductSkuCatalogLoading(false);
      }
    }
  };

  const staffLabel = (staff?: StaffLite | null) => {
    if (!staff) return "—";
    return staff.name || staff.fullName || staff.code || staff.id;
  };

  const assignableStaffList = useMemo(() => {
    if (isOwnerOrAdminUser(currentUser) || isAllMultiFilter(branchFilter)) {
      return staffList;
    }

    const selectedBranches = selectedMultiFilterValues(branchFilter);
    return staffList.filter(
      (staff) => !staff.branchId || selectedBranches.includes(staff.branchId),
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
    const copyKey = order.orderCode || order.id;
    const href = `/create-order?copyFrom=${encodeURIComponent(copyKey)}`;

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
      setBranchFilter([storedUser.branchId]);
      setAppliedBranchFilter([storedUser.branchId]);
    }

    void loadBranches();
  }, []);

  useEffect(() => {
    if (!assignOpen || staffList.length) return;
    void loadStaffList();
  }, [assignOpen, staffList.length]);

  useEffect(() => {
    if (searchMode !== "PRODUCT") {
      setCatalogProductSkuOptions([]);
      return;
    }

    const keyword = query.trim();
    const timer = window.setTimeout(() => {
      void loadProductCatalogOptions(keyword);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchMode, query]);



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
        ? mergeStoredColumnsWithDefaults(cleaned, defaults)
        : defaults;

      // Giữ đúng thứ tự đã kéo thả trong localStorage, nhưng cột mới được chèn theo vị trí mặc định.
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
      if (
        presetMenuRef.current &&
        !presetMenuRef.current.contains(e.target as Node)
      ) {
        setShowPresetMenu(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const loadOrders = async () => {
    const requestSeq = ordersRequestSeqRef.current + 1;
    ordersRequestSeqRef.current = requestSeq;
    ordersAbortRef.current?.abort();
    const abortController = new AbortController();
    ordersAbortRef.current = abortController;

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

      const serverKeyword = [submittedQuery, appliedFreeTextFilter]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join(" ");
      const hasAppliedProductSkuFilter = appliedProductSkuValues.length > 0;
      const multiLookupTerms = splitSmartOrderSearchTerms(serverKeyword);
      const hasMultiExactLookupSearch =
        multiLookupTerms.length > 1 && multiLookupTerms.every(isLikelyOrderLookupTerm);
      const shouldUseClientOnlySearch =
        (submittedSearchMode === "PRODUCT" && hasSearchKeyword(serverKeyword)) ||
        hasAppliedProductSkuFilter ||
        hasMultiExactLookupSearch;
      const effectiveServerKeyword = shouldUseClientOnlySearch ? "" : serverKeyword;
      const shouldTryClientSearchFallback =
        shouldFallbackToClientOrderSearch(effectiveServerKeyword) || hasMultiExactLookupSearch;

      const hasSmartSearch = Boolean(String(smartSearch || "").trim());
      const hasMultiServerFilter = [
        appliedBranchFilter,
        appliedOrderFilter,
        appliedPaymentFilter,
      ].some((filterValue) => selectedMultiFilterValues(filterValue).length > 1);
      const hasQuickStatusFilter = appliedQuickStatus !== "ALL";
      const shouldLoadWideForClientFilters =
        hasSmartSearch ||
        hasMultiServerFilter ||
        shouldUseClientOnlySearch;
      const requestPageSize = shouldLoadWideForClientFilters
        ? Math.max(pageSize, ORDER_CLIENT_SEARCH_PAGE_SIZE)
        : pageSize;
      const requestPage = shouldLoadWideForClientFilters ? 1 : page;
      const quickStatusDateRange = hasQuickStatusFilter
        ? getQuickDateRange(cardDateFilter)
        : { from: null, to: null };
      const quickStatusDateFrom = toInputDateValue(quickStatusDateRange.from);
      const quickStatusDateTo = toInputDateValue(quickStatusDateRange.to);

      const buildParams = (
        targetPage: number,
        options?: { includeKeyword?: boolean; pageSizeOverride?: number; keywordOverride?: string },
      ) => {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("pageSize", String(options?.pageSizeOverride || requestPageSize));
        params.set("includeItems", "1");
        params.set("withItems", "1");
        const queryKeyword = options?.keywordOverride ?? effectiveServerKeyword;
        if (queryKeyword && options?.includeKeyword !== false) params.set("q", queryKeyword);

        if (!canViewAllOrders && canViewOwnOrders) {
          params.set("viewScope", "own");
          if (currentUser?.id) params.set("createdByStaffId", currentUser.id);
          if (currentUser?.code) params.set("createdByStaffCode", currentUser.code);
        }

        const selectedBranchIds = selectedMultiFilterValues(appliedBranchFilter);
        const selectedOrderStatuses = selectedMultiFilterValues(appliedOrderFilter);
        const selectedPaymentStatuses = selectedMultiFilterValues(appliedPaymentFilter);

        if (!canViewAllOrders && currentUser?.branchId) {
          params.set("branchId", currentUser.branchId);
        } else if (selectedBranchIds.length === 1) {
          params.set("branchId", selectedBranchIds[0]);
        }

        if (selectedOrderStatuses.length === 1) params.set("orderStatus", selectedOrderStatuses[0]);
        if (selectedPaymentStatuses.length === 1) params.set("paymentStatus", selectedPaymentStatuses[0]);

        const selectedCodReconciliationStatuses = selectedMultiFilterValues(appliedCodReconciliationFilter);
        if (selectedCodReconciliationStatuses.length > 0) {
          params.set("codReconciliationStatus", selectedCodReconciliationStatuses.join(","));
        }

        const serverDateFrom = hasQuickStatusFilter ? quickStatusDateFrom : appliedDateFrom;
        const serverDateTo = hasQuickStatusFilter ? quickStatusDateTo : appliedDateTo;

        if (serverDateFrom) params.set("dateFrom", serverDateFrom);
        if (serverDateTo) params.set("dateTo", serverDateTo);
        if (hasQuickStatusFilter) params.set("quickStatus", appliedQuickStatus);

        const smartDateRange = getSmartSearchServerDateRange(smartSearch);
        if (!hasQuickStatusFilter && !serverDateFrom && smartDateRange.from) {
          params.set("dateFrom", toInputDateValue(smartDateRange.from));
        }
        if (!hasQuickStatusFilter && !serverDateTo && smartDateRange.to) {
          params.set("dateTo", toInputDateValue(smartDateRange.to));
        }

        return params;
      };

      const fetchOrderPage = async (
        targetPage: number,
        options?: { includeKeyword?: boolean; pageSizeOverride?: number; keywordOverride?: string },
      ) => {
        const res = await apiFetch(`/orders?${buildParams(targetPage, options).toString()}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
          signal: abortController.signal,
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

        return {
          data,
          totalPages: Number(raw?.pagination?.totalPages || 1),
          total: Number(raw?.pagination?.total || data.length || 0),
        };
      };

      const firstPage = await fetchOrderPage(requestPage);
      let data = firstPage.data;
      let remoteTotalPages = firstPage.totalPages;
      let remoteTotalItems = firstPage.total;

      if (shouldLoadWideForClientFilters && Number(firstPage.totalPages || 1) > 1) {
        const wideTotalPages = Math.min(
          Number(firstPage.totalPages || 1),
          ORDER_CLIENT_SEARCH_MAX_PAGES,
        );

        for (let nextPage = 2; nextPage <= wideTotalPages; nextPage += 1) {
          if (abortController.signal.aborted) break;
          const next = await fetchOrderPage(nextPage, {
            includeKeyword: false,
            pageSizeOverride: ORDER_CLIENT_SEARCH_PAGE_SIZE,
          });
          data.push(...next.data);
        }

        remoteTotalPages = 1;
        remoteTotalItems = data.length;
      }

      if (
        hasSearchKeyword(effectiveServerKeyword) &&
        shouldTryClientSearchFallback &&
        data.length === 0
      ) {
        const fallbackFirstPage = await fetchOrderPage(1, {
          includeKeyword: false,
          pageSizeOverride: ORDER_CLIENT_SEARCH_PAGE_SIZE,
        });
        const fallbackData = [...fallbackFirstPage.data];
        const fallbackTotalPages = Math.min(
          Number(fallbackFirstPage.totalPages || 1),
          ORDER_CLIENT_SEARCH_MAX_PAGES,
        );

        for (let nextPage = 2; nextPage <= fallbackTotalPages; nextPage += 1) {
          if (abortController.signal.aborted) break;
          const next = await fetchOrderPage(nextPage, {
            includeKeyword: false,
            pageSizeOverride: ORDER_CLIENT_SEARCH_PAGE_SIZE,
          });
          fallbackData.push(...next.data);
        }

        data = fallbackData;
        remoteTotalPages = 1;
        remoteTotalItems = fallbackData.length;
      }

      if (hasMultiExactLookupSearch) {
        const mergedById = new Map<string, any>();

        data.forEach((order: any) => {
          const key = String(order?.id || order?.orderCode || order?.code || "").trim();
          if (key) mergedById.set(key, order);
        });

        for (const term of multiLookupTerms) {
          const termResult = await fetchOrderPage(1, {
            keywordOverride: term,
            pageSizeOverride: 100,
          });

          termResult.data.forEach((order: any) => {
            const key = String(order?.id || order?.orderCode || order?.code || "").trim();
            if (key) mergedById.set(key, order);
          });
        }

        data = Array.from(mergedById.values());
        remoteTotalPages = 1;
        remoteTotalItems = data.length;
      }

      const scopedData =
        !canViewAllOrders && canViewOwnOrders
          ? data.filter((order: any) =>
              isOrderCreatedByCurrentUser(order, currentUser),
            )
          : data;

      if (requestSeq !== ordersRequestSeqRef.current || abortController.signal.aborted) return;

      setOrders(scopedData as AdminOrder[]);
      setTotalPages(remoteTotalPages);
      setTotalItems(
        !canViewAllOrders && canViewOwnOrders
          ? scopedData.length
          : remoteTotalItems || scopedData.length || 0,
      );
    } catch (err) {
      if (abortController.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Không tải được đơn hàng.";
      setError(message);
      // Giữ lại dữ liệu cũ nếu request mới bị lỗi mạng ngắn hạn, tránh màn hình trắng và cảm giác tải chậm.
      setOrders((prev) => prev);
    } finally {
      if (requestSeq === ordersRequestSeqRef.current && !abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const normalizeOrdersForCards = (rows: AdminOrder[]): NormalizedOrder[] => {
    return rows.map((order) => {
      const meta = parseStructuredNote(order.note);
      return {
        ...order,
        _meta: meta,
        _createdByName: getCreatedByName(order),
        _assignedStaffName: getAssignedStaffDisplayName(order),
        _assignedStaffRawName: getAssignedStaffRawName(order),
        _shippingFee: Number(order.shippingFee || 0),
        _carrierShippingFee: Number(order.shipment?.shippingFee || 0),
        _goodsSubtotal: getOrderGoodsSubtotal(order),
        _productDiscount: getOrderProductDiscount(order),
        _goodsAfterDiscount: getOrderGoodsAfterDiscount(order),
        _codAmount: Number(order.shipment?.codAmount || 0),
        _amountDue: amountCustomerStillOwes(order),
        _createdAtDate: parseOrderDate(order.createdAt),
      };
    });
  };

  const buildQuickStatusCounts = (rows: NormalizedOrder[]): QuickStatusCounts => {
    const next = { ...EMPTY_QUICK_STATUS_COUNTS };

    for (const o of rows) {
      const displayStatus = getDisplayOrderStatus(o);

      if (displayStatus === "NEW") next.waitingApprove += 1;
      if (["UNPAID", "PARTIAL", "PENDING_COD"].includes(String(o.paymentStatus || ""))) {
        next.waitingPayment += 1;
      }
      if (displayStatus === "PACKING") next.waitingPacking += 1;
      if (["APPROVED", "PACKING"].includes(displayStatus)) next.waitingShip += 1;
      if (displayStatus === "SHIPPED") next.delivering += 1;
      if (isSoonDeliveryOrder(o)) next.soonDelivery += 1;
      if (isFailedOrder(o)) next.failed += 1;
      if (isRedeliveryOrder(o)) next.redelivery += 1;
      if (isLocalDeliveryCarrier(o.shipment?.carrier || o._meta.shippingPartner)) {
        next.localDelivery += 1;
      }
    }

    return next;
  };

  const loadCardCounts = async () => {
    const requestSeq = cardCountsRequestSeqRef.current + 1;
    cardCountsRequestSeqRef.current = requestSeq;
    cardCountsAbortRef.current?.abort();
    const abortController = new AbortController();
    cardCountsAbortRef.current = abortController;

    try {
      setCardCountsLoading(true);

      if (!currentUser || (!canViewAllOrders && !canViewOwnOrders)) {
        setCardCounts(EMPTY_QUICK_STATUS_COUNTS);
        setCardCountsLoaded(true);
        return;
      }

      const selectedBranchIds = selectedMultiFilterValues(appliedBranchFilter);
      const dateRange = getQuickDateRange(cardDateFilter);
      const dateFromValue = toInputDateValue(dateRange.from);
      const dateToValue = toInputDateValue(dateRange.to);

      const params = new URLSearchParams();

      if (!canViewAllOrders && canViewOwnOrders) {
        params.set("viewScope", "own");
        if (currentUser?.id) params.set("createdByStaffId", currentUser.id);
        if (currentUser?.code) params.set("createdByStaffCode", currentUser.code);
      }

      if (!canViewAllOrders && currentUser?.branchId) {
        params.set("branchId", currentUser.branchId);
      } else if (selectedBranchIds.length === 1) {
        params.set("branchId", selectedBranchIds[0]);
      }

      if (dateFromValue) params.set("dateFrom", dateFromValue);
      if (dateToValue) params.set("dateTo", dateToValue);

      const res = await apiFetch(`/orders/quick-status-counts?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: abortController.signal,
      });

      const raw = await res.json();

      if (!res.ok) {
        throw new Error(raw?.message || `Tải thống kê nhanh thất bại. Status ${res.status}`);
      }

      if (requestSeq !== cardCountsRequestSeqRef.current || abortController.signal.aborted) return;

      setCardCounts({
        ...EMPTY_QUICK_STATUS_COUNTS,
        waitingApprove: Number(raw?.waitingApprove || 0),
        waitingPayment: Number(raw?.waitingPayment || 0),
        waitingPacking: Number(raw?.waitingPacking || 0),
        waitingShip: Number(raw?.waitingShip || 0),
        delivering: Number(raw?.delivering || 0),
        soonDelivery: Number(raw?.soonDelivery || 0),
        failed: Number(raw?.failed || 0),
        redelivery: Number(raw?.redelivery || 0),
        localDelivery: Number(raw?.localDelivery || 0),
      });
      setCardCountsLoaded(true);
    } catch {
      if (abortController.signal.aborted) return;
      setCardCounts((prev) => prev);
      setCardCountsLoaded(true);
    } finally {
      if (requestSeq === cardCountsRequestSeqRef.current && !abortController.signal.aborted) {
        setCardCountsLoading(false);
      }
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void loadOrders();
    }, 20);

    return () => clearTimeout(t);
  }, [
    submittedQuery,
    submittedSearchMode,
    appliedFreeTextFilter,
    smartSearch,
    appliedProductSkuValues,
    appliedBranchFilter,
    appliedOrderFilter,
    appliedPaymentFilter,
    appliedCodReconciliationFilter,
    appliedDateFrom,
    appliedDateTo,
    appliedQuickStatus,
    appliedQuickStatus === "ALL" ? "all" : cardDateFilter,
    page,
    pageSize,
    currentUser,
  ]);

  useEffect(() => {
    if (loading || !currentUser) return;

    const timer = window.setTimeout(() => {
      void loadCardCounts();
    }, 160);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    currentUser,
    canViewAllOrders,
    canViewOwnOrders,
    appliedBranchFilter,
    cardDateFilter,
  ]);

  useEffect(() => {
    return () => {
      ordersAbortRef.current?.abort();
      cardCountsAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    submittedQuery,
    submittedSearchMode,
    appliedBranchFilter,
    appliedOrderFilter,
    appliedPaymentFilter,
    appliedDateFrom,
    appliedDateTo,
    appliedCreatedByFilter,
    appliedAssignedStaffFilter,
    appliedFulfillmentFilter,
    appliedDeliveryStatusFilter,
    appliedSalesChannelFilter,
    appliedShippingModeFilter,
    appliedShippingPartnerFilter,
    appliedTrackingFilter,
    appliedPrintStatusFilter,
    appliedCodFilter,
    appliedCodReconciliationFilter,
    appliedAmountDueFilter,
    appliedItemCountFilter,
    appliedProductSkuValues,
    appliedFreeTextFilter,
    smartSearch,
    appliedQuickStatus,
    appliedQuickStatus === "ALL" ? "all" : cardDateFilter,
  ]);

  const normalizedOrders = useMemo<NormalizedOrder[]>(() => {
    return orders.map((order) => {
      const meta = parseStructuredNote(order.note);
      return {
        ...order,
        _meta: meta,
        _createdByName: getCreatedByName(order),
        _assignedStaffName: getAssignedStaffDisplayName(order),
        _assignedStaffRawName: getAssignedStaffRawName(order),
        _shippingFee: Number(order.shippingFee || 0),
        _carrierShippingFee: Number(order.shipment?.shippingFee || 0),
        _goodsSubtotal: getOrderGoodsSubtotal(order),
        _productDiscount: getOrderProductDiscount(order),
        _goodsAfterDiscount: getOrderGoodsAfterDiscount(order),
        _codAmount: Number(order.shipment?.codAmount || 0),
        _amountDue: amountCustomerStillOwes(order),
        _createdAtDate: parseOrderDate(order.createdAt),
      };
    });
  }, [orders]);

  const partialReturnOrderCodeSet = useMemo(() => {
    return new Set(
      normalizedOrders
        .map((order) => normalizePartialOrderCode(order.orderCode))
        .filter((code) => code.endsWith("_PR")),
    );
  }, [normalizedOrders]);

  const branchOptions = useMemo<MultiFilterOption[]>(() => {
    return branches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));
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

  const assignedStaffOptions = useMemo(
    () => uniqueOptions(normalizedOrders.map((o) => o._assignedStaffName)),
    [normalizedOrders],
  );

  const smartStaffNameOptions = useMemo(
    () => uniqueOptions([...createdByOptions, ...assignedStaffOptions]),
    [createdByOptions, assignedStaffOptions],
  );

  const parsedSmartSearch = useMemo(
    () => parseSmartOrderSearch(smartSearch, smartStaffNameOptions),
    [smartSearch, smartStaffNameOptions],
  );

  const deliveryStatusOptions = useMemo(() => {
    const dynamicOptions = uniqueOptions(
      normalizedOrders.map((o) => shipmentDisplayStatusLabel(o)),
    );

    return Array.from(
      new Set([...DELIVERY_STATUS_FILTER_OPTIONS, ...dynamicOptions]),
    );
  }, [normalizedOrders]);

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

  const productSkuOptions = useMemo<ProductFilterOption[]>(() => {
    const optionMap = new Map<string, ProductFilterOption>();

    normalizedOrders.forEach((order) => {
      if (!Array.isArray(order.items)) return;
      order.items.forEach((item: any) => {
        const option = buildProductFilterOptionFromItem(item);
        if (!option || optionMap.has(option.value)) return;
        optionMap.set(option.value, option);
      });
    });

    catalogProductSkuOptions.forEach((option) => {
      if (!option || !option.value) return;
      // Ưu tiên catalog vì catalog thường có đủ biến thể/SKU con hơn dữ liệu list đơn.
      optionMap.set(option.value, option);
    });

    return Array.from(optionMap.values()).sort((a, b) => {
      const byProduct = String(a.productCode || a.productName || "").localeCompare(
        String(b.productCode || b.productName || ""),
        "vi",
      );
      if (byProduct !== 0) return byProduct;
      const bySku = String(a.sku || "").localeCompare(String(b.sku || ""), "vi");
      if (bySku !== 0) return bySku;
      return a.label.localeCompare(b.label, "vi");
    });
  }, [normalizedOrders, catalogProductSkuOptions]);

  const visibleProductSkuOptions = useMemo(() => {
    const rawKeyword = query.trim();
    const selected = new Set(selectedProductSkuValues.map(normalizeTrackingLikeText));

    const matched = productSkuOptions.filter((option) => {
      if (selected.has(option.value)) return true;
      if (!rawKeyword) return selected.size > 0;
      return optionMatchesProductSkuKeyword(option, rawKeyword);
    });

    return matched.slice(0, 120);
  }, [productSkuOptions, query, selectedProductSkuValues]);

  const activeAdvancedFilterCount =
    [
      appliedBranchFilter,
      appliedOrderFilter,
      appliedPaymentFilter,
      appliedCreatedByFilter,
      appliedAssignedStaffFilter,
      appliedFulfillmentFilter,
      appliedDeliveryStatusFilter,
      appliedSalesChannelFilter,
      appliedShippingModeFilter,
      appliedShippingPartnerFilter,
      appliedTrackingFilter,
      appliedPrintStatusFilter,
      appliedCodFilter,
      appliedCodReconciliationFilter,
      appliedAmountDueFilter,
      appliedItemCountFilter,
    ].filter((value) => !isAllMultiFilter(value)).length +
    (appliedDateFrom || appliedDateTo || appliedQuickDate !== "all" ? 1 : 0) +
    (appliedFreeTextFilter.trim() ? 1 : 0) +
    (smartSearch.trim() ? 1 : 0);

  const clearAdvancedFilters = () => {
    setQuickDate("all");
    setDateFrom("");
    setDateTo("");
    setBranchFilter(["ALL"]);
    setOrderFilter(["ALL"]);
    setPaymentFilter(["ALL"]);
    setCreatedByFilter(["ALL"]);
    setAssignedStaffFilter(["ALL"]);
    setFulfillmentFilter(["ALL"]);
    setDeliveryStatusFilter(["ALL"]);
    setSalesChannelFilter(["ALL"]);
    setShippingModeFilter(["ALL"]);
    setShippingPartnerFilter(["ALL"]);
    setTrackingFilter(["ALL"]);
    setPrintStatusFilter(["ALL"]);
    setCodFilter(["ALL"]);
    setCodReconciliationFilter(["ALL"]);
    setAmountDueFilter(["ALL"]);
    setItemCountFilter(["ALL"]);
    setFreeTextFilter("");
    setSmartSearchInput("");

    setAppliedQuickDate("all");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setAppliedBranchFilter(["ALL"]);
    setAppliedOrderFilter(["ALL"]);
    setAppliedPaymentFilter(["ALL"]);
    setAppliedCreatedByFilter(["ALL"]);
    setAppliedAssignedStaffFilter(["ALL"]);
    setAppliedFulfillmentFilter(["ALL"]);
    setAppliedDeliveryStatusFilter(["ALL"]);
    setAppliedSalesChannelFilter(["ALL"]);
    setAppliedShippingModeFilter(["ALL"]);
    setAppliedShippingPartnerFilter(["ALL"]);
    setAppliedTrackingFilter(["ALL"]);
    setAppliedPrintStatusFilter(["ALL"]);
    setAppliedCodFilter(["ALL"]);
    setAppliedCodReconciliationFilter(["ALL"]);
    setAppliedAmountDueFilter(["ALL"]);
    setAppliedItemCountFilter(["ALL"]);
    setAppliedFreeTextFilter("");
    setSmartSearch("");
    setPage(1);
  };

  const applySearchAndFilters = (overrideQuery?: string) => {
    const nextQuery = (overrideQuery ?? query).trim();
    const nextSmartSearch = smartSearchInput.trim();

    setSubmittedQuery(nextQuery);
    setSubmittedSearchMode(searchMode);
    setAppliedProductSkuValues(selectedProductSkuValues);
    setAppliedBranchFilter(branchFilter);
    setAppliedOrderFilter(orderFilter);
    setAppliedPaymentFilter(paymentFilter);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedQuickDate(quickDate);
    setAppliedQuickStatus(quickStatus);

    setAppliedCreatedByFilter(createdByFilter);
    setAppliedAssignedStaffFilter(assignedStaffFilter);
    setAppliedFulfillmentFilter(fulfillmentFilter);
    setAppliedDeliveryStatusFilter(deliveryStatusFilter);
    setAppliedSalesChannelFilter(salesChannelFilter);
    setAppliedShippingModeFilter(shippingModeFilter);
    setAppliedShippingPartnerFilter(shippingPartnerFilter);
    setAppliedTrackingFilter(trackingFilter);
    setAppliedPrintStatusFilter(printStatusFilter);
    setAppliedCodFilter(codFilter);
    setAppliedCodReconciliationFilter(codReconciliationFilter);
    setAppliedAmountDueFilter(amountDueFilter);
    setAppliedItemCountFilter(itemCountFilter);
    setAppliedFreeTextFilter(freeTextFilter.trim());
    setSmartSearch(nextSmartSearch);
    setPage(1);
  };

  const submitSmartSearch = () => {
    applySearchAndFilters();
  };

  const clearSmartSearch = () => {
    setSmartSearchInput("");
    setSmartSearch("");
    setPage(1);
  };

  const buildCurrentFilterPresetFilters = (): OrderFilterPresetFilters => ({
    query: query.trim(),
    searchMode,
    selectedProductSkuValues,
    quickDate,
    dateFrom,
    dateTo,
    quickStatus,
    branchFilter: normalizeMultiFilterValue(branchFilter),
    orderFilter: normalizeMultiFilterValue(orderFilter),
    paymentFilter: normalizeMultiFilterValue(paymentFilter),
    createdByFilter: normalizeMultiFilterValue(createdByFilter),
    assignedStaffFilter: normalizeMultiFilterValue(assignedStaffFilter),
    fulfillmentFilter: normalizeMultiFilterValue(fulfillmentFilter),
    deliveryStatusFilter: normalizeMultiFilterValue(deliveryStatusFilter),
    salesChannelFilter: normalizeMultiFilterValue(salesChannelFilter),
    shippingModeFilter: normalizeMultiFilterValue(shippingModeFilter),
    shippingPartnerFilter: normalizeMultiFilterValue(shippingPartnerFilter),
    trackingFilter: normalizeMultiFilterValue(trackingFilter),
    printStatusFilter: normalizeMultiFilterValue(printStatusFilter),
    codFilter: normalizeMultiFilterValue(codFilter),
    codReconciliationFilter: normalizeMultiFilterValue(codReconciliationFilter),
    amountDueFilter: normalizeMultiFilterValue(amountDueFilter),
    itemCountFilter: normalizeMultiFilterValue(itemCountFilter),
    freeTextFilter: freeTextFilter.trim(),
    smartSearchInput: smartSearchInput.trim(),
  });

  const applyFilterPreset = (preset: OrderFilterPreset) => {
    const filters = preset.filters;
    const nextSearchMode = filters.searchMode || "ALL";
    const nextQuery = String(filters.query || "").trim();
    const nextProductSkuValues = Array.isArray(filters.selectedProductSkuValues)
      ? filters.selectedProductSkuValues
      : [];
    const nextQuickDate = filters.quickDate || "all";
    const nextDateFrom = filters.dateFrom || "";
    const nextDateTo = filters.dateTo || "";
    const nextQuickStatus = filters.quickStatus || "ALL";
    const nextSmartSearch = String(filters.smartSearchInput || "").trim();
    const nextFreeText = String(filters.freeTextFilter || "").trim();

    setQuery(nextQuery);
    setSubmittedQuery(nextQuery);
    setSearchMode(nextSearchMode);
    setSubmittedSearchMode(nextSearchMode);
    setSelectedProductSkuValues(nextProductSkuValues);
    setAppliedProductSkuValues(nextProductSkuValues);
    setQuickDate(nextQuickDate);
    setAppliedQuickDate(nextQuickDate);
    setDateFrom(nextDateFrom);
    setAppliedDateFrom(nextDateFrom);
    setDateTo(nextDateTo);
    setAppliedDateTo(nextDateTo);
    setQuickStatus(nextQuickStatus);
    setAppliedQuickStatus(nextQuickStatus);

    const nextBranchFilter = normalizeMultiFilterValue(filters.branchFilter);
    const nextOrderFilter = normalizeMultiFilterValue(filters.orderFilter);
    const nextPaymentFilter = normalizeMultiFilterValue(filters.paymentFilter);
    const nextCreatedByFilter = normalizeMultiFilterValue(filters.createdByFilter);
    const nextAssignedStaffFilter = normalizeMultiFilterValue(filters.assignedStaffFilter);
    const nextFulfillmentFilter = normalizeMultiFilterValue(filters.fulfillmentFilter);
    const nextDeliveryStatusFilter = normalizeMultiFilterValue(filters.deliveryStatusFilter);
    const nextSalesChannelFilter = normalizeMultiFilterValue(filters.salesChannelFilter);
    const nextShippingModeFilter = normalizeMultiFilterValue(filters.shippingModeFilter);
    const nextShippingPartnerFilter = normalizeMultiFilterValue(filters.shippingPartnerFilter);
    const nextTrackingFilter = normalizeMultiFilterValue(filters.trackingFilter);
    const nextPrintStatusFilter = normalizeMultiFilterValue(filters.printStatusFilter);
    const nextCodFilter = normalizeMultiFilterValue(filters.codFilter);
    const nextCodReconciliationFilter = normalizeMultiFilterValue(filters.codReconciliationFilter);
    const nextAmountDueFilter = normalizeMultiFilterValue(filters.amountDueFilter);
    const nextItemCountFilter = normalizeMultiFilterValue(filters.itemCountFilter);

    setBranchFilter(nextBranchFilter);
    setAppliedBranchFilter(nextBranchFilter);
    setOrderFilter(nextOrderFilter);
    setAppliedOrderFilter(nextOrderFilter);
    setPaymentFilter(nextPaymentFilter);
    setAppliedPaymentFilter(nextPaymentFilter);
    setCreatedByFilter(nextCreatedByFilter);
    setAppliedCreatedByFilter(nextCreatedByFilter);
    setAssignedStaffFilter(nextAssignedStaffFilter);
    setAppliedAssignedStaffFilter(nextAssignedStaffFilter);
    setFulfillmentFilter(nextFulfillmentFilter);
    setAppliedFulfillmentFilter(nextFulfillmentFilter);
    setDeliveryStatusFilter(nextDeliveryStatusFilter);
    setAppliedDeliveryStatusFilter(nextDeliveryStatusFilter);
    setSalesChannelFilter(nextSalesChannelFilter);
    setAppliedSalesChannelFilter(nextSalesChannelFilter);
    setShippingModeFilter(nextShippingModeFilter);
    setAppliedShippingModeFilter(nextShippingModeFilter);
    setShippingPartnerFilter(nextShippingPartnerFilter);
    setAppliedShippingPartnerFilter(nextShippingPartnerFilter);
    setTrackingFilter(nextTrackingFilter);
    setAppliedTrackingFilter(nextTrackingFilter);
    setPrintStatusFilter(nextPrintStatusFilter);
    setAppliedPrintStatusFilter(nextPrintStatusFilter);
    setCodFilter(nextCodFilter);
    setAppliedCodFilter(nextCodFilter);
    setCodReconciliationFilter(nextCodReconciliationFilter);
    setAppliedCodReconciliationFilter(nextCodReconciliationFilter);
    setAmountDueFilter(nextAmountDueFilter);
    setAppliedAmountDueFilter(nextAmountDueFilter);
    setItemCountFilter(nextItemCountFilter);
    setAppliedItemCountFilter(nextItemCountFilter);
    setFreeTextFilter(nextFreeText);
    setAppliedFreeTextFilter(nextFreeText);
    setSmartSearchInput(nextSmartSearch);
    setSmartSearch(nextSmartSearch);
    setPage(1);
    setShowPresetMenu(false);
    setShowAdvancedFilters(false);
    setActionMessage(`Đã áp dụng bộ lọc mẫu: ${preset.name}`);
  };

  const saveCurrentFilterPreset = () => {
    if (!canManageFilterPresets || typeof window === "undefined") return;

    const name = window.prompt("Đặt tên bộ lọc mẫu", "");
    const safeName = String(name || "").trim();
    if (!safeName) return;

    const nextPreset: OrderFilterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: safeName,
      createdAt: new Date().toISOString(),
      filters: buildCurrentFilterPresetFilters(),
    };

    persistFilterPresets([nextPreset, ...filterPresets.filter((item) => item.name !== safeName)]);
    setShowPresetMenu(false);
    setActionMessage(`Đã lưu bộ lọc mẫu: ${safeName}`);
  };

  const deleteFilterPreset = (presetId: string) => {
    persistFilterPresets(filterPresets.filter((item) => item.id !== presetId));
  };

  const submitOrderSearch = () => {
    applySearchAndFilters();
  };

  const submitUniversalSearch = (overrideQuery?: string) => {
    const nextQuery = (overrideQuery ?? query).trim();
    const nextSmartSearch = smartSearchInput.trim();

    setSearchMode("ALL");
    setSelectedProductSkuValues([]);
    setSubmittedQuery(nextQuery);
    setSubmittedSearchMode("ALL");
    setAppliedProductSkuValues([]);
    setAppliedBranchFilter(branchFilter);
    setAppliedOrderFilter(orderFilter);
    setAppliedPaymentFilter(paymentFilter);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedQuickDate(quickDate);
    setAppliedQuickStatus(quickStatus);

    setAppliedCreatedByFilter(createdByFilter);
    setAppliedAssignedStaffFilter(assignedStaffFilter);
    setAppliedFulfillmentFilter(fulfillmentFilter);
    setAppliedDeliveryStatusFilter(deliveryStatusFilter);
    setAppliedSalesChannelFilter(salesChannelFilter);
    setAppliedShippingModeFilter(shippingModeFilter);
    setAppliedShippingPartnerFilter(shippingPartnerFilter);
    setAppliedTrackingFilter(trackingFilter);
    setAppliedPrintStatusFilter(printStatusFilter);
    setAppliedCodFilter(codFilter);
    setAppliedCodReconciliationFilter(codReconciliationFilter);
    setAppliedAmountDueFilter(amountDueFilter);
    setAppliedItemCountFilter(itemCountFilter);
    setAppliedFreeTextFilter(freeTextFilter.trim());
    setSmartSearch(nextSmartSearch);
    setPage(1);
  };

  const applyQuickStatusFilter = (nextStatus: QuickStatusKey) => {
    setQuickStatus(nextStatus);
    setAppliedQuickStatus(nextStatus);
    setPage(1);
  };

  const toggleQuickStatusFilter = (status: QuickStatusKey) => {
    applyQuickStatusFilter(quickStatus === status ? "ALL" : status);
  };

  const openQuickStatusPage = (status: QuickStatusKey) => {
    if (status === "ALL") return;

    const params = new URLSearchParams();
    params.set("quickStatus", status);
    params.set("cardDate", cardDateFilter);

    const selectedBranchIds = selectedMultiFilterValues(appliedBranchFilter);
    if (selectedBranchIds.length === 1) {
      params.set("branchId", selectedBranchIds[0]);
    }

    const href = `/orders?${params.toString()}`;
    const title = `Đơn hàng · ${QUICK_STATUS_LABELS[status]} · ${CARD_DATE_FILTER_OPTIONS.find((item) => item.key === cardDateFilter)?.label || "Tất cả ngày"}`;

    addWorkspaceTab({
      id: `orders-${status}-${cardDateFilter}-${selectedBranchIds.join("-") || "all"}`,
      title,
      href,
      type: "order",
    });

    window.open(href, "_blank", "noopener,noreferrer");
  };

  const clearQuickStatusFilter = () => {
    applyQuickStatusFilter("ALL");
  };

  const clearOrderSearch = () => {
    setQuery("");
    setSubmittedQuery("");
    setSearchMode("ALL");
    setSubmittedSearchMode("ALL");
    setSelectedProductSkuValues([]);
    setAppliedProductSkuValues([]);
    setPage(1);
  };

  const hasPendingFilterChanges =
    query.trim() !== submittedQuery ||
    searchMode !== submittedSearchMode ||
    !multiFilterEquals(selectedProductSkuValues, appliedProductSkuValues) ||
    !multiFilterEquals(branchFilter, appliedBranchFilter) ||
    !multiFilterEquals(orderFilter, appliedOrderFilter) ||
    !multiFilterEquals(paymentFilter, appliedPaymentFilter) ||
    dateFrom !== appliedDateFrom ||
    dateTo !== appliedDateTo ||
    quickDate !== appliedQuickDate ||
    quickStatus !== appliedQuickStatus ||
    !multiFilterEquals(createdByFilter, appliedCreatedByFilter) ||
    !multiFilterEquals(assignedStaffFilter, appliedAssignedStaffFilter) ||
    !multiFilterEquals(fulfillmentFilter, appliedFulfillmentFilter) ||
    !multiFilterEquals(deliveryStatusFilter, appliedDeliveryStatusFilter) ||
    !multiFilterEquals(salesChannelFilter, appliedSalesChannelFilter) ||
    !multiFilterEquals(shippingModeFilter, appliedShippingModeFilter) ||
    !multiFilterEquals(shippingPartnerFilter, appliedShippingPartnerFilter) ||
    !multiFilterEquals(trackingFilter, appliedTrackingFilter) ||
    !multiFilterEquals(printStatusFilter, appliedPrintStatusFilter) ||
    !multiFilterEquals(codFilter, appliedCodFilter) ||
    !multiFilterEquals(codReconciliationFilter, appliedCodReconciliationFilter) ||
    !multiFilterEquals(amountDueFilter, appliedAmountDueFilter) ||
    !multiFilterEquals(itemCountFilter, appliedItemCountFilter) ||
    freeTextFilter.trim() !== appliedFreeTextFilter ||
    smartSearchInput.trim() !== smartSearch;

  const filteredOrders = useMemo(() => {
    let result = normalizedOrders;

    if (appliedQuickStatus !== "ALL") {
      result = result.filter((o) => {
        switch (appliedQuickStatus) {
          case "WAITING_APPROVE":
            return getDisplayOrderStatus(o) === "NEW";
          case "WAITING_PAYMENT":
            return (
              ["UNPAID", "PARTIAL"].includes(o.paymentStatus) ||
              (o.paymentStatus === "PENDING_COD" && !shouldShowPendingCodReconciliation(o))
            );
          case "WAITING_PACKING":
            return getDisplayOrderStatus(o) === "PACKING";
          case "WAITING_SHIP":
            return ["APPROVED", "PACKING"].includes(getDisplayOrderStatus(o));
          case "DELIVERING":
            return getDisplayOrderStatus(o) === "SHIPPED";
          case "SOON_DELIVERY":
            return isSoonDeliveryOrder(o);
          case "FAIL":
            return isFailedOrder(o);
          case "REDELIVERY":
            return isRedeliveryOrder(o);
          case "LOCAL_DELIVERY":
            return isLocalDeliveryCarrier(o.shipment?.carrier || o._meta.shippingPartner);
          default:
            return true;
        }
      });
    }

    if (!isAllMultiFilter(appliedBranchFilter)) {
      const selectedBranchIds = selectedMultiFilterValues(appliedBranchFilter);
      result = result.filter((o) => selectedBranchIds.includes(String(o.branchId || "")));
    }

    if (!isAllMultiFilter(appliedOrderFilter)) {
      const selectedStatuses = selectedMultiFilterValues(appliedOrderFilter);
      result = result.filter((o) => selectedStatuses.includes(String(getDisplayOrderStatus(o) || "")));
    }

    if (!isAllMultiFilter(appliedPaymentFilter)) {
      const selectedPayments = selectedMultiFilterValues(appliedPaymentFilter);
      result = result.filter((o) =>
        selectedPayments.some((payment) => {
          if (payment === "PENDING_COD") return shouldShowPendingCodReconciliation(o);
          return String(o.paymentStatus || "") === payment;
        }),
      );
    }

    if (!isAllMultiFilter(appliedCreatedByFilter)) {
      result = result.filter((o) => multiFilterIncludes(appliedCreatedByFilter, o._createdByName));
    }

    if (!isAllMultiFilter(appliedAssignedStaffFilter)) {
      const selectedAssignedStaff = selectedMultiFilterValues(appliedAssignedStaffFilter);
      result = result.filter((o) => {
        const assignedRawName = String(o._assignedStaffRawName || "").trim();
        const assignedDisplayName = String(o._assignedStaffName || "").trim();
        return selectedAssignedStaff.some((staff) =>
          staff === "UNASSIGNED" ? !assignedRawName : assignedDisplayName === staff,
        );
      });
    }

    if (!isAllMultiFilter(appliedFulfillmentFilter)) {
      result = result.filter((o) => multiFilterIncludes(appliedFulfillmentFilter, String(o.fulfillmentStatus || "")));
    }

    if (!isAllMultiFilter(appliedDeliveryStatusFilter)) {
      result = result.filter((o) => multiFilterIncludes(appliedDeliveryStatusFilter, shipmentDisplayStatusLabel(o)));
    }

    if (!isAllMultiFilter(appliedSalesChannelFilter)) {
      result = result.filter((o) => multiFilterIncludes(appliedSalesChannelFilter, String(o.salesChannel || "")));
    }

    if (!isAllMultiFilter(appliedShippingModeFilter)) {
      result = result.filter((o) => multiFilterIncludes(appliedShippingModeFilter, o._meta.shippingMode));
    }

    if (!isAllMultiFilter(appliedShippingPartnerFilter)) {
      result = result.filter((o) =>
        multiFilterIncludes(appliedShippingPartnerFilter, o.shipment?.carrier || o._meta.shippingPartner || ""),
      );
    }

    if (!isAllMultiFilter(appliedTrackingFilter)) {
      const selectedTracking = selectedMultiFilterValues(appliedTrackingFilter);
      result = result.filter((o) => {
        const hasTracking = Boolean(String(o.shipment?.trackingCode || "").trim());
        return selectedTracking.some((value) => (value === "HAS" ? hasTracking : !hasTracking));
      });
    }

    if (!isAllMultiFilter(appliedPrintStatusFilter)) {
      const selectedPrintStatuses = selectedMultiFilterValues(appliedPrintStatusFilter);
      result = result.filter((o) => {
        const printed = getOrderPrintCount(o.id) > 0;
        return selectedPrintStatuses.some((value) => (value === "PRINTED" ? printed : !printed));
      });
    }

    if (!isAllMultiFilter(appliedCodFilter)) {
      const selectedCodStatuses = selectedMultiFilterValues(appliedCodFilter);
      result = result.filter((o) => {
        const hasCod = Number(o._codAmount || 0) > 0;
        return selectedCodStatuses.some((value) => (value === "HAS_COD" ? hasCod : !hasCod));
      });
    }

    if (!isAllMultiFilter(appliedCodReconciliationFilter)) {
      const selectedCodReconciliation = selectedMultiFilterValues(appliedCodReconciliationFilter);
      result = result.filter((o) => {
        const status = normalizedCodReconciliationStatusFromOrder(o);
        const done = isOrderCodReconciled(o);

        return selectedCodReconciliation.some((value) => {
          if (value === "RECONCILED") return done;
          if (value === "NOT_RECONCILED") return !done;
          if (value === "MISMATCH") return status === "MISMATCH";
          if (value === "NOT_FOUND") return status === "NOT_FOUND";
          if (value === "SAVED") return status === "SAVED";
          return true;
        });
      });
    }

    if (!isAllMultiFilter(appliedAmountDueFilter)) {
      const selectedAmountDue = selectedMultiFilterValues(appliedAmountDueFilter);
      result = result.filter((o) => {
        const hasDue = Number(o._amountDue || 0) > 0;
        return selectedAmountDue.some((value) => (value === "HAS_DUE" ? hasDue : !hasDue));
      });
    }

    if (!isAllMultiFilter(appliedItemCountFilter)) {
      const selectedItemCount = selectedMultiFilterValues(appliedItemCountFilter);
      result = result.filter((o) => {
        const itemCount = getOrderItemCount(o);
        return selectedItemCount.some((value) => (value === "HAS_ITEMS" ? itemCount > 0 : itemCount <= 0));
      });
    }

    if (appliedProductSkuValues.length) {
      result = result.filter((o) =>
        orderMatchesSelectedProductFilters(o, appliedProductSkuValues),
      );
    }

    const keywords = [submittedQuery, appliedFreeTextFilter]
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (keywords.length) {
      // Tìm nhiều mã vận đơn/GHN/VTP/Aha bằng dấu phẩy: match OR từng mã.
      // VD: GYTPRD6P, GYTPV683 phải trả các đơn có một trong hai mã, không bắt 1 đơn chứa đủ cả 2 mã.
      const keywordTerms = Array.from(
        new Set(keywords.flatMap((keyword) => splitSmartOrderSearchTerms(keyword))),
      );
      const exactCarrierKeywords = ["ALL", "ORDER"].includes(submittedSearchMode)
        ? keywordTerms.filter(isLikelyExactCarrierCode)
        : [];

      if (exactCarrierKeywords.length) {
        const exactCarrierMatches = result.filter((o) =>
          exactCarrierKeywords.some((keyword) =>
            orderMatchesExactCarrierCode(o, keyword),
          ),
        );

        if (exactCarrierMatches.length > 0) {
          result = exactCarrierMatches;
        } else {
          result = result.filter((o) => {
            const branchName = branchLabel(o.branchId);
            return keywordTerms.some((keyword) =>
              orderMatchesKeyword(o, keyword, branchName, submittedSearchMode),
            );
          });
        }
      } else {
        result = result.filter((o) => {
          const branchName = branchLabel(o.branchId);
          return keywords.every((keyword) =>
            orderMatchesKeyword(o, keyword, branchName, submittedSearchMode),
          );
        });
      }
    }

    if (parsedSmartSearch.raw) {
      result = result.filter((o) => {
        const branchName = branchLabel(o.branchId);
        return orderMatchesSmartSearch(o, parsedSmartSearch, branchName);
      });
    }

    return result;
  }, [
    normalizedOrders,
    appliedQuickStatus,
    submittedQuery,
    submittedSearchMode,
    appliedBranchFilter,
    appliedOrderFilter,
    appliedPaymentFilter,
    appliedCreatedByFilter,
    appliedAssignedStaffFilter,
    appliedFulfillmentFilter,
    appliedDeliveryStatusFilter,
    appliedSalesChannelFilter,
    appliedShippingModeFilter,
    appliedShippingPartnerFilter,
    appliedTrackingFilter,
    appliedPrintStatusFilter,
    appliedCodFilter,
    appliedCodReconciliationFilter,
    appliedAmountDueFilter,
    appliedItemCountFilter,
    appliedProductSkuValues,
    appliedFreeTextFilter,
    parsedSmartSearch,
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

  const counts = cardCountsLoaded ? cardCounts : EMPTY_QUICK_STATUS_COUNTS;

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
      throw new Error(detail || "Hủy HVC thất bại.");
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
              `${order.orderCode}: ${err instanceof Error ? err.message : "Lỗi không rõ"
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
              `${order.orderCode}: ${err instanceof Error ? err.message : "Lỗi không rõ"
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

    setConfirmTitle("Huỷ vận chuyển");
    setConfirmDescription(
      `Huỷ HVC cho ${checkedIds.length} đơn đã chọn? Nút này gửi yêu cầu huỷ sang hãng vận chuyển qua endpoint /shipments/:id/cancel nếu đơn đã có mã vận đơn.`,
    );
    setConfirmText("Huỷ HVC");
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
              `${order.orderCode}: ${err instanceof Error ? err.message : "Lỗi không rõ"
              }`,
            );
          }
        }

        await loadOrders();

        if (failed.length === 0) {
          setActionMessage(`Đã huỷ HVC ${successCount} đơn.`);
        } else {
          setActionMessage(
            `Đã huỷ HVC ${successCount} đơn. Lỗi: ${failed.join(" | ")}`,
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
    const range = getQuickDateRange(key);
    const nextFrom = toInputDateValue(range.from);
    const nextTo = toInputDateValue(range.to);
    setQuickDate(key);
    setAppliedQuickDate(key);
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setAppliedDateFrom(nextFrom);
    setAppliedDateTo(nextTo);
    setPage(1);
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
    codReconciliation: "w-[105px]",
    partialReturnOrder: "w-[120px]",
    partialDeliveryOrder: "w-[135px]",
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
    goodsSubtotal: "w-[130px]",
    productDiscount: "w-[170px]",
    goodsAfterDiscount: "w-[210px]",
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
        setBranchFilter([String(value)]);
        break;
      case "createdBy":
        setCreatedByFilter([safeValue]);
        break;
      case "salesChannel":
        setSalesChannelFilter([safeValue]);
        break;
      case "shippingMode":
        setShippingModeFilter([safeValue]);
        break;
      case "shippingPartner":
        setShippingPartnerFilter([safeValue]);
        break;
      case "fulfillmentStatus":
        setFulfillmentFilter([safeValue]);
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
      : key === "itemCount" || key === "codReconciliation" || key === "partialReturnOrder" || key === "partialDeliveryOrder"
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
              label={orderStatusLabel(getDisplayOrderStatus(order))}
              tone={orderStatusTone(getDisplayOrderStatus(order))}
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
              title={`Thanh toán: ${orderPaymentStatusLabel(order)}`}
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
              label={orderPaymentStatusLabel(order)}
              tone={orderPaymentStatusTone(order)}
            />
          </td>
        );
      case "codReconciliation":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center"
          >
            <CodReconciliationDot order={order} />
          </td>
        );
      case "partialReturnOrder":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center"
          >
            <ListDot
              active={hasPartialReturnOrderInList(order, partialReturnOrderCodeSet)}
              title={hasPartialReturnOrderInList(order, partialReturnOrderCodeSet) ? "Có đơn trả hàng _PR" : "Chưa có đơn trả hàng _PR"}
            />
          </td>
        );
      case "partialDeliveryOrder":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-center"
          >
            <ListDot
              active={isPartialDeliveryListOrder(order)}
              title={isPartialDeliveryListOrder(order) ? "Đơn giao hàng 1 phần" : "Không phải đơn giao hàng 1 phần"}
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
              state={stockOutDotState(getDisplayOrderStatus(order))}
              title={`Xuất kho: ${orderStatusLabel(getDisplayOrderStatus(order))}`}
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
                setBranchFilter(order.branchId ? [order.branchId] : ["ALL"]);
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
                setCreatedByFilter(order._createdByName ? [order._createdByName] : ["ALL"]);
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
      case "goodsSubtotal":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
          >
            {currency(order._goodsSubtotal)}
          </td>
        );
      case "productDiscount":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
          >
            {order._productDiscount ? `-${currency(order._productDiscount)}` : currency(0)}
          </td>
        );
      case "goodsAfterDiscount":
        return (
          <td
            key={key}
            className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap"
          >
            {currency(order._goodsAfterDiscount)}
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

  const cardDateLabel =
    CARD_DATE_FILTER_OPTIONS.find((item) => item.key === cardDateFilter)?.label ||
    "Tất cả ngày";

  const renderCardDateFilters = (compact = false) => (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "justify-end"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
        Bộ lọc card
      </span>
      {CARD_DATE_FILTER_OPTIONS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setCardDateFilter(item.key)}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
            cardDateFilter === item.key
              ? "border-white bg-white text-neutral-950 shadow-sm"
              : "border-white/15 bg-white/5 text-neutral-300 hover:border-white/35 hover:bg-white/10"
          }`}
        >
          {item.label}
        </button>
      ))}
      <span className="text-[10px] font-medium text-neutral-500">
        {cardCountsLoading ? "Đang cập nhật..." : `Đang tính: ${cardDateLabel}`}
      </span>
    </div>
  );

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
          <div className="mb-3">{renderCardDateFilters(true)}</div>
          <div className="grid grid-cols-2 gap-2">
            {mobileSummaryCards.map((item) => {
              const active = quickStatus === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openQuickStatusPage(item.key)}
                  className={`rounded-[22px] border p-3 text-left transition ${active
                      ? "border-neutral-900 bg-neutral-950 text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-900"
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-sm ${active
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700"
                        }`}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${active ? "text-white/70" : "text-neutral-500"
                        }`}
                    >
                      Xem
                    </span>
                  </div>
                  <p
                    className={`mt-3 text-[12px] font-medium ${active ? "text-white/75" : "text-neutral-600"
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
              onClick={clearQuickStatusFilter}
              className="mt-3 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700"
            >
              Bỏ lọc nhanh
            </button>
          ) : null}
        </Panel>

        <Panel className="p-3">
          <div className="grid gap-2 sm:grid-cols-[190px_1fr]">
            <select
              className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] font-semibold outline-none"
              value={searchMode}
              onChange={(e) => {
                const nextMode = e.target.value as OrderSearchMode;
                setSearchMode(nextMode);
                if (nextMode !== "PRODUCT") setSelectedProductSkuValues([]);
              }}
            >
              {ORDER_SEARCH_MODE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {searchMode === "PRODUCT" ? (
              <ProductSkuSearchBox
                value={query}
                onChange={setQuery}
                selectedValues={selectedProductSkuValues}
                onToggleValue={toggleSelectedProductSku}
                onClearSelected={() => setSelectedProductSkuValues([])}
                options={visibleProductSkuOptions}
                placeholder="Gõ QS28/AP833 để xổ SKU con..."
                onEnter={(value) => {
                  setQuery(value);
                  applySearchAndFilters(value);
                }}
              />
            ) : (
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-[15px] outline-none"
                placeholder={
                  searchMode === "PHONE"
                    ? "Nhập SĐT khách..."
                    : searchMode === "ORDER"
                      ? "Nhập mã đơn, mã GHN/vận đơn..."
                      : "Tìm mã đơn, mã GHN, SĐT, khách, SKU, địa chỉ..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = e.currentTarget.value.trim();
                    setQuery(value);
                    applySearchAndFilters(value);
                  }
                }}
              />
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {mobileQuickDates.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => applyQuickDate(item.key)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold ${quickDate === item.key
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <MultiFilterSelect
              className="min-w-0"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchOptions}
              allLabel="Tất cả chi nhánh"
              disabled={
                !!currentUser?.branchId &&
                currentUser?.role !== "admin" &&
                currentUser?.role !== "owner"
              }
            />

            <MultiFilterSelect
              className="min-w-0"
              value={paymentFilter}
              onChange={setPaymentFilter}
              allLabel="Tất cả thanh toán"
              options={[
                { value: "UNPAID", label: "Chưa thanh toán" },
                { value: "PARTIAL", label: "Một phần" },
                { value: "PAID", label: "Đã thanh toán" },
                { value: "PENDING_COD", label: "Chờ đối soát COD" },
                { value: "REFUNDED", label: "Hoàn tiền" },
                { value: "FAILED", label: "Lỗi thanh toán" },
              ]}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={submitOrderSearch}
              className="rounded-2xl bg-neutral-900 px-4 py-3 text-xs font-semibold text-white"
            >
              Tìm / Áp dụng lọc
            </button>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-2xl border border-neutral-300 px-4 py-3 text-xs font-semibold text-neutral-700"
            >
              Làm mới
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              Trang {page}/{totalPages} · {totalItems} đơn
            </span>
            {hasPendingFilterChanges ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                Chưa áp dụng
              </span>
            ) : null}
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
                          label={orderStatusLabel(getDisplayOrderStatus(order))}
                          tone={orderStatusTone(getDisplayOrderStatus(order))}
                        />
                        <span className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-1">
                          <DotStatus
                            state={stockOutDotState(getDisplayOrderStatus(order))}
                            title={`Xuất kho: ${orderStatusLabel(getDisplayOrderStatus(order))}`}
                          />
                          <span className="text-[10px] font-semibold text-neutral-500">
                            XK
                          </span>
                        </span>
                        <StatusBadge
                          label={orderPaymentStatusLabel(order)}
                          tone={orderPaymentStatusTone(order)}
                        />
                        <span className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-1">
                          <DotStatus
                            state={paymentDotState(order.paymentStatus)}
                            title={`Thanh toán: ${orderPaymentStatusLabel(order)}`}
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
          <Panel className="!border-neutral-950 !bg-neutral-950 px-3 py-2 text-white">
            <div className="mb-2 flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                  Trạng thái vận hành
                </p>

              </div>
              {renderCardDateFilters()}
            </div>
            <div className="grid gap-1.5 md:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-9">
              <SummaryCard
                title="Chờ duyệt"
                value={counts.waitingApprove}
                active={quickStatus === "WAITING_APPROVE"}
                icon="✓"
                onClick={() => openQuickStatusPage("WAITING_APPROVE")}
              />
              <SummaryCard
                title="Chờ thanh toán"
                value={counts.waitingPayment}
                active={quickStatus === "WAITING_PAYMENT"}
                icon="₫"
                onClick={() => openQuickStatusPage("WAITING_PAYMENT")}
              />
              <SummaryCard
                title="Chờ đóng gói"
                value={counts.waitingPacking}
                active={quickStatus === "WAITING_PACKING"}
                icon="□"
                onClick={() => openQuickStatusPage("WAITING_PACKING")}
              />
              <SummaryCard
                title="Chờ gửi hãng"
                value={counts.waitingShip}
                active={quickStatus === "WAITING_SHIP"}
                icon="→"
                onClick={() => openQuickStatusPage("WAITING_SHIP")}
              />
              <SummaryCard
                title="Đang giao hàng"
                value={counts.delivering}
                active={quickStatus === "DELIVERING"}
                icon="↗"
                onClick={() => openQuickStatusPage("DELIVERING")}
              />
              <SummaryCard
                title="Sắp giao"
                value={counts.soonDelivery}
                active={quickStatus === "SOON_DELIVERY"}
                icon="◔"
                onClick={() => openQuickStatusPage("SOON_DELIVERY")}
              />
              <SummaryCard
                title="Đơn giao không thành công"
                value={counts.failed}
                active={quickStatus === "FAIL"}
                icon="!"
                onClick={() => openQuickStatusPage("FAIL")}
              />
              <SummaryCard
                title="Đơn giao lại"
                value={counts.redelivery}
                active={quickStatus === "REDELIVERY"}
                icon="↺"
                onClick={() => openQuickStatusPage("REDELIVERY")}
              />
              <SummaryCard
                title="Nội thành"
                value={counts.localDelivery}
                active={quickStatus === "LOCAL_DELIVERY"}
                icon="⚡"
                onClick={() => openQuickStatusPage("LOCAL_DELIVERY")}
              />
            </div>

            {quickStatus !== "ALL" ? (
              <div className="mt-2">
                <Button onClick={clearQuickStatusFilter} size="sm">
                  Bỏ lọc nhanh
                </Button>
              </div>
            ) : null}
          </Panel>


          <Panel className="px-2 py-1.5">
            <div className="grid gap-1.5 lg:grid-cols-[minmax(420px,1fr)_100px_auto_auto] lg:items-center">
              <input
                className="h-8 rounded-xl border border-neutral-300 px-3 text-xs outline-none focus:border-neutral-900"
                placeholder="Tìm mã đơn, mã GHN/vận đơn, SĐT, khách, SKU, địa chỉ... Enter để tìm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = e.currentTarget.value.trim();
                    setQuery(value);
                    submitUniversalSearch(value);
                  }
                }}
              />

              <Button onClick={() => submitUniversalSearch()} variant="primary" size="md">
                Tìm
              </Button>

              {canManageFilterPresets ? (
                <div className="relative" ref={presetMenuRef}>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowPresetMenu((v) => !v)}
                  >
                    Bộ lọc mẫu
                  </Button>

                  {showPresetMenu ? (
                    <div className="absolute right-0 top-[42px] z-[95] w-[320px] rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl">
                      <div className="mb-2 flex items-center justify-between gap-2 px-2 py-1">
                        <p className="text-xs font-semibold text-neutral-900">Bộ lọc mẫu</p>
                        <button
                          type="button"
                          onClick={saveCurrentFilterPreset}
                          className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          Lưu mẫu
                        </button>
                      </div>

                      {filterPresets.length ? (
                        <div className="max-h-[320px] space-y-1 overflow-y-auto">
                          {filterPresets.map((preset) => (
                            <div
                              key={preset.id}
                              className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-neutral-50"
                            >
                              <button
                                type="button"
                                onClick={() => applyFilterPreset(preset)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className="block truncate text-xs font-semibold text-neutral-900">
                                  {preset.name}
                                </span>
                                <span className="mt-0.5 block truncate text-[10px] text-neutral-500">
                                  {preset.filters.quickDate !== "all"
                                    ? CARD_DATE_FILTER_OPTIONS.find((item) => item.key === preset.filters.quickDate)?.label
                                    : "Tất cả ngày"}
                                  {preset.filters.quickStatus !== "ALL"
                                    ? ` · ${QUICK_STATUS_LABELS[preset.filters.quickStatus]}`
                                    : ""}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFilterPreset(preset.id)}
                                className="shrink-0 rounded-full border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:border-red-200 hover:text-red-600"
                              >
                                Xoá
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-500">
                          Chưa có mẫu. Chọn bộ lọc rồi bấm “Lưu mẫu”.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                {submittedQuery ? (
                  <Button onClick={clearOrderSearch} size="sm">
                    Xóa tìm
                  </Button>
                ) : null}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                >
                  {showAdvancedFilters ? "Ẩn bộ lọc nâng cao" : "Bộ lọc nâng cao"}
                  {activeAdvancedFilterCount ? ` (${activeAdvancedFilterCount})` : ""}
                </Button>

                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                  {visibleOrders.length} / {totalItems} đơn
                </span>
              </div>
            </div>

            {hasPendingFilterChanges ? (
              <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
                Có thay đổi chưa áp dụng · bấm Tìm hoặc Enter
              </div>
            ) : null}

            {showAdvancedFilters ? (
              <div className="mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <SmallChip active={quickDate === "all"} onClick={() => applyQuickDate("all")}>Tất cả</SmallChip>
                    <SmallChip active={quickDate === "today"} onClick={() => applyQuickDate("today")}>Hôm nay</SmallChip>
                    <SmallChip active={quickDate === "yesterday"} onClick={() => applyQuickDate("yesterday")}>Hôm qua</SmallChip>
                    <SmallChip active={quickDate === "7d"} onClick={() => applyQuickDate("7d")}>7 ngày</SmallChip>
                    <SmallChip active={quickDate === "30d"} onClick={() => applyQuickDate("30d")}>30 ngày</SmallChip>
                    <SmallChip active={quickDate === "month"} onClick={() => applyQuickDate("month")}>Tháng này</SmallChip>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canManageFilterPresets ? (
                      <Button onClick={saveCurrentFilterPreset} size="sm">
                        Lưu bộ lọc mẫu
                      </Button>
                    ) : null}
                    {canExportOrderExcel ? (
                      <Button onClick={() => setExportOpen(true)} size="sm" variant="primary">
                        Xuất Excel
                      </Button>
                    ) : null}
                  <div className="relative" ref={columnMenuRef}>
                    <Button onClick={() => setShowColumnMenu((v) => !v)} size="md">
                      Cột hiển thị
                    </Button>

                                    {showColumnMenu ? (
                  <div className="absolute right-0 top-[44px] z-[90] w-[min(1120px,calc(100vw-72px))] rounded-[24px] border border-neutral-200 bg-neutral-50 p-3 shadow-2xl">
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
                              className={`grid grid-cols-[18px_18px_minmax(0,1fr)_44px] items-center gap-1.5 rounded-2xl border px-2 py-2 text-[11px] transition ${visible
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
                    <Button onClick={() => void loadOrders()} size="sm">
                      Làm mới
                    </Button>
                    {activeAdvancedFilterCount ? (
                      <Button variant="secondary" size="sm" onClick={clearAdvancedFilters}>
                        Xóa lọc nâng cao
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Từ ngày</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setQuickDate("all");
                        setDateFrom(e.target.value);
                      }}
                      className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Đến ngày</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setQuickDate("all");
                        setDateTo(e.target.value);
                      }}
                      className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs outline-none"
                    />
                  </label>

                  <MultiFilterSelect
                    value={branchFilter}
                    onChange={setBranchFilter}
                    options={branchOptions}
                    allLabel="Tất cả chi nhánh"
                    disabled={
                      !!currentUser?.branchId &&
                      currentUser?.role !== "admin" &&
                      currentUser?.role !== "owner"
                    }
                  />

                  <MultiFilterSelect
                    value={orderFilter}
                    onChange={setOrderFilter}
                    allLabel="Tất cả trạng thái đơn"
                    options={ORDER_STATUS_FILTER_OPTIONS.filter((item) => item.value !== "ALL")}
                  />

                  <MultiFilterSelect
                    value={paymentFilter}
                    onChange={setPaymentFilter}
                    allLabel="Tất cả thanh toán"
                    options={[
                      { value: "UNPAID", label: "Chưa thanh toán" },
                      { value: "PARTIAL", label: "Thanh toán một phần" },
                      { value: "PAID", label: "Đã thanh toán" },
                      { value: "PENDING_COD", label: "Chờ đối soát COD" },
                      { value: "REFUNDED", label: "Đã hoàn tiền" },
                      { value: "FAILED", label: "Thanh toán lỗi" },
                    ]}
                  />

                  <input
                    className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-xs outline-none"
                    placeholder="Lọc mọi thông tin trong bảng..."
                    value={freeTextFilter}
                    onChange={(e) => setFreeTextFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitUniversalSearch();
                      }
                    }}
                  />

                  <MultiFilterSelect
                    value={createdByFilter}
                    onChange={setCreatedByFilter}
                    allLabel="Tất cả nhân viên tạo đơn"
                    options={createdByOptions.map((name) => ({ value: name, label: name }))}
                  />

                  <MultiFilterSelect
                    value={assignedStaffFilter}
                    onChange={setAssignedStaffFilter}
                    allLabel="Tất cả nhân viên phụ trách"
                    options={[
                      { value: "UNASSIGNED", label: "Chưa gán nhân viên" },
                      ...assignedStaffOptions.map((name) => ({ value: name, label: name })),
                    ]}
                  />

                  <MultiFilterSelect
                    value={fulfillmentFilter}
                    onChange={setFulfillmentFilter}
                    allLabel="Tất cả giao vận"
                    options={[
                      { value: "UNFULFILLED", label: "Chưa giao" },
                      { value: "PROCESSING", label: "Đang chuẩn bị" },
                      { value: "PARTIAL", label: "Một phần" },
                      { value: "FULFILLED", label: "Đã giao vận / hoàn tất" },
                      { value: "RETURNED", label: "Trả hàng" },
                    ]}
                  />

                  <MultiFilterSelect
                    value={deliveryStatusFilter}
                    onChange={setDeliveryStatusFilter}
                    allLabel="Tất cả trạng thái giao hàng / vận đơn"
                    options={deliveryStatusOptions.map((status) => ({ value: status, label: status }))}
                  />

                  <MultiFilterSelect
                    value={salesChannelFilter}
                    onChange={setSalesChannelFilter}
                    allLabel="Tất cả kênh bán"
                    options={salesChannelOptions.map((channel) => ({ value: channel, label: channel }))}
                  />

                  <MultiFilterSelect
                    value={shippingModeFilter}
                    onChange={setShippingModeFilter}
                    allLabel="Tất cả cách giao"
                    options={shippingModeOptions.map((mode) => ({ value: mode, label: mode }))}
                  />

                  <MultiFilterSelect
                    value={shippingPartnerFilter}
                    onChange={setShippingPartnerFilter}
                    allLabel="Tất cả đơn vị vận chuyển"
                    options={shippingPartnerOptions.map((partner) => ({ value: partner, label: partner }))}
                  />

                  <MultiFilterSelect
                    value={trackingFilter}
                    onChange={setTrackingFilter}
                    allLabel="Tất cả mã vận đơn"
                    options={[
                      { value: "HAS", label: "Có mã vận đơn" },
                      { value: "NONE", label: "Chưa có mã vận đơn" },
                    ]}
                  />

                  <MultiFilterSelect
                    value={printStatusFilter}
                    onChange={setPrintStatusFilter}
                    allLabel="Tất cả trạng thái in tem"
                    options={[
                      { value: "PRINTED", label: "Đã in tem" },
                      { value: "NOT_PRINTED", label: "Chưa in tem" },
                    ]}
                  />

                  <MultiFilterSelect
                    value={codFilter}
                    onChange={setCodFilter}
                    allLabel="Tất cả COD"
                    options={[
                      { value: "HAS_COD", label: "Có thu hộ COD" },
                      { value: "NO_COD", label: "Không COD" },
                    ]}
                  />

                  <MultiFilterSelect
                    value={codReconciliationFilter}
                    onChange={setCodReconciliationFilter}
                    allLabel="Tất cả đối soát COD"
                    options={[
                      { value: "RECONCILED", label: "Đã đối soát COD" },
                      { value: "NOT_RECONCILED", label: "Chưa đối soát COD" },
                      { value: "MISMATCH", label: "Lệch đối soát" },
                      { value: "NOT_FOUND", label: "Không tìm thấy trong phiên GHN" },
                      { value: "SAVED", label: "Đã lưu đối soát" },
                    ]}
                  />

                  <MultiFilterSelect
                    value={amountDueFilter}
                    onChange={setAmountDueFilter}
                    allLabel="Tất cả công nợ khách"
                    options={[
                      { value: "HAS_DUE", label: "Còn phải thu" },
                      { value: "NO_DUE", label: "Không còn phải thu" },
                    ]}
                  />

                  <MultiFilterSelect
                    value={itemCountFilter}
                    onChange={setItemCountFilter}
                    allLabel="Tất cả dòng sản phẩm"
                    options={[
                      { value: "HAS_ITEMS", label: "Có sản phẩm" },
                      { value: "NO_ITEMS", label: "Thiếu sản phẩm" },
                    ]}
                  />
                </div>

                <div className="mt-2 grid gap-2 xl:grid-cols-[1fr_auto]">
                  <textarea
                    className="min-h-[42px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                    placeholder="Tìm thông minh / tìm nhiều đơn: ORD-A, ORD-B hoặc mã GHN cách nhau bằng dấu phẩy..."
                    value={smartSearchInput}
                    onChange={(e) => setSmartSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitUniversalSearch();
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => submitUniversalSearch()}>
                      Áp dụng lọc
                    </Button>
                    <Button size="sm" onClick={() => setShowSmartSearchHelp((v) => !v)}>
                      Hướng dẫn
                    </Button>
                  </div>
                </div>

                {showSmartSearchHelp ? (
                  <div className="mt-2 rounded-2xl border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 shadow-sm">
                    <p className="font-semibold text-neutral-900">Hướng dẫn tìm kiếm thông minh</p>
                    <p className="mt-1">Tìm nhiều đơn cùng lúc: nhập <b>ORD-A, ORD-B, ORD-C</b> hoặc mỗi mã một dòng.</p>
                    <p>Tìm theo vận đơn: nhập mã GHN / Viettel Post / AhaMove.</p>
                    <p>Tìm theo nhân viên + thời gian + trạng thái: nhập <b>Nguyễn Văn A tháng này hoàn thành</b>.</p>
                    <p>Nhấn <b>Enter</b> hoặc nút <b>Tìm</b> để áp dụng. Giữ <b>Shift + Enter</b> để xuống dòng.</p>
                  </div>
                ) : null}

                {smartSearch.trim() ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-neutral-600">
                      Đang áp dụng tìm thông minh
                      {parsedSmartSearch.hasMultiTerms
                        ? `: ${parsedSmartSearch.terms.length} mã`
                        : parsedSmartSearch.staffName
                          ? `: ${parsedSmartSearch.staffName}`
                          : ""}
                    </p>
                    <Button size="sm" onClick={clearSmartSearch}>
                      Xóa tìm thông minh
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>

          {checkedIds.length ? (
            <Panel className="border-neutral-200 bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 pr-2">
                  <span className="inline-flex h-8 min-w-[92px] items-center justify-center rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white">
                    Đã chọn {checkedIds.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCheckedIds([])}
                    className="h-8 min-w-[86px] rounded-full border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Bỏ chọn
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-3">
                  {canApproveOrder ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkApprove()}
                      disabled={savingOrderStatus}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Duyệt đơn
                    </button>
                  ) : null}

                  {canPackShipOrder ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkSendToCarrier()}
                      disabled={savingOrderStatus}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Gửi HVC
                    </button>
                  ) : null}

                  {canCreateOrder && singleCheckedOrder ? (
                    <button
                      type="button"
                      onClick={() => copyOrderToNewTab(singleCheckedOrder)}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50"
                    >
                      Sao chép
                    </button>
                  ) : null}

                  {canRedeliverySelected && singleCheckedOrder ? (
                    <button
                      type="button"
                      onClick={() => openOrderInNewTab(singleCheckedOrder, "redelivery")}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50"
                    >
                      Giao lại
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={openAssignDialog}
                    disabled={assigningOrders}
                    className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Gán NV
                  </button>

                  <div className="relative" ref={printMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowPrintMenu((v) => !v)}
                      className="h-9 min-w-[124px] rounded-2xl border-2 border-neutral-900 bg-white px-4 text-xs font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
                    >
                      In đơn
                    </button>

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

                  {canCancelOrder ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkInternalCancel()}
                      disabled={savingOrderStatus}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Huỷ nội bộ
                    </button>
                  ) : null}

                  {canCancelOrder ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkCancel()}
                      disabled={savingOrderStatus}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Huỷ HVC
                    </button>
                  ) : null}

                  {canDeleteOrder ? (
                    <button
                      type="button"
                      onClick={() => void handleBulkDelete()}
                      disabled={deletingOrders}
                      className="h-9 min-w-[112px] rounded-2xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingOrders ? "Đang xoá..." : "Xoá đơn"}
                    </button>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}

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
              className={`orders-table-scroll-hidden w-full overflow-auto scroll-smooth ${isDraggingTable ? "cursor-grabbing select-none" : "cursor-grab"
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
                            {(() => {
                              const syncIndicator = getShipmentSyncIndicator(order);
                              return (
                                <div className="flex justify-end">
                                  <div className="flex flex-col items-end gap-2 whitespace-nowrap">
                                    <div
                                      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-2 py-1 text-[10px] font-semibold text-neutral-600"
                                      title={syncIndicator.label}
                                      aria-label={syncIndicator.label}
                                    >
                                      <span
                                        className={`h-3 w-3 rounded-full border ${syncIndicator.tone} shadow-sm`}
                                      />
                                      <span>Đồng bộ GHN</span>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                </div>
                              );
                            })()}
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
                {!assignableStaffList.length ? (
                  <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    Chưa tải được danh sách nhân viên nhận đơn. Kiểm tra quyền orders.edit hoặc endpoint /orders/assignable-staff trên core.
                  </p>
                ) : null}
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
                  className={`rounded-full px-3 py-1 font-medium ${checkedIds.length
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
                  Kết quả lọc: {!isAllMultiFilter(appliedCodReconciliationFilter) ? totalItems : visibleOrders.length} dòng
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
                      className={`h-9 min-w-9 rounded-xl border px-3 text-xs font-semibold transition ${pageNumber === page
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
                          label={orderPaymentStatusLabel(quickViewOrder)}
                          tone={orderPaymentStatusTone(quickViewOrder)}
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
