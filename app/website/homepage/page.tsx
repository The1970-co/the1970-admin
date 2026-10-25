import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import WebsiteHomepagePageClient from "@/components/admin/website/WebsiteHomepagePageClient";

export default function WebsiteHomepagePage() {
  return (
    <AdminShell title="Trang chủ website">
      <PagePermissionGuard permission="website.view">
        <WebsiteHomepagePageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}
