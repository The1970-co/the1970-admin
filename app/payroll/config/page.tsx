import AdminShell from "@/components/admin/AdminShell";
import PayrollConfigPageClient from "@/components/admin/payroll/PayrollConfigPageClient";

export default function PayrollConfigPage() {
  return (
    <AdminShell title="Cấu hình lương">
      <PayrollConfigPageClient />
    </AdminShell>
  );
}
