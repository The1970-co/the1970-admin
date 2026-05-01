"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

type ViewRole = AppRole | "owner";

type InventorySummary = {
  totalInventoryValue: number;
  totalQty: number;
  totalProducts: number;
  totalSkus: number;
  lowStockSkus: number;
  highestBranch: string;
  branchValues: Record<string, number>;
};

type ImportStockReportResult = {
  success: boolean;
  fileName: string;
  reportRows: number;
  matchedRows: number;
  missingSkuCount: number;
  missingSkus: Array<{
    rowNumber: number;
    sku: string;
    productName: string;
  }>;
  zeroCostSkuCount: number;
  zeroCostSkus: Array<{
    rowNumber: number;
    sku: string;
    productName: string;
    totalQty: number;
  }>;
  updatedInventoryRows: number;
  updatedVariantCosts: number;
  totalImportedQty: number;
  totalImportedValue: number;
  summary?: InventorySummary;
};

type AuditSapoResult = {
  success: boolean;
  fileRows: number;
  matchedSkus: number;
  missingSkuCount: number;
  total: {
    fileQty: number;
    systemQty: number;
    qtyDiff: number;
    fileValue: number;
    systemValue: number;
    valueDiff: number;
  };
  branchTotals: Record<
    string,
    {
      fileQty: number;
      systemQty: number;
      qtyDiff: number;
      fileValue: number;
      systemValue: number;
      valueDiff: number;
    }
  >;
  diffCount: number;
  diffRows: Array<{
    sku: string;
    productName: string;
    branchId: string;
    fileQty: number;
    systemQty: number;
    qtyDiff: number;
    fileCostPrice: number;
    systemCostPrice: number;
    fileValue: number;
    systemValue: number;
    valueDiff: number;
  }>;
};

type TwoFileAuditBranchDiffRow = {
  branchId: string;
  stockReportQty: number;
  productFileQty: number;
  qtyDiff: number;
  stockReportValue: number;
  productFileValue: number;
  diff: number;
  stockCostPrice?: number;
  productCostPrice?: number;
  costPriceDiff?: number;
};

type TwoFileAuditSkuRow = {
  sku: string;
  productCode: string;
  productName: string;
  stockReportQty: number;
  productFileQty: number;
  qtyDiff: number;
  stockReportValue: number;
  productFileValue: number;
  diff: number;
  stockCostPrice?: number;
  productCostPrice?: number;
  costPriceDiff?: number;
  hasCostPriceDiff?: boolean;
  branchDiffRows?: TwoFileAuditBranchDiffRow[];
};

type TwoFileAuditProductRow = {
  productCode: string;
  stockReportValue: number;
  productFileValue: number;
  diff: number;
  stockReportQty: number;
  productFileQty: number;
  qtyDiff: number;
  skuCount: number;
  costDiffSkuCount?: number;
  branchDiffRows?: TwoFileAuditBranchDiffRow[];
  skuRows?: TwoFileAuditSkuRow[];
};

type TwoFileAuditResult = {
  success: boolean;
  stockReportRows: number;
  productFileRows: number;
  total: {
    stockReportQty?: number;
    productFileQty?: number;
    qtyDiff?: number;
    stockReportValue: number;
    productFileValue: number;
    diff: number;
  };
  productDiffRows: TwoFileAuditProductRow[];
  skuDiffRows: TwoFileAuditSkuRow[];
};

type InventoryMovementRow = {
  id: string;
  type: string;
  qty: number;
  beforeQty?: number | null;
  afterQty?: number | null;
  actor?: string | null;
  createdBy?: string | null;
  note?: string | null;
  reason?: string | null;
  refType?: string | null;
  refId?: string | null;
  branchId: string;
  createdAt: string;
  sku?: string;
  productName?: string;
  color?: string;
  size?: string;
};

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function numberFormat(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

function diffToneClass(diff: number) {
  const abs = Math.abs(Number(diff || 0));
  if (abs >= 10_000_000) return "bg-red-50";
  if (abs >= 1_000_000) return "bg-amber-50";
  return "";
}

function diffTextClass(diff: number) {
  if (Number(diff || 0) > 0) return "text-red-700";
  if (Number(diff || 0) < 0) return "text-green-700";
  return "text-neutral-700";
}

function diffBadgeTone(diff: number): "gray" | "green" | "amber" | "red" | "blue" {
  const abs = Math.abs(Number(diff || 0));
  if (abs >= 10_000_000) return "red";
  if (abs >= 1_000_000) return "amber";
  return "gray";
}

function getSkuIssueMeta(row: TwoFileAuditSkuRow) {
  const stockQty = Number(row.stockReportQty || 0);
  const productQty = Number(row.productFileQty || 0);
  const stockValue = Number(row.stockReportValue || 0);
  const productValue = Number(row.productFileValue || 0);
  const stockCost = Number(row.stockCostPrice || 0);
  const productCost = Number(row.productCostPrice || 0);

  if (row.qtyDiff !== 0) {
    return { label: "Lệch tồn", tone: "amber" as const, detail: "Số lượng giữa 2 file không khớp" };
  }

  if (stockQty > 0 && stockValue <= 0 && productCost > 0) {
    return { label: "Thiếu giá vốn kho", tone: "red" as const, detail: "File tồn kho SAPO không có giá vốn/value" };
  }

  if (stockQty === productQty && stockQty > 0 && Math.abs(stockCost - productCost) >= 1) {
    return { label: "Sai giá vốn", tone: "red" as const, detail: "Giá vốn kho khác giá nhập sản phẩm" };
  }

  if (stockQty === productQty && Math.abs(stockValue - productValue) >= 1) {
    return { label: "Lệch value", tone: "amber" as const, detail: "Số lượng khớp nhưng giá trị tồn lệch" };
  }

  return { label: "Khác", tone: "gray" as const, detail: "Cần kiểm tra thêm" };
}

function getAuthHeaders() {
  if (typeof window === "undefined") return {};

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("the1970_token") ||
    "";

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGetInventorySummary(branchId?: string) {
  const query = branchId && branchId !== "ALL" ? `?branchId=${encodeURIComponent(branchId)}` : "";
  const res = await fetch(`${API_BASE}/inventory/summary${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Không tải được báo cáo tồn kho.");
  }

  return (await res.json()) as InventorySummary;
}

async function apiImportStockReport(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/inventory/import-stock-report`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Import báo cáo tồn kho thất bại.");
  }

  return (await res.json()) as ImportStockReportResult;
}

async function apiAuditSapoFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/inventory/audit-sapo-file`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Đối chiếu SAPO thất bại.");
  }

  return (await res.json()) as AuditSapoResult;
}

async function apiAuditTwoSapoFiles(stockReportFile: File, productFile: File) {
  const formData = new FormData();
  formData.append("stockReportFile", stockReportFile);
  formData.append("productFile", productFile);

  const res = await fetch(`${API_BASE}/inventory/audit-two-sapo-files`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Đối chiếu 2 file SAPO thất bại.");
  }

  return (await res.json()) as TwoFileAuditResult;
}

async function apiGetInventoryMovements(limit = 50) {
  const res = await fetch(`${API_BASE}/inventory/movements/history?limit=${limit}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Không tải được ledger kho.");
  }

  return (await res.json()) as InventoryMovementRow[];
}

function scrollToSection(id: string) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 50);
}

function Panel({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
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
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  href,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className =
    "inline-flex items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50";

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} ${disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
    >
      {children}
    </button>
  );
}

type InventoryRow = {
  productId: string;
  productName: string;
  slug: string;
  category: string;
  variantId: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  costPrice: number;
  totalStock: number;
  branchStocks: Record<string, number>;
  reservedStock: number;
  incomingStock: number;
  layerByBranch: Record<
    string,
    { availableQty: number; reservedQty: number; incomingQty: number }
  >;
};

const ALL_BRANCH_VALUE = "ALL";
const LOW_STOCK_THRESHOLD = 3;

