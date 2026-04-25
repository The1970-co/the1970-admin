import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import ShipmentDetailPageClient from "@/components/admin/shipments/ShipmentDetailPageClient";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return (
    <AdminShell title="Phiếu giao hàng">
      <PagePermissionGuard permission="orders.view">
        <ShipmentDetailPageClient shipmentId={resolvedParams.id} />
      </PagePermissionGuard>
    </AdminShell>
  );
}