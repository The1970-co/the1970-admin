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
type Staff={id:string;code:string;name:string;branchId?:string|null};
type Sample={id:string;code:string;name:string;year?:number;fabricBoardCode?:string|null;fabricCode?:string|null};
type Roll={id?:string;sortOrder?:number|null;fabricCode?:string|null;rollCode?:string|null;colorName?:string|null;colorCode?:string|null;supplierDeclaredM?:any;supplierDeclaredKg?:any;actualM?:any;actualKg?:any;unitPriceCny?:any;priceUnit?:"METER"|"KG"|"ROLL"|null;lineAmountCny?:number|null;lineAmountVnd?:number|null;defectNote?:string|null;passed?:boolean;images?:Array<{id:string;url:string;caption?:string|null}>};
type FabricCostGroup={id?:string;fabricCode:string;chinaShippingCny?:any;vietnamShippingRateVndPerKg?:any;vietnamShippingVnd?:any;note?:string|null};
type FabricColorMap={id?:string;fabricCode:string;colorName:string;colorCode?:string|null};
type ReceiptCostSummary={exchangeRateToVnd:number;goodsCny:number;goodsVnd:number;chinaShippingCny:number;chinaShippingVnd:number;vietnamShippingVnd:number;totalShippingVnd:number;grandTotalVnd:number};
type Measurement={id:string;areaCm2:number;weightGrams:number;gsm:number;positionLabel?:string|null;imageUrl?:string|null;measuredByName?:string|null;createdAt:string};
type Receipt={
 id:string;receiptCode:string;designSampleId?:string|null;designSample?:Sample|null;supplierId?:string|null;supplier?:Supplier|null;branchId?:string|null;branch?:Branch|null;
 fabricBoardCode?:string|null;fabricCode?:string|null;fabricName?:string|null;colorName?:string|null;colorCode?:string|null;lotCode?:string|null;
 supplierDeclaredM?:number|null;supplierDeclaredKg?:number|null;actualM?:number|null;actualKg?:number|null;rollCount:number;
 unitPrice?:number|null;priceUnit:"METER"|"KG"|"ROLL";priceCurrency?:string|null;exchangeRateToVnd?:number|null;unitPriceVnd?:number|null;expectedGsm?:number|null;measuredGsm?:number|null;varianceApproved:boolean;status:string;
 receivedAt?:string|null;completedAt?:string|null;receivedByStaffId?:string|null;receivedByName?:string|null;note?:string|null;rolls:Roll[];measurements:Measurement[];fabricCosts?:FabricCostGroup[];colorMaps?:FabricColorMap[];costSummary?:ReceiptCostSummary|null;
 images?:Array<{id:string;type:string;url:string;caption?:string|null}>;
};
type BoardColor={id:string;name:string;code?:string|null;imageUrl?:string|null};
type FabricBoard={id:string;boardCode:string;fabricCode?:string|null;name?:string|null;supplierId?:string|null;expectedGsm?:number|null;colors?:BoardColor[]};
type Meta={suppliers:Supplier[];branches:Branch[];staff:Staff[];samples:Sample[];boards:FabricBoard[]};

const STATUSES=[["DRAFT","Nháp"],["RECEIVING","Đang nhận"],["INSPECTING","Đang kiểm"],["COMPLETED","Hoàn tất"],["CANCELLED","Đã huỷ"]] as const;

async function api<T=any>(p:string,i:RequestInit={}){return apiJson<T>(p,{...i,redirectOnUnauthorized:false} as any)}
async function upload(file:File){const fd=new FormData();fd.append("file",file);return api<{url:string}>("/sample-fabric/fabric-receipts/upload",{method:"POST",body:fd})}
function asset(u?:string|null){if(!u)return "";return /^https?:\/\//.test(u)?u:`${API_BASE}${u.startsWith("/")?"":"/"}${u}`}
function num(v:any){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:0}
function fmt(v:any,d=3){return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(num(v))}
function money(v:any){return new Intl.NumberFormat("vi-VN").format(num(v))+"đ"}
function rollCostQty(r:Roll){const u=r.priceUnit||"METER";if(u==="ROLL")return 1;if(u==="KG")return num(r.actualKg)||num(r.supplierDeclaredKg);return num(r.actualM)||num(r.supplierDeclaredM)}
function rollAmountCny(r:Roll){return rollCostQty(r)*num(r.unitPriceCny)}
function moneyInput(v:any){const raw=String(v??"").replace(/\D/g,"");return raw?new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(Number(raw)):""}
function moneyRaw(v:string){return v.replace(/\D/g,"")}
function colorCode(v:any){const raw=String(v||"").trim();return raw?`#${raw.replace(/^#+/,"")}`:""}
function colorCodes(v:any){
 return Array.from(new Set(String(v||"").split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean).map(x=>colorCode(x)))).join(", ");
}
function colorCodeList(v:any){return colorCodes(v).split(",").map(x=>x.trim()).filter(Boolean)}
function colorNameList(v:any){return String(v||"").split(",").map(x=>x.trim()).filter(Boolean)}
function fabricCodeList(v:any){return Array.from(new Set(String(v||"").split(/[,;\n|]+/).map(x=>x.trim().toUpperCase()).filter(Boolean)))}
function fabricCodesText(v:any){return fabricCodeList(v).join(", ")}
function dateText(v?:string|null){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("vi-VN")}
function statusLabel(v:string){return STATUSES.find(x=>x[0]===v)?.[1]||v}
function roles(u:any){return [...(Array.isArray(u?.roles)?u.roles:[]),u?.role,u?.roleCode,u?.staffRole].map(x=>String(x||"").toLowerCase()).filter(Boolean)}
function owner(u:any){const r=roles(u);return r.includes("owner")||r.includes("admin")}

