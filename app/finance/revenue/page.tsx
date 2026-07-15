import AdminShell from "@/components/admin/AdminShell";
import ReportsPage from "@/components/admin/reports/ReportsPage";

export default function FinanceRevenueReportPage() {
  return (
    <AdminShell title="Báo cáo tài chính">
      <ReportsPage />
    </AdminShell>
  );
}