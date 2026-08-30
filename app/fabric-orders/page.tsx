import AdminShell from "@/components/admin/AdminShell";
import FabricOrdersPageClient from "@/components/admin/sample-fabric/FabricOrdersPageClient";

export default function Page() {
  return (
    <AdminShell title="Lệnh đặt vải">
      <FabricOrdersPageClient />
    </AdminShell>
  );
}
