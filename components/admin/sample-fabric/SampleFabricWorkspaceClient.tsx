"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import { hasPermission, type AppRole } from "@/lib/authz";

type Section = "samples" | "fabric";
type Supplier = { id: string; code: string; name: string; phone?: string | null; email?: string | null; address?: string | null; note?: string | null };
type Branch = { id: string; name: string };
type Staff = { id: string; code: string; name: string; branchId?: string | null };

type SampleColor = { id?: string; name: string; code?: string | null; status?: string; note?: string | null; imageUrl?: string | null };
type Sample = {
  id: string; code: string; name: string; year: number; season?: string | null; category?: string | null;
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
function statusLabel(value: string, list: readonly (readonly [string,string])[]) { return list.find(x => x[0] === value)?.[1] || value; }
function statusTone(status: string) {
  if (["COMPLETED","APPROVED_FOR_PRODUCTION"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["ON_HOLD","CANCELLED"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  if (["REVISING","INSPECTING"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}
function Badge({ children, status }: { children: React.ReactNode; status: string }) { return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}>{children}</span>; }
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
function compositionTokens(value?: string | null) {
  return String(value || "").split(",").map(titleCaseVi).filter(Boolean);
}

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

export default function SampleFabricWorkspaceClient({ defaultSection }: { defaultSection: Section }) {
  const { can } = usePermissions();
  const canViewSamples = can("design_sample.view");
  const canViewFabric = can("fabric_receipt.view");
  const section: Section = defaultSection === "samples" && canViewSamples ? "samples" : defaultSection === "fabric" && canViewFabric ? "fabric" : canViewSamples ? "samples" : "fabric";

  const [samples, setSamples] = useState<Sample[]>([]);
  const [receipts, setReceipts] = useState<FabricReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [productGroups, setProductGroups] = useState<string[]>([]);
  const [fabricCompositions, setFabricCompositions] = useState<string[]>([]);
  const [metaSamples, setMetaSamples] = useState<Array<Pick<Sample,"id"|"code"|"name"|"year"|"fabricBoardCode"|"fabricCode">>>([]);
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

  async function loadSamples() {
    const [rows, meta] = await Promise.all([
      api<Sample[]>(`/sample-fabric/samples${sampleStatus ? `?status=${sampleStatus}` : ""}`),
      api<{ suppliers: Supplier[]; staff: Staff[]; seasons: string[]; productGroups: string[]; fabricCompositions: string[] }>("/sample-fabric/samples/meta"),
    ]);
    setSamples(rows);
    setSuppliers(meta.suppliers);
    setStaff(meta.staff);
    setSeasons(meta.seasons || []);
    setProductGroups(meta.productGroups || []);
    setFabricCompositions(meta.fabricCompositions || []);
  }
  async function loadFabric() {
    const [rows, meta] = await Promise.all([
      api<FabricReceipt[]>(`/sample-fabric/fabric-receipts${receiptStatus ? `?status=${receiptStatus}` : ""}`),
      api<{ suppliers: Supplier[]; branches: Branch[]; samples: any[] }>("/sample-fabric/fabric-receipts/meta"),
    ]);
    setReceipts(rows); setSuppliers(meta.suppliers); setBranches(meta.branches); setMetaSamples(meta.samples);
  }
  async function reload() {
    try { setLoading(true); setError(""); if (section === "samples") await loadSamples(); else await loadFabric(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, [section, sampleStatus, receiptStatus]);

  const filteredSamples = useMemo(() => {
    const key = q.trim().toLowerCase(); if (!key) return samples;
    return samples.filter(x => [x.code,x.name,x.category,x.fabricBoardCode,x.fabricCode,x.fabricComposition,x.supplier?.name,x.assigneeName,...x.colors.map(c=>c.name)].some(v => String(v||"").toLowerCase().includes(key)));
  }, [samples,q]);
  const filteredReceipts = useMemo(() => {
    const key = q.trim().toLowerCase(); if (!key) return receipts;
    return receipts.filter(x => [x.receiptCode,x.fabricName,x.fabricBoardCode,x.fabricCode,x.colorName,x.colorCode,x.lotCode,x.supplier?.name,x.designSample?.code,x.designSample?.name].some(v => String(v||"").toLowerCase().includes(key)));
  }, [receipts,q]);

  if ((section === "samples" && !canViewSamples) || (section === "fabric" && !canViewFabric)) return <div className="p-8 text-sm text-neutral-500">Bạn không có quyền xem khu vực này.</div>;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Sản xuất / nguyên liệu</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">Mẫu mã & Vải</h1>
        <p className="mt-1 text-sm text-neutral-500">Theo dõi mẫu năm nay, bảng vải, màu, tiến độ và kiểm thực nhận từng cây vải.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canViewSamples && <Link href="/design-samples" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${section === "samples" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Quản lý mẫu mã</Link>}
        {canViewFabric && <Link href="/fabric-receipts" className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${section === "fabric" ? "bg-neutral-950 text-white" : "border border-neutral-300 bg-white text-neutral-800"}`}>Vải về</Link>}
      </div>
    </div>

    {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input className={`${inputClass} md:max-w-md`} value={q} onChange={e=>setQ(e.target.value)} placeholder={section === "samples" ? "Tìm mã mẫu, tên mẫu, bảng vải, màu..." : "Tìm phiếu, mã vải, màu, lô, NCC..."}/>
        {section === "samples" ? <select className={`${inputClass} md:w-56`} value={sampleStatus} onChange={e=>setSampleStatus(e.target.value)}><option value="">Tất cả tiến độ</option>{SAMPLE_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select> : <select className={`${inputClass} md:w-56`} value={receiptStatus} onChange={e=>setReceiptStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{RECEIPT_STATUSES.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>}
        <div className="md:ml-auto">
          {section === "samples" && can("design_sample.create") && <button onClick={()=>{setEditingSample(null);setShowSampleForm(true)}} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Tạo mẫu</button>}
          {section === "fabric" && can("fabric_receipt.create") && <button onClick={()=>{setEditingReceipt(null);setShowReceiptForm(true)}} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">+ Nhận vải</button>}
        </div>
      </div>
    </Card>

    {loading ? <Card className="p-10 text-center text-sm text-neutral-500">Đang tải dữ liệu...</Card> : section === "samples" ? <SamplesView rows={filteredSamples} can={can} onEdit={x=>{setEditingSample(x);setShowSampleForm(true)}} /> : <FabricView rows={filteredReceipts} can={can} onEdit={x=>{setEditingReceipt(x);setShowReceiptForm(true)}} onMeasure={setMeasureReceipt} onChanged={reload} />}

    {showSampleForm && <SampleForm sample={editingSample} suppliers={suppliers} staff={staff} seasons={seasons} productGroups={productGroups} fabricCompositions={fabricCompositions} canUpload={can("design_sample.upload_images")} onSupplierCreated={(supplier)=>setSuppliers((rows)=>[...rows.filter((row)=>row.id!==supplier.id),supplier].sort((a,b)=>a.name.localeCompare(b.name,"vi")))} onClose={()=>setShowSampleForm(false)} onSaved={async()=>{setShowSampleForm(false);await reload()}} />}
    {showReceiptForm && <ReceiptForm receipt={editingReceipt} suppliers={suppliers} branches={branches} samples={metaSamples} canCostView={can("fabric_receipt.cost.view") || can("fabric_receipt.cost.edit")} canCostEdit={can("fabric_receipt.cost.edit")} onClose={()=>setShowReceiptForm(false)} onSaved={async()=>{setShowReceiptForm(false);await reload()}} />}
    {measureReceipt && <MeasurementForm receipt={measureReceipt} canUpload={can("fabric_receipt.upload_images")} onClose={()=>setMeasureReceipt(null)} onSaved={async()=>{setMeasureReceipt(null);await reload()}} />}
  </div>;
}

function SamplesView({ rows, can, onEdit }: { rows: Sample[]; can: (k:string)=>boolean; onEdit:(x:Sample)=>void }) {
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
        <div className="mt-3 flex items-center justify-between gap-3"><div className="min-w-0 text-xs text-neutral-500">{row.nextAction ? <>Tiếp theo: <b className="text-neutral-800">{row.nextAction}</b></> : "Chưa ghi việc tiếp theo"}</div>{can("design_sample.edit") && <button onClick={()=>onEdit(row)} className="shrink-0 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold">Mở / sửa</button>}</div>
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
  const [showSupplierCreator, setShowSupplierCreator] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const patch = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const selectedComposition = useMemo(() => compositionTokens(form.fabricComposition), [form.fabricComposition]);

  useEffect(() => {
    if (sample) return;
    const code = normalizeSampleCode(form.code);
    if (!code) {
      setCodeCheck({ loading: false, available: null, message: "" });
      return;
    }

    setCodeCheck((current) => ({ ...current, loading: true }));
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ available: boolean; message: string }>(
          `/sample-fabric/samples/check-code?code=${encodeURIComponent(code)}`,
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
  }, [form.code, sample]);

  function setComposition(tokens: string[]) {
    const normalized = Array.from(new Set(tokens.map(titleCaseVi).filter(Boolean)));
    patch("fabricComposition", normalized.join(", "));
  }

  function toggleComposition(value: string) {
    const normalized = titleCaseVi(value);
    const exists = selectedComposition.some((item) => item.toLocaleLowerCase("vi-VN") === normalized.toLocaleLowerCase("vi-VN"));
    setComposition(exists ? selectedComposition.filter((item) => item !== normalized) : [...selectedComposition, normalized]);
  }

  function addComposition() {
    const value = titleCaseVi(compositionDraft);
    if (!value) return;
    setComposition([...selectedComposition, value]);
    setCompositionDraft("");
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
      if (!sample && code && codeCheck.available !== true) {
        throw new Error(codeCheck.message || "Mã mẫu chưa được xác nhận là hợp lệ.");
      }
      const assigned = staff.find((item) => item.id === form.assigneeStaffId);
      const payload = {
        ...form,
        code,
        category: titleCaseVi(form.category),
        fabricComposition: selectedComposition.join(", "),
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
                className={`${inputClass} ${!sample && codeCheck.available === false ? "border-red-400" : !sample && codeCheck.available === true ? "border-emerald-400" : ""}`}
                value={form.code}
                disabled={!!sample}
                placeholder="VD: QSK925"
                onChange={(e) => patch("code", normalizeSampleCode(e.target.value))}
              />
              {!sample && form.code ? (
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
            <div>
              <input
                className={inputClass}
                list="sample-product-groups"
                value={form.category}
                onChange={(e) => patch("category", e.target.value)}
                onBlur={() => patch("category", titleCaseVi(form.category))}
                placeholder="Chọn hoặc gõ nhóm mới"
              />
              <datalist id="sample-product-groups">
                {productGroups.map((group) => <option key={group} value={group} />)}
              </datalist>
              <p className="mt-1.5 text-xs text-neutral-400">Có thể gõ nhóm mới. Hệ thống tự chuẩn hoá kiểu “Áo Khoác”, “Sơ Mi”.</p>
            </div>
          </Field>

          <Field label="Nhà cung cấp vải">
            <div className="space-y-2">
              <div className="flex gap-2">
                <select className={inputClass} value={form.supplierId} onChange={(e) => patch("supplierId", e.target.value)}>
                  <option value="">Chưa chọn</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSupplierCreator((value) => !value)}
                  className="shrink-0 rounded-2xl border border-neutral-300 px-3 text-xs font-semibold hover:bg-neutral-50"
                >
                  + NCC vải
                </button>
              </div>
              {showSupplierCreator ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className={inputClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tên NCC vải" />
                    <input className={inputClass} value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="SĐT (không bắt buộc)" />
                  </div>
                  <button type="button" disabled={creatingSupplier || !supplierName.trim()} onClick={createSupplier} className="mt-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                    {creatingSupplier ? "Đang tạo..." : "Tạo NCC vải"}
                  </button>
                </div>
              ) : null}
            </div>
          </Field>

          <Field label="Mã bảng vải">
            <input className={inputClass} value={form.fabricBoardCode} onChange={(e) => patch("fabricBoardCode", e.target.value)} />
          </Field>
          <Field label="Mã chất vải">
            <input className={inputClass} value={form.fabricCode} onChange={(e) => patch("fabricCode", e.target.value)} />
          </Field>
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
          {selectedComposition.length ? <div className="mt-3 text-xs text-neutral-500">Đã chọn: <b className="text-neutral-800">{selectedComposition.join(", ")}</b></div> : null}
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
            <b className="text-sm">Ảnh mẫu / ảnh tham khảo</b>
            <input type="file" accept="image/*" className="mt-2 block text-xs" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {form.coverImageUrl ? <img src={assetUrl(form.coverImageUrl)} className="mt-3 h-40 rounded-2xl object-cover" alt="Ảnh mẫu" /> : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="rounded-2xl border px-4 py-2.5 text-sm">Đóng</button>
          <button
            type="button"
            disabled={saving || (!sample && !!form.code && (codeCheck.loading || codeCheck.available !== true))}
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
