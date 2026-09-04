"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PayrollAdjustmentModal from "./PayrollAdjustmentModal";
import PayrollEmployeeDrawer from "./PayrollEmployeeDrawer";
import {
  addPayrollAdjustment,
  calculatePayrollPeriod,
  getPayrollPeriod,
  listPaymentSources,
  lockPayrollPeriod,
  markPayrollLinePaid,
  markPayrollPeriodPaid,
  previewAttendanceImport,
  applyAttendanceImport,
  exportPayrollPeriod,
  unlockPayrollPeriod,
  updatePayrollLine,
  listStaffOptions,
  listPayrollConfigs,
  updatePayrollConfig,
} from "@/lib/payroll-api";
import type {
  AttendancePreviewRow,
  PaymentSourceOption,
  PayrollLine,
  PayrollPeriod,
  StaffOption,
  PayrollConfig,
} from "@/types/payroll";

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(n(value)) + "đ";
}
function num(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(n(value));
}
function parseMoney(value: string) {
  return Number(String(value || "").replace(/[^\d-]/g, "")) || 0;
}
function dateOnly(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

function overtimeText(line: PayrollLine) {
  const rows = [
    { label: "TC1", hours: n(line.overtimeHours) },
    { label: "TC2", hours: n(line.holidayHours) },
    { label: "TC3", hours: n((line as any).overtime3Hours) },
    { label: "TC4", hours: n((line as any).overtime4Hours) },
  ].filter((row) => row.hours > 0);
  return rows.length
    ? rows.map((row) => `${row.label}: ${num(row.hours)}h`).join(" · ")
    : "Không tăng ca";
}

function bonusAllowanceNote(line: PayrollLine) {
  const adjustmentReasons = (Array.isArray(line.adjustments) ? line.adjustments : [])
    .filter((item: any) => ["BONUS", "ALLOWANCE"].includes(String(item.type || "").toUpperCase()))
    .map((item: any) => String(item.reason || "").trim())
    .filter(Boolean);
  return Array.from(new Set([String(line.note || "").trim(), ...adjustmentReasons].filter(Boolean))).join(" · ");
}
function statusClass(status?: string) {
  const s = String(status || "DRAFT").toUpperCase();
  if (s === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "PARTIALLY_PAID") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "LOCKED")
    return "border-neutral-300 bg-neutral-100 text-neutral-800";
  if (s === "CALCULATED")
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}


function statusLabel(status?: string) {
  const s = String(status || "DRAFT").toUpperCase();
  if (s === "CALCULATED") return "Đã tính";
  if (s === "LOCKED") return "Đã khóa";
  if (s === "PARTIALLY_PAID") return "Đã trả một phần";
  if (s === "PAID") return "Đã trả";
  if (s === "CANCELLED") return "Đã hủy";
  return "Nháp";
}

type PayrollColumnKey =
  | "branch"
  | "salaryTemplate"
  | "attendance"
  | "workingDays"
  | "baseSalary"
  | "convertedHours"
  | "overtime"
  | "hourlyPay"
  | "orders"
  | "items"
  | "commissionRate"
  | "commissionTotal"
  | "bonus"
  | "deduction"
  | "netPay"
  | "status";

const payrollColumnOptions: Array<{ key: PayrollColumnKey; label: string }> = [
  { key: "branch", label: "Chi nhánh" },
  { key: "salaryTemplate", label: "Mẫu cấu hình lương" },
  { key: "attendance", label: "Chấm công" },
  { key: "workingDays", label: "Công" },
  { key: "baseSalary", label: "Lương cứng" },
  { key: "convertedHours", label: "Giờ QĐ" },
  { key: "overtime", label: "Tăng ca" },
  { key: "hourlyPay", label: "Lương giờ" },
  { key: "orders", label: "Đơn" },
  { key: "items", label: "SP" },
  { key: "commissionRate", label: "Mức hoa hồng" },
  { key: "commissionTotal", label: "Tổng hoa hồng" },
  { key: "bonus", label: "Thưởng + phụ cấp" },
  { key: "deduction", label: "Trừ" },
  { key: "netPay", label: "Thực nhận" },
  { key: "status", label: "Trạng thái" },
];

const defaultVisiblePayrollColumns: Record<PayrollColumnKey, boolean> =
  payrollColumnOptions.reduce(
    (acc, item) => ({ ...acc, [item.key]: true }),
    {} as Record<PayrollColumnKey, boolean>,
  );

