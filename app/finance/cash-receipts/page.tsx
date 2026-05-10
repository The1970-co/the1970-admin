import AdminShell from "@/components/admin/AdminShell";
import CashVoucherPageClient from "@/components/admin/finance/CashVoucherPageClient";

export default function CashReceiptsPage() {
  return (
    <AdminShell>
      <CashVoucherPageClient type="RECEIPT" />
    </AdminShell>
  );
}