export default function InventoryPageClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [importingStockReport, setImportingStockReport] = useState(false);
  const [editingCosts, setEditingCosts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [lastImportResult, setLastImportResult] =
    useState<ImportStockReportResult | null>(null);
  const [auditingSapo, setAuditingSapo] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditSapoResult | null>(null);
  const [ledgerRows, setLedgerRows] = useState<InventoryMovementRow[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [auditingTwoFiles, setAuditingTwoFiles] = useState(false);
  const [stockReportAuditFile, setStockReportAuditFile] = useState<File | null>(null);
  const [productListAuditFile, setProductListAuditFile] = useState<File | null>(null);
  const [twoFileAuditResult, setTwoFileAuditResult] = useState<TwoFileAuditResult | null>(null);
  const [expandedTwoFileProductCode, setExpandedTwoFileProductCode] = useState<string | null>(null);

  const [role, setRole] = useState<ViewRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [missingCostSearch, setMissingCostSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>(ALL_BRANCH_VALUE);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [quickFilter, setQuickFilter] = useState<
    "all" | "missing_cost" | "in_stock" | "low_stock" | "out_stock"
  >("all");
  const [missingCostQuery, setMissingCostQuery] = useState("");
  const [missingCostOnlyInStock, setMissingCostOnlyInStock] = useState(true);
  const [missingCostSort, setMissingCostSort] =
    useState<"value_desc" | "stock_desc" | "sku_asc">("value_desc");

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    const nextRole = (currentUser.role || "admin") as ViewRole;
    setRole(nextRole);
    setCurrentBranchId(currentUser.branchId || null);

    const isPrivileged = nextRole === "admin" || nextRole === "owner";
    if (!isPrivileged && currentUser.branchId) {
      setBranchFilter(currentUser.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";
  const canViewMoney = isOwner;

  const canViewInventory = hasPermission(role as AppRole, "inventory.view");
  const canViewLogs = hasPermission(role as AppRole, "inventory.logs.view");
  const canUseStocktake = hasPermission(role as AppRole, "stocktake.view");

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const visibleBranchOptions = useMemo(() => {
    const scoped = visibleBranches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));

    if (isOwner) {
      return [{ value: ALL_BRANCH_VALUE, label: "Tất cả chi nhánh" }, ...scoped];
    }

    return scoped;
  }, [visibleBranches, isOwner]);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const data = await getBranches();
      setBranches(data);
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadSummary = async (selectedBranch = branchFilter) => {
    if (!canViewInventory) return;

    try {
      setLoadingSummary(true);
      const nextSummary = await apiGetInventorySummary(selectedBranch);
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được báo cáo tồn kho.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleAuditFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/inventory/audit-sapo-file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    });

    const data = await res.json();
    setAuditResult(data);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getProducts({ page: 1, limit: 1000 });
      setProducts(Array.isArray(result) ? result : result.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được dữ liệu kho."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryMovements = async () => {
    if (!canViewLogs) return;

    try {
      setLoadingLedger(true);
      const rows = await apiGetInventoryMovements(50);
      setLedgerRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không tải được ledger kho."
      );
    } finally {
      setLoadingLedger(false);
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadProducts(), loadSummary(branchFilter), loadInventoryMovements()]);
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    if (canViewInventory) {
      void reloadAll();
    }
  }, [canViewInventory]);

  useEffect(() => {
    if (canViewInventory) {
      void loadSummary(branchFilter);
    }
  }, [branchFilter, canViewInventory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const rows = useMemo<InventoryRow[]>(() => {
    return products.flatMap((product) => {
      return product.variants.map((variant) => {
        const v = variant as any;

        const branchStocks: Record<string, number> =
          (v.inventoryByBranch || v.branchStocks || {}) as Record<string, number>;

        const rawInventoryItems =
          v.inventoryItems ||
          v.inventoryLayerItems ||
          v.inventoryLayers ||
          [];

        const layerByBranch: InventoryRow["layerByBranch"] = {};

        if (Array.isArray(rawInventoryItems)) {
          for (const item of rawInventoryItems) {
            const branchId = String(item.branchId || "").trim();
            if (!branchId) continue;

            layerByBranch[branchId] = {
              availableQty: Number(item.availableQty || 0),
              reservedQty: Number(item.reservedQty || 0),
              incomingQty: Number(item.incomingQty || 0),
            };
          }
        }

        for (const [branchId, qty] of Object.entries(branchStocks)) {
          if (!layerByBranch[branchId]) {
            layerByBranch[branchId] = {
              availableQty: Number(qty || 0),
              reservedQty: Number(v.reservedQtyByBranch?.[branchId] || 0),
              incomingQty: Number(v.incomingQtyByBranch?.[branchId] || 0),
            };
          }
        }

        const totalStock = Object.values(branchStocks).reduce(
          (sum: number, qty: any) => sum + Number(qty || 0),
          0
        );

        const reservedStock = Object.values(layerByBranch).reduce(
          (sum, item) => sum + Number(item.reservedQty || 0),
          0
        );

        const incomingStock = Object.values(layerByBranch).reduce(
          (sum, item) => sum + Number(item.incomingQty || 0),
          0
        );

        return {
          productId: product.id,
          productName: product.name,
          slug: product.slug || "",
          category: product.category || "—",
          variantId: variant.id,
          sku: variant.sku,
          color: variant.color || "—",
          size: variant.size || "—",
          price: Number(variant.price || 0),

          // Quan trọng: ép lấy đúng giá vốn
          costPrice: Number(v.costPrice ?? v.cost ?? 0),

          totalStock,
          branchStocks,
          reservedStock,
          incomingStock,
          layerByBranch,
        };
      });
    });
  }, [products]);

  const getScopedQty = (row: InventoryRow, selectedBranchId: string) => {
    if (selectedBranchId === ALL_BRANCH_VALUE) {
      if (isOwner) return row.totalStock;
      return Number(row.branchStocks[currentBranchId || ""] || 0);
    }

    return Number(row.branchStocks[selectedBranchId] || 0);
  };

  const getScopedReservedQty = (row: InventoryRow, selectedBranchId: string) => {
    if (selectedBranchId === ALL_BRANCH_VALUE) {
      if (isOwner) return Number(row.reservedStock || 0);
      return Number(row.layerByBranch[currentBranchId || ""]?.reservedQty || 0);
    }

    return Number(row.layerByBranch[selectedBranchId]?.reservedQty || 0);
  };

  const getScopedIncomingQty = (row: InventoryRow, selectedBranchId: string) => {
    if (selectedBranchId === ALL_BRANCH_VALUE) {
      if (isOwner) return Number(row.incomingStock || 0);
      return Number(row.layerByBranch[currentBranchId || ""]?.incomingQty || 0);
    }

    return Number(row.layerByBranch[selectedBranchId]?.incomingQty || 0);
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const scopedQty = getScopedQty(row, branchFilter);
      const isMissingCost = Number(row.costPrice || 0) <= 0;

      const matchQuery =
        !q ||
        row.productName.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q) ||
        row.size.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q);

      const matchLowStock = !lowStockOnly || scopedQty <= LOW_STOCK_THRESHOLD;

      const matchQuickFilter =
        quickFilter === "all"
          ? true
          : quickFilter === "missing_cost"
            ? isMissingCost
            : quickFilter === "in_stock"
              ? scopedQty > 0
              : quickFilter === "low_stock"
                ? scopedQty > 0 && scopedQty <= LOW_STOCK_THRESHOLD
                : quickFilter === "out_stock"
                  ? scopedQty <= 0
                  : true;

      return matchQuery && matchLowStock && matchQuickFilter;
    });
  }, [
    rows,
    query,
    branchFilter,
    currentBranchId,
    isOwner,
    lowStockOnly,
    quickFilter,
  ]);

  const scopedTotalQtyFallback = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      return sum + getScopedQty(row, branchFilter);
    }, 0);
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const scopedTotalValueFallback = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      return sum + getScopedQty(row, branchFilter) * Number(row.costPrice || 0);
    }, 0);
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const scopedReservedQtyFallback = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      return sum + getScopedReservedQty(row, branchFilter);
    }, 0);
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const scopedIncomingQtyFallback = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      return sum + getScopedIncomingQty(row, branchFilter);
    }, 0);
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const lowStockCountFallback = useMemo(() => {
    return filteredRows.filter(
      (row) => getScopedQty(row, branchFilter) <= LOW_STOCK_THRESHOLD
    ).length;
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const outOfStockCount = useMemo(() => {
    return filteredRows.filter((row) => getScopedQty(row, branchFilter) <= 0)
      .length;
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const topValueBranch = useMemo(() => {
    if (!visibleBranches.length) return "—";

    if (summary?.highestBranch) {
      const found = branches.find((b) => b.id === summary.highestBranch);
      return found?.name || summary.highestBranch;
    }

    let bestBranch: BranchItem | null = null;
    let bestValue = -1;

    for (const branch of visibleBranches) {
      const value = rows.reduce((sum, row) => {
        return sum + Number(row.costPrice || 0) * Number(row.branchStocks[branch.id] || 0);
      }, 0);

      if (value > bestValue) {
        bestValue = value;
        bestBranch = branch;
      }
    }

    return bestBranch ? bestBranch.name : "—";
  }, [rows, visibleBranches, summary, branches]);

  const currentScopeLabel = useMemo(() => {
    if (branchFilter === ALL_BRANCH_VALUE) {
      return isOwner
        ? "Toàn hệ thống"
        : visibleBranches.map((b) => b.name).join(", ") || "Chưa gán chi nhánh";
    }

    return branches.find((b) => b.id === branchFilter)?.name || branchFilter;
  }, [branchFilter, isOwner, visibleBranches, branches]);

  const summaryTotalValue =
    summary?.totalInventoryValue ?? scopedTotalValueFallback;
  const summaryTotalQty = summary?.totalQty ?? scopedTotalQtyFallback;
  const summaryProductCount =
    summary?.totalProducts ?? new Set(products.map((p) => p.id)).size;
  const summarySkuCount = summary?.totalSkus ?? filteredRows.length;
  const summaryLowStock = summary?.lowStockSkus ?? lowStockCountFallback;

  const currentMissingCostRows = useMemo(() => {
    const q = missingCostSearch.trim().toLowerCase();

    return rows
      // lấy tất cả SKU thiếu giá vốn
      .filter((row) => Number(row.costPrice || 0) <= 0)

      // filter theo search
      .filter((row) => {
        if (!q) return true;

        return (
          row.sku.toLowerCase().includes(q) ||
          row.productName.toLowerCase().includes(q) ||
          row.color.toLowerCase().includes(q) ||
          row.size.toLowerCase().includes(q)
        );
      })

      // map ra data hiển thị
      .map((row) => {
        const suggestedCost = Math.round(Number(row.price || 0) * 0.4);
        const totalQty = Number(row.totalStock || 0);

        return {
          variantId: row.variantId,
          sku: row.sku,
          productName: row.productName,
          productId: row.productId,
          color: row.color,
          size: row.size,
          totalQty,
          price: row.price,
          suggestedCost,
          missingValue: totalQty * suggestedCost,
        };
      })

      // sort: ưu tiên thằng có tồn
      .sort((a, b) => {
        if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
        return b.missingValue - a.missingValue;
      });
  }, [rows, missingCostSearch]);

  const currentMissingCostSkuCount = currentMissingCostRows.length;

  const currentMissingCostStockQty = currentMissingCostRows.reduce(
    (sum, item) => sum + Number(item.totalQty || 0),
    0
  );

  const currentMissingCostTotalValue = currentMissingCostRows.reduce(
    (sum, item) => sum + Number(item.missingValue || 0),
    0
  );

  const missingCostRows = useMemo(() => {
    const source =
      lastImportResult?.zeroCostSkus?.map((item) => {
        const row = rows.find((r) => r.sku === item.sku);
        const price = Number(row?.price || 0);
        const suggestedCost = Math.round(price * 0.4);
        const totalQty = Number(item.totalQty || row?.totalStock || 0);

        return {
          sku: item.sku,
          productName: item.productName || row?.productName || "—",
          totalQty,
          price,
          suggestedCost,
          missingValue: totalQty * suggestedCost,
          productId: row?.productId || "",
          color: row?.color || "—",
          size: row?.size || "—",
        };
      }) || [];

    const q = missingCostQuery.trim().toLowerCase();

    return source
      .filter((item) => {
        const matchQuery =
          !q ||
          item.sku.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q) ||
          item.color.toLowerCase().includes(q) ||
          item.size.toLowerCase().includes(q);

        const matchStock = !missingCostOnlyInStock || item.totalQty > 0;

        return matchQuery && matchStock;
      })
      .sort((a, b) => {
        if (missingCostSort === "stock_desc") return b.totalQty - a.totalQty;
        if (missingCostSort === "sku_asc") return a.sku.localeCompare(b.sku);
        return b.missingValue - a.missingValue;
      });
  }, [
    lastImportResult,
    rows,
    missingCostQuery,
    missingCostOnlyInStock,
    missingCostSort,
  ]);

  const missingCostTotalQty = missingCostRows.reduce(
    (sum, item) => sum + item.totalQty,
    0
  );

  const missingCostEstimatedValue = missingCostRows.reduce(
    (sum, item) => sum + item.missingValue,
    0
  );

  const fillAllSuggestedCosts = () => {
    const source = currentMissingCostRows.length > 0 ? currentMissingCostRows : missingCostRows;
    const next: Record<string, number> = {};

    for (const item of source) {
      if (item.suggestedCost > 0) {
        next[item.sku] = item.suggestedCost;
      }
    }

    setEditingCosts((prev) => ({ ...prev, ...next }));
  };

  const handleUploadStockReport = async (file: File | null) => {
    if (!file) return;

    const ok = window.confirm(
      "Import báo cáo tồn kho SAPO sẽ ghi đè tồn kho hiện tại theo file. Tiếp tục?"
    );
    if (!ok) return;

    try {
      setImportingStockReport(true);
      setActionMessage("");
      setLastImportResult(null);

      const result = await apiImportStockReport(file);
      setLastImportResult(result);

      setActionMessage(
        `Đã import báo cáo kho: match ${result.matchedRows}/${result.reportRows} dòng, cập nhật ${result.updatedInventoryRows} dòng tồn kho, ${result.updatedVariantCosts} giá vốn.`
      );

      await reloadAll();
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Import báo cáo tồn kho thất bại."
      );
    } finally {
      setImportingStockReport(false);
    }
  };
  const autoFillCost = (sku: string, price: number) => {
    const val = Math.round(price * 0.4);
    setEditingCosts((prev) => ({ ...prev, [sku]: val }));
  };

  const saveMissingCosts = async () => {
    const items = Object.entries(editingCosts)
      .filter(([, costPrice]) => Number(costPrice) > 0)
      .map(([sku, costPrice]) => {
        const found = currentMissingCostRows.find((row) => row.sku === sku);

        return {
          variantId: found?.variantId || "",
          sku,
          costPrice: Number(costPrice),
        };
      })
      .filter((item) => item.variantId);

    if (items.length === 0) {
      alert("Chưa nhập giá vốn nào để lưu.");
      return;
    }

    const res = await fetch(`${API_BASE}/products/missing-cost/bulk-update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      alert(text || "Lưu giá vốn thất bại.");
      return;
    }

    alert(`Đã lưu giá vốn cho ${items.length} SKU.`);
    setEditingCosts({});
    await reloadAll();
  };

  const exportMissingCostCSV = () => {
    if (!lastImportResult?.zeroCostSkus) return;

    const csv = lastImportResult.zeroCostSkus
      .map((i) => `${i.sku},${i.productName},${i.totalQty}`)
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "missing-cost.csv";
    a.click();
  };
  const handleAuditSapoFile = async (file: File | null) => {
    if (!file) return;

    try {
      setAuditingSapo(true);
      setActionMessage("");
      setAuditResult(null);

      const result = await apiAuditSapoFile(file);
      setAuditResult(result);

      setActionMessage(
        `Đối chiếu xong: match ${result.matchedSkus}/${result.fileRows} SKU, lệch ${currency(result.total.valueDiff)}.`
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Đối chiếu SAPO thất bại."
      );
    } finally {
      setAuditingSapo(false);
    }
  };


  const handleAuditTwoSapoFiles = async () => {
    if (!stockReportAuditFile || !productListAuditFile) {
      setActionMessage("Cần chọn đủ 2 file: Báo cáo tồn kho và Danh sách sản phẩm.");
      return;
    }

    try {
      setAuditingTwoFiles(true);
      setActionMessage("");
      setTwoFileAuditResult(null);

      const result = await apiAuditTwoSapoFiles(stockReportAuditFile, productListAuditFile);
      setTwoFileAuditResult(result);
      setExpandedTwoFileProductCode(result.productDiffRows?.[0]?.productCode || null);
      setActionMessage(
        `Đã đối chiếu 2 file SAPO: lệch ${currency(result.total.diff)}. Xem bảng mã SP gây lệch bên dưới.`
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Đối chiếu 2 file SAPO thất bại."
      );
    } finally {
      setAuditingTwoFiles(false);
    }
  };

  const lockCostBlockingSkuCount = currentMissingCostRows.filter(
    (item) => Number(item.totalQty || 0) > 0
  ).length;

  const inventoryControlCards = [
    {
      title: "SKU thiếu giá vốn",
      status: lockCostBlockingSkuCount > 0 ? "Cần xử lý" : "Đạt",
      tone: lockCostBlockingSkuCount > 0 ? "red" : "green",
      value: `${numberFormat(currentMissingCostRows.length)} thiếu / ${numberFormat(lockCostBlockingSkuCount)} có tồn`,
      desc:
        lockCostBlockingSkuCount > 0
          ? "Ưu tiên bổ sung giá vốn cho SKU đang còn tồn để kho và sổ sách không lệch."
          : "Không có SKU còn tồn bị thiếu giá vốn trong phạm vi hiện tại.",
    },
    {
      title: "Tồn bán được",
      status: "Đã có nền",
      tone: "blue",
      value: "Bán được / giữ đơn / đang về",
      desc: "Tồn hiển thị theo trạng thái bán được, đã giữ cho đơn và hàng đang chuyển về.",
    },
    {
      title: "Lịch sử kho",
      status: canViewLogs ? "Đã có UI" : "Chưa mở quyền",
      tone: canViewLogs ? "green" : "amber",
      value: "Nhập / xuất / chỉnh tồn",
      desc: "Theo dõi mọi biến động kho: nhập, xuất, chuyển kho, kiểm kho và điều chỉnh.",
    },
    {
      title: "Đối chiếu SAPO",
      status: twoFileAuditResult ? "Đang có dữ liệu" : "Chờ đối chiếu",
      tone: twoFileAuditResult ? "green" : "gray",
      value: twoFileAuditResult
        ? currency(twoFileAuditResult.total.diff)
        : "Upload 2 file",
      desc: "So sánh báo cáo tồn kho và danh sách sản phẩm để bóc lệch giá vốn, số lượng và SKU.",
    },
  ] as const;

  const handleControlCenterCardClick = (title: string) => {
    if (title === "SKU thiếu giá vốn") {
      setQuickFilter("missing_cost");
      scrollToSection("missing-cost-center");
      return;
    }

    if (title === "Tồn bán được") {
      scrollToSection("inventory-layers-center");
      setActionMessage(
        "Tồn bán được: availableQty là tồn bán được, reservedQty là tồn đã giữ cho đơn, incomingQty là hàng đang chuyển về. Nếu reserved/incoming đang bằng 0 thì backend order/transfer chưa ghi vào 2 cột này."
      );
      return;
    }

    if (title === "Lịch sử kho") {
      void loadInventoryMovements();
      scrollToSection("ledger-center");
      return;
    }

    if (title === "Đối chiếu SAPO") {
      setShowAuditModal(true);
      scrollToSection("audit-fix-center");
    }
  };

  if (!canViewInventory) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">
          Role hiện tại không có quyền xem kho hàng.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Kho hàng</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kho hàng dùng dữ liệu nội bộ làm chuẩn: tồn kho theo chi nhánh, giá trị tồn = tồn × giá vốn sản phẩm. SAPO chỉ dùng để import/audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {isOwner ? (
            <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800">
              {importingStockReport ? "Đang import kho..." : "Upload báo cáo tồn kho"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importingStockReport}
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0] || null;

                  try {
                    await handleUploadStockReport(file);
                  } finally {
                    input.value = "";
                  }
                }}
              />
            </label>
          ) : null}

          {canUseStocktake ? (
            <Button href="/control/stocktake">Đi tới kiểm kho</Button>
          ) : null}

          {canViewLogs ? (
            <Button href="/control/inventory-logs">Lịch sử kho</Button>
          ) : null}

          <Button href="/products/missing-cost">SKU thiếu giá vốn</Button>
          <button
            className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-100"
            onClick={() => setShowAuditModal(true)}
          >
            Đối chiếu SAPO
          </button>
        </div>
      </div>

      <Panel className="overflow-hidden border-neutral-900">
        <div className="border-b border-neutral-200 bg-neutral-950 px-5 py-4 text-white">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold">Báo cáo nhanh kho hàng</p>
              <p className="mt-1 text-sm text-neutral-300">
                Giá trị tồn, SKU, tồn thấp và giá trị theo từng chi nhánh.
              </p>
            </div>
            <Badge tone={lockCostBlockingSkuCount > 0 ? "red" : "green"}>
              {lockCostBlockingSkuCount > 0
                ? `${numberFormat(lockCostBlockingSkuCount)} SKU cần xử lý`
                : "Giá vốn OK"}
            </Badge>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {canViewMoney ? (
              <Panel>
                <div className="p-5">
                  <p className="text-sm text-neutral-500">Tổng giá trị tồn kho</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    {loadingSummary ? "Đang tải..." : currency(summaryTotalValue)}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-500">
                    Giá vốn × tồn kho · {currentScopeLabel}
                  </p>
                </div>
              </Panel>
            ) : (
              <Panel>
                <div className="p-5">
                  <p className="text-sm text-neutral-500">Tổng số lượng tồn</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    {numberFormat(summaryTotalQty)}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-500">
                    Theo {currentScopeLabel}
                  </p>
                </div>
              </Panel>
            )}

            <Panel>
              <div className="p-5">
                <p className="text-sm text-neutral-500">Tổng sản phẩm</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {numberFormat(summaryProductCount)}
                </h3>
                <p className="mt-2 text-xs text-neutral-500">Sản phẩm cha đang theo dõi</p>
              </div>
            </Panel>

            <Panel>
              <div className="p-5">
                <p className="text-sm text-neutral-500">Tổng mã hàng / SKU</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {numberFormat(summarySkuCount)}
                </h3>
                <p className="mt-2 text-xs text-neutral-500">Tổng variant đang theo dõi</p>
              </div>
            </Panel>

            <Panel>
              <div className="p-5">
                <p className="text-sm text-neutral-500">SKU tồn thấp</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                  {numberFormat(summaryLowStock)}
                </h3>
                <p className="mt-2 text-xs text-neutral-500">
                  Ngưỡng ≤ {LOW_STOCK_THRESHOLD}
                </p>
              </div>
            </Panel>
          </div>

          {canViewMoney ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {visibleBranches.map((branch) => {
                const branchQty = rows.reduce(
                  (sum, row) => sum + Number(row.branchStocks[branch.id] || 0),
                  0
                );

                const branchValue = rows.reduce(
                  (sum, row) =>
                    sum +
                    Number(row.branchStocks[branch.id] || 0) *
                    Number(row.costPrice || 0),
                  0
                );

                return (
                  <Panel key={branch.id}>
                    <div className="p-5">
                      <p className="text-sm text-neutral-500">{branch.name}</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                        {currency(branchValue)}
                      </h3>
                      <p className="mt-2 text-xs text-neutral-500">
                        Tồn: {numberFormat(branchQty)} sản phẩm
                      </p>
                    </div>
                  </Panel>
                );
              })}
            </div>
          ) : null}

          {canViewMoney ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Panel>
                <div className="p-5">
                  <p className="text-sm text-neutral-500">Tổng số lượng tồn</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    {numberFormat(summaryTotalQty)}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-500">
                    Tổng tồn tất cả SKU trong scope
                  </p>
                </div>
              </Panel>

              <Panel>
                <div className="p-5">
                  <p className="text-sm text-neutral-500">Chi nhánh giá trị cao nhất</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    {topValueBranch}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-500">
                    Tính theo giá vốn × tồn kho
                  </p>
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
      </Panel>

      {canViewMoney ? (
        <Panel className="overflow-hidden border-neutral-900">
          <div className="border-b border-neutral-200 bg-neutral-950 px-5 py-4 text-white">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-lg font-semibold">Tổng quan kho & cảnh báo</p>
                <p className="mt-1 text-sm text-neutral-300">
                  Snapshot nhanh giá trị tồn, SKU cần xử lý và các công cụ kiểm tra kho.
                </p>
              </div>
              <Badge tone={lockCostBlockingSkuCount > 0 ? "red" : "green"}>
                {lockCostBlockingSkuCount > 0
                  ? numberFormat(lockCostBlockingSkuCount) + " SKU cần khóa cost"
                  : "Cost sạch"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {inventoryControlCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => handleControlCenterCardClick(card.title)}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-neutral-900">{card.title}</p>
                  <Badge tone={card.tone as any}>{card.status}</Badge>
                </div>
                <p className="mt-3 text-lg font-semibold text-neutral-900">{card.value}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-500">{card.desc}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-3 border-t border-neutral-200 bg-white p-5 md:grid-cols-3">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="font-medium text-red-800">1. SKU thiếu giá vốn</p>
              <p className="mt-1 text-xs text-red-700">
                SKU có tồn mà cost = 0 phải xử lý trước khi nhập/xuất/chuyển kho.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="font-medium text-blue-800">2. Tồn bán được</p>
              <p className="mt-1 text-xs text-blue-700">
                Sellable = available. Đơn chưa xuất phải vào reserved để tránh bán âm.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="font-medium text-amber-800">3. Lịch sử bắt buộc</p>
              <p className="mt-1 text-xs text-amber-700">
                Mọi chỉnh kho phải có log trước/sau, người thao tác và lý do.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {canViewMoney ? (
        <Panel id="inventory-layers-center" className="overflow-hidden border-blue-200">
          <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-medium text-blue-900">Tồn bán được / 3 trạng thái tồn</p>
                <p className="mt-1 text-sm text-blue-700">
                  Tồn bán được phải tách khỏi tồn đã giữ cho đơn và hàng đang chuyển về.
                </p>
              </div>
              <Badge tone="blue">Bán được / giữ đơn / đang về</Badge>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-500">availableQty · tồn bán được</p>
              <p className="mt-2 text-2xl font-semibold">{numberFormat(summaryTotalQty)}</p>
              <p className="mt-1 text-xs text-neutral-500">Đang dùng để bán và tính giá trị kho.</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-500">reservedQty · tồn đã giữ</p>
              <p className="mt-2 text-2xl font-semibold">{numberFormat(scopedReservedQtyFallback)}</p>
              <p className="mt-1 text-xs text-neutral-500">Đơn đã tạo/giữ hàng nhưng chưa xuất kho.</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-500">incomingQty · hàng đang về</p>
              <p className="mt-2 text-2xl font-semibold">{numberFormat(scopedIncomingQtyFallback)}</p>
              <p className="mt-1 text-xs text-neutral-500">Hàng đang chuyển kho hoặc đang nhập về.</p>
            </div>
          </div>
        </Panel>
      ) : null}

      {canViewLogs ? (
        <Panel id="ledger-center" className="overflow-hidden border-amber-200">
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-medium text-amber-900">Lịch sử kho gần nhất</p>
                <p className="mt-1 text-sm text-amber-700">
                  Mọi nhập/xuất/chuyển/kiểm kho phải có log để truy vết.
                </p>
              </div>
              <button
                type="button"
                onClick={loadInventoryMovements}
                className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                {loadingLedger ? "Đang tải..." : "Tải ledger"}
              </button>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1050px] text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Kho</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">SL</th>
                  <th className="px-4 py-3">Before</th>
                  <th className="px-4 py-3">After</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.length > 0 ? (
                  ledgerRows.slice(0, 30).map((row) => (
                    <tr key={row.id} className="border-t border-neutral-200">
                      <td className="px-4 py-3">{row.createdAt}</td>
                      <td className="px-4 py-3 font-medium">{row.sku || "—"}</td>
                      <td className="px-4 py-3">{row.productName || "—"}</td>
                      <td className="px-4 py-3">{row.branchId}</td>
                      <td className="px-4 py-3">{row.type}</td>
                      <td className="px-4 py-3 font-semibold">{numberFormat(row.qty)}</td>
                      <td className="px-4 py-3">{row.beforeQty ?? "—"}</td>
                      <td className="px-4 py-3">{row.afterQty ?? "—"}</td>
                      <td className="px-4 py-3">{row.actor || row.createdBy || "—"}</td>
                      <td className="px-4 py-3">{row.reason || row.note || row.refType || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                      Chưa có dữ liệu biến động kho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel className="bg-white p-4">
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_0.8fr_auto]">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm SKU / tên sản phẩm / variant..."
            />

            <select
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={!isOwner || loadingBranches}
            >
              {visibleBranchOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end text-sm text-neutral-500">
              {numberFormat(filteredRows.length)} SKU
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["all", "Tất cả"],
              ["missing_cost", "Thiếu giá vốn"],
              ["in_stock", "Còn tồn"],
              ["low_stock", "Tồn thấp"],
              ["out_stock", "Hết hàng"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuickFilter(value as typeof quickFilter)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${quickFilter === value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setLowStockOnly((v) => !v)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${lowStockOnly
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
            >
              {lowStockOnly ? "Đang lọc tồn thấp" : "Lọc tồn thấp"}
            </button>
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

      {lastImportResult ? (
        <Panel className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-neutral-500">Dòng báo cáo</p>
              <p className="text-lg font-semibold">{lastImportResult.reportRows}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Đã match SKU</p>
              <p className="text-lg font-semibold">{lastImportResult.matchedRows}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Tổng tồn import</p>
              <p className="text-lg font-semibold">
                {numberFormat(lastImportResult.totalImportedQty)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Giá trị file SAPO</p>
              <p className="text-lg font-semibold">
                {currency(lastImportResult.totalImportedValue)}
              </p>
            </div>
          </div>

          {lastImportResult.missingSkuCount > 0 ? (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">
                Có {lastImportResult.missingSkuCount} SKU trong file chưa tồn tại trong hệ thống.
              </p>
              <p className="mt-1">
                Kiểm tra lại file sản phẩm đã import đủ SKU chưa. Một vài SKU đầu:
              </p>
              <div className="mt-2 max-h-32 overflow-auto">
                {lastImportResult.missingSkus.slice(0, 20).map((item) => (
                  <div key={`${item.rowNumber}-${item.sku}`}>
                    Dòng {item.rowNumber}: {item.sku} · {item.productName}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {canViewMoney ? (
        <Panel className="overflow-hidden">
          <div className="border-b border-neutral-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-medium text-neutral-900">Trung tâm đối chiếu dữ liệu kho</p>
                <p className="mt-1 text-sm text-neutral-500">
                  Gom nhanh 2 việc quan trọng: SKU thiếu giá vốn và đối chiếu SAPO.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
                  {auditingSapo ? "Đang đối chiếu..." : "Upload file SAPO để đối chiếu"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={auditingSapo}
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0] || null;
                      try {
                        await handleAuditSapoFile(file);
                      } finally {
                        input.value = "";
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Mở bảng đối chiếu lớn
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 xl:grid-cols-2">
            <div id="missing-cost-center" className={`rounded-3xl border p-5 ${currentMissingCostRows.length > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-600">SKU thiếu giá vốn</p>
                  <p className={`mt-2 text-3xl font-semibold ${currentMissingCostRows.length > 0 ? "text-red-700" : "text-green-700"}`}>
                    {numberFormat(currentMissingCostRows.length)} SKU
                  </p>
                </div>

                {currentMissingCostRows.length > 0 ? (
                  <Badge tone="red">Cần xử lý</Badge>
                ) : (
                  <Badge tone="green">Ổn</Badge>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="text-xs text-neutral-500">Tổng tồn bị ảnh hưởng</p>
                  <p className="mt-1 font-semibold">{numberFormat(currentMissingCostStockQty)}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3">
                  <p className="text-xs text-neutral-500">Ước tính giá trị thiếu</p>
                  <p className="mt-1 font-semibold">{currency(currentMissingCostTotalValue)}</p>
                </div>
              </div>

              <div className="mt-4 mb-4">
                <input
                  value={missingCostSearch}
                  onChange={(e) => setMissingCostSearch(e.target.value)}
                  placeholder="Tìm trong SKU thiếu giá vốn: SKU, tên, màu, size..."
                  className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>

              {currentMissingCostRows.length > 0 ? (
                <div className="mt-4 max-h-72 overflow-auto rounded-2xl border border-red-100 bg-white">
                  <table className="min-w-[850px] text-sm">
                    <thead className="bg-red-50 text-left text-red-800">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Sản phẩm</th>
                        <th className="px-3 py-2">Tồn</th>
                        <th className="px-3 py-2">Giá bán</th>
                        <th className="px-3 py-2">Gợi ý</th>
                        <th className="px-3 py-2">Nhập giá vốn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentMissingCostRows.map((item) => (
                        <tr key={item.sku} className="border-t border-neutral-200">
                          <td className="px-3 py-2 font-medium">{item.sku}</td>
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2">{numberFormat(item.totalQty)}</td>
                          <td className="px-3 py-2">{currency(item.price)}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCosts((prev) => ({
                                  ...prev,
                                  [item.sku]: item.suggestedCost,
                                }))
                              }
                              className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              {currency(item.suggestedCost)}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editingCosts[item.sku] || ""}
                              onChange={(e) =>
                                setEditingCosts((prev) => ({
                                  ...prev,
                                  [item.sku]: Number(e.target.value),
                                }))
                              }
                              className="w-32 rounded-xl border border-neutral-300 px-3 py-2 outline-none"
                              placeholder="Giá vốn"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-green-700">
                  Không tìm thấy SKU thiếu giá vốn phù hợp với bộ lọc hiện tại.
                </p>
              )}

              {currentMissingCostRows.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={fillAllSuggestedCosts}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                  >
                    Điền nhanh 40%
                  </button>
                  <button
                    type="button"
                    onClick={saveMissingCosts}
                    className="rounded-2xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                  >
                    Lưu giá vốn đã nhập
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`rounded-3xl border p-5 ${auditResult ? (auditResult.diffCount > 0 || auditResult.missingSkuCount > 0 || Math.abs(auditResult.total.valueDiff) > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50") : "border-neutral-200 bg-neutral-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-600">Đối chiếu 2 file SAPO</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">
                    {auditResult ? currency(auditResult.total.valueDiff) : "Chưa upload"}
                  </p>
                </div>

                {auditResult ? (
                  auditResult.diffCount > 0 || auditResult.missingSkuCount > 0 || Math.abs(auditResult.total.valueDiff) > 0 ? (
                    <Badge tone="red">Có lệch</Badge>
                  ) : (
                    <Badge tone="green">Khớp</Badge>
                  )
                ) : (
                  <Badge tone="gray">Chờ file</Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800">
                  {auditingSapo ? "Đang đối chiếu..." : "Upload file SAPO để đối chiếu"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={auditingSapo}
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0] || null;

                      try {
                        await handleAuditSapoFile(file);
                      } finally {
                        input.value = "";
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Mở bảng đối chiếu lớn
                </button>
              </div>

              {auditResult ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-xs text-neutral-500">Match SKU</p>
                      <p className="mt-1 font-semibold">
                        {numberFormat(auditResult.matchedSkus)}/{numberFormat(auditResult.fileRows)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-xs text-neutral-500">Thiếu SKU</p>
                      <p className="mt-1 font-semibold">{numberFormat(auditResult.missingSkuCount)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-xs text-neutral-500">SKU lệch</p>
                      <p className="mt-1 font-semibold">{numberFormat(auditResult.diffCount)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3">
                      <p className="text-xs text-neutral-500">Lệch SL</p>
                      <p className="mt-1 font-semibold">{numberFormat(auditResult.total.qtyDiff)}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {visibleBranches.map((branch) => {
                      const item = auditResult.branchTotals[branch.id];
                      if (!item) return null;
                      const bad = Math.abs(item.valueDiff) > 0 || Math.abs(item.qtyDiff) > 0;

                      return (
                        <div key={branch.id} className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-sm">
                          <div>
                            <p className="font-medium text-neutral-900">{branch.name}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              SAPO {currency(item.fileValue)} · HT {currency(item.systemValue)}
                            </p>
                          </div>
                          <div className={`text-right font-semibold ${bad ? "text-red-700" : "text-green-700"}`}>
                            {currency(item.valueDiff)}
                            <p className="mt-0.5 text-xs font-normal text-neutral-500">
                              Lệch SL {numberFormat(item.qtyDiff)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-4 text-sm text-neutral-600">
                  <p className="font-medium text-neutral-900">Chưa có dữ liệu đối chiếu.</p>
                  <p className="mt-1">
                    Chọn file SAPO ở nút upload phía trên để so sánh giá trị tồn, số lượng tồn và SKU lệch ngay trên trang kho.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Panel>
      ) : null}

      {canViewMoney ? (
        <Panel className="overflow-hidden">
          <div className="border-b border-neutral-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-neutral-900">Công cụ quản lý kho</p>
                <p className="mt-1 text-sm text-neutral-500">
                  Gom các thao tác ít dùng vào một chỗ cho gọn.
                </p>
              </div>
              <Badge tone="gray">Tools</Badge>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            <button type="button" className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:shadow-sm">
              <p className="font-semibold text-neutral-900">Upload báo cáo tồn kho</p>
              <p className="mt-1 text-xs text-neutral-500">Import file tồn từ SAPO hoặc Excel</p>
            </button>

            <button type="button" className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:shadow-sm">
              <p className="font-semibold text-neutral-900">Đối chiếu SAPO</p>
              <p className="mt-1 text-xs text-neutral-500">Upload 2 file để bóc lệch SKU</p>
            </button>

            <button type="button" onClick={() => { void loadInventoryMovements(); }} className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:shadow-sm">
              <p className="font-semibold text-neutral-900">Lịch sử kho</p>
              <p className="mt-1 text-xs text-neutral-500">Xem biến động nhập, xuất, chỉnh tồn</p>
            </button>

            <button type="button" className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:shadow-sm">
              <p className="font-semibold text-neutral-900">Kiểm kho</p>
              <p className="mt-1 text-xs text-neutral-500">Tạo phiên và quản lý kiểm kho</p>
            </button>
          </div>
        </Panel>
      ) : null}

      {canViewMoney ? (
        <Panel id="audit-fix-center" className="overflow-hidden border-blue-200">
          <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-medium text-blue-900">Đối chiếu 2 file SAPO theo mã sản phẩm</p>
                <p className="mt-1 text-sm text-blue-700">
                  Dùng để tìm nhanh mã SP làm lệch tiền giữa file Báo cáo tồn kho và file Danh sách sản phẩm.
                </p>
              </div>
              <Badge tone={twoFileAuditResult ? (Math.abs(twoFileAuditResult.total.diff) > 0 ? "red" : "green") : "blue"}>
                {twoFileAuditResult ? `Lệch ${currency(twoFileAuditResult.total.diff)}` : "Chờ 2 file"}
              </Badge>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <label className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-sm font-medium text-neutral-900">File 1: Báo cáo tồn kho</p>
                <p className="mt-1 text-xs text-neutral-500">File có cột tồn và giá vốn theo kho CL / XD / QO / TH.</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="mt-3 block w-full text-sm"
                  onChange={(e) => setStockReportAuditFile(e.currentTarget.files?.[0] || null)}
                />
                {stockReportAuditFile ? (
                  <p className="mt-2 text-xs text-green-700">Đã chọn: {stockReportAuditFile.name}</p>
                ) : null}
              </label>

              <label className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-sm font-medium text-neutral-900">File 2: Danh sách sản phẩm</p>
                <p className="mt-1 text-xs text-neutral-500">File SAPO export danh sách sản phẩm có SKU, tồn từng kho và giá nhập.</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="mt-3 block w-full text-sm"
                  onChange={(e) => setProductListAuditFile(e.currentTarget.files?.[0] || null)}
                />
                {productListAuditFile ? (
                  <p className="mt-2 text-xs text-green-700">Đã chọn: {productListAuditFile.name}</p>
                ) : null}
              </label>

              <button
                type="button"
                onClick={handleAuditTwoSapoFiles}
                disabled={auditingTwoFiles || !stockReportAuditFile || !productListAuditFile}
                className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {auditingTwoFiles ? "Đang đối chiếu..." : "Đối chiếu 2 file"}
              </button>
            </div>

            {twoFileAuditResult ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-neutral-500">Giá trị file tồn kho</p>
                    <p className="mt-1 text-lg font-semibold">{currency(twoFileAuditResult.total.stockReportValue)}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-neutral-500">Giá trị file sản phẩm</p>
                    <p className="mt-1 text-lg font-semibold">{currency(twoFileAuditResult.total.productFileValue)}</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-xs text-red-600">Tổng lệch</p>
                    <p className="mt-1 text-lg font-semibold text-red-700">{currency(twoFileAuditResult.total.diff)}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-neutral-500">Mã SP lệch</p>
                    <p className="mt-1 text-lg font-semibold">{numberFormat(twoFileAuditResult.productDiffRows.length)}</p>
                  </div>
                </div>

                {twoFileAuditResult.productDiffRows.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-auto rounded-2xl border border-neutral-200">
                      <table className="min-w-[1180px] text-sm">
                        <thead className="bg-neutral-50 text-left text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Mã SP cha</th>
                            <th className="px-4 py-3">Mức độ</th>
                            <th className="px-4 py-3">File tồn kho</th>
                            <th className="px-4 py-3">File sản phẩm</th>
                            <th className="px-4 py-3">Lệch tiền</th>
                            <th className="px-4 py-3">Tồn file kho</th>
                            <th className="px-4 py-3">Tồn file SP</th>
                            <th className="px-4 py-3">Lệch SL</th>
                            <th className="px-4 py-3">SKU lệch giá</th>
                            <th className="px-4 py-3">Số SKU con</th>
                            <th className="px-4 py-3">Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody>
                          {twoFileAuditResult.productDiffRows.slice(0, 150).map((row) => {
                            const expanded = expandedTwoFileProductCode === row.productCode;
                            return (
                              <>
                                <tr
                                  key={row.productCode}
                                  className={`border-t border-neutral-200 ${diffToneClass(row.diff)}`}
                                >
                                  <td className="px-4 py-3 font-semibold">{row.productCode}</td>
                                  <td className="px-4 py-3">
                                    <Badge tone={diffBadgeTone(row.diff)}>
                                      {Math.abs(row.diff) >= 10_000_000
                                        ? "Lệch nặng"
                                        : Math.abs(row.diff) >= 1_000_000
                                          ? "Cần xem"
                                          : "Nhẹ"}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">{currency(row.stockReportValue)}</td>
                                  <td className="px-4 py-3">{currency(row.productFileValue)}</td>
                                  <td className={`px-4 py-3 font-semibold ${diffTextClass(row.diff)}`}>
                                    {currency(row.diff)}
                                  </td>
                                  <td className="px-4 py-3">{numberFormat(row.stockReportQty)}</td>
                                  <td className="px-4 py-3">{numberFormat(row.productFileQty)}</td>
                                  <td className="px-4 py-3">{numberFormat(row.qtyDiff)}</td>
                                  <td className="px-4 py-3">
                                    {Number(row.costDiffSkuCount || 0) > 0 ? (
                                      <Badge tone="red">{numberFormat(row.costDiffSkuCount || 0)} SKU</Badge>
                                    ) : (
                                      <Badge tone="gray">0</Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">{numberFormat(row.skuCount)}</td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedTwoFileProductCode(expanded ? null : row.productCode)
                                      }
                                      className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                                    >
                                      {expanded ? "Thu gọn" : "Bung SKU"}
                                    </button>
                                  </td>
                                </tr>

                                {expanded ? (
                                  <tr key={`${row.productCode}-detail`} className="border-t border-neutral-200 bg-white">
                                    <td colSpan={11} className="px-4 py-4">
                                      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
                                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                          <p className="font-medium text-neutral-900">Lệch theo chi nhánh</p>
                                          <p className="mt-1 text-xs text-neutral-500">
                                            So file tồn kho với file sản phẩm theo từng kho.
                                          </p>

                                          <div className="mt-3 space-y-2">
                                            {(row.branchDiffRows || []).map((branch) => (
                                              <div
                                                key={`${row.productCode}-${branch.branchId}`}
                                                className={`rounded-xl border bg-white px-3 py-2 ${Math.abs(branch.diff) >= 1_000_000 ? "border-red-200" : "border-neutral-200"}`}
                                              >
                                                <div className="flex items-center justify-between gap-3">
                                                  <p className="font-medium">{branch.branchId}</p>
                                                  <p className={`font-semibold ${diffTextClass(branch.diff)}`}>
                                                    {currency(branch.diff)}
                                                  </p>
                                                </div>
                                                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-500">
                                                  <span>Kho: {currency(branch.stockReportValue)}</span>
                                                  <span>SP: {currency(branch.productFileValue)}</span>
                                                  <span>Tồn kho: {numberFormat(branch.stockReportQty)}</span>
                                                  <span>Tồn SP: {numberFormat(branch.productFileQty)}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="rounded-2xl border border-neutral-200 bg-white">
                                          <div className="border-b border-neutral-200 px-4 py-3">
                                            <p className="font-medium text-neutral-900">SKU con gây lệch</p>
                                            <p className="mt-1 text-xs text-neutral-500">
                                              Dòng đỏ: thiếu giá vốn kho hoặc sai giá vốn. Nếu kho value = 0 nhưng SP value &gt; 0 thì SAPO đang thiếu cost lịch sử.
                                            </p>
                                          </div>

                                          <div className="max-h-[420px] overflow-auto">
                                            <table className="min-w-[1150px] text-xs">
                                              <thead className="bg-neutral-50 text-left text-neutral-500">
                                                <tr>
                                                  <th className="px-3 py-2">SKU</th>
                                                  <th className="px-3 py-2">Sản phẩm</th>
                                                  <th className="px-3 py-2">Lý do</th>
                                                  <th className="px-3 py-2">Kho value</th>
                                                  <th className="px-3 py-2">SP value</th>
                                                  <th className="px-3 py-2">Lệch</th>
                                                  <th className="px-3 py-2">Tồn kho</th>
                                                  <th className="px-3 py-2">Tồn SP</th>
                                                  <th className="px-3 py-2">Giá vốn kho TB</th>
                                                  <th className="px-3 py-2">Giá nhập SP</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(row.skuRows || []).slice(0, 200).map((skuRow) => {
                                                  const issue = getSkuIssueMeta(skuRow);
                                                  const costBad = issue.tone === "red";
                                                  return (
                                                    <tr
                                                      key={`${row.productCode}-${skuRow.sku}`}
                                                      title={issue.detail}
                                                      className={`border-t border-neutral-200 ${costBad ? "bg-red-50" : Math.abs(skuRow.diff) >= 1_000_000 ? "bg-amber-50" : ""}`}
                                                    >
                                                      <td className="px-3 py-2 font-semibold">{skuRow.sku}</td>
                                                      <td className="px-3 py-2">{skuRow.productName}</td>
                                                      <td className="px-3 py-2">
                                                        <Badge tone={issue.tone}>{issue.label}</Badge>
                                                      </td>
                                                      <td className="px-3 py-2">{currency(skuRow.stockReportValue)}</td>
                                                      <td className="px-3 py-2">{currency(skuRow.productFileValue)}</td>
                                                      <td className={`px-3 py-2 font-semibold ${diffTextClass(skuRow.diff)}`}>
                                                        {currency(skuRow.diff)}
                                                      </td>
                                                      <td className="px-3 py-2">{numberFormat(skuRow.stockReportQty)}</td>
                                                      <td className="px-3 py-2">{numberFormat(skuRow.productFileQty)}</td>
                                                      <td className="px-3 py-2">{currency(skuRow.stockCostPrice || 0)}</td>
                                                      <td className="px-3 py-2">{currency(skuRow.productCostPrice || 0)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-green-700">Hai file đang khớp theo mã sản phẩm cha.</p>
                )}
              </>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {auditResult ? (
        <Panel className="p-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-neutral-900">Kết quả đối chiếu SAPO</p>
            <p className="text-sm text-neutral-500">
              Match {auditResult.matchedSkus}/{auditResult.fileRows} SKU · Thiếu {auditResult.missingSkuCount} SKU · Lệch {auditResult.diffCount} dòng
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleBranches.map((branch) => {
              const row = auditResult.branchTotals[branch.id];
              if (!row) return null;

              const isBad = Math.abs(row.valueDiff) >= 1 || row.qtyDiff !== 0;

              return (
                <div
                  key={branch.id}
                  className={`rounded-2xl border p-4 ${isBad ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
                    }`}
                >
                  <p className="text-sm font-medium text-neutral-900">{branch.name}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>SAPO</span>
                      <span>{currency(row.fileValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hệ thống</span>
                      <span>{currency(row.systemValue)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Lệch</span>
                      <span>{currency(row.valueDiff)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Lệch SL</span>
                      <span>{numberFormat(row.qtyDiff)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {auditResult.diffRows.length > 0 ? (
            <div className="mt-5 overflow-auto">
              <table className="min-w-[1100px] text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Sản phẩm</th>
                    <th className="px-3 py-2">Kho</th>
                    <th className="px-3 py-2">SAPO SL</th>
                    <th className="px-3 py-2">HT SL</th>
                    <th className="px-3 py-2">Lệch SL</th>
                    <th className="px-3 py-2">Giá SAPO</th>
                    <th className="px-3 py-2">Giá HT</th>
                    <th className="px-3 py-2">Lệch tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {auditResult.diffRows.slice(0, 100).map((row) => (
                    <tr key={`${row.sku}-${row.branchId}`} className="border-t border-neutral-200">
                      <td className="px-3 py-2 font-medium">{row.sku}</td>
                      <td className="px-3 py-2">{row.productName}</td>
                      <td className="px-3 py-2">{row.branchId}</td>
                      <td className="px-3 py-2">{numberFormat(row.fileQty)}</td>
                      <td className="px-3 py-2">{numberFormat(row.systemQty)}</td>
                      <td className="px-3 py-2">{numberFormat(row.qtyDiff)}</td>
                      <td className="px-3 py-2">{currency(row.fileCostPrice)}</td>
                      <td className="px-3 py-2">{currency(row.systemCostPrice)}</td>
                      <td className="px-3 py-2 font-medium">{currency(row.valueDiff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4">
          <p className="font-medium text-neutral-900">Danh sách tồn kho</p>
          <p className="mt-1 text-sm text-neutral-500">
            Scope hiện tại:{" "}
            {isOwner
              ? "Toàn hệ thống"
              : visibleBranches.map((b) => b.name).join(", ") ||
              "Chưa gán chi nhánh"}
          </p>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">
              Đang tải dữ liệu tồn kho...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">
              Không có dữ liệu phù hợp.
            </div>
          ) : (
            <table className="min-w-[1250px] text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium">Danh mục</th>
                  <th className="px-4 py-3 font-medium">Phân loại</th>
                  {canViewMoney ? (
                    <>
                      <th className="px-4 py-3 font-medium">Giá bán</th>
                      <th className="px-4 py-3 font-medium">Giá vốn</th>
                    </>
                  ) : null}
                  {visibleBranches.map((branch) => (
                    <th key={branch.id} className="px-4 py-3 font-medium">
                      {branch.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Tổng</th>
                  {canViewMoney ? (
                    <th className="px-4 py-3 font-medium">Giá trị tồn</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const scopedQty = getScopedQty(row, branchFilter);
                  const inventoryValue = scopedQty * Number(row.costPrice || 0);

                  return (
                    <tr
                      key={row.variantId}
                      className="border-t border-neutral-200"
                    >
                      <td className="px-4 py-3 font-medium">{row.sku}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-neutral-900">
                            {row.productName}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            /{row.slug || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">
                        {row.color} / {row.size}
                      </td>
                      {canViewMoney ? (
                        <>
                          <td className="px-4 py-3">{currency(row.price)}</td>
                          <td className="px-4 py-3">
                            {Number(row.costPrice || 0) > 0 ? (
                              currency(Number(row.costPrice))
                            ) : (
                              <Badge tone="red">Thiếu giá vốn</Badge>
                            )}
                          </td>
                        </>
                      ) : null}

                      {visibleBranches.map((branch) => (
                        <td key={branch.id} className="px-4 py-3">
                          {Number(row.branchStocks[branch.id] || 0)}
                        </td>
                      ))}

                      <td className="px-4 py-3 font-medium">{scopedQty}</td>

                      {canViewMoney ? (
                        <td className="px-4 py-3 font-medium">
                          {currency(inventoryValue)}
                        </td>
                      ) : null}



                      <td className="px-4 py-3">
                        {scopedQty <= 0 ? (
                          <Badge tone="red">Hết hàng</Badge>
                        ) : scopedQty <= LOW_STOCK_THRESHOLD ? (
                          <Badge tone="amber">Tồn thấp</Badge>
                        ) : (
                          <Badge tone="green">Ổn định</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      {showAuditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">Đối chiếu 2 file SAPO</h3>
                <p className="text-sm text-neutral-500">
                  Upload đủ 2 file: Báo cáo tồn kho + Danh sách sản phẩm. Kết quả sẽ có bảng mã SP lệch và nút bung SKU để kiểm tra chi tiết.
                </p>
              </div>

              <button
                className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => setShowAuditModal(false)}
              >
                Đóng
              </button>
            </div>

            <div className="space-y-5 overflow-auto p-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0] || null;
                    if (file) setStockReportAuditFile(file);
                  }}
                  className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300 bg-blue-50/60 p-5 text-center hover:bg-blue-50"
                >
                  <div className="text-2xl">📦</div>
                  <p className="mt-2 font-semibold text-blue-900">File 1: Báo cáo tồn kho</p>
                  <p className="mt-1 text-xs text-blue-700">
                    Kéo thả hoặc chọn file có tồn + giá trị tồn theo CL / XD / QO / TH.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setStockReportAuditFile(e.currentTarget.files?.[0] || null)}
                  />
                  <span className="mt-3 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-blue-800 ring-1 ring-blue-200">
                    {stockReportAuditFile ? stockReportAuditFile.name : "Chọn file tồn kho"}
                  </span>
                </label>

                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0] || null;
                    if (file) setProductListAuditFile(file);
                  }}
                  className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/60 p-5 text-center hover:bg-violet-50"
                >
                  <div className="text-2xl">🏷️</div>
                  <p className="mt-2 font-semibold text-violet-900">File 2: Danh sách sản phẩm</p>
                  <p className="mt-1 text-xs text-violet-700">
                    Kéo thả hoặc chọn file SAPO export có SKU, tồn từng kho và giá nhập.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setProductListAuditFile(e.currentTarget.files?.[0] || null)}
                  />
                  <span className="mt-3 rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-violet-800 ring-1 ring-violet-200">
                    {productListAuditFile ? productListAuditFile.name : "Chọn file sản phẩm"}
                  </span>
                </label>

                <div className="flex flex-col justify-center gap-3 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                  <button
                    type="button"
                    onClick={handleAuditTwoSapoFiles}
                    disabled={auditingTwoFiles || !stockReportAuditFile || !productListAuditFile}
                    className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {auditingTwoFiles ? "Đang đối chiếu..." : "Đối chiếu 2 file"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStockReportAuditFile(null);
                      setProductListAuditFile(null);
                      setTwoFileAuditResult(null);
                      setExpandedTwoFileProductCode(null);
                    }}
                    className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium hover:bg-neutral-50"
                  >
                    Xoá file / reset
                  </button>

                  <p className="text-xs leading-5 text-neutral-500">
                    Kết quả trong modal này dùng đúng API <b>audit-two-sapo-files</b>, không dùng phép tính rút gọn của đối chiếu 1 file.
                  </p>
                </div>
              </div>

              {twoFileAuditResult ? (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Panel className="p-4">
                      <p className="text-sm text-neutral-500">Giá trị file tồn kho</p>
                      <p className="mt-2 text-xl font-semibold">
                        {currency(twoFileAuditResult.total.stockReportValue)}
                      </p>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-sm text-neutral-500">Giá trị file sản phẩm</p>
                      <p className="mt-2 text-xl font-semibold">
                        {currency(twoFileAuditResult.total.productFileValue)}
                      </p>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-sm text-neutral-500">Tổng lệch</p>
                      <p className="mt-2 text-xl font-semibold text-red-600">
                        {currency(twoFileAuditResult.total.diff)}
                      </p>
                    </Panel>

                    <Panel className="p-4">
                      <p className="text-sm text-neutral-500">Mã SP lệch</p>
                      <p className="mt-2 text-xl font-semibold">
                        {numberFormat(twoFileAuditResult.productDiffRows.length)}
                      </p>
                    </Panel>
                  </div>

                  <Panel className="overflow-hidden">
                    <div className="border-b px-5 py-4">
                      <p className="font-medium">Mã sản phẩm gây lệch</p>
                      <p className="text-sm text-neutral-500">
                        Bấm “Bung SKU” để xem SKU con, lệch theo chi nhánh và lý do lệch giá vốn.
                      </p>
                    </div>

                    <div className="max-h-[58vh] overflow-auto">
                      <table className="min-w-[1280px] text-sm">
                        <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Mã SP cha</th>
                            <th className="px-4 py-3">Mức độ</th>
                            <th className="px-4 py-3">File tồn kho</th>
                            <th className="px-4 py-3">File sản phẩm</th>
                            <th className="px-4 py-3">Lệch tiền</th>
                            <th className="px-4 py-3">Tồn file kho</th>
                            <th className="px-4 py-3">Tồn file SP</th>
                            <th className="px-4 py-3">Lệch SL</th>
                            <th className="px-4 py-3">SKU lệch giá</th>
                            <th className="px-4 py-3">Số SKU con</th>
                            <th className="px-4 py-3">Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody>
                          {twoFileAuditResult.productDiffRows.slice(0, 200).map((row) => {
                            const expanded = expandedTwoFileProductCode === row.productCode;

                            return (
                              <>
                                <tr
                                  key={row.productCode}
                                  className={`border-t border-neutral-200 ${diffToneClass(row.diff)}`}
                                >
                                  <td className="px-4 py-3 font-semibold">{row.productCode}</td>
                                  <td className="px-4 py-3">
                                    <Badge tone={diffBadgeTone(row.diff)}>
                                      {Math.abs(row.diff) >= 10_000_000
                                        ? "Lệch nặng"
                                        : Math.abs(row.diff) >= 1_000_000
                                          ? "Cần xem"
                                          : "Nhẹ"}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">{currency(row.stockReportValue)}</td>
                                  <td className="px-4 py-3">{currency(row.productFileValue)}</td>
                                  <td className={`px-4 py-3 font-semibold ${diffTextClass(row.diff)}`}>
                                    {currency(row.diff)}
                                  </td>
                                  <td className="px-4 py-3">{numberFormat(row.stockReportQty)}</td>
                                  <td className="px-4 py-3">{numberFormat(row.productFileQty)}</td>
                                  <td className="px-4 py-3">{numberFormat(row.qtyDiff)}</td>
                                  <td className="px-4 py-3">
                                    {Number(row.costDiffSkuCount || 0) > 0 ? (
                                      <Badge tone="red">{numberFormat(row.costDiffSkuCount || 0)} SKU</Badge>
                                    ) : (
                                      <Badge tone="gray">0</Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">{numberFormat(row.skuCount)}</td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedTwoFileProductCode(expanded ? null : row.productCode)
                                      }
                                      className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                                    >
                                      {expanded ? "Thu gọn" : "Bung SKU"}
                                    </button>
                                  </td>
                                </tr>

                                {expanded ? (
                                  <tr key={`${row.productCode}-detail`} className="border-t border-neutral-200 bg-white">
                                    <td colSpan={11} className="px-4 py-4">
                                      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
                                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                          <p className="font-medium text-neutral-900">Lệch theo chi nhánh</p>
                                          <p className="mt-1 text-xs text-neutral-500">
                                            So file tồn kho với file sản phẩm theo từng kho.
                                          </p>

                                          <div className="mt-3 space-y-2">
                                            {(row.branchDiffRows || []).map((branch) => (
                                              <div
                                                key={`${row.productCode}-${branch.branchId}`}
                                                className={`rounded-xl border bg-white px-3 py-2 ${Math.abs(branch.diff) >= 1_000_000 ? "border-red-200" : "border-neutral-200"}`}
                                              >
                                                <div className="flex items-center justify-between gap-3">
                                                  <p className="font-medium">{branch.branchId}</p>
                                                  <p className={`font-semibold ${diffTextClass(branch.diff)}`}>
                                                    {currency(branch.diff)}
                                                  </p>
                                                </div>
                                                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-500">
                                                  <span>Kho: {currency(branch.stockReportValue)}</span>
                                                  <span>SP: {currency(branch.productFileValue)}</span>
                                                  <span>Tồn kho: {numberFormat(branch.stockReportQty)}</span>
                                                  <span>Tồn SP: {numberFormat(branch.productFileQty)}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="rounded-2xl border border-neutral-200 bg-white">
                                          <div className="border-b border-neutral-200 px-4 py-3">
                                            <p className="font-medium text-neutral-900">SKU con gây lệch</p>
                                            <p className="mt-1 text-xs text-neutral-500">
                                              Dòng đỏ: thiếu giá vốn kho hoặc sai giá vốn. Nếu kho value = 0 nhưng SP value &gt; 0 thì SAPO đang thiếu cost lịch sử.
                                            </p>
                                          </div>

                                          <div className="max-h-[420px] overflow-auto">
                                            <table className="min-w-[1150px] text-xs">
                                              <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
                                                <tr>
                                                  <th className="px-3 py-2">SKU</th>
                                                  <th className="px-3 py-2">Sản phẩm</th>
                                                  <th className="px-3 py-2">Lý do</th>
                                                  <th className="px-3 py-2">Kho value</th>
                                                  <th className="px-3 py-2">SP value</th>
                                                  <th className="px-3 py-2">Lệch</th>
                                                  <th className="px-3 py-2">Tồn kho</th>
                                                  <th className="px-3 py-2">Tồn SP</th>
                                                  <th className="px-3 py-2">Giá vốn kho TB</th>
                                                  <th className="px-3 py-2">Giá nhập SP</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(row.skuRows || []).slice(0, 300).map((skuRow) => {
                                                  const issue = getSkuIssueMeta(skuRow);
                                                  const costBad = issue.tone === "red";

                                                  return (
                                                    <tr
                                                      key={`${row.productCode}-${skuRow.sku}`}
                                                      title={issue.detail}
                                                      className={`border-t border-neutral-200 ${costBad ? "bg-red-50" : Math.abs(skuRow.diff) >= 1_000_000 ? "bg-amber-50" : ""}`}
                                                    >
                                                      <td className="px-3 py-2 font-semibold">{skuRow.sku}</td>
                                                      <td className="px-3 py-2">{skuRow.productName}</td>
                                                      <td className="px-3 py-2">
                                                        <Badge tone={issue.tone}>{issue.label}</Badge>
                                                      </td>
                                                      <td className="px-3 py-2">{currency(skuRow.stockReportValue)}</td>
                                                      <td className="px-3 py-2">{currency(skuRow.productFileValue)}</td>
                                                      <td className={`px-3 py-2 font-semibold ${diffTextClass(skuRow.diff)}`}>
                                                        {currency(skuRow.diff)}
                                                      </td>
                                                      <td className="px-3 py-2">{numberFormat(skuRow.stockReportQty)}</td>
                                                      <td className="px-3 py-2">{numberFormat(skuRow.productFileQty)}</td>
                                                      <td className="px-3 py-2">{currency(skuRow.stockCostPrice || 0)}</td>
                                                      <td className="px-3 py-2">{currency(skuRow.productCostPrice || 0)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
                  <p className="font-medium text-neutral-900">Chưa có kết quả đối chiếu 2 file.</p>
                  <p className="mt-1">Chọn đủ 2 file rồi bấm “Đối chiếu 2 file”.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
