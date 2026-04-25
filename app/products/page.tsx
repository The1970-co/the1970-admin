import ProductsPageClient from "@/components/admin/products/ProductsPageClient";
import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";

export default function ProductsPage() {
  return (
    <AdminShell title="Sản phẩm">
      <PagePermissionGuard permission="products.view">
        <ProductsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}