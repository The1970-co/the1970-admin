"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, History, RefreshCw, Shirt, Store } from "lucide-react";

type BranchStock = { branchId?: string; branchName?: string; availableQty?: number; reservedQty?: number; incomingQty?: number };
type Variant = { id?: string; sku?: string; color?: string | null; size?: string | null; status?: string; price?: number; costPrice?: number; availableQty?: number; reservedQty?: number; incomingQty?: number; branches?: BranchStock[] };
type Product = { id: string; name: string; slug?: string; category?: string | null; productType?: string | null; brand?: string | null; imageUrl?: string | null; status?: string; description?: string | null; variantCount?: number; totalAvailable?: number; totalReserved?: number; totalIncoming?: number; minPrice?: number; maxPrice?: number; variants?: Variant[] };

async function api<T>(path: string): Promise<T> {
  return apiJson<T>(path, {
    redirectOnUnauthorized: true,
    timeoutMs: 30000,
  } as any);
}
function unwrapProducts(payload: any): Product[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function productMatchesRouteValue(product: Product, value: string) {
  const target = String(value || "").trim().toLowerCase();
  if (!target) return false;

  if (String(product.id || "").trim().toLowerCase() === target) return true;
  if (String(product.slug || "").trim().toLowerCase() === target) return true;

  return (product.variants || []).some((variant) =>
    [variant.id, variant.sku].some(
      (candidate) => String(candidate || "").trim().toLowerCase() === target,
    ),
  );
}

async function fetchProduct(rawId: string) {
  const id = decodeURIComponent(String(rawId || "").trim());
  if (!id) throw new Error("Thiếu mã sản phẩm");

  const directPaths = [
    `/mobile/products/${encodeURIComponent(id)}`,
    `/products/${encodeURIComponent(id)}`,
  ];

  for (const path of directPaths) {
    try {
      const product = await api<Product | null>(path);
      if (product?.id) return product;
    } catch {
      // Thử tiếp bằng API danh sách để xử lý trường hợp route truyền variantId/SKU/slug.
    }
  }

  const listPaths = [
    `/mobile/products?q=${encodeURIComponent(id)}&take=1000`,
    `/mobile/products?take=1000`,
    `/products?q=${encodeURIComponent(id)}&limit=1000`,
  ];

  for (const path of listPaths) {
    try {
      const payload = await api<any>(path);
      const found = unwrapProducts(payload).find((item) =>
        productMatchesRouteValue(item, id),
      );
      if (found) return found;
    } catch {
      // Tiếp tục thử endpoint còn lại.
    }
  }

  throw new Error("Không tìm thấy sản phẩm");
}
function money(v?:number|null){return new Intl.NumberFormat("vi-VN").format(Number(v||0))+"đ"}
function img(src?:string|null){if(!src)return"";return src.startsWith("http")?src:`${API_BASE}${src}`}
function totalStock(p:Product){if(typeof p.totalAvailable==="number")return p.totalAvailable;return(p.variants||[]).reduce((sum,v)=>sum+(typeof v.availableQty==="number"?v.availableQty:(v.branches||[]).reduce((s,b)=>s+Number(b.availableQty||0),0)),0)}
function variantStock(v?:Variant){if(!v)return 0;if(typeof v.availableQty==="number")return v.availableQty;return(v.branches||[]).reduce((s,b)=>s+Number(b.availableQty||0),0)}
function Section({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="rounded-[1.75rem] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-100">{icon}</div><h2 className="text-lg font-black">{title}</h2></div>{children}</section>}

export default function MobileProductDetailPage(){
 const params=useParams();
 const rawParam=Array.isArray(params?.id)?params.id[0]:params?.id;
 const id=decodeURIComponent(String(rawParam||"").trim());
 const [product,setProduct]=useState<Product|null>(null),[selected,setSelected]=useState("");
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{if(!id){setLoading(false);setError("Thiếu mã sản phẩm");return}try{silent?setRefreshing(true):setLoading(true);setError("");const res=await fetchProduct(id);setProduct(res);setSelected(cur=>cur||res.variants?.[0]?.id||res.variants?.[0]?.sku||"")}catch(e){setError(e instanceof Error?e.message:"Có lỗi xảy ra")}finally{setLoading(false);setRefreshing(false)}},[id]);
 useEffect(()=>{void load()},[load]);
 const variant=useMemo(()=>product?.variants?.find(v=>(v.id||v.sku)===selected)||product?.variants?.[0],[product,selected]);
 const branches=variant?.branches||[];const variantCount=product?.variantCount||product?.variants?.length||0;

 return <div className="min-h-screen bg-neutral-100 text-neutral-950"><div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
  <header className="mb-5 flex items-center justify-between"><Link href="/mobile/products" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ArrowLeft className="h-5 w-5"/></Link><div className="text-center"><div className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">Chi tiết</div><div className="max-w-[220px] truncate text-lg font-black">{product?.name||"Sản phẩm"}</div></div><button type="button" onClick={()=>void load(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={`h-5 w-5 ${refreshing?"animate-spin":""}`}/></button></header>
  {loading?<div className="space-y-4">{Array.from({length:6}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-[1.75rem] bg-white"/>)}</div>:error?<div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>:product?<div className="space-y-4">
   <section className="overflow-hidden rounded-[2rem] bg-neutral-950 text-white shadow-xl shadow-neutral-300"><div className="aspect-square bg-neutral-900">{img(product.imageUrl)?<img src={img(product.imageUrl)} alt={product.name} className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-white/35">No image</div>}</div><div className="p-6"><div className="text-sm text-white/45">{product.category||product.productType||product.brand||"The 1970"}</div><h1 className="mt-2 text-2xl font-black leading-tight">{product.name}</h1><div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/45">Tồn</div><div className="mt-1 text-2xl font-black">{totalStock(product)}</div></div><div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/45">Mẫu</div><div className="mt-1 text-2xl font-black">{variantCount}</div></div><div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/45">Giá</div><div className="mt-1 text-sm font-black">{money(variant?.price||product.minPrice)}</div></div></div></div></section>
   <Section title="Biến thể" icon={<Shirt className="h-5 w-5"/>}><div className="flex gap-2 overflow-x-auto pb-1">{(product.variants||[]).map(v=>{const key=v.id||v.sku||"";const active=key===(variant?.id||variant?.sku);return <button key={key} type="button" onClick={()=>setSelected(key)} className={`shrink-0 rounded-2xl border px-4 py-3 text-left ${active?"border-neutral-950 bg-neutral-950 text-white":"border-neutral-200 bg-neutral-50 text-neutral-700"}`}><div className="text-sm font-black">{v.color||"Màu"} / {v.size||"Size"}</div><div className="mt-1 text-xs opacity-70">{v.sku||"—"}</div></button>})}</div></Section>
   <Section title="Tồn theo chi nhánh" icon={<Store className="h-5 w-5"/>}>{branches.length===0?<div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có dữ liệu tồn theo chi nhánh cho biến thể này.</div>:<div className="space-y-3">{branches.map((b,i)=><div key={`${b.branchId}-${i}`} className="flex items-center justify-between rounded-2xl bg-neutral-50 p-4"><div><div className="font-black">{b.branchName||b.branchId||"Chi nhánh"}</div><div className="mt-1 text-xs text-neutral-500">Giữ {b.reservedQty||0} · Sắp về {b.incomingQty||0}</div></div><div className={`text-2xl font-black ${Number(b.availableQty||0)<=0?"text-rose-700":Number(b.availableQty||0)<=3?"text-amber-700":"text-neutral-950"}`}>{b.availableQty||0}</div></div>)}</div>}</Section>
   <Section title="Thông tin nhanh" icon={<Boxes className="h-5 w-5"/>}><div className="divide-y divide-neutral-100">{[["SKU",variant?.sku||"—"],["Trạng thái",product.status||variant?.status||"—"],["Giá bán",money(variant?.price)],["Giá nhập",money(variant?.costPrice)],["Tồn biến thể",String(variantStock(variant))],["Đang giữ",String(variant?.reservedQty||0)],["Sắp về",String(variant?.incomingQty||0)]].map(([l,v])=><div key={l} className="flex justify-between gap-3 py-3 text-sm"><span className="text-neutral-500">{l}</span><span className="text-right font-black">{v}</span></div>)}</div></Section>
   <Section title="Lịch sử kho" icon={<History className="h-5 w-5"/>}><div className="rounded-2xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-500">Bước tiếp theo nối endpoint lịch sử kho theo variantId để xem nhập, bán, huỷ, trả hàng, điều chuyển ngay trong app.</div></Section>
  </div>:null}
  <MobileBottomNav/>
 </div></div>
}
