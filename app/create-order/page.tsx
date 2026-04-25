import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import CreateOrderPageClient from "@/components/admin/create-order/CreateOrderPageClient";

export default function CreateOrderPage() {
  return (
    <AdminShell>
      <PagePermissionGuard permission="orders.create">
        <CreateOrderPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}