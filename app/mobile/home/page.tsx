"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import {
  AlertTriangle,
  ChevronDown,
  Package2,
  RefreshCw,
  ShoppingBag,
  User,
  Wallet,
} from "lucide-react";

type BranchOption = {
  id: string;
  name: string;
};

type HomeSummary = {
  revenueToday: number;
  ordersToday: number;
};

type HomeOrders = {
  NEW: number;
  APPROVED: number;
  PACKING: number;
  SHIPPED: number;
  COMPLETED: number;
  CANCELLED: number;
};

type HomeInventory = {
  lowStockCount: number;
  outOfStockCount: number;
};

type HomeTopProduct = {
  productName: string;
  qty: number;
  revenue: number;
};

type HomeFinance = {
  codPending: number;
  codReceivedToday: number;
};

type HomeResponse = {
  summary: HomeSummary;
  orders: HomeOrders;
  inventory: HomeInventory;
  topProducts: HomeTopProduct[];
  alerts: string[];
  finance?: HomeFinance;
};

function getTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token = getTokenFromStorage();

  if (!token) {
    window.location.href = "/mobile/login";
    throw new Error("Thiếu token đăng nhập.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/mobile/login";
    throw new Error("Phiên đăng nhập hết hạn.");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

function formatCompactMoney(value: number): string {
  if (!value) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div>
      {subtitle ? <div className="mt-1 text-sm text-neutral-500">{subtitle}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function LoadingCard() {
  return <div className="h-28 animate-pulse rounded-3xl bg-white" />;
}

export default function MobileHomePage() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState<string>("all");
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [profileName, setProfileName] = useState<string>("The 1970");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBranchName = useMemo(() => {
    return branches.find((b) => b.id === branchId)?.name || "Tất cả chi nhánh";
  }, [branches, branchId]);

  const loadData = useCallback(
    async (nextBranchId?: string, silent = false) => {
      const activeBranchId = nextBranchId ?? branchId;

      try {
        if (!silent) setLoading(true);
        if (silent) setRefreshing(true);
        setError(null);

        const [branchRes, profileRes, homeRes] = await Promise.all([
          fetchWithAuth<BranchOption[]>("/mobile/branches"),
          fetchWithAuth<{ name?: string }>("/mobile/profile"),
          fetchWithAuth<HomeResponse>(
            `/mobile/home?branchId=${encodeURIComponent(activeBranchId)}`
          ),
        ]);

        setBranches(branchRes);
        setProfileName(profileRes?.name || "The 1970");
        setHome(homeRes);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Có lỗi xảy ra khi tải dữ liệu."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId]
  );

  useEffect(() => {
    void loadData(branchId);
  }, [branchId, loadData]);

  const orderBlocks = [
    { label: "Mới", value: home?.orders.NEW ?? 0, status: "NEW" },
    { label: "Đã duyệt", value: home?.orders.APPROVED ?? 0, status: "APPROVED" },
    { label: "Đóng gói", value: home?.orders.PACKING ?? 0, status: "PACKING" },
    { label: "Đang giao", value: home?.orders.SHIPPED ?? 0, status: "SHIPPED" },
  ];

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-neutral-100">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="px-4 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-neutral-500">The 1970 Operations</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-neutral-950">
                  <User className="h-4 w-4" />
                  <span>{profileName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadData(branchId, true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm"
                aria-label="Tải lại"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-10 text-sm font-medium text-neutral-900 outline-none ring-0"
                >
                  <option value="all">Tất cả chi nhánh</option>
                  {branches
                    .filter((branch) => branch.id !== "all")
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-4 px-4 py-4 pb-24">
          {loading ? (
            <div className="space-y-4">
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : home ? (
            <>
              <SectionCard
                title="Tổng quan hôm nay"
                action={<span className="text-xs text-neutral-500">{selectedBranchName}</span>}
              >
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    title="Doanh thu"
                    value={formatCurrency(home.summary.revenueToday)}
                    subtitle="VND"
                  />
                  <StatCard
                    title="Số đơn"
                    value={String(home.summary.ordersToday)}
                    subtitle="Đơn hoàn thành hôm nay"
                  />
                </div>
              </SectionCard>

              <div className="grid grid-cols-4 gap-3">
                <Link href="/mobile/orders" className="rounded-2xl bg-white p-4 text-center shadow-sm active:scale-[0.98] transition">
                  <div className="text-2xl">📦</div>
                  <div className="mt-2 text-xs font-medium text-neutral-700">Đơn hàng</div>
                </Link>
                <Link href="/mobile/inventory" className="rounded-2xl bg-white p-4 text-center shadow-sm active:scale-[0.98] transition">
                  <div className="text-2xl">🏪</div>
                  <div className="mt-2 text-xs font-medium text-neutral-700">Tồn kho</div>
                </Link>
                <Link href="/mobile/reports" className="rounded-2xl bg-white p-4 text-center shadow-sm active:scale-[0.98] transition">
                  <div className="text-2xl">📊</div>
                  <div className="mt-2 text-xs font-medium text-neutral-700">Báo cáo</div>
                </Link>
                <Link href="/mobile/profile" className="rounded-2xl bg-white p-4 text-center shadow-sm active:scale-[0.98] transition">
                  <div className="text-2xl">👤</div>
                  <div className="mt-2 text-xs font-medium text-neutral-700">Cá nhân</div>
                </Link>
              </div>

              <SectionCard title="Đơn hàng chờ xử lý">
                <div className="grid grid-cols-2 gap-3">
                  {orderBlocks.map((item) => (
                    <Link
                      key={item.label}
                      href={`/mobile/orders?status=${item.status}`}
                      className="block rounded-2xl bg-neutral-50 p-3 active:scale-[0.98] transition"
                    >
                      <div className="text-sm text-neutral-500">{item.label}</div>
                      <div className="mt-1 text-2xl font-bold text-neutral-950">
                        {item.value}
                      </div>
                    </Link>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Tồn kho">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                      <AlertTriangle className="h-4 w-4" /> Sắp hết hàng
                    </div>
                    <div className="mt-2 text-3xl font-bold text-amber-950">
                      {home.inventory.lowStockCount}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-rose-700">
                      <Package2 className="h-4 w-4" /> Hết hàng
                    </div>
                    <div className="mt-2 text-3xl font-bold text-rose-950">
                      {home.inventory.outOfStockCount}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href="/mobile/reports/low-stock"
                    className="flex-1 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-center text-sm font-medium text-neutral-800"
                  >
                    Xem sắp hết
                  </Link>
                  <Link
                    href="/mobile/reports/out-of-stock"
                    className="flex-1 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-center text-sm font-medium text-neutral-800"
                  >
                    Xem hết hàng
                  </Link>
                </div>
              </SectionCard>

              <SectionCard title="Tài chính">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                      <Wallet className="h-4 w-4" /> COD pending
                    </div>
                    <div className="mt-2 text-xl font-bold text-blue-950">
                      {formatCompactMoney(home.finance?.codPending ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <Wallet className="h-4 w-4" /> COD hôm nay
                    </div>
                    <div className="mt-2 text-xl font-bold text-emerald-950">
                      {formatCompactMoney(home.finance?.codReceivedToday ?? 0)}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Top sản phẩm">
                <div className="space-y-3">
                  {home.topProducts.length === 0 ? (
                    <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                      Chưa có dữ liệu sản phẩm bán chạy.
                    </div>
                  ) : (
                    home.topProducts.map((item, index) => (
                      <div
                        key={`${item.productName}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm text-neutral-500">
                            <ShoppingBag className="h-4 w-4" /> Top {index + 1}
                          </div>
                          <div className="mt-1 truncate font-medium text-neutral-950">
                            {item.productName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-neutral-950">
                            {item.qty} sp
                          </div>
                          <div className="text-xs text-neutral-500">
                            {formatCompactMoney(item.revenue)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Cảnh báo nổi bật">
                <div className="space-y-2">
                  {home.alerts.length === 0 ? (
                    <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                      Không có cảnh báo mới.
                    </div>
                  ) : (
                    home.alerts.map((alert, index) => (
                      <div
                        key={`${alert}-${index}`}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
                      >
                        {alert}
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </>
          ) : null}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
