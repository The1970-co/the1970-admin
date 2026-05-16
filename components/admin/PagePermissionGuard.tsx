"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { clearCurrentUserFromStorage } from "@/lib/current-user";
import { useAuth } from "@/components/admin/auth/AuthProvider";

type BranchPermissionRow = {
  branchId?: string | null;
  permissionKeys?: string[];
  extraPermissionKeys?: string[];
  deniedPermissionKeys?: string[];
  canView?: boolean;
  canSell?: boolean;
  canViewOwnOrders?: boolean;
  canViewBranchOrders?: boolean;
  canCreateOrder?: boolean;
  canApproveOrder?: boolean;
  canCancelOrder?: boolean;
  canHandleReturn?: boolean;
  canViewStock?: boolean;
  canManageStock?: boolean;
  canStocktake?: boolean;
  canTransferStock?: boolean;
  canReceiveStock?: boolean;
  canViewCustomer?: boolean;
  canEditCustomer?: boolean;
  canExportProductExcel?: boolean;
  canImportProductExcel?: boolean;
  canExportOrderExcel?: boolean;
  canExportInventoryExcel?: boolean;
  canExportCustomerExcel?: boolean;
};

const LEGACY_BRANCH_PERMISSION_MAP: Record<string, string[]> = {
  canView: ["products.view", "menu.products"],
  canSell: ["menu.pos"],
  canViewOwnOrders: ["orders.view_own", "menu.orders"],
  canViewBranchOrders: ["orders.view", "menu.orders"],
  canCreateOrder: ["orders.create", "menu.create_order"],
  canApproveOrder: ["orders.approve"],
  canCancelOrder: ["orders.cancel"],
  canHandleReturn: ["returns.view", "returns.create", "menu.returns"],
  canViewStock: ["inventory.view", "menu.inventory"],
  canManageStock: ["inventory.adjust", "inventory.transfer"],
  canStocktake: ["stocktake.view", "stocktake.scan", "menu.stocktake"],
  canTransferStock: ["stock_transfer.view", "stock_transfer.create", "menu.stock_transfer"],
  canReceiveStock: ["stock_transfer.receive", "purchase_receipt.import_stock"],
  canViewCustomer: ["customers.view_own"],
  canEditCustomer: ["customers.edit"],
  canExportProductExcel: ["products.excel.export"],
  canImportProductExcel: ["products.excel.import"],
  canExportOrderExcel: ["orders.excel.export"],
  canExportInventoryExcel: ["inventory.excel.audit"],
  canExportCustomerExcel: ["customers.view"],
};

function normalizeRole(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizeId(value: any) {
  return String(value || "").trim();
}

function isOwnerOrAdmin(user: any) {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .map(normalizeRole)
    .filter(Boolean);

  return roles.includes("owner") || roles.includes("admin");
}

function getWorkingBranchId(user: any) {
  return normalizeId(
    user?.workingBranchId ||
      user?.currentBranchId ||
      user?.branchId ||
      user?.activeBranchId,
  );
}

function getScopedBranchRows(user: any) {
  const rows: BranchPermissionRow[] = Array.isArray(user?.branchPermissions)
    ? user.branchPermissions
    : [];

  const workingBranchId = getWorkingBranchId(user);
  if (!workingBranchId) return rows;

  const scoped = rows.filter((row) => normalizeId(row?.branchId) === workingBranchId);
  return scoped.length ? scoped : rows;
}

function collectEffectivePermissions(user: any, authPermissions: string[]) {
  if (isOwnerOrAdmin(user)) return ["*"];

  const keys = new Set<string>();
  const denied = new Set<string>();

  authPermissions.forEach((key) => {
    if (key) keys.add(String(key));
  });

  const directArrays = [user?.permissions, user?.permissionKeys, user?.extraPermissionKeys];
  for (const arr of directArrays) {
    if (!Array.isArray(arr)) continue;
    arr.forEach((key) => {
      if (key) keys.add(String(key));
    });
  }

  for (const row of getScopedBranchRows(user)) {
    if (Array.isArray(row?.permissionKeys)) {
      row.permissionKeys.forEach((key) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray(row?.extraPermissionKeys)) {
      row.extraPermissionKeys.forEach((key) => {
        if (key) keys.add(String(key));
      });
    }

    for (const [legacyKey, mappedKeys] of Object.entries(LEGACY_BRANCH_PERMISSION_MAP)) {
      if ((row as any)?.[legacyKey]) {
        mappedKeys.forEach((key) => keys.add(key));
      }
    }

    if (Array.isArray(row?.deniedPermissionKeys)) {
      row.deniedPermissionKeys.forEach((key) => {
        if (key) denied.add(String(key));
      });
    }
  }

  denied.forEach((key) => keys.delete(key));
  return Array.from(keys);
}

export default function PagePermissionGuard({
  permission,
  permissions,
  fallbackPath = "/control",
  children,
}: {
  permission?: string;
  permissions?: string[];
  fallbackPath?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const auth = useAuth();

  const requiredPermissions = useMemo(() => {
    return Array.from(
      new Set([...(permissions || []), permission].filter(Boolean) as string[]),
    );
  }, [permission, permissions]);

  const effectivePermissions = useMemo(() => {
    return collectEffectivePermissions(auth.user, auth.permissions || []);
  }, [auth.user, auth.permissions]);

  const allowed = useMemo(() => {
    if (!requiredPermissions.length) return true;
    if (effectivePermissions.includes("*")) return true;
    return requiredPermissions.some((key) => effectivePermissions.includes(key));
  }, [effectivePermissions, requiredPermissions]);

  useEffect(() => {
    if (!auth.checked || auth.loading) return;

    if (!auth.user) {
      clearCurrentUserFromStorage();
      router.replace("/login");
      return;
    }

    if (!allowed) {
      router.replace(fallbackPath);
    }
  }, [allowed, auth.checked, auth.loading, auth.user, fallbackPath, router]);

  if (!auth.checked || auth.loading) {
    return <div style={{ padding: 40 }}>Đang đồng bộ quyền truy cập...</div>;
  }

  if (!auth.user || !allowed) {
    return <div style={{ padding: 40 }}>Đang chuyển hướng...</div>;
  }

  return <>{children}</>;
}
