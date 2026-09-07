"use client";

import { useEffect, useState } from "react";
import type { PayrollLine } from "@/types/payroll";

function parseMoney(value: string) {
  return Number(String(value || "").replace(/[^\d-]/g, "")) || 0;
}

const emptyForm = { type: "BONUS", customName: "", amount: "", reason: "" };

function adjustmentLabel(type?: string) {
  const value = String(type || "");
  const normalized = value.toUpperCase();
  if (normalized === "BONUS") return "Thưởng thêm";
  if (normalized === "ALLOWANCE") return "Phụ cấp";
  if (normalized === "ADVANCE") return "Tạm ứng";
  if (normalized === "DEDUCTION") return "Khấu trừ";
  if (normalized.startsWith("CUSTOM_ADD:") || normalized.startsWith("CUSTOM_DEDUCT:")) {
    return value.slice(value.indexOf(":") + 1).trim() || "Điều chỉnh tự đặt";
  }
  return value || "Điều chỉnh";
}

function adjustmentReason(item: any) {
  const reason = String(item?.reason || "").trim();
  if (!reason) return "";
  return reason.localeCompare(adjustmentLabel(item?.type), "vi", { sensitivity: "accent" }) === 0 ? "" : reason;
}

function formFromAdjustment(item: any) {
  const rawType = String(item?.type || "BONUS");
  const normalized = rawType.toUpperCase();
  const customType = normalized.startsWith("CUSTOM_DEDUCT:") ? "CUSTOM_DEDUCT" : "CUSTOM_ADD";
  const isCustom = normalized.startsWith("CUSTOM_ADD:") || normalized.startsWith("CUSTOM_DEDUCT:");
  return {
    type: isCustom ? customType : normalized,
    customName: isCustom ? rawType.slice(rawType.indexOf(":") + 1).trim() : "",
    amount: String(Number(item?.amount || 0)),
    reason: adjustmentReason(item),
  };
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
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setEditingId(null);
  }, [open, line?.id]);

  if (!open || !line) return null;
  const adjustments = Array.isArray(line.adjustments) ? line.adjustments as any[] : [];
  const isCustom = ["CUSTOM_ADD", "CUSTOM_DEDUCT"].includes(form.type);
  const reasonRequired = ["BONUS", "ALLOWANCE"].includes(form.type);

  function editAdjustment(item: any) {
    setEditingId(String(item.id));
    setForm(formFromAdjustment(item));
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit() {
    setBusy(true);
    try {
      const type = isCustom ? `${form.type}:${form.customName.trim()}` : form.type;
      await onSubmit(line.id, { adjustmentId: editingId || undefined, type, amount: parseMoney(form.amount), reason: form.reason });
      setForm(emptyForm);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">{editingId ? "Sửa điều chỉnh lương" : "Điều chỉnh lương"}</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-950">{line.staffName || "Nhân viên"}</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Đóng</button>
        </div>

        {adjustments.length ? (
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-950">Các khoản đã thêm</div>
                <div className="mt-1 text-xs text-neutral-500">Mỗi khoản được lưu riêng, không bị gộp mất tên.</div>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-neutral-500">{adjustments.length} khoản</span>
            </div>
            <div className="mt-3 space-y-2">
              {adjustments.map((item) => (
                <div key={item.id} className={`flex items-start justify-between gap-3 rounded-2xl border bg-white px-4 py-3 ${String(item.id) === editingId ? "border-neutral-900" : "border-neutral-200"}`}>
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">{adjustmentLabel(item.type)} · {new Intl.NumberFormat("vi-VN").format(Number(item.amount || 0))}đ</div>
                    {adjustmentReason(item) ? <div className="mt-1 text-xs text-neutral-500">{adjustmentReason(item)}</div> : null}
                  </div>
                  <button type="button" onClick={() => editAdjustment(item)} className="shrink-0 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Sửa</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {editingId ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>Đang sửa khoản đã chọn.</span>
              <button type="button" onClick={cancelEditing} className="font-semibold underline">Hủy sửa</button>
            </div>
          ) : null}
          <label>
            <span className="text-sm font-medium text-neutral-700">Loại điều chỉnh</span>
            <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value, customName: "" }))} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
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
            <span className="text-sm font-medium text-neutral-700">{reasonRequired ? "Ghi chú / lý do" : "Ghi chú thêm (không bắt buộc)"}</span>
            <textarea required={reasonRequired} value={form.reason} onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))} rows={3} placeholder="VD: Thưởng đạt doanh số, phụ cấp đi hỗ trợ chi nhánh khác..." className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
            {reasonRequired ? (
              <span className="mt-1 block text-xs text-neutral-500">Bắt buộc ghi rõ lý do cho thưởng hoặc phụ cấp chung.</span>
            ) : isCustom ? (
              <span className="mt-1 block text-xs text-neutral-500">Loại tự đặt đã dùng chính tên khoản làm nội dung hiển thị.</span>
            ) : (
              <span className="mt-1 block text-xs text-neutral-500">Có thể ghi thêm lý do nếu cần.</span>
            )}
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Hủy</button>
          <button onClick={submit} disabled={busy || parseMoney(form.amount) <= 0 || (isCustom && !form.customName.trim()) || (reasonRequired && !form.reason.trim())} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm khoản"}</button>
        </div>
      </div>
    </div>
  );
}
