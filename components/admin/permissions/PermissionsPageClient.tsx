"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getBranches, type BranchItem } from "@/lib/products-api";

type Tone =
  | "slate"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "cyan"
  | "rose"
  | "emerald";

type PermissionRisk = "low" | "medium" | "high" | "critical";

type PermissionAction = {
  key: string;
  label: string;
  desc?: string;
  risk?: PermissionRisk;
  legacyKeys?: string[];
};

type PermissionModule = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: Tone;
  actions: PermissionAction[];
};

type RoleScope = "ALL_BRANCHES" | "ONE_BRANCH";

type RoleItem = {
  id: string;
  name: string;
  scope: RoleScope;
  description: string;
  badge: string;
  tone: Tone;
  defaultPermissionKeys: string[];
};

type BranchPermission = {
  id?: string;
  staffId?: string;
  branchId: string;
  permissionKeys?: string[];
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
  permissionKeys: string[];
  branchPermissions: BranchPermission[];
  branchRoles: BranchRoleItem[];
  status: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  lastLoginAt?: string | null;
};

const ROLE_STORAGE_KEY = "the1970.permission.enterprise.roleTemplates.v1";

const AUDIT_STORAGE_KEY = "the1970.permission.audit.timeline.v1";

type PermissionAuditEvent = {
  id: string;
  actor: string;
  employeeName: string;
  employeeCode: string;
  action: string;
  createdAt: string;
  added: string[];
  removed: string[];
};

function readAuditTimeline(): PermissionAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAuditTimeline(events: PermissionAuditEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events.slice(0, 80)));
}

function diffPermissionKeys(before: string[], after: string[]) {
  if (before.includes("*") || after.includes("*")) {
    if (before.includes("*") && after.includes("*")) return { added: [], removed: [] };
    if (after.includes("*")) return { added: ["*"], removed: before.filter((key) => key !== "*") };
    return { added: after.filter((key) => key !== "*"), removed: ["*"] };
  }

  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  return {
    added: after.filter((key) => !beforeSet.has(key)),
    removed: before.filter((key) => !afterSet.has(key)),
  };
}

const MODULE_HEALTH = [
  { module: "Đơn hàng", backend: "orders.*", status: "ready", note: "Controller đã có PermissionGuard + action mapping." },
  { module: "Sản phẩm", backend: "products.*", status: "ready", note: "Import/export/image/master data đã tách quyền." },
  { module: "Chuyển kho", backend: "stock_transfer.*", status: "ready", note: "Create/confirm/receive/cancel đã chặn backend." },
  { module: "Kiểm kho", backend: "stocktake.*", status: "ready", note: "Session/scan/apply/export đã chặn backend." },
  { module: "Nhập kho", backend: "purchase_receipt.*", status: "ready", note: "Pay/import stock/cancel đã có guard." },
  { module: "Inventory", backend: "inventory.*", status: "ready", note: "Adjust/transfer/import/audit đã có guard." },
  { module: "Tài chính", backend: "finance.*", status: "watch", note: "Nên audit tiếp các endpoint reconciliation chuyên sâu." },
];



