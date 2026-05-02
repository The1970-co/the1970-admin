export const dynamic = "force-dynamic";

import { Suspense } from "react";
import InventoryPageClient from "../../components/admin/inventory/InventoryPageClient";
import AdminShell from "../../components/admin/AdminShell";
import PagePermissionGuard from "../../components/admin/PagePermissionGuard";

export default function InventoryPage() {
  return (
    <AdminShell title="Kho hàng">
      <Suspense fallback={<div className="p-6">Đang tải kho hàng...</div>}>
        <PagePermissionGuard permission="inventory.view">
          <InventoryPageClient />
        </PagePermissionGuard>
      </Suspense>
    </AdminShell>
  );
}