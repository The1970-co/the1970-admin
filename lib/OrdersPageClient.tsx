"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AdminOrder, OrderPaymentStatus, OrderStatus } from "@/lib/orders-api";
import { deleteOrder, updateOrderPaymentStatus, updateOrderStatus } from "@/lib/orders-api";
import { BRANCH_LABELS } from "@/lib/authz";
import {
  findPrintTemplate,
  loadPrintTemplates,
  type PrintPaperSize,
} from "@/lib/print-template-config";
import {
  openPrintDocument,
  renderOrderTemplateHtml,
} from "@/lib/print-template-engine";

type QuickDateKey = "all" | "today" | "yesterday" | "7d" | "30d" | "month";

type ColumnKey =
  | "orderCode"
  | "createdAt"
  | "customerName"
  | "customerPhone"
  | "orderStatus"
  | "paymentStatus"
  | "fulfillmentStatus"
  | "branch"
  | "createdBy"
  | "salesChannel"
  | "shippingMode"
  | "shippingPartner"
  | "trackingCode"
  | "itemCount"
  | "shippingAddress"
  | "note"
  | "shippingFee"
  | "codAmount"
  | "amountDue"
  | "finalAmount";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  money?: boolean;
  defaultVisible: boolean;
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "orderCode", label: "Mã đơn", defaultVisible: true },
  { key: "createdAt", label: "Ngày tạo", defaultVisible: true },
  { key: "customerName", label: "Khách hàng", defaultVisible: true },
  { key: "customerPhone", label: "SĐT", defaultVisible: true },
  { key: "orderStatus", label: "Trạng thái đơn", defaultVisible: true },
  { key: "paymentStatus", label: "Thanh toán", defaultVisible: true },
  { key: "fulfillmentStatus", label: "Giao vận", defaultVisible: true },
  { key: "branch", label: "Chi nhánh", defaultVisible: true },
  { key: "createdBy", label: "Nhân viên tạo đơn", defaultVisible: true },
  { key: "salesChannel", label: "Kênh bán", defaultVisible: true },
  { key: "shippingMode", label: "Cách giao", defaultVisible: true },
  { key: "shippingPartner", label: "Đơn vị VC", defaultVisible: true },
  { key: "trackingCode", label: "Mã vận đơn", defaultVisible: true },
  { key: "itemCount", label: "Số món", defaultVisible: true },
  { key: "shippingAddress", label: "Địa chỉ giao", defaultVisible: true },
  { key: "note", label: "Ghi chú", defaultVisible: true },
  { key: "shippingFee", label: "Phí ship", money: true, defaultVisible: true },
  { key: "codAmount", label: "Thu hộ COD", money: true, defaultVisible: true },
  { key: "amountDue", label: "Khách còn phải trả", money: true, defaultVisible: true },
  { key: "finalAmount", label: "Tổng tiền", money: true, defaultVisible: true },
];

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
    <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger";
}) {
  const tones =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900"
      : variant === "success"
        ? "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-600"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500 border-red-600"
          : "bg-white text-neutral-900 hover:bg-neutral-50 border-neutral-300";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium transition ${tones} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {children}
    </button>
  );
}

function SmallChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function orderStatusLabel(status?: string) {
  switch (status) {
    case "NEW":
      return "Mới tạo";
    case "APPROVED":
      return "Đã duyệt";
    case "PACKING":
      return "Đang xử lý";
    case "SHIPPED":
      return "Đã xuất kho";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status || "—";
  }
}

function paymentStatusLabel(status?: string) {
  switch (status) {
    case "UNPAID":
      return "Chưa thanh toán";
    case "PARTIAL":
      return "Thanh toán một phần";
    case "PAID":
      return "Đã thanh toán";
    case "PENDING_COD":
      return "Chờ thu COD";
    case "REFUNDED":
      return "Đã hoàn tiền";
    case "FAILED":
      return "Thanh toán lỗi";
    default:
      return status || "—";
  }
}

