"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  Maximize2,
  Minimize2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CreditCard,
  Filter,
  Landmark,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";

type AnyRow = Record<string, any>;

type FinanceSummary = {
  totalIn?: number;
  totalOut?: number;
  netAmount?: number;
  netCashFlow?: number;
  totalCollected?: number;
  totalReceipt?: number;
  totalPayment?: number;
  totalSpent?: number;
  totalPaid?: number;
  totalPayments?: number;
  posAmount?: number;
  bankAmount?: number;
  cashAmount?: number;
  cashRemain?: number;
  cashOnHand?: number;
  cashClosingBalance?: number;
  ledgerOpeningBalance?: number;
  ledgerClosingBalance?: number;
  ledgerTotalReceipt?: number;
  ledgerTotalPayment?: number;
  ledgerNetAmount?: number;
  endBalance?: number;
  endingBalance?: number;
  transactionCount?: number;
  totalDifference?: number;
  sources?: AnyRow[];
  sourceRows?: AnyRow[];
  bySource?: AnyRow[];
  branches?: AnyRow[];
  branchRows?: AnyRow[];
  dailyRows?: AnyRow[];
  closeRows?: AnyRow[];
  ledgerRows?: AnyRow[];
};

type FinanceDailyResponse = {
  dateFrom?: string;
  dateTo?: string;
  summary?: FinanceSummary;
  bySource?: AnyRow[];
  payments?: AnyRow[];
  ledgerRows?: AnyRow[];
  dailyRows?: AnyRow[];
  ledger?: {
    rows?: AnyRow[];
    summary?: AnyRow;
  };
};

const RANGE_OPTIONS = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "custom", label: "Tùy chọn" },
] as const;

async function getJson<T>(path: string): Promise<T> {
  return apiJson<T>(path, {
    redirectOnUnauthorized: true,
    timeoutMs: 30000,
  } as any);
}

async function optionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await getJson<T>(path);
  } catch {
    return fallback;
  }
}

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rangeDates(range: string, customFrom?: string, customTo?: string) {
  if (range === "custom") return { from: customFrom || dateInput(new Date()), to: customTo || dateInput(new Date()) };
  const toDate = new Date();
  const fromDate = new Date();

  if (range === "yesterday") {
    toDate.setDate(toDate.getDate() - 1);
    fromDate.setDate(fromDate.getDate() - 1);
  }

  if (range === "7d") fromDate.setDate(fromDate.getDate() - 6);
  if (range === "30d") fromDate.setDate(fromDate.getDate() - 29);

  return { from: dateInput(fromDate), to: dateInput(toDate) };
}

function num(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = num(value);
    if (parsed !== 0) return parsed;
  }
  return 0;
}

