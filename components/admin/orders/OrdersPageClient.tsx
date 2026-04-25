"use client";
import { getBranches, type BranchItem } from "@/lib/products-api";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import type {
  AdminOrder,
  OrderPaymentStatus,
  OrderStatus,
} from "@/lib/orders-api";
import {
  updateOrderPaymentStatus,
  updateOrderStatus,
} from "@/lib/orders-api";

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

type QuickStatusKey =
  | "ALL"
  | "WAITING_APPROVE"
  | "WAITING_PAYMENT"
  | "WAITING_PACKING"
  | "WAITING_SHIP"
  | "DELIVERING"
  | "SOON_DELIVERY"
  | "FAIL"
  | "REDELIVERY";

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

type CurrentUserLite = {
  role?: string;
  branchId?: string | null;
};

type ParsedNote = {
  noteText: string;
  address: string;
  tags: string;
  shippingMode: string;
  shippingPartner: string;
  shippingNote: string;
};

type NormalizedOrder = AdminOrder & {
  _meta: ParsedNote;
  _createdByName: string;
  _shippingFee: number;
  _codAmount: number;
  _amountDue: number;
  _createdAtDate: Date | null;
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
    <div
      className={`rounded-[24px] border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
  size = "md",
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
}) {
  const tones =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900"
      : variant === "success"
        ? "bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200"
        : variant === "danger"
          ? "bg-white text-red-600 hover:bg-red-50 border-red-200"
          : variant === "warning"
            ? "bg-white text-amber-700 hover:bg-amber-50 border-amber-200"
            : "bg-white text-neutral-900 hover:bg-neutral-50 border-neutral-300";

  const sizes =
    size === "lg"
      ? "px-4 py-3 text-[13px] rounded-2xl"
      : size === "sm"
        ? "px-2.5 py-1.5 text-[11px] rounded-xl"
        : "px-3.5 py-2.5 text-xs rounded-2xl";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border font-semibold transition ${tones} ${sizes} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
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
      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryIcon({
  active = false,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-[18px] ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-neutral-50 text-neutral-700"
      }`}
    >
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  active = false,
  onClick,
  icon,
}: {
  title: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] border px-4 py-4 text-left transition ${
        active
          ? "border-neutral-900 bg-neutral-50 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-4">
        <SummaryIcon active={active}>{icon}</SummaryIcon>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-neutral-600">{title}</p>
          <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight text-neutral-900">
            {value}
          </p>
          <p className="mt-3 text-[12px] font-medium text-neutral-500">
            Xem chi tiết
          </p>
        </div>
      </div>
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
      return "Đã gửi hàng";
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

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

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

function parseStructuredNote(note?: string): ParsedNote {
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

function amountCustomerStillOwes(order: AdminOrder) {
  if (order.status === "CANCELLED") return 0;
  if (
    order.paymentStatus === "PAID" ||
    order.paymentStatus === "REFUNDED"
  ) {
    return 0;
  }

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
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  if (key === "today") return { from: todayStart, to: todayEnd };

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
    return { from, to: todayEnd };
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

function normalizeShipmentStatus(order: AdminOrder) {
  return String(order.shipment?.shippingStatus || "").toUpperCase();
}

function isSoonDeliveryOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  return shipmentStatus.includes("DELIVERING");
}

function isFailedOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  return (
    order.status === "CANCELLED" ||
    order.paymentStatus === "FAILED" ||
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("RETURN") ||
    shipmentStatus.includes("CANCEL")
  );
}

function isRedeliveryOrder(order: AdminOrder) {
  const shipmentStatus = normalizeShipmentStatus(order);
  return (
    shipmentStatus.includes("RETURN") ||
    shipmentStatus.includes("FAIL") ||
    shipmentStatus.includes("DELIVERY_FAIL")
  );
}

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      setBranches([]);
    }
  };

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [orderFilter, setOrderFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [paymentFilter, setPaymentFilter] =
    useState<"ALL" | OrderPaymentStatus>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickDate, setQuickDate] = useState<QuickDateKey>("all");
  const [quickStatus, setQuickStatus] = useState<QuickStatusKey>("ALL");

  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [savingOrderStatus, setSavingOrderStatus] = useState(false);
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUserLite | null>(null);

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const printMenuRef = useRef<HTMLDivElement | null>(null);

  const canSeeMoney =
    currentUser?.role === "admin" || currentUser?.role === "owner";

  const canDeleteOrder =
    currentUser?.role === "admin" || currentUser?.role === "owner";

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([]);

  const branchLabel = (branchId?: string | null) => {
    if (!branchId) return "All";
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  useEffect(() => {
    const user = getCurrentUserLite();
    setCurrentUser(user);

    if (user?.role !== "admin" && user?.role !== "owner" && user?.branchId) {
      setBranchFilter(user.branchId);
    }

    void loadBranches();
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
      const allowed = COLUMN_DEFS.filter((col) =>
        canSeeMoney ? true : !col.money
      ).map((c) => c.key);
      const cleaned = parsed.filter((key) => allowed.includes(key));
      setVisibleColumns(
        cleaned.length ? cleaned : defaultVisibleColumns(canSeeMoney)
      );
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

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (deferredQuery.trim()) params.set("q", deferredQuery.trim());

      const isOwner =
        currentUser?.role === "admin" || currentUser?.role === "owner";

      if (!isOwner && currentUser?.branchId) {
        params.set("branchId", currentUser.branchId);
      } else if (branchFilter !== "ALL") {
        params.set("branchId", branchFilter);
      }

      if (orderFilter !== "ALL") params.set("orderStatus", orderFilter);
      if (paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(
        `http://localhost:3001/orders?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const raw = await res.json();

      if (!res.ok) {
        throw new Error(
          raw?.message || `Tải /orders thất bại. Status ${res.status}`
        );
      }

      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

      setOrders(data as AdminOrder[]);
      setTotalPages(Number(raw?.pagination?.totalPages || 1));
      setTotalItems(Number(raw?.pagination?.total || data.length || 0));
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
    const t = setTimeout(() => {
      void loadOrders();
    }, 250);

    return () => clearTimeout(t);
  }, [
    deferredQuery,
    branchFilter,
    orderFilter,
    paymentFilter,
    dateFrom,
    dateTo,
    page,
    pageSize,
    currentUser,
  ]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, branchFilter, orderFilter, paymentFilter, dateFrom, dateTo]);

  const normalizedOrders = useMemo<NormalizedOrder[]>(() => {
    return orders.map((order) => {
      const meta = parseStructuredNote(order.note);
      return {
        ...order,
        _meta: meta,
        _createdByName: getCreatedByName(order),
        _shippingFee: Number(order.shippingFee || order.shipment?.shippingFee || 0),
        _codAmount: Number(order.shipment?.codAmount || 0),
        _amountDue: amountCustomerStillOwes(order),
        _createdAtDate: parseOrderDate(order.createdAt),
      };
    });
  }, [orders]);

  const branchOptions = useMemo(() => {
    return [
      { value: "ALL", label: "Tất cả chi nhánh" },
      ...branches.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ];
  }, [branches]);

  const filteredOrders = useMemo(() => {
    if (quickStatus === "ALL") return normalizedOrders;

    return normalizedOrders.filter((o) => {
      switch (quickStatus) {
        case "WAITING_APPROVE":
          return o.status === "NEW";
        case "WAITING_PAYMENT":
          return ["UNPAID", "PARTIAL", "PENDING_COD"].includes(
            o.paymentStatus
          );
        case "WAITING_PACKING":
          return o.status === "PACKING";
        case "WAITING_SHIP":
          return ["APPROVED", "PACKING"].includes(o.status);
        case "DELIVERING":
          return o.status === "SHIPPED";
        case "SOON_DELIVERY":
          return isSoonDeliveryOrder(o);
        case "FAIL":
          return isFailedOrder(o);
        case "REDELIVERY":
          return isRedeliveryOrder(o);
        default:
          return true;
      }
    });
  }, [normalizedOrders, quickStatus]);

  const visibleOrders = filteredOrders;

  useEffect(() => {
    if (!filteredOrders.length) {
      setCheckedIds([]);
      return;
    }

    setCheckedIds((prev) =>
      prev.filter((id) => filteredOrders.some((o) => o.id === id))
    );
  }, [filteredOrders]);

  const counts = useMemo(() => {
    let waitingApprove = 0;
    let waitingPayment = 0;
    let waitingPacking = 0;
    let waitingShip = 0;
    let delivering = 0;
    let soonDelivery = 0;
    let failed = 0;
    let redelivery = 0;

    for (const o of normalizedOrders) {
      if (o.status === "NEW") waitingApprove++;
      if (["UNPAID", "PARTIAL", "PENDING_COD"].includes(o.paymentStatus)) {
        waitingPayment++;
      }
      if (o.status === "PACKING") waitingPacking++;
      if (["APPROVED", "PACKING"].includes(o.status)) waitingShip++;
      if (o.status === "SHIPPED") delivering++;
      if (isSoonDeliveryOrder(o)) soonDelivery++;
      if (isFailedOrder(o)) failed++;
      if (isRedeliveryOrder(o)) redelivery++;
    }

    return {
      waitingApprove,
      waitingPayment,
      waitingPacking,
      waitingShip,
      delivering,
      soonDelivery,
      failed,
      redelivery,
    };
  }, [normalizedOrders]);

  const allVisibleIds = visibleOrders.map((o) => o.id);
  const allChecked =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => checkedIds.includes(id));

  const checkedOrders = normalizedOrders.filter((o) =>
    checkedIds.includes(o.id)
  );

  const toggleCheckOne = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCheckAllVisible = () => {
    if (allChecked) {
      setCheckedIds((prev) =>
        prev.filter((id) => !allVisibleIds.includes(id))
      );
      return;
    }

    setCheckedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
  };

  const updateOneStatus = async (id: string, status: OrderStatus) => {
    const updated = await updateOrderStatus(id, status);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const updateOnePaymentStatus = async (
    id: string,
    paymentStatus: OrderPaymentStatus
  ) => {
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
        const order = normalizedOrders.find((o) => o.id === id);
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
        const order = normalizedOrders.find((o) => o.id === id);
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
        err instanceof Error
          ? err.message
          : "Lỗi cập nhật thanh toán hàng loạt."
      );
    } finally {
      setSavingPaymentStatus(false);
    }
  };

  const sendOneOrderToCarrier = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const res = await fetch(`http://localhost:3001/shipments/${id}/create`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        json?.message ||
        json?.error ||
        json?.details ||
        JSON.stringify(json || {});
      throw new Error(detail || "Gửi GHN thất bại.");
    }

    return json;
  };

  const cancelOneOrderOnCarrier = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const res = await fetch(`http://localhost:3001/shipments/${id}/cancel`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        json?.message ||
        json?.error ||
        json?.details ||
        JSON.stringify(json || {});
      throw new Error(detail || "Hủy GHN thất bại.");
    }

    return json;
  };

  const deleteOneOrder = async (id: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const res = await fetch(`http://localhost:3001/orders/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const detail =
        json?.message ||
        json?.error ||
        json?.details ||
        JSON.stringify(json || {});
      throw new Error(detail || "Xóa đơn thất bại.");
    }

    return json;
  };

  const handleDeleteOrder = async (id: string) => {
    const ok = window.confirm("Chỉ nên xóa đơn đã hủy. Xác nhận xóa đơn này?");
    if (!ok) return;

    try {
      setDeletingOrders(true);
      setActionMessage("");
      await deleteOneOrder(id);
      await loadOrders();
      setActionMessage("Đã xóa đơn.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Lỗi xóa đơn.");
    } finally {
      setDeletingOrders(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!checkedIds.length) return;

    const ok = window.confirm(
      `Xóa ${checkedIds.length} đơn đã chọn? Chỉ đơn đã hủy mới xóa được.`
    );
    if (!ok) return;

    try {
      setDeletingOrders(true);
      setActionMessage("");

      let successCount = 0;
      const failed: string[] = [];

      for (const id of checkedIds) {
        const order = normalizedOrders.find((o) => o.id === id);
        if (!order) continue;

        try {
          await deleteOneOrder(id);
          successCount += 1;
        } catch (err) {
          failed.push(
            `${order.orderCode}: ${
              err instanceof Error ? err.message : "Lỗi không rõ"
            }`
          );
        }
      }

      await loadOrders();
      setCheckedIds([]);

      if (failed.length === 0) {
        setActionMessage(`Đã xóa ${successCount} đơn.`);
      } else {
        setActionMessage(
          `Đã xóa ${successCount} đơn. Lỗi: ${failed.join(" | ")}`
        );
      }
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi xóa đơn hàng loạt."
      );
    } finally {
      setDeletingOrders(false);
    }
  };

  const handleBulkSendToCarrier = async () => {
    if (!checkedIds.length) return;

    try {
      setSavingOrderStatus(true);
      setActionMessage("");

      let successCount = 0;
      const failed: string[] = [];

      for (const id of checkedIds) {
        const order = normalizedOrders.find((o) => o.id === id);
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

      let successCount = 0;
      const failed: string[] = [];

      for (const id of checkedIds) {
        const order = normalizedOrders.find((o) => o.id === id);
        if (!order) continue;

        if (order.status === "COMPLETED") {
          failed.push(`${order.orderCode}: không thể hủy`);
          continue;
        }

        try {
          await cancelOneOrderOnCarrier(id);
          successCount += 1;
        } catch (err) {
          failed.push(
            `${order.orderCode}: ${
              err instanceof Error ? err.message : "Lỗi không rõ"
            }`
          );
        }
      }

      await loadOrders();

      if (failed.length === 0) {
        setActionMessage(`Đã hủy ${successCount} đơn.`);
      } else {
        setActionMessage(
          `Đã hủy ${successCount} đơn. Lỗi: ${failed.join(" | ")}`
        );
      }
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Lỗi hủy đơn hàng loạt."
      );
    } finally {
      setSavingOrderStatus(false);
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

  const paidRevenue = useMemo(
    () =>
      filteredOrders
        .filter((o) => o.paymentStatus === "PAID")
        .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0),
    [filteredOrders]
  );

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
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <SummaryCard
            title="Chờ duyệt"
            value={counts.waitingApprove}
            active={quickStatus === "WAITING_APPROVE"}
            icon="✓"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "WAITING_APPROVE" ? "ALL" : "WAITING_APPROVE"
              )
            }
          />
          <SummaryCard
            title="Chờ thanh toán"
            value={counts.waitingPayment}
            active={quickStatus === "WAITING_PAYMENT"}
            icon="₫"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "WAITING_PAYMENT" ? "ALL" : "WAITING_PAYMENT"
              )
            }
          />
          <SummaryCard
            title="Chờ đóng gói"
            value={counts.waitingPacking}
            active={quickStatus === "WAITING_PACKING"}
            icon="□"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "WAITING_PACKING" ? "ALL" : "WAITING_PACKING"
              )
            }
          />
          <SummaryCard
            title="Chờ gửi hãng"
            value={counts.waitingShip}
            active={quickStatus === "WAITING_SHIP"}
            icon="→"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "WAITING_SHIP" ? "ALL" : "WAITING_SHIP"
              )
            }
          />
          <SummaryCard
            title="Đang giao hàng"
            value={counts.delivering}
            active={quickStatus === "DELIVERING"}
            icon="↗"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "DELIVERING" ? "ALL" : "DELIVERING"
              )
            }
          />
          <SummaryCard
            title="Sắp giao"
            value={counts.soonDelivery}
            active={quickStatus === "SOON_DELIVERY"}
            icon="◔"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "SOON_DELIVERY" ? "ALL" : "SOON_DELIVERY"
              )
            }
          />
          <SummaryCard
            title="Đơn giao không thành công"
            value={counts.failed}
            active={quickStatus === "FAIL"}
            icon="!"
            onClick={() =>
              setQuickStatus((prev) => (prev === "FAIL" ? "ALL" : "FAIL"))
            }
          />
          <SummaryCard
            title="Đơn giao lại"
            value={counts.redelivery}
            active={quickStatus === "REDELIVERY"}
            icon="↺"
            onClick={() =>
              setQuickStatus((prev) =>
                prev === "REDELIVERY" ? "ALL" : "REDELIVERY"
              )
            }
          />
        </div>

        {quickStatus !== "ALL" ? (
          <div className="mt-4">
            <Button onClick={() => setQuickStatus("ALL")} size="sm">
              Bỏ lọc nhanh
            </Button>
          </div>
        ) : null}
      </Panel>

      <Panel className="p-4">
        <div className="flex flex-wrap gap-2">
          <SmallChip
            active={quickDate === "all"}
            onClick={() => applyQuickDate("all")}
          >
            Tất cả
          </SmallChip>
          <SmallChip
            active={quickDate === "today"}
            onClick={() => applyQuickDate("today")}
          >
            Hôm nay
          </SmallChip>
          <SmallChip
            active={quickDate === "yesterday"}
            onClick={() => applyQuickDate("yesterday")}
          >
            Hôm qua
          </SmallChip>
          <SmallChip
            active={quickDate === "7d"}
            onClick={() => applyQuickDate("7d")}
          >
            7 ngày
          </SmallChip>
          <SmallChip
            active={quickDate === "30d"}
            onClick={() => applyQuickDate("30d")}
          >
            30 ngày
          </SmallChip>
          <SmallChip
            active={quickDate === "month"}
            onClick={() => applyQuickDate("month")}
          >
            Tháng này
          </SmallChip>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.7fr_1fr_1fr_1fr_auto_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
            placeholder="Tìm mã đơn, khách hàng, SĐT, địa chỉ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
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
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
            value={orderFilter}
            onChange={(e) =>
              setOrderFilter(e.target.value as "ALL" | OrderStatus)
            }
          >
            <option value="ALL">Tất cả trạng thái đơn</option>
            <option value="NEW">Mới tạo</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PACKING">Đang xử lý</option>
            <option value="SHIPPED">Đã gửi hàng</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
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

          <Button onClick={() => void loadOrders()} size="md">
            Làm mới
          </Button>

          <div className="relative" ref={columnMenuRef}>
            <Button onClick={() => setShowColumnMenu((v) => !v)} size="md">
              Cột hiển thị
            </Button>

            {showColumnMenu ? (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-3xl border border-neutral-200 bg-white p-3 shadow-xl">
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
                  {COLUMN_DEFS.filter((col) =>
                    canSeeMoney ? true : !col.money
                  ).map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-sm"
                    >
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

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Từ ngày
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setQuickDate("all");
                setDateFrom(e.target.value);
              }}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Đến ngày
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setQuickDate("all");
                setDateTo(e.target.value);
              }}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
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
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleBulkApprove()}
              disabled={savingOrderStatus}
            >
              Duyệt đơn
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleBulkSendToCarrier()}
              disabled={savingOrderStatus}
            >
              Gửi hãng vận chuyển
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleBulkMarkPaid()}
              disabled={savingPaymentStatus}
            >
              Đánh dấu đã thanh toán
            </Button>

            <Button
              variant="warning"
              size="md"
              onClick={() => void handleBulkCancel()}
              disabled={savingOrderStatus}
            >
              Hủy đơn
            </Button>

            {canDeleteOrder ? (
              <Button
                variant="danger"
                size="md"
                onClick={() => void handleBulkDelete()}
                disabled={deletingOrders}
              >
                {deletingOrders ? "Đang xóa..." : "Xóa đơn"}
              </Button>
            ) : null}

            <span className="ml-2 text-sm text-neutral-500">
              {checkedIds.length} đã chọn
            </span>

            <div className="relative ml-auto" ref={printMenuRef}>
              <Button onClick={() => setShowPrintMenu((v) => !v)}>In</Button>

              {showPrintMenu ? (
                <div className="absolute left-0 z-30 mt-2 w-64 rounded-3xl border border-neutral-200 bg-white p-2 shadow-xl">
                  <button
                    className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("shipping", "80mm");
                    }}
                  >
                    Phiếu giao hàng 80mm
                  </button>

                  <button
                    className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("shipping", "A4");
                    }}
                  >
                    Phiếu giao hàng A4
                  </button>

                  <button
                    className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint("shipping", "A5");
                    }}
                  >
                    Phiếu giao hàng A5
                  </button>

                  <button
                    className="block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
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
          </div>
        </Panel>
      ) : null}

      {actionMessage ? (
        <Panel className="p-3">
          <p className="text-xs text-neutral-700">{actionMessage}</p>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[2520px] w-full border-collapse table-fixed">
            <thead className="bg-neutral-50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="w-[44px] border-b border-neutral-200 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleCheckAllVisible}
                  />
                </th>

                {isColumnVisible("orderCode") ? (
                  <th className="w-[160px] border-b border-neutral-200 px-3 py-3">
                    Mã đơn
                  </th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="w-[170px] border-b border-neutral-200 px-3 py-3">
                    Ngày tạo
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">
                    Khách hàng
                  </th>
                ) : null}
                {isColumnVisible("customerPhone") ? (
                  <th className="w-[120px] border-b border-neutral-200 px-3 py-3">
                    SĐT
                  </th>
                ) : null}
                {isColumnVisible("orderStatus") ? (
                  <th className="w-[140px] border-b border-neutral-200 px-3 py-3">
                    Trạng thái đơn
                  </th>
                ) : null}
                {isColumnVisible("paymentStatus") ? (
                  <th className="w-[145px] border-b border-neutral-200 px-3 py-3">
                    Thanh toán
                  </th>
                ) : null}
                {isColumnVisible("fulfillmentStatus") ? (
                  <th className="w-[135px] border-b border-neutral-200 px-3 py-3">
                    Giao vận
                  </th>
                ) : null}
                {isColumnVisible("branch") ? (
                  <th className="w-[110px] border-b border-neutral-200 px-3 py-3">
                    Chi nhánh
                  </th>
                ) : null}
                {isColumnVisible("createdBy") ? (
                  <th className="w-[150px] border-b border-neutral-200 px-3 py-3">
                    Nhân viên tạo đơn
                  </th>
                ) : null}
                {isColumnVisible("salesChannel") ? (
                  <th className="w-[120px] border-b border-neutral-200 px-3 py-3">
                    Kênh bán
                  </th>
                ) : null}
                {isColumnVisible("shippingMode") ? (
                  <th className="w-[110px] border-b border-neutral-200 px-3 py-3">
                    Cách giao
                  </th>
                ) : null}
                {isColumnVisible("shippingPartner") ? (
                  <th className="w-[95px] border-b border-neutral-200 px-3 py-3">
                    Đơn vị VC
                  </th>
                ) : null}
                {isColumnVisible("trackingCode") ? (
                  <th className="w-[170px] border-b border-neutral-200 px-3 py-3">
                    Mã vận đơn
                  </th>
                ) : null}
                {isColumnVisible("itemCount") ? (
                  <th className="w-[80px] border-b border-neutral-200 px-3 py-3 text-center">
                    Số món
                  </th>
                ) : null}
                {isColumnVisible("shippingAddress") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">
                    Địa chỉ giao
                  </th>
                ) : null}
                {isColumnVisible("note") ? (
                  <th className="border-b border-neutral-200 px-3 py-3">
                    Ghi chú
                  </th>
                ) : null}
                {canSeeMoney && isColumnVisible("shippingFee") ? (
                  <th className="w-[120px] border-b border-neutral-200 px-3 py-3 text-right">
                    Phí ship
                  </th>
                ) : null}
                {canSeeMoney && isColumnVisible("codAmount") ? (
                  <th className="w-[125px] border-b border-neutral-200 px-3 py-3 text-right">
                    Thu hộ COD
                  </th>
                ) : null}
                {canSeeMoney && isColumnVisible("amountDue") ? (
                  <th className="w-[150px] border-b border-neutral-200 px-3 py-3 text-right">
                    Khách còn phải trả
                  </th>
                ) : null}
                {canSeeMoney && isColumnVisible("finalAmount") ? (
                  <th className="w-[130px] border-b border-neutral-200 px-3 py-3 text-right">
                    Tổng tiền
                  </th>
                ) : null}
                <th className="w-[210px] border-b border-neutral-200 px-3 py-3 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={31} className="px-4 py-6 text-sm text-neutral-500">
                    Không có đơn phù hợp.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => {
                  const checked = checkedIds.includes(order.id);
                  const meta = order._meta;
                  const canShowRedelivery =
                    isFailedOrder(order) || isRedeliveryOrder(order);

                  return (
                    <tr
                      key={order.id}
                      className="bg-white text-sm hover:bg-neutral-50"
                    >
                      <td className="border-b border-neutral-100 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheckOne(order.id)}
                        />
                      </td>

                      {isColumnVisible("orderCode") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 font-semibold whitespace-nowrap">
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
                          <StatusBadge
                            label={orderStatusLabel(order.status)}
                            tone={orderStatusTone(order.status)}
                          />
                        </td>
                      ) : null}

                      {isColumnVisible("paymentStatus") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          <StatusBadge
                            label={paymentStatusLabel(order.paymentStatus)}
                            tone={paymentStatusTone(order.paymentStatus)}
                          />
                        </td>
                      ) : null}

                      {isColumnVisible("fulfillmentStatus") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap">
                          <StatusBadge
                            label={fulfillmentStatusLabel(
                              order.fulfillmentStatus
                            )}
                            tone={fulfillmentStatusTone(
                              order.fulfillmentStatus
                            )}
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
                          {order._createdByName}
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
                          {order.shipment?.carrier ||
                            meta.shippingPartner ||
                            "—"}
                        </td>
                      ) : null}

                      {isColumnVisible("trackingCode") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 whitespace-nowrap text-xs">
                          {order.shipment?.trackingCode ? (
                            order.shipment?.id ? (
                              <Link
                                href={`/control/shipments/${order.shipment.id}`}
                                className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                                title="Mở phiếu giao hàng"
                              >
                                {order.shipment.trackingCode}
                              </Link>
                            ) : (
                              <span
                                className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700"
                                title="Mã vận đơn"
                              >
                                {order.shipment.trackingCode}
                              </span>
                            )
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
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
                          <span
                            title={
                              meta.noteText ||
                              meta.shippingNote ||
                              order.note ||
                              ""
                            }
                          >
                            {shortText(
                              meta.noteText ||
                                meta.shippingNote ||
                                order.note,
                              34
                            )}
                          </span>
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("shippingFee") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(order._shippingFee)}
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("codAmount") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(order._codAmount)}
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("amountDue") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(order._amountDue)}
                        </td>
                      ) : null}

                      {canSeeMoney && isColumnVisible("finalAmount") ? (
                        <td className="border-b border-neutral-100 px-3 py-3 text-right font-medium whitespace-nowrap">
                          {currency(Number(order.finalAmount || 0))}
                        </td>
                      ) : null}

                      <td className="border-b border-neutral-100 px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/orders/${encodeURIComponent(order.id)}`}
                            className="inline-flex items-center rounded-xl border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
                          >
                            Chi tiết
                          </Link>

                          {canShowRedelivery ? (
                            <Link
                              href={`/orders/${encodeURIComponent(order.id)}?action=redelivery`}
                              className="inline-flex items-center rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                            >
                              Giao lại
                            </Link>
                          ) : null}

                          {canDeleteOrder ? (
                            <button
                              onClick={() => void handleDeleteOrder(order.id)}
                              className="rounded-xl border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                              disabled={deletingOrders}
                              title="Chỉ xóa được đơn đã hủy"
                            >
                              Xóa
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            Trang {page}/{totalPages} • Tổng {totalItems} đơn
          </p>

          <div className="flex gap-2">
            <Button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Trước
            </Button>

            <Button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau →
            </Button>
          </div>
        </div>
      </Panel>

      {canSeeMoney ? (
        <Panel className="p-4">
          <p className="text-xs text-neutral-500">
            Doanh thu đã thanh toán theo bộ lọc hiện tại
          </p>
          <p className="mt-1 text-lg font-semibold">{currency(paidRevenue)}</p>
        </Panel>
      ) : null}
    </div>
  );
}