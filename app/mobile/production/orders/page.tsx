"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  Check,
  Factory,
  Plus,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import * as XLSX from "xlsx";

async function productionApi<T=any>(path:string, init:RequestInit={}) {
  return apiJson<T>(path,{...init,redirectOnUnauthorized:false} as any);
}
function asset(url?:string|null) {
  if(!url) return "";
  return /^https?:\/\//.test(url) ? url : `${API_BASE}${url.startsWith("/")?"":"/"}${url}`;
}
function fmt(v:any,digits=2) {
  const n=Number(v||0);
  return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:digits}).format(Number.isFinite(n)?n:0);
}

type Sample = {
  id: string;
  code: string;
  name: string;
  year?: number;
  category?: string | null;
  coverImageUrl?: string | null;
};
type Product = {
  id: string;
  code: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  category?: string | null;
  variants?: Array<{ sku: string; size?: string | null; color?: string | null }>;
};
type FactoryItem = { id: string; code: string; name: string; contactName?: string | null; phone?: string | null };
type Roll = {
  id: string;
  fabricReceiptId: string;
  receiptCode?: string;
  fabricName?: string;
  fabricCode?: string;
  fabricBoardCode?: string;
  rollCode?: string | null;
  colorName?: string | null;
  colorCode?: string | null;
  actualM: number;
  actualKg: number;
  supplierDeclaredM?: number;
  supplierDeclaredKg?: number;
  usingSupplierDeclaredM?: boolean;
  remainingM: number;
  remainingKg: number;
  isDepleted?: boolean;
  missingActual?: boolean;
  imageUrl?: string | null;
  createdAt?: string | null;
  receivedAt?: string | null;
};
type Accessory = {
  id: string;
  code: string;
  name: string;
  typeName?: string;
  unit: string;
  stockQty?: number;
  specifications?: Record<string, any> | null;
};
type Meta = {
  samples: Sample[];
  products: Product[];
  factories: FactoryItem[];
  accessories: Accessory[];
  rolls: Roll[];
};
type Order = {
  id: string;
  code: string;
  sourceType: "SAMPLE" | "PRODUCT";
  sourceCode: string;
  sourceName?: string | null;
  sourceImageUrl?: string | null;
  status: string;
  productionPartnerId: string;
  productKind?: "SHIRT" | "PANTS" | "OTHER";
  sizeSet?: string[] | null;
  sizeRatio?: Record<string, number> | null;
  dueDate?: string | null;
  updatedAt?: string | null;
  factory?: FactoryItem | null;
  source?: { type: string; id?: string; code: string; name?: string | null; imageUrl?: string | null };
  progress?: {
    nplDone?: boolean;
    fabricDone?: boolean;
    sizeDone?: boolean;
    calculationDone?: boolean;
    sent?: boolean;
    rollCount?: number;
    allocatedM?: number;
    nplCount?: number;
    materialCalcCount?: number;
    totalPlannedQty?: number;
    totalActualQty?: number;
    sizeRatioText?: string;
  };
};

type MaterialSpec = {
  accessoryItemId: string;
  qtyPerProduct: number | string;
  wastePercent: number | string;
  sizeScoped: boolean;
  fixedSize?: string | null;
  note?: string | null;
};

type SavedAccessoryTemplateItem = {
  id: string;
  accessoryItemId?: string | null;
  accessoryCodeSnapshot?: string | null;
  accessoryNameSnapshot?: string | null;
  qtyPerProduct: number | string;
  wastePercent: number | string;
  sizeScoped: boolean;
  note?: string | null;
  sortOrder?: number;
};

type SavedAccessoryTemplate = {
  id: string;
  name: string;
  productKind: "SHIRT" | "PANTS" | "OTHER";
  sourceType?: string | null;
  sourceFileName?: string | null;
  createdByName?: string | null;
  items: SavedAccessoryTemplateItem[];
};

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const PANTS_SIZES = ["29", "30", "31", "32", "34", "36"];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Chưa triển khai",
  PLANNING: "Đang lên kế hoạch",
  READY: "Sẵn sàng",
  SENT: "Đã giao nhà may",
  CUTTING: "Đang cắt",
  SEWING: "Đang may",
  QC: "QC / hoàn thiện",
  COMPLETED: "Đã SX xong",
  CANCELLED: "Đã huỷ",
};

const input =
  "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900";

function productionStatusTone(status: string) {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["CUTTING", "SEWING"].includes(status)) return "border-blue-200 bg-blue-50 text-blue-800";
  if (["READY", "SENT", "QC"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "CANCELLED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function progressTone(done?: boolean) {
  return done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-neutral-200 bg-neutral-50 text-neutral-400";
}

function fmtDateShort(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
}

function useProductionPermissions(){
  const user=getCurrentUserFromStorage() as any;
  const roles=[...(Array.isArray(user?.roles)?user.roles:[]),user?.role,user?.roleCode,user?.staffRole].map(x=>String(x||"").toLowerCase());
  const root=roles.includes("owner")||roles.includes("admin");
  const keys=new Set(getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId));
  const can=(key:string)=>root||keys.has("*")||keys.has(key);
  return {user,can,root};
}

