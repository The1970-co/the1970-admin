"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d" | "custom";
type LevelKey = "campaign" | "adset" | "ad";

type MetaInsightRow = {
  id?: string;
  dateStart?: string;
  dateStop?: string;
  level?: LevelKey | string;
  campaignId?: string | null;
  campaignName?: string | null;
  adSetId?: string | null;
  adSetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  spend?: number | string | null;
  impressions?: number | string | null;
  reach?: number | string | null;
  clicks?: number | string | null;
  inlineLinkClicks?: number | string | null;
  cpc?: number | string | null;
  cpm?: number | string | null;
  ctr?: number | string | null;
  purchases?: number | string | null;
  costPerPurchase?: number | string | null;
  purchaseValue?: number | string | null;
  roas?: number | string | null;
};

type MetaCampaignRow = {
  id: string;
  metaCampaignId: string;
  name: string;
  status?: string | null;
  effectiveStatus?: string | null;
  objective?: string | null;
  buyingType?: string | null;
  account?: { name?: string | null; currency?: string | null } | null;
  insights?: MetaInsightRow[];
};

type MetaAdSetRow = {
  id: string;
  metaAdSetId: string;
  name: string;
  status?: string | null;
  effectiveStatus?: string | null;
  optimizationGoal?: string | null;
  dailyBudget?: string | number | null;
  campaign?: { name?: string | null; metaCampaignId?: string | null } | null;
  insights?: MetaInsightRow[];
};

type MetaAdRow = {
  id: string;
  metaAdId: string;
  name: string;
  status?: string | null;
  effectiveStatus?: string | null;
  thumbnailUrl?: string | null;
  previewShareableLink?: string | null;
  campaign?: { name?: string | null; metaCampaignId?: string | null } | null;
  adSet?: { name?: string | null; metaAdSetId?: string | null } | null;
  insights?: MetaInsightRow[];
};

type PagedPayload<T> = {
  items?: T[];
  rows?: T[];
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
};

