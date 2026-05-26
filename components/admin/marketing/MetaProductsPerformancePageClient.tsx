"use client";

import React, { useEffect, useMemo, useState } from "react";

type RangeKey = "today" | "yesterday" | "7d" | "10d" | "30d";

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

function n(v: unknown) {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}

function money(v: unknown) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n(v)))}đ`;
}

function compact(v: unknown) {
  const x = n(v);
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${Math.round(x / 1_000)}K`;
  return `${Math.round(x)}`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-950">{value}</div>
      <div className="mt-1 text-xs font-medium text-neutral-500">{sub || "—"}</div>
    </div>
  );
}

export default function MetaProductsPerformancePageClient() {
  const [range, setRange] = useState<RangeKey>("yesterday");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
      setData(await apiJson<Payload>(`/meta-ads/product-performance?range=${range}&limit=300${q}`));
    } catch (err: any) {
      setError(err?.message || "Không tải được sản phẩm tạo đơn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const rows = useMemo(() => data?.rows || [], [data]);

  return (
    <main className="min-h-screen w-full bg-[#f7f7f7] px-4 py-4 font-sans text-neutral-950">
      <div className="space-y-4">
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="rounded-t-2xl bg-neutral-950 px-5 py-5 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Product Performance</div>
            <h1 className="mt-2 font-serif text-[34px] font-medium tracking-tight">Sản phẩm tạo đơn từ hệ thống</h1>
            <p className="mt-2 max-w-4xl text-sm text-neutral-300">
              Báo cáo đọc từ order/orderItem thật. Dùng để đối chiếu ads đang chạy theo SKU, chưa phải attribution fbclid chuẩn.
            </p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-4">
            <Kpi label="Số sản phẩm" value={compact(data?.totalProducts)} sub="Có đơn trong khoảng" />
            <Kpi label="Số đơn" value={compact(data?.totalOrders)} sub="Order thật" />
            <Kpi label="Số lượng bán" value={compact(data?.totalQuantity)} sub="Tổng quantity" />
            <Kpi label="Doanh thu" value={money(data?.totalRevenue)} sub="Theo line item" />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}

        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRange(item.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    range === item.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 xl:w-[520px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Tìm SKU / tên sản phẩm..."
                className="h-10 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none focus:border-neutral-950"
              />
              <button onClick={load} className="rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white">Tìm</button>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-neutral-950 text-[11px] uppercase tracking-[0.14em] text-white">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Đơn</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Doanh thu</th>
                  <th className="px-4 py-3 text-right">TB / đơn</th>
                  <th className="px-4 py-3">Gợi ý ads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center font-medium text-neutral-400">Đang tải...</td></tr>
                ) : rows.length ? rows.map((row, index) => (
                  <tr key={row.key || index} className="hover:bg-neutral-50">
                    <td className="px-4 py-4 font-semibold">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{row.productName}</div>
                      <div className="mt-1 text-xs text-neutral-400">{row.key}</div>
                    </td>
                    <td className="px-4 py-4 text-neutral-600">{row.sku || "—"}</td>
                    <td className="px-4 py-4 text-right font-semibold">{compact(row.orderCount)}</td>
                    <td className="px-4 py-4 text-right">{compact(row.quantity)}</td>
                    <td className="px-4 py-4 text-right font-semibold">{money(row.revenue)}</td>
                    <td className="px-4 py-4 text-right">{money(row.averageOrderValue)}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ưu tiên kiểm ads</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="p-10 text-center font-medium text-neutral-400">Không có dữ liệu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
