export type AppRole =
  | "owner"
  | "admin"
  | "branch-manager"
  | "fulltime"
  | "retail-staff"
  | "stock-auditor"
  | "stock-staff";

export type BranchId = "b1" | "b2" | "b3" | string;

export type PermissionKey =
  | "dashboard.view"
  | "orders.view"
  | "orders.create"
  | "orders.update_status"
  | "orders.cancel"
  | "orders.return"
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.price.edit"
  | "products.variant.create"
  | "products.status.edit"
  | "products.cost.view"
  | "products.delete"
  | "products.excel.export"
  | "products.excel.import"
  | "promotions.view"
  | "promotions.create"
  | "promotions.edit"
  | "promotions.activate"
  | "promotions.pause"
  | "inventory.view"
  | "inventory.logs.view"
  | "inventory.value.view"
  | "inventory.3d.view"
  | "inventory.excel.export"
  | "stocktake.view"
  | "stocktake.apply"
  | "permissions.view"
  | "reports.view"
  | "customers.view"
  | "customers.edit"
  | "customers.excel.export"
  | "orders.excel.export"
  | "system.manage"
  | "settings.payment_sources.view"
  | "settings.payment_sources.manage"
  | "reconciliation.view"
  | "reconciliation.manage"
  | "ai_content.view"
  | "shipments.cod.edit"
  | "autopilot.view";

export type ScopeType = "global" | "branch";

export type RoleDefinition = {
  id: AppRole;
  label: string;
  scope: ScopeType;
  permissions: PermissionKey[];
};

export type CurrentUserProfile = {
  id: string;
  code: string;
  name: string;
  role: AppRole;
  branchIds?: BranchId[];
  branchId?: string | null;
  branchName?: string | null;
  status?: "active" | "inactive";
};

export const BRANCH_LABELS: Record<string, string> = {
  b1: "Hoàn Kiếm",
  b2: "Hai Bà Trưng",
  b3: "Online Warehouse",
};

const GLOBAL_PERMISSIONS: PermissionKey[] = [
  "dashboard.view",

  "orders.view",
  "orders.create",
  "orders.update_status",
  "orders.cancel",
  "orders.return",
  "orders.excel.export",

  "products.view",
  "products.create",
  "products.edit",
  "products.price.edit",
  "products.variant.create",
  "products.status.edit",
  "products.cost.view",
  "products.delete",
  "products.excel.export",
  "products.excel.import",

  "promotions.view",
  "promotions.create",
  "promotions.edit",
  "promotions.activate",
  "promotions.pause",

  "inventory.view",
  "inventory.logs.view",
  "inventory.value.view",
  "inventory.3d.view",
  "inventory.excel.export",

  "stocktake.view",
  "stocktake.apply",

  "permissions.view",
  "reports.view",
  "customers.view",
  "customers.edit",
  "customers.excel.export",
  "system.manage",

  "settings.payment_sources.view",
  "settings.payment_sources.manage",

  "reconciliation.view",
  "reconciliation.manage",

  "ai_content.view",
  "autopilot.view",
  "shipments.cod.edit",
];

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  owner: {
    id: "owner",
    label: "Owner",
    scope: "global",
    permissions: GLOBAL_PERMISSIONS,
  },

  admin: {
    id: "admin",
    label: "Admin / Owner",
    scope: "global",
    permissions: GLOBAL_PERMISSIONS,
  },

  "branch-manager": {
    id: "branch-manager",
    label: "Quản lý chi nhánh",
    scope: "branch",
    permissions: [
      "dashboard.view",

      "orders.view",
      "orders.create",
      "orders.update_status",
      "orders.cancel",
      "orders.return",
      "orders.excel.export",

      "products.view",
      "products.create",
      "products.edit",
      "products.price.edit",
      "products.variant.create",
      "products.status.edit",
      "products.excel.export",

      "promotions.view",
      "promotions.create",
      "promotions.edit",
      "promotions.activate",
      "promotions.pause",

      "inventory.view",
      "inventory.logs.view",
      "inventory.excel.export",

      "stocktake.view",
      "stocktake.apply",

      "customers.view",
      "customers.edit",
      "ai_content.view",
      "shipments.cod.edit",
    ],
  },

  fulltime: {
    id: "fulltime",
    label: "Nhân viên fulltime",
    scope: "branch",
    permissions: [
      "orders.view",
      "orders.create",
      "orders.update_status",
      "orders.return",

      "products.view",
      "promotions.view",

      "inventory.view",
      "inventory.logs.view",
      "stocktake.view",

      "customers.view",
      "shipments.cod.edit",
    ],
  },

  "retail-staff": {
    id: "retail-staff",
    label: "Nhân viên bán lẻ",
    scope: "branch",
    permissions: [
      "orders.view",
      "orders.create",
      "orders.return",
      "products.view",
      "promotions.view",
      "inventory.view",
      "customers.view",
    ],
  },

  "stock-auditor": {
    id: "stock-auditor",
    label: "Nhân viên kiểm kho",
    scope: "branch",
    permissions: [
      "products.view",
      "inventory.view",
      "inventory.logs.view",
      "stocktake.view",
      "stocktake.apply",
    ],
  },

  "stock-staff": {
    id: "stock-staff",
    label: "Nhân viên kho",
    scope: "branch",
    permissions: [
      "products.view",
      "inventory.view",
      "inventory.logs.view",
      "stocktake.view",
      "stocktake.apply",
    ],
  },
};

