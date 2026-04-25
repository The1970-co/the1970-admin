import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import FinanceDailyPageClient from "@/components/admin/finance/FinanceDailyPageClient";

export default function FinanceDailyPage() {
  return (
    <AdminShell title="Đối soát">
      <PagePermissionGuard permission="reports.view">
        <FinanceDailyPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}