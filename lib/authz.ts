export type AppRole =
  | "owner"
  | "admin"
  | "branch-manager"
  | "fulltime"
  | "retail-staff"
  | "stock-auditor"
  | "stock-staff"
  | (string & {});

export type BranchId = string;
export type PermissionKey = string;

export type CurrentUserProfile = {
  id?: string;
  code?: string;
  name?: string;
  role?: AppRole | string;
  roles?: string[];
  branchId?: string | null;
  branchName?: string | null;
  branchIds?: BranchId[];
  permissions?: string[];
  permissionKeys?: string[];
  branchPermissions?: Array<Record<string, any>>;
  branchRoles?: Array<Record<string, any>>;
  status?: "active" | "inactive";
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin / Owner",
  "branch-manager": "Quản lý chi nhánh",
  fulltime: "Nhân viên fulltime",
  "retail-staff": "Nhân viên bán lẻ",
  "stock-auditor": "Nhân viên kiểm kho",
  "stock-staff": "Nhân viên kho",
};

export const BRANCH_LABELS: Record<string, string> = {
  b1: "Hoàn Kiếm",
  b2: "Hai Bà Trưng",
  b3: "Online Warehouse",
};

const LEGACY_BOOLEAN_PERMISSION_MAP: Record<string, string[]> = {
  canView: ["products.view"],
  canSell: ["orders.create", "pos.access"],
  canViewOwnOrders: ["orders.view_own"],
  canViewBranchOrders: ["orders.view_branch", "orders.view"],
  canCreateOrder: ["orders.create"],
  canApproveOrder: ["orders.approve", "orders.update_status"],
  canCancelOrder: ["orders.cancel"],
  canHandleReturn: ["returns.view", "returns.create", "orders.return"],
  canViewStock: ["inventory.view"],
  canManageStock: ["inventory.manage"],
  canStocktake: ["stocktake.view", "stocktake.create"],
  canTransferStock: ["stock_transfer.view", "stock_transfer.create"],
  canReceiveStock: ["purchase_receipt.view", "purchase_receipt.receive"],
  canViewCustomer: ["customers.view"],
  canEditCustomer: ["customers.edit"],
  canExportProductExcel: ["products.excel.export"],
  canImportProductExcel: ["products.excel.import"],
  canExportOrderExcel: ["orders.excel.export"],
  canExportInventoryExcel: ["inventory.excel.export"],
  canExportCustomerExcel: ["customers.excel.export"],
  canViewReport: ["reports.view"],
  canViewMoney: ["inventory.value.view", "finance.view"],
};

