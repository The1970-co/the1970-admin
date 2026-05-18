"use client";

import { apiFetch } from "@/lib/api";
import { getCurrentUserFromStorage, getWorkingBranchId } from "@/lib/current-user";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import {
  bulkDeleteStockTransfers,
  cancelStockTransfer,
  completeStockTransfer,
  confirmStockTransfer,
  createStockTransfer,
  getStockTransferDetail,
  getStockTransfers,
  previewOutboundSuggestions,
  runAutoRebalanceNow,
  type OutboundSuggestion,
  type StockTransfer,
} from "@/lib/stock-transfers-api";
import {
  findPrintTemplate,
  loadPrintTemplates,
  type PrintPaperSize,
  type PrintTemplateConfig,
} from "@/lib/print-template-config";
import {
  openPrintDocument,
  renderOrderTemplateHtml,
} from "@/lib/print-template-engine";


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
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}
    >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-lg text-neutral-500" type="button">
            ×
          </button>
        </div>
        {children}
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
};


function makeRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function suggestionKey(item: OutboundSuggestion) {
  return `${item.toBranchId}-${item.variantId}`;
}

function statusBadge(status: StockTransfer["status"]) {
  if (status === "CONFIRMED") return <Badge tone="blue">Chờ bên nhận</Badge>;
  if (status === "COMPLETED") return <Badge tone="green">Hoàn tất</Badge>;
  if (status === "CANCELLED") return <Badge tone="red">Đã hủy</Badge>;
  if (status === "IN_TRANSIT") return <Badge tone="blue">Đang chuyển</Badge>;
  if (status === "PENDING") return <Badge tone="amber">Chờ xác nhận</Badge>;
  return <Badge tone="amber">Nháp</Badge>;
}


const MAIN_CATEGORY_GROUPS = [
  {
    key: "summer",
    title: "Mùa hè",
    subtitle: "Áo phông, polo, sơ mi, short, linen...",
    tone: "blue",
    keywords: [
      "áo phông",
      "ao phong",
      "polo",
      "sơ mi",
      "so mi",
      "shirt",
      "tee",
      "t-shirt",
      "short",
      "quần short",
      "quan short",
      "linen",
      "đũi",
      "dui",
      "ba lỗ",
      "ba lo",
      "cộc tay",
      "coc tay",
    ],
  },
  {
    key: "winter",
    title: "Mùa đông",
    subtitle: "Áo khoác, hoodie, sweater, denim, gió...",
    tone: "amber",
    keywords: [
      "áo khoác",
      "ao khoac",
      "jacket",
      "hoodie",
      "sweater",
      "len",
      "nỉ",
      "ni",
      "denim",
      "gió",
      "gio",
      "parka",
      "blazer",
      "suit",
      "dài tay",
      "dai tay",
    ],
  },
] as const;

