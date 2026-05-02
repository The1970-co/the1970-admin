export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PermissionsPageClient from "../../components/admin/permissions/PermissionsPageClient";
import AdminShell from "../../components/admin/AdminShell";
import PagePermissionGuard from "../../components/admin/PagePermissionGuard";

export default function PermissionsPage() {
  return (
    <AdminShell title="Phân quyền">
      <Suspense fallback={<div className="p-6">Đang tải phân quyền...</div>}>
        <PagePermissionGuard permission="permissions.view">
          <PermissionsPageClient />
        </PagePermissionGuard>
      </Suspense>
    </AdminShell>
  );
}