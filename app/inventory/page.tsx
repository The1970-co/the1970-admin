import InventoryPageClient from "../../components/admin/inventory/InventoryPageClient";
import AdminShell from "../../components/admin/AdminShell";
import PagePermissionGuard from "../../components/admin/PagePermissionGuard";
import InventoryActionCenter from "@/components/admin/inventory/InventoryActionCenter";
export default function InventoryPage() {
  return (
    <AdminShell title="Kho hàng">
      <PagePermissionGuard permission="inventory.view">
        <InventoryPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}