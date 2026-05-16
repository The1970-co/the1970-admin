import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import ReturnCreatePageClient from "@/components/admin/returns/ReturnCreatePageClient";

export default async function ReturnCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;

  return (
    <AdminShell title="Tạo phiếu đổi trả">
      <PagePermissionGuard permission="returns.create" fallbackPath="/returns">
        <ReturnCreatePageClient orderId={sp?.orderId || ""} />
      </PagePermissionGuard>
    </AdminShell>
  );
}
