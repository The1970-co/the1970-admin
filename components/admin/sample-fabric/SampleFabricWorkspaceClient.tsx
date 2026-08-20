"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import { hasPermission, type AppRole } from "@/lib/authz";

type Section = "library" | "samples" | "fabric" | "measurements";
type Supplier = { id: string; code: string; name: string; phone?: string | null; email?: string | null; address?: string | null; note?: string | null };
type Branch = { id: string; name: string };
type Staff = { id: string; code: string; name: string; branchId?: string | null };
type Factory = { id: string; code: string; name: string; contactName?: string | null; phone?: string | null };

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
  id: string; designSampleId: string; fabricBoardId: string; fabricColorId?: string | null; colorName?: string | null; colorCode?: string | null; recipientName: string;
  recipientType?: string | null; recipientContact?: string | null; sentAt: string; sentById?: string | null;
  sentByName?: string | null; dueDate?: string | null; returnedAt?: string | null; status: string; note?: string | null;
  fabricColor?: BoardColor | null; fabricBoard?: FabricBoard | null;
};

type SampleColor = { id?: string; name: string; code?: string | null; status?: string; note?: string | null; imageUrl?: string | null };
type Sample = {
  id: string; code: string; name: string; year: number; season?: string | null; category?: string | null;
  fabricBoardId?: string | null; fabricColorId?: string | null; fabricColorName?: string | null; fabricColorCode?: string | null; sampleFactoryId?: string | null; sampleFactoryName?: string | null; fabricBoard?: FabricBoard | null; fabricColor?: BoardColor | null;
  sampleDispatches?: Dispatch[]; matchedProduct?: { id:string; name:string; slug:string; imageUrl?:string|null } | null; producedProduct?: { id:string; name:string; slug:string; imageUrl?:string|null } | null;
  supplierId?: string | null; supplier?: Supplier | null; fabricBoardCode?: string | null; fabricCode?: string | null; fabricComposition?: string | null;
  status: string; assigneeStaffId?: string | null; assigneeName?: string | null; nextAction?: string | null;
  dueDate?: string | null; coverImageUrl?: string | null; note?: string | null; technicalNote?: string | null;
  colors: SampleColor[]; images?: Array<{ id?: string; url: string; caption?: string | null }>;
  progressLogs?: Array<{ id: string; fromStatus?: string | null; toStatus: string; note?: string | null; actorName?: string | null; createdAt: string }>;
  _count?: { fabricReceipts: number };
};

type Roll = { id?: string; sortOrder?: number | null; fabricCode?: string | null; rollCode?: string | null; images?: Array<{id:string;url:string;caption?:string|null}>; imageUrl?: string | null; colorName?: string | null; colorCode?: string | null; supplierDeclaredM?: number | string | null; supplierDeclaredKg?: number | string | null; actualM?: number | string | null; actualKg?: number | string | null; unitPriceCny?: number|string|null; priceUnit?: "METER"|"KG"|"ROLL"|null; lineAmountCny?:number|null; lineAmountVnd?:number|null; defectNote?: string | null; passed?: boolean };
type FabricCostGroup={id?:string;fabricCode:string;chinaShippingCny?:number|string|null;vietnamShippingRateVndPerKg?:number|string|null;vietnamShippingVnd?:number|string|null;note?:string|null};
type ReceiptCostSummary={exchangeRateToVnd:number;goodsCny:number;goodsVnd:number;chinaShippingCny:number;chinaShippingVnd:number;vietnamShippingVnd:number;totalShippingVnd:number;grandTotalVnd:number};
type Measurement = { id: string; areaCm2: number; weightGrams: number; gsm: number; positionLabel?: string | null; imageUrl?: string | null; measuredByName?: string | null; createdAt: string };
type FabricReceipt = {
  id: string; receiptCode: string; designSampleId?: string | null; designSample?: Pick<Sample, "id"|"code"|"name"|"year"> | null;
  fabricBoardId?: string | null; fabricColorId?: string | null; fabricBoard?: FabricBoard | null; fabricColor?: BoardColor | null;
  supplierId?: string | null; supplier?: Supplier | null; branchId?: string | null; branch?: Branch | null;
  fabricBoardCode?: string | null; fabricCode?: string | null; fabricName?: string | null; colorName?: string | null; colorCode?: string | null; lotCode?: string | null;
  supplierDeclaredM?: number | null; supplierDeclaredKg?: number | null; actualM?: number | null; actualKg?: number | null; rollCount: number;
  unitPrice?: number | null; priceUnit: "METER"|"KG"|"ROLL"; priceCurrency?: "VND"|"CNY"|string|null; exchangeRateToVnd?: number|null; unitPriceVnd?: number|null; expectedGsm?: number | null; measuredGsm?: number | null;
  varianceApproved: boolean; status: string; receivedAt?: string | null; completedAt?: string | null; note?: string | null;
  receivedByStaffId?: string | null; receivedByName?: string | null;
  createdByName?: string | null; updatedAt: string; rolls: Roll[]; measurements: Measurement[];
  images: Array<{ id: string; type: string; url: string; caption?: string | null }>;
  fabricCosts?:FabricCostGroup[]; costSummary?:ReceiptCostSummary|null;
};

type MeasurementTemplate = { id:string; name:string; productType:"SHIRT"|"PANTS"|"CUSTOM"; unit:string; sizes:string[]; rows:Array<{id:string;name:string;nameEn?:string;unit:string;values:Record<string,string>}>; updatedAt:string };
const MEASUREMENT_LIBRARY_KEY="the1970.measurement-templates.v1";
const SHIRT_SIZES=["S","M","L","XL","XXL"];
const PANTS_SIZES=["29","30","31","32","33","34","36","38"];
function newMeasurementTemplate(kind:"SHIRT"|"PANTS"|"CUSTOM"="SHIRT"):MeasurementTemplate { return {id:`mt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:"",productType:kind,unit:"cm",sizes:kind==="PANTS"?[...PANTS_SIZES]:kind==="SHIRT"?[...SHIRT_SIZES]:[],rows:[],updatedAt:new Date().toISOString()}; }
function loadMeasurementTemplates():MeasurementTemplate[]{if(typeof window==="undefined")return[];try{return JSON.parse(localStorage.getItem(MEASUREMENT_LIBRARY_KEY)||"[]")}catch{return[]}}
function saveMeasurementTemplates(rows:MeasurementTemplate[]){if(typeof window!=="undefined")localStorage.setItem(MEASUREMENT_LIBRARY_KEY,JSON.stringify(rows))}
function measurementSnapshotKey(sampleCode:string){return `the1970.sample-measurement.${normalizeSampleCode(sampleCode)||"draft"}`}
function loadMeasurementSnapshot(sampleCode:string):MeasurementTemplate|null{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem(measurementSnapshotKey(sampleCode))||"null")}catch{return null}}
function saveMeasurementSnapshot(sampleCode:string,row:MeasurementTemplate|null){if(typeof window==="undefined")return;const k=measurementSnapshotKey(sampleCode);if(row)localStorage.setItem(k,JSON.stringify(row));else localStorage.removeItem(k)}
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
function rollCostQty(r:Roll){const u=r.priceUnit||"METER";if(u==="ROLL")return 1;if(u==="KG")return num(r.actualKg)||num(r.supplierDeclaredKg);return num(r.actualM)||num(r.supplierDeclaredM);}
function rollAmountCny(r:Roll){return rollCostQty(r)*num(r.unitPriceCny);}
function moneyInput(v:any){const raw=String(v??"").replace(/\D/g,"");return raw?new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(Number(raw)):"";}
function moneyRaw(v:string){return v.replace(/\D/g,"");}
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
function normalizeColorCode(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return `#${raw.replace(/^#+/, "")}`;
}
function normalizeColorCodes(value: string) {
  return Array.from(new Set(String(value || "").split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean).map(normalizeColorCode))).join(", ");
}
function colorCodeList(value: string) { return normalizeColorCodes(value).split(",").map(x=>x.trim()).filter(Boolean); }
function colorNameList(value: string) { return String(value || "").split(",").map(x=>x.trim()).filter(Boolean); }
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
  suppliers: Supplier[]; staff: Staff[]; seasons: string[]; productGroups: string[]; fabricCompositions: string[]; factories?: Factory[];
  boards?: FabricBoard[]; branches?: Branch[]; samples?: Array<Pick<Sample,"id"|"code"|"name"|"year"|"fabricBoardId"|"fabricColorId"|"fabricColorName"|"fabricColorCode">>;
};

function usePermissions() {
  const user = getCurrentUserFromStorage() as any;
  const role = String(user?.role || "").toLowerCase() as AppRole;
  const owner = role === "admin" || role === "owner";
  const keys = new Set<string>(getCurrentUserPermissions(user, user?.activeBranchId || user?.branchId));
  const can = (key: string) => owner || keys.has("*") || keys.has(key) || hasPermission(role, key as any);
  return { can, owner };
}

async function uploadWorkspaceFile(path: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<{ url: string }>(path, { method: "POST", body: fd });
}

