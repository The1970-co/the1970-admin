import AdminShell from "../../../components/admin/AdminShell";
import PagePermissionGuard from "../../../components/admin/PagePermissionGuard";
import StocktakeSessionDetailPageClient from "../../../components/admin/stocktake/StocktakeSessionDetailPageClient";

export default async function StocktakeSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AdminShell>
      <PagePermissionGuard permission="stocktake.view">
        <StocktakeSessionDetailPageClient sessionId={id} />
      </PagePermissionGuard>
    </AdminShell>
  );
}
