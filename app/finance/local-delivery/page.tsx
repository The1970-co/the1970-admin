import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import LocalDeliveryReconciliationPage from "@/components/admin/finance/LocalDeliveryReconciliationPage";

export default function FinanceLocalDeliveryPage() {
  return (
    <AdminShell title="Đối soát nội thành">
      <PagePermissionGuard permission="reports.view">
        <LocalDeliveryReconciliationPage />
      </PagePermissionGuard>
    </AdminShell>
  );
}
