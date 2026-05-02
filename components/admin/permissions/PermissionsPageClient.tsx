"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getBranches, type BranchItem } from "@/lib/products-api";

type PermissionGroupKey = "products" | "orders" | "inventory" | "customers";

type RoleItem = {
  id: string;
  name: string;
  scope: "ALL_BRANCHES" | "ONE_BRANCH";
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
  canViewReport?: boolean;
  canViewMoney?: boolean;
  note?: string | null;
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
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt?: string | null;
};

type PermissionGroupMeta = {
  title: string;
  desc: string;
  allPermissions: string[];
};

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
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "danger"
        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-600 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
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
    desc: "Quyền xem dữ liệu sản phẩm trong chi nhánh. Các quyền tạo/sửa sản phẩm là quyền hệ thống, không cấp theo từng chi nhánh ở màn này.",
    allPermissions: ["Xem sản phẩm"],
  },
  orders: {
    title: "Đơn hàng / POS",
    desc: "Bán tại quầy, tạo đơn, duyệt/hủy và xử lý đổi trả.",
    allPermissions: [
      "Bán hàng / POS",
      "Tạo đơn hàng",
      "Duyệt đơn hàng",
      "Hủy đơn hàng",
      "Đổi trả hàng",
    ],
  },
  inventory: {
    title: "Kho / Kiểm kho",
    desc: "Xem tồn, quản kho, kiểm kho, chuyển và nhận hàng.",
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
};

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
      products: ["Xem sản phẩm"],
      orders: [
        "Bán hàng / POS",
        "Tạo đơn hàng",
        "Duyệt đơn hàng",
        "Hủy đơn hàng",
        "Đổi trả hàng",
      ],
      inventory: [
        "Xem tồn kho",
        "Quản kho",
        "Kiểm kho",
        "Chuyển kho",
        "Nhận kho",
      ],
      customers: ["Xem khách hàng", "Sửa khách hàng"],
    },
  },
  {
    id: "fulltime",
    name: "Nhân viên fulltime",
    scope: "ONE_BRANCH",
    description:
      "Vận hành mạnh hơn bán lẻ, được xử lý đơn và đẩy sang hãng vận chuyển.",
    createdAt: "07/08/2025",
    updatedAt: "02/05/2026",
    note: "Không xem báo cáo",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [
        "Bán hàng / POS",
        "Tạo đơn hàng",
        "Duyệt đơn hàng",
        "Hủy đơn hàng",
        "Đổi trả hàng",
      ],
      inventory: [
        "Xem tồn kho",
        "Quản kho",
        "Kiểm kho",
        "Chuyển kho",
        "Nhận kho",
      ],
      customers: ["Xem khách hàng", "Sửa khách hàng"],
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
      orders: ["Bán hàng / POS", "Tạo đơn hàng", "Đổi trả hàng"],
      inventory: ["Xem tồn kho"],
      customers: ["Xem khách hàng"],
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
    },
  },
];

