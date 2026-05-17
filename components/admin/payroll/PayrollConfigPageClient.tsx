"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  applyPayrollBranchTemplate,
  createPayrollBranchTemplate,
  listBranchOptions,
  listPayrollBranchTemplates,
  listPayrollConfigs,
  listStaffOptions,
  updatePayrollBranchTemplate,
} from "@/lib/payroll-api";
import type {
  BranchOption,
  PayrollBranchConfigTemplate,
  PayrollConfig,
  StaffOption,
} from "@/types/payroll";

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(n(value)) + "đ";
}

function dateInput(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

const today = new Date().toISOString().slice(0, 10);

const baseDefaults = {
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
  note: "",
};

const emptyTemplateForm = {
  id: "",
  name: "",
  branchId: "",
  ...baseDefaults,
  isActive: true,
};

export default function PayrollConfigPageClient() {
  const [configs, setConfigs] = useState<PayrollConfig[]>([]);
  const [templates, setTemplates] = useState<PayrollBranchConfigTemplate[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [templateForm, setTemplateForm] = useState<any>(emptyTemplateForm);
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [configRows, templateRows, staffRows, branchRows] =
        await Promise.all([
          listPayrollConfigs({ q }),
          listPayrollBranchTemplates({}),
          listStaffOptions().catch(() => []),
          listBranchOptions().catch(() => []),
        ]);
      setConfigs(Array.isArray(configRows) ? configRows : []);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
      setStaff(Array.isArray(staffRows) ? staffRows : []);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được cấu hình lương.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplateBranch = useMemo(
    () => branches.find((item) => item.id === templateForm.branchId),
    [branches, templateForm.branchId],
  );

  const templatesByBranch = useMemo(() => {
    const map = new Map<string, PayrollBranchConfigTemplate[]>();
    templates.forEach((template) => {
      const key = template.branchId || "";
      const rows = map.get(key) || [];
      rows.push(template);
      map.set(key, rows);
    });
    return map;
  }, [templates]);

  const bulkStaff = useMemo(() => {
    if (!bulkBranchId) return [];
    return staff.filter(
      (item) => item.branchId === bulkBranchId && item.isActive !== false,
    );
  }, [staff, bulkBranchId]);

  const bulkTemplates = useMemo(() => {
    if (!bulkBranchId) return [];
    return templates.filter(
      (item) => item.branchId === bulkBranchId && item.isActive !== false,
    );
  }, [templates, bulkBranchId]);

  function baseToPayload(source: any) {
    return {
      salaryType: source.salaryType,
      baseSalary: parseMoney(source.baseSalary),
      dailyRate: parseMoney(source.dailyRate),
      standardWorkingDays: Number(source.standardWorkingDays || 26),
      orderAttributionMode:
        source.orderAttributionMode || "ASSIGNED_OR_CREATOR",
      commissionPerOrderEnabled: Boolean(source.commissionPerOrderEnabled),
      commissionPerOrderAmount: parseMoney(source.commissionPerOrderAmount),
      commissionPerItemEnabled: Boolean(source.commissionPerItemEnabled),
      commissionPerItemAmount: parseMoney(source.commissionPerItemAmount),
      commissionPercentEnabled: Boolean(source.commissionPercentEnabled),
      commissionRate: Number(source.commissionRate || 0),
      hourlyEnabled: Boolean(source.hourlyEnabled),
      hourlyRate: parseMoney(source.hourlyRate),
      standardHoursPerDay: Number(source.standardHoursPerDay || 9.5),
      overtimeRate: Number(source.overtimeRate || 1),
      holidayRate: Number(source.holidayRate || 2),
      paidLeaveEnabled: Boolean(source.paidLeaveEnabled),
      paidLeaveHoursPerDay: Number(
        source.paidLeaveHoursPerDay || source.standardHoursPerDay || 9.5,
      ),
      mealAllowanceEnabled: Boolean(source.mealAllowanceEnabled),
      mealHoursPerUnit: Number(source.mealHoursPerUnit || 9.5),
      mealAmountPerUnit: parseMoney(source.mealAmountPerUnit),
      insuranceDeductionAmount: parseMoney(source.insuranceDeductionAmount),
      taggedProductEnabled: Boolean(source.taggedProductEnabled),
      taggedProductRate: parseMoney(source.taggedProductRate),
      ghnCodBonusEnabled: Boolean(source.ghnCodBonusEnabled),
      ghnCodBonusPerOrder: parseMoney(source.ghnCodBonusPerOrder),
      applyPos: Boolean(source.applyPos),
      applyOnline: Boolean(source.applyOnline),
      applyFacebook: Boolean(source.applyFacebook),
      applyCod: Boolean(source.applyCod),
      allowanceDefault: parseMoney(source.allowanceDefault),
      note: source.note || "",
    };
  }

  function templateToBase(template: PayrollBranchConfigTemplate) {
    return {
      salaryType: template.salaryType || "MONTHLY",
      baseSalary: String(template.baseSalary || 0),
      dailyRate: String(template.dailyRate || 0),
      standardWorkingDays: String(template.standardWorkingDays || 26),
      orderAttributionMode:
        template.orderAttributionMode || "ASSIGNED_OR_CREATOR",
      commissionPerOrderEnabled: Boolean(template.commissionPerOrderEnabled),
      commissionPerOrderAmount: String(template.commissionPerOrderAmount || 0),
      commissionPerItemEnabled: Boolean(template.commissionPerItemEnabled),
      commissionPerItemAmount: String(template.commissionPerItemAmount || 0),
      commissionPercentEnabled: Boolean(template.commissionPercentEnabled),
      commissionRate: String(template.commissionRate || 0),
      hourlyEnabled: Boolean(template.hourlyEnabled),
      hourlyRate: String(template.hourlyRate || 0),
      standardHoursPerDay: String(template.standardHoursPerDay || 9.5),
      overtimeRate: String(template.overtimeRate || 1),
      holidayRate: String(template.holidayRate || 2),
      paidLeaveEnabled: Boolean(template.paidLeaveEnabled),
      paidLeaveHoursPerDay: String(
        template.paidLeaveHoursPerDay || template.standardHoursPerDay || 9.5,
      ),
      mealAllowanceEnabled: Boolean(template.mealAllowanceEnabled),
      mealHoursPerUnit: String(template.mealHoursPerUnit || 9.5),
      mealAmountPerUnit: String(template.mealAmountPerUnit || 30000),
      insuranceDeductionAmount: String(template.insuranceDeductionAmount || 0),
      taggedProductEnabled: Boolean(template.taggedProductEnabled),
      taggedProductRate: String(template.taggedProductRate || 0),
      ghnCodBonusEnabled: Boolean(template.ghnCodBonusEnabled),
      ghnCodBonusPerOrder: String(template.ghnCodBonusPerOrder || 0),
      applyPos: template.applyPos !== false,
      applyOnline: template.applyOnline !== false,
      applyFacebook: template.applyFacebook !== false,
      applyCod: template.applyCod !== false,
      allowanceDefault: String(template.allowanceDefault || 0),
      note: template.note || "",
    };
  }

  function editTemplate(template: PayrollBranchConfigTemplate) {
    setTemplateForm({
      id: template.id,
      name: template.name || "Cấu hình mặc định",
      branchId: template.branchId || "",
      ...templateToBase(template),
      isActive: template.isActive !== false,
    });
    setNotice(
      `Đang sửa mẫu ${template.name || "cấu hình"}. Sửa bên trái rồi bấm “Lưu mẫu lương”.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function useTemplateForBulk(template: PayrollBranchConfigTemplate) {
    setBulkBranchId(template.branchId || "");
    setBulkTemplateId(template.id);
    setBulkSelected([]);
    setNotice(
      `Đã chọn mẫu ${template.name || "cấu hình"} để áp dụng hàng loạt.`,
    );
  }

  async function saveTemplate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const branch = branches.find((item) => item.id === templateForm.branchId);
      const payload = {
        id: templateForm.id,
        name:
          templateForm.name ||
          `${branch?.name || "Chi nhánh"} - Cấu hình mặc định`,
        branchId: templateForm.branchId,
        branchName: branch?.name || undefined,
        ...baseToPayload(templateForm),
        isActive: templateForm.isActive !== false,
      };
      if (!payload.branchId)
        throw new Error("Chọn chi nhánh cho mẫu cấu hình.");
      if (templateForm.id)
        await updatePayrollBranchTemplate(templateForm.id, payload);
      else await createPayrollBranchTemplate(payload);
      setNotice(
        templateForm.id
          ? "Đã cập nhật mẫu lương chi nhánh."
          : "Đã lưu mẫu lương chi nhánh.",
      );
      setTemplateForm(emptyTemplateForm);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Lưu mẫu chi nhánh thất bại.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyBulk() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!bulkBranchId) throw new Error("Chọn chi nhánh cần áp dụng.");
      if (!bulkTemplateId)
        throw new Error("Chọn mẫu lương của chi nhánh trước khi áp dụng.");
      const result = await applyPayrollBranchTemplate({
        branchId: bulkBranchId,
        templateId: bulkTemplateId,
        staffIds: bulkSelected.length ? bulkSelected : undefined,
        overwrite: bulkOverwrite,
        onlyMissing: !bulkOverwrite,
        effectiveFrom: today,
      });
      setNotice(
        `Đã áp dụng mẫu: tạo ${result?.created || 0}, cập nhật ${result?.updated || 0}, bỏ qua ${result?.skipped || 0}.`,
      );
      setBulkSelected([]);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Áp dụng hàng loạt thất bại.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleBulkStaff(id: string) {
    setBulkSelected((rows) =>
      rows.includes(id) ? rows.filter((item) => item !== id) : [...rows, id],
    );
  }

  function selectAllBulkStaff() {
    setBulkSelected(bulkStaff.map((item) => item.id));
  }

  function clearBulkStaff() {
    setBulkSelected([]);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/payroll"
              className="text-sm font-bold text-neutral-500 hover:text-neutral-950"
            >
              ← Quay lại Sổ lương
            </Link>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-neutral-400">
              Payroll Config
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950 md:text-3xl">
              Cấu hình lương
            </h1>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-neutral-500">
              Tạo mẫu lương theo chi nhánh ở khung bên trái, xem mẫu đã lưu ở
              giữa, rồi áp dụng hàng loạt cho nhân viên bên phải. Không cần cấu
              hình từng nhân viên từ đầu.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTemplateForm(emptyTemplateForm)}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Mẫu mới
            </button>
            <button
              onClick={() => void saveTemplate()}
              disabled={busy}
              className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {busy
                ? "Đang lưu..."
                : templateForm.id
                  ? "Cập nhật mẫu"
                  : "Lưu mẫu lương"}
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-neutral-950">
              Danh sách cấu hình nhân viên đã áp dụng
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Đưa lên trên để admin nhìn ngay cấu hình nhân viên đang áp dụng
              trước khi tạo/sửa mẫu. Muốn thay đổi hàng loạt, sửa mẫu rồi áp
              dụng lại.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
              placeholder="Tìm nhân viên..."
              className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            />
            <button
              onClick={() => void load()}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold hover:bg-neutral-50"
            >
              Lọc
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[26px] border border-neutral-200">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-4">
                      <div className="font-black text-neutral-950">
                        {config.staffName || config.staffId}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {config.staffCode || "—"} · MCC:{" "}
                        {config.attendanceCode || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-neutral-600">
                      {config.branchName || config.branchId || "Theo nhân viên"}
                    </td>
                    <td className="px-4 py-4 text-xs text-neutral-600">
                      {attributionLabel(config.orderAttributionMode)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold">
                      {money(config.baseSalary)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {config.hourlyEnabled ? money(config.hourlyRate) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {config.commissionPerOrderEnabled
                        ? money(config.commissionPerOrderAmount)
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {config.commissionPerItemEnabled
                        ? money(config.commissionPerItemAmount)
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {config.taggedProductEnabled
                        ? money(config.taggedProductRate)
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {config.commissionPercentEnabled
                        ? `${config.commissionRate || 0}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-neutral-600">
                      {dateInput(config.effectiveFrom)}{" "}
                      {config.effectiveTo
                        ? `→ ${dateInput(config.effectiveTo)}`
                        : ""}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${config.isActive === false ? "border-neutral-200 bg-neutral-50 text-neutral-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                      >
                        {config.isActive === false ? "Tắt" : "Đang áp dụng"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!configs.length ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-neutral-500"
                    >
                      {loading
                        ? "Đang tải..."
                        : "Chưa có cấu hình lương nhân viên. Tạo mẫu rồi áp dụng hàng loạt."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[420px_1fr_520px]">
        <section className="space-y-4 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">
              1. Tạo mẫu lương
            </p>
            <h2 className="mt-2 text-xl font-black text-neutral-950">
              Mẫu cấu hình theo chi nhánh
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Điền đầy đủ mức lương một lần rồi bấm lưu mẫu. Sau đó dùng mẫu này
              để áp dụng cho nhiều nhân viên.
            </p>
          </div>

          <Section
            title="Thông tin mẫu"
            desc="Mẫu thuộc chi nhánh nào thì chỉ áp dụng cho nhân viên chi nhánh đó."
          >
            <Field label="Tên mẫu">
              <input
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm((s: any) => ({ ...s, name: e.target.value }))
                }
                placeholder="VD: Quốc Oai - Fulltime bán hàng"
                className={inputClass}
              />
            </Field>
            <Field label="Chi nhánh áp dụng">
              <select
                value={templateForm.branchId}
                onChange={(e) =>
                  setTemplateForm((s: any) => ({
                    ...s,
                    branchId: e.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">Chọn chi nhánh</option>
                {branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.code || item.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nguồn đơn/sản phẩm tính lương">
              <select
                value={templateForm.orderAttributionMode}
                onChange={(e) =>
                  setTemplateForm((s: any) => ({
                    ...s,
                    orderAttributionMode: e.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="ASSIGNED_OR_CREATOR">
                  Ưu tiên NV phụ trách, nếu chưa gán thì lấy người tạo đơn
                </option>
                <option value="CREATED_BY">
                  Chỉ tính theo nhân viên tạo đơn
                </option>
                <option value="ASSIGNED_ONLY">
                  Chỉ tính theo NV phụ trách
                </option>
              </select>
            </Field>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-500">
              Đang {templateForm.id ? "sửa" : "tạo"} mẫu{" "}
              {selectedTemplateBranch?.name
                ? `cho ${selectedTemplateBranch.name}`
                : "mới"}
              . Mẫu lưu xong sẽ xuất hiện ở khung giữa.
            </div>
          </Section>

          <BaseSalarySection form={templateForm} setForm={setTemplateForm} />
          <HourSection form={templateForm} setForm={setTemplateForm} />
          <ProductSection form={templateForm} setForm={setTemplateForm} />
          <CommissionSection form={templateForm} setForm={setTemplateForm} />
          <AllowanceSection form={templateForm} setForm={setTemplateForm} />

          <Section
            title="Kênh áp dụng & ghi chú"
            desc="Dùng khi muốn mẫu chỉ áp dụng cho một số kênh đơn."
          >
            <ChannelBox form={templateForm} setForm={setTemplateForm} />
            <Field label="Ghi chú mẫu">
              <textarea
                value={templateForm.note}
                onChange={(e) =>
                  setTemplateForm((s: any) => ({ ...s, note: e.target.value }))
                }
                rows={3}
                className={inputClass}
                placeholder="VD: Mẫu fulltime bán hàng Quốc Oai"
              />
            </Field>
            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700">
              <input
                type="checkbox"
                checked={templateForm.isActive !== false}
                onChange={(e) =>
                  setTemplateForm((s: any) => ({
                    ...s,
                    isActive: e.target.checked,
                  }))
                }
              />
              Mẫu đang hoạt động
            </label>
          </Section>

          <button
            onClick={() => void saveTemplate()}
            disabled={busy}
            className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {busy
              ? "Đang lưu..."
              : templateForm.id
                ? "Cập nhật mẫu lương"
                : "Lưu mẫu lương"}
          </button>
        </section>

        <section className="space-y-4 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">
                2. Mẫu đã lưu
              </p>
              <h2 className="mt-2 text-xl font-black text-neutral-950">
                Mẫu cấu hình chi nhánh
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Khung này chỉ hiển thị mẫu đã lưu. Muốn sửa mẫu, bấm “Sửa mẫu”
                để đổ dữ liệu về khung tạo mẫu bên trái.
              </p>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Tải lại
            </button>
          </div>

          <div className="space-y-5">
            {branches.map((branch) => {
              const rows = templatesByBranch.get(branch.id) || [];
              if (!rows.length) return null;
              return (
                <div
                  key={branch.id}
                  className="rounded-[26px] border border-neutral-200 bg-neutral-50/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-neutral-950">
                      {branch.name || branch.code || branch.id}
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-500">
                      {rows.length} mẫu
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {rows.map((template) => (
                      <div
                        key={template.id}
                        className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="text-base font-black text-neutral-950">
                              {template.name || "Cấu hình mặc định"}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {template.isActive === false
                                ? "Đã tắt"
                                : "Đang hoạt động"}{" "}
                              ·{" "}
                              {attributionLabel(template.orderAttributionMode)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => editTemplate(template)}
                              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                            >
                              Sửa mẫu
                            </button>
                            <button
                              onClick={() => useTemplateForBulk(template)}
                              className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white"
                            >
                              Chọn áp dụng
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          <MiniStat
                            label="Lương cứng"
                            value={money(template.baseSalary)}
                          />
                          <MiniStat
                            label="Giá 1 giờ"
                            value={
                              template.hourlyEnabled
                                ? money(template.hourlyRate)
                                : "Tắt"
                            }
                          />
                          <MiniStat
                            label="CT1 / CT2"
                            value={`${template.overtimeRate || 1}x / ${template.holidayRate || 2}x`}
                          />
                          <MiniStat
                            label="Giá 1 SP"
                            value={
                              template.taggedProductEnabled
                                ? money(template.taggedProductRate)
                                : "Tắt"
                            }
                          />
                          <MiniStat
                            label="Ăn trưa"
                            value={
                              template.mealAllowanceEnabled
                                ? `${money(template.mealAmountPerUnit)} / ${template.mealHoursPerUnit || 9.5}h`
                                : "Tắt"
                            }
                          />
                          <MiniStat
                            label="Bảo hiểm"
                            value={money(template.insuranceDeductionAmount)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!templates.length ? (
              <div className="rounded-[26px] border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                Chưa có mẫu chi nhánh. Tạo mẫu ở khung bên trái rồi bấm “Lưu mẫu
                lương”.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">
              3. Áp dụng hàng loạt
            </p>
            <h2 className="mt-2 text-xl font-black text-neutral-950">
              Áp dụng mẫu cho nhân viên
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Chọn chi nhánh, chọn mẫu đã lưu, tick nhân viên rồi bấm áp dụng.
              Nếu không tick ai, hệ thống áp dụng cho toàn bộ nhân viên chi
              nhánh.
            </p>
          </div>

          <Field label="Chi nhánh">
            <select
              value={bulkBranchId}
              onChange={(e) => {
                setBulkBranchId(e.target.value);
                setBulkTemplateId("");
                setBulkSelected([]);
              }}
              className={inputClass}
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.code || item.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mẫu áp dụng">
            <select
              value={bulkTemplateId}
              onChange={(e) => setBulkTemplateId(e.target.value)}
              disabled={!bulkBranchId}
              className={inputClass}
            >
              <option value="">Chọn mẫu của chi nhánh</option>
              {bulkTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name || "Cấu hình mặc định"} ·{" "}
                  {money(template.hourlyRate)}/giờ ·{" "}
                  {money(template.taggedProductRate)}/SP
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-700">
            <input
              type="checkbox"
              checked={bulkOverwrite}
              onChange={(e) => setBulkOverwrite(e.target.checked)}
            />
            Ghi đè cấu hình đang có
          </label>

          <div className="rounded-[26px] border border-neutral-200 bg-neutral-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-black text-neutral-950">
                  Danh sách nhân viên
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Đã chọn {bulkSelected.length} / {bulkStaff.length}. Không chọn
                  ai = áp dụng toàn bộ.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAllBulkStaff}
                  disabled={!bulkStaff.length}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 disabled:opacity-40"
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={clearBulkStaff}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {bulkStaff.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm hover:bg-neutral-50"
                >
                  <span>
                    <span className="font-black text-neutral-950">
                      {item.name || item.code || item.id}
                    </span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {item.code || "—"} ·{" "}
                      {item.branchName || item.branchId || "—"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={bulkSelected.includes(item.id)}
                    onChange={() => toggleBulkStaff(item.id)}
                  />
                </label>
              ))}
              {!bulkBranchId ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-center text-sm text-neutral-500">
                  Chọn chi nhánh để xổ danh sách nhân viên.
                </div>
              ) : null}
              {bulkBranchId && !bulkStaff.length ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-center text-sm text-neutral-500">
                  Chi nhánh này chưa có nhân viên active.
                </div>
              ) : null}
            </div>
          </div>

          <button
            onClick={() => void applyBulk()}
            disabled={busy || !bulkBranchId || !bulkTemplateId}
            className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white disabled:opacity-40"
          >
            {busy
              ? "Đang áp dụng..."
              : bulkSelected.length
                ? `Áp dụng cho ${bulkSelected.length} nhân viên`
                : "Áp dụng mẫu cho toàn chi nhánh"}
          </button>
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

const inputClass =
  "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-bold text-neutral-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-4">
      <div className="mb-4">
        <h3 className="text-base font-black text-neutral-950">{title}</h3>
        {desc ? (
          <p className="mt-1 text-xs leading-5 text-neutral-500">{desc}</p>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-[50px] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${checked ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-800"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function ToggleMoney({
  label,
  checked,
  value,
  suffix,
  onCheck,
  onValue,
}: {
  label: string;
  checked: boolean;
  value: string;
  suffix: string;
  onCheck: (v: boolean) => void;
  onValue: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-neutral-800">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
        />
      </label>
      {checked ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => onValue(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
          <span className="whitespace-nowrap text-xs text-neutral-500">
            {suffix}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-neutral-950">{value}</div>
    </div>
  );
}

function BaseSalarySection({ form, setForm }: any) {
  return (
    <Section
      title="2. Lương cơ bản"
      desc="Dùng cho lương tháng/ngày/ca. Có thể để 0 nếu chỉ tính theo giờ hoặc sản phẩm."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Kiểu lương">
          <select
            value={form.salaryType}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, salaryType: e.target.value }))
            }
            className={inputClass}
          >
            <option value="MONTHLY">Theo tháng</option>
            <option value="DAILY">Theo ngày</option>
            <option value="SHIFT">Theo ca</option>
            <option value="NONE">Không lương cứng</option>
          </select>
        </Field>
        <Field label="Công chuẩn">
          <input
            value={form.standardWorkingDays}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                standardWorkingDays: e.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Lương cứng tháng">
          <input
            value={form.baseSalary}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, baseSalary: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Lương ngày/ca">
          <input
            value={form.dailyRate}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, dailyRate: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
      </div>
    </Section>
  );
}

function HourSection({ form, setForm }: any) {
  return (
    <Section
      title="3. Giờ công / tăng ca / ngày lễ"
      desc="Set giá giờ và hệ số. Số giờ thực tế lấy từ Excel hoặc nhập ở kỳ lương."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleBox
          label="Bật lương theo giờ"
          checked={form.hourlyEnabled}
          onChange={(v) => setForm((s: any) => ({ ...s, hourlyEnabled: v }))}
        />
        <Field label="Giá 1 giờ">
          <input
            value={form.hourlyRate}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, hourlyRate: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Giờ chuẩn / ngày">
          <input
            value={form.standardHoursPerDay}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                standardHoursPerDay: e.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Hệ số CT1 tăng ca">
          <input
            value={form.overtimeRate}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, overtimeRate: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Hệ số CT2 ngày lễ">
          <input
            value={form.holidayRate}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, holidayRate: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
      </div>
    </Section>
  );
}

function ProductSection({ form, setForm }: any) {
  return (
    <Section
      title="4. Thưởng sản phẩm nhập tay"
      desc="Giá 1 SP theo chi nhánh. Số SP nhập trong kỳ lương."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleBox
          label="Bật thưởng SP nhập tay"
          checked={form.taggedProductEnabled}
          onChange={(v) =>
            setForm((s: any) => ({ ...s, taggedProductEnabled: v }))
          }
        />
        <Field label="Giá 1 SP thưởng">
          <input
            value={form.taggedProductRate}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                taggedProductRate: e.target.value,
                taggedProductEnabled: Number(e.target.value || 0) > 0,
              }))
            }
            className={inputClass}
          />
        </Field>
      </div>
    </Section>
  );
}

function CommissionSection({ form, setForm }: any) {
  return (
    <Section
      title="5. Hoa hồng đơn hàng"
      desc="Hoa hồng tự động theo đơn/sản phẩm/doanh thu thành công."
    >
      <div className="space-y-3">
        <ToggleMoney
          label="Theo đơn thành công"
          checked={form.commissionPerOrderEnabled}
          value={form.commissionPerOrderAmount}
          suffix="đ / đơn"
          onCheck={(v) =>
            setForm((s: any) => ({ ...s, commissionPerOrderEnabled: v }))
          }
          onValue={(v) =>
            setForm((s: any) => ({ ...s, commissionPerOrderAmount: v }))
          }
        />
        <ToggleMoney
          label="Theo sản phẩm thành công"
          checked={form.commissionPerItemEnabled}
          value={form.commissionPerItemAmount}
          suffix="đ / sản phẩm"
          onCheck={(v) =>
            setForm((s: any) => ({ ...s, commissionPerItemEnabled: v }))
          }
          onValue={(v) =>
            setForm((s: any) => ({ ...s, commissionPerItemAmount: v }))
          }
        />
        <ToggleMoney
          label="Theo % doanh thu"
          checked={form.commissionPercentEnabled}
          value={form.commissionRate}
          suffix="% doanh thu"
          onCheck={(v) =>
            setForm((s: any) => ({ ...s, commissionPercentEnabled: v }))
          }
          onValue={(v) => setForm((s: any) => ({ ...s, commissionRate: v }))}
        />
      </div>
    </Section>
  );
}

function AllowanceSection({ form, setForm }: any) {
  return (
    <Section
      title="6. Phụ cấp / khấu trừ"
      desc="Ăn trưa, bảo hiểm, phụ cấp mặc định, thưởng COD GHN."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleBox
          label="Ăn trưa theo giờ"
          checked={form.mealAllowanceEnabled}
          onChange={(v) =>
            setForm((s: any) => ({ ...s, mealAllowanceEnabled: v }))
          }
        />
        <Field label="Giờ / suất ăn">
          <input
            value={form.mealHoursPerUnit}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, mealHoursPerUnit: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Tiền / suất ăn">
          <input
            value={form.mealAmountPerUnit}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, mealAmountPerUnit: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Bảo hiểm trừ cố định">
          <input
            value={form.insuranceDeductionAmount}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                insuranceDeductionAmount: e.target.value,
              }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Phụ cấp mặc định">
          <input
            value={form.allowanceDefault}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, allowanceDefault: e.target.value }))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Tiền / đơn COD GHN">
          <input
            value={form.ghnCodBonusPerOrder}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                ghnCodBonusPerOrder: e.target.value,
                ghnCodBonusEnabled: Number(e.target.value || 0) > 0,
              }))
            }
            className={inputClass}
          />
        </Field>
      </div>
    </Section>
  );
}

function ChannelBox({ form, setForm }: any) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
      {[
        ["applyPos", "POS"],
        ["applyOnline", "Online"],
        ["applyFacebook", "Facebook"],
        ["applyCod", "COD"],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(form[key])}
            onChange={(e) =>
              setForm((s: any) => ({ ...s, [key]: e.target.checked }))
            }
          />{" "}
          {label}
        </label>
      ))}
    </div>
  );
}
