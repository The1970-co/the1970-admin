"use client";

import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, Megaphone, RefreshCw, ShoppingBag, Truck, Wallet } from "lucide-react";

type AnyObj = Record<string, any>;
type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d";

type OrderLine = {
  qty?: number | string | null;
  quantity?: number | string | null;
  costPrice?: number | string | null;
  unitCost?: number | string | null;
  cost?: number | string | null;
  lineCost?: number | string | null;
  totalCost?: number | string | null;
  variant?: { costPrice?: number | string | null } | null;
  productVariant?: { costPrice?: number | string | null } | null;
};

type OrderRow = {
  id?: string | null;
  code?: string | null;
  orderCode?: string | null;
  status?: string | null;
  fulfillmentStatus?: string | null;
  deliveryStatus?: string | null;
  shippingStatus?: string | null;
  shipmentStatus?: string | null;
  salesChannel?: string | null;
  channel?: string | null;
  orderType?: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  finalAmount?: number | string | null;
  totalAmount?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  shipment?: AnyObj | null;
  items?: OrderLine[];
  orderItems?: OrderLine[];
  lines?: OrderLine[];
  orderLines?: OrderLine[];
  details?: OrderLine[];
};

type DailySuccessRow = {
  date: string;
  successOrders?: number;
  successAmount?: number;
  successCost?: number;
  posOrders?: number;
  facebookDeliveredOrders?: number;
};

type DailyCreatedRow = {
  date: string;
  createdOrders: number;
  createdAmount: number;
  createdCostEstimate: number;
  posCreatedOrders: number;
  posCreatedAmount: number;
  posCreatedCostEstimate: number;
  facebookCreatedOrders: number;
  facebookCreatedAmount: number;
  facebookCreatedCostEstimate: number;
  otherCreatedOrders: number;
  otherCreatedAmount: number;
  otherCreatedCostEstimate: number;
};

type WarRoomPayload = {
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
    totalCost?: number;
    pos?: { orders?: number; amount?: number; cost?: number };
    facebookDelivered?: { orders?: number; amount?: number; cost?: number };
    otherDelivered?: { orders?: number; amount?: number; cost?: number };
  };
  createdOrders?: OrderRow[];
  successOrders?: OrderRow[];
  dailySuccessRows?: DailySuccessRow[];
  orders?: OrderRow[];
};

type DisplayRow = {
  key: string;
  label: string;
  date: string;
  revenue: number;
  cost: number;
  ads: number;
  operatingCost: number;
  actualProfit: number;
  estimatedRevenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  orders: number;
  createdOrders: number;
  posCreatedOrders: number;
  facebookCreatedOrders: number;
  posCreatedAmount: number;
  facebookCreatedAmount: number;
  roas: number;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "10d", label: "10 ngày" },
  { key: "30d", label: "30 ngày" },
];

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || localStorage.getItem("the1970_access_token") || "";
}

async function fetchJson<T>(path: string): Promise<T> {
  const accessToken = getToken();
  if (!accessToken) {
    window.location.href = "/mobile/login";
    throw new Error("Thiếu token đăng nhập.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    credentials: "include",
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    window.location.href = "/mobile/login";
    throw new Error("Phiên đăng nhập hết hạn.");
  }

  if (!res.ok) throw new Error((await res.text()) || `Không tải được ${path}`);
  return res.json();
}

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function getDateRange(range: RangeKey) {
  const end = new Date();
  const start = new Date();
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === "7d") start.setDate(start.getDate() - 6);
  else if (range === "10d") start.setDate(start.getDate() - 9);
  else if (range === "30d") start.setDate(start.getDate() - 29);
  return { fromDate: dateInput(start), toDate: dateInput(end) };
}

