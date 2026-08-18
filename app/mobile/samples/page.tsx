"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Staff = { id:string; code?:string|null; name:string };
type Factory = { id:string; code:string; name:string; contactName?:string|null; phone?:string|null };
type Board = { id:string; boardCode:string; name?:string|null; fabricCode?:string|null };
type Meta = {
  staff:Staff[];
  boards:Board[];
  factories:Factory[];
  seasons:string[];
  productGroups:string[];
};
type Sample = any;

const SAMPLE_STATUSES:[string,string][] = [
  ["IDEA","Ý tưởng"],
  ["FABRIC_SELECTED","Đã chọn vải"],
  ["SAMPLING","Đang làm mẫu"],
  ["SAMPLE_READY","Nhà may trả mẫu"],
  ["REVISING","Đang sửa mẫu"],
  ["APPROVED_FOR_PRODUCTION","Duyệt sản xuất"],
  ["IN_PRODUCTION","Đang sản xuất"],
  ["COMPLETED","Hoàn tất"],
  ["ON_HOLD","Tạm dừng"],
];

const DISPATCH_STATUSES:[string,string][] = [
  ["SENT","Đã gửi"],
  ["RECEIVED","Xưởng đã nhận"],
  ["MAKING","Đang làm mẫu"],
  ["RETURNED","Đã trả mẫu"],
  ["REVISING","Đang sửa mẫu"],
  ["APPROVED","Đã duyệt"],
  ["CANCELLED","Huỷ"],
];

async function api<T=any>(path:string,init:RequestInit={}) {
  return apiJson<T>(path,{...init,redirectOnUnauthorized:false} as any);
}
async function upload(file:File) {
  const fd=new FormData();
  fd.append("file",file);
  return api<{url:string}>("/sample-fabric/samples/upload",{method:"POST",body:fd});
}
function asset(url?:string|null){
  if(!url)return "";
  return /^https?:\/\//.test(url)?url:`${API_BASE}${url.startsWith("/")?"":"/"}${url}`;
}
function normalizeCode(v:any){return String(v||"").trim().toUpperCase().replace(/\s+/g,"")}
function normalizeColor(v:any){
  const raw=String(v||"").trim();
  if(!raw)return "";
  return `#${raw.replace(/^#+/,"")}`;
}
function titleCase(v:any){
  return String(v||"").trim().toLowerCase().replace(/(^|\s|-)(\p{L})/gu,(m,p1,p2)=>p1+p2.toUpperCase());
}
function dateOnly(v:any){
  if(!v)return "";
  const s=String(v);
  return s.length>=10?s.slice(0,10):s;
}
function fmtDate(v:any){
  if(!v)return "—";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("vi-VN");
}
function rolesOf(user:any){
  return [...(Array.isArray(user?.roles)?user.roles:[]),user?.role,user?.roleCode,user?.staffRole]
    .map(x=>String(x||"").toLowerCase()).filter(Boolean);
}
function isAdmin(user:any){const r=rolesOf(user);return r.includes("owner")||r.includes("admin")}

const MOBILE_VIEWPORT_CONTENT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
function lockMobileViewport(){
  if(typeof document==="undefined")return;
  let meta=document.querySelector('meta[name="viewport"]') as HTMLMetaElement|null;
  if(!meta){
    meta=document.createElement("meta");
    meta.name="viewport";
    document.head.appendChild(meta);
  }
  if(meta.content!==MOBILE_VIEWPORT_CONTENT)meta.content=MOBILE_VIEWPORT_CONTENT;
}
function resetIosZoom(){
  if(typeof window==="undefined")return;
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  lockMobileViewport();
  window.requestAnimationFrame(()=>{
    lockMobileViewport();
    window.scrollTo({left:0,top:window.scrollY,behavior:"auto"});
  });
}
function closeWithZoomReset(fn:()=>void){
  resetIosZoom();
  fn();
  window.setTimeout(resetIosZoom,50);
  window.setTimeout(resetIosZoom,250);
}

