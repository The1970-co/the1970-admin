"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d";
type SourceMode = "facebook" | "all" | "pos";
type LevelKey = "campaign" | "adset" | "ad";
type FilterKey = "all" | "active" | "spent" | "hasPurchase" | "noMetaPurchase" | "hasSystemOrder" | "noSystemOrder" | "cpaHigh" | "ctrHigh" | "familyShared" | "unmatched";

type Metrics = {
  spend?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  inlineLinkClicks?: number;
  purchases?: number;
  purchaseValue?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  costPerPurchase?: number;
  roas?: number;
  messages?: number;
  conversationStarts?: number;
  comments?: number;
  costPerMessage?: number;
  costPerConversation?: number;
  costPerResult?: number;
  averagePurchaseValue?: number;
};

type ProductAttribution = {
  mode?: string;
  label?: string;
  confidence?: number;
  sku?: string | null;
  productName?: string | null;
  orderCount?: number;
  quantity?: number;
  revenue?: number;
  averageOrderValue?: number;
  realRoasEstimate?: number;
  sampleOrders?: Array<{ orderCode?: string; revenue?: number; quantity?: number; status?: string }>;
  allocationMode?: string;
  familySku?: string | null;
  familyOrderCount?: number;
  familyRevenue?: number;
  familyOrderRevenue?: number;
  familyRoasEstimate?: number;
  sharedFamilyCount?: number;
  note?: string;
};

type BrainRow = {
  id: string;
  level: string;
  name: string;
  campaignName?: string | null;
  adSetName?: string | null;
  status?: string | null;
  effectiveStatus?: string | null;
  thumbnailUrl?: string | null;
  previewShareableLink?: string | null;
  metrics: Metrics;
  productAttribution?: ProductAttribution;
  childCount?: number;
  familyCount?: number;
  childAds?: BrainRow[];
  familyFlows?: Array<{ familySku: string; ads: number; spend: number; revenue: number; orders: number; names: string[] }>;
};

type ProductPerformanceRow = {
  key: string;
  sku?: string;
  productName: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  averageOrderValue: number;
  familySku?: string;
  orderRevenue?: number;
};

type ProductPerformancePayload = {
  ok?: boolean;
  totalProducts?: number;
  totalOrders?: number;
  totalQuantity?: number;
  totalRevenue?: number;
  totalOrderRevenue?: number;
  rows?: ProductPerformanceRow[];
};

type BrainOverview = {
  ok?: boolean;
  range?: { since?: string; until?: string };
  generatedAt?: string;
  summary?: Metrics;
  officialSummary?: Metrics;
  dbSummary?: Metrics;
  reconciliation?: {
    officialSpend?: number;
    dbSpend?: number;
    spendDiff?: number;
    spendDiffPercent?: number;
  };
  statusBreakdown?: {
    campaigns?: { total?: number; active?: number; inactive?: number };
    adSets?: { total?: number; active?: number; inactive?: number };
    ads?: { total?: number; active?: number; inactive?: number };
  };
  dailyRows?: Array<{ date: string; metrics: Metrics }>;
  topCampaigns?: BrainRow[];
  topAdSets?: BrainRow[];
  topAds?: BrainRow[];
  warnings?: Array<{ id?: string; title?: string; desc?: string; tone?: string }>;
  latestLogs?: any[];
  attribution?: { enabled?: boolean; mode?: string; note?: string };
};

type SyncPayload = {
  ok?: boolean;
  campaigns?: number;
  adSets?: number;
  ads?: number;
  insights?: number;
  message?: string;
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
];

const LEVEL_OPTIONS: Array<{ id: LevelKey; label: string; noun: string }> = [
  { id: "campaign", label: "Chiến dịch", noun: "chiến dịch" },
  { id: "adset", label: "Nhóm quảng cáo", noun: "nhóm quảng cáo" },
  { id: "ad", label: "Quảng cáo", noun: "quảng cáo" },
];

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "active", label: "Đang chạy" },
  { id: "spent", label: "Có chi tiêu" },
  { id: "hasPurchase", label: "Có purchase Meta" },
  { id: "noMetaPurchase", label: "Chi tiêu chưa có purchase Meta" },
  { id: "hasSystemOrder", label: "Có đơn hệ thống" },
  { id: "noSystemOrder", label: "Chưa match đơn hệ thống" },
  { id: "cpaHigh", label: "CPA cao" },
  { id: "ctrHigh", label: "CTR tốt" },
  { id: "familyShared" as FilterKey, label: "Family bị trùng ads" },
  { id: "unmatched" as FilterKey, label: "Chưa match SKU" },
];