function fulfillmentStatusLabel(status?: string | null) {
  switch (status) {
    case "UNFULFILLED":
      return "Chưa giao";
    case "PROCESSING":
      return "Đang chuẩn bị";
    case "PARTIAL":
      return "Một phần";
    case "FULFILLED":
      return "Đã giao vận";
    case "RETURNED":
      return "Trả hàng";
    default:
      return status || "—";
  }
}


function shippingStatusLabel(status?: string | null) {
  const value = String(status || "").trim();
  const upper = value.toUpperCase();

  switch (upper) {
    case "READY_TO_PICK":
    case "READY_TO_PICKING":
    case "WAITING_PICK":
    case "WAITING_TO_PICK":
    case "PICKING":
    case "PICK":
    case "PICKED":
      return "Chờ lấy hàng";
    case "STORING":
    case "TRANSPORTING":
    case "SORTING":
    case "DELIVERING":
    case "DELIVERY":
      return "Đang giao hàng";
    case "DELIVERED":
    case "DELIVERY_SUCCESS":
    case "COMPLETED":
      return "Giao thành công";
    case "WAITING_TO_RETURN":
    case "RETURN":
    case "RETURNING":
      return "Đang hoàn hàng";
    case "RETURNED":
    case "RETURNED_TO_CLIENT":
      return "Đã hoàn hàng";
    case "CANCEL":
    case "CANCELLED":
      return "Đã huỷ vận đơn";
    case "EXCEPTION":
    case "LOST":
    case "DAMAGE":
      return "Có sự cố";
    default:
      return value || "—";
  }
}

function deliveryDisplayStatus(order: AdminOrder) {
  const shipmentStatus = order.shipment?.shippingStatus;
  if (shipmentStatus) return shipmentStatus;

  // Có mã vận đơn GHN rồi nhưng backend chưa lưu shippingStatus:
  // coi như đang chờ lấy hàng thay vì fallback "Đang chuẩn bị".
  if (order.shipment?.trackingCode) return "READY_TO_PICK";

  return order.fulfillmentStatus || null;
}

