"use client";
import { useAuth } from "@/components/admin/auth/AuthProvider";
import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CategoryNormalizer from "@/components/admin/products/CategoryNormalizer";
import * as XLSX from "xlsx";
import {
  addVariant,
  createProduct,
  deleteProduct,
  getBranches,
  getProducts,
  importProductsFiles,
  toggleProductStatus,
  updateProduct,
  uploadProductImage,
  clearAllProductDescriptions,
  type AddVariantPayload,
  type BranchItem,
  type CreateProductPayload,
  type ProductItem,
} from "@/lib/products-api";
import {
  createCategory,
  getCategories,
  type ProductCategoryItem,
} from "@/lib/product-categories-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { addWorkspaceTab } from "@/lib/workspace-tabs";
import {
  findPrintTemplate,
  loadPrintTemplates,
} from "@/lib/print-template-config";
import {
  openProductLabelPrintDocument,
  renderProductLabelsHtml,
  type ProductLabelPrintItem,
} from "@/lib/print-template-engine";

function sortCategoriesForDisplay<
  T extends { name?: string; sortOrder?: number; isActive?: boolean },
>(rows: T[]) {
  return [...rows]
    .filter((item) => item.isActive !== false)
    .sort((a, b) => {
      const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "vi", {
        sensitivity: "base",
        numeric: true,
      });
    });
}

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toCode(input: string) {
  return slugify(input).replace(/-/g, "_").toUpperCase();
}

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean)),
  );
}

function getMainSku(product: ProductItem) {
  const firstSku = product.variants?.[0]?.sku || "";
  if (!firstSku) return "—";
  return firstSku.split("-")[0] || firstSku;
}

function parseCommaTokens(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasCommaFormat(value: string) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (!text.includes(",")) return false;
  return parseCommaTokens(text).length > 0;
}

function toAbsoluteFileUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

type CurrentUserPermissionProfile = {
  id?: string;
  code?: string;
  email?: string;
  role?: string;
  roles?: string[];
  branchId?: string | null;
  permissions?: string[];
  permissionKeys?: string[];
  branchPermissions?: Array<{
    branchId?: string | null;
    permissionKeys?: string[];
    canView?: boolean;
    canViewStock?: boolean;
    canManageStock?: boolean;
    canViewMoney?: boolean;
    canExportProductExcel?: boolean;
    canImportProductExcel?: boolean;
  }>;
};

