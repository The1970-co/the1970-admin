"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Check,
  Factory,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { asset, fmt, productionApi } from "./production-api";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import * as XLSX from "xlsx";

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

function useProductionPermissions(){
  const user=getCurrentUserFromStorage() as any;
  const roles=[...(Array.isArray(user?.roles)?user.roles:[]),user?.role,user?.roleCode,user?.staffRole].map(x=>String(x||"").toLowerCase());
  const root=roles.includes("owner")||roles.includes("admin");
  const keys=new Set(getCurrentUserPermissions(user,user?.activeBranchId||user?.branchId));
  const can=(key:string)=>root||keys.has("*")||keys.has(key);
  return {user,can};
}

export default function ProductionPageClient() {
  const {user,can}=useProductionPermissions();
  const canView=can("production.view");
  const canCreate=can("production.create");
  const canEdit=can("production.edit");
  const canCalculate=can("production.calculate");
  const canManage=can("production.manage");
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

  if(user&&!canView)return <div className="rounded-3xl border bg-white p-10 text-center text-sm text-neutral-500">Bạn không có quyền xem Lệnh sản xuất.</div>;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.16em] text-neutral-400">Sản xuất</div>
          <h1 className="mt-1 text-2xl font-semibold">Lệnh sản xuất</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Chọn mã → định mức & NPL → cây vải → size → tính sản lượng → gửi lệnh.
          </p>
        </div>
        <div className="flex gap-2">
          {canManage&&<button onClick={() => setFactoryOpen(true)} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold"><Factory className="mr-1 inline h-4 w-4" /> Nhà may</button>}
          {canCreate&&<button onClick={() => setCreateOpen(true)} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" /> Tạo lệnh SX</button>}
        </div>
      </div>

      {error && <Err x={error} />}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
      {detailId && <OrderWizard id={detailId} meta={meta} canEdit={canEdit} canCalculate={canCalculate} canManage={canManage} onClose={() => setDetailId(null)} onChanged={load} />}
      {factoryOpen && canManage && <FactoryModal factories={meta.factories} onClose={() => setFactoryOpen(false)} onSaved={load} />}
    </div>
  );
}

