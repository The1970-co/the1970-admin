"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import { hasPermission, type AppRole } from "@/lib/authz";

type Section = "library" | "samples" | "fabric";
type Supplier = { id: string; code: string; name: string; phone?: string | null; email?: string | null; address?: string | null; note?: string | null };
type Branch = { id: string; name: string };
type Staff = { id: string; code: string; name: string; branchId?: string | null };

type BoardColor = { id?: string; name: string; code?: string | null; imageUrl?: string | null; note?: string | null };
type BoardImage = { id?: string; type?: string; url: string; caption?: string | null };
type FabricBoard = {
  id: string; supplierId: string; boardCode: string; fabricCode?: string | null; name?: string | null;
  composition?: string | null; expectedGsm?: number | null; seasons: string[]; productGroups: string[];
  coverImageUrl?: string | null; note?: string | null; supplier?: Supplier; colors: BoardColor[]; images: BoardImage[];
  _count?: { designSamples: number; sampleDispatches: number; fabricReceipts: number };
  sampleDispatches?: Array<any>; designSamples?: Array<any>;
};
type Dispatch = {
  id: string; designSampleId: string; fabricBoardId: string; fabricColorId?: string | null; recipientName: string;
  recipientType?: string | null; recipientContact?: string | null; sentAt: string; sentById?: string | null;
  sentByName?: string | null; dueDate?: string | null; returnedAt?: string | null; status: string; note?: string | null;
  fabricColor?: BoardColor | null; fabricBoard?: FabricBoard | null;
};

type SampleColor = { id?: string; name: string; code?: string | null; status?: string; note?: string | null; imageUrl?: string | null };
type Sample = {
  id: string; code: string; name: string; year: number; season?: string | null; category?: string | null;
  fabricBoardId?: string | null; fabricColorId?: string | null; fabricBoard?: FabricBoard | null; fabricColor?: BoardColor | null;
  sampleDispatches?: Dispatch[]; matchedProduct?: { id:string; name:string; slug:string; imageUrl?:string|null } | null; producedProduct?: { id:string; name:string; slug:string; imageUrl?:string|null } | null;
  supplierId?: string | null; supplier?: Supplier | null; fabricBoardCode?: string | null; fabricCode?: string | null; fabricComposition?: string | null;
  status: string; assigneeStaffId?: string | null; assigneeName?: string | null; nextAction?: string | null;
  dueDate?: string | null; coverImageUrl?: string | null; note?: string | null; technicalNote?: string | null;
  colors: SampleColor[]; images?: Array<{ id?: string; url: string; caption?: string | null }>;
  progressLogs?: Array<{ id: string; fromStatus?: string | null; toStatus: string; note?: string | null; actorName?: string | null; createdAt: string }>;
  _count?: { fabricReceipts: number };
};

type Roll = { id?: string; rollCode?: string | null; supplierDeclaredM?: number | string | null; supplierDeclaredKg?: number | string | null; actualM?: number | string | null; actualKg?: number | string | null; defectNote?: string | null; passed?: boolean };
type Measurement = { id: string; areaCm2: number; weightGrams: number; gsm: number; positionLabel?: string | null; imageUrl?: string | null; measuredByName?: string | null; createdAt: string };
type FabricReceipt = {
  id: string; receiptCode: string; designSampleId?: string | null; designSample?: Pick<Sample, "id"|"code"|"name"|"year"> | null;
  fabricBoardId?: string | null; fabricColorId?: string | null; fabricBoard?: FabricBoard | null; fabricColor?: BoardColor | null;
  supplierId?: string | null; supplier?: Supplier | null; branchId?: string | null; branch?: Branch | null;
  fabricBoardCode?: string | null; fabricCode?: string | null; fabricName?: string | null; colorName?: string | null; colorCode?: string | null; lotCode?: string | null;
  supplierDeclaredM?: number | null; supplierDeclaredKg?: number | null; actualM?: number | null; actualKg?: number | null; rollCount: number;
  unitPrice?: number | null; priceUnit: "METER"|"KG"|"ROLL"; expectedGsm?: number | null; measuredGsm?: number | null;
  varianceApproved: boolean; status: string; receivedAt?: string | null; completedAt?: string | null; note?: string | null;
  createdByName?: string | null; updatedAt: string; rolls: Roll[]; measurements: Measurement[];
  images: Array<{ id: string; type: string; url: string; caption?: string | null }>;
};

const SAMPLE_STATUSES = [
  ["IDEA", "Ý tưởng"], ["FABRIC_SELECTED", "Chọn vải"], ["SAMPLING", "Đang lên mẫu"], ["SAMPLE_READY", "Đã có mẫu thử"],
  ["REVISING", "Đang chỉnh sửa"], ["APPROVED_FOR_PRODUCTION", "Duyệt sản xuất"], ["IN_PRODUCTION", "Đang sản xuất"],
  ["COMPLETED", "Hoàn thành"], ["ON_HOLD", "Tạm dừng"],
] as const;
const RECEIPT_STATUSES = [["DRAFT","Nháp"],["RECEIVING","Đang nhận"],["INSPECTING","Đang kiểm"],["COMPLETED","Hoàn tất"],["CANCELLED","Đã huỷ"]] as const;
const DISPATCH_STATUSES = [["SENT","Đã gửi"],["RECEIVED","Xưởng đã nhận"],["MAKING","Đang làm"],["RETURNED","Mẫu đã về"],["REVISING","Đang sửa"],["APPROVED","Đã duyệt"],["CANCELLED","Huỷ"]] as const;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || localStorage.getItem("accessToken") || localStorage.getItem("the1970_token") || "";
}
function authHeaders(json = true) {
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}) };
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...authHeaders(init?.body instanceof FormData ? false : true), ...(init?.headers || {}) } });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return res.json();
}
function assetUrl(url?: string | null) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}
function num(v: any) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v: any, digits = 2) { return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(num(v)); }
function money(v: any) { return new Intl.NumberFormat("vi-VN").format(num(v)) + "đ"; }
function date(v?: string | null) { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN"); }
function confirmDelete(message: string) { return typeof window !== "undefined" && window.confirm(message); }
function statusLabel(value: string, list: readonly (readonly [string,string])[]) { return list.find(x => x[0] === value)?.[1] || value; }
function statusTone(status: string) {
  if (["COMPLETED","APPROVED_FOR_PRODUCTION"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["ON_HOLD","CANCELLED"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  if (["REVISING","INSPECTING"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}
function Badge({ children, status, tone }: { children: React.ReactNode; status?: string; tone?: "gray"|"blue"|"green"|"amber"|"red" }) {
  const toneClass = tone ? ({ gray:"bg-neutral-100 text-neutral-700 border-neutral-200", blue:"bg-blue-50 text-blue-700 border-blue-200", green:"bg-emerald-50 text-emerald-700 border-emerald-200", amber:"bg-amber-50 text-amber-700 border-amber-200", red:"bg-red-50 text-red-700 border-red-200" } as const)[tone] : statusTone(status || "");
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}
function Card({ children, className="" }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>{children}</label>; }
const inputClass = "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-neutral-900";

function titleCaseVi(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part ? part.charAt(0).toLocaleUpperCase("vi-VN") + part.slice(1).toLocaleLowerCase("vi-VN") : "")
    .join(" ");
}
function normalizeSampleCode(value: string) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}
type FabricCompositionPart = { name: string; percent: string };

function parseCompositionParts(value?: string | null): FabricCompositionPart[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)(?:\s+(\d+(?:[.,]\d+)?)\s*%)?$/);
      const name = titleCaseVi(String(match?.[1] || item).trim());
      const percent = String(match?.[2] || "").replace(",", ".");
      return { name, percent };
    })
    .filter((item) => Boolean(item.name));
}

function compositionTokens(value?: string | null) {
  return parseCompositionParts(value).map((item) => item.name);
}

function compositionText(parts: FabricCompositionPart[]) {
  return parts
    .filter((item) => item.name)
    .map((item) => `${titleCaseVi(item.name)}${item.percent !== "" ? ` ${item.percent}%` : ""}`)
    .join(", ");
}

function uniqueTextValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base", numeric: true }));
}

type WorkspaceMeta = {
  suppliers: Supplier[]; staff: Staff[]; seasons: string[]; productGroups: string[]; fabricCompositions: string[];
  boards?: FabricBoard[]; branches?: Branch[]; samples?: Array<Pick<Sample,"id"|"code"|"name"|"year"|"fabricBoardId"|"fabricColorId">>;
};

function usePermissions() {
  const user = getCurrentUserFromStorage() as any;
  const role = String(user?.role || "admin").toLowerCase() as AppRole;
  const owner = role === "admin" || role === "owner";
  const keys = new Set<string>();
  [...(user?.permissions || []), ...(user?.permissionKeys || [])].forEach((x: any) => x && keys.add(String(x)));
  (user?.branchPermissions || []).forEach((row: any) => [...(row?.permissionKeys || []), ...(row?.extraPermissionKeys || [])].forEach((x: any) => x && keys.add(String(x))));
  const can = (key: string) => owner || keys.has("*") || keys.has(key) || hasPermission(role, key as any);
  return { can, owner };
}

