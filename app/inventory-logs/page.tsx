export const dynamic = "force-dynamic";

import { Suspense } from "react";
import InventoryLogsPageClient from "@/components/admin/inventory/InventoryLogsPageClient";
import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";

export default function InventoryLogsPage() {
  return (
    <AdminShell title="Lịch sử kho">
      <Suspense fallback={<div className="p-6">Đang tải lịch sử kho...</div>}>
        <PagePermissionGuard permission="inventory.logs.view">
          <InventoryLogsPageClient />
        </PagePermissionGuard>
      </Suspense>
    </AdminShell>
  );
}