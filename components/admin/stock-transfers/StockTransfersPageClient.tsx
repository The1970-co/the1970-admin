"use client";

import { apiFetch } from "@/lib/api";
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
  const [scanNotice, setScanNotice] = useState("");
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const variantSearchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromBranchFilter, setFromBranchFilter] = useState("ALL");
  const [toBranchFilter, setToBranchFilter] = useState("ALL");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("ALL");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

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
        productName: product.name,
        color: variant.color || "",
        size: variant.size || "",
      }))
    );
  }, [products]);

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
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
  }

  function findExactVariantByScan(value: string) {
    const scan = normalizeScanValue(value);
    if (!scan) return null;

    return (
      allVariants.find((item: any) => normalizeScanValue(item.sku) === scan) ||
      allVariants.find((item: any) => normalizeScanValue(item.variantId) === scan) ||
      null
    );
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromDate = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : 0;
    const toDate = dateToFilter ? new Date(`${dateToFilter}T23:59:59`).getTime() : 0;

    return visibleRows.filter((item) => {
      const searchable =
        item.transferCode.toLowerCase().includes(q) ||
        String(item.fromBranch?.name || item.fromBranchName || item.fromBranchId || "").toLowerCase().includes(q) ||
        String(item.toBranch?.name || item.toBranchName || item.toBranchId || "").toLowerCase().includes(q) ||
        ((item.items || []).some((line) => {
          const label = `${line.productName || ""} ${line.sku || ""} ${line.color || ""} ${line.size || ""}`.toLowerCase();
          return label.includes(q);
        }) ?? false);

      if (q && !searchable) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (fromBranchFilter !== "ALL" && item.fromBranchId !== fromBranchFilter) return false;
      if (toBranchFilter !== "ALL" && item.toBranchId !== toBranchFilter) return false;
      if (sourceTypeFilter !== "ALL" && String(item.sourceType || "MANUAL") !== sourceTypeFilter) return false;

      const rawDate = (item as any).createdAt || (item as any).createdAtText || (item as any).updatedAt || "";
      const createdTime = rawDate ? new Date(rawDate).getTime() : 0;
      if (fromDate && createdTime && createdTime < fromDate) return false;
      if (toDate && createdTime && createdTime > toDate) return false;

      return true;
    });
  }, [visibleRows, query, statusFilter, fromBranchFilter, toBranchFilter, sourceTypeFilter, dateFromFilter, dateToFilter]);

  function resetTransferFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setFromBranchFilter("ALL");
    setToBranchFilter("ALL");
    setSourceTypeFilter("ALL");
    setDateFromFilter("");
    setDateToFilter("");
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
  if (typeof window === "undefined") return;

  try {
    const raw =
      localStorage.getItem("the1970_current_user") ||
      localStorage.getItem("currentUser");
    const parsed = raw ? JSON.parse(raw) : null;
    setCurrentUser(parsed?.user || parsed || null);
  } catch {
    setCurrentUser(null);
  }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  if (canManageAutoTransfer) {
    void loadAutoConfig();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [canManageAutoTransfer]);


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

    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.variantId !== option.variantId) return item;

        existed = true;

        return {
          ...item,
          qty: String(Number(item.qty || 0) + 1),
        };
      });

      if (existed) return next;

      return [
        ...prev,
        {
          rowId: makeRowId(),
          variantId: option.variantId,
          sku: option.sku,
          productName: option.productName,
          color: option.color || "",
          size: option.size || "",
          qty: "1",
        },
      ];
    });

    if (source === "scan") {
      const message = `${existed ? "Đã cộng thêm" : "Đã thêm"} ${option.sku}`;
      setScanNotice(message);
      setRecentScans((prev) => [message, ...prev].slice(0, 6));
    }
  }

  function commitVariantScan(value: string) {
    const exact = findExactVariantByScan(value);
    if (!exact) return false;

    addVariantToDraft(exact, "scan");
    setSearchVariant("");

    window.setTimeout(() => {
      variantSearchRef.current?.focus();
      variantSearchRef.current?.select();
    }, 0);

    return true;
  }

  function handleVariantSearchChange(value: string) {
    setSearchVariant(value);

    const cleaned = value.trim();
    if (!cleaned) return;

    if (cleaned.length >= 4) {
      commitVariantScan(cleaned);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight">Phiếu chuyển kho</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Điều phối hàng giữa QO, THÁI HÀ, XÃ ĐÀN, CHÙA LÁNG.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageStockTransferAuto ? (
            <button
              onClick={() => void handlePreviewSuggestions()}
              disabled={suggestionLoading}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              {suggestionLoading ? "Đang quét..." : "Đề xuất cấp hàng"}
            </button>
          ) : null}

          {canCreateStockTransfer ? (
            <button
              onClick={openCreate}
              className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + Tạo phiếu chuyển
            </button>
          ) : null}
        </div>
      </div>

      <Panel className="p-3">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none md:col-span-2"
            placeholder="Tìm theo mã phiếu, chi nhánh, SKU..."
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
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-neutral-500">
            Từ ngày
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
            />
          </label>

          <label className="text-xs font-medium text-neutral-500">
            Đến ngày
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={resetTransferFilters}
            className="self-end rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Xóa lọc
          </button>
        </div>
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

            return (
              <Panel key={transfer.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-3">
                  <div>
                    <div className="flex items-center gap-2">
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
                      <p className="text-sm font-semibold text-neutral-900">{transfer.transferCode}</p>
                      {renderTransferStatusBadge(transfer)}
                      {transfer.sourceType === "AUTO" ? <Badge tone="blue">Tự động</Badge> : null}
                      {transfer.sourceType === "MANUAL" ? <Badge tone="gray">Thủ công</Badge> : null}
                      {transfer.sourceType === "REQUEST" ? <Badge tone="green">Yêu cầu</Badge> : null}
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-xs text-neutral-500">
                      <p>
                        Xuất:{" "}
                        {transfer.fromBranch?.name ||
                          transfer.fromBranchName ||
                          transfer.fromBranchId ||
                          "—"}
                      </p>
                      <p>
                        Nhận:{" "}
                        {transfer.toBranch?.name ||
                          transfer.toBranchName ||
                          transfer.toBranchId ||
                          "—"}
                      </p>
                      <p>Tổng SL: {total}</p>
                      {transfer.note ? <p>Ghi chú: {transfer.note}</p> : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => void openDetail(transfer.id)}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
                    >
                      Xem phiếu
                    </button>

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
                        className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                      >
                        {confirmingId === transfer.id ? "Đang xác nhận..." : "Xác nhận chuyển"}
                      </button>
                    ) : null}

                    {canCancelTransfer ? (
                      <button
                        onClick={() => void handleCancel(transfer.id)}
                        disabled={cancellingId === transfer.id}
                        className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
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

                <div className="overflow-auto">
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
                      {(transfer.items || []).length > 0 ? (
                        (transfer.items || []).map((item) => (
                          <tr key={item.id} className="border-t border-neutral-200">
                            <td className="px-3 py-2.5 font-medium">{item.sku || "—"}</td>
                            <td className="px-3 py-2.5">{item.productName || "—"}</td>
                            <td className="px-3 py-2.5">{item.color || "—"}</td>
                            <td className="px-3 py-2.5">{item.size || "—"}</td>
                            <td className="px-3 py-2.5">{item.qty}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="border-t border-neutral-200 px-3 py-3 text-sm text-neutral-500">
                            Bấm “Xem phiếu” để xem chi tiết sản phẩm.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Thêm sản phẩm / variant
            </p>

            <input
              ref={variantSearchRef}
              className="mb-2 w-full rounded-xl border-2 border-neutral-300 px-3.5 py-3 text-sm font-medium outline-none focus:border-blue-500"
              value={searchVariant}
              onChange={(e) => handleVariantSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;

                e.preventDefault();

                if (commitVariantScan(searchVariant)) return;

                if (variantOptions.length === 1) {
                  addVariantToDraft(variantOptions[0], "scan");
                  setSearchVariant("");
                }
              }}
              placeholder="Quét mã vạch / SKU để thêm ngay..."
              autoComplete="off"
              autoFocus
            />

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="text-xs font-semibold text-blue-700">
                Quét phát ăn ngay · SKU trùng sẽ tự cộng số lượng.
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
                    {items.map((item) => (
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