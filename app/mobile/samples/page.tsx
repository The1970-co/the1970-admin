"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Circle,
  Eraser,
  Camera,
  Download,
  FileUp,
  FlipHorizontal,
  ImagePlus,
  MousePointer2,
  Pencil,
  PenTool,
  Plus,
  Redo2,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Square,
  Type,
  Undo2,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { saveAs } from "file-saver";
import { useEffect, useMemo, useRef, useState } from "react";

type Staff = { id:string; code?:string|null; name:string };
type Factory = { id:string; code:string; name:string; contactName?:string|null; phone?:string|null };
type SamplePerson = { id:string; name:string; role:"SAMPLE_MAKER"|"PATTERN_MAKER"|"BOTH"; phone?:string|null; note?:string|null };
type Board = { id:string; boardCode:string; name?:string|null; fabricCode?:string|null };
type Meta = {
  staff:Staff[];
  boards:Board[];
  factories:Factory[];
  seasons:string[];
  productGroups:string[];
  samplePeople:SamplePerson[];
};
type Sample = any;
type IdeaBoard={id:string;name:string;description?:string|null;createdByName?:string|null;updatedAt?:string|null;samples?:Array<{id:string;boardId:string;designSampleId:string;sortOrder?:number;designSample:any}>};

const SampleImageEditorKonva=dynamic(()=>import("@/components/mobile/SampleImageEditorKonva"),{ssr:false});

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

const SAMPLE_IMAGE_TARGET_BYTES = 9 * 1024 * 1024;

