"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/admin/auth/AuthProvider";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

function getDisplayName(user: any) {
  return (
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.username ||
    user?.email ||
    "Tài khoản mobile"
  );
}

export default function MobileProfilePage() {
  const router = useRouter();
  const { user, activeBranchId, permissions, logout } = useAuth();

  return (
    <main className="min-h-[100dvh] bg-stone-100 px-4 py-4 pb-[calc(112px+env(safe-area-inset-bottom))]">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.replace("/mobile")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-900 shadow-sm active:scale-[0.98]"
          aria-label="Quay lại"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Mobile</p>
          <h1 className="text-lg font-semibold text-stone-950">Tài khoản</h1>
        </div>
      </div>

      <section className="rounded-3xl bg-neutral-950 p-5 text-white shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Tài khoản</p>
        <h2 className="mt-2 text-2xl font-semibold">Tôi</h2>
        <p className="mt-2 text-sm text-stone-300">
          Thông tin đăng nhập và phiên làm việc trên mobile.
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Tên</p>
            <p className="mt-1 font-semibold text-stone-900">{getDisplayName(user)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Tài khoản</p>
            <p className="mt-1 font-medium text-stone-900">
              {user?.email || user?.phone || user?.code || user?.username || "—"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Chi nhánh hiện tại</p>
            <p className="mt-1 font-medium text-stone-900">
              {activeBranchId || user?.branchId || user?.branch?.name || "—"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Vai trò</p>
            <p className="mt-1 font-medium text-stone-900">
              {user?.role || user?.roleName || user?.staffRole || "—"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Quyền</p>
            <p className="mt-1 font-medium text-stone-900">
              {permissions?.includes("*") ? "Toàn quyền" : `${permissions?.length || 0} quyền`}
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void logout()}
        className="mt-4 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
      >
        Đăng xuất
      </button>

      <MobileBottomNav />
    </main>
  );
}
