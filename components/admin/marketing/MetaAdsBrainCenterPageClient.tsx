"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d";
type LevelKey = "campaign" | "adset" | "ad";
type Tone = "good" | "warn" | "bad" | "muted";

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

type BrainRow = {
  id: string;
  level: LevelKey | string;
  name: string;
  campaignName?: string | null;
  adSetName?: string | null;
  status?: string | null;
  effectiveStatus?: string | null;
  thumbnailUrl?: string | null;
  previewShareableLink?: string | null;
  metrics: Metrics;
};

type DailyRow = {
  date: string;
  metrics: Metrics;
};

type BrainOverview = {
  ok?: boolean;
  range?: { since?: string; until?: string };
  summaryLevel?: string;
  generatedAt?: string;
  summary?: Metrics;
  dbSummary?: Metrics;
  metaOfficialSummary?: Metrics | null;
  reconciliation?: {
    source?: string;
    officialFetchedAt?: string | null;
    dbSpend?: number;
    officialSpend?: number | null;
    diffSpend?: number;
    diffPercent?: number;
    note?: string;
  };
  statusBreakdown?: {
    campaigns?: { total?: number; active?: number; inactive?: number };
    adSets?: { total?: number; active?: number; inactive?: number };
    ads?: { total?: number; active?: number; inactive?: number };
  };
  dailyRows?: DailyRow[];
  topCampaigns?: BrainRow[];
  topAdSets?: BrainRow[];
  topAds?: BrainRow[];
  warnings?: Array<{ id?: string; title?: string; desc?: string; tone?: string }>;
  latestLogs?: any[];
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
  ""
).replace(/\/$/, "");

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string }> = [
  { id: "today", label: "Hôm nay" },
  { id: "yesterday", label: "Hôm qua" },
  { id: "7d", label: "7 ngày" },
  { id: "10d", label: "10 ngày" },
  { id: "30d", label: "30 ngày" },
];

const LEVEL_OPTIONS: Array<{ id: LevelKey; label: string; sub: string }> = [
  { id: "campaign", label: "Chiến dịch", sub: "Campaign" },
  { id: "adset", label: "Nhóm quảng cáo", sub: "Ad set" },
  { id: "ad", label: "Quảng cáo / Creative", sub: "Ads" },
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

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  const amount = n(value);
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}đ`;
}

function compact(value: unknown) {
  const amount = n(value);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return `${Math.round(amount)}`;
}

function pct(value: unknown) {
  return `${n(value).toFixed(2)}%`;
}

function ratio(value: unknown) {
  const amount = n(value);
  return amount > 0 ? `${amount.toFixed(2)}x` : "—";
}

function dateVi(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function statusVi(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw.includes("ACTIVE")) return "Đang chạy";
  if (raw.includes("PAUSED") || raw.includes("DISABLED")) return "Chiến dịch tắt";
  if (raw.includes("ARCHIVED")) return "Đã lưu trữ";
  return raw || "Chưa rõ";
}

function statusTone(value?: string | null): Tone {
  const raw = String(value || "").toUpperCase();
  if (raw.includes("ACTIVE")) return "good";
  if (raw.includes("PAUSED") || raw.includes("DISABLED") || raw.includes("ARCHIVED")) return "muted";
  return "warn";
}

function toneClass(tone: Tone) {
  if (tone === "good") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "bad") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

function rowMetrics(row?: BrainRow | null): Metrics {
  return row?.metrics || {};
}

function metricScore(row: BrainRow) {
  const m = rowMetrics(row);
  const spend = n(m.spend);
  const purchases = n(m.purchases);
  const cpa = n(m.costPerPurchase);
  if (spend > 0 && purchases === 0) return 25;
  if (purchases > 0 && cpa < 250_000) return 92;
  if (purchases > 0 && cpa < 450_000) return 78;
  if (purchases > 0 && cpa < 700_000) return 58;
  return 40;
}

function scoreTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

function filterRows(rows: BrainRow[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.name, row.campaignName, row.adSetName, row.effectiveStatus, row.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "muted",
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  badge?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className={`absolute right-4 top-4 h-2.5 w-2.5 rounded-full ${
        tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-rose-500" : "bg-neutral-300"
      }`} />
      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-400">{label}</p>
      <div className="mt-3 text-2xl font-black tracking-tight text-neutral-950">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
        {badge ? <span className={`rounded-full border px-2 py-0.5 font-bold ${toneClass(tone)}`}>{badge}</span> : null}
        <span>{sub || "—"}</span>
      </div>
    </div>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  const tone = statusTone(value);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(tone)}`}>
      {statusVi(value)}
    </span>
  );
}