export default function Page() {
  const {user,can,root}=useProductionPermissions();
  const canView=can("production.view");
  const canCreate=can("production.create");
  const canEdit=can("production.edit");
  const canCalculate=can("production.calculate");
  const canManage=can("production.manage");
  const canViewSampleSource=can("production.source.sample.view");
  const stepAccess = {
    1: can("production.step1"),
    2: can("production.step2"),
    3: can("production.step3"),
    4: can("production.step4"),
    5: can("production.step5"),
    6: root,
  } as Record<1 | 2 | 3 | 4 | 5 | 6, boolean>;
  const canOpenAnyStep = Object.values(stepAccess).some(Boolean);
  const [meta, setMeta] = useState<Meta>({ samples: [], products: [], factories: [], accessories: [], rolls: [] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function load() {
    try {
      setError("");
      const [m, o] = await Promise.all([
        productionApi<Meta>("/production/meta"),
        productionApi<Order[]>("/production/orders"),
      ]);
      setMeta(m);
      setOrders(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được sản xuất.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancelOrder(row: Order) {
    if (!canEdit) return;
    if (!window.confirm(`Huỷ lệnh ${row.code}? Lệnh vẫn được giữ để tra cứu, vải đang giữ sẽ được trả lại khả dụng.`)) return;
    try {
      setBusyAction(`${row.id}:cancel`);
      setError("");
      await productionApi(`/production/orders/${row.id}/cancel`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không huỷ được lệnh sản xuất.");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteOrder(row: Order) {
    if (!canManage) return;
    if (!window.confirm(`XOÁ HẲN lệnh ${row.code}? Dữ liệu NPL, cây vải, size và lịch sử cắt của lệnh này sẽ bị xoá.`)) return;
    try {
      setBusyAction(`${row.id}:delete`);
      setError("");
      await productionApi(`/production/orders/${row.id}`, { method: "DELETE" });
      if (detailId === row.id) setDetailId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được lệnh sản xuất.");
    } finally {
      setBusyAction("");
    }
  }

  if(user&&!canView)return <main className="min-h-[100dvh] bg-neutral-100 p-4 text-sm text-neutral-500">Bạn không có quyền xem Lệnh sản xuất.</main>;

  return (
    <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(84px+env(safe-area-inset-bottom))] text-neutral-950">
      <div className="mx-auto max-w-md">
        <header
          className="border-b bg-white px-3 pb-3"
          style={{paddingTop:"max(44px, calc(env(safe-area-inset-top) + 8px))"}}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/mobile/production" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100">
                <ArrowLeft className="h-5 w-5"/>
              </Link>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">Sản xuất</div>
                <h1 className="truncate text-[19px] font-black leading-5">Lệnh sản xuất</h1>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"><RefreshCw className="h-4 w-4"/></button>
              {canCreate&&stepAccess[1]&&<button onClick={()=>setCreateOpen(true)} className="h-10 rounded-full bg-neutral-950 px-3 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Tạo lệnh</button>}
            </div>
          </div>
          {canManage&&<button onClick={()=>setFactoryOpen(true)} className="mt-2 rounded-full border bg-white px-3 py-2 text-[11px] font-black"><Factory className="mr-1 inline h-3.5 w-3.5"/>Nhà may</button>}
        </header>

        <div className="space-y-3 p-3">
          {error&&<Err x={error}/>}
          {orders.map((o)=>{
            const p=o.progress||{};
            const sourceVisible=o.sourceType==="PRODUCT"||canViewSampleSource;
            const ratioText=p.sizeRatioText||(Array.isArray(o.sizeSet)?o.sizeSet.map((s)=>`${s}:${Number(o.sizeRatio?.[s]||0)}`).join(" · "):"");
            const actualTotal=Number(p.totalActualQty||0);
            const plannedTotal=Number(p.totalPlannedQty||0);
            return <div key={o.id} className={`overflow-hidden rounded-[24px] border bg-white ${o.status==="CANCELLED"?"opacity-70":""}`}>
              <button type="button" onClick={()=>canOpenAnyStep&&setDetailId(o.id)} className="flex w-full gap-3 p-3 text-left">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                  {sourceVisible&&(o.source?.imageUrl||o.sourceImageUrl)&&<img src={asset(o.source?.imageUrl||o.sourceImageUrl)} className="h-full w-full object-cover" alt=""/>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[10px] font-bold text-neutral-400">{o.code}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${productionStatusTone(o.status)}`}>{STATUS_LABEL[o.status]||o.status}</span>
                  </div>
                  <div className="mt-1 truncate text-sm font-black">{sourceVisible?`${o.sourceCode} · ${o.sourceName||o.source?.name||""}`:"Mẫu triển khai · Đã ẩn"}</div>
                  <div className="mt-1 text-[11px] text-neutral-500">Nhà may: <b>{o.factory?.name||"—"}</b> · Hạn: <b>{fmtDateShort(o.dueDate)}</b></div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className={`rounded-lg border px-1.5 py-1 text-[9px] font-bold ${progressTone(p.nplDone)}`}>{p.nplDone?"✓":"○"} NPL</span>
                    <span className={`rounded-lg border px-1.5 py-1 text-[9px] font-bold ${progressTone(p.fabricDone)}`}>{p.fabricDone?"✓":"○"} Vải</span>
                    <span className={`rounded-lg border px-1.5 py-1 text-[9px] font-bold ${progressTone(p.sizeDone)}`}>{p.sizeDone?"✓":"○"} Size</span>
                    <span className={`rounded-lg border px-1.5 py-1 text-[9px] font-bold ${progressTone(p.calculationDone)}`}>{p.calculationDone?"✓":"○"} SL</span>
                  </div>
                </div>
              </button>
              <div className="grid grid-cols-2 gap-2 border-t bg-neutral-50 p-2.5">
                <div className="rounded-xl bg-white p-2">
                  <div className="text-[9px] font-bold uppercase text-neutral-400">Tỷ lệ size</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] font-bold">{ratioText||"Chưa thiết lập"}</div>
                </div>
                <div className="rounded-xl bg-white p-2">
                  <div className="text-[9px] font-bold uppercase text-neutral-400">TT / DK</div>
                  <div className="mt-0.5 text-sm font-black">{p.calculationDone?`${actualTotal} / ${plannedTotal}`:"Chưa tính"}</div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 border-t p-2.5">
                {canOpenAnyStep&&<button onClick={()=>setDetailId(o.id)} className="rounded-xl bg-neutral-950 px-3 py-2 text-[11px] font-black text-white">Mở quy trình</button>}
                {canEdit&&o.status!=="CANCELLED"&&o.status!=="COMPLETED"&&<button disabled={busyAction===`${o.id}:cancel`} onClick={()=>void cancelOrder(o)} className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800">Huỷ</button>}
                {canManage&&["DRAFT","PLANNING","CANCELLED"].includes(o.status)&&<button disabled={busyAction===`${o.id}:delete`} onClick={()=>void deleteOrder(o)} className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] font-bold text-red-700">Xoá</button>}
              </div>
            </div>
          })}
          {!orders.length&&<div className="rounded-3xl border bg-white p-10 text-center text-sm text-neutral-400">Chưa có lệnh sản xuất.</div>}
        </div>

        {createOpen&&<CreateOrderModal meta={meta} canViewSampleSource={canViewSampleSource} onClose={()=>setCreateOpen(false)} onSaved={async(id)=>{setCreateOpen(false);await load();setDetailId(id)}}/>}
        {detailId&&<OrderWizard id={detailId} meta={meta} canEdit={canEdit} canCalculate={canCalculate} canManage={canManage} isAdmin={root} canViewSampleSource={canViewSampleSource} stepAccess={stepAccess} onClose={()=>setDetailId(null)} onChanged={load}/>}
        {factoryOpen&&canManage&&<FactoryModal factories={meta.factories} onClose={()=>setFactoryOpen(false)} onSaved={load}/>}
      </div>

      {!createOpen&&!detailId&&!factoryOpen&&<MobileBottomNav/>}
    </main>
  );
}

function CreateOrderModal({ meta, canViewSampleSource, onClose, onSaved }: { meta: Meta; canViewSampleSource: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [sourceType, setSourceType] = useState<"SAMPLE" | "PRODUCT">(canViewSampleSource ? "SAMPLE" : "PRODUCT");
  const [sourceId, setSourceId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sourceRows = useMemo(() => {
    const key = q.trim().toLowerCase();
    const rows: Array<any> = sourceType === "PRODUCT" ? meta.products : meta.samples;
    if (!key) return rows.slice(0, 100);
    return rows
      .filter((x) => [x.code, x.name, x.slug].some((v) => String(v || "").toLowerCase().includes(key)))
      .slice(0, 100);
  }, [q, sourceType, meta.products, meta.samples]);

  const selected: any = (sourceType === "PRODUCT" ? meta.products : meta.samples).find((x: any) => x.id === sourceId);

  async function save() {
    try {
      setSaving(true);
      setError("");
      if (!sourceId) throw new Error("Chưa chọn mã sản xuất.");
      if (!factoryId) throw new Error("Chưa chọn nhà may.");
      const row = await productionApi<any>("/production/orders", {
        method: "POST",
        body: JSON.stringify({ sourceType, sourceId, productionPartnerId: factoryId, dueDate: dueDate || null }),
      });
      onSaved(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được lệnh.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Tạo lệnh sản xuất" onClose={onClose} wide>
      <div className="space-y-5 p-5">
        {error && <Err x={error} />}
        <div className={`grid gap-2 rounded-2xl bg-neutral-100 p-1 ${canViewSampleSource ? "grid-cols-2" : "grid-cols-1"}`}>
          {canViewSampleSource && <button onClick={() => { setSourceType("SAMPLE"); setSourceId(""); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${sourceType === "SAMPLE" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            Mẫu mới / Triển khai mẫu
          </button>}
          <button onClick={() => { setSourceType("PRODUCT"); setSourceId(""); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${sourceType === "PRODUCT" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            Mã cũ / Danh sách sản phẩm
          </button>
        </div>

        <Field l={sourceType === "PRODUCT" ? "Tìm mã sản phẩm cũ" : "Tìm mẫu triển khai"}>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${input} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gõ mã hoặc tên..." /></div>
        </Field>

        <div className="max-h-64 overflow-y-auto rounded-2xl border">
          {sourceRows.map((row: any) => {
            const code = row.code || row.slug;
            const active = sourceId === row.id;
            return (
              <button key={row.id} type="button" onClick={() => setSourceId(row.id)} className={`flex w-full items-center gap-3 border-b p-3 text-left ${active ? "bg-neutral-950 text-white" : "hover:bg-neutral-50"}`}>
                <div className="h-12 w-10 overflow-hidden rounded-xl bg-neutral-100">{(row.coverImageUrl || row.imageUrl) && <img src={asset(row.coverImageUrl || row.imageUrl)} className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><b>{code}</b><div className={`truncate text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}>{row.name}</div></div>
                {active && <Check className="h-5 w-5" />}
              </button>
            );
          })}
        </div>

        {selected && <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">Đã chọn: <b>{selected.code || selected.slug} · {selected.name}</b></div>}

        <div className="grid gap-4 md:grid-cols-2">
          <Field l="Nhà may / xưởng"><select className={input} value={factoryId} onChange={(e) => setFactoryId(e.target.value)}><option value="">Chọn nhà may</option>{meta.factories.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}</select></Field>
          <Field l="Hạn hoàn thành"><input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>

        <button disabled={saving || !sourceId || !factoryId} onClick={() => void save()} className="w-full rounded-2xl bg-neutral-950 py-3 font-semibold text-white disabled:opacity-40">
          {saving ? "Đang tạo..." : "Tạo lệnh & nhập định mức"}
        </button>
      </div>
    </Modal>
  );
}


type LiningComponentConfig = {
  key: string; name: string; enabled: boolean; consumption: number | string; unit: "G" | "M"; wastePercent: number | string; preset?: boolean;
};

const DEFAULT_LINING_COMPONENTS: LiningComponentConfig[] = [
  { key: "BODY", name: "Lót thân", enabled: false, consumption: "", unit: "G", wastePercent: 0, preset: true },
  { key: "SLEEVE", name: "Lót tay", enabled: false, consumption: "", unit: "G", wastePercent: 0, preset: true },
  { key: "POCKET", name: "Lót túi", enabled: false, consumption: "", unit: "M", wastePercent: 0, preset: true },
  { key: "COLLAR", name: "Lót cổ", enabled: false, consumption: "", unit: "M", wastePercent: 0, preset: true },
];

function normalizeLiningComponentsClient(value:any):LiningComponentConfig[]{
  const saved=Array.isArray(value)?value:[];
  const byKey=new Map(saved.map((x:any)=>[String(x?.key||x?.id||""),x]));
  const presets=DEFAULT_LINING_COMPONENTS.map((base)=>{const old:any=byKey.get(base.key)||{};return {...base,...old,key:base.key,name:base.name,preset:true,unit:String(old?.unit||base.unit).toUpperCase()==="G"?"G":"M"} as LiningComponentConfig;});
  const extras=saved.filter((x:any)=>x?.key&&!DEFAULT_LINING_COMPONENTS.some(p=>p.key===String(x.key))).map((x:any)=>({key:String(x.key),name:String(x.name||"Lót khác"),enabled:x.enabled!==false,consumption:x.consumption??"",unit:String(x.unit||"M").toUpperCase()==="G"?"G":"M",wastePercent:x.wastePercent??0,preset:false} as LiningComponentConfig));
  return [...presets,...extras];
}
function normalizeLiningAssignmentsClient(value:any):Record<string,string[]>{
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,Array.isArray(v)?Array.from(new Set(v.map(x=>String(x)).filter(Boolean))):[]]));
}

function printEsc(v:any){return String(v??"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"} as any)[m]);}
function printWindow(title:string,body:string){const w=window.open("","_blank","width=1000,height=760");if(!w){window.alert("Trình duyệt đang chặn cửa sổ in.");return;}w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${printEsc(title)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111}h1{font-size:20px;margin:0 0 5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin:14px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #222;padding:7px}th{background:#f3f3f3}.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;text-align:center;margin-top:55px}.sign div{padding-top:7px;border-top:1px solid #222}@media print{button{display:none}}</style></head><body><button onclick="window.print()">In phiếu</button>${body}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);}
function printFabricIssue(order:any,rolls:Roll[],selected:Record<string,boolean>,allocated:Record<string,string>,receiver:string,issueDate:string){const picked=rolls.filter(r=>selected[r.id]);if(!picked.length)return;const rows=picked.map((r,i)=>{const m=Number(String(allocated[r.id]??r.remainingM??r.actualM??0).replace(",","."))||0;return `<tr><td>${i+1}</td><td>${printEsc(r.receiptCode||"—")}</td><td>${printEsc(r.fabricCode||r.fabricName||"—")}</td><td>${printEsc(r.rollCode||"—")}</td><td>${printEsc(r.colorName||"—")}</td><td>${fmt(m)} m</td><td>${fmt(r.remainingKg||r.actualKg||0)} kg</td></tr>`}).join("");const totalM=picked.reduce((sum,r)=>sum+(Number(String(allocated[r.id]??r.remainingM??r.actualM??0).replace(",","."))||0),0);printWindow(`Phiếu xuất vải ${order?.code||""}`,`<h1>THE 1970 · PHIẾU XUẤT VẢI</h1><div>Mã lệnh SX: <b>${printEsc(order?.code||"—")}</b></div><div class="grid"><div>Ngày xuất: <b>${printEsc(issueDate||new Date().toLocaleDateString("vi-VN"))}</b></div><div>Người nhận: <b>${printEsc(receiver||"—")}</b></div><div>Mã sản phẩm: <b>${printEsc(order?.sourceCode||order?.source?.code||"—")}</b></div><div>Nhà may / xưởng: <b>${printEsc(order?.factory?.name||"—")}</b></div><div>Tổng mét xuất: <b>${fmt(totalM)} m</b></div><div>Số cây: <b>${picked.length}</b></div></div><table><thead><tr><th>STT</th><th>Phiếu vải</th><th>Mã vải</th><th>Mã cây</th><th>Màu</th><th>Mét xuất</th><th>Kg tham chiếu</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><div>NGƯỜI XUẤT</div><div>NGƯỜI NHẬN</div><div>THỦ KHO / XÁC NHẬN</div></div>`);}
function OrderWizard({ id, meta, canEdit, canCalculate, canManage, isAdmin, canViewSampleSource, stepAccess, onClose, onChanged }: { id: string; meta: Meta; canEdit:boolean; canCalculate:boolean; canManage:boolean; isAdmin:boolean; canViewSampleSource:boolean; stepAccess: Record<1 | 2 | 3 | 4 | 5 | 6, boolean>; onClose: () => void; onChanged: () => void }) {
  void canEdit; void canCalculate; void canManage;
  const [order, setOrder] = useState<any>(null);
  const permittedStepNumbers = ([1,2,3,4,5,6] as const).filter((n) => stepAccess[n]);
  const [step, setStep] = useState<number>(() => permittedStepNumbers[0] || 1);
  const [materials, setMaterials] = useState<MaterialSpec[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [rollQ, setRollQ] = useState("");
  const [showUnavailableRolls, setShowUnavailableRolls] = useState(false);
  const [rollSort, setRollSort] = useState<"NEWEST" | "CODE">("NEWEST");
  const [accessoryQ, setAccessoryQ] = useState("");
  const [accessoryType, setAccessoryType] = useState("ALL");
  const [importingNpl, setImportingNpl] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedAccessoryTemplate[]>([]);
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState("");
  const [lastExcelName, setLastExcelName] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [allocated, setAllocated] = useState<Record<string, string>>({});
  const [liningSelected, setLiningSelected] = useState<Record<string, boolean>>({});
  const [liningAllocated, setLiningAllocated] = useState<Record<string, string>>({});
  const [liningAllocatedKg, setLiningAllocatedKg] = useState<Record<string, string>>({});
  const [sizeSet, setSizeSet] = useState<string[]>([]);
  const [ratio, setRatio] = useState<Record<string, number>>({});
  const [calc, setCalc] = useState<any>(null);
  const [actualCut, setActualCut] = useState<Record<string, string>>({});
  const [extraCosts, setExtraCosts] = useState<ProductionExtraCost[]>([]);
  const [priceMultiplier, setPriceMultiplier] = useState<number | string>(2.2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fabricPrintOpen, setFabricPrintOpen] = useState(false);
  const [fabricPrintReceiver, setFabricPrintReceiver] = useState("");
  const [fabricPrintDate, setFabricPrintDate] = useState(() => new Date().toISOString().slice(0, 10));

  function openFabricPrintForm() {
    const picked = rolls.filter((r) => selected[r.id]);
    if (!picked.length) {
      setError("Chưa chọn cây vải để xuất.");
      return;
    }
    setError("");
    setFabricPrintReceiver(order?.factory?.contactName || order?.factory?.name || "");
    setFabricPrintDate(new Date().toISOString().slice(0, 10));
    setFabricPrintOpen(true);
  }

  function confirmFabricPrint() {
    if (!fabricPrintReceiver.trim()) {
      setError("Phải nhập tên người nhận vải.");
      return;
    }
    const d = fabricPrintDate ? new Date(`${fabricPrintDate}T00:00:00`) : new Date();
    const label = Number.isNaN(d.getTime()) ? fabricPrintDate : d.toLocaleDateString("vi-VN");
    printFabricIssue(order, rolls, selected, allocated, fabricPrintReceiver.trim(), label);
    setFabricPrintOpen(false);
  }

  async function load() {
    try {
      setError("");
      const [o, rollOptions, templateOptions] = await Promise.all([
        productionApi<any>(`/production/orders/${id}`),
        stepAccess[3]
          ? productionApi<Roll[]>(`/production/fabric-rolls?orderId=${encodeURIComponent(id)}`)
          : Promise.resolve([] as Roll[]),
        stepAccess[2]
          ? productionApi<SavedAccessoryTemplate[]>(`/production/accessory-templates`)
          : Promise.resolve([] as SavedAccessoryTemplate[]),
      ]);
      setOrder({ ...o, liningFabricComponents: normalizeLiningComponentsClient(o.liningFabricComponents), liningFabricAssignments: normalizeLiningAssignmentsClient(o.liningFabricAssignments) });
      setExtraCosts(normalizeExtraCosts(o.productionExtraCosts));
      setPriceMultiplier(o.productionPriceMultiplier ?? 2.2);
      setSavedTemplates(templateOptions || []);
      setMaterials((o.accessorySpecs || []).map((x: any) => {
        const accessory = meta.accessories.find((a) => a.id === x.accessoryItemId);
        return { accessoryItemId: x.accessoryItemId, qtyPerProduct: Number(x.qtyPerProduct || 0), wastePercent: Number(x.wastePercent || 0), sizeScoped: isSizeLabelAccessory(accessory) ? true : !!x.sizeScoped, fixedSize: fixedSizeFromNote(x.note), note: stripFixedSizeNote(x.note) || null };
      }));
      setRolls(rollOptions);
      const sel: Record<string, boolean> = {};
      const meters: Record<string, string> = {};
      const liningSel: Record<string, boolean> = {};
      const liningMeters: Record<string, string> = {};
      const liningKg: Record<string, string> = {};
      (o.rolls || []).forEach((x: any) => {
        const role = String(x.fabricRole || "MAIN").toUpperCase();
        if (role === "LINING") { liningSel[x.fabricReceiptRollId] = true; liningMeters[x.fabricReceiptRollId] = String(x.allocatedM ?? ""); liningKg[x.fabricReceiptRollId] = String(x.allocatedKg ?? ""); }
        else { sel[x.fabricReceiptRollId] = true; meters[x.fabricReceiptRollId] = String(x.allocatedM ?? ""); }
      });
      setSelected(sel);
      setAllocated(meters);
      setLiningSelected(liningSel);
      setLiningAllocated(liningMeters);
      setLiningAllocatedKg(liningKg);
      const ss = Array.isArray(o.sizeSet) && o.sizeSet.length ? o.sizeSet : o.productKind === "PANTS" ? PANTS_SIZES : SHIRT_SIZES;
      setSizeSet(ss);
      setRatio(o.sizeRatio && typeof o.sizeRatio === "object" ? o.sizeRatio : Object.fromEntries(ss.map((x: string) => [x, 1])));
      if (o.sizes?.length) {
        const actualDraft: Record<string, string> = {};
        (o.sizes || []).forEach((x: any) => { actualDraft[cutKey(x.colorName, x.size)] = String(x.actualQty ?? x.plannedQty ?? 0); });
        setActualCut(actualDraft);
        const totalPlannedQty = o.sizes.reduce((sum: number, x: any) => sum + Number(x.plannedQty || 0), 0);
        const totalActualQty = o.sizes.reduce((sum: number, x: any) => sum + Number(x.actualQty ?? x.plannedQty ?? 0), 0);
        setCalc({ totalQty: totalPlannedQty, totalPlannedQty, totalActualQty, colors: groupSizes(o.sizes), materials: o.materials || [], lining: o.lining || null, costSummary: o.costSummary || null });
      } else {
        setCalc(null);
        setActualCut({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lệnh.");
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function searchRolls(value: string) {
    setRollQ(value);
    try {
      const rows = await productionApi<Roll[]>(`/production/fabric-rolls?orderId=${encodeURIComponent(id)}&q=${encodeURIComponent(value)}`);
      setRolls(rows);
    } catch {}
  }

  function setMaterialAccessory(index: number, accessoryItemId: string) {
    const accessory = meta.accessories.find((a) => a.id === accessoryItemId);
    const defaultQty = accessory?.specifications?.defaultQtyPerProduct;
    setMaterials((rows) => rows.map((row, i) => i === index ? {
      ...row,
      accessoryItemId,
      sizeScoped: isSizeLabelAccessory(accessory) ? true : row.sizeScoped,
      fixedSize: isSizeLabelAccessory(accessory) ? null : row.fixedSize,
      qtyPerProduct: defaultQty !== null && defaultQty !== undefined && defaultQty !== "" ? viDisplay(defaultQty, 4) : row.qtyPerProduct,
    } : row));
  }

  function applyAccessoryTemplate(key: "JEANS" | "JACKET") {
    const template = ACCESSORY_TEMPLATES[key];
    if (materials.length && !window.confirm("Áp dụng mẫu sẽ thay danh sách NPL hiện tại. Tiếp tục?")) return;
    const rows = buildTemplateMaterials(template, meta.accessories);
    setMaterials(rows);
    setOrder((current: any) => ({ ...current, productKind: template.productKind }));
    setSizeSet([...template.sizes]);
    setRatio(Object.fromEntries(template.sizes.map((size) => [size, 1])));
    setAccessoryQ("");
    setAccessoryType("ALL");
  }

  async function readAccessoryExcel(file: File) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error("File Excel không có sheet dữ liệu.");
    const matrix = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
    const rows = excelAccessoryMaterials(matrix, meta.accessories);
    if (!rows.length) throw new Error("Không đọc được dòng NPL nào. File cần có cột Mã SKU/Tên sản phẩm và Số lượng cho 1 SP.");
    return rows;
  }

  async function importAccessoryExcel(file: File) {
    try {
      setImportingNpl(true);
      setError("");
      const imported = await readAccessoryExcel(file);
      if (materials.length && !window.confirm("Nhập Excel sẽ thay danh sách NPL hiện tại. Tiếp tục?")) return;
      setMaterials(imported);
      setLastExcelName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file Excel NPL.");
    } finally {
      setImportingNpl(false);
    }
  }

  function templatePayloadItems(rows: MaterialSpec[]) {
    return rows.map((row) => {
      const selectedAccessory = meta.accessories.find((a) => a.id === row.accessoryItemId);
      const source = excelSourceSnapshot(row.note);
      return {
        accessoryItemId: selectedAccessory?.id || row.accessoryItemId || null,
        accessoryCodeSnapshot: selectedAccessory?.code || source.code || null,
        accessoryNameSnapshot: selectedAccessory?.name || source.name || null,
        qtyPerProduct: Number(viNumber(row.qtyPerProduct) || 0),
        wastePercent: Number(viNumber(row.wastePercent) || 0),
        sizeScoped: selectedAccessory ? (isSizeLabelAccessory(selectedAccessory) ? true : row.sizeScoped) : row.sizeScoped,
        note: withFixedSizeNote(row.note, row.fixedSize),
      };
    });
  }

  async function saveRowsAsTemplate(rows: MaterialSpec[], sourceType: "CURRENT" | "EXCEL", sourceFileName?: string) {
    if (!rows.length) throw new Error("Chưa có NPL để lưu thành mẫu.");
    const suggested = sourceFileName ? sourceFileName.replace(/\.(xlsx|xls|csv)$/i, "") : "";
    const name = window.prompt("Đặt tên file NPL mẫu:", suggested);
    if (name === null) return;
    if (!name.trim()) throw new Error("Tên mẫu NPL không được để trống.");
    setTemplateBusy(true);
    try {
      const created = await productionApi<SavedAccessoryTemplate>("/production/accessory-templates", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          productKind: order.productKind || "OTHER",
          sourceType,
          sourceFileName: sourceFileName || null,
          items: templatePayloadItems(rows),
        }),
      });
      setSavedTemplates((old) => [created, ...old.filter((x) => x.id !== created.id)]);
      setSelectedSavedTemplateId(created.id);
      setLastExcelName("");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function createTemplateFromExcel(file: File) {
    try {
      setImportingNpl(true);
      setError("");
      const rows = await readAccessoryExcel(file);
      await saveRowsAsTemplate(rows, "EXCEL", file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được mẫu NPL từ Excel.");
    } finally {
      setImportingNpl(false);
    }
  }

  function applySavedTemplate(templateId: string) {
    const template = savedTemplates.find((x) => x.id === templateId);
    if (!template) return;
    if (materials.length && !window.confirm(`Áp dụng mẫu “${template.name}” sẽ thay danh sách NPL hiện tại. Tiếp tục?`)) return;
    const rows: MaterialSpec[] = (template.items || []).map((item) => {
      const byId = item.accessoryItemId ? meta.accessories.find((a) => a.id === item.accessoryItemId) : undefined;
      const accessory = byId || matchImportedAccessory(meta.accessories, item.accessoryCodeSnapshot || "", item.accessoryNameSnapshot || "");
      return {
        accessoryItemId: accessory?.id || "",
        qtyPerProduct: Number(item.qtyPerProduct || 0),
        wastePercent: Number(item.wastePercent || 0),
        sizeScoped: accessory ? (isSizeLabelAccessory(accessory) ? true : !!item.sizeScoped) : !!item.sizeScoped,
        fixedSize: fixedSizeFromNote(item.note),
        note: stripFixedSizeNote(item.note) || `[Mẫu đã lưu] ${template.name} · ${[item.accessoryCodeSnapshot, item.accessoryNameSnapshot].filter(Boolean).join(" · ")}`,
      };
    });
    setMaterials(rows);
    setOrder((current: any) => ({ ...current, productKind: template.productKind || current.productKind }));
    setAccessoryQ("");
    setAccessoryType("ALL");
  }

  function validateMaterialRows() {
    const unresolved = materials.filter((m) => !m.accessoryItemId);
    if (unresolved.length) throw new Error(`Còn ${unresolved.length} dòng NPL từ mẫu/Excel chưa chọn đúng mã trong kho NPL.`);
    const selectedIds = materials.map((m) => m.accessoryItemId).filter(Boolean);
    const duplicateId = selectedIds.find((id, index) => selectedIds.indexOf(id) !== index);
    if (duplicateId) {
      const duplicate = meta.accessories.find((a) => a.id === duplicateId);
      throw new Error(`NPL ${duplicate?.code || ""} · ${duplicate?.name || ""} đang được chọn lặp trong lệnh.`);
    }
    const badFixedSize = materials.find((m) => m.fixedSize && !sizeSet.map(normalizeProductionSize).includes(normalizeProductionSize(m.fixedSize)));
    if (badFixedSize) {
      const a = meta.accessories.find((x) => x.id === badFixedSize.accessoryItemId);
      throw new Error(`NPL ${a?.code || ""} · ${a?.name || ""} đang cố định size ${badFixedSize.fixedSize} nhưng size này không có trong dải size của lệnh.`);
    }
    const badSize = materials.find((m) => {
      const a = meta.accessories.find((x) => x.id === m.accessoryItemId);
      return isSizeLabelAccessory(a) && !accessoryTaggedSize(a);
    });
    if (badSize) {
      const a = meta.accessories.find((x) => x.id === badSize.accessoryItemId);
      throw new Error(`Mác Size ${a?.code || ""} · ${a?.name || ""} chưa được gán size trong kho NPL.`);
    }
  }

  async function saveSpec() {
    try {
      setBusy(true);
      setError("");
      if(!stepAccess[2])throw new Error("Bạn không có quyền thao tác bước 2 · NPL.");
      validateMaterialRows();
      await productionApi(`/production/orders/${id}/spec`, {
        method: "PATCH",
        body: JSON.stringify({
          productKind: order.productKind,
          materials: materials.map((m) => ({
            ...m,
            note: withFixedSizeNote(m.note, m.fixedSize),
            qtyPerProduct: numberOrZero(m.qtyPerProduct),
            wastePercent: numberOrZero(m.wastePercent),
          })),
        }),
      });
      await load();
      goToNextPermitted(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được NPL."); }
    finally { setBusy(false); }
  }

  async function saveRolls() {
    try {
      setBusy(true);
      setError("");
      if(!stepAccess[3]) throw new Error("Bạn không có quyền thao tác bước 3 · Cây vải.");
      const allRolls = await productionApi<Roll[]>(`/production/fabric-rolls?orderId=${encodeURIComponent(id)}`);
      const duplicate = allRolls.find((r) => selected[r.id] && liningSelected[r.id]);
      if (duplicate) throw new Error(`Cây ${duplicate.rollCode || duplicate.id} đang được chọn đồng thời là vải chính và vải lót.`);
      const buildRows=(picked:Record<string,boolean>,metersMap:Record<string,string>,fabricRole:"MAIN"|"LINING",kgMap?:Record<string,string>)=>allRolls.filter((r)=>picked[r.id]).map((r)=>{
        const availableM=Number(r.remainingM||r.actualM||r.supplierDeclaredM||0);
        const availableKg=Number(r.remainingKg||r.actualKg||r.supplierDeclaredKg||0);
        const meters=Number(String(metersMap[r.id]||availableM).replace(",","."));
        if(!meters||meters<=0)throw new Error(`Nhập số mét xuất cho cây ${r.rollCode||r.id}.`);
        if(meters>availableM+0.0001)throw new Error(`Cây ${r.rollCode||r.id} chỉ còn ${fmt(availableM)}m.`);
        const kg=fabricRole==="LINING"?Number(String(kgMap?.[r.id]??availableKg).replace(",",".")):Number(r.remainingKg||0);
        if(fabricRole==="LINING"&&kg<0)throw new Error(`Kg xuất của cây ${r.rollCode||r.id} không hợp lệ.`);
        if(fabricRole==="LINING"&&availableKg>0&&kg>availableKg+0.0001)throw new Error(`Cây ${r.rollCode||r.id} chỉ còn ${fmt(availableKg)}kg.`);
        return {fabricReceiptRollId:r.id,allocatedM:meters,allocatedKg:kg,fabricRole};
      });
      const payload=[...buildRows(selected,allocated,"MAIN"),...buildRows(liningSelected,liningAllocated,"LINING",liningAllocatedKg)];
      if (!payload.some((x)=>x.fabricRole==="MAIN")) throw new Error("Phải chọn ít nhất 1 cây vải chính.");
      await productionApi(`/production/orders/${id}/rolls`, {method:"PATCH",body:JSON.stringify({rolls:payload})});
      await load();
      goToNextPermitted(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được cây vải."); }
    finally { setBusy(false); }
  }

  async function saveSizes() {
    try {
      setBusy(true);
      setError("");
      if(!stepAccess[4])throw new Error("Bạn không có quyền thao tác bước 4 · Size & tỷ lệ.");
      await productionApi(`/production/orders/${id}/spec`, {
        method: "PATCH",
        body: JSON.stringify({
          productKind: order.productKind,
          ...(isAdmin ? {
            fabricConsumptionM: numberOrNull(order.fabricConsumptionM),
            fabricWastePercent: numberOrZero(order.fabricWastePercent),
            liningFabricConsumptionM: numberOrNull(order.liningFabricConsumptionM),
            liningFabricWastePercent: numberOrZero(order.liningFabricWastePercent),
            liningFabricComponents: normalizeLiningComponentsClient(order.liningFabricComponents).map((x)=>({ ...x, consumption:numberOrZero(x.consumption), wastePercent:numberOrZero(x.wastePercent) })),
            liningFabricAssignments: normalizeLiningAssignmentsClient(order.liningFabricAssignments),
          } : {}),
          sizeSet,
          sizeRatio: Object.fromEntries(sizeSet.map((s) => [s, numberOrZero(ratio[s])])),
        }),
      });
      await load();
      goToNextPermitted(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được tỷ lệ size."); }
    finally { setBusy(false); }
  }

  async function calculate() {
    try {
      setBusy(true);
      setError("");
      if(!stepAccess[5])throw new Error("Bạn không có quyền thao tác bước 5 · Tính sản lượng.");

      // Luôn đồng bộ lại cấu hình hiện tại trước khi tính.
      // Như vậy nếu vừa quay về Bước 2 xoá/sửa NPL rồi bấm thẳng Bước 5,
      // backend sẽ RESET danh sách NPL theo đúng những gì đang thấy ở Bước 2,
      // không dùng lại các NPL cũ từ lần tính trước.
      if (stepAccess[2]) {
        validateMaterialRows();
        await productionApi(`/production/orders/${id}/spec`, {
          method: "PATCH",
          body: JSON.stringify({
            productKind: order.productKind,
            materials: materials.map((m) => ({
              ...m,
              qtyPerProduct: numberOrZero(m.qtyPerProduct),
              wastePercent: numberOrZero(m.wastePercent),
            })),
          }),
        });
      }

      // Nếu tài khoản được sửa Bước 4 thì cũng đồng bộ size/tỷ lệ đang hiển thị
      // trước khi tính lại. Định mức vải/hao hụt chỉ Admin/Owner mới được gửi.
      if (stepAccess[4]) {
        await productionApi(`/production/orders/${id}/spec`, {
          method: "PATCH",
          body: JSON.stringify({
            productKind: order.productKind,
            ...(isAdmin ? {
              fabricConsumptionM: numberOrNull(order.fabricConsumptionM),
              fabricWastePercent: numberOrZero(order.fabricWastePercent),
              liningFabricConsumptionM: numberOrNull(order.liningFabricConsumptionM),
              liningFabricWastePercent: numberOrZero(order.liningFabricWastePercent),
              liningFabricComponents: normalizeLiningComponentsClient(order.liningFabricComponents).map((x)=>({ ...x, consumption:numberOrZero(x.consumption), wastePercent:numberOrZero(x.wastePercent) })),
            liningFabricAssignments: normalizeLiningAssignmentsClient(order.liningFabricAssignments),
            } : {}),
            sizeSet,
            sizeRatio: Object.fromEntries(sizeSet.map((s) => [s, numberOrZero(ratio[s])])),
          }),
        });
      }
      const c = await productionApi<any>(`/production/orders/${id}/calculate`, { method: "POST" });
      setCalc(c);
      await load();
      setStep(5);
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tính được sản lượng."); }
    finally { setBusy(false); }
  }

  async function saveActualCuts() {
    try {
      setBusy(true);
      setError("");
      if (!stepAccess[5]) throw new Error("Bạn không có quyền sửa số lượng cắt thực tế ở bước 5.");
      if (!order?.sizes?.length) throw new Error("Chưa có bảng sản lượng dự kiến.");
      const rows = (order.sizes || []).map((x: any) => {
        const raw = actualCut[cutKey(x.colorName, x.size)] ?? String(x.actualQty ?? x.plannedQty ?? 0);
        const value = Number(String(raw).replace(",", "."));
        if (!Number.isInteger(value) || value < 0) throw new Error(`Số cắt thực tế ${x.colorName} · size ${x.size} phải là số nguyên từ 0 trở lên.`);
        return { colorName: x.colorName, size: x.size, actualQty: value };
      });
      const result = await productionApi<any>(`/production/orders/${id}/cut-actual`, { method: "PATCH", body: JSON.stringify({ rows }) });
      setCalc(result);
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được số lượng cắt thực tế."); }
    finally { setBusy(false); }
  }

  async function saveExtraCosts() {
    try {
      setBusy(true);
      setError("");
      if(!isAdmin) throw new Error("Chỉ Admin / Owner được cấu hình chi phí Bước 6.");
      const saved=await productionApi<any>(`/production/orders/${id}/costs`,{
        method:"PATCH",
        body:JSON.stringify({
          items:extraCosts.map(x=>({...x,amountVnd:numberOrZero(x.amountVnd)})),
          priceMultiplier:numberOrZero(priceMultiplier)||2.2,
        }),
      });
      setOrder(saved);
      setExtraCosts(normalizeExtraCosts(saved.productionExtraCosts));
      setPriceMultiplier(saved.productionPriceMultiplier ?? 2.2);
      if(saved?.sizes?.length){
        const totalPlannedQty=(saved.sizes||[]).reduce((sum:number,x:any)=>sum+Number(x.plannedQty||0),0);
        const totalActualQty=(saved.sizes||[]).reduce((sum:number,x:any)=>sum+Number(x.actualQty??x.plannedQty??0),0);
        setCalc({totalQty:totalPlannedQty,totalPlannedQty,totalActualQty,colors:groupSizes(saved.sizes),materials:saved.materials||[],lining:saved.lining||null,costSummary:saved.costSummary||null});
      }
    } catch(e){setError(e instanceof Error?e.message:"Không lưu được phụ phí.");}
    finally{setBusy(false);}
  }

  async function sendOrder() {
    try {
      setBusy(true);
      setError("");
      if(!isAdmin||!stepAccess[6])throw new Error("Chỉ Admin / Owner được thao tác Bước 6.");
      await productionApi(`/production/orders/${id}/send`, { method: "POST" });
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không gửi được lệnh SX."); }
    finally { setBusy(false); }
  }

  if (!order) return <Modal title="Lệnh sản xuất" onClose={onClose} wide><div className="p-8">Đang tải...</div></Modal>;
  if (!permittedStepNumbers.length) return <Modal title={order.code || "Lệnh sản xuất"} onClose={onClose} wide><div className="p-8 text-sm text-neutral-500">Tài khoản chưa được cấp quyền vào bước nào của quy trình sản xuất.</div></Modal>;

  const allSteps = [
    [1, "Chọn mã"], [2, "NPL"], [3, "Cây vải"], [4, "Size & tỷ lệ"], [5, "Tính sản lượng"], [6, "Gửi lệnh SX & Tính giá"],
  ] as const;
  const steps = allSteps.filter(([n]) => stepAccess[n]);
  const stepNumbers = steps.map(([n]) => n);
  const nextStep = (current: number) => stepNumbers.find((n) => n > current);
  const previousStep = (current: number) => [...stepNumbers].reverse().find((n) => n < current);
  const goToNextPermitted = (current: number) => { const n = nextStep(current); if (n) setStep(n); };

  async function goNext() {
    if (busy) return;
    if (step === 1) { goToNextPermitted(1); return; }
    if (step === 2) { await saveSpec(); return; }
    if (step === 3) { await saveRolls(); return; }
    if (step === 4) { await saveSizes(); return; }
    if (step === 5) { if (!calc) await calculate(); const n = nextStep(5); if (calc && n) setStep(n); return; }
  }

  function goBack() {
    if (busy) return;
    const n = previousStep(step);
    if (!n) return;
    setError("");
    setStep(n);
  }

  const visibleRolls = rolls
    .filter((r) => showUnavailableRolls || (!r.isDepleted && Number(r.remainingM || r.actualM || r.supplierDeclaredM || 0) > 0))
    .sort((a, b) => {
      if (rollSort === "NEWEST") {
        const ad = Date.parse(String(a.receivedAt || a.createdAt || "")) || 0;
        const bd = Date.parse(String(b.receivedAt || b.createdAt || "")) || 0;
        if (ad !== bd) return bd - ad;
        // Backend /fabric-rolls hiện trả createdAt DESC, nên giữ thứ tự API khi chưa có timestamp client.
        return rolls.indexOf(a) - rolls.indexOf(b);
      }
      return `${a.receiptCode || ""} ${a.rollCode || ""}`.localeCompare(`${b.receiptCode || ""} ${b.rollCode || ""}`, "vi", { numeric: true });
    });

  const liningComponents = normalizeLiningComponentsClient(order?.liningFabricComponents);
  const enabledLiningComponents = liningComponents.filter((x)=>x.enabled && numberOrZero(x.consumption)>0);
  const liningAssignments = normalizeLiningAssignmentsClient(order?.liningFabricAssignments);
  const liningRollOptions = (order?.rolls || []).filter((x:any)=>String(x.fabricRole||"MAIN").toUpperCase()==="LINING").map((x:any)=>{const source=rolls.find((r)=>r.id===x.fabricReceiptRollId);return {id:String(x.fabricReceiptRollId),rollCode:x.rollCode||source?.rollCode||"Cây",fabricName:source?.fabricName||source?.fabricCode||"Vải lót",colorName:x.colorName||source?.colorName||"—",allocatedM:Number(x.allocatedM||0),allocatedKg:Number(x.allocatedKg||0)};});

  return (
    <Modal title={`${order.code}${order.sourceType === "SAMPLE" && !canViewSampleSource ? "" : ` · ${order.sourceCode}`}`} onClose={onClose} wide>
      <div className="space-y-3 p-3">
        {error && <Err x={error} />}

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex w-max min-w-full gap-1 rounded-2xl bg-neutral-100 p-1">
            {steps.map(([n, label]) => (
              <button key={n} onClick={() => setStep(n)} className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black ${step === n ? "bg-neutral-950 text-white" : "bg-white text-neutral-500"}`}>
                {n}. {label}
              </button>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="rounded-2xl border p-3">
            <div className="flex gap-4">
              <div className="h-28 w-24 overflow-hidden rounded-2xl bg-neutral-100">{(order.sourceType !== "SAMPLE" || canViewSampleSource) && order.sourceImageUrl && <img src={asset(order.sourceImageUrl)} className="h-full w-full object-cover" />}</div>
              <div><div className="text-xs font-semibold text-neutral-400">{order.sourceType === "PRODUCT" ? "Mã cũ từ danh sách sản phẩm" : canViewSampleSource ? "Mẫu từ triển khai mẫu" : "Nguồn mẫu đã ẩn"}</div><h3 className="mt-1 text-xl font-semibold">{order.sourceType === "SAMPLE" && !canViewSampleSource ? "Mẫu triển khai · Đã ẩn theo phân quyền" : `${order.sourceCode} · ${order.sourceName || ""}`}</h3><div className="mt-3 text-sm">Nhà may: <b>{order.factory?.name}</b></div></div>
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => goToNextPermitted(1)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Tiếp →</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Bước 2 chỉ quản lý <b>Nguyên phụ liệu</b>. Định mức vải và hao hụt vải chuyển sang bước 4; khổ vải lấy theo dữ liệu cây vải.</div>

            <div className="rounded-2xl border p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div><b>Nguyên phụ liệu của lệnh này</b><div className="text-xs text-neutral-400">Có thể chọn thủ công, nhập Excel hoặc áp dụng mẫu NPL có sẵn.</div></div>
                <button onClick={() => setMaterials((x) => [...x, { accessoryItemId: "", qtyPerProduct: 1, wastePercent: 0, sizeScoped: false, fixedSize: null }])} className="rounded-xl border px-3 py-2 text-xs font-semibold">+ Thêm NPL</button>
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(240px,1fr)_220px_170px_190px]">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${input} pl-10`} value={accessoryQ} onChange={(e) => setAccessoryQ(e.target.value)} placeholder="Tìm mã, tên, quy cách NPL..." /></div>
                <select className={input} value={accessoryType} onChange={(e) => setAccessoryType(e.target.value)}><option value="ALL">Tất cả phân loại NPL</option>{accessoryTypeOptions(meta.accessories).map((type) => <option key={type} value={type}>{type}</option>)}</select>
                <label className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-semibold ${importingNpl ? "opacity-50" : ""}`}>{importingNpl ? "Đang đọc Excel..." : "↑ Nhập Excel"}<input type="file" accept=".xlsx,.xls,.csv" disabled={importingNpl} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void importAccessoryExcel(file); }} /></label>
                <select className={input} value="" onChange={(e) => { const value = e.target.value as "JEANS" | "JACKET" | ""; if (value) applyAccessoryTemplate(value); }}><option value="">Mẫu hệ thống</option><option value="JEANS">Mẫu · Quần jean</option><option value="JACKET">Mẫu · Áo khoác</option></select>
              </div>
              <div className="mt-2 text-[11px] text-neutral-400">Excel sẽ tự dò kho NPL theo mã SKU trước, sau đó mới dò theo tên. Dòng chưa khớp vẫn được giữ lại để nhân viên chọn đúng mã.</div>

              {lastExcelName && <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-blue-50 p-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between"><div>Đã nhập <b>{lastExcelName}</b>. Có thể lưu luôn danh sách này thành file NPL mẫu.</div><button disabled={templateBusy} onClick={() => void saveRowsAsTemplate(materials, "EXCEL", lastExcelName).catch((e) => setError(e instanceof Error ? e.message : "Không lưu được mẫu NPL."))} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Lưu file này thành mẫu</button></div>}

              <div className="mt-3 rounded-2xl border bg-neutral-50 p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div><b>File NPL mẫu</b><div className="text-xs text-neutral-400">Lưu một bộ phụ kiện để lần sau chỉ chọn mẫu là nạp lại toàn bộ NPL và định mức.</div></div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={templateBusy || !materials.length} onClick={() => void saveRowsAsTemplate(materials, "CURRENT").catch((e) => setError(e instanceof Error ? e.message : "Không lưu được mẫu NPL."))} className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">+ Lưu danh sách hiện tại</button>
                    <label className={`cursor-pointer rounded-xl border bg-white px-3 py-2 text-xs font-semibold ${importingNpl || templateBusy ? "pointer-events-none opacity-40" : ""}`}>↑ Tạo mẫu từ Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void createTemplateFromExcel(file); }} /></label>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[minmax(240px,1fr)_150px]">
                  <select className={input} value={selectedSavedTemplateId} onChange={(e) => setSelectedSavedTemplateId(e.target.value)}><option value="">Chọn file NPL mẫu đã lưu</option>{savedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.sourceType === "EXCEL" ? " · Excel" : ""}</option>)}</select>
                  <button disabled={!selectedSavedTemplateId} onClick={() => applySavedTemplate(selectedSavedTemplateId)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Áp dụng mẫu</button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {materials.map((m, i) => {
                  const selectedAccessory = meta.accessories.find((a) => a.id === m.accessoryItemId);
                  const qtySuffix = selectedAccessory ? `${accessoryUnitLabel(selectedAccessory.unit)}/SP` : "/SP";
                  const sizeTag = accessoryTaggedSize(selectedAccessory);
                  const sourceLabel = materialSourceLabel(m.note);
                  return (
                    <div key={i} className="rounded-2xl bg-neutral-50 p-3">
                      {sourceLabel && <div className="mb-2 text-xs font-semibold text-neutral-500">{sourceLabel}</div>}
                      <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_230px_auto]">
                        <AccessoryCombobox
                          accessories={meta.accessories}
                          value={m.accessoryItemId}
                          onChange={(value) => setMaterialAccessory(i, value)}
                          typeName={accessoryType}
                          globalQuery={accessoryQ}
                        />
                        <ViNumberInput value={m.qtyPerProduct} onChange={(v) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, qtyPerProduct: v } : x))} suffix={qtySuffix} decimals={4} placeholder="VD: 1 hoặc 0,75" />
                        <ViNumberInput value={m.wastePercent} onChange={(v) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, wastePercent: v } : x))} suffix="%" decimals={3} placeholder="Hao hụt" />
                        {isSizeLabelAccessory(selectedAccessory) ? <div className={`flex items-center rounded-2xl px-3 text-xs font-semibold ${sizeTag ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{sizeTag ? `Tự theo size ${sizeTag}` : "Chưa gán size"}</div> : <div className="space-y-1.5"><select className={`${input} py-2 text-xs font-semibold`} value={m.fixedSize ? "FIXED" : m.sizeScoped ? "BY_SIZE" : "ALL"} onChange={(e) => { const mode=e.target.value; setMaterials((rows)=>rows.map((x,j)=>j===i?{...x,sizeScoped:mode==="BY_SIZE",fixedSize:mode==="FIXED"?(x.fixedSize || sizeSet[0] || null):null}:x)); }}><option value="ALL">Không theo size</option><option value="BY_SIZE">Theo tất cả size</option><option value="FIXED">Cố định 1 size</option></select>{m.fixedSize && <select className={`${input} py-2 text-xs font-black`} value={m.fixedSize} onChange={(e)=>setMaterials((rows)=>rows.map((x,j)=>j===i?{...x,fixedSize:e.target.value}:x))}>{sizeSet.map((size)=><option key={size} value={size}>Dùng cho size {size}</option>)}</select>}</div>}
                        <button onClick={() => setMaterials((rows) => rows.filter((_, j) => j !== i))} className="text-xs font-semibold text-red-600">Xoá</button>
                      </div>
                      {selectedAccessory && <div className="mt-2 text-xs text-neutral-500"><b>{selectedAccessory.typeName || "NPL"}</b>{accessorySpecShort(selectedAccessory) ? ` · ${accessorySpecShort(selectedAccessory)}` : ""}{selectedAccessory.specifications?.defaultQtyPerProduct !== null && selectedAccessory.specifications?.defaultQtyPerProduct !== undefined && selectedAccessory.specifications?.defaultQtyPerProduct !== "" ? ` · Mặc định ${viDisplay(selectedAccessory.specifications.defaultQtyPerProduct, 4)} ${accessoryUnitLabel(selectedAccessory.unit)}/SP` : ""}</div>}
                      {!selectedAccessory && sourceLabel && <div className="mt-2 text-xs text-amber-700">Chưa khớp mã NPL. Dùng ô tìm kiếm/phân loại rồi chọn đúng NPL trong kho.</div>}
                    </div>
                  );
                })}
                {!materials.length && <div className="rounded-2xl bg-neutral-50 p-6 text-center text-sm text-neutral-400">Chưa gắn nguyên phụ liệu.</div>}
              </div>
            </div>
            <div className="flex justify-end"><button disabled={busy || !stepAccess[2]} onClick={() => void saveSpec()} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">{nextStep(2) ? "Lưu NPL → Bước tiếp" : "Lưu NPL"}</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_auto]">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${input} pl-10`} value={rollQ} onChange={(e) => void searchRolls(e.target.value)} placeholder="Tìm mã phiếu, mã cây, mã vải, màu, #mã màu..." /></div>
              <select className={input} value={rollSort} onChange={(e) => setRollSort(e.target.value as "NEWEST" | "CODE")}><option value="NEWEST">Mới nhập lên đầu</option><option value="CODE">Theo mã cây</option></select>
              <label className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-semibold"><input type="checkbox" checked={showUnavailableRolls} onChange={(e) => setShowUnavailableRolls(e.target.checked)} /> Hiện cây hết / đã xuất</label>
            </div>
            <div className="text-xs text-neutral-400">Một cây chỉ được chọn cho một vai trò trong lệnh: <b>Vải chính</b> hoặc <b>Vải lót</b>. Vải lót được tính định mức riêng ở Bước 4.</div>

            {[{role:"MAIN" as const,title:"Vải chính",selectedMap:selected,setSelectedMap:setSelected,allocatedMap:allocated,setAllocatedMap:setAllocated},{role:"LINING" as const,title:"Vải lót",selectedMap:liningSelected,setSelectedMap:setLiningSelected,allocatedMap:liningAllocated,setAllocatedMap:setLiningAllocated,kgMap:liningAllocatedKg,setKgMap:setLiningAllocatedKg}].map((section)=> (
              <div key={section.role} className={`rounded-2xl border p-3 ${section.role==="LINING"?"border-blue-200 bg-blue-50/30":"bg-white"}`}>
                <div className="mb-2 flex items-center justify-between gap-3 px-1"><div><b>{section.title}</b><div className="text-[11px] text-neutral-400">{section.role==="MAIN"?"Quyết định số lượng sản phẩm cắt được.":"Đối chiếu đủ/thiếu theo sản lượng của vải chính."}</div></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold">{Object.values(section.selectedMap).filter(Boolean).length} cây</span></div>
                <div className="max-h-[330px] space-y-2 overflow-y-auto rounded-2xl border bg-white p-2">
                  {visibleRolls.map((r) => {
                    const availableM=Number(r.remainingM||r.actualM||r.supplierDeclaredM||0);
                    const disabled=!!r.isDepleted||availableM<=0;
                    const active=!!section.selectedMap[r.id];
                    const usedByOtherRole=section.role==="MAIN"?!!liningSelected[r.id]:!!selected[r.id];
                    const exportM=Number(String(section.allocatedMap[r.id]??"").replace(",","."))||0;
                    const afterM=Math.max(0,availableM-exportM);
                    return (
                      <div key={`${section.role}-${r.id}`} className={`grid items-center gap-3 rounded-2xl border p-3 ${section.role==="LINING"?"md:grid-cols-[auto_1fr_145px_145px_140px]":"md:grid-cols-[auto_1fr_170px_150px]"} ${disabled||usedByOtherRole ? "bg-neutral-100 opacity-60" : active ? "border-neutral-950 bg-neutral-50" : "bg-white"}`}>
                        <input type="checkbox" disabled={disabled||usedByOtherRole||!stepAccess[3]} checked={active} onChange={(e) => section.setSelectedMap({ ...section.selectedMap, [r.id]: e.target.checked })} />
                        <div className="min-w-0 text-sm"><b>{r.receiptCode} · {r.rollCode || "Cây"}</b><div className="mt-1 text-xs text-neutral-500">{r.fabricName || r.fabricCode || "Vải"} · {r.colorName || "—"} {r.colorCode || ""}</div><div className={`mt-1 text-xs font-semibold ${usedByOtherRole?"text-amber-600":r.isDepleted?"text-red-600":r.usingSupplierDeclaredM?"text-amber-600":"text-emerald-700"}`}>{usedByOtherRole?`Đã chọn ở ${section.role==="MAIN"?"Vải lót":"Vải chính"}`:r.isDepleted?"Đã xuất hết":availableM<=0?"Cây chưa có số mét":`Còn ${fmt(availableM)}m · ${fmt(Number(r.remainingKg||r.actualKg||0))}kg${r.usingSupplierDeclaredM?" · dùng mét NCC báo":""}`}</div></div>
                        <div><div className="mb-1 text-[10px] font-semibold uppercase text-neutral-400">Mét xuất</div><input disabled={!active||disabled||usedByOtherRole||!stepAccess[3]} inputMode="decimal" className={input} value={section.allocatedMap[r.id] ?? (active?String(availableM):"")} onChange={(e) => section.setAllocatedMap({ ...section.allocatedMap, [r.id]: e.target.value })} placeholder="Mét" /></div>
                        {section.role==="LINING"&&<div><div className="mb-1 text-[10px] font-semibold uppercase text-neutral-400">Kg xuất</div><input disabled={!active||disabled||usedByOtherRole||!stepAccess[3]} inputMode="decimal" className={input} value={section.kgMap?.[r.id] ?? (active?String(Number(r.remainingKg||r.actualKg||0)):"")} onChange={(e) => section.setKgMap?.({ ...(section.kgMap||{}), [r.id]: e.target.value })} placeholder="Kg" /></div>}
                        <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[10px] font-semibold uppercase text-neutral-400">Còn sau xuất</div><div className="mt-1 font-semibold">{active?fmt(afterM):fmt(availableM)} m</div></div>
                      </div>
                    );
                  })}
                  {!visibleRolls.length && <div className="p-8 text-center text-sm text-neutral-400">Không có cây vải phù hợp bộ lọc.</div>}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={openFabricPrintForm} className="rounded-xl border px-5 py-2.5 text-sm font-semibold">In phiếu xuất vải chính</button><button disabled={busy||!stepAccess[3]} onClick={() => void saveRolls()} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">{nextStep(3) ? "Lưu vải chính + vải lót → Bước tiếp" : "Lưu vải chính + vải lót"}</button></div>
          </div>
        )}

        {step === 4 && (
          <SizeRatioEditor order={order} setOrder={setOrder} sizeSet={sizeSet} setSizeSet={setSizeSet} ratio={ratio} setRatio={setRatio} onNext={() => void saveSizes()} busy={busy||!stepAccess[4]} isAdmin={isAdmin} liningRollOptions={liningRollOptions} />
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="rounded-2xl border p-3"><div className="flex items-center gap-3"><Calculator className="h-6 w-6" /><div><b>Sản lượng cắt dự kiến / thực tế</b><div className="text-xs text-neutral-400">Tính dự kiến từ vải chính. Vải lót chỉ kiểm tra đủ/thiếu theo cấu hình và cây đã gán ở Bước 4.</div></div></div><button disabled={busy||!stepAccess[5]} onClick={() => void calculate()} className="mt-4 w-full rounded-2xl bg-neutral-950 py-3 font-semibold text-white">{calc ? "Tính lại sản lượng" : "Tính sản lượng"}</button></div>
            {calc && <Results c={calc} editable actualCut={actualCut} setActualCut={setActualCut} onSaveActual={() => void saveActualCuts()} busy={busy||!stepAccess[5]} history={order.cutHistory || []} selectedMaterialCount={materials.length} />}
            <div className="flex justify-end"><button type="button" onClick={() => window.open(`/production/print/${id}`, "_blank")} className="rounded-xl border px-5 py-2.5 text-sm font-semibold">Xem / In phiếu sản xuất</button></div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            {calc ? (
              <>
                <ProductionCostCard cost={calc.costSummary || order.costSummary} extraCosts={extraCosts} onExtraCostsChange={setExtraCosts} onSaveExtras={()=>void saveExtraCosts()} priceMultiplier={priceMultiplier} onPriceMultiplierChange={setPriceMultiplier} busy={busy}/>
                <Step6CompactReview calc={calc} order={order}/>
              </>
            ) : <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Chưa có kết quả tính. Quay lại Bước 5 để tính sản lượng trước.</div>}

            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-3"><Send className="h-5 w-5"/><div><b>Gửi lệnh sản xuất</b><div className="text-xs text-neutral-400">Admin duyệt nhanh chi phí và số lượng trước khi gửi nhà may.</div></div></div>
              <div className="mt-3 flex gap-2">
                <button onClick={()=>window.open(`/production/print/${id}`,"_blank")} className="flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold">Xem / In phiếu</button>
                <button disabled={busy||!isAdmin||!calc||order.status==="SENT"} onClick={()=>void sendOrder()} className="flex-1 rounded-xl bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{order.status==="SENT"?"Đã gửi nhà may":"Gửi lệnh SX"}</button>
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 mt-5 border-t bg-white/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={busy || !previousStep(step)}
              onClick={goBack}
              className="min-w-28 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-800 disabled:opacity-30"
            >
              ← Quay lại
            </button>
            <div className="text-center text-[11px] font-black text-neutral-400">
              Bước {step} / 6 · Được cấp {stepNumbers.length}/6 bước
            </div>
            {nextStep(step) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void goNext()}
                className="min-w-28 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {nextStep(step) ? "Lưu & tiếp →" : "Lưu bước này"}
              </button>
            ) : step === 6 ? (
              <button
                type="button"
                disabled={busy || !stepAccess[6] || !calc || order.status === "SENT"}
                onClick={() => void sendOrder()}
                className="min-w-28 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {order.status === "SENT" ? "Đã gửi" : "Gửi lệnh"}
              </button>
            ) : <div className="min-w-28" />}
          </div>
        </div>
      </div>
      {fabricPrintOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4"><div><div className="font-semibold">Thông tin phiếu xuất vải</div><div className="mt-1 text-xs text-neutral-400">Điền thông tin trước khi mở bản in.</div></div><button type="button" onClick={() => setFabricPrintOpen(false)} className="h-9 w-9 rounded-xl border">×</button></div>
            <div className="space-y-4 p-3">
              <Field l="Tên người nhận vải"><input autoFocus className={input} value={fabricPrintReceiver} onChange={(e) => setFabricPrintReceiver(e.target.value)} placeholder="Nhập tên người nhận" /></Field>
              <Field l="Ngày xuất / nhận vải"><input type="date" className={input} value={fabricPrintDate} onChange={(e) => setFabricPrintDate(e.target.value)} /></Field>
              <div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-500">Đã chọn <b className="text-neutral-900">{rolls.filter((r) => selected[r.id]).length}</b> cây vải để in phiếu.</div>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setFabricPrintOpen(false)} className="rounded-xl border px-4 py-3 font-semibold">Huỷ</button><button type="button" onClick={confirmFabricPrint} className="rounded-xl bg-neutral-950 px-4 py-3 font-semibold text-white">Mở phiếu in</button></div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SizeRatioEditor({ order, setOrder, sizeSet, setSizeSet, ratio, setRatio, onNext, busy, isAdmin, liningRollOptions = [] }: any) {
  const preset = order.productKind === "PANTS" ? PANTS_SIZES : SHIRT_SIZES;
  const components = normalizeLiningComponentsClient(order.liningFabricComponents);
  const assignments = normalizeLiningAssignmentsClient(order.liningFabricAssignments);

  function toggle(size: string) {
    if (sizeSet.includes(size)) {
      setSizeSet(sizeSet.filter((x: string) => x !== size));
      const next = { ...ratio }; delete next[size]; setRatio(next);
    } else {
      setSizeSet([...sizeSet, size]);
      setRatio({ ...ratio, [size]: ratio[size] || 1 });
    }
  }

  function updatePart(key: string, patch: Record<string, any>) {
    setOrder({ ...order, liningFabricComponents: components.map((x: any) => x.key === key ? { ...x, ...patch } : x) });
  }

  function toggleAssignedRoll(partKey: string, rollId: string, checked: boolean) {
    const current = assignments[partKey] || [];
    const next = checked ? Array.from(new Set([...current, rollId])) : current.filter((id: string) => id !== rollId);
    setOrder({ ...order, liningFabricAssignments: { ...assignments, [partKey]: next } });
  }

  return (
    <div className="min-w-0 space-y-5">
      {isAdmin && (
        <div className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div className="min-w-0 rounded-3xl border bg-white p-4">
              <div className="mb-3"><b>Vải chính · định mức riêng</b><div className="text-xs text-neutral-400">Dùng để tính số lượng sản phẩm cắt được.</div></div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0"><Field l="Định mức vải chính / SP"><ViNumberInput value={order.fabricConsumptionM ?? ""} onChange={(v) => setOrder({ ...order, fabricConsumptionM: v })} suffix="m" decimals={4} placeholder="VD: 1,5" /></Field></div>
                <div className="min-w-0"><Field l="Hao hụt vải chính"><ViNumberInput value={order.fabricWastePercent ?? 0} onChange={(v) => setOrder({ ...order, fabricWastePercent: v })} suffix="%" decimals={3} placeholder="VD: 3" /></Field></div>
              </div>
            </div>

            <div className="min-w-0 rounded-3xl border border-blue-200 bg-blue-50/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><b>Vải lót · định mức & cây sử dụng</b><div className="mt-1 text-xs text-neutral-500">Khai báo định mức rồi gán ngay cây đã chọn ở Bước 3. Một cây có thể dùng cho nhiều phần lót.</div></div>
                <button type="button" onClick={() => setOrder({ ...order, liningFabricComponents: [...components, { key: `CUSTOM_${Date.now()}`, name: "Lót khác", enabled: true, consumption: "", unit: "M", wastePercent: 0, preset: false }] })} className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-semibold">+ Phần lót khác</button>
              </div>

              <div className="mt-4 min-w-0 space-y-3">
                {components.map((part: any) => {
                  const assigned = assignments[part.key] || [];
                  return (
                    <div key={part.key} className={`min-w-0 rounded-2xl border p-3 ${part.enabled ? "bg-white" : "bg-neutral-50 opacity-70"}`}>
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <label className="flex min-w-0 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!part.enabled} onChange={(e) => updatePart(part.key, { enabled: e.target.checked })} /><span className="truncate">{part.name}</span></label>
                          {part.enabled && <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">Đã gán {assigned.length} cây</span>}
                        </div>

                        {part.enabled && (
                          <>
                            <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(125px,.85fr)_minmax(125px,.8fr)_minmax(105px,.65fr)]">
                              <div className="min-w-0"><Field l="Tên phần lót"><input disabled={part.preset} className={`${input} min-w-0`} value={part.name} onChange={(e) => updatePart(part.key, { name: e.target.value })} /></Field></div>
                              <div className="min-w-0"><Field l="Định mức / SP"><ViNumberInput value={part.consumption ?? ""} onChange={(v) => updatePart(part.key, { consumption: v })} suffix={part.unit === "G" ? "g" : "m"} decimals={part.unit === "G" ? 1 : 4} placeholder={part.unit === "G" ? "VD: 120" : "VD: 0,35"} /></Field></div>
                              <div className="min-w-0"><Field l="Đơn vị"><select className={`${input} min-w-0`} value={part.unit} onChange={(e) => updatePart(part.key, { unit: e.target.value === "G" ? "G" : "M" })}><option value="G">Gram / SP</option><option value="M">Mét / SP</option></select></Field></div>
                              <div className="min-w-0"><Field l="Hao hụt"><ViNumberInput value={part.wastePercent ?? 0} onChange={(v) => updatePart(part.key, { wastePercent: v })} suffix="%" decimals={2} /></Field></div>
                            </div>

                            <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-bold text-neutral-700">Cây vải lót dùng cho {part.name}</div><div className="text-[11px] text-neutral-400">Chọn nhiều cây · một cây có thể dùng cho nhiều phần</div></div>
                              {!liningRollOptions.length ? (
                                <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Chưa có cây Vải lót ở Bước 3.</div>
                              ) : (
                                <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                                  {liningRollOptions.map((r: any) => {
                                    const active = assigned.includes(r.id);
                                    return (
                                      <label key={r.id} className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs ${active ? "border-blue-500 bg-white ring-1 ring-blue-100" : "bg-white"}`}>
                                        <input className="mt-0.5 shrink-0" type="checkbox" checked={active} onChange={(e) => toggleAssignedRoll(part.key, r.id, e.target.checked)} />
                                        <span className="min-w-0"><span className="block truncate font-bold">{r.rollCode} · {r.fabricName}</span><span className="mt-0.5 block truncate text-neutral-500">{r.colorName} · {fmt(r.allocatedM)}m · {fmt(r.allocatedKg)}kg</span></span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {!part.preset && <div className="flex justify-end"><button type="button" className="text-xs font-semibold text-red-600" onClick={() => setOrder({ ...order, liningFabricComponents: components.filter((x: any) => x.key !== part.key), liningFabricAssignments: Object.fromEntries(Object.entries(assignments).filter(([key]) => key !== part.key)) })}>Xoá phần này</button></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400">Chỉ Admin / Owner nhìn thấy và cấu hình định mức. Vải chính quyết định sản lượng; vải lót kiểm tra riêng theo từng phần. Bước 3 chỉ chọn pool cây lót, <b>Bước 4 gán cây cho từng phần</b>, Bước 5 chỉ hiển thị kiểm tra đủ/thiếu.</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2"><button onClick={() => { const next=[...SHIRT_SIZES]; setOrder({ ...order, productKind: "SHIRT" }); setSizeSet(next); setRatio(Object.fromEntries(next.map(x=>[x,1]))); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${order.productKind === "SHIRT" ? "bg-neutral-950 text-white" : "bg-white"}`}>Size áo</button><button onClick={() => { const next=[...PANTS_SIZES]; setOrder({ ...order, productKind: "PANTS" }); setSizeSet(next); setRatio(Object.fromEntries(next.map(x=>[x,1]))); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${order.productKind === "PANTS" ? "bg-neutral-950 text-white" : "bg-white"}`}>Size quần</button></div>
      <div><b>Chọn dải size</b><div className="mt-3 flex flex-wrap gap-2">{preset.map((size) => { const active = sizeSet.includes(size); return <button key={size} onClick={() => toggle(size)} className={`min-w-14 rounded-2xl border px-4 py-3 text-base font-black ${active ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white text-neutral-400"}`}>{size}</button>; })}</div></div>
      <div><b>Tỷ lệ từng size</b><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{sizeSet.map((size: string) => <div key={size} className="rounded-xl border bg-neutral-50 p-2 text-center"><div className="text-lg font-black">{size}</div><input type="number" min="0" className={`${input} mt-2 text-center font-bold`} value={ratio[size] ?? 1} onChange={(e) => setRatio({ ...ratio, [size]: Number(e.target.value || 0) })} /></div>)}</div></div>
      <div className="rounded-2xl bg-neutral-50 p-4 text-sm">Tỷ lệ hiện tại: <b>{sizeSet.map((s: string) => `${s}:${ratio[s] || 0}`).join(" · ") || "Chưa chọn"}</b></div>
      <div className="flex justify-end"><button disabled={busy || !sizeSet.length} onClick={onNext} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Lưu size + vải lót</button></div>
    </div>
  );
}

function cutKey(colorName: string, size: string) {
  return `${String(colorName || "").trim()}|||${normalizeProductionSize(size)}`;
}

function groupSizes(rows: any[]) {
  const m = new Map<string, any>();
  rows.forEach((r) => {
    const key = `${r.colorName}|||${r.colorCode || ""}`;
    const x = m.get(key) || { colorName: r.colorName, colorCode: r.colorCode, plannedQty: 0, actualQty: 0, sizes: {} };
    const plannedQty = Number(r.plannedQty || 0);
    const actualQty = Number(r.actualQty ?? r.plannedQty ?? 0);
    x.sizes[r.size] = { plannedQty, actualQty };
    x.plannedQty += plannedQty;
    x.actualQty += actualQty;
    m.set(key, x);
  });
  return [...m.values()];
}

function Results({ c, editable = false, actualCut = {}, setActualCut, onSaveActual, busy = false, history = [], selectedMaterialCount = 0 }: { c: any; editable?: boolean; actualCut?: Record<string,string>; setActualCut?: (x:Record<string,string>)=>void; onSaveActual?:()=>void; busy?:boolean; history?:any[]; selectedMaterialCount?:number }) {
  const sizes = Array.from(new Set((c.colors || []).flatMap((x: any) => Object.keys(x.sizes || {})))) as string[];
  const totalPlanned = Number(c.totalPlannedQty ?? c.totalQty ?? (c.colors || []).reduce((sum:number,x:any)=>sum+Number(x.plannedQty||0),0));
  const persistedActual = Number(c.totalActualQty ?? (c.colors || []).reduce((sum:number,x:any)=>sum+Number((x.actualQty ?? x.plannedQty) || 0),0));
  const draftActual = editable
    ? (c.colors || []).reduce((sum:number,x:any)=>sum+sizes.reduce((s:number,size:string)=>s+(Number(String(actualCut[cutKey(x.colorName,size)] ?? x.sizes?.[size]?.actualQty ?? x.sizes?.[size]?.plannedQty ?? 0).replace(",","."))||0),0),0)
    : persistedActual;
  const diff=draftActual-totalPlanned;

  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-neutral-100 p-2.5"><div className="text-[9px] font-black uppercase text-neutral-500">Dự kiến</div><div className="mt-0.5 text-lg font-black">{totalPlanned}</div></div>
      <div className="rounded-xl bg-blue-50 p-2.5 text-blue-900"><div className="text-[9px] font-black uppercase text-blue-600">Thực tế</div><div className="mt-0.5 text-lg font-black">{draftActual}</div></div>
      <div className={`rounded-xl p-2.5 ${diff===0?"bg-neutral-100":diff>0?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800"}`}><div className="text-[9px] font-black uppercase">Lệch</div><div className="mt-0.5 text-lg font-black">{diff>0?"+":""}{diff}</div></div>
    </div>

    {c.lining?.enabled&&<div className="rounded-2xl border border-blue-200 bg-blue-50/20 p-3">
      <div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black uppercase text-blue-700">Kiểm tra vải lót</div><div className="mt-0.5 text-[11px] text-neutral-500">Theo {draftActual} SP thực tế</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${c.lining.enoughForActual?"bg-emerald-700 text-white":"bg-red-600 text-white"}`}>{c.lining.enoughForActual?"ĐỦ LÓT":"THIẾU LÓT"}</span></div>
      <div className="mt-2 space-y-2">{(c.lining.components||[]).map((part:any)=>{const unit=part.unit==="G"?"g":"m";return <div key={part.key} className={`rounded-xl border bg-white p-2.5 ${!part.assigned?"border-amber-300":Number(part.groupShortageActual)>0?"border-red-300":"border-emerald-200"}`}>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-black">{part.name}</div><div className="mt-0.5 text-[10px] text-neutral-500">Cần {fmt(part.requiredActual)} {unit} · {fmt(part.consumption)} {unit}/SP</div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${!part.assigned?"bg-amber-100 text-amber-800":Number(part.groupShortageActual)>0?"bg-red-100 text-red-700":"bg-emerald-100 text-emerald-700"}`}>{!part.assigned?"CHƯA GÁN":Number(part.groupShortageActual)>0?`THIẾU ${fmt(part.groupShortageActual)}${unit}`:"ĐỦ"}</span></div>
        <div className="mt-1 text-[10px] text-neutral-500">Cây: {(part.rolls||[]).length?(part.rolls||[]).map((r:any)=>r.rollCode||"Cây").join(", "):"—"}</div>
      </div>})}</div>
    </div>}

    <div className="space-y-2">
      {(c.colors||[]).map((x:any)=>{
        const actualTotal=sizes.reduce((sum:number,size:string)=>sum+(Number(String(actualCut[cutKey(x.colorName,size)] ?? x.sizes?.[size]?.actualQty ?? x.sizes?.[size]?.plannedQty ?? 0).replace(",","."))||0),0);
        return <div key={`${x.colorName}-${x.colorCode||""}`} className="rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between"><div className="text-sm font-black">{x.colorName} {x.colorCode||""}</div><div className="text-[11px]"><span className="text-neutral-400">DK {x.plannedQty}</span> · <b className="text-blue-700">TT {actualTotal}</b></div></div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">{sizes.map((size:string)=>{const cell=x.sizes?.[size]||{plannedQty:0,actualQty:0};const key=cutKey(x.colorName,size);return <div key={size} className="rounded-xl bg-neutral-50 p-2 text-center">
            <div className="text-[10px] font-black">{size}</div>
            <div className="mt-0.5 text-[9px] text-neutral-400">DK {cell.plannedQty||0}</div>
            {editable?<input type="number" min="0" step="1" className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-1 py-1.5 text-center text-sm font-black text-blue-900" value={actualCut[key]??String(cell.actualQty??cell.plannedQty??0)} onChange={(e)=>setActualCut?.({...actualCut,[key]:e.target.value})}/>:<div className="mt-1 text-sm font-black text-blue-800">{cell.actualQty??cell.plannedQty??0}</div>}
          </div>})}</div>
        </div>
      })}
    </div>

    {editable&&<button disabled={busy} onClick={onSaveActual} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Lưu thực tế & tính lại NPL</button>}

    <div className="rounded-2xl border bg-white">
      <div className="flex items-center justify-between border-b px-3 py-2.5"><div className="text-xs font-black">NPL cần xuất</div><div className="text-[10px] text-neutral-400">{selectedMaterialCount} NPL · {(c.materials||[]).length} dòng</div></div>
      <div>{(c.materials||[]).map((m:any,i:number)=><div key={i} className="border-b p-3 last:border-b-0">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-xs"><span className="text-neutral-400">{m.accessoryCode}</span> · <b>{m.accessoryName}</b></div>{m.sizeLabel&&<span className="mt-1 inline-flex rounded-md bg-neutral-950 px-1.5 py-0.5 text-[9px] font-black text-white">SIZE {m.sizeLabel}</span>}</div><div className="shrink-0 text-right"><div className="text-xs font-black">{fmt(m.requiredQty)}</div><div className={`text-[9px] font-bold ${Number(m.shortageQty)>0?"text-red-600":"text-emerald-600"}`}>{Number(m.shortageQty)>0?`Thiếu ${fmt(m.shortageQty)}`:"Đủ"}</div></div></div>
        <div className="mt-1 text-[10px] text-neutral-400">ĐM {fmt(m.qtyPerProduct)} · hao hụt {fmt(m.wastePercent)}%</div>
      </div>)}</div>
    </div>

    {!!history.length&&<details className="rounded-2xl border bg-white"><summary className="cursor-pointer px-3 py-2.5 text-xs font-black">Lịch sử thay đổi cắt ({history.length})</summary><div className="max-h-64 overflow-y-auto border-t">{history.map((h:any)=><div key={h.id} className="border-b p-2.5 text-[10px] last:border-b-0"><b>{h.colorName} · {h.size}</b> · DK {h.plannedQty} · TT {h.previousActualQty??"—"} → <b className="text-blue-700">{h.actualQty??"—"}</b><div className="mt-0.5 text-neutral-400">{h.createdAt?new Date(h.createdAt).toLocaleString("vi-VN"):"—"} · {h.createdByName||"Hệ thống"}</div></div>)}</div></details>}
  </div>;
}


function moneyVnd(value:any) {
  const n=Number(value||0);
  return `${new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(Number.isFinite(n)?n:0)}đ`;
}

type ProductionExtraCost = {
  id: string;
  type: string;
  label: string;
  amountVnd: number | string;
  note?: string | null;
};

const EXTRA_COST_PRESETS = [
  {type:"WORKSHOP_BUY",label:"Xưởng mua hộ / thanh toán hộ"},
  {type:"INTERLINING",label:"Mex / dựng / phụ liệu xưởng mua"},
  {type:"FABRIC_DELIVERY",label:"Xe vận chuyển giao vải"},
  {type:"EXTRA_ACCESSORY",label:"Phụ liệu phát sinh khác"},
  {type:"OTHER",label:"Phụ phí khác"},
];

function normalizeExtraCosts(value:any): ProductionExtraCost[] {
  const rows=(Array.isArray(value)?value:[]).map((x:any,index:number)=>({
    id:String(x?.id||`EXTRA_${index+1}`),
    type:String(x?.type||"OTHER").toUpperCase(),
    label:String(x?.label||"Phụ phí khác"),
    amountVnd:x?.amountVnd??0,
    note:x?.note||null,
  }));
  if(!rows.some(x=>x.type==="FACTORY_LABOR")){
    rows.unshift({id:"FACTORY_LABOR",type:"FACTORY_LABOR",label:"Gia công nhà may / SP",amountVnd:"",note:null});
  }
  return rows;
}

function compactNplSummary(calc:any) {
  const rows=Array.isArray(calc?.materials)?calc.materials:[];
  const shortage=rows.filter((x:any)=>Number(x.shortageQty||0)>0);
  return {rows,shortage};
}


function ProductionCostCard({cost,extraCosts,onExtraCostsChange,onSaveExtras,priceMultiplier=2.2,onPriceMultiplierChange,busy=false}:{cost:any;extraCosts?:ProductionExtraCost[];onExtraCostsChange?:(x:ProductionExtraCost[])=>void;onSaveExtras?:()=>void;priceMultiplier?:number|string;onPriceMultiplierChange?:(x:number|string)=>void;busy?:boolean}) {
  if(!cost) return <div className="rounded-2xl border bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có dữ liệu giá sản xuất.</div>;
  if(cost.canView===false) return <div className="rounded-2xl border bg-neutral-50 p-4 text-sm text-neutral-500">Chỉ Admin / Owner có quyền xem giá sản xuất.</div>;

  const extras=extraCosts??normalizeExtraCosts(cost.extraCosts);
  const laborRow=extras.find(x=>x.type==="FACTORY_LABOR");
  const laborPerProduct=Number(String(laborRow?.amountVnd||0).replace(/[^\d.]/g,""))||0;
  const otherExtras=extras.filter(x=>x.type!=="FACTORY_LABOR");
  const otherExtraTotal=otherExtras.reduce((s,x)=>s+(Number(String(x.amountVnd||0).replace(/[^\d.]/g,""))||0),0);
  const qty=Number(cost.totalActualQty||0);
  const laborTotal=laborPerProduct*qty;
  const base=Number(cost.baseMaterialCostVnd??(Number(cost.mainFabricCostVnd||0)+Number(cost.liningFabricCostVnd||0)+Number(cost.accessoryCostVnd||0)));
  const total=base+laborTotal+otherExtraTotal;
  const perProduct=qty>0?total/qty:null;
  const multiplier=Math.max(0.1,Number(String(priceMultiplier||2.2).replace(",","."))||2.2);
  const estimatedSalePrice=perProduct===null?null:perProduct*multiplier;
  const missing=Number(cost.missingPriceCount||0);

  function patchRow(id:string,patch:Partial<ProductionExtraCost>){
    onExtraCostsChange?.(extras.map(x=>x.id===id?{...x,...patch}:x));
  }
  function addPreset(preset=EXTRA_COST_PRESETS[0]){
    onExtraCostsChange?.([...extras,{id:`EXTRA_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,type:preset.type,label:preset.label,amountVnd:"",note:null}]);
  }

  return <div className="rounded-3xl border-2 border-neutral-950 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs font-black uppercase tracking-[.12em] text-neutral-500">Chi phí sản xuất</div>
        <div className="mt-1 text-2xl font-black">{perProduct===null?"—":moneyVnd(perProduct)} <span className="text-sm font-bold text-neutral-400">/ SP</span></div>
        <div className="mt-1 text-xs text-neutral-500">Chia theo <b>{cost.totalActualQty||0}</b> sản phẩm cắt thực tế.</div>
      </div>
      <div className={`rounded-full px-3 py-1 text-xs font-black ${missing?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-700"}`}>{missing?`Thiếu giá ${missing} mục`:"Đủ giá"}</div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <div className="rounded-2xl bg-neutral-100 p-3"><div className="text-[10px] font-black uppercase text-neutral-400">Vải chính</div><div className="mt-1 text-base font-black">{moneyVnd(cost.mainFabricCostVnd)}</div></div>
      <div className="rounded-2xl bg-blue-50 p-3"><div className="text-[10px] font-black uppercase text-blue-500">Vải lót</div><div className="mt-1 text-base font-black">{moneyVnd(cost.liningFabricCostVnd)}</div></div>
      <div className="rounded-2xl bg-neutral-100 p-3"><div className="text-[10px] font-black uppercase text-neutral-400">NPL</div><div className="mt-1 text-base font-black">{moneyVnd(cost.accessoryCostVnd)}</div></div>
      <div className="rounded-2xl bg-amber-50 p-3"><div className="text-[10px] font-black uppercase text-amber-600">Gia công + phụ phí</div><div className="mt-1 text-base font-black">{moneyVnd(laborTotal+otherExtraTotal)}</div></div>
    </div>

    <div className="mt-3 rounded-2xl bg-neutral-950 p-4 text-white">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-white/70">TỔNG GIÁ GỐC SẢN XUẤT</span><b className="text-xl">{moneyVnd(total)}</b></div>
    </div>

    <div className="mt-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">Giá bán ước tính</div>
          <div className="mt-1 text-2xl font-black text-emerald-900">{estimatedSalePrice===null?"—":moneyVnd(estimatedSalePrice)} <span className="text-xs font-bold text-emerald-700">/ SP</span></div>
          <div className="mt-1 text-[11px] text-emerald-800">Giá gốc/SP × hệ số</div>
        </div>
        <label className="text-right">
          <span className="block text-[10px] font-black uppercase text-emerald-700">Hệ số giá bán</span>
          <div className="mt-1 flex items-center gap-1">
            <button type="button" onClick={()=>onPriceMultiplierChange?.(Math.max(0.1,Math.round((multiplier-0.1)*10)/10))} className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300 bg-white font-black">−</button>
            <input inputMode="decimal" className="h-9 w-20 rounded-xl border border-emerald-300 bg-white px-2 text-center text-sm font-black" value={priceMultiplier} onChange={e=>onPriceMultiplierChange?.(e.target.value)} onBlur={()=>onPriceMultiplierChange?.(Math.max(0.1,Math.round(multiplier*10)/10))}/>
            <button type="button" onClick={()=>onPriceMultiplierChange?.(Math.round((multiplier+0.1)*10)/10)} className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300 bg-white font-black">+</button>
          </div>
        </label>
      </div>
    </div>

    {onExtraCostsChange&&<div className="mt-4 rounded-2xl border p-3">
      <div className="rounded-2xl bg-blue-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><b>Gia công nhà may / SP</b><div className="text-[11px] text-neutral-500">Mặc định có sẵn. Nhập đơn giá gia công cho 1 sản phẩm.</div></div>
          <div className="relative w-44"><input inputMode="numeric" className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 pr-8 text-right text-base font-black" value={laborRow?.amountVnd??""} onChange={e=>laborRow&&patchRow(laborRow.id,{amountVnd:e.target.value.replace(/[^\d]/g,"")})} placeholder="0"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">đ</span></div>
        </div>
        <div className="mt-2 text-right text-[11px] text-blue-700">Tổng gia công: <b>{moneyVnd(laborTotal)}</b> / {qty||0} SP</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div><b>Phụ phí / phát sinh khác</b><div className="text-[11px] text-neutral-400">Mex xưởng mua hộ, xe giao vải, phụ liệu phát sinh, khoản thanh toán hộ...</div></div>
        <select className="rounded-xl border bg-white px-3 py-2 text-xs font-bold" defaultValue="" onChange={(e)=>{const p=EXTRA_COST_PRESETS.find(x=>x.type===e.target.value);if(p)addPreset(p);e.currentTarget.value=""}}>
          <option value="">+ Thêm phụ phí</option>
          {EXTRA_COST_PRESETS.map(x=><option key={x.type} value={x.type}>{x.label}</option>)}
        </select>
      </div>
      <div className="mt-3 space-y-2">
        {!otherExtras.length&&<div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-400">Chưa có phụ phí phát sinh khác.</div>}
        {otherExtras.map(row=><div key={row.id} className="grid gap-2 rounded-xl bg-neutral-50 p-2.5 sm:grid-cols-[minmax(180px,1fr)_160px_minmax(160px,1fr)_auto]">
          <input className="min-w-0 rounded-xl border bg-white px-3 py-2 text-sm font-semibold" value={row.label} onChange={e=>patchRow(row.id,{label:e.target.value})} placeholder="Tên khoản phí"/>
          <div className="relative"><input inputMode="numeric" className="w-full rounded-xl border bg-white px-3 py-2 pr-8 text-sm font-black" value={row.amountVnd} onChange={e=>patchRow(row.id,{amountVnd:e.target.value.replace(/[^\d]/g,"")})} placeholder="0"/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">đ</span></div>
          <input className="min-w-0 rounded-xl border bg-white px-3 py-2 text-sm" value={row.note||""} onChange={e=>patchRow(row.id,{note:e.target.value})} placeholder="Ghi chú / ai mua hộ..."/>
          <button type="button" onClick={()=>onExtraCostsChange(extras.filter(x=>x.id!==row.id))} className="rounded-xl px-3 py-2 text-xs font-black text-red-600">Xoá</button>
        </div>)}
      </div>
      <div className="mt-3 flex justify-end"><button disabled={busy} onClick={onSaveExtras} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">Lưu phụ phí & tính lại giá</button></div>
    </div>}

    {missing>0&&<div className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">Giá/SP hiện là <b>tạm tính</b> vì còn {missing} mục chưa có đơn giá.</div>}

    <details className="mt-3 rounded-2xl border">
      <summary className="cursor-pointer px-3 py-3 text-xs font-black">Chi tiết cấu thành giá</summary>
      <div className="border-t">
        {(cost.fabricLines||[]).map((x:any,i:number)=><div key={`f-${i}`} className="flex items-start justify-between gap-3 border-b p-3 text-xs last:border-b-0"><div><b>{x.role==="LINING"?"Vải lót":"Vải chính"} · {x.fabricName||x.fabricCode||"Vải"}</b><div className="mt-0.5 text-neutral-400">{x.rollCode||x.receiptCode||"Cây"} · {fmt(x.usedM)}m · {fmt(x.usedKg)}kg</div></div><div className={`text-right font-black ${x.missingPrice?"text-amber-600":""}`}>{x.missingPrice?"Chưa giá":moneyVnd(x.costVnd)}</div></div>)}
        {(cost.accessoryLines||[]).map((x:any,i:number)=><div key={`a-${i}`} className="flex items-start justify-between gap-3 border-b p-3 text-xs last:border-b-0"><div><b>{x.accessoryCode} · {x.accessoryName}</b>{x.sizeLabel&&<span className="ml-1 rounded bg-neutral-950 px-1.5 py-0.5 text-[9px] text-white">SIZE {x.sizeLabel}</span>}<div className="mt-0.5 text-neutral-400">{fmt(x.requiredQty)} × {x.unitPriceVnd==null?"chưa có giá":moneyVnd(x.unitPriceVnd)}</div></div><div className={`text-right font-black ${x.missingPrice?"text-amber-600":""}`}>{x.missingPrice?"Chưa giá":moneyVnd(x.costVnd)}</div></div>)}
      </div>
    </details>
  </div>;
}

function Step6CompactReview({calc,order}:{calc:any;order:any}) {
  const {rows,shortage}=compactNplSummary(calc);
  return <div className="rounded-2xl border bg-white">
    <div className="grid grid-cols-3 divide-x border-b">
      <div className="p-3"><div className="text-[10px] font-black uppercase text-neutral-400">Cắt thực tế</div><div className="mt-1 text-lg font-black">{calc?.totalActualQty||0}</div></div>
      <div className="p-3"><div className="text-[10px] font-black uppercase text-neutral-400">NPL</div><div className="mt-1 text-lg font-black">{rows.length}</div></div>
      <div className="p-3"><div className="text-[10px] font-black uppercase text-neutral-400">Thiếu NPL</div><div className={`mt-1 text-lg font-black ${shortage.length?"text-red-600":"text-emerald-600"}`}>{shortage.length}</div></div>
    </div>
    <details>
      <summary className="cursor-pointer px-3 py-3 text-xs font-black">Xem nhanh NPL ({rows.length})</summary>
      <div className="max-h-72 overflow-y-auto border-t">
        {rows.map((m:any,i:number)=><div key={i} className="flex items-center justify-between gap-3 border-b p-2.5 text-xs last:border-b-0"><div className="min-w-0 truncate"><span className="text-neutral-400">{m.accessoryCode}</span> · <b>{m.accessoryName}</b>{m.sizeLabel&&<span className="ml-1 rounded bg-neutral-950 px-1.5 py-0.5 text-[9px] text-white">SIZE {m.sizeLabel}</span>}</div><div className={`shrink-0 font-black ${Number(m.shortageQty)>0?"text-red-600":"text-emerald-600"}`}>{fmt(m.requiredQty)}{Number(m.shortageQty)>0?` · thiếu ${fmt(m.shortageQty)}`:""}</div></div>)}
      </div>
    </details>
  </div>;
}

function FactoryModal({ factories, onClose, onSaved }: { factories: FactoryItem[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: "", code: "", contactName: "", phone: "" });
  const [error, setError] = useState("");
  async function save() {
    try {
      await productionApi("/production/factories", { method: "POST", body: JSON.stringify(f) });
      setF({ name: "", code: "", contactName: "", phone: "" });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tạo được nhà may."); }
  }
  return <Modal title="Nhà may / xưởng" onClose={onClose}><div className="grid gap-5 p-5 md:grid-cols-2"><div className="max-h-96 overflow-y-auto rounded-2xl border">{factories.map((x) => <div key={x.id} className="border-b p-3 text-sm"><b>{x.code} · {x.name}</b><div className="text-xs text-neutral-400">{x.contactName || ""} {x.phone || ""}</div></div>)}</div><div className="space-y-3">{error && <Err x={error} />}<Field l="Tên"><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field l="Mã"><input className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Tự sinh nếu trống" /></Field><Field l="Liên hệ"><input className={input} value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></Field><Field l="SĐT"><input className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field><button onClick={() => void save()} className="w-full rounded-xl bg-neutral-950 py-2.5 font-semibold text-white">Tạo nhà may</button></div></div></Modal>;
}


function accessoryUnitLabel(unit: string) {
  const labels: Record<string, string> = {
    PIECE: "cái",
    METER: "m",
    ROLL: "cuộn",
    SET: "bộ",
    KG: "kg",
    PACK: "gói",
    BOX: "hộp",
    OTHER: "đv",
  };
  return labels[unit] || unit || "đv";
}

function accessorySpecShort(a: Accessory) {
  const s = a.specifications || {};
  if (a.typeName === "Khóa Kéo") {
    return [
      s.teethType || (String(s.teethMaterial || "").startsWith("Răng") ? s.teethMaterial : ""),
      s.zipperGauge,
      s.lengthCm ? `${viDisplay(s.lengthCm, 3)}cm` : "",
      s.surfaceFinish,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (a.typeName === "Cúc") {
    return [
      s.material,
      s.diameterMm ? `Ø${viDisplay(s.diameterMm, 3)}mm` : "",
      s.surfaceFinish,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (String(a.typeName || "").startsWith("Mác")) {
    return [
      a.typeName === "Mác Size" && s.sizeKind ? (s.sizeKind === "PANTS" ? "Size quần" : "Size áo") : "",
      a.typeName === "Mác Size" && s.size ? `Size ${normalizeProductionSize(s.size)}` : "",
      s.material,
      s.widthCm && s.heightCm ? `${viDisplay(s.widthCm, 3)}×${viDisplay(s.heightCm, 3)}cm` : "",
      s.foldStyle || s.foldType,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [s.material, s.color, s.customSpec].filter(Boolean).join(" · ");
}

type AccessoryTemplateSlot = {
  label: string;
  qty: number;
  typeName?: string;
  keywords?: string[];
  sizeKind?: "SHIRT" | "PANTS";
  expandSizes?: boolean;
};

const ACCESSORY_TEMPLATES: Record<"JEANS" | "JACKET", { label: string; productKind: "SHIRT" | "PANTS"; sizes: string[]; slots: AccessoryTemplateSlot[] }> = {
  JEANS: {
    label: "Quần jean",
    productKind: "PANTS",
    sizes: PANTS_SIZES,
    slots: [
      { label: "Thẻ bài", qty: 1, keywords: ["thẻ bài"] },
      { label: "Dây treo thẻ bài", qty: 1, keywords: ["dây", "thẻ bài"] },
      { label: "Tem mã vạch", qty: 2, keywords: ["tem", "mã vạch"] },
      { label: "Mác vải hướng dẫn sử dụng", qty: 1, keywords: ["hướng dẫn", "sử dụng"] },
      { label: "Mác da", qty: 1, keywords: ["mác da"] },
      { label: "Khuy quần jean", qty: 1, typeName: "Cúc", keywords: ["quần", "jean"] },
      { label: "Chân đinh xoáy", qty: 1, keywords: ["chân", "đinh", "xoáy"] },
      { label: "Mác size quần", qty: 1, typeName: "Mác Size", sizeKind: "PANTS", expandSizes: true },
      { label: "Chân đinh thẳng", qty: 1, keywords: ["chân", "đinh", "thẳng"] },
      { label: "Đinh tán", qty: 1, keywords: ["đinh", "tán"] },
    ],
  },
  JACKET: {
    label: "Áo khoác",
    productKind: "SHIRT",
    sizes: SHIRT_SIZES,
    slots: [
      { label: "Dây treo thẻ bài", qty: 1, keywords: ["dây", "thẻ bài"] },
      { label: "Thẻ bài", qty: 1, keywords: ["thẻ bài"] },
      { label: "Mác vải hướng dẫn sử dụng", qty: 1, keywords: ["hướng dẫn", "sử dụng"] },
      { label: "Mác size áo", qty: 1, typeName: "Mác Size", sizeKind: "SHIRT", expandSizes: true },
      { label: "Tem mã vạch", qty: 2, keywords: ["tem", "mã vạch"] },
      { label: "Khóa áo thân trước", qty: 1, typeName: "Khóa Kéo", keywords: ["thân"] },
      { label: "Khóa túi", qty: 2, typeName: "Khóa Kéo", keywords: ["túi"] },
      { label: "Cúc áo", qty: 1, typeName: "Cúc", keywords: ["cúc", "áo"] },
      { label: "Cúc cài", qty: 1, typeName: "Cúc", keywords: ["cài"] },
      { label: "Cúc bấm", qty: 1, typeName: "Cúc", keywords: ["bấm"] },
      { label: "Chun gấu áo", qty: 1, typeName: "Chun", keywords: ["gấu"] },
      { label: "Dây rút", qty: 1, typeName: "Dây Rút" },
    ],
  },
};

function normalizeSearchText(value: any) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeProductionSize(value: any) {
  const size = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  return size === "2XL" ? "XXL" : size;
}

function isSizeLabelAccessory(a?: Accessory | null) {
  return String(a?.typeName || "").trim() === "Mác Size";
}

function accessoryTaggedSize(a?: Accessory | null) {
  if (!isSizeLabelAccessory(a)) return "";
  const explicit = normalizeProductionSize(a?.specifications?.size || a?.specifications?.sizeLabel);
  if (explicit) return explicit;
  const name = String(a?.name || "").trim().toUpperCase();
  const matched = name.match(/(?:^|[-–—\s])((?:2?X?XL)|XS|S|M|L|29|30|31|32|34|36)\s*$/i);
  return matched?.[1] ? normalizeProductionSize(matched[1]) : "";
}

function accessorySizeKind(a?: Accessory | null) {
  const explicit = String(a?.specifications?.sizeKind || "").toUpperCase();
  if (explicit === "SHIRT" || explicit === "PANTS") return explicit;
  const size = accessoryTaggedSize(a);
  if (PANTS_SIZES.includes(size)) return "PANTS";
  if (SHIRT_SIZES.includes(size)) return "SHIRT";
  return "";
}

function accessoryTypeOptions(accessories: Accessory[]) {
  return Array.from(new Set(accessories.map((a) => String(a.typeName || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi"));
}

function accessoryHaystack(a: Accessory) {
  return normalizeSearchText([a.code, a.name, a.typeName, accessorySpecShort(a)].filter(Boolean).join(" "));
}

function filteredAccessories(accessories: Accessory[], query: string, typeName: string, selectedId?: string) {
  const q = normalizeSearchText(query);
  return accessories.filter((a) => {
    if (a.id === selectedId) return true;
    if (typeName !== "ALL" && a.typeName !== typeName) return false;
    if (q && !accessoryHaystack(a).includes(q)) return false;
    return true;
  });
}

function accessoryOptionLabel(a?: Accessory | null) {
  if (!a) return "";
  const spec = accessorySpecShort(a);
  return `${a.code} · ${a.name}${spec ? ` · ${spec}` : ""}`;
}

function AccessoryCombobox({ accessories, value, onChange, typeName = "ALL", globalQuery = "" }: {
  accessories: Accessory[];
  value: string;
  onChange: (value: string) => void;
  typeName?: string;
  globalQuery?: string;
}) {
  const selected = accessories.find((a) => a.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const global = normalizeSearchText(globalQuery);
  const local = normalizeSearchText(query);
  const options = accessories
    .filter((a) => {
      if (a.id === value) return true;
      if (typeName !== "ALL" && a.typeName !== typeName) return false;
      const haystack = accessoryHaystack(a);
      if (global && !haystack.includes(global)) return false;
      if (local && !haystack.includes(local)) return false;
      return true;
    })
    .slice(0, 80);

  return (
    <div className="relative min-w-0">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" />
        <input
          className={`${input} pl-10 pr-9`}
          value={open ? query : accessoryOptionLabel(selected)}
          onFocus={() => { setQuery(""); setOpen(true); }}
          onClick={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder="Gõ mã / tên NPL để tìm..."
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setQuery(""); setOpen(true); }}
            title="Bỏ chọn NPL"
          >×</button>
        ) : null}
      </div>
      {open && (
        <div className="absolute z-[90] mt-1 max-h-72 w-full min-w-[520px] overflow-y-auto rounded-2xl border bg-white p-1 shadow-2xl">
          {options.length ? options.map((a) => {
            const active = a.id === value;
            return (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(a.id); setQuery(""); setOpen(false); }}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm ${active ? "bg-neutral-950 text-white" : "hover:bg-neutral-100"}`}
              >
                <div className="font-semibold">{a.code} · {a.name}</div>
                <div className={`mt-0.5 text-[11px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                  {a.typeName || "NPL"}{accessorySpecShort(a) ? ` · ${accessorySpecShort(a)}` : ""}
                  {Number(a.stockQty || 0) >= 0 ? ` · Tồn ${fmt(a.stockQty || 0)} ${accessoryUnitLabel(a.unit)}` : ""}
                </div>
              </button>
            );
          }) : (
            <div className="px-3 py-5 text-center text-xs text-neutral-400">Không tìm thấy NPL phù hợp.</div>
          )}
        </div>
      )}
    </div>
  );
}

const FIXED_SIZE_NOTE_RE = /\[\[FIXED_SIZE:([^\]]+)\]\]/i;
function fixedSizeFromNote(note?: string | null) {
  const matched=String(note||"").match(FIXED_SIZE_NOTE_RE);
  return matched?.[1] ? normalizeProductionSize(matched[1]) : null;
}
function stripFixedSizeNote(note?: string | null) {
  return String(note||"").replace(FIXED_SIZE_NOTE_RE, "").replace(/\s{2,}/g," ").trim();
}
function withFixedSizeNote(note?: string | null, fixedSize?: string | null) {
  const clean=stripFixedSizeNote(note);
  const size=fixedSize ? normalizeProductionSize(fixedSize) : "";
  return [size ? `[[FIXED_SIZE:${size}]]` : "", clean].filter(Boolean).join(" ") || null;
}

function materialSourceLabel(note?: string | null) {
  const raw = stripFixedSizeNote(note);
  if (raw.startsWith("[Mẫu]")) return raw;
  if (raw.startsWith("[Excel]")) return raw;
  return "";
}

function excelSourceSnapshot(note?: string | null) {
  const raw = stripFixedSizeNote(note);
  const text = raw.replace(/^\[(Excel|Mẫu|Mẫu đã lưu)\]\s*/i, "");
  const parts = text.split(" · ").map((x) => x.trim()).filter(Boolean);
  return { code: parts[0] || "", name: parts.slice(1).join(" · ") || "" };
}

function matchTemplateAccessory(accessories: Accessory[], slot: AccessoryTemplateSlot, size?: string) {
  let candidates = accessories.filter((a) => !slot.typeName || a.typeName === slot.typeName);
  if (slot.sizeKind && size) {
    candidates = candidates.filter((a) => {
      const specs = a.specifications || {};
      return isSizeLabelAccessory(a) && accessorySizeKind(a) === slot.sizeKind && accessoryTaggedSize(a) === normalizeProductionSize(size);
    });
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  const keywords = (slot.keywords || []).map(normalizeSearchText).filter(Boolean);
  if (!keywords.length) return candidates.length === 1 ? candidates[0] : undefined;
  const strong = candidates.filter((a) => { const h = accessoryHaystack(a); return keywords.every((k) => h.includes(k)); });
  return strong.length === 1 ? strong[0] : undefined;
}

function buildTemplateMaterials(template: { label: string; productKind: "SHIRT" | "PANTS"; sizes: string[]; slots: AccessoryTemplateSlot[] }, accessories: Accessory[]): MaterialSpec[] {
  const rows: MaterialSpec[] = [];
  for (const slot of template.slots) {
    if (slot.expandSizes && slot.sizeKind) {
      for (const size of template.sizes) {
        const accessory = matchTemplateAccessory(accessories, slot, size);
        rows.push({ accessoryItemId: accessory?.id || "", qtyPerProduct: slot.qty, wastePercent: 0, sizeScoped: true, fixedSize: null, note: `[Mẫu] ${template.label} · ${slot.label} ${size}` });
      }
      continue;
    }
    const accessory = matchTemplateAccessory(accessories, slot);
    rows.push({ accessoryItemId: accessory?.id || "", qtyPerProduct: slot.qty, wastePercent: 0, sizeScoped: false, fixedSize: null, note: `[Mẫu] ${template.label} · ${slot.label}` });
  }
  return rows;
}

function findHeaderColumn(headers: any[], variants: string[]) {
  const normalized = headers.map(normalizeSearchText);
  for (const variant of variants) {
    const key = normalizeSearchText(variant);
    const exact = normalized.findIndex((x) => x === key);
    if (exact >= 0) return exact;
  }
  for (const variant of variants) {
    const key = normalizeSearchText(variant);
    const fuzzy = normalized.findIndex((x) => !!x && (x.includes(key) || key.includes(x)));
    if (fuzzy >= 0) return fuzzy;
  }
  return -1;
}

function matchImportedAccessory(accessories: Accessory[], code: string, name: string) {
  const codeKey = String(code || "").trim().toUpperCase();
  if (codeKey) {
    const exactCode = accessories.find((a) => String(a.code || "").trim().toUpperCase() === codeKey);
    if (exactCode) return exactCode;
  }
  const nameKey = normalizeSearchText(name);
  if (!nameKey) return undefined;
  const exactName = accessories.filter((a) => normalizeSearchText(a.name) === nameKey);
  if (exactName.length === 1) return exactName[0];
  const contained = accessories.filter((a) => { const n = normalizeSearchText(a.name); return n.includes(nameKey) || nameKey.includes(n); });
  return contained.length === 1 ? contained[0] : undefined;
}

function excelAccessoryMaterials(matrix: any[][], accessories: Accessory[]): MaterialSpec[] {
  let headerRow = -1;
  let codeCol = -1;
  let nameCol = -1;
  let qtyCol = -1;
  for (let i = 0; i < Math.min(matrix.length, 20); i += 1) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    const c = findHeaderColumn(row, ["Mã SKU", "SKU", "Mã NPL"]);
    const n = findHeaderColumn(row, ["Tên sản phẩm", "Tên NPL", "Tên phụ kiện"]);
    const q = findHeaderColumn(row, ["Số lượng cho 1 SP", "Số lượng 1 SP", "Định mức", "SL 1 SP"]);
    if ((c >= 0 || n >= 0) && q >= 0) { headerRow = i; codeCol = c; nameCol = n; qtyCol = q; break; }
  }
  if (headerRow < 0 || qtyCol < 0) return [];

  const out: MaterialSpec[] = [];
  for (let i = headerRow + 1; i < matrix.length; i += 1) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    const code = codeCol >= 0 ? String(row[codeCol] || "").trim() : "";
    const name = nameCol >= 0 ? String(row[nameCol] || "").trim() : "";
    const qty = viNumber(row[qtyCol]);
    if ((!code && !name) || qty === null || qty <= 0) continue;
    const accessory = matchImportedAccessory(accessories, code, name);
    out.push({
      accessoryItemId: accessory?.id || "",
      qtyPerProduct: qty,
      wastePercent: 0,
      sizeScoped: isSizeLabelAccessory(accessory),
      fixedSize: null,
      note: `[Excel] ${[code, name].filter(Boolean).join(" · ")}`,
    });
  }
  return out;
}

function numberOrNull(v: any) {
  const n = viNumber(v);
  return n === null ? null : n;
}

function numberOrZero(v: any) {
  const n = viNumber(v);
  return n === null ? 0 : n;
}

function viNumber(v:any){const raw=String(v??"").trim().replace(/\s/g,"").replace(",",".");const n=Number(raw);return Number.isFinite(n)?n:null}
function viDisplay(v:any,decimals=4){if(v===null||v===undefined||v==="")return "";const n=viNumber(v);if(n===null)return String(v);return n.toLocaleString("vi-VN",{maximumFractionDigits:decimals,useGrouping:false})}
function ViNumberInput({value,onChange,suffix,decimals=4,placeholder=""}:{value:any;onChange:(v:string)=>void;suffix:string;decimals?:number;placeholder?:string}){return <div className="relative"><input inputMode="decimal" className={`${input} pr-12`} value={String(value??"")} placeholder={placeholder} onChange={e=>onChange(e.target.value.replace(/[^0-9,.-]/g,""))} onBlur={()=>onChange(viDisplay(value,decimals))}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">{suffix}</span></div>}
function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{l}</span>{children}</label>;
}
function Err({ x }: { x: string }) { return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{x}</div>; }
function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const [viewport,setViewport]=useState<{height:number;top:number}>(()=>({height:typeof window==="undefined"?800:window.innerHeight,top:0}));

  useEffect(()=>{
    const vv=window.visualViewport;
    const sync=()=>setViewport({height:vv?.height||window.innerHeight,top:vv?.offsetTop||0});
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    sync();
    vv?.addEventListener("resize",sync);
    vv?.addEventListener("scroll",sync);
    window.addEventListener("orientationchange",sync);
    return()=>{document.body.style.overflow=previous;vv?.removeEventListener("resize",sync);vv?.removeEventListener("scroll",sync);window.removeEventListener("orientationchange",sync)};
  },[]);

  return <div className="fixed left-0 right-0 z-[80] overflow-y-auto overscroll-contain bg-black/45 px-2"
    style={{top:viewport.top,height:viewport.height,paddingTop:"max(12px, env(safe-area-inset-top))",paddingBottom:"max(12px, env(safe-area-inset-bottom))",WebkitOverflowScrolling:"touch"}}>
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[26px] bg-white shadow-2xl">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-3 py-3">
        <h2 className="min-w-0 truncate pr-2 text-sm font-black">{title}</h2>
        <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg">×</button>
      </div>
      {children}
    </div>
  </div>;
}