function getToken() {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("accessToken") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("the1970_access_token") ||
    ""
  );
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.message || payload?.error || `API lỗi ${res.status}`);
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
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${Math.round(x / 1_000)}K`;
  return `${Math.round(x)}`;
}

function pct(v: unknown) {
  return n(v) ? `${n(v).toFixed(2)}%` : "—";
}

function ratio(v: unknown) {
  return n(v) ? `${n(v).toFixed(2)}x` : "—";
}

function dateVi(d?: string) {
  if (!d) return "—";
  const date = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function rangeVi(data?: BrainOverview | null) {
  const since = data?.range?.since;
  const until = data?.range?.until;
  if (!since || !until) return "—";
  if (since === until) return dateVi(since);
  return `${dateVi(since)} → ${dateVi(until)}`;
}

function statusLabel(v?: string | null) {
  const s = String(v || "").toUpperCase();
  if (s === "ACTIVE") return "Đang hoạt động";
  if (s === "PAUSED") return "Đang tắt";
  if (s === "CAMPAIGN_PAUSED") return "Chiến dịch: Tắt";
  if (s === "ADSET_PAUSED") return "Nhóm: Tắt";
  if (s.includes("ACTIVE")) return "Đang hoạt động";
  if (s.includes("PAUSED")) return "Đang tắt";
  return s || "Không rõ";
}

function statusClass(v?: string | null) {
  const s = String(v || "").toUpperCase();
  if (s === "ACTIVE" || s.includes("ACTIVE")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s.includes("PAUSED")) return "bg-neutral-100 text-neutral-600 border-neutral-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function cleanInsightTitle(title?: string) {
  return String(title || "")
    .replace(/^Ads đốt tiền chưa ra đơn:/i, "Ads đang tiêu tiền:")
    .replace(/^CPA cao:/i, "CPA cần kiểm tra:");
}

function cleanInsightDesc(desc?: string) {
  return String(desc || "")
    .replace(/nhưng chưa có purchase trong khoảng đang xem\./i, "nhưng hệ thống chưa map được đơn thật ở giai đoạn hiện tại.")
    .replace(/chưa có purchase/i, "chưa map được đơn thật");
}

function productAttr(row: BrainRow): ProductAttribution {
  return row.productAttribution || {};
}

function emptyMetrics(): Metrics {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    inlineLinkClicks: 0,
    purchases: 0,
    purchaseValue: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    costPerPurchase: 0,
    roas: 0,
  };
}

function addMetrics(target: Metrics, source?: Metrics) {
  target.spend = n(target.spend) + n(source?.spend);
  target.impressions = n(target.impressions) + n(source?.impressions);
  target.reach = n(target.reach) + n(source?.reach);
  target.clicks = n(target.clicks) + n(source?.clicks);
  target.inlineLinkClicks = n(target.inlineLinkClicks) + n(source?.inlineLinkClicks);
  target.purchases = n(target.purchases) + n(source?.purchases);
  target.purchaseValue = n(target.purchaseValue) + n(source?.purchaseValue);
}

function finalizeMetrics(metrics: Metrics) {
  metrics.ctr = n(metrics.impressions) > 0 ? (n(metrics.clicks) / n(metrics.impressions)) * 100 : 0;
  metrics.cpc = n(metrics.clicks) > 0 ? n(metrics.spend) / n(metrics.clicks) : 0;
  metrics.cpm = n(metrics.impressions) > 0 ? (n(metrics.spend) / n(metrics.impressions)) * 1000 : 0;
  metrics.costPerPurchase = n(metrics.purchases) > 0 ? n(metrics.spend) / n(metrics.purchases) : 0;
  metrics.roas = n(metrics.spend) > 0 ? n(metrics.purchaseValue) / n(metrics.spend) : 0;
}

function buildFamilyFlows(children: BrainRow[]) {
  const map = new Map<string, { familySku: string; ads: number; spend: number; revenue: number; orders: number; names: string[] }>();

  for (const row of children) {
    const a = productAttr(row);
    const family = String(a.familySku || a.sku || "").trim();
    if (!family) continue;

    const current = map.get(family) || { familySku: family, ads: 0, spend: 0, revenue: 0, orders: 0, names: [] };
    current.ads += 1;
    current.spend += n(row.metrics?.spend);
    current.revenue = Math.max(current.revenue, n(a.familyRevenue || a.revenue));
    current.orders = Math.max(current.orders, n(a.familyOrderCount || a.orderCount));
    if (row.name && current.names.length < 5) current.names.push(row.name);
    map.set(family, current);
  }

  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

function aggregateRows(rows: BrainRow[], level: LevelKey): BrainRow[] {
  if (level === "ad") return rows || [];

  const grouped = new Map<string, BrainRow[]>();

  for (const row of rows || []) {
    const key =
      level === "campaign"
        ? String(row.campaignName || row.name || "Không rõ chiến dịch")
        : `${row.campaignName || "Không rõ chiến dịch"}|||${row.adSetName || "Không rõ nhóm quảng cáo"}`;

    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries()).map(([key, children]) => {
    const metrics = emptyMetrics();
    for (const child of children) addMetrics(metrics, child.metrics);
    finalizeMetrics(metrics);

    const familyFlows = buildFamilyFlows(children);
    const uniqueFamilies = new Set(familyFlows.map((item) => item.familySku));
    const revenue = familyFlows.reduce((sum, item) => sum + n(item.revenue), 0);
    const orders = familyFlows.reduce((sum, item) => sum + n(item.orders), 0);

    const [campaignName, adSetName] = key.split("|||");

    return {
      id: `${level}-${key}`,
      level,
      name: level === "campaign" ? campaignName : adSetName,
      campaignName: level === "campaign" ? campaignName : campaignName,
      adSetName: level === "campaign" ? null : adSetName,
      status: children.some((x) => String(x.effectiveStatus || x.status || "").toUpperCase().includes("ACTIVE")) ? "ACTIVE" : "PAUSED",
      effectiveStatus: children.some((x) => String(x.effectiveStatus || x.status || "").toUpperCase().includes("ACTIVE")) ? "ACTIVE" : "PAUSED",
      thumbnailUrl: children.find((x) => x.thumbnailUrl)?.thumbnailUrl || null,
      metrics,
      childCount: children.length,
      familyCount: uniqueFamilies.size,
      childAds: children,
      familyFlows,
      productAttribution: {
        mode: "campaign_family_flow",
        allocationMode: "family_flow",
        label: `${children.length} ads · ${uniqueFamilies.size} SKU family`,
        orderCount: orders,
        familyOrderCount: orders,
        revenue,
        familyRevenue: revenue,
        realRoasEstimate: n(metrics.spend) > 0 ? revenue / n(metrics.spend) : 0,
        familyRoasEstimate: n(metrics.spend) > 0 ? revenue / n(metrics.spend) : 0,
        sharedFamilyCount: children.length,
        note: "Dòng tổng hợp theo chiến dịch/nhóm quảng cáo từ ad-level. Doanh thu family chỉ tính một lần theo SKU family để tránh nhân đôi.",
      },
    };
  }).sort((a, b) => n(b.metrics?.spend) - n(a.metrics?.spend));
}

function FamilyFlowMini({ row }: { row: BrainRow }) {
  const flows = row.familyFlows || [];
  if (!flows.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {flows.slice(0, 4).map((item) => (
        <span
          key={item.familySku}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
          title={`${item.ads} ads cùng kéo về ${item.familySku}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {item.ads} ads → {item.familySku} · {compact(item.orders)} đơn
        </span>
      ))}
      {flows.length > 4 ? (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">+{flows.length - 4} family</span>
      ) : null}
    </div>
  );
}


