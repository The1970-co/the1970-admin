"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
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
type Roll={id?:string;rollCode?:string|null;colorName?:string|null;colorCode?:string|null;supplierDeclaredM?:any;supplierDeclaredKg?:any;actualM?:any;actualKg?:any;passed?:boolean;images?:Array<{id:string;url:string;caption?:string|null}>};
type Measurement={id:string;areaCm2:number;weightGrams:number;gsm:number;positionLabel?:string|null;imageUrl?:string|null;measuredByName?:string|null;createdAt:string};
type Receipt={
 id:string;receiptCode:string;designSampleId?:string|null;designSample?:Sample|null;supplierId?:string|null;supplier?:Supplier|null;branchId?:string|null;branch?:Branch|null;
 fabricBoardCode?:string|null;fabricCode?:string|null;fabricName?:string|null;colorName?:string|null;colorCode?:string|null;lotCode?:string|null;
 supplierDeclaredM?:number|null;supplierDeclaredKg?:number|null;actualM?:number|null;actualKg?:number|null;rollCount:number;
 unitPrice?:number|null;priceUnit:"METER"|"KG"|"ROLL";expectedGsm?:number|null;measuredGsm?:number|null;varianceApproved:boolean;status:string;
 receivedAt?:string|null;completedAt?:string|null;note?:string|null;rolls:Roll[];measurements:Measurement[];
 images?:Array<{id:string;type:string;url:string;caption?:string|null}>;
};
type Meta={suppliers:Supplier[];branches:Branch[];samples:Sample[]};

const STATUSES=[["DRAFT","Nháp"],["RECEIVING","Đang nhận"],["INSPECTING","Đang kiểm"],["COMPLETED","Hoàn tất"],["CANCELLED","Đã huỷ"]] as const;

async function api<T=any>(p:string,i:RequestInit={}){return apiJson<T>(p,{...i,redirectOnUnauthorized:false} as any)}
async function upload(file:File){const fd=new FormData();fd.append("file",file);return api<{url:string}>("/sample-fabric/fabric-receipts/upload",{method:"POST",body:fd})}
function asset(u?:string|null){if(!u)return "";return /^https?:\/\//.test(u)?u:`${API_BASE}${u.startsWith("/")?"":"/"}${u}`}
function num(v:any){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:0}
function fmt(v:any,d=3){return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(num(v))}
function money(v:any){return new Intl.NumberFormat("vi-VN").format(num(v))+"đ"}
function colorCode(v:any){const raw=String(v||"").trim();return raw?`#${raw.replace(/^#+/,"")}`:""}
function dateText(v?:string|null){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("vi-VN")}
function statusLabel(v:string){return STATUSES.find(x=>x[0]===v)?.[1]||v}
function roles(u:any){return [...(Array.isArray(u?.roles)?u.roles:[]),u?.role,u?.roleCode,u?.staffRole].map(x=>String(x||"").toLowerCase()).filter(Boolean)}
function owner(u:any){const r=roles(u);return r.includes("owner")||r.includes("admin")}

export default function Page(){
 const [rows,setRows]=useState<Receipt[]>([]);
 const [meta,setMeta]=useState<Meta>({suppliers:[],branches:[],samples:[]});
 const [q,setQ]=useState(""),[status,setStatus]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [editing,setEditing]=useState<Receipt|null|undefined>(undefined);
 const [measure,setMeasure]=useState<Receipt|null>(null);
 const [detail,setDetail]=useState<Receipt|null>(null);
 const [user,setUser]=useState<any>(null);
 const keys=useMemo(()=>getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId),[user]);
 const can=(k:string)=>owner(user)||keys.includes("*")||keys.includes(k);
 const admin=owner(user);

 async function load(){
  try{
   setLoading(true);setError("");
   const params=new URLSearchParams(); if(q.trim())params.set("q",q.trim()); if(status)params.set("status",status);
   const [r,m]=await Promise.all([
    api<Receipt[]>(`/sample-fabric/fabric-receipts${params.toString()?`?${params}`:""}`),
    api<Meta>("/sample-fabric/fabric-receipts/meta")
   ]);
   setRows(Array.isArray(r)?r:[]);
   setMeta({suppliers:Array.isArray(m.suppliers)?m.suppliers:[],branches:Array.isArray(m.branches)?m.branches:[],samples:Array.isArray(m.samples)?m.samples:[]});
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

 return <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(112px+env(safe-area-inset-bottom))] text-neutral-950">
  <div className="mx-auto max-w-md">
   <header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[calc(16px+env(safe-area-inset-top))] backdrop-blur">
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

  {editing!==undefined&&<ReceiptForm receipt={editing} meta={meta} admin={admin} canCostView={can("fabric_receipt.cost.view")||can("fabric_receipt.cost.edit")} canCostEdit={can("fabric_receipt.cost.edit")} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);await load()}}/>}
  {measure&&<MeasurementForm receipt={measure} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setMeasure(null)} onSaved={async()=>{setMeasure(null);await load()}}/>}
  {detail&&<Detail receipt={detail} admin={admin} canCostView={can("fabric_receipt.cost.view")||can("fabric_receipt.cost.edit")} onClose={()=>setDetail(null)}/>}
  <MobileBottomNav/>
 </main>
}

