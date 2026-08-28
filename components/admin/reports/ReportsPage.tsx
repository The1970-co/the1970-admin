"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Range = "today" | "yesterday" | "7d" | "10d" | "30d" | "month" | "custom";
type Tab = "overview" | "daily" | "branch" | "staff" | "channel" | "carrier" | "payment" | "orders" | "products";
type Option = { id: string; name: string };
type MultiValue = string[];
type Metric = {
  orders: number;
  revenue: number;
  shippingCharged: number;
  shippingCost: number;
  discount: number;
  netRevenue: number;
  cost: number;
  grossProfit: number;
  completedOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  grossMargin: number;
};
type GroupRow = Partial<Metric> & { id: string; label: string; date?: string };
type ProductRow = {
  id: string;
  productName: string;
  skuCount: number;
  skus: string[];
  orderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  createdQty: number;
  completedQty: number;
  pendingQty: number;
  cancelledQty: number;
  completionRate: number;
  validRevenue: number;
  completedRevenue: number;
};
type OrderRow = {
  id: string;
  code: string;
  customerName: string;
  phone?: string;
  createdAt?: string;
  soldAt?: string;
  branchName?: string;
  staffName?: string;
  createdByStaffName?: string;
  assignedStaffName?: string;
  channelLabel?: string;
  status?: string;
  statusLabel?: string;
  paymentStatus?: string;
  paymentStatusLabel?: string;
  fulfillmentStatus?: string;
  fulfillmentStatusLabel?: string;
  deliveryStatus?: string;
  deliveryStatusLabel?: string;
  paymentMethod?: string;
  carrier?: string;
  shippingMode?: string;
  trackingCode?: string;
  codAmount?: number;
  codReconciliationStatus?: string;
  amountDue?: number;
  itemCount?: number;
  finalAmount?: number;
  shippingCharged?: number;
  shippingCost?: number;
  discount?: number;
  netRevenue?: number;
  cost?: number;
  grossProfit?: number;
  actionUrl?: string;
};
type Payload = {
  success?: boolean;
  options?: {
    branches?: Option[];
    createdByStaff?: Option[];
    assignedStaff?: Option[];
    orderStatuses?: Option[];
    paymentStatuses?: Option[];
    fulfillmentStatuses?: Option[];
    deliveryStatuses?: Option[];
    channels?: Option[];
    shippingModes?: Option[];
    carriers?: Option[];
    paymentSources?: Option[];
    trackingOptions?: Option[];
    codOptions?: Option[];
    codReconciliationOptions?: Option[];
    amountDueOptions?: Option[];
    itemCountOptions?: Option[];
  };
  summary?: Partial<Metric>;
  dailyRows?: GroupRow[];
  branchRows?: GroupRow[];
  staffRows?: GroupRow[];
  channelRows?: GroupRow[];
  carrierRows?: GroupRow[];
  paymentRows?: GroupRow[];
  productRows?: ProductRow[];
  orders?: OrderRow[];
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_CORE_API_URL || "").replace(/\/$/, "");
const ranges: Array<{ id: Range; label: string }> = [
  { id: "today", label: "Hôm nay" }, { id: "yesterday", label: "Hôm qua" },
  { id: "7d", label: "7 ngày" }, { id: "10d", label: "10 ngày" },
  { id: "30d", label: "30 ngày" }, { id: "month", label: "Tháng này" },
  { id: "custom", label: "Tuỳ chọn" },
];
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Tổng quan" }, { id: "daily", label: "Theo ngày" },
  { id: "branch", label: "Chi nhánh" }, { id: "staff", label: "Nhân viên" },
  { id: "channel", label: "Nguồn bán" }, { id: "carrier", label: "Vận chuyển" },
  { id: "payment", label: "Thanh toán" }, { id: "orders", label: "Danh sách đơn" },
  { id: "products", label: "Thống kê sản phẩm" },
];

function n(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function pad(value: number) { return String(value).padStart(2, "0"); }
function dateInput(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function dateDisplay(value?: string) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
function money(value: unknown) { return `${new Intl.NumberFormat("vi-VN").format(Math.round(n(value)))}₫`; }
function qty(value: unknown) { return new Intl.NumberFormat("vi-VN").format(n(value)); }
function rangeDates(range: Range) {
  const end = new Date(); const start = new Date();
  if (range === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "10d") start.setDate(start.getDate() - 9);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "month") start.setDate(1);
  return { fromDate: dateInput(start), toDate: dateInput(end) };
}
function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || localStorage.getItem("the1970_access_token") || "";
}

