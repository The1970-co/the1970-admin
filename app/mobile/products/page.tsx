"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, ChevronRight, Grid2X2, List, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

type Branch = { id: string; name: string };
type BranchStock = { branchId?: string; branchName?: string; availableQty?: number; reservedQty?: number; incomingQty?: number };
type Variant = { id?: string; sku?: string; color?: string | null; size?: string | null; status?: string; price?: number; costPrice?: number; availableQty?: number; reservedQty?: number; incomingQty?: number; branches?: BranchStock[] };
type Product = { id: string; name: string; slug?: string; category?: string | null; productType?: string | null; brand?: string | null; imageUrl?: string | null; status?: string; variantCount?: number; totalAvailable?: number; totalReserved?: number; totalIncoming?: number; minPrice?: number; maxPrice?: number; variants?: Variant[] };

function getToken(){return typeof window==="undefined"?"":localStorage.getItem("token")||""}
async function api<T>(path: string): Promise<T> {
  return apiJson<T>(path, {
    redirectOnUnauthorized: true,
    timeoutMs: 30000,
  } as any);
}
async function optional<T>(path:string,fallback:T){try{return await api<T>(path)}catch{return fallback}}
function money(v?:number|null){return new Intl.NumberFormat("vi-VN").format(Number(v||0))+"đ"}
function norm(v:unknown){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function img(src?:string|null){if(!src)return"";return src.startsWith("http")?src:`${API_BASE}${src}`}
function totalStock(p:Product){if(typeof p.totalAvailable==="number")return p.totalAvailable;return(p.variants||[]).reduce((sum,v)=>sum+(typeof v.availableQty==="number"?v.availableQty:(v.branches||[]).reduce((s,b)=>s+Number(b.availableQty||0),0)),0)}
function minPrice(p:Product){if(typeof p.minPrice==="number")return p.minPrice;const prices=(p.variants||[]).map(v=>Number(v.price||0)).filter(Boolean);return prices.length?Math.min(...prices):0}
function statusLabel(s?:string){return({ACTIVE:"Đang bán",INACTIVE:"Tạm ẩn",DRAFT:"Nháp"} as Record<string,string>)[String(s||"")]||s||"—"}

function ProductImage({product,large=false}:{product:Product;large?:boolean}){const src=img(product.imageUrl);return <div className={`${large?"aspect-square w-full":"h-24 w-24"} shrink-0 overflow-hidden rounded-[1.5rem] bg-neutral-100`}>{src?<img src={src} alt={product.name} className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">No image</div>}</div>}

export default function MobileProductsPage(){
 const [branches,setBranches]=useState<Branch[]>([]),[products,setProducts]=useState<Product[]>([]);
 const [branchId,setBranchId]=useState("all"),[status,setStatus]=useState("all"),[query,setQuery]=useState(""),[searchText,setSearchText]=useState("");
 const [mode,setMode]=useState<"list"|"grid">("list"),[stockFilter,setStockFilter]=useState<"all"|"low"|"out">("all");
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState("");

 const load=useCallback(async(silent=false)=>{try{silent?setRefreshing(true):setLoading(true);setError("");const params=new URLSearchParams();params.set("branchId",branchId);params.set("status",status);params.set("take","180");if(query.trim())params.set("q",query.trim());const [b,p]=await Promise.all([optional<Branch[]>("/mobile/branches",[]),api<Product[]>(`/mobile/products?${params.toString()}`)]);setBranches(b);setProducts(Array.isArray(p)?p:[])}catch(e){setError(e instanceof Error?e.message:"Có lỗi xảy ra")}finally{setLoading(false);setRefreshing(false)}},[branchId,status,query]);
 useEffect(()=>{void load()},[load]);

 const filtered=useMemo(()=>{const q=norm(query);return products.filter(p=>{const stock=totalStock(p);if(stockFilter==="out"&&stock>0)return false;if(stockFilter==="low"&&(stock<=0||stock>3))return false;if(!q)return true;const variants=(p.variants||[]).map(v=>[v.sku,v.color,v.size].filter(Boolean).join(" ")).join(" ");return norm([p.name,p.category,p.productType,p.brand,variants].join(" ")).includes(q)})},[products,query,stockFilter]);
 const summary=useMemo(()=>{const variants=products.reduce((s,p)=>s+Number(p.variantCount||p.variants?.length||0),0);const stock=products.reduce((s,p)=>s+totalStock(p),0);const out=products.filter(p=>totalStock(p)<=0).length;const low=products.filter(p=>{const st=totalStock(p);return st>0&&st<=3}).length;return{total:products.length,variants,stock,out,low}},[products]);

 return <div className="min-h-screen bg-neutral-100 text-neutral-950"><div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
  <header className="mb-5 flex items-center justify-between"><Link href="/mobile" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ArrowLeft className="h-5 w-5"/></Link><div className="text-center"><div className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">Catalog</div><div className="text-lg font-black">Sản phẩm</div></div><button type="button" onClick={()=>void load(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={`h-5 w-5 ${refreshing?"animate-spin":""}`}/></button></header>
  <div className="mb-4 rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl shadow-neutral-300"><div className="flex items-start justify-between"><div><div className="text-sm text-white/50">Tổng catalog</div><div className="mt-2 text-5xl font-black">{summary.total}</div></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950"><Boxes className="h-6 w-6"/></div></div><div className="mt-6 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/45">Biến thể</div><div className="mt-1 text-xl font-black">{summary.variants}</div></div><button type="button" onClick={()=>setStockFilter(stockFilter==="low"?"all":"low")} className={`rounded-2xl p-3 text-left ${stockFilter==="low"?"bg-amber-400 text-neutral-950":"bg-white/10"}`}><div className="text-xs opacity-70">Sắp hết</div><div className="mt-1 text-xl font-black">{summary.low}</div></button><button type="button" onClick={()=>setStockFilter(stockFilter==="out"?"all":"out")} className={`rounded-2xl p-3 text-left ${stockFilter==="out"?"bg-rose-400 text-white":"bg-white/10"}`}><div className="text-xs opacity-70">Hết hàng</div><div className="mt-1 text-xl font-black">{summary.out}</div></button></div></div>

  <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-neutral-200 bg-neutral-100/95 px-4 py-3 backdrop-blur">
   <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm"><Search className="h-4 w-4 text-neutral-400"/><input value={searchText} onChange={e=>setSearchText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")setQuery(searchText)}} placeholder="Tên, SKU, màu, size..." className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"/><button type="button" onClick={()=>setQuery(searchText)} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-bold text-white">Tìm</button><button type="button" onClick={()=>setMode(mode==="list"?"grid":"list")} className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">{mode==="list"?<Grid2X2 className="h-4 w-4"/>:<List className="h-4 w-4"/>}</button></div>
   <div className="mt-3 grid grid-cols-2 gap-2"><select value={branchId} onChange={e=>setBranchId(e.target.value)} className="h-10 rounded-2xl border border-neutral-200 bg-white px-3 text-xs font-bold outline-none"><option value="all">Tất cả chi nhánh</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)} className="h-10 rounded-2xl border border-neutral-200 bg-white px-3 text-xs font-bold outline-none"><option value="all">Tất cả trạng thái</option><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Tạm ẩn</option><option value="DRAFT">Nháp</option></select></div>
   <div className="mt-3 flex items-center gap-2 text-xs">{[{key:"all",label:"Tất cả"},{key:"low",label:"Sắp hết"},{key:"out",label:"Hết hàng"}].map(i=><button key={i.key} type="button" onClick={()=>setStockFilter(i.key as any)} className={`rounded-full px-3 py-2 font-bold ${stockFilter===i.key?"bg-neutral-950 text-white":"bg-white text-neutral-600"}`}>{i.label}</button>)}<div className="ml-auto flex items-center gap-1 text-neutral-400"><SlidersHorizontal className="h-3.5 w-3.5"/>{filtered.length}</div></div>
  </div>

  {loading?<div className="space-y-3">{Array.from({length:8}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-[1.75rem] bg-white"/>)}</div>:error?<div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>:filtered.length===0?<div className="rounded-[1.75rem] bg-white p-8 text-center text-sm text-neutral-500 shadow-sm">Không có sản phẩm phù hợp.</div>:mode==="grid"?<div className="grid grid-cols-2 gap-3">{filtered.map(p=><Link key={p.id} href={`/mobile/products/${p.id}`} className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm active:scale-[0.98] transition"><ProductImage product={p} large/><div className="p-3"><div className="line-clamp-2 text-sm font-black">{p.name}</div><div className="mt-2 text-xs text-neutral-500">{money(minPrice(p))}</div><div className="mt-2 rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold">Tồn {totalStock(p)}</div></div></Link>)}</div>:<div className="space-y-3">{filtered.map(p=>{const stock=totalStock(p);return <Link key={p.id} href={`/mobile/products/${p.id}`} className="flex gap-4 rounded-[1.75rem] bg-white p-4 shadow-sm active:scale-[0.99] transition"><ProductImage product={p}/><div className="min-w-0 flex-1"><div className="line-clamp-2 text-base font-black">{p.name}</div><div className="mt-1 text-xs text-neutral-500">{p.category||p.productType||p.brand||"The 1970"}</div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold">{p.variantCount||p.variants?.length||0} mẫu</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stock<=0?"bg-rose-50 text-rose-700":stock<=3?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}>Tồn {stock}</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold">{money(minPrice(p))}</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold">{statusLabel(p.status)}</span></div></div><ChevronRight className="mt-9 h-5 w-5 text-neutral-300"/></Link>})}</div>}
  <MobileBottomNav/>
 </div></div>
}
