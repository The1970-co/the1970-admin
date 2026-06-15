"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d" | "custom";
type SortKey = "revenue" | "orders" | "quantity" | "aov" | "heat";
type SourceKey = "all" | "facebook" | "pos" | "adsLive";
type ProductStatus = "winner" | "scale" | "watch" | "weak";

type ProductRow = {
  key: string;
  sku?: string;
  productName: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  averageOrderValue: number;
  statuses?: Record<string, number>;
  sources?: Record<string, number>;
  sampleOrders?: Array<{ orderCode?: string; status?: string; revenue?: number; createdAt?: string }>;
};

type Payload = {
  ok?: boolean;
  range?: { since?: string; until?: string };
  totalProducts?: number;
  totalOrders?: number;
  totalQuantity?: number;
  totalRevenue?: number;
  rows?: ProductRow[];
  note?: string;
};

type LiveAdRow = {
  id?: string;
  name?: string;
  campaignName?: string | null;
  adSetName?: string | null;
  status?: string | null;
  effectiveStatus?: string | null;
  thumbnailUrl?: string | null;
  metrics?: Record<string, any>;
  productAttribution?: { familySku?: string | null; sku?: string | null; productSku?: string | null };
  familySku?: string | null;
  sku?: string | null;
  spend?: number;
};

type LiveAdsPayload = {
  ok?: boolean;
  rows?: LiveAdRow[];
  items?: LiveAdRow[];
  topAds?: LiveAdRow[];
};

type SkuAdInfo = {
  sku: string;
  ads: number;
  activeAds: number;
  spend: number;
  status: "live" | "off" | "none";
  names: string[];
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

function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("accessToken") || window.localStorage.getItem("token") || "";
}

async function apiJson<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.message || `API lỗi ${res.status}`);
  return payload as T;
}

function todayInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
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

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function normalizeSku(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function extractSkuFromText(...parts: Array<string | null | undefined>) {
  const text = parts.filter(Boolean).join(" ").replace(/[_-]+/g, " ");
  const matches = text.match(/\b[A-Z]{2,5}\d{3,5}\b/gi) || [];
  return normalizeSku(matches[0]);
}

function adSpend(row: LiveAdRow) {
  return n(row?.metrics?.spend ?? row?.spend);
}

function isAdActive(row: LiveAdRow) {
  const status = String(row.effectiveStatus || row.status || "").toUpperCase();
  return status.includes("ACTIVE") || status.includes("ĐANG") || status.includes("RUN");
}

function buildSkuAdMap(payload: LiveAdsPayload | null): Record<string, SkuAdInfo> {
  const raw = [
    ...(Array.isArray(payload?.topAds) ? payload!.topAds! : []),
    ...(Array.isArray(payload?.rows) ? payload!.rows! : []),
    ...(Array.isArray(payload?.items) ? payload!.items! : []),
  ];
  const map: Record<string, SkuAdInfo> = {};

  for (const row of raw) {
    const sku = normalizeSku(row.productAttribution?.familySku || row.productAttribution?.sku || row.productAttribution?.productSku || row.familySku || row.sku) ||
      extractSkuFromText(row.name, row.campaignName, row.adSetName);
    if (!sku) continue;

    if (!map[sku]) {
      map[sku] = { sku, ads: 0, activeAds: 0, spend: 0, status: "none", names: [] };
    }

    map[sku].ads += 1;
    map[sku].spend += adSpend(row);
    if (isAdActive(row)) map[sku].activeAds += 1;
    if (row.name && !map[sku].names.includes(row.name)) map[sku].names.push(row.name);
  }

  for (const item of Object.values(map)) {
    item.status = item.activeAds > 0 ? "live" : item.ads > 0 ? "off" : "none";
  }

  return map;
}

function adInfoForProduct(row: ProductRow, skuAdMap: Record<string, SkuAdInfo>) {
  const sku = normalizeSku(row.sku || row.key) || extractSkuFromText(row.productName);
  return skuAdMap[sku];
}

function sourceCount(row: ProductRow, key: SourceKey) {
  if (key === "all" || key === "adsLive") return n(row.orderCount);
  const sources = row.sources || {};
  if (key === "facebook") return n(sources.Facebook || sources.facebook || sources.FACEBOOK || sources.FACEBOOK_MANUAL);
  return n(sources.POS || sources.pos);
}

function sourceRevenueApprox(row: ProductRow, key: SourceKey) {
  if (key === "all") return n(row.revenue);
  const orders = n(row.orderCount);
  if (!orders) return 0;
  return Math.round(n(row.revenue) * (sourceCount(row, key) / orders));
}

function heat(row: ProductRow) {
  const orderScore = Math.min(42, n(row.orderCount) * 5);
  const revenueScore = Math.min(38, n(row.revenue) / 180_000);
  const quantityScore = Math.min(20, n(row.quantity) * 1.4);
  return Math.round(Math.min(100, orderScore + revenueScore + quantityScore));
}

function productState(row: ProductRow): { key: ProductStatus; label: string; cls: string; hint: string; border: string } {
  const h = heat(row);
  if (n(row.orderCount) >= 8 || h >= 75) {
    return {
      key: "winner",
      label: "WINNER",
      cls: "bg-emerald-100 text-emerald-700",
      border: "border-emerald-200 bg-emerald-50/40",
      hint: "Đang tạo doanh thu tốt, ưu tiên giữ ads / kiểm tồn kho.",
    };
  }
  if (n(row.orderCount) >= 4 || h >= 50) {
    return {
      key: "scale",
      label: "NÊN SCALE",
      cls: "bg-amber-100 text-amber-700",
      border: "border-amber-200 bg-amber-50/40",
      hint: "Có lực bán, nên đối chiếu CPA và creative để scale có kiểm soát.",
    };
  }
  if (n(row.orderCount) >= 1) {
    return {
      key: "watch",
      label: "THEO DÕI",
      cls: "bg-neutral-100 text-neutral-600",
      border: "border-neutral-200 bg-white",
      hint: "Có tín hiệu nhưng chưa đủ mạnh, theo dõi thêm trong ngày.",
    };
  }
  return {
    key: "weak",
    label: "YẾU",
    cls: "bg-rose-100 text-rose-700",
    border: "border-rose-200 bg-rose-50/40",
    hint: "Chưa có lực bán rõ, chưa nên scale.",
  };
}

function sourceLabel(row: ProductRow) {
  const sources = row.sources || {};
  const fb = n(sources.Facebook || sources.facebook || sources.FACEBOOK || sources.FACEBOOK_MANUAL);
  const pos = n(sources.POS || sources.pos);
  if (fb && pos) return `FB ${fb} · POS ${pos}`;
  if (fb) return `FB ${fb}`;
  if (pos) return `POS ${pos}`;
  return "—";
}

function SourceBadges({ row, adInfo }: { row: ProductRow; adInfo?: SkuAdInfo }) {
  const sources = row.sources || {};
  const fb = n(sources.Facebook || sources.facebook || sources.FACEBOOK || sources.FACEBOOK_MANUAL);
  const pos = n(sources.POS || sources.pos);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {adInfo?.status === "live" ? (
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700">
          ADS LIVE · {compact(adInfo.activeAds)}
        </span>
      ) : adInfo?.status === "off" ? (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-700">ADS OFF</span>
      ) : null}

      {fb ? (
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">FB {compact(fb)}</span>
      ) : null}

      {pos ? (
        <span className="rounded-full bg-neutral-950 px-2 py-1 text-[11px] font-black text-white">POS {compact(pos)}</span>
      ) : null}

      {!adInfo && !fb && !pos ? (
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-500">ORGANIC</span>
      ) : null}
    </div>
  );
}


function productDetailHref(row: ProductRow) {
  const sku = normalizeSku(row.sku || row.key) || extractSkuFromText(row.productName);
  return sku ? `/control/products/${encodeURIComponent(sku.toLowerCase())}` : "";
}

