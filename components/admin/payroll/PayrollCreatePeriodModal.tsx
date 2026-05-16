"use client";

import { useMemo, useState } from "react";
import type { BranchOption } from "@/types/payroll";

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { fromDate: toDateInput(first), toDate: toDateInput(last) };
}

export default function PayrollCreatePeriodModal({
  open,
  branches,
  onClose,
  onSubmit,
}: {
  open: boolean;
  branches: BranchOption[];
  onClose: () => void;
  onSubmit: (body: any) => Promise<void> | void;
}) {
  const range = useMemo(() => defaultRange(), []);
  const [form, setForm] = useState({
    name: "",
    code: "",
    fromDate: range.fromDate,
    toDate: range.toDate,
    branchId: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      const branch = branches.find((item) => item.id === form.branchId);
      await onSubmit({
        ...form,
        branchId: form.branchId || undefined,
        branchName: branch?.name || undefined,
      });
      setForm({ name: "", code: "", fromDate: range.fromDate, toDate: range.toDate, branchId: "", note: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">Payroll</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-950">Tạo kỳ lương mới</h3>
            <p className="mt-1 text-sm text-neutral-500">Chọn khoảng thời gian, chi nhánh và ghi chú để bắt đầu tính lương.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Đóng</button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-sm font-medium text-neutral-700">Tên kỳ lương</span>
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="VD: Kỳ lương tháng 05/2026" className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Mã kỳ lương</span>
            <input value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} placeholder="Tự sinh nếu bỏ trống" className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Chi nhánh</span>
            <select value={form.branchId} onChange={(e) => setForm((s) => ({ ...s, branchId: e.target.value }))} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
              <option value="">Tất cả / theo cấu hình nhân viên</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.code || branch.id}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Từ ngày</span>
            <input type="date" value={form.fromDate} onChange={(e) => setForm((s) => ({ ...s, fromDate: e.target.value }))} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Đến ngày</span>
            <input type="date" value={form.toDate} onChange={(e) => setForm((s) => ({ ...s, toDate: e.target.value }))} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-medium text-neutral-700">Ghi chú</span>
            <textarea value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Hủy</button>
          <button onClick={submit} disabled={busy || !form.fromDate || !form.toDate} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang tạo..." : "Tạo kỳ lương"}</button>
        </div>
      </div>
    </div>
  );
}
