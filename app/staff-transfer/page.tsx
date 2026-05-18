import AdminShell from "@/components/admin/AdminShell";
import StaffTransferPageClient from "@/components/admin/staff/StaffTransferPageClient";

export default function StaffTransferPage() {
  return (
    <AdminShell title="Chuyển chi nhánh nhân viên">
      <StaffTransferPageClient />
    </AdminShell>
  );
}