export function getRoleLabel(role: AppRole | string | undefined) {
  if (!role) return "Unknown role";
  return ROLE_DEFINITIONS[role as AppRole]?.label || role;
}

export function hasPermission(
  role: AppRole | string | undefined,
  permission: PermissionKey,
) {
  if (!role) return false;
  const definition = ROLE_DEFINITIONS[role as AppRole];
  if (!definition) return false;
  return definition.permissions.includes(permission);
}

export function hasAnyPermission(
  role: AppRole | string | undefined,
  permissions: PermissionKey[],
) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function canViewProduct(role: AppRole | string | undefined) {
  return hasPermission(role, "products.view");
}

export function canEditProduct(role: AppRole | string | undefined) {
  return hasAnyPermission(role, [
    "products.create",
    "products.edit",
    "products.price.edit",
    "products.variant.create",
    "products.status.edit",
  ]);
}

export function canCreateProduct(role: AppRole | string | undefined) {
  return hasPermission(role, "products.create");
}

export function canEditProductPrice(role: AppRole | string | undefined) {
  return hasPermission(role, "products.price.edit");
}

export function canCreateProductVariant(role: AppRole | string | undefined) {
  return hasPermission(role, "products.variant.create");
}

export function canToggleProductStatus(role: AppRole | string | undefined) {
  return hasPermission(role, "products.status.edit");
}

export function canViewProductCost(role: AppRole | string | undefined) {
  return hasPermission(role, "products.cost.view");
}

export function canExportProductExcel(role: AppRole | string | undefined) {
  return hasPermission(role, "products.excel.export");
}

export function canImportProductExcel(role: AppRole | string | undefined) {
  return hasPermission(role, "products.excel.import");
}

export function canAccessBranch(
  user: CurrentUserProfile,
  branchId?: string | null,
) {
  if (!branchId) return true;

  const roleDefinition = ROLE_DEFINITIONS[user.role];
  if (!roleDefinition) return false;
  if (roleDefinition.scope === "global") return true;

  const branchIds = user.branchIds || [];
  if (branchIds.length) {
    return branchIds.includes(branchId);
  }

  return user.branchId === branchId || user.branchName === branchId;
}

export function getScopedBranchIds(user: CurrentUserProfile): BranchId[] {
  const roleDefinition = ROLE_DEFINITIONS[user.role];
  if (!roleDefinition) return [];

  if (roleDefinition.scope === "global") {
    return ["b1", "b2", "b3"];
  }

  return user.branchIds || [];
}

export function filterRowsByBranch<T extends { branchId?: string | null }>(
  user: CurrentUserProfile,
  rows: T[],
) {
  const roleDefinition = ROLE_DEFINITIONS[user.role];
  if (!roleDefinition) return [];
  if (roleDefinition.scope === "global") return rows;

  return rows.filter((row) => canAccessBranch(user, row.branchId));
}

export async function changeMyPassword(newPassword: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/me/password`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ newPassword }),
    },
  );

  if (!res.ok) throw new Error("Đổi mật khẩu thất bại");

  return res.json();
}