function normalizeRoleCode(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getUserRoles(user?: CurrentUserPermissionProfile | null) {
  return Array.from(
    new Set(
      [...(Array.isArray(user?.roles) ? user?.roles || [] : []), user?.role]
        .map(normalizeRoleCode)
        .filter(Boolean),
    ),
  );
}

function getPrimaryAppRole(
  user?: CurrentUserPermissionProfile | null,
): AppRole {
  const roles = getUserRoles(user);
  return (roles.find((role) =>
    [
      "owner",
      "admin",
      "branch-manager",
      "fulltime",
      "retail-staff",
      "stock-auditor",
      "stock-staff",
    ].includes(role),
  ) || "retail-staff") as AppRole;
}

function isOwnerOrAdminUser(user?: CurrentUserPermissionProfile | null) {
  const roles = getUserRoles(user);
  return roles.includes("owner") || roles.includes("admin");
}

function normalizeId(value: any) {
  return String(value || "").trim();
}

function getScopedBranchPermissionRows(
  user?: CurrentUserPermissionProfile | null,
) {
  const rows = Array.isArray(user?.branchPermissions)
    ? user?.branchPermissions || []
    : [];
  const branchId = normalizeId(user?.branchId);

  if (!branchId) return rows;

  const scoped = rows.filter((row) => normalizeId(row?.branchId) === branchId);
  return scoped.length ? scoped : rows;
}

function getCurrentUserPermissionKeys(
  user?: CurrentUserPermissionProfile | null,
) {
  const keys = new Set<string>();

  if (Array.isArray(user?.permissions)) {
    user?.permissions.forEach((permission) => {
      if (permission) keys.add(String(permission));
    });
  }

  if (Array.isArray(user?.permissionKeys)) {
    user?.permissionKeys.forEach((permission) => {
      if (permission) keys.add(String(permission));
    });
  }

  getScopedBranchPermissionRows(user).forEach((row) => {
    if (Array.isArray(row?.permissionKeys)) {
      row.permissionKeys.forEach((permission) => {
        if (permission) keys.add(String(permission));
      });
    }
  });

  return keys;
}

function hasLegacyProductInventoryPermission(
  user: CurrentUserPermissionProfile | null,
  permission: string,
) {
  return getScopedBranchPermissionRows(user).some((row) => {
    if (permission === "products.view") return Boolean(row.canView);
    if (permission === "inventory.view") return Boolean(row.canViewStock);
    if (permission === "inventory.manage") return Boolean(row.canManageStock);
    if (permission === "inventory.value.view") return Boolean(row.canViewMoney);
    if (permission === "products.excel.export")
      return Boolean(row.canExportProductExcel);
    if (permission === "products.excel.import")
      return Boolean(row.canImportProductExcel);
    return false;
  });
}

function hasProductInventoryPermission(
  user: CurrentUserPermissionProfile | null,
  role: AppRole,
  permission: string,
) {
  if (isOwnerOrAdminUser(user)) return true;
  return (
    getCurrentUserPermissionKeys(user).has(permission) ||
    hasLegacyProductInventoryPermission(user, permission) ||
    hasPermission(role, permission as any)
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
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
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "success"
        ? "bg-emerald-600 text-white hover:bg-emerald-500"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
      type={type}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
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

function TokenPreview({
  value,
  placeholder,
}: {
  value: string;
  placeholder?: string;
}) {
  const valid = hasCommaFormat(value);
  const tokens = parseCommaTokens(value);

  if (!value.trim()) {
    return (
      <div className="text-xs text-neutral-400">
        {placeholder || "Chưa có dữ liệu"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {valid ? (
          tokens.map((token) => (
            <span
              key={token}
              className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
            >
              {token}
            </span>
          ))
        ) : (
          <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            {value}
          </span>
        )}
      </div>

      {!valid ? (
        <div className="text-xs text-red-600">
          Sai định dạng. Hãy nhập theo kiểu: S, M, L hoặc ĐEN, TRẮNG
        </div>
      ) : null}
    </div>
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
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{value}</h3>
        <p className="mt-2 text-xs text-neutral-500">{sub}</p>
      </div>
    </Panel>
  );
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        className={`max-h-[90vh] w-full ${maxWidthClass} overflow-auto rounded-3xl bg-white p-5 shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-3xl font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-xl text-neutral-500"
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function toneForStatus(
  value?: string,
): "gray" | "green" | "amber" | "red" | "blue" {
  if (["ACTIVE"].includes(String(value))) return "green";
  if (["INACTIVE", "DISABLED", "DRAFT"].includes(String(value))) return "red";
  return "gray";
}

const fallbackProductGroups = [
  "T-Shirt",
  "Shirt",
  "Polo",
  "Outerwear",
  "Knitwear",
  "Accessories",
];

const brandOptions = ["The 1970", "The 1970 Heritage", "The 1970 Studio"];

function createEmptyBranchStocks(branches: BranchItem[]) {
  return Object.fromEntries(branches.map((branch) => [branch.id, "0"]));
}

function shortText(text?: string | null, max = 56) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function ProductImage({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="h-12 w-12 overflow-hidden rounded-2xl bg-neutral-100">
      {src ? (
        <img
          src={toAbsoluteFileUrl(src)}
          alt={alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
          No image
        </div>
      )}
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-900"
      title={`Sắp xếp theo ${label}`}
    >
      <span>{label}</span>
      <span
        className={
          active
            ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[13px] font-bold text-white"
            : "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1 text-[13px] font-bold text-neutral-700"
        }
      >
        {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

type ParsedRow = Record<string, any>;

type ImportPreviewRow = {
  productName: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  sku: string;
  weight: number;
  imageUrl: string;
  productImageUrl: string;
  colorImageUrl: string;
  imageSource: string;
  imageWarning: string;
  retailPrice: number;
  importPrice: number;
  stockCL: number;
  stockXD: number;
  stockQO: number;
  stockTH: number;
};
type ProductSummary = {
  totalProducts: number;
  totalVariants: number;
  lowStockSkus: number;
  totalInventoryValue: number;
};

type ProductSortKey =
  | "name"
  | "category"
  | "color"
  | "size"
  | "sku"
  | "price"
  | "costPrice"
  | "branchStock"
  | "stock"
  | "status"
  | "description"
  | "createdAt"
  | "sales";

type SortDirection = "asc" | "desc";
type ProductDisplayPreset = "default" | "newest" | "bestSelling" | "priceHigh";

const PRODUCT_DISPLAY_OPTIONS_STORAGE_KEY = "the1970.products.displayOptions";

function normalizeNumber(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).replace(/[^\d.-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeader(value: any) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*:]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findValue(row: ParsedRow, keys: string[]) {
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    const matched = rowKeys.find((k) => normalizeHeader(k) === normalizedKey);
    if (matched) {
      const value = row[matched];
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return String(value).trim();
      }
    }
  }
  return "";
}

function findColorImageUrl(row: ParsedRow, color: string) {
  const colorText = String(color || "").trim();
  const normalizedColor = normalizeHeader(colorText);

  const direct = findValue(row, [
    `Ảnh màu ${colorText}`,
    `Anh mau ${colorText}`,
    `Ảnh ${colorText}`,
    `Anh ${colorText}`,
    `Image ${colorText}`,
    `Color image ${colorText}`,
  ]);

  if (direct) return direct;

  const rowKeys = Object.keys(row);
  const matched = rowKeys.find((key) => {
    const normalizedKey = normalizeHeader(key);
    return (
      normalizedColor &&
      normalizedKey.includes("anh") &&
      normalizedKey.includes("mau") &&
      normalizedKey.includes(normalizedColor)
    );
  });

  if (!matched) return "";

  const value = row[matched];
  return value !== undefined && value !== null ? String(value).trim() : "";
}

function findColorImageMatch(row: ParsedRow, color: string) {
  const colorText = String(color || "").trim();
  const normalizedColor = normalizeHeader(colorText);

  if (!normalizedColor) {
    return { url: "", source: "" };
  }

  const wantedHeaders = [
    `Ảnh màu ${colorText}`,
    `Anh mau ${colorText}`,
    `Ảnh ${colorText}`,
    `Anh ${colorText}`,
    `Image ${colorText}`,
    `Color image ${colorText}`,
  ];

  for (const wanted of wantedHeaders) {
    const wantedKey = normalizeHeader(wanted);
    const matchedKey = Object.keys(row).find(
      (key) => normalizeHeader(key) === wantedKey,
    );
    if (!matchedKey) continue;

    const value = String(row[matchedKey] || "").trim();
    if (value) return { url: value, source: matchedKey };
  }

  const matchedKey = Object.keys(row).find((key) => {
    const normalizedKey = normalizeHeader(key);
    return (
      normalizedKey.includes("anh") &&
      normalizedKey.includes("mau") &&
      normalizedKey.includes(normalizedColor)
    );
  });

  if (!matchedKey) {
    return { url: "", source: "" };
  }

  const value = String(row[matchedKey] || "").trim();
  return value ? { url: value, source: matchedKey } : { url: "", source: "" };
}

function getImportPriceFromRow(row: ParsedRow) {
  // Ưu tiên giá nhập/vốn toàn cục; nếu trống thì lấy giá vốn khởi tạo theo chi nhánh SAPO.
  return normalizeNumber(
    findValue(row, [
      "PL_Giá nhập",
      "PL_Giá nhập*",
      "pl gia nhap",
      "gia nhap",
      "PL_Giá vốn",
      "PL_Giá vốn*",
      "pl gia von",
      "gia von",
      "LC_CN1_Giá vốn khởi tạo*",
      "LC_CN1_Giá vốn khởi tạo",
      "lc cn1 gia von khoi tao",
      "LC_CN2_Giá vốn khởi tạo*",
      "LC_CN2_Giá vốn khởi tạo",
      "lc cn2 gia von khoi tao",
      "LC_CN3_Giá vốn khởi tạo*",
      "LC_CN3_Giá vốn khởi tạo",
      "lc cn3 gia von khoi tao",
      "LC_CN4_Giá vốn khởi tạo*",
      "LC_CN5_Tồn kho ban đầu*",
      "LC_CN5_Giá vốn khởi tạo*",
      "LC_CN4_Giá vốn khởi tạo",
      "lc cn4 gia von khoi tao",
      "LC_CN5_Giá vốn khởi tạo*",
      "LC_CN5_Giá vốn khởi tạo",
      "lc cn5 gia von khoi tao",
    ]),
  );
}

function detectHeaderRowIndex(sheetData: any[][]) {
  return sheetData.findIndex((row) => {
    if (!Array.isArray(row)) return false;

    const joined = row.map((cell) => normalizeHeader(cell)).join(" | ");

    return (
      joined.includes("ten san pham") ||
      joined.includes("ma sku") ||
      joined.includes("gia tri thuoc tinh 1") ||
      joined.includes("gia tri thuoc tinh 2") ||
      joined.includes("pl gia ban le")
    );
  });
}

function buildRowsFromSheetData(
  sheetData: any[][],
  headerRowIndex: number,
): ParsedRow[] {
  const headerRow = (sheetData[headerRowIndex] || []).map((cell) =>
    String(cell ?? "").trim(),
  );

  const rows: ParsedRow[] = [];

  for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
    const rowArray = sheetData[i];
    if (!Array.isArray(rowArray)) continue;

    const rowObject: ParsedRow = {};

    for (let col = 0; col < headerRow.length; col++) {
      const header = headerRow[col];
      if (!header) continue;
      rowObject[header] = rowArray[col] ?? "";
    }

    rows.push(rowObject);
  }

  return rows;
}

function downloadProductTemplate() {
  const headers = [
    [
      "Tên sản phẩm*",
      "Danh mục sản phẩm",
      "Mô tả sản phẩm",
      "Nhãn hiệu",
      "Giá trị thuộc tính 1",
      "Giá trị thuộc tính 2",
      "Mã SKU*",
      "Khối lượng",
      "Ảnh đại diện",
      "PL_Giá bán lẻ",
      "PL_Giá nhập",
      "LC_CN1_Tồn kho ban đầu*",
      "LC_CN1_Giá vốn khởi tạo*",
      "LC_CN2_Tồn kho ban đầu*",
      "LC_CN2_Giá vốn khởi tạo*",
      "LC_CN3_Tồn kho ban đầu*",
      "LC_CN3_Giá vốn khởi tạo*",
      "LC_CN4_Tồn kho ban đầu*",
      "LC_CN4_Giá vốn khởi tạo*",
      "LC_CN5_Tồn kho ban đầu*",
      "LC_CN5_Giá vốn khởi tạo*",
    ],
    [
      "Áo sơ mi kẻ SM936",
      "áo somi dài tay",
      "",
      "The 1970",
      "THAN",
      "S",
      "SM936-T-S",
      300,
      "https://example.com/sm936.jpg",
      600000,
      0, // Giá nhập
      0, // CHÙA LÁNG tồn
      0, // CHÙA LÁNG giá vốn
      0, // XÃ ĐÀN tồn
      0, // XÃ ĐÀN giá vốn
      0, // QUỐC OAI tồn
      0, // QUỐC OAI giá vốn
      0, // THÁI HÀ tồn
      0, // THÁI HÀ giá vốn
      0, // CN5 tồn nếu file SAPO có
      0, // CN5 giá vốn nếu file SAPO có
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products_template");
  XLSX.writeFile(wb, "products_import_template.xlsx");
}

function downloadProductImageTemplate() {
  const headers = [
    [
      "Tên sản phẩm*",
      "Danh mục sản phẩm",
      "Mô tả sản phẩm",
      "Nhãn hiệu",
      "Giá trị thuộc tính 1",
      "Giá trị thuộc tính 2",
      "Mã SKU*",
      "Khối lượng",
      "Ảnh đại diện",
      "Ảnh chính",
      "Ảnh màu",
      "Ảnh màu ĐEN",
      "Ảnh màu RÊU",
      "Ảnh màu XANH",
      "PL_Giá bán lẻ",
      "PL_Giá nhập",
      "LC_CN1_Tồn kho ban đầu*",
      "LC_CN1_Giá vốn khởi tạo*",
      "LC_CN2_Tồn kho ban đầu*",
      "LC_CN2_Giá vốn khởi tạo*",
      "LC_CN3_Tồn kho ban đầu*",
      "LC_CN3_Giá vốn khởi tạo*",
      "LC_CN4_Tồn kho ban đầu*",
      "LC_CN4_Giá vốn khởi tạo*",
      "LC_CN5_Tồn kho ban đầu*",
      "LC_CN5_Giá vốn khởi tạo*",
    ],
    [
      "Áo sơ mi kẻ SM936",
      "áo somi dài tay",
      "",
      "The 1970",
      "ĐEN",
      "S",
      "SM936-DEN-S",
      300,
      "https://res.cloudinary.com/demo/image/upload/main.jpg",
      "https://res.cloudinary.com/demo/image/upload/main.jpg",
      "https://res.cloudinary.com/demo/image/upload/den.jpg",
      "https://res.cloudinary.com/demo/image/upload/den.jpg",
      "",
      "",
      600000,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products_image_template");
  XLSX.writeFile(wb, "products_import_with_images_template.xlsx");
}

function getVariantBranchStockValue(
  variant: ProductItem["variants"][number],
  branchId: string,
) {
  const v = variant as any;

  const directBranchStocks = v.branchStocks || v.inventoryByBranch || {};
  if (directBranchStocks && directBranchStocks[branchId] !== undefined) {
    return Number(directBranchStocks[branchId] || 0);
  }

  const inventoryItems = v.inventoryItems || v.inventory || [];
  if (Array.isArray(inventoryItems)) {
    const found = inventoryItems.find(
      (item: any) => item.branchId === branchId,
    );
    if (found) {
      return Number(found.availableQty ?? found.qty ?? found.quantity ?? 0);
    }
  }

  return 0;
}

type ExportProductScope = "filtered" | "all" | "current_page";
type ExportSortMode =
  | "product_asc"
  | "stock_desc"
  | "value_desc"
  | "missing_cost_first";

type ExportColumnKey =
  | "productName"
  | "slug"
  | "category"
  | "brand"
  | "weight"
  | "imageUrl"
  | "sku"
  | "color"
  | "size"
  | "price"
  | "costPrice"
  | "branchStocks"
  | "totalStock"
  | "inventoryValue"
  | "status"
  | "description";

type ExportColumnState = Record<ExportColumnKey, boolean>;

type EnterpriseExportOptions = {
  scope: ExportProductScope;
  branchIds: string[];
  columns: ExportColumnState;
  onlyInStock: boolean;
  onlyMissingCost: boolean;
  onlyLowStock: boolean;
  includeSummarySheet: boolean;
  includeBranchSheets: boolean;
  sortMode: ExportSortMode;
};

type LabelPrintVariantRow = {
  key: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
};

const labelPrinterOptions = [
  "Máy in mặc định",
  "Máy in tem 50x50",
  "Xprinter / Godex / TSC",
  "Máy in văn phòng",
];

const labelPaperOptions = [
  { value: "50x50_gap04", label: "Tem cuộn 50 × 50mm · hở 0,4mm" },
  { value: "50x50", label: "Tem cuộn 50 × 50mm" },
];

const PRINT_CENTER_PRODUCT_LABEL_DRAFT_KEY =
  "the1970.print-center.product-labels.draft";

const defaultExportColumns: ExportColumnState = {
  productName: true,
  slug: true,
  category: true,
  brand: true,
  weight: false,
  imageUrl: false,
  sku: true,
  color: true,
  size: true,
  price: true,
  costPrice: true,
  branchStocks: true,
  totalStock: true,
  inventoryValue: true,
  status: true,
  description: false,
};

const exportColumnLabels: Record<ExportColumnKey, string> = {
  productName: "Tên sản phẩm",
  slug: "Mã sản phẩm",
  category: "Danh mục",
  brand: "Brand",
  weight: "Khối lượng",
  imageUrl: "Ảnh",
  sku: "SKU",
  color: "Màu",
  size: "Size",
  price: "Giá bán",
  costPrice: "Giá nhập",
  branchStocks: "Tồn theo chi nhánh",
  totalStock: "Tổng tồn",
  inventoryValue: "Giá trị tồn",
  status: "Trạng thái",
  description: "Mô tả",
};

function safeSheetName(name: string) {
  return (
    String(name || "Sheet")
      .replace(/[\\/?*\[\]:]/g, " ")
      .trim()
      .slice(0, 31) || "Sheet"
  );
}

function makeWorksheet(rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ "Không có dữ liệu": "" }],
  );
  const firstRow = rows[0] || { "Không có dữ liệu": "" };
  const columnCount = Object.keys(firstRow).length;
  const rowCount = Math.max(rows.length, 1) + 1;

  ws["!cols"] = Object.keys(firstRow).map((key) => ({
    wch: Math.min(Math.max(String(key).length + 4, 14), 42),
  }));

  if (columnCount > 0) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rowCount - 1, c: columnCount - 1 },
      }),
    };
  }

  return ws;
}

function buildEnterpriseProductExport(
  exportProducts: ProductItem[],
  exportBranches: BranchItem[],
  options: EnterpriseExportOptions,
) {
  const selectedBranches = options.branchIds.length
    ? exportBranches.filter((branch) => options.branchIds.includes(branch.id))
    : exportBranches;

  const rows: Record<string, any>[] = [];
  const summaryByProduct = new Map<
    string,
    {
      productName: string;
      skuRoot: string;
      totalStock: number;
      inventoryValue: number;
      variantCount: number;
      missingCostCount: number;
    }
  >();

  for (const product of exportProducts) {
    for (const variant of product.variants || []) {
      const price = Number(variant.price || 0);
      const costPrice = Number((variant as any).costPrice || 0);
      const branchStocks = Object.fromEntries(
        selectedBranches.map((branch) => [
          branch.id,
          getVariantBranchStockValue(variant, branch.id),
        ]),
      );
      const totalStock = Object.values(branchStocks).reduce(
        (sum, qty) => sum + Number(qty || 0),
        0,
      );
      const inventoryValue = totalStock * costPrice;
      const isMissingCost = totalStock > 0 && costPrice <= 0;
      const isLowStock = totalStock > 0 && totalStock <= 3;

      if (options.onlyInStock && totalStock <= 0) continue;
      if (options.onlyMissingCost && !isMissingCost) continue;
      if (options.onlyLowStock && !isLowStock) continue;

      const row: Record<string, any> = {};

      if (options.columns.productName) row["Tên sản phẩm"] = product.name || "";
      if (options.columns.slug) row["Mã sản phẩm"] = product.slug || "";
      if (options.columns.category) row["Danh mục"] = product.category || "";
      if (options.columns.brand) row["Brand"] = product.brand || "";
      if (options.columns.weight)
        row["Khối lượng"] = Number(product.weight || 0);
      if (options.columns.imageUrl) row["Ảnh"] = product.imageUrl || "";
      if (options.columns.sku) row["SKU"] = variant.sku || "";
      if (options.columns.color) row["Màu"] = variant.color || "";
      if (options.columns.size) row["Size"] = variant.size || "";
      if (options.columns.price) row["Giá bán"] = price;
      if (options.columns.costPrice) row["Giá nhập"] = costPrice;
      if (options.columns.branchStocks) {
        for (const branch of selectedBranches) {
          row[`Tồn ${branch.name}`] = branchStocks[branch.id] || 0;
        }
      }
      if (options.columns.totalStock) row["Tổng tồn"] = totalStock;
      if (options.columns.inventoryValue) row["Giá trị tồn"] = inventoryValue;
      if (options.columns.status) {
        row["Trạng thái sản phẩm"] = product.status || "DRAFT";
        row["Trạng thái SKU"] = (variant as any).status || "ACTIVE";
        row["Cảnh báo"] = isMissingCost
          ? "Thiếu giá nhập"
          : isLowStock
            ? "Tồn thấp"
            : "";
      }
      if (options.columns.description) row["Mô tả"] = product.description || "";

      rows.push(row);

      const key = product.id || product.slug || product.name || "unknown";
      const current = summaryByProduct.get(key) || {
        productName: product.name || "",
        skuRoot: getMainSku(product),
        totalStock: 0,
        inventoryValue: 0,
        variantCount: 0,
        missingCostCount: 0,
      };
      current.totalStock += totalStock;
      current.inventoryValue += inventoryValue;
      current.variantCount += 1;
      current.missingCostCount += isMissingCost ? 1 : 0;
      summaryByProduct.set(key, current);
    }
  }

  rows.sort((a, b) => {
    if (options.sortMode === "stock_desc") {
      return Number(b["Tổng tồn"] || 0) - Number(a["Tổng tồn"] || 0);
    }
    if (options.sortMode === "value_desc") {
      return Number(b["Giá trị tồn"] || 0) - Number(a["Giá trị tồn"] || 0);
    }
    if (options.sortMode === "missing_cost_first") {
      return String(b["Cảnh báo"] || "").localeCompare(
        String(a["Cảnh báo"] || ""),
      );
    }
    return String(a["Tên sản phẩm"] || "").localeCompare(
      String(b["Tên sản phẩm"] || ""),
    );
  });

  const totalStock = rows.reduce(
    (sum, row) => sum + Number(row["Tổng tồn"] || 0),
    0,
  );
  const totalValue = rows.reduce(
    (sum, row) => sum + Number(row["Giá trị tồn"] || 0),
    0,
  );
  const missingCostRows = rows.filter(
    (row) => row["Cảnh báo"] === "Thiếu giá nhập",
  );
  const lowStockRows = rows.filter((row) => row["Cảnh báo"] === "Tồn thấp");

  const summaryRows = [
    { "Chỉ số": "Tổng sản phẩm", "Giá trị": exportProducts.length },
    { "Chỉ số": "Tổng SKU xuất file", "Giá trị": rows.length },
    { "Chỉ số": "Tổng tồn", "Giá trị": totalStock },
    { "Chỉ số": "Tổng giá trị tồn", "Giá trị": totalValue },
    { "Chỉ số": "SKU thiếu giá nhập", "Giá trị": missingCostRows.length },
    { "Chỉ số": "SKU tồn thấp", "Giá trị": lowStockRows.length },
    {
      "Chỉ số": "Chi nhánh xuất",
      "Giá trị": selectedBranches.map((b) => b.name).join(", ") || "Tất cả",
    },
    {
      "Chỉ số": "Thời gian xuất",
      "Giá trị": new Date().toLocaleString("vi-VN"),
    },
  ];

  const productSummaryRows = Array.from(summaryByProduct.values())
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .map((item) => ({
      "Tên sản phẩm": item.productName,
      "SKU chính": item.skuRoot,
      "Số variant": item.variantCount,
      "Tổng tồn": item.totalStock,
      "Giá trị tồn": item.inventoryValue,
      "Variant thiếu giá nhập": item.missingCostCount,
    }));

  const wb = XLSX.utils.book_new();

  if (options.includeSummarySheet) {
    XLSX.utils.book_append_sheet(wb, makeWorksheet(summaryRows), "Tổng quan");
    XLSX.utils.book_append_sheet(
      wb,
      makeWorksheet(productSummaryRows),
      "Theo sản phẩm",
    );
  }

  XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), "Danh sách SKU");

  const missingCostExportRows = missingCostRows.map((row) => ({
    "Tên sản phẩm": row["Tên sản phẩm"],
    SKU: row["SKU"],
    Màu: row["Màu"],
    Size: row["Size"],
    "Giá bán": row["Giá bán"],
    "Giá nhập": row["Giá nhập"],
    "Tổng tồn": row["Tổng tồn"],
    "Giá trị tồn": row["Giá trị tồn"],
  }));
  if (missingCostExportRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      makeWorksheet(missingCostExportRows),
      "Thiếu giá nhập",
    );
  }

  if (options.includeBranchSheets) {
    for (const branch of selectedBranches) {
      const branchRows: Record<string, any>[] = [];
      for (const product of exportProducts) {
        for (const variant of product.variants || []) {
          const qty = getVariantBranchStockValue(variant, branch.id);
          const costPrice = Number((variant as any).costPrice || 0);
          const price = Number(variant.price || 0);

          if (options.onlyInStock && qty <= 0) continue;
          if (options.onlyMissingCost && !(qty > 0 && costPrice <= 0)) continue;
          if (options.onlyLowStock && !(qty > 0 && qty <= 3)) continue;

          branchRows.push({
            "Tên sản phẩm": product.name || "",
            "Mã sản phẩm": product.slug || "",
            SKU: variant.sku || "",
            Màu: variant.color || "",
            Size: variant.size || "",
            "Giá bán": price,
            "Giá nhập": costPrice,
            Tồn: qty,
            "Giá trị tồn": qty * costPrice,
            "Cảnh báo":
              qty > 0 && costPrice <= 0
                ? "Thiếu giá nhập"
                : qty > 0 && qty <= 3
                  ? "Tồn thấp"
                  : "",
          });
        }
      }
      XLSX.utils.book_append_sheet(
        wb,
        makeWorksheet(branchRows),
        safeSheetName(branch.name),
      );
    }
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  XLSX.writeFile(
    wb,
    `products_enterprise_export_${yyyy}${mm}${dd}_${hh}${mi}.xlsx`,
  );

  return rows.length;
}


function matchBranchForExport(branches: BranchItem[], wanted: "CL" | "XD" | "QO" | "TH") {
  const keywordMap: Record<typeof wanted, string[]> = {
    CL: ["cl", "chua lang", "chùa láng"],
    XD: ["xd", "xa dan", "xã đàn", "hoan kiem", "hoàn kiếm"],
    QO: ["qo", "quoc oai", "quốc oai", "kho qo"],
    TH: ["th", "thai ha", "thái hà"],
  };

  const keywords = keywordMap[wanted] || [];

  return branches.find((branch: any) => {
    const text = normalizeHeader(
      [branch?.id, branch?.code, branch?.name, branch?.displayName, branch?.branchName]
        .filter(Boolean)
        .join(" "),
    );

    return keywords.some((keyword) => text.includes(normalizeHeader(keyword)));
  });
}

function getVariantImageUrl(variant: any) {
  return String(variant?.imageUrl || variant?.image || variant?.imageUrlByColor || "").trim();
}

function buildProductImageImportWorkbook(
  exportProducts: ProductItem[],
  _exportBranches: BranchItem[],
) {
  const rows: Record<string, any>[] = [];
  const seen = new Set<string>();

  for (const product of exportProducts) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const colors = uniqueValues(variants.map((variant: any) => variant.color));

    if (!colors.length) {
      const key = `${product.id || product.slug || product.name}:__NO_COLOR__`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({
          "Tên sản phẩm": product.name || "",
          "Màu": "",
          "Ảnh màu": "",
        });
      }
      continue;
    }

    for (const color of colors) {
      const key = `${product.id || product.slug || product.name}:${normalizeHeader(color)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        "Tên sản phẩm": product.name || "",
        "Màu": color,
        "Ảnh màu": "",
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = makeWorksheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Dán link ảnh theo màu");

  const guideRows = [
    { "Hướng dẫn": "File này chỉ dùng để dán ảnh theo màu, không chứa giá bán, giá nhập hay tồn kho." },
    { "Hướng dẫn": "Mỗi dòng là 1 sản phẩm + 1 màu. Một sản phẩm có 4 màu thì file có đúng 4 dòng cho sản phẩm đó." },
    { "Hướng dẫn": "Chỉ dán link Cloudinary vào cột Ảnh màu. Không sửa tên sản phẩm và màu nếu không cần." },
    { "Hướng dẫn": "Khi import, hệ thống tự áp dụng link ảnh đó cho toàn bộ size/SKU của đúng sản phẩm và đúng màu." },
  ];
  XLSX.utils.book_append_sheet(wb, makeWorksheet(guideRows), "Hướng dẫn");

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  XLSX.writeFile(wb, `products_image_by_color_${yyyy}${mm}${dd}_${hh}${mi}.xlsx`);

  return rows.length;
}

export default function ProductsPageClient() {
  useScrollRestore("products-list");

  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get("category") || "ALL";
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [categories, setCategories] = useState<ProductCategoryItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [role, setRole] = useState<AppRole>("retail-staff");
  const [currentUser, setCurrentUser] =
    useState<CurrentUserPermissionProfile | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState(categoryFromUrl);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalProducts, setTotalProducts] = useState(0);
  const [summary, setSummary] = useState<ProductSummary | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"products" | "images">(
    "products",
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] =
    useState<ExportProductScope>("filtered");
  const [exportBranchIds, setExportBranchIds] = useState<string[]>([]);
  const [exportColumns, setExportColumns] =
    useState<ExportColumnState>(defaultExportColumns);
  const [exportOnlyInStock, setExportOnlyInStock] = useState(false);
  const [exportOnlyMissingCost, setExportOnlyMissingCost] = useState(false);
  const [exportOnlyLowStock, setExportOnlyLowStock] = useState(false);
  const [exportIncludeSummarySheet, setExportIncludeSummarySheet] =
    useState(true);
  const [exportIncludeBranchSheets, setExportIncludeBranchSheets] =
    useState(true);
  const [exportSortMode, setExportSortMode] =
    useState<ExportSortMode>("product_asc");
  const [exportingProducts, setExportingProducts] = useState(false);
  const [categoryNormalizerOpen, setCategoryNormalizerOpen] = useState(false);
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false);
  const [displayPreset, setDisplayPreset] =
    useState<ProductDisplayPreset>("default");
  const [draftDisplayPreset, setDraftDisplayPreset] =
    useState<ProductDisplayPreset>("default");
  const [sortKey, setSortKey] = useState<ProductSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [labelPrintOpen, setLabelPrintOpen] = useState(false);
  const [labelPrintProduct, setLabelPrintProduct] =
    useState<ProductItem | null>(null);
  const [labelPrinterName, setLabelPrinterName] = useState("Máy in mặc định");
  const [labelPaperMode, setLabelPaperMode] = useState("50x50_gap04");
  const [labelPrintQtyMap, setLabelPrintQtyMap] = useState<
    Record<string, string>
  >({});
  const [labelSelectedMap, setLabelSelectedMap] = useState<
    Record<string, boolean>
  >({});
  const [labelPriceMode, setLabelPriceMode] = useState<"retail" | "hidden">(
    "retail",
  );

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [exportingImageImportRows, setExportingImageImportRows] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressLabel, setImportProgressLabel] = useState("");
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_DISPLAY_OPTIONS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        preset?: ProductDisplayPreset;
        sortKey?: ProductSortKey;
        sortDirection?: SortDirection;
      };

      if (parsed.preset) {
        setDisplayPreset(parsed.preset);
        setDraftDisplayPreset(parsed.preset);
      }
      if (parsed.sortKey) setSortKey(parsed.sortKey);
      if (parsed.sortDirection) setSortDirection(parsed.sortDirection);
    } catch {
      // ignore saved display option errors
    }
  }, []);

  const saveDisplayOptions = () => {
    const next = {
      preset: draftDisplayPreset,
      sortKey,
      sortDirection,
    };

    try {
      localStorage.setItem(
        PRODUCT_DISPLAY_OPTIONS_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // ignore localStorage error
    }

    setActionMessage("Đã lưu tuỳ chọn hiển thị sản phẩm.");
    setDisplayOptionsOpen(false);
  };

  const resetDisplayOptions = () => {
    setDraftDisplayPreset("default");
    applyDisplayPreset("default");

    try {
      localStorage.removeItem(PRODUCT_DISPLAY_OPTIONS_STORAGE_KEY);
    } catch {
      // ignore localStorage error
    }

    setActionMessage("Đã đưa tuỳ chọn hiển thị về mặc định.");
  };

  const [name, setName] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [category, setCategory] = useState("T-Shirt");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("The 1970");
  const [weight, setWeight] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [defaultCostPrice, setDefaultCostPrice] = useState("");
  const [colors, setColors] = useState("Black, White");
  const [sizes, setSizes] = useState("S, M, L, XL");
  const [branchStocks, setBranchStocks] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");

  const [editName, setEditName] = useState("");
  const [editSkuCode, setEditSkuCode] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editBrand, setEditBrand] = useState("The 1970");
  const [editWeight, setEditWeight] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDefaultPrice, setEditDefaultPrice] = useState("");
  const [editDefaultCostPrice, setEditDefaultCostPrice] = useState("");
  const [editColors, setEditColors] = useState("");
  const [editSizes, setEditSizes] = useState("");
  const [editBranchStocks, setEditBranchStocks] = useState<
    Record<string, string>
  >({});
  const [applyPriceToAllVariants, setApplyPriceToAllVariants] = useState(true);

  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickCategoryDescription, setQuickCategoryDescription] = useState("");

  const [variantColor, setVariantColor] = useState("");
  const [variantSize, setVariantSize] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantCostPrice, setVariantCostPrice] = useState("");
  const [variantBranchStocks, setVariantBranchStocks] = useState<
    Record<string, string>
  >({});

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importFileNames, setImportFileNames] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  useEffect(() => {
    const storedUser =
      getCurrentUserFromStorage() as CurrentUserPermissionProfile | null;
    setCurrentUser(storedUser);
    setRole(getPrimaryAppRole(storedUser));
    setCurrentBranchId(storedUser?.branchId || null);
  }, []);

  useEffect(() => {
    const nextCategory = searchParams.get("category") || "ALL";
    setGroupFilter(nextCategory);
    setPage(1);
  }, [searchParams]);

  const isOwner = isOwnerOrAdminUser(currentUser);
  const isStaffView = !isOwner;
  const canViewInventory = hasProductInventoryPermission(
    currentUser,
    role,
    "inventory.view",
  );

  const visibleBranches = useMemo(() => {
    // Đã có quyền xem tồn kho thì được thấy số tồn của tất cả chi nhánh để tư vấn/chốt đơn.
    // Giá vốn/giá trị tồn vẫn khóa riêng bằng inventory.value.view.
    if (isOwner || canViewInventory) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, canViewInventory, currentBranchId]);

  const syncedCategoryItems = useMemo(() => {
    const activeCategories = sortCategoriesForDisplay(categories);

    if (activeCategories.length) return activeCategories;

    return categoryOptions.map((name) => ({
      id: name,
      name,
      code: toCode(name),
      slug: slugify(name),
      description: "",
      isActive: true,
    })) as ProductCategoryItem[];
  }, [categories, categoryOptions]);

  const productGroups = useMemo(() => {
    const names = uniqueValues(syncedCategoryItems.map((item) => item.name));
    return names.length ? names : fallbackProductGroups;
  }, [syncedCategoryItems]);

  const normalizeCategoryNameForImport = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const normalizedRaw = normalizeHeader(raw);
    const found = syncedCategoryItems.find(
      (item) =>
        normalizeHeader(item.name) === normalizedRaw ||
        normalizeHeader(item.slug) === normalizedRaw ||
        normalizeHeader(item.code) === normalizedRaw,
    );

    if (found?.name) return found.name;

    return raw
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((word, index) => {
        const lower = word.toLocaleLowerCase("vi-VN");
        if (index > 0 && ["và", "hoặc", "của", "cho"].includes(lower))
          return lower;
        return lower.charAt(0).toLocaleUpperCase("vi-VN") + lower.slice(1);
      })
      .join(" ");
  };

  // UI permission lock theo authz.ts.
  // - products.view: được vào xem catalog.
  // - products.edit: được sửa thông tin sản phẩm.
  // - products.price.edit: được sửa giá bán.
  // - products.excel.export/import: được xuất/nhập Excel.
  // Không hardcode role tại đây để tránh lệch với file authz.
  const canViewProduct = hasProductInventoryPermission(
    currentUser,
    role,
    "products.view",
  );
  const canCreateProduct = hasProductInventoryPermission(
    currentUser,
    role,
    "products.create",
  );
  const canEditProduct = hasProductInventoryPermission(
    currentUser,
    role,
    "products.edit",
  );
  const canEditProductPrice = hasProductInventoryPermission(
    currentUser,
    role,
    "products.price.edit",
  );
  const canViewCost = hasProductInventoryPermission(
    currentUser,
    role,
    "products.cost.view",
  );
  const canEditProductCost = hasProductInventoryPermission(
    currentUser,
    role,
    "products.cost.edit",
  );
  const canCreateProductVariant = hasProductInventoryPermission(
    currentUser,
    role,
    "products.variant.create",
  );
  const canUploadProductImage = hasProductInventoryPermission(
    currentUser,
    role,
    "products.image.upload",
  );
  const canManageInventory = hasProductInventoryPermission(
    currentUser,
    role,
    "inventory.manage",
  );
  const canToggleProductStatus = hasProductInventoryPermission(
    currentUser,
    role,
    "products.status.edit",
  );
  const canDeleteProduct = hasProductInventoryPermission(
    currentUser,
    role,
    "products.delete",
  );
  const canManageProductMasterData =
    hasProductInventoryPermission(
      currentUser,
      role,
      "products.master_data.manage",
    ) || hasProductInventoryPermission(currentUser, role, "system.manage");
  const canImportProducts = hasProductInventoryPermission(
    currentUser,
    role,
    "products.excel.import",
  );
  const canExportProducts = hasProductInventoryPermission(
    currentUser,
    role,
    "products.excel.export",
  );
  const canViewInventoryValue = hasProductInventoryPermission(
    currentUser,
    role,
    "inventory.value.view",
  );
  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const data = await getBranches();
      setBranches(data);

      setBranchStocks((prev) =>
        Object.keys(prev).length ? prev : createEmptyBranchStocks(data),
      );
      setVariantBranchStocks((prev) =>
        Object.keys(prev).length ? prev : createEmptyBranchStocks(data),
      );
      setEditBranchStocks((prev) =>
        Object.keys(prev).length ? prev : createEmptyBranchStocks(data),
      );
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadProductCategoryOptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/products/category-options`);
      if (!res.ok)
        throw new Error("Không tải được danh mục sản phẩm từ sản phẩm.");
      const data = await res.json();
      setCategoryOptions(Array.isArray(data) ? data : []);
    } catch {
      setCategoryOptions([]);
    }
  };
  const loadProductSummary = async () => {
    try {
      const params = new URLSearchParams();

      if (query.trim()) params.set("q", query.trim());
      if (groupFilter !== "ALL") params.set("category", groupFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (!isOwner && !canViewInventory && currentBranchId)
        params.set("branchId", currentBranchId);

      const res = await fetch(
        `${API_BASE}/products/summary?${params.toString()}`,
      );

      if (!res.ok) throw new Error("Không tải được tổng quan sản phẩm.");

      const data = await res.json();
      setSummary(data);
    } catch {
      setSummary(null);
    }
  };
  const loadProducts = async (nextPage = page, nextLimit = limit) => {
    try {
      setLoading(true);
      setError(null);

      const result = await (getProducts as any)({
        page: nextPage,
        limit: nextLimit,
        q: query.trim(),
        category: groupFilter,
        status: statusFilter,
        branchId:
          !isOwner && !canViewInventory && currentBranchId
            ? currentBranchId
            : undefined,
      });

      const nextProducts = Array.isArray(result) ? result : result?.data || [];
      setProducts(Array.isArray(nextProducts) ? nextProducts : []);
      setTotalProducts(
        Number(
          Array.isArray(result)
            ? result.length
            : (result?.total ?? nextProducts.length ?? 0),
        ),
      );
      setPage(
        Number(Array.isArray(result) ? nextPage : result?.page || nextPage),
      );
      setLimit(
        Number(Array.isArray(result) ? nextLimit : result?.limit || nextLimit),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
    void loadCategories();
    void loadProductCategoryOptions();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts(page, limit);
      void loadProductSummary();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [page, limit, query, groupFilter, statusFilter, currentBranchId, isOwner]);

  useEffect(() => {
    if (!createOpen) return;

    const first = syncedCategoryItems[0];
    if (!first) return;

    if (!categoryId) {
      setCategoryId(first.id);
      setCategory(first.name);
    }
  }, [createOpen, syncedCategoryItems, categoryId]);

  const getProductTotalStockForSort = (product: ProductItem) => {
    return (product.variants || []).reduce((sum, variant) => {
      const branchStocks = variant.branchStocks || {};
      if (isOwner || canViewInventory) {
        return (
          sum +
          Object.values(branchStocks).reduce(
            (branchSum, qty) => branchSum + Number(qty || 0),
            0,
          )
        );
      }

      return sum + Number(branchStocks[currentBranchId || ""] || 0);
    }, 0);
  };

  const getProductBranchStockForSort = (product: ProductItem) => {
    return visibleBranches.reduce((sum, branch) => {
      return (
        sum +
        (product.variants || []).reduce(
          (branchSum, variant) =>
            branchSum + Number(variant.branchStocks?.[branch.id] || 0),
          0,
        )
      );
    }, 0);
  };

  const getProductSortValue = (product: ProductItem, key: ProductSortKey) => {
    const variants = product.variants || [];
    const colors = uniqueValues(variants.map((variant) => variant.color)).join(
      ", ",
    );
    const sizes = uniqueValues(variants.map((variant) => variant.size)).join(
      ", ",
    );
    const firstSku = getMainSku(product);

    const minPrice =
      variants.length > 0
        ? Math.min(...variants.map((variant) => Number(variant.price || 0)))
        : 0;

    const minCostPrice =
      variants.length > 0
        ? Math.min(
            ...variants.map((variant) =>
              Number((variant as any).costPrice || 0),
            ),
          )
        : 0;

    switch (key) {
      case "name":
        return product.name || "";
      case "category":
        return product.category || "";
      case "color":
        return colors;
      case "size":
        return sizes;
      case "sku":
        return firstSku;
      case "price":
        return minPrice;
      case "costPrice":
        return minCostPrice;
      case "branchStock":
        return getProductBranchStockForSort(product);
      case "stock":
        return getProductTotalStockForSort(product);
      case "status":
        return product.status || "";
      case "description":
        return product.description || "";
      case "createdAt":
        return (
          new Date(
            (product as any).createdAt || (product as any).updatedAt || 0,
          ).getTime() || 0
        );
      case "sales":
        return Number(
          (product as any).soldQty ??
            (product as any).soldCount ??
            (product as any).totalSold ??
            (product as any).orderItemsCount ??
            (product as any).salesCount ??
            0,
        );
      default:
        return product.name || "";
    }
  };

  const handleSort = (key: ProductSortKey) => {
    setDisplayPreset("default");

    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "stock" || key === "branchStock" ? "desc" : "asc");
  };

  const applyDisplayPreset = (preset: ProductDisplayPreset) => {
    setDisplayPreset(preset);

    if (preset === "newest") {
      setSortKey("createdAt");
      setSortDirection("desc");
      return;
    }

    if (preset === "bestSelling") {
      setSortKey("sales");
      setSortDirection("desc");
      return;
    }

    if (preset === "priceHigh") {
      setSortKey("price");
      setSortDirection("desc");
      return;
    }

    setSortKey("name");
    setSortDirection("asc");
  };

  const filteredProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const av = getProductSortValue(a, sortKey);
      const bv = getProductSortValue(b, sortKey);

      let result = 0;

      if (typeof av === "number" || typeof bv === "number") {
        result = Number(av || 0) - Number(bv || 0);
      } else {
        result = String(av || "").localeCompare(String(bv || ""), "vi", {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [
    products,
    sortKey,
    sortDirection,
    visibleBranches,
    currentBranchId,
    isOwner,
    canViewInventory,
  ]);

  const totalProductPages = Math.max(1, Math.ceil(totalProducts / limit));
  const currentPageStart = totalProducts === 0 ? 0 : (page - 1) * limit + 1;
  const currentPageEnd = Math.min(
    page * limit,
    totalProducts || filteredProducts.length,
  );

  const selectedProducts = useMemo(() => {
    const selected = new Set(selectedProductIds);
    return filteredProducts.filter((product) => selected.has(product.id));
  }, [filteredProducts, selectedProductIds]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) =>
      selectedProductIds.includes(product.id),
    );

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const toggleSelectAllVisibleProducts = () => {
    setSelectedProductIds((prev) => {
      const visibleIds = filteredProducts.map((product) => product.id);
      const hasAllVisible =
        visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));

      if (hasAllVisible) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const clearSelectedProducts = () => {
    setSelectedProductIds([]);
  };

  const handleBulkPrintLabels = () => {
    if (!selectedProducts.length) {
      setActionMessage("Chưa chọn sản phẩm để in tem.");
      return;
    }

    openProductsInPrintCenter(selectedProducts);
  };

  const handleBulkExportSelected = () => {
    if (!canExportProducts) {
      setActionMessage("Role hiện tại không có quyền xuất Excel sản phẩm.");
      return;
    }

    if (!selectedProducts.length) {
      setActionMessage("Chưa chọn sản phẩm để xuất Excel.");
      return;
    }

    buildEnterpriseProductExport(selectedProducts, visibleBranches, {
      scope: "filtered",
      branchIds: visibleBranches.map((branch) => branch.id),
      columns: exportColumns,
      onlyInStock: false,
      onlyMissingCost: false,
      onlyLowStock: false,
      includeSummarySheet: true,
      includeBranchSheets: true,
      sortMode: "product_asc",
    });

    setActionMessage(`Đã xuất ${selectedProducts.length} sản phẩm đã chọn.`);
  };

  const handleBulkToggleInactive = async () => {
    if (!selectedProducts.length) {
      setActionMessage("Chưa chọn sản phẩm.");
      return;
    }

    if (!canToggleProductStatus) {
      setActionMessage("Role hiện tại không có quyền đổi trạng thái sản phẩm.");
      return;
    }

    const ok = window.confirm(
      `Ngừng bán ${selectedProducts.length} sản phẩm đã chọn?`,
    );
    if (!ok) return;

    try {
      setActionMessage("");
      for (const product of selectedProducts) {
        if (String(product.status || "").toUpperCase() === "ACTIVE") {
          await toggleProductStatus(product.id);
        }
      }
      clearSelectedProducts();
      await loadProducts(page, limit);
      setActionMessage("Đã cập nhật trạng thái các sản phẩm đã chọn.");
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? err.message
          : "Không cập nhật được sản phẩm đã chọn.",
      );
    }
  };

  const getVariantScopedStock = (variant: ProductItem["variants"][number]) => {
    if (isOwner) {
      return Object.values(variant.branchStocks || {}).reduce(
        (sum, v) => sum + Number(v || 0),
        0,
      );
    }
    return Number(variant.branchStocks?.[currentBranchId || ""] || 0);
  };

  const totalVariants = summary?.totalVariants ?? 0;
  const lowStockCount = summary?.lowStockSkus ?? 0;
  const catalogValue = summary?.totalInventoryValue ?? 0;

  const resetCreateForm = () => {
    const first = syncedCategoryItems[0];
    setName("");
    setSkuCode("");
    setCategory(first?.name || productGroups[0] || "T-Shirt");
    setCategoryId(first?.id || "");
    setBrand("The 1970");
    setWeight("");
    setImageUrl("");
    setDefaultPrice("");
    setDefaultCostPrice("");
    setColors("Black, White");
    setSizes("S, M, L, XL");
    setBranchStocks(createEmptyBranchStocks(branches));
    setDescription("");
  };

  const resetVariantForm = () => {
    setVariantColor("");
    setVariantSize("");
    setVariantPrice("");
    setVariantCostPrice("");
    setVariantBranchStocks(createEmptyBranchStocks(branches));
  };

  const resetQuickCategoryForm = () => {
    setQuickCategoryName("");
    setQuickCategoryDescription("");
  };

  const resetImportForm = () => {
    setSelectedFiles([]);
    setImportFileNames([]);
    setImportRows([]);
    setImportErrors([]);
    setImportProgress(0);
    setImportProgressLabel("");
  };

  const openImportModal = (mode: "products" | "images") => {
    setImportMode(mode);
    resetImportForm();
    setImportOpen(true);
  };

  const validateCreateForm = () => {
    if (!hasCommaFormat(colors)) {
      setActionMessage(
        "Màu sắc sai định dạng. Hãy nhập theo kiểu: ĐEN, TRẮNG, NÂU",
      );
      return false;
    }

    if (!hasCommaFormat(sizes)) {
      setActionMessage(
        "Kích thước sai định dạng. Hãy nhập theo kiểu: S, M, L, XL",
      );
      return false;
    }

    return true;
  };

  const validateEditForm = () => {
    if (!hasCommaFormat(editColors)) {
      setActionMessage(
        "Màu sắc sai định dạng. Hãy nhập theo kiểu: ĐEN, TRẮNG, NÂU",
      );
      return false;
    }

    if (!hasCommaFormat(editSizes)) {
      setActionMessage(
        "Kích thước sai định dạng. Hãy nhập theo kiểu: S, M, L, XL",
      );
      return false;
    }

    return true;
  };

  const handleCreateProduct = async () => {
    if (!canCreateProduct) {
      setActionMessage("Role hiện tại không có quyền tạo sản phẩm.");
      return;
    }

    if (!name.trim()) {
      setActionMessage("Chưa nhập tên sản phẩm.");
      return;
    }

    if (!skuCode.trim()) {
      setActionMessage("Chưa nhập mã sản phẩm.");
      return;
    }

    if (!category.trim()) {
      setActionMessage("Chưa chọn danh mục.");
      return;
    }

    if (!validateCreateForm()) return;

    try {
      setSavingProduct(true);
      setActionMessage("");

      const payload: CreateProductPayload = {
        name: name.trim(),
        slug: skuCode.trim(),
        category,
        categoryId: categoryId || undefined,
        brand,
        weight: Number(weight || 0),
        imageUrl: imageUrl.trim(),
        description: description.trim(),
        defaultPrice: canEditProductPrice ? Number(defaultPrice || 0) : 0,
        defaultCostPrice: canEditProductCost
          ? Number(defaultCostPrice || 0)
          : 0,
        colorOptions: parseCommaTokens(colors),
        sizeOptions: parseCommaTokens(sizes),
        defaultBranchStocks: canManageInventory
          ? Object.fromEntries(
              branches.map((branch) => [
                branch.id,
                Number(branchStocks[branch.id] || 0),
              ]),
            )
          : {},
      };

      await createProduct(payload);
      setCreateOpen(false);
      resetCreateForm();
      setImportProgressLabel("Import xong, đang tải lại danh sách sản phẩm...");
      await loadCategories();
      await loadProductCategoryOptions();
      await loadProducts(1, limit);
      setPage(1);
      setActionMessage("Đã tạo sản phẩm mới.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không tạo được sản phẩm.",
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const openProductDetail = (product: ProductItem) => {
    const href = `/products/${encodeURIComponent(product.id)}`;

    addWorkspaceTab({
      id: product.id,
      title: product.name || product.slug || "Sản phẩm",
      href,
      type: "product",
    });

    window.open(href, "_blank", "noopener,noreferrer");
  };

  const getLabelPrintRows = (
    product: ProductItem | null,
  ): LabelPrintVariantRow[] => {
    if (!product) return [];

    const variants = Array.isArray(product.variants) ? product.variants : [];

    if (!variants.length) {
      return [
        {
          key: product.id,
          productName: product.name || "Sản phẩm",
          sku: product.slug || product.id,
          size: "",
          color: "",
          price: Number((product as any)?.price || 0),
          stock: 0,
        },
      ];
    }

    return variants.map((variant: any, index) => {
      const sku = variant?.sku || `${product.slug || product.id}-${index + 1}`;
      const stock = visibleBranches.reduce(
        (sum, branch) => sum + Number(variant?.branchStocks?.[branch.id] || 0),
        0,
      );

      return {
        key: sku,
        productName: product.name || "Sản phẩm",
        sku,
        size: variant?.size || "",
        color: variant?.color || "",
        price: Number(variant?.price || (product as any)?.price || 0),
        stock,
      };
    });
  };

  const openProductsInPrintCenter = (targetProducts: ProductItem[]) => {
    const safeProducts = Array.isArray(targetProducts)
      ? targetProducts.filter(Boolean)
      : [];

    if (!safeProducts.length) {
      setActionMessage("Chưa chọn sản phẩm để in tem.");
      return;
    }

    const rows = safeProducts.flatMap((product) =>
      getLabelPrintRows(product).map((row) => ({
        key: `${product.id || product.slug || row.productName}:${row.key}`,
        productName: row.productName,
        sku: row.sku,
        size: row.size,
        color: row.color,
        price: row.price,
        stock: row.stock,
      })),
    );

    if (!rows.length) {
      setActionMessage("Sản phẩm chưa có SKU để in tem.");
      return;
    }

    const draft = {
      productId: safeProducts.length === 1 ? safeProducts[0]?.id : undefined,
      productName:
        safeProducts.length === 1
          ? safeProducts[0]?.name || safeProducts[0]?.slug || "Sản phẩm"
          : `${safeProducts.length} sản phẩm đã chọn`,
      branchId: currentBranchId || "__default__",
      rows,
    };

    try {
      sessionStorage.setItem(
        PRINT_CENTER_PRODUCT_LABEL_DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch {
      setActionMessage("Không lưu được dữ liệu in tem trên trình duyệt.");
      return;
    }

    window.open(
      "/print-center/product-labels",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const openLabelPrintModal = (product: ProductItem) => {
    const rows = getLabelPrintRows(product);

    setLabelPrintProduct(product);
    setLabelSelectedMap(Object.fromEntries(rows.map((row) => [row.key, true])));
    setLabelPrintQtyMap(Object.fromEntries(rows.map((row) => [row.key, "1"])));
    setLabelPrinterName((prev) => prev || "Máy in mặc định");
    setLabelPaperMode("50x50_gap04");
    setLabelPriceMode("retail");
    setLabelPrintOpen(true);
  };

  const buildLabelPrintItems = () => {
    const rows = getLabelPrintRows(labelPrintProduct);

    return rows
      .filter((row) => labelSelectedMap[row.key])
      .map<ProductLabelPrintItem>((row) => ({
        productName: row.productName,
        sku: row.sku,
        barcode: row.sku,
        qrValue: row.sku,
        size: row.size,
        color: row.color,
        price: labelPriceMode === "hidden" ? 0 : row.price,
        quantity: Math.max(
          1,
          Math.floor(
            Number(
              String(labelPrintQtyMap[row.key] || "1").replace(/[^\d]/g, ""),
            ) || 1,
          ),
        ),
      }));
  };

  const getLabelPrintTemplate = () => {
    const templates = loadPrintTemplates();
    return findPrintTemplate({
      templates,
      branchId: currentBranchId || "__default__",
      templateType: "product_label",
      paperSize: "50mm",
    });
  };

  const labelPrintRows = getLabelPrintRows(labelPrintProduct);
  const labelPreviewItems = buildLabelPrintItems();
  const labelPreviewHtml = labelPreviewItems.length
    ? renderProductLabelsHtml({
        items: labelPreviewItems,
        template: getLabelPrintTemplate(),
      })
    : `<div style="font-family:Arial,sans-serif;padding:16px;color:#666;">Chưa chọn SKU để in tem.</div>`;

  const handlePrintProductLabels = (product: ProductItem) => {
    openProductsInPrintCenter([product]);
  };

  const handleConfirmPrintProductLabels = () => {
    const items = buildLabelPrintItems();

    if (!items.length) {
      setActionMessage("Chưa chọn SKU để in tem.");
      return;
    }

    openProductLabelPrintDocument({
      title: `In tem ${labelPrintProduct?.name || labelPrintProduct?.slug || "sản phẩm"}`,
      items,
      template: getLabelPrintTemplate(),
    });
  };

  const handleOpenEdit = (product: ProductItem) => {
    if (!canEditProduct) {
      setActionMessage(
        "Role hiện tại chỉ có quyền xem sản phẩm, không được sửa.",
      );
      return;
    }

    const uniqueColors = uniqueValues(
      product.variants.map((variant) => variant.color),
    );
    const uniqueSizes = uniqueValues(
      product.variants.map((variant) => variant.size),
    );

    const minPrice =
      product.variants.length > 0
        ? Math.min(...product.variants.map((v) => Number(v.price || 0)))
        : 0;

    const minCostPrice =
      product.variants.length > 0
        ? Math.min(...product.variants.map((v) => Number(v.costPrice || 0)))
        : 0;

    const aggregatedBranchStocks = Object.fromEntries(
      branches.map((branch) => [
        branch.id,
        String(
          product.variants.reduce(
            (sum, variant) =>
              sum + Number(variant.branchStocks?.[branch.id] || 0),
            0,
          ),
        ),
      ]),
    );

    const foundCategory = categories.find(
      (item) => item.name === (product.category || ""),
    );

    setEditingProductId(product.id);
    setEditName(product.name || "");
    setEditSkuCode(product.slug || "");
    setEditCategory(product.category || "");
    setEditCategoryId(foundCategory?.id || "");
    setEditBrand(product.brand || "The 1970");
    setEditWeight(String(product.weight || 0));
    setEditImageUrl(product.imageUrl || "");
    setEditDescription(product.description || "");
    setEditDefaultPrice(String(minPrice || 0));
    setEditDefaultCostPrice(String(minCostPrice || 0));
    setEditColors(uniqueColors.join(", "));
    setEditSizes(uniqueSizes.join(", "));
    setEditBranchStocks(aggregatedBranchStocks);
    setApplyPriceToAllVariants(true);
    setEditOpen(true);
  };

  const handleSaveEditProduct = async () => {
    if (!canEditProduct) {
      setActionMessage(
        "Role hiện tại chỉ có quyền xem sản phẩm, không được sửa.",
      );
      return;
    }
    if (!editingProductId) return;
    if (!validateEditForm()) return;

    try {
      setSavingProduct(true);
      setActionMessage("");

      await updateProduct(editingProductId, {
        name: editName.trim(),
        slug: editSkuCode.trim(),
        category: editCategory.trim(),
        categoryId: editCategoryId || undefined,
        brand: editBrand,
        weight: Number(editWeight || 0),
        imageUrl: editImageUrl.trim(),
        description: editDescription.trim(),
        ...(canEditProductPrice
          ? { defaultPrice: Number(editDefaultPrice || 0) }
          : {}),
        ...(canEditProductCost
          ? { defaultCostPrice: Number(editDefaultCostPrice || 0) }
          : {}),
        colors: parseCommaTokens(editColors),
        sizes: parseCommaTokens(editSizes),
        ...(canManageInventory
          ? {
              branchStocks: Object.fromEntries(
                branches.map((branch) => [
                  branch.id,
                  Number(editBranchStocks[branch.id] || 0),
                ]),
              ),
            }
          : {}),
        applyPriceToAllVariants,
      });

      const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;

      setEditOpen(false);
      setEditingProductId(null);
      await loadCategories();
      await loadProducts(page, limit);

      if (typeof window !== "undefined") {
        requestAnimationFrame(() => window.scrollTo(0, currentScrollY));
      }

      setActionMessage("Đã cập nhật sản phẩm.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không cập nhật được sản phẩm.",
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    if (!canDeleteProduct) {
      setActionMessage("Role hiện tại không có quyền xóa sản phẩm.");
      return;
    }

    const ok = window.confirm(
      `Xóa sản phẩm "${product.name}"? Thao tác này sẽ xóa cả variant và tồn kho liên quan.`,
    );

    if (!ok) return;

    try {
      setDeletingProductId(product.id);
      setActionMessage("");
      await deleteProduct(product.id);
      await loadProducts(page, limit);
      setActionMessage("Đã xóa sản phẩm.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không xóa được sản phẩm.",
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleQuickCreateCategory = async () => {
    if (!canManageProductMasterData) {
      setActionMessage(
        "Role hiện tại không có quyền quản trị danh mục sản phẩm.",
      );
      return;
    }

    if (!quickCategoryName.trim()) {
      setActionMessage("Chưa nhập tên danh mục mới.");
      return;
    }

    try {
      setSavingCategory(true);
      setActionMessage("");

      const created = await createCategory({
        name: quickCategoryName.trim(),
        code: toCode(quickCategoryName),
        slug: slugify(quickCategoryName),
        description: quickCategoryDescription.trim() || undefined,
      });

      await loadCategories();
      await loadProductCategoryOptions();

      if (createOpen) {
        setCategory(created.name);
        setCategoryId(created.id);
      }

      if (editOpen) {
        setEditCategory(created.name);
        setEditCategoryId(created.id);
      }

      setQuickCategoryOpen(false);
      resetQuickCategoryForm();
      setActionMessage("Đã tạo danh mục mới.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không tạo được danh mục.",
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleAddVariant = async () => {
    if (!canCreateProductVariant) {
      setActionMessage("Role hiện tại không có quyền thêm variant.");
      return;
    }

    if (!activeProductId) return;

    if (!variantColor.trim() || !variantSize.trim()) {
      setActionMessage("Thiếu màu hoặc size cho variant.");
      return;
    }

    try {
      setSavingVariant(true);
      setActionMessage("");

      const payload: AddVariantPayload = {
        color: variantColor.trim(),
        size: variantSize.trim(),
        price: canEditProductPrice ? Number(variantPrice || 0) : 0,
        costPrice: canEditProductCost ? Number(variantCostPrice || 0) : 0,
        branchStocks: canManageInventory
          ? Object.fromEntries(
              Object.entries(variantBranchStocks).map(([key, value]) => [
                key,
                Number(value || 0),
              ]),
            )
          : {},
      };

      await addVariant(activeProductId, payload);
      setVariantOpen(false);
      resetVariantForm();
      await loadProducts(page, limit);
      setActionMessage("Đã thêm variant mới.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không thêm được variant.",
      );
    } finally {
      setSavingVariant(false);
    }
  };

  const handleToggleStatus = async (productId: string) => {
    if (!canToggleProductStatus) {
      setActionMessage("Role hiện tại không có quyền đổi trạng thái sản phẩm.");
      return;
    }

    try {
      setTogglingStatusId(productId);
      setActionMessage("");
      await toggleProductStatus(productId);
      await loadProducts(page, limit);
      setActionMessage("Đã cập nhật trạng thái sản phẩm.");
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? err.message
          : "Không đổi được trạng thái sản phẩm.",
      );
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleCreateImageUpload = async (file: File | null) => {
    if (!canUploadProductImage) {
      setActionMessage("Role hiện tại không có quyền upload ảnh sản phẩm.");
      return;
    }

    if (!file) return;

    try {
      setUploadingCreateImage(true);
      setActionMessage("");

      const result = await uploadProductImage(file);
      setImageUrl(result.url);
      setActionMessage("Đã upload ảnh sản phẩm.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Upload ảnh thất bại.",
      );
    } finally {
      setUploadingCreateImage(false);
    }
  };

  const handleEditImageUpload = async (file: File | null) => {
    if (!canUploadProductImage) {
      setActionMessage("Role hiện tại không có quyền upload ảnh sản phẩm.");
      return;
    }

    console.log("handleEditImageUpload file:", file);

    if (!file) {
      setActionMessage("Chưa chọn file ảnh.");
      return;
    }

    try {
      setUploadingEditImage(true);
      setActionMessage("Đang upload ảnh...");

      const result = await uploadProductImage(file);
      console.log("uploadProductImage result:", result);

      setEditImageUrl(result.url);
      setActionMessage("Đã upload ảnh sản phẩm.");
    } catch (err) {
      console.error("upload edit image error:", err);
      setActionMessage(
        err instanceof Error ? err.message : "Upload ảnh thất bại.",
      );
    } finally {
      setUploadingEditImage(false);
    }
  };

  const findProductForImageImport = (productName: string) => {
    const wanted = normalizeHeader(productName);
    if (!wanted) return null;

    return (
      products.find((product) => {
        return [product.name, product.slug, product.id]
          .map((value) => normalizeHeader(value))
          .filter(Boolean)
          .some((value) => value === wanted);
      }) || null
    );
  };

  const buildPreviewRowFromExistingVariant = (params: {
    product: ProductItem;
    variant: ProductItem["variants"][number];
    colorImageUrl: string;
    imageSource?: string;
  }): ImportPreviewRow => {
    const { product, variant, colorImageUrl, imageSource = "Ảnh màu" } = params;
    const branchCL = matchBranchForExport(branches, "CL");
    const branchXD = matchBranchForExport(branches, "XD");
    const branchQO = matchBranchForExport(branches, "QO");
    const branchTH = matchBranchForExport(branches, "TH");
    const productImageUrl = String(product.imageUrl || "").trim();
    const imageUrl = colorImageUrl || getVariantImageUrl(variant) || productImageUrl;
    const costPrice = Number((variant as any).costPrice || 0);

    return {
      productName: product.name || "",
      category: product.category || "",
      brand: product.brand || "The 1970",
      color: String(variant.color || ""),
      size: String(variant.size || ""),
      sku: String(variant.sku || ""),
      weight: Number(product.weight || 0),
      imageUrl,
      productImageUrl,
      colorImageUrl: colorImageUrl || getVariantImageUrl(variant),
      imageSource: colorImageUrl ? imageSource : getVariantImageUrl(variant) ? "Ảnh màu đang có" : productImageUrl ? "Ảnh chính / Ảnh đại diện" : "",
      imageWarning: colorImageUrl
        ? "Sẽ áp dụng ảnh này cho toàn bộ SKU cùng màu."
        : imageUrl
          ? "Chưa dán ảnh mới; sẽ giữ ảnh đang có / ảnh chính."
          : "Chưa có link ảnh.",
      retailPrice: Number(variant.price || 0),
      importPrice: costPrice,
      stockCL: branchCL ? getVariantBranchStockValue(variant, branchCL.id) : 0,
      stockXD: branchXD ? getVariantBranchStockValue(variant, branchXD.id) : 0,
      stockQO: branchQO ? getVariantBranchStockValue(variant, branchQO.id) : 0,
      stockTH: branchTH ? getVariantBranchStockValue(variant, branchTH.id) : 0,
    };
  };

  const buildImageImportUploadFiles = async (files: File[]) => {
    const allRows: ImportPreviewRow[] = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: "",
      });
      const headerRowIndex = detectHeaderRowIndex(sheetData);
      if (headerRowIndex === -1) continue;

      const rawRows = buildRowsFromSheetData(sheetData, headerRowIndex).filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== ""),
      );
      const { normalized } = parseProductRows(rawRows);
      allRows.push(...normalized);
    }

    if (!allRows.length) return files;

    const rowsForUpload = allRows.map((row) => ({
      "Tên sản phẩm*": row.productName,
      "Danh mục sản phẩm": row.category,
      "Mô tả sản phẩm": "",
      "Nhãn hiệu": row.brand || "The 1970",
      "Giá trị thuộc tính 1": row.color,
      "Giá trị thuộc tính 2": row.size,
      "Mã SKU*": row.sku,
      "Khối lượng": row.weight,
      "Ảnh đại diện": row.productImageUrl,
      "Ảnh chính": row.productImageUrl,
      "Ảnh màu": row.colorImageUrl,
      "PL_Giá bán lẻ": row.retailPrice,
      "PL_Giá nhập": row.importPrice,
      "LC_CN1_Tồn kho ban đầu*": row.stockCL,
      "LC_CN1_Giá vốn khởi tạo*": row.importPrice,
      "LC_CN2_Tồn kho ban đầu*": row.stockXD,
      "LC_CN2_Giá vốn khởi tạo*": row.importPrice,
      "LC_CN3_Tồn kho ban đầu*": row.stockQO,
      "LC_CN3_Giá vốn khởi tạo*": row.importPrice,
      "LC_CN4_Tồn kho ban đầu*": row.stockTH,
      "LC_CN4_Giá vốn khởi tạo*": row.importPrice,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeWorksheet(rowsForUpload), "products_image_upload");
    const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return [
      new File([blob], `products_image_import_expanded_${Date.now()}.xlsx`, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ];
  };

  const parseProductRows = (rows: ParsedRow[]) => {
    const errors: string[] = [];
    const previewRows: ImportPreviewRow[] = [];

    let currentProductName = "";
    let currentCategory = "";
    let currentBrand = "";

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const productName = findValue(row, [
        "Tên sản phẩm*",
        "Tên sản phẩm",
        "ten san pham",
        "product name",
      ]);

      const category = findValue(row, [
        "Danh mục sản phẩm",
        "danh muc san pham",
        "Loại sản phẩm",
        "loai san pham",
        "category",
      ]);

      const brand = findValue(row, ["Nhãn hiệu", "nhan hieu", "brand"]);

      if (productName) currentProductName = productName;
      if (category) currentCategory = normalizeCategoryNameForImport(category);
      if (brand) currentBrand = brand;

      const color = findValue(row, [
        "Giá trị thuộc tính 1",
        "gia tri thuoc tinh 1",
        "mau",
        "màu",
        "color",
      ]);

      const size = findValue(row, [
        "Giá trị thuộc tính 2",
        "gia tri thuoc tinh 2",
        "size",
      ]);

      const sku = findValue(row, ["Mã SKU*", "Mã SKU", "ma sku", "sku"]);
      const productImageUrl = findValue(row, [
        "Ảnh chính",
        "Anh chinh",
        "Ảnh đại diện",
        "anh dai dien",
        "Image chính",
        "main image",
        "product image",
        "image",
        "image url",
      ]);
      const genericColorImageUrl = findValue(row, [
        "Ảnh màu",
        "Anh mau",
        "Ảnh biến thể",
        "Anh bien the",
        "Variant image",
        "Color image",
      ]);
      const colorImageMatch = findColorImageMatch(row, color);
      const colorImageUrl = colorImageMatch.url || genericColorImageUrl;
      const imageUrl = colorImageUrl || productImageUrl;
      const imageSource = colorImageMatch.url
        ? colorImageMatch.source
        : genericColorImageUrl
          ? "Ảnh màu"
          : productImageUrl
            ? "Ảnh chính / Ảnh đại diện"
            : "";
      const imageWarning = imageUrl
        ? colorImageUrl
          ? ""
          : color
            ? `Không thấy ảnh riêng cho màu ${color}; sẽ dùng ảnh chính.`
            : "Không có màu để map ảnh riêng; sẽ dùng ảnh chính."
        : "Chưa có link ảnh.";

      const weight = normalizeNumber(
        findValue(row, ["Khối lượng", "khoi luong", "weight"]),
      );

      const retailPrice = normalizeNumber(
        findValue(row, ["PL_Giá bán lẻ", "pl gia ban le", "gia ban le"]),
      );

      const importPrice = getImportPriceFromRow(row);

      const stockCL = normalizeNumber(
        findValue(row, ["LC_CN1_Tồn kho ban đầu*", "lc cn1 ton kho ban dau"]),
      );

      const stockXD = normalizeNumber(
        findValue(row, ["LC_CN2_Tồn kho ban đầu*", "lc cn2 ton kho ban dau"]),
      );

      const stockQO = normalizeNumber(
        findValue(row, ["LC_CN3_Tồn kho ban đầu*", "lc cn3 ton kho ban dau"]),
      );

      const stockTH = normalizeNumber(
        findValue(row, ["LC_CN4_Tồn kho ban đầu*", "lc cn4 ton kho ban dau"]),
      );

      const hasAnyUsefulValue =
        currentProductName ||
        currentCategory ||
        currentBrand ||
        color ||
        size ||
        sku ||
        retailPrice ||
        importPrice ||
        stockCL ||
        stockXD ||
        stockQO ||
        stockTH ||
        productImageUrl ||
        colorImageUrl ||
        imageUrl;

      if (!hasAnyUsefulValue) continue;

      if (!currentProductName) {
        errors.push(
          `Dòng ${index + 2}: không xác định được sản phẩm gốc, đã bỏ qua`,
        );
        continue;
      }

      const isColorImageOnlyRow =
        importMode === "images" &&
        Boolean(currentProductName) &&
        Boolean(color) &&
        !sku &&
        !size;

      if (isColorImageOnlyRow) {
        const matchedProduct = findProductForImageImport(currentProductName);
        if (!matchedProduct) {
          errors.push(
            `Dòng ${index + 2}: không tìm thấy sản phẩm "${currentProductName}" trong hệ thống.`,
          );
          continue;
        }

        const matchedVariants = (matchedProduct.variants || []).filter(
          (variant: any) => normalizeHeader(variant.color) === normalizeHeader(color),
        );

        if (!matchedVariants.length) {
          errors.push(
            `Dòng ${index + 2}: sản phẩm "${currentProductName}" không có màu "${color}".`,
          );
          continue;
        }

        matchedVariants.forEach((variant: any) => {
          previewRows.push(
            buildPreviewRowFromExistingVariant({
              product: matchedProduct,
              variant,
              colorImageUrl: colorImageUrl || productImageUrl,
              imageSource: colorImageUrl ? "Ảnh màu" : "Ảnh chính / Ảnh đại diện",
            }),
          );
        });
        continue;
      }

      if (!sku || !color || !size) {
        errors.push(
          `Dòng ${index + 2}: thiếu SKU hoặc màu hoặc size, đã bỏ qua`,
        );
        continue;
      }

      previewRows.push({
        productName: currentProductName,
        category: normalizeCategoryNameForImport(currentCategory),
        brand: currentBrand || "The 1970",
        color,
        size,
        sku,
        weight,
        imageUrl,
        productImageUrl,
        colorImageUrl,
        imageSource,
        imageWarning,
        retailPrice,
        importPrice,
        stockCL,
        stockXD,
        stockQO,
        stockTH,
      });
    }

    return {
      normalized: previewRows,
      errors,
    };
  };

  const handleImportFiles = async (files: FileList | null) => {
    const pickedFiles = Array.from(files || []);
    setSelectedFiles(pickedFiles);
    setImportFileNames(pickedFiles.map((f) => f.name));
    setImportRows([]);
    setImportErrors([]);

    if (!pickedFiles.length) return;

    const previewRows: ImportPreviewRow[] = [];
    const previewErrors: string[] = [];

    for (const file of pickedFiles) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: "",
        });

        const headerRowIndex = detectHeaderRowIndex(sheetData);

        if (headerRowIndex === -1) {
          previewErrors.push(
            `${file.name}: không tìm thấy dòng tiêu đề hợp lệ.`,
          );
          continue;
        }

        const rawRows = buildRowsFromSheetData(
          sheetData,
          headerRowIndex,
        ).filter((row) =>
          Object.values(row).some((value) => String(value ?? "").trim() !== ""),
        );

        if (!rawRows.length) {
          previewErrors.push(`${file.name}: file không có dữ liệu.`);
          continue;
        }

        const { normalized, errors } = parseProductRows(rawRows);
        previewRows.push(...normalized.slice(0, 30));
        previewErrors.push(...errors.slice(0, 30));
      } catch (err) {
        console.error("Preview Excel error:", err);
        previewErrors.push(
          `${file.name}: không đọc được file. ${
            err instanceof Error ? err.message : ""
          }`,
        );
      }
    }

    setImportRows(previewRows);
    setImportErrors(previewErrors);
  };

  const handleCommitImport = async () => {
    if (!canImportProducts) {
      setActionMessage("Role hiện tại không có quyền nhập Excel sản phẩm.");
      return;
    }

    if (!selectedFiles.length) {
      setActionMessage("Chưa có file để import.");
      return;
    }

    try {
      setImporting(true);
      setImportProgress(1);
      setImportProgressLabel("Đang upload file Excel...");
      setActionMessage("");

      const filesForImport =
        importMode === "images"
          ? await buildImageImportUploadFiles(selectedFiles)
          : selectedFiles;

      const result = await importProductsFiles(
        filesForImport,
        true,
        (percent) => {
          setImportProgress(percent);
          setImportProgressLabel(
            percent >= 100
              ? "Hoàn tất import."
              : percent >= 85
                ? "Đã upload xong, server đang xử lý dữ liệu..."
                : `Đang upload file Excel... ${percent}%`,
          );
        },
      );
      await loadCategories();
      await loadProductCategoryOptions();
      await loadProducts(1, limit);
      setPage(1);
      setImportProgress(100);
      setImportProgressLabel("Hoàn tất import.");
      setImportOpen(false);

      const successCount = Number(result?.successRows || 0);
      const failedCount = Number(result?.failedRows || 0);

      resetImportForm();
      setActionMessage(
        `Đã import sản phẩm. Thành công ${successCount} dòng, lỗi ${failedCount} dòng.`,
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Import sản phẩm thất bại.",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleClearAllDescriptions = async () => {
    if (!canManageProductMasterData) {
      setActionMessage("Role hiện tại không có quyền xoá mô tả sản phẩm.");
      return;
    }

    const ok1 = window.confirm(
      "Xoá toàn bộ mô tả sản phẩm? Thao tác này không hoàn tác được.",
    );
    if (!ok1) return;

    const ok2 = window.confirm(
      "Xác nhận lần 2: tất cả mô tả sản phẩm sẽ bị xoá trắng.",
    );
    if (!ok2) return;

    try {
      setActionMessage("Đang xoá mô tả sản phẩm...");
      const result = await clearAllProductDescriptions();
      await loadProducts(page, limit);
      await loadProductSummary();
      setActionMessage(`Đã xoá mô tả của ${result?.count || 0} sản phẩm.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không xoá được mô tả sản phẩm.",
      );
    }
  };

  const handleExportImageImportRowsExcel = async () => {
    if (!canExportProducts) {
      setActionMessage("Role hiện tại không có quyền xuất Excel sản phẩm.");
      return;
    }

    try {
      setExportingImageImportRows(true);
      setActionMessage("Đang xuất file dán link ảnh theo từng SKU...");

      const exportLimit = Math.max(totalProducts, products.length, 1000);
      const result = await (getProducts as any)({
        page: 1,
        limit: exportLimit,
        q: query.trim(),
        category: groupFilter,
        status: statusFilter,
        branchId:
          !isOwner && !canViewInventory && currentBranchId
            ? currentBranchId
            : undefined,
      });

      const exportSource = Array.isArray(result) ? result : result?.data || [];
      const branchesForExport = visibleBranches.length ? visibleBranches : branches;
      const rowCount = buildProductImageImportWorkbook(exportSource, branchesForExport);

      setActionMessage(
        `Đã xuất ${rowCount} dòng SKU để dán link ảnh. Mỗi dòng tương ứng một màu/size.`,
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không xuất được file dán link ảnh.",
      );
    } finally {
      setExportingImageImportRows(false);
    }
  };

  const handleExportProductsExcel = async () => {
    if (!canExportProducts) {
      setActionMessage("Role hiện tại không có quyền xuất Excel sản phẩm.");
      return;
    }

    try {
      setExportingProducts(true);
      setActionMessage("Đang tạo file Excel sản phẩm...");

      const exportLimit =
        exportScope === "current_page"
          ? limit
          : Math.max(totalProducts, products.length, 1000);

      const result = await (getProducts as any)({
        page: exportScope === "current_page" ? page : 1,
        limit: exportLimit,
        q: exportScope === "all" ? "" : query.trim(),
        category: exportScope === "all" ? "ALL" : groupFilter,
        status: exportScope === "all" ? "ALL" : statusFilter,
        branchId:
          !isOwner && !canViewInventory && currentBranchId
            ? currentBranchId
            : undefined,
      });

      const exportSource = Array.isArray(result) ? result : result?.data || [];
      const branchesForExport = visibleBranches.length
        ? visibleBranches
        : branches;

      const rowCount = buildEnterpriseProductExport(
        exportSource,
        branchesForExport,
        {
          scope: exportScope,
          branchIds: exportBranchIds,
          columns: exportColumns,
          onlyInStock: exportOnlyInStock,
          onlyMissingCost: exportOnlyMissingCost,
          onlyLowStock: exportOnlyLowStock,
          includeSummarySheet: exportIncludeSummarySheet,
          includeBranchSheets: exportIncludeBranchSheets,
          sortMode: exportSortMode,
        },
      );

      setExportOpen(false);
      setActionMessage(`Đã xuất Excel enterprise ${rowCount} dòng SKU.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Xuất Excel sản phẩm thất bại.",
      );
    } finally {
      setExportingProducts(false);
    }
  };

  const applyExportPreset = (
    preset:
      | "management"
      | "accounting"
      | "stocktake"
      | "missing_cost"
      | "low_stock"
      | "full",
  ) => {
    if (preset === "management") {
      setExportScope("filtered");
      setExportOnlyInStock(false);
      setExportOnlyMissingCost(false);
      setExportOnlyLowStock(false);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(true);
      setExportSortMode("value_desc");
      setExportColumns({
        ...defaultExportColumns,
        imageUrl: false,
        description: false,
      });
      return;
    }

    if (preset === "accounting") {
      setExportScope("filtered");
      setExportOnlyInStock(true);
      setExportOnlyMissingCost(false);
      setExportOnlyLowStock(false);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(true);
      setExportSortMode("value_desc");
      setExportColumns({
        productName: true,
        slug: true,
        category: true,
        brand: true,
        weight: false,
        imageUrl: false,
        sku: true,
        color: true,
        size: true,
        price: true,
        costPrice: true,
        branchStocks: true,
        totalStock: true,
        inventoryValue: true,
        status: true,
        description: false,
      });
      return;
    }

    if (preset === "stocktake") {
      setExportScope("filtered");
      setExportOnlyInStock(false);
      setExportOnlyMissingCost(false);
      setExportOnlyLowStock(false);
      setExportIncludeSummarySheet(false);
      setExportIncludeBranchSheets(true);
      setExportSortMode("product_asc");
      setExportColumns({
        productName: true,
        slug: true,
        category: true,
        brand: false,
        weight: false,
        imageUrl: false,
        sku: true,
        color: true,
        size: true,
        price: false,
        costPrice: false,
        branchStocks: true,
        totalStock: true,
        inventoryValue: false,
        status: true,
        description: false,
      });
      return;
    }

    if (preset === "missing_cost") {
      setExportScope("filtered");
      setExportOnlyInStock(true);
      setExportOnlyMissingCost(true);
      setExportOnlyLowStock(false);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(false);
      setExportSortMode("missing_cost_first");
      setExportColumns({
        productName: true,
        slug: true,
        category: true,
        brand: false,
        weight: false,
        imageUrl: false,
        sku: true,
        color: true,
        size: true,
        price: true,
        costPrice: true,
        branchStocks: true,
        totalStock: true,
        inventoryValue: true,
        status: true,
        description: false,
      });
      return;
    }

    if (preset === "low_stock") {
      setExportScope("filtered");
      setExportOnlyInStock(true);
      setExportOnlyMissingCost(false);
      setExportOnlyLowStock(true);
      setExportIncludeSummarySheet(true);
      setExportIncludeBranchSheets(true);
      setExportSortMode("stock_desc");
      setExportColumns({
        ...defaultExportColumns,
        price: false,
        costPrice: false,
        inventoryValue: false,
        imageUrl: false,
        description: false,
      });
      return;
    }

    setExportScope("all");
    setExportOnlyInStock(false);
    setExportOnlyMissingCost(false);
    setExportOnlyLowStock(false);
    setExportIncludeSummarySheet(true);
    setExportIncludeBranchSheets(true);
    setExportSortMode("product_asc");
    setExportColumns(
      Object.fromEntries(
        (Object.keys(defaultExportColumns) as ExportColumnKey[]).map((key) => [
          key,
          true,
        ]),
      ) as ExportColumnState,
    );
  };

  const exportSelectedBranchCount =
    exportBranchIds.length || visibleBranches.length;
  const exportSelectedColumnCount =
    Object.values(exportColumns).filter(Boolean).length;
  const exportScopeLabel =
    exportScope === "all"
      ? "Tất cả sản phẩm"
      : exportScope === "current_page"
        ? "Chỉ trang hiện tại"
        : "Theo bộ lọc hiện tại";
  const exportFilterLabels = [
    exportOnlyInStock ? "còn tồn" : "",
    exportOnlyMissingCost ? "thiếu giá nhập" : "",
    exportOnlyLowStock ? "tồn thấp" : "",
  ].filter(Boolean);

  if (!canViewProduct) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-red-600">Không có quyền xem sản phẩm.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4 p-3 pb-24 md:space-y-6 md:p-6">
      <SectionTitle
        title="Sản phẩm"
        description="Xem nhanh catalog theo dạng bảng, ảnh lớn hơn để lướt nhanh và nhìn rõ tồn kho theo từng chi nhánh."
        action={
          <div className="flex flex-wrap gap-3">
            {canExportProducts ? (
              <Button
                variant="secondary"
                onClick={() => setExportOpen(true)}
                className="rounded-full"
                disabled={loading || !products.length}
              >
                Xuất Excel
              </Button>
            ) : null}

            {canManageProductMasterData ? (
              <Button
                variant="danger"
                onClick={() => void handleClearAllDescriptions()}
                className="rounded-full"
                disabled={loading}
              >
                Xoá mô tả SP
              </Button>
            ) : null}

            {canImportProducts ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => openImportModal("products")}
                  className="rounded-full"
                >
                  Nhập Excel
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => openImportModal("images")}
                  className="rounded-full"
                >
                  Nhập Excel ảnh
                </Button>
              </>
            ) : null}

            {canManageProductMasterData ? (
              <Link
                href="/control/product-categories"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
              >
                Danh mục
              </Link>
            ) : null}

            {canCreateProduct ? (
              <Button
                onClick={() => {
                  resetCreateForm();
                  setCreateOpen(true);
                }}
                className="rounded-full"
              >
                + Thêm sản phẩm
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tổng sản phẩm"
          value={totalProducts}
          sub="Theo bộ lọc hiện tại"
        />
        <StatCard
          title="Tổng variants"
          value={totalVariants}
          sub="Tất cả size / màu đang có"
        />
        <StatCard
          title="SKU tồn thấp"
          value={lowStockCount}
          sub="<= 3 sản phẩm"
        />

        {canViewInventoryValue ? (
          <StatCard
            title="Giá trị catalog"
            value={currency(catalogValue)}
            sub="Giá nhập × tồn kho"
          />
        ) : null}
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.7fr_0.7fr_0.7fr_auto_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên, mã sản phẩm, danh mục hoặc SKU..."
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Danh mục sản phẩm</option>
            {productGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="DRAFT">DRAFT</option>
          </select>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {totalProducts} sản phẩm
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              setDraftDisplayPreset(displayPreset);
              setDisplayOptionsOpen((prev) => !prev);
            }}
            className="rounded-2xl whitespace-nowrap"
          >
            Tuỳ chọn hiển thị
          </Button>
        </div>

        {displayOptionsOpen ? (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Sắp xếp nhanh
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {[
                { value: "default", label: "Mặc định A-Z" },
                { value: "newest", label: "Mới tạo lên đầu" },
                { value: "bestSelling", label: "Bán chạy lên đầu" },
                { value: "priceHigh", label: "Giá cao lên đầu" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                >
                  <input
                    type="checkbox"
                    checked={draftDisplayPreset === option.value}
                    onChange={() => {
                      const nextPreset = option.value as ProductDisplayPreset;
                      setDraftDisplayPreset(nextPreset);
                      applyDisplayPreset(nextPreset);
                    }}
                    className="h-4 w-4 accent-neutral-900"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3">
              <p className="text-xs text-neutral-500">
                Lưu để giữ cách sắp xếp này cho lần mở sau.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={resetDisplayOptions}
                  className="rounded-xl px-3 py-2 text-xs"
                >
                  Về mặc định
                </Button>
                <Button
                  onClick={saveDisplayOptions}
                  className="rounded-xl px-3 py-2 text-xs"
                >
                  Lưu tuỳ chọn
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Panel>

      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {actionMessage ? (
        <Panel className="p-4">
          <p className="text-sm text-neutral-700">{actionMessage}</p>
        </Panel>
      ) : null}

      {selectedProductIds.length ? (
        <Panel className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                Đã chọn {selectedProductIds.length} sản phẩm
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Có thể đưa sản phẩm đã chọn sang Trung tâm in ấn để cấu hình tem
                và preview trước khi in.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={clearSelectedProducts}>
                Bỏ chọn
              </Button>
              {canExportProducts ? (
                <Button variant="secondary" onClick={handleBulkExportSelected}>
                  Xuất Excel đã chọn
                </Button>
              ) : null}
              <Button onClick={handleBulkPrintLabels}>In tem đã chọn</Button>
              {canToggleProductStatus ? (
                <Button variant="danger" onClick={handleBulkToggleInactive}>
                  Ngừng bán đã chọn
                </Button>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      {canManageProductMasterData ? (
        <Panel className="overflow-hidden">
          <button
            type="button"
            onClick={() => setCategoryNormalizerOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            title={
              categoryNormalizerOpen
                ? "Thu gọn chuẩn hoá danh mục"
                : "Mở chuẩn hoá danh mục"
            }
          >
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Chuẩn hoá danh mục sản phẩm
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Gộp danh mục dư thừa khi cần. Mặc định thu gọn để bảng sản phẩm
                gọn hơn.
              </p>
            </div>
            <span className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700">
              {categoryNormalizerOpen ? "Thu gọn ↑" : "Mở ra ↓"}
            </span>
          </button>

          {categoryNormalizerOpen ? (
            <div className="border-t border-neutral-100 p-4">
              <CategoryNormalizer
                categories={productGroups}
                onDone={async () => {
                  await loadProductCategoryOptions();
                  await loadCategories();
                  await loadProducts(1, limit);
                  setPage(1);
                }}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        {loading ? (
          <div className="p-5">
            <p className="text-sm text-neutral-500">Đang tải sản phẩm...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-neutral-500">
              Không có sản phẩm phù hợp.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-neutral-100 md:hidden">
              {filteredProducts.map((product) => {
                const variants = product.variants || [];
                const productStock = variants.reduce(
                  (sum, v) => sum + getVariantScopedStock(v),
                  0,
                );
                const branchBadges = visibleBranches.map((branch) => ({
                  id: branch.id,
                  name: branch.name,
                  qty: variants.reduce(
                    (s, v) => s + Number(v.branchStocks?.[branch.id] || 0),
                    0,
                  ),
                }));
                const shortBranchText = branchBadges
                  .filter((item) => item.qty > 0)
                  .slice(0, 4)
                  .map((item) => `${item.name}: ${item.qty}`)
                  .join(" · ");

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openProductDetail(product)}
                    className="flex w-full items-center gap-3 bg-white px-3 py-3 text-left transition active:bg-neutral-50"
                    title="Mở chi tiết sản phẩm"
                  >
                    <ProductImage src={product.imageUrl} alt={product.name} />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold leading-5 text-neutral-950">
                        {product.name}
                      </div>
                      <div className="mt-1 truncate text-xs text-neutral-500">
                        /{product.slug || getMainSku(product)} ·{" "}
                        {variants.length} SKU
                      </div>
                      <div className="mt-1 truncate text-[11px] text-neutral-500">
                        {shortBranchText || "Chưa có tồn theo chi nhánh"}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div
                        className={`text-[17px] font-semibold leading-none ${
                          productStock <= 0
                            ? "text-red-600"
                            : productStock <= 3
                              ? "text-amber-600"
                              : "text-neutral-950"
                        }`}
                      >
                        {productStock}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        tồn
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="bg-white p-3">
                <div className="flex flex-wrap gap-2 text-sm text-neutral-500">
                  <span>
                    Trang {page} / {totalProductPages}
                  </span>
                  <span>· {totalProducts} sản phẩm</span>
                  <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                    Đã chọn {selectedProductIds.length} sản phẩm
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="w-full"
                  >
                    ← Trước
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={
                      page >= Math.max(1, Math.ceil(totalProducts / limit)) ||
                      loading
                    }
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(
                          Math.max(1, Math.ceil(totalProducts / limit)),
                          prev + 1,
                        ),
                      )
                    }
                    className="w-full"
                  >
                    Sau →
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden overflow-auto md:block">
              <table className="min-w-[1750px] w-full border-collapse">
                <thead className="bg-neutral-50">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                    <th className="w-10 border-b border-neutral-200 px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả sản phẩm đang hiện"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisibleProducts}
                        className="h-4 w-4 accent-neutral-900"
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      Ảnh
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Sản phẩm"
                        active={sortKey === "name"}
                        direction={sortDirection}
                        onClick={() => handleSort("name")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Loại"
                        active={sortKey === "category"}
                        direction={sortDirection}
                        onClick={() => handleSort("category")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Màu"
                        active={sortKey === "color"}
                        direction={sortDirection}
                        onClick={() => handleSort("color")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Size"
                        active={sortKey === "size"}
                        direction={sortDirection}
                        onClick={() => handleSort("size")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="SKU chính"
                        active={sortKey === "sku"}
                        direction={sortDirection}
                        onClick={() => handleSort("sku")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Giá bán"
                        active={sortKey === "price"}
                        direction={sortDirection}
                        onClick={() => handleSort("price")}
                      />
                    </th>
                    {canViewCost ? (
                      <th className="border-b border-neutral-200 px-3 py-3">
                        <SortButton
                          label="Giá nhập"
                          active={sortKey === "costPrice"}
                          direction={sortDirection}
                          onClick={() => handleSort("costPrice")}
                        />
                      </th>
                    ) : null}
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Theo chi nhánh"
                        active={sortKey === "branchStock"}
                        direction={sortDirection}
                        onClick={() => handleSort("branchStock")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Tồn"
                        active={sortKey === "stock"}
                        direction={sortDirection}
                        onClick={() => handleSort("stock")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Trạng thái"
                        active={sortKey === "status"}
                        direction={sortDirection}
                        onClick={() => handleSort("status")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      <SortButton
                        label="Mô tả"
                        active={sortKey === "description"}
                        direction={sortDirection}
                        onClick={() => handleSort("description")}
                      />
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-3">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const productStock = product.variants.reduce(
                      (sum, v) => sum + getVariantScopedStock(v),
                      0,
                    );

                    const branchBadges = visibleBranches.map((branch) => ({
                      id: branch.id,
                      name: branch.name,
                      qty: product.variants.reduce(
                        (s, v) => s + Number(v.branchStocks?.[branch.id] || 0),
                        0,
                      ),
                    }));

                    const minPrice =
                      product.variants.length > 0
                        ? Math.min(
                            ...product.variants.map((v) =>
                              Number(v.price || 0),
                            ),
                          )
                        : 0;

                    const minCostPrice =
                      product.variants.length > 0
                        ? Math.min(
                            ...product.variants.map((v) =>
                              Number(v.costPrice || 0),
                            ),
                          )
                        : 0;

                    const colorsList = uniqueValues(
                      product.variants.map((variant) => variant.color),
                    );
                    const sizesList = uniqueValues(
                      product.variants.map((variant) => variant.size),
                    );

                    return (
                      <tr
                        key={product.id}
                        className={`align-middle text-sm hover:bg-neutral-50 ${
                          selectedProductIds.includes(product.id)
                            ? "bg-neutral-50"
                            : "bg-white"
                        }`}
                      >
                        <td className="border-b border-neutral-100 px-3 py-3 align-middle">
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${product.name}`}
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => toggleSelectProduct(product.id)}
                            className="h-4 w-4 accent-neutral-900"
                          />
                        </td>
                        <td className="border-b border-neutral-100 px-3 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() => openProductDetail(product)}
                            className="block rounded-2xl transition hover:opacity-80"
                            title="Mở chi tiết sản phẩm trong tab mới"
                          >
                            <ProductImage
                              src={product.imageUrl}
                              alt={product.name}
                            />
                          </button>
                        </td>

                        <td className="min-w-[260px] border-b border-neutral-100 px-3 py-3">
                          <button
                            type="button"
                            onClick={() => openProductDetail(product)}
                            className="text-left font-medium text-neutral-900 underline-offset-2 hover:underline"
                            title="Mở chi tiết sản phẩm trong tab mới"
                          >
                            {product.name}
                          </button>
                          <div className="mt-1 text-xs text-neutral-500">
                            /{product.slug || "—"} · {product.weight || 0}g
                          </div>
                        </td>

                        <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                          {canManageProductMasterData ? (
                            <Link
                              href="/control/product-categories"
                              className="inline-flex"
                              title="Sửa danh mục sản phẩm"
                            >
                              <Badge tone="blue">
                                {product.category || "Chưa có danh mục"}
                              </Badge>
                            </Link>
                          ) : (
                            <Badge tone="blue">
                              {product.category || "Chưa có danh mục"}
                            </Badge>
                          )}
                        </td>

                        <td className="min-w-[120px] border-b border-neutral-100 px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {colorsList.map((color) => (
                              <Badge key={color} tone="gray">
                                {color}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        <td className="min-w-[120px] border-b border-neutral-100 px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {sizesList.map((size) => (
                              <Badge key={size} tone="gray">
                                {size}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                          <Badge tone="gray">{getMainSku(product)}</Badge>
                        </td>

                        <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                          {currency(minPrice)}
                        </td>

                        {canViewCost ? (
                          <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                            {currency(minCostPrice)}
                          </td>
                        ) : null}

                        <td className="min-w-[220px] border-b border-neutral-100 px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {branchBadges.map((item) => (
                              <Badge
                                key={item.id}
                                tone={item.qty <= 3 ? "amber" : "green"}
                              >
                                {item.name}: {item.qty}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                          <div className="font-medium text-neutral-900">
                            {productStock}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {isOwner
                              ? "Tổng tất cả chi nhánh"
                              : "Tồn chi nhánh của bạn"}
                          </div>
                        </td>

                        <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                          <Badge tone={toneForStatus(product.status)}>
                            {product.status || "DRAFT"}
                          </Badge>
                        </td>

                        <td className="min-w-[180px] border-b border-neutral-100 px-3 py-3 text-neutral-600">
                          {shortText(product.description, 80)}
                        </td>

                        <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3 align-middle">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openProductDetail(product)}
                              className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                            >
                              Chi tiết
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePrintProductLabels(product)}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                            >
                              In tem
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSelectProduct(product.id)}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                            >
                              {selectedProductIds.includes(product.id)
                                ? "Bỏ chọn"
                                : "Chọn"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-neutral-500">
                  <span>
                    Trang {page} / {totalProductPages}
                  </span>
                  <span>· {totalProducts} sản phẩm</span>
                  <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                    Đã chọn {selectedProductIds.length} sản phẩm
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-xl border border-neutral-300 px-3 py-2 outline-none"
                    value={limit}
                    onChange={(e) => {
                      const nextLimit = Number(e.target.value);
                      setLimit(nextLimit);
                      setPage(1);
                    }}
                  >
                    <option value={20}>20 dòng</option>
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                  </select>

                  {/* về đầu */}
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(1)}
                  >
                    Đầu
                  </Button>

                  {/* lùi */}
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Trước
                  </Button>

                  {/* input nhảy trang */}
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.ceil(totalProducts / limit))}
                    value={page}
                    onChange={(e) => {
                      const maxPage = Math.max(
                        1,
                        Math.ceil(totalProducts / limit),
                      );
                      const nextPage = Math.min(
                        maxPage,
                        Math.max(1, Number(e.target.value || 1)),
                      );
                      setPage(nextPage);
                    }}
                    className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-center outline-none"
                  />

                  {/* tiến */}
                  <Button
                    variant="secondary"
                    disabled={
                      page >= Math.max(1, Math.ceil(totalProducts / limit)) ||
                      loading
                    }
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(
                          Math.max(1, Math.ceil(totalProducts / limit)),
                          prev + 1,
                        ),
                      )
                    }
                  >
                    Sau
                  </Button>

                  {/* về cuối */}
                  <Button
                    variant="secondary"
                    disabled={
                      page >= Math.max(1, Math.ceil(totalProducts / limit)) ||
                      loading
                    }
                    onClick={() =>
                      setPage(Math.max(1, Math.ceil(totalProducts / limit)))
                    }
                  >
                    Cuối
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Xuất Excel Enterprise"
        maxWidthClass="max-w-5xl"
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Panel className="p-4">
              <p className="text-sm font-semibold text-neutral-900">
                Phạm vi sản phẩm
              </p>
              <div className="mt-3 space-y-2 text-sm text-neutral-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={exportScope === "filtered"}
                    onChange={() => setExportScope("filtered")}
                  />
                  Theo filter hiện tại
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={exportScope === "current_page"}
                    onChange={() => setExportScope("current_page")}
                  />
                  Chỉ trang hiện tại
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={exportScope === "all"}
                    onChange={() => setExportScope("all")}
                  />
                  Tất cả sản phẩm
                </label>
              </div>
            </Panel>

            <Panel className="p-4">
              <p className="text-sm font-semibold text-neutral-900">
                Bộ lọc nhanh
              </p>
              <div className="mt-3 space-y-2 text-sm text-neutral-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOnlyInStock}
                    onChange={(e) => setExportOnlyInStock(e.target.checked)}
                  />
                  Chỉ SKU còn tồn
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOnlyMissingCost}
                    onChange={(e) => setExportOnlyMissingCost(e.target.checked)}
                  />
                  Chỉ SKU thiếu giá nhập
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOnlyLowStock}
                    onChange={(e) => setExportOnlyLowStock(e.target.checked)}
                  />
                  Chỉ SKU tồn thấp
                </label>
              </div>
            </Panel>

            <Panel className="p-4">
              <p className="text-sm font-semibold text-neutral-900">
                Sheet & sắp xếp
              </p>
              <div className="mt-3 space-y-2 text-sm text-neutral-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportIncludeSummarySheet}
                    onChange={(e) =>
                      setExportIncludeSummarySheet(e.target.checked)
                    }
                  />
                  Có sheet tổng quan
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportIncludeBranchSheets}
                    onChange={(e) =>
                      setExportIncludeBranchSheets(e.target.checked)
                    }
                  />
                  Mỗi chi nhánh 1 sheet
                </label>
                <select
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-3 py-2 outline-none"
                  value={exportSortMode}
                  onChange={(e) =>
                    setExportSortMode(e.target.value as ExportSortMode)
                  }
                >
                  <option value="product_asc">Sắp xếp theo tên sản phẩm</option>
                  <option value="stock_desc">Tồn nhiều nhất</option>
                  <option value="value_desc">Giá trị tồn cao nhất</option>
                  <option value="missing_cost_first">
                    Thiếu giá nhập lên đầu
                  </option>
                </select>
              </div>
            </Panel>
          </div>

          <Panel className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  Preset xuất nhanh
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Chọn cấu hình có sẵn để khỏi tick thủ công từng cột khi xuất
                  Excel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => applyExportPreset("management")}
                >
                  Quản lý
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyExportPreset("accounting")}
                >
                  Kế toán tồn
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyExportPreset("stocktake")}
                >
                  Kiểm kho
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyExportPreset("missing_cost")}
                >
                  Thiếu giá nhập
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyExportPreset("low_stock")}
                >
                  Tồn thấp
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyExportPreset("full")}
                >
                  Full SAPO
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Phạm vi</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {exportScopeLabel}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Chi nhánh</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {exportSelectedBranchCount} chi nhánh
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Cột dữ liệu</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {exportSelectedColumnCount} cột
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Lọc thêm</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {exportFilterLabels.length
                    ? exportFilterLabels.join(", ")
                    : "Không"}
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  Chọn chi nhánh
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Không chọn chi nhánh nào = xuất tất cả chi nhánh đang có quyền
                  xem.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setExportBranchIds(
                      visibleBranches.map((branch) => branch.id),
                    )
                  }
                >
                  Chọn tất cả
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setExportBranchIds([])}
                >
                  Bỏ chọn
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {visibleBranches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={exportBranchIds.includes(branch.id)}
                    onChange={(e) => {
                      setExportBranchIds((prev) =>
                        e.target.checked
                          ? Array.from(new Set([...prev, branch.id]))
                          : prev.filter((id) => id !== branch.id),
                      );
                    }}
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  Cột dữ liệu
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Chọn thông tin cần đưa vào sheet Danh sách SKU.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setExportColumns(defaultExportColumns)}
                >
                  Mặc định
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setExportColumns(
                      Object.fromEntries(
                        (
                          Object.keys(defaultExportColumns) as ExportColumnKey[]
                        ).map((key) => [key, true]),
                      ) as ExportColumnState,
                    )
                  }
                >
                  Chọn tất cả
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setExportColumns(
                      Object.fromEntries(
                        (
                          Object.keys(defaultExportColumns) as ExportColumnKey[]
                        ).map((key) => [key, false]),
                      ) as ExportColumnState,
                    )
                  }
                >
                  Bỏ hết cột
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {(Object.keys(exportColumns) as ExportColumnKey[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={exportColumns[key]}
                    onChange={(e) =>
                      setExportColumns((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  {exportColumnLabels[key]}
                </label>
              ))}
            </div>
          </Panel>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setExportOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => void handleExportProductsExcel()}
              disabled={exportingProducts || !canExportProducts}
            >
              {exportingProducts ? "Đang xuất..." : "Xuất Excel"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm sản phẩm mới"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Tên sản phẩm
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Vintage Oxford Shirt"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Mã sản phẩm
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={skuCode}
              onChange={(e) => setSkuCode(slugify(e.target.value))}
              placeholder="sm935"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Danh mục
            </label>
            <div className="flex gap-2">
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={categoryId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const found = syncedCategoryItems.find(
                    (item) => item.id === nextId,
                  );
                  setCategoryId(nextId);
                  setCategory(found?.name || "");
                }}
              >
                <option value="">Chọn danh mục</option>
                {syncedCategoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                onClick={() => {
                  if (!canEditProduct) return;
                  resetQuickCategoryForm();
                  setQuickCategoryOpen(true);
                }}
                disabled={!canEditProduct}
              >
                +
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Brand
            </label>
            <select
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              {brandOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Weight (g)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="450"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Hình ảnh sản phẩm
            </label>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Dán link ảnh hoặc upload từ máy"
              />

              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                {uploadingCreateImage ? "Đang upload..." : "Upload ảnh"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!canEditProduct}
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0] || null;

                    console.log("input file change:", file);

                    try {
                      await handleCreateImageUpload(file);
                    } finally {
                      if (input) input.value = "";
                    }
                  }}
                />
              </label>
            </div>

            {imageUrl ? (
              <div className="mt-3">
                <img
                  src={toAbsoluteFileUrl(imageUrl)}
                  alt="Preview"
                  className="h-24 w-24 rounded-2xl border border-neutral-200 object-cover"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Giá bán
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              placeholder="590000"
            />
          </div>

          {canViewCost ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Giá vốn
              </label>
              <input
                type="number"
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={defaultCostPrice}
                onChange={(e) => setDefaultCostPrice(e.target.value)}
                disabled={!canEditProductCost}
                placeholder="240000"
              />
            </div>
          ) : null}

          <div className={!canViewCost ? "md:col-span-1" : ""}>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Màu sắc
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="ĐEN, TRẮNG, NÂU"
            />
            <div className="mt-2">
              <TokenPreview
                value={colors}
                placeholder="Ví dụ: ĐEN, TRẮNG, NÂU"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Kích thước
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              placeholder="S, M, L, XL"
            />
            <div className="mt-2">
              <TokenPreview value={sizes} placeholder="Ví dụ: S, M, L, XL" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Mô tả
            </label>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn sản phẩm..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-neutral-700">
              Tồn kho mặc định theo chi nhánh
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {branches.map((branch) => (
                <div key={branch.id}>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {branch.name}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={branchStocks[branch.id] || "0"}
                    disabled={!canManageInventory}
                    onChange={(e) =>
                      setBranchStocks((prev) => ({
                        ...prev,
                        [branch.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => void handleCreateProduct()}
            disabled={savingProduct || !canCreateProduct}
          >
            {savingProduct
              ? "Đang tạo..."
              : canCreateProduct
                ? "Tạo sản phẩm"
                : "Không có quyền tạo"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Sửa sản phẩm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Tên sản phẩm
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={!canEditProduct}
              placeholder="Ví dụ: Vintage Oxford Shirt"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Mã sản phẩm
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editSkuCode}
              onChange={(e) => setEditSkuCode(slugify(e.target.value))}
              disabled={!canEditProduct}
              placeholder="sm935"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Danh mục
            </label>
            <div className="flex gap-2">
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={editCategoryId}
                disabled={!canEditProduct}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const found = syncedCategoryItems.find(
                    (item) => item.id === nextId,
                  );
                  setEditCategoryId(nextId);
                  setEditCategory(found?.name || "");
                }}
              >
                <option value="">Chọn danh mục</option>
                {syncedCategoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                onClick={() => {
                  if (!canEditProduct) return;
                  resetQuickCategoryForm();
                  setQuickCategoryOpen(true);
                }}
                disabled={!canEditProduct}
              >
                +
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Brand
            </label>
            <select
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editBrand}
              disabled={!canEditProduct}
              onChange={(e) => setEditBrand(e.target.value)}
            >
              {brandOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Weight (g)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
              disabled={!canEditProduct}
              placeholder="450"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Hình ảnh sản phẩm
            </label>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                disabled={!canEditProduct}
                placeholder="Dán link ảnh hoặc upload từ máy"
              />

              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                {canEditProduct
                  ? uploadingEditImage
                    ? "Đang upload..."
                    : "Upload ảnh"
                  : "Không có quyền upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!canEditProduct}
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0] || null;

                    console.log("input file change:", file);

                    try {
                      await handleEditImageUpload(file);
                    } finally {
                      if (input) input.value = "";
                    }
                  }}
                />
              </label>
            </div>

            {editImageUrl ? (
              <div className="mt-3">
                <img
                  src={toAbsoluteFileUrl(editImageUrl)}
                  alt="Preview"
                  className="h-24 w-24 rounded-2xl border border-neutral-200 object-cover"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Giá bán
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editDefaultPrice}
              onChange={(e) => setEditDefaultPrice(e.target.value)}
              disabled={!canEditProductPrice}
              placeholder="590000"
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={applyPriceToAllVariants}
                disabled={!canEditProductPrice}
                onChange={(e) => setApplyPriceToAllVariants(e.target.checked)}
              />
              Cập nhật giá bán cho toàn bộ size và màu của sản phẩm này
            </label>
          </div>

          {canViewCost ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Giá vốn
              </label>
              <input
                type="number"
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={editDefaultCostPrice}
                onChange={(e) => setEditDefaultCostPrice(e.target.value)}
                disabled={!canEditProductCost}
                placeholder="240000"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Màu sắc
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editColors}
              onChange={(e) => setEditColors(e.target.value)}
              disabled={!canEditProduct}
              placeholder="ĐEN, TRẮNG, NÂU"
            />
            <div className="mt-2">
              <TokenPreview
                value={editColors}
                placeholder="Ví dụ: ĐEN, TRẮNG, NÂU"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Kích thước
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editSizes}
              onChange={(e) => setEditSizes(e.target.value)}
              disabled={!canEditProduct}
              placeholder="S, M, L, XL"
            />
            <div className="mt-2">
              <TokenPreview
                value={editSizes}
                placeholder="Ví dụ: S, M, L, XL"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Mô tả
            </label>
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={!canEditProduct}
              placeholder="Mô tả ngắn sản phẩm..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-neutral-700">
              Tồn kho theo chi nhánh
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {branches.map((branch) => (
                <div key={branch.id}>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {branch.name}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={editBranchStocks[branch.id] || "0"}
                    disabled={!canEditProduct}
                    onChange={(e) =>
                      setEditBranchStocks((prev) => ({
                        ...prev,
                        [branch.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setEditOpen(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => void handleSaveEditProduct()}
            disabled={savingProduct || !canEditProduct}
          >
            {savingProduct ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={quickCategoryOpen}
        onClose={() => setQuickCategoryOpen(false)}
        title="Tạo danh mục nhanh"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Tên danh mục
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={quickCategoryName}
              onChange={(e) => setQuickCategoryName(e.target.value)}
              placeholder="Ví dụ: Shirt"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Mô tả
            </label>
            <textarea
              className="min-h-[90px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={quickCategoryDescription}
              onChange={(e) => setQuickCategoryDescription(e.target.value)}
              placeholder="Mô tả ngắn về danh mục..."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setQuickCategoryOpen(false)}
          >
            Đóng
          </Button>
          <Button
            onClick={() => void handleQuickCreateCategory()}
            disabled={savingCategory}
          >
            {savingCategory ? "Đang tạo..." : "Tạo danh mục"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        title="Thêm variant"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Màu
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={variantColor}
              onChange={(e) => setVariantColor(e.target.value)}
              placeholder="Olive"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Size
            </label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={variantSize}
              onChange={(e) => setVariantSize(e.target.value)}
              placeholder="M"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Giá bán
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={variantPrice}
              onChange={(e) => setVariantPrice(e.target.value)}
              placeholder="590000"
            />
          </div>

          {canViewCost ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Giá vốn
              </label>
              <input
                type="number"
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={variantCostPrice}
                onChange={(e) => setVariantCostPrice(e.target.value)}
                placeholder="240000"
              />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-neutral-700">
              Tồn kho theo chi nhánh
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {branches.map((branch) => (
                <div key={branch.id}>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {branch.name}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={variantBranchStocks[branch.id] || "0"}
                    onChange={(e) =>
                      setVariantBranchStocks((prev) => ({
                        ...prev,
                        [branch.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setVariantOpen(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => void handleAddVariant()}
            disabled={savingVariant || !canCreateProductVariant}
          >
            {savingVariant
              ? "Đang thêm..."
              : canCreateProductVariant
                ? "Thêm variant"
                : "Không có quyền thêm"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={
          importMode === "images"
            ? "Nhập ảnh sản phẩm từ Excel"
            : "Nhập sản phẩm từ Excel"
        }
        maxWidthClass="max-w-6xl"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-500">
              {importMode === "images" ? (
                <>
                  Import ảnh sản phẩm bằng Excel. Nút xuất file sẽ tạo danh sách chỉ gồm tên sản phẩm, màu và 1 cột dán link ảnh.
                </>
              ) : (
                <>
                  Import sản phẩm bằng flow cũ. File cũ vẫn dùng bình thường,
                  không bắt buộc có cột ảnh.
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {importMode === "images" ? (
                <Button
                  variant="secondary"
                  onClick={() => void handleExportImageImportRowsExcel()}
                  disabled={exportingImageImportRows || loading}
                >
                  {exportingImageImportRows
                    ? "Đang xuất..."
                    : "Xuất file dán ảnh theo màu"}
                </Button>
              ) : null}

              <Button
                variant="secondary"
                onClick={
                  importMode === "images"
                    ? downloadProductImageTemplate
                    : downloadProductTemplate
                }
              >
                {importMode === "images" ? "Tải file mẫu có ảnh" : "Tải file mẫu"}
              </Button>
            </div>
          </div>

          {importMode === "images" ? (
            <Panel className="p-4">
              <div className="text-sm font-semibold text-neutral-900">
                Cách map ảnh màu
              </div>
              <div className="mt-2 grid gap-3 text-sm text-neutral-600 md:grid-cols-3">
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <div className="font-semibold text-neutral-800">
                    1. Màu lấy theo từng dòng
                  </div>
                  <div className="mt-1 text-xs leading-5">
                    File xuất ảnh chỉ có <b>Tên sản phẩm</b>, <b>Màu</b> và <b>Ảnh màu</b>. Mỗi dòng là 1 sản phẩm + 1 màu.
                  </div>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <div className="font-semibold text-neutral-800">
                    2. Cột ảnh theo tên màu
                  </div>
                  <div className="mt-1 text-xs leading-5">
                    Chỉ cần dán link Cloudinary vào đúng cột <b>Ảnh màu</b>. Không cần cột ảnh theo từng màu nữa.
                  </div>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <div className="font-semibold text-neutral-800">
                    3. Sai màu sẽ fallback
                  </div>
                  <div className="mt-1 text-xs leading-5">
                    Khi import, hệ thống tự tìm toàn bộ SKU/size thuộc đúng sản phẩm và đúng màu để gắn ảnh.
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-800">
                  Upload file Excel
                </p>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={async (e) => {
                    await handleImportFiles(e.target.files);
                  }}
                  className="block w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm"
                />
                <div className="mt-2 text-xs text-neutral-500">
                  {importFileNames.length ? (
                    <div className="space-y-1">
                      {importFileNames.map((name) => (
                        <div key={name}>{name}</div>
                      ))}
                    </div>
                  ) : (
                    "Hỗ trợ .xlsx, .xls, .csv. Có thể chọn nhiều file cùng lúc."
                  )}
                </div>
              </div>

              <Button
                onClick={() => void handleCommitImport()}
                disabled={importing || !selectedFiles.length}
              >
                {importing ? "Đang import..." : "Xác nhận import"}
              </Button>
            </div>
          </Panel>

          {importErrors.length ? (
            <Panel className="p-4">
              <div className="mb-2 text-sm font-medium text-red-700">
                Lỗi preview
              </div>
              <div className="space-y-1 text-sm text-red-600">
                {importErrors.map((item, idx) => (
                  <div key={`${item}-${idx}`}>{item}</div>
                ))}
              </div>
            </Panel>
          ) : null}

          {importRows.length ? (
            <Panel className="overflow-hidden">
              <div className="border-b border-neutral-200 px-4 py-3 text-sm text-neutral-600">
                Preview {importRows.length} dòng đầu
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Màu</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Giá bán</th>
                      <th className="px-4 py-3">Giá nhập</th>
                      <th className="px-4 py-3">Tồn đầu</th>
                      {importMode === "images" ? (
                        <th className="px-4 py-3">Ảnh chính</th>
                      ) : null}
                      {importMode === "images" ? (
                        <th className="px-4 py-3">Ảnh màu</th>
                      ) : null}
                      {importMode === "images" ? (
                        <th className="px-4 py-3">Ảnh sẽ dùng</th>
                      ) : null}
                      {importMode === "images" ? (
                        <th className="px-4 py-3">Nguồn map</th>
                      ) : null}
                      {importMode === "images" ? (
                        <th className="px-4 py-3">Cảnh báo</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, idx) => (
                      <tr key={idx} className="border-t border-neutral-200">
                        <td className="px-4 py-3">{row.productName || "—"}</td>
                        <td className="px-4 py-3">{row.category || "—"}</td>
                        <td className="px-4 py-3">{row.color || "—"}</td>
                        <td className="px-4 py-3">{row.size || "—"}</td>
                        <td className="px-4 py-3">{row.sku || "—"}</td>
                        <td className="px-4 py-3">
                          {currency(row.retailPrice || 0)}
                        </td>
                        <td className="px-4 py-3">
                          {currency(row.importPrice || 0)}
                        </td>
                        <td className="px-4 py-3 text-xs space-y-1">
                          <div>CL: {row.stockCL || 0}</div>
                          <div>XD: {row.stockXD || 0}</div>
                          <div>QO: {row.stockQO || 0}</div>
                          <div>TH: {row.stockTH || 0}</div>
                        </td>
                        {importMode === "images" ? (
                          <td className="px-4 py-3">
                            {row.productImageUrl ? (
                              <div className="flex items-center gap-2">
                                <ProductImage
                                  src={row.productImageUrl}
                                  alt={row.productName || "Ảnh chính"}
                                />
                                <a
                                  href={row.productImageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 underline"
                                >
                                  Link
                                </a>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        {importMode === "images" ? (
                          <td className="px-4 py-3">
                            {row.colorImageUrl ? (
                              <div className="flex items-center gap-2">
                                <ProductImage
                                  src={row.colorImageUrl}
                                  alt={`${row.productName || "Sản phẩm"} ${row.color || ""}`}
                                />
                                <a
                                  href={row.colorImageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 underline"
                                >
                                  Link
                                </a>
                              </div>
                            ) : row.imageUrl ? (
                              <span className="text-xs text-neutral-500">
                                Dùng ảnh chính
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        {importMode === "images" ? (
                          <td className="px-4 py-3">
                            {row.imageUrl ? (
                              <div className="flex items-center gap-2">
                                <ProductImage
                                  src={row.imageUrl}
                                  alt={`${row.productName || "Sản phẩm"} ${row.color || ""}`}
                                />
                                <a
                                  href={row.imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 underline"
                                >
                                  Link
                                </a>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        {importMode === "images" ? (
                          <td className="px-4 py-3 text-xs">
                            {row.imageSource ? (
                              <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">
                                {row.imageSource}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        {importMode === "images" ? (
                          <td className="px-4 py-3 text-xs">
                            {row.imageWarning ? (
                              <span
                                className={
                                  row.imageUrl
                                    ? "text-amber-700"
                                    : "text-red-600"
                                }
                              >
                                {row.imageWarning}
                              </span>
                            ) : (
                              <span className="text-green-700">
                                Map đúng ảnh màu
                              </span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={labelPrintOpen}
        onClose={() => setLabelPrintOpen(false)}
        title={`In tem ${labelPrintProduct?.name || "sản phẩm"}`}
        maxWidthClass="max-w-6xl"
      >
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <Panel>
              <div className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Chọn SKU và số tem
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Mặc định 1 tem / SKU. Có thể bỏ chọn SKU hoặc đổi số lượng
                      từng dòng.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setLabelSelectedMap(
                          Object.fromEntries(
                            labelPrintRows.map((row) => [row.key, true]),
                          ),
                        )
                      }
                    >
                      Chọn tất cả
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setLabelSelectedMap(
                          Object.fromEntries(
                            labelPrintRows.map((row) => [row.key, false]),
                          ),
                        )
                      }
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                </div>

                <div className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-neutral-200">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead className="sticky top-0 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          In
                        </th>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          SKU
                        </th>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          Size
                        </th>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          Màu
                        </th>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          Tồn
                        </th>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          Giá
                        </th>
                        <th className="border-b border-neutral-200 px-3 py-2">
                          Số tem
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {labelPrintRows.map((row) => (
                        <tr
                          key={row.key}
                          className="bg-white hover:bg-neutral-50"
                        >
                          <td className="border-b border-neutral-100 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={Boolean(labelSelectedMap[row.key])}
                              onChange={(event) =>
                                setLabelSelectedMap((prev) => ({
                                  ...prev,
                                  [row.key]: event.target.checked,
                                }))
                              }
                            />
                          </td>
                          <td className="border-b border-neutral-100 px-3 py-2 font-medium text-neutral-900">
                            {row.sku}
                          </td>
                          <td className="border-b border-neutral-100 px-3 py-2">
                            {row.size || "—"}
                          </td>
                          <td className="border-b border-neutral-100 px-3 py-2">
                            {row.color || "—"}
                          </td>
                          <td className="border-b border-neutral-100 px-3 py-2">
                            {row.stock}
                          </td>
                          <td className="border-b border-neutral-100 px-3 py-2">
                            {currency(row.price)}
                          </td>
                          <td className="border-b border-neutral-100 px-3 py-2">
                            <input
                              value={labelPrintQtyMap[row.key] || "1"}
                              onChange={(event) =>
                                setLabelPrintQtyMap((prev) => ({
                                  ...prev,
                                  [row.key]: event.target.value.replace(
                                    /[^\d]/g,
                                    "",
                                  ),
                                }))
                              }
                              className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-center"
                              inputMode="numeric"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="grid gap-4 p-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Máy in
                  </label>
                  <select
                    value={labelPrinterName}
                    onChange={(event) =>
                      setLabelPrinterName(event.target.value)
                    }
                    className="w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm"
                  >
                    {labelPrinterOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Web không chọn máy in trực tiếp được; chọn máy thật ở hộp
                    thoại in của trình duyệt.
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Khổ tem
                  </label>
                  <select
                    value={labelPaperMode}
                    onChange={(event) => setLabelPaperMode(event.target.value)}
                    className="w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm"
                  >
                    {labelPaperOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Preview đã chừa hở 0,4mm giữa 2 tem.
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Giá bán
                  </label>
                  <select
                    value={labelPriceMode}
                    onChange={(event) =>
                      setLabelPriceMode(
                        event.target.value as "retail" | "hidden",
                      )
                    }
                    className="w-full rounded-2xl border border-neutral-300 px-3 py-3 text-sm"
                  >
                    <option value="retail">Hiện giá bán lẻ</option>
                    <option value="hidden">Không hiện giá</option>
                  </select>
                </div>
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">
                    Preview trước khi in
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {labelPreviewItems.reduce(
                      (sum, item) => sum + Number(item.quantity || 1),
                      0,
                    )}{" "}
                    tem sẽ được in
                  </div>
                </div>
                <Button
                  variant="success"
                  onClick={handleConfirmPrintProductLabels}
                >
                  In tem
                </Button>
              </div>

              <div className="h-[560px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                <iframe
                  title="Preview tem sản phẩm"
                  className="h-full w-full bg-white"
                  srcDoc={`<html><head><style>@page{size:50mm 50mm;margin:0}*{box-sizing:border-box}body{margin:0;padding:6mm;background:#f5f5f5;font-family:Arial,sans-serif}.print-page{width:50mm;min-height:50mm;margin:0 auto 0.4mm auto;page-break-after:always;background:white}</style></head><body>${labelPreviewHtml}</body></html>`}
                />
              </div>
            </div>
          </Panel>
        </div>
      </Modal>
    </div>
  );
}
