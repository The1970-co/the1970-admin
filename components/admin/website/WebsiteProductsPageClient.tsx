"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createWebsiteProduct,
  deleteWebsiteProduct,
  getWebsiteProducts,
  searchMasterProducts,
  updateWebsiteProduct,
  uploadWebsiteImage,
  type WebsiteImageDraft,
  type WebsiteProductPayload,
} from "@/lib/website-products-api";

type MasterProduct = {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string | null;
  category?: string | null;
  variants?: Array<{ id: string; sku: string; color?: string; size?: string; price?: number }>;
};

type WebsiteRow = WebsiteProductPayload & {
  id: string;
  product?: MasterProduct;
  updatedAt?: string;
};

const EMPTY: WebsiteProductPayload = {
  productId: "",
  slug: "",
  status: "DRAFT",
  marketVn: true,
  marketInternational: false,
  featured: false,
  sortOrder: 0,
  titleVi: "",
  titleEn: "",
  shortDescriptionVi: "",
  shortDescriptionEn: "",
  descriptionVi: "",
  descriptionEn: "",
  coverImageUrl: "",
  seoTitleVi: "",
  seoTitleEn: "",
  seoDescriptionVi: "",
  seoDescriptionEn: "",
  images: [],
};

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-neutral-700">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-[11px] text-neutral-400">{hint}</div> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600";
const textareaClass =
  "min-h-[110px] w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600";


type ImageResizeMode = "STANDARD" | "MB" | "PERCENT" | "ORIGINAL";

type ImageResizeSettings = {
  mode: ImageResizeMode;
  targetMb: number;
  percent: number;
};

const DEFAULT_IMAGE_RESIZE: ImageResizeSettings = {
  mode: "STANDARD",
  targetMb: 2,
  percent: 75,
};

function loadBrowserImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không thể xử lý ảnh."))),
      "image/webp",
      quality,
    );
  });
}

