"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import { getSuppliers, type SupplierItem } from "@/lib/suppliers-api";
import {
  cancelPurchaseReceipt,
  completePurchaseReceipt,
  createPurchaseReceipt,
  getPurchaseReceipts,
  importStockPurchaseReceipt,
  payPurchaseReceipt,
  requestPaymentPurchaseReceipt,
  updatePurchaseReceipt,
  type PurchaseReceipt,
} from "@/lib/purchase-receipts-api";
import { getPaymentSources, type PaymentSourceItem } from "@/lib/payment-sources-api";
import { getCurrentUserFromStorage } from "@/lib/current-user";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
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
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/35 p-4">
      <div className="mt-2 flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
            <button onClick={onClose} className="text-lg text-neutral-500" type="button">
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

type DraftItem = {
  rowId: string;
  variantId: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
  qty: string;
  unitCost: string;
};

function makeRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeFilterText(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getProductCategoryName(product: any) {
  const raw =
    product?.categoryName ||
    product?.category?.name ||
    product?.category?.title ||
    product?.category ||
    product?.productType ||
    product?.type ||
    "";

  return String(raw || "").trim();
}

function getProductBrandName(product: any) {
  const raw =
    product?.brandName ||
    product?.brand?.name ||
    product?.brand ||
    product?.supplierName ||
    product?.supplier?.name ||
    product?.vendor ||
    product?.vendorName ||
    "";

  return String(raw || "").trim();
}

function getVariantStockQty(variant: any) {
  const raw =
    variant?.stock ??
    variant?.totalStock ??
    variant?.availableQty ??
    variant?.inventoryQty ??
    variant?.inventory?.availableQty ??
    variant?.inventoryItem?.availableQty ??
    variant?.inventories?.reduce?.((sum: number, row: any) => sum + Number(row?.availableQty || row?.stock || 0), 0) ??
    0;

  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function sortSizeValue(value: any) {
  const text = String(value || "").trim().toUpperCase();
  const order = ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL"];
  const index = order.indexOf(text);
  if (index >= 0) return index;
  const number = Number(text);
  return Number.isFinite(number) ? 100 + number : 999;
}

function toInputDate(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDateTime(value: any) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isDateInRange(value: any, from: string, to: string) {
  if (!from && !to) return true;
  const raw = getDateTime(value);
  if (!raw) return false;

  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (raw < start) return false;
  }

  if (to) {
    const end = new Date(`${to}T23:59:59.999`).getTime();
    if (raw > end) return false;
  }

  return true;
}

function getReceiptStatusLabel(status: any, isAdmin: boolean) {
  if (status === "COMPLETED") return "Đã hoàn tất";
  if (status === "STOCK_IMPORTED") return "Đã nhập kho";
  if (status === "PAID") return isAdmin ? "Đã thanh toán đủ" : "Đã xác nhận đủ hàng";
  if (status === "PARTIALLY_PAID") return isAdmin ? "Thanh toán một phần" : "Đã xác nhận đủ hàng";
  if (status === "PAYMENT_REQUESTED") return isAdmin ? "Chờ thanh toán" : "Đã xác nhận đủ hàng";
  if (status === "CANCELLED") return "Đã hủy";
  return "Nháp";
}

function getReceiptStatusTone(status: any): "gray" | "green" | "amber" | "red" | "blue" {
  if (status === "COMPLETED" || status === "PAID") return "green";
  if (status === "STOCK_IMPORTED" || status === "PAYMENT_REQUESTED") return "blue";
  if (status === "CANCELLED") return "red";
  if (status === "PARTIALLY_PAID" || status === "DRAFT") return "amber";
  return "gray";
}

function includesText(source: any, keyword: string) {
  if (!keyword) return true;
  return normalizeFilterText(source).includes(keyword);
}

export default function PurchaseReceiptsPageClient() {
  const [rows, setRows] = useState<PurchaseReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSourceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payingReceipt, setPayingReceipt] = useState<PurchaseReceipt | null>(null);
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const [searchVariant, setSearchVariant] = useState("");
  const [variantSearching, setVariantSearching] = useState(false);
  const [variantCategoryFilter, setVariantCategoryFilter] = useState("ALL");
  const [variantBrandFilter, setVariantBrandFilter] = useState("ALL");
  const [variantColorFilter, setVariantColorFilter] = useState("ALL");
  const [variantSizeFilter, setVariantSizeFilter] = useState("ALL");
  const [variantStockFilter, setVariantStockFilter] = useState("ALL");
  const [variantSortBy, setVariantSortBy] = useState("recent");
  const [draftSortBy, setDraftSortBy] = useState("added_desc");
  const [bulkQty, setBulkQty] = useState("1");
  const [bulkUnitCost, setBulkUnitCost] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [createdByFilter, setCreatedByFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [colorFilter, setColorFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] = useState("ALL");
  const [paymentSourceFilter, setPaymentSourceFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importDateFrom, setImportDateFrom] = useState("");
  const [importDateTo, setImportDateTo] = useState("");
  const [qtyMin, setQtyMin] = useState("");
  const [qtyMax, setQtyMax] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<string[]>([]);

  const currentUser = getCurrentUserFromStorage();
  const createdById = currentUser?.id || undefined;
  const role = String(currentUser?.role || "").toLowerCase();
  const roles = Array.isArray(currentUser?.roles)
    ? currentUser.roles.map((item: any) => String(item || "").toLowerCase())
    : [];
  const isAdmin =
    role === "admin" ||
    role === "owner" ||
    roles.includes("admin") ||
    roles.includes("owner");

  const currentBranchId =
    (currentUser as any)?.branchId ||
    (currentUser as any)?.workingBranchId ||
    (currentUser as any)?.currentBranchId ||
    (currentUser as any)?.branch?.id ||
    "";

  const allowedBranches = useMemo(() => {
    if (isAdmin || !currentBranchId) return branches;

    return branches.filter((item) => String(item.id) === String(currentBranchId));
  }, [branches, currentBranchId, isAdmin]);

  function getPermissionKeys() {
    const keys = new Set<string>();

    if (Array.isArray((currentUser as any)?.permissionKeys)) {
      (currentUser as any).permissionKeys.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray((currentUser as any)?.permissions)) {
      (currentUser as any).permissions.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray((currentUser as any)?.branchPermissions)) {
      (currentUser as any).branchPermissions.forEach((row: any) => {
        if (Array.isArray(row?.permissionKeys)) {
          row.permissionKeys.forEach((key: any) => {
            if (key) keys.add(String(key));
          });
        }
      });
    }

    return keys;
  }

  function hasAnyPermission(keys: string[]) {
    if (isAdmin) return true;
    const granted = getPermissionKeys();
    return keys.some((key) => granted.has(key));
  }

  const canViewCost = hasAnyPermission([
    "purchase_receipt.cost.view",
    "products.cost.view",
  ]);
  const canEditCost = hasAnyPermission([
    "purchase_receipt.cost.edit",
    "products.cost.edit",
  ]);
  const canCreateReceipt = hasAnyPermission([
    "purchase_receipt.create",
    "purchaseReceipts.tao_don_nhap",
    "purchaseReceipts.tao_don_dat_hang_nhap",
    "purchaseOrders.tao_don_dat_hang_nhap",
  ]);
  const canEditReceipt = hasAnyPermission([
    "purchase_receipt.edit",
    "purchaseReceipts.sua_don_nhap",
    "purchaseReceipts.sua_don_dat_hang_nhap",
    "purchaseOrders.sua_don_dat_hang_nhap",
  ]);
  const canRequestPaymentReceipt = hasAnyPermission([
    "purchase_receipt.request_payment",
    "purchase_receipt.receive",
    "purchaseReceipts.nhan_hang_vao_kho",
  ]);
  const canPayReceipt = hasAnyPermission([
    "purchase_receipt.pay",
  ]);
  const canImportStockReceipt = hasAnyPermission([
    "purchase_receipt.import_stock",
    "purchase_receipt.receive",
    "purchase_receipt.close",
    "purchaseReceipts.ket_thuc_don_nhap",
  ]);
  const canCompleteReceipt = hasAnyPermission([
    "purchase_receipt.complete",
    "purchase_receipt.receive",
    "purchase_receipt.close",
    "purchaseReceipts.ket_thuc_don_nhap",
  ]);
  const canCancelReceipt = hasAnyPermission([
    "purchase_receipt.cancel",
    "purchaseReceipts.huy_don_nhap",
    "purchaseReceipts.huy_don_dat_hang_nhap",
    "purchaseOrders.huy_don_dat_hang_nhap",
  ]);
  const canConfirmReceipt = canRequestPaymentReceipt || canImportStockReceipt || canCompleteReceipt;

  function getReceiptItems(receipt: PurchaseReceipt) {
    return Array.isArray(receipt.items) ? receipt.items : [];
  }

  function getReceiptPayments(receipt: PurchaseReceipt) {
    return Array.isArray((receipt as any).purchaseReceiptPayments)
      ? (receipt as any).purchaseReceiptPayments
      : [];
  }

  function getReceiptAmount(receipt: PurchaseReceipt) {
    return getReceiptItems(receipt).reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0
    );
  }

  function getPaidAmount(receipt: PurchaseReceipt) {
    return getReceiptPayments(receipt).reduce(
      (sum: number, payment: any) => sum + Number(payment.amount || 0),
      0
    );
  }

  function isReceiptPaidEnough(receipt: PurchaseReceipt) {
    const total = getReceiptAmount(receipt);
    return total > 0 && getPaidAmount(receipt) >= total;
  }

  function getCreatedByName(receipt: PurchaseReceipt) {
    const raw = (receipt as any).createdBy;
    return (
      raw?.fullName ||
      raw?.name ||
      raw?.username ||
      raw?.email ||
      (receipt as any).createdByName ||
      (receipt as any).createdById ||
      "—"
    );
  }

  function getReceiptCreatedAt(receipt: PurchaseReceipt) {
    return (receipt as any).createdAt || (receipt as any).created_at || null;
  }

  function getReceiptImportedAt(receipt: PurchaseReceipt) {
    return (
      (receipt as any).confirmedAt ||
      (receipt as any).importedAt ||
      (receipt as any).completedAt ||
      null
    );
  }

  function getReceiptPaymentSourceIds(receipt: PurchaseReceipt) {
    return getReceiptPayments(receipt)
      .map((payment: any) => payment?.paymentSourceId || payment?.paymentSource?.id || "")
      .filter(Boolean);
  }

  function getLineCategoryName(line: any) {
    const fromLine =
      line?.categoryName ||
      line?.category?.name ||
      line?.product?.categoryName ||
      line?.product?.category?.name ||
      "";

    if (fromLine) return String(fromLine);

    const found = allVariants.find(
      (variant) =>
        String(variant.variantId || "") === String(line?.variantId || "") ||
        String(variant.sku || "") === String(line?.sku || ""),
    );

    return found?.categoryName || "";
  }

  function openReceiptInNewTab(receipt: PurchaseReceipt) {
    if (typeof window === "undefined") return;
    window.open(`/control/purchase-receipts/${receipt.id}`, "_blank", "noopener,noreferrer");
  }

  function pickUnitCost(product: any, variant: any) {
    const rawValue =
      variant?.unitCost ??
      variant?.costPrice ??
      variant?.importPrice ??
      variant?.purchasePrice ??
      variant?.cost ??
      product?.unitCost ??
      product?.costPrice ??
      product?.importPrice ??
      product?.purchasePrice ??
      product?.cost ??
      0;

    const value = Number(rawValue || 0);
    return Number.isFinite(value) ? value : 0;
  }

  const allVariants = useMemo(() => {
    return products.flatMap((product: any, productIndex: number) =>
      (product.variants || []).map((variant: any, variantIndex: number) => ({
        rowId: variant.id,
        variantId: variant.id,
        sku: variant.sku,
        productName: product.name,
        color: variant.color || "",
        size: variant.size || "",
        unitCost: pickUnitCost(product, variant),
        stockQty: getVariantStockQty(variant),
        categoryName: getProductCategoryName(product),
        brandName: getProductBrandName(product),
        createdAt: variant?.createdAt || product?.createdAt || "",
        sourceIndex: productIndex * 10000 + variantIndex,
      }))
    );
  }, [products]);

  const variantFilterOptions = useMemo(() => {
    const categories = new Set<string>();
    const brands = new Set<string>();
    const colors = new Set<string>();
    const sizes = new Set<string>();

    allVariants.forEach((item) => {
      if (item.categoryName) categories.add(item.categoryName);
      if (item.brandName) brands.add(item.brandName);
      if (item.color) colors.add(item.color);
      if (item.size) sizes.add(item.size);
    });

    return {
      categories: Array.from(categories).sort((a, b) => a.localeCompare(b, "vi")),
      brands: Array.from(brands).sort((a, b) => a.localeCompare(b, "vi")),
      colors: Array.from(colors).sort((a, b) => a.localeCompare(b, "vi")),
      sizes: Array.from(sizes).sort((a, b) => sortSizeValue(a) - sortSizeValue(b)),
    };
  }, [allVariants]);

  const variantOptions = useMemo(() => {
    const q = normalizeFilterText(searchVariant);

    return allVariants
      .filter((item) => {
        const label = normalizeFilterText(
          `${item.productName} ${item.sku} ${item.color} ${item.size} ${item.categoryName} ${item.brandName}`,
        );

        if (q && !label.includes(q)) return false;
        if (variantCategoryFilter !== "ALL" && item.categoryName !== variantCategoryFilter) return false;
        if (variantBrandFilter !== "ALL" && item.brandName !== variantBrandFilter) return false;
        if (variantColorFilter !== "ALL" && item.color !== variantColorFilter) return false;
        if (variantSizeFilter !== "ALL" && item.size !== variantSizeFilter) return false;
        if (variantStockFilter === "IN_STOCK" && item.stockQty <= 0) return false;
        if (variantStockFilter === "OUT_OF_STOCK" && item.stockQty > 0) return false;
        if (variantStockFilter === "LOW_STOCK" && !(item.stockQty > 0 && item.stockQty <= 3)) return false;

        return true;
      })
      .sort((a, b) => {
        if (variantSortBy === "price_desc") return Number(b.unitCost || 0) - Number(a.unitCost || 0);
        if (variantSortBy === "price_asc") return Number(a.unitCost || 0) - Number(b.unitCost || 0);
        if (variantSortBy === "size_asc") return sortSizeValue(a.size) - sortSizeValue(b.size);
        if (variantSortBy === "color_asc") return String(a.color || "").localeCompare(String(b.color || ""), "vi");
        if (variantSortBy === "stock_desc") return Number(b.stockQty || 0) - Number(a.stockQty || 0);
        if (variantSortBy === "name_asc") return String(a.productName || "").localeCompare(String(b.productName || ""), "vi");
        return Number(b.sourceIndex || 0) - Number(a.sourceIndex || 0);
      })
      .slice(0, 80);
  }, [
    allVariants,
    searchVariant,
    variantCategoryFilter,
    variantBrandFilter,
    variantColorFilter,
    variantSizeFilter,
    variantStockFilter,
    variantSortBy,
  ]);

  const sortedDraftItems = useMemo(() => {
    const list = [...items];

    return list.sort((a, b) => {
      if (draftSortBy === "price_desc") return Number(b.unitCost || 0) - Number(a.unitCost || 0);
      if (draftSortBy === "price_asc") return Number(a.unitCost || 0) - Number(b.unitCost || 0);
      if (draftSortBy === "qty_desc") return Number(b.qty || 0) - Number(a.qty || 0);
      if (draftSortBy === "qty_asc") return Number(a.qty || 0) - Number(b.qty || 0);
      if (draftSortBy === "size_asc") return sortSizeValue(a.size) - sortSizeValue(b.size);
      if (draftSortBy === "color_asc") return String(a.color || "").localeCompare(String(b.color || ""), "vi");
      if (draftSortBy === "sku_asc") return String(a.sku || "").localeCompare(String(b.sku || ""), "vi");
      return 0;
    });
  }, [items, draftSortBy]);

  const receiptFilterOptions = useMemo(() => {
    const createdBy = new Map<string, string>();
    const categories = new Set<string>();
    const colors = new Set<string>();
    const sizes = new Set<string>();

    rows.forEach((receipt) => {
      const createdByIdValue = String((receipt as any).createdBy?.id || (receipt as any).createdById || "");
      const createdByName = String(getCreatedByName(receipt) || "").trim();
      if (createdByIdValue && createdByName && createdByName !== "—") {
        createdBy.set(createdByIdValue, createdByName);
      }

      getReceiptItems(receipt).forEach((line: any) => {
        const categoryName = getLineCategoryName(line);
        if (categoryName) categories.add(categoryName);
        if (line?.color) colors.add(String(line.color));
        if (line?.size) sizes.add(String(line.size));
      });
    });

    return {
      createdBy: Array.from(createdBy.entries()).sort((a, b) => a[1].localeCompare(b[1], "vi")),
      categories: Array.from(categories).sort((a, b) => a.localeCompare(b, "vi")),
      colors: Array.from(colors).sort((a, b) => a.localeCompare(b, "vi")),
      sizes: Array.from(sizes).sort((a, b) => sortSizeValue(a) - sortSizeValue(b)),
    };
  }, [rows, allVariants]);

  const filteredRows = useMemo(() => {
    const q = normalizeFilterText(query);
    const minQty = qtyMin === "" ? null : Number(qtyMin);
    const maxQty = qtyMax === "" ? null : Number(qtyMax);
    const minAmount = amountMin === "" ? null : Number(amountMin);
    const maxAmount = amountMax === "" ? null : Number(amountMax);

    return rows
      .filter((item) => {
        const receiptItems = getReceiptItems(item);
        const receiptQty = receiptItems.reduce((sum, line) => sum + Number(line.qty || 0), 0);
        const receiptAmount = getReceiptAmount(item);
        const paidAmount = getPaidAmount(item);
        const remainAmount = Math.max(receiptAmount - paidAmount, 0);
        const createdByIdValue = String((item as any).createdBy?.id || (item as any).createdById || "");
        const haystack = normalizeFilterText([
          item.receiptCode,
          item.status,
          getReceiptStatusLabel(item.status, isAdmin),
          item.branch?.name,
          item.supplier?.name,
          getCreatedByName(item),
          (item as any).note,
          receiptItems.map((line: any) => [
            line.productName,
            line.sku,
            line.color,
            line.size,
            getLineCategoryName(line),
          ].join(" ")).join(" "),
          getReceiptPayments(item).map((payment: any) => payment?.paymentSource?.name || payment?.note || "").join(" "),
        ].join(" "));

        if (q && !haystack.includes(q)) return false;
        if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
        if (branchFilter !== "ALL" && String(item.branchId || item.branch?.id || "") !== branchFilter) return false;
        if (supplierFilter !== "ALL" && String(item.supplierId || item.supplier?.id || "") !== supplierFilter) return false;
        if (createdByFilter !== "ALL" && createdByIdValue !== createdByFilter) return false;
        if (paymentSourceFilter !== "ALL" && !getReceiptPaymentSourceIds(item).includes(paymentSourceFilter)) return false;

        if (categoryFilter !== "ALL" && !receiptItems.some((line: any) => getLineCategoryName(line) === categoryFilter)) return false;
        if (colorFilter !== "ALL" && !receiptItems.some((line: any) => String(line?.color || "") === colorFilter)) return false;
        if (sizeFilter !== "ALL" && !receiptItems.some((line: any) => String(line?.size || "") === sizeFilter)) return false;

        if (!isDateInRange(getReceiptCreatedAt(item), dateFrom, dateTo)) return false;
        if (!isDateInRange(getReceiptImportedAt(item), importDateFrom, importDateTo)) return false;

        if (minQty !== null && Number.isFinite(minQty) && receiptQty < minQty) return false;
        if (maxQty !== null && Number.isFinite(maxQty) && receiptQty > maxQty) return false;
        if (minAmount !== null && Number.isFinite(minAmount) && receiptAmount < minAmount) return false;
        if (maxAmount !== null && Number.isFinite(maxAmount) && receiptAmount > maxAmount) return false;

        if (paymentStatusFilter === "UNPAID" && paidAmount > 0) return false;
        if (paymentStatusFilter === "PARTIAL" && !(paidAmount > 0 && paidAmount < receiptAmount)) return false;
        if (paymentStatusFilter === "PAID_ENOUGH" && !(receiptAmount > 0 && paidAmount >= receiptAmount)) return false;
        if (paymentStatusFilter === "HAS_DEBT" && !(receiptAmount > paidAmount && item.status !== "CANCELLED")) return false;
        if (paymentStatusFilter === "OVERDUE_ACTION" && !(item.status === "PAYMENT_REQUESTED" || item.status === "PAID")) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "created_asc") return getDateTime(getReceiptCreatedAt(a)) - getDateTime(getReceiptCreatedAt(b));
        if (sortBy === "amount_desc") return getReceiptAmount(b) - getReceiptAmount(a);
        if (sortBy === "amount_asc") return getReceiptAmount(a) - getReceiptAmount(b);
        if (sortBy === "qty_desc") {
          const aq = getReceiptItems(a).reduce((sum, line) => sum + Number(line.qty || 0), 0);
          const bq = getReceiptItems(b).reduce((sum, line) => sum + Number(line.qty || 0), 0);
          return bq - aq;
        }
        if (sortBy === "supplier_asc") return String(a.supplier?.name || "").localeCompare(String(b.supplier?.name || ""), "vi");
        if (sortBy === "branch_asc") return String(a.branch?.name || "").localeCompare(String(b.branch?.name || ""), "vi");
        return getDateTime(getReceiptCreatedAt(b)) - getDateTime(getReceiptCreatedAt(a));
      });
  }, [
    rows,
    query,
    statusFilter,
    branchFilter,
    supplierFilter,
    createdByFilter,
    categoryFilter,
    colorFilter,
    sizeFilter,
    paymentSourceFilter,
    paymentStatusFilter,
    dateFrom,
    dateTo,
    importDateFrom,
    importDateTo,
    qtyMin,
    qtyMax,
    amountMin,
    amountMax,
    sortBy,
    isAdmin,
    allVariants,
  ]);

  const receiptSummary = useMemo(() => {
    const totalQty = filteredRows.reduce(
      (sum, receipt) => sum + getReceiptItems(receipt).reduce((lineSum, line) => lineSum + Number(line.qty || 0), 0),
      0,
    );
    const totalAmountValue = filteredRows.reduce((sum, receipt) => sum + getReceiptAmount(receipt), 0);
    const paidAmountValue = filteredRows.reduce((sum, receipt) => sum + getPaidAmount(receipt), 0);
    const waitingStock = filteredRows.filter((receipt) => receipt.status === "PAID").length;
    const waitingPayment = filteredRows.filter((receipt) => receipt.status === "PAYMENT_REQUESTED" || receipt.status === "PARTIALLY_PAID").length;

    return {
      totalQty,
      totalAmountValue,
      paidAmountValue,
      debtAmount: Math.max(totalAmountValue - paidAmountValue, 0),
      waitingStock,
      waitingPayment,
    };
  }, [filteredRows]);

  function resetReceiptFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setBranchFilter("ALL");
    setSupplierFilter("ALL");
    setCreatedByFilter("ALL");
    setCategoryFilter("ALL");
    setColorFilter("ALL");
    setSizeFilter("ALL");
    setPaymentSourceFilter("ALL");
    setPaymentStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setImportDateFrom("");
    setImportDateTo("");
    setQtyMin("");
    setQtyMax("");
    setAmountMin("");
    setAmountMax("");
    setSortBy("created_desc");
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const receiptsData = await getPurchaseReceipts();
      setRows(Array.isArray(receiptsData) ? receiptsData : []);

      try {
        const branchesData = await getBranches();
        setBranches(Array.isArray(branchesData) ? branchesData : []);
      } catch (err) {
        console.error("load branches failed", err);
      }

      try {
        const productsData = await getProducts({ page: 1, limit: 10000 } as any);
        setProducts(
          Array.isArray((productsData as any)?.data)
            ? (productsData as any).data
            : Array.isArray(productsData)
              ? productsData
              : []
        );
      } catch (err) {
        console.error("load products failed", err);
      }

      try {
        const suppliersData = await getSuppliers();
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      } catch (err) {
        console.error("load suppliers failed", err);
      }

      try {
        const paymentSourcesData = await getPaymentSources();
        setPaymentSources(Array.isArray(paymentSourcesData) ? paymentSourcesData : []);
      } catch (err) {
        console.error("load payment sources failed", err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu phiếu nhập.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (isAdmin) return;
    if (!currentBranchId) return;

    setBranchId((prev) => {
      if (!prev || String(prev) !== String(currentBranchId)) return currentBranchId;
      return prev;
    });
  }, [currentBranchId, isAdmin]);

  useEffect(() => {
    if (!createOpen) return;

    const keyword = searchVariant.trim();
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        setVariantSearching(true);

        const productsData = await getProducts({
          page: 1,
          limit: keyword ? 500 : 500,
          q: keyword || undefined,
        });

        if (!active) return;

        setProducts(
          Array.isArray((productsData as any)?.data)
            ? (productsData as any).data
            : Array.isArray(productsData)
              ? productsData
              : []
        );
      } catch (err) {
        if (active) {
          console.error("search purchase receipt variants failed", err);
        }
      } finally {
        if (active) setVariantSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [createOpen, searchVariant]);


  function resetCreateForm() {
    const firstSupplier = suppliers.find((s) => s.isActive) || suppliers[0];
    const firstBranch = allowedBranches[0] || branches.find((item) => String(item.id) === String(currentBranchId)) || branches[0];

    setEditingReceiptId(null);
    setSupplierId(firstSupplier?.id || "");
    setBranchId(firstBranch?.id || currentBranchId || "");
    setNote("");
    setItems([]);
    setSearchVariant("");
    setVariantCategoryFilter("ALL");
    setVariantBrandFilter("ALL");
    setVariantColorFilter("ALL");
    setVariantSizeFilter("ALL");
    setVariantStockFilter("ALL");
    setVariantSortBy("recent");
    setDraftSortBy("added_desc");
    setBulkQty("1");
    setBulkUnitCost("");
  }

  function openCreate() {
    resetCreateForm();
    setCreateOpen(true);
    setError(null);
    setNotice(null);
  }

  function openEdit(receipt: PurchaseReceipt) {
    if (receipt.status !== "DRAFT") {
      setError("Chỉ sửa được phiếu đang nháp.");
      return;
    }

    if (getPaidAmount(receipt) > 0) {
      setError("Phiếu đã thanh toán, không được sửa trực tiếp.");
      return;
    }

    if (!isAdmin && currentBranchId && String(receipt.branchId || receipt.branch?.id || "") !== String(currentBranchId)) {
      setError("Không được sửa phiếu nhập của chi nhánh khác.");
      return;
    }

    setEditingReceiptId(receipt.id);
    setSupplierId(receipt.supplierId || receipt.supplier?.id || "");
    setBranchId(isAdmin ? (receipt.branchId || receipt.branch?.id || "") : currentBranchId);
    setNote(receipt.note || "");
    setItems(
      getReceiptItems(receipt).map((item) => ({
        rowId: item.id || makeRowId(),
        variantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        color: item.color || "",
        size: item.size || "",
        qty: String(item.qty || 1),
        unitCost: String(Number(item.unitCost || 0)),
      }))
    );
    setSearchVariant("");
    setCreateOpen(true);
    setError(null);
    setNotice(null);
  }

  function closeForm() {
    setCreateOpen(false);
    setEditingReceiptId(null);
  }


  function toggleReceiptExpanded(receiptId: string) {
    setExpandedReceiptIds((prev) =>
      prev.includes(receiptId)
        ? prev.filter((id) => id !== receiptId)
        : [...prev, receiptId],
    );
  }

  function openPayment(receipt: PurchaseReceipt) {
    const total = getReceiptAmount(receipt);
    const paid = getPaidAmount(receipt);
    const remaining = Math.max(total - paid, 0);
    const firstSource = paymentSources.find((item) => item.isActive);

    setPayingReceipt(receipt);
    setPaymentSourceId(firstSource?.id || "");
    setPaymentAmount(String(remaining));
    setPaymentNote(`Thanh toán NCC ${receipt.supplier?.name || ""} - ${receipt.receiptCode}`.trim());
    setPaymentOpen(true);
    setError(null);
    setNotice(null);
  }

  function closePayment() {
    setPaymentOpen(false);
    setPayingReceipt(null);
    setPaymentSourceId("");
    setPaymentAmount("");
    setPaymentNote("");
  }

  function addVariantToDraft(option: {
    variantId: string;
    sku: string;
    productName: string;
    color?: string;
    size?: string;
    unitCost?: number;
  }) {
    const exists = items.find((item) => item.variantId === option.variantId);
    if (exists) return;

    setItems((prev) => [
      {
        rowId: makeRowId(),
        variantId: option.variantId,
        sku: option.sku,
        productName: option.productName,
        color: option.color || "",
        size: option.size || "",
        qty: bulkQty && Number(bulkQty) > 0 ? bulkQty : "1",
        unitCost: isAdmin ? String(Number(bulkUnitCost || option.unitCost || 0)) : "0",
      },
      ...prev,
    ]);
    // Hàng vừa thêm đẩy lên đầu list để nhập số lượng/giá không phải kéo xuống.
  }


  function addVisibleVariantsToDraft() {
    const existingIds = new Set(items.map((item) => item.variantId));
    const nextItems = variantOptions
      .filter((option) => !existingIds.has(option.variantId))
      .map((option) => ({
        rowId: makeRowId(),
        variantId: option.variantId,
        sku: option.sku,
        productName: option.productName,
        color: option.color || "",
        size: option.size || "",
        qty: bulkQty && Number(bulkQty) > 0 ? bulkQty : "1",
        unitCost: isAdmin ? String(Number(bulkUnitCost || option.unitCost || 0)) : "0",
      }));

    if (!nextItems.length) return;

    setItems((prev) => [...nextItems, ...prev]);
  }

  function applyBulkQtyToDraft() {
    const value = Number(bulkQty || 0);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Số lượng hàng loạt phải lớn hơn 0.");
      return;
    }

    setItems((prev) => prev.map((item) => ({ ...item, qty: String(value) })));
  }

  function applyBulkUnitCostToDraft() {
    const value = Number(bulkUnitCost || 0);
    if (!Number.isFinite(value) || value < 0) {
      setError("Giá nhập hàng loạt không hợp lệ.");
      return;
    }

    setItems((prev) => prev.map((item) => ({ ...item, unitCost: String(value) })));
  }

  function resetVariantPickFilters() {
    setSearchVariant("");
    setVariantCategoryFilter("ALL");
    setVariantBrandFilter("ALL");
    setVariantColorFilter("ALL");
    setVariantSizeFilter("ALL");
    setVariantStockFilter("ALL");
    setVariantSortBy("recent");
  }

  function updateDraftItem(rowId: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item)));
  }

  function removeDraftItem(rowId: string) {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  }

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  );

  async function handleSaveReceipt() {
    const effectiveBranchId = isAdmin ? branchId : currentBranchId;

    if (!effectiveBranchId) {
      setError("Tài khoản chưa được gán chi nhánh làm việc.");
      return;
    }

    if (!isAdmin && branchId && String(branchId) !== String(effectiveBranchId)) {
      setError("Nhân viên chỉ được tạo phiếu nhập cho chi nhánh làm việc.");
      return;
    }

    if (!supplierId) {
      setError("Chưa chọn nhà cung cấp.");
      return;
    }

    if (!items.length) {
      setError("Chưa có dòng hàng nào.");
      return;
    }

    const invalidQty = items.find((item) => Number(item.qty || 0) <= 0);
    if (invalidQty) {
      setError("Số lượng nhập phải lớn hơn 0.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const payload = {
        supplierId,
        branchId: effectiveBranchId,
        note: note.trim() || undefined,
        createdById,
        items: items.map((item) => ({
          variantId: item.variantId,
          qty: Number(item.qty || 0),
          ...(canEditCost ? { unitCost: Number(item.unitCost || 0) } : {}),
        })),
      };

      if (editingReceiptId) {
        await updatePurchaseReceipt(editingReceiptId, payload);
        setNotice("Đã lưu thay đổi phiếu nhập.");
      } else {
        await createPurchaseReceipt(payload);
        setNotice("Đã lưu phiếu nháp.");
      }

      closeForm();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được phiếu nhập.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePayReceipt() {
    if (!payingReceipt) return;

    if (!paymentSourceId) {
      setError("Chưa chọn nguồn tiền thanh toán.");
      return;
    }

    if (Number(paymentAmount || 0) <= 0) {
      setError("Số tiền thanh toán phải lớn hơn 0.");
      return;
    }

    try {
      setPaying(true);
      setError(null);
      setNotice(null);

      await payPurchaseReceipt(payingReceipt.id, {
        paymentSourceId,
        amount: Number(paymentAmount || 0),
        note: paymentNote.trim() || undefined,
        paidById: createdById,
        paidByName: currentUser?.fullName || currentUser?.name || currentUser?.username,
      });

      setNotice("Đã thanh toán nhà cung cấp. Có thể xác nhận nhập kho.");
      closePayment();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thanh toán được phiếu nhập.");
    } finally {
      setPaying(false);
    }
  }

  async function handleRequestPayment(id: string) {
    try {
      setImportingId(id);
      setError(null);
      setNotice(null);
      await requestPaymentPurchaseReceipt(id);
      setNotice("Đã xác nhận đủ hàng.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được phiếu nhập.");
    } finally {
      setImportingId(null);
    }
  }

  async function handleImportStock(id: string) {
    try {
      setImportingId(id);
      setError(null);
      setNotice(null);
      await importStockPurchaseReceipt(id, createdById);
      setNotice("Đã nhập kho thành công.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không nhập kho được.");
    } finally {
      setImportingId(null);
    }
  }

  async function handleComplete(id: string) {
    try {
      setCompletingId(id);
      setError(null);
      setNotice(null);
      await completePurchaseReceipt(id);
      setNotice("Đã hoàn tất thanh toán đơn nhập.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tất được đơn nhập.");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleCancel(id: string) {
    const ok = window.confirm("Hủy phiếu nhập này?");
    if (!ok) return;

    try {
      setCancellingId(id);
      setError(null);
      setNotice(null);
      await cancelPurchaseReceipt(id);
      setNotice("Đã hủy phiếu nhập.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy được phiếu nhập.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-5 p-5">
      <div className="overflow-hidden rounded-[28px] bg-neutral-950 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Inventory purchase V2
            </p>
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight">Phiếu nhập hàng</h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-300">
              Theo dõi phiếu nhập, thanh toán NCC, nhập kho và lọc nhanh theo đầy đủ thông tin trong phiếu.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetReceiptFilters}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              Xóa lọc
            </button>
            {canCreateReceipt ? (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
              >
                + Tạo phiếu nhập
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Số phiếu</p>
            <p className="mt-1 text-2xl font-semibold">{filteredRows.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Tổng SL nhập</p>
            <p className="mt-1 text-2xl font-semibold">{receiptSummary.totalQty}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Chờ thanh toán</p>
            <p className="mt-1 text-2xl font-semibold">{receiptSummary.waitingPayment}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Chờ nhập kho</p>
            <p className="mt-1 text-2xl font-semibold">{receiptSummary.waitingStock}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Còn phải trả NCC</p>
            <p className="mt-1 text-2xl font-semibold">{canViewCost ? currency(receiptSummary.debtAmount) : "—"}</p>
          </div>
        </div>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Bộ lọc phiếu nhập</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Lọc theo mã phiếu, người nhập, nhà cung cấp, kho, ngày tạo, ngày nhập kho, danh mục, SKU, màu, size, nguồn tiền và công nợ.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            {showAdvancedFilters ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã phiếu, SKU, sản phẩm, ghi chú, kho, NCC, người nhập..."
          />

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="PAYMENT_REQUESTED">{isAdmin ? "Chờ thanh toán" : "Đã xác nhận đủ hàng"}</option>
            <option value="PARTIALLY_PAID">{isAdmin ? "Thanh toán một phần" : "Đã xác nhận đủ hàng"}</option>
            <option value="PAID">{isAdmin ? "Đã thanh toán đủ" : "Đã xác nhận đủ hàng"}</option>
            <option value="STOCK_IMPORTED">Đã nhập kho</option>
            <option value="COMPLETED">Hoàn tất</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="ALL">Tất cả kho nhập</option>
            {allowedBranches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
            ))}
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_desc">Mới nhất trước</option>
            <option value="created_asc">Cũ nhất trước</option>
            <option value="amount_desc">Tổng tiền cao → thấp</option>
            <option value="amount_asc">Tổng tiền thấp → cao</option>
            <option value="qty_desc">Số lượng nhiều → ít</option>
            <option value="supplier_asc">Nhà cung cấp A → Z</option>
            <option value="branch_asc">Kho nhập A → Z</option>
          </select>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
              <option value="ALL">Tất cả nhà cung cấp</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
              ))}
            </select>

            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={createdByFilter} onChange={(e) => setCreatedByFilter(e.target.value)}>
              <option value="ALL">Tất cả người nhập</option>
              {receiptFilterOptions.createdBy.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="ALL">Tất cả danh mục sản phẩm</option>
              {receiptFilterOptions.categories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={paymentSourceFilter} onChange={(e) => setPaymentSourceFilter(e.target.value)}>
              <option value="ALL">Tất cả nguồn tiền</option>
              {paymentSources.map((source) => (
                <option key={source.id} value={String(source.id)}>{source.name}</option>
              ))}
            </select>

            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
              <option value="ALL">Tất cả màu</option>
              {receiptFilterOptions.colors.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
              <option value="ALL">Tất cả size</option>
              {receiptFilterOptions.sizes.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả trạng thái tiền</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PARTIAL">Thanh toán một phần</option>
              <option value="PAID_ENOUGH">Đã trả đủ</option>
              <option value="HAS_DEBT">Còn công nợ</option>
              <option value="OVERDUE_ACTION">Cần xử lý tiếp</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="number" min="0" value={qtyMin} onChange={(e) => setQtyMin(e.target.value)} placeholder="SL từ" />
              <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="number" min="0" value={qtyMax} onChange={(e) => setQtyMax(e.target.value)} placeholder="SL đến" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Ngày tạo từ" />
              <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Ngày tạo đến" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="date" value={importDateFrom} onChange={(e) => setImportDateFrom(e.target.value)} title="Ngày nhập kho từ" />
              <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="date" value={importDateTo} onChange={(e) => setImportDateTo(e.target.value)} title="Ngày nhập kho đến" />
            </div>

            {canViewCost ? (
              <div className="grid grid-cols-2 gap-2">
                <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="number" min="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="Tiền từ" />
                <input className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none" type="number" min="0" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="Tiền đến" />
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {error ? (
        <Panel className="p-3">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {notice ? (
        <Panel className="p-3">
          <p className="text-sm text-green-700">{notice}</p>
        </Panel>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <Panel className="p-4">
            <p className="text-sm text-neutral-500">Đang tải phiếu nhập...</p>
          </Panel>
        ) : filteredRows.length === 0 ? (
          <Panel className="p-4">
            <p className="text-sm text-neutral-500">Chưa có phiếu nhập nào.</p>
          </Panel>
        ) : (
          filteredRows.map((receipt) => {
            const receiptItems = getReceiptItems(receipt);
            const receiptQty = receiptItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
            const receiptAmount = getReceiptAmount(receipt);
            const paidAmount = getPaidAmount(receipt);
            const paidEnough = isReceiptPaidEnough(receipt);
            const expanded = expandedReceiptIds.includes(receipt.id);

            return (
              <Panel key={receipt.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openReceiptInNewTab(receipt)}
                        className="text-left text-sm font-semibold text-neutral-900 underline-offset-4 hover:underline"
                        title="Mở phiếu nhập ở tab mới"
                      >
                        {receipt.receiptCode}
                      </button>

                      <Badge tone={getReceiptStatusTone(receipt.status)}>
                        {getReceiptStatusLabel(receipt.status, isAdmin)}
                      </Badge>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-neutral-500">
                      <p>Kho nhập: {receipt.branch?.name || "—"}</p>
                      {canViewCost ? <p>Nhà cung cấp: {receipt.supplier?.name || "—"}</p> : null}
                      <p>Người nhập: {getCreatedByName(receipt)}</p>
                      <p>Ngày tạo: {formatDateTime(getReceiptCreatedAt(receipt))}</p>
                      <p>Ngày nhập kho/hoàn tất: {formatDateTime(getReceiptImportedAt(receipt))}</p>
                      <p>Tổng số lượng: {receiptQty}</p>
                      <p>
                        Số dòng SKU: {receiptItems.length}
                        {receiptItems.length ? (
                          <span className="ml-1 text-neutral-400">
                            · {receiptItems.slice(0, 3).map((line) => line.sku).join(", ")}
                            {receiptItems.length > 3 ? "..." : ""}
                          </span>
                        ) : null}
                      </p>
                      {canViewCost ? <p>Tổng tiền: {currency(receiptAmount)}</p> : null}
                      {canViewCost ? <p>Đã thanh toán: {currency(paidAmount)}</p> : null}
                      {canViewCost ? <p>Còn phải trả: {currency(Math.max(receiptAmount - paidAmount, 0))}</p> : null}
                      {canImportStockReceipt && receipt.status === "PAID" ? (
                        <p className="font-medium text-green-700">Đã thanh toán đủ · chờ nhập kho</p>
                      ) : null}
                      {receipt.note ? <p>Ghi chú: {receipt.note}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                      <a
                        href={`/control/purchase-receipts/${receipt.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                      >
                        Mở tab mới
                      </a>

                      <button
                        type="button"
                        onClick={() => toggleReceiptExpanded(receipt.id)}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                      >
                        {expanded ? "Thu gọn nhanh" : "Xem nhanh"}
                      </button>

                      {receipt.status === "DRAFT" &&
                      (canEditReceipt || canRequestPaymentReceipt || canCancelReceipt) ? (
                        <>
                          {canEditReceipt ? (
                            <button
                              type="button"
                              onClick={() => openEdit(receipt)}
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                            >
                              Sửa phiếu
                            </button>
                          ) : null}

                          {canRequestPaymentReceipt ? (
                            <button
                              type="button"
                              onClick={() => void handleRequestPayment(receipt.id)}
                              disabled={importingId === receipt.id}
                              className={`rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 ${
                                importingId === receipt.id ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            >
                              {importingId === receipt.id ? "Đang xác nhận..." : "Xác nhận đủ hàng"}
                            </button>
                          ) : null}

                          {canCancelReceipt ? (
                            <button
                              type="button"
                              onClick={() => void handleCancel(receipt.id)}
                              disabled={cancellingId === receipt.id}
                              className={`rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ${
                                cancellingId === receipt.id ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            >
                              {cancellingId === receipt.id ? "Đang hủy..." : "Hủy"}
                            </button>
                          ) : null}
                        </>
                      ) : null}

                      {canPayReceipt &&
                      (receipt.status === "PAYMENT_REQUESTED" ||
                        receipt.status === "PARTIALLY_PAID") ? (
                        <a
                          href={`/finance/supplier-payments?receiptId=${receipt.id}`}
                          target="_blank"
                          className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                        >
                          Mở phiếu thanh toán
                        </a>
                      ) : null}

                      {canImportStockReceipt && receipt.status === "PAID" ? (
                        <button
                          onClick={() => void handleImportStock(receipt.id)}
                          disabled={importingId === receipt.id}
                          className={`rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 ${
                            importingId === receipt.id ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        >
                          {importingId === receipt.id ? "Đang nhập kho..." : "Xác nhận nhập kho"}
                        </button>
                      ) : null}

                      {canCompleteReceipt && receipt.status === "STOCK_IMPORTED" ? (
                        <button
                          onClick={() => void handleComplete(receipt.id)}
                          disabled={completingId === receipt.id}
                          className={`rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 ${
                            completingId === receipt.id ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        >
                          {completingId === receipt.id ? "Đang hoàn tất..." : "Hoàn tất"}
                        </button>
                      ) : null}
                    </div>
                </div>

                {expanded ? (
                  <div className="overflow-auto">
                                    <table className="min-w-full text-[13px]">
                                      <thead className="bg-neutral-50 text-left text-neutral-500">
                                        <tr>
                                          <th className="px-3 py-2.5 font-medium">SKU</th>
                                          <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                                          <th className="px-3 py-2.5 font-medium">Màu</th>
                                          <th className="px-3 py-2.5 font-medium">Size</th>
                                          <th className="px-3 py-2.5 font-medium">Số lượng</th>
                                          {isAdmin ? <th className="px-3 py-2.5 font-medium">Giá nhập</th> : null}
                                          {isAdmin ? <th className="px-3 py-2.5 font-medium">Thành tiền</th> : null}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {getReceiptItems(receipt).map((item) => (
                                          <tr key={item.id} className="border-t border-neutral-200">
                                            <td className="px-3 py-2.5 font-medium">{item.sku}</td>
                                            <td className="px-3 py-2.5">{item.productName}</td>
                                            <td className="px-3 py-2.5">{item.color || "—"}</td>
                                            <td className="px-3 py-2.5">{item.size || "—"}</td>
                                            <td className="px-3 py-2.5">{item.qty}</td>
                                            {isAdmin ? (
                                              <td className="px-3 py-2.5">{currency(Number(item.unitCost || 0))}</td>
                                            ) : null}
                                            {isAdmin ? (
                                              <td className="px-3 py-2.5">{currency(Number(item.lineTotal || 0))}</td>
                                            ) : null}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                
                ) : null}
              </Panel>
            );
          })
        )}
      </div>

      <Modal open={createOpen} onClose={closeForm} title={editingReceiptId ? "Sửa phiếu nhập" : "Tạo phiếu nhập"}>
        <div className="space-y-3">
<div className="grid gap-3 md:grid-cols-2">
  {suppliers.filter((item) => item.isActive).length > 0 ? (
    <select
      className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
      value={supplierId}
      onChange={(e) => setSupplierId(e.target.value)}
    >
      <option value="">Chọn nhà cung cấp</option>
      {suppliers
        .filter((item) => item.isActive)
        .map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.code})
          </option>
        ))}
    </select>
  ) : (
    <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
      <span>Chưa có nhà cung cấp nào.</span>
      <a href="/control/suppliers" className="font-medium underline underline-offset-2">
        Tạo NCC
      </a>
    </div>
  )}

  <select
    className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none disabled:bg-neutral-50 disabled:text-neutral-500"
    value={isAdmin ? branchId : currentBranchId}
    onChange={(e) => setBranchId(e.target.value)}
    disabled={!isAdmin}
  >
    <option value="">Chọn kho nhập</option>
    {allowedBranches.map((item) => (
      <option key={item.id} value={item.id}>
        {item.name}
      </option>
    ))}
  </select>
</div>

          <textarea
            className="min-h-[72px] w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú phiếu nhập"
          />

          <Panel className="p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Thêm sản phẩm / variant
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Lọc theo danh mục, nhãn hiệu, màu, size, tồn kho. Hàng vừa thêm sẽ lên đầu bảng nhập.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addVisibleVariantsToDraft}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                >
                  Thêm tất cả đang lọc ({variantOptions.filter((option) => !items.some((line) => line.variantId === option.variantId)).length})
                </button>
                <button
                  type="button"
                  onClick={resetVariantPickFilters}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-50"
                >
                  Xóa lọc
                </button>
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.7fr]">
              <input
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={searchVariant}
                onChange={(e) => setSearchVariant(e.target.value)}
                placeholder="Tìm theo tên sản phẩm, SKU, barcode, màu, size..."
              />

              <select
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={variantCategoryFilter}
                onChange={(e) => setVariantCategoryFilter(e.target.value)}
              >
                <option value="ALL">Tất cả danh mục</option>
                {variantFilterOptions.categories.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={variantBrandFilter}
                onChange={(e) => setVariantBrandFilter(e.target.value)}
              >
                <option value="ALL">Tất cả nhãn hiệu</option>
                {variantFilterOptions.brands.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={variantColorFilter}
                onChange={(e) => setVariantColorFilter(e.target.value)}
              >
                <option value="ALL">Tất cả màu</option>
                {variantFilterOptions.colors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={variantSizeFilter}
                onChange={(e) => setVariantSizeFilter(e.target.value)}
              >
                <option value="ALL">Tất cả size</option>
                {variantFilterOptions.sizes.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-5">
              <select
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={variantStockFilter}
                onChange={(e) => setVariantStockFilter(e.target.value)}
              >
                <option value="ALL">Tất cả tồn kho</option>
                <option value="IN_STOCK">Còn hàng</option>
                <option value="LOW_STOCK">Tồn thấp ≤ 3</option>
                <option value="OUT_OF_STOCK">Hết hàng</option>
              </select>

              <select
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={variantSortBy}
                onChange={(e) => setVariantSortBy(e.target.value)}
              >
                <option value="recent">Mới thêm lên đầu</option>
                <option value="name_asc">Tên A-Z</option>
                <option value="size_asc">Theo size</option>
                <option value="color_asc">Theo màu</option>
                <option value="stock_desc">Tồn cao trước</option>
                <option value="price_desc">Giá nhập cao trước</option>
                <option value="price_asc">Giá nhập thấp trước</option>
              </select>

              <input
                type="number"
                min={1}
                className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                placeholder="SL mặc định"
              />

              {isAdmin ? (
                <input
                  type="number"
                  min={0}
                  className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                  value={bulkUnitCost}
                  onChange={(e) => setBulkUnitCost(e.target.value)}
                  placeholder="Giá nhập mặc định"
                />
              ) : (
                <div />
              )}

              <div className="flex items-center justify-end text-xs font-medium text-neutral-500">
                Hiện {variantOptions.length} SKU phù hợp
              </div>
            </div>

            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-neutral-200">
              {variantSearching ? (
                <div className="p-4 text-sm text-neutral-500">Đang tìm sản phẩm...</div>
              ) : variantOptions.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">Không có variant phù hợp.</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {variantOptions.map((item) => {
                    const added = items.some((line) => line.variantId === item.variantId);

                    return (
                      <button
                        key={item.rowId}
                        type="button"
                        onClick={() => addVariantToDraft(item)}
                        disabled={added}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                          added
                            ? "cursor-not-allowed bg-emerald-50"
                            : "hover:bg-neutral-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">{item.productName}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {item.sku} · {item.color || "—"} / {item.size || "—"}
                            {item.categoryName ? ` · ${item.categoryName}` : ""}
                            {item.brandName ? ` · ${item.brandName}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          {isAdmin ? <p className="font-semibold text-neutral-700">{currency(Number(item.unitCost || 0))}</p> : null}
                          <p className="mt-0.5 text-neutral-500">Tồn: {item.stockQty}</p>
                          <p className={`mt-1 font-medium ${added ? "text-emerald-700" : "text-neutral-500"}`}>
                            {added ? "Đã thêm" : "Thêm"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>

          <Panel className="min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium outline-none"
                  value={draftSortBy}
                  onChange={(e) => setDraftSortBy(e.target.value)}
                >
                  <option value="added_desc">Mới nhập lên đầu</option>
                  <option value="sku_asc">Theo SKU</option>
                  <option value="size_asc">Theo size</option>
                  <option value="color_asc">Theo màu</option>
                  <option value="qty_desc">SL cao trước</option>
                  <option value="qty_asc">SL thấp trước</option>
                  <option value="price_desc">Giá cao trước</option>
                  <option value="price_asc">Giá thấp trước</option>
                </select>

                <input
                  type="number"
                  min={1}
                  className="w-24 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium outline-none"
                  value={bulkQty}
                  onChange={(e) => setBulkQty(e.target.value)}
                  placeholder="SL"
                />
                <button
                  type="button"
                  onClick={applyBulkQtyToDraft}
                  disabled={!items.length}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Áp dụng SL
                </button>

                {isAdmin ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      className="w-32 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium outline-none"
                      value={bulkUnitCost}
                      onChange={(e) => setBulkUnitCost(e.target.value)}
                      placeholder="Giá nhập"
                    />
                    <button
                      type="button"
                      onClick={applyBulkUnitCostToDraft}
                      disabled={!items.length}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Áp dụng giá
                    </button>
                  </>
                ) : null}
              </div>
              <div className="text-xs font-medium text-neutral-500">
                {items.length} SKU · Tổng SL {totalQty}
              </div>
            </div>
            <div className="max-h-[42vh] overflow-auto">
              {items.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">Chưa có dòng hàng nào.</div>
              ) : (
                <table className="min-w-[980px] text-[13px]">
                  <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">SKU</th>
                      <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                      <th className="px-3 py-2.5 font-medium">Màu</th>
                      <th className="px-3 py-2.5 font-medium">Size</th>
                      <th className="px-3 py-2.5 font-medium">Số lượng</th>
                      {isAdmin ? <th className="px-3 py-2.5 font-medium">Giá nhập</th> : null}
                      {isAdmin ? <th className="px-3 py-2.5 font-medium">Thành tiền</th> : null}
                      <th className="px-3 py-2.5 font-medium">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDraftItems.map((item) => {
                      const lineTotal = Number(item.qty || 0) * Number(item.unitCost || 0);

                      return (
                        <tr key={item.rowId} className="border-t border-neutral-200">
                          <td className="px-3 py-2.5 font-medium">{item.sku}</td>
                          <td className="px-3 py-2.5">{item.productName}</td>
                          <td className="px-3 py-2.5">{item.color || "—"}</td>
                          <td className="px-3 py-2.5">{item.size || "—"}</td>
                          <td className="px-3 py-2.5">
                            <input
                              className="w-20 rounded-xl border border-neutral-300 px-3 py-1.5 text-sm outline-none"
                              value={item.qty}
                              onChange={(e) =>
                                updateDraftItem(item.rowId, { qty: e.target.value })
                              }
                            />
                          </td>

                          {isAdmin ? (
                            <td className="px-3 py-2.5">
                              <input
                                className="w-24 rounded-xl border border-neutral-300 px-3 py-1.5 text-sm outline-none"
                                value={item.unitCost}
                                onChange={(e) =>
                                  updateDraftItem(item.rowId, { unitCost: e.target.value })
                                }
                              />
                            </td>
                          ) : null}

                          {isAdmin ? <td className="px-3 py-2.5">{currency(lineTotal)}</td> : null}

                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => removeDraftItem(item.rowId)}
                              className="rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>

          <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
            <div className="text-xs text-neutral-500">
              Tổng số lượng: <span className="font-medium text-neutral-900">{totalQty}</span>
              {canViewCost ? (
                <>
                  {" "}
                  · Tổng tiền:{" "}
                  <span className="font-medium text-neutral-900">{currency(totalAmount)}</span>
                </>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                onClick={closeForm}
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                Đóng
              </button>
              <button
                onClick={() => void handleSaveReceipt()}
                disabled={saving || (editingReceiptId ? !canEditReceipt : !canCreateReceipt)}
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
                  saving ? "cursor-not-allowed bg-neutral-400" : "bg-neutral-900 hover:bg-neutral-800"
                }`}
              >
                {saving ? "Đang lưu..." : editingReceiptId ? "Lưu thay đổi" : "Lưu nháp"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <Modal open={paymentOpen} onClose={closePayment} title="Thanh toán nhà cung cấp">
        <div className="space-y-3">
          <Panel className="p-3">
            <div className="space-y-1 text-sm text-neutral-600">
              <p>
                Phiếu:{" "}
                <span className="font-semibold text-neutral-900">
                  {payingReceipt?.receiptCode || "—"}
                </span>
              </p>
              <p>
                Nhà cung cấp:{" "}
                <span className="font-semibold text-neutral-900">
                  {payingReceipt?.supplier?.name || "—"}
                </span>
              </p>
              <p>
                Tổng tiền:{" "}
                <span className="font-semibold text-neutral-900">
                  {currency(payingReceipt ? getReceiptAmount(payingReceipt) : 0)}
                </span>
              </p>
              <p>
                Đã thanh toán:{" "}
                <span className="font-semibold text-neutral-900">
                  {currency(payingReceipt ? getPaidAmount(payingReceipt) : 0)}
                </span>
              </p>
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={paymentSourceId}
              onChange={(e) => setPaymentSourceId(e.target.value)}
            >
              <option value="">Chọn nguồn tiền</option>
              {paymentSources
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
            </select>

            <input
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Số tiền thanh toán"
            />
          </div>

          <textarea
            className="min-h-[72px] w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder="Ghi chú thanh toán"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={closePayment}
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Đóng
            </button>
            <button
              onClick={() => void handlePayReceipt()}
              disabled={paying || !canPayReceipt}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
                paying ? "cursor-not-allowed bg-neutral-400" : "bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              {paying ? "Đang thanh toán..." : "Xác nhận thanh toán"}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}