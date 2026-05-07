"use client";

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
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean))
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
  value?: string
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

function ProductImage({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  return (
    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-neutral-100">
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
  | "description";

type SortDirection = "asc" | "desc";

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
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return "";
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
    ])
  );
}

function detectHeaderRowIndex(sheetData: any[][]) {
  return sheetData.findIndex((row) => {
    if (!Array.isArray(row)) return false;

    const joined = row
      .map((cell) => normalizeHeader(cell))
      .join(" | ");

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
  headerRowIndex: number
): ParsedRow[] {
  const headerRow = (sheetData[headerRowIndex] || []).map((cell) =>
    String(cell ?? "").trim()
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
      0,   // Giá nhập
      0,   // CHÙA LÁNG tồn
      0,   // CHÙA LÁNG giá vốn
      0,   // XÃ ĐÀN tồn
      0,   // XÃ ĐÀN giá vốn
      0,   // QUỐC OAI tồn
      0,   // QUỐC OAI giá vốn
      0,   // THÁI HÀ tồn
      0,   // THÁI HÀ giá vốn
      0,   // CN5 tồn nếu file SAPO có
      0,   // CN5 giá vốn nếu file SAPO có
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products_template");
  XLSX.writeFile(wb, "products_import_template.xlsx");
}

function getVariantBranchStockValue(variant: ProductItem["variants"][number], branchId: string) {
  const v = variant as any;

  const directBranchStocks = v.branchStocks || v.inventoryByBranch || {};
  if (directBranchStocks && directBranchStocks[branchId] !== undefined) {
    return Number(directBranchStocks[branchId] || 0);
  }

  const inventoryItems = v.inventoryItems || v.inventory || [];
  if (Array.isArray(inventoryItems)) {
    const found = inventoryItems.find((item: any) => item.branchId === branchId);
    if (found) {
      return Number(found.availableQty ?? found.qty ?? found.quantity ?? 0);
    }
  }

  return 0;
}

type ExportProductScope = "filtered" | "all" | "current_page";
type ExportSortMode = "product_asc" | "stock_desc" | "value_desc" | "missing_cost_first";

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
  return String(name || "Sheet")
    .replace(/[\\/?*\[\]:]/g, " ")
    .trim()
    .slice(0, 31) || "Sheet";
}

function makeWorksheet(rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Không có dữ liệu": "" }]);
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
  options: EnterpriseExportOptions
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
        ])
      );
      const totalStock = Object.values(branchStocks).reduce(
        (sum, qty) => sum + Number(qty || 0),
        0
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
      if (options.columns.weight) row["Khối lượng"] = Number(product.weight || 0);
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
      return String(b["Cảnh báo"] || "").localeCompare(String(a["Cảnh báo"] || ""));
    }
    return String(a["Tên sản phẩm"] || "").localeCompare(String(b["Tên sản phẩm"] || ""));
  });

  const totalStock = rows.reduce((sum, row) => sum + Number(row["Tổng tồn"] || 0), 0);
  const totalValue = rows.reduce((sum, row) => sum + Number(row["Giá trị tồn"] || 0), 0);
  const missingCostRows = rows.filter((row) => row["Cảnh báo"] === "Thiếu giá nhập");
  const lowStockRows = rows.filter((row) => row["Cảnh báo"] === "Tồn thấp");

  const summaryRows = [
    { "Chỉ số": "Tổng sản phẩm", "Giá trị": exportProducts.length },
    { "Chỉ số": "Tổng SKU xuất file", "Giá trị": rows.length },
    { "Chỉ số": "Tổng tồn", "Giá trị": totalStock },
    { "Chỉ số": "Tổng giá trị tồn", "Giá trị": totalValue },
    { "Chỉ số": "SKU thiếu giá nhập", "Giá trị": missingCostRows.length },
    { "Chỉ số": "SKU tồn thấp", "Giá trị": lowStockRows.length },
    { "Chỉ số": "Chi nhánh xuất", "Giá trị": selectedBranches.map((b) => b.name).join(", ") || "Tất cả" },
    { "Chỉ số": "Thời gian xuất", "Giá trị": new Date().toLocaleString("vi-VN") },
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
    XLSX.utils.book_append_sheet(wb, makeWorksheet(productSummaryRows), "Theo sản phẩm");
  }

  XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), "Danh sách SKU");

  const missingCostExportRows = missingCostRows.map((row) => ({
    "Tên sản phẩm": row["Tên sản phẩm"],
    "SKU": row["SKU"],
    "Màu": row["Màu"],
    "Size": row["Size"],
    "Giá bán": row["Giá bán"],
    "Giá nhập": row["Giá nhập"],
    "Tổng tồn": row["Tổng tồn"],
    "Giá trị tồn": row["Giá trị tồn"],
  }));
  if (missingCostExportRows.length) {
    XLSX.utils.book_append_sheet(wb, makeWorksheet(missingCostExportRows), "Thiếu giá nhập");
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
            "SKU": variant.sku || "",
            "Màu": variant.color || "",
            "Size": variant.size || "",
            "Giá bán": price,
            "Giá nhập": costPrice,
            "Tồn": qty,
            "Giá trị tồn": qty * costPrice,
            "Cảnh báo": qty > 0 && costPrice <= 0 ? "Thiếu giá nhập" : qty > 0 && qty <= 3 ? "Tồn thấp" : "",
          });
        }
      }
      XLSX.utils.book_append_sheet(wb, makeWorksheet(branchRows), safeSheetName(branch.name));
    }
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  XLSX.writeFile(wb, `products_enterprise_export_${yyyy}${mm}${dd}_${hh}${mi}.xlsx`);

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

  const [role, setRole] = useState<AppRole>("admin");
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportProductScope>("filtered");
  const [exportBranchIds, setExportBranchIds] = useState<string[]>([]);
  const [exportColumns, setExportColumns] = useState<ExportColumnState>(defaultExportColumns);
  const [exportOnlyInStock, setExportOnlyInStock] = useState(false);
  const [exportOnlyMissingCost, setExportOnlyMissingCost] = useState(false);
  const [exportOnlyLowStock, setExportOnlyLowStock] = useState(false);
  const [exportIncludeSummarySheet, setExportIncludeSummarySheet] = useState(true);
  const [exportIncludeBranchSheets, setExportIncludeBranchSheets] = useState(true);
  const [exportSortMode, setExportSortMode] = useState<ExportSortMode>("product_asc");
  const [exportingProducts, setExportingProducts] = useState(false);
  const [categoryNormalizerOpen, setCategoryNormalizerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<ProductSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");


  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressLabel, setImportProgressLabel] = useState("");
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

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
  const [editBranchStocks, setEditBranchStocks] = useState<Record<string, string>>(
    {}
  );
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
    const currentUser = getCurrentUserFromStorage();
    if (currentUser?.role) {
      setRole(currentUser.role as AppRole);
    }
    setCurrentBranchId(currentUser?.branchId || null);
  }, []);

  useEffect(() => {
    const nextCategory = searchParams.get("category") || "ALL";
    setGroupFilter(nextCategory);
    setPage(1);
  }, [searchParams]);

  const isOwner = role === "admin" || role === "owner";
  const isStaffView = !isOwner;

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const productGroups = useMemo(() => {
    if (categoryOptions.length) return categoryOptions;

    const activeCategories = categories
      .filter((item) => item.isActive)
      .map((item) => item.name)
      .filter(Boolean);

    return activeCategories.length ? activeCategories : fallbackProductGroups;
  }, [categoryOptions, categories]);

  // UI permission lock theo authz.ts.
  // - products.view: được vào xem catalog.
  // - products.edit: được sửa thông tin sản phẩm.
  // - products.price.edit: được sửa giá bán.
  // - products.excel.export/import: được xuất/nhập Excel.
  // Không hardcode role tại đây để tránh lệch với file authz.
  const canCreateProduct = hasPermission(role, "products.create");
  const canEditProduct = hasPermission(role, "products.edit");
  const canEditProductPrice = hasPermission(role, "products.price.edit");
  const canToggleProductStatus = hasPermission(role, "products.status.edit");
  const canDeleteProduct = hasPermission(role, "products.delete");
  const canManageProductMasterData = hasPermission(role, "system.manage");
  const canImportProducts = hasPermission(role, "products.excel.import");
  const canExportProducts = hasPermission(role, "products.excel.export");
  const canViewCost = hasPermission(role, "products.cost.view");
  const canViewInventoryValue = hasPermission(role, "inventory.value.view");
  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const data = await getBranches();
      setBranches(data);

      setBranchStocks((prev) =>
        Object.keys(prev).length ? prev : createEmptyBranchStocks(data)
      );
      setVariantBranchStocks((prev) =>
        Object.keys(prev).length ? prev : createEmptyBranchStocks(data)
      );
      setEditBranchStocks((prev) =>
        Object.keys(prev).length ? prev : createEmptyBranchStocks(data)
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
      if (!res.ok) throw new Error("Không tải được danh mục sản phẩm từ sản phẩm.");
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
      if (!isOwner && currentBranchId) params.set("branchId", currentBranchId);

      const res = await fetch(`${API_BASE}/products/summary?${params.toString()}`);

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
        branchId: !isOwner && currentBranchId ? currentBranchId : undefined,
      });

      const nextProducts = Array.isArray(result) ? result : result?.data || [];
      setProducts(Array.isArray(nextProducts) ? nextProducts : []);
      setTotalProducts(
        Number(
          Array.isArray(result)
            ? result.length
            : result?.total ?? nextProducts.length ?? 0
        )
      );
      setPage(Number(Array.isArray(result) ? nextPage : result?.page || nextPage));
      setLimit(Number(Array.isArray(result) ? nextLimit : result?.limit || nextLimit));
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

    const first = categories.find((c) => c.isActive) || categories[0];
    if (!first) return;

    if (!categoryId) {
      setCategoryId(first.id);
      setCategory(first.name);
    }
  }, [createOpen, categories, categoryId]);

  const getProductTotalStockForSort = (product: ProductItem) => {
    return (product.variants || []).reduce((sum, variant) => {
      const branchStocks = variant.branchStocks || {};
      if (isOwner) {
        return (
          sum +
          Object.values(branchStocks).reduce(
            (branchSum, qty) => branchSum + Number(qty || 0),
            0
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
          (branchSum, variant) => branchSum + Number(variant.branchStocks?.[branch.id] || 0),
          0
        )
      );
    }, 0);
  };

  const getProductSortValue = (product: ProductItem, key: ProductSortKey) => {
    const variants = product.variants || [];
    const colors = uniqueValues(variants.map((variant) => variant.color)).join(", ");
    const sizes = uniqueValues(variants.map((variant) => variant.size)).join(", ");
    const firstSku = getMainSku(product);

    const minPrice =
      variants.length > 0
        ? Math.min(...variants.map((variant) => Number(variant.price || 0)))
        : 0;

    const minCostPrice =
      variants.length > 0
        ? Math.min(...variants.map((variant) => Number((variant as any).costPrice || 0)))
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
      default:
        return product.name || "";
    }
  };

  const handleSort = (key: ProductSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "stock" || key === "branchStock" ? "desc" : "asc");
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
  }, [products, sortKey, sortDirection, visibleBranches, currentBranchId, isOwner]);

  const getVariantScopedStock = (variant: ProductItem["variants"][number]) => {
    if (isOwner) {
      return Object.values(variant.branchStocks || {}).reduce(
        (sum, v) => sum + Number(v || 0),
        0
      );
    }
    return Number(variant.branchStocks?.[currentBranchId || ""] || 0);
  };

  const totalVariants = summary?.totalVariants ?? 0;
  const lowStockCount = summary?.lowStockSkus ?? 0;
  const catalogValue = summary?.totalInventoryValue ?? 0;

  const resetCreateForm = () => {
    const first = categories.find((c) => c.isActive) || categories[0];
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

  const validateCreateForm = () => {
    if (!hasCommaFormat(colors)) {
      setActionMessage("Màu sắc sai định dạng. Hãy nhập theo kiểu: ĐEN, TRẮNG, NÂU");
      return false;
    }

    if (!hasCommaFormat(sizes)) {
      setActionMessage("Kích thước sai định dạng. Hãy nhập theo kiểu: S, M, L, XL");
      return false;
    }

    return true;
  };

  const validateEditForm = () => {
    if (!hasCommaFormat(editColors)) {
      setActionMessage("Màu sắc sai định dạng. Hãy nhập theo kiểu: ĐEN, TRẮNG, NÂU");
      return false;
    }

    if (!hasCommaFormat(editSizes)) {
      setActionMessage("Kích thước sai định dạng. Hãy nhập theo kiểu: S, M, L, XL");
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
        defaultPrice: Number(defaultPrice || 0),
        defaultCostPrice: Number(defaultCostPrice || 0),
        colorOptions: parseCommaTokens(colors),
        sizeOptions: parseCommaTokens(sizes),
        defaultBranchStocks: Object.fromEntries(
          branches.map((branch) => [branch.id, Number(branchStocks[branch.id] || 0)])
        ),
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
      setActionMessage(err instanceof Error ? err.message : "Không tạo được sản phẩm.");
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

  const handleOpenEdit = (product: ProductItem) => {
    if (!canEditProduct) {
      setActionMessage("Role hiện tại chỉ có quyền xem sản phẩm, không được sửa.");
      return;
    }

    const uniqueColors = uniqueValues(product.variants.map((variant) => variant.color));
    const uniqueSizes = uniqueValues(product.variants.map((variant) => variant.size));

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
            (sum, variant) => sum + Number(variant.branchStocks?.[branch.id] || 0),
            0
          )
        ),
      ])
    );

    const foundCategory = categories.find(
      (item) => item.name === (product.category || "")
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
      setActionMessage("Role hiện tại chỉ có quyền xem sản phẩm, không được sửa.");
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
        ...(canViewCost && canEditProductPrice
          ? { defaultCostPrice: Number(editDefaultCostPrice || 0) }
          : {}),
        colors: parseCommaTokens(editColors),
        sizes: parseCommaTokens(editSizes),
        branchStocks: Object.fromEntries(
          branches.map((branch) => [
            branch.id,
            Number(editBranchStocks[branch.id] || 0),
          ])
        ),
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
        err instanceof Error ? err.message : "Không cập nhật được sản phẩm."
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    const ok = window.confirm(
      `Xóa sản phẩm "${product.name}"? Thao tác này sẽ xóa cả variant và tồn kho liên quan.`
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
        err instanceof Error ? err.message : "Không xóa được sản phẩm."
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleQuickCreateCategory = async () => {
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
      setActionMessage(err instanceof Error ? err.message : "Không tạo được danh mục.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleAddVariant = async () => {
    if (!canEditProduct) {
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
        costPrice: canViewCost && canEditProductPrice ? Number(variantCostPrice || 0) : 0,
        branchStocks: Object.fromEntries(
          Object.entries(variantBranchStocks).map(([key, value]) => [
            key,
            Number(value || 0),
          ])
        ),
      };

      await addVariant(activeProductId, payload);
      setVariantOpen(false);
      resetVariantForm();
      await loadProducts(page, limit);
      setActionMessage("Đã thêm variant mới.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Không thêm được variant.");
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
        err instanceof Error ? err.message : "Không đổi được trạng thái sản phẩm."
      );
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleCreateImageUpload = async (file: File | null) => {
    if (!file) return;

    try {
      setUploadingCreateImage(true);
      setActionMessage("");

      const result = await uploadProductImage(file);
      setImageUrl(result.url);
      setActionMessage("Đã upload ảnh sản phẩm.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Upload ảnh thất bại.");
    } finally {
      setUploadingCreateImage(false);
    }
  };

  const handleEditImageUpload = async (file: File | null) => {
    if (!canEditProduct) {
      setActionMessage("Role hiện tại chỉ có quyền xem sản phẩm, không được upload/sửa ảnh.");
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
      setActionMessage(err instanceof Error ? err.message : "Upload ảnh thất bại.");
    } finally {
      setUploadingEditImage(false);
    }
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
      if (category) currentCategory = category;
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
      const imageUrl = findValue(row, [
        "Ảnh đại diện",
        "anh dai dien",
        "image",
        "image url",
      ]);

      const weight = normalizeNumber(
        findValue(row, ["Khối lượng", "khoi luong", "weight"])
      );

      const retailPrice = normalizeNumber(
        findValue(row, ["PL_Giá bán lẻ", "pl gia ban le", "gia ban le"])
      );

      const importPrice = getImportPriceFromRow(row);

      const stockCL = normalizeNumber(
        findValue(row, ["LC_CN1_Tồn kho ban đầu*", "lc cn1 ton kho ban dau"])
      );

      const stockXD = normalizeNumber(
        findValue(row, ["LC_CN2_Tồn kho ban đầu*", "lc cn2 ton kho ban dau"])
      );

      const stockQO = normalizeNumber(
        findValue(row, ["LC_CN3_Tồn kho ban đầu*", "lc cn3 ton kho ban dau"])
      );

      const stockTH = normalizeNumber(
        findValue(row, ["LC_CN4_Tồn kho ban đầu*", "lc cn4 ton kho ban dau"])
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
        imageUrl;

      if (!hasAnyUsefulValue) continue;

      if (!currentProductName) {
        errors.push(`Dòng ${index + 2}: không xác định được sản phẩm gốc, đã bỏ qua`);
        continue;
      }

      if (!sku || !color || !size) {
        errors.push(`Dòng ${index + 2}: thiếu SKU hoặc màu hoặc size, đã bỏ qua`);
        continue;
      }

      previewRows.push({
        productName: currentProductName,
        category: currentCategory,
        brand: currentBrand || "The 1970",
        color,
        size,
        sku,
        weight,
        imageUrl,
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
          previewErrors.push(`${file.name}: không tìm thấy dòng tiêu đề hợp lệ.`);
          continue;
        }

        const rawRows = buildRowsFromSheetData(sheetData, headerRowIndex).filter(
          (row) =>
            Object.values(row).some(
              (value) => String(value ?? "").trim() !== ""
            )
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
          `${file.name}: không đọc được file. ${err instanceof Error ? err.message : ""
          }`
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

      const result = await importProductsFiles(selectedFiles, true, (percent) => {
        setImportProgress(percent);
        setImportProgressLabel(
          percent >= 100
            ? "Hoàn tất import."
            : percent >= 85
              ? "Đã upload xong, server đang xử lý dữ liệu..."
              : `Đang upload file Excel... ${percent}%`
        );
      });
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
        `Đã import sản phẩm. Thành công ${successCount} dòng, lỗi ${failedCount} dòng.`
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Import sản phẩm thất bại."
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
      "Xoá toàn bộ mô tả sản phẩm? Thao tác này không hoàn tác được."
    );
    if (!ok1) return;

    const ok2 = window.confirm(
      "Xác nhận lần 2: tất cả mô tả sản phẩm sẽ bị xoá trắng."
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
        err instanceof Error ? err.message : "Không xoá được mô tả sản phẩm."
      );
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
        branchId: !isOwner && currentBranchId ? currentBranchId : undefined,
      });

      const exportSource = Array.isArray(result) ? result : result?.data || [];
      const branchesForExport = visibleBranches.length ? visibleBranches : branches;

      const rowCount = buildEnterpriseProductExport(exportSource, branchesForExport, {
        scope: exportScope,
        branchIds: exportBranchIds,
        columns: exportColumns,
        onlyInStock: exportOnlyInStock,
        onlyMissingCost: exportOnlyMissingCost,
        onlyLowStock: exportOnlyLowStock,
        includeSummarySheet: exportIncludeSummarySheet,
        includeBranchSheets: exportIncludeBranchSheets,
        sortMode: exportSortMode,
      });

      setExportOpen(false);
      setActionMessage(`Đã xuất Excel enterprise ${rowCount} dòng SKU.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Xuất Excel sản phẩm thất bại."
      );
    } finally {
      setExportingProducts(false);
    }
  };

  const applyExportPreset = (
    preset: "management" | "accounting" | "stocktake" | "missing_cost" | "low_stock" | "full"
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
        (Object.keys(defaultExportColumns) as ExportColumnKey[]).map((key) => [key, true])
      ) as ExportColumnState
    );
  };

  const exportSelectedBranchCount = exportBranchIds.length || visibleBranches.length;
  const exportSelectedColumnCount = Object.values(exportColumns).filter(Boolean).length;
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
              <Button
                variant="secondary"
                onClick={() => setImportOpen(true)}
                className="rounded-full"
              >
                Nhập Excel
              </Button>
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
        <StatCard title="Tổng sản phẩm" value={totalProducts} sub="Theo bộ lọc hiện tại" />
        <StatCard
          title="Tổng variants"
          value={totalVariants}
          sub="Tất cả size / màu đang có"
        />
        <StatCard title="SKU tồn thấp" value={lowStockCount} sub="<= 3 sản phẩm" />

        {canViewInventoryValue ? (
          <StatCard
            title="Giá trị catalog"
            value={currency(catalogValue)}
            sub="Giá nhập × tồn kho"
          />
        ) : null}
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.7fr_0.7fr_0.7fr_auto]">
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
        </div>
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

      {canManageProductMasterData ? (
        <Panel className="overflow-hidden">
          <button
            type="button"
            onClick={() => setCategoryNormalizerOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            title={categoryNormalizerOpen ? "Thu gọn chuẩn hoá danh mục" : "Mở chuẩn hoá danh mục"}
          >
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Chuẩn hoá danh mục sản phẩm
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Gộp danh mục dư thừa khi cần. Mặc định thu gọn để bảng sản phẩm gọn hơn.
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
            <p className="text-sm text-neutral-500">Không có sản phẩm phù hợp.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {filteredProducts.map((product) => {
                const variants = product.variants || [];
                const productStock = variants.reduce(
                  (sum, v) => sum + getVariantScopedStock(v),
                  0
                );
                const branchBadges = visibleBranches.map((branch) => ({
                  id: branch.id,
                  name: branch.name,
                  qty: variants.reduce(
                    (s, v) => s + Number(v.branchStocks?.[branch.id] || 0),
                    0
                  ),
                }));
                const minPrice =
                  variants.length > 0
                    ? Math.min(...variants.map((v) => Number(v.price || 0)))
                    : 0;
                const minCostPrice =
                  variants.length > 0
                    ? Math.min(...variants.map((v) => Number((v as any).costPrice || 0)))
                    : 0;
                const colorsList = uniqueValues(variants.map((variant) => variant.color));
                const sizesList = uniqueValues(variants.map((variant) => variant.size));

                return (
                  <div
                    key={product.id}
                    className="rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => openProductDetail(product)}
                        className="shrink-0 rounded-2xl transition hover:opacity-80"
                      >
                        <ProductImage src={product.imageUrl} alt={product.name} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openProductDetail(product)}
                          className="block w-full truncate text-left text-[16px] font-semibold leading-6 text-neutral-950"
                        >
                          {product.name}
                        </button>

                        <div className="mt-1 truncate text-sm text-neutral-500">
                          /{product.slug || getMainSku(product)} · {product.weight || 0}g
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={toneForStatus(product.status)}>
                            {product.status || "DRAFT"}
                          </Badge>
                          <Badge tone="blue">{variants.length} SKU</Badge>
                          <Badge tone={productStock <= 3 ? "amber" : "green"}>
                            {productStock} tồn
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-50 p-3 text-sm">
                      <div>
                        <p className="text-neutral-500">Giá bán</p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {currency(minPrice)}
                        </p>
                      </div>
                      {canViewCost ? (
                        <div>
                          <p className="text-neutral-500">Giá nhập</p>
                          <p className="mt-1 font-semibold text-neutral-950">
                            {currency(minCostPrice)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-neutral-500">SKU chính</p>
                          <p className="mt-1 font-semibold text-neutral-950">
                            {getMainSku(product)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {colorsList.slice(0, 4).map((color) => (
                        <Badge key={color} tone="gray">
                          {color}
                        </Badge>
                      ))}
                      {sizesList.slice(0, 5).map((size) => (
                        <Badge key={size} tone="gray">
                          {size}
                        </Badge>
                      ))}
                    </div>

                    {branchBadges.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {branchBadges.slice(0, 6).map((item) => (
                          <Badge key={item.id} tone={item.qty <= 3 ? "amber" : "green"}>
                            {item.name}: {item.qty}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <Button
                        onClick={() => openProductDetail(product)}
                        className="w-full rounded-2xl"
                      >
                        Chi tiết
                      </Button>

                      {canEditProduct ? (
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenEdit(product)}
                          className="rounded-2xl px-5"
                        >
                          Sửa
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {canEditProduct ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setActiveProductId(product.id);
                            resetVariantForm();
                            setVariantOpen(true);
                          }}
                          className="w-full rounded-2xl"
                        >
                          + Variant
                        </Button>
                      ) : null}

                      {canToggleProductStatus ? (
                        <Button
                          variant={product.status === "ACTIVE" ? "danger" : "success"}
                          onClick={() => void handleToggleStatus(product.id)}
                          disabled={togglingStatusId === product.id}
                          className="w-full rounded-2xl"
                        >
                          {togglingStatusId === product.id
                            ? "Đang cập nhật..."
                            : product.status === "ACTIVE"
                              ? "Ngừng bán"
                              : "Kích hoạt"}
                        </Button>
                      ) : null}
                    </div>

                    {canDeleteProduct ? (
                      <Button
                        variant="danger"
                        onClick={() => void handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                        className="mt-2 w-full rounded-2xl"
                      >
                        {deletingProductId === product.id ? "Đang xóa..." : "Xóa sản phẩm"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}

              <div className="rounded-[24px] border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="text-sm text-neutral-500">
                  Trang {page} / {Math.max(1, Math.ceil(totalProducts / limit))} · {totalProducts} sản phẩm
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
                    disabled={page >= Math.max(1, Math.ceil(totalProducts / limit)) || loading}
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(Math.max(1, Math.ceil(totalProducts / limit)), prev + 1)
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
                  <th className="border-b border-neutral-200 px-3 py-3">Ảnh</th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Sản phẩm" active={sortKey === "name"} direction={sortDirection} onClick={() => handleSort("name")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Loại" active={sortKey === "category"} direction={sortDirection} onClick={() => handleSort("category")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Màu" active={sortKey === "color"} direction={sortDirection} onClick={() => handleSort("color")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Size" active={sortKey === "size"} direction={sortDirection} onClick={() => handleSort("size")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="SKU chính" active={sortKey === "sku"} direction={sortDirection} onClick={() => handleSort("sku")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Giá bán" active={sortKey === "price"} direction={sortDirection} onClick={() => handleSort("price")} /></th>
                  {canViewCost ? (
                    <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Giá nhập" active={sortKey === "costPrice"} direction={sortDirection} onClick={() => handleSort("costPrice")} /></th>
                  ) : null}
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Theo chi nhánh" active={sortKey === "branchStock"} direction={sortDirection} onClick={() => handleSort("branchStock")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Tồn" active={sortKey === "stock"} direction={sortDirection} onClick={() => handleSort("stock")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Trạng thái" active={sortKey === "status"} direction={sortDirection} onClick={() => handleSort("status")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3"><SortButton label="Mô tả" active={sortKey === "description"} direction={sortDirection} onClick={() => handleSort("description")} /></th>
                  <th className="border-b border-neutral-200 px-3 py-3">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const productStock = product.variants.reduce(
                    (sum, v) => sum + getVariantScopedStock(v),
                    0
                  );

                  const branchBadges = visibleBranches.map((branch) => ({
                    id: branch.id,
                    name: branch.name,
                    qty: product.variants.reduce(
                      (s, v) => s + Number(v.branchStocks?.[branch.id] || 0),
                      0
                    ),
                  }));

                  const minPrice =
                    product.variants.length > 0
                      ? Math.min(...product.variants.map((v) => Number(v.price || 0)))
                      : 0;

                  const minCostPrice =
                    product.variants.length > 0
                      ? Math.min(...product.variants.map((v) => Number(v.costPrice || 0)))
                      : 0;

                  const colorsList = uniqueValues(
                    product.variants.map((variant) => variant.color)
                  );
                  const sizesList = uniqueValues(
                    product.variants.map((variant) => variant.size)
                  );

                  return (
                    <tr
                      key={product.id}
                      className="align-top bg-white text-sm hover:bg-neutral-50"
                    >
                      <td className="border-b border-neutral-100 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openProductDetail(product)}
                          className="block rounded-2xl transition hover:opacity-80"
                          title="Mở chi tiết sản phẩm trong tab mới"
                        >
                          <ProductImage src={product.imageUrl} alt={product.name} />
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
                          <Link href="/control/product-categories" className="inline-flex" title="Sửa danh mục sản phẩm">
                            <Badge tone="blue">{product.category || "Chưa có danh mục"}</Badge>
                          </Link>
                        ) : (
                          <Badge tone="blue">{product.category || "Chưa có danh mục"}</Badge>
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
                        <div className="font-medium text-neutral-900">{productStock}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {isOwner ? "Tổng tất cả chi nhánh" : "Tồn chi nhánh của bạn"}
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

                      <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => openProductDetail(product)}
                            className="w-full"
                          >
                            Chi tiết
                          </Button>

                          {canEditProduct ? (
                            <Button
                              variant="secondary"
                              onClick={() => handleOpenEdit(product)}
                              className="w-full"
                            >
                              Sửa nhanh
                            </Button>
                          ) : null}

                          {canEditProduct ? (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setActiveProductId(product.id);
                                resetVariantForm();
                                setVariantOpen(true);
                              }}
                              className="w-full"
                            >
                              + Variant
                            </Button>
                          ) : null}

                          {canDeleteProduct ? (
                            <Button
                              variant="danger"
                              onClick={() => void handleDeleteProduct(product)}
                              disabled={deletingProductId === product.id}
                              className="w-full"
                            >
                              {deletingProductId === product.id ? "Đang xóa..." : "Xóa"}
                            </Button>
                          ) : null}

                          {canToggleProductStatus ? (
                            <Button
                              variant={product.status === "ACTIVE" ? "danger" : "success"}
                              onClick={() => void handleToggleStatus(product.id)}
                              disabled={togglingStatusId === product.id}
                              className="w-full"
                            >
                              {togglingStatusId === product.id
                                ? "Đang cập nhật..."
                                : product.status === "ACTIVE"
                                  ? "Ngừng bán"
                                  : "Kích hoạt"}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
              <div className="text-neutral-500">
                Trang {page} / {Math.max(1, Math.ceil(totalProducts / limit))} · {totalProducts} sản phẩm
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
                    const maxPage = Math.max(1, Math.ceil(totalProducts / limit));
                    const nextPage = Math.min(
                      maxPage,
                      Math.max(1, Number(e.target.value || 1))
                    );
                    setPage(nextPage);
                  }}
                  className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-center outline-none"
                />

                {/* tiến */}
                <Button
                  variant="secondary"
                  disabled={page >= Math.max(1, Math.ceil(totalProducts / limit)) || loading}
                  onClick={() =>
                    setPage((prev) =>
                      Math.min(Math.max(1, Math.ceil(totalProducts / limit)), prev + 1)
                    )
                  }
                >
                  Sau
                </Button>

                {/* về cuối */}
                <Button
                  variant="secondary"
                  disabled={page >= Math.max(1, Math.ceil(totalProducts / limit)) || loading}
                  onClick={() => setPage(Math.max(1, Math.ceil(totalProducts / limit)))}
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
              <p className="text-sm font-semibold text-neutral-900">Phạm vi sản phẩm</p>
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
              <p className="text-sm font-semibold text-neutral-900">Bộ lọc nhanh</p>
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
              <p className="text-sm font-semibold text-neutral-900">Sheet & sắp xếp</p>
              <div className="mt-3 space-y-2 text-sm text-neutral-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportIncludeSummarySheet}
                    onChange={(e) => setExportIncludeSummarySheet(e.target.checked)}
                  />
                  Có sheet tổng quan
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportIncludeBranchSheets}
                    onChange={(e) => setExportIncludeBranchSheets(e.target.checked)}
                  />
                  Mỗi chi nhánh 1 sheet
                </label>
                <select
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-3 py-2 outline-none"
                  value={exportSortMode}
                  onChange={(e) => setExportSortMode(e.target.value as ExportSortMode)}
                >
                  <option value="product_asc">Sắp xếp theo tên sản phẩm</option>
                  <option value="stock_desc">Tồn nhiều nhất</option>
                  <option value="value_desc">Giá trị tồn cao nhất</option>
                  <option value="missing_cost_first">Thiếu giá nhập lên đầu</option>
                </select>
              </div>
            </Panel>
          </div>

          <Panel className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Preset xuất nhanh</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Chọn cấu hình có sẵn để khỏi tick thủ công từng cột khi xuất Excel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => applyExportPreset("management")}>Quản lý</Button>
                <Button variant="secondary" onClick={() => applyExportPreset("accounting")}>Kế toán tồn</Button>
                <Button variant="secondary" onClick={() => applyExportPreset("stocktake")}>Kiểm kho</Button>
                <Button variant="secondary" onClick={() => applyExportPreset("missing_cost")}>Thiếu giá nhập</Button>
                <Button variant="secondary" onClick={() => applyExportPreset("low_stock")}>Tồn thấp</Button>
                <Button variant="secondary" onClick={() => applyExportPreset("full")}>Full SAPO</Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Phạm vi</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{exportScopeLabel}</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Chi nhánh</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{exportSelectedBranchCount} chi nhánh</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Cột dữ liệu</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{exportSelectedColumnCount} cột</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Lọc thêm</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {exportFilterLabels.length ? exportFilterLabels.join(", ") : "Không"}
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Chọn chi nhánh</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Không chọn chi nhánh nào = xuất tất cả chi nhánh đang có quyền xem.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setExportBranchIds(visibleBranches.map((branch) => branch.id))}
                >
                  Chọn tất cả
                </Button>
                <Button variant="secondary" onClick={() => setExportBranchIds([])}>
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
                          : prev.filter((id) => id !== branch.id)
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
                <p className="text-sm font-semibold text-neutral-900">Cột dữ liệu</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Chọn thông tin cần đưa vào sheet Danh sách SKU.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setExportColumns(defaultExportColumns)}>
                  Mặc định
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setExportColumns(
                      Object.fromEntries(
                        (Object.keys(defaultExportColumns) as ExportColumnKey[]).map((key) => [key, true])
                      ) as ExportColumnState
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
                        (Object.keys(defaultExportColumns) as ExportColumnKey[]).map((key) => [key, false])
                      ) as ExportColumnState
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
            <Button onClick={() => void handleExportProductsExcel()} disabled={exportingProducts || !canExportProducts}>
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
                  const found = categories.find((item) => item.id === nextId);
                  setCategoryId(nextId);
                  setCategory(found?.name || "");
                }}
              >
                <option value="">Chọn danh mục</option>
                {categories.map((item) => (
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
              <TokenPreview value={colors} placeholder="Ví dụ: ĐEN, TRẮNG, NÂU" />
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
          <Button onClick={() => void handleCreateProduct()} disabled={savingProduct}>
            {savingProduct ? "Đang tạo..." : "Tạo sản phẩm"}
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
                  const found = categories.find((item) => item.id === nextId);
                  setEditCategoryId(nextId);
                  setEditCategory(found?.name || "");
                }}
              >
                <option value="">Chọn danh mục</option>
                {categories.map((item) => (
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
                {canEditProduct ? (uploadingEditImage ? "Đang upload..." : "Upload ảnh") : "Không có quyền upload"}
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
                disabled={!canEditProductPrice}
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
              <TokenPreview value={editColors} placeholder="Ví dụ: ĐEN, TRẮNG, NÂU" />
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
              <TokenPreview value={editSizes} placeholder="Ví dụ: S, M, L, XL" />
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
          <Button onClick={() => void handleSaveEditProduct()} disabled={savingProduct || !canEditProduct}>
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
          <Button variant="secondary" onClick={() => setQuickCategoryOpen(false)}>
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
          <Button onClick={() => void handleAddVariant()} disabled={savingVariant}>
            {savingVariant ? "Đang thêm..." : "Thêm variant"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Nhập sản phẩm từ Excel"
        maxWidthClass="max-w-6xl"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-500">
              Import thông minh theo file Excel. Hiện ảnh sản phẩm dùng cột
              <strong> Image URL </strong>
              chứ chưa phải upload file ảnh trực tiếp.
            </div>

            <Button variant="secondary" onClick={downloadProductTemplate}>
              Tải file mẫu
            </Button>
          </div>

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
                      <th className="px-4 py-3">Ảnh</th>
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
                        <td className="px-4 py-3">{currency(row.retailPrice || 0)}</td>
                        <td className="px-4 py-3">{currency(row.importPrice || 0)}</td>
                        <td className="px-4 py-3 text-xs space-y-1">
                          <div>CL: {row.stockCL || 0}</div>
                          <div>XD: {row.stockXD || 0}</div>
                          <div>QO: {row.stockQO || 0}</div>
                          <div>TH: {row.stockTH || 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          {row.imageUrl ? (
                            <a
                              href={row.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              Link ảnh
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}