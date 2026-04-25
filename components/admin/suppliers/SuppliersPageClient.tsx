"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createSupplier,
  getSuppliers,
  toggleSupplier,
  updateSupplier,
  type SupplierItem,
} from "@/lib/suppliers-api";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function slugToCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

type FormState = {
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

export default function SuppliersPageClient() {
  const [rows, setRows] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSuppliers() {
    try {
      setLoading(true);
      setError(null);
      const data = await getSuppliers();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchActive = showInactive ? true : item.isActive;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        String(item.phone || "").toLowerCase().includes(q) ||
        String(item.email || "").toLowerCase().includes(q);

      return matchActive && matchQuery;
    });
  }, [rows, query, showInactive]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: SupplierItem) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      code: item.code || "",
      phone: item.phone || "",
      email: item.email || "",
      address: item.address || "",
      note: item.note || "",
    });
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Chưa nhập tên nhà cung cấp.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: (form.code.trim() || slugToCode(form.name)).toUpperCase(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      note: form.note.trim() || undefined,
    };

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      if (editingId) {
        await updateSupplier(editingId, payload);
        setNotice("Đã cập nhật nhà cung cấp.");
      } else {
        await createSupplier(payload);
        setNotice("Đã tạo nhà cung cấp.");
      }

      resetForm();
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được nhà cung cấp.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: SupplierItem) {
    try {
      setTogglingId(item.id);
      setError(null);
      setNotice(null);
      await toggleSupplier(item.id);
      setNotice(item.isActive ? "Đã ngưng dùng." : "Đã kích hoạt lại.");
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được trạng thái.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <div>
        <h2 className="text-[28px] font-semibold tracking-tight">Nhà cung cấp</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Quản lý danh sách nhà cung cấp để dùng cho phiếu nhập admin.
        </p>
      </div>

      <Panel className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {editingId ? "Sửa nhà cung cấp" : "Tạo nhà cung cấp"}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Form gọn để thêm nhanh.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                  code:
                    prev.code === "" || prev.code === slugToCode(prev.name)
                      ? slugToCode(e.target.value)
                      : prev.code,
                }))
              }
              placeholder="Tên NCC"
            />
            <input
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm uppercase outline-none"
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
              placeholder="Mã"
            />
            <input
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="SĐT"
            />
            <input
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
            />
          </div>

          <input
            className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Địa chỉ"
          />

          <textarea
            className="min-h-[72px] w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="Ghi chú"
          />

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {notice}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
                saving ? "cursor-not-allowed bg-neutral-400" : "bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              {saving ? "Đang lưu..." : editingId ? "Lưu cập nhật" : "Tạo NCC"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Làm mới
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_auto_auto]">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, mã, SĐT, email..."
          />

          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
              showInactive
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            {showInactive ? "Đang hiện cả ngưng dùng" : "Chỉ hiện đang hoạt động"}
          </button>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filteredRows.length} NCC
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="overflow-auto">
          {loading ? (
            <div className="p-4 text-sm text-neutral-500">Đang tải nhà cung cấp...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">Chưa có nhà cung cấp.</div>
          ) : (
            <table className="min-w-full text-[13px]">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Tên</th>
                  <th className="px-3 py-2.5 font-medium">Mã</th>
                  <th className="px-3 py-2.5 font-medium">Liên hệ</th>
                  <th className="px-3 py-2.5 font-medium">Địa chỉ</th>
                  <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-3 py-2.5 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item) => (
                  <tr key={item.id} className="border-t border-neutral-200">
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="font-medium text-neutral-900">{item.name}</p>
                        {item.note ? (
                          <p className="mt-1 text-xs text-neutral-500">{item.note}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{item.code}</td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1">
                        <p>{item.phone || "—"}</p>
                        <p className="text-xs text-neutral-500">{item.email || "—"}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{item.address || "—"}</td>
                    <td className="px-3 py-2.5">
                      {item.isActive ? <Badge tone="green">Đang dùng</Badge> : <Badge tone="gray">Ngưng dùng</Badge>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => void handleToggle(item)}
                          disabled={togglingId === item.id}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${
                            item.isActive
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-green-300 bg-green-50 text-green-700"
                          } ${togglingId === item.id ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          {togglingId === item.id ? "Đang xử lý..." : item.isActive ? "Ngưng dùng" : "Kích hoạt lại"}
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