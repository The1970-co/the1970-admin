import PartialDeliveryDetailPageClient from "@/components/admin/orders/PartialDeliveryDetailPageClient";

export default async function PartialDeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string; partialDeliveryId: string }>;
}) {
  const { id, partialDeliveryId } = await params;

  return (
    <PartialDeliveryDetailPageClient
      orderId={id}
      partialDeliveryId={partialDeliveryId}
    />
  );
}
