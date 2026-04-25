"use client";

import dynamic from "next/dynamic";
import AdminShell from "../../components/admin/AdminShell";

const OrdersPageClient = dynamic(
  () => import("../../components/admin/orders/OrdersPageClient"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-500">Đang tải OrdersPageClient...</p>
      </div>
    ),
  }
);

export default function OrdersPage() {
  return (
    <AdminShell title="Đơn hàng">
      <OrdersPageClient />
    </AdminShell>
  );
}