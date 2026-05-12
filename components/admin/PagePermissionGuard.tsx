"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUserFromStorage,
  getTokenFromStorage,
  clearCurrentUserFromStorage,
  getCurrentUserPermissions,
} from "@/lib/current-user";

export default function PagePermissionGuard({
  permission,
  children,
}: {
  permission: string;
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

    const permissions = getCurrentUserPermissions(user);

    const allowed =
      permissions.includes("*") ||
      permissions.includes(permission);

    if (!allowed) {
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