function calcAttendanceSummary(rows: AttendancePreviewRow[] = []) {
  const matchedRows = rows.filter((row) =>
    Boolean(row.staffId || row.matched),
  ).length;
  const warningRows = rows.filter((row) =>
    ["WARNING", "CRITICAL"].includes(
      String(row.warningLevel || "").toUpperCase(),
    ),
  ).length;
  return {
    totalRows: rows.length,
    matchedRows,
    unmatchedRows: Math.max(0, rows.length - matchedRows),
    warningRows,
    totalLateMinutes: rows.reduce((sum, row) => sum + n(row.lateMinutes), 0),
    totalEarlyMinutes: rows.reduce((sum, row) => sum + n(row.earlyMinutes), 0),
  };
}

export default function PayrollPeriodDetailPageClient({
  periodId,
}: {
  periodId: string;
}) {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [paymentSources, setPaymentSources] = useState<PaymentSourceOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<PayrollLine | null>(null);
  const [adjustLine, setAdjustLine] = useState<PayrollLine | null>(null);
  const [editLine, setEditLine] = useState<PayrollLine | null>(null);
  const [payDialog, setPayDialog] = useState<{
    line?: PayrollLine;
    period?: PayrollPeriod;
    paymentSourceId: string;
    amount: string;
    note: string;
  } | null>(null);
  const [attendancePreview, setAttendancePreview] = useState<{
    fileName: string;
    summary: any;
    rows: AttendancePreviewRow[];
  } | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [payrollConfigs, setPayrollConfigs] = useState<PayrollConfig[]>([]);
  const [saveAttendanceMapping, setSaveAttendanceMapping] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Record<PayrollColumnKey, boolean>>(
    defaultVisiblePayrollColumns,
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [detail, sources, staffRows, configRows] = await Promise.all([
        getPayrollPeriod(periodId),
        listPaymentSources().catch(() => []),
        listStaffOptions().catch(() => []),
        listPayrollConfigs({ isActive: "true" }).catch(() => []),
      ]);
      setPeriod(detail);
      setPaymentSources(Array.isArray(sources) ? sources : []);
      setStaffOptions(Array.isArray(staffRows) ? staffRows : []);
      setPayrollConfigs(Array.isArray(configRows) ? configRows : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được chi tiết kỳ lương.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("payroll-period-visible-columns");
      if (saved) {
        setVisibleColumns({ ...defaultVisiblePayrollColumns, ...JSON.parse(saved) });
      }
    } catch {
      // Bỏ qua cấu hình cột lỗi và dùng mặc định.
    }
  }, []);

  function toggleColumn(key: PayrollColumnKey) {
    setVisibleColumns((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem(
          "payroll-period-visible-columns",
          JSON.stringify(next),
        );
      } catch {
        // Trình duyệt chặn localStorage thì vẫn đổi được trong phiên hiện tại.
      }
      return next;
    });
  }

  const lines = Array.isArray(period?.lines) ? period!.lines! : [];
  const summary = useMemo(
    () =>
      lines.reduce(
        (acc, line) => {
          acc.net += n(line.netPay);
          acc.paid += n(line.paidAmount);
          acc.orders += n(line.successOrderCount);
          acc.items += n(line.successItemQty);
          acc.commission += n(line.commissionTotal);
          acc.warnings += ["WARNING", "CRITICAL"].includes(
            String(line.attendanceWarningLevel || "").toUpperCase(),
          )
            ? 1
            : 0;
          acc.late += n(line.lateMinutes);
          acc.early += n(line.earlyMinutes);
          return acc;
        },
        {
          net: 0,
          paid: 0,
          orders: 0,
          items: 0,
          commission: 0,
          warnings: 0,
          late: 0,
          early: 0,
        },
      ),
    [lines],
  );

  const attendanceSummary = useMemo(
    () => calcAttendanceSummary(attendancePreview?.rows || []),
    [attendancePreview],
  );

  const payrollConfigByStaff = useMemo(() => {
    const map = new Map<string, PayrollConfig>();
    payrollConfigs.forEach((config) => {
      const key = String(config.staffId || "");
      if (!key || map.has(key)) return;
      map.set(key, config);
    });
    return map;
  }, [payrollConfigs]);

  function commissionSetting(line: PayrollLine) {
    const config = payrollConfigByStaff.get(String(line.staffId || ""));
    if (!config) return "—";
    const parts: string[] = [];
    if (config.commissionPerItemEnabled && n(config.commissionPerItemAmount) > 0) {
      parts.push(`${money(config.commissionPerItemAmount)}/SP`);
    }
    if (config.commissionPerOrderEnabled && n(config.commissionPerOrderAmount) > 0) {
      parts.push(`${money(config.commissionPerOrderAmount)}/đơn`);
    }
    if (config.commissionPercentEnabled && n(config.commissionRate) > 0) {
      parts.push(`${num(config.commissionRate)}% DT`);
    }
    return parts.length ? parts.join(" · ") : "0đ";
  }

  function updateAttendanceRow(
    index: number,
    patch: Partial<AttendancePreviewRow>,
  ) {
    setAttendancePreview((current) => {
      if (!current) return current;
      const rows = current.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      );
      return { ...current, rows, summary: calcAttendanceSummary(rows) };
    });
  }

  function pickManualStaff(index: number, staffId: string) {
    const staff = staffOptions.find((item) => item.id === staffId);
    if (!staff) {
      updateAttendanceRow(index, {
        matched: false,
        matchedBy: null,
        staffId: null,
        staffCode: null,
        systemStaffName: null,
        systemBranchId: null,
        systemBranchName: null,
      });
      return;
    }
    updateAttendanceRow(index, {
      matched: true,
      matchedBy: "MANUAL_MAP",
      staffId: staff.id,
      staffCode: staff.code || null,
      systemStaffName: staff.name || staff.code || staff.id,
      systemBranchId: staff.branchId || null,
      systemBranchName: staff.branchName || null,
    });
  }

  async function saveManualAttendanceMappings(rows: AttendancePreviewRow[]) {
    if (!saveAttendanceMapping) return;
    const mappedRows = rows.filter((row) => row.attendanceCode && row.staffId);
    const updatedConfigIds = new Set<string>();

    for (const row of mappedRows) {
      const candidates = payrollConfigs.filter(
        (config) => String(config.staffId) === String(row.staffId),
      );
      const byBranch = candidates.find(
        (config) =>
          String(config.branchId || "") === String(row.systemBranchId || ""),
      );
      const config = byBranch || candidates[0];
      if (!config || updatedConfigIds.has(config.id)) continue;
      updatedConfigIds.add(config.id);
      await updatePayrollConfig(config.id, {
        attendanceCode: row.attendanceCode,
      });
    }
  }

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(
        label === "attendance-apply"
          ? "Đã áp dụng Excel chấm công và tính lại lương."
          : "Đã cập nhật sổ lương.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAttendanceFile(file?: File | null) {
    if (!file || !period) return;
    await run("attendance-preview", async () => {
      const data = await previewAttendanceImport(period.id, file);
      setAttendancePreview(data);
      setAttendanceOpen(true);
    });
  }

  async function applyAttendancePreview() {
    if (!period || !attendancePreview) return;
    const rows = attendancePreview.rows;
    await run("attendance-apply", async () => {
      await saveManualAttendanceMappings(rows);
      await applyAttendanceImport(period.id, {
        fileName: attendancePreview.fileName,
        rows,
        autoCalculate: true,
      });
    });
    setAttendanceOpen(false);
    setAttendancePreview(null);
  }

  async function saveLineEdit() {
    if (!editLine) return;
    await run("edit-line", () =>
      updatePayrollLine(editLine.id, {
        workingDays: n(editLine.workingDays),
        normalHours: n(editLine.normalHours),
        overtimeHours: n(editLine.overtimeHours),
        overtimeRate: n(editLine.overtimeRate || 1),
        holidayHours: n(editLine.holidayHours),
        holidayRate: n(editLine.holidayRate || 2),
        overtime3Hours: n((editLine as any).overtime3Hours),
        overtime4Hours: n((editLine as any).overtime4Hours),
        hourlyRate: n(editLine.hourlyRate),
        paidLeaveDays: n(editLine.paidLeaveDays),
        paidLeaveHoursPerDay: n(editLine.paidLeaveHoursPerDay),
        mealAllowanceAmount: n(editLine.mealAllowanceAmount),
        insuranceDeduction: n(editLine.insuranceDeduction),
        taggedProductQty: n(editLine.taggedProductQty),
        taggedProductRate: n(editLine.taggedProductRate),
        ghnCodOrderCount: n(editLine.ghnCodOrderCount),
        ghnCodBonusPerOrder: n(editLine.ghnCodBonusPerOrder),
        bonus: n(editLine.bonus),
        allowance: n(editLine.allowance),
        advance: n(editLine.advance),
        deduction: n(editLine.deduction),
        attendanceCode: editLine.attendanceCode || "",
        attendanceMatchedBy: editLine.attendanceMatchedBy || "",
        attendanceRawName: editLine.attendanceRawName || "",
        attendanceSourceFile: editLine.attendanceSourceFile || "",
        lateCount: n(editLine.lateCount),
        lateMinutes: n(editLine.lateMinutes),
        earlyCount: n(editLine.earlyCount),
        earlyMinutes: n(editLine.earlyMinutes),
        attendanceWarningLevel: editLine.attendanceWarningLevel || "",
        attendanceWarningNote: editLine.attendanceWarningNote || "",
        note: editLine.note || "",
      }),
    );
    setEditLine(null);
  }

  async function submitPayDialog() {
    if (!payDialog) return;
    const body = {
      paymentSourceId: payDialog.paymentSourceId || undefined,
      paidAmount: parseMoney(payDialog.amount),
      note: payDialog.note,
    };
    if (payDialog.line) {
      await run("line-paid", () =>
        markPayrollLinePaid(payDialog.line!.id, body),
      );
    } else if (payDialog.period) {
      await run("period-paid", () =>
        markPayrollPeriodPaid(payDialog.period!.id, {
          paymentSourceId: body.paymentSourceId,
          note: body.note,
        }),
      );
    }
    setPayDialog(null);
  }

  if (loading && !period)
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
        Đang tải chi tiết kỳ lương...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/payroll"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              ← Quay lại sổ lương
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
              {period?.name || "Kỳ lương"}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              {period?.code} · {dateOnly(period?.fromDate)} →{" "}
              {dateOnly(period?.toDate)} ·{" "}
              {period?.branchName || period?.branchId || "Tất cả chi nhánh"}
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              Bấm “Nhập Excel chấm công” để tự đổ giờ thường/CT1/CT2 và cảnh báo
              đi muộn. Bấm “Nhập giờ/SP” để sửa tổng giờ, số SP, giá 1 SP theo
              tháng.
            </p>
          </div>
          {period ? (
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
                Nhập Excel chấm công
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  className="hidden"
                  onChange={(e) =>
                    void handleAttendanceFile(e.target.files?.[0] || null)
                  }
                />
              </label>
              <button
                disabled={!!busy}
                onClick={() =>
                  run("export", () => exportPayrollPeriod(period.id))
                }
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                Xuất Excel
              </button>
              <button
                disabled={!!busy}
                onClick={() =>
                  run("calculate", () =>
                    calculatePayrollPeriod(period.id, { force: true }),
                  )
                }
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                Tính lại
              </button>
              {String(period.status).toUpperCase() === "LOCKED" ? (
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run("unlock", () => unlockPayrollPeriod(period.id))
                  }
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Mở khóa
                </button>
              ) : (
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run("lock", () => lockPayrollPeriod(period.id))
                  }
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Khóa sổ
                </button>
              )}
              <button
                disabled={
                  !!busy || String(period.status).toUpperCase() === "PAID"
                }
                onClick={() =>
                  setPayDialog({
                    period,
                    paymentSourceId: "",
                    amount: String(n(period.totalNet) - n(period.totalPaid)),
                    note: "",
                  })
                }
                className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Đánh dấu đã trả
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-7">
          <Metric label="Thực nhận" value={money(summary.net)} dark />
          <Metric label="Đã trả" value={money(summary.paid)} />
          <Metric label="Hoa hồng" value={money(summary.commission)} />
          <Metric label="Đơn thành công" value={num(summary.orders)} />
          <Metric label="SP thành công" value={num(summary.items)} />
          <Metric label="Cảnh báo" value={num(summary.warnings)} />
          <Metric
            label="Muộn/về sớm"
            value={`${num(summary.late)}' / ${num(summary.early)}'`}
          />
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-neutral-950">Bảng lương nhân viên</div>
            <div className="mt-0.5 text-xs text-neutral-500">Bật hoặc tắt các cột để bảng gọn theo nhu cầu xem.</div>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
              Tùy chọn hiển thị
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Các cột đang hiện</span>
                <button
                  type="button"
                  onClick={() => {
                    setVisibleColumns(defaultVisiblePayrollColumns);
                    try {
                      window.localStorage.setItem(
                        "payroll-period-visible-columns",
                        JSON.stringify(defaultVisiblePayrollColumns),
                      );
                    } catch {}
                  }}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-950"
                >
                  Hiện tất cả
                </button>
              </div>
              <div className="grid gap-1">
                {payrollColumnOptions.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[column.key]}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Nhân viên</th>
                {visibleColumns.branch ? <th className="px-4 py-3">Chi nhánh</th> : null}
                {visibleColumns.salaryTemplate ? <th className="px-4 py-3">Mẫu cấu hình lương</th> : null}
                {visibleColumns.attendance ? <th className="px-4 py-3">Chấm công</th> : null}
                {visibleColumns.workingDays ? <th className="px-4 py-3 text-right">Công</th> : null}
                {visibleColumns.baseSalary ? <th className="px-4 py-3 text-right">Lương cứng</th> : null}
                {visibleColumns.convertedHours ? <th className="px-4 py-3 text-right">Giờ QĐ</th> : null}
                {visibleColumns.overtime ? <th className="px-4 py-3">Tăng ca</th> : null}
                {visibleColumns.hourlyPay ? <th className="px-4 py-3 text-right">Lương giờ</th> : null}
                {visibleColumns.orders ? <th className="px-4 py-3 text-right">Đơn</th> : null}
                {visibleColumns.items ? <th className="px-4 py-3 text-right">SP</th> : null}
                {visibleColumns.commissionRate ? <th className="px-4 py-3 text-right">Mức HH</th> : null}
                {visibleColumns.commissionTotal ? <th className="px-4 py-3 text-right">Tổng HH</th> : null}
                {visibleColumns.bonus ? <th className="px-4 py-3 text-right">Thưởng + phụ cấp</th> : null}
                {visibleColumns.deduction ? <th className="px-4 py-3 text-right">Trừ</th> : null}
                {visibleColumns.netPay ? <th className="px-4 py-3 text-right">Thực nhận</th> : null}
                {visibleColumns.status ? <th className="px-4 py-3">TT</th> : null}
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-4">
                    <button onClick={() => setSelectedLine(line)} className="font-semibold text-neutral-950 hover:underline">
                      {line.staffName || "—"}
                    </button>
                    <div className="mt-1 text-xs text-neutral-500">{line.staffCode || line.staffId}</div>
                  </td>
                  {visibleColumns.branch ? <td className="px-4 py-4 text-neutral-600">{line.branchName || line.branchId || "—"}</td> : null}
                  {visibleColumns.salaryTemplate ? (
                    <td className="max-w-[220px] px-4 py-4">
                      <div className="font-medium text-neutral-800">
                        {(line as any).sourceTemplateName || "Cấu hình riêng"}
                      </div>
                    </td>
                  ) : null}
                  {visibleColumns.attendance ? (
                    <td className="px-4 py-4 text-xs">
                      <div className={["WARNING", "CRITICAL"].includes(String(line.attendanceWarningLevel || "").toUpperCase()) ? "font-semibold text-red-600" : "text-neutral-500"}>
                        {line.attendanceWarningLevel || "—"}
                      </div>
                      <div className="text-neutral-400">Muộn {num(line.lateMinutes)}' · Sớm {num(line.earlyMinutes)}'</div>
                    </td>
                  ) : null}
                  {visibleColumns.workingDays ? <td className="px-4 py-4 text-right">{num(line.workingDays)}</td> : null}
                  {visibleColumns.baseSalary ? <td className="px-4 py-4 text-right">{money(line.proratedSalary)}</td> : null}
                  {visibleColumns.convertedHours ? <td className="px-4 py-4 text-right">{num(line.convertedWorkingHours)}</td> : null}
                  {visibleColumns.overtime ? (
                    <td className="max-w-[190px] whitespace-normal px-4 py-4 text-xs font-medium text-neutral-700">
                      {overtimeText(line)}
                    </td>
                  ) : null}
                  {visibleColumns.hourlyPay ? <td className="px-4 py-4 text-right">{money(line.hourlyAmount)}</td> : null}
                  {visibleColumns.orders ? <td className="px-4 py-4 text-right">{num(line.successOrderCount)}</td> : null}
                  {visibleColumns.items ? <td className="px-4 py-4 text-right">{num(line.successItemQty)}</td> : null}
                  {visibleColumns.commissionRate ? (
                    <td className="max-w-[180px] whitespace-normal px-4 py-4 text-right text-xs font-medium text-neutral-700">{commissionSetting(line)}</td>
                  ) : null}
                  {visibleColumns.commissionTotal ? <td className="px-4 py-4 text-right font-medium text-neutral-900">{money(line.commissionTotal)}</td> : null}
                  {visibleColumns.bonus ? (
                    <td className="max-w-[230px] whitespace-normal px-4 py-4 text-right">
                      <div className="font-semibold text-neutral-900">{money(n(line.bonus) + n(line.allowance))}</div>
                      {bonusAllowanceNote(line) ? (
                        <div className="mt-1 text-xs leading-5 text-neutral-500">{bonusAllowanceNote(line)}</div>
                      ) : null}
                    </td>
                  ) : null}
                  {visibleColumns.deduction ? <td className="px-4 py-4 text-right">{money(n(line.advance) + n(line.deduction) + n(line.insuranceDeduction))}</td> : null}
                  {visibleColumns.netPay ? <td className="px-4 py-4 text-right font-semibold text-neutral-950">{money(line.netPay)}</td> : null}
                  {visibleColumns.status ? (
                    <td className="px-4 py-4">
                      <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(line.status)}`}>
                        {statusLabel(line.status)}
                      </span>
                    </td>
                  ) : null}
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setSelectedLine(line)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Chi tiết</button>
                      <button onClick={() => setEditLine(line)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Nhập giờ/SP</button>
                      <button onClick={() => setAdjustLine(line)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Điều chỉnh</button>
                      <button
                        disabled={String(line.status).toUpperCase() === "PAID"}
                        onClick={() => setPayDialog({ line, paymentSourceId: "", amount: String(n(line.netPay) - n(line.paidAmount)), note: "" })}
                        className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Trả
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!lines.length ? (
                <tr>
                  <td colSpan={2 + payrollColumnOptions.filter((column) => visibleColumns[column.key]).length} className="px-4 py-12 text-center text-neutral-500">
                    Chưa có dòng lương. Bấm “Tính lại” sau khi cấu hình lương nhân viên.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <PayrollEmployeeDrawer
        line={selectedLine}
        onClose={() => setSelectedLine(null)}
      />
      <PayrollAdjustmentModal
        open={!!adjustLine}
        line={adjustLine}
        onClose={() => setAdjustLine(null)}
        onSubmit={async (lineId, body) => {
          await run("adjust", () => addPayrollAdjustment(lineId, body));
          setAdjustLine(null);
        }}
      />

      {editLine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">
                  Nhập dữ liệu lương tháng
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {editLine.staffName}
                </h3>
              </div>
              <button
                onClick={() => setEditLine(null)}
                className="rounded-full border px-3 py-1 text-sm"
              >
                Đóng
              </button>
            </div>
            <div className="mt-5 max-h-[72vh] overflow-y-auto pr-1">
              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold text-neutral-950">
                  Giờ làm việc trong tháng
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Nhập tổng giờ cả tháng: giờ ngày thường + TC1 tăng ca + giờ
                  ngày lễ TC2. TC2 sẽ nhân hệ số ngày lễ, mặc định x2.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {(
                    [
                      ["workingDays", "Công"],
                      ["normalHours", "Giờ ngày thường"],
                      ["overtimeHours", "Giờ tăng ca TC1"],
                      ["overtimeRate", "Hệ số TC1"],
                      ["holidayHours", "Giờ ngày lễ TC2"],
                      ["holidayRate", "Hệ số TC2 (x2)"],
                      ["overtime3Hours", "Giờ tăng ca TC3"],
                      ["overtime4Hours", "Giờ tăng ca TC4"],
                      ["hourlyRate", "Giá 1 giờ"],
                      ["paidLeaveDays", "Ngày nghỉ có lương"],
                      ["paidLeaveHoursPerDay", "Giờ / ngày nghỉ"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <span className="text-sm font-medium text-neutral-700">
                        {label}
                      </span>
                      <input
                        value={String((editLine as any)[key] || 0)}
                        onChange={(e) =>
                          setEditLine((s) =>
                            s ? { ...s, [key]: e.target.value } : s,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold text-neutral-950">
                  Lương sản phẩm thưởng / phụ cấp / khấu trừ
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Tách riêng số SP và giá 1 SP. Ví dụ Quốc Oai 74 SP x 5.000đ,
                  Thái Hà có thể đặt giá khác theo cấu hình từng nhân viên.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {(
                    [
                      ["taggedProductQty", "Số SP thưởng"],
                      ["taggedProductRate", "Giá 1 SP thưởng"],
                      ["ghnCodOrderCount", "Đơn COD GHN"],
                      ["ghnCodBonusPerOrder", "Thưởng / đơn GHN"],
                      ["mealAllowanceAmount", "Ăn trưa"],
                      ["insuranceDeduction", "Bảo hiểm trừ"],
                      ["bonus", "Thưởng"],
                      ["allowance", "Phụ cấp"],
                      ["advance", "Tạm ứng"],
                      ["deduction", "Phạt / khấu trừ"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <span className="text-sm font-medium text-neutral-700">
                        {label}
                      </span>
                      <input
                        value={String((editLine as any)[key] || 0)}
                        onChange={(e) =>
                          setEditLine((s) =>
                            s ? { ...s, [key]: e.target.value } : s,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-neutral-700">
                    Ghi chú thưởng / phụ cấp tháng này
                  </span>
                  <textarea
                    value={editLine.note || ""}
                    onChange={(e) =>
                      setEditLine((s) => (s ? { ...s, note: e.target.value } : s))
                    }
                    rows={3}
                    placeholder="VD: Thưởng đạt doanh số tháng 8, phụ cấp hỗ trợ cửa hàng khác..."
                    className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Metric
                  label="Giờ quy đổi"
                  value={num(
                    n(editLine.normalHours) +
                      n(editLine.overtimeHours) *
                        n(editLine.overtimeRate || 1) +
                      n(editLine.holidayHours) * n(editLine.holidayRate || 2),
                  )}
                />
                <Metric
                  label="Lương giờ dự tính"
                  value={money(
                    (n(editLine.normalHours) +
                      n(editLine.overtimeHours) *
                        n(editLine.overtimeRate || 1) +
                      n(editLine.holidayHours) * n(editLine.holidayRate || 2)) *
                      n(editLine.hourlyRate),
                  )}
                />
                <Metric
                  label="Lương SP dự tính"
                  value={money(
                    n(editLine.taggedProductQty) *
                      n(editLine.taggedProductRate),
                  )}
                />
                <Metric
                  label="Ăn trưa / BH"
                  value={`${money(editLine.mealAllowanceAmount)} / ${money(editLine.insuranceDeduction)}`}
                />
              </div>

              <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold text-neutral-950">
                  Cảnh báo chấm công
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {(
                    [
                      ["lateCount", "Số lần đi muộn"],
                      ["lateMinutes", "Phút đi muộn"],
                      ["earlyCount", "Số lần về sớm"],
                      ["earlyMinutes", "Phút về sớm"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <span className="text-sm font-medium text-neutral-700">
                        {label}
                      </span>
                      <input
                        value={String((editLine as any)[key] || 0)}
                        onChange={(e) =>
                          setEditLine((s) =>
                            s ? { ...s, [key]: e.target.value } : s,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditLine(null)}
                className="rounded-2xl border px-4 py-2.5 text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => void saveLineEdit()}
                className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {attendanceOpen && attendancePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-7xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">
                  Preview Excel chấm công
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {attendancePreview.fileName}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Tên trên máy chấm công có thể lệch. Chọn nhân viên ở cột “Khớp
                  NV”, hệ thống sẽ lưu mã chấm công để lần sau tự nhận.
                </p>
              </div>
              <button
                onClick={() => setAttendanceOpen(false)}
                className="rounded-full border px-3 py-1 text-sm"
              >
                Đóng
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <Metric
                label="Tổng dòng"
                value={num(attendanceSummary.totalRows)}
              />
              <Metric
                label="Đã khớp"
                value={num(attendanceSummary.matchedRows)}
              />
              <Metric
                label="Chưa khớp"
                value={num(attendanceSummary.unmatchedRows)}
              />
              <Metric
                label="Cảnh báo"
                value={num(attendanceSummary.warningRows)}
              />
              <Metric
                label="Muộn/về sớm"
                value={`${num(attendanceSummary.totalLateMinutes)}' / ${num(attendanceSummary.totalEarlyMinutes)}'`}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                <input
                  type="checkbox"
                  checked={saveAttendanceMapping}
                  onChange={(e) => setSaveAttendanceMapping(e.target.checked)}
                />{" "}
                Lưu mapping mã chấm công cho lần import sau
              </label>
              <div className="text-xs text-neutral-500">
                Mapping lưu vào cấu hình lương qua trường “Mã chấm công”. Dòng
                chưa khớp sẽ không áp dụng vào nhân viên nào.
              </div>
            </div>
            <div className="mt-4 max-h-[55vh] overflow-auto rounded-2xl border">
              <table className="w-full min-w-[1280px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Mã CC</th>
                    <th className="px-3 py-2">Tên file</th>
                    <th className="px-3 py-2">Khớp NV hệ thống</th>
                    <th className="px-3 py-2 text-right">Tổng giờ</th>
                    <th className="px-3 py-2 text-right">CT1</th>
                    <th className="px-3 py-2 text-right">CT2 lễ</th>
                    <th className="px-3 py-2 text-right">Giờ QĐ dự kiến</th>
                    <th className="px-3 py-2 text-right">Muộn</th>
                    <th className="px-3 py-2 text-right">Sớm</th>
                    <th className="px-3 py-2">Cảnh báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {attendancePreview.rows.map((row, idx) => (
                    <tr key={`${row.attendanceCode}-${idx}`}>
                      <td className="px-3 py-2 font-medium text-neutral-900">
                        {row.attendanceCode}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-neutral-800">
                          {row.staffName}
                        </div>
                        <div className="text-xs text-neutral-400">
                          Tên từ máy chấm công
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.staffId || ""}
                          onChange={(e) => pickManualStaff(idx, e.target.value)}
                          className="w-full min-w-[260px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
                        >
                          <option value="">Chưa khớp — chọn nhân viên</option>
                          {staffOptions.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.name || staff.code || staff.id}
                              {staff.code ? ` · ${staff.code}` : ""}
                              {staff.branchName ? ` · ${staff.branchName}` : ""}
                            </option>
                          ))}
                        </select>
                        <div
                          className={
                            row.staffId || row.matched
                              ? "mt-1 text-xs font-semibold text-emerald-700"
                              : "mt-1 text-xs font-semibold text-red-600"
                          }
                        >
                          {row.systemStaffName || "Chưa khớp"}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {row.matchedBy || "Manual / Auto"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-neutral-900">
                        {num(row.normalHours)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {num(row.overtimeHours)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {num(row.holidayHours)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-neutral-900">
                        {num(
                          n(row.normalHours) +
                            n(row.overtimeHours) * n(row.overtimeRate || 1) +
                            n(row.holidayHours) * n(row.holidayRate || 2),
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {num(row.lateMinutes)}'
                      </td>
                      <td className="px-3 py-2 text-right">
                        {num(row.earlyMinutes)}'
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            String(row.warningLevel).toUpperCase() ===
                            "CRITICAL"
                              ? "text-red-600 font-semibold"
                              : String(row.warningLevel).toUpperCase() ===
                                  "WARNING"
                                ? "text-amber-600 font-semibold"
                                : "text-neutral-500"
                          }
                        >
                          {row.warningLevel || "OK"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-neutral-500">
                Sau khi áp dụng, hệ thống tự tính lại lương. Mapping đã chọn sẽ
                được nhớ nếu cấu hình lương của nhân viên tồn tại.
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setAttendanceOpen(false)}
                  className="rounded-2xl border px-4 py-2.5 text-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={() => void applyAttendancePreview()}
                  className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Áp dụng & tính lại lương
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {payDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">
                  Xác nhận trả lương
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {payDialog.line?.staffName || payDialog.period?.name}
                </h3>
              </div>
              <button
                onClick={() => setPayDialog(null)}
                className="rounded-full border px-3 py-1 text-sm"
              >
                Đóng
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <label>
                <span className="text-sm font-medium text-neutral-700">
                  Nguồn tiền
                </span>
                <select
                  value={payDialog.paymentSourceId}
                  onChange={(e) =>
                    setPayDialog((s) =>
                      s ? { ...s, paymentSourceId: e.target.value } : s,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                >
                  <option value="">Không tạo phiếu chi</option>
                  {paymentSources.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.name || src.code || src.id}
                    </option>
                  ))}
                </select>
              </label>
              {payDialog.line ? (
                <label>
                  <span className="text-sm font-medium text-neutral-700">
                    Số tiền trả
                  </span>
                  <input
                    value={payDialog.amount}
                    onChange={(e) =>
                      setPayDialog((s) =>
                        s ? { ...s, amount: e.target.value } : s,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                </label>
              ) : null}
              <label>
                <span className="text-sm font-medium text-neutral-700">
                  Ghi chú
                </span>
                <textarea
                  value={payDialog.note}
                  onChange={(e) =>
                    setPayDialog((s) =>
                      s ? { ...s, note: e.target.value } : s,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPayDialog(null)}
                className="rounded-2xl border px-4 py-2.5 text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => void submitPayDialog()}
                className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${dark ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50"}`}
    >
      <div
        className={`text-xs ${dark ? "text-neutral-300" : "text-neutral-500"}`}
      >
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
