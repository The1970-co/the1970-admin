import AdminShell from "@/components/admin/AdminShell";
import SampleFabricWorkspaceClient from "@/components/admin/sample-fabric/SampleFabricWorkspaceClient";

export default function MeasurementLibraryPage() {
  return (
    <AdminShell title="Thư viện bảng thông số">
      <SampleFabricWorkspaceClient defaultSection="measurements" />
    </AdminShell>
  );
}
