import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import PosPageClient from "@/components/admin/PosPageClient";

export default function PosPage() {
  return (
    <AdminShell>
      <PagePermissionGuard permission="orders.create">
        <PosPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}