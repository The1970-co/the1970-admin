import AdminShell from "@/components/admin/AdminShell";
import PayrollPeriodDetailPageClient from "@/components/admin/payroll/PayrollPeriodDetailPageClient";

export default async function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Chi tiết kỳ lương">
      <PayrollPeriodDetailPageClient periodId={id} />
    </AdminShell>
  );
}
