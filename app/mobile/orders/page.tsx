"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Filter,
  LayoutGrid,
  List,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  WalletCards,
  X,
} from "lucide-react";

type AnyRow = Record<string, any>;

type OrderRow = {
  id?: string | null;
  orderCode?: string | null;
  code?: string | null;
  createdAt?: string | null;
  soldAt?: string | null;
  updatedAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingRecipientName?: string | null;
  shippingPhone?: string | null;
  status?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  salesChannel?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  createdByStaffName?: string | null;
  assignedStaffName?: string | null;
  finalAmount?: number | string | null;
  totalAmount?: number | string | null;
  amountDue?: number | string | null;
  shippingFee?: number | string | null;
  note?: string | null;
  shipment?: AnyRow | null;
  items?: AnyRow[];
  _assignedStaffName?: string | null;
  _createdByName?: string | null;
};

type OrdersResponse = {
  data?: OrderRow[];
  orders?: OrderRow[];
  rows?: OrderRow[];
  items?: OrderRow[];
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  total?: number;
  totalPages?: number;
};

type QuickDate = "today" | "yesterday" | "7d" | "30d";
type QuickStatus = "ALL" | "WAITING_APPROVE" | "WAITING_PAYMENT" | "WAITING_PACKING" | "WAITING_SHIP" | "DELIVERING" | "FAIL" | "LOCAL_DELIVERY";
type OrderViewMode = "compact" | "card";

const PAGE_SIZE = 20;
const ORDER_VIEW_MODE_STORAGE_KEY = "the1970.mobile.orders.viewMode";

const DATE_FILTERS: Array<{ key: QuickDate; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
];

const STATUS_FILTERS: Array<{ key: QuickStatus; label: string }> = [
  { key: "ALL", label: "Tất cả" },
  { key: "WAITING_APPROVE", label: "Chờ duyệt" },
  { key: "WAITING_PAYMENT", label: "Chờ thanh toán" },
  { key: "WAITING_PACKING", label: "Chờ đóng gói" },
  { key: "WAITING_SHIP", label: "Chờ gửi hãng" },
  { key: "DELIVERING", label: "Đang giao" },
  { key: "FAIL", label: "Giao lỗi" },
  { key: "LOCAL_DELIVERY", label: "Nội thành" },
];

async function getJson<T>(path: string): Promise<T> {
  return apiJson<T>(path, {
    redirectOnUnauthorized: true,
    timeoutMs: 30000,
  } as any);
}

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rangeDates(range: QuickDate) {
  const toDate = new Date();
  const fromDate = new Date();

  if (range === "yesterday") {
    toDate.setDate(toDate.getDate() - 1);
    fromDate.setDate(fromDate.getDate() - 1);
  }
  if (range === "7d") fromDate.setDate(fromDate.getDate() - 6);
  if (range === "30d") fromDate.setDate(fromDate.getDate() - 29);

  // Backend hiểu dateFrom/dateTo theo ngày Việt Nam và dateTo là hết ngày.
  return { from: dateInput(fromDate), to: dateInput(toDate) };
}

function num(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(num(value)))}đ`;
}

function compact(value: unknown) {
  const amount = num(value);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${new Intl.NumberFormat("vi-VN").format(Math.round(abs))}`;
}

function dt(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function normalize(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function statusLabel(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "DRAFT") return "Nháp";
  if (s === "PENDING" || s === "PENDING_APPROVAL") return "Chờ duyệt";
  if (s === "APPROVED") return "Đã duyệt";
  if (s === "PACKING") return "Đang đóng gói";
  if (s === "SHIPPED") return "Đã gửi hàng";
  if (s === "COMPLETED") return "Hoàn tất";
  if (s === "CANCELLED") return "Đã huỷ";
  return s;
}

function paymentLabel(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "PAID") return "Đã thanh toán";
  if (s === "PARTIAL") return "Thanh toán 1 phần";
  if (s === "PENDING_COD") return "Chờ COD";
  if (s === "UNPAID") return "Chưa thanh toán";
  return s;
}

function fulfillmentLabel(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "UNFULFILLED") return "Chưa xử lý";
  if (s === "PROCESSING") return "Đang xử lý";
  if (s === "FULFILLED") return "Đã giao";
  if (s === "PARTIAL") return "Giao 1 phần";
  if (s === "CANCELLED") return "Đã huỷ";
  return s;
}

function shipmentLabel(order: OrderRow) {
  const shipment = order.shipment || {};
  const carrier = String(shipment.carrier || shipment.shippingPartner || "").toUpperCase();
  const code = shipment.trackingCode || shipment.ahamoveOrderId || shipment.orderCode || "";
  if (!carrier && !code) return "Chưa tạo vận đơn";
  return [carrier || "Vận chuyển", code].filter(Boolean).join(" · ");
}

function orderId(order: OrderRow) {
  return String(order.id || order.orderCode || order.code || "");
}

function orderCode(order: OrderRow) {
  return String(order.orderCode || order.code || order.id || "—");
}

function customerName(order: OrderRow) {
  return order.shippingRecipientName || order.customerName || "Khách lẻ";
}