function enumerateDateKeysDesc(fromDate: string, toDate: string, maxDays = 31) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const min = start <= end ? start : end;
  const max = start <= end ? end : start;
  const keys: string[] = [];
  for (let cursor = new Date(max); cursor >= min && keys.length < maxDays; cursor.setDate(cursor.getDate() - 1)) {
    keys.push(dateInput(cursor));
  }
  return keys;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  let raw = value.trim().toUpperCase();
  if (!raw) return 0;
  const multiplier = raw.endsWith("B") ? 1_000_000_000 : raw.endsWith("M") ? 1_000_000 : raw.endsWith("K") ? 1_000 : 1;
  let cleaned = raw.replace(/[₫đĐ]|VND/g, "").replace(/[^\d,.-]/g, "");

  if (/^-?\d{1,3}([.,]\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/[.,]/g, "");
  else if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  else if (cleaned.includes(",")) cleaned = cleaned.replace(",", ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

function compact(value: unknown) {
  const amount = toNumber(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${new Intl.NumberFormat("vi-VN").format(Math.round(abs))}`;
}

function count(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(toNumber(value)));
}

function normalizeStatusText(value?: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function isCancelledStatusValue(value?: unknown) {
  const text = normalizeStatusText(value);
  return Boolean(text && (text === "cancelled" || text === "canceled" || text === "cancel" || text.includes("da huy") || text.includes("huy don") || text.includes("huy")));
}

function isInternallyCancelledOrder(order: OrderRow) {
  return isCancelledStatusValue(order.status);
}

function isPosOrder(order: OrderRow) {
  const raw = `${order.salesChannel || ""} ${order.channel || ""} ${order.orderType || ""} ${order.paymentMethod || ""}`.toLowerCase();
  return raw.includes("pos") || raw.includes("bán lẻ") || raw.includes("ban le") || raw.includes("retail") || raw.includes("quầy") || raw.includes("quay");
}

function isFacebookOrder(order: OrderRow) {
  const raw = `${order.salesChannel || ""} ${order.channel || ""} ${order.orderType || ""} ${order.paymentMethod || ""} ${order.paymentType || ""}`.toLowerCase();
  return raw.includes("facebook") || raw.includes("fb") || raw.includes("meta") || raw.includes("cod") || raw.includes("giao hàng") || raw.includes("ship") || raw.includes("delivery");
}

function orderLinesOf(order: OrderRow): OrderLine[] {
  return order.items || order.orderItems || order.lines || order.orderLines || order.details || [];
}

function getOrderAmount(order: OrderRow) {
  return toNumber(order.finalAmount ?? order.totalAmount ?? 0);
}

function getLineCost(line: OrderLine) {
  const qty = toNumber(line.quantity ?? line.qty ?? 0);
  const direct = toNumber(line.lineCost ?? line.totalCost);
  if (direct > 0) return direct;
  const unit = toNumber(line.costPrice ?? line.unitCost ?? line.cost ?? line.variant?.costPrice ?? line.productVariant?.costPrice);
  return unit > 0 ? unit * qty : 0;
}

function getOrderCostEstimate(order: OrderRow) {
  return orderLinesOf(order).reduce((sum, line) => sum + getLineCost(line), 0);
}

function buildDailyCreatedRowsFromOrders(orders: OrderRow[]) {
  const map = new Map<string, DailyCreatedRow>();
  orders.filter((order) => !isInternallyCancelledOrder(order)).forEach((order) => {
    const rawDate = order.createdAt || order.updatedAt;
    if (!rawDate) return;
    const parsed = new Date(String(rawDate));
    if (Number.isNaN(parsed.getTime())) return;
    const date = dateInput(parsed);
    if (!map.has(date)) {
      map.set(date, {
        date,
        createdOrders: 0,
        createdAmount: 0,
        createdCostEstimate: 0,
        posCreatedOrders: 0,
        posCreatedAmount: 0,
        posCreatedCostEstimate: 0,
        facebookCreatedOrders: 0,
        facebookCreatedAmount: 0,
        facebookCreatedCostEstimate: 0,
        otherCreatedOrders: 0,
        otherCreatedAmount: 0,
        otherCreatedCostEstimate: 0,
      });
    }
    const row = map.get(date)!;
    const amount = getOrderAmount(order);
    const cost = getOrderCostEstimate(order);
    row.createdOrders += 1;
    row.createdAmount += amount;
    row.createdCostEstimate += cost;
    if (isPosOrder(order)) {
      row.posCreatedOrders += 1;
      row.posCreatedAmount += amount;
      row.posCreatedCostEstimate += cost;
    } else if (isFacebookOrder(order)) {
      row.facebookCreatedOrders += 1;
      row.facebookCreatedAmount += amount;
      row.facebookCreatedCostEstimate += cost;
    } else {
      row.otherCreatedOrders += 1;
      row.otherCreatedAmount += amount;
      row.otherCreatedCostEstimate += cost;
    }
  });
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function getDailyOperatingCost() {
  if (typeof window === "undefined") return 7_000_000;
  const raw = toNumber(window.localStorage.getItem("dashboard_daily_operating_cost"));
  const mode = window.localStorage.getItem("dashboard_operating_cost_mode");
  const value = mode === "monthly" ? Math.round(raw / 30) : raw;

  // Mobile localhost thường không chung localStorage với trang web production /control.
  // Web hiện đang phân bổ 7.000.000/ngày, nên dùng cùng default này khi mobile chưa có key lưu sẵn.
  return value > 0 ? value : 7_000_000;
}

function getOverviewDailyRows(overview: AnyObj | null): AnyObj[] {
  return Array.isArray(overview?.dailyRows) ? overview!.dailyRows : [];
}

function rowDateKey(row: AnyObj) {
  if (row.date) return String(row.date).slice(0, 10);
  const day = String(row.day || "").padStart(2, "0");
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${day}`;
}

function makeEmptyRow(date: string): DisplayRow {
  const today = dateInput(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateInput(yesterday);
  return {
    key: date,
    label: date === today ? "Hôm nay" : date === yesterdayKey ? "Hôm qua" : "Trong tháng",
    date,
    revenue: 0,
    cost: 0,
    ads: 0,
    operatingCost: 0,
    actualProfit: 0,
    estimatedRevenue: 0,
    estimatedCost: 0,
    estimatedProfit: 0,
    orders: 0,
    createdOrders: 0,
    posCreatedOrders: 0,
    facebookCreatedOrders: 0,
    posCreatedAmount: 0,
    facebookCreatedAmount: 0,
    roas: 0,
  };
}

function KPI({ label, value, sub, icon, dark = false }: { label: string; value: string; sub: string; icon: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`${dark ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"} rounded-[1.75rem] p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-neutral-400"}`}>{label}</div>
          <div className="mt-4 text-4xl font-black tracking-tight">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${dark ? "bg-white text-neutral-950" : "bg-neutral-100"}`}>{icon}</div>
      </div>
      <div className={`mt-3 text-sm leading-5 ${dark ? "text-white/55" : "text-neutral-500"}`}>{sub}</div>
    </div>
  );
}

function TinyBar({ value, max }: { value: number; max: number }) {
  const width = Math.max(8, Math.min(100, Math.round((Math.abs(value) / Math.max(max, 1)) * 100)));
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-neutral-950" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function MobileReportOverviewPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [overview, setOverview] = useState<AnyObj | null>(null);
  const [warRoom, setWarRoom] = useState<WarRoomPayload | null>(null);
  const [operatingCost, setOperatingCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const dateRange = getDateRange(range);
      const query = new URLSearchParams({
        range,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        dateFrom: dateRange.fromDate,
        dateTo: dateRange.toDate,
      });
      const [overviewPayload, warRoomPayload] = await Promise.all([
        fetchJson<AnyObj>(`/dashboard/overview?range=${range}&fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}&branchId=ALL`),
        fetchJson<WarRoomPayload>(`/shipments/war-room/delivery-revenue?${query.toString()}`),
      ]);
      setOverview(overviewPayload || null);
      setWarRoom(warRoomPayload || null);
      setOperatingCost(getDailyOperatingCost());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<DisplayRow[]>(() => {
    const dateRange = getDateRange(range);
    const dateKeys = enumerateDateKeysDesc(dateRange.fromDate, dateRange.toDate, range === "30d" ? 30 : 10);
    const overviewRows = new Map<string, AnyObj>();
    getOverviewDailyRows(overview).forEach((row) => overviewRows.set(rowDateKey(row), row));
    const successRows = new Map<string, DailySuccessRow>();
    (warRoom?.dailySuccessRows || []).forEach((row) => row?.date && successRows.set(String(row.date).slice(0, 10), row));
    const createdRows = new Map<string, DailyCreatedRow>();
    const createdSourceOrders = Array.isArray(warRoom?.createdOrders) ? warRoom!.createdOrders! : Array.isArray(warRoom?.orders) ? warRoom!.orders! : [];
    buildDailyCreatedRowsFromOrders(createdSourceOrders).forEach((row) => createdRows.set(row.date, row));

    return dateKeys.map((date) => {
      const base = makeEmptyRow(date);
      const overviewRow = overviewRows.get(date) || {};
      const raw = overviewRow.raw && typeof overviewRow.raw === "object" ? overviewRow.raw : {};
      const successRow = successRows.get(date);
      const createdRow = createdRows.get(date);
      const revenue = successRow ? toNumber(successRow.successAmount) : toNumber(raw.revenue ?? overviewRow.revenue);
      const cost = successRow ? toNumber(successRow.successCost) : toNumber(raw.cost ?? overviewRow.cost);
      const ads = toNumber(raw.adsCost ?? overviewRow.adsCost);
      const orders = successRow ? toNumber(successRow.successOrders) : toNumber(raw.orders ?? overviewRow.orders);
      const posCreatedAmount = toNumber(createdRow?.posCreatedAmount);
      const facebookCreatedAmount = toNumber(createdRow?.facebookCreatedAmount);
      const estimatedRevenue = posCreatedAmount + facebookCreatedAmount;
      const directCreatedCost = toNumber(createdRow?.posCreatedCostEstimate) + toNumber(createdRow?.facebookCreatedCostEstimate);
      const successCostRate = revenue > 0 && cost > 0 ? cost / revenue : 0;
      const estimatedCost = directCreatedCost > 0 ? directCreatedCost : estimatedRevenue > 0 ? Math.round(estimatedRevenue * (successCostRate || 0.42)) : 0;
      const actualProfit = revenue - cost - ads - operatingCost;
      const estimatedProfit = estimatedRevenue - estimatedCost - ads - operatingCost;
      return {
        ...base,
        label: String(overviewRow.note || base.label),
        revenue,
        cost,
        ads,
        operatingCost,
        actualProfit,
        estimatedRevenue,
        estimatedCost,
        estimatedProfit,
        orders,
        createdOrders: toNumber(createdRow?.createdOrders),
        posCreatedOrders: toNumber(createdRow?.posCreatedOrders),
        facebookCreatedOrders: toNumber(createdRow?.facebookCreatedOrders),
        posCreatedAmount,
        facebookCreatedAmount,
        roas: ads > 0 ? revenue / ads : 0,
      };
    });
  }, [overview, warRoom, range, operatingCost]);

  const model = useMemo(() => {
    const targetDate = getDateRange(range).toDate;
    const row = rows.find((item) => item.date === targetDate) || rows[0] || makeEmptyRow(targetDate);
    const revenueSuccess = warRoom?.revenueSuccess || {};
    const successPosAmount = toNumber(revenueSuccess.pos?.amount);
    const successFacebookAmount = toNumber(revenueSuccess.facebookDelivered?.amount);
    const successOtherAmount = toNumber(revenueSuccess.otherDelivered?.amount);
    const successAmount = toNumber(revenueSuccess.totalAmount) || successPosAmount + successFacebookAmount + successOtherAmount || row.revenue;
    const successCost = toNumber(revenueSuccess.totalCost) || row.cost;
    const successOrders = toNumber(revenueSuccess.totalOrders) || row.orders;

    // Giống web: card Đơn tạo lấy từ createdOrders đã lọc huỷ nội bộ,
    // không dùng thẳng orderCreated.total/amount vì payload đó có thể còn chứa đơn huỷ.
    const createdTotal = row.createdOrders;
    const createdAmount = row.estimatedRevenue;
    const estimatedRevenue = row.estimatedRevenue;
    const estimatedCost = row.estimatedCost;

    // Giống web: lợi nhuận card lấy netProfit / estimatedCreatedNetProfit từ dòng đã merge
    // success row + ads + chi phí vận hành.
    const actualProfit = row.actualProfit;
    const estimatedProfit = row.estimatedProfit;
    return {
      revenue: successAmount,
      successOrders,
      createdOrders: createdTotal,
      createdAmount,
      estimatedRevenue,
      adsCost: row.ads,
      operatingCost,
      actualProfit,
      estimatedProfit,
      roas: row.ads > 0 ? successAmount / row.ads : 0,
    };
  }, [rows, warRoom, range, operatingCost]);

  const maxRevenue = Math.max(...rows.map((row) => row.revenue), model.revenue, 1);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/mobile" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="text-center"><div className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">War Room</div><div className="text-lg font-black">Hiệu quả hôm nay</div></div>
          <button type="button" onClick={() => void load(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} /></button>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {RANGE_OPTIONS.map((item) => (
            <button key={item.key} type="button" onClick={() => setRange(item.key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${range === item.key ? "bg-neutral-950 text-white" : "bg-white text-neutral-600"}`}>{item.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[1.75rem] bg-white" />)}</div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
        ) : (
          <div className="space-y-4">
            <KPI dark label="Revenue success" value={compact(model.revenue)} sub={`Doanh thu thành công · ${count(model.successOrders)} đơn`} icon={<Wallet className="h-5 w-5" />} />
            <div className="grid grid-cols-2 gap-3">
              <KPI label="Đơn tạo hôm nay" value={count(model.createdOrders)} sub={`Tổng tiền tạo ${compact(model.createdAmount)}`} icon={<Truck className="h-5 w-5" />} />
              <KPI label="Ads realtime" value={compact(model.adsCost)} sub={model.roas ? `ROAS ${model.roas.toFixed(2)}x` : "Chi phí ads hôm nay"} icon={<Megaphone className="h-5 w-5" />} />
              <KPI label="Lợi nhuận thực tế" value={compact(model.actualProfit)} sub="Theo đơn đã giao" icon={<ShoppingBag className="h-5 w-5" />} dark />
              <KPI label="Ước tính" value={compact(model.estimatedProfit)} sub="Theo đơn tạo - huỷ" icon={<ShoppingBag className="h-5 w-5" />} />
            </div>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="text-lg font-black">Bảng lãi lỗ tạm tính</h2><p className="mt-1 text-sm text-neutral-500">Doanh thu, giá vốn, ads, vận hành và lợi nhuận theo ngày.</p></div>
                <CalendarDays className="h-5 w-5 text-neutral-400" />
              </div>
              <div className="space-y-3">
                {rows.length === 0 ? <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa tìm thấy data War Room.</div> : rows.slice(0, 10).map((row) => (
                  <div key={row.key} className="rounded-2xl bg-neutral-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black">{row.label}</div>
                        <div className="mt-1 text-xs text-neutral-500">{count(row.orders)} đơn · vốn {compact(row.cost)} · ads {compact(row.ads)}</div>
                        <div className="mt-1 text-xs text-neutral-500">Ước tính {compact(row.estimatedRevenue)} · vận hành {compact(row.operatingCost)}</div>
                        <div className="mt-1 text-xs text-neutral-400">{formatDateDisplay(row.date)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black">{compact(row.revenue)}</div>
                        <div className={`mt-1 text-xs ${row.actualProfit < 0 ? "text-rose-600" : "text-emerald-700"}`}>Thực tế {compact(row.actualProfit)}</div>
                        <div className="mt-1 text-xs text-sky-700">Ước {compact(row.estimatedProfit)}</div>
                      </div>
                    </div>
                    <TinyBar value={row.revenue} max={maxRevenue} />
                  </div>
                ))}
              </div>
            </section>
            <Link href="/mobile/finance/daily" className="flex items-center justify-between rounded-[1.75rem] bg-white p-5 font-bold shadow-sm"><span>Mở tổng quan nguồn tiền</span><ChevronRight className="h-5 w-5" /></Link>
          </div>
        )}
        <MobileBottomNav />
      </div>
    </div>
  );
}