function ReceiptForm({receipt,meta,admin,canCostView,canCostEdit,canUpload,onClose,onSaved}:{receipt:Receipt|null;meta:Meta;admin:boolean;canCostView:boolean;canCostEdit:boolean;canUpload:boolean;onClose:()=>void;onSaved:()=>void}){
 const [f,setF]=useState<any>({receiptCode:receipt?.receiptCode||"",designSampleId:receipt?.designSampleId||"",supplierId:receipt?.supplierId||"",branchId:receipt?.branchId||"",fabricBoardCode:receipt?.fabricBoardCode||"",fabricCode:receipt?.fabricCode||"",fabricName:receipt?.fabricName||"",colorName:receipt?.colorName||"",colorCode:receipt?.colorCode||"",lotCode:receipt?.lotCode||"",supplierDeclaredM:receipt?.supplierDeclaredM??"",supplierDeclaredKg:receipt?.supplierDeclaredKg??"",actualM:receipt?.actualM??"",actualKg:receipt?.actualKg??"",unitPrice:receipt?.unitPrice??"",priceUnit:receipt?.priceUnit||"METER",expectedGsm:receipt?.expectedGsm??"",status:receipt?.status||"RECEIVING",receivedAt:receipt?.receivedAt?receipt.receivedAt.slice(0,10):new Date().toISOString().slice(0,10),note:receipt?.note||""});
 const [rolls,setRolls]=useState<Roll[]>(receipt?.rolls?.length?receipt.rolls:[{rollCode:"",colorName:"",colorCode:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",passed:true}]);
 const [files,setFiles]=useState<Record<number,File[]>>({});
 const [saving,setSaving]=useState(false),[error,setError]=useState("");
 const patch=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
 useEffect(()=>{if(receipt)return;const p=new URLSearchParams();if(f.receivedAt)p.set("receivedAt",f.receivedAt);api<{code:string}>(`/sample-fabric/fabric-receipts/next-code?${p}`).then(r=>patch("receiptCode",r.code)).catch(()=>{})},[f.receivedAt,receipt?.id]);
 function chooseSample(id:string){patch("designSampleId",id);const s=meta.samples.find(x=>x.id===id);if(s){if(!f.fabricBoardCode)patch("fabricBoardCode",s.fabricBoardCode||"");if(!f.fabricCode)patch("fabricCode",s.fabricCode||"")}}
 async function save(){
  try{
   setSaving(true);setError("");
   const normalized=rolls.map(r=>({...r,colorCode:colorCode(r.colorCode)||null}));
   const saved=await api<Receipt>(receipt?`/sample-fabric/fabric-receipts/${receipt.id}`:"/sample-fabric/fabric-receipts",{method:receipt?"PATCH":"POST",body:JSON.stringify({...f,colorCode:colorCode(f.colorCode)||null,unitPrice:undefined,priceUnit:undefined,rollCount:normalized.length,rolls:normalized})});
   if(canCostEdit&&f.unitPrice!=="")await api(`/sample-fabric/fabric-receipts/${saved.id}/cost`,{method:"PATCH",body:JSON.stringify({unitPrice:num(f.unitPrice),priceUnit:f.priceUnit})});
   for(const [ix,arr] of Object.entries(files)){const i=Number(ix),server=saved.rolls?.[i];if(!server?.id)continue;for(const file of arr){const u=await upload(file);await api(`/sample-fabric/fabric-receipts/${saved.id}/images`,{method:"POST",body:JSON.stringify({rollId:server.id,type:"FABRIC",url:u.url,caption:`Ảnh ${server.rollCode||`cây ${i+1}`}`})})}}
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();requestAnimationFrame(onSaved);
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
   <Field l="Nhà cung cấp"><select className={input} value={f.supplierId} onChange={e=>patch("supplierId",e.target.value)}><option value="">Chưa chọn</option>{meta.suppliers.map(s=><option key={s.id} value={s.id}>{admin?(s.name||s.code):(s.code||"NCC")}</option>)}</select></Field>
   <Field l="Kho nhận"><select className={input} value={f.branchId} onChange={e=>patch("branchId",e.target.value)}><option value="">Không gắn</option>{meta.branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field l="Mã bảng vải"><input className={input} value={f.fabricBoardCode} onChange={e=>patch("fabricBoardCode",e.target.value)}/></Field>
   <Field l="Mã vải"><input className={input} value={f.fabricCode} onChange={e=>patch("fabricCode",e.target.value)}/></Field>
   <Field l="Tên vải"><input className={input} value={f.fabricName} onChange={e=>patch("fabricName",e.target.value)}/></Field>
   <Field l="Mã lô"><input className={input} value={f.lotCode} onChange={e=>patch("lotCode",e.target.value)}/></Field>
   <Field l="Màu"><input className={input} value={f.colorName} onChange={e=>patch("colorName",e.target.value)}/></Field>
   <Field l="Mã màu"><input className={input} value={f.colorCode} onChange={e=>patch("colorCode",colorCode(e.target.value))} placeholder="#2"/></Field>
  </div>
  <div className="grid grid-cols-2 gap-3">
   <UnitInput l="NCC báo" unit="m" value={f.supplierDeclaredM} onChange={v=>patch("supplierDeclaredM",v)}/>
   <UnitInput l="NCC báo" unit="kg" value={f.supplierDeclaredKg} onChange={v=>patch("supplierDeclaredKg",v)}/>
   <UnitInput l="Thực nhận" unit="m" value={f.actualM} onChange={v=>patch("actualM",v)}/>
   <UnitInput l="Thực nhận" unit="kg" value={f.actualKg} onChange={v=>patch("actualKg",v)}/>
   <UnitInput l="GSM NCC" unit="GSM" value={f.expectedGsm} onChange={v=>patch("expectedGsm",v)}/>
   <Field l="Trạng thái"><select className={input} value={f.status} onChange={e=>patch("status",e.target.value)}>{STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
  </div>
  {canCostView&&<div className="grid grid-cols-2 gap-3 rounded-3xl bg-amber-50 p-3"><MoneyInput value={f.unitPrice} onChange={v=>patch("unitPrice",v)}/><Field l="Tính giá theo"><select className={input} value={f.priceUnit} onChange={e=>patch("priceUnit",e.target.value)}><option value="METER">Mét</option><option value="KG">Kg</option><option value="ROLL">Cây</option></select></Field></div>}

  <section className="rounded-3xl border p-3">
   <div className="flex items-center justify-between"><div><b className="text-sm">Chi tiết từng cây vải</b><div className="text-[11px] text-neutral-400">Màu, mã màu, số NCC báo, thực nhận và ảnh từng cây.</div></div><button onClick={()=>setRolls(x=>[...x,{rollCode:"",colorName:f.colorName||"",colorCode:colorCode(f.colorCode)||"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",passed:true}])} className={smallBtn}>+ Cây</button></div>
   <div className="mt-3 space-y-3">{rolls.map((r,i)=><div key={r.id||i} className="rounded-3xl bg-neutral-50 p-3">
    <div className="flex items-center justify-between"><b>Cây {i+1}</b><button onClick={()=>{setRolls(x=>x.filter((_,j)=>j!==i));setFiles(c=>{const n={...c};delete n[i];return n})}} className="text-xs font-black text-red-600">Xoá</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2">
     <input className={input} value={r.rollCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,rollCode:e.target.value}:v))} placeholder={`Mã cây ${i+1}`}/>
     <input className={input} value={r.colorName||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorName:e.target.value}:v))} placeholder="Màu"/>
     <input className={input} value={r.colorCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:colorCode(e.target.value)}:v))} placeholder="# Mã màu"/>
     <UnitInputBare unit="m NCC" value={r.supplierDeclaredM} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,supplierDeclaredM:v}:y))}/>
     <UnitInputBare unit="kg NCC" value={r.supplierDeclaredKg} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,supplierDeclaredKg:v}:y))}/>
     <UnitInputBare unit="m thực" value={r.actualM} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,actualM:v}:y))}/>
     <UnitInputBare unit="kg thực" value={r.actualKg} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,actualKg:v}:y))}/>
    </div>
    {canUpload&&<div className="mt-3"><div className="grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-xl bg-neutral-950 py-2.5 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-3 w-3"/>Chụp ảnh<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>e.target.files?.[0]&&setFiles(c=>({...c,[i]:[...(c[i]||[]),e.target.files![0]]}))}/></label><label className="cursor-pointer rounded-xl border py-2.5 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-3 w-3"/>Chọn ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFiles(c=>({...c,[i]:[...(c[i]||[]),...Array.from(e.target.files||[])]}))}/></label></div><div className="mt-2 flex gap-2 overflow-x-auto">{r.images?.map(im=><img key={im.id} src={asset(im.url)} className="h-14 w-14 rounded-xl object-cover"/>)}{files[i]?.map((file,j)=><div key={j} className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[10px] font-black text-emerald-700">Ảnh mới</div>)}</div></div>}
   </div>)}</div>
  </section>
  <Field l="Ghi chú"><textarea className={`${input} min-h-24`} value={f.note} onChange={e=>patch("note",e.target.value)}/></Field>
  <div className="rounded-2xl bg-neutral-50 p-3 text-sm"><b>Chênh lệch:</b> {num(f.actualM)-num(f.supplierDeclaredM)>0?"+":""}{fmt(num(f.actualM)-num(f.supplierDeclaredM))} m · {num(f.actualKg)-num(f.supplierDeclaredKg)>0?"+":""}{fmt(num(f.actualKg)-num(f.supplierDeclaredKg))} kg</div>
  <button disabled={saving} onClick={()=>void save()} className="w-full rounded-2xl bg-neutral-950 py-3.5 font-black text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu phiếu"}</button>
 </div></Modal>
}

