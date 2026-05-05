"use client";

import { useEffect, useMemo, useState } from "react";
import type { PurchaseReceipt } from "@/lib/purchase-receipts-api";
import {
  getPaymentSources,
  type PaymentSourceItem,
} from "@/lib/payment-sources-api";
import {
  getSupplierPaymentReceipts,
  paySupplierReceipt,
  updateSupplierPaymentItemCosts,
} from "@/lib/supplier-payments-api";
import { getCurrentUserFromStorage } from "@/lib/current-user";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function dateText(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

function dateTimeText(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
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
          <button
            onClick={onClose}
            className="text-lg text-neutral-500"
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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </Panel>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  const className =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function getReceiptItems(receipt: PurchaseReceipt) {
  return Array.isArray(receipt.items) ? receipt.items : [];
}

function getReceiptPayments(receipt: PurchaseReceipt) {
  return Array.isArray(receipt.purchaseReceiptPayments)
    ? receipt.purchaseReceiptPayments
    : [];
}

function getReceiptAmount(receipt: PurchaseReceipt) {
  const itemTotal = getReceiptItems(receipt).reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0,
  );

  return (
    itemTotal ||
    Number(
      (receipt as PurchaseReceipt & { totalAmount?: number }).totalAmount || 0,
    )
  );
}

function getPaidAmount(receipt: PurchaseReceipt) {
  return getReceiptPayments(receipt).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
}

function getRemainingAmount(receipt: PurchaseReceipt) {
  return Math.max(getReceiptAmount(receipt) - getPaidAmount(receipt), 0);
}

function getReceiptCreatedAt(receipt: PurchaseReceipt) {
  return (
    (
      receipt as PurchaseReceipt & {
        createdAt?: string | Date;
        importedAt?: string | Date;
        updatedAt?: string | Date;
      }
    ).createdAt ||
    (receipt as PurchaseReceipt & { importedAt?: string | Date }).importedAt ||
    (receipt as PurchaseReceipt & { updatedAt?: string | Date }).updatedAt ||
    null
  );
}

function getSupplierId(receipt: PurchaseReceipt) {
  return (
    receipt.supplier?.id ||
    (receipt as PurchaseReceipt & { supplierId?: string }).supplierId ||
    "UNKNOWN"
  );
}

function getSupplierName(receipt: PurchaseReceipt) {
  return receipt.supplier?.name || "Chưa gắn NCC";
}

function statusLabel(status: string) {
  if (status === "PAYMENT_REQUESTED") return "Chờ thanh toán";
  if (status === "PARTIALLY_PAID") return "Thanh toán một phần";
  if (status === "PAID") return "Đã thanh toán đủ";
  if (status === "STOCK_IMPORTED") return "Đã nhập kho";
  if (status === "COMPLETED") return "Hoàn tất";
  return status;
}

function statusTone(
  status: string,
  remaining: number,
): "green" | "amber" | "red" | "neutral" {
  if (remaining <= 0 || status === "PAID" || status === "COMPLETED")
    return "green";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "PAYMENT_REQUESTED") return "red";
  return "neutral";
}

function isPayable(status: string) {
  return status === "PAYMENT_REQUESTED" || status === "PARTIALLY_PAID";
}

type SupplierSummary = {
  supplierId: string;
  supplierName: string;
  totalImport: number;
  totalPaid: number;
  balance: number;
  receiptCount: number;
  unpaidReceiptCount: number;
  lastTransactionAt: string | Date | null;
  receipts: PurchaseReceipt[];
};

type LedgerEntry = {
  id: string;
  date: string | Date | null;
  type: "IMPORT" | "PAYMENT";
  refCode: string;
  receipt: PurchaseReceipt;
  sourceName?: string;
  note?: string;
  debit: number;
  credit: number;
  balance: number;
};

