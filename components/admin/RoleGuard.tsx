"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  getRoleLabel,
  hasPermission,
  type CurrentUserProfile,
  type PermissionKey,
} from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

type RoleGuardProps = {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function RoleGuard({
  permission,
  children,
  fallback = null,
}: RoleGuardProps) {
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUserFromStorage());
  }, []);

  if (!currentUser) return null;

  if (!hasPermission(currentUser.role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}