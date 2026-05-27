"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";

type QuickRange =
  | "today"
  | "yesterday"
  | "7d"
  | "10d"
  | "30d"
  | "month"
  | "custom";
type FlowFilter =
  | "ALL"
  | "RECEIPT"
  | "PAYMENT"
  | "POS"
  | "TRANSFER"
  | "CASH"
  | "BANK"
  | "OTHER";

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
  paymentSourceId?: string;
  sourceName?: string;
  sourceCode?: string;
  sourceType?: string;
  title?: string;
  category?: string;
  note?: string;
  recordType?: string;
  createdById?: string;
  createdByName?: string;
  staffId?: string;
  staffName?: string;
  createdAt?: string;
  paidAt?: string;
};

type DailyLedgerRow = {
  date: string;
  branchId?: string;
  branchName?: string;
  paymentSourceId?: string;
  paymentSourceName?: string;
  paymentSourceCode?: string;
  sourceType?: string;
  openingBalance?: number;
  posReceiptAmount?: number;
  manualReceiptAmount?: number;
  manualPaymentAmount?: number;
  totalReceipt?: number;
  totalPayment?: number;
  netAmount?: number;
  closingBalance?: number;
  countedAmount?: number | null;
  differenceAmount?: number | null;
  status?: "OPEN" | "LOCKED" | string;
  note?: string | null;
  lockedAt?: string | null;
  lockedByName?: string | null;
  isSyntheticLive?: boolean;
};

type LedgerCloseDialog = {
  row: DailyLedgerRow;
  countedAmount: string;
  note: string;
} | null;

type CashHandoverDialog = {
  row: DailyLedgerRow;
  amount: string;
  note: string;
} | null;

type ConfirmDialog = {
  title: string;
  message: string;
  confirmText: string;
  tone?: "black" | "amber" | "red";
  onConfirm: () => Promise<void> | void;
} | null;

type FinanceAuditIssue = {
  level?: "ERROR" | "WARNING" | string;
  date?: string;
  branchName?: string;
  paymentSourceName?: string;
  field?: string;
  expected?: number;
  actual?: number;
  diff?: number;
  message?: string;
};

type FinanceAuditResult = {
  ok: boolean;
  checkedAt?: string;
  range?: { fromDate?: string; toDate?: string };
  summary?: { checkedDays?: number; checkedRows?: number; issueCount?: number };
  issues?: FinanceAuditIssue[];
};