function MiniBarChart({ rows }: { rows: DailyRow[] }) {
  const maxSpend = Math.max(...rows.map((row) => n(row.metrics.spend)), 1);
  const maxPurchase = Math.max(...rows.map((row) => n(row.metrics.purchases)), 1);

  return (
    <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-400">DB Insight Daily</p>
          <h2 className="mt-1 text-lg font-black">Chi phí ads & lượt mua theo ngày</h2>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-500">Summary level: ad</span>
      </div>
      <div className="flex h-[220px] items-end gap-4 rounded-[24px] bg-gradient-to-b from-neutral-50 to-white px-5 py-4">
        {rows.length ? rows.map((row) => {
          const spendHeight = Math.max(5, Math.round((n(row.metrics.spend) / maxSpend) * 170));
          const purchaseHeight = Math.max(4, Math.round((n(row.metrics.purchases) / maxPurchase) * 120));
          return (
            <div key={row.date} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-[180px] items-end gap-1">
                <div
                  title={`Chi phí: ${money(row.metrics.spend)}`}
                  className="w-6 rounded-t-xl bg-neutral-950"
                  style={{ height: spendHeight }}
                />
                <div
                  title={`Lượt mua: ${compact(row.metrics.purchases)}`}
                  className="w-3 rounded-t-xl bg-emerald-500"
                  style={{ height: purchaseHeight }}
                />
              </div>
              <span className="text-[11px] font-bold text-neutral-400">{dateVi(row.date)}</span>
            </div>
          );
        }) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-neutral-400">
            Chưa có dữ liệu theo ngày
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-5 text-xs font-semibold text-neutral-500">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-950" /> Chi phí ads</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lượt mua</span>
      </div>
    </div>
  );
}

function WarningBoard({ warnings }: { warnings: BrainOverview["warnings"] }) {
  return (
    <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-400">Read-only</p>
          <h2 className="mt-1 text-lg font-black">Cảnh báo vận hành</h2>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">Ưu tiên check</span>
      </div>
      <div className="space-y-3">
        {(warnings || []).slice(0, 6).map((item, index) => (
          <div key={item.id || index} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm font-black text-amber-800">{item.title || "Cảnh báo ads"}</div>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">{item.desc || "Cần kiểm tra lại hiệu quả."}</p>
          </div>
        ))}
        {!warnings?.length ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            Chưa có cảnh báo lớn trong khoảng đang xem.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CreativeBoard({ rows }: { rows: BrainRow[] }) {
  const top = rows.filter((row) => row.thumbnailUrl).slice(0, 4);
  if (!top.length) return null;

  return (
    <section className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-400">Creative Board</p>
          <h2 className="mt-1 text-xl font-black">Top quảng cáo đang tiêu tiền</h2>
        </div>
        <span className="text-xs font-semibold text-neutral-400">Ưu tiên nhìn ảnh sản phẩm trước khi đọc số</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {top.map((row, index) => {
          const m = rowMetrics(row);
          const score = metricScore(row);
          return (
            <div key={row.id} className="group overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
              <div className="relative h-40 overflow-hidden bg-neutral-100">
                <img src={row.thumbnailUrl || ""} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <div className="absolute left-3 top-3 rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-black text-white">#{index + 1}</div>
                <div className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(statusTone(row.effectiveStatus || row.status))}`}>
                  {statusVi(row.effectiveStatus || row.status)}
                </div>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 min-h-[40px] text-sm font-black text-neutral-950">{row.name}</h3>
                <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{row.campaignName || row.adSetName || "—"}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-neutral-50 p-3 text-center">
                    <p className="text-[10px] font-bold text-neutral-400">Chi phí</p>
                    <p className="mt-1 text-xs font-black">{money(m.spend)}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-3 text-center">
                    <p className="text-[10px] font-bold text-neutral-400">Lượt mua</p>
                    <p className="mt-1 text-xs font-black">{compact(m.purchases)}</p>
                  </div>
                  <div className={`rounded-2xl border p-3 text-center ${toneClass(scoreTone(score))}`}>
                    <p className="text-[10px] font-bold opacity-70">Điểm</p>
                    <p className="mt-1 text-xs font-black">{score}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RowsTable({
  rows,
  level,
}: {
  rows: BrainRow[];
  level: LevelKey;
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
            <tr>
              <th className="px-5 py-4">Tên</th>
              <th className="px-5 py-4">Phân phối</th>
              <th className="px-5 py-4 text-right">Chi phí ads</th>
              <th className="px-5 py-4 text-right">Lượt mua</th>
              <th className="px-5 py-4 text-right">CPA</th>
              <th className="px-5 py-4 text-right">Lượt nhấp</th>
              <th className="px-5 py-4 text-right">CTR</th>
              <th className="px-5 py-4 text-right">ROAS Meta</th>
              <th className="px-5 py-4 text-right">Giá trị mua</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const m = rowMetrics(row);
              return (
                <tr key={`${level}-${row.id}`} className="hover:bg-neutral-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {row.thumbnailUrl ? (
                        <img src={row.thumbnailUrl} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-neutral-200" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-[10px] font-black text-neutral-400">
                          {level === "campaign" ? "CD" : level === "adset" ? "NQ" : "ADS"}
                        </div>
                      )}
                      <div>
                        <div className="max-w-[420px] truncate font-black text-neutral-950">{row.name || "—"}</div>
                        <div className="mt-1 max-w-[420px] truncate text-xs font-medium text-neutral-400">
                          {[row.campaignName, row.adSetName].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusPill value={row.effectiveStatus || row.status} /></td>
                  <td className="px-5 py-4 text-right font-black">{money(m.spend)}</td>
                  <td className="px-5 py-4 text-right font-bold">{compact(m.purchases)}</td>
                  <td className="px-5 py-4 text-right font-bold">{n(m.costPerPurchase) ? money(m.costPerPurchase) : "—"}</td>
                  <td className="px-5 py-4 text-right">{compact(m.clicks)}</td>
                  <td className="px-5 py-4 text-right">{n(m.ctr) ? pct(m.ctr) : "—"}</td>
                  <td className="px-5 py-4 text-right">{ratio(m.roas)}</td>
                  <td className="px-5 py-4 text-right">{money(m.purchaseValue)}</td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm font-semibold text-neutral-400">
                  Không có dữ liệu phù hợp bộ lọc hiện tại.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MetaAdsBrainCenterPageClient() {
  const [range, setRange] = useState<RangeKey>("yesterday");
  const [level, setLevel] = useState<LevelKey>("ad");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<BrainOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const payload = await apiJson<BrainOverview>(`/meta-ads/brain-overview?range=${range}&summaryLevel=ad`);
      setData(payload);
    } catch (err: any) {
      setError(err?.message || "Không tải được Meta Ads Brain Center");
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
      setSyncMessage(
        `Sync xong: ${payload.campaigns || 0} chiến dịch · ${payload.adSets || 0} nhóm · ${payload.ads || 0} quảng cáo · ${payload.insights || 0} dòng insight.`,
      );
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

  const summary = data?.summary || {};
  const reconciliation = data?.reconciliation;
  const spendDiff = n(reconciliation?.diffSpend);
  const spendDiffAbs = Math.abs(spendDiff);
  const spendSourceLabel =
    reconciliation?.source === "meta_account_live"
      ? "Meta official live"
      : "DB ad-level";
  const activeRows = useMemo(() => {
    const source =
      level === "campaign"
        ? data?.topCampaigns || []
        : level === "adset"
          ? data?.topAdSets || []
          : data?.topAds || [];
    return filterRows(source, search);
  }, [data, level, search]);

  const bestRows = useMemo(() => {
    return [...(data?.topAds || [])]
      .filter((row) => n(row.metrics.spend) > 0)
      .sort((a, b) => metricScore(b) - metricScore(a))
      .slice(0, 4);
  }, [data]);

  const badRows = useMemo(() => {
    return [...(data?.topAds || [])]
      .filter((row) => n(row.metrics.spend) > 0 && n(row.metrics.purchases) === 0)
      .slice(0, 5);
  }, [data]);

  const status = data?.statusBreakdown;

  return (
    <main className="min-h-screen bg-[#f5f2eb] px-5 py-6 text-neutral-950 md:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-neutral-200 bg-white p-7 shadow-sm">
          <div className="absolute right-0 top-0 h-full w-[28%] bg-gradient-to-br from-emerald-50 via-lime-50 to-white" />
          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-neutral-400">Marketing Brain Center · V3 Big Data</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Meta Ads Operating Center</h1>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-neutral-600">
                Trung tâm điều hành ads nội bộ. Summary dùng <b>ad-level</b> để tránh cộng trùng campaign/adset/ad. Dashboard Tổng quan live cũ vẫn tách riêng, không bị ảnh hưởng.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-500">Cập nhật: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("vi-VN") : "—"}</span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-500">Khoảng: {data?.range?.since || "—"} → {data?.range?.until || "—"}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Read-only an toàn</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRange(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                    range === item.id
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button onClick={load} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-700">
                Tải lại
              </button>
              <button
                onClick={syncNow}
                disabled={syncing}
                className="rounded-full bg-neutral-950 px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60"
              >
                {syncing ? "Đang sync..." : "Sync Meta ngay"}
              </button>
            </div>
          </div>
        </section>

        {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
        {syncMessage ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{syncMessage}</div> : null}

        {reconciliation ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-400">Đối soát số liệu</p>
              <h2 className="mt-1 text-xl font-black">Meta official vs DB chi tiết</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs font-bold text-neutral-500">Meta official</div>
                  <div className="mt-1 text-lg font-black">{reconciliation.officialSpend != null ? money(reconciliation.officialSpend) : "—"}</div>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs font-bold text-neutral-500">DB ad-level</div>
                  <div className="mt-1 text-lg font-black">{money(reconciliation.dbSpend)}</div>
                </div>
                <div className={`rounded-2xl border p-4 ${spendDiffAbs > 1000000 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                  <div className="text-xs font-black">Chênh lệch</div>
                  <div className="mt-1 text-lg font-black">{money(spendDiff)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-emerald-700">Accuracy Layer V4</p>
              <h2 className="mt-1 text-xl font-black">KPI tổng dùng số chính thức từ Meta</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                {reconciliation.note || "KPI tổng ưu tiên account-level live để khớp Ads Manager. Bảng creative vẫn dùng DB đã sync để phân tích sâu."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white px-3 py-1 text-emerald-700">Không cộng trùng layer</span>
                <span className="rounded-full bg-white px-3 py-1 text-emerald-700">Campaign / Adset / Ad tách riêng</span>
                <span className="rounded-full bg-white px-3 py-1 text-emerald-700">Dashboard live cũ không đổi</span>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Chi phí ads" value={money(summary.spend)} sub={spendSourceLabel} tone={spendDiffAbs > 1000000 ? "warn" : "muted"} />
          <KpiCard label="Lượt mua" value={compact(summary.purchases)} sub={`CPA ${n(summary.costPerPurchase) ? money(summary.costPerPurchase) : "—"}`} tone={n(summary.purchases) > 0 ? "good" : "warn"} />
          <KpiCard label="ROAS Meta" value={ratio(summary.roas)} sub={money(summary.purchaseValue)} tone={n(summary.roas) >= 2 ? "good" : "muted"} />
          <KpiCard label="Lượt nhấp" value={compact(summary.clicks)} sub={`CTR ${pct(summary.ctr)}`} tone="muted" />
          <KpiCard label="Chiến dịch chạy" value={`${status?.campaigns?.active || 0}/${status?.campaigns?.total || 0}`} sub="Campaign active" tone="good" />
          <KpiCard label="Ads chạy" value={`${status?.ads?.active || 0}/${status?.ads?.total || 0}`} sub="Creative active" tone="good" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <MiniBarChart rows={data?.dailyRows || []} />
          <WarningBoard warnings={data?.warnings} />
        </section>

        {bestRows.length ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[30px] border border-emerald-200 bg-emerald-50/50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-emerald-700">Winning Signals</p>
              <h2 className="mt-1 text-xl font-black">Ads có tín hiệu tốt</h2>
              <div className="mt-4 space-y-3">
                {bestRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                    {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{row.name}</div>
                      <div className="text-xs font-semibold text-neutral-500">Chi phí {money(row.metrics.spend)} · Mua {compact(row.metrics.purchases)} · CTR {pct(row.metrics.ctr)}</div>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{metricScore(row)} điểm</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-amber-200 bg-amber-50/50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-700">Waste Watch</p>
              <h2 className="mt-1 text-xl font-black">Ads tiêu tiền chưa ra đơn</h2>
              <div className="mt-4 space-y-3">
                {badRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                    {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{row.name}</div>
                      <div className="text-xs font-semibold text-neutral-500">Đã tiêu {money(row.metrics.spend)} · Chưa có purchase</div>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">Check</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <CreativeBoard rows={data?.topAds || []} />

        <section className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setLevel(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-black ${
                    level === item.id
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm campaign / nhóm quảng cáo / ads..."
              className="h-11 rounded-full border border-neutral-200 bg-neutral-50 px-5 text-sm font-medium outline-none focus:border-neutral-950 lg:w-[360px]"
            />
          </div>
        </section>

        {loading ? (
          <div className="rounded-[30px] border border-neutral-200 bg-white p-12 text-center text-sm font-bold text-neutral-400">
            Đang tải dữ liệu Ads Brain Center...
          </div>
        ) : (
          <RowsTable rows={activeRows} level={level} />
        )}

        <section className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-400">Không ảnh hưởng Dashboard live</p>
              <h2 className="mt-1 text-lg font-black">Sync log gần nhất</h2>
            </div>
            <span className="text-xs font-bold text-neutral-400">Read-only connector</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.latestLogs || []).slice(0, 6).map((log, index) => (
              <div key={log.id || index} className="rounded-3xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
                <div className="font-black">{log.status || "SYNC"}</div>
                <div className="mt-1 text-xs text-neutral-500">{log.startedAt ? new Date(log.startedAt).toLocaleString("vi-VN") : "—"}</div>
                <div className="mt-2 text-neutral-700">{log.message || "Không có ghi chú"}</div>
              </div>
            ))}
            {!data?.latestLogs?.length ? <div className="text-sm text-neutral-500">Chưa có log sync.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
