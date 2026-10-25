import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import WebsiteNavigationPageClient from "@/components/admin/website/WebsiteNavigationPageClient";

export default function WebsiteNavigationPage() {
  return (
    <AdminShell title="Menu website">
      <PagePermissionGuard permission="website.view">
        <WebsiteNavigationPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}
