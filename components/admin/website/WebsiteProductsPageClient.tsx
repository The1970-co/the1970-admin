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
import { useAuth } from "@/components/admin/auth/AuthProvider";

type MasterProduct = {
  id: string;
  name?: string;
  slug?: string;
  category?: string;
  categoryRel?: { name?: string } | null;
  variants?: Array<{
    id?: string;
    sku?: string;
    color?: string;
    size?: string;
    price?: number | string;
    inventoryItems?: Array<{
      availableQty?: number | string;
      reservedQty?: number | string;
    }>;
  }>;
};

type WebsiteRow = {
  id: string;
  productId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketVn?: boolean;
  featured?: boolean;
  sortOrder?: number;
  titleVi?: string;
  shortDescriptionVi?: string | null;
  descriptionVi?: string | null;
  coverImageUrl?: string | null;
  images?: Array<{
    id?: string;
    url: string;
    altVi?: string | null;
    sortOrder?: number;
  }>;
  product?: MasterProduct;
};

type FormState = {
  id?: string;
  productId: string;
  master?: MasterProduct;
  titleVi: string;
  slug: string;
  shortDescriptionVi: string;
  descriptionVi: string;
  status: "DRAFT" | "PUBLISHED";
  featured: boolean;
  sortOrder: number;
  coverImageUrl: string;
  images: WebsiteImageDraft[];
};

const emptyForm = (): FormState => ({
  productId: "",
  titleVi: "",
  slug: "",
  shortDescriptionVi: "",
  descriptionVi: "",
  status: "DRAFT",
  featured: false,
  sortOrder: 0,
  coverImageUrl: "",
  images: [],
});

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(n)
    : "—";
}

function masterCategory(p?: MasterProduct) {
  return p?.categoryRel?.name || p?.category || "Chưa có danh mục";
}

function masterPrice(p?: MasterProduct) {
  const prices = (p?.variants || [])
    .map((v) => Number(v.price || 0))
    .filter((x) => Number.isFinite(x) && x > 0);
  if (!prices.length) return "Chưa có giá";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money(min) : `${money(min)} – ${money(max)}`;
}

function masterStockState(p?: MasterProduct) {
  const variants = p?.variants || [];
  if (!variants.length) return "Chưa có biến thể";
  let available = 0;
  for (const v of variants) {
    const qty = (v.inventoryItems || []).reduce((sum, x) => {
      const a = Number(x.availableQty || 0);
      const r = Number(x.reservedQty || 0);
      return sum + Math.max(0, a - r);
    }, 0);
    if (qty > 0) available += 1;
  }
  return available > 0
    ? `${available}/${variants.length} biến thể còn hàng`
    : "Hết hàng";
}


function websiteCategoryGroup(row: WebsiteRow) {
  const raw = masterCategory(row.product).trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

  if (
    normalized.includes("ao ") ||
    normalized === "ao" ||
    normalized.includes("shirt") ||
    normalized.includes("tee") ||
    normalized.includes("polo") ||
    normalized.includes("jacket") ||
    normalized.includes("blazer")
  ) {
    return "Áo";
  }

  if (
    normalized.includes("quan") ||
    normalized.includes("pants") ||
    normalized.includes("denim") ||
    normalized.includes("jean") ||
    normalized.includes("chino") ||
    normalized.includes("short")
  ) {
    return "Quần";
  }

  if (
    normalized.includes("balo") ||
    normalized.includes("backpack") ||
    normalized.includes("tui") ||
    normalized.includes("bag")
  ) {
    return "Balo & Túi";
  }

  if (
    normalized.includes("phu kien") ||
    normalized.includes("accessor") ||
    normalized.includes("mu ") ||
    normalized === "mu" ||
    normalized.includes("that lung") ||
    normalized.includes("belt")
  ) {
    return "Phụ kiện";
  }

  return raw || "Khác";
}

const CATEGORY_GROUP_ORDER = ["Áo", "Quần", "Balo & Túi", "Phụ kiện"];

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "neutral";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

