import StocktakePageClient from "../../components/admin/stocktake/StocktakePageClient";
import AdminShell from "../../components/admin/AdminShell";
import PagePermissionGuard from "../../components/admin/PagePermissionGuard";

export default function StocktakePage() {
  return (
    <AdminShell>
      <PagePermissionGuard permission="stocktake.view">
        <StocktakePageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}