function statusLabel(row: ProductRow) {
  const statuses = row.statuses || {};
  const entries = Object.entries(statuses)
    .map(([key, value]) => [key, n(value)] as const)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) return "—";
  return entries.slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(" · ");
}

function Kpi({
  label,
  value,
  sub,
  tone = "white",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "white" | "green" | "yellow" | "dark";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "yellow"
        ? "border-amber-200 bg-amber-50"
        : tone === "dark"
          ? "border-neutral-950 bg-neutral-950 text-white"
          : "border-neutral-200 bg-white";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${tone === "dark" ? "text-neutral-500" : "text-neutral-400"}`}>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${tone === "dark" ? "text-white" : "text-neutral-950"}`}>{value}</div>
      <div className={`mt-1 text-xs font-medium ${tone === "dark" ? "text-neutral-400" : "text-neutral-500"}`}>{sub || "—"}</div>
    </div>
  );
}

function ProductHeroCard({ row, index, onOpen, adInfo }: { row: ProductRow; index: number; onOpen: (row: ProductRow) => void; adInfo?: SkuAdInfo }) {
  const state = productState(row);
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-md ${state.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">Top #{index + 1}</div>
          <h3 className="mt-2 line-clamp-2 text-2xl font-bold leading-tight">{row.productName}</h3>
          <div className="mt-1 text-sm font-bold text-emerald-700">{row.sku || row.key}</div>
          <div className="mt-3"><SourceBadges row={row} adInfo={adInfo} /></div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${state.cls}`}>{state.label}</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">Đơn</div>
          <div className="mt-1 text-2xl font-bold">{compact(row.orderCount)}</div>
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">SL</div>
          <div className="mt-1 text-2xl font-bold">{compact(row.quantity)}</div>
        </div>
        <div className="rounded-2xl bg-emerald-100/80 p-3 text-emerald-800">
          <div className="text-[10px] font-bold uppercase">DT</div>
          <div className="mt-1 text-2xl font-bold">{compact(row.revenue)}</div>
        </div>
      </div>

      {adInfo ? (
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/70 p-3 text-xs font-bold text-neutral-600">
          Ads: {compact(adInfo.ads)} creative · Spend {money(adInfo.spend)} · {adInfo.names.slice(0, 2).join(" / ")}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-3">
        <div>
          <div className="text-xs font-semibold text-neutral-400">Heat score</div>
          <div className="mt-2 h-2 rounded-full bg-white">
            <div className="h-2 rounded-full bg-neutral-950" style={{ width: `${Math.min(100, heat(row))}%` }} />
          </div>
        </div>
        <div className="text-2xl font-bold">{heat(row)}</div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-3 text-sm font-medium text-neutral-600">
        {state.hint}
      </div>
    </button>
  );
}

function ProductMobileCard({ row, index, onOpen, adInfo }: { row: ProductRow; index: number; onOpen: (row: ProductRow) => void; adInfo?: SkuAdInfo }) {
  const state = productState(row);
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="block w-full rounded-3xl border border-neutral-200 bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase text-neutral-400">#{index + 1} · {row.sku || row.key}</div>
          <div className="mt-1 line-clamp-2 text-lg font-black">{row.productName}</div>
          <div className="mt-2"><SourceBadges row={row} adInfo={adInfo} /></div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${state.cls}`}>{state.label}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-neutral-200 rounded-2xl bg-neutral-50 p-3">
        <div>
          <div className="text-xl font-black">{compact(row.orderCount)}</div>
          <div className="text-xs font-semibold text-neutral-500">Đơn</div>
        </div>
        <div className="pl-3">
          <div className="text-xl font-black">{compact(row.quantity)}</div>
          <div className="text-xs font-semibold text-neutral-500">SL</div>
        </div>
        <div className="pl-3">
          <div className="text-xl font-black">{compact(row.revenue)}</div>
          <div className="text-xs font-semibold text-neutral-500">DT</div>
        </div>
      </div>
    </button>
  );
}

