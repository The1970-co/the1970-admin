"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  createPayrollConfig,
  listBranchOptions,
  listPayrollConfigs,
  listStaffOptions,
  updatePayrollConfig,
} from "@/lib/payroll-api";
import type { BranchOption, PayrollConfig, StaffOption } from "@/types/payroll";

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(n(value)) + "đ";
}

function dateInput(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

const emptyForm = {
  id: "",
  staffId: "",
  branchId: "",
  attendanceCode: "",
  salaryType: "MONTHLY",
  baseSalary: "0",
  dailyRate: "0",
  standardWorkingDays: "26",
  orderAttributionMode: "ASSIGNED_OR_CREATOR",
  commissionPerOrderEnabled: false,
  commissionPerOrderAmount: "0",
  commissionPerItemEnabled: false,
  commissionPerItemAmount: "0",
  commissionPercentEnabled: false,
  commissionRate: "0",
  hourlyEnabled: false,
  hourlyRate: "0",
  standardHoursPerDay: "9.5",
  overtimeRate: "1",
  holidayRate: "2",
  paidLeaveEnabled: false,
  paidLeaveHoursPerDay: "9.5",
  mealAllowanceEnabled: false,
  mealHoursPerUnit: "9.5",
  mealAmountPerUnit: "30000",
  insuranceDeductionAmount: "0",
  taggedProductEnabled: false,
  taggedProductRate: "0",
  ghnCodBonusEnabled: false,
  ghnCodBonusPerOrder: "0",
  applyPos: true,
  applyOnline: true,
  applyFacebook: true,
  applyCod: true,
  allowanceDefault: "0",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  isActive: true,
  note: "",
};

export default function PayrollConfigPageClient() {
  const [configs, setConfigs] = useState<PayrollConfig[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>(emptyForm);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [configRows, staffRows, branchRows] = await Promise.all([
        listPayrollConfigs({ q }),
        listStaffOptions().catch(() => []),
        listBranchOptions().catch(() => []),
      ]);
      setConfigs(Array.isArray(configRows) ? configRows : []);
      setStaff(Array.isArray(staffRows) ? staffRows : []);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được cấu hình lương.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStaff = useMemo(() => staff.find((item) => item.id === form.staffId), [staff, form.staffId]);
  const selectedBranch = useMemo(() => branches.find((item) => item.id === form.branchId), [branches, form.branchId]);

  function editConfig(config: PayrollConfig) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setForm({
      id: config.id,
      staffId: config.staffId || "",
      branchId: config.branchId || "",
      attendanceCode: config.attendanceCode || "",
      salaryType: config.salaryType || "MONTHLY",
      baseSalary: String(config.baseSalary || 0),
      dailyRate: String(config.dailyRate || 0),
      standardWorkingDays: String(config.standardWorkingDays || 26),
      orderAttributionMode: config.orderAttributionMode || "ASSIGNED_OR_CREATOR",
      commissionPerOrderEnabled: Boolean(config.commissionPerOrderEnabled),
      commissionPerOrderAmount: String(config.commissionPerOrderAmount || 0),
      commissionPerItemEnabled: Boolean(config.commissionPerItemEnabled),
      commissionPerItemAmount: String(config.commissionPerItemAmount || 0),
      commissionPercentEnabled: Boolean(config.commissionPercentEnabled),
      commissionRate: String(config.commissionRate || 0),
      hourlyEnabled: Boolean(config.hourlyEnabled),
      hourlyRate: String(config.hourlyRate || 0),
      standardHoursPerDay: String(config.standardHoursPerDay || 9.5),
      overtimeRate: String(config.overtimeRate || 1),
      holidayRate: String(config.holidayRate || 2),
      paidLeaveEnabled: Boolean(config.paidLeaveEnabled),
      paidLeaveHoursPerDay: String(config.paidLeaveHoursPerDay || config.standardHoursPerDay || 9.5),
      mealAllowanceEnabled: Boolean(config.mealAllowanceEnabled),
      mealHoursPerUnit: String(config.mealHoursPerUnit || 9.5),
      mealAmountPerUnit: String(config.mealAmountPerUnit || 30000),
      insuranceDeductionAmount: String(config.insuranceDeductionAmount || 0),
      taggedProductEnabled: Boolean(config.taggedProductEnabled),
      taggedProductRate: String(config.taggedProductRate || 0),
      ghnCodBonusEnabled: Boolean(config.ghnCodBonusEnabled),
      ghnCodBonusPerOrder: String(config.ghnCodBonusPerOrder || 0),
      applyPos: config.applyPos !== false,
      applyOnline: config.applyOnline !== false,
      applyFacebook: config.applyFacebook !== false,
      applyCod: config.applyCod !== false,
      allowanceDefault: String(config.allowanceDefault || 0),
      effectiveFrom: dateInput(config.effectiveFrom),
      effectiveTo: config.effectiveTo ? dateInput(config.effectiveTo) : "",
      isActive: config.isActive !== false,
      note: config.note || "",
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        staffId: form.staffId,
        staffCode: selectedStaff?.code || undefined,
        staffName: selectedStaff?.name || undefined,
        branchId: form.branchId || undefined,
        branchName: selectedBranch?.name || undefined,
        attendanceCode: form.attendanceCode || undefined,
        salaryType: form.salaryType,
        baseSalary: parseMoney(form.baseSalary),
        dailyRate: parseMoney(form.dailyRate),
        standardWorkingDays: Number(form.standardWorkingDays || 26),
        orderAttributionMode: form.orderAttributionMode || "ASSIGNED_OR_CREATOR",
        commissionPerOrderEnabled: Boolean(form.commissionPerOrderEnabled),
        commissionPerOrderAmount: parseMoney(form.commissionPerOrderAmount),
        commissionPerItemEnabled: Boolean(form.commissionPerItemEnabled),
        commissionPerItemAmount: parseMoney(form.commissionPerItemAmount),
        commissionPercentEnabled: Boolean(form.commissionPercentEnabled),
        commissionRate: Number(form.commissionRate || 0),
        hourlyEnabled: Boolean(form.hourlyEnabled),
        hourlyRate: parseMoney(form.hourlyRate),
        standardHoursPerDay: Number(form.standardHoursPerDay || 9.5),
        overtimeRate: Number(form.overtimeRate || 1),
        holidayRate: Number(form.holidayRate || 2),
        paidLeaveEnabled: Boolean(form.paidLeaveEnabled),
        paidLeaveHoursPerDay: Number(form.paidLeaveHoursPerDay || form.standardHoursPerDay || 9.5),
        mealAllowanceEnabled: Boolean(form.mealAllowanceEnabled),
        mealHoursPerUnit: Number(form.mealHoursPerUnit || 9.5),
        mealAmountPerUnit: parseMoney(form.mealAmountPerUnit),
        insuranceDeductionAmount: parseMoney(form.insuranceDeductionAmount),
        taggedProductEnabled: Boolean(form.taggedProductEnabled),
        taggedProductRate: parseMoney(form.taggedProductRate),
        ghnCodBonusEnabled: Boolean(form.ghnCodBonusEnabled),
        ghnCodBonusPerOrder: parseMoney(form.ghnCodBonusPerOrder),
        applyPos: Boolean(form.applyPos),
        applyOnline: Boolean(form.applyOnline),
        applyFacebook: Boolean(form.applyFacebook),
        applyCod: Boolean(form.applyCod),
        allowanceDefault: parseMoney(form.allowanceDefault),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
        isActive: Boolean(form.isActive),
        note: form.note,
      };
      if (!payload.staffId) throw new Error("Chọn nhân viên trước khi lưu cấu hình lương.");
      if (form.id) await updatePayrollConfig(form.id, payload);
      else await createPayrollConfig(payload);
      setNotice(form.id ? "Đã cập nhật cấu hình lương." : "Đã tạo cấu hình lương.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu cấu hình thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-400">Payroll Config</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950 md:text-3xl">Cấu hình lương</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-500">
              Mỗi nhân viên/chi nhánh có một cấu hình riêng: lương cứng, giá giờ, CT1/CT2, giá một sản phẩm thưởng, bảo hiểm, ăn trưa và nguồn đơn tính lương.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setForm(emptyForm)} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50">
              Làm mới
            </button>
            <button onClick={() => void save()} disabled={busy} className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              {busy ? "Đang lưu..." : form.id ? "Cập nhật cấu hình" : "Tạo cấu hình"}
            </button>
          </div>
        </div>
      </section>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[520px_1fr]">
        <section className="space-y-4 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
          <Section title="1. Nhân viên & phạm vi" desc="Chọn người được áp dụng cấu hình này.">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nhân viên" className="md:col-span-2">
                <select value={form.staffId} onChange={(e) => setForm((s: any) => ({ ...s, staffId: e.target.value }))} className={inputClass}>
                  <option value="">Chọn nhân viên</option>
                  {staff.map((item) => <option key={item.id} value={item.id}>{item.name || item.code || item.id}</option>)}
                </select>
              </Field>
              <Field label="Chi nhánh áp dụng">
                <select value={form.branchId} onChange={(e) => setForm((s: any) => ({ ...s, branchId: e.target.value }))} className={inputClass}>
                  <option value="">Theo chi nhánh nhân viên / toàn hệ thống</option>
                  {branches.map((item) => <option key={item.id} value={item.id}>{item.name || item.code || item.id}</option>)}
                </select>
              </Field>
              <Field label="Mã chấm công">
                <input value={form.attendanceCode} onChange={(e) => setForm((s: any) => ({ ...s, attendanceCode: e.target.value }))} placeholder="VD: 00001" className={inputClass} />
              </Field>
              <Field label="Nguồn đơn/sản phẩm tính lương" className="md:col-span-2">
                <select value={form.orderAttributionMode} onChange={(e) => setForm((s: any) => ({ ...s, orderAttributionMode: e.target.value }))} className={inputClass}>
                  <option value="ASSIGNED_OR_CREATOR">Ưu tiên NV phụ trách, nếu chưa gán thì lấy người tạo đơn</option>
                  <option value="CREATED_BY">Chỉ tính theo nhân viên tạo đơn</option>
                  <option value="ASSIGNED_ONLY">Chỉ tính theo NV phụ trách</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section title="2. Lương cơ bản" desc="Dùng cho lương tháng/ngày/ca. Có thể để 0 nếu chỉ tính theo giờ hoặc sản phẩm.">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Kiểu lương">
                <select value={form.salaryType} onChange={(e) => setForm((s: any) => ({ ...s, salaryType: e.target.value }))} className={inputClass}>
                  <option value="MONTHLY">Theo tháng</option>
                  <option value="DAILY">Theo ngày</option>
                  <option value="SHIFT">Theo ca</option>
                  <option value="NONE">Không lương cứng</option>
                </select>
              </Field>
              <Field label="Công chuẩn"><input value={form.standardWorkingDays} onChange={(e) => setForm((s: any) => ({ ...s, standardWorkingDays: e.target.value }))} className={inputClass} /></Field>
              <Field label="Lương cứng tháng"><input value={form.baseSalary} onChange={(e) => setForm((s: any) => ({ ...s, baseSalary: e.target.value }))} className={inputClass} /></Field>
              <Field label="Lương ngày/ca"><input value={form.dailyRate} onChange={(e) => setForm((s: any) => ({ ...s, dailyRate: e.target.value }))} className={inputClass} /></Field>
            </div>
          </Section>

          <Section title="3. Giờ công, tăng ca, ngày lễ" desc="Cấu hình mức tính. Số giờ thực tế nhập ở chi tiết kỳ lương hoặc import Excel chấm công.">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleBox label="Bật lương theo giờ" checked={form.hourlyEnabled} onChange={(v) => setForm((s: any) => ({ ...s, hourlyEnabled: v }))} />
              <Field label="Giá 1 giờ"><input value={form.hourlyRate} onChange={(e) => setForm((s: any) => ({ ...s, hourlyRate: e.target.value }))} className={inputClass} /></Field>
              <Field label="Giờ chuẩn / ngày"><input value={form.standardHoursPerDay} onChange={(e) => setForm((s: any) => ({ ...s, standardHoursPerDay: e.target.value, paidLeaveHoursPerDay: e.target.value, mealHoursPerUnit: e.target.value }))} className={inputClass} /></Field>
              <Field label="Hệ số CT1 tăng ca"><input value={form.overtimeRate} onChange={(e) => setForm((s: any) => ({ ...s, overtimeRate: e.target.value }))} className={inputClass} /></Field>
              <Field label="Hệ số CT2 ngày lễ"><input value={form.holidayRate} onChange={(e) => setForm((s: any) => ({ ...s, holidayRate: e.target.value }))} className={inputClass} /></Field>
            </div>
          </Section>

          <Section title="4. Thưởng sản phẩm" desc="Giá 1 sản phẩm đặt theo từng nhân viên/chi nhánh. Số lượng sản phẩm nhập ở kỳ lương tháng.">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleBox label="Bật lương SP nhập tay" checked={form.taggedProductEnabled} onChange={(v) => setForm((s: any) => ({ ...s, taggedProductEnabled: v }))} />
              <Field label="Giá 1 SP thưởng"><input value={form.taggedProductRate} onChange={(e) => setForm((s: any) => ({ ...s, taggedProductRate: e.target.value }))} className={inputClass} /></Field>
            </div>
          </Section>

          <Section title="5. Hoa hồng đơn hàng" desc="Tách riêng với lương SP nhập tay. Dùng cho đơn/sản phẩm/doanh thu tự động từ đơn hàng.">
            <div className="space-y-3">
              <ToggleMoney label="Theo đơn thành công" checked={form.commissionPerOrderEnabled} value={form.commissionPerOrderAmount} suffix="đ / đơn" onCheck={(v) => setForm((s: any) => ({ ...s, commissionPerOrderEnabled: v }))} onValue={(v) => setForm((s: any) => ({ ...s, commissionPerOrderAmount: v }))} />
              <ToggleMoney label="Theo sản phẩm thành công" checked={form.commissionPerItemEnabled} value={form.commissionPerItemAmount} suffix="đ / sản phẩm" onCheck={(v) => setForm((s: any) => ({ ...s, commissionPerItemEnabled: v }))} onValue={(v) => setForm((s: any) => ({ ...s, commissionPerItemAmount: v }))} />
              <ToggleMoney label="Theo % doanh thu" checked={form.commissionPercentEnabled} value={form.commissionRate} suffix="% doanh thu" onCheck={(v) => setForm((s: any) => ({ ...s, commissionPercentEnabled: v }))} onValue={(v) => setForm((s: any) => ({ ...s, commissionRate: v }))} />
            </div>
          </Section>

          <Section title="6. Phụ cấp & khấu trừ" desc="Các khoản mặc định khi tính lương.">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleBox label="Nghỉ có lương" checked={form.paidLeaveEnabled} onChange={(v) => setForm((s: any) => ({ ...s, paidLeaveEnabled: v }))} />
              <Field label="Giờ / ngày nghỉ"><input value={form.paidLeaveHoursPerDay} onChange={(e) => setForm((s: any) => ({ ...s, paidLeaveHoursPerDay: e.target.value }))} className={inputClass} /></Field>
              <ToggleBox label="Ăn trưa theo giờ" checked={form.mealAllowanceEnabled} onChange={(v) => setForm((s: any) => ({ ...s, mealAllowanceEnabled: v }))} />
              <Field label="Giờ / suất ăn"><input value={form.mealHoursPerUnit} onChange={(e) => setForm((s: any) => ({ ...s, mealHoursPerUnit: e.target.value }))} className={inputClass} /></Field>
              <Field label="Tiền / suất ăn"><input value={form.mealAmountPerUnit} onChange={(e) => setForm((s: any) => ({ ...s, mealAmountPerUnit: e.target.value }))} className={inputClass} /></Field>
              <Field label="Bảo hiểm trừ cố định"><input value={form.insuranceDeductionAmount} onChange={(e) => setForm((s: any) => ({ ...s, insuranceDeductionAmount: e.target.value }))} className={inputClass} /></Field>
              <Field label="Phụ cấp mặc định"><input value={form.allowanceDefault} onChange={(e) => setForm((s: any) => ({ ...s, allowanceDefault: e.target.value }))} className={inputClass} /></Field>
              <Field label="Tiền / đơn COD GHN"><input value={form.ghnCodBonusPerOrder} onChange={(e) => setForm((s: any) => ({ ...s, ghnCodBonusPerOrder: e.target.value, ghnCodBonusEnabled: Number(e.target.value || 0) > 0 }))} className={inputClass} /></Field>
            </div>
          </Section>

          <Section title="7. Hiệu lực & kênh áp dụng" desc="Kiểm soát thời gian hiệu lực và kênh đơn áp dụng.">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Hiệu lực từ"><input type="date" value={form.effectiveFrom} onChange={(e) => setForm((s: any) => ({ ...s, effectiveFrom: e.target.value }))} className={inputClass} /></Field>
              <Field label="Hiệu lực đến"><input type="date" value={form.effectiveTo} onChange={(e) => setForm((s: any) => ({ ...s, effectiveTo: e.target.value }))} className={inputClass} /></Field>
              <Field label="Trạng thái"><select value={form.isActive ? "1" : "0"} onChange={(e) => setForm((s: any) => ({ ...s, isActive: e.target.value === "1" }))} className={inputClass}><option value="1">Đang áp dụng</option><option value="0">Tạm tắt</option></select></Field>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                {[["applyPos", "POS"], ["applyOnline", "Online"], ["applyFacebook", "Facebook"], ["applyCod", "COD"]].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm((s: any) => ({ ...s, [key]: e.target.checked }))} /> {label}</label>
                ))}
              </div>
            </div>
            <Field label="Ghi chú"><textarea value={form.note} onChange={(e) => setForm((s: any) => ({ ...s, note: e.target.value }))} rows={3} className={inputClass} /></Field>
          </Section>
        </section>

        <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-neutral-950">Danh sách cấu hình</h2>
              <p className="mt-1 text-sm text-neutral-500">{configs.length} cấu hình lương đang có.</p>
            </div>
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Tìm nhân viên..." className="rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-neutral-900" />
              <button onClick={() => void load()} className="rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-bold hover:bg-neutral-50">Lọc</button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Chi nhánh</th>
                    <th className="px-4 py-3">Nguồn đơn</th>
                    <th className="px-4 py-3 text-right">Lương cứng</th>
                    <th className="px-4 py-3 text-right">/ giờ</th>
                    <th className="px-4 py-3 text-right">/ đơn</th>
                    <th className="px-4 py-3 text-right">/ sản phẩm</th>
                    <th className="px-4 py-3 text-right">SP nhập tay</th>
                    <th className="px-4 py-3 text-right">% DT</th>
                    <th className="px-4 py-3">Hiệu lực</th>
                    <th className="px-4 py-3">TT</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {configs.map((config) => (
                    <tr key={config.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-4"><div className="font-bold text-neutral-950">{config.staffName || config.staffId}</div><div className="mt-1 text-xs text-neutral-500">{config.staffCode || "—"} · MCC: {config.attendanceCode || "—"}</div></td>
                      <td className="px-4 py-4 text-neutral-600">{config.branchName || config.branchId || "Theo nhân viên"}</td>
                      <td className="px-4 py-4 text-xs text-neutral-600">{attributionLabel(config.orderAttributionMode)}</td>
                      <td className="px-4 py-4 text-right">{money(config.baseSalary)}</td>
                      <td className="px-4 py-4 text-right">{config.hourlyEnabled ? money(config.hourlyRate) : "—"}</td>
                      <td className="px-4 py-4 text-right">{config.commissionPerOrderEnabled ? money(config.commissionPerOrderAmount) : "—"}</td>
                      <td className="px-4 py-4 text-right">{config.commissionPerItemEnabled ? money(config.commissionPerItemAmount) : "—"}</td>
                      <td className="px-4 py-4 text-right">{config.taggedProductEnabled ? money(config.taggedProductRate) : "—"}</td>
                      <td className="px-4 py-4 text-right">{config.commissionPercentEnabled ? `${config.commissionRate || 0}%` : "—"}</td>
                      <td className="px-4 py-4 text-neutral-600">{dateInput(config.effectiveFrom)} {config.effectiveTo ? `→ ${dateInput(config.effectiveTo)}` : ""}</td>
                      <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${config.isActive === false ? "border-neutral-200 bg-neutral-50 text-neutral-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{config.isActive === false ? "Tắt" : "Đang áp dụng"}</span></td>
                      <td className="px-4 py-4 text-right"><button onClick={() => editConfig(config)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-white">Sửa</button></td>
                    </tr>
                  ))}
                  {!configs.length ? <tr><td colSpan={12} className="px-4 py-12 text-center text-neutral-500">{loading ? "Đang tải..." : "Chưa có cấu hình lương."}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function attributionLabel(mode?: string | null) {
  if (mode === "CREATED_BY") return "Người tạo đơn";
  if (mode === "ASSIGNED_ONLY") return "Chỉ NV phụ trách";
  return "NV phụ trách / fallback người tạo";
}

const inputClass = "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-bold text-neutral-700">{label}</span>{children}</label>;
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-4">
      <div className="mb-4">
        <h3 className="text-base font-black text-neutral-950">{title}</h3>
        {desc ? <p className="mt-1 text-xs leading-5 text-neutral-500">{desc}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex min-h-[50px] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${checked ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function ToggleMoney({ label, checked, value, suffix, onCheck, onValue }: { label: string; checked: boolean; value: string; suffix: string; onCheck: (v: boolean) => void; onValue: (v: string) => void }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-neutral-800">{label}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
      </label>
      {checked ? <div className="mt-3 flex items-center gap-2"><input value={value} onChange={(e) => onValue(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900" /><span className="whitespace-nowrap text-xs text-neutral-500">{suffix}</span></div> : null}
    </div>
  );
}
