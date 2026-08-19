"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Supplier={id:string;code?:string|null;name?:string|null};
type Branch={id:string;name:string};
type Sample={id:string;code:string;name:string;year?:number;fabricBoardCode?:string|null;fabricCode?:string|null};
type Roll={id?:string;rollCode?:string|null;colorName?:string|null;colorCode?:string|null;supplierDeclaredM?:any;supplierDeclaredKg?:any;actualM?:any;actualKg?:any;defectNote?:string|null;passed?:boolean;images?:Array<{id:string;url:string;caption?:string|null}>};
type Measurement={id:string;areaCm2:number;weightGrams:number;gsm:number;positionLabel?:string|null;imageUrl?:string|null;measuredByName?:string|null;createdAt:string};
type Receipt={
 id:string;receiptCode:string;designSampleId?:string|null;designSample?:Sample|null;supplierId?:string|null;supplier?:Supplier|null;branchId?:string|null;branch?:Branch|null;
 fabricBoardCode?:string|null;fabricCode?:string|null;fabricName?:string|null;colorName?:string|null;colorCode?:string|null;lotCode?:string|null;
 supplierDeclaredM?:number|null;supplierDeclaredKg?:number|null;actualM?:number|null;actualKg?:number|null;rollCount:number;
 unitPrice?:number|null;priceUnit:"METER"|"KG"|"ROLL";priceCurrency?:string|null;exchangeRateToVnd?:number|null;unitPriceVnd?:number|null;expectedGsm?:number|null;measuredGsm?:number|null;varianceApproved:boolean;status:string;
 receivedAt?:string|null;completedAt?:string|null;note?:string|null;rolls:Roll[];measurements:Measurement[];
 images?:Array<{id:string;type:string;url:string;caption?:string|null}>;
};
type BoardColor={id:string;name:string;code?:string|null;imageUrl?:string|null};
type FabricBoard={id:string;boardCode:string;fabricCode?:string|null;name?:string|null;supplierId?:string|null;expectedGsm?:number|null;colors?:BoardColor[]};
type Meta={suppliers:Supplier[];branches:Branch[];samples:Sample[];boards:FabricBoard[]};

const STATUSES=[["DRAFT","Nháp"],["RECEIVING","Đang nhận"],["INSPECTING","Đang kiểm"],["COMPLETED","Hoàn tất"],["CANCELLED","Đã huỷ"]] as const;

async function api<T=any>(p:string,i:RequestInit={}){return apiJson<T>(p,{...i,redirectOnUnauthorized:false} as any)}
async function upload(file:File){const fd=new FormData();fd.append("file",file);return api<{url:string}>("/sample-fabric/fabric-receipts/upload",{method:"POST",body:fd})}
function asset(u?:string|null){if(!u)return "";return /^https?:\/\//.test(u)?u:`${API_BASE}${u.startsWith("/")?"":"/"}${u}`}
function num(v:any){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:0}
function fmt(v:any,d=3){return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(num(v))}
function money(v:any){return new Intl.NumberFormat("vi-VN").format(num(v))+"đ"}
function colorCode(v:any){const raw=String(v||"").trim();return raw?`#${raw.replace(/^#+/,"")}`:""}
function colorCodes(v:any){
 return Array.from(new Set(String(v||"").split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean).map(x=>colorCode(x)))).join(", ");
}
function colorCodeList(v:any){return colorCodes(v).split(",").map(x=>x.trim()).filter(Boolean)}
function colorNameList(v:any){return String(v||"").split(",").map(x=>x.trim()).filter(Boolean)}
function dateText(v?:string|null){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("vi-VN")}
function statusLabel(v:string){return STATUSES.find(x=>x[0]===v)?.[1]||v}
function roles(u:any){return [...(Array.isArray(u?.roles)?u.roles:[]),u?.role,u?.roleCode,u?.staffRole].map(x=>String(x||"").toLowerCase()).filter(Boolean)}
function owner(u:any){const r=roles(u);return r.includes("owner")||r.includes("admin")}
function resetMobileViewport(){
 if(typeof window==="undefined")return;
 if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
 const y=window.scrollY;
 const reset=()=>{
  window.scrollTo({top:y,left:0,behavior:"auto"});
  document.documentElement.scrollLeft=0;
  document.body.scrollLeft=0;
  document.documentElement.style.minHeight="100%";
  document.body.style.minHeight="100%";
  window.dispatchEvent(new Event("resize"));
 };
 requestAnimationFrame(reset);
 setTimeout(reset,80);
 setTimeout(reset,220);
 setTimeout(reset,420);
}