function customerPhone(order: OrderRow) {
  return order.shippingPhone || order.customerPhone || "—";
}

function getRows(raw: OrdersResponse | OrderRow[]) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.orders)) return raw.orders;
  if (Array.isArray(raw?.rows)) return raw.rows;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function getPagination(raw: OrdersResponse | OrderRow[], page: number) {
  if (Array.isArray(raw)) {
    return { page, pageSize: PAGE_SIZE, total: raw.length, totalPages: 1 };
  }
  const p = raw?.pagination || {};
  const total = Number(p.total ?? raw.total ?? 0);
  return {
    page: Number(p.page || page),
    pageSize: Number(p.pageSize || PAGE_SIZE),
    total,
    totalPages: Number(p.totalPages || raw.totalPages || Math.max(1, Math.ceil(total / PAGE_SIZE))),
  };
}

function creatorName(order: OrderRow) {
  return (
    order.createdByStaffName ||
    order._createdByName ||
    order.assignedStaffName ||
    order._assignedStaffName ||
    String((order as any).createdBy?.name || (order as any).createdByName || "").trim() ||
    "Chưa rõ NV"
  );
}

function productNames(order: OrderRow) {
  const rows = Array.isArray(order.items) ? order.items : [];
  const names = rows
    .map((item: any) =>
      String(
        item?.productName ||
          item?.name ||
          item?.product?.name ||
          item?.variant?.productName ||
          item?.variant?.product?.name ||
          item?.sku ||
          "",
      ).trim(),
    )
    .filter(Boolean);

  const unique = Array.from(new Set(names));
  if (!unique.length) {
    const fallback = String(
      (order as any).productNames ||
        (order as any).itemNames ||
        (order as any).firstProductName ||
        "",
    ).trim();
    return fallback || "Chưa có tên sản phẩm";
  }

  const firstTwo = unique.slice(0, 2).join(", ");
  return unique.length > 2 ? `${firstTwo} +${unique.length - 2} SP` : firstTwo;
}