type ToastTone = "success" | "error" | "warning";

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

  if (type === "10d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 9);
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




type MultiSelectOption = {
  value: string;
  label: string;
};

function toggleMultiValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function MultiSelectFilter({
  values,
  options,
  allLabel,
  selectedLabel,
  onChange,
  className = "",
}: {
  values: string[];
  options: MultiSelectOption[];
  allLabel: string;
  selectedLabel?: string;
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const safeValues = values.filter((value) =>
    options.some((option) => option.value === value),
  );
  const label = safeValues.length
    ? selectedLabel || `${safeValues.length} nguồn đã chọn`
    : allLabel;

  return (
    <details className={`group relative ${className}`}>
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
        <span className="truncate">{label}</span>
        <span className="ml-2 text-neutral-400">▾</span>
      </summary>
      <div className="absolute left-0 top-12 z-50 max-h-80 w-full min-w-[280px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-neutral-50">
          <input
            type="checkbox"
            checked={safeValues.length === 0}
            onChange={() => onChange([])}
          />
          <span>{allLabel}</span>
        </label>
        <div className="my-1 border-t border-neutral-100" />
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={safeValues.includes(option.value)}
              onChange={() => onChange(toggleMultiValue(safeValues, option.value))}
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function canonicalBranchName(value: unknown) {
  const raw = String(value || "").trim();
  const key = normalizeText(raw).replace(/\s+/g, " ");

  if (key === "th" || key.includes("thai ha")) return "THÁI HÀ";
  if (key === "qo" || key.includes("quoc oai")) return "QUỐC OAI";
  if (key === "cl" || key.includes("chua lang")) return "CHÙA LÁNG";
  if (key === "xd" || key.includes("xa dan")) return "XÃ ĐÀN";

  return raw || "—";
}


const DEFAULT_BRANCH_NAMES = ["THÁI HÀ", "QUỐC OAI", "CHÙA LÁNG", "XÃ ĐÀN"];

function branchCodeFromName(value: unknown) {
  const name = canonicalBranchName(value);
  if (name === "THÁI HÀ") return "TH";
  if (name === "QUỐC OAI") return "QO";
  if (name === "CHÙA LÁNG") return "CL";
  if (name === "XÃ ĐÀN") return "XD";
  return "";
}

function sourceAliasHit(text: string, alias: string) {
  const safe = alias.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s\\-_/])${safe}($|[\\s\\-_/])`, "i").test(text);
}

function explicitSourceBranchCode(source: any) {
  const text = normalizeText(
    [
      source?.branchName,
      source?.branch?.name,
      source?.branchCode,
      source?.branch?.code,
      source?.name,
      source?.code,
      source?.paymentSourceName,
      source?.paymentSourceCode,
    ]
      .filter(Boolean)
      .join(" "),
  ).replace(/[_]+/g, " ").replace(/\s+/g, " ");

  if (sourceAliasHit(text, "th") || text.includes("thai ha")) return "TH";
  if (sourceAliasHit(text, "qo") || text.includes("quoc oai")) return "QO";
  if (sourceAliasHit(text, "cl") || text.includes("chua lang")) return "CL";
  if (sourceAliasHit(text, "xd") || text.includes("xa dan")) return "XD";

  return "";
}

function sourceBelongsToBranch(source: any, branchName: string) {
  const canonical = canonicalBranchName(branchName);
  const expectedCode = branchCodeFromName(canonical);

  const sourceBranchId = String(source?.branchId || source?.branch?.id || "").trim();
  if (sourceBranchId) {
    const sourceBranchName = canonicalBranchName(
      source?.branchName || source?.branch?.name || source?.branchCode || source?.branch?.code || sourceBranchId,
    );
    const sourceCode = explicitSourceBranchCode(source);
    return sourceBranchName === canonical || (!!expectedCode && sourceCode === expectedCode);
  }

  const explicitCode = explicitSourceBranchCode(source);
  if (explicitCode) return explicitCode === expectedCode;

  const text = normalizeText(
    [
      source?.branchName,
      source?.branch?.name,
      source?.branchCode,
      source?.branch?.code,
      source?.name,
      source?.code,
      source?.paymentSourceName,
      source?.paymentSourceCode,
    ]
      .filter(Boolean)
      .join(" "),
  ).replace(/[_]+/g, " ").replace(/\s+/g, " ");

  if (!text) return false;
  if (normalizeText(canonical) && text.includes(normalizeText(canonical))) return true;

  // Alias phải match đúng token. Không dùng includes(" th") vì "QUẸT THẺ CL"
  // normalize thành "quet the cl" sẽ chứa " th" trong chữ "the", làm lẫn CL/XD vào THÁI HÀ.
  if (expectedCode) return sourceAliasHit(text, normalizeText(expectedCode));

  return false;
}

function canonicalSourceKey(row: any, branchName: string) {
  const branch = canonicalBranchName(branchName);
  if (isCashLedgerRow({
    date: row?.date || "",
    sourceType: row?.sourceType,
    paymentSourceName: row?.paymentSourceName || row?.name,
    paymentSourceCode: row?.paymentSourceCode || row?.code,
    paymentSourceId: row?.paymentSourceId || row?.id,
  } as DailyLedgerRow)) {
    return `CASH:${branch}`;
  }

  const label = row?.paymentSourceName || row?.name || row?.paymentSourceCode || row?.code || row?.paymentSourceId || row?.id || "—";
  return normalizeText(label);
}

function mergeLedgerAmount(target: DailyLedgerRow, source: DailyLedgerRow) {
  target.openingBalance = Number(target.openingBalance || 0) + Number(source.openingBalance || 0);
  target.posReceiptAmount = Number(target.posReceiptAmount || 0) + Number(source.posReceiptAmount || 0);
  target.manualReceiptAmount = Number(target.manualReceiptAmount || 0) + Number(source.manualReceiptAmount || 0);
  target.manualPaymentAmount = Number(target.manualPaymentAmount || 0) + Number(source.manualPaymentAmount || 0);
  target.totalReceipt = Number(target.totalReceipt || 0) + Number(source.totalReceipt || 0);
  target.totalPayment = Number(target.totalPayment || 0) + Number(source.totalPayment || 0);
  target.netAmount = Number(target.totalReceipt || 0) - Number(target.totalPayment || 0);
  target.closingBalance = Number(target.openingBalance || 0) + Number(target.netAmount || 0);

  if (source.countedAmount !== null && source.countedAmount !== undefined) {
    target.countedAmount = Number(target.countedAmount || 0) + Number(source.countedAmount || 0);
  }

  if (source.differenceAmount !== null && source.differenceAmount !== undefined) {
    target.differenceAmount = Number(target.differenceAmount || 0) + Number(source.differenceAmount || 0);
  }

  if (String(source.status || "").toUpperCase() === "LOCKED") {
    target.status = "LOCKED";
  }

  if (!target.branchId && source.branchId) target.branchId = source.branchId;
  if (!target.paymentSourceId && source.paymentSourceId) target.paymentSourceId = source.paymentSourceId;
  if (!target.paymentSourceCode && source.paymentSourceCode) target.paymentSourceCode = source.paymentSourceCode;
  if (source.isSyntheticLive) target.isSyntheticLive = target.isSyntheticLive || false;
}

function branchSortWeight(name: unknown) {
  const key = canonicalBranchName(name);
  const order: Record<string, number> = {
    "THÁI HÀ": 1,
    "QUỐC OAI": 2,
    "CHÙA LÁNG": 3,
    "XÃ ĐÀN": 4,
  };
  return order[key] || 99;
}

function uniqBranchNames(values: unknown[]) {
  const seen = new Set<string>();
  const rows: string[] = [];

  values.forEach((value) => {
    const name = canonicalBranchName(value);
    if (!name || name === "—" || seen.has(name)) return;
    seen.add(name);
    rows.push(name);
  });

  return rows.sort((a, b) => {
    const weightDiff = branchSortWeight(a) - branchSortWeight(b);
    if (weightDiff !== 0) return weightDiff;
    return a.localeCompare(b, "vi");
  });
}

function sourceKind(row: any) {
  const sourceText = normalizeText(
    [row?.sourceType, row?.sourceName, row?.sourceCode, row?.method]
      .filter(Boolean)
      .join(" "),
  );

  if (sourceText.includes("cod")) return "COD";
  if (
    sourceText.includes("bank") ||
    sourceText.includes("chuyen khoan") ||
    sourceText.includes("bao kim") ||
    sourceText.includes("vcb") ||
    sourceText.includes("agribank")
  ) {
    return "BANK";
  }
  if (
    sourceText.includes("cash") ||
    sourceText.includes("tien mat") ||
    sourceText.includes("tm")
  ) {
    return "CASH";
  }
  return row?.sourceType || "OTHER";
}

function sourceKindLabel(value: unknown) {
  const text = String(value || "").toUpperCase();
  if (text === "CASH") return "Tiền mặt";
  if (text === "BANK") return "Ngân hàng / chuyển khoản";
  if (text === "COD") return "COD";
  if (text === "OTHER") return "Khác";
  if (!text || text === "—") return "—";
  return String(value || "Khác");
}

function ledgerSourceKind(row: DailyLedgerRow) {
  return sourceKind({
    sourceType: row.sourceType,
    sourceName: row.paymentSourceName,
    sourceCode: row.paymentSourceCode,
    method: row.paymentSourceId,
  });
}

function isCashLedgerRow(row: DailyLedgerRow) {
  const text = normalizeText(
    [
      row.sourceType,
      row.paymentSourceName,
      row.paymentSourceCode,
      row.paymentSourceId,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return (
    ledgerSourceKind(row) === "CASH" ||
    text.includes("tien mat") ||
    text.includes("cash") ||
    text.includes("quy tien mat")
  );
}

function isReceiptRow(row: MoneyRow) {
  const type = String(row.flowType || row.type || "").toUpperCase();
  if (type === "PAYMENT") return false;
  if (type === "RECEIPT") return true;
  return Number(row.amount || 0) >= 0;
}

function isPosRow(row: MoneyRow) {
  const text = normalizeText(
    [
      row.voucherCode,
      row.orderCode,
      row.title,
      row.category,
      row.note,
      row.recordType,
    ]
      .filter(Boolean)
      .join(" "),
  );
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

function creatorName(row: MoneyRow) {
  return (
    row.createdByName || row.staffName || row.createdById || row.staffId || "—"
  );
}

function rowStatusClass(row: MoneyRow) {
  const status = String(row.status || "").toUpperCase();
  if (status === "CONFIRMED" || status === "PAID")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PARTIAL") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PENDING_COD" || status === "DRAFT")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CANCELLED" || status === "REFUNDED" || status === "FAILED")
    return "border-red-200 bg-red-50 text-red-700";
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
  if (flow === "OTHER")
    return !["BANK", "CASH", "COD"].includes(sourceKind(row));
  return true;
}

function dateOnlyText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ledgerStatusLabel(status?: string) {
  if (String(status || "").toUpperCase() === "LOCKED") return "Đã chốt sổ";
  return "Đang mở";
}

function ledgerStatusClass(status?: string) {
  if (String(status || "").toUpperCase() === "LOCKED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function differenceClass(value?: number | null) {
  const amount = Number(value || 0);
  if (amount > 0) return "text-emerald-700";
  if (amount < 0) return "text-red-700";
  return "text-neutral-700";
}

function parseMoneyInput(value: string) {
  return Number(String(value || "").replace(/[^\d-]/g, "")) || 0;
}

function safeLedgerRows(value: unknown): DailyLedgerRow[] {
  if (Array.isArray(value)) return value as DailyLedgerRow[];
  if (Array.isArray((value as any)?.rows))
    return (value as any).rows as DailyLedgerRow[];
  return [];
}

function safeRows(value: unknown): MoneyRow[] {
  return Array.isArray(value) ? (value as MoneyRow[]) : [];
}

function rowDateKey(row: MoneyRow) {
  const raw = row.paidAt || row.createdAt || "";
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw).slice(0, 10);
  return toDateInput(date);
}

function ledgerMatchKey(parts: {
  date?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  paymentSourceId?: string | null;
  paymentSourceName?: string | null;
  paymentSourceCode?: string | null;
  sourceName?: string | null;
  sourceCode?: string | null;
  method?: string | null;
}) {
  const source =
    parts.paymentSourceId ||
    parts.paymentSourceName ||
    parts.paymentSourceCode ||
    parts.sourceName ||
    parts.sourceCode ||
    parts.method ||
    "NO_SOURCE";

  return [
    String(parts.date || "").slice(0, 10),
    normalizeText(parts.branchId || parts.branchName || "NO_BRANCH"),
    normalizeText(source),
  ].join("|");
}

function ledgerRowKey(row: DailyLedgerRow) {
  return ledgerMatchKey({
    date: row.date,
    branchId: row.branchId,
    branchName: row.branchName,
    paymentSourceId: row.paymentSourceId,
    paymentSourceName: row.paymentSourceName,
    paymentSourceCode: row.paymentSourceCode,
  });
}


function ledgerBusinessKey(row: any, dateOverride?: string) {
  const date = String(dateOverride || row?.date || rowDateKey(row) || "").slice(0, 10);
  const branch = canonicalBranchName(
    row?.branchName || row?.branch?.name || row?.branchCode || row?.branch?.code || row?.branchId,
  );
  const sourceKey = canonicalSourceKey(
    {
      sourceType: row?.sourceType || sourceKind(row),
      paymentSourceName: row?.paymentSourceName || row?.sourceName || row?.name || row?.method,
      paymentSourceCode: row?.paymentSourceCode || row?.sourceCode || row?.code,
      paymentSourceId: row?.paymentSourceId || row?.id,
    },
    branch,
  );

  return [date || "NO_DATE", branch || "NO_BRANCH", sourceKey || "NO_SOURCE"].join("|");
}

export default function FinanceDailyPageClient() {
  const initialRange = useMemo(() => getRange("today"), []);
  const initialLedgerRange = useMemo(() => getRange("today"), []);
  const [quickRange, setQuickRange] = useState<QuickRange>("today");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [ledgerQuickRange, setLedgerQuickRange] = useState<QuickRange>("today");
  const [ledgerDateFrom, setLedgerDateFrom] = useState(initialLedgerRange.from);
  const [ledgerDateTo, setLedgerDateTo] = useState(initialLedgerRange.to);

  const [branchId, setBranchId] = useState("ALL");
  const [paymentSourceIds, setPaymentSourceIds] = useState<string[]>([]);
  const [flow, setFlow] = useState<FlowFilter>("ALL");
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const [transactionBranchFilter, setTransactionBranchFilter] = useState("ALL");
  const [transactionSourceFilters, setTransactionSourceFilters] = useState<string[]>([]);
  const [transactionStatusFilter, setTransactionStatusFilter] = useState("ALL");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("ALL");
  const [transactionAmountFrom, setTransactionAmountFrom] = useState("");
  const [transactionAmountTo, setTransactionAmountTo] = useState("");

  const [branches, setBranches] = useState<any[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [, setLedgerLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [savingLedger, setSavingLedger] = useState(false);
  const [error, setError] = useState("");
  const [ledgerMessage, setLedgerMessage] = useState("");
  const [ledgerMessageTitle, setLedgerMessageTitle] = useState("Đã cập nhật");
  const [ledgerMessageTone, setLedgerMessageTone] = useState<ToastTone>("success");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<FinanceAuditResult | null>(null);
  const [closeDialog, setCloseDialog] = useState<LedgerCloseDialog>(null);
  const [cashHandoverDialog, setCashHandoverDialog] =
    useState<CashHandoverDialog>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [closedLedgerKeys, setClosedLedgerKeys] = useState<Set<string>>(new Set());
  const [expandedLedgerDate, setExpandedLedgerDate] = useState(() =>
    toDateInput(new Date()),
  );

  const showToast = (title: string, message: string, tone: ToastTone = "success") => {
    setLedgerMessageTitle(title);
    setLedgerMessage(message);
    setLedgerMessageTone(tone);
  };

  const paymentSourceOptions = useMemo<MultiSelectOption[]>(() => {
    return paymentSources.map((source: any) => ({
      value: String(source?.id || source?.code || source?.name || ""),
      label: String(source?.name || source?.code || source?.id || "—"),
    })).filter((option) => option.value);
  }, [paymentSources]);

  const selectedPaymentSourceIds = useMemo(() => {
    return paymentSourceIds.filter((value) =>
      paymentSourceOptions.some((option) => option.value === value),
    );
  }, [paymentSourceIds, paymentSourceOptions]);

  const effectivePaymentSourceId = selectedPaymentSourceIds.length === 1
    ? selectedPaymentSourceIds[0]
    : "ALL";

  const selectedPaymentSourceLabel = selectedPaymentSourceIds.length
    ? selectedPaymentSourceIds
        .map((value) => paymentSourceOptions.find((option) => option.value === value)?.label || value)
        .join(", ")
    : "Tất cả nguồn tiền";

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range === "custom") return;
    const next = getRange(range);
    setDateFrom(next.from);
    setDateTo(next.to);
  };

  const applyLedgerQuickRange = (range: QuickRange) => {
    setLedgerQuickRange(range);
    if (range === "custom") return;
    const next = getRange(range);
    setLedgerDateFrom(next.from);
    setLedgerDateTo(next.to);
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
        paymentSourceId: effectivePaymentSourceId,
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

  const loadLedger = async () => {
    setLedgerLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        dateFrom: ledgerDateFrom,
        dateTo: ledgerDateTo,
        branchId,
        paymentSourceId: effectivePaymentSourceId,
      });

      const result = await apiJson<any>(
        `/finance/daily-ledger?${params.toString()}`,
      );
      setLedgerData(result);
    } catch (err: any) {
      setError(err?.message || "Không tải được sổ nguồn tiền theo ngày.");
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadLedgerLiveData = async () => {
    try {
      const params = new URLSearchParams({
        dateFrom: ledgerDateFrom,
        dateTo: ledgerDateTo,
        branchId,
        paymentSourceId: effectivePaymentSourceId,
        status: "ALL",
        q: "",
      });

      const result = await apiJson<any>(`/finance/daily?${params.toString()}`);
      setLedgerLiveData(result);
    } catch {
      // Dữ liệu live chỉ dùng để bù giao dịch mới phát sinh; lỗi thì vẫn giữ ledger chính.
    }
  };

  const checkFinanceLogic = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    setAuditLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        dateFrom: ledgerDateFrom,
        dateTo: ledgerDateTo,
        branchId,
        paymentSourceId: effectivePaymentSourceId,
      });

      const result = await apiJson<FinanceAuditResult>(
        `/finance/daily-ledger/audit?${params.toString()}`,
      );

      setAuditResult(result);

      if (!result?.ok && !silent) {
        const count = result?.summary?.issueCount || result?.issues?.length || 0;
        showToast(
          "Phát hiện lệch logic tiền",
          `Core phát hiện ${count} điểm cần kiểm tra. Xem trạng thái ở ô Kiểm tra logic trên đầu trang.`,
          "error",
        );
      }
    } catch (err: any) {
      setAuditResult(null);
      const message = err?.message || "Không kiểm tra được logic tiền từ core.";
      setError(message);
      if (!silent) {
        showToast("Không kiểm tra được logic tiền", message, "error");
      }
    } finally {
      setAuditLoading(false);
    }
  };

  const closeLedgerDay = async () => {
    if (!closeDialog?.row) return;

    setSavingLedger(true);
    setError("");
    setLedgerMessage("");

    try {
      const saved: any = await apiJson("/finance/daily-ledger/close", {
        method: "POST",
        body: JSON.stringify({
          date: closeDialog.row.date,
          branchId: closeDialog.row.branchId,
          paymentSourceId: closeDialog.row.paymentSourceId,
          countedAmount: parseMoneyInput(closeDialog.countedAmount),
          note: closeDialog.note.trim() || undefined,
        }),
      });

      setLedgerData((previous: any) => {
        const rows = safeLedgerRows(previous);
        const savedRow: DailyLedgerRow = {
          ...closeDialog.row,
          ...(saved || {}),
          date: String(saved?.date || closeDialog.row.date).slice(0, 10),
          branchId: saved?.branchId || closeDialog.row.branchId,
          branchName: closeDialog.row.branchName,
          paymentSourceId: saved?.paymentSourceId || closeDialog.row.paymentSourceId,
          paymentSourceName: closeDialog.row.paymentSourceName,
          paymentSourceCode: closeDialog.row.paymentSourceCode,
          sourceType: closeDialog.row.sourceType,
          countedAmount: parseMoneyInput(closeDialog.countedAmount),
          differenceAmount: parseMoneyInput(closeDialog.countedAmount) - Number(closeDialog.row.closingBalance || 0),
          status: "LOCKED",
          isSyntheticLive: false,
        };
        const key = ledgerRowKey(savedRow);
        let replaced = false;
        const nextRows = rows.map((item) => {
          if (ledgerRowKey(item) === key) {
            replaced = true;
            return savedRow;
          }
          return item;
        });
        if (!replaced) nextRows.push(savedRow);
        return { ...(previous || {}), rows: nextRows };
      });

      setClosedLedgerKeys((previous) => {
        const next = new Set(previous);
        next.add(ledgerRowKey(closeDialog.row));
        return next;
      });

      showToast(
        "Đã chốt sổ",
        "Nguồn tiền đã được khóa sổ và ghi nhận số thực đếm.",
      );
      setCloseDialog(null);
      await Promise.all([loadData(), loadLedger(), loadLedgerLiveData()]);
    } catch (err: any) {
      setError(err?.message || "Không chốt được sổ nguồn tiền.");
      showToast("Không chốt được sổ", err?.message || "Backend chưa ghi được sổ. Kiểm tra lại core daily-ledger/close.");
    } finally {
      setSavingLedger(false);
    }
  };

  const reopenLedgerDay = async (row: DailyLedgerRow) => {
    setConfirmDialog({
      title: "Mở lại sổ nguồn tiền?",
      message: `Mở lại sổ ngày ${dateOnlyText(row.date)} - ${row.branchName || row.branchId || ""}. Sau khi mở lại, admin có thể kiểm tra và chốt lại số liệu.`,
      confirmText: "Mở lại sổ",
      tone: "amber",
      onConfirm: async () => {
        setConfirmDialog(null);
        setSavingLedger(true);
        setError("");
        setLedgerMessage("");

        try {
          await apiJson("/finance/daily-ledger/reopen", {
            method: "POST",
            body: JSON.stringify({
              date: row.date,
              branchId: row.branchId,
              paymentSourceId: row.paymentSourceId,
            }),
          });

          setClosedLedgerKeys((previous) => {
            const next = new Set(previous);
            next.delete(ledgerRowKey(row));
            return next;
          });

          showToast(
            "Đã mở lại sổ",
            "Nguồn tiền đã được mở lại để kiểm tra hoặc chỉnh sửa.",
          );
          await Promise.all([loadData(), loadLedger(), loadLedgerLiveData()]);
        } catch (err: any) {
          setError(err?.message || "Không mở lại được sổ nguồn tiền.");
          showToast("Không mở lại được sổ", err?.message || "Backend chưa mở lại được dòng sổ.");
        } finally {
          setSavingLedger(false);
        }
      },
    });
  };

  const closeBranchLedgerRows = async (
    branchName: string,
    rowsToClose: DailyLedgerRow[],
  ) => {
    const closeableRows = rowsToClose.filter(
      (row) => row.branchId && row.paymentSourceId && !row.isSyntheticLive,
    );

    if (!closeableRows.length) {
      setError("Không có dòng nguồn tiền hợp lệ để chốt sổ chi nhánh.");
      return;
    }

    setConfirmDialog({
      title: `Chốt sổ chi nhánh ${branchName}?`,
      message: `Hệ thống sẽ chốt ${closeableRows.length} nguồn tiền, lấy số dư cuối làm số xác nhận cho từng nguồn. Sau khi chốt, trạng thái từng nguồn sẽ chuyển thành Đã chốt sổ.`,
      confirmText: "Xác nhận chốt sổ",
      tone: "black",
      onConfirm: async () => {
        setConfirmDialog(null);
        setSavingLedger(true);
        setError("");
        setLedgerMessage("");

        try {
          for (const row of closeableRows) {
            await apiJson("/finance/daily-ledger/close", {
              method: "POST",
              body: JSON.stringify({
                date: row.date,
                branchId: row.branchId,
                paymentSourceId: row.paymentSourceId,
                countedAmount: Number(
                  row.countedAmount ?? row.closingBalance ?? 0,
                ),
                note: `Admin chốt sổ chi nhánh ${branchName} ngày ${dateOnlyText(row.date)}.`,
              }),
            });
          }

          setClosedLedgerKeys((previous) => {
            const next = new Set(previous);
            closeableRows.forEach((item) => next.add(ledgerRowKey(item)));
            return next;
          });

          showToast(
            "Đã chốt sổ chi nhánh",
            `Đã chốt sổ chi nhánh ${branchName}. Các nguồn tiền đã được xác nhận theo số dư hệ thống.`,
          );
          await Promise.all([loadData(), loadLedger(), loadLedgerLiveData()]);
        } catch (err: any) {
          setError(
            err?.message || `Không chốt được sổ chi nhánh ${branchName}.`,
          );
          showToast("Không chốt được sổ chi nhánh", err?.message || `Backend chưa ghi được sổ chi nhánh ${branchName}.`);
        } finally {
          setSavingLedger(false);
        }
      },
    });
  };

  const confirmCashHandover = async () => {
    if (!cashHandoverDialog?.row) return;

    const row = cashHandoverDialog.row;
    const amount = parseMoneyInput(cashHandoverDialog.amount);
    const currentCash = Number(row.closingBalance || 0);

    if (!row.branchId || !row.paymentSourceId) {
      setError("Thiếu chi nhánh hoặc nguồn tiền mặt để xác nhận nộp tiền.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Nhập số tiền mặt admin đã nhận lớn hơn 0.");
      return;
    }

    if (amount > currentCash) {
      setError(
        "Số tiền nộp về admin không được lớn hơn tiền mặt còn trên hệ thống.",
      );
      return;
    }

    setSavingLedger(true);
    setError("");
    setLedgerMessage("");

    try {
      const created: any = await apiJson("/finance/cash-vouchers", {
        method: "POST",
        body: JSON.stringify({
          type: "PAYMENT",
          branchId: row.branchId,
          paymentSourceId: row.paymentSourceId,
          amount,
          category: "Nộp tiền mặt về admin",
          title: `Admin xác nhận nhận tiền mặt ${row.branchName || row.branchId || ""}`,
          partnerName: "Admin",
          note:
            cashHandoverDialog.note.trim() ||
            `Admin xác nhận đã nhận tiền mặt ngày ${dateOnlyText(row.date)}.`,
        }),
      });

      if (!created?.id) {
        throw new Error("Không tạo được phiếu chi nộp tiền mặt.");
      }

      await apiJson(`/finance/cash-vouchers/${created.id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({
          note:
            cashHandoverDialog.note.trim() ||
            `Admin đã nhận tiền mặt từ ${row.branchName || row.branchId || "chi nhánh"}.`,
        }),
      });

      showToast(
        "Đã nhận tiền mặt",
        "Đã xác nhận tiền mặt nhân viên nộp về admin. Số dư tiền mặt cửa hàng đã được trừ khỏi sổ.",
      );
      setCashHandoverDialog(null);
      await Promise.all([loadData(), loadLedger(), loadLedgerLiveData()]);
    } catch (err: any) {
      setError(err?.message || "Không xác nhận được tiền mặt nộp về admin.");
    } finally {
      setSavingLedger(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);


  useEffect(() => {
    setAuditResult(null);
    const timer = window.setTimeout(() => {
      void checkFinanceLogic({ silent: true });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [ledgerDateFrom, ledgerDateTo, branchId, effectivePaymentSourceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, branchId, effectivePaymentSourceId, flow, q]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLedger();
      void loadLedgerLiveData();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [ledgerDateFrom, ledgerDateTo, branchId, effectivePaymentSourceId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!savingLedger && !closeDialog && !cashHandoverDialog) {
        void loadData();
        void loadLedger();
        void loadLedgerLiveData();
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [
    dateFrom,
    dateTo,
    ledgerDateFrom,
    ledgerDateTo,
    branchId,
    effectivePaymentSourceId,
    flow,
    q,
    savingLedger,
    closeDialog,
    cashHandoverDialog,
  ]);

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch: any) => {
      const name = canonicalBranchName(branch?.name || branch?.code || branch?.id);
      if (branch?.id) map.set(String(branch.id), name);
      if (branch?.code) map.set(String(branch.code), name);
      if (branch?.name) map.set(String(branch.name), name);
    });
    return map;
  }, [branches]);

  const paymentSourceNameById = useMemo(() => {
    const map = new Map<string, string>();
    paymentSources.forEach((source: any) => {
      const label = String(source?.name || source?.code || source?.id || "").trim();
      if (source?.id) map.set(String(source.id), label);
      if (source?.code) map.set(String(source.code), label);
      if (source?.name) map.set(String(source.name), label);
    });
    return map;
  }, [paymentSources]);

  const displayBranchName = (row: MoneyRow) => {
    const direct = row.branchName || row.branchId || "";
    const mapped = row.branchId ? branchNameById.get(String(row.branchId)) : "";
    return canonicalBranchName(mapped || direct || "—");
  };

  const displaySourceName = (row: MoneyRow) => {
    const mapped = row.paymentSourceId
      ? paymentSourceNameById.get(String(row.paymentSourceId))
      : "";
    return (mapped || row.sourceName || row.method || row.sourceCode || "—").trim();
  };

  const rowMatchesSelectedBranch = (row: MoneyRow) => {
    if (branchId === "ALL") return true;
    const selected = branches.find((branch: any) => String(branch.id) === String(branchId));
    const selectedName = canonicalBranchName(selected?.name || selected?.code || branchId);
    return (
      String(row.branchId || "") === String(branchId) ||
      normalizeText(displayBranchName(row)) === normalizeText(selectedName)
    );
  };

  const rowMatchesSelectedSource = (row: MoneyRow) => {
    if (!selectedPaymentSourceIds.length) return true;
    return selectedPaymentSourceIds.some((sourceId) => {
      const sourceLabel = paymentSourceNameById.get(String(sourceId)) || sourceId;
      return (
        String(row.paymentSourceId || "") === String(sourceId) ||
        normalizeText(displaySourceName(row)) === normalizeText(sourceLabel)
      );
    });
  };

  const ledgerRowMatchesSelectedSource = (row: DailyLedgerRow) => {
    if (!selectedPaymentSourceIds.length) return true;
    return selectedPaymentSourceIds.some((sourceId) => {
      const sourceLabel = paymentSourceNameById.get(String(sourceId)) || sourceId;
      return (
        String(row.paymentSourceId || "") === String(sourceId) ||
        normalizeText(row.paymentSourceName || row.paymentSourceCode || row.paymentSourceId) === normalizeText(sourceLabel)
      );
    });
  };

  const rows = useMemo(() => {
    const rawRows = safeRows(data?.payments);

    const amountFrom = transactionAmountFrom.trim()
      ? parseMoneyInput(transactionAmountFrom)
      : null;
    const amountTo = transactionAmountTo.trim()
      ? parseMoneyInput(transactionAmountTo)
      : null;

    return rawRows
      .filter((row) => rowMatchesSelectedBranch(row))
      .filter((row) => rowMatchesSelectedSource(row))
      .filter((row) => passFlowFilter(row, flow))
      .filter((row) => {
        if (transactionBranchFilter === "ALL") return true;
        return normalizeText(displayBranchName(row)) === normalizeText(transactionBranchFilter);
      })
      .filter((row) => {
        if (transactionSourceFilters.length === 0) return true;
        return transactionSourceFilters.some((name) => normalizeText(displaySourceName(row)) === normalizeText(name));
      })
      .filter((row) => {
        if (transactionStatusFilter === "ALL") return true;
        return normalizeText(rowStatusLabel(row)) === normalizeText(transactionStatusFilter);
      })
      .filter((row) => {
        if (transactionTypeFilter === "ALL") return true;
        if (transactionTypeFilter === "ORDER") return String(row.recordType || "").toUpperCase() === "PAYMENT" || Boolean(row.orderCode);
        if (transactionTypeFilter === "VOUCHER") return String(row.recordType || "").toUpperCase() === "CASH_VOUCHER" || Boolean(row.voucherCode);
        return true;
      })
      .filter((row) => staffFilter === "ALL" || creatorName(row) === staffFilter)
      .filter((row) => {
        const amount = Math.abs(rowAmountSigned(row));
        if (amountFrom !== null && amount < amountFrom) return false;
        if (amountTo !== null && amount > amountTo) return false;
        return true;
      })
      .filter((row) => {
        if (!q.trim()) return true;
        const keyword = normalizeText(q);
        const haystack = normalizeText(
          [
            row.voucherCode,
            row.orderCode,
            row.customerName,
            row.customerPhone,
            displayBranchName(row),
            row.branchName,
            row.branchId,
            displaySourceName(row),
            row.sourceName,
            row.sourceCode,
            row.method,
            sourceKindLabel(sourceKind(row)),
            rowStatusLabel(row),
            creatorName(row),
            row.title,
            row.category,
            row.note,
            row.recordType,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return haystack.includes(keyword);
      });
  }, [
    data,
    flow,
    staffFilter,
    q,
    branchId,
    selectedPaymentSourceIds,
    transactionBranchFilter,
    transactionSourceFilters,
    transactionStatusFilter,
    transactionTypeFilter,
    transactionAmountFrom,
    transactionAmountTo,
    branches,
    branchNameById,
    paymentSourceNameById,
  ]);

  const staffOptions = useMemo(() => {
    const names = safeRows(data?.payments)
      .map((row) => creatorName(row))
      .filter((name) => name && name !== "—");

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "vi"));
  }, [data]);

  const transactionBranchOptions = useMemo(() => {
    const names = safeRows(data?.payments)
      .filter((row) => rowMatchesSelectedBranch(row))
      .filter((row) => rowMatchesSelectedSource(row))
      .map((row) => displayBranchName(row))
      .filter((name) => name && name !== "—");
    return Array.from(new Set(names)).sort((a, b) => {
      const weightDiff = branchSortWeight(a) - branchSortWeight(b);
      if (weightDiff !== 0) return weightDiff;
      return a.localeCompare(b, "vi");
    });
  }, [data, branchId, selectedPaymentSourceIds, branches, paymentSourceNameById, branchNameById]);

  const transactionSourceOptions = useMemo(() => {
    const names = safeRows(data?.payments)
      .filter((row) => rowMatchesSelectedBranch(row))
      .filter((row) => rowMatchesSelectedSource(row))
      .map((row) => displaySourceName(row))
      .filter((name) => name && name !== "—");
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "vi"));
  }, [data, branchId, selectedPaymentSourceIds, branches, branchNameById, paymentSourceNameById]);

  const transactionStatusOptions = useMemo(() => {
    const names = safeRows(data?.payments)
      .map((row) => rowStatusLabel(row))
      .filter((name) => name && name !== "—");
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "vi"));
  }, [data]);

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
      const key =
        row.sourceName || row.sourceCode || row.method || "Chưa rõ nguồn tiền";
      const current = map.get(key) || {
        sourceName: key,
        sourceType: sourceKindLabel(sourceKind(row)),
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

    return Array.from(map.values()).sort(
      (a, b) => Math.abs(b.net) - Math.abs(a.net),
    );
  }, [rows]);

  const byBranch = useMemo(() => {
    const map = new Map<string, any>();

    rows.forEach((row) => {
      const key = displayBranchName(row);
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

    return Array.from(map.values()).sort(
      (a, b) => Math.abs(b.net) - Math.abs(a.net),
    );
  }, [rows]);

  const ledgerRows = useMemo(() => {
    // Backend là nguồn sự thật duy nhất cho sổ tiền.
    // Ưu tiên /finance/daily-ledger; nếu online trả rỗng thì dùng ledgerRows kèm theo /finance/daily.
    // Chỉ khi cả hai core đều rỗng mới dùng fallback giao dịch để tránh màn trắng.
    const coreRows = safeLedgerRows(ledgerData);
    const dailyCoreRows = safeLedgerRows(
      data?.ledgerRows || data?.dailyRows || data?.ledger?.rows,
    );
    const sourceRows = coreRows.length > 0 ? coreRows : dailyCoreRows;

    if (sourceRows.length > 0) {
      return sourceRows
        .map((row) => {
          const patched = closedLedgerKeys.has(ledgerRowKey(row))
            ? {
                ...row,
                status: "LOCKED",
                countedAmount: row.countedAmount ?? row.closingBalance ?? 0,
                differenceAmount: row.differenceAmount ?? 0,
              }
            : row;

          const totalReceipt = Number(patched.totalReceipt || 0);
          const totalPayment = Number(patched.totalPayment || 0);
          const netAmount = totalReceipt - totalPayment;
          const openingBalance = Number(patched.openingBalance || 0);

          return {
            ...patched,
            branchName: canonicalBranchName(patched.branchName || patched.branchId),
            openingBalance,
            posReceiptAmount: Number(patched.posReceiptAmount || 0),
            manualReceiptAmount: Number(patched.manualReceiptAmount || 0),
            manualPaymentAmount: Number(patched.manualPaymentAmount || 0),
            totalReceipt,
            totalPayment,
            netAmount,
            closingBalance: openingBalance + netAmount,
          };
        })
        .filter((row) => ledgerRowMatchesSelectedSource(row))
        .sort((a, b) => {
          const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
          if (dateDiff !== 0) return dateDiff;
          const branchDiff = branchSortWeight(a.branchName || a.branchId) - branchSortWeight(b.branchName || b.branchId);
          if (branchDiff !== 0) return branchDiff;
          return String(a.paymentSourceName || a.paymentSourceCode || "").localeCompare(
            String(b.paymentSourceName || b.paymentSourceCode || ""),
            "vi",
          );
        });
    }

    const liveRows = safeRows(data?.payments).filter((row) => rowMatchesSelectedSource(row));
    const map = new Map<string, DailyLedgerRow>();

    liveRows.forEach((row) => {
      const dateKey = rowDateKey(row);
      if (!dateKey) return;

      const amount = Math.abs(Number(row.amount || 0));
      if (!amount) return;

      const branchName = displayBranchName(row);
      const sourceName = displaySourceName(row);
      const sourceType = sourceKind(row);
      const sourceCode = row.sourceCode;
      const sourceId = row.paymentSourceId || sourceName;
      const key = [dateKey, normalizeText(branchName), normalizeText(sourceId || sourceName)].join("|");

      const current = map.get(key) || {
        date: dateKey,
        branchId: row.branchId,
        branchName,
        paymentSourceId: sourceId,
        paymentSourceName: sourceName,
        paymentSourceCode: sourceCode,
        sourceType,
        openingBalance: 0,
        posReceiptAmount: 0,
        manualReceiptAmount: 0,
        manualPaymentAmount: 0,
        totalReceipt: 0,
        totalPayment: 0,
        netAmount: 0,
        closingBalance: 0,
        countedAmount: null,
        differenceAmount: null,
        status: "OPEN",
        isSyntheticLive: true,
      } as DailyLedgerRow;

      if (isReceiptRow(row)) {
        if (isPosRow(row) || String(row.recordType || "").toUpperCase() === "PAYMENT") {
          current.posReceiptAmount = Number(current.posReceiptAmount || 0) + amount;
        } else {
          current.manualReceiptAmount = Number(current.manualReceiptAmount || 0) + amount;
        }
        current.totalReceipt = Number(current.totalReceipt || 0) + amount;
      } else {
        current.manualPaymentAmount = Number(current.manualPaymentAmount || 0) + amount;
        current.totalPayment = Number(current.totalPayment || 0) + amount;
      }

      current.netAmount = Number(current.totalReceipt || 0) - Number(current.totalPayment || 0);
      current.closingBalance = Number(current.openingBalance || 0) + Number(current.netAmount || 0);
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateDiff !== 0) return dateDiff;
      const branchDiff = branchSortWeight(a.branchName || a.branchId) - branchSortWeight(b.branchName || b.branchId);
      if (branchDiff !== 0) return branchDiff;
      return String(a.paymentSourceName || a.paymentSourceCode || "").localeCompare(
        String(b.paymentSourceName || b.paymentSourceCode || ""),
        "vi",
      );
    });
  }, [ledgerData, closedLedgerKeys, data, branches, branchNameById, paymentSourceNameById, selectedPaymentSourceIds]);

  const ledgerSummary = useMemo(() => {
    const acc = {
      opening: 0,
      receipt: 0,
      payment: 0,
      net: 0,
      closing: 0,
      difference: 0,
      cashClosing: 0,
      locked: 0,
      open: 0,
    };

    const rowsByDate = new Map<string, DailyLedgerRow[]>();
    ledgerRows.forEach((row) => {
      const dateKey = String(row.date || "").slice(0, 10);
      if (!dateKey) return;
      const list = rowsByDate.get(dateKey) || [];
      list.push(row);
      rowsByDate.set(dateKey, list);

      acc.receipt += Number(row.totalReceipt || 0);
      acc.payment += Number(row.totalPayment || 0);
      acc.net += Number(row.netAmount || 0);
      acc.difference += Number(row.differenceAmount || 0);
      if (String(row.status || "").toUpperCase() === "LOCKED") acc.locked += 1;
      else acc.open += 1;
    });

    const dates = Array.from(rowsByDate.keys()).sort();
    const firstRows = rowsByDate.get(dates[0] || "") || [];
    const lastRows = rowsByDate.get(dates[dates.length - 1] || "") || [];

    acc.opening = firstRows.reduce((sum, row) => sum + Number(row.openingBalance || 0), 0);
    acc.closing = lastRows.reduce((sum, row) => sum + Number(row.closingBalance || 0), 0);
    acc.cashClosing = lastRows.reduce(
      (sum, row) => sum + (isCashLedgerRow(row) ? Number(row.closingBalance || 0) : 0),
      0,
    );

    return acc;
  }, [ledgerRows]);

  const ledgerRowsByDate = useMemo(() => {
    const map = new Map<string, DailyLedgerRow[]>();

    ledgerRows.forEach((row) => {
      const dateKey = String(row.date || "").slice(0, 10) || "—";
      const current = map.get(dateKey) || [];
      current.push(row);
      map.set(dateKey, current);
    });

    return map;
  }, [ledgerRows]);

  const configuredBranchNames = useMemo(() => DEFAULT_BRANCH_NAMES, []);

  const branchIdByName = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch: any) => {
      const name = canonicalBranchName(branch?.name || branch?.code || branch?.id);
      if (name && name !== "—" && branch?.id) map.set(name, String(branch.id));
    });
    ledgerRows.forEach((row) => {
      const name = canonicalBranchName(row.branchName || row.branchId);
      if (name && name !== "—" && row.branchId && !map.has(name)) {
        map.set(name, String(row.branchId));
      }
    });
    return map;
  }, [branches, ledgerRows]);

  const dailyLedgerRows = useMemo(() => {
    const map = new Map<string, any>();

    ledgerRows.forEach((row) => {
      const dateKey = String(row.date || "").slice(0, 10) || "—";
      const current = map.get(dateKey) || {
        date: dateKey,
        openingBalance: 0,
        posReceiptAmount: 0,
        manualReceiptAmount: 0,
        manualPaymentAmount: 0,
        totalReceipt: 0,
        totalPayment: 0,
        netAmount: 0,
        closingBalance: 0,
        cashClosingBalance: 0,
        countedAmount: 0,
        countedRowCount: 0,
        differenceAmount: 0,
        differenceRowCount: 0,
        locked: 0,
        open: 0,
        rowCount: 0,
        branches: new Set<string>(),
        sources: new Set<string>(),
        branchMap: new Map<string, any>(),
      };

      current.openingBalance += Number(row.openingBalance || 0);
      current.posReceiptAmount += Number(row.posReceiptAmount || 0);
      current.manualReceiptAmount += Number(row.manualReceiptAmount || 0);
      current.manualPaymentAmount += Number(row.manualPaymentAmount || 0);
      current.totalReceipt += Number(row.totalReceipt || 0);
      current.totalPayment += Number(row.totalPayment || 0);
      current.netAmount += Number(row.netAmount || 0);
      current.closingBalance += Number(row.closingBalance || 0);
      if (isCashLedgerRow(row)) {
        current.cashClosingBalance += Number(row.closingBalance || 0);
      }

      if (row.countedAmount !== null && row.countedAmount !== undefined) {
        current.countedAmount += Number(row.countedAmount || 0);
        current.countedRowCount += 1;
      }

      if (row.differenceAmount !== null && row.differenceAmount !== undefined) {
        current.differenceAmount += Number(row.differenceAmount || 0);
        current.differenceRowCount += 1;
      }

      if (String(row.status || "").toUpperCase() === "LOCKED")
        current.locked += 1;
      else current.open += 1;

      current.rowCount += 1;
      const branchKey = canonicalBranchName(row.branchName || row.branchId || "—");
      current.branches.add(branchKey);
      current.sources.add(row.paymentSourceName || row.paymentSourceId || "—");

      const branchSummary = current.branchMap.get(branchKey) || {
        branchName: branchKey,
        openingBalance: 0,
        totalReceipt: 0,
        totalPayment: 0,
        netAmount: 0,
        closingBalance: 0,
        cashClosingBalance: 0,
        cashHandedOverAmount: 0,
        sourceCount: 0,
      };
      branchSummary.openingBalance += Number(row.openingBalance || 0);
      branchSummary.totalReceipt += Number(row.totalReceipt || 0);
      branchSummary.totalPayment += Number(row.totalPayment || 0);
      branchSummary.netAmount += Number(row.netAmount || 0);
      branchSummary.closingBalance += Number(row.closingBalance || 0);
      if (isCashLedgerRow(row)) {
        branchSummary.cashClosingBalance += Number(row.closingBalance || 0);
        branchSummary.cashHandedOverAmount += Number(
          row.manualPaymentAmount || 0,
        );
      }
      branchSummary.sourceCount += 1;
      current.branchMap.set(branchKey, branchSummary);

      map.set(dateKey, current);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        branchCount: uniqBranchNames([...configuredBranchNames, ...Array.from(row.branches)]).length,
        sourceCount: row.sources.size,
        branchSummaries: uniqBranchNames([
          ...configuredBranchNames,
          ...Array.from(row.branchMap.keys()),
        ])
          .map((name) =>
            row.branchMap.get(name) || {
              branchName: name,
              openingBalance: 0,
              totalReceipt: 0,
              totalPayment: 0,
              netAmount: 0,
              closingBalance: 0,
              cashClosingBalance: 0,
              cashHandedOverAmount: 0,
              sourceCount: 0,
            },
          )
          .sort((a: any, b: any) => {
            const weightDiff =
              branchSortWeight(a.branchName) - branchSortWeight(b.branchName);
            if (weightDiff !== 0) return weightDiff;
            return String(a.branchName || "").localeCompare(
              String(b.branchName || ""),
              "vi",
            );
          }),
        branches: undefined,
        sources: undefined,
        branchMap: undefined,
        status: row.open > 0 ? "OPEN" : "LOCKED",
      }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [ledgerRows, configuredBranchNames]);

  const paymentSourcesByBranch = useMemo(() => {
    const map = new Map<string, any[]>();
    configuredBranchNames.forEach((name) => map.set(name, []));

    paymentSources.forEach((source) => {
      configuredBranchNames.forEach((branchName) => {
        if (sourceBelongsToBranch(source, branchName)) {
          const rows = map.get(branchName) || [];
          rows.push(source);
          map.set(branchName, rows);
        }
      });
    });

    configuredBranchNames.forEach((branchName) => {
      const rows = map.get(branchName) || [];
      rows.sort((a, b) => {
        const aCash = sourceKind({ sourceType: a?.type || a?.sourceType, sourceName: a?.name, sourceCode: a?.code }) === "CASH" ? 1 : 0;
        const bCash = sourceKind({ sourceType: b?.type || b?.sourceType, sourceName: b?.name, sourceCode: b?.code }) === "CASH" ? 1 : 0;
        if (aCash !== bCash) return aCash - bCash;
        return String(a?.name || a?.code || "").localeCompare(String(b?.name || b?.code || ""), "vi");
      });
      map.set(branchName, rows);
    });

    return map;
  }, [configuredBranchNames, paymentSources]);

  const buildDetailGroups = (detailRows: DailyLedgerRow[]) => {
    return configuredBranchNames.map((branchName) => {
      const rowMap = new Map<string, DailyLedgerRow>();
      const date = detailRows[0]?.date || expandedLedgerDate || dateTo;

      const sourcesForBranch = paymentSourcesByBranch.get(branchName) || [];
      const validSourcesForBranch = sourcesForBranch.filter((source) => sourceBelongsToBranch(source, branchName));
      validSourcesForBranch.forEach((source) => {
        const sourceType = sourceKind({
          sourceType: source?.type || source?.sourceType,
          sourceName: source?.name,
          sourceCode: source?.code,
        });
        const seed: DailyLedgerRow = {
          date,
          branchId: source?.branchId || source?.branch?.id || branchIdByName.get(branchName) || branchCodeFromName(branchName),
          branchName,
          paymentSourceId: source?.id || source?.paymentSourceId || source?.code || source?.name,
          paymentSourceName: source?.name || source?.paymentSourceName || source?.code || "Nguồn tiền",
          paymentSourceCode: source?.code || source?.paymentSourceCode,
          sourceType,
          openingBalance: 0,
          posReceiptAmount: 0,
          manualReceiptAmount: 0,
          manualPaymentAmount: 0,
          totalReceipt: 0,
          totalPayment: 0,
          netAmount: 0,
          closingBalance: 0,
          countedAmount: null,
          differenceAmount: null,
          status: "OPEN",
        };
        rowMap.set(canonicalSourceKey(seed, branchName), seed);
      });

      detailRows
        .filter((row) => canonicalBranchName(row.branchName || row.branchId) === branchName)
        .forEach((row) => {
          const key = canonicalSourceKey(row, branchName);
          const existing = rowMap.get(key);
          if (existing) {
            mergeLedgerAmount(existing, row);
          } else {
            rowMap.set(key, { ...row, branchName });
          }
        });

      const rowsForBranch = Array.from(rowMap.values()).sort((a, b) => {
        const aCash = isCashLedgerRow(a) ? 1 : 0;
        const bCash = isCashLedgerRow(b) ? 1 : 0;
        if (aCash !== bCash) return aCash - bCash;
        return String(a.paymentSourceName || "").localeCompare(String(b.paymentSourceName || ""), "vi");
      });

      const summary = rowsForBranch.reduce(
        (acc, detailRow) => {
          acc.closingBalance += Number(detailRow.closingBalance || 0);
          acc.totalReceipt += Number(detailRow.totalReceipt || 0);
          acc.totalPayment += Number(detailRow.totalPayment || 0);
          acc.netAmount += Number(detailRow.netAmount || 0);
          if (isCashLedgerRow(detailRow)) {
            acc.cashClosingBalance += Number(detailRow.closingBalance || 0);
            acc.cashHandedOverAmount += Math.max(0, Number(detailRow.manualPaymentAmount || 0));
          }
          return acc;
        },
        {
          branchName,
          rows: rowsForBranch,
          closingBalance: 0,
          cashClosingBalance: 0,
          cashHandedOverAmount: 0,
          totalReceipt: 0,
          totalPayment: 0,
          netAmount: 0,
        },
      );

      return summary;
    });
  };

  const sourceTotal = Math.max(
    1,
    bySource.reduce((sum, row) => sum + Math.abs(Number(row.net || 0)), 0),
  );

  return (
    <div className="space-y-6">
      {closeDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-neutral-950">
                  Chốt sổ nguồn tiền
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {dateOnlyText(closeDialog.row.date)} ·{" "}
                  {closeDialog.row.branchName ||
                    closeDialog.row.branchId ||
                    "—"}{" "}
                  ·{" "}
                  {closeDialog.row.paymentSourceName ||
                    closeDialog.row.paymentSourceId ||
                    "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloseDialog(null)}
                className="rounded-full px-3 py-1 text-xl font-semibold text-neutral-500 hover:bg-neutral-100"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-4 text-sm md:grid-cols-2">
              <div>
                Số dư đầu:{" "}
                <b>{currency(Number(closeDialog.row.openingBalance || 0))}</b>
              </div>
              <div>
                Thu:{" "}
                <b className="text-emerald-700">
                  +{currency(Number(closeDialog.row.totalReceipt || 0))}
                </b>
              </div>
              <div>
                Chi:{" "}
                <b className="text-red-700">
                  -{currency(Number(closeDialog.row.totalPayment || 0))}
                </b>
              </div>
              <div>
                Số dư hệ thống:{" "}
                <b>{currency(Number(closeDialog.row.closingBalance || 0))}</b>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Tiền thực đếm cuối ngày">
                <input
                  value={closeDialog.countedAmount}
                  onChange={(event) =>
                    setCloseDialog({
                      ...closeDialog,
                      countedAmount: event.target.value.replace(/[^\d-]/g, ""),
                    })
                  }
                  className="h-12 w-full rounded-2xl border border-neutral-200 px-4 text-sm font-semibold outline-none focus:border-neutral-400"
                  placeholder="Nhập số tiền thực đếm"
                />
              </Field>

              <Field label="Ghi chú nếu có lệch">
                <textarea
                  value={closeDialog.note}
                  onChange={(event) =>
                    setCloseDialog({ ...closeDialog, note: event.target.value })
                  }
                  className="min-h-24 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
                  placeholder="Ví dụ: lệch do thiếu tiền lẻ, nhân viên ứng trước, chờ bổ sung chứng từ..."
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseDialog(null)}
                className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={() => void closeLedgerDay()}
                disabled={savingLedger}
                className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingLedger ? "Đang chốt..." : "Xác nhận chốt ngày"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cashHandoverDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-neutral-950">
                  Admin xác nhận nhận tiền mặt
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {dateOnlyText(cashHandoverDialog.row.date)} ·{" "}
                  {cashHandoverDialog.row.branchName ||
                    cashHandoverDialog.row.branchId ||
                    "—"}{" "}
                  ·{" "}
                  {cashHandoverDialog.row.paymentSourceName ||
                    cashHandoverDialog.row.paymentSourceId ||
                    "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCashHandoverDialog(null)}
                className="rounded-full px-3 py-1 text-xl font-semibold text-neutral-500 hover:bg-neutral-100"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-3xl bg-neutral-950 p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                Tiền mặt còn trên sổ
              </div>
              <div className="mt-2 text-3xl font-black tracking-tight">
                {currency(Number(cashHandoverDialog.row.closingBalance || 0))}
              </div>
              <p className="mt-2 text-sm text-white/60">
                Khi admin xác nhận đã nhận tiền, hệ thống tự tạo và xác nhận một
                phiếu chi “Nộp tiền mặt về admin”, tiền mặt tại cửa hàng sẽ giảm
                tương ứng.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Số tiền admin đã nhận">
                <input
                  value={cashHandoverDialog.amount}
                  onChange={(event) =>
                    setCashHandoverDialog({
                      ...cashHandoverDialog,
                      amount: event.target.value.replace(/[^\d-]/g, ""),
                    })
                  }
                  className="h-12 w-full rounded-2xl border border-neutral-200 px-4 text-sm font-semibold outline-none focus:border-neutral-400"
                  placeholder="Nhập số tiền mặt đã nhận"
                />
              </Field>

              <Field label="Ghi chú bàn giao">
                <textarea
                  value={cashHandoverDialog.note}
                  onChange={(event) =>
                    setCashHandoverDialog({
                      ...cashHandoverDialog,
                      note: event.target.value,
                    })
                  }
                  className="min-h-24 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
                  placeholder="Ví dụ: Mai Trang nộp tiền mặt cuối ngày cho admin, đã kiểm đủ."
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCashHandoverDialog(null)}
                className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={() => void confirmCashHandover()}
                disabled={savingLedger}
                className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingLedger ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-2xl">
            <div className="bg-neutral-950 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
                    Xác nhận thao tác
                  </p>
                  <h3 className="mt-2 text-xl font-black">
                    {confirmDialog.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="rounded-full px-3 py-1 text-xl font-semibold text-white/60 hover:bg-white/10"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm leading-6 text-neutral-600">
                {confirmDialog.message}
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDialog.onConfirm()}
                  disabled={savingLedger}
                  className={`rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-50 ${
                    confirmDialog.tone === "red"
                      ? "bg-red-600"
                      : confirmDialog.tone === "amber"
                        ? "bg-amber-600"
                        : "bg-neutral-950"
                  }`}
                >
                  {savingLedger ? "Đang xử lý..." : confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ledgerMessage ? (
        <div
          className={`fixed right-6 top-24 z-[80] max-w-md rounded-3xl border bg-white p-4 text-sm shadow-2xl ${
            ledgerMessageTone === "error"
              ? "border-red-200 shadow-red-950/10"
              : ledgerMessageTone === "warning"
                ? "border-amber-200 shadow-amber-950/10"
                : "border-emerald-200 shadow-emerald-950/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-black ${
                ledgerMessageTone === "error"
                  ? "bg-red-100 text-red-800"
                  : ledgerMessageTone === "warning"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {ledgerMessageTone === "error" ? "!" : "✓"}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`font-bold ${
                  ledgerMessageTone === "error"
                    ? "text-red-800"
                    : ledgerMessageTone === "warning"
                      ? "text-amber-800"
                      : "text-emerald-800"
                }`}
              >
                {ledgerMessageTitle}
              </p>
              <p className="mt-1 text-neutral-700">{ledgerMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setLedgerMessage("")}
              className="rounded-full px-2 py-1 hover:bg-neutral-100"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-[32px] bg-neutral-950 p-6 text-white shadow-2xl shadow-neutral-950/20">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">
              Tài chính / Tổng quan nguồn tiền
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              Tổng quan nguồn tiền
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
              Theo dõi tiền thực nhận theo nguồn tiền, chi nhánh và loại dòng
              tiền. POS hoàn thành, phiếu thu/chi xác nhận và tiền cọc/chuyển
              khoản đã ghi nhận được gom vào đây. Dữ liệu tự làm mới khoảng 30
              giây/lần.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[680px] xl:grid-cols-4">
            <div className="rounded-3xl bg-white px-5 py-4 text-neutral-950">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Tiền mặt còn
              </p>
              <p className="mt-2 text-2xl font-black">
                {currency(ledgerSummary.cashClosing)}
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-5 py-4 ring-1 ring-white/10">
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                Thu - chi
              </p>
              <p
                className={`mt-2 text-2xl font-black ${summary.net >= 0 ? "text-emerald-200" : "text-red-200"}`}
              >
                {currency(summary.net)}
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-5 py-4 ring-1 ring-white/10">
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                Giao dịch
              </p>
              <p className="mt-2 text-2xl font-black">
                {numberText(summary.count)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void checkFinanceLogic()}
              disabled={auditLoading}
              className={`rounded-3xl px-5 py-4 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-70 ${
                !auditResult
                  ? "bg-white/10 text-white ring-white/10 hover:bg-white/15"
                  : auditResult.ok
                    ? "bg-emerald-500/15 text-emerald-50 ring-emerald-300/30 hover:bg-emerald-500/20"
                    : "bg-red-500/15 text-red-50 ring-red-300/30 hover:bg-red-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    !auditResult
                      ? "bg-white/35"
                      : auditResult.ok
                        ? "bg-emerald-300"
                        : "bg-red-300"
                  }`}
                />
                <p className="text-xs font-bold uppercase tracking-wide text-white/55">
                  Kiểm tra logic
                </p>
              </div>
              <p className="mt-2 text-sm font-black leading-5">
                {auditLoading
                  ? "Đang kiểm tra..."
                  : !auditResult
                    ? "Bấm để kiểm tra"
                    : auditResult.ok
                      ? "Đã kiểm tra logic khớp"
                      : `Lệch ${auditResult.summary?.issueCount || auditResult.issues?.length || 0} điểm`}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-white/45">
                {auditResult?.checkedAt
                  ? `${auditResult.summary?.checkedRows || 0} dòng · ${dateText(auditResult.checkedAt)}`
                  : "Core backend đối chiếu toàn bộ bảng"}
              </p>
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (window.location.href = "/finance/cash-receipts")}
            className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-neutral-100"
          >
            Phiếu thu
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/finance/cash-payments")}
            className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15"
          >
            Phiếu chi
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Khoảng thời gian
            </p>
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
            <MultiSelectFilter
              values={selectedPaymentSourceIds}
              options={paymentSourceOptions}
              allLabel="Tất cả nguồn tiền"
              selectedLabel={selectedPaymentSourceLabel}
              onChange={setPaymentSourceIds}
            />
          </Field>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void loadData();
                void loadLedger();
              }}
              className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white"
            >
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_240px_240px_220px]">
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

          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả nhân viên</option>
            {staffOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setBranchId("ALL");
              setPaymentSourceIds([]);
              setFlow("ALL");
              setStaffFilter("ALL");
              setTransactionBranchFilter("ALL");
              setTransactionSourceFilters([]);
              setTransactionStatusFilter("ALL");
              setTransactionTypeFilter("ALL");
              setTransactionAmountFrom("");
              setTransactionAmountTo("");
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
        <Stat
          label="Tổng tiền vào"
          value={currency(summary.receipt)}
          hint="Phiếu thu + POS + CK/cọc"
        />
        <Stat
          label="Tổng tiền ra"
          value={currency(summary.payment)}
          hint="Phiếu chi/hoàn/chi vận hành"
        />
        <Stat
          label="Số dư ròng"
          value={currency(summary.net)}
          hint="Tiền vào - tiền ra"
        />
        <Stat
          label="POS hoàn thành"
          value={currency(summary.pos)}
          hint="Đơn POS đã completed"
        />
        <Stat
          label="CK / cọc"
          value={currency(summary.transfer)}
          hint="Nguồn ngân hàng"
        />
        <Stat
          label="Số giao dịch"
          value={numberText(summary.count)}
          hint={`TB ${currency(summary.average)}`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Tổng quan theo nguồn tiền
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Nhìn nhanh mỗi tài khoản/quỹ đang thu chi bao nhiêu trong khoảng
                lọc.
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
                  <tr
                    key={source.sourceName}
                    className="border-b border-neutral-100"
                  >
                    <td className="py-3 pr-3 font-semibold">
                      {source.sourceName}
                    </td>
                    <td className="py-3 pr-3 text-neutral-500">
                      {sourceKindLabel(source.sourceType)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {currency(source.receipt)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {currency(source.payment)}
                    </td>
                    <td className="py-3 pr-3 text-right font-semibold">
                      {currency(source.net)}
                    </td>
                    <td className="py-3 text-right">{source.count}</td>
                  </tr>
                ))}

                {!bySource.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-neutral-500"
                    >
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
          <p className="mt-1 text-sm text-neutral-500">
            Nguồn nào đang chiếm tỷ trọng lớn nhất.
          </p>

          <div className="mt-5 space-y-4">
            {bySource.slice(0, 8).map((source) => {
              const percent = Math.round(
                (Math.abs(Number(source.net || 0)) / sourceTotal) * 100,
              );
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
            <p className="mt-1 text-sm text-neutral-500">
              Tách dòng tiền theo từng chi nhánh để chốt quỹ cuối ngày.
            </p>
          </div>
          <span className="text-sm text-neutral-500">
            {byBranch.length} chi nhánh
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {byBranch.map((branch) => (
            <div
              key={branch.branchName}
              className="rounded-2xl border border-neutral-200 p-4"
            >
              <div className="text-sm font-semibold">{branch.branchName}</div>
              <div className="mt-3 text-2xl font-semibold">
                {currency(branch.net)}
              </div>
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
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Bảng chốt tiền từng ngày
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Mỗi hàng là một ngày. Cột chi nhánh gom thành từng khung để nhìn
                nhanh từng cửa hàng; bấm vào ngày để xổ chi tiết đúng ngày đó.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                {dailyLedgerRows.length} ngày · {ledgerSummary.locked} mục đã
                chốt
              </span>
              <button
                type="button"
                onClick={() =>
                  applyLedgerQuickRange(
                    ledgerQuickRange === "month" ? "10d" : "month",
                  )
                }
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                {ledgerQuickRange === "month"
                  ? "Thu gọn 10 ngày ↑"
                  : "Xem cả tháng ↓"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadLedger();
                  void loadLedgerLiveData();
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                {ledgerLoading ? "Đang tải..." : "Tải lại sổ"}
              </button>

            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MiniStat
              label="Tổng thu"
              value={`+${currency(ledgerSummary.receipt)}`}
              tone="green"
            />
            <MiniStat
              label="Tổng chi"
              value={`-${currency(ledgerSummary.payment)}`}
              tone="red"
            />
            <MiniStat label="Thu - chi" value={currency(ledgerSummary.net)} />
            <MiniStat
              label="Số dư cuối"
              value={currency(ledgerSummary.closing)}
            />
            <MiniStat
              label="Tiền mặt còn tổng các chi nhánh"
              value={currency(ledgerSummary.cashClosing)}
              tone="dark"
            />
            <MiniStat
              label="Tổng lệch"
              value={currency(ledgerSummary.difference)}
              tone={
                ledgerSummary.difference === 0
                  ? "neutral"
                  : ledgerSummary.difference > 0
                    ? "green"
                    : "red"
              }
            />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Lọc nhanh bảng chốt tiền
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["today", "Hôm nay"],
                ["yesterday", "Hôm qua"],
                ["7d", "7 ngày"],
                ["10d", "10 ngày"],
                ["30d", "30 ngày"],
                ["month", "Tháng này"],
                ["custom", "Tuỳ chỉnh"],
              ].map(([value, label]) => (
                <button
                  key={`ledger-filter-${value}`}
                  type="button"
                  onClick={() => applyLedgerQuickRange(value as QuickRange)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    ledgerQuickRange === value
                      ? "bg-neutral-950 text-white"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="ml-auto grid min-w-[320px] grid-cols-2 gap-2">
                <input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(event) => {
                    setLedgerQuickRange("custom");
                    setLedgerDateFrom(event.target.value);
                  }}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700"
                />
                <input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(event) => {
                    setLedgerQuickRange("custom");
                    setLedgerDateTo(event.target.value);
                  }}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3 text-right">Số dư đầu</th>
                <th className="px-4 py-3 text-right">POS/Payment</th>
                <th className="px-4 py-3 text-right">Phiếu thu</th>
                <th className="px-4 py-3 text-right">Phiếu chi</th>
                <th className="px-4 py-3 text-right">Thu - chi</th>
                <th className="px-4 py-3 text-right">Số dư cuối</th>
                <th className="px-4 py-3 text-right">
                  Tiền mặt còn tổng các chi nhánh
                </th>
                <th className="px-4 py-3 text-right">Thực đếm</th>
                <th className="px-4 py-3 text-right">Lệch</th>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {dailyLedgerRows.map((row) => {
                const hasCounted = row.countedRowCount > 0;
                const hasDifference = row.differenceRowCount > 0;
                const isExpanded = expandedLedgerDate === row.date;
                const detailRows = ledgerRowsByDate.get(row.date) || [];

                return (
                  <Fragment key={row.date}>
                    <tr
                      className={`cursor-pointer border-t border-neutral-100 align-top hover:bg-neutral-50 ${isExpanded ? "bg-neutral-50" : ""}`}
                      onClick={() =>
                        setExpandedLedgerDate(isExpanded ? "" : row.date)
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs">
                            {isExpanded ? "−" : "+"}
                          </span>
                          <span>{dateOnlyText(row.date)}</span>
                        </div>
                        <div className="mt-1 text-xs font-normal text-neutral-500">
                          Bấm để {isExpanded ? "thu gọn" : "xem chi tiết"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {currency(Number(row.openingBalance || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        +{currency(Number(row.posReceiptAmount || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        +{currency(Number(row.manualReceiptAmount || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-red-700">
                        -{currency(Number(row.manualPaymentAmount || 0))}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${Number(row.netAmount || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}
                      >
                        {currency(Number(row.netAmount || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold text-neutral-950">
                        {currency(Number(row.closingBalance || 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex rounded-xl bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                          {currency(Number(row.cashClosingBalance || 0))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasCounted
                          ? currency(Number(row.countedAmount || 0))
                          : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${differenceClass(row.differenceAmount)}`}
                      >
                        {hasDifference
                          ? currency(Number(row.differenceAmount || 0))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        <div className="grid w-[380px] max-w-full grid-cols-2 gap-2">
                          {(row.branchSummaries || [])
                            .slice(0, 4)
                            .map((branch: any) => (
                              <span
                                key={branch.branchName}
                                className="inline-flex min-h-[104px] flex-col justify-center rounded-3xl border border-neutral-950 bg-neutral-950 px-5 py-4 font-bold text-white shadow-lg"
                              >
                                <span className="text-xs uppercase tracking-wide text-white/70">
                                  {branch.branchName}
                                </span>
                                <span className="mt-1 text-base font-black">
                                  {currency(Number(branch.closingBalance || 0))}
                                </span>
                                <span className="mt-1 text-base font-black text-white/85">
                                  TM{" "}
                                  {currency(
                                    Number(branch.cashClosingBalance || 0),
                                  )}
                                </span>
                                {Number(branch.cashHandedOverAmount || 0) >
                                0 ? (
                                  <span className="mt-1 text-[11px] font-bold text-emerald-200">
                                    Admin đã nhận{" "}
                                    {currency(
                                      Number(branch.cashHandedOverAmount || 0),
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            ))}
                        </div>
                        <div className="mt-1 text-neutral-400">
                          {row.branchCount} chi nhánh · {row.sourceCount} nguồn
                          tiền · bấm dòng để xem chi tiết
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${ledgerStatusClass(row.status)}`}
                        >
                          {row.open > 0 ? "Cần chốt sổ" : "Đã chốt"}
                        </span>
                        {row.open > 0 ? (
                          <div className="mt-1 text-xs text-neutral-500">
                            Mở chi tiết để chốt từng quỹ
                          </div>
                        ) : null}
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="border-t border-neutral-100 bg-neutral-50/70">
                        <td colSpan={12} className="px-0 py-4">
                          <div className="bg-transparent">
                            <div className="flex flex-col gap-2 px-4 pb-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="text-sm font-bold text-neutral-950">
                                  Chi tiết ngày {dateOnlyText(row.date)}
                                </div>
                                <div className="mt-1 text-xs text-neutral-500">
                                  Mỗi dòng là một chi nhánh + một nguồn tiền.
                                  Chỉ mở ngày đang cần soi để màn không bị kéo
                                  dài.
                                </div>
                              </div>
                              <div className="text-xs font-semibold text-neutral-500">
                                {detailRows.length} dòng chi tiết
                              </div>
                            </div>

                            <div className="space-y-4 px-4">
                              {buildDetailGroups(detailRows).map((branchGroup: any) => {
                                const branchCloseableRows = branchGroup.rows.filter(
                                  (item: DailyLedgerRow) =>
                                    item.branchId &&
                                    item.paymentSourceId &&
                                    !item.isSyntheticLive,
                                );
                                const branchIsClosed =
                                  branchCloseableRows.length > 0 &&
                                  branchCloseableRows.every(
                                    (item: DailyLedgerRow) =>
                                      String(item.status || "").toUpperCase() === "LOCKED",
                                  );

                                return (
                                <div
                                  key={branchGroup.branchName}
                                  className="overflow-hidden rounded-3xl border border-neutral-900 bg-white shadow-sm"
                                >
                                  <div className="flex flex-col gap-3 bg-neutral-950 px-4 py-3 text-white md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-black uppercase tracking-wide">
                                        {branchGroup.branchName}
                                      </div>
                                      <div className="mt-1 text-xs text-white/60">
                                        {branchGroup.rows.length} nguồn tiền
                                        trong ngày
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2 text-xs">
                                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                                        <div className="text-white/50">
                                          Tổng thu
                                        </div>
                                        <div className="font-bold text-emerald-200">
                                          +{currency(branchGroup.totalReceipt)}
                                        </div>
                                      </div>
                                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                                        <div className="text-white/50">
                                          Tổng chi
                                        </div>
                                        <div className="font-bold text-red-200">
                                          -{currency(branchGroup.totalPayment)}
                                        </div>
                                      </div>
                                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                                        <div className="text-white/50">
                                          Số dư cuối
                                        </div>
                                        <div className="font-bold">
                                          {currency(branchGroup.closingBalance)}
                                        </div>
                                      </div>
                                      <div className="rounded-2xl bg-white px-3 py-2 text-neutral-950">
                                        <div className="text-neutral-500">
                                          Tiền mặt còn
                                        </div>
                                        <div className="font-black">
                                          {currency(
                                            branchGroup.cashClosingBalance,
                                          )}
                                        </div>
                                      </div>
                                      <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 ring-1 ring-emerald-300/20">
                                        <div className="text-emerald-100/70">
                                          Admin đã nhận
                                        </div>
                                        <div className="font-black text-emerald-100">
                                          {currency(
                                            branchGroup.cashHandedOverAmount ||
                                              0,
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={
                                          savingLedger ||
                                          branchIsClosed ||
                                          branchGroup.rows.every(
                                            (item: DailyLedgerRow) =>
                                              item.isSyntheticLive,
                                          )
                                        }
                                        onClick={() =>
                                          void closeBranchLedgerRows(
                                            branchGroup.branchName,
                                            branchGroup.rows,
                                          )
                                        }
                                        className={`rounded-2xl border px-4 py-3 text-xs font-black shadow-sm disabled:opacity-80 ${
                                          branchIsClosed
                                            ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-100"
                                            : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                                        }`}
                                      >
                                        {branchIsClosed ? "✓ Đã chốt sổ" : "Chốt sổ chi nhánh"}
                                      </button>
                                      {branchGroup.cashClosingBalance > 0 ? (
                                        <button
                                          type="button"
                                          disabled={savingLedger}
                                          onClick={() => {
                                            const cashRow =
                                              branchGroup.rows.find(
                                                (item: DailyLedgerRow) =>
                                                  isCashLedgerRow(item) &&
                                                  Number(
                                                    item.closingBalance || 0,
                                                  ) > 0,
                                              ) ||
                                              branchGroup.rows.find(
                                                (item: DailyLedgerRow) =>
                                                  isCashLedgerRow(item),
                                              );

                                            if (!cashRow) {
                                              setError(
                                                "Không tìm thấy nguồn tiền mặt của chi nhánh này.",
                                              );
                                              return;
                                            }

                                            setCashHandoverDialog({
                                              row: cashRow,
                                              amount: String(
                                                Math.round(
                                                  Number(
                                                    branchGroup.cashClosingBalance ||
                                                      0,
                                                  ),
                                                ),
                                              ),
                                              note: `Admin xác nhận nhận tiền mặt từ ${branchGroup.branchName} ngày ${dateOnlyText(row.date)}.`,
                                            });
                                          }}
                                          className="rounded-2xl border border-white/20 bg-white px-4 py-3 text-xs font-black text-neutral-950 shadow-sm hover:bg-neutral-100 disabled:opacity-50"
                                        >
                                          Admin nhận tiền mặt
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="min-w-[1180px] w-full text-xs">
                                      <thead className="bg-neutral-50 text-left uppercase tracking-wide text-neutral-500">
                                        <tr>
                                          <th className="px-3 py-2">
                                            Nguồn tiền
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Số dư đầu
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            POS/Payment
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Phiếu thu
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Phiếu chi
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Thu - chi
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Số dư cuối
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Thực đếm
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Lệch
                                          </th>
                                          <th className="px-3 py-2">
                                            Trạng thái
                                          </th>
                                          <th className="px-3 py-2 text-right">
                                            Thao tác
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {branchGroup.rows.map(
                                          (
                                            detailRow: DailyLedgerRow,
                                            index: number,
                                          ) => {
                                            const status = String(
                                              detailRow.status || "OPEN",
                                            ).toUpperCase();
                                            const isLocked =
                                              status === "LOCKED";
                                            const difference = Number(
                                              detailRow.differenceAmount || 0,
                                            );

                                            return (
                                              <tr
                                                key={`${detailRow.date}-${detailRow.branchId}-${detailRow.paymentSourceId}-${index}`}
                                                className="border-t border-neutral-100 align-top"
                                              >
                                                <td className="px-3 py-2">
                                                  <div className="font-semibold">
                                                    {detailRow.paymentSourceName ||
                                                      detailRow.paymentSourceCode ||
                                                      detailRow.paymentSourceId ||
                                                      "—"}
                                                  </div>
                                                  <div className="text-[11px] text-neutral-500">
                                                    {sourceKindLabel(
                                                      detailRow.sourceType ||
                                                        ledgerSourceKind(
                                                          detailRow,
                                                        ) ||
                                                        "—",
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  {currency(
                                                    Number(
                                                      detailRow.openingBalance ||
                                                        0,
                                                    ),
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right text-emerald-700">
                                                  +
                                                  {currency(
                                                    Number(
                                                      detailRow.posReceiptAmount ||
                                                        0,
                                                    ),
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right text-emerald-700">
                                                  +
                                                  {currency(
                                                    Number(
                                                      detailRow.manualReceiptAmount ||
                                                        0,
                                                    ),
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right text-red-700">
                                                  -
                                                  {currency(
                                                    Number(
                                                      detailRow.manualPaymentAmount ||
                                                        0,
                                                    ),
                                                  )}
                                                </td>
                                                <td
                                                  className={`px-3 py-2 text-right font-semibold ${Number(detailRow.netAmount || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}
                                                >
                                                  {currency(
                                                    Number(
                                                      detailRow.netAmount || 0,
                                                    ),
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-neutral-950">
                                                  {currency(
                                                    Number(
                                                      detailRow.closingBalance ||
                                                        0,
                                                    ),
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  {detailRow.countedAmount ===
                                                    null ||
                                                  detailRow.countedAmount ===
                                                    undefined
                                                    ? "—"
                                                    : currency(
                                                        Number(
                                                          detailRow.countedAmount ||
                                                            0,
                                                        ),
                                                      )}
                                                </td>
                                                <td
                                                  className={`px-3 py-2 text-right font-semibold ${differenceClass(difference)}`}
                                                >
                                                  {detailRow.differenceAmount ===
                                                    null ||
                                                  detailRow.differenceAmount ===
                                                    undefined
                                                    ? "—"
                                                    : currency(difference)}
                                                </td>
                                                <td className="px-3 py-2">
                                                  <span
                                                    className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${ledgerStatusClass(detailRow.status)}`}
                                                  >
                                                    {ledgerStatusLabel(
                                                      detailRow.status,
                                                    )}
                                                  </span>
                                                  {detailRow.lockedByName ? (
                                                    <div className="mt-1 text-[11px] text-neutral-500">
                                                      {detailRow.lockedByName}
                                                    </div>
                                                  ) : null}
                                                  {isCashLedgerRow(detailRow) &&
                                                  Number(
                                                    detailRow.manualPaymentAmount ||
                                                      0,
                                                  ) > 0 ? (
                                                    <div className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                      Admin đã nhận{" "}
                                                      {currency(
                                                        Number(
                                                          detailRow.manualPaymentAmount ||
                                                            0,
                                                        ),
                                                      )}
                                                    </div>
                                                  ) : null}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <div className="flex justify-end gap-2">
                                                    <button
                                                      type="button"
                                                      disabled={
                                                        savingLedger ||
                                                        detailRow.isSyntheticLive ||
                                                        isLocked
                                                      }
                                                      title={
                                                        detailRow.isSyntheticLive
                                                          ? "Dòng live lấy từ giao dịch mới phát sinh, tải lại sổ hoặc đổi ngày để chốt"
                                                          : undefined
                                                      }
                                                      onClick={(event) => {
                                                        event.stopPropagation();
                                                        setCloseDialog({
                                                          row: detailRow,
                                                          countedAmount: String(
                                                            Math.round(
                                                              Number(
                                                                detailRow.countedAmount ??
                                                                  detailRow.closingBalance ??
                                                                  0,
                                                              ),
                                                            ),
                                                          ),
                                                          note:
                                                            detailRow.note ||
                                                            "",
                                                        });
                                                      }}
                                                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold hover:bg-neutral-50 disabled:opacity-50"
                                                    >
                                                      {detailRow.isSyntheticLive
                                                        ? "Live"
                                                        : isLocked
                                                          ? "✓ Đã chốt"
                                                          : "Chốt sổ"}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={
                                                        !isLocked ||
                                                        savingLedger
                                                      }
                                                      onClick={(event) => {
                                                        event.stopPropagation();
                                                        void reopenLedgerDay(
                                                          detailRow,
                                                        );
                                                      }}
                                                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 disabled:opacity-40"
                                                    >
                                                      Mở lại
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          },
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}

              {!dailyLedgerRows.length ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-neutral-500"
                  >
                    Chưa có dữ liệu sổ ngày trong khoảng lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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

        <div className="border-b border-neutral-100 bg-neutral-50/60 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            Bộ lọc nhanh bảng giao dịch
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.4fr_180px_190px_190px_190px_180px_120px_120px_160px]">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tìm mã đơn, phiếu, khách, SĐT, chi nhánh, nguồn tiền, nhân viên, ghi chú..."
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            />
            <select
              value={transactionBranchFilter}
              onChange={(event) => setTransactionBranchFilter(event.target.value)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {transactionBranchOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <MultiSelectFilter
              values={transactionSourceFilters}
              options={transactionSourceOptions.map((name) => ({ value: name, label: name }))}
              allLabel="Tất cả nguồn tiền"
              selectedLabel={transactionSourceFilters.length ? `${transactionSourceFilters.length} nguồn đã chọn` : "Tất cả nguồn tiền"}
              onChange={setTransactionSourceFilters}
              className="h-10"
            />
            <select
              value={flow}
              onChange={(event) => setFlow(event.target.value as FlowFilter)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="ALL">Tất cả dòng tiền</option>
              <option value="RECEIPT">Tiền vào</option>
              <option value="PAYMENT">Tiền ra</option>
              <option value="POS">POS hoàn thành</option>
              <option value="TRANSFER">Chuyển khoản/cọc</option>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK">Ngân hàng</option>
              <option value="OTHER">Nguồn khác</option>
            </select>
            <select
              value={transactionStatusFilter}
              onChange={(event) => setTransactionStatusFilter(event.target.value)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {transactionStatusOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={staffFilter}
              onChange={(event) => setStaffFilter(event.target.value)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="ALL">Tất cả nhân viên</option>
              {staffOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={transactionTypeFilter}
              onChange={(event) => setTransactionTypeFilter(event.target.value)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="ALL">Tất cả loại</option>
              <option value="ORDER">Đơn hàng</option>
              <option value="VOUCHER">Phiếu thu/chi</option>
            </select>
            <input
              value={transactionAmountFrom}
              onChange={(event) => setTransactionAmountFrom(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="Từ tiền"
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            />
            <input
              value={transactionAmountTo}
              onChange={(event) => setTransactionAmountTo(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="Đến tiền"
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFlow("ALL");
                setStaffFilter("ALL");
                setTransactionBranchFilter("ALL");
                setTransactionSourceFilters([]);
                setTransactionStatusFilter("ALL");
                setTransactionTypeFilter("ALL");
                setTransactionAmountFrom("");
                setTransactionAmountTo("");
                setQ("");
              }}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold hover:bg-neutral-50"
            >
              Xoá lọc giao dịch
            </button>
          </div>
        </div>

        <div className="max-h-[620px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Nguồn tiền</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ghi chú</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.id || row.orderCode || index}`}
                  className="border-t border-neutral-100 align-top"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                    {timeText(row.paidAt || row.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <div>{row.voucherCode || row.orderCode || "—"}</div>
                    {row.voucherCode &&
                    row.orderCode &&
                    row.voucherCode !== row.orderCode ? (
                      <div className="text-xs font-normal text-neutral-400">
                        {row.orderCode}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.customerName || "—"}</div>
                    <div className="text-xs text-neutral-500">
                      {row.customerPhone || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {displayBranchName(row)}
                  </td>
                  <td className="px-4 py-3">{creatorName(row)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {displaySourceName(row)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {sourceKindLabel(sourceKind(row))}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${rowAmountSigned(row) >= 0 ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {rowAmountSigned(row) >= 0 ? "+" : "-"}
                    {currency(Math.abs(rowAmountSigned(row)))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${rowStatusClass(row)}`}
                    >
                      {rowStatusLabel(row)}
                    </span>
                  </td>
                  <td className="max-w-[460px] px-4 py-3 text-xs text-neutral-500">
                    {[row.title, row.category, row.note]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-neutral-500"
                  >
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "red" | "dark";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-700"
        : tone === "dark"
          ? "text-white"
          : "text-neutral-950";

  return (
    <div
      className={`rounded-2xl border p-4 ${tone === "dark" ? "border-neutral-950 bg-neutral-950" : "border-neutral-200 bg-white"}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${tone === "dark" ? "text-white/50" : "text-neutral-400"}`}
      >
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
        {label}
      </p>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
        {value}
      </div>
      {hint ? <p className="mt-2 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