function normalizeCategoryName(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function getProductCategoryName(product: any) {
  const rawCategory =
    product?.categoryName ||
    product?.category?.name ||
    product?.category?.title ||
    product?.category ||
    product?.categoryId ||
    product?.type ||
    product?.productType ||
    "";

  const categoryName = String(rawCategory || "").trim();
  if (!categoryName || categoryName === "—" || categoryName === "undefined") return "";
  return categoryName;
}

function getStockTransferDetailHref(id: string) {
  return `/control/stock-transfers/${encodeURIComponent(id)}`;
}

function getTransferItemCategoryName(item: any) {
  const direct = String(item?.categoryName || item?.category || "").trim();
  if (direct) return direct;

  return getProductCategoryName(
    item?.product ||
      item?.variant?.product ||
      item?.productSnapshot ||
      item?.variantProduct ||
      {},
  );
}

function getTransferSearchText(transfer: any) {
  const items = Array.isArray(transfer?.items) ? transfer.items : [];

  return normalizeCategoryName(
    [
      transfer?.transferCode,
      transfer?.code,
      transfer?.sourceRefId,
      transfer?.note,
      transfer?.createdByName,
      transfer?.confirmedByName,
      transfer?.fromBranch?.name,
      transfer?.fromBranchName,
      transfer?.fromBranchId,
      transfer?.toBranch?.name,
      transfer?.toBranchName,
      transfer?.toBranchId,
      ...items.flatMap((item: any) => [
        item?.sku,
        item?.productName,
        item?.color,
        item?.size,
        getTransferItemCategoryName(item),
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function formatShortDateTime(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


export default function StockTransfersPageClient() {
  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedTransferIds, setSelectedTransferIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fromBranchId, setFromBranchId] = useState("QO");
  const [toBranchId, setToBranchId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [searchVariant, setSearchVariant] = useState("");
  const [draftSortBy, setDraftSortBy] = useState("added_desc");
  const [bulkQty, setBulkQty] = useState("1");
  const [scanNotice, setScanNotice] = useState("");
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const variantSearchRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const scanTimerRef = useRef<number | null>(null);
  const scanBackendTimerRef = useRef<number | null>(null);
  const lastBackendLookupRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const hotScanVariantMapRef = useRef<Map<string, any>>(new Map());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromBranchFilter, setFromBranchFilter] = useState("ALL");
  const [toBranchFilter, setToBranchFilter] = useState("ALL");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("ALL");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [autoConfigOpen, setAutoConfigOpen] = useState(false);
  const [createdByFilter, setCreatedByFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [colorFilter, setColorFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] = useState("ALL");
  const [noteFilter, setNoteFilter] = useState("");
  const [sourceRefFilter, setSourceRefFilter] = useState("");
  const [minQtyFilter, setMinQtyFilter] = useState("");
  const [maxQtyFilter, setMaxQtyFilter] = useState("");
  const [minLineFilter, setMinLineFilter] = useState("");
  const [maxLineFilter, setMaxLineFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  const [transferPrintOpen, setTransferPrintOpen] = useState(false);
  const [transferPrintLoading, setTransferPrintLoading] = useState(false);
  const [transferPrintTransfer, setTransferPrintTransfer] = useState<StockTransfer | null>(null);
  const [transferPrintPaperSize, setTransferPrintPaperSize] = useState<PrintPaperSize>("80mm");
  const [transferPrintTemplateId, setTransferPrintTemplateId] = useState("");
  const [transferPrintShowOrderCode, setTransferPrintShowOrderCode] = useState(true);
  const [transferPrintShowCreatedAt, setTransferPrintShowCreatedAt] = useState(true);
  const [transferPrintShowCustomerName, setTransferPrintShowCustomerName] = useState(true);
  const [transferPrintShowCustomerPhone, setTransferPrintShowCustomerPhone] = useState(false);
  const [transferPrintShowShippingAddress, setTransferPrintShowShippingAddress] = useState(false);
  const [transferPrintShowItems, setTransferPrintShowItems] = useState(true);
  const [transferPrintShowItemQty, setTransferPrintShowItemQty] = useState(true);
  const [transferPrintShowBarcode, setTransferPrintShowBarcode] = useState(true);
  const [transferPrintShowQr, setTransferPrintShowQr] = useState(true);
  const [transferPrintShowNote, setTransferPrintShowNote] = useState(true);
  const [transferPrintShowFooter, setTransferPrintShowFooter] = useState(false);


  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionCreating, setSuggestionCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<OutboundSuggestion[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [suggestionQtyMap, setSuggestionQtyMap] = useState<Record<string, number>>({});

  const [branchTargets, setBranchTargets] = useState<Record<string, number>>({
    TH: 2,
    XD: 1,
    CL: 1,
  });

  const [maxPerVariant, setMaxPerVariant] = useState(5);
  const [selectedTargetBranches, setSelectedTargetBranches] = useState<string[]>([
    "TH",
    "XD",
    "CL",
  ]);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [selectedCategoryGroupMap, setSelectedCategoryGroupMap] = useState<Record<string, string[]>>({
    summer: [],
    winter: [],
    other: [],
  });
  const [activeCategoryGroupMap, setActiveCategoryGroupMap] = useState<Record<string, boolean>>({
    summer: true,
    winter: false,
    other: false,
  });
  const [salesVelocityDays, setSalesVelocityDays] = useState(14);
  const [minSoldQty, setMinSoldQty] = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [runHour, setRunHour] = useState(9);
  const [runMinute, setRunMinute] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
const [currentUser, setCurrentUser] = useState<any>(null);

const userBranchId =
  getWorkingBranchId(currentUser) ||
  currentUser?.branchId ||
  currentUser?.branch?.id ||
  currentUser?.branches?.[0]?.id ||
  currentUser?.assignedBranches?.[0]?.id;

const userRoleText = JSON.stringify(currentUser || {}).toLowerCase();

const canManageAutoTransfer =
  userRoleText.includes("owner") || userRoleText.includes("admin");

const isQOWarehouseUser = userBranchId === "QO";
const currentBranchId = userBranchId || "";

const lockedSourceBranchId = useMemo(() => {
  if (canManageAutoTransfer) {
    return branches.find((branch) => branch.id === "QO")?.id || "QO";
  }

  return currentBranchId || branches[0]?.id || "QO";
}, [branches, canManageAutoTransfer, currentBranchId]);

const lockedSourceBranchName = useMemo(() => {
  const branch = branches.find((item) => item.id === lockedSourceBranchId);
  return branch?.name || lockedSourceBranchId || "—";
}, [branches, lockedSourceBranchId]);

function collectPermissionKeys(user: any) {
  const keys = new Set<string>();
  const denied = new Set<string>();

  const add = (items: any) => {
    if (!Array.isArray(items)) return;
    items.forEach((key: any) => {
      const value = String(key || "").trim();
      if (value) keys.add(value);
    });
  };

  add(user?.permissions);
  add(user?.permissionKeys);
  add(user?.extraPermissionKeys);

  const scopedRows = Array.isArray(user?.branchPermissions)
    ? user.branchPermissions.filter((row: any) => {
        if (!currentBranchId) return true;
        const rowBranchId = String(row?.branchId || "").trim();
        return !rowBranchId || rowBranchId === currentBranchId;
      })
    : [];

  scopedRows.forEach((row: any) => {
    add(row?.permissionKeys);
    add(row?.extraPermissionKeys);

    if (Array.isArray(row?.deniedPermissionKeys)) {
      row.deniedPermissionKeys.forEach((key: any) => {
        const value = String(key || "").trim();
        if (value) denied.add(value);
      });
    }
  });

  denied.forEach((key) => keys.delete(key));

  return keys;
}

function hasStockTransferPermission(permission: string) {
  if (canManageAutoTransfer) return true;
  const keys = collectPermissionKeys(currentUser);
  return keys.has("*") || keys.has(permission);
}

const canCreateStockTransfer = hasStockTransferPermission("stock_transfer.create");
const canEditStockTransfer = hasStockTransferPermission("stock_transfer.edit");
const canConfirmStockTransfer = hasStockTransferPermission("stock_transfer.confirm");
const canReceiveStockTransfer = hasStockTransferPermission("stock_transfer.receive");
const canCancelStockTransfer = hasStockTransferPermission("stock_transfer.cancel");
const canDeleteStockTransfer = canManageAutoTransfer;
const canManageStockTransferAuto = canManageAutoTransfer && canCreateStockTransfer;


  const allVariants = useMemo(() => {
    return products.flatMap((product: any) =>
      (product.variants || []).map((variant: any) => ({
        rowId: variant.id,
        variantId: variant.id,
        sku: variant.sku,
        barcode:
          variant?.barcode ||
          variant?.barCode ||
          variant?.scanCode ||
          variant?.code ||
          variant?.sapoCode ||
          variant?.sapoSku ||
          "",
        productName: product.name,
        color: variant.color || "",
        size: variant.size || "",
      }))
    );
  }, [products]);

  const scanVariantMap = useMemo(() => {
    const map = new Map<string, any>();

    for (const item of allVariants as any[]) {
      const keys = [item.sku, item.variantId, item.barcode]
        .map((value) => normalizeScanValue(value))
        .filter(Boolean);

      for (const key of keys) {
        if (!map.has(key)) map.set(key, item);
      }
    }

    return map;
  }, [allVariants]);

  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();

    for (const product of products as any[]) {
      const categoryName = getProductCategoryName(product);
      if (categoryName) set.add(categoryName);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const categoryGroups = useMemo(() => {
    // Mỗi nhóm mùa đều dùng cùng một danh sách danh mục đầy đủ.
    // Nhờ vậy m có thể tích áo phông ở Mùa hè nhưng bỏ áo phông ở Mùa đông.
    return [
      {
        key: "summer",
        title: "Mùa hè",
        subtitle: "Chọn danh mục dùng cho hàng hè.",
        tone: "blue" as const,
        categories: dynamicCategories,
      },
      {
        key: "winter",
        title: "Mùa đông",
        subtitle: "Chọn danh mục dùng cho hàng đông.",
        tone: "amber" as const,
        categories: dynamicCategories,
      },
      {
        key: "other",
        title: "Danh mục khác",
        subtitle: "Preset phụ, vẫn dùng chung danh mục đầy đủ.",
        tone: "gray" as const,
        categories: dynamicCategories,
      },
    ];
  }, [dynamicCategories]);

  function buildActiveCategoryNames(
    groups: Record<string, string[]>,
    activeGroups: Record<string, boolean>
  ) {
    const activeNames = Object.entries(groups)
      .filter(([groupKey]) => Boolean(activeGroups[groupKey]))
      .flatMap(([, names]) => names);

    return Array.from(new Set(activeNames));
  }

  function syncActiveSelectedCategories(
    groups: Record<string, string[]>,
    activeGroups: Record<string, boolean>
  ) {
    setSelectedCategoryNames(buildActiveCategoryNames(groups, activeGroups));
  }

  function setGroupEnabled(groupKey: string, enabled: boolean) {
    setActiveCategoryGroupMap((prev) => {
      // LEVEL 5: mỗi lần chỉ bật 1 preset mùa để tránh hè/đông bị quét lẫn.
      // Nếu cần quét tất cả vẫn dùng nút "Bật tất cả" phía trên.
      const nextActive = enabled
        ? { summer: false, winter: false, other: false, [groupKey]: true }
        : { ...prev, [groupKey]: false };

      syncActiveSelectedCategories(selectedCategoryGroupMap, nextActive);
      return nextActive;
    });
  }

  function setGroupCategories(groupKey: string, nextList: string[]) {
    setSelectedCategoryGroupMap((prev) => {
      const next = {
        ...prev,
        [groupKey]: Array.from(new Set(nextList)),
      };

      syncActiveSelectedCategories(next, activeCategoryGroupMap);

      return next;
    });
  }

  function clearAllCategoryGroups() {
    setSelectedCategoryGroupMap({ summer: [], winter: [], other: [] });
    setActiveCategoryGroupMap({ summer: false, winter: false, other: false });
    setSelectedCategoryNames([]);
  }

  function selectAllCategoryGroups() {
    const next = {
      summer: dynamicCategories,
      winter: dynamicCategories,
      other: dynamicCategories,
    };
    setSelectedCategoryGroupMap(next);
    setActiveCategoryGroupMap({ summer: true, winter: true, other: true });
    setSelectedCategoryNames(dynamicCategories);
  }


  function normalizeScanValue(value: unknown) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
  }

  function isLikelyCompleteScanCode(value: unknown) {
    const code = normalizeScanValue(value);

    // Chặn lỗi máy quét/keyboard event mới bắn một phần mã như X, T, 3, 31...
    // Mã thật của hệ thống/tem thường dài hơn và chỉ gồm A-Z, số, gạch ngang, gạch dưới, dấu chấm.
    if (code.length < 5) return false;
    if (!/^[A-Z0-9._-]+$/.test(code)) return false;

    return true;
  }

  function variantMatchesScanCode(option: any, value: string) {
    const code = normalizeScanValue(value);
    if (!code) return false;

    const keys = [
      option?.sku,
      option?.variantId,
      option?.id,
      option?.barcode,
      option?.barCode,
      option?.scanCode,
      option?.code,
    ]
      .map((item) => normalizeScanValue(item))
      .filter(Boolean);

    return keys.includes(code);
  }

  function putVariantIntoHotScanCache(option: any) {
    if (!option) return;

    const keys = [
      option.sku,
      option.variantId,
      option.id,
      option.barcode,
      option.barCode,
      option.scanCode,
      option.code,
    ]
      .map((item) => normalizeScanValue(item))
      .filter(Boolean);

    for (const key of keys) {
      hotScanVariantMapRef.current.set(key, option);
    }
  }

  function findExactVariantByScan(value: string) {
    const scan = normalizeScanValue(value);
    if (!isLikelyCompleteScanCode(scan)) return null;

    return scanVariantMap.get(scan) || hotScanVariantMapRef.current.get(scan) || null;
  }
  function hasLongerScanCodePrefix(value: string) {
    const scan = normalizeScanValue(value);
    if (!isLikelyCompleteScanCode(scan)) return false;

    for (const key of scanVariantMap.keys()) {
      if (key !== scan && key.startsWith(scan)) return true;
    }

    for (const key of hotScanVariantMapRef.current.keys()) {
      if (key !== scan && key.startsWith(scan)) return true;
    }

    return false;
  }


  function findExactVariantInProductPayload(productsPayload: any[], value: string) {
    const scan = normalizeScanValue(value);
    if (!scan) return null;

    for (const product of productsPayload || []) {
      for (const variant of product?.variants || []) {
        const keys = [
          variant?.sku,
          variant?.id,
          variant?.barcode,
          variant?.barCode,
          variant?.scanCode,
          variant?.code,
          variant?.sapoCode,
          variant?.sapoSku,
        ]
          .map((item) => normalizeScanValue(item))
          .filter(Boolean);

        if (!keys.includes(scan)) continue;

        return {
          rowId: variant.id,
          variantId: variant.id,
          sku: variant.sku,
          barcode: variant?.barcode || variant?.barCode || variant?.scanCode || variant?.code || "",
          productName: product.name,
          color: variant.color || "",
          size: variant.size || "",
        };
      }
    }

    return null;
  }

  const variantOptions = useMemo(() => {
    const q = normalizeScanValue(searchVariant);
    if (!q) return allVariants.slice(0, 20);

    return allVariants
      .filter((item) => {
        const label = normalizeScanValue(`${item.productName} ${item.sku} ${item.color} ${item.size}`);
        return label.includes(q);
      })
      .slice(0, 20);
  }, [allVariants, searchVariant]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (canManageAutoTransfer) return true;

      if (isQOWarehouseUser) {
        return row.fromBranchId === "QO" || row.toBranchId === "QO";
      }

      if (!userBranchId) return false;

      return row.fromBranchId === userBranchId || row.toBranchId === userBranchId;
    });
  }, [rows, canManageAutoTransfer, isQOWarehouseUser, userBranchId]);

  const transferFilterOptions = useMemo(() => {
    const createdBy = new Set<string>();
    const categories = new Set<string>();
    const colors = new Set<string>();
    const sizes = new Set<string>();

    visibleRows.forEach((transfer: any) => {
      if (transfer.createdByName) createdBy.add(String(transfer.createdByName));
      if (transfer.confirmedByName) createdBy.add(String(transfer.confirmedByName));

      (transfer.items || []).forEach((item: any) => {
        const categoryName = getTransferItemCategoryName(item);
        if (categoryName) categories.add(categoryName);
        if (item?.color) colors.add(String(item.color));
        if (item?.size) sizes.add(String(item.size));
      });
    });

    return {
      createdBy: Array.from(createdBy).sort((a, b) => a.localeCompare(b, "vi")),
      categories: Array.from(categories).sort((a, b) => a.localeCompare(b, "vi")),
      colors: Array.from(colors).sort((a, b) => a.localeCompare(b, "vi")),
      sizes: Array.from(sizes).sort((a, b) => a.localeCompare(b, "vi")),
    };
  }, [visibleRows]);

  const filteredRows = useMemo(() => {
    const q = normalizeCategoryName(query);
    const productQ = normalizeCategoryName(productFilter);
    const skuQ = normalizeCategoryName(skuFilter);
    const noteQ = normalizeCategoryName(noteFilter);
    const sourceRefQ = normalizeCategoryName(sourceRefFilter);
    const fromDate = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : 0;
    const toDate = dateToFilter ? new Date(`${dateToFilter}T23:59:59`).getTime() : 0;
    const minQty = minQtyFilter === "" ? null : Number(minQtyFilter);
    const maxQty = maxQtyFilter === "" ? null : Number(maxQtyFilter);
    const minLines = minLineFilter === "" ? null : Number(minLineFilter);
    const maxLines = maxLineFilter === "" ? null : Number(maxLineFilter);

    const list = visibleRows.filter((item: any) => {
      const items = Array.isArray(item.items) ? item.items : [];
      const totalQtyValue = Number(
        item.totalQty ?? items.reduce((sum: number, line: any) => sum + Number(line.qty || 0), 0),
      );
      const totalLinesValue = Number(item.totalLines ?? items.length ?? 0);
      const searchable = getTransferSearchText(item);
      const itemText = normalizeCategoryName(
        items
          .flatMap((line: any) => [
            line?.productName,
            line?.sku,
            line?.color,
            line?.size,
            getTransferItemCategoryName(line),
          ])
          .join(" "),
      );

      if (q && !searchable.includes(q)) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (fromBranchFilter !== "ALL" && item.fromBranchId !== fromBranchFilter) return false;
      if (toBranchFilter !== "ALL" && item.toBranchId !== toBranchFilter) return false;
      if (sourceTypeFilter !== "ALL" && String(item.sourceType || "MANUAL") !== sourceTypeFilter) return false;
      if (createdByFilter !== "ALL" && String(item.createdByName || item.confirmedByName || "") !== createdByFilter) return false;
      if (productQ && !itemText.includes(productQ)) return false;
      if (skuQ && !items.some((line: any) => normalizeCategoryName(line?.sku).includes(skuQ))) return false;
      if (categoryFilter !== "ALL" && !items.some((line: any) => getTransferItemCategoryName(line) === categoryFilter)) return false;
      if (colorFilter !== "ALL" && !items.some((line: any) => String(line?.color || "") === colorFilter)) return false;
      if (sizeFilter !== "ALL" && !items.some((line: any) => String(line?.size || "") === sizeFilter)) return false;
      if (noteQ && !normalizeCategoryName(item.note).includes(noteQ)) return false;
      if (sourceRefQ && !normalizeCategoryName(item.sourceRefId).includes(sourceRefQ)) return false;
      if (minQty !== null && Number.isFinite(minQty) && totalQtyValue < minQty) return false;
      if (maxQty !== null && Number.isFinite(maxQty) && totalQtyValue > maxQty) return false;
      if (minLines !== null && Number.isFinite(minLines) && totalLinesValue < minLines) return false;
      if (maxLines !== null && Number.isFinite(maxLines) && totalLinesValue > maxLines) return false;

      const rawDate = item.createdAt || item.createdAtText || item.updatedAt || "";
      const createdTime = rawDate ? new Date(rawDate).getTime() : 0;
      if (fromDate && createdTime && createdTime < fromDate) return false;
      if (toDate && createdTime && createdTime > toDate) return false;

      return true;
    });

    return list.sort((a: any, b: any) => {
      const aCreated = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const bCreated = new Date(b.createdAt || b.updatedAt || 0).getTime();
      const aQty = Number(a.totalQty ?? a.items?.reduce?.((sum: number, line: any) => sum + Number(line.qty || 0), 0) ?? 0);
      const bQty = Number(b.totalQty ?? b.items?.reduce?.((sum: number, line: any) => sum + Number(line.qty || 0), 0) ?? 0);
      const aLines = Number(a.totalLines ?? a.items?.length ?? 0);
      const bLines = Number(b.totalLines ?? b.items?.length ?? 0);

      if (sortBy === "created_asc") return aCreated - bCreated;
      if (sortBy === "qty_desc") return bQty - aQty;
      if (sortBy === "qty_asc") return aQty - bQty;
      if (sortBy === "lines_desc") return bLines - aLines;
      if (sortBy === "lines_asc") return aLines - bLines;
      if (sortBy === "code_asc") return String(a.transferCode || "").localeCompare(String(b.transferCode || ""), "vi");
      if (sortBy === "code_desc") return String(b.transferCode || "").localeCompare(String(a.transferCode || ""), "vi");
      return bCreated - aCreated;
    });
  }, [
    visibleRows,
    query,
    statusFilter,
    fromBranchFilter,
    toBranchFilter,
    sourceTypeFilter,
    createdByFilter,
    productFilter,
    skuFilter,
    categoryFilter,
    colorFilter,
    sizeFilter,
    noteFilter,
    sourceRefFilter,
    minQtyFilter,
    maxQtyFilter,
    minLineFilter,
    maxLineFilter,
    dateFromFilter,
    dateToFilter,
    sortBy,
  ]);

  const transferStats = useMemo(() => {
    const totalQty = filteredRows.reduce(
      (sum, row: any) => sum + Number(row.totalQty ?? row.items?.reduce?.((itemSum: number, item: any) => itemSum + Number(item.qty || 0), 0) ?? 0),
      0,
    );

    return {
      total: filteredRows.length,
      totalQty,
      waitingConfirm: filteredRows.filter((row) => row.status === "DRAFT" || row.status === "PENDING").length,
      waitingReceive: filteredRows.filter((row) => row.status === "CONFIRMED" || row.status === "IN_TRANSIT").length,
      completed: filteredRows.filter((row) => row.status === "COMPLETED").length,
    };
  }, [filteredRows]);


  function resetTransferFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setFromBranchFilter("ALL");
    setToBranchFilter("ALL");
    setSourceTypeFilter("ALL");
    setCreatedByFilter("ALL");
    setProductFilter("");
    setSkuFilter("");
    setCategoryFilter("ALL");
    setColorFilter("ALL");
    setSizeFilter("ALL");
    setNoteFilter("");
    setSourceRefFilter("");
    setMinQtyFilter("");
    setMaxQtyFilter("");
    setMinLineFilter("");
    setMaxLineFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setSortBy("created_desc");
  }

  function formatTransferPrintDate(value: any) {
    if (!value) return new Date().toLocaleString("vi-VN");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("vi-VN");
  }

function buildTransferPrintOrder(transfer: StockTransfer) {
  const fromName =
    transfer.fromBranch?.name ||
    transfer.fromBranchName ||
    transfer.fromBranchId ||
    "—";

  const toName =
    transfer.toBranch?.name ||
    transfer.toBranchName ||
    transfer.toBranchId ||
    "—";

  const mappedItems = (transfer.items || []).map((item: any) => ({
    productName: item.productName || item.name || "Sản phẩm",
    sku: item.sku || item.variant?.sku || "",
    color: item.color || item.variant?.color || "",
    size: item.size || item.variant?.size || "",
    qty: Number(item.qty ?? item.quantity ?? 0),
  }));

  const totalQty = mappedItems.reduce(
    (sum: number, item: any) => sum + Number(item.qty || 0),
    0
  );

  return {
    ...transfer,
    referenceCode: transfer.transferCode || transfer.id,
    orderCode: transfer.transferCode || transfer.id,
    createdAt: formatTransferPrintDate(
      (transfer as any).createdAt || (transfer as any).updatedAt
    ),
    branchName: `${fromName} → ${toName}`,
    warehouseName: "THE 1970",
    warehousePhone: "",
    warehouseAddress: "",
    customerName: toName,
    shippingRecipientName: toName,
    customerPhone: "",
    shippingPhone: "",
    note: transfer.note || `Xuất: ${fromName} | Nhận: ${toName}`,

    items: mappedItems,

    totalQty,
  };
}

  function getTransferPrintTemplates(paperSize: PrintPaperSize = transferPrintPaperSize) {
    return loadPrintTemplates().filter(
      (template) =>
        template.templateType === "transfer" && template.paperSize === paperSize,
    );
  }

  function applyTemplateToggleDefaults(template?: PrintTemplateConfig | null) {
    const t = template as any;
    setTransferPrintShowOrderCode(t?.showOrderCode !== false);
    setTransferPrintShowCreatedAt(t?.showCreatedAt !== false);
    setTransferPrintShowCustomerName(t?.showCustomerName !== false);
    setTransferPrintShowCustomerPhone(t?.showCustomerPhone === true);
    setTransferPrintShowShippingAddress(t?.showShippingAddress === true);
    setTransferPrintShowItems(t?.showItems !== false);
    setTransferPrintShowItemQty(t?.showItemQty !== false);
    setTransferPrintShowBarcode(template?.showBarcode !== false);
    setTransferPrintShowQr(template?.showQr !== false);
    setTransferPrintShowNote(template?.showNote !== false);
    setTransferPrintShowFooter(t?.showFooter === true);
  }

  function buildTransferPrintTemplate() {
    const templates = getTransferPrintTemplates(transferPrintPaperSize);
    const selected =
      templates.find((template) => template.id === transferPrintTemplateId) ||
      findPrintTemplate({
        templates: loadPrintTemplates(),
        branchId: "__default__",
        templateType: "transfer",
        paperSize: transferPrintPaperSize,
      });

    if (!selected) return null;

    return {
      ...selected,
      showBarcode: transferPrintShowBarcode,
      showQr: transferPrintShowQr,
      showNote: transferPrintShowNote,
      showOrderCode: transferPrintShowOrderCode,
      showCreatedAt: transferPrintShowCreatedAt,
      showCustomerName: transferPrintShowCustomerName,
      showCustomerPhone: transferPrintShowCustomerPhone,
      showShippingAddress: transferPrintShowShippingAddress,
      showItems: transferPrintShowItems,
      showItemQty: transferPrintShowItemQty,
      showFooter: transferPrintShowFooter,
      footerNote: transferPrintShowFooter ? selected.footerNote : "",
    } as PrintTemplateConfig;
  }

  function buildTransferPrintBodyHtml() {
    const template = buildTransferPrintTemplate();
    if (!transferPrintTransfer || !template) return "";

    return `<div class="print-page"><div class="print-page-inner">${renderOrderTemplateHtml({
      order: buildTransferPrintOrder(transferPrintTransfer),
      template,
    })}</div></div>`;
  }

  async function openTransferPrintSetup(transfer: StockTransfer, paperSize: PrintPaperSize = "80mm") {
    try {
      setTransferPrintLoading(true);
      setTransferPrintOpen(true);
      setTransferPrintPaperSize(paperSize);
      setError(null);

      const detail = await getStockTransferDetail(transfer.id);
      const templates = loadPrintTemplates();
      const template = findPrintTemplate({
        templates,
        branchId: "__default__",
        templateType: "transfer",
        paperSize,
      });

      setTransferPrintTransfer(detail || transfer);
      setTransferPrintTemplateId(template?.id || "");
      applyTemplateToggleDefaults(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được cấu hình in phiếu kho.");
      setTransferPrintOpen(false);
    } finally {
      setTransferPrintLoading(false);
    }
  }

  function handleTransferPrintPaperSizeChange(nextPaperSize: PrintPaperSize) {
    setTransferPrintPaperSize(nextPaperSize);
    const templates = getTransferPrintTemplates(nextPaperSize);
    const nextTemplate =
      templates.find((template) => template.isDefault) || templates[0] || null;
    setTransferPrintTemplateId(nextTemplate?.id || "");
    applyTemplateToggleDefaults(nextTemplate);
  }

  function handleTransferPrintTemplateChange(templateId: string) {
    setTransferPrintTemplateId(templateId);
    const template = loadPrintTemplates().find((item) => item.id === templateId) || null;
    applyTemplateToggleDefaults(template);
  }

  function handleConfirmTransferPrint() {
    if (!transferPrintTransfer) {
      setError("Chưa có phiếu chuyển kho để in.");
      return;
    }

    const bodyHtml = buildTransferPrintBodyHtml();
    if (!bodyHtml) {
      setError("Chưa có mẫu in phiếu chuyển kho cho khổ này.");
      return;
    }

    openPrintDocument({
      title: `In phiếu kho ${transferPrintTransfer.transferCode || transferPrintTransfer.id}`,
      paperSize: transferPrintPaperSize,
      bodyHtml,
    });
  }

  function renderTransferStatusBadge(transfer: StockTransfer) {
    const fromName =
      transfer.fromBranch?.name ||
      transfer.fromBranchName ||
      transfer.fromBranchId ||
      "kho gửi";

    const toName =
      transfer.toBranch?.name ||
      transfer.toBranchName ||
      transfer.toBranchId ||
      "kho nhận";

    const isReceiverView =
      !canManageAutoTransfer && transfer.toBranchId === currentBranchId;

    if (transfer.status === "COMPLETED") {
      return <Badge tone="green">Hoàn tất</Badge>;
    }

    if (transfer.status === "CANCELLED") {
      return <Badge tone="red">Đã hủy</Badge>;
    }

    if (transfer.status === "DRAFT" || transfer.status === "PENDING") {
      return isReceiverView ? (
        <Badge tone="amber">Chờ {fromName} xác nhận</Badge>
      ) : (
        <Badge tone="amber">Nháp</Badge>
      );
    }

    if (transfer.status === "CONFIRMED" || transfer.status === "IN_TRANSIT") {
      return isReceiverView ? (
        <Badge tone="blue">Chờ nhận hàng</Badge>
      ) : (
        <Badge tone="blue">Đã gửi / Chờ {toName} nhận</Badge>
      );
    }

    return statusBadge(transfer.status);
  }

function loadCurrentUser() {
  setCurrentUser(getCurrentUserFromStorage());
}

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [transfersData, branchesData, productsData] = await Promise.all([
        getStockTransfers(),
        getBranches(),
        getProducts({ page: 1, limit: 10000 } as any),
      ]);

      setRows(Array.isArray(transfersData) ? transfersData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setProducts(Array.isArray(productsData) ? productsData : ((productsData as any)?.data || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được phiếu chuyển kho.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAutoConfig() {
    if (!canDeleteStockTransfer) return;

    try {
      const res = await apiFetch("/stock-transfers/auto-rebalance/config");

      if (!res.ok) return;

      const data = await res.json();

      setAutoEnabled(Boolean(data.isEnabled));
      setRunHour(Number(data.runHour ?? 9));
      setRunMinute(Number(data.runMinute ?? 0));
      setMaxPerVariant(Number(data.maxPerVariant ?? 5));
      setSalesVelocityDays(Number(data.salesVelocityDays ?? 14));
      setMinSoldQty(Number(data.minSoldQty ?? 0));

      if (Array.isArray(data.toBranchIds)) {
        setSelectedTargetBranches(data.toBranchIds);
      }

      if (Array.isArray(data.categoryNames)) {
        setSelectedCategoryNames(data.categoryNames);
        setSelectedCategoryGroupMap({
          summer: data.categoryNames,
          winter: [],
          other: [],
        });
      }

      if (data.branchMinTargets) {
        setBranchTargets(data.branchMinTargets);
      }
    } catch {}
  }


useEffect(() => {
  loadCurrentUser();
  void loadAll();

  const handleActiveBranchChanged = () => {
    loadCurrentUser();
    void loadAll();
  };

  window.addEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
  return () => {
    window.removeEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  if (canManageAutoTransfer) {
    void loadAutoConfig();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [canManageAutoTransfer]);

useEffect(() => {
  return () => {
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (scanBackendTimerRef.current) {
      window.clearTimeout(scanBackendTimerRef.current);
      scanBackendTimerRef.current = null;
    }
  };
}, []);


useEffect(() => {
  if (!lockedSourceBranchId) return;

  setFromBranchId(lockedSourceBranchId);
  setToBranchId((prev) => {
    if (prev && prev !== lockedSourceBranchId) return prev;
    return branches.find((branch) => branch.id !== lockedSourceBranchId)?.id || "";
  });
}, [branches, lockedSourceBranchId]);

  function resetForm() {
    const sourceId = lockedSourceBranchId || "QO";
    setFromBranchId(sourceId);
    setToBranchId(branches.find((b) => b.id !== sourceId)?.id || "");
    setNote("");
    setItems([]);
    setSearchVariant("");
    setDraftSortBy("added_desc");
    setBulkQty("1");
  }

  function openCreate() {
    if (!canCreateStockTransfer) {
      setError("Bạn không có quyền tạo phiếu chuyển kho.");
      return;
    }
    resetForm();
    setCreateOpen(true);
    setError(null);
    setNotice(null);
  }

  function addVariantToDraft(
    option: {
      variantId: string;
      sku: string;
      productName: string;
      color?: string;
      size?: string;
    },
    source: "manual" | "scan" = "manual"
  ) {
    let existed = false;
    const initialQty =
      source === "manual" && Number(bulkQty || 0) > 0 ? String(Number(bulkQty || 1)) : "1";

    setItems((prev) => {
      let updatedItem: DraftItem | null = null;
      const rest: DraftItem[] = [];

      for (const item of prev) {
        if (item.variantId === option.variantId) {
          existed = true;
          updatedItem = {
            ...item,
            qty: String(Number(item.qty || 0) + 1),
          };
        } else {
          rest.push(item);
        }
      }

      if (updatedItem) {
        // Khi quét/thêm lại SKU đã có, đưa dòng vừa thao tác lên đầu để dễ kiểm soát số lượng.
        return draftSortBy === "added_desc" ? [updatedItem, ...rest] : [...rest, updatedItem];
      }

      const nextItem: DraftItem = {
        rowId: makeRowId(),
        variantId: option.variantId,
        sku: option.sku,
        productName: option.productName,
        color: option.color || "",
        size: option.size || "",
        qty: initialQty,
      };

      // Mặc định giống phiếu nhập: dòng mới nhập/quét nằm trên đầu danh sách.
      return draftSortBy === "added_asc" ? [...prev, nextItem] : [nextItem, ...prev];
    });

    if (source === "scan") {
      const message = `${existed ? "Đã cộng thêm" : "Đã thêm"} ${option.sku}`;
      setScanNotice(message);
      setRecentScans((prev) => [message, ...prev].slice(0, 6));
    }
  }

  function addVisibleVariantsToDraft() {
    const existingIds = new Set(items.map((item) => item.variantId));
    const qty = Number(bulkQty || 1) > 0 ? String(Number(bulkQty || 1)) : "1";
    const nextItems = variantOptions
      .filter((option) => !existingIds.has(option.variantId))
      .map((option) => ({
        rowId: makeRowId(),
        variantId: option.variantId,
        sku: option.sku,
        productName: option.productName,
        color: option.color || "",
        size: option.size || "",
        qty,
      }));

    if (!nextItems.length) return;
    setItems((prev) => (draftSortBy === "added_asc" ? [...prev, ...nextItems] : [...nextItems, ...prev]));
    setScanNotice(`Đã thêm ${nextItems.length} SKU đang lọc`);
  }

  function applyBulkQtyToDraft() {
    const value = Number(bulkQty || 0);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Số lượng áp dụng phải lớn hơn 0.");
      return;
    }

    setItems((prev) => prev.map((item) => ({ ...item, qty: String(value) })));
    setNotice(`Đã áp dụng số lượng ${value} cho ${items.length} dòng.`);
  }

  const sortedDraftItems = useMemo(() => {
    const list = [...items];

    if (draftSortBy === "added_asc") return list.reverse();
    if (draftSortBy === "sku_asc") return list.sort((a, b) => String(a.sku || "").localeCompare(String(b.sku || ""), "vi"));
    if (draftSortBy === "name_asc") return list.sort((a, b) => String(a.productName || "").localeCompare(String(b.productName || ""), "vi"));
    if (draftSortBy === "qty_desc") return list.sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));
    if (draftSortBy === "qty_asc") return list.sort((a, b) => Number(a.qty || 0) - Number(b.qty || 0));

    return list;
  }, [items, draftSortBy]);

  function focusScanInputSoon() {
    window.setTimeout(() => {
      variantSearchRef.current?.focus();
      variantSearchRef.current?.select();
    }, 0);
  }

  async function lookupScanInBackend(value: string) {
    const normalizedValue = normalizeScanValue(value);
    if (!isLikelyCompleteScanCode(normalizedValue)) return;

    const now = Date.now();
    const lastLookup = lastBackendLookupRef.current;
    if (lastLookup.value === normalizedValue && now - lastLookup.at < 220) return;

    lastBackendLookupRef.current = { value: normalizedValue, at: now };

    try {
      const res = await apiFetch(`/stock-transfers/scan-variant?code=${encodeURIComponent(normalizedValue)}`);
      if (!res.ok) {
        setScanNotice(`Không tìm thấy mã ${normalizedValue}`);
        return;
      }

      const exact = await res.json();
      if (!exact?.variantId || !variantMatchesScanCode(exact, normalizedValue)) {
        setScanNotice(`Không khớp chính xác mã ${normalizedValue}`);
        return;
      }

      putVariantIntoHotScanCache(exact);
      commitVariantScan(normalizedValue, exact);
    } catch (err) {
      console.error("background stock transfer scan lookup failed", err);
      setScanNotice(`Không quét được mã ${normalizedValue}`);
    }
  }

  function scheduleBackendScanLookup(value: string, delayMs = 90) {
    const cleaned = normalizeScanValue(value);
    if (!isLikelyCompleteScanCode(cleaned)) return;

    if (scanBackendTimerRef.current) {
      window.clearTimeout(scanBackendTimerRef.current);
      scanBackendTimerRef.current = null;
    }

    scanBackendTimerRef.current = window.setTimeout(() => {
      void lookupScanInBackend(cleaned);
      scanBackendTimerRef.current = null;
    }, delayMs);
  }

  function commitVariantScan(value: string, forcedExact?: any) {
    const normalizedValue = normalizeScanValue(value);
    if (!isLikelyCompleteScanCode(normalizedValue)) return false;

    const now = Date.now();
    const last = lastScanRef.current;

    // Chặn double event onChange + Enter của cùng một lần quét.
    // Không commit prefix như QKK896-R-3 khi scanner vẫn còn đang bắn tiếp số 1.
    if (last.value === normalizedValue && now - last.at < 180) {
      setSearchVariant("");
      focusScanInputSoon();
      return true;
    }

    const exact = forcedExact || findExactVariantByScan(normalizedValue);
    if (!exact) return false;

    if (!variantMatchesScanCode(exact, normalizedValue)) return false;

    lastScanRef.current = { value: normalizedValue, at: now };
    addVariantToDraft(exact, "scan");
    setSearchVariant("");
    focusScanInputSoon();

    return true;
  }

  function handleVariantSearchChange(value: string) {
    setSearchVariant(value);

    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (scanBackendTimerRef.current) {
      window.clearTimeout(scanBackendTimerRef.current);
      scanBackendTimerRef.current = null;
    }

    const cleaned = normalizeScanValue(value);
    if (!isLikelyCompleteScanCode(cleaned)) return;

    // Đợi scanner bắn đủ chuỗi rồi mới xử lý.
    // Fix lỗi QKK896-R-31 bị ăn ở QKK896-R-3, SM927-S-TH bị ăn ở SM927-S-T.
    const scanDelay = hasLongerScanCodePrefix(cleaned) ? 220 : 90;

    scanTimerRef.current = window.setTimeout(() => {
      if (!commitVariantScan(cleaned)) scheduleBackendScanLookup(cleaned, 0);
      scanTimerRef.current = null;
    }, scanDelay);
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

  async function handleCreateTransfer() {
    if (!canCreateStockTransfer) {
      setError("Bạn không có quyền tạo phiếu chuyển kho.");
      return;
    }

    if (!fromBranchId) {
      setError("Chưa chọn chi nhánh xuất.");
      return;
    }

    if (!toBranchId) {
      setError("Chưa chọn chi nhánh nhận.");
      return;
    }

    if (fromBranchId === toBranchId) {
      setError("Chi nhánh xuất và nhận không được trùng nhau.");
      return;
    }

    if (!items.length) {
      setError("Chưa có dòng hàng nào.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      await createStockTransfer({
        fromBranchId,
        toBranchId,
        note: note.trim() || undefined,
        items: items.map((item) => ({
          variantId: item.variantId,
          qty: Number(item.qty || 0),
        })),
      });

      setCreateOpen(false);
      setNotice("Đã lưu phiếu chuyển kho.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được phiếu chuyển.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(id: string) {
    if (!canConfirmStockTransfer) {
      setError("Bạn không có quyền xác nhận chuyển kho.");
      return;
    }

    try {
      setConfirmingId(id);
      setError(null);
      setNotice(null);
      await confirmStockTransfer(id);
      setNotice("Đã xác nhận chuyển. Phiếu đang chờ bên nhận xác nhận đủ để nhập/trừ kho.");
      await loadAll();

      if (selectedTransfer?.id === id) {
        const detail = await getStockTransferDetail(id);
        setSelectedTransfer(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được phiếu chuyển.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleComplete(id: string) {
    if (!canReceiveStockTransfer) {
      setError("Bạn không có quyền nhận hàng chuyển kho.");
      return;
    }

    const ok = window.confirm(
      "Xác nhận bên nhận đã nhận đủ hàng? Sau bước này hệ thống mới trừ kho chuyển và cộng kho nhận."
    );
    if (!ok) return;

    try {
      setCompletingId(id);
      setError(null);
      setNotice(null);
      await completeStockTransfer(id);
      setNotice("Đã xác nhận nhận đủ. Hệ thống đã trừ kho chuyển và cộng kho nhận.");
      await loadAll();

      if (selectedTransfer?.id === id) {
        const detail = await getStockTransferDetail(id);
        setSelectedTransfer(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận nhận đủ được phiếu chuyển.");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!canCancelStockTransfer) {
      setError("Bạn không có quyền hủy phiếu chuyển kho.");
      return;
    }

    try {
      setCancellingId(id);
      setError(null);
      setNotice(null);
      await cancelStockTransfer(id);
      setNotice("Đã hủy phiếu chuyển.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy được phiếu chuyển.");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleDeleteTransfer(id: string, transferCode?: string) {
    if (!canManageAutoTransfer) return;

    const ok = window.confirm(
      `Xóa hẳn phiếu ${transferCode || id}? Chỉ nên dùng để dọn phiếu test. Hành động này không hoàn tác.`
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      setError(null);
      setNotice(null);

      await bulkDeleteStockTransfers([id]);

      setSelectedTransferIds((prev) => prev.filter((item) => item !== id));
      setNotice(`Đã xóa phiếu ${transferCode || id}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được phiếu chuyển kho.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelectTransfer(id: string, checked: boolean) {
    setSelectedTransferIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  }

  async function handleBulkDeleteTransfers() {
    if (!canManageAutoTransfer) return;

    const ids = selectedTransferIds.filter((id) => filteredRows.some((row) => row.id === id));

    if (!ids.length) {
      setError("Chưa tích phiếu nào để xoá.");
      return;
    }

    const ok = window.confirm(
      `Xóa hẳn ${ids.length} phiếu đã chọn? Chỉ xoá được phiếu Nháp/Chờ xác nhận. Hành động này không hoàn tác.`
    );
    if (!ok) return;

    try {
      setBulkDeleting(true);
      setError(null);
      setNotice(null);

      const res = await bulkDeleteStockTransfers(ids);

      setSelectedTransferIds([]);
      setNotice(`Đã xoá ${res.deletedCount ?? ids.length} phiếu chuyển kho.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được các phiếu đã chọn.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function openDetail(id: string) {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      const detail = await getStockTransferDetail(id);
      setSelectedTransfer(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được chi tiết phiếu.");
    } finally {
      setDetailLoading(false);
    }
  }


  async function handlePreviewSuggestions() {
    if (!canManageAutoTransfer) return;

    if (selectedTargetBranches.length === 0) {
      setError("Chưa chọn chi nhánh để quét.");
      setSuggestionOpen(true);
      return;
    }

    if (selectedCategoryNames.length === 0) {
      setError("Chưa bật nhóm mùa hoặc chưa chọn danh mục nào để quét.");
      setSuggestionOpen(true);
      return;
    }

    try {
      setSuggestionLoading(true);
      setError(null);
      setNotice(null);

      const data = await previewOutboundSuggestions({
        maxPerVariant,
        branchMinTargets: branchTargets,
        toBranchIds: selectedTargetBranches,
        // Không chọn danh mục = quét tất cả. Không block user nữa.
        categoryNames: selectedCategoryNames,
        salesVelocityDays,
        minSoldQty,
      } as any);

      setSuggestions(data.suggestions || []);

      const ids = (data.suggestions || []).map(suggestionKey);
      setSelectedSuggestionIds(ids);

      const qtyMap: Record<string, number> = {};
      for (const item of data.suggestions || []) {
        qtyMap[suggestionKey(item)] = item.suggestedQty;
      }

      setSuggestionQtyMap(qtyMap);
      setSuggestionOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không quét được đề xuất cấp hàng.");
    } finally {
      setSuggestionLoading(false);
    }
  }

  async function handleCreateAutoTransfers() {
    if (!canManageAutoTransfer) return;

    try {
      setSuggestionCreating(true);
      setError(null);
      setNotice(null);

      const selectedItems = suggestions
        .filter((item) => selectedSuggestionIds.includes(suggestionKey(item)))
        .map((item) => {
          const key = suggestionKey(item);

          return {
            variantId: item.variantId,
            toBranchId: item.toBranchId,
            qty: Number(suggestionQtyMap[key] || item.suggestedQty || 1),
          };
        })
        .filter((item) => item.qty > 0);

      if (!selectedItems.length) {
        setError("Chưa chọn dòng đề xuất nào.");
        return;
      }

      // LEVEL 4: gom theo chi nhánh nhận.
      // Mỗi kho/chi nhánh nhận chỉ tạo 1 phiếu, tránh tình trạng 1 SKU = 1 phiếu.
      const itemsByBranch = selectedItems.reduce<
        Record<string, Array<{ variantId: string; qty: number }>>
      >((acc, item) => {
        if (!acc[item.toBranchId]) acc[item.toBranchId] = [];
        acc[item.toBranchId].push({
          variantId: item.variantId,
          qty: item.qty,
        });
        return acc;
      }, {});

      const targetBranchIds = Object.keys(itemsByBranch);

      for (const targetBranchId of targetBranchIds) {
        await createStockTransfer({
          fromBranchId: "QO",
          toBranchId: targetBranchId,
          note: `Auto cấp hàng thông minh · ${itemsByBranch[targetBranchId].length} SKU`,
          items: itemsByBranch[targetBranchId],
        });
      }

      setSuggestionOpen(false);
      setNotice(
        `Đã tạo ${targetBranchIds.length} phiếu cấp hàng tự động: mỗi chi nhánh nhận 1 phiếu.`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được phiếu tự động.");
    } finally {
      setSuggestionCreating(false);
    }
  }

  async function handleSaveAutoConfig() {
    if (!canManageAutoTransfer) return;

    if (selectedTargetBranches.length === 0) {
      setError("Chưa chọn chi nhánh để cấu hình tự động.");
      return;
    }

    if (selectedCategoryNames.length === 0) {
      setError("Chưa bật nhóm mùa hoặc chưa chọn danh mục nào cho cấu hình tự động.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setNotice(null);

      const res = await apiFetch("/stock-transfers/auto-rebalance/config", {
        method: "PATCH",
        body: JSON.stringify({
          isEnabled: autoEnabled,
          runHour,
          runMinute,
          toBranchIds: selectedTargetBranches,
          // [] = quét tất cả danh mục. Nếu có chọn thì backend filter theo list này.
          categoryNames: selectedCategoryNames,
          branchMinTargets: branchTargets,
          maxPerVariant,
          salesVelocityDays,
          minSoldQty,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Không lưu được cấu hình tự động.");
      }

      setNotice("Đã lưu cấu hình Auto Rebalance.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cấu hình tự động.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRunAutoNow() {
    if (!canManageAutoTransfer) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setNotice(null);

      await handleSaveAutoConfig();

      const res = await runAutoRebalanceNow();

      setNotice(`Đã chạy Auto Rebalance. Tạo ${res.createdCount ?? 0} phiếu tự động.`);
      setSuggestionOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chạy được Auto Rebalance.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-3xl bg-neutral-950 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              THE 1970 WAREHOUSE
            </p>
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight">Phiếu chuyển kho</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-300">
              Điều phối hàng giữa QO, THÁI HÀ, XÃ ĐÀN, CHÙA LÁNG. Bấm vào mã phiếu để mở tab mới, trang danh sách giữ nguyên vị trí đang xem.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManageStockTransferAuto ? (
              <button
                onClick={() => void handlePreviewSuggestions()}
                disabled={suggestionLoading}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestionLoading ? "Đang quét..." : "Đề xuất cấp hàng"}
              </button>
            ) : null}

            {canCreateStockTransfer ? (
              <button
                onClick={openCreate}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
              >
                + Tạo phiếu chuyển
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Tổng phiếu</p>
            <p className="mt-1 text-2xl font-semibold">{transferStats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Tổng SL chuyển</p>
            <p className="mt-1 text-2xl font-semibold">{transferStats.totalQty}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Chờ xác nhận</p>
            <p className="mt-1 text-2xl font-semibold">{transferStats.waitingConfirm}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Chờ nhận hàng</p>
            <p className="mt-1 text-2xl font-semibold">{transferStats.waitingReceive}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Hoàn tất</p>
            <p className="mt-1 text-2xl font-semibold">{transferStats.completed}</p>
          </div>
        </div>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Bộ lọc phiếu chuyển kho</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Lọc theo toàn bộ trường chính của phiếu: mã, người tạo, kho xuất/nhận, trạng thái, nguồn, sản phẩm, SKU, màu, size, danh mục, ghi chú, ngày tạo, số dòng và tổng số lượng.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-neutral-500">{filteredRows.length} phiếu</div>
            <button
              type="button"
              onClick={() => setFilterPanelOpen((prev) => !prev)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {filterPanelOpen ? "Thu gọn ▲" : "Mở lọc ▼"}
            </button>
          </div>
        </div>

        {filterPanelOpen ? (
        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none md:col-span-2"
            placeholder="Tìm mã phiếu, kho, SKU, sản phẩm, ghi chú..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="PENDING">Chờ xác nhận</option>
            <option value="CONFIRMED">Chờ nhận hàng</option>
            <option value="IN_TRANSIT">Đang chuyển</option>
            <option value="COMPLETED">Hoàn tất</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
          >
            <option value="ALL">Tất cả nguồn</option>
            <option value="MANUAL">Thủ công</option>
            <option value="AUTO">Tự động</option>
            <option value="REQUEST">Yêu cầu</option>
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={fromBranchFilter}
            onChange={(e) => setFromBranchFilter(e.target.value)}
          >
            <option value="ALL">Tất cả kho xuất</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={toBranchFilter}
            onChange={(e) => setToBranchFilter(e.target.value)}
          >
            <option value="ALL">Tất cả kho nhận</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
          >
            <option value="ALL">Tất cả người tạo/xác nhận</option>
            {transferFilterOptions.createdBy.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Mã SKU"
            value={skuFilter}
            onChange={(e) => setSkuFilter(e.target.value)}
          />

          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Tên sản phẩm"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          />

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">Tất cả danh mục</option>
            {transferFilterOptions.categories.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
          >
            <option value="ALL">Tất cả màu</option>
            {transferFilterOptions.colors.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
          >
            <option value="ALL">Tất cả size</option>
            {transferFilterOptions.sizes.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Ghi chú"
            value={noteFilter}
            onChange={(e) => setNoteFilter(e.target.value)}
          />

          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Mã nguồn / ref"
            value={sourceRefFilter}
            onChange={(e) => setSourceRefFilter(e.target.value)}
          />

          <input
            type="number"
            min="0"
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="SL từ"
            value={minQtyFilter}
            onChange={(e) => setMinQtyFilter(e.target.value)}
          />

          <input
            type="number"
            min="0"
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="SL đến"
            value={maxQtyFilter}
            onChange={(e) => setMaxQtyFilter(e.target.value)}
          />

          <input
            type="number"
            min="0"
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Số dòng từ"
            value={minLineFilter}
            onChange={(e) => setMinLineFilter(e.target.value)}
          />

          <input
            type="number"
            min="0"
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Số dòng đến"
            value={maxLineFilter}
            onChange={(e) => setMaxLineFilter(e.target.value)}
          />

          <label className="text-xs font-medium text-neutral-500">
            Từ ngày tạo
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
            />
          </label>

          <label className="text-xs font-medium text-neutral-500">
            Đến ngày tạo
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
            />
          </label>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_desc">Mới nhất trước</option>
            <option value="created_asc">Cũ nhất trước</option>
            <option value="qty_desc">SL nhiều nhất</option>
            <option value="qty_asc">SL ít nhất</option>
            <option value="lines_desc">Nhiều dòng SKU nhất</option>
            <option value="lines_asc">Ít dòng SKU nhất</option>
            <option value="code_desc">Mã phiếu Z-A</option>
            <option value="code_asc">Mã phiếu A-Z</option>
          </select>

          <button
            type="button"
            onClick={resetTransferFilters}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Xóa lọc
          </button>
        </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
            Bộ lọc đang thu gọn. Đang hiển thị {filteredRows.length} phiếu theo điều kiện hiện tại.
          </div>
        )}
      </Panel>

      {canDeleteStockTransfer ? (
        <Panel className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Cấu hình đề xuất cấp hàng</p>
              <p className="mt-1 text-xs text-neutral-400">
                Chỉ Owner/Admin thấy phần này. QO và chi nhánh chỉ xử lý phiếu được tạo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAutoConfigOpen((prev) => !prev)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                {autoConfigOpen ? "Thu gọn ▲" : "Mở cấu hình ▼"}
              </button>

              <button
                type="button"
                onClick={() => void handleSaveAutoConfig()}
                disabled={isSubmitting}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu cấu hình"}
              </button>

              <button
                type="button"
                onClick={() => void handleRunAutoNow()}
                disabled={isSubmitting}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {isSubmitting ? "Đang chạy..." : "Chạy Auto ngay"}
              </button>
            </div>
          </div>

          {autoConfigOpen ? (
          <>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs text-neutral-500">
              THÁI HÀ dưới
              <input
                type="number"
                min={1}
                value={branchTargets.TH}
                onChange={(e) =>
                  setBranchTargets((prev) => ({ ...prev, TH: Number(e.target.value || 1) }))
                }
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="text-xs text-neutral-500">
              XÃ ĐÀN dưới
              <input
                type="number"
                min={1}
                value={branchTargets.XD}
                onChange={(e) =>
                  setBranchTargets((prev) => ({ ...prev, XD: Number(e.target.value || 1) }))
                }
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="text-xs text-neutral-500">
              CHÙA LÁNG dưới
              <input
                type="number"
                min={1}
                value={branchTargets.CL}
                onChange={(e) =>
                  setBranchTargets((prev) => ({ ...prev, CL: Number(e.target.value || 1) }))
                }
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="text-xs text-neutral-500">
              Tối đa / mã
              <input
                type="number"
                min={1}
                value={maxPerVariant}
                onChange={(e) => setMaxPerVariant(Number(e.target.value || 1))}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">Chi nhánh quét</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "TH", name: "THÁI HÀ" },
                  { id: "XD", name: "XÃ ĐÀN" },
                  { id: "CL", name: "CHÙA LÁNG" },
                ].map((branch) => {
                  const checked = selectedTargetBranches.includes(branch.id);

                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() =>
                        setSelectedTargetBranches((prev) =>
                          checked
                            ? prev.filter((id) => id !== branch.id)
                            : [...prev, branch.id]
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        checked
                          ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                      }`}
                    >
                      {branch.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-neutral-800">
                Ngày bán gần nhất
                <input
                  type="number"
                  min={1}
                  value={salesVelocityDays}
                  onChange={(e) => setSalesVelocityDays(Number(e.target.value || 1))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
              </label>

              <label className="text-sm font-semibold text-neutral-800">
                Tối thiểu đã bán
                <input
                  type="number"
                  min={0}
                  value={minSoldQty}
                  onChange={(e) => setMinSoldQty(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm font-semibold text-neutral-800">
                Bật auto
                <select
                  value={autoEnabled ? "on" : "off"}
                  onChange={(e) => setAutoEnabled(e.target.value === "on")}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                >
                  <option value="off">Tắt</option>
                  <option value="on">Bật</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-neutral-800">
                Giờ
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={runHour}
                  onChange={(e) => setRunHour(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
              </label>

              <label className="text-sm font-semibold text-neutral-800">
                Phút
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={runMinute}
                  onChange={(e) => setRunMinute(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-neutral-800">
                  Danh mục sản phẩm quét
                </p>
                <p className="mt-1 text-xs font-medium text-neutral-500">
                  Gọn lại theo nhóm mùa. Bấm mở từng nhóm để chọn danh mục con, tránh rối màn hình.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={selectAllCategoryGroups}
                  disabled={dynamicCategories.length === 0}
                  className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 disabled:text-neutral-300"
                >
                  Bật tất cả
                </button>
                <button
                  type="button"
                  onClick={clearAllCategoryGroups}
                  className="text-xs font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                >
                  Tắt tất cả
                </button>
              </div>
            </div>

            {selectedCategoryNames.length > 0 ? (
              <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                    Đang chọn để AI Rebalance quét
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
                    {selectedCategoryNames.length} danh mục
                  </span>
                </div>
                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
                  {selectedCategoryNames.map((name) => (
                    <span
                      key={`selected-${name}`}
                      className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {dynamicCategories.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                Không lấy được danh mục từ API sản phẩm. Hệ thống vẫn có thể quét tất cả sản phẩm.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-3">
                {categoryGroups.map((group, index) => {
                  const groupSelected = selectedCategoryGroupMap[group.key] || [];
                  const groupEnabled = Boolean(activeCategoryGroupMap[group.key]);
                  const selectedCount = group.categories.filter((name) =>
                    groupSelected.includes(name)
                  ).length;
                  const allChecked = group.categories.length > 0 && selectedCount === group.categories.length;
                  const groupTone =
                    group.tone === "blue"
                      ? "border-blue-200 bg-blue-50"
                      : group.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-neutral-200 bg-white";

                  return (
                    <details
                      key={group.key}
                      open
                      className={`rounded-2xl border ${groupTone}`}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-neutral-900">
                            {group.title}
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200">
                              {groupEnabled ? `${selectedCount}/${group.categories.length}` : "Tắt"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-neutral-600">
                            {group.subtitle}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-neutral-500">Mở</span>
                      </summary>

                      <div className="border-t border-white/70 px-4 pb-4 pt-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-bold text-neutral-800">
                            <input
                              type="checkbox"
                              checked={groupEnabled}
                              onChange={(e) => setGroupEnabled(group.key, e.target.checked)}
                              className="h-3.5 w-3.5 accent-blue-600"
                            />
                            Bật quét nhóm này
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setGroupCategories(
                                group.key,
                                allChecked ? [] : group.categories
                              )
                            }
                            disabled={!groupEnabled}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {allChecked ? "Bỏ nhóm" : `Chọn nhóm (${group.categories.length})`}
                          </button>
                        </div>

                        <div className="max-h-56 overflow-auto rounded-xl border border-white/80 bg-white/80 p-2">
                          <div className="grid gap-2">
                            {[...group.categories]
                              .sort((a, b) => {
                                const aSelected = groupSelected.includes(a) ? 1 : 0;
                                const bSelected = groupSelected.includes(b) ? 1 : 0;
                                if (aSelected !== bSelected) return bSelected - aSelected;
                                return a.localeCompare(b);
                              })
                              .map((name) => {
                              const checked = groupSelected.includes(name);

                              return (
                                <label
                                  key={`${group.key}-${name}`}
                                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                    checked
                                      ? "border-blue-300 bg-blue-50 text-blue-700"
                                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!groupEnabled}
                                    onChange={() =>
                                      setGroupCategories(
                                        group.key,
                                        checked
                                          ? groupSelected.filter((x) => x !== name)
                                          : [...groupSelected, name]
                                      )
                                    }
                                    className="h-3.5 w-3.5 accent-blue-600"
                                  />
                                  <span className="truncate">{name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {selectedCategoryNames.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Chưa bật nhóm mùa hoặc chưa chọn danh mục, hệ thống sẽ không quét tự động.
              </p>
            ) : (
              <p className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                AI Rebalance đang quét {selectedCategoryNames.length}/{dynamicCategories.length} danh mục đã chọn. Danh mục được tick sẽ được ưu tiên hiển thị lên trên.
              </p>
            )}
          </div>
          </>
          ) : (
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
              Đề xuất cấp hàng đang thu gọn. Ngưỡng hiện tại: TH {branchTargets.TH}, XĐ {branchTargets.XD}, CL {branchTargets.CL}; tối đa {maxPerVariant} sản phẩm / mã.
            </div>
          )}
        </Panel>
      ) : null}

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

      {canManageAutoTransfer && filteredRows.length > 0 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-900"
                checked={
                  filteredRows.length > 0 &&
                  filteredRows.every((row) => selectedTransferIds.includes(row.id))
                }
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedTransferIds(filteredRows.map((row) => row.id));
                  } else {
                    setSelectedTransferIds([]);
                  }
                }}
              />
              Tích tất cả phiếu đang lọc
            </label>
            <span className="text-xs font-medium text-neutral-500">
              Đã chọn {selectedTransferIds.length} phiếu
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleBulkDeleteTransfers()}
            disabled={bulkDeleting || selectedTransferIds.length === 0}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkDeleting ? "Đang xoá..." : "Xoá các phiếu đã tích"}
          </button>
        </Panel>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <Panel className="p-4">
            <p className="text-sm text-neutral-500">Đang tải phiếu chuyển...</p>
          </Panel>
        ) : filteredRows.length === 0 ? (
          <Panel className="p-4">
            <p className="text-sm text-neutral-500">Chưa có phiếu chuyển kho nào.</p>
          </Panel>
        ) : (
          filteredRows.map((transfer) => {
            const total =
              transfer.totalQty ??
              (transfer.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
            const canConfirmSending =
              canConfirmStockTransfer &&
              (transfer.status === "DRAFT" || transfer.status === "PENDING") &&
              (canManageAutoTransfer || transfer.fromBranchId === currentBranchId);

            const canCancelTransfer =
              canCancelStockTransfer &&
              (transfer.status === "DRAFT" || transfer.status === "PENDING") &&
              (canManageAutoTransfer || transfer.fromBranchId === currentBranchId);

            const canCompleteReceiving =
              canReceiveStockTransfer &&
              transfer.status === "CONFIRMED" &&
              (canManageAutoTransfer || transfer.toBranchId === currentBranchId);

            const fromBranchName =
              transfer.fromBranch?.name ||
              transfer.fromBranchName ||
              transfer.fromBranchId ||
              "—";
            const toBranchName =
              transfer.toBranch?.name ||
              transfer.toBranchName ||
              transfer.toBranchId ||
              "—";
            const lineCount = transfer.totalLines ?? transfer.items?.length ?? 0;
            const createdByName = (transfer as any).createdByName || "—";
            const createdAtText = formatShortDateTime((transfer as any).createdAt);
            const topItems = (transfer.items || []).slice(0, 3);
            const skuPreview = topItems
              .map((item: any) => item.sku || item.productName)
              .filter(Boolean)
              .join(", ");
            const extraItemCount = Math.max(lineCount - topItems.length, 0);

            return (
              <Panel key={transfer.id} className="overflow-hidden transition hover:border-neutral-300 hover:shadow-md">
                <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {canDeleteStockTransfer ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-neutral-900"
                          checked={selectedTransferIds.includes(transfer.id)}
                          onChange={(event) => toggleSelectTransfer(transfer.id, event.target.checked)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Chọn phiếu ${transfer.transferCode}`}
                        />
                      ) : null}

                      <a
                        href={getStockTransferDetailHref(transfer.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[15px] font-bold text-neutral-950 underline-offset-4 hover:underline"
                        title="Mở trang chi tiết ở tab mới"
                      >
                        {transfer.transferCode}
                      </a>

                      {renderTransferStatusBadge(transfer)}
                      {transfer.sourceType === "AUTO" ? <Badge tone="blue">Tự động</Badge> : null}
                      {transfer.sourceType === "MANUAL" ? <Badge tone="gray">Thủ công</Badge> : null}
                      {transfer.sourceType === "REQUEST" ? <Badge tone="green">Yêu cầu</Badge> : null}
                    </div>

                    <div className="mt-2 grid gap-2 text-xs text-neutral-600 md:grid-cols-4">
                      <div className="rounded-xl bg-neutral-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Tuyến chuyển</p>
                        <p className="mt-0.5 truncate font-bold text-neutral-950">
                          {fromBranchName} → {toBranchName}
                        </p>
                      </div>

                      <div className="rounded-xl bg-neutral-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Tổng hàng</p>
                        <p className="mt-0.5 font-bold text-neutral-950">
                          {total} sản phẩm · {lineCount} SKU
                        </p>
                      </div>

                      <div className="rounded-xl bg-neutral-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Người tạo</p>
                        <p className="mt-0.5 truncate font-bold text-neutral-950">{createdByName}</p>
                      </div>

                      <div className="rounded-xl bg-neutral-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Thời gian</p>
                        <p className="mt-0.5 truncate font-bold text-neutral-950">{createdAtText}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                      {skuPreview ? (
                        <p className="min-w-0 truncate">
                          SKU tiêu biểu: <span className="font-medium text-neutral-700">{skuPreview}</span>
                          {extraItemCount > 0 ? <span> +{extraItemCount} dòng</span> : null}
                        </p>
                      ) : (
                        <p>Bấm “Xem phiếu” để xem chi tiết sản phẩm.</p>
                      )}
                      {(transfer as any).sourceRefId ? <p>Mã nguồn: {(transfer as any).sourceRefId}</p> : null}
                      {transfer.note ? <p className="truncate">Ghi chú: {transfer.note}</p> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void openDetail(transfer.id)}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Xem phiếu
                    </button>

                    <a
                      href={getStockTransferDetailHref(transfer.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Mở tab mới
                    </a>

                    <button
                      type="button"
                      onClick={() => void openTransferPrintSetup(transfer, "80mm")}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      In phiếu kho
                    </button>

                    <button
                      type="button"
                      onClick={() => void openTransferPrintSetup(transfer, "A4")}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      In A4
                    </button>

                    {canDeleteStockTransfer ? (
                      <button
                        onClick={() => void handleDeleteTransfer(transfer.id, transfer.transferCode)}
                        disabled={deletingId === transfer.id}
                        className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === transfer.id ? "Đang xóa..." : "Xóa phiếu"}
                      </button>
                    ) : null}

                    {canConfirmSending ? (
                      <button
                        onClick={() => void handleConfirm(transfer.id)}
                        disabled={confirmingId === transfer.id}
                        className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {confirmingId === transfer.id ? "Đang xác nhận..." : "Xác nhận chuyển"}
                      </button>
                    ) : null}

                    {canCancelTransfer ? (
                      <button
                        onClick={() => void handleCancel(transfer.id)}
                        disabled={cancellingId === transfer.id}
                        className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cancellingId === transfer.id ? "Đang hủy..." : "Hủy"}
                      </button>
                    ) : null}

                    {canCompleteReceiving ? (
                      <button
                        onClick={() => void handleComplete(transfer.id)}
                        disabled={completingId === transfer.id}
                        className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {completingId === transfer.id ? "Đang nhập kho..." : "Xác nhận nhận đủ"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Panel>
            );

          })
        )}
      </div>

      <Modal open={suggestionOpen} onClose={() => setSuggestionOpen(false)} title="Đề xuất cấp hàng tự động">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-500">
              Tổng đề xuất: <span className="font-semibold text-neutral-900">{suggestions.length}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => void handlePreviewSuggestions()}
                disabled={suggestionLoading}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                {suggestionLoading ? "Đang quét..." : "Quét lại"}
              </button>

              <button
                onClick={() => void handleRunAutoNow()}
                disabled={isSubmitting}
                className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"
              >
                {isSubmitting ? "Đang chạy..." : "Chạy Auto ngay"}
              </button>

              <button
                onClick={() => void handleCreateAutoTransfers()}
                disabled={suggestionCreating || selectedSuggestionIds.length === 0 || !canCreateStockTransfer}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                  suggestionCreating || selectedSuggestionIds.length === 0
                    ? "bg-neutral-400"
                    : "bg-neutral-900 hover:bg-neutral-800"
                }`}
              >
                {suggestionCreating ? "Đang tạo phiếu..." : "Tạo phiếu tự động"}
              </button>
            </div>
          </div>

          <Panel className="overflow-hidden">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-[13px]">
                <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Chọn</th>
                    <th className="px-3 py-2.5 font-medium">Chi nhánh</th>
                    <th className="px-3 py-2.5 font-medium">SKU</th>
                    <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                    <th className="px-3 py-2.5 font-medium">Màu</th>
                    <th className="px-3 py-2.5 font-medium">Size</th>
                    <th className="px-3 py-2.5 font-medium">Tồn CH</th>
                    <th className="px-3 py-2.5 font-medium">Đã bán</th>
                    <th className="px-3 py-2.5 font-medium">Ngưỡng</th>
                    <th className="px-3 py-2.5 font-medium">Tồn QO</th>
                    <th className="px-3 py-2.5 font-medium">AI</th>
                    <th className="px-3 py-2.5 font-medium">Lý do</th>
                    <th className="px-3 py-2.5 font-medium">SL cấp</th>
                  </tr>
                </thead>

                <tbody>
                  {suggestions.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-3 py-6 text-center text-sm text-neutral-500">
                        Không có đề xuất phù hợp.
                      </td>
                    </tr>
                  ) : (
                    suggestions.map((item) => {
                      const key = suggestionKey(item);
                      const checked = selectedSuggestionIds.includes(key);

                      return (
                        <tr key={key} className="border-t border-neutral-200">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedSuggestionIds((prev) =>
                                  e.target.checked
                                    ? [...prev, key]
                                    : prev.filter((id) => id !== key)
                                );
                              }}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium">{item.toBranchName}</td>
                          <td className="px-3 py-2.5">{item.sku}</td>
                          <td className="px-3 py-2.5">{item.productName}</td>
                          <td className="px-3 py-2.5">{item.color || "—"}</td>
                          <td className="px-3 py-2.5">{item.size || "—"}</td>
                          <td className="px-3 py-2.5">{item.storeAvailableQty}</td>
                          <td className="px-3 py-2.5">
                            {item.soldQty ?? 0}/{item.salesVelocityDays ?? salesVelocityDays} ngày
                          </td>
                          <td className="px-3 py-2.5">{item.branchMinTarget}</td>
                          <td className="px-3 py-2.5">{item.qoAvailableQty ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                                Number((item as any).aiScore || 0) >= 80
                                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                                  : Number((item as any).aiScore || 0) >= 60
                                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                    : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                              }`}
                            >
                              {(item as any).aiScore ?? "—"}
                            </span>
                          </td>
                          <td className="max-w-[220px] px-3 py-2.5 text-xs text-neutral-500">
                            {(item as any).aiReason || item.reason || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={1}
                              max={item.qoAvailableQty ?? 9999}
                              value={suggestionQtyMap[key] ?? item.suggestedQty}
                              onChange={(e) =>
                                setSuggestionQtyMap((prev) => ({
                                  ...prev,
                                  [key]: Number(e.target.value || 1),
                                }))
                              }
                              className="w-20 rounded-xl border border-neutral-300 px-2 py-1.5 text-sm outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="rounded-2xl bg-green-50 p-3 text-xs font-medium text-green-700">
            Level 5 AI Rebalance: hệ thống xếp hạng theo mức thiếu hàng, tốc độ bán, tồn QO và ngưỡng chi nhánh. Chỉ tạo phiếu từ những dòng được tick và theo đúng số lượng đã chỉnh.
          </div>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết phiếu chuyển kho">
        {detailLoading || !selectedTransfer ? (
          <div className="p-4 text-sm text-neutral-500">Đang tải chi tiết...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Panel className="p-3">
                <p className="text-xs text-neutral-500">Mã phiếu</p>
                <p className="mt-1 text-sm font-semibold">{selectedTransfer.transferCode}</p>
              </Panel>
              <Panel className="p-3">
                <p className="text-xs text-neutral-500">Xuất</p>
                <p className="mt-1 text-sm font-semibold">
                  {selectedTransfer.fromBranchName || selectedTransfer.fromBranch?.name || selectedTransfer.fromBranchId}
                </p>
              </Panel>
              <Panel className="p-3">
                <p className="text-xs text-neutral-500">Nhận</p>
                <p className="mt-1 text-sm font-semibold">
                  {selectedTransfer.toBranchName || selectedTransfer.toBranch?.name || selectedTransfer.toBranchId}
                </p>
              </Panel>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void openTransferPrintSetup(selectedTransfer, "80mm")}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                In phiếu kho 80mm
              </button>
              <button
                type="button"
                onClick={() => void openTransferPrintSetup(selectedTransfer, "A4")}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                In A4
              </button>
              <button
                type="button"
                onClick={() => void openTransferPrintSetup(selectedTransfer, "A5")}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                In A5
              </button>
            </div>

            {selectedTransfer.status === "CONFIRMED" ? (
              <Panel className="flex flex-wrap items-center justify-between gap-3 border-blue-200 bg-blue-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Phiếu đang chờ bên nhận xác nhận đủ</p>
                  <p className="mt-1 text-xs text-blue-700">
                    Chỉ khi xác nhận đủ, hệ thống mới trừ kho chuyển và cộng kho nhận.
                  </p>
                </div>
                {(canReceiveStockTransfer && (canManageAutoTransfer || selectedTransfer.toBranchId === currentBranchId)) ? (
                  <button
                    type="button"
                    onClick={() => void handleComplete(selectedTransfer.id)}
                    disabled={completingId === selectedTransfer.id}
                    className="rounded-xl bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {completingId === selectedTransfer.id ? "Đang nhập kho..." : "Xác nhận đã nhận đủ"}
                  </button>
                ) : null}
              </Panel>
            ) : null}

            <Panel className="overflow-hidden">
              <table className="min-w-full text-[13px]">
                <thead className="bg-neutral-50 text-left text-neutral-500">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">SKU</th>
                    <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                    <th className="px-3 py-2.5 font-medium">Màu</th>
                    <th className="px-3 py-2.5 font-medium">Size</th>
                    <th className="px-3 py-2.5 font-medium">SL</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedTransfer.items || []).map((item) => (
                    <tr key={item.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2.5 font-medium">{item.sku || "—"}</td>
                      <td className="px-3 py-2.5">{item.productName || "—"}</td>
                      <td className="px-3 py-2.5">{item.color || "—"}</td>
                      <td className="px-3 py-2.5">{item.size || "—"}</td>
                      <td className="px-3 py-2.5">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        )}
      </Modal>


      <Modal open={transferPrintOpen} onClose={() => setTransferPrintOpen(false)} title="Cấu hình in phiếu chuyển kho">
        {transferPrintLoading || !transferPrintTransfer ? (
          <div className="p-4 text-sm text-neutral-500">Đang tải phiếu in...</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <div className="space-y-4">
              <Panel className="p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium text-neutral-700">
                    Mẫu phiếu
                    <select
                      value={transferPrintTemplateId}
                      onChange={(event) => handleTransferPrintTemplateChange(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none"
                    >
                      {getTransferPrintTemplates(transferPrintPaperSize).map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium text-neutral-700">
                    Khổ giấy / khổ cuộn
                    <select
                      value={transferPrintPaperSize}
                      onChange={(event) =>
                        handleTransferPrintPaperSizeChange(event.target.value as PrintPaperSize)
                      }
                      className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="80mm">Phiếu cuộn 80mm</option>
                      <option value="A5">Phiếu A5</option>
                      <option value="A4">Phiếu A4</option>
                    </select>
                  </label>
                </div>

                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  Khi hộp thoại máy in hiện lên, chọn đúng khổ giấy trong driver: 80mm/cuộn hoặc A5/A4. Trình duyệt không ép được máy in nếu driver đang để sai khổ.
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="mb-3 text-sm font-semibold text-neutral-900">Thông tin hiển thị trên phiếu</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {[
                    [transferPrintShowOrderCode, setTransferPrintShowOrderCode, "Mã phiếu"],
                    [transferPrintShowCreatedAt, setTransferPrintShowCreatedAt, "Ngày tạo"],
                    [transferPrintShowCustomerName, setTransferPrintShowCustomerName, "Chi nhánh nhận"],
                    [transferPrintShowCustomerPhone, setTransferPrintShowCustomerPhone, "SĐT"],
                    [transferPrintShowShippingAddress, setTransferPrintShowShippingAddress, "Địa chỉ"],
                    [transferPrintShowItems, setTransferPrintShowItems, "Danh sách sản phẩm"],
                    [transferPrintShowItemQty, setTransferPrintShowItemQty, "Số lượng"],
                    [transferPrintShowBarcode, setTransferPrintShowBarcode, "Mã vạch"],
                    [transferPrintShowQr, setTransferPrintShowQr, "QR"],
                    [transferPrintShowNote, setTransferPrintShowNote, "Ghi chú"],
                    [transferPrintShowFooter, setTransferPrintShowFooter, "Footer cuối phiếu"],
                  ].map(([checked, setter, label]) => (
                    <label
                      key={String(label)}
                      className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checked)}
                        onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                        className="h-4 w-4 accent-neutral-900"
                      />
                      {String(label)}
                    </label>
                  ))}
                </div>
              </Panel>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferPrintOpen(false)}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTransferPrint}
                  className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  In phiếu
                </button>
              </div>
            </div>

            <Panel className="overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Preview trước khi in</p>
                  <p className="text-xs text-neutral-500">
                    {transferPrintTransfer.transferCode || transferPrintTransfer.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmTransferPrint}
                  className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500"
                >
                  In
                </button>
              </div>

              <div className="max-h-[620px] overflow-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div
                  className="mx-auto origin-top scale-[0.9] bg-white p-3 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: buildTransferPrintBodyHtml() }}
                />
              </div>
            </Panel>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo phiếu chuyển kho">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Chi nhánh chuyển
              </p>
              <p className="mt-0.5 font-semibold text-neutral-900">{lockedSourceBranchName}</p>
            </div>

            <select
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
            >
              <option value="">Chọn chi nhánh nhận</option>
              {branches
                .filter((item) => item.id !== fromBranchId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>

          <textarea
            className="min-h-[72px] w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            placeholder="Ghi chú phiếu chuyển"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <Panel className="p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Thêm sản phẩm / variant
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  Quét mã, tìm SKU hoặc thêm tất cả dòng đang lọc. Dòng mới nhập sẽ nổi lên đầu.
                </p>
              </div>
              <button
                type="button"
                onClick={addVisibleVariantsToDraft}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Thêm tất cả đang lọc ({variantOptions.length})
              </button>
            </div>

            <input
              ref={variantSearchRef}
              className="mb-2 w-full rounded-xl border-2 border-neutral-300 px-3.5 py-3 text-sm font-medium outline-none focus:border-blue-500"
              value={searchVariant}
              onChange={(e) => handleVariantSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;

                e.preventDefault();

                if (scanTimerRef.current) {
                  window.clearTimeout(scanTimerRef.current);
                  scanTimerRef.current = null;
                }

                if (commitVariantScan(searchVariant)) return;

                // Enter từ máy quét chỉ được dùng exact scan, không tự add kết quả fuzzy.
                // Nếu mã chưa có cache thì hỏi endpoint exact phía backend.
                scheduleBackendScanLookup(searchVariant, 0);
              }}
              placeholder="Quét mã vạch / SKU để thêm ngay..."
              autoComplete="off"
              autoFocus
            />

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="text-xs font-semibold text-blue-700">
                Quét nhanh exact · Đợi đủ mã rồi mới cộng, không ăn nhầm mã ngắn.
              </div>

              {scanNotice ? (
                <div className="text-xs font-bold text-emerald-700">
                  {scanNotice}
                </div>
              ) : null}
            </div>

            {recentScans.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {recentScans.map((scan, index) => (
                  <span
                    key={`${scan}-${index}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700"
                  >
                    {scan}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="max-h-52 overflow-auto rounded-xl border border-neutral-200">
              {variantOptions.length === 0 ? (
                <div className="p-3 text-sm text-neutral-500">Không có variant phù hợp.</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {variantOptions.map((item) => (
                    <button
                      key={item.rowId}
                      type="button"
                      onClick={() => addVariantToDraft(item, "manual")}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-neutral-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {item.sku} · {item.color || "—"} / {item.size || "—"}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-neutral-500">Thêm</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-xs text-neutral-500">
                {items.length} SKU · Tổng SL {totalQty}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium outline-none"
                  value={draftSortBy}
                  onChange={(e) => setDraftSortBy(e.target.value)}
                >
                  <option value="added_desc">Mới nhập lên đầu</option>
                  <option value="added_asc">Mới nhập xuống cuối</option>
                  <option value="sku_asc">SKU A-Z</option>
                  <option value="name_asc">Tên sản phẩm A-Z</option>
                  <option value="qty_desc">Số lượng cao trước</option>
                  <option value="qty_asc">Số lượng thấp trước</option>
                </select>
                <input
                  className="w-24 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium outline-none"
                  value={bulkQty}
                  onChange={(e) => setBulkQty(e.target.value)}
                  placeholder="SL"
                />
                <button
                  type="button"
                  onClick={applyBulkQtyToDraft}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                >
                  Áp dụng SL
                </button>
              </div>
            </div>
            <div className="overflow-auto">
              {items.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">Chưa có dòng hàng nào.</div>
              ) : (
                <table className="min-w-full text-[13px]">
                  <thead className="bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">SKU</th>
                      <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                      <th className="px-3 py-2.5 font-medium">Màu</th>
                      <th className="px-3 py-2.5 font-medium">Size</th>
                      <th className="px-3 py-2.5 font-medium">SL</th>
                      <th className="px-3 py-2.5 font-medium">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDraftItems.map((item) => (
                      <tr key={item.rowId} className="border-t border-neutral-200">
                        <td className="px-3 py-2.5 font-medium">{item.sku}</td>
                        <td className="px-3 py-2.5">{item.productName}</td>
                        <td className="px-3 py-2.5">{item.color || "—"}</td>
                        <td className="px-3 py-2.5">{item.size || "—"}</td>
                        <td className="px-3 py-2.5">
                          <input
                            className="w-20 rounded-xl border border-neutral-300 px-3 py-1.5 text-sm outline-none"
                            value={item.qty}
                            onChange={(e) => updateDraftItem(item.rowId, { qty: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => removeDraftItem(item.rowId)}
                            className="rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-xs text-neutral-500">
              Tổng số lượng: <span className="font-medium text-neutral-900">{totalQty}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                Đóng
              </button>
              <button
                onClick={() => void handleCreateTransfer()}
                disabled={saving}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
                  saving ? "cursor-not-allowed bg-neutral-400" : "bg-neutral-900 hover:bg-neutral-800"
                }`}
              >
                {saving ? "Đang lưu..." : "Lưu nháp"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}