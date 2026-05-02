import AdminShell from "@/components/admin/AdminShell";
import ProductDetailPageClient from "@/components/admin/products/ProductDetailPageClient";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const productId = decodeURIComponent(resolvedParams.id);

  return (
    <AdminShell title="Chi tiết sản phẩm">
      <ProductDetailPageClient productId={productId} />
    </AdminShell>
  );
}
