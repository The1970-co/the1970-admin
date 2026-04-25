const USER_KEY = "user";
const TOKEN_KEY = "token";

export function getCurrentUserFromStorage() {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export function normalizeBranchId(value?: string | null) {
  if (!value) return "b1";

  const v = String(value).trim().toLowerCase();

  if (v === "b1") return "b1";
  if (v === "b2") return "b2";
  if (v === "b3") return "b3";

  if (v === "hoàn kiếm" || v === "hoan kiem") return "b1";
  if (v === "hai bà trưng" || v === "hai ba trung") return "b2";
  if (v === "online warehouse" || v === "kho online") return "b3";

  return String(value);
}

export function getUserBranchIds(user?: any): string[] {
  if (!user) return [];

  if (Array.isArray(user.branchIds) && user.branchIds.length > 0) {
    return user.branchIds;
  }

  const single = user.branchId || user.branchName;
  if (!single) return [];

  return [normalizeBranchId(single)];
}

export function setCurrentUserToStorage(user: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getTokenFromStorage() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokenToStorage(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCurrentUserFromStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function isOwnerUser(user?: any) {
  return user?.role === "owner" || user?.role === "admin";
}