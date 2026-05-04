"use client";

import { useEffect, useMemo, useState } from "react";
import type { PurchaseReceipt } from "@/lib/purchase-receipts-api";
import { getPaymentSources, type PaymentSourceItem } from "@/lib/payment-sources-api";
import {
  getSupplierPaymentReceipts,
  paySupplierReceipt,
  updateSupplierPaymentItemCosts,
} from "@/lib/supplier-payments-api";
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

function getReceiptItems(receipt: PurchaseReceipt) {
  return Array.isArray(receipt.items) ? receipt.items : [];
}

function getReceiptPayments(receipt: PurchaseReceipt) {
  return Array.isArray(receipt.purchaseReceiptPayments)
    ? receipt.purchaseReceiptPayments
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
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
}

function statusLabel(status: string) {
  if (status === "PAYMENT_REQUESTED") return "Chờ thanh toán";
  if (status === "PARTIALLY_PAID") return "Thanh toán một phần";
  if (status === "PAID") return "Đã thanh toán đủ";
  if (status === "STOCK_IMPORTED") return "Đã nhập kho";
  if (status === "COMPLETED") return "Hoàn tất";
  return status;
}

function isPayable(status: string) {
  return status === "PAYMENT_REQUESTED" || status === "PARTIALLY_PAID";
}

export default function SupplierPaymentsPageClient() {
  const [rows, setRows] = useState<PurchaseReceipt[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [paying, setPaying] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selected, setSelected] = useState<PurchaseReceipt | null>(null);
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentUser = getCurrentUserFromStorage();

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((receipt) => {
      const matchQuery =
        !q ||
        receipt.receiptCode.toLowerCase().includes(q) ||
        String(receipt.supplier?.name || "").toLowerCase().includes(q) ||
        String(receipt.branch?.name || "").toLowerCase().includes(q) ||
        getReceiptItems(receipt).some((item) =>
          `${item.sku} ${item.productName} ${item.color || ""} ${item.size || ""}`
            .toLowerCase()
            .includes(q)
        );

      const matchStatus = statusFilter === "ALL" || receipt.status === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [rows, query, statusFilter]);

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
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu thanh toán NCC.");
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
        getReceiptItems(receipt).map((item) => [item.id, String(Number(item.unitCost || 0))])
      )
    );
    setPaymentSourceId(firstSource?.id || "");
    setAmount(String(remaining));
    setNote(`Thanh toán NCC ${receipt.supplier?.name || ""} - ${receipt.receiptCode}`.trim());
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

    const invalid = getReceiptItems(selected).find((item) => Number(costDraft[item.id] || 0) < 0);
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

    const missingCost = getReceiptItems(selected).find((item) => Number(costDraft[item.id] || 0) <= 0);
    if (missingCost) {
      setError(`SKU ${missingCost.sku} chưa có giá nhập. Cần cập nhật giá trước khi thanh toán.`);
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
        paidByName: currentUser?.fullName || currentUser?.name || currentUser?.username,
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
      <div>
        <h2 className="text-[28px] font-semibold tracking-tight">Thanh toán nhà cung cấp</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Xử lý yêu cầu thanh toán từ phiếu nhập, theo dõi đã trả, còn phải trả và lịch sử dòng tiền.
        </p>
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.75fr_auto]">
          <input
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã phiếu, nhà cung cấp, kho, SKU..."
          />

          <select
            className="rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PAYMENT_REQUESTED">Chờ thanh toán</option>
            <option value="PARTIALLY_PAID">Thanh toán một phần</option>
            <option value="PAID">Đã thanh toán đủ</option>
            <option value="STOCK_IMPORTED">Đã nhập kho</option>
            <option value="COMPLETED">Hoàn tất</option>
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
                    <tr key={receipt.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2.5 font-semibold">{receipt.receiptCode}</td>
                      <td className="px-3 py-2.5">{receipt.supplier?.name || "—"}</td>
                      <td className="px-3 py-2.5">{receipt.branch?.name || "—"}</td>
                      <td className="px-3 py-2.5">{currency(total)}</td>
                      <td className="px-3 py-2.5">{currency(paid)}</td>
                      <td className="px-3 py-2.5">{currency(remaining)}</td>
                      <td className="px-3 py-2.5">{statusLabel(receipt.status)}</td>
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

      <Modal open={Boolean(selected)} onClose={closePay} title="Thanh toán nhà cung cấp">
        {selected ? (
          <div className="space-y-3">
            <Panel className="p-3">
              <div className="grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                <p>
                  Phiếu: <span className="font-semibold text-neutral-900">{selected.receiptCode}</span>
                </p>
                <p>
                  NCC: <span className="font-semibold text-neutral-900">{selected.supplier?.name || "—"}</span>
                </p>
                <p>
                  Tổng tiền hiện tại:{" "}
                  <span className="font-semibold text-neutral-900">{currency(selectedTotalFromDraft())}</span>
                </p>
                <p>
                  Đã trả:{" "}
                  <span className="font-semibold text-neutral-900">{currency(getPaidAmount(selected))}</span>
                </p>
                <p>
                  Còn lại:{" "}
                  <span className="font-semibold text-neutral-900">
                    {currency(Math.max(selectedTotalFromDraft() - getPaidAmount(selected), 0))}
                  </span>
                </p>
                <p>
                  Trạng thái:{" "}
                  <span className="font-semibold text-neutral-900">{statusLabel(selected.status)}</span>
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
                        <tr key={item.id} className="border-t border-neutral-200">
                          <td className="px-3 py-2.5 font-medium">{item.sku}</td>
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
              <p className="mb-2 text-sm font-semibold text-neutral-900">Lịch sử thanh toán / Ledger</p>
              {getReceiptPayments(selected).length === 0 ? (
                <p className="text-sm text-neutral-500">Chưa có lần thanh toán nào.</p>
              ) : (
                <div className="space-y-2">
                  {getReceiptPayments(selected).map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                          <span className="font-semibold text-neutral-900">{currency(Number(payment.amount || 0))}</span>{" "}
                          · {payment.paymentSource?.name || "Nguồn tiền"}
                        </p>
                        <p>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : ""}</p>
                      </div>
                      {payment.note ? <p className="mt-1">{payment.note}</p> : null}
                      {payment.paidByName ? <p className="mt-1">Người thanh toán: {payment.paidByName}</p> : null}
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
                    paying ? "cursor-not-allowed bg-neutral-400" : "bg-neutral-900 hover:bg-neutral-800"
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
