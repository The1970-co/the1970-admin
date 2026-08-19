"use client";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import { ArrowLeft, Camera, ChevronDown, ImagePlus, Layers3, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
const DEFAULT_COMPOSITIONS = ["Cotton", "Linen", "Tencel", "Lyocell", "Viscose", "Rayon", "Polyester", "Nylon", "Spandex", "Elastane", "Wool", "Silk", "Bamboo", "Cashmere", "Acrylic", "Modal"];
const DEFAULT_SEASONS = ["Xuân Hạ", "Thu Đông", "Đông Xuân", "Xuân Hè"];
async function api<T = any>(path: string, init: RequestInit = {}) { return apiJson<T>(path, { ...init, redirectOnUnauthorized: false } as any); }
async function uploadBoardImage(file: File) { const fd = new FormData(); fd.append("file", file); return api<{
    url: string;
}>("/sample-fabric/library/upload", { method: "POST", body: fd }); }
function asset(url?: string | null) { if (!url)
    return ""; return /^https?:\/\//.test(url) ? url : `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`; }
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
    const [rows, setRows] = useState<FabricBoard[]>([]), [meta, setMeta] = useState<Meta>({ suppliers: [], seasons: [], productGroups: [], fabricCompositions: [] }), [q, setQ] = useState(""), [detail, setDetail] = useState<FabricBoard | null>(null), [editing, setEditing] = useState<FabricBoard | null | undefined>(undefined), [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false), [error, setError] = useState(""), [user, setUser] = useState<any>(null);
    const permissions = useMemo(() => getCurrentUserPermissions(user, user?.activeBranchId || user?.branchId), [user]);
    const can = (key: string) => isAdmin(user) || permissions.includes("*") || permissions.includes(key);
    async function load() { try {
        setLoading(true);
        setError("");
        const [boards, m, groups] = await Promise.all([api<FabricBoard[]>(`/sample-fabric/library${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`), api<Meta>("/sample-fabric/library/meta"), api<string[]>("/products/category-options").catch(() => [])]);
        setRows(Array.isArray(boards) ? boards : []);
        setMeta({ suppliers: Array.isArray(m?.suppliers) ? m.suppliers : [], seasons: unique([...DEFAULT_SEASONS, ...(m?.seasons || [])]), productGroups: unique([...(groups || []), ...(m?.productGroups || [])]), fabricCompositions: unique([...DEFAULT_COMPOSITIONS, ...((m?.fabricCompositions || []).map((x:string)=>String(x||"").replace(/\s+\d+(?:[.,]\d+)?%.*$/,"")))]), staff: m?.staff || [] });
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được thư viện bảng vải.");
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { setUser(getCurrentUserFromStorage()); void load(); }, []);
    const list = useMemo(() => { const k = q.trim().toLowerCase(); return k ? rows.filter(x => [x.boardCode, x.fabricCode, x.name, x.composition, x.supplier?.name, x.supplier?.code, ...(x.seasons || []), ...(x.productGroups || [])].some(v => String(v || "").toLowerCase().includes(k))) : rows; }, [rows, q]);
    async function openDetail(board: FabricBoard) { try {
        setDetailLoading(true);
        setDetail(await api<FabricBoard>(`/sample-fabric/library/${board.id}`));
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Không mở được bảng vải.");
    }
    finally {
        setDetailLoading(false);
    } }
    async function removeBoard(board: FabricBoard) { if (!window.confirm(`Xoá bảng vải ${board.boardCode}?`))
        return; try {
        await api(`/sample-fabric/library/${board.id}`, { method: "DELETE" });
        setDetail(null);
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Không xoá được bảng vải.");
    } }
    return <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(84px+env(safe-area-inset-bottom))] text-neutral-950"><div className="mx-auto max-w-md"><header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[max(24px,calc(env(safe-area-inset-top)+8px))] backdrop-blur"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Link href="/mobile/production" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Nguyên liệu</div><h1 className="text-xl font-black">Bảng vải</h1></div></div><div className="flex gap-2"><button onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/></button>{can("fabric_library.create") && <button onClick={() => setEditing(null)} className="rounded-2xl bg-neutral-950 px-3.5 py-2.5 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Thêm</button>}</div></div><div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-400"/><input className="w-full rounded-2xl border border-neutral-300 bg-white py-3 pl-10 pr-3 text-[16px] outline-none focus:border-neutral-950" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter")
        void load(); }} placeholder="Tìm NCC, mã bảng, mã vải, thành phần..."/></div></header><div className="space-y-3 p-4">{error && <Err text={error}/>} {loading && <Empty text="Đang tải bảng vải..."/>}{!loading && list.map(board => { const image = asset(board.coverImageUrl || board.images?.[0]?.url); const gsm = board.expectedGsm ?? board.gsm; return <button type="button" key={board.id} onClick={() => void openDetail(board)} className="w-full rounded-[28px] bg-white p-4 text-left shadow-sm active:scale-[.995]"><div className="flex gap-3"><div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">{image ? <img src={image} className="h-full w-full object-cover" alt=""/> : <div className="grid h-full place-items-center"><Layers3 className="h-8 w-8 text-neutral-300"/></div>}</div><div className="min-w-0 flex-1"><div className="text-xs font-black text-neutral-400">{board.boardCode}{board.fabricCode ? ` · ${board.fabricCode}` : ""}</div><div className="mt-1 text-base font-black">{board.name || "Bảng vải"}</div><div className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">{board.composition || "Chưa khai báo thành phần"}</div><div className="mt-2 flex flex-wrap gap-1.5">{gsm !== null && gsm !== undefined && gsm !== "" && <Badge>{gsm} GSM</Badge>}{(board.seasons || []).slice(0, 2).map(x => <Badge key={x}>{x}</Badge>)}{!!board.productGroups?.length && <Badge>{board.productGroups.length} nhóm SP</Badge>}</div></div></div></button>; })}{!loading && !list.length && <Empty text="Chưa có bảng vải phù hợp."/>}</div></div>
 {detailLoading && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="rounded-3xl bg-white px-6 py-5 text-sm font-black">Đang tải chi tiết...</div></div>}
 {detail && <BoardDetail board={detail} can={can} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }} onDelete={() => void removeBoard(detail)}/>} 
 {editing !== undefined && <BoardForm board={editing} meta={meta} canUpload={can("fabric_library.upload_images")} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await load(); }} onSupplierCreated={supplier => setMeta(m => ({ ...m, suppliers: [...m.suppliers.filter(x => x.id !== supplier.id), supplier].sort((a, b) => a.name.localeCompare(b.name, "vi")) }))}/>}<MobileBottomNav /></main>;
}
function BoardDetail({ board, can, onClose, onEdit, onDelete }: {
    board: FabricBoard;
    can: (key: string) => boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) { const cover = asset(board.coverImageUrl || board.images?.[0]?.url); const images = board.images || [], dispatches = board.sampleDispatches || [], samples = board.designSamples || [], receipts = board.fabricReceipts || []; return <Modal title={`${board.boardCode}${board.name ? ` · ${board.name}` : ""}`} onClose={onClose}><div className="space-y-5 p-4">{cover && <img src={cover} className="h-64 w-full rounded-3xl object-cover" alt=""/>}{images.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1">{images.map((img, i) => <img key={img.id || `${img.url}-${i}`} src={asset(img.url)} className="h-20 w-20 shrink-0 rounded-2xl object-cover" alt=""/>)}</div>}<div className="grid grid-cols-2 gap-3"><Info label="Mã bảng vải" value={board.boardCode || "—"}/><Info label="Mã chất vải" value={board.fabricCode || "—"}/><Info label="GSM dự kiến" value={board.expectedGsm != null ? `${board.expectedGsm} GSM` : board.gsm ? `${board.gsm} GSM` : "—"}/><Info label="NCC" value={board.supplier?.code || board.supplier?.publicCode || board.supplier?.name || "—"}/></div><Info label="Thành phần chất vải" value={board.composition || "Chưa khai báo"}/><ChipSection title="Mùa có thể dùng" values={board.seasons || []}/><ChipSection title="Nhóm sản phẩm phù hợp" values={board.productGroups || []}/>{!!board.colors?.length && <ChipSection title="Màu đã khai báo" values={board.colors.map(c => `${c.name}${c.code ? ` ${String(c.code).startsWith("#") ? c.code : `#${c.code}`}` : ""}`)}/>} {board.note && <Info label="Ghi chú bảng vải" value={board.note}/>}<section><div className="flex items-center justify-between"><b className="text-sm">Lịch sử gửi làm mẫu</b><Badge>{dispatches.length} lần</Badge></div><div className="mt-2 space-y-2">{dispatches.length ? dispatches.map((d: any) => <div key={d.id} className="rounded-2xl border bg-white p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black">{d.designSample?.code || "—"} · {d.designSample?.name || "Mẫu"}</div><div className="mt-1 text-xs text-neutral-500">{fmtDate(d.sentAt)} · {d.fabricColor?.name || d.colorName || "—"} {d.fabricColor?.code || d.colorCode || ""}</div></div><Badge>{dispatchLabel(d.status)}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2"><Mini label="Nơi nhận" value={d.recipientName || "—"}/><Mini label="Người gửi" value={d.sentByName || "—"}/><Mini label="Hạn" value={fmtDate(d.dueDate)}/><Mini label="Tiến độ" value={dispatchLabel(d.status)}/></div></div>) : <Empty text="Chưa gửi đi làm mẫu."/>}</div></section><section><div className="flex items-center justify-between"><b className="text-sm">Lịch sử sử dụng / mẫu đã sản xuất</b><Badge>{samples.length} mẫu</Badge></div><div className="mt-2 space-y-2">{samples.length ? samples.map((s: any) => <div key={s.id} className="rounded-2xl border bg-white p-3"><div className="font-black">{s.code} · {s.name}</div><div className="mt-1 text-xs text-neutral-500">{s.year || "—"} · {s.season || "—"} · {s.category || "—"}</div>{s.producedProduct && <div className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800">Đã sản xuất: {s.producedProduct.name}{s.producedProduct.slug ? ` · ${s.producedProduct.slug}` : ""}</div>}</div>) : <Empty text="Chưa có mẫu sử dụng bảng vải này."/>}</div></section>{!!receipts.length && <section><div className="flex items-center justify-between"><b className="text-sm">Phiếu vải về liên quan</b><Badge>{receipts.length} phiếu</Badge></div><div className="mt-2 space-y-2">{receipts.map((r: any) => <div key={r.id} className="rounded-2xl bg-neutral-50 p-3"><div className="font-black">{r.receiptCode || "Phiếu vải"}</div><div className="mt-1 text-xs text-neutral-500">{r.fabricName || board.name || "—"} · {r.colorName || "—"} {r.colorCode || ""}</div></div>)}</div></section>}<div className="grid grid-cols-2 gap-2 border-t pt-4">{can("fabric_library.edit") && <button onClick={onEdit} className="rounded-2xl border py-3 text-sm font-black"><Pencil className="mr-1 inline h-4 w-4"/>Sửa bảng</button>}{can("fabric_library.delete") && <button onClick={onDelete} className="rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-black text-red-700"><Trash2 className="mr-1 inline h-4 w-4"/>Xoá bảng</button>}</div></div></Modal>; }
function BoardForm({ board, meta, canUpload, onClose, onSaved, onSupplierCreated }: {
    board: FabricBoard | null;
    meta: Meta;
    canUpload: boolean;
    onClose: () => void;
    onSaved: () => void;
    onSupplierCreated: (supplier: Supplier) => void;
}) { const [form, setForm] = useState<any>({ supplierId: board?.supplierId || board?.supplier?.id || "", boardCode: board?.boardCode || "", fabricCode: board?.fabricCode || "", name: board?.name || "", expectedGsm: board?.expectedGsm ?? board?.gsm ?? "", seasons: board?.seasons || [], productGroups: board?.productGroups || [], note: board?.note || "", coverImageUrl: board?.coverImageUrl || "" }); const [compositionParts, setCompositionParts] = useState<CompositionPart[]>(() => parseComposition(board?.composition)), [compositionDraft, setCompositionDraft] = useState(""), [images, setImages] = useState<BoardImage[]>(board?.images?.map(x => ({ ...x })) || []), [colors, setColors] = useState<BoardColor[]>(board?.colors?.map(x => ({ ...x })) || []), [productOpen, setProductOpen] = useState(false), [supplierCreating, setSupplierCreating] = useState(false), [supplierName, setSupplierName] = useState(""), [customGroup, setCustomGroup] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState(""); const patch = (k: string, v: any) => setForm((x: any) => ({ ...x, [k]: v })); function toggle(key: "seasons" | "productGroups", value: string) { setForm((x: any) => ({ ...x, [key]: x[key].includes(value) ? x[key].filter((v: string) => v !== value) : [...x[key], value] })); } function addComposition(name: string) { const clean = titleCase(name); if (!clean)
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
    await api(board ? `/sample-fabric/library/${board.id}` : "/sample-fabric/library", { method: board ? "PATCH" : "POST", body: JSON.stringify({ supplierId: form.supplierId || null, boardCode: normalizeCode(form.boardCode), fabricCode: normalizeCode(form.fabricCode) || null, name: form.name.trim() || null, composition: compositionText(compositionParts) || null, expectedGsm: form.expectedGsm === "" ? null : Number(String(form.expectedGsm).replace(",", ".")), seasons: form.seasons, productGroups: form.productGroups, note: form.note || null, coverImageUrl: form.coverImageUrl || images[0]?.url || null, images, colors: colors.filter(x => x.name.trim() || String(x.code || "").trim()).map(x => ({ ...x, name: titleCase(x.name), code: x.code ? `#${String(x.code).replace(/^#+/, "").trim()}` : null })) }) });
    if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    requestAnimationFrame(() => onSaved());
}
catch (e) {
    setError(e instanceof Error ? e.message : "Không lưu được bảng vải.");
}
finally {
    setSaving(false);
} } const compositionOptions = unique([...DEFAULT_COMPOSITIONS, ...(meta.fabricCompositions || [])]); return <Modal title={board ? `Sửa bảng vải ${board.boardCode}` : "Thêm bảng vải"} onClose={onClose}><div className="space-y-4 p-4">{error && <Err text={error}/>}<Field label="Ảnh bảng vải"><div className="rounded-3xl border border-dashed p-3">{!!images.length && <div className="mb-3 flex gap-2 overflow-x-auto">{images.map((img, i) => <div key={`${img.url}-${i}`} className="relative shrink-0"><img src={asset(img.url)} className="h-24 w-24 rounded-2xl object-cover" alt=""/><button type="button" onClick={() => { const next = images.filter((_, n) => n !== i); setImages(next); if (form.coverImageUrl === img.url)
    patch("coverImageUrl", next[0]?.url || ""); }} className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow"><X className="h-3 w-3"/></button></div>)}</div>}{canUpload ? <div className="grid grid-cols-2 gap-2"><label className="cursor-pointer rounded-2xl bg-neutral-950 py-3 text-center text-xs font-black text-white"><Camera className="mr-1 inline h-4 w-4"/>Chụp ảnh<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void pickImages(e.target.files||undefined)}/></label><label className="cursor-pointer rounded-2xl border py-3 text-center text-xs font-black"><ImagePlus className="mr-1 inline h-4 w-4"/>Tải nhiều ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={e => void pickImages(e.target.files||undefined)}/></label></div> : <div className="text-xs text-neutral-400">Không có quyền tải ảnh.</div>}</div></Field><div className="grid grid-cols-2 gap-3"><Field label="Mã bảng vải"><input className={input} value={form.boardCode} onChange={e => patch("boardCode", normalizeCode(e.target.value))} placeholder="A2309"/></Field><Field label="Mã chất vải"><input className={input} value={form.fabricCode} onChange={e => patch("fabricCode", normalizeCode(e.target.value))} placeholder="KAKI01"/></Field></div><Field label="Tên bảng vải"><input className={input} value={form.name} onChange={e => patch("name", e.target.value)} onBlur={() => patch("name", titleCase(form.name))} placeholder="Vải Quần Kaki"/></Field><div className="grid grid-cols-[1fr_auto] gap-2"><Field label="Nhà cung cấp vải"><select className={input} value={form.supplierId} onChange={e => patch("supplierId", e.target.value)}><option value="">Chưa chọn NCC</option>{meta.suppliers.map(s => <option key={s.id} value={s.id}>{s.code || s.publicCode ? `${s.code || s.publicCode} · ` : ""}{s.name}</option>)}</select></Field><button type="button" onClick={() => setSupplierCreating(x => !x)} className="mt-[18px] h-[49px] rounded-2xl border px-3 text-xs font-black">+ NCC</button></div>{supplierCreating && <div className="flex gap-2 rounded-2xl bg-neutral-50 p-3"><input className={input} value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Tên NCC vải mới"/><button type="button" onClick={() => void createSupplier()} className="shrink-0 rounded-2xl bg-neutral-950 px-4 text-xs font-black text-white">Tạo</button></div>}<Field label="GSM dự kiến"><UnitInput value={form.expectedGsm} unit="GSM" onChange={v => patch("expectedGsm", v)}/></Field><section className="rounded-3xl border p-3"><div className="text-sm font-black">Thành phần chất vải</div><div className="mt-1 text-[11px] text-neutral-400">Chọn chất liệu rồi điền %. Nếu có tỷ lệ thì tổng phải bằng 100%.</div><div className="mt-3 flex flex-wrap gap-2">{compositionOptions.map(name => { const selected = compositionParts.some(x => x.name.toLowerCase() === name.toLowerCase()); return <button type="button" key={name} onClick={() => selected ? setCompositionParts(x => x.filter(p => p.name.toLowerCase() !== name.toLowerCase())) : addComposition(name)} className={`rounded-full border px-3 py-2 text-[11px] font-black ${selected ? "bg-neutral-950 text-white" : "bg-white"}`}>{name}</button>; })}</div><div className="mt-3 flex gap-2"><input className={input} value={compositionDraft} onChange={e => setCompositionDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") {
    e.preventDefault();
    addComposition(compositionDraft);
} }} placeholder="Thêm thành phần khác"/><button type="button" onClick={() => addComposition(compositionDraft)} className="shrink-0 rounded-2xl border px-4 text-xs font-black">+ Thêm</button></div>{!!compositionParts.length && <div className="mt-3 space-y-2">{compositionParts.map((part, i) => <div key={`${part.name}-${i}`} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 rounded-2xl bg-neutral-50 p-2"><b className="px-1 text-sm">{part.name}</b><UnitInput value={part.percent} unit="%" onChange={v => setCompositionParts(x => x.map((p, n) => n === i ? { ...p, percent: v } : p))}/><button type="button" onClick={() => setCompositionParts(x => x.filter((_, n) => n !== i))} className="grid h-9 w-9 place-items-center text-red-600"><X className="h-4 w-4"/></button></div>)}<div className="text-xs text-neutral-500">Lưu thành: <b>{compositionText(compositionParts)}</b></div></div>}</section><section><div className={label}>Mùa có thể dùng</div><div className="flex flex-wrap gap-2">{meta.seasons.map(s => <button type="button" key={s} onClick={() => toggle("seasons", s)} className={`rounded-full border px-3 py-2 text-xs font-black ${form.seasons.includes(s) ? "bg-neutral-950 text-white" : "bg-white"}`}>{s}</button>)}</div></section><section><div className={label}>Nhóm sản phẩm phù hợp</div><button type="button" onClick={() => setProductOpen(x => !x)} className="flex min-h-[49px] w-full items-center justify-between rounded-2xl border bg-white px-3.5 text-left text-[16px]"><span className={form.productGroups.length ? "font-bold" : "text-neutral-400"}>{form.productGroups.length ? `Đã chọn ${form.productGroups.length} nhóm` : "Chọn nhóm sản phẩm"}</span><ChevronDown className={`h-4 w-4 ${productOpen ? "rotate-180" : ""}`}/></button>{productOpen && <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border bg-white p-2" style={{WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}>{meta.productGroups.map(g => <label key={g} className="flex items-center gap-3 rounded-xl px-3 py-2.5"><input type="checkbox" checked={form.productGroups.includes(g)} onChange={() => toggle("productGroups", g)} className="h-4 w-4"/><span className="text-sm font-bold">{g}</span></label>)}</div>}<div className="mt-2 flex flex-wrap gap-1.5">{form.productGroups.map((g: string) => <button type="button" key={g} onClick={() => toggle("productGroups", g)} className="rounded-full bg-neutral-950 px-3 py-1.5 text-[11px] font-black text-white">{g} ×</button>)}</div><input className={`${input} mt-2`} value={customGroup} onChange={e => setCustomGroup(e.target.value)} onKeyDown={e => { if (e.key === "Enter") {
    e.preventDefault();
    const g = titleCase(customGroup);
    if (g && !form.productGroups.includes(g))
        patch("productGroups", [...form.productGroups, g]);
    setCustomGroup("");
} }} placeholder="Gõ nhóm mới rồi Enter"/></section><section className="rounded-3xl border p-3"><div className="flex items-center justify-between"><div><div className="text-sm font-black">Màu trên bảng</div><div className="mt-1 text-[11px] text-neutral-400">Không bắt buộc; chỉ thêm khi cần.</div></div><button type="button" onClick={() => setColors(x => [...x, { name: "", code: "" }])} className="rounded-xl border px-3 py-2 text-xs font-black">+ Màu</button></div>{!!colors.length && <div className="mt-3 space-y-2">{colors.map((c, i) => <div key={c.id || i} className="grid grid-cols-[1fr_100px_auto] gap-2"><input className={input} value={c.name} onChange={e => setColors(x => x.map((p, n) => n === i ? { ...p, name: e.target.value } : p))} placeholder="Tên màu"/><input className={input} value={c.code || ""} onChange={e => setColors(x => x.map((p, n) => n === i ? { ...p, code: e.target.value ? `#${e.target.value.replace(/^#+/, "")}` : "" } : p))} placeholder="#2"/><button type="button" onClick={() => setColors(x => x.filter((_, n) => n !== i))} className="grid h-12 w-10 place-items-center text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>}</section><Field label="Ghi chú bảng vải"><textarea className={`${input} min-h-24`} value={form.note} onChange={e => patch("note", e.target.value)} placeholder="Ứng dụng, cảm giác tay, lưu ý xử lý..."/></Field><div className="grid grid-cols-2 gap-2 border-t pt-4"><button onClick={onClose} className="rounded-2xl border py-3 text-sm font-black">Đóng</button><button disabled={saving} onClick={() => void save()} className="rounded-2xl bg-neutral-950 py-3 text-sm font-black text-white disabled:opacity-40">{saving ? "Đang lưu..." : "Lưu bảng vải"}</button></div></div></Modal>; }
function Modal({ title, children, onClose }: {
    title: string;
    children: any;
    onClose: () => void;
}) {
    const [viewport,setViewport]=useState<{height:number;top:number}>(()=>({height:typeof window==="undefined"?800:window.innerHeight,top:0}));
    useEffect(()=>{
        const vv=window.visualViewport;
        const sync=()=>setViewport({height:vv?.height||window.innerHeight,top:vv?.offsetTop||0});
        const prevOverflow=document.body.style.overflow;
        document.body.style.overflow="hidden";
        sync();
        vv?.addEventListener("resize",sync);
        vv?.addEventListener("scroll",sync);
        window.addEventListener("orientationchange",sync);
        return()=>{document.body.style.overflow=prevOverflow;vv?.removeEventListener("resize",sync);vv?.removeEventListener("scroll",sync);window.removeEventListener("orientationchange",sync)};
    },[]);
    function close(){
        if(document.activeElement instanceof HTMLElement) document.activeElement.blur();
        const sync=()=>{const vv=window.visualViewport;setViewport({height:vv?.height||window.innerHeight,top:vv?.offsetTop||0})};
        requestAnimationFrame(sync);setTimeout(sync,80);setTimeout(()=>onClose(),120);
    }
    return <div className="fixed left-0 right-0 z-[100] overflow-y-auto overscroll-contain bg-black/45 px-3" style={{top:viewport.top,height:viewport.height,paddingTop:12,paddingBottom:"max(12px, env(safe-area-inset-bottom))",WebkitOverflowScrolling:"touch",touchAction:"pan-y"}}><div className="mx-auto max-w-md overflow-visible rounded-[30px] bg-white shadow-2xl"><div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white p-4"><h2 className="min-w-0 truncate pr-3 font-black">{title}</h2><button onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border"><X className="h-4 w-4"/></button></div>{children}</div></div>;
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
