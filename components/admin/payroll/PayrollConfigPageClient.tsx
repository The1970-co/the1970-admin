"use client";

import { useEffect, useMemo, useState } from "react";
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
    setForm({
      id: config.id,
      staffId: config.staffId || "",
      branchId: config.branchId || "",
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
      setNotice("Đã lưu cấu hình lương.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu cấu hình thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">Payroll Config</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Cấu hình lương</h1>
        <p className="mt-2 text-sm text-neutral-500">Set lương cứng, giờ công, lễ/tăng ca, phụ cấp ăn trưa, bảo hiểm và hoa hồng theo NV phụ trách hoặc nhân viên tạo đơn.</p>

        <div className="mt-6 space-y-4">
          <Field label="Nhân viên">
            <select value={form.staffId} onChange={(e) => setForm((s: any) => ({ ...s, staffId: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
              <option value="">Chọn nhân viên</option>
              {staff.map((item) => <option key={item.id} value={item.id}>{item.name || item.code || item.id}</option>)}
            </select>
          </Field>
          <Field label="Chi nhánh áp dụng">
            <select value={form.branchId} onChange={(e) => setForm((s: any) => ({ ...s, branchId: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
              <option value="">Theo chi nhánh nhân viên / toàn hệ thống</option>
              {branches.map((item) => <option key={item.id} value={item.id}>{item.name || item.code || item.id}</option>)}
            </select>
          </Field>

          <Field label="Nguồn đơn/sản phẩm tính lương">
            <select value={form.orderAttributionMode} onChange={(e) => setForm((s: any) => ({ ...s, orderAttributionMode: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
              <option value="ASSIGNED_OR_CREATOR">Ưu tiên NV phụ trách, nếu chưa gán thì lấy người tạo đơn</option>
              <option value="CREATED_BY">Chỉ tính theo nhân viên tạo đơn</option>
              <option value="ASSIGNED_ONLY">Chỉ tính theo NV phụ trách</option>
            </select>
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Kiểu lương"><select value={form.salaryType} onChange={(e) => setForm((s: any) => ({ ...s, salaryType: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="MONTHLY">Theo tháng</option><option value="DAILY">Theo ngày</option><option value="SHIFT">Theo ca</option><option value="NONE">Không lương cứng</option></select></Field>
            <Field label="Công chuẩn"><input value={form.standardWorkingDays} onChange={(e) => setForm((s: any) => ({ ...s, standardWorkingDays: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            <Field label="Lương cứng tháng"><input value={form.baseSalary} onChange={(e) => setForm((s: any) => ({ ...s, baseSalary: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            <Field label="Lương ngày/ca"><input value={form.dailyRate} onChange={(e) => setForm((s: any) => ({ ...s, dailyRate: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-semibold text-neutral-950">Công thức hoa hồng</div>
            <p className="mt-1 text-xs text-neutral-500">Có thể bật nhiều kiểu cùng lúc.</p>
            <div className="mt-4 space-y-3">
              <ToggleMoney label="Theo đơn thành công" checked={form.commissionPerOrderEnabled} value={form.commissionPerOrderAmount} suffix="đ / đơn" onCheck={(v) => setForm((s: any) => ({ ...s, commissionPerOrderEnabled: v }))} onValue={(v) => setForm((s: any) => ({ ...s, commissionPerOrderAmount: v }))} />
              <ToggleMoney label="Theo sản phẩm thành công" checked={form.commissionPerItemEnabled} value={form.commissionPerItemAmount} suffix="đ / sản phẩm" onCheck={(v) => setForm((s: any) => ({ ...s, commissionPerItemEnabled: v }))} onValue={(v) => setForm((s: any) => ({ ...s, commissionPerItemAmount: v }))} />
              <ToggleMoney label="Theo % doanh thu" checked={form.commissionPercentEnabled} value={form.commissionRate} suffix="% doanh thu" onCheck={(v) => setForm((s: any) => ({ ...s, commissionPercentEnabled: v }))} onValue={(v) => setForm((s: any) => ({ ...s, commissionRate: v }))} />
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-semibold text-neutral-950">Lương theo giờ / tăng ca / ngày lễ</div>
            <p className="mt-1 text-xs text-neutral-500">Dùng để thay bảng Excel: giờ thường + CT1 + CT2 ngày lễ x hệ số.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm"><input type="checkbox" checked={Boolean(form.hourlyEnabled)} onChange={(e) => setForm((s: any) => ({ ...s, hourlyEnabled: e.target.checked }))} /> Bật tính lương theo giờ</label>
              <Field label="Lương 1 giờ"><input value={form.hourlyRate} onChange={(e) => setForm((s: any) => ({ ...s, hourlyRate: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <Field label="Giờ chuẩn / ngày"><input value={form.standardHoursPerDay} onChange={(e) => setForm((s: any) => ({ ...s, standardHoursPerDay: e.target.value, paidLeaveHoursPerDay: s.paidLeaveHoursPerDay || e.target.value, mealHoursPerUnit: s.mealHoursPerUnit || e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <Field label="Hệ số CT1 tăng ca"><input value={form.overtimeRate} onChange={(e) => setForm((s: any) => ({ ...s, overtimeRate: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <Field label="Hệ số CT2 ngày lễ"><input value={form.holidayRate} onChange={(e) => setForm((s: any) => ({ ...s, holidayRate: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-semibold text-neutral-950">Phụ cấp / khấu trừ nâng cao</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm"><input type="checkbox" checked={Boolean(form.paidLeaveEnabled)} onChange={(e) => setForm((s: any) => ({ ...s, paidLeaveEnabled: e.target.checked }))} /> Nghỉ có lương</label>
              <Field label="Giờ / ngày nghỉ"><input value={form.paidLeaveHoursPerDay} onChange={(e) => setForm((s: any) => ({ ...s, paidLeaveHoursPerDay: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm"><input type="checkbox" checked={Boolean(form.mealAllowanceEnabled)} onChange={(e) => setForm((s: any) => ({ ...s, mealAllowanceEnabled: e.target.checked }))} /> Ăn trưa theo giờ</label>
              <Field label="Giờ / suất ăn"><input value={form.mealHoursPerUnit} onChange={(e) => setForm((s: any) => ({ ...s, mealHoursPerUnit: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <Field label="Tiền / suất ăn"><input value={form.mealAmountPerUnit} onChange={(e) => setForm((s: any) => ({ ...s, mealAmountPerUnit: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <Field label="Bảo hiểm trừ cố định"><input value={form.insuranceDeductionAmount} onChange={(e) => setForm((s: any) => ({ ...s, insuranceDeductionAmount: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-semibold text-neutral-950">Sản phẩm gắn tên / thưởng vận hành</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm"><input type="checkbox" checked={Boolean(form.taggedProductEnabled)} onChange={(e) => setForm((s: any) => ({ ...s, taggedProductEnabled: e.target.checked }))} /> SP gắn tên nhập tay</label>
              <Field label="Tiền / SP gắn tên"><input value={form.taggedProductRate} onChange={(e) => setForm((s: any) => ({ ...s, taggedProductRate: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
              <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm"><input type="checkbox" checked={Boolean(form.ghnCodBonusEnabled)} onChange={(e) => setForm((s: any) => ({ ...s, ghnCodBonusEnabled: e.target.checked }))} /> Thưởng đơn COD GHN</label>
              <Field label="Tiền / đơn COD GHN"><input value={form.ghnCodBonusPerOrder} onChange={(e) => setForm((s: any) => ({ ...s, ghnCodBonusPerOrder: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Phụ cấp mặc định"><input value={form.allowanceDefault} onChange={(e) => setForm((s: any) => ({ ...s, allowanceDefault: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            <Field label="Hiệu lực từ"><input type="date" value={form.effectiveFrom} onChange={(e) => setForm((s: any) => ({ ...s, effectiveFrom: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            <Field label="Hiệu lực đến"><input type="date" value={form.effectiveTo} onChange={(e) => setForm((s: any) => ({ ...s, effectiveTo: e.target.value }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>
            <Field label="Trạng thái"><select value={form.isActive ? "1" : "0"} onChange={(e) => setForm((s: any) => ({ ...s, isActive: e.target.value === "1" }))} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="1">Đang áp dụng</option><option value="0">Tạm tắt</option></select></Field>
          </div>

          <div className="rounded-3xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-950">Áp dụng kênh đơn</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {[['applyPos','POS'],['applyOnline','Online'],['applyFacebook','Facebook'],['applyCod','COD']].map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2"><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm((s: any) => ({ ...s, [key]: e.target.checked }))} />{label}</label>)}
            </div>
          </div>

          <Field label="Ghi chú"><textarea value={form.note} onChange={(e) => setForm((s: any) => ({ ...s, note: e.target.value }))} rows={3} className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></Field>

          {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="flex gap-3">
            <button onClick={() => setForm(emptyForm)} className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Làm mới</button>
            <button onClick={() => void save()} disabled={busy} className="flex-1 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : form.id ? "Cập nhật" : "Tạo cấu hình"}</button>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">Danh sách cấu hình</h2>
            <p className="mt-1 text-sm text-neutral-500">{configs.length} cấu hình lương đang có.</p>
          </div>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Tìm nhân viên..." className="rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm" />
            <button onClick={() => void load()} className="rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium">Lọc</button>
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
                  <th className="px-4 py-3 text-right">% DT</th>
                  <th className="px-4 py-3">Hiệu lực</th>
                  <th className="px-4 py-3">TT</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {configs.map((config) => <tr key={config.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-4"><div className="font-semibold text-neutral-950">{config.staffName || config.staffId}</div><div className="mt-1 text-xs text-neutral-500">{config.staffCode || "—"}</div></td>
                  <td className="px-4 py-4 text-neutral-600">{config.branchName || config.branchId || "Theo nhân viên"}</td>
                  <td className="px-4 py-4 text-xs text-neutral-600">{attributionLabel(config.orderAttributionMode)}</td>
                  <td className="px-4 py-4 text-right">{money(config.baseSalary)}</td>
                  <td className="px-4 py-4 text-right">{config.hourlyEnabled ? money(config.hourlyRate) : "—"}</td>
                  <td className="px-4 py-4 text-right">{config.commissionPerOrderEnabled ? money(config.commissionPerOrderAmount) : "—"}</td>
                  <td className="px-4 py-4 text-right">{config.commissionPerItemEnabled ? money(config.commissionPerItemAmount) : "—"}</td>
                  <td className="px-4 py-4 text-right">{config.commissionPercentEnabled ? `${config.commissionRate || 0}%` : "—"}</td>
                  <td className="px-4 py-4 text-neutral-600">{dateInput(config.effectiveFrom)} {config.effectiveTo ? `→ ${dateInput(config.effectiveTo)}` : ""}</td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${config.isActive === false ? "border-neutral-200 bg-neutral-50 text-neutral-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{config.isActive === false ? "Tắt" : "Đang áp dụng"}</span></td>
                  <td className="px-4 py-4 text-right"><button onClick={() => editConfig(config)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Sửa</button></td>
                </tr>)}
                {!configs.length ? <tr><td colSpan={11} className="px-4 py-12 text-center text-neutral-500">{loading ? "Đang tải..." : "Chưa có cấu hình lương."}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function attributionLabel(mode?: string | null) {
  if (mode === "CREATED_BY") return "Người tạo đơn";
  if (mode === "ASSIGNED_ONLY") return "Chỉ NV phụ trách";
  return "NV phụ trách / fallback người tạo";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>{children}</label>;
}
function ToggleMoney({ label, checked, value, suffix, onCheck, onValue }: { label: string; checked: boolean; value: string; suffix: string; onCheck: (v: boolean) => void; onValue: (v: string) => void }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-3"><label className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-neutral-800">{label}</span><input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} /></label>{checked ? <div className="mt-3 flex items-center gap-2"><input value={value} onChange={(e) => onValue(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><span className="whitespace-nowrap text-xs text-neutral-500">{suffix}</span></div> : null}</div>;
}