export default function Page(){
 useEffect(()=>{
  const htmlBg=document.documentElement.style.backgroundColor;
  const bodyBg=document.body.style.backgroundColor;
  const bodyMin=document.body.style.minHeight;
  document.documentElement.style.backgroundColor="#f5f5f5";
  document.body.style.backgroundColor="#f5f5f5";
  document.body.style.minHeight="100lvh";
  return()=>{
   document.documentElement.style.backgroundColor=htmlBg;
   document.body.style.backgroundColor=bodyBg;
   document.body.style.minHeight=bodyMin;
  };
 },[]);
 const [rows,setRows]=useState<Receipt[]>([]);
 const [meta,setMeta]=useState<Meta>({suppliers:[],branches:[],samples:[],boards:[]});
 const [q,setQ]=useState(""),[status,setStatus]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [editing,setEditing]=useState<Receipt|null|undefined>(undefined);
 const [measure,setMeasure]=useState<Receipt|null>(null);
 const [detail,setDetail]=useState<Receipt|null>(null);
 const [user,setUser]=useState<any>(null);
 const keys=useMemo(()=>getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId),[user]);
 const can=(k:string)=>owner(user)||keys.includes("*")||keys.includes(k);
 const canSupplierIdentity=can("fabric_receipt.supplier_identity.view");
 const canCostView=can("fabric_receipt.cost.view")||can("fabric_receipt.cost.edit");
 const canOpenPage=can("mobile.page.fabric_receipts")&&can("fabric_receipt.view");

 async function load(){
  try{
   setLoading(true);setError("");
   const params=new URLSearchParams(); if(q.trim())params.set("q",q.trim()); if(status)params.set("status",status);
   const [r,m]=await Promise.all([
    api<Receipt[]>(`/sample-fabric/fabric-receipts${params.toString()?`?${params}`:""}`),
    api<Meta>("/sample-fabric/fabric-receipts/meta")
   ]);
   setRows(Array.isArray(r)?r:[]);
   setMeta({suppliers:Array.isArray(m.suppliers)?m.suppliers:[],branches:Array.isArray(m.branches)?m.branches:[],samples:Array.isArray(m.samples)?m.samples:[],boards:Array.isArray((m as any).boards)?(m as any).boards:[]});
  }catch(e){setError(e instanceof Error?e.message:"Không tải được vải về.")}
  finally{setLoading(false)}
 }
 useEffect(()=>{setUser(getCurrentUserFromStorage());void load()},[]);
 const totals=useMemo(()=>({
  m:rows.reduce((s,x)=>s+num(x.actualM),0),
  kg:rows.reduce((s,x)=>s+num(x.actualKg),0),
  dm:rows.reduce((s,x)=>s+num(x.actualM)-num(x.supplierDeclaredM),0),
  dkg:rows.reduce((s,x)=>s+num(x.actualKg)-num(x.supplierDeclaredKg),0),
 }),[rows]);

 async function action(r:Receipt,path:string){
  try{setError("");await api(`/sample-fabric/fabric-receipts/${r.id}/${path}`,{method:"POST",body:"{}"});await load()}
  catch(e){setError(e instanceof Error?e.message:"Không cập nhật được phiếu.")}
 }

 if(user&&!canOpenPage)return <main className="min-h-screen min-h-[100lvh] bg-neutral-100 p-6 pt-[max(56px,calc(env(safe-area-inset-top)+24px))]"><div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center"><div className="text-lg font-black">Không có quyền Vải về</div><div className="mt-2 text-sm text-neutral-500">Bật quyền màn App và fabric_receipt.view trong Phân quyền.</div></div></main>;
 return <main className="min-h-screen min-h-[100lvh] bg-neutral-100 pb-[calc(16px+env(safe-area-inset-bottom))] text-neutral-950">
  <div className="mx-auto max-w-md">
   <header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[max(24px,calc(env(safe-area-inset-top)+8px))] backdrop-blur">
    <div className="flex items-center justify-between gap-2">
     <div className="flex items-center gap-3"><Link href="/mobile/production" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Nguyên liệu</div><h1 className="text-xl font-black">Vải về</h1></div></div>
     <div className="flex gap-2"><button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>{can("fabric_receipt.create")&&<button onClick={()=>setEditing(null)} className="rounded-2xl bg-neutral-950 px-3 py-2.5 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Nhận vải</button>}</div>
    </div>
    <div className="mt-3 grid grid-cols-[1fr_130px] gap-2"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400"/><input className={`${input} pl-10`} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load()}} placeholder="Tìm phiếu, vải, màu, lô..."/></div><select className={input} value={status} onChange={e=>{setStatus(e.target.value);setTimeout(()=>void load(),0)}}><option value="">Tất cả</option>{STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></div>
   </header>

   <div className="space-y-4 p-4">
    {error&&<Err x={error}/>}
    <div className="grid grid-cols-2 gap-2"><Stat l="Mét thực nhận" v={`${fmt(totals.m)} m`}/><Stat l="Kg thực nhận" v={`${fmt(totals.kg)} kg`}/><Stat l="Lệch mét" v={`${totals.dm>0?"+":""}${fmt(totals.dm)} m`}/><Stat l="Lệch kg" v={`${totals.dkg>0?"+":""}${fmt(totals.dkg)} kg`}/></div>
    {loading?<Empty t="Đang tải dữ liệu..."/>:rows.map(r=>{
      const dm=num(r.actualM)-num(r.supplierDeclaredM),dkg=num(r.actualKg)-num(r.supplierDeclaredKg);
      return <article key={r.id} className="overflow-hidden rounded-[28px] bg-white shadow-sm">
       <button onClick={()=>setDetail(r)} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-neutral-400">{r.receiptCode}</div><div className="mt-1 font-black">{r.fabricName||r.fabricCode||"Vải"} · {r.colorName||r.colorCode||"—"}</div><div className="mt-1 text-xs text-neutral-400">Lô {r.lotCode||"—"} · {r.rollCount||r.rolls?.length||0} cây</div></div><Badge>{statusLabel(r.status)}</Badge></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Mini l="NCC báo" v={`${fmt(r.supplierDeclaredM)}m · ${fmt(r.supplierDeclaredKg)}kg`}/><Mini l="Thực nhận" v={`${fmt(r.actualM)}m · ${fmt(r.actualKg)}kg`}/><Mini l="Chênh lệch" v={`${dm>0?"+":""}${fmt(dm)}m · ${dkg>0?"+":""}${fmt(dkg)}kg`}/><Mini l="GSM" v={r.measuredGsm?`${fmt(r.measuredGsm,1)} / NCC ${fmt(r.expectedGsm,1)}`:`NCC ${fmt(r.expectedGsm,1)}`}/></div>
       </button>
       <div className="flex gap-2 overflow-x-auto border-t px-4 py-3">
        {can("fabric_receipt.edit")&&r.status!=="COMPLETED"&&<button onClick={()=>setEditing(r)} className={smallBtn}><Pencil className="mr-1 inline h-3 w-3"/>Sửa</button>}
        {can("fabric_receipt.measure")&&<button onClick={()=>setMeasure(r)} className={smallBtn}><Scale className="mr-1 inline h-3 w-3"/>Cân GSM</button>}
        {can("fabric_receipt.approve_variance")&&!r.varianceApproved&&(Math.abs(dm)>0.001||Math.abs(dkg)>0.001)&&<button onClick={()=>void action(r,"approve-variance")} className={`${smallBtn} border-amber-300 bg-amber-50 text-amber-800`}>Duyệt lệch</button>}
        {can("fabric_receipt.complete")&&r.status!=="COMPLETED"&&<button onClick={()=>void action(r,"complete")} className="shrink-0 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"><CheckCircle2 className="mr-1 inline h-3 w-3"/>Hoàn tất</button>}
       </div>
      </article>
    })}
    {!loading&&!rows.length&&<Empty t="Chưa có phiếu vải về."/>}
   </div>
  </div>

  {editing!==undefined&&<ReceiptForm receipt={editing} meta={meta} canSupplierIdentity={canSupplierIdentity} canCostView={canCostView} canCostEdit={can("fabric_receipt.cost.edit")} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);await load()}}/>}
  {measure&&<MeasurementForm receipt={measure} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setMeasure(null)} onSaved={async()=>{setMeasure(null);await load()}}/>}
  {detail&&<Detail receipt={detail} canSupplierIdentity={canSupplierIdentity} canCostView={canCostView} onClose={()=>setDetail(null)}/>}
 </main>
}

