import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import WarehouseMapPageClient from "@/components/admin/WarehouseMapPageClient";

export default function WarehouseMapPage() {
  return (
    <PagePermissionGuard permission="inventory.view">
      <WarehouseMapPageClient />
    </PagePermissionGuard>
  );
}