function DetailDrawer({ row, onClose, adInfo }: { row: ProductRow | null; onClose: () => void; adInfo?: SkuAdInfo }) {
  if (!row) return null;
  const state = productState(row);
  const sources = row.sources || {};
  const fb = n(sources.Facebook || sources.facebook || sources.FACEBOOK || sources.FACEBOOK_MANUAL);
  const pos = n(sources.POS || sources.pos);
  const samples = row.sampleOrders || [];
  const detailHref = productDetailHref(row);

  return (
    <div className="fixed inset-0 z-[80] bg-black/40">
      <div className="absolute right-0 top-0 h-full w-full overflow-auto bg-white shadow-2xl md:w-[560px]">
        <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">Product Detail</div>
              <h2 className="mt-1 text-2xl font-black leading-tight">{row.productName}</h2>
              <div className="mt-1 text-sm font-bold text-emerald-700">SKU: {row.sku || row.key}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {detailHref ? (
                <a
                  href={detailHref}
                  className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
                >
                  Xem chi tiết sản phẩm
                </a>
              ) : null}
              <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-bold hover:bg-neutral-50">
                Đóng
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className={`rounded-3xl border p-5 ${state.border}`}>
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${state.cls}`}>{state.label}</span>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase text-neutral-400">Heat</div>
                <div className="text-3xl font-black">{heat(row)}</div>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-neutral-700">{state.hint}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Đơn" value={compact(row.orderCount)} sub={sourceLabel(row)} tone="green" />
            <Kpi label="Doanh thu" value={money(row.revenue)} sub={`TB ${money(row.averageOrderValue)}`} tone="green" />
            <Kpi label="Số lượng" value={compact(row.quantity)} sub="Tổng quantity" />
            <Kpi label="Trạng thái" value={statusLabel(row)} sub="Theo order" />
          </div>

          {adInfo ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-emerald-950">Ads đang ghi nhận SKU</h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{adInfo.status === "live" ? "ADS LIVE" : "ADS OFF"}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/80 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Creative</div><div className="mt-1 text-xl font-black">{compact(adInfo.ads)}</div></div>
                <div className="rounded-2xl bg-white/80 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Active</div><div className="mt-1 text-xl font-black">{compact(adInfo.activeAds)}</div></div>
                <div className="rounded-2xl bg-white/80 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Spend</div><div className="mt-1 text-xl font-black">{money(adInfo.spend)}</div></div>
              </div>
              <div className="mt-3 rounded-2xl bg-white/80 p-3 text-sm font-semibold text-neutral-700">{adInfo.names.slice(0, 4).join(" · ")}</div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h3 className="text-lg font-black">Nguồn đơn</h3>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm font-bold">
                  <span>Facebook</span>
                  <span>{compact(fb)} đơn · {money(sourceRevenueApprox(row, "facebook"))}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-neutral-950" style={{ width: `${percent(fb, n(row.orderCount))}%` }} /></div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm font-bold">
                  <span>POS</span>
                  <span>{compact(pos)} đơn · {money(sourceRevenueApprox(row, "pos"))}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${percent(pos, n(row.orderCount))}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h3 className="text-lg font-black">Gợi ý vận hành</h3>
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl bg-neutral-50 p-3 text-sm font-semibold text-neutral-700">{state.hint}</div>
              {fb > 0 && pos > 0 ? (
                <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Sản phẩm có cả FB và POS, nên tính là ads influence khi đánh giá hiệu quả.
                </div>
              ) : null}
              {n(row.averageOrderValue) < 450000 ? (
                <div className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                  TB/đơn hơi thấp, nên kiểm tra combo hoặc upsell.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h3 className="text-lg font-black">Đơn mẫu</h3>
            <div className="mt-3 space-y-2">
              {samples.length ? samples.slice(0, 8).map((order, index) => (
                <div key={`${order.orderCode || index}-${index}`} className="flex items-center justify-between rounded-2xl bg-neutral-50 p-3 text-sm">
                  <div>
                    <div className="font-bold">{order.orderCode || `Đơn #${index + 1}`}</div>
                    <div className="text-xs text-neutral-500">{order.status || "—"}</div>
                  </div>
                  <div className="font-black">{money(order.revenue)}</div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-sm font-medium text-neutral-400">
                  Chưa có sample order từ API.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function MetaProductsPerformancePageClient() {
  const [range, setRange] = useState<RangeKey>("today");
  const [customSince, setCustomSince] = useState(todayInputValue(-6));
  const [customUntil, setCustomUntil] = useState(todayInputValue());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("revenue");
  const [source, setSource] = useState<SourceKey>("all");
  const [data, setData] = useState<Payload | null>(null);
  const [liveAds, setLiveAds] = useState<LiveAdsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ProductRow | null>(null);

  async function load(nextRange = range) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("range", nextRange === "custom" ? "custom" : nextRange);
      params.set("limit", "500");
      if (nextRange === "custom") {
        params.set("since", customSince);
        params.set("until", customUntil);
      }
      if (search.trim()) params.set("search", search.trim());

      const adsParams = new URLSearchParams();
      adsParams.set("range", nextRange === "custom" ? "custom" : nextRange);
      adsParams.set("level", "ad");
      adsParams.set("limit", "1000");
      if (nextRange === "custom") {
        adsParams.set("since", customSince);
        adsParams.set("until", customUntil);
      }

      const [productPayload, liveAdsPayload] = await Promise.all([
        apiJson<Payload>(`/meta-ads/product-performance?${params.toString()}`),
        apiJson<LiveAdsPayload>(`/meta-ads/live-insights?${adsParams.toString()}`).catch(() => null),
      ]);

      setData(productPayload);
      setLiveAds(liveAdsPayload);
    } catch (err: any) {
      setError(err?.message || "Không tải được sản phẩm tạo đơn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const rows = useMemo(() => {
    let list = [...(data?.rows || [])];
    if (source === "adsLive") {
      const map = buildSkuAdMap(liveAds);
      list = list.filter((row) => adInfoForProduct(row, map)?.status === "live");
    } else if (source !== "all") list = list.filter((row) => sourceCount(row, source) > 0);
    list.sort((a, b) => {
      if (sort === "orders") return n(b.orderCount) - n(a.orderCount);
      if (sort === "quantity") return n(b.quantity) - n(a.quantity);
      if (sort === "aov") return n(b.averageOrderValue) - n(a.averageOrderValue);
      if (sort === "heat") return heat(b) - heat(a);
      return n(b.revenue) - n(a.revenue);
    });
    return list;
  }, [data, source, sort, liveAds]);

  const skuAdMap = useMemo(() => buildSkuAdMap(liveAds), [liveAds]);

  const totals = useMemo(() => {
    const totalOrders = rows.reduce((sum, row) => sum + n(row.orderCount), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + n(row.revenue), 0);
    const totalQuantity = rows.reduce((sum, row) => sum + n(row.quantity), 0);
    const fbOrders = rows.reduce((sum, row) => sum + sourceCount(row, "facebook"), 0);
    const posOrders = rows.reduce((sum, row) => sum + sourceCount(row, "pos"), 0);
    const winnerCount = rows.filter((row) => productState(row).key === "winner").length;
    const scaleCount = rows.filter((row) => productState(row).key === "scale").length;
    const adsLiveProducts = rows.filter((row) => adInfoForProduct(row, skuAdMap)?.status === "live").length;
    const adsLiveSpend = rows.reduce((sum, row) => sum + n(adInfoForProduct(row, skuAdMap)?.spend), 0);
    return { totalOrders, totalRevenue, totalQuantity, fbOrders, posOrders, winnerCount, scaleCount, adsLiveProducts, adsLiveSpend };
  }, [rows, skuAdMap]);

  const rangeTitle = range === "custom" ? `${customSince} → ${customUntil}` : RANGE_OPTIONS.find((item) => item.id === range)?.label || "—";

  return (
    <main className="min-h-screen w-full bg-[#f7f7f7] px-3 py-4 font-sans text-neutral-950 md:px-4">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="bg-neutral-950 px-5 py-7 text-white md:px-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Product Intelligence · V8</div>
                <h1 className="mt-2 font-serif text-[34px] font-medium tracking-tight md:text-[42px]">Sản phẩm tạo đơn từ hệ thống</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">
                  Đọc từ order/orderItem thật, đồng thời đối chiếu SKU đang chạy ads live để đánh dấu nguồn doanh thu: FB / POS / ADS LIVE.
                </p>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">Khoảng: {rangeTitle}</div>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-7">
            <Kpi label="Sản phẩm có đơn" value={compact(rows.length || data?.totalProducts)} sub="Trong khoảng" />
            <Kpi label="Tổng đơn" value={compact(totals.totalOrders || data?.totalOrders)} sub={totals.fbOrders || totals.posOrders ? `FB ${compact(totals.fbOrders)} · POS ${compact(totals.posOrders)}` : "Chưa tách nguồn từ API"} tone="green" />
            <Kpi label="Số lượng bán" value={compact(totals.totalQuantity || data?.totalQuantity)} sub="Tổng quantity" />
            <Kpi label="Doanh thu" value={money(totals.totalRevenue || data?.totalRevenue)} sub="Theo line item" tone="green" />
            <Kpi label="SKU đang chạy ads" value={compact(totals.adsLiveProducts)} sub={`Spend ${money(totals.adsLiveSpend)}`} tone="green" />
            <Kpi label="Winner" value={compact(totals.winnerCount)} sub="SKU đang thắng" tone="yellow" />
            <Kpi label="Nên scale" value={compact(totals.scaleCount)} sub="SKU có lực bán" tone="dark" />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}

        <section className="grid gap-4 xl:grid-cols-3">
          {rows.slice(0, 3).map((row, index) => <ProductHeroCard key={row.key || index} row={row} index={index} onOpen={setSelected} adInfo={adInfoForProduct(row, skuAdMap)} />)}
          {!rows.length && !loading ? <div className="rounded-3xl border border-dashed border-neutral-200 bg-white p-10 text-center text-neutral-400 xl:col-span-3">Không có sản phẩm trong khoảng này.</div> : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Bản đồ nguồn đơn</h2>
                <p className="mt-1 text-sm text-neutral-500">Tách nhanh FB/POS khi API trả sources; nếu chưa có sources thì vẫn giữ KPI tổng đơn/doanh thu chuẩn.</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{totals.fbOrders || totals.posOrders ? `${compact(totals.totalOrders)} đơn` : "Chưa có source split"}</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="text-sm font-bold text-neutral-500">Facebook</div>
                <div className="mt-1 text-3xl font-black">{compact(totals.fbOrders)}</div>
                <div className="mt-3 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-neutral-950" style={{ width: `${percent(totals.fbOrders, totals.totalOrders)}%` }} /></div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="text-sm font-bold text-emerald-700">POS</div>
                <div className="mt-1 text-3xl font-black text-emerald-800">{compact(totals.posOrders)}</div>
                <div className="mt-3 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${percent(totals.posOrders, totals.totalOrders)}%` }} /></div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-emerald-700">SKU đang chạy ads</div>
                    <div className="mt-1 text-3xl font-black text-emerald-900">{compact(totals.adsLiveProducts)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase text-emerald-600">Spend live</div>
                    <div className="text-xl font-black text-emerald-900">{money(totals.adsLiveSpend)}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs font-semibold text-emerald-700">Các SKU này sẽ được đánh dấu ADS LIVE ở cột Nguồn để nhìn nhanh doanh thu có tác động từ ads.</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Gợi ý nhanh</h2>
            <div className="mt-4 space-y-2">
              {rows.slice(0, 4).map((row) => {
                const state = productState(row);
                return (
                  <button
                    type="button"
                    key={`suggest-${row.key}`}
                    onClick={() => setSelected(row)}
                    className="flex w-full items-center justify-between rounded-2xl bg-neutral-50 p-3 text-left hover:bg-neutral-100"
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-black">{row.productName}</div>
                      <div className="text-xs font-bold text-emerald-700">{row.sku || row.key} · {state.label}</div>
                    </div>
                    <div className="text-right text-sm font-black">{compact(row.orderCount)} đơn</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRange(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${range === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 md:flex-row xl:w-[860px]">
              {range === "custom" ? (
                <>
                  <input value={customSince} onChange={(e) => setCustomSince(e.target.value)} type="date" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold outline-none" />
                  <input value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} type="date" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold outline-none" />
                </>
              ) : null}
              <select value={source} onChange={(e) => setSource(e.target.value as SourceKey)} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold outline-none">
                <option value="all">Tất cả nguồn</option>
                <option value="facebook">Chỉ Facebook</option>
                <option value="pos">Chỉ POS</option>
                <option value="adsLive">SKU đang chạy ads</option>
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold outline-none">
                <option value="revenue">Xếp theo doanh thu</option>
                <option value="orders">Xếp theo số đơn</option>
                <option value="quantity">Xếp theo số lượng</option>
                <option value="aov">Xếp theo TB / đơn</option>
                <option value="heat">Xếp theo heat score</option>
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Tìm SKU / tên sản phẩm..."
                className="h-10 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none focus:border-neutral-950"
              />
              <button onClick={() => load(range)} className="rounded-xl bg-neutral-950 px-5 text-sm font-bold text-white disabled:opacity-50" disabled={loading}>{loading ? "..." : "Tìm"}</button>
            </div>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {loading ? <div className="rounded-3xl bg-white p-8 text-center font-medium text-neutral-400">Đang tải...</div> : null}
            {rows.map((row, index) => <ProductMobileCard key={`m-${row.key || index}`} row={row} index={index} onOpen={setSelected} adInfo={adInfoForProduct(row, skuAdMap)} />)}
          </div>

          <div className="hidden overflow-auto md:block">
            <table className="w-full min-w-[1350px] text-left text-sm">
              <thead className="bg-neutral-950 text-[11px] uppercase tracking-[0.14em] text-white">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Đơn</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Doanh thu</th>
                  <th className="px-4 py-3 text-right">TB / đơn</th>
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Order status</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Heat</th>
                  <th className="px-4 py-3">Gợi ý vận hành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr><td colSpan={12} className="p-10 text-center font-medium text-neutral-400">Đang tải...</td></tr>
                ) : rows.length ? rows.map((row, index) => {
                  const state = productState(row);
                  return (
                    <tr key={row.key || index} className="cursor-pointer hover:bg-neutral-50" onClick={() => setSelected(row)}>
                      <td className="px-4 py-4 font-bold">{index + 1}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold">{row.productName}</div>
                        <div className="mt-1 text-xs text-neutral-400">{row.key}</div>
                      </td>
                      <td className="px-4 py-4 font-bold text-emerald-700">{row.sku || "—"}</td>
                      <td className="px-4 py-4 text-right font-bold">{compact(row.orderCount)}</td>
                      <td className="px-4 py-4 text-right">{compact(row.quantity)}</td>
                      <td className="px-4 py-4 text-right font-bold">{money(row.revenue)}</td>
                      <td className="px-4 py-4 text-right">{money(row.averageOrderValue)}</td>
                      <td className="px-4 py-4"><SourceBadges row={row} adInfo={adInfoForProduct(row, skuAdMap)} /></td>
                      <td className="px-4 py-4 text-xs font-semibold text-neutral-500">{statusLabel(row)}</td>
                      <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${state.cls}`}>{state.label}</span></td>
                      <td className="px-4 py-4 text-right font-bold">{heat(row)}</td>
                      <td className="px-4 py-4 text-sm font-medium text-neutral-600">{state.hint}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={12} className="p-10 text-center font-medium text-neutral-400">Không có dữ liệu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <DetailDrawer row={selected} onClose={() => setSelected(null)} adInfo={selected ? adInfoForProduct(selected, skuAdMap) : undefined} />
    </main>
  );
}
