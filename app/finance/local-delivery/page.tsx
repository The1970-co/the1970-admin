"use client";

import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState } from "react";

type LocalDeliveryOrder = {
  id: string;
  orderCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  finalAmount?: number | null;
  shippingFee?: number | null;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  status?: string | null;
  createdAt?: string | null;
  shipment?: {
    id: string;
    carrier?: string | null;
    trackingCode?: string | null;
    shippingStatus?: string | null;
    codAmount?: number | null;
    shippingFee?: number | null;
  } | null;
};

function money(value?: number | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function tone(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s.includes("DELIVERED") || s.includes("COMPLETED") || s.includes("PAID")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (s.includes("CANCEL") || s.includes("FAILED") || s.includes("RETURN")) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (s.includes("PROCESS") || s.includes("SHIPPED") || s.includes("PENDING")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

export default function LocalDeliveryReconciliationPage() {
  const [orders, setOrders] = useState<LocalDeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const res = await fetch(`${API_BASE}/orders?pageSize=100`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || "Không tải được danh sách đơn.");
      }

      const rows = Array.isArray(json?.data) ? json.data : [];
      setOrders(
        rows.filter((order: LocalDeliveryOrder) => {
          const carrier = String(order?.shipment?.carrier || "").toUpperCase();
          return carrier.includes("AHAMOVE") || carrier.includes("GRAB") || carrier.includes("SHIPPER");
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        const cod = Number(order.shipment?.codAmount || order.finalAmount || 0);
        const fee = Number(order.shipment?.shippingFee || order.shippingFee || 0);

        acc.cod += cod;
        acc.fee += fee;

        const status = String(order.shipment?.shippingStatus || order.status || "").toUpperCase();
        if (status.includes("DELIVERED") || status.includes("COMPLETED")) acc.done += 1;
        else if (status.includes("CANCEL") || status.includes("FAILED")) acc.issue += 1;
        else acc.processing += 1;

        return acc;
      },
      { cod: 0, fee: 0, done: 0, issue: 0, processing: 0 }
    );
  }, [orders]);

  return (
    <AdminShell>
      <div className="space-y-5 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">
            Finance · Local delivery
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-950">
            Đối soát nội thành
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Theo dõi COD, phí ship và trạng thái đối soát cho AhaMove / shipper nội thành.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">Tổng COD cần thu</div>
            <div className="mt-2 text-2xl font-semibold">{money(summary.cod)}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">Tổng phí nội thành</div>
            <div className="mt-2 text-2xl font-semibold">{money(summary.fee)}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">Đang xử lý</div>
            <div className="mt-2 text-2xl font-semibold">{summary.processing}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">Có vấn đề</div>
            <div className="mt-2 text-2xl font-semibold">{summary.issue}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-neutral-950">Danh sách đơn nội thành</h2>
              <p className="text-xs text-neutral-500">Dữ liệu lấy từ đơn hàng có carrier nội thành.</p>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-xl border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Làm mới
            </button>
          </div>

          {loading ? (
            <div className="p-5 text-sm text-neutral-500">Đang tải...</div>
          ) : error ? (
            <div className="p-5 text-sm text-red-600">{error}</div>
          ) : !orders.length ? (
            <div className="p-5 text-sm text-neutral-500">Chưa có đơn nội thành cần đối soát.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-3">Mã đơn</th>
                    <th className="px-5 py-3">Khách</th>
                    <th className="px-5 py-3">Carrier</th>
                    <th className="px-5 py-3">Mã vận đơn</th>
                    <th className="px-5 py-3 text-right">COD</th>
                    <th className="px-5 py-3 text-right">Phí ship</th>
                    <th className="px-5 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3 font-medium text-neutral-950">{order.orderCode}</td>
                      <td className="px-5 py-3">
                        <div>{order.customerName || "Khách lẻ"}</div>
                        <div className="text-xs text-neutral-500">{order.customerPhone || "—"}</div>
                      </td>
                      <td className="px-5 py-3">{order.shipment?.carrier || "—"}</td>
                      <td className="px-5 py-3">{order.shipment?.trackingCode || "—"}</td>
                      <td className="px-5 py-3 text-right">{money(order.shipment?.codAmount || order.finalAmount)}</td>
                      <td className="px-5 py-3 text-right">{money(order.shipment?.shippingFee || order.shippingFee)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${tone(order.shipment?.shippingStatus || order.status)}`}>
                          {order.shipment?.shippingStatus || order.status || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
