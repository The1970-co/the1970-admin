import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import WebsiteProductsPageClient from "@/components/admin/website/WebsiteProductsPageClient";

export default function WebsiteProductsPage() {
  return (
    <AdminShell title="Sản phẩm website">
      <PagePermissionGuard permission="website.view">
        <WebsiteProductsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}