export default function Page(){
  const [rows,setRows]=useState<Sample[]>([]);
  const [meta,setMeta]=useState<Meta>({staff:[],boards:[],factories:[],seasons:[],productGroups:[]});
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [detail,setDetail]=useState<Sample|null>(null);
  const [editing,setEditing]=useState<Sample|null|undefined>(undefined);
  const [dispatching,setDispatching]=useState<Sample|null>(null);
  const [user,setUser]=useState<any>(null);

  const permissions=useMemo(()=>getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId),[user]);
  const can=(key:string)=>isAdmin(user)||permissions.includes("*")||permissions.includes(key);

  async function load(){
    try{
      setLoading(true);setError("");
      const [samples,m]=await Promise.all([
        api<Sample[]>("/sample-fabric/samples"),
        api<Meta>("/sample-fabric/samples/meta"),
      ]);
      setRows(Array.isArray(samples)?samples:[]);
      setMeta({
        staff:Array.isArray(m.staff)?m.staff:[],
        boards:Array.isArray(m.boards)?m.boards:[],
        factories:Array.isArray(m.factories)?m.factories:[],
        seasons:Array.isArray(m.seasons)?m.seasons:[],
        productGroups:Array.isArray(m.productGroups)?m.productGroups:[],
      });
      if(detail){
        const next=(samples||[]).find((x:any)=>x.id===detail.id);
        if(next)setDetail(next);
      }
    }catch(e){setError(e instanceof Error?e.message:"Không tải được mẫu.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{
    setUser(getCurrentUserFromStorage());
    lockMobileViewport();
    void load();

    const reset=()=>resetIosZoom();
    const onVisibility=()=>{if(document.visibilityState==="visible")window.setTimeout(reset,50)};
    window.addEventListener("pageshow",reset);
    window.addEventListener("focus",reset);
    window.addEventListener("orientationchange",reset);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      window.removeEventListener("pageshow",reset);
      window.removeEventListener("focus",reset);
      window.removeEventListener("orientationchange",reset);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);

  const filtered=useMemo(()=>{
    const k=q.trim().toLowerCase();
    if(!k)return rows;
    return rows.filter(r=>[
      r.code,r.name,r.season,r.category,r.fabricBoard?.boardCode,
      r.fabricColorName,r.fabricColorCode,r.sampleFactoryName,r.assigneeName
    ].some(v=>String(v||"").toLowerCase().includes(k)));
  },[rows,q]);

  async function removeSample(sample:Sample){
    if(!window.confirm(`Xoá mẫu ${sample.code} · ${sample.name}?`))return;
    try{
      setError("");
      await api(`/sample-fabric/samples/${sample.id}`,{method:"DELETE"});
      setDetail(null);
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Không xoá được mẫu.")}
  }

  return <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(112px+env(safe-area-inset-bottom))] text-neutral-950">
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[calc(16px+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/mobile/production" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link>
            <div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Sản xuất</div><h1 className="truncate text-xl font-black">Triển khai mẫu</h1></div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
            {can("design_sample.create")&&<button onClick={()=>setEditing(null)} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Tạo mẫu</button>}
          </div>
        </div>
        <input className={`${input} mt-4`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm mã mẫu, tên, bảng vải, màu..." onBlur={resetIosZoom}/>
      </header>

      <div className="space-y-3 p-4">
        {error&&<Err x={error}/>}
        {loading&&<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">Đang tải...</div>}

        {!loading&&filtered.map(r=>{
          const image=asset(r.coverImageUrl||r.images?.[0]?.url||r.matchedProduct?.imageUrl);
          return <button type="button" onClick={()=>setDetail(r)} key={r.id} className="flex w-full gap-4 rounded-[28px] bg-white p-4 text-left shadow-sm active:scale-[.995]">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">{image?<img src={image} className="h-full w-full object-cover" alt=""/>:<div className="grid h-full place-items-center text-2xl text-neutral-300">✦</div>}</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-neutral-400">{r.code} · {r.year}</div>
              <div className="mt-1 text-base font-black">{r.name}</div>
              <div className="mt-2 text-xs text-neutral-500">{r.season||"—"} · {r.category||"—"}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{statusLabel(r.status)}</Badge>
                {r.fabricColorName&&<Badge>{r.fabricColorName} {r.fabricColorCode||""}</Badge>}
                {r.sampleFactoryName&&<Badge>{r.sampleFactoryName}</Badge>}
              </div>
            </div>
          </button>
        })}
        {!loading&&!filtered.length&&<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">Chưa có mẫu phù hợp.</div>}
      </div>
    </div>

    {detail&&<DetailModal
      sample={detail}
      can={can}
      onClose={()=>setDetail(null)}
      onEdit={()=>setEditing(detail)}
      onDelete={()=>void removeSample(detail)}
      onDispatch={()=>setDispatching(detail)}
      onChanged={load}
    />}

    {editing!==undefined&&<SampleForm
      sample={editing}
      meta={meta}
      canViewFabricLink={can("fabric_library.view")}
      onClose={()=>setEditing(undefined)}
      onSaved={async()=>{setEditing(undefined);await load()}}
    />}

    {dispatching&&<DispatchForm
      sample={dispatching}
      meta={meta}
      onClose={()=>setDispatching(null)}
      onSaved={async()=>{setDispatching(null);setDetail(null);await load()}}
    />}

    {!detail && editing === undefined && !dispatching && <MobileBottomNav/>}
  </main>
}

function DetailModal({sample,can,onClose,onEdit,onDelete,onDispatch,onChanged}:{sample:Sample;can:(k:string)=>boolean;onClose:()=>void;onEdit:()=>void;onDelete:()=>void;onDispatch:()=>void;onChanged:()=>void}){
  const image=asset(sample.coverImageUrl||sample.images?.[0]?.url||sample.matchedProduct?.imageUrl);
  const dispatches=Array.isArray(sample.sampleDispatches)?sample.sampleDispatches:[];
  return <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/45 p-3 pb-[max(16px,env(safe-area-inset-bottom))]" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}>
    <div className="mx-auto my-4 max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b p-4">
        <div><div className="text-xs font-black text-neutral-400">{sample.code}</div><div className="font-black">{sample.name}</div></div>
        <button onClick={()=>closeWithZoomReset(onClose)} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button>
      </div>

      <div className="space-y-4 p-4">
        {image&&<img src={image} className="h-64 w-full rounded-3xl object-cover" alt=""/>}

        <div className="grid grid-cols-2 gap-3">
          <Info l="Năm" v={sample.year||"—"}/>
          <Info l="Mùa / BST" v={sample.season||"—"}/>
          <Info l="Nhóm SP" v={sample.category||"—"}/>
          <Info l="Tiến độ" v={statusLabel(sample.status)}/>
          {can("fabric_library.view")&&<Info l="Bảng vải" v={sample.fabricBoard?.boardCode||sample.fabricBoardCode||"—"}/>}
          {can("fabric_library.view")&&<Info l="Màu" v={`${sample.fabricColorName||"—"} ${sample.fabricColorCode||""}`.trim()}/>}
          <Info l="Nhà may làm mẫu" v={sample.sampleFactoryName||dispatches?.[0]?.recipientName||"—"}/>
          <Info l="Phụ trách" v={sample.assigneeName||"—"}/>
          <Info l="Hạn dự kiến" v={fmtDate(sample.dueDate)}/>
          <Info l="Việc tiếp theo" v={sample.nextAction||"—"}/>
        </div>

        {sample.note&&<Info l="Ghi chú mẫu" v={sample.note}/>}
        {sample.technicalNote&&<Info l="Ghi chú kỹ thuật" v={sample.technicalNote}/>}

        <section>
          <div className="flex items-center justify-between"><b className="text-sm">Lịch sử gửi mẫu</b>{can("sample_dispatch.create")&&<button onClick={onDispatch} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"><Send className="mr-1 inline h-3.5 w-3.5"/>Gửi / gửi lại</button>}</div>
          <div className="mt-2 space-y-2">
            {dispatches.length?dispatches.map((d:any)=><DispatchRow key={d.id} dispatch={d} can={can} onChanged={onChanged}/>):<div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-400">Chưa có lần gửi mẫu.</div>}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 border-t pt-4">
          {can("design_sample.edit")&&<button onClick={onEdit} className="rounded-2xl border py-3 font-black"><Pencil className="mr-1 inline h-4 w-4"/>Sửa mẫu</button>}
          {can("design_sample.delete")&&<button onClick={onDelete} className="rounded-2xl border border-red-200 bg-red-50 py-3 font-black text-red-700"><Trash2 className="mr-1 inline h-4 w-4"/>Xoá mẫu</button>}
        </div>
      </div>
    </div>
  </div>
}

function DispatchRow({dispatch,can,onChanged}:{dispatch:any;can:(k:string)=>boolean;onChanged:()=>void}){
  const [busy,setBusy]=useState(false);
  async function setStatus(status:string){
    try{setBusy(true);await api(`/sample-fabric/sample-dispatches/${dispatch.id}`,{method:"PATCH",body:JSON.stringify({status,returnedAt:status==="RETURNED"?new Date().toISOString():undefined})});await onChanged()}finally{setBusy(false)}
  }
  async function remove(){
    if(!window.confirm("Xoá lần gửi mẫu này?"))return;
    try{setBusy(true);await api(`/sample-fabric/sample-dispatches/${dispatch.id}`,{method:"DELETE"});await onChanged()}finally{setBusy(false)}
  }
  return <div className="rounded-2xl bg-neutral-50 p-3">
    <div className="flex items-start justify-between gap-2"><div><b className="text-sm">{dispatch.recipientName}</b><div className="mt-1 text-xs text-neutral-500">{fmtDate(dispatch.sentAt)} · {dispatch.colorName||"—"} {dispatch.colorCode||""}</div></div><Badge>{dispatchLabel(dispatch.status)}</Badge></div>
    {dispatch.note&&<div className="mt-2 text-xs text-neutral-500">{dispatch.note}</div>}
    {(can("sample_dispatch.edit")||can("sample_dispatch.delete"))&&<div className="mt-3 flex gap-2 overflow-x-auto">
      {can("sample_dispatch.edit")&&<>
        <SmallBtn disabled={busy} onClick={()=>void setStatus("MAKING")}>Đang làm</SmallBtn>
        <SmallBtn disabled={busy} onClick={()=>void setStatus("RETURNED")}>Đã trả</SmallBtn>
        <SmallBtn disabled={busy} onClick={()=>void setStatus("REVISING")}>Sửa mẫu</SmallBtn>
        <SmallBtn disabled={busy} onClick={()=>void setStatus("APPROVED")}>Duyệt</SmallBtn>
      </>}
      {can("sample_dispatch.delete")&&<SmallBtn danger disabled={busy} onClick={()=>void remove()}>Xoá lần gửi</SmallBtn>}
    </div>}
  </div>
}

function SampleForm({sample,meta,canViewFabricLink,onClose,onSaved}:{sample:Sample|null;meta:Meta;canViewFabricLink:boolean;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState<any>({
    name:sample?.name||"",
    code:sample?.code||"",
    year:sample?.year||new Date().getFullYear(),
    season:sample?.season||"",
    category:sample?.category||"",
    fabricBoardId:sample?.fabricBoardId||"",
    fabricColorName:sample?.fabricColorName||"",
    fabricColorCode:sample?.fabricColorCode||"",
    sampleFactoryId:sample?.sampleFactoryId||"",
    status:sample?.status||"IDEA",
    assigneeStaffId:sample?.assigneeStaffId||"",
    nextAction:sample?.nextAction||"",
    dueDate:dateOnly(sample?.dueDate),
    note:sample?.note||"",
    technicalNote:sample?.technicalNote||"",
    coverImageUrl:sample?.coverImageUrl||sample?.images?.[0]?.url||"",
  });
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [codeMessage,setCodeMessage]=useState("");
  const [codeAvailable,setCodeAvailable]=useState<boolean|null>(sample?true:null);

  const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));

  useEffect(()=>{
    const code=normalizeCode(form.code);
    const original=normalizeCode(sample?.code);
    if(!code){setCodeAvailable(null);setCodeMessage("");return}
    if(sample&&code===original){setCodeAvailable(true);setCodeMessage("Mã hiện tại của mẫu.");return}
    const t=window.setTimeout(async()=>{
      try{
        const qs=new URLSearchParams({code});
        if(sample?.id)qs.set("excludeId",sample.id);
        const r=await api<{available:boolean;message:string}>(`/sample-fabric/samples/check-code?${qs}`);
        setCodeAvailable(r.available);setCodeMessage(r.message||"");
      }catch(e){setCodeAvailable(false);setCodeMessage(e instanceof Error?e.message:"Không kiểm tra được mã.")}
    },350);
    return()=>clearTimeout(t);
  },[form.code,sample?.id,sample?.code]);

  async function changeImage(file?:File){
    if(!file)return;
    try{const r=await upload(file);patch("coverImageUrl",r.url)}catch(e){setError(e instanceof Error?e.message:"Upload lỗi")}
  }

  async function save(){
    try{
      setSaving(true);setError("");
      if(!form.name.trim())throw new Error("Thiếu tên mẫu.");
      if(!normalizeCode(form.code))throw new Error("Thiếu mã mẫu.");
      if(codeAvailable!==true)throw new Error(codeMessage||"Mã mẫu chưa hợp lệ.");
      const staff=meta.staff.find(x=>x.id===form.assigneeStaffId);
      const factory=meta.factories.find(x=>x.id===form.sampleFactoryId);
      const board=meta.boards.find(x=>x.id===form.fabricBoardId);

      await api(sample?`/sample-fabric/samples/${sample.id}`:"/sample-fabric/samples",{
        method:sample?"PATCH":"POST",
        body:JSON.stringify({
          name:form.name,
          code:normalizeCode(form.code),
          year:Number(form.year||new Date().getFullYear()),
          season:form.season||null,
          category:titleCase(form.category)||null,
          fabricBoardId:canViewFabricLink?(form.fabricBoardId||null):undefined,
          fabricBoardCode:canViewFabricLink?(board?.boardCode||null):undefined,
          fabricCode:canViewFabricLink?(board?.fabricCode||null):undefined,
          fabricColorId:null,
          fabricColorName:canViewFabricLink?(titleCase(form.fabricColorName)||null):undefined,
          fabricColorCode:canViewFabricLink?(normalizeColor(form.fabricColorCode)||null):undefined,
          sampleFactoryId:form.sampleFactoryId||null,
          sampleFactoryName:factory?.name||null,
          status:form.status,
          assigneeStaffId:form.assigneeStaffId||null,
          assigneeName:staff?.name||null,
          nextAction:form.nextAction||null,
          dueDate:form.dueDate||null,
          note:form.note||null,
          technicalNote:form.technicalNote||null,
          coverImageUrl:form.coverImageUrl||null,
          images:form.coverImageUrl?[{type:"SAMPLE",url:form.coverImageUrl,caption:"Ảnh mẫu / ảnh tham khảo"}]:[],
        })
      });
      if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
      requestAnimationFrame(()=>{resetIosZoom();onSaved()});
    }catch(e){setError(e instanceof Error?e.message:"Không lưu được mẫu.")}
    finally{setSaving(false)}
  }

  return <Modal title={sample?`Sửa mẫu ${sample.code}`:"Tạo mẫu triển khai"} onClose={onClose}>
    <div className="space-y-4 p-4">
      {error&&<Err x={error}/>}

      <Field l="Ảnh mẫu / ảnh tham khảo">
        <div className="rounded-3xl border border-dashed p-3">
          {form.coverImageUrl&&<img src={asset(form.coverImageUrl)} className="mb-3 h-56 w-full rounded-3xl object-cover" alt=""/>}
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-2xl bg-neutral-950 py-3 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-4 w-4"/>Chụp<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>void changeImage(e.target.files?.[0])}/></label>
            <label className="cursor-pointer rounded-2xl border py-3 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-4 w-4"/>Tải ảnh<input type="file" accept="image/*" className="hidden" onChange={e=>void changeImage(e.target.files?.[0])}/></label>
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field l="Tên mẫu"><input className={input} value={form.name} onChange={e=>patch("name",e.target.value)}/></Field>
        <Field l="Mã mẫu"><input className={input} value={form.code} onChange={e=>patch("code",normalizeCode(e.target.value))}/><div className={`mt-1 text-[11px] ${codeAvailable===false?"text-red-600":codeAvailable?"text-emerald-600":"text-neutral-400"}`}>{codeMessage}</div></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field l="Năm"><input type="number" className={input} value={form.year} onChange={e=>patch("year",e.target.value)}/></Field>
        <Field l="Mùa / BST"><select className={input} value={form.season} onChange={e=>patch("season",e.target.value)}><option value="">Chưa chọn</option>{meta.seasons.map(x=><option key={x}>{x}</option>)}</select></Field>
      </div>

      <Field l="Nhóm sản phẩm">
        <input list="mobile-sample-groups" className={input} value={form.category} onChange={e=>patch("category",e.target.value)} onBlur={()=>patch("category",titleCase(form.category))} placeholder="VD: Áo Khoác"/>
        <datalist id="mobile-sample-groups">{meta.productGroups.map(x=><option key={x} value={x}/>)}</datalist>
      </Field>

      {canViewFabricLink&&<>
        <Field l="Bảng vải"><select className={input} value={form.fabricBoardId} onChange={e=>patch("fabricBoardId",e.target.value)}><option value="">Chưa chọn bảng vải</option>{meta.boards.map(b=><option key={b.id} value={b.id}>{b.boardCode}{b.name?` · ${b.name}`:""}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field l="Màu vải"><input className={input} value={form.fabricColorName} onChange={e=>patch("fabricColorName",e.target.value)} placeholder="VD: Trắng Kem"/></Field>
          <Field l="Mã màu"><input className={input} value={form.fabricColorCode} onChange={e=>patch("fabricColorCode",normalizeColor(e.target.value))} placeholder="#2"/></Field>
        </div>
      </>}

      <Field l="Nhà may làm mẫu"><select className={input} value={form.sampleFactoryId} onChange={e=>patch("sampleFactoryId",e.target.value)}><option value="">Chưa chọn nhà may</option>{meta.factories.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field l="Tiến độ"><select className={input} value={form.status} onChange={e=>patch("status",e.target.value)}>{SAMPLE_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
        <Field l="Người phụ trách"><select className={input} value={form.assigneeStaffId} onChange={e=>patch("assigneeStaffId",e.target.value)}><option value="">Chưa gán</option>{meta.staff.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      </div>

      <Field l="Việc tiếp theo"><input className={input} value={form.nextAction} onChange={e=>patch("nextAction",e.target.value)}/></Field>
      <Field l="Hạn dự kiến"><input type="date" className={input} value={form.dueDate} onChange={e=>patch("dueDate",e.target.value)}/></Field>
      <Field l="Ghi chú mẫu"><textarea className={`${input} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field>
      <Field l="Ghi chú kỹ thuật"><textarea className={`${input} min-h-24`} value={form.technicalNote} onChange={e=>patch("technicalNote",e.target.value)}/></Field>

      <div className="grid grid-cols-2 gap-2 border-t pt-4">
        <button onClick={()=>closeWithZoomReset(onClose)} className="rounded-2xl border py-3 font-black">Đóng</button>
        <button disabled={saving||!form.name||!form.code} onClick={()=>void save()} className="rounded-2xl bg-neutral-950 py-3 font-black text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu mẫu"}</button>
      </div>
    </div>
  </Modal>
}

function DispatchForm({sample,meta,onClose,onSaved}:{sample:Sample;meta:Meta;onClose:()=>void;onSaved:()=>void}){
  const defaultFactory=meta.factories.find(x=>x.id===sample.sampleFactoryId);
  const [form,setForm]=useState<any>({
    fabricBoardId:sample.fabricBoardId||"",
    designSampleId:sample.id,
    sampleFactoryId:sample.sampleFactoryId||"",
    recipientName:sample.sampleFactoryName||defaultFactory?.name||"",
    recipientType:"Nhà may",
    recipientContact:defaultFactory?.phone||"",
    colorName:sample.fabricColorName||"",
    colorCode:sample.fabricColorCode||"",
    sentAt:new Date().toISOString().slice(0,10),
    sentById:sample.assigneeStaffId||"",
    dueDate:dateOnly(sample.dueDate),
    status:"SENT",
    note:"",
  });
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));

  async function save(){
    try{
      setSaving(true);setError("");
      if(!form.fabricBoardId)throw new Error("Mẫu chưa gắn bảng vải.");
      if(!form.recipientName.trim())throw new Error("Chưa chọn nhà may / nơi nhận.");
      const staff=meta.staff.find(x=>x.id===form.sentById);
      await api("/sample-fabric/sample-dispatches",{
        method:"POST",
        body:JSON.stringify({
          ...form,
          colorName:titleCase(form.colorName)||null,
          colorCode:normalizeColor(form.colorCode)||null,
          sentByName:staff?.name||null,
        })
      });
      if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
      requestAnimationFrame(()=>{resetIosZoom();onSaved()});
    }catch(e){setError(e instanceof Error?e.message:"Không gửi được mẫu.")}
    finally{setSaving(false)}
  }

  return <Modal title={`Gửi mẫu · ${sample.code}`} onClose={onClose}>
    <div className="space-y-4 p-4">
      {error&&<Err x={error}/>}

      <Field l="Nhà may / xưởng">
        <select className={input} value={form.sampleFactoryId} onChange={e=>{
          const f=meta.factories.find(x=>x.id===e.target.value);
          setForm((x:any)=>({...x,sampleFactoryId:e.target.value,recipientName:f?.name||"",recipientContact:f?.phone||""}));
        }}>
          <option value="">Chọn nhà may</option>
          {meta.factories.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
        </select>
      </Field>

      <Field l="Tên nơi nhận"><input className={input} value={form.recipientName} onChange={e=>patch("recipientName",e.target.value)}/></Field>
      <Field l="Liên hệ"><input className={input} value={form.recipientContact} onChange={e=>patch("recipientContact",e.target.value)}/></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field l="Màu gửi"><input className={input} value={form.colorName} onChange={e=>patch("colorName",e.target.value)}/></Field>
        <Field l="Mã màu"><input className={input} value={form.colorCode} onChange={e=>patch("colorCode",normalizeColor(e.target.value))}/></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field l="Ngày gửi"><input type="date" className={input} value={form.sentAt} onChange={e=>patch("sentAt",e.target.value)}/></Field>
        <Field l="Hạn trả mẫu"><input type="date" className={input} value={form.dueDate} onChange={e=>patch("dueDate",e.target.value)}/></Field>
      </div>

      <Field l="Người gửi"><select className={input} value={form.sentById} onChange={e=>patch("sentById",e.target.value)}><option value="">Chưa chọn</option>{meta.staff.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field l="Trạng thái"><select className={input} value={form.status} onChange={e=>patch("status",e.target.value)}>{DISPATCH_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
      <Field l="Ghi chú gửi mẫu"><textarea className={`${input} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field>

      <div className="grid grid-cols-2 gap-2 border-t pt-4">
        <button onClick={()=>closeWithZoomReset(onClose)} className="rounded-2xl border py-3 font-black">Đóng</button>
        <button disabled={saving} onClick={()=>void save()} className="rounded-2xl bg-neutral-950 py-3 font-black text-white disabled:opacity-40"><Send className="mr-1 inline h-4 w-4"/>{saving?"Đang gửi...":"Gửi mẫu"}</button>
      </div>
    </div>
  </Modal>
}

function statusLabel(v:any){return SAMPLE_STATUSES.find(x=>x[0]===v)?.[1]||String(v||"—")}
function dispatchLabel(v:any){return DISPATCH_STATUSES.find(x=>x[0]===v)?.[1]||String(v||"—")}
function Field({l,children}:{l:string;children:any}){return <label className="block"><span className={label}>{l}</span>{children}</label>}
function Info({l,v}:{l:string;v:any}){return <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">{l}</div><div className="mt-1 text-sm font-black">{v}</div></div>}
function Badge({children}:{children:any}){return <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-black text-neutral-600">{children}</span>}
function SmallBtn({children,onClick,disabled,danger=false}:{children:any;onClick:()=>void;disabled?:boolean;danger?:boolean}){return <button disabled={disabled} onClick={onClick} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black disabled:opacity-40 ${danger?"border-red-200 bg-red-50 text-red-700":"border-neutral-200 bg-white"}`}>{children}</button>}
function Err({x}:{x:string}){return <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{x}</div>}
function Modal({title,children,onClose}:{title:string;children:any;onClose:()=>void}){return <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/45 p-3 pb-[max(16px,env(safe-area-inset-bottom))]" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}><div className="mx-auto my-3 max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-4"><h2 className="font-black">{title}</h2><button onClick={()=>closeWithZoomReset(onClose)} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button></div>{children}</div></div>}

const label="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-neutral-400";
const input="w-full min-w-0 rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] leading-6 outline-none focus:border-neutral-950";
