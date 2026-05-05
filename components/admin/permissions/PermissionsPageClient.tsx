"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getBranches, type BranchItem } from "@/lib/products-api";

type PermissionGroupKey =
  | "products"
  | "orders"
  | "inventory"
  | "customers"
  | "promotions"
  | "excel";

type RoleScope = "ALL_BRANCHES" | "ONE_BRANCH";

type RoleItem = {
  id: string;
  name: string;
  scope: RoleScope;
  description: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  permissions: Record<PermissionGroupKey, string[]>;
};

type BranchPermission = {
  id?: string;
  staffId?: string;
  branchId: string;
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
  note?: string | null;
};

type BranchPermissionKey = Exclude<
  keyof BranchPermission,
  "id" | "staffId" | "branchId" | "note"
>;

type BranchRoleItem = {
  id?: string;
  staffId?: string;
  branchId: string;
  roleCode: string;
  branch?: BranchItem | null;
};

type EmployeeItem = {
  id: string;
  code: string;
  name: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  roleId: string;
  roles: string[];
  branchId?: string | null;
  branch: string;
  branchPermissions: BranchPermission[];
  branchRoles: BranchRoleItem[];
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt?: string | null;
};

type PermissionGroupMeta = {
  title: string;
  desc: string;
  allPermissions: string[];
};

const ROLE_STORAGE_KEY = "the1970.permission.roleTemplates.v2";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  isLoading = false,
  loadingText,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const inactive = disabled || isLoading;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98]";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 hover:shadow-md"
      : variant === "danger"
        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 hover:shadow-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      className={`${base} ${tone} ${inactive ? "cursor-not-allowed opacity-60" : ""} ${className}`}
    >
      {isLoading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      <span>{isLoading && loadingText ? loadingText : children}</span>
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue" | "purple";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-600 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Panel>
      <div className="p-5">
        <p className="text-sm text-neutral-500">{title}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">
          {value}
        </p>
        <p className="mt-2 text-sm text-neutral-400">{sub}</p>
      </div>
    </Panel>
  );
}

const permissionGroupMeta: Record<PermissionGroupKey, PermissionGroupMeta> = {
  products: {
    title: "Sản phẩm / Dữ liệu",
    desc: "Quyền sản phẩm. Nhân viên thường chỉ được xem; tạo/sửa/giá/variant/trạng thái chỉ dành cho quản lý trở lên.",
    allPermissions: [
      "Xem sản phẩm",
      "Tạo sản phẩm",
      "Sửa thông tin sản phẩm",
      "Sửa giá bán",
      "Thêm variant",
      "Đổi trạng thái sản phẩm",
    ],
  },
  orders: {
    title: "Đơn hàng / POS",
    desc: "Bán tại quầy, tạo đơn, giới hạn xem đơn theo nhân viên/chi nhánh, duyệt/hủy và xử lý đổi trả.",
    allPermissions: [
      "Bán hàng / POS",
      "Xem đơn của mình",
      "Xem đơn chi nhánh",
      "Tạo đơn hàng",
      "Duyệt đơn hàng",
      "Hủy đơn hàng",
      "Đổi trả hàng",
    ],
  },
  inventory: {
    title: "Kho / Kiểm kho",
    desc: "Xem tồn, quản kho, kiểm kho, chuyển kho và nhận hàng.",
    allPermissions: [
      "Xem tồn kho",
      "Quản kho",
      "Kiểm kho",
      "Chuyển kho",
      "Nhận kho",
    ],
  },
  customers: {
    title: "Khách hàng",
    desc: "Xem và cập nhật thông tin khách hàng tại chi nhánh.",
    allPermissions: ["Xem khách hàng", "Sửa khách hàng"],
  },
  promotions: {
    title: "Khuyến mãi",
    desc: "Quyền xem, tạo, sửa, kích hoạt và tạm dừng chương trình khuyến mãi.",
    allPermissions: [
      "Xem khuyến mãi",
      "Tạo khuyến mãi",
      "Sửa khuyến mãi",
      "Kích hoạt khuyến mãi",
      "Tạm dừng khuyến mãi",
    ],
  },
  excel: {
    title: "Excel / Tải dữ liệu",
    desc: "Quyền tải xuống hoặc nhập file Excel. Mặc định nhân viên chỉ xem, không được tải/import nếu chưa cấp quyền.",
    allPermissions: [
      "Tải Excel sản phẩm",
      "Nhập Excel sản phẩm",
      "Tải Excel đơn hàng",
      "Tải Excel tồn kho",
      "Tải Excel khách hàng",
    ],
  },
};

const permissionToBranchKey: Record<string, BranchPermissionKey> = {
  "Xem sản phẩm": "canView",
  "Bán hàng / POS": "canSell",
  "Xem đơn của mình": "canViewOwnOrders",
  "Xem đơn chi nhánh": "canViewBranchOrders",
  "Tạo đơn hàng": "canCreateOrder",
  "Duyệt đơn hàng": "canApproveOrder",
  "Hủy đơn hàng": "canCancelOrder",
  "Đổi trả hàng": "canHandleReturn",
  "Xem tồn kho": "canViewStock",
  "Quản kho": "canManageStock",
  "Kiểm kho": "canStocktake",
  "Chuyển kho": "canTransferStock",
  "Nhận kho": "canReceiveStock",
  "Xem khách hàng": "canViewCustomer",
  "Sửa khách hàng": "canEditCustomer",
  "Tải Excel sản phẩm": "canExportProductExcel",
  "Nhập Excel sản phẩm": "canImportProductExcel",
  "Tải Excel đơn hàng": "canExportOrderExcel",
  "Tải Excel tồn kho": "canExportInventoryExcel",
  "Tải Excel khách hàng": "canExportCustomerExcel",
};

const branchPermissionGroups: {
  id: PermissionGroupKey;
  title: string;
  desc: string;
  tone: "blue" | "green" | "amber" | "gray" | "purple";
  permissions: { key: BranchPermissionKey; label: string; hint?: string }[];
}[] = [
  {
    id: "products",
    title: "Sản phẩm / Dữ liệu",
    desc: "Xem dữ liệu sản phẩm và dữ liệu vận hành cơ bản tại chi nhánh.",
    tone: "blue",
    permissions: [{ key: "canView", label: "Xem sản phẩm" }],
  },
  {
    id: "orders",
    title: "Đơn hàng / POS",
    desc: "Bán tại quầy, giới hạn xem đơn theo mình/chi nhánh, duyệt/hủy và đổi trả.",
    tone: "green",
    permissions: [
      { key: "canSell", label: "Bán hàng / POS" },
      {
        key: "canViewOwnOrders",
        label: "Xem đơn của mình",
        hint: "Chỉ thấy đơn do chính nhân viên này tạo.",
      },
      {
        key: "canViewBranchOrders",
        label: "Xem đơn chi nhánh",
        hint: "Thấy đơn của chi nhánh được cấp quyền.",
      },
      { key: "canCreateOrder", label: "Tạo đơn hàng" },
      { key: "canApproveOrder", label: "Duyệt đơn hàng" },
      { key: "canCancelOrder", label: "Hủy đơn hàng" },
      { key: "canHandleReturn", label: "Đổi trả hàng" },
    ],
  },
  {
    id: "inventory",
    title: "Kho / Kiểm kho",
    desc: "Xem tồn, quản kho, kiểm kho, chuyển và nhận hàng.",
    tone: "amber",
    permissions: [
      { key: "canViewStock", label: "Xem tồn kho" },
      { key: "canManageStock", label: "Quản kho" },
      { key: "canStocktake", label: "Kiểm kho" },
      { key: "canTransferStock", label: "Chuyển kho" },
      { key: "canReceiveStock", label: "Nhận kho" },
    ],
  },
  {
    id: "customers",
    title: "Khách hàng",
    desc: "Xem và cập nhật thông tin khách hàng tại chi nhánh.",
    tone: "gray",
    permissions: [
      { key: "canViewCustomer", label: "Xem khách hàng" },
      { key: "canEditCustomer", label: "Sửa khách hàng" },
    ],
  },
  {
    id: "excel",
    title: "Excel / Tải dữ liệu",
    desc: "Cho phép tải xuống hoặc nhập dữ liệu bằng Excel.",
    tone: "purple",
    permissions: [
      { key: "canExportProductExcel", label: "Tải Excel sản phẩm" },
      { key: "canImportProductExcel", label: "Nhập Excel sản phẩm" },
      { key: "canExportOrderExcel", label: "Tải Excel đơn hàng" },
      { key: "canExportInventoryExcel", label: "Tải Excel tồn kho" },
      { key: "canExportCustomerExcel", label: "Tải Excel khách hàng" },
    ],
  },
];

