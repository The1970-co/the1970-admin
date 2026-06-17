"use client";

import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ALLOWED_PREFIXES = ["/mobile/stocktake", "/mobile/profile", "/mobile/account", "/mobile/login"];

function rolesOf(user: any) {
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
  const roles = rolesOf(user);
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

  const roleText = rolesOf(user).join(" ");
  return (hasStocktake && !hasOtherMobileArea) || roleText.includes("stocktake") || roleText.includes("kiemkho") || roleText.includes("kiểm kho");
}

export default function MobileStocktakeOnlyGuard() {
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    if (!pathname.startsWith("/mobile")) return;
    const user = getCurrentUserFromStorage();
    if (!isStocktakeOnlyUser(user)) return;

    const allowed = pathname === "/mobile" || ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (pathname === "/mobile") {
      router.replace("/mobile/stocktake");
      return;
    }
    if (!allowed) {
      router.replace("/mobile/stocktake");
    }
  }, [pathname, router]);

  return null;
}
