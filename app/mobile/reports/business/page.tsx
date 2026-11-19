"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type Snapshot = {
  day: string; time: string; orders: number; pos: number; cod: number;
  createdRevenue: number; posRevenue: number; codRevenue: number;
  successRevenue: number; actualProfit: number; estimatedProfit: number;
  ads: number; operating: number;
};
type Preview = { title: string; body: string; snapshot: Snapshot };
type Delivery = { id: string; key: string; kind: string; title: string; body: string; status: string; createdAt: string; sent?: number; failed?: number };
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(Number(n) || 0));
const money = (n: number) => `${fmt(n)}đ`;
const dateValid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const timeValid = (s: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
const vnToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function BusinessReportContent() {
  const router = useRouter();
  const params = useSearchParams();
  const queryDay = String(params.get("day") || "");
  const day = dateValid(queryDay) ? queryDay : "";
  const querySlot = String(params.get("slot") || "");
  const slot = timeValid(querySlot) ? querySlot : "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [p, h] = await Promise.all([
        apiJson<Preview>("/business-reports/preview"),
        apiJson<Delivery[]>("/business-reports/history"),
      ]);
      setPreview(p);
      setHistory(Array.isArray(h) ? h : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được báo cáo kinh doanh");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const reportHistory = useMemo(() => history.filter(row => row.kind === "daily" && row.key?.startsWith("daily:")), [history]);
  const relevantHistory = useMemo(() => day
    ? reportHistory.filter(row => row.key?.includes(`:${day}:`))
    : reportHistory, [day, reportHistory]);
  const selected = useMemo(() => {
    if (selectedKey) return relevantHistory.find(row => row.key === selectedKey) || null;
    if (slot) return relevantHistory.find(row => row.key?.endsWith(`:${slot}`)) || null;
    return relevantHistory[0] || null;
  }, [relevantHistory, selectedKey, slot]);
  const s = preview?.snapshot;
  const isCurrentDay = !!s && (!day || day === s.day);
  const derivedSuccessCost = s ? s.successRevenue - s.ads - s.operating - s.actualProfit : 0;
  const derivedCreatedCost = s ? s.posRevenue + s.codRevenue - s.ads - s.operating - s.estimatedProfit : 0;
  const totalChannelRevenue = s ? s.posRevenue + s.codRevenue : 0;

  return <div className="min-h-screen bg-neutral-50 pb-28 text-neutral-950">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-white px-3 py-3">
      <button type="button" onClick={() => router.back()} className="rounded-xl border px-3 py-2 text-sm">← Quay lại</button>
      <div className="min-w-0 text-center"><h1 className="text-base font-bold">Báo cáo kinh doanh</h1><p className="text-xs text-neutral-500">{day || s?.day || "Hôm nay"} · THE 1970</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50">Tải lại</button>
    </header>
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      {loading && <p className="py-3 text-center text-sm text-neutral-500">Đang tải báo cáo...</p>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button className="underline" onClick={() => void load()}>Thử lại</button></div>}

      {selected && <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Nội dung tại thời điểm gửi</h2><span className="text-xs text-neutral-500">{new Date(selected.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span></div>
        <p className="mt-1 text-xs text-neutral-500">{selected.title} · {selected.status}</p>
        <div className="mt-3 divide-y rounded-xl border">{selected.body.split(" · ").filter(Boolean).map((part, index) => <div key={index} className="px-3 py-2.5 text-sm">{part}</div>)}</div>
        <p className="mt-2 text-xs text-neutral-500">Đây là nội dung lưu lúc gửi; không thay đổi khi có đơn mới.</p>
      </section>}

      {isCurrentDay && s && <>
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Bảng số liệu mới nhất</h2><span className="text-xs text-neutral-500">{s.time} · {s.day}</span></div>
          <p className="mt-1 text-xs text-neutral-500">Dữ liệu cập nhật khi mở/tải lại trang, có thể khác thời điểm thông báo.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-neutral-100 p-3"><p className="text-xs text-neutral-500">Đơn tạo</p><p className="mt-1 text-xl font-bold">{fmt(s.orders)}</p></div>
            <div className="rounded-xl bg-neutral-100 p-3"><p className="text-xs text-neutral-500">Doanh thu tạo đơn</p><p className="mt-1 text-lg font-bold">{money(s.createdRevenue)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Doanh thu thành công</p><p className="mt-1 text-lg font-bold text-emerald-900">{money(s.successRevenue)}</p></div>
            <div className="rounded-xl bg-neutral-100 p-3"><p className="text-xs text-neutral-500">Chi phí Ads</p><p className="mt-1 text-lg font-bold">{money(s.ads)}</p></div>
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white"><h2 className="border-b p-4 font-bold">Chi tiết theo kênh tạo đơn</h2>
          <div className="overflow-x-auto"><table className="w-full min-w-[330px] text-sm"><thead className="bg-neutral-100 text-left"><tr><th className="px-4 py-3">Nguồn</th><th className="px-3 py-3 text-right">Số đơn</th><th className="px-4 py-3 text-right">Doanh thu</th></tr></thead><tbody className="divide-y">
            <tr><td className="px-4 py-3">POS</td><td className="px-3 py-3 text-right">{fmt(s.pos)}</td><td className="px-4 py-3 text-right">{money(s.posRevenue)}</td></tr>
            <tr><td className="px-4 py-3">Facebook/COD</td><td className="px-3 py-3 text-right">{fmt(s.cod)}</td><td className="px-4 py-3 text-right">{money(s.codRevenue)}</td></tr>
            {(s.orders > s.pos + s.cod || s.createdRevenue > totalChannelRevenue + 0.5) && <tr><td className="px-4 py-3">Nguồn khác</td><td className="px-3 py-3 text-right">{fmt(Math.max(0, s.orders - s.pos - s.cod))}</td><td className="px-4 py-3 text-right">{money(s.createdRevenue - totalChannelRevenue)}</td></tr>}
            <tr className="font-semibold"><td className="px-4 py-3">Tổng</td><td className="px-3 py-3 text-right">{fmt(s.orders)}</td><td className="px-4 py-3 text-right">{money(s.createdRevenue)}</td></tr>
          </tbody></table></div>
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white"><h2 className="border-b p-4 font-bold">Doanh thu, chi phí & lợi nhuận</h2>
          <div className="divide-y text-sm">{([
            ["Doanh thu giao thành công", money(s.successRevenue)],
            ["Giá vốn hàng giao thành công", money(derivedSuccessCost)],
            ["Chi phí quảng cáo", money(s.ads)],
            ["Chi phí vận hành", money(s.operating)],
            ["Lợi nhuận thực tế", money(s.actualProfit)],
            ["Doanh thu POS + FB/COD", money(totalChannelRevenue)],
            ["Giá vốn ước tính đơn tạo", money(derivedCreatedCost)],
            ["Lợi nhuận ước tính", money(s.estimatedProfit)],
          ] as [string,string][]).map(([label,value]) => <div key={label} className="flex justify-between gap-4 px-4 py-3"><span className="text-neutral-600">{label}</span><strong className="shrink-0 text-right tabular-nums">{value}</strong></div>)}</div>
          <p className="px-4 pb-4 text-xs text-neutral-500">Giá vốn trong bảng được suy ra từ các thành phần của công thức lợi nhuận Backend hiện tại.</p>
        </section>
      </>}
      {!loading && !isCurrentDay && !selected && <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600">Không còn bản ghi báo cáo của ngày {day} trong 50 thông báo gần nhất. Số liệu trực tiếp chỉ hỗ trợ ngày hiện tại.</div>}
      {relevantHistory.length > 0 && <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">Các mốc báo cáo đã gửi</h2><div className="mt-3 space-y-2">{relevantHistory.map(row => <button type="button" onClick={() => setSelectedKey(row.key)} key={row.key} className={`w-full rounded-xl border p-3 text-left text-sm ${selected?.key === row.key ? "border-neutral-900 bg-neutral-100" : "bg-white"}`}><span className="font-medium">{row.title}</span><span className="mt-1 block text-xs text-neutral-500">{new Date(row.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {row.status}</span></button>)}</div></section>}
      <button type="button" onClick={() => router.push("/mobile/reports/overview")} className="w-full rounded-xl border bg-white p-3 text-sm font-semibold">Mở Tổng quan doanh thu</button>
    </main>
    <MobileBottomNav />
  </div>;
}

export default function Page() {
  return <Suspense fallback={<div className="p-6 text-sm">Đang mở báo cáo kinh doanh...</div>}><BusinessReportContent /></Suspense>;
}
