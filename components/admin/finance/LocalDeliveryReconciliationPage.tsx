"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import {
  getCurrentUserFromStorage,
  getCurrentUserPermissions,
} from "@/lib/current-user";

type QuickRange = "today" | "yesterday" | "7d" | "30d" | "custom";
type ActionScope = "selected" | "filtered" | "all";
type ShippingFeePayer = "SHOP" | "CUSTOMER";

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

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function statusClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (["DELIVERED", "COMPLETED", "FULFILLED", "PAID"].includes(s)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["DELIVERING", "SHIPPING", "PACKING", "APPROVED", "CONFIRMED"].includes(s)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (["FAILED", "CANCELLED", "CANCELED"].includes(s)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (["DRAFT", "PENDING", "NEW", "PENDING_COD", "PARTIAL"].includes(s)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function reconciliationStatusClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "CONFIRMED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "CANCELLED") return "border-red-200 bg-red-50 text-red-700";
  if (s === "DRAFT") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-500";
}

function orderStatusLabel(status: string) {
  const s = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    NEW: "Mới tạo",
    APPROVED: "Đã duyệt",
    PACKING: "Đang đóng hàng",
    SHIPPED: "Đang giao",
    COMPLETED: "Thành công",
    CANCELLED: "Đã huỷ",
    RETURNED: "Đã hoàn",
  };
  return labels[s] || status || "—";
}

function paymentStatusLabel(status: string) {
  const s = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    UNPAID: "Chưa thanh toán",
    PENDING_COD: "Chờ COD",
    PARTIAL: "Thanh toán một phần",
    PAID: "Đã thanh toán",
    REFUNDED: "Đã hoàn tiền",
    FAILED: "Lỗi thanh toán",
  };
  return labels[s] || status || "—";
}

function normalizeSourceText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function branchAliasTokens(branch: any, row?: any) {
  const rawValues = [
    branch?.id,
    branch?.code,
    branch?.name,
    branch?.shortName,
    branch?.slug,
    row?.branchId,
    row?.branchCode,
    row?.branchName,
  ];

  const tokens = new Set<string>();

  rawValues.forEach((value) => {
    const normalized = normalizeSourceText(value);
    if (!normalized) return;

    tokens.add(normalized);

    normalized
      .split(/[^a-z0-9]+/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => tokens.add(part));

    const words = normalized
      .split(/[^a-z0-9]+/g)
      .map((part) => part.trim())
      .filter(Boolean);

    if (words.length > 1) {
      tokens.add(words.map((word) => word[0]).join(""));
    }
  });

  [
    ["quoc oai", "qo"],
    ["quoc-oai", "qo"],
    ["thai ha", "th"],
    ["thai-ha", "th"],
    ["chua lang", "cl"],
    ["chua-lang", "cl"],
    ["xa dan", "xd"],
    ["xa-dan", "xd"],
  ].forEach(([name, code]) => {
    const joinedText = rawValues.map((value) => normalizeSourceText(value)).filter(Boolean).join(" ");
    if (joinedText.includes(name) || joinedText.includes(code)) {
      tokens.add(name.replace("-", " "));
      tokens.add(code);
    }
  });

  return Array.from(tokens).filter((token) => token.length >= 2);
}

