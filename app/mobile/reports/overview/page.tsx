"use client";

import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Megaphone,
  RefreshCw,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";

type AnyObj = Record<string, any>;

type DashboardApi = {
  cards?: AnyObj;
  warRoom?: AnyObj;
  today?: AnyObj;
  dailyRows?: AnyObj[];
  revenueRows?: AnyObj[];
  rows?: AnyObj[];
};

const RANGE_OPTIONS = [
  { key: "today", label: "Hôm nay" },
  { key: "month", label: "Tháng này" },
] as const;

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

async function fetchJson<T>(path: string): Promise<T> {
  const accessToken = getToken();

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

  if (!res.ok) {
    throw new Error((await res.text()) || "Không tải được dữ liệu War Room.");
  }

  return res.json();
}

async function optionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(path);
  } catch {
    return fallback;
  }
}

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function todayInput() {
  return dateInput(new Date());
}

function monthStartInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function n(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = n(value);
    if (parsed !== 0) return parsed;
  }
  return 0;
}

function compact(value: unknown) {
  const amount = n(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;

  return `${sign}${new Intl.NumberFormat("vi-VN").format(Math.round(abs))}`;
}

function money(value: unknown) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n(value)))}đ`;
}

function count(value: unknown) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n(value)));
}

function getRows(data: DashboardApi | null) {
  return data?.dailyRows || data?.revenueRows || data?.rows || [];
}

function getRowValue(row: AnyObj, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return 0;
}

function TinyBar({ value, max }: { value: number; max: number }) {
  const width = Math.max(8, Math.min(100, Math.round((Math.abs(value) / Math.max(max, 1)) * 100)));
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-neutral-950" style={{ width: `${width}%` }} />
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  icon,
  dark = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div className={`${dark ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"} rounded-[1.75rem] p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs font-black uppercase tracking-[0.18em] ${dark ? "text-white/45" : "text-neutral-400"}`}>
            {label}
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${dark ? "bg-white text-neutral-950" : "bg-neutral-100"}`}>
          {icon}
        </div>
      </div>
      <div className={`mt-3 text-sm leading-5 ${dark ? "text-white/55" : "text-neutral-500"}`}>{sub}</div>
    </div>
  );
}

export default function MobileReportOverviewPage() {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("today");
  const [data, setData] = useState<DashboardApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const to = todayInput();
      const from = range === "month" ? monthStartInput() : to;

      const result = await optionalJson<DashboardApi>(
        `/dashboard/overview?range=${range}&from=${from}&to=${to}&branchId=all`,
        {},
      );

      setData(result);
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

  const model = useMemo(() => {
    const cards = data?.cards || {};
    const warRoom = data?.warRoom || {};
    const today = data?.today || {};
    const source = { ...cards, ...warRoom, ...today };

    const revenue = firstNumber(
      source.effectiveRevenue,
      source.todayEffectiveRevenue,
      source.completedRevenue,
      source.codSuccessRevenue,
      source.codDeliveredRevenue,
      source.revenueToday,
      source.revenue,
      source.totalRevenue,
    );

    const exportedOrders = firstNumber(
      source.effectiveOrders,
      source.exportedOrders,
      source.shippedOrders,
      source.sentToCarrierOrders,
      source.carrierCreatedOrders,
      source.posCompletedOrders,
      source.ordersToday,
      source.totalOrders,
    );

    const cancelledOrders = firstNumber(source.cancelledOrders, source.cancelOrders, source.canceledOrders);
    const effectiveOrders = Math.max(0, exportedOrders - cancelledOrders);

    const adsCost = firstNumber(source.adsCostToday, source.totalAdsCost, source.adsCost, source.adSpend, source.marketingCost);
    const cost = firstNumber(source.costToday, source.totalCost, source.cost, source.cogs, source.goodsCost);
    const profit = source.profit !== undefined && source.profit !== null
      ? n(source.profit)
      : revenue - adsCost - cost;

    return {
      revenue,
      exportedOrders,
      cancelledOrders,
      effectiveOrders,
      adsCost,
      cost,
      profit,
    };
  }, [data]);

  const rows = getRows(data);
  const maxRevenue = Math.max(
    ...rows.map((row) => n(getRowValue(row, ["revenue", "totalRevenue", "effectiveRevenue"]))),
    model.revenue,
    1,
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/mobile" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">War Room</div>
            <div className="text-lg font-black">Hiệu quả hôm nay</div>
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
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[1.75rem] bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
        ) : (
          <div className="space-y-4">
            <KPI
              dark
              label="Doanh thu hôm nay"
              value={compact(model.revenue)}
              sub="Đơn hoàn thành hôm nay + COD giao thành công"
              icon={<Wallet className="h-5 w-5" />}
            />

            <div className="grid grid-cols-2 gap-3">
              <KPI
                label="Đơn xuất kho"
                value={count(model.effectiveOrders)}
                sub="Gửi HVC + POS thành công - huỷ"
                icon={<Truck className="h-5 w-5" />}
              />

              <KPI
                label="Chi phí ads"
                value={compact(model.adsCost)}
                sub="Tiền quảng cáo trong ngày"
                icon={<Megaphone className="h-5 w-5" />}
              />

              <KPI
                label="Lợi nhuận"
                value={compact(model.profit)}
                sub="Doanh thu - ads - giá vốn"
                icon={<ShoppingBag className="h-5 w-5" />}
                dark
              />

              <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Giá vốn</div>
                <div className="mt-4 text-3xl font-black">{compact(model.cost)}</div>
                <div className="mt-3 text-sm text-neutral-500">Chỉ để tính lợi nhuận</div>
              </div>
            </div>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">Doanh thu 10 ngày gần nhất</h2>
                  <p className="mt-1 text-sm text-neutral-500">Bấm tháng này để xem rộng hơn.</p>
                </div>
                <CalendarDays className="h-5 w-5 text-neutral-400" />
              </div>

              <div className="space-y-3">
                {rows.length === 0 ? (
                  <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                    Chưa có bảng doanh thu ngày từ API mobile.
                  </div>
                ) : (
                  rows.slice(0, 10).map((row, index) => {
                    const revenue = getRowValue(row, ["revenue", "totalRevenue", "effectiveRevenue"]);
                    const cost = getRowValue(row, ["cost", "totalCost", "cogs"]);
                    const ads = getRowValue(row, ["adsCost", "totalAdsCost", "adSpend"]);
                    const profit = getRowValue(row, ["profit", "netProfit"]);
                    const orders = getRowValue(row, ["orders", "totalOrders", "effectiveOrders"]);

                    return (
                      <div key={`${row.day || row.date || index}`} className="rounded-2xl bg-neutral-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black">{row.note || row.date || `Ngày ${row.day || index + 1}`}</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {orders} đơn · vốn {typeof cost === "string" ? cost : compact(cost)} · ads {typeof ads === "string" ? ads : compact(ads)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black">{typeof revenue === "string" ? revenue : compact(revenue)}</div>
                            <div className="mt-1 text-xs text-emerald-700">Lãi {typeof profit === "string" ? profit : compact(profit)}</div>
                          </div>
                        </div>
                        <TinyBar value={n(revenue)} max={maxRevenue} />
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <Link href="/mobile/finance/daily" className="flex items-center justify-between rounded-[1.75rem] bg-white p-5 font-bold shadow-sm">
              <span>Mở tổng quan nguồn tiền</span>
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        )}

        <MobileBottomNav />
      </div>
    </div>
  );
}
