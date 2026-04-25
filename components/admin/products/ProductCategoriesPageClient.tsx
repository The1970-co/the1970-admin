"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCategory,
  deleteCategory,
  getCategories,
  toggleCategory,
  updateCategory,
  type ProductCategoryItem,
} from "@/lib/product-categories-api";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

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

function toCode(input: string) {
  return slugify(input).replace(/-/g, "_").toUpperCase();
}

type FormState = {
  name: string;
  code: string;
  slug: string;
  description: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  slug: "",
  description: "",
  sortOrder: "0",
};

export default function ProductCategoriesPageClient() {
  const [rows, setRows] = useState<ProductCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadCategories() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategories();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được danh mục sản phẩm."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchActive = showInactive ? true : item.isActive;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q);

      return matchActive && matchQuery;
    });
  }, [rows, query, showInactive]);

  const activeCount = useMemo(
    () => rows.filter((item) => item.isActive).length,
    [rows]
  );

  const inactiveCount = useMemo(
    () => rows.filter((item) => !item.isActive).length,
    [rows]
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: ProductCategoryItem) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      code: item.code || "",
      slug: item.slug || "",
      description: item.description || "",
      sortOrder: String(item.sortOrder ?? 0),
    });
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Tên danh mục không được để trống.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: (form.code.trim() || toCode(form.name)).toUpperCase(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim() || undefined,
      sortOrder: Number(form.sortOrder || 0),
    };

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      if (editingId) {
        await updateCategory(editingId, payload);
        setNotice("Đã cập nhật danh mục.");
      } else {
        await createCategory(payload);
        setNotice("Đã tạo danh mục mới.");
      }

      resetForm();
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không lưu được danh mục."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: ProductCategoryItem) {
    try {
      setTogglingId(item.id);
      setError(null);
      setNotice(null);
      await toggleCategory(item.id);
      setNotice(
        item.isActive
          ? "Đã ngưng sử dụng danh mục."
          : "Đã kích hoạt lại danh mục."
      );
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không đổi được trạng thái danh mục."
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(item: ProductCategoryItem) {
    const ok = window.confirm(
      `Xoá danh mục "${item.name}"? Hành động này không hoàn tác được.`
    );
    if (!ok) return;

    try {
      setDeletingId(item.id);
      setError(null);
      setNotice(null);
      await deleteCategory(item.id);
      setNotice("Đã xoá danh mục.");
      if (editingId === item.id) resetForm();
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không xoá được danh mục."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Danh mục sản phẩm
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Quản lý nhóm sản phẩm để dùng cho form tạo sản phẩm và filter.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="p-4">
            <p className="text-sm text-neutral-500">Tổng danh mục</p>
            <h3 className="mt-2 text-2xl font-semibold">{rows.length}</h3>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <p className="text-sm text-neutral-500">Đang hoạt động</p>
            <h3 className="mt-2 text-2xl font-semibold">{activeCount}</h3>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <p className="text-sm text-neutral-500">Ngưng dùng</p>
            <h3 className="mt-2 text-2xl font-semibold">{inactiveCount}</h3>
          </div>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">
              {editingId ? "Sửa danh mục" : "Tạo danh mục mới"}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Form gọn để thêm nhanh nhóm sản phẩm.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_120px]">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  code:
                    prev.code === "" || prev.code === toCode(prev.name)
                      ? toCode(name)
                      : prev.code,
                  slug:
                    prev.slug === "" || prev.slug === slugify(prev.name)
                      ? slugify(name)
                      : prev.slug,
                }));
              }}
              placeholder="Tên danh mục"
            />

            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 uppercase outline-none"
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  code: e.target.value.toUpperCase(),
                }))
              }
              placeholder="Mã"
            />

            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={form.slug}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  slug: slugify(e.target.value),
                }))
              }
              placeholder="slug"
            />

            <input
              type="number"
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sortOrder: e.target.value,
                }))
              }
              placeholder="Thứ tự"
            />
          </div>

          <textarea
            className="min-h-[82px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            placeholder="Mô tả ngắn"
          />

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {notice}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-2xl px-5 py-3 text-sm font-medium text-white transition ${
                saving
                  ? "cursor-not-allowed bg-neutral-400"
                  : "bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              {saving
                ? "Đang lưu..."
                : editingId
                ? "Lưu cập nhật"
                : "Tạo danh mục"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Làm mới form
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.6fr_auto_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, mã, slug..."
          />

          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              showInactive
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            {showInactive ? "Đang hiện cả ngưng dùng" : "Chỉ hiện đang hoạt động"}
          </button>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filteredRows.length} danh mục
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4">
          <p className="font-medium text-neutral-900">Danh sách danh mục</p>
          <p className="mt-1 text-sm text-neutral-500">
            Có thể sửa, ngưng dùng hoặc xoá nếu chưa có sản phẩm.
          </p>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">
              Đang tải danh mục...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">
              Không có danh mục phù hợp.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tên</th>
                  <th className="px-4 py-3 font-medium">Mã</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Thứ tự</th>
                  <th className="px-4 py-3 font-medium">Số SP</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((item) => (
                  <tr key={item.id} className="border-t border-neutral-200">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-neutral-900">
                          {item.name}
                        </p>
                        {item.description ? (
                          <p className="mt-1 text-xs text-neutral-500">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3">{item.code}</td>
                    <td className="px-4 py-3">{item.slug}</td>
                    <td className="px-4 py-3">{item.sortOrder ?? 0}</td>
                    <td className="px-4 py-3">{item._count?.products ?? 0}</td>

                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <Badge tone="green">Đang dùng</Badge>
                      ) : (
                        <Badge tone="gray">Ngưng dùng</Badge>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded-2xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50"
                        >
                          Sửa
                        </button>

                        <button
                          onClick={() => void handleToggle(item)}
                          disabled={togglingId === item.id}
                          className={`rounded-2xl border px-3 py-2 text-xs font-medium transition ${
                            item.isActive
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-green-300 bg-green-50 text-green-700"
                          } ${
                            togglingId === item.id
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                        >
                          {togglingId === item.id
                            ? "Đang xử lý..."
                            : item.isActive
                            ? "Ngưng dùng"
                            : "Kích hoạt lại"}
                        </button>

                        <button
                          onClick={() => void handleDelete(item)}
                          disabled={deletingId === item.id}
                          className={`rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition ${
                            deletingId === item.id
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                        >
                          {deletingId === item.id ? "Đang xoá..." : "Xoá"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}