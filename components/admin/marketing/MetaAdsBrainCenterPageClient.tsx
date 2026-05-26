"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d";
type LevelKey = "campaign" | "adset" | "ad";
type FilterKey = "all" | "active" | "spent" | "hasPurchase" | "noMetaPurchase" | "hasSystemOrder" | "noSystemOrder" | "cpaHigh" | "ctrHigh";

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
};

type ProductPerformanceRow = {
  key: string;
  sku?: string;
  productName: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  averageOrderValue: number;
};

type ProductPerformancePayload = {
  ok?: boolean;
  totalProducts?: number;
  totalOrders?: number;
  totalQuantity?: number;
  totalRevenue?: number;
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

function MainTable({ rows, level, loading }: { rows: BrainRow[]; level: LevelKey; loading: boolean }) {
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
            Bảng là trung tâm vận hành. Cột đơn hệ thống là đơn thật theo sản phẩm; gắn ads theo tên/SKU, chưa phải fbclid chuẩn.
          </p>
        </div>
        <div className="hidden gap-2 text-xs font-semibold text-neutral-500 md:flex">
          <span className="rounded-full bg-neutral-100 px-3 py-1">{rows.length} dòng</span>
          <span className="rounded-full bg-neutral-100 px-3 py-1">{money(total.spend)}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{compact(total.systemOrders)} đơn HT</span>
        </div>
      </div>

      <div className="max-h-[700px] w-full overflow-auto">
        <table className="w-full min-w-[1720px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-neutral-950 text-[11px] uppercase tracking-[0.12em] text-white">
            <tr>
              <th className="w-[44px] px-3 py-3"><input type="checkbox" className="h-4 w-4 rounded" /></th>
              <th className="w-[430px] px-3 py-3">Tên</th>
              <th className="px-3 py-3">Phân phối</th>
              <th className="px-3 py-3 text-right">Kết quả Meta</th>
              <th className="px-3 py-3 text-right">Đơn hệ thống</th>
              <th className="px-3 py-3 text-right">Doanh thu HT</th>
              <th className="px-3 py-3 text-right">Real ROAS ƯT</th>
              <th className="px-3 py-3 text-right">CPA</th>
              <th className="px-3 py-3 text-right">Đã chi tiêu</th>
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
              <tr><td colSpan={16} className="px-4 py-14 text-center text-sm font-semibold text-neutral-400">Đang tải dữ liệu...</td></tr>
            ) : rows.length ? (
              rows.map((row, index) => {
                const m = row.metrics || {};
                const a = productAttr(row);
                const s = signalScore(row);
                const hasSpend = n(m.spend) > 0;
                return (
                  <tr key={`${level}-${row.id}`} className={`${index % 2 ? "bg-neutral-50/40" : "bg-white"} hover:bg-lime-50/60`}>
                    <td className="border-b border-neutral-100 px-3 py-3 align-middle">
                      <input type="checkbox" className="h-4 w-4 rounded" />
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
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3"><StatusPill value={row.effectiveStatus || row.status} /></td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">
                      <div className="font-semibold">{compact(m.purchases)}</div>
                      <div className="text-[11px] font-semibold text-neutral-400">Purchase Meta</div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right">
                      <div className={n(a.orderCount) ? "font-semibold text-emerald-700" : "font-semibold text-neutral-400"}>{compact(a.orderCount)}</div>
                      <div className="text-[11px] font-semibold text-neutral-400">{a.label || "Chưa match"}</div>
                    </td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">{n(a.revenue) ? money(a.revenue) : "—"}</td>
                    <td className="border-b border-neutral-100 px-3 py-3 text-right font-semibold">{n(a.realRoasEstimate) ? ratio(a.realRoasEstimate) : "—"}</td>
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
              <tr><td colSpan={16} className="px-4 py-14 text-center text-sm font-semibold text-neutral-400">Không có dòng phù hợp bộ lọc.</td></tr>
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
                <div className="truncate text-[11px] font-semibold text-neutral-500">{row.sku || "Không có SKU"}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-700">{compact(row.orderCount)} đơn</div>
                <div className="text-[11px] font-semibold text-neutral-500">{money(row.revenue)}</div>
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

export default function MetaAdsBrainCenterPageClient() {
  const [range, setRange] = useState<RangeKey>("yesterday");
  const [level, setLevel] = useState<LevelKey>("ad");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<BrainOverview | null>(null);
  const [productPayload, setProductPayload] = useState<ProductPerformancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [brain, products] = await Promise.all([
        apiJson<BrainOverview>(`/meta-ads/brain-overview?range=${range}&summaryLevel=ad&includeProductOrders=1`),
        apiJson<ProductPerformancePayload>(`/meta-ads/product-performance?range=${range}&limit=100`),
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
          includeStructure: true,
          includeInsights: true,
          levels: ["campaign", "adset", "ad"],
        }),
      });
      setSyncMessage(`Sync xong: ${payload.campaigns || 0} chiến dịch · ${payload.adSets || 0} nhóm · ${payload.ads || 0} quảng cáo · ${payload.insights || 0} insight.`);
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
  }, [range]);

  const sourceRows =
    level === "campaign" ? data?.topCampaigns || [] : level === "adset" ? data?.topAdSets || [] : data?.topAds || [];

  const rows = useMemo(() => {
    return sourceRows
      .filter((row) => rowSearch(row, search))
      .filter((row) => filterRow(row, filter));
  }, [sourceRows, search, filter]);

  const summary = data?.summary || {};
  const status = data?.statusBreakdown;

  const productTotal = productPayload || { totalOrders: 0, totalRevenue: 0 };

  return (
    <main className="min-h-screen w-full bg-[#f7f7f7] px-3 py-4 font-sans text-neutral-950 md:px-4">
      <div className="w-full space-y-4">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex w-full flex-col gap-4 border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Marketing Brain Center · V10 Operating System</p>
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
            <Kpi label="Đơn hệ thống" value={compact(productTotal.totalOrders)} sub="Order thật" tone={n(productTotal.totalOrders) ? "green" : "neutral"} />
            <Kpi label="DT hệ thống" value={money(productTotal.totalRevenue)} sub="Theo sản phẩm tạo đơn" tone={n(productTotal.totalRevenue) ? "green" : "neutral"} />
            <Kpi label="ROAS Meta" value={ratio(summary.roas)} sub={money(summary.purchaseValue)} tone={n(summary.roas) >= 2 ? "green" : "neutral"} />
            <Kpi label="Lượt nhấp" value={compact(summary.clicks)} sub={`CTR ${pct(summary.ctr)}`} />
            <Kpi label="Chiến dịch chạy" value={`${status?.campaigns?.active || 0}/${status?.campaigns?.total || 0}`} sub="Campaign active" tone="green" />
            <Kpi label="Ads chạy" value={`${status?.ads?.active || 0}/${status?.ads?.total || 0}`} sub="Creative active" tone="green" />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
        {syncMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{syncMessage}</div> : null}

        <section className="grid w-full gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
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
            />
            <MainTable rows={rows} level={level} loading={loading} />
          </div>
          <InsightRail data={data} rows={sourceRows} productPayload={productPayload} />
        </section>
      </div>
    </main>
  );
}
