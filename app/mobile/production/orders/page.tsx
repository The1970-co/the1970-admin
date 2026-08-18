"use client";

import { useEffect, useMemo, useState } from "react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import {
  ArrowLeft,
  Calculator,
  Check,
  Factory,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shirt,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

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
  remainingM: number;
  remainingKg: number;
  isDepleted?: boolean;
  missingActual?: boolean;
  imageUrl?: string | null;
};
type Accessory = {
  id: string;
  code: string;
  name: string;
  typeName?: string;
  unit: string;
  stockQty?: number;
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
  factory?: FactoryItem | null;
  source?: { type: string; id?: string; code: string; name?: string | null; imageUrl?: string | null };
};

type MaterialSpec = {
  accessoryItemId: string;
  qtyPerProduct: number | string;
  wastePercent: number | string;
  sizeScoped: boolean;
  note?: string | null;
};

const SHIRT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const PANTS_SIZES = ["28", "29", "30", "31", "32", "33", "34", "36", "38"];
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
  "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-neutral-900";

export default function Page() {
  const [meta, setMeta] = useState<Meta>({ samples: [], products: [], factories: [], accessories: [], rolls: [] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(84px+env(safe-area-inset-bottom))] text-neutral-950">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[max(24px,calc(env(safe-area-inset-top)+8px))] backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/mobile/production" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100"><ArrowLeft className="h-5 w-5"/></Link>
              <div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Sản xuất</div><h1 className="truncate text-xl font-black">Lệnh sản xuất</h1></div>
            </div>
            <button onClick={() => void load()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100"><RefreshCw className="h-4 w-4"/></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setFactoryOpen(true)} className="rounded-2xl border bg-white px-3 py-3 text-xs font-black"><Factory className="mr-1 inline h-4 w-4"/>Nhà may</button>
            <button onClick={() => setCreateOpen(true)} className="rounded-2xl bg-neutral-950 px-3 py-3 text-xs font-black text-white"><Plus className="mr-1 inline h-4 w-4"/>Tạo lệnh SX</button>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">Chọn mã → định mức & NPL → cây vải → size → tính sản lượng → gửi lệnh.</p>
        </header>
        <div className="space-y-4 p-4">
          {error && <Err x={error} />}

      <div className="grid gap-3">
        {orders.map((o) => (
          <div key={o.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="flex gap-4 p-4">
              <div className="h-24 w-20 overflow-hidden rounded-2xl bg-neutral-100">
                {(o.source?.imageUrl || o.sourceImageUrl) && (
                  <img src={asset(o.source?.imageUrl || o.sourceImageUrl)} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-neutral-400">{o.code} · {o.sourceType === "PRODUCT" ? "Mã cũ" : "Mẫu mới"}</div>
                <div className="mt-1 text-lg font-semibold">{o.sourceCode} · {o.sourceName || o.source?.name}</div>
                <div className="mt-2 text-sm">Nhà may: <b>{o.factory?.name || "—"}</b></div>
                <div className="mt-1 text-xs font-semibold text-neutral-500">{STATUS_LABEL[o.status] || o.status}</div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t p-3">
              <span className="text-xs text-neutral-400">Định mức, NPL, vải và size nằm trong lệnh này</span>
              <button onClick={() => setDetailId(o.id)} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">
                Mở quy trình
              </button>
            </div>
          </div>
        ))}
      </div>

      {!orders.length && <div className="rounded-3xl border bg-white p-12 text-center text-sm text-neutral-400">Chưa có lệnh sản xuất.</div>}

      {createOpen && (
        <CreateOrderModal
          meta={meta}
          onClose={() => setCreateOpen(false)}
          onSaved={async (id) => {
            setCreateOpen(false);
            await load();
            setDetailId(id);
          }}
        />
      )}
      {detailId && <OrderWizard id={detailId} meta={meta} onClose={() => setDetailId(null)} onChanged={load} />}
          {factoryOpen && <FactoryModal factories={meta.factories} onClose={() => setFactoryOpen(false)} onSaved={load} />}
        </div>
      </div>
      {!createOpen && !detailId && !factoryOpen && <MobileBottomNav />}
    </main>
  );
}

function CreateOrderModal({ meta, onClose, onSaved }: { meta: Meta; onClose: () => void; onSaved: (id: string) => void }) {
  const [sourceType, setSourceType] = useState<"SAMPLE" | "PRODUCT">("SAMPLE");
  const [sourceId, setSourceId] = useState(() => meta.samples?.[0]?.id || "");
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1">
          <button onClick={() => { setSourceType("SAMPLE"); setSourceId(meta.samples?.[0]?.id || ""); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${sourceType === "SAMPLE" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            Mẫu mới / Triển khai mẫu
          </button>
          <button onClick={() => { setSourceType("PRODUCT"); setSourceId(meta.products?.[0]?.id || ""); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${sourceType === "PRODUCT" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
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

        <div className="grid gap-3">
          <Field l="Nhà may / xưởng"><select className={input} value={factoryId} onChange={(e) => setFactoryId(e.target.value)}><option value="">Chọn nhà may</option>{meta.factories.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}</select></Field>
          <Field l="Hạn hoàn thành"><input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>

        {!sourceId && <div className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Chọn một mã sản xuất ở danh sách phía trên.</div>}
        {!factoryId && <div className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Chọn nhà may / xưởng để tạo lệnh.</div>}
        <button disabled={saving || !sourceId || !factoryId} onClick={() => void save()} className="w-full rounded-2xl bg-neutral-950 py-3.5 text-sm font-black text-white disabled:bg-neutral-300 disabled:text-neutral-500 disabled:opacity-100">
          {saving ? "Đang tạo..." : "Tạo lệnh & nhập định mức"}
        </button>
      </div>
    </Modal>
  );
}

function OrderWizard({ id, meta, onClose, onChanged }: { id: string; meta: Meta; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [step, setStep] = useState(2);
  const [materials, setMaterials] = useState<MaterialSpec[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [rollQ, setRollQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [allocated, setAllocated] = useState<Record<string, string>>({});
  const [sizeSet, setSizeSet] = useState<string[]>([]);
  const [ratio, setRatio] = useState<Record<string, number>>({});
  const [calc, setCalc] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setError("");
      const [o, rollOptions] = await Promise.all([
        productionApi<any>(`/production/orders/${id}`),
        productionApi<Roll[]>(`/production/fabric-rolls?orderId=${encodeURIComponent(id)}`),
      ]);
      setOrder(o);
      setMaterials((o.accessorySpecs || []).map((x: any) => ({ accessoryItemId: x.accessoryItemId, qtyPerProduct: Number(x.qtyPerProduct || 0), wastePercent: Number(x.wastePercent || 0), sizeScoped: !!x.sizeScoped, note: x.note || null })));
      setRolls(rollOptions);
      const sel: Record<string, boolean> = {};
      const meters: Record<string, string> = {};
      (o.rolls || []).forEach((x: any) => { sel[x.fabricReceiptRollId] = true; meters[x.fabricReceiptRollId] = String(x.allocatedM ?? ""); });
      setSelected(sel);
      setAllocated(meters);
      const ss = Array.isArray(o.sizeSet) && o.sizeSet.length ? o.sizeSet : o.productKind === "PANTS" ? ["29", "30", "31", "32", "34", "36"] : ["S", "M", "L", "XL"];
      setSizeSet(ss);
      setRatio(o.sizeRatio && typeof o.sizeRatio === "object" ? o.sizeRatio : Object.fromEntries(ss.map((x: string) => [x, 1])));
      if (o.sizes?.length) setCalc({ totalQty: o.sizes.reduce((sum: number, x: any) => sum + Number(x.plannedQty || 0), 0), colors: groupSizes(o.sizes), materials: o.materials || [] });
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

  async function saveSpec() {
    try {
      setBusy(true);
      setError("");
      await productionApi(`/production/orders/${id}/spec`, {
        method: "PATCH",
        body: JSON.stringify({
          productKind: order.productKind,
          fabricWidthCm: order.fabricWidthCm,
          fabricConsumptionM: order.fabricConsumptionM,
          fabricWastePercent: order.fabricWastePercent,
          sizeSet,
          sizeRatio: ratio,
          materials,
        }),
      });
      await load();
      setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được định mức."); }
    finally { setBusy(false); }
  }

  async function saveRolls() {
    try {
      setBusy(true);
      setError("");
      const allRolls = await productionApi<Roll[]>(`/production/fabric-rolls?orderId=${encodeURIComponent(id)}`);
      const selectedRows = allRolls.filter((r) => selected[r.id]);
      await productionApi(`/production/orders/${id}/rolls`, {
        method: "PATCH",
        body: JSON.stringify({ rolls: selectedRows.map((r) => ({ fabricReceiptRollId: r.id, allocatedM: allocated[r.id] || r.remainingM, allocatedKg: r.remainingKg })) }),
      });
      await load();
      setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được cây vải."); }
    finally { setBusy(false); }
  }

  async function saveSizes() {
    try {
      setBusy(true);
      setError("");
      await productionApi(`/production/orders/${id}/spec`, {
        method: "PATCH",
        body: JSON.stringify({
          productKind: order.productKind,
          fabricWidthCm: order.fabricWidthCm,
          fabricConsumptionM: order.fabricConsumptionM,
          fabricWastePercent: order.fabricWastePercent,
          sizeSet,
          sizeRatio: Object.fromEntries(sizeSet.map((s) => [s, Number(ratio[s] || 0)])),
          materials,
        }),
      });
      await load();
      setStep(5);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được tỷ lệ size."); }
    finally { setBusy(false); }
  }

  async function calculate() {
    try {
      setBusy(true);
      setError("");
      const c = await productionApi<any>(`/production/orders/${id}/calculate`, { method: "POST" });
      setCalc(c);
      await load();
      setStep(6);
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tính được sản lượng."); }
    finally { setBusy(false); }
  }

  async function sendOrder() {
    try {
      setBusy(true);
      setError("");
      await productionApi(`/production/orders/${id}/send`, { method: "POST" });
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Không gửi được lệnh SX."); }
    finally { setBusy(false); }
  }

  if (!order) return <Modal title="Lệnh sản xuất" onClose={onClose} wide><div className="p-8">Đang tải...</div></Modal>;

  const steps = [
    [1, "Chọn mã"], [2, "Định mức & NPL"], [3, "Cây vải"], [4, "Size & tỷ lệ"], [5, "Tính sản lượng"], [6, "Gửi lệnh SX"],
  ] as const;

  async function goNext() {
    if (busy || step >= 6) return;
    if (step === 1) { setStep(2); return; }
    if (step === 2) { await saveSpec(); return; }
    if (step === 3) { await saveRolls(); return; }
    if (step === 4) { await saveSizes(); return; }
    if (step === 5) { await calculate(); return; }
  }

  function goBack() {
    if (busy || step <= 1) return;
    setError("");
    setStep((current) => Math.max(1, current - 1));
  }

  return (
    <Modal title={`${order.code} · ${order.sourceCode}`} onClose={onClose} wide>
      <div className="space-y-5 p-5">
        {error && <Err x={error} />}

        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[900px] grid-cols-6 gap-2 rounded-2xl bg-neutral-100 p-1">
            {steps.map(([n, label]) => (
              <button key={n} onClick={() => setStep(n)} className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${step === n ? "bg-neutral-950 text-white" : "bg-white text-neutral-500"}`}>
                {n}. {label}
              </button>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="rounded-3xl border p-5">
            <div className="flex gap-4">
              <div className="h-28 w-24 overflow-hidden rounded-2xl bg-neutral-100">{order.sourceImageUrl && <img src={asset(order.sourceImageUrl)} className="h-full w-full object-cover" />}</div>
              <div><div className="text-xs font-semibold text-neutral-400">{order.sourceType === "PRODUCT" ? "Mã cũ từ danh sách sản phẩm" : "Mẫu từ triển khai mẫu"}</div><h3 className="mt-1 text-xl font-semibold">{order.sourceCode} · {order.sourceName}</h3><div className="mt-3 text-sm">Nhà may: <b>{order.factory?.name}</b></div></div>
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => setStep(2)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Tiếp: Định mức & NPL →</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field l="Loại sản phẩm"><select className={input} value={order.productKind || "OTHER"} onChange={(e) => setOrder({ ...order, productKind: e.target.value })}><option value="SHIRT">Áo</option><option value="PANTS">Quần</option><option value="OTHER">Khác</option></select></Field>
              <Field l="Định mức vải / sp"><ViNumberInput value={order.fabricConsumptionM ?? ""} onChange={(v) => setOrder({ ...order, fabricConsumptionM: v })} suffix="m" decimals={4} placeholder="VD: 1,5" /></Field>
              <Field l="Khổ vải"><ViNumberInput value={order.fabricWidthCm ?? ""} onChange={(v) => setOrder({ ...order, fabricWidthCm: v })} suffix="cm" decimals={2} placeholder="VD: 155" /></Field>
              <Field l="Hao hụt vải"><ViNumberInput value={order.fabricWastePercent ?? 0} onChange={(v) => setOrder({ ...order, fabricWastePercent: v })} suffix="%" decimals={3} placeholder="VD: 3" /></Field>
            </div>

            <div className="rounded-3xl border p-4">
              <div className="flex items-center justify-between"><div><b>Nguyên phụ liệu của lệnh này</b><div className="text-xs text-neutral-400">Chọn NPL đã tạo sẵn và nhập định mức / sản phẩm.</div></div><button onClick={() => setMaterials((x) => [...x, { accessoryItemId: "", qtyPerProduct: 1, wastePercent: 0, sizeScoped: false }])} className="rounded-xl border px-3 py-2 text-xs font-semibold">+ Thêm NPL</button></div>
              <div className="mt-3 space-y-2">
                {materials.map((m, i) => (
                  <div key={i} className="grid gap-2 rounded-2xl bg-neutral-50 p-3 grid-cols-1">
                    <select className={input} value={m.accessoryItemId} onChange={(e) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, accessoryItemId: e.target.value } : x))}><option value="">Chọn NPL</option>{meta.accessories.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
                    <input type="number" step="0.001" className={input} value={m.qtyPerProduct} onChange={(e) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, qtyPerProduct: e.target.value } : x))} placeholder="SL/sp" />
                    <input type="number" className={input} value={m.wastePercent} onChange={(e) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, wastePercent: e.target.value } : x))} placeholder="Hao hụt %" />
                    <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={m.sizeScoped} onChange={(e) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, sizeScoped: e.target.checked } : x))} /> Theo size</label>
                    <button onClick={() => setMaterials((rows) => rows.filter((_, j) => j !== i))} className="text-xs font-semibold text-red-600">Xoá</button>
                  </div>
                ))}
                {!materials.length && <div className="rounded-2xl bg-neutral-50 p-6 text-center text-sm text-neutral-400">Chưa gắn nguyên phụ liệu.</div>}
              </div>
            </div>
            <div className="flex justify-end"><button disabled={busy} onClick={() => void saveSpec()} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">Lưu định mức → Chọn cây vải</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${input} pl-10`} value={rollQ} onChange={(e) => void searchRolls(e.target.value)} placeholder="Tìm mã phiếu, mã cây, mã vải, màu, #mã màu..." /></div>
            <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-2xl border p-2">
              {rolls.map((r) => {
                const disabled = !!r.isDepleted || !!r.missingActual;
                const active = !!selected[r.id];
                return (
                  <div key={r.id} className={`grid items-center gap-3 rounded-2xl border p-3 grid-cols-[auto_1fr] ${disabled ? "bg-neutral-100 opacity-60" : active ? "border-neutral-950 bg-neutral-50" : "bg-white"}`}>
                    <input type="checkbox" disabled={disabled} checked={active} onChange={(e) => setSelected({ ...selected, [r.id]: e.target.checked })} />
                    <div className="min-w-0 text-sm"><b>{r.receiptCode} · {r.rollCode || "Cây"}</b><div className="mt-1 text-xs text-neutral-500">{r.fabricName || r.fabricCode || "Vải"} · {r.colorName || "—"} {r.colorCode || ""}</div><div className={`mt-1 text-xs font-semibold ${r.isDepleted ? "text-red-600" : r.missingActual ? "text-amber-600" : "text-emerald-700"}`}>{r.isDepleted ? "Đã xuất hết" : r.missingActual ? "Chưa nhập mét thực nhận" : `Còn ${fmt(r.remainingM)}m / ${fmt(r.remainingKg)}kg`}</div></div>
                    <input disabled={!active || disabled} type="number" step="0.001" className={input} value={allocated[r.id] ?? String(r.remainingM || "")} onChange={(e) => setAllocated({ ...allocated, [r.id]: e.target.value })} placeholder="Mét xuất" />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end"><button disabled={busy} onClick={() => void saveRolls()} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">Lưu cây vải → Chọn size</button></div>
          </div>
        )}

        {step === 4 && (
          <SizeRatioEditor order={order} setOrder={setOrder} sizeSet={sizeSet} setSizeSet={setSizeSet} ratio={ratio} setRatio={setRatio} onNext={() => void saveSizes()} busy={busy} />
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="rounded-3xl border p-5"><div className="flex items-center gap-3"><Calculator className="h-6 w-6" /><div><b>Tính sản lượng cắt và nguyên phụ liệu</b><div className="text-xs text-neutral-400">Dựa trên cây vải đã chọn, định mức, hao hụt và tỷ lệ size.</div></div></div><button disabled={busy} onClick={() => void calculate()} className="mt-4 w-full rounded-2xl bg-neutral-950 py-3 font-semibold text-white">Tính sản lượng & NPL</button></div>
            {calc && <Results c={calc} />}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            {calc ? <Results c={calc} /> : <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Chưa có kết quả tính. Quay lại bước 5 để tính sản lượng.</div>}
            <div className="rounded-3xl border p-5"><div className="flex items-center gap-3"><Send className="h-6 w-6" /><div><b>Gửi lệnh sản xuất</b><div className="text-xs text-neutral-400">Sau khi gửi, cây vải và kế hoạch size/NPL được dùng làm snapshot cho lệnh này.</div></div></div><div className="mt-4 flex gap-2"><button onClick={() => window.open(`/production/print/${id}`, "_blank")} className="flex-1 rounded-2xl border px-4 py-3 font-semibold">Xem / In phiếu</button><button disabled={busy || !calc || order.status === "SENT"} onClick={() => void sendOrder()} className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 font-semibold text-white disabled:opacity-40">{order.status === "SENT" ? "Đã gửi nhà may" : "Gửi lệnh SX"}</button></div></div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 mt-5 border-t bg-white/95 px-5 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={busy || step <= 1}
              onClick={goBack}
              className="min-w-28 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-800 disabled:opacity-30"
            >
              ← Quay lại
            </button>
            <div className="text-center text-[11px] font-black text-neutral-400">
              Bước {step} / 6
            </div>
            {step < 6 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void goNext()}
                className="min-w-28 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                Tiếp →
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !calc || order.status === "SENT"}
                onClick={() => void sendOrder()}
                className="min-w-28 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {order.status === "SENT" ? "Đã gửi" : "Gửi lệnh"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SizeRatioEditor({ order, setOrder, sizeSet, setSizeSet, ratio, setRatio, onNext, busy }: any) {
  const preset = order.productKind === "PANTS" ? PANTS_SIZES : SHIRT_SIZES;
  function toggle(size: string) {
    if (sizeSet.includes(size)) {
      setSizeSet(sizeSet.filter((x: string) => x !== size));
      const next = { ...ratio }; delete next[size]; setRatio(next);
    } else {
      setSizeSet([...sizeSet, size]);
      setRatio({ ...ratio, [size]: ratio[size] || 1 });
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2"><button onClick={() => { const next=["S","M","L","XL"]; setOrder({ ...order, productKind: "SHIRT" }); setSizeSet(next); setRatio(Object.fromEntries(next.map(x=>[x,1]))); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${order.productKind === "SHIRT" ? "bg-neutral-950 text-white" : "bg-white"}`}>Size áo</button><button onClick={() => { const next=["29","30","31","32","34","36"]; setOrder({ ...order, productKind: "PANTS" }); setSizeSet(next); setRatio(Object.fromEntries(next.map(x=>[x,1]))); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${order.productKind === "PANTS" ? "bg-neutral-950 text-white" : "bg-white"}`}>Size quần</button></div>
      <div><b>Chọn dải size</b><div className="mt-3 flex flex-wrap gap-2">{preset.map((size) => { const active = sizeSet.includes(size); return <button key={size} onClick={() => toggle(size)} className={`min-w-14 rounded-2xl border px-4 py-3 text-base font-black ${active ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white text-neutral-400"}`}>{size}</button>; })}</div></div>
      <div><b>Tỷ lệ từng size</b><div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{sizeSet.map((size: string) => <div key={size} className="rounded-2xl border bg-neutral-50 p-3 text-center"><div className="text-lg font-black">{size}</div><input type="number" min="0" className={`${input} mt-2 text-center font-bold`} value={ratio[size] ?? 1} onChange={(e) => setRatio({ ...ratio, [size]: Number(e.target.value || 0) })} /></div>)}</div></div>
      <div className="rounded-2xl bg-neutral-50 p-4 text-sm">Tỷ lệ hiện tại: <b>{sizeSet.map((s: string) => `${s}:${ratio[s] || 0}`).join(" · ") || "Chưa chọn"}</b></div>
      <div className="flex justify-end"><button disabled={busy || !sizeSet.length} onClick={onNext} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Lưu size → Tính sản lượng</button></div>
    </div>
  );
}

function groupSizes(rows: any[]) {
  const m = new Map<string, any>();
  rows.forEach((r) => {
    const key = `${r.colorName}|||${r.colorCode || ""}`;
    const x = m.get(key) || { colorName: r.colorName, colorCode: r.colorCode, plannedQty: 0, sizes: {} };
    x.sizes[r.size] = r.plannedQty;
    x.plannedQty += Number(r.plannedQty || 0);
    m.set(key, x);
  });
  return [...m.values()];
}

function Results({ c }: { c: any }) {
  const sizes = Array.from(new Set((c.colors || []).flatMap((x: any) => Object.keys(x.sizes || {})))) as string[];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">Sản lượng cắt dự kiến: <b className="text-xl">{c.totalQty}</b> sp</div>
      <div className="overflow-x-auto rounded-2xl border"><table className="min-w-[650px] w-full text-sm"><thead className="bg-neutral-50"><tr><th className="p-3 text-left">Màu</th><th>Tổng</th>{sizes.map((s) => <th key={s}>{s}</th>)}</tr></thead><tbody>{(c.colors || []).map((x: any) => <tr key={`${x.colorName}-${x.colorCode || ""}`} className="border-t"><td className="p-3 font-semibold">{x.colorName} {x.colorCode || ""}</td><td className="text-center font-semibold">{x.plannedQty}</td>{sizes.map((s) => <td key={s} className="text-center">{x.sizes?.[s] || 0}</td>)}</tr>)}</tbody></table></div>
      <div className="overflow-x-auto rounded-2xl border"><table className="min-w-[760px] w-full text-sm"><thead className="bg-neutral-50"><tr><th className="p-3 text-left">NPL</th><th>Size</th><th>Định mức</th><th>Hao hụt</th><th>Cần xuất</th><th>Thiếu</th></tr></thead><tbody>{(c.materials || []).map((m: any, i: number) => <tr key={i} className="border-t"><td className="p-3">{m.accessoryCode} · <b>{m.accessoryName}</b></td><td className="text-center">{m.sizeLabel || "—"}</td><td className="text-center">{fmt(m.qtyPerProduct)}</td><td className="text-center">{fmt(m.wastePercent)}%</td><td className="text-center font-semibold">{fmt(m.requiredQty)}</td><td className={`text-center font-semibold ${Number(m.shortageQty) > 0 ? "text-red-700" : "text-emerald-700"}`}>{fmt(m.shortageQty)}</td></tr>)}</tbody></table></div>
    </div>
  );
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


function viNumber(v:any){const raw=String(v??"").trim().replace(/\s/g,"").replace(",",".");const n=Number(raw);return Number.isFinite(n)?n:null}
function viDisplay(v:any,decimals=4){if(v===null||v===undefined||v==="")return "";const n=viNumber(v);if(n===null)return String(v);return n.toLocaleString("vi-VN",{maximumFractionDigits:decimals,useGrouping:false})}
function ViNumberInput({value,onChange,suffix,decimals=4,placeholder=""}:{value:any;onChange:(v:string)=>void;suffix:string;decimals?:number;placeholder?:string}){return <div className="relative"><input inputMode="decimal" className={`${input} pr-12`} value={String(value??"")} placeholder={placeholder} onChange={e=>onChange(e.target.value.replace(/[^0-9,.-]/g,""))} onBlur={()=>onChange(viDisplay(value,decimals))}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">{suffix}</span></div>}
function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{l}</span>{children}</label>;
}
function Err({ x }: { x: string }) { return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{x}</div>; }
function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const [viewport, setViewport] = useState<{ height: number; top: number }>(() => ({
    height: typeof window === "undefined" ? 800 : window.innerHeight,
    top: 0,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    const sync = () =>
      setViewport({
        height: vv?.height || window.innerHeight,
        top: vv?.offsetTop || 0,
      });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      document.body.style.overflow = previousOverflow;
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  function close() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const sync = () => {
      const vv = window.visualViewport;
      setViewport({
        height: vv?.height || window.innerHeight,
        top: vv?.offsetTop || 0,
      });
    };
    requestAnimationFrame(sync);
    setTimeout(sync, 80);
    setTimeout(onClose, 100);
  }

  return (
    <div
      className="fixed left-0 right-0 z-[80] overflow-y-auto overscroll-contain bg-black/45 px-3"
      style={{
        top: viewport.top,
        height: viewport.height,
        paddingTop: 12,
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-4">
          <h2 className="min-w-0 truncate pr-3 font-black">{title}</h2>
          <button onClick={close} className="h-10 w-10 shrink-0 rounded-full border">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
