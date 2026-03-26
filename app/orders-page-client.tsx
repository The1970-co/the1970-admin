"use client";

import { useMemo, useState } from "react";
import {
  createShipment,
  updateOrderStatus,
  updatePaymentStatus,
} from "../lib/orders-api";

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  color?: string | null;
  size?: string | null;
  qty: number;
  unitPrice: string;
  lineTotal: string;
};

type Order = {
  id: string;
  orderCode: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  note?: string | null;
  createdAt: string;
  items: OrderItem[];
};

type Props = {
  initialOrders: Order[];
};

export default function OrdersPageClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrders[0]?.id ?? null,
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  async function handleConfirm(orderId: string) {
    try {
      setLoadingAction("confirm");
      const updated = await updateOrderStatus(orderId, "CONFIRMED");

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );
    } catch (error) {
      console.error(error);
      alert("Confirm thất bại");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleMarkPaid(orderId: string) {
    try {
      setLoadingAction("paid");
      const updated = await updatePaymentStatus(orderId, "PAID");

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );
    } catch (error) {
      console.error(error);
      alert("Mark paid thất bại");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCancel(orderId: string) {
    try {
      setLoadingAction("cancel");
      const updated = await updateOrderStatus(orderId, "CANCELLED");

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );
    } catch (error) {
      console.error(error);
      alert("Cancel thất bại");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleFulfill(orderId: string) {
    try {
      setLoadingAction("fulfill");
      await createShipment(orderId);

      const updated = await updateOrderStatus(orderId, "PACKING");

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );

      alert("Đã tạo shipment");
    } catch (error) {
      console.error(error);
      alert("Fulfill thất bại");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7 space-y-4">
        <h2 className="text-2xl font-semibold">Đơn hàng</h2>

        {orders.map((order) => {
          const active = order.id === selectedOrderId;

          return (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className={`w-full rounded-2xl border p-5 text-left transition ${
                active ? "border-black shadow-sm" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold">{order.orderCode}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border px-3 py-1">
                      {order.orderStatus}
                    </span>
                    <span className="rounded-full border px-3 py-1">
                      {order.paymentStatus}
                    </span>
                    <span className="rounded-full border px-3 py-1">
                      {order.fulfillmentStatus}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-semibold">
                    {Number(order.grandTotal).toLocaleString("vi-VN")}đ
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    {order.items.length} item
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {order.items.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm"
                  >
                    {item.sku} × {item.qty}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="col-span-5">
        <div className="rounded-2xl border p-6">
          {!selectedOrder ? (
            <div>Chưa có order nào</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-semibold">
                  {selectedOrder.orderCode}
                </h3>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border px-3 py-1 text-sm">
                  {selectedOrder.orderStatus}
                </span>
                <span className="rounded-full border px-3 py-1 text-sm">
                  {selectedOrder.paymentStatus}
                </span>
                <span className="rounded-full border px-3 py-1 text-sm">
                  {selectedOrder.fulfillmentStatus}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border p-4">
                <div className="flex justify-between py-1">
                  <span>Tổng tiền</span>
                  <span>
                    {Number(selectedOrder.grandTotal).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Ngày tạo</span>
                  <span>
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Ghi chú</span>
                  <span>{selectedOrder.note || "-"}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{item.productName}</div>
                        <div className="text-sm text-gray-500">{item.sku}</div>
                        <div className="text-sm text-gray-500">
                          {item.color || "-"} / {item.size || "-"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div>x{item.qty}</div>
                        <div className="font-semibold">
                          {Number(item.lineTotal).toLocaleString("vi-VN")}đ
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-50"
                  disabled={loadingAction !== null}
                  onClick={() => handleConfirm(selectedOrder.id)}
                >
                  {loadingAction === "confirm" ? "Đang xử lý..." : "Confirm"}
                </button>

                <button
                  className="rounded-xl bg-green-600 px-4 py-3 text-white disabled:opacity-50"
                  disabled={loadingAction !== null}
                  onClick={() => handleMarkPaid(selectedOrder.id)}
                >
                  {loadingAction === "paid" ? "Đang xử lý..." : "Mark Paid"}
                </button>

                <button
                  className="rounded-xl border px-4 py-3 disabled:opacity-50"
                  disabled={loadingAction !== null}
                  onClick={() => handleFulfill(selectedOrder.id)}
                >
                  {loadingAction === "fulfill"
                    ? "Đang xử lý..."
                    : "Đẩy hàng / Fulfill"}
                </button>

                <button
                  className="rounded-xl bg-red-600 px-4 py-3 text-white disabled:opacity-50"
                  disabled={loadingAction !== null}
                  onClick={() => handleCancel(selectedOrder.id)}
                >
                  {loadingAction === "cancel" ? "Đang xử lý..." : "Cancel"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}