export default function SupplierPaymentsPageClient() {
  const [rows, setRows] = useState<PurchaseReceipt[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [paying, setPaying] = useState(false);

  const [viewMode, setViewMode] = useState<"SUPPLIERS" | "RECEIPTS">(
    "SUPPLIERS",
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [debtFilter, setDebtFilter] = useState("ALL");

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [selected, setSelected] = useState<PurchaseReceipt | null>(null);
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentUser = getCurrentUserFromStorage();

  const supplierSummaries = useMemo<SupplierSummary[]>(() => {
    const map = new Map<string, SupplierSummary>();

    rows.forEach((receipt) => {
      const supplierId = getSupplierId(receipt);
      const total = getReceiptAmount(receipt);
      const paid = getPaidAmount(receipt);
      const remaining = Math.max(total - paid, 0);
      const receiptDate = getReceiptCreatedAt(receipt);
      const lastPaymentAt = getReceiptPayments(receipt)
        .map((payment) => payment.paidAt)
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(String(b)).getTime() - new Date(String(a)).getTime(),
        )[0];
      const transactionAt = lastPaymentAt || receiptDate;

      const current =
        map.get(supplierId) ||
        ({
          supplierId,
          supplierName: getSupplierName(receipt),
          totalImport: 0,
          totalPaid: 0,
          balance: 0,
          receiptCount: 0,
          unpaidReceiptCount: 0,
          lastTransactionAt: null,
          receipts: [],
        } satisfies SupplierSummary);

      current.supplierName = getSupplierName(receipt);
      current.totalImport += total;
      current.totalPaid += paid;
      current.balance += remaining;
      current.receiptCount += 1;
      current.unpaidReceiptCount += remaining > 0 ? 1 : 0;
      current.receipts.push(receipt);

      if (transactionAt) {
        const prev = current.lastTransactionAt
          ? new Date(current.lastTransactionAt).getTime()
          : 0;
        const next = new Date(transactionAt).getTime();
        if (!Number.isNaN(next) && next > prev)
          current.lastTransactionAt = transactionAt;
      }

      map.set(supplierId, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.supplierName.localeCompare(b.supplierName, "vi");
    });
  }, [rows]);

  const supplierTotal = useMemo(() => {
    return supplierSummaries.reduce(
      (acc, item) => {
        acc.totalImport += item.totalImport;
        acc.totalPaid += item.totalPaid;
        acc.balance += item.balance;
        acc.unpaidSuppliers += item.balance > 0 ? 1 : 0;
        return acc;
      },
      { totalImport: 0, totalPaid: 0, balance: 0, unpaidSuppliers: 0 },
    );
  }, [supplierSummaries]);

  const filteredSupplierSummaries = useMemo(() => {
    const q = query.trim().toLowerCase();

    return supplierSummaries.filter((supplier) => {
      const matchQuery =
        !q ||
        supplier.supplierName.toLowerCase().includes(q) ||
        supplier.receipts.some((receipt) =>
          `${receipt.receiptCode} ${receipt.branch?.name || ""} ${getReceiptItems(
            receipt,
          )
            .map((item) => `${item.sku} ${item.productName}`)
            .join(" ")}`
            .toLowerCase()
            .includes(q),
        );

      const matchDebt =
        debtFilter === "ALL" ||
        (debtFilter === "DEBT" && supplier.balance > 0) ||
        (debtFilter === "PAID" && supplier.balance <= 0);

      return matchQuery && matchDebt;
    });
  }, [supplierSummaries, query, debtFilter]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((receipt) => {
      const matchQuery =
        !q ||
        receipt.receiptCode.toLowerCase().includes(q) ||
        String(receipt.supplier?.name || "")
          .toLowerCase()
          .includes(q) ||
        String(receipt.branch?.name || "")
          .toLowerCase()
          .includes(q) ||
        getReceiptItems(receipt).some((item) =>
          `${item.sku} ${item.productName} ${item.color || ""} ${item.size || ""}`
            .toLowerCase()
            .includes(q),
        );

      const remaining = getRemainingAmount(receipt);
      const matchStatus =
        statusFilter === "ALL" || receipt.status === statusFilter;
      const matchDebt =
        debtFilter === "ALL" ||
        (debtFilter === "DEBT" && remaining > 0) ||
        (debtFilter === "PAID" && remaining <= 0);

      return matchQuery && matchStatus && matchDebt;
    });
  }, [rows, query, statusFilter, debtFilter]);

  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return (
      supplierSummaries.find(
        (supplier) => supplier.supplierId === selectedSupplierId,
      ) || null
    );
  }, [selectedSupplierId, supplierSummaries]);

  const selectedSupplierLedger = useMemo<LedgerEntry[]>(() => {
    if (!selectedSupplier) return [];

    const entries: Omit<LedgerEntry, "balance">[] = [];

    selectedSupplier.receipts.forEach((receipt) => {
      entries.push({
        id: `IMPORT-${receipt.id}`,
        date: getReceiptCreatedAt(receipt),
        type: "IMPORT",
        refCode: receipt.receiptCode,
        receipt,
        debit: getReceiptAmount(receipt),
        credit: 0,
      });

      getReceiptPayments(receipt).forEach((payment) => {
        entries.push({
          id: `PAYMENT-${payment.id}`,
          date: payment.paidAt || getReceiptCreatedAt(receipt),
          type: "PAYMENT",
          refCode: receipt.receiptCode,
          receipt,
          sourceName: payment.paymentSource?.name,
          note: payment.note || payment.paidByName || undefined,
          debit: 0,
          credit: Number(payment.amount || 0),
        });
      });
    });

    let runningBalance = 0;
    return entries
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        if (da !== db) return da - db;
        if (a.type !== b.type) return a.type === "IMPORT" ? -1 : 1;
        return a.refCode.localeCompare(b.refCode);
      })
      .map((entry) => {
        runningBalance += entry.debit - entry.credit;
        return { ...entry, balance: runningBalance };
      });
  }, [selectedSupplier]);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [receiptsData, paymentSourcesData] = await Promise.all([
        getSupplierPaymentReceipts(),
        getPaymentSources(),
      ]);

      setRows(receiptsData);
      setPaymentSources(paymentSourcesData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được dữ liệu thanh toán NCC.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function openPay(receipt: PurchaseReceipt) {
    const total = getReceiptAmount(receipt);
    const paid = getPaidAmount(receipt);
    const remaining = Math.max(total - paid, 0);
    const firstSource = paymentSources.find((item) => item.isActive);

    setSelected(receipt);
    setCostDraft(
      Object.fromEntries(
        getReceiptItems(receipt).map((item) => [
          item.id,
          String(Number(item.unitCost || 0)),
        ]),
      ),
    );
    setPaymentSourceId(firstSource?.id || "");
    setAmount(String(remaining));
    setNote(
      `Thanh toán NCC ${receipt.supplier?.name || ""} - ${receipt.receiptCode}`.trim(),
    );
    setError(null);
    setNotice(null);
  }

  function closePay() {
    setSelected(null);
    setCostDraft({});
    setPaymentSourceId("");
    setAmount("");
    setNote("");
  }

  function selectedTotalFromDraft() {
    if (!selected) return 0;
    return getReceiptItems(selected).reduce((sum, item) => {
      const unitCost = Number(costDraft[item.id] || 0);
      return sum + Number(item.qty || 0) * unitCost;
    }, 0);
  }

  async function handleSaveCosts() {
    if (!selected) return;

    const invalid = getReceiptItems(selected).find(
      (item) => Number(costDraft[item.id] || 0) < 0,
    );
    if (invalid) {
      setError(`Giá nhập SKU ${invalid.sku} không hợp lệ.`);
      return;
    }

    try {
      setSavingCosts(true);
      setError(null);
      setNotice(null);

      const updated = await updateSupplierPaymentItemCosts(selected.id, {
        items: getReceiptItems(selected).map((item) => ({
          itemId: item.id,
          unitCost: Number(costDraft[item.id] || 0),
        })),
      });

      setSelected(updated);
      const total = getReceiptAmount(updated);
      const paid = getPaidAmount(updated);
      setAmount(String(Math.max(total - paid, 0)));
      setNotice("Đã cập nhật giá nhập cho phiếu.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được giá nhập.");
    } finally {
      setSavingCosts(false);
    }
  }

  async function handlePay() {
    if (!selected) return;

    const missingCost = getReceiptItems(selected).find(
      (item) => Number(costDraft[item.id] || 0) <= 0,
    );
    if (missingCost) {
      setError(
        `SKU ${missingCost.sku} chưa có giá nhập. Cần cập nhật giá trước khi thanh toán.`,
      );
      return;
    }

    if (!paymentSourceId) {
      setError("Chưa chọn nguồn tiền.");
      return;
    }

    if (Number(amount || 0) <= 0) {
      setError("Số tiền thanh toán phải lớn hơn 0.");
      return;
    }

    try {
      setPaying(true);
      setError(null);
      setNotice(null);

      await paySupplierReceipt({
        receiptId: selected.id,
        amount: Number(amount || 0),
        paymentSourceId,
        note: note.trim() || undefined,
        paidById: currentUser?.id,
        paidByName:
          currentUser?.fullName || currentUser?.name || currentUser?.username,
      });

      setNotice("Đã ghi nhận thanh toán nhà cung cấp.");
      closePay();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thanh toán được.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Finance · Supplier Ledger
          </p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight">
            Sổ công nợ nhà cung cấp
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Theo dõi tổng đã nhập, đã thanh toán, còn phải trả và lịch sử phát
            sinh theo từng nhà cung cấp.
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("SUPPLIERS")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              viewMode === "SUPPLIERS"
                ? "bg-neutral-950 text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Sổ NCC
          </button>
          <button
            type="button"
            onClick={() => setViewMode("RECEIPTS")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              viewMode === "RECEIPTS"
                ? "bg-neutral-950 text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Phiếu thanh toán
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng nhập NCC"
          value={currency(supplierTotal.totalImport)}
          hint={`${rows.length} phiếu nhập có công nợ`}
        />
        <StatCard
          label="Đã thanh toán"
          value={currency(supplierTotal.totalPaid)}
          hint="Tổng tiền đã chi theo phiếu"
        />
        <StatCard
          label="Còn phải trả"
          value={currency(supplierTotal.balance)}
          hint={`${supplierTotal.unpaidSuppliers} NCC còn công nợ`}
        />
        <StatCard
          label="Nhà cung cấp"
          value={`${supplierSummaries.length}`}
          hint="Đã phát sinh phiếu nhập / thanh toán"
        />
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.75fr_0.75fr_auto]">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã phiếu, nhà cung cấp, kho, SKU..."
          />

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={debtFilter}
            onChange={(e) => setDebtFilter(e.target.value)}
          >
            <option value="ALL">Tất cả công nợ</option>
            <option value="DEBT">Còn nợ</option>
            <option value="PAID">Đã tất toán</option>
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={viewMode === "SUPPLIERS"}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PAYMENT_REQUESTED">Chờ thanh toán</option>
            <option value="PARTIALLY_PAID">Thanh toán một phần</option>
            <option value="PAID">Đã thanh toán đủ</option>
            <option value="STOCK_IMPORTED">Đã nhập kho</option>
            <option value="COMPLETED">Hoàn tất</option>
          </select>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {viewMode === "SUPPLIERS"
              ? `${filteredSupplierSummaries.length} NCC`
              : `${filteredRows.length} phiếu`}
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

      {viewMode === "SUPPLIERS" ? (
        <Panel className="overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Nhà cung cấp</th>
                  <th className="px-3 py-2.5 font-medium">Số phiếu</th>
                  <th className="px-3 py-2.5 font-medium">Tổng nhập</th>
                  <th className="px-3 py-2.5 font-medium">Đã thanh toán</th>
                  <th className="px-3 py-2.5 font-medium">Còn nợ</th>
                  <th className="px-3 py-2.5 font-medium">Giao dịch cuối</th>
                  <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-3 py-2.5 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-neutral-500">
                      Đang tải...
                    </td>
                  </tr>
                ) : filteredSupplierSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-neutral-500">
                      Chưa có dữ liệu công nợ nhà cung cấp.
                    </td>
                  </tr>
                ) : (
                  filteredSupplierSummaries.map((supplier) => (
                    <tr
                      key={supplier.supplierId}
                      className="border-t border-neutral-200 hover:bg-neutral-50/70"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-neutral-950">
                          {supplier.supplierName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {supplier.unpaidReceiptCount} phiếu còn nợ
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{supplier.receiptCount}</td>
                      <td className="px-3 py-2.5">
                        {currency(supplier.totalImport)}
                      </td>
                      <td className="px-3 py-2.5">
                        {currency(supplier.totalPaid)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-neutral-950">
                        {currency(supplier.balance)}
                      </td>
                      <td className="px-3 py-2.5">
                        {dateText(supplier.lastTransactionAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        {supplier.balance > 0 ? (
                          <Pill tone="red">Còn công nợ</Pill>
                        ) : (
                          <Pill tone="green">Đã tất toán</Pill>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSupplierId(supplier.supplierId)
                          }
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                        >
                          Mở sổ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Mã phiếu</th>
                  <th className="px-3 py-2.5 font-medium">Nhà cung cấp</th>
                  <th className="px-3 py-2.5 font-medium">Kho</th>
                  <th className="px-3 py-2.5 font-medium">Tổng tiền</th>
                  <th className="px-3 py-2.5 font-medium">Đã trả</th>
                  <th className="px-3 py-2.5 font-medium">Còn lại</th>
                  <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-3 py-2.5 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-neutral-500">
                      Đang tải...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-neutral-500">
                      Chưa có yêu cầu thanh toán nào.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((receipt) => {
                    const total = getReceiptAmount(receipt);
                    const paid = getPaidAmount(receipt);
                    const remaining = Math.max(total - paid, 0);
                    const canPay = isPayable(receipt.status);

                    return (
                      <tr
                        key={receipt.id}
                        className="border-t border-neutral-200 hover:bg-neutral-50/70"
                      >
                        <td className="px-3 py-2.5 font-semibold">
                          {receipt.receiptCode}
                        </td>
                        <td className="px-3 py-2.5">
                          {receipt.supplier?.name || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {receipt.branch?.name || "—"}
                        </td>
                        <td className="px-3 py-2.5">{currency(total)}</td>
                        <td className="px-3 py-2.5">{currency(paid)}</td>
                        <td className="px-3 py-2.5 font-semibold text-neutral-950">
                          {currency(remaining)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Pill tone={statusTone(receipt.status, remaining)}>
                            {statusLabel(receipt.status)}
                          </Pill>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => openPay(receipt)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${
                              canPay
                                ? "border-green-300 bg-green-50 text-green-700"
                                : "border-neutral-300 bg-white text-neutral-700"
                            }`}
                          >
                            {canPay ? "Thanh toán" : "Xem"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Modal
        open={Boolean(selectedSupplier)}
        onClose={() => setSelectedSupplierId(null)}
        title={
          selectedSupplier
            ? `Sổ chi tiết · ${selectedSupplier.supplierName}`
            : "Sổ chi tiết nhà cung cấp"
        }
      >
        {selectedSupplier ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <StatCard
                label="Tổng nhập"
                value={currency(selectedSupplier.totalImport)}
              />
              <StatCard
                label="Đã thanh toán"
                value={currency(selectedSupplier.totalPaid)}
              />
              <StatCard
                label="Còn phải trả"
                value={currency(selectedSupplier.balance)}
              />
            </div>

            <Panel className="overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-[13px]">
                  <thead className="bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Ngày</th>
                      <th className="px-3 py-2.5 font-medium">Loại</th>
                      <th className="px-3 py-2.5 font-medium">Mã phiếu</th>
                      <th className="px-3 py-2.5 font-medium">
                        Phát sinh nhập
                      </th>
                      <th className="px-3 py-2.5 font-medium">Thanh toán</th>
                      <th className="px-3 py-2.5 font-medium">Số dư</th>
                      <th className="px-3 py-2.5 font-medium">Ghi chú</th>
                      <th className="px-3 py-2.5 font-medium">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplierLedger.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-neutral-500">
                          Chưa có phát sinh.
                        </td>
                      </tr>
                    ) : (
                      selectedSupplierLedger.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-t border-neutral-200"
                        >
                          <td className="px-3 py-2.5">
                            {dateTimeText(entry.date)}
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.type === "IMPORT" ? (
                              <Pill tone="amber">Nhập hàng</Pill>
                            ) : (
                              <Pill tone="green">Thanh toán</Pill>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {entry.refCode}
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.debit > 0 ? currency(entry.debit) : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.credit > 0 ? currency(entry.credit) : "—"}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-950">
                            {currency(entry.balance)}
                          </td>
                          <td className="px-3 py-2.5 text-neutral-600">
                            {entry.sourceName
                              ? `${entry.sourceName}${entry.note ? ` · ${entry.note}` : ""}`
                              : entry.note || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => openPay(entry.receipt)}
                              className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                            >
                              Xem phiếu
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selected)}
        onClose={closePay}
        title="Thanh toán nhà cung cấp"
      >
        {selected ? (
          <div className="space-y-3">
            <Panel className="p-3">
              <div className="grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                <p>
                  Phiếu:{" "}
                  <span className="font-semibold text-neutral-900">
                    {selected.receiptCode}
                  </span>
                </p>
                <p>
                  NCC:{" "}
                  <span className="font-semibold text-neutral-900">
                    {selected.supplier?.name || "—"}
                  </span>
                </p>
                <p>
                  Kho:{" "}
                  <span className="font-semibold text-neutral-900">
                    {selected.branch?.name || "—"}
                  </span>
                </p>
                <p>
                  Ngày phiếu:{" "}
                  <span className="font-semibold text-neutral-900">
                    {dateText(getReceiptCreatedAt(selected))}
                  </span>
                </p>
                <p>
                  Tổng tiền hiện tại:{" "}
                  <span className="font-semibold text-neutral-900">
                    {currency(selectedTotalFromDraft())}
                  </span>
                </p>
                <p>
                  Đã trả:{" "}
                  <span className="font-semibold text-neutral-900">
                    {currency(getPaidAmount(selected))}
                  </span>
                </p>
                <p>
                  Còn lại:{" "}
                  <span className="font-semibold text-neutral-900">
                    {currency(
                      Math.max(
                        selectedTotalFromDraft() - getPaidAmount(selected),
                        0,
                      ),
                    )}
                  </span>
                </p>
                <p>
                  Trạng thái:{" "}
                  <span className="font-semibold text-neutral-900">
                    {statusLabel(selected.status)}
                  </span>
                </p>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-[13px]">
                  <thead className="bg-neutral-50 text-left text-neutral-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">SKU</th>
                      <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                      <th className="px-3 py-2.5 font-medium">Màu</th>
                      <th className="px-3 py-2.5 font-medium">Size</th>
                      <th className="px-3 py-2.5 font-medium">SL</th>
                      <th className="px-3 py-2.5 font-medium">Giá nhập</th>
                      <th className="px-3 py-2.5 font-medium">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getReceiptItems(selected).map((item) => {
                      const unitCost = Number(costDraft[item.id] || 0);
                      const lineTotal = Number(item.qty || 0) * unitCost;
                      const canEditCost =
                        selected.status === "PAYMENT_REQUESTED" ||
                        selected.status === "PARTIALLY_PAID";

                      return (
                        <tr
                          key={item.id}
                          className="border-t border-neutral-200"
                        >
                          <td className="px-3 py-2.5 font-medium">
                            {item.sku}
                          </td>
                          <td className="px-3 py-2.5">{item.productName}</td>
                          <td className="px-3 py-2.5">{item.color || "—"}</td>
                          <td className="px-3 py-2.5">{item.size || "—"}</td>
                          <td className="px-3 py-2.5">{item.qty}</td>
                          <td className="px-3 py-2.5">
                            {canEditCost && getPaidAmount(selected) <= 0 ? (
                              <input
                                className="w-28 rounded-xl border border-neutral-300 px-3 py-1.5 text-sm outline-none"
                                value={costDraft[item.id] || "0"}
                                onChange={(e) =>
                                  setCostDraft((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              currency(Number(item.unitCost || 0))
                            )}
                          </td>
                          <td className="px-3 py-2.5">{currency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            {isPayable(selected.status) && getPaidAmount(selected) <= 0 ? (
              <div className="flex justify-end">
                <button
                  onClick={() => void handleSaveCosts()}
                  disabled={savingCosts}
                  className={`rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 ${
                    savingCosts ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  {savingCosts ? "Đang lưu giá..." : "Lưu giá nhập"}
                </button>
              </div>
            ) : null}

            <Panel className="p-3">
              <p className="mb-2 text-sm font-semibold text-neutral-900">
                Lịch sử thanh toán / Ledger
              </p>
              {getReceiptPayments(selected).length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Chưa có lần thanh toán nào.
                </p>
              ) : (
                <div className="space-y-2">
                  {getReceiptPayments(selected).map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                          <span className="font-semibold text-neutral-900">
                            {currency(Number(payment.amount || 0))}
                          </span>{" "}
                          · {payment.paymentSource?.name || "Nguồn tiền"}
                        </p>
                        <p>
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleString("vi-VN")
                            : ""}
                        </p>
                      </div>
                      {payment.note ? (
                        <p className="mt-1">{payment.note}</p>
                      ) : null}
                      {payment.paidByName ? (
                        <p className="mt-1">
                          Người thanh toán: {payment.paidByName}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {isPayable(selected.status) ? (
              <>
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Số tiền thanh toán"
                  />
                </div>

                <textarea
                  className="min-h-[72px] w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thanh toán"
                />
              </>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                onClick={closePay}
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                Đóng
              </button>

              {isPayable(selected.status) ? (
                <button
                  onClick={() => void handlePay()}
                  disabled={paying}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
                    paying
                      ? "cursor-not-allowed bg-neutral-400"
                      : "bg-neutral-900 hover:bg-neutral-800"
                  }`}
                >
                  {paying ? "Đang thanh toán..." : "Xác nhận thanh toán"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