function ReceiptForm({receipt,meta,canSupplierIdentity,canCostView,canCostEdit,canUpload,onClose,onSaved}:{receipt:Receipt|null;meta:Meta;canSupplierIdentity:boolean;canCostView:boolean;canCostEdit:boolean;canUpload:boolean;onClose:()=>void;onSaved:()=>void}){
 const [f,setF]=useState<any>({receiptCode:receipt?.receiptCode||"",designSampleId:receipt?.designSampleId||"",supplierId:receipt?.supplierId||"",branchId:receipt?.branchId||"",fabricBoardCode:receipt?.fabricBoardCode||"",fabricCode:receipt?.fabricCode||"",fabricName:receipt?.fabricName||"",colorName:receipt?.colorName||"",colorCode:receipt?.colorCode||"",lotCode:receipt?.lotCode||"",supplierDeclaredM:receipt?.supplierDeclaredM??"",supplierDeclaredKg:receipt?.supplierDeclaredKg??"",actualM:receipt?.actualM??"",actualKg:receipt?.actualKg??"",unitPrice:receipt?.unitPrice??"",priceUnit:receipt?.priceUnit||"METER",priceCurrency:receipt?.priceCurrency||"VND",exchangeRateToVnd:receipt?.exchangeRateToVnd??"",expectedGsm:receipt?.expectedGsm??"",status:receipt?.status||"RECEIVING",receivedAt:receipt?.receivedAt?receipt.receivedAt.slice(0,10):new Date().toISOString().slice(0,10),note:receipt?.note||""});
 const [rolls,setRolls]=useState<Roll[]>(receipt?.rolls?.length?receipt.rolls:[{rollCode:"",colorName:"",colorCode:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",passed:true}]);
 const [files,setFiles]=useState<Record<number,File[]>>({});
 const [manualRollColor,setManualRollColor]=useState<Record<number,boolean>>({});
 const [saving,setSaving]=useState(false),[error,setError]=useState("");
 const patch=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
 useEffect(()=>{if(receipt)return;const p=new URLSearchParams();if(f.receivedAt)p.set("receivedAt",f.receivedAt);api<{code:string}>(`/sample-fabric/fabric-receipts/next-code?${p}`).then(r=>patch("receiptCode",r.code)).catch(()=>{})},[f.receivedAt,receipt?.id]);
 function chooseSample(id:string){
  patch("designSampleId",id);
  const s=meta.samples.find(x=>x.id===id);
  if(s){
   const board=meta.boards.find(b=>b.boardCode===s.fabricBoardCode || (!!s.fabricCode&&b.fabricCode===s.fabricCode));
   if(board)chooseBoard(board.id);
   else{if(!f.fabricBoardCode)patch("fabricBoardCode",s.fabricBoardCode||"");if(!f.fabricCode)patch("fabricCode",s.fabricCode||"")}
  }
 }
 function chooseBoard(id:string){
  const b=meta.boards.find(x=>x.id===id);
  patch("fabricBoardId",id||"");
  if(!b)return;
  patch("fabricBoardCode",b.boardCode||"");
  patch("fabricCode",b.fabricCode||"");
  patch("fabricName",b.name||"");
  if(b.supplierId)patch("supplierId",b.supplierId);
  if(b.expectedGsm!=null)patch("expectedGsm",b.expectedGsm);
 }
 const selectedBoard=meta.boards.find(x=>x.id===f.fabricBoardId)||meta.boards.find(x=>x.boardCode===f.fabricBoardCode);
 const allowedCodes=colorCodeList(f.colorCode);
 const allowedNames=colorNameList(f.colorName);
 const allowedColors=allowedCodes.map((code,index)=>{
  const fromBoard=selectedBoard?.colors?.find(c=>colorCode(c.code)===code);
  return {code,name:fromBoard?.name||allowedNames[index]||""};
 });
 function toggleBoardColor(c:BoardColor){
  const code=colorCode(c.code||c.name);
  const current=colorCodeList(f.colorCode);
  const has=current.includes(code);
  const next=has?current.filter(x=>x!==code):[...current,code];
  const names=next.map(x=>selectedBoard?.colors?.find(bc=>colorCode(bc.code||bc.name)===x)?.name||"").filter(Boolean);
  patch("colorCode",next.join(", "));
  patch("colorName",names.join(", "));
 }
 async function save(){
  try{
   setSaving(true);setError("");
   const normalized=rolls.map(r=>({...r,colorCode:colorCode(r.colorCode)||null,defectNote:String(r.defectNote||"").trim()||null}));
   const saved=await api<Receipt>(receipt?`/sample-fabric/fabric-receipts/${receipt.id}`:"/sample-fabric/fabric-receipts",{method:receipt?"PATCH":"POST",body:JSON.stringify({...f,colorCode:colorCodes(f.colorCode)||null,unitPrice:undefined,priceUnit:undefined,rollCount:normalized.length,rolls:normalized})});
   if(canCostEdit&&f.unitPrice!=="")await api(`/sample-fabric/fabric-receipts/${saved.id}/cost`,{method:"PATCH",body:JSON.stringify({unitPrice:num(f.unitPrice),priceUnit:f.priceUnit,priceCurrency:f.priceCurrency||"VND",exchangeRateToVnd:f.priceCurrency==="CNY"?num(f.exchangeRateToVnd):1})});
   for(const [ix,arr] of Object.entries(files)){const i=Number(ix),server=saved.rolls?.[i];if(!server?.id)continue;for(const file of arr){const u=await upload(file);await api(`/sample-fabric/fabric-receipts/${saved.id}/images`,{method:"POST",body:JSON.stringify({rollId:server.id,type:"FABRIC",url:u.url,caption:`Ảnh ${server.rollCode||`cây ${i+1}`}`})})}}
   resetMobileViewport();setTimeout(onSaved,90);
  }catch(e){setError(e instanceof Error?e.message:"Không lưu được phiếu.")}
  finally{setSaving(false)}
 }
 return <Modal title={receipt?`Sửa ${receipt.receiptCode}`:"Tạo phiếu vải về"} onClose={onClose}><div className="space-y-4 p-4">
  {error&&<Err x={error}/>}
  <div className="grid grid-cols-2 gap-3">
   <Field l="Mã phiếu"><input className={input} readOnly value={f.receiptCode} placeholder="NV-001-ddmmyyyy"/></Field>
   <Field l="Ngày nhận"><input type="date" className={input} value={f.receivedAt} onChange={e=>patch("receivedAt",e.target.value)}/></Field>
  </div>
  <Field l="Mẫu sử dụng"><select className={input} value={f.designSampleId} onChange={e=>chooseSample(e.target.value)}><option value="">Chưa gắn mẫu</option>{meta.samples.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
  <div className="grid grid-cols-2 gap-3">
   <Field l="Nhà cung cấp"><select className={input} value={f.supplierId} onChange={e=>patch("supplierId",e.target.value)}><option value="">Chưa chọn</option>{meta.suppliers.map(s=><option key={s.id} value={s.id}>{canSupplierIdentity?`${s.code||"NCC"} · ${s.name||""}`.trim():(s.code||"NCC")}</option>)}</select></Field>
   <Field l="Kho nhận"><select className={input} value={f.branchId} onChange={e=>patch("branchId",e.target.value)}><option value="">Không gắn</option>{meta.branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field l="Bảng vải">
    <select className={input} value={f.fabricBoardId||selectedBoard?.id||""} onChange={e=>chooseBoard(e.target.value)}>
     <option value="">Chưa liên kết bảng vải</option>
     {meta.boards.map(b=><option key={b.id} value={b.id}>{b.boardCode}{b.fabricCode?` · ${b.fabricCode}`:""}{b.name?` · ${b.name}`:""}</option>)}
    </select>
   </Field>
   <div className="grid grid-cols-2 gap-3">
    <Field l="Mã bảng vải"><input className={input} value={f.fabricBoardCode} onChange={e=>patch("fabricBoardCode",e.target.value)} placeholder="Có thể nhập tay"/></Field>
    <Field l="Mã vải"><input className={input} value={f.fabricCode} onChange={e=>patch("fabricCode",e.target.value)} placeholder="Có thể nhập tay"/></Field>
   </div>
   <Field l="Tên vải"><input className={input} value={f.fabricName} onChange={e=>patch("fabricName",e.target.value)}/></Field>
   <Field l="Mã lô"><input className={input} value={f.lotCode} onChange={e=>patch("lotCode",e.target.value)}/></Field>
   <Field l="Màu"><input className={input} value={f.colorName} onChange={e=>patch("colorName",e.target.value)} placeholder="VD: Xanh rêu, Kem"/></Field>
   <Field l="Mã màu">
    <input className={input} value={f.colorCode} onChange={e=>patch("colorCode",e.target.value)} onBlur={()=>patch("colorCode",colorCodes(f.colorCode))} placeholder="VD: 8, 9 → #8, #9"/>
    {!!allowedCodes.length&&<div className="mt-2 flex flex-wrap gap-2">{allowedCodes.map(c=><span key={c} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-black">{c}</span>)}</div>}
   </Field>
   {!!selectedBoard?.colors?.length&&<div className="col-span-2 rounded-2xl border p-3">
    <div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">Màu từ bảng vải · chọn nhiều</div>
    <div className="mt-2 flex flex-wrap gap-2">{selectedBoard.colors.map(c=>{const code=colorCode(c.code||c.name);const active=allowedCodes.includes(code);return <button type="button" key={c.id} onClick={()=>toggleBoardColor(c)} className={`rounded-full border px-3 py-2 text-xs font-black ${active?"bg-neutral-950 text-white":"bg-white"}`}>{c.name}{c.code?` ${colorCode(c.code)}`:""}</button>})}</div>
   </div>}
  </div>
  <div className="grid grid-cols-2 gap-3">
   <UnitInput l="NCC báo" unit="m" value={f.supplierDeclaredM} onChange={v=>patch("supplierDeclaredM",v)}/>
   <UnitInput l="NCC báo" unit="kg" value={f.supplierDeclaredKg} onChange={v=>patch("supplierDeclaredKg",v)}/>
   <UnitInput l="Thực nhận" unit="m" value={f.actualM} onChange={v=>patch("actualM",v)}/>
   <UnitInput l="Thực nhận" unit="kg" value={f.actualKg} onChange={v=>patch("actualKg",v)}/>
   <UnitInput l="GSM NCC" unit="GSM" value={f.expectedGsm} onChange={v=>patch("expectedGsm",v)}/>
   <Field l="Trạng thái"><select className={input} value={f.status} onChange={e=>patch("status",e.target.value)}>{STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
  </div>
  {canCostView&&<div className="space-y-3 rounded-3xl bg-amber-50 p-3"><div className="grid grid-cols-2 gap-3"><MoneyInput value={f.unitPrice} onChange={v=>patch("unitPrice",v)}/><Field l="Tiền tệ"><select className={input} value={f.priceCurrency} onChange={e=>patch("priceCurrency",e.target.value)}><option value="VND">VND · Việt Nam</option><option value="CNY">CNY · Nhân dân tệ</option></select></Field><Field l="Tính giá theo"><select className={input} value={f.priceUnit} onChange={e=>patch("priceUnit",e.target.value)}><option value="METER">Mét</option><option value="KG">Kg</option><option value="ROLL">Cây</option></select></Field>{f.priceCurrency==="CNY"&&<Field l="Tỷ giá 1 CNY"><div className="relative"><input inputMode="numeric" className={`${input} pr-12`} value={f.exchangeRateToVnd} onChange={e=>patch("exchangeRateToVnd",e.target.value.replace(/\D/g,""))} placeholder="VD: 3.650"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400">VND</span></div></Field>}</div>{f.priceCurrency==="CNY"&&num(f.unitPrice)>0&&num(f.exchangeRateToVnd)>0&&<div className="rounded-2xl bg-white p-3 text-sm"><div className="text-[10px] font-black uppercase text-neutral-400">Đơn giá quy đổi</div><div className="mt-1 text-lg font-black">{money(num(f.unitPrice)*num(f.exchangeRateToVnd))} / {f.priceUnit==="KG"?"kg":f.priceUnit==="ROLL"?"cây":"m"}</div></div>}</div>}

  <section className="rounded-3xl border p-3">
   <div className="flex items-center justify-between"><div><b className="text-sm">Chi tiết từng cây vải</b><div className="text-[11px] text-neutral-400">Màu, mã màu, số NCC báo, thực nhận và ảnh từng cây.</div></div><button onClick={()=>setRolls(x=>[...x,{rollCode:"",colorName:allowedColors.length===1?allowedColors[0].name:"",colorCode:allowedColors.length===1?allowedColors[0].code:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",defectNote:"",passed:true}])} className={smallBtn}>+ Cây</button></div>
   <div className="mt-3 space-y-3">{rolls.map((r,i)=><div key={r.id||i} className="rounded-3xl bg-neutral-50 p-3">
    <div className="flex items-center justify-between"><b>Cây {i+1}</b><button onClick={()=>{setRolls(x=>x.filter((_,j)=>j!==i));setFiles(c=>{const n={...c};delete n[i];return n})}} className="text-xs font-black text-red-600">Xoá</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2">
     <input className={input} value={r.rollCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,rollCode:e.target.value}:v))} placeholder={`Mã cây ${i+1}`}/>
     {allowedColors.length>0&&!manualRollColor[i]?<>
      <select className={input} value={r.colorCode||""} onChange={e=>{const picked=allowedColors.find(c=>c.code===e.target.value);setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:picked?.code||"",colorName:picked?.name||""}:v))}}>
       <option value="">Chọn màu cây</option>
       {allowedColors.map(c=><option key={c.code} value={c.code}>{c.name?`${c.name} · `:""}{c.code}</option>)}
      </select>
      <button type="button" onClick={()=>setManualRollColor(x=>({...x,[i]:true}))} className={smallBtn}>Nhập màu tay</button>
     </>:<>
      <input className={input} value={r.colorName||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorName:e.target.value}:v))} placeholder="Màu"/>
      <input className={input} value={r.colorCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:e.target.value}:v))} onBlur={()=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:colorCode(v.colorCode)}:v))} placeholder="# Mã màu"/>
     </>}
     <UnitInputBare unit="m NCC" value={r.supplierDeclaredM} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,supplierDeclaredM:v}:y))}/>
     <UnitInputBare unit="kg NCC" value={r.supplierDeclaredKg} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,supplierDeclaredKg:v}:y))}/>
     <UnitInputBare unit="m thực" value={r.actualM} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,actualM:v}:y))}/>
     <UnitInputBare unit="kg thực" value={r.actualKg} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,actualKg:v}:y))}/>
    </div>
    <div className="mt-2"><Field l="Ghi chú cây"><textarea className={`${input} min-h-20`} value={r.defectNote||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,defectNote:e.target.value}:v))} placeholder="VD: cây hơi lệch màu, đầu cây bẩn, thiếu mét..."/></Field></div>
    {canUpload&&<div className="mt-3"><div className="grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-xl bg-neutral-950 py-2.5 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-3 w-3"/>Chụp ảnh<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>e.target.files?.[0]&&setFiles(c=>({...c,[i]:[...(c[i]||[]),e.target.files![0]]}))}/></label><label className="cursor-pointer rounded-xl border py-2.5 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-3 w-3"/>Chọn ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFiles(c=>({...c,[i]:[...(c[i]||[]),...Array.from(e.target.files||[])]}))}/></label></div><div className="mt-2 flex gap-2 overflow-x-auto">{r.images?.map(im=><img key={im.id} src={asset(im.url)} className="h-14 w-14 rounded-xl object-cover"/>)}{files[i]?.map((file,j)=><div key={j} className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[10px] font-black text-emerald-700">Ảnh mới</div>)}</div></div>}
   </div>)}</div>
  </section>
  <Field l="Ghi chú"><textarea className={`${input} min-h-24`} value={f.note} onChange={e=>patch("note",e.target.value)}/></Field>
  <div className="rounded-2xl bg-neutral-50 p-3 text-sm"><b>Chênh lệch:</b> {num(f.actualM)-num(f.supplierDeclaredM)>0?"+":""}{fmt(num(f.actualM)-num(f.supplierDeclaredM))} m · {num(f.actualKg)-num(f.supplierDeclaredKg)>0?"+":""}{fmt(num(f.actualKg)-num(f.supplierDeclaredKg))} kg</div>
  <button disabled={saving} onClick={()=>void save()} className="w-full rounded-2xl bg-neutral-950 py-3.5 font-black text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu phiếu"}</button>
 </div></Modal>
}

