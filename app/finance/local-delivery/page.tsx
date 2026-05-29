import AdminShell from "@/components/admin/AdminShell";
import LocalDeliveryReconciliationPage from "@/components/admin/finance/LocalDeliveryReconciliationPage";

export default function Page() {
  return (
    <AdminShell>
      <div className="p-6">
        <LocalDeliveryReconciliationPage />
      </div>
    </AdminShell>
  );
}