const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "orders",
    title: "Đơn hàng",
    subtitle: "Tạo đơn, duyệt, đóng gói, thanh toán, hủy, xoá và gán nhân viên.",
    icon: "🧾",
    tone: "blue",
    actions: [
      { key: "menu.orders", label: "Mở menu Đơn hàng", risk: "low" },
      { key: "menu.create_order", label: "Mở menu Tạo đơn", risk: "low" },
      { key: "menu.pos", label: "Mở menu POS", risk: "low" },
      { key: "orders.view_own", label: "Xem đơn của mình", risk: "low" },
      { key: "orders.view", label: "Xem toàn bộ đơn chi nhánh", risk: "medium" },
      { key: "orders.create", label: "Tạo đơn hàng", risk: "medium" },
      { key: "orders.edit", label: "Sửa đơn / gán nhân viên", risk: "high" },
      { key: "orders.approve", label: "Duyệt đơn", risk: "high" },
      { key: "orders.pack_ship", label: "Đóng gói / xuất kho / giao hàng", risk: "high" },
      { key: "orders.pay", label: "Cập nhật thanh toán", risk: "high" },
      { key: "orders.cancel", label: "Hủy đơn", risk: "critical" },
      { key: "orders.delete", label: "Xóa đơn", risk: "critical" },
      { key: "orders.copy", label: "Sao chép đơn", risk: "medium" },
      { key: "orders.print", label: "In đơn / in tem", risk: "low" },
      { key: "orders.cod.edit", label: "Sửa COD / phí thu hộ", risk: "critical" },
      { key: "orders.shipping_fee.edit", label: "Sửa phí giao hàng", risk: "high" },
      { key: "orders.payment_source.edit", label: "Đổi nguồn tiền đơn", risk: "high" },
      { key: "orders.excel.export", label: "Xuất Excel đơn hàng", risk: "medium" },
      { key: "orders.excel.import", label: "Nhập Excel đơn hàng", risk: "high" },
    ],
  },
  {
    id: "products",
    title: "Sản phẩm",
    subtitle: "Danh sách, chi tiết, variant, giá bán, giá vốn, ảnh, danh mục và Excel.",
    icon: "🏷️",
    tone: "purple",
    actions: [
      { key: "menu.products", label: "Mở menu Sản phẩm", risk: "low" },
      { key: "products.view", label: "Xem sản phẩm", risk: "low" },
      { key: "products.create", label: "Tạo sản phẩm", risk: "high" },
      { key: "products.edit", label: "Sửa sản phẩm", risk: "high" },
      { key: "products.delete", label: "Xóa sản phẩm", risk: "critical" },
      { key: "products.price.edit", label: "Sửa giá bán", risk: "high" },
      { key: "products.status.edit", label: "Ngừng bán / mở bán", risk: "high" },
      { key: "products.variant.create", label: "Thêm biến thể / SKU", risk: "high" },
      { key: "products.image.upload", label: "Upload ảnh sản phẩm", risk: "medium" },
      { key: "products.cost.view", label: "Xem giá vốn", risk: "critical" },
      { key: "products.cost.edit", label: "Sửa giá vốn", risk: "critical" },
      { key: "products.master_data.manage", label: "Đồng bộ/ghép danh mục, merge, clear mô tả", risk: "critical" },
      { key: "products.excel.export", label: "Xuất Excel sản phẩm", risk: "medium" },
      { key: "products.excel.import", label: "Nhập Excel sản phẩm", risk: "critical" },
    ],
  },
  {
    id: "inventory",
    title: "Kho & tồn",
    subtitle: "Xem tồn, ledger, chỉnh tồn, chuyển tồn trực tiếp, import/audit file SAPO.",
    icon: "📦",
    tone: "amber",
    actions: [
      { key: "menu.inventory", label: "Mở menu Kho", risk: "low" },
      { key: "inventory.view", label: "Xem tồn kho", risk: "low" },
      { key: "inventory.value.view", label: "Xem giá trị tồn / tiền vốn", risk: "critical" },
      { key: "inventory.logs.view", label: "Xem lịch sử kho / ledger", risk: "medium" },
      { key: "inventory.adjust", label: "Điều chỉnh tồn kho IN/OUT/SET", risk: "critical" },
      { key: "inventory.transfer", label: "Chuyển tồn trực tiếp", risk: "critical" },
      { key: "inventory.excel.import", label: "Import báo cáo tồn kho", risk: "critical" },
      { key: "inventory.excel.audit", label: "Đối chiếu file SAPO", risk: "high" },
    ],
  },
  {
    id: "stock_transfer",
    title: "Chuyển kho",
    subtitle: "Phiếu chuyển kho, xác nhận, nhận hàng, hủy phiếu và auto rebalance.",
    icon: "🔁",
    tone: "cyan",
    actions: [
      { key: "menu.stock_transfers", label: "Mở menu Chuyển kho", risk: "low" },
      { key: "stock_transfer.view", label: "Xem phiếu chuyển", risk: "low" },
      { key: "stock_transfer.create", label: "Tạo phiếu chuyển", risk: "high" },
      { key: "stock_transfer.edit", label: "Sửa phiếu chuyển", risk: "high" },
      { key: "stock_transfer.confirm", label: "Xác nhận chuyển", risk: "critical" },
      { key: "stock_transfer.receive", label: "Nhận hàng vào kho", risk: "critical" },
      { key: "stock_transfer.cancel", label: "Hủy / xoá phiếu chuyển", risk: "critical" },
      { key: "stock_transfer.auto_rebalance", label: "Auto rebalance / tạo gợi ý", risk: "critical" },
    ],
  },
  {
    id: "stocktake",
    title: "Kiểm kho",
    subtitle: "Phiên kiểm realtime, join, scan, pause/resume, chốt tồn, export/import.",
    icon: "📋",
    tone: "emerald",
    actions: [
      { key: "menu.stocktake", label: "Mở menu Kiểm kho", risk: "low" },
      { key: "stocktake.view", label: "Xem kiểm kho / lịch sử phiên", risk: "low" },
      { key: "stocktake.create", label: "Tạo phiên kiểm", risk: "high" },
      { key: "stocktake.join", label: "Join phiên kiểm", risk: "medium" },
      { key: "stocktake.edit", label: "Pause/Resume/Sửa phiên", risk: "high" },
      { key: "stocktake.scan", label: "Scan SKU realtime", risk: "high" },
      { key: "stocktake.confirm", label: "Kết thúc/xác nhận phiên", risk: "critical" },
      { key: "stocktake.apply", label: "Chốt tồn kho thật", risk: "critical" },
      { key: "stocktake.cancel", label: "Hủy phiên kiểm", risk: "critical" },
      { key: "stocktake.delete", label: "Xóa phiên kiểm", risk: "critical" },
      { key: "stocktake.excel.export", label: "Xuất Excel kiểm kho", risk: "medium" },
      { key: "stocktake.excel.import", label: "Nhập Excel kiểm kho", risk: "high" },
    ],
  },
  {
    id: "purchase_receipt",
    title: "Nhập kho",
    subtitle: "Phiếu nhập, giá nhập, thanh toán NCC, nhập hàng vào kho và hoàn tất.",
    icon: "📥",
    tone: "green",
    actions: [
      { key: "menu.purchase_receipts", label: "Mở menu Phiếu nhập", risk: "low" },
      { key: "purchase_receipt.view", label: "Xem phiếu nhập", risk: "low" },
      { key: "purchase_receipt.create", label: "Tạo phiếu nhập", risk: "high" },
      { key: "purchase_receipt.edit", label: "Sửa phiếu nhập", risk: "high" },
      { key: "purchase_receipt.request_payment", label: "Yêu cầu thanh toán NCC", risk: "high" },
      { key: "purchase_receipt.pay", label: "Thanh toán phiếu nhập", risk: "critical" },
      { key: "purchase_receipt.import_stock", label: "Nhập hàng vào kho", risk: "critical" },
      { key: "purchase_receipt.complete", label: "Hoàn tất phiếu nhập", risk: "high" },
      { key: "purchase_receipt.cancel", label: "Hủy phiếu nhập", risk: "critical" },
      { key: "purchase_receipt.cost.view", label: "Xem giá nhập", risk: "critical" },
      { key: "purchase_receipt.cost.edit", label: "Sửa giá nhập", risk: "critical" },
    ],
  },
  {
    id: "finance",
    title: "Tài chính & đối soát",
    subtitle: "Đối soát nội thành, GHN, nguồn tiền, COD, dòng tiền.",
    icon: "💳",
    tone: "rose",
    actions: [
      { key: "menu.finance", label: "Mở menu Tài chính", risk: "low" },
      { key: "menu.finance_local_delivery", label: "Menu đối soát nội thành", risk: "medium" },
      { key: "menu.finance_ghn_reconciliation", label: "Menu đối soát GHN", risk: "medium" },
      { key: "finance.view", label: "Xem tài chính", risk: "high" },
      { key: "finance.local_delivery.view", label: "Xem đối soát nội thành", risk: "medium" },
      { key: "finance.local_delivery.confirm", label: "Xác nhận COD nội thành", risk: "critical" },
      { key: "finance.ghn.view", label: "Xem đối soát GHN", risk: "high" },
      { key: "finance.ghn.import", label: "Import file đối soát GHN", risk: "critical" },
      { key: "finance.payment_source.manage", label: "Quản lý nguồn tiền", risk: "critical" },
    ],
  },
  {
    id: "customers",
    title: "Khách hàng & đổi trả",
    subtitle: "Thông tin khách, địa chỉ, đổi trả hàng và bảo hành.",
    icon: "👥",
    tone: "slate",
    actions: [
      { key: "menu.customers", label: "Mở menu Khách hàng", risk: "low" },
      { key: "customers.view_own", label: "Xem khách mình phụ trách", risk: "low" },
      { key: "customers.view", label: "Xem toàn bộ khách", risk: "medium" },
      { key: "customers.create", label: "Tạo khách hàng", risk: "medium" },
      { key: "customers.edit", label: "Sửa khách hàng", risk: "high" },
      { key: "customers.delete", label: "Xóa khách hàng", risk: "critical" },
      { key: "returns.view", label: "Xem đổi trả", risk: "medium" },
      { key: "returns.create", label: "Tạo đổi trả", risk: "high" },
      { key: "returns.refund", label: "Hoàn tiền đổi trả", risk: "critical" },
    ],
  },
  {
    id: "system",
    title: "Hệ thống",
    subtitle: "Phân quyền, cấu hình, chi nhánh, audit, tích hợp và autopilot.",
    icon: "🛡️",
    tone: "red",
    actions: [
      { key: "permissions.view", label: "Xem phân quyền", risk: "critical" },
      { key: "permissions.manage", label: "Quản lý phân quyền", risk: "critical" },
      { key: "system.manage", label: "Quản lý hệ thống", risk: "critical" },
      { key: "branches.manage", label: "Quản lý chi nhánh", risk: "critical" },
      { key: "staff.manage", label: "Quản lý nhân viên", risk: "critical" },
      { key: "audit.view", label: "Xem audit log", risk: "high" },
      { key: "carriers.manage", label: "Cấu hình hãng vận chuyển", risk: "high" },
      { key: "autopilot.view", label: "Xem Autopilot", risk: "medium" },
      { key: "autopilot.manage", label: "Quản lý Autopilot", risk: "critical" },
    ],
  },
];

