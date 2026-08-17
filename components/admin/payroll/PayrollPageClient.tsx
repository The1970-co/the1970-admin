"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PayrollCreatePeriodModal from "./PayrollCreatePeriodModal";
import { calculatePayrollPeriod, calculateThirteenthSalary, createPayrollPeriod, deletePayrollPeriod, getPayrollDashboard, listBranchOptions, listPayrollPeriods, lockPayrollPeriod, markPayrollPeriodPaid, unlockPayrollPeriod } from "@/lib/payroll-api";
import type { BranchOption, PayrollPeriod } from "@/types/payroll";

function n(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return new Intl.NumberFormat("vi-VN").format(n(value)) + "đ"; }
function num(value: unknown) { return new Intl.NumberFormat("vi-VN").format(n(value)); }
function dateOnly(value?: string | null) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN"); }
function statusMeta(status?: string) { const s = String(status || "DRAFT").toUpperCase(); if (s === "PAID") return { label: "Đã trả", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }; if (s === "PARTIALLY_PAID") return { label: "Trả một phần", cls: "border-blue-200 bg-blue-50 text-blue-700" }; if (s === "LOCKED") return { label: "Đã khóa", cls: "border-neutral-300 bg-neutral-100 text-neutral-800" }; if (s === "CALCULATED") return { label: "Đã tính", cls: "border-indigo-200 bg-indigo-50 text-indigo-700" }; return { label: "Nháp", cls: "border-amber-200 bg-amber-50 text-amber-700" }; }

