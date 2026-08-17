"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import {
  ArrowLeft,
  CheckCircle2,
  Factory,
  PackageCheck,
  RefreshCw,
  Shirt,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProductionStatus =
  | "DRAFT" | "PLANNING" | "READY" | "SENT" | "CUTTING"
  | "SEWING" | "QC" | "COMPLETED" | "CANCELLED";

type ProductionOrder = {
  id: string;
  code: string;
  status: ProductionStatus;
  updatedAt?: string | null;
  designSampleId?: string | null;
  sample?: { id?: string; code?: string; name?: string; coverImageUrl?: string | null } | null;
  source?: { type?: string; id?: string; code?: string; name?: string; imageUrl?: string | null } | null;
  factory?: { id?: string; code?: string; name?: string } | null;
};

const STEPS: Array<{ status: ProductionStatus; label: string }> = [
  { status: "READY", label: "Chờ cắt" },
  { status: "SENT", label: "Đã giao nhà may" },
  { status: "CUTTING", label: "Bắt đầu cắt" },
  { status: "SEWING", label: "Đang may" },
  { status: "QC", label: "QC / hoàn thiện" },
  { status: "COMPLETED", label: "Đã SX xong" },
];

const LABEL: Record<string,string> = {
  DRAFT:"Chưa triển khai", PLANNING:"Chuẩn bị SX", READY:"Chờ cắt",
  SENT:"Đã giao nhà may", CUTTING:"Đang cắt", SEWING:"Đang may",
  QC:"QC / hoàn thiện", COMPLETED:"Đã SX xong", CANCELLED:"Đã huỷ",
};

async function api<T=any>(path:string, init:RequestInit={}) {
  return apiJson<T>(path,{...init,redirectOnUnauthorized:false} as any);
}
function asset(url?:string|null) {
  if(!url) return "";
  return /^https?:\/\//.test(url) ? url : `${API_BASE}${url.startsWith("/")?"":"/"}${url}`;
}

