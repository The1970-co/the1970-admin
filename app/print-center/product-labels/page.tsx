import AdminShell from "@/components/admin/AdminShell";
import ProductLabelsPrintCenterClient from "@/components/admin/print-center/ProductLabelsPrintCenterClient";

export default function ProductLabelsPrintCenterPage() {
  return (
    <AdminShell title="In tem sản phẩm">
      <ProductLabelsPrintCenterClient />
    </AdminShell>
  );
}
