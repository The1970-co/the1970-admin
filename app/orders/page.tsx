export const dynamic = "force-dynamic";

import { Suspense } from "react";
import AdminShell from "../../components/admin/AdminShell";
import OrdersPageClient from "../../components/admin/orders/OrdersPageClient";

export default function OrdersPage() {
  return (
    <AdminShell title="Đơn hàng">
      <Suspense fallback={<div className="p-6">Đang tải đơn hàng...</div>}>
        <OrdersPageClient />
      </Suspense>
    </AdminShell>
  );
}