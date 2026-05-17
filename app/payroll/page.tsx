import AdminShell from "@/components/admin/AdminShell";
import PayrollPageClient from "@/components/admin/payroll/PayrollPageClient";

export default function PayrollPage() {
  return (
    <AdminShell title="Sổ lương">
      <PayrollPageClient />
    </AdminShell>
  );
}
