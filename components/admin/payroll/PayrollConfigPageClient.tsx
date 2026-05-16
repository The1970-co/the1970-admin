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
  commissionPerOrderEnabled: false,
  commissionPerOrderAmount: "0",
  commissionPerItemEnabled: false,
  commissionPerItemAmount: "0",
  commissionPercentEnabled: false,
  commissionRate: "0",
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
      commissionPerOrderEnabled: Boolean(config.commissionPerOrderEnabled),
      commissionPerOrderAmount: String(config.commissionPerOrderAmount || 0),
      commissionPerItemEnabled: Boolean(config.commissionPerItemEnabled),
      commissionPerItemAmount: String(config.commissionPerItemAmount || 0),
      commissionPercentEnabled: Boolean(config.commissionPercentEnabled),
      commissionRate: String(config.commissionRate || 0),
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
        commissionPerOrderEnabled: Boolean(form.commissionPerOrderEnabled),
        commissionPerOrderAmount: parseMoney(form.commissionPerOrderAmount),
        commissionPerItemEnabled: Boolean(form.commissionPerItemEnabled),
        commissionPerItemAmount: parseMoney(form.commissionPerItemAmount),
        commissionPercentEnabled: Boolean(form.commissionPercentEnabled),
        commissionRate: Number(form.commissionRate || 0),
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
        <p className="mt-2 text-sm text-neutral-500">Set lương cứng, công chuẩn và hoa hồng fix cứng theo đơn/sản phẩm hoặc % doanh thu.</p>

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
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Chi nhánh</th>
                  <th className="px-4 py-3 text-right">Lương cứng</th>
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
                  <td className="px-4 py-4 text-right">{money(config.baseSalary)}</td>
                  <td className="px-4 py-4 text-right">{config.commissionPerOrderEnabled ? money(config.commissionPerOrderAmount) : "—"}</td>
                  <td className="px-4 py-4 text-right">{config.commissionPerItemEnabled ? money(config.commissionPerItemAmount) : "—"}</td>
                  <td className="px-4 py-4 text-right">{config.commissionPercentEnabled ? `${config.commissionRate || 0}%` : "—"}</td>
                  <td className="px-4 py-4 text-neutral-600">{dateInput(config.effectiveFrom)} {config.effectiveTo ? `→ ${dateInput(config.effectiveTo)}` : ""}</td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${config.isActive === false ? "border-neutral-200 bg-neutral-50 text-neutral-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{config.isActive === false ? "Tắt" : "Đang áp dụng"}</span></td>
                  <td className="px-4 py-4 text-right"><button onClick={() => editConfig(config)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Sửa</button></td>
                </tr>)}
                {!configs.length ? <tr><td colSpan={9} className="px-4 py-12 text-center text-neutral-500">{loading ? "Đang tải..." : "Chưa có cấu hình lương."}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>{children}</label>;
}
function ToggleMoney({ label, checked, value, suffix, onCheck, onValue }: { label: string; checked: boolean; value: string; suffix: string; onCheck: (v: boolean) => void; onValue: (v: string) => void }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-3"><label className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-neutral-800">{label}</span><input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} /></label>{checked ? <div className="mt-3 flex items-center gap-2"><input value={value} onChange={(e) => onValue(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><span className="whitespace-nowrap text-xs text-neutral-500">{suffix}</span></div> : null}</div>;
}