export default function PayrollPageClient() {
  const [rows, setRows] = useState<PayrollPeriod[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "ALL", branchId: "", warning: "ALL" });

  async function load() {
    setLoading(true); setError(null);
    try {
      const [periodData, branchData, dash] = await Promise.all([
        listPayrollPeriods({ pageSize: 100, ...filters }),
        listBranchOptions().catch(() => []),
        getPayrollDashboard(filters).catch(() => null),
      ]);
      setRows(Array.isArray(periodData?.rows) ? periodData.rows : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setDashboard(dash);
    } catch (err) { setError(err instanceof Error ? err.message : "Không tải được dữ liệu tính lương."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters.status, filters.branchId, filters.warning]);

  const visibleRows = useMemo(() => {
    if (filters.warning !== "HAS_WARNING") return rows;
    return rows.filter((r) => n(r.totalAttendanceWarnings) > 0);
  }, [rows, filters.warning]);
  const summary = dashboard?.summary || visibleRows.reduce((acc: any, row) => { acc.totalNet += n(row.totalNet); acc.totalPaid += n(row.totalPaid); acc.totalStaff += n(row.totalStaff); acc.totalWarnings += n(row.totalAttendanceWarnings); acc.totalLateMinutes += n(row.totalLateMinutes); acc.totalEarlyMinutes += n(row.totalEarlyMinutes); return acc; }, { totalNet: 0, totalPaid: 0, totalStaff: 0, totalWarnings: 0, totalLateMinutes: 0, totalEarlyMinutes: 0 });

  async function runAction(id: string, label: string, fn: () => Promise<any>) {
    setBusy(`${id}:${label}`); setError(null); setNotice(null);
    try { await fn(); setNotice("Đã cập nhật kỳ lương."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Thao tác thất bại."); }
    finally { setBusy(null); }
  }
  async function handleCreate(body: any) { await createPayrollPeriod(body); setCreateOpen(false); await load(); }

  async function handleDeletePeriod(row: PayrollPeriod) {
    if (String(row.status || "DRAFT").toUpperCase() !== "DRAFT") return;
    const ok = window.confirm(`Xóa kỳ lương nháp "${row.name || row.code}"? Dữ liệu nháp trong kỳ này sẽ bị xóa.`);
    if (!ok) return;
    await runAction(row.id, "delete", () => deletePayrollPeriod(row.id));
  }

  async function handleThirteenthSalary(row: PayrollPeriod) {
    const ok = window.confirm(
      `Tính lương tháng 13 cho "${row.name || row.code}" theo trung bình thực nhận của 12 tháng liền trước? Dữ liệu lương hiện có trong kỳ này sẽ được tính lại.`,
    );
    if (!ok) return;
    await runAction(row.id, "13th", () => calculateThirteenthSalary(row.id, { force: true }));
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-neutral-900 bg-neutral-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-400">Payroll Center · Sổ lương</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tính lương & sổ lương</h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-300">Theo dõi tổng lương, import chấm công, cảnh báo đi muộn, thống kê theo chi nhánh và khóa sổ lương.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/payroll/settings" className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10">Cài đặt tự động</Link>
            <Link href="/payroll/config" className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10">Cấu hình lương</Link>
            <button onClick={() => setCreateOpen(true)} className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950">Tạo kỳ lương</button>
          </div>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-6">
          <BlackMetric label="Tổng phải trả" value={money(summary.totalNet)} main />
          <BlackMetric label="Đã trả" value={money(summary.totalPaid)} />
          <BlackMetric label="Còn lại" value={money(summary.remaining ?? n(summary.totalNet) - n(summary.totalPaid))} />
          <BlackMetric label="Nhân viên" value={num(summary.totalStaff)} />
          <BlackMetric label="Cảnh báo" value={num(summary.totalWarnings)} />
          <BlackMetric label="Đi muộn/về sớm" value={`${num(summary.totalLateMinutes)}' / ${num(summary.totalEarlyMinutes)}'`} />
        </div>
      </section>

      {Array.isArray(dashboard?.byBranch) && dashboard.byBranch.length ? (
        <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-neutral-950">Thống kê theo chi nhánh</h2><span className="text-xs text-neutral-500">Click chi nhánh để lọc nhanh</span></div>
          <div className="grid gap-3 md:grid-cols-4">
            {dashboard.byBranch.map((b: any) => <button key={b.branchId || "ALL"} onClick={() => setFilters((s) => ({ ...s, branchId: b.branchId || "" }))} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-left hover:bg-white"><div className="text-sm font-semibold text-neutral-950">{b.branchName}</div><div className="mt-2 text-xl font-bold">{money(b.totalNet)}</div><div className="mt-1 text-xs text-neutral-500">{num(b.totalStaff)} NV · còn {money(n(b.totalNet) - n(b.totalPaid))} · cảnh báo {num(b.totalWarnings)}</div></button>)}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_190px_190px_auto]">
          <input value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Tìm kỳ lương, mã, chi nhánh..." className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          <select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))} className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="ALL">Tất cả trạng thái</option><option value="DRAFT">Nháp</option><option value="CALCULATED">Đã tính</option><option value="LOCKED">Đã khóa</option><option value="PARTIALLY_PAID">Trả một phần</option><option value="PAID">Đã trả</option></select>
          <select value={filters.branchId} onChange={(e) => setFilters((s) => ({ ...s, branchId: e.target.value }))} className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="">Tất cả chi nhánh</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name || b.code || b.id}</option>)}</select>
          <select value={filters.warning} onChange={(e) => setFilters((s) => ({ ...s, warning: e.target.value }))} className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm"><option value="ALL">Tất cả cảnh báo</option><option value="HAS_WARNING">Có cảnh báo chấm công</option></select>
          <button onClick={() => void load()} className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium hover:bg-neutral-50">Lọc</button>
        </div>
      </section>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Kỳ lương</th><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Chi nhánh</th><th className="px-4 py-3 text-right">NV</th><th className="px-4 py-3 text-right">Tổng lương</th><th className="px-4 py-3 text-right">Đã trả</th><th className="px-4 py-3 text-right">Cảnh báo</th><th className="px-4 py-3">Chấm công</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-neutral-100">
          {visibleRows.map((row) => { const meta = statusMeta(row.status); const rowBusy = Boolean(busy?.startsWith(row.id)); return <tr key={row.id} className="hover:bg-neutral-50/70"><td className="px-4 py-4"><Link href={`/payroll/${row.id}`} className="font-semibold text-neutral-950 hover:underline">{row.name || row.code}</Link><div className="mt-1 text-xs text-neutral-500">{row.code}</div></td><td className="px-4 py-4 text-neutral-600">{dateOnly(row.fromDate)} → {dateOnly(row.toDate)}</td><td className="px-4 py-4 text-neutral-600">{row.branchName || row.branchId || "Tất cả"}</td><td className="px-4 py-4 text-right">{num(row.totalStaff)}</td><td className="px-4 py-4 text-right font-semibold text-neutral-950">{money(row.totalNet)}</td><td className="px-4 py-4 text-right">{money(row.totalPaid)}</td><td className="px-4 py-4 text-right"><span className={n(row.totalAttendanceWarnings) ? "font-semibold text-red-600" : "text-neutral-400"}>{num(row.totalAttendanceWarnings)}</span></td><td className="px-4 py-4 text-xs text-neutral-500">{row.attendanceImportedAt ? `Đã nhập ${dateOnly(row.attendanceImportedAt)}` : "Chưa nhập"}<div>{row.attendanceImportFileName || ""}</div></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>{meta.label}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Link href={`/payroll/${row.id}`} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-white">Mở</Link><button disabled={rowBusy} onClick={() => runAction(row.id, "calc", () => calculatePayrollPeriod(row.id, { force: true }))} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-white disabled:opacity-50">Tính lại</button><button disabled={rowBusy || ["LOCKED", "PAID", "PARTIALLY_PAID"].includes(String(row.status || "").toUpperCase())} onClick={() => void handleThirteenthSalary(row)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40">Tính T13</button>{String(row.status).toUpperCase() === "LOCKED" ? <button disabled={rowBusy} onClick={() => runAction(row.id, "unlock", () => unlockPayrollPeriod(row.id))} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-white disabled:opacity-50">Mở khóa</button> : <button disabled={rowBusy} onClick={() => runAction(row.id, "lock", () => lockPayrollPeriod(row.id))} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-white disabled:opacity-50">Khóa</button>}<button disabled={rowBusy || String(row.status).toUpperCase() === "PAID"} onClick={() => runAction(row.id, "paid", () => markPayrollPeriodPaid(row.id, {}))} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Đã trả</button>{String(row.status || "DRAFT").toUpperCase() === "DRAFT" ? <button disabled={rowBusy} onClick={() => void handleDeletePeriod(row)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40">Xóa</button> : null}</div></td></tr>; })}
          {!visibleRows.length ? <tr><td colSpan={10} className="px-4 py-12 text-center text-neutral-500">{loading ? "Đang tải..." : "Chưa có kỳ lương nào."}</td></tr> : null}
        </tbody></table></div>
      </div>
      <PayrollCreatePeriodModal open={createOpen} branches={branches} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
function BlackMetric({ label, value, main = false }: { label: string; value: string; main?: boolean }) { return <div className={`rounded-3xl border border-white/10 bg-white/5 p-4 ${main ? "md:col-span-2" : ""}`}><div className="text-xs text-neutral-400">{label}</div><div className="mt-2 text-xl font-semibold text-white">{value}</div></div>; }