const ALL_PERMISSION_KEYS = Array.from(
  new Set(PERMISSION_MODULES.flatMap((module) => module.actions.map((action) => action.key))),
);

const DANGEROUS_KEYS = new Set(
  PERMISSION_MODULES.flatMap((module) =>
    module.actions
      .filter((action) => action.risk === "critical")
      .map((action) => action.key),
  ),
);

const ROLE_TEMPLATES: RoleItem[] = [
  {
    id: "owner",
    name: "Owner",
    scope: "ALL_BRANCHES",
    description: "Toàn quyền tuyệt đối, dùng cho chủ hệ thống.",
    badge: "Root Access",
    tone: "red",
    defaultPermissionKeys: ["*"],
  },
  {
    id: "admin",
    name: "Admin vận hành",
    scope: "ALL_BRANCHES",
    description: "Quản trị hệ thống, xem/sửa phần lớn module nhưng vẫn có thể giới hạn theo chi nhánh.",
    badge: "System Admin",
    tone: "purple",
    defaultPermissionKeys: [
      ...ALL_PERMISSION_KEYS.filter((key) => key !== "orders.delete"),
    ],
  },
  {
    id: "branch-manager",
    name: "Quản lý chi nhánh",
    scope: "ONE_BRANCH",
    description: "Quản lý bán hàng/kho trong chi nhánh được giao.",
    badge: "Branch Manager",
    tone: "blue",
    defaultPermissionKeys: [
      "menu.orders",
      "menu.create_order",
      "menu.pos",
      "menu.products",
      "menu.inventory",
      "menu.stock_transfers",
      "menu.stocktake",
      "orders.view",
      "orders.view_own",
      "orders.create",
      "orders.edit",
      "orders.approve",
      "orders.pack_ship",
      "orders.pay",
      "orders.cancel",
      "orders.copy",
      "orders.print",
      "products.view",
      "inventory.view",
      "inventory.logs.view",
      "stock_transfer.view",
      "stock_transfer.create",
      "stock_transfer.confirm",
      "stock_transfer.receive",
      "stocktake.view",
      "stocktake.create",
      "stocktake.join",
      "stocktake.edit",
      "stocktake.scan",
      "customers.view",
      "customers.create",
      "customers.edit",
    ],
  },
  {
    id: "fulltime",
    name: "Nhân viên fulltime",
    scope: "ONE_BRANCH",
    description: "Tạo đơn, xử lý đơn, xem tồn và tham gia kiểm/chuyển kho cơ bản.",
    badge: "Fulltime",
    tone: "green",
    defaultPermissionKeys: [
      "menu.orders",
      "menu.create_order",
      "menu.pos",
      "menu.products",
      "menu.inventory",
      "orders.view_own",
      "orders.create",
      "orders.approve",
      "orders.pack_ship",
      "orders.copy",
      "orders.print",
      "products.view",
      "inventory.view",
      "stock_transfer.view",
      "stocktake.view",
      "stocktake.join",
      "stocktake.scan",
      "customers.view_own",
      "customers.create",
    ],
  },
  {
    id: "retail-staff",
    name: "Nhân viên bán lẻ",
    scope: "ONE_BRANCH",
    description: "Bán hàng/POS, tạo đơn và xem tồn cơ bản.",
    badge: "Retail Staff",
    tone: "slate",
    defaultPermissionKeys: [
      "menu.orders",
      "menu.create_order",
      "menu.pos",
      "menu.products",
      "orders.view_own",
      "orders.create",
      "orders.print",
      "products.view",
      "inventory.view",
      "customers.view_own",
      "customers.create",
    ],
  },
  {
    id: "stock-staff",
    name: "Nhân viên kho",
    scope: "ONE_BRANCH",
    description: "Xử lý kho, chuyển hàng, nhận hàng và kiểm kho.",
    badge: "Warehouse",
    tone: "amber",
    defaultPermissionKeys: [
      "menu.inventory",
      "menu.stock_transfers",
      "menu.stocktake",
      "menu.products",
      "products.view",
      "inventory.view",
      "inventory.logs.view",
      "stock_transfer.view",
      "stock_transfer.create",
      "stock_transfer.confirm",
      "stock_transfer.receive",
      "stocktake.view",
      "stocktake.create",
      "stocktake.join",
      "stocktake.edit",
      "stocktake.scan",
      "stocktake.confirm",
    ],
  },
  {
    id: "stock-auditor",
    name: "Nhân viên kiểm kho",
    scope: "ONE_BRANCH",
    description: "Chỉ kiểm kho và đối chiếu tồn, không xử lý đơn bán.",
    badge: "Auditor",
    tone: "cyan",
    defaultPermissionKeys: [
      "menu.inventory",
      "menu.stocktake",
      "menu.products",
      "products.view",
      "inventory.view",
      "inventory.logs.view",
      "stocktake.view",
      "stocktake.join",
      "stocktake.scan",
    ],
  },
];

const LEGACY_PERMISSION_MAP: Record<keyof BranchPermission, string[]> = {
  branchId: [],
  id: [],
  staffId: [],
  note: [],
  permissionKeys: [],
  canView: ["products.view", "menu.products"],
  canSell: ["menu.pos"],
  canViewOwnOrders: ["orders.view_own", "menu.orders"],
  canViewBranchOrders: ["orders.view", "menu.orders"],
  canCreateOrder: ["orders.create", "menu.create_order"],
  canApproveOrder: ["orders.approve"],
  canCancelOrder: ["orders.cancel"],
  canHandleReturn: ["returns.view", "returns.create"],
  canViewStock: ["inventory.view", "menu.inventory"],
  canManageStock: ["inventory.adjust", "inventory.transfer"],
  canStocktake: ["stocktake.view", "stocktake.scan", "menu.stocktake"],
  canTransferStock: ["stock_transfer.view", "stock_transfer.create", "menu.stock_transfers"],
  canReceiveStock: ["stock_transfer.receive", "purchase_receipt.import_stock"],
  canViewCustomer: ["customers.view_own"],
  canEditCustomer: ["customers.edit"],
  canExportProductExcel: ["products.excel.export"],
  canImportProductExcel: ["products.excel.import"],
  canExportOrderExcel: ["orders.excel.export"],
  canExportInventoryExcel: ["inventory.excel.audit"],
  canExportCustomerExcel: ["customers.view"],
};

const toneClasses: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-green-200 bg-green-50 text-green-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  purple: "border-purple-200 bg-purple-50 text-purple-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeRole(value?: any) {
  return String(value || "").trim().toLowerCase();
}

function getRoleTemplate(roleCode?: string | null) {
  return ROLE_TEMPLATES.find((role) => role.id === normalizeRole(roleCode));
}