function receiptFabricCodes(r:Receipt){
 return Array.from(new Set([
  ...fabricCodeList(r.fabricCode),
  ...(Array.isArray(r.rolls)?r.rolls.map(x=>String(x.fabricCode||"").trim().toUpperCase()).filter(Boolean):[]),
  ...(Array.isArray(r.colorMaps)?r.colorMaps.map(x=>String(x.fabricCode||"").trim().toUpperCase()).filter(Boolean):[]),
 ]));
}
function receiptMatchesField(r:Receipt,q:string,field:string){
 const k=q.trim().toLocaleLowerCase("vi-VN");if(!k)return true;
 const rolls=Array.isArray(r.rolls)?r.rolls:[];
 const values:Record<string,string[]>={
  RECEIPT:[r.receiptCode],
  FABRIC:[r.fabricCode,...receiptFabricCodes(r)],
  COLOR:[r.colorName,r.colorCode,...rolls.flatMap(x=>[x.colorName,x.colorCode])],
  ROLL:rolls.map(x=>x.rollCode),
  SUPPLIER:[r.supplier?.code,r.supplier?.name],
  NAME:[r.fabricName],
  ALL:[r.receiptCode,r.fabricCode,r.fabricName,r.colorName,r.colorCode,r.lotCode,r.supplier?.code,r.supplier?.name,...receiptFabricCodes(r),...rolls.flatMap(x=>[x.rollCode,x.fabricCode,x.colorName,x.colorCode])],
 };
 return (values[field]||values.ALL).some(v=>String(v||"").toLocaleLowerCase("vi-VN").includes(k));
}

function resetMobileViewport(){
 if(typeof window==="undefined")return;
 if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
 const y=window.scrollY;
 const reset=()=>{window.scrollTo({top:y,left:0,behavior:"auto"});document.documentElement.scrollLeft=0;document.body.scrollLeft=0};
 requestAnimationFrame(reset);setTimeout(reset,80);setTimeout(reset,220);
}

