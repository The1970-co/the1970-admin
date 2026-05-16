"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PayrollCreatePeriodModal from "./PayrollCreatePeriodModal";
import {
  createPayrollPeriod,
  calculatePayrollPeriod,
  listBranchOptions,
  listPayrollPeriods,
  lockPayrollPeriod,
  markPayrollPeriodPaid,
  unlockPayrollPeriod,
} from "@/lib/payroll-api";
import type { BranchOption, PayrollPeriod } from "@/types/payroll";

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
function dateOnly(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}
function statusMeta(status?: string) {
  const s = String(status || "DRAFT").toUpperCase();
  if (s === "PAID") return { label: "Đã trả", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (s === "PARTIALLY_PAID") return { label: "Trả một phần", cls: "border-blue-200 bg-blue-50 text-blue-700" };
  if (s === "LOCKED") return { label: "Đã khóa", cls: "border-neutral-300 bg-neutral-100 text-neutral-800" };
  if (s === "CALCULATED") return { label: "Đã tính", cls: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  if (s === "CANCELLED") return { label: "Đã hủy", cls: "border-red-200 bg-red-50 text-red-700" };
  return { label: "Nháp", cls: "border-amber-200 bg-amber-50 text-amber-700" };
}

export default function PayrollPageClient() {
  const [rows, setRows] = useState<PayrollPeriod[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "ALL", branchId: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [periodData, branchData] = await Promise.all([
        listPayrollPeriods({ pageSize: 50, ...filters }),
        listBranchOptions().catch(() => []),
      ]);
      setRows(Array.isArray(periodData?.rows) ? periodData.rows : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu tính lương.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.branchId]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.totalNet += n(row.totalNet);
        acc.totalPaid += n(row.totalPaid);
        acc.totalStaff += n(row.totalStaff);
        acc.totalOrders += n(row.totalOrders);
        acc.totalItems += n(row.totalItems);
        return acc;
      },
      { totalNet: 0, totalPaid: 0, totalStaff: 0, totalOrders: 0, totalItems: 0 },
    );
  }, [rows]);

  async function runAction(id: string, label: string, fn: () => Promise<any>) {
    setBusy(`${id}:${label}`);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice("Đã cập nhật kỳ lương.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate(body: any) {
    setError(null);
    try {
      await createPayrollPeriod(body);
      setCreateOpen(false);
      setNotice("Đã tạo kỳ lương mới.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo kỳ lương thất bại.");
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">Payroll Center</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Tính lương & sổ lương</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">Quản lý kỳ lương, tính hoa hồng theo đơn/sản phẩm/doanh thu, khóa sổ và xác nhận chi lương.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/payroll/config" className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50">Cấu hình lương</Link>
            <button onClick={() => setCreateOpen(true)} className="rounded-2xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800">Tạo kỳ lương</button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <Metric label="Tổng phải trả" value={money(summary.totalNet)} dark />
          <Metric label="Đã trả" value={money(summary.totalPaid)} />
          <Metric label="Còn lại" value={money(summary.totalNet - summary.totalPaid)} />
          <Metric label="Nhân viên" value={num(summary.totalStaff)} />
          <Metric label="Đơn / sản phẩm" value={`${num(summary.totalOrders)} / ${num(summary.totalItems)}`} />
        </div>
      </div>

      <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <input value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void load(); }} placeholder="Tìm kỳ lương, mã, chi nhánh..." className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          <select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))} className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="CALCULATED">Đã tính</option>
            <option value="LOCKED">Đã khóa</option>
            <option value="PARTIALLY_PAID">Trả một phần</option>
            <option value="PAID">Đã trả</option>
          </select>
          <select value={filters.branchId} onChange={(e) => setFilters((s) => ({ ...s, branchId: e.target.value }))} className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900">
            <option value="">Tất cả chi nhánh</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.code || branch.id}</option>)}
          </select>
          <button onClick={() => void load()} className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50">Lọc</button>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Kỳ lương</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3 text-right">NV</th>
                <th className="px-4 py-3 text-right">Đơn</th>
                <th className="px-4 py-3 text-right">SP</th>
                <th className="px-4 py-3 text-right">Phải trả</th>
                <th className="px-4 py-3 text-right">Đã trả</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row) => {
                const meta = statusMeta(row.status);
                const rowBusy = Boolean(busy?.startsWith(row.id));
                return (
                  <tr key={row.id} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-4">
                      <Link href={`/payroll/${row.id}`} className="font-semibold text-neutral-950 hover:underline">{row.name || row.code}</Link>
                      <div className="mt-1 text-xs text-neutral-500">{row.code}</div>
                    </td>
                    <td className="px-4 py-4 text-neutral-600">{dateOnly(row.fromDate)} → {dateOnly(row.toDate)}</td>
                    <td className="px-4 py-4 text-neutral-600">{row.branchName || row.branchId || "Tất cả"}</td>
                    <td className="px-4 py-4 text-right text-neutral-700">{num(row.totalStaff)}</td>
                    <td className="px-4 py-4 text-right text-neutral-700">{num(row.totalOrders)}</td>
                    <td className="px-4 py-4 text-right text-neutral-700">{num(row.totalItems)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-neutral-950">{money(row.totalNet)}</td>
                    <td className="px-4 py-4 text-right text-neutral-700">{money(row.totalPaid)}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>{meta.label}</span></td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/payroll/${row.id}`} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white">Mở</Link>
                        <button disabled={rowBusy} onClick={() => runAction(row.id, "calc", () => calculatePayrollPeriod(row.id, { force: true }))} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50">Tính lại</button>
                        {String(row.status).toUpperCase() === "LOCKED" ? (
                          <button disabled={rowBusy} onClick={() => runAction(row.id, "unlock", () => unlockPayrollPeriod(row.id))} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50">Mở khóa</button>
                        ) : (
                          <button disabled={rowBusy} onClick={() => runAction(row.id, "lock", () => lockPayrollPeriod(row.id))} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50">Khóa</button>
                        )}
                        <button disabled={rowBusy || String(row.status).toUpperCase() === "PAID"} onClick={() => runAction(row.id, "paid", () => markPayrollPeriodPaid(row.id, {}))} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Đã trả</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={10} className="px-4 py-12 text-center text-neutral-500">{loading ? "Đang tải..." : "Chưa có kỳ lương nào."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <PayrollCreatePeriodModal open={createOpen} branches={branches} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}

function Metric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return <div className={`rounded-3xl border p-4 ${dark ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50"}`}><div className={`text-xs ${dark ? "text-neutral-300" : "text-neutral-500"}`}>{label}</div><div className="mt-2 text-xl font-semibold">{value}</div></div>;
}