function Detail({receipt:r,canSupplierIdentity,canCostView,onClose}:{receipt:Receipt;canSupplierIdentity:boolean;canCostView:boolean;onClose:()=>void}){
 return <Modal title={r.receiptCode} onClose={onClose}><div className="space-y-4 p-4">
  <div className="grid grid-cols-2 gap-2"><Mini l="Vải" v={r.fabricName||r.fabricCode||"—"}/><Mini l="Màu" v={`${r.colorName||"—"} ${r.colorCode||""}`}/><Mini l="NCC" v={canSupplierIdentity?`${r.supplier?.code||"NCC"} · ${r.supplier?.name||""}`.trim():(r.supplier?.code||"NCC")}/><Mini l="Kho" v={r.branch?.name||"—"}/><Mini l="Ngày nhận" v={dateText(r.receivedAt)}/><Mini l="Trạng thái" v={statusLabel(r.status)}/></div>
  {canCostView&&<div className="rounded-2xl bg-amber-50 p-3 text-sm"><b>Đơn giá:</b> {r.unitPrice?`${fmt(r.unitPrice,2)} ${r.priceCurrency||"VND"}`:"—"} / {r.priceUnit==="KG"?"kg":r.priceUnit==="ROLL"?"cây":"m"}{r.priceCurrency==="CNY"&&r.exchangeRateToVnd?<div className="mt-1 text-xs text-neutral-600">Tỷ giá: 1 CNY = {new Intl.NumberFormat("vi-VN").format(Number(r.exchangeRateToVnd))}đ · Quy đổi: <b>{money(r.unitPriceVnd||Number(r.unitPrice||0)*Number(r.exchangeRateToVnd))}</b></div>:null}</div>}
  <div><b className="text-sm">Các cây vải</b><div className="mt-2 space-y-2">{r.rolls?.map((x,i)=><div key={x.id||i} className="rounded-2xl bg-neutral-50 p-3"><div className="font-black">{x.rollCode||`Cây ${i+1}`} · {x.colorName||"—"} {x.colorCode||""}</div><div className="mt-1 text-xs text-neutral-500">NCC {fmt(x.supplierDeclaredM)}m / {fmt(x.supplierDeclaredKg)}kg · Thực {fmt(x.actualM)}m / {fmt(x.actualKg)}kg</div>{x.defectNote?<div className="mt-1 text-xs text-neutral-600">Ghi chú: {x.defectNote}</div>:null}{x.images?.length?<div className="mt-2 flex gap-2 overflow-x-auto">{x.images.map(im=><img key={im.id} src={asset(im.url)} className="h-20 w-20 rounded-xl object-cover"/>)}</div>:null}</div>)}</div></div>
  <div><b className="text-sm">Các lần cân GSM</b><div className="mt-2 space-y-2">{r.measurements?.map(m=><div key={m.id} className="flex justify-between rounded-xl bg-neutral-50 p-3 text-xs"><span>{m.positionLabel||"Mẫu"} · {fmt(m.weightGrams,4)}g</span><b>{fmt(m.gsm,2)} GSM</b></div>)}{!r.measurements?.length&&<Empty t="Chưa có phép đo GSM."/>}</div></div>
 </div></Modal>
}