export default function Page(){
 const [rows,setRows]=useState<Receipt[]>([]);
 const [meta,setMeta]=useState<Meta>({suppliers:[],branches:[],staff:[],samples:[],boards:[]});
 const [q,setQ]=useState(""),[status,setStatus]=useState(""),[searchField,setSearchField]=useState("ALL"),[busyId,setBusyId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [editing,setEditing]=useState<Receipt|null|undefined>(undefined);
 const [measure,setMeasure]=useState<Receipt|null>(null);
 const [detail,setDetail]=useState<Receipt|null>(null);
 const [user,setUser]=useState<any>(null);
 const keys=useMemo(()=>getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId),[user]);
 const can=(k:string)=>owner(user)||keys.includes("*")||keys.includes(k);
 const canSupplierIdentity=can("fabric_receipt.supplier_identity.view");
 const canCostView=can("fabric_receipt.cost.view")||can("fabric_receipt.cost.edit");
 const canFabricBoardLink=can("fabric_receipt.fabric_board_link");
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
   setMeta({suppliers:Array.isArray(m.suppliers)?m.suppliers:[],branches:Array.isArray(m.branches)?m.branches:[],staff:Array.isArray((m as any).staff)?(m as any).staff:[],samples:Array.isArray(m.samples)?m.samples:[],boards:Array.isArray((m as any).boards)?(m as any).boards:[]});
  }catch(e){setError(e instanceof Error?e.message:"Không tải được vải về.")}
  finally{setLoading(false)}
 }
 useEffect(()=>{setUser(getCurrentUserFromStorage());void load()},[]);
 const visibleRows=useMemo(()=>rows.filter(r=>receiptMatchesField(r,q,searchField)),[rows,q,searchField]);
 const totals=useMemo(()=>({
  m:visibleRows.reduce((s,x)=>s+num(x.actualM),0),
  kg:visibleRows.reduce((s,x)=>s+num(x.actualKg),0),
  dm:visibleRows.reduce((s,x)=>s+num(x.actualM)-num(x.supplierDeclaredM),0),
  dkg:visibleRows.reduce((s,x)=>s+num(x.actualKg)-num(x.supplierDeclaredKg),0),
 }),[visibleRows]);

 async function action(r:Receipt,path:string){
  try{setError("");await api(`/sample-fabric/fabric-receipts/${r.id}/${path}`,{method:"POST",body:"{}"});await load()}
  catch(e){setError(e instanceof Error?e.message:"Không cập nhật được phiếu.")}
 }
 async function cancelReceipt(r:Receipt){
  if(!window.confirm(`Huỷ phiếu ${r.receiptCode}? Phiếu vẫn được giữ lại để tra cứu.`))return;
  try{setBusyId(r.id);setError("");await api(`/sample-fabric/fabric-receipts/${r.id}/cancel`,{method:"POST",body:"{}"});if(detail?.id===r.id)setDetail(null);await load()}
  catch(e){setError(e instanceof Error?e.message:"Không huỷ được phiếu.")}
  finally{setBusyId(null)}
 }
 async function deleteReceipt(r:Receipt){
  if(!window.confirm(`XOÁ phiếu ${r.receiptCode}? Dữ liệu phiếu sẽ bị xoá và không thể hoàn tác.`))return;
  try{setBusyId(r.id);setError("");await api(`/sample-fabric/fabric-receipts/${r.id}`,{method:"DELETE"});if(detail?.id===r.id)setDetail(null);await load()}
  catch(e){setError(e instanceof Error?e.message:"Không xoá được phiếu.")}
  finally{setBusyId(null)}
 }

 if(user&&!canOpenPage)return <main className="min-h-[100dvh] bg-neutral-100 p-6 pt-[max(56px,calc(env(safe-area-inset-top)+24px))]"><div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center"><div className="text-lg font-black">Không có quyền Vải về</div><div className="mt-2 text-sm text-neutral-500">Bật quyền màn App và fabric_receipt.view trong Phân quyền.</div></div></main>;
 return <main className="min-h-screen bg-neutral-100 text-neutral-950" style={{minHeight:"100svh"}}>
  <div className="mx-auto max-w-md">
   <header className="border-b bg-white px-4 pb-4 pt-[54px]">
    <div className="flex items-center justify-between gap-2">
     <div className="flex items-center gap-3"><Link href="/mobile/production" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Nguyên liệu</div><h1 className="text-xl font-black">Vải về</h1></div></div>
     <div className="flex gap-2"><button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>{can("fabric_receipt.create")&&<button onClick={()=>setEditing(null)} className="rounded-2xl bg-neutral-950 px-3 py-2.5 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Nhận vải</button>}</div>
    </div>
    <div className="mt-3 grid grid-cols-[1fr_112px] gap-2"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400"/><input className={`${input} pl-10`} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load()}} placeholder="Nhập từ khoá..."/></div><select className={input} value={status} onChange={e=>{setStatus(e.target.value);setTimeout(()=>void load(),0)}}><option value="">Tất cả</option>{STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></div>
    <select className={`${input} mt-2`} value={searchField} onChange={e=>setSearchField(e.target.value)}>
     <option value="ALL">Tìm tất cả trường</option><option value="RECEIPT">Mã phiếu</option><option value="FABRIC">Mã vải</option><option value="COLOR">Tên màu / mã màu</option><option value="ROLL">Mã cây vải</option><option value="SUPPLIER">Nhà cung cấp</option><option value="NAME">Tên / chất liệu vải</option>
    </select>
   </header>

   <div className="space-y-4 p-4">
    {error&&<Err x={error}/>}
    <div className="grid grid-cols-2 gap-2"><Stat l="Mét thực nhận" v={`${fmt(totals.m)} m`}/><Stat l="Kg thực nhận" v={`${fmt(totals.kg)} kg`}/><Stat l="Lệch mét" v={`${totals.dm>0?"+":""}${fmt(totals.dm)} m`}/><Stat l="Lệch kg" v={`${totals.dkg>0?"+":""}${fmt(totals.dkg)} kg`}/></div>
    {loading?<Empty t="Đang tải dữ liệu..."/>:visibleRows.map(r=>{
      const dm=num(r.actualM)-num(r.supplierDeclaredM),dkg=num(r.actualKg)-num(r.supplierDeclaredKg);
      return <article key={r.id} className="overflow-hidden rounded-[28px] bg-white shadow-sm">
       <button onClick={()=>setDetail(r)} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-black text-neutral-400">{r.receiptCode}</div><div className="mt-1 font-black">{r.fabricName||"Vải"} · {r.colorName||r.colorCode||"—"}</div><div className="mt-2 flex flex-wrap gap-1">{receiptFabricCodes(r).length?receiptFabricCodes(r).map(code=><span key={code} className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-black text-white">{code}</span>):<span className="text-xs font-bold text-neutral-400">Chưa có mã vải</span>}</div><div className="mt-2 text-xs text-neutral-400">Lô {r.lotCode||"—"} · {r.rollCount||r.rolls?.length||0} cây</div></div><Badge>{statusLabel(r.status)}</Badge></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Mini l="NCC báo" v={`${fmt(r.supplierDeclaredM)}m · ${fmt(r.supplierDeclaredKg)}kg`}/><Mini l="Thực nhận" v={`${fmt(r.actualM)}m · ${fmt(r.actualKg)}kg`}/><Mini l="Chênh lệch" v={`${dm>0?"+":""}${fmt(dm)}m · ${dkg>0?"+":""}${fmt(dkg)}kg`}/><Mini l="GSM" v={r.measuredGsm?`${fmt(r.measuredGsm,1)} / NCC ${fmt(r.expectedGsm,1)}`:`NCC ${fmt(r.expectedGsm,1)}`}/></div>
       </button>
       <div className="flex gap-2 overflow-x-auto border-t px-4 py-3">
        {can("fabric_receipt.edit")&&r.status!=="COMPLETED"&&<button onClick={()=>setEditing(r)} className={smallBtn}><Pencil className="mr-1 inline h-3 w-3"/>Sửa</button>}
        {can("fabric_receipt.measure")&&<button onClick={()=>setMeasure(r)} className={smallBtn}><Scale className="mr-1 inline h-3 w-3"/>Cân GSM</button>}
        {can("fabric_receipt.approve_variance")&&!r.varianceApproved&&(Math.abs(dm)>0.001||Math.abs(dkg)>0.001)&&<button onClick={()=>void action(r,"approve-variance")} className={`${smallBtn} border-amber-300 bg-amber-50 text-amber-800`}>Duyệt lệch</button>}
        {can("fabric_receipt.complete")&&r.status!=="COMPLETED"&&r.status!=="CANCELLED"&&<button onClick={()=>void action(r,"complete")} className="shrink-0 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"><CheckCircle2 className="mr-1 inline h-3 w-3"/>Hoàn tất</button>}
        {can("fabric_receipt.cancel")&&r.status!=="COMPLETED"&&r.status!=="CANCELLED"&&<button disabled={busyId===r.id} onClick={()=>void cancelReceipt(r)} className={`${smallBtn} border-red-300 bg-red-50 text-red-700 disabled:opacity-40`}>Huỷ</button>}
        {can("fabric_receipt.delete")&&r.status!=="COMPLETED"&&<button disabled={busyId===r.id} onClick={()=>void deleteReceipt(r)} className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Xoá</button>}
       </div>
      </article>
    })}
    {!loading&&!visibleRows.length&&<Empty t="Không có phiếu phù hợp."/>}
   </div>
  </div>

  {editing!==undefined&&<ReceiptForm receipt={editing} meta={meta} canFabricBoardLink={canFabricBoardLink} canSupplierIdentity={canSupplierIdentity} canCostView={canCostView} canCostEdit={can("fabric_receipt.cost.edit")} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);await load()}}/>}
  {measure&&<MeasurementForm receipt={measure} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setMeasure(null)} onSaved={async()=>{setMeasure(null);await load()}}/>}
  {detail&&<Detail receipt={detail} canSupplierIdentity={canSupplierIdentity} canCostView={canCostView} onClose={()=>setDetail(null)}/>}
 </main>
}

