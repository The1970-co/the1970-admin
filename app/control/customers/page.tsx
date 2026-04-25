import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import CustomersPageClient from "@/components/admin/customers/CustomersPageClient";

export default function CustomersPage() {
  return (
    <PagePermissionGuard permission="customers.view">
      <CustomersPageClient />
    </PagePermissionGuard>
  );
}