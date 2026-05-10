import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";

export default function PrintCenterPage() {
  return (
    <AdminShell title="Trung tâm in ấn">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-neutral-500">THE 1970 Operation</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">Trung tâm in ấn</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Trung tâm quản lý in tem sản phẩm, phiếu giao hàng, phiếu bán hàng và các mẫu in sau này.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/print-center/product-labels"
            className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-medium text-neutral-500">50×50 / tem cuộn</div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">In tem sản phẩm</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Chọn SKU, số lượng tem, khoảng hở, scale, field hiển thị và preview trước khi in.
            </p>
          </Link>

          <Link
            href="/print-center/templates"
            className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-medium text-neutral-500">Template Engine</div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">Mẫu in / cấu hình</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Dùng chung đúng màn Mẫu in trong Cài đặt để tránh lệch dữ liệu template.
            </p>
          </Link>

          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white/70 p-6">
            <div className="text-sm font-medium text-neutral-500">Coming soon</div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">Phiếu giao hàng / bán hàng</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Sau khi ổn định tem sản phẩm, các mẫu phiếu sẽ gom dần về trung tâm này.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