function money(value: unknown) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(num(value)))}đ`;
}

function compact(value: unknown) {
  const amount = num(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;

  return `${sign}${new Intl.NumberFormat("vi-VN").format(Math.round(abs))}`;
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isReceipt(row: AnyRow) {
  const type = String(row.flowType || row.type || row.direction || "").toUpperCase();
  if (["PAYMENT", "OUT", "EXPENSE"].includes(type)) return false;
  if (["RECEIPT", "IN", "INCOME"].includes(type)) return true;
  return num(row.amount) >= 0;
}

function sourceKind(row: AnyRow) {
  const text = normalize([row.method, row.sourceType, row.type, row.sourceName, row.name, row.title, row.note].filter(Boolean).join(" "));
  if (text.includes("card") || text.includes("quet")) return "CARD";
  if (text.includes("bank") || text.includes("chuyen khoan") || text.includes("vcb") || text.includes("agribank") || text.includes("bao kim") || text.includes("bidv")) return "BANK";
  if (text.includes("cash") || text.includes("tien mat") || text.includes("tm")) return "CASH";
  if (text.includes("cod")) return "COD";
  return row.sourceType || "Khác";
}

function sourceName(row: AnyRow) {
  return row.sourceName || row.name || row.paymentSourceName || row.source || "Nguồn tiền";
}

function branchName(row: AnyRow) {
  return row.branchName || row.name || row.branch || row.branchCode || "Chi nhánh";
}

function rowDate(row: AnyRow) {
  const raw = row.paidAt || row.createdAt || row.date || row.day;
  if (!raw) return "—";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

// Giống bảng "Tổng quan theo nguồn tiền" trên web: nguồn số liệu là
// /finance/daily.bySource (thu, chi, ròng TRONG KỲ), không phải số dư sổ quỹ.
// /payment-sources chỉ dùng để giữ cả nguồn có 0 giao dịch trong kỳ.
function buildSources(summary: FinanceSummary | null, payments: AnyRow[], configuredSources: AnyRow[]): AnyRow[] {
  const bySource = Array.isArray(summary?.bySource) ? summary.bySource
    : Array.isArray(summary?.sourceRows) ? summary.sourceRows
    : Array.isArray(summary?.sources) ? summary.sources : [];
  const map = new Map<string, AnyRow>();
  const sourceKey = (row: AnyRow) => String(row.paymentSourceId || row.id || row.sourceCode || row.code || row.sourceName || row.name || "").trim();
  for (const source of configuredSources) {
    if (source.isActive === false) continue;
    const key = sourceKey(source);
    if (!key) continue;
    map.set(key, {
      paymentSourceId: source.id || null,
      sourceName: source.name || source.code || key,
      sourceType: source.type || source.sourceType || "OTHER",
      branchName: source.branchName || source.branch?.name || "",
      branchCode: source.branchCode || source.branch?.code || "",
      totalIn: 0, totalOut: 0, netAmount: 0, transactionCount: 0,
    });
  }
  const periodRows = bySource.length ? bySource : (() => {
    // Fallback khi API cũ không trả bySource: nhóm giao dịch phát sinh.
    const groups = new Map<string, AnyRow>();
    for (const payment of payments) {
      const key = String(payment.paymentSourceId || payment.sourceCode || payment.sourceName || payment.method || "");
      if (!key) continue;
      const row = groups.get(key) || {
        paymentSourceId: payment.paymentSourceId,
        sourceName: sourceName(payment), sourceType: sourceKind(payment),
        totalIn: 0, totalOut: 0, transactionCount: 0,
      };
      const amount = Math.abs(num(payment.amount));
      if (isReceipt(payment)) row.totalIn += amount;
      else row.totalOut += amount;
      row.transactionCount += 1;
      groups.set(key, row);
    }
    return Array.from(groups.values());
  })();
  for (const row of periodRows) {
    const key = String(row.paymentSourceId || row.sourceCode || row.sourceName || row.method || "").trim();
    if (!key) continue;
    const configured = map.get(key);
    // Dùng ?? thay vì firstNumber vì 0 là giá trị hợp lệ.
    const totalIn = num(row.totalIn ?? row.collectedAmount ?? row.paidAmount ?? row.totalReceipt ?? 0);
    const totalOut = num(row.totalOut ?? row.paymentAmount ?? row.spentAmount ?? row.totalPayment ?? 0);
    map.set(key, {
      ...(configured || {}),
      paymentSourceId: row.paymentSourceId || configured?.paymentSourceId || null,
      sourceName: configured?.sourceName || sourceName(row),
      sourceType: configured?.sourceType || row.sourceType || sourceKind(row),
      branchName: configured?.branchName || row.branchName || "",
      branchCode: configured?.branchCode || row.branchCode || "",
      totalIn, totalOut,
      netAmount: totalIn - totalOut,
      transactionCount: num(row.transactionCount ?? row.count ?? 0),
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const group = (name: string) => { const index = SOURCE_BRANCHES.indexOf(name as typeof SOURCE_BRANCHES[number]); return index < 0 ? 99 : index; };
    return group(moneySourceBranch(a)) - group(moneySourceBranch(b)) ||
      String(a.sourceName).localeCompare(String(b.sourceName), "vi");
  });
}

// Nhóm theo chi nhánh, không xếp ABC hoặc theo giá trị giao dịch.
const SOURCE_BRANCHES = ["THÁI HÀ", "QUỐC OAI", "CHÙA LÁNG", "XÃ ĐÀN"] as const;
function moneySourceBranch(source: AnyRow): string {
  const raw = normalize([
    source.branchName, source.branch?.name, source.branchCode, source.branch?.code,
    source.sourceName, source.sourceCode, source.name, source.code,
  ].filter(Boolean).join(" ")).replace(/[_-]/g, " ");
  if (/thai\s*ha|(?:^|\s)th(?:$|\s)/.test(raw)) return "THÁI HÀ";
  if (/quoc\s*oai|(?:^|\s)qo(?:$|\s)/.test(raw)) return "QUỐC OAI";
  if (/chua\s*lang|(?:^|\s)cl(?:$|\s)/.test(raw)) return "CHÙA LÁNG";
  if (/xa\s*dan|(?:^|\s)xd(?:$|\s)/.test(raw)) return "XÃ ĐÀN";
  return "KHÁC / CHUNG";
}

function buildBranches(summary: FinanceSummary | null, rows: AnyRow[]): AnyRow[] {
  const apiRows = summary?.branches || summary?.branchRows || [];
  if (apiRows.length) return apiRows;

  const map = new Map<string, AnyRow>();

  rows.forEach((row) => {
    const key = branchName(row);
    const current = map.get(key) || {
      branchName: key,
      totalIn: 0,
      totalOut: 0,
      netAmount: 0,
      cashRemain: 0,
      transactionCount: 0,
      sources: [],
    };

    const receipt = firstNumber(row.totalReceipt, row.receiptAmount, row.manualReceiptAmount, row.posReceiptAmount);
    const payment = firstNumber(row.totalPayment, row.paymentAmount, row.manualPaymentAmount);
    const hasLedgerAmount = receipt !== 0 || payment !== 0 || row.closingBalance !== undefined;

    if (hasLedgerAmount) {
      current.totalIn += receipt;
      current.totalOut += payment;
      current.netAmount += firstNumber(row.netAmount, row.net, receipt - payment);
      if (sourceKind(row) === "CASH") {
        current.cashRemain += firstNumber(row.cashRemain, row.cashOnHand, row.closingBalance);
      }
      current.transactionCount += firstNumber(row.transactionCount, row.count, 1);
    } else {
      const amount = Math.abs(num(row.amount));
      if (isReceipt(row)) current.totalIn += amount;
      else current.totalOut += amount;

      if (sourceKind(row) === "CASH") current.cashRemain += isReceipt(row) ? amount : -amount;

      current.netAmount = current.totalIn - current.totalOut;
      current.transactionCount += 1;
    }

    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => num(b.netAmount) - num(a.netAmount));
}

function buildDailyRows(summary: FinanceSummary | null, rows: AnyRow[]): AnyRow[] {
  const apiRows = summary?.dailyRows || summary?.ledgerRows || summary?.closeRows || [];
  if (apiRows.length) {
    const map = new Map<string, AnyRow>();

    apiRows.forEach((row) => {
      const key = String(row.date || row.day || new Date().toISOString()).slice(0, 10);
      const current = map.get(key) || {
        date: key,
        beginningBalance: 0,
        posAmount: 0,
        receiptAmount: 0,
        paymentAmount: 0,
        netAmount: 0,
        endingBalance: 0,
        cashRemain: 0,
        difference: 0,
        branches: [],
      };

      current.beginningBalance += num(row.openingBalance || row.beginningBalance);
      current.posAmount += num(row.posAmount || row.posReceiptAmount);
      current.receiptAmount += num(row.receiptAmount || row.totalReceipt || row.manualReceiptAmount);
      current.paymentAmount += num(row.paymentAmount || row.totalPayment || row.manualPaymentAmount);
      current.netAmount += num(row.netAmount);
      current.endingBalance += num(row.endingBalance || row.closingBalance);
      if (sourceKind(row) === "CASH") {
        current.cashRemain += num(row.cashRemain || row.cashOnHand || row.closingBalance);
      }
      current.difference += num(row.difference || row.differenceAmount);

      current.branches.push(row);
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  const map = new Map<string, AnyRow>();

  rows.forEach((row) => {
    const raw = row.paidAt || row.createdAt || new Date().toISOString();
    const date = new Date(raw);
    const key = Number.isNaN(date.getTime()) ? String(raw).slice(0, 10) : dateInput(date);
    const current = map.get(key) || {
      date: key,
      beginningBalance: 0,
      posAmount: 0,
      receiptAmount: 0,
      paymentAmount: 0,
      netAmount: 0,
      endingBalance: 0,
      cashRemain: 0,
      difference: 0,
      branches: [],
    };

    const amount = Math.abs(num(row.amount));
    if (isReceipt(row)) {
      current.posAmount += amount;
      current.receiptAmount += amount;
      current.netAmount += amount;
      if (sourceKind(row) === "CASH") current.cashRemain += amount;
    } else {
      current.paymentAmount += amount;
      current.netAmount -= amount;
      if (sourceKind(row) === "CASH") current.cashRemain -= amount;
    }

    current.endingBalance = current.beginningBalance + current.netAmount;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function StatCard({
  title,
  value,
  sub,
  dark = false,
  danger = false,
}: {
  title: string;
  value: string;
  sub: string;
  dark?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-[1.65rem] p-4 shadow-sm ${dark ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"}`}>
      <div className={`text-[11px] font-black uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-neutral-400"}`}>
        {title}
      </div>
      <div className={`mt-3 break-all text-[clamp(1rem,4.2vw,1.4rem)] font-black tracking-tight tabular-nums ${danger ? "text-rose-600" : ""}`}>{value}</div>
      <div className={`mt-2 text-xs leading-5 ${dark ? "text-white/55" : "text-neutral-500"}`}>{sub}</div>
    </div>
  );
}

