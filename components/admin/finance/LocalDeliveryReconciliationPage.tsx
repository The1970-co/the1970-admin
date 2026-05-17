"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import {
  getCurrentUserFromStorage,
  getCurrentUserPermissions,
} from "@/lib/current-user";

type QuickRange = "today" | "yesterday" | "7d" | "30d" | "custom";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRange(type: QuickRange) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (type === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { from: toDateInput(d), to: toDateInput(d) };
  }

  if (type === "7d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: toDateInput(d), to: toDateInput(today) };
  }

  if (type === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return { from: toDateInput(d), to: toDateInput(today) };
  }

  return { from: toDateInput(today), to: toDateInput(today) };
}

function statusClass(status: string) {
  if (status === "DELIVERED")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DELIVERING")
    return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function LocalDeliveryReconciliationPage() {
  const currentUser = getCurrentUserFromStorage();
  const currentPermissions = getCurrentUserPermissions(currentUser);
  const canViewLocalDelivery =
    currentPermissions.includes("*") ||
    currentPermissions.includes("finance.local_delivery.view");
  const canConfirmLocalDelivery =
    currentPermissions.includes("*") ||
    currentPermissions.includes("finance.local_delivery.confirm");
  const currentBranchId =
    currentUser?.branchId ||
    currentUser?.workingBranchId ||
    currentUser?.branch?.id ||
    "";
  const isGlobalFinanceUser =
    currentPermissions.includes("*") ||
    currentPermissions.includes("finance.view");

  const initialRange = useMemo(() => getRange("today"), []);
  const [quickRange, setQuickRange] = useState<QuickRange>("today");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [branchId, setBranchId] = useState("ALL");
  const [carrier, setCarrier] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [note, setNote] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState("");

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range === "custom") return;
    const next = getRange(range);
    setDateFrom(next.from);
    setDateTo(next.to);
  };

  const loadMeta = async () => {
    const [branchRows, sourceRows] = await Promise.all([
      apiJson<any[]>("/branches").catch(() => []),
      apiJson<any[]>("/payment-sources").catch(() => []),
    ]);

    const nextBranches = Array.isArray(branchRows) ? branchRows : [];
    setBranches(
      isGlobalFinanceUser || !currentBranchId
        ? nextBranches
        : nextBranches.filter(
            (b: any) => String(b.id) === String(currentBranchId),
          ),
    );
    setPaymentSources(Array.isArray(sourceRows) ? sourceRows : []);

    if (!isGlobalFinanceUser && currentBranchId) {
      setBranchId(currentBranchId);
    }

    const codLike = Array.isArray(sourceRows)
      ? sourceRows.find((s: any) =>
          String(s?.type || s?.code || "")
            .toUpperCase()
            .includes("COD"),
        )
      : null;
    const cashLike = Array.isArray(sourceRows)
      ? sourceRows.find(
          (s: any) =>
            String(s?.code || s?.name || "")
              .toUpperCase()
              .includes("TIEN") ||
            String(s?.code || "")
              .toUpperCase()
              .includes("CASH"),
        )
      : null;

    setPaymentSourceId(
      String(codLike?.id || cashLike?.id || sourceRows?.[0]?.id || ""),
    );
  };

  const loadData = async () => {
    if (!canViewLocalDelivery) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        branchId:
          !isGlobalFinanceUser && currentBranchId ? currentBranchId : branchId,
        carrier,
        status,
        q,
      });

      const result = await apiJson<any>(
        `/finance/local-delivery-reconciliation?${params.toString()}`,
      );
      setData(result);
      setSelectedIds([]);
      setDeletedIds([]);
      setBulkMessage("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, [currentBranchId, isGlobalFinanceUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    dateFrom,
    dateTo,
    branchId,
    carrier,
    status,
    q,
    canViewLocalDelivery,
    currentBranchId,
    isGlobalFinanceUser,
  ]);

  const markDelivered = async (row: any, collectCod: boolean) => {
    if (!canConfirmLocalDelivery) {
      alert("Bạn không có quyền xác nhận COD nội thành.");
      return;
    }

    if (collectCod && !paymentSourceId) {
      alert("Chọn nguồn tiền nhận COD trước.");
      return;
    }

    setActionId(row.orderId);
    try {
      await apiJson(
        `/finance/local-delivery-reconciliation/${row.orderId}/delivered`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectCod,
            paymentSourceId: collectCod ? paymentSourceId : undefined,
            amount: collectCod
              ? row.needCollectAmount || row.codAmount
              : undefined,
            note: note || undefined,
          }),
        },
      );

      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cập nhật đối soát thất bại.");
    } finally {
      setActionId(null);
    }
  };

  const summary = data?.summary || {};
  const rawRows = Array.isArray(data?.rows) ? data.rows : [];
  const rows = rawRows.filter(
    (row: any) => !deletedIds.includes(getLocalRowKey(row)),
  );
  const selectedRows = rows.filter((row: any) =>
    selectedIds.includes(getLocalRowKey(row)),
  );
  const allRowsSelected =
    rows.length > 0 &&
    rows.every((row: any) => selectedIds.includes(getLocalRowKey(row)));

  const toggleRow = (row: any) => {
    const key = getLocalRowKey(row);
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key],
    );
  };

  const toggleAllRows = () => {
    const rowKeys = rows.map((row: any) => getLocalRowKey(row));
    setSelectedIds((prev) => {
      if (
        rowKeys.length > 0 &&
        rowKeys.every((key: string) => prev.includes(key))
      ) {
        return prev.filter((key) => !rowKeys.includes(key));
      }
      return Array.from(new Set([...prev, ...rowKeys]));
    });
  };

  const hideRows = (rowKeys: string[]) => {
    if (!rowKeys.length) return;
    if (!confirm(`Xóa ${rowKeys.length} dòng khỏi danh sách đang xem?`)) return;

    setDeletedIds((prev) => Array.from(new Set([...prev, ...rowKeys])));
    setSelectedIds((prev) => prev.filter((key) => !rowKeys.includes(key)));
    setBulkMessage(`Đã xóa ${rowKeys.length} dòng khỏi màn đối soát.`);
  };

  const markSelectedDelivered = async (collectCod: boolean) => {
    if (!selectedRows.length) {
      alert("Chọn ít nhất 1 đơn nội thành trước.");
      return;
    }

    if (collectCod && !paymentSourceId) {
      alert("Chọn nguồn tiền nhận COD trước.");
      return;
    }

    setActionId("__bulk__");
    try {
      for (const row of selectedRows) {
        await markDelivered(row, collectCod);
      }
      setBulkMessage(
        collectCod
          ? `Đã thanh toán COD cho ${selectedRows.length} đơn đã chọn.`
          : `Đã xác nhận giao thành công ${selectedRows.length} đơn đã chọn.`,
      );
      setSelectedIds([]);
    } finally {
      setActionId(null);
    }
  };

  if (!canViewLocalDelivery) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Bạn chưa có quyền xem đối soát nội thành.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-neutral-500">
          Tài chính / Đối soát nội thành
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
          Đối soát vận chuyển nội thành
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Dành cho Ahamove, shipper nội bộ và các hãng nội thành. Có thể xác
          nhận giao thành công thủ công, đồng thời ghi nhận COD vào dòng tiền.
        </p>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">
              Khoảng thời gian
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ["today", "Hôm nay"],
                ["yesterday", "Hôm qua"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["custom", "Tuỳ chọn"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => applyQuickRange(value as QuickRange)}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    quickRange === value
                      ? "bg-black text-white"
                      : "border border-neutral-200 bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Từ ngày">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setQuickRange("custom");
                setDateFrom(e.target.value);
              }}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </Field>

          <Field label="Đến ngày">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setQuickRange("custom");
                setDateTo(e.target.value);
              }}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </Field>

          <Field label="Chi nhánh">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            >
              {isGlobalFinanceUser ? (
                <option value="ALL">Tất cả chi nhánh</option>
              ) : null}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.id}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hãng nội thành">
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            >
              <option value="ALL">Tất cả nội thành</option>
              <option value="AHAMOVE">Ahamove</option>
              <option value="SHIPPER">Shipper nội bộ</option>
              <option value="GRAB">Grab</option>
            </select>
          </Field>

          <div className="flex items-end">
            <button
              onClick={() => void loadData()}
              className="h-11 rounded-xl bg-black px-5 text-sm font-medium text-white"
            >
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px_260px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã đơn, vận đơn, khách hàng, SĐT..."
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ đối soát</option>
            <option value="DELIVERING">Đang giao</option>
            <option value="DELIVERED">Đã giao thành công</option>
            <option value="FAILED">Giao thất bại</option>
          </select>

          <select
            value={paymentSourceId}
            onChange={(e) => setPaymentSourceId(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="">Chọn nguồn nhận COD</option>
            {paymentSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú đối soát nội thành..."
          className="mt-4 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-6">
        <Stat title="Tổng đơn" value={summary.totalRows || 0} />
        <Stat title="Chờ đối soát" value={summary.pending || 0} />
        <Stat title="Đang giao" value={summary.delivering || 0} />
        <Stat title="Đã giao" value={summary.delivered || 0} ok />
        <Stat
          title="COD cần thu"
          value={currency(summary.totalNeedCollect || 0)}
        />
        <Stat title="Phí ship" value={currency(summary.totalFee || 0)} />
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              Danh sách đơn nội thành
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Nhân viên đối soát có thể tick giao thành công hoặc ghi nhận COD
              đã nhận.
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm"
          >
            Làm mới
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-sm text-neutral-600">
            Đã chọn <b>{selectedRows.length}</b> đơn · Đang hiển thị{" "}
            <b>{rows.length}</b> đơn
            {bulkMessage ? (
              <span className="ml-3 font-medium text-emerald-700">
                {bulkMessage}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => markSelectedDelivered(false)}
              disabled={!selectedRows.length || actionId === "__bulk__"}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Xác nhận đã giao
            </button>
            <button
              onClick={() => markSelectedDelivered(true)}
              disabled={!selectedRows.length || actionId === "__bulk__"}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Thanh toán COD đã chọn
            </button>
            <button
              onClick={() => hideRows(selectedIds)}
              disabled={!selectedIds.length || actionId === "__bulk__"}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Xóa dòng chọn
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-400">
                <th className="w-10 pb-3 font-medium">
                  <input
                    type="checkbox"
                    checked={allRowsSelected}
                    onChange={toggleAllRows}
                  />
                </th>
                <th className="pb-3 font-medium">Mã đơn</th>
                <th className="pb-3 font-medium">Khách hàng</th>
                <th className="pb-3 font-medium">Hãng</th>
                <th className="pb-3 font-medium">Mã vận đơn</th>
                <th className="pb-3 font-medium">Trạng thái</th>
                <th className="pb-3 font-medium text-right">COD</th>
                <th className="pb-3 font-medium text-right">Đã thu</th>
                <th className="pb-3 font-medium text-right">Còn thu</th>
                <th className="pb-3 font-medium">Địa chỉ</th>
                <th className="pb-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={getLocalRowKey(row)} className="border-b align-top">
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(getLocalRowKey(row))}
                      onChange={() => toggleRow(row)}
                    />
                  </td>
                  <td className="py-3 font-semibold">{row.orderCode}</td>
                  <td className="py-3">
                    <div className="font-medium">{row.customerName}</div>
                    <div className="text-xs text-neutral-500">
                      {row.customerPhone}
                    </div>
                  </td>
                  <td className="py-3">{row.carrierName}</td>
                  <td className="py-3 font-medium text-purple-700">
                    {row.trackingCode}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(row.localStatus)}`}
                    >
                      {row.localStatusLabel}
                    </span>
                    <div className="mt-1 text-xs text-neutral-400">
                      {row.shippingStatus ||
                        row.partnerStatus ||
                        row.ahamoveStatus ||
                        "—"}
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium">
                    {currency(row.codAmount)}
                  </td>
                  <td className="py-3 text-right">
                    {currency(row.paidAmount)}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {currency(row.needCollectAmount)}
                  </td>
                  <td className="max-w-[260px] py-3 text-neutral-600">
                    <div className="line-clamp-2">{row.address}</div>
                    {row.note ? (
                      <div className="mt-1 text-xs text-neutral-400">
                        {row.note}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={
                          actionId === row.orderId ||
                          row.localStatus === "DELIVERED"
                        }
                        onClick={() => markDelivered(row, false)}
                        className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium disabled:opacity-40"
                      >
                        Đã giao
                      </button>
                      <button
                        disabled={
                          actionId === row.orderId ||
                          row.localStatus === "DELIVERED"
                        }
                        onClick={() => markDelivered(row, true)}
                        className="rounded-xl bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Đã nhận COD
                      </button>
                      <button
                        onClick={() => hideRows([getLocalRowKey(row)])}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length ? (
          <p className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
            Chưa có đơn vận chuyển nội thành trong bộ lọc hiện tại.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function getLocalRowKey(row: any) {
  return String(
    row?.shipmentId ||
      row?.orderId ||
      row?.trackingCode ||
      row?.orderCode ||
      "",
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-neutral-500">{label}</p>
      {children}
    </div>
  );
}

function Stat({
  title,
  value,
  ok,
}: {
  title: string;
  value: any;
  ok?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${ok ? "text-emerald-600" : "text-neutral-950"}`}
      >
        {value}
      </p>
    </div>
  );
}