function scopeBadge(scope: RoleItem["scope"]) {
  return scope === "ALL_BRANCHES" ? "Toàn hệ thống" : "Theo chi nhánh";
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
  return `Có quyền: ${current.slice(0, 3).join(", ")} +${
    current.length - 3
  } quyền khác`;
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

function formatLastLogin(value?: string | null) {
  if (!value) return "Chưa đăng nhập";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa đăng nhập";
  return d.toLocaleString("vi-VN");
}

const branchPermissionGroups: {
  id: string;
  title: string;
  desc: string;
  tone: "blue" | "green" | "amber" | "gray";
  permissions: { key: keyof BranchPermission; label: string; hint?: string }[];
}[] = [
  {
    id: "base",
    title: "Sản phẩm / Dữ liệu",
    desc: "Xem dữ liệu sản phẩm và dữ liệu vận hành cơ bản tại chi nhánh.",
    tone: "blue",
    permissions: [{ key: "canView", label: "Xem sản phẩm" }],
  },
  {
    id: "orders",
    title: "Đơn hàng / POS",
    desc: "Bán tại quầy, tạo đơn, duyệt/hủy và xử lý đổi trả.",
    tone: "green",
    permissions: [
      { key: "canSell", label: "Bán hàng / POS" },
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
];

const branchPermissionColumns = branchPermissionGroups.flatMap(
  (group) => group.permissions,
);

function defaultBranchPermission(branchId: string): BranchPermission {
  return {
    branchId,
    canView: false,
    canSell: false,
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
    canViewReport: false,
    canViewMoney: false,
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

function normalizePermissionPayload(
  roles: string[],
  permissions: Record<string, BranchPermission>,
) {
  const rows = Object.values(permissions)
    .filter(hasAnyBranchPermission)
    .map((row) => ({
      ...row,
      id: undefined,
      staffId: undefined,
    }))
    .sort((a, b) => String(a.branchId).localeCompare(String(b.branchId)));

  return JSON.stringify({
    roles: [...roles].map((role) => String(role).toLowerCase()).sort(),
    branchPermissions: rows,
  });
}

function getBranchModes(row: BranchPermission) {
  const modes: { label: string; tone: "blue" | "green" | "amber" | "gray" }[] =
    [];

  if (row.canSell || row.canCreateOrder || row.canHandleReturn) {
    modes.push({ label: "POS mode", tone: "green" });
  }

  if (
    row.canViewStock ||
    row.canManageStock ||
    row.canStocktake ||
    row.canTransferStock ||
    row.canReceiveStock
  ) {
    modes.push({ label: "Kho mode", tone: "amber" });
  }

  if (
    row.canApproveOrder ||
    row.canCancelOrder ||
    row.canManageStock ||
    row.canEditCustomer
  ) {
    modes.push({ label: "Quản lý mode", tone: "blue" });
  }

  if (!modes.length) modes.push({ label: "Chưa cấp quyền", tone: "gray" });

  return modes;
}

function getPermissionWarnings(row: BranchPermission) {
  const warnings: string[] = [];

  if ((row.canSell || row.canCreateOrder) && !row.canView) {
    warnings.push("Bán/tạo đơn nên có quyền xem dữ liệu.");
  }

  if (row.canSell && !row.canViewStock) {
    warnings.push("Bán hàng nên được xem tồn để tránh bán thiếu hàng.");
  }

  if (row.canEditCustomer && !row.canViewCustomer) {
    warnings.push("Sửa khách nên đi kèm quyền xem khách.");
  }

  if (row.canApproveOrder && row.canCancelOrder && row.canManageStock) {
    warnings.push("Quyền khá rộng: duyệt/hủy đơn + quản kho.");
  }

  return warnings;
}

function isHighRole(roles: string[]) {
  return roles.some((role) =>
    ["owner", "admin", "branch-manager", "fulltime"].includes(role),
  );
}

function getLockedReason(roles: string[], key: keyof BranchPermission) {
  if (roles.includes("owner") || roles.includes("admin")) return "";

  const managerOnly: (keyof BranchPermission)[] = [
    "canApproveOrder",
    "canCancelOrder",
    "canManageStock",
    "canEditCustomer",
  ];

  if (managerOnly.includes(key) && !isHighRole(roles)) {
    return "Quyền này chỉ nên cấp cho quản lý/fulltime trở lên.";
  }

  return "";
}



type RoleTemplate = Partial<Record<keyof BranchPermission, boolean>>;

const rolePermissionTemplates: Record<string, RoleTemplate> = {
  owner: {
    canView: true,
    canSell: true,
    canCreateOrder: true,
    canApproveOrder: true,
    canCancelOrder: true,
    canHandleReturn: true,
    canViewStock: true,
    canManageStock: true,
    canStocktake: true,
    canTransferStock: true,
    canReceiveStock: true,
    canViewCustomer: true,
    canEditCustomer: true,
  },
  admin: {
    canView: true,
    canSell: true,
    canCreateOrder: true,
    canApproveOrder: true,
    canCancelOrder: true,
    canHandleReturn: true,
    canViewStock: true,
    canManageStock: true,
    canStocktake: true,
    canTransferStock: true,
    canReceiveStock: true,
    canViewCustomer: true,
    canEditCustomer: true,
  },
  "branch-manager": {
    canView: true,
    canSell: true,
    canCreateOrder: true,
    canApproveOrder: true,
    canCancelOrder: true,
    canHandleReturn: true,
    canViewStock: true,
    canManageStock: true,
    canStocktake: true,
    canTransferStock: true,
    canReceiveStock: true,
    canViewCustomer: true,
    canEditCustomer: true,
  },
  fulltime: {
    canView: true,
    canSell: true,
    canCreateOrder: true,
    canHandleReturn: true,
    canViewStock: true,
    canStocktake: true,
    canTransferStock: true,
    canReceiveStock: true,
    canViewCustomer: true,
  },
  "retail-staff": {
    canView: true,
    canSell: true,
    canCreateOrder: true,
    canHandleReturn: true,
    canViewStock: true,
    canViewCustomer: true,
  },
  "stock-auditor": {
    canView: true,
    canViewStock: true,
    canStocktake: true,
  },
  "stock-staff": {
    canView: true,
    canViewStock: true,
    canManageStock: true,
    canStocktake: true,
    canTransferStock: true,
    canReceiveStock: true,
  },
};

const exclusiveRoles = ["owner", "admin", "branch-manager"];

function isExclusiveRole(roleId: string) {
  return exclusiveRoles.includes(roleId);
}

function normalizeSelectedRoles(roleIds: string[]) {
  const cleaned = Array.from(
    new Set(roleIds.map((roleId) => String(roleId).toLowerCase()).filter(Boolean)),
  );

  const selectedExclusive = cleaned.find(isExclusiveRole);

  if (selectedExclusive) {
    return [selectedExclusive];
  }

  return cleaned;
}

function buildRoleTemplate(roleIds: string[]) {
  const template: RoleTemplate = {};

  normalizeSelectedRoles(roleIds).forEach((roleId) => {
    const roleTemplate = rolePermissionTemplates[roleId] || {};

    Object.entries(roleTemplate).forEach(([key, value]) => {
      if (value) {
        template[key as keyof BranchPermission] = true;
      }
    });
  });

  return template;
}

function countRoleTemplatePermissions(roleIds: string[]) {
  const template = buildRoleTemplate(roleIds);
  return branchPermissionColumns.filter((column) => Boolean(template[column.key]))
    .length;
}

function applyRoleTemplateDiffToRow(
  row: BranchPermission,
  previousRoles: string[],
  nextRoles: string[],
) {
  const previousTemplate = buildRoleTemplate(previousRoles);
  const nextTemplate = buildRoleTemplate(nextRoles);
  let next: BranchPermission = { ...row };

  branchPermissionColumns.forEach((column) => {
    const key = column.key;
    const wasFromPreviousRole = Boolean(previousTemplate[key]);
    const shouldComeFromNextRole = Boolean(nextTemplate[key]);

    if (shouldComeFromNextRole) {
      next = applySmartDependencies(next, key, true);
      return;
    }

    if (wasFromPreviousRole && Boolean(next[key])) {
      next = { ...next, [key]: false };
    }
  });

  return next;
}

function applyRoleTemplateToRow(row: BranchPermission, roleIds: string[]) {
  let next: BranchPermission = { ...row };
  const template = buildRoleTemplate(roleIds);

  branchPermissionColumns.forEach((column) => {
    if (template[column.key]) {
      next = applySmartDependencies(next, column.key, true);
    }
  });

  return next;
}
function applySmartDependencies(
  row: BranchPermission,
  key: keyof BranchPermission,
  checked: boolean,
) {
  const next: BranchPermission = { ...row, [key]: checked };

  if (checked) {
    if (
      ["canSell", "canCreateOrder", "canHandleReturn"].includes(String(key))
    ) {
      next.canView = true;
      next.canViewStock = true;
      next.canViewCustomer = true;
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
  }

  return next;
}

export default function PermissionsPageClient() {
  const [roles, setRoles] = useState<RoleItem[]>(rolesSeed);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState("fulltime");
  const [message, setMessage] = useState("");
  const [secondPasswordForId, setSecondPasswordForId] = useState<string | null>(
    null,
  );
  const [secondPassword, setSecondPassword] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [quickUsername, setQuickUsername] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [quickRoleIds, setQuickRoleIds] = useState<string[]>(["retail-staff"]);
  const [quickBranchId, setQuickBranchId] = useState("");

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
    null,
  );
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editBranchPermissions, setEditBranchPermissions] = useState<
    Record<string, BranchPermission>
  >({});
  const [editPermissionSnapshot, setEditPermissionSnapshot] = useState("");

  const [resetPasswordForId, setResetPasswordForId] = useState<string | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId],
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

  const currentEditPayload = useMemo(
    () => normalizePermissionPayload(editRoleIds, editBranchPermissions),
    [editRoleIds, editBranchPermissions],
  );

  const hasUnsavedPermissionChanges = Boolean(
    editingEmployeeId &&
    editPermissionSnapshot &&
    currentEditPayload !== editPermissionSnapshot,
  );

  const totalWorking = employees.filter((e) => e.status === "ACTIVE").length;
  const totalInactive = employees.filter((e) => e.status === "INACTIVE").length;
  const branchRoles = roles.filter(
    (role) => role.scope === "ONE_BRANCH",
  ).length;
  const summary = roleSummary(selectedRole);

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
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      void loadEmployees();
    }
  }, [branches.length]);

  const toggleRoleId = (
    roleId: string,
    current: string[],
    setter: (next: string[]) => void,
  ) => {
    const rawNext = current.includes(roleId)
      ? current.filter((item) => item !== roleId)
      : [...(isExclusiveRole(roleId) ? [] : current.filter((item) => !isExclusiveRole(item))), roleId];
    const next = normalizeSelectedRoles(rawNext);
    setter(next);
  };

  const toggleEditRoleId = (roleId: string) => {
    const previousRoles = editRoleIds;
    const rawNext = previousRoles.includes(roleId)
      ? previousRoles.filter((item) => item !== roleId)
      : [...(isExclusiveRole(roleId) ? [] : previousRoles.filter((item) => !isExclusiveRole(item))), roleId];
    const nextRoles = normalizeSelectedRoles(rawNext);

    if (!nextRoles.length) {
      setMessage("Cần giữ ít nhất 1 vai trò cho nhân viên.");
      return;
    }

    setEditRoleIds(nextRoles);
    setEditBranchPermissions((prev) => {
      const nextMap: Record<string, BranchPermission> = {};
      const activeBranchIds = new Set(
        Object.values(prev)
          .filter(hasAnyBranchPermission)
          .map((row) => row.branchId),
      );

      branches.forEach((branch) => {
        const current = prev[branch.id] || defaultBranchPermission(branch.id);
        const shouldApplyTemplate =
          activeBranchIds.size === 0 || activeBranchIds.has(branch.id);

        nextMap[branch.id] = shouldApplyTemplate
          ? applyRoleTemplateDiffToRow(current, previousRoles, nextRoles)
          : current;
      });

      return nextMap;
    });
    setMessage(
      "Đã cập nhật vai trò. Bộ quyền theo chi nhánh đã tự cộng/trừ theo vai trò mới.",
    );
  };

  const quickAssignUser = async () => {
    if (!quickName.trim() || !quickCode.trim() || !quickPassword.trim()) {
      setMessage("Thiếu tên, mã nhân viên hoặc mật khẩu.");
      return;
    }

    if (!quickRoleIds.length) {
      setMessage("Cần chọn ít nhất 1 vai trò.");
      return;
    }

    try {
      await apiJson("/staff", {
        method: "POST",
        body: JSON.stringify({
          code: quickCode.trim(),
          name: quickName.trim(),
          username: quickUsername.trim() || null,
          email: quickEmail.trim() || null,
          phone: quickPhone.trim() || null,
          address: quickAddress.trim() || null,
          role: quickRoleIds[0],
          roles: quickRoleIds,
          branchId: quickBranchId || null,
          password: quickPassword.trim(),
        }),
      });

      await loadEmployees();
      setSelectedRoleId(quickRoleIds[0]);
      setQuickName("");
      setQuickCode("");
      setQuickUsername("");
      setQuickEmail("");
      setQuickPhone("");
      setQuickAddress("");
      setQuickPassword("");
      setMessage("Đã lưu nhân viên vào database.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Lưu nhân viên thất bại.",
      );
    }
  };

  const toggleEmployee = async (employeeId: string) => {
    const current = employees.find((e) => e.id === employeeId);
    if (!current) return;

    const nextStatus = current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      await apiJson(`/staff/${employeeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      await loadEmployees();
      setMessage("Đã cập nhật trạng thái nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Cập nhật trạng thái thất bại.",
      );
    }
  };

  const startEditEmployee = (employee: EmployeeItem) => {
    setEditingEmployeeId(employee.id);
    setEditRoleIds(
      employee.roles.length
        ? employee.roles
        : [employee.roleId].filter(Boolean),
    );

    const map: Record<string, BranchPermission> = {};
    branches.forEach((branch) => {
      map[branch.id] = defaultBranchPermission(branch.id);
    });

    employee.branchPermissions.forEach((permission) => {
      map[permission.branchId] = {
        ...defaultBranchPermission(permission.branchId),
        ...permission,
      };
    });

    if (!employee.branchPermissions.length && employee.branchId && map[employee.branchId]) {
      const starterRoles = employee.roles.length
        ? employee.roles
        : [employee.roleId].filter(Boolean);
      map[employee.branchId] = applyRoleTemplateToRow(
        map[employee.branchId],
        starterRoles,
      );
    }

    setEditBranchPermissions(map);
    setEditPermissionSnapshot(
      normalizePermissionPayload(
        employee.roles.length
          ? employee.roles
          : [employee.roleId].filter(Boolean),
        map,
      ),
    );
  };

  const toggleEditBranchPermission = (
    branchId: string,
    key: keyof BranchPermission,
  ) => {
    const lockedReason = getLockedReason(editRoleIds, key);

    if (lockedReason) {
      setMessage(lockedReason);
      return;
    }

    setEditBranchPermissions((prev) => {
      const row = prev[branchId] || defaultBranchPermission(branchId);
      const next = applySmartDependencies(row, key, !Boolean(row[key]));

      return {
        ...prev,
        [branchId]: {
          ...next,
          branchId,
        },
      };
    });
  };

  const applyBranchPreset = (
    branchId: string,
    preset: "sell" | "stock" | "full" | "clear",
  ) => {
    setEditBranchPermissions((prev) => {
      const base = defaultBranchPermission(branchId);

      const next: BranchPermission =
        preset === "sell"
          ? {
              ...base,
              canView: true,
              canSell: true,
              canCreateOrder: true,
              canHandleReturn: true,
              canViewStock: true,
              canViewCustomer: true,
            }
          : preset === "stock"
            ? {
                ...base,
                canView: true,
                canViewStock: true,
                canManageStock: true,
                canStocktake: true,
                canTransferStock: true,
                canReceiveStock: true,
              }
            : preset === "full"
              ? {
                  ...base,
                  canView: true,
                  canSell: true,
                  canCreateOrder: true,
                  canApproveOrder: true,
                  canCancelOrder: true,
                  canHandleReturn: true,
                  canViewStock: true,
                  canManageStock: true,
                  canStocktake: true,
                  canTransferStock: true,
                  canReceiveStock: true,
                  canViewCustomer: true,
                  canEditCustomer: true,
                }
              : base;

      return {
        ...prev,
        [branchId]: next,
      };
    });
  };

  const saveEmployeeRoleAssignment = async () => {
    if (!editingEmployeeId) return;

    if (!editRoleIds.length) {
      setMessage("Cần chọn ít nhất 1 vai trò.");
      return;
    }

    const branchPermissions = Object.values(editBranchPermissions).filter(
      hasAnyBranchPermission,
    );

    try {
      await apiJson(`/staff/${editingEmployeeId}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({
          roles: editRoleIds,
          branchPermissions,
        }),
      });

      await loadEmployees();
      setSelectedRoleId(editRoleIds[0]);
      setEditingEmployeeId(null);
      setMessage("Đã cập nhật vai trò và quyền chi nhánh cho nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Cập nhật phân quyền thất bại.",
      );
    }
  };

  const changePassword = async (employeeId: string) => {
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setMessage("Mật khẩu mới tối thiểu 4 ký tự.");
      return;
    }

    try {
      await apiJson(`/staff/${employeeId}/password`, {
        method: "PATCH",
        body: JSON.stringify({
          password: newPassword.trim(),
        }),
      });

      setNewPassword("");
      setResetPasswordForId(null);
      setMessage("Đã đổi mật khẩu nhân viên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Đổi mật khẩu thất bại.");
    }
  };

  const updateRolePermission = (
    roleId: string,
    groupKey: PermissionGroupKey,
    permissionName: string,
    checked: boolean,
  ) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;

        const currentSet = new Set(role.permissions[groupKey] || []);

        if (checked) currentSet.add(permissionName);
        else currentSet.delete(permissionName);

        return {
          ...role,
          updatedAt: new Date().toLocaleDateString("vi-VN"),
          permissions: {
            ...role.permissions,
            [groupKey]: Array.from(currentSet),
          },
        };
      }),
    );

    setMessage("Đã cập nhật quyền của role.");
  };

  const togglePermissionGroup = (
    roleId: string,
    groupKey: PermissionGroupKey,
    checked: boolean,
  ) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;

        return {
          ...role,
          updatedAt: new Date().toLocaleDateString("vi-VN"),
          permissions: {
            ...role.permissions,
            [groupKey]: checked
              ? [...permissionGroupMeta[groupKey].allPermissions]
              : [],
          },
        };
      }),
    );

    setMessage("Đã cập nhật nhóm quyền.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Phân quyền
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Gán user vào role, nhìn nhanh role đang có quyền gì và chỉnh quyền chi
          tiết theo từng nhóm.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          title="Tổng vai trò"
          value={roles.length}
          sub="Bản tinh gọn"
        />
        <StatCard
          title="Role theo chi nhánh"
          value={branchRoles}
          sub="Chỉ thấy dữ liệu chi nhánh phụ trách"
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
        <div className="p-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Tên nhân viên"
            />
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Mã nhân viên"
            />
            <input
              className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
              value={quickUsername}
              onChange={(e) => setQuickUsername(e.target.value)}
              placeholder="Tên đăng nhập"
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-600">
              Vai trò:
            </span>
            {roles.map((role) => (
              <label
                key={role.id}
                className="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
              >
                <input
                  type="checkbox"
                  checked={quickRoleIds.includes(role.id)}
                  onChange={() =>
                    toggleRoleId(role.id, quickRoleIds, setQuickRoleIds)
                  }
                />
                {role.name}
              </label>
            ))}
            <Button onClick={quickAssignUser} className="ml-auto h-12">
              + Tạo nhân viên
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  Danh sách vai trò
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Chọn role để xem phạm vi, user được gán và quyền chi tiết.
                </p>
              </div>
              <Badge tone="blue">Role → User → Branch</Badge>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-200 text-sm text-neutral-400">
                    <th className="pb-3 font-medium">Vai trò</th>
                    <th className="pb-3 font-medium">Đang làm</th>
                    <th className="pb-3 font-medium">Phạm vi</th>
                    <th className="pb-3 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`cursor-pointer border-b border-neutral-100 transition ${
                        selectedRoleId === role.id
                          ? "bg-neutral-50"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <td className="py-4">
                        <div className="font-medium text-neutral-900">
                          {role.name}
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">
                          {role.updatedAt}
                        </div>
                      </td>
                      <td className="py-4 text-sm text-neutral-700">
                        {
                          employees.filter(
                            (employee) =>
                              (employee.roles.includes(role.id) ||
                                employee.roleId === role.id) &&
                              employee.status === "ACTIVE",
                          ).length
                        }
                      </td>
                      <td className="py-4">
                        <Badge
                          tone={role.scope === "ALL_BRANCHES" ? "red" : "blue"}
                        >
                          {scopeBadge(role.scope)}
                        </Badge>
                      </td>
                      <td className="py-4 text-sm text-neutral-500">
                        {role.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-semibold text-neutral-900">
              {selectedRole.name}
            </h3>
            <Badge tone="blue">{scopeBadge(selectedRole.scope)}</Badge>
            <Badge tone="amber">{selectedRole.note}</Badge>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {selectedRole.description}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Đang được gán</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
                {roleEmployees.length}
              </p>
            </div>
            <div className="rounded-3xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Ngày tạo</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
                {selectedRole.createdAt}
              </p>
            </div>
            <div className="rounded-3xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Cập nhật cuối</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
                {selectedRole.updatedAt}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-neutral-900">
                Role đang có quyền gì
              </h4>
              <Badge tone="blue">Role summary</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-neutral-200 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-neutral-900">
                      {item.title}
                    </span>
                    <Badge tone={item.enabled ? "green" : "gray"}>
                      {item.enabled ? `${item.count} quyền` : "Không có"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-neutral-900">
              User đang được gán role này
            </h3>
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-medium text-neutral-900">
                          {employee.name}
                        </span>
                        <Badge
                          tone={employee.status === "ACTIVE" ? "green" : "gray"}
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

                      {editingEmployeeId === employee.id ? (
                        <div className="mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-neutral-900">
                                Chọn vai trò để tự sinh quyền
                              </h4>
                              <p className="mt-1 text-sm text-neutral-500">
                                Vai trò là bộ quyền mẫu. Tick thêm vai trò sẽ tự cộng quyền; bỏ vai trò sẽ tự gỡ phần quyền do vai trò đó sinh ra. Có thể chỉnh tay từng chi nhánh sau đó.
                              </p>
                            </div>
                            <Badge
                              tone={
                                hasUnsavedPermissionChanges ? "amber" : "green"
                              }
                            >
                              {hasUnsavedPermissionChanges
                                ? "Có thay đổi chưa lưu"
                                : "Đã đồng bộ"}
                            </Badge>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {roles.map((role) => (
                              <label
                                key={role.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                                  editRoleIds.includes(role.id)
                                    ? "border-blue-200 bg-blue-50 text-neutral-900"
                                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={editRoleIds.includes(role.id)}
                                  onChange={() => toggleEditRoleId(role.id)}
                                />
                                <span>{role.name}</span>
                                {editRoleIds.includes(role.id) ? (
                                  <Badge tone="blue">
                                    +{countRoleTemplatePermissions([role.id])} quyền
                                  </Badge>
                                ) : null}
                              </label>
                            ))}
                          </div>

                          <div className="mt-5 space-y-4">
                            {branches.map((branch) => {
                              const row =
                                editBranchPermissions[branch.id] ||
                                defaultBranchPermission(branch.id);
                              const activeCount =
                                branchPermissionColumns.filter((column) =>
                                  Boolean(row[column.key]),
                                ).length;

                              return (
                                <div
                                  key={branch.id}
                                  className={`rounded-3xl border p-4 ${
                                    activeCount
                                      ? "border-blue-200 bg-blue-50/30"
                                      : "border-neutral-200 bg-white"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h5 className="font-semibold text-neutral-900">
                                          {branch.name}
                                        </h5>
                                        <Badge
                                          tone={activeCount ? "blue" : "gray"}
                                        >
                                          {activeCount
                                            ? `${activeCount} quyền`
                                            : "Chưa cấp quyền"}
                                        </Badge>
                                        {getBranchModes(row).map((mode) => (
                                          <Badge
                                            key={mode.label}
                                            tone={mode.tone}
                                          >
                                            {mode.label}
                                          </Badge>
                                        ))}
                                      </div>
                                      <p className="mt-1 text-xs text-neutral-500">
                                        Cấp quyền riêng cho nhân viên tại chi
                                        nhánh này. Không tick thì nhân viên
                                        không thao tác ở chi nhánh này.
                                      </p>
                                      {getPermissionWarnings(row).length ? (
                                        <div className="mt-2 space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                          {getPermissionWarnings(row).map(
                                            (warning) => (
                                              <p key={warning}>⚠ {warning}</p>
                                            ),
                                          )}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                        onClick={() =>
                                          applyBranchPreset(branch.id, "sell")
                                        }
                                      >
                                        Preset bán
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                        onClick={() =>
                                          applyBranchPreset(branch.id, "stock")
                                        }
                                      >
                                        Preset kho
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                        onClick={() =>
                                          applyBranchPreset(branch.id, "full")
                                        }
                                      >
                                        Full vận hành
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                        onClick={() =>
                                          applyBranchPreset(branch.id, "clear")
                                        }
                                      >
                                        Xóa quyền
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                    {branchPermissionGroups.map((group) => {
                                      const groupChecked =
                                        group.permissions.filter((permission) =>
                                          Boolean(row[permission.key]),
                                        ).length;
                                      const groupAllChecked =
                                        group.permissions.length > 0 &&
                                        group.permissions.every((permission) =>
                                          Boolean(row[permission.key]),
                                        );

                                      return (
                                        <div
                                          key={group.id}
                                          className={`rounded-3xl border p-4 transition ${
                                            groupChecked
                                              ? "border-blue-200 bg-white shadow-sm"
                                              : "border-neutral-200 bg-white opacity-80"
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <div className="flex flex-wrap items-center gap-2">
                                                <h6 className="font-semibold text-neutral-900">
                                                  {group.title}
                                                </h6>
                                                <Badge
                                                  tone={
                                                    groupChecked
                                                      ? group.tone
                                                      : "gray"
                                                  }
                                                >
                                                  {groupChecked}/
                                                  {group.permissions.length}
                                                </Badge>
                                              </div>
                                              <p className="mt-1 text-xs text-neutral-500">
                                                {group.desc}
                                              </p>
                                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                                                <div
                                                  className="h-full rounded-full bg-neutral-900 transition-all"
                                                  style={{
                                                    width: `${Math.round((groupChecked / group.permissions.length) * 100)}%`,
                                                  }}
                                                />
                                              </div>
                                            </div>

                                            <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700">
                                              <input
                                                type="checkbox"
                                                checked={groupAllChecked}
                                                onChange={(e) => {
                                                  setEditBranchPermissions(
                                                    (prev) => {
                                                      const current =
                                                        prev[branch.id] ||
                                                        defaultBranchPermission(
                                                          branch.id,
                                                        );
                                                      const next: BranchPermission =
                                                        {
                                                          ...current,
                                                          branchId: branch.id,
                                                        };

                                                      group.permissions.forEach(
                                                        (permission) => {
                                                          if (
                                                            getLockedReason(
                                                              editRoleIds,
                                                              permission.key,
                                                            )
                                                          )
                                                            return;
                                                          Object.assign(
                                                            next,
                                                            applySmartDependencies(
                                                              next,
                                                              permission.key,
                                                              e.target.checked,
                                                            ),
                                                          );
                                                        },
                                                      );

                                                      return {
                                                        ...prev,
                                                        [branch.id]: next,
                                                      };
                                                    },
                                                  );
                                                }}
                                              />
                                              Cả nhóm
                                            </label>
                                          </div>

                                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            {group.permissions.map(
                                              (permission) => {
                                                const lockedReason =
                                                  getLockedReason(
                                                    editRoleIds,
                                                    permission.key,
                                                  );
                                                const checked = Boolean(
                                                  row[permission.key],
                                                );

                                                return (
                                                  <label
                                                    key={permission.key}
                                                    title={
                                                      lockedReason ||
                                                      permission.hint ||
                                                      ""
                                                    }
                                                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${
                                                      lockedReason
                                                        ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                                                        : checked
                                                          ? "border-blue-200 bg-blue-50 text-neutral-900"
                                                          : "border-neutral-200 bg-white text-neutral-700"
                                                    }`}
                                                  >
                                                    <span>
                                                      {permission.label}
                                                    </span>
                                                    <input
                                                      type="checkbox"
                                                      checked={checked}
                                                      disabled={Boolean(
                                                        lockedReason,
                                                      )}
                                                      onChange={() =>
                                                        toggleEditBranchPermission(
                                                          branch.id,
                                                          permission.key,
                                                        )
                                                      }
                                                    />
                                                  </label>
                                                );
                                              },
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              variant="primary"
                              onClick={saveEmployeeRoleAssignment}
                              disabled={!hasUnsavedPermissionChanges}
                            >
                              Lưu thay đổi
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setEditingEmployeeId(null)}
                            >
                              Hủy
                            </Button>
                          </div>
                        </div>
                      ) : null}

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
                            variant="primary"
                            onClick={() => changePassword(employee.id)}
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
                            onChange={(e) => {
                              const value = e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 6);
                              setSecondPassword(value);
                            }}
                            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                            placeholder="PIN bảo mật 6 số"
                          />

                          <Button
                            variant="primary"
                            onClick={async () => {
                              if (!/^\d{6}$/.test(secondPassword)) {
                                setMessage("PIN phải gồm đúng 6 số.");
                                return;
                              }

                              if (
                                [
                                  "000000",
                                  "111111",
                                  "123456",
                                  "654321",
                                ].includes(secondPassword)
                              ) {
                                setMessage("PIN quá dễ đoán, hãy đặt mã khác.");
                                return;
                              }

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

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => startEditEmployee(employee)}
                        >
                          Sửa quyền chi nhánh
                        </Button>

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
                        >
                          {employee.status === "ACTIVE"
                            ? "Cho nghỉ"
                            : "Kích hoạt lại"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Danh sách quyền hệ thống
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Đây là từ điển quyền cố định. Tên quyền bên phải trùng 100% với
                quyền đang cấp theo từng chi nhánh bên trái.
              </p>
            </div>
            <Badge tone="blue">Permission dictionary</Badge>
          </div>

          <div className="mt-4 space-y-4">
            {(Object.keys(permissionGroupMeta) as PermissionGroupKey[]).map(
              (key) => {
                const meta = permissionGroupMeta[key];
                const currentPermissions = selectedRole.permissions[key] || [];
                const allChecked = groupHasAllPermissions(selectedRole, key);
                return (
                  <details
                    key={key}
                    open
                    className="group rounded-3xl border border-neutral-200 bg-white px-4 py-4"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-medium text-neutral-900">
                            {meta.title}
                          </span>
                          <Badge
                            tone={currentPermissions.length ? "blue" : "gray"}
                          >
                            {currentPermissions.length
                              ? `${currentPermissions.length} quyền`
                              : "Không có"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-neutral-500">
                          {meta.desc}
                        </p>
                        <p className="mt-3 text-sm italic text-neutral-600">
                          {groupPermissionSummary(selectedRole, key)}
                        </p>
                      </div>
                      <span className="mt-1 text-neutral-400 transition group-open:rotate-90">
                        ›
                      </span>
                    </summary>

                    <div className="mt-4 border-t border-neutral-200 pt-4">
                      <label className="mb-4 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          disabled={false}
                          onChange={(e) =>
                            togglePermissionGroup(
                              selectedRole.id,
                              key,
                              e.target.checked,
                            )
                          }
                        />
                        Tick toàn bộ nhóm {meta.title}
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        {meta.allPermissions.map((permissionName) => {
                          const checked =
                            currentPermissions.includes(permissionName);

                          return (
                            <label
                              key={permissionName}
                              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm border-neutral-200 text-neutral-700`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={false}
                                onChange={(e) =>
                                  updateRolePermission(
                                    selectedRole.id,
                                    key,
                                    permissionName,
                                    e.target.checked,
                                  )
                                }
                              />
                              <span
                                className={checked ? "text-neutral-900" : ""}
                              >
                                {permissionName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                );
              },
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