function orderStatusTone(status?: string) {
  switch (status) {
    case "NEW":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "APPROVED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "PACKING":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "SHIPPED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function paymentStatusTone(status?: string) {
  switch (status) {
    case "UNPAID":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "PARTIAL":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PENDING_COD":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "REFUNDED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    case "FAILED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function fulfillmentStatusTone(status?: string | null) {
  switch (status) {
    case "UNFULFILLED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    case "PROCESSING":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "PARTIAL":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "FULFILLED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "RETURNED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}


function shippingStatusTone(status?: string | null) {
  const upper = String(status || "").trim().toUpperCase();

  switch (upper) {
    case "READY_TO_PICK":
    case "READY_TO_PICKING":
    case "WAITING_PICK":
    case "WAITING_TO_PICK":
    case "PICKING":
    case "PICK":
    case "PICKED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "STORING":
    case "TRANSPORTING":
    case "SORTING":
    case "DELIVERING":
    case "DELIVERY":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "DELIVERED":
    case "DELIVERY_SUCCESS":
    case "COMPLETED":
    case "FULFILLED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "WAITING_TO_RETURN":
    case "RETURN":
    case "RETURNING":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "RETURNED":
    case "RETURNED_TO_CLIENT":
    case "CANCEL":
    case "CANCELLED":
    case "EXCEPTION":
    case "LOST":
    case "DAMAGE":
      return "bg-red-50 text-red-700 border-red-200";
    case "PROCESSING":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "UNFULFILLED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function branchLabel(branchId?: string | null) {
  if (!branchId) return "All";
  return BRANCH_LABELS[branchId as keyof typeof BRANCH_LABELS] || branchId;
}

type CurrentUserLite = {
  role?: string;
  branchId?: string | null;
};

function getCurrentUserLite(): CurrentUserLite | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseStructuredNote(note?: string) {
  if (!note) {
    return {
      noteText: "",
      address: "",
      tags: "",
      shippingMode: "",
      shippingPartner: "",
      shippingNote: "",
    };
  }

  const parts = note
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  const getValue = (prefix: string) => {
    const found = parts.find((p) => p.startsWith(prefix));
    return found ? found.replace(prefix, "").trim() : "";
  };

  return {
    noteText: getValue("Ghi chú:"),
    address: getValue("Địa chỉ:"),
    tags: getValue("Tags:"),
    shippingMode: getValue("Cách giao:"),
    shippingPartner: getValue("Đơn vị giao:"),
    shippingNote: getValue("Ghi chú giao hàng:"),
  };
}

function shortText(text?: string, max = 28) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function parseOrderDate(value?: string) {
  if (!value) return null;
  const normalized = value.replace(",", "").trim();

  const match1 = normalized.match(
    /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );
  if (match1) {
    const [, hh, mm, ss = "0", d, m, y] = match1;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
  }

  const match2 = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (match2) {
    const [, d, m, y, hh, mm, ss = "0"] = match2;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeDateStart(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeDateEnd(dateStr: string) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function amountCustomerStillOwes(order: AdminOrder) {
  if (order.status === "CANCELLED") return 0;
  if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") return 0;

  const codAmount = Number(order.shipment?.codAmount || 0);
  if (order.paymentStatus === "PENDING_COD" && codAmount > 0) {
    return codAmount;
  }

  return Number(order.finalAmount || 0);
}

function getCreatedByName(order: any) {
  return (
    order?.createdByName ||
    order?.createdBy?.name ||
    order?.createdBy?.fullName ||
    order?.staffUser?.name ||
    order?.staffUser?.fullName ||
    "—"
  );
}

function getQuickDateRange(key: QuickDateKey) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (key === "today") {
    return { from: todayStart, to: todayEnd };
  }

  if (key === "yesterday") {
    const yStart = new Date(todayStart);
    yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(todayEnd);
    yEnd.setDate(yEnd.getDate() - 1);
    return { from: yStart, to: yEnd };
  }

  if (key === "7d") {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 6);
    return { from, to: todayEnd };
  }

  if (key === "30d") {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 29);
    return { from, to: todayEnd };
  }

  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = todayEnd;
    return { from, to };
  }

  return { from: null, to: null };
}

function toInputDateValue(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultVisibleColumns(canSeeMoney: boolean) {
  return COLUMN_DEFS.filter((col) => {
    if (col.money && !canSeeMoney) return false;
    return col.defaultVisible;
  }).map((col) => col.key);
}

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [query, setQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | OrderPaymentStatus>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickDate, setQuickDate] = useState<QuickDateKey>("all");

  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [savingOrderStatus, setSavingOrderStatus] = useState(false);
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserLite | null>(null);

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);

  const canSeeMoney =
    currentUser?.role === "admin" || currentUser?.role === "owner";

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([]);

  useEffect(() => {
    const user = getCurrentUserLite();
    setCurrentUser(user);

    if (user?.role !== "admin" && user?.role !== "owner" && user?.branchId) {
      setBranchFilter(user.branchId);
    }
  }, []);

  useEffect(() => {
    const storageKey = canSeeMoney
      ? "orders.visibleColumns.admin"
      : "orders.visibleColumns.staff";

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setVisibleColumns(defaultVisibleColumns(canSeeMoney));
        return;
      }

      const parsed = JSON.parse(raw) as ColumnKey[];
      const allowed = COLUMN_DEFS.filter((col) => (canSeeMoney ? true : !col.money)).map((c) => c.key);
      const cleaned = parsed.filter((key) => allowed.includes(key));
      setVisibleColumns(cleaned.length ? cleaned : defaultVisibleColumns(canSeeMoney));
    } catch {
      setVisibleColumns(defaultVisibleColumns(canSeeMoney));
    }
  }, [canSeeMoney]);

  useEffect(() => {
    const storageKey = canSeeMoney
      ? "orders.visibleColumns.admin"
      : "orders.visibleColumns.staff";
    if (!visibleColumns.length) return;
    localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns, canSeeMoney]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(e.target as Node)
      ) {
        setShowColumnMenu(false);
      }
      if (
        printMenuRef.current &&
        !printMenuRef.current.contains(e.target as Node)
      ) {
        setShowPrintMenu(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!token) {
        setError("Không tìm thấy token trong localStorage.");
        setOrders([]);
        return;
      }

      const res = await fetch(`${API_BASE}/orders`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const raw = await res.json();

      if (!res.ok) {
        throw new Error(raw?.message || `Tải /orders thất bại. Status ${res.status}`);
      }

      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

      setOrders(data as AdminOrder[]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không tải được đơn hàng.";
      setError(message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (o.branchId) map.set(o.branchId, branchLabel(o.branchId));
    });

    return [
      { value: "ALL", label: "Tất cả chi nhánh" },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromDate = dateFrom ? normalizeDateStart(dateFrom) : null;
    const toDate = dateTo ? normalizeDateEnd(dateTo) : null;

    return orders.filter((order) => {
      const meta = parseStructuredNote(order.note);
      const createdAt = parseOrderDate(order.createdAt);

      const matchQuery =
        !q ||
        (order.orderCode || "").toLowerCase().includes(q) ||
        (order.customerName || "").toLowerCase().includes(q) ||
        (order.customerPhone || "").toLowerCase().includes(q) ||
        (order.salesChannel || "").toLowerCase().includes(q) ||
        (order.shipment?.trackingCode || "").toLowerCase().includes(q) ||
        (meta.address || "").toLowerCase().includes(q) ||
        getCreatedByName(order).toLowerCase().includes(q);

      const matchOrder =
        orderFilter === "ALL" || order.status === orderFilter;

      const matchPayment =
        paymentFilter === "ALL" || order.paymentStatus === paymentFilter;

      const matchBranch =
        branchFilter === "ALL" || order.branchId === branchFilter;

      const matchFrom =
        !fromDate || (createdAt ? createdAt >= fromDate : true);

      const matchTo =
        !toDate || (createdAt ? createdAt <= toDate : true);

      return matchQuery && matchOrder && matchPayment && matchBranch && matchFrom && matchTo;
    });
  }, [orders, query, orderFilter, paymentFilter, branchFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setCheckedIds([]);
      return;
    }

    setCheckedIds((prev) => prev.filter((id) => filteredOrders.some((o) => o.id === id)));
  }, [filteredOrders]);

  const counts = useMemo(() => {
    return {
      waitingApprove: orders.filter((o) => o.status === "NEW").length,
      waitingPayment: orders.filter((o) =>
        ["UNPAID", "PARTIAL", "PENDING_COD"].includes(o.paymentStatus)
      ).length,
      waitingPacking: orders.filter((o) => o.status === "PACKING").length,
      waitingShip: orders.filter((o) =>
        ["APPROVED", "PACKING"].includes(o.status)
      ).length,
      delivering: orders.filter((o) => o.status === "SHIPPED").length,
    };
  }, [orders]);

  const allVisibleIds = filteredOrders.map((o) => o.id);
  const allChecked =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => checkedIds.includes(id));

  const checkedOrders = orders.filter((o) => checkedIds.includes(o.id));

  const toggleCheckOne = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCheckAllVisible = () => {
    if (allChecked) {
      setCheckedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
      return;
    }

    setCheckedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
  };

  const updateOneStatus = async (id: string, status: OrderStatus) => {
    const updated = await updateOrderStatus(id, status);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const updateOnePaymentStatus = async (id: string, paymentStatus: OrderPaymentStatus) => {
    const updated = await updateOrderPaymentStatus(id, paymentStatus);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleBulkApprove = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingOrderStatus(true);
      setActionMessage("");

      let count = 0;
      for (const id of checkedIds) {
        const order = orders.find((o) => o.id === id);
        if (order?.status === "NEW") {
          await updateOneStatus(id, "APPROVED");
          count += 1;
        }
      }

      setActionMessage(`Đã duyệt ${count} đơn.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi duyệt đơn hàng loạt."
      );
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingPaymentStatus(true);
      setActionMessage("");

      let count = 0;
      for (const id of checkedIds) {
        const order = orders.find((o) => o.id === id);
        if (
          order &&
          order.paymentStatus !== "PAID" &&
          order.paymentStatus !== "REFUNDED" &&
          order.status !== "CANCELLED"
        ) {
          await updateOnePaymentStatus(id, "PAID");
          count += 1;
        }
      }

      setActionMessage(`Đã cập nhật thanh toán cho ${count} đơn.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi cập nhật thanh toán hàng loạt."
      );
    } finally {
      setSavingPaymentStatus(false);
    }
  };

  const sendOneOrderToCarrier = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const res = await fetch(`${API_BASE}/orders/${id}/send-ghn`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || "Gửi GHN thất bại.");
    }

    return json;
  };

  const handleBulkSendToCarrier = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingOrderStatus(true);
      setActionMessage("");

      let successCount = 0;
      const failed: string[] = [];

      for (const id of checkedIds) {
        const order = orders.find((o) => o.id === id);
        if (!order) continue;

        try {
          await sendOneOrderToCarrier(id);
          successCount += 1;
        } catch {
          failed.push(order.orderCode || id);
        }
      }

      await loadOrders();

      if (failed.length === 0) {
        setActionMessage(`Đã gửi GHN thành công ${successCount} đơn.`);
      } else {
        setActionMessage(
          `Đã gửi GHN ${successCount} đơn. Thất bại: ${failed.join(", ")}`
        );
      }
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi gửi sang HVC."
      );
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const handleBulkCancel = async () => {
    if (!checkedIds.length) return;

    const ok = window.confirm(`Xác nhận hủy ${checkedIds.length} đơn đã chọn?`);
    if (!ok) return;

    try {
      setSavingOrderStatus(true);
      setActionMessage("");

      let count = 0;
      for (const id of checkedIds) {
        const order = orders.find((o) => o.id === id);
        if (order && order.status !== "CANCELLED" && order.status !== "COMPLETED") {
          await updateOneStatus(id, "CANCELLED");
          count += 1;
        }
      }

      setActionMessage(`Đã hủy ${count} đơn.`);
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi hủy đơn hàng loạt."
      );
    } finally {
      setSavingOrderStatus(false);
    }
  };


  const handleBulkDelete = async () => {
    if (!checkedIds.length || deletingOrders) return;

    const selectedOrders = orders.filter((o) => checkedIds.includes(o.id));
    const deletableOrders = selectedOrders.filter((o) => o.status === "CANCELLED");

    if (!deletableOrders.length) {
      setActionMessage("Chỉ xoá được các đơn đã huỷ.");
      setShowDeleteConfirm(false);
      return;
    }

    try {
      setDeletingOrders(true);
      setActionMessage("");

      let successCount = 0;
      const failed: string[] = [];

      for (const order of deletableOrders) {
        try {
          await deleteOrder(order.id);
          successCount += 1;
        } catch (err) {
          failed.push(
            `${order.orderCode || order.id}: ${
              err instanceof Error ? err.message : "Không xoá được"
            }`
          );
        }
      }

      setOrders((prev) =>
        prev.filter((order) => !deletableOrders.some((deleted) => deleted.id === order.id))
      );
      setCheckedIds((prev) =>
        prev.filter((id) => !deletableOrders.some((deleted) => deleted.id === id))
      );

      if (failed.length) {
        setActionMessage(
          `Đã xoá ${successCount} đơn. Lỗi: ${failed.join(" | ")}`
        );
      } else {
        setActionMessage(`Đã xoá ${successCount} đơn.`);
      }

      setShowDeleteConfirm(false);
      await loadOrders();
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi xoá đơn hàng loạt."
      );
    } finally {
      setDeletingOrders(false);
    }
  };

  const handlePrint = (type: "shipping" | "sales", paper: PrintPaperSize) => {
    if (!checkedOrders.length) return;

    const templates = loadPrintTemplates();

    const html = checkedOrders
      .map((order) => {
        const template = findPrintTemplate({
          templates,
          branchId: order.branchId,
          templateType: type,
          paperSize: paper,
        });

        if (!template) return "";

        return `<div class="print-page">${renderOrderTemplateHtml({
          order,
          template,
        })}</div>`;
      })
      .join("");

    openPrintDocument({
      title: "In đơn",
      paperSize: paper,
      bodyHtml: html,
    });
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== key);
      }
      return [...prev, key];
    });
  };

  const resetColumns = () => {
    setVisibleColumns(defaultVisibleColumns(canSeeMoney));
  };

  const isColumnVisible = (key: ColumnKey) => visibleColumns.includes(key);

  const applyQuickDate = (key: QuickDateKey) => {
    setQuickDate(key);
    const range = getQuickDateRange(key);
    setDateFrom(toInputDateValue(range.from));
    setDateTo(toInputDateValue(range.to));
  };

  const paidRevenue = filteredOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);

  if (loading) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-neutral-500">Đang tải đơn hàng...</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <p className="text-xs text-neutral-500">Chờ duyệt</p>
            <p className="mt-1 text-2xl font-semibold">{counts.waitingApprove}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Chờ thanh toán</p>
            <p className="mt-1 text-2xl font-semibold">{counts.waitingPayment}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Chờ đóng gói</p>
            <p className="mt-1 text-2xl font-semibold">{counts.waitingPacking}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Chờ gửi hãng</p>
            <p className="mt-1 text-2xl font-semibold">{counts.waitingShip}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Đang giao hàng</p>
            <p className="mt-1 text-2xl font-semibold">{counts.delivering}</p>
          </div>
        </div>
      </Panel>

      <Panel className="p-3">
        <div className="flex flex-wrap gap-2">
          <SmallChip active={quickDate === "all"} onClick={() => applyQuickDate("all")}>
            Tất cả
          </SmallChip>
          <SmallChip active={quickDate === "today"} onClick={() => applyQuickDate("today")}>
            Hôm nay
          </SmallChip>
          <SmallChip active={quickDate === "yesterday"} onClick={() => applyQuickDate("yesterday")}>
            Hôm qua
          </SmallChip>
          <SmallChip active={quickDate === "7d"} onClick={() => applyQuickDate("7d")}>
            7 ngày
          </SmallChip>
          <SmallChip active={quickDate === "30d"} onClick={() => applyQuickDate("30d")}>
            30 ngày
          </SmallChip>
          <SmallChip active={quickDate === "month"} onClick={() => applyQuickDate("month")}>
            Tháng này
          </SmallChip>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[1.8fr_1fr_1fr_1fr_auto_auto]">
          <input
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
            placeholder="Tìm mã đơn, vận đơn, tên, SĐT..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={
              !!currentUser?.branchId &&
              currentUser?.role !== "admin" &&
              currentUser?.role !== "owner"
            }
          >
            {branchOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value as "ALL" | OrderStatus)}
          >
            <option value="ALL">Tất cả trạng thái đơn</option>
            <option value="NEW">Mới tạo</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PACKING">Đang xử lý</option>
            <option value="SHIPPED">Đã xuất kho</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as "ALL" | OrderPaymentStatus)
            }
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PARTIAL">Thanh toán một phần</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="PENDING_COD">Chờ thu COD</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
            <option value="FAILED">Thanh toán lỗi</option>
          </select>

          <Button onClick={() => void loadOrders()}>Làm mới</Button>

          <div className="relative" ref={columnMenuRef}>
            <Button onClick={() => setShowColumnMenu((v) => !v)}>Cột hiển thị</Button>

            {showColumnMenu ? (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Chọn cột</p>
                  <button
                    onClick={resetColumns}
                    className="text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    Mặc định
                  </button>
                </div>

                <div className="grid max-h-80 gap-2 overflow-auto">
                  {COLUMN_DEFS.filter((col) => (canSeeMoney ? true : !col.money)).map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isColumnVisible(col.key)}
                        onChange={() => toggleColumn(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Từ ngày
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setQuickDate("all");
                setDateFrom(e.target.value);
              }}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Đến ngày
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setQuickDate("all");
                setDateTo(e.target.value);
              }}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => {
                setQuickDate("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Xóa lọc ngày
            </Button>
          </div>
        </div>
      </Panel>

      {checkedIds.length > 0 ? (
        <Panel className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-500">
              Đã chọn {checkedIds.length} đơn
            </span>

            <Button
              variant="primary"
              onClick={() => void handleBulkApprove()}
              disabled={savingOrderStatus}
            >
              Duyệt đơn hàng
            </Button>

            <Button
              variant="success"
              onClick={() => void handleBulkMarkPaid()}
              disabled={savingPaymentStatus}
            >
              Thanh toán nhanh
            </Button>

            <Button
              variant="secondary"
              onClick={() => void handleBulkSendToCarrier()}
              disabled={savingOrderStatus}
            >
              Gửi sang HVC
            </Button>

            <div className="relative" ref={printMenuRef}>
              <Button onClick={() => setShowPrintMenu((v) => !v)}>In</Button>

              {showPrintMenu ? (
                <div className="absolute left-0 z-30 mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                  <button
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("shipping", "80mm");
                    }}
                  >
                    Phiếu giao hàng 80mm
                  </button>

                  <button
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("shipping", "A4");
                    }}
                  >
                    Phiếu giao hàng A4
                  </button>

                  <button
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("shipping", "A5");
                    }}
                  >
                    Phiếu giao hàng A5
                  </button>

                  <button
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("sales", "80mm");
                    }}
                  >
                    Phiếu bán hàng 80mm
                  </button>
                </div>
              ) : null}
            </div>

            <Button
              variant="danger"
              onClick={() => void handleBulkCancel()}
              disabled={savingOrderStatus || deletingOrders}
            >
              Hủy đơn
            </Button>

            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deletingOrders}
            >
              Xoá đơn
            </Button>
          </div>
        </Panel>
      ) : null}

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <p className="text-xs font-medium text-red-500">⚠️ Hành động nguy hiểm</p>
            <h3 className="mt-3 text-base font-semibold text-neutral-900">
              Xoá đơn hàng
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Bạn đang xoá {checkedIds.length} đơn đã chọn. Chỉ đơn đã huỷ mới có thể xoá.
              Hành động này không thể hoàn tác.
            </p>

            {deletingOrders ? (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                Đang xoá đơn, vui lòng không tắt trang...
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingOrders}
              >
                Đóng
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleBulkDelete()}
                disabled={deletingOrders}
              >
                {deletingOrders ? "Đang xoá..." : "Xoá đơn"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {actionMessage ? (
        <Panel className="p-3">
          <p className="text-xs text-neutral-700">{actionMessage}</p>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[2300px] w-full border-collapse">
            <thead className="bg-neutral-50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="border-b border-neutral-200 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleCheckAllVisible}
                  />
                </th>

                {isColumnVisible("orderCode") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Mã đơn</th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Ngày tạo</th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Khách hàng</th>
                ) : null}
                {isColumnVisible("customerPhone") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">SĐT</th>
                ) : null}
                {isColumnVisible("orderStatus") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Trạng thái đơn</th>
                ) : null}
                {isColumnVisible("paymentStatus") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Thanh toán</th>
                ) : null}
                {isColumnVisible("fulfillmentStatus") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Giao vận</th>
                ) : null}
                {isColumnVisible("branch") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Chi nhánh</th>
                ) : null}
                {isColumnVisible("createdBy") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Nhân viên tạo đơn</th>
                ) : null}
                {isColumnVisible("salesChannel") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Kênh bán</th>
                ) : null}
                {isColumnVisible("shippingMode") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Cách giao</th>
                ) : null}
                {isColumnVisible("shippingPartner") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Đơn vị VC</th>
                ) : null}
                {isColumnVisible("trackingCode") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Mã vận đơn</th>
                ) : null}
                {isColumnVisible("itemCount") ? (
                  <th className="border-b border-neutral-200 px-3 py-3 text-center">Số món</th>
                ) : null}
                {isColumnVisible("shippingAddress") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Địa chỉ giao</th>
                ) : null}
                {isColumnVisible("note") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">Ghi chú</th>
                ) : null}
                {canSeeMoney && isColumnVisible("shippingFee") ? (
                  <th className="border-b border-neutral-200 px-3 py-3 text-right">Phí ship</th>
                ) : null}
                {canSeeMoney && isColumnVisible("codAmount") ? (
                  <th className="border-b border-neutral-200 px-3 py-3 text-right">Thu hộ COD</th>
                ) : null}
                {canSeeMoney && isColumnVisible("amountDue") ? (
                  <th className="border-b border-neutral-200 px-3 py-3 text-right">Khách còn phải trả</th>
                ) : null}
                {canSeeMoney && isColumnVisible("finalAmount") ? (
                  <th className="border-b border-neutral-200 px-3 py-3 text-right">Tổng tiền</th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={30} className="px-4 py-6 text-sm text-neutral-500">
                    Không có đơn phù hợp.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const checked = checkedIds.includes(order.id);
                  const meta = parseStructuredNote(order.note);
                  const shippingFee = Number(order.shippingFee || order.shipment?.shippingFee || 0);
                  const codAmount = Number(order.shipment?.codAmount || 0);
                  const customerStillOwes = amountCustomerStillOwes(order);
                  const createdByName = getCreatedByName(order);

                  return (
                    <tr key={order.id} className="bg-white text-sm hover:bg-neutral-50">
                      <td className="border-b border-neutral-100 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheckOne(order.id)}
                        />
                      </td>

                      {isColumnVisible("orderCode") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 font-medium whitespace-nowrap">
                          <Link
                            href={`/orders/${encodeURIComponent(order.id)}`}
                            className="text-neutral-900 underline-offset-2 hover:underline"
                          >
                            {order.orderCode}
                          </Link>
                        </td>
                      ) : null}

                      {isColumnVisible("createdAt") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap text-xs text-neutral-500">
                          {order.createdAt}
                        </td>
                      ) : null}

                      {isColumnVisible("customerName") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {order.customerName || "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("customerPhone") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {order.customerPhone || "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("orderStatus") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          <Badge
                            label={orderStatusLabel(order.status)}
                            tone={orderStatusTone(order.status)}
                          />
                        </td>
                      ) : null}

                      {isColumnVisible("paymentStatus") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          <Badge
                            label={paymentStatusLabel(order.paymentStatus)}
                            tone={paymentStatusTone(order.paymentStatus)}
                          />
                        </td>
                      ) : null}

                      {isColumnVisible("fulfillmentStatus") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          <Badge
                            label={
                              order.shipment?.shippingStatus || order.shipment?.trackingCode
                                ? shippingStatusLabel(deliveryDisplayStatus(order))
                                : fulfillmentStatusLabel(order.fulfillmentStatus)
                            }
                            tone={
                              order.shipment?.shippingStatus || order.shipment?.trackingCode
                                ? shippingStatusTone(deliveryDisplayStatus(order))
                                : fulfillmentStatusTone(order.fulfillmentStatus)
                            }
                          />
                        </td>
                      ) : null}

                      {isColumnVisible("branch") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {branchLabel(order.branchId)}
                        </td>
                      ) : null}

                      {isColumnVisible("createdBy") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {createdByName}
                        </td>
                      ) : null}

                      {isColumnVisible("salesChannel") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {order.salesChannel || "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("shippingMode") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {meta.shippingMode || "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("shippingPartner") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          {order.shipment?.carrier || meta.shippingPartner || "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("trackingCode") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap text-xs">
                          {order.shipment?.trackingCode || "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("itemCount") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-center whitespace-nowrap">
                          {(order.items || []).length}
                        </td>
                      ) : null}

                      {isColumnVisible("shippingAddress") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 min-w-[240px]">
                          <span title={meta.address || ""}>
                            {shortText(meta.address, 40)}
                          </span>
                        </td>
                      ) : null}

                      {isColumnVisible("note") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 min-w-[200px]">
                          <span title={meta.noteText || meta.shippingNote || order.note || ""}>
                            {shortText(meta.noteText || meta.shippingNote || order.note, 34)}
                          </span>
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("shippingFee") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(shippingFee)}
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("codAmount") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(codAmount)}
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("amountDue") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(customerStillOwes)}
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("finalAmount") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(order.finalAmount)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {canSeeMoney ? (
        <Panel className="p-3">
          <p className="text-xs text-neutral-500">
            Doanh thu đã thanh toán theo bộ lọc hiện tại
          </p>
          <p className="mt-1 text-lg font-semibold">{currency(paidRevenue)}</p>
        </Panel>
      ) : null}
    </div>
  );
}