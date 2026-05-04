import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import PromotionsPageClient from "@/components/admin/promotions/PromotionsPageClient";

export default function PromotionsPage() {
  return (
    <AdminShell title="Khuyến mại">
      <PagePermissionGuard permission="products.view">
        <PromotionsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}
