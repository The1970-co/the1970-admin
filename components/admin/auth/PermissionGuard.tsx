"use client";

import { useAuth } from "@/components/admin/auth/AuthProvider";

export default function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission?: string | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { checked, loading, can } = useAuth();

  if (!checked || loading) return null;
  if (!can(permission)) return <>{fallback}</>;

  return <>{children}</>;
}
