"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addVariant,
  getBranches,
  getProducts,
  toggleProductStatus,
  updateProduct,
  uploadProductImage,
  type AddVariantPayload,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import {
  getInventoryMovementsByProduct,
  type InventoryMovement,
} from "@/lib/inventory-api";
import {
  getCategories,
  type ProductCategoryItem,
} from "@/lib/product-categories-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import { addWorkspaceTab } from "@/lib/workspace-tabs";

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

function currency(n?: number | null) {
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

function parseCommaTokens(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean)),
  );
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

function getUploadedImageUrl(result: any) {
  if (typeof result === "string") return result;
  return String(
    result?.url ||
      result?.imageUrl ||
      result?.secure_url ||
      result?.secureUrl ||
      result?.data?.url ||
      result?.data?.imageUrl ||
      result?.file?.url ||
      "",
  ).trim();
}


function loadImageForResize(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không đọc được ảnh để nén."));
    };

    image.src = objectUrl;
  });
}

async function resizeImageBeforeUpload(file: File) {
  const isImage = file.type.startsWith("image/");
  if (!isImage) return file;

  const maxBytes = 2.8 * 1024 * 1024;
  const maxSide = 1600;

  if (file.size <= maxBytes && !file.type.includes("png")) {
    return file;
  }

  const image = await loadImageForResize(file);
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

  let quality = 0.82;
  let blob = await toBlob(quality);

  while (blob && blob.size > maxBytes && quality > 0.5) {
    quality -= 0.08;
    blob = await toBlob(quality);
  }

  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

type ColorImageMap = Record<string, string>;

function normalizeColorKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeColorImages(product: any): ColorImageMap {
  const output: ColorImageMap = {};
  const raw =
    product?.colorImages || product?.imagesByColor || product?.colorImageMap;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([key, value]) => {
      const colorKey = normalizeColorKey(key);
      const image = String(value || "").trim();
      if (colorKey && image) output[colorKey] = image;
    });
  }

  if (Array.isArray(product?.variants)) {
    product.variants.forEach((variant: any) => {
      const colorKey = normalizeColorKey(variant?.color);
      const image = String(variant?.imageUrl || variant?.image || "").trim();
      if (colorKey && image && !output[colorKey]) output[colorKey] = image;
    });
  }

  return output;
}

const PRODUCT_COLOR_IMAGE_CACHE_KEY = "the1970.products.colorImages.v1";

function normalizeProductCacheKey(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
}

function getProductCacheKeys(product?: any) {
  if (!product) return [] as string[];
  return Array.from(
    new Set(
      [product?.id, product?.slug, product?.skuCode, product?.code, product?.name]
        .map((value) => normalizeProductCacheKey(value))
        .filter(Boolean),
    ),
  );
}