const branchPermissionColumns = branchPermissionGroups.flatMap(
  (group) => group.permissions,
);

const rolesSeed: RoleItem[] = [
  {
    id: "owner",
    name: "Owner",
    scope: "ALL_BRANCHES",
    description: "Toàn quyền hệ thống.",
    createdAt: "07/08/2025",
    updatedAt: "02/05/2026",
    note: "Owner",
    permissions: {
      products: [...permissionGroupMeta.products.allPermissions],
      orders: [...permissionGroupMeta.orders.allPermissions],
      inventory: [...permissionGroupMeta.inventory.allPermissions],
      customers: [...permissionGroupMeta.customers.allPermissions],
      promotions: [...permissionGroupMeta.promotions.allPermissions],
      excel: [...permissionGroupMeta.excel.allPermissions],
    },
  },
  {
    id: "branch-manager",
    name: "Quản lý chi nhánh",
    scope: "ONE_BRANCH",
    description:
      "Quản lý vận hành của một chi nhánh, không thấy toàn hệ thống.",
    createdAt: "08/08/2025",
    updatedAt: "02/05/2026",
    note: "Theo chi nhánh",
    permissions: {
      products: [...permissionGroupMeta.products.allPermissions],
      orders: [...permissionGroupMeta.orders.allPermissions],
      inventory: [...permissionGroupMeta.inventory.allPermissions],
      customers: [...permissionGroupMeta.customers.allPermissions],
      promotions: [...permissionGroupMeta.promotions.allPermissions],
      excel: [...permissionGroupMeta.excel.allPermissions],
    },
  },
  {
    id: "fulltime",
    name: "Nhân viên fulltime",
    scope: "ONE_BRANCH",
    description:
      "Vận hành mạnh hơn bán lẻ, được xử lý đơn và thao tác kho cơ bản.",
    createdAt: "07/08/2025",
    updatedAt: "02/05/2026",
    note: "Không xem báo cáo",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [
        "Bán hàng / POS",
        "Xem đơn của mình",
        "Xem đơn chi nhánh",
        "Tạo đơn hàng",
        "Đổi trả hàng",
      ],
      inventory: ["Xem tồn kho", "Kiểm kho", "Chuyển kho", "Nhận kho"],
      customers: ["Xem khách hàng"],
      promotions: ["Xem khuyến mãi"],
      excel: [],
    },
  },
  {
    id: "retail-staff",
    name: "Nhân viên bán lẻ",
    scope: "ONE_BRANCH",
    description:
      "Tập trung bán hàng tại quầy, quyền gọn và an toàn hơn fulltime.",
    createdAt: "05/12/2025",
    updatedAt: "02/05/2026",
    note: "Không xem báo cáo, không đụng kho",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [
        "Bán hàng / POS",
        "Xem đơn của mình",
        "Tạo đơn hàng",
        "Đổi trả hàng",
      ],
      inventory: ["Xem tồn kho"],
      customers: ["Xem khách hàng"],
      promotions: ["Xem khuyến mãi"],
      excel: [],
    },
  },
  {
    id: "stock-auditor",
    name: "Nhân viên kiểm kho",
    scope: "ONE_BRANCH",
    description: "Chỉ tập trung kiểm kho và đối chiếu tồn.",
    createdAt: "18/03/2026",
    updatedAt: "02/05/2026",
    note: "Không xử lý đơn bán",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [],
      inventory: ["Xem tồn kho", "Kiểm kho"],
      customers: [],
      promotions: [],
      excel: [],
    },
  },
  {
    id: "stock-staff",
    name: "Nhân viên kho",
    scope: "ONE_BRANCH",
    description:
      "Xử lý kho, chuyển hàng và nhận hàng theo phân quyền chi nhánh.",
    createdAt: "02/05/2026",
    updatedAt: "02/05/2026",
    note: "Kho vận hành",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [],
      inventory: [
        "Xem tồn kho",
        "Quản kho",
        "Kiểm kho",
        "Chuyển kho",
        "Nhận kho",
      ],
      customers: [],
      promotions: [],
      excel: [],
    },
  },
];

const MANAGEMENT_ROLE_IDS = new Set(["owner", "admin", "branch-manager"]);
const PRODUCT_VIEW_PERMISSION = "Xem sản phẩm";
const PROMOTION_VIEW_PERMISSION = "Xem khuyến mãi";
const PRODUCT_ACTION_PERMISSIONS = new Set([
  "Tạo sản phẩm",
  "Sửa thông tin sản phẩm",
  "Sửa giá bán",
  "Thêm variant",
  "Đổi trạng thái sản phẩm",
]);
const PROMOTION_ACTION_PERMISSIONS = new Set([
  "Tạo khuyến mãi",
  "Sửa khuyến mãi",
  "Kích hoạt khuyến mãi",
  "Tạm dừng khuyến mãi",
]);

const exclusiveRoles = ["owner", "admin", "branch-manager"];

function canRoleUseActionPermissions(roleId: string) {
  return MANAGEMENT_ROLE_IDS.has(String(roleId || "").toLowerCase());
}

function isActionPermission(
  groupKey: PermissionGroupKey,
  permissionName: string,
) {
  if (groupKey === "products")
    return PRODUCT_ACTION_PERMISSIONS.has(permissionName);
  if (groupKey === "promotions")
    return PROMOTION_ACTION_PERMISSIONS.has(permissionName);
  return false;
}

function getAllowedGroupPermissions(
  roleId: string,
  groupKey: PermissionGroupKey,
) {
  const all = permissionGroupMeta[groupKey].allPermissions;
  if (canRoleUseActionPermissions(roleId)) return all;

  if (groupKey === "products") {
    return all.filter((permission) => permission === PRODUCT_VIEW_PERMISSION);
  }

  if (groupKey === "promotions") {
    return all.filter((permission) => permission === PROMOTION_VIEW_PERMISSION);
  }

  return all;
}

function isPermissionAllowedForRole(
  roleId: string,
  groupKey: PermissionGroupKey,
  permissionName: string,
) {
  return getAllowedGroupPermissions(roleId, groupKey).includes(permissionName);
}

function sanitizeRoleTemplate(role: RoleItem): RoleItem {
  const permissions = { ...role.permissions };

  (Object.keys(permissionGroupMeta) as PermissionGroupKey[]).forEach(
    (groupKey) => {
      const allowed = new Set(getAllowedGroupPermissions(role.id, groupKey));
      permissions[groupKey] = Array.from(
        new Set(
          (permissions[groupKey] || []).filter((permission) =>
            allowed.has(permission),
          ),
        ),
      );
    },
  );

  return { ...role, permissions };
}

function groupHasAllAllowedPermissions(
  role: RoleItem,
  groupKey: PermissionGroupKey,
) {
  const current = role.permissions[groupKey] || [];
  const allowed = getAllowedGroupPermissions(role.id, groupKey);
  return allowed.length > 0 && allowed.every((item) => current.includes(item));
}

function formatStaffCode(index: number) {
  return `NV${String(index).padStart(2, "0")}`;
}