async function sampleImageUnder10MB(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SAMPLE_IMAGE_TARGET_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Không đọc được ảnh ${file.name}.`));
      el.src = objectUrl;
    });

    const naturalW = Math.max(1, img.naturalWidth || img.width || 1);
    const naturalH = Math.max(1, img.naturalHeight || img.height || 1);
    let scale = Math.min(1, 3200 / Math.max(naturalW, naturalH));
    let quality = 0.9;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const width = Math.max(1, Math.round(naturalW * scale));
      const height = Math.max(1, Math.round(naturalH * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Không thể xử lý ảnh.");

      ctx.drawImage(img, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

      if (blob && blob.size <= SAMPLE_IMAGE_TARGET_BYTES) break;

      if (quality > 0.62) quality -= 0.08;
      else scale *= 0.82;
    }

    if (!blob) throw new Error(`Không thể giảm dung lượng ảnh ${file.name}.`);
    if (blob.size > SAMPLE_IMAGE_TARGET_BYTES) {
      throw new Error(`Ảnh ${file.name} vẫn lớn hơn 10MB sau khi tối ưu.`);
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "anh-mau";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
const PATTERN_EXTENSIONS=new Set(["pdf","dxf","dwg","ai","plt","zip","rar","7z","astm","aama","rul","mdl","pds","hpgl","hpg","mrk","pat","cut","nc","svg"]);
function patternExt(name:string){const m=String(name||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?.[1]||""}
function filenameWithMime(filename:string,mime?:string){
  const clean=safeFilename(filename||"anh-mau");
  if(/\.[a-z0-9]{2,6}$/i.test(clean))return clean;
  const ext=String(mime||"").includes("png")?".png":String(mime||"").includes("webp")?".webp":String(mime||"").includes("pdf")?".pdf":".jpg";
  return `${clean}${ext}`;
}
function cloudinaryAttachmentUrl(raw:string,filename:string){
  const url=asset(raw);
  if(!/res\.cloudinary\.com\//i.test(url)||!/\/upload\//.test(url))return url;
  const base=safeFilename(filename).replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]+/g,"-")||"download";
  return url.replace("/upload/",`/upload/fl_attachment:${encodeURIComponent(base)}/`);
}
function isIosDevice(){
  if(typeof navigator==="undefined")return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
}
function isImageFilename(filename:string){return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(String(filename||""))}
async function downloadUrl(url:string,filename:string){
  const resolved=asset(url);
  if(!resolved)return;

  // iOS Safari/PWA không cho web ghi thẳng vào Photos.
  // Với ảnh, mở URL ảnh thật để người dùng giữ ảnh -> "Lưu vào Ảnh".
  if(isIosDevice()&&isImageFilename(filename)){
    const opened=window.open(resolved,"_blank","noopener,noreferrer");
    if(!opened)window.location.href=resolved;
    return;
  }

  try{
    const res=await fetch(resolved,{mode:"cors",credentials:"omit",cache:"no-store"});
    if(!res.ok)throw new Error("download");
    const blob=await res.blob();
    const file=new File([blob],filenameWithMime(filename,blob.type),{type:blob.type||"application/octet-stream"});
    const nav=navigator as Navigator & {canShare?:(data:ShareData)=>boolean};
    if(typeof navigator.share==="function"&&(!nav.canShare||nav.canShare({files:[file]}))){
      await navigator.share({files:[file],title:file.name});
      return;
    }
    saveAs(blob,file.name);
  }catch{
    saveAs(cloudinaryAttachmentUrl(resolved,filename),safeFilename(filename));
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


function sampleParentCategoryMobile(category:any){
  const raw=String(category||"").trim();
  const x=raw.toLocaleLowerCase("vi-VN");
  if(!x)return "Chưa phân loại";
  if(/\b(quần|short|jean|pants|chino)\b/.test(x))return "Quần";
  if(/\b(áo|shirt|jacket|coat|blazer|polo|sơ mi|sweater|len|hoodie|parka|tee|t-shirt)\b/.test(x))return "Áo";
  if(/\b(mũ|nón|túi|thắt lưng|belt|phụ kiện|ví|giày|dép)\b/.test(x))return "Phụ kiện";
  return "Khác";
}
function sampleCreatedLabelMobile(value:any){
  if(!value)return "Chưa có ngày";
  const d=new Date(value);if(Number.isNaN(d.getTime()))return "Chưa có ngày";
  return d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function sampleVisualUrlsMobile(row:any){
  const urls=[
    row?.coverImageUrl,
    ...(Array.isArray(row?.images)?row.images.filter((x:any)=>!isPatternAsset(x)).map((x:any)=>x?.url):[]),
    row?.matchedProduct?.imageUrl,
    row?.producedProduct?.imageUrl,
  ].filter(Boolean).map(String);
  return Array.from(new Set(urls));
}

export default function Page(){
  const [rows,setRows]=useState<Sample[]>([]);
  const [meta,setMeta]=useState<Meta>({staff:[],boards:[],factories:[],seasons:[],productGroups:[],samplePeople:[]});
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [detail,setDetail]=useState<Sample|null>(null);
  const [editing,setEditing]=useState<Sample|null|undefined>(undefined);
  const [dispatching,setDispatching]=useState<Sample|null>(null);
  const [user,setUser]=useState<any>(null);
  const [sampleTab,setSampleTab]=useState<"IDEA"|"DEPLOY">("IDEA");
  const [parentFilter,setParentFilter]=useState("");
  const [subFilter,setSubFilter]=useState("");
  const [sortMode,setSortMode]=useState<"NEWEST"|"AZ">("NEWEST");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [viewMode,setViewMode]=useState<"LIST"|"PINTEREST">("LIST");
  const [ideaBoards,setIdeaBoards]=useState<IdeaBoard[]>([]);
  const [boardFilter,setBoardFilter]=useState("");
  const [boardForm,setBoardForm]=useState<{id?:string;name:string;description:string}|null>(null);
  const [assignSample,setAssignSample]=useState<Sample|null>(null);
  const [assignBoardIds,setAssignBoardIds]=useState<string[]>([]);
  const [boardBusy,setBoardBusy]=useState(false);
  const [boardHubOpen,setBoardHubOpen]=useState(false);

  const permissions=useMemo(()=>getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId),[user]);
  const can=(key:string)=>isAdmin(user)||permissions.includes("*")||permissions.includes(key);

  async function load(){
    try{
      setLoading(true);setError("");
      const [samples,m,boards]=await Promise.all([
        api<Sample[]>("/sample-fabric/samples"),
        api<Meta>("/sample-fabric/samples/meta"),
        api<IdeaBoard[]>("/sample-fabric/samples/idea-boards"),
      ]);
      setRows(Array.isArray(samples)?samples:[]);
      setIdeaBoards(Array.isArray(boards)?boards:[]);
      setMeta({
        staff:Array.isArray(m.staff)?m.staff:[],
        boards:Array.isArray(m.boards)?m.boards:[],
        factories:Array.isArray(m.factories)?m.factories:[],
        seasons:Array.isArray(m.seasons)?m.seasons:[],
        productGroups:Array.isArray(m.productGroups)?m.productGroups:[],
        samplePeople:Array.isArray((m as any).samplePeople)?(m as any).samplePeople:[],
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

  function rowBoardIds(row:any){return (Array.isArray(row?.ideaBoards)?row.ideaBoards:[]).map((x:any)=>String(x?.boardId||x?.board?.id||"")).filter(Boolean)}
  function rowBoardNames(row:any){return (Array.isArray(row?.ideaBoards)?row.ideaBoards:[]).map((x:any)=>x?.board?.name).filter(Boolean)}
  const unassignedIdeaCount=rows.filter(r=>String(r.status||"IDEA")==="IDEA"&&!rowBoardIds(r).length).length;

  async function saveIdeaBoard(){
    if(!boardForm?.name.trim())return;
    try{
      setBoardBusy(true);setError("");
      await api(boardForm.id?`/sample-fabric/samples/idea-boards/${boardForm.id}`:"/sample-fabric/samples/idea-boards",{
        method:boardForm.id?"PATCH":"POST",
        body:JSON.stringify({name:boardForm.name.trim(),description:boardForm.description.trim()||null}),
      });
      setBoardForm(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Không lưu được bảng ý tưởng.")}
    finally{setBoardBusy(false)}
  }

  async function deleteIdeaBoard(board:IdeaBoard){
    if(!window.confirm(`Xoá bảng "${board.name}"? Mẫu bên trong không bị xoá.`))return;
    try{
      setBoardBusy(true);setError("");
      await api(`/sample-fabric/samples/idea-boards/${board.id}`,{method:"DELETE"});
      if(boardFilter===board.id)setBoardFilter("");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Không xoá được bảng ý tưởng.")}
    finally{setBoardBusy(false)}
  }

  function openBoardAssign(row:any){setAssignSample(row);setAssignBoardIds(rowBoardIds(row))}
  async function saveBoardAssign(){
    if(!assignSample)return;
    try{
      setBoardBusy(true);setError("");
      await api(`/sample-fabric/samples/${assignSample.id}/idea-boards`,{method:"PATCH",body:JSON.stringify({boardIds:assignBoardIds})});
      setAssignSample(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Không lưu được bảng cho mẫu.")}
    finally{setBoardBusy(false)}
  }

  const parentOptions=useMemo(()=>Array.from(new Set(rows.map(r=>sampleParentCategoryMobile(r.category)))).sort((a,b)=>a.localeCompare(b,"vi")),[rows]);
  const subOptions=useMemo(()=>Array.from(new Set(rows.filter(r=>!parentFilter||sampleParentCategoryMobile(r.category)===parentFilter).map(r=>String(r.category||"Chưa phân loại").trim()||"Chưa phân loại"))).sort((a,b)=>a.localeCompare(b,"vi")),[rows,parentFilter]);

  const filtered=useMemo(()=>{
    const k=q.trim().toLowerCase();
    const list=rows.filter(r=>{
      const inTab=sampleTab==="IDEA"?String(r.status||"IDEA")==="IDEA":String(r.status||"IDEA")!=="IDEA";
      if(!inTab)return false;
      if(sampleTab==="IDEA"&&boardFilter==="__UNASSIGNED__"&&rowBoardIds(r).length)return false;
      if(sampleTab==="IDEA"&&boardFilter&&boardFilter!=="__UNASSIGNED__"&&!rowBoardIds(r).includes(boardFilter))return false;
      if(parentFilter&&sampleParentCategoryMobile(r.category)!==parentFilter)return false;
      if(subFilter&&String(r.category||"Chưa phân loại").trim()!==subFilter)return false;
      if(!k)return true;
      return [
        r.code,r.name,r.season,r.category,r.fabricBoard?.boardCode,
        r.fabricColorName,r.fabricColorCode,r.sampleFactoryName,r.assigneeName
      ].some(v=>String(v||"").toLowerCase().includes(k));
    });
    return [...list].sort((a,b)=>{
      if(sortMode==="AZ")return String(a.name||a.code).localeCompare(String(b.name||b.code),"vi",{numeric:true,sensitivity:"base"});
      return (new Date(b.createdAt||b.updatedAt||`${b.year}-01-01`).getTime()||0)-(new Date(a.createdAt||a.updatedAt||`${a.year}-01-01`).getTime()||0);
    });
  },[rows,q,sampleTab,parentFilter,subFilter,sortMode,boardFilter]);

  async function moveSample(sample:Sample,target:"IDEA"|"DEPLOY"){
    if(!can("design_sample.edit"))return;
    const status=target==="IDEA"?"IDEA":"FABRIC_SELECTED";
    try{
      setError("");
      await api(`/sample-fabric/samples/${sample.id}`,{method:"PATCH",body:JSON.stringify({status})});
      if(detail?.id===sample.id)setDetail({...detail,status});
      setSampleTab(target);setBoardFilter("");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Không chuyển được mẫu.")}
  }

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
      <header className="relative z-10 border-b bg-white px-3 pb-2" style={{paddingTop:"max(44px, calc(env(safe-area-inset-top) + 8px))"}}>
        <div className="flex min-h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/mobile/production" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">Sản xuất</div>
              <h1 className="truncate text-[19px] font-black leading-5">Triển khai mẫu</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
            {can("design_sample.create")&&<button onClick={()=>setEditing(null)} className="h-10 rounded-full bg-neutral-950 px-3.5 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Tạo mẫu</button>}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1 overflow-x-auto border-b border-neutral-100 pb-1">
          <button type="button" onClick={()=>{setSampleTab("IDEA");setBoardFilter("")}} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${sampleTab==="IDEA"?"bg-neutral-950 text-white":"text-neutral-500"}`}>Ý tưởng · {rows.filter(x=>String(x.status||"IDEA")==="IDEA").length}</button>
          <button type="button" onClick={()=>{setSampleTab("DEPLOY");setBoardFilter("")}} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${sampleTab==="DEPLOY"?"bg-neutral-950 text-white":"text-neutral-500"}`}>Triển khai · {rows.filter(x=>String(x.status||"IDEA")!=="IDEA").length}</button>
          {sampleTab==="IDEA"&&boardFilter&&<button type="button" onClick={()=>setBoardHubOpen(true)} className="max-w-40 shrink-0 truncate rounded-full bg-neutral-100 px-3 py-2 text-xs font-black text-neutral-700">{boardFilter==="__UNASSIGNED__"?"Chưa phân bảng":ideaBoards.find(b=>b.id===boardFilter)?.name||"Bảng"}</button>}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input className={`${input} h-11 rounded-full py-2.5 pl-4 pr-3 text-[16px]`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm mẫu..." onBlur={resetIosZoom}/>
          </div>

          <button type="button" onClick={()=>setFiltersOpen(x=>!x)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${filtersOpen||parentFilter||subFilter||sortMode!=="NEWEST"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`} aria-label="Bộ lọc">
            <span className="text-[11px] font-black">Lọc</span>
          </button>

          <button type="button" onClick={()=>setBoardHubOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white" aria-label="Bảng và kiểu hiển thị">
            <span className="grid h-5 w-5 grid-cols-2 gap-[2px]">
              <span className="rounded-[2px] bg-neutral-950"/><span className="rounded-[2px] bg-neutral-950"/>
              <span className="rounded-[2px] bg-neutral-950"/><span className="rounded-[2px] bg-neutral-950"/>
            </span>
          </button>
        </div>

        {filtersOpen&&<div className="mt-2 grid gap-2 rounded-2xl bg-neutral-50 p-2">
          <select className={input} value={parentFilter} onChange={e=>{setParentFilter(e.target.value);setSubFilter("")}} onBlur={resetIosZoom}><option value="">Tất cả danh mục</option>{parentOptions.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <select className={input} value={subFilter} onChange={e=>setSubFilter(e.target.value)} onBlur={resetIosZoom}><option value="">{parentFilter?`Tất cả loại ${parentFilter.toLowerCase()}`:"Tất cả loại mẫu"}</option>{subOptions.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <select className={input} value={sortMode} onChange={e=>setSortMode(e.target.value as any)} onBlur={resetIosZoom}><option value="NEWEST">Mới tạo trước</option><option value="AZ">Tên A → Z</option></select>
        </div>}
      </header>

      <div className="space-y-3 px-2 pb-4 pt-2">
        {error&&<Err x={error}/>}
        {loading&&<div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">Đang tải...</div>}

        {!loading&&viewMode==="LIST"&&filtered.map(r=>{
          const visuals=sampleVisualUrlsMobile(r);
          const image=visuals[0]?asset(visuals[0]):"";
          return <div key={r.id} className="rounded-[28px] bg-white p-4 shadow-sm">
            <button type="button" onClick={()=>setDetail(r)} className="flex w-full gap-4 text-left active:scale-[.995]">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                {image?<img src={image} className="h-full w-full object-cover" alt=""/>:<div className="grid h-full place-items-center text-2xl text-neutral-300">✦</div>}
                {visuals.length>1&&<div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-lg bg-black/70 p-0.5">{visuals.slice(1,3).map((url:string,i:number)=><img key={`${url}-${i}`} src={asset(url)} className="h-5 w-5 rounded object-cover"/>)}{visuals.length>3&&<span className="px-0.5 text-[8px] font-black text-white">+{visuals.length-3}</span>}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-neutral-400">{r.code} · {r.year}</div>
                <div className="mt-1 text-base font-black">{r.name}</div>
                <div className="mt-1 text-[11px] font-bold text-neutral-400">Tạo {sampleCreatedLabelMobile(r.createdAt)}</div>
                <div className="mt-1 text-xs text-neutral-500">{sampleParentCategoryMobile(r.category)} · {r.category||"Chưa phân loại"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{statusLabel(r.status)}</Badge>
                  {visuals.length>1&&<Badge>{visuals.length} ảnh</Badge>}
                  {r.fabricColorName&&<Badge>{r.fabricColorName} {r.fabricColorCode||""}</Badge>}
                  {sampleTab==="IDEA"&&rowBoardNames(r).slice(0,2).map((name:string)=><Badge key={name}>{name}</Badge>)}
                </div>
              </div>
            </button>
            {can("design_sample.edit")&&<div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">
              {sampleTab==="IDEA"&&<button type="button" onClick={()=>openBoardAssign(r)} className="rounded-xl border px-3 py-2 text-xs font-black">Bảng ý tưởng</button>}
              <button type="button" onClick={()=>void moveSample(r,sampleTab==="IDEA"?"DEPLOY":"IDEA")} className="rounded-xl border px-3 py-2 text-xs font-black">
                {sampleTab==="IDEA"?"Chuyển sang triển khai →":"← Đưa về ý tưởng"}
              </button>
            </div>}
          </div>
        })}

        {!loading&&viewMode==="PINTEREST"&&<div className="columns-2 gap-1.5">
          {filtered.map(r=>{
            const visuals=sampleVisualUrlsMobile(r);
            const image=visuals[0]?asset(visuals[0]):"";
            return <div key={r.id} className="mb-1.5 break-inside-avoid overflow-hidden rounded-[18px] bg-white">
              <button type="button" onClick={()=>setDetail(r)} className="block w-full text-left active:opacity-80">
                {image?<img src={image} className="block h-auto w-full object-contain" alt=""/>:<div className="grid h-36 place-items-center bg-neutral-100 text-2xl text-neutral-300">✦</div>}
                <div className="p-2.5">
                  <div className="line-clamp-2 text-xs font-black">{r.name}</div>
                  <div className="mt-1 text-[10px] font-bold text-neutral-400">{r.code} · {sampleCreatedLabelMobile(r.createdAt)}</div>
                  <div className="mt-1 text-[10px] text-neutral-500">{r.category||"Chưa phân loại"}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge>{statusLabel(r.status)}</Badge>
                    {visuals.length>1&&<Badge>{visuals.length} ảnh</Badge>}
                  </div>
                </div>
              </button>
              {can("design_sample.edit")&&<div className="grid grid-cols-2 gap-1 border-t p-2">
                {sampleTab==="IDEA"&&<button type="button" onClick={()=>openBoardAssign(r)} className="rounded-xl border px-2 py-2 text-[10px] font-black">+ Bảng</button>}
                <button type="button" onClick={()=>void moveSample(r,sampleTab==="IDEA"?"DEPLOY":"IDEA")} className={`rounded-xl border px-2 py-2 text-[10px] font-black ${sampleTab==="DEPLOY"?"col-span-2":""}`}>
                  {sampleTab==="IDEA"?"→ Triển khai":"← Ý tưởng"}
                </button>
              </div>}
            </div>
          })}
        </div>}
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
      ideaBoards={ideaBoards}
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

    
    {boardHubOpen&&<Modal title="Bảng & kiểu hiển thị" onClose={()=>setBoardHubOpen(false)}>
      <div className="space-y-5 p-4">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">Kiểu hiển thị</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>{setViewMode("PINTEREST");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${viewMode==="PINTEREST"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
              <div className="grid h-10 w-10 grid-cols-2 gap-1">
                <span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/><span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/>
                <span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/><span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/>
              </div>
              <div className="mt-2 text-sm font-black">Pinterest</div>
              <div className={`mt-0.5 text-[10px] ${viewMode==="PINTEREST"?"text-white/60":"text-neutral-400"}`}>Ảnh lớn, 2 cột</div>
            </button>
            <button type="button" onClick={()=>{setViewMode("LIST");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${viewMode==="LIST"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
              <div className="space-y-1.5 pt-1">
                <span className={`block h-2.5 rounded ${viewMode==="LIST"?"bg-white":"bg-neutral-950"}`}/>
                <span className={`block h-2.5 rounded ${viewMode==="LIST"?"bg-white":"bg-neutral-950"}`}/>
                <span className={`block h-2.5 rounded ${viewMode==="LIST"?"bg-white":"bg-neutral-950"}`}/>
              </div>
              <div className="mt-3 text-sm font-black">Danh sách</div>
              <div className={`mt-0.5 text-[10px] ${viewMode==="LIST"?"text-white/60":"text-neutral-400"}`}>Xem đủ thông tin</div>
            </button>
          </div>
        </div>

        {sampleTab==="IDEA"&&<div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">Bảng ý tưởng</div>
            {can("design_sample.edit")&&<button type="button" onClick={()=>{setBoardHubOpen(false);setBoardForm({name:"",description:""})}} className="rounded-full border px-3 py-2 text-[10px] font-black">+ Tạo bảng</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={()=>{setBoardFilter("");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${boardFilter===""?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
              <div className="text-sm font-black">Tất cả</div>
              <div className={`mt-1 text-[10px] ${boardFilter===""?"text-white/60":"text-neutral-400"}`}>{rows.filter(x=>String(x.status||"IDEA")==="IDEA").length} mẫu</div>
            </button>
            <button type="button" onClick={()=>{setBoardFilter("__UNASSIGNED__");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${boardFilter==="__UNASSIGNED__"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
              <div className="text-sm font-black">Chưa phân bảng</div>
              <div className={`mt-1 text-[10px] ${boardFilter==="__UNASSIGNED__"?"text-white/60":"text-neutral-400"}`}>{unassignedIdeaCount} mẫu</div>
            </button>
            {ideaBoards.map(board=>{
              const linked=(board.samples||[]).map(x=>x.designSample).filter(Boolean);
              const ideas=linked.filter(x=>String(x.status||"IDEA")==="IDEA");
              const thumbs=ideas.flatMap((x:any)=>sampleVisualUrlsMobile(x)).slice(0,4);
              return <div key={board.id} className={`overflow-hidden rounded-2xl border ${boardFilter===board.id?"border-neutral-950 ring-1 ring-neutral-950":"bg-white"}`}>
                <button type="button" onClick={()=>{setBoardFilter(board.id);setBoardHubOpen(false)}} className="w-full text-left">
                  <div className="grid aspect-[1.7/1] grid-cols-2 gap-[1px] overflow-hidden bg-neutral-100">
                    {[0,1,2,3].map(i=>thumbs[i]?<img key={i} src={asset(thumbs[i])} className="h-full w-full object-cover" alt=""/>:<div key={i} className="bg-neutral-100"/>)}
                  </div>
                  <div className="p-2.5"><div className="truncate text-xs font-black">{board.name}</div><div className="mt-0.5 text-[10px] text-neutral-400">{ideas.length} ý tưởng</div></div>
                </button>
                {can("design_sample.edit")&&<div className="flex border-t p-1"><button type="button" onClick={()=>{setBoardHubOpen(false);setBoardForm({id:board.id,name:board.name,description:board.description||""})}} className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-black">Sửa</button><button type="button" onClick={()=>void deleteIdeaBoard(board)} className="rounded-lg px-2 py-1.5 text-[10px] font-black text-red-600">Xoá</button></div>}
              </div>
            })}
          </div>
        </div>}
      </div>
    </Modal>}

    {boardForm&&<Modal title={boardForm.id?"Sửa bảng ý tưởng":"Tạo bảng ý tưởng"} onClose={()=>setBoardForm(null)}>
      <div className="space-y-4 p-4">
        <label className="block"><div className="mb-1 text-xs font-black uppercase text-neutral-400">Tên bảng</div><input autoFocus className={input} value={boardForm.name} onChange={e=>setBoardForm({...boardForm,name:e.target.value})} placeholder="VD: Mẫu trẻ em" onBlur={resetIosZoom}/></label>
        <label className="block"><div className="mb-1 text-xs font-black uppercase text-neutral-400">Mô tả</div><textarea className={`${input} min-h-28`} value={boardForm.description} onChange={e=>setBoardForm({...boardForm,description:e.target.value})} placeholder="Ghi chú ngắn..." onBlur={resetIosZoom}/></label>
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={()=>setBoardForm(null)} className="rounded-2xl border px-4 py-3 text-sm font-black">Huỷ</button><button type="button" disabled={boardBusy||!boardForm.name.trim()} onClick={()=>void saveIdeaBoard()} className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{boardBusy?"Đang lưu...":"Lưu bảng"}</button></div>
      </div>
    </Modal>}

    {assignSample&&<Modal title={`Bảng ý tưởng · ${assignSample.code}`} onClose={()=>setAssignSample(null)}>
      <div className="space-y-4 p-4">
        <div><div className="font-black">{assignSample.name}</div><div className="text-xs text-neutral-400">Có thể chọn nhiều bảng.</div></div>
        <div className="space-y-2">{ideaBoards.map(board=>{const checked=assignBoardIds.includes(board.id);return <label key={board.id} className="flex items-start gap-3 rounded-2xl border p-3"><input type="checkbox" checked={checked} onChange={()=>setAssignBoardIds(x=>checked?x.filter(id=>id!==board.id):[...x,board.id])} className="mt-1 h-5 w-5"/><div className="min-w-0"><div className="font-black">{board.name}</div>{board.description&&<div className="mt-1 text-xs text-neutral-400">{board.description}</div>}</div></label>})}{!ideaBoards.length&&<div className="rounded-2xl bg-neutral-50 p-6 text-center text-sm font-bold text-neutral-400">Chưa có bảng ý tưởng.</div>}</div>
        <div className="flex items-center justify-between gap-2 border-t pt-4"><button type="button" onClick={()=>{setAssignSample(null);setBoardForm({name:"",description:""})}} className="rounded-2xl border px-3 py-3 text-xs font-black">+ Tạo bảng</button><button type="button" disabled={boardBusy} onClick={()=>void saveBoardAssign()} className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Lưu</button></div>
      </div>
    </Modal>}

  </main>
}

type ImageEditorTool="select"|"arrowText"|"text"|"circle"|"rect"|"pen";
type EditorPoint={x:number;y:number};
type EditorAnnotation={
  id:string;
  type:"arrowText"|"text"|"circle"|"rect"|"pen";
  color:string;
  strokeWidth:number;
  fontSize:number;
  fontFamily:string;
  text?:string;
  target?:EditorPoint;
  label?:EditorPoint;
  center?:EditorPoint;
  width?:number;
  height?:number;
  points?:EditorPoint[];
};

function editorUid(){return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
function clamp01(v:number){return Math.max(0,Math.min(1,v))}
function canvasArrow(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color:string,width:number){
  const head=Math.max(10,width*4);
  const angle=Math.atan2(y2-y1,x2-x1);
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(angle-Math.PI/7),y2-head*Math.sin(angle-Math.PI/7));
  ctx.lineTo(x2-head*Math.cos(angle+Math.PI/7),y2-head*Math.sin(angle+Math.PI/7));
  ctx.closePath();ctx.fill();ctx.restore();
}

function DetailModal({sample,can,onClose,onEdit,onDelete,onDispatch,onChanged}:{sample:Sample;can:(k:string)=>boolean;onClose:()=>void;onEdit:()=>void;onDelete:()=>void;onDispatch:()=>void;onChanged:()=>void}){
  const dispatches=Array.isArray(sample.sampleDispatches)?sample.sampleDispatches:[];
  const patternAttachments=(sample.images||[]).filter((x:any)=>isPatternAsset(x)).map((x:any)=>({...x,...parsePatternCaption(x.caption)}));
  const visualUrls=(sample.images||[]).filter((x:any)=>!isPatternAsset(x)).map((x:any)=>x?.url).filter(Boolean);
  const initialGallery=Array.from(new Set([
    sample.coverImageUrl||visualUrls[0],
    ...visualUrls,
    sample.matchedProduct?.imageUrl,
  ].filter(Boolean).map((x:any)=>asset(x))));
  const [gallery,setGallery]=useState<string[]>(initialGallery);
  const [viewerIndex,setViewerIndex]=useState<number>(0);
  const image=gallery[viewerIndex]||gallery[0]||"";
  const [detailExpanded,setDetailExpanded]=useState(false);
  const swipeStartX=useRef<number|null>(null);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [zoomScale,setZoomScale]=useState(1);
  const [zoomPos,setZoomPos]=useState({x:0,y:0});
  const zoomGesture=useRef<any>({});
  const [editMode,setEditMode]=useState(false);
  const [rotate,setRotate]=useState(0);
  const [flipX,setFlipX]=useState(false);
  const [cropRatio,setCropRatio]=useState<"original"|"1:1"|"4:5"|"3:4">("original");
  const [brightness,setBrightness]=useState(100);
  const [contrast,setContrast]=useState(100);
  const [editBusy,setEditBusy]=useState(false);
  const [viewerError,setViewerError]=useState("");
  const editorRef=useRef<HTMLDivElement|null>(null);
  const [tool,setTool]=useState<ImageEditorTool>("select");
  const [annotations,setAnnotations]=useState<EditorAnnotation[]>([]);
  const [selectedAnnotationId,setSelectedAnnotationId]=useState<string|null>(null);
  const [annotationColor,setAnnotationColor]=useState("#ff3b30");
  const [annotationFontSize,setAnnotationFontSize]=useState(22);
  const [annotationFontFamily,setAnnotationFontFamily]=useState("Arial");
  const [annotationStrokeWidth,setAnnotationStrokeWidth]=useState(3);
  const [undoStack,setUndoStack]=useState<EditorAnnotation[][]>([]);
  const [redoStack,setRedoStack]=useState<EditorAnnotation[][]>([]);
  type EditorDragMode="createArrow"|"createShape"|"pen"|"move"|"arrowTarget"|"arrowLabel"|"shapeResize";
  const dragRef=useRef<{id:string;mode:EditorDragMode;start:EditorPoint;original:EditorAnnotation}|null>(null);
  const openViewer=(url:string)=>{const i=gallery.indexOf(url);setViewerIndex(i>=0?i:0);setEditMode(false);setViewerError("")};
  const closeViewer=()=>{setEditMode(false);setViewerError("")};
  const prevImage=()=>setViewerIndex(i=>(i-1+gallery.length)%gallery.length);
  const nextImage=()=>setViewerIndex(i=>(i+1)%gallery.length);
  function galleryTouchStart(e:any){swipeStartX.current=e.touches?.[0]?.clientX??null}
  function galleryTouchEnd(e:any){
    const start=swipeStartX.current;
    const end=e.changedTouches?.[0]?.clientX;
    swipeStartX.current=null;
    if(start==null||end==null||gallery.length<2)return;
    const dx=end-start;
    if(Math.abs(dx)<45)return;
    dx<0?nextImage():prevImage();
  }
  function openZoom(){
    if(!image)return;
    setZoomScale(1);
    setZoomPos({x:0,y:0});
    zoomGesture.current={};
    setZoomOpen(true);
  }
  function closeZoom(){
    setZoomOpen(false);
    setZoomScale(1);
    setZoomPos({x:0,y:0});
    zoomGesture.current={};
  }
  function touchDistance(t:any){
    const dx=t[0].clientX-t[1].clientX;
    const dy=t[0].clientY-t[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }
  function zoomTouchStart(e:any){
    const t=e.touches;
    if(t.length===2){
      zoomGesture.current={
        mode:"pinch",
        startDistance:touchDistance(t),
        startScale:zoomScale,
      };
    }else if(t.length===1&&zoomScale>1){
      zoomGesture.current={
        mode:"pan",
        startX:t[0].clientX,
        startY:t[0].clientY,
        originX:zoomPos.x,
        originY:zoomPos.y,
      };
    }
  }
  function zoomTouchMove(e:any){
    const t=e.touches;
    if(t.length===2){
      e.preventDefault();
      const g=zoomGesture.current;
      const startDistance=g.startDistance||touchDistance(t);
      const startScale=g.startScale||zoomScale;
      const next=Math.max(1,Math.min(4,startScale*(touchDistance(t)/Math.max(1,startDistance))));
      setZoomScale(next);
      if(next<=1.02)setZoomPos({x:0,y:0});
    }else if(t.length===1&&zoomScale>1&&zoomGesture.current.mode==="pan"){
      e.preventDefault();
      const g=zoomGesture.current;
      setZoomPos({
        x:(g.originX||0)+(t[0].clientX-(g.startX||0)),
        y:(g.originY||0)+(t[0].clientY-(g.startY||0)),
      });
    }
  }
  function zoomTouchEnd(){
    zoomGesture.current={};
    if(zoomScale<1.05){
      setZoomScale(1);
      setZoomPos({x:0,y:0});
    }
  }
  function resetEdit(){
    setRotate(0);setFlipX(false);setCropRatio("original");setBrightness(100);setContrast(100);setViewerError("");
    setTool("select");setAnnotations([]);setSelectedAnnotationId(null);setUndoStack([]);setRedoStack([]);
  }
  function editorPoint(e:any):EditorPoint{
    const box=editorRef.current?.getBoundingClientRect();
    if(!box||!box.width||!box.height)return{x:.5,y:.5};
    return{x:clamp01((e.clientX-box.left)/box.width),y:clamp01((e.clientY-box.top)/box.height)};
  }
  function cloneAnnotations(rows:EditorAnnotation[]){return rows.map(a=>({...a,target:a.target?{...a.target}:undefined,label:a.label?{...a.label}:undefined,center:a.center?{...a.center}:undefined,points:a.points?.map(p=>({...p}))}))}
  function pushUndoSnapshot(snapshot?:EditorAnnotation[]){
    const snap=cloneAnnotations(snapshot||annotations);
    setUndoStack(h=>[...h,snap].slice(-40));
    setRedoStack([]);
  }
  function commitAnnotations(make:(prev:EditorAnnotation[])=>EditorAnnotation[]){
    setAnnotations(prev=>{
      pushUndoSnapshot(prev);
      return make(prev);
    });
  }
  function undoAnnotation(){
    setUndoStack(h=>{
      if(!h.length)return h;
      const previous=h[h.length-1];
      setRedoStack(r=>[cloneAnnotations(annotations),...r].slice(0,40));
      setAnnotations(cloneAnnotations(previous));
      setSelectedAnnotationId(null);
      return h.slice(0,-1);
    });
  }
  function redoAnnotation(){
    setRedoStack(r=>{
      if(!r.length)return r;
      const next=r[0];
      setUndoStack(h=>[...h,cloneAnnotations(annotations)].slice(-40));
      setAnnotations(cloneAnnotations(next));
      setSelectedAnnotationId(null);
      return r.slice(1);
    });
  }
  function selectAnnotation(a:EditorAnnotation){
    setSelectedAnnotationId(a.id);
    setTool("select");
    setAnnotationColor(a.color||"#ff3b30");
    setAnnotationStrokeWidth(a.strokeWidth||3);
    setAnnotationFontSize(a.fontSize||22);
    setAnnotationFontFamily(a.fontFamily||"Arial");
  }
  function patchSelectedLive(patch:Partial<EditorAnnotation>){
    if(!selectedAnnotationId)return;
    setAnnotations(prev=>prev.map(a=>a.id===selectedAnnotationId?{...a,...patch}:a));
  }
  function deleteSelectedAnnotation(){
    if(!selectedAnnotationId)return;
    commitAnnotations(prev=>prev.filter(a=>a.id!==selectedAnnotationId));
    setSelectedAnnotationId(null);
  }
  function capturePointer(e:any){
    try{e.currentTarget?.setPointerCapture?.(e.pointerId)}catch{}
  }
  function beginManipulation(e:any,a:EditorAnnotation,mode:EditorDragMode){
    e.preventDefault();e.stopPropagation();
    selectAnnotation(a);
    pushUndoSnapshot();
    dragRef.current={id:a.id,mode,start:editorPoint(e),original:cloneAnnotations([a])[0]};
    capturePointer(e);
  }
  function beginAnnotation(e:any){
    if(!editMode)return;
    if((e.target as HTMLElement)?.closest?.("[data-editor-handle='1']"))return;
    const p=editorPoint(e);

    if(tool==="select"){
      const dist=(a:EditorPoint,b:EditorPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
      const lineDist=(q:EditorPoint,a:EditorPoint,b:EditorPoint)=>{const vx=b.x-a.x,vy=b.y-a.y,wx=q.x-a.x,wy=q.y-a.y;const c2=vx*vx+vy*vy||1;const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/c2));return Math.hypot(q.x-(a.x+t*vx),q.y-(a.y+t*vy))};
      for(const a of [...annotations].reverse()){
        if(a.type==="arrowText"&&a.target&&a.label){
          if(dist(p,a.target)<.055){beginManipulation(e,a,"arrowTarget");return}
          if(dist(p,a.label)<.075){beginManipulation(e,a,"arrowLabel");return}
          if(lineDist(p,a.label,a.target)<.035){beginManipulation(e,a,"move");return}
        }
        if(a.type==="text"&&a.label&&dist(p,a.label)<.10){beginManipulation(e,a,"move");return}
        if((a.type==="circle"||a.type==="rect")&&a.center){
          const w=a.width||.24,h=a.height||.16;const corner={x:a.center.x+w/2,y:a.center.y+h/2};
          if(dist(p,corner)<.065){beginManipulation(e,a,"shapeResize");return}
          const nx=Math.abs((p.x-a.center.x)/(w/2||1)),ny=Math.abs((p.y-a.center.y)/(h/2||1));
          if(nx<=1.25&&ny<=1.25){beginManipulation(e,a,"move");return}
        }
        if(a.type==="pen"&&a.points?.some(q=>dist(p,q)<.045)){beginManipulation(e,a,"move");return}
      }
      setSelectedAnnotationId(null);
      return;
    }

    if(tool==="text"){
      const a:EditorAnnotation={id:editorUid(),type:"text",color:annotationColor,strokeWidth:annotationStrokeWidth,fontSize:annotationFontSize,fontFamily:annotationFontFamily,text:"Ghi chú",label:p};
      pushUndoSnapshot();
      setAnnotations(prev=>[...prev,a]);
      selectAnnotation(a);
      return;
    }

    if(tool==="arrowText"){
      const a:EditorAnnotation={id:editorUid(),type:"arrowText",color:annotationColor,strokeWidth:annotationStrokeWidth,fontSize:annotationFontSize,fontFamily:annotationFontFamily,text:"Ghi chú",target:p,label:p};
      pushUndoSnapshot();
      setAnnotations(prev=>[...prev,a]);
      setSelectedAnnotationId(a.id);
      dragRef.current={id:a.id,mode:"createArrow",start:p,original:cloneAnnotations([a])[0]};
      capturePointer(e);
      return;
    }

    if(tool==="circle"||tool==="rect"){
      const a:EditorAnnotation={id:editorUid(),type:tool,color:annotationColor,strokeWidth:annotationStrokeWidth,fontSize:annotationFontSize,fontFamily:annotationFontFamily,center:p,width:.001,height:.001};
      pushUndoSnapshot();
      setAnnotations(prev=>[...prev,a]);
      setSelectedAnnotationId(a.id);
      dragRef.current={id:a.id,mode:"createShape",start:p,original:cloneAnnotations([a])[0]};
      capturePointer(e);
      return;
    }

    if(tool==="pen"){
      const a:EditorAnnotation={id:editorUid(),type:"pen",color:annotationColor,strokeWidth:annotationStrokeWidth,fontSize:annotationFontSize,fontFamily:annotationFontFamily,points:[p]};
      pushUndoSnapshot();
      setAnnotations(prev=>[...prev,a]);
      setSelectedAnnotationId(a.id);
      dragRef.current={id:a.id,mode:"pen",start:p,original:cloneAnnotations([a])[0]};
      capturePointer(e);
    }
  }
  function moveAnnotation(e:any){
    const drag=dragRef.current;
    if(!drag)return;
    e.preventDefault();
    const p=editorPoint(e);
    const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    setAnnotations(prev=>prev.map(a=>{
      if(a.id!==drag.id)return a;
      const o=drag.original;

      if(drag.mode==="createArrow"){
        return {...a,label:p};
      }
      if(drag.mode==="createShape"){
        const w=Math.max(.015,Math.abs(p.x-drag.start.x));
        const h=Math.max(.015,Math.abs(p.y-drag.start.y));
        return {...a,center:{x:(p.x+drag.start.x)/2,y:(p.y+drag.start.y)/2},width:w,height:h};
      }
      if(drag.mode==="pen"){
        return {...a,points:[...(a.points||[]),p]};
      }
      if(drag.mode==="arrowTarget"){
        return {...a,target:p};
      }
      if(drag.mode==="arrowLabel"){
        return {...a,label:p};
      }
      if(drag.mode==="shapeResize"&&o.center){
        return {...a,width:Math.max(.02,Math.abs(p.x-o.center.x)*2),height:Math.max(.02,Math.abs(p.y-o.center.y)*2)};
      }
      if(drag.mode==="move"){
        if(o.type==="arrowText")return {...a,target:o.target?{x:clamp01(o.target.x+dx),y:clamp01(o.target.y+dy)}:undefined,label:o.label?{x:clamp01(o.label.x+dx),y:clamp01(o.label.y+dy)}:undefined};
        if(o.type==="text")return {...a,label:o.label?{x:clamp01(o.label.x+dx),y:clamp01(o.label.y+dy)}:undefined};
        if(o.type==="circle"||o.type==="rect")return {...a,center:o.center?{x:clamp01(o.center.x+dx),y:clamp01(o.center.y+dy)}:undefined};
        if(o.type==="pen")return {...a,points:o.points?.map(q=>({x:clamp01(q.x+dx),y:clamp01(q.y+dy)}))};
      }
      return a;
    }));
  }
  function endAnnotation(e?:any){
    const drag=dragRef.current;
    if(!drag)return;
    if(drag.mode==="createArrow"){
      setAnnotations(prev=>prev.map(a=>{
        if(a.id!==drag.id||!a.target||!a.label)return a;
        const distance=Math.hypot(a.label.x-a.target.x,a.label.y-a.target.y);
        if(distance>.025)return a;
        return {...a,label:{x:clamp01(a.target.x+.24),y:clamp01(a.target.y-.12)}};
      }));
    }
    if(drag.mode==="createShape"){
      setAnnotations(prev=>prev.map(a=>a.id===drag.id&&((a.width||0)<.03||(a.height||0)<.03)?{...a,width:.22,height:.14}:a));
    }
    dragRef.current=null;
    setTool("select");
    try{e?.currentTarget?.releasePointerCapture?.(e.pointerId)}catch{}
  }
  async function saveKonvaEditedImage(blob:Blob){
    if(viewerIndex===null||!gallery[viewerIndex]||!can("design_sample.edit")||!can("design_sample.upload_images"))return;
    try{
      setEditBusy(true);setViewerError("");
      const currentAsset=gallery[viewerIndex];
      const file=new File([blob],`${safeFilename(sample.code||"mau")}-edited-${Date.now()}.jpg`,{type:"image/jpeg"});
      const uploaded=await upload(file);
      const rawImages=(sample.images||[]).map((x:any)=>({type:x.type||"SAMPLE",url:x.url,caption:x.caption||null}));
      let replaced=false;
      const nextImages=rawImages.map((x:any)=>{
        if(!isPatternAsset(x)&&asset(x.url)===currentAsset){
          replaced=true;
          return {...x,url:uploaded.url,caption:x.caption||"Ảnh đã chỉnh sửa"};
        }
        return x;
      });
      if(!replaced)nextImages.push({type:"SAMPLE",url:uploaded.url,caption:"Ảnh đã chỉnh sửa"});
      const nextCover=asset(sample.coverImageUrl)===currentAsset?uploaded.url:(sample.coverImageUrl||uploaded.url);
      await api(`/sample-fabric/samples/${sample.id}`,{method:"PATCH",body:JSON.stringify({coverImageUrl:nextCover,images:nextImages})});
      setGallery(g=>g.map((u,i)=>i===viewerIndex?asset(uploaded.url):u));
      setEditMode(false);
      await onChanged();
    }catch(e){
      setViewerError(e instanceof Error?e.message:"Không lưu được ảnh chỉnh sửa.");
    }finally{
      setEditBusy(false);
    }
  }

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

      // Burn technical annotations into final image.
      ctx.filter="none";
      const previewW=Math.max(1,editorRef.current?.clientWidth||700);
      const styleScale=canvas.width/previewW;
      for(const a of annotations){
        const color=a.color||"#ff3b30";
        const line=Math.max(1,(a.strokeWidth||3)*styleScale);
        const fontPx=Math.max(12,(a.fontSize||22)*styleScale);
        ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=line;ctx.lineCap="round";ctx.lineJoin="round";
        if(a.type==="arrowText"&&a.target&&a.label){
          const tx=a.target.x*canvas.width,ty=a.target.y*canvas.height,lx=a.label.x*canvas.width,ly=a.label.y*canvas.height;
          canvasArrow(ctx,lx,ly,tx,ty,color,line);
          const text=String(a.text||"Ghi chú");
          ctx.font=`700 ${fontPx}px ${a.fontFamily||"Arial"}`;
          ctx.textBaseline="middle";
          const pad=7*styleScale,metrics=ctx.measureText(text),boxH=fontPx*1.35;
          ctx.fillStyle="rgba(255,255,255,.92)";
          ctx.fillRect(lx-pad,ly-boxH/2,metrics.width+pad*2,boxH);
          ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,line*.6);ctx.strokeRect(lx-pad,ly-boxH/2,metrics.width+pad*2,boxH);
          ctx.fillStyle=color;ctx.fillText(text,lx,ly);
        }else if(a.type==="text"&&a.label){
          ctx.font=`700 ${fontPx}px ${a.fontFamily||"Arial"}`;ctx.textBaseline="middle";
          const x=a.label.x*canvas.width,y=a.label.y*canvas.height,text=String(a.text||"Ghi chú");
          const pad=6*styleScale,metrics=ctx.measureText(text),boxH=fontPx*1.35;
          ctx.fillStyle="rgba(255,255,255,.9)";ctx.fillRect(x-pad,y-boxH/2,metrics.width+pad*2,boxH);
          ctx.fillStyle=color;ctx.fillText(text,x,y);
        }else if((a.type==="circle"||a.type==="rect")&&a.center){
          const cx=a.center.x*canvas.width,cy=a.center.y*canvas.height,w=(a.width||.24)*canvas.width,h=(a.height||.16)*canvas.height;
          ctx.strokeStyle=color;ctx.lineWidth=line;
          if(a.type==="circle"){ctx.beginPath();ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2);ctx.stroke()}
          else ctx.strokeRect(cx-w/2,cy-h/2,w,h);
        }else if(a.type==="pen"&&a.points?.length){
          ctx.strokeStyle=color;ctx.lineWidth=line;ctx.beginPath();
          a.points.forEach((p,i)=>{const x=p.x*canvas.width,y=p.y*canvas.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
          ctx.stroke();
        }
        ctx.restore();
      }

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
  return <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-white text-neutral-950" style={{WebkitOverflowScrolling:"touch"}}>
    <div className="mx-auto min-h-[100dvh] max-w-md bg-white pb-[max(24px,env(safe-area-inset-bottom))]">
      <section className="relative bg-neutral-100">
        <div
          className="relative flex min-h-[54dvh] max-h-[74dvh] items-center justify-center overflow-hidden"
          onTouchStart={galleryTouchStart}
          onTouchEnd={galleryTouchEnd}
          style={{touchAction:"pan-y"}}
        >
          {image?<button type="button" onClick={openZoom} className="block w-full cursor-zoom-in"><img src={image} className="max-h-[74dvh] w-full object-contain" alt=""/></button>:<div className="grid h-[58dvh] w-full place-items-center text-sm font-bold text-neutral-400">Chưa có ảnh mẫu</div>}

          <button
            type="button"
            onClick={()=>closeWithZoomReset(onClose)}
            aria-label="Quay lại"
            className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] z-20 grid h-11 w-11 place-items-center rounded-full bg-white/92 shadow backdrop-blur"
          >
            <ArrowLeft className="h-5 w-5"/>
          </button>

          <div className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-20 flex gap-2">
            {!!image&&<button type="button" onClick={()=>void downloadUrl(image,`${sample.code||"mau"}-${viewerIndex+1}.jpg`)} aria-label="Lưu ảnh" className="grid h-11 w-11 place-items-center rounded-full bg-white/92 shadow backdrop-blur"><Download className="h-5 w-5"/></button>}
            {image&&can("design_sample.edit")&&can("design_sample.upload_images")&&<button type="button" onClick={()=>{setEditMode(true);setViewerError("")}} aria-label="Chỉnh ảnh" className="grid h-11 w-11 place-items-center rounded-full bg-white/92 shadow backdrop-blur"><Pencil className="h-5 w-5"/></button>}
          </div>

          {gallery.length>1&&<>
            <button type="button" onClick={prevImage} aria-label="Ảnh trước" className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl shadow">‹</button>
            <button type="button" onClick={nextImage} aria-label="Ảnh sau" className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl shadow">›</button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-black text-white">{viewerIndex+1}/{gallery.length}</span>
          </>}
        </div>

        {gallery.length>1&&<div className="border-t bg-white px-3 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:"touch"}}>
            {gallery.map((url,i)=><button
              type="button"
              key={`${url}-${i}`}
              onClick={()=>setViewerIndex(i)}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-neutral-100 ${viewerIndex===i?"border-neutral-950":"border-transparent"}`}
              aria-label={`Xem ảnh ${i+1}`}
            >
              <img src={url} className="h-full w-full object-cover" alt=""/>
              <span className={`absolute bottom-1 right-1 rounded-md px-1.5 py-0.5 text-[9px] font-black ${viewerIndex===i?"bg-neutral-950 text-white":"bg-white/90 text-neutral-700"}`}>{i+1}</span>
            </button>)}
          </div>
        </div>}
      </section>

      <section className="px-4 pb-2 pt-4">
        <div className="text-[11px] font-black uppercase tracking-[.08em] text-neutral-400">{sample.code}</div>
        <h2 className="mt-1 text-[22px] font-black leading-tight">{sample.name}</h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
          <span>{statusLabel(sample.status)}</span>
          {sample.category&&<><span>·</span><span>{sample.category}</span></>}
          {sample.year&&<><span>·</span><span>{sample.year}</span></>}
          {sample.fabricBoard?.boardCode||sample.fabricBoardCode?<><span>·</span><span>{sample.fabricBoard?.boardCode||sample.fabricBoardCode}</span></>:null}
        </div>

        {(sample.note||sample.technicalNote||sample.nextAction)&&<div className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-700">
          {sample.note||sample.technicalNote||sample.nextAction}
        </div>}

        <button
          type="button"
          onClick={()=>setDetailExpanded(v=>!v)}
          className="mt-3 flex w-full items-center justify-between border-y py-3 text-left"
        >
          <div>
            <div className="text-sm font-black">Thông tin mẫu</div>
            <div className="mt-0.5 text-[11px] text-neutral-400">{detailExpanded?"Thu gọn":"Bấm để xem chi tiết và chỉnh sửa"}</div>
          </div>
          <span className={`text-xl transition-transform ${detailExpanded?"rotate-180":""}`}>⌄</span>
        </button>

        {detailExpanded&&<div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
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
          <MeasurementSummary sample={sample}/>

          {!!patternAttachments.length&&<section className="rounded-2xl bg-neutral-50 p-3">
            <div className="mb-2 text-xs font-black">File rập / tài liệu kỹ thuật</div>
            <div className="space-y-2">{patternAttachments.map((f:any,i:number)=><div key={f.id||`${f.url}-${i}`} className="flex items-center gap-2 rounded-xl bg-white p-2.5"><div className="min-w-0 flex-1"><div className="truncate text-xs font-black">{f.name||`File rập ${i+1}`}</div><div className="text-[10px] text-neutral-400">{f.size?`${(Number(f.size)/1024/1024).toFixed(2)} MB`:""}</div></div><button onClick={()=>void downloadUrl(f.url,`${sample.code||"mau"}-${f.name||`file-rap-${i+1}`}`)} className="grid h-9 w-9 place-items-center rounded-xl border"><Download className="h-4 w-4"/></button></div>)}</div>
          </section>}

          <section>
            <div className="flex items-center justify-between"><b className="text-sm">Lịch sử gửi mẫu</b>{can("sample_dispatch.create")&&<button onClick={onDispatch} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"><Send className="mr-1 inline h-3.5 w-3.5"/>Gửi / gửi lại</button>}</div>
            <div className="mt-2 space-y-2">
              {dispatches.length?dispatches.map((d:any)=><DispatchRow key={d.id} dispatch={d} can={can} onChanged={onChanged}/>):<div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-400">Chưa có lần gửi mẫu.</div>}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 border-t pt-4">
            {can("design_sample.edit")&&<button onClick={onEdit} className="rounded-2xl bg-neutral-950 py-3 font-black text-white"><Pencil className="mr-1 inline h-4 w-4"/>Sửa thông tin</button>}
            {can("design_sample.delete")&&<button onClick={onDelete} className="rounded-2xl border border-red-200 bg-red-50 py-3 font-black text-red-700"><Trash2 className="mr-1 inline h-4 w-4"/>Xoá mẫu</button>}
          </div>
        </div>}
      </section>
    </div>

    {zoomOpen&&image&&<div className="fixed inset-0 z-[125] overflow-hidden bg-black" style={{touchAction:"none"}}>
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3" style={{paddingTop:"max(12px, env(safe-area-inset-top))"}}>
        <button type="button" onClick={closeZoom} className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-black shadow backdrop-blur" aria-label="Đóng ảnh"><X className="h-5 w-5"/></button>
        <div className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black text-white">{Math.round(zoomScale*100)}%</div>
      </div>

      <div
        className="flex h-full w-full items-center justify-center"
        onTouchStart={zoomTouchStart}
        onTouchMove={zoomTouchMove}
        onTouchEnd={zoomTouchEnd}
        onDoubleClick={()=>{if(zoomScale>1){setZoomScale(1);setZoomPos({x:0,y:0})}else setZoomScale(2)}}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform:`translate3d(${zoomPos.x}px, ${zoomPos.y}px, 0) scale(${zoomScale})`,
            transformOrigin:"center center",
            transition:zoomGesture.current?.mode?"none":"transform 120ms ease-out",
          }}
        />
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-[max(18px,env(safe-area-inset-bottom))]">
        <div className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white/90">Chụm 2 ngón để zoom · kéo để xem</div>
      </div>
    </div>}

    {editMode&&image&&<div className="fixed inset-0 z-[120] bg-black">
      <SampleImageEditorKonva
        imageUrl={image}
        filename={`${sample.code||"mau"}-${viewerIndex+1}-edited.jpg`}
        busy={editBusy}
        onCancel={()=>setEditMode(false)}
        onSave={saveKonvaEditedImage}
      />
      {viewerError&&<div className="absolute left-3 right-3 top-[max(64px,env(safe-area-inset-top))] z-[130] rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white">{viewerError}</div>}
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

function SampleForm({sample,meta,ideaBoards,canViewFabricLink,canUpload,onClose,onSaved}:{sample:Sample|null;meta:Meta;ideaBoards:IdeaBoard[];canViewFabricLink:boolean;canUpload:boolean;onClose:()=>void;onSaved:()=>void}){
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
    sampleMakerId:sample?.sampleMakerId||"",
    sampleMakerName:sample?.sampleMakerName||"",
    patternMakerId:sample?.patternMakerId||"",
    patternMakerName:sample?.patternMakerName||"",
    status:sample?.status||"IDEA",
    assigneeStaffId:sample?.assigneeStaffId||"",
    nextAction:sample?.nextAction||"",
    dueDate:dateOnly(sample?.dueDate),
    note:sample?.note||"",
    technicalNote:sample?.technicalNote||"",
    coverImageUrl:sample?.coverImageUrl||(sample?.images||[]).find((x:any)=>!isPatternAsset(x))?.url||"",
  });
  const [sampleImages,setSampleImages]=useState<Array<{type:string;url:string;caption?:string}>>(
    Array.isArray(sample?.images) && sample!.images!.some((x:any)=>!isPatternAsset(x))
      ? sample!.images!.filter((x:any)=>!isPatternAsset(x)).map((x:any)=>({type:x.type||"SAMPLE",url:x.url,caption:x.caption||"Ảnh mẫu / ảnh tham khảo"}))
      : (sample?.coverImageUrl ? [{type:"SAMPLE",url:sample.coverImageUrl,caption:"Ảnh mẫu / ảnh tham khảo"}] : [])
  );
  const [people,setPeople]=useState<SamplePerson[]>(meta.samplePeople||[]);
  const [creatingRole,setCreatingRole]=useState<"SAMPLE_MAKER"|"PATTERN_MAKER"|null>(null);
  const [newPersonName,setNewPersonName]=useState("");
  const [newPersonPhone,setNewPersonPhone]=useState("");
  const [creatingPerson,setCreatingPerson]=useState(false);
  const [patternFiles,setPatternFiles]=useState<PatternAttachment[]>(
    Array.isArray(sample?.images)
      ? sample!.images!.filter((x:any)=>isPatternAsset(x)).map((x:any)=>{
          const meta=parsePatternCaption(x.caption);
          return {type:"OTHER",url:x.url,caption:x.caption,name:meta?.name||"file-rập",mimetype:meta?.mimetype,size:meta?.size};
        })
      : []
  );
  const [selectedIdeaBoardIds,setSelectedIdeaBoardIds]=useState<string[]>(
    Array.isArray(sample?.ideaBoards)
      ? sample!.ideaBoards!.map((x:any)=>String(x?.boardId||x?.board?.id||"")).filter(Boolean)
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
        const optimized=await sampleImageUnder10MB(file);
        const r=await upload(optimized);
        uploaded.push({type:"SAMPLE",url:r.url,caption:"Ảnh mẫu / ảnh tham khảo"});
      }
      setSampleImages(current=>{
        const next=[...current,...uploaded];
        setForm((prev:any)=>({
          ...prev,
          coverImageUrl:prev.coverImageUrl||next[0]?.url||"",
        }));
        return next;
      });
    }catch(e){setError(e instanceof Error?e.message:"Upload lỗi")}
  }

  function setCoverImage(url:string){
    if(!url)return;
    setForm((prev:any)=>({...prev,coverImageUrl:url}));
  }

  async function changePatternFiles(files?:FileList|File[]){
    const list=Array.from(files||[]);
    if(!list.length)return;
    if(!canUpload){setError("Không có quyền tải file mẫu.");return}
    try{
      const uploaded:PatternAttachment[]=[];
      for(const file of list){
        const ext=patternExt(file.name);
        if(!PATTERN_EXTENSIONS.has(ext))throw new Error(`File ${file.name} chưa được hỗ trợ.`);
        const r=await uploadPatternFile(file);
        const name=r.filename||file.name;
        uploaded.push({type:"OTHER",url:r.url,caption:patternCaption(name,r.mimetype||file.type,r.size||file.size),name,mimetype:r.mimetype||file.type,size:r.size||file.size});
      }
      setPatternFiles(current=>[...current,...uploaded]);
    }catch(e){setError(e instanceof Error?e.message:"Không tải được file rập.")}
  }

  async function createPerson(role:"SAMPLE_MAKER"|"PATTERN_MAKER"){
    const name=newPersonName.trim();if(!name)return;
    try{
      setCreatingPerson(true);setError("");
      const row=await api<SamplePerson>("/sample-fabric/samples/people",{method:"POST",body:JSON.stringify({name,role,phone:newPersonPhone.trim()||null})});
      const next=[...people.filter(x=>x.id!==row.id),row].sort((a,b)=>a.name.localeCompare(b.name,"vi"));
      setPeople(next);
      if(role==="SAMPLE_MAKER"){patch("sampleMakerId",row.id);patch("sampleMakerName",row.name)}
      else{patch("patternMakerId",row.id);patch("patternMakerName",row.name)}
      setCreatingRole(null);setNewPersonName("");setNewPersonPhone("");
    }catch(e){setError(e instanceof Error?e.message:"Không tạo được người.")}
    finally{setCreatingPerson(false)}
  }

  async function save(){
    try{
      setSaving(true);setError("");
      if(!form.name.trim())throw new Error("Thiếu tên mẫu.");
      const normalizedCode=normalizeCode(form.code);
      if(normalizedCode && codeAvailable!==true)throw new Error(codeMessage||"Mã mẫu chưa hợp lệ.");
      const staff=meta.staff.find(x=>x.id===form.assigneeStaffId);
      const factory=meta.factories.find(x=>x.id===form.sampleFactoryId);
      const sampleMaker=people.find(x=>x.id===form.sampleMakerId);
      const patternMaker=people.find(x=>x.id===form.patternMakerId);
      const board=meta.boards.find(x=>x.id===form.fabricBoardId);

      const visualImages=sampleImages.filter(x=>!!x.url);
      const validCover=visualImages.some(x=>x.url===form.coverImageUrl)
        ? form.coverImageUrl
        : (visualImages[0]?.url||form.coverImageUrl||null);
      if(validCover&&validCover!==form.coverImageUrl)setForm((prev:any)=>({...prev,coverImageUrl:validCover}));

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
          sampleMakerId:form.sampleMakerId||null,
          sampleMakerName:sampleMaker?.name||form.sampleMakerName||null,
          patternMakerId:form.patternMakerId||null,
          patternMakerName:patternMaker?.name||form.patternMakerName||null,
          status:form.status,
          assigneeStaffId:form.assigneeStaffId||null,
          assigneeName:staff?.name||null,
          nextAction:form.nextAction||null,
          dueDate:form.dueDate||null,
          note:form.note||null,
          technicalNote:form.technicalNote||null,
          coverImageUrl:validCover,
          images:[
            ...(sampleImages.length?sampleImages:(form.coverImageUrl?[{type:"SAMPLE",url:form.coverImageUrl,caption:"Ảnh mẫu / ảnh tham khảo"}]:[])),
            ...patternFiles.map(x=>({type:"OTHER",url:x.url,caption:x.caption})),
          ],
        })
      });
      const savedId=String(saved?.id||sample?.id||"");
      if(savedId){
        await api(`/sample-fabric/samples/${savedId}/idea-boards`,{
          method:"PATCH",
          body:JSON.stringify({boardIds:selectedIdeaBoardIds}),
        });
      }
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
          {!!sampleImages.length&&<div className="mb-3 flex gap-3 overflow-x-auto pb-2">{sampleImages.map((img,i)=>{
            const active=form.coverImageUrl===img.url;
            return <div key={`${img.url}-${i}`} className="relative w-28 shrink-0">
              <button type="button" onClick={()=>setCoverImage(img.url)} className={`relative block w-full overflow-hidden rounded-2xl border-2 ${active?"border-neutral-950":"border-neutral-200"}`}>
                <img src={asset(img.url)} className="h-28 w-full object-cover" alt=""/>
                {active&&<span className="absolute bottom-1 left-1 rounded-full bg-neutral-950 px-2 py-1 text-[9px] font-black text-white">ẢNH ĐẠI DIỆN</span>}
              </button>
              {!active&&<button type="button" onClick={()=>setCoverImage(img.url)} className="mt-1.5 w-full rounded-xl border py-1.5 text-[10px] font-black">Đặt đại diện</button>}
              {active&&<div className="mt-1.5 py-1.5 text-center text-[10px] font-black text-emerald-700">Đang đại diện</div>}
              {canUpload&&<button type="button" onClick={()=>{
                const next=sampleImages.filter((_,j)=>j!==i);
                setSampleImages(next);
                if(form.coverImageUrl===img.url)setForm((prev:any)=>({...prev,coverImageUrl:next[0]?.url||""}));
              }} className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow">×</button>}
            </div>
          })}</div>}
          <div className="mb-2 text-[11px] text-neutral-400">Upload nhiều ảnh: ảnh trên 10MB sẽ tự giảm kích thước/dung lượng trước khi tải. Ảnh đầu tiên tự làm đại diện.</div>
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

      <Field l="Bảng ý tưởng">
        <div className="rounded-2xl border p-3">
          <div className="mb-2 text-[11px] text-neutral-400">Chọn ngay bảng cho mẫu này. Có thể chọn nhiều bảng; không chọn thì mẫu nằm ở “Chưa phân bảng”.</div>
          {ideaBoards.length ? (
            <div className="grid grid-cols-2 gap-2">
              {ideaBoards.map(board=>{
                const checked=selectedIdeaBoardIds.includes(board.id);
                return <label key={board.id} className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 ${checked?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={()=>setSelectedIdeaBoardIds(ids=>checked?ids.filter(id=>id!==board.id):[...ids,board.id])}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 truncate text-xs font-black">{board.name}</span>
                </label>
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-neutral-50 px-3 py-3 text-xs font-bold text-neutral-400">Chưa có bảng ý tưởng. Có thể tạo bảng từ màn Ý tưởng mẫu.</div>
          )}
        </div>
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
        <Field l="Người ra mẫu"><div className="space-y-2"><select className={input} value={form.sampleMakerId} onChange={e=>{const p=people.find(x=>x.id===e.target.value);patch("sampleMakerId",e.target.value);patch("sampleMakerName",p?.name||"")}}><option value="">Chưa chọn</option>{people.filter(x=>x.role==="SAMPLE_MAKER"||x.role==="BOTH").map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button type="button" onClick={()=>{setCreatingRole("SAMPLE_MAKER");setNewPersonName("");setNewPersonPhone("")}} className="w-full rounded-2xl border py-2 text-xs font-black">+ Tạo người ra mẫu</button></div></Field>
        <Field l="Người thiết kế rập"><div className="space-y-2"><select className={input} value={form.patternMakerId} onChange={e=>{const p=people.find(x=>x.id===e.target.value);patch("patternMakerId",e.target.value);patch("patternMakerName",p?.name||"")}}><option value="">Chưa chọn</option>{people.filter(x=>x.role==="PATTERN_MAKER"||x.role==="BOTH").map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button type="button" onClick={()=>{setCreatingRole("PATTERN_MAKER");setNewPersonName("");setNewPersonPhone("")}} className="w-full rounded-2xl border py-2 text-xs font-black">+ Tạo người thiết kế rập</button></div></Field>
      </div>

      {creatingRole&&<section className="rounded-3xl border bg-neutral-50 p-3"><div className="mb-2 flex justify-between"><b className="text-sm">{creatingRole==="SAMPLE_MAKER"?"Tạo người ra mẫu":"Tạo người thiết kế rập"}</b><button type="button" onClick={()=>setCreatingRole(null)}><X className="h-4 w-4"/></button></div><div className="space-y-2"><input autoFocus className={input} value={newPersonName} onChange={e=>setNewPersonName(e.target.value)} placeholder="Họ tên"/><input className={input} value={newPersonPhone} onChange={e=>setNewPersonPhone(e.target.value)} placeholder="Số điện thoại (nếu có)"/><button type="button" disabled={creatingPerson||!newPersonName.trim()} onClick={()=>void createPerson(creatingRole)} className="w-full rounded-2xl bg-neutral-950 py-3 text-xs font-black text-white disabled:opacity-40">{creatingPerson?"Đang tạo...":"Tạo & chọn"}</button></div></section>}

      <div className="grid grid-cols-2 gap-3">
        <Field l="Tiến độ"><select className={input} value={form.status} onChange={e=>patch("status",e.target.value)}>{SAMPLE_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
        <Field l="Người phụ trách"><select className={input} value={form.assigneeStaffId} onChange={e=>patch("assigneeStaffId",e.target.value)}><option value="">Chưa gán</option>{meta.staff.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      </div>

      <Field l="Việc tiếp theo"><input className={input} value={form.nextAction} onChange={e=>patch("nextAction",e.target.value)}/></Field>
      <Field l="Hạn dự kiến"><input type="date" className={input} value={form.dueDate} onChange={e=>patch("dueDate",e.target.value)}/></Field>
      <section className="rounded-3xl border border-neutral-200 p-3">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-black">File rập / tài liệu kỹ thuật</div><div className="mt-1 text-[11px] text-neutral-400">HPGL, MRK, PLT, DXF, DWG, ASTM, AAMA, PDF, ZIP…</div></div>
          {canUpload&&<label className="cursor-pointer rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"><FileUp className="mr-1 inline h-4 w-4"/>Tải file<input type="file" multiple className="hidden" onChange={e=>void changePatternFiles(e.target.files||undefined)}/></label>}
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