function CreateOrderModal({ meta, onClose, onSaved }: { meta: Meta; onClose: () => void; onSaved: (id: string) => void }) {
  const [sourceType, setSourceType] = useState<"SAMPLE" | "PRODUCT">("SAMPLE");
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1">
          <button onClick={() => { setSourceType("SAMPLE"); setSourceId(""); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${sourceType === "SAMPLE" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            Mẫu mới / Triển khai mẫu
          </button>
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

function OrderWizard({ id, meta, canEdit, canCalculate, canManage, onClose, onChanged }: { id: string; meta: Meta; canEdit:boolean; canCalculate:boolean; canManage:boolean; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [step, setStep] = useState(2);
  const [materials, setMaterials] = useState<MaterialSpec[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [rollQ, setRollQ] = useState("");
  const [accessoryQ, setAccessoryQ] = useState("");
  const [accessoryType, setAccessoryType] = useState("ALL");
  const [importingNpl, setImportingNpl] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [allocated, setAllocated] = useState<Record<string, string>>({});
  const [sizeSet, setSizeSet] = useState<string[]>([]);
  const [ratio, setRatio] = useState<Record<string, number>>({});
  const [calc, setCalc] = useState<any>(null);
  const [actualCut, setActualCut] = useState<Record<string, string>>({});
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
      setMaterials((o.accessorySpecs || []).map((x: any) => {
        const accessory = meta.accessories.find((a) => a.id === x.accessoryItemId);
        return { accessoryItemId: x.accessoryItemId, qtyPerProduct: Number(x.qtyPerProduct || 0), wastePercent: Number(x.wastePercent || 0), sizeScoped: isSizeLabelAccessory(accessory) ? true : !!x.sizeScoped, note: x.note || null };
      }));
      setRolls(rollOptions);
      const sel: Record<string, boolean> = {};
      const meters: Record<string, string> = {};
      (o.rolls || []).forEach((x: any) => { sel[x.fabricReceiptRollId] = true; meters[x.fabricReceiptRollId] = String(x.allocatedM ?? ""); });
      setSelected(sel);
      setAllocated(meters);
      const ss = Array.isArray(o.sizeSet) && o.sizeSet.length ? o.sizeSet : o.productKind === "PANTS" ? PANTS_SIZES : SHIRT_SIZES;
      setSizeSet(ss);
      setRatio(o.sizeRatio && typeof o.sizeRatio === "object" ? o.sizeRatio : Object.fromEntries(ss.map((x: string) => [x, 1])));
      if (o.sizes?.length) {
        const actualDraft: Record<string, string> = {};
        (o.sizes || []).forEach((x: any) => { actualDraft[cutKey(x.colorName, x.size)] = String(x.actualQty ?? x.plannedQty ?? 0); });
        setActualCut(actualDraft);
        const totalPlannedQty = o.sizes.reduce((sum: number, x: any) => sum + Number(x.plannedQty || 0), 0);
        const totalActualQty = o.sizes.reduce((sum: number, x: any) => sum + Number(x.actualQty ?? x.plannedQty ?? 0), 0);
        setCalc({ totalQty: totalPlannedQty, totalPlannedQty, totalActualQty, colors: groupSizes(o.sizes), materials: o.materials || [] });
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

  async function importAccessoryExcel(file: File) {
    try {
      setImportingNpl(true);
      setError("");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("File Excel không có sheet dữ liệu.");
      const matrix = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheet], { header: 1, defval: "", raw: false });
      const imported = excelAccessoryMaterials(matrix, meta.accessories);
      if (!imported.length) throw new Error("Không đọc được dòng NPL nào. File cần có cột Mã SKU/Tên sản phẩm và Số lượng cho 1 SP.");
      if (materials.length && !window.confirm("Nhập Excel sẽ thay danh sách NPL hiện tại. Tiếp tục?")) return;
      setMaterials(imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file Excel NPL.");
    } finally {
      setImportingNpl(false);
    }
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
      if(!canEdit)throw new Error("Bạn không có quyền sửa lệnh sản xuất.");
      validateMaterialRows();
      await productionApi(`/production/orders/${id}/spec`, {
        method: "PATCH",
        body: JSON.stringify({
          productKind: order.productKind,
          fabricWidthCm: numberOrNull(order.fabricWidthCm),
          fabricConsumptionM: numberOrNull(order.fabricConsumptionM),
          fabricWastePercent: numberOrZero(order.fabricWastePercent),
          sizeSet,
          sizeRatio: Object.fromEntries(Object.entries(ratio).map(([key, value]) => [key, numberOrZero(value)])),
          materials: materials.map((m) => ({
            ...m,
            qtyPerProduct: numberOrZero(m.qtyPerProduct),
            wastePercent: numberOrZero(m.wastePercent),
          })),
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
      if(!canEdit) throw new Error("Bạn không có quyền sửa cây vải của lệnh.");
      const allRolls = await productionApi<Roll[]>(`/production/fabric-rolls?orderId=${encodeURIComponent(id)}`);
      const selectedRows = allRolls.filter((r) => selected[r.id]);
      const payload=selectedRows.map((r)=>{
        const availableM=Number(r.remainingM||r.actualM||r.supplierDeclaredM||0);
        const meters=Number(String(allocated[r.id]||availableM).replace(",","."));
        if(!meters||meters<=0)throw new Error(`Nhập số mét xuất cho cây ${r.rollCode||r.id}.`);
        if(meters>availableM+0.0001)throw new Error(`Cây ${r.rollCode||r.id} chỉ còn ${fmt(availableM)}m.`);
        return {fabricReceiptRollId:r.id,allocatedM:meters,allocatedKg:r.remainingKg};
      });
      await productionApi(`/production/orders/${id}/rolls`, {method:"PATCH",body:JSON.stringify({rolls:payload})});
      await load();
      setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được cây vải."); }
    finally { setBusy(false); }
  }

  async function saveSizes() {
    try {
      setBusy(true);
      setError("");
      if(!canEdit)throw new Error("Bạn không có quyền sửa lệnh sản xuất.");
      validateMaterialRows();
      await productionApi(`/production/orders/${id}/spec`, {
        method: "PATCH",
        body: JSON.stringify({
          productKind: order.productKind,
          fabricWidthCm: numberOrNull(order.fabricWidthCm),
          fabricConsumptionM: numberOrNull(order.fabricConsumptionM),
          fabricWastePercent: numberOrZero(order.fabricWastePercent),
          sizeSet,
          sizeRatio: Object.fromEntries(sizeSet.map((s) => [s, numberOrZero(ratio[s])])),
          materials: materials.map((m) => ({
            ...m,
            qtyPerProduct: numberOrZero(m.qtyPerProduct),
            wastePercent: numberOrZero(m.wastePercent),
          })),
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
      if(!canCalculate)throw new Error("Bạn không có quyền tính sản lượng.");
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
      if (!canEdit) throw new Error("Bạn không có quyền sửa số lượng cắt thực tế.");
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

  async function sendOrder() {
    try {
      setBusy(true);
      setError("");
      if(!canManage)throw new Error("Bạn không có quyền gửi lệnh sản xuất.");
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
    if (step === 5) { if (!calc) await calculate(); else setStep(6); return; }
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
            <div className="grid gap-4 md:grid-cols-4">
              <Field l="Loại sản phẩm"><select className={input} value={order.productKind || "OTHER"} onChange={(e) => setOrder({ ...order, productKind: e.target.value })}><option value="SHIRT">Áo</option><option value="PANTS">Quần</option><option value="OTHER">Khác</option></select></Field>
              <Field l="Định mức vải / sp"><ViNumberInput value={order.fabricConsumptionM ?? ""} onChange={(v) => setOrder({ ...order, fabricConsumptionM: v })} suffix="m" decimals={4} placeholder="VD: 1,5" /></Field>
              <Field l="Khổ vải"><ViNumberInput value={order.fabricWidthCm ?? ""} onChange={(v) => setOrder({ ...order, fabricWidthCm: v })} suffix="cm" decimals={2} placeholder="VD: 155" /></Field>
              <Field l="Hao hụt vải"><ViNumberInput value={order.fabricWastePercent ?? 0} onChange={(v) => setOrder({ ...order, fabricWastePercent: v })} suffix="%" decimals={3} placeholder="VD: 3" /></Field>
            </div>

            <div className="rounded-3xl border p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div><b>Nguyên phụ liệu của lệnh này</b><div className="text-xs text-neutral-400">Có thể chọn thủ công, nhập Excel hoặc áp dụng mẫu NPL có sẵn.</div></div>
                <button onClick={() => setMaterials((x) => [...x, { accessoryItemId: "", qtyPerProduct: 1, wastePercent: 0, sizeScoped: false }])} className="rounded-xl border px-3 py-2 text-xs font-semibold">+ Thêm NPL</button>
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(240px,1fr)_220px_170px_190px]">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${input} pl-10`} value={accessoryQ} onChange={(e) => setAccessoryQ(e.target.value)} placeholder="Tìm mã, tên, quy cách NPL..." /></div>
                <select className={input} value={accessoryType} onChange={(e) => setAccessoryType(e.target.value)}><option value="ALL">Tất cả phân loại NPL</option>{accessoryTypeOptions(meta.accessories).map((type) => <option key={type} value={type}>{type}</option>)}</select>
                <label className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-semibold ${importingNpl ? "opacity-50" : ""}`}>{importingNpl ? "Đang đọc Excel..." : "↑ Nhập Excel"}<input type="file" accept=".xlsx,.xls,.csv" disabled={importingNpl} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void importAccessoryExcel(file); }} /></label>
                <select className={input} value="" onChange={(e) => { const value = e.target.value as "JEANS" | "JACKET" | ""; if (value) applyAccessoryTemplate(value); }}><option value="">Chọn mẫu NPL</option><option value="JEANS">Mẫu · Quần jean</option><option value="JACKET">Mẫu · Áo khoác</option></select>
              </div>
              <div className="mt-2 text-[11px] text-neutral-400">Excel đọc theo các cột kiểu file mẫu: Mã SKU, Tên sản phẩm, Số lượng cho 1 SP. Dòng chưa khớp kho NPL sẽ được giữ lại để nhân viên chọn mã.</div>

              <div className="mt-3 space-y-2">
                {materials.map((m, i) => {
                  const selectedAccessory = meta.accessories.find((a) => a.id === m.accessoryItemId);
                  const qtySuffix = selectedAccessory ? `${accessoryUnitLabel(selectedAccessory.unit)}/SP` : "/SP";
                  const sizeTag = accessoryTaggedSize(selectedAccessory);
                  const options = filteredAccessories(meta.accessories, accessoryQ, accessoryType, m.accessoryItemId);
                  const sourceLabel = materialSourceLabel(m.note);
                  return (
                    <div key={i} className="rounded-2xl bg-neutral-50 p-3">
                      {sourceLabel && <div className="mb-2 text-xs font-semibold text-neutral-500">{sourceLabel}</div>}
                      <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_140px_auto]">
                        <select className={input} value={m.accessoryItemId} onChange={(e) => setMaterialAccessory(i, e.target.value)}>
                          <option value="">Chọn NPL trong kho</option>
                          {options.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}{accessorySpecShort(a) ? ` · ${accessorySpecShort(a)}` : ""}</option>)}
                        </select>
                        <ViNumberInput value={m.qtyPerProduct} onChange={(v) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, qtyPerProduct: v } : x))} suffix={qtySuffix} decimals={4} placeholder="VD: 1 hoặc 0,75" />
                        <ViNumberInput value={m.wastePercent} onChange={(v) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, wastePercent: v } : x))} suffix="%" decimals={3} placeholder="Hao hụt" />
                        {isSizeLabelAccessory(selectedAccessory) ? <div className={`flex items-center rounded-2xl px-3 text-xs font-semibold ${sizeTag ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{sizeTag ? `Tự theo size ${sizeTag}` : "Chưa gán size"}</div> : <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={m.sizeScoped} onChange={(e) => setMaterials((rows) => rows.map((x, j) => j === i ? { ...x, sizeScoped: e.target.checked } : x))} />Theo size</label>}
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
            <div className="flex justify-end"><button disabled={busy || !canEdit} onClick={() => void saveSpec()} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">Lưu định mức → Chọn cây vải</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className={`${input} pl-10`} value={rollQ} onChange={(e) => void searchRolls(e.target.value)} placeholder="Tìm mã phiếu, mã cây, mã vải, màu, #mã màu..." /></div>
            <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-2xl border p-2">
              {rolls.map((r) => {
                const availableM=Number(r.remainingM||r.actualM||r.supplierDeclaredM||0);
                const disabled=!!r.isDepleted||availableM<=0;
                const active=!!selected[r.id];
                const exportM=Number(String(allocated[r.id]??"").replace(",","."))||0;
                const afterM=Math.max(0,availableM-exportM);
                return (
                  <div key={r.id} className={`grid items-center gap-3 rounded-2xl border p-3 md:grid-cols-[auto_1fr_170px_150px] ${disabled ? "bg-neutral-100 opacity-60" : active ? "border-neutral-950 bg-neutral-50" : "bg-white"}`}>
                    <input type="checkbox" disabled={disabled||!canEdit} checked={active} onChange={(e) => setSelected({ ...selected, [r.id]: e.target.checked })} />
                    <div className="min-w-0 text-sm"><b>{r.receiptCode} · {r.rollCode || "Cây"}</b><div className="mt-1 text-xs text-neutral-500">{r.fabricName || r.fabricCode || "Vải"} · {r.colorName || "—"} {r.colorCode || ""}</div><div className={`mt-1 text-xs font-semibold ${r.isDepleted?"text-red-600":r.usingSupplierDeclaredM?"text-amber-600":"text-emerald-700"}`}>{r.isDepleted?"Đã xuất hết":availableM<=0?"Cây chưa có số mét":`Còn ${fmt(availableM)}m${r.usingSupplierDeclaredM?" · dùng mét NCC báo":""}`}</div></div>
                    <div><div className="mb-1 text-[10px] font-semibold uppercase text-neutral-400">Xuất cây này</div><input disabled={!active||disabled||!canEdit} inputMode="decimal" className={input} value={allocated[r.id] ?? (active?String(availableM):"")} onChange={(e) => setAllocated({ ...allocated, [r.id]: e.target.value })} placeholder="Mét xuất" /></div>
                    <div className="rounded-xl bg-neutral-50 p-3"><div className="text-[10px] font-semibold uppercase text-neutral-400">Còn sau xuất</div><div className="mt-1 font-semibold">{active?fmt(afterM):fmt(availableM)} m</div></div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end"><button disabled={busy||!canEdit} onClick={() => void saveRolls()} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">Lưu cây vải → Chọn size</button></div>
          </div>
        )}

        {step === 4 && (
          <SizeRatioEditor order={order} setOrder={setOrder} sizeSet={sizeSet} setSizeSet={setSizeSet} ratio={ratio} setRatio={setRatio} onNext={() => void saveSizes()} busy={busy||!canEdit} />
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="rounded-3xl border p-5"><div className="flex items-center gap-3"><Calculator className="h-6 w-6" /><div><b>Sản lượng cắt dự kiến / thực tế</b><div className="text-xs text-neutral-400">Tính dự kiến từ vải và tỷ lệ size. Sau khi cắt, sửa các ô màu xanh rồi lưu để tính lại NPL theo số thực tế.</div></div></div><button disabled={busy||!canCalculate} onClick={() => void calculate()} className="mt-4 w-full rounded-2xl bg-neutral-950 py-3 font-semibold text-white">{calc ? "Tính lại số lượng dự kiến" : "Tính sản lượng dự kiến & NPL"}</button></div>
            {calc && <Results c={calc} editable actualCut={actualCut} setActualCut={setActualCut} onSaveActual={() => void saveActualCuts()} busy={busy||!canEdit} history={order.cutHistory || []} />}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            {calc ? <Results c={calc} history={order.cutHistory || []} /> : <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Chưa có kết quả tính. Quay lại bước 5 để tính sản lượng.</div>}
            <div className="rounded-3xl border p-5"><div className="flex items-center gap-3"><Send className="h-6 w-6" /><div><b>Gửi lệnh sản xuất</b><div className="text-xs text-neutral-400">Sau khi gửi, cây vải và kế hoạch size/NPL được dùng làm snapshot cho lệnh này.</div></div></div><div className="mt-4 flex gap-2"><button onClick={() => window.open(`/production/print/${id}`, "_blank")} className="flex-1 rounded-2xl border px-4 py-3 font-semibold">Xem / In phiếu</button><button disabled={busy || !canManage || !calc || order.status === "SENT"} onClick={() => void sendOrder()} className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 font-semibold text-white disabled:opacity-40">{order.status === "SENT" ? "Đã gửi nhà may" : "Gửi lệnh SX"}</button></div></div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 mt-5 border-t bg-white/95 px-5 py-3 backdrop-blur">
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
      <div className="flex flex-wrap gap-2"><button onClick={() => { const next=[...SHIRT_SIZES]; setOrder({ ...order, productKind: "SHIRT" }); setSizeSet(next); setRatio(Object.fromEntries(next.map(x=>[x,1]))); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${order.productKind === "SHIRT" ? "bg-neutral-950 text-white" : "bg-white"}`}>Size áo</button><button onClick={() => { const next=[...PANTS_SIZES]; setOrder({ ...order, productKind: "PANTS" }); setSizeSet(next); setRatio(Object.fromEntries(next.map(x=>[x,1]))); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${order.productKind === "PANTS" ? "bg-neutral-950 text-white" : "bg-white"}`}>Size quần</button></div>
      <div><b>Chọn dải size</b><div className="mt-3 flex flex-wrap gap-2">{preset.map((size) => { const active = sizeSet.includes(size); return <button key={size} onClick={() => toggle(size)} className={`min-w-14 rounded-2xl border px-4 py-3 text-base font-black ${active ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white text-neutral-400"}`}>{size}</button>; })}</div></div>
      <div><b>Tỷ lệ từng size</b><div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{sizeSet.map((size: string) => <div key={size} className="rounded-2xl border bg-neutral-50 p-3 text-center"><div className="text-lg font-black">{size}</div><input type="number" min="0" className={`${input} mt-2 text-center font-bold`} value={ratio[size] ?? 1} onChange={(e) => setRatio({ ...ratio, [size]: Number(e.target.value || 0) })} /></div>)}</div></div>
      <div className="rounded-2xl bg-neutral-50 p-4 text-sm">Tỷ lệ hiện tại: <b>{sizeSet.map((s: string) => `${s}:${ratio[s] || 0}`).join(" · ") || "Chưa chọn"}</b></div>
      <div className="flex justify-end"><button disabled={busy || !sizeSet.length} onClick={onNext} className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Lưu size → Tính sản lượng</button></div>
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

function Results({ c, editable = false, actualCut = {}, setActualCut, onSaveActual, busy = false, history = [] }: { c: any; editable?: boolean; actualCut?: Record<string,string>; setActualCut?: (x:Record<string,string>)=>void; onSaveActual?:()=>void; busy?:boolean; history?:any[] }) {
  const sizes = Array.from(new Set((c.colors || []).flatMap((x: any) => Object.keys(x.sizes || {})))) as string[];
  const totalPlanned = Number(c.totalPlannedQty ?? c.totalQty ?? (c.colors || []).reduce((sum:number,x:any)=>sum+Number(x.plannedQty||0),0));
  const persistedActual = Number(c.totalActualQty ?? (c.colors || []).reduce((sum:number,x:any)=>sum+Number((x.actualQty ?? x.plannedQty) || 0),0));
  const draftActual = editable
    ? (c.colors || []).reduce((sum:number,x:any)=>sum+sizes.reduce((s:number,size:string)=>s+Number(String(actualCut[cutKey(x.colorName,size)] ?? x.sizes?.[size]?.actualQty ?? x.sizes?.[size]?.plannedQty ?? 0).replace(",","."))||0,0),0)
    : persistedActual;
  const diff = draftActual - totalPlanned;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-neutral-100 p-4"><div className="text-xs font-semibold uppercase text-neutral-500">Cắt dự kiến</div><b className="mt-1 block text-2xl">{totalPlanned}</b></div>
        <div className="rounded-2xl bg-blue-50 p-4 text-blue-900"><div className="text-xs font-semibold uppercase text-blue-600">Cắt thực tế</div><b className="mt-1 block text-2xl">{draftActual}</b></div>
        <div className={`rounded-2xl p-4 ${diff===0?"bg-neutral-100 text-neutral-700":diff>0?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800"}`}><div className="text-xs font-semibold uppercase">Chênh lệch TT / DK</div><b className="mt-1 block text-2xl">{diff>0?"+":""}{diff}</b></div>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-neutral-50">
            <tr><th rowSpan={2} className="border-r p-3 text-left">Màu</th><th colSpan={2} className="border-r p-2">Tổng</th>{sizes.map((s)=><th key={s} colSpan={2} className="border-r p-2">{s}</th>)}</tr>
            <tr><th className="border-r p-2 text-neutral-700">DK</th><th className="border-r bg-blue-50 p-2 text-blue-700">TT</th>{sizes.flatMap((s)=><Fragment key={s}><th className="border-r p-2 text-neutral-700">DK</th><th className="border-r bg-blue-50 p-2 text-blue-700">TT</th></Fragment>)}</tr>
          </thead>
          <tbody>{(c.colors || []).map((x:any)=>{
            const actualTotal=sizes.reduce((sum:number,size:string)=>sum+Number(String(actualCut[cutKey(x.colorName,size)] ?? x.sizes?.[size]?.actualQty ?? x.sizes?.[size]?.plannedQty ?? 0).replace(",","."))||0,0);
            return <tr key={`${x.colorName}-${x.colorCode || ""}`} className="border-t"><td className="border-r p-3 font-semibold">{x.colorName} {x.colorCode || ""}</td><td className="border-r text-center font-semibold">{x.plannedQty}</td><td className="border-r bg-blue-50 text-center font-bold text-blue-800">{actualTotal}</td>{sizes.flatMap((size)=>{const cell=x.sizes?.[size]||{plannedQty:0,actualQty:0};const key=cutKey(x.colorName,size);return [<td key={`${size}-p`} className="border-r p-2 text-center">{cell.plannedQty||0}</td>,<td key={`${size}-a`} className="border-r bg-blue-50 p-1 text-center">{editable?<input type="number" min="0" step="1" className="w-20 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-center font-bold text-blue-900 outline-none focus:border-blue-600" value={actualCut[key] ?? String(cell.actualQty ?? cell.plannedQty ?? 0)} onChange={(e)=>setActualCut?.({...actualCut,[key]:e.target.value})}/>:<b className="text-blue-800">{cell.actualQty ?? cell.plannedQty ?? 0}</b>}</td>]})}</tr>})}</tbody>
        </table>
      </div>

      {editable && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="text-sm text-blue-900"><b>Ô xanh = số lượng cắt thực tế.</b> Sửa xong bấm lưu; hệ thống chỉ cập nhật TT, giữ nguyên DK và tính lại toàn bộ NPL.</div><button disabled={busy} onClick={onSaveActual} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Lưu thực tế & tính lại NPL</button></div>}

      <div className="overflow-x-auto rounded-2xl border"><table className="min-w-[760px] w-full text-sm"><thead className="bg-neutral-50"><tr><th className="p-3 text-left">NPL</th><th>Size</th><th>Định mức</th><th>Hao hụt</th><th>Cần xuất theo TT</th><th>Thiếu</th></tr></thead><tbody>{(c.materials || []).map((m: any, i: number) => <tr key={i} className="border-t"><td className="p-3">{m.accessoryCode} · <b>{m.accessoryName}</b></td><td className="text-center">{m.sizeLabel || "—"}</td><td className="text-center">{fmt(m.qtyPerProduct)}</td><td className="text-center">{fmt(m.wastePercent)}%</td><td className="text-center font-semibold">{fmt(m.requiredQty)}</td><td className={`text-center font-semibold ${Number(m.shortageQty) > 0 ? "text-red-700" : "text-emerald-700"}`}>{fmt(m.shortageQty)}</td></tr>)}</tbody></table></div>

      {!!history.length && <details className="rounded-2xl border bg-white" open={false}><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Lịch sử thay đổi số lượng cắt ({history.length})</summary><div className="max-h-80 overflow-auto border-t"><table className="w-full min-w-[760px] text-xs"><thead className="sticky top-0 bg-neutral-50"><tr><th className="p-2 text-left">Thời gian</th><th>Màu</th><th>Size</th><th>DK</th><th>TT trước</th><th>TT sau</th><th>Thao tác</th><th>Người sửa</th></tr></thead><tbody>{history.map((h:any)=><tr key={h.id} className="border-t"><td className="p-2">{h.createdAt?new Date(h.createdAt).toLocaleString("vi-VN"):"—"}</td><td className="text-center">{h.colorName}</td><td className="text-center font-semibold">{h.size}</td><td className="text-center">{h.plannedQty}</td><td className="text-center">{h.previousActualQty ?? "—"}</td><td className="bg-blue-50 text-center font-semibold text-blue-800">{h.actualQty ?? "—"}</td><td className="text-center">{h.changeType==="ACTUAL_UPDATE"?"Sửa thực tế":h.changeType==="INITIAL_CALCULATE"?"Tính lần đầu":"Tính lại dự kiến"}</td><td className="text-center">{h.createdByName || "Hệ thống"}</td></tr>)}</tbody></table></div></details>}
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

function materialSourceLabel(note?: string | null) {
  const raw = String(note || "").trim();
  if (raw.startsWith("[Mẫu]")) return raw;
  if (raw.startsWith("[Excel]")) return raw;
  return "";
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
        rows.push({ accessoryItemId: accessory?.id || "", qtyPerProduct: slot.qty, wastePercent: 0, sizeScoped: true, note: `[Mẫu] ${template.label} · ${slot.label} ${size}` });
      }
      continue;
    }
    const accessory = matchTemplateAccessory(accessories, slot);
    rows.push({ accessoryItemId: accessory?.id || "", qtyPerProduct: slot.qty, wastePercent: 0, sizeScoped: false, note: `[Mẫu] ${template.label} · ${slot.label}` });
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
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8"><div className={`my-auto w-full ${wide ? "max-w-7xl" : "max-w-2xl"} rounded-3xl bg-white shadow-2xl`}><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-semibold">{title}</h2><button onClick={onClose} className="h-9 w-9 rounded-xl border">×</button></div>{children}</div></div>;
}