export default function WebsiteProductsPageClient() {
  const { can } = useAuth();
  const canEdit = can("website.edit");
  const canDelete = can("website.delete");
  const canPublish = can("website.publish");
  const canUpload = can("website.image.upload");
  const [rows, setRows] = useState<WebsiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [masterQuery, setMasterQuery] = useState("");
  const [masterResults, setMasterResults] = useState<MasterProduct[]>([]);
  const [searchingMaster, setSearchingMaster] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await getWebsiteProducts(query.trim());
      setRows(Array.isArray(data) ? data : data?.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được sản phẩm website.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!editorOpen || form.id || masterQuery.trim().length < 2) {
      setMasterResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSearchingMaster(true);
        const result = await searchMasterProducts(masterQuery.trim());
        setMasterResults(Array.isArray(result) ? result : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tìm được sản phẩm nội bộ.");
      } finally {
        setSearchingMaster(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [masterQuery, editorOpen, form.id]);

  function openCreate() {
    setError("");
    setForm(emptyForm());
    setMasterQuery("");
    setMasterResults([]);
    setEditorOpen(true);
  }

  function openEdit(row: WebsiteRow) {
    const imgs: WebsiteImageDraft[] = (row.images || []).map((x, index) => ({
      url: x.url,
      altVi: x.altVi || "",
      sortOrder: index,
    }));
    setError("");
    setForm({
      id: row.id,
      productId: row.productId,
      master: row.product,
      titleVi: row.titleVi || row.product?.name || "",
      slug: row.slug || "",
      shortDescriptionVi: row.shortDescriptionVi || "",
      descriptionVi: row.descriptionVi || "",
      status: row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      featured: row.featured === true,
      sortOrder: Number(row.sortOrder || 0),
      coverImageUrl: row.coverImageUrl || imgs[0]?.url || "",
      images: imgs,
    });
    setMasterQuery(row.product?.name || "");
    setMasterResults([]);
    setEditorOpen(true);
  }

  function chooseMaster(p: MasterProduct) {
    const title = p.name || "";
    setForm((old) => ({
      ...old,
      productId: p.id,
      master: p,
      titleVi: old.titleVi || title,
      slug: old.slug || slugify(title || p.slug || ""),
    }));
    setMasterQuery(title);
    setMasterResults([]);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    try {
      setUploading(true);
      setError("");
      const uploaded: WebsiteImageDraft[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadWebsiteImage(file);
        uploaded.push({ url, altVi: form.titleVi || "", sortOrder: 0 });
      }
      setForm((old) => {
        const next = [...old.images, ...uploaded].map((x, index) => ({
          ...x,
          sortOrder: index,
        }));
        return {
          ...old,
          images: next,
          coverImageUrl: old.coverImageUrl || uploaded[0]?.url || "",
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setForm((old) => {
      const removed = old.images[index]?.url;
      const images = old.images
        .filter((_, i) => i !== index)
        .map((x, i) => ({ ...x, sortOrder: i }));
      const coverImageUrl =
        old.coverImageUrl === removed ? images[0]?.url || "" : old.coverImageUrl;
      return { ...old, images, coverImageUrl };
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setForm((old) => {
      const to = index + direction;
      if (to < 0 || to >= old.images.length) return old;
      const images = [...old.images];
      [images[index], images[to]] = [images[to], images[index]];
      return {
        ...old,
        images: images.map((x, i) => ({ ...x, sortOrder: i })),
      };
    });
  }

  function makeCover(url: string) {
    setForm((old) => ({ ...old, coverImageUrl: url }));
  }

  const payload = useMemo<WebsiteProductPayload>(
    () => ({
      productId: form.productId,
      slug: form.slug.trim(),
      status: form.status,
      marketVn: true,
      marketInternational: false,
      featured: form.featured,
      sortOrder: Number(form.sortOrder || 0),
      titleVi: form.titleVi.trim(),
      shortDescriptionVi: form.shortDescriptionVi.trim() || undefined,
      descriptionVi: form.descriptionVi.trim() || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      images: form.images.map((x, index) => ({
        ...x,
        altVi: x.altVi || form.titleVi,
        sortOrder: index,
      })),
    }),
    [form],
  );

  async function save(status?: "DRAFT" | "PUBLISHED") {
    const body = { ...payload, status: status || form.status };
    if (!body.productId) return setError("Chưa chọn sản phẩm nội bộ.");
    if (!body.titleVi) return setError("Chưa nhập tên sản phẩm trên website.");
    if (!body.slug) return setError("Slug đang trống.");
    if (!body.images.length) return setError("Phải upload ít nhất 1 ảnh cho website.");
    if (!body.coverImageUrl) return setError("Chưa chọn ảnh đại diện.");

    try {
      setSaving(true);
      setError("");
      if (form.id) await updateWebsiteProduct(form.id, body);
      else await createWebsiteProduct(body);
      setEditorOpen(false);
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được sản phẩm.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: WebsiteRow) {
    if (!confirm(`Xóa bài đăng "${row.titleVi || row.product?.name || ""}"?`)) return;
    try {
      setError("");
      await deleteWebsiteProduct(row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được.");
    }
  }

  const groupedRows = useMemo(() => {
    const groups = new Map<string, WebsiteRow[]>();
    for (const row of rows) {
      const key = websiteCategoryGroup(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    return Array.from(groups.entries())
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => {
          const orderA = Number(a.sortOrder || 0);
          const orderB = Number(b.sortOrder || 0);
          if (orderA !== orderB) return orderA - orderB;
          return String(a.titleVi || a.product?.name || "").localeCompare(
            String(b.titleVi || b.product?.name || ""),
            "vi",
          );
        }),
      }))
      .sort((a, b) => {
        const ai = CATEGORY_GROUP_ORDER.indexOf(a.name);
        const bi = CATEGORY_GROUP_ORDER.indexOf(b.name);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.name.localeCompare(b.name, "vi");
      });
  }, [rows]);

  useEffect(() => {
    if (!groupedRows.length) return;
    setOpenGroups((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of groupedRows) {
        if (next[group.name] === undefined) {
          next[group.name] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [groupedRows]);

  return (
    <div className="min-h-screen bg-[#f6f6f4]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Website / Việt Nam
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Sản phẩm website
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Ảnh và nội dung ở đây là nội dung khách nhìn thấy. Giá và tồn kho lấy từ hệ thống nội bộ.
            </p>
          </div>

          {canEdit ? <button
            onClick={openCreate}
            className="h-11 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            + Đăng sản phẩm
          </button> : null}
        </div>

        {error && !editorOpen ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, slug..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-zinc-400 focus:bg-white"
          />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-zinc-950">Sản phẩm đã đăng trên website</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Gom theo nhóm danh mục để nhìn nhanh mỗi nhóm đang có những sản phẩm nào.
              </p>
            </div>
            <div className="text-xs font-medium text-zinc-500">
              {rows.length} sản phẩm · {groupedRows.length} nhóm
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-zinc-500">Đang tải...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-base font-medium text-zinc-900">Chưa có sản phẩm website</div>
              <div className="mt-1 text-sm text-zinc-500">Bấm “Đăng sản phẩm” để tạo bài đầu tiên.</div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {groupedRows.map((group) => {
                const opened = openGroups[group.name] !== false;
                const publishedCount = group.items.filter((row) => row.status === "PUBLISHED").length;

                return (
                  <div key={group.name}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((old) => ({
                          ...old,
                          [group.name]: !opened,
                        }))
                      }
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-zinc-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-700">
                          {opened ? "−" : "+"}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-950">{group.name}</div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {group.items.length} sản phẩm · {publishedCount} đang đăng
                          </div>
                        </div>
                      </div>
                      <div className="flex max-w-[55%] flex-wrap justify-end gap-1.5">
                        {group.items.slice(0, 5).map((row) => (
                          <span
                            key={row.id}
                            className="max-w-[170px] truncate rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600"
                          >
                            {row.titleVi || row.product?.name || "Chưa có tên"}
                          </span>
                        ))}
                        {group.items.length > 5 ? (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-500">
                            +{group.items.length - 5}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {opened ? (
                      <div className="border-t border-zinc-100 bg-[#fafafa] px-3 py-2">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {group.items.map((row) => {
                            const cover = row.coverImageUrl || row.images?.[0]?.url || "";
                            return (
                              <article
                                key={row.id}
                                className="flex min-w-0 gap-3 rounded-xl border border-zinc-200 bg-white p-3"
                              >
                                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                                  {cover ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={cover} alt="" className="h-full w-full object-cover" />
                                  ) : null}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-zinc-950">
                                        {row.titleVi || row.product?.name || "Chưa có tên"}
                                      </div>
                                      <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                                        {masterCategory(row.product)}
                                      </div>
                                    </div>
                                    {row.status === "PUBLISHED" ? (
                                      <Badge tone="green">Đăng</Badge>
                                    ) : row.status === "ARCHIVED" ? (
                                      <Badge>Lưu trữ</Badge>
                                    ) : (
                                      <Badge tone="amber">Nháp</Badge>
                                    )}
                                  </div>

                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <div className="truncate text-xs font-medium text-zinc-700">
                                      {masterPrice(row.product)}
                                    </div>
                                    {row.featured ? (
                                      <span className="text-[11px] text-zinc-500">★ Nổi bật</span>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 flex gap-2">
                                    {canEdit ? <button
                                      onClick={() => openEdit(row)}
                                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                                    >
                                      Sửa
                                    </button> : null}
                                    {canDelete ? <button
                                      onClick={() => void remove(row)}
                                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                    >
                                      Xóa
                                    </button> : null}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/35 p-0 sm:p-6">
          <div className="mx-auto flex h-full max-w-[1320px] flex-col overflow-hidden bg-[#f7f7f5] sm:rounded-2xl sm:border sm:border-white/20 sm:shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
              <div>
                <div className="font-semibold text-zinc-950">
                  {form.id ? "Sửa sản phẩm website" : "Đăng sản phẩm mới"}
                </div>
                <div className="text-xs text-zinc-500">Website Việt Nam · VND</div>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_370px] lg:overflow-hidden">
              <div className="space-y-5 p-5 lg:overflow-y-auto lg:p-6">
                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h2 className="font-semibold text-zinc-950">1. Sản phẩm nội bộ</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Chỉ dùng liên kết này để lấy giá, biến thể và trạng thái còn/hết hàng.
                    </p>
                  </div>

                  {!form.id ? (
                    <div className="relative">
                      <input
                        value={masterQuery}
                        onChange={(e) => setMasterQuery(e.target.value)}
                        placeholder="Gõ tên hoặc mã sản phẩm..."
                        className="h-12 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-500"
                      />
                      {searchingMaster ? (
                        <div className="absolute right-4 top-3.5 text-xs text-zinc-400">Đang tìm...</div>
                      ) : null}
                      {masterResults.length ? (
                        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
                          {masterResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => chooseMaster(p)}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-zinc-50"
                            >
                              <div>
                                <div className="text-sm font-medium text-zinc-900">{p.name}</div>
                                <div className="mt-1 text-xs text-zinc-500">
                                  {masterCategory(p)} · {(p.variants || []).map((v) => v.sku).filter(Boolean).slice(0, 3).join(", ")}
                                </div>
                              </div>
                              <div className="text-xs font-medium text-zinc-600">{masterPrice(p)}</div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {form.master ? (
                    <div className={`${form.id ? "" : "mt-4 "}grid gap-3 sm:grid-cols-3`}>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <div className="text-xs text-zinc-500">Danh mục</div>
                        <div className="mt-1 text-sm font-medium">{masterCategory(form.master)}</div>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <div className="text-xs text-zinc-500">Giá bán</div>
                        <div className="mt-1 text-sm font-medium">{masterPrice(form.master)}</div>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <div className="text-xs text-zinc-500">Tình trạng</div>
                        <div className="mt-1 text-sm font-medium">{masterStockState(form.master)}</div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h2 className="font-semibold text-zinc-950">2. Ảnh sản phẩm trên website</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Chỉ ảnh upload ở đây được dùng trên website. Không lấy ảnh từ sản phẩm nội bộ.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center hover:border-zinc-400 hover:bg-white">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => void onUpload(e.target.files)}
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {uploading ? "Đang upload ảnh..." : "+ Chọn ảnh để upload"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">Có thể chọn nhiều ảnh cùng lúc</div>
                    </div>
                  </label>

                  {form.images.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {form.images.map((img, index) => {
                        const isCover = img.url === form.coverImageUrl;
                        return (
                          <div
                            key={`${img.url}-${index}`}
                            className={`overflow-hidden rounded-xl border bg-white ${isCover ? "border-zinc-950 ring-1 ring-zinc-950" : "border-zinc-200"}`}
                          >
                            <div className="relative aspect-[4/5] bg-zinc-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.url} alt="" className="h-full w-full object-cover" />
                              {isCover ? (
                                <div className="absolute left-2 top-2 rounded-full bg-zinc-950 px-2 py-1 text-[10px] font-semibold text-white">
                                  ẢNH ĐẠI DIỆN
                                </div>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-1 p-2">
                              <button
                                type="button"
                                onClick={() => makeCover(img.url)}
                                className="col-span-2 rounded-md bg-zinc-100 px-2 py-1.5 text-[11px] font-medium hover:bg-zinc-200"
                              >
                                Đặt làm ảnh chính
                              </button>
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveImage(index, -1)}
                                className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-30"
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                disabled={index === form.images.length - 1}
                                onClick={() => moveImage(index, 1)}
                                className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-30"
                              >
                                →
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="col-span-2 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                              >
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 font-semibold text-zinc-950">3. Nội dung khách nhìn thấy</h2>

                  <div className="grid gap-4">
                    <label>
                      <div className="mb-1.5 text-sm font-medium text-zinc-700">Tên sản phẩm</div>
                      <input
                        value={form.titleVi}
                        onChange={(e) => {
                          const title = e.target.value;
                          setForm((old) => ({
                            ...old,
                            titleVi: title,
                            slug: old.slug ? old.slug : slugify(title),
                          }));
                        }}
                        placeholder="Ví dụ: Vintage Flannel Shirt"
                        className="h-12 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:border-zinc-500"
                      />
                    </label>

                    <label>
                      <div className="mb-1.5 text-sm font-medium text-zinc-700">Đường dẫn</div>
                      <div className="flex h-12 overflow-hidden rounded-xl border border-zinc-200">
                        <span className="flex items-center bg-zinc-50 px-3 text-sm text-zinc-400">/products/</span>
                        <input
                          value={form.slug}
                          onChange={(e) => setField("slug", slugify(e.target.value))}
                          className="min-w-0 flex-1 px-3 text-sm outline-none"
                        />
                      </div>
                    </label>

                    <label>
                      <div className="mb-1.5 text-sm font-medium text-zinc-700">Mô tả ngắn</div>
                      <textarea
                        value={form.shortDescriptionVi}
                        onChange={(e) => setField("shortDescriptionVi", e.target.value)}
                        rows={3}
                        placeholder="1–2 câu giới thiệu ngắn..."
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-500"
                      />
                    </label>

                    <label>
                      <div className="mb-1.5 text-sm font-medium text-zinc-700">Mô tả chi tiết</div>
                      <textarea
                        value={form.descriptionVi}
                        onChange={(e) => setField("descriptionVi", e.target.value)}
                        rows={8}
                        placeholder="Chất liệu, phom dáng, chi tiết sản phẩm..."
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-500"
                      />
                    </label>
                  </div>
                </section>
              </div>

              <aside className="border-t border-zinc-200 bg-white p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
                <div className="sticky top-0 space-y-5">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">Xem trước</div>

                    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
                      <div className="aspect-[4/5] bg-zinc-100">
                        {form.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.coverImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="p-4">
                        <div className="font-medium text-zinc-950">{form.titleVi || "Tên sản phẩm"}</div>
                        <div className="mt-2 text-sm font-medium text-zinc-950">{masterPrice(form.master)}</div>
                        <div className="mt-2 text-xs text-zinc-500">{masterCategory(form.master)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 p-4">
                    <label className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">Sản phẩm nổi bật</div>
                        <div className="mt-0.5 text-xs text-zinc-500">Hiện ở khu vực nổi bật trang chủ</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => setField("featured", e.target.checked)}
                        className="h-5 w-5 accent-zinc-950"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl bg-zinc-50 p-4 text-xs leading-5 text-zinc-600">
                    <b>Quy tắc tồn kho:</b> website chỉ dùng dữ liệu nội bộ để biết màu/size nào còn hay hết.
                    Khách không nhìn thấy số lượng tồn cụ thể.
                  </div>

                  <div className="grid gap-2 pt-2">
                    {canPublish ? <button
                      disabled={saving || uploading}
                      onClick={() => void save("PUBLISHED")}
                      className="h-12 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {saving ? "Đang lưu..." : "Đăng bán"}
                    </button> : null}
                    {canEdit ? <button
                      disabled={saving || uploading}
                      onClick={() => void save("DRAFT")}
                      className="h-11 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Lưu bản nháp
                    </button> : null}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
