"use client";

import { useAuth } from "@/components/admin/auth/AuthProvider";

export function usePermission() {
  const auth = useAuth();
  return {
    can: auth.can,
    permissions: auth.permissions,
    user: auth.user,
    isLoading: auth.loading,
    isChecked: auth.checked,
  };
}
