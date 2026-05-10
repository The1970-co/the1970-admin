import AdminShell from "@/components/admin/AdminShell";
import CashVoucherPageClient from "@/components/admin/finance/CashVoucherPageClient";

export default function CashPaymentsPage() {
  return (
    <AdminShell>
      <CashVoucherPageClient type="PAYMENT" />
    </AdminShell>
  );
}
