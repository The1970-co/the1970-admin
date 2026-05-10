import AdminShell from "../../components/admin/AdminShell";
import PagePermissionGuard from "../../components/admin/PagePermissionGuard";
import StocktakeSessionsPageClient from "../../components/admin/stocktake/StocktakeSessionsPageClient";

export default function StocktakeSessionsPage() {
  return (
    <AdminShell>
      <PagePermissionGuard permission="stocktake.view">
        <StocktakeSessionsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}