export default function SampleFabricWorkspaceClient({ defaultSection }: { defaultSection: Section }) {
  const { can, owner } = usePermissions();
  const canViewLibrary = can("fabric_library.view");
  const canViewSamples = can("design_sample.view");
  const canViewFabric = can("fabric_receipt.view");
  const canViewMeasurements = canViewSamples;

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
  const [measurementTemplates,setMeasurementTemplates]=useState<MeasurementTemplate[]>([]);
  const [measurementEdit,setMeasurementEdit]=useState<MeasurementTemplate|null>(null);
  const [boardForm, setBoardForm] = useState<FabricBoard | null | undefined>(undefined);
  const [showSupplierSettings, setShowSupplierSettings] = useState(false);
  const [boardDetail, setBoardDetail] = useState<FabricBoard | null>(null);
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
      if (defaultSection === "measurements") { setMeasurementTemplates(loadMeasurementTemplates()); return; }
      if (defaultSection === "library") await loadLibrary();
      else if (defaultSection === "samples") await loadSamples();
      else await loadFabric();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }
  useEffect(() => { setMeasurementTemplates(loadMeasurementTemplates()); void reload(); }, [defaultSection, sampleStatus, receiptStatus]);

  const filteredSamples = useMemo(() => {
    const key=q.trim().toLowerCase(); if(!key) return samples;
    return samples.filter(x=>[x.code,x.name,x.category,x.fabricBoardCode,x.fabricCode,x.fabricComposition,x.fabricBoard?.boardCode,x.fabricBoard?.fabricCode,x.supplier?.name,x.assigneeName,...x.colors.map(c=>c.name)].some(v=>String(v||"").toLowerCase().includes(key)));
  },[samples,q]);
  const filteredReceipts = useMemo(() => {
    const key=q.trim().toLowerCase(); if(!key) return receipts;
    return receipts.filter(x=>[x.receiptCode,x.fabricName,x.fabricBoardCode,x.fabricCode,x.fabricBoard?.boardCode,x.colorName,x.colorCode,x.lotCode,x.supplier?.name,x.designSample?.code,x.designSample?.name].some(v=>String(v||"").toLowerCase().includes(key)));
  },[receipts,q]);

  if (defaultSection === "measurements" && !canViewMeasurements) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem thư viện bảng thông số.</div>;
  if (defaultSection === "library" && !canViewLibrary) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem thư viện bảng vải.</div>;
  if (defaultSection === "samples" && !canViewSamples) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem quản lý mẫu mã.</div>;
  if (defaultSection === "fabric" && !canViewFabric) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem vải về.</div>;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Sản xuất / nguyên liệu</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">Mẫu mã & Vải</h1><p className="mt-1 text-sm text-neutral-500">Bảng vải, lịch sử gửi làm mẫu, tiến độ mẫu và kiểm thực nhận vải.</p></div>
      <div className="flex flex-wrap gap-2">
        {canViewLibrary && <Link href="/fabric-library" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "library" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Bảng vải</Link>}
        {canViewMeasurements && <Link href="/measurement-library" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "measurements" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Bảng thông số</Link>}
        {canViewSamples && <Link href="/design-samples" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "samples" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Triển khai mẫu</Link>}
        {canViewFabric && <Link href="/fabric-receipts" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${defaultSection === "fabric" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Vải về</Link>}
      </div>
    </div>
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card className="p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center">
      <input className={`${inputClass} md:max-w-md`} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void reload()}} placeholder={defaultSection==="measurements"?"Tìm tên bảng thông số...":defaultSection==="library"?"Tìm NCC, mã bảng, mã vải, thành phần...":defaultSection==="samples"?"Tìm mã mẫu, tên mẫu, bảng vải, màu...":"Tìm phiếu, mã vải, màu, lô, NCC..."}/>
      {defaultSection === "samples" && <select className={`${inputClass} md:w-56`} value={sampleStatus} onChange={e=>setSampleStatus(e.target.value)}><option value="">Tất cả tiến độ</option>{SAMPLE_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>}
      {defaultSection === "fabric" && <select className={`${inputClass} md:w-56`} value={receiptStatus} onChange={e=>setReceiptStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{RECEIPT_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>}
      <div className="md:ml-auto flex gap-2">
        {q.trim() && <button onClick={()=>void reload()} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold">Tìm</button>}
        {defaultSection === "library" && owner && <button onClick={()=>setShowSupplierSettings(true)} className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800">NCC vải</button>}
        {defaultSection === "library" && can("fabric_library.create") && <button onClick={()=>setBoardForm(null)} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Thêm bảng vải</button>}
        {defaultSection === "measurements" && can("design_sample.create") && <button onClick={()=>setMeasurementEdit(newMeasurementTemplate("SHIRT"))} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Tạo bảng thông số</button>}
        {defaultSection === "samples" && can("design_sample.create") && <button onClick={()=>{setEditingSample(null);setShowSampleForm(true)}} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Tạo mẫu</button>}
        {defaultSection === "fabric" && can("fabric_receipt.create") && <button onClick={()=>{setEditingReceipt(null);setShowReceiptForm(true)}} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Nhận vải</button>}
      </div>
    </div></Card>

    {loading ? <Card className="p-10 text-center text-sm text-neutral-500">Đang tải dữ liệu...</Card> : defaultSection === "measurements" ? <MeasurementLibrary rows={measurementTemplates.filter(x=>!q.trim()||x.name.toLowerCase().includes(q.trim().toLowerCase()))} onEdit={setMeasurementEdit} onChanged={rows=>{setMeasurementTemplates(rows);saveMeasurementTemplates(rows)}}/> : defaultSection === "library" ?
      <LibraryView rows={boards} can={can} onEdit={x=>setBoardForm(x)} onDetail={async x=>{const full=await api<FabricBoard>(`/sample-fabric/library/${x.id}`);setBoardDetail(full)}} onChanged={reload}/> :
      defaultSection === "samples" ? <SamplesView rows={filteredSamples} can={can} onEdit={x=>{setEditingSample(x);setShowSampleForm(true)}} onDispatch={x=>setDispatchSample(x)} onChanged={reload}/> :
      <FabricView rows={filteredReceipts} can={can} onEdit={x=>{setEditingReceipt(x);setShowReceiptForm(true)}} onMeasure={setMeasureReceipt} onChanged={reload}/>}

    {showSupplierSettings && owner && <FabricSupplierSettings suppliers={workspaceMeta.suppliers || suppliers} onClose={()=>setShowSupplierSettings(false)} onChanged={async()=>{const rows=await api<Supplier[]>("/sample-fabric/fabric-suppliers");setSuppliers(rows);setWorkspaceMeta((m)=>({...m,suppliers:rows}));}} />}
    {boardForm !== undefined && <BoardForm board={boardForm} meta={workspaceMeta} canUpload={can("fabric_library.upload_images")} onSupplierCreated={supplier=>setWorkspaceMeta(m=>({...m,suppliers:[...m.suppliers.filter(x=>x.id!==supplier.id),supplier].sort((a,b)=>a.name.localeCompare(b.name,"vi"))}))} onClose={()=>setBoardForm(undefined)} onSaved={async()=>{setBoardForm(undefined);await reload()}}/>}
    {boardDetail && <BoardDetail board={boardDetail} can={can} onClose={()=>setBoardDetail(null)}/>}
    {dispatchSample && dispatchSample.fabricBoard && <DispatchForm board={dispatchSample.fabricBoard} sample={dispatchSample} meta={workspaceMeta} onClose={()=>setDispatchSample(null)} onSaved={async()=>{setDispatchSample(null);await reload()}}/>}
    {showSampleForm && <SampleForm sample={editingSample} measurementTemplates={measurementTemplates} boards={workspaceMeta.boards || []} staff={staff} seasons={seasons} productGroups={productGroups} canUpload={can("design_sample.upload_images")} canViewFabricLink={owner} factories={workspaceMeta.factories || []} onClose={()=>setShowSampleForm(false)} onSaved={async()=>{setShowSampleForm(false);await reload()}} />}
    {showReceiptForm && <ReceiptForm receipt={editingReceipt} suppliers={suppliers} branches={branches} staff={staff} samples={metaSamples} boards={workspaceMeta.boards || []} canFabricBoardLink={can("fabric_receipt.fabric_board_link")} canSupplierIdentity={can("fabric_receipt.supplier_identity.view")} canCostView={can("fabric_receipt.cost.view") || can("fabric_receipt.cost.edit")} canCostEdit={can("fabric_receipt.cost.edit")} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setShowReceiptForm(false)} onSaved={async()=>{setShowReceiptForm(false);await reload()}} />}
    {measurementEdit && <MeasurementEditor initial={measurementEdit} onClose={()=>setMeasurementEdit(null)} onSave={row=>{const next=[...measurementTemplates.filter(x=>x.id!==row.id),{...row,updatedAt:new Date().toISOString()}].sort((a,b)=>a.name.localeCompare(b.name,"vi"));saveMeasurementTemplates(next);setMeasurementTemplates(next);setMeasurementEdit(null)}}/>}
    {measureReceipt && <MeasurementForm receipt={measureReceipt} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setMeasureReceipt(null)} onSaved={async()=>{setMeasureReceipt(null);await reload()}} />}
  </div>;
}

function FabricSupplierSettings({ suppliers, onClose, onChanged }: { suppliers: Supplier[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const emptyForm = { id: "", code: "", name: "", phone: "", email: "", address: "", note: "" };
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const patch = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const editing = Boolean(form.id);

  function editSupplier(supplier: Supplier) {
    setError("");
    setForm({
      id: supplier.id,
      code: supplier.code || "",
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      note: supplier.note || "",
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setError("");
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      const payload = {
        code: String(form.code || "").trim().toUpperCase(),
        name: titleCaseVi(form.name),
        phone: String(form.phone || "").trim() || null,
        email: String(form.email || "").trim() || null,
        address: String(form.address || "").trim() || null,
        note: String(form.note || "").trim() || null,
      };
      if (!payload.name) throw new Error("Chưa nhập tên nhà cung cấp.");
      await api(editing ? `/sample-fabric/fabric-suppliers/${form.id}` : "/sample-fabric/fabric-suppliers", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      await onChanged();
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được nhà cung cấp vải.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSupplier(supplier: Supplier) {
    if (!window.confirm(`Ngừng sử dụng NCC ${supplier.code} · ${supplier.name}? Dữ liệu cũ vẫn được giữ lại.`)) return;
    try {
      setError("");
      await api(`/sample-fabric/fabric-suppliers/${supplier.id}`, { method: "DELETE" });
      if (form.id === supplier.id) resetForm();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể ngừng sử dụng nhà cung cấp.");
    }
  }

  return (
    <Modal title="Quản lý nhà cung cấp vải" onClose={onClose} wide>
      <div className="space-y-5 p-5">
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Tên thật chỉ dùng cho Admin/Owner. Nhân viên ở phần Vải về chỉ nhìn thấy mã NCC, ví dụ <b>001-Y</b>.
        </div>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="overflow-hidden rounded-2xl border border-neutral-200">
            <div className="grid grid-cols-[110px_1fr_110px] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <div>Mã NCC</div><div>Tên Admin</div><div></div>
            </div>
            <div className="max-h-[430px] divide-y divide-neutral-100 overflow-y-auto">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 px-4 py-3 text-sm">
                  <b>{supplier.code || "—"}</b>
                  <div className="min-w-0"><div className="truncate font-semibold">{supplier.name || "—"}</div>{supplier.phone && <div className="truncate text-xs text-neutral-400">{supplier.phone}</div>}</div>
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => editSupplier(supplier)} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Sửa</button>
                    <button type="button" onClick={() => void removeSupplier(supplier)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700">Ẩn</button>
                  </div>
                </div>
              ))}
              {!suppliers.length && <div className="p-8 text-center text-sm text-neutral-400">Chưa có nhà cung cấp vải.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="mb-4 flex items-center justify-between"><b>{editing ? "Sửa NCC vải" : "Thêm NCC vải"}</b>{editing && <button type="button" onClick={resetForm} className="text-xs font-semibold text-neutral-500">+ Tạo mới</button>}</div>
            <div className="space-y-3">
              <Field label="Tên hiển thị với Admin"><input className={inputClass} value={form.name} onChange={(e)=>patch("name",e.target.value)} placeholder="VD: Yunxiang" /></Field>
              <Field label="Mã NCC cho nhân viên"><input className={inputClass} value={form.code} onChange={(e)=>patch("code",e.target.value)} placeholder="Để trống sẽ tự sinh 001-Y" /></Field>
              <Field label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(e)=>patch("phone",e.target.value)} /></Field>
              <Field label="Email"><input className={inputClass} value={form.email} onChange={(e)=>patch("email",e.target.value)} /></Field>
              <Field label="Địa chỉ"><input className={inputClass} value={form.address} onChange={(e)=>patch("address",e.target.value)} /></Field>
              <Field label="Ghi chú"><textarea className={`${inputClass} min-h-20`} value={form.note} onChange={(e)=>patch("note",e.target.value)} /></Field>
            </div>
            <button type="button" disabled={saving} onClick={()=>void save()} className="mt-4 w-full rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo NCC"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function LibraryView({rows,can,onEdit,onDetail,onChanged}:{rows:FabricBoard[];can:(k:string)=>boolean;onEdit:(x:FabricBoard)=>void;onDetail:(x:FabricBoard)=>void;onChanged:()=>Promise<void>}){
  if(!rows.length)return <Card className="p-12 text-center text-sm text-neutral-500">Chưa có bảng vải.</Card>;
  return <div className="grid gap-4 xl:grid-cols-2">{rows.map(b=><Card key={b.id} className="overflow-hidden"><div className="flex gap-4 p-4">
    <button onClick={()=>onDetail(b)} className="h-32 w-28 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">{b.coverImageUrl?<img src={assetUrl(b.coverImageUrl)} className="h-full w-full object-cover"/>:<span className="text-2xl text-neutral-300">✦</span>}</button>
    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase text-neutral-400">{b.supplier?.name||"NCC"} · {b.boardCode}</div><h3 className="mt-1 text-lg font-semibold">{b.name||b.fabricCode||"Bảng vải"}</h3></div><Badge tone="blue">{b.fabricCode||"—"}</Badge></div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2"><div><span className="text-neutral-400">Thành phần:</span> {b.composition||"—"}</div><div><span className="text-neutral-400">GSM:</span> {b.expectedGsm?fmt(b.expectedGsm,1):"—"}</div></div>
      <div className="mt-3 flex flex-wrap gap-1.5">{b.seasons.map(x=><Badge key={x}>{x}</Badge>)}{b.productGroups.map(x=><Badge key={x} tone="green">{x}</Badge>)}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">{b.colors.slice(0,8).map(c=><span key={`${c.code}-${c.name}`} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs">{c.name}{c.code?` · ${c.code}`:""}</span>)}{b.colors.length>8&&<span className="text-xs text-neutral-400">+{b.colors.length-8}</span>}</div>
    </div>
  </div><div className="flex flex-wrap items-center gap-2 border-t px-4 py-3"><span className="mr-auto text-xs text-neutral-400">{b._count?.designSamples||0} mẫu · {b._count?.sampleDispatches||0} lần gửi · {b._count?.fabricReceipts||0} phiếu vải</span>
    
    <button onClick={()=>onDetail(b)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Lịch sử</button>
    {can("fabric_library.edit")&&<button onClick={()=>onEdit(b)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Sửa</button>}
    {can("fabric_library.delete")&&<button onClick={async()=>{if(!confirmDelete(`Xoá bảng vải ${b.boardCode}?`))return;await api(`/sample-fabric/library/${b.id}`,{method:"DELETE"});await onChanged()}} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Xoá</button>}
  </div></Card>)}</div>
}

function BoardDetail({board,can,onClose}:{board:any;can:(k:string)=>boolean;onClose:()=>void}){
  return <Modal title={`Bảng vải ${board.boardCode}`} onClose={onClose}><div className="space-y-6 p-5">
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div><h3 className="font-semibold">Ảnh bảng vải / miếng vải</h3><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{(board.images||[]).map((im:BoardImage)=><img key={im.id||im.url} src={assetUrl(im.url)} className="aspect-square w-full rounded-2xl object-cover"/>)}{!board.images?.length&&<div className="col-span-full rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-400">Chưa có ảnh.</div>}</div></div>
      <Card className="p-4"><div className="text-sm"><b>{board.supplier?.name}</b><div className="mt-2">Mã bảng: <b>{board.boardCode}</b></div><div>Mã vải: <b>{board.fabricCode||"—"}</b></div><div>Thành phần: {board.composition||"—"}</div><div>Mùa: {board.seasons?.join(", ")||"—"}</div><div>Nhóm SP: {board.productGroups?.join(", ")||"—"}</div></div></Card>
    </div>
    <div><h3 className="font-semibold">Lịch sử gửi làm mẫu</h3><div className="mt-2 overflow-x-auto rounded-2xl border"><table className="min-w-[950px] w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500"><tr><th className="p-3">Ngày gửi</th><th className="p-3">Mẫu</th><th className="p-3">Màu</th><th className="p-3">Công ty / xưởng</th><th className="p-3">Người gửi</th><th className="p-3">Hạn</th><th className="p-3">Tiến độ</th></tr></thead><tbody>{(board.sampleDispatches||[]).map((d:any)=><tr key={d.id} className="border-t"><td className="p-3">{date(d.sentAt)}</td><td className="p-3"><b>{d.designSample?.code}</b><div className="text-xs text-neutral-500">{d.designSample?.name}</div></td><td className="p-3">{d.colorName||d.fabricColor?.name||"—"} {d.colorCode||d.fabricColor?.code?`· ${d.colorCode||d.fabricColor?.code}`:""}</td><td className="p-3 font-medium">{d.recipientName}</td><td className="p-3">{d.sentByName||"—"}</td><td className="p-3">{date(d.dueDate)}</td><td className="p-3"><Badge tone={d.status==="APPROVED"?"green":d.status==="CANCELLED"?"red":"blue"}>{statusLabel(d.status,DISPATCH_STATUSES)}</Badge></td></tr>)}{!board.sampleDispatches?.length&&<tr><td colSpan={7} className="p-6 text-center text-neutral-400">Chưa gửi đi làm mẫu.</td></tr>}</tbody></table></div></div>
    <div><h3 className="font-semibold">Lịch sử sử dụng / mẫu đã sản xuất</h3><div className="mt-2 grid gap-3 md:grid-cols-2">{(board.designSamples||[]).map((s:any)=><Card key={s.id} className="p-4"><div className="flex justify-between gap-3"><div><b>{s.code} · {s.name}</b><div className="mt-1 text-xs text-neutral-500">{s.year} · {s.season||"—"} · {s.category||"—"}</div></div><Badge tone={s.producedProduct?"green":"gray"}>{s.producedProduct?"Đã liên kết SP":"Mẫu triển khai"}</Badge></div>{s.producedProduct&&<div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Sản phẩm: <b>{s.producedProduct.name}</b> · {s.producedProduct.slug}</div>}</Card>)}{!board.designSamples?.length&&<div className="text-sm text-neutral-400">Chưa có mẫu sử dụng bảng vải này.</div>}</div></div>
  </div></Modal>
}

function BoardForm({
  board,
  meta,
  canUpload,
  onClose,
  onSaved,
  onSupplierCreated,
}: {
  board: FabricBoard | null;
  meta: WorkspaceMeta;
  canUpload: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSupplierCreated: (supplier: Supplier) => void;
}) {
  const [form, setForm] = useState<any>({
    supplierId: board?.supplierId || "",
    boardCode: board?.boardCode || "",
    fabricCode: board?.fabricCode || "",
    name: board?.name || "",
    expectedGsm: board?.expectedGsm || "",
    seasons: board?.seasons || [],
    productGroups: board?.productGroups || [],
    note: board?.note || "",
    coverImageUrl: board?.coverImageUrl || "",
  });
  const [compositionParts, setCompositionParts] = useState<FabricCompositionPart[]>(() => parseCompositionParts(board?.composition));
  const [compositionDraft, setCompositionDraft] = useState("");
  const [colors, setColors] = useState<BoardColor[]>(board?.colors?.length ? board.colors.map((x) => ({ ...x })) : [{ name: "", code: "" }]);
  const [images, setImages] = useState<BoardImage[]>(board?.images?.map((x) => ({ ...x })) || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newSupplier, setNewSupplier] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const patch = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const toggle = (key: "seasons" | "productGroups", value: string) => patch(key, form[key].includes(value) ? form[key].filter((x: string) => x !== value) : [...form[key], value]);
  const selectedComposition = useMemo(() => compositionParts.map((item) => item.name), [compositionParts]);

  function toggleComposition(value: string) {
    const normalized = titleCaseVi(value);
    const exists = compositionParts.some((item) => item.name.toLocaleLowerCase("vi-VN") === normalized.toLocaleLowerCase("vi-VN"));
    setCompositionParts((current) => exists ? current.filter((item) => item.name.toLocaleLowerCase("vi-VN") !== normalized.toLocaleLowerCase("vi-VN")) : [...current, { name: normalized, percent: "" }]);
  }

  function addComposition() {
    const value = titleCaseVi(compositionDraft);
    if (!value) return;
    setCompositionParts((current) => current.some((item) => item.name.toLocaleLowerCase("vi-VN") === value.toLocaleLowerCase("vi-VN")) ? current : [...current, { name: value, percent: "" }]);
    setCompositionDraft("");
  }

  function updateCompositionPercent(name: string, value: string) {
    const clean = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    const numeric = clean === "" ? "" : String(Math.min(100, Math.max(0, Number(clean) || 0)));
    setCompositionParts((current) => current.map((item) => item.name === name ? { ...item, percent: numeric } : item));
  }

  async function addImage(file: File) {
    const result = await uploadWorkspaceFile("/sample-fabric/library/upload", file);
    setImages((current) => [...current, { type: "BOARD", url: result.url }]);
    if (!form.coverImageUrl) patch("coverImageUrl", result.url);
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      await api(board ? `/sample-fabric/library/${board.id}` : "/sample-fabric/library", {
        method: board ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          boardCode: normalizeSampleCode(form.boardCode),
          fabricCode: normalizeSampleCode(form.fabricCode),
          composition: compositionText(compositionParts),
          colors: colors.filter((item) => item.name.trim()).map((item) => ({ ...item, name: titleCaseVi(item.name), code: normalizeSampleCode(item.code) })),
          images,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được bảng vải.");
    } finally {
      setSaving(false);
    }
  }

  async function createSupplier() {
    if (!supplierName.trim()) return;
    try {
      const supplier = await api<Supplier>("/sample-fabric/fabric-suppliers", { method: "POST", body: JSON.stringify({ name: titleCaseVi(supplierName) }) });
      onSupplierCreated(supplier);
      patch("supplierId", supplier.id);
      setNewSupplier(false);
      setSupplierName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được NCC vải.");
    }
  }

  return (
    <Modal title={board ? `Sửa bảng vải ${board.boardCode}` : "Thêm bảng vải"} onClose={onClose} wide>
      <div className="space-y-5 p-5">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nhà cung cấp"><div className="flex gap-2"><select className={inputClass} value={form.supplierId} onChange={(e) => patch("supplierId", e.target.value)}><option value="">Chưa chọn</option>{meta.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><button type="button" onClick={() => setNewSupplier(!newSupplier)} className="shrink-0 rounded-xl border px-3 text-xs font-semibold">+ NCC</button></div></Field>
          <Field label="Mã bảng vải"><input className={inputClass} value={form.boardCode} onChange={(e) => patch("boardCode", e.target.value)} /></Field>
          <Field label="Mã chất vải"><input className={inputClass} value={form.fabricCode} onChange={(e) => patch("fabricCode", e.target.value)} /></Field>
          <Field label="Tên / mô tả vải"><input className={inputClass} value={form.name} onChange={(e) => patch("name", e.target.value)} /></Field>
          <Field label="GSM NCC"><input type="number" className={inputClass} value={form.expectedGsm} onChange={(e) => patch("expectedGsm", e.target.value)} /></Field>
        </div>
        {newSupplier && <div className="flex gap-2 rounded-2xl bg-neutral-50 p-3"><input className={inputClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tên NCC vải" /><button type="button" onClick={createSupplier} className="rounded-xl bg-neutral-900 px-4 text-sm text-white">Tạo</button></div>}

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><b className="text-sm">Thành phần chất vải</b><p className="mt-1 text-xs text-neutral-400">Khai báo thành phần tại bảng vải, ví dụ Cotton 97%, Spandex 3%.</p></div>
            <div className="flex gap-2"><input className={`${inputClass} sm:w-44`} value={compositionDraft} onChange={(e) => setCompositionDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComposition(); } }} placeholder="VD: Cotton" /><button type="button" onClick={addComposition} className="rounded-2xl border px-3 text-xs font-semibold">+ Thêm</button></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{meta.fabricCompositions.map((composition) => { const active = selectedComposition.includes(composition); return <button type="button" key={composition} onClick={() => toggleComposition(composition)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600"}`}>{composition}</button>; })}</div>
          {compositionParts.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{compositionParts.map((part) => <div key={part.name} className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{part.name}</span><div className="flex w-24 items-center rounded-xl border bg-white px-2"><input type="number" min="0" max="100" step="0.1" value={part.percent} onChange={(e) => updateCompositionPercent(part.name, e.target.value)} className="w-full bg-transparent py-1.5 text-right text-sm outline-none" placeholder="0" /><span className="ml-1 text-sm text-neutral-500">%</span></div></div>)}</div> : null}
          {compositionParts.length ? <div className="mt-3 text-xs text-neutral-500">Lưu thành: <b>{compositionText(compositionParts)}</b></div> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div><div className="text-xs font-semibold uppercase text-neutral-500">Mùa có thể dùng</div><div className="mt-2 flex flex-wrap gap-2">{meta.seasons.map((season) => <button type="button" key={season} onClick={() => toggle("seasons", season)} className={`rounded-xl border px-3 py-2 text-sm ${form.seasons.includes(season) ? "bg-neutral-900 text-white" : "bg-white"}`}>{season}</button>)}</div></div>
          <div>
            <div className="text-xs font-semibold uppercase text-neutral-500">Nhóm sản phẩm phù hợp</div>
            <details className="group relative mt-2">
              <summary className={`${inputClass} flex cursor-pointer list-none items-center justify-between gap-3`}>
                <span className={form.productGroups.length ? "text-neutral-900" : "text-neutral-400"}>
                  {form.productGroups.length ? `Đã chọn ${form.productGroups.length} nhóm` : "Chọn nhóm sản phẩm"}
                </span>
                <span className="text-xs text-neutral-400 transition group-open:rotate-180">▼</span>
              </summary>
              <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                {meta.productGroups.map((group) => {
                  const checked = form.productGroups.includes(group);
                  return (
                    <label key={group} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle("productGroups", group)}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      <span className={checked ? "font-semibold text-neutral-950" : "text-neutral-700"}>{group}</span>
                    </label>
                  );
                })}
                {!meta.productGroups.length && <div className="px-3 py-4 text-sm text-neutral-400">Chưa có nhóm sản phẩm.</div>}
              </div>
            </details>
            {form.productGroups.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.productGroups.slice(0, 4).map((group: string) => (
                  <span key={group} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                    {group}
                    <button type="button" onClick={() => toggle("productGroups", group)} className="text-neutral-400 hover:text-red-600">×</button>
                  </span>
                ))}
                {form.productGroups.length > 4 && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">+{form.productGroups.length - 4}</span>}
              </div>
            )}
            <input className={`${inputClass} mt-2`} placeholder="Gõ nhóm mới rồi Enter" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const value = titleCaseVi((e.target as HTMLInputElement).value); if (value && !form.productGroups.includes(value)) patch("productGroups", [...form.productGroups, value]); (e.target as HTMLInputElement).value = ""; } }} />
          </div>
        </div>

        <div><div className="flex items-center justify-between"><b className="text-sm">Màu trong bảng</b><button type="button" onClick={() => setColors((current) => [...current, { name: "", code: "" }])} className="rounded-xl border px-3 py-1.5 text-xs font-semibold">+ Thêm màu</button></div><div className="mt-2 space-y-2">{colors.map((color, index) => <div key={index} className="grid gap-2 rounded-2xl bg-neutral-50 p-3 md:grid-cols-[1fr_1fr_auto]"><input className={inputClass} value={color.name} onChange={(e) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} placeholder="Tên màu" /><input className={inputClass} value={color.code || ""} onChange={(e) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, code: normalizeColorCode(e.target.value) } : item))} placeholder="# Mã màu" /><button type="button" onClick={() => setColors((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="px-3 text-xs text-red-600">Xoá</button></div>)}</div></div>

        <div><div className="flex items-center justify-between"><b className="text-sm">Ảnh bảng vải / ảnh miếng vải</b>{canUpload && <label className="cursor-pointer rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">Tải ảnh từ máy<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => Array.from(e.target.files || []).forEach((file) => void addImage(file))} /></label>}</div><div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6">{images.map((image, index) => <div key={`${image.url}-${index}`} className="relative"><img src={assetUrl(image.url)} className="aspect-square w-full rounded-xl object-cover" /><button type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-xs text-white">×</button></div>)}</div></div>
        
    <Field label="Ghi chú"><textarea className={`${inputClass} min-h-24`} value={form.note} onChange={(e) => patch("note", e.target.value)} /></Field>
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Đóng</button><button type="button" disabled={saving} onClick={save} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Đang lưu..." : "Lưu bảng vải"}</button></div>
      </div>
    </Modal>
  );
}

function DispatchForm({board,sample,meta,onClose,onSaved}:{board:FabricBoard;sample:Sample|null;meta:WorkspaceMeta;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState<any>({designSampleId:sample?.id||"",sampleName:sample?.name||"",sampleCode:sample?.code||"",year:sample?.year||new Date().getFullYear(),season:sample?.season||"",category:sample?.category||board.productGroups?.[0]||"",fabricBoardId:board.id,fabricColorId:"",colorName:sample?.fabricColorName||"",colorCode:sample?.fabricColorCode||"",sampleFactoryId:sample?.sampleFactoryId||"",recipientName:sample?.sampleFactoryName||"",recipientType:"Xưởng",recipientContact:"",sentAt:new Date().toISOString().slice(0,10),sentById:"",sentByName:"",dueDate:"",status:"SENT",note:""});
  const [error,setError]=useState("");const [saving,setSaving]=useState(false);const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  async function save(){try{setSaving(true);setError("");const st=meta.staff.find(x=>x.id===form.sentById);await api("/sample-fabric/sample-dispatches",{method:"POST",body:JSON.stringify({...form,sampleCode:normalizeSampleCode(form.sampleCode),category:titleCaseVi(form.category),sentByName:st?.name||form.sentByName||null})});onSaved()}catch(e){setError(e instanceof Error?e.message:"Không tạo được lần gửi mẫu.")}finally{setSaving(false)}}
  return <Modal title={`Gửi làm mẫu · ${board.boardCode}`} onClose={onClose} wide={false}><div className="space-y-4 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="rounded-2xl bg-neutral-50 p-3 text-sm"><b>{board.supplier?.name} · {board.boardCode}</b><div>{board.fabricCode||"—"} · {board.composition||"—"}</div></div><div className="grid gap-4 md:grid-cols-2">
    {!sample&&<><Field label="Tên mẫu"><input className={inputClass} value={form.sampleName} onChange={e=>patch("sampleName",e.target.value)}/></Field><Field label="Mã mẫu"><input className={inputClass} value={form.sampleCode} onChange={e=>patch("sampleCode",e.target.value)}/></Field></>}
    <Field label="Màu"><input className={inputClass} value={form.colorName} onChange={e=>patch("colorName",e.target.value)} placeholder="VD: Trắng Kem"/></Field><Field label="Mã màu"><input className={inputClass} value={form.colorCode} onChange={e=>patch("colorCode",normalizeColorCode(e.target.value))} placeholder="#2"/></Field><Field label="Nhà may / xưởng nhận"><select className={inputClass} value={form.sampleFactoryId} onChange={e=>{const id=e.target.value;const factory=meta.factories?.find(x=>x.id===id);patch("sampleFactoryId",id);patch("recipientName",factory?.name||"");patch("recipientContact",factory?.phone||"")}}><option value="">Chưa chọn nhà may</option>{(meta.factories||[]).map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
    <Field label="Loại nơi nhận"><select className={inputClass} value={form.recipientType} onChange={e=>patch("recipientType",e.target.value)}><option>Xưởng</option><option>Công Ty</option><option>Thợ Mẫu</option><option>Khác</option></select></Field><Field label="Liên hệ nơi nhận"><input className={inputClass} value={form.recipientContact} onChange={e=>patch("recipientContact",e.target.value)}/></Field>
    <Field label="Ngày gửi mẫu đi"><input type="date" className={inputClass} value={form.sentAt} onChange={e=>patch("sentAt",e.target.value)}/></Field><Field label="Hạn trả mẫu"><input type="date" className={inputClass} value={form.dueDate} onChange={e=>patch("dueDate",e.target.value)}/></Field>
    <Field label="Ai gửi đi"><select className={inputClass} value={form.sentById} onChange={e=>patch("sentById",e.target.value)}><option value="">Tài khoản hiện tại</option>{meta.staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={e=>patch("status",e.target.value)}>{DISPATCH_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
    {!sample&&<><Field label="Mùa"><select className={inputClass} value={form.season} onChange={e=>patch("season",e.target.value)}><option value="">Chưa chọn</option>{meta.seasons.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Nhóm sản phẩm"><input list="dgroups" className={inputClass} value={form.category} onChange={e=>patch("category",e.target.value)}/><datalist id="dgroups">{meta.productGroups.map(x=><option key={x} value={x}/>)}</datalist></Field></>}
  </div><Field label="Ghi chú"><textarea className={`${inputClass} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-xl border px-4 py-2">Đóng</button><button disabled={saving} onClick={save} className="rounded-xl bg-neutral-950 px-4 py-2 font-semibold text-white">{saving?"Đang lưu...":"Ghi nhận gửi mẫu"}</button></div></div></Modal>
}

function SamplesView({ rows, can, onEdit, onDispatch, onChanged }: { rows: Sample[]; can: (k:string)=>boolean; onEdit:(x:Sample)=>void; onDispatch:(x:Sample)=>void; onChanged:()=>Promise<void> }) {
  const stats = useMemo(()=>({ total: rows.length, active: rows.filter(x=>!["COMPLETED","ON_HOLD"].includes(x.status)).length, approved: rows.filter(x=>["APPROVED_FOR_PRODUCTION","IN_PRODUCTION","COMPLETED"].includes(x.status)).length, late: rows.filter(x=>x.dueDate && !["COMPLETED","ON_HOLD"].includes(x.status) && new Date(x.dueDate).getTime() < Date.now()).length }),[rows]);
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Tổng mẫu",stats.total],["Đang triển khai",stats.active],["Đã duyệt SX",stats.approved],["Chậm tiến độ",stats.late]].map(([l,v])=><Card key={l} className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{l}</div><div className="mt-2 text-2xl font-semibold">{v}</div></Card>)}</div>
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{rows.map(row=>{const latest=row.sampleDispatches?.[0];return <Card key={row.id} className="overflow-hidden">
      <div className="flex gap-4 p-4"><div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">{row.coverImageUrl?<img src={assetUrl(row.coverImageUrl)} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-2xl text-neutral-300">✦</div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><div className="text-xs font-semibold text-neutral-400">{row.code} · {row.year}</div><div className="mt-1 text-lg font-semibold">{row.name}</div></div><Badge status={row.status}>{statusLabel(row.status,SAMPLE_STATUSES)}</Badge></div><div className="mt-3 grid gap-y-1 text-xs text-neutral-600">{can("fabric_library.view")&&<div>Bảng vải: <b>{row.fabricBoard?.boardCode||row.fabricBoardCode||"—"}</b>{row.fabricColor&&<> · <b>{row.fabricColor.name}{row.fabricColor.code?` · ${row.fabricColor.code}`:""}</b></>}</div>}<div>Nhóm: <b>{row.category||"—"}</b> · Phụ trách: <b>{row.assigneeName||"—"}</b></div></div></div></div>
      <div className="border-t border-neutral-100 px-4 py-3">{latest?<div className="rounded-2xl bg-neutral-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><b>Gửi gần nhất: {latest.recipientName}</b><Badge tone={latest.status==="APPROVED"?"green":latest.status==="REVISING"?"amber":"blue"}>{statusLabel(latest.status,DISPATCH_STATUSES)}</Badge></div><div className="mt-1 text-neutral-500">Ngày gửi {date(latest.sentAt)} · Hạn {date(latest.dueDate)} · Người gửi {latest.sentByName||"—"}</div></div>:<div className="text-xs text-neutral-400">Chưa ghi nhận lần gửi mẫu nào.</div>}
        <div className="mt-3 flex items-center justify-between gap-3"><div className="min-w-0 text-xs text-neutral-500">{row.nextAction?<>Tiếp theo: <b>{row.nextAction}</b></>:"Chưa ghi việc tiếp theo"}</div><div className="flex shrink-0 flex-wrap gap-2">{can("sample_dispatch.create")&&can("fabric_library.view")&&row.fabricBoard&&<button onClick={()=>onDispatch(row)} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">+ Gửi / gửi lại</button>}{can("design_sample.edit")&&<button onClick={()=>onEdit(row)} className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold">Mở / sửa</button>}{can("design_sample.delete")&&<button onClick={async()=>{if(!window.confirm(`Xoá mẫu ${row.code} · ${row.name}?`))return;try{await api(`/sample-fabric/samples/${row.id}`,{method:"DELETE"});await onChanged()}catch(e){window.alert(e instanceof Error?e.message:"Không xoá được mẫu.")}}} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Xoá</button>}</div></div>
      </div>
    </Card>})}</div>
    {!rows.length&&<Card className="p-12 text-center text-sm text-neutral-500">Chưa có mẫu nào.</Card>}
  </>;
}

function receiptRollTotal(r:FabricReceipt,key:"supplierDeclaredM"|"supplierDeclaredKg"|"actualM"|"actualKg"){
  const rows=Array.isArray(r.rolls)?r.rolls:[];
  const has=rows.some(x=>(x as any)[key]!==null&&(x as any)[key]!==undefined&&String((x as any)[key]).trim()!=="");
  return has?rows.reduce((sum,x)=>sum+num((x as any)[key]),0):num((r as any)[key]);
}
function FabricView({ rows, can, onEdit, onMeasure, onChanged }: { rows: FabricReceipt[]; can:(k:string)=>boolean; onEdit:(x:FabricReceipt)=>void; onMeasure:(x:FabricReceipt)=>void; onChanged:()=>Promise<void> }) {
  const totals = useMemo(()=>({ m: rows.reduce((s,x)=>s+receiptRollTotal(x,"actualM"),0), kg: rows.reduce((s,x)=>s+receiptRollTotal(x,"actualKg"),0), mDiff: rows.reduce((s,x)=>s+(receiptRollTotal(x,"actualM")-receiptRollTotal(x,"supplierDeclaredM")),0), kgDiff: rows.reduce((s,x)=>s+(receiptRollTotal(x,"actualKg")-receiptRollTotal(x,"supplierDeclaredKg")),0) }),[rows]);
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Mét thực nhận",`${fmt(totals.m,3)} m`],["Kg thực nhận",`${fmt(totals.kg,3)} kg`],["Lệch mét",`${totals.mDiff>0?"+":""}${fmt(totals.mDiff,3)} m`],["Lệch kg",`${totals.kgDiff>0?"+":""}${fmt(totals.kgDiff,3)} kg`]].map(([l,v])=><Card key={l} className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{l}</div><div className="mt-2 text-xl font-semibold">{v}</div></Card>)}</div>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Phiếu / vải</th><th className="px-4 py-3">Mẫu</th><th className="px-4 py-3">NCC</th><th className="px-4 py-3">NCC báo</th><th className="px-4 py-3">Thực nhận</th><th className="px-4 py-3">Chênh lệch</th><th className="px-4 py-3">GSM</th><th className="px-4 py-3">Giá nhập</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-neutral-100">{rows.map(r=>{const declaredM=receiptRollTotal(r,"supplierDeclaredM"),declaredKg=receiptRollTotal(r,"supplierDeclaredKg"),actualM=receiptRollTotal(r,"actualM"),actualKg=receiptRollTotal(r,"actualKg");const dm=actualM-declaredM;const dkg=actualKg-declaredKg;return <tr key={r.id} className="align-top hover:bg-neutral-50/60"><td className="px-4 py-4"><b>{r.receiptCode}</b><div className="mt-1 text-xs text-neutral-500">{r.fabricName || r.fabricCode || "Vải"} · {r.colorName || r.colorCode || "—"}</div><div className="text-xs text-neutral-400">Lô: {r.lotCode || "—"} · {r.rollCount} cây</div></td><td className="px-4 py-4">{r.designSample ? <><b>{r.designSample.code}</b><div className="text-xs text-neutral-500">{r.designSample.name}</div></> : "—"}</td><td className="px-4 py-4">{can("fabric_receipt.supplier_identity.view") ? (r.supplier ? `${r.supplier.code || "NCC"} · ${r.supplier.name || ""}`.trim() : "—") : (r.supplier?.code || "—")}<div className="text-xs text-neutral-400">{r.branch?.name || ""}</div></td><td className="px-4 py-4">{fmt(declaredM,3)} m<div className="text-xs text-neutral-500">{fmt(declaredKg,3)} kg</div></td><td className="px-4 py-4 font-semibold">{fmt(actualM,3)} m<div className="text-xs font-normal text-neutral-500">{fmt(actualKg,3)} kg</div></td><td className={`px-4 py-4 font-semibold ${dm<0||dkg<0?"text-red-700":"text-emerald-700"}`}>{dm>0?"+":""}{fmt(dm,3)} m<div className="text-xs">{dkg>0?"+":""}{fmt(dkg,3)} kg</div>{r.varianceApproved && <div className="mt-1 text-[11px] text-blue-700">Đã duyệt lệch</div>}</td><td className="px-4 py-4">{r.measuredGsm ? <b>{fmt(r.measuredGsm,1)} GSM</b> : "—"}<div className="text-xs text-neutral-400">NCC: {r.expectedGsm ? `${fmt(r.expectedGsm,1)}` : "—"}</div></td><td className="px-4 py-4">{can("fabric_receipt.cost.view") || can("fabric_receipt.cost.edit") ? <>{r.costSummary?.grandTotalVnd?<b>{money(r.costSummary.grandTotalVnd)}</b>:"—"}{r.costSummary?<><div className="text-xs text-neutral-400">Tiền vải {money(r.costSummary.goodsVnd)}</div><div className="text-xs text-neutral-400">Phí {money(r.costSummary.totalShippingVnd)}</div></>:null}</>:"—"}</td><td className="px-4 py-4"><Badge status={r.status}>{statusLabel(r.status,RECEIPT_STATUSES)}</Badge></td><td className="px-4 py-4"><div className="flex flex-col gap-1.5">{can("fabric_receipt.edit") && r.status !== "COMPLETED" && <button onClick={()=>onEdit(r)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold">Sửa phiếu</button>}{can("fabric_receipt.measure") && <button onClick={()=>onMeasure(r)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold">Cân mẫu GSM</button>}{can("fabric_receipt.approve_variance") && !r.varianceApproved && (Math.abs(dm)>0.001 || Math.abs(dkg)>0.001) && <button onClick={async()=>{await api(`/sample-fabric/fabric-receipts/${r.id}/approve-variance`,{method:"POST",body:"{}"});await onChanged()}} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Duyệt chênh lệch</button>}{can("fabric_receipt.complete") && r.status !== "COMPLETED" && <button onClick={async()=>{await api(`/sample-fabric/fabric-receipts/${r.id}/complete`,{method:"POST",body:"{}"});await onChanged()}} className="rounded-xl bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">Hoàn tất</button>}</div></td></tr>})}</tbody></table></div></Card>
    {!rows.length && <Card className="p-12 text-center text-sm text-neutral-500">Chưa có phiếu vải về.</Card>}
  </>;
}


function MeasurementGrid({value,onChange,editable=true}:{value:MeasurementTemplate;onChange?:(x:MeasurementTemplate)=>void;editable?:boolean}){const patch=(x:MeasurementTemplate)=>onChange?.(x);return <div className="overflow-x-auto rounded-2xl border"><table className="min-w-max border-collapse text-sm"><thead><tr className="bg-neutral-950 text-white"><th className="sticky left-0 z-10 min-w-56 bg-neutral-950 p-3 text-left">Thông số</th>{value.sizes.map((sz,i)=><th key={`${sz}-${i}`} className="min-w-24 border-l border-white/20 p-2">{editable?<input className="w-16 rounded bg-white/10 px-1 py-1 text-center text-white" value={sz} onChange={e=>patch({...value,sizes:value.sizes.map((x,j)=>j===i?e.target.value:x)})}/>:sz}</th>)}</tr></thead><tbody>{value.rows.map((r,ri)=><tr key={r.id} className="border-t"><td className="sticky left-0 z-10 bg-white p-2"><div className="flex gap-2">{editable?<input className="min-w-44 flex-1 rounded-xl border px-2 py-2" value={r.name} onChange={e=>patch({...value,rows:value.rows.map((x,j)=>j===ri?{...x,name:e.target.value}:x)})}/>:<b>{r.name}</b>}{editable&&<button className="text-red-600" onClick={()=>patch({...value,rows:value.rows.filter((_,j)=>j!==ri)})}>×</button>}</div></td>{value.sizes.map(sz=><td key={sz} className="border-l p-2">{editable?<input inputMode="decimal" className="w-20 rounded-xl border px-2 py-2 text-center" value={r.values[sz]||""} onChange={e=>patch({...value,rows:value.rows.map((x,j)=>j===ri?{...x,values:{...x.values,[sz]:e.target.value.replace(",",".")}}:x)})}/>:r.values[sz]||"—"}</td>)}</tr>)}</tbody></table></div>}
function MeasurementEditor({initial,onClose,onSave}:{initial:MeasurementTemplate;onClose:()=>void;onSave:(x:MeasurementTemplate)=>void}){const [f,setF]=useState<MeasurementTemplate>(JSON.parse(JSON.stringify(initial)));function kind(k:"SHIRT"|"PANTS"|"CUSTOM"){const sizes=k==="SHIRT"?[...SHIRT_SIZES]:k==="PANTS"?[...PANTS_SIZES]:f.sizes;setF({...f,productType:k,sizes,rows:f.rows.map(r=>({...r,values:Object.fromEntries(sizes.map(s=>[s,r.values[s]||""]))}))})}return <Modal title="Bảng thông số" onClose={onClose} wide><div className="space-y-4 p-5"><div className="grid gap-3 md:grid-cols-3"><Field label="Tên bảng"><input className={inputClass} value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="VD: Quần short kaki relaxed"/></Field><Field label="Loại"><select className={inputClass} value={f.productType} onChange={e=>kind(e.target.value as any)}><option value="SHIRT">Áo</option><option value="PANTS">Quần</option><option value="CUSTOM">Tuỳ chỉnh</option></select></Field><Field label="Đơn vị"><input className={inputClass} value={f.unit} onChange={e=>setF({...f,unit:e.target.value})}/></Field></div><div className="flex flex-wrap gap-2"><button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={()=>setF({...f,sizes:[...f.sizes,""]})}>+ Size</button><button className="rounded-xl border px-3 py-2 text-sm font-semibold" onClick={()=>setF({...f,rows:[...f.rows,{id:`mr-${Date.now()}`,name:"",unit:f.unit||"cm",values:Object.fromEntries(f.sizes.map(s=>[s,""]))}]})}>+ Dòng thông số</button></div><MeasurementGrid value={f} onChange={setF}/><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border px-4 py-2.5">Đóng</button><button disabled={!f.name.trim()} onClick={()=>onSave(f)} className="rounded-2xl bg-neutral-950 px-5 py-2.5 font-semibold text-white disabled:opacity-40">Lưu bảng</button></div></div></Modal>}
function MeasurementLibrary({rows,onEdit,onChanged}:{rows:MeasurementTemplate[];onEdit:(x:MeasurementTemplate)=>void;onChanged:(x:MeasurementTemplate[])=>void}){return <div className="grid gap-4 lg:grid-cols-2">{rows.map(x=><Card key={x.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase text-neutral-400">{x.productType==="PANTS"?"Quần":x.productType==="SHIRT"?"Áo":"Tuỳ chỉnh"} · {x.sizes.join(" / ")}</div><h3 className="mt-1 text-lg font-semibold">{x.name}</h3><div className="mt-1 text-sm text-neutral-500">{x.rows.length} thông số · {x.unit}</div></div><div className="flex gap-2"><button onClick={()=>onEdit(JSON.parse(JSON.stringify(x)))} className="rounded-xl border px-3 py-2 text-sm">Sửa</button><button onClick={()=>{if(confirm(`Xoá ${x.name}?`))onChanged(rows.filter(r=>r.id!==x.id))}} className="rounded-xl border px-3 py-2 text-sm text-red-600">Xoá</button></div></div></Card>)}{!rows.length&&<Card className="p-10 text-center text-sm text-neutral-500">Chưa có bảng thông số. Tạo bảng đầu tiên rồi dùng lại cho các mẫu sau.</Card>}</div>}
function SampleMeasurementBlock({value,templates,productCategory,onChange}:{value:MeasurementTemplate|null;templates:MeasurementTemplate[];productCategory:string;onChange:(x:MeasurementTemplate|null)=>void}){const [pick,setPick]=useState("");function choose(id:string){setPick(id);const t=templates.find(x=>x.id===id);if(t)onChange({...JSON.parse(JSON.stringify(t)),id:`snapshot-${Date.now()}`})}function fresh(){const pants=/quần|short/i.test(productCategory||"");onChange(newMeasurementTemplate(pants?"PANTS":"SHIRT"))}return <div className="space-y-3 rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>Bảng thông số</b><div className="text-xs text-neutral-500">Lấy từ thư viện hoặc tạo riêng cho mẫu. Bản gắn vào mẫu là snapshot độc lập.</div></div><div className="flex gap-2"><select className="rounded-xl border px-3 py-2 text-sm" value={pick} onChange={e=>choose(e.target.value)}><option value="">Chọn từ thư viện</option>{templates.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button onClick={fresh} className="rounded-xl border px-3 py-2 text-sm font-semibold">Tạo mới</button></div></div>{value&&<><div className="flex items-center gap-2"><input className="flex-1 rounded-xl border px-3 py-2 font-semibold" value={value.name} onChange={e=>onChange({...value,name:e.target.value})}/><button onClick={()=>onChange({...value,rows:[...value.rows,{id:`mr-${Date.now()}`,name:"",unit:value.unit||"cm",values:Object.fromEntries(value.sizes.map(s=>[s,""]))}]})} className="rounded-xl border px-3 py-2 text-sm">+ Thông số</button></div><MeasurementGrid value={value} onChange={onChange}/><button onClick={()=>onChange(null)} className="text-sm font-semibold text-red-600">Bỏ bảng khỏi mẫu</button></>}</div>}

function Modal({ title, children, onClose, wide=false }: { title:string; children:React.ReactNode; onClose:()=>void; wide?:boolean }) { return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 md:p-8"><div className={`my-auto w-full ${wide?"max-w-5xl":"max-w-2xl"} rounded-3xl bg-white shadow-2xl`}><div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} className="h-9 w-9 rounded-xl border border-neutral-200 text-neutral-500">×</button></div>{children}</div></div>; }

function SampleForm({ sample, measurementTemplates, boards, staff, seasons, productGroups, factories, canUpload, canViewFabricLink, onClose, onSaved }: { sample: Sample | null; measurementTemplates:MeasurementTemplate[]; boards: FabricBoard[]; staff: Staff[]; seasons: string[]; productGroups: string[]; factories: Factory[]; canUpload: boolean; canViewFabricLink: boolean; onClose: () => void; onSaved: () => void }) {
  const [form,setForm]=useState<any>({name:sample?.name||"",code:sample?.code||"",year:sample?.year||new Date().getFullYear(),season:sample?.season||"",category:sample?.category||"",fabricBoardId:sample?.fabricBoardId||"",fabricColorId:sample?.fabricColorId||"",fabricColorName:sample?.fabricColorName||sample?.fabricColor?.name||"",fabricColorCode:sample?.fabricColorCode||sample?.fabricColor?.code||"",sampleFactoryId:sample?.sampleFactoryId||"",sampleFactoryName:sample?.sampleFactoryName||"",status:sample?.status||"IDEA",assigneeStaffId:sample?.assigneeStaffId||"",assigneeName:sample?.assigneeName||"",nextAction:sample?.nextAction||"",dueDate:sample?.dueDate?sample.dueDate.slice(0,10):"",note:sample?.note||"",technicalNote:sample?.technicalNote||"",coverImageUrl:sample?.coverImageUrl||""});
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [codeCheck,setCodeCheck]=useState<{loading:boolean;available:boolean|null;message:string}>({loading:false,available:sample?true:null,message:""});
  const [customCategory,setCustomCategory]=useState(()=>Boolean(sample?.category&&!productGroups.includes(sample.category)));
  const [measurement,setMeasurement]=useState<MeasurementTemplate|null>(()=>loadMeasurementSnapshot(sample?.code||"draft"));
  const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  const selectedBoard=useMemo(()=>boards.find(x=>x.id===form.fabricBoardId)||null,[boards,form.fabricBoardId]);
  const selectedFabricColor=useMemo(()=>selectedBoard?.colors?.find(x=>x.id===form.fabricColorId)||null,[selectedBoard,form.fabricColorId]);
  useEffect(()=>{const code=normalizeSampleCode(form.code);const original=normalizeSampleCode(sample?.code||"");if(!code){setCodeCheck({loading:false,available:null,message:""});return}if(sample&&code===original){setCodeCheck({loading:false,available:true,message:"Mã hiện tại của mẫu."});return}setCodeCheck(x=>({...x,loading:true}));const timer=window.setTimeout(async()=>{try{const params=new URLSearchParams({code});if(sample?.id)params.set("excludeId",sample.id);const r=await api<{available:boolean;message:string}>(`/sample-fabric/samples/check-code?${params.toString()}`);setCodeCheck({loading:false,available:r.available,message:r.message||""})}catch(e){setCodeCheck({loading:false,available:false,message:e instanceof Error?e.message:"Không kiểm tra được mã mẫu."})}},350);return()=>window.clearTimeout(timer)},[form.code,sample?.id,sample?.code]);
  async function upload(file:File){const r=await uploadWorkspaceFile("/sample-fabric/samples/upload",file);patch("coverImageUrl",r.url)}
  async function save(){try{setSaving(true);setError("");const code=normalizeSampleCode(form.code);if(code&&codeCheck.available!==true)throw new Error(codeCheck.message||"Mã mẫu chưa được xác nhận là hợp lệ.");const assigned=staff.find(x=>x.id===form.assigneeStaffId);const factory=factories.find(x=>x.id===form.sampleFactoryId);await api(sample?`/sample-fabric/samples/${sample.id}`:"/sample-fabric/samples",{method:sample?"PATCH":"POST",body:JSON.stringify({name:form.name,code,year:form.year,season:form.season,category:titleCaseVi(form.category),fabricBoardId:form.fabricBoardId||null,fabricColorId:null,fabricColorName:form.fabricColorName||null,fabricColorCode:normalizeColorCode(form.fabricColorCode)||null,sampleFactoryId:form.sampleFactoryId||null,sampleFactoryName:factory?.name||form.sampleFactoryName||null,status:form.status,assigneeStaffId:form.assigneeStaffId||null,assigneeName:assigned?.name||form.assigneeName||null,nextAction:form.nextAction||null,dueDate:form.dueDate||null,note:form.note||null,technicalNote:form.technicalNote||null,coverImageUrl:form.coverImageUrl||null,images:form.coverImageUrl?[{url:form.coverImageUrl,caption:"Ảnh mẫu / ảnh tham khảo"}]:[]})});saveMeasurementSnapshot(code,measurement);onSaved()}catch(e){setError(e instanceof Error?e.message:"Không lưu được mẫu.")}finally{setSaving(false)}}
  return <Modal title={sample?`Sửa mẫu ${sample.code}`:"Tạo mẫu triển khai"} onClose={onClose} wide><div className="space-y-5 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">Trang này chỉ quản lý <b>mẫu gửi đi / tiến độ mẫu</b>. Thành phần, GSM, NCC, mã chất vải và danh sách màu được quản lý tại <Link href="/fabric-library" className="font-semibold underline">Bảng vải</Link>.</div><div className="grid gap-4 md:grid-cols-3">
    <Field label="Tên mẫu"><input className={inputClass} value={form.name} onChange={e=>patch("name",e.target.value)}/></Field><Field label="Mã mẫu"><div><input className={`${inputClass} ${codeCheck.available===false?"border-red-400":codeCheck.available===true?"border-emerald-400":""}`} value={form.code} onChange={e=>patch("code",normalizeSampleCode(e.target.value))} placeholder="VD: QSK925"/>{form.code&&<p className={`mt-1.5 text-xs ${codeCheck.loading?"text-neutral-400":codeCheck.available?"text-emerald-600":"text-red-600"}`}>{codeCheck.loading?"Đang kiểm tra mã...":codeCheck.message}</p>}</div></Field><Field label="Năm"><input type="number" className={inputClass} value={form.year} onChange={e=>patch("year",e.target.value)}/></Field>
    <Field label="Mùa / BST"><select className={inputClass} value={form.season} onChange={e=>patch("season",e.target.value)}><option value="">Chưa chọn</option>{seasons.map(x=><option key={x} value={x}>{x}</option>)}</select></Field><Field label="Nhóm sản phẩm"><div className="space-y-2"><select className={inputClass} value={customCategory?"__NEW__":form.category} onChange={e=>{if(e.target.value==="__NEW__"){setCustomCategory(true);patch("category","")}else{setCustomCategory(false);patch("category",e.target.value)}}}><option value="">Chưa chọn</option>{uniqueTextValues([...productGroups,!customCategory?form.category:""]).map(x=><option key={x} value={x}>{x}</option>)}<option value="__NEW__">+ Thêm nhóm mới</option></select>{customCategory&&<input className={inputClass} value={form.category} onChange={e=>patch("category",e.target.value)} onBlur={()=>patch("category",titleCaseVi(form.category))} placeholder="VD: Áo Khoác"/>}</div></Field>{canViewFabricLink && (<Field label="Bảng vải"><select className={inputClass} value={form.fabricBoardId} onChange={e=>{patch("fabricBoardId",e.target.value);patch("fabricColorId","")}}><option value="">Chưa chọn bảng vải</option>{boards.map(b=><option key={b.id} value={b.id}>{b.boardCode}{b.name?` · ${b.name}`:""}</option>)}</select></Field>)}
    {canViewFabricLink && (<><Field label="Màu vải"><input className={inputClass} value={form.fabricColorName} onChange={e=>patch("fabricColorName",e.target.value)} placeholder="VD: Trắng Kem" /></Field><Field label="Mã màu"><input className={inputClass} value={form.fabricColorCode} onChange={e=>patch("fabricColorCode",normalizeColorCode(e.target.value))} placeholder="#2" /></Field></>)}<Field label="Nhà may làm mẫu"><select className={inputClass} value={form.sampleFactoryId} onChange={e=>patch("sampleFactoryId",e.target.value)}><option value="">Chưa chọn nhà may</option>{factories.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field><Field label="Tiến độ"><select className={inputClass} value={form.status} onChange={e=>patch("status",e.target.value)}>{SAMPLE_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field><Field label="Người phụ trách"><select className={inputClass} value={form.assigneeStaffId} onChange={e=>patch("assigneeStaffId",e.target.value)}><option value="">Chưa gán</option>{staff.map(x=><option key={x.id} value={x.id}>{x.name} · {x.code}</option>)}</select></Field><Field label="Việc tiếp theo"><input className={inputClass} value={form.nextAction} onChange={e=>patch("nextAction",e.target.value)}/></Field><Field label="Hạn dự kiến"><input type="date" className={inputClass} value={form.dueDate} onChange={e=>patch("dueDate",e.target.value)}/></Field>
  </div>{canViewFabricLink && selectedBoard && <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Liên kết bảng vải</div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>Bảng: <b>{selectedBoard.boardCode}</b></span>{(form.fabricColorName||form.fabricColorCode)&&<span>Màu: <b>{form.fabricColorName||"—"}{form.fabricColorCode?` · ${normalizeColorCode(form.fabricColorCode)}`:""}</b></span>}<Link href="/fabric-library" className="font-semibold text-blue-700 hover:underline">Mở Bảng vải →</Link></div></div>}<div className="grid gap-4 md:grid-cols-2"><Field label="Ghi chú mẫu"><textarea className={`${inputClass} min-h-28`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field><SampleMeasurementBlock value={measurement} templates={measurementTemplates} productCategory={form.category} onChange={setMeasurement}/><Field label="Ghi chú kỹ thuật"><textarea className={`${inputClass} min-h-28`} value={form.technicalNote} onChange={e=>patch("technicalNote",e.target.value)}/></Field></div>{canUpload&&<div className="rounded-2xl border border-dashed border-neutral-300 p-4"><div className="flex items-center justify-between gap-3"><div><b className="text-sm">Ảnh mẫu / ảnh tham khảo</b><p className="mt-1 text-xs text-neutral-400">Ảnh của mẫu triển khai, không phải ảnh bảng vải.</p></div><label className="cursor-pointer rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Tải ảnh từ máy<input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&void upload(e.target.files[0])}/></label></div>{form.coverImageUrl?<img src={assetUrl(form.coverImageUrl)} className="mt-3 h-40 rounded-2xl object-cover"/>:<div className="mt-3 rounded-xl bg-neutral-50 p-6 text-center text-xs text-neutral-400">Chưa có ảnh mẫu.</div>}</div>}<div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button><button disabled={saving||!!form.code&&(codeCheck.loading||codeCheck.available!==true)} onClick={save} className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu mẫu"}</button></div></div></Modal>
}

function ReceiptForm({ receipt, suppliers, branches, staff, samples, boards, canFabricBoardLink, canSupplierIdentity, canCostView, canCostEdit, canUpload, onClose, onSaved }: { receipt:FabricReceipt|null; suppliers:Supplier[]; branches:Branch[]; staff:Staff[]; samples:any[]; boards:FabricBoard[]; canFabricBoardLink:boolean; canSupplierIdentity:boolean; canCostView:boolean; canCostEdit:boolean; canUpload:boolean; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState<any>({receiptCode:receipt?.receiptCode||"",designSampleId:receipt?.designSampleId||"",fabricBoardId:receipt?.fabricBoardId||"",supplierId:receipt?.supplierId||"",branchId:receipt?.branchId||"",fabricBoardCode:receipt?.fabricBoardCode||"",fabricCode:receipt?.fabricCode||"",fabricName:receipt?.fabricName||"",colorName:receipt?.colorName||"",colorCode:receipt?.colorCode||"",lotCode:receipt?.lotCode||"",supplierDeclaredM:receipt?.supplierDeclaredM??"",supplierDeclaredKg:receipt?.supplierDeclaredKg??"",actualM:receipt?.actualM??"",actualKg:receipt?.actualKg??"",unitPrice:receipt?.unitPrice??"",priceUnit:receipt?.priceUnit||"METER",priceCurrency:receipt?.priceCurrency||"VND",exchangeRateToVnd:receipt?.exchangeRateToVnd??"",expectedGsm:receipt?.expectedGsm??"",status:receipt?.status||"RECEIVING",receivedAt:receipt?.receivedAt?receipt.receivedAt.slice(0,10):new Date().toISOString().slice(0,10),receivedByStaffId:receipt?.receivedByStaffId||"",receivedByName:receipt?.receivedByName||"",note:receipt?.note||""});
  const [rolls,setRolls]=useState<Roll[]>(receipt?.rolls?.length?receipt.rolls.map((r,i)=>({...r,sortOrder:r.sortOrder??i+1,fabricCode:r.fabricCode||receipt.fabricCode||""})):[{sortOrder:1,fabricCode:receipt?.fabricCode||"",rollCode:"",colorName:"",colorCode:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",unitPriceCny:"",priceUnit:"METER",defectNote:"",passed:true}]);
  const [rollFiles,setRollFiles]=useState<Record<number,File[]>>({});
  const [manualRollColor,setManualRollColor]=useState<Record<number,boolean>>({});
  const [fabricCosts,setFabricCosts]=useState<FabricCostGroup[]>(receipt?.fabricCosts||[]);
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");const patch=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  useEffect(()=>{if(receipt)return;const params=new URLSearchParams();if(form.receivedAt)params.set("receivedAt",form.receivedAt);api<{code:string}>(`/sample-fabric/fabric-receipts/next-code?${params}`).then(r=>patch("receiptCode",r.code)).catch(()=>{})},[form.receivedAt,receipt?.id]);

  const selectedBoard=boards.find(b=>b.id===form.fabricBoardId)||boards.find(b=>b.boardCode===form.fabricBoardCode);
  const allowedCodes=colorCodeList(form.colorCode);
  const allowedNames=colorNameList(form.colorName);
  const allowedColors=allowedCodes.map((code,index)=>{const c=selectedBoard?.colors?.find(x=>normalizeColorCode(String(x.code||x.name))===code);return {code,name:c?.name||allowedNames[index]||""};});

  function chooseBoard(id:string){
    const b=boards.find(x=>x.id===id); patch("fabricBoardId",id||""); if(!b)return;
    patch("fabricBoardCode",b.boardCode||"");patch("fabricCode",b.fabricCode||"");patch("fabricName",b.name||"");
    if(b.supplierId)patch("supplierId",b.supplierId);if(b.expectedGsm!=null)patch("expectedGsm",b.expectedGsm);
  }
  function chooseSample(id:string){patch("designSampleId",id);const s=samples.find(x=>x.id===id);if(s&&canFabricBoardLink){const b=boards.find(x=>x.id===s.fabricBoardId||x.boardCode===s.fabricBoardCode|| (!!s.fabricCode&&x.fabricCode===s.fabricCode));if(b)chooseBoard(b.id);else{if(!form.fabricBoardCode)patch("fabricBoardCode",s.fabricBoardCode||"");if(!form.fabricCode)patch("fabricCode",s.fabricCode||"")}}}
  function toggleBoardColor(c:BoardColor){const code=normalizeColorCode(String(c.code||c.name));const current=colorCodeList(form.colorCode);const next=current.includes(code)?current.filter(x=>x!==code):[...current,code];const names=next.map(x=>selectedBoard?.colors?.find(y=>normalizeColorCode(String(y.code||y.name))===x)?.name||"").filter(Boolean);patch("colorCode",next.join(", "));patch("colorName",names.join(", "));}

  function addRoll(){setRolls(x=>[...x,{sortOrder:x.length+1,fabricCode:form.fabricCode||"",rollCode:"",colorName:allowedColors.length===1?allowedColors[0].name:"",colorCode:allowedColors.length===1?allowedColors[0].code:"",supplierDeclaredM:"",supplierDeclaredKg:"",actualM:"",actualKg:"",unitPriceCny:"",priceUnit:"METER",defectNote:"",passed:true}]);}
  const fabricCodes=Array.from(new Set(rolls.map(r=>String(r.fabricCode||"").trim().toUpperCase()).filter(Boolean)));
  function fabricCostFor(code:string){return fabricCosts.find(x=>x.fabricCode===code)||{fabricCode:code,chinaShippingCny:"",vietnamShippingRateVndPerKg:"",vietnamShippingVnd:"",note:""}}
  function patchFabricCost(code:string,key:keyof FabricCostGroup,value:any){setFabricCosts(current=>{const found=current.find(x=>x.fabricCode===code);return found?current.map(x=>x.fabricCode===code?{...x,[key]:value}:x):[...current,{fabricCode:code,[key]:value}]})}
  function codeCost(code:string){const rs=rolls.filter(r=>String(r.fabricCode||"").trim().toUpperCase()===code),c=fabricCostFor(code),rate=num(form.exchangeRateToVnd),rollCount=rs.length,totalKg=rs.reduce((sum,r)=>sum+(num(r.actualKg)||num(r.supplierDeclaredKg)),0),goodsCny=rs.reduce((sum,r)=>sum+rollAmountCny(r),0),goodsVnd=goodsCny*rate,chinaShippingCny=num(c.chinaShippingCny),chinaShippingVnd=chinaShippingCny*rate,vnRate=num(c.vietnamShippingRateVndPerKg),vietnamShippingVnd=vnRate>0?totalKg*vnRate:num(c.vietnamShippingVnd),totalShippingVnd=chinaShippingVnd+vietnamShippingVnd;return{rollCount,totalKg,goodsCny,goodsVnd,chinaShippingCny,chinaShippingVnd,vnRate,vietnamShippingVnd,totalShippingVnd,shippingPerRollVnd:rollCount?totalShippingVnd/rollCount:0,fabricPerRollVnd:rollCount?goodsVnd/rollCount:0,landedPerRollVnd:rollCount?(goodsVnd+totalShippingVnd)/rollCount:0}}
  const liveCostSummary=useMemo(()=>{const groups=fabricCodes.map(codeCost),goodsCny=groups.reduce((s,x)=>s+x.goodsCny,0),goodsVnd=groups.reduce((s,x)=>s+x.goodsVnd,0),chinaShippingCny=groups.reduce((s,x)=>s+x.chinaShippingCny,0),chinaShippingVnd=groups.reduce((s,x)=>s+x.chinaShippingVnd,0),vietnamShippingVnd=groups.reduce((s,x)=>s+x.vietnamShippingVnd,0),totalShippingVnd=chinaShippingVnd+vietnamShippingVnd;return{goodsCny,goodsVnd,chinaShippingCny,chinaShippingVnd,vietnamShippingVnd,totalShippingVnd,grandTotalVnd:goodsVnd+totalShippingVnd}},[rolls,fabricCosts,form.exchangeRateToVnd]);
  function sortRollsByFabricCode(){
    const combined=rolls.map((roll,index)=>({roll,index,files:rollFiles[index]||[],manual:manualRollColor[index]}));
    combined.sort((a,b)=>String(a.roll.fabricCode||"").localeCompare(String(b.roll.fabricCode||""),"vi",{numeric:true,sensitivity:"base"})||String(a.roll.colorCode||"").localeCompare(String(b.roll.colorCode||""),"vi",{numeric:true,sensitivity:"base"})||a.index-b.index);
    setRolls(combined.map((x,i)=>({...x.roll,sortOrder:i+1})));
    const nextFiles:Record<number,File[]>={},nextManual:Record<number,boolean>={};
    combined.forEach((x,i)=>{if(x.files.length)nextFiles[i]=x.files;if(x.manual)nextManual[i]=true});
    setRollFiles(nextFiles);setManualRollColor(nextManual);
  }
  async function save(){try{setSaving(true);setError("");const receiver=staff.find(x=>x.id===form.receivedByStaffId);const normalizedRolls=rolls.map((r,i)=>({...r,sortOrder:i+1,fabricCode:String(r.fabricCode||"").trim().toUpperCase()||null,colorCode:normalizeColorCode(String(r.colorCode||""))||null,unitPriceCny:canCostEdit?r.unitPriceCny:undefined,priceUnit:canCostEdit?(r.priceUnit||"METER"):undefined,defectNote:String(r.defectNote||"").trim()||null}));const normalizedFabricCosts=fabricCodes.map(code=>{const c=fabricCostFor(code),calc=codeCost(code);return{...c,fabricCode:code,chinaShippingCny:num(c.chinaShippingCny),vietnamShippingRateVndPerKg:num(c.vietnamShippingRateVndPerKg),vietnamShippingVnd:calc.vietnamShippingVnd}});const saved=await api<FabricReceipt>(receipt?`/sample-fabric/fabric-receipts/${receipt.id}`:"/sample-fabric/fabric-receipts",{method:receipt?"PATCH":"POST",body:JSON.stringify({...form,receivedByStaffId:form.receivedByStaffId||null,receivedByName:receiver?.name||form.receivedByName||null,colorCode:normalizeColorCodes(form.colorCode)||null,unitPrice:undefined,priceUnit:undefined,priceCurrency:undefined,exchangeRateToVnd:undefined,rollCount:normalizedRolls.length,rolls:normalizedRolls,fabricCosts:canCostEdit?normalizedFabricCosts:undefined})});if(canCostEdit&&form.exchangeRateToVnd!=="")await api(`/sample-fabric/fabric-receipts/${saved.id}/cost`,{method:"PATCH",body:JSON.stringify({unitPrice:null,priceUnit:"METER",priceCurrency:"CNY",exchangeRateToVnd:form.exchangeRateToVnd})});for(const [indexText,files] of Object.entries(rollFiles)){const index=Number(indexText);const serverRoll=saved.rolls?.[index];if(!serverRoll?.id)continue;for(const file of files){const uploaded=await uploadWorkspaceFile("/sample-fabric/fabric-receipts/upload",file);await api(`/sample-fabric/fabric-receipts/${saved.id}/images`,{method:"POST",body:JSON.stringify({rollId:serverRoll.id,type:"FABRIC",url:uploaded.url,caption:`Ảnh ${serverRoll.rollCode||`cây ${index+1}`}`})})}}onSaved();}catch(e){setError(e instanceof Error?e.message:"Không lưu được phiếu.")}finally{setSaving(false)}}
  const convertedVnd=form.priceCurrency==="CNY"&&num(form.unitPrice)>0&&num(form.exchangeRateToVnd)>0?num(form.unitPrice)*num(form.exchangeRateToVnd):0;

  return <Modal title={receipt?`Sửa ${receipt.receiptCode}`:"Tạo phiếu vải về"} onClose={onClose} wide><div className="space-y-5 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Mã phiếu"><input className={inputClass} readOnly value={form.receiptCode} placeholder="NV-001-ddmmyyyy"/></Field>
      <Field label="Mẫu sử dụng"><select className={inputClass} value={form.designSampleId} onChange={e=>chooseSample(e.target.value)}><option value="">Chưa gắn mẫu</option>{samples.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
      <Field label="Nhà cung cấp"><select className={inputClass} value={form.supplierId} onChange={e=>patch("supplierId",e.target.value)}><option value="">Chưa chọn</option>{suppliers.map(x=><option key={x.id} value={x.id}>{canSupplierIdentity?`${x.code||"NCC"} · ${x.name||""}`.trim():(x.code||"NCC")}</option>)}</select></Field>
      <Field label="Kho nhận"><select className={inputClass} value={form.branchId} onChange={e=>patch("branchId",e.target.value)}><option value="">Không gắn chi nhánh</option>{branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      {canFabricBoardLink&&<Field label="Bảng vải"><select className={inputClass} value={form.fabricBoardId||selectedBoard?.id||""} onChange={e=>chooseBoard(e.target.value)}><option value="">Chưa liên kết bảng vải</option>{boards.map(b=><option key={b.id} value={b.id}>{b.boardCode}{b.fabricCode?` · ${b.fabricCode}`:""}{b.name?` · ${b.name}`:""}</option>)}</select></Field>}
      <Field label="Mã bảng vải"><input className={inputClass} value={form.fabricBoardCode} onChange={e=>patch("fabricBoardCode",e.target.value)} placeholder="Có thể nhập tay"/></Field>
      <Field label="Mã vải"><input className={inputClass} value={form.fabricCode} onChange={e=>patch("fabricCode",e.target.value)} placeholder="Có thể nhập tay"/></Field>
      <Field label="Tên vải"><input className={inputClass} value={form.fabricName} onChange={e=>patch("fabricName",e.target.value)}/></Field>
      <Field label="Màu"><input className={inputClass} value={form.colorName} onChange={e=>patch("colorName",e.target.value)} placeholder="VD: Xanh rêu, Kem"/></Field>
      <Field label="Mã màu"><input className={inputClass} value={form.colorCode} onChange={e=>patch("colorCode",e.target.value)} onBlur={()=>patch("colorCode",normalizeColorCodes(form.colorCode))} placeholder="VD: 8, 9 → #8, #9"/>{!!allowedCodes.length&&<div className="mt-2 flex flex-wrap gap-1.5">{allowedCodes.map(c=><span key={c} className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold">{c}</span>)}</div>}</Field>
      <Field label="Mã lô"><input className={inputClass} value={form.lotCode} onChange={e=>patch("lotCode",e.target.value)}/></Field>
      <Field label="NCC báo (m)"><input type="number" step="0.001" className={inputClass} value={form.supplierDeclaredM} onChange={e=>patch("supplierDeclaredM",e.target.value)}/></Field>
      <Field label="NCC báo (kg)"><input type="number" step="0.001" className={inputClass} value={form.supplierDeclaredKg} onChange={e=>patch("supplierDeclaredKg",e.target.value)}/></Field>
      <Field label="Thực nhận (m)"><input type="number" step="0.001" className={inputClass} value={form.actualM} onChange={e=>patch("actualM",e.target.value)}/></Field>
      <Field label="Thực nhận (kg)"><input type="number" step="0.001" className={inputClass} value={form.actualKg} onChange={e=>patch("actualKg",e.target.value)}/></Field>
      <Field label="GSM NCC"><input type="number" step="0.1" className={inputClass} value={form.expectedGsm} onChange={e=>patch("expectedGsm",e.target.value)}/></Field>
      <Field label="Ngày nhận"><input type="date" className={inputClass} value={form.receivedAt} onChange={e=>patch("receivedAt",e.target.value)}/></Field>
      <Field label="Nhân viên nhận vải"><select className={inputClass} value={form.receivedByStaffId} onChange={e=>{const id=e.target.value;const st=staff.find(x=>x.id===id);patch("receivedByStaffId",id);patch("receivedByName",st?.name||"")}}><option value="">Chưa chọn nhân viên</option>{staff.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
    </div>

    {canFabricBoardLink&&!!selectedBoard?.colors?.length&&<div className="rounded-2xl border p-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Màu từ bảng vải · chọn nhiều</div><div className="mt-2 flex flex-wrap gap-2">{selectedBoard.colors.map(c=>{const code=normalizeColorCode(String(c.code||c.name));const active=allowedCodes.includes(code);return <button type="button" key={c.id||code} onClick={()=>toggleBoardColor(c)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${active?"bg-neutral-950 text-white":"bg-white"}`}>{c.name}{c.code?` ${normalizeColorCode(String(c.code))}`:""}</button>})}</div></div>}

    {canCostView&&<div className="rounded-3xl bg-amber-50 p-4"><div className="grid gap-4 md:grid-cols-3"><Field label="Tỷ giá lúc nhập"><div className="relative"><input disabled={!canCostEdit} inputMode="decimal" className={`${inputClass} pr-12 disabled:bg-neutral-100`} value={moneyInput(form.exchangeRateToVnd)} onChange={e=>patch("exchangeRateToVnd",moneyRaw(e.target.value))} placeholder="VD: 3.920"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">VND/CNY</span></div></Field><div className="rounded-2xl bg-white p-3 text-sm"><div className="text-[10px] font-semibold uppercase text-neutral-400">Tiền vải</div><div className="mt-1 text-lg font-semibold">{fmt(liveCostSummary.goodsCny,2)} CNY</div><div className="text-xs text-neutral-500">{money(liveCostSummary.goodsVnd)}</div></div><div className="rounded-2xl bg-white p-3 text-sm"><div className="text-[10px] font-semibold uppercase text-neutral-400">Tổng đơn</div><div className="mt-1 text-lg font-semibold">{money(liveCostSummary.grandTotalVnd)}</div><div className="text-xs text-neutral-500">Đã gồm vận chuyển</div></div></div></div>}

    <div><div className="mb-2 flex items-center justify-between gap-3"><div><b className="text-sm">Chi tiết từng cây vải</b><div className="text-xs text-neutral-400">Nhập theo thứ tự kiểm thực tế. Xong có thể nhóm lại theo mã vải.</div></div><div className="flex gap-2"><button type="button" onClick={sortRollsByFabricCode} className="rounded-xl border px-3 py-1.5 text-xs font-semibold">Sắp xếp theo mã vải</button><button type="button" onClick={addRoll} className="rounded-xl border px-3 py-1.5 text-xs font-semibold">+ Thêm cây</button></div></div><div className="space-y-3">{rolls.map((r,i)=><div key={r.id||i} className="rounded-2xl bg-neutral-50 p-3"><div className="mb-2 flex items-center justify-between"><b className="text-xs uppercase tracking-wide text-neutral-500">STT {i+1}</b><span className="text-[11px] text-neutral-400">{r.fabricCode?`Mã vải ${r.fabricCode}`:"Chưa có mã vải"}</span></div><div className="grid gap-2 md:grid-cols-5"><input className={inputClass} placeholder="Mã vải · VD ABC123" value={r.fabricCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,fabricCode:e.target.value.toUpperCase()}:v))}/><input className={inputClass} placeholder={`Mã cây ${i+1} (nếu có)`} value={r.rollCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,rollCode:e.target.value}:v))}/>{allowedColors.length>0&&!manualRollColor[i]?<><select className={inputClass} value={r.colorCode||""} onChange={e=>{const c=allowedColors.find(x=>x.code===e.target.value);setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:c?.code||"",colorName:c?.name||""}:v))}}><option value="">Chọn màu cây</option>{allowedColors.map(c=><option key={c.code} value={c.code}>{c.name?`${c.name} · `:""}{c.code}</option>)}</select><button type="button" className="rounded-2xl border bg-white px-3 text-xs font-semibold" onClick={()=>setManualRollColor(x=>({...x,[i]:true}))}>Nhập màu tay</button></>:<><input className={inputClass} placeholder="Màu" value={r.colorName||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorName:e.target.value}:v))}/><input className={inputClass} placeholder="# Mã màu" value={r.colorCode||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:e.target.value}:v))} onBlur={()=>setRolls(x=>x.map((v,j)=>j===i?{...v,colorCode:normalizeColorCode(String(v.colorCode||""))}:v))}/></>}</div><div className="mt-2 grid gap-2 md:grid-cols-4">{[["supplierDeclaredM","NCC m"],["supplierDeclaredKg","NCC kg"],["actualM","Thực m"],["actualKg","Thực kg"]].map(([k,p])=><input key={k} type="number" step="0.001" className={inputClass} placeholder={p} value={(r as any)[k]??""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,[k]:e.target.value}:v))}/>)}</div>{canCostView&&<div className="mt-2 grid gap-2 md:grid-cols-[1fr_150px_1fr]"><div className="relative"><input disabled={!canCostEdit} inputMode="numeric" className={`${inputClass} pr-12 disabled:bg-neutral-100`} placeholder="Giá cây / màu" value={moneyInput(r.unitPriceCny)} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,unitPriceCny:moneyRaw(e.target.value)}:v))}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">CNY</span></div><select disabled={!canCostEdit} className={`${inputClass} disabled:bg-neutral-100`} value={r.priceUnit||"METER"} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,priceUnit:e.target.value as any}:v))}><option value="METER">Giá / mét</option><option value="KG">Giá / kg</option><option value="ROLL">Giá / cây</option></select><div className="rounded-2xl border bg-white px-3 py-2 text-xs">{(()=>{const code=String(r.fabricCode||"").trim().toUpperCase(),cc=code?codeCost(code):null,fabricVnd=rollAmountCny(r)*num(form.exchangeRateToVnd),ship=cc?.shippingPerRollVnd||0;return <><div><span className="text-neutral-400">Tiền vải cây: </span><b>{fmt(rollAmountCny(r),0)} CNY</b>{num(form.exchangeRateToVnd)>0?<span className="ml-2 text-neutral-500">≈ {money(fabricVnd)}</span>:null}</div>{cc&&<><div className="mt-1"><span className="text-neutral-400">Ship phân bổ/cây: </span><b>{money(ship)}</b></div><div className="mt-1 text-emerald-700"><span>Giá nhập cây: </span><b>{money(fabricVnd+ship)}</b></div></>}</>})()}</div></div>}<div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]"><textarea className={`${inputClass} min-h-20`} placeholder="Ghi chú cây: lệch màu, đầu cây bẩn, thiếu mét..." value={r.defectNote||""} onChange={e=>setRolls(x=>x.map((v,j)=>j===i?{...v,defectNote:e.target.value}:v))}/><button onClick={()=>{setRolls(x=>x.filter((_,j)=>j!==i));setRollFiles(current=>{const next={...current};delete next[i];return next})}} className="rounded-xl px-3 text-sm text-red-600">Xoá cây</button></div>{canUpload&&<div className="mt-2 flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-xl border bg-white px-3 py-2 text-xs font-semibold">Tải nhiều ảnh cây<input type="file" accept="image/*" multiple className="hidden" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length)setRollFiles(current=>({...current,[i]:[...(current[i]||[]),...files]}))}}/></label><span className="text-xs text-neutral-500">{rollFiles[i]?.length?`Đã chọn thêm ${rollFiles[i].length} ảnh`:(r.images?.length?`${r.images.length} ảnh đã lưu`:"Chưa có ảnh")}</span>{r.images?.slice(0,4).map(img=><img key={img.id} src={assetUrl(img.url)} className="h-10 w-10 rounded-lg object-cover"/>)}</div>}</div>)}</div></div>
{canCostView&&fabricCodes.length>0&&<div className="space-y-3 rounded-3xl border p-4"><div><b className="text-sm">Phí theo mã vải</b><div className="text-xs text-neutral-400">Ship China nhập CNY. Ship Việt Nam nhập đơn giá VND/kg; hệ thống tự lấy tổng kg của đúng mã vải để tính.</div></div>{fabricCodes.map(code=>{const c=fabricCostFor(code),cc=codeCost(code);return <div key={code} className="rounded-2xl bg-neutral-50 p-3"><div className="grid gap-2 md:grid-cols-[120px_140px_1fr_1fr_1.3fr]"><div><b>{code}</b><div className="text-[11px] text-neutral-400">{cc.rollCount} cây · {fmt(cc.totalKg,3)} kg</div></div><div className="text-xs"><div className="text-neutral-400">Tiền vải/cây</div><b>{money(cc.fabricPerRollVnd)}</b></div><div className="relative"><input disabled={!canCostEdit} inputMode="numeric" className={`${inputClass} pr-12 disabled:bg-neutral-100`} value={moneyInput(c.chinaShippingCny)} onChange={e=>patchFabricCost(code,"chinaShippingCny",moneyRaw(e.target.value))} placeholder="Ship China"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">CNY</span></div><div className="relative"><input disabled={!canCostEdit} inputMode="numeric" className={`${inputClass} pr-16 disabled:bg-neutral-100`} value={moneyInput(c.vietnamShippingRateVndPerKg)} onChange={e=>patchFabricCost(code,"vietnamShippingRateVndPerKg",moneyRaw(e.target.value))} placeholder="VD 20.000"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">đ/kg</span></div><input disabled={!canCostEdit} className={`${inputClass} disabled:bg-neutral-100`} value={c.note||""} onChange={e=>patchFabricCost(code,"note",e.target.value)} placeholder="Ghi chú phí"/></div><div className="mt-2 grid gap-2 md:grid-cols-5"><div className="rounded-xl bg-white p-2 text-xs"><span className="text-neutral-400">Ship China</span><div><b>{fmt(cc.chinaShippingCny,0)} CNY</b></div><div className="text-neutral-400">{money(cc.chinaShippingVnd)}</div></div><div className="rounded-xl bg-white p-2 text-xs"><span className="text-neutral-400">Ship VN</span><div><b>{money(cc.vietnamShippingVnd)}</b></div><div className="text-neutral-400">{fmt(cc.totalKg,3)} kg × {money(cc.vnRate)}/kg</div></div><div className="rounded-xl bg-white p-2 text-xs"><span className="text-neutral-400">Ship/cây</span><div><b>{money(cc.shippingPerRollVnd)}</b></div></div><div className="rounded-xl bg-white p-2 text-xs"><span className="text-neutral-400">Tiền vải/cây</span><div><b>{money(cc.fabricPerRollVnd)}</b></div></div><div className="rounded-xl bg-neutral-950 p-2 text-xs text-white"><span className="text-neutral-400">Giá nhập bình quân/cây</span><div><b>{money(cc.landedPerRollVnd)}</b></div></div></div></div>})}<div className="grid gap-2 border-t pt-3 md:grid-cols-3"><div className="rounded-2xl bg-neutral-50 p-3 text-sm">Phí China <b>{fmt(liveCostSummary.chinaShippingCny,0)} CNY</b><div className="text-xs text-neutral-400">{money(liveCostSummary.chinaShippingVnd)}</div></div><div className="rounded-2xl bg-neutral-50 p-3 text-sm">Phí Việt Nam <b>{money(liveCostSummary.vietnamShippingVnd)}</b></div><div className="rounded-2xl bg-neutral-950 p-3 text-sm text-white">Tổng phí <b>{money(liveCostSummary.totalShippingVnd)}</b></div></div><div className="grid gap-2 md:grid-cols-2"><div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs font-semibold uppercase text-emerald-700">Tổng tiền vải</div><div className="mt-1 text-xl font-semibold">{money(liveCostSummary.goodsVnd)}</div><div className="text-xs text-emerald-700">{fmt(liveCostSummary.goodsCny,0)} CNY × {moneyInput(form.exchangeRateToVnd)}</div></div><div className="rounded-2xl bg-neutral-950 p-4 text-white"><div className="text-xs font-semibold uppercase text-neutral-400">Tổng đơn nhập vải</div><div className="mt-1 text-2xl font-semibold">{money(liveCostSummary.grandTotalVnd)}</div></div></div></div>}
        <Field label="Ghi chú"><textarea className={`${inputClass} min-h-24`} value={form.note} onChange={e=>patch("note",e.target.value)}/></Field><div className="rounded-2xl bg-neutral-50 p-4 text-sm"><b>Chênh lệch hiện tại:</b> {num(form.actualM)-num(form.supplierDeclaredM)>0?"+":""}{fmt(num(form.actualM)-num(form.supplierDeclaredM),3)} m · {num(form.actualKg)-num(form.supplierDeclaredKg)>0?"+":""}{fmt(num(form.actualKg)-num(form.supplierDeclaredKg),3)} kg</div><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button><button disabled={saving} onClick={save} className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu phiếu"}</button></div>
  </div></Modal>;
}