function ReceiptForm({receipt,meta,canFabricBoardLink,canSupplierIdentity,canCostView,canCostEdit,canUpload,onClose,onSaved}:{receipt:Receipt|null;meta:Meta;canFabricBoardLink:boolean;canSupplierIdentity:boolean;canCostView:boolean;canCostEdit:boolean;canUpload:boolean;onClose:()=>void;onSaved:()=>void}){
 const [f,setF]=useState<any>({receiptCode:receipt?.receiptCode||"",designSampleId:receipt?.designSampleId||"",supplierId:receipt?.supplierId||"",branchId:receipt?.branchId||"",fabricBoardCode:receipt?.fabricBoardCode||"",fabricCode:receipt?.fabricCode||"",fabricName:receipt?.fabricName||"",colorName:receipt?.colorName||"",colorCode:receipt?.colorCode||"",lotCode:receipt?.lotCode||"",supplierDeclaredM:receipt?.supplierDeclaredM??"",supplierDeclaredKg:receipt?.supplierDeclaredKg??"",actualM:receipt?.actualM??"",actualKg:receipt?.actualKg??"",unitPrice:receipt?.unitPrice??"",priceUnit:receipt?.priceUnit||"METER",priceCurrency:receipt?.priceCurrency||"VND",exchangeRateToVnd:receipt?.exchangeRateToVnd??"",expectedGsm:receipt?.expectedGsm??"",status:receipt?.status||"RECEIVING",receivedAt:receipt?.receivedAt?receipt.receivedAt.slice(0,10):new Date().toISOString().slice(0,10),receivedByStaffId:receipt?.receivedByStaffId||"",receivedByName:receipt?.receivedByName||"",note:receipt?.note||""});
 const [rolls,setRolls]=useState<Roll[]>(receipt?.rolls?.length?receipt.rolls:[{rollCode:"",colorName:"",colorCode:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",passed:true}]);
 const [files,setFiles]=useState<Record<number,File[]>>({});
 const [manualRollColor,setManualRollColor]=useState<Record<number,boolean>>({});
 const [fabricCosts,setFabricCosts]=useState<FabricCostGroup[]>(receipt?.fabricCosts||[]);
 const [colorMaps,setColorMaps]=useState<FabricColorMap[]>(receipt?.colorMaps||[]);
 const [saving,setSaving]=useState(false),[error,setError]=useState("");
 const patch=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
 useEffect(()=>{if(receipt)return;const p=new URLSearchParams();if(f.receivedAt)p.set("receivedAt",f.receivedAt);api<{code:string}>(`/sample-fabric/fabric-receipts/next-code?${p}`).then(r=>patch("receiptCode",r.code)).catch(()=>{})},[f.receivedAt,receipt?.id]);
 function chooseSample(id:string){
  patch("designSampleId",id);
  const s=meta.samples.find(x=>x.id===id);
  if(s&&canFabricBoardLink){
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
 const topFabricCodes=fabricCodeList(f.fabricCode);
 const configuredFabricCodes=Array.from(new Set([
  ...topFabricCodes,
  ...colorMaps.map(x=>String(x.fabricCode||"").trim().toUpperCase()).filter(Boolean),
 ]));
 const legacyColors=allowedCodes.map((code,index)=>({fabricCode:configuredFabricCodes[0]||"",code,name:allowedNames[index]||""}));
 function mapsForFabric(code:any){
  const fc=String(code||"").trim().toUpperCase();
  const mapped=colorMaps.filter(x=>String(x.fabricCode||"").trim().toUpperCase()===fc).map(x=>({code:colorCode(x.colorCode),name:String(x.colorName||"").trim()}));
  if(mapped.length)return mapped;
  return legacyColors.filter(x=>!x.fabricCode||x.fabricCode===fc);
 }
 function addColorMap(){setColorMaps(x=>[...x,{fabricCode:configuredFabricCodes[0]||"",colorName:"",colorCode:""}])}
 function patchColorMap(i:number,k:keyof FabricColorMap,v:any){setColorMaps(x=>x.map((row,j)=>j===i?{...row,[k]:k==="fabricCode"?String(v||"").toUpperCase():v}:row))}
 function removeColorMap(i:number){setColorMaps(x=>x.filter((_,j)=>j!==i))}
 function applyConfiguredColorsToRolls(){setRolls(rows=>rows.map(r=>{const opts=mapsForFabric(r.fabricCode);const byCode=r.colorCode?opts.find(x=>colorCode(x.code)===colorCode(r.colorCode)):undefined;const byName=!byCode&&r.colorName?opts.find(x=>x.name.trim().toLowerCase()===String(r.colorName||"").trim().toLowerCase()):undefined;const hit=byCode||byName;return hit?{...r,colorName:hit.name||r.colorName,colorCode:hit.code||r.colorCode}:r}))}
 function toggleBoardColor(c:BoardColor){
  const code=colorCode(c.code||c.name);
  const current=colorCodeList(f.colorCode);
  const has=current.includes(code);
  const next=has?current.filter(x=>x!==code):[...current,code];
  const names=next.map(x=>selectedBoard?.colors?.find(bc=>colorCode(bc.code||bc.name)===x)?.name||"").filter(Boolean);
  patch("colorCode",next.join(", "));
  patch("colorName",names.join(", "));
 }
 function addRoll(){const fc=configuredFabricCodes[0]||"";const opts=mapsForFabric(fc);const only=opts.length===1?opts[0]:null;setRolls(x=>[...x,{sortOrder:x.length+1,fabricCode:fc,rollCode:"",colorName:only?.name||"",colorCode:only?.code||"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",unitPriceCny:"",priceUnit:"METER",defectNote:"",passed:true}])}
 const fabricCodes=Array.from(new Set([...configuredFabricCodes,...rolls.map(r=>String(r.fabricCode||"").trim().toUpperCase()).filter(Boolean)]));
 function fabricCostFor(code:string){return fabricCosts.find(x=>x.fabricCode===code)||{fabricCode:code,chinaShippingCny:"",vietnamShippingRateVndPerKg:"",vietnamShippingVnd:"",note:""}}
 function patchFabricCost(code:string,key:keyof FabricCostGroup,value:any){setFabricCosts(c=>{const found=c.find(x=>x.fabricCode===code);return found?c.map(x=>x.fabricCode===code?{...x,[key]:value}:x):[...c,{fabricCode:code,[key]:value}]})}
 function sortRollsByFabricCode(){const combo=rolls.map((roll,index)=>({roll,index,files:files[index]||[],manual:manualRollColor[index]})).sort((a,b)=>String(a.roll.fabricCode||"").localeCompare(String(b.roll.fabricCode||""),"vi",{numeric:true,sensitivity:"base"})||String(a.roll.colorCode||"").localeCompare(String(b.roll.colorCode||""),"vi",{numeric:true,sensitivity:"base"})||a.index-b.index);setRolls(combo.map((x,i)=>({...x.roll,sortOrder:i+1})));const nf:Record<number,File[]>={},nm:Record<number,boolean>={};combo.forEach((x,i)=>{if(x.files.length)nf[i]=x.files;if(x.manual)nm[i]=true});setFiles(nf);setManualRollColor(nm)}
 function codeCost(code:string){const rs=rolls.filter(r=>String(r.fabricCode||"").trim().toUpperCase()===code),c=fabricCostFor(code),rate=num(f.exchangeRateToVnd),rollCount=rs.length,totalKg=rs.reduce((sum,r)=>sum+(num(r.actualKg)||num(r.supplierDeclaredKg)),0),goodsCny=rs.reduce((sum,r)=>sum+rollAmountCny(r),0),goodsVnd=goodsCny*rate,chinaShippingCny=num(c.chinaShippingCny),chinaShippingVnd=chinaShippingCny*rate,vnRate=num(c.vietnamShippingRateVndPerKg),vietnamShippingVnd=vnRate>0?totalKg*vnRate:num(c.vietnamShippingVnd),totalShippingVnd=chinaShippingVnd+vietnamShippingVnd;return{rollCount,totalKg,goodsCny,goodsVnd,chinaShippingCny,chinaShippingVnd,vnRate,vietnamShippingVnd,totalShippingVnd,shippingPerRollVnd:rollCount?totalShippingVnd/rollCount:0,fabricPerRollVnd:rollCount?goodsVnd/rollCount:0,landedPerRollVnd:rollCount?(goodsVnd+totalShippingVnd)/rollCount:0}}
 const liveCostSummary=useMemo(()=>{const groups=fabricCodes.map(codeCost),goodsCny=groups.reduce((s,x)=>s+x.goodsCny,0),goodsVnd=groups.reduce((s,x)=>s+x.goodsVnd,0),chinaShippingCny=groups.reduce((s,x)=>s+x.chinaShippingCny,0),chinaShippingVnd=groups.reduce((s,x)=>s+x.chinaShippingVnd,0),vietnamShippingVnd=groups.reduce((s,x)=>s+x.vietnamShippingVnd,0),totalShippingVnd=chinaShippingVnd+vietnamShippingVnd;return{goodsCny,goodsVnd,chinaShippingCny,chinaShippingVnd,vietnamShippingVnd,totalShippingVnd,grandTotalVnd:goodsVnd+totalShippingVnd}},[rolls,fabricCosts,f.exchangeRateToVnd]);
 async function save(){
  try{
   setSaving(true);setError("");
   const receiver=meta.staff.find(x=>x.id===f.receivedByStaffId);const normalizedColorMaps=colorMaps.map(x=>({id:x.id,fabricCode:String(x.fabricCode||"").trim().toUpperCase(),colorName:String(x.colorName||"").trim(),colorCode:colorCode(x.colorCode)||null})).filter(x=>x.fabricCode&&x.colorName);const normalized=rolls.map((r,i)=>({...r,sortOrder:i+1,fabricCode:String(r.fabricCode||"").trim().toUpperCase()||null,colorCode:colorCode(r.colorCode)||null,unitPriceCny:canCostEdit?r.unitPriceCny:undefined,priceUnit:canCostEdit?(r.priceUnit||"METER"):undefined,defectNote:String(r.defectNote||"").trim()||null}));const normalizedFabricCosts=fabricCodes.map(code=>{const c=fabricCostFor(code),calc=codeCost(code);return{...c,fabricCode:code,chinaShippingCny:num(c.chinaShippingCny),vietnamShippingRateVndPerKg:num(c.vietnamShippingRateVndPerKg),vietnamShippingVnd:calc.vietnamShippingVnd}});
   const saved=await api<Receipt>(receipt?`/sample-fabric/fabric-receipts/${receipt.id}`:"/sample-fabric/fabric-receipts",{method:receipt?"PATCH":"POST",body:JSON.stringify({...f,fabricCode:fabricCodesText(fabricCodes.join(", "))||null,receivedByStaffId:f.receivedByStaffId||null,receivedByName:receiver?.name||f.receivedByName||null,colorCode:colorCodes(f.colorCode)||null,unitPrice:undefined,priceUnit:undefined,rollCount:normalized.length,rolls:normalized,colorMaps:normalizedColorMaps,fabricCosts:canCostEdit?normalizedFabricCosts:undefined})});
   if(canCostEdit&&f.exchangeRateToVnd!=="")await api(`/sample-fabric/fabric-receipts/${saved.id}/cost`,{method:"PATCH",body:JSON.stringify({unitPrice:null,priceUnit:"METER",priceCurrency:"CNY",exchangeRateToVnd:num(f.exchangeRateToVnd)})});
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
   <Field l="Kho nhận"><select className={input} value={f.branchId} onChange={e=>patch("branchId",e.target.value)}><option value="">Không gắn</option>{meta.branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field l="Nhân viên nhận"><select className={input} value={f.receivedByStaffId} onChange={e=>{const id=e.target.value,st=meta.staff.find(x=>x.id===id);patch("receivedByStaffId",id);patch("receivedByName",st?.name||"")}}><option value="">Chưa chọn</option>{meta.staff.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
   {canFabricBoardLink&&<Field l="Bảng vải">
    <select className={input} value={f.fabricBoardId||selectedBoard?.id||""} onChange={e=>chooseBoard(e.target.value)}>
     <option value="">Chưa liên kết bảng vải</option>
     {meta.boards.map(b=><option key={b.id} value={b.id}>{b.boardCode}{b.fabricCode?` · ${b.fabricCode}`:""}{b.name?` · ${b.name}`:""}</option>)}
    </select>
   </Field>}
   <div className="grid grid-cols-2 gap-3">
    <Field l="Mã bảng vải"><input className={input} value={f.fabricBoardCode} onChange={e=>patch("fabricBoardCode",e.target.value)} placeholder="Có thể nhập tay"/></Field>
    <Field l="Mã vải"><input className={input} value={f.fabricCode} onChange={e=>patch("fabricCode",e.target.value)} onBlur={()=>patch("fabricCode",fabricCodesText(f.fabricCode))} placeholder="VD: AB88, AB99"/>{!!topFabricCodes.length&&<div className="mt-2 flex flex-wrap gap-1.5">{topFabricCodes.map(code=><span key={code} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-black">{code}</span>)}</div>}</Field>
   </div>
   <Field l="Tên vải"><input className={input} value={f.fabricName} onChange={e=>patch("fabricName",e.target.value)}/></Field>
   <Field l="Mã lô"><input className={input} value={f.lotCode} onChange={e=>patch("lotCode",e.target.value)}/></Field>
  </div>
  <div className="grid grid-cols-2 gap-3">
   <UnitInput l="NCC báo" unit="m" value={f.supplierDeclaredM} onChange={v=>patch("supplierDeclaredM",v)}/>
   <UnitInput l="NCC báo" unit="kg" value={f.supplierDeclaredKg} onChange={v=>patch("supplierDeclaredKg",v)}/>
   <UnitInput l="Thực nhận" unit="m" value={f.actualM} onChange={v=>patch("actualM",v)}/>
   <UnitInput l="Thực nhận" unit="kg" value={f.actualKg} onChange={v=>patch("actualKg",v)}/>
   <UnitInput l="GSM NCC" unit="GSM" value={f.expectedGsm} onChange={v=>patch("expectedGsm",v)}/>
   <Field l="Trạng thái"><select className={input} value={f.status} onChange={e=>patch("status",e.target.value)}>{STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
  </div>
  {canCostView&&<div className="rounded-3xl bg-amber-50 p-3"><Field l="Tỷ giá lúc nhập"><div className="relative"><input disabled={!canCostEdit} inputMode="decimal" className={`${input} pr-16 disabled:bg-neutral-100`} value={moneyInput(f.exchangeRateToVnd)} onChange={e=>patch("exchangeRateToVnd",moneyRaw(e.target.value))} placeholder="VD: 3.920"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400">VND/CNY</span></div></Field><div className="mt-2 grid grid-cols-2 gap-2"><Mini l="Tiền vải" v={`${fmt(liveCostSummary.goodsCny,2)} CNY`}/><Mini l="Tổng đơn" v={money(liveCostSummary.grandTotalVnd)}/></div></div>}

  <section className="rounded-3xl border p-3">
   <div className="flex items-center justify-between gap-2"><div><b className="text-sm">Mã vải & màu</b><div className="text-[11px] text-neutral-400">VD: AB88 · Xám · #8; AB99 · Đen · #20; AB99 · Xanh · #21. Mã màu không bắt buộc.</div></div><button type="button" onClick={addColorMap} className={smallBtn}>+ Màu</button></div>
   {!configuredFabricCodes.length&&<div className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Có thể nhập trực tiếp mã vải ngay bên dưới, không cần tạo mã ở phía trên trước.</div>}
   <datalist id="fabric-code-config-suggestions">{configuredFabricCodes.map(code=><option key={code} value={code}/>)}</datalist>
   <div className="mt-3 space-y-2">{colorMaps.map((c,i)=><div key={c.id||i} className="rounded-2xl bg-neutral-50 p-2"><div className="grid grid-cols-2 gap-2"><input list="fabric-code-config-suggestions" autoCapitalize="characters" className={input} value={c.fabricCode||""} onChange={e=>patchColorMap(i,"fabricCode",e.target.value)} onBlur={()=>patchColorMap(i,"fabricCode",String(c.fabricCode||"").trim().toUpperCase())} placeholder="Mã vải · VD AB99"/><input className={input} value={c.colorName||""} onChange={e=>patchColorMap(i,"colorName",e.target.value)} placeholder="Tên màu · Đen"/><input className={input} value={c.colorCode||""} onChange={e=>patchColorMap(i,"colorCode",e.target.value)} onBlur={()=>patchColorMap(i,"colorCode",colorCode(c.colorCode))} placeholder="#20 · không bắt buộc"/><button type="button" onClick={()=>removeColorMap(i)} className="rounded-2xl border px-3 text-xs font-black text-red-500">Xoá</button></div></div>)}</div>
   {!!colorMaps.length&&<button type="button" onClick={applyConfiguredColorsToRolls} className="mt-3 w-full rounded-2xl border py-3 text-xs font-black">Áp cấu hình cho cây đã tạo</button>}
  </section>

  <section className="rounded-3xl border p-3">
   <div><div><b className="text-sm">Chi tiết từng cây vải</b><div className="text-[11px] text-neutral-400">Điền theo thứ tự kiểm thực tế; xong có thể gom theo mã vải.</div></div><div className="mt-2 flex gap-2"><button type="button" onClick={sortRollsByFabricCode} className={smallBtn}>Sắp xếp mã</button><button type="button" onClick={addRoll} className={smallBtn}>+ Cây</button></div></div>
   <div className="mt-3 space-y-3">{rolls.map((r,i)=><div key={r.id||i} className="rounded-3xl bg-neutral-50 p-3">
    <div className="flex items-center justify-between"><b>STT {i+1}</b><button onClick={()=>{setRolls(x=>x.filter((_,j)=>j!==i));setFiles(c=>{const n={...c};delete n[i];return n})}} className="text-xs font-black text-red-600">Xoá</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2">
     {configuredFabricCodes.length?<select className={input} value={r.fabricCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>{if(j!==i)return v;const fc=e.target.value,opts=mapsForFabric(fc),only=opts.length===1?opts[0]:null;return {...v,fabricCode:fc,colorName:only?.name||"",colorCode:only?.code||""}}))}><option value="">Chọn mã vải</option>{configuredFabricCodes.map(code=><option key={code} value={code}>{code}</option>)}</select>:<input className={input} value={r.fabricCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,fabricCode:e.target.value.toUpperCase()}:v))} placeholder="Mã vải · AB99"/>}
     <input className={input} value={r.rollCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,rollCode:e.target.value}:v))} placeholder={`Mã cây ${i+1} (nếu có)`}/>
     {mapsForFabric(r.fabricCode).length>0&&!manualRollColor[i]?<>
      <select className={input} value={r.colorCode||""} onChange={e=>{const picked=mapsForFabric(r.fabricCode).find(c=>colorCode(c.code)===colorCode(e.target.value));setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:picked?.code||"",colorName:picked?.name||""}:v))}}>
       <option value="">Chọn màu đã cấu hình</option>
       {mapsForFabric(r.fabricCode).map((c,ix)=><option key={`${c.code}-${c.name}-${ix}`} value={c.code||""}>{c.name||"Không tên"}{c.code?` · ${c.code}`:""}</option>)}
      </select>
      <button type="button" onClick={()=>setManualRollColor(x=>({...x,[i]:true}))} className={smallBtn}>Nhập màu tay</button>
     </>:<>
      <input className={input} value={r.colorName||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorName:e.target.value}:v))} onBlur={()=>setRolls(x=>x.map((v,j)=>{if(j!==i)return v;const hit=mapsForFabric(v.fabricCode).find(c=>c.name.trim().toLowerCase()===String(v.colorName||"").trim().toLowerCase());return hit?{...v,colorName:hit.name,colorCode:hit.code||v.colorCode}:v}))} placeholder="Tên màu · có thể chỉ điền ô này"/>
      <input className={input} value={r.colorCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:e.target.value}:v))} onBlur={()=>setRolls(x=>x.map((v,j)=>{if(j!==i)return v;const cc=colorCode(v.colorCode);const hit=mapsForFabric(v.fabricCode).find(c=>colorCode(c.code)===cc);return hit?{...v,colorCode:hit.code,colorName:hit.name||v.colorName}:{...v,colorCode:cc}}))} placeholder="# Mã màu · không bắt buộc"/>
     </>}
     <UnitInputBare unit="m NCC" value={r.supplierDeclaredM} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,supplierDeclaredM:v}:y))}/>
     <UnitInputBare unit="kg NCC" value={r.supplierDeclaredKg} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,supplierDeclaredKg:v}:y))}/>
     <UnitInputBare unit="m thực" value={r.actualM} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,actualM:v}:y))}/>
     <UnitInputBare unit="kg thực" value={r.actualKg} onChange={v=>setRolls(x=>x.map((y,j)=>j===i?{...y,actualKg:v}:y))}/>
    </div>{canCostView&&<div className="mt-2 grid grid-cols-2 gap-2"><div className="relative"><input disabled={!canCostEdit} type="number" step="0.01" className={`${input} pr-12 disabled:bg-neutral-100`} value={moneyInput(r.unitPriceCny)} onChange={e=>setRolls(x=>x.map((y,j)=>j===i?{...y,unitPriceCny:moneyRaw(e.target.value)}:y))} placeholder="Giá màu này"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">CNY</span></div><select disabled={!canCostEdit} className={`${input} disabled:bg-neutral-100`} value={r.priceUnit||"METER"} onChange={e=>setRolls(x=>x.map((y,j)=>j===i?{...y,priceUnit:e.target.value as any}:y))}><option value="METER">Giá / mét</option><option value="KG">Giá / kg</option><option value="ROLL">Giá / cây</option></select><div className="col-span-2 rounded-2xl bg-white p-3 text-xs">Thành tiền <b>{fmt(rollAmountCny(r),2)} CNY</b>{num(f.exchangeRateToVnd)>0?<span className="ml-2 text-neutral-500">≈ {money(rollAmountCny(r)*num(f.exchangeRateToVnd))}</span>:null}</div></div>}
    <div className="mt-2"><Field l="Ghi chú cây"><textarea className={`${input} min-h-20`} value={r.defectNote||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,defectNote:e.target.value}:v))} placeholder="VD: cây hơi lệch màu, đầu cây bẩn, thiếu mét..."/></Field></div>
    {canUpload&&<div className="mt-3"><div className="grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-xl bg-neutral-950 py-2.5 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-3 w-3"/>Chụp ảnh<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>e.target.files?.[0]&&setFiles(c=>({...c,[i]:[...(c[i]||[]),e.target.files![0]]}))}/></label><label className="cursor-pointer rounded-xl border py-2.5 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-3 w-3"/>Chọn ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={e=>setFiles(c=>({...c,[i]:[...(c[i]||[]),...Array.from(e.target.files||[])]}))}/></label></div><div className="mt-2 flex gap-2 overflow-x-auto">{r.images?.map(im=><img key={im.id} src={asset(im.url)} className="h-14 w-14 rounded-xl object-cover"/>)}{files[i]?.map((file,j)=><div key={j} className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[10px] font-black text-emerald-700">Ảnh mới</div>)}</div></div>}
   </div>)}</div>
  </section>
  {canCostView&&fabricCodes.length>0&&<section className="rounded-3xl border p-3"><b className="text-sm">Phí theo mã vải</b><div className="text-[11px] text-neutral-400">Ship VN nhập theo VND/kg và tự nhân tổng kg của mã.</div><div className="mt-2 space-y-2">{fabricCodes.map(code=>{const c=fabricCostFor(code),cc=codeCost(code);return <div key={code} className="rounded-2xl bg-neutral-50 p-3"><div className="flex justify-between"><b>{code}</b><span className="text-xs text-neutral-400">{cc.rollCount} cây · {fmt(cc.totalKg,3)} kg</span></div><div className="mt-2 grid grid-cols-2 gap-2"><div className="relative"><input disabled={!canCostEdit} inputMode="numeric" className={`${input} pr-12 disabled:bg-neutral-100`} value={moneyInput(c.chinaShippingCny)} onChange={e=>patchFabricCost(code,"chinaShippingCny",moneyRaw(e.target.value))} placeholder="Ship China"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">CNY</span></div><div className="relative"><input disabled={!canCostEdit} inputMode="numeric" className={`${input} pr-14 disabled:bg-neutral-100`} value={moneyInput(c.vietnamShippingRateVndPerKg)} onChange={e=>patchFabricCost(code,"vietnamShippingRateVndPerKg",moneyRaw(e.target.value))} placeholder="20.000"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">đ/kg</span></div></div><div className="mt-2 grid grid-cols-2 gap-2"><Mini l="Ship VN tổng" v={money(cc.vietnamShippingVnd)}/><Mini l="Ship/cây" v={money(cc.shippingPerRollVnd)}/><Mini l="Tiền vải/cây" v={money(cc.fabricPerRollVnd)}/><Mini l="Giá nhập/cây" v={money(cc.landedPerRollVnd)}/></div><input disabled={!canCostEdit} className={`${input} mt-2 disabled:bg-neutral-100`} value={c.note||""} onChange={e=>patchFabricCost(code,"note",e.target.value)} placeholder="Ghi chú phí"/></div>})}</div><div className="mt-3 grid grid-cols-2 gap-2"><Mini l="Phí China" v={`${fmt(liveCostSummary.chinaShippingCny,0)} CNY`}/><Mini l="Phí Việt Nam" v={money(liveCostSummary.vietnamShippingVnd)}/><Mini l="Tổng phí" v={money(liveCostSummary.totalShippingVnd)}/><Mini l="Tổng đơn" v={money(liveCostSummary.grandTotalVnd)}/></div></section>}
  <Field l="Ghi chú"><textarea className={`${input} min-h-24`} value={f.note} onChange={e=>patch("note",e.target.value)}/></Field>
  <div className="rounded-2xl bg-neutral-50 p-3 text-sm"><b>Chênh lệch:</b> {num(f.actualM)-num(f.supplierDeclaredM)>0?"+":""}{fmt(num(f.actualM)-num(f.supplierDeclaredM))} m · {num(f.actualKg)-num(f.supplierDeclaredKg)>0?"+":""}{fmt(num(f.actualKg)-num(f.supplierDeclaredKg))} kg</div>
  <button disabled={saving} onClick={()=>void save()} className="w-full rounded-2xl bg-neutral-950 py-3.5 font-black text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu phiếu"}</button>
 </div></Modal>
}

