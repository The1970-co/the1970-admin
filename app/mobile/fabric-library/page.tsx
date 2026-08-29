"use client";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import { ArrowLeft, Camera, ChevronDown, ChevronLeft, ChevronRight, Download, ImagePlus, Layers3, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
type Supplier = {
    id: string;
    code?: string | null;
    publicCode?: string | null;
    name: string;
};
type BoardImage = {
    id?: string;
    type?: string;
    url: string;
    caption?: string | null;
};
type BoardColor = {
    id?: string;
    name: string;
    code?: string | null;
};
type CompositionPart = {
    name: string;
    percent: string;
};
type FabricBoard = {
    id: string;
    supplierId?: string | null;
    supplier?: Supplier | null;
    boardCode: string;
    fabricCode?: string | null;
    name?: string | null;
    composition?: string | null;
    expectedGsm?: number | string | null;
    gsm?: number | string | null;
    referencePriceVnd?: number | string | null;
    referencePriceUnit?: string | null;
    seasons?: string[];
    productGroups?: string[];
    note?: string | null;
    coverImageUrl?: string | null;
    images?: BoardImage[];
    colors?: BoardColor[];
    sampleDispatches?: any[];
    designSamples?: any[];
    fabricReceipts?: any[];
    updatedAt?: string | null;
};
type Meta = {
    suppliers: Supplier[];
    seasons: string[];
    productGroups: string[];
    fabricCompositions: string[];
    staff?: any[];
};

type FabricPinterestBoard = {
    id: string;
    name: string;
    description?: string | null;
    fabricBoardIds: string[];
    createdAt: string;
    updatedAt: string;
};

const FABRIC_PINTEREST_BOARDS_KEY = "the1970.fabricLibraryPinterestBoards.v1";
const FABRIC_LIBRARY_VIEW_KEY = "the1970.fabricLibraryViewMode.v1";

function loadFabricPinterestBoards(): FabricPinterestBoard[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = JSON.parse(localStorage.getItem(FABRIC_PINTEREST_BOARDS_KEY) || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}
function saveFabricPinterestBoards(rows: FabricPinterestBoard[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(FABRIC_PINTEREST_BOARDS_KEY, JSON.stringify(rows));
}
function fabricVisualUrls(board: FabricBoard) {
    return Array.from(new Set([
        board.coverImageUrl,
        ...(board.images || []).map(x => x.url),
    ].filter(Boolean).map(String)));
}
const DEFAULT_COMPOSITIONS = ["Cotton", "Linen", "Tencel", "Lyocell", "Viscose", "Rayon", "Polyester", "Nylon", "Spandex", "Elastane", "Wool", "Silk", "Bamboo", "Cashmere", "Acrylic", "Modal"];
const DEFAULT_SEASONS = ["Xuân Hạ", "Thu Đông", "Đông Xuân", "Xuân Hè"];
async function api<T = any>(path: string, init: RequestInit = {}) { return apiJson<T>(path, { ...init, redirectOnUnauthorized: false } as any); }
async function uploadBoardImage(file: File) { const fd = new FormData(); fd.append("file", file); return api<{
    url: string;
}>("/sample-fabric/library/upload", { method: "POST", body: fd }); }
function asset(url?: string | null) { if (!url)
    return ""; return /^https?:\/\//.test(url) ? url : `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`; }
function safeImageFilename(v:string){return String(v||"anh-vai").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim()||"anh-vai"}
function filenameWithMime(filename:string,mime?:string){const clean=safeImageFilename(filename);if(/\.[a-z0-9]{2,6}$/i.test(clean))return clean;return `${clean}${String(mime||"").includes("png")?".png":String(mime||"").includes("webp")?".webp":".jpg"}`}
function isIosDevice(){
  if(typeof navigator==="undefined")return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
}
async function saveImageToPhone(url:string,filename:string){
  const resolved=asset(url);if(!resolved)return;

  // Trên iPhone mở ảnh gốc trực tiếp. Sau đó giữ ảnh -> "Lưu vào Ảnh".
  if(isIosDevice()){
    const opened=window.open(resolved,"_blank","noopener,noreferrer");
    if(!opened)window.location.href=resolved;
    return;
  }

  try{
    const res=await fetch(resolved,{mode:"cors",credentials:"omit",cache:"no-store"});if(!res.ok)throw new Error("download");
    const blob=await res.blob();const file=new File([blob],filenameWithMime(filename,blob.type),{type:blob.type||"image/jpeg"});
    const objectUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=objectUrl;a.download=file.name;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
  }catch{window.open(resolved,"_blank","noopener,noreferrer")}
}
function normalizeCode(v: any) { return String(v || "").trim().toUpperCase().replace(/\s+/g, ""); }
function titleCase(v: any) { return String(v || "").trim().toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, p1, p2) => p1 + p2.toUpperCase()); }
function unique(values: string[]) { return [...new Set(values.map(x => String(x || "").trim()).filter(Boolean))]; }
function fmtDate(v?: string | null) { if (!v)
    return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN"); }
function rolesOf(user: any) { return [...(Array.isArray(user?.roles) ? user.roles : []), user?.role, user?.roleCode, user?.staffRole].map(x => String(x || "").toLowerCase()).filter(Boolean); }
function isAdmin(user: any) { const r = rolesOf(user); return r.includes("owner") || r.includes("admin"); }
function parseComposition(value?: string | null): CompositionPart[] { if (!value)
    return []; return String(value).split(",").map(x => x.trim()).filter(Boolean).map(part => { const m = part.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)%$/); return m ? { name: m[1].trim(), percent: m[2].replace(",", ".") } : { name: part, percent: "" }; }); }
function compositionText(parts: CompositionPart[]) { return parts.filter(x => x.name.trim()).map(x => { const p = String(x.percent || "").trim().replace(",", "."); return p ? `${titleCase(x.name)} ${p}%` : titleCase(x.name); }).join(", "); }
function dispatchLabel(v: any) { const m: Record<string, string> = { SENT: "Đã gửi", RECEIVED: "Xưởng đã nhận", MAKING: "Đang làm", RETURNED: "Mẫu đã về", REVISING: "Đang sửa", APPROVED: "Đã duyệt", CANCELLED: "Huỷ" }; return m[String(v || "")] || String(v || "—"); }
export default function Page() {
    const [rows, setRows] = useState<FabricBoard[]>([]);
    const [meta, setMeta] = useState<Meta>({ suppliers: [], seasons: [], productGroups: [], fabricCompositions: [] });
    const [q, setQ] = useState("");
    const [detail, setDetail] = useState<FabricBoard | null>(null);
    const [editing, setEditing] = useState<FabricBoard | null | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<any>(null);

    const [viewMode, setViewMode] = useState<"LIST"|"PINTEREST">("PINTEREST");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [supplierFilter, setSupplierFilter] = useState("");
    const [seasonFilter, setSeasonFilter] = useState("");
    const [groupFilter, setGroupFilter] = useState("");
    const [sortMode, setSortMode] = useState<"NEWEST"|"AZ">("NEWEST");

    const [pinBoards, setPinBoards] = useState<FabricPinterestBoard[]>([]);
    const [boardFilter, setBoardFilter] = useState("");
    const [boardHubOpen, setBoardHubOpen] = useState(false);
    const [boardForm, setBoardForm] = useState<{id?:string;name:string;description:string}|null>(null);
    const [assignFabric, setAssignFabric] = useState<FabricBoard|null>(null);
    const [assignBoardIds, setAssignBoardIds] = useState<string[]>([]);
    const [boardBusy, setBoardBusy] = useState(false);

    const permissions = useMemo(() => getCurrentUserPermissions(user, user?.activeBranchId || user?.branchId), [user]);
    const can = (key: string) => isAdmin(user) || permissions.includes("*") || permissions.includes(key);

    async function load() {
        try {
            setLoading(true);
            setError("");
            const [boards, m, groups] = await Promise.all([
                api<FabricBoard[]>(`/sample-fabric/library${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
                api<Meta>("/sample-fabric/library/meta"),
                api<string[]>("/products/category-options").catch(() => []),
            ]);
            setRows(Array.isArray(boards) ? boards : []);
            setMeta({
                suppliers: Array.isArray(m?.suppliers) ? m.suppliers : [],
                seasons: unique([...DEFAULT_SEASONS, ...(m?.seasons || [])]),
                productGroups: unique([...(groups || []), ...(m?.productGroups || [])]),
                fabricCompositions: unique([...DEFAULT_COMPOSITIONS, ...((m?.fabricCompositions || []).map((x:string)=>String(x||"").replace(/\s+\d+(?:[.,]\d+)?%.*$/,"")))]),
                staff: m?.staff || [],
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Không tải được thư viện bảng vải.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setUser(getCurrentUserFromStorage());
        setPinBoards(loadFabricPinterestBoards());
        try {
            const saved = localStorage.getItem(FABRIC_LIBRARY_VIEW_KEY);
            if (saved === "LIST" || saved === "PINTEREST") setViewMode(saved);
        } catch {}
        void load();
    }, []);


    function setView(next:"LIST"|"PINTEREST") {
        setViewMode(next);
        try { localStorage.setItem(FABRIC_LIBRARY_VIEW_KEY, next); } catch {}
    }

    function fabricBoardCollectionIds(fabricBoardId:string) {
        return pinBoards.filter(x => x.fabricBoardIds.includes(fabricBoardId)).map(x => x.id);
    }
    function fabricBoardCollectionNames(fabricBoardId:string) {
        return pinBoards.filter(x => x.fabricBoardIds.includes(fabricBoardId)).map(x => x.name);
    }
    const unassignedCount = rows.filter(x => !fabricBoardCollectionIds(x.id).length).length;

    function persistPinBoards(next:FabricPinterestBoard[]) {
        setPinBoards(next);
        saveFabricPinterestBoards(next);
    }

    function savePinterestBoard() {
        if (!boardForm?.name.trim()) return;
        setBoardBusy(true);
        try {
            const now = new Date().toISOString();
            if (boardForm.id) {
                persistPinBoards(pinBoards.map(x => x.id === boardForm.id ? {
                    ...x,
                    name: boardForm.name.trim(),
                    description: boardForm.description.trim() || null,
                    updatedAt: now,
                } : x));
            } else {
                persistPinBoards([...pinBoards, {
                    id: `FABPIN_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
                    name: boardForm.name.trim(),
                    description: boardForm.description.trim() || null,
                    fabricBoardIds: [],
                    createdAt: now,
                    updatedAt: now,
                }]);
            }
            setBoardForm(null);
        } finally {
            setBoardBusy(false);
        }
    }

    function deletePinterestBoard(board:FabricPinterestBoard) {
        if (!window.confirm(`Xoá bảng "${board.name}"? Bảng vải bên trong không bị xoá.`)) return;
        persistPinBoards(pinBoards.filter(x => x.id !== board.id));
        if (boardFilter === board.id) setBoardFilter("");
    }

    function openBoardAssign(board:FabricBoard) {
        setAssignFabric(board);
        setAssignBoardIds(fabricBoardCollectionIds(board.id));
    }

    function saveBoardAssign() {
        if (!assignFabric) return;
        const now = new Date().toISOString();
        persistPinBoards(pinBoards.map(board => {
            const has = assignBoardIds.includes(board.id);
            const ids = board.fabricBoardIds.filter(id => id !== assignFabric.id);
            if (has) ids.push(assignFabric.id);
            return {...board, fabricBoardIds:Array.from(new Set(ids)), updatedAt:now};
        }));
        setAssignFabric(null);
    }

    async function openDetail(board: FabricBoard) {
        try {
            setDetailLoading(true);
            setDetail(await api<FabricBoard>(`/sample-fabric/library/${board.id}`));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Không mở được bảng vải.");
        } finally {
            setDetailLoading(false);
        }
    }

    async function removeBoard(board: FabricBoard) {
        if (!window.confirm(`Xoá bảng vải ${board.boardCode}?`)) return;
        try {
            await api(`/sample-fabric/library/${board.id}`, { method: "DELETE" });
            setDetail(null);
            persistPinBoards(pinBoards.map(x => ({...x, fabricBoardIds:x.fabricBoardIds.filter(id => id !== board.id)})));
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Không xoá được bảng vải.");
        }
    }

    const filtered = useMemo(() => {
        const k = q.trim().toLowerCase();
        const list = rows.filter(x => {
            if (supplierFilter && String(x.supplierId || x.supplier?.id || "") !== supplierFilter) return false;
            if (seasonFilter && !(x.seasons || []).includes(seasonFilter)) return false;
            if (groupFilter && !(x.productGroups || []).includes(groupFilter)) return false;
            if (boardFilter === "__UNASSIGNED__" && fabricBoardCollectionIds(x.id).length) return false;
            if (boardFilter && boardFilter !== "__UNASSIGNED__") {
                const board = pinBoards.find(b => b.id === boardFilter);
                if (!board?.fabricBoardIds.includes(x.id)) return false;
            }
            if (!k) return true;
            return [x.boardCode,x.fabricCode,x.name,x.composition,x.supplier?.name,x.supplier?.code,...(x.seasons||[]),...(x.productGroups||[])]
                .some(v => String(v || "").toLowerCase().includes(k));
        });
        return [...list].sort((a,b) => {
            if (sortMode === "AZ") return String(a.name || a.boardCode).localeCompare(String(b.name || b.boardCode), "vi", {numeric:true,sensitivity:"base"});
            return (new Date(b.updatedAt || 0).getTime() || 0) - (new Date(a.updatedAt || 0).getTime() || 0);
        });
    }, [rows,q,supplierFilter,seasonFilter,groupFilter,sortMode,boardFilter,pinBoards]);

    return <main
      className="relative min-h-[100svh] w-full bg-neutral-100 pb-[calc(24px+env(safe-area-inset-bottom))] text-neutral-950"
    >
      <div className="mx-auto max-w-md">
        <header className="relative z-10 border-b bg-white px-3 pb-2" style={{paddingTop:"max(44px, calc(env(safe-area-inset-top) + 8px))"}}>
          <div className="flex min-h-11 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/mobile/production" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">Nguyên liệu</div>
                <h1 className="truncate text-[19px] font-black leading-5">Bảng vải</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
              {can("fabric_library.create")&&<button onClick={()=>setEditing(null)} className="h-10 rounded-full bg-neutral-950 px-3.5 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Thêm</button>}
            </div>
          </div>

          {boardFilter&&<div className="mt-2 flex"><button type="button" onClick={()=>setBoardHubOpen(true)} className="max-w-56 truncate rounded-full bg-neutral-100 px-3 py-2 text-xs font-black text-neutral-700">{boardFilter==="__UNASSIGNED__"?"Chưa phân bảng":pinBoards.find(b=>b.id===boardFilter)?.name||"Bảng"}</button></div>}

          <div className="mt-2 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400"/>
              <input className="h-11 w-full rounded-full border border-neutral-300 bg-white py-2.5 pl-10 pr-3 text-[16px] outline-none focus:border-neutral-950" value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm bảng vải..."/>
            </div>
            <button type="button" onClick={()=>setFiltersOpen(x=>!x)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${filtersOpen||supplierFilter||seasonFilter||groupFilter||sortMode!=="NEWEST"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}><span className="text-[11px] font-black">Lọc</span></button>
            <button type="button" onClick={()=>setBoardHubOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white" aria-label="Bảng và kiểu hiển thị">
              <span className="grid h-5 w-5 grid-cols-2 gap-[2px]"><span className="rounded-[2px] bg-neutral-950"/><span className="rounded-[2px] bg-neutral-950"/><span className="rounded-[2px] bg-neutral-950"/><span className="rounded-[2px] bg-neutral-950"/></span>
            </button>
          </div>

          {filtersOpen&&<div className="mt-2 grid gap-2 rounded-2xl bg-neutral-50 p-2">
            <select className={input} value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)}><option value="">Tất cả NCC</option>{meta.suppliers.map(s=><option key={s.id} value={s.id}>{s.code||s.publicCode?`${s.code||s.publicCode} · `:""}{s.name}</option>)}</select>
            <select className={input} value={seasonFilter} onChange={e=>setSeasonFilter(e.target.value)}><option value="">Tất cả mùa</option>{meta.seasons.map(x=><option key={x} value={x}>{x}</option>)}</select>
            <select className={input} value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="">Tất cả nhóm SP</option>{meta.productGroups.map(x=><option key={x} value={x}>{x}</option>)}</select>
            <select className={input} value={sortMode} onChange={e=>setSortMode(e.target.value as any)}><option value="NEWEST">Mới cập nhật trước</option><option value="AZ">Tên A → Z</option></select>
          </div>}
        </header>

        <div className="space-y-3 px-2 pb-4 pt-2">
          {error&&<Err text={error}/>}
          {loading&&<Empty text="Đang tải bảng vải..."/>}

          {!loading&&viewMode==="LIST"&&filtered.map(board=>{
            const visuals=fabricVisualUrls(board);
            const image=visuals[0]?asset(visuals[0]):"";
            const gsm=board.expectedGsm??board.gsm;
            return <div key={board.id} className="rounded-[28px] bg-white p-4 shadow-sm">
              <button type="button" onClick={()=>void openDetail(board)} className="flex w-full gap-4 text-left active:scale-[.995]">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                  {image?<img src={image} className="h-full w-full object-cover" alt=""/>:<div className="grid h-full place-items-center"><Layers3 className="h-7 w-7 text-neutral-300"/></div>}
                  {visuals.length>1&&<span className="absolute bottom-1 right-1 rounded-lg bg-black/70 px-1.5 py-0.5 text-[8px] font-black text-white">{visuals.length} ảnh</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-neutral-400">{board.boardCode}{board.fabricCode?` · ${board.fabricCode}`:""}</div>
                  <div className="mt-1 text-base font-black">{board.name||"Bảng vải"}</div>
                  <div className="mt-1 text-xs text-neutral-500">{board.composition||"Chưa khai báo thành phần"}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {gsm!==null&&gsm!==undefined&&gsm!==""&&<Badge>{gsm} GSM</Badge>}
                    {(board.seasons||[]).slice(0,1).map(x=><Badge key={x}>{x}</Badge>)}
                    {fabricBoardCollectionNames(board.id).slice(0,2).map(name=><Badge key={name}>{name}</Badge>)}
                  </div>
                </div>
              </button>
              {can("fabric_library.edit")&&<div className="mt-3 flex justify-end border-t pt-3"><button type="button" onClick={()=>openBoardAssign(board)} className="rounded-xl border px-3 py-2 text-xs font-black">+ Bảng Pinterest</button></div>}
            </div>
          })}

          {!loading&&viewMode==="PINTEREST"&&<div className="columns-2 gap-1.5">
            {filtered.map(board=>{
              const visuals=fabricVisualUrls(board);
              const image=visuals[0]?asset(visuals[0]):"";
              const gsm=board.expectedGsm??board.gsm;
              return <div key={board.id} className="mb-1.5 break-inside-avoid overflow-hidden rounded-[18px] bg-white">
                <button type="button" onClick={()=>void openDetail(board)} className="block w-full text-left active:opacity-80">
                  {image?<img src={image} className="block h-auto w-full object-contain" alt=""/>:<div className="grid h-36 place-items-center bg-neutral-100"><Layers3 className="h-7 w-7 text-neutral-300"/></div>}
                  <div className="p-2.5">
                    <div className="line-clamp-2 text-xs font-black">{board.name||"Bảng vải"}</div>
                    <div className="mt-1 text-[10px] font-bold text-neutral-400">{board.boardCode}{board.fabricCode?` · ${board.fabricCode}`:""}</div>
                    <div className="mt-1 line-clamp-2 text-[10px] text-neutral-500">{board.composition||"Chưa khai báo thành phần"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {gsm!==null&&gsm!==undefined&&gsm!==""&&<Badge>{gsm} GSM</Badge>}
                      {visuals.length>1&&<Badge>{visuals.length} ảnh</Badge>}
                    </div>
                  </div>
                </button>
                {can("fabric_library.edit")&&<div className="border-t p-2"><button type="button" onClick={()=>openBoardAssign(board)} className="w-full rounded-xl border px-2 py-2 text-[10px] font-black">+ Bảng</button></div>}
              </div>
            })}
          </div>}

          {!loading&&!filtered.length&&<Empty text="Chưa có bảng vải phù hợp."/>}
        </div>
      </div>

      {detailLoading&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="rounded-3xl bg-white px-6 py-5 text-sm font-black">Đang tải chi tiết...</div></div>}
      {detail&&<BoardDetail board={detail} can={can} onClose={()=>setDetail(null)} onEdit={()=>{setEditing(detail);setDetail(null)}} onDelete={()=>void removeBoard(detail)}/>}
      {editing!==undefined&&<BoardForm board={editing} meta={meta} canUpload={can("fabric_library.upload_images")} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);await load()}} onSupplierCreated={supplier=>setMeta(m=>({...m,suppliers:[...m.suppliers.filter(x=>x.id!==supplier.id),supplier].sort((a,b)=>a.name.localeCompare(b.name,"vi"))}))}/>}

      {boardHubOpen&&<Modal title="Bảng & kiểu hiển thị" onClose={()=>setBoardHubOpen(false)}>
        <div className="space-y-5 p-4">
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">Kiểu hiển thị</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>{setView("PINTEREST");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${viewMode==="PINTEREST"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
                <div className="grid h-10 w-10 grid-cols-2 gap-1"><span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/><span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/><span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/><span className={`rounded-md ${viewMode==="PINTEREST"?"bg-white":"bg-neutral-950"}`}/></div>
                <div className="mt-2 text-sm font-black">Pinterest</div><div className={`mt-0.5 text-[10px] ${viewMode==="PINTEREST"?"text-white/60":"text-neutral-400"}`}>Ảnh lớn, 2 cột</div>
              </button>
              <button type="button" onClick={()=>{setView("LIST");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${viewMode==="LIST"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}>
                <div className="space-y-1.5 pt-1"><span className={`block h-2.5 rounded ${viewMode==="LIST"?"bg-white":"bg-neutral-950"}`}/><span className={`block h-2.5 rounded ${viewMode==="LIST"?"bg-white":"bg-neutral-950"}`}/><span className={`block h-2.5 rounded ${viewMode==="LIST"?"bg-white":"bg-neutral-950"}`}/></div>
                <div className="mt-3 text-sm font-black">Danh sách</div><div className={`mt-0.5 text-[10px] ${viewMode==="LIST"?"text-white/60":"text-neutral-400"}`}>Xem đủ thông tin</div>
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-400">Bảng Pinterest</div>
              {can("fabric_library.edit")&&<button type="button" onClick={()=>{setBoardHubOpen(false);setBoardForm({name:"",description:""})}} className="rounded-full border px-3 py-2 text-[10px] font-black">+ Tạo bảng</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>{setBoardFilter("");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${boardFilter===""?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}><div className="text-sm font-black">Tất cả</div><div className={`mt-1 text-[10px] ${boardFilter===""?"text-white/60":"text-neutral-400"}`}>{rows.length} bảng vải</div></button>
              <button type="button" onClick={()=>{setBoardFilter("__UNASSIGNED__");setBoardHubOpen(false)}} className={`rounded-2xl border p-3 text-left ${boardFilter==="__UNASSIGNED__"?"border-neutral-950 bg-neutral-950 text-white":"bg-white"}`}><div className="text-sm font-black">Chưa phân bảng</div><div className={`mt-1 text-[10px] ${boardFilter==="__UNASSIGNED__"?"text-white/60":"text-neutral-400"}`}>{unassignedCount} bảng vải</div></button>
              {pinBoards.map(board=>{
                const linked=board.fabricBoardIds.map(id=>rows.find(x=>x.id===id)).filter(Boolean) as FabricBoard[];
                const thumbs=linked.flatMap(x=>fabricVisualUrls(x)).slice(0,4);
                return <div key={board.id} className={`overflow-hidden rounded-2xl border ${boardFilter===board.id?"border-neutral-950 ring-1 ring-neutral-950":"bg-white"}`}>
                  <button type="button" onClick={()=>{setBoardFilter(board.id);setBoardHubOpen(false)}} className="w-full text-left">
                    <div className="grid aspect-[1.7/1] grid-cols-2 gap-[1px] overflow-hidden bg-neutral-100">{[0,1,2,3].map(i=>thumbs[i]?<img key={i} src={asset(thumbs[i])} className="h-full w-full object-cover" alt=""/>:<div key={i} className="bg-neutral-100"/>)}</div>
                    <div className="p-2.5"><div className="truncate text-xs font-black">{board.name}</div><div className="mt-0.5 text-[10px] text-neutral-400">{linked.length} bảng vải</div></div>
                  </button>
                  {can("fabric_library.edit")&&<div className="flex border-t p-1"><button type="button" onClick={()=>{setBoardHubOpen(false);setBoardForm({id:board.id,name:board.name,description:board.description||""})}} className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-black">Sửa</button><button type="button" onClick={()=>deletePinterestBoard(board)} className="rounded-lg px-2 py-1.5 text-[10px] font-black text-red-600">Xoá</button></div>}
                </div>
              })}
            </div>
          </div>
        </div>
      </Modal>}

      {boardForm&&<Modal title={boardForm.id?"Sửa bảng Pinterest":"Tạo bảng Pinterest"} onClose={()=>setBoardForm(null)}>
        <div className="space-y-4 p-4">
          <label className="block"><div className="mb-1 text-xs font-black uppercase text-neutral-400">Tên bảng</div><input autoFocus className={input} value={boardForm.name} onChange={e=>setBoardForm({...boardForm,name:e.target.value})} placeholder="VD: Vải Kids / Vải khoác / Denim"/></label>
          <label className="block"><div className="mb-1 text-xs font-black uppercase text-neutral-400">Mô tả</div><textarea className={`${input} min-h-28`} value={boardForm.description} onChange={e=>setBoardForm({...boardForm,description:e.target.value})} placeholder="Ghi chú ngắn..."/></label>
          <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={()=>setBoardForm(null)} className="rounded-2xl border px-4 py-3 text-sm font-black">Huỷ</button><button type="button" disabled={boardBusy||!boardForm.name.trim()} onClick={savePinterestBoard} className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{boardBusy?"Đang lưu...":"Lưu bảng"}</button></div>
        </div>
      </Modal>}

      {assignFabric&&<Modal title={`Bảng Pinterest · ${assignFabric.boardCode}`} onClose={()=>setAssignFabric(null)}>
        <div className="space-y-4 p-4">
          <div><div className="font-black">{assignFabric.name||"Bảng vải"}</div><div className="text-xs text-neutral-400">Có thể cho một bảng vải vào nhiều bảng Pinterest.</div></div>
          <div className="space-y-2">{pinBoards.map(board=>{const checked=assignBoardIds.includes(board.id);return <label key={board.id} className="flex items-start gap-3 rounded-2xl border p-3"><input type="checkbox" checked={checked} onChange={()=>setAssignBoardIds(x=>checked?x.filter(id=>id!==board.id):[...x,board.id])} className="mt-1 h-5 w-5"/><div className="min-w-0"><div className="font-black">{board.name}</div>{board.description&&<div className="mt-1 text-xs text-neutral-400">{board.description}</div>}</div></label>})}{!pinBoards.length&&<div className="rounded-2xl bg-neutral-50 p-6 text-center text-sm font-bold text-neutral-400">Chưa có bảng Pinterest.</div>}</div>
          <div className="flex items-center justify-between gap-2 border-t pt-4"><button type="button" onClick={()=>{setAssignFabric(null);setBoardForm({name:"",description:""})}} className="rounded-2xl border px-3 py-3 text-xs font-black">+ Tạo bảng</button><button type="button" onClick={saveBoardAssign} className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">Lưu</button></div>
        </div>
      </Modal>}
    </main>;
}

function BoardDetail({ board, can, onClose, onEdit, onDelete }: {
    board: FabricBoard;
    can: (key: string) => boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
 const rawGallery=Array.from(new Set([board.coverImageUrl,...(board.images||[]).map(x=>x.url)].filter(Boolean) as string[]));
 const gallery=rawGallery.map(asset).filter(Boolean);
 const [viewerIndex,setViewerIndex]=useState(0);
 const image=gallery[viewerIndex]||"";
 const images=board.images||[],dispatches=board.sampleDispatches||[],samples=board.designSamples||[],receipts=board.fabricReceipts||[];
 const [detailExpanded,setDetailExpanded]=useState(false);
 const swipeStartX=useRef<number|null>(null);

 const [zoomOpen,setZoomOpen]=useState(false);
 const [zoomScale,setZoomScale]=useState(1);
 const [zoomPos,setZoomPos]=useState({x:0,y:0});
 const zoomGesture=useRef<any>({});

 const prev=()=>setViewerIndex(i=>(i-1+gallery.length)%gallery.length);
 const next=()=>setViewerIndex(i=>(i+1)%gallery.length);

 function galleryTouchStart(e:any){swipeStartX.current=e.touches?.[0]?.clientX??null}
 function galleryTouchEnd(e:any){
   const sx=swipeStartX.current;
   const ex=e.changedTouches?.[0]?.clientX;
   swipeStartX.current=null;
   if(sx==null||ex==null||gallery.length<2)return;
   const dx=ex-sx;
   if(Math.abs(dx)<45)return;
   dx<0?next():prev();
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
     zoomGesture.current={mode:"pinch",startDistance:touchDistance(t),startScale:zoomScale};
   }else if(t.length===1&&zoomScale>1){
     zoomGesture.current={mode:"pan",startX:t[0].clientX,startY:t[0].clientY,originX:zoomPos.x,originY:zoomPos.y};
   }
 }
 function zoomTouchMove(e:any){
   const t=e.touches;
   if(t.length===2){
     e.preventDefault();
     const g=zoomGesture.current;
     const nextScale=Math.max(1,Math.min(4,(g.startScale||zoomScale)*(touchDistance(t)/Math.max(1,g.startDistance||touchDistance(t)))));
     setZoomScale(nextScale);
     if(nextScale<=1.02)setZoomPos({x:0,y:0});
   }else if(t.length===1&&zoomScale>1&&zoomGesture.current.mode==="pan"){
     e.preventDefault();
     const g=zoomGesture.current;
     setZoomPos({x:(g.originX||0)+(t[0].clientX-(g.startX||0)),y:(g.originY||0)+(t[0].clientY-(g.startY||0))});
   }
 }
 function zoomTouchEnd(){
   zoomGesture.current={};
   if(zoomScale<1.05){setZoomScale(1);setZoomPos({x:0,y:0})}
 }

 return <div className="fixed inset-0 z-[110] overflow-y-auto overscroll-contain bg-white text-neutral-950" style={{WebkitOverflowScrolling:"touch"}}>
   <div className="mx-auto min-h-[100svh] max-w-md bg-white pb-[max(24px,env(safe-area-inset-bottom))]">
     <section className="relative bg-neutral-100">
       <div
         className="relative flex min-h-[54svh] max-h-[74svh] items-center justify-center overflow-hidden"
         onTouchStart={galleryTouchStart}
         onTouchEnd={galleryTouchEnd}
         style={{touchAction:"pan-y"}}
       >
         {image
           ? <button type="button" onClick={openZoom} className="block w-full cursor-zoom-in">
               <img src={image} className="max-h-[74svh] w-full object-contain" alt=""/>
             </button>
           : <div className="grid h-[54svh] w-full place-items-center text-sm font-bold text-neutral-400">Chưa có ảnh bảng vải</div>
         }

         <button type="button" onClick={onClose} aria-label="Quay lại" className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] z-20 grid h-11 w-11 place-items-center rounded-full bg-white/92 shadow backdrop-blur">
           <ArrowLeft className="h-5 w-5"/>
         </button>

         {!!image&&<div className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-20 flex gap-2">
           <button type="button" onClick={(e)=>{e.stopPropagation();void saveImageToPhone(image,`${board.boardCode}-${viewerIndex+1}`)}} aria-label="Lưu ảnh" className="grid h-11 w-11 place-items-center rounded-full bg-white/92 shadow backdrop-blur">
             <Download className="h-5 w-5"/>
           </button>
         </div>}

         {gallery.length>1&&<>
           <button type="button" onClick={(e)=>{e.stopPropagation();prev()}} aria-label="Ảnh trước" className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl shadow">‹</button>
           <button type="button" onClick={(e)=>{e.stopPropagation();next()}} aria-label="Ảnh sau" className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl shadow">›</button>
           <span className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-black text-white">{viewerIndex+1}/{gallery.length}</span>
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
       <div className="text-[11px] font-black uppercase tracking-[.08em] text-neutral-400">{board.boardCode}</div>
       <h2 className="mt-1 text-[22px] font-black leading-tight">{board.name||"Bảng vải"}</h2>
       <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
         {board.fabricCode&&<span>{board.fabricCode}</span>}
         {board.composition&&<><span>·</span><span>{board.composition}</span></>}
         {(board.expectedGsm??board.gsm)!==null&&(board.expectedGsm??board.gsm)!==undefined&&<><span>·</span><span>{board.expectedGsm??board.gsm} GSM</span></>}
         {board.referencePriceVnd!==null&&board.referencePriceVnd!==undefined&&board.referencePriceVnd!==""&&<><span>·</span><span>{new Intl.NumberFormat("vi-VN").format(Number(board.referencePriceVnd||0))}đ/{board.referencePriceUnit==="KG"?"kg":"m"}</span></>}
       </div>

       <button type="button" onClick={()=>setDetailExpanded(v=>!v)} className="mt-3 flex w-full items-center justify-between border-y py-3 text-left">
         <div>
           <div className="text-sm font-black">Thông tin bảng vải</div>
           <div className="mt-0.5 text-[11px] text-neutral-400">{detailExpanded?"Thu gọn":"Bấm để xem chi tiết và chỉnh sửa"}</div>
         </div>
         <span className={`text-xl transition-transform ${detailExpanded?"rotate-180":""}`}>⌄</span>
       </button>

       {detailExpanded&&<div className="space-y-5 pt-4">
         <div className="grid grid-cols-2 gap-3">
           <Info label="Mã bảng vải" value={board.boardCode||"—"}/>
           <Info label="Mã chất vải" value={board.fabricCode||"—"}/>
           <Info label="GSM dự kiến" value={board.expectedGsm!=null?`${board.expectedGsm} GSM`:board.gsm?`${board.gsm} GSM`:"—"}/>
           <Info label="NCC" value={board.supplier?.code||board.supplier?.publicCode||board.supplier?.name||"—"}/>
           <Info label="Giá vải tham khảo" value={board.referencePriceVnd!==null&&board.referencePriceVnd!==undefined&&board.referencePriceVnd!==""?`${new Intl.NumberFormat("vi-VN").format(Number(board.referencePriceVnd||0))}đ / ${board.referencePriceUnit==="KG"?"kg":"m"}`:"—"}/>
         </div>
         <Info label="Thành phần chất vải" value={board.composition||"Chưa khai báo"}/>
         <ChipSection title="Mùa có thể dùng" values={board.seasons||[]}/>
         <ChipSection title="Nhóm sản phẩm phù hợp" values={board.productGroups||[]}/>
         {!!board.colors?.length&&<ChipSection title="Màu đã khai báo" values={board.colors.map(c=>`${c.name}${c.code?` ${String(c.code).startsWith("#")?c.code:`#${c.code}`}`:""}`)}/>}
         {board.note&&<Info label="Ghi chú bảng vải" value={board.note}/>}

         <section>
           <div className="flex items-center justify-between"><b className="text-sm">Lịch sử gửi làm mẫu</b><Badge>{dispatches.length} lần</Badge></div>
           <div className="mt-2 space-y-2">{dispatches.length?dispatches.map((d:any)=><div key={d.id} className="rounded-2xl border bg-white p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black">{d.designSample?.code||"—"} · {d.designSample?.name||"Mẫu"}</div><div className="mt-1 text-xs text-neutral-500">{fmtDate(d.sentAt)} · {d.fabricColor?.name||d.colorName||"—"} {d.fabricColor?.code||d.colorCode||""}</div></div><Badge>{dispatchLabel(d.status)}</Badge></div></div>):<Empty text="Chưa gửi đi làm mẫu."/>}</div>
         </section>

         <section>
           <div className="flex items-center justify-between"><b className="text-sm">Lịch sử sử dụng / mẫu đã sản xuất</b><Badge>{samples.length} mẫu</Badge></div>
           <div className="mt-2 space-y-2">{samples.length?samples.map((s:any)=><div key={s.id} className="rounded-2xl border bg-white p-3"><div className="font-black">{s.code} · {s.name}</div><div className="mt-1 text-xs text-neutral-500">{s.year||"—"} · {s.season||"—"} · {s.category||"—"}</div>{s.producedProduct&&<div className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800">Đã sản xuất: {s.producedProduct.name}{s.producedProduct.slug?` · ${s.producedProduct.slug}`:""}</div>}</div>):<Empty text="Chưa có mẫu sử dụng bảng vải này."/>}</div>
         </section>

         {!!receipts.length&&<section><div className="flex items-center justify-between"><b className="text-sm">Phiếu vải về liên quan</b><Badge>{receipts.length} phiếu</Badge></div><div className="mt-2 space-y-2">{receipts.map((r:any)=><div key={r.id} className="rounded-2xl bg-neutral-50 p-3"><div className="font-black">{r.receiptCode||"Phiếu vải"}</div><div className="mt-1 text-xs text-neutral-500">{r.fabricName||board.name||"—"} · {r.colorName||"—"} {r.colorCode||""}</div></div>)}</div></section>}

         <div className="grid grid-cols-2 gap-2 border-t pt-4">
           {can("fabric_library.edit")&&<button onClick={onEdit} className="rounded-2xl bg-neutral-950 py-3 text-sm font-black text-white"><Pencil className="mr-1 inline h-4 w-4"/>Sửa bảng</button>}
           {can("fabric_library.delete")&&<button onClick={onDelete} className="rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-black text-red-700"><Trash2 className="mr-1 inline h-4 w-4"/>Xoá bảng</button>}
         </div>
       </div>}
     </section>
   </div>

   {zoomOpen&&image&&<div className="fixed inset-0 z-[140] overflow-hidden bg-black" style={{touchAction:"none"}}>
     <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3" style={{paddingTop:"max(12px,env(safe-area-inset-top))"}}>
       <button type="button" onClick={closeZoom} className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-black shadow backdrop-blur"><X className="h-5 w-5"/></button>
       <div className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black text-white">{Math.round(zoomScale*100)}%</div>
     </div>
     <div className="flex h-full w-full items-center justify-center" onTouchStart={zoomTouchStart} onTouchMove={zoomTouchMove} onTouchEnd={zoomTouchEnd}>
       <img src={image} alt="" draggable={false} className="max-h-full max-w-full select-none object-contain" style={{transform:`translate3d(${zoomPos.x}px,${zoomPos.y}px,0) scale(${zoomScale})`,transformOrigin:"center center",transition:zoomGesture.current?.mode?"none":"transform 120ms ease-out"}}/>
     </div>
     <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-[max(18px,env(safe-area-inset-bottom))]">
       <div className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white/90">Chụm 2 ngón để zoom · kéo để xem</div>
     </div>
   </div>}
 </div>;
}
function BoardForm({ board, meta, canUpload, onClose, onSaved, onSupplierCreated }: {
    board: FabricBoard | null;
    meta: Meta;
    canUpload: boolean;
    onClose: () => void;
    onSaved: () => void;
    onSupplierCreated: (supplier: Supplier) => void;
}) { const [form, setForm] = useState<any>({ supplierId: board?.supplierId || board?.supplier?.id || "", boardCode: board?.boardCode || "", fabricCode: board?.fabricCode || "", name: board?.name || "", expectedGsm: board?.expectedGsm ?? board?.gsm ?? "", referencePriceVnd: board?.referencePriceVnd ?? "", referencePriceUnit: board?.referencePriceUnit || "METER", seasons: board?.seasons || [], productGroups: board?.productGroups || [], note: board?.note || "", coverImageUrl: board?.coverImageUrl || "" }); const [compositionParts, setCompositionParts] = useState<CompositionPart[]>(() => parseComposition(board?.composition)), [compositionDraft, setCompositionDraft] = useState(""), [images, setImages] = useState<BoardImage[]>(board?.images?.map(x => ({ ...x })) || []), [colors, setColors] = useState<BoardColor[]>(board?.colors?.map(x => ({ ...x })) || []), [productOpen, setProductOpen] = useState(false), [supplierCreating, setSupplierCreating] = useState(false), [supplierName, setSupplierName] = useState(""), [customGroup, setCustomGroup] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState(""); const patch = (k: string, v: any) => setForm((x: any) => ({ ...x, [k]: v })); function toggle(key: "seasons" | "productGroups", value: string) { setForm((x: any) => ({ ...x, [key]: x[key].includes(value) ? x[key].filter((v: string) => v !== value) : [...x[key], value] })); } function addComposition(name: string) { const clean = titleCase(name); if (!clean)
    return; if (compositionParts.some(x => x.name.toLowerCase() === clean.toLowerCase())) {
    setCompositionDraft("");
    return;
} setCompositionParts(x => [...x, { name: clean, percent: "" }]); setCompositionDraft(""); } async function pickImages(files?: FileList | File[]) { const list=Array.from(files||[]); if(!list.length)return; try { const uploaded:BoardImage[]=[]; for(const file of list){ const result=await uploadBoardImage(file); uploaded.push({type:"BOARD",url:result.url}); } setImages(current=>{const next=[...current,...uploaded]; if(!form.coverImageUrl&&next[0]?.url)patch("coverImageUrl",next[0].url); return next;}); } catch(e){ setError(e instanceof Error?e.message:"Không tải được ảnh."); } } async function createSupplier() { if (!supplierName.trim())
    return; try {
    const s = await api<Supplier>("/sample-fabric/fabric-suppliers", { method: "POST", body: JSON.stringify({ name: titleCase(supplierName) }) });
    onSupplierCreated(s);
    patch("supplierId", s.id);
    setSupplierName("");
    setSupplierCreating(false);
}
catch (e) {
    setError(e instanceof Error ? e.message : "Không tạo được NCC vải.");
} } async function save() { try {
    setSaving(true);
    setError("");
    if (!normalizeCode(form.boardCode))
        throw new Error("Thiếu mã bảng vải.");
    const total = compositionParts.reduce((s, p) => s + (Number(String(p.percent || "").replace(",", ".")) || 0), 0), has = compositionParts.some(x => String(x.percent).trim());
    if (has && Math.abs(total - 100) > .001)
        throw new Error(`Tổng tỷ lệ thành phần đang là ${total}%, phải bằng 100%.`);
    await api(board ? `/sample-fabric/library/${board.id}` : "/sample-fabric/library", { method: board ? "PATCH" : "POST", body: JSON.stringify({ supplierId: form.supplierId || null, boardCode: normalizeCode(form.boardCode), fabricCode: normalizeCode(form.fabricCode) || null, name: form.name.trim() || null, composition: compositionText(compositionParts) || null, expectedGsm: form.expectedGsm === "" ? null : Number(String(form.expectedGsm).replace(",", ".")), referencePriceVnd: form.referencePriceVnd === "" ? null : Number(String(form.referencePriceVnd).replace(/[^\d]/g, "")), referencePriceUnit: form.referencePriceUnit || "METER", seasons: form.seasons, productGroups: form.productGroups, note: form.note || null, coverImageUrl: form.coverImageUrl || images[0]?.url || null, images, colors: colors.filter(x => x.name.trim() || String(x.code || "").trim()).map(x => ({ ...x, name: titleCase(x.name), code: x.code ? `#${String(x.code).replace(/^#+/, "").trim()}` : null })) }) });
    if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    // Đợi 1 frame để iOS đóng keyboard trước khi unmount modal.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => onSaved());
    });
}
catch (e) {
    setError(e instanceof Error ? e.message : "Không lưu được bảng vải.");
}
finally {
    setSaving(false);
} } const compositionOptions = unique([...DEFAULT_COMPOSITIONS, ...(meta.fabricCompositions || [])]); return <Modal title={board ? `Sửa bảng vải ${board.boardCode}` : "Thêm bảng vải"} onClose={onClose}><div className="space-y-4 p-4">{error && <Err text={error}/>}<Field label="Ảnh bảng vải"><div className="rounded-3xl border border-dashed p-3">{!!images.length && <div className="mb-3 flex gap-2 overflow-x-auto">{images.map((img, i) => <div key={`${img.url}-${i}`} className="relative shrink-0"><img src={asset(img.url)} className="h-24 w-24 rounded-2xl object-cover" alt=""/><button type="button" onClick={() => { const next = images.filter((_, n) => n !== i); setImages(next); if (form.coverImageUrl === img.url)
    patch("coverImageUrl", next[0]?.url || ""); }} className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow"><X className="h-3 w-3"/></button></div>)}</div>}{canUpload ? <div className="grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-2xl bg-neutral-950 py-3 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-4 w-4"/>Chụp ảnh<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void pickImages(e.target.files||undefined)}/></label><label className="cursor-pointer rounded-2xl border py-3 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-4 w-4"/>Tải nhiều ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={e => void pickImages(e.target.files||undefined)}/></label></div> : <div className="text-xs text-neutral-400">Không có quyền tải ảnh.</div>}</div></Field><div className="grid grid-cols-2 gap-3"><Field label="Mã bảng vải"><input className={input} value={form.boardCode} onChange={e => patch("boardCode", normalizeCode(e.target.value))} placeholder="A2309"/></Field><Field label="Mã chất vải"><input className={input} value={form.fabricCode} onChange={e => patch("fabricCode", normalizeCode(e.target.value))} placeholder="KAKI01"/></Field></div><Field label="Tên bảng vải"><input className={input} value={form.name} onChange={e => patch("name", e.target.value)} onBlur={() => patch("name", titleCase(form.name))} placeholder="Vải Quần Kaki"/></Field><div className="grid grid-cols-[1fr_auto] gap-2"><Field label="Nhà cung cấp vải"><select className={input} value={form.supplierId} onChange={e => patch("supplierId", e.target.value)}><option value="">Chưa chọn NCC</option>{meta.suppliers.map(s => <option key={s.id} value={s.id}>{s.code || s.publicCode ? `${s.code || s.publicCode} · ` : ""}{s.name}</option>)}</select></Field><button type="button" onClick={() => setSupplierCreating(x => !x)} className="mt-[18px] h-[49px] rounded-2xl border px-3 text-xs font-black">+ NCC</button></div>{supplierCreating && <div className="flex gap-2 rounded-2xl bg-neutral-50 p-3"><input className={input} value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Tên NCC vải mới"/><button type="button" onClick={() => void createSupplier()} className="shrink-0 rounded-2xl bg-neutral-950 px-4 text-xs font-black text-white">Tạo</button></div>}<Field label="GSM dự kiến"><UnitInput value={form.expectedGsm} unit="GSM" onChange={v => patch("expectedGsm", v)}/></Field>
<div className="grid grid-cols-[1fr_120px] gap-2">
  <Field label="Giá vải tham khảo">
    <div className="relative">
      <input inputMode="numeric" className={`${input} pr-10`} value={form.referencePriceVnd ?? ""} onChange={e=>patch("referencePriceVnd",e.target.value.replace(/[^\d]/g,""))} placeholder="VD: 85000"/>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">đ</span>
    </div>
  </Field>
  <Field label="Đơn vị">
    <select className={input} value={form.referencePriceUnit||"METER"} onChange={e=>patch("referencePriceUnit",e.target.value)}>
      <option value="METER">/ mét</option>
      <option value="KG">/ kg</option>
    </select>
  </Field>
</div>
<section className="rounded-3xl border p-3"><div className="text-sm font-black">Thành phần chất vải</div><div className="mt-1 text-[11px] text-neutral-400">Chọn chất liệu rồi điền %. Nếu có tỷ lệ thì tổng phải bằng 100%.</div><div className="mt-3 flex flex-wrap gap-2">{compositionOptions.map(name => { const selected = compositionParts.some(x => x.name.toLowerCase() === name.toLowerCase()); return <button type="button" key={name} onClick={() => selected ? setCompositionParts(x => x.filter(p => p.name.toLowerCase() !== name.toLowerCase())) : addComposition(name)} className={`rounded-full border px-3 py-2 text-[11px] font-black ${selected ? "bg-neutral-950 text-white" : "bg-white"}`}>{name}</button>; })}</div><div className="mt-3 flex gap-2"><input className={input} value={compositionDraft} onChange={e => setCompositionDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") {
    e.preventDefault();
    addComposition(compositionDraft);
} }} placeholder="Thêm thành phần khác"/><button type="button" onClick={() => addComposition(compositionDraft)} className="shrink-0 rounded-2xl border px-4 text-xs font-black">+ Thêm</button></div>{!!compositionParts.length && <div className="mt-3 space-y-2">{compositionParts.map((part, i) => <div key={`${part.name}-${i}`} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 rounded-2xl bg-neutral-50 p-2"><b className="px-1 text-sm">{part.name}</b><UnitInput value={part.percent} unit="%" onChange={v => setCompositionParts(x => x.map((p, n) => n === i ? { ...p, percent: v } : p))}/><button type="button" onClick={() => setCompositionParts(x => x.filter((_, n) => n !== i))} className="grid h-9 w-9 place-items-center text-red-600"><X className="h-4 w-4"/></button></div>)}<div className="text-xs text-neutral-500">Lưu thành: <b>{compositionText(compositionParts)}</b></div></div>}</section><section><div className={label}>Mùa có thể dùng</div><div className="flex flex-wrap gap-2">{meta.seasons.map(s => <button type="button" key={s} onClick={() => toggle("seasons", s)} className={`rounded-full border px-3 py-2 text-xs font-black ${form.seasons.includes(s) ? "bg-neutral-950 text-white" : "bg-white"}`}>{s}</button>)}</div></section><section><div className={label}>Nhóm sản phẩm phù hợp</div><button type="button" onClick={() => setProductOpen(x => !x)} className="flex min-h-[49px] w-full items-center justify-between rounded-2xl border bg-white px-3.5 text-left text-[16px]"><span className={form.productGroups.length ? "font-bold" : "text-neutral-400"}>{form.productGroups.length ? `Đã chọn ${form.productGroups.length} nhóm` : "Chọn nhóm sản phẩm"}</span><ChevronDown className={`h-4 w-4 ${productOpen ? "rotate-180" : ""}`}/></button>{productOpen && <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border bg-white p-2" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}>{meta.productGroups.map(g => <label key={g} className="flex items-center gap-3 rounded-xl px-3 py-2.5"><input type="checkbox" checked={form.productGroups.includes(g)} onChange={() => toggle("productGroups", g)} className="h-4 w-4"/><span className="text-sm font-bold">{g}</span></label>)}</div>}<div className="mt-2 flex flex-wrap gap-1.5">{form.productGroups.map((g: string) => <button type="button" key={g} onClick={() => toggle("productGroups", g)} className="rounded-full bg-neutral-950 px-3 py-1.5 text-[11px] font-black text-white">{g} ×</button>)}</div><input className={`${input} mt-2`} value={customGroup} onChange={e => setCustomGroup(e.target.value)} onKeyDown={e => { if (e.key === "Enter") {
    e.preventDefault();
    const g = titleCase(customGroup);
    if (g && !form.productGroups.includes(g))
        patch("productGroups", [...form.productGroups, g]);
    setCustomGroup("");
} }} placeholder="Gõ nhóm mới rồi Enter"/></section><section className="rounded-3xl border p-3"><div className="flex items-center justify-between"><div><div className="text-sm font-black">Màu trên bảng</div><div className="mt-1 text-[11px] text-neutral-400">Không bắt buộc; chỉ thêm khi cần.</div></div><button type="button" onClick={() => setColors(x => [...x, { name: "", code: "" }])} className="rounded-xl border px-3 py-2 text-xs font-black">+ Màu</button></div>{!!colors.length && <div className="mt-3 space-y-2">{colors.map((c, i) => <div key={c.id || i} className="grid grid-cols-[1fr_100px_auto] gap-2"><input className={input} value={c.name} onChange={e => setColors(x => x.map((p, n) => n === i ? { ...p, name: e.target.value } : p))} placeholder="Tên màu"/><input className={input} value={c.code || ""} onChange={e => setColors(x => x.map((p, n) => n === i ? { ...p, code: e.target.value ? `#${e.target.value.replace(/^#+/, "")}` : "" } : p))} placeholder="#2"/><button type="button" onClick={() => setColors(x => x.filter((_, n) => n !== i))} className="grid h-12 w-10 place-items-center text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>}</section><Field label="Ghi chú bảng vải"><textarea className={`${input} min-h-24`} value={form.note} onChange={e => patch("note", e.target.value)} placeholder="Ứng dụng, cảm giác tay, lưu ý xử lý..."/></Field><div className="sticky bottom-0 z-50 -mx-4 border-t bg-white/95 px-4 pt-3 backdrop-blur" style={{paddingBottom:"max(18px,env(safe-area-inset-bottom))"}}><div className="grid grid-cols-2 gap-2"><button onClick={onClose} className="rounded-2xl border py-3 text-sm font-black">Đóng</button><button disabled={saving} onClick={() => void save()} className="rounded-2xl bg-neutral-950 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? "Đang lưu..." : "Lưu bảng vải"}</button></div></div></div></Modal>; }
function Modal({ title, children, onClose }: {
    title: string;
    children: any;
    onClose: () => void;
}) {
    const scrollYRef = useRef(0);

    useEffect(() => {
        const body = document.body;
        const html = document.documentElement;
        const y = window.scrollY || html.scrollTop || body.scrollTop || 0;
        scrollYRef.current = y;

        const previous = {
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
            overflow: body.style.overflow,
            overscrollBehavior: body.style.overscrollBehavior,
        };

        // Khóa body theo đúng vị trí hiện tại. Cách này tránh iOS làm lệch visual viewport
        // sau khi bàn phím đóng hoặc modal bị unmount vì bấm Lưu.
        body.style.position = "fixed";
        body.style.top = `-${y}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";
        body.style.overflow = "hidden";
        body.style.overscrollBehavior = "none";
        html.style.overscrollBehavior = "none";

        return () => {
            body.style.position = previous.position;
            body.style.top = previous.top;
            body.style.left = previous.left;
            body.style.right = previous.right;
            body.style.width = previous.width;
            body.style.overflow = previous.overflow;
            body.style.overscrollBehavior = previous.overscrollBehavior;
            html.style.overscrollBehavior = "";

            const restoreY = scrollYRef.current;
            requestAnimationFrame(() => {
                window.scrollTo({ left: 0, top: restoreY, behavior: "auto" });
                window.setTimeout(() => {
                    window.scrollTo({ left: 0, top: restoreY, behavior: "auto" });
                }, 80);
            });
        };
    }, []);

    function close() {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        onClose();
    }

    return <div
        className="fixed inset-0 z-[100] bg-black/45"
        style={{overscrollBehavior:"none"}}
    >
        <div
            className="h-full overflow-y-auto overscroll-contain px-3"
            style={{
                paddingTop:"max(12px, env(safe-area-inset-top))",
                paddingBottom:"max(12px, env(safe-area-inset-bottom))",
                WebkitOverflowScrolling:"touch",
            }}
        >
            <div className="mx-auto min-h-full w-full max-w-md overflow-visible rounded-[30px] bg-white shadow-2xl">
                <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-white/95 p-4 backdrop-blur">
                    <h2 className="min-w-0 truncate pr-3 font-black">{title}</h2>
                    <button onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border">
                        <X className="h-4 w-4"/>
                    </button>
                </div>
                {children}
            </div>
        </div>
    </div>;
}
function Field({ label: text, children }: {
    label: string;
    children: any;
}) { return <label className="block"><span className={label}>{text}</span>{children}</label>; }
function UnitInput({ value, unit, onChange }: {
    value: any;
    unit: string;
    onChange: (v: string) => void;
}) { return <div className="relative"><input inputMode="decimal" className={`${input} pr-12`} value={value ?? ""} onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, "").replace(".", ","))}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">{unit}</span></div>; }
function Info({ label, value }: {
    label: string;
    value: any;
}) { return <div className="rounded-2xl bg-neutral-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">{label}</div><div className="mt-1 whitespace-pre-wrap break-words text-sm font-black">{value}</div></div>; }
function Mini({ label, value }: {
    label: string;
    value: any;
}) { return <div className="rounded-xl bg-neutral-50 p-2"><div className="text-[9px] font-black uppercase text-neutral-400">{label}</div><div className="mt-1 text-xs font-bold">{value}</div></div>; }
function ChipSection({ title, values }: {
    title: string;
    values: string[];
}) { return <section><b className="text-sm">{title}</b><div className="mt-2 flex flex-wrap gap-2">{values.length ? values.map(x => <Badge key={x}>{x}</Badge>) : <span className="text-xs text-neutral-400">Chưa khai báo.</span>}</div></section>; }
function Badge({ children }: {
    children: any;
}) { return <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-black text-neutral-600">{children}</span>; }
function Empty({ text }: {
    text: string;
}) { return <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-neutral-400">{text}</div>; }
function Err({ text }: {
    text: string;
}) { return <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{text}</div>; }
const label = "mb-1.5 block text-[10px] font-black uppercase tracking-wide text-neutral-400";
const input = "w-full min-w-0 rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-neutral-950";
