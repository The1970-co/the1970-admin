"use client";

import { useState } from "react";

type Order = {
  id: string;
  orderCode: string;
  orderStatus: string;
  grandTotal: string;
};

const API_URL = "http://localhost:3000";

export default function OrdersPanel({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updateOrderStatus(orderId: string, nextStatus: string) {
    try {
      setLoadingId(orderId);

      const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderStatus: nextStatus }),
      });

      if (!res.ok) {
        throw new Error("Update status failed");
      }

      const updated = await res.json();

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                orderStatus: updated.orderStatus,
                grandTotal: updated.grandTotal,
              }
            : order,
        ),
      );
    } catch (error) {
      console.error(error);
      alert("Cập nhật trạng thái thất bại");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl mb-4">Orders</h2>

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="p-4 border rounded space-y-2">
            <div>Code: {o.orderCode}</div>
            <div>Status: {o.orderStatus}</div>
            <div>Total: {o.grandTotal}</div>

            <div className="flex gap-2 flex-wrap">
              <button
                className="px-3 py-2 border rounded"
                disabled={loadingId === o.id}
                onClick={() => updateOrderStatus(o.id, "CONFIRMED")}
              >
                Confirm
              </button>

              <button
                className="px-3 py-2 border rounded"
                disabled={loadingId === o.id}
                onClick={() => updateOrderStatus(o.id, "PACKING")}
              >
                Packing
              </button>

              <button
                className="px-3 py-2 border rounded"
                disabled={loadingId === o.id}
                onClick={() => updateOrderStatus(o.id, "SHIPPED")}
              >
                Shipped
              </button>

              <button
                className="px-3 py-2 border rounded"
                disabled={loadingId === o.id}
                onClick={() => updateOrderStatus(o.id, "COMPLETED")}
              >
                Complete
              </button>

              <button
                className="px-3 py-2 border rounded"
                disabled={loadingId === o.id}
                onClick={() => updateOrderStatus(o.id, "CANCELLED")}
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}