function Detail({receipt:r,canSupplierIdentity,canCostView,onClose}:{receipt:Receipt;canSupplierIdentity:boolean;canCostView:boolean;onClose:()=>void}){
 return <Modal title={r.receiptCode} onClose={onClose}><div className="space-y-4 p-4">
  <div className="grid grid-cols-2 gap-2"><Mini l="Vải" v={r.fabricName||r.fabricCode||"—"}/><Mini l="Màu" v={`${r.colorName||"—"} ${r.colorCode||""}`}/><Mini l="NCC" v={canSupplierIdentity?`${r.supplier?.code||"NCC"} · ${r.supplier?.name||""}`.trim():(r.supplier?.code||"NCC")}/><Mini l="Kho" v={r.branch?.name||"—"}/><Mini l="Ngày nhận" v={dateText(r.receivedAt)}/><Mini l="Trạng thái" v={statusLabel(r.status)}/></div>
  {canCostView&&r.costSummary&&<div className="rounded-2xl bg-amber-50 p-3"><div className="grid grid-cols-2 gap-2"><Mini l="Tiền vải" v={money(r.costSummary.goodsVnd)}/><Mini l="Ship China" v={money(r.costSummary.chinaShippingVnd)}/><Mini l="Ship Việt Nam" v={money(r.costSummary.vietnamShippingVnd)}/><Mini l="Tổng phí" v={money(r.costSummary.totalShippingVnd)}/></div><div className="mt-2 rounded-2xl bg-neutral-950 p-3 text-white"><div className="text-[10px] uppercase text-neutral-400">Tổng đơn nhập vải</div><div className="text-xl font-black">{money(r.costSummary.grandTotalVnd)}</div><div className="text-[11px] text-neutral-400">{fmt(r.costSummary.goodsCny,2)} CNY · tỷ giá {fmt(r.costSummary.exchangeRateToVnd,0)}</div></div></div>}
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
    <div>{children}</div>
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
