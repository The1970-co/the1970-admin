export type AppRole =
  | "owner"
  | "admin"
  | "branch-manager"
  | "fulltime"
  | "retail-staff"
  | "stock-auditor";

export type BranchId = "b1" | "b2" | "b3";

export type PermissionKey =
  | "dashboard.view"
  | "orders.view"
  | "orders.create"
  | "orders.update_status"
  | "orders.cancel"
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.price.edit"
  | "products.cost.view"
  | "products.delete"
  | "inventory.view"
  | "inventory.logs.view"
  | "inventory.value.view"
  | "stocktake.view"
  | "stocktake.apply"
  | "permissions.view"
  | "reports.view"
  | "customers.view"
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

export const BRANCH_LABELS: Record<BranchId, string> = {
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

  "products.view",
  "products.create",
  "products.edit",
  "products.price.edit",
  "products.cost.view",
  "products.delete",

  "inventory.view",
  "inventory.logs.view",
  "inventory.value.view",

  "stocktake.view",
  "stocktake.apply",

  "permissions.view",
  "reports.view",
  "customers.view",
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

      "products.view",
      "products.create",
      "products.edit",
      "products.price.edit",

      "inventory.view",
      "inventory.logs.view",

      "stocktake.view",
      "stocktake.apply",

      "reports.view",
      "customers.view",
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

      "products.view",
      "products.edit",
      "products.create",
      "inventory.view",
      "inventory.logs.view",

      "stocktake.view",

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
      "products.view",
      "inventory.view",
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
};

export function getRoleLabel(role: AppRole | string | undefined) {
  if (!role) return "Unknown role";
  return ROLE_DEFINITIONS[role as AppRole]?.label || role;
}

export function hasPermission(
  role: AppRole | string | undefined,
  permission: PermissionKey
) {
  if (!role) return false;
  const definition = ROLE_DEFINITIONS[role as AppRole];
  if (!definition) return false;
  return definition.permissions.includes(permission);
}

export function canAccessBranch(
  user: CurrentUserProfile,
  branchId?: string | null
) {
  if (!branchId) return true;

  const roleDefinition = ROLE_DEFINITIONS[user.role];
  if (!roleDefinition) return false;
  if (roleDefinition.scope === "global") return true;

  const branchIds = user.branchIds || [];
  if (branchIds.length) {
    return branchIds.includes(branchId as BranchId);
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
  rows: T[]
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
    }
  );

  if (!res.ok) throw new Error("Đổi mật khẩu thất bại");

  return res.json();
}