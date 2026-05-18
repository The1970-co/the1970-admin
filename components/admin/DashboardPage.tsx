"use client";

import React, { useEffect, useMemo, useState } from "react";

type Tone = "safe" | "warning" | "critical";
type WarRoomTab = "realtime" | "7days" | "forecast";
type DecisionMode = "profit" | "growth" | "inventory";
type DashboardRange = "today" | "yesterday" | "7d" | "10d" | "30d" | "custom";
type ProductFulfillmentFilter = "all" | "shipped" | "unshipped";
type ProductReportSortKey =
  | "quantity"
  | "revenue"
  | "orderCount"
  | "shippedQty"
  | "unshippedQty";
type SortDirection = "asc" | "desc";

type ProductReportOrderDetail = {
  orderId: string;
  orderCode: string;
  customerName: string;
  source: string;
  group: "POS" | "Facebook" | "Khác";
  status: string;
  paymentStatus: string;
  quantity: number;
  revenue: number;
};

type ProductOrderReportItem = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  name: string;
  sku?: string | null;
  meta?: string | null;
  orderCount: number;
  quantity: number;
  revenue: number;
  shippedQty: number;
  unshippedQty: number;
  shippedOrderCount?: number;
  unshippedOrderCount?: number;
  actionUrl?: string;
  productName?: string | null;
  variantName?: string | null;
  size?: string | null;
  color?: string | null;
  avgOrderValue?: number;
  orderCodes?: string[];
  customerNames?: string[];
  sources?: string[];
  orderDetails?: ProductReportOrderDetail[];
};

type ProductOrderReportApi = {
  success?: boolean;
  rows?: Array<Partial<ProductOrderReportItem> & Record<string, any>>;
  items?: Array<Partial<ProductOrderReportItem> & Record<string, any>>;
  data?: Array<Partial<ProductOrderReportItem> & Record<string, any>>;
  summary?: {
    productCount?: number;
    orderCount?: number;
    quantity?: number;
    revenue?: number;
  };
};

type DashboardOrderLine = {
  id?: string | null;
  productId?: string | null;
  variantId?: string | null;
  productName?: string | null;
  variantName?: string | null;
  name?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  qty?: number | string | null;
  price?: number | string | null;
  unitPrice?: number | string | null;
  salePrice?: number | string | null;
  finalPrice?: number | string | null;
  total?: number | string | null;
  lineTotal?: number | string | null;
  amount?: number | string | null;
  totalAmount?: number | string | null;
  finalAmount?: number | string | null;
  status?: string | null;
  fulfillmentStatus?: string | null;
  exportedQty?: number | string | null;
  shippedQty?: number | string | null;
};

type DashboardOrderRow = {
  id?: string | null;
  code?: string | null;
  orderCode?: string | null;
  customerName?: string | null;
  customer?: { name?: string | null; phone?: string | null } | null;
  phone?: string | null;
  status?: string | null;
  fulfillmentStatus?: string | null;
  deliveryStatus?: string | null;
  shippingStatus?: string | null;
  shipmentStatus?: string | null;
  trackingStatus?: string | null;
  carrierStatus?: string | null;
  carrierStatusName?: string | null;
  ghnStatus?: string | null;
  codStatus?: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  paymentStatus?: string | null;
  salesChannel?: string | null;
  channel?: string | null;
  orderType?: string | null;
  finalAmount?: number | string | null;
  totalAmount?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  shipment?: {
    id?: string | null;
    carrier?: string | null;
    trackingCode?: string | null;
    shippingStatus?: string | null;
    partnerStatus?: string | null;
    ahamoveStatus?: string | null;
    ahamoveSubStatus?: string | null;
    updatedAt?: string | null;
  } | null;
  ahamoveStatus?: string | null;
  ahamoveSubStatus?: string | null;
  items?: DashboardOrderLine[];
  orderItems?: DashboardOrderLine[];
  lines?: DashboardOrderLine[];
  orderLines?: DashboardOrderLine[];
  details?: DashboardOrderLine[];
};

type OrderChannelBreakdown = {
  total: number;
  pos: number;
  cod: number;
  other: number;
  shippedSuccess: number;
  totalAmount: number;
  posAmount: number;
  codAmount: number;
  otherAmount: number;
  shippedSuccessAmount: number;
  orders: DashboardOrderRow[];
};

type WarRoomDeliveryRevenueApi = {
  orderCreated?: {
    total?: number;
    amount?: number;
    pos?: { orders?: number; amount?: number };
    facebook?: { orders?: number; amount?: number };
    other?: { orders?: number; amount?: number };
  };
  revenueSuccess?: {
    totalOrders?: number;
    totalAmount?: number;
    pos?: { orders?: number; amount?: number };
    facebookDelivered?: { orders?: number; amount?: number };
    otherDelivered?: { orders?: number; amount?: number };
  };
  createdOrders?: DashboardOrderRow[];
  successOrders?: DashboardOrderRow[];
  orders?: DashboardOrderRow[];
};

type DashboardData = {
  hero: {
    status: Tone;
    title: string;
    subtitle: string;
    chips: string[];
    autoMode: "SAFE" | "SEMI" | "LIVE";
    metaMode: "DRY RUN" | "LIVE" | "DISCONNECTED";
    metaAccount: string;
    scheduler: { label: string; times: string[] };
  };
  warningSummary: {
    level: Tone;
    title: string;
    subtitle: string;
    revenue: string;
    roas: string;
    inventory: string;
  };
  filters: {
    range: string;
    channel: string;
    warehouse: string;
  };
  decisionCards: Array<{
    id: string;
    eyebrow: string;
    title: string;
    desc: string;
    source: string;
    score: string;
    tag: string;
    tone: Tone;
    actionUrl?: string;
    actionType?: string;
    variantId?: string;
    productId?: string;
  }>;
  commandCenter: {
    title: string;
    subtitle: string;
  };
  insightRow: Array<{
    id: string;
    title: string;
    desc: string;
    tone: Tone;
    badge: string;
  }>;
  realtime: {
    delta: string;
    deltaPct: string;
    checkoutPurchase: string;
    chokeLabel: string;
    lowStock: string[];
    posOrders?: number;
    codOrders?: number;
  };
  kpis: Array<{ id: string; label: string; value: string; delta: string }>;
  dailyRows: Array<{
    day: string;
    date?: string;
    displayDate?: string;
    note: string;
    revenue: string;
    cost?: string;
    adsCost?: string;
    profit: string;
    operatingCost?: string;
    netProfit?: string;
    orders: string;
    roas: string;
    compare: string;
    positive?: boolean;
    isToday?: boolean;
    posOrders?: number;
    codOrders?: number;
    raw?: {
      revenue?: number;
      cost?: number;
      grossProfit?: number;
      adsCost?: number;
      profit?: number;
      operatingCost?: number;
      netProfit?: number;
      orders?: number;
    };
  }>;
  drilldown: Array<{ label: string; value: string; tone?: "dark" | "mint" }>;
  funnel: Array<{ label: string; value: string; width: string }>;
  moneyFlow: Array<{
    channel: string;
    text: string;
    badge: string;
    tone: "green" | "amber" | "red";
  }>;
  topProducts: Array<{
    rank: number;
    name: string;
    meta: string;
    qty: string;
    revenue: string;
    actionUrl?: string;
    variantId?: string | null;
    productId?: string | null;
  }>;
  channelRevenue: Array<{ name: string; width: string; value: string }>;
  warehouseMix: Array<{ name: string; value: string; note: string }>;
  quickInsights: string[];
  floatingApproval: { count: string; title: string; subtitle: string };
};

type DashboardOverviewApi = {
  success?: boolean;
  branchId?: string;
  cards?: {
    revenue?: number;
    totalOrders?: number;
    newOrders?: number;
    completedOrders?: number;
    cancelledOrders?: number;
    productCount?: number;
    variantCount?: number;
    availableQty?: number;
    reservedQty?: number;
    incomingQty?: number;
    lowStockItems?: number;
    outOfStockItems?: number;
    pendingTransfers?: number;
    profit?: number;
    profitLabel?: string;
    totalCost?: number;
    totalAdsCost?: number;
    posOrders?: number;
    posOrderCount?: number;
    retailOrders?: number;
    codOrders?: number;
    codOrderCount?: number;
    shippingOrders?: number;
    onlineOrders?: number;
    rawLowStockPool?: number;
    rawOutOfStockPool?: number;
  };
  dailyRows?: DashboardData["dailyRows"];
  decisionCards?: DashboardData["decisionCards"];
  insightRow?: DashboardData["insightRow"];
  realtime?: DashboardData["realtime"];
  kpis?: DashboardData["kpis"];
  drilldown?: DashboardData["drilldown"];
  topProducts?: DashboardData["topProducts"];
  channelRevenue?: DashboardData["channelRevenue"];
  warehouseMix?: DashboardData["warehouseMix"];
  quickInsights?: string[];
  moneyFlow?: DashboardData["moneyFlow"];
  funnel?: DashboardData["funnel"];
  floatingApproval?: DashboardData["floatingApproval"];
  hero?: Partial<DashboardData["hero"]>;
  warningSummary?: Partial<DashboardData["warningSummary"]>;
  smartAlerts?: Array<any>;
  recentOrders?: Array<{
    id: string;
    code?: string | null;
    customerName?: string | null;
    phone?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    fulfillmentStatus?: string | null;
    finalAmount?: number | string | null;
    salesChannel?: string | null;
    branchId?: string | null;
    createdAt?: string | null;
  }>;
};

const DASHBOARD_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  ""
).replace(/\/$/, "");

const DASHBOARD_RANGE_OPTIONS: Array<{ id: DashboardRange; label: string }> = [
  { id: "today", label: "Hôm nay" },
  { id: "yesterday", label: "Hôm qua" },
  { id: "7d", label: "7 ngày" },
  { id: "10d", label: "10 ngày" },
  { id: "30d", label: "30 ngày" },
  { id: "custom", label: "Tuỳ chọn" },
];

const PRODUCT_FULFILLMENT_OPTIONS: Array<{
  id: ProductFulfillmentFilter;
  label: string;
}> = [
  { id: "all", label: "Tất cả" },
  { id: "shipped", label: "Đã xuất kho" },
  { id: "unshipped", label: "Chưa xuất kho" },
];

function dashboardRangeDescription(range: DashboardRange) {
  if (range === "today") return "Hôm nay";
  if (range === "yesterday") return "Hôm qua";
  if (range === "7d") return "7 ngày gần nhất";
  if (range === "10d") return "10 ngày gần nhất";
  if (range === "30d") return "30 ngày gần nhất";
  return "Tuỳ chọn";
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatDateDisplay(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function dailyRowDateKey(row: { date?: string; day: string }) {
  if (row.date) return row.date.slice(0, 10);
  const now = new Date();
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${String(row.day).padStart(2, "0")}`;
}

function getDefaultDateRange(range: DashboardRange) {
  const end = new Date();
  const start = new Date();
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "10d") {
    start.setDate(start.getDate() - 9);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return {
    fromDate: formatDateInputValue(start),
    toDate: formatDateInputValue(end),
  };
}

function parseCompactMetric(value: unknown) {
  if (typeof value === "number") return value;
  const raw = String(value || "")
    .trim()
    .replace(/,/g, ".");
  const numeric = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  if (/b/i.test(raw)) return numeric * 1_000_000_000;
  if (/m/i.test(raw)) return numeric * 1_000_000;
  if (/k/i.test(raw)) return numeric * 1_000;
  return numeric;
}

function parseQtyMetric(value: unknown) {
  const raw = String(value || "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyFull(value: unknown) {
  const amount = toNumber(value);
  if (!amount) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}₫`;
}

function sortArrow(active: boolean, direction: SortDirection) {
  if (!active) return "↕";
  return direction === "desc" ? "↓" : "↑";
}

function looksLikeMoneyValue(value: unknown) {
  if (typeof value === "string") {
    return /[₫đkmb]|000/i.test(value);
  }
  return toNumber(value) >= 1000;
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyShort(value: unknown) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return "0";

  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${Math.round(abs)}`;
}

function moneyTone(value: unknown) {
  return toNumber(value) >= 0 ? "text-emerald-700" : "text-rose-600";
}

function moneyBadgeTone(value: unknown) {
  return toNumber(value) >= 0
    ? "border-emerald-200 bg-emerald-50"
    : "border-rose-200 bg-rose-50";
}

function formatQty(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(toNumber(value));
}

function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("accessToken") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("the1970_access_token") ||
    ""
  );
}

async function dashboardFetchJson<T>(path: string): Promise<T | null> {
  const token = getStoredAuthToken();
  const endpoint = `${DASHBOARD_API_BASE}${path}`;
  const res = await fetch(endpoint, {
    cache: "no-store",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) return null;
  return (await res.json()) as T;
}

function normalizeProductOrderReportRows(
  payload: ProductOrderReportApi | null,
): ProductOrderReportItem[] {
  const sourceRows = payload?.rows || payload?.items || payload?.data || [];

  return sourceRows
    .map((row, index) => {
      const name = String(
        row.name ||
          row.productName ||
          row.variantName ||
          row.title ||
          row.sku ||
          `Sản phẩm ${index + 1}`,
      );
      const sku = row.sku || row.variantSku || row.code || null;
      const orderCount = toNumber(
        row.orderCount ??
          row.orders ??
          row.totalOrders ??
          row.createdOrderCount,
      );
      const quantity = toNumber(
        row.quantity ?? row.qty ?? row.totalQty ?? row.createdQty,
      );
      const shippedQty = toNumber(
        row.shippedQty ??
          row.exportedQty ??
          row.fulfilledQty ??
          row.deliveredQty,
      );
      const unshippedQty = toNumber(
        row.unshippedQty ??
          row.notExportedQty ??
          row.unfulfilledQty ??
          Math.max(quantity - shippedQty, 0),
      );

      const revenue = toNumber(
        row.revenueAmount ??
          row.totalAmount ??
          row.totalSales ??
          row.grossRevenue ??
          row.finalAmount ??
          row.totalRevenue ??
          row.revenue,
      );
      const productName = String(
        row.productName || row.parentProductName || name,
      );
      const variantName = String(
        row.variantName || row.variantLabel || row.colorSize || row.name || "",
      );

      return {
        id: String(row.id || row.variantId || row.productId || sku || index),
        productId: row.productId || null,
        variantId: row.variantId || null,
        name,
        productName,
        variantName,
        size: row.size || row.sizeName || null,
        color: row.color || row.colorName || null,
        sku,
        meta:
          row.meta ||
          row.colorSize ||
          row.variantLabel ||
          row.branchName ||
          null,
        orderCount,
        quantity,
        revenue,
        avgOrderValue: orderCount ? Math.round(revenue / orderCount) : 0,
        orderCodes: Array.isArray(row.orderCodes) ? row.orderCodes : [],
        customerNames: Array.isArray(row.customerNames)
          ? row.customerNames
          : [],
        sources: Array.isArray(row.sources) ? row.sources : [],
        orderDetails: Array.isArray(row.orderDetails) ? row.orderDetails : [],
        shippedQty,
        unshippedQty,
        shippedOrderCount: toNumber(
          row.shippedOrderCount ?? row.exportedOrderCount,
        ),
        unshippedOrderCount: toNumber(
          row.unshippedOrderCount ?? row.notExportedOrderCount,
        ),
        actionUrl: row.actionUrl,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || b.orderCount - a.orderCount);
}

function productReportFallbackFromTopProducts(
  topProducts: DashboardData["topProducts"],
): ProductOrderReportItem[] {
  return topProducts.map((item, index) => {
    const rawRevenueText = String(item.revenue || "");
    const rawRevenueNumber = toNumber(rawRevenueText.replace(/[^0-9.-]/g, ""));
    const hasRealMoney =
      looksLikeMoneyValue(item.revenue) && rawRevenueNumber >= 1000;
    const qtyFromField = toNumber(item.qty);
    // Một số API overview cũ trả cột topProducts.revenue là số lượng bán/top count,
    // không phải tiền. Không được render số 37 thành 37₫ gây hiểu nhầm.
    const fallbackQty = qtyFromField || (!hasRealMoney ? rawRevenueNumber : 0);

    return {
      id: String(item.variantId || item.productId || item.rank || index),
      productId: item.productId || null,
      variantId: item.variantId || null,
      name: item.name,
      productName: item.name,
      variantName: item.meta,
      sku: null,
      meta: item.meta,
      orderCount: fallbackQty,
      quantity: fallbackQty,
      revenue: hasRealMoney ? rawRevenueNumber : 0,
      avgOrderValue:
        hasRealMoney && fallbackQty
          ? Math.round(rawRevenueNumber / fallbackQty)
          : 0,
      orderCodes: [],
      customerNames: [],
      sources: [],
      orderDetails: [],
      shippedQty: fallbackQty,
      unshippedQty: 0,
      actionUrl: item.actionUrl,
    };
  });
}

function extractArrayFromPayload(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload.result?.items)) return payload.result.items;
  if (Array.isArray(payload.result?.orders)) return payload.result.orders;
  return [];
}

function orderLinesOf(order: DashboardOrderRow): DashboardOrderLine[] {
  return (
    order.items ||
    order.orderItems ||
    order.lines ||
    order.orderLines ||
    order.details ||
    []
  );
}

function isPosOrder(order: DashboardOrderRow) {
  const raw =
    `${order.salesChannel || ""} ${order.channel || ""} ${order.orderType || ""} ${order.paymentMethod || ""}`.toLowerCase();
  return (
    raw.includes("pos") ||
    raw.includes("bán lẻ") ||
    raw.includes("ban le") ||
    raw.includes("retail") ||
    raw.includes("quầy") ||
    raw.includes("quay")
  );
}

function isCodOrder(order: DashboardOrderRow) {
  const raw =
    `${order.salesChannel || ""} ${order.channel || ""} ${order.orderType || ""} ${order.paymentMethod || ""} ${order.paymentType || ""}`.toLowerCase();
  // Với hệ thống The 1970: đơn Facebook được xem như nhóm COD/online cần giao hàng.
  return (
    raw.includes("facebook") ||
    raw.includes("fb") ||
    raw.includes("meta") ||
    raw.includes("cod") ||
    raw.includes("giao hàng") ||
    raw.includes("ship") ||
    raw.includes("delivery")
  );
}

function getOrderAmount(order: DashboardOrderRow) {
  return toNumber(order.finalAmount ?? order.totalAmount ?? 0);
}

function isOrderInDateRange(
  order: DashboardOrderRow,
  fromDate: string,
  toDate: string,
) {
  if (!order.createdAt) return true;
  const created = new Date(order.createdAt);
  if (Number.isNaN(created.getTime())) return true;
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59.999`);
  return created >= start && created <= end;
}

function getOrderReliableSuccessDate(order: DashboardOrderRow) {
  const expanded = order as DashboardOrderRow & Record<string, any>;
  const shipment = (expanded.shipment || {}) as Record<string, any>;

  return (
    expanded.deliveredAt ||
    expanded.deliveryCompletedAt ||
    expanded.completedAt ||
    expanded.fulfilledAt ||
    expanded.shippedSuccessAt ||
    shipment.deliveredAt ||
    shipment.deliveryCompletedAt ||
    shipment.completedAt ||
    null
  );
}

function getShippingSuccessDate(order: DashboardOrderRow) {
  const expanded = order as DashboardOrderRow & Record<string, any>;
  const shipment = (expanded.shipment || {}) as Record<string, any>;

  // Không dùng order.completedAt/fulfilledAt cho Facebook, vì đó có thể là trạng thái đơn nội bộ.
  // Doanh thu Facebook giao thành công chỉ được nhận khi có mốc giao hàng/tracking thật.
  return (
    expanded.deliveredAt ||
    expanded.deliveryCompletedAt ||
    expanded.shippedSuccessAt ||
    shipment.deliveredAt ||
    shipment.deliveryCompletedAt ||
    shipment.completedAt ||
    shipment.deliveredTime ||
    shipment.completedTime ||
    null
  );
}

function isDateValueInRange(value: unknown, fromDate: string, toDate: string) {
  if (!value) return false;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59.999`);
  return date >= start && date <= end;
}

function isSuccessOrderInWarRoomRange(
  order: DashboardOrderRow,
  fromDate: string,
  toDate: string,
) {
  if (!isShippingSuccess(order)) return false;

  // POS: được tính theo ngày tạo/hoàn tất vì bán tại quầy thanh toán xong là thành công.
  if (isPosOrder(order)) {
    const successDate = getOrderReliableSuccessDate(order);
    return successDate
      ? isDateValueInRange(successDate, fromDate, toDate)
      : isOrderInDateRange(order, fromDate, toDate);
  }

  // Facebook/COD: tuyệt đối không fallback sang tiền đơn tạo.
  // Chỉ tính doanh thu giao thành công khi có mốc giao hàng/tracking thật nằm trong range.
  const shippingSuccessDate = getShippingSuccessDate(order);
  return shippingSuccessDate
    ? isDateValueInRange(shippingSuccessDate, fromDate, toDate)
    : false;
}

function getDeliveryStatusSignal(order: DashboardOrderRow) {
  const expanded = order as DashboardOrderRow & Record<string, unknown>;
  return [
    expanded.status,
    expanded.fulfillmentStatus,
    expanded.deliveryStatus,
    expanded.shippingStatus,
    expanded.shipmentStatus,
    expanded.trackingStatus,
    expanded.carrierStatus,
    expanded.carrierStatusName,
    expanded.ghnStatus,
    expanded.codStatus,
    expanded.deliveryResult,
    expanded.carrierState,
    expanded.shippingState,
    expanded.trackingState,
    expanded.shipment?.shippingStatus,
    expanded.shipment?.partnerStatus,
    expanded.shipment?.ahamoveStatus,
    expanded.shipment?.ahamoveSubStatus,
    expanded.ahamoveStatus,
    expanded.ahamoveSubStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isShippingSuccess(order: DashboardOrderRow) {
  const raw = getDeliveryStatusSignal(order);
  return (
    raw.includes("completed") ||
    raw.includes("complete") ||
    raw.includes("delivered") ||
    raw.includes("delivery_success") ||
    raw.includes("delivering_success") ||
    raw.includes("success") ||
    raw.includes("thành công") ||
    raw.includes("thanh cong") ||
    raw.includes("giao thành công") ||
    raw.includes("giao thanh cong") ||
    raw.includes("đã giao thành công") ||
    raw.includes("da giao thanh cong") ||
    raw.includes("đã giao") ||
    raw.includes("da giao")
  );
}

function hasExplicitDeliverySignal(order: DashboardOrderRow) {
  const expanded = order as DashboardOrderRow & Record<string, unknown>;
  return Boolean(
    expanded.deliveryStatus ||
    expanded.shippingStatus ||
    expanded.shipmentStatus ||
    expanded.trackingStatus ||
    expanded.carrierStatus ||
    expanded.carrierStatusName ||
    expanded.ghnStatus ||
    expanded.codStatus ||
    expanded.deliveryResult ||
    expanded.carrierState ||
    expanded.shippingState ||
    expanded.trackingState ||
    expanded.shipment?.shippingStatus ||
    expanded.shipment?.partnerStatus ||
    expanded.shipment?.ahamoveStatus ||
    expanded.shipment?.ahamoveSubStatus ||
    expanded.ahamoveStatus ||
    expanded.ahamoveSubStatus,
  );
}

function isLineShipped(order: DashboardOrderRow, line: DashboardOrderLine) {
  const raw =
    `${line.status || ""} ${line.fulfillmentStatus || ""} ${order.status || ""} ${order.fulfillmentStatus || ""}`.toLowerCase();
  return (
    raw.includes("shipped") ||
    raw.includes("delivered") ||
    raw.includes("completed") ||
    raw.includes("success") ||
    raw.includes("xuất") ||
    raw.includes("xuat") ||
    raw.includes("đã giao") ||
    raw.includes("da giao")
  );
}

function getOrderLineQty(line: DashboardOrderLine) {
  return toNumber(line.quantity ?? line.qty ?? 0);
}

function getOrderLineRevenue(line: DashboardOrderLine) {
  const qty = getOrderLineQty(line);
  const direct = toNumber(
    line.total ??
      line.lineTotal ??
      line.amount ??
      line.totalAmount ??
      line.finalAmount,
  );
  if (direct > 0) return direct;
  const unit = toNumber(
    line.price ?? line.unitPrice ?? line.salePrice ?? line.finalPrice,
  );
  return unit * qty;
}

function normalizeOrdersPayload(payload: any): DashboardOrderRow[] {
  return extractArrayFromPayload(payload).map(
    (order) => order as DashboardOrderRow,
  );
}

async function fetchOrdersForDashboardReport(params: {
  range: DashboardRange;
  fromDate: string;
  toDate: string;
  fulfillment?: ProductFulfillmentFilter;
}) {
  const baseParams = new URLSearchParams({
    range: params.range,
    fromDate: params.fromDate,
    toDate: params.toDate,
    dateFrom: params.fromDate,
    dateTo: params.toDate,
    startDate: params.fromDate,
    endDate: params.toDate,
    limit: "1000",
    pageSize: "1000",
    includeItems: "true",
    withItems: "true",
  });

  const candidates = [
    `/orders?${baseParams.toString()}`,
    `/orders/list?${baseParams.toString()}`,
    `/orders/admin?${baseParams.toString()}`,
  ];

  for (const path of candidates) {
    const payload = await dashboardFetchJson<any>(path);
    const rows = normalizeOrdersPayload(payload).filter((order) =>
      isOrderInDateRange(order, params.fromDate, params.toDate),
    );
    if (rows.length) return rows;
  }

  return [];
}

function buildOrderBreakdown(
  orders: DashboardOrderRow[],
): OrderChannelBreakdown {
  const posOrders = orders.filter(isPosOrder);
  const codOrders = orders.filter(
    (order) => !isPosOrder(order) && isCodOrder(order),
  );
  const otherOrders = orders.filter(
    (order) => !isPosOrder(order) && !isCodOrder(order),
  );
  const shippedOrders = orders.filter(isShippingSuccess);
  const sumAmount = (rows: DashboardOrderRow[]) =>
    rows.reduce((sum, order) => sum + getOrderAmount(order), 0);

  return {
    total: orders.length,
    pos: posOrders.length,
    cod: codOrders.length,
    other: otherOrders.length,
    shippedSuccess: shippedOrders.length,
    totalAmount: sumAmount(orders),
    posAmount: sumAmount(posOrders),
    codAmount: sumAmount(codOrders),
    otherAmount: sumAmount(otherOrders),
    shippedSuccessAmount: sumAmount(shippedOrders),
    orders,
  };
}

async function fetchWarRoomDeliveryRevenue(params: {
  range: DashboardRange;
  fromDate: string;
  toDate: string;
}) {
  const query = new URLSearchParams({
    range: params.range,
    fromDate: params.fromDate,
    toDate: params.toDate,
    dateFrom: params.fromDate,
    dateTo: params.toDate,
  });

  return dashboardFetchJson<WarRoomDeliveryRevenueApi>(
    `/shipments/war-room/delivery-revenue?${query.toString()}`,
  );
}

function buildOrderBreakdownFromWarRoomPayload(
  payload: WarRoomDeliveryRevenueApi | null,
): OrderChannelBreakdown | null {
  if (!payload?.orderCreated && !payload?.revenueSuccess) return null;

  const createdOrders = Array.isArray(payload.createdOrders)
    ? payload.createdOrders
    : [];
  const successOrders = Array.isArray(payload.successOrders)
    ? payload.successOrders
    : [];
  const seen = new Set<string>();
  const combinedOrders = [...createdOrders, ...successOrders].filter(
    (order) => {
      const key = String(
        order.id || order.orderCode || order.code || Math.random(),
      );
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  );
  const fallback = buildOrderBreakdown(combinedOrders);
  const created = payload.orderCreated || {};
  const success = payload.revenueSuccess || {};

  return {
    ...fallback,
    total: toNumber(created.total ?? fallback.total),
    pos: toNumber(created.pos?.orders ?? fallback.pos),
    cod: toNumber(created.facebook?.orders ?? fallback.cod),
    other: toNumber(created.other?.orders ?? fallback.other),
    totalAmount: toNumber(created.amount ?? fallback.totalAmount),
    posAmount: toNumber(created.pos?.amount ?? fallback.posAmount),
    codAmount: toNumber(created.facebook?.amount ?? fallback.codAmount),
    otherAmount: toNumber(created.other?.amount ?? fallback.otherAmount),
    shippedSuccess: toNumber(success.totalOrders ?? fallback.shippedSuccess),
    shippedSuccessAmount: toNumber(
      success.totalAmount ?? fallback.shippedSuccessAmount,
    ),
    orders: combinedOrders,
  };
}

function productReportFromOrders(
  orders: DashboardOrderRow[],
): ProductOrderReportItem[] {
  const map = new Map<
    string,
    ProductOrderReportItem & {
      orderIds: Set<string>;
      orderCodeSet: Set<string>;
      customerSet: Set<string>;
      sourceSet: Set<string>;
      orderDetails: ProductReportOrderDetail[];
    }
  >();

  orders.forEach((order, orderIndex) => {
    const orderId = String(
      order.id || order.code || order.orderCode || orderIndex,
    );
    const orderCode = String(order.code || order.orderCode || order.id || "—");
    const customerName = String(
      order.customerName || order.customer?.name || "—",
    );
    const source = String(
      order.salesChannel || order.channel || order.orderType || "—",
    );
    const group: "POS" | "Facebook" | "Khác" = isPosOrder(order)
      ? "POS"
      : isCodOrder(order)
        ? "Facebook"
        : "Khác";
    const lines = orderLinesOf(order);
    const orderAmount = getOrderAmount(order);
    const totalQtyInOrder = lines.reduce(
      (sum, line) => sum + getOrderLineQty(line),
      0,
    );

    lines.forEach((line, lineIndex) => {
      const qty = getOrderLineQty(line);
      if (qty <= 0) return;

      const key = String(
        line.variantId ||
          line.productId ||
          line.sku ||
          line.id ||
          `${line.name || line.productName || "SP"}-${lineIndex}`,
      );
      const productName = String(
        line.productName ||
          line.name ||
          line.variantName ||
          line.sku ||
          "Sản phẩm",
      );
      const variantName = String(line.variantName || line.name || "");
      const shippedQty = isLineShipped(order, line)
        ? toNumber(line.shippedQty ?? line.exportedQty ?? qty)
        : toNumber(line.shippedQty ?? line.exportedQty ?? 0);
      const directRevenue = getOrderLineRevenue(line);
      const revenue =
        directRevenue > 0
          ? directRevenue
          : totalQtyInOrder > 0
            ? Math.round((orderAmount * qty) / totalQtyInOrder)
            : 0;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          id: key,
          productId: line.productId || null,
          variantId: line.variantId || null,
          name: variantName || productName,
          productName,
          variantName,
          sku: line.sku || null,
          meta: line.sku || null,
          orderCount: 0,
          quantity: 0,
          revenue: 0,
          shippedQty: 0,
          unshippedQty: 0,
          avgOrderValue: 0,
          orderCodes: [],
          customerNames: [],
          sources: [],
          orderDetails: [],
          orderIds: new Set<string>(),
          orderCodeSet: new Set<string>(),
          customerSet: new Set<string>(),
          sourceSet: new Set<string>(),
        });
      }

      const target = map.get(key)!;
      target.orderIds.add(orderId);
      if (orderCode && orderCode !== "—") target.orderCodeSet.add(orderCode);
      if (customerName && customerName !== "—")
        target.customerSet.add(customerName);
      if (source && source !== "—") target.sourceSet.add(source);
      target.orderDetails.push({
        orderId,
        orderCode,
        customerName,
        source,
        group,
        status: String(order.status || order.fulfillmentStatus || "—"),
        paymentStatus: String(
          order.paymentStatus ||
            order.paymentMethod ||
            order.paymentType ||
            "—",
        ),
        quantity: qty,
        revenue,
      });
      target.quantity += qty;
      target.revenue += revenue;
      target.shippedQty += shippedQty;
      target.unshippedQty += Math.max(qty - shippedQty, 0);
    });
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      orderCount: item.orderIds.size,
      avgOrderValue: item.orderIds.size
        ? Math.round(item.revenue / item.orderIds.size)
        : 0,
      orderCodes: Array.from(item.orderCodeSet).slice(0, 12),
      customerNames: Array.from(item.customerSet).slice(0, 12),
      sources: Array.from(item.sourceSet).slice(0, 12),
      orderDetails: item.orderDetails.slice(0, 200),
      orderIds: undefined,
      orderCodeSet: undefined,
      customerSet: undefined,
      sourceSet: undefined,
    }))
    .sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.revenue - a.revenue ||
        b.orderCount - a.orderCount,
    );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createHtmlReportUrl(title: string, htmlBody: string) {
  const html = `<!doctype html><html><head><title>${escapeHtml(title)}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:28px;color:#111;background:#fafafa}h1{font-size:24px;margin:0}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:20px}.card{border:1px solid #ddd;border-radius:18px;padding:18px;background:white}.label{color:#666;font-size:13px}.value{font-size:32px;font-weight:700;margin-top:10px}.money{margin-top:6px;font-size:14px;font-weight:600;color:#047857}.toolbar{margin-top:16px;color:#444;font-size:13px}.tag{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:4px 10px;margin-right:6px;background:#fff}table{margin-top:22px;width:100%;border-collapse:collapse;background:white;border-radius:16px;overflow:hidden}th{background:#111;color:white;text-align:left;font-weight:500}td,th{padding:12px;border-bottom:1px solid #eee;font-size:13px}</style></head><body>${htmlBody}</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function goToDashboardUrl(url?: string) {
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

function buildDashboardFromOverview(
  base: DashboardData,
  overview: DashboardOverviewApi,
): DashboardData {
  const cards = overview.cards || {};
  const revenue = toNumber(cards.revenue);
  const totalOrders = toNumber(cards.totalOrders);
  const hasOrderChannelBreakdown =
    cards.posOrders != null ||
    cards.posOrderCount != null ||
    cards.retailOrders != null ||
    cards.codOrders != null ||
    cards.codOrderCount != null ||
    cards.shippingOrders != null ||
    cards.onlineOrders != null;
  const posOrders = hasOrderChannelBreakdown
    ? toNumber(cards.posOrders ?? cards.posOrderCount ?? cards.retailOrders)
    : undefined;
  const codOrders = hasOrderChannelBreakdown
    ? toNumber(
        cards.codOrders ??
          cards.codOrderCount ??
          cards.shippingOrders ??
          cards.onlineOrders ??
          Math.max(totalOrders - toNumber(posOrders), 0),
      )
    : undefined;
  const completedOrders = toNumber(cards.completedOrders);
  const cancelledOrders = toNumber(cards.cancelledOrders);
  const newOrders = toNumber(cards.newOrders);
  const availableQty = toNumber(cards.availableQty);
  const reservedQty = toNumber(cards.reservedQty);
  const incomingQty = toNumber(cards.incomingQty);
  const lowStockItems = toNumber(cards.lowStockItems);
  const outOfStockItems = toNumber(cards.outOfStockItems);
  const pendingTransfers = toNumber(cards.pendingTransfers);
  const profitLabel = String(cards.profitLabel || "");
  const productCount = toNumber(cards.productCount);
  const variantCount = toNumber(cards.variantCount);

  const inventoryTone: Tone =
    outOfStockItems > 0 ? "critical" : lowStockItems > 0 ? "warning" : "safe";
  const systemTone: Tone =
    inventoryTone === "critical" || cancelledOrders > 0
      ? "critical"
      : inventoryTone;
  const statusTitle =
    systemTone === "safe"
      ? "SYSTEM STATUS: SAFE"
      : systemTone === "critical"
        ? "SYSTEM STATUS: CRITICAL"
        : "SYSTEM STATUS: WARNING";

  const recentOrders = overview.recentOrders || [];
  const decisionCards = [
    ...(lowStockItems > 0
      ? [
          {
            id: "live-low-stock",
            eyebrow: "Bảo vệ tồn",
            title: `${lowStockItems} SKU sắp hết`,
            desc: `Có ${lowStockItems} SKU tồn thấp, ${outOfStockItems} SKU đã hết hàng. Nên kiểm tra nhập hàng hoặc điều chuyển kho.`,
            source: "Inventory",
            score: outOfStockItems > 0 ? "99%" : "94%",
            tag: outOfStockItems > 0 ? "Khẩn cấp" : "Cảnh báo",
            tone: inventoryTone,
          },
        ]
      : []),
    ...(newOrders > 0
      ? [
          {
            id: "live-new-orders",
            eyebrow: "Xử lý đơn",
            title: `${newOrders} đơn mới cần xử lý`,
            desc: `Có ${newOrders} đơn mới trong hệ thống. Ưu tiên duyệt, đóng gói và xuất kho đúng luồng.`,
            source: "Orders",
            score: "91%",
            tag: "Theo dõi",
            tone: "warning" as Tone,
          },
        ]
      : []),
    ...(pendingTransfers > 0
      ? [
          {
            id: "live-transfers",
            eyebrow: "Điều chuyển",
            title: `${pendingTransfers} phiếu chuyển kho đang chờ`,
            desc: `Có ${pendingTransfers} phiếu chuyển kho chưa hoàn tất. Cần kiểm tra để tồn kho giữa chi nhánh khớp dữ liệu.`,
            source: "Stock Transfer",
            score: "88%",
            tag: "Cần xử lý",
            tone: "warning" as Tone,
          },
        ]
      : []),
    {
      id: "live-revenue",
      eyebrow: "Doanh thu",
      title: `Doanh thu ghi nhận ${formatMoneyShort(revenue)}`,
      desc: `${totalOrders} đơn · ${completedOrders} hoàn thành · ${cancelledOrders} huỷ.`,
      source: "Orders",
      score: "86%",
      tag: revenue > 0 ? "Live data" : "Chưa có doanh thu",
      tone: revenue > 0 ? ("safe" as Tone) : ("warning" as Tone),
    },
  ];

  const dailyRows = [
    {
      day: new Date().getDate().toString().padStart(2, "0"),
      note: "Hôm nay",
      revenue: formatMoneyShort(revenue),
      adsCost: "0",
      profit: "—",
      orders: formatQty(totalOrders),
      roas: "—",
      compare: "Live",
      positive: revenue > 0,
      isToday: true,
    },
    ...base.dailyRows.slice(1),
  ];

  const lowStockRows = [
    lowStockItems > 0 ? `${lowStockItems} SKU sắp hết` : "Không có SKU sắp hết",
    outOfStockItems > 0
      ? `${outOfStockItems} SKU hết hàng`
      : "Không có SKU hết hàng",
    pendingTransfers > 0
      ? `${pendingTransfers} phiếu chuyển kho chờ xử lý`
      : "Không có phiếu chuyển kho chờ xử lý",
  ];

  return {
    ...base,
    hero: {
      ...base.hero,
      ...(overview.hero || {}),
      status: systemTone,
      title: statusTitle,
      subtitle: `Doanh thu ${formatMoneyShort(revenue)} · ${totalOrders} đơn · ${lowStockItems} SKU cảnh báo tồn`,
      chips: [
        `${totalOrders} đơn`,
        `${formatMoneyShort(revenue)} doanh thu`,
        `${lowStockItems} SKU cảnh báo tồn`,
      ],
      metaMode: "DISCONNECTED",
      metaAccount: "Meta Ads chưa nối live data",
    },
    warningSummary: {
      ...base.warningSummary,
      ...(overview.warningSummary || {}),
      level: systemTone,
      title:
        systemTone === "safe"
          ? "Hệ thống đang ổn định"
          : "Có tín hiệu rủi ro cần theo dõi sát",
      subtitle: `Live từ backend: ${totalOrders} đơn, ${availableQty} tồn khả dụng, ${lowStockItems} SKU critical${cards.rawLowStockPool ? ` / ${cards.rawLowStockPool} SKU tồn thấp có bán gần đây` : ""}.`,
      revenue: revenue > 0 ? formatMoneyShort(revenue) : "Chưa ghi nhận",
      roas: "Chưa nối Meta",
      inventory: `${lowStockItems} SKU sắp hết`,
    },
    decisionCards:
      overview.decisionCards && overview.decisionCards.length
        ? overview.decisionCards
        : decisionCards,
    insightRow:
      overview.insightRow && overview.insightRow.length
        ? overview.insightRow
        : [
            {
              id: "i1",
              title: "Tổng quan đơn hàng live",
              desc: `${totalOrders} đơn · ${newOrders} đơn mới · ${completedOrders} hoàn thành · ${cancelledOrders} huỷ.`,
              tone: cancelledOrders > 0 ? "warning" : "safe",
              badge: "Orders",
            },
            {
              id: "i2",
              title: "Tồn kho hệ thống",
              desc: `${formatQty(availableQty)} khả dụng · ${formatQty(reservedQty)} đang giữ · ${formatQty(incomingQty)} sắp về.`,
              tone: inventoryTone,
              badge: "Inventory",
            },
            {
              id: "i3",
              title: "Sản phẩm & biến thể",
              desc: `${formatQty(productCount)} sản phẩm · ${formatQty(variantCount)} biến thể đang có trong hệ thống.`,
              tone: "safe",
              badge: "Catalog",
            },
          ],
    realtime: {
      ...base.realtime,
      ...(overview.realtime || {}),
      delta: formatMoneyShort(revenue),
      deltaPct: "Live",
      checkoutPurchase: totalOrders
        ? `${completedOrders}/${totalOrders}`
        : "0/0",
      chokeLabel: "Đơn hoàn thành / tổng đơn",
      lowStock: lowStockRows,
      posOrders,
      codOrders,
    },
    kpis:
      overview.kpis && overview.kpis.length
        ? overview.kpis
        : [
            {
              id: "k1",
              label: "Doanh thu",
              value: formatMoneyShort(revenue),
              delta: "Live",
            },
            {
              id: "k2",
              label: "Đơn hàng",
              value: formatQty(totalOrders),
              delta: `${newOrders} mới`,
            },
            {
              id: "k3",
              label: "Tồn khả dụng",
              value: formatQty(availableQty),
              delta: `${reservedQty} giữ`,
            },
            {
              id: "k4",
              label: "SKU sắp hết",
              value: formatQty(lowStockItems),
              delta: `${outOfStockItems} hết`,
            },
            {
              id: "k5",
              label: "Lợi nhuận",
              value: profitLabel || "—",
              delta: profitLabel ? "Profit" : "Thiếu giá vốn",
            },
          ],
    dailyRows:
      overview.dailyRows && overview.dailyRows.length
        ? overview.dailyRows
        : dailyRows,
    drilldown:
      overview.drilldown && overview.drilldown.length
        ? overview.drilldown
        : [
            { label: "Doanh thu", value: formatMoneyShort(revenue) },
            { label: "Đơn hàng", value: formatQty(totalOrders) },
            { label: "Đơn mới", value: formatQty(newOrders) },
            {
              label: "Hoàn thành",
              value: formatQty(completedOrders),
              tone: "dark",
            },
            {
              label: "Tồn khả dụng",
              value: formatQty(availableQty),
              tone: "mint",
            },
          ],
    topProducts:
      overview.topProducts && overview.topProducts.length
        ? overview.topProducts
        : recentOrders
            .slice(0, 4)
            .map((order, index) => ({
              rank: index + 1,
              name: order.code || order.id,
              meta: `${order.customerName || "Khách lẻ"} · ${order.salesChannel || "OTHER"}`,
              qty: order.status || "NEW",
              revenue: formatMoneyShort(order.finalAmount),
            }))
            .concat(base.topProducts)
            .slice(0, 4),
    channelRevenue:
      overview.channelRevenue && overview.channelRevenue.length
        ? overview.channelRevenue
        : base.channelRevenue,
    warehouseMix:
      overview.warehouseMix && overview.warehouseMix.length
        ? overview.warehouseMix
        : [
            {
              name: "Tồn khả dụng",
              value: formatQty(availableQty),
              note: "Số lượng có thể bán",
            },
            {
              name: "Tồn đang giữ",
              value: formatQty(reservedQty),
              note: "Đang giữ cho đơn hàng",
            },
            {
              name: "Hàng sắp về",
              value: formatQty(incomingQty),
              note: "Incoming inventory",
            },
          ],
    quickInsights:
      overview.quickInsights && overview.quickInsights.length
        ? overview.quickInsights
        : [
            `Backend đã nối live: ${totalOrders} đơn, doanh thu ${formatMoneyShort(revenue)}.`,
            lowStockItems > 0
              ? `${lowStockItems} SKU đang sắp hết, nên xử lý nhập/điều chuyển.`
              : "Tồn kho chưa có SKU chạm ngưỡng sắp hết.",
            pendingTransfers > 0
              ? `${pendingTransfers} phiếu chuyển kho đang chờ xác nhận.`
              : "Không có phiếu chuyển kho đang chờ.",
          ],
    moneyFlow:
      overview.moneyFlow && overview.moneyFlow.length
        ? overview.moneyFlow
        : base.moneyFlow,
    funnel:
      overview.funnel && overview.funnel.length ? overview.funnel : base.funnel,
    floatingApproval: overview.floatingApproval || {
      count: `${pendingTransfers + lowStockItems} pending`,
      title: lowStockItems > 0 ? "Xử lý cảnh báo tồn" : "Không có cảnh báo lớn",
      subtitle: `Orders ${totalOrders} · Inventory ${availableQty}`,
    },
  };
}

function Panel({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[28px] border border-neutral-200 bg-white shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function toneClass(tone: Tone) {
  if (tone === "safe")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-[#e0bb4c] bg-[#fbf3d9] text-[#b7791f]";
}

function softToneClass(tone: Tone) {
  if (tone === "safe") return "border-emerald-200 bg-emerald-50/45";
  if (tone === "critical") return "border-rose-200 bg-rose-50/40";
  return "border-[#d7b24a] bg-[#fbf6df]";
}

function Badge({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: Tone | "dark" | "muted";
}) {
  const cls =
    tone === "dark"
      ? "border-neutral-900 bg-neutral-900 text-white"
      : tone === "muted"
        ? "border-neutral-200 bg-neutral-100 text-neutral-600"
        : toneClass(tone);

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-900">
      {children}
    </p>
  );
}

function metricTone(delta: string) {
  return delta.trim().startsWith("-") ? "text-rose-500" : "text-emerald-600";
}

function fallbackData(): DashboardData {
  const today = new Date().getDate().toString().padStart(2, "0");

  return {
    hero: {
      status: "safe",
      title: "Đang tải dữ liệu tổng quan",
      subtitle: "Đang kết nối backend...",
      chips: [],
      autoMode: "SEMI",
      metaMode: "DISCONNECTED",
      metaAccount: "Chưa nối Meta Ads",
      scheduler: { label: "Chưa có lịch live", times: [] },
    },
    warningSummary: {
      level: "safe",
      title: "Đang tải dữ liệu",
      subtitle: "Dashboard sẽ hiển thị dữ liệu thật sau khi API phản hồi.",
      revenue: "—",
      roas: "Chưa nối Meta",
      inventory: "—",
    },
    filters: {
      range: "30 ngày",
      channel: "Tất cả kênh",
      warehouse: "Tất cả chi nhánh / kho",
    },
    decisionCards: [],
    commandCenter: {
      title: "Hành động ngay trên Tổng quan",
      subtitle:
        "Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý tại đây.",
    },
    insightRow: [
      {
        id: "loading-orders",
        title: "Đang tải đơn hàng",
        desc: "Chờ dữ liệu từ backend.",
        tone: "safe",
        badge: "Loading",
      },
      {
        id: "loading-inventory",
        title: "Đang tải tồn kho",
        desc: "Chờ dữ liệu từ backend.",
        tone: "safe",
        badge: "Loading",
      },
      {
        id: "loading-products",
        title: "Đang tải sản phẩm",
        desc: "Chờ dữ liệu từ backend.",
        tone: "safe",
        badge: "Loading",
      },
    ],
    realtime: {
      delta: "—",
      deltaPct: "—",
      checkoutPurchase: "—",
      chokeLabel: "Chờ dữ liệu",
      lowStock: ["Đang tải cảnh báo tồn kho"],
      posOrders: 0,
      codOrders: 0,
    },
    kpis: [
      { id: "k1", label: "Doanh thu", value: "—", delta: "Live" },
      { id: "k2", label: "Đơn hàng", value: "—", delta: "Live" },
      { id: "k3", label: "Tồn khả dụng", value: "—", delta: "Live" },
      { id: "k4", label: "SKU sắp hết", value: "—", delta: "Live" },
      { id: "k5", label: "Phiếu chuyển chờ", value: "—", delta: "Live" },
    ],
    dailyRows: [
      {
        day: today,
        note: "Hôm nay",
        revenue: "—",
        profit: "—",
        orders: "—",
        roas: "—",
        compare: "Live",
        positive: true,
        isToday: true,
      },
    ],
    drilldown: [
      { label: "Doanh thu", value: "—" },
      { label: "Đơn hàng", value: "—" },
      { label: "Đơn mới", value: "—" },
      { label: "Hoàn thành", value: "—", tone: "dark" },
      { label: "Tồn khả dụng", value: "—", tone: "mint" },
    ],
    funnel: [
      { label: "Visits", value: "—", width: "0%" },
      { label: "Add to cart", value: "—", width: "0%" },
      { label: "Checkout", value: "—", width: "0%" },
      { label: "Purchase", value: "—", width: "0%" },
    ],
    moneyFlow: [
      {
        channel: "Chưa nối dữ liệu kênh",
        text: "Chưa có dữ liệu live từ ads/payment channels.",
        badge: "Pending",
        tone: "amber",
      },
    ],
    topProducts: [],
    channelRevenue: [],
    warehouseMix: [
      { name: "Tồn khả dụng", value: "—", note: "Chờ backend" },
      { name: "Tồn đang giữ", value: "—", note: "Chờ backend" },
      { name: "Hàng sắp về", value: "—", note: "Chờ backend" },
    ],
    quickInsights: ["Đang tải dữ liệu tổng quan từ backend."],
    floatingApproval: {
      count: "0 pending",
      title: "Không có approval",
      subtitle: "Chờ dữ liệu live",
    },
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(fallbackData());
  const [warRoomTab, setWarRoomTab] = useState<WarRoomTab>("realtime");
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("profit");
  const [autoAction, setAutoAction] = useState(true);
  const [soundAlert, setSoundAlert] = useState(true);
  const [autoMode, setAutoMode] = useState<"SAFE" | "SEMI" | "LIVE">("SEMI");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const [commandNote, setCommandNote] = useState<string>(
    "Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý tại đây.",
  );

  const [selectedRange, setSelectedRange] = useState("30d");
  const [selectedChannel, setSelectedChannel] = useState("Tất cả kênh");
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    "Tất cả chi nhánh / kho",
  );
  const [selectedInsightId, setSelectedInsightId] = useState("i1");
  const [selectedDay, setSelectedDay] = useState(
    new Date().getDate().toString().padStart(2, "0"),
  );
  const [selectedProductRank, setSelectedProductRank] = useState(1);
  const [selectedMoneyFlowChannel, setSelectedMoneyFlowChannel] =
    useState("Website");
  const [showAllDailyRows, setShowAllDailyRows] = useState(false);
  const [warRoomRange, setWarRoomRange] = useState<DashboardRange>("today");
  const [productReportRange, setProductReportRange] =
    useState<DashboardRange>("today");
  const todayDateRange = getDefaultDateRange("today");
  const [warRoomCustomFrom, setWarRoomCustomFrom] = useState(
    todayDateRange.fromDate,
  );
  const [warRoomCustomTo, setWarRoomCustomTo] = useState(todayDateRange.toDate);
  const [productCustomFrom, setProductCustomFrom] = useState(
    todayDateRange.fromDate,
  );
  const [productCustomTo, setProductCustomTo] = useState(todayDateRange.toDate);
  const [productFulfillmentFilter, setProductFulfillmentFilter] =
    useState<ProductFulfillmentFilter>("shipped");
  const [productReportSort, setProductReportSort] =
    useState<ProductReportSortKey>("quantity");
  const [productReportSortDirection, setProductReportSortDirection] =
    useState<SortDirection>("desc");
  const [productConfigOpen, setProductConfigOpen] = useState(false);
  const [productColumns, setProductColumns] = useState({
    money: true,
    mainProduct: false,
    variant: true,
    sku: true,
    fulfillment: true,
    avg: true,
    source: false,
    customer: false,
    orderCode: false,
  });
  const [productReportRows, setProductReportRows] = useState<
    ProductOrderReportItem[]
  >([]);
  const [productReportLoading, setProductReportLoading] = useState(false);
  const [orderBreakdown, setOrderBreakdown] = useState<OrderChannelBreakdown>({
    total: 0,
    pos: 0,
    cod: 0,
    other: 0,
    shippedSuccess: 0,
    totalAmount: 0,
    posAmount: 0,
    codAmount: 0,
    otherAmount: 0,
    shippedSuccessAmount: 0,
    orders: [],
  });

  const [dailyTableRange, setDailyTableRange] = useState<DashboardRange>("10d");
  const dailyTableDefaultRange = getDefaultDateRange("10d");
  const [dailyTableCustomFrom, setDailyTableCustomFrom] = useState(
    dailyTableDefaultRange.fromDate,
  );
  const [dailyTableCustomTo, setDailyTableCustomTo] = useState(
    dailyTableDefaultRange.toDate,
  );
  const [dailyOperatingCost, setDailyOperatingCost] = useState(0);
  const [operatingCostMode, setOperatingCostMode] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashboard_daily_operating_cost");
    const savedMode = window.localStorage.getItem("dashboard_operating_cost_mode");
    if (saved) setDailyOperatingCost(toNumber(saved));
    if (savedMode === "daily" || savedMode === "monthly") setOperatingCostMode(savedMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "dashboard_daily_operating_cost",
      String(dailyOperatingCost || 0),
    );
  }, [dailyOperatingCost]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard_operating_cost_mode", operatingCostMode);
  }, [operatingCostMode]);

  const [actionLog, setActionLog] = useState<
    Array<{ id: string; title: string; desc: string; time: string }>
  >([]);
  const [scaleLocked, setScaleLocked] = useState(false);
  const [decisionFlag, setDecisionFlag] = useState<
    "normal" | "low_stock" | "review"
  >("normal");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<
    Array<{ id: string; title: string; actionType: string; createdAt: string }>
  >([]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const dateRange =
          warRoomRange === "custom"
            ? { fromDate: warRoomCustomFrom, toDate: warRoomCustomTo }
            : getDefaultDateRange(warRoomRange);
        const query = new URLSearchParams({
          range: warRoomRange,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });
        const json = await dashboardFetchJson<DashboardOverviewApi>(
          `/dashboard/overview?${query.toString()}`,
        );
        if (!json || ignore) return;

        const base = fallbackData();
        setData(buildDashboardFromOverview(base, json));
      } catch {
        // Giữ fallback để dashboard không trắng màn hình khi backend chưa chạy.
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [warRoomRange, warRoomCustomFrom, warRoomCustomTo]);

  useEffect(() => {
    let ignore = false;

    async function loadProductReport() {
      setProductReportLoading(true);
      try {
        const dateRange =
          productReportRange === "custom"
            ? { fromDate: productCustomFrom, toDate: productCustomTo }
            : getDefaultDateRange(productReportRange);
        const query = new URLSearchParams({
          range: productReportRange,
          fulfillment: productFulfillmentFilter,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });
        const payload = await dashboardFetchJson<ProductOrderReportApi>(
          `/dashboard/product-order-report?${query.toString()}`,
        );
        let rows = normalizeProductOrderReportRows(payload);

        // Nếu core chưa có route product-order-report, lấy dữ liệu thật từ danh sách đơn + orderItems để aggregate ngay trên dashboard.
        // Không dùng topProducts vì đó là dữ liệu tổng hợp kiểu ranking, dễ nhầm số lượng với tiền.
        if (!rows.length) {
          const orders = await fetchOrdersForDashboardReport({
            range: productReportRange,
            fulfillment: productFulfillmentFilter,
            fromDate: dateRange.fromDate,
            toDate: dateRange.toDate,
          });
          rows = productReportFromOrders(orders);
        }

        if (!ignore) setProductReportRows(rows);
      } catch {
        if (!ignore) setProductReportRows([]);
      } finally {
        if (!ignore) setProductReportLoading(false);
      }
    }

    loadProductReport();

    return () => {
      ignore = true;
    };
  }, [
    productReportRange,
    productFulfillmentFilter,
    productCustomFrom,
    productCustomTo,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadOrderBreakdown() {
      try {
        const dateRange =
          warRoomRange === "custom"
            ? { fromDate: warRoomCustomFrom, toDate: warRoomCustomTo }
            : getDefaultDateRange(warRoomRange);
        const warRoomPayload = await fetchWarRoomDeliveryRevenue({
          range: warRoomRange,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });
        const summaryBreakdown =
          buildOrderBreakdownFromWarRoomPayload(warRoomPayload);
        if (!ignore && summaryBreakdown) {
          setOrderBreakdown(summaryBreakdown);
          return;
        }

        const orders = await fetchOrdersForDashboardReport({
          range: warRoomRange,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });
        if (!ignore) setOrderBreakdown(buildOrderBreakdown(orders));
      } catch {
        if (!ignore) {
          setOrderBreakdown({
            total: 0,
            pos: 0,
            cod: 0,
            other: 0,
            shippedSuccess: 0,
            totalAmount: 0,
            posAmount: 0,
            codAmount: 0,
            otherAmount: 0,
            shippedSuccessAmount: 0,
            orders: [],
          });
        }
      }
    }

    loadOrderBreakdown();

    return () => {
      ignore = true;
    };
  }, [warRoomRange, warRoomCustomFrom, warRoomCustomTo]);

  const decisionPills = useMemo(
    () => [
      { id: "profit", label: "Ưu tiên profit" },
      { id: "growth", label: "Ưu tiên tăng trưởng" },
      { id: "inventory", label: "Ưu tiên tồn kho" },
    ],
    [],
  );

  const selectedDecision = selectedDecisionId
    ? data.decisionCards.find((card) => card.id === selectedDecisionId) || null
    : null;

  const selectedDailyRow =
    data.dailyRows.find((row) => row.day === selectedDay) || data.dailyRows[0];

  const dailyRowsForTableRange = useMemo(() => {
    const sortedRows = [...data.dailyRows].sort((a, b) =>
      dailyRowDateKey(a) < dailyRowDateKey(b) ? 1 : -1,
    );

    if (dailyTableRange === "today") {
      const todayKey = formatDateInputValue(new Date());
      return sortedRows.filter((row) => dailyRowDateKey(row) === todayKey);
    }
    if (dailyTableRange === "yesterday") {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      const yesterdayKey = formatDateInputValue(date);
      return sortedRows.filter((row) => dailyRowDateKey(row) === yesterdayKey);
    }
    if (dailyTableRange === "7d") return sortedRows.slice(0, 7);
    if (dailyTableRange === "10d") return sortedRows.slice(0, 10);
    if (dailyTableRange === "30d") return sortedRows.slice(0, 30);

    const from = new Date(`${dailyTableCustomFrom}T00:00:00`);
    const to = new Date(`${dailyTableCustomTo}T23:59:59.999`);
    return sortedRows.filter((row) => {
      const date = new Date(`${dailyRowDateKey(row)}T00:00:00`);
      return date >= from && date <= to;
    });
  }, [
    data.dailyRows,
    dailyTableRange,
    dailyTableCustomFrom,
    dailyTableCustomTo,
  ]);

  const dailyRowsToShow = showAllDailyRows
    ? dailyRowsForTableRange
    : dailyRowsForTableRange.slice(0, 10);

  const dailyOperatingCostPerDay =
    operatingCostMode === "monthly"
      ? Math.round(dailyOperatingCost / 30)
      : dailyOperatingCost;

  const dailyRowsWithOperatingCost = dailyRowsToShow.map((row) => {
    const revenueValue = toNumber(
      row.raw?.revenue ?? parseCompactMetric(row.revenue),
    );
    const costValue = toNumber(row.raw?.cost ?? parseCompactMetric(row.cost));
    const adsCostValue = toNumber(
      row.raw?.adsCost ?? parseCompactMetric(row.adsCost || 0),
    );
    const grossProfit = revenueValue - costValue;
    const profitAfterAds =
      row.raw?.profit != null
        ? toNumber(row.raw.profit)
        : grossProfit - adsCostValue;
    const netProfit = profitAfterAds - dailyOperatingCostPerDay;

    return {
      ...row,
      date: dailyRowDateKey(row),
      displayDate: formatDateDisplay(dailyRowDateKey(row)),
      grossProfit: formatMoneyShort(grossProfit),
      profit: formatMoneyShort(profitAfterAds),
      operatingCost:
        dailyOperatingCostPerDay > 0
          ? formatMoneyShort(dailyOperatingCostPerDay)
          : "0",
      netProfit: formatMoneyShort(netProfit),
      raw: {
        ...(row.raw || {}),
        revenue: revenueValue,
        cost: costValue,
        grossProfit,
        adsCost: adsCostValue,
        profit: profitAfterAds,
        operatingCost: dailyOperatingCostPerDay,
        netProfit,
      },
    };
  });

  const dailyTableSummary = dailyRowsWithOperatingCost.reduce(
    (acc, row) => {
      const raw = (row.raw || {}) as NonNullable<DashboardData["dailyRows"][number]["raw"]>;
      const revenueValue = toNumber(raw.revenue ?? parseCompactMetric(row.revenue));
      const costValue = toNumber(raw.cost ?? parseCompactMetric(row.cost));
      const adsValue = toNumber(raw.adsCost ?? parseCompactMetric(row.adsCost || 0));
      const grossValue = toNumber(raw.grossProfit ?? revenueValue - costValue);
      const profitValue = toNumber(raw.profit ?? grossValue - adsValue);
      const operatingValue = toNumber(raw.operatingCost || 0);

      acc.revenue += revenueValue;
      acc.cost += costValue;
      acc.gross += grossValue;
      acc.ads += adsValue;
      acc.profit += profitValue;
      acc.operating += operatingValue;
      acc.net += toNumber(raw.netProfit ?? profitValue - operatingValue);
      acc.orders += toNumber(raw.orders ?? parseQtyMetric(row.orders));
      return acc;
    },
    {
      revenue: 0,
      cost: 0,
      gross: 0,
      ads: 0,
      profit: 0,
      operating: 0,
      net: 0,
      orders: 0,
    },
  );

  const productReportRowsToShow = productReportRows
    .filter((item) => {
      if (productFulfillmentFilter === "shipped") return item.shippedQty > 0;
      if (productFulfillmentFilter === "unshipped") {
        return item.unshippedQty > 0 || item.shippedQty === 0;
      }
      return true;
    })
    .sort((a, b) => {
      const av = toNumber(a[productReportSort]);
      const bv = toNumber(b[productReportSort]);
      const diff = av - bv;
      return productReportSortDirection === "desc" ? -diff : diff;
    })
    .slice(0, 50);

  const productReportSummary = productReportRowsToShow.reduce(
    (acc, item) => ({
      productCount: acc.productCount + 1,
      orderCount: acc.orderCount + item.orderCount,
      quantity: acc.quantity + item.quantity,
      revenue: acc.revenue + item.revenue,
    }),
    { productCount: 0, orderCount: 0, quantity: 0, revenue: 0 },
  );

  const warRoomRangeText = dashboardRangeDescription(warRoomRange);
  const productReportRangeText = dashboardRangeDescription(productReportRange);
  const todayDay = new Date().getDate().toString().padStart(2, "0");
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayDay = yesterdayDate.getDate().toString().padStart(2, "0");
  const dailyRowByDay = (day: string) =>
    data.dailyRows.find((row) => row.day === day);
  const rowsForCurrentWarRoomRange = (() => {
    if (warRoomRange === "today")
      return [dailyRowByDay(todayDay)].filter(
        Boolean,
      ) as DashboardData["dailyRows"];
    if (warRoomRange === "yesterday")
      return [dailyRowByDay(yesterdayDay)].filter(
        Boolean,
      ) as DashboardData["dailyRows"];
    if (warRoomRange === "7d") return data.dailyRows.slice(0, 7);
    if (warRoomRange === "10d") return data.dailyRows.slice(0, 10);
    if (warRoomRange === "30d") return data.dailyRows.slice(0, 30);
    return data.dailyRows;
  })();
  const warRoomRevenueAmount = rowsForCurrentWarRoomRange.reduce(
    (sum, row) => sum + parseCompactMetric(row.revenue),
    0,
  );
  const warRoomProfitAmount = rowsForCurrentWarRoomRange.reduce(
    (sum, row) => sum + parseCompactMetric(row.profit),
    0,
  );
  const warRoomAdsAmount = rowsForCurrentWarRoomRange.reduce(
    (sum, row) => sum + parseCompactMetric(row.adsCost || 0),
    0,
  );
  const warRoomOrderCount = rowsForCurrentWarRoomRange.reduce(
    (sum, row) => sum + parseQtyMetric(row.orders),
    0,
  );
  const warRoomCompareText =
    rowsForCurrentWarRoomRange[0]?.compare || data.realtime.deltaPct;
  const warRoomRevenueText = warRoomRevenueAmount
    ? formatMoneyShort(warRoomRevenueAmount)
    : selectedDailyRow?.revenue || data.realtime.delta;
  const warRoomOperatingAmount =
    rowsForCurrentWarRoomRange.length * dailyOperatingCost;
  const warRoomNetProfitAmount = warRoomProfitAmount - warRoomOperatingAmount;
  const warRoomProfitText = warRoomProfitAmount
    ? formatMoneyShort(warRoomNetProfitAmount)
    : "—";
  const warRoomAdsText = warRoomAdsAmount
    ? formatMoneyShort(warRoomAdsAmount)
    : "0";
  const warRoomAdsRoas =
    warRoomAdsAmount > 0 ? warRoomRevenueAmount / warRoomAdsAmount : 0;
  const warRoomAdsPerOrder =
    warRoomOrderCount > 0 ? warRoomAdsAmount / warRoomOrderCount : 0;
  const warRoomAdsRate =
    warRoomRevenueAmount > 0
      ? (warRoomAdsAmount / warRoomRevenueAmount) * 100
      : 0;
  const warRoomAdsLastUpdated = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const liveOrderTotal = orderBreakdown.total || warRoomOrderCount;
  const livePosOrders = orderBreakdown.total
    ? orderBreakdown.pos
    : data.realtime.posOrders;
  const liveCodOrders = orderBreakdown.total
    ? orderBreakdown.cod
    : data.realtime.codOrders;
  const liveOrderAmount = orderBreakdown.totalAmount || warRoomRevenueAmount;
  const livePosAmount = orderBreakdown.posAmount;
  const liveCodAmount = orderBreakdown.codAmount;
  const liveOtherAmount = orderBreakdown.otherAmount;
  const activeWarRoomDateRange =
    warRoomRange === "custom"
      ? { fromDate: warRoomCustomFrom, toDate: warRoomCustomTo }
      : getDefaultDateRange(warRoomRange);
  const successfulPosOrders = orderBreakdown.orders.filter(
    (order) =>
      isPosOrder(order) &&
      isSuccessOrderInWarRoomRange(
        order,
        activeWarRoomDateRange.fromDate,
        activeWarRoomDateRange.toDate,
      ),
  );
  const facebookOrdersInRange = orderBreakdown.orders.filter(
    (order) =>
      !isPosOrder(order) &&
      isCodOrder(order) &&
      isOrderInDateRange(
        order,
        activeWarRoomDateRange.fromDate,
        activeWarRoomDateRange.toDate,
      ),
  );
  const successfulFacebookOrders = orderBreakdown.orders.filter(
    (order) =>
      !isPosOrder(order) &&
      isCodOrder(order) &&
      isSuccessOrderInWarRoomRange(
        order,
        activeWarRoomDateRange.fromDate,
        activeWarRoomDateRange.toDate,
      ),
  );
  const facebookDeliverySignalMissing =
    facebookOrdersInRange.length > 0 &&
    successfulFacebookOrders.length === 0 &&
    !facebookOrdersInRange.some((order) => hasExplicitDeliverySignal(order));
  const successfulOtherOrders = orderBreakdown.orders.filter(
    (order) =>
      !isPosOrder(order) &&
      !isCodOrder(order) &&
      isSuccessOrderInWarRoomRange(
        order,
        activeWarRoomDateRange.fromDate,
        activeWarRoomDateRange.toDate,
      ),
  );
  const sumOrderAmount = (orders: DashboardOrderRow[]) =>
    orders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const liveSuccessPosOrders = successfulPosOrders.length;
  const liveSuccessFacebookOrders = successfulFacebookOrders.length;
  const liveSuccessOtherOrders = successfulOtherOrders.length;
  const liveSuccessPosAmount = sumOrderAmount(successfulPosOrders);
  const liveSuccessFacebookAmount = sumOrderAmount(successfulFacebookOrders);
  const liveSuccessOtherAmount = sumOrderAmount(successfulOtherOrders);
  const liveSuccessOrderCount =
    liveSuccessPosOrders + liveSuccessFacebookOrders + liveSuccessOtherOrders;
  const liveSuccessRevenueAmount =
    liveSuccessPosAmount + liveSuccessFacebookAmount + liveSuccessOtherAmount;
  const revenueCardAmount = liveSuccessRevenueAmount;
  const revenueCardOrderCount = liveSuccessOrderCount;
  const revenueCardSourceTotal = liveSuccessRevenueAmount;
  const liveShippingSuccess = orderBreakdown.shippedSuccess;
  const selectedRangeCompletedText = formatQty(liveShippingSuccess);
  const selectedRangeCompletedNote = `${formatQty(liveShippingSuccess)} đơn giao hàng thành công trên ${formatQty(liveOrderTotal)} đơn tạo trong ${warRoomRangeText.toLowerCase()}.`;
  const shouldShowProductReport = true;
  const shortListText = (values?: string[]) => {
    const clean = (values || []).filter(Boolean);
    if (!clean.length) return "—";
    const head = clean.slice(0, 2).join(", ");
    return clean.length > 2 ? `${head} +${clean.length - 2}` : head;
  };

  function openProductOrderDetails(item: ProductOrderReportItem) {
    const details = item.orderDetails || [];
    const body = `<h1>Chi tiết sản phẩm - ${escapeHtml(item.name)}</h1><p class="muted">Bộ lọc: ${escapeHtml(productReportRangeText)} · Hiển thị theo từng dòng đơn tạo, gồm mã đơn, khách và nguồn đơn.</p><div class="grid"><div class="card"><div class="label">Số đơn</div><div class="value">${formatQty(item.orderCount)}</div></div><div class="card"><div class="label">Số lượng</div><div class="value">${formatQty(item.quantity)}</div></div><div class="card"><div class="label">Doanh thu</div><div class="value">${formatMoneyFull(item.revenue)}</div></div><div class="card"><div class="label">TB / đơn</div><div class="value">${formatMoneyFull(item.avgOrderValue || (item.orderCount ? item.revenue / item.orderCount : 0))}</div></div></div><div class="toolbar"><span class="tag">SKU: ${escapeHtml(item.sku || "—")}</span><span class="tag">Phiên bản: ${escapeHtml(item.variantName || "—")}</span><span class="tag">Nguồn: ${escapeHtml(shortListText(item.sources))}</span></div><table><thead><tr><th>Mã đơn</th><th>Khách</th><th>Nguồn</th><th>Nhóm</th><th>SL</th><th>Doanh thu dòng</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead><tbody>${details.map((row) => `<tr><td>${escapeHtml(row.orderCode)}</td><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.group)}</td><td>${formatQty(row.quantity)}</td><td>${formatMoneyFull(row.revenue)}</td><td>${escapeHtml(row.paymentStatus)}</td><td>${escapeHtml(row.status)}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">Chưa có chi tiết đơn cho sản phẩm này. Cần API trả orderDetails hoặc /orders có items.</td></tr>`}</tbody></table>`;
    const url = createHtmlReportUrl(`Chi tiết sản phẩm ${item.name}`, body);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function toggleProductSort(key: ProductReportSortKey) {
    if (productReportSort === key) {
      setProductReportSortDirection((prev) =>
        prev === "desc" ? "asc" : "desc",
      );
      return;
    }
    setProductReportSort(key);
    setProductReportSortDirection("desc");
  }

  function toggleProductColumn(key: keyof typeof productColumns) {
    setProductColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openOrderCreatedBreakdown() {
    const total = liveOrderTotal;
    const pos = livePosOrders ?? 0;
    const facebook = liveCodOrders ?? 0;
    const rows = orderBreakdown.orders.slice(0, 500);
    const body = `<h1>Chi tiết đơn tạo - ${warRoomRangeText}</h1><p class="muted">Tách POS / Facebook theo bộ lọc đang chọn. Facebook là nhóm đơn online/COD từ nguồn Facebook.</p><div class="grid"><div class="card"><div class="label">Tổng đơn tạo</div><div class="value">${formatQty(total)}</div><div class="money">${formatMoneyFull(liveOrderAmount)}</div></div><div class="card"><div class="label">Đơn POS</div><div class="value">${formatQty(pos)}</div><div class="money">${formatMoneyFull(livePosAmount)}</div></div><div class="card"><div class="label">Đơn Facebook</div><div class="value">${formatQty(facebook)}</div><div class="money">${formatMoneyFull(liveCodAmount)}</div></div><div class="card"><div class="label">Khác / chưa phân loại</div><div class="value">${formatQty(orderBreakdown.other)}</div><div class="money">${formatMoneyFull(liveOtherAmount)}</div></div></div><table><thead><tr><th>Mã đơn</th><th>Khách</th><th>Nguồn</th><th>Nhóm</th><th>Thanh toán</th><th>Trạng thái</th><th>Giá trị</th></tr></thead><tbody>${rows.map((order) => `<tr><td>${order.code || order.orderCode || order.id || "—"}</td><td>${order.customerName || "—"}</td><td>${order.salesChannel || order.channel || order.orderType || "—"}</td><td>${isPosOrder(order) ? "POS" : isCodOrder(order) ? "Facebook" : "Khác"}</td><td>${order.paymentMethod || order.paymentType || order.paymentStatus || "—"}</td><td>${order.status || order.fulfillmentStatus || "—"}</td><td>${formatMoneyFull(order.finalAmount ?? order.totalAmount)}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Chưa lấy được danh sách đơn chi tiết từ API /orders.</td></tr>`}</tbody></table>`;
    const url = createHtmlReportUrl(
      `Chi tiết đơn tạo ${warRoomRangeText}`,
      body,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const selectedProduct =
    data.topProducts.find((item) => item.rank === selectedProductRank) ||
    data.topProducts[0] ||
    null;

  const selectedMoneyFlow =
    data.moneyFlow.find((item) => item.channel === selectedMoneyFlowChannel) ||
    data.moneyFlow[0];

  const filteredDecisionCards = useMemo(() => {
    if (decisionMode === "growth") {
      return [...data.decisionCards].sort((a, b) => {
        const av = a.title.toLowerCase().includes("checkout") ? -1 : 1;
        const bv = b.title.toLowerCase().includes("checkout") ? -1 : 1;
        return av - bv;
      });
    }

    if (decisionMode === "inventory") {
      return [...data.decisionCards].sort((a, b) => {
        const av = a.eyebrow.includes("Bảo vệ tồn") ? -1 : 1;
        const bv = b.eyebrow.includes("Bảo vệ tồn") ? -1 : 1;
        return av - bv;
      });
    }

    return data.decisionCards;
  }, [data.decisionCards, decisionMode]);

  function openDecision(cardId: string) {
    const found = data.decisionCards.find((card) => card.id === cardId);
    setSelectedDecisionId(cardId);
    if (found) {
      setCommandNote(
        `Đang xem: ${found.title} · Nguồn ${found.source} · Score ${found.score}.`,
      );
      setApprovalOpen(true);
      setApprovalStatus("pending");
    }
  }

  function executeDecision(cardId: string) {
    const found = data.decisionCards.find((card) => card.id === cardId);
    setSelectedDecisionId(cardId);
    if (found) {
      setCommandNote(
        `Đã đưa ${found.title} vào Command Center. Chờ xác nhận bước tiếp theo.`,
      );
      setApprovalStatus("pending");
      setApprovalOpen(true);
    }
  }

  function approveCurrentDecision() {
    setApprovalStatus("approved");
    setCommandNote(
      `Đã duyệt hành động cho ${selectedDecision?.title || "decision hiện tại"}.`,
    );
    window.setTimeout(() => {
      setApprovalOpen(false);
    }, 250);
  }

  function rejectCurrentDecision() {
    setApprovalStatus("rejected");
    setCommandNote(
      `Đã từ chối hành động cho ${selectedDecision?.title || "decision hiện tại"}.`,
    );
  }

  function selectInsight(id: string) {
    const found = data.insightRow.find((item) => item.id === id);
    setSelectedInsightId(id);
    if (found) {
      setCommandNote(`Insight đang xem: ${found.title}`);
    }
  }

  function pushLog(title: string, desc: string) {
    setActionLog((prev) => [
      { id: `log-${Date.now()}`, title, desc, time: "Bây giờ" },
      ...prev,
    ]);
  }

  function toggleScaleLock() {
    const next = !scaleLocked;
    setScaleLocked(next);
    pushLog(
      next
        ? "SIM • Khóa scale • BẢO VỆ TỒN"
        : "SIM • Mở khóa scale • BẢO VỆ TỒN",
      next
        ? "Đã khóa scale cho decision đang chọn."
        : "Đã mở khóa scale cho decision đang chọn.",
    );
  }

  function markLowStock() {
    setDecisionFlag("low_stock");
    pushLog(
      "SIM • Sắp hết hàng • BẢO VỆ TỒN",
      "Giảm ưu tiên ads và theo dõi tồn kho sát hơn.",
    );
    if (selectedDecision) {
      setCommandNote(`Đã đánh dấu sắp hết hàng cho ${selectedDecision.title}.`);
    }
  }

  function markNeedsReview() {
    setDecisionFlag("review");
    pushLog(
      "SIM • Rà soát ngay • BẢO VỆ TỒN",
      "Đưa vào danh sách kiểm tra trong ngày.",
    );
    if (selectedDecision) {
      setCommandNote(
        `Đã chuyển ${selectedDecision.title} sang trạng thái cần kiểm tra.`,
      );
    }
  }

  function resolveAllApprovals(type: "approve" | "reject") {
    setApprovalStatus(type === "approve" ? "approved" : "rejected");
    setPendingApprovals([]);
    pushLog(
      type === "approve" ? "Duyệt tất approvals" : "Từ chối tất approvals",
      type === "approve"
        ? "Đã duyệt toàn bộ approval đang chờ."
        : "Đã từ chối toàn bộ approval đang chờ.",
    );
  }

  function addNote() {
    pushLog(
      "Ghi chú nhanh",
      `Đã thêm ghi chú cho ${selectedDecision?.title || "decision hiện tại"}.`,
    );
  }

  function undoLog(id: string) {
    setActionLog((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleScheduler() {
    const next = !schedulerEnabled;
    setSchedulerEnabled(next);
    pushLog(
      next ? "Bật Auto Scheduler" : "Tắt Auto Scheduler",
      next ? "Lịch tự động đã được bật lại." : "Lịch tự động đã được tắt.",
    );
  }

  function runScheduledTask(time: string) {
    pushLog("Chạy Auto Scheduler", `Đã chạy tác vụ lịch ${time}.`);
  }

  function resolveApproval(id: string, approved: boolean) {
    const target = pendingApprovals.find((item) => item.id === id);
    setPendingApprovals((prev) => prev.filter((item) => item.id !== id));
    setApprovalStatus(approved ? "approved" : "rejected");
    if (target) {
      pushLog(
        approved ? `Duyệt ${target.title}` : `Từ chối ${target.title}`,
        approved
          ? `Đã duyệt action ${target.actionType}.`
          : `Đã từ chối action ${target.actionType}.`,
      );
      setCommandNote(
        approved ? `Đã duyệt ${target.title}.` : `Đã từ chối ${target.title}.`,
      );
    }
  }

  return (
    <div className="relative space-y-4 pb-20 text-[12px]">
      <Panel className="overflow-hidden p-0">
        <div className="rounded-[28px] bg-neutral-950 p-4 text-white md:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-neutral-400">
                WAR ROOM
              </div>
              <h2 className="mt-2 font-serif text-[22px] font-medium tracking-tight text-white xl:text-[30px]">
                War Room · Theo dõi vận hành
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
                {`Realtime theo bộ lọc ${warRoomRangeText}: doanh thu, đơn tạo mới, POS/Facebook, chi phí ads và lợi nhuận.`}
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-neutral-400">
                Bộ lọc War Room
              </div>
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                {DASHBOARD_RANGE_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setWarRoomRange(item.id);
                      setSelectedRange(item.id);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      warRoomRange === item.id
                        ? "border-white bg-white text-neutral-950"
                        : "border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {warRoomRange === "custom" ? (
                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <input
                    type="date"
                    value={warRoomCustomFrom}
                    onChange={(e) => setWarRoomCustomFrom(e.target.value)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                  <input
                    type="date"
                    value={warRoomCustomTo}
                    onChange={(e) => setWarRoomCustomTo(e.target.value)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-3 p-3 md:p-4 xl:grid-cols-4">
          <div className="h-[246px] overflow-hidden rounded-[26px] border border-neutral-200 bg-white p-0">
            <div className="border-b border-neutral-100 px-4 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                    Revenue success
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">{`Doanh thu thành công ${warRoomRangeText.toLowerCase()}`}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    warRoomCompareText.trim().startsWith("-")
                      ? "bg-rose-50 text-rose-500"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {warRoomCompareText}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-[24px] font-semibold leading-none tracking-tight text-neutral-950 xl:text-[30px]">
                  {formatMoneyFull(revenueCardAmount)}
                </p>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                    TB / đơn
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-neutral-950">
                    {revenueCardOrderCount > 0
                      ? formatMoneyFull(
                          revenueCardAmount / revenueCardOrderCount,
                        )
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-2">
              <div className="h-[116px] rounded-[18px] bg-neutral-950 p-2.5 text-white">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                    Nguồn doanh thu thành công
                  </div>
                  <div className="text-xs font-medium text-neutral-300">
                    {formatQty(revenueCardOrderCount)} đơn thành công
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-neutral-200">
                      <span className="inline-flex items-center gap-2 uppercase tracking-[0.18em]">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />{" "}
                        POS THÀNH CÔNG
                      </span>
                      <span>{formatMoneyFull(liveSuccessPosAmount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-white"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              revenueCardSourceTotal > 0
                                ? (liveSuccessPosAmount /
                                    revenueCardSourceTotal) *
                                    100
                                : 0,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-neutral-200">
                      <span className="inline-flex items-center gap-2 uppercase tracking-[0.18em]">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />{" "}
                        FACEBOOK GIAO THÀNH CÔNG
                      </span>
                      <span>{formatMoneyFull(liveSuccessFacebookAmount)}</span>
                    </div>
                    {false ? null : null}
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-white"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              revenueCardSourceTotal > 0
                                ? (liveSuccessFacebookAmount /
                                    revenueCardSourceTotal) *
                                    100
                                : 0,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {liveSuccessOtherAmount > 0 ? (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-neutral-300">
                        <span className="inline-flex items-center gap-2 uppercase tracking-[0.18em]">
                          <span className="h-2 w-2 rounded-full bg-neutral-500" />{" "}
                          KHÁC
                        </span>
                        <span>{formatMoneyFull(liveSuccessOtherAmount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full bg-neutral-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                revenueCardSourceTotal > 0
                                  ? (liveSuccessOtherAmount /
                                      revenueCardSourceTotal) *
                                      100
                                  : 0,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openOrderCreatedBreakdown}
            className="flex h-[246px] flex-col rounded-[26px] border border-neutral-200 bg-white p-4 text-left transition hover:-translate-y-[1px] hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-neutral-500">{`Đơn tạo ${warRoomRangeText.toLowerCase()}`}</p>
                <p className="mt-3 text-[30px] font-semibold tracking-tight text-neutral-950 xl:text-[38px]">
                  {formatQty(warRoomOrderCount)}
                </p>
              </div>
              <span className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-medium text-neutral-500">
                Click chi tiết
              </span>
            </div>

            <div className="mt-auto h-[106px] rounded-[20px] bg-neutral-950 p-2.5 text-white">
              <div className="grid h-full grid-cols-2 gap-2">
                <div className="flex h-full min-h-0 flex-col justify-between rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    POS
                  </div>
                  <div className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-white">
                    {livePosOrders == null ? "—" : formatQty(livePosOrders)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-neutral-300">
                    {formatMoneyFull(livePosAmount)}
                  </div>
                </div>

                <div className="flex h-full min-h-0 flex-col justify-between rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    FACEBOOK
                  </div>
                  <div className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-white">
                    {liveCodOrders == null ? "—" : formatQty(liveCodOrders)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-neutral-300">
                    {formatMoneyFull(liveCodAmount)}
                  </div>
                </div>
              </div>
            </div>
          </button>

          <div className="h-[246px] overflow-hidden rounded-[26px] border border-neutral-200 bg-white p-0">
            <div className="border-b border-neutral-100 px-4 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                    Ads realtime
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">{`Chi phí ads ${warRoomRangeText.toLowerCase()}`}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                  Live
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="text-[30px] font-semibold leading-none tracking-tight text-neutral-950 xl:text-[38px]">
                  {warRoomAdsText}
                </p>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                    ROAS
                  </p>
                  <p className="mt-1 text-[18px] font-semibold text-neutral-950">
                    {warRoomAdsRoas ? `${warRoomAdsRoas.toFixed(2)}x` : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-neutral-100 bg-neutral-50/70">
              <div className="p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  / đơn
                </p>
                <p className="mt-2 text-[15px] font-semibold text-neutral-950">
                  {warRoomAdsPerOrder
                    ? formatMoneyFull(warRoomAdsPerOrder)
                    : "—"}
                </p>
              </div>
              <div className="p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  % DT
                </p>
                <p className="mt-2 text-[15px] font-semibold text-neutral-950">
                  {warRoomAdsRate ? `${warRoomAdsRate.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  Cập nhật
                </p>
                <p className="mt-2 text-[15px] font-semibold text-neutral-950">
                  {warRoomAdsLastUpdated}
                </p>
              </div>
            </div>

            <div className="px-5 py-2 text-xs text-neutral-500">
              Theo bộ lọc đang chọn · ưu tiên nối Meta Ads live để tách chiến
              dịch.
            </div>
          </div>

          <div className="flex h-[246px] flex-col justify-between rounded-[26px] border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-sm text-emerald-800">
              {`Lợi nhuận ước tính ${warRoomRangeText.toLowerCase()}`}
            </p>
            <p className="mt-4 text-[30px] font-semibold tracking-tight text-emerald-950 xl:text-[38px]">
              {warRoomProfitText}
            </p>
            <p className="mt-3 text-sm text-emerald-700">
              Doanh thu - giá vốn - ads - vận hành
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
              Bảng P&L tạm tính theo ngày
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-neutral-600">
              Tách rõ lãi gộp trước ads, lãi sau ads và lãi sau vận hành. Ads lấy theo ngày phát sinh từ Meta, còn doanh thu là doanh thu ghi nhận trong hệ thống.
            </p>
          </div>
          <div className="flex flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {DASHBOARD_RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDailyTableRange(item.id);
                    if (item.id !== "custom") setShowAllDailyRows(false);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    dailyTableRange === item.id
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllDailyRows((prev) => !prev)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-700"
              >
                {showAllDailyRows ? "Thu gọn" : "Xem toàn bộ"}
              </button>
            </div>
            {dailyTableRange === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dailyTableCustomFrom}
                  onChange={(e) => setDailyTableCustomFrom(e.target.value)}
                  className="rounded-full border border-neutral-200 px-3 py-2 text-sm outline-none"
                />
                <input
                  type="date"
                  value={dailyTableCustomTo}
                  onChange={(e) => setDailyTableCustomTo(e.target.value)}
                  className="rounded-full border border-neutral-200 px-3 py-2 text-sm outline-none"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Doanh thu
            </div>
            <div className="mt-2 text-lg font-semibold">
              {formatMoneyShort(dailyTableSummary.revenue)}
            </div>
          </div>
          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Giá vốn
            </div>
            <div className="mt-2 text-lg font-semibold">
              {formatMoneyShort(dailyTableSummary.cost)}
            </div>
          </div>
          <div className={`rounded-[18px] border px-4 py-3 ${moneyBadgeTone(dailyTableSummary.gross)}`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Lãi gộp trước ads
            </div>
            <div className={`mt-2 text-lg font-semibold ${moneyTone(dailyTableSummary.gross)}`}>
              {formatMoneyShort(dailyTableSummary.gross)}
            </div>
          </div>
          <div className="rounded-[18px] border border-neutral-200 bg-neutral-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Ads Meta
            </div>
            <div className="mt-2 text-lg font-semibold">
              {formatMoneyShort(dailyTableSummary.ads)}
            </div>
          </div>
          <div className={`rounded-[18px] border px-4 py-3 ${moneyBadgeTone(dailyTableSummary.profit)}`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Lãi sau ads
            </div>
            <div className={`mt-2 text-lg font-semibold ${moneyTone(dailyTableSummary.profit)}`}>
              {formatMoneyShort(dailyTableSummary.profit)}
            </div>
          </div>
          <div className="rounded-[18px] border border-neutral-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                Chi phí vận hành
              </div>
              <div className="flex rounded-full bg-neutral-100 p-0.5 text-[10px] font-medium">
                <button
                  type="button"
                  onClick={() => setOperatingCostMode("daily")}
                  className={`rounded-full px-2 py-1 ${operatingCostMode === "daily" ? "bg-neutral-950 text-white" : "text-neutral-500"}`}
                >
                  Ngày
                </button>
                <button
                  type="button"
                  onClick={() => setOperatingCostMode("monthly")}
                  className={`rounded-full px-2 py-1 ${operatingCostMode === "monthly" ? "bg-neutral-950 text-white" : "text-neutral-500"}`}
                >
                  Tháng
                </button>
              </div>
            </div>
            <input
              value={
                dailyOperatingCost
                  ? new Intl.NumberFormat("vi-VN").format(dailyOperatingCost)
                  : ""
              }
              onChange={(e) =>
                setDailyOperatingCost(parseQtyMetric(e.target.value))
              }
              placeholder={operatingCostMode === "daily" ? "VD 2.000.000/ngày" : "VD 60.000.000/tháng"}
              className="mt-2 w-full bg-transparent text-lg font-semibold outline-none"
            />
            <div className="mt-1 text-[11px] text-neutral-400">
              {operatingCostMode === "monthly"
                ? `Đang phân bổ ${formatMoneyShort(dailyOperatingCostPerDay)}/ngày`
                : "Trừ trực tiếp từng ngày"}
            </div>
          </div>
          <div className={`rounded-[18px] border px-4 py-3 ${moneyBadgeTone(dailyTableSummary.net)}`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Lãi sau vận hành
            </div>
            <div className={`mt-2 text-lg font-semibold ${moneyTone(dailyTableSummary.net)}`}>
              {formatMoneyShort(dailyTableSummary.net)}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[18px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-[12px] leading-5 text-neutral-500">
          Công thức: <span className="font-medium text-neutral-800">Lãi gộp trước ads = Doanh thu - Giá vốn</span> · <span className="font-medium text-neutral-800">Lãi sau ads = Lãi gộp - Ads Meta</span> · <span className="font-medium text-neutral-800">Lãi sau vận hành = Lãi sau ads - Chi phí vận hành phân bổ</span>. Dòng hôm nay là tạm tính trong ngày.
        </div>

        <div className="mt-4 overflow-x-auto rounded-[24px] border border-neutral-200">
          <table className="min-w-[1520px] w-full text-left">
            <thead className="bg-neutral-950 text-sm text-white">
              <tr>
                <th className="px-4 py-4 font-medium">Ngày</th>
                <th className="px-4 py-4 font-medium">Ghi chú</th>
                <th className="px-4 py-4 font-medium">Doanh thu</th>
                <th className="px-4 py-4 font-medium">Giá vốn</th>
                <th className="px-4 py-4 font-medium">Lãi gộp trước ads</th>
                <th className="px-4 py-4 font-medium">Chi phí ads</th>
                <th className="px-4 py-4 font-medium">Lãi sau ads</th>
                <th className="px-4 py-4 font-medium">Chi phí vận hành</th>
                <th className="px-4 py-4 font-medium">Lãi sau vận hành</th>
                <th className="px-4 py-4 font-medium">Đơn</th>
                <th className="px-4 py-4 font-medium">ROAS</th>
                <th className="px-4 py-4 text-right font-medium">
                  So với hôm qua
                </th>
              </tr>
            </thead>
            <tbody>
              {dailyRowsWithOperatingCost.map((row) => {
                const net = toNumber(row.raw?.netProfit);
                return (
                  <tr
                    key={row.date || row.day}
                    onClick={() => setSelectedDay(row.day)}
                    className={`border-t border-neutral-200 text-sm cursor-pointer ${
                      selectedDay === row.day ? "bg-neutral-50" : ""
                    }`}
                  >
                    <td className="px-4 py-4 font-medium">
                      <div>
                        {row.displayDate || formatDateDisplay(row.date)}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-400">
                        {row.date}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={row.isToday ? "dark" : "muted"}>
                        {row.note}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">{row.revenue}</td>
                    <td className="px-4 py-4">{row.cost || "—"}</td>
                    <td className={`px-4 py-4 font-medium ${moneyTone(row.raw?.grossProfit)}`}>
                      {(row as any).grossProfit || formatMoneyShort(row.raw?.grossProfit)}
                    </td>
                    <td className="px-4 py-4">{row.adsCost || "0"}</td>
                    <td className={`px-4 py-4 font-medium ${moneyTone(row.raw?.profit)}`}>
                      {formatMoneyShort(row.raw?.profit)}
                    </td>
                    <td className="px-4 py-4">{row.operatingCost}</td>
                    <td className={`px-4 py-4 font-semibold ${moneyTone(net)}`}>
                      {formatMoneyShort(net)}
                    </td>
                    <td className="px-4 py-4">{row.orders}</td>
                    <td className="px-4 py-4">{row.roas}</td>
                    <td
                      className={`px-4 py-4 text-right font-medium ${
                        row.positive ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {row.compare}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionEyebrow>Product Performance</SectionEyebrow>
            <h2 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
              Báo cáo sản phẩm đã tạo đơn
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {productReportRows.length
                ? `Gom theo sản phẩm/SKU đã phát sinh đơn trong ${productReportRangeText.toLowerCase()}. Mặc định đang xem hàng đã xuất kho để tính ads theo mẫu bán thật.`
                : `Luôn hiển thị báo cáo sản phẩm. Nếu core chưa có product-order-report, dashboard sẽ tự lấy danh sách đơn trong khoảng lọc để gom theo sản phẩm/SKU.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              {DASHBOARD_RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setProductReportRange(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    productReportRange === item.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {productReportRange === "custom" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="date"
                  value={productCustomFrom}
                  onChange={(e) => setProductCustomFrom(e.target.value)}
                  className="rounded-full border border-neutral-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={productCustomTo}
                  onChange={(e) => setProductCustomTo(e.target.value)}
                  className="rounded-full border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {PRODUCT_FULFILLMENT_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setProductFulfillmentFilter(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    productFulfillmentFilter === item.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setProductConfigOpen((prev) => !prev)}
                className="rounded-full border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
              >
                Cấu hình hiển thị
              </button>
            </div>
          </div>
        </div>

        {productConfigOpen ? (
          <div className="mt-4 rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                ["money", "Hiện cột tiền"],
                ["source", "Hiện nguồn đơn"],
                ["customer", "Hiện tên khách"],
                ["orderCode", "Hiện mã đơn"],
                ["mainProduct", "Hiện sản phẩm chính"],
                ["variant", "Hiện phiên bản sản phẩm"],
                ["sku", "Hiện SKU / phân loại"],
                ["fulfillment", "Hiện trạng thái xuất kho"],
                ["avg", "Hiện giá trị TB / đơn"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={productColumns[key as keyof typeof productColumns]}
                    onChange={() =>
                      toggleProductColumn(key as keyof typeof productColumns)
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-[22px] bg-neutral-50 p-4">
            <p className="text-sm text-neutral-600">Số sản phẩm</p>
            <p className="mt-3 text-[26px] font-semibold tracking-tight">
              {formatQty(productReportSummary.productCount)}
            </p>
          </div>
          <div className="rounded-[22px] bg-neutral-50 p-4">
            <p className="text-sm text-neutral-600">Số đơn tạo</p>
            <p className="mt-3 text-[26px] font-semibold tracking-tight">
              {formatQty(productReportSummary.orderCount)}
            </p>
          </div>
          <div className="rounded-[22px] bg-neutral-50 p-4">
            <p className="text-sm text-neutral-600">Số lượng sản phẩm</p>
            <p className="mt-3 text-[26px] font-semibold tracking-tight">
              {formatQty(productReportSummary.quantity)}
            </p>
          </div>
          <div className="rounded-[22px] bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">Doanh thu tạo đơn</p>
            <p className="mt-3 text-[26px] font-semibold tracking-tight text-emerald-900">
              {formatMoneyFull(productReportSummary.revenue)}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-[24px] border border-neutral-200">
          <table className="min-w-[1080px] w-full text-left">
            <thead className="bg-neutral-950 text-sm text-white">
              <tr>
                <th className="px-4 py-4 font-medium">#</th>
                <th className="px-4 py-4 font-medium">Sản phẩm</th>
                {productColumns.mainProduct ? (
                  <th className="px-4 py-4 font-medium">Sản phẩm chính</th>
                ) : null}
                {productColumns.variant ? (
                  <th className="px-4 py-4 font-medium">Phiên bản</th>
                ) : null}
                {productColumns.sku ? (
                  <th className="px-4 py-4 font-medium">SKU / phân loại</th>
                ) : null}
                {productColumns.source ? (
                  <th className="px-4 py-4 font-medium">Nguồn</th>
                ) : null}
                {productColumns.customer ? (
                  <th className="px-4 py-4 font-medium">Khách</th>
                ) : null}
                {productColumns.orderCode ? (
                  <th className="px-4 py-4 font-medium">Mã đơn</th>
                ) : null}
                <th className="px-4 py-4 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleProductSort("orderCount")}
                    className="flex items-center gap-1"
                  >
                    Số đơn{" "}
                    {sortArrow(
                      productReportSort === "orderCount",
                      productReportSortDirection,
                    )}
                  </button>
                </th>
                <th className="px-4 py-4 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleProductSort("quantity")}
                    className="flex items-center gap-1"
                  >
                    SL tạo đơn{" "}
                    {sortArrow(
                      productReportSort === "quantity",
                      productReportSortDirection,
                    )}
                  </button>
                </th>
                {productColumns.fulfillment ? (
                  <>
                    <th className="px-4 py-4 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleProductSort("shippedQty")}
                        className="flex items-center gap-1"
                      >
                        Đã xuất{" "}
                        {sortArrow(
                          productReportSort === "shippedQty",
                          productReportSortDirection,
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-4 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleProductSort("unshippedQty")}
                        className="flex items-center gap-1"
                      >
                        Chưa xuất{" "}
                        {sortArrow(
                          productReportSort === "unshippedQty",
                          productReportSortDirection,
                        )}
                      </button>
                    </th>
                  </>
                ) : null}
                {productColumns.money ? (
                  <th className="px-4 py-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleProductSort("revenue")}
                      className="flex items-center gap-1"
                    >
                      Doanh thu{" "}
                      {sortArrow(
                        productReportSort === "revenue",
                        productReportSortDirection,
                      )}
                    </button>
                  </th>
                ) : null}
                {productColumns.avg ? (
                  <th className="px-4 py-4 font-medium">TB / đơn</th>
                ) : null}
                <th className="px-4 py-4 text-right font-medium">Gợi ý ads</th>
              </tr>
            </thead>
            <tbody>
              {productReportRowsToShow.length ? (
                productReportRowsToShow.map((item, index) => {
                  const shippedRate = item.quantity
                    ? Math.round((item.shippedQty / item.quantity) * 100)
                    : 0;
                  const adsHint =
                    productFulfillmentFilter === "unshipped" ||
                    item.unshippedQty > item.shippedQty
                      ? "Chờ xuất kho"
                      : index < 5
                        ? "Ưu tiên đẩy"
                        : "Theo dõi";

                  return (
                    <tr
                      key={`${item.id}-${index}`}
                      className="border-t border-neutral-200 text-sm"
                    >
                      <td className="px-4 py-4 font-medium">{index + 1}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            item.actionUrl
                              ? goToDashboardUrl(item.actionUrl)
                              : openProductOrderDetails(item)
                          }
                          className="max-w-[320px] truncate text-left font-medium text-neutral-900"
                        >
                          {item.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => openProductOrderDetails(item)}
                          className="mt-1 block text-xs font-medium text-emerald-700"
                        >
                          Mở chi tiết đơn
                        </button>
                      </td>
                      {productColumns.mainProduct ? (
                        <td className="px-4 py-4 text-neutral-700">
                          {item.productName || item.name}
                        </td>
                      ) : null}
                      {productColumns.variant ? (
                        <td className="px-4 py-4 text-neutral-700">
                          <div>{item.variantName || item.meta || "—"}</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {[item.color, item.size]
                              .filter(Boolean)
                              .join(" / ") || "Không tách màu size"}
                          </div>
                        </td>
                      ) : null}
                      {productColumns.sku ? (
                        <td className="px-4 py-4 text-neutral-600">
                          <div>{item.sku || "—"}</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {item.meta || "Không có phân loại"}
                          </div>
                        </td>
                      ) : null}
                      {productColumns.source ? (
                        <td className="px-4 py-4 text-neutral-600">
                          {shortListText(item.sources)}
                        </td>
                      ) : null}
                      {productColumns.customer ? (
                        <td className="px-4 py-4 text-neutral-600">
                          {shortListText(item.customerNames)}
                        </td>
                      ) : null}
                      {productColumns.orderCode ? (
                        <td className="px-4 py-4 text-neutral-600">
                          {shortListText(item.orderCodes)}
                        </td>
                      ) : null}
                      <td className="px-4 py-4">
                        {formatQty(item.orderCount)}
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {formatQty(item.quantity)}
                      </td>
                      {productColumns.fulfillment ? (
                        <>
                          <td className="px-4 py-4">
                            {formatQty(item.shippedQty)}
                            <span className="ml-2 text-xs text-neutral-500">
                              {shippedRate}%
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={
                                item.unshippedQty > 0
                                  ? "font-medium text-rose-500"
                                  : "text-neutral-600"
                              }
                            >
                              {formatQty(item.unshippedQty)}
                            </span>
                          </td>
                        </>
                      ) : null}
                      {productColumns.money ? (
                        <td className="px-4 py-4 font-medium">
                          {formatMoneyFull(item.revenue)}
                        </td>
                      ) : null}
                      {productColumns.avg ? (
                        <td className="px-4 py-4">
                          {formatMoneyFull(
                            item.avgOrderValue ||
                              (item.orderCount
                                ? item.revenue / item.orderCount
                                : 0),
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-4 text-right">
                        <Badge
                          tone={
                            adsHint === "Ưu tiên đẩy"
                              ? "safe"
                              : adsHint === "Chờ xuất kho"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {adsHint}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-neutral-200 text-sm">
                  <td
                    colSpan={
                      5 +
                      (productColumns.mainProduct ? 1 : 0) +
                      (productColumns.variant ? 1 : 0) +
                      (productColumns.sku ? 1 : 0) +
                      (productColumns.source ? 1 : 0) +
                      (productColumns.customer ? 1 : 0) +
                      (productColumns.orderCode ? 1 : 0) +
                      (productColumns.fulfillment ? 2 : 0) +
                      (productColumns.money ? 1 : 0) +
                      (productColumns.avg ? 1 : 0)
                    }
                    className="px-4 py-8 text-center text-neutral-500"
                  >
                    {productReportLoading
                      ? "Đang tải báo cáo sản phẩm..."
                      : "Chưa lấy được orderItems từ API đơn hàng trong khoảng lọc này. Cần core trả /dashboard/product-order-report hoặc /orders có items để hiển thị số lượng và tiền theo SKU."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[26px] border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-neutral-900">Rủi ro tồn kho</p>
          <div className="mt-4 grid gap-2 text-sm text-neutral-700 md:grid-cols-3">
            {data.realtime.lowStock.map((row) => (
              <div key={row} className="rounded-2xl bg-neutral-50 px-4 py-3">
                {row}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-neutral-900">
            Điểm cần xử lý ngay
          </p>
          <div className="mt-4 space-y-2 text-sm text-neutral-700">
            <div className="rounded-2xl bg-neutral-50 px-4 py-3">
              {data.warningSummary.subtitle}
            </div>
            <div className="rounded-2xl bg-neutral-50 px-4 py-3">
              {data.commandCenter.subtitle}
            </div>
          </div>
        </div>
      </div>

      <Panel className="p-4 md:p-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <SectionEyebrow>Autopilot Ecom System</SectionEyebrow>
            <h1 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[34px]">
              {data.hero.title}
            </h1>
            <p className="mt-3 text-sm text-amber-700">{data.hero.subtitle}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Panel className="p-4">
              <SectionEyebrow>Auto Mode</SectionEyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["SAFE", "SEMI", "LIVE"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAutoMode(mode)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      autoMode === mode
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-600"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <SectionEyebrow>Meta</SectionEyebrow>
              <p className="mt-4 text-[16px] font-semibold">
                {data.hero.metaMode}
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                {data.hero.metaAccount}
              </p>
            </Panel>

            <Panel className="p-4">
              <SectionEyebrow>Auto Scheduler</SectionEyebrow>
              <p className="mt-4 text-[16px] font-semibold">
                {data.hero.scheduler.label}
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                {data.hero.scheduler.times.join(" / ")}
              </p>
            </Panel>
          </div>
        </div>
      </Panel>

      <Panel
        className="p-5"
        style={{
          backgroundColor: "#fbf6df",
          borderColor: "#d8b34a",
          borderWidth: "2px",
        }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionEyebrow>WARNING</SectionEyebrow>
            <h2 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
              {data.warningSummary.title}
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {data.warningSummary.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">Theo dõi</Badge>
            <Badge tone="muted">War Room Activated</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-neutral-600">Doanh thu</p>
            <p className="mt-2 text-[16px] font-semibold text-rose-500">
              {data.warningSummary.revenue}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-neutral-600">ROAS</p>
            <p className="mt-2 text-[16px] font-semibold text-emerald-600">
              {data.warningSummary.roas}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-neutral-600">Tồn kho</p>
            <p className="mt-2 text-[16px] font-semibold text-rose-500">
              {data.warningSummary.inventory}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm text-neutral-600">
            Ưu tiên xử lý: kiểm tra ads → checkout → tồn kho.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoAction}
                onChange={(e) => setAutoAction(e.target.checked)}
              />
              Auto Action
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={soundAlert}
                onChange={(e) => setSoundAlert(e.target.checked)}
              />
              Sound Alert
            </label>
            <Badge tone="dark">{data.hero.metaMode}</Badge>
          </div>
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <SectionEyebrow>Bộ lọc nhanh</SectionEyebrow>
            <div className="mt-3 flex flex-wrap gap-2">
              {DASHBOARD_RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedRange(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    selectedRange === item.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
            >
              {[
                "Tất cả kênh",
                "Website",
                "Facebook",
                "TikTok",
                "Shopify checkout",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              {[
                "Tất cả chi nhánh / kho",
                "Hoàn Kiếm",
                "Hai Bà Trưng",
                "Online Warehouse",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <Panel className="p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionEyebrow>Decision AI Pro</SectionEyebrow>
            <h2 className="mt-3 font-serif text-[18px] font-medium tracking-tight text-neutral-900 xl:text-[26px]">
              Động cơ ra quyết định
            </h2>
            <p className="mt-2 text-sm font-medium text-neutral-700">
              Ưu tiên theo lợi nhuận, tồn kho, ROAS và điểm nghẽn funnel.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {decisionPills.map((pill) => (
              <button
                key={pill.id}
                onClick={() => setDecisionMode(pill.id as DecisionMode)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  decisionMode === pill.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="grid content-start items-start gap-3 md:grid-cols-2">
            {filteredDecisionCards.map((card) => (
              <div
                key={card.id}
                onClick={() => openDecision(card.id)}
                className={`h-fit cursor-pointer self-start rounded-[24px] border p-4 text-left transition ${
                  selectedDecisionId === card.id
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <SectionEyebrow>{card.eyebrow}</SectionEyebrow>
                  <Badge tone={card.tone}>{card.tag}</Badge>
                </div>

                <h3 className="mt-3 font-serif text-[16px] font-medium tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-2 line-clamp-2 min-h-[40px] text-sm font-medium leading-6 text-neutral-700">
                  {card.desc}
                </p>

                <div className="mt-5 flex items-center justify-between text-sm font-medium text-neutral-700">
                  <span>{card.source}</span>
                  <span>{card.score}</span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-xs font-medium text-neutral-800">
                    {card.title}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeDecision(card.id);
                      }}
                      className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-white"
                    >
                      Execute
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!goToDashboardUrl(card.actionUrl))
                          openDecision(card.id);
                      }}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-800"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-fit self-start rounded-3xl border border-stone-200 bg-stone-900 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-stone-200">
                  Command Center
                </div>
                <h3 className="mt-2 text-2xl font-serif">
                  Hành động ngay trên Tổng quan
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {selectedDecision ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                    {selectedDecision.tag}
                  </span>
                ) : null}
                {selectedDecision ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-900">
                    Score {selectedDecision.score}
                  </span>
                ) : null}
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  Dry run only
                </span>
                {!selectedDecision ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                    Chọn 1 decision
                  </span>
                ) : null}
              </div>
            </div>

            {!selectedDecision ? (
              <div className="mt-5 rounded-3xl border border-stone-700 bg-white/5 p-4 text-sm text-stone-200">
                Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý ngay tại
                màn Tổng quan.
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-3xl border border-stone-700 bg-white/5 p-4">
                  <div className="text-lg font-medium">
                    {selectedDecision.title}
                  </div>
                  <div className="mt-2 text-sm text-stone-200">
                    {selectedDecision.desc}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-stone-400">SKU / nhóm</div>
                      <div className="mt-1 text-white">
                        {selectedDecision.title}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-stone-400">Kênh</div>
                      <div className="mt-1 text-white">
                        {selectedDecision.source}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-stone-400">Decision score</div>
                      <div className="mt-1 text-white">
                        {selectedDecision.score}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-stone-400">Action cuối</div>
                      <div className="mt-1 text-white">
                        {approvalStatus === "approved"
                          ? "Đã duyệt"
                          : decisionFlag === "low_stock"
                            ? "Auto giảm ngân sách"
                            : decisionFlag === "review"
                              ? "Rà soát ngay"
                              : "Chờ xử lý"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {selectedDecision?.actionUrl ? (
                    <button
                      onClick={() =>
                        goToDashboardUrl(selectedDecision.actionUrl)
                      }
                      className="col-span-2 rounded-2xl bg-emerald-100 px-4 py-3 font-medium text-emerald-900"
                    >
                      Mở đúng màn xử lý
                    </button>
                  ) : null}
                  <button
                    onClick={toggleScaleLock}
                    className="rounded-2xl bg-white px-4 py-3 font-medium text-stone-900"
                  >
                    {scaleLocked ? "🔓 Mở khóa scale" : "🔒 Khóa scale"}
                  </button>
                  <button
                    onClick={toggleScaleLock}
                    className="rounded-2xl bg-white/10 px-4 py-3 font-medium text-white"
                  >
                    {scaleLocked ? "🔓 Mở khóa scale" : "🔒 Khóa scale"}
                  </button>
                  <button
                    onClick={markLowStock}
                    className="rounded-2xl border border-stone-700 px-4 py-3 text-white hover:bg-white/10"
                  >
                    Sắp hết hàng
                  </button>
                  <button
                    onClick={markNeedsReview}
                    className="rounded-2xl border border-stone-700 px-4 py-3 text-white hover:bg-white/10"
                  >
                    Cần kiểm tra
                  </button>
                </div>

                <div className="mt-5 rounded-3xl border border-amber-700 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-amber-400">
                    Approval Queue
                  </div>
                  {pendingApprovals.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {pendingApprovals.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs text-stone-300">
                              {item.actionType} · {item.createdAt}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => resolveApproval(item.id, true)}
                              className="rounded-full bg-white px-4 py-2 text-xs font-medium text-stone-900"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => resolveApproval(item.id, false)}
                              className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white"
                            >
                              Từ chối
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-stone-200">
                      Không còn approval nào đang chờ.
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.24em] text-stone-200">
                      Auto Scheduler
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleScheduler}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                      >
                        {schedulerEnabled ? "Đang bật" : "Đang tắt"}
                      </button>
                      <button
                        onClick={() => runScheduledTask("09:00")}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                      >
                        09:00
                      </button>
                      <button
                        onClick={() => runScheduledTask("20:00")}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                      >
                        20:00
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-stone-200">
                  Meta Ads đang ở chế độ DRY RUN. Hệ thống hiện chỉ mô phỏng
                  lệnh và ghi log.
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.24em] text-stone-200">
                      Action Log
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveAllApprovals("approve")}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                      >
                        Duyệt tất
                      </button>
                      <button
                        onClick={() => resolveAllApprovals("reject")}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                      >
                        Từ chối tất
                      </button>
                      <button
                        onClick={addNote}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                      >
                        Ghi chú
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {actionLog.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-stone-300">
                            {item.time}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-stone-200">
                          {item.desc}
                        </div>
                        <button
                          onClick={() => undoLog(item.id)}
                          className="mt-3 rounded-full border border-white/10 px-3 py-1 text-[11px]"
                        >
                          Undo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        {data.insightRow.map((item) => (
          <button
            key={item.id}
            onClick={() => selectInsight(item.id)}
            className="w-full text-left"
          >
            <Panel
              className={`p-4 transition ${softToneClass(item.tone)} ${
                selectedInsightId === item.id
                  ? "ring-2 ring-neutral-900/10"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-[16px] font-medium tracking-tight">
                  {item.title}
                </h3>
                <Badge tone={item.tone}>{item.badge}</Badge>
              </div>
              <p className="mt-3 text-sm text-neutral-600">{item.desc}</p>
            </Panel>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel className="p-5">
              <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Top sản phẩm
              </h2>
              <p className="mt-1 text-xs text-neutral-600">
                Đang chọn: {selectedProduct?.name || "Chưa có sản phẩm"}
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-700">
                Những SKU đang kéo doanh thu mạnh nhất
              </p>

              <div className="mt-5 space-y-3">
                {(data.topProducts || []).map((item) => (
                  <button
                    key={item.rank}
                    onClick={() => {
                      setSelectedProductRank(item.rank);
                      if (item.actionUrl) goToDashboardUrl(item.actionUrl);
                    }}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left ${
                      selectedProductRank === item.rank
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-sm font-medium text-white">
                        {item.rank}
                      </div>
                      <div>
                        <p className="text-[16px] font-medium tracking-tight">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                          {item.meta}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-600">{item.qty}</p>
                      <p className="mt-1 text-[16px] font-semibold">
                        {item.revenue}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Doanh thu theo kênh
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Nhìn nhanh website, Facebook, TikTok, Shopify checkout
              </p>

              <div className="mt-6 space-y-5">
                {data.channelRevenue
                  .filter(
                    (item) =>
                      selectedChannel === "Tất cả kênh" ||
                      item.name === selectedChannel,
                  )
                  .map((item) => (
                    <div key={item.name}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span>{item.name}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-4 rounded-full bg-neutral-100">
                        <div
                          className="h-4 rounded-full bg-neutral-950"
                          style={{ width: item.width }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.8fr_0.9fr]">
            <Panel className="p-5">
              <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Kho & phân bổ tồn
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Theo từng kho để nhập hàng và điều chuyển cho chuẩn
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {data.warehouseMix.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-[24px] bg-neutral-50 p-5 text-center"
                  >
                    <p className="text-sm text-neutral-600">{item.name}</p>
                    <p className="mt-4 text-[34px] font-semibold tracking-tight">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm text-neutral-600">{item.note}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="bg-[#171312] p-5 text-white">
              <SectionEyebrow>Quick Insight</SectionEyebrow>
              <h2 className="mt-3 font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
                Điểm cần chú ý hôm nay
              </h2>

              <div className="mt-6 space-y-3">
                {data.quickInsights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-neutral-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
              Funnel
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Theo trạng thái đơn trong hệ thống
            </p>

            <div className="mt-6 space-y-5">
              {data.funnel.map((step) => (
                <div key={step.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span>{step.label}</span>
                    <span>{step.value}</span>
                  </div>
                  <div className="h-4 rounded-full bg-neutral-100">
                    <div
                      className="h-4 rounded-full bg-neutral-950"
                      style={{ width: step.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-serif text-[22px] font-medium tracking-tight xl:text-[28px]">
              Money Flow Insight
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Tiền đang chảy ở đâu, kênh nào đang đốt mạnh hơn phần doanh thu
              mang về.
            </p>

            <div className="mt-5 space-y-3">
              {data.moneyFlow.map((item) => (
                <button
                  key={item.channel}
                  onClick={() => setSelectedMoneyFlowChannel(item.channel)}
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selectedMoneyFlowChannel === item.channel
                      ? "ring-2 ring-neutral-900/10"
                      : ""
                  } ${
                    item.tone === "green"
                      ? "border-emerald-200 bg-emerald-50/45"
                      : item.tone === "red"
                        ? "border-rose-200 bg-rose-50/40"
                        : "border-amber-200 bg-amber-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-[16px] font-medium tracking-tight">
                      {item.channel}
                    </h3>
                    <Badge
                      tone={
                        item.tone === "green"
                          ? "safe"
                          : item.tone === "red"
                            ? "critical"
                            : "warning"
                      }
                    >
                      {item.badge}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-neutral-600">{item.text}</p>
                </button>
              ))}

              <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
                Đang focus: {selectedMoneyFlow.channel}.
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {approvalOpen && !selectedDecision ? (
        <div className="fixed bottom-5 right-5 z-40 w-[320px] rounded-[28px] bg-[#171312] p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionEyebrow>Approval</SectionEyebrow>
              <p className="mt-1 text-sm text-neutral-300">
                {data.floatingApproval.count}
              </p>
            </div>

            <div className="flex gap-2">
              <Badge tone="muted">Duyệt tất</Badge>
              <button
                onClick={() => setApprovalOpen(false)}
                className="text-sm text-neutral-400"
              >
                Ẩn
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-[18px] font-medium tracking-tight">
              {selectedDecision?.title || data.floatingApproval.title}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              {selectedDecision?.id
                ? selectedDecision.id
                : data.floatingApproval.subtitle}
            </p>
            <p
              className={`mt-2 text-xs ${
                approvalStatus === "approved"
                  ? "text-emerald-400"
                  : approvalStatus === "rejected"
                    ? "text-rose-400"
                    : "text-neutral-400"
              }`}
            >
              {approvalStatus === "approved"
                ? "Đã duyệt"
                : approvalStatus === "rejected"
                  ? "Đã từ chối"
                  : "Đang chờ duyệt"}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={approveCurrentDecision}
                className="rounded-full bg-white px-4 py-3 text-sm font-medium text-neutral-900"
              >
                Duyệt
              </button>
              <button
                onClick={rejectCurrentDecision}
                className="rounded-full border border-white/15 px-4 py-3 text-sm font-medium text-white"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