function writeProductColorImagesToCache(product: any, colorImages: ColorImageMap) {
  if (typeof window === "undefined" || !product) return;
  const normalized = Object.fromEntries(
    Object.entries(colorImages || {})
      .map(([color, image]) => [normalizeColorKey(color), String(image || "").trim()])
      .filter(([color, image]) => Boolean(color && image)),
  ) as ColorImageMap;

  if (!Object.keys(normalized).length) return;

  try {
    const raw = window.localStorage.getItem(PRODUCT_COLOR_IMAGE_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    const nextCache = cache && typeof cache === "object" ? cache : {};
    const entry = {
      productId: String(product?.id || ""),
      slug: String(product?.slug || ""),
      name: String(product?.name || ""),
      colorImages: normalized,
      updatedAt: Date.now(),
    };

    getProductCacheKeys(product).forEach((key) => {
      nextCache[key] = entry;
    });

    window.localStorage.setItem(PRODUCT_COLOR_IMAGE_CACHE_KEY, JSON.stringify(nextCache));
  } catch {
    // Bỏ qua lỗi localStorage để không ảnh hưởng flow lưu sản phẩm.
  }
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
    if (permission === "inventory.logs.view") return Boolean(row.canViewStock);
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

function createEmptyBranchStocks(branches: BranchItem[]) {
  return Object.fromEntries(branches.map((branch) => [branch.id, "0"]));
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
  onClick?: () => void | Promise<void>;
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
  return (
    <button
      type={type}
      onClick={() => void onClick?.()}
      disabled={disabled}
      className={`${base} ${tone} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
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

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 ${props.className || ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[110px] w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 ${props.className || ""}`}
    />
  );
}

function TokenPreview({ value }: { value: string }) {
  const valid = hasCommaFormat(value);
  const tokens = parseCommaTokens(value);
  if (!value.trim())
    return <p className="text-xs text-neutral-400">Chưa có dữ liệu.</p>;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {valid ? (
          tokens.map((token) => (
            <Badge key={token} tone="green">
              {token}
            </Badge>
          ))
        ) : (
          <Badge tone="red">{value}</Badge>
        )}
      </div>
      {!valid ? (
        <p className="text-xs text-red-600">
          Sai định dạng. Hãy nhập kiểu: S, M, L hoặc ĐEN, TRẮNG.
        </p>
      ) : null}
    </div>
  );
}

async function fetchProductById(productId: string): Promise<ProductItem> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(
    `${API_BASE}/products/${encodeURIComponent(productId)}`,
    {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (res.ok) return await res.json();

  const fallback = await (getProducts as any)({
    page: 1,
    limit: 100,
    q: productId,
  });
  const rows = Array.isArray(fallback) ? fallback : fallback?.data || [];
  const found = rows.find(
    (item: ProductItem) => item.id === productId || item.slug === productId,
  );
  if (found) return found;

  const json = await res.json().catch(() => null);
  throw new Error(json?.message || "Không tải được chi tiết sản phẩm.");
}

type InventoryProductStockRow = {
  variantId: string;
  branchId: string;
  availableQty: number;
  reservedQty?: number;
  incomingQty?: number;
};

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("the1970_token") ||
    "";

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeInventoryRows(raw: any): InventoryProductStockRow[] {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

  return rows
    .map((item: any) => ({
      variantId: String(item.variantId || item.productVariantId || ""),
      branchId: String(item.branchId || ""),
      availableQty: Number(item.availableQty ?? item.qty ?? item.stock ?? 0),
      reservedQty: Number(item.reservedQty ?? 0),
      incomingQty: Number(item.incomingQty ?? 0),
    }))
    .filter(
      (item: InventoryProductStockRow) => item.variantId && item.branchId,
    );
}

async function fetchInventoryByProduct(
  productId: string,
): Promise<InventoryProductStockRow[]> {
  const endpoints = [
    `${API_BASE}/inventory/by-product/${encodeURIComponent(productId)}`,
    `${API_BASE}/inventory/product/${encodeURIComponent(productId)}`,
    `${API_BASE}/inventory?productId=${encodeURIComponent(productId)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          ...authHeaders(),
        },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const json = await res.json().catch(() => null);
      const rows = normalizeInventoryRows(json);
      if (rows.length) return rows;
    } catch {
      // thử endpoint tiếp theo
    }
  }

  return [];
}

function inventoryRowsFromProduct(
  product: ProductItem | null,
): InventoryProductStockRow[] {
  if (!product) return [];

  return (product.variants || []).flatMap((variant: any) => {
    const inventoryItems = Array.isArray(variant.inventoryItems)
      ? variant.inventoryItems
      : Array.isArray(variant.inventoryLayerItems)
        ? variant.inventoryLayerItems
        : Array.isArray(variant.inventoryLayers)
          ? variant.inventoryLayers
          : [];

    if (inventoryItems.length) {
      return inventoryItems
        .map((item: any) => ({
          variantId: String(variant.id || item.variantId || ""),
          branchId: String(item.branchId || ""),
          availableQty: Number(item.availableQty ?? 0),
          reservedQty: Number(item.reservedQty ?? 0),
          incomingQty: Number(item.incomingQty ?? 0),
        }))
        .filter(
          (item: InventoryProductStockRow) => item.variantId && item.branchId,
        );
    }

    const branchStocks =
      variant.inventoryByBranch || variant.branchStocks || {};
    return Object.entries(branchStocks).map(([branchId, qty]) => ({
      variantId: String(variant.id || ""),
      branchId: String(branchId),
      availableQty: Number(qty || 0),
      reservedQty: Number(variant.reservedQtyByBranch?.[branchId] || 0),
      incomingQty: Number(variant.incomingQtyByBranch?.[branchId] || 0),
    }));
  });
}

function filterInventoryRowsForProduct(
  product: ProductItem | null,
  rows: InventoryProductStockRow[],
): InventoryProductStockRow[] {
  if (!product) return [];

  const variantIds = new Set(
    (product.variants || [])
      .map((variant: any) => String(variant.id || ""))
      .filter(Boolean),
  );

  if (!variantIds.size) return [];

  return rows.filter((row) => variantIds.has(String(row.variantId || "")));
}

function getProductInventoryRows(
  product: ProductItem | null,
  apiRows: InventoryProductStockRow[],
): InventoryProductStockRow[] {
  const filteredApiRows = filterInventoryRowsForProduct(product, apiRows);
  if (filteredApiRows.length) return filteredApiRows;

  return filterInventoryRowsForProduct(
    product,
    inventoryRowsFromProduct(product),
  );
}


function movementTypeLabel(type?: string) {
  const key = String(type || "").trim().toUpperCase();
  const labels: Record<string, string> = {
    IMPORT: "Nhập kho",
    SALE: "Bán hàng",
    CANCEL: "Huỷ đơn / hoàn tồn",
    RETURN: "Khách trả hàng",
    ADJUSTMENT: "Điều chỉnh kho",
    RESERVE: "Giữ hàng",
    RELEASE: "Xả giữ hàng",
    STOCKTAKE: "Kiểm kho",
    TRANSFER_IN: "Nhận chuyển kho",
    TRANSFER_OUT: "Xuất chuyển kho",
  };
  return labels[key] || key || "Biến động kho";
}

function movementToneByQty(qty: number): "gray" | "green" | "amber" | "red" | "blue" {
  if (qty > 0) return "green";
  if (qty < 0) return "red";
  return "amber";
}

function formatMovementTime(row: InventoryMovement) {
  if (row.createdAtText) return row.createdAtText;
  const raw = row.createdAtIso || row.createdAt;
  if (!raw) return "Chưa ghi nhận";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Chưa ghi nhận";
  return date.toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMovementActor(row: InventoryMovement) {
  return row.actorName || row.createdByName || row.actorEmail || row.createdByEmail || "Chưa ghi nhận";
}

function getMovementRefLabel(row: InventoryMovement) {
  const refType = String(row.refType || "").toUpperCase();
  const refLabels: Record<string, string> = {
    ORDER: "Đơn hàng",
    PURCHASE_RECEIPT: "Phiếu nhập",
    STOCKTAKE: "Kiểm kho",
    STOCKTAKE_SESSION: "Kiểm kho",
    INVENTORY_TRANSFER: "Chuyển kho",
    TRANSFER: "Chuyển kho",
    INVENTORY: "Điều chỉnh kho",
  };
  const label = refLabels[refType] || row.refType || "Chứng từ";
  const code = row.refCode || row.refId;
  return code ? `${label} · ${code}` : label;
}

function ProductInventoryHistoryPanel({
  rows,
  branches,
  compact = false,
  scopeLabel = "chi nhánh được phép xem",
}: {
  rows: InventoryMovement[];
  branches: BranchItem[];
  compact?: boolean;
  scopeLabel?: string;
}) {
  const branchName = (branchId?: string | null) =>
    branches.find((branch) => String(branch.id) === String(branchId))?.name ||
    branchId ||
    "—";

  const totalIn = rows
    .filter((row) => Number(row.qty || 0) > 0)
    .reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const totalOut = Math.abs(
    rows
      .filter((row) => Number(row.qty || 0) < 0)
      .reduce((sum, row) => sum + Number(row.qty || 0), 0),
  );
  const historyCutoff = Date.now() - 40 * 24 * 60 * 60 * 1000;
  const visibleRows = rows.filter((row) => {
    const raw = row.createdAtIso || row.createdAt;
    if (!raw) return true;
    const createdAt = new Date(raw).getTime();
    return Number.isNaN(createdAt) || createdAt >= historyCutoff;
  });

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-neutral-950">
            Lịch sử kho của sản phẩm
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Hiển thị lịch sử 40 ngày gần nhất của sản phẩm này trong {scopeLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="gray">{rows.length} dòng</Badge>
          <Badge tone="green">+{totalIn}</Badge>
          <Badge tone="red">-{totalOut}</Badge>
        </div>
      </div>

      {!visibleRows.length ? (
        <div className="p-4 text-sm text-neutral-500">
          Chưa có lịch sử kho cho sản phẩm này.
        </div>
      ) : compact ? (
        <div className="divide-y divide-neutral-100">
          {visibleRows.map((row) => {
            const qty = Number(row.qty || 0);
            return (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={movementToneByQty(qty)}>
                        {movementTypeLabel(row.type)}
                      </Badge>
                      <span className="text-xs text-neutral-500">
                        {branchName(row.branchId)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-neutral-950">
                      {row.sku || "SKU"} · {row.color || "—"} / {row.size || "—"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatMovementTime(row)} · {getMovementActor(row)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {getMovementRefLabel(row)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${qty >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {qty > 0 ? `+${qty}` : qty}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase text-neutral-500">
              <tr>
                <th className="border-b px-4 py-3">Thời gian</th>
                <th className="border-b px-4 py-3">Chi nhánh</th>
                <th className="border-b px-4 py-3">SKU / phân loại</th>
                <th className="border-b px-4 py-3">Loại</th>
                <th className="border-b px-4 py-3">SL</th>
                <th className="border-b px-4 py-3">Tồn trước → sau</th>
                <th className="border-b px-4 py-3">Chứng từ</th>
                <th className="border-b px-4 py-3">Nhân viên</th>
                <th className="border-b px-4 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const qty = Number(row.qty || 0);
                return (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="border-b px-4 py-3 whitespace-nowrap">
                      {formatMovementTime(row)}
                    </td>
                    <td className="border-b px-4 py-3 font-medium">
                      {branchName(row.branchId)}
                    </td>
                    <td className="border-b px-4 py-3">
                      <p className="font-medium text-neutral-950">
                        {row.sku || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {row.color || "—"} / {row.size || "—"}
                      </p>
                    </td>
                    <td className="border-b px-4 py-3">
                      <Badge tone={movementToneByQty(qty)}>
                        {movementTypeLabel(row.type)}
                      </Badge>
                    </td>
                    <td className="border-b px-4 py-3">
                      <span
                        className={`font-semibold ${qty >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {qty > 0 ? `+${qty}` : qty}
                      </span>
                    </td>
                    <td className="border-b px-4 py-3 text-neutral-600">
                      {row.beforeQty === null || row.beforeQty === undefined
                        ? "—"
                        : row.beforeQty} {" → "}
                      {row.afterQty === null || row.afterQty === undefined
                        ? "—"
                        : row.afterQty}
                    </td>
                    <td className="border-b px-4 py-3">
                      {getMovementRefLabel(row)}
                    </td>
                    <td className="border-b px-4 py-3">
                      {getMovementActor(row)}
                    </td>
                    <td className="border-b px-4 py-3 text-neutral-600">
                      {row.note || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function ProductDetailPageClient({
  productId,
}: {
  productId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState<AppRole>("retail-staff");
  const [currentUser, setCurrentUser] =
    useState<CurrentUserPermissionProfile | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [categories, setCategories] = useState<ProductCategoryItem[]>([]);
  const [product, setProduct] = useState<ProductItem | null>(null);
  const [inventoryRows, setInventoryRows] = useState<
    InventoryProductStockRow[]
  >([]);
  const [inventoryMovementRows, setInventoryMovementRows] = useState<
    InventoryMovement[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [category, setCategory] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("The 1970");
  const [weight, setWeight] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [colorImages, setColorImages] = useState<ColorImageMap>({});
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [defaultCostPrice, setDefaultCostPrice] = useState("");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [branchStocks, setBranchStocks] = useState<Record<string, string>>({});
  const [applyPriceToAllVariants, setApplyPriceToAllVariants] = useState(true);

  const [variantColor, setVariantColor] = useState("");
  const [variantSize, setVariantSize] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantCostPrice, setVariantCostPrice] = useState("");
  const [variantBranchStocks, setVariantBranchStocks] = useState<
    Record<string, string>
  >({});
  const [variantSaving, setVariantSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingColor, setUploadingColor] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const isOwner = isOwnerOrAdminUser(currentUser);
  const canViewProduct = hasProductInventoryPermission(
    currentUser,
    role,
    "products.view",
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
  const canCreateProductVariant = hasProductInventoryPermission(
    currentUser,
    role,
    "products.variant.create",
  );
  const canToggleProductStatus = hasProductInventoryPermission(
    currentUser,
    role,
    "products.status.edit",
  );
  const canViewInventory = hasProductInventoryPermission(
    currentUser,
    role,
    "inventory.view",
  );
  const canViewInventoryLogs = hasProductInventoryPermission(
    currentUser,
    role,
    "inventory.logs.view",
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
  const canViewInventoryValue = hasProductInventoryPermission(
    currentUser,
    role,
    "inventory.value.view",
  );

  const getAvailableQty = (variantId?: string, branchId?: string) => {
    if (!variantId || !branchId) return 0;

    const inventoryMatch = inventoryRows.find(
      (row) =>
        String(row.variantId) === String(variantId) &&
        String(row.branchId) === String(branchId),
    );

    if (inventoryMatch) {
      return Number(inventoryMatch.availableQty || 0);
    }

    const variant = (product?.variants || []).find(
      (v: any) => String(v.id) === String(variantId),
    );

    if (!variant) return 0;

    const vAny = variant as any;

    const branchStocks =
      vAny.branchStocks || vAny.inventoryByBranch || vAny.stockByBranch || {};

    return Number(branchStocks?.[branchId] || 0);
  };

  const getVariantTotalQty = (variantId?: string) => {
    if (!variantId) return 0;
    return inventoryRows
      .filter((row) => row.variantId === variantId)
      .reduce((sum, row) => sum + Number(row.availableQty || 0), 0);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [branchData, categoryData, productData, inventoryData, movementData] =
        await Promise.all([
          getBranches(),
          getCategories().catch(() => []),
          fetchProductById(productId),
          fetchInventoryByProduct(productId),
          getInventoryMovementsByProduct(productId, 1000).catch(() => []),
        ]);

      const nextBranches = Array.isArray(branchData) ? branchData : [];
      const nextCategories = sortCategoriesForDisplay(
        Array.isArray(categoryData) ? categoryData : [],
      );
      const nextInventoryRows = getProductInventoryRows(
        productData,
        inventoryData,
      );

      setBranches(nextBranches);
      setCategories(nextCategories);
      setProduct(productData);
      setInventoryRows(nextInventoryRows);
      setInventoryMovementRows(Array.isArray(movementData) ? movementData : []);
      setVariantBranchStocks(createEmptyBranchStocks(nextBranches));

      hydrateForm(productData, nextBranches, nextCategories, nextInventoryRows);

      addWorkspaceTab({
        id: productData.id,
        title: productData.name || productData.slug || "Sản phẩm",
        href: `/products/${encodeURIComponent(productData.id)}`,
        type: "product",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  const hydrateForm = (
    item: ProductItem,
    branchRows: BranchItem[],
    categoryRows: ProductCategoryItem[],
    stockRows: InventoryProductStockRow[] = inventoryRowsFromProduct(item),
  ) => {
    const uniqueColors = uniqueValues(
      item.variants?.map((variant) => variant.color) || [],
    );
    const uniqueSizes = uniqueValues(
      item.variants?.map((variant) => variant.size) || [],
    );
    const minPrice = item.variants?.length
      ? Math.min(...item.variants.map((v) => Number(v.price || 0)))
      : 0;
    const minCostPrice = item.variants?.length
      ? Math.min(...item.variants.map((v) => Number(v.costPrice || 0)))
      : 0;
    const foundCategory = categoryRows.find(
      (c) => c.name === (item.category || ""),
    );
    const aggregatedStocks = Object.fromEntries(
      branchRows.map((branch) => [
        branch.id,
        String(
          stockRows.reduce(
            (sum, row) =>
              row.branchId === branch.id
                ? sum + Number(row.availableQty || 0)
                : sum,
            0,
          ),
        ),
      ]),
    );

    setName(item.name || "");
    setSkuCode(item.slug || "");
    setCategory(item.category || "");
    setCategoryId(foundCategory?.id || "");
    setBrand(item.brand || "The 1970");
    setWeight(String(item.weight || 0));
    setImageUrl(item.imageUrl || "");
    const initialColorImages = normalizeColorImages(item);
    setColorImages(initialColorImages);
    writeProductColorImagesToCache(item, initialColorImages);
    setDescription(item.description || "");
    setDefaultPrice(String(minPrice || 0));
    setDefaultCostPrice(String(minCostPrice || 0));
    setColors(uniqueColors.join(", "));
    setSizes(uniqueSizes.join(", "));
    setBranchStocks(aggregatedStocks);
    setApplyPriceToAllVariants(true);
  };

  useEffect(() => {
    const storedUser =
      getCurrentUserFromStorage() as CurrentUserPermissionProfile | null;
    setCurrentUser(storedUser);
    setRole(getPrimaryAppRole(storedUser));

    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const totalStock = useMemo(() => {
    if (!canViewInventory) return 0;
    return inventoryRows.reduce(
      (sum, row) => sum + Number(row.availableQty || 0),
      0,
    );
  }, [inventoryRows, canViewInventory]);

  const variantCount = product?.variants?.length || 0;

  const colorList = useMemo(() => {
    const fromInput = parseCommaTokens(colors).map(normalizeColorKey);
    const fromVariants = uniqueValues(
      (product?.variants || []).map((variant: any) => variant.color),
    ).map(normalizeColorKey);
    return Array.from(new Set([...fromInput, ...fromVariants].filter(Boolean)));
  }, [colors, product]);

  const catalogValue = useMemo(() => {
    if (!canViewInventoryValue) return 0;
    return (product?.variants || []).reduce((sum, variant) => {
      return (
        sum + getVariantTotalQty(variant.id) * Number(variant.costPrice || 0)
      );
    }, 0);
  }, [product, inventoryRows, canViewInventoryValue]);

  const branchStockAlerts = useMemo(() => {
    if (!canViewInventory) return [];
    return branches.map((branch) => {
      const qty = Number(branchStocks[branch.id] || 0);
      const tone =
        qty <= 0 ? "red" : qty <= 3 ? "amber" : qty > 50 ? "blue" : "green";
      const label =
        qty <= 0
          ? "Hết hàng"
          : qty <= 3
            ? "Sắp hết"
            : qty > 50
              ? "Tồn cao"
              : "Ổn";
      return {
        branchId: branch.id,
        branchName: branch.name,
        qty,
        tone: tone as "gray" | "green" | "amber" | "red" | "blue",
        label,
      };
    });
  }, [branches, branchStocks, canViewInventory]);

  const criticalBranchCount = branchStockAlerts.filter(
    (item) => item.tone === "red",
  ).length;
  const lowBranchCount = branchStockAlerts.filter(
    (item) => item.tone === "amber",
  ).length;
  const highBranchCount = branchStockAlerts.filter(
    (item) => item.tone === "blue",
  ).length;

  const workingBranchId = normalizeId(currentUser?.branchId);

  const inventoryHistoryBranches = useMemo(() => {
    if (isOwner) return branches;
    if (!workingBranchId) return [];
    return branches.filter((branch) => normalizeId(branch.id) === workingBranchId);
  }, [branches, isOwner, workingBranchId]);

  const inventoryHistoryScopeLabel = useMemo(() => {
    if (isOwner) return "toàn bộ chi nhánh";
    const branchName =
      inventoryHistoryBranches[0]?.name || currentUser?.branchId || "chi nhánh đang làm việc";
    return `chi nhánh ${branchName}`;
  }, [currentUser?.branchId, inventoryHistoryBranches, isOwner]);

  const scopedInventoryMovementRows = useMemo(() => {
    if (isOwner) return inventoryMovementRows;
    if (!workingBranchId) return [];
    return inventoryMovementRows.filter(
      (row) => normalizeId(row.branchId) === workingBranchId,
    );
  }, [inventoryMovementRows, isOwner, workingBranchId]);

  const initialSnapshot = useMemo(() => {
    if (!product) return "";
    return JSON.stringify({
      name: product.name || "",
      skuCode: product.slug || "",
      category: product.category || "",
      brand: product.brand || "The 1970",
      weight: String(product.weight || 0),
      imageUrl: product.imageUrl || "",
      colorImages: normalizeColorImages(product),
      description: product.description || "",
      defaultPrice: String(
        product.variants?.length
          ? Math.min(...product.variants.map((v) => Number(v.price || 0)))
          : 0,
      ),
      defaultCostPrice: String(
        product.variants?.length
          ? Math.min(...product.variants.map((v) => Number(v.costPrice || 0)))
          : 0,
      ),
      colors: uniqueValues(
        product.variants?.map((variant) => variant.color) || [],
      ).join(", "),
      sizes: uniqueValues(
        product.variants?.map((variant) => variant.size) || [],
      ).join(", "),
    });
  }, [product]);

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      name,
      skuCode,
      category,
      brand,
      weight,
      imageUrl,
      colorImages,
      description,
      defaultPrice,
      defaultCostPrice,
      colors,
      sizes,
    });
  }, [
    name,
    skuCode,
    category,
    brand,
    weight,
    imageUrl,
    colorImages,
    description,
    defaultPrice,
    defaultCostPrice,
    colors,
    sizes,
  ]);

  const hasUnsavedChanges = Boolean(
    product && initialSnapshot && currentSnapshot !== initialSnapshot,
  );

  useEffect(() => {
    if (!product) return;
    writeProductColorImagesToCache(product, colorImages);
  }, [product, colorImages]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const saveProduct = async (stay = true) => {
    if (!product || !canEditProduct) return;
    if (!name.trim()) {
      setMessage("Chưa nhập tên sản phẩm.");
      return;
    }
    if (!skuCode.trim()) {
      setMessage("Chưa nhập mã sản phẩm.");
      return;
    }
    if (!hasCommaFormat(colors) || !hasCommaFormat(sizes)) {
      setMessage(
        "Màu hoặc size sai định dạng. Hãy nhập kiểu: ĐEN, TRẮNG hoặc S, M, L.",
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      await updateProduct(product.id, {
        name: name.trim(),
        slug: skuCode.trim(),
        category: category.trim(),
        categoryId: categoryId || undefined,
        brand,
        weight: Number(weight || 0),
        imageUrl: imageUrl.trim(),
        colorImages,
        imagesByColor: colorImages,
        description: description.trim(),
        ...(canEditProductPrice
          ? { defaultPrice: Number(defaultPrice || 0) }
          : {}),
        ...(canEditProductCost
          ? { defaultCostPrice: Number(defaultCostPrice || 0) }
          : {}),
        colors: parseCommaTokens(colors),
        sizes: parseCommaTokens(sizes),
        // Tồn kho không lưu ở ProductDetail nữa.
        // Số tồn chuẩn lấy từ InventoryItem / Kho hàng.
        applyPriceToAllVariants,
      } as any);

      const next = await fetchProductById(product.id);
      const nextInventoryRows = await fetchInventoryByProduct(product.id);
      const normalizedInventoryRows = getProductInventoryRows(
        next,
        nextInventoryRows,
      );

      setProduct(next);
      setInventoryRows(normalizedInventoryRows);
      hydrateForm(next, branches, categories, normalizedInventoryRows);
      setMessage("Đã lưu sản phẩm.");

      if (!stay) {
        const from = searchParams.get("from");
        router.push(from || "/products");
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không lưu được sản phẩm.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!canUploadProductImage) {
      setMessage("Role hiện tại không có quyền upload ảnh sản phẩm.");
      return;
    }
    if (!file) return;
    try {
      setUploading(true);
      setMessage(file.size > 2.8 * 1024 * 1024 ? "Đang nén ảnh trước khi upload..." : "Đang upload ảnh...");
      const uploadFile = await resizeImageBeforeUpload(file);
      setMessage("Đang upload ảnh...");
      const result = await uploadProductImage(uploadFile);
      const uploadedUrl = getUploadedImageUrl(result);
      if (!uploadedUrl) {
        throw new Error("Upload xong nhưng backend không trả về link ảnh.");
      }
      setImageUrl(uploadedUrl);
      setMessage("Đã upload ảnh. Bấm lưu để cập nhật sản phẩm.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  };

  const handleColorImageUpload = async (color: string, file: File | null) => {
    const colorKey = normalizeColorKey(color);
    if (!colorKey) return;
    if (!canUploadProductImage) {
      setMessage("Role hiện tại không có quyền upload ảnh sản phẩm.");
      return;
    }
    if (!file) return;

    try {
      setUploadingColor(colorKey);
      setMessage(file.size > 2.8 * 1024 * 1024 ? `Đang nén ảnh màu ${colorKey}...` : `Đang upload ảnh màu ${colorKey}...`);
      const uploadFile = await resizeImageBeforeUpload(file);
      setMessage(`Đang upload ảnh màu ${colorKey}...`);
      const result = await uploadProductImage(uploadFile);
      const uploadedUrl = getUploadedImageUrl(result);
      if (!uploadedUrl) {
        throw new Error("Upload xong nhưng backend không trả về link ảnh.");
      }
      setColorImages((prev) => ({ ...prev, [colorKey]: uploadedUrl }));
      if (!imageUrl) setImageUrl(uploadedUrl);
      setMessage(
        `Đã upload ảnh màu ${colorKey}. Bấm lưu để cập nhật sản phẩm.`,
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Upload ảnh màu thất bại.",
      );
    } finally {
      setUploadingColor("");
    }
  };

  const handleAddVariant = async () => {
    if (!product || !canCreateProductVariant) return;
    if (!variantColor.trim() || !variantSize.trim()) {
      setMessage("Thiếu màu hoặc size cho variant.");
      return;
    }

    try {
      setVariantSaving(true);
      setMessage("");
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

      await addVariant(product.id, payload);
      const next = await fetchProductById(product.id);
      const nextInventoryRows = await fetchInventoryByProduct(product.id);
      const normalizedInventoryRows = getProductInventoryRows(
        next,
        nextInventoryRows,
      );

      setProduct(next);
      setInventoryRows(normalizedInventoryRows);
      hydrateForm(next, branches, categories, normalizedInventoryRows);
      setVariantColor("");
      setVariantSize("");
      setVariantPrice("");
      setVariantCostPrice("");
      setVariantBranchStocks(createEmptyBranchStocks(branches));
      setMessage("Đã thêm variant mới.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không thêm được variant.",
      );
    } finally {
      setVariantSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!product || !canToggleProductStatus) return;
    try {
      setStatusSaving(true);
      await toggleProductStatus(product.id);
      const next = await fetchProductById(product.id);
      const nextInventoryRows = await fetchInventoryByProduct(product.id);
      const normalizedInventoryRows = getProductInventoryRows(
        next,
        nextInventoryRows,
      );

      setProduct(next);
      setInventoryRows(normalizedInventoryRows);
      hydrateForm(next, branches, categories, normalizedInventoryRows);
      setMessage("Đã cập nhật trạng thái sản phẩm.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Không đổi được trạng thái sản phẩm.",
      );
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-neutral-500">
          Đang tải chi tiết sản phẩm...
        </p>
      </Panel>
    );
  }

  if (error || !product) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-red-600">
          {error || "Không tìm thấy sản phẩm."}
        </p>
      </Panel>
    );
  }

  if (!canViewProduct) {
    return (
      <Panel className="p-5">
        <p className="text-sm text-red-600">Không có quyền xem sản phẩm.</p>
      </Panel>
    );
  }

  const statusActive = product.status === "ACTIVE";

  return (
    <>
      <div className="space-y-3 p-3 pb-24 md:hidden">
        <Panel className="overflow-hidden">
          <div className="p-4">
            <Link
              href="/products"
              className="text-[12px] text-neutral-500 hover:text-neutral-900"
            >
              ← Danh sách sản phẩm
            </Link>

            <div className="mt-3 flex gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl bg-neutral-100">
                {imageUrl ? (
                  <img
                    src={toAbsoluteFileUrl(imageUrl)}
                    alt={product.name || "Sản phẩm"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusActive ? "green" : "red"}>
                    {product.status || "DRAFT"}
                  </Badge>
                  {hasUnsavedChanges ? (
                    <Badge tone="amber">Chưa lưu</Badge>
                  ) : null}
                </div>
                <h1 className="mt-2 text-[22px] font-semibold leading-tight text-neutral-950">
                  {product.name}
                </h1>
                <p className="mt-1 truncate text-sm text-neutral-500">
                  /{product.slug || "—"} · {weight || 0}g
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-[11px] text-neutral-500">Tổng tồn</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950">
                  {totalStock}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-[11px] text-neutral-500">Variant</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950">
                  {variantCount}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-[11px] text-neutral-500">Giá bán</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950">
                  {currency(Number(defaultPrice || 0))}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => void loadAll()}>
                Tải lại
              </Button>
              <Button
                variant={statusActive ? "danger" : "success"}
                disabled={statusSaving || !canToggleProductStatus}
                onClick={handleToggleStatus}
              >
                {statusSaving
                  ? "Đang cập nhật..."
                  : statusActive
                    ? "Ngừng bán"
                    : "Kích hoạt"}
              </Button>
              <Button
                className="col-span-2"
                disabled={saving || !canEditProduct || !hasUnsavedChanges}
                onClick={() => void saveProduct(true)}
              >
                {saving
                  ? "Đang lưu..."
                  : hasUnsavedChanges
                    ? "Lưu sản phẩm"
                    : "Đã đồng bộ"}
              </Button>
            </div>
          </div>
        </Panel>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Đã") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            {message}
          </div>
        ) : null}

        <Panel className="overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="text-[17px] font-semibold text-neutral-950">
              Tồn kho chi nhánh
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Tổng tồn của sản phẩm này: {totalStock}
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            {branchStockAlerts.map((item) => (
              <div
                key={item.branchId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {item.branchName}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-neutral-400">
                    {item.label}
                  </p>
                </div>
                <Badge tone={item.tone}>{item.qty}</Badge>
              </div>
            ))}
          </div>
          {isOwner ? (
            <div className="border-t border-neutral-100 p-3">
              <Link
                href={`/inventory?productId=${encodeURIComponent(product.id)}`}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700"
              >
                Mở trong Kho hàng
              </Link>
            </div>
          ) : null}
        </Panel>

        {canViewInventoryLogs ? (
          <ProductInventoryHistoryPanel
            rows={scopedInventoryMovementRows}
            branches={inventoryHistoryBranches}
            compact
            scopeLabel={inventoryHistoryScopeLabel}
          />
        ) : null}

        <Panel className="overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="text-[17px] font-semibold text-neutral-950">
              Variant
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {variantCount} màu / size đang có
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            {(product.variants || []).map((variant: any) => (
              <div key={variant.id || variant.sku} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {variant.sku || "SKU"}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {variant.color || "—"} · {variant.size || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-950">
                      {getVariantTotalQty(variant.id)} tồn
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {currency(Number(variant.price || 0))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="text-[17px] font-semibold text-neutral-950">
            Thông tin chính
          </h2>
          <div className="mt-3 grid gap-3">
            <Field label="Tên sản phẩm">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEditProduct}
              />
            </Field>
            <Field label="Mã / slug">
              <Input
                value={skuCode}
                onChange={(e) => setSkuCode(slugify(e.target.value))}
                disabled={!canEditProduct}
              />
            </Field>
            <Field label="Giá bán">
              <Input
                type="number"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                disabled={!canEditProductPrice}
              />
            </Field>
            {canViewCost ? (
              <Field label="Giá vốn">
                <Input
                  type="number"
                  value={defaultCostPrice}
                  onChange={(e) => setDefaultCostPrice(e.target.value)}
                  disabled={!canEditProductCost}
                />
              </Field>
            ) : null}
            <Field label="Mô tả">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEditProduct}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="hidden md:block">
        <div className="space-y-3 p-3 xl:p-4">
          <Panel className="sticky top-0 z-20 border-neutral-300 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <Link
                  href="/products"
                  className="text-[11px] text-neutral-500 hover:text-neutral-900"
                >
                  ← Quay lại danh sách sản phẩm
                </Link>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="max-w-[720px] truncate text-[20px] font-semibold tracking-tight text-neutral-950">
                    {product.name}
                  </h1>
                  <Badge tone={statusActive ? "green" : "red"}>
                    {product.status || "DRAFT"}
                  </Badge>
                  <Badge tone="blue">/{product.slug || "—"}</Badge>
                  <span className="text-xs text-neutral-400">
                    ID: {product.id}
                  </span>
                  {hasUnsavedChanges ? (
                    <Badge tone="amber">Có thay đổi chưa lưu</Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void loadAll()}>
                  Tải lại
                </Button>
                <Button
                  variant={statusActive ? "danger" : "success"}
                  disabled={statusSaving || !canToggleProductStatus}
                  onClick={handleToggleStatus}
                >
                  {statusSaving
                    ? "Đang cập nhật..."
                    : statusActive
                      ? "Ngừng bán"
                      : "Kích hoạt"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={saving || !canEditProduct || !hasUnsavedChanges}
                  onClick={() => void saveProduct(false)}
                >
                  Lưu & về danh sách
                </Button>
                <Button
                  disabled={saving || !canEditProduct || !hasUnsavedChanges}
                  onClick={() => void saveProduct(true)}
                >
                  {saving
                    ? "Đang lưu..."
                    : hasUnsavedChanges
                      ? "Lưu sản phẩm"
                      : "Đã đồng bộ"}
                </Button>
              </div>
            </div>
          </Panel>

          {message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Đã") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
            >
              {message}
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <Panel className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-semibold">
                      Thông tin chính
                    </h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Thông tin bán hàng, danh mục và cấu hình tạo variant.
                    </p>
                  </div>

                  <label className="flex shrink-0 items-center gap-2 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={applyPriceToAllVariants}
                      disabled={!canEditProductPrice}
                      onChange={(e) =>
                        setApplyPriceToAllVariants(e.target.checked)
                      }
                    />
                    Áp dụng cho toàn bộ variant
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-6">
                  <Field label="Tên sản phẩm" wide>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!canEditProduct}
                    />
                  </Field>

                  <Field label="Mã / slug">
                    <Input
                      value={skuCode}
                      onChange={(e) => setSkuCode(slugify(e.target.value))}
                      disabled={!canEditProduct}
                    />
                  </Field>

                  <Field label="Danh mục">
                    <select
                      disabled={!canEditProduct}
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
                      value={categoryId}
                      onChange={(e) => {
                        const found = categories.find(
                          (c) => c.id === e.target.value,
                        );
                        setCategoryId(e.target.value);
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
                  </Field>

                  <Field label="Brand">
                    <Input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      disabled={!canEditProduct}
                    />
                  </Field>

                  <Field label="Khối lượng">
                    <Input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      disabled={!canEditProduct}
                    />
                  </Field>

                  <Field label="Giá bán">
                    <Input
                      type="number"
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                      disabled={!canEditProductPrice}
                    />
                  </Field>

                  {canViewCost ? (
                    <Field label="Giá vốn">
                      <Input
                        type="number"
                        value={defaultCostPrice}
                        onChange={(e) => setDefaultCostPrice(e.target.value)}
                        disabled={!canEditProductCost}
                      />
                    </Field>
                  ) : null}

                  <Field label="Cấu hình màu">
                    <Input
                      value={colors}
                      onChange={(e) => setColors(e.target.value)}
                      placeholder="ĐEN, TRẮNG, NÂU"
                      disabled={!canEditProduct}
                    />
                    <TokenPreview value={colors} />
                  </Field>

                  <Field label="Cấu hình size">
                    <Input
                      value={sizes}
                      onChange={(e) => setSizes(e.target.value)}
                      placeholder="S, M, L, XL"
                      disabled={!canEditProduct}
                    />
                    <TokenPreview value={sizes} />
                  </Field>

                  <Field label="Mô tả" wide>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[76px]"
                      disabled={!canEditProduct}
                    />
                  </Field>
                </div>
              </Panel>

              <div className="grid gap-3 xl:grid-cols-[0.86fr_1.14fr]">
                <Panel className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold">
                      Tồn kho các chi nhánh
                    </h2>
                    <span className="text-xs text-neutral-500">
                      Tổng tồn của sản phẩm này • {totalStock}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {criticalBranchCount > 0 ? (
                      <Badge tone="red">
                        {criticalBranchCount} chi nhánh hết hàng
                      </Badge>
                    ) : null}
                    {lowBranchCount > 0 ? (
                      <Badge tone="amber">
                        {lowBranchCount} chi nhánh sắp hết
                      </Badge>
                    ) : null}
                    {highBranchCount > 0 ? (
                      <Badge tone="blue">
                        {highBranchCount} chi nhánh tồn cao
                      </Badge>
                    ) : null}
                    {!criticalBranchCount &&
                    !lowBranchCount &&
                    !highBranchCount ? (
                      <Badge tone="green">Tồn ổn định</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {branches.map((branch) => {
                      const alert = branchStockAlerts.find(
                        (item) => item.branchId === branch.id,
                      );
                      const qty = Number(alert?.qty || 0);
                      return (
                        <div
                          key={branch.id}
                          className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium text-neutral-600">
                              {branch.name}
                            </span>
                            <Badge tone={alert?.tone || "gray"}>{qty}</Badge>
                          </div>
                          <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                            {alert?.label || "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isOwner ? (
                    <Link
                      href={`/inventory?productId=${encodeURIComponent(product.id)}`}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Mở trong Kho hàng
                    </Link>
                  ) : null}
                </Panel>

                <Panel className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold">
                      Thêm variant nhanh
                    </h2>
                    <span className="text-xs text-neutral-500">
                      {variantCount} variant
                    </span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    <Input
                      value={variantColor}
                      onChange={(e) => setVariantColor(e.target.value)}
                      placeholder="Màu"
                      className="py-2"
                      disabled={!canCreateProductVariant}
                    />
                    <Input
                      value={variantSize}
                      onChange={(e) => setVariantSize(e.target.value)}
                      placeholder="Size"
                      className="py-2"
                      disabled={!canCreateProductVariant}
                    />
                    <Input
                      type="number"
                      value={variantPrice}
                      onChange={(e) => setVariantPrice(e.target.value)}
                      placeholder="Giá bán"
                      className="py-2"
                      disabled={!canEditProductPrice}
                    />
                    {canViewCost ? (
                      <Input
                        type="number"
                        value={variantCostPrice}
                        onChange={(e) => setVariantCostPrice(e.target.value)}
                        placeholder="Giá vốn"
                        className="py-2"
                        disabled={!canEditProductCost}
                      />
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    {branches.map((branch) => (
                      <div key={branch.id} className="space-y-1">
                        <span className="block truncate text-[10px] font-semibold uppercase text-neutral-400">
                          {branch.name}
                        </span>
                        <Input
                          type="number"
                          value={variantBranchStocks[branch.id] || "0"}
                          onChange={(e) =>
                            setVariantBranchStocks((prev) => ({
                              ...prev,
                              [branch.id]: e.target.value,
                            }))
                          }
                          className="py-2"
                          disabled={!canCreateProductVariant}
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    className="mt-3 w-full"
                    disabled={variantSaving || !canCreateProductVariant}
                    onClick={handleAddVariant}
                  >
                    {variantSaving ? "Đang thêm..." : "+ Thêm variant"}
                  </Button>
                </Panel>
              </div>

              {canViewInventoryLogs ? (
                <ProductInventoryHistoryPanel
                  rows={scopedInventoryMovementRows}
                  branches={inventoryHistoryBranches}
                  scopeLabel={inventoryHistoryScopeLabel}
                />
              ) : null}

              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <div>
                    <h2 className="text-[16px] font-semibold">
                      Danh sách variant
                    </h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      SKU, tên phiên bản, màu, size, giá và tồn theo từng chi nhánh.
                    </p>
                  </div>
                  <Badge tone="gray">{variantCount} dòng</Badge>
                </div>

                <div className="overflow-auto">
                  <table className="min-w-[1120px] w-full border-collapse text-sm">
                    <thead className="bg-neutral-50 text-left text-[11px] uppercase text-neutral-500">
                      <tr>
                        <th className="border-b px-4 py-3">SKU</th>
                        <th className="border-b px-4 py-3">Tên phiên bản</th>
                        <th className="border-b px-4 py-3">Màu</th>
                        <th className="border-b px-4 py-3">Size</th>
                        <th className="border-b px-4 py-3">Giá bán</th>
                        {canViewCost ? (
                          <th className="border-b px-4 py-3">Giá vốn</th>
                        ) : null}
                        <th className="border-b px-4 py-3">Tồn chi nhánh</th>
                        <th className="border-b px-4 py-3 text-right">
                          Thao tác
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(product.variants || []).map((variant) => (
                        <tr
                          key={variant.id || variant.sku}
                          className="hover:bg-neutral-50"
                        >
                          <td className="border-b px-4 py-3 font-medium">
                            {variant.sku || "—"}
                          </td>
                          <td className="min-w-[240px] border-b px-4 py-3">
                            {(variant as any).variantName || `${product.name || ""}${variant.color ? ` - ${variant.color}` : ""}${variant.size ? ` - ${variant.size}` : ""}` || "—"}
                          </td>
                          <td className="border-b px-4 py-3">
                            {variant.color || "—"}
                          </td>
                          <td className="border-b px-4 py-3">
                            {variant.size || "—"}
                          </td>
                          <td className="border-b px-4 py-3">
                            {currency(Number(variant.price || 0))}
                          </td>
                          {canViewCost ? (
                            <td className="border-b px-4 py-3">
                              {currency(Number(variant.costPrice || 0))}
                            </td>
                          ) : null}
                          <td className="border-b px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {branches.map((branch) => {
                                const qty = getAvailableQty(
                                  variant.id,
                                  branch.id,
                                );
                                return (
                                  <Badge
                                    key={branch.id}
                                    tone={
                                      qty <= 0
                                        ? "red"
                                        : qty <= 3
                                          ? "amber"
                                          : "green"
                                    }
                                  >
                                    {branch.name}: {qty}
                                  </Badge>
                                );
                              })}
                            </div>
                          </td>
                          <td className="border-b px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              {isOwner ? (
                                <Link
                                  href={`/inventory?variantId=${encodeURIComponent(variant.id || "")}`}
                                  className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                >
                                  Kho
                                </Link>
                              ) : null}
                              {canEditProduct ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMessage(
                                      "Sửa nhanh variant sẽ làm ở bước tiếp theo.",
                                    )
                                  }
                                  className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                >
                                  Sửa
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <div className="space-y-3">
              <Panel className="p-4">
                <h2 className="text-[16px] font-semibold">Ảnh sản phẩm</h2>
                <div className="mt-3 overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-100">
                  {imageUrl ? (
                    <img
                      src={toAbsoluteFileUrl(imageUrl)}
                      alt={name}
                      className="h-[210px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-[210px] items-center justify-center text-sm text-neutral-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-2">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Dán link ảnh hoặc upload"
                    disabled={!canEditProduct}
                  />
                  <label
                    className={`inline-flex items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 ${!canEditProduct ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    {uploading ? "Đang upload..." : "Upload ảnh"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!canUploadProductImage || uploading}
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const file = input.files?.[0] || null;
                        try {
                          await handleUpload(file);
                        } finally {
                          input.value = "";
                        }
                      }}
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={!imageUrl}
                      onClick={() =>
                        imageUrl &&
                        window.open(
                          toAbsoluteFileUrl(imageUrl),
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="rounded-2xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      Xem lớn
                    </button>
                    <button
                      type="button"
                      disabled={!imageUrl}
                      onClick={async () => {
                        if (!imageUrl) return;
                        await navigator.clipboard?.writeText(
                          toAbsoluteFileUrl(imageUrl),
                        );
                        setMessage("Đã copy link ảnh.");
                      }}
                      className="rounded-2xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      disabled={!imageUrl || !canEditProduct}
                      onClick={() => setImageUrl("")}
                      className="rounded-2xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Xoá ảnh
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-950">
                        Ảnh theo màu
                      </h3>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Mỗi màu có thể dùng ảnh riêng để sau này show đúng màu
                        variant.
                      </p>
                    </div>
                    <Badge tone="gray">{colorList.length} màu</Badge>
                  </div>

                  <div className="mt-3 space-y-3">
                    {colorList.length ? (
                      colorList.map((color) => {
                        const colorImage = colorImages[color] || "";
                        return (
                          <div
                            key={color}
                            className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                          >
                            <div className="flex gap-3">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                                {colorImage ? (
                                  <img
                                    src={toAbsoluteFileUrl(colorImage)}
                                    alt={`${name} ${color}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                                    No image
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <Badge tone="blue">{color}</Badge>
                                  {colorImage ? (
                                    <button
                                      type="button"
                                      disabled={!canEditProduct}
                                      onClick={() =>
                                        setColorImages((prev) => {
                                          const next = { ...prev };
                                          delete next[color];
                                          return next;
                                        })
                                      }
                                      className="text-xs font-medium text-red-600 hover:text-red-500 disabled:opacity-40"
                                    >
                                      Xoá
                                    </button>
                                  ) : null}
                                </div>

                                <Input
                                  value={colorImage}
                                  onChange={(e) =>
                                    setColorImages((prev) => ({
                                      ...prev,
                                      [color]: e.target.value,
                                    }))
                                  }
                                  placeholder={`Link ảnh màu ${color}`}
                                  disabled={!canEditProduct}
                                  className="py-2"
                                />

                                <label
                                  className={`mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 ${!canUploadProductImage || uploadingColor ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                >
                                  {uploadingColor === color
                                    ? "Đang upload..."
                                    : `Upload ảnh ${color}`}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={
                                      !canUploadProductImage ||
                                      Boolean(uploadingColor)
                                    }
                                    onChange={async (e) => {
                                      const input = e.currentTarget;
                                      const file = input.files?.[0] || null;
                                      try {
                                        await handleColorImageUpload(
                                          color,
                                          file,
                                        );
                                      } finally {
                                        input.value = "";
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-500">
                        Chưa có màu. Nhập cấu hình màu trước, ví dụ: ĐEN, RÊU.
                      </p>
                    )}
                  </div>
                </div>
              </Panel>

              <Panel className="p-4">
                <h2 className="text-[16px] font-semibold">Tóm tắt</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-[11px] text-neutral-500">Tổng tồn</p>
                    <p className="mt-1 text-lg font-semibold">{totalStock}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-[11px] text-neutral-500">Variant</p>
                    <p className="mt-1 text-lg font-semibold">{variantCount}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-[11px] text-neutral-500">
                      Giá thấp nhất
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {currency(Number(defaultPrice || 0))}
                    </p>
                  </div>
                  {canViewCost ? (
                    <div className="rounded-2xl bg-neutral-50 p-3">
                      <p className="text-[11px] text-neutral-500">
                        Giá trị tồn
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {currency(catalogValue)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel className="p-4">
                <h2 className="text-[16px] font-semibold">Thông tin nhanh</h2>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-500">ID</span>
                    <span className="max-w-[210px] truncate font-medium">
                      {product.id}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-500">Danh mục</span>
                    <span className="font-medium">{category || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-500">Brand</span>
                    <span className="font-medium">{brand || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-500">Trạng thái</span>
                    <Badge tone={statusActive ? "green" : "red"}>
                      {product.status || "DRAFT"}
                    </Badge>
                  </div>
                </div>
              </Panel>

              <Panel className="p-4">
                <h2 className="text-[16px] font-semibold">Nhật ký nhanh</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-neutral-700">
                      Trạng thái dữ liệu
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {hasUnsavedChanges
                        ? "Có thay đổi chưa lưu trên form."
                        : "Thông tin sản phẩm đã đồng bộ."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-neutral-700">
                      Tồn kho
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Số tồn lấy theo sản phẩm hiện tại, không lưu trực tiếp ở
                      form sản phẩm.
                    </p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
