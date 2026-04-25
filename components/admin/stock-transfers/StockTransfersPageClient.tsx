"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import {
  cancelStockTransfer,
  confirmStockTransfer,
  createSelectedOutboundTransfersFromSuggestions,
  createStockTransfer,
  getStockTransferDetail,
  getStockTransfers,
  previewOutboundSuggestions,
  runAutoRebalanceNow,
  type OutboundSuggestion,
  type StockTransfer,
} from "@/lib/stock-transfers-api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

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

type BranchNotification = {
  id: string;
  branchId: string;
  branchName?: string | null;
  title: string;
  message: string;
  transferId?: string | null;
  transferCode?: string | null;
  isRead: boolean;
  createdAt: string;
};

function makeRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function suggestionKey(item: OutboundSuggestion) {
  return `${item.toBranchId}-${item.variantId}`;
}

function statusBadge(status: StockTransfer["status"]) {
  if (status === "CONFIRMED") return <Badge tone="green">Đã xác nhận</Badge>;
  if (status === "COMPLETED") return <Badge tone="green">Hoàn tất</Badge>;
  if (status === "CANCELLED") return <Badge tone="red">Đã hủy</Badge>;
  if (status === "IN_TRANSIT") return <Badge tone="blue">Đang chuyển</Badge>;
  if (status === "PENDING") return <Badge tone="amber">Chờ xác nhận</Badge>;
  return <Badge tone="amber">Nháp</Badge>;
}

