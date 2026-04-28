"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type Shipment = {
  carrier: string | null;
  trackingCode: string | null;
  shippingStatus: string | null;
  partnerStatus: string | null;
  codAmount: number | null;
  shippingFee: number | null;
};

type OrderDetail = {
  id: string;
  orderCode: string;
  customerName: string | null;
  customerPhone: string | null;
  branchId: string | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  finalAmount: number;
  note: string | null;
  createdAt: string;

  shippingRecipientName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingWard: string | null;
  shippingDistrict: string | null;
  shippingProvince: string | null;

  items: OrderItem[];
  shipment: Shipment | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "${API_BASE}";

function money(v: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN").format(Number(v || 0));
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

function paymentLabel(status: string) {
  const map: Record<string, string> = {
    UNPAID: "Chưa thanh toán",
    PARTIAL: "Thanh toán một phần",
    PAID: "Đã thanh toán",
    PENDING_COD: "Chờ COD",
    REFUNDED: "Đã hoàn tiền",
    FAILED: "Thất bại",
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
    throw new Error(text || "Không tải được chi tiết đơn");
  }

  return res.json();
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-3 last:border-b-0">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="max-w-[65%] text-right text-sm font-medium text-neutral-950">
        {value || "-"}
      </div>
    </div>
  );
}

export default function MobileOrderDetailPage() {
  const params = useParams();
  const id = String(params.id || "");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrder() {
    try {
      setLoading(true);
      setError("");

      const data = await fetchWithAuth<OrderDetail | null>(
        `/mobile/operations/orders/${id}`
      );

      if (!data) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) void loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const address = order
    ? [
        order.shippingAddressLine1,
        order.shippingWard,
        order.shippingDistrict,
        order.shippingProvince,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto min-h-screen w-full max-w-md bg-neutral-100 px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-neutral-500">Chi tiết đơn hàng</div>
            <h1 className="text-xl font-bold text-neutral-950">
              {order?.orderCode || "Đang tải..."}
            </h1>
          </div>

          <Link
            href="/mobile/orders"
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm"
          >
            Quay lại
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : order ? (
          <div className="space-y-4">
            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-500">Trạng thái</div>
                  <div className="mt-1 text-2xl font-bold text-neutral-950">
                    {statusLabel(order.status)}
                  </div>
                </div>

                <div className="rounded-2xl bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-800">
                  {paymentLabel(order.paymentStatus)}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <div className="text-sm text-neutral-500">Tổng tiền</div>
                  <div className="mt-1 text-xl font-bold text-neutral-950">
                    {money(order.finalAmount)}
                  </div>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-3">
                  <div className="text-sm text-neutral-500">Chi nhánh</div>
                  <div className="mt-1 text-xl font-bold text-neutral-950">
                    {order.branchId || "ALL"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-neutral-950">
                Khách hàng
              </h2>

              <InfoRow label="Tên khách" value={order.customerName || "Khách lẻ"} />
              <InfoRow label="SĐT" value={order.customerPhone} />
              <InfoRow label="Người nhận" value={order.shippingRecipientName} />
              <InfoRow label="SĐT nhận" value={order.shippingPhone} />
              <InfoRow label="Địa chỉ" value={address} />
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-neutral-950">
                Sản phẩm
              </h2>

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3"
                  >
                    <div className="font-semibold text-neutral-950">
                      {item.productName}
                    </div>

                    <div className="mt-1 text-sm text-neutral-500">
                      {item.sku} · {item.color || "-"} / {item.size || "-"}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div className="text-neutral-500">SL: {item.qty}</div>
                      <div className="font-bold text-neutral-950">
                        {money(item.lineTotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-neutral-950">
                Thanh toán
              </h2>

              <InfoRow label="Tiền hàng" value={money(order.totalAmount)} />
              <InfoRow label="Giảm giá" value={money(order.discountAmount)} />
              <InfoRow label="Phí ship" value={money(order.shippingFee)} />
              <InfoRow label="Tổng cuối" value={money(order.finalAmount)} />
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-neutral-950">
                Vận chuyển
              </h2>

              {order.shipment ? (
                <>
                  <InfoRow label="Hãng" value={order.shipment.carrier} />
                  <InfoRow label="Mã vận đơn" value={order.shipment.trackingCode} />
                  <InfoRow label="Trạng thái" value={order.shipment.shippingStatus} />
                  <InfoRow label="COD" value={money(order.shipment.codAmount)} />
                  <InfoRow label="Phí ship" value={money(order.shipment.shippingFee)} />
                </>
              ) : (
                <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                  Chưa có vận đơn.
                </div>
              )}
            </section>

            {order.note ? (
              <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-neutral-950">
                  Ghi chú
                </h2>
                <div className="text-sm text-neutral-700">{order.note}</div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
