const TOKEN_KEY = "token";
const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEYS = ["currentUser", "the1970_current_user", "user"];

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getCurrentUserFromStorage() {
  if (typeof window === "undefined") return null;

  for (const key of USER_KEYS) {
    const parsed = safeJsonParse(localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
}

export function setCurrentUserToStorage(user: any) {
  if (typeof window === "undefined") return;
  if (!user) return;

  const raw = JSON.stringify(user);
  localStorage.setItem("currentUser", raw);
  localStorage.setItem("the1970_current_user", raw);
  localStorage.setItem("user", raw);
}

export function getTokenFromStorage() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    null
  );
}

export function setTokenToStorage(token: string) {
  if (typeof window === "undefined") return;
  if (!token) return;

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearCurrentUserFromStorage() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem("user");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("the1970_current_user");
}

export function normalizeBranchId(value?: string | null) {
  if (!value) return "";
  return String(value).trim();
}

export function getUserBranchIds(user?: any): string[] {
  if (!user) return [];

  const ids = new Set<string>();

  if (Array.isArray(user.branchIds)) {
    user.branchIds.forEach((id: any) => {
      const value = normalizeBranchId(id);
      if (value) ids.add(value);
    });
  }

  if (user.branchId) {
    const value = normalizeBranchId(user.branchId);
    if (value) ids.add(value);
  }

  if (Array.isArray(user.branchRoles)) {
    user.branchRoles.forEach((row: any) => {
      const value = normalizeBranchId(row?.branchId || row?.branch?.id);
      if (value) ids.add(value);
    });
  }

  if (Array.isArray(user.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => {
      const value = normalizeBranchId(row?.branchId || row?.branch?.id);
      if (value) ids.add(value);
    });
  }

  return Array.from(ids);
}

export function isOwnerUser(user?: any) {
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);

  return roles.includes("owner") || roles.includes("admin");
}

export function getCurrentUserPermissions(user?: any): string[] {
  if (!user) return [];

  if (isOwnerUser(user)) return ["*"];

  const keys: string[] = [];

  if (Array.isArray(user.permissions)) keys.push(...user.permissions);
  if (Array.isArray(user.permissionKeys)) keys.push(...user.permissionKeys);

  const branchPermissions = Array.isArray(user.branchPermissions)
    ? user.branchPermissions
    : [];

  const deniedKeys: string[] = [];

  for (const row of branchPermissions) {
    if (Array.isArray(row?.permissionKeys)) keys.push(...row.permissionKeys);
    if (Array.isArray(row?.extraPermissionKeys)) keys.push(...row.extraPermissionKeys);
    if (Array.isArray(row?.deniedPermissionKeys)) deniedKeys.push(...row.deniedPermissionKeys);
  }

  const deniedSet = new Set(
    deniedKeys.map((key) => String(key || "").trim()).filter(Boolean),
  );

  return Array.from(
    new Set(keys.map((key) => String(key || "").trim()).filter(Boolean)),
  ).filter((key) => !deniedSet.has(key));
}