export default function StockTransfersPageClient() {
  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fromBranchId, setFromBranchId] = useState("QO");
  const [toBranchId, setToBranchId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [searchVariant, setSearchVariant] = useState("");
  const [query, setQuery] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  const [notifications, setNotifications] = useState<BranchNotification[]>([]);

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

const isQOWarehouseUser = userBranchId || "";
const currentBranchId = userBranchId || "";


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
      const categoryName =
        product.categoryName || product.category?.name || product.category || "";

      if (categoryName) set.add(String(categoryName));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const variantOptions = useMemo(() => {
    const q = searchVariant.trim().toLowerCase();
    if (!q) return allVariants.slice(0, 20);

    return allVariants
      .filter((item) => {
        const label = `${item.productName} ${item.sku} ${item.color} ${item.size}`.toLowerCase();
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

    return visibleRows.filter((item) => {
      if (!q) return true;

      return (
        item.transferCode.toLowerCase().includes(q) ||
        String(item.fromBranch?.name || item.fromBranchName || "").toLowerCase().includes(q) ||
        String(item.toBranch?.name || item.toBranchName || "").toLowerCase().includes(q) ||
        ((item.items || []).some((line) => {
          const label = `${line.productName || ""} ${line.sku || ""} ${line.color || ""} ${line.size || ""}`.toLowerCase();
          return label.includes(q);
        }) ?? false)
      );
    });
  }, [visibleRows, query]);

async function loadCurrentUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return;

    const data = await res.json();
    console.log("USER FROM API:", data);
    setCurrentUser(data);
  } catch (err) {
    console.error("loadCurrentUser error", err);
  }
}

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [transfersData, branchesData, productsData] = await Promise.all([
        getStockTransfers(),
        getBranches(),
        getProducts(),
      ]);

      setRows(Array.isArray(transfersData) ? transfersData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được phiếu chuyển kho.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAutoConfig() {
    if (!canManageAutoTransfer) return;

    try {
      const res = await fetch(`${API_BASE}/stock-transfers/auto-rebalance/config`, {
        cache: "no-store",
      });

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
      }

      if (data.branchMinTargets) {
        setBranchTargets(data.branchMinTargets);
      }
    } catch {}
  }

async function loadNotifications() {
  try {
    if (!userBranchId) return; // 👈 thêm dòng này

    const res = await fetch(
      `${API_BASE}/branch-notifications?branchId=${userBranchId}`,
      { cache: "no-store" }
    );

    if (!res.ok) return;

    const data = await res.json();
    setNotifications(Array.isArray(data) ? data : []);
  } catch {}
}

useEffect(() => {
  void loadCurrentUser();
  void loadAll();
  void loadAutoConfig();
  void loadNotifications();

  const timer = window.setInterval(() => {
    void loadNotifications();
  }, 10000);

  return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  function resetForm() {
    setFromBranchId("QO");
    setToBranchId(branches.find((b) => b.id !== "QO")?.id || "");
    setNote("");
    setItems([]);
    setSearchVariant("");
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
    setError(null);
    setNotice(null);
  }

  function addVariantToDraft(option: {
    variantId: string;
    sku: string;
    productName: string;
    color?: string;
    size?: string;
  }) {
    const exists = items.find((item) => item.variantId === option.variantId);
    if (exists) return;

    setItems((prev) => [
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
    ]);
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
    try {
      setConfirmingId(id);
      setError(null);
      setNotice(null);
      await confirmStockTransfer(id);
      setNotice("Đã xác nhận chuyển kho.");
      await loadAll();
      await loadNotifications();

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

  async function handleCancel(id: string) {
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

  async function dismissNotification(id: string) {
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    try {
      await fetch(`${API_BASE}/branch-notifications/mark-read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {}
  }

  async function handlePreviewSuggestions() {
    if (!canManageAutoTransfer) return;

    if (selectedCategoryNames.length === 0) {
      setError("Chưa chọn danh mục sản phẩm để quét.");
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

      await createSelectedOutboundTransfersFromSuggestions({
        createdById: "web-admin",
        createdByName: "Auto Rebalance",
        items: selectedItems,
      });

      setSuggestionOpen(false);
      setNotice("Đã tạo phiếu cấp hàng tự động theo danh sách đã chọn.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được phiếu tự động.");
    } finally {
      setSuggestionCreating(false);
    }
  }

  async function handleSaveAutoConfig() {
    if (!canManageAutoTransfer) return;

    if (selectedCategoryNames.length === 0) {
      setError("Chưa chọn danh mục sản phẩm cho cấu hình tự động.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setNotice(null);

      const res = await fetch(`${API_BASE}/stock-transfers/auto-rebalance/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled: autoEnabled,
          runHour,
          runMinute,
          toBranchIds: selectedTargetBranches,
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
      <div className="fixed right-5 top-5 z-[60] w-[380px] max-w-[calc(100vw-24px)] space-y-3">
        {notifications.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.transferCode || ""} · {item.branchName || item.branchId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void dismissNotification(item.id)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-neutral-600">{item.message}</p>

            <div className="mt-3 flex gap-2">
              {item.transferId ? (
                <button
                  type="button"
                  onClick={() => void openDetail(item.transferId!)}
                  className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
                >
                  Xem phiếu
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void dismissNotification(item.id)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight">Phiếu chuyển kho</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Điều phối hàng giữa QO, THÁI HÀ, XÃ ĐÀN, CHÙA LÁNG.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageAutoTransfer ? (
            <button
              onClick={() => void handlePreviewSuggestions()}
              disabled={suggestionLoading}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              {suggestionLoading ? "Đang quét..." : "Đề xuất cấp hàng"}
            </button>
          ) : null}

          <button
            onClick={openCreate}
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Tạo phiếu chuyển
          </button>
        </div>
      </div>

      <Panel className="p-3">
        <input
          className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
          placeholder="Tìm theo mã phiếu, chi nhánh, SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Panel>

      {canManageAutoTransfer ? (
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

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-500">Chi nhánh quét</p>
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
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        checked
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
                      }`}
                    >
                      {branch.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-neutral-500">
                Ngày bán gần nhất
                <input
                  type="number"
                  min={1}
                  value={salesVelocityDays}
                  onChange={(e) => setSalesVelocityDays(Number(e.target.value || 1))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                />
              </label>

              <label className="text-xs text-neutral-500">
                Tối thiểu đã bán
                <input
                  type="number"
                  min={0}
                  value={minSoldQty}
                  onChange={(e) => setMinSoldQty(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-neutral-500">
                Bật auto
                <select
                  value={autoEnabled ? "on" : "off"}
                  onChange={(e) => setAutoEnabled(e.target.value === "on")}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                >
                  <option value="off">Tắt</option>
                  <option value="on">Bật</option>
                </select>
              </label>

              <label className="text-xs text-neutral-500">
                Giờ
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={runHour}
                  onChange={(e) => setRunHour(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                />
              </label>

              <label className="text-xs text-neutral-500">
                Phút
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={runMinute}
                  onChange={(e) => setRunMinute(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Danh mục sản phẩm quét
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Chỉ những danh mục được chọn mới được đưa vào đề xuất.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCategoryNames([])}
                className="text-xs font-medium text-neutral-400 underline underline-offset-2 hover:text-neutral-700"
              >
                Bỏ chọn tất cả
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {dynamicCategories.length === 0 ? (
                <p className="text-xs text-neutral-400">Chưa có danh mục sản phẩm.</p>
              ) : (
                dynamicCategories.map((name) => {
                  const checked = selectedCategoryNames.includes(name);

                  return (
                    <label
                      key={name}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                        checked
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedCategoryNames((prev) =>
                            checked ? prev.filter((x) => x !== name) : [...prev, name]
                          )
                        }
                        className="h-3.5 w-3.5 accent-blue-600"
                      />
                      <span className="font-medium">{name}</span>
                    </label>
                  );
                })
              )}
            </div>

            {selectedCategoryNames.length === 0 ? (
              <p className="mt-2 text-xs text-amber-600">
                Chưa chọn danh mục nào. Hệ thống sẽ không quét đề xuất.
              </p>
            ) : null}
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

            return (
              <Panel key={transfer.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{transfer.transferCode}</p>
                      {statusBadge(transfer.status)}
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

                    {transfer.status === "DRAFT" || transfer.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => void handleConfirm(transfer.id)}
                          disabled={confirmingId === transfer.id}
                          className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                        >
                          {confirmingId === transfer.id ? "Đang xác nhận..." : "Xác nhận chuyển"}
                        </button>
                        <button
                          onClick={() => void handleCancel(transfer.id)}
                          disabled={cancellingId === transfer.id}
                          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                        >
                          {cancellingId === transfer.id ? "Đang hủy..." : "Hủy"}
                        </button>
                      </>
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
                disabled={suggestionCreating || selectedSuggestionIds.length === 0}
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
                    <th className="px-3 py-2.5 font-medium">SL cấp</th>
                  </tr>
                </thead>

                <tbody>
                  {suggestions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-6 text-center text-sm text-neutral-500">
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

          <div className="rounded-2xl bg-green-50 p-3 text-xs text-green-700">
            Hệ thống sẽ chỉ tạo phiếu từ những dòng được tick và theo đúng số lượng đã chỉnh.
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo phiếu chuyển kho">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={fromBranchId}
              onChange={(e) => setFromBranchId(e.target.value)}
            >
              <option value="">Chọn chi nhánh xuất</option>
              {branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

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
              className="mb-2 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={searchVariant}
              onChange={(e) => setSearchVariant(e.target.value)}
              placeholder="Tìm theo tên, SKU, màu, size..."
            />

            <div className="max-h-40 overflow-auto rounded-xl border border-neutral-200">
              {variantOptions.length === 0 ? (
                <div className="p-3 text-sm text-neutral-500">Không có variant phù hợp.</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {variantOptions.map((item) => (
                    <button
                      key={item.rowId}
                      type="button"
                      onClick={() => addVariantToDraft(item)}
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