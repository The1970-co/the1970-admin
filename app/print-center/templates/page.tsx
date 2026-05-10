import AdminShell from "@/components/admin/AdminShell";
import PrintTemplatesCenterClient from "@/components/admin/print-center/PrintTemplatesCenterClient";

export default function PrintTemplatesCenterPage() {
  return (
    <AdminShell title="Mẫu in / cấu hình">
      <PrintTemplatesCenterClient />
    </AdminShell>
  );
}