function MeasurementForm({receipt,onClose,onSaved,canUpload}:{receipt:Receipt;onClose:()=>void;onSaved:()=>void;canUpload:boolean}){
 const [area,setArea]=useState("100"),[weight,setWeight]=useState(""),[position,setPosition]=useState(""),[imageUrl,setImageUrl]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const gsm=num(area)>0&&num(weight)>0?num(weight)*10000/num(area):0;
 async function pick(file?:File){if(!file)return;try{setImageUrl((await upload(file)).url)}catch(e){setError(e instanceof Error?e.message:"Không tải ảnh được.")}}
 async function save(){try{setSaving(true);await api(`/sample-fabric/fabric-receipts/${receipt.id}/measurements`,{method:"POST",body:JSON.stringify({areaCm2:num(area),weightGrams:num(weight),positionLabel:position,imageUrl:imageUrl||null})});if(imageUrl)await api(`/sample-fabric/fabric-receipts/${receipt.id}/images`,{method:"POST",body:JSON.stringify({type:"SCALE",url:imageUrl,caption:`Cân mẫu ${weight}g`})});onSaved()}catch(e){setError(e instanceof Error?e.message:"Không lưu được phép đo.")}finally{setSaving(false)}}
 return <Modal title={`Cân GSM · ${receipt.receiptCode}`} onClose={onClose}><div className="space-y-4 p-4">{error&&<Err x={error}/>}<div className="grid grid-cols-2 gap-3"><UnitInput l="Diện tích mẫu" unit="cm²" value={area} onChange={setArea}/><UnitInput l="Cân nặng" unit="g" value={weight} onChange={setWeight}/></div><Field l="Vị trí lấy mẫu"><input className={input} value={position} onChange={e=>setPosition(e.target.value)} placeholder="Đầu cây / giữa cây / cuối cây"/></Field><div className="rounded-3xl bg-neutral-950 p-4 text-white"><div className="text-xs text-neutral-400">GSM tự tính</div><div className="mt-1 text-3xl font-black">{gsm?fmt(gsm,2):"—"}</div></div>{canUpload&&<div className="grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-xl bg-neutral-950 py-3 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-3 w-3"/>Chụp<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>void pick(e.target.files?.[0])}/></label><label className="cursor-pointer rounded-xl border py-3 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-3 w-3"/>Chọn ảnh<input type="file" accept="image/*" className="hidden" onChange={e=>void pick(e.target.files?.[0])}/></label></div>}{imageUrl&&<img src={asset(imageUrl)} className="h-40 w-full rounded-2xl object-cover"/>}<div><b className="text-sm">Lần đo trước</b><div className="mt-2 space-y-2">{receipt.measurements?.map(m=><div key={m.id} className="flex justify-between rounded-xl bg-neutral-50 p-3 text-xs"><span>{m.positionLabel||"Mẫu"} · {fmt(m.weightGrams,4)}g</span><b>{fmt(m.gsm,2)} GSM</b></div>)}</div></div><button disabled={saving||!gsm} onClick={()=>void save()} className="w-full rounded-2xl bg-neutral-950 py-3.5 font-black text-white disabled:opacity-40">Lưu phép đo</button></div></Modal>
}

