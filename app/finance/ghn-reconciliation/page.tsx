"use client";

import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import GhnCodReconciliationPage from "@/components/admin/finance/GhnCodReconciliationPage";

export default function Page() {
  return (
    <AdminShell title="Đối soát COD GHN">
      <PagePermissionGuard permission="reports.view">
        <GhnCodReconciliationPage />
      </PagePermissionGuard>
    </AdminShell>
  );
}