function MeasurementForm({ receipt, canUpload, onClose, onSaved }: { receipt:FabricReceipt; canUpload:boolean; onClose:()=>void; onSaved:()=>void }) {
  const [area,setArea]=useState("100"); const [weight,setWeight]=useState(""); const [position,setPosition]=useState(""); const [imageUrl,setImageUrl]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const gsm = num(area)>0 && num(weight)>0 ? num(weight)*10000/num(area) : 0;
  async function upload(file:File){const fd=new FormData();fd.append("file",file);const r=await api<{url:string}>("/sample-fabric/fabric-receipts/upload",{method:"POST",body:fd});setImageUrl(r.url);}
  async function save(){try{setSaving(true);setError("");await api(`/sample-fabric/fabric-receipts/${receipt.id}/measurements`,{method:"POST",body:JSON.stringify({areaCm2:area,weightGrams:weight,positionLabel:position,imageUrl})});if(imageUrl)await api(`/sample-fabric/fabric-receipts/${receipt.id}/images`,{method:"POST",body:JSON.stringify({type:"SCALE",url:imageUrl,caption:`Cân mẫu ${weight}g`})});onSaved();}catch(e){setError(e instanceof Error?e.message:"Không lưu được phép đo.")}finally{setSaving(false)}}
  return <Modal title={`Cân mẫu GSM · ${receipt.receiptCode}`} onClose={onClose}><div className="space-y-4 p-5">{error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Diện tích mẫu (cm²)"><input type="number" className={inputClass} value={area} onChange={e=>setArea(e.target.value)}/></Field><Field label="Cân nặng (g)"><input type="number" step="0.0001" className={inputClass} value={weight} onChange={e=>setWeight(e.target.value)}/></Field><Field label="Vị trí lấy mẫu"><input className={inputClass} value={position} onChange={e=>setPosition(e.target.value)} placeholder="Đầu cây / giữa cây / cuối cây"/></Field><div className="rounded-2xl bg-neutral-950 p-4 text-white"><div className="text-xs uppercase tracking-wide text-neutral-400">GSM tự tính</div><div className="mt-1 text-2xl font-semibold">{gsm ? fmt(gsm,2) : "—"}</div></div></div>{canUpload&&<div className="rounded-2xl border border-dashed p-4"><b className="text-sm">Ảnh mẫu tròn / ảnh cân</b><input type="file" accept="image/*" className="mt-2 block text-xs" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>{imageUrl&&<img src={assetUrl(imageUrl)} className="mt-3 h-36 rounded-xl object-cover"/>}</div>}<div><b className="text-sm">Các lần đo trước</b><div className="mt-2 space-y-2">{receipt.measurements?.map(m=><div key={m.id} className="flex justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm"><span>{m.positionLabel||"Mẫu"} · {fmt(m.weightGrams,4)}g</span><b>{fmt(m.gsm,2)} GSM</b></div>)}{!receipt.measurements?.length&&<div className="text-sm text-neutral-400">Chưa có phép đo.</div>}</div></div><div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button><button disabled={saving||!gsm} onClick={save} className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Lưu phép đo</button></div></div></Modal>;
}
