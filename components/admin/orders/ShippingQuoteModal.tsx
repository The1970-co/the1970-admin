"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getOrders,
  type AdminOrder,
  type OrderPaymentStatus,
  type OrderStatus,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from "@/lib/orders-api";
import {
  BRANCH_LABELS,
  canAccessBranch,
  hasPermission,
  type AppRole,
} from "@/lib/authz";
import {
  getCurrentUserFromStorage,
  getUserBranchIds,
  isOwnerUser,
} from "@/lib/current-user";
import RoleGuard from "@/components/admin/RoleGuard";
import StatusBadge from "@/components/admin/orders/StatusBadge";
import ShippingQuoteModal from "@/components/admin/orders/ShippingQuoteModal";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/order-status-ui";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function branchName(id?: string) {
  return BRANCH_LABELS[id as keyof typeof BRANCH_LABELS] || "—";
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
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "success"
        ? "bg-emerald-600 text-white hover:bg-emerald-500"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
    >
      {children}
    </button>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Panel>
      <div className="p-5">
        <p className="text-sm text-neutral-500">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{value}</h3>
        <p className="mt-2 text-xs text-neutral-500">{sub}</p>
      </div>
    </Panel>
  );
}

function parseStructuredNote(note?: string) {
  if (!note) {
    return {
      noteText: "",
      address: "",
      tags: "",
      couponCode: "",
      shippingMode: "",
      shippingPartner: "",
      shippingPayer: "",
      customerPaid: "",
      remaining: "",
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
    couponCode: getValue("Mã giảm giá:"),
    shippingMode: getValue("Cách giao:"),
    shippingPartner: getValue("Đơn vị giao:"),
    shippingPayer: getValue("Người trả ship:"),
    customerPaid: getValue("Khách đã trả:"),
    remaining: getValue("Còn phải trả:"),
  };
}

function SummaryBadge({
  label,
  tone,
}: {
  label: string;
  tone: "amber" | "blue" | "green" | "red" | "gray";
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {label}
    </span>
  );
}

function summaryBadge(
  order: AdminOrder
): { label: string; tone: "amber" | "blue" | "green" | "red" | "gray" } {
  if (order.status === "CANCELLED") {
    return { label: "Đã hủy", tone: "red" };
  }

  if (
    ["APPROVED", "PACKING"].includes(order.status) &&
    order.paymentStatus !== "FAILED"
  ) {
    return { label: "Có thể gửi hãng", tone: "blue" };
  }

  if (
    ["NEW"].includes(order.status) ||
    order.paymentStatus === "PENDING_COD" ||
    order.paymentStatus === "UNPAID"
  ) {
    return { label: "Cần xử lý", tone: "amber" };
  }

  if (order.paymentStatus === "PAID" || order.status === "COMPLETED") {
    return { label: "Ổn định", tone: "green" };
  }

  return { label: "Theo dõi", tone: "gray" };
}

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<
    "ALL" | OrderPaymentStatus
  >("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");

  const [savingOrderStatus, setSavingOrderStatus] = useState(false);
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false);
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const [role, setRole] = useState<AppRole>("admin");
  const [userBranchIds, setUserBranchIds] = useState<string[]>([
    "b1",
    "b2",
    "b3",
  ]);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    const branchIds = getUserBranchIds(currentUser);

    setRole(currentUser.role);
    setUserBranchIds(branchIds);

    if (!isOwnerUser(currentUser) && branchIds.length === 1) {
      setBranchFilter(branchIds[0]);
    }
  }, []);

  const canViewOrders = hasPermission(role, "orders.view");
  const canCreateOrders = hasPermission(role, "orders.create");
  const canUpdateOrders = hasPermission(role, "orders.update_status");
  const canCancelOrders = hasPermission(role, "orders.cancel");

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getCurrentUserFromStorage();
      if (!currentUser) return;

      const branchIds = getUserBranchIds(currentUser);
      const data = await getOrders();

      const scoped = data.filter((order) =>
        canAccessBranch(
          {
            id: currentUser.id,
            code: currentUser.code,
            name: currentUser.name,
            role: currentUser.role,
            branchIds,
            branchId: currentUser.branchId,
            branchName: currentUser.branchName,
            status: currentUser.status,
          },
          order.branchId
        )
      );

      setOrders(scoped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được đơn hàng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewOrders) return;
    void loadOrders();
  }, [canViewOrders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((order) => {
      const meta = parseStructuredNote(order.note);

      const matchQuery =
        !q ||
        order.orderCode.toLowerCase().includes(q) ||
        (order.customerName || "").toLowerCase().includes(q) ||
        (order.customerPhone || "").toLowerCase().includes(q) ||
        order.salesChannel.toLowerCase().includes(q) ||
        branchName(order.branchId).toLowerCase().includes(q) ||
        meta.address.toLowerCase().includes(q) ||
        meta.tags.toLowerCase().includes(q) ||
        order.items.some(
          (item) =>
            item.sku.toLowerCase().includes(q) ||
            item.productName.toLowerCase().includes(q)
        );

      const matchOrder =
        orderFilter === "ALL" || order.status === orderFilter;
      const matchPayment =
        paymentFilter === "ALL" || order.paymentStatus === paymentFilter;
      const matchChannel =
        channelFilter === "ALL" || order.salesChannel === channelFilter;
      const matchBranch =
        branchFilter === "ALL" || order.branchId === branchFilter;

      return (
        matchQuery &&
        matchOrder &&
        matchPayment &&
        matchChannel &&
        matchBranch
      );
    });
  }, [orders, query, orderFilter, paymentFilter, channelFilter, branchFilter]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedId(null);
      return;
    }

    const exists = filteredOrders.some((o) => o.id === selectedId);
    if (!exists) {
      setSelectedId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedId]);

  const selected =
    filteredOrders.find((o) => o.id === selectedId) ||
    orders.find((o) => o.id === selectedId) ||
    null;

  const selectedMeta = parseStructuredNote(selected?.note);

  const pendingCount = filteredOrders.filter((o) =>
    ["NEW", "APPROVED", "PACKING"].includes(o.status)
  ).length;

  const codCount = filteredOrders.filter(
    (o) => o.paymentStatus === "PENDING_COD"
  ).length;

  const waitingPushCount = filteredOrders.filter(
    (o) =>
      ["APPROVED", "PACKING"].includes(o.status) &&
      o.status !== "CANCELLED"
  ).length;

  const paidRevenue = filteredOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);

  const channels = Array.from(
    new Set(orders.map((o) => o.salesChannel))
  ).filter(Boolean);

  const branchOptions = [
    { value: "ALL", label: "Tất cả chi nhánh" },
    ...Object.entries(BRANCH_LABELS)
      .filter(([id]) => role === "admin" || userBranchIds.includes(id))
      .map(([id, label]) => ({ value: id, label })),
  ];

  const handleOrderStatusChange = async (nextStatus: OrderStatus) => {
    if (!selected) return;
    if (!canUpdateOrders) {
      setActionMessage("Role hiện tại không có quyền cập nhật trạng thái đơn.");
      return;
    }

    try {
      setSavingOrderStatus(true);
      setActionMessage("");
      const updated = await updateOrderStatus(selected.id, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setActionMessage(
        `Đã cập nhật trạng thái đơn thành ${
          ORDER_STATUS_LABEL[nextStatus] || nextStatus
        }.`
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? err.message
          : "Không cập nhật được trạng thái đơn."
      );
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const handlePaymentStatusChange = async (nextStatus: OrderPaymentStatus) => {
    if (!selected) return;
    if (!canUpdateOrders) {
      setActionMessage("Role hiện tại không có quyền cập nhật thanh toán.");
      return;
    }

    try {
      setSavingPaymentStatus(true);
      setActionMessage("");
      const updated = await updateOrderPaymentStatus(selected.id, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setActionMessage(
        `Đã cập nhật thanh toán thành ${
          PAYMENT_STATUS_LABEL[nextStatus] || nextStatus
        }.`
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? err.message
          : "Không cập nhật được trạng thái thanh toán."
      );
    } finally {
      setSavingPaymentStatus(false);
    }
  };

  const handleOpenShippingModal = async () => {
    if (!selected) return;
    if (!canUpdateOrders) {
      setActionMessage("Role hiện tại không có quyền gửi hãng / fulfill.");
      return;
    }

    setActionMessage("");
    setShippingModalOpen(true);
  };

  const quickApprove = async () => {
    if (!selected) return;
    await handleOrderStatusChange("APPROVED");
  };

  const quickMarkPaid = async () => {
    if (!selected) return;
    await handlePaymentStatusChange("PAID");
  };

  const quickCancel = async () => {
    if (!selected) return;
    if (!canCancelOrders) {
      setActionMessage("Role hiện tại không có quyền hủy đơn.");
      return;
    }
    await handleOrderStatusChange("CANCELLED");
  };

  if (!canViewOrders) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">
          Role hiện tại không có quyền xem đơn hàng.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {!canUpdateOrders || !canCancelOrders || !canCreateOrders ? (
        <Panel className="p-4">
          <p className="text-sm text-amber-700">
            Role hiện tại bị giới hạn một số thao tác xử lý đơn.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Đơn cần xử lý"
          value={pendingCount}
          sub="Mới tạo + Đã duyệt + Đang xử lý"
        />
        <StatCard title="Đơn COD" value={codCount} sub="Chờ giao / thu tiền" />
        <StatCard
          title="Chờ gửi hãng"
          value={waitingPushCount}
          sub="Có thể tạo vận đơn"
        />
        <StatCard
          title="Doanh thu đã thanh toán"
          value={currency(paidRevenue)}
          sub="Theo bộ lọc hiện tại"
        />
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.7fr_0.9fr_0.9fr_0.9fr_0.9fr_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            placeholder="Tìm theo mã đơn, khách hàng, số điện thoại, SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
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
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
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

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="ALL">Tất cả kênh</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            {branchOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            onClick={() => void loadOrders()}
            disabled={loading}
          >
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>
      </Panel>

      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {actionMessage ? (
        <Panel className="p-4">
          <p className="text-sm text-neutral-700">{actionMessage}</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          {loading ? (
            <Panel className="p-5">
              <p className="text-sm text-neutral-500">Đang tải dữ liệu...</p>
            </Panel>
          ) : filteredOrders.length === 0 ? (
            <Panel className="p-5">
              <p className="text-sm text-neutral-500">Không có đơn phù hợp.</p>
            </Panel>
          ) : (
            filteredOrders.map((order) => {
              const active = selectedId === order.id;
              const summary = summaryBadge(order);

              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  className={`block w-full rounded-3xl border p-5 text-left shadow-sm transition ${
                    active
                      ? "border-neutral-900 bg-white"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xl font-semibold">{order.orderCode}</p>
                        <StatusBadge type="order" value={order.status} />
                        <StatusBadge type="payment" value={order.paymentStatus} />
                        <SummaryBadge label={summary.label} tone={summary.tone} />
                      </div>

                      <p className="mt-3 text-sm text-neutral-700">
                        {order.customerName} · {order.customerPhone}
                      </p>

                      <p className="mt-1 text-sm text-neutral-500">
                        {order.createdAt} · {order.salesChannel} ·{" "}
                        {branchName(order.branchId)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.items.slice(0, 2).map((item, idx) => (
                          <span
                            key={`${item.sku}-${idx}`}
                            className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                          >
                            {item.sku} × {item.qty}
                          </span>
                        ))}
                        {order.items.length > 2 ? (
                          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                            +{order.items.length - 2} sản phẩm
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-semibold">
                        {currency(order.finalAmount)}
                      </p>
                      <p className="mt-2 text-sm text-neutral-500">
                        {order.items.length} sản phẩm
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <Panel className="p-5">
          {!selected ? (
            <p className="text-sm text-neutral-500">
              Chọn một đơn để xem chi tiết.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-500">
                    Chi tiết đơn
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-3xl font-semibold tracking-tight">
                      {selected.orderCode}
                    </h3>
                    <StatusBadge type="order" value={selected.status} />
                    <StatusBadge type="payment" value={selected.paymentStatus} />
                    {selected.fulfillmentStatus ? (
                      <StatusBadge
                        type="fulfillment"
                        value={selected.fulfillmentStatus}
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-neutral-500">
                    {selected.createdAt} · {selected.salesChannel}
                  </p>
                </div>

                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  {branchName(selected.branchId)}
                </span>
              </div>

              <div className="rounded-3xl border border-neutral-200 p-4">
                <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
                  <span className="text-neutral-500">Khách hàng</span>
                  <span className="font-medium">{selected.customerName}</span>

                  <span className="text-neutral-500">Điện thoại</span>
                  <span>{selected.customerPhone}</span>

                  <span className="text-neutral-500">Chi nhánh</span>
                  <span>{branchName(selected.branchId)}</span>

                  <span className="text-neutral-500">Tổng tiền</span>
                  <span>{currency(selected.finalAmount)}</span>

                  <span className="text-neutral-500">Ghi chú</span>
                  <span>{selectedMeta.noteText || selected.note || "—"}</span>
                </div>
              </div>

              {selected.shipment ? (
                <div className="rounded-3xl border border-neutral-200 p-4 text-sm">
                  <p className="font-medium">Vận đơn</p>
                  <div className="mt-3 grid grid-cols-[140px_1fr] gap-y-2">
                    <span className="text-neutral-500">Đơn vị</span>
                    <span>{selected.shipment.carrier || "—"}</span>

                    <span className="text-neutral-500">Mã vận đơn</span>
                    <span>{selected.shipment.trackingCode || "—"}</span>

                    <span className="text-neutral-500">Trạng thái giao</span>
                    <span>{selected.shipment.shippingStatus || "—"}</span>

                    <span className="text-neutral-500">Phí giao hàng</span>
                    <span>{currency(selected.shipment.shippingFee || 0)}</span>

                    <span className="text-neutral-500">COD</span>
                    <span>{currency(selected.shipment.codAmount || 0)}</span>
                  </div>
                </div>
              ) : null}

              {selectedMeta.address || selectedMeta.tags ? (
                <div className="rounded-3xl border border-neutral-200 p-4 text-sm">
                  {selectedMeta.address ? (
                    <p>
                      <span className="text-neutral-500">Địa chỉ:</span>{" "}
                      {selectedMeta.address}
                    </p>
                  ) : null}
                  {selectedMeta.tags ? (
                    <p className={selectedMeta.address ? "mt-2" : ""}>
                      <span className="text-neutral-500">Tags:</span>{" "}
                      {selectedMeta.tags}
                    </p>
                  ) : null}
                  {selectedMeta.couponCode ? (
                    <p className="mt-2">
                      <span className="text-neutral-500">Mã giảm giá:</span>{" "}
                      {selectedMeta.couponCode}
                    </p>
                  ) : null}
                  {selectedMeta.shippingMode ? (
                    <p className="mt-2">
                      <span className="text-neutral-500">Cách giao:</span>{" "}
                      {selectedMeta.shippingMode}
                    </p>
                  ) : null}
                  {selectedMeta.shippingPartner ? (
                    <p className="mt-2">
                      <span className="text-neutral-500">Đơn vị giao:</span>{" "}
                      {selectedMeta.shippingPartner}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                {selected.items.map((item, idx) => (
                  <div
                    key={`${item.sku}-${idx}`}
                    className="flex items-start justify-between gap-4 rounded-3xl border border-neutral-200 p-4"
                  >
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {item.sku} · {item.color || "—"} / {item.size || "—"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>x{item.qty}</p>
                      <p className="mt-1 text-neutral-500">
                        {currency(item.unitPrice)}
                      </p>
                      <p className="mt-1 font-medium">
                        {currency(item.lineTotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <RoleGuard permission="orders.update_status">
                  <Button
                    onClick={() => void quickApprove()}
                    disabled={savingOrderStatus}
                  >
                    {savingOrderStatus ? "Đang xử lý..." : "Duyệt đơn"}
                  </Button>
                </RoleGuard>

                <RoleGuard permission="orders.update_status">
                  <Button
                    variant="success"
                    onClick={() => void quickMarkPaid()}
                    disabled={savingPaymentStatus}
                  >
                    {savingPaymentStatus ? "Đang xử lý..." : "Đã thanh toán"}
                  </Button>
                </RoleGuard>

                <RoleGuard permission="orders.update_status">
                  <Button
                    variant="secondary"
                    onClick={() => void handleOpenShippingModal()}
                  >
                    Gửi hãng / Fulfill
                  </Button>
                </RoleGuard>

                <RoleGuard permission="orders.cancel">
                  <Button
                    variant="danger"
                    onClick={() => void quickCancel()}
                    disabled={savingOrderStatus}
                  >
                    {savingOrderStatus ? "Đang xử lý..." : "Hủy đơn"}
                  </Button>
                </RoleGuard>
              </div>

              <div className="rounded-3xl border border-neutral-200 p-4">
                <p className="font-medium">Checklist xử lý</p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                  <li>• Duyệt đơn khi đã chốt thông tin và giữ hàng.</li>
                  <li>• Đã thanh toán cho đơn chuyển khoản hoặc đã nhận tiền.</li>
                  <li>• Gửi hãng / Fulfill khi đơn sẵn sàng giao.</li>
                  <li>• Chỉ hủy đơn khi khách hủy hoặc lỗi xử lý.</li>
                </ul>
              </div>

              <RoleGuard permission="orders.update_status">
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="cursor-not-allowed rounded-2xl border border-neutral-300 px-4 py-3 text-sm opacity-60 outline-none"
                    value={selected.status}
                    disabled
                  >
                    <option value="NEW">Mới tạo</option>
                    <option value="APPROVED">Đã duyệt</option>
                    <option value="PACKING">Đang xử lý</option>
                    <option value="SHIPPED">Đã gửi hàng</option>
                    <option value="COMPLETED">Hoàn thành</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>

                  <select
                    className="cursor-not-allowed rounded-2xl border border-neutral-300 px-4 py-3 text-sm opacity-60 outline-none"
                    value={selected.paymentStatus}
                    disabled
                  >
                    <option value="UNPAID">Chưa thanh toán</option>
                    <option value="PARTIAL">Thanh toán một phần</option>
                    <option value="PAID">Đã thanh toán</option>
                    <option value="PENDING_COD">Chờ thu COD</option>
                    <option value="REFUNDED">Đã hoàn tiền</option>
                    <option value="FAILED">Thanh toán lỗi</option>
                  </select>
                </div>
              </RoleGuard>
            </div>
          )}
        </Panel>
      </div>

      <ShippingQuoteModal
        open={shippingModalOpen}
        order={selected}
        onClose={() => setShippingModalOpen(false)}
        onCreated={async () => {
          setActionMessage("Đã tạo vận đơn cho đơn này.");
          await loadOrders();
        }}
      />
    </div>
  );
}