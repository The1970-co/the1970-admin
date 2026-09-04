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
  const [form, setForm] = useState({ type: "BONUS", customName: "", amount: "", reason: "" });
  const [busy, setBusy] = useState(false);

  if (!open || !line) return null;
  const isCustom = ["CUSTOM_ADD", "CUSTOM_DEDUCT"].includes(form.type);
  const reasonRequired = ["BONUS", "ALLOWANCE", "CUSTOM_ADD", "CUSTOM_DEDUCT"].includes(form.type);

  async function submit() {
    setBusy(true);
    try {
      const type = isCustom ? `${form.type}:${form.customName.trim()}` : form.type;
      await onSubmit(line.id, { type, amount: parseMoney(form.amount), reason: form.reason });
      setForm({ type: "BONUS", customName: "", amount: "", reason: "" });
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
              <option value="CUSTOM_ADD">Tự đặt loại cộng</option>
              <option value="CUSTOM_DEDUCT">Tự đặt loại trừ</option>
            </select>
          </label>
          {isCustom ? (
            <label>
              <span className="text-sm font-medium text-neutral-700">Tên loại điều chỉnh</span>
              <input
                value={form.customName}
                onChange={(e) => setForm((s) => ({ ...s, customName: e.target.value }))}
                maxLength={60}
                placeholder={form.type === "CUSTOM_ADD" ? "VD: Thưởng KPI, phụ cấp xăng xe..." : "VD: Trừ đồng phục, phạt đi muộn..."}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900"
              />
              <span className="mt-1 block text-xs text-neutral-500">Tên này sẽ hiển thị trong lịch sử điều chỉnh của nhân viên.</span>
            </label>
          ) : null}
          <label>
            <span className="text-sm font-medium text-neutral-700">Số tiền</span>
            <input value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} placeholder="VD: 500000" className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          </label>
          <label>
            <span className="text-sm font-medium text-neutral-700">Ghi chú / lý do</span>
            <textarea required={reasonRequired} value={form.reason} onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))} rows={3} placeholder="VD: Thưởng đạt doanh số, phụ cấp đi hỗ trợ chi nhánh khác..." className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
            {reasonRequired ? <span className="mt-1 block text-xs text-neutral-500">Bắt buộc ghi rõ lý do cho khoản điều chỉnh này.</span> : null}
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Hủy</button>
          <button onClick={submit} disabled={busy || parseMoney(form.amount) <= 0 || (isCustom && !form.customName.trim()) || (reasonRequired && !form.reason.trim())} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu điều chỉnh"}</button>
        </div>
      </div>
    </div>
  );
}