function sourceMatchesOrderBranch(source: any, branch: any, row?: any) {
  if (!source) return false;

  const rowBranchId = String(row?.branchId || "").trim();
  const branchId = String(branch?.id || rowBranchId || "").trim();
  const sourceBranchId = String(source?.branchId || "").trim();

  // Nếu nguồn tiền đã gắn branchId thì bắt buộc phải đúng branchId của đơn.
  // Không cho admin/owner lấy nguồn tiền chi nhánh khác.
  if (sourceBranchId) {
    return Boolean(branchId) && sourceBranchId === branchId;
  }

  const sourceText = normalizeSourceText(
    [
      source?.name,
      source?.code,
      source?.description,
      source?.branchCode,
      source?.branchName,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const sourceParts = new Set(
    sourceText
      .split(/[^a-z0-9]+/g)
      .map((part) => part.trim())
      .filter(Boolean),
  );

  const branchName = normalizeSourceText(branch?.name || row?.branchName || "");
  const branchCode = normalizeSourceText(branch?.code || row?.branchCode || "");
  const branchShortName = normalizeSourceText(branch?.shortName || row?.branchShortName || "");
  const explicitTokens = [branchCode, branchShortName]
    .map((value) => value.trim())
    .filter(Boolean);

  // Match tên chi nhánh dạng đầy đủ: "tien mat thai ha" chứa "thai ha".
  if (branchName && sourceText.includes(branchName)) return true;

  // Match code chi nhánh bằng token rời, không dùng includes cho TH/CL/QO/XD
  // vì "th" có thể dính vào "other", "cl" có thể dính vào "local".
  if (explicitTokens.some((token) => sourceParts.has(token))) return true;

  const normalizedRowText = normalizeSourceText(
    [row?.branchName, row?.branchCode, row?.branchShortName].filter(Boolean).join(" "),
  );

  const branchAliases: Record<string, string[]> = {
    qo: ["qo", "quoc oai"],
    th: ["th", "thai ha"],
    cl: ["cl", "chua lang"],
    xd: ["xd", "xa dan"],
  };

  for (const [code, names] of Object.entries(branchAliases)) {
    const rowLooksLikeBranch = names.some((name) => normalizedRowText.includes(name));
    if (!rowLooksLikeBranch) continue;

    // Tên đầy đủ được phép includes, code 2 ký tự phải là token rời.
    if (names.some((name) => name.includes(" ") && sourceText.includes(name))) return true;
    if (sourceParts.has(code)) return true;
  }

  return false;
}

function paymentSourcesForOrderBranch(sources: any[], branches: any[], row?: any) {
  if (!row) return [];

  const branch =
    branches.find((item) => String(item?.id) === String(row?.branchId)) ||
    branches.find((item) => normalizeSourceText(item?.name) === normalizeSourceText(row?.branchName)) ||
    null;

  // Tuyệt đối không fallback sang tất cả nguồn tiền, kể cả admin/owner.
  // Popup thanh toán đối soát chỉ được dùng nguồn tiền thuộc chi nhánh tạo đơn.
  return sources.filter((source) => sourceMatchesOrderBranch(source, branch, row));
}

function isProblemRow(row: any) {
  const deliveryStatus = String(row.localStatus || "").toUpperCase();
  const orderStatus = String(row.orderStatus || "").toUpperCase();
  const reconciliationStatus = String(row.reconciliationStatus || "").toUpperCase();

  return (
    deliveryStatus === "FAILED" ||
    orderStatus === "CANCELLED" ||
    reconciliationStatus === "CANCELLED" ||
    Number(row.reconciliationCodAmount || 0) !== 0 &&
      Number(row.needCollectAmount || 0) !== 0 &&
      Number(row.reconciliationCodAmount || 0) !== Number(row.needCollectAmount || 0)
  );
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
  const [reconciliationStatus, setReconciliationStatus] = useState("ALL");
  const [orderStatus, setOrderStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [note, setNote] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncingAhamove, setSyncingAhamove] = useState(false);
  const [syncingViettelPost, setSyncingViettelPost] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [actionScope, setActionScope] = useState<ActionScope>("selected");
  const [payingRow, setPayingRow] = useState<any>(null);
  const [paymentRows, setPaymentRows] = useState<
    Array<{ paymentSourceId: string; amount: string }>
  >([{ paymentSourceId: "", amount: "" }]);
  const [shippingFeePayer, setShippingFeePayer] = useState<ShippingFeePayer>("SHOP");
  const [shippingFeeAmount, setShippingFeeAmount] = useState("");

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

    if (!isGlobalFinanceUser && currentBranchId) setBranchId(currentBranchId);

    const codLike = Array.isArray(sourceRows)
      ? sourceRows.find((s: any) =>
          String(s?.type || s?.code || "").toUpperCase().includes("COD"),
        )
      : null;
    const cashLike = Array.isArray(sourceRows)
      ? sourceRows.find(
          (s: any) =>
            String(s?.code || s?.name || "").toUpperCase().includes("TIEN") ||
            String(s?.code || "").toUpperCase().includes("CASH"),
        )
      : null;

    setPaymentSourceId(String(codLike?.id || cashLike?.id || sourceRows?.[0]?.id || ""));
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
        reconciliationStatus,
        orderStatus,
        paymentStatus,
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

  const syncAhamoveNow = async () => {
    if (!canViewLocalDelivery || syncingAhamove) return;

    setSyncingAhamove(true);
    try {
      const result = await apiJson<any>("/shipments/ahamove/tracking/cron/run-now", {
        method: "POST",
      });

      const checked = Number(result?.checked || 0);
      const delivered = Number(result?.delivered || 0);
      const statusChanged = Number(result?.statusChanged || 0);
      const failed = Number(result?.failed || 0);
      setBulkMessage(
        `Đã đồng bộ AhaMove: kiểm tra ${checked} vận đơn, ${statusChanged} đổi trạng thái, ${delivered} đã giao${failed ? `, ${failed} lỗi` : ""}.`,
      );
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Đồng bộ AhaMove thất bại.");
    } finally {
      setSyncingAhamove(false);
    }
  };

  const syncViettelPostNow = async () => {
    if (!canViewLocalDelivery || syncingViettelPost) return;

    setSyncingViettelPost(true);
    try {
      const result = await apiJson<any>("/shipments/viettelpost/tracking/cron/run-now", {
        method: "POST",
      });

      const checked = Number(result?.checked || 0);
      const delivered = Number(result?.delivered || 0);
      const statusChanged = Number(result?.statusChanged || 0);
      const failed = Number(result?.failed || 0);
      setBulkMessage(
        `Đã đồng bộ ViettelPost: kiểm tra ${checked} vận đơn, ${statusChanged} đổi trạng thái, ${delivered} đã giao${failed ? `, ${failed} lỗi` : ""}.`,
      );
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Đồng bộ ViettelPost thất bại.");
    } finally {
      setSyncingViettelPost(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, [currentBranchId, isGlobalFinanceUser]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 250);
    return () => clearTimeout(timer);
  }, [
    dateFrom,
    dateTo,
    branchId,
    carrier,
    status,
    reconciliationStatus,
    orderStatus,
    paymentStatus,
    q,
    canViewLocalDelivery,
    currentBranchId,
    isGlobalFinanceUser,
  ]);

  const rawRows = Array.isArray(data?.rows) ? data.rows : [];
  const visibleRows = rawRows.filter(
    (row: any) => !deletedIds.includes(getLocalRowKey(row)),
  );

  const rows = visibleRows;
  const selectedRows = rows.filter((row: any) =>
    selectedIds.includes(getLocalRowKey(row)),
  );
  const allRowsSelected =
    rows.length > 0 &&
    rows.every((row: any) => selectedIds.includes(getLocalRowKey(row)));

  const scopeRows = useMemo(() => {
    if (actionScope === "selected") return selectedRows;
    if (actionScope === "filtered") return rows;
    return visibleRows;
  }, [actionScope, rows, selectedRows, visibleRows]);

  const summary = data?.summary || {};
  const clientProblemCount = visibleRows.filter(isProblemRow).length;
  const payingPaymentSources = useMemo(
    () => paymentSourcesForOrderBranch(paymentSources, branches, payingRow),
    [paymentSources, branches, payingRow],
  );

  function openOrder(row: any) {
    if (!row?.orderId) return;

    const detail = {
      orderId: row.orderId,
      orderCode: row.orderCode,
      title: row.orderCode,
      href: `/orders/${row.orderId}`,
      type: "order",
    };

    window.dispatchEvent(new CustomEvent("admin:open-order", { detail }));
    window.dispatchEvent(new CustomEvent("open-order-detail", { detail }));
    window.dispatchEvent(new CustomEvent("admin-open-tab", { detail }));

    window.open(`/orders/${row.orderId}`, "_blank", "noopener,noreferrer");
  }

  const toggleRow = (row: any) => {
    const key = getLocalRowKey(row);
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key],
    );
  };

  const toggleAllRows = () => {
    const rowKeys = rows.map((row: any) => getLocalRowKey(row));
    setSelectedIds((prev) => {
      if (rowKeys.length > 0 && rowKeys.every((key) => prev.includes(key))) {
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

  const createReconciliation = async (targetRows: any[]) => {
    if (!canConfirmLocalDelivery) {
      alert("Bạn không có quyền tạo đối soát nội thành.");
      return;
    }

    const rowsToCreate = targetRows.filter((row) => !row.reconciliationId);
    if (!rowsToCreate.length) {
      alert("Các đơn đã chọn đều đã có phiếu đối soát.");
      return;
    }

    setActionId("__create_reconciliation__");
    try {
      const result = await apiJson<any>("/finance/local-delivery-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: rowsToCreate.map((row) => row.orderId).filter(Boolean),
          shipmentIds: rowsToCreate.map((row) => row.shipmentId).filter(Boolean),
          note: note || undefined,
          createdById: currentUser?.id,
          createdByName: currentUser?.name || currentUser?.fullName,
        }),
      });

      setBulkMessage(`Đã tạo ${result?.createdCount || rowsToCreate.length} phiếu đối soát nội thành.`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Tạo đối soát thất bại.");
    } finally {
      setActionId(null);
    }
  };

  const updateReconciliation = async (row: any) => {
    if (!row.reconciliationId) {
      await createReconciliation([row]);
      return;
    }

    const codText = prompt(
      "COD cần thu trên phiếu đối soát",
      String(row.reconciliationCodAmount || row.needCollectAmount || row.codAmount || 0),
    );
    if (codText === null) return;

    const feeText = prompt(
      "Phí ship nội thành",
      String(row.reconciliationShippingFee || row.shippingFee || 0),
    );
    if (feeText === null) return;

    const nextNote = prompt("Ghi chú đối soát", row.reconciliationNote || note || "");
    if (nextNote === null) return;

    setActionId(row.reconciliationId);
    try {
      await apiJson(
        `/finance/local-delivery-reconciliation/reconciliations/${row.reconciliationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codAmount: Number(codText || 0),
            shippingFee: Number(feeText || 0),
            note: nextNote || undefined,
          }),
        },
      );
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sửa đối soát thất bại.");
    } finally {
      setActionId(null);
    }
  };

  const confirmReconciliation = async (row: any) => {
    if (!row.reconciliationId) {
      alert("Cần tạo phiếu đối soát trước.");
      return;
    }

    setActionId(row.reconciliationId);
    try {
      await apiJson(
        `/finance/local-delivery-reconciliation/reconciliations/${row.reconciliationId}/confirm`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmedById: currentUser?.id,
            confirmedByName: currentUser?.name || currentUser?.fullName,
            note: note || undefined,
          }),
        },
      );
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xác nhận đối soát thất bại.");
    } finally {
      setActionId(null);
    }
  };

  const cancelReconciliation = async (row: any) => {
    if (!row.reconciliationId) {
      alert("Đơn này chưa có phiếu đối soát.");
      return;
    }

    if (!confirm(`Huỷ phiếu đối soát ${row.reconciliationCode || ""}?`)) return;

    setActionId(row.reconciliationId);
    try {
      await apiJson(
        `/finance/local-delivery-reconciliation/reconciliations/${row.reconciliationId}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cancelledById: currentUser?.id,
            cancelledByName: currentUser?.name || currentUser?.fullName,
            note: note || undefined,
          }),
        },
      );
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Huỷ đối soát thất bại.");
    } finally {
      setActionId(null);
    }
  };

  const openPaymentModal = (row: any) => {
    if (!row.reconciliationId) {
      alert("Cần tạo phiếu đối soát trước khi thanh toán.");
      return;
    }

    const amount = Number(row.reconciliationCodAmount || row.needCollectAmount || 0);
    const fee = Number(row.reconciliationShippingFee || row.shippingFee || 0);
    const branchSources = paymentSourcesForOrderBranch(paymentSources, branches, row);
    const defaultSourceId = branchSources.some((source) => String(source.id) === String(paymentSourceId))
      ? paymentSourceId
      : String(branchSources[0]?.id || "");

    if (!branchSources.length) {
      alert("Chi nhánh tạo đơn chưa có nguồn tiền phù hợp. Cần cấu hình nguồn tiền theo chi nhánh trước khi thanh toán đối soát.");
      return;
    }

    setPayingRow(row);
    setPaymentRows([{ paymentSourceId: defaultSourceId, amount: String(Math.max(0, amount)) }]);
    setShippingFeePayer("SHOP");
    setShippingFeeAmount(fee ? String(fee) : "");
  };

  const submitReconciliationPayment = async () => {
    if (!payingRow?.reconciliationId) return;

    const cleanRows = paymentRows
      .map((row) => ({
        paymentSourceId: row.paymentSourceId,
        amount: Number(row.amount || 0),
      }))
      .filter((row) => row.paymentSourceId && row.amount >= 0);

    if (!cleanRows.length) {
      alert("Chọn nguồn tiền thanh toán. Có thể nhập 0 nếu khách đã chuyển khoản trước.");
      return;
    }

    const total = cleanRows.reduce((sum, row) => sum + row.amount, 0);
    const target = Number(payingRow.reconciliationCodAmount || payingRow.needCollectAmount || 0);
    const shippingFeeValue = Number(String(shippingFeeAmount || "0").replace(/[^\d]/g, "") || 0);

    if (target > 0 && total > target) {
      alert("Tổng tiền hàng thu của khách không được lớn hơn COD cần thu.");
      return;
    }

    if (shippingFeePayer === "SHOP" && shippingFeeValue > 0 && !cleanRows[0]?.paymentSourceId) {
      alert("Chọn nguồn tiền để ghi phiếu chi phí ship.");
      return;
    }

    setActionId(payingRow.reconciliationId);
    try {
      await apiJson(
        `/finance/local-delivery-reconciliation/reconciliations/${payingRow.reconciliationId}/pay`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payments: cleanRows,
            shippingFeeSettlement: {
              payer: shippingFeePayer,
              amount: shippingFeeValue,
              paymentSourceId: cleanRows[0]?.paymentSourceId || undefined,
            },
            note: note || undefined,
            paidById: currentUser?.id,
            paidByName: currentUser?.name || currentUser?.fullName,
          }),
        },
      );
      setPayingRow(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Thanh toán đối soát thất bại.");
    } finally {
      setActionId(null);
    }
  };

  const bulkCreate = async () => {
    await createReconciliation(scopeRows);
  };

  const bulkConfirm = async () => {
    const candidates = scopeRows.filter((row) => row.reconciliationId);
    if (!candidates.length) {
      alert("Phạm vi đang chọn không có phiếu đối soát để xác nhận.");
      return;
    }

    if (!confirm(`Xác nhận ${candidates.length} phiếu đối soát nội thành?`)) return;

    setActionId("__bulk_reconciliation__");
    try {
      for (const row of candidates) {
        await apiJson(
          `/finance/local-delivery-reconciliation/reconciliations/${row.reconciliationId}/confirm`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              confirmedById: currentUser?.id,
              confirmedByName: currentUser?.name || currentUser?.fullName,
              note: note || undefined,
            }),
          },
        );
      }
      setBulkMessage(`Đã xác nhận ${candidates.length} phiếu đối soát.`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xác nhận đối soát thất bại.");
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
        <p className="text-sm text-neutral-500">Tài chính / Đối soát nội thành</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
          Đối soát vận chuyển nội thành
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Theo dõi COD, phí ship, trạng thái giao hàng, trạng thái đơn và tiến độ đối soát cho Ahamove / shipper nội thành.
        </p>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Khoảng thời gian</p>
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
                    quickRange === value ? "bg-black text-white" : "border border-neutral-200 bg-white"
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
              {isGlobalFinanceUser ? <option value="ALL">Tất cả chi nhánh</option> : null}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.id}</option>
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
              <option value="VIETTELPOST">ViettelPost</option>
              <option value="SHIPPER">Shipper nội bộ</option>
              <option value="GRAB">Grab</option>
            </select>
          </Field>

          <div className="flex items-end gap-2">
            <button
              onClick={() => void loadData()}
              className="h-11 rounded-xl bg-black px-5 text-sm font-medium text-white"
            >
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
            <button
              type="button"
              onClick={() => void syncAhamoveNow()}
              disabled={syncingAhamove}
              className="h-11 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Gọi AhaMove live để cập nhật nhanh các vận đơn nội thành đang giao"
            >
              {syncingAhamove ? "Đang sync Aha..." : "Đồng bộ AhaMove"}
            </button>
            <button
              type="button"
              onClick={() => void syncViettelPostNow()}
              disabled={syncingViettelPost}
              className="h-11 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Gọi ViettelPost live để cập nhật nhanh các vận đơn nội thành đang giao"
            >
              {syncingViettelPost ? "Đang sync Viettel..." : "Đồng bộ Viettel"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_220px_220px_220px_220px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã đơn, mã vận đơn, khách hàng, SĐT..."
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả trạng thái giao</option>
            <option value="PENDING">Chờ giao / chờ xử lý</option>
            <option value="DELIVERING">Đang giao</option>
            <option value="DELIVERED">Đã giao thành công</option>
            <option value="FAILED">Giao thất bại / đã huỷ</option>
          </select>

          <select
            value={reconciliationStatus}
            onChange={(e) => setReconciliationStatus(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả đối soát</option>
            <option value="NONE">Chưa tạo đối soát</option>
            <option value="DRAFT">Nháp đối soát</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="CANCELLED">Đã huỷ đối soát</option>
            <option value="PROBLEM">Có vấn đề</option>
          </select>

          <select
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả trạng thái đơn</option>
            <option value="NEW">Mới tạo</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PACKING">Đang đóng hàng</option>
            <option value="SHIPPED">Đang giao</option>
            <option value="COMPLETED">Đơn thành công</option>
            <option value="CANCELLED">Đơn đã huỷ</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PENDING_COD">Chờ COD</option>
            <option value="PARTIAL">Thanh toán một phần</option>
            <option value="PAID">Đã thanh toán</option>
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
          <select
            value={paymentSourceId}
            onChange={(e) => setPaymentSourceId(e.target.value)}
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
          >
            <option value="">Chọn nguồn nhận COD</option>
            {paymentSources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú đối soát nội thành..."
            className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Filter active={reconciliationStatus === "ALL"} onClick={() => setReconciliationStatus("ALL")}>Tất cả</Filter>
          <Filter active={reconciliationStatus === "NONE"} onClick={() => setReconciliationStatus("NONE")}>Chưa tạo ĐS</Filter>
          <Filter active={reconciliationStatus === "DRAFT"} onClick={() => setReconciliationStatus("DRAFT")}>Nháp</Filter>
          <Filter active={reconciliationStatus === "CONFIRMED"} onClick={() => setReconciliationStatus("CONFIRMED")}>Đã xác nhận</Filter>
          <Filter active={reconciliationStatus === "PAID"} onClick={() => setReconciliationStatus("PAID")}>Đã thanh toán</Filter>
          <Filter active={status === "DELIVERED"} onClick={() => setStatus(status === "DELIVERED" ? "ALL" : "DELIVERED")}>Đã giao</Filter>
          <Filter active={reconciliationStatus === "PROBLEM"} onClick={() => setReconciliationStatus("PROBLEM")}>Có vấn đề</Filter>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-8">
        <Stat title="Tổng đơn" value={summary.totalRows || 0} />
        <Stat title="Chưa tạo ĐS" value={summary.reconciliationNone || 0} />
        <Stat title="Nháp ĐS" value={summary.reconciliationDraft || 0} />
        <Stat title="Đã xác nhận" value={summary.reconciliationConfirmed || 0} />
        <Stat title="Đã thanh toán" value={summary.reconciliationPaid || 0} ok />
        <Stat title="Có vấn đề" value={summary.problemRows ?? clientProblemCount} danger />
        <Stat title="COD cần thu" value={currency(summary.totalNeedCollect || 0)} />
        <Stat title="Phí ship" value={currency(summary.totalFee || 0)} />
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Danh sách đối soát nội thành</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Click mã đơn để mở chi tiết. Bảng đã bổ sung thời gian, trạng thái đơn, trạng thái thanh toán và trạng thái đối soát.
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
            Đã chọn <b>{selectedRows.length}</b> đơn · Đang hiển thị <b>{rows.length}</b> đơn · Tổng còn <b>{visibleRows.length}</b> dòng
            {bulkMessage ? <span className="ml-3 font-medium text-emerald-700">{bulkMessage}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={actionScope}
              onChange={(e) => setActionScope(e.target.value as ActionScope)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium"
            >
              <option value="selected">Chỉ dòng đã tích</option>
              <option value="filtered">Tất cả dòng đang lọc</option>
              <option value="all">Toàn bộ phiên còn lại</option>
            </select>
            <button
              onClick={bulkCreate}
              disabled={!scopeRows.length || actionId === "__create_reconciliation__"}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Tạo đối soát
            </button>
            <button
              onClick={bulkConfirm}
              disabled={!scopeRows.length || actionId === "__bulk_reconciliation__"}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Xác nhận ĐS
            </button>
            <button
              onClick={() => hideRows(selectedIds)}
              disabled={!selectedIds.length}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Xóa dòng chọn
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full min-w-[1900px] text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="w-10 px-4 py-3 font-medium">
                  <input type="checkbox" checked={allRowsSelected} onChange={toggleAllRows} />
                </th>
                <th className="px-4 py-3 font-medium">Mã đơn</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 font-medium">Hãng / vận đơn</th>
                <th className="px-4 py-3 font-medium">Trạng thái đơn</th>
                <th className="px-4 py-3 font-medium">Trạng thái giao</th>
                <th className="px-4 py-3 font-medium">Đối soát</th>
                <th className="px-4 py-3 text-right font-medium">COD</th>
                <th className="px-4 py-3 text-right font-medium">Phí ship</th>
                <th className="px-4 py-3 text-right font-medium">Đã thu</th>
                <th className="px-4 py-3 text-right font-medium">Còn thu</th>
                <th className="px-4 py-3 font-medium">Địa chỉ / ghi chú</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const rowKey = getLocalRowKey(row);
                const problem = isProblemRow(row);
                return (
                  <tr key={rowKey} className={`border-t align-top ${problem ? "bg-red-50/40" : "bg-white"}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rowKey)}
                        onChange={() => toggleRow(row)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openOrder(row)}
                        className="font-semibold text-blue-700 underline-offset-4 hover:underline"
                      >
                        {row.orderCode}
                      </button>
                      <div className="mt-1 text-xs text-neutral-400">
                        ID: {String(row.orderId || "").slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">
                        Tạo đơn: {formatDateTime(row.orderCreatedAt || row.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Tạo vận đơn: {formatDateTime(row.shipmentCreatedAt || row.createdAt)}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        Cập nhật: {formatDateTime(row.updatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.customerName}</div>
                      <div className="text-xs text-neutral-500">{row.customerPhone}</div>
                      <div className="mt-1 text-xs text-neutral-400">{row.branchName || row.branchId || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.carrierName}</div>
                      <div className="mt-1 font-medium text-purple-700">{row.trackingCode}</div>
                      <div className="mt-1 text-xs text-neutral-400">{row.carrier || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.orderStatus)}`}>
                        {orderStatusLabel(row.orderStatus)}
                      </span>
                      <div className="mt-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.paymentStatus)}`}>
                          {paymentStatusLabel(row.paymentStatus)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.localStatus)}`}>
                        {row.localStatusLabel}
                      </span>
                      <div className="mt-1 text-xs text-neutral-400">
                        {row.shippingStatus || row.partnerStatus || row.ahamoveStatus || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.reconciliationId ? (
                        <div>
                          <div className="font-semibold text-neutral-900">{row.reconciliationCode}</div>
                          <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${reconciliationStatusClass(row.reconciliationStatus)}`}>
                            {row.reconciliationStatusLabel}
                          </span>
                          <div className="mt-1 text-xs text-neutral-500">
                            Tạo: {formatDateTime(row.reconciliationCreatedAt)}
                          </div>
                          {row.reconciliationConfirmedAt ? (
                            <div className="text-xs text-neutral-500">
                              Xác nhận: {formatDateTime(row.reconciliationConfirmedAt)}
                            </div>
                          ) : null}
                          {row.reconciliationPaidAt ? (
                            <div className="text-xs text-emerald-700">
                              TT: {formatDateTime(row.reconciliationPaidAt)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-500">
                          Chưa tạo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{currency(row.codAmount)}</td>
                    <td className="px-4 py-3 text-right">{currency(row.shippingFee)}</td>
                    <td className="px-4 py-3 text-right">{currency(row.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{currency(row.needCollectAmount)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-neutral-600">
                      <div className="line-clamp-2">{row.address}</div>
                      {row.note ? <div className="mt-1 text-xs text-neutral-400">{row.note}</div> : null}
                      {problem ? <div className="mt-2 text-xs font-semibold text-red-600">Cần kiểm tra</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          disabled={Boolean(row.reconciliationId)}
                          onClick={() => createReconciliation([row])}
                          className="rounded-xl bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Tạo ĐS
                        </button>
                        <button
                          disabled={!row.reconciliationId || row.reconciliationStatus === "PAID" || row.reconciliationStatus === "CANCELLED"}
                          onClick={() => updateReconciliation(row)}
                          className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium disabled:opacity-40"
                        >
                          Sửa
                        </button>
                        <button
                          disabled={!row.reconciliationId || row.reconciliationStatus === "PAID" || row.reconciliationStatus === "CANCELLED"}
                          onClick={() => confirmReconciliation(row)}
                          className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium disabled:opacity-40"
                        >
                          Xác nhận
                        </button>
                        <button
                          disabled={!row.reconciliationId || row.reconciliationStatus === "PAID" || row.reconciliationStatus === "CANCELLED"}
                          onClick={() => openPaymentModal(row)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Thanh toán
                        </button>
                        <button
                          disabled={!row.reconciliationId || row.reconciliationStatus === "PAID" || row.reconciliationStatus === "CANCELLED"}
                          onClick={() => cancelReconciliation(row)}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-40"
                        >
                          Huỷ
                        </button>
                        <button
                          onClick={() => hideRows([rowKey])}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
                        >
                          Ẩn
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!rows.length ? (
          <p className="mt-5 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
            Chưa có đơn vận chuyển nội thành trong bộ lọc hiện tại.
          </p>
        ) : null}

        {payingRow ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Thanh toán đối soát nội thành
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-neutral-950">
                    {payingRow.reconciliationCode} · {payingRow.orderCode}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    COD cần thu: <b className="text-neutral-950">{currency(payingRow.reconciliationCodAmount || payingRow.needCollectAmount || 0)}</b>
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Phí ship cần chi: <b className="text-neutral-950">{currency(Number(shippingFeeAmount || payingRow.reconciliationShippingFee || payingRow.shippingFee || 0))}</b>
                  </p>
                </div>
                <button
                  onClick={() => setPayingRow(null)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  Đóng
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Tiền ship</label>
                    <input
                      value={shippingFeeAmount}
                      onChange={(e) => setShippingFeeAmount(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="Phí ship"
                      className="mt-2 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Người trả phí ship</label>
                    <select
                      value={shippingFeePayer}
                      onChange={(e) => setShippingFeePayer(e.target.value as ShippingFeePayer)}
                      className="mt-2 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-950"
                    >
                      <option value="SHOP">Shop trả · tự tạo phiếu chi</option>
                      <option value="CUSTOMER">Khách trả · không tạo phiếu chi</option>
                    </select>
                    <p className="mt-2 text-xs text-neutral-500">
                      {shippingFeePayer === "SHOP"
                        ? "Khi xác nhận: tiền COD vào phiếu thu, phí ship vào phiếu chi cùng nguồn tiền."
                        : "Khi xác nhận: chỉ ghi phiếu thu COD, không sinh phiếu chi phí ship."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {payingPaymentSources.length ? (
                  <p className="text-xs text-neutral-500">
                    Chỉ hiển thị nguồn tiền thuộc chi nhánh tạo đơn: <b>{payingRow.branchName || payingRow.branchId || "—"}</b>.
                  </p>
                ) : (
                  <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                    Chưa tìm thấy nguồn tiền theo chi nhánh tạo đơn. Kiểm tra tên/code nguồn tiền hoặc branchId của nguồn tiền.
                  </p>
                )}
                {paymentRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <select
                      value={row.paymentSourceId}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, paymentSourceId: e.target.value } : item,
                          ),
                        )
                      }
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
                    >
                      <option value="">Chọn nguồn tiền</option>
                      {payingPaymentSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {[source.name, source.code].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </select>
                    <input
                      value={row.amount}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, amount: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Số tiền, có thể nhập 0"
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm"
                    />
                    <button
                      onClick={() =>
                        setPaymentRows((prev) =>
                          prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
                        )
                      }
                      className="h-11 rounded-xl border border-red-200 px-3 text-sm text-red-600"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setPaymentRows((prev) =>
                      prev.length >= 3 ? prev : [...prev, { paymentSourceId: "", amount: "" }],
                    )
                  }
                  disabled={paymentRows.length >= 3}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  + Thêm nguồn tiền
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPayingRow(null)}
                    className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={() => submitReconciliationPayment()}
                    disabled={actionId === payingRow.reconciliationId}
                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Xác nhận thanh toán
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function getLocalRowKey(row: any) {
  return String(row?.shipmentId || row?.orderId || row?.trackingCode || row?.orderCode || "");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-neutral-500">{label}</p>
      {children}
    </div>
  );
}

function Filter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-medium ${
        active ? "bg-black text-white" : "border border-neutral-200 bg-white text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({
  title,
  value,
  ok,
  danger,
}: {
  title: string;
  value: any;
  ok?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          danger ? "text-red-600" : ok ? "text-emerald-600" : "text-neutral-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
