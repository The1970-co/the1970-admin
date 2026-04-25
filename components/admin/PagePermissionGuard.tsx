"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasPermission, type PermissionKey } from "@/lib/authz";
import {
  getCurrentUserFromStorage,
  getTokenFromStorage,
  clearCurrentUserFromStorage,
} from "@/lib/current-user";

export default function PagePermissionGuard({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const token = getTokenFromStorage();
    const user = getCurrentUserFromStorage();

    if (!token || !user) {
      clearCurrentUserFromStorage();
      router.replace("/login");
      return;
    }

    const normalizedRole = String(user?.role || "").toLowerCase();

    if (!hasPermission(normalizedRole as any, permission)) {
      router.replace("/control");
      return;
    }

    if (!cancelled) {
      setReady(true);
    }

    return () => {
      cancelled = true;
    };
  }, [permission, router]);

  if (!ready) {
    return <div style={{ padding: 40 }}>Đang kiểm tra quyền truy cập...</div>;
  }

  return <>{children}</>;
}