async function uploadWorkspaceFile(path: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<{ url: string }>(path, { method: "POST", body: fd });
}

export default function SampleFabricWorkspaceClient({ defaultSection }: { defaultSection: Section }) {
  const { can } = usePermissions();
  const canViewLibrary = can("fabric_library.view");
  const canViewSamples = can("design_sample.view");
  const canViewFabric = can("fabric_receipt.view");

  const [boards, setBoards] = useState<FabricBoard[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [receipts, setReceipts] = useState<FabricReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [productGroups, setProductGroups] = useState<string[]>([]);
  const [fabricCompositions, setFabricCompositions] = useState<string[]>([]);
  const [metaSamples, setMetaSamples] = useState<Array<Pick<Sample,"id"|"code"|"name"|"year"|"fabricBoardCode"|"fabricCode">>>([]);
  const [workspaceMeta, setWorkspaceMeta] = useState<WorkspaceMeta>({ suppliers: [], staff: [], seasons: [], productGroups: [], fabricCompositions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [sampleStatus, setSampleStatus] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("");
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FabricReceipt | null>(null);
  const [measureReceipt, setMeasureReceipt] = useState<FabricReceipt | null>(null);
  const [boardForm, setBoardForm] = useState<FabricBoard | null | undefined>(undefined);
  const [boardDetail, setBoardDetail] = useState<FabricBoard | null>(null);
  const [dispatchBoard, setDispatchBoard] = useState<FabricBoard | null>(null);
  const [dispatchSample, setDispatchSample] = useState<Sample | null>(null);

  async function loadLibrary() {
    const [rows, meta, productCategoryOptions] = await Promise.all([
      api<FabricBoard[]>(`/sample-fabric/library${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
      api<WorkspaceMeta>("/sample-fabric/library/meta"),
      api<string[]>("/products/category-options").catch(() => []),
    ]);
    const groups = uniqueTextValues([...(productCategoryOptions || []), ...(meta.productGroups || [])]);
    setBoards(rows); setWorkspaceMeta({ ...meta, productGroups: groups }); setSuppliers(meta.suppliers || []); setStaff(meta.staff || []); setSeasons(meta.seasons || []); setProductGroups(groups); setFabricCompositions(meta.fabricCompositions || []);
  }
  async function loadSamples() {
    const params = new URLSearchParams();
    if (sampleStatus) params.set("status", sampleStatus);
    if (q.trim()) params.set("q", q.trim());
    const [rows, meta, productCategoryOptions] = await Promise.all([
      api<Sample[]>(`/sample-fabric/samples${params.toString() ? `?${params}` : ""}`),
      api<WorkspaceMeta>("/sample-fabric/samples/meta"),
      api<string[]>("/products/category-options").catch(() => []),
    ]);
    const groups = uniqueTextValues([...(productCategoryOptions || []), ...(meta.productGroups || [])]);
    setSamples(rows); setWorkspaceMeta({ ...meta, productGroups: groups }); setSuppliers(meta.suppliers || []); setStaff(meta.staff || []); setSeasons(meta.seasons || []); setProductGroups(groups); setFabricCompositions(meta.fabricCompositions || []);
  }
  async function loadFabric() {
    const params = new URLSearchParams();
    if (receiptStatus) params.set("status", receiptStatus);
    if (q.trim()) params.set("q", q.trim());
    const [rows, meta] = await Promise.all([
      api<FabricReceipt[]>(`/sample-fabric/fabric-receipts${params.toString() ? `?${params}` : ""}`),
      api<WorkspaceMeta>("/sample-fabric/fabric-receipts/meta"),
    ]);
    setReceipts(rows); setWorkspaceMeta(meta); setSuppliers(meta.suppliers || []); setBranches(meta.branches || []); setStaff(meta.staff || []);
    setMetaSamples((meta.samples || []).map((s:any)=>({ ...s, fabricBoardCode: (s as any).fabricBoardCode, fabricCode: (s as any).fabricCode })));
  }
  async function reload() {
    try {
      setLoading(true); setError("");
      if (defaultSection === "library") await loadLibrary();
      else if (defaultSection === "samples") await loadSamples();
      else await loadFabric();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, [defaultSection, sampleStatus, receiptStatus]);

  const filteredSamples = useMemo(() => {
    const key=q.trim().toLowerCase(); if(!key) return samples;
    return samples.filter(x=>[x.code,x.name,x.category,x.fabricBoardCode,x.fabricCode,x.fabricComposition,x.fabricBoard?.boardCode,x.fabricBoard?.fabricCode,x.supplier?.name,x.assigneeName,...x.colors.map(c=>c.name)].some(v=>String(v||"").toLowerCase().includes(key)));
  },[samples,q]);
  const filteredReceipts = useMemo(() => {
    const key=q.trim().toLowerCase(); if(!key) return receipts;
    return receipts.filter(x=>[x.receiptCode,x.fabricName,x.fabricBoardCode,x.fabricCode,x.fabricBoard?.boardCode,x.colorName,x.colorCode,x.lotCode,x.supplier?.name,x.designSample?.code,x.designSample?.name].some(v=>String(v||"").toLowerCase().includes(key)));
  },[receipts,q]);

  if (defaultSection === "library" && !canViewLibrary) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem thư viện bảng vải.</div>;
  if (defaultSection === "samples" && !canViewSamples) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem quản lý mẫu mã.</div>;
  if (defaultSection === "fabric" && !canViewFabric) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem vải về.</div>;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Sản xuất / nguyên liệu</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">Mẫu mã & Vải</h1><p className="mt-1 text-sm text-neutral-500">Bảng vải, lịch sử gửi làm mẫu, tiến độ mẫu và kiểm thực nhận vải.</p></div>
      <div className="flex flex-wrap gap-2">
        {canViewLibrary && <Link href="/fabric-library" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "library" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Bảng vải</Link>}
        {canViewSamples && <Link href="/design-samples" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "samples" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Triển khai mẫu</Link>}
        {canViewFabric && <Link href="/fabric-receipts" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "fabric" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Vải về</Link>}
      </div>
    </div>
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card className="p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center">
      <input className={`${inputClass} md:max-w-md`} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void reload()}} placeholder={defaultSection==="library"?"Tìm NCC, mã bảng, mã vải, thành phần...":defaultSection==="samples"?"Tìm mã mẫu, tên mẫu, bảng vải, màu...":"Tìm phiếu, mã vải, màu, lô, NCC..."}/>
      {defaultSection === "samples" && <select className={`${inputClass} md:w-56`} value={sampleStatus} onChange={e=>setSampleStatus(e.target.value)}><option value="">Tất cả tiến độ</option>{SAMPLE_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>}
      {defaultSection === "fabric" && <select className={`${inputClass} md:w-56`} value={receiptStatus} onChange={e=>setReceiptStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{RECEIPT_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>}
      <div className="md:ml-auto flex gap-2">
        {q.trim() && <button onClick={()=>void reload()} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold">Tìm</button>}
        {defaultSection === "library" && can("fabric_library.create") && <button onClick={()=>setBoardForm(null)} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Thêm bảng vải</button>}
        {defaultSection === "samples" && can("design_sample.create") && <button onClick={()=>{setEditingSample(null);setShowSampleForm(true)}} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Tạo mẫu</button>}
        {defaultSection === "fabric" && can("fabric_receipt.create") && <button onClick={()=>{setEditingReceipt(null);setShowReceiptForm(true)}} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Nhận vải</button>}
      </div>
    </div></Card>

    {loading ? <Card className="p-10 text-center text-sm text-neutral-500">Đang tải dữ liệu...</Card> : defaultSection === "library" ?
      <LibraryView rows={boards} can={can} onEdit={x=>setBoardForm(x)} onDetail={async x=>{const full=await api<FabricBoard>(`/sample-fabric/library/${x.id}`);setBoardDetail(full)}} onDispatch={x=>setDispatchBoard(x)} onChanged={reload}/> :
      defaultSection === "samples" ? <SamplesView rows={filteredSamples} can={can} onEdit={x=>{setEditingSample(x);setShowSampleForm(true)}} onChanged={reload}/> :
      <FabricView rows={filteredReceipts} can={can} onEdit={x=>{setEditingReceipt(x);setShowReceiptForm(true)}} onMeasure={setMeasureReceipt} onChanged={reload}/>}

    {boardForm !== undefined && <BoardForm board={boardForm} meta={workspaceMeta} canUpload={can("fabric_library.upload_images")} onSupplierCreated={supplier=>setWorkspaceMeta(m=>({...m,suppliers:[...m.suppliers.filter(x=>x.id!==supplier.id),supplier].sort((a,b)=>a.name.localeCompare(b.name,"vi"))}))} onClose={()=>setBoardForm(undefined)} onSaved={async()=>{setBoardForm(undefined);await reload()}}/>}
    {boardDetail && <BoardDetail board={boardDetail} can={can} onClose={()=>setBoardDetail(null)} onDispatch={()=>{setDispatchBoard(boardDetail);setBoardDetail(null)}}/>}
    {dispatchBoard && <DispatchForm board={dispatchBoard} sample={null} meta={workspaceMeta} onClose={()=>setDispatchBoard(null)} onSaved={async()=>{setDispatchBoard(null);await reload()}}/>}
    {dispatchSample && dispatchSample.fabricBoard && <DispatchForm board={dispatchSample.fabricBoard} sample={dispatchSample} meta={workspaceMeta} onClose={()=>setDispatchSample(null)} onSaved={async()=>{setDispatchSample(null);await reload()}}/>}
    {showSampleForm && <SampleForm sample={editingSample} boards={workspaceMeta.boards || []} suppliers={suppliers} staff={staff} seasons={seasons} productGroups={productGroups} fabricCompositions={fabricCompositions} canUpload={can("design_sample.upload_images")} onSupplierCreated={(supplier)=>setSuppliers((rows)=>[...rows.filter((row)=>row.id!==supplier.id),supplier].sort((a,b)=>a.name.localeCompare(b.name,"vi")))} onClose={()=>setShowSampleForm(false)} onSaved={async()=>{setShowSampleForm(false);await reload()}} />}
    {showReceiptForm && <ReceiptForm receipt={editingReceipt} suppliers={suppliers} branches={branches} samples={metaSamples} canCostView={can("fabric_receipt.cost.view") || can("fabric_receipt.cost.edit")} canCostEdit={can("fabric_receipt.cost.edit")} onClose={()=>setShowReceiptForm(false)} onSaved={async()=>{setShowReceiptForm(false);await reload()}} />}
    {measureReceipt && <MeasurementForm receipt={measureReceipt} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setMeasureReceipt(null)} onSaved={async()=>{setMeasureReceipt(null);await reload()}} />}
  </div>;
}

function LibraryView({rows,can,onEdit,onDetail,onDispatch,onChanged}:{rows:FabricBoard[];can:(k:string)=>boolean;onEdit:(x:FabricBoard)=>void;onDetail:(x:FabricBoard)=>void;onDispatch:(x:FabricBoard)=>void;onChanged:()=>Promise<void>}){
  if(!rows.length)return <Card className="p-12 text-center text-sm text-neutral-500">Chưa có bảng vải.</Card>;
  return <div className="grid gap-4 xl:grid-cols-2">{rows.map(b=><Card key={b.id} className="overflow-hidden"><div className="flex gap-4 p-4">
    <button onClick={()=>onDetail(b)} className="h-32 w-28 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">{b.coverImageUrl?<img src={assetUrl(b.coverImageUrl)} className="h-full w-full object-cover"/>:<span className="text-2xl text-neutral-300">✦</span>}</button>
    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase text-neutral-400">{b.supplier?.name||"NCC"} · {b.boardCode}</div><h3 className="mt-1 text-lg font-semibold">{b.name||b.fabricCode||"Bảng vải"}</h3></div><Badge tone="blue">{b.fabricCode||"—"}</Badge></div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2"><div><span className="text-neutral-400">Thành phần:</span> {b.composition||"—"}</div><div><span className="text-neutral-400">GSM:</span> {b.expectedGsm?fmt(b.expectedGsm,1):"—"}</div></div>
      <div className="mt-3 flex flex-wrap gap-1.5">{b.seasons.map(x=><Badge key={x}>{x}</Badge>)}{b.productGroups.map(x=><Badge key={x} tone="green">{x}</Badge>)}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">{b.colors.slice(0,8).map(c=><span key={`${c.code}-${c.name}`} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs">{c.name}{c.code?` · ${c.code}`:""}</span>)}{b.colors.length>8&&<span className="text-xs text-neutral-400">+{b.colors.length-8}</span>}</div>
    </div>
  </div><div className="flex flex-wrap items-center gap-2 border-t px-4 py-3"><span className="mr-auto text-xs text-neutral-400">{b._count?.designSamples||0} mẫu · {b._count?.sampleDispatches||0} lần gửi · {b._count?.fabricReceipts||0} phiếu vải</span>
    {can("sample_dispatch.create")&&<button onClick={()=>onDispatch(b)} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">Gửi làm mẫu</button>}
    <button onClick={()=>onDetail(b)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Lịch sử</button>
    {can("fabric_library.edit")&&<button onClick={()=>onEdit(b)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Sửa</button>}
    {can("fabric_library.delete")&&<button onClick={async()=>{if(!confirmDelete(`Xoá bảng vải ${b.boardCode}?`))return;await api(`/sample-fabric/library/${b.id}`,{method:"DELETE"});await onChanged()}} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Xoá</button>}
  </div></Card>)}</div>
}

function BoardDetail({board,can,onClose,onDispatch}:{board:any;can:(k:string)=>boolean;onClose:()=>void;onDispatch:()=>void}){
  return <Modal title={`Bảng vải ${board.boardCode}`} onClose={onClose}><div className="space-y-6 p-5">
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div><h3 className="font-semibold">Ảnh bảng vải / miếng vải</h3><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{(board.images||[]).map((im:BoardImage)=><img key={im.id||im.url} src={assetUrl(im.url)} className="aspect-square w-full rounded-2xl object-cover"/>)}{!board.images?.length&&<div className="col-span-full rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-400">Chưa có ảnh.</div>}</div></div>
      <Card className="p-4"><div className="text-sm"><b>{board.supplier?.name}</b><div className="mt-2">Mã bảng: <b>{board.boardCode}</b></div><div>Mã vải: <b>{board.fabricCode||"—"}</b></div><div>Thành phần: {board.composition||"—"}</div><div>Mùa: {board.seasons?.join(", ")||"—"}</div><div>Nhóm SP: {board.productGroups?.join(", ")||"—"}</div></div>{can("sample_dispatch.create")&&<button onClick={onDispatch} className="mt-4 w-full rounded-xl bg-neutral-950 px-3 py-2 text-sm font-semibold text-white">+ Gửi miếng vải đi làm mẫu</button>}</Card>
    </div>
    <div><h3 className="font-semibold">Lịch sử gửi làm mẫu</h3><div className="mt-2 overflow-x-auto rounded-2xl border"><table className="min-w-[950px] w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500"><tr><th className="p-3">Ngày gửi</th><th className="p-3">Mẫu</th><th className="p-3">Màu</th><th className="p-3">Công ty / xưởng</th><th className="p-3">Người gửi</th><th className="p-3">Hạn</th><th className="p-3">Tiến độ</th></tr></thead><tbody>{(board.sampleDispatches||[]).map((d:any)=><tr key={d.id} className="border-t"><td className="p-3">{date(d.sentAt)}</td><td className="p-3"><b>{d.designSample?.code}</b><div className="text-xs text-neutral-500">{d.designSample?.name}</div></td><td className="p-3">{d.fabricColor?.name||"—"} {d.fabricColor?.code?`· ${d.fabricColor.code}`:""}</td><td className="p-3 font-medium">{d.recipientName}</td><td className="p-3">{d.sentByName||"—"}</td><td className="p-3">{date(d.dueDate)}</td><td className="p-3"><Badge tone={d.status==="APPROVED"?"green":d.status==="CANCELLED"?"red":"blue"}>{statusLabel(d.status,DISPATCH_STATUSES)}</Badge></td></tr>)}{!board.sampleDispatches?.length&&<tr><td colSpan={7} className="p-6 text-center text-neutral-400">Chưa gửi đi làm mẫu.</td></tr>}</tbody></table></div></div>
    <div><h3 className="font-semibold">Lịch sử sử dụng / mẫu đã sản xuất</h3><div className="mt-2 grid gap-3 md:grid-cols-2">{(board.designSamples||[]).map((s:any)=><Card key={s.id} className="p-4"><div className="flex justify-between gap-3"><div><b>{s.code} · {s.name}</b><div className="mt-1 text-xs text-neutral-500">{s.year} · {s.season||"—"} · {s.category||"—"}</div></div><Badge tone={s.producedProduct?"green":"gray"}>{s.producedProduct?"Đã liên kết SP":"Mẫu triển khai"}</Badge></div>{s.producedProduct&&<div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Sản phẩm: <b>{s.producedProduct.name}</b> · {s.producedProduct.slug}</div>}</Card>)}{!board.designSamples?.length&&<div className="text-sm text-neutral-400">Chưa có mẫu sử dụng bảng vải này.</div>}</div></div>
  </div></Modal>
}

function BoardForm({board,meta,canUpload,onClose,onSaved,onSupplierCreated}:{board:FabricBoard|null;meta:WorkspaceMeta;canUpload:boolean;onClose:()=>void;onSaved:()=>void;onSupplierCreated:(s:Supplier)=>void}){
  const [form,setForm]=useState<any>({supplierId:board?.supplierId||"",boardCode:board?.boardCode||"",fabricCode:board?.fabricCode||"",name:board?.name||"",composition:board?.composition||"",expectedGsm:board?.expectedGsm||"",seasons:board?.seasons||[],productGroups:board?.productGroups||[],note:board?.note||"",coverImageUrl:board?.coverImageUrl||""});
  const [colors,setColors]=useState<BoardColor[]>(board?.colors?.length?board.colors.map(x=>({...x})):[{name:"",code:""}]);
  const [images,setImages]=useState<BoardImage[]>(board?.images?.map(x=>({...x}))||[]);
  const [error,setError]=useState("");const [saving,setSaving]=useState(false);const [newSupplier,setNewSupplier]=useState(false);const [supplierName,setSupplierName]=useState("");
  const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  const toggle=(k:"seasons"|"productGroups",v:string)=>patch(k,form[k].includes(v)?form[k].filter((x:string)=>x!==v):[...form[k],v]);
  async function addImage(file:File){const r=await uploadWorkspaceFile("/sample-fabric/library/upload", file);setImages(x=>[...x,{type:"BOARD",url:r.url}]);if(!form.coverImageUrl)patch("coverImageUrl",r.url)}
  async function save(){try{setSaving(true);setError("");await api(board?`/sample-fabric/library/${board.id}`:"/sample-fabric/library",{method:board?"PATCH":"POST",body:JSON.stringify({...form,boardCode:normalizeSampleCode(form.boardCode),fabricCode:normalizeSampleCode(form.fabricCode),composition:form.composition,colors:colors.filter(x=>x.name.trim()).map(x=>({...x,name:titleCaseVi(x.name),code:normalizeSampleCode(x.code)})),images})});onSaved()}catch(e){setError(e instanceof Error?e.message:"Không lưu được bảng vải.")}finally{setSaving(false)}}
  async function createSupplier(){if(!supplierName.trim())return;try{const s=await api<Supplier>("/sample-fabric/fabric-suppliers",{method:"POST",body:JSON.stringify({name:titleCaseVi(supplierName)})});onSupplierCreated(s);patch("supplierId",s.id);setNewSupplier(false);setSupplierName("")}catch(e){setError(e instanceof Error?e.message:"Không tạo được NCC vải.")}}
  return <Modal title={board?`Sửa bảng vải ${board.boardCode}`:"Thêm bảng vải"} onClose={onClose}><div className="space-y-5 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3"><Field label="Nhà cung cấp"><div className="flex gap-2"><select className={inputClass} value={form.supplierId} onChange={e=>patch("supplierId",e.target.value)}><option value="">Chưa chọn</option>{meta.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><button onClick={()=>setNewSupplier(!newSupplier)} className="shrink-0 rounded-xl border px-3 text-xs font-semibold">+ NCC</button></div></Field>
      <Field label="Mã bảng vải"><input className={inputClass} value={form.boardCode} onChange={e=>patch("boardCode",e.target.value)}/></Field><Field label="Mã chất vải"><input className={inputClass} value={form.fabricCode} onChange={e=>patch("fabricCode",e.target.value)}/></Field>
      <Field label="Tên / mô tả vải"><input className={inputClass} value={form.name} onChange={e=>patch("name",e.target.value)}/></Field><Field label="Thành phần"><input list="fabric-comps" className={inputClass} value={form.composition} onChange={e=>patch("composition",e.target.value)} placeholder="Cotton, Linen..."/><datalist id="fabric-comps">{meta.fabricCompositions.map(x=><option key={x} value={x}/>)}</datalist></Field><Field label="GSM NCC"><input type="number" className={inputClass} value={form.expectedGsm} onChange={e=>patch("expectedGsm",e.target.value)}/></Field>
    </div>{newSupplier&&<div className="flex gap-2 rounded-2xl bg-neutral-50 p-3"><input className={inputClass} value={supplierName} onChange={e=>setSupplierName(e.target.value)} placeholder="Tên NCC vải"/><button onClick={createSupplier} className="rounded-xl bg-neutral-900 px-4 text-sm text-white">Tạo</button></div>}
    <div className="grid gap-4 md:grid-cols-2"><div><div className="text-xs font-semibold uppercase text-neutral-500">Mùa có thể dùng</div><div className="mt-2 flex flex-wrap gap-2">{meta.seasons.map(x=><button key={x} onClick={()=>toggle("seasons",x)} className={`rounded-xl border px-3 py-2 text-sm ${form.seasons.includes(x)?"bg-neutral-900 text-white":"bg-white"}`}>{x}</button>)}</div></div>
      <div><div className="text-xs font-semibold uppercase text-neutral-500">Nhóm sản phẩm phù hợp</div><div className="mt-2 flex flex-wrap gap-2">{meta.productGroups.map(x=><button key={x} onClick={()=>toggle("productGroups",x)} className={`rounded-xl border px-3 py-2 text-sm ${form.productGroups.includes(x)?"bg-neutral-900 text-white":"bg-white"}`}>{x}</button>)}</div><input className={`${inputClass} mt-2`} placeholder="Gõ nhóm mới rồi Enter" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const v=titleCaseVi((e.target as HTMLInputElement).value);if(v&&!form.productGroups.includes(v))patch("productGroups",[...form.productGroups,v]);(e.target as HTMLInputElement).value=""}}}/></div></div>
    <div><div className="flex items-center justify-between"><b className="text-sm">Màu trong bảng</b><button onClick={()=>setColors(x=>[...x,{name:"",code:""}])} className="rounded-xl border px-3 py-1.5 text-xs font-semibold">+ Thêm màu</button></div><div className="mt-2 space-y-2">{colors.map((c,i)=><div key={i} className="grid gap-2 rounded-2xl bg-neutral-50 p-3 md:grid-cols-[1fr_1fr_auto]"><input className={inputClass} value={c.name} onChange={e=>setColors(x=>x.map((y,j)=>j===i?{...y,name:e.target.value}:y))} placeholder="Tên màu"/><input className={inputClass} value={c.code||""} onChange={e=>setColors(x=>x.map((y,j)=>j===i?{...y,code:e.target.value}:y))} placeholder="Mã màu"/><button onClick={()=>setColors(x=>x.filter((_,j)=>j!==i))} className="px-3 text-xs text-red-600">Xoá</button></div>)}</div></div>
    <div><div className="flex items-center justify-between"><b className="text-sm">Ảnh bảng vải / ảnh miếng vải</b>{canUpload&&<label className="cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold">Tải ảnh từ máy<input type="file" accept="image/*" multiple className="hidden" onChange={e=>Array.from(e.target.files||[]).forEach(f=>void addImage(f))}/></label>}</div><div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6">{images.map((im,i)=><div key={`${im.url}-${i}`} className="relative"><img src={assetUrl(im.url)} className="aspect-square w-full rounded-xl object-cover"/><button onClick={()=>setImages(x=>x.filter((_,j)=>j!==i))} className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-xs text-white">×</button></div>)}</div></div>
    <Field label="Ghi chú"><textarea className={`${inputClass} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field>
    <div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Đóng</button><button disabled={saving} onClick={save} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white">{saving?"Đang lưu...":"Lưu bảng vải"}</button></div>
  </div></Modal>
}

function DispatchForm({board,sample,meta,onClose,onSaved}:{board:FabricBoard;sample:Sample|null;meta:WorkspaceMeta;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState<any>({designSampleId:sample?.id||"",sampleName:sample?.name||"",sampleCode:sample?.code||"",year:sample?.year||new Date().getFullYear(),season:sample?.season||"",category:sample?.category||board.productGroups?.[0]||"",fabricBoardId:board.id,fabricColorId:sample?.fabricColorId||"",recipientName:"",recipientType:"Xưởng",recipientContact:"",sentAt:new Date().toISOString().slice(0,10),sentById:"",sentByName:"",dueDate:"",status:"SENT",note:""});
  const [error,setError]=useState("");const [saving,setSaving]=useState(false);const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  async function save(){try{setSaving(true);setError("");const st=meta.staff.find(x=>x.id===form.sentById);await api("/sample-fabric/sample-dispatches",{method:"POST",body:JSON.stringify({...form,sampleCode:normalizeSampleCode(form.sampleCode),category:titleCaseVi(form.category),sentByName:st?.name||form.sentByName||null})});onSaved()}catch(e){setError(e instanceof Error?e.message:"Không tạo được lần gửi mẫu.")}finally{setSaving(false)}}
  return <Modal title={`Gửi làm mẫu · ${board.boardCode}`} onClose={onClose} wide={false}><div className="space-y-4 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="rounded-2xl bg-neutral-50 p-3 text-sm"><b>{board.supplier?.name} · {board.boardCode}</b><div>{board.fabricCode||"—"} · {board.composition||"—"}</div></div><div className="grid gap-4 md:grid-cols-2">
    {!sample&&<><Field label="Tên mẫu"><input className={inputClass} value={form.sampleName} onChange={e=>patch("sampleName",e.target.value)}/></Field><Field label="Mã mẫu"><input className={inputClass} value={form.sampleCode} onChange={e=>patch("sampleCode",e.target.value)}/></Field></>}
    <Field label="Màu / mã màu"><select className={inputClass} value={form.fabricColorId} onChange={e=>patch("fabricColorId",e.target.value)}><option value="">Chưa chọn</option>{board.colors.map(c=><option key={c.id} value={c.id}>{c.name}{c.code?` · ${c.code}`:""}</option>)}</select></Field><Field label="Công ty / xưởng nhận"><input className={inputClass} value={form.recipientName} onChange={e=>patch("recipientName",e.target.value)} placeholder="VD: Xưởng Minh Anh"/></Field>
    <Field label="Loại nơi nhận"><select className={inputClass} value={form.recipientType} onChange={e=>patch("recipientType",e.target.value)}><option>Xưởng</option><option>Công Ty</option><option>Thợ Mẫu</option><option>Khác</option></select></Field><Field label="Liên hệ nơi nhận"><input className={inputClass} value={form.recipientContact} onChange={e=>patch("recipientContact",e.target.value)}/></Field>
    <Field label="Ngày gửi mẫu đi"><input type="date" className={inputClass} value={form.sentAt} onChange={e=>patch("sentAt",e.target.value)}/></Field><Field label="Hạn trả mẫu"><input type="date" className={inputClass} value={form.dueDate} onChange={e=>patch("dueDate",e.target.value)}/></Field>
    <Field label="Ai gửi đi"><select className={inputClass} value={form.sentById} onChange={e=>patch("sentById",e.target.value)}><option value="">Tài khoản hiện tại</option>{meta.staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={e=>patch("status",e.target.value)}>{DISPATCH_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
    {!sample&&<><Field label="Mùa"><select className={inputClass} value={form.season} onChange={e=>patch("season",e.target.value)}><option value="">Chưa chọn</option>{meta.seasons.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Nhóm sản phẩm"><input list="dgroups" className={inputClass} value={form.category} onChange={e=>patch("category",e.target.value)}/><datalist id="dgroups">{meta.productGroups.map(x=><option key={x} value={x}/>)}</datalist></Field></>}
  </div><Field label="Ghi chú"><textarea className={`${inputClass} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-xl border px-4 py-2">Đóng</button><button disabled={saving} onClick={save} className="rounded-xl bg-neutral-950 px-4 py-2 font-semibold text-white">{saving?"Đang lưu...":"Ghi nhận gửi mẫu"}</button></div></div></Modal>
}

function SamplesView({ rows, can, onEdit, onChanged }: { rows: Sample[]; can: (k:string)=>boolean; onEdit:(x:Sample)=>void; onChanged:()=>Promise<void> }) {
  const stats = useMemo(()=>({ total: rows.length, active: rows.filter(x=>!["COMPLETED","ON_HOLD"].includes(x.status)).length, approved: rows.filter(x=>["APPROVED_FOR_PRODUCTION","IN_PRODUCTION","COMPLETED"].includes(x.status)).length, late: rows.filter(x=>x.dueDate && !["COMPLETED","ON_HOLD"].includes(x.status) && new Date(x.dueDate).getTime() < Date.now()).length }),[rows]);
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Tổng mẫu",stats.total],["Đang triển khai",stats.active],["Đã duyệt SX",stats.approved],["Chậm tiến độ",stats.late]].map(([l,v])=><Card key={l} className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{l}</div><div className="mt-2 text-2xl font-semibold">{v}</div></Card>)}</div>
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{rows.map(row=><Card key={row.id} className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">{row.coverImageUrl ? <img src={assetUrl(row.coverImageUrl)} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-2xl text-neutral-300">✦</div>}</div>
        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><div className="text-xs font-semibold text-neutral-400">{row.code} · {row.year}</div><div className="mt-1 text-lg font-semibold text-neutral-950">{row.name}</div></div><Badge status={row.status}>{statusLabel(row.status,SAMPLE_STATUSES)}</Badge></div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-600"><div>NCC: <b>{row.supplier?.name || "—"}</b></div><div>Bảng vải: <b>{row.fabricBoardCode || "—"}</b></div><div>Mã vải: <b>{row.fabricCode || "—"}</b></div><div>Thành phần: <b>{row.fabricComposition || "—"}</b></div><div>Phụ trách: <b>{row.assigneeName || "—"}</b></div></div>
        </div>
      </div>
      <div className="border-t border-neutral-100 px-4 py-3"><div className="flex flex-wrap gap-1.5">{row.colors.length ? row.colors.map(c=><span key={c.id || c.name} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">{c.name}{c.code ? ` · ${c.code}` : ""}</span>) : <span className="text-xs text-neutral-400">Chưa khai báo màu</span>}</div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-neutral-500">{row.nextAction ? <>Tiếp theo: <b className="text-neutral-800">{row.nextAction}</b></> : "Chưa ghi việc tiếp theo"}</div>
          <div className="flex shrink-0 items-center gap-2">
            {can("design_sample.edit") && <button onClick={()=>onEdit(row)} className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold">Mở / sửa</button>}
            {can("design_sample.delete") && <button onClick={async()=>{
              if (!window.confirm(`Xoá mẫu ${row.code} · ${row.name}? Hành động này không thể hoàn tác.`)) return;
              try {
                await api(`/sample-fabric/samples/${row.id}`, { method: "DELETE" });
                await onChanged();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Không xoá được mẫu.");
              }
            }} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Xoá</button>}
          </div>
        </div>
      </div>
    </Card>)}</div>
    {!rows.length && <Card className="p-12 text-center text-sm text-neutral-500">Chưa có mẫu nào.</Card>}
  </>;
}

function FabricView({ rows, can, onEdit, onMeasure, onChanged }: { rows: FabricReceipt[]; can:(k:string)=>boolean; onEdit:(x:FabricReceipt)=>void; onMeasure:(x:FabricReceipt)=>void; onChanged:()=>Promise<void> }) {
  const totals = useMemo(()=>({ m: rows.reduce((s,x)=>s+num(x.actualM),0), kg: rows.reduce((s,x)=>s+num(x.actualKg),0), mDiff: rows.reduce((s,x)=>s+(num(x.actualM)-num(x.supplierDeclaredM)),0), kgDiff: rows.reduce((s,x)=>s+(num(x.actualKg)-num(x.supplierDeclaredKg)),0) }),[rows]);
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Mét thực nhận",`${fmt(totals.m,3)} m`],["Kg thực nhận",`${fmt(totals.kg,3)} kg`],["Lệch mét",`${totals.mDiff>0?"+":""}${fmt(totals.mDiff,3)} m`],["Lệch kg",`${totals.kgDiff>0?"+":""}${fmt(totals.kgDiff,3)} kg`]].map(([l,v])=><Card key={l} className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{l}</div><div className="mt-2 text-xl font-semibold">{v}</div></Card>)}</div>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Phiếu / vải</th><th className="px-4 py-3">Mẫu</th><th className="px-4 py-3">NCC</th><th className="px-4 py-3">NCC báo</th><th className="px-4 py-3">Thực nhận</th><th className="px-4 py-3">Chênh lệch</th><th className="px-4 py-3">GSM</th><th className="px-4 py-3">Đơn giá</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-neutral-100">{rows.map(r=>{const dm=num(r.actualM)-num(r.supplierDeclaredM);const dkg=num(r.actualKg)-num(r.supplierDeclaredKg);return <tr key={r.id} className="align-top hover:bg-neutral-50/60"><td className="px-4 py-4"><b>{r.receiptCode}</b><div className="mt-1 text-xs text-neutral-500">{r.fabricName || r.fabricCode || "Vải"} · {r.colorName || r.colorCode || "—"}</div><div className="text-xs text-neutral-400">Lô: {r.lotCode || "—"} · {r.rollCount} cây</div></td><td className="px-4 py-4">{r.designSample ? <><b>{r.designSample.code}</b><div className="text-xs text-neutral-500">{r.designSample.name}</div></> : "—"}</td><td className="px-4 py-4">{r.supplier?.name || "—"}<div className="text-xs text-neutral-400">{r.branch?.name || ""}</div></td><td className="px-4 py-4">{fmt(r.supplierDeclaredM,3)} m<div className="text-xs text-neutral-500">{fmt(r.supplierDeclaredKg,3)} kg</div></td><td className="px-4 py-4 font-semibold">{fmt(r.actualM,3)} m<div className="text-xs font-normal text-neutral-500">{fmt(r.actualKg,3)} kg</div></td><td className={`px-4 py-4 font-semibold ${dm<0||dkg<0?"text-red-700":"text-emerald-700"}`}>{dm>0?"+":""}{fmt(dm,3)} m<div className="text-xs">{dkg>0?"+":""}{fmt(dkg,3)} kg</div>{r.varianceApproved && <div className="mt-1 text-[11px] text-blue-700">Đã duyệt lệch</div>}</td><td className="px-4 py-4">{r.measuredGsm ? <b>{fmt(r.measuredGsm,1)} GSM</b> : "—"}<div className="text-xs text-neutral-400">NCC: {r.expectedGsm ? `${fmt(r.expectedGsm,1)}` : "—"}</div></td><td className="px-4 py-4">{r.unitPrice ? money(r.unitPrice) : "—"}<div className="text-xs text-neutral-400">/{r.priceUnit === "KG" ? "kg" : r.priceUnit === "ROLL" ? "cây" : "m"}</div></td><td className="px-4 py-4"><Badge status={r.status}>{statusLabel(r.status,RECEIPT_STATUSES)}</Badge></td><td className="px-4 py-4"><div className="flex flex-col gap-1.5">{can("fabric_receipt.edit") && r.status !== "COMPLETED" && <button onClick={()=>onEdit(r)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold">Sửa phiếu</button>}{can("fabric_receipt.measure") && <button onClick={()=>onMeasure(r)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold">Cân mẫu GSM</button>}{can("fabric_receipt.approve_variance") && !r.varianceApproved && (Math.abs(dm)>0.001 || Math.abs(dkg)>0.001) && <button onClick={async()=>{await api(`/sample-fabric/fabric-receipts/${r.id}/approve-variance`,{method:"POST",body:"{}"});await onChanged()}} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Duyệt chênh lệch</button>}{can("fabric_receipt.complete") && r.status !== "COMPLETED" && <button onClick={async()=>{await api(`/sample-fabric/fabric-receipts/${r.id}/complete`,{method:"POST",body:"{}"});await onChanged()}} className="rounded-xl bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">Hoàn tất</button>}</div></td></tr>})}</tbody></table></div></Card>
    {!rows.length && <Card className="p-12 text-center text-sm text-neutral-500">Chưa có phiếu vải về.</Card>}
  </>;
}

function Modal({ title, children, onClose, wide=false }: { title:string; children:React.ReactNode; onClose:()=>void; wide?:boolean }) { return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 md:p-8"><div className={`my-auto w-full ${wide?"max-w-5xl":"max-w-2xl"} rounded-3xl bg-white shadow-2xl`}><div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} className="h-9 w-9 rounded-xl border border-neutral-200 text-neutral-500">×</button></div>{children}</div></div>; }

function SampleForm({
  sample,
  boards,
  suppliers,
  staff,
  seasons,
  productGroups,
  fabricCompositions,
  canUpload,
  onSupplierCreated,
  onClose,
  onSaved,
}: {
  sample: Sample | null;
  boards: FabricBoard[];
  suppliers: Supplier[];
  staff: Staff[];
  seasons: string[];
  productGroups: string[];
  fabricCompositions: string[];
  canUpload: boolean;
  onSupplierCreated: (supplier: Supplier) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({
    name: sample?.name || "",
    code: sample?.code || "",
    year: sample?.year || new Date().getFullYear(),
    season: sample?.season || "",
    category: sample?.category || "",
    fabricBoardId: sample?.fabricBoardId || "",
    fabricColorId: sample?.fabricColorId || "",
    supplierId: sample?.supplierId || "",
    fabricBoardCode: sample?.fabricBoardCode || "",
    fabricCode: sample?.fabricCode || "",
    fabricComposition: sample?.fabricComposition || "",
    status: sample?.status || "IDEA",
    assigneeStaffId: sample?.assigneeStaffId || "",
    assigneeName: sample?.assigneeName || "",
    nextAction: sample?.nextAction || "",
    dueDate: sample?.dueDate ? sample.dueDate.slice(0, 10) : "",
    note: sample?.note || "",
    technicalNote: sample?.technicalNote || "",
    coverImageUrl: sample?.coverImageUrl || "",
  });
  const [colors, setColors] = useState<SampleColor[]>(
    sample?.colors?.length ? sample.colors : [{ name: "", code: "", status: sample?.status || "IDEA" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [codeCheck, setCodeCheck] = useState<{ loading: boolean; available: boolean | null; message: string }>({
    loading: false,
    available: sample ? true : null,
    message: "",
  });
  const [compositionDraft, setCompositionDraft] = useState("");
  const [compositionParts, setCompositionParts] = useState<FabricCompositionPart[]>(() => parseCompositionParts(sample?.fabricComposition));
  const [showSupplierCreator, setShowSupplierCreator] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [customCategory, setCustomCategory] = useState(() => Boolean(sample?.category && !productGroups.includes(sample.category)));

  const patch = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const selectedComposition = useMemo(() => compositionParts.map((item) => item.name), [compositionParts]);
  const selectedBoard = useMemo(() => boards.find((item) => item.id === form.fabricBoardId) || null, [boards, form.fabricBoardId]);

  useEffect(() => {
    patch("fabricComposition", compositionText(compositionParts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositionParts]);

  useEffect(() => {
    const code = normalizeSampleCode(form.code);
    const originalCode = normalizeSampleCode(sample?.code || "");
    if (!code) {
      setCodeCheck({ loading: false, available: null, message: "" });
      return;
    }
    if (sample && code === originalCode) {
      setCodeCheck({ loading: false, available: true, message: "Mã hiện tại của mẫu." });
      return;
    }

    setCodeCheck((current) => ({ ...current, loading: true }));
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code });
        if (sample?.id) params.set("excludeId", sample.id);
        const result = await api<{ available: boolean; message: string }>(
          `/sample-fabric/samples/check-code?${params.toString()}`,
        );
        setCodeCheck({ loading: false, available: result.available, message: result.message || "" });
      } catch (e) {
        setCodeCheck({
          loading: false,
          available: false,
          message: e instanceof Error ? e.message : "Không kiểm tra được mã mẫu.",
        });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.code, sample?.id, sample?.code]);

  useEffect(() => {
    if (form.fabricBoardId || !form.fabricBoardCode || !boards.length) return;
    const matched = boards.find((board) => String(board.boardCode || "").toUpperCase() === String(form.fabricBoardCode || "").toUpperCase());
    if (matched) patch("fabricBoardId", matched.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards]);

  function toggleComposition(value: string) {
    const normalized = titleCaseVi(value);
    const existing = compositionParts.find((item) => item.name.toLocaleLowerCase("vi-VN") === normalized.toLocaleLowerCase("vi-VN"));
    setCompositionParts((current) => existing
      ? current.filter((item) => item.name.toLocaleLowerCase("vi-VN") !== normalized.toLocaleLowerCase("vi-VN"))
      : [...current, { name: normalized, percent: "" }]);
  }

  function addComposition() {
    const value = titleCaseVi(compositionDraft);
    if (!value) return;
    setCompositionParts((current) => {
      if (current.some((item) => item.name.toLocaleLowerCase("vi-VN") === value.toLocaleLowerCase("vi-VN"))) return current;
      return [...current, { name: value, percent: "" }];
    });
    setCompositionDraft("");
  }

  function updateCompositionPercent(name: string, percent: string) {
    const clean = percent.replace(/[^0-9.,]/g, "").replace(",", ".");
    const numeric = clean === "" ? "" : String(Math.min(100, Math.max(0, Number(clean) || 0)));
    setCompositionParts((current) => current.map((item) => item.name === name ? { ...item, percent: numeric } : item));
  }

  async function createSupplier() {
    const name = titleCaseVi(supplierName);
    if (!name) return;
    try {
      setCreatingSupplier(true);
      setError("");
      const supplier = await api<Supplier>("/sample-fabric/fabric-suppliers", {
        method: "POST",
        body: JSON.stringify({ name, phone: supplierPhone.trim() || null }),
      });
      onSupplierCreated(supplier);
      patch("supplierId", supplier.id);
      setSupplierName("");
      setSupplierPhone("");
      setShowSupplierCreator(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được nhà cung cấp vải.");
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const result = await api<{ url: string }>("/sample-fabric/samples/upload", { method: "POST", body: fd });
    patch("coverImageUrl", result.url);
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      const code = normalizeSampleCode(form.code);
      if (code && codeCheck.available !== true) {
        throw new Error(codeCheck.message || "Mã mẫu chưa được xác nhận là hợp lệ.");
      }
      const assigned = staff.find((item) => item.id === form.assigneeStaffId);
      const payload = {
        ...form,
        code,
        category: titleCaseVi(form.category),
        fabricComposition: compositionText(compositionParts),
        assigneeName: assigned?.name || form.assigneeName || null,
        colors: colors
          .filter((item) => item.name.trim())
          .map((item) => ({ ...item, name: titleCaseVi(item.name), status: item.status || form.status })),
        images: form.coverImageUrl ? [{ url: form.coverImageUrl, caption: "Ảnh đại diện" }] : [],
      };
      await api(sample ? `/sample-fabric/samples/${sample.id}` : "/sample-fabric/samples", {
        method: sample ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được mẫu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={sample ? `Sửa mẫu ${sample.code}` : "Tạo mẫu mới"} onClose={onClose} wide>
      <div className="space-y-5 p-5">
        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tên mẫu">
            <input className={inputClass} value={form.name} onChange={(e) => patch("name", e.target.value)} />
          </Field>

          <Field label="Mã mẫu">
            <div>
              <input
                className={`${inputClass} ${codeCheck.available === false ? "border-red-400" : codeCheck.available === true ? "border-emerald-400" : ""}`}
                value={form.code}
                placeholder="VD: QSK925"
                onChange={(e) => patch("code", normalizeSampleCode(e.target.value))}
              />
              {form.code ? (
                <p className={`mt-1.5 text-xs ${codeCheck.loading ? "text-neutral-400" : codeCheck.available ? "text-emerald-600" : "text-red-600"}`}>
                  {codeCheck.loading ? "Đang kiểm tra mã trong mẫu mã và danh sách sản phẩm..." : codeCheck.message}
                </p>
              ) : null}
            </div>
          </Field>

          <Field label="Năm">
            <input type="number" className={inputClass} value={form.year} onChange={(e) => patch("year", e.target.value)} />
          </Field>

          <Field label="Mùa / BST">
            <select className={inputClass} value={form.season} onChange={(e) => patch("season", e.target.value)}>
              <option value="">Chưa chọn</option>
              {seasons.map((season) => <option key={season} value={season}>{season}</option>)}
            </select>
          </Field>

          <Field label="Nhóm sản phẩm">
            <div className="space-y-2">
              <select
                className={inputClass}
                value={customCategory ? "__NEW__" : form.category}
                onChange={(e) => {
                  if (e.target.value === "__NEW__") { setCustomCategory(true); patch("category", ""); }
                  else { setCustomCategory(false); patch("category", e.target.value); }
                }}
              >
                <option value="">Chưa chọn</option>
                {uniqueTextValues([...productGroups, !customCategory ? form.category : ""]).map((group) => <option key={group} value={group}>{group}</option>)}
                <option value="__NEW__">+ Thêm nhóm mới</option>
              </select>
              {customCategory ? (
                <input className={inputClass} value={form.category} onChange={(e) => patch("category", e.target.value)} onBlur={() => patch("category", titleCaseVi(form.category))} placeholder="Nhập nhóm mới, VD: Áo Khoác" />
              ) : null}
              <p className="text-xs text-neutral-400">Danh sách lấy từ Danh mục/Danh sách sản phẩm hiện tại.</p>
            </div>
          </Field>

          <Field label="Mã bảng vải">
            <select
              className={inputClass}
              value={form.fabricBoardId}
              onChange={(e) => {
                const id = e.target.value;
                const board = boards.find((item) => item.id === id);
                patch("fabricBoardId", id);
                patch("fabricColorId", "");
                if (board) {
                  patch("supplierId", board.supplierId || "");
                  patch("fabricBoardCode", board.boardCode || "");
                  patch("fabricCode", board.fabricCode || "");
                  setCompositionParts(parseCompositionParts(board.composition));
                }
              }}
            >
              <option value="">Chưa gắn bảng vải</option>
              {boards.map((board) => <option key={board.id} value={board.id}>{board.boardCode} · {board.supplier?.name || "NCC"}{board.fabricCode ? ` · ${board.fabricCode}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Màu vải trong bảng">
            <select className={inputClass} value={form.fabricColorId} onChange={(e)=>patch("fabricColorId",e.target.value)} disabled={!selectedBoard}>
              <option value="">Chưa chọn màu</option>
              {selectedBoard?.colors?.map((color)=><option key={color.id || `${color.name}-${color.code}`} value={color.id || ""}>{color.name}{color.code ? ` · ${color.code}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Nhà cung cấp vải">
            <div className="space-y-2">
              <div className="flex gap-2">
                <select className={inputClass} value={form.supplierId} onChange={(e) => patch("supplierId", e.target.value)}>
                  <option value="">Chưa chọn</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowSupplierCreator((value) => !value)} className="shrink-0 rounded-2xl border border-neutral-300 px-3 text-xs font-semibold hover:bg-neutral-50">+ NCC vải</button>
              </div>
              {showSupplierCreator ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className={inputClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tên NCC vải" />
                    <input className={inputClass} value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="SĐT (không bắt buộc)" />
                  </div>
                  <button type="button" disabled={creatingSupplier || !supplierName.trim()} onClick={createSupplier} className="mt-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{creatingSupplier ? "Đang tạo..." : "Tạo NCC vải"}</button>
                </div>
              ) : null}
            </div>
          </Field>
          <Field label="Mã chất vải"><input className={inputClass} value={form.fabricCode} onChange={(e) => patch("fabricCode", normalizeSampleCode(e.target.value))} placeholder="VD: A2309-01" /></Field>
          <Field label="Tiến độ">
            <select className={inputClass} value={form.status} onChange={(e) => patch("status", e.target.value)}>
              {SAMPLE_STATUSES.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}
            </select>
          </Field>
          <Field label="Người phụ trách">
            <select className={inputClass} value={form.assigneeStaffId} onChange={(e) => patch("assigneeStaffId", e.target.value)}>
              <option value="">Chưa gán</option>
              {staff.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
            </select>
          </Field>
          <Field label="Việc tiếp theo">
            <input className={inputClass} value={form.nextAction} onChange={(e) => patch("nextAction", e.target.value)} />
          </Field>
          <Field label="Hạn dự kiến">
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => patch("dueDate", e.target.value)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <b className="text-sm">Thành phần chất vải</b>
              <p className="mt-1 text-xs text-neutral-400">Chọn nhiều thành phần hoặc tự thêm thành phần mới.</p>
            </div>
            <div className="flex gap-2">
              <input className={`${inputClass} sm:w-44`} value={compositionDraft} onChange={(e) => setCompositionDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComposition(); } }} placeholder="VD: Cotton" />
              <button type="button" onClick={addComposition} className="rounded-2xl border border-neutral-300 px-3 text-xs font-semibold">+ Thêm</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {fabricCompositions.map((composition) => {
              const active = selectedComposition.includes(composition);
              return (
                <button
                  type="button"
                  key={composition}
                  onClick={() => toggleComposition(composition)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600"}`}
                >
                  {composition}
                </button>
              );
            })}
          </div>
          {compositionParts.length ? (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tỷ lệ thành phần</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {compositionParts.map((part) => (
                  <div key={part.name} className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">{part.name}</span>
                    <div className="flex w-24 items-center rounded-xl border border-neutral-300 bg-white px-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={part.percent}
                        onChange={(e) => updateCompositionPercent(part.name, e.target.value)}
                        className="w-full bg-transparent py-1.5 text-right text-sm outline-none"
                        placeholder="0"
                      />
                      <span className="ml-1 text-sm text-neutral-500">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-neutral-500">Lưu thành: <b className="text-neutral-800">{compositionText(compositionParts)}</b></div>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <b className="text-sm">Màu triển khai</b>
            <button type="button" onClick={() => setColors((current) => [...current, { name: "", code: "", status: form.status }])} className="rounded-xl border px-3 py-1.5 text-xs font-semibold">+ Thêm màu</button>
          </div>
          <div className="space-y-2">
            {colors.map((color, index) => (
              <div key={index} className="grid gap-2 rounded-2xl bg-neutral-50 p-3 md:grid-cols-[1fr_0.8fr_1fr_auto]">
                <input className={inputClass} placeholder="Tên màu" value={color.name} onBlur={(e) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: titleCaseVi(e.target.value) } : item))} onChange={(e) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} />
                <input className={inputClass} placeholder="Mã màu" value={color.code || ""} onChange={(e) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, code: e.target.value } : item))} />
                <select className={inputClass} value={color.status || form.status} onChange={(e) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: e.target.value } : item))}>
                  {SAMPLE_STATUSES.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}
                </select>
                <button type="button" onClick={() => setColors((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl px-2 text-sm text-red-600">Xoá</button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Ghi chú mẫu">
            <textarea className={`${inputClass} min-h-28`} value={form.note} onChange={(e) => patch("note", e.target.value)} />
          </Field>
          <Field label="Ghi chú kỹ thuật">
            <textarea className={`${inputClass} min-h-28`} value={form.technicalNote} onChange={(e) => patch("technicalNote", e.target.value)} />
          </Field>
        </div>

        {canUpload ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <b className="text-sm">Ảnh mẫu / ảnh tham khảo</b>
                <p className="mt-1 text-xs text-neutral-400">Chọn ảnh từ máy để tải lên Cloudinary.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800">
                Tải ảnh từ máy
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
            {form.coverImageUrl ? <img src={assetUrl(form.coverImageUrl)} className="mt-3 h-40 rounded-2xl object-cover" alt="Ảnh mẫu" /> : <div className="mt-3 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-xs text-neutral-400">Chưa có ảnh mẫu.</div>}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button>
          <button
            type="button"
            disabled={saving || (!!form.code && (codeCheck.loading || codeCheck.available !== true))}
            onClick={save}
            className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Đang lưu..." : "Lưu mẫu"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptForm({ receipt, suppliers, branches, samples, canCostView, canCostEdit, onClose, onSaved }: { receipt:FabricReceipt|null; suppliers:Supplier[]; branches:Branch[]; samples:any[]; canCostView:boolean; canCostEdit:boolean; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState<any>({receiptCode:receipt?.receiptCode||"",designSampleId:receipt?.designSampleId||"",supplierId:receipt?.supplierId||"",branchId:receipt?.branchId||"",fabricBoardCode:receipt?.fabricBoardCode||"",fabricCode:receipt?.fabricCode||"",fabricName:receipt?.fabricName||"",colorName:receipt?.colorName||"",colorCode:receipt?.colorCode||"",lotCode:receipt?.lotCode||"",supplierDeclaredM:receipt?.supplierDeclaredM??"",supplierDeclaredKg:receipt?.supplierDeclaredKg??"",actualM:receipt?.actualM??"",actualKg:receipt?.actualKg??"",unitPrice:receipt?.unitPrice??"",priceUnit:receipt?.priceUnit||"METER",expectedGsm:receipt?.expectedGsm??"",status:receipt?.status||"RECEIVING",receivedAt:receipt?.receivedAt?receipt.receivedAt.slice(0,10):new Date().toISOString().slice(0,10),note:receipt?.note||""});
  const [rolls,setRolls]=useState<Roll[]>(receipt?.rolls?.length?receipt.rolls:[{rollCode:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",passed:true}]);
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  function chooseSample(id:string){patch("designSampleId",id);const s=samples.find(x=>x.id===id);if(s){if(!form.fabricBoardCode)patch("fabricBoardCode",s.fabricBoardCode||"");if(!form.fabricCode)patch("fabricCode",s.fabricCode||"");}}
  async function save(){try{setSaving(true);setError("");const saved=await api<FabricReceipt>(receipt?`/sample-fabric/fabric-receipts/${receipt.id}`:"/sample-fabric/fabric-receipts",{method:receipt?"PATCH":"POST",body:JSON.stringify({...form,unitPrice:undefined,priceUnit:undefined,rollCount:rolls.length,rolls})});if(canCostEdit && form.unitPrice!=="") await api(`/sample-fabric/fabric-receipts/${saved.id}/cost`,{method:"PATCH",body:JSON.stringify({unitPrice:form.unitPrice,priceUnit:form.priceUnit})});onSaved();}catch(e){setError(e instanceof Error?e.message:"Không lưu được phiếu.")}finally{setSaving(false)}}
  return <Modal title={receipt?`Sửa ${receipt.receiptCode}`:"Tạo phiếu vải về"} onClose={onClose} wide><div className="space-y-5 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="grid gap-4 md:grid-cols-3"><Field label="Mã phiếu"><input className={inputClass} disabled={!!receipt} value={form.receiptCode} onChange={e=>patch("receiptCode",e.target.value)} placeholder="Tự sinh nếu trống"/></Field><Field label="Mẫu sử dụng"><select className={inputClass} value={form.designSampleId} onChange={e=>chooseSample(e.target.value)}><option value="">Chưa gắn mẫu</option>{samples.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field><Field label="Nhà cung cấp"><select className={inputClass} value={form.supplierId} onChange={e=>patch("supplierId",e.target.value)}><option value="">Chưa chọn</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Kho nhận"><select className={inputClass} value={form.branchId} onChange={e=>patch("branchId",e.target.value)}><option value="">Không gắn chi nhánh</option>{branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Mã bảng vải"><input className={inputClass} value={form.fabricBoardCode} onChange={e=>patch("fabricBoardCode",e.target.value)}/></Field><Field label="Mã vải"><input className={inputClass} value={form.fabricCode} onChange={e=>patch("fabricCode",e.target.value)}/></Field><Field label="Tên vải"><input className={inputClass} value={form.fabricName} onChange={e=>patch("fabricName",e.target.value)}/></Field><Field label="Màu"><input className={inputClass} value={form.colorName} onChange={e=>patch("colorName",e.target.value)}/></Field><Field label="Mã màu"><input className={inputClass} value={form.colorCode} onChange={e=>patch("colorCode",e.target.value)}/></Field><Field label="Mã lô"><input className={inputClass} value={form.lotCode} onChange={e=>patch("lotCode",e.target.value)}/></Field><Field label="NCC báo (m)"><input type="number" step="0.001" className={inputClass} value={form.supplierDeclaredM} onChange={e=>patch("supplierDeclaredM",e.target.value)}/></Field><Field label="NCC báo (kg)"><input type="number" step="0.001" className={inputClass} value={form.supplierDeclaredKg} onChange={e=>patch("supplierDeclaredKg",e.target.value)}/></Field><Field label="Thực nhận (m)"><input type="number" step="0.001" className={inputClass} value={form.actualM} onChange={e=>patch("actualM",e.target.value)}/></Field><Field label="Thực nhận (kg)"><input type="number" step="0.001" className={inputClass} value={form.actualKg} onChange={e=>patch("actualKg",e.target.value)}/></Field><Field label="GSM NCC"><input type="number" step="0.1" className={inputClass} value={form.expectedGsm} onChange={e=>patch("expectedGsm",e.target.value)}/></Field>{canCostView&&<><Field label="Đơn giá"><input type="number" className={inputClass} value={form.unitPrice} onChange={e=>patch("unitPrice",e.target.value)}/></Field><Field label="Tính giá theo"><select className={inputClass} value={form.priceUnit} onChange={e=>patch("priceUnit",e.target.value)}><option value="METER">Mét</option><option value="KG">Kg</option><option value="ROLL">Cây</option></select></Field></>}<Field label="Ngày nhận"><input type="date" className={inputClass} value={form.receivedAt} onChange={e=>patch("receivedAt",e.target.value)}/></Field></div>
    <div><div className="mb-2 flex items-center justify-between"><b className="text-sm">Chi tiết từng cây vải</b><button onClick={()=>setRolls(x=>[...x,{rollCode:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",passed:true}])} className="rounded-xl border px-3 py-1.5 text-xs font-semibold">+ Thêm cây</button></div><div className="space-y-2">{rolls.map((r,i)=><div key={i} className="grid gap-2 rounded-2xl bg-neutral-50 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"><input className={inputClass} placeholder={`Cây ${i+1}`} value={r.rollCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,rollCode:e.target.value}:v))}/>{[["supplierDeclaredM","NCC m"],["supplierDeclaredKg","NCC kg"],["actualM","Thực m"],["actualKg","Thực kg"]].map(([k,p])=><input key={k} type="number" step="0.001" className={inputClass} placeholder={p} value={(r as any)[k]??""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,[k]:e.target.value}:v))}/>)}<button onClick={()=>setRolls(x=>x.filter((_,j)=>j!==i))} className="rounded-xl px-2 text-sm text-red-600">Xoá</button></div>)}</div></div>
    <Field label="Ghi chú"><textarea className={`${inputClass} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field><div className="rounded-2xl bg-neutral-50 p-4 text-sm"><b>Chênh lệch hiện tại:</b> {num(form.actualM)-num(form.supplierDeclaredM)>0?"+":""}{fmt(num(form.actualM)-num(form.supplierDeclaredM),3)} m · {num(form.actualKg)-num(form.supplierDeclaredKg)>0?"+":""}{fmt(num(form.actualKg)-num(form.supplierDeclaredKg),3)} kg</div><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button><button disabled={saving} onClick={save} className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu phiếu"}</button></div></div></Modal>;
}

function MeasurementForm({ receipt, canUpload, onClose, onSaved }: { receipt:FabricReceipt; canUpload:boolean; onClose:()=>void; onSaved:()=>void }) {
  const [area,setArea]=useState("100"); const [weight,setWeight]=useState(""); const [position,setPosition]=useState(""); const [imageUrl,setImageUrl]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const gsm = num(area)>0 && num(weight)>0 ? num(weight)*10000/num(area) : 0;
  async function upload(file:File){const fd=new FormData();fd.append("file",file);const r=await api<{url:string}>("/sample-fabric/fabric-receipts/upload",{method:"POST",body:fd});setImageUrl(r.url);}
  async function save(){try{setSaving(true);setError("");await api(`/sample-fabric/fabric-receipts/${receipt.id}/measurements`,{method:"POST",body:JSON.stringify({areaCm2:area,weightGrams:weight,positionLabel:position,imageUrl})});if(imageUrl)await api(`/sample-fabric/fabric-receipts/${receipt.id}/images`,{method:"POST",body:JSON.stringify({type:"SCALE",url:imageUrl,caption:`Cân mẫu ${weight}g`})});onSaved();}catch(e){setError(e instanceof Error?e.message:"Không lưu được phép đo.")}finally{setSaving(false)}}
  return <Modal title={`Cân mẫu GSM · ${receipt.receiptCode}`} onClose={onClose}><div className="space-y-4 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Diện tích mẫu (cm²)"><input type="number" className={inputClass} value={area} onChange={e=>setArea(e.target.value)}/></Field><Field label="Cân nặng (g)"><input type="number" step="0.0001" className={inputClass} value={weight} onChange={e=>setWeight(e.target.value)}/></Field><Field label="Vị trí lấy mẫu"><input className={inputClass} value={position} onChange={e=>setPosition(e.target.value)} placeholder="Đầu cây / giữa cây / cuối cây"/></Field><div className="rounded-2xl bg-neutral-950 p-4 text-white"><div className="text-xs uppercase tracking-wide text-neutral-400">GSM tự tính</div><div className="mt-1 text-2xl font-semibold">{gsm ? fmt(gsm,2) : "—"}</div></div></div>{canUpload&&<div className="rounded-2xl border border-dashed p-4"><b className="text-sm">Ảnh mẫu tròn / ảnh cân</b><input type="file" accept="image/*" className="mt-2 block text-xs" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>{imageUrl&&<img src={assetUrl(imageUrl)} className="mt-3 h-36 rounded-xl object-cover"/>}</div>}<div><b className="text-sm">Các lần đo trước</b><div className="mt-2 space-y-2">{receipt.measurements?.map(m=><div key={m.id} className="flex justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm"><span>{m.positionLabel||"Mẫu"} · {fmt(m.weightGrams,4)}g</span><b>{fmt(m.gsm,2)} GSM</b></div>)}{!receipt.measurements?.length&&<div className="text-sm text-neutral-400">Chưa có phép đo.</div>}</div></div><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button><button disabled={saving||!gsm} onClick={save} className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Lưu phép đo</button></div></div></Modal>;
}