function FamilyPill({ row }: { row: BrainRow }) {
  const a = productAttr(row);
  const family = a.familySku || a.sku;
  const count = n(a.familyOrderCount || a.orderCount);
  const ads = n(a.sharedFamilyCount);

  if (!family || !count) {
    return <span className="text-[11px] font-semibold text-neutral-400">{a.label || "Chưa match SKU family"}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {ads > 1 ? `${ads} ads → ` : ""}
      {family} · {compact(count)} đơn
    </span>
  );
}

function signalScore(row: BrainRow) {
  const m = row.metrics || {};
  const a = productAttr(row);
  const spend = n(m.spend);
  const purchase = n(m.purchases);
  const cpa = n(m.costPerPurchase);
  const ctr = n(m.ctr);
  const systemOrders = n(a.orderCount);
  const realRoas = n(a.realRoasEstimate);

  let score = 30;
  if (ctr >= 3) score += 18;
  if (ctr >= 4) score += 10;
  if (purchase > 0 && cpa > 0 && cpa <= 450_000) score += 16;
  if (systemOrders > 0) score += 18;
  if (realRoas >= 2) score += 16;
  if (spend > 0 && purchase === 0 && systemOrders === 0) score -= 15;

  return Math.max(0, Math.min(99, Math.round(score)));
}


function metricValue(row: BrainRow, field: string): number {
  const m: any = row.metrics || {};
  const a: any = productAttr(row);

  if (field === "spend") return n(m.spend);
  if (field === "reach") return n(m.reach);
  if (field === "impressions") return n(m.impressions);
  if (field === "clicks") return n(m.clicks);
  if (field === "ctr") return n(m.ctr);
  if (field === "cpc") return n(m.cpc);
  if (field === "messages") return n(m.messages);
  if (field === "conversationStarts") return n(m.conversationStarts);
  if (field === "costPerConversation") return n(m.costPerConversation);
  if (field === "comments") return n(m.comments);
  if (field === "orders") return n(a.familyOrderCount || a.orderCount);
  if (field === "revenue") return n(a.familyRevenue || a.revenue);
  if (field === "realRoas") return n(a.familyRoasEstimate || a.realRoasEstimate);
  return 0;
}

function passMetricFilter(row: BrainRow, field: string, op: string, rawValue: string): boolean {
  if (!rawValue.trim()) return true;
  const left = metricValue(row, field);
  const right = Number(String(rawValue).replace(/[^\d.-]/g, "")) || 0;

  if (op === "gte") return left >= right;
  if (op === "lte") return left <= right;
  if (op === "eq") return left === right;
  if (op === "gt") return left > right;
  if (op === "lt") return left < right;
  return true;
}

