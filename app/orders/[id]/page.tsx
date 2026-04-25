import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import OrderDetailPageClient from "@/components/admin/orders/OrderDetailPageClient";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    created?: string;
    tracking?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <AdminShell title="Chi tiết đơn hàng">
      <PagePermissionGuard permission="orders.view">
        <OrderDetailPageClient
          orderId={resolvedParams.id}
          created={resolvedSearchParams?.created === "1"}
          tracking={resolvedSearchParams?.tracking || ""}
        />
      </PagePermissionGuard>
    </AdminShell>
  );
}