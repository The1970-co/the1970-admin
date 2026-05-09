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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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
  const canConfirmReceipt = hasAnyPermission([
    "purchase_receipt.receive",
    "purchase_receipt.close",
    "purchaseReceipts.nhan_hang_vao_kho",
    "purchaseReceipts.ket_thuc_don_nhap",
    "purchaseOrders.ket_thuc_don_dat_hang_nhap",
  ]);
  const canCancelReceipt = hasAnyPermission([
    "purchase_receipt.cancel",
    "purchaseReceipts.huy_don_nhap",
    "purchaseReceipts.huy_don_dat_hang_nhap",
    "purchaseOrders.huy_don_dat_hang_nhap",
  ]);

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

  const allVariants = useMemo(() => {
    return products.flatMap((product) =>
      (product.variants || []).map((variant) => ({
        rowId: variant.id,
        variantId: variant.id,
        sku: variant.sku,
        productName: product.name,
        color: variant.color || "",
        size: variant.size || "",
      }))
    );
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchQuery =
        !q ||
        item.receiptCode.toLowerCase().includes(q) ||
        String(item.branch?.name || "").toLowerCase().includes(q) ||
        String(item.supplier?.name || "").toLowerCase().includes(q) ||
        (item.items || []).some((line) => {
          const label =
            `${line.productName} ${line.sku} ${line.color || ""} ${line.size || ""}`.toLowerCase();
          return label.includes(q);
        });

      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [rows, query, statusFilter]);

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
        const productsData = await getProducts({ page: 1, limit: 50 });
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
    if (!createOpen) return;

    const keyword = searchVariant.trim();
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        setVariantSearching(true);

        const productsData = await getProducts({
          page: 1,
          limit: keyword ? 200 : 100,
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
    const firstBranch = branches[0];

    setEditingReceiptId(null);
    setSupplierId(firstSupplier?.id || "");
    setBranchId(firstBranch?.id || "");
    setNote("");
    setItems([]);
    setSearchVariant("");
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

    setEditingReceiptId(receipt.id);
    setSupplierId(receipt.supplierId || receipt.supplier?.id || "");
    setBranchId(receipt.branchId || receipt.branch?.id || "");
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
        unitCost: "0",
      },
    ]);
    // Giữ nguyên mã đang tìm để có thể chọn tiếp nhiều SKU con cùng mã cha.
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
        qty: "1",
        unitCost: "0",
      }));

    if (!nextItems.length) return;

    setItems((prev) => [...prev, ...nextItems]);
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
    if (!branchId) {
      setError("Chưa chọn kho nhập.");
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
        branchId,
        note: note.trim() || undefined,
        createdById,
        items: items.map((item) => ({
          variantId: item.variantId,
          qty: Number(item.qty || 0),
          unitCost: isAdmin ? Number(item.unitCost || 0) : 0,
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
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight">Phiếu nhập hàng</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kho tạo phiếu nhập, xác nhận đủ hàng và theo dõi quy trình nhập kho.
          </p>
        </div>

        {canCreateReceipt ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Tạo phiếu nhập
          </button>
        ) : null}
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.75fr_auto]">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mã phiếu, kho, SKU, tên sản phẩm..."
          />

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
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

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filteredRows.length} phiếu
          </div>
        </div>
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
                      <p className="text-sm font-semibold text-neutral-900">
                        {receipt.receiptCode}
                      </p>

                      {receipt.status === "COMPLETED" ? (
                        <Badge tone="green">Đã hoàn tất</Badge>
                      ) : receipt.status === "STOCK_IMPORTED" ? (
                        <Badge tone="blue">Đã nhập kho</Badge>
                      ) : receipt.status === "PAID" ? (
                        <Badge tone="green">{isAdmin ? "Đã thanh toán đủ" : "Đã xác nhận đủ hàng"}</Badge>
                      ) : receipt.status === "PARTIALLY_PAID" ? (
                        <Badge tone="amber">{isAdmin ? "Thanh toán một phần" : "Đã xác nhận đủ hàng"}</Badge>
                      ) : receipt.status === "PAYMENT_REQUESTED" ? (
                        <Badge tone="blue">{isAdmin ? "Chờ thanh toán" : "Đã xác nhận đủ hàng"}</Badge>
                      ) : receipt.status === "CANCELLED" ? (
                        <Badge tone="red">Đã hủy</Badge>
                      ) : (
                        <Badge tone="amber">Nháp</Badge>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-neutral-500">
                      <p>Kho nhập: {receipt.branch?.name || "—"}</p>
                      {isAdmin ? <p>Nhà cung cấp: {receipt.supplier?.name || "—"}</p> : null}
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
                      {isAdmin ? <p>Tổng tiền: {currency(receiptAmount)}</p> : null}
                      {isAdmin ? <p>Đã thanh toán: {currency(paidAmount)}</p> : null}
                      {(isAdmin || canConfirmReceipt) && receipt.status === "PAID" ? (
                        <p className="font-medium text-green-700">Đã thanh toán đủ · chờ nhập kho</p>
                      ) : null}
                      {receipt.note ? <p>Ghi chú: {receipt.note}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleReceiptExpanded(receipt.id)}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                      >
                        {expanded ? "Thu gọn" : "Xem chi tiết"}
                      </button>

                      {receipt.status === "DRAFT" &&
                      (canEditReceipt || canConfirmReceipt || canCancelReceipt) ? (
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

                          {canConfirmReceipt ? (
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

                      {isAdmin &&
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

                      {(isAdmin || canConfirmReceipt) && receipt.status === "PAID" ? (
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

                      {(isAdmin || canConfirmReceipt) && receipt.status === "STOCK_IMPORTED" ? (
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
    className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
    value={branchId}
    onChange={(e) => setBranchId(e.target.value)}
  >
    <option value="">Chọn kho nhập</option>
    {branches.map((item) => (
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
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Thêm sản phẩm / variant
            </p>

            <input
              className="mb-3 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
              value={searchVariant}
              onChange={(e) => setSearchVariant(e.target.value)}
              placeholder="Tìm theo tên sản phẩm, SKU, màu, size..."
            />

            <div className="max-h-40 overflow-auto rounded-xl border border-neutral-200">
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
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition ${
                          added
                            ? "cursor-not-allowed bg-emerald-50"
                            : "hover:bg-neutral-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {item.sku} · {item.color || "—"} / {item.size || "—"}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            added ? "text-emerald-700" : "text-neutral-500"
                          }`}
                        >
                          {added ? "Đã thêm" : "Thêm"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>

          <Panel className="min-h-0 overflow-hidden">
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
                    {items.map((item) => {
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
              {isAdmin ? (
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
              disabled={paying}
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