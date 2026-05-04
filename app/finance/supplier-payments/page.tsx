import AdminShell from "@/components/admin/AdminShell";
import SupplierPaymentsPageClient from "@/components/admin/finance/SupplierPaymentsPageClient";

export default function SupplierPaymentsPage() {
  return (
    <AdminShell title="Thanh toán nhà cung cấp">
      <SupplierPaymentsPageClient />
    </AdminShell>
  );
}