function getRoleName(roleCode?: string | null) {
  return getRoleTemplate(roleCode)?.name || roleCode || "Chưa gán";
}

function safeArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function getBranchName(branches: BranchItem[], branchId?: string | null) {
  if (!branchId) return "Toàn hệ thống";
  return branches.find((branch) => String(branch.id) === String(branchId))?.name || branchId;
}

function getEmployeeRoles(item: any): string[] {
  const relationRoles = safeArray(item?.roles)
    .map((role: any) => normalizeRole(role?.roleCode || role?.code || role?.id || role))
    .filter(Boolean);
  const branchRoles = safeArray(item?.branchRoles)
    .map((role: any) => normalizeRole(role?.roleCode))
    .filter(Boolean);
  const legacyRole = item?.role ? [normalizeRole(item.role)] : [];
  return unique([...relationRoles, ...branchRoles, ...legacyRole]);
}

function getPermissionKeysFromBranchPermission(row: BranchPermission) {
  const keys = new Set<string>(safeArray<string>(row.permissionKeys));
  (Object.keys(LEGACY_PERMISSION_MAP) as Array<keyof BranchPermission>).forEach((legacyKey) => {
    if (Boolean(row[legacyKey])) {
      LEGACY_PERMISSION_MAP[legacyKey].forEach((key) => keys.add(key));
    }
  });
  return Array.from(keys);
}

function getEmployeeEffectiveKeys(employee?: EmployeeItem | null) {
  if (!employee) return [];
  const keys = new Set<string>();
  safeArray<string>(employee.permissionKeys).forEach((key) => keys.add(key));
  employee.roles.forEach((roleCode) => {
    const role = getRoleTemplate(roleCode);
    role?.defaultPermissionKeys.forEach((key) => keys.add(key));
  });
  employee.branchPermissions.forEach((row) => {
    getPermissionKeysFromBranchPermission(row).forEach((key) => keys.add(key));
  });
  if (employee.roles.includes("owner") || employee.roles.includes("admin") || keys.has("*")) return ["*"];
  return Array.from(keys);
}

function permissionGranted(keys: string[], permission: string) {
  return keys.includes("*") || keys.includes(permission);
}

function riskTone(risk: PermissionRisk = "low"): Tone {
  if (risk === "critical") return "red";
  if (risk === "high") return "amber";
  if (risk === "medium") return "blue";
  return "slate";
}

function riskLabel(risk: PermissionRisk = "low") {
  if (risk === "critical") return "Nguy hiểm";
  if (risk === "high") return "Cao";
  if (risk === "medium") return "Vừa";
  return "Thấp";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa đăng nhập";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa đăng nhập";
  return date.toLocaleString("vi-VN");
}

function defaultBranchPermission(branchId: string): BranchPermission {
  return {
    branchId,
    permissionKeys: [],
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

function buildLegacyFlags(keys: string[], branchId: string): BranchPermission {
  const has = (permission: string) => permissionGranted(keys, permission);
  return {
    branchId,
    permissionKeys: keys.filter((key) => key !== "*"),
    canView: has("products.view"),
    canSell: has("menu.pos"),
    canViewOwnOrders: has("orders.view_own"),
    canViewBranchOrders: has("orders.view"),
    canCreateOrder: has("orders.create"),
    canApproveOrder: has("orders.approve"),
    canCancelOrder: has("orders.cancel"),
    canHandleReturn: has("returns.create") || has("returns.view"),
    canViewStock: has("inventory.view"),
    canManageStock: has("inventory.adjust") || has("inventory.transfer"),
    canStocktake: has("stocktake.view") || has("stocktake.scan"),
    canTransferStock: has("stock_transfer.create") || has("stock_transfer.view"),
    canReceiveStock: has("stock_transfer.receive") || has("purchase_receipt.import_stock"),
    canViewCustomer: has("customers.view") || has("customers.view_own"),
    canEditCustomer: has("customers.edit"),
    canExportProductExcel: has("products.excel.export"),
    canImportProductExcel: has("products.excel.import"),
    canExportOrderExcel: has("orders.excel.export"),
    canExportInventoryExcel: has("inventory.excel.audit"),
    canExportCustomerExcel: has("customers.view"),
  };
}

function sanitizeBranchPermission(row: BranchPermission): BranchPermission {
  const keys = unique(safeArray<string>(row.permissionKeys));
  return {
    ...buildLegacyFlags(keys, row.branchId),
    id: row.id,
    staffId: row.staffId,
    branchId: row.branchId,
    permissionKeys: keys,
    note: row.note || null,
  };
}

function roleKeys(roleCode: string) {
  return getRoleTemplate(roleCode)?.defaultPermissionKeys || [];
}

function employeePrimaryBranch(employee?: EmployeeItem | null) {
  if (!employee) return "";
  return employee.branchId || employee.branchRoles[0]?.branchId || employee.branchPermissions[0]?.branchId || "";
}

function mapApiStaffToEmployee(item: any): EmployeeItem {
  const roles = getEmployeeRoles(item);
  const branchRoles: BranchRoleItem[] = safeArray(item?.branchRoles).map((row: any) => ({
    id: row.id,
    staffId: row.staffId || item.id,
    branchId: row.branchId,
    roleCode: normalizeRole(row.roleCode || row.role || item.role),
    branch: row.branch || null,
  }));

  const branchPermissions: BranchPermission[] = safeArray(item?.branchPermissions).map((row: any) =>
    sanitizeBranchPermission({
      ...row,
      branchId: row.branchId,
      permissionKeys: safeArray(row.permissionKeys),
    }),
  );

  const roleId = roles[0] || normalizeRole(item?.role) || "retail-staff";
  const branchId = item?.branchId || branchRoles[0]?.branchId || branchPermissions[0]?.branchId || null;

  return {
    id: item.id,
    code: item.code || "",
    name: item.name || item.fullName || item.username || "Chưa đặt tên",
    username: item.username || null,
    email: item.email || null,
    phone: item.phone || null,
    address: item.address || null,
    note: item.note || null,
    roleId,
    roles: roles.length ? roles : [roleId],
    branchId,
    branch: item.branch?.name || item.branchName || branchId || "Toàn hệ thống",
    permissionKeys: unique(safeArray(item.permissionKeys).concat(safeArray(item.permissions))),
    branchPermissions,
    branchRoles,
    status: item.status === "INACTIVE" || item.isActive === false ? "INACTIVE" : "ACTIVE",
    isActive: item.isActive !== false,
    lastLoginAt: item.lastLoginAt || null,
  };
}

function buildEmployeeTree(employees: EmployeeItem[], branches: BranchItem[]) {
  return ROLE_TEMPLATES.map((role) => {
    const roleEmployees = employees.filter((employee) => employee.roles.includes(role.id) || employee.roleId === role.id);
    const branchGroups = branches
      .map((branch) => ({
        branch,
        employees: roleEmployees.filter((employee) => {
          const ids = unique([
            employee.branchId || "",
            ...employee.branchRoles.map((item) => item.branchId),
            ...employee.branchPermissions.map((item) => item.branchId),
          ]);
          return ids.includes(branch.id);
        }),
      }))
      .filter((group) => group.employees.length > 0);

    const noBranchEmployees = roleEmployees.filter((employee) => {
      const ids = unique([
        employee.branchId || "",
        ...employee.branchRoles.map((item) => item.branchId),
        ...employee.branchPermissions.map((item) => item.branchId),
      ]);
      return ids.length === 0;
    });

    return { role, employees: roleEmployees, branchGroups, noBranchEmployees };
  });
}

function getEmployeeBranchKeys(employee: EmployeeItem, branchId: string) {
  const row = employee.branchPermissions.find((item) => item.branchId === branchId);
  if (row) return getPermissionKeysFromBranchPermission(row);
  const roleCode = employee.branchRoles.find((item) => item.branchId === branchId)?.roleCode || employee.roleId;
  return roleKeys(roleCode);
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  loading = false,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const tones =
    variant === "primary"
      ? "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800"
      : variant === "danger"
        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : variant === "ghost"
          ? "border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100"
          : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
        tones,
        disabled || loading ? "cursor-not-allowed opacity-55" : "",
        className,
      )}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", toneClasses[tone])}>
      {children}
    </span>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[28px] border border-neutral-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 rounded-full border transition",
        checked ? "border-neutral-950 bg-neutral-950" : "border-neutral-300 bg-neutral-200",
        disabled ? "cursor-not-allowed opacity-50" : "",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          checked ? "left-5" : "left-0.5",
        )}
      />
    </button>
  );
}

