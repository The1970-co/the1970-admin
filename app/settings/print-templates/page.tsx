import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import PrintTemplatesPageClient from "@/components/admin/settings/PrintTemplatesPageClient";

export default function PrintTemplatesPage() {
  return (
    <AdminShell title="Mẫu in">
      <PagePermissionGuard permission="system.manage">
        <PrintTemplatesPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}