function normalizeStaffCode(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isSystemStaffCode(value?: string | null) {
  return /^NV\d+$/.test(normalizeStaffCode(value));
}

function normalizeStaffNameBase(value?: string | null) {
  // Ô tên đang hiển thị dạng "TÊN - QO". Khi người dùng gõ tiếp,
  // cần luôn bóc phần "- MÃ CHI NHÁNH" ở cuối để tránh bị nhân đôi: "M - QO - QO".
  let text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  // Bóc 1 hoặc nhiều hậu tố chi nhánh ở cuối, kể cả thiếu khoảng trắng: "MAI-QO", "MAI - QO - QO".
  text = text.replace(/(?:\s*-\s*[A-Z0-9]{1,6})+\s*$/g, "").trim();

  return text;
}

function normalizeUsername(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getBranchShortCode(branches: BranchItem[], branchId?: string | null) {
  const branch = branches.find((item) => item.id === branchId) as any;
  const raw = String(
    branch?.code ||
      branch?.shortCode ||
      branch?.name ||
      branch?.id ||
      branchId ||
      "",
  )
    .trim()
    .toUpperCase();

  if (!raw) return "";
  if (/^[A-Z0-9]{1,4}$/.test(raw)) return raw;

  const words = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function buildStaffDisplayName(
  name: string,
  branches: BranchItem[],
  branchId?: string | null,
) {
  const base = normalizeStaffNameBase(name);
  const branchCode = getBranchShortCode(branches, branchId);
  return branchCode ? `${base} - ${branchCode}` : base;
}

function scopeBadge(scope: RoleScope) {
  return scope === "ALL_BRANCHES" ? "Toàn hệ thống" : "Theo chi nhánh";
}

function isExclusiveRole(roleId: string) {
  return exclusiveRoles.includes(roleId);
}

function normalizeSelectedRoles(roleIds: string[]) {
  const cleaned = Array.from(
    new Set(
      roleIds.map((roleId) => String(roleId).toLowerCase()).filter(Boolean),
    ),
  );
  const selectedExclusive = cleaned.find(isExclusiveRole);
  if (selectedExclusive) return [selectedExclusive];
  return cleaned;
}

function defaultBranchPermission(branchId: string): BranchPermission {
  return {
    branchId,
    canView: false,
    canSell: false,
    canViewOwnOrders: false,
    canViewBranchOrders: false,
    canCreateOrder: false,
    canApproveOrder: false,
    canCancelOrder: false,
    canHandleReturn: false,
    canViewStock: false,
    canManageStock: false,
    canStocktake: false,
    canTransferStock: false,
    canReceiveStock: false,
    canViewCustomer: false,
    canEditCustomer: false,
    canExportProductExcel: false,
    canImportProductExcel: false,
    canExportOrderExcel: false,
    canExportInventoryExcel: false,
    canExportCustomerExcel: false,
  };
}

function normalizeStaffRoles(item: any): string[] {
  const relationRoles = Array.isArray(item.roles)
    ? item.roles
        .map((r: any) => String(r.roleCode || r).toLowerCase())
        .filter(Boolean)
    : [];
  const legacyRole = item.role ? [String(item.role).toLowerCase()] : [];
  return Array.from(new Set([...relationRoles, ...legacyRole]));
}

function roleLabel(roles: RoleItem[], roleId: string) {
  return roles.find((role) => role.id === roleId)?.name || roleId;
}

function hasAnyBranchPermission(row: BranchPermission) {
  return branchPermissionColumns.some((col) => Boolean(row[col.key]));
}

function formatLastLogin(value?: string | null) {
  if (!value) return "Chưa đăng nhập";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa đăng nhập";
  return d.toLocaleString("vi-VN");
}

function roleSummary(role: RoleItem) {
  return (Object.keys(permissionGroupMeta) as PermissionGroupKey[]).map(
    (key) => {
      const count = role.permissions[key]?.length || 0;
      return {
        key,
        title: permissionGroupMeta[key].title,
        count,
        enabled: count > 0,
      };
    },
  );
}

function getRolePermissionCount(role: RoleItem) {
  return (Object.keys(permissionGroupMeta) as PermissionGroupKey[]).reduce(
    (sum, key) => sum + (role.permissions[key]?.length || 0),
    0,
  );
}

function groupHasAllPermissions(role: RoleItem, groupKey: PermissionGroupKey) {
  const current = role.permissions[groupKey] || [];
  const all = permissionGroupMeta[groupKey].allPermissions;
  return all.length > 0 && all.every((item) => current.includes(item));
}

function groupPermissionSummary(role: RoleItem, groupKey: PermissionGroupKey) {
  const current = role.permissions[groupKey] || [];
  if (!current.length) return "Chưa có quyền";
  if (current.length <= 3) return `Có quyền: ${current.join(", ")}`;
  return `Có quyền: ${current.slice(0, 3).join(", ")} +${current.length - 3} quyền khác`;
}

function applySmartDependencies(
  row: BranchPermission,
  key: BranchPermissionKey,
  checked: boolean,
) {
  const next: BranchPermission = { ...row, [key]: checked };
  if (!checked) return next;

  if (["canSell", "canCreateOrder"].includes(String(key))) {
    next.canView = true;
    next.canViewOwnOrders = true;
    next.canViewStock = true;
    next.canViewCustomer = true;
  }

  if (key === "canHandleReturn") {
    next.canView = true;
    next.canViewCustomer = true;
  }

  if (key === "canViewBranchOrders") {
    next.canViewOwnOrders = true;
  }

  if (["canApproveOrder", "canCancelOrder"].includes(String(key))) {
    next.canViewOwnOrders = true;
    next.canViewBranchOrders = true;
  }

  if (
    [
      "canViewStock",
      "canManageStock",
      "canStocktake",
      "canTransferStock",
      "canReceiveStock",
    ].includes(String(key))
  ) {
    next.canView = true;
    next.canViewStock = true;
  }

  if (key === "canEditCustomer") {
    next.canView = true;
    next.canViewCustomer = true;
  }

  return next;
}

function roleToBranchPermission(role: RoleItem, branchId: string) {
  let row = defaultBranchPermission(branchId);
  (Object.keys(permissionGroupMeta) as PermissionGroupKey[]).forEach(
    (groupKey) => {
      role.permissions[groupKey].forEach((permissionName) => {
        const key = permissionToBranchKey[permissionName];
        if (key) row = applySmartDependencies(row, key, true);
      });
    },
  );
  return row;
}

function rolesToBranchPermission(
  roles: RoleItem[],
  roleIds: string[],
  branchId: string,
) {
  let row = defaultBranchPermission(branchId);
  normalizeSelectedRoles(roleIds).forEach((roleId) => {
    const role = roles.find((item) => item.id === roleId);
    if (!role) return;
    const roleRow = roleToBranchPermission(role, branchId);
    branchPermissionColumns.forEach((col) => {
      if (roleRow[col.key]) row = applySmartDependencies(row, col.key, true);
    });
  });
  return row;
}

function sanitizeBranchPermissionForApi(row: BranchPermission) {
  const clean: BranchPermission = { ...row };
  delete clean.id;
  delete clean.staffId;
  return clean;
}

function getBranchModes(row: BranchPermission) {
  const modes: { label: string; tone: "blue" | "green" | "amber" | "gray" }[] =
    [];
  if (row.canSell || row.canCreateOrder || row.canHandleReturn)
    modes.push({ label: "POS mode", tone: "green" });
  if (
    row.canViewStock ||
    row.canManageStock ||
    row.canStocktake ||
    row.canTransferStock ||
    row.canReceiveStock
  )
    modes.push({ label: "Kho mode", tone: "amber" });
  if (
    row.canApproveOrder ||
    row.canCancelOrder ||
    row.canManageStock ||
    row.canEditCustomer
  )
    modes.push({ label: "Quản lý mode", tone: "blue" });
  if (!modes.length) modes.push({ label: "Chưa cấp quyền", tone: "gray" });
  return modes;
}

function getPermissionWarnings(row: BranchPermission) {
  const warnings: string[] = [];
  if ((row.canSell || row.canCreateOrder) && !row.canViewOwnOrders)
    warnings.push("Bán/tạo đơn nên có quyền xem đơn của mình.");
  if ((row.canApproveOrder || row.canCancelOrder) && !row.canViewBranchOrders)
    warnings.push("Duyệt/hủy đơn nên có quyền xem đơn chi nhánh.");
  if (row.canSell && !row.canViewStock)
    warnings.push("Bán hàng nên được xem tồn để tránh bán thiếu hàng.");
  if (row.canEditCustomer && !row.canViewCustomer)
    warnings.push("Sửa khách nên đi kèm quyền xem khách.");
  if (row.canApproveOrder && row.canCancelOrder && row.canManageStock)
    warnings.push("Quyền khá rộng: duyệt/hủy đơn + quản kho.");
  return warnings;
}

function loadRoleTemplatesFromStorage() {
  if (typeof window === "undefined") return rolesSeed.map(sanitizeRoleTemplate);
  try {
    const raw = localStorage.getItem(ROLE_STORAGE_KEY);
    if (!raw) return rolesSeed.map(sanitizeRoleTemplate);
    const parsed = JSON.parse(raw) as RoleItem[];
    if (!Array.isArray(parsed)) return rolesSeed.map(sanitizeRoleTemplate);
    return rolesSeed.map((seed) => {
      const saved = parsed.find((role) => role.id === seed.id);
      if (!saved) return sanitizeRoleTemplate(seed);
      return sanitizeRoleTemplate({
        ...seed,
        permissions: {
          products: Array.isArray(saved.permissions?.products)
            ? saved.permissions.products
            : seed.permissions.products,
          orders: Array.isArray(saved.permissions?.orders)
            ? saved.permissions.orders
            : seed.permissions.orders,
          inventory: Array.isArray(saved.permissions?.inventory)
            ? saved.permissions.inventory
            : seed.permissions.inventory,
          customers: Array.isArray(saved.permissions?.customers)
            ? saved.permissions.customers
            : seed.permissions.customers,
          promotions: Array.isArray(saved.permissions?.promotions)
            ? saved.permissions.promotions
            : seed.permissions.promotions,
          excel: Array.isArray(saved.permissions?.excel)
            ? saved.permissions.excel
            : seed.permissions.excel,
        },
        updatedAt: saved.updatedAt || seed.updatedAt,
      });
    });
  } catch {
    return rolesSeed.map(sanitizeRoleTemplate);
  }
}

function RolePermissionPreview({ row }: { row: BranchPermission }) {
  const activeCount = branchPermissionColumns.filter((column) =>
    Boolean(row[column.key]),
  ).length;
  return (
    <div className="rounded-3xl border border-blue-100 bg-blue-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={activeCount ? "blue" : "gray"}>
            {activeCount ? `${activeCount} quyền` : "Chưa cấp quyền"}
          </Badge>
          {getBranchModes(row).map((mode) => (
            <Badge key={mode.label} tone={mode.tone}>
              {mode.label}
            </Badge>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {branchPermissionGroups.map((group) => {
          const checkedCount = group.permissions.filter((permission) =>
            Boolean(row[permission.key]),
          ).length;
          return (
            <div
              key={group.id}
              className="rounded-3xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h6 className="font-semibold text-neutral-900">
                      {group.title}
                    </h6>
                    <Badge tone={checkedCount ? group.tone : "gray"}>
                      {checkedCount}/{group.permissions.length}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{group.desc}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {group.permissions.map((permission) => {
                  const checked = Boolean(row[permission.key]);
                  return (
                    <div
                      key={permission.key}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${
                        checked
                          ? "border-blue-200 bg-blue-50 text-neutral-900"
                          : "border-neutral-200 bg-white text-neutral-400"
                      }`}
                    >
                      <span>{permission.label}</span>
                      <span
                        className={`h-4 w-4 rounded border ${checked ? "border-blue-500 bg-blue-500" : "border-neutral-300 bg-white"}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {getPermissionWarnings(row).length ? (
        <div className="mt-3 space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {getPermissionWarnings(row).map((warning) => (
            <p key={warning}>⚠ {warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PermissionsPageClient() {
  const [roles, setRoles] = useState<RoleItem[]>(
    rolesSeed.map(sanitizeRoleTemplate),
  );
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState("fulltime");
  const [message, setMessage] = useState("");
  const [roleTemplateDirty, setRoleTemplateDirty] = useState(false);

  const [quickName, setQuickName] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [quickUsername, setQuickUsername] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [quickRoleIds, setQuickRoleIds] = useState<string[]>(["retail-staff"]);
  const [quickBranchId, setQuickBranchId] = useState("");

  const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(
    null,
  );
  const [permissionEmployeeId, setPermissionEmployeeId] = useState<
    string | null
  >(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [editBranchRoleMap, setEditBranchRoleMap] = useState<
    Record<string, string>
  >({});
  const [branchRoleDirty, setBranchRoleDirty] = useState(false);
  const [savingBranchRolesForId, setSavingBranchRolesForId] = useState<
    string | null
  >(null);
  const [savedBranchRolesForId, setSavedBranchRolesForId] = useState<
    string | null
  >(null);
  const [savingRoleTemplates, setSavingRoleTemplates] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [savingProfileForId, setSavingProfileForId] = useState<string | null>(
    null,
  );
  const [savingPasswordForId, setSavingPasswordForId] = useState<string | null>(
    null,
  );
  const [savingPinForId, setSavingPinForId] = useState<string | null>(null);
  const [togglingEmployeeForId, setTogglingEmployeeForId] = useState<
    string | null
  >(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editMainBranchId, setEditMainBranchId] = useState("");

  const [resetPasswordForId, setResetPasswordForId] = useState<string | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");
  const [secondPasswordForId, setSecondPasswordForId] = useState<string | null>(
    null,
  );
  const [secondPassword, setSecondPassword] = useState("");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId],
  );
  const selectedRoleBranchPreview = useMemo(
    () => roleToBranchPermission(selectedRole, "__preview__"),
    [selectedRole],
  );
  const selectedRoleSummary = useMemo(
    () => roleSummary(selectedRole),
    [selectedRole],
  );
  const roleEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.roles.includes(selectedRoleId) ||
          employee.roleId === selectedRoleId,
      ),
    [employees, selectedRoleId],
  );

  const totalWorking = employees.filter((e) => e.status === "ACTIVE").length;
  const totalInactive = employees.filter((e) => e.status === "INACTIVE").length;
  const branchRoles = roles.filter(
    (role) => role.scope === "ONE_BRANCH",
  ).length;

  const staffCodeOptions = useMemo(() => {
    const usedCodes = new Set(
      employees
        .map((employee) => normalizeStaffCode(employee.code))
        .filter(isSystemStaffCode),
    );
    const maxExistingIndex = employees.reduce((max, employee) => {
      const match = normalizeStaffCode(employee.code).match(/^NV(\d+)$/);
      return match ? Math.max(max, Number(match[1] || 0)) : max;
    }, 0);
    const maxIndex = Math.max(80, maxExistingIndex + 40);

    return Array.from({ length: maxIndex }, (_, index) =>
      formatStaffCode(index + 1),
    )
      .filter((code) => !usedCodes.has(code))
      .slice(0, 60);
  }, [employees]);

  useEffect(() => {
    if (!quickCode && staffCodeOptions.length) {
      setQuickCode(staffCodeOptions[0]);
    }
  }, [quickCode, staffCodeOptions]);

  const getBranchName = (branchId?: string | null) => {
    if (!branchId) return "Toàn hệ thống";
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  function mapApiStaffToEmployee(item: any): EmployeeItem {
    const normalizedRoles = normalizeStaffRoles(item);
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      username: item.username ?? null,
      email: item.email ?? null,
      phone: item.phone ?? null,
      address: item.address ?? null,
      note: item.note ?? null,
      roleId: String(
        item.role ?? item.roleId ?? normalizedRoles[0] ?? "",
      ).toLowerCase(),
      roles: normalizedRoles,
      branchId: item.branchId ?? null,
      branch:
        item.branchName ??
        getBranchName(item.branchId) ??
        item.branch ??
        "Toàn hệ thống",
      branchPermissions: Array.isArray(item.branchPermissions)
        ? item.branchPermissions
        : [],
      branchRoles: Array.isArray(item.branchRoles) ? item.branchRoles : [],
      status: item.isActive ? "ACTIVE" : "INACTIVE",
      lastLoginAt: item.lastLoginAt ?? null,
    };
  }

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);
      setQuickBranchId((prev) => prev || data[0]?.id || "");
    } catch {
      setMessage("Không tải được danh sách chi nhánh.");
    }
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      setMessage("");
      const data = await apiJson<any[]>("/staff");
      setEmployees(Array.isArray(data) ? data.map(mapApiStaffToEmployee) : []);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách nhân sự.",
      );
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    setRoles(loadRoleTemplatesFromStorage());
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) void loadEmployees();
  }, [branches.length]);

  const toggleRoleId = (
    roleId: string,
    current: string[],
    setter: (next: string[]) => void,
  ) => {
    const rawNext = current.includes(roleId)
      ? current.filter((item) => item !== roleId)
      : [
          ...(isExclusiveRole(roleId)
            ? []
            : current.filter((item) => !isExclusiveRole(item))),
          roleId,
        ];
    const next = normalizeSelectedRoles(rawNext);
    setter(next.length ? next : ["retail-staff"]);
  };

  const saveRoleTemplates = () => {
    if (savingRoleTemplates) return;
    setSavingRoleTemplates(true);
    setMessage("Đang lưu mẫu quyền role...");

    window.setTimeout(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roles));
      }
      setRoleTemplateDirty(false);
      setSavingRoleTemplates(false);
      setMessage(
        "Đã lưu mẫu quyền role. Tạo/sửa nhân viên sau đó sẽ ăn theo mẫu mới.",
      );
    }, 350);
  };

  const resetRoleTemplates = () => {
    setRoles(rolesSeed.map(sanitizeRoleTemplate));
    setRoleTemplateDirty(true);
    setMessage(
      "Đã hoàn tác mẫu quyền về mặc định. Bấm Lưu mẫu quyền để áp dụng.",
    );
  };

  const updateRolePermission = (
    roleId: string,
    groupKey: PermissionGroupKey,
    permissionName: string,
    checked: boolean,
  ) => {
    if (
      checked &&
      !isPermissionAllowedForRole(roleId, groupKey, permissionName)
    ) {
      setMessage(
        "Quyền tạo/sửa/kích hoạt sản phẩm hoặc khuyến mãi chỉ dành cho Owner/Admin/Quản lý chi nhánh.",
      );
      return;
    }

    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;
        const currentSet = new Set(role.permissions[groupKey] || []);
        if (checked) currentSet.add(permissionName);
        else currentSet.delete(permissionName);
        return sanitizeRoleTemplate({
          ...role,
          updatedAt: new Date().toLocaleDateString("vi-VN"),
          permissions: {
            ...role.permissions,
            [groupKey]: Array.from(currentSet),
          },
        });
      }),
    );
    setRoleTemplateDirty(true);
  };

  const togglePermissionGroup = (
    roleId: string,
    groupKey: PermissionGroupKey,
    checked: boolean,
  ) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;
        return sanitizeRoleTemplate({
          ...role,
          updatedAt: new Date().toLocaleDateString("vi-VN"),
          permissions: {
            ...role.permissions,
            [groupKey]: checked
              ? [...getAllowedGroupPermissions(role.id, groupKey)]
              : [],
          },
        });
      }),
    );
    setRoleTemplateDirty(true);
  };

  const quickAssignUser = async () => {
    if (creatingStaff) return;
    if (!quickName.trim() || !quickCode.trim() || !quickPassword.trim()) {
      setMessage("Thiếu tên, mã nhân viên hoặc mật khẩu.");
      return;
    }
    if (!isSystemStaffCode(quickCode)) {
      setMessage("Mã nhân viên phải theo chuẩn hệ thống NV01, NV02...");
      return;
    }
    if (!quickRoleIds.length) {
      setMessage("Cần chọn ít nhất 1 vai trò.");
      return;
    }
    try {
      setCreatingStaff(true);
      setMessage("Đang tạo nhân viên mới...");
      const primaryRole = quickRoleIds[0];
      const created: any = await apiJson("/staff", {
        method: "POST",
        body: JSON.stringify({
          code: normalizeStaffCode(quickCode),
          name: buildStaffDisplayName(quickName, branches, quickBranchId),
          username: normalizeUsername(quickUsername) || null,
          email: quickEmail.trim() || null,
          phone: quickPhone.trim() || null,
          address: quickAddress.trim() || null,
          role: primaryRole,
          roles: [primaryRole],
          branchId: quickBranchId || null,
          branchRoles: quickBranchId
            ? [{ branchId: quickBranchId, roleCode: primaryRole }]
            : [],
          password: quickPassword.trim(),
        }),
      });

      const createdId = created?.id;
      if (createdId && quickBranchId) {
        await apiJson(`/staff/${createdId}/branch-roles`, {
          method: "PATCH",
          body: JSON.stringify({
            branchRoles: [{ branchId: quickBranchId, roleCode: primaryRole }],
          }),
        });
      }

      await loadEmployees();
      setSelectedRoleId(primaryRole);
      setQuickName("");
      setQuickCode(staffCodeOptions[1] || "");
      setQuickUsername("");
      setQuickEmail("");
      setQuickPhone("");
      setQuickAddress("");
      setQuickPassword("");
      setMessage("Đã tạo nhân viên và áp mẫu quyền theo role.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Lưu nhân viên thất bại.",
      );
    } finally {
      setCreatingStaff(false);
    }
  };

  const toggleEmployee = async (employeeId: string) => {
    if (togglingEmployeeForId) return;
    const current = employees.find((e) => e.id === employeeId);
    if (!current) return;
    const nextStatus = current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setTogglingEmployeeForId(employeeId);
      setMessage(
        nextStatus === "ACTIVE"
          ? "Đang kích hoạt lại nhân viên..."
          : "Đang cho nhân viên nghỉ...",
      );
      await apiJson(`/staff/${employeeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadEmployees();
      setMessage("Đã cập nhật trạng thái nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Cập nhật trạng thái thất bại.",
      );
    } finally {
      setTogglingEmployeeForId(null);
    }
  };

  const openProfileEditor = (employee: EmployeeItem) => {
    setProfileEmployeeId(employee.id);
    setPermissionEmployeeId(null);
    setEditName(normalizeStaffNameBase(employee.name || ""));
    setEditCode(
      isSystemStaffCode(employee.code)
        ? normalizeStaffCode(employee.code)
        : staffCodeOptions[0] || "",
    );
    setEditUsername(normalizeUsername(employee.username || ""));
    setEditEmail(employee.email || "");
    setEditPhone(employee.phone || "");
    setEditAddress(employee.address || "");
    setEditNote(employee.note || "");
    setEditMainBranchId(employee.branchId || branches[0]?.id || "");
  };

  const openPermissionEditor = (employee: EmployeeItem) => {
    setPermissionEmployeeId(employee.id);
    setProfileEmployeeId(null);

    const map: Record<string, string> = {};

    if (Array.isArray(employee.branchRoles) && employee.branchRoles.length) {
      employee.branchRoles.forEach((row) => {
        if (row.branchId && row.roleCode) {
          map[row.branchId] = String(row.roleCode).toLowerCase();
        }
      });
    } else if (employee.branchPermissions.length) {
      const fallbackRole =
        employee.roles[0] || employee.roleId || "retail-staff";
      employee.branchPermissions
        .filter(hasAnyBranchPermission)
        .forEach((row) => {
          map[row.branchId] = fallbackRole;
        });
    } else if (employee.branchId) {
      map[employee.branchId] =
        employee.roles[0] || employee.roleId || "retail-staff";
    }

    const activeBranchIds = Object.keys(map);
    setEditBranchRoleMap(map);
    setEditBranchIds(activeBranchIds);
    setEditRoleIds(Array.from(new Set(Object.values(map))).filter(Boolean));
    setEditMainBranchId(
      employee.branchId || activeBranchIds[0] || branches[0]?.id || "",
    );
    setBranchRoleDirty(false);
    setSavedBranchRolesForId(null);
  };

  const saveEmployeeProfile = async () => {
    if (!profileEmployeeId || savingProfileForId) return;
    if (!editName.trim() || !editCode.trim()) {
      setMessage("Thiếu tên hoặc mã nhân viên.");
      return;
    }
    if (!isSystemStaffCode(editCode)) {
      setMessage("Mã nhân viên phải theo chuẩn hệ thống NV01, NV02...");
      return;
    }
    try {
      const currentEmployeeId = profileEmployeeId;
      setSavingProfileForId(currentEmployeeId);
      setMessage("Đang lưu thông tin nhân viên...");
      await apiJson(`/staff/${profileEmployeeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: buildStaffDisplayName(editName, branches, editMainBranchId),
          code: normalizeStaffCode(editCode),
          username: normalizeUsername(editUsername) || null,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          address: editAddress.trim() || null,
          note: editNote.trim() || null,
          branchId: editMainBranchId || null,
        }),
      });
      await loadEmployees();
      setProfileEmployeeId(null);
      setMessage("Đã lưu thông tin nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Lưu thông tin nhân viên thất bại.",
      );
    } finally {
      setSavingProfileForId(null);
    }
  };

  const saveEmployeeRoleAssignment = async () => {
    if (!permissionEmployeeId || savingBranchRolesForId) return;

    const currentEmployeeId = permissionEmployeeId;
    const branchRoles = Object.entries(editBranchRoleMap)
      .filter(([, roleCode]) => Boolean(roleCode))
      .map(([branchId, roleCode]) => ({ branchId, roleCode }));

    if (!branchRoles.length) {
      setMessage("Cần chọn ít nhất 1 chi nhánh và vai trò áp dụng.");
      return;
    }

    try {
      setSavingBranchRolesForId(currentEmployeeId);
      setSavedBranchRolesForId(null);
      setMessage("Đang lưu role theo từng chi nhánh...");

      const primary = branchRoles[0];

      await apiJson(`/staff/${currentEmployeeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: primary.roleCode,
          branchId: editMainBranchId || primary.branchId || null,
        }),
      });

      await apiJson(`/staff/${currentEmployeeId}/branch-roles`, {
        method: "PATCH",
        body: JSON.stringify({ branchRoles }),
      });

      await loadEmployees();
      setSelectedRoleId(primary.roleCode);
      setBranchRoleDirty(false);
      setSavedBranchRolesForId(currentEmployeeId);
      setMessage("Đã lưu role theo từng chi nhánh cho nhân viên.");

      window.setTimeout(() => {
        setSavedBranchRolesForId((current) =>
          current === currentEmployeeId ? null : current,
        );
      }, 2200);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Cập nhật phân quyền thất bại.",
      );
    } finally {
      setSavingBranchRolesForId(null);
    }
  };

  const changePassword = async (employeeId: string) => {
    if (savingPasswordForId) return;
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setMessage("Mật khẩu mới tối thiểu 4 ký tự.");
      return;
    }
    try {
      setSavingPasswordForId(employeeId);
      setMessage("Đang đổi mật khẩu nhân viên...");
      await apiJson(`/staff/${employeeId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword.trim() }),
      });
      setNewPassword("");
      setResetPasswordForId(null);
      setMessage("Đã đổi mật khẩu nhân viên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Đổi mật khẩu thất bại.");
    } finally {
      setSavingPasswordForId(null);
    }
  };

  const renderRolePicker = (
    value: string[],
    onChange: (next: string[]) => void,
  ) => (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => {
        const active = value.includes(role.id);
        return (
          <button
            type="button"
            key={role.id}
            onClick={() => toggleRoleId(role.id, value, onChange)}
            className={`rounded-2xl border px-3 py-2 text-sm transition ${
              active
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {role.name}
            {active ? (
              <span className="ml-2 text-xs opacity-70">
                +{getRolePermissionCount(role)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const renderBranchPicker = (
    value: string[],
    onChange: (next: string[]) => void,
  ) => (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {branches.map((branch) => {
        const active = value.includes(branch.id);
        const preview = rolesToBranchPermission(
          roles,
          editRoleIds.length ? editRoleIds : quickRoleIds,
          branch.id,
        );
        const count = branchPermissionColumns.filter((col) =>
          Boolean(preview[col.key]),
        ).length;
        return (
          <button
            type="button"
            key={branch.id}
            onClick={() =>
              onChange(
                active
                  ? value.filter((id) => id !== branch.id)
                  : [...value, branch.id],
              )
            }
            className={`rounded-3xl border p-4 text-left transition ${
              active
                ? "border-blue-200 bg-blue-50 text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{branch.name}</span>
              <span
                className={`h-5 w-5 rounded-md border ${active ? "border-blue-500 bg-blue-500" : "border-neutral-300 bg-white"}`}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {active ? `Áp dụng ${count} quyền từ role` : "Chưa áp dụng"}
            </p>
          </button>
        );
      })}
    </div>
  );

  const renderProfileEditor = (employee: EmployeeItem) => {
    if (profileEmployeeId !== employee.id) return null;
    return (
      <Panel className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-neutral-900">
              Sửa thông tin nhân viên
            </h4>
            <p className="mt-1 text-sm text-neutral-500">
              Tách riêng khỏi phân quyền. Chỉ sửa hồ sơ, không đụng quyền.
            </p>
          </div>
          <Badge tone="blue">Staff profile</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="grid grid-cols-[minmax(0,1fr)_86px] gap-2">
            <input
              className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm uppercase outline-none"
              value={editName}
              onChange={(e) =>
                setEditName(normalizeStaffNameBase(e.target.value))
              }
              placeholder="Tên nhân viên (VD: MAI)"
            />
            <input
              readOnly
              className="h-11 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-center text-sm font-semibold text-neutral-700 outline-none"
              value={getBranchShortCode(branches, editMainBranchId)}
              placeholder="CN"
              title="Mã chi nhánh tự nhảy theo chi nhánh làm việc"
            />
          </div>
          <select
            className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none"
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
          >
            <option value="">Chọn mã nhân viên theo chuẩn NV</option>
            {isSystemStaffCode(editCode) ? (
              <option value={normalizeStaffCode(editCode)}>
                {normalizeStaffCode(editCode)} · mã hiện tại
              </option>
            ) : null}
            {staffCodeOptions
              .filter((code) => code !== normalizeStaffCode(editCode))
              .map((code) => (
                <option key={code} value={code}>
                  {code} · còn trống
                </option>
              ))}
          </select>
          <input
            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={editUsername}
            onChange={(e) => setEditUsername(normalizeUsername(e.target.value))}
            placeholder="Tên đăng nhập (viết thường)"
          />
          <input
            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="Số điện thoại"
          />
          <select
            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={editMainBranchId}
            onChange={(e) => setEditMainBranchId(e.target.value)}
          >
            <option value="">Chưa gán chi nhánh chính</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <input
            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            placeholder="Địa chỉ"
          />
          <input
            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Ghi chú"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          <Button
            onClick={saveEmployeeProfile}
            isLoading={savingProfileForId === profileEmployeeId}
            loadingText="Đang lưu..."
          >
            Lưu thông tin nhân viên
          </Button>
          <Button
            variant="secondary"
            onClick={() => setProfileEmployeeId(null)}
          >
            Hủy
          </Button>
        </div>
      </Panel>
    );
  };

  const renderBranchRoleMatrix = () => (
    <div className="space-y-3">
      {branches.map((branch) => {
        const roleCode = editBranchRoleMap[branch.id] || "";
        const role = roles.find((item) => item.id === roleCode);
        const preview = role
          ? roleToBranchPermission(role, branch.id)
          : defaultBranchPermission(branch.id);
        const count = branchPermissionColumns.filter((col) =>
          Boolean(preview[col.key]),
        ).length;

        return (
          <div
            key={branch.id}
            className={`rounded-3xl border p-4 transition ${
              roleCode
                ? "border-blue-200 bg-blue-50/40"
                : "border-neutral-200 bg-white"
            }`}
          >
            <div className="grid gap-3 md:grid-cols-[1fr_260px_140px] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h5 className="font-semibold text-neutral-900">
                    {branch.name}
                  </h5>
                  {roleCode ? (
                    <Badge tone="blue">{count} quyền</Badge>
                  ) : (
                    <Badge tone="gray">Chưa gán</Badge>
                  )}
                  {role ? <Badge tone="green">{role.name}</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Mỗi chi nhánh chỉ có 1 role. Quyền tự sinh theo role đã chọn.
                </p>
              </div>

              <select
                className="h-11 rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none"
                value={roleCode}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  setEditBranchRoleMap((prev) => {
                    const next = { ...prev };
                    if (!nextRole) delete next[branch.id];
                    else next[branch.id] = nextRole;
                    setEditBranchIds(Object.keys(next));
                    setEditRoleIds(
                      Array.from(new Set(Object.values(next))).filter(Boolean),
                    );
                    setBranchRoleDirty(true);
                    setSavedBranchRolesForId(null);
                    return next;
                  });
                }}
              >
                <option value="">Chưa gán role</option>
                {roles
                  .filter((roleItem) => roleItem.id !== "owner")
                  .map((roleItem) => (
                    <option key={roleItem.id} value={roleItem.id}>
                      {roleItem.name}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={() =>
                  setEditBranchRoleMap((prev) => {
                    const next = { ...prev };
                    delete next[branch.id];
                    setEditBranchIds(Object.keys(next));
                    setEditRoleIds(
                      Array.from(new Set(Object.values(next))).filter(Boolean),
                    );
                    setBranchRoleDirty(true);
                    setSavedBranchRolesForId(null);
                    return next;
                  })
                }
              >
                Bỏ gán
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPermissionEditor = (employee: EmployeeItem) => {
    if (permissionEmployeeId !== employee.id) return null;

    const assignedRoles = Object.values(editBranchRoleMap).filter(Boolean);
    const roleLabels = Array.from(new Set(assignedRoles)).map((roleId) =>
      roleLabel(roles, roleId),
    );

    return (
      <Panel className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-neutral-900">
              Gán role theo từng chi nhánh
            </h4>
            <p className="mt-1 text-sm text-neutral-500">
              Chuẩn V2: 1 nhân viên + 1 chi nhánh = 1 role duy nhất. Không còn
              lẫn nhiều role trong cùng chi nhánh.
            </p>
          </div>
          <Badge tone="green">Branch role V2</Badge>
        </div>

        <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">Đang gán:</span>
            {roleLabels.length ? (
              roleLabels.map((label) => (
                <Badge key={label} tone="blue">
                  {label}
                </Badge>
              ))
            ) : (
              <Badge tone="gray">Chưa có role</Badge>
            )}
          </div>
        </div>

        <div className="mt-5">{renderBranchRoleMatrix()}</div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
          <Button
            onClick={saveEmployeeRoleAssignment}
            disabled={savingBranchRolesForId === permissionEmployeeId}
            className={`min-w-[190px] ${branchRoleDirty ? "shadow-md shadow-neutral-300/50 ring-2 ring-neutral-900/10" : ""}`}
          >
            {savingBranchRolesForId === permissionEmployeeId
              ? "Đang lưu..."
              : branchRoleDirty
                ? "Lưu thay đổi"
                : "Lưu role theo chi nhánh"}
          </Button>
          <Button
            variant="secondary"
            disabled={savingBranchRolesForId === permissionEmployeeId}
            onClick={() => {
              setPermissionEmployeeId(null);
              setBranchRoleDirty(false);
              setSavedBranchRolesForId(null);
            }}
          >
            Hủy
          </Button>

          {savingBranchRolesForId === permissionEmployeeId ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              Đang đồng bộ quyền...
            </span>
          ) : savedBranchRolesForId === permissionEmployeeId ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              Đã lưu thành công
            </span>
          ) : branchRoleDirty ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Có thay đổi chưa lưu
            </span>
          ) : null}
        </div>
      </Panel>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Phân quyền
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Role System V2: chỉnh mẫu quyền theo vai trò, sau đó chỉ gán role +
          chi nhánh cho nhân viên.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          title="Tổng vai trò"
          value={roles.length}
          sub="Mẫu quyền có thể chỉnh"
        />
        <StatCard
          title="Role theo chi nhánh"
          value={branchRoles}
          sub="Áp dụng theo branch"
        />
        <StatCard
          title="Nhân sự đang làm"
          value={totalWorking}
          sub="Toàn hệ thống"
        />
        <StatCard
          title="Nhân sự đã nghỉ"
          value={totalInactive}
          sub="Lưu để audit"
        />
      </div>

      {message ? (
        <Panel className="px-5 py-4">
          <p className="text-sm text-neutral-700">{message}</p>
        </Panel>
      ) : null}

      <Panel>
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Tạo nhân viên mới
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Nhập thông tin cơ bản. Chọn vai trò và chi nhánh, hệ thống tự áp
                mẫu quyền role.
              </p>
            </div>
            <Badge tone="purple">Role template → Staff</Badge>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
              <input
                className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm uppercase outline-none"
                value={quickName}
                onChange={(e) =>
                  setQuickName(normalizeStaffNameBase(e.target.value))
                }
                placeholder="Tên nhân viên (VD: MAI)"
              />
              <input
                readOnly
                className="h-14 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-center text-sm font-semibold text-neutral-700 outline-none"
                value={getBranchShortCode(branches, quickBranchId)}
                placeholder="CN"
                title="Mã chi nhánh tự nhảy theo chi nhánh làm việc"
              />
            </div>
            <select
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
            >
              <option value="">Chọn mã nhân viên theo chuẩn NV</option>
              {staffCodeOptions.map((code) => (
                <option key={code} value={code}>
                  {code} · còn trống
                </option>
              ))}
            </select>
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickUsername}
              onChange={(e) =>
                setQuickUsername(normalizeUsername(e.target.value))
              }
              placeholder="Tên đăng nhập (viết thường)"
            />
            <input
              type="password"
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickPassword}
              onChange={(e) => setQuickPassword(e.target.value)}
              placeholder="Mật khẩu"
            />
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickEmail}
              onChange={(e) => setQuickEmail(e.target.value)}
              placeholder="Email"
            />
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickPhone}
              onChange={(e) => setQuickPhone(e.target.value)}
              placeholder="Số điện thoại"
            />
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickAddress}
              onChange={(e) => setQuickAddress(e.target.value)}
              placeholder="Địa chỉ"
            />
            <select
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickBranchId}
              onChange={(e) => setQuickBranchId(e.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">
                Chọn vai trò
              </p>
              {renderRolePicker(quickRoleIds, setQuickRoleIds)}
            </div>
            <Button
              onClick={quickAssignUser}
              className="h-12 min-w-[150px]"
              isLoading={creatingStaff}
              loadingText="Đang tạo..."
            >
              + Tạo nhân viên
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="overflow-hidden xl:sticky xl:top-4 xl:self-start">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  Danh sách vai trò
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Click role để chỉnh mẫu quyền và xem nhân viên đang dùng role
                  đó.
                </p>
              </div>
              <Badge tone="blue">Role V2</Badge>
            </div>
            <div className="mt-5 space-y-2">
              {roles.map((role) => {
                const active = selectedRoleId === role.id;
                const count = getRolePermissionCount(role);
                return (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${active ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">
                          {role.name}
                        </div>
                        <p
                          className={`mt-1 text-sm ${active ? "text-neutral-300" : "text-neutral-500"}`}
                        >
                          {role.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-white/20 bg-white/10 text-white" : "border-blue-200 bg-blue-50 text-blue-700"}`}
                        >
                          {scopeBadge(role.scope)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-white/20 bg-white/10 text-white" : "border-green-200 bg-green-50 text-green-700"}`}
                        >
                          {count} quyền
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold text-neutral-900">
                    Role Control Center: {selectedRole.name}
                  </h3>
                  <Badge tone="blue">{scopeBadge(selectedRole.scope)}</Badge>
                  <Badge tone="amber">{selectedRole.note}</Badge>
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  Tick quyền tại đây. Danh sách nhân viên dùng role này nằm ngay
                  bên dưới để kiểm tra nhanh.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={resetRoleTemplates}>
                  Reset mẫu
                </Button>
                <Button
                  onClick={saveRoleTemplates}
                  disabled={!roleTemplateDirty}
                  isLoading={savingRoleTemplates}
                  loadingText="Đang lưu..."
                >
                  {roleTemplateDirty ? "Lưu mẫu quyền" : "Đã lưu mẫu"}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-neutral-200 p-4">
                <p className="text-sm text-neutral-500">Đang được gán</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
                  {roleEmployees.length}
                </p>
              </div>
              <div className="rounded-3xl border border-neutral-200 p-4">
                <p className="text-sm text-neutral-500">Tổng quyền</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
                  {getRolePermissionCount(selectedRole)}
                </p>
              </div>
              <div className="rounded-3xl border border-neutral-200 p-4">
                <p className="text-sm text-neutral-500">Cập nhật cuối</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
                  {selectedRole.updatedAt}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {(Object.keys(permissionGroupMeta) as PermissionGroupKey[]).map(
                (key) => {
                  const meta = permissionGroupMeta[key];
                  const currentPermissions =
                    selectedRole.permissions[key] || [];
                  const allChecked = groupHasAllAllowedPermissions(
                    selectedRole,
                    key,
                  );
                  const allowedPermissions = getAllowedGroupPermissions(
                    selectedRole.id,
                    key,
                  );
                  return (
                    <div
                      key={key}
                      className="rounded-3xl border border-neutral-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-semibold text-neutral-900">
                              {meta.title}
                            </h4>
                            <Badge
                              tone={
                                currentPermissions.length ? "green" : "gray"
                              }
                            >
                              {currentPermissions.length}/
                              {meta.allPermissions.length}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-neutral-500">
                            {meta.desc}
                          </p>
                          <p className="mt-2 text-xs italic text-neutral-500">
                            {groupPermissionSummary(selectedRole, key)}
                          </p>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={!allowedPermissions.length}
                            onChange={(e) =>
                              togglePermissionGroup(
                                selectedRole.id,
                                key,
                                e.target.checked,
                              )
                            }
                          />
                          {canRoleUseActionPermissions(selectedRole.id) ||
                          !["products", "promotions"].includes(key)
                            ? "Cả nhóm"
                            : "Chỉ quyền xem"}
                        </label>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {meta.allPermissions.map((permissionName) => {
                          const checked =
                            currentPermissions.includes(permissionName);
                          const disabled = !isPermissionAllowedForRole(
                            selectedRole.id,
                            key,
                            permissionName,
                          );
                          const isLockedAction =
                            disabled && isActionPermission(key, permissionName);
                          return (
                            <label
                              key={permissionName}
                              title={
                                isLockedAction
                                  ? "Quyền này chỉ dành cho Owner/Admin/Quản lý chi nhánh"
                                  : undefined
                              }
                              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                disabled
                                  ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400"
                                  : checked
                                    ? "cursor-pointer border-blue-200 bg-blue-50 text-neutral-900"
                                    : "cursor-pointer border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {permissionName}
                                {isLockedAction ? (
                                  <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-400">
                                    Quản lý+
                                  </span>
                                ) : null}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(e) =>
                                  updateRolePermission(
                                    selectedRole.id,
                                    key,
                                    permissionName,
                                    e.target.checked,
                                  )
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  Nhân viên đang dùng role này
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Nằm ngay dưới mẫu quyền để dễ kiểm tra role này đang áp cho
                  ai.
                </p>
              </div>
              <Badge tone="blue">{roleEmployees.length} user</Badge>
            </div>

            <div className="mt-4 space-y-4">
              {loadingEmployees ? (
                <p className="text-sm text-neutral-500">Đang tải nhân sự...</p>
              ) : roleEmployees.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Chưa có user cho role này.
                </p>
              ) : (
                roleEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="rounded-3xl border border-neutral-200 px-5 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-medium text-neutral-900">
                            {employee.name}
                          </span>
                          <Badge
                            tone={
                              employee.status === "ACTIVE" ? "green" : "gray"
                            }
                          >
                            {employee.status === "ACTIVE"
                              ? "Đang làm"
                              : "Đã nghỉ"}
                          </Badge>
                          <Badge tone="gray">{employee.code}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(employee.roles.length
                            ? employee.roles
                            : [employee.roleId]
                          ).map((roleId) => (
                            <Badge key={roleId} tone="blue">
                              {roleLabel(roles, roleId)}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-2 text-sm text-neutral-500">
                          Chi nhánh chính: {employee.branch}
                        </p>
                        <div className="mt-1 grid gap-1 text-sm text-neutral-400 md:grid-cols-2">
                          <p>
                            Lần đăng nhập cuối:{" "}
                            {formatLastLogin(employee.lastLoginAt)}
                          </p>
                          <p>Email: {employee.email || "Chưa có"}</p>
                          <p>SĐT: {employee.phone || "Chưa có"}</p>
                          <p>Địa chỉ: {employee.address || "Chưa có"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => openProfileEditor(employee)}
                        >
                          Sửa thông tin
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => openPermissionEditor(employee)}
                        >
                          Gán role/chi nhánh
                        </Button>
                      </div>
                    </div>

                    {renderProfileEditor(employee)}
                    {renderPermissionEditor(employee)}

                    {resetPasswordForId === employee.id ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                          placeholder="Mật khẩu mới"
                        />
                        <Button
                          onClick={() => changePassword(employee.id)}
                          isLoading={savingPasswordForId === employee.id}
                          loadingText="Đang lưu..."
                        >
                          Lưu mật khẩu
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setResetPasswordForId(null);
                            setNewPassword("");
                          }}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : null}

                    {secondPasswordForId === employee.id ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                        <input
                          type="text"
                          name="staff-security-pin"
                          autoComplete="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          inputMode="numeric"
                          maxLength={6}
                          value={secondPassword}
                          onChange={(e) =>
                            setSecondPassword(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                          placeholder="PIN bảo mật 6 số"
                        />
                        <Button
                          isLoading={savingPinForId === employee.id}
                          loadingText="Đang lưu..."
                          onClick={async () => {
                            if (savingPinForId) return;
                            if (!/^\d{6}$/.test(secondPassword)) {
                              setMessage("PIN phải gồm đúng 6 số.");
                              return;
                            }
                            if (
                              ["000000", "111111", "123456", "654321"].includes(
                                secondPassword,
                              )
                            ) {
                              setMessage("PIN quá dễ đoán, hãy đặt mã khác.");
                              return;
                            }
                            try {
                              setSavingPinForId(employee.id);
                              setMessage("Đang lưu PIN bảo mật...");
                              await apiJson(
                                `/staff/${employee.id}/second-password`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({ secondPassword }),
                                },
                              );
                              setSecondPassword("");
                              setSecondPasswordForId(null);
                              setMessage("Đã set PIN bảo mật cho nhân viên.");
                            } catch (err) {
                              setMessage(
                                err instanceof Error
                                  ? err.message
                                  : "Lưu PIN bảo mật thất bại.",
                              );
                            } finally {
                              setSavingPinForId(null);
                            }
                          }}
                        >
                          Lưu PIN
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSecondPasswordForId(null);
                            setSecondPassword("");
                          }}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setResetPasswordForId(employee.id);
                          setNewPassword("");
                        }}
                      >
                        Đổi mật khẩu
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSecondPasswordForId(employee.id);
                          setSecondPassword("");
                        }}
                      >
                        Đặt/Reset PIN
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => toggleEmployee(employee.id)}
                        isLoading={togglingEmployeeForId === employee.id}
                        loadingText={
                          employee.status === "ACTIVE"
                            ? "Đang cho nghỉ..."
                            : "Đang kích hoạt..."
                        }
                      >
                        {employee.status === "ACTIVE"
                          ? "Cho nghỉ"
                          : "Kích hoạt lại"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
