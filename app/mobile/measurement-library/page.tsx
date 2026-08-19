"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { ArrowLeft, Copy, Plus, Ruler, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProductKind = "SHIRT" | "PANTS" | "CUSTOM";
type MeasurementRow = {
  id: string;
  name: string;
  unit: string;
  values: Record<string, string>;
};
type MeasurementTemplate = {
  id: string;
  name: string;
  productKind: ProductKind;
  sizes: string[];
  rows: MeasurementRow[];
  note?: string;
  updatedAt: string;
};

const STORAGE_KEY = "the1970.measurementTemplates.v1";
const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL"];
const PANTS_SIZES = ["29", "30", "31", "32", "33", "34", "36", "38"];

const SHIRT_MEASUREMENT_PRESETS = [
  "1/2 Rộng ngực",
  "1/2 Rộng lai",
  "1/2 Rộng vai",
  "Dài áo",
  "Dài tay",
  "Rộng bắp tay",
  "Rộng cửa tay",
  "Hạ nách",
  "Rộng cổ",
  "Sâu cổ trước",
  "Sâu cổ sau",
  "Cao bo cổ",
  "Rộng bo cổ",
  "Dài bo cổ",
  "Rộng túi ngực",
  "Cao túi ngực",
];

const PANTS_MEASUREMENT_PRESETS = [
  "1/2 Rộng cạp khi để êm",
  "1/2 Rộng cạp khi kéo căng",
  "1/2 Rộng hông (16cm đo từ dưới cạp)",
  "1/2 Đùi",
  "1/2 Rộng ống khi để êm",
  "1/2 Rộng ống khi kéo căng",
  "Dài quần (đo từ cạp đến hết quần)",
  "Dài đứng trước (dưới cạp)",
  "Dài đứng sau (dưới cạp)",
  "Cao cạp",
  "Moi dây kéo (cao x rộng)",
  "Túi trước (cao x rộng)",
  "Túi sau (cao x rộng)",
  "Lót túi sau (cao x rộng)",
  "Lót túi trước (cao x rộng)",
];

const CUSTOM_MEASUREMENT_PRESETS = [
  "Rộng",
  "Dài",
  "Cao",
  "Chu vi",
  "Đường kính",
];

function uid(prefix = "m") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function defaultSizes(kind: ProductKind) {
  return kind === "PANTS" ? [...PANTS_SIZES] : kind === "SHIRT" ? [...SHIRT_SIZES] : [];
}
function loadTemplates(): MeasurementTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function persist(rows: MeasurementTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}
function normalizeDecimal(v: string) {
  return String(v || "").replace(/[^\d,.-]/g, "").replace(".", ",");
}
function blankTemplate(kind: ProductKind = "SHIRT"): MeasurementTemplate {
  return {
    id: uid("tpl"),
    name: "",
    productKind: kind,
    sizes: defaultSizes(kind),
    rows: [],
    note: "",
    updatedAt: new Date().toISOString(),
  };
}

