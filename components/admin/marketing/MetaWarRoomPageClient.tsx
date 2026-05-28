"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d" | "custom";
type SignalTone = "success" | "warning" | "danger" | "info";

type ProductRow = {
  key?: string;
  sku?: string;
  familySku?: string;
  productName?: string;
  orderCount?: number;
  quantity?: number;
  revenue?: number;
  averageOrderValue?: number;
  sources?: Record<string, number>;
};

type ProductsPayload = {
  totalProducts?: number;
  totalOrders?: number;
  totalQuantity?: number;
  totalRevenue?: number;
  rows?: ProductRow[];
};

type AdGroup = {
  key: string;
  sku: string;
  name: string;
  rows: any[];
  product?: ProductRow;
  spend: number;
  messages: number;
  comments: number;
  reach: number;
  clicks: number;
  orders: number;
  revenue: number;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:3001" : "")
).replace(/\/$/, "");

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string }> = [
  { id: "today", label: "Hôm nay" },
  { id: "yesterday", label: "Hôm qua" },
  { id: "7d", label: "7 ngày" },
  { id: "10d", label: "10 ngày" },
  { id: "30d", label: "30 ngày" },
  { id: "custom", label: "Tùy chọn" },
];

function token() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("accessToken") || window.localStorage.getItem("token") || "";
}

async function apiJson<T>(path: string): Promise<T> {
  const auth = token();
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.message || `API lỗi ${res.status}`);
  return payload as T;
}

function n(v: unknown) {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}

function money(v: unknown) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n(v)))}đ`;
}

function compact(v: unknown) {
  const x = n(v);
  if (x >= 1_000_000_000) return `${(x / 1_000_000_000).toFixed(1)}B`;
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1)}M`;
  if (x >= 1_000) return `${Math.round(x / 1_000)}K`;
  return `${Math.round(x)}`;
}

function pct(v: unknown) {
  return `${n(v).toFixed(2)}%`;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const x = n(value);
    if (x > 0) return x;
  }
  return 0;
}

function metric(row: any, key: string) {
  return firstNumber(row?.metrics?.[key], row?.[key], row?.summary?.[key], row?.meta?.[key]);
}

function rowName(row: any) {
  return row?.name || row?.adName || row?.campaignName || row?.adSetName || "Ads không tên";
}

function spend(row: any) {
  return metric(row, "spend");
}

function ctr(row: any) {
  return metric(row, "ctr");
}

function clicks(row: any) {
  return firstNumber(row?.metrics?.clicks, row?.metrics?.inlineLinkClicks, row?.clicks, row?.inlineLinkClicks);
}

function reach(row: any) {
  return firstNumber(row?.metrics?.reach, row?.reach);
}

function cpa(row: any) {
  return firstNumber(row?.metrics?.costPerResult, row?.metrics?.costPerMessage, row?.metrics?.cpa, row?.costPerResult, row?.cpa);
}

function messages(row: any) {
  return firstNumber(row?.metrics?.conversationStarts, row?.metrics?.messages, row?.conversationStarts, row?.messages, row?.results);
}

function comments(row: any) {
  return firstNumber(row?.metrics?.comments, row?.metrics?.postComments, row?.comments, row?.postComments);
}

function directOrders(row: any) {
  return firstNumber(row?.systemOrders, row?.orderCount, row?.orders, row?.productAttribution?.orderCount, row?.attribution?.orders, row?.matchedOrders);
}

function directRevenue(row: any) {
  return firstNumber(row?.systemRevenue, row?.revenue, row?.productAttribution?.revenue, row?.attribution?.revenue, row?.matchedRevenue);
}

function thumb(row: any) {
  return row?.thumbnailUrl || row?.imageUrl || row?.creativeThumbnailUrl || row?.adCreativeThumbnailUrl || row?.picture || "";
}

