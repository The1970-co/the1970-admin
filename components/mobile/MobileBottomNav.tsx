"use client";

import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import { BarChart3, ClipboardCheck, ClipboardList, Home, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

const FULL_NAV_ITEMS = [
  { label: "Home", href: "/mobile", icon: Home, match: ["/mobile"] },
  { label: "Báo cáo", href: "/mobile/reports/overview", icon: BarChart3, match: ["/mobile/reports"] },
  { label: "Đơn", href: "/mobile/orders", icon: ShoppingBag, match: ["/mobile/orders"] },
  { label: "Kiểm", href: "/mobile/stocktake", icon: ClipboardCheck, match: ["/mobile/stocktake"] },
  { label: "Lịch sử", href: "/mobile/stocktake-history", icon: ClipboardList, match: ["/mobile/stocktake-history"] },
  { label: "Tôi", href: "/mobile/profile", icon: User, match: ["/mobile/profile", "/mobile/account"] },
];

const STOCKTAKE_ONLY_NAV_ITEMS = [
  { label: "Kiểm", href: "/mobile/stocktake", icon: ClipboardCheck, match: ["/mobile/stocktake", "/mobile"] },
  { label: "Lịch sử", href: "/mobile/stocktake-history", icon: ClipboardList, match: ["/mobile/stocktake-history"] },
  { label: "Tôi", href: "/mobile/profile", icon: User, match: ["/mobile/profile", "/mobile/account"] },
];

function roleOf(user: any) {
  return [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
    user?.roleCode,
    user?.staffRole,
  ]
    .map((item) => String(item || "").toLowerCase())
    .filter(Boolean);
}

function isOwnerOrAdmin(user: any) {
  const roles = roleOf(user);
  return roles.includes("owner") || roles.includes("admin");
}

function hasAny(keys: string[], candidates: string[]) {
  return candidates.some((key) => keys.includes(key));
}

function isStocktakeOnlyUser(user: any) {
  if (!user || isOwnerOrAdmin(user)) return false;
  const keys = getCurrentUserPermissions(user, user?.activeBranchId || user?.branchId);
  if (keys.includes("*")) return false;

  const hasStocktake = hasAny(keys, [
    "stocktake.view",
    "stocktake.scan",
    "stocktake.create",
    "stocktake.apply",
    "stocktake.edit",
    "inventory.stocktake",
  ]);

  const hasOtherMobileArea = hasAny(keys, [
    "dashboard.view",
    "reports.view",
    "orders.view",
    "orders.create",
    "finance.view",
    "cash_voucher.view",
    "products.view",
    "inventory.view",
    "marketing.view",
  ]);

  const roles = roleOf(user).join(" ");
  return (hasStocktake && !hasOtherMobileArea) || roles.includes("stocktake") || roles.includes("kiemkho") || roles.includes("kiểm kho");
}

function isActive(pathname: string, item: (typeof FULL_NAV_ITEMS)[number]) {
  if (item.href === "/mobile") return pathname === "/mobile" || pathname === "/mobile/home";
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "";
  const user = typeof window === "undefined" ? null : getCurrentUserFromStorage();
  const stocktakeOnly = useMemo(() => isStocktakeOnlyUser(user), [user]);
  const items = stocktakeOnly ? STOCKTAKE_ONLY_NAV_ITEMS : FULL_NAV_ITEMS;
  const gridCols = stocktakeOnly ? "grid-cols-3" : "grid-cols-6";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className={`mx-auto grid max-w-md ${gridCols} gap-1 rounded-[1.5rem] bg-neutral-100 p-1`}>
        {items.map((item) => {
          const active = isActive(pathname, item as any);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[54px] flex-col items-center justify-center rounded-[1.15rem] px-0.5 text-[10px] font-bold transition active:scale-[0.96] ${
                active ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-500"
              }`}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