async function resizeImageForWebsite(file: File, settings: ImageResizeSettings): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: không phải file ảnh.`);
  if (settings.mode === "ORIGINAL") return file;

  const img = await loadBrowserImage(file);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  if (!originalWidth || !originalHeight) throw new Error(`${file.name}: không đọc được kích thước ảnh.`);

  let width = originalWidth;
  let height = originalHeight;

  if (settings.mode === "STANDARD") {
    const scale = Math.min(1, 2200 / originalWidth, 2800 / originalHeight);
    width = Math.max(1, Math.round(originalWidth * scale));
    height = Math.max(1, Math.round(originalHeight * scale));
  } else if (settings.mode === "PERCENT") {
    const scale = Math.min(1, Math.max(0.05, settings.percent / 100));
    width = Math.max(1, Math.round(originalWidth * scale));
    height = Math.max(1, Math.round(originalHeight * scale));
  } else if (settings.mode === "MB") {
    // Bắt đầu giữ nguyên kích thước; nếu cần sẽ giảm dần cả quality và kích thước.
    width = originalWidth;
    height = originalHeight;
  }

  const render = async (w: number, h: number, quality: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    ctx.drawImage(img, 0, 0, w, h);
    return canvasToBlob(canvas, quality);
  };

  let quality = 0.88;
  let blob = await render(width, height, quality);

  if (settings.mode === "MB") {
    const targetBytes = Math.max(0.25, settings.targetMb) * 1024 * 1024;
    let attempts = 0;
    while (blob.size > targetBytes && attempts < 10) {
      attempts += 1;
      if (quality > 0.62) {
        quality = Math.max(0.62, quality - 0.07);
      } else {
        width = Math.max(640, Math.round(width * 0.88));
        height = Math.max(640, Math.round(height * 0.88));
      }
      blob = await render(width, height, quality);
      if (width <= 640 || height <= 640) break;
    }
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function WebsiteProductsPageClient() {
  const [rows, setRows] = useState<WebsiteRow[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebsiteProductPayload>(EMPTY);
  const [masterQuery, setMasterQuery] = useState("");
  const [masters, setMasters] = useState<MasterProduct[]>([]);
  const [masterOpen, setMasterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [imageResize, setImageResize] = useState<ImageResizeSettings>(DEFAULT_IMAGE_RESIZE);

  const selectedMaster = useMemo(
    () => masters.find((x) => x.id === form.productId) || rows.find((x) => x.productId === form.productId)?.product || null,
    [masters, rows, form.productId],
  );

  async function load() {
    try {
      setRows(await getWebsiteProducts(query));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không tải được sản phẩm website.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const q = masterQuery.trim();
    if (q.length < 2) {
      setMasters([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setMasters(await searchMasterProducts(q));
      } catch {
        setMasters([]);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [masterQuery]);

  function chooseMaster(product: MasterProduct) {
    setForm((prev) => ({
      ...prev,
      productId: product.id,
      titleVi: prev.titleVi || product.name,
      slug: prev.slug || slugify(product.name),
      coverImageUrl: prev.coverImageUrl || product.imageUrl || "",
    }));
    setMasterQuery(product.name);
    setMasterOpen(false);
  }

  function edit(row: WebsiteRow) {
    setEditingId(row.id);
    setForm({
      productId: row.productId,
      slug: row.slug || "",
      status: row.status || "DRAFT",
      marketVn: row.marketVn !== false,
      marketInternational: row.marketInternational === true,
      featured: row.featured === true,
      sortOrder: Number(row.sortOrder || 0),
      titleVi: row.titleVi || row.product?.name || "",
      titleEn: row.titleEn || "",
      shortDescriptionVi: row.shortDescriptionVi || "",
      shortDescriptionEn: row.shortDescriptionEn || "",
      descriptionVi: row.descriptionVi || "",
      descriptionEn: row.descriptionEn || "",
      coverImageUrl: row.coverImageUrl || "",
      seoTitleVi: row.seoTitleVi || "",
      seoTitleEn: row.seoTitleEn || "",
      seoDescriptionVi: row.seoDescriptionVi || "",
      seoDescriptionEn: row.seoDescriptionEn || "",
      images: Array.isArray(row.images) ? row.images : [],
    });
    setMasterQuery(row.product?.name || row.titleVi || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
    setMasterQuery("");
    setMasters([]);
    setMessage("");
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      setUploading(true);
      setMessage("Đang upload ảnh...");
      const next: WebsiteImageDraft[] = [];
      const sourceFiles = Array.from(files);
      for (let index = 0; index < sourceFiles.length; index += 1) {
        const file = sourceFiles[index];
        setMessage(`Đang xử lý ảnh ${index + 1}/${sourceFiles.length}: ${file.name}...`);
        const prepared = await resizeImageForWebsite(file, imageResize);
        setMessage(`Đang upload ảnh ${index + 1}/${sourceFiles.length}: ${mb(file.size)} → ${mb(prepared.size)}...`);
        const url = await uploadWebsiteImage(prepared);
        next.push({ url, sortOrder: form.images.length + next.length });
      }
      setForm((prev) => ({
        ...prev,
        coverImageUrl: prev.coverImageUrl || next[0]?.url || "",
        images: [...prev.images, ...next],
      }));
      setMessage(`Đã upload ${next.length} ảnh.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  }

  async function save(status?: "DRAFT" | "PUBLISHED") {
    if (!form.productId) return setMessage("Chưa chọn sản phẩm nội bộ.");
    if (!form.titleVi.trim()) return setMessage("Thiếu tên sản phẩm hiển thị.");
    if (!form.slug.trim()) return setMessage("Thiếu slug.");
    const payload = { ...form, status: status || form.status };
    try {
      setSaving(true);
      setMessage("");
      if (editingId) await updateWebsiteProduct(editingId, payload);
      else await createWebsiteProduct(payload);
      setMessage(status === "PUBLISHED" ? "Đã xuất bản sản phẩm lên website." : "Đã lưu sản phẩm website.");
      await load();
      reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không lưu được sản phẩm.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Website</div>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Sản phẩm website</h1>
          <p className="mt-1 text-sm text-neutral-500">Chọn sản phẩm master, thêm nội dung và ảnh dành riêng cho website.</p>
        </div>
        <button onClick={reset} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">+ Bài sản phẩm mới</button>
      </div>

      {message ? <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">1. Sản phẩm & hình ảnh</h2>

          <div className="mt-4 relative">
            <Field label="Sản phẩm trong hệ thống" hint="SKU, màu, size, giá và tồn kho vẫn lấy từ sản phẩm này.">
              <input
                className={inputClass}
                value={masterQuery}
                disabled={Boolean(editingId)}
                onFocus={() => setMasterOpen(true)}
                onChange={(e) => { setMasterQuery(e.target.value); setMasterOpen(true); }}
                placeholder="Tìm tên sản phẩm hoặc SKU..."
              />
            </Field>
            {masterOpen && masterQuery.trim().length >= 2 && !editingId ? (
              <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
                {masters.length ? masters.map((p) => (
                  <button key={p.id} onClick={() => chooseMaster(p)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-50">
                    <div className="h-12 w-10 overflow-hidden rounded-md bg-neutral-100">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-neutral-400">{p.variants?.slice(0, 4).map((v) => v.sku).join(" · ") || p.slug}</div>
                    </div>
                  </button>
                )) : <div className="p-3 text-sm text-neutral-400">Không có kết quả.</div>}
              </div>
            ) : null}
          </div>

          {selectedMaster ? (
            <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
              <b>{selectedMaster.name}</b> · {selectedMaster.variants?.length || 0} variants
            </div>
          ) : null}

          <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-xs font-semibold text-neutral-700">Tối ưu ảnh trước khi upload</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <button type="button" onClick={() => setImageResize((p) => ({ ...p, mode: "STANDARD" }))} className={`rounded-lg border px-3 py-2 text-xs ${imageResize.mode === "STANDARD" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Chuẩn web</button>
              <button type="button" onClick={() => setImageResize((p) => ({ ...p, mode: "MB" }))} className={`rounded-lg border px-3 py-2 text-xs ${imageResize.mode === "MB" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Theo MB</button>
              <button type="button" onClick={() => setImageResize((p) => ({ ...p, mode: "PERCENT" }))} className={`rounded-lg border px-3 py-2 text-xs ${imageResize.mode === "PERCENT" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Theo %</button>
              <button type="button" onClick={() => setImageResize((p) => ({ ...p, mode: "ORIGINAL" }))} className={`rounded-lg border px-3 py-2 text-xs ${imageResize.mode === "ORIGINAL" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Giữ ảnh gốc</button>
            </div>
            <div className="mt-3 text-[11px] text-neutral-500">
              {imageResize.mode === "STANDARD" ? "Tối đa 2200 × 2800 px, không phóng ảnh nhỏ, xuất WebP quality 88%." : null}
              {imageResize.mode === "ORIGINAL" ? "Upload nguyên file, không resize và không đổi định dạng." : null}
            </div>
            {imageResize.mode === "MB" ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-neutral-600">Dung lượng mục tiêu</span>
                <select className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs" value={imageResize.targetMb} onChange={(e) => setImageResize((p) => ({ ...p, targetMb: Number(e.target.value) }))}>
                  <option value={0.5}>0.5 MB</option><option value={1}>1 MB</option><option value={1.5}>1.5 MB</option><option value={2}>2 MB</option><option value={3}>3 MB</option><option value={5}>5 MB</option>
                </select>
                <span className="text-[11px] text-neutral-400">Hệ thống tự giảm quality/kích thước để tiến gần mức này.</span>
              </div>
            ) : null}
            {imageResize.mode === "PERCENT" ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-neutral-600">Kích thước</span>
                <select className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs" value={imageResize.percent} onChange={(e) => setImageResize((p) => ({ ...p, percent: Number(e.target.value) }))}>
                  <option value={25}>25%</option><option value={40}>40%</option><option value={50}>50%</option><option value={60}>60%</option><option value={75}>75%</option><option value={90}>90%</option><option value={100}>100%</option>
                </select>
                <span className="text-[11px] text-neutral-400">Giữ đúng tỉ lệ ảnh gốc, xuất WebP quality 88%.</span>
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-700">Gallery sản phẩm</div>
                <div className="text-[11px] text-neutral-400">Ảnh đầu tiên sẽ tự làm cover nếu chưa chọn cover.</div>
              </div>
              <label className="cursor-pointer rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white">
                {uploading ? "Đang upload..." : "+ Thêm ảnh"}
                <input className="hidden" type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => void uploadFiles(e.target.files)} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.images.map((image, index) => (
                <div key={`${image.url}-${index}`} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-neutral-100">
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setForm((p) => ({ ...p, coverImageUrl: image.url }))}
                    className={`absolute left-1 top-1 rounded-md px-2 py-1 text-[10px] ${form.coverImageUrl === image.url ? "bg-black text-white" : "bg-white/90"}`}
                  >Cover</button>
                  <button
                    onClick={() => setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== index), coverImageUrl: p.coverImageUrl === image.url ? "" : p.coverImageUrl }))}
                    className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-1 text-[10px]"
                  >Xóa</button>
                </div>
              ))}
              {!form.images.length ? <div className="col-span-full rounded-xl border border-dashed border-neutral-300 py-10 text-center text-xs text-neutral-400">Chưa có ảnh website.</div> : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">2. Nội dung hiển thị</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Tên tiếng Việt"><input className={inputClass} value={form.titleVi} onChange={(e) => setForm({ ...form, titleVi: e.target.value })} /></Field>
            <Field label="Tên tiếng Anh"><input className={inputClass} value={form.titleEn || ""} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="Slug"><input className={inputClass} value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></Field></div>
            <Field label="Mô tả ngắn VI"><textarea className={textareaClass} value={form.shortDescriptionVi || ""} onChange={(e) => setForm({ ...form, shortDescriptionVi: e.target.value })} /></Field>
            <Field label="Mô tả ngắn EN"><textarea className={textareaClass} value={form.shortDescriptionEn || ""} onChange={(e) => setForm({ ...form, shortDescriptionEn: e.target.value })} /></Field>
            <Field label="Nội dung VI"><textarea className="min-h-[180px] w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none" value={form.descriptionVi || ""} onChange={(e) => setForm({ ...form, descriptionVi: e.target.value })} /></Field>
            <Field label="Nội dung EN"><textarea className="min-h-[180px] w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none" value={form.descriptionEn || ""} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} /></Field>
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <div className="text-xs font-semibold text-neutral-700">Thị trường & hiển thị</div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.marketVn} onChange={(e) => setForm({ ...form, marketVn: e.target.checked })} /> Việt Nam (.vn)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.marketInternational} onChange={(e) => setForm({ ...form, marketInternational: e.target.checked })} /> Quốc tế (.co)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Nổi bật</label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Thứ tự"><input type="number" className={inputClass} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value || 0) })} /></Field>
              <Field label="Trạng thái">
                <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as WebsiteProductPayload["status"] })}>
                  <option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã xuất bản</option><option value="ARCHIVED">Lưu trữ</option>
                </select>
              </Field>
            </div>
          </div>

          <details className="mt-5 border-t border-neutral-200 pt-5">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-700">SEO</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="SEO title VI"><input className={inputClass} value={form.seoTitleVi || ""} onChange={(e) => setForm({ ...form, seoTitleVi: e.target.value })} /></Field>
              <Field label="SEO title EN"><input className={inputClass} value={form.seoTitleEn || ""} onChange={(e) => setForm({ ...form, seoTitleEn: e.target.value })} /></Field>
              <Field label="SEO description VI"><textarea className={textareaClass} value={form.seoDescriptionVi || ""} onChange={(e) => setForm({ ...form, seoDescriptionVi: e.target.value })} /></Field>
              <Field label="SEO description EN"><textarea className={textareaClass} value={form.seoDescriptionEn || ""} onChange={(e) => setForm({ ...form, seoDescriptionEn: e.target.value })} /></Field>
            </div>
          </details>

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
            <button disabled={saving} onClick={() => void save("DRAFT")} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm">Lưu nháp</button>
            <button disabled={saving} onClick={() => void save("PUBLISHED")} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white">{saving ? "Đang lưu..." : "Xuất bản"}</button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Sản phẩm đã tạo trên website</h2>
          <div className="flex gap-2">
            <input className="rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="Tìm tên / slug / SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button onClick={() => void load()} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm">Tìm</button>
          </div>
        </div>
        <div className="mt-4 divide-y divide-neutral-100">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-4 py-3">
              <div className="h-16 w-14 overflow-hidden rounded-lg bg-neutral-100">{row.coverImageUrl ? <img src={row.coverImageUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
              <div className="min-w-[220px] flex-1">
                <div className="font-medium">{row.titleVi}</div>
                <div className="mt-1 text-xs text-neutral-400">/{row.slug} · {row.product?.variants?.length || 0} variants</div>
              </div>
              <div className="text-xs"><span className={`rounded-full px-2.5 py-1 ${row.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"}`}>{row.status}</span></div>
              <div className="text-xs text-neutral-500">{row.marketVn ? "VN" : ""}{row.marketVn && row.marketInternational ? " · " : ""}{row.marketInternational ? "INTL" : ""}</div>
              <button onClick={() => edit(row)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs">Sửa</button>
              <button onClick={async () => { if (!window.confirm("Xóa bài sản phẩm website này?")) return; await deleteWebsiteProduct(row.id); await load(); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600">Xóa</button>
            </div>
          ))}
          {!rows.length ? <div className="py-10 text-center text-sm text-neutral-400">Chưa có sản phẩm website.</div> : null}
        </div>
      </section>
    </div>
  );
}
