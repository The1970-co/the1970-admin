"use client";

import { useState } from "react";
import type { PayrollLine } from "@/types/payroll";

function parseMoney(value: string) {
  return Number(String(value || "").replace(/[^\d-]/g, "")) || 0;
}

export default function PayrollAdjustmentModal({
  line,
  open,
  onClose,
  onSubmit,
}: {
  line: PayrollLine | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (lineId: string, body: any) => Promise<void> | void;
}) {
  const [form, setForm] = useState({ type: "BONUS", amount: "", reason: "" });
  const [busy, setBusy] = useState(false);

  if (!open || !line) return null;

  async function submit() {
    setBusy(true);
    try {
      await onSubmit(line.id, { type: form.type, amount: parseMoney(form.amount), reason: form.reason });
      setForm({ type: "BONUS", amount: "", reason: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">Điều chỉnh lương</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-950">{line.staffName || "Nhân viên"}</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Đóng</button>
        </div>

        <div className="mt-6 grid gap-4">
          <label>
            <span className="text-sm font-medium text-neutral-700">Loại điều chỉnh</span>
            <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
              <option value="BONUS">Thưởng thêm</option>
              <option value="ALLOWANCE">Phụ cấp</option>
              <option value="ADVANCE">Tạm ứng</option>
              <option value="DEDUCTION">Khấu trừ</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Số tiền</span>
            <input value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} placeholder="VD: 500000" className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Lý do</span>
            <textarea value={form.reason} onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Hủy</button>
          <button onClick={submit} disabled={busy || parseMoney(form.amount) <= 0} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu điều chỉnh"}</button>
        </div>
      </div>
    </div>
  );
}