// Bridge cho các page cũ vẫn truyền role string vào hasPermission().
// Runtime mới phải truyền currentUser object để đọc permissions từ DB.
const LEGACY_ROLE_FALLBACK: Record<string, string[]> = {
  owner: ["*"],
  admin: ["*"],
  "branch-manager": [
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
    "shipments.cod.edit",
  ],
  fulltime: [
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
  "retail-staff": [
    "orders.view",
    "orders.create",
    "orders.return",
    "products.view",
    "promotions.view",
    "inventory.view",
    "customers.view",
  ],
  "stock-auditor": [
    "products.view",
    "inventory.view",
    "inventory.logs.view",
    "stocktake.view",
    "stocktake.apply",
  ],
  "stock-staff": [
    "products.view",
    "inventory.view",
    "inventory.logs.view",
    "stocktake.view",
    "stocktake.apply",
  ],
};

function unique(values: unknown[]) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

function roleCodes(user?: CurrentUserProfile | null) {
  return unique([...(Array.isArray(user?.roles) ? user!.roles! : []), user?.role]).map((role) => role.toLowerCase());
}

export function isOwnerOrAdmin(user?: CurrentUserProfile | string | null) {
  if (!user) return false;
  if (typeof user === "string") return user === "owner" || user === "admin";
  return roleCodes(user).some((role) => role === "owner" || role === "admin");
}

export function getUserPermissions(user?: CurrentUserProfile | string | null) {
  if (!user) return [];

  if (typeof user === "string") {
    return LEGACY_ROLE_FALLBACK[user] || [];
  }

  const permissions: string[] = [];

  if (isOwnerOrAdmin(user)) permissions.push("*");

  if (Array.isArray(user.permissions)) permissions.push(...user.permissions);
  if (Array.isArray(user.permissionKeys)) permissions.push(...user.permissionKeys);

  const branchPermissions = Array.isArray(user.branchPermissions)
    ? user.branchPermissions
    : [];

  for (const row of branchPermissions) {
    if (Array.isArray(row?.permissionKeys)) permissions.push(...row.permissionKeys);

    for (const [field, permissionKeys] of Object.entries(LEGACY_BOOLEAN_PERMISSION_MAP)) {
      if (row?.[field]) permissions.push(...permissionKeys);
    }
  }

  return unique(permissions);
}

export function getRoleLabel(role: AppRole | string | undefined) {
  if (!role) return "Unknown role";
  return ROLE_LABELS[String(role)] || String(role);
}

export function hasPermission(
  userOrRole: CurrentUserProfile | AppRole | string | undefined | null,
  permission: PermissionKey,
) {
  if (!userOrRole || !permission) return false;
  const permissions = getUserPermissions(userOrRole as any);
  return permissions.includes("*") || permissions.includes(permission);
}

export function hasAnyPermission(
  userOrRole: CurrentUserProfile | AppRole | string | undefined | null,
  permissions: PermissionKey[],
) {
  return permissions.some((permission) => hasPermission(userOrRole, permission));
}

export function canViewProduct(userOrRole: any) {
  return hasPermission(userOrRole, "products.view");
}

export function canEditProduct(userOrRole: any) {
  return hasAnyPermission(userOrRole, [
    "products.create",
    "products.edit",
    "products.price.edit",
    "products.variant.create",
    "products.status.edit",
  ]);
}

export function canCreateProduct(userOrRole: any) {
  return hasPermission(userOrRole, "products.create");
}

export function canEditProductPrice(userOrRole: any) {
  return hasPermission(userOrRole, "products.price.edit");
}

export function canCreateProductVariant(userOrRole: any) {
  return hasPermission(userOrRole, "products.variant.create");
}

export function canToggleProductStatus(userOrRole: any) {
  return hasPermission(userOrRole, "products.status.edit");
}

export function canViewProductCost(userOrRole: any) {
  return hasPermission(userOrRole, "products.cost.view");
}

export function canExportProductExcel(userOrRole: any) {
  return hasPermission(userOrRole, "products.excel.export");
}

export function canImportProductExcel(userOrRole: any) {
  return hasPermission(userOrRole, "products.excel.import");
}

export function canAccessBranch(user: CurrentUserProfile, branchId?: string | null) {
  if (!branchId) return true;
  if (isOwnerOrAdmin(user)) return true;

  const branchIds = user.branchIds || [];
  if (branchIds.length) return branchIds.includes(branchId);

  const permissionRows = Array.isArray(user.branchPermissions) ? user.branchPermissions : [];
  if (permissionRows.some((row) => row?.branchId === branchId)) return true;

  return user.branchId === branchId || user.branchName === branchId;
}

export function getScopedBranchIds(user: CurrentUserProfile): BranchId[] {
  if (isOwnerOrAdmin(user)) return ["b1", "b2", "b3"];

  if (Array.isArray(user.branchIds) && user.branchIds.length) return user.branchIds;

  const rows = Array.isArray(user.branchPermissions) ? user.branchPermissions : [];
  const ids = unique(rows.map((row) => row?.branchId));
  if (ids.length) return ids;

  return user.branchId ? [user.branchId] : [];
}

export function filterRowsByBranch<T extends { branchId?: string | null }>(
  user: CurrentUserProfile,
  rows: T[],
) {
  if (isOwnerOrAdmin(user)) return rows;
  return rows.filter((row) => canAccessBranch(user, row.branchId));
}

export async function changeMyPassword(newPassword: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ newPassword }),
  });

  if (!res.ok) throw new Error("Đổi mật khẩu thất bại");
  return res.json();
}