function MoneyInput({value,onChange}:{value:any;onChange:(v:string)=>void}){return <Field l="Đơn giá"><div className="relative"><input inputMode="numeric" className={`${input} pr-9`} value={value===""?"":Number(value||0).toLocaleString("vi-VN")} onChange={e=>onChange(e.target.value.replace(/\D/g,""))}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">đ</span></div></Field>}
function UnitInput({l,unit,value,onChange}:{l:string;unit:string;value:any;onChange:(v:string)=>void}){return <Field l={l}><UnitInputBare unit={unit} value={value} onChange={onChange}/></Field>}
function UnitInputBare({unit,value,onChange}:{unit:string;value:any;onChange:(v:string)=>void}){return <div className="relative"><input inputMode="decimal" className={`${input} pr-14`} value={String(value??"").replace(".",",")} onChange={e=>onChange(e.target.value.replace(/[^0-9,.-]/g,""))}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400">{unit}</span></div>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:any}){
 const [vp,setVp]=useState<{top:number;height:number}>({top:0,height:0});
 useEffect(()=>{
  const vv=window.visualViewport;
  const update=()=>setVp({top:vv?.offsetTop||0,height:vv?.height||window.innerHeight});
  update();vv?.addEventListener("resize",update);vv?.addEventListener("scroll",update);
  const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  return()=>{vv?.removeEventListener("resize",update);vv?.removeEventListener("scroll",update);document.body.style.overflow=oldOverflow;resetMobileViewport()};
 },[]);
 const close=()=>{resetMobileViewport();setTimeout(onClose,70)};
 return <div className="fixed left-0 right-0 z-[80] overflow-hidden bg-black/45" style={{top:vp.top,height:vp.height||"100dvh"}}>
  <div className="h-full overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
   <div className="mx-auto w-full max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
    <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white p-4"><h2 className="font-black">{title}</h2><button onClick={close} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button></div>
    <div className="pb-[calc(18px+env(safe-area-inset-bottom))]">{children}</div>
   </div>
  </div>
 </div>
}
function Field({l,children}:{l:string;children:any}){return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-neutral-400">{l}</span>{children}</label>}
function Stat({l,v}:{l:string;v:string}){return <div className="rounded-2xl bg-white p-3"><div className="text-[10px] font-black text-neutral-400">{l}</div><div className="mt-1 text-lg font-black">{v}</div></div>}
function Mini({l,v}:{l:string;v:any}){return <div className="rounded-xl bg-neutral-50 p-2.5"><div className="text-[9px] font-black uppercase text-neutral-400">{l}</div><div className="mt-1 text-xs font-black">{v}</div></div>}
function Badge({children}:{children:any}){return <span className="shrink-0 rounded-full border bg-neutral-50 px-2.5 py-1 text-[10px] font-black">{children}</span>}
function Empty({t}:{t:string}){return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-neutral-400">{t}</div>}
function Err({x}:{x:string}){return <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{x}</div>}
const input="w-full min-w-0 rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-neutral-950";
const smallBtn="shrink-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-black";
