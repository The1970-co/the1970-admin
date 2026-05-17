"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getPayrollSettings, updatePayrollSettings } from "@/lib/payroll-api";
import type { PayrollSettings } from "@/types/payroll";

const defaultSettings: PayrollSettings = {
  autoCreateEnabled: false,
  autoCreateDay: 1,
  cycleMode: "MONTHLY",
  cycleStartDay: 1,
  cycleEndDay: undefined,
  autoCalculateMode: "MANUAL",
  autoLockEnabled: false,
  autoLockAfterDays: 0,
  reminderEnabled: true,
  lateWarningCount: 3,
  lateWarningMinutes: 60,
  lateCriticalCount: 5,
  lateCriticalMinutes: 120,
  earlyWarningCount: 3,
  earlyWarningMinutes: 60,
  earlyCriticalCount: 5,
  earlyCriticalMinutes: 120,
};

export default function PayrollSettingsPageClient() {
  const [form, setForm] = useState<PayrollSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await getPayrollSettings();
      setForm({ ...defaultSettings, ...(data || {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được cài đặt lương.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMessage(""); setError("");
    try {
      const data = await updatePayrollSettings(form);
      setForm({ ...defaultSettings, ...(data || {}) });
      setMessage("Đã lưu cài đặt lương.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu cài đặt thất bại.");
    } finally { setSaving(false); }
  }

  const input = (key: keyof PayrollSettings, type = "number") => (
    <input type={type} value={(form as any)[key] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [key]: type === "number" ? Number(e.target.value || 0) : e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-neutral-900 bg-neutral-950 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">Payroll Automation</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cài đặt tự động tính lương</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-300">Tạo kỳ lương tự động, nhắc import chấm công, kiểm soát cảnh báo đi muộn/về sớm và quy trình khóa sổ.</p>
          </div>
          <button onClick={() => void save()} disabled={saving} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">Tự động tạo kỳ lương</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm"><input type="checkbox" checked={Boolean(form.autoCreateEnabled)} onChange={(e) => setForm((s) => ({ ...s, autoCreateEnabled: e.target.checked }))} /> Bật tự động tạo kỳ lương</label>
            <Field label="Ngày tạo kỳ trong tháng">{input("autoCreateDay")}</Field>
            <Field label="Chu kỳ"><select value={form.cycleMode || "MONTHLY"} onChange={(e) => setForm((s) => ({ ...s, cycleMode: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="MONTHLY">Theo tháng</option><option value="HALF_MONTH">Nửa tháng 1-15 / 16-cuối tháng</option><option value="CUSTOM">Tuỳ chỉnh ngày bắt đầu/kết thúc</option></select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Ngày bắt đầu">{input("cycleStartDay")}</Field><Field label="Ngày kết thúc">{input("cycleEndDay")}</Field></div>
            <Field label="Tự động tính"><select value={form.autoCalculateMode || "MANUAL"} onChange={(e) => setForm((s) => ({ ...s, autoCalculateMode: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="MANUAL">Không tự tính</option><option value="ON_CREATE">Tính ngay khi tạo kỳ</option><option value="AFTER_ATTENDANCE_IMPORT">Tính sau khi import chấm công</option></select></Field>
          </div>
        </section>

        <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">Khóa sổ & nhắc việc</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm"><input type="checkbox" checked={Boolean(form.autoLockEnabled)} onChange={(e) => setForm((s) => ({ ...s, autoLockEnabled: e.target.checked }))} /> Tự động khóa sổ sau khi xác nhận</label>
            <Field label="Khóa sau số ngày">{input("autoLockAfterDays")}</Field>
            <label className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm"><input type="checkbox" checked={Boolean(form.reminderEnabled)} onChange={(e) => setForm((s) => ({ ...s, reminderEnabled: e.target.checked }))} /> Nhắc admin nếu chưa import chấm công / có nhân viên chưa match</label>
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-950">Cảnh báo đi muộn / về sớm</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Đi muộn vàng - số lần">{input("lateWarningCount")}</Field>
          <Field label="Đi muộn vàng - phút">{input("lateWarningMinutes")}</Field>
          <Field label="Đi muộn đỏ - số lần">{input("lateCriticalCount")}</Field>
          <Field label="Đi muộn đỏ - phút">{input("lateCriticalMinutes")}</Field>
          <Field label="Về sớm vàng - số lần">{input("earlyWarningCount")}</Field>
          <Field label="Về sớm vàng - phút">{input("earlyWarningMinutes")}</Field>
          <Field label="Về sớm đỏ - số lần">{input("earlyCriticalCount")}</Field>
          <Field label="Về sớm đỏ - phút">{input("earlyCriticalMinutes")}</Field>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>{children}</label>;
}
