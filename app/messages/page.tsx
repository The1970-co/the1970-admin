import AdminShell from "@/components/admin/AdminShell";
import MessagesPageClient from "@/components/admin/messages/MessagesPageClient";

export default function MessagesPage() {
  return (
    <AdminShell title="Omni Inbox">
      <MessagesPageClient />
    </AdminShell>
  );
}