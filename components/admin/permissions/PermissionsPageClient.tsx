"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getBranches, type BranchItem } from "@/lib/products-api";
import RbacSnapshotPanel from "@/components/admin/permissions/RbacSnapshotPanel";
type Tone =
  | "slate"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "cyan"
  | "rose"
  | "emerald"
  | "indigo";

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
  createdAt?: string | null;
  departments?: { staffId: string; departmentId: string; isHead: boolean }[];
};

type DepartmentItem = {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  isActive: boolean;
  members: { staff: { id: string; name: string; code: string; isActive: boolean }; isHead: boolean }[];
};

type PageTab = "permissions" | "roles" | "employees" | "departments";

const ROLE_STORAGE_KEY = "the1970.permission.enterprise.roleTemplates.v1";
const CUSTOM_ROLE_STORAGE_KEY = "the1970.permission.enterprise.customRoleTemplates.v1";

function normalizeRoleCodeForStorage(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function readStoredRoleTemplates(): RoleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredRoleTemplates(items: RoleItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(items));
}

function readCustomRoleTemplates(): RoleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_ROLE_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomRoleTemplates(items: RoleItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_ROLE_STORAGE_KEY, JSON.stringify(items));
}

function getAllRoleTemplates() {
  // Backend /staff/role-templates là nguồn chính. ROLE_STORAGE_KEY chỉ là cache mirror từ backend.
  // ROLE_TEMPLATES hardcode chỉ dùng làm fallback metadata khi backend chưa tải xong.
  const stored = readStoredRoleTemplates();
  const custom = readCustomRoleTemplates();
  const merged = [...ROLE_TEMPLATES, ...stored, ...custom];
  const map = new Map<string, RoleItem>();
  merged.forEach((role) => {
    if (!role?.id) return;
    map.set(role.id, {
      ...role,
      defaultPermissionKeys: uniquePermissionKeys(role.defaultPermissionKeys || []),
    });
  });
  return Array.from(map.values());
}

const PERMISSION_KEY_ALIASES: Record<string, string[]> = {
  "cash_voucher.view": ["cash_voucher.view_receipt", "cash_voucher.view_payment"],
  "menu.shipping_reconcile": ["menu.finance_ghn_reconciliation", "menu.finance_local_delivery"],
};

function normalizePermissionKeyAliases(key: string) {
  const value = String(key || "").trim();
  if (!value) return [];
  return PERMISSION_KEY_ALIASES[value] || [value];
}

function uniquePermissionKeys(values: any[]) {
  return Array.from(
    new Set(
      safeArray<string>(values)
        .flatMap((value) => normalizePermissionKeyAliases(String(value || "").trim()))
        .filter(Boolean),
    ),
  );
}

function getRolePermissionKeysFromApi(row: any) {
  if (Array.isArray(row?.permissionKeys)) return uniquePermissionKeys(row.permissionKeys);
  if (Array.isArray(row?.defaultPermissionKeys)) return uniquePermissionKeys(row.defaultPermissionKeys);
  if (Array.isArray(row?.permissions)) return uniquePermissionKeys(row.permissions);
  if (Array.isArray(row?.permissions?.permissionKeys)) return uniquePermissionKeys(row.permissions.permissionKeys);
  if (Array.isArray(row?.permissions?.keys)) return uniquePermissionKeys(row.permissions.keys);
  return [];
}

function mapApiRoleTemplateToRoleItem(row: any): RoleItem | null {
  const rawId = row?.roleCode || row?.id || row?.code || row?.name;
  const id = normalizeRoleCodeForStorage(String(rawId || ""));
  if (!id) return null;

  const fallback = ROLE_TEMPLATES.find((role) => role.id === id);
  return {
    id,
    name: row?.name || fallback?.name || id,
    scope: row?.scope === "ALL_BRANCHES" ? "ALL_BRANCHES" : "ONE_BRANCH",
    description: row?.description || fallback?.description || "",
    badge: fallback?.badge || row?.badge || id,
    tone: fallback?.tone || row?.tone || "slate",
    defaultPermissionKeys: getRolePermissionKeysFromApi(row),
  };
}