function normalizeSku(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractSku(row: any) {
  const direct = normalizeSku(row?.sku || row?.familySku || row?.matchedSku || row?.productSku || row?.skuFamily || row?.product?.sku);
  if (direct) return direct;
  const name = rowName(row).toUpperCase();
  const match = name.match(/\b[A-Z]{2,5}\d{3,4}\b/);
  return normalizeSku(match?.[0] || "UNKNOWN");
}

function rangeQuery(range: RangeKey, fromDate: string, toDate: string) {
  if (range === "custom" && fromDate && toDate) return `range=custom&fromDate=${fromDate}&toDate=${toDate}`;
  return `range=${range}`;
}

function statusFromNumbers(s: number, o: number, c: number) {
  if (o >= 3) return { label: "Có đơn", cls: "bg-emerald-100 text-emerald-700" };
  if (s >= 1_500_000 && o <= 0) return { label: "Đốt tiền", cls: "bg-rose-100 text-rose-700" };
  if (c >= 3) return { label: "CTR tốt", cls: "bg-sky-100 text-sky-700" };
  if (s > 0) return { label: "Đang tiêu", cls: "bg-amber-100 text-amber-700" };
  return { label: "Theo dõi", cls: "bg-neutral-100 text-neutral-600" };
}

function Kpi({ label, value, sub, className = "" }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${className || "border-neutral-200 bg-white"}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">{value}</div>
      <div className="mt-1 min-h-[18px] text-xs font-semibold text-neutral-500">{sub || "—"}</div>
    </div>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-neutral-100">
      <div className="h-2 rounded-full bg-neutral-950" style={{ width: `${width}%` }} />
    </div>
  );
}

function SignalCard({ tone, title, sub }: { tone: SignalTone; title: string; sub: string }) {
  const cls =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-sky-200 bg-sky-50 text-sky-700";
  return (
    <div className={`rounded-2xl border p-3 ${cls}`}>
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-1 text-xs font-medium opacity-80">{sub}</div>
    </div>
  );
}

