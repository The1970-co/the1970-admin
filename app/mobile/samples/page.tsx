"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Download,
  FileUp,
  FlipHorizontal,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
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


type MeasurementRow = { id:string; name:string; unit:string; values:Record<string,string> };
type MeasurementTemplate = { id:string; name:string; productKind:"SHIRT"|"PANTS"|"CUSTOM"; sizes:string[]; rows:MeasurementRow[]; note?:string; updatedAt:string };
type SampleMeasurementSnapshot = MeasurementTemplate & { sourceTemplateId?:string|null; sampleId?:string|null; sampleCode?:string|null };

const MEASUREMENT_TEMPLATE_KEY="the1970.measurementTemplates.v1";
const MEASUREMENT_SNAPSHOT_KEY="the1970.sampleMeasurements.v1";
const SHIRT_MEASUREMENT_SIZES=["S","M","L","XL","XXL"];
const PANTS_MEASUREMENT_SIZES=["29","30","31","32","33","34","36","38"];

function measurementUid(prefix="m"){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
function loadMeasurementTemplates():MeasurementTemplate[]{
  if(typeof window==="undefined")return [];
  try{const x=JSON.parse(localStorage.getItem(MEASUREMENT_TEMPLATE_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}
}
function loadMeasurementSnapshots():Record<string,SampleMeasurementSnapshot>{
  if(typeof window==="undefined")return {};
  try{const x=JSON.parse(localStorage.getItem(MEASUREMENT_SNAPSHOT_KEY)||"{}");return x&&typeof x==="object"?x:{}}catch{return {}}
}
function snapshotKeys(sample:any){return [sample?.id?`id:${sample.id}`:"",sample?.code?`code:${normalizeCode(sample.code)}`:""].filter(Boolean)}
function loadSampleMeasurement(sample:any):SampleMeasurementSnapshot|null{
  const all=loadMeasurementSnapshots();for(const k of snapshotKeys(sample)){if(all[k])return all[k]}return null
}
function saveSampleMeasurement(sample:any,snapshot:SampleMeasurementSnapshot|null){
  if(typeof window==="undefined"||!snapshot)return;
  const all=loadMeasurementSnapshots();
  const next={...snapshot,sampleId:sample?.id||snapshot.sampleId||null,sampleCode:normalizeCode(sample?.code||snapshot.sampleCode||"")||null,updatedAt:new Date().toISOString()};
  for(const k of snapshotKeys({...sample,code:sample?.code||snapshot.sampleCode})){all[k]=next}
  localStorage.setItem(MEASUREMENT_SNAPSHOT_KEY,JSON.stringify(all));
}
function blankSampleMeasurement(kind:"SHIRT"|"PANTS"|"CUSTOM"="SHIRT"):SampleMeasurementSnapshot{
  const sizes=kind==="PANTS"?[...PANTS_MEASUREMENT_SIZES]:kind==="SHIRT"?[...SHIRT_MEASUREMENT_SIZES]:[];
  return {id:measurementUid("snapshot"),name:"",productKind:kind,sizes,rows:[],note:"",updatedAt:new Date().toISOString(),sourceTemplateId:null};
}
function normalizeMeasurementDecimal(v:string){return String(v||"").replace(/[^\d,.-]/g,"").replace(".",",")}

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

async function uploadPatternFile(file:File) {
  const fd=new FormData();
  fd.append("file",file);
  return api<{url:string;filename?:string;mimetype?:string;size?:number}>("/sample-fabric/samples/upload-file",{method:"POST",body:fd});
}
type SampleAsset={type:string;url:string;caption?:string|null};
type PatternAttachment={type:"OTHER";url:string;caption:string;name:string;mimetype?:string;size?:number};
function patternCaption(name:string,mimetype?:string,size?:number){
  return `RAP_FILE|${encodeURIComponent(name)}|${encodeURIComponent(mimetype||"")}|${Number(size||0)}`;
}
function parsePatternCaption(caption?:string|null):{name:string;mimetype?:string;size?:number}|null{
  const raw=String(caption||"");
  if(!raw.startsWith("RAP_FILE|"))return null;
  const parts=raw.split("|");
  try{return {name:decodeURIComponent(parts[1]||"file-rập"),mimetype:decodeURIComponent(parts[2]||"")||undefined,size:Number(parts[3]||0)||undefined}}catch{return {name:parts[1]||"file-rập"}}
}
function isPatternAsset(x:any){return String(x?.type||"")==="OTHER"&&!!parsePatternCaption(x?.caption)}
function safeFilename(v:string){return String(v||"file").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim()}
async function downloadUrl(url:string,filename:string){
  try{
    const res=await fetch(asset(url));
    if(!res.ok)throw new Error("download");
    const blob=await res.blob();
    const href=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=href;a.download=safeFilename(filename);document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  }catch{
    window.open(asset(url),"_blank","noopener,noreferrer");
  }
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

  return <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(16px+env(safe-area-inset-bottom))] text-neutral-950">
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
      canUpload={can("design_sample.upload_images")}
      onClose={()=>setEditing(undefined)}
      onSaved={async()=>{setEditing(undefined);await load()}}
    />}

    {dispatching&&<DispatchForm
      sample={dispatching}
      meta={meta}
      onClose={()=>setDispatching(null)}
      onSaved={async()=>{setDispatching(null);setDetail(null);await load()}}
    />}

    
  </main>
}

function DetailModal({sample,can,onClose,onEdit,onDelete,onDispatch,onChanged}:{sample:Sample;can:(k:string)=>boolean;onClose:()=>void;onEdit:()=>void;onDelete:()=>void;onDispatch:()=>void;onChanged:()=>void}){
  const dispatches=Array.isArray(sample.sampleDispatches)?sample.sampleDispatches:[];
  const patternAttachments=(sample.images||[]).filter((x:any)=>isPatternAsset(x)).map((x:any)=>({...x,...parsePatternCaption(x.caption)}));
  const initialGallery=Array.from(new Set([
    sample.coverImageUrl,
    ...(sample.images||[]).filter((x:any)=>!isPatternAsset(x)).map((x:any)=>x?.url),
    sample.matchedProduct?.imageUrl,
  ].filter(Boolean).map((x:any)=>asset(x))));
  const [gallery,setGallery]=useState<string[]>(initialGallery);
  const image=gallery[0]||"";
  const [viewerIndex,setViewerIndex]=useState<number|null>(null);
  const [editMode,setEditMode]=useState(false);
  const [rotate,setRotate]=useState(0);
  const [flipX,setFlipX]=useState(false);
  const [cropRatio,setCropRatio]=useState<"original"|"1:1"|"4:5"|"3:4">("original");
  const [brightness,setBrightness]=useState(100);
  const [contrast,setContrast]=useState(100);
  const [editBusy,setEditBusy]=useState(false);
  const [viewerError,setViewerError]=useState("");
  const openViewer=(url:string)=>{const i=gallery.indexOf(url);setViewerIndex(i>=0?i:0);setEditMode(false);setViewerError("")};
  const closeViewer=()=>{setViewerIndex(null);setEditMode(false);setViewerError("")};
  const prevImage=()=>setViewerIndex(i=>i===null?null:(i-1+gallery.length)%gallery.length);
  const nextImage=()=>setViewerIndex(i=>i===null?null:(i+1)%gallery.length);
  function resetEdit(){setRotate(0);setFlipX(false);setCropRatio("original");setBrightness(100);setContrast(100);setViewerError("")}
  async function saveEditedImage(){
    if(viewerIndex===null||!gallery[viewerIndex]||!can("design_sample.edit")||!can("design_sample.upload_images"))return;
    try{
      setEditBusy(true);setViewerError("");
      const currentAsset=gallery[viewerIndex];
      const res=await fetch(currentAsset);
      if(!res.ok)throw new Error("Không đọc được ảnh gốc.");
      const blob=await res.blob();
      const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
        const el=new Image();const u=URL.createObjectURL(blob);
        el.onload=()=>{URL.revokeObjectURL(u);resolve(el)};el.onerror=()=>{URL.revokeObjectURL(u);reject(new Error("Không mở được ảnh."))};el.src=u;
      });
      let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
      const ratioMap:any={"1:1":1,"4:5":4/5,"3:4":3/4};
      const wanted=ratioMap[cropRatio];
      if(wanted){
        const current=sw/sh;
        if(current>wanted){const nw=sh*wanted;sx=(sw-nw)/2;sw=nw}else{const nh=sw/wanted;sy=(sh-nh)/2;sh=nh}
      }
      const angle=((rotate%360)+360)%360;
      const quarter=angle===90||angle===270;
      const maxSide=2200;
      const scale=Math.min(1,maxSide/Math.max(sw,sh));
      const drawW=Math.max(1,Math.round(sw*scale)),drawH=Math.max(1,Math.round(sh*scale));
      const canvas=document.createElement("canvas");
      canvas.width=quarter?drawH:drawW;canvas.height=quarter?drawW:drawH;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Không tạo được ảnh chỉnh sửa.");
      ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.scale(flipX?-1:1,1);
      ctx.filter=`brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(img,sx,sy,sw,sh,-drawW/2,-drawH/2,drawW,drawH);ctx.restore();
      const editedBlob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Không xuất được ảnh.")),"image/jpeg",0.92));
      const file=new File([editedBlob],`${safeFilename(sample.code||"mau")}-edited-${Date.now()}.jpg`,{type:"image/jpeg"});
      const uploaded=await upload(file);
      const rawImages=(sample.images||[]).map((x:any)=>({type:x.type||"SAMPLE",url:x.url,caption:x.caption||null}));
      let replaced=false;
      const nextImages=rawImages.map((x:any)=>{
        if(!isPatternAsset(x)&&asset(x.url)===currentAsset){replaced=true;return {...x,url:uploaded.url,caption:x.caption||"Ảnh đã chỉnh sửa"}}
        return x;
      });
      if(!replaced)nextImages.push({type:"SAMPLE",url:uploaded.url,caption:"Ảnh đã chỉnh sửa"});
      const nextCover=asset(sample.coverImageUrl)===currentAsset?uploaded.url:(sample.coverImageUrl||uploaded.url);
      await api(`/sample-fabric/samples/${sample.id}`,{method:"PATCH",body:JSON.stringify({coverImageUrl:nextCover,images:nextImages})});
      setGallery(g=>g.map((u,i)=>i===viewerIndex?asset(uploaded.url):u));
      setEditMode(false);resetEdit();await onChanged();
    }catch(e){setViewerError(e instanceof Error?e.message:"Không lưu được ảnh chỉnh sửa.")}
    finally{setEditBusy(false)}
  }
  return <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/45 p-3 pb-[max(16px,env(safe-area-inset-bottom))]" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}>
    <div className="mx-auto my-4 max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b p-4">
        <div><div className="text-xs font-black text-neutral-400">{sample.code}</div><div className="font-black">{sample.name}</div></div>
        <button onClick={()=>closeWithZoomReset(onClose)} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button>
      </div>

      <div className="space-y-4 p-4">
        {image&&<button type="button" onClick={()=>openViewer(image)} className="block w-full overflow-hidden rounded-3xl"><img src={image} className="h-64 w-full object-cover" alt=""/><div className="mt-2 text-center text-[11px] font-semibold text-neutral-400">Bấm ảnh để xem lớn</div></button>}
        {gallery.length>1&&<div className="flex gap-2 overflow-x-auto pb-1">{gallery.map((url:string,i:number)=><div key={`${url}-${i}`} className="relative shrink-0"><button type="button" onClick={()=>setViewerIndex(i)} className="overflow-hidden rounded-2xl border"><img src={url} className="h-20 w-20 object-cover" alt=""/></button><button type="button" onClick={()=>void downloadUrl(url,`${sample.code||"mau"}-${i+1}.jpg`)} className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-lg bg-white/95 shadow"><Download className="h-3.5 w-3.5"/></button></div>)}</div>}
        {!!gallery.length&&<button type="button" onClick={()=>void downloadUrl(gallery[0],`${sample.code||"mau"}-anh-dai-dien.jpg`)} className="w-full rounded-2xl border py-2.5 text-xs font-black"><Download className="mr-1 inline h-4 w-4"/>Tải ảnh đại diện</button>}

        {!!patternAttachments.length&&<section className="rounded-2xl bg-neutral-50 p-3">
          <div className="mb-2 text-xs font-black">File rập / tài liệu kỹ thuật</div>
          <div className="space-y-2">{patternAttachments.map((f:any,i:number)=><div key={f.id||`${f.url}-${i}`} className="flex items-center gap-2 rounded-xl bg-white p-2.5"><div className="min-w-0 flex-1"><div className="truncate text-xs font-black">{f.name||`File rập ${i+1}`}</div><div className="text-[10px] text-neutral-400">{f.size?`${(Number(f.size)/1024/1024).toFixed(2)} MB`:""}</div></div><button onClick={()=>void downloadUrl(f.url,`${sample.code||"mau"}-${f.name||`file-rap-${i+1}`}`)} className="grid h-9 w-9 place-items-center rounded-xl border"><Download className="h-4 w-4"/></button></div>)}</div>
        </section>}

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
        {sample.technicalNote&&<Info l="Ghi chú kỹ thuật" v={sample.technicalNote}/>}<MeasurementSummary sample={sample}/>

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

    {viewerIndex!==null&&gallery[viewerIndex]&&<div className="fixed inset-0 z-[120] flex flex-col bg-black/95" style={{touchAction:"pinch-zoom"}}>
      <div className="flex shrink-0 items-center justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex gap-2">
          <button type="button" onClick={()=>void downloadUrl(gallery[viewerIndex],`${sample.code||"mau"}-${viewerIndex+1}.jpg`)} className="grid h-10 w-10 place-items-center rounded-full bg-white/95"><Download className="h-4 w-4"/></button>
          {can("design_sample.edit")&&can("design_sample.upload_images")&&<button type="button" onClick={()=>{setEditMode(x=>!x);resetEdit()}} className={`rounded-full px-4 text-xs font-black ${editMode?"bg-amber-300 text-black":"bg-white/95"}`}><Pencil className="mr-1 inline h-4 w-4"/>Chỉnh ảnh</button>}
        </div>
        <button type="button" onClick={closeViewer} className="grid h-10 w-10 place-items-center rounded-full bg-white/95"><X className="h-5 w-5"/></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-3" style={{WebkitOverflowScrolling:"touch",touchAction:editMode?"pan-y":"pan-x pan-y pinch-zoom"}}>
        {gallery.length>1&&!editMode&&<button type="button" onClick={prevImage} className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl">‹</button>}
        <img src={gallery[viewerIndex]} className="max-h-full max-w-full object-contain transition-transform" style={{transform:`rotate(${rotate}deg) scaleX(${flipX?-1:1})`,filter:`brightness(${brightness}%) contrast(${contrast}%)`,aspectRatio:cropRatio==="original"?undefined:cropRatio.replace(":", "/") as any}} alt=""/>
        {gallery.length>1&&!editMode&&<button type="button" onClick={nextImage} className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl">›</button>}
      </div>

      {editMode&&<div className="shrink-0 border-t border-white/20 bg-black/80 p-3 pb-[max(12px,env(safe-area-inset-bottom))] text-white">
        {viewerError&&<div className="mb-2 rounded-xl bg-red-500/20 p-2 text-xs text-red-200">{viewerError}</div>}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={()=>setRotate(x=>x-90)} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black"><RotateCcw className="mr-1 inline h-4 w-4"/>Trái</button>
          <button onClick={()=>setRotate(x=>x+90)} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black"><RotateCw className="mr-1 inline h-4 w-4"/>Phải</button>
          <button onClick={()=>setFlipX(x=>!x)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${flipX?"bg-white text-black":"bg-white/10"}`}><FlipHorizontal className="mr-1 inline h-4 w-4"/>Lật ngang</button>
          {(["original","1:1","4:5","3:4"] as const).map(r=><button key={r} onClick={()=>setCropRatio(r)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${cropRatio===r?"bg-white text-black":"bg-white/10"}`}>{r==="original"?"Gốc":r}</button>)}
          <button onClick={resetEdit} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black"><RefreshCcw className="mr-1 inline h-4 w-4"/>Reset</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[10px] font-black uppercase text-white/60">Độ sáng <b className="text-white">{brightness}%</b><input type="range" min="50" max="150" value={brightness} onChange={e=>setBrightness(Number(e.target.value))} className="mt-1 w-full"/></label>
          <label className="text-[10px] font-black uppercase text-white/60">Tương phản <b className="text-white">{contrast}%</b><input type="range" min="50" max="150" value={contrast} onChange={e=>setContrast(Number(e.target.value))} className="mt-1 w-full"/></label>
        </div>
        <button disabled={editBusy} onClick={()=>void saveEditedImage()} className="mt-3 w-full rounded-2xl bg-white py-3 text-sm font-black text-black disabled:opacity-50"><Save className="mr-1 inline h-4 w-4"/>{editBusy?"Đang lưu ảnh...":"Lưu bản chỉnh sửa"}</button>
      </div>}

      {!editMode&&gallery.length>1&&<div className="shrink-0 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 text-center"><span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-black">{viewerIndex+1}/{gallery.length}</span></div>}
    </div>}
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

function SampleForm({sample,meta,canViewFabricLink,canUpload,onClose,onSaved}:{sample:Sample|null;meta:Meta;canViewFabricLink:boolean;canUpload:boolean;onClose:()=>void;onSaved:()=>void}){
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
  const [sampleImages,setSampleImages]=useState<Array<{type:string;url:string;caption?:string}>>(
    Array.isArray(sample?.images) && sample!.images!.some((x:any)=>!isPatternAsset(x))
      ? sample!.images!.filter((x:any)=>!isPatternAsset(x)).map((x:any)=>({type:x.type||"SAMPLE",url:x.url,caption:x.caption||"Ảnh mẫu / ảnh tham khảo"}))
      : (sample?.coverImageUrl ? [{type:"SAMPLE",url:sample.coverImageUrl,caption:"Ảnh mẫu / ảnh tham khảo"}] : [])
  );
  const [patternFiles,setPatternFiles]=useState<PatternAttachment[]>(
    Array.isArray(sample?.images)
      ? sample!.images!.filter((x:any)=>isPatternAsset(x)).map((x:any)=>{
          const meta=parsePatternCaption(x.caption);
          return {type:"OTHER",url:x.url,caption:x.caption,name:meta?.name||"file-rập",mimetype:meta?.mimetype,size:meta?.size};
        })
      : []
  );
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [codeMessage,setCodeMessage]=useState("");
  const [codeAvailable,setCodeAvailable]=useState<boolean|null>(sample?true:null);
  const [measurementTemplates,setMeasurementTemplates]=useState<MeasurementTemplate[]>([]);
  const [measurement,setMeasurement]=useState<SampleMeasurementSnapshot|null>(null);
  const [measurementOpen,setMeasurementOpen]=useState(false);
  useEffect(()=>{setMeasurementTemplates(loadMeasurementTemplates());setMeasurement(loadSampleMeasurement(sample))},[sample?.id,sample?.code]);

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

  async function changeImages(files?:FileList|File[]){
    const list=Array.from(files||[]);
    if(!list.length)return;
    try{
      const uploaded:Array<{type:string;url:string;caption:string}>=[];
      for(const file of list){
        const r=await upload(file);
        uploaded.push({type:"SAMPLE",url:r.url,caption:"Ảnh mẫu / ảnh tham khảo"});
      }
      setSampleImages(current=>{
        const next=[...current,...uploaded];
        if(!form.coverImageUrl && next[0]?.url) patch("coverImageUrl",next[0].url);
        return next;
      });
    }catch(e){setError(e instanceof Error?e.message:"Upload lỗi")}
  }

  async function changePatternFiles(files?:FileList|File[]){
    const list=Array.from(files||[]);
    if(!list.length)return;
    if(!canUpload){setError("Không có quyền tải file mẫu.");return}
    try{
      const uploaded:PatternAttachment[]=[];
      for(const file of list){
        const r=await uploadPatternFile(file);
        const name=r.filename||file.name;
        uploaded.push({type:"OTHER",url:r.url,caption:patternCaption(name,r.mimetype||file.type,r.size||file.size),name,mimetype:r.mimetype||file.type,size:r.size||file.size});
      }
      setPatternFiles(current=>[...current,...uploaded]);
    }catch(e){setError(e instanceof Error?e.message:"Không tải được file rập.")}
  }

  async function save(){
    try{
      setSaving(true);setError("");
      if(!form.name.trim())throw new Error("Thiếu tên mẫu.");
      const normalizedCode=normalizeCode(form.code);
      if(normalizedCode && codeAvailable!==true)throw new Error(codeMessage||"Mã mẫu chưa hợp lệ.");
      const staff=meta.staff.find(x=>x.id===form.assigneeStaffId);
      const factory=meta.factories.find(x=>x.id===form.sampleFactoryId);
      const board=meta.boards.find(x=>x.id===form.fabricBoardId);

      const saved=await api<any>(sample?`/sample-fabric/samples/${sample.id}`:"/sample-fabric/samples",{
        method:sample?"PATCH":"POST",
        body:JSON.stringify({
          name:form.name,
          code:normalizedCode||undefined,
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
          images:[
            ...(sampleImages.length?sampleImages:(form.coverImageUrl?[{type:"SAMPLE",url:form.coverImageUrl,caption:"Ảnh mẫu / ảnh tham khảo"}]:[])),
            ...patternFiles.map(x=>({type:"OTHER",url:x.url,caption:x.caption})),
          ],
        })
      });
      if(measurement)saveSampleMeasurement({id:saved?.id||sample?.id,code:saved?.code||form.code},measurement);
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
          {!!sampleImages.length&&<div className="mb-3 flex gap-2 overflow-x-auto pb-1">{sampleImages.map((img,i)=><div key={`${img.url}-${i}`} className="relative shrink-0"><button type="button" onClick={()=>patch("coverImageUrl",img.url)} className={`block overflow-hidden rounded-2xl border-2 ${form.coverImageUrl===img.url?"border-neutral-950":"border-transparent"}`}><img src={asset(img.url)} className="h-28 w-24 object-cover" alt=""/></button>{canUpload&&<button type="button" onClick={()=>{const next=sampleImages.filter((_,j)=>j!==i);setSampleImages(next);if(form.coverImageUrl===img.url)patch("coverImageUrl",next[0]?.url||"")}} className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow">×</button>}</div>)}</div>}
          <div className="mb-2 text-[11px] text-neutral-400">Chọn ảnh để đặt làm ảnh đại diện. Có thể tải nhiều ảnh cùng lúc.</div>
          {canUpload&&<div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-2xl bg-neutral-950 py-3 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-4 w-4"/>Chụp<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>void changeImages(e.target.files||undefined)}/></label>
            <label className="cursor-pointer rounded-2xl border py-3 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-4 w-4"/>Tải nhiều ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={e=>void changeImages(e.target.files||undefined)}/></label>
          </div>}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field l="Tên mẫu"><input className={input} value={form.name} onChange={e=>patch("name",e.target.value)}/></Field>
        <Field l="Mã mẫu"><input className={input} value={form.code} onChange={e=>patch("code",normalizeCode(e.target.value))} placeholder={sample?"Mã mẫu":"Để trống để tự sinh mã"}/><div className={`mt-1 text-[11px] ${codeAvailable===false?"text-red-600":codeAvailable?"text-emerald-600":"text-neutral-400"}`}>{codeMessage||(!sample&&!form.code?"Để trống, hệ thống sẽ tự sinh mã mẫu.":"")}</div></Field>
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
      <section className="rounded-3xl border border-neutral-200 p-3">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-black">File rập / tài liệu kỹ thuật</div><div className="mt-1 text-[11px] text-neutral-400">PDF, DXF, DWG, AI, PLT, ZIP… lưu theo từng mẫu.</div></div>
          {canUpload&&<label className="cursor-pointer rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"><FileUp className="mr-1 inline h-4 w-4"/>Tải file<input type="file" multiple className="hidden" accept=".pdf,.dxf,.dwg,.ai,.plt,.zip,.rar,.7z,.astm,.aama,.rul,.mdl,.pds,.hpgl,.svg" onChange={e=>void changePatternFiles(e.target.files||undefined)}/></label>}
        </div>
        <div className="mt-3 space-y-2">
          {patternFiles.map((f,i)=><div key={`${f.url}-${i}`} className="flex items-center gap-2 rounded-2xl bg-neutral-50 p-3">
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-black">{f.name}</div><div className="mt-0.5 text-[10px] text-neutral-400">{f.size?`${(f.size/1024/1024).toFixed(f.size>1024*1024?2:3)} MB`:"File rập"}{f.mimetype?` · ${f.mimetype}`:""}</div></div>
            <button type="button" onClick={()=>void downloadUrl(f.url,`${form.code||form.name||"mau"}-${f.name}`)} className="grid h-9 w-9 place-items-center rounded-xl border bg-white"><Download className="h-4 w-4"/></button>
            {canUpload&&<button type="button" onClick={()=>setPatternFiles(x=>x.filter((_,j)=>j!==i))} className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600"><X className="h-4 w-4"/></button>}
          </div>)}
          {!patternFiles.length&&<div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-400">Chưa có file rập.</div>}
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 p-3">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-black">Bảng thông số</div><div className="mt-1 text-[11px] text-neutral-400">Lấy từ thư viện, tạo mới hoặc chỉnh riêng cho mẫu này.</div></div>
          <Link href="/mobile/measurement-library" className="shrink-0 rounded-xl border px-3 py-2 text-[11px] font-black"><Ruler className="mr-1 inline h-3.5 w-3.5"/>Thư viện</Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select className={input} value={measurement?.sourceTemplateId||""} onChange={e=>{
            const t=measurementTemplates.find(x=>x.id===e.target.value);
            if(!t){setMeasurement(null);return}
            setMeasurement({...structuredClone(t),id:measurementUid("snapshot"),sourceTemplateId:t.id});
          }}>
            <option value="">Chọn từ thư viện</option>
            {measurementTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" onClick={()=>{setMeasurement(measurement||blankSampleMeasurement("SHIRT"));setMeasurementOpen(true)}} className="rounded-2xl bg-neutral-950 px-3 py-3 text-xs font-black text-white">{measurement?"Chỉnh bảng":"Tạo mới"}</button>
        </div>
        {measurement&&<div className="mt-3 rounded-2xl bg-neutral-50 p-3">
          <div className="font-black">{measurement.name||"Bảng riêng của mẫu"}</div>
          <div className="mt-1 text-xs text-neutral-500">{measurement.sizes.join(" · ")} · {measurement.rows.length} thông số</div>
          <div className="mt-2 flex gap-2"><button type="button" onClick={()=>setMeasurementOpen(true)} className="rounded-xl border bg-white px-3 py-2 text-xs font-black">Mở bảng</button><button type="button" onClick={()=>setMeasurement(null)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Bỏ liên kết</button></div>
        </div>}
      </section>
      <Field l="Ghi chú mẫu"><textarea className={`${input} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field>
      <Field l="Ghi chú kỹ thuật"><textarea className={`${input} min-h-24`} value={form.technicalNote} onChange={e=>patch("technicalNote",e.target.value)}/></Field>

      <div className="grid grid-cols-2 gap-2 border-t pt-4">
        <button onClick={()=>closeWithZoomReset(onClose)} className="rounded-2xl border py-3 font-black">Đóng</button>
        <button disabled={saving||!form.name.trim()} onClick={()=>void save()} className="rounded-2xl bg-neutral-950 py-3 font-black text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu mẫu"}</button>
      </div>
    </div>
    {measurementOpen&&measurement&&<SampleMeasurementEditor value={measurement} onChange={setMeasurement} onClose={()=>setMeasurementOpen(false)} onSaveTemplate={tpl=>{const rows=[tpl,...loadMeasurementTemplates().filter(x=>x.id!==tpl.id)];localStorage.setItem(MEASUREMENT_TEMPLATE_KEY,JSON.stringify(rows));setMeasurementTemplates(rows)}}/>}
  </Modal>
}


function MeasurementSummary({sample}:{sample:any}){
  const [m,setM]=useState<SampleMeasurementSnapshot|null>(null);
  useEffect(()=>setM(loadSampleMeasurement(sample)),[sample?.id,sample?.code]);
  if(!m)return null;
  return <div className="rounded-3xl border border-neutral-200 p-3"><div className="flex items-center justify-between"><div><div className="text-[10px] font-black uppercase text-neutral-400">Bảng thông số</div><div className="mt-1 text-sm font-black">{m.name||"Bảng riêng của mẫu"}</div></div><Ruler className="h-5 w-5 text-neutral-400"/></div><div className="mt-2 flex gap-1.5 overflow-x-auto">{m.sizes.map(s=><span key={s} className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-black">{s}</span>)}</div><div className="mt-2 text-xs text-neutral-500">{m.rows.length} dòng thông số</div></div>
}

function SampleMeasurementEditor({value,onChange,onClose,onSaveTemplate}:{value:SampleMeasurementSnapshot;onChange:(v:SampleMeasurementSnapshot)=>void;onClose:()=>void;onSaveTemplate:(v:MeasurementTemplate)=>void}){
  const [f,setF]=useState<SampleMeasurementSnapshot>(structuredClone(value));
  const [newSize,setNewSize]=useState("");
  function changeKind(kind:"SHIRT"|"PANTS"|"CUSTOM"){const sizes=kind==="PANTS"?[...PANTS_MEASUREMENT_SIZES]:kind==="SHIRT"?[...SHIRT_MEASUREMENT_SIZES]:[];setF(x=>({...x,productKind:kind,sizes,rows:x.rows.map(r=>({...r,values:Object.fromEntries(sizes.map(s=>[s,r.values?.[s]||""]))}))}))}
  function addRow(){setF(x=>({...x,rows:[...x.rows,{id:measurementUid("row"),name:"",unit:"cm",values:Object.fromEntries(x.sizes.map(s=>[s,""]))}]}))}
  function saveToLibrary(){
    const {
      sourceTemplateId: _sourceTemplateId,
      sampleId: _sampleId,
      sampleCode: _sampleCode,
      ...templateBase
    } = structuredClone(f);
    const tpl:MeasurementTemplate={
      ...templateBase,
      id:measurementUid("tpl"),
      updatedAt:new Date().toISOString(),
    };
    if(!tpl.name.trim())tpl.name=`Bảng thông số ${new Date().toLocaleDateString("vi-VN")}`;
    onSaveTemplate(tpl);
    setF(x=>({...x,sourceTemplateId:tpl.id,name:tpl.name}));
  }
  return <div className="fixed inset-0 z-[95] overflow-y-auto overscroll-contain bg-black/50 p-3 pb-[max(16px,env(safe-area-inset-bottom))]" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}><div className="mx-auto max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
    <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white p-4"><div><div className="text-[10px] font-black uppercase text-neutral-400">Thông số mẫu</div><div className="font-black">{f.name||"Bảng mới"}</div></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button></div>
    <div className="space-y-4 p-4">
      <Field l="Tên bảng"><input className={input} value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} placeholder="VD: Quần Short Kaki Relaxed"/></Field>
      <div><div className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-neutral-400">Hệ size</div><div className="grid grid-cols-3 gap-2">{([["SHIRT","Áo"],["PANTS","Quần"],["CUSTOM","Tự chọn"]] as const).map(([k,t])=><button type="button" key={k} onClick={()=>changeKind(k)} className={`rounded-xl border px-2 py-2.5 text-xs font-black ${f.productKind===k?"border-neutral-950 bg-neutral-950 text-white":""}`}>{t}</button>)}</div></div>
      <div><div className="flex gap-2 overflow-x-auto pb-1">{f.sizes.map(s=><button type="button" key={s} onClick={()=>setF(x=>({...x,sizes:x.sizes.filter(v=>v!==s),rows:x.rows.map(r=>{const values={...r.values};delete values[s];return {...r,values}})}))} className="shrink-0 rounded-full bg-neutral-950 px-3 py-2 text-xs font-black text-white">{s} ×</button>)}</div><div className="mt-2 flex gap-2"><input className={input} value={newSize} onChange={e=>setNewSize(e.target.value)} placeholder="Thêm size"/><button type="button" onClick={()=>{const s=newSize.trim().toUpperCase();if(!s||f.sizes.includes(s))return;setF(x=>({...x,sizes:[...x.sizes,s],rows:x.rows.map(r=>({...r,values:{...r.values,[s]:""}}))}));setNewSize("")}} className="shrink-0 rounded-xl border px-3 text-xs font-black">+ Size</button></div></div>
      <div className="rounded-3xl border"><div className="flex items-center justify-between border-b p-3"><div><div className="text-sm font-black">Bảng đo</div><div className="text-[10px] text-neutral-400">Vuốt ngang để xem size.</div></div><button type="button" onClick={addRow} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white">+ Dòng</button></div>
        <div className="overflow-x-auto" style={{WebkitOverflowScrolling:"touch"}}><div style={{minWidth:Math.max(520,190+f.sizes.length*88)}}>
          <div className="grid border-b bg-neutral-50" style={{gridTemplateColumns:`190px repeat(${f.sizes.length},88px)`}}><div className="sticky left-0 z-20 border-r bg-neutral-50 p-3 text-[10px] font-black uppercase text-neutral-400">Thông số</div>{f.sizes.map(s=><div key={s} className="border-r p-3 text-center text-xs font-black">{s}</div>)}</div>
          {f.rows.map((r,ri)=><div key={r.id} className="grid border-b" style={{gridTemplateColumns:`190px repeat(${f.sizes.length},88px)`}}><div className="sticky left-0 z-10 border-r bg-white p-2"><input className="w-full rounded-xl border px-2 py-2 text-[14px] font-bold" value={r.name} onChange={e=>setF(x=>({...x,rows:x.rows.map((v,i)=>i===ri?{...v,name:e.target.value}:v)}))} placeholder="Tên thông số"/><div className="mt-1 flex gap-1"><input className="w-16 rounded-lg border px-2 py-1 text-[11px]" value={r.unit} onChange={e=>setF(x=>({...x,rows:x.rows.map((v,i)=>i===ri?{...v,unit:e.target.value}:v)}))}/><button type="button" onClick={()=>setF(x=>({...x,rows:x.rows.filter((_,i)=>i!==ri)}))} className="ml-auto text-[10px] font-black text-red-600">Xoá</button></div></div>{f.sizes.map(size=><div key={size} className="border-r p-1.5"><input inputMode="decimal" className="h-12 w-full rounded-xl border px-2 text-center text-[16px] font-black" value={r.values?.[size]||""} onChange={e=>setF(x=>({...x,rows:x.rows.map((v,i)=>i===ri?{...v,values:{...v.values,[size]:normalizeMeasurementDecimal(e.target.value)}}:v)}))}/></div>)}</div>)}
          {!f.rows.length&&<div className="p-8 text-center text-xs font-bold text-neutral-400">Chưa có dòng thông số.</div>}
        </div></div>
      </div>
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={saveToLibrary} className="rounded-2xl border py-3 text-xs font-black">Lưu thành bảng mới</button><button type="button" onClick={()=>{onChange(f);onClose()}} className="rounded-2xl bg-neutral-950 py-3 text-xs font-black text-white">Dùng cho mẫu này</button></div>
    </div>
  </div></div>
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