function roleTemplatesFingerprint(items: RoleItem[]) {
  return JSON.stringify(
    items
      .map((role) => ({
        id: role.id,
        keys: uniquePermissionKeys(role.defaultPermissionKeys).sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

async function fetchRoleTemplatesFromBackend() {
  const data = await apiJson<any[]>("/staff/role-templates", { method: "GET" });
  const mapped = safeArray<any>(data)
    .map(mapApiRoleTemplateToRoleItem)
    .filter(Boolean) as RoleItem[];

  if (mapped.length) {
    writeStoredRoleTemplates(mapped);
  }

  return mapped;
}

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
  { module: "Mẫu mã & Vải", backend: "fabric_library.* / sample_dispatch.* / design_sample.* / fabric_receipt.*", status: "ready", note: "Tách thư viện bảng vải, gửi làm mẫu, tiến độ mẫu và kiểm nhận vải." },
  { module: "Inventory", backend: "inventory.*", status: "ready", note: "Adjust/transfer/import/audit đã có guard." },
  { module: "Phiếu thu / chi", backend: "cash_voucher.*", status: "ready", note: "Controller đã có PermissionGuard và action mapping." },
  { module: "Khuyến mại", backend: "promotions.*", status: "watch", note: "Permission keys đã định nghĩa; cần gắn guard vào promotion.controller." },
  { module: "Tài chính", backend: "finance.*", status: "ready", note: "Các endpoint tài chính chính đã có guard." },
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
      { key: "menu.returns", label: "Mở menu Đơn trả hàng", risk: "low" },
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
      { key: "menu.product_categories", label: "Mở menu Danh mục sản phẩm", risk: "low" },
      { key: "menu.suppliers", label: "Mở menu Nhà cung cấp", risk: "low" },
      { key: "products.view", label: "Xem sản phẩm", risk: "low" },
      { key: "inventory.logs.view", label: "Xem lịch sử kho sản phẩm", risk: "medium" },
      { key: "products.print_label", label: "In tem sản phẩm", risk: "low" },
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
      { key: "menu.inventory_logs", label: "Mở menu Lịch sử kho", risk: "low" },
      { key: "menu.warehouse_map", label: "Mở menu Sơ đồ kho 3D", risk: "low" },
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
    id: "sample_fabric",
    title: "Mẫu mã & Vải",
    subtitle: "Theo dõi mẫu thiết kế, bảng vải, màu, tiến độ; nhận vải theo mét/kg/cây, cân GSM và duyệt chênh lệch.",
    icon: "🧵",
    tone: "indigo",
    actions: [
      { key: "menu.fabric_library", label: "Mở menu Bảng vải", risk: "low" },
      { key: "fabric_library.view", label: "Xem thư viện bảng vải", risk: "low" },
      { key: "fabric_library.create", label: "Tạo bảng vải / NCC vải", risk: "medium" },
      { key: "fabric_library.edit", label: "Sửa bảng vải, màu, mùa, nhóm sản phẩm", risk: "high" },
      { key: "fabric_library.upload_images", label: "Upload ảnh bảng vải / miếng vải", risk: "medium" },
      { key: "fabric_library.delete", label: "Xoá bảng vải chưa phát sinh sử dụng", risk: "critical" },
      { key: "menu.design_samples", label: "Mở menu Triển khai mẫu", risk: "low" },
      { key: "design_sample.view", label: "Xem mẫu triển khai", risk: "low" },
      { key: "design_sample.create", label: "Tạo mẫu", risk: "medium" },
      { key: "design_sample.edit", label: "Sửa mẫu / tiến độ", risk: "high" },
      { key: "design_sample.upload_images", label: "Upload ảnh mẫu / ảnh tham khảo", risk: "medium" },
      { key: "design_sample.delete", label: "Xoá mẫu chưa phát sinh vải về", risk: "critical" },
      { key: "sample_dispatch.view", label: "Xem lịch sử gửi mẫu", risk: "low" },
      { key: "sample_dispatch.create", label: "Ghi nhận gửi mẫu cho công ty / xưởng", risk: "medium" },
      { key: "sample_dispatch.edit", label: "Cập nhật tiến độ lần gửi mẫu", risk: "high" },
      { key: "sample_dispatch.delete", label: "Xoá lần gửi mẫu", risk: "critical" },
      { key: "menu.fabric_receipts", label: "Mở menu Vải về", risk: "low" },
      { key: "fabric_receipt.view", label: "Xem quản lý vải về", risk: "low" },
      { key: "fabric_receipt.create", label: "Tạo phiếu vải về", risk: "medium" },
      { key: "fabric_receipt.edit", label: "Nhập / sửa mét, kg, cây vải", risk: "high" },
      { key: "fabric_receipt.measure", label: "Cân mẫu tròn / cập nhật GSM", risk: "medium" },
      { key: "fabric_receipt.upload_images", label: "Upload ảnh vải, lỗi, mẫu tròn, cân", risk: "medium" },
      { key: "fabric_receipt.cost.view", label: "Xem đơn giá vải", risk: "critical" },
      { key: "fabric_receipt.cost.edit", label: "Sửa đơn giá vải", risk: "critical" },
      { key: "fabric_receipt.complete", label: "Hoàn tất phiếu vải về", risk: "high" },
      { key: "fabric_receipt.approve_variance", label: "Duyệt thừa / thiếu so với NCC", risk: "critical" },
      { key: "fabric_receipt.delete", label: "Xoá phiếu vải chưa hoàn tất", risk: "critical" },
    ],
  },
  {
    id: "stock_transfer",
    title: "Chuyển kho",
    subtitle: "Phiếu chuyển kho, xác nhận, nhận hàng, hủy phiếu và auto rebalance.",
    icon: "🔁",
    tone: "cyan",
    actions: [
      { key: "menu.stock_transfer", label: "Mở menu Chuyển kho", risk: "low" },
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
      { key: "menu.purchase_receipt", label: "Mở menu Phiếu nhập", risk: "low" },
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
    id: "cash_voucher",
    title: "Phiếu thu / Phiếu chi",
    subtitle: "Quản lý phiếu thu tiền, phiếu chi tiền, xác nhận quỹ, huỷ chứng từ và audit tài chính.",
    icon: "💰",
    tone: "rose",
    actions: [
      { key: "menu.cash_voucher", label: "Mở menu Phiếu thu / chi", risk: "low" },
      { key: "cash_voucher.view_receipt", label: "Xem phiếu thu", risk: "low" },
      { key: "cash_voucher.view_payment", label: "Xem phiếu chi", risk: "low" },

      { key: "cash_voucher.create_receipt", label: "Tạo phiếu thu", risk: "high" },
      { key: "cash_voucher.edit_receipt", label: "Sửa phiếu thu", risk: "high" },
      { key: "cash_voucher.confirm_receipt", label: "Xác nhận phiếu thu", risk: "critical" },
      { key: "cash_voucher.cancel_receipt", label: "Huỷ phiếu thu", risk: "critical" },

      { key: "cash_voucher.create_payment", label: "Tạo phiếu chi", risk: "high" },
      { key: "cash_voucher.edit_payment", label: "Sửa phiếu chi", risk: "high" },
      { key: "cash_voucher.confirm_payment", label: "Xác nhận phiếu chi", risk: "critical" },
      { key: "cash_voucher.cancel_payment", label: "Huỷ phiếu chi", risk: "critical" },

      { key: "cash_voucher.export", label: "Xuất Excel/PDF phiếu", risk: "medium" },
      { key: "cash_voucher.audit", label: "Xem audit phiếu thu / chi", risk: "critical" },
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
      { key: "menu.supplier_payments", label: "Mở menu Thanh toán nhà cung cấp", risk: "high" },
      { key: "menu.reports", label: "Mở menu Báo cáo doanh thu", risk: "medium" },
      { key: "menu.finance_local_delivery", label: "Menu đối soát nội thành", risk: "medium" },
      { key: "menu.finance_ghn_reconciliation", label: "Menu đối soát GHN", risk: "medium" },
      { key: "finance.view", label: "Xem tài chính", risk: "high" },
      { key: "finance.local_delivery.view", label: "Xem đối soát nội thành", risk: "medium" },
      { key: "finance.local_delivery.confirm", label: "Xác nhận COD nội thành", risk: "critical" },
      { key: "finance.ghn.view", label: "Xem đối soát GHN", risk: "high" },
      { key: "finance.ghn.import", label: "Import file đối soát GHN", risk: "critical" },
      { key: "finance.payment_source.manage", label: "Quản lý nguồn tiền", risk: "critical" },
      { key: "supplier_payments.view", label: "Xem công nợ NCC", risk: "high" },
      { key: "supplier_payments.cost.edit", label: "Sửa giá nhập khi thanh toán NCC", risk: "critical" },
      { key: "supplier_payments.pay", label: "Thanh toán nhà cung cấp", risk: "critical" },
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
    id: "promotions",
    title: "Khuyến mại",
    subtitle: "Tạo, duyệt, kích hoạt, tạm dừng KM và kiểm soát chính sách giá theo kênh bán.",
    icon: "🎁",
    tone: "indigo",
    actions: [
      { key: "menu.promotions", label: "Mở menu Khuyến mại", risk: "low" },
      { key: "promotions.view", label: "Xem chương trình KM", risk: "low" },
      { key: "promotions.create", label: "Tạo chương trình KM", risk: "high" },
      { key: "promotions.edit", label: "Sửa chương trình KM", risk: "high" },
      { key: "promotions.confirm", label: "Xác nhận / duyệt KM", risk: "critical" },
      { key: "promotions.activate", label: "Kích hoạt KM", risk: "critical" },
      { key: "promotions.pause", label: "Tạm dừng KM", risk: "high" },
      { key: "promotions.cancel", label: "Huỷ chương trình KM", risk: "critical" },
      { key: "promotions.delete", label: "Xóa chương trình KM", risk: "critical" },
      { key: "promotions.price_policy.none", label: "Không cho phép sửa giá / chiết khấu toàn kênh", risk: "low", desc: "Khóa toàn bộ thao tác sửa giá và chiết khấu." },
      { key: "promotions.price_policy.online_discount_only", label: "Bán online — Chỉ sửa chiết khấu", risk: "medium", desc: "Áp dụng đơn online, không cho sửa giá sản phẩm." },
      { key: "promotions.price_policy.online_discount_price", label: "Bán online — Sửa giá và chiết khấu", risk: "high", desc: "Áp dụng đơn online, cho sửa cả giá và chiết khấu." },
      { key: "promotions.price_policy.pos_discount_only", label: "Tại quầy POS — Chỉ sửa chiết khấu", risk: "medium", desc: "Áp dụng POS, không cho sửa giá sản phẩm." },
      { key: "promotions.price_policy.pos_discount_price", label: "Tại quầy POS — Sửa giá và chiết khấu", risk: "high", desc: "Áp dụng POS, cho sửa cả giá và chiết khấu." },
      { key: "promotions.price_policy.all_channels_discount_only", label: "Toàn kênh — Chỉ sửa chiết khấu", risk: "critical", desc: "Áp dụng cả online và POS, chỉ sửa chiết khấu." },
      { key: "promotions.price_policy.all_channels_discount_price", label: "Toàn kênh — Sửa giá và chiết khấu", risk: "critical", desc: "Mức quyền cao nhất, cho sửa giá và chiết khấu trên mọi kênh." },
    ],
  },
  {
    id: "staff_transfer",
    title: "Chuyển chi nhánh nhân viên",
    subtitle: "Trang riêng cho nhân viên quản lí, chỉ cho điều chuyển nhân viên giữa các chi nhánh.",
    icon: "🔀",
    tone: "indigo",
    actions: [
      { key: "menu.staff_transfer", label: "Mở trang Chuyển chi nhánh nhân viên", risk: "low" },
      { key: "staff.transfer_branch.view", label: "Xem trang chuyển chi nhánh", risk: "medium" },
      { key: "staff.transfer_branch", label: "Thực hiện chuyển chi nhánh", risk: "critical" },
    ],
  },
  {
    id: "omni_inbox",
    title: "Bán hàng đa kênh / Tin nhắn",
    subtitle: "Inbox kiểu Pancake: tin nhắn, bình luận, livestream, phân công nhân viên, tag, ghi chú và tạo đơn từ hội thoại.",
    icon: "💬",
    tone: "blue",
    actions: [
      { key: "menu.omni_inbox", label: "Mở nhóm menu Bán hàng đa kênh", risk: "low" },
      { key: "menu.omni_messages", label: "Mở menu Tin nhắn", risk: "low" },
      { key: "menu.omni_comments", label: "Mở menu Bình luận", risk: "low" },
      { key: "menu.omni_livestream", label: "Mở menu Livestream", risk: "low" },
      { key: "omni_inbox.view", label: "Xem hội thoại / inbox", risk: "low" },
      { key: "omni_inbox.reply", label: "Trả lời tin nhắn", risk: "medium" },
      { key: "omni_inbox.assign", label: "Gán/chuyển hội thoại cho nhân viên", risk: "high" },
      { key: "omni_inbox.tags.manage", label: "Nhãn hội thoại — xem, thêm, sửa, xoá", risk: "high", desc: "Cho phép mở mục Nhãn hội thoại và quản lý toàn bộ danh mục nhãn dùng chung." },
      { key: "omni_inbox.notes.manage", label: "Ghi chú nội bộ hội thoại", risk: "medium" },
      { key: "omni_inbox.create_order", label: "Tạo đơn từ hội thoại", risk: "high" },
      { key: "omni_inbox.close", label: "Đánh dấu/chốt hội thoại", risk: "medium" },
      { key: "omni_inbox.export", label: "Xuất dữ liệu hội thoại", risk: "high" },
      { key: "omni_inbox.settings", label: "Cấu hình kết nối kênh / quản trị tổng", risk: "critical" },

      { key: "omni_inbox.quick_replies.view", label: "Xem và sử dụng mẫu trả lời nhanh", risk: "low" },
      { key: "omni_inbox.quick_replies.create", label: "Thêm mẫu trả lời nhanh", risk: "medium" },
      { key: "omni_inbox.quick_replies.edit", label: "Sửa mẫu trả lời nhanh", risk: "medium" },
      { key: "omni_inbox.quick_replies.delete", label: "Xóa từng mẫu trả lời nhanh", risk: "high" },
      { key: "omni_inbox.quick_replies.import", label: "Nhập mẫu trả lời bằng Excel", risk: "high" },
      {
        key: "omni_inbox.quick_replies.delete_all",
        label: "Xóa toàn bộ mẫu trả lời nhanh",
        risk: "critical",
        desc: "Xóa vĩnh viễn toàn bộ mẫu trong hệ thống. Chỉ nên cấp cho Owner/Admin.",
      },

      { key: "omni_inbox.assignment.view", label: "Xem cấu hình và lịch sử chia tin nhắn", risk: "medium" },
      { key: "omni_inbox.assignment.manage", label: "Sửa cấu hình chia tin nhắn", risk: "critical" },
      { key: "omni_inbox.reports.view", label: "Xem báo cáo Inbox / phân công", risk: "high" },

      { key: "omni_comments.view", label: "Xem bình luận", risk: "low" },
      { key: "omni_comments.reply", label: "Trả lời bình luận", risk: "medium" },
      { key: "omni_comments.hide", label: "Ẩn/xử lý bình luận", risk: "high" },
      { key: "omni_livestream.view", label: "Xem hội thoại livestream", risk: "low" },
      { key: "omni_livestream.reply", label: "Trả lời livestream", risk: "medium" },
    ],
  },

  {
    id: "mobile",
    title: "Mobile App",
    subtitle: "Quyền hiển thị từng thẻ/khu vực trên trang Home mobile và thanh điều hướng.",
    icon: "📱",
    tone: "cyan",
    actions: [
      { key: "mobile.home.reports", label: "Hiện thẻ Tổng quan báo cáo", risk: "low" },
      { key: "mobile.home.finance", label: "Hiện thẻ Tổng quan nguồn tiền", risk: "high" },
      { key: "mobile.home.orders", label: "Hiện thẻ Đơn hàng", risk: "medium" },
      { key: "mobile.home.products", label: "Hiện thẻ Sản phẩm", risk: "low" },
      { key: "mobile.home.stocktake", label: "Hiện thẻ Kiểm kho", risk: "low" },
      { key: "mobile.home.autopilot", label: "Hiện thẻ Autopilot", risk: "low" },

      { key: "mobile.nav.home", label: "Hiện tab Home", risk: "low" },
      { key: "mobile.nav.reports", label: "Hiện tab Báo cáo", risk: "low" },
      { key: "mobile.nav.orders", label: "Hiện tab Đơn", risk: "low" },
      { key: "mobile.nav.stocktake", label: "Hiện tab Kiểm", risk: "low" },
      { key: "mobile.nav.history", label: "Hiện tab Lịch sử", risk: "medium" },
      { key: "mobile.nav.profile", label: "Hiện tab Tôi", risk: "low" },
      { key: "mobile.nav.autopilot", label: "Hiện tab Autopilot", risk: "low" },
    ],
  },
  {
    id: "system",
    title: "Hệ thống",
    subtitle: "Phân quyền, cấu hình, chi nhánh, audit, tích hợp và autopilot.",
    icon: "🛡️",
    tone: "red",
    actions: [
      { key: "menu.permissions", label: "Mở menu Phân quyền", risk: "critical" },
      { key: "menu.settings", label: "Mở menu Cấu hình", risk: "high" },
      { key: "menu.print_center", label: "Mở menu Trung tâm in ấn", risk: "medium" },
      { key: "permissions.view", label: "Xem phân quyền", risk: "critical" },
      { key: "permissions.manage", label: "Quản lý phân quyền", risk: "critical" },
      { key: "system.manage", label: "Quản lý hệ thống", risk: "critical" },
      { key: "branches.manage", label: "Quản lý chi nhánh", risk: "critical" },
      { key: "staff.manage", label: "Quản lý nhân viên", risk: "critical" },
      { key: "menu.staff_transfer", label: "Mở trang Chuyển chi nhánh nhân viên", risk: "medium" },
      { key: "staff.transfer_branch.view", label: "Xem trang chuyển chi nhánh", risk: "medium" },
      { key: "staff.transfer_branch", label: "Thực hiện chuyển chi nhánh", risk: "critical" },
      { key: "audit.view", label: "Xem audit log", risk: "high" },
      { key: "carriers.manage", label: "Cấu hình hãng vận chuyển", risk: "high" },
      { key: "autopilot.view", label: "Xem Autopilot", risk: "medium" },
      { key: "autopilot.manage", label: "Quản lý Autopilot", risk: "critical" },
    ],
  },
  ,{
    id: "production",
    title: "Sản xuất & Nguyên phụ liệu",
    subtitle: "Lệnh sản xuất, nhà may, định mức cắt, tỷ lệ size và NPL.",
    icon: "🏭",
    tone: "indigo",
    actions: [
      { key: "menu.production", label: "Mở trang Sản xuất", risk: "low" },
      { key: "production.view", label: "Xem sản xuất", risk: "low" },
      { key: "production.create", label: "Tạo lệnh SX", risk: "medium" },
      { key: "production.edit", label: "Sửa lệnh SX", risk: "medium" },
      { key: "production.calculate", label: "Tính sản lượng & NPL", risk: "medium" },
      { key: "production.manage", label: "Quản lý nhà may & định mức", risk: "high" },
      { key: "menu.accessories", label: "Mở trang Nguyên phụ liệu", risk: "low" },
      { key: "accessories.view", label: "Xem nguyên phụ liệu", risk: "low" },
      { key: "accessories.manage", label: "Quản lý NPL & NCC", risk: "high" },
      { key: "accessories.stock", label: "Điều chỉnh tồn NPL", risk: "high" },
    ],
  }
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
    id: "meta-reviewer",
    name: "Meta Reviewer",
    scope: "ALL_BRANCHES",
    description: "Tài khoản chỉ dùng cho Meta App Review; chỉ xem Autopilot trên mobile.",
    badge: "Meta Review",
    tone: "cyan",
    defaultPermissionKeys: [
      "autopilot.view",
      "autopilot.ads.view",
      "autopilot.posts.view",
      "autopilot.settings.view",
      "autopilot.review.view",
      "autopilot.meta_compare.view",
      "mobile.home.autopilot",
      "mobile.nav.home",
      "mobile.nav.autopilot",
    ],
  },
  {
    id: "accountant",
    name: "Kế toán",
    scope: "ALL_BRANCHES",
    description: "Quản lý phiếu thu/chi, đối soát, nguồn tiền và nghiệp vụ tài chính.",
    badge: "Finance",
    tone: "rose",
    defaultPermissionKeys: [
      "menu.finance",
      "menu.finance_local_delivery",
      "menu.finance_ghn_reconciliation",
      "menu.cash_voucher",
      "finance.view",
      "finance.local_delivery.view",
      "finance.local_delivery.confirm",
      "finance.ghn.view",
      "finance.ghn.import",
      "finance.payment_source.manage",
      "cash_voucher.view_receipt",
      "cash_voucher.view_payment",
      "cash_voucher.create_receipt",
      "cash_voucher.edit_receipt",
      "cash_voucher.confirm_receipt",
      "cash_voucher.cancel_receipt",
      "cash_voucher.create_payment",
      "cash_voucher.edit_payment",
      "cash_voucher.confirm_payment",
      "cash_voucher.cancel_payment",
      "cash_voucher.export",
      "cash_voucher.audit",
      "orders.view",
      "purchase_receipt.view",
      "inventory.value.view",
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
      "menu.stock_transfer",
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
      "products.print_label",
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
      "menu.cash_voucher",
      "menu.omni_inbox",
      "menu.omni_messages",
      "menu.omni_comments",
      "omni_inbox.view",
      "omni_inbox.reply",
      "omni_inbox.assign",
      "omni_inbox.tags.manage",
      "omni_inbox.notes.manage",
      "omni_inbox.create_order",
      "omni_inbox.close",
      "omni_inbox.quick_replies.view",
      "omni_inbox.quick_replies.create",
      "omni_inbox.quick_replies.edit",
      "omni_inbox.quick_replies.delete",
      "omni_inbox.quick_replies.import",
      "omni_inbox.assignment.view",
      "omni_inbox.assignment.manage",
      "omni_inbox.reports.view",
      "omni_comments.view",
      "omni_comments.reply",
      "cash_voucher.view_receipt",
      "cash_voucher.view_payment",
      "cash_voucher.create_receipt",
      "cash_voucher.create_payment",
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
      "menu.omni_inbox",
      "menu.omni_messages",
      "menu.omni_comments",
      "omni_inbox.view",
      "omni_inbox.reply",
      "omni_inbox.tags.manage",
      "omni_inbox.notes.manage",
      "omni_inbox.create_order",
      "omni_inbox.close",
      "omni_inbox.quick_replies.view",
      "omni_comments.view",
      "omni_comments.reply",
      "orders.view_own",
      "orders.create",
      "orders.approve",
      "orders.pack_ship",
      "orders.copy",
      "orders.print",
      "products.view",
      "products.print_label",
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
      "menu.omni_inbox",
      "menu.omni_messages",
      "menu.omni_comments",
      "omni_inbox.view",
      "omni_inbox.reply",
      "omni_inbox.tags.manage",
      "omni_inbox.notes.manage",
      "omni_inbox.create_order",
      "omni_inbox.close",
      "omni_inbox.quick_replies.view",
      "omni_comments.view",
      "omni_comments.reply",
      "orders.view_own",
      "orders.create",
      "orders.print",
      "products.view",
      "products.print_label",
      "inventory.view",
      "inventory.logs.view",
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
      "menu.stock_transfer",
      "menu.stocktake",
      "menu.products",
      "products.view",
      "products.print_label",
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
  extraPermissionKeys: [],
  deniedPermissionKeys: [],
  canView: ["products.view", "menu.products"],
  canSell: ["menu.pos"],
  canViewOwnOrders: ["orders.view_own", "menu.orders"],
  canViewBranchOrders: ["orders.view", "menu.orders"],
  canCreateOrder: ["orders.create", "menu.create_order"],
  canApproveOrder: ["orders.approve"],
  canCancelOrder: ["orders.cancel"],
  canHandleReturn: ["returns.view", "returns.create"],
  canViewStock: ["inventory.view", "inventory.logs.view", "menu.inventory"],
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
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeRole(value?: any) {
  return String(value || "").trim().toLowerCase();
}

function getRoleTemplate(roleCode?: string | null) {
  return getAllRoleTemplates().find((role) => role.id === normalizeRole(roleCode));
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

  safeArray<string>(row.extraPermissionKeys).forEach((key) => keys.add(key));
  safeArray<string>(row.deniedPermissionKeys).forEach((key) => keys.delete(key));

  return Array.from(keys);
}

function getEmployeeEffectiveKeys(employee?: EmployeeItem | null, branchId?: string | null) {
  if (!employee) return [];

  const scopedBranchId = branchId || employeePrimaryBranch(employee);
  const keys = new Set<string>();

  const roleCode = getEmployeeRoleForBranch(employee, scopedBranchId);
  roleKeys(roleCode).forEach((key) => keys.add(key));

  const branchPermission = scopedBranchId
    ? employee.branchPermissions.find((row) => row.branchId === scopedBranchId)
    : null;

  if (branchPermission) {
    getPermissionKeysFromBranchPermission(branchPermission).forEach((key) => keys.add(key));
    safeArray<string>(branchPermission.deniedPermissionKeys).forEach((key) => keys.delete(key));
  }

  if (!scopedBranchId) {
    safeArray<string>(employee.permissionKeys).forEach((key) => keys.add(key));
  }

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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

function defaultBranchPermission(branchId: string): BranchPermission {
  return {
    branchId,
    permissionKeys: [],
    extraPermissionKeys: [],
    deniedPermissionKeys: [],
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
    extraPermissionKeys: [],
    deniedPermissionKeys: [],
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
  const extraPermissionKeys = unique(safeArray<string>(row.extraPermissionKeys));
  const deniedPermissionKeys = unique(safeArray<string>(row.deniedPermissionKeys));

  return {
    ...buildLegacyFlags(keys, row.branchId),
    id: row.id,
    staffId: row.staffId,
    branchId: row.branchId,
    permissionKeys: keys,
    extraPermissionKeys,
    deniedPermissionKeys,
    note: row.note || null,
  };
}

function roleKeys(roleCode: string): string[] {
  return getRoleTemplate(roleCode)?.defaultPermissionKeys || [];
}

function employeePrimaryBranch(employee?: EmployeeItem | null) {
  if (!employee) return "";
  return employee.branchId || employee.branchRoles[0]?.branchId || employee.branchPermissions[0]?.branchId || "";
}

function employeeBranchIds(employee?: EmployeeItem | null) {
  if (!employee) return [];
  return unique([
    employee.branchId || "",
    ...employee.branchRoles.map((item) => item.branchId),
    ...employee.branchPermissions.map((item) => item.branchId),
  ]);
}

function getEmployeeRoleForBranch(employee?: EmployeeItem | null, branchId?: string | null) {
  if (!employee) return "retail-staff";

  const scopedBranchId = String(branchId || "").trim();

  if (scopedBranchId) {
    const branchRole = employee.branchRoles.find((item) => item.branchId === scopedBranchId);
    if (branchRole?.roleCode) return branchRole.roleCode;
  }

  if (employee.branchRoles.length) {
    return employee.branchRoles[0]?.roleCode || employee.roleId || "retail-staff";
  }

  return employee.roleId || "retail-staff";
}

function mergeBranchRolesForBranch(
  employee: EmployeeItem,
  branchId: string,
  roleCode: string,
) {
  const map = new Map<string, BranchRoleItem>();

  employee.branchRoles.forEach((row) => {
    if (!row?.branchId) return;
    map.set(row.branchId, {
      id: row.id,
      staffId: row.staffId || employee.id,
      branchId: row.branchId,
      roleCode: normalizeRole(row.roleCode || employee.roleId || "retail-staff"),
      branch: row.branch || null,
    });
  });

  map.set(branchId, {
    staffId: employee.id,
    branchId,
    roleCode: normalizeRole(roleCode || "retail-staff"),
    branch: branchesSafeFind(branchId),
  } as BranchRoleItem);

  return Array.from(map.values()).map((row) => ({
    branchId: row.branchId,
    roleCode: row.roleCode,
  }));
}

function branchesSafeFind(_branchId: string) {
  return null;
}

function buildBranchPermissionsForEmployee(
  employee: EmployeeItem,
  branchId: string,
  roleCode: string,
  mode: "replace" | "merge",
) {
  const permissionMap = new Map<string, BranchPermission>();

  employee.branchPermissions.forEach((row) => {
    if (!row?.branchId) return;
    permissionMap.set(row.branchId, sanitizeBranchPermission(row));
  });

  const rolePermission = buildLegacyFlags(roleKeys(roleCode), branchId);

  if (mode === "replace") {
    permissionMap.set(branchId, {
      ...rolePermission,
      branchId,
      note: `Bulk role replace: ${roleCode}`,
    });
  } else {
    const current = permissionMap.get(branchId);
    const currentKeys = current ? getPermissionKeysFromBranchPermission(current) : [];
    const mergedKeys = unique([...currentKeys, ...roleKeys(roleCode)]);
    permissionMap.set(branchId, {
      ...buildLegacyFlags(mergedKeys, branchId),
      branchId,
      note: `Bulk role merge: ${roleCode}`,
    });
  }

  return Array.from(permissionMap.values()).map(sanitizeBranchPermission);
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
    createdAt: item.createdAt || null,
    departments: Array.isArray(item?.departments)
      ? item.departments.map((d: any) => ({
          staffId: d.staffId,
          departmentId: d.departmentId || d.department?.id || d.id,
          isHead: Boolean(d.isHead),
        }))
      : [],
  };
}

function buildEmployeeTree(employees: EmployeeItem[], branches: BranchItem[]) {
  return getAllRoleTemplates().map((role) => {
    const roleEmployees = employees.filter((employee) => {
      if (employee.roles.includes(role.id) || employee.roleId === role.id) return true;
      return employee.branchRoles.some((branchRole) => branchRole.roleCode === role.id);
    });

    const branchGroups = branches
      .map((branch) => ({
        branch,
        employees: roleEmployees.filter((employee) =>
          employee.branchRoles.some(
            (branchRole) =>
              branchRole.branchId === branch.id && branchRole.roleCode === role.id,
          ) ||
          (!employee.branchRoles.length &&
            employee.roleId === role.id &&
            employeeBranchIds(employee).includes(branch.id)),
        ),
      }))
      .filter((group) => group.employees.length > 0);

    const noBranchEmployees = roleEmployees.filter((employee) => employeeBranchIds(employee).length === 0);

    return { role, employees: roleEmployees, branchGroups, noBranchEmployees };
  });
}

function getEmployeeBranchKeys(employee: EmployeeItem, branchId: string) {
  const row = employee.branchPermissions.find((item) => item.branchId === branchId);
  if (row) return getPermissionKeysFromBranchPermission(row);

  const roleCode = getEmployeeRoleForBranch(employee, branchId);
  return roleKeys(roleCode);
}

function getEmployeeAllBranchKeys(employee: EmployeeItem) {
  if (employee.roles.includes("owner") || employee.roles.includes("admin")) return ["*"];

  const branchIds = employeeBranchIds(employee);
  if (!branchIds.length) return getEmployeeEffectiveKeys(employee);

  return unique(
    branchIds.flatMap((branchId) => getEmployeeBranchKeys(employee, branchId)),
  );
}

function getEmployeeBranchRoleChips(employee: EmployeeItem) {
  const map = new Map<string, { branchId: string; roleCode: string }>();

  employee.branchRoles.forEach((row) => {
    if (!row.branchId) return;
    map.set(row.branchId, {
      branchId: row.branchId,
      roleCode: row.roleCode || employee.roleId || "retail-staff",
    });
  });

  employee.branchPermissions.forEach((row) => {
    if (!row.branchId || map.has(row.branchId)) return;
    map.set(row.branchId, {
      branchId: row.branchId,
      roleCode: getEmployeeRoleForBranch(employee, row.branchId),
    });
  });

  if (!map.size && employee.branchId) {
    map.set(employee.branchId, {
      branchId: employee.branchId,
      roleCode: employee.roleId || "retail-staff",
    });
  }

  return Array.from(map.values());
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
  const [roleTemplatesVersion, setRoleTemplatesVersion] = useState(0);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error" | "success">("info");

  const showMessage = (text: string, type: "info" | "error" | "success" = "info") => {
    setMessage(text);
    setMessageType(type);
    if (type !== "info") {
      setTimeout(() => setMessage(""), 6000);
    }
  };
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
  const [editBranchExtraPermissionMap, setEditBranchExtraPermissionMap] = useState<Record<string, string[]>>({});
  const [editBranchDeniedPermissionMap, setEditBranchDeniedPermissionMap] = useState<Record<string, string[]>>({});

  const [newPassword, setNewPassword] = useState("");
  const [secondPassword, setSecondPassword] = useState("");
  const [resetPasswordForId, setResetPasswordForId] = useState<string | null>(null);
  const [secondPasswordForId, setSecondPasswordForId] = useState<string | null>(null);
  const [securitySavingForId, setSecuritySavingForId] = useState<string | null>(null);

  const [customRoleTemplates, setCustomRoleTemplates] = useState<RoleItem[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleScope, setNewRoleScope] = useState<RoleScope>("ONE_BRANCH");
  const [newRoleBase, setNewRoleBase] = useState("retail-staff");
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);

  // Employee tab - edit/create panel
  const [selectedEmpEditId, setSelectedEmpEditId] = useState<string | null>(null);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpCode, setNewEmpCode] = useState("");
  const [newEmpUsername, setNewEmpUsername] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPhone, setNewEmpPhone] = useState("");
  const [newEmpAddress, setNewEmpAddress] = useState("");
  const [newEmpNote, setNewEmpNote] = useState("");
  const [newEmpBranchId, setNewEmpBranchId] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  const [auditTimeline, setAuditTimeline] = useState<PermissionAuditEvent[]>([]);
  const [lastDiff, setLastDiff] = useState<{ added: string[]; removed: string[] }>({ added: [], removed: [] });
  const [showPreview, setShowPreview] = useState(true);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<PageTab>("permissions");

  // Role Template Editor state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleEditorKeys, setRoleEditorKeys] = useState<string[]>([]);
  const [roleEditorModuleId, setRoleEditorModuleId] = useState(PERMISSION_MODULES[0].id);
  const [savingRole, setSavingRole] = useState(false);

  // Sync confirmation modal after saving role
  const [syncModal, setSyncModal] = useState<{ roleId: string; roleName: string; count: number } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Bulk assign apply mode: replace or merge
  const [bulkApplyMode, setBulkApplyMode] = useState<"replace" | "merge">("replace");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Create custom role in roles tab
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleNameRT, setNewRoleNameRT] = useState("");
  const [newRoleCodeRT, setNewRoleCodeRT] = useState("");
  const [newRoleDescRT, setNewRoleDescRT] = useState("");
  const [newRoleScopeRT, setNewRoleScopeRT] = useState<RoleScope>("ONE_BRANCH");
  const [newRoleBaseRT, setNewRoleBaseRT] = useState("retail-staff");

  // Bulk assign state
  const [bulkRoleId, setBulkRoleId] = useState("fulltime");
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Department state
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptColor, setNewDeptColor] = useState("#6366f1");
  const [newDeptDescription, setNewDeptDescription] = useState("");
  const [savingDept, setSavingDept] = useState(false);
  const [employeeDeptMap, setEmployeeDeptMap] = useState<Record<string, string[]>>({});
  const [savingDeptAssign, setSavingDeptAssign] = useState<string | null>(null);
  const [savingAllDeptAssign, setSavingAllDeptAssign] = useState(false);

  // Employee table filter state
  const [empTableQuery, setEmpTableQuery] = useState("");
  const [empTableRole, setEmpTableRole] = useState("");
  const [empTableBranch, setEmpTableBranch] = useState("");
  const [empTableStatus, setEmpTableStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await apiJson<any[]>("/staff", { method: "GET" });
      const mapped = Array.isArray(data) ? data.map(mapApiStaffToEmployee) : [];
      setEmployees(mapped);
      setSelectedEmployeeId((prev) => prev || mapped[0]?.id || null);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Không tải được danh sách nhân viên.", "error");
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

  const loadDepartments = async () => {
    try {
      const data = await apiJson<DepartmentItem[]>("/staff/departments", { method: "GET" });
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  };

  const reloadRoleTemplates = async (silent = true) => {
    try {
      // no-op: role template sync is intentionally silent for multi-browser consistency.
      const before = roleTemplatesFingerprint(readStoredRoleTemplates());
      const roles = await fetchRoleTemplatesFromBackend();
      const after = roleTemplatesFingerprint(roles.length ? roles : readStoredRoleTemplates());

      if (before !== after || !silent) {
        setRoleTemplatesVersion((value) => value + 1);
        setCustomRoleTemplates(readCustomRoleTemplates());
        if (!silent) showMessage("Đã đồng bộ bộ quyền vai trò từ backend.", "success");
      }

      return roles;
    } catch (err) {
      if (!silent) {
        showMessage(err instanceof Error ? err.message : "Không đồng bộ được role template từ backend.", "error");
      }
      return [];
    } finally {
      // keep silent
    }
  };

  const refreshRbacFromBackend = async (silent = true) => {
    await reloadRoleTemplates(silent);
    await loadEmployees();
  };

  useEffect(() => {
    void reloadRoleTemplates(true);
    void loadBranches();
    void loadEmployees();
    void loadDepartments();
  }, []);

  useEffect(() => {
    const refresh = () => {
      void refreshRbacFromBackend(true);
    };

    const interval = window.setInterval(refresh, 12000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("the1970:rbac-updated", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("the1970:rbac-updated", refresh);
    };
  }, []);

  useEffect(() => {
    setAuditTimeline(readAuditTimeline());
    setCustomRoleTemplates(readCustomRoleTemplates());
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
    const nextExtraPermissionMap: Record<string, string[]> = {};
    const nextDeniedPermissionMap: Record<string, string[]> = {};

    selectedEmployee.branchPermissions.forEach((row) => {
      nextPermissionMap[row.branchId] = unique(safeArray<string>(row.permissionKeys));
      nextExtraPermissionMap[row.branchId] = unique(safeArray<string>(row.extraPermissionKeys));
      nextDeniedPermissionMap[row.branchId] = unique(safeArray<string>(row.deniedPermissionKeys));
    });

    Object.entries(nextRoleMap).forEach(([branchId, roleCode]) => {
      if (!nextPermissionMap[branchId]) {
        nextPermissionMap[branchId] = roleKeys(roleCode);
      }
    });

    setEditBranchRoleMap(nextRoleMap);
    setEditBranchPermissionMap(nextPermissionMap);
    setEditBranchExtraPermissionMap(nextExtraPermissionMap);
    setEditBranchDeniedPermissionMap(nextDeniedPermissionMap);
    setSelectedBranchId((prev) => prev && (nextRoleMap[prev] || nextPermissionMap[prev]) ? prev : Object.keys(nextRoleMap)[0] || selectedEmployee.branchId || selectedEmployee.branchPermissions[0]?.branchId || "");
  }, [selectedEmployeeId, selectedEmployee, roleTemplatesVersion]);

  const employeeTree = useMemo(() => buildEmployeeTree(employees, branches), [employees, branches, roleTemplatesVersion]);

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

  // Filtered list for employee table tab
  const filteredEmployees = useMemo(() => {
    const q = empTableQuery.trim().toLowerCase();
    return employees.filter((e) => {
      if (q && !`${e.name} ${e.code} ${e.username || ""} ${e.email || ""} ${e.phone || ""}`.toLowerCase().includes(q)) return false;
      if (empTableRole && !e.roles.includes(empTableRole) && e.roleId !== empTableRole) return false;
      if (empTableBranch) {
        const ids = unique([e.branchId || "", ...e.branchRoles.map((r) => r.branchId)]);
        if (!ids.includes(empTableBranch)) return false;
      }
      if (empTableStatus && e.status !== empTableStatus) return false;
      return true;
    });
  }, [employees, empTableQuery, empTableRole, empTableBranch, empTableStatus]);

  const selectedBranchBaseKeys = useMemo(() => {
    if (!selectedEmployee) return [];
    if (!selectedBranchId) return [];
    return editBranchPermissionMap[selectedBranchId] || roleKeys(editBranchRoleMap[selectedBranchId] || selectedEmployee.roleId);
  }, [selectedEmployee, selectedBranchId, editBranchPermissionMap, editBranchRoleMap, roleTemplatesVersion]);

  const selectedBranchExtraKeys = useMemo(
    () => (selectedBranchId ? editBranchExtraPermissionMap[selectedBranchId] || [] : []),
    [selectedBranchId, editBranchExtraPermissionMap],
  );

  const selectedBranchDeniedKeys = useMemo(
    () => (selectedBranchId ? editBranchDeniedPermissionMap[selectedBranchId] || [] : []),
    [selectedBranchId, editBranchDeniedPermissionMap],
  );

  const selectedBranchKeys = useMemo(() => {
    const keys = new Set<string>(selectedBranchBaseKeys);
    selectedBranchExtraKeys.forEach((key) => keys.add(key));
    selectedBranchDeniedKeys.forEach((key) => keys.delete(key));
    return Array.from(keys);
  }, [selectedBranchBaseKeys, selectedBranchExtraKeys, selectedBranchDeniedKeys]);

  const effectiveKeys = useMemo(
    () => (selectedEmployee ? getEmployeeEffectiveKeys(selectedEmployee, selectedBranchId) : []),
    [selectedEmployee, selectedBranchId, roleTemplatesVersion],
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
        next[branchId] = getEmployeeRoleForBranch(selectedEmployee, branchId);
      } else {
        delete next[branchId];
      }
      return next;
    });

    setEditBranchPermissionMap((prev) => {
      const next = { ...prev };
      if (enabled) {
        next[branchId] = prev[branchId] || roleKeys(getEmployeeRoleForBranch(selectedEmployee, branchId));
        setSelectedBranchId(branchId);
      } else {
        delete next[branchId];
        if (selectedBranchId === branchId) {
          setSelectedBranchId(Object.keys(next)[0] || "");
        }
      }
      return next;
    });

    setEditBranchExtraPermissionMap((prev) => {
      const next = { ...prev };
      if (!enabled) delete next[branchId];
      return next;
    });

    setEditBranchDeniedPermissionMap((prev) => {
      const next = { ...prev };
      if (!enabled) delete next[branchId];
      return next;
    });
  };

  const changeBranchRole = (branchId: string, roleCode: string) => {
    setEditBranchRoleMap((prev) => ({ ...prev, [branchId]: roleCode }));
    setEditBranchPermissionMap((prev) => ({ ...prev, [branchId]: roleKeys(roleCode) }));
    setEditBranchExtraPermissionMap((prev) => ({ ...prev, [branchId]: [] }));
    setEditBranchDeniedPermissionMap((prev) => ({ ...prev, [branchId]: [] }));
  };

  const setBranchExtraPermission = (branchId: string, permissionKey: string, enabled: boolean) => {
    if (!branchId) {
      setMessage("Chọn chi nhánh trước khi chỉnh quyền riêng.");
      return;
    }

    setEditBranchExtraPermissionMap((prev) => {
      const current = new Set(prev[branchId] || []);
      if (enabled) current.add(permissionKey);
      else current.delete(permissionKey);
      return { ...prev, [branchId]: Array.from(current) };
    });

    if (enabled) {
      setEditBranchDeniedPermissionMap((prev) => {
        const current = new Set(prev[branchId] || []);
        current.delete(permissionKey);
        return { ...prev, [branchId]: Array.from(current) };
      });
    }
  };

  const setBranchDeniedPermission = (branchId: string, permissionKey: string, enabled: boolean) => {
    if (!branchId) {
      setMessage("Chọn chi nhánh trước khi chặn quyền riêng.");
      return;
    }

    setEditBranchDeniedPermissionMap((prev) => {
      const current = new Set(prev[branchId] || []);
      if (enabled) current.add(permissionKey);
      else current.delete(permissionKey);
      return { ...prev, [branchId]: Array.from(current) };
    });

    if (enabled) {
      setEditBranchExtraPermissionMap((prev) => {
        const current = new Set(prev[branchId] || []);
        current.delete(permissionKey);
        return { ...prev, [branchId]: Array.from(current) };
      });
    }
  };

  const setModuleAll = (module: PermissionModule, enabled: boolean) => {
    if (!selectedBranchId) return;
    module.actions.forEach((action) => {
      if (enabled) setBranchExtraPermission(selectedBranchId, action.key, true);
      else setBranchDeniedPermission(selectedBranchId, action.key, true);
    });
  };

  const applyPresetToBranch = (roleCode: string) => {
    if (!selectedBranchId) return;
    changeBranchRole(selectedBranchId, roleCode);
  };

  const saveEmployeeProfile = async () => {
    const targetId = selectedEmpEditId || selectedEmployee?.id;
    if (!targetId) return;
    if (!editName.trim() || !editCode.trim()) {
      showMessage("Thiếu tên hoặc mã nhân viên.", "error"); return;
    }
    try {
      setSavingEmployeeId(targetId);
      setMessage("Đang lưu hồ sơ nhân viên...");
      await apiJson(`/staff/${targetId}`, {
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
      setSavedEmployeeId(targetId);
      showMessage("✓ Đã lưu hồ sơ nhân viên.", "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Lưu hồ sơ thất bại.", "error");
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

    const branchPermissions = branchRoles.map(({ branchId, roleCode }) =>
      sanitizeBranchPermission({
        ...(selectedEmployee.branchPermissions.find((row) => row.branchId === branchId) || defaultBranchPermission(branchId)),
        branchId,
        permissionKeys: (editBranchPermissionMap[String(branchId)] || roleKeys(String(roleCode))) as string[],
        extraPermissionKeys: (editBranchExtraPermissionMap[String(branchId)] || []) as string[],
        deniedPermissionKeys: (editBranchDeniedPermissionMap[String(branchId)] || []) as string[],
      }),
    );

    try {
      setSavingEmployeeId(selectedEmployee.id);
      setSavedEmployeeId(null);
      setMessage("Đang lưu ma trận quyền enterprise...");

      const primary = branchRoles[0];
      const beforeKeys = getEmployeeEffectiveKeys(selectedEmployee);
      const afterKeys = unique(branchPermissions.flatMap((row) => getPermissionKeysFromBranchPermission(row)));
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
          roles: unique(branchRoles.map((row) => String(row.roleCode))),
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
      showMessage("Đã lưu quyền. Session cũ của nhân viên sẽ bị invalid và cần login lại để nhận quyền mới.", "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Lưu phân quyền thất bại.", "error");
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const changePassword = async () => {
    const targetId = selectedEmpEditId || selectedEmployee?.id;
    if (!targetId) return;
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      showMessage("Mật khẩu mới tối thiểu 4 ký tự.", "error"); return;
    }
    try {
      setSecuritySavingForId(targetId);
      await apiJson(`/staff/${targetId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword.trim() }),
      });
      setNewPassword("");
      setResetPasswordForId(null);
      showMessage("✓ Đã đổi mật khẩu nhân viên.", "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Đổi mật khẩu thất bại.", "error");
    } finally {
      setSecuritySavingForId(null);
    }
  };

  const changeSecondPassword = async () => {
    const targetId = selectedEmpEditId || selectedEmployee?.id;
    if (!targetId) return;
    if (!/^\d{6}$/.test(secondPassword)) {
      setMessage("PIN bảo mật phải gồm đúng 6 số.");
      return;
    }
    if (["000000", "111111", "123456", "654321"].includes(secondPassword)) {
      setMessage("PIN quá dễ đoán, hãy đặt mã khác.");
      return;
    }

    try {
      setSecuritySavingForId(targetId);
      await apiJson(`/staff/${targetId}/second-password`, {
        method: "PATCH",
        body: JSON.stringify({ secondPassword }),
      });
      setSecondPassword("");
      setSecondPasswordForId(null);
      showMessage("Đã set PIN bảo mật cho nhân viên.", "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Set PIN thất bại.", "error");
    } finally {
      setSecuritySavingForId(null);
    }
  };

  const toggleEmployeeStatus = async () => {
    const targetId = selectedEmpEditId || selectedEmployee?.id;
    const emp = targetId ? employees.find((e) => e.id === targetId) || selectedEmployee : selectedEmployee;
    if (!targetId || !emp) return;
    const nextStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setSavingEmployeeId(targetId);
      await apiJson(`/staff/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: nextStatus === "ACTIVE",
          status: nextStatus,
        }),
      });
      await loadEmployees();
      setMessage(nextStatus === "ACTIVE" ? "Đã kích hoạt nhân viên." : "Đã khóa tài khoản nhân viên.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại.", "error");
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const createCustomRoleTemplate = () => {
    const cleanName = newRoleName.trim();
    const cleanCode = normalizeRoleCodeForStorage(newRoleCode || cleanName);

    if (!cleanName || !cleanCode) {
      setMessage("Thiếu tên hoặc mã vai trò.");
      return;
    }

    if (getAllRoleTemplates().some((role) => role.id === cleanCode)) {
      setMessage("Mã vai trò đã tồn tại. Hãy chọn mã khác.");
      return;
    }

    const baseRole = getRoleTemplate(newRoleBase) || getRoleTemplate("retail-staff");
    const nextRole: RoleItem = {
      id: cleanCode,
      name: cleanName,
      scope: newRoleScope,
      description: newRoleDescription.trim() || `Vai trò tuỳ chỉnh: ${cleanName}`,
      badge: "Custom Role",
      tone: "cyan",
      defaultPermissionKeys: [...(baseRole?.defaultPermissionKeys || [])],
    };

    const next = [...customRoleTemplates, nextRole];
    setCustomRoleTemplates(next);
    writeCustomRoleTemplates(next);

    setNewRoleName("");
    setNewRoleCode("");
    setNewRoleDescription("");
    setNewRoleBase("retail-staff");
    setNewRoleScope("ONE_BRANCH");
    setMessage("Đã tạo vai trò mới. Chọn nhân viên/chi nhánh rồi áp vai trò này để lưu vào quyền thực tế.");
  };

  const deleteCustomRoleTemplate = (roleId: string) => {
    const role = customRoleTemplates.find((item) => item.id === roleId);
    if (!role) return;

    const usedBy = employees.filter((employee) => employee.roles.includes(roleId) || employee.roleId === roleId);
    if (usedBy.length > 0) {
      setMessage(`Không thể xoá vai trò "${role.name}" vì đang có ${usedBy.length} nhân viên sử dụng.`);
      return;
    }

    const next = customRoleTemplates.filter((item) => item.id !== roleId);
    setCustomRoleTemplates(next);
    writeCustomRoleTemplates(next);
    showMessage("Đã xoá vai trò tuỳ chỉnh.", "success");
  };

  const deleteEmployee = async () => {
    const targetId = selectedEmpEditId || selectedEmployee?.id;
    const emp = targetId ? employees.find((e) => e.id === targetId) || selectedEmployee : selectedEmployee;
    if (!targetId || !emp) return;
    const ok = window.confirm(`Xoá nhân viên ${emp.name} (${emp.code})?\n\nKhuyến nghị: chỉ xoá khi tạo nhầm.`);
    if (!ok) return;
    try {
      setDeletingEmployeeId(targetId);
      await apiJson(`/staff/${targetId}`, { method: "DELETE" });
      showMessage("✓ Đã xoá nhân viên.", "success");
      setSelectedEmployeeId(null);
      setSelectedEmpEditId(null);
      await loadEmployees();
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Xoá nhân viên thất bại. Nếu backend chưa có DELETE /staff/:id, dùng Khoá tài khoản trước.",
      );
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  // ── Role Template Editor actions ────────────────────────────────────────────
  const startEditRole = (roleId: string) => {
    const role = getAllRoleTemplates().find((r) => r.id === roleId);
    setEditingRoleId(roleId);
    setRoleEditorKeys(role?.defaultPermissionKeys.includes("*") ? ["*"] : [...(role?.defaultPermissionKeys || [])]);
    setRoleEditorModuleId(PERMISSION_MODULES[0].id);
  };

  const toggleRoleKey = (key: string, enabled: boolean) => {
    setRoleEditorKeys((prev) => {
      const s = new Set(prev);
      if (enabled) s.add(key); else s.delete(key);
      return Array.from(s);
    });
  };

  const setRoleModuleAll = (module: PermissionModule, enabled: boolean) => {
    setRoleEditorKeys((prev) => {
      const s = new Set(prev);
      module.actions.forEach((a) => { if (enabled) s.add(a.key); else s.delete(a.key); });
      return Array.from(s);
    });
  };

  const saveRoleTemplate = async () => {
    if (!editingRoleId) return;
    const roleMeta = getAllRoleTemplates().find((r) => r.id === editingRoleId);
    if (!roleMeta) return;
    try {
      setSavingRole(true);
      setMessage("Đang lưu bộ quyền vai trò...");

      const normalizedRoleEditorKeys = uniquePermissionKeys(roleEditorKeys);

      const custom = readCustomRoleTemplates();
      const idx = custom.findIndex((r) => r.id === editingRoleId);
      if (idx !== -1) {
        custom[idx] = { ...custom[idx], defaultPermissionKeys: normalizedRoleEditorKeys };
        writeCustomRoleTemplates(custom);
        setCustomRoleTemplates([...custom]);
      }

      await apiJson("/staff/role-templates", {
        method: "PATCH",
        body: JSON.stringify({
          roles: [{
            id: editingRoleId,
            roleCode: editingRoleId,
            name: roleMeta.name,
            scope: roleMeta.scope || "ONE_BRANCH",
            description: roleMeta.description || "",
            permissions: { permissionKeys: normalizedRoleEditorKeys },
          }],
        }),
      });

      await refreshRbacFromBackend(true);
      window.dispatchEvent(new Event("the1970:rbac-updated"));
      const staffCount = employees.filter((e) => e.roles.includes(editingRoleId) || e.roleId === editingRoleId).length;
      setMessage("");
      // Show sync confirmation modal
      setSyncModal({ roleId: editingRoleId, roleName: roleMeta.name, count: staffCount });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Lưu bộ quyền thất bại.", "error");
    } finally {
      setSavingRole(false);
    }
  };

  const syncRoleNow = async (force: boolean) => {
    if (!syncModal) return;
    try {
      setSyncing(true);
      await apiJson("/staff/sync-permissions", {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setSyncModal(null);
      await loadEmployees();
      showMessage(`✓ Đã sync quyền "${syncModal.roleName}" xuống ${syncModal.count} nhân viên. Họ cần đăng nhập lại để nhận quyền mới.`, "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Sync thất bại.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const createCustomRoleInRolesTab = () => {
    const name = newRoleNameRT.trim();
    const code = normalizeRoleCodeForStorage(newRoleCodeRT || name);
    if (!name || !code) { showMessage("Thiếu tên hoặc mã vai trò.", "error"); return; }
    if (getAllRoleTemplates().some((r) => r.id === code)) { showMessage("Mã vai trò đã tồn tại.", "error"); return; }
    const base = getRoleTemplate(newRoleBaseRT) || getRoleTemplate("retail-staff");
    const newRole: RoleItem = {
      id: code, name, scope: newRoleScopeRT,
      description: newRoleDescRT.trim() || `Vai trò tuỳ chỉnh: ${name}`,
      badge: "Custom", tone: "cyan",
      defaultPermissionKeys: [...(base?.defaultPermissionKeys || [])],
    };
    const next = [...customRoleTemplates, newRole];
    setCustomRoleTemplates(next);
    writeCustomRoleTemplates(next);
    setNewRoleNameRT(""); setNewRoleCodeRT(""); setNewRoleDescRT("");
    setNewRoleScopeRT("ONE_BRANCH"); setNewRoleBaseRT("retail-staff");
    setShowCreateRole(false);
    // Auto-select the new role for editing
    startEditRole(code);
    showMessage(`✓ Đã tạo vai trò "${name}". Tick quyền ở bên phải rồi lưu.`, "success");
  };

  // ── Bulk assign role ─────────────────────────────────────────────────────────
  const bulkAssignRole = async () => {
    if (!bulkRoleId || !bulkBranchId || bulkSelectedIds.size === 0) {
      showMessage("Chọn vai trò, chi nhánh và ít nhất 1 nhân viên.", "error");
      return;
    }

    setShowBulkConfirm(false);

    try {
      setBulkAssigning(true);
      setMessage(`Đang gán vai trò cho ${bulkSelectedIds.size} nhân viên...`);

      const ids = Array.from(bulkSelectedIds);

      const results = await Promise.allSettled(
        ids.map(async (staffId) => {
          const employee = employees.find((item) => item.id === staffId);
          if (!employee) throw new Error(`Không tìm thấy nhân viên ${staffId}`);

          const normalizedBulkRoleId = normalizeRole(bulkRoleId);
          const rolePermissionKeys = roleKeys(normalizedBulkRoleId);

          let branchRoles: { branchId: string; roleCode: string }[] = [];
          let branchPermissions: BranchPermission[] = [];

          if (bulkApplyMode === "replace") {
            // Replace nghĩa là reset nhân viên về đúng 1 chi nhánh đang chọn.
            // Không giữ branchRoles / branchPermissions cũ của chi nhánh khác,
            // tránh case nhân viên vẫn còn 2 badge chi nhánh sau khi bấm "Đặt lại".
            branchRoles = [
              {
                branchId: bulkBranchId,
                roleCode: normalizedBulkRoleId,
              },
            ];

            branchPermissions = [
              sanitizeBranchPermission({
                ...buildLegacyFlags(rolePermissionKeys, bulkBranchId),
                branchId: bulkBranchId,
                note: `Bulk replace role ${normalizedBulkRoleId}`,
              }),
            ];
          } else {
            const roleMap = new Map<string, string>();

            employee.branchRoles.forEach((row) => {
              if (!row.branchId) return;
              roleMap.set(row.branchId, normalizeRole(row.roleCode || employee.roleId || "retail-staff"));
            });

            if (!roleMap.size && employee.branchId) {
              roleMap.set(employee.branchId, normalizeRole(employee.roleId || "retail-staff"));
            }

            roleMap.set(bulkBranchId, normalizedBulkRoleId);

            branchRoles = Array.from(roleMap.entries()).map(([branchId, roleCode]) => ({
              branchId,
              roleCode,
            }));

            const permissionMap = new Map<string, BranchPermission>();

            employee.branchPermissions.forEach((row) => {
              if (!row.branchId) return;
              permissionMap.set(row.branchId, sanitizeBranchPermission(row));
            });

            const currentPermission = permissionMap.get(bulkBranchId);
            const currentKeys = currentPermission
              ? getPermissionKeysFromBranchPermission(currentPermission)
              : [];
            const nextKeys = unique([...currentKeys, ...rolePermissionKeys]);

            permissionMap.set(bulkBranchId, {
              ...buildLegacyFlags(nextKeys, bulkBranchId),
              branchId: bulkBranchId,
              note: `Bulk merge role ${normalizedBulkRoleId}`,
            });

            branchPermissions = Array.from(permissionMap.values()).map(sanitizeBranchPermission);
          }

          await apiJson(`/staff/${staffId}`, {
            method: "PATCH",
            body: JSON.stringify({
              role: branchRoles[0]?.roleCode || normalizedBulkRoleId,
              branchId: branchRoles[0]?.branchId || bulkBranchId,
            }),
          });

          await apiJson(`/staff/${staffId}/branch-roles`, {
            method: "PATCH",
            body: JSON.stringify({ branchRoles }),
          });

          return apiJson(`/staff/${staffId}/permissions`, {
            method: "PATCH",
            body: JSON.stringify({
              roles: unique(branchRoles.map((row) => row.roleCode)),
              branchPermissions,
            }),
          });
        }),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      setBulkSelectedIds(new Set());
      await loadEmployees();

      if (failed === 0) {
        showMessage(
          `✓ ${bulkApplyMode === "replace" ? "Đặt lại quyền chi nhánh" : "Giữ quyền + cộng thêm"} — Gán "${getRoleName(bulkRoleId)}" tại ${getBranchName(branches, bulkBranchId)} cho ${succeeded} nhân viên thành công.`,
          "success",
        );
      } else {
        showMessage(`Gán xong ${succeeded}/${ids.length} nhân viên. ${failed} thất bại.`, "error");
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Gán vai trò thất bại.", "error");
    } finally {
      setBulkAssigning(false);
    }
  };

  // ── Employee tab: open edit panel ───────────────────────────────────────────
  const openEmpEdit = (e: EmployeeItem) => {
    setSelectedEmpEditId(e.id);
    // Sync fields dùng chung với permissions tab
    setEditName(e.name || "");
    setEditCode(e.code || "");
    setEditUsername(e.username || "");
    setEditEmail(e.email || "");
    setEditPhone(e.phone || "");
    setEditAddress(e.address || "");
    setEditNote(e.note || "");
    setEditMainBranchId(employeePrimaryBranch(e));
    setResetPasswordForId(null);
    setSecondPasswordForId(null);
    setNewPassword("");
    setSecondPassword("");
  };

  const resetNewEmployeeForm = () => {
    setSelectedEmpEditId(null);
    setNewEmpName("");
    setNewEmpCode("");
    setNewEmpUsername("");
    setNewEmpEmail("");
    setNewEmpPhone("");
    setNewEmpAddress("");
    setNewEmpNote("");
    setNewEmpBranchId("");
    setNewEmpPassword("");
  };

  // ── Employee tab: create new employee ────────────────────────────────────────
  const createNewEmployee = async () => {
    if (!newEmpName.trim() || !newEmpCode.trim()) {
      showMessage("Thiếu họ tên và mã nhân viên.", "error"); return;
    }
    if (!newEmpPassword || newEmpPassword.length < 4) {
      showMessage("Mật khẩu ban đầu tối thiểu 4 ký tự.", "error"); return;
    }
    try {
      setCreatingEmployee(true);
      await apiJson("/staff", {
        method: "POST",
        body: JSON.stringify({
          name: newEmpName.trim(),
          code: newEmpCode.trim(),
          username: newEmpUsername.trim() || undefined,
          email: newEmpEmail.trim() || undefined,
          phone: newEmpPhone.trim() || undefined,
          address: newEmpAddress.trim() || undefined,
          note: newEmpNote.trim() || undefined,
          branchId: newEmpBranchId || undefined,
          password: newEmpPassword,
          role: "retail-staff",
        }),
      });
      showMessage(`✓ Đã tạo nhân viên "${newEmpName.trim()}". Vào tab Vai trò để gán vai trò và chi nhánh.`, "success");
      resetNewEmployeeForm();
      await loadEmployees();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Tạo nhân viên thất bại.", "error");
    } finally {
      setCreatingEmployee(false);
    }
  };

  const createDepartment = async () => {
    if (!newDeptName.trim()) { setMessage("Thiếu tên phòng ban."); return; }
    try {
      setSavingDept(true);
      await apiJson("/staff/departments", {
        method: "POST",
        body: JSON.stringify({ name: newDeptName.trim(), color: newDeptColor, description: newDeptDescription.trim() }),
      });
      setNewDeptName(""); setNewDeptColor("#6366f1"); setNewDeptDescription("");
      await loadDepartments();
      showMessage("Đã tạo phòng ban.", "success");
    } catch (err) { showMessage(err instanceof Error ? err.message : "Tạo phòng ban thất bại.", "error"); }
    finally { setSavingDept(false); }
  };

  const deleteDepartment = async (id: string) => {
    if (!window.confirm("Xoá phòng ban? Toàn bộ nhân viên sẽ rời phòng ban này.")) return;
    try {
      await apiJson(`/staff/departments/${id}`, { method: "DELETE" });
      await loadDepartments();
      showMessage("Đã xoá phòng ban.", "success");
    } catch (err) { showMessage(err instanceof Error ? err.message : "Xoá phòng ban thất bại.", "error"); }
  };

  const saveEmployeeDepartments = async (staffId: string) => {
    try {
      setSavingDeptAssign(staffId);
      await apiJson(`/staff/${staffId}/departments`, {
        method: "PATCH",
        body: JSON.stringify({ departmentIds: employeeDeptMap[staffId] || [] }),
      });
      await loadEmployees(); await loadDepartments();
      showMessage("Đã cập nhật phòng ban nhân viên.", "success");
    } catch (err) { showMessage(err instanceof Error ? err.message : "Cập nhật phòng ban thất bại.", "error"); }
    finally { setSavingDeptAssign(null); }
  };

  const saveAllEmployeeDepartments = async () => {
    const entries = Object.entries(employeeDeptMap);
    if (!entries.length) {
      showMessage("Chưa có thay đổi phòng ban để lưu.", "info");
      return;
    }

    try {
      setSavingAllDeptAssign(true);
      let saved = 0;
      for (const [staffId, departmentIds] of entries) {
        await apiJson(`/staff/${staffId}/departments`, {
          method: "PATCH",
          body: JSON.stringify({ departmentIds }),
        });
        saved += 1;
      }
      setEmployeeDeptMap({});
      await loadEmployees();
      await loadDepartments();
      showMessage(`✓ Đã lưu phân bổ phòng ban cho ${saved} nhân viên.`, "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Lưu phân bổ phòng ban thất bại.", "error");
    } finally {
      setSavingAllDeptAssign(false);
    }
  };

  const toggleEmployeeDept = (staffId: string, deptId: string, checked: boolean) => {
    setEmployeeDeptMap((prev) => {
      const current = new Set(prev[staffId] || employees.find((e) => e.id === staffId)?.departments?.map((d) => d.departmentId) || []);
      if (checked) current.add(deptId); else current.delete(deptId);
      return { ...prev, [staffId]: Array.from(current) };
    });
  };

  const saveRoleTemplates = async () => {
    await reloadRoleTemplates(false);
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

      <RbacSnapshotPanel />

      {message ? (
        <div className={`flex items-center justify-between gap-4 rounded-3xl border px-5 py-4 text-sm font-semibold shadow-sm ${
          messageType === "error" ? "border-red-200 bg-red-50 text-red-800" :
          messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
          "border-neutral-200 bg-white text-neutral-800"
        }`}>
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}
            className="shrink-0 rounded-full p-1 opacity-50 hover:opacity-100 transition">✕</button>
        </div>
      ) : null}

      {/* Tab navigation */}
      <div className="grid grid-cols-4 gap-2 rounded-3xl border border-neutral-200 bg-white p-2 shadow-sm">
        {([
          ["permissions", "⚡ Advanced Override", "Ngoại lệ riêng từng nhân viên"],
          ["roles",       "🎭 Vai trò",           "Bộ quyền chuẩn & gán hàng loạt"],
          ["employees",  "👤 Nhân viên",          "Tạo, sửa hồ sơ & bảo mật"],
          ["departments","🏢 Phòng ban",           "Nhóm nhân viên theo bộ phận"],
        ] as [PageTab, string, string][]).map(([tab, label, sub]) => (
          <button key={tab} type="button" onClick={() => { setActiveTab(tab); setMessage(""); }}
            className={`flex flex-col items-center rounded-2xl px-3 py-3 text-center transition ${activeTab === tab ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
            <span className="text-sm font-black">{label}</span>
            <span className={`mt-0.5 text-[11px] font-normal ${activeTab === tab ? "text-white/60" : "text-neutral-400"}`}>{sub}</span>
          </button>
        ))}
      </div>

      {activeTab === "permissions" && (
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
                            key={`${roleGroup.role.id}-${group.branch.id}-${employee.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeId(employee.id);
                              setSelectedBranchId(group.branch.id);
                            }}
                            className={cx(
                              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                              selectedEmployeeId === employee.id && selectedBranchId === group.branch.id
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
                          key={`no-branch-${employee.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(employee.id);
                            setSelectedBranchId("");
                          }}
                          className={cx(
                            "mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                            selectedEmployeeId === employee.id && !selectedBranchId
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Advanced Override</p>
                <h2 className="mt-1 text-2xl font-black">
                  {selectedEmployee ? selectedEmployee.name : "Chọn nhân viên"}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Chỉ dùng cho ngoại lệ riêng: thêm quyền riêng hoặc chặn quyền riêng. Role chính quản lý ở tab Vai trò.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button"
                  onClick={() => { setActiveTab("employees"); setMessage(""); }}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 transition">
                  ✏️ Sửa hồ sơ / mật khẩu
                </button>
                <Button onClick={saveEmployeePermissions} loading={savingEmployeeId === selectedEmployee?.id}>
Lưu override
                </Button>
              </div>
            </div>
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
                    <Button variant="secondary" disabled={!selectedBranchId} onClick={() => setModuleAll(selectedModule, true)}>Thêm cả nhóm</Button>
                    <Button variant="secondary" disabled={!selectedBranchId} onClick={() => setModuleAll(selectedModule, false)}>Chặn cả nhóm</Button>
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
                    {getAllRoleTemplates().filter((role) => role.scope === "ONE_BRANCH").map((role) => (
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

              <div className="grid gap-5 p-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-black text-emerald-800">+ Thêm quyền riêng</p>
                    <p className="mt-1 text-xs text-emerald-700">Chỉ cộng thêm quyền cho nhân viên này tại chi nhánh đang chọn.</p>
                  </div>
                  <div className="grid gap-3">
                    {selectedModule.actions.map((action) => (
                      <PermissionCheck
                        key={`extra-${action.key}`}
                        action={action}
                        checked={selectedBranchExtraKeys.includes(action.key)}
                        onChange={(checked) => setBranchExtraPermission(selectedBranchId, action.key, checked)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-black text-red-800">− Chặn quyền riêng</p>
                    <p className="mt-1 text-xs text-red-700">Chặn một quyền đang có từ vai trò mẫu. Role gốc vẫn được giữ nguyên.</p>
                  </div>
                  <div className="grid gap-3">
                    {selectedModule.actions.map((action) => (
                      <PermissionCheck
                        key={`deny-${action.key}`}
                        action={action}
                        checked={selectedBranchDeniedKeys.includes(action.key)}
                        onChange={(checked) => setBranchDeniedPermission(selectedBranchId, action.key, checked)}
                      />
                    ))}
                  </div>
                </div>
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
                        {getAllRoleTemplates().filter((role) => role.scope === "ONE_BRANCH" || role.id === "admin").map((role) => (
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Hướng dẫn</p>
            <h3 className="mt-1 text-xl font-black">Tab này dùng để làm gì?</h3>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <p className="font-black text-neutral-900">🔐 Tab này — Phân quyền cá nhân</p>
                <p className="mt-1 text-neutral-500">Chọn nhân viên ở cột trái → xem quyền hiệu lực thực tế → override từng quyền riêng lẻ nếu cần. Dùng khi 1 nhân viên cần quyền đặc biệt khác vai trò mặc định.</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="font-black text-blue-900">🎭 Tab Vai trò — Quản lý bộ quyền</p>
                <p className="mt-1 text-blue-700">Sửa bộ quyền mặc định của cả vai trò (Fulltime, Quản lý...) → gán vai trò hàng loạt cho nhiều nhân viên cùng lúc. Dùng khi onboard nhân viên mới hoặc thay đổi chính sách quyền.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setActiveTab("roles"); setMessage(""); }}
              className="mt-4 w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 transition"
            >
              → Chuyển sang tab Vai trò & Gán hàng loạt
            </button>
          </Panel>

                    <Panel className="border-red-200 bg-red-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Danger Zone</p>
            <h3 className="mt-1 text-xl font-black text-red-950">Khoá / xoá nhân viên</h3>
            <p className="mt-1 text-xs text-red-700">
              Khoá tài khoản là lựa chọn an toàn. Chỉ xoá nhân viên nếu tạo nhầm và chưa có dữ liệu vận hành.
            </p>
            <div className="mt-4 grid gap-2">
              <Button variant="danger" disabled={!selectedEmployee} onClick={toggleEmployeeStatus} loading={savingEmployeeId === selectedEmployee?.id}>
                {selectedEmployee?.status === "ACTIVE" ? "Khoá tài khoản nhân viên" : "Mở khoá tài khoản nhân viên"}
              </Button>
              <Button variant="danger" disabled={!selectedEmployee} onClick={deleteEmployee} loading={deletingEmployeeId === selectedEmployee?.id}>
                Xoá nhân viên
              </Button>
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
      )} {/* end permissions tab */}

      {/* ── Tab: Quản lý nhân viên ─────────────────────────────────────────── */}
      {/* ── Tab: Vai trò & Gán hàng loạt ─────────────────────────────────── */}
      {activeTab === "roles" && (
        <div className="space-y-5">

          {/* ── Sync Confirmation Modal ───────────────────────────────────── */}
          {syncModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Đã lưu bộ quyền</p>
                <h3 className="mt-2 text-2xl font-black">Sync xuống nhân viên?</h3>
                <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
                  <p className="text-sm font-bold text-neutral-700">
                    Vai trò: <span className="text-neutral-950">{syncModal.roleName}</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {syncModal.count} nhân viên đang dùng vai trò này.
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-neutral-600">
                    <p>Nếu sync ngay:</p>
                    <p className="ml-3">• Quyền mới áp dụng cho tất cả {syncModal.count} nhân viên</p>
                    <p className="ml-3">• Override riêng lẻ vẫn được giữ (force=false)</p>
                    <p className="ml-3">• Nhân viên cần login lại để nhận quyền mới</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  <Button onClick={() => syncRoleNow(false)} loading={syncing} className="w-full">
                    ⚡ Sync ngay {syncModal.count} nhân viên
                  </Button>
                  <Button variant="secondary" onClick={() => { setSyncModal(null); showMessage("✓ Đã lưu bộ quyền. Sync sau khi cần.", "success"); }} className="w-full">
                    Để sau (nhân viên nhận quyền mới khi đăng nhập lại)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Bulk Confirm Modal ────────────────────────────────────────── */}
          {showBulkConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Xác nhận gán vai trò</p>
                <h3 className="mt-2 text-2xl font-black">Áp dụng cho {bulkSelectedIds.size} nhân viên</h3>
                <div className="mt-4 rounded-2xl bg-neutral-50 p-4 space-y-2 text-sm">
                  <p><span className="font-bold">Vai trò:</span> {getRoleName(bulkRoleId)}</p>
                  <p><span className="font-bold">Chi nhánh:</span> {getBranchName(branches, bulkBranchId)}</p>
                  <p><span className="font-bold">Chế độ:</span> {bulkApplyMode === "replace" ? "Reset về đúng chi nhánh này theo vai trò mới" : "Giữ quyền hiện tại + cộng thêm vai trò mới"}</p>
                  {bulkApplyMode === "replace" && (
                    <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs">
                      ⚠ Nhân viên sẽ chỉ còn chi nhánh đang chọn. Các chi nhánh cũ sẽ bị xoá khỏi branchRoles và branchPermissions.
                    </div>
                  )}
                </div>
                <div className="mt-5 grid gap-2">
                  <Button onClick={bulkAssignRole} loading={bulkAssigning} className="w-full">
                    Xác nhận — Áp dụng
                  </Button>
                  <Button variant="secondary" onClick={() => setShowBulkConfirm(false)} className="w-full">
                    Huỷ
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">

            {/* Cột trái — danh sách vai trò */}
            <div className="space-y-2">
              <Panel className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Role Templates</p>
                    <h2 className="mt-0.5 text-lg font-black">Vai trò</h2>
                  </div>
                  <button type="button" onClick={() => setShowCreateRole(!showCreateRole)}
                    className="rounded-2xl border border-neutral-300 px-3 py-2 text-xs font-bold hover:bg-neutral-50 transition">
                    {showCreateRole ? "✕ Đóng" : "＋ Tạo vai trò"}
                  </button>
                </div>
                {showCreateRole && (
                  <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
                    <input value={newRoleNameRT} onChange={(e) => { setNewRoleNameRT(e.target.value); if (!newRoleCodeRT) setNewRoleCodeRT(normalizeRoleCodeForStorage(e.target.value)); }}
                      className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500" placeholder="Tên vai trò *" />
                    <input value={newRoleCodeRT} onChange={(e) => setNewRoleCodeRT(normalizeRoleCodeForStorage(e.target.value))}
                      className="h-10 w-full rounded-xl border border-neutral-200 px-3 font-mono text-sm outline-none focus:border-neutral-500" placeholder="ma-vai-tro" />
                    <textarea value={newRoleDescRT} onChange={(e) => setNewRoleDescRT(e.target.value)}
                      className="min-h-14 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none" placeholder="Mô tả ngắn" />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newRoleBaseRT} onChange={(e) => setNewRoleBaseRT(e.target.value)} className="h-9 rounded-xl border border-neutral-200 px-2 text-xs outline-none">
                        {getAllRoleTemplates().map((r) => <option key={r.id} value={r.id}>Copy từ {r.name}</option>)}
                      </select>
                      <select value={newRoleScopeRT} onChange={(e) => setNewRoleScopeRT(e.target.value as RoleScope)} className="h-9 rounded-xl border border-neutral-200 px-2 text-xs outline-none">
                        <option value="ONE_BRANCH">Theo chi nhánh</option>
                        <option value="ALL_BRANCHES">Toàn hệ thống</option>
                      </select>
                    </div>
                    <Button onClick={createCustomRoleInRolesTab} className="w-full">Tạo vai trò mới</Button>
                  </div>
                )}
              </Panel>
              {getAllRoleTemplates().map((role) => {
                const count = employees.filter((e) => e.roles.includes(role.id) || e.roleId === role.id).length;
                const isEditing = editingRoleId === role.id;
                const isCustom = readCustomRoleTemplates().some((r) => r.id === role.id);
                return (
                  <button key={role.id} type="button" onClick={() => startEditRole(role.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition hover:shadow-md ${isEditing ? "border-neutral-950 bg-neutral-950 text-white shadow-lg" : "border-neutral-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${isEditing ? "border-white/20 bg-white/10 text-white" : toneClasses[role.tone]}`}>
                            {role.badge}
                          </span>
                          {isCustom && <span className={`text-[10px] font-bold ${isEditing ? "text-white/50" : "text-neutral-400"}`}>Custom</span>}
                        </div>
                        <p className="mt-1.5 text-sm font-black">{role.name}</p>
                        <p className={`text-[11px] ${isEditing ? "text-white/60" : "text-neutral-400"}`}>
                          {count > 0 ? `${count} nhân viên đang dùng` : "Chưa có nhân viên"}
                        </p>
                      </div>
                      {isEditing && (
                        <div className="shrink-0 rounded-2xl bg-white/15 px-2 py-1 text-center">
                          <p className="text-lg font-black">{roleEditorKeys.includes("*") ? "∞" : roleEditorKeys.length}</p>
                          <p className="text-[9px] text-white/70">quyền</p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cột phải — editor */}
            <div className="space-y-4">
              {editingRoleId ? (
                <>
                  {/* Sticky save bar */}
                  <div className="sticky top-2 z-10">
                    <Panel className="flex items-center justify-between gap-4 p-4 shadow-md">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-400">Đang sửa bộ quyền</p>
                        <p className="mt-0.5 text-lg font-black">{getAllRoleTemplates().find((r) => r.id === editingRoleId)?.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-2xl bg-neutral-100 px-3 py-1.5 text-sm font-bold text-neutral-600">
                          {roleEditorKeys.includes("*") ? "Toàn quyền" : `${roleEditorKeys.length} quyền bật`}
                        </span>
                        <Button onClick={saveRoleTemplate} loading={savingRole}>
                          💾 Lưu bộ quyền
                        </Button>
                      </div>
                    </Panel>
                  </div>

                  {/* Module tabs */}
                  <div className="flex flex-wrap gap-2">
                    {PERMISSION_MODULES.map((module) => {
                      const granted = module.actions.filter((a) => permissionGranted(roleEditorKeys, a.key)).length;
                      const isActive = roleEditorModuleId === module.id;
                      return (
                        <button key={module.id} type="button" onClick={() => setRoleEditorModuleId(module.id)}
                          className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition ${isActive ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
                          <span>{module.icon}</span>
                          <span className="hidden sm:inline">{module.title}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${isActive ? "bg-white/20 text-white" : granted === module.actions.length ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                            {granted}/{module.actions.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Permission grid */}
                  {(() => {
                    const mod = PERMISSION_MODULES.find((m) => m.id === roleEditorModuleId) || PERMISSION_MODULES[0];
                    return (
                      <Panel className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-neutral-200 p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{mod.icon}</span>
                            <div>
                              <p className="font-black">{mod.title}</p>
                              <p className="text-xs text-neutral-500">{mod.subtitle}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setRoleModuleAll(mod, true)}>Bật tất cả</Button>
                            <Button variant="secondary" onClick={() => setRoleModuleAll(mod, false)}>Tắt tất cả</Button>
                          </div>
                        </div>
                        <div className="grid gap-3 p-4 md:grid-cols-2">
                          {mod.actions.map((action) => (
                            <PermissionCheck key={action.key} action={action}
                              checked={permissionGranted(roleEditorKeys, action.key)}
                              onChange={(checked) => toggleRoleKey(action.key, checked)} />
                          ))}
                        </div>
                      </Panel>
                    );
                  })()}
                </>
              ) : (
                <Panel className="flex min-h-64 items-center justify-center p-12">
                  <div className="text-center">
                    <p className="text-5xl">👈</p>
                    <p className="mt-4 text-base font-bold text-neutral-700">Chọn vai trò ở cột trái</p>
                    <p className="mt-1 text-sm text-neutral-400">để xem và chỉnh sửa bộ quyền mặc định</p>
                  </div>
                </Panel>
              )}
            </div>
          </div>

          {/* ── Bulk Assign ──────────────────────────────────────────────────── */}
          <Panel className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Bulk Assign</p>
                <h3 className="mt-1 text-xl font-black">Gán vai trò hàng loạt</h3>
                <p className="mt-1 text-sm text-neutral-500">Chọn vai trò + chi nhánh → tick nhân viên → Áp dụng.</p>
              </div>
              {/* Replace / Merge toggle */}
              <div className="flex overflow-hidden rounded-2xl border border-neutral-200">
                <button type="button" onClick={() => setBulkApplyMode("replace")}
                  className={`px-4 py-2 text-xs font-bold transition ${bulkApplyMode === "replace" ? "bg-neutral-950 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                  Đặt lại quyền chi nhánh này
                </button>
                <button type="button" onClick={() => setBulkApplyMode("merge")}
                  className={`px-4 py-2 text-xs font-bold transition border-l border-neutral-200 ${bulkApplyMode === "merge" ? "bg-neutral-950 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                  Giữ quyền + cộng thêm
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {bulkApplyMode === "replace"
                ? "Đặt lại nhân viên về đúng chi nhánh đang chọn. Các chi nhánh cũ của nhân viên sẽ bị xoá khỏi phân quyền."
                : "Giữ quyền hiện tại của chi nhánh đang chọn và cộng thêm quyền từ vai trò mới."}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select value={bulkRoleId} onChange={(e) => setBulkRoleId(e.target.value)}
                className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500">
                {getAllRoleTemplates().filter((r) => r.scope === "ONE_BRANCH" || r.id === "admin").map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select value={bulkBranchId} onChange={(e) => setBulkBranchId(e.target.value)}
                className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500">
                <option value="">Chọn chi nhánh làm việc</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Employee list */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
              <div className="flex items-center justify-between bg-neutral-50 px-4 py-3 border-b border-neutral-200">
                <p className="text-sm font-black text-neutral-700">
                  {bulkSelectedIds.size > 0
                    ? <span className="text-neutral-950">{bulkSelectedIds.size} đã chọn</span>
                    : "Chưa chọn nhân viên nào"
                  }
                  <span className="ml-2 font-normal text-neutral-400">/ {employees.filter((e) => e.status === "ACTIVE").length} nhân viên active</span>
                </p>
                <div className="flex gap-3">
                  <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    onClick={() => setBulkSelectedIds(new Set(employees.filter((e) => e.status === "ACTIVE").map((e) => e.id)))}>
                    Chọn tất cả
                  </button>
                  <button type="button" className="text-xs font-bold text-neutral-500 hover:text-neutral-800"
                    onClick={() => setBulkSelectedIds(new Set())}>
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div className="max-h-72 divide-y divide-neutral-100 overflow-auto">
                {employees.filter((e) => e.status === "ACTIVE").map((e) => {
                  const checked = bulkSelectedIds.has(e.id);
                  // Vai trò + chi nhánh hiện tại của nhân viên này
                  const currentRoleBranches = e.branchRoles.map((br) => ({
                    roleName: getRoleName(br.roleCode),
                    branchName: getBranchName(branches, br.branchId),
                    roleId: br.roleCode,
                  }));
                  const hasTargetRoleAtBranch = e.branchRoles.some(
                    (br) => br.roleCode === bulkRoleId && br.branchId === bulkBranchId
                  );
                  return (
                    <label key={e.id}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-neutral-50 ${checked ? "bg-blue-50/60" : ""}`}>
                      <input type="checkbox" checked={checked}
                        onChange={(ev) => {
                          const next = new Set(bulkSelectedIds);
                          if (ev.target.checked) next.add(e.id); else next.delete(e.id);
                          setBulkSelectedIds(next);
                        }}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-neutral-950" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-neutral-900">{e.name}</p>
                        <p className="font-mono text-[11px] text-neutral-400">{e.code}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {hasTargetRoleAtBranch ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            ✓ Đã có vai trò này
                          </span>
                        ) : currentRoleBranches.length > 0 ? (
                          currentRoleBranches.slice(0, 2).map((rb, i) => {
                            const role = getRoleTemplate(rb.roleId);
                            return (
                              <div key={i} className="flex items-center justify-end gap-1.5">
                                <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${role ? toneClasses[role.tone] : "border-neutral-200 bg-neutral-50 text-neutral-500"}`}>
                                  {rb.roleName}
                                </span>
                                <span className="text-[10px] text-neutral-400">{rb.branchName}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic">Chưa gán vai trò</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Apply button */}
            <div className="mt-4 space-y-2">
              <Button
                onClick={() => {
                  if (bulkSelectedIds.size === 0 || !bulkBranchId) return;
                  setShowBulkConfirm(true);
                }}
                loading={bulkAssigning}
                disabled={bulkSelectedIds.size === 0 || !bulkBranchId}
                className="w-full">
                Xem trước & Áp dụng —
                <strong className="mx-1">{getRoleName(bulkRoleId)}</strong>
                <span className="opacity-70">({bulkApplyMode})</span>
                {bulkSelectedIds.size > 0 && bulkBranchId
                  ? <> · <strong>{bulkSelectedIds.size}</strong> nhân viên tại {getBranchName(branches, bulkBranchId)}</>
                  : null}
              </Button>
              {(!bulkBranchId || bulkSelectedIds.size === 0) && (
                <p className="text-center text-xs text-neutral-400">
                  {!bulkBranchId ? "↑ Chọn chi nhánh trước" : "↑ Tick ít nhất 1 nhân viên"}
                </p>
              )}
            </div>
          </Panel>
        </div>
      )}

      {activeTab === "employees" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">

          {/* ── Danh sách + filter ────────────────────────────────────────── */}
          <div className="space-y-4">
            <Panel className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Employee Directory</p>
                  <h2 className="mt-1 text-2xl font-black">Danh sách nhân viên</h2>
                </div>
                <span className="rounded-2xl bg-neutral-100 px-3 py-1.5 text-sm font-bold">
                  {filteredEmployees.length}/{employees.length} nhân viên
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <input value={empTableQuery} onChange={(e) => setEmpTableQuery(e.target.value)} placeholder="Tìm tên, mã, email, SĐT..."
                  className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500" />
                <select value={empTableRole} onChange={(e) => setEmpTableRole(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none">
                  <option value="">Tất cả vai trò</option>
                  {getAllRoleTemplates().map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select value={empTableBranch} onChange={(e) => setEmpTableBranch(e.target.value)} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none">
                  <option value="">Tất cả chi nhánh</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={empTableStatus} onChange={(e) => setEmpTableStatus(e.target.value as "" | "ACTIVE" | "INACTIVE")} className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none">
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Đã khóa</option>
                </select>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50">
                    <tr>
                      {["Nhân viên", "Vai trò / Chi nhánh", "Quyền", "Đăng nhập", "Ngày tạo", "Trạng thái", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-neutral-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredEmployees.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-400">{loadingEmployees ? "Đang tải..." : "Không có nhân viên nào."}</td></tr>
                    ) : filteredEmployees.map((e) => {
                      const keys = getEmployeeAllBranchKeys(e);
                      const dangerous = keys.filter((k) => k === "*" || DANGEROUS_KEYS.has(k)).length;
                      const isSelected = selectedEmpEditId === e.id;
                      const branchRoleChips = getEmployeeBranchRoleChips(e);
                      return (
                        <tr key={e.id} className={`transition hover:bg-neutral-50 ${isSelected ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-3">
                            <p className="font-black text-neutral-900">{e.name}</p>
                            <p className="font-mono text-[11px] text-neutral-400">{e.code}</p>
                            {e.phone ? <p className="text-[11px] text-neutral-400">{e.phone}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            {branchRoleChips.length ? (
                              <div className="flex max-w-[360px] flex-wrap gap-1.5">
                                {branchRoleChips.map((br) => {
                                  const role = getRoleTemplate(br.roleCode);
                                  return (
                                    <span
                                      key={`${e.id}-${br.branchId}-${br.roleCode}`}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                                        role ? toneClasses[role.tone] : "border-neutral-200 bg-neutral-50 text-neutral-500"
                                      }`}
                                      title={`${getBranchName(branches, br.branchId)} — ${role?.name || br.roleCode}`}
                                    >
                                      <span>{role?.name || br.roleCode}</span>
                                      <span className="text-neutral-400">·</span>
                                      <span>{getBranchName(branches, br.branchId)}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-400 italic">Chưa gán</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold">{keys.includes("*") ? "∞" : keys.length}</span>
                            {dangerous > 0 ? <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{dangerous}⚠</span> : null}
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-500">{formatDateTime(e.lastLoginAt)}</td>
                          <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(e.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${e.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                              {e.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => openEmpEdit(e)}
                              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-neutral-300 hover:bg-neutral-50"}`}>
                              {isSelected ? "Đang sửa" : "Sửa"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ── Panel sửa/tạo nhân viên ───────────────────────────────────── */}
          <div className="space-y-4">
            <Panel className="overflow-hidden">
              <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
                  {selectedEmpEditId ? "Sửa nhân viên" : "Tạo nhân viên mới"}
                </p>
                <h3 className="mt-0.5 text-xl font-black">
                  {selectedEmpEditId ? employees.find((e) => e.id === selectedEmpEditId)?.name || "..." : "Thêm nhân viên"}
                </h3>
              </div>

              <div className="space-y-3 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={selectedEmpEditId ? editName : newEmpName}
                    onChange={(e) => selectedEmpEditId ? setEditName(e.target.value) : setNewEmpName(e.target.value)}
                    className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
                    placeholder="Họ tên *"
                  />
                  <input
                    value={selectedEmpEditId ? editCode : newEmpCode}
                    onChange={(e) => selectedEmpEditId ? setEditCode(e.target.value) : setNewEmpCode(e.target.value)}
                    className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
                    placeholder="Mã NV *"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={selectedEmpEditId ? editUsername : newEmpUsername}
                    onChange={(e) => selectedEmpEditId ? setEditUsername(e.target.value) : setNewEmpUsername(e.target.value)}
                    className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
                    placeholder="Username (đăng nhập)"
                  />
                  <input
                    value={selectedEmpEditId ? editPhone : newEmpPhone}
                    onChange={(e) => selectedEmpEditId ? setEditPhone(e.target.value) : setNewEmpPhone(e.target.value)}
                    className="h-11 rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
                    placeholder="Số điện thoại"
                  />
                </div>
                <input
                  value={selectedEmpEditId ? editEmail : newEmpEmail}
                  onChange={(e) => selectedEmpEditId ? setEditEmail(e.target.value) : setNewEmpEmail(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
                  placeholder="Email"
                />
                <input
                  value={selectedEmpEditId ? editAddress : newEmpAddress}
                  onChange={(e) => selectedEmpEditId ? setEditAddress(e.target.value) : setNewEmpAddress(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
                  placeholder="Địa chỉ"
                />
                <textarea
                  value={selectedEmpEditId ? editNote : newEmpNote}
                  onChange={(e) => selectedEmpEditId ? setEditNote(e.target.value) : setNewEmpNote(e.target.value)}
                  className="min-h-[72px] w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  placeholder="Ghi chú"
                />
                <select
                  value={selectedEmpEditId ? editMainBranchId : newEmpBranchId}
                  onChange={(e) => selectedEmpEditId ? setEditMainBranchId(e.target.value) : setNewEmpBranchId(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500">
                  <option value="">Chi nhánh chính</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                {!selectedEmpEditId && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-neutral-500">Mật khẩu ban đầu *</p>
                    <input type="password" value={newEmpPassword} onChange={(e) => setNewEmpPassword(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500" placeholder="Tối thiểu 4 ký tự" />
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  {selectedEmpEditId ? (
                    <>
                      <Button onClick={saveEmployeeProfile} loading={savingEmployeeId === selectedEmpEditId} className="flex-1">
                        Lưu hồ sơ
                      </Button>
                      <button type="button" onClick={resetNewEmployeeForm}
                        className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 transition">
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <div className="grid w-full grid-cols-[1fr_auto] gap-2">
                      <Button onClick={createNewEmployee} loading={creatingEmployee} className="w-full">
                        ＋ Tạo nhân viên mới
                      </Button>
                      <button type="button" onClick={resetNewEmployeeForm}
                        className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 transition">
                        Xoá form
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/* Mật khẩu & PIN — chỉ hiện khi đang sửa */}
            {selectedEmpEditId && (
              <Panel className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Bảo mật</p>
                <h3 className="mt-1 text-lg font-black">Mật khẩu & PIN</h3>
                <div className="mt-4 space-y-3">
                  {resetPasswordForId === selectedEmpEditId ? (
                    <div className="space-y-2">
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mật khẩu mới (tối thiểu 4 ký tự)"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none" />
                      <div className="flex gap-2">
                        <Button onClick={changePassword} loading={securitySavingForId === selectedEmpEditId} className="flex-1">Lưu mật khẩu</Button>
                        <button type="button" onClick={() => { setResetPasswordForId(null); setNewPassword(""); }}
                          className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50">Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" className="w-full"
                      onClick={() => setResetPasswordForId(selectedEmpEditId)}>
                      🔑 Đổi mật khẩu
                    </Button>
                  )}
                  {secondPasswordForId === selectedEmpEditId ? (
                    <div className="space-y-2">
                      <input type="text" inputMode="numeric" value={secondPassword}
                        onChange={(e) => setSecondPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="PIN 6 số (không dùng 000000, 123456...)"
                        className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none" />
                      <div className="flex gap-2">
                        <Button onClick={changeSecondPassword} loading={securitySavingForId === selectedEmpEditId} className="flex-1">Lưu PIN</Button>
                        <button type="button" onClick={() => { setSecondPasswordForId(null); setSecondPassword(""); }}
                          className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50">Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" className="w-full"
                      onClick={() => setSecondPasswordForId(selectedEmpEditId)}>
                      🔐 Đặt PIN bảo mật
                    </Button>
                  )}
                </div>
              </Panel>
            )}

            {/* Khoá / Xoá — chỉ hiện khi đang sửa */}
            {selectedEmpEditId && (() => {
              const emp = employees.find((e) => e.id === selectedEmpEditId);
              return (
                <Panel className="border-red-200 bg-red-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Danger Zone</p>
                  <h3 className="mt-1 text-lg font-black text-red-950">Khoá / xoá tài khoản</h3>
                  <p className="mt-1 text-xs text-red-700">Khoá an toàn hơn xoá. Chỉ xoá khi tạo nhầm và chưa có dữ liệu vận hành.</p>
                  <div className="mt-4 grid gap-2">
                    <Button variant="danger" onClick={toggleEmployeeStatus} loading={savingEmployeeId === selectedEmpEditId}>
                      {emp?.status === "ACTIVE" ? "🔒 Khoá tài khoản" : "🔓 Mở khoá tài khoản"}
                    </Button>
                    <Button variant="danger" onClick={deleteEmployee} loading={deletingEmployeeId === selectedEmpEditId}>
                      🗑 Xoá nhân viên
                    </Button>
                  </div>
                </Panel>
              );
            })()}

            {/* Link sang phân quyền */}
            {selectedEmpEditId && (
              <button type="button"
                onClick={() => {
                  setSelectedEmployeeId(selectedEmpEditId);
                  setActiveTab("permissions");
                  setMessage("");
                }}
                className="w-full rounded-3xl border border-neutral-200 bg-white p-4 text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition shadow-sm">
                🔐 Vào tab Phân quyền để chỉnh quyền cho nhân viên này →
              </button>
            )}
          </div>
        </div>
      )}

            {/* ── Tab: Phòng ban ─────────────────────────────────────────────────── */}
      {activeTab === "departments" && (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Department Studio</p>
            <h2 className="mt-1 text-xl font-black">Tạo phòng ban mới</h2>
            <div className="mt-4 space-y-3">
              <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                className="h-11 w-full rounded-2xl border border-neutral-200 px-3 text-sm outline-none" placeholder="Tên phòng ban, vd: Kho Quốc Oai" />
              <textarea value={newDeptDescription} onChange={(e) => setNewDeptDescription(e.target.value)}
                className="min-h-16 w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm outline-none" placeholder="Mô tả phòng ban" />
              <div>
                <p className="mb-2 text-xs font-bold text-neutral-500">Màu nhận diện</p>
                <div className="flex flex-wrap gap-2">
                  {["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6","#14b8a6"].map((c) => (
                    <button key={c} type="button" onClick={() => setNewDeptColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition ${newDeptColor === c ? "border-neutral-950 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button onClick={createDepartment} loading={savingDept} className="w-full">Tạo phòng ban</Button>
            </div>
            {departments.length ? (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">Phòng ban hiện tại</p>
                {departments.map((dept) => (
                  <div key={dept.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: dept.color }} />
                        <div>
                          <p className="text-sm font-black">{dept.name}</p>
                          <p className="text-[11px] text-neutral-400">{dept.members.length} thành viên</p>
                        </div>
                      </div>
                      <Button variant="danger" onClick={() => deleteDepartment(dept.id)}>Xoá</Button>
                    </div>
                    {dept.description ? <p className="mt-2 text-xs text-neutral-500">{dept.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
          <div className="space-y-5">
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Staff Assignment</p>
              <h2 className="mt-1 text-xl font-black">Gán nhân viên vào phòng ban</h2>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-500">Tick phòng ban cho từng nhân viên rồi bấm Lưu tất cả. Hệ thống không tự lưu khi mới tích chọn.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cx(
                    "rounded-full px-3 py-1.5 text-xs font-bold",
                    Object.keys(employeeDeptMap).length
                      ? "bg-amber-100 text-amber-800"
                      : "bg-neutral-100 text-neutral-500",
                  )}>
                    Đã thay đổi {Object.keys(employeeDeptMap).length} nhân viên
                  </span>
                  <Button onClick={saveAllEmployeeDepartments} loading={savingAllDeptAssign} disabled={!Object.keys(employeeDeptMap).length}>
                    Lưu tất cả phân bổ phòng ban
                  </Button>
                </div>
              </div>
            </Panel>
            {departments.length === 0 ? (
              <Panel className="p-8 text-center">
                <p className="text-neutral-400">Chưa có phòng ban nào. Tạo phòng ban ở cột trái trước.</p>
              </Panel>
            ) : (
              <Panel className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50">
                      <tr>
                        <th className="px-5 py-3.5 text-left text-xs font-black uppercase tracking-wider text-neutral-500">Nhân viên</th>
                        {departments.map((dept) => (
                          <th key={dept.id} className="px-4 py-3.5 text-center text-xs font-black uppercase tracking-wider text-neutral-500">
                            <div className="flex flex-col items-center gap-1">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: dept.color }} />
                              <span>{dept.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {employees.filter((e) => e.status === "ACTIVE").map((e) => {
                        const currentDepts = employeeDeptMap[e.id] || e.departments?.map((d) => d.departmentId) || [];
                        return (
                          <tr key={e.id} className="hover:bg-neutral-50">
                            <td className="px-5 py-3">
                              <p className="font-bold">{e.name}</p>
                              <p className="font-mono text-[11px] text-neutral-400">{e.code}</p>
                            </td>
                            {departments.map((dept) => (
                              <td key={dept.id} className="px-4 py-3 text-center">
                                <input type="checkbox" checked={currentDepts.includes(dept.id)}
                                  onChange={(ev) => toggleEmployeeDept(e.id, dept.id, ev.target.checked)}
                                  className="h-4 w-4 cursor-pointer accent-neutral-950" />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