function normalizeMulti(value?: string[] | null): MultiValue {
  const rows = Array.from(new Set((value || []).map((item) => String(item || "").trim()).filter(Boolean)));
  return rows.length ? rows : [];
}
function multiParam(value: MultiValue) {
  return normalizeMulti(value).join(",");
}
function MultiSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: MultiValue;
  onChange: (value: MultiValue) => void;
  options?: Option[];
  allLabel: string;
}) {
  const selected = normalizeMulti(value);
  const label = !selected.length
    ? allLabel
    : selected.length === 1
      ? options?.find((item) => item.id === selected[0])?.name || selected[0]
      : `${selected.length} mục đã chọn`;

  return (
    <details className="group relative">
      <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold marker:hidden">
        <span className="truncate">{label}</span><span className="text-neutral-400">⌄</span>
      </summary>
      <div className="absolute left-0 z-50 mt-2 max-h-[300px] min-w-full overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-neutral-50">
          <input type="checkbox" checked={!selected.length} onChange={() => onChange([])} />
          <span>{allLabel}</span>
        </label>
        {(options || []).map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(checked ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
              />
              <span className="whitespace-nowrap">{option.name}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function metric(value?: Partial<Metric>): Metric {
  return {
    orders: n(value?.orders), revenue: n(value?.revenue), shippingCharged: n(value?.shippingCharged),
    shippingCost: n(value?.shippingCost), discount: n(value?.discount), netRevenue: n(value?.netRevenue),
    cost: n(value?.cost), grossProfit: n(value?.grossProfit), completedOrders: n(value?.completedOrders),
    cancelledOrders: n(value?.cancelledOrders), avgOrderValue: n(value?.avgOrderValue), grossMargin: n(value?.grossMargin),
  };
}

export default function ReportsPage() {
  const initial = rangeDates("10d");
  const [range, setRange] = useState<Range>("10d");
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [dateField, setDateField] = useState("createdAt");
  const [branchIds, setBranchIds] = useState<MultiValue>([]);
  const [createdByStaffIds, setCreatedByStaffIds] = useState<MultiValue>([]);
  const [assignedStaffIds, setAssignedStaffIds] = useState<MultiValue>([]);
  const [orderStatuses, setOrderStatuses] = useState<MultiValue>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<MultiValue>([]);
  const [fulfillmentStatuses, setFulfillmentStatuses] = useState<MultiValue>([]);
  const [deliveryStatuses, setDeliveryStatuses] = useState<MultiValue>([]);
  const [salesChannels, setSalesChannels] = useState<MultiValue>([]);
  const [shippingModes, setShippingModes] = useState<MultiValue>([]);
  const [carriers, setCarriers] = useState<MultiValue>([]);
  const [paymentSourceIds, setPaymentSourceIds] = useState<MultiValue>([]);
  const [trackingFilter, setTrackingFilter] = useState<MultiValue>([]);
  const [codFilter, setCodFilter] = useState<MultiValue>([]);
  const [codReconciliationStatuses, setCodReconciliationStatuses] = useState<MultiValue>([]);
  const [amountDueFilter, setAmountDueFilter] = useState<MultiValue>([]);
  const [itemCountFilter, setItemCountFilter] = useState<MultiValue>([]);
  const [applied, setApplied] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(50);
  const [orderQuery, setOrderQuery] = useState("");

  useEffect(() => {
    if (range === "custom") return;
    const next = rangeDates(range);
    setFromDate(next.fromDate); setToDate(next.toDate);
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      const query = new URLSearchParams({
        fromDate,
        toDate,
        dateField,
        branchIds: multiParam(branchIds),
        createdByStaffIds: multiParam(createdByStaffIds),
        assignedStaffIds: multiParam(assignedStaffIds),
        orderStatuses: multiParam(orderStatuses),
        paymentStatuses: multiParam(paymentStatuses),
        fulfillmentStatuses: multiParam(fulfillmentStatuses),
        deliveryStatuses: multiParam(deliveryStatuses),
        salesChannels: multiParam(salesChannels),
        shippingModes: multiParam(shippingModes),
        carriers: multiParam(carriers),
        paymentSourceIds: multiParam(paymentSourceIds),
        trackingFilter: multiParam(trackingFilter),
        codFilter: multiParam(codFilter),
        codReconciliationStatuses: multiParam(codReconciliationStatuses),
        amountDueFilter: multiParam(amountDueFilter),
        itemCountFilter: multiParam(itemCountFilter),
      });
      try {
        const token = authToken();
        const response = await fetch(`${API_BASE}/reports/financial?${query}`, {
          cache: "no-store", credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
        const json = await response.json() as Payload;
        if (!cancelled) {
          setPayload(json);
          setOrderPage(1);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Không lấy được báo cáo.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
    // chỉ chạy khi bấm áp dụng; lần đầu applied=0 vẫn tải dữ liệu
  }, [applied]);

  const summary = metric(payload.summary);
  const options = payload.options || {};
  const activeRows = useMemo(() => {
    if (tab === "daily") return payload.dailyRows || [];
    if (tab === "branch") return payload.branchRows || [];
    if (tab === "staff") return payload.staffRows || [];
    if (tab === "channel") return payload.channelRows || [];
    if (tab === "carrier") return payload.carrierRows || [];
    if (tab === "payment") return payload.paymentRows || [];
    return [];
  }, [payload, tab]);

  const applyQuickRange = (nextRange: Range) => {
    setRange(nextRange);

    if (nextRange === "custom") return;

    const next = rangeDates(nextRange);
    setFromDate(next.fromDate);
    setToDate(next.toDate);
    setOrderPage(1);

    // Đợi state ngày cập nhật rồi tải lại báo cáo.
    setTimeout(() => setApplied((value) => value + 1), 0);
  };

  const applyCustomDateNearTable = () => {
    setRange("custom");
    setOrderPage(1);
    setApplied((value) => value + 1);
  };

  const reset = () => {
    const next = rangeDates("10d");
    setRange("10d"); setFromDate(next.fromDate); setToDate(next.toDate); setDateField("createdAt");
    setBranchIds([]); setCreatedByStaffIds([]); setAssignedStaffIds([]);
    setOrderStatuses([]); setPaymentStatuses([]); setFulfillmentStatuses([]);
    setDeliveryStatuses([]); setSalesChannels([]); setShippingModes([]);
    setCarriers([]); setPaymentSourceIds([]); setTrackingFilter([]);
    setCodFilter([]); setCodReconciliationStatuses([]); setAmountDueFilter([]);
    setItemCountFilter([]); setTimeout(() => setApplied((v) => v + 1), 0);
  };

  return (
    <div className="w-full min-w-0 space-y-5 text-neutral-950">
      <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-400">Report Center</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Báo cáo tài chính</h1>
            <p className="mt-1 text-sm text-neutral-300">Mọi chỉ số và danh sách đơn đều thay đổi theo cùng một bộ lọc.</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">{dateDisplay(fromDate)} → {dateDisplay(toDate)}</div>
        </div>

        <div className="p-4 md:p-6">
          <div className="flex flex-wrap gap-2">
            {ranges.map((item) => <button key={item.id} onClick={() => setRange(item.id)} className={`rounded-xl px-3 py-2 text-sm font-bold ${range === item.id ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>{item.label}</button>)}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            <Field label="Từ ngày"><input type="date" value={fromDate} onChange={(e) => { setRange("custom"); setFromDate(e.target.value); }} /></Field>
            <Field label="Đến ngày"><input type="date" value={toDate} onChange={(e) => { setRange("custom"); setToDate(e.target.value); }} /></Field>
            <Field label="Loại ngày"><select value={dateField} onChange={(e) => setDateField(e.target.value)}><option value="createdAt">Ngày tạo đơn</option><option value="soldAt">Ngày bán</option></select></Field>
            <Field label="Chi nhánh"><MultiSelect value={branchIds} onChange={setBranchIds} options={options.branches} allLabel="Tất cả chi nhánh" /></Field>
            <Field label="Nhân viên tạo đơn"><MultiSelect value={createdByStaffIds} onChange={setCreatedByStaffIds} options={options.createdByStaff} allLabel="Tất cả NV tạo đơn" /></Field>
            <Field label="Nhân viên phụ trách"><MultiSelect value={assignedStaffIds} onChange={setAssignedStaffIds} options={options.assignedStaff} allLabel="Tất cả NV phụ trách" /></Field>
            <Field label="Trạng thái đơn"><MultiSelect value={orderStatuses} onChange={setOrderStatuses} options={options.orderStatuses} allLabel="Tất cả trạng thái đơn" /></Field>
            <Field label="Trạng thái thanh toán"><MultiSelect value={paymentStatuses} onChange={setPaymentStatuses} options={options.paymentStatuses} allLabel="Tất cả thanh toán" /></Field>
            <Field label="Giao vận"><MultiSelect value={fulfillmentStatuses} onChange={setFulfillmentStatuses} options={options.fulfillmentStatuses} allLabel="Tất cả giao vận" /></Field>
            <Field label="Trạng thái vận đơn"><MultiSelect value={deliveryStatuses} onChange={setDeliveryStatuses} options={options.deliveryStatuses} allLabel="Tất cả trạng thái vận đơn" /></Field>
            <Field label="Kênh bán"><MultiSelect value={salesChannels} onChange={setSalesChannels} options={options.channels} allLabel="Tất cả kênh bán" /></Field>
            <Field label="Cách giao"><MultiSelect value={shippingModes} onChange={setShippingModes} options={options.shippingModes} allLabel="Tất cả cách giao" /></Field>
            <Field label="Đơn vị vận chuyển"><MultiSelect value={carriers} onChange={setCarriers} options={options.carriers} allLabel="Tất cả đơn vị VC" /></Field>
            <Field label="Nguồn thanh toán"><MultiSelect value={paymentSourceIds} onChange={setPaymentSourceIds} options={options.paymentSources} allLabel="Tất cả nguồn tiền" /></Field>
            <Field label="Mã vận đơn"><MultiSelect value={trackingFilter} onChange={setTrackingFilter} options={options.trackingOptions} allLabel="Tất cả mã vận đơn" /></Field>
            <Field label="COD"><MultiSelect value={codFilter} onChange={setCodFilter} options={options.codOptions} allLabel="Tất cả COD" /></Field>
            <Field label="Đối soát COD"><MultiSelect value={codReconciliationStatuses} onChange={setCodReconciliationStatuses} options={options.codReconciliationOptions} allLabel="Tất cả đối soát COD" /></Field>
            <Field label="Công nợ khách"><MultiSelect value={amountDueFilter} onChange={setAmountDueFilter} options={options.amountDueOptions} allLabel="Tất cả công nợ khách" /></Field>
            <Field label="Dòng sản phẩm"><MultiSelect value={itemCountFilter} onChange={setItemCountFilter} options={options.itemCountOptions} allLabel="Tất cả dòng sản phẩm" /></Field>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button onClick={reset} className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700">Đặt lại</button>
            <button onClick={() => setApplied((v) => v + 1)} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-extrabold text-white">{loading ? "Đang lấy dữ liệu..." : "Áp dụng bộ lọc"}</button>
          </div>
          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <Card label="Tổng đơn" value={qty(summary.orders)} note={`${qty(summary.completedOrders)} hoàn thành · ${qty(summary.cancelledOrders)} huỷ`} />
        <Card label="Tiền hàng" value={money(summary.revenue)} note={`AOV ${money(summary.avgOrderValue)}`} />
        <Card label="Ship thu khách" value={money(summary.shippingCharged)} note="Phần phí ship cộng vào đơn" />
        <Card label="Ship trả hãng" value={money(summary.shippingCost)} note="Chi phí giao hàng thực tế" />
        <Card label="Giảm giá" value={money(summary.discount)} note="Voucher và giảm trên đơn" />
        <Card label="Doanh thu thuần" value={money(summary.netRevenue)} note="Tiền hàng + ship thu - giảm giá" />
        <Card label="Giá vốn" value={money(summary.cost)} note="Tổng giá vốn sản phẩm" />
        <Card label="Lãi gộp" value={money(summary.grossProfit)} note={`Biên ${summary.grossMargin.toFixed(1)}%`} tone={summary.grossProfit >= 0 ? "text-emerald-700" : "text-red-600"} />
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-neutral-200 px-4 pt-4">
          <div className="flex min-w-max gap-1">
            {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-t-xl px-4 py-3 text-sm font-bold ${tab === item.id ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>{item.label}</button>)}
          </div>
        </div>

        <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                Khoảng ngày
              </span>
              {ranges.map((item) => (
                <button
                  key={`near-table-${item.id}`}
                  type="button"
                  onClick={() => applyQuickRange(item.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    range === item.id
                      ? "bg-neutral-950 text-white"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setRange("custom");
                  setFromDate(event.target.value);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-neutral-500"
                aria-label="Từ ngày"
              />
              <span className="text-sm font-bold text-neutral-400">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setRange("custom");
                  setToDate(event.target.value);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-neutral-500"
                aria-label="Đến ngày"
              />
              <button
                type="button"
                onClick={applyCustomDateNearTable}
                disabled={loading}
                className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {loading ? "Đang tải..." : "Xem"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {tab === "overview" ? (
            <div className="space-y-6">
              <Overview payload={payload} summary={summary} />
              <div className="border-t border-neutral-200 pt-6">
                <OrdersTable
                  rows={payload.orders || []}
                  page={orderPage}
                  pageSize={orderPageSize}
                  query={orderQuery}
                  onPageChange={setOrderPage}
                  onPageSizeChange={(value) => {
                    setOrderPageSize(value);
                    setOrderPage(1);
                  }}
                  onQueryChange={(value) => {
                    setOrderQuery(value);
                    setOrderPage(1);
                  }}
                  compactTitle="Các đơn theo bộ lọc"
                />
              </div>
            </div>
          ) : null}
          {["daily", "branch", "staff", "channel", "carrier", "payment"].includes(tab) ? <GroupTable rows={activeRows} daily={tab === "daily"} /> : null}
          {tab === "orders" ? (
            <OrdersTable
              rows={payload.orders || []}
              page={orderPage}
              pageSize={orderPageSize}
              query={orderQuery}
              onPageChange={setOrderPage}
              onPageSizeChange={(value) => {
                setOrderPageSize(value);
                setOrderPage(1);
              }}
              onQueryChange={(value) => {
                setOrderQuery(value);
                setOrderPage(1);
              }}
            />
          ) : null}
          {tab === "products" ? <ProductStatsTable rows={payload.productRows || []} /> : null}
        </div>
      </section>
    </div>
  );
}

function ProductStatsTable({ rows }: { rows: ProductRow[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"created" | "completed" | "pending" | "rate" | "revenue">("created");

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const base = keyword
      ? rows.filter((row) =>
          row.productName.toLowerCase().includes(keyword) ||
          (row.skus || []).some((sku) => sku.toLowerCase().includes(keyword)),
        )
      : [...rows];

    return base.sort((a, b) => {
      if (sortBy === "completed") return n(b.completedQty) - n(a.completedQty);
      if (sortBy === "pending") return n(b.pendingQty) - n(a.pendingQty);
      if (sortBy === "rate") return n(b.completionRate) - n(a.completionRate);
      if (sortBy === "revenue") return n(b.validRevenue) - n(a.validRevenue);
      return n(b.createdQty) - n(a.createdQty);
    });
  }, [rows, query, sortBy]);

  const totals = useMemo(() => filteredRows.reduce(
    (acc, row) => {
      acc.createdQty += n(row.createdQty);
      acc.completedQty += n(row.completedQty);
      acc.pendingQty += n(row.pendingQty);
      acc.cancelledQty += n(row.cancelledQty);
      acc.validRevenue += n(row.validRevenue);
      acc.completedRevenue += n(row.completedRevenue);
      return acc;
    },
    { createdQty: 0, completedQty: 0, pendingQty: 0, cancelledQty: 0, validRevenue: 0, completedRevenue: 0 },
  ), [filteredRows]);

  const rate = totals.createdQty ? (totals.completedQty / totals.createdQty) * 100 : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold">Thống kê sản phẩm theo khoảng ngày</h2>
        <p className="mt-1 text-sm text-neutral-500">
          SL tạo hợp lệ đã loại toàn bộ đơn huỷ. SL hoàn thành chỉ tính sản phẩm nằm trong đơn có trạng thái Hoàn thành.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Mini label="Sản phẩm phát sinh" value={qty(filteredRows.length)} />
        <Mini label="SL tạo hợp lệ" value={qty(totals.createdQty)} />
        <Mini label="SL hoàn thành" value={qty(totals.completedQty)} />
        <Mini label="Đang xử lý" value={qty(totals.pendingQty)} />
        <Mini label="Tỷ lệ hoàn thành" value={`${rate.toFixed(1)}%`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-semibold text-neutral-500">
          Đơn huỷ bị loại khỏi SL tạo hợp lệ: <span className="font-extrabold text-red-600">{qty(totals.cancelledQty)} SP</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sản phẩm hoặc SKU..."
            className="min-w-[240px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="created">SL tạo nhiều nhất</option>
            <option value="completed">SL hoàn thành nhiều nhất</option>
            <option value="pending">Đang xử lý nhiều nhất</option>
            <option value="rate">Tỷ lệ hoàn thành cao nhất</option>
            <option value="revenue">Doanh thu cao nhất</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead>
            <tr className="bg-neutral-950 text-white">
              <th className="px-4 py-3">#</th>
              <th className="min-w-[280px] px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3 text-right">Số đơn</th>
              <th className="px-4 py-3 text-right">SL tạo hợp lệ</th>
              <th className="px-4 py-3 text-right">SL hoàn thành</th>
              <th className="px-4 py-3 text-right">Đang xử lý</th>
              <th className="px-4 py-3 text-right">SL huỷ</th>
              <th className="px-4 py-3 text-right">Hoàn thành</th>
              <th className="px-4 py-3 text-right">Doanh thu tạo</th>
              <th className="px-4 py-3 text-right">DT hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => (
              <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 text-neutral-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-bold text-neutral-950">{row.productName}</div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {qty(row.skuCount)} SKU · {(row.skus || []).slice(0, 4).join(", ")}{row.skus?.length > 4 ? ` +${row.skus.length - 4}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{qty(row.orderCount)}</td>
                <td className="px-4 py-3 text-right text-base font-extrabold">{qty(row.createdQty)}</td>
                <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{qty(row.completedQty)}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-600">{qty(row.pendingQty)}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{qty(row.cancelledQty)}</td>
                <td className="px-4 py-3 text-right font-bold">{n(row.completionRate).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{money(row.validRevenue)}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(row.completedRevenue)}</td>
              </tr>
            ))}
            {!filteredRows.length ? (
              <tr><td colSpan={10} className="py-12 text-center text-neutral-400">Không có sản phẩm phù hợp.</td></tr>
            ) : null}
          </tbody>
          {filteredRows.length ? (
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-extrabold">
                <td colSpan={3} className="px-4 py-3">Tổng {qty(filteredRows.length)} sản phẩm</td>
                <td className="px-4 py-3 text-right">{qty(totals.createdQty)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{qty(totals.completedQty)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{qty(totals.pendingQty)}</td>
                <td className="px-4 py-3 text-right text-red-600">{qty(totals.cancelledQty)}</td>
                <td className="px-4 py-3 text-right">{rate.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{money(totals.validRevenue)}</td>
                <td className="px-4 py-3 text-right">{money(totals.completedRevenue)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">{label}<div className="mt-1 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-neutral-200 [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-neutral-200 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2.5 [&>select]:text-sm [&>select]:font-semibold">{children}</div></label>;
}
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options?: Option[] }) {
  const rows = options?.length ? options : [{ id: "ALL", name: "Tất cả" }];
  return <select value={value} onChange={(e) => onChange(e.target.value)}>{rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>;
}
function Card({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return <div className="rounded-[22px] border border-neutral-200 bg-white p-4 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{label}</div><div className={`mt-2 text-xl font-extrabold tracking-tight ${tone || "text-neutral-950"}`}>{value}</div><div className="mt-1 text-xs text-neutral-500">{note}</div></div>;
}
function Overview({ payload, summary }: { payload: Payload; summary: Metric }) {
  const rows = payload.channelRows || [];
  return <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
    <div className="rounded-2xl bg-neutral-50 p-5"><h2 className="text-lg font-extrabold">Kết quả theo bộ lọc</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Mini label="Tỷ lệ hoàn thành" value={`${summary.orders ? Math.round(summary.completedOrders / summary.orders * 100) : 0}%`} /><Mini label="Lợi nhuận / đơn" value={money(summary.orders ? summary.grossProfit / summary.orders : 0)} /><Mini label="Chi phí ship / đơn" value={money(summary.orders ? summary.shippingCost / summary.orders : 0)} /><Mini label="Doanh thu thuần / đơn" value={money(summary.orders ? summary.netRevenue / summary.orders : 0)} /></div></div>
    <div className="rounded-2xl border border-neutral-200 p-5"><h2 className="text-lg font-extrabold">Nguồn bán nổi bật</h2><div className="mt-4 space-y-3">{rows.slice(0, 6).map((row) => <div key={row.id}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{row.label}</span><span>{money(row.netRevenue)}</span></div><div className="mt-1 h-2 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-neutral-900" style={{ width: `${summary.netRevenue ? Math.max(4, Math.min(100, n(row.netRevenue) / summary.netRevenue * 100)) : 0}%` }} /></div></div>)}{!rows.length ? <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p> : null}</div></div>
  </div>;
}
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-4"><div className="text-xs font-bold text-neutral-500">{label}</div><div className="mt-1 text-lg font-extrabold">{value}</div></div>; }
function GroupTable({ rows, daily }: { rows: GroupRow[]; daily?: boolean }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400"><th className="bg-neutral-50 px-3 py-3">{daily ? "Ngày" : "Nhóm"}</th><th className="whitespace-nowrap px-3 py-3 text-right">Đơn</th><th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Tiền hàng</th><th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Ship thu</th><th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Ship trả</th><th className="min-w-[150px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Doanh thu thuần</th><th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Lãi gộp</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-neutral-100"><td className="px-3 py-3 font-bold">{daily ? dateDisplay(row.date || row.id) : row.label}</td><td className="whitespace-nowrap px-3 py-3 text-right">{qty(row.orders)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.revenue)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.shippingCharged)}</td><td className="whitespace-nowrap px-3 py-3 text-right">{money(row.shippingCost)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{money(row.netRevenue)}</td><td className={`whitespace-nowrap px-3 py-3 text-right font-bold ${n(row.grossProfit) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{money(row.grossProfit)}</td></tr>)}{!rows.length ? <tr><td colSpan={7} className="py-10 text-center text-neutral-400">Không có dữ liệu theo bộ lọc.</td></tr> : null}</tbody></table></div>;
}
function normalizeStatusCode(value?: unknown) {
  return String(value || "").trim().toUpperCase();
}

function fallbackOrderStatusLabel(value?: unknown) {
  const key = normalizeStatusCode(value);
  const labels: Record<string, string> = {
    NEW: "Mới tạo",
    APPROVED: "Đã duyệt",
    PACKING: "Đang đóng gói",
    SHIPPED: "Đã gửi hàng",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã huỷ",
  };
  return labels[key] || String(value || "Chưa rõ");
}

function fallbackPaymentStatusLabel(value?: unknown) {
  const key = normalizeStatusCode(value);
  const labels: Record<string, string> = {
    UNPAID: "Chưa thanh toán",
    PARTIAL: "Thanh toán một phần",
    PAID: "Đã thanh toán",
    PENDING_COD: "Chờ thu COD",
    REFUNDED: "Đã hoàn tiền",
    FAILED: "Thanh toán lỗi",
  };
  return labels[key] || String(value || "Chưa rõ");
}

function fallbackFulfillmentStatusLabel(value?: unknown) {
  const key = normalizeStatusCode(value);
  const labels: Record<string, string> = {
    UNFULFILLED: "Chưa xử lý giao vận",
    PROCESSING: "Đang chuẩn bị hàng",
    PARTIAL: "Giao một phần",
    FULFILLED: "Đã hoàn tất giao vận",
    RETURNED: "Đã trả hàng",
    CANCELLED: "Đã huỷ giao vận",
  };
  return labels[key] || String(value || "Chưa rõ");
}

function fallbackDeliveryStatusLabel(value?: unknown) {
  const key = normalizeStatusCode(value);
  if (!key || key === "NONE") return "Chưa có vận đơn";
  const labels: Record<string, string> = {
    READY_TO_PICK: "Chờ lấy hàng",
    PICKING: "Đang lấy hàng",
    PICKED: "Đã lấy hàng",
    STORING: "Đang lưu kho",
    TRANSPORTING: "Đang luân chuyển",
    SORTING: "Đang phân loại",
    DELIVERING: "Đang giao hàng",
    DELIVERED: "Giao thành công",
    DELIVERY_SUCCESS: "Giao thành công",
    COMPLETED: "Hoàn thành",
    RETURN: "Đang hoàn hàng",
    RETURNING: "Đang hoàn hàng",
    RETURNED: "Đã hoàn hàng",
    WAITING_TO_RETURN: "Chờ hoàn hàng",
    DELIVERY_FAIL: "Giao không thành công",
    FAILED: "Giao không thành công",
    CANCELLED: "Đã huỷ vận đơn",
    CANCELED: "Đã huỷ vận đơn",
  };
  return labels[key] || String(value || "Chưa rõ");
}

function statusTone(value?: unknown) {
  const key = normalizeStatusCode(value);
  if (key.includes("COMPLETED") || key.includes("DELIVERED") || key === "PAID" || key === "FULFILLED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (key.includes("CANCEL") || key.includes("FAIL") || key.includes("RETURNED")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (key.includes("PENDING") || key.includes("NEW") || key.includes("PROCESS") || key.includes("PACK") || key.includes("DELIVERING") || key.includes("PICK")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function StatusBadge({ raw, label }: { raw?: unknown; label?: string }) {
  return (
    <span
      className={`inline-flex max-w-[190px] rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(raw)}`}
      title={String(raw || label || "")}
    >
      <span className="truncate">{label || String(raw || "Chưa rõ")}</span>
    </span>
  );
}

function sumOrderRows(rows: OrderRow[]) {
  return rows.reduce(
    (sum, row) => ({
      finalAmount: sum.finalAmount + n(row.finalAmount),
      shippingCharged: sum.shippingCharged + n(row.shippingCharged),
      shippingCost: sum.shippingCost + n(row.shippingCost),
      discount: sum.discount + n(row.discount),
      netRevenue: sum.netRevenue + n(row.netRevenue),
      cost: sum.cost + n(row.cost),
      grossProfit: sum.grossProfit + n(row.grossProfit),
    }),
    {
      finalAmount: 0,
      shippingCharged: 0,
      shippingCost: 0,
      discount: 0,
      netRevenue: 0,
      cost: 0,
      grossProfit: 0,
    },
  );
}

function paginationItems(current: number, total: number) {
  const items: Array<number | "gap"> = [];
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  items.push(1);
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  if (start > 2) items.push("gap");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("gap");
  items.push(total);
  return items;
}

function OrdersTable({
  rows,
  page,
  pageSize,
  query,
  onPageChange,
  onPageSizeChange,
  onQueryChange,
  compactTitle,
}: {
  rows: OrderRow[];
  page: number;
  pageSize: number;
  query: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onQueryChange: (query: string) => void;
  compactTitle?: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [
        row.code,
        row.customerName,
        row.phone,
        row.branchName,
        row.staffName,
        row.channelLabel,
        row.paymentMethod,
        row.carrier,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [rows, normalizedQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const pageTotals = useMemo(() => sumOrderRows(pageRows), [pageRows]);
  const allTotals = useMemo(() => sumOrderRows(filteredRows), [filteredRows]);

  useEffect(() => {
    if (safePage !== page) onPageChange(safePage);
  }, [safePage, page, onPageChange]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-950">
            {compactTitle || "Danh sách đơn theo bộ lọc"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Có {qty(filteredRows.length)} đơn. Kéo ngang thì header, dữ liệu và hai dòng tổng dịch cùng nhau theo đúng từng cột.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm mã đơn, khách, nhân viên, nguồn..."
            className="min-w-[280px] rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
          />
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            {[20, 50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value} đơn / trang
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="w-full max-w-full overflow-hidden rounded-2xl border border-neutral-200">
        <div
          ref={tableScrollRef}
          className="max-h-[68vh] w-full max-w-full overflow-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
        >
        <table className="w-max min-w-full text-sm">
          <thead className="sticky top-0 z-30 bg-neutral-50 shadow-[0_1px_0_rgba(0,0,0,0.12)]">
            <tr className="border-b border-neutral-200 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="sticky left-0 top-0 z-40 bg-neutral-50 px-3 py-3">Mã đơn</th>
              <th className="bg-neutral-50 px-3 py-3">Ngày</th>
              <th className="bg-neutral-50 px-3 py-3">Khách hàng</th>
              <th className="bg-neutral-50 px-3 py-3">Chi nhánh</th>
              <th className="bg-neutral-50 px-3 py-3">NV phụ trách</th>
              <th className="bg-neutral-50 px-3 py-3">Nguồn</th>
              <th className="bg-neutral-50 px-3 py-3">Trạng thái TT</th>
              <th className="bg-neutral-50 px-3 py-3">Nguồn tiền</th>
              <th className="bg-neutral-50 px-3 py-3">Trạng thái giao vận</th>
              <th className="bg-neutral-50 px-3 py-3">Trạng thái vận đơn</th>
              <th className="bg-neutral-50 px-3 py-3">Đơn vị VC</th>
              <th className="bg-neutral-50 px-3 py-3">Mã vận đơn</th>
              <th className="bg-neutral-50 px-3 py-3">Trạng thái đơn</th>
              <th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Tiền hàng</th>
              <th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Ship thu</th>
              <th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Ship trả</th>
              <th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Giảm giá</th>
              <th className="min-w-[150px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Doanh thu thuần</th>
              <th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Giá vốn</th>
              <th className="min-w-[130px] whitespace-nowrap bg-neutral-50 px-3 py-3 text-right">Lãi gộp</th>
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="group border-b border-neutral-100 hover:bg-neutral-50/70">
                <td className="sticky left-0 z-[1] bg-white px-3 py-3 font-bold">
                  {row.actionUrl ? (
                    <a className="hover:underline" href={row.actionUrl}>
                      {row.code}
                    </a>
                  ) : (
                    row.code
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{dateDisplay(row.createdAt)}</td>
                <td className="bg-neutral-50 px-3 py-3">
                  <div className="font-semibold">{row.customerName || "Khách lẻ"}</div>
                  <div className="mt-0.5 text-xs text-neutral-400">{row.phone || "—"}</div>
                </td>
                <td className="bg-neutral-50 px-3 py-3">{row.branchName || "—"}</td>
                <td className="bg-neutral-50 px-3 py-3">
                  <div className="font-semibold text-neutral-900">
                    {row.assignedStaffName || row.createdByStaffName || row.staffName || "Chưa rõ nhân viên"}
                  </div>
                  {!row.assignedStaffName && row.createdByStaffName ? (
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      Theo nhân viên tạo đơn
                    </div>
                  ) : null}
                </td>
                <td className="bg-neutral-50 px-3 py-3">{row.channelLabel || "—"}</td>
                <td className="bg-neutral-50 px-3 py-3">
                  <StatusBadge raw={row.paymentStatus} label={row.paymentStatusLabel || fallbackPaymentStatusLabel(row.paymentStatus)} />
                </td>
                <td className="bg-neutral-50 px-3 py-3">{row.paymentMethod || "—"}</td>
                <td className="bg-neutral-50 px-3 py-3">
                  <StatusBadge raw={row.fulfillmentStatus} label={row.fulfillmentStatusLabel || fallbackFulfillmentStatusLabel(row.fulfillmentStatus)} />
                </td>
                <td className="bg-neutral-50 px-3 py-3">
                  <StatusBadge raw={row.deliveryStatus} label={row.deliveryStatusLabel || fallbackDeliveryStatusLabel(row.deliveryStatus)} />
                </td>
                <td className="bg-neutral-50 px-3 py-3">{row.carrier || "—"}</td>
                <td className="bg-neutral-50 px-3 py-3">{row.trackingCode || "—"}</td>
                <td className="bg-neutral-50 px-3 py-3">
                  <StatusBadge raw={row.status} label={row.statusLabel || fallbackOrderStatusLabel(row.status)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(row.finalAmount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(row.shippingCharged)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(row.shippingCost)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(row.discount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                  {money(row.netRevenue)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {money(row.cost)}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-3 text-right font-bold ${
                    n(row.grossProfit) >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {money(row.grossProfit)}
                </td>
              </tr>
            ))}

            {!pageRows.length ? (
              <tr>
                <td colSpan={20} className="py-12 text-center text-neutral-400">
                  Không có đơn phù hợp.
                </td>
              </tr>
            ) : null}
          </tbody>

          {pageRows.length ? (
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-amber-50 font-extrabold text-neutral-950">
                <td className="bg-amber-50 px-3 py-3" colSpan={13}>
                  Tổng trang {safePage} · {qty(pageRows.length)} đơn
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(pageTotals.finalAmount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(pageTotals.shippingCharged)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(pageTotals.shippingCost)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(pageTotals.discount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(pageTotals.netRevenue)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(pageTotals.cost)}</td>
                <td
                  className={`px-3 py-3 text-right ${
                    pageTotals.grossProfit >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {money(pageTotals.grossProfit)}
                </td>
              </tr>
              <tr className="border-t border-neutral-200 bg-neutral-950 font-extrabold text-white">
                <td className="bg-neutral-950 px-3 py-3" colSpan={13}>
                  Tổng toàn bộ kết quả · {qty(filteredRows.length)} đơn
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(allTotals.finalAmount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(allTotals.shippingCharged)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(allTotals.shippingCost)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(allTotals.discount)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(allTotals.netRevenue)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{money(allTotals.cost)}</td>
                <td
                  className={`px-3 py-3 text-right ${
                    allTotals.grossProfit >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {money(allTotals.grossProfit)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold text-neutral-600">
          Hiển thị {filteredRows.length ? startIndex + 1 : 0}–
          {Math.min(startIndex + pageSize, filteredRows.length)} trên {qty(filteredRows.length)} đơn
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(1)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Đầu
          </button>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Trước
          </button>

          {paginationItems(safePage, totalPages).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} className="px-2 text-neutral-400">
                …
              </span>
            ) : (
              <button
                type="button"
                key={item}
                onClick={() => onPageChange(item)}
                className={`min-w-10 rounded-lg px-3 py-2 text-sm font-bold ${
                  item === safePage
                    ? "bg-neutral-950 text-white"
                    : "border border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Sau
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Cuối
          </button>
        </div>
      </div>
    </div>
  );
}
