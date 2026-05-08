"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";

type QuickRange = "today" | "yesterday" | "7d" | "30d" | "custom";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRange(type: QuickRange) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (type === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { from: toDateInput(d), to: toDateInput(d) };
  }

  if (type === "7d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: toDateInput(d), to: toDateInput(today) };
  }

  if (type === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return { from: toDateInput(d), to: toDateInput(today) };
  }

  return { from: toDateInput(today), to: toDateInput(today) };
}

export default function FinanceDailyPageClient() {
  const initialRange = useMemo(() => getRange("today"), []);
  const [quickRange, setQuickRange] = useState<QuickRange>("today");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);

  const [branchId, setBranchId] = useState("ALL");
  const [paymentSourceId, setPaymentSourceId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");

  const [branches, setBranches] = useState<any[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range === "custom") return;
    const next = getRange(range);
    setDateFrom(next.from);
    setDateTo(next.to);
  };

  const loadMeta = async () => {
    const [branchRows, sourceRows] = await Promise.all([
      apiJson<any[]>("/branches").catch(() => []),
      apiJson<any[]>("/payment-sources").catch(() => []),
    ]);

    setBranches(Array.isArray(branchRows) ? branchRows : []);
    setPaymentSources(Array.isArray(sourceRows) ? sourceRows : []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        branchId,
        paymentSourceId,
        status,
        q,
      });

      const result = await apiJson<any>(`/finance/daily?${params.toString()}`);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, branchId, paymentSourceId, status, q]);

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Đối soát tiền</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Theo dõi tiền thực thu theo ngày, chi nhánh, nguồn tiền và trạng thái. Đơn COD có khách chuyển khoản trước vẫn được ghi nhận ngay khi phát sinh thanh toán.
        </p>
      </div>

      <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">
              Khoảng thời gian
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ["today", "Hôm nay"],
                ["yesterday", "Hôm qua"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["custom", "Tuỳ chọn"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => applyQuickRange(value as QuickRange)}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    quickRange === value
                      ? "bg-black text-white"
                      : "border border-neutral-200 bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Từ ngày</p>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setQuickRange("custom");
                setDateFrom(e.target.value);
              }}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Đến ngày</p>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setQuickRange("custom");
                setDateTo(e.target.value);
              }}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Chi nhánh</p>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Nguồn tiền</p>
            <select
              value={paymentSourceId}
              onChange={(e) => setPaymentSourceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            >
              <option value="ALL">Tất cả nguồn tiền</option>
              {paymentSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => void loadData()}
              className="h-11 rounded-xl bg-black px-5 text-sm font-medium text-white"
            >
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã đơn, khách hàng, SĐT, ghi chú..."
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PAID">Đã thu</option>
            <option value="PENDING_COD">COD chờ về</option>
            <option value="PARTIAL">Thanh toán một phần</option>
            <option value="REFUNDED">Hoàn tiền</option>
            <option value="FAILED">Lỗi</option>
            <option value="UNPAID">Chưa thanh toán</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {[
          ["Tổng đã thu", summary.totalCollected ?? summary.totalPaid],
          ["COD chờ về", summary.totalCodPending],
          ["Thanh toán một phần", summary.totalPartial],
          ["Hoàn / lỗi", Number(summary.totalRefunded || 0) + Number(summary.totalFailed || 0)],
          ["TB / giao dịch", summary.averagePayment],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{currency(Number(value || 0))}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Tổng quan theo nguồn tiền</h3>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-neutral-400">
                  <th className="pb-3 font-medium">Nguồn tiền</th>
                  <th className="pb-3 font-medium">Loại</th>
                  <th className="pb-3 font-medium text-right">Thực thu</th>
                  <th className="pb-3 font-medium text-right">COD chờ</th>
                  <th className="pb-3 font-medium text-right">Tổng</th>
                  <th className="pb-3 font-medium text-right">Số đơn</th>
                </tr>
              </thead>
              <tbody>
                {(data?.bySource || []).map((row: any) => (
                  <tr key={row.paymentSourceId || row.sourceCode} className="border-b">
                    <td className="py-3 font-medium">{row.sourceName}</td>
                    <td className="py-3 text-neutral-500">{row.sourceType}</td>
                    <td className="py-3 text-right">{currency(row.collectedAmount ?? row.paidAmount)}</td>
                    <td className="py-3 text-right">{currency(row.codPendingAmount)}</td>
                    <td className="py-3 text-right font-medium">{currency(row.totalAmount)}</td>
                    <td className="py-3 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Tỷ lệ theo nguồn tiền</h3>

          <div className="mt-4 space-y-3">
            {(data?.bySource || []).map((row: any) => {
              const total = Number(summary.totalAll || 0);
              const percent = total ? Math.round((row.totalAmount / total) * 1000) / 10 : 0;

              return (
                <div key={row.paymentSourceId || row.sourceCode}>
                  <div className="flex justify-between text-sm">
                    <span>{row.sourceName}</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-neutral-900"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Chi tiết giao dịch</h3>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-400">
                <th className="pb-3 font-medium">Thời gian</th>
                <th className="pb-3 font-medium">Mã đơn</th>
                <th className="pb-3 font-medium">Khách hàng</th>
                <th className="pb-3 font-medium">Chi nhánh</th>
                <th className="pb-3 font-medium">Nguồn tiền</th>
                <th className="pb-3 font-medium text-right">Số tiền</th>
                <th className="pb-3 font-medium">Trạng thái</th>
                <th className="pb-3 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {(data?.payments || []).map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="py-3">
                    {new Date(p.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="py-3 font-medium">{p.orderCode}</td>
                  <td className="py-3">{p.customerName}</td>
                  <td className="py-3">{p.branchId}</td>
                  <td className="py-3">{p.sourceName}</td>
                  <td className="py-3 text-right font-medium">
                    {currency(p.amount)}
                  </td>
                  <td className="py-3">{p.status}</td>
                  <td className="py-3 text-neutral-500">{p.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data?.payments?.length ? (
          <p className="mt-4 text-sm text-neutral-500">
            Chưa có giao dịch trong khoảng thời gian này.
          </p>
        ) : null}
      </div>
    </div>
  );
}