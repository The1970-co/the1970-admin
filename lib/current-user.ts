const TOKEN_KEY = "token";
const ACCESS_TOKEN_KEY = "accessToken";
const ACTIVE_BRANCH_KEY = "the1970_active_branch_id";
const USER_KEYS = ["currentUser", "the1970_current_user", "user"];

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function normalizeBranchId(value?: string | null) {
  if (!value) return "";
  return String(value).trim();
}

export function getCurrentUserFromStorage() {
  if (typeof window === "undefined") return null;

  for (const key of USER_KEYS) {
    const parsed = safeJsonParse(localStorage.getItem(key));
    if (parsed) return parsed;
  }

  return null;
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

export function getActiveBranchIdFromStorage(user?: any) {
  if (typeof window === "undefined") return normalizeBranchId(user?.activeBranchId || user?.branchId);

  const stored = normalizeBranchId(localStorage.getItem(ACTIVE_BRANCH_KEY));
  const branchIds = getUserBranchIds(user);

  if (stored && (!branchIds.length || branchIds.includes(stored))) return stored;

  const fallback =
    normalizeBranchId(user?.activeBranchId) ||
    normalizeBranchId(user?.branchId) ||
    branchIds[0] ||
    "";

  if (fallback) localStorage.setItem(ACTIVE_BRANCH_KEY, fallback);
  return fallback;
}

export function setActiveBranchIdToStorage(branchId: string, user?: any) {
  if (typeof window === "undefined") return;

  const value = normalizeBranchId(branchId);
  if (!value) return;

  const currentUser = user || getCurrentUserFromStorage();
  const branchIds = getUserBranchIds(currentUser);
  if (branchIds.length && !branchIds.includes(value)) return;

  localStorage.setItem(ACTIVE_BRANCH_KEY, value);

  if (currentUser) {
    const nextUser = {
      ...currentUser,
      activeBranchId: value,
    };

    const raw = JSON.stringify(nextUser);
    localStorage.setItem("currentUser", raw);
    localStorage.setItem("the1970_current_user", raw);
    localStorage.setItem("user", raw);
  }

  window.dispatchEvent(new Event("the1970:active-branch-changed"));
  window.dispatchEvent(new Event("the1970:auth-changed"));
}

export function setCurrentUserToStorage(user: any) {
  if (typeof window === "undefined") return;
  if (!user) return;

  const branchIds = getUserBranchIds(user);
  const storedActiveBranchId = normalizeBranchId(
    localStorage.getItem(ACTIVE_BRANCH_KEY),
  );

  const activeBranchId =
    (storedActiveBranchId &&
    (!branchIds.length || branchIds.includes(storedActiveBranchId))
      ? storedActiveBranchId
      : "") ||
    normalizeBranchId(user.activeBranchId) ||
    normalizeBranchId(user.branchId) ||
    branchIds[0] ||
    "";

  const nextUser = activeBranchId
    ? {
        ...user,
        activeBranchId,
        workingBranchId: activeBranchId,
      }
    : user;

  const raw = JSON.stringify(nextUser);
  localStorage.setItem("currentUser", raw);
  localStorage.setItem("the1970_current_user", raw);
  localStorage.setItem("user", raw);

  if (activeBranchId) {
    localStorage.setItem(ACTIVE_BRANCH_KEY, activeBranchId);
  }
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
  localStorage.removeItem(ACTIVE_BRANCH_KEY);
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

export function getCurrentUserBranchRole(user?: any, branchId?: string | null) {
  if (!user) return "";

  const scopedBranchId = normalizeBranchId(branchId) || getActiveBranchIdFromStorage(user);

  const row = Array.isArray(user.branchRoles)
    ? user.branchRoles.find((item: any) => normalizeBranchId(item?.branchId || item?.branch?.id) === scopedBranchId)
    : null;

  return String(row?.roleCode || row?.role || user.role || "").trim();
}

export function getCurrentUserBranchLabel(user?: any, branchId?: string | null) {
  if (!user) return "";

  const scopedBranchId = normalizeBranchId(branchId) || getActiveBranchIdFromStorage(user);

  const roleRow = Array.isArray(user.branchRoles)
    ? user.branchRoles.find((item: any) => normalizeBranchId(item?.branchId || item?.branch?.id) === scopedBranchId)
    : null;

  const permissionRow = Array.isArray(user.branchPermissions)
    ? user.branchPermissions.find((item: any) => normalizeBranchId(item?.branchId || item?.branch?.id) === scopedBranchId)
    : null;

  return (
    roleRow?.branch?.name ||
    roleRow?.branchName ||
    permissionRow?.branch?.name ||
    permissionRow?.branchName ||
    (normalizeBranchId(user.branchId) === scopedBranchId ? user.branchName || user.branch : "") ||
    scopedBranchId ||
    ""
  );
}

export function getCurrentUserBranchOptions(user?: any) {
  const ids = getUserBranchIds(user);

  return ids.map((branchId) => ({
    branchId,
    branchName: getCurrentUserBranchLabel(user, branchId) || branchId,
    role: getCurrentUserBranchRole(user, branchId) || user?.role || "",
  }));
}

export function getCurrentUserPermissions(user?: any, branchId?: string | null): string[] {
  if (!user) return [];

  if (isOwnerUser(user)) return ["*"];

  const scopedBranchId = normalizeBranchId(branchId) || getActiveBranchIdFromStorage(user);
  const keys: string[] = [];

  if (Array.isArray(user.permissions)) keys.push(...user.permissions);
  if (Array.isArray(user.permissionKeys)) keys.push(...user.permissionKeys);

  const branchPermissions = Array.isArray(user.branchPermissions)
    ? user.branchPermissions
    : [];

  const scopedRows = scopedBranchId
    ? branchPermissions.filter(
        (row: any) => normalizeBranchId(row?.branchId || row?.branch?.id) === scopedBranchId,
      )
    : [];

  const rowsToUse = scopedRows.length ? scopedRows : branchPermissions;
  const deniedKeys: string[] = [];

  for (const row of rowsToUse) {
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


export function getWorkingBranchId(user?: any) {
  return getActiveBranchIdFromStorage(user || getCurrentUserFromStorage());
}

export function getWorkingBranchLabel(user?: any) {
  const currentUser = user || getCurrentUserFromStorage();
  return getCurrentUserBranchLabel(currentUser, getWorkingBranchId(currentUser));
}

export function getWorkingBranchRole(user?: any) {
  const currentUser = user || getCurrentUserFromStorage();
  return getCurrentUserBranchRole(currentUser, getWorkingBranchId(currentUser));
}

export function isWorkingBranch(branchId?: string | null, user?: any) {
  const current = getWorkingBranchId(user);
  return Boolean(current && normalizeBranchId(branchId) === current);
}
