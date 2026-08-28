"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, ImagePlus, Plus, Search, Settings2 } from "lucide-react";
import * as XLSX from "xlsx";
import { asset, money, productionApi, uploadProductionImage } from "./production-api";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";

type Supplier = { id: string; code: string; name: string; phone?: string | null };
type AccessoryReceipt={id:string;code:string;supplierId?:string|null;receivedAt:string;receivedByName?:string|null;note?:string|null;createdByName?:string|null;status?:string;postedAt?:string|null;postedByName?:string|null;items:Array<{id:string;accessoryItemId:string;accessoryCodeSnapshot:string;accessoryNameSnapshot:string;unit:string;qty:number|string;unitPrice?:number|string|null;note?:string|null}>};
type Item = {
  id: string;
  code: string;
  name: string;
  typeName: string;
  imageUrl?: string | null;
  unit: string;
  stockQty: number;
  unitPrice?: number | null;
  supplierId?: string | null;
  specifications?: Record<string, any> | null;
  note?: string | null;
};

const TYPES = ["Cúc", "Mác Cổ", "Mác Gáy", "Mác Sườn", "Mác Size", "Mác Quần", "Khóa Kéo", "Chun", "Dây Rút", "Mex", "Túi Nylon", "Tem Barcode", "Thùng Carton", "Chỉ May", "Khác"];
const UNITS = [["PIECE", "Cái"], ["METER", "Mét"], ["ROLL", "Cuộn"], ["SET", "Bộ"], ["KG", "Kg"], ["PACK", "Gói"], ["BOX", "Hộp"], ["OTHER", "Khác"]];
const SHIRT_LABEL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const PANTS_LABEL_SIZES = ["29", "30", "31", "32", "34", "36"];

type ImportAccessoryRow = {
  rowNo: number;
  code: string;
  name: string;
  typeName: string;
  unit: string;
  stockQty: number | null;
  unitPrice: number | null;
  supplierText: string;
  specifications: Record<string, any>;
  note: string;
  error?: string;
};

