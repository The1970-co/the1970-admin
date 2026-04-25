import PermissionsPageClient from "../../components/admin/permissions/PermissionsPageClient";
import AdminShell from "../../components/admin/AdminShell";
import PagePermissionGuard from "../../components/admin/PagePermissionGuard";

export default function PermissionsPage() {
  return (
    <AdminShell title="Phân quyền">
      <PagePermissionGuard permission="permissions.view">
        <PermissionsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}