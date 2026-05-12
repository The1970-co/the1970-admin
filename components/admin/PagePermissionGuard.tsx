"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUserFromStorage,
  getTokenFromStorage,
  clearCurrentUserFromStorage,
  getCurrentUserPermissions,
} from "@/lib/current-user";

export default function PagePermissionGuard({
  permission,
  permissions,
  fallbackPath = "/control",
  children,
}: {
  permission?: string;
  permissions?: string[];
  fallbackPath?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const requiredPermissions = useMemo(() => {
    return Array.from(
      new Set([...(permissions || []), permission].filter(Boolean) as string[]),
    );
  }, [permission, permissions]);

  useEffect(() => {
    let cancelled = false;

    const token = getTokenFromStorage();
    const user = getCurrentUserFromStorage();

    if (!token || !user) {
      clearCurrentUserFromStorage();
      router.replace("/login");
      return;
    }

    const userPermissions = getCurrentUserPermissions(user);

    const allowed =
      userPermissions.includes("*") ||
      requiredPermissions.length === 0 ||
      requiredPermissions.some((key) =>
        userPermissions.includes(key),
      );

    if (!allowed) {
      router.replace(fallbackPath);
      return;
    }

    if (!cancelled) {
      setReady(true);
    }

    return () => {
      cancelled = true;
    };
  }, [requiredPermissions, fallbackPath, router]);

  if (!ready) {
    return <div style={{ padding: 40 }}>Đang kiểm tra quyền truy cập...</div>;
  }

  return <>{children}</>;
}