function PermissionCheck({
  action,
  checked,
  onChange,
}: {
  action: PermissionAction;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-3 rounded-2xl border p-3 transition",
        checked ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-neutral-900">{action.label}</p>
          <Badge tone={riskTone(action.risk)}>{riskLabel(action.risk)}</Badge>
        </div>
        <p className="mt-1 font-mono text-[11px] text-neutral-400">{action.key}</p>
        {action.desc ? <p className="mt-1 text-xs text-neutral-500">{action.desc}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function PermissionsPageClient() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState(PERMISSION_MODULES[0].id);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const [savedEmployeeId, setSavedEmployeeId] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editMainBranchId, setEditMainBranchId] = useState("");
  const [editBranchRoleMap, setEditBranchRoleMap] = useState<Record<string, string>>({});
  const [editBranchPermissionMap, setEditBranchPermissionMap] = useState<Record<string, string[]>>({});

  const [newPassword, setNewPassword] = useState("");
  const [secondPassword, setSecondPassword] = useState("");
  const [resetPasswordForId, setResetPasswordForId] = useState<string | null>(null);
  const [secondPasswordForId, setSecondPasswordForId] = useState<string | null>(null);
  const [securitySavingForId, setSecuritySavingForId] = useState<string | null>(null);

  const [auditTimeline, setAuditTimeline] = useState<PermissionAuditEvent[]>([]);
  const [lastDiff, setLastDiff] = useState<{ added: string[]; removed: string[] }>({ added: [], removed: [] });
  const [showPreview, setShowPreview] = useState(true);


  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await apiJson<any[]>("/staff", { method: "GET" });
      const mapped = Array.isArray(data) ? data.map(mapApiStaffToEmployee) : [];
      setEmployees(mapped);
      setSelectedEmployeeId((prev) => prev || mapped[0]?.id || null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được danh sách nhân viên.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    void loadBranches();
    void loadEmployees();
  }, []);

  useEffect(() => {
    setAuditTimeline(readAuditTimeline());
  }, []);


  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  useEffect(() => {
    if (!selectedEmployee) return;

    setEditName(selectedEmployee.name || "");
    setEditCode(selectedEmployee.code || "");
    setEditUsername(selectedEmployee.username || "");
    setEditEmail(selectedEmployee.email || "");
    setEditPhone(selectedEmployee.phone || "");
    setEditAddress(selectedEmployee.address || "");
    setEditNote(selectedEmployee.note || "");
    setEditMainBranchId(employeePrimaryBranch(selectedEmployee));

    const nextRoleMap: Record<string, string> = {};
    selectedEmployee.branchRoles.forEach((row) => {
      if (row.branchId && row.roleCode) nextRoleMap[row.branchId] = row.roleCode;
    });

    if (!Object.keys(nextRoleMap).length && selectedEmployee.branchId) {
      nextRoleMap[selectedEmployee.branchId] = selectedEmployee.roleId;
    }

    const nextPermissionMap: Record<string, string[]> = {};
    selectedEmployee.branchPermissions.forEach((row) => {
      nextPermissionMap[row.branchId] = getPermissionKeysFromBranchPermission(row);
    });

    Object.entries(nextRoleMap).forEach(([branchId, roleCode]) => {
      if (!nextPermissionMap[branchId]) {
        nextPermissionMap[branchId] = roleKeys(roleCode);
      }
    });

    setEditBranchRoleMap(nextRoleMap);
    setEditBranchPermissionMap(nextPermissionMap);
    setSelectedBranchId((prev) => prev && (nextRoleMap[prev] || nextPermissionMap[prev]) ? prev : Object.keys(nextRoleMap)[0] || selectedEmployee.branchId || "");
  }, [selectedEmployeeId, selectedEmployee]);

  const employeeTree = useMemo(() => buildEmployeeTree(employees, branches), [employees, branches]);

  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employeeTree;
    return employeeTree
      .map((roleGroup) => {
        const matchedEmployees = roleGroup.employees.filter((employee) =>
          `${employee.name} ${employee.code} ${employee.username || ""} ${employee.email || ""} ${employee.phone || ""}`
            .toLowerCase()
            .includes(q),
        );
        return {
          ...roleGroup,
          employees: matchedEmployees,
          branchGroups: roleGroup.branchGroups
            .map((group) => ({
              ...group,
              employees: group.employees.filter((employee) => matchedEmployees.some((item) => item.id === employee.id)),
            }))
            .filter((group) => group.employees.length),
          noBranchEmployees: roleGroup.noBranchEmployees.filter((employee) =>
            matchedEmployees.some((item) => item.id === employee.id),
          ),
        };
      })
      .filter((group) => group.employees.length);
  }, [employeeTree, query]);

  const selectedModule = PERMISSION_MODULES.find((module) => module.id === selectedModuleId) || PERMISSION_MODULES[0];

  const selectedBranchKeys = useMemo(() => {
    if (!selectedEmployee) return [];
    if (!selectedBranchId) return getEmployeeEffectiveKeys(selectedEmployee);
    return editBranchPermissionMap[selectedBranchId] || getEmployeeBranchKeys(selectedEmployee, selectedBranchId);
  }, [selectedEmployee, selectedBranchId, editBranchPermissionMap]);

  const effectiveKeys = useMemo(
    () => (selectedEmployee ? getEmployeeEffectiveKeys(selectedEmployee) : []),
    [selectedEmployee],
  );

  const dangerousCount = useMemo(
    () => effectiveKeys.filter((key) => key === "*" || DANGEROUS_KEYS.has(key)).length,
    [effectiveKeys],
  );

  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE").length;
  const inactiveEmployees = employees.filter((employee) => employee.status === "INACTIVE").length;

  const toggleBranch = (branchId: string, enabled: boolean) => {
    setEditBranchRoleMap((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[branchId] = selectedEmployee?.roleId || "retail-staff";
      } else {
        delete next[branchId];
      }
      return next;
    });

    setEditBranchPermissionMap((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[branchId] = prev[branchId] || roleKeys(selectedEmployee?.roleId || "retail-staff");
        setSelectedBranchId(branchId);
      } else {
        delete next[branchId];
        if (selectedBranchId === branchId) {
          setSelectedBranchId(Object.keys(next)[0] || "");
        }
      }
      return next;
    });
  };

  const changeBranchRole = (branchId: string, roleCode: string) => {
    setEditBranchRoleMap((prev) => ({ ...prev, [branchId]: roleCode }));
    setEditBranchPermissionMap((prev) => ({ ...prev, [branchId]: roleKeys(roleCode) }));
  };

  const setBranchPermission = (branchId: string, permissionKey: string, enabled: boolean) => {
    if (!branchId) {
      setMessage("Chọn chi nhánh trước khi chỉnh quyền.");
      return;
    }
    setEditBranchPermissionMap((prev) => {
      const current = new Set(prev[branchId] || []);
      if (enabled) current.add(permissionKey);
      else current.delete(permissionKey);
      return { ...prev, [branchId]: Array.from(current) };
    });
  };

  const setModuleAll = (module: PermissionModule, enabled: boolean) => {
    if (!selectedBranchId) return;
    setEditBranchPermissionMap((prev) => {
      const current = new Set(prev[selectedBranchId] || []);
      module.actions.forEach((action) => {
        if (enabled) current.add(action.key);
        else current.delete(action.key);
      });
      return { ...prev, [selectedBranchId]: Array.from(current) };
    });
  };

  const applyPresetToBranch = (roleCode: string) => {
    if (!selectedBranchId) return;
    changeBranchRole(selectedBranchId, roleCode);
  };

  const saveEmployeeProfile = async () => {
    if (!selectedEmployee) return;
    if (!editName.trim() || !editCode.trim()) {
      setMessage("Thiếu tên hoặc mã nhân viên.");
      return;
    }

    try {
      setSavingEmployeeId(selectedEmployee.id);
      setMessage("Đang lưu hồ sơ nhân viên...");
      await apiJson(`/staff/${selectedEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim(),
          username: editUsername.trim() || null,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          address: editAddress.trim() || null,
          note: editNote.trim() || null,
          branchId: editMainBranchId || selectedBranchId || null,
          role: Object.values(editBranchRoleMap)[0] || selectedEmployee.roleId,
        }),
      });
      await loadEmployees();
      setSavedEmployeeId(selectedEmployee.id);
      setMessage("Đã lưu hồ sơ nhân viên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lưu hồ sơ thất bại.");
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const saveEmployeePermissions = async () => {
    if (!selectedEmployee) return;

    const branchRoles = Object.entries(editBranchRoleMap)
      .filter(([branchId, roleCode]) => branchId && roleCode)
      .map(([branchId, roleCode]) => ({ branchId, roleCode }));

    if (!branchRoles.length) {
      setMessage("Cần chọn ít nhất một chi nhánh để lưu quyền.");
      return;
    }

    const branchPermissions = branchRoles.map(({ branchId }) =>
      sanitizeBranchPermission({
        ...(selectedEmployee.branchPermissions.find((row) => row.branchId === branchId) || defaultBranchPermission(branchId)),
        branchId,
        permissionKeys: editBranchPermissionMap[branchId] || [],
      }),
    );

    try {
      setSavingEmployeeId(selectedEmployee.id);
      setSavedEmployeeId(null);
      setMessage("Đang lưu ma trận quyền enterprise...");

      const primary = branchRoles[0];
      const beforeKeys = getEmployeeEffectiveKeys(selectedEmployee);
      const afterKeys = unique(branchPermissions.flatMap((row) => row.permissionKeys || []));
      const diff = diffPermissionKeys(beforeKeys, afterKeys);

      await apiJson(`/staff/${selectedEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: primary.roleCode,
          branchId: editMainBranchId || primary.branchId,
        }),
      });

      await apiJson(`/staff/${selectedEmployee.id}/branch-roles`, {
        method: "PATCH",
        body: JSON.stringify({ branchRoles }),
      });

      await apiJson(`/staff/${selectedEmployee.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({
          roles: unique(branchRoles.map((row) => row.roleCode)),
          branchPermissions,
        }),
      });

      const nextAudit: PermissionAuditEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        actor: "Admin",
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.code,
        action: "Cập nhật phân quyền",
        createdAt: new Date().toISOString(),
        added: diff.added,
        removed: diff.removed,
      };
      const nextTimeline = [nextAudit, ...readAuditTimeline()];
      writeAuditTimeline(nextTimeline);
      setAuditTimeline(nextTimeline);
      setLastDiff(diff);

      await loadEmployees();
      setSavedEmployeeId(selectedEmployee.id);
      setMessage("Đã lưu quyền. Session cũ của nhân viên sẽ bị invalid và cần login lại để nhận quyền mới.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lưu phân quyền thất bại.");
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const changePassword = async () => {
    if (!selectedEmployee) return;
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setMessage("Mật khẩu mới tối thiểu 4 ký tự.");
      return;
    }

    try {
      setSecuritySavingForId(selectedEmployee.id);
      await apiJson(`/staff/${selectedEmployee.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword.trim() }),
      });
      setNewPassword("");
      setResetPasswordForId(null);
      setMessage("Đã đổi mật khẩu nhân viên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Đổi mật khẩu thất bại.");
    } finally {
      setSecuritySavingForId(null);
    }
  };

  const changeSecondPassword = async () => {
    if (!selectedEmployee) return;
    if (!/^\d{6}$/.test(secondPassword)) {
      setMessage("PIN bảo mật phải gồm đúng 6 số.");
      return;
    }
    if (["000000", "111111", "123456", "654321"].includes(secondPassword)) {
      setMessage("PIN quá dễ đoán, hãy đặt mã khác.");
      return;
    }

    try {
      setSecuritySavingForId(selectedEmployee.id);
      await apiJson(`/staff/${selectedEmployee.id}/second-password`, {
        method: "PATCH",
        body: JSON.stringify({ secondPassword }),
      });
      setSecondPassword("");
      setSecondPasswordForId(null);
      setMessage("Đã set PIN bảo mật cho nhân viên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Set PIN thất bại.");
    } finally {
      setSecuritySavingForId(null);
    }
  };

  const toggleEmployeeStatus = async () => {
    if (!selectedEmployee) return;
    const nextStatus = selectedEmployee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setSavingEmployeeId(selectedEmployee.id);
      await apiJson(`/staff/${selectedEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: nextStatus === "ACTIVE",
          status: nextStatus,
        }),
      });
      await loadEmployees();
      setMessage(nextStatus === "ACTIVE" ? "Đã kích hoạt nhân viên." : "Đã khóa tài khoản nhân viên.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại.");
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const saveRoleTemplates = () => {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(ROLE_TEMPLATES));
      setMessage("Đã ghi nhận role template local. Quyền thực tế vẫn lưu theo từng nhân viên/chi nhánh.");
    } catch {
      setMessage("Không lưu được template local.");
    }
  };

  const currentBranchIds = Object.keys(editBranchRoleMap);

  return (
    <div className="min-h-screen space-y-6 bg-[#f5f5f7] p-4 text-neutral-950 md:p-6">
      <section className="overflow-hidden rounded-[34px] bg-neutral-950 text-white shadow-2xl">
        <div className="relative p-6 md:p-8">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-40 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                Enterprise IAM · RBAC · Branch Scope
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
                Hệ thống phân quyền chuyên nghiệp Enterprise
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/68 md:text-base">
                Quản lý nhân viên theo cây Role → Chi nhánh → Người dùng, kiểm soát từng action thật trên hệ thống:
                đơn hàng, sản phẩm, kho, chuyển kho, kiểm kho, nhập kho, đối soát và cấu hình hệ thống.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone="slate">JWT Session Guard</Badge>
                <Badge tone="slate">PermissionGuard Backend</Badge>
                <Badge tone="slate">Session Invalidation</Badge>
                <Badge tone="slate">Branch Scoped Access</Badge>
                <Badge tone="slate">Dangerous Action Control</Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Nhân viên active</p>
                <p className="mt-2 text-4xl font-black">{activeEmployees}</p>
                <p className="mt-1 text-xs text-white/55">{inactiveEmployees} tài khoản đang khóa</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Permission keys</p>
                <p className="mt-2 text-4xl font-black">{ALL_PERMISSION_KEYS.length}</p>
                <p className="mt-1 text-xs text-white/55">Theo module thực tế đang vận hành</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-3xl border border-neutral-200 bg-white px-5 py-4 text-sm font-semibold text-neutral-800 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr_360px]">
        <Panel className="overflow-hidden">
          <div className="border-b border-neutral-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Identity Tree</p>
            <h2 className="mt-1 text-xl font-black">Cây nhân sự</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên, mã, email, SĐT..."
              className="mt-4 h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="max-h-[calc(100vh-260px)] space-y-3 overflow-auto p-4">
            {loadingEmployees ? (
              <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">Đang tải nhân sự...</div>
            ) : null}

            {filteredTree.map((roleGroup) => (
              <div key={roleGroup.role.id} className="rounded-3xl border border-neutral-200 bg-white">
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeId(roleGroup.employees[0]?.id || selectedEmployeeId)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={roleGroup.role.tone}>{roleGroup.role.badge}</Badge>
                      <span className="text-xs font-bold text-neutral-400">{roleGroup.employees.length} người</span>
                    </div>
                    <p className="mt-2 text-sm font-black">{roleGroup.role.name}</p>
                  </div>
                  <span className="text-lg">›</span>
                </button>

                <div className="space-y-2 border-t border-neutral-100 p-3">
                  {roleGroup.branchGroups.map((group) => (
                    <div key={`${roleGroup.role.id}-${group.branch.id}`} className="rounded-2xl bg-neutral-50 p-2">
                      <p className="px-2 py-1 text-[11px] font-black uppercase tracking-wide text-neutral-500">
                        {group.branch.name}
                      </p>
                      <div className="space-y-1">
                        {group.employees.map((employee) => (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            className={cx(
                              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                              selectedEmployeeId === employee.id
                                ? "bg-neutral-950 text-white"
                                : "bg-white text-neutral-800 hover:bg-neutral-100",
                            )}
                          >
                            <span>
                              <span className="font-bold">{employee.name}</span>
                              <span className="block text-[11px] opacity-65">{employee.code}</span>
                            </span>
                            <span className={cx("h-2.5 w-2.5 rounded-full", employee.status === "ACTIVE" ? "bg-emerald-400" : "bg-red-400")} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {roleGroup.noBranchEmployees.length ? (
                    <div className="rounded-2xl bg-neutral-50 p-2">
                      <p className="px-2 py-1 text-[11px] font-black uppercase tracking-wide text-neutral-500">
                        Chưa gán chi nhánh
                      </p>
                      {roleGroup.noBranchEmployees.map((employee) => (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className={cx(
                            "mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                            selectedEmployeeId === employee.id
                              ? "bg-neutral-950 text-white"
                              : "bg-white text-neutral-800 hover:bg-neutral-100",
                          )}
                        >
                          <span className="font-bold">{employee.name}</span>
                          <span className="text-[11px] opacity-65">{employee.code}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Permission Matrix</p>
                <h2 className="mt-1 text-2xl font-black">
                  {selectedEmployee ? selectedEmployee.name : "Chọn nhân viên"}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Tick quyền theo từng module/action thực tế. Các quyền nguy hiểm được đánh dấu đỏ.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={saveEmployeeProfile} loading={savingEmployeeId === selectedEmployee?.id}>
                  Lưu hồ sơ
                </Button>
                <Button onClick={saveEmployeePermissions} loading={savingEmployeeId === selectedEmployee?.id}>
                  Lưu phân quyền
                </Button>
              </div>
            </div>

            {selectedEmployee ? (
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none" placeholder="Tên nhân viên" />
                <input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none" placeholder="Mã NV" />
                <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none" placeholder="Username" />
                <select value={editMainBranchId} onChange={(e) => setEditMainBranchId(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none">
                  <option value="">Chi nhánh chính</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none md:col-span-2" placeholder="Email" />
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none" placeholder="Số điện thoại" />
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none" placeholder="Địa chỉ" />
              </div>
            ) : null}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
            <Panel className="p-3">
              <p className="px-2 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Module</p>
              <div className="space-y-2">
                {PERMISSION_MODULES.map((module) => {
                  const moduleGranted = module.actions.filter((action) => permissionGranted(selectedBranchKeys, action.key)).length;
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => setSelectedModuleId(module.id)}
                      className={cx(
                        "flex w-full items-center justify-between gap-2 rounded-2xl p-3 text-left transition",
                        selectedModuleId === module.id ? "bg-neutral-950 text-white" : "hover:bg-neutral-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span>{module.icon}</span>
                        <span>
                          <span className="block text-sm font-black">{module.title}</span>
                          <span className="block text-[11px] opacity-60">{moduleGranted}/{module.actions.length} quyền</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="border-b border-neutral-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedModule.icon}</span>
                      <h3 className="text-xl font-black">{selectedModule.title}</h3>
                      <Badge tone={selectedModule.tone}>{selectedModule.actions.length} action</Badge>
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">{selectedModule.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={!selectedBranchId} onClick={() => setModuleAll(selectedModule, true)}>Bật nhóm</Button>
                    <Button variant="secondary" disabled={!selectedBranchId} onClick={() => setModuleAll(selectedModule, false)}>Tắt nhóm</Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none"
                  >
                    <option value="">Chọn chi nhánh đang chỉnh quyền</option>
                    {currentBranchIds.map((branchId) => (
                      <option key={branchId} value={branchId}>
                        {getBranchName(branches, branchId)} · {getRoleName(editBranchRoleMap[branchId])}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_TEMPLATES.filter((role) => role.scope === "ONE_BRANCH").map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        disabled={!selectedBranchId}
                        onClick={() => applyPresetToBranch(role.id)}
                        className={cx("rounded-full border px-3 py-2 text-xs font-bold", toneClasses[role.tone], !selectedBranchId ? "opacity-50" : "")}
                      >
                        {role.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-5 md:grid-cols-2">
                {selectedModule.actions.map((action) => (
                  <PermissionCheck
                    key={action.key}
                    action={action}
                    checked={permissionGranted(selectedBranchKeys, action.key)}
                    onChange={(checked) => setBranchPermission(selectedBranchId, action.key, checked)}
                  />
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Effective Access</p>
            <h3 className="mt-1 text-xl font-black">Quyền hiệu lực</h3>
            {selectedEmployee ? (
              <>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-neutral-500">Trạng thái</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge tone={selectedEmployee.status === "ACTIVE" ? "green" : "red"}>
                        {selectedEmployee.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                      </Badge>
                      <Button variant="secondary" onClick={toggleEmployeeStatus} loading={savingEmployeeId === selectedEmployee.id}>
                        {selectedEmployee.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-neutral-50 p-4">
                      <p className="text-xs text-neutral-500">Tổng quyền</p>
                      <p className="mt-1 text-3xl font-black">{effectiveKeys.includes("*") ? "ALL" : effectiveKeys.length}</p>
                    </div>
                    <div className="rounded-2xl bg-red-50 p-4">
                      <p className="text-xs text-red-500">Quyền nguy hiểm</p>
                      <p className="mt-1 text-3xl font-black text-red-700">{effectiveKeys.includes("*") ? "ALL" : dangerousCount}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-neutral-500">Đăng nhập gần nhất</p>
                    <p className="mt-1 text-sm font-bold">{formatDateTime(selectedEmployee.lastLoginAt)}</p>
                  </div>
                  {savedEmployeeId === selectedEmployee.id ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                      Đã lưu. Nhân viên cần đăng nhập lại để nhận quyền mới.
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Chọn nhân viên để xem quyền hiệu lực.</p>
            )}
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Branch Scope</p>
            <h3 className="mt-1 text-xl font-black">Chi nhánh & role</h3>
            <div className="mt-4 space-y-2">
              {branches.map((branch) => {
                const enabled = Boolean(editBranchRoleMap[branch.id] || editBranchPermissionMap[branch.id]);
                return (
                  <div key={branch.id} className={cx("rounded-2xl border p-3", enabled ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white")}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{branch.name}</p>
                        <p className="text-xs text-neutral-400">{branch.id}</p>
                      </div>
                      <Toggle checked={enabled} onChange={(checked) => toggleBranch(branch.id, checked)} />
                    </div>
                    {enabled ? (
                      <select
                        value={editBranchRoleMap[branch.id] || "retail-staff"}
                        onChange={(e) => changeBranchRole(branch.id, e.target.value)}
                        className="mt-3 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none"
                      >
                        {ROLE_TEMPLATES.filter((role) => role.scope === "ONE_BRANCH" || role.id === "admin").map((role) => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Access Preview</p>
                <h3 className="mt-1 text-xl font-black">Preview sidebar thật</h3>
              </div>
              <Toggle checked={showPreview} onChange={setShowPreview} />
            </div>
            {showPreview ? (
              <div className="mt-4 space-y-2">
                {PERMISSION_MODULES.filter((module) =>
                  module.actions.some((action) => action.key.startsWith("menu.") && permissionGranted(effectiveKeys, action.key))
                ).map((module) => (
                  <div key={module.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span>{module.icon}</span>
                      {module.title}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-400">VISIBLE</span>
                  </div>
                ))}
                {!effectiveKeys.length ? (
                  <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-500">Chưa có quyền để preview.</p>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Permission Diff</p>
            <h3 className="mt-1 text-xl font-black">Thay đổi gần nhất</h3>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-black uppercase text-emerald-700">Quyền thêm</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lastDiff.added.length ? lastDiff.added.slice(0, 8).map((key) => (
                    <span key={key} className="rounded-full bg-white px-2 py-1 font-mono text-[10px] text-emerald-700">{key}</span>
                  )) : <span className="text-xs text-emerald-700">Chưa có thay đổi trong phiên này.</span>}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-black uppercase text-rose-700">Quyền gỡ</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lastDiff.removed.length ? lastDiff.removed.slice(0, 8).map((key) => (
                    <span key={key} className="rounded-full bg-white px-2 py-1 font-mono text-[10px] text-rose-700">{key}</span>
                  )) : <span className="text-xs text-rose-700">Chưa có thay đổi trong phiên này.</span>}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Module Health</p>
            <h3 className="mt-1 text-xl font-black">Backend guard status</h3>
            <div className="mt-4 space-y-2">
              {MODULE_HEALTH.map((item) => (
                <div key={item.module} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black">{item.module}</p>
                    <Badge tone={item.status === "ready" ? "green" : "amber"}>{item.status === "ready" ? "READY" : "WATCH"}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-neutral-400">{item.backend}</p>
                  <p className="mt-1 text-xs text-neutral-500">{item.note}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Audit Timeline</p>
            <h3 className="mt-1 text-xl font-black">Lịch sử sửa quyền</h3>
            <div className="mt-4 max-h-72 space-y-2 overflow-auto">
              {auditTimeline.length ? auditTimeline.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm font-black">{event.action}</p>
                  <p className="mt-1 text-xs text-neutral-500">{event.employeeName} · {event.employeeCode}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">{new Date(event.createdAt).toLocaleString("vi-VN")}</p>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    +{event.added.length} / -{event.removed.length} quyền
                  </p>
                </div>
              )) : (
                <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-500">Chưa có audit trong máy này.</p>
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Security</p>
            <h3 className="mt-1 text-xl font-black">Mật khẩu & PIN</h3>
            <div className="mt-4 space-y-3">
              {resetPasswordForId === selectedEmployee?.id ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu mới"
                    className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none"
                  />
                  <Button onClick={changePassword} loading={securitySavingForId === selectedEmployee?.id} className="w-full">
                    Lưu mật khẩu
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" disabled={!selectedEmployee} onClick={() => setResetPasswordForId(selectedEmployee?.id || null)} className="w-full">
                  Đổi mật khẩu
                </Button>
              )}

              {secondPasswordForId === selectedEmployee?.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={secondPassword}
                    onChange={(e) => setSecondPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="PIN bảo mật 6 số"
                    className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none"
                  />
                  <Button onClick={changeSecondPassword} loading={securitySavingForId === selectedEmployee?.id} className="w-full">
                    Lưu PIN
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" disabled={!selectedEmployee} onClick={() => setSecondPasswordForId(selectedEmployee?.id || null)} className="w-full">
                  Set PIN bảo mật
                </Button>
              )}

              <Button variant="ghost" onClick={saveRoleTemplates} className="w-full">
                Lưu role template local
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
