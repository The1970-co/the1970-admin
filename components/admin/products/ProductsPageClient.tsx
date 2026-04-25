"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
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
import RoleGuard from "@/components/admin/RoleGuard";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

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
  stock: number;
};

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
      "Loại sản phẩm",
      "Mô tả sản phẩm",
      "Nhãn hiệu",
      "Giá trị thuộc tính 1",
      "Giá trị thuộc tính 2",
      "Mã SKU*",
      "Khối lượng",
      "Ảnh đại diện",
      "PL_Giá bán lẻ",
      "PL_Giá nhập",
      "LC_CN5_Tồn kho ban đầu*",
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
      0,
      0,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products_template");
  XLSX.writeFile(wb, "products_import_template.xlsx");
}

export default function ProductsPageClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [categories, setCategories] = useState<ProductCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
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

  const isOwner = role === "admin" || role === "owner";

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const productGroups = useMemo(() => {
    const activeCategories = categories
      .filter((item) => item.isActive)
      .map((item) => item.name)
      .filter(Boolean);

    return activeCategories.length ? activeCategories : fallbackProductGroups;
  }, [categories]);

  const canCreateProduct = hasPermission(role, "products.create");
  const canEditProduct = hasPermission(role, "products.edit");
  const canViewCost = hasPermission(role, "products.cost.view");

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

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
    void loadCategories();
    void loadProducts();
  }, []);

  useEffect(() => {
    if (!createOpen) return;

    const first = categories.find((c) => c.isActive) || categories[0];
    if (!first) return;

    if (!categoryId) {
      setCategoryId(first.id);
      setCategory(first.name);
    }
  }, [createOpen, categories, categoryId]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        String(product.slug || "").toLowerCase().includes(q) ||
        String(product.category || "").toLowerCase().includes(q) ||
        product.variants.some((variant) =>
          variant.sku.toLowerCase().includes(q)
        );

      const matchGroup = groupFilter === "ALL" || product.category === groupFilter;
      const matchStatus = statusFilter === "ALL" || product.status === statusFilter;

      return matchQuery && matchGroup && matchStatus;
    });
  }, [products, query, groupFilter, statusFilter]);

  const getVariantScopedStock = (variant: ProductItem["variants"][number]) => {
    if (isOwner) {
      return Object.values(variant.branchStocks || {}).reduce(
        (sum, v) => sum + Number(v || 0),
        0
      );
    }
    return Number(variant.branchStocks?.[currentBranchId || ""] || 0);
  };

  const activeCount = filteredProducts.filter((p) => p.status === "ACTIVE").length;
  const totalVariants = filteredProducts.reduce(
    (sum, p) => sum + p.variants.length,
    0
  );
  const lowStockCount = filteredProducts
    .flatMap((p) => p.variants)
    .filter((v) => getVariantScopedStock(v) <= 3).length;

  const catalogValue = filteredProducts.reduce(
    (sum, p) =>
      sum +
      p.variants.reduce(
        (variantSum, v) => variantSum + Number(v.price || 0) * getVariantScopedStock(v),
        0
      ),
    0
  );

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
      await loadProducts();
      setActionMessage("Đã tạo sản phẩm mới.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Không tạo được sản phẩm.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleOpenEdit = (product: ProductItem) => {
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
        defaultPrice: Number(editDefaultPrice || 0),
        ...(canViewCost
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

      setEditOpen(false);
      setEditingProductId(null);
      await loadProducts();
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
      await loadProducts();
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
  price: Number(variantPrice || 0),
  costPrice: Number(variantCostPrice || 0),
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
      await loadProducts();
      setActionMessage("Đã thêm variant mới.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Không thêm được variant.");
    } finally {
      setSavingVariant(false);
    }
  };

  const handleToggleStatus = async (productId: string) => {
    if (!canEditProduct) {
      setActionMessage("Role hiện tại không có quyền đổi trạng thái sản phẩm.");
      return;
    }

    try {
      setTogglingStatusId(productId);
      setActionMessage("");
      await toggleProductStatus(productId);
      await loadProducts();
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

      const importPrice = normalizeNumber(
        findValue(row, [
          "PL_Giá nhập",
          "pl gia nhap",
          "gia nhap",
          "PL_Giá vốn",
          "pl gia von",
        ])
      );

      const stock = normalizeNumber(
        findValue(row, [
          "LC_CN5_Tồn kho ban đầu*",
          "lc cn5 ton kho ban dau",
          "ton kho ban dau",
        ])
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
        stock ||
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
        stock,
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
      } catch {
        previewErrors.push(`${file.name}: không đọc được file.`);
      }
    }

    setImportRows(previewRows);
    setImportErrors(previewErrors);
  };

  const handleCommitImport = async () => {
    if (!selectedFiles.length) {
      setActionMessage("Chưa có file để import.");
      return;
    }

    try {
      setImporting(true);
      setActionMessage("");

      const result = await importProductsFiles(selectedFiles, true);
      await loadProducts();
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

  return (
    <div className="space-y-6 p-6">
      <SectionTitle
        title="Sản phẩm"
        description="Xem nhanh catalog theo dạng bảng, ảnh lớn hơn để lướt nhanh và nhìn rõ tồn kho theo từng chi nhánh."
        action={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => setImportOpen(true)}
              className="rounded-full"
            >
              Nhập Excel
            </Button>

            <Link
              href="/control/product-categories"
              className="inline-flex items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Danh mục
            </Link>

            <RoleGuard permission="products.create">
              <Button
                onClick={() => {
                  resetCreateForm();
                  setCreateOpen(true);
                }}
                className="rounded-full"
              >
                + Thêm sản phẩm
              </Button>
            </RoleGuard>
          </div>
        }
      />

      {!canCreateProduct || !canEditProduct || !canViewCost ? (
        <Panel className="p-4">
          <p className="text-sm text-amber-700">
            Role hiện tại: <strong>{role}</strong>. Một số hành động hoặc dữ liệu
            nhạy cảm đang bị giới hạn theo phân quyền.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sản phẩm active" value={activeCount} sub="Đang cho phép bán" />
        <StatCard
          title="Tổng variants"
          value={totalVariants}
          sub="Tất cả size / màu đang có"
        />
        <StatCard title="SKU tồn thấp" value={lowStockCount} sub="<= 3 sản phẩm" />
        <StatCard
          title="Giá trị catalog"
          value={currency(catalogValue)}
          sub="Giá bán × tồn kho"
        />
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.7fr_0.7fr_0.7fr_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, mã sản phẩm, category hoặc SKU..."
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="ALL">Tất cả nhóm</option>
            {productGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="DRAFT">DRAFT</option>
          </select>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filteredProducts.length} sản phẩm
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
          <div className="overflow-auto">
            <table className="min-w-[1750px] w-full border-collapse">
              <thead className="bg-neutral-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="border-b border-neutral-200 px-3 py-3">Ảnh</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Sản phẩm</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Loại</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Màu</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Size</th>
                  <th className="border-b border-neutral-200 px-3 py-3">SKU chính</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Giá bán</th>
                  {canViewCost ? (
                    <th className="border-b border-neutral-200 px-3 py-3">Giá nhập</th>
                  ) : null}
                  <th className="border-b border-neutral-200 px-3 py-3">Theo chi nhánh</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Tồn</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Trạng thái</th>
                  <th className="border-b border-neutral-200 px-3 py-3">Mô tả</th>
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
                        <ProductImage src={product.imageUrl} alt={product.name} />
                      </td>

                      <td className="min-w-[260px] border-b border-neutral-100 px-3 py-3">
                        <div className="font-medium text-neutral-900">{product.name}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          /{product.slug || "—"} · {product.weight || 0}g
                        </div>
                      </td>

                      <td className="whitespace-nowrap border-b border-neutral-100 px-3 py-3">
                        <Badge tone="blue">{product.category || "T-Shirt"}</Badge>
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
                          Tổng tất cả chi nhánh
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
                          <RoleGuard permission="products.edit">
                            <Button
                              variant="secondary"
                              onClick={() => handleOpenEdit(product)}
                              className="w-full"
                            >
                              Sửa
                            </Button>
                          </RoleGuard>

                          <RoleGuard permission="products.edit">
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
                          </RoleGuard>

                          <RoleGuard permission="products.edit">
                            <Button
                              variant="danger"
                              onClick={() => void handleDeleteProduct(product)}
                              disabled={deletingProductId === product.id}
                              className="w-full"
                            >
                              {deletingProductId === product.id ? "Đang xóa..." : "Xóa"}
                            </Button>
                          </RoleGuard>

                          <RoleGuard permission="products.edit">
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
                          </RoleGuard>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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
                  resetQuickCategoryForm();
                  setQuickCategoryOpen(true);
                }}
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
                  resetQuickCategoryForm();
                  setQuickCategoryOpen(true);
                }}
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
                placeholder="Dán link ảnh hoặc upload từ máy"
              />

              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                {uploadingEditImage ? "Đang upload..." : "Upload ảnh"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
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
              placeholder="590000"
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={applyPriceToAllVariants}
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
          <Button onClick={() => void handleSaveEditProduct()} disabled={savingProduct}>
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
                        <td className="px-4 py-3">{row.stock || 0}</td>
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