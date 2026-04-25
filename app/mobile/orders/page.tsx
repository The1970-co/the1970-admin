"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MobileOrder = {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  branchId: string | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  finalAmount: number;
  createdAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function money(v: number) {
  return new Intl.NumberFormat("vi-VN").format(v || 0);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    NEW: "Mới",
    APPROVED: "Đã duyệt",
    PACKING: "Đóng gói",
    SHIPPED: "Đang giao",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã huỷ",
  };

  return map[status] || status;
}

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/mobile/login";
    throw new Error("Thiếu token");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/mobile/login";
    throw new Error("Phiên đăng nhập hết hạn");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Không tải được đơn hàng");
  }

  return res.json();
}

export default function MobileOrdersPage() {
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders(nextStatus = status) {
    try {
      setLoading(true);
      setError("");

      const data = await fetchWithAuth<MobileOrder[]>(
        `/mobile/operations/orders?status=${encodeURIComponent(nextStatus)}`
      );

      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      return (
        o.orderCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [orders, query]);

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto min-h-screen w-full max-w-md bg-neutral-100 px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-neutral-500">The 1970 Operations</div>
            <h1 className="text-xl font-bold text-neutral-950">Đơn hàng</h1>
          </div>

          <Link
            href="/mobile/home"
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm"
          >
            Home
          </Link>
        </div>

        <div className="mb-4 space-y-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="NEW">Mới</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PACKING">Đóng gói</option>
            <option value="SHIPPED">Đang giao</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã huỷ</option>
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã đơn, khách, số điện thoại..."
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
          />

          <div className="text-sm text-neutral-500">
            Tổng:{" "}
            <span className="font-semibold text-neutral-950">
              {filteredOrders.length}
            </span>{" "}
            đơn
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
            Không có đơn hàng.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                href={`/mobile/orders/${order.id}`}
                className="block rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-neutral-950">
                      {order.orderCode}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {order.customerName}
                    </div>
                    {order.customerPhone ? (
                      <div className="mt-1 text-sm text-neutral-500">
                        {order.customerPhone}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      {statusLabel(order.status)}
                    </div>
                    <div className="mt-2 text-sm font-bold text-neutral-950">
                      {money(order.finalAmount)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <div className="text-neutral-500">Thanh toán</div>
                    <div className="mt-1 font-medium text-neutral-950">
                      {order.paymentStatus}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <div className="text-neutral-500">Chi nhánh</div>
                    <div className="mt-1 font-medium text-neutral-950">
                      {order.branchId || "ALL"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}