"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";

type QuickRange = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
type FlowFilter = "ALL" | "RECEIPT" | "PAYMENT" | "POS" | "TRANSFER" | "CASH" | "BANK" | "OTHER";

type MoneyRow = {
  id?: string;
  voucherCode?: string;
  orderCode?: string;
  branchId?: string;
  branchName?: string;
  customerName?: string;
  customerPhone?: string;
  amount?: number;
  status?: string;
  flowType?: string;
  type?: string;
  method?: string;
  sourceName?: string;
  sourceCode?: string;
  sourceType?: string;
  title?: string;
  category?: string;
  note?: string;
  recordType?: string;
  createdAt?: string;
  paidAt?: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function numberText(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  if (type === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toDateInput(first), to: toDateInput(today) };
  }

  return { from: toDateInput(today), to: toDateInput(today) };
}

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

function timeText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sourceKind(row: any) {
  const sourceText = normalizeText([row?.sourceType, row?.sourceName, row?.sourceCode, row?.method].filter(Boolean).join(" "));

  if (sourceText.includes("cod")) return "COD";
  if (sourceText.includes("bank") || sourceText.includes("chuyen khoan") || sourceText.includes("bao kim") || sourceText.includes("vcb") || sourceText.includes("agribank")) {
    return "BANK";
  }
  if (sourceText.includes("cash") || sourceText.includes("tien mat") || sourceText.includes("tm")) {
    return "CASH";
  }
  return row?.sourceType || "OTHER";
}

function isReceiptRow(row: MoneyRow) {
  const type = String(row.flowType || row.type || "").toUpperCase();
  if (type === "PAYMENT") return false;
  if (type === "RECEIPT") return true;
  if (String(row.recordType || "").toUpperCase() === "CASH_VOUCHER") return true;
  return Number(row.amount || 0) >= 0;
}

function isPosRow(row: MoneyRow) {
  const text = normalizeText([row.voucherCode, row.orderCode, row.title, row.category, row.note, row.recordType].filter(Boolean).join(" "));
  return text.includes("pos") || text.includes("ban le");
}

function rowAmountSigned(row: MoneyRow) {
  const amount = Number(row.amount || 0);
  return isReceiptRow(row) ? amount : -amount;
}

function rowStatusLabel(row: MoneyRow) {
  const status = String(row.status || "").toUpperCase();
  if (status === "CONFIRMED") return "Đã xác nhận";
  if (status === "PAID") return "Đã thu";
  if (status === "PARTIAL") return "Thu một phần";
  if (status === "PENDING_COD") return "COD chờ";
  if (status === "DRAFT") return "Nháp";
  if (status === "CANCELLED") return "Đã huỷ";
  if (status === "REFUNDED") return "Hoàn tiền";
  return row.status || "—";
}

function rowStatusClass(row: MoneyRow) {
  const status = String(row.status || "").toUpperCase();
  if (status === "CONFIRMED" || status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PARTIAL") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PENDING_COD" || status === "DRAFT") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CANCELLED" || status === "REFUNDED" || status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function passFlowFilter(row: MoneyRow, flow: FlowFilter) {
  if (flow === "ALL") return true;
  if (flow === "RECEIPT") return isReceiptRow(row);
  if (flow === "PAYMENT") return !isReceiptRow(row);
  if (flow === "POS") return isPosRow(row);
  if (flow === "TRANSFER") return sourceKind(row) === "BANK";
  if (flow === "CASH") return sourceKind(row) === "CASH";
  if (flow === "BANK") return sourceKind(row) === "BANK";
  if (flow === "OTHER") return !["BANK", "CASH", "COD"].includes(sourceKind(row));
  return true;
}

function safeRows(value: unknown): MoneyRow[] {
  return Array.isArray(value) ? (value as MoneyRow[]) : [];
}

