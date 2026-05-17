import AdminShell from "@/components/admin/AdminShell";
import PayrollSettingsPageClient from "@/components/admin/payroll/PayrollSettingsPageClient";

export default function PayrollSettingsPage() {
  return (
    <AdminShell title="Cài đặt tự động tính lương">
      <PayrollSettingsPageClient />
    </AdminShell>
  );
}
