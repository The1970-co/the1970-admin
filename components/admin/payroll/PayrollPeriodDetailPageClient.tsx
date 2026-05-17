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
  unlockPayrollPeriod,
  updatePayrollLine,
} from "@/lib/payroll-api";
import type { PaymentSourceOption, PayrollLine, PayrollPeriod } from "@/types/payroll";

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
function statusClass(status?: string) {
  const s = String(status || "DRAFT").toUpperCase();
  if (s === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "PARTIALLY_PAID") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "LOCKED") return "border-neutral-300 bg-neutral-100 text-neutral-800";
  if (s === "CALCULATED") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function PayrollPeriodDetailPageClient({ periodId }: { periodId: string }) {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [paymentSources, setPaymentSources] = useState<PaymentSourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<PayrollLine | null>(null);
  const [adjustLine, setAdjustLine] = useState<PayrollLine | null>(null);
  const [editLine, setEditLine] = useState<PayrollLine | null>(null);
  const [payDialog, setPayDialog] = useState<{ line?: PayrollLine; period?: PayrollPeriod; paymentSourceId: string; amount: string; note: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [detail, sources] = await Promise.all([
        getPayrollPeriod(periodId),
        listPaymentSources().catch(() => []),
      ]);
      setPeriod(detail);
      setPaymentSources(Array.isArray(sources) ? sources : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết kỳ lương.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  const lines = Array.isArray(period?.lines) ? period!.lines! : [];
  const summary = useMemo(() => lines.reduce((acc, line) => {
    acc.net += n(line.netPay);
    acc.paid += n(line.paidAmount);
    acc.orders += n(line.successOrderCount);
    acc.items += n(line.successItemQty);
    acc.commission += n(line.commissionTotal);
    return acc;
  }, { net: 0, paid: 0, orders: 0, items: 0, commission: 0 }), [lines]);

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice("Đã cập nhật sổ lương.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  async function saveLineEdit() {
    if (!editLine) return;
    await run("edit-line", () => updatePayrollLine(editLine.id, {
      workingDays: n(editLine.workingDays),
      normalHours: n(editLine.normalHours),
      overtimeHours: n(editLine.overtimeHours),
      overtimeRate: n(editLine.overtimeRate || 1),
      holidayHours: n(editLine.holidayHours),
      holidayRate: n(editLine.holidayRate || 2),
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
      note: editLine.note || "",
    }));
    setEditLine(null);
  }

  async function submitPayDialog() {
    if (!payDialog) return;
    const body = { paymentSourceId: payDialog.paymentSourceId || undefined, paidAmount: parseMoney(payDialog.amount), note: payDialog.note };
    if (payDialog.line) {
      await run("line-paid", () => markPayrollLinePaid(payDialog.line!.id, body));
    } else if (payDialog.period) {
      await run("period-paid", () => markPayrollPeriodPaid(payDialog.period!.id, { paymentSourceId: body.paymentSourceId, note: body.note }));
    }
    setPayDialog(null);
  }

  if (loading && !period) return <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-sm text-neutral-500">Đang tải chi tiết kỳ lương...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/payroll" className="text-sm text-neutral-500 hover:text-neutral-900">← Quay lại sổ lương</Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">{period?.name || "Kỳ lương"}</h1>
            <p className="mt-2 text-sm text-neutral-500">{period?.code} · {dateOnly(period?.fromDate)} → {dateOnly(period?.toDate)} · {period?.branchName || period?.branchId || "Tất cả chi nhánh"}</p>
          </div>
          {period ? <div className="flex flex-wrap gap-2">
            <button disabled={!!busy} onClick={() => run("calculate", () => calculatePayrollPeriod(period.id, { force: true }))} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">Tính lại</button>
            {String(period.status).toUpperCase() === "LOCKED" ? <button disabled={!!busy} onClick={() => run("unlock", () => unlockPayrollPeriod(period.id))} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">Mở khóa</button> : <button disabled={!!busy} onClick={() => run("lock", () => lockPayrollPeriod(period.id))} className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">Khóa sổ</button>}
            <button disabled={!!busy || String(period.status).toUpperCase() === "PAID"} onClick={() => setPayDialog({ period, paymentSourceId: "", amount: String(n(period.totalNet) - n(period.totalPaid)), note: "" })} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Đánh dấu đã trả</button>
          </div> : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <Metric label="Thực nhận" value={money(summary.net)} dark />
          <Metric label="Đã trả" value={money(summary.paid)} />
          <Metric label="Hoa hồng" value={money(summary.commission)} />
          <Metric label="Đơn thành công" value={num(summary.orders)} />
          <Metric label="SP thành công" value={num(summary.items)} />
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3 text-right">Công</th>
                <th className="px-4 py-3 text-right">Lương cứng</th>
                <th className="px-4 py-3 text-right">Giờ QĐ</th>
                <th className="px-4 py-3 text-right">Lương giờ</th>
                <th className="px-4 py-3 text-right">Đơn</th>
                <th className="px-4 py-3 text-right">SP</th>
                <th className="px-4 py-3 text-right">Hoa hồng</th>
                <th className="px-4 py-3 text-right">Thưởng</th>
                <th className="px-4 py-3 text-right">Trừ</th>
                <th className="px-4 py-3 text-right">Thực nhận</th>
                <th className="px-4 py-3">TT</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-4">
                    <button onClick={() => setSelectedLine(line)} className="font-semibold text-neutral-950 hover:underline">{line.staffName || "—"}</button>
                    <div className="mt-1 text-xs text-neutral-500">{line.staffCode || line.staffId}</div>
                  </td>
                  <td className="px-4 py-4 text-neutral-600">{line.branchName || line.branchId || "—"}</td>
                  <td className="px-4 py-4 text-right">{num(line.workingDays)}</td>
                  <td className="px-4 py-4 text-right">{money(line.proratedSalary)}</td>
                  <td className="px-4 py-4 text-right">{num(line.convertedWorkingHours)}</td>
                  <td className="px-4 py-4 text-right">{money(line.hourlyAmount)}</td>
                  <td className="px-4 py-4 text-right">{num(line.successOrderCount)}</td>
                  <td className="px-4 py-4 text-right">{num(line.successItemQty)}</td>
                  <td className="px-4 py-4 text-right font-medium text-neutral-900">{money(line.commissionTotal)}</td>
                  <td className="px-4 py-4 text-right">{money(n(line.bonus) + n(line.allowance))}</td>
                  <td className="px-4 py-4 text-right">{money(n(line.advance) + n(line.deduction) + n(line.insuranceDeduction))}</td>
                  <td className="px-4 py-4 text-right font-semibold text-neutral-950">{money(line.netPay)}</td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(line.status)}`}>{line.status || "DRAFT"}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setSelectedLine(line)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Chi tiết</button>
                      <button onClick={() => setEditLine(line)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Sửa</button>
                      <button onClick={() => setAdjustLine(line)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Điều chỉnh</button>
                      <button disabled={String(line.status).toUpperCase() === "PAID"} onClick={() => setPayDialog({ line, paymentSourceId: "", amount: String(n(line.netPay) - n(line.paidAmount)), note: "" })} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Trả</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!lines.length ? <tr><td colSpan={14} className="px-4 py-12 text-center text-neutral-500">Chưa có dòng lương. Bấm “Tính lại” sau khi cấu hình lương nhân viên.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <PayrollEmployeeDrawer line={selectedLine} onClose={() => setSelectedLine(null)} />
      <PayrollAdjustmentModal open={!!adjustLine} line={adjustLine} onClose={() => setAdjustLine(null)} onSubmit={async (lineId, body) => { await run("adjust", () => addPayrollAdjustment(lineId, body)); setAdjustLine(null); }} />

      {editLine ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Sửa dòng lương</p><h3 className="mt-2 text-xl font-semibold">{editLine.staffName}</h3></div><button onClick={() => setEditLine(null)} className="rounded-full border px-3 py-1 text-sm">Đóng</button></div>
        <div className="mt-5 max-h-[72vh] overflow-y-auto pr-1">
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-semibold text-neutral-950">Giờ công / lễ / tăng ca</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {([
                ["workingDays", "Công"],
                ["normalHours", "Giờ thường"],
                ["overtimeHours", "CT1 tăng ca"],
                ["overtimeRate", "Hệ số CT1"],
                ["holidayHours", "CT2 ngày lễ"],
                ["holidayRate", "Hệ số CT2"],
                ["hourlyRate", "Lương 1 giờ"],
                ["paidLeaveDays", "Ngày nghỉ có lương"],
                ["paidLeaveHoursPerDay", "Giờ / ngày nghỉ"],
              ] as const).map(([key, label]) => <label key={key}><span className="text-sm font-medium text-neutral-700">{label}</span><input value={String((editLine as any)[key] || 0)} onChange={(e) => setEditLine((s) => s ? ({ ...s, [key]: e.target.value }) : s)} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></label>)}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-semibold text-neutral-950">Sản phẩm gắn tên / phụ cấp / trừ</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {([
                ["taggedProductQty", "SP gắn tên"],
                ["taggedProductRate", "Tiền / SP gắn"],
                ["ghnCodOrderCount", "Đơn COD GHN"],
                ["ghnCodBonusPerOrder", "Thưởng / đơn GHN"],
                ["mealAllowanceAmount", "Ăn trưa"],
                ["insuranceDeduction", "Bảo hiểm trừ"],
                ["bonus", "Thưởng"],
                ["allowance", "Phụ cấp"],
                ["advance", "Tạm ứng"],
                ["deduction", "Phạt / khấu trừ"],
              ] as const).map(([key, label]) => <label key={key}><span className="text-sm font-medium text-neutral-700">{label}</span><input value={String((editLine as any)[key] || 0)} onChange={(e) => setEditLine((s) => s ? ({ ...s, [key]: e.target.value }) : s)} className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm" /></label>)}
            </div>
          </div>

          <label className="mt-4 block"><span className="text-sm font-medium text-neutral-700">Ghi chú</span><textarea value={editLine.note || ""} onChange={(e) => setEditLine((s) => s ? ({ ...s, note: e.target.value }) : s)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button onClick={() => setEditLine(null)} className="rounded-2xl border px-4 py-2.5 text-sm">Hủy</button><button onClick={() => void saveLineEdit()} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Lưu</button></div>
      </div></div> : null}

      {payDialog ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Xác nhận trả lương</p><h3 className="mt-2 text-xl font-semibold">{payDialog.line?.staffName || payDialog.period?.name}</h3></div><button onClick={() => setPayDialog(null)} className="rounded-full border px-3 py-1 text-sm">Đóng</button></div>
        <div className="mt-5 grid gap-3">
          <label><span className="text-sm font-medium text-neutral-700">Nguồn tiền</span><select value={payDialog.paymentSourceId} onChange={(e) => setPayDialog((s) => s ? ({ ...s, paymentSourceId: e.target.value }) : s)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"><option value="">Không tạo phiếu chi</option>{paymentSources.map((src) => <option key={src.id} value={src.id}>{src.name || src.code || src.id}</option>)}</select></label>
          {payDialog.line ? <label><span className="text-sm font-medium text-neutral-700">Số tiền trả</span><input value={payDialog.amount} onChange={(e) => setPayDialog((s) => s ? ({ ...s, amount: e.target.value }) : s)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label> : null}
          <label><span className="text-sm font-medium text-neutral-700">Ghi chú</span><textarea value={payDialog.note} onChange={(e) => setPayDialog((s) => s ? ({ ...s, note: e.target.value }) : s)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button onClick={() => setPayDialog(null)} className="rounded-2xl border px-4 py-2.5 text-sm">Hủy</button><button onClick={() => void submitPayDialog()} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Xác nhận</button></div>
      </div></div> : null}
    </div>
  );
}

function Metric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return <div className={`rounded-3xl border p-4 ${dark ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50"}`}><div className={`text-xs ${dark ? "text-neutral-300" : "text-neutral-500"}`}>{label}</div><div className="mt-2 text-xl font-semibold">{value}</div></div>;
}