export default function FinanceDailyPageClient() {
  const initialRange = useMemo(() => getRange("today"), []);
  const [quickRange, setQuickRange] = useState<QuickRange>("today");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);

  const [branchId, setBranchId] = useState("ALL");
  const [paymentSourceId, setPaymentSourceId] = useState("ALL");
  const [flow, setFlow] = useState<FlowFilter>("ALL");
  const [q, setQ] = useState("");

  const [branches, setBranches] = useState<any[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setError("");

    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        branchId,
        paymentSourceId,
        status: flow === "RECEIPT" || flow === "PAYMENT" ? flow : "ALL",
        q,
      });

      const result = await apiJson<any>(`/finance/daily?${params.toString()}`);
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Không tải được tổng quan nguồn tiền.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, branchId, paymentSourceId, flow, q]);

  const rows = useMemo(() => {
    const rawRows = safeRows(data?.payments);

    return rawRows
      .filter((row) => passFlowFilter(row, flow))
      .filter((row) => {
        if (!q.trim()) return true;
        const keyword = normalizeText(q);
        const haystack = normalizeText([
          row.voucherCode,
          row.orderCode,
          row.customerName,
          row.customerPhone,
          row.branchName,
          row.branchId,
          row.sourceName,
          row.sourceCode,
          row.method,
          row.title,
          row.category,
          row.note,
        ].filter(Boolean).join(" "));
        return haystack.includes(keyword);
      });
  }, [data, flow, q]);

  const summary = useMemo(() => {
    const receipt = rows
      .filter((row) => isReceiptRow(row))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const payment = rows
      .filter((row) => !isReceiptRow(row))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const pos = rows
      .filter((row) => isPosRow(row))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const transfer = rows
      .filter((row) => sourceKind(row) === "BANK")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const cash = rows
      .filter((row) => sourceKind(row) === "CASH")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      receipt,
      payment,
      net: receipt - payment,
      count: rows.length,
      average: rows.length ? Math.round((receipt + payment) / rows.length) : 0,
      pos,
      transfer,
      cash,
    };
  }, [rows]);

  const bySource = useMemo(() => {
    const map = new Map<string, any>();

    rows.forEach((row) => {
      const key = row.sourceName || row.sourceCode || row.method || "Chưa rõ nguồn tiền";
      const current = map.get(key) || {
        sourceName: key,
        sourceType: sourceKind(row),
        receipt: 0,
        payment: 0,
        net: 0,
        count: 0,
        pos: 0,
      };

      if (isReceiptRow(row)) current.receipt += Number(row.amount || 0);
      else current.payment += Number(row.amount || 0);

      if (isPosRow(row)) current.pos += Number(row.amount || 0);

      current.net = current.receipt - current.payment;
      current.count += 1;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [rows]);

  const byBranch = useMemo(() => {
    const map = new Map<string, any>();

    rows.forEach((row) => {
      const key = row.branchName || row.branchId || "Chưa rõ chi nhánh";
      const current = map.get(key) || {
        branchName: key,
        receipt: 0,
        payment: 0,
        net: 0,
        count: 0,
      };

      if (isReceiptRow(row)) current.receipt += Number(row.amount || 0);
      else current.payment += Number(row.amount || 0);

      current.net = current.receipt - current.payment;
      current.count += 1;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [rows]);

  const sourceTotal = Math.max(1, bySource.reduce((sum, row) => sum + Math.abs(Number(row.net || 0)), 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-neutral-500">Tài chính / Tổng quan nguồn tiền</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">Tổng quan nguồn tiền</h1>
          <p className="mt-1 max-w-4xl text-sm text-neutral-500">
            Theo dõi tiền thực nhận theo nguồn tiền, chi nhánh và loại dòng tiền. POS hoàn thành, phiếu thu/chi xác nhận và tiền cọc/chuyển khoản đã ghi nhận được gom vào đây.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.href = "/finance/cash-receipts"}
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Phiếu thu
          </button>
          <button
            type="button"
            onClick={() => window.location.href = "/finance/cash-payments"}
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Phiếu chi
          </button>
        </div>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Khoảng thời gian</p>
            <div className="flex flex-wrap gap-2">
              {[
                ["today", "Hôm nay"],
                ["yesterday", "Hôm qua"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
                ["custom", "Tuỳ chọn"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyQuickRange(value as QuickRange)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    quickRange === value
                      ? "bg-black text-white"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Từ ngày">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setQuickRange("custom");
                setDateFrom(event.target.value);
              }}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </Field>

          <Field label="Đến ngày">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setQuickRange("custom");
                setDateTo(event.target.value);
              }}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </Field>

          <Field label="Chi nhánh">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.code || branch.id}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nguồn tiền">
            <select
              value={paymentSourceId}
              onChange={(event) => setPaymentSourceId(event.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            >
              <option value="ALL">Tất cả nguồn tiền</option>
              {paymentSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name || source.code || source.id}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadData()}
              className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white"
            >
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_260px_220px]">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Tìm mã đơn, phiếu, khách, SĐT, nguồn tiền, ghi chú..."
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          />

          <select
            value={flow}
            onChange={(event) => setFlow(event.target.value as FlowFilter)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả dòng tiền</option>
            <option value="RECEIPT">Chỉ tiền vào</option>
            <option value="PAYMENT">Chỉ tiền ra</option>
            <option value="POS">Bán lẻ POS hoàn thành</option>
            <option value="TRANSFER">Chuyển khoản / cọc</option>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK">Ngân hàng</option>
            <option value="OTHER">Nguồn khác</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setBranchId("ALL");
              setPaymentSourceId("ALL");
              setFlow("ALL");
              setQ("");
              applyQuickRange("today");
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold"
          >
            Làm mới bộ lọc
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Stat label="Tổng tiền vào" value={currency(summary.receipt)} hint="Phiếu thu + POS + CK/cọc" />
        <Stat label="Tổng tiền ra" value={currency(summary.payment)} hint="Phiếu chi/hoàn/chi vận hành" />
        <Stat label="Số dư ròng" value={currency(summary.net)} hint="Tiền vào - tiền ra" />
        <Stat label="POS hoàn thành" value={currency(summary.pos)} hint="Đơn POS đã completed" />
        <Stat label="CK / cọc" value={currency(summary.transfer)} hint="Nguồn ngân hàng" />
        <Stat label="Số giao dịch" value={numberText(summary.count)} hint={`TB ${currency(summary.average)}`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Tổng quan theo nguồn tiền</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Nhìn nhanh mỗi tài khoản/quỹ đang thu chi bao nhiêu trong khoảng lọc.
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
              {bySource.length} nguồn
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-3 pr-3">Nguồn tiền</th>
                  <th className="py-3 pr-3">Loại</th>
                  <th className="py-3 pr-3 text-right">Tiền vào</th>
                  <th className="py-3 pr-3 text-right">Tiền ra</th>
                  <th className="py-3 pr-3 text-right">Ròng</th>
                  <th className="py-3 text-right">GD</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((source) => (
                  <tr key={source.sourceName} className="border-b border-neutral-100">
                    <td className="py-3 pr-3 font-semibold">{source.sourceName}</td>
                    <td className="py-3 pr-3 text-neutral-500">{source.sourceType}</td>
                    <td className="py-3 pr-3 text-right">{currency(source.receipt)}</td>
                    <td className="py-3 pr-3 text-right">{currency(source.payment)}</td>
                    <td className="py-3 pr-3 text-right font-semibold">{currency(source.net)}</td>
                    <td className="py-3 text-right">{source.count}</td>
                  </tr>
                ))}

                {!bySource.length ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      Chưa có dòng tiền trong khoảng lọc.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tỷ lệ theo nguồn tiền</h2>
          <p className="mt-1 text-sm text-neutral-500">Nguồn nào đang chiếm tỷ trọng lớn nhất.</p>

          <div className="mt-5 space-y-4">
            {bySource.slice(0, 8).map((source) => {
              const percent = Math.round((Math.abs(Number(source.net || 0)) / sourceTotal) * 100);
              return (
                <div key={source.sourceName}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{source.sourceName}</span>
                    <span className="text-neutral-500">{percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-neutral-950"
                      style={{ width: `${Math.max(2, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {!bySource.length ? (
              <div className="rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">
                Chưa có dữ liệu để vẽ tỷ lệ nguồn tiền.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Theo chi nhánh</h2>
            <p className="mt-1 text-sm text-neutral-500">Tách dòng tiền theo từng chi nhánh để chốt quỹ cuối ngày.</p>
          </div>
          <span className="text-sm text-neutral-500">{byBranch.length} chi nhánh</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {byBranch.map((branch) => (
            <div key={branch.branchName} className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-sm font-semibold">{branch.branchName}</div>
              <div className="mt-3 text-2xl font-semibold">{currency(branch.net)}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                <div>Thu: {currency(branch.receipt)}</div>
                <div>Chi: {currency(branch.payment)}</div>
                <div>{branch.count} giao dịch</div>
              </div>
            </div>
          ))}

          {!byBranch.length ? (
            <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">
              Chưa có dữ liệu chi nhánh.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Chi tiết giao dịch</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Gồm POS hoàn thành, phiếu thu/chi, chuyển khoản/cọc đã ghi nhận.
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
              {rows.length} dòng
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3">Nguồn tiền</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ghi chú</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.id || row.orderCode || index}`} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{timeText(row.paidAt || row.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold">
                    <div>{row.voucherCode || row.orderCode || "—"}</div>
                    {row.voucherCode && row.orderCode && row.voucherCode !== row.orderCode ? (
                      <div className="text-xs font-normal text-neutral-400">{row.orderCode}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.customerName || "—"}</div>
                    <div className="text-xs text-neutral-500">{row.customerPhone || "—"}</div>
                  </td>
                  <td className="px-4 py-3">{row.branchName || row.branchId || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.sourceName || row.method || "—"}</div>
                    <div className="text-xs text-neutral-500">{sourceKind(row)}</div>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${rowAmountSigned(row) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {rowAmountSigned(row) >= 0 ? "+" : "-"}{currency(Math.abs(rowAmountSigned(row)))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${rowStatusClass(row)}`}>
                      {rowStatusLabel(row)}
                    </span>
                  </td>
                  <td className="max-w-[460px] px-4 py-3 text-xs text-neutral-500">
                    {[row.title, row.category, row.note].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                    Chưa có giao dịch trong khoảng lọc này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">{value}</div>
      {hint ? <p className="mt-2 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