type SyncPayload = {
  ok?: boolean;
  account?: any;
  campaigns?: number;
  adSets?: number;
  ads?: number;
  insights?: number;
  logs?: any[];
  message?: string;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  ""
).replace(/\/$/, "");

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string }> = [
  { id: "today", label: "Hôm nay" },
  { id: "yesterday", label: "Hôm qua" },
  { id: "7d", label: "7 ngày" },
  { id: "10d", label: "10 ngày" },
  { id: "30d", label: "30 ngày" },
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
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || `API lỗi ${res.status}`);
  }
  return payload as T;
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  const amount = toNumber(value);
  if (!amount) return "0₫";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}₫`;
}

function formatCompact(value: unknown) {
  const amount = toNumber(value);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return `${Math.round(amount)}`;
}

function normalizeItems<T>(payload: PagedPayload<T> | T[] | null): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.rows || payload.data || [];
}

function sumInsights(rows: MetaInsightRow[] = []) {
  const spend = rows.reduce((sum, row) => sum + toNumber(row.spend), 0);
  const impressions = rows.reduce((sum, row) => sum + toNumber(row.impressions), 0);
  const clicks = rows.reduce((sum, row) => sum + toNumber(row.clicks || row.inlineLinkClicks), 0);
  const purchases = rows.reduce((sum, row) => sum + toNumber(row.purchases), 0);
  const purchaseValue = rows.reduce((sum, row) => sum + toNumber(row.purchaseValue), 0);
  return {
    spend,
    impressions,
    clicks,
    purchases,
    purchaseValue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
    roas: spend > 0 ? purchaseValue / spend : 0,
  };
}

function StatusPill({ value }: { value?: string | null }) {
  const raw = String(value || "UNKNOWN").toUpperCase();
  const active = raw.includes("ACTIVE");
  const paused = raw.includes("PAUSED") || raw.includes("DISABLE");
  const cls = active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : paused
      ? "border-neutral-200 bg-neutral-50 text-neutral-500"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{raw}</span>;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div>
      {sub ? <div className="mt-1 text-xs text-neutral-500">{sub}</div> : null}
    </div>
  );
}

export default function MetaAdsBrainCenterPageClient() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [level, setLevel] = useState<LevelKey>("ad");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState<SyncPayload | null>(null);
  const [campaigns, setCampaigns] = useState<MetaCampaignRow[]>([]);
  const [adSets, setAdSets] = useState<MetaAdSetRow[]>([]);
  const [ads, setAds] = useState<MetaAdRow[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ range, limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [range, search]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [campaignPayload, adSetPayload, adPayload, logPayload] = await Promise.all([
        apiJson<PagedPayload<MetaCampaignRow>>(`/meta-ads/campaigns-db?${queryString}`),
        apiJson<PagedPayload<MetaAdSetRow>>(`/meta-ads/adsets-db?${queryString}`),
        apiJson<PagedPayload<MetaAdRow>>(`/meta-ads/ads-db?${queryString}`),
        apiJson<PagedPayload<any>>(`/meta-ads/sync-logs?limit=10`),
      ]);
      setCampaigns(normalizeItems(campaignPayload));
      setAdSets(normalizeItems(adSetPayload));
      setAds(normalizeItems(adPayload));
      setLogs(normalizeItems(logPayload));
    } catch (err: any) {
      setError(err?.message || "Không tải được dữ liệu Meta Ads DB");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError("");
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
      setSyncResult(payload);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Sync Meta Ads thất bại");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const activeRows = level === "campaign" ? campaigns : level === "adset" ? adSets : ads;
  const allInsights = [
    ...campaigns.flatMap((row) => row.insights || []),
    ...adSets.flatMap((row) => row.insights || []),
    ...ads.flatMap((row) => row.insights || []),
  ];
  const summary = sumInsights(allInsights);

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-5 py-6 text-neutral-950 md:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Marketing Operations</div>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Ads Brain Center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Trung tâm đầu não Ads mới. Dữ liệu đọc từ DB sync riêng, không đụng flow Dashboard live đang dùng <b>MetaAdsService.getSummary()</b>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRange(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    range === item.id
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={syncNow}
                disabled={syncing}
                className="rounded-full bg-[#123c32] px-5 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-60"
              >
                {syncing ? "Đang sync..." : "Sync Meta ngay"}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
        ) : null}

        {syncResult ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Sync xong: {syncResult.campaigns || 0} campaign · {syncResult.adSets || 0} adset · {syncResult.ads || 0} ads · {syncResult.insights || 0} insight.
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Spend DB" value={formatMoney(summary.spend)} sub={`${range} · từ insight đã sync`} />
          <MetricCard label="Purchase" value={formatCompact(summary.purchases)} sub={`CPA ${formatMoney(summary.cpa)}`} />
          <MetricCard label="Clicks" value={formatCompact(summary.clicks)} sub={`CPC ${formatMoney(summary.cpc)}`} />
          <MetricCard label="CTR" value={`${summary.ctr.toFixed(2)}%`} sub={`${formatCompact(summary.impressions)} impressions`} />
          <MetricCard label="ROAS Meta" value={summary.roas ? `${summary.roas.toFixed(2)}x` : "—"} sub={formatMoney(summary.purchaseValue)} />
        </section>

        <section className="rounded-[32px] border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-neutral-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["campaign", "adset", "ad"] as LevelKey[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setLevel(item)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${
                    level === item
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700"
                  }`}
                >
                  {item === "campaign" ? "Campaign" : item === "adset" ? "Ad Set" : "Ads / Creative"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên campaign/adset/ad..."
                className="h-10 w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none focus:border-neutral-950 lg:w-80"
              />
              <button onClick={loadData} className="h-10 rounded-full border border-neutral-200 px-4 text-sm font-bold">Tải lại</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-3">Tên</th>
                  <th className="px-5 py-3">Phân phối</th>
                  <th className="px-5 py-3 text-right">Spend</th>
                  <th className="px-5 py-3 text-right">Purchase</th>
                  <th className="px-5 py-3 text-right">CPA</th>
                  <th className="px-5 py-3 text-right">Clicks</th>
                  <th className="px-5 py-3 text-right">CTR</th>
                  <th className="px-5 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-neutral-500">Đang tải dữ liệu...</td></tr>
                ) : activeRows.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-neutral-500">Chưa có dữ liệu DB. Bấm “Sync Meta ngay”.</td></tr>
                ) : (
                  activeRows.map((row: any) => {
                    const s = sumInsights(row.insights || []);
                    return (
                      <tr key={row.id} className="hover:bg-neutral-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {level === "ad" && row.thumbnailUrl ? (
                              <img src={row.thumbnailUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-500">
                                {level.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="max-w-[420px] truncate font-bold text-neutral-950">{row.name || "—"}</div>
                              <div className="mt-1 max-w-[420px] truncate text-xs text-neutral-500">
                                {level === "campaign" ? row.objective : level === "adset" ? row.campaign?.name : `${row.campaign?.name || ""} · ${row.adSet?.name || ""}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><StatusPill value={row.effectiveStatus || row.status} /></td>
                        <td className="px-5 py-4 text-right font-semibold">{formatMoney(s.spend)}</td>
                        <td className="px-5 py-4 text-right">{formatCompact(s.purchases)}</td>
                        <td className="px-5 py-4 text-right">{s.cpa ? formatMoney(s.cpa) : "—"}</td>
                        <td className="px-5 py-4 text-right">{formatCompact(s.clicks)}</td>
                        <td className="px-5 py-4 text-right">{s.ctr ? `${s.ctr.toFixed(2)}%` : "—"}</td>
                        <td className="px-5 py-4 text-right">{s.roas ? `${s.roas.toFixed(2)}x` : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Sync log gần nhất</h2>
            <span className="text-xs text-neutral-500">Read-only connector</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {logs.length ? logs.map((log, index) => (
              <div key={log.id || index} className="rounded-3xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
                <div className="font-bold">{log.status || log.type || "SYNC"}</div>
                <div className="mt-1 text-xs text-neutral-500">{log.startedAt || log.createdAt || "—"}</div>
                <div className="mt-2 text-neutral-700">{log.message || log.errorMessage || "Không có ghi chú"}</div>
              </div>
            )) : <div className="text-sm text-neutral-500">Chưa có log sync.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
