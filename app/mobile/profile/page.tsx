"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/admin/auth/AuthProvider";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { API_BASE } from "@/lib/api-base";

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

function getAccountCode(user: any) {
  return user?.email || user?.phone || user?.code || user?.username || "—";
}

function getBranchLabel(user: any, activeBranchId?: string | null) {
  const branchId = activeBranchId || user?.activeBranchId || user?.workingBranchId || user?.branchId || "";

  const option = Array.isArray(user?.branchOptions)
    ? user.branchOptions.find((item: any) => String(item?.branchId || "") === String(branchId))
    : null;

  const roleRow = Array.isArray(user?.branchRoles)
    ? user.branchRoles.find((item: any) => String(item?.branchId || item?.branch?.id || "") === String(branchId))
    : null;

  const permissionRow = Array.isArray(user?.branchPermissions)
    ? user.branchPermissions.find((item: any) => String(item?.branchId || item?.branch?.id || "") === String(branchId))
    : null;

  return (
    option?.branchName ||
    roleRow?.branch?.name ||
    roleRow?.branchName ||
    permissionRow?.branch?.name ||
    permissionRow?.branchName ||
    user?.branchName ||
    user?.branch?.name ||
    branchId ||
    "—"
  );
}

function getRoleLabel(user: any) {
  return user?.roleName || user?.staffRole || user?.role || "—";
}

function shortApiBase() {
  try {
    const url = new URL(API_BASE);
    return url.host;
  } catch {
    return API_BASE || "—";
  }
}

function getAppVersion() {
  return (
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.NEXT_PUBLIC_VERSION ||
    process.env.NEXT_PUBLIC_BUILD_VERSION ||
    "web"
  );
}

function getAppBuild() {
  return (
    process.env.NEXT_PUBLIC_APP_BUILD ||
    process.env.NEXT_PUBLIC_BUILD_NUMBER ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    "—"
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className={["mt-1 font-medium text-stone-900", mono ? "font-mono text-xs break-all" : ""].join(" ")}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function MobileProfilePage() {
  const router = useRouter();
  const { user, activeBranchId, permissions, logout } = useAuth();
  const [deviceInfo, setDeviceInfo] = useState({
    platform: "Web",
    userAgent: "—",
    standalone: "—",
    push: "—",
    scanner: "—",
  });

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any).standalone === true;

    setDeviceInfo({
      platform: isIos ? "iOS / iPhone" : "Web",
      userAgent: ua.replace(/\s+/g, " ").slice(0, 90) || "—",
      standalone: isStandalone ? "App / Standalone" : "Browser / WebView",
      push: "Đã hỗ trợ",
      scanner: isIos ? "Native camera" : "Web fallback",
    });
  }, []);

  const permissionText = useMemo(() => {
    if (permissions?.includes("*")) return "Toàn quyền";
    return `${permissions?.length || 0} quyền`;
  }, [permissions]);

  const branchLabel = useMemo(
    () => getBranchLabel(user, activeBranchId),
    [user, activeBranchId],
  );

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
          Thông tin đăng nhập, phiên làm việc và trạng thái app mobile.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Phiên</p>
            <p className="mt-1 text-sm font-semibold text-white">Đang hoạt động</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Nền tảng</p>
            <p className="mt-1 text-sm font-semibold text-white">{deviceInfo.platform}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-stone-400">Người dùng</p>
        <div className="space-y-4 text-sm">
          <InfoRow label="Tên" value={getDisplayName(user)} />
          <InfoRow label="Tài khoản" value={getAccountCode(user)} />
          <InfoRow label="Chi nhánh hiện tại" value={branchLabel} />
          <InfoRow label="Vai trò" value={getRoleLabel(user)} />
          <InfoRow label="Quyền" value={permissionText} />
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-stone-400">Ứng dụng</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Phiên bản" value={getAppVersion()} />
          <InfoRow label="Build" value={getAppBuild()} />
          <InfoRow label="Chế độ" value={process.env.NODE_ENV || "production"} />
          <InfoRow label="Kiểu chạy" value={deviceInfo.standalone} />
          <InfoRow label="Push" value={deviceInfo.push} />
          <InfoRow label="Quét mã" value={deviceInfo.scanner} />
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-stone-400">Hệ thống</p>
        <div className="space-y-4 text-sm">
          <InfoRow label="API" value={shortApiBase()} mono />
          <InfoRow label="Thiết bị" value={deviceInfo.userAgent} mono />
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