const normalizeText = (v: any) => String(v ?? "").trim();
const normalizedKey = (v: any) =>
  normalizeText(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

function pickExcel(row: Record<string, any>, aliases: string[]) {
  const byKey = new Map(Object.entries(row).map(([k, v]) => [normalizedKey(k), v]));
  for (const alias of aliases) {
    const found = byKey.get(normalizedKey(alias));
    if (found !== undefined && found !== null && String(found).trim() !== "") return found;
  }
  return "";
}

function excelNumber(v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let raw = String(v).trim().replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!raw) return null;
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inferTypeName(nameInput: any, typeInput?: any) {
  const supplied = normalizeText(typeInput);
  const suppliedMatch = TYPES.find((x) => normalizedKey(x) === normalizedKey(supplied));
  if (suppliedMatch) return suppliedMatch;
  const name = normalizeText(nameInput).toUpperCase();
  if (/KH[ÓO]A|KHOA/.test(name)) return "Khóa Kéo";
  if (/C[ÚU]C|KHUY/.test(name)) return "Cúc";
  if (/M[ÁA]C.*SIZE|SIZE.*M[ÁA]C/.test(name)) return "Mác Size";
  if (/M[ÁA]C.*C[ỔO]|M[ÁA]C.*G[ÁA]Y/.test(name)) return "Mác Cổ";
  if (/M[ÁA]C.*S[ƯU][ỜO]N/.test(name)) return "Mác Sườn";
  if (/M[ÁA]C.*QU[ẦA]N/.test(name)) return "Mác Quần";
  if (/M[ÁA]C/.test(name)) return "Mác Gáy";
  if (/CHUN/.test(name)) return "Chun";
  if (/D[ÂA]Y.*R[ÚU]T|D[ÂA]Y/.test(name)) return "Dây Rút";
  if (/MEX/.test(name)) return "Mex";
  if (/BARCODE|M[ÃA] V[ẠA]CH|TEM/.test(name)) return "Tem Barcode";
  if (/TH[ÙU]NG|CARTON/.test(name)) return "Thùng Carton";
  if (/NYLON|T[ÚU]I/.test(name)) return "Túi Nylon";
  if (/CH[ỈI]/.test(name)) return "Chỉ May";
  return supplied || "Khác";
}

function normalizeUnit(v: any) {
  const raw = normalizedKey(v);
  if (!raw) return "PIECE";
  if (["cai", "pcs", "piece", "pieces"].includes(raw)) return "PIECE";
  if (["m", "met", "meter", "metre"].includes(raw)) return "METER";
  if (["cuon", "roll"].includes(raw)) return "ROLL";
  if (["bo", "set"].includes(raw)) return "SET";
  if (["kg", "kilogram"].includes(raw)) return "KG";
  if (["goi", "pack"].includes(raw)) return "PACK";
  if (["hop", "box"].includes(raw)) return "BOX";
  const known = UNITS.find(([code, label]) => normalizedKey(code) === raw || normalizedKey(label) === raw);
  return known?.[0] || "OTHER";
}

function normalizeGauge(v: any) {
  const raw = normalizeText(v);
  if (!raw) return "";
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  return m ? `#${m[1].replace(",", ".")}` : raw;
}

function itemMaterial(x: Item) {
  const s = x.specifications || {};
  return normalizeText(s.material || s.teethMaterial || "");
}
function itemGauge(x: Item) {
  const s = x.specifications || {};
  return normalizeGauge(s.zipperGauge || "");
}
function itemColor(x: Item) {
  const s = x.specifications || {};
  return normalizeText(s.teethColor || s.tapeColor || s.color || s.finish || "");
}
function itemSubgroup(x: Item) {
  const group = accessoryGroup(x.typeName);
  const s = x.specifications || {};
  if (group === "Khóa") return `Khóa · ${itemGauge(x) ? `Răng ${itemGauge(x).replace("#", "#")}` : "Chưa rõ cỡ răng"}`;
  if (group === "Mác") {
    if (x.typeName === "Mác Size") {
      const kind = s.sizeKind === "PANTS" ? "Quần" : s.sizeKind === "SHIRT" ? "Áo" : "";
      return `Mác Size${kind ? ` · ${kind}` : ""}`;
    }
    return x.typeName;
  }
  if (group === "Cúc") return `Cúc${s.material ? ` · ${s.material}` : ""}`;
  return x.typeName || group;
}

function useAccessoryPermissions() {
  const user = getCurrentUserFromStorage() as any;
  const roles = [...(Array.isArray(user?.roles) ? user.roles : []), user?.role, user?.roleCode, user?.staffRole].map((x) => String(x || "").toLowerCase());
  const root = roles.includes("owner") || roles.includes("admin");
  const keys = new Set(getCurrentUserPermissions(user, user?.activeBranchId || user?.branchId));
  const can = (key: string) => root || keys.has("*") || keys.has(key);
  return { user, can, root };
}

function accessoryGroup(typeName: string) {
  const t = String(typeName || "").trim();
  if (t === "Cúc") return "Cúc";
  if (t.startsWith("Mác")) return "Mác";
  if (t.includes("Khóa")) return "Khóa";
  if (t.includes("Chun")) return "Chun";
  if (t.includes("Dây")) return "Dây / Rút";
  if (["Túi Nylon", "Tem Barcode", "Thùng Carton"].includes(t)) return "Bao bì";
  if (t === "Chỉ May") return "Chỉ may";
  if (t === "Mex") return "Mex";
  return "Khác";
}

const ACCESSORY_GROUP_ORDER = ["Cúc", "Mác", "Khóa", "Chun", "Dây / Rút", "Mex", "Chỉ may", "Bao bì", "Khác"];
const fmtQty = (v: any) => Number(v || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export default function AccessoriesPageClient() {
  const { user, can, root } = useAccessoryPermissions();
  const canView = can("accessories.view");
  const canManage = can("accessories.manage");
  const canStock = can("accessories.stock");
  const canCostView = can("accessories.cost.view");
  const canSupplierIdentity = can("accessories.supplier_identity.view");
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [materialFilter, setMaterialFilter] = useState("ALL");
  const [gaugeFilter, setGaugeFilter] = useState("ALL");
  const [colorFilter, setColorFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [a, s] = await Promise.all([
        productionApi<Item[]>("/production/accessories"),
        productionApi<Supplier[]>("/production/accessory-suppliers"),
      ]);
      setItems(a);
      setSuppliers(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được NPL.");
    }
  }

  useEffect(() => { void load(); }, []);

  const availableGroups = useMemo(() => ACCESSORY_GROUP_ORDER.filter((g) => items.some((x) => accessoryGroup(x.typeName) === g)), [items]);
  const availableTypes = useMemo(() => TYPES.filter((t) => items.some((x) => x.typeName === t)), [items]);
  const availableMaterials = useMemo(() => Array.from(new Set(items.map(itemMaterial).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")), [items]);
  const availableGauges = useMemo(() => Array.from(new Set(items.map(itemGauge).filter(Boolean))).sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))), [items]);
  const availableColors = useMemo(() => Array.from(new Set(items.map(itemColor).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")), [items]);
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items.filter((x) =>
      (groupFilter === "ALL" || accessoryGroup(x.typeName) === groupFilter) &&
      (typeFilter === "ALL" || x.typeName === typeFilter) &&
      (materialFilter === "ALL" || itemMaterial(x) === materialFilter) &&
      (gaugeFilter === "ALL" || itemGauge(x) === gaugeFilter) &&
      (colorFilter === "ALL" || itemColor(x) === colorFilter) &&
      (stockFilter === "ALL" || (stockFilter === "IN" ? Number(x.stockQty || 0) > 0 : Number(x.stockQty || 0) <= 0)) &&
      (!k || [x.code, x.name, x.typeName, specSummary(x), itemMaterial(x), itemGauge(x), itemColor(x)].some((v) => String(v || "").toLowerCase().includes(k)))
    );
  }, [items, q, groupFilter, typeFilter, materialFilter, gaugeFilter, colorFilter, stockFilter]);
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const row of rows) {
      const key = itemSubgroup(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries())
      .map(([group, rs]) => ({
        group,
        rows: [...rs].sort((a, b) => {
          const ga = Number(itemGauge(a).replace(/\D/g, "")) || 999;
          const gb = Number(itemGauge(b).replace(/\D/g, "")) || 999;
          if (ga !== gb) return ga - gb;
          const la = Number((a.specifications || {}).lengthCm || 0);
          const lb = Number((b.specifications || {}).lengthCm || 0);
          if (la !== lb) return la - lb;
          return String(a.name || "").localeCompare(String(b.name || ""), "vi");
        }),
      }))
      .sort((a, b) => {
        const aa = ACCESSORY_GROUP_ORDER.indexOf(accessoryGroup(a.rows[0]?.typeName));
        const bb = ACCESSORY_GROUP_ORDER.indexOf(accessoryGroup(b.rows[0]?.typeName));
        if (aa !== bb) return aa - bb;
        const ga = Number(itemGauge(a.rows[0]).replace(/\D/g, "")) || 999;
        const gb = Number(itemGauge(b.rows[0]).replace(/\D/g, "")) || 999;
        if (ga !== gb) return ga - gb;
        return a.group.localeCompare(b.group, "vi");
      });
  }, [rows]);
  const report = useMemo(() => {
    const totalValue = items.reduce((sum, x) => sum + Number(x.stockQty || 0) * Number(x.unitPrice || 0), 0);
    return {
      sku: items.length,
      inStock: items.filter((x) => Number(x.stockQty || 0) > 0).length,
      outStock: items.filter((x) => Number(x.stockQty || 0) <= 0).length,
      totalValue,
      groups: ACCESSORY_GROUP_ORDER.map((group) => {
        const rs = items.filter((x) => accessoryGroup(x.typeName) === group);
        return {
          group,
          count: rs.length,
          stock: rs.reduce((sum, x) => sum + Number(x.stockQty || 0), 0),
          value: rs.reduce((sum, x) => sum + Number(x.stockQty || 0) * Number(x.unitPrice || 0), 0),
        };
      }).filter((x) => x.count),
    };
  }, [items]);

  if (user && !canView) return <div className="rounded-3xl border bg-white p-10 text-center text-sm text-neutral-500">Bạn không có quyền xem Nguyên phụ liệu.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.16em] text-neutral-400">Sản xuất</div>
          <h1 className="mt-1 text-2xl font-semibold">Nguyên phụ liệu</h1>
          <p className="mt-1 text-sm text-neutral-500">Quản lý cúc, mác, khóa, chun, bao bì, tồn và NCC NPL.</p>
        </div>
        <div className="flex gap-2">
          {canManage && <button onClick={() => setSupplierOpen(true)} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold"><Settings2 className="mr-2 inline h-4 w-4" />NCC NPL</button>}
          {canManage && <button onClick={() => setImportOpen(true)} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold"><FileSpreadsheet className="mr-2 inline h-4 w-4" />Nhập Excel NPL</button>}
          {canStock && <button onClick={() => setReceiptOpen(true)} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold">+ Phiếu nhập NPL</button>}
          {canManage && <button onClick={() => setEditing(null)} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Thêm NPL</button>}
        </div>
      </div>

      {error && <Err x={error} />}

      {root && (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="bg-neutral-950 px-5 py-4 text-white">
            <div className="text-base font-semibold">Báo cáo nhanh tồn NPL</div>
            <div className="mt-1 text-xs text-neutral-400">Giá trị tồn = số lượng tồn hiện tại × đơn giá NPL. Chỉ Admin / Owner nhìn thấy.</div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-4">
            <Stat label="Tổng mã NPL" value={report.sku} />
            <Stat label="Đang có tồn" value={report.inStock} />
            <Stat label="Hết tồn" value={report.outStock} />
            <div className="rounded-2xl bg-neutral-950 p-4 text-white"><div className="text-xs font-semibold uppercase text-neutral-400">Giá trị tồn NPL</div><div className="mt-2 text-2xl font-semibold">{money(report.totalValue)}</div></div>
          </div>
          <div className="border-t px-4 pb-4">
            <div className="grid gap-2 pt-4 md:grid-cols-2 xl:grid-cols-4">
              {report.groups.map((g) => <div key={g.group} className="rounded-2xl border p-3"><div className="flex items-center justify-between"><b>{g.group}</b><span className="text-xs text-neutral-400">{g.count} mã</span></div><div className="mt-2 text-sm">Tổng tồn: <b>{fmtQty(g.stock)}</b></div><div className="mt-1 text-xs text-neutral-500">Giá trị: <b>{money(g.value)}</b></div></div>)}
            </div>
          </div>
        </section>
      )}

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" /><input className="w-full rounded-2xl border py-2.5 pl-10 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã, tên, chất liệu, răng, màu, quy cách..." /></div>
            <button type="button" onClick={() => { setGroupFilter("ALL"); setTypeFilter("ALL"); setMaterialFilter("ALL"); setGaugeFilter("ALL"); setColorFilter("ALL"); setStockFilter("ALL"); setQ(""); }} className="rounded-2xl border px-4 py-2.5 text-sm font-semibold">Xoá bộ lọc</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <select className={input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="ALL">Tất cả loại NPL</option>{availableTypes.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className={input} value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}><option value="ALL">Tất cả chất liệu</option>{availableMaterials.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className={input} value={gaugeFilter} onChange={(e) => setGaugeFilter(e.target.value)}><option value="ALL">Tất cả cỡ răng</option>{availableGauges.map((x) => <option key={x} value={x}>Răng {x}</option>)}</select>
            <select className={input} value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}><option value="ALL">Tất cả màu</option>{availableColors.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className={input} value={stockFilter} onChange={(e) => setStockFilter(e.target.value as "ALL" | "IN" | "OUT")}><option value="ALL">Tất cả tồn kho</option><option value="IN">Còn hàng</option><option value="OUT">Hết hàng</option></select>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setGroupFilter("ALL")} className={`rounded-full border px-3 py-2 text-xs font-semibold ${groupFilter === "ALL" ? "bg-neutral-950 text-white" : "bg-white"}`}>Tất cả nhóm · {items.length}</button>{availableGroups.map((g) => <button type="button" key={g} onClick={() => setGroupFilter(g)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${groupFilter === g ? "bg-neutral-950 text-white" : "bg-white"}`}>{g} · {items.filter((x) => accessoryGroup(x.typeName) === g).length}</button>)}</div>
          <div className="text-xs text-neutral-400">Đang hiển thị <b className="text-neutral-700">{rows.length}</b> / {items.length} mã. Danh sách Khóa được tự chia theo cỡ răng #3, #5, #8... rồi sắp tiếp theo chiều dài.</div>
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map((section) => {
          const stock = section.rows.reduce((sum, x) => sum + Number(x.stockQty || 0), 0);
          const value = section.rows.reduce((sum, x) => sum + Number(x.stockQty || 0) * Number(x.unitPrice || 0), 0);
          return (
            <section key={section.group} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-neutral-50 px-4 py-3"><div><b className="text-base">{section.group}</b><span className="ml-2 text-xs text-neutral-400">{section.rows.length} mã</span></div><div className="flex gap-4 text-xs text-neutral-500"><span>Tồn: <b className="text-neutral-900">{fmtQty(stock)}</b></span>{canCostView && <span>Giá trị: <b className="text-neutral-900">{money(value)}</b></span>}</div></div>
              <div className="divide-y">
                {section.rows.map((x) => <div key={x.id} className="grid items-center gap-3 px-4 py-3 md:grid-cols-[56px_120px_minmax(240px,1fr)_150px_180px_auto]">
                  <div className="h-12 w-12 overflow-hidden rounded-xl bg-neutral-100">{x.imageUrl ? <img src={asset(x.imageUrl)} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-neutral-300">✦</div>}</div>
                  <div><div className="text-xs font-semibold text-neutral-400">{x.code}</div><div className="mt-0.5 text-xs text-neutral-500">{x.typeName}</div></div>
                  <div className="min-w-0"><div className="truncate font-semibold">{x.name}</div>{specSummary(x) && <div className="mt-1 truncate text-xs text-neutral-500">{specSummary(x)}</div>}</div>
                  <div className="text-sm">Tồn <b>{fmtQty(x.stockQty)}</b><div className="text-xs text-neutral-400">{UNITS.find((u) => u[0] === x.unit)?.[1] || x.unit}</div></div>
                  <div className="text-sm">{canCostView ? <><b>{x.unitPrice ? money(x.unitPrice) : "Chưa có giá"}</b><div className="text-xs text-neutral-400">Giá trị {money(Number(x.stockQty || 0) * Number(x.unitPrice || 0))}</div></> : <span className="text-neutral-400">Ẩn giá</span>}</div>
                  <button onClick={() => setEditing(x)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Mở / sửa</button>
                </div>)}
              </div>
            </section>
          );
        })}
      </div>

      {!rows.length && <div className="rounded-3xl border bg-white p-12 text-center text-sm text-neutral-400">Chưa có nguyên phụ liệu phù hợp.</div>}
      {editing !== undefined && <ItemModal item={editing} suppliers={suppliers} canManage={canManage} canStock={canStock} canCostView={canCostView} canSupplierIdentity={canSupplierIdentity} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await load(); }} />}
      {importOpen && <AccessoryExcelImportModal items={items} suppliers={suppliers} canCostView={canCostView} canStock={canStock} defaultReceiver={user?.name||user?.fullName||user?.email||""} onClose={() => setImportOpen(false)} onImported={async () => { setImportOpen(false); await load(); }} />}
      {supplierOpen && <SupplierModal rows={suppliers} canSupplierIdentity={canSupplierIdentity} onClose={() => setSupplierOpen(false)} onSaved={load} />}{receiptOpen && <AccessoryReceiptModal items={items} suppliers={suppliers} defaultReceiver={user?.name||user?.fullName||user?.email||""} onClose={()=>setReceiptOpen(false)} onSaved={async()=>{setReceiptOpen(false);await load();}} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl bg-neutral-50 p-4"><div className="text-xs font-semibold uppercase text-neutral-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>;
}


function AccessoryExcelImportModal({ items, suppliers, canCostView, canStock, defaultReceiver, onClose, onImported }: { items: Item[]; suppliers: Supplier[]; canCostView: boolean; canStock: boolean; defaultReceiver: string; onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportAccessoryRow[]>([]);
  const [usePrice, setUsePrice] = useState(canCostView);
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [receivedByName, setReceivedByName] = useState(defaultReceiver);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  function currentForRow(row: ImportAccessoryRow) {
    if (row.code) return items.find((x) => String(x.code || "").trim().toUpperCase() === row.code);
    return items.find((x) => normalizedKey(x.name) === normalizedKey(row.name));
  }

  function clearFile() {
    if (busy) return;
    setFileName("");
    setRows([]);
    setError("");
    setResult("");
  }

  async function readExcel(file: File) {
    try {
      setError("");
      setResult("");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("File Excel không có sheet dữ liệu.");
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const seen = new Set<string>();
      const parsed: ImportAccessoryRow[] = raw.map((r, index) => {
        const code = normalizeText(pickExcel(r, ["Mã NPL", "Mã SKU", "SKU", "Code", "Mã"])).toUpperCase();
        const name = normalizeText(pickExcel(r, ["Tên NPL", "Tên sản phẩm", "Tên", "Name"]));
        const typeName = inferTypeName(name, pickExcel(r, ["Loại", "Phân loại", "Loại NPL", "Type"]));
        const material = normalizeText(pickExcel(r, ["Chất liệu", "Material", "Chất liệu răng"]));
        const teethMaterial = normalizeText(pickExcel(r, ["Loại răng", "Răng chất liệu", "Teeth material"]));
        const zipperGauge = normalizeGauge(pickExcel(r, ["Răng", "Cỡ răng", "Cỡ khóa", "Zipper gauge", "Gauge"]));
        const color = normalizeText(pickExcel(r, ["Màu", "Color", "Màu nền / màu chữ"]));
        const teethColor = normalizeText(pickExcel(r, ["Màu răng", "Teeth color"]));
        const tapeColor = normalizeText(pickExcel(r, ["Màu tape", "Màu vải khóa", "Tape color"]));
        const lengthCm = excelNumber(pickExcel(r, ["Chiều dài", "Chiều dài khóa", "Dài (cm)", "Length cm"]));
        const diameterMm = excelNumber(pickExcel(r, ["Đường kính", "Đường kính (mm)", "Diameter mm"]));
        const widthCm = excelNumber(pickExcel(r, ["Ngang", "Ngang (cm)", "Width cm"]));
        const heightCm = excelNumber(pickExcel(r, ["Dọc", "Dọc (cm)", "Height cm"]));
        let size = normalizeText(pickExcel(r, ["Size", "Size mác", "Cỡ size"])).toUpperCase();
        if (!size && typeName === "Mác Size") size = (name.toUpperCase().match(/(?:^|[-–—\s])(XS|S|M|L|XL|XXL|29|30|31|32|34|36)\s*$/)?.[1] || "").toUpperCase();
        const sizeKindRaw = normalizeText(pickExcel(r, ["Nhóm size", "Loại size", "Size kind"])).toUpperCase();
        const sizeKind = typeName === "Mác Size" ? (sizeKindRaw.includes("QUẦN") || sizeKindRaw.includes("PANT") || PANTS_LABEL_SIZES.includes(size) ? "PANTS" : "SHIRT") : "";
        const specifications: Record<string, any> = {};
        if (material) specifications.material = material;
        if (teethMaterial) specifications.teethMaterial = teethMaterial;
        else if (typeName === "Khóa Kéo" && material) specifications.teethMaterial = material;
        if (zipperGauge) specifications.zipperGauge = zipperGauge;
        if (color) specifications.color = color;
        if (teethColor) specifications.teethColor = teethColor;
        else if (typeName === "Khóa Kéo" && color) specifications.teethColor = color;
        if (tapeColor) specifications.tapeColor = tapeColor;
        if (lengthCm !== null) specifications.lengthCm = lengthCm;
        if (diameterMm !== null) specifications.diameterMm = diameterMm;
        if (widthCm !== null) specifications.widthCm = widthCm;
        if (heightCm !== null) specifications.heightCm = heightCm;
        if (typeName === "Mác Size") {
          specifications.sizeKind = sizeKind;
          specifications.size = size;
        }
        const duplicateKey = code ? `code:${code}` : `name:${normalizedKey(name)}`;
        let rowError = !name ? "Thiếu tên NPL" : typeName === "Mác Size" && !size ? "Mác Size chưa có size" : undefined;
        if (!rowError && duplicateKey && seen.has(duplicateKey)) rowError = "Trùng NPL trong chính file Excel";
        if (duplicateKey) seen.add(duplicateKey);
        return {
          rowNo: index + 2,
          code,
          name,
          typeName,
          unit: normalizeUnit(pickExcel(r, ["Đơn vị", "Unit", "ĐVT"])),
          stockQty: excelNumber(pickExcel(r, ["SL nhập", "Số lượng nhập", "Tồn", "Tồn kho", "Số lượng", "Stock", "Quantity"])),
          unitPrice: excelNumber(pickExcel(r, ["Đơn giá", "Giá", "Unit price", "Price"])),
          supplierText: normalizeText(pickExcel(r, ["NCC", "Nhà cung cấp", "Mã NCC", "Supplier"])),
          specifications,
          note: normalizeText(pickExcel(r, ["Ghi chú", "Note"])),
          error: rowError,
        };
      }).filter((r) => r.code || r.name);
      if (!parsed.length) throw new Error("Không đọc được dòng NPL nào. Kiểm tra hàng tiêu đề trong Excel.");
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setRows([]);
      setFileName("");
      setError(e instanceof Error ? e.message : "Không đọc được Excel.");
    }
  }

  function setImportQty(index: number, value: string) {
    const n = value.trim() === "" ? null : excelNumber(value);
    setRows((old) => old.map((row, i) => i === index ? { ...row, stockQty: n } : row));
  }

  async function importRows() {
    try {
      setBusy(true);
      setError("");
      setResult("");
      const valid = rows.filter((r) => !r.error);
      if (!fileName || !valid.length) throw new Error("Chưa có file Excel hợp lệ để xác nhận.");
      if (!receivedByName.trim()) throw new Error("Phải nhập tên người nhận NPL.");
      const hasIncoming = valid.some((r) => Number(r.stockQty || 0) > 0);
      if (hasIncoming && !canStock) throw new Error("Bạn không có quyền nhập tồn NPL.");
      if (!window.confirm(`Xác nhận file “${fileName}” với ${valid.length} dòng? Tồn kho hiện tại chỉ thay đổi sau lần xác nhận này.`)) return;

      let created = 0;
      let updated = 0;
      const resolved = new Map<string, Item>();
      items.forEach((item) => {
        if (item.code) resolved.set(`code:${String(item.code).trim().toUpperCase()}`, item);
        resolved.set(`name:${normalizedKey(item.name)}`, item);
      });
      const receiptItems: Array<{ accessoryItemId: string; qty: number; unitPrice?: number | null; note?: string | null }> = [];

      for (const row of valid) {
        const key = row.code ? `code:${row.code}` : `name:${normalizedKey(row.name)}`;
        let current = resolved.get(key);
        const supplier = row.supplierText
          ? suppliers.find((s) => [s.code, s.name].some((v) => normalizedKey(v) === normalizedKey(row.supplierText)))
          : undefined;
        const payload: any = {
          ...(row.code ? { code: row.code } : {}),
          name: row.name,
          typeName: row.typeName,
          unit: row.unit,
          specifications: row.specifications,
          note: row.note || null,
          ...(supplier ? { supplierId: supplier.id } : {}),
          ...(usePrice && canCostView && row.unitPrice !== null ? { unitPrice: row.unitPrice } : {}),
          ...(!current ? { stockQty: 0 } : {}),
        };
        const saved = await productionApi<Item>(current ? `/production/accessories/${current.id}` : "/production/accessories", {
          method: current ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        });
        current = saved;
        resolved.set(key, saved);
        if (saved.code) resolved.set(`code:${String(saved.code).trim().toUpperCase()}`, saved);
        resolved.set(`name:${normalizedKey(saved.name)}`, saved);
        if (current && items.some((x) => x.id === current!.id)) updated += 1;
        else created += 1;
        const qty = Number(row.stockQty || 0);
        if (qty > 0) receiptItems.push({ accessoryItemId: saved.id, qty, unitPrice: usePrice && canCostView ? row.unitPrice : null, note: row.note || null });
      }

      let receiptCode = "";
      if (receiptItems.length) {
        const receipt = await productionApi<AccessoryReceipt>("/production/accessory-receipts", {
          method: "POST",
          body: JSON.stringify({
            receivedAt,
            receivedByName: receivedByName.trim(),
            note: `Nhập từ Excel: ${fileName}`,
            items: receiptItems,
          }),
        });
        const posted = await productionApi<AccessoryReceipt>(`/production/accessory-receipts/${receipt.id}/post`, { method: "POST" });
        receiptCode = posted.code || receipt.code;
      }
      setResult(`Đã xác nhận ${fileName}: tạo mới ${created}, cập nhật ${updated}${receiptCode ? ` · nhập kho theo phiếu ${receiptCode}` : " · không có số lượng nhập kho"}.`);
      await onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không nhập được file Excel NPL.");
    } finally {
      setBusy(false);
    }
  }

  const validCount = rows.filter((r) => !r.error).length;
  const totalIncoming = rows.reduce((sum, r) => sum + Math.max(0, Number(r.stockQty || 0)), 0);

  return <Modal title="Nhập NPL từ Excel · kiểm tra trước khi xác nhận" onClose={onClose}>
    <div className="space-y-4 p-5">
      {error && <Err x={error} />}
      {result && <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{result}</div>}
      <div className="rounded-2xl border border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><b className="text-sm">{fileName || "Chọn file Excel NPL"}</b><div className="mt-1 text-xs text-neutral-400">File chỉ được đưa vào vùng chờ. Chưa thay đổi danh mục hay tồn kho cho đến khi bấm Xác nhận.</div></div>
          <div className="flex gap-2">
            {fileName && <button type="button" disabled={busy} onClick={clearFile} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">Xoá file đã tải</button>}
            <label className="cursor-pointer rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"><FileSpreadsheet className="mr-2 inline h-4 w-4" />{fileName ? "Đổi file" : "Chọn Excel"}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onClick={(e) => { e.currentTarget.value = ""; }} onChange={(e) => e.target.files?.[0] && void readExcel(e.target.files[0])}/></label>
          </div>
        </div>
        <div className="mt-3 text-xs text-neutral-500">Cột số lượng trong Excel được hiểu là <b>SL nhập lần này</b>, không phải tồn mới. Tồn gốc trong kho luôn được giữ nguyên cho đến khi xác nhận.</div>
      </div>

      {fileName && <div className="grid gap-3 rounded-2xl bg-neutral-50 p-3 md:grid-cols-3">
        <Field l="Ngày nhận"><input type="date" className={input} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} /></Field>
        <Field l="Người nhận"><input className={input} value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)} /></Field>
        <div className="rounded-xl bg-white p-3 text-sm"><div className="text-xs font-semibold uppercase text-neutral-400">Tổng SL nhập</div><div className="mt-1 text-xl font-semibold">{fmtQty(totalIncoming)}</div></div>
      </div>}

      {canCostView && fileName && <label className="flex items-center gap-2 rounded-2xl bg-neutral-50 p-3 text-sm"><input type="checkbox" checked={usePrice} onChange={(e) => setUsePrice(e.target.checked)}/>Cập nhật đơn giá từ Excel <span className="text-neutral-400">· không ảnh hưởng tồn gốc</span></label>}

      {rows.length > 0 && <div className="max-h-[460px] overflow-auto rounded-2xl border">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-neutral-100"><tr><th className="p-2">Dòng</th><th>Mã</th><th>Tên NPL</th><th>Loại</th><th>Quy cách</th><th className="text-right">Tồn gốc</th><th className="w-32">SL nhập</th><th className="text-right">Sau nhập</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody className="divide-y">{rows.map((r, index) => { const current = currentForRow(r); const original = Number(current?.stockQty || 0); const incoming = Math.max(0, Number(r.stockQty || 0)); return <tr key={`${r.rowNo}-${r.code}-${index}`} className={r.error ? "bg-red-50" : ""}>
            <td className="p-2">{r.rowNo}</td><td className="font-semibold">{r.code || "Tự sinh"}</td><td>{r.name || "—"}</td><td>{r.typeName}</td><td>{specSummary({ ...(current || {}), typeName: r.typeName, specifications: r.specifications } as Item) || "—"}</td>
            <td className="text-right font-semibold">{fmtQty(original)}</td>
            <td><input disabled={busy || !!r.error} inputMode="decimal" className="w-28 rounded-xl border px-2 py-1.5 text-right font-semibold" value={r.stockQty ?? ""} onChange={(e) => setImportQty(index, e.target.value)} /></td>
            <td className="text-right font-semibold text-emerald-700">{fmtQty(original + incoming)}</td>
            <td>{r.error ? <span className="font-semibold text-red-600">{r.error}</span> : <span className="text-emerald-700">{current ? "Cập nhật mã có sẵn" : "Tạo mã mới"}</span>}</td>
            <td><button type="button" disabled={busy} onClick={() => setRows((old) => old.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-600">Bỏ dòng</button></td>
          </tr>; })}</tbody>
        </table>
      </div>}

      <button disabled={busy || !fileName || !validCount} onClick={() => void importRows()} className="w-full rounded-xl bg-neutral-950 py-3 font-semibold text-white disabled:opacity-40">{busy ? "Đang xác nhận..." : `Xác nhận ${validCount} dòng · nhập ${fmtQty(totalIncoming)}`}</button>
    </div>
  </Modal>;
}

function ItemModal({ item, suppliers, canManage, canStock, canCostView, canSupplierIdentity, onClose, onSaved }: { item: Item | null; suppliers: Supplier[]; canManage: boolean; canStock: boolean; canCostView: boolean; canSupplierIdentity: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ code: item?.code || "", name: item?.name || "", typeName: item?.typeName || "Cúc", imageUrl: item?.imageUrl || "", unit: item?.unit || "PIECE", stockQty: item?.stockQty ?? 0, unitPrice: item?.unitPrice ?? "", supplierId: item?.supplierId || "", specifications: item?.specifications || {}, note: item?.note || "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const setSpec = (k: string, v: any) => setF((x: any) => ({ ...x, specifications: { ...(x.specifications || {}), [k]: v } }));

  async function up(file: File) {
    try {
      const r = await uploadProductionImage(file);
      setF((x: any) => ({ ...x, imageUrl: r.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload lỗi");
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError("");
      if (!canManage && !canStock) throw new Error("Bạn không có quyền sửa NPL.");
      if (f.typeName === "Mác Size" && canManage) {
        if (!f.specifications?.sizeKind) throw new Error("Mác Size phải chọn loại size Áo hoặc Quần.");
        if (!f.specifications?.size) throw new Error("Mác Size phải chọn size cụ thể.");
      }
      const payload = {
        ...f,
        ...(!canCostView ? { unitPrice: undefined } : {}),
        ...(!canManage ? { name: item?.name, code: item?.code, typeName: item?.typeName, imageUrl: item?.imageUrl, unit: item?.unit, supplierId: item?.supplierId, specifications: item?.specifications, note: item?.note } : {}),
        ...(!canStock ? { stockQty: item?.stockQty } : {}),
      };
      await productionApi(item ? `/production/accessories/${item.id}` : "/production/accessories", { method: item ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? `Sửa ${item.code}` : "Thêm nguyên phụ liệu"} onClose={onClose}>
      <div className="space-y-4 p-5">
        {error && <Err x={error} />}
        <div className="grid gap-4 md:grid-cols-2">
          <Field l="Mã NPL"><input className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Tự sinh nếu trống" /></Field>
          <Field l="Tên NPL"><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field l="Loại"><select className={input} value={f.typeName} onChange={(e) => setF({ ...f, typeName: e.target.value })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field l="Đơn vị"><select className={input} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
          {(canStock || canManage) && <Field l="Tồn"><input disabled={!canStock && !canManage} type="number" className={input} value={f.stockQty} onChange={(e) => setF({ ...f, stockQty: e.target.value })} /></Field>}
          {canCostView && <Field l="Đơn giá"><input disabled={!canManage} type="number" className={input} value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} /></Field>}
          {canManage && <Field l="NCC NPL"><select className={input} value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}><option value="">Chưa chọn</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{canSupplierIdentity ? `${s.code} · ${s.name || ""}`.trim() : (s.code || "NCC")}</option>)}</select></Field>}
        </div>
        {canManage && <AccessorySpecs typeName={f.typeName} specs={f.specifications || {}} setSpec={setSpec} />}
        <div className="rounded-2xl border border-dashed p-4"><div className="flex justify-between"><b className="text-sm">Ảnh đại diện</b><label className="cursor-pointer rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white"><ImagePlus className="mr-1 inline h-4 w-4" />Tải ảnh<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void up(e.target.files[0])} /></label></div>{f.imageUrl && <img src={asset(f.imageUrl)} className="mt-3 h-36 rounded-2xl object-cover" />}</div>
        <Field l="Ghi chú"><textarea className={`${input} min-h-20`} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button disabled={saving} onClick={() => void save()} className="w-full rounded-xl bg-neutral-950 py-3 font-semibold text-white">{saving ? "Đang lưu..." : "Lưu NPL"}</button>
      </div>
    </Modal>
  );
}


function receiptEsc(v:any){return String(v??"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"} as any)[m]);}
function printAccessoryReceipt(r:AccessoryReceipt,suppliers:Supplier[]){
  const supplier=suppliers.find(x=>x.id===r.supplierId);
  const rows=(r.items||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${receiptEsc(x.accessoryCodeSnapshot)}</td><td>${receiptEsc(x.accessoryNameSnapshot)}</td><td>${Number(x.qty||0).toLocaleString("vi-VN",{maximumFractionDigits:3})}</td><td>${receiptEsc(UNITS.find(u=>u[0]===x.unit)?.[1]||x.unit)}</td><td>${x.unitPrice?Number(x.unitPrice).toLocaleString("vi-VN"):"—"}</td></tr>`).join("");
  const w=window.open("","_blank","noopener,noreferrer,width=1000,height=760");if(!w){window.alert("Trình duyệt đang chặn cửa sổ in.");return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${receiptEsc(r.code)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111}h1{font-size:20px;margin:0 0 5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin:14px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #222;padding:7px}th{background:#f3f3f3}.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;text-align:center;margin-top:55px}.sign div{padding-top:7px;border-top:1px solid #222}@media print{button{display:none}}</style></head><body><button onclick="window.print()">In phiếu</button><h1>THE 1970 · PHIẾU NHẬP NPL</h1><div>Mã phiếu: <b>${receiptEsc(r.code)}</b></div><div class="grid"><div>Ngày nhận: <b>${new Date(r.receivedAt).toLocaleDateString("vi-VN")}</b></div><div>Người nhận: <b>${receiptEsc(r.receivedByName||"—")}</b></div><div>Nhà cung cấp: <b>${receiptEsc(supplier?.name||supplier?.code||"—")}</b></div><div>Người tạo phiếu: <b>${receiptEsc(r.createdByName||"—")}</b></div></div><table><thead><tr><th>STT</th><th>Mã NPL</th><th>Tên NPL</th><th>Số lượng</th><th>Đơn vị</th><th>Đơn giá</th></tr></thead><tbody>${rows}</tbody></table><div class="grid"><div>Ghi chú: <b>${receiptEsc(r.note||"—")}</b></div></div><div class="sign"><div>NGƯỜI GIAO</div><div>NGƯỜI NHẬN</div><div>THỦ KHO / XÁC NHẬN</div></div></body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),250);
}

function AccessoryReceiptModal({items,suppliers,defaultReceiver,onClose,onSaved}:{items:Item[];suppliers:Supplier[];defaultReceiver:string;onClose:()=>void;onSaved:()=>void}){
  const [f,setF]=useState<any>({supplierId:"",receivedAt:new Date().toISOString().slice(0,10),receivedByName:defaultReceiver,note:""});
  const [q,setQ]=useState("");
  const [rows,setRows]=useState<Array<{accessoryItemId:string;qty:string;unitPrice:string}>>([]);
  const [saved,setSaved]=useState<AccessoryReceipt|null>(null);
  const [saving,setSaving]=useState(false),[posting,setPosting]=useState(false),[error,setError]=useState("");
  const posted=String(saved?.status||"")==="POSTED";
  const locked=!!saved;
  const matches=useMemo(()=>{const k=q.trim().toLowerCase();if(!k||locked)return[];return items.filter(x=>[x.code,x.name,x.typeName,specSummary(x)].some(v=>String(v||"").toLowerCase().includes(k))).slice(0,10)},[q,items,locked]);
  function add(item:Item){if(locked)return;if(rows.some(x=>x.accessoryItemId===item.id)){setQ("");return;}setRows(x=>[...x,{accessoryItemId:item.id,qty:"1",unitPrice:item.unitPrice?String(item.unitPrice):""}]);setQ("");}
  async function saveDraft(){
    try{
      setSaving(true);setError("");
      if(!f.receivedByName.trim())throw new Error("Phải nhập tên người nhận.");
      if(!rows.length)throw new Error("Chưa có NPL trong phiếu.");
      const receipt=await productionApi<AccessoryReceipt>("/production/accessory-receipts",{method:"POST",body:JSON.stringify({...f,items:rows.map(x=>({...x,qty:Number(String(x.qty).replace(",","."))||0,unitPrice:x.unitPrice===""?null:Number(String(x.unitPrice).replace(",","."))||0}))})});
      setSaved(receipt);
    }catch(e){setError(e instanceof Error?e.message:"Không lưu được phiếu nhập NPL.");}
    finally{setSaving(false);}
  }
  async function postStock(){
    if(!saved)return;
    try{
      setPosting(true);setError("");
      const receipt=await productionApi<AccessoryReceipt>(`/production/accessory-receipts/${saved.id}/post`,{method:"POST"});
      setSaved(receipt);await onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Không nhập được NPL vào kho.");}
    finally{setPosting(false);}
  }
  return <Modal title={saved?`${saved.code} · Phiếu nhập NPL`:"Tạo phiếu nhập NPL"} onClose={onClose}><div className="space-y-4 p-5">
    {error&&<Err x={error}/>} 
    {saved&&<div className={`rounded-2xl border px-4 py-3 text-sm ${posted?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-amber-200 bg-amber-50 text-amber-800"}`}><b>{posted?"Đã nhập kho":"Phiếu nháp – chưa cộng tồn kho"}</b>{posted&&saved.postedByName?<span> · {saved.postedByName}</span>:null}</div>}
    <div className="grid gap-4 md:grid-cols-2"><Field l="Ngày nhận"><input disabled={locked} type="date" className={input} value={f.receivedAt} onChange={e=>setF({...f,receivedAt:e.target.value})}/></Field><Field l="Người nhận"><input disabled={locked} className={input} value={f.receivedByName} onChange={e=>setF({...f,receivedByName:e.target.value})} placeholder="Tên nhân viên nhận"/></Field><Field l="NCC NPL"><select disabled={locked} className={input} value={f.supplierId} onChange={e=>setF({...f,supplierId:e.target.value})}><option value="">Chưa chọn NCC</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name||""}</option>)}</select></Field></div>
    {!locked&&<div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400"/><input className={`${input} pl-10`} value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm mã / tên NPL để thêm..."/>{matches.length>0&&<div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border bg-white p-1 shadow-xl">{matches.map(x=><button type="button" key={x.id} onClick={()=>add(x)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-50"><b>{x.code}</b> · {x.name}<div className="text-xs text-neutral-400">{x.typeName} · tồn {fmtQty(x.stockQty)}</div></button>)}</div>}</div>}
    <div className="space-y-2">{rows.map((r,i)=>{const item=items.find(x=>x.id===r.accessoryItemId)!;return <div key={r.accessoryItemId} className="grid items-end gap-2 rounded-2xl bg-neutral-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto]"><div><div className="text-xs text-neutral-400">{item.code}</div><b className="text-sm">{item.name}</b></div><Field l="Số lượng"><input disabled={locked} inputMode="decimal" className={input} value={r.qty} onChange={e=>setRows(xs=>xs.map((x,j)=>j===i?{...x,qty:e.target.value}:x))}/></Field><Field l="Đơn giá"><input disabled={locked} inputMode="decimal" className={input} value={r.unitPrice} onChange={e=>setRows(xs=>xs.map((x,j)=>j===i?{...x,unitPrice:e.target.value}:x))}/></Field>{!locked&&<button onClick={()=>setRows(xs=>xs.filter((_,j)=>j!==i))} className="pb-3 text-xs font-semibold text-red-600">Xoá</button>}</div>})}</div>
    <Field l="Ghi chú"><textarea disabled={locked} className={`${input} min-h-20`} value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></Field>
    {!saved?<button disabled={saving} onClick={()=>void saveDraft()} className="w-full rounded-xl bg-neutral-950 py-3 font-semibold text-white disabled:opacity-40">{saving?"Đang lưu...":"Lưu phiếu"}</button>:<div className="grid gap-2 md:grid-cols-2"><button disabled={posting||posted} onClick={()=>void postStock()} className="rounded-xl bg-neutral-950 py-3 font-semibold text-white disabled:opacity-40">{posted?"Đã nhập kho":posting?"Đang nhập kho...":"Nhập kho"}</button><button onClick={()=>printAccessoryReceipt(saved,suppliers)} className="rounded-xl border border-neutral-300 bg-white py-3 font-semibold">In phiếu</button></div>}
  </div></Modal>;
}

function SupplierModal({ rows, canSupplierIdentity, onClose, onSaved }: { rows: Supplier[]; canSupplierIdentity: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: "", code: "", phone: "" });
  const [error, setError] = useState("");
  async function save() {
    try {
      await productionApi("/production/accessory-suppliers", { method: "POST", body: JSON.stringify(f) });
      setF({ name: "", code: "", phone: "" });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được NCC.");
    }
  }
  return <Modal title="NCC nguyên phụ liệu" onClose={onClose}><div className="grid gap-5 p-5 md:grid-cols-2"><div className="max-h-96 overflow-y-auto rounded-2xl border">{rows.map((s) => <div key={s.id} className="border-b p-3 text-sm"><b>{canSupplierIdentity ? `${s.code} · ${s.name || ""}`.trim() : (s.code || "NCC")}</b>{canSupplierIdentity && <div className="text-xs text-neutral-400">{s.phone || ""}</div>}</div>)}</div><div className="space-y-3">{error && <Err x={error} />}<Field l="Tên NCC"><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field l="Mã"><input className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Tự sinh nếu trống" /></Field><Field l="SĐT"><input className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field><button onClick={() => void save()} className="w-full rounded-xl bg-neutral-950 py-2.5 font-semibold text-white">Tạo NCC</button></div></div></Modal>;
}

function AccessorySpecs({ typeName, specs, setSpec }: { typeName: string; specs: any; setSpec: (k: string, v: any) => void }) {
  const isZip = typeName === "Khóa Kéo";
  const isButton = typeName === "Cúc";
  const isLabel = typeName.startsWith("Mác");
  const isSizeLabel = typeName === "Mác Size";
  const attrs = Array.isArray(specs.customAttributes) ? specs.customAttributes : [];
  const setAttrs = (rows: any[]) => setSpec("customAttributes", rows);
  const sizeOptions = specs.sizeKind === "PANTS" ? PANTS_LABEL_SIZES : SHIRT_LABEL_SIZES;

  function changeSizeKind(value: string) {
    setSpec("sizeKind", value);
    const allowed = value === "PANTS" ? PANTS_LABEL_SIZES : SHIRT_LABEL_SIZES;
    if (!allowed.includes(String(specs.size || "").toUpperCase())) setSpec("size", "");
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-neutral-50 p-4">
      <div className="text-sm font-semibold">Thông số kỹ thuật</div>
      <div className="grid gap-4 md:grid-cols-2">
        {isSizeLabel && <><Field l="Nhóm size"><select className={input} value={specs.sizeKind || ""} onChange={(e) => changeSizeKind(e.target.value)}><option value="">Chọn nhóm size</option><option value="SHIRT">Size áo · XS, S, M, L, XL, XXL</option><option value="PANTS">Size quần · 29, 30, 31, 32, 34, 36</option></select></Field><Field l="Size của mác"><select className={input} disabled={!specs.sizeKind} value={specs.size || ""} onChange={(e) => setSpec("size", e.target.value)}><option value="">Chọn size</option>{sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</select></Field></>}
        {isZip && <><Field l="Loại răng khóa"><select className={input} value={specs.teethMaterial || ""} onChange={(e) => setSpec("teethMaterial", e.target.value)}><option value="">Chưa chọn</option><option>Răng Đồng</option><option>Răng Nhựa</option><option>Răng Nylon</option><option>Răng Kim Loại</option></select></Field><Field l="Chất liệu răng"><input className={input} value={specs.material || ""} onChange={(e) => setSpec("material", e.target.value)} placeholder="VD: Đồng thau, hợp kim" /></Field><Field l="Hoàn thiện bề mặt"><input className={input} value={specs.finish || ""} onChange={(e) => setSpec("finish", e.target.value)} placeholder="VD: Antique Brass, Nickel, Gunmetal" /></Field><Field l="Cỡ khóa"><input className={input} value={specs.zipperGauge || ""} onChange={(e) => setSpec("zipperGauge", e.target.value)} placeholder="#3 / #5 / #8" /></Field><Field l="Chiều dài khóa (cm)"><input inputMode="decimal" className={input} value={specs.lengthCm || ""} onChange={(e) => setSpec("lengthCm", e.target.value)} /></Field><Field l="Màu răng"><input className={input} value={specs.teethColor || ""} onChange={(e) => setSpec("teethColor", e.target.value)} /></Field><Field l="Màu tape / vải khóa"><input className={input} value={specs.tapeColor || ""} onChange={(e) => setSpec("tapeColor", e.target.value)} /></Field><Field l="Kiểu khóa"><select className={input} value={specs.zipperStyle || ""} onChange={(e) => setSpec("zipperStyle", e.target.value)}><option value="">Chưa chọn</option><option>1 đầu</option><option>2 đầu</option><option>Khóa kín</option><option>Khóa mở</option></select></Field></>}
        {isButton && <><Field l="Chất liệu cúc"><input className={input} value={specs.material || ""} onChange={(e) => setSpec("material", e.target.value)} placeholder="Kim loại / Nhựa / Sừng / Gỗ / Xà cừ" /></Field><Field l="Màu"><input className={input} value={specs.color || ""} onChange={(e) => setSpec("color", e.target.value)} placeholder="Đen / nâu / bạc..." /></Field><Field l="Kiểu cúc"><input className={input} value={specs.buttonStyle || ""} onChange={(e) => setSpec("buttonStyle", e.target.value)} /></Field><Field l="Đường kính (mm)"><input inputMode="decimal" className={input} value={specs.diameterMm || ""} onChange={(e) => setSpec("diameterMm", e.target.value)} /></Field><Field l="Số lỗ"><select className={input} value={specs.holes || ""} onChange={(e) => setSpec("holes", e.target.value)}><option value="">—</option><option value="2">2</option><option value="4">4</option></select></Field><Field l="Hoàn thiện"><input className={input} value={specs.finish || ""} onChange={(e) => setSpec("finish", e.target.value)} placeholder="Antique / bóng / mờ..." /></Field></>}
        {isLabel && <><Field l="Loại mác"><input className={input} value={specs.labelType || typeName} onChange={(e) => setSpec("labelType", e.target.value)} placeholder="Mác cổ / sườn / size / quần..." /></Field><Field l="Chất liệu mác"><input className={input} value={specs.material || ""} onChange={(e) => setSpec("material", e.target.value)} placeholder="Da / Giả da / Vải dệt / Cotton / Satin" /></Field><Field l="Ngang (cm)"><input inputMode="decimal" className={input} value={specs.widthCm || ""} onChange={(e) => setSpec("widthCm", e.target.value)} /></Field><Field l="Dọc (cm)"><input inputMode="decimal" className={input} value={specs.heightCm || ""} onChange={(e) => setSpec("heightCm", e.target.value)} /></Field><Field l="Kiểu gấp"><select className={input} value={specs.foldStyle || ""} onChange={(e) => setSpec("foldStyle", e.target.value)}><option value="">Chưa chọn</option><option>Thẳng</option><option>Gấp đôi</option><option>Gấp mép</option></select></Field><Field l="Màu nền / màu chữ"><input className={input} value={specs.color || ""} onChange={(e) => setSpec("color", e.target.value)} /></Field></>}
        {!isZip && !isButton && !isLabel && <><Field l="Chất liệu"><input className={input} value={specs.material || ""} onChange={(e) => setSpec("material", e.target.value)} placeholder="VD: Nylon / Cotton / Kim loại..." /></Field><Field l="Màu"><input className={input} value={specs.color || ""} onChange={(e) => setSpec("color", e.target.value)} placeholder="VD: Đen / trắng / nâu..." /></Field><Field l="Quy cách / thông số"><input className={input} value={specs.customSpec || ""} onChange={(e) => setSpec("customSpec", e.target.value)} placeholder="VD: bản 2cm, dày 1mm..." /></Field></>}
      </div>
      {isSizeLabel && <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">Mác size sau khi chọn size sẽ tự lấy đúng số lượng cắt của size đó trong lệnh sản xuất. Không cần chọn “Theo size” thủ công.</div>}
      <div className="rounded-2xl border bg-white p-3"><div className="mb-2 flex items-center justify-between"><div><b className="text-sm">Thuộc tính bổ sung</b><div className="text-xs text-neutral-400">Dùng cho quy cách lạ mà không cần sửa schema.</div></div><button type="button" onClick={() => setAttrs([...attrs, { key: "", value: "" }])} className="rounded-xl border px-3 py-2 text-xs font-semibold">+ Thêm thuộc tính</button></div><div className="space-y-2">{attrs.map((row: any, i: number) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input className={input} value={row.key || ""} onChange={(e) => setAttrs(attrs.map((x: any, j: number) => j === i ? { ...x, key: e.target.value } : x))} placeholder="VD: Độ dày" /><input className={input} value={row.value || ""} onChange={(e) => setAttrs(attrs.map((x: any, j: number) => j === i ? { ...x, value: e.target.value } : x))} placeholder="VD: 1,2 mm" /><button type="button" className="text-xs text-red-600" onClick={() => setAttrs(attrs.filter((_: any, j: number) => j !== i))}>Xoá</button></div>)}</div></div>
    </div>
  );
}

function specSummary(x: Item) {
  const s = x.specifications || {};
  if (x.typeName === "Khóa Kéo") return [s.teethMaterial, s.zipperGauge, s.lengthCm ? `${s.lengthCm}cm` : ""].filter(Boolean).join(" · ");
  if (x.typeName === "Cúc") return [s.material, s.color, s.diameterMm ? `Ø${s.diameterMm}mm` : "", s.finish].filter(Boolean).join(" · ");
  if (x.typeName === "Mác Size") return [s.sizeKind === "PANTS" ? "Size quần" : s.sizeKind === "SHIRT" ? "Size áo" : "", s.size ? `Size ${s.size}` : "", s.material, s.widthCm && s.heightCm ? `${s.widthCm}×${s.heightCm}cm` : ""].filter(Boolean).join(" · ");
  if (x.typeName.startsWith("Mác")) return [s.material, s.widthCm && s.heightCm ? `${s.widthCm}×${s.heightCm}cm` : ""].filter(Boolean).join(" · ");
  return [s.material, s.color, s.customSpec].filter(Boolean).join(" · ");
}

const input = "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900";
function Field({ l, children }: { l: string; children: any }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{l}</span>{children}</label>; }
function Err({ x }: { x: string }) { return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{x}</div>; }
function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"><div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl"><div className="flex justify-between border-b px-5 py-4"><h2 className="font-semibold">{title}</h2><button onClick={onClose} className="h-9 w-9 rounded-xl border">×</button></div>{children}</div></div>; }