function filterRow(row: BrainRow, filter: FilterKey) {
  const m = row.metrics || {};
  const a = productAttr(row);
  const active = String(row.effectiveStatus || row.status || "").toUpperCase().includes("ACTIVE");
  if (filter === "active") return active;
  if (filter === "spent") return n(m.spend) > 0;
  if (filter === "hasPurchase") return n(m.purchases) > 0;
  if (filter === "noMetaPurchase") return n(m.spend) > 0 && n(m.purchases) <= 0;
  if (filter === "hasSystemOrder") return n(a.orderCount) > 0;
  if (filter === "noSystemOrder") return n(m.spend) > 0 && n(a.orderCount) <= 0;
  if (filter === "cpaHigh") return n(m.costPerPurchase) >= 500_000;
  if (filter === "ctrHigh") return n(m.ctr) >= 3;
  if (filter === "familyShared") return a.allocationMode === "family_shared";
  if (filter === "unmatched") return n(m.spend) > 0 && !a.familySku;
  return true;
}

function rowSearch(row: BrainRow, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const a = productAttr(row);
  return [
    row.id,
    row.name,
    row.campaignName,
    row.adSetName,
    row.status,
    row.effectiveStatus,
    a.sku,
    a.productName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "green" | "amber" | "red" }) {
  const dot =
    tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : tone === "red" ? "bg-rose-500" : "bg-neutral-300";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</p>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight text-neutral-950">{value}</div>
      <div className="mt-1 truncate text-xs font-semibold text-neutral-500">{sub || "—"}</div>
    </div>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(value)}`}>
      {statusLabel(value)}
    </span>
  );
}

function Toolbar({
  level,
  setLevel,
  filter,
  setFilter,
  search,
  setSearch,
  range,
  setRange,
  onSync,
  syncing,
  onReload,
  fullscreen,
  onToggleFullscreen,
}: {
  level: LevelKey;
  setLevel: (v: LevelKey) => void;
  filter: FilterKey;
  setFilter: (v: FilterKey) => void;
  search: string;
  setSearch: (v: string) => void;
  range: RangeKey;
  setRange: (v: RangeKey) => void;
  onSync: () => void;
  syncing: boolean;
  onReload: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {LEVEL_OPTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setLevel(item.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                  level === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-700"
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="mx-1 hidden h-7 w-px bg-neutral-200 xl:block" />
            {RANGE_OPTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setRange(item.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  range === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-1 items-center gap-2 xl:max-w-[560px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, ID, SKU, campaign..."
              className="h-10 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium outline-none focus:border-neutral-950"
            />
            <button onClick={onToggleFullscreen} className="h-10 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold">
              {fullscreen ? "Thu nhỏ bảng" : "Phóng to bảng"}
            </button>
            <button onClick={onReload} className="h-10 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold">
              Tải lại
            </button>
            <button
              onClick={onSync}
              disabled={syncing}
              className="h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {syncing ? "Đang sync" : "Sync"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filter === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MainTable({ rows, level, loading, onSelect }: { rows: BrainRow[]; level: LevelKey; loading: boolean; onSelect: (row: BrainRow) => void }) {
  const total = rows.reduce(
    (acc, row) => {
      acc.spend += n(row.metrics?.spend);
      acc.purchases += n(row.metrics?.purchases);
      acc.clicks += n(row.metrics?.clicks);
      acc.reach += n(row.metrics?.reach);
      acc.impressions += n(row.metrics?.impressions);
      acc.systemOrders += n(row.productAttribution?.orderCount);
      acc.systemRevenue += n(row.productAttribution?.revenue);
      return acc;
    },
    { spend: 0, purchases: 0, clicks: 0, reach: 0, impressions: 0, systemOrders: 0, systemRevenue: 0 },
  );

  return (
    <section className="w-full overflow-hidden rounded-b-2xl border-x border-b border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Bảng quản lý {LEVEL_OPTIONS.find((x) => x.id === level)?.noun}</h2>
          <p className="text-xs font-semibold text-neutral-500">
            Bảng là trung tâm vận hành. Kết quả/Lượt bắt đầu cuộc trò chuyện qua tin nhắn/Tổng số người liên hệ nhắn tin/Bình luận về bài viết lấy theo query live đã khớp Meta; Đơn gán ads là số nội bộ theo SKU family, không trộn vào cột tin nhắn.
          </p>
        </div>
        <div className="hidden gap-2 text-xs font-semibold text-neutral-500 md:flex">
          <span className="rounded-full bg-neutral-100 px-3 py-1">{rows.length} dòng</span>
          <span className="rounded-full bg-neutral-100 px-3 py-1">{money(total.spend)}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{compact(total.systemOrders)} đơn HT</span>
        </div>
      </div>

      <div className="max-h-[calc(100vh-300px)] w-full overflow-auto">
        <table className="w-full min-w-[3000px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-neutral-950 text-[11px] uppercase tracking-[0.12em] text-white">
            <tr>
              <th className="w-[44px] px-3 py-3"><input type="checkbox" onClick={(event) => event.stopPropagation()} className="h-4 w-4 rounded" /></th>
              <th className="w-[430px] px-3 py-3">Tên</th>
              <th className="px-3 py-3">Phân phối</th>
              <th className="px-3 py-3 text-right">Kết quả</th>
              <th className="px-3 py-3 text-right">Tổng số người liên hệ nhắn tin</th>
              <th className="px-3 py-3 text-right">Chi phí trên mỗi kết quả</th>
              <th className="px-3 py-3 text-right">Lượt bắt đầu cuộc trò chuyện qua tin nhắn</th>
              <th className="px-3 py-3 text-right">Chi phí trên mỗi kết quả</th>
              <th className="px-3 py-3 text-right">Bình luận về bài viết</th>
              <th className="px-3 py-3 text-right">Chi phí trên mỗi kết quả</th>
              <th className="px-3 py-3 text-right">Giá trị chuyển đổi trung bình mỗi lượt mua</th>
              <th className="px-3 py-3 text-right">Đơn gán ads</th>
              <th className="px-3 py-3 text-right">DT gán ads</th>
              <th className="px-3 py-3 text-right">Real ROAS ƯT</th>
              <th className="px-3 py-3 text-right">CPA</th>
              <th className="px-3 py-3 text-right">Số tiền đã chi tiêu</th>
              <th className="px-3 py-3 text-right">Lượt hiển thị</th>
              <th className="px-3 py-3 text-right">Người tiếp cận</th>
              <th className="px-3 py-3 text-right">Lượt nhấp</th>
              <th className="px-3 py-3 text-right">CTR</th>
              <th className="px-3 py-3 text-right">CPC</th>
              <th className="px-3 py-3 text-right">ROAS Meta</th>
              <th className="px-3 py-3 text-right">Tín hiệu</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={23} className="px-4 py-14 text-center text-sm font-semibold text-neutral-400">Đang tải dữ liệu...</td></tr>
            ) : rows.length ? (
              rows.map((row, index) => {
                const m = row.metrics || {};
                const a = productAttr(row);
                const s = signalScore(row);
                const hasSpend = n(m.spend) > 0;
                return (
                  <tr key={`${level}-${row.id}`} onClick={() => onSelect(row)} className={`${index % 2 ? "bg-neutral-50/40" : "bg-white"} cursor-pointer hover:bg-lime-50/60`}>
                    <td className="border-b border-neutral-100 px-3 py-3 align-middle">
                      <input type="checkbox" onClick={(event) => event.stopPropagation()} className="h-4 w-4 rounded" />
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3">
                      <div className="flex items-center gap-3">
                        {row.thumbnailUrl ? (
                          <img src={row.thumbnailUrl} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-neutral-200" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 text-[10px] font-semibold text-neutral-400">
                            {level === "campaign" ? "CD" : level === "adset" ? "NQ" : "ADS"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="max-w-[360px] truncate font-semibold text-neutral-950">{row.name || "—"}</div>
                          <div className="mt-1 max-w-[360px] truncate text-xs font-medium text-neutral-400">
                            {[row.campaignName, row.adSetName].filter(Boolean).join(" · ") || row.id}
                          </div>
                          {a.sku || a.productName ? (
                            <div className="mt-1 max-w-[360px] truncate text-[11px] font-semibold text-emerald-700">
                              {(a.sku ? `SKU: ${a.sku}` : a.productName) || ""}
                            </div>
                          ) : null}
                          {level !== "ad" ? <FamilyFlowMini row={row} /> : null}
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3"><StatusPill value={row.effectiveStatus || row.status} /></td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">
                      <div className="font-semibold">{compact((m as any).conversationStarts || m.purchases)}</div>
                      <div className="text-[11px] font-semibold text-neutral-400">Lượt bắt đầu cuộc trò chuyện qua tin nhắn</div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).messages) ? compact((m as any).messages) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).costPerMessage) ? money((m as any).costPerMessage) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).conversationStarts) ? compact((m as any).conversationStarts) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).costPerConversation) ? money((m as any).costPerConversation) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).comments) ? compact((m as any).comments) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).costPerResult) ? money((m as any).costPerResult) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {n((m as any).averagePurchaseValue) ? money((m as any).averagePurchaseValue) : "—"}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">
                      <div className={n(a.orderCount) ? "font-semibold text-emerald-700" : "font-semibold text-neutral-400"}>
                        {a.allocationMode === "family_shared" ? "—" : compact(a.orderCount)}
                      </div>
                      <div className="mt-1 flex justify-end">
                        <FamilyPill row={row} />
                      </div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {a.allocationMode === "family_shared" ? <span className="text-neutral-400">{a.familySku || "Family"} · {money(a.familyRevenue)}</span> : (n(a.revenue) ? money(a.revenue) : "—")}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">
                      {a.allocationMode === "family_shared" ? "—" : (n(a.realRoasEstimate) ? ratio(a.realRoasEstimate) : "—")}
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">{n(m.costPerPurchase) ? money(m.costPerPurchase) : "—"}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">{hasSpend ? money(m.spend) : "0đ"}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">{compact(m.impressions)}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">{compact(m.reach)}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">{compact(m.clicks)}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">{pct(m.ctr)}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">{n(m.cpc) ? money(m.cpc) : "—"}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">{ratio(m.roas)}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        s >= 75 ? "bg-emerald-50 text-emerald-700" : s >= 45 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {s} điểm
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={23} className="px-4 py-14 text-center text-sm font-semibold text-neutral-400">Không có dòng phù hợp bộ lọc. Kiểm tra bộ lọc hoặc bấm Sync nhẹ hôm nay để có ad-level rồi hệ thống sẽ tự gộp lên Chiến dịch/Nhóm quảng cáo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductPanel({ payload }: { payload: ProductPerformancePayload | null }) {
  const rows = payload?.rows || [];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Sản phẩm tạo đơn thật</h3>
          <p className="text-xs font-semibold text-neutral-500">Đọc từ orderItem/order trong hệ thống.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{compact(payload?.totalOrders)} đơn</span>
      </div>
      <div className="space-y-2">
        {rows.slice(0, 8).map((row, index) => (
          <div key={row.key || index} className="rounded-xl bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{index + 1}. {row.productName}</div>
                <div className="truncate text-[11px] font-semibold text-neutral-500">SKU cha: {row.familySku || row.sku || "Không có SKU"}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-700">{compact(row.orderCount)} đơn</div>
                <div className="text-[11px] font-semibold text-neutral-500">SP {money(row.revenue)} · Đơn {money((row as any).orderRevenue)}</div>
              </div>
            </div>
          </div>
        ))}
        {!rows.length ? <div className="rounded-xl bg-neutral-50 p-3 text-sm font-semibold text-neutral-400">Chưa có sản phẩm tạo đơn trong khoảng này.</div> : null}
      </div>
    </div>
  );
}

function InsightRail({ data, rows, productPayload }: { data: BrainOverview | null; rows: BrainRow[]; productPayload: ProductPerformancePayload | null }) {
  const topSpend = [...rows].filter((r) => n(r.metrics?.spend) > 0).slice(0, 5);

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Đối soát số liệu</h3>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Accuracy</span>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Meta official</div>
            <div className="mt-1 text-lg font-semibold">{money(data?.reconciliation?.officialSpend ?? data?.summary?.spend)}</div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">DB ad-level</div>
            <div className="mt-1 text-lg font-semibold">{money(data?.reconciliation?.dbSpend ?? data?.dbSummary?.spend)}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Chênh lệch cần theo dõi</div>
            <div className="mt-1 text-lg font-semibold text-amber-700">{money(data?.reconciliation?.spendDiff)}</div>
          </div>
        </div>
      </div>

      <ProductPanel payload={productPayload} />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Cảnh báo vận hành</h3>
        <p className="mt-1 text-xs font-semibold text-neutral-500">Đây là tín hiệu Meta, chưa phải kết luận đơn thật nội bộ.</p>
        <div className="mt-3 space-y-2">
          {(data?.warnings || []).slice(0, 5).map((w, i) => (
            <div key={w.id || i} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-semibold text-amber-800">{cleanInsightTitle(w.title)}</div>
              <div className="mt-1 text-xs font-semibold leading-5 text-amber-700">{cleanInsightDesc(w.desc)}</div>
            </div>
          ))}
          {!data?.warnings?.length ? <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Chưa có cảnh báo lớn.</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Top chi tiêu</h3>
        <div className="mt-3 space-y-2">
          {topSpend.map((row, index) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl bg-neutral-50 p-2">
              {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-neutral-200" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{index + 1}. {row.name}</div>
                <div className="text-[11px] font-semibold text-neutral-500">{money(row.metrics?.spend)} · CTR {pct(row.metrics?.ctr)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}


function RowDetailDrawer({
  row,
  onClose,
}: {
  row: BrainRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const m = row.metrics || {};
  const a = productAttr(row);
  const score = signalScore(row);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Đóng chi tiết"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-[520px] overflow-y-auto border-l border-neutral-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Chi tiết quảng cáo</p>
              <h2 className="mt-1 line-clamp-2 text-xl font-semibold text-neutral-950">{row.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {row.thumbnailUrl ? (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              <img src={row.thumbnailUrl} alt="" className="max-h-[320px] w-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : null}

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Tín hiệu vận hành</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                score >= 75 ? "bg-emerald-50 text-emerald-700" : score >= 45 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
              }`}>
                {score} điểm
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-xs text-neutral-400">Chi phí ads</div>
                <div className="mt-1 font-semibold">{money(m.spend)}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-xs text-neutral-400">CTR</div>
                <div className="mt-1 font-semibold">{pct(m.ctr)}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-xs text-neutral-400">Lượt nhấp</div>
                <div className="mt-1 font-semibold">{compact(m.clicks)}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-xs text-neutral-400">CPC</div>
                <div className="mt-1 font-semibold">{n(m.cpc) ? money(m.cpc) : "—"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="font-semibold">Sản phẩm / đơn hệ thống</h3>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Dữ liệu đơn là order thật theo sản phẩm. Gắn vào ads theo tên/SKU, chưa phải fbclid/pixel chuẩn.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-xs text-emerald-700">Đơn gán ads</div>
                <div className="mt-1 font-semibold text-emerald-800">{a.allocationMode === "family_shared" ? "—" : compact(a.orderCount)}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-xs text-emerald-700">DT gán ads</div>
                <div className="mt-1 font-semibold text-emerald-800">{a.allocationMode === "family_shared" ? "Không chia theo ads" : money(a.revenue)}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-xs text-neutral-400">SKU match</div>
                <div className="mt-1 truncate font-semibold">{a.sku || "—"}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-xs text-neutral-400">Real ROAS ƯT</div>
                <div className="mt-1 font-semibold">{n(a.realRoasEstimate) ? ratio(a.realRoasEstimate) : "—"}</div>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-neutral-50 p-3">
              <div className="text-xs text-neutral-400">Sản phẩm match</div>
              <div className="mt-1 text-sm font-semibold">{a.productName || "Chưa match sản phẩm"}</div>
              <div className="mt-1 text-xs text-neutral-500">{a.label || "—"}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="font-semibold">Đơn mẫu</h3>
            <div className="mt-3 space-y-2">
              {(a.sampleOrders || []).slice(0, 8).map((order, index) => (
                <div key={`${order.orderCode || index}`} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 text-sm">
                  <div>
                    <div className="font-semibold">{order.orderCode || `Đơn ${index + 1}`}</div>
                    <div className="text-xs text-neutral-500">{order.status || "—"}</div>
                  </div>
                  <div className="font-semibold">{money(order.revenue)}</div>
                </div>
              ))}
              {!a.sampleOrders?.length ? (
                <div className="rounded-xl bg-neutral-50 p-3 text-sm font-medium text-neutral-400">
                  Chưa có đơn mẫu để hiển thị.
                </div>
              ) : null}
            </div>
          </div>

          {row.previewShareableLink ? (
            <a
              href={row.previewShareableLink}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-neutral-950 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Mở preview Meta
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  );
}


export default function MetaAdsBrainCenterPageClient() {
  const [range, setRange] = useState<RangeKey>("yesterday");
  const [level, setLevel] = useState<LevelKey>("ad");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [metricFilterField, setMetricFilterField] = useState("spend");
  const [metricFilterOp, setMetricFilterOp] = useState("gte");
  const [metricFilterValue, setMetricFilterValue] = useState("");
  const [search, setSearch] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("facebook");
  const [data, setData] = useState<BrainOverview | null>(null);
  const [productPayload, setProductPayload] = useState<ProductPerformancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [selectedRow, setSelectedRow] = useState<BrainRow | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [brain, products] = await Promise.all([
        apiJson<BrainOverview>(`/meta-ads/brain-overview?range=${range}&summaryLevel=ad&includeProductOrders=1&sourceMode=${sourceMode}&orderMode=valid`),
        apiJson<ProductPerformancePayload>(`/meta-ads/product-performance?range=${range}&limit=100&sourceMode=${sourceMode}&orderMode=valid`),
      ]);
      setData(brain);
      setProductPayload(products);
    } catch (err: any) {
      setError(err?.message || "Không tải được dữ liệu Meta Ads Operating Center");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
    setSyncMessage("");
    try {
      const payload = await apiJson<SyncPayload>("/meta-ads/sync", {
        method: "POST",
        body: JSON.stringify({
          range,
          includeStructure: false,
          includeInsights: true,
          levels: ["ad"],
          limit: 1000,
        }),
      });
      setSyncMessage(`Sync nhẹ xong: ${payload.insights || 0} dòng ad insights. Không kéo structure nên không đơ.`);
      await load();
    } catch (err: any) {
      setError(err?.message || "Sync Meta Ads thất bại");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, sourceMode, level]);

  const rawAdRows = data?.topAds || [];

  const sourceRows = useMemo(() => {
    return aggregateRows(rawAdRows, level);
  }, [rawAdRows, level]);

  const rows = useMemo(() => {
    return sourceRows
      .filter((row) => rowSearch(row, search))
      .filter((row) => filterRow(row, filter))
      .filter((row) => passMetricFilter(row, metricFilterField, metricFilterOp, metricFilterValue));
  }, [sourceRows, search, filter, metricFilterField, metricFilterOp, metricFilterValue]);

  const summary = data?.summary || {};
  const status = data?.statusBreakdown;

  const productTotal = productPayload || { totalOrders: 0, totalRevenue: 0 };

  return (
    <main className={fullscreen ? "fixed inset-0 z-[9999] overflow-auto bg-[#f7f7f7] p-3 font-sans text-neutral-950" : "min-h-screen w-full bg-[#f7f7f7] px-3 py-4 font-sans text-neutral-950 md:px-4"}>
      <div className={fullscreen ? "w-full space-y-4" : "w-full space-y-4"}>
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex w-full flex-col gap-4 border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Marketing Brain Center · V30 CORE BUILD FIXED</p>
              <h1 className="mt-2 font-serif text-[34px] font-medium tracking-tight">Meta Ads Operating Center</h1>
              <p className="mt-2 max-w-5xl text-sm font-medium leading-6 text-neutral-300">
                Bảng vận hành là trung tâm. KPI tổng dùng số chính thức từ Meta. Sản phẩm tạo đơn đọc từ order thật trong hệ thống; gắn ads theo tên/SKU chỉ là gợi ý, chưa phải fbclid chuẩn.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/10 px-3 py-1.5">Cập nhật {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("vi-VN") : "—"}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">Khoảng {rangeVi(data)}</span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-emerald-200">Read-only</span>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-8">
            <Kpi label="Chi phí ads" value={money(summary.spend)} sub="Meta official live" tone="amber" />
            <Kpi label="Lượt mua Meta" value={compact(summary.purchases)} sub={`CPA ${n(summary.costPerPurchase) ? money(summary.costPerPurchase) : "—"}`} tone={n(summary.purchases) ? "green" : "neutral"} />
            <Kpi label="Đơn gán ads" value={compact(productTotal.totalOrders)} sub="Tạo đơn hợp lệ" tone={n(productTotal.totalOrders) ? "green" : "neutral"} />
            <Kpi label="DT sản phẩm" value={money(productTotal.totalRevenue)} sub={`DT đơn ${money((productTotal as any).totalOrderRevenue)}`} tone={n(productTotal.totalRevenue) ? "green" : "neutral"} />
            <Kpi label="ROAS Meta" value={ratio(summary.roas)} sub={money(summary.purchaseValue)} tone={n(summary.roas) >= 2 ? "green" : "neutral"} />
            <Kpi label="Lượt nhấp" value={compact(summary.clicks)} sub={`CTR ${pct(summary.ctr)}`} />
            <Kpi label="Chiến dịch chạy" value={`${status?.campaigns?.active || 0}/${status?.campaigns?.total || 0}`} sub="Campaign active" tone="green" />
            <Kpi label="Ads chạy" value={`${status?.ads?.active || 0}/${status?.ads?.total || 0}`} sub="Creative active" tone="green" />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
        {syncMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{syncMessage}</div> : null}

        <section className={fullscreen ? "grid w-full gap-4" : "grid w-full gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]"}>
          <div className="min-w-0 w-full">
            <Toolbar
              level={level}
              setLevel={setLevel}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              range={range}
              setRange={setRange}
              onSync={syncNow}
              syncing={syncing}
              onReload={load}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen((v) => !v)}
            />

            <section className="border-x border-neutral-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">Meta Pivot Report</p>
                  <h3 className="text-lg font-semibold">Báo cáo tóm tắt nhanh</h3>
                  <p className="text-sm font-medium text-neutral-500">Lấy từ Meta actions: tin nhắn, bắt đầu chat, comment, Chi phí trên mỗi kết quả và AOV.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold">Pivot</button>
                  <button className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold">Tuỳ chỉnh cột</button>
                  <button className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold">Xuất</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <Kpi label="Reach" value={compact(summary.reach)} sub="Người tiếp cận" />
                <Kpi label="Tổng số người liên hệ nhắn tin" value={compact(summary.messages)} sub={n(summary.costPerMessage) ? `CP msg ${money(summary.costPerMessage)}` : "Meta actions"} />
                <Kpi label="Lượt bắt đầu cuộc trò chuyện qua tin nhắn" value={compact(summary.conversationStarts)} sub={n(summary.costPerConversation) ? `Chi phí trên mỗi kết quả ${money(summary.costPerConversation)}` : "Conversation started"} />
                <Kpi label="Bình luận về bài viết" value={compact(summary.comments)} sub="Post comment" />
                <Kpi label="Chi phí trên mỗi kết quả" value={n(summary.costPerResult) ? money(summary.costPerResult) : "—"} sub="Theo mục tiêu chính" />
                <Kpi label="Giá trị chuyển đổi trung bình mỗi lượt mua" value={n(summary.averagePurchaseValue) ? money(summary.averagePurchaseValue) : "—"} sub="Giá trị TB / purchase" />
              </div>
            </section>

            <div className="flex items-center gap-2 border-x border-neutral-200 bg-white px-4 py-2 text-xs font-semibold">
              <span className="text-neutral-400">Nguồn đơn:</span>
              {[
                { id: "facebook", label: "Chỉ Facebook" },
                { id: "all", label: "Tất cả nguồn" },
                { id: "pos", label: "Chỉ POS" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSourceMode(item.id as SourceMode)}
                  className={`rounded-full border px-3 py-1 ${
                    sourceMode === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <MainTable rows={rows} level={level} loading={loading} onSelect={setSelectedRow} />
          </div>
          {!fullscreen ? <InsightRail data={data} rows={sourceRows} productPayload={productPayload} /> : null}
        </section>
      </div>

      <RowDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </main>
  );
}