function viNumber(value:any){
  const raw=String(value??"").trim().replace(/\s/g,"").replace(",",".");
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}
function viDisplay(value:any,maximumFractionDigits=4){
  if(value===null||value===undefined||value==="") return "";
  const n=viNumber(value);
  if(n===null) return String(value);
  return n.toLocaleString("vi-VN",{maximumFractionDigits,useGrouping:false});
}
function withUnit(value:any,unit:string,maximumFractionDigits=4){
  const displayed=viDisplay(value,maximumFractionDigits);
  return displayed?`${displayed} ${unit}`:"—";
}
function dt(v?:string|null) {
  if(!v) return "";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?"":d.toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function statusClass(s:string) {
  if(s==="COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if(["CUTTING","SEWING"].includes(s)) return "border-blue-200 bg-blue-50 text-blue-700";
  if(["READY","SENT","QC"].includes(s)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

export default function MobileProductionOrdersPage(){
  const [rows,setRows]=useState<ProductionOrder[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [detail,setDetail]=useState<any>(null);
  const [detailLoading,setDetailLoading]=useState(false);

  async function load(){
    try{setLoading(true);setError("");setRows(await api<ProductionOrder[]>("/production/orders"))}
    catch(e){setError(e instanceof Error?e.message:"Không tải được lệnh sản xuất.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  const doing=useMemo(()=>rows.filter(x=>["CUTTING","SEWING","QC"].includes(x.status)).length,[rows]);
  const done=useMemo(()=>rows.filter(x=>x.status==="COMPLETED").length,[rows]);

  async function openDetail(row:ProductionOrder){
    try{
      setDetailLoading(true);setError("");
      const d=await api<any>(`/production/orders/${row.id}`);
      setDetail(d);
    }catch(e){setError(e instanceof Error?e.message:"Không mở được lệnh sản xuất.")}
    finally{setDetailLoading(false)}
  }

  async function setStatus(row:ProductionOrder,status:ProductionStatus){
    const key=`${row.id}:${status}`;
    try{
      setBusy(key);setError("");
      await api(`/production/orders/${row.id}`,{method:"PATCH",body:JSON.stringify({status})});
      setRows(cur=>cur.map(x=>x.id===row.id?{...x,status,updatedAt:new Date().toISOString()}:x));
      if(detail?.id===row.id) setDetail((x:any)=>({...x,status,updatedAt:new Date().toISOString()}));
    }catch(e){setError(e instanceof Error?e.message:"Không cập nhật được trạng thái.")}
    finally{setBusy("")}
  }

  return <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(112px+env(safe-area-inset-bottom))] text-neutral-950">
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[calc(16px+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mobile/production" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link>
            <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Sản xuất</div><h1 className="text-xl font-black">Lệnh sản xuất</h1></div>
          </div>
          <button onClick={()=>void load()} disabled={loading||!!busy} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {error&&<div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Tổng lệnh" value={rows.length}/><Stat label="Đang làm" value={doing}/><Stat label="Đã xong" value={done}/>
        </div>

        {loading?<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">Đang tải...</div>:rows.map(row=>{
          const image=asset(row.source?.imageUrl||row.sample?.coverImageUrl);
          return <article key={row.id} onClick={()=>void openDetail(row)} className="cursor-pointer overflow-hidden rounded-[28px] bg-white shadow-sm active:scale-[.995]">
            <div className="flex gap-3 p-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                {image?<img src={image} className="h-full w-full object-cover" alt=""/>:<div className="grid h-full place-items-center"><Shirt className="h-7 w-7 text-neutral-300"/></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-neutral-400">{row.code}</div>
                <div className="mt-1 text-base font-black">{row.source?.code||row.sample?.code||"—"} · {row.source?.name||row.sample?.name||"Chưa có tên"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(row.status)}`}>{LABEL[row.status]||row.status}</span>
                  <span className="text-[10px] font-bold text-neutral-400">{row.factory?.name||"Chưa chọn nhà may"}</span>
                </div>
              </div>
              {row.status==="COMPLETED"?<PackageCheck className="h-6 w-6 text-emerald-500"/>:<Factory className="h-6 w-6 text-neutral-300"/>}
            </div>
            <div className="flex gap-2 overflow-x-auto border-t px-4 py-3" onClick={e=>e.stopPropagation()}>
              {STEPS.map(s=><button key={s.status} disabled={!!busy||row.status===s.status} onClick={()=>void setStatus(row,s.status)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${row.status===s.status?"border-neutral-950 bg-neutral-950 text-white":"border-neutral-200 bg-white text-neutral-600"} disabled:opacity-50`}>{busy===`${row.id}:${s.status}`?"Đang lưu...":s.label}</button>)}
            </div>
            {row.updatedAt&&<div className="px-4 pb-3 text-[10px] text-neutral-400">Cập nhật {dt(row.updatedAt)}</div>}
          </article>
        })}
        {!loading&&!rows.length&&<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">Chưa có lệnh sản xuất.</div>}
      </div>
    </div>

    {(detail||detailLoading)&&<DetailModal detail={detail} loading={detailLoading} onClose={()=>setDetail(null)}/>}
    <MobileBottomNav/>
  </main>
}

function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-white p-3"><div className="text-[10px] font-bold text-neutral-400">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>}

function DetailModal({detail,loading,onClose}:{detail:any;loading:boolean;onClose:()=>void}){
  if(loading&&!detail) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="rounded-3xl bg-white p-8 font-bold">Đang tải lệnh...</div></div>;
  if(!detail) return null;
  const image=asset(detail.source?.imageUrl||detail.sample?.coverImageUrl);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3">
    <div className="mx-auto my-4 max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b p-4"><div><div className="text-xs font-black text-neutral-400">{detail.code}</div><div className="font-black">{detail.source?.code||detail.sample?.code} · {detail.source?.name||detail.sample?.name}</div></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button></div>
      <div className="space-y-4 p-4">
        {image&&<img src={image} alt="" className="h-56 w-full rounded-3xl object-cover"/>}
        <div className="grid grid-cols-2 gap-3">
          <Info l="Trạng thái" v={LABEL[detail.status]||detail.status}/>
          <Info l="Nhà may" v={detail.factory?.name||"—"}/>
          <Info l="Định mức vải" v={withUnit(detail.fabricConsumptionM,"m/sp",4)}/>
          <Info l="Khổ vải" v={withUnit(detail.fabricWidthCm,"cm",2)}/>
          <Info l="Hao hụt vải" v={withUnit(detail.fabricWastePercent,"%",3)}/>
        </div>
        <section><b className="text-sm">Cây vải đã chọn</b><div className="mt-2 space-y-2">{detail.rolls?.length?detail.rolls.map((r:any)=><div key={r.id} className="rounded-2xl bg-neutral-50 p-3 text-sm"><b>{r.rollCode||"Cây"}</b><div className="text-xs text-neutral-500">{r.colorName||"—"} {r.colorCode||""} · {Number(r.allocatedM||0).toLocaleString("vi-VN")}m</div></div>):<Empty text="Chưa chọn cây vải"/>}</div></section>
        <section><b className="text-sm">Kế hoạch size</b><div className="mt-2 flex flex-wrap gap-2">{detail.sizes?.length?detail.sizes.map((s:any)=><span key={s.id||`${s.colorName}-${s.size}`} className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-black">{s.size}: {s.plannedQty}</span>):<span className="text-xs text-neutral-400">Chưa tính size.</span>}</div></section>
        <section><b className="text-sm">Nguyên phụ liệu</b><div className="mt-2 space-y-2">{detail.materials?.length?detail.materials.map((m:any)=><div key={m.id} className="flex justify-between rounded-2xl bg-neutral-50 p-3 text-sm"><span>{m.accessoryName}</span><b>{Number(m.requiredQty||0).toLocaleString("vi-VN")} {m.unit}</b></div>):<Empty text="Chưa tính NPL"/>}</div></section>
      </div>
    </div>
  </div>
}
function Info({l,v}:{l:string;v:any}){return <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">{l}</div><div className="mt-1 text-sm font-black">{v}</div></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-400">{text}</div>}
