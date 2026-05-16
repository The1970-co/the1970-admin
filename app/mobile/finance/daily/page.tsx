"use client";

import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
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
  posAmount?: number;
  bankAmount?: number;
  cashAmount?: number;
  cashRemain?: number;
  cashOnHand?: number;
  endBalance?: number;
  endingBalance?: number;
  transactionCount?: number;
  totalDifference?: number;
  sources?: AnyRow[];
  sourceRows?: AnyRow[];
  branches?: AnyRow[];
  branchRows?: AnyRow[];
  dailyRows?: AnyRow[];
  closeRows?: AnyRow[];
};

const RANGE_OPTIONS = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
] as const;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

async function getJson<T>(path: string): Promise<T> {
  const accessToken = token();

  if (!accessToken) {
    window.location.href = "/mobile/login";
    throw new Error("Thiếu token đăng nhập.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/mobile/login";
    throw new Error("Phiên đăng nhập hết hạn.");
  }

  if (!res.ok) throw new Error((await res.text()) || "Không tải được tổng quan nguồn tiền.");
  return res.json();
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

function rangeDates(range: string) {
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

function buildSources(summary: FinanceSummary | null, rows: AnyRow[]) {
  const apiRows = summary?.sources || summary?.sourceRows || [];
  if (apiRows.length) return apiRows;

  const map = new Map<string, AnyRow>();

  rows.forEach((row) => {
    const key = sourceName(row);
    const current = map.get(key) || {
      sourceName: key,
      sourceType: sourceKind(row),
      totalIn: 0,
      totalOut: 0,
      netAmount: 0,
      transactionCount: 0,
    };

    const amount = Math.abs(num(row.amount));
    if (isReceipt(row)) current.totalIn += amount;
    else current.totalOut += amount;

    current.netAmount = current.totalIn - current.totalOut;
    current.transactionCount += 1;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => Math.abs(num(b.netAmount)) - Math.abs(num(a.netAmount)));
}

function buildBranches(summary: FinanceSummary | null, rows: AnyRow[]) {
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

    const amount = Math.abs(num(row.amount));
    if (isReceipt(row)) current.totalIn += amount;
    else current.totalOut += amount;

    if (sourceKind(row) === "CASH") current.cashRemain += isReceipt(row) ? amount : -amount;

    current.netAmount = current.totalIn - current.totalOut;
    current.transactionCount += 1;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => num(b.netAmount) - num(a.netAmount));
}

function buildDailyRows(summary: FinanceSummary | null, rows: AnyRow[]) {
  const apiRows = summary?.dailyRows || summary?.closeRows || [];
  if (apiRows.length) return apiRows;

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
      <div className={`mt-3 text-2xl font-black tracking-tight ${danger ? "text-rose-600" : ""}`}>{value}</div>
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

export default function MobileFinanceDailyPage() {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("today");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [rows, setRows] = useState<AnyRow[]>([]);
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

      const { from, to } = rangeDates(range);

      const [summaryRes, rowsRes] = await Promise.all([
        optionalJson<FinanceSummary>(`/finance/daily?from=${from}&to=${to}&branchId=all&paymentSourceId=all`, {}),
        optionalJson<AnyRow[]>(`/finance/daily/rows?from=${from}&to=${to}&branchId=all&paymentSourceId=all`, []),
      ]);

      setSummary(summaryRes);
      setRows(Array.isArray(rowsRes) ? rowsRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(() => buildSources(summary, rows), [summary, rows]);
  const branches = useMemo(() => buildBranches(summary, rows), [summary, rows]);
  const dailyRows = useMemo(() => buildDailyRows(summary, rows), [summary, rows]);

  const computed = useMemo(() => {
    const totalIn = firstNumber(summary?.totalIn, sources.reduce((s, row) => s + num(row.totalIn), 0));
    const totalOut = firstNumber(summary?.totalOut, sources.reduce((s, row) => s + num(row.totalOut), 0));
    const netAmount = firstNumber(summary?.netAmount, totalIn - totalOut);
    const posAmount = firstNumber(summary?.posAmount, rows.filter(isReceipt).reduce((s, row) => s + Math.abs(num(row.amount)), 0));
    const bankAmount = firstNumber(
      summary?.bankAmount,
      sources
        .filter((row) => ["BANK", "CARD"].includes(String(row.sourceType || sourceKind(row)).toUpperCase()))
        .reduce((s, row) => s + num(row.netAmount), 0),
    );
    const cashRemain = firstNumber(
      summary?.cashRemain,
      summary?.cashOnHand,
      summary?.cashAmount,
      branches.reduce((s, row) => s + firstNumber(row.cashRemain, row.cashOnHand, row.netAmount), 0),
    );

    return {
      totalIn,
      totalOut,
      netAmount,
      posAmount,
      bankAmount,
      cashRemain,
      transactionCount: firstNumber(summary?.transactionCount, rows.length),
      endBalance: firstNumber(summary?.endingBalance, summary?.endBalance, netAmount),
      totalDifference: firstNumber(summary?.totalDifference),
    };
  }, [summary, sources, rows, branches]);

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

  const maxSource = Math.max(...sources.map((row) => Math.abs(num(row.netAmount))), 1);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
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

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[1.75rem] bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl shadow-neutral-300">
              <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">Số dư ròng</div>
                    <div className="mt-3 text-5xl font-black tracking-tight">{compact(computed.netAmount)}</div>
                    <div className="mt-2 text-sm text-white/55">Tiền vào - tiền ra trong khoảng lọc</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-950">
                    <WalletCards className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-white/45">Tiền vào</div>
                    <div className="mt-1 text-lg font-black">{compact(computed.totalIn)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-white/45">Tiền ra</div>
                    <div className="mt-1 text-lg font-black">{compact(computed.totalOut)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-white/45">Giao dịch</div>
                    <div className="mt-1 text-lg font-black">{computed.transactionCount}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard title="POS hoàn thành" value={compact(computed.posAmount)} sub="Đơn POS/payment" />
              <StatCard title="CK / Cọc" value={compact(computed.bankAmount)} sub="Nguồn ngân hàng / card" />
              <StatCard title="Tiền mặt còn" value={compact(computed.cashRemain)} sub="Tổng tiền mặt cửa hàng" dark />
              <StatCard title="Tổng lệch" value={money(computed.totalDifference)} sub="Thực đếm - số dư" danger={computed.totalDifference !== 0} />
            </div>

            <Section title="Nguồn tiền" sub="Giống bảng tổng quan theo nguồn tiền trên web." count={`${sources.length} nguồn`}>
              <div className="space-y-3">
                {sources.length === 0 ? (
                  <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có dữ liệu nguồn tiền.</div>
                ) : (
                  sources.slice(0, 14).map((source, index) => {
                    const totalIn = firstNumber(source.totalIn, source.inAmount, source.receiptAmount, source.posAmount);
                    const totalOut = firstNumber(source.totalOut, source.outAmount, source.paymentAmount);
                    const netAmount = firstNumber(source.netAmount, totalIn - totalOut);

                    return (
                      <div key={`${sourceName(source)}-${index}`} className="rounded-2xl bg-neutral-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black">{sourceName(source)}</div>
                            <div className="mt-1 text-xs text-neutral-500">{source.sourceType || sourceKind(source)} · {source.transactionCount || source.count || 0} GD</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black">{money(netAmount)}</div>
                            <div className="mt-1 text-[11px] text-neutral-500">Vào {compact(totalIn)} · Ra {compact(totalOut)}</div>
                          </div>
                        </div>
                        <RatioBar value={netAmount} max={maxSource} />
                      </div>
                    );
                  })
                )}
              </div>
            </Section>

            <Section title="Tỷ lệ theo nguồn tiền" sub="Nguồn nào đang chiếm tỷ trọng lớn nhất.">
              <div className="space-y-3">
                {sources.slice(0, 8).map((source, index) => {
                  const netAmount = Math.abs(firstNumber(source.netAmount, num(source.totalIn) - num(source.totalOut)));
                  const percent = Math.round((netAmount / Math.max(maxSource, 1)) * 100);

                  return (
                    <div key={`${sourceName(source)}-ratio-${index}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-black">{sourceName(source)}</span>
                        <span className="text-neutral-400">{percent}%</span>
                      </div>
                      <RatioBar value={netAmount} max={maxSource} />
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Theo chi nhánh" sub="Tách dòng tiền theo từng cửa hàng để chốt quỹ cuối ngày." count={`${branches.length} chi nhánh`}>
              <div className="grid grid-cols-2 gap-3">
                {branches.length === 0 ? (
                  <div className="col-span-2 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Chưa có dữ liệu theo chi nhánh.</div>
                ) : (
                  branches.map((branch, index) => (
                    <div key={`${branchName(branch)}-${index}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                      <div className="text-xs font-black uppercase text-neutral-600">{branchName(branch)}</div>
                      <div className="mt-3 text-2xl font-black">{money(firstNumber(branch.netAmount, branch.totalIn))}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
                        <div>Thu: {compact(branch.totalIn)}</div>
                        <div>Chi: {compact(branch.totalOut)}</div>
                      </div>
                      <div className="mt-2 text-xs text-neutral-500">{branch.transactionCount || branch.count || 0} giao dịch</div>
                    </div>
                  ))
                )}
              </div>
            </Section>

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
                                POS {money(row.posAmount)} · Phiếu thu {money(row.receiptAmount || row.totalIn)} · Phiếu chi {money(row.paymentAmount || row.totalOut)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black">{money(row.netAmount)}</div>
                              <div className="mt-1 text-xs text-neutral-500">TM {money(row.cashRemain)}</div>
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

            <Link href="/mobile/reports/overview" className="flex items-center justify-between rounded-[1.75rem] bg-white p-5 font-bold shadow-sm">
              <span>Mở War Room báo cáo</span>
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        )}

        <MobileBottomNav />
      </div>
    </div>
  );
}
