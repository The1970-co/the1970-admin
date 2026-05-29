"use client";

import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import GhnCodReconciliationHistoryDetailPageClient from "@/components/admin/finance/GhnCodReconciliationHistoryDetailPageClient";

export default function Page() {
  const params = useParams<{ batchId: string }>();
  const batchId = String(params?.batchId || "");

  return (
    <AdminShell>
      <GhnCodReconciliationHistoryDetailPageClient batchId={batchId} />
    </AdminShell>
  );
}
