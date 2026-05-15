"use client";

import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Boxes, RefreshCw, Truck } from "lucide-react";

type HomeResponse = {
  summary?: { revenueToday?: number; ordersToday?: number };
  orders?: Record<string, number>;
  inventory?: { lowStockCount?: number; outOfStockCount?: number };
  topProducts?: Array<{ productName?: string; qty?: number; revenue?: number }>;
  alerts?: string[];
  finance?: { codPending?: number; codReceivedToday?: number };
};

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token = getToken();
  if (!token) {
    window.location.href = "/mobile/login";
    throw new Error("Thiếu token đăng nhập.");
  }
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/mobile/login";
    throw new Error("Phiên đăng nhập hết hạn.");
  }
  if (!res.ok) throw new Error((await res.text()) || "Không tải được báo cáo.");
  return res.json();
}

function money(v?: number) {
  const n = Number(v || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return new Intl.NumberFormat("vi-VN").format(n);
}

function num(v?: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(v || 0));
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="rounded-[1.75rem] bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</section>;
}

export default function MobileReportOverviewPage() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(silent = false) {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      setError("");
      setData(await fetchWithAuth<HomeResponse>("/mobile/home?branchId=all"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const orderBlocks = useMemo(() => {
    const o = data?.orders || {};
    return [
      ["Mới", o.NEW || 0, "NEW"],
      ["Đã duyệt", o.APPROVED || 0, "APPROVED"],
      ["Đóng gói", o.PACKING || 0, "PACKING"],
      ["Đang giao", o.SHIPPED || 0, "SHIPPED"],
    ] as const;
  }, [data]);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/mobile" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Báo cáo</div><div className="text-lg font-bold">Tổng quan vận hành</div></div>
          <button type="button" onClick={() => void load(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} /></button>
        </header>
        {loading ? <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-[1.75rem] bg-white" />)}</div> : error ? <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : <div className="space-y-4">
          <div className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl shadow-neutral-300">
            <div className="text-sm text-white/55">Hôm nay · Tất cả chi nhánh</div><div className="mt-3 text-4xl font-black tracking-tight">{money(data?.summary?.revenueToday)}</div><div className="mt-2 text-sm text-white/60">Doanh thu ghi nhận</div>
            <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-white/50">Số đơn</div><div className="mt-2 text-2xl font-bold">{num(data?.summary?.ordersToday)}</div></div><div className="rounded-2xl bg-white/10 p-4"><div className="text-xs text-white/50">COD pending</div><div className="mt-2 text-2xl font-bold">{money(data?.finance?.codPending)}</div></div></div>
          </div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-[1.75rem] bg-white p-5 shadow-sm"><AlertTriangle className="h-5 w-5 text-amber-600" /><div className="mt-4 text-3xl font-black">{num(data?.inventory?.lowStockCount)}</div><div className="mt-1 text-sm text-neutral-500">SKU sắp hết</div></div><div className="rounded-[1.75rem] bg-white p-5 shadow-sm"><Boxes className="h-5 w-5 text-rose-700" /><div className="mt-4 text-3xl font-black">{num(data?.inventory?.outOfStockCount)}</div><div className="mt-1 text-sm text-neutral-500">SKU hết hàng</div></div></div>
          <Section title="Đơn hàng chờ xử lý"><div className="grid grid-cols-2 gap-3">{orderBlocks.map(([label, value, status]) => <Link key={status} href={`/mobile/orders?status=${status}`} className="rounded-2xl bg-neutral-50 p-4"><div className="text-sm text-neutral-500">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></Link>)}</div></Section>
          <Section title="Top sản phẩm"><div className="space-y-3">{(data?.topProducts || []).length === 0 ? <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có dữ liệu sản phẩm bán chạy.</div> : (data?.topProducts || []).slice(0, 5).map((p, i) => <div key={`${p.productName}-${i}`} className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white font-bold">{i + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{p.productName || "Sản phẩm"}</div><div className="mt-1 text-xs text-neutral-500">{num(p.qty)} sản phẩm</div></div><div className="text-sm font-bold">{money(p.revenue)}</div></div>)}</div></Section>
          <Section id="alerts" title="Cảnh báo nổi bật"><div className="space-y-2">{(data?.alerts || []).length === 0 ? <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Không có cảnh báo mới.</div> : (data?.alerts || []).map((a, i) => <div key={`${a}-${i}`} className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{a}</div>)}</div></Section>
          <Link href="/mobile/orders" className="flex items-center justify-between rounded-[1.75rem] bg-white p-5 font-bold shadow-sm"><span className="flex items-center gap-3"><Truck className="h-5 w-5" />Mở danh sách đơn hàng</span></Link>
        </div>}
        <MobileBottomNav />
      </div>
    </div>
  );
}
