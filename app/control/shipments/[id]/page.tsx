import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import ShipmentDetailPageClient from "@/components/admin/shipments/ShipmentDetailPageClient";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  return (
    <PagePermissionGuard permission="orders.view">
      <ShipmentDetailPageClient shipmentId={resolvedParams.id} />
    </PagePermissionGuard>
  );
}