function Section({
  title,
  sub,
  count,
  children,
}: {
  title: string;
  sub?: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.8rem] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-neutral-950">{title}</h2>
          {sub ? <p className="mt-1 text-sm leading-5 text-neutral-500">{sub}</p> : null}
        </div>
        {count ? <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">{count}</span> : null}
      </div>
      {children}
    </section>
  );
}

function RatioBar({ value, max }: { value: number; max: number }) {
  const width = Math.max(7, Math.min(100, Math.round((Math.abs(value) / Math.max(max, 1)) * 100)));

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-neutral-950" style={{ width: `${width}%` }} />
    </div>
  );
}

const BRANCH_LABELS = ["THÁI HÀ", "QUỐC OAI", "CHÙA LÁNG", "XÃ ĐÀN"] as const;
function renderMoneySourcesTable(sources: AnyRow[], expanded = false) {
  let lastGroup = "";
  return (
    <table className="w-full min-w-[690px] border-collapse text-[11px] tabular-nums">
      <thead className="sticky top-0 z-20 bg-neutral-100 text-neutral-500">
        <tr>
          <th className={`sticky left-0 z-30 border-r border-neutral-200 bg-neutral-100 py-2 text-left font-bold ${expanded ? "w-[180px] min-w-[180px] max-w-[180px] px-2" : "w-[76px] min-w-[76px] max-w-[76px] px-1"}`}>Nguồn tiền</th>
          <th className="min-w-[120px] px-2 py-2 text-right font-bold">Tiền vào</th>
          <th className="min-w-[120px] px-2 py-2 text-right font-bold">Tiền ra</th>
          <th className="min-w-[125px] px-2 py-2 text-right font-bold">Ròng</th>
          <th className="min-w-[40px] px-2 py-2 text-right font-bold">GD</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((source, index) => {
          const group = moneySourceBranch(source);
          const showGroup = group !== lastGroup;
          lastGroup = group;
          const totalIn = num(source.totalIn ?? source.inAmount ?? source.receiptAmount ?? 0);
          const totalOut = num(source.totalOut ?? source.outAmount ?? source.paymentAmount ?? 0);
          const net = totalIn - totalOut;
          const bg = index % 2 ? "bg-neutral-50" : "bg-white";
          return (
            <Fragment key={`${source.paymentSourceId || sourceName(source)}-${index}`}>
              {showGroup ? <tr className="bg-neutral-200/80"><td colSpan={5} className="sticky left-0 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-700">{group}</td></tr> : null}
              <tr className={`border-t border-neutral-100 ${bg}`}>
                <td className={`sticky left-0 z-10 border-r border-neutral-100 py-2 font-bold text-neutral-900 ${bg} ${expanded ? "w-[180px] min-w-[180px] max-w-[180px] px-2" : "w-[76px] min-w-[76px] max-w-[76px] px-1"}`} title={sourceName(source)}><div className={expanded ? "truncate" : "line-clamp-2 break-words text-[10px] leading-3"}>{sourceName(source)}</div></td>
                <td className="whitespace-nowrap px-2 py-2 text-right">{money(totalIn)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right">{money(totalOut)}</td>
                <td className={`whitespace-nowrap px-2 py-2 text-right font-extrabold ${net < 0 ? "text-rose-700" : "text-neutral-950"}`}>{money(net)}</td>
                <td className="px-2 py-2 text-right">{num(source.transactionCount ?? source.count ?? 0)}</td>
              </tr>
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}


function ledgerBranchName(row: AnyRow): string {
  const value = normalize(row.branchName || row.branch?.name || row.branchCode || "").trim();
  const source = normalize(row.paymentSourceName || row.paymentSourceCode || "");
  const candidate = value || source;
  if (/thai\s*ha|(?:^|[\s_-])th(?:$|[\s_-])/.test(candidate)) return "THÁI HÀ";
  if (/quoc\s*oai|(?:^|[\s_-])qo(?:$|[\s_-])/.test(candidate)) return "QUỐC OAI";
  if (/chua\s*lang|(?:^|[\s_-])cl(?:$|[\s_-])/.test(candidate)) return "CHÙA LÁNG";
  if (/xa\s*dan|(?:^|[\s_-])xd(?:$|[\s_-])/.test(candidate)) return "XÃ ĐÀN";
  return String(row.branchName || row.branchCode || "Chưa xác định chi nhánh");
}

function isLedgerCash(row: AnyRow): boolean {
  return sourceKind({
    sourceType: row.sourceType || row.paymentSourceType,
    name: row.paymentSourceName,
    method: row.paymentSourceCode,
  }) === "CASH";
}

function BranchLedgerTable({ name, ledgerRows, onExpand, expanded = false }: { name: string; ledgerRows: AnyRow[]; onExpand?: () => void; expanded?: boolean }) {
  const amount = (field: string) => ledgerRows.reduce((total, row) => total + num(row[field]), 0);
  const receipts = amount("totalReceipt");
  const payments = amount("totalPayment");
  const closing = amount("closingBalance");
  const cash = ledgerRows.filter(isLedgerCash).reduce((total, row) => total + num(row.closingBalance), 0);
  const th = "whitespace-nowrap px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-neutral-500";
  const td = "whitespace-nowrap px-2 py-2 text-right text-[11px] tabular-nums";
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="bg-neutral-950 px-3 py-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-black">{name}</div>
            <div className="mt-1 text-[11px] text-white/60">{ledgerRows.length} nguồn tiền</div>
          </div>
          {onExpand ? <button type="button" onClick={onExpand} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-[11px] font-bold text-neutral-950"><Maximize2 className="h-3.5 w-3.5" /> Xem bảng rộng</button> : null}
        </div>
        <div className={`mt-3 grid gap-2 text-[11px] ${expanded ? "grid-cols-4" : "grid-cols-2"}`}>
          <div className="rounded-lg bg-white/10 p-2">Tổng thu <div className="mt-1 font-bold tabular-nums text-emerald-300">{money(receipts)}</div></div>
          <div className="rounded-lg bg-white/10 p-2">Tổng chi <div className="mt-1 font-bold tabular-nums">{money(payments)}</div></div>
          <div className="rounded-lg bg-white/10 p-2">Số dư cuối theo sổ <div className="mt-1 font-bold tabular-nums">{money(closing)}</div></div>
          <div className="rounded-lg bg-white/10 p-2">Tiền mặt theo sổ <div className="mt-1 font-bold tabular-nums">{money(cash)}</div></div>
        </div>
      </div>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="min-w-[1150px] w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: expanded ? 165 : 78 }} />
            {Array.from({ length: 9 }, (_, index) => <col key={index} style={{ width: index === 8 ? 105 : 125 }} />)}
          </colgroup>
          <thead className="bg-neutral-100">
            <tr>
              <th className={`sticky left-0 z-20 bg-neutral-100 py-2 text-left text-[9px] font-bold uppercase text-neutral-500 ${expanded ? "px-3" : "px-1.5"}`}>Nguồn tiền</th>
              {(["Số dư đầu", "POS/Payment", "Phiếu thu", "Phiếu chi", "Thu − chi", "Số dư cuối", "Thực đếm", "Lệch", "Trạng thái"] as const).map(label => <th key={label} className={th}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {ledgerRows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-4 text-xs text-neutral-500">Không có nguồn tiền trong dữ liệu sổ ngày này.</td></tr>
            ) : ledgerRows.map((row, i) => {
              const pos = num(row.posReceiptAmount);
              const receipt = num(row.manualReceiptAmount);
              const payment = num(row.manualPaymentAmount);
              const net = num(row.netAmount ?? (pos + receipt - payment));
              const bg = i % 2 ? "bg-neutral-50" : "bg-white";
              return (
                <tr key={`${row.branchId || name}-${row.paymentSourceId || row.paymentSourceName || i}-${i}`} className={`border-t border-neutral-100 ${bg}`}>
                  <td className={`sticky left-0 z-10 border-r border-neutral-100 py-2 ${expanded ? "px-3" : "px-1.5"} ${bg}`}>
                    <div className={`${expanded ? "truncate text-[11px]" : "line-clamp-2 break-words text-[9px] leading-3"} font-bold text-neutral-900`} title={String(row.paymentSourceName || "")}>{row.paymentSourceName || row.paymentSourceCode || "—"}</div>
                    <div className={`${expanded ? "text-[10px]" : "text-[9px]"} truncate text-neutral-500`}>{row.sourceType || row.paymentSourceType || "Khác"}</div>
                  </td>
                  <td className={td}>{money(row.openingBalance)}</td>
                  <td className={`${td} text-emerald-700`}>{money(pos)}</td>
                  <td className={`${td} text-emerald-700`}>{money(receipt)}</td>
                  <td className={`${td} text-rose-700`}>{money(payment)}</td>
                  <td className={`${td} font-bold ${net < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(net)}</td>
                  <td className={`${td} font-bold`}>{money(row.closingBalance)}</td>
                  <td className={td}>{row.countedAmount == null ? "—" : money(row.countedAmount)}</td>
                  <td className={td}>{row.differenceAmount == null ? "—" : money(row.differenceAmount)}</td>
                  <td className={`${td} text-neutral-500`}>{String(row.status || "OPEN").toUpperCase() === "LOCKED" ? "Đã chốt" : "Đang mở"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[10px] text-neutral-400">Vuốt ngang để xem đủ cột · Số dư theo sổ, không phải xác nhận số dư ngân hàng</div>
    </div>
  );
}

const FINANCE_TABLE_ORDER_KEY = "the1970.mobile.finance.daily.sectionOrder.v1";
const FINANCE_TABLE_IDS = ["overview", "indicators", "sources", "ratio", "branches", "daily", "transactions"] as const;
type FinanceTableId = typeof FINANCE_TABLE_IDS[number];
const FINANCE_TABLE_TITLES: Record<FinanceTableId, string> = {
  overview: "Tổng dòng tiền", indicators: "Các chỉ số", sources: "Nguồn tiền",
  ratio: "Tỷ lệ theo nguồn tiền", branches: "Chi tiết theo chi nhánh",
  daily: "Bảng chốt tiền từng ngày", transactions: "Chi tiết giao dịch",
};

export default function MobileFinanceDailyPage() {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("today");
  const [reorderEnabled, setReorderEnabled] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<FinanceTableId[]>(() => [...FINANCE_TABLE_IDS]);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(FINANCE_TABLE_ORDER_KEY) || "null");
      if (!Array.isArray(stored)) return;
      const valid = stored.filter((id: unknown): id is FinanceTableId =>
        typeof id === "string" && (FINANCE_TABLE_IDS as readonly string[]).includes(id));
      const unique = Array.from(new Set(valid));
      setSectionOrder([...unique, ...FINANCE_TABLE_IDS.filter(id => !unique.includes(id))]);
    } catch { /* Bad/old configuration: keep defaults. */ }
  }, []);
  const moveSection = useCallback((id: FinanceTableId, direction: -1 | 1) => {
    setSectionOrder(current => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      try { window.localStorage.setItem(FINANCE_TABLE_ORDER_KEY, JSON.stringify(updated)); } catch { /* optional persistence */ }
      return updated;
    });
  }, []);
  const resetSectionOrder = useCallback(() => {
    setSectionOrder([...FINANCE_TABLE_IDS]);
    try { window.localStorage.removeItem(FINANCE_TABLE_ORDER_KEY); } catch { /* storage disabled */ }
  }, []);
  const SectionControls = ({ section }: { section: FinanceTableId }) =>
    !reorderEnabled ? null : (
      <div className="mb-1 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700">
        <span className="flex min-w-0 items-center gap-1.5 truncate"><GripVertical className="h-4 w-4 shrink-0 text-neutral-400" />{FINANCE_TABLE_TITLES[section]}</span>
        <span className="flex shrink-0 gap-1">
          <button type="button" aria-label={`Đưa ${FINANCE_TABLE_TITLES[section]} lên`} disabled={sectionOrder.indexOf(section) === 0} onClick={() => moveSection(section, -1)} className="rounded-lg border border-neutral-200 p-2 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" aria-label={`Đưa ${FINANCE_TABLE_TITLES[section]} xuống`} disabled={sectionOrder.indexOf(section) === sectionOrder.length - 1} onClick={() => moveSection(section, 1)} className="rounded-lg border border-neutral-200 p-2 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
        </span>
      </div>
    );

  const [customFrom, setCustomFrom] = useState(() => dateInput(new Date()));
  const [customTo, setCustomTo] = useState(() => dateInput(new Date()));
  const [ratioExpanded, setRatioExpanded] = useState(false);
  const [wideSourceTable, setWideSourceTable] = useState(false);
  const [wideBranchTable, setWideBranchTable] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [configuredSources, setConfiguredSources] = useState<AnyRow[]>([]);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedDate, setExpandedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const { from, to } = rangeDates(range, customFrom, customTo);
      if (from > to) throw new Error("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      const params = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        branchId: "ALL",
        paymentSourceId: "ALL",
        status: "ALL",
        q: "",
      });

      const [dailyRes, ledgerRes, sourcesRes] = await Promise.all([
        optionalJson<FinanceDailyResponse>(`/finance/daily?${params.toString()}`, {}),
        optionalJson<{ rows?: AnyRow[]; summary?: AnyRow }>(`/finance/daily-ledger?${params.toString()}`, {}),
        optionalJson<AnyRow[]>("/payment-sources", []),
      ]);

      const ledgerRows = Array.isArray(ledgerRes?.rows)
        ? ledgerRes.rows
        : Array.isArray(dailyRes?.ledgerRows)
          ? dailyRes.ledgerRows
          : Array.isArray(dailyRes?.dailyRows)
            ? dailyRes.dailyRows
            : Array.isArray(dailyRes?.ledger?.rows)
              ? dailyRes.ledger.rows
              : [];

      setConfiguredSources(Array.isArray(sourcesRes) ? sourcesRes : []);
      setSummary({
        ...(dailyRes?.summary || {}),
        ...(ledgerRes?.summary
          ? {
              ledgerOpeningBalance: ledgerRes.summary.openingBalance,
              ledgerClosingBalance: ledgerRes.summary.closingBalance,
              ledgerTotalReceipt: ledgerRes.summary.totalReceipt,
              ledgerTotalPayment: ledgerRes.summary.totalPayment,
              ledgerNetAmount: ledgerRes.summary.netAmount,
            }
          : {}),
        bySource: Array.isArray(dailyRes?.bySource) ? dailyRes.bySource : [],
        ledgerRows,
        dailyRows: ledgerRows,
      });

      setRows(Array.isArray(dailyRes?.payments) ? dailyRes.payments : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(() => buildSources(summary, rows, configuredSources), [summary, rows, configuredSources]);
  const dailyRows = useMemo(() => buildDailyRows(summary, rows), [summary, rows]);
  const branches = useMemo(() => buildBranches(summary, dailyRows.length ? dailyRows.flatMap((row) => row.branches || [row]) : rows), [summary, dailyRows, rows]);

  const computed = useMemo(() => {
    const totalIn = firstNumber(
      summary?.totalIn,
      summary?.totalCollected,
      summary?.totalReceipt,
      summary?.ledgerTotalReceipt,
      sources.reduce<number>((sum, row) => sum + num(row.totalIn), 0),
    );
    const totalOut = firstNumber(
      summary?.totalOut,
      summary?.totalPayment,
      summary?.totalSpent,
      summary?.ledgerTotalPayment,
      sources.reduce<number>((sum, row) => sum + num(row.totalOut), 0),
    );
    const netAmount = firstNumber(summary?.netAmount, summary?.netCashFlow, summary?.ledgerNetAmount, totalIn - totalOut);
    const posAmount = firstNumber(
      summary?.posAmount,
      dailyRows.reduce<number>((sum, row) => sum + num(row.posAmount || row.posReceiptAmount), 0),
      rows.filter(isReceipt).reduce<number>((sum, row) => sum + Math.abs(num(row.amount)), 0),
    );
    const bankAmount = firstNumber(
      summary?.bankAmount,
      sources
        .filter((row) => ["BANK", "CARD"].includes(String(row.sourceType || sourceKind(row)).toUpperCase()))
        .reduce<number>((sum, row) => sum + num(row.netAmount), 0),
    );
    const cashRemain = firstNumber(
      summary?.cashRemain,
      summary?.cashOnHand,
      summary?.cashClosingBalance,
      summary?.cashAmount,
      branches.reduce<number>((sum, row) => sum + firstNumber(row.cashRemain, row.cashOnHand, row.closingBalance, row.netAmount), 0),
    );

    return {
      totalIn,
      totalOut,
      netAmount,
      posAmount,
      bankAmount,
      cashRemain,
      transactionCount: firstNumber(summary?.transactionCount, summary?.totalPayments, rows.length),
      endBalance: firstNumber(summary?.endingBalance, summary?.endBalance, summary?.ledgerClosingBalance, netAmount),
      totalDifference: firstNumber(
        summary?.totalDifference,
        dailyRows.reduce<number>((sum, row) => sum + num(row.difference || row.differenceAmount), 0),
      ),
    };
  }, [summary, sources, rows, branches, dailyRows]);

  const filteredRows = useMemo(() => {
    const q = normalize(query);
    return rows.filter((row) => {
      const source = sourceName(row);
      if (sourceFilter !== "all" && source !== sourceFilter) return false;
      if (!q) return true;

      return normalize([
        row.orderCode,
        row.voucherCode,
        row.customerName,
        row.customerPhone,
        row.title,
        row.note,
        row.sourceName,
        row.branchName,
      ].filter(Boolean).join(" ")).includes(q);
    });
  }, [rows, query, sourceFilter]);

  const latestBranchLedgerRows = useMemo(() => {
    const all = Array.isArray(summary?.ledgerRows) ? summary.ledgerRows : [];
    const lastDate = rangeDates(range, customFrom, customTo).to;
    return all.filter(row => String(row.date || "").slice(0, 10) === lastDate);
  }, [summary, range, customFrom, customTo]);

  const sourceNetTotal = Math.max(sources.reduce((sum, row) => sum + Math.abs(num(row.netAmount)), 0), 1);

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-neutral-100 text-neutral-950 [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-md px-4 pb-[calc(120px+env(safe-area-inset-bottom))] pt-5">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/mobile" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">Đối soát</div>
            <div className="text-lg font-black">Tổng quan nguồn tiền</div>
          </div>

          <button type="button" onClick={() => void load(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {RANGE_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                range === item.key ? "bg-neutral-950 text-white" : "bg-white text-neutral-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 shadow-sm">
            <label className="min-w-0 text-[11px] font-bold text-neutral-600">Từ ngày
              <input type="date" value={customFrom} max={customTo} onChange={event => setCustomFrom(event.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 px-2 py-2 text-xs text-neutral-900" />
            </label>
            <label className="min-w-0 text-[11px] font-bold text-neutral-600">Đến ngày
              <input type="date" value={customTo} min={customFrom} onChange={event => setCustomTo(event.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 px-2 py-2 text-xs text-neutral-900" />
            </label>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-end gap-2">
          {reorderEnabled ? <button type="button" onClick={resetSectionOrder} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-neutral-600">Đặt lại thứ tự</button> : null}
          <button type="button" onClick={() => setReorderEnabled(value => !value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${reorderEnabled ? "bg-neutral-950 text-white" : "bg-white text-neutral-800"}`}>
            {reorderEnabled ? "Xong sắp xếp" : "Sắp xếp bảng ↑↓"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[1.75rem] bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div style={{ order: sectionOrder.indexOf("overview") }}>
              <SectionControls section="overview" />
              <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl shadow-neutral-300">
              <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">Dòng tiền ròng</div>
                    <div className="mt-3 break-all text-[clamp(1.8rem,7vw,2.6rem)] font-black tracking-tight tabular-nums">{money(computed.netAmount)}</div>
                    <div className="mt-2 text-sm text-white/55">Tiền vào - tiền ra trong khoảng lọc</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950">
                    <WalletCards className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-white/45">Tiền vào</div>
                    <div className="mt-1 text-[clamp(0.72rem,3.2vw,1rem)] font-black tracking-tight tabular-nums">{money(computed.totalIn)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-white/45">Tiền ra</div>
                    <div className="mt-1 text-[clamp(0.72rem,3.2vw,1rem)] font-black tracking-tight tabular-nums">{money(computed.totalOut)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-white/45">Giao dịch</div>
                    <div className="mt-1 text-lg font-black">{computed.transactionCount}</div>
                  </div>
                </div>
              </div>
            </div>

            </div>
            <div style={{ order: sectionOrder.indexOf("indicators") }}>
              <SectionControls section="indicators" />
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="POS hoàn thành" value={money(computed.posAmount)} sub="Đơn POS/payment" />
              <StatCard title="CK / Cọc" value={money(computed.bankAmount)} sub="Nguồn ngân hàng / card" />
              <StatCard title="Tiền mặt theo sổ" value={money(computed.cashRemain)} sub="Theo sổ quỹ, không phải số dư ngân hàng" dark />
              <StatCard title="Tổng lệch" value={money(computed.totalDifference)} sub="Thực đếm - số dư" danger={computed.totalDifference !== 0} />
            </div>

            </div>
            <div style={{ order: sectionOrder.indexOf("sources") }}>
              <SectionControls section="sources" />
            <Section title="Nguồn tiền" sub="Xếp theo chi nhánh TH → QO → CL → XD; mỗi nguồn một hàng." count={`${sources.length} nguồn · ${sources.filter((row) => num(row.transactionCount) > 0).length} phát sinh`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-500">Bảng có thể vuốt ngang</span>
                <button type="button" onClick={() => setWideSourceTable(true)} className="flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-2 text-[11px] font-bold text-white">
                  <Maximize2 className="h-3.5 w-3.5" /> Xem bảng rộng
                </button>
              </div>
              {sources.length === 0 ? (
                <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500">Chưa có dữ liệu nguồn tiền.</div>
              ) : (
                <div className="-mx-2 overflow-x-auto rounded-xl border border-neutral-200 [-webkit-overflow-scrolling:touch]" role="region" aria-label="Nguồn tiền xếp theo chi nhánh">
                  {renderMoneySourcesTable(sources)}
                </div>
              )}
            </Section>

            </div>
            <div style={{ order: sectionOrder.indexOf("ratio") }}>
              <SectionControls section="ratio" />
            <section className="rounded-[1.8rem] bg-white p-4 shadow-sm">
              <button type="button" onClick={() => setRatioExpanded(value => !value)} aria-expanded={ratioExpanded} className="flex w-full items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-neutral-950">Tỷ lệ theo nguồn tiền</h2>
                  <p className="mt-1 text-[11px] text-neutral-500">Tỷ trọng phát sinh ròng trong kỳ</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-neutral-600">{ratioExpanded ? "Thu gọn" : "Mở rộng"}<ChevronDown className={`h-4 w-4 transition-transform ${ratioExpanded ? "rotate-180" : ""}`} /></span>
              </button>
              {ratioExpanded ? (
                <div className="mt-4 space-y-3">
                  {sources.filter(source => Math.abs(num(source.netAmount)) > 0).map((source, index) => {
                    const netAmount = Math.abs(num(source.netAmount));
                    const percent = Math.round((netAmount / sourceNetTotal) * 100);
                    return (
                      <div key={`${sourceName(source)}-ratio-${index}`}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-bold">{sourceName(source)}</span>
                          <span className="text-neutral-500">{percent}%</span>
                        </div>
                        <RatioBar value={netAmount} max={sourceNetTotal} />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>

            </div>
            <div style={{ order: sectionOrder.indexOf("branches") }}>
              <SectionControls section="branches" />
            <Section title="Chi tiết theo chi nhánh" sub="Mỗi chi nhánh một bảng như web, số liệu sổ của ngày cuối khoảng lọc." count="4 chi nhánh">
              <div className="space-y-4">
                {BRANCH_LABELS.map(name => (
                  <BranchLedgerTable key={name} name={name} ledgerRows={latestBranchLedgerRows.filter(row => ledgerBranchName(row) === name)} onExpand={() => setWideBranchTable(name)} />
                ))}
                {latestBranchLedgerRows.some(row => !BRANCH_LABELS.includes(ledgerBranchName(row) as typeof BRANCH_LABELS[number])) ? (
                  <BranchLedgerTable name="CHƯA XÁC ĐỊNH CHI NHÁNH" ledgerRows={latestBranchLedgerRows.filter(row => !BRANCH_LABELS.includes(ledgerBranchName(row) as typeof BRANCH_LABELS[number]))} onExpand={() => setWideBranchTable("CHƯA XÁC ĐỊNH CHI NHÁNH")} />
                ) : null}
              </div>
            </Section>

            </div>
            <div style={{ order: sectionOrder.indexOf("daily") }}>
              <SectionControls section="daily" />
            <Section title="Bảng chốt tiền từng ngày" sub="Mỗi hàng là một ngày, giống bảng chốt tiền trên web." count={`${dailyRows.length} ngày`}>
              <div className="space-y-3">
                {dailyRows.length === 0 ? (
                  <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có bảng chốt tiền.</div>
                ) : (
                  dailyRows.slice(0, 10).map((row, index) => {
                    const date = row.date || row.day || `Ngày ${index + 1}`;
                    const isOpen = expandedDate === String(date);
                    const branchCards = row.branches || row.branchRows || branches;

                    return (
                      <div key={`${date}-${index}`} className="overflow-hidden rounded-[1.5rem] bg-neutral-50">
                        <button
                          type="button"
                          onClick={() => setExpandedDate(isOpen ? "" : String(date))}
                          className="w-full p-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black">{date}</div>
                              <div className="mt-1 text-xs text-neutral-500">
                                POS {money(firstNumber(row.posAmount, row.posReceiptAmount))} · Phiếu thu {money(firstNumber(row.receiptAmount, row.totalReceipt, row.totalIn))} · Phiếu chi {money(firstNumber(row.paymentAmount, row.totalPayment, row.totalOut))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black">{money(row.netAmount)}</div>
                              <div className="mt-1 text-xs text-neutral-500">TM {money(firstNumber(row.cashRemain, row.cashOnHand, row.closingBalance))}</div>
                            </div>
                          </div>
                        </button>

                        {isOpen ? (
                          <div className="border-t border-neutral-200 p-4 pt-3">
                            <div className="grid grid-cols-2 gap-2">
                              {branchCards.slice(0, 8).map((branch: AnyRow, branchIndex: number) => (
                                <div key={`${branchName(branch)}-${branchIndex}`} className="rounded-2xl bg-neutral-950 p-3 text-white">
                                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{branchName(branch)}</div>
                                  <div className="mt-2 text-base font-black">{money(firstNumber(branch.cashRemain, branch.cashOnHand, branch.netAmount))}</div>
                                  <div className="mt-1 text-xs text-white/55">TM {money(firstNumber(branch.cashAmount, branch.cashRemain))}</div>
                                  <div className="mt-2 text-[11px] text-emerald-300">Admin đã nhận {money(branch.adminReceived || 0)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </Section>

            </div>
            <div style={{ order: sectionOrder.indexOf("transactions") }}>
              <SectionControls section="transactions" />
            <Section title="Chi tiết giao dịch" sub="Gồm POS hoàn thành, phiếu thu/chi, chuyển khoản/cọc đã ghi nhận." count={`${filteredRows.length} dòng`}>
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2">
                  <Search className="h-4 w-4 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm mã đơn, phiếu, khách, nguồn tiền..."
                    className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2">
                  <Filter className="h-4 w-4 text-neutral-400" />
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none">
                    <option value="all">Tất cả nguồn tiền</option>
                    {sources.map((source, index) => (
                      <option key={`${sourceName(source)}-${index}`} value={sourceName(source)}>
                        {sourceName(source)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredRows.length === 0 ? (
                  <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có giao dịch phù hợp.</div>
                ) : (
                  filteredRows.slice(0, 20).map((row, index) => {
                    const receipt = isReceipt(row);
                    const amount = Math.abs(num(row.amount));

                    return (
                      <div key={row.id || index} className="rounded-2xl bg-neutral-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                            receipt ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            {receipt ? "+" : "-"}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black">{row.orderCode || row.voucherCode || row.code || sourceName(row)}</div>
                                <div className="mt-1 truncate text-xs text-neutral-500">{row.customerName || row.objectName || row.title || row.note || "Giao dịch"}</div>
                              </div>
                              <div className={`shrink-0 text-right text-sm font-black ${receipt ? "text-emerald-700" : "text-rose-700"}`}>
                                {receipt ? "+" : "-"}{money(amount)}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
                              <div>{rowDate(row)}</div>
                              <div className="text-right">{branchName(row)}</div>
                              <div className="truncate font-bold text-neutral-700">{sourceName(row)}</div>
                              <div className="text-right">{row.status || "Đã ghi nhận"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Section>

            </div>
            <div style={{ order: 99 }}>
            <Link href="/mobile/reports/overview" className="flex items-center justify-between rounded-[1.75rem] bg-white p-5 font-bold shadow-sm">
              <span>Mở War Room báo cáo</span>
              <ChevronRight className="h-5 w-5" />
            </Link>
            </div>
          </div>
        )}

        {wideSourceTable ? (
          <div className="fixed inset-0 z-[1000] bg-white text-neutral-950" role="dialog" aria-modal="true" aria-label="Bảng nguồn tiền mở rộng">
            <div className="flex h-full flex-col landscape:h-[100dvh] portrait:absolute portrait:left-[100dvw] portrait:top-0 portrait:h-[100dvw] portrait:w-[100dvh] portrait:origin-top-left portrait:rotate-90 landscape:w-full">
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-2">
                <div className="text-sm font-black">Nguồn tiền theo chi nhánh</div>
                <button type="button" onClick={() => setWideSourceTable(false)} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white"><Minimize2 className="h-4 w-4" /> Đóng</button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                {renderMoneySourcesTable(sources, true)}
              </div>
            </div>
          </div>
        ) : null}

        {wideBranchTable ? (
          <div className="fixed inset-0 z-[1010] bg-white text-neutral-950" role="dialog" aria-modal="true" aria-label={`Bảng chi tiết ${wideBranchTable} mở rộng`}>
            <div className="flex h-full flex-col landscape:h-[100dvh] portrait:absolute portrait:left-[100dvw] portrait:top-0 portrait:h-[100dvw] portrait:w-[100dvh] portrait:origin-top-left portrait:rotate-90 landscape:w-full">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2">
                <div className="min-w-0 truncate text-sm font-black">Chi tiết theo chi nhánh · {wideBranchTable}</div>
                <button type="button" onClick={() => setWideBranchTable(null)} className="flex shrink-0 items-center gap-2 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white"><Minimize2 className="h-4 w-4" /> Đóng</button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-2 [-webkit-overflow-scrolling:touch]">
                <BranchLedgerTable
                  name={wideBranchTable}
                  expanded
                  ledgerRows={latestBranchLedgerRows.filter(row => wideBranchTable === "CHƯA XÁC ĐỊNH CHI NHÁNH"
                    ? !BRANCH_LABELS.includes(ledgerBranchName(row) as typeof BRANCH_LABELS[number])
                    : ledgerBranchName(row) === wideBranchTable)}
                />
              </div>
            </div>
          </div>
        ) : null}

        <MobileBottomNav />
      </div>
    </div>
  );
}
