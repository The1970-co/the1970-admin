import InventoryLogsPageClient from "@/components/admin/inventory/InventoryLogsPageClient";
import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";

export default function InventoryLogsPage() {
  return (
    <AdminShell title="Lịch sử kho">
      <PagePermissionGuard permission="inventory.logs.view">
        <InventoryLogsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}