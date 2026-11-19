"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type Product = { productId: string | null; name: string; quantity: number; pos: number; facebook: number; other: number; revenue: number; orderCount: number };
type Snapshot = { day: string; time: string; productCount: number; orderCount: number; quantity: number; revenue: number; products: Product[] };
type Response = {title: string; snapshot: Snapshot};
const money=(n:number)=>new Intl.NumberFormat("vi-VN").format(Math.round(Number(n)||0));
function MobileProductReportContent(){
  const router=useRouter();
  const params=useSearchParams();
  const requestedDay=String(params.get("day")||"");
  const day=/^\d{4}-\d{2}-\d{2}$/.test(requestedDay)?requestedDay:"";
  const [data,setData]=useState<Response|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {setData(await apiJson<Response>(`/business-reports/products/preview${day?`?day=${encodeURIComponent(day)}`:""}`));}
    catch(e:any){setError(e?.message||"Không tải được báo cáo");}
    finally{setLoading(false);}
  },[day]);
  useEffect(()=>{void load()},[load]);
  const s=data?.snapshot;
  return <div className="min-h-screen bg-neutral-50 pb-28 text-neutral-950">
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-3">
      <button onClick={()=>router.back()} className="rounded-xl border px-3 py-2 text-sm">← Quay lại</button>
      <div className="text-center"><h1 className="text-base font-bold">Báo cáo sản phẩm tạo đơn</h1><div className="text-xs text-neutral-500">{s?.day||day||"Hôm nay"}</div></div>
      <button onClick={()=>void load()} className="rounded-xl border px-3 py-2 text-sm" disabled={loading}>Tải lại</button>
    </header>
    <main className="mx-auto max-w-3xl p-4">
      {loading&&<p className="py-6 text-center text-sm text-neutral-500">Đang tải báo cáo...</p>}
      {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={()=>void load()} className="ml-2 underline">Thử lại</button></div>}
      {s&&<>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-neutral-500">Tạo đơn ngày {s.day} · cập nhật {s.time}</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-neutral-500">Sản phẩm</div><div className="text-xl font-bold">{money(s.productCount)}</div></div>
            <div><div className="text-neutral-500">Đơn tạo</div><div className="text-xl font-bold">{money(s.orderCount)}</div></div>
            <div><div className="text-neutral-500">Số lượng</div><div className="text-xl font-bold">{money(s.quantity)} cái</div></div>
            <div><div className="text-neutral-500">Doanh thu</div><div className="text-xl font-bold">{money(s.revenue)}đ</div></div>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold">Top 20 sản phẩm theo số lượng</p>
        <div className="mt-2 space-y-2">{s.products.slice(0,20).map((p,i)=><div key={p.productId||`${p.name}-${i}`} className="rounded-xl border bg-white p-3">
          <div className="flex gap-2"><span className="w-7 shrink-0 text-sm font-bold text-neutral-500">{i+1}.</span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{p.name}</h2><div className="mt-2 text-sm"><b>{money(p.quantity)} cái</b> · POS {money(p.pos)} · FB/COD {money(p.facebook)}{p.other?` · Khác ${money(p.other)}`:""}</div><div className="mt-1 text-sm font-medium text-emerald-700">{money(p.revenue)}đ</div></div></div>
        </div>)}</div>
        {s.products.length>20&&<details className="mt-3 rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Xem thêm {s.products.length-20} sản phẩm</summary><div className="mt-3 space-y-3">{s.products.slice(20).map((p,i)=><div key={p.productId||`${p.name}-${i}`} className="border-t pt-3 text-sm"><strong>{i+21}. {p.name}</strong><p>{p.quantity} cái · POS {p.pos} · FB/COD {p.facebook}{p.other?` · Khác ${p.other}`:""} · {money(p.revenue)}đ</p></div>)}</div></details>}
        {!s.products.length&&<p className="mt-4 text-sm text-neutral-500">Chưa có sản phẩm tạo đơn trong ngày này.</p>}
      </>}
    </main>
    <MobileBottomNav />
  </div>;
}


// Next.js 16: useSearchParams must render beneath a Suspense boundary.
export default function MobileProductReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 p-6 text-center text-sm text-neutral-500">Đang tải báo cáo sản phẩm...</div>}>
      <MobileProductReportContent />
    </Suspense>
  );
}