function Detail({receipt:r,admin,canCostView,onClose}:{receipt:Receipt;admin:boolean;canCostView:boolean;onClose:()=>void}){
 return <Modal title={r.receiptCode} onClose={onClose}><div className="space-y-4 p-4">
  <div className="grid grid-cols-2 gap-2"><Mini l="Vải" v={r.fabricName||r.fabricCode||"—"}/><Mini l="Màu" v={`${r.colorName||"—"} ${r.colorCode||""}`}/><Mini l="NCC" v={admin?(r.supplier?.name||r.supplier?.code||"—"):(r.supplier?.code||"NCC")}/><Mini l="Kho" v={r.branch?.name||"—"}/><Mini l="Ngày nhận" v={dateText(r.receivedAt)}/><Mini l="Trạng thái" v={statusLabel(r.status)}/></div>
  {canCostView&&<div className="rounded-2xl bg-amber-50 p-3 text-sm"><b>Đơn giá:</b> {r.unitPrice?money(r.unitPrice):"—"} / {r.priceUnit==="KG"?"kg":r.priceUnit==="ROLL"?"cây":"m"}</div>}
  <div><b className="text-sm">Các cây vải</b><div className="mt-2 space-y-2">{r.rolls?.map((x,i)=><div key={x.id||i} className="rounded-2xl bg-neutral-50 p-3"><div className="font-black">{x.rollCode||`Cây ${i+1}`} · {x.colorName||"—"} {x.colorCode||""}</div><div className="mt-1 text-xs text-neutral-500">NCC {fmt(x.supplierDeclaredM)}m / {fmt(x.supplierDeclaredKg)}kg · Thực {fmt(x.actualM)}m / {fmt(x.actualKg)}kg</div>{x.images?.length?<div className="mt-2 flex gap-2 overflow-x-auto">{x.images.map(im=><img key={im.id} src={asset(im.url)} className="h-20 w-20 rounded-xl object-cover"/>)}</div>:null}</div>)}</div></div>
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
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:any}){return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3"><div className="mx-auto my-3 max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl"><div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white p-4"><h2 className="font-black">{title}</h2><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button></div>{children}</div></div>}
function Field({l,children}:{l:string;children:any}){return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-neutral-400">{l}</span>{children}</label>}
function Stat({l,v}:{l:string;v:string}){return <div className="rounded-2xl bg-white p-3"><div className="text-[10px] font-black text-neutral-400">{l}</div><div className="mt-1 text-lg font-black">{v}</div></div>}
function Mini({l,v}:{l:string;v:any}){return <div className="rounded-xl bg-neutral-50 p-2.5"><div className="text-[9px] font-black uppercase text-neutral-400">{l}</div><div className="mt-1 text-xs font-black">{v}</div></div>}
function Badge({children}:{children:any}){return <span className="shrink-0 rounded-full border bg-neutral-50 px-2.5 py-1 text-[10px] font-black">{children}</span>}
function Empty({t}:{t:string}){return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-neutral-400">{t}</div>}
function Err({x}:{x:string}){return <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{x}</div>}
const input="w-full min-w-0 rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-neutral-950";
const smallBtn="shrink-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-black";
