import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import DashboardPage from "@/components/admin/DashboardPage";

export default function ControlPage() {
  return (
    <PagePermissionGuard permission="dashboard.view">
      <DashboardPage />
    </PagePermissionGuard>
  );
}