export default function Page() {
  const [templates, setTemplates] = useState<MeasurementTemplate[]>([]);
  const [editing, setEditing] = useState<MeasurementTemplate | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => setTemplates(loadTemplates()), []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return templates;
    return templates.filter((x) =>
      [x.name, x.productKind, ...x.rows.map((r) => r.name)].some((v) =>
        String(v || "").toLowerCase().includes(k),
      ),
    );
  }, [templates, q]);

  function saveTemplate(next: MeasurementTemplate) {
    if (!next.name.trim()) return alert("Điền tên bảng thông số.");
    const clean = {
      ...next,
      name: next.name.trim(),
      sizes: [...new Set(next.sizes.map((x) => String(x).trim()).filter(Boolean))],
      rows: next.rows
        .filter((x) => x.name.trim())
        .map((x) => ({ ...x, name: x.name.trim(), unit: x.unit || "cm" })),
      updatedAt: new Date().toISOString(),
    };
    const rows = [clean, ...templates.filter((x) => x.id !== clean.id)];
    setTemplates(rows);
    persist(rows);
    setEditing(null);
  }

  function removeTemplate(id: string) {
    if (!confirm("Xoá bảng thông số này?")) return;
    const rows = templates.filter((x) => x.id !== id);
    setTemplates(rows);
    persist(rows);
  }

  function duplicate(t: MeasurementTemplate) {
    setEditing({
      ...structuredClone(t),
      id: uid("tpl"),
      name: `${t.name} - Bản sao`,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(12px+env(safe-area-inset-bottom))] text-neutral-950">
      <div className="mx-auto min-h-[100dvh] max-w-md bg-neutral-100">
        <header className="sticky top-0 z-20 border-b bg-white/95 px-4 pb-4 pt-[max(56px,calc(env(safe-area-inset-top)+24px))] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/mobile/production" className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.18em] text-neutral-400">Mẫu mã</div>
                <h1 className="text-xl font-black">Bảng thông số</h1>
              </div>
            </div>
            <button onClick={() => setEditing(blankTemplate("SHIRT"))} className="rounded-2xl bg-neutral-950 px-3 py-2.5 text-xs font-black text-white">
              <Plus className="mr-1 inline h-4 w-4" />Tạo bảng
            </button>
          </div>
          <input
            className="mt-3 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] outline-none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên bảng, thông số..."
          />
        </header>

        <div className="space-y-3 p-4">
          {!filtered.length && (
            <div className="rounded-3xl bg-white p-8 text-center">
              <Ruler className="mx-auto h-8 w-8 text-neutral-300" />
              <div className="mt-3 text-sm font-black">Chưa có bảng thông số</div>
              <div className="mt-1 text-xs text-neutral-400">Tạo bảng đầu tiên rồi dùng lại cho các mẫu sau.</div>
            </div>
          )}

          {filtered.map((t) => (
            <article key={t.id} className="rounded-[28px] bg-white p-4 shadow-sm">
              <button className="w-full text-left" onClick={() => setEditing(structuredClone(t))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                      {t.productKind === "PANTS" ? "Quần" : t.productKind === "SHIRT" ? "Áo" : "Tự chọn"}
                    </div>
                    <div className="mt-1 font-black">{t.name}</div>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black">{t.sizes.length} size</span>
                </div>
                <div className="mt-3 flex gap-1.5 overflow-x-auto">
                  {t.sizes.map((s) => <span key={s} className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-black">{s}</span>)}
                </div>
                <div className="mt-2 text-xs text-neutral-500">{t.rows.length} dòng thông số</div>
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <button onClick={() => duplicate(t)} className="rounded-xl border py-2 text-xs font-black"><Copy className="mr-1 inline h-3.5 w-3.5"/>Nhân bản</button>
                <button onClick={() => removeTemplate(t.id)} className="rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-black text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5"/>Xoá</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {editing && <TemplateEditor template={editing} onClose={() => setEditing(null)} onSave={saveTemplate} />}
      {!editing && <div className="relative z-40"><MobileBottomNav /></div>}
    </main>
  );
}

function TemplateEditor({ template, onClose, onSave }: { template: MeasurementTemplate; onClose: () => void; onSave: (t: MeasurementTemplate) => void }) {
  const [f, setF] = useState<MeasurementTemplate>(template);
  const [newSize, setNewSize] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);

  function changeKind(kind: ProductKind) {
    const sizes = defaultSizes(kind);
    setF((x) => ({
      ...x,
      productKind: kind,
      sizes,
      rows: x.rows.map((r) => ({
        ...r,
        values: Object.fromEntries(sizes.map((s) => [s, r.values?.[s] || ""])),
      })),
    }));
  }

  function addRow() {
    setF((x) => ({
      ...x,
      rows: [...x.rows, { id: uid("row"), name: "", unit: "cm", values: Object.fromEntries(x.sizes.map((s) => [s, ""])) }],
    }));
  }

  function addSize() {
    const s = newSize.trim().toUpperCase();
    if (!s || f.sizes.includes(s)) return;
    setF((x) => ({
      ...x,
      sizes: [...x.sizes, s],
      rows: x.rows.map((r) => ({ ...r, values: { ...r.values, [s]: "" } })),
    }));
    setNewSize("");
  }

  function removeSize(size: string) {
    setF((x) => ({
      ...x,
      sizes: x.sizes.filter((s) => s !== size),
      rows: x.rows.map((r) => {
        const values = { ...r.values };
        delete values[size];
        return { ...r, values };
      }),
    }));
  }

  const presets =
    f.productKind === "PANTS"
      ? PANTS_MEASUREMENT_PRESETS
      : f.productKind === "SHIRT"
        ? SHIRT_MEASUREMENT_PRESETS
        : CUSTOM_MEASUREMENT_PRESETS;

  function addPreset(name: string) {
    if (f.rows.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase())) return;
    setF((x) => ({
      ...x,
      rows: [
        ...x.rows,
        {
          id: uid("row"),
          name,
          unit: "cm",
          values: Object.fromEntries(x.sizes.map((s) => [s, ""])),
        },
      ],
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/45 p-3 pb-[max(16px,env(safe-area-inset-bottom))]" style={{ WebkitOverflowScrolling: "touch", touchAction: "auto" }}>
      <div className="mx-auto max-w-md overflow-hidden rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white p-4">
          <div>
            <div className="text-[10px] font-black uppercase text-neutral-400">Thư viện thông số</div>
            <div className="font-black">{f.name || "Bảng mới"}</div>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-4 w-4"/></button>
        </div>

        <div className="space-y-4 p-4">
          <label className="block">
            <span className={label}>Tên bảng</span>
            <input className={input} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="VD: Quần Short Kaki Relaxed" />
          </label>

          <div>
            <div className={label}>Loại bảng / hệ size</div>
            <div className="grid grid-cols-3 gap-2">
              {([["SHIRT", "Áo"], ["PANTS", "Quần"], ["CUSTOM", "Tự chọn"]] as const).map(([k, t]) => (
                <button key={k} onClick={() => changeKind(k)} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${f.productKind === k ? "border-neutral-950 bg-neutral-950 text-white" : ""}`}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <div className={label}>Size</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {f.sizes.map((s) => (
                <button key={s} onClick={() => removeSize(s)} className="shrink-0 rounded-full bg-neutral-950 px-3 py-2 text-xs font-black text-white">{s} ×</button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={input} value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="Thêm size" />
              <button onClick={addSize} className="shrink-0 rounded-xl border px-4 text-xs font-black">+ Size</button>
            </div>
          </div>

          <div className="rounded-3xl border">
            <div className="border-b p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black">Thông số</div>
                  <div className="text-[10px] text-neutral-400">Thông số chạy dọc, size chạy ngang.</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPresetOpen((x) => !x)} className="rounded-xl border px-3 py-2 text-xs font-black">
                    + Chọn thông số
                  </button>
                  <button onClick={addRow} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white">+ Dòng</button>
                </div>
              </div>

              {presetOpen && (
                <div className="mt-3 rounded-2xl bg-neutral-50 p-2">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-neutral-400">
                    Thư viện thông số {f.productKind === "PANTS" ? "quần" : f.productKind === "SHIRT" ? "áo" : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((name) => {
                      const selected = f.rows.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() => addPreset(name)}
                          disabled={selected}
                          className={`rounded-full border px-3 py-2 text-[11px] font-black ${
                            selected
                              ? "border-neutral-200 bg-neutral-200 text-neutral-400"
                              : "border-neutral-300 bg-white text-neutral-800"
                          }`}
                        >
                          {selected ? "✓ " : "+ "}{name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pinch-zoom" }}>
              <div style={{ minWidth: Math.max(520, 190 + f.sizes.length * 88) }}>
                <div className="grid border-b bg-neutral-50" style={{ gridTemplateColumns: `190px repeat(${f.sizes.length},88px)` }}>
                  <div className="sticky left-0 z-20 border-r bg-neutral-50 p-3 text-[10px] font-black uppercase text-neutral-400">Thông số</div>
                  {f.sizes.map((s) => <div key={s} className="border-r p-3 text-center text-xs font-black">{s}</div>)}
                </div>

                {f.rows.map((row, ri) => (
                  <div key={row.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `190px repeat(${f.sizes.length},88px)` }}>
                    <div className="sticky left-0 z-10 border-r bg-white p-2">
                      <input className="w-full rounded-xl border px-2 py-2 text-[14px] font-bold outline-none" value={row.name} onChange={(e) => setF((x) => ({ ...x, rows: x.rows.map((r, i) => i === ri ? { ...r, name: e.target.value } : r) }))} placeholder="Tên thông số" />
                      <div className="mt-1 flex gap-1">
                        <input className="w-16 rounded-lg border px-2 py-1 text-[11px]" value={row.unit} onChange={(e) => setF((x) => ({ ...x, rows: x.rows.map((r, i) => i === ri ? { ...r, unit: e.target.value } : r) }))} placeholder="cm" />
                        <button onClick={() => setF((x) => ({ ...x, rows: x.rows.filter((_, i) => i !== ri) }))} className="ml-auto text-[10px] font-black text-red-600">Xoá</button>
                      </div>
                    </div>
                    {f.sizes.map((size) => (
                      <div key={size} className="border-r p-1.5">
                        <input
                          inputMode="decimal"
                          className="h-12 w-full rounded-xl border px-2 text-center text-[16px] font-black outline-none focus:border-neutral-950"
                          value={row.values?.[size] || ""}
                          onChange={(e) => setF((x) => ({ ...x, rows: x.rows.map((r, i) => i === ri ? { ...r, values: { ...r.values, [size]: normalizeDecimal(e.target.value) } } : r) }))}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                {!f.rows.length && <div className="p-8 text-center text-xs font-bold text-neutral-400">Bấm “+ Dòng” để nhập thông số đầu tiên.</div>}
              </div>
            </div>
          </div>

          <label className="block">
            <span className={label}>Ghi chú</span>
            <textarea className={`${input} min-h-20`} value={f.note || ""} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
          </label>

          <button onClick={() => onSave(f)} className="w-full rounded-2xl bg-neutral-950 py-3.5 text-sm font-black text-white"><Save className="mr-1 inline h-4 w-4"/>Lưu bảng thông số</button>
        </div>
      </div>
    </div>
  );
}

const label = "mb-1.5 block text-[10px] font-black uppercase tracking-wide text-neutral-400";
const input = "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-neutral-950";
