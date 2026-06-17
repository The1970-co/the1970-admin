"use client";

import { apiJson } from "@/lib/api";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Box,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Shirt,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";

type AnyRow = Record<string, any>;

type OrderDetail = {
  id?: string;
  orderCode?: string;
  code?: string;
  createdAt?: string | null;
  soldAt?: string | null;
  updatedAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingRecipientName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingWard?: string | null;
  shippingDistrict?: string | null;
  shippingProvince?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  salesChannel?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  createdByStaffName?: string | null;
  assignedStaffName?: string | null;
  finalAmount?: number | string | null;
  totalAmount?: number | string | null;
  discountAmount?: number | string | null;
  shippingFee?: number | string | null;
  note?: string | null;
  items?: AnyRow[];
  shipment?: AnyRow | null;
  payments?: AnyRow[];
  partialDeliveries?: AnyRow[];
  customer?: AnyRow | null;
};

async function getJson<T>(path: string): Promise<T> {
  return apiJson<T>(path, {
    redirectOnUnauthorized: true,
    timeoutMs: 20000,
  } as any);
}

function num(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(num(value)))}đ`;
}

function dt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalize(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function statusLabel(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "DRAFT") return "Nháp";
  if (s === "PENDING" || s === "PENDING_APPROVAL") return "Chờ duyệt";
  if (s === "APPROVED") return "Đã duyệt";
  if (s === "PACKING") return "Đang đóng gói";
  if (s === "SHIPPED") return "Đã gửi hàng";
  if (s === "COMPLETED") return "Hoàn tất";
  if (s === "CANCELLED") return "Đã huỷ";
  return s;
}

function paymentLabel(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "PAID") return "Đã thanh toán";
  if (s === "PARTIAL") return "Thanh toán 1 phần";
  if (s === "PENDING_COD") return "Chờ COD";
  if (s === "UNPAID") return "Chưa thanh toán";
  return s;
}

function fulfillmentLabel(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "UNFULFILLED") return "Chưa xử lý";
  if (s === "PROCESSING") return "Đang xử lý";
  if (s === "FULFILLED") return "Đã giao";
  if (s === "PARTIAL") return "Giao 1 phần";
  if (s === "CANCELLED") return "Đã huỷ";
  return s;
}

function shipmentStatusText(value?: string | null) {
  const s = normalize(value);
  if (!s) return "—";
  if (s.includes("DELIVERED") || s.includes("COMPLETED") || s.includes("SUCCESS")) return "Giao thành công";
  if (s.includes("DELIVERING") || s.includes("IN_PROCESS")) return "Đang giao";
  if (s.includes("PICKING") || s.includes("ACCEPTED")) return "Đang lấy hàng";
  if (s.includes("CREATED") || s.includes("ASSIGNING") || s.includes("IDLE")) return "Chờ lấy hàng";
  if (s.includes("CANCEL")) return "Đã huỷ vận đơn";
  if (s.includes("FAIL")) return "Giao thất bại";
  if (s.includes("RETURN")) return "Đang hoàn hàng";
  return s;
}

function getOrderCode(order?: OrderDetail | null) {
  return String(order?.orderCode || order?.code || order?.id || "—");
}

function customerName(order?: OrderDetail | null) {
  return order?.shippingRecipientName || order?.customerName || order?.customer?.fullName || "Khách lẻ";
}

function customerPhone(order?: OrderDetail | null) {
  return order?.shippingPhone || order?.customerPhone || order?.customer?.phone || "—";
}

function address(order?: OrderDetail | null) {
  const parts = [
    order?.shippingAddressLine1,
    order?.shippingAddressLine2,
    order?.shippingWard,
    order?.shippingDistrict,
    order?.shippingProvince,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function lineQty(item: AnyRow) {
  return num(item.qty ?? item.quantity ?? item.orderedQty ?? 0);
}

function linePrice(item: AnyRow) {
  return num(item.unitPrice ?? item.price ?? item.salePrice ?? 0);
}

function lineTotal(item: AnyRow) {
  const explicit = num(item.lineTotal ?? item.total ?? item.finalLineTotal ?? 0);
  return explicit || lineQty(item) * linePrice(item);
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-neutral-50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-700 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{label}</div>
        <div className="mt-1 break-words text-sm font-bold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

export default function MobileOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError("");
      const data = await getJson<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
      setOrder(data);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : "Không tải được chi tiết đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);
  const payments = useMemo(() => (Array.isArray(order?.payments) ? order.payments : []), [order]);
  const shipment = order?.shipment || null;
  const paidAmount = payments.reduce((sum, payment) => {
    const status = normalize(payment?.status);
    const sourceType = normalize(payment?.paymentSource?.type || payment?.sourceType);
    if (sourceType === "COD" || status === "PENDING_COD") return sum;
    if (status !== "PAID" && status !== "PARTIAL") return sum;
    return sum + num(payment?.amount);
  }, 0);
  const finalAmount = num(order?.finalAmount ?? order?.totalAmount);
  const codAmount = Math.max(0, finalAmount - paidAmount);

  return (
    <main className="min-h-[100dvh] bg-neutral-100 px-4 pb-28 pt-4 text-neutral-950">
      <section className="rounded-[2rem] bg-neutral-950 p-5 text-white shadow-xl shadow-neutral-300">
        <div className="flex items-center justify-between gap-3">
          <Link href="/mobile/orders" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={() => void fetchOrder()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/50">Chi tiết đơn hàng</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">{loading ? "Đang tải..." : getOrderCode(order)}</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">{customerName(order)} · {customerPhone(order)}</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <WalletCards className="h-4 w-4 text-white/60" />
            <div className="mt-2 text-lg font-black">{money(finalAmount)}</div>
            <div className="text-[11px] text-white/50">Tổng tiền</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <Banknote className="h-4 w-4 text-white/60" />
            <div className="mt-2 text-lg font-black">{money(codAmount)}</div>
            <div className="text-[11px] text-white/50">Cần thu</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <Box className="h-4 w-4 text-white/60" />
            <div className="mt-2 text-lg font-black">{items.length}</div>
            <div className="text-[11px] text-white/50">Sản phẩm</div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="mt-4 rounded-[1.75rem] bg-white p-6 text-center text-sm font-semibold text-neutral-500 shadow-sm">
          Đang tải chi tiết đơn hàng...
        </section>
      ) : error ? (
        <section className="mt-4 rounded-[1.75rem] border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </section>
      ) : order ? (
        <>
          <section className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[1.25rem] bg-white p-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Trạng thái</div>
              <div className="mt-1 text-sm font-black text-neutral-900">{statusLabel(order.status)}</div>
            </div>
            <div className="rounded-[1.25rem] bg-white p-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Thanh toán</div>
              <div className="mt-1 text-sm font-black text-neutral-900">{paymentLabel(order.paymentStatus)}</div>
            </div>
            <div className="rounded-[1.25rem] bg-white p-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Giao vận</div>
              <div className="mt-1 text-sm font-black text-neutral-900">{fulfillmentLabel(order.fulfillmentStatus)}</div>
            </div>
            <div className="rounded-[1.25rem] bg-white p-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Ngày tạo</div>
              <div className="mt-1 text-sm font-black text-neutral-900">{dt(order.createdAt || order.soldAt)}</div>
            </div>
          </section>

          <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-base font-black text-neutral-950">Khách hàng</div>
            <div className="space-y-2">
              <InfoRow icon={<UserRound className="h-4 w-4" />} label="Tên khách" value={customerName(order)} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Số điện thoại" value={customerPhone(order)} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Địa chỉ" value={address(order)} />
            </div>
          </section>

          <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-base font-black text-neutral-950">Vận chuyển</div>
              <Truck className="h-5 w-5 text-neutral-400" />
            </div>
            <div className="space-y-2 text-sm">
              <InfoRow icon={<Truck className="h-4 w-4" />} label="Hãng / mã vận đơn" value={[shipment?.carrier, shipment?.trackingCode || shipment?.ahamoveOrderId].filter(Boolean).join(" · ") || "Chưa tạo vận đơn"} />
              <InfoRow icon={<PackageCheck className="h-4 w-4" />} label="Trạng thái vận đơn" value={shipmentStatusText(shipment?.shippingStatus || shipment?.partnerStatus || shipment?.ahamoveStatus)} />
              <InfoRow icon={<Banknote className="h-4 w-4" />} label="Phí ship / COD" value={`${money(shipment?.shippingFee ?? order.shippingFee)} · COD ${money(shipment?.codAmount ?? codAmount)}`} />
            </div>
          </section>

          <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-base font-black text-neutral-950">Sản phẩm</div>
            {items.length ? (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id || `${item.sku}-${index}`} className="rounded-2xl bg-neutral-50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-500 shadow-sm">
                        <Shirt className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-black text-neutral-900">
                          {item.productName || item.name || item.sku || "Sản phẩm"}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-neutral-500">
                          {[item.sku, item.color, item.size].filter(Boolean).join(" · ") || "—"}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold text-neutral-500">SL {lineQty(item)}</span>
                          <span className="font-black text-neutral-950">{money(lineTotal(item))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-neutral-50 p-4 text-center text-sm font-semibold text-neutral-500">
                Chưa có dòng sản phẩm.
              </div>
            )}
          </section>

          <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-base font-black text-neutral-950">Thanh toán</div>
            {payments.length ? (
              <div className="space-y-2">
                {payments.map((payment, index) => (
                  <div key={payment.id || index} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-neutral-900">
                        {payment.paymentSource?.name || payment.method || payment.paymentSource?.code || "Nguồn tiền"}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-neutral-500">{paymentLabel(payment.status)}</div>
                    </div>
                    <div className="shrink-0 text-sm font-black text-neutral-950">{money(payment.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-neutral-50 p-4 text-center text-sm font-semibold text-neutral-500">
                Chưa có dòng thanh toán.
              </div>
            )}
          </section>

          {order.note ? (
            <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Ghi chú</div>
              <div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-neutral-800">{order.note}</div>
            </section>
          ) : null}
        </>
      ) : null}

      <MobileBottomNav />
    </main>
  );
}
