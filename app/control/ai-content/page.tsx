import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import AIContentPage from "@/components/admin/AIContentPage";

export default function AIContentRoute() {
  return (
    <PagePermissionGuard permission="ai_content.view">
      <AIContentPage />
    </PagePermissionGuard>
  );
}