function AdChildRow({ row, maxSpend }: { row: any; maxSpend: number }) {
  const s = spend(row);
  const msg = messages(row);
  const msgCost = msg > 0 ? s / msg : 0;
  const img = thumb(row);
  const st = statusFromNumbers(s, directOrders(row), ctr(row));
  return (
    <div className="grid grid-cols-[44px_1fr_92px_92px_74px_74px] items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-3 text-sm max-lg:grid-cols-[44px_1fr] max-lg:gap-y-2">
      <div className="h-11 w-11 overflow-hidden rounded-xl bg-neutral-100">
        {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[9px] font-bold text-neutral-400">ADS</div>}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-1 font-bold">{rowName(row)}</div>
        <div className="mt-1"><MiniBar value={s} max={maxSpend} /></div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-neutral-500">
          <span className="text-sky-700">CP tin: {msgCost ? money(msgCost) : "—"}</span>
          <span>Reach: {compact(reach(row))}</span>
          <span>Click: {compact(clicks(row))}</span>
        </div>
      </div>
      <div className="font-bold max-lg:col-span-2">
        <div>{money(s)}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-neutral-500">chi tiêu</div>
      </div>
      <div className="font-semibold text-neutral-600 max-lg:hidden">
        <div>{compact(msg)} tin</div>
        <div className="mt-0.5 text-[11px] font-bold text-sky-700">{msgCost ? money(msgCost) : "—"}/tin</div>
      </div>
      <div className="font-semibold text-neutral-600 max-lg:hidden">CTR {pct(ctr(row))}</div>
      <div className="max-lg:hidden"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span></div>
    </div>
  );
}

function GroupTreeCard({ group, maxSpend }: { group: AdGroup; maxSpend: number }) {
  const [open, setOpen] = useState(true);
  const roas = group.spend > 0 && group.revenue > 0 ? group.revenue / group.spend : 0;
  const avgCpa = group.orders > 0 ? group.spend / group.orders : 0;
  const avgMsgCost = group.messages > 0 ? group.spend / group.messages : 0;
  const st = statusFromNumbers(group.spend, group.orders, group.messages ? (group.clicks / Math.max(1, group.reach)) * 100 : 0);

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full p-4 text-left transition hover:bg-neutral-50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">SKU tree · {group.sku}</div>
            <h3 className="mt-1 line-clamp-2 text-xl font-black">{group.name}</h3>
            <div className="mt-1 text-xs font-semibold text-neutral-500">{group.rows.length} ads con · đơn FB/hệ thống đã khử trùng theo SKU/order</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{open ? "Thu gọn" : "Mở cây"}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-6">
          <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Spend</div><div className="mt-1 text-lg font-black">{money(group.spend)}</div></div>
          <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Tin</div><div className="mt-1 text-lg font-black">{compact(group.messages)}</div></div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><div className="text-[10px] font-bold uppercase">Đơn FB/hệ thống</div><div className="mt-1 text-lg font-black">{compact(group.orders)}</div></div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><div className="text-[10px] font-bold uppercase">Doanh thu</div><div className="mt-1 text-lg font-black">{compact(group.revenue)}</div></div>
          <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">CPA đơn</div><div className="mt-1 text-lg font-black">{avgCpa ? compact(avgCpa) : "—"}</div></div>
          <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">ROAS</div><div className="mt-1 text-lg font-black">{roas ? `${roas.toFixed(2)}x` : "—"}</div></div>
        </div>
        <div className="mt-3"><MiniBar value={group.spend} max={maxSpend} /></div>
        <div className="mt-2 text-xs font-semibold text-neutral-500"><span className="text-sky-700">CP tin: {avgMsgCost ? money(avgMsgCost) : "—"}</span> · Reach: {compact(group.reach)} · Click: {compact(group.clicks)}</div>
      </button>
      {open ? <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/60 p-3">{group.rows.map((row, i) => <AdChildRow key={row?.id || row?.metaAdId || i} row={row} maxSpend={Math.max(...group.rows.map(spend), 1)} />)}</div> : null}
    </div>
  );
}

export default function MetaWarRoomPageClient() {
  const [range, setRange] = useState<RangeKey>("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ads, setAds] = useState<any>(null);
  const [products, setProducts] = useState<ProductsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  async function load(nextRange = range) {
    if (nextRange === "custom" && (!fromDate || !toDate)) return;
    setLoading(true);
    setError("");
    try {
      const q = rangeQuery(nextRange, fromDate, toDate);
      const [a, p] = await Promise.all([
        apiJson<any>(`/meta-ads/live-insights?${q}&level=ad&limit=1000`),
        apiJson<ProductsPayload>(`/meta-ads/product-performance?${q}&limit=150&sourceMode=all&orderMode=valid`),
      ]);
      setAds(a);
      setProducts(p);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      setError(err?.message || "Không tải được Meta War Room");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    const timer = setInterval(() => load(range), 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, fromDate, toDate]);

  const summary = ads?.summary || {};
  const adRows: any[] = useMemo(() => {
    const raw = ads?.topAds || ads?.rows || ads?.items || [];
    return Array.isArray(raw) ? raw : [];
  }, [ads]);

  const productsRows = useMemo(() => products?.rows || [], [products]);
  const productMap = useMemo(() => {
    const map = new Map<string, ProductRow>();
    productsRows.forEach((row) => {
      const sku = normalizeSku(row.sku || row.familySku || row.key);
      if (sku) map.set(sku, row);
    });
    return map;
  }, [productsRows]);

  const hotAds = useMemo(() => [...adRows].filter((row) => spend(row) > 0).sort((a, b) => spend(b) - spend(a)).slice(0, 80), [adRows]);
  const groups = useMemo<AdGroup[]>(() => {
    const map = new Map<string, AdGroup>();
    hotAds.forEach((row) => {
      const sku = extractSku(row);
      const product = productMap.get(sku);
      const key = sku || row?.campaignId || row?.adSetId || "UNKNOWN";
      const group = map.get(key) || {
        key,
        sku,
        name: product?.productName || sku || rowName(row),
        product,
        rows: [],
        spend: 0,
        messages: 0,
        comments: 0,
        reach: 0,
        clicks: 0,
        orders: 0,
        revenue: 0,
      };
      group.rows.push(row);
      group.spend += spend(row);
      group.messages += messages(row);
      group.comments += comments(row);
      group.reach += reach(row);
      group.clicks += clicks(row);
      if (!group.product && product) group.product = product;
      if (!group.name || group.name === "UNKNOWN") group.name = product?.productName || rowName(row);
      map.set(key, group);
    });

    return Array.from(map.values()).map((group) => {
      const directOrderSum = group.rows.reduce((sum, row) => sum + directOrders(row), 0);
      const directRevenueSum = group.rows.reduce((sum, row) => sum + directRevenue(row), 0);
      return {
        ...group,
        orders: firstNumber(group.product?.orderCount, directOrderSum),
        revenue: firstNumber(group.product?.revenue, directRevenueSum),
      };
    }).sort((a, b) => b.spend - a.spend);
  }, [hotAds, productMap]);

  const topProducts = useMemo(() => [...productsRows].sort((a, b) => n(b.revenue) - n(a.revenue)).slice(0, 10), [productsRows]);
  const maxGroupSpend = groups.reduce((max, group) => Math.max(max, group.spend), 0);

  const totals = useMemo(() => {
    const spendTotal = firstNumber(summary?.spend, hotAds.reduce((sum, row) => sum + spend(row), 0));
    const msgTotal = firstNumber(summary?.conversationStarts, summary?.messages, hotAds.reduce((sum, row) => sum + messages(row), 0));
    const purchaseTotal = firstNumber(summary?.metaPurchases, summary?.metaPurchase, summary?.purchaseMeta, summary?.purchaseCount, summary?.purchaseConversions);
    const orderTotal = n(products?.totalOrders);
    const revenueTotal = n(products?.totalRevenue);
    const hotCount = groups.filter((group) => group.orders > 0 || group.spend >= 1_000_000).length;
    return { spendTotal, msgTotal, purchaseTotal, orderTotal, revenueTotal, hotCount };
  }, [summary, hotAds, products, groups]);

  const signals = useMemo(() => {
    const list: Array<{ tone: SignalTone; title: string; sub: string }> = [];
    groups.slice(0, 8).forEach((group) => {
      const avgCpa = group.orders > 0 ? group.spend / group.orders : 0;
      const roas = group.spend > 0 && group.revenue > 0 ? group.revenue / group.spend : 0;
      if (group.spend >= 1_500_000 && group.orders <= 0) list.push({ tone: "danger", title: "SKU đang đốt tiền chưa ra đơn", sub: `${group.name} · ${money(group.spend)} · ${group.rows.length} ads con` });
      else if (group.orders >= 3 && roas >= 2) list.push({ tone: "success", title: "SKU đang kéo đơn tốt", sub: `${group.name} · ${compact(group.orders)} đơn · ROAS ${roas.toFixed(2)}x` });
      else if (group.orders >= 1) list.push({ tone: "info", title: "SKU có đơn cần theo dõi", sub: `${group.name} · CPA ${avgCpa ? money(avgCpa) : "—"} · ${compact(group.orders)} đơn` });
    });
    topProducts.slice(0, 4).forEach((row) => {
      if (n(row.orderCount) >= 3) list.push({ tone: "success", title: "Sản phẩm đang tạo đơn", sub: `${row.productName || row.sku} · ${compact(row.orderCount)} đơn · ${money(row.revenue)}` });
    });
    return list.slice(0, 10);
  }, [groups, topProducts]);

  return (
    <main className="min-h-screen bg-[#f6f6f6] p-4 font-sans text-neutral-950">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="bg-neutral-950 px-5 py-7 text-white md:px-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">Meta War Room · SKU Tree V8</div>
                <h1 className="mt-2 font-serif text-[34px] font-medium tracking-tight md:text-[44px]">Theo dõi ads realtime</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">Gom ads con theo SKU/campaign để nhìn nhanh spend, chi phí tin nhắn, đơn FB/hệ thống và doanh thu đã khử trùng. Không cộng trùng đơn giữa nhiều ads con.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-neutral-200">Cập nhật {lastUpdated || "—"}</span>
                <button onClick={() => load(range)} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-neutral-950">{loading ? "Đang tải" : "Tải lại"}</button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-4">
            {RANGE_OPTIONS.map((item) => (
              <button key={item.id} onClick={() => setRange(item.id)} className={`rounded-full border px-4 py-2 text-sm font-bold ${range === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}>{item.label}</button>
            ))}
            {range === "custom" ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold" />
                <button onClick={() => load("custom")} className="h-10 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white">Áp dụng</button>
              </div>
            ) : null}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Chi phí ads" value={money(totals.spendTotal)} sub="Meta official live" className="border-amber-200 bg-amber-50" />
          <Kpi label="Tin nhắn" value={compact(totals.msgTotal)} sub={totals.msgTotal ? `${money(totals.spendTotal / totals.msgTotal)} / tin` : "—"} />
          <Kpi label="Lượt mua Meta" value={compact(totals.purchaseTotal)} sub={totals.purchaseTotal ? `CPA ${money(totals.spendTotal / totals.purchaseTotal)}` : "Không chạy mục tiêu mua"} />
          <Kpi label="Đơn hệ thống" value={compact(totals.orderTotal)} sub={`${money(totals.revenueTotal)} doanh thu`} className="border-emerald-200 bg-emerald-50" />
          <Kpi label="Nhóm SKU nóng" value={`${totals.hotCount}/${groups.length}`} sub="Có đơn hoặc đang tiêu mạnh" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Ads đang tiêu tiền · dạng cây theo SKU</h2>
                <p className="mt-1 text-sm font-medium text-neutral-500">Mỗi cây là 1 SKU chính/campaign. Đơn và doanh thu lấy theo product-performance đã khử trùng nên không còn hiện 0 sai khi ads con có đơn.</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{groups.length} nhóm</span>
            </div>
            {groups.length ? <div className="space-y-3">{groups.map((group) => <GroupTreeCard key={group.key} group={group} maxSpend={maxGroupSpend} />)}</div> : <div className="rounded-3xl border border-dashed border-neutral-200 p-12 text-center text-sm font-semibold text-neutral-400">Chưa có ads đang tiêu tiền trong khoảng này.</div>}
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Tín hiệu nóng</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">LIVE</span></div>
              <div className="mt-4 space-y-2">{signals.length ? signals.map((s, i) => <SignalCard key={i} {...s} />) : <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-sm font-semibold text-neutral-400">Chưa có tín hiệu nóng.</div>}</div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Sản phẩm tạo đơn</h2><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">Top 10</span></div>
              <div className="mt-4 space-y-2">
                {topProducts.map((row, i) => (
                  <div key={row.key || row.sku || i} className="flex items-center justify-between rounded-2xl bg-emerald-50 p-3">
                    <div className="min-w-0"><div className="truncate text-sm font-bold">{i + 1}. {row.productName || row.sku}</div><div className="text-xs font-bold text-emerald-700">{row.sku || row.familySku || "—"}</div></div>
                    <div className="text-right"><div className="font-bold">{compact(row.orderCount)} đơn</div><div className="text-xs font-semibold text-neutral-500">{money(row.revenue)}</div></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Hàng đợi vận hành</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-neutral-950 p-4 text-white"><div className="text-xs uppercase tracking-[0.14em] text-neutral-500">Nhóm nên giữ / scale</div><div className="mt-2 text-3xl font-bold">{groups.filter((g) => g.orders >= 3).length}</div><div className="mt-1 text-xs text-neutral-400">Có đơn FB/hệ thống</div></div>
                <div className="rounded-2xl bg-rose-50 p-4 text-rose-700"><div className="text-xs font-bold uppercase tracking-[0.14em]">Nhóm cần soi</div><div className="mt-2 text-3xl font-bold">{groups.filter((g) => g.spend >= 1_500_000 && g.orders <= 0).length}</div><div className="mt-1 text-xs font-semibold">Spend cao chưa có đơn</div></div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
