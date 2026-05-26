"use client";

import React, { useEffect, useState } from "react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:3001" : "")
).replace(/\/$/, "");

function money(v: unknown) {
  const n = Number(v || 0);
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(Number.isFinite(n) ? n : 0))}đ`;
}

function compact(v: unknown) {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

async function apiJson<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") || localStorage.getItem("token") || "" : "";
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

export default function MetaWarRoomPageClient() {
  const [ads, setAds] = useState<any>(null);
  const [products, setProducts] = useState<any>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [a, p] = await Promise.all([
        apiJson<any>("/meta-ads/brain-overview?range=today&summaryLevel=ad&includeProductOrders=1"),
        apiJson<any>("/meta-ads/product-performance?range=today&limit=20"),
      ]);
      setAds(a);
      setProducts(p);
    } catch (err: any) {
      setError(err?.message || "Không tải được War Room");
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  const summary = ads?.summary || {};
  const rows = ads?.topAds || [];
  const hotAds = rows.filter((r: any) => Number(r?.metrics?.spend || 0) > 0).slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f7f7f7] p-4 font-sans text-neutral-950">
      <div className="space-y-4">
        <section className="rounded-2xl bg-neutral-950 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Meta War Room</div>
              <h1 className="mt-2 font-serif text-[34px] font-medium tracking-tight">Theo dõi ads realtime</h1>
              <p className="mt-2 text-sm text-neutral-300">Tự refresh mỗi 60 giây. Dùng để xem ads tiêu tiền, sản phẩm tạo đơn và tín hiệu nóng.</p>
            </div>
            <button onClick={load} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Tải lại</button>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-neutral-400">Chi phí ads hôm nay</div><div className="mt-2 text-3xl font-semibold">{money(summary.spend)}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-neutral-400">Lượt mua Meta</div><div className="mt-2 text-3xl font-semibold">{compact(summary.purchases)}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-neutral-400">Đơn hệ thống</div><div className="mt-2 text-3xl font-semibold">{compact(products?.totalOrders)}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-neutral-400">Doanh thu hệ thống</div><div className="mt-2 text-3xl font-semibold">{money(products?.totalRevenue)}</div></div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Ads đang tiêu tiền</h2>
            <div className="mt-3 space-y-2">
              {hotAds.map((row: any, index: number) => (
                <div key={row.id} className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3">
                  {row.thumbnailUrl ? <img src={row.thumbnailUrl} className="h-12 w-12 rounded-lg object-cover" alt="" /> : null}
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{index + 1}. {row.name}</div><div className="text-xs text-neutral-500">{money(row.metrics?.spend)} · CTR {Number(row.metrics?.ctr || 0).toFixed(2)}%</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Sản phẩm tạo đơn hôm nay</h2>
            <div className="mt-3 space-y-2">
              {(products?.rows || []).slice(0, 8).map((row: any, index: number) => (
                <div key={row.key || index} className="flex items-center justify-between rounded-xl bg-emerald-50 p-3">
                  <div className="min-w-0"><div className="truncate font-semibold">{index + 1}. {row.productName}</div><div className="text-xs text-emerald-700">{row.sku || "Không có SKU"}</div></div>
                  <div className="text-right"><div className="font-semibold">{compact(row.orderCount)} đơn</div><div className="text-xs text-neutral-500">{money(row.revenue)}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
