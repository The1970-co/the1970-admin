import AdminShell from "@/components/admin/AdminShell";
import BusinessReportSettings from "@/components/admin/BusinessReportSettings";

export default function Page() {
  return (
    <AdminShell title="Báo cáo & cảnh báo">
      <BusinessReportSettings />
    </AdminShell>
  );
}
