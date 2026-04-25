"use client";

import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import SettingsPage from "@/components/admin/SettingsPage";

export default function SettingsRoute() {
  return (
    <AdminShell title="Cấu hình">
      <PagePermissionGuard permission="system.manage">
        <SettingsPage />
      </PagePermissionGuard>
    </AdminShell>
  );
}