function OrderCard({ order }: { order: OrderRow }) {
  const id = orderId(order);
  const status = order.status || order.orderStatus;
  const amount = order.finalAmount ?? order.totalAmount;
  const itemCount = Array.isArray(order.items) ? order.items.length : Number((order as any).itemCount || 0);

  return (
    <Link
      href={`/mobile/orders/${encodeURIComponent(id)}`}
      className="block rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-950 px-3 py-1 text-[11px] font-bold text-white">
              {orderCode(order)}
            </span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">
              {statusLabel(status)}
            </span>
          </div>
          <div className="mt-3 truncate text-base font-bold text-neutral-950">{customerName(order)}</div>
          <div className="mt-1 text-sm font-medium text-neutral-500">{customerPhone(order)}</div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-neutral-400" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-neutral-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Tổng tiền</div>
          <div className="mt-1 text-lg font-black text-neutral-950">{compact(amount)}</div>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Thanh toán</div>
          <div className="mt-1 truncate text-sm font-bold text-neutral-900">{paymentLabel(order.paymentStatus)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2">
        <p className="line-clamp-2 text-xs font-semibold leading-5 text-neutral-800">
          {productNames(order)}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-neutral-500">
          NV tạo: {creatorName(order)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-neutral-600">
        <span className="rounded-full bg-neutral-100 px-3 py-1">{dt(order.createdAt || order.soldAt)}</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1">{fulfillmentLabel(order.fulfillmentStatus)}</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1">{itemCount || 0} món</span>
      </div>

      <div className="mt-3 truncate rounded-2xl bg-stone-100 px-3 py-2 text-xs font-medium text-neutral-600">
        {shipmentLabel(order)}
      </div>
    </Link>
  );
}

function OrderCompactRow({ order }: { order: OrderRow }) {
  const id = orderId(order);
  const status = order.status || order.orderStatus;
  const amount = order.finalAmount ?? order.totalAmount;
  const itemCount = Array.isArray(order.items)
    ? order.items.length
    : Number((order as any).itemCount || 0);

  return (
    <Link
      href={`/mobile/orders/${encodeURIComponent(id)}`}
      className="block rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="max-w-[58%] truncate rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-bold text-white">
              {orderCode(order)}
            </span>
            <span className="truncate rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-700">
              {statusLabel(status)}
            </span>
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-neutral-950">
                {customerName(order)} · {customerPhone(order)}
              </p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-neutral-700">
                {productNames(order)}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-neutral-500">
                {dt(order.createdAt || order.soldAt)} · NV: {creatorName(order)}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-neutral-500">
                {shipmentLabel(order)} · {itemCount || 0} món
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-neutral-950">{compact(amount)}</p>
              <p className="mt-1 text-[10px] font-semibold text-neutral-500">
                {paymentLabel(order.paymentStatus)}
              </p>
            </div>
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-neutral-400" />
      </div>
    </Link>
  );
}

export default function MobileOrdersPage() {
  const [quickDate, setQuickDate] = useState<QuickDate>("today");
  const [quickStatus, setQuickStatus] = useState<QuickStatus>("ALL");
  const [queryInput, setQueryInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<OrderViewMode>("compact");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(ORDER_VIEW_MODE_STORAGE_KEY);
    if (saved === "compact" || saved === "card") {
      setViewMode(saved);
    }
  }, []);

  const changeViewMode = (nextMode: OrderViewMode) => {
    setViewMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORDER_VIEW_MODE_STORAGE_KEY, nextMode);
    }
  };

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, order) => {
        acc.amount += num(order.finalAmount ?? order.totalAmount);
        const payment = normalize(order.paymentStatus);
        if (payment === "UNPAID" || payment === "PENDING_COD") acc.unpaid += 1;
        if (normalize(order.fulfillmentStatus).includes("PROCESS") || normalize(order.status).includes("PACK")) acc.processing += 1;
        return acc;
      },
      { amount: 0, unpaid: 0, processing: 0 },
    );
  }, [rows]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { from, to } = rangeDates(quickDate);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        dateFrom: from,
        dateTo: to,
      });

      const q = appliedQuery.trim();
      if (q) params.set("q", q);
      if (quickStatus !== "ALL") params.set("quickStatus", quickStatus);

      const raw = await getJson<OrdersResponse | OrderRow[]>(`/orders?${params.toString()}`);
      const nextRows = getRows(raw);
      const p = getPagination(raw, page);

      setRows(nextRows);
      setTotal(p.total || nextRows.length);
      setTotalPages(Math.max(1, p.totalPages || 1));
    } catch (err) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setError(err instanceof Error ? err.message : "Không tải được danh sách đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, page, quickDate, quickStatus]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const submitSearch = () => {
    setPage(1);
    setAppliedQuery(queryInput.trim());
  };

  return (
    <main className="min-h-[100dvh] bg-neutral-100 px-4 pb-28 pt-4 text-neutral-950">
      <section className="rounded-[2rem] bg-neutral-950 p-5 text-white shadow-xl shadow-neutral-300">
        <div className="flex items-center justify-between gap-3">
          <Link href="/mobile" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/50">Mobile orders</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Đơn hàng</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">Xem nhanh đơn mới, trạng thái giao vận, thanh toán và chi tiết sản phẩm.</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <ShoppingBag className="h-4 w-4 text-white/60" />
            <div className="mt-2 text-xl font-black">{total || rows.length}</div>
            <div className="text-[11px] text-white/50">kết quả</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <WalletCards className="h-4 w-4 text-white/60" />
            <div className="mt-2 text-xl font-black">{compact(summary.amount)}</div>
            <div className="text-[11px] text-white/50">trang này</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <Clock3 className="h-4 w-4 text-white/60" />
            <div className="mt-2 text-xl font-black">{summary.processing}</div>
            <div className="text-[11px] text-white/50">đang xử lý</div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-neutral-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              placeholder="Mã đơn, SĐT, khách, mã vận đơn..."
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-neutral-400"
            />
            {queryInput ? (
              <button
                type="button"
                onClick={() => {
                  setQueryInput("");
                  setAppliedQuery("");
                  setPage(1);
                }}
                className="rounded-full p-1 text-neutral-400"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={submitSearch}
            className="rounded-2xl bg-neutral-950 px-4 text-sm font-bold text-white"
          >
            Tìm
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {DATE_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setQuickDate(item.key);
                setPage(1);
              }}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${quickDate === item.key ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setQuickStatus(item.key);
                setPage(1);
              }}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${quickStatus === item.key ? "bg-amber-500 text-neutral-950" : "bg-neutral-100 text-neutral-700"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-[11px] font-semibold text-neutral-500">
            Kiểu hiển thị
          </span>
          <div className="inline-flex rounded-xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => changeViewMode("compact")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                viewMode === "compact"
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-500"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Danh sách
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("card")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                viewMode === "card"
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-500"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Thẻ
            </button>
          </div>
        </div>
      </section>

      <section className={`mt-4 ${viewMode === "compact" ? "space-y-2" : "space-y-3"}`}>
        {loading ? (
          <div className="rounded-[1.75rem] bg-white p-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
            Đang tải đơn hàng...
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : rows.length ? (
          rows.map((order) =>
            viewMode === "compact" ? (
              <OrderCompactRow key={orderId(order)} order={order} />
            ) : (
              <OrderCard key={orderId(order)} order={order} />
            ),
          )
        ) : (
          <div className="rounded-[1.75rem] bg-white p-6 text-center shadow-sm">
            <PackageCheck className="mx-auto h-8 w-8 text-neutral-300" />
            <div className="mt-3 text-sm font-bold text-neutral-800">Không có đơn phù hợp</div>
            <div className="mt-1 text-xs text-neutral-500">Thử đổi ngày, trạng thái hoặc từ khoá tìm kiếm.</div>
          </div>
        )}
      </section>

      <section className="sticky bottom-[88px] z-30 mt-4 rounded-[1.5rem] border border-neutral-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-600">
          <span>
            Trang {page}/{totalPages} · {total} đơn
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || loading}
              className="rounded-xl border border-neutral-200 px-3 py-2 font-bold disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-xl bg-neutral-950 px-3 py-2 font-bold text-white disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      <MobileBottomNav />
    </main>
  );
}
