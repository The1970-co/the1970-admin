"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import {
  clearCurrentUserFromStorage,
  getCurrentUserFromStorage,
  getCurrentUserPermissions,
  getTokenFromStorage,
  isOwnerUser,
  setCurrentUserToStorage,
  setTokenToStorage,
  getActiveBranchIdFromStorage,
  setActiveBranchIdToStorage,
} from "@/lib/current-user";
import { uniquePermissions } from "@/lib/permissions";
import {
  clearMobileSession,
  getMobileToken,
  getMobileRefreshToken,
  restoreMobileUser,
  saveMobileSession,
} from "@/lib/mobile-auth-token";

type AuthContextValue = {
  user: any;
  loading: boolean;
  checked: boolean;
  error: string;
  permissions: string[];
  activeBranchId: string;
  setActiveBranchId: (branchId: string) => void;
  can: (permission?: string | null) => boolean;
  reloadAuth: () => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Web admin vẫn có thể tự kiểm tra lại auth định kỳ.
// Mobile app thì không tự đá logout khi để lâu / quay lại foreground,
// vì iOS WebView có thể làm localStorage/cookie refresh chậm hơn native Preferences.
const AUTH_RELOAD_TTL_MS = 2 * 60 * 1000;
const AUTH_EVENT_DEBOUNCE_MS = 1500;

function isMobilePath(pathname: string) {
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "");

  // Hỗ trợ cả route mobile trực tiếp (/mobile/...) và trường hợp app/webview
  // được mount dưới prefix khác như /control/mobile/....
  return (
    path === "/mobile" ||
    path.startsWith("/mobile/") ||
    path.includes("/mobile/") ||
    path.endsWith("/mobile")
  );
}

function isMobileLoginPath(pathname: string) {
  return pathname === "/mobile/login" || pathname.startsWith("/mobile/login/");
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    isMobileLoginPath(pathname)
  );
}

function loginPathFor(pathname: string) {
  return isMobilePath(pathname) ? "/mobile/login" : "/login";
}

function extractToken(data: any) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.data?.access_token ||
    ""
  );
}

function extractUser(data: any) {
  return data?.user || data?.staff || data?.data?.user || data || null;
}

function extractRefreshToken(data: any) {
  return (
    data?.refreshToken ||
    data?.refresh_token ||
    data?.data?.refreshToken ||
    data?.data?.refresh_token ||
    ""
  );
}

async function restoreMobileSessionIfNeeded() {
  let token = getTokenFromStorage() || (await getMobileToken());
  let user = getCurrentUserFromStorage() || (await restoreMobileUser());

  // Nếu native Preferences còn phiên nhưng localStorage bị WebView làm chậm,
  // đồng bộ ngược lại ngay để các request tiếp theo không tưởng là đã logout.
  if (token) {
    setTokenToStorage(token);
    if (user) setCurrentUserToStorage(user);
    return { token, user };
  }

  const refreshToken = await getMobileRefreshToken();
  if (!refreshToken) return { token: "", user };

  try {
    const data: any = await apiJson("/auth/refresh", {
      method: "POST",
      redirectOnUnauthorized: false,
      skipRefresh: true,
      timeoutMs: 10000,
      body: JSON.stringify({ refreshToken }),
    } as any);

    token = extractToken(data);
    user = extractUser(data) || user;
    const nextRefreshToken = extractRefreshToken(data) || refreshToken;

    if (token) {
      setTokenToStorage(token);
      if (user) setCurrentUserToStorage(user);
      await saveMobileSession(token, user || undefined, nextRefreshToken);
      return { token, user };
    }
  } catch (error) {
    console.warn("[mobile-auth] restore by refresh failed", error);
  }

  return { token: "", user };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(() => getCurrentUserFromStorage());
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(getTokenFromStorage() || getCurrentUserFromStorage());
  });
  const [error, setError] = useState("");
  const [activeBranchId, setActiveBranchIdState] = useState(() =>
    getActiveBranchIdFromStorage(getCurrentUserFromStorage()),
  );

  const pathnameRef = useRef(pathname);
  const reloadPromiseRef = useRef<Promise<any> | null>(null);
  const lastReloadAtRef = useRef(0);
  const lastAuthEventAtRef = useRef(0);

  pathnameRef.current = pathname;

  const syncCachedUser = useCallback(() => {
    const cachedUser = getCurrentUserFromStorage();
    setUser(cachedUser);
    setActiveBranchIdState(getActiveBranchIdFromStorage(cachedUser));
    setChecked(true);
    setLoading(false);
    return cachedUser;
  }, []);

  const keepCurrentSession = useCallback((nextUser?: any) => {
    const cachedUser = nextUser || getCurrentUserFromStorage();

    setUser(cachedUser || null);
    setActiveBranchIdState(getActiveBranchIdFromStorage(cachedUser));
    setChecked(true);
    setLoading(false);
    setError("");

    return cachedUser;
  }, []);

  const logout = useCallback(async () => {
    const currentPath = pathnameRef.current;

    try {
      await apiJson("/auth/logout", {
        method: "POST",
        redirectOnUnauthorized: false,
        timeoutMs: 8000,
      } as any);
    } catch {
      // ignore logout API errors
    } finally {
      clearCurrentUserFromStorage();
      if (isMobilePath(currentPath)) {
        await clearMobileSession();
      }
      setUser(null);
      setChecked(true);
      setLoading(false);
      router.replace(loginPathFor(currentPath));
    }
  }, [router]);

  const reloadAuth = useCallback(async () => {
    const currentPath = pathnameRef.current;
    const isMobile = isMobilePath(currentPath);

    if (reloadPromiseRef.current) {
      return reloadPromiseRef.current;
    }

    if (isPublicPath(currentPath)) {
      const cachedUser = syncCachedUser();
      setError("");
      return cachedUser;
    }

    let token = getTokenFromStorage();

    if (!token && isMobile) {
      const restored = await restoreMobileSessionIfNeeded();
      token = restored.token;
      if (restored.user) keepCurrentSession(restored.user);
    }

    if (!token) {
      const cachedMobileUser = isMobile
        ? getCurrentUserFromStorage() || (await restoreMobileUser())
        : null;

      // Mobile chỉ tự về login khi thực sự không còn cả token lẫn user cache.
      // Không xóa phiên chỉ vì WebView chưa kịp trả token trong một nhịp render.
      if (isMobile && cachedMobileUser) {
        keepCurrentSession(cachedMobileUser);
        setError("");
        return cachedMobileUser;
      }

      setUser(null);
      setChecked(true);
      setLoading(false);
      setError("");
      router.replace(loginPathFor(currentPath));
      return null;
    }

    const cachedUser = getCurrentUserFromStorage();

    if (cachedUser) {
      keepCurrentSession(cachedUser);
    } else {
      setLoading(true);
    }

    const run = (async () => {
      try {
        setError("");

        const data: any = await apiJson("/auth/me", {
          redirectOnUnauthorized: false,
          timeoutMs: 10000,
        } as any);

        const nextToken = extractToken(data);
        const nextUser = extractUser(data);

        if (!nextUser) {
          throw new Error("Không lấy được thông tin đăng nhập.");
        }

        if (nextToken) setTokenToStorage(nextToken);
        setCurrentUserToStorage(nextUser);
        keepCurrentSession(nextUser);
        lastReloadAtRef.current = Date.now();

        return nextUser;
      } catch (err) {
        const latestToken =
          getTokenFromStorage() || (isMobile ? await getMobileToken() : "");
        const latestUser =
          getCurrentUserFromStorage() || (isMobile ? await restoreMobileUser() : null);

        const errorMessage =
          err instanceof Error
            ? err.message
            : "Không xác thực được phiên đăng nhập.";

        const isAuthExpired =
          errorMessage.includes("hết hạn") ||
          errorMessage.includes("Unauthorized") ||
          errorMessage.includes("401");

        /**
         * Mobile rule:
         * - Không tự logout chỉ vì /auth/me fail khi app để lâu rồi mở lại.
         * - Native Preferences là nguồn giữ phiên chính.
         * - Chỉ về /mobile/login khi không còn cả token lẫn cached user.
         */
        if (isMobile && (latestToken || latestUser)) {
          // Mobile không tự logout vì /auth/me hoặc refresh lỗi.
          // Chỉ nút Đăng xuất mới được phép xóa session.
          const sessionUser = latestUser || getCurrentUserFromStorage();
          if (latestToken) setTokenToStorage(latestToken);
          keepCurrentSession(sessionUser);
          lastReloadAtRef.current = Date.now();
          return sessionUser;
        }

        /**
         * Web rule cũ:
         * - Timeout/network fail thì giữ cache.
         * - 401 thật thì logout.
         */
        if (latestToken && latestUser && !isAuthExpired) {
          keepCurrentSession(latestUser);
          return latestUser;
        }

        // Chỉ web admin được tự xóa phiên khi auth thật sự hết hạn.
        // Mobile tuyệt đối không đi qua nhánh này vì lỗi request nền.
        if (isMobile) {
          const fallbackUser =
            getCurrentUserFromStorage() || (await restoreMobileUser());
          keepCurrentSession(fallbackUser);
          setError(errorMessage);
          return fallbackUser;
        }

        setUser(null);
        setError(errorMessage);
        clearCurrentUserFromStorage();
        router.replace(loginPathFor(currentPath));
        return null;
      } finally {
        reloadPromiseRef.current = null;
        setChecked(true);
        setLoading(false);
      }
    })();

    reloadPromiseRef.current = run;
    return run;
  }, [keepCurrentSession, router, syncCachedUser]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cachedUser = syncCachedUser();

      if (isPublicPath(pathname)) return;

      let token = getTokenFromStorage();

      if (!token && isMobilePath(pathname)) {
        const restored = await restoreMobileSessionIfNeeded();
        if (cancelled) return;

        token = restored.token;
        if (restored.user) {
          keepCurrentSession(restored.user);
        }
      }

      if (!token) {
        const mobileUser = isMobilePath(pathname)
          ? getCurrentUserFromStorage() || (await restoreMobileUser())
          : null;

        if (isMobilePath(pathname) && mobileUser) {
          keepCurrentSession(mobileUser);
          setChecked(true);
          setLoading(false);
          setError("");
          return;
        }

        router.replace(loginPathFor(pathname));
        return;
      }

      const isMobile = isMobilePath(pathname);
      const isStale = Date.now() - lastReloadAtRef.current > AUTH_RELOAD_TTL_MS;

      // Mobile có token/cache rồi thì không tự reload auth theo TTL nữa.
      if (isMobile && (cachedUser || getCurrentUserFromStorage())) {
        setChecked(true);
        setLoading(false);
        setError("");
        return;
      }

      if (!cachedUser || isStale) {
        void reloadAuth();
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [pathname, keepCurrentSession, reloadAuth, router, syncCachedUser]);

  useEffect(() => {
    const handleAuthChanged = () => {
      syncCachedUser();

      const now = Date.now();
      if (now - lastAuthEventAtRef.current < AUTH_EVENT_DEBOUNCE_MS) return;
      lastAuthEventAtRef.current = now;

      // Mobile không tự gọi /auth/me khi chỉ có storage/auth event.
      if (isMobilePath(pathnameRef.current)) return;

      if (Date.now() - lastReloadAtRef.current > AUTH_RELOAD_TTL_MS) {
        void reloadAuth();
      }
    };

    window.addEventListener("the1970:auth-changed", handleAuthChanged);
    window.addEventListener("storage", handleAuthChanged);

    return () => {
      window.removeEventListener("the1970:auth-changed", handleAuthChanged);
      window.removeEventListener("storage", handleAuthChanged);
    };
  }, [reloadAuth, syncCachedUser]);

  useEffect(() => {
    if (isPublicPath(pathname)) return;

    const reloadIfStale = () => {
      const currentPath = pathnameRef.current;

      // Chặn lỗi mobile để lâu bị đá logout khi app quay lại foreground.
      if (isMobilePath(currentPath)) {
        void restoreMobileSessionIfNeeded().then((restored) => {
          if (restored.user) keepCurrentSession(restored.user);
        });
        return;
      }

      const token = getTokenFromStorage();
      if (!token) return;
      if (Date.now() - lastReloadAtRef.current < AUTH_RELOAD_TTL_MS) return;

      void reloadAuth();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      reloadIfStale();
    };

    const handlePermissionInvalidated = () => {
      // Mobile không tự logout vì event quyền/cookie stale từ WebView.
      // Quyền sẽ được cập nhật ở lần login/refresh sau; chỉ logout khi user bấm đăng xuất.
      if (isMobilePath(pathnameRef.current)) {
        void restoreMobileSessionIfNeeded().then((restored) => {
          if (restored.user) keepCurrentSession(restored.user);
        });
        return;
      }
      void logout();
    };

    window.addEventListener("focus", reloadIfStale);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(
      "the1970:permissions-invalidated",
      handlePermissionInvalidated,
    );

    return () => {
      window.removeEventListener("focus", reloadIfStale);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        "the1970:permissions-invalidated",
        handlePermissionInvalidated,
      );
    };
  }, [keepCurrentSession, logout, pathname, reloadAuth]);

  const setActiveBranchId = useCallback(
    (branchId: string) => {
      const currentUser = getCurrentUserFromStorage() || user;
      setActiveBranchIdToStorage(branchId, currentUser);
      const nextUser = getCurrentUserFromStorage() || currentUser;
      setUser(nextUser);
      setActiveBranchIdState(getActiveBranchIdFromStorage(nextUser));
    },
    [user],
  );

  useEffect(() => {
    const handleActiveBranchChanged = () => {
      const cachedUser = getCurrentUserFromStorage();
      setUser(cachedUser);
      setActiveBranchIdState(getActiveBranchIdFromStorage(cachedUser));
    };

    window.addEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
    return () => {
      window.removeEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
    };
  }, []);

  const permissions = useMemo(() => {
    if (isOwnerUser(user)) return ["*"];
    return uniquePermissions(getCurrentUserPermissions(user, activeBranchId));
  }, [user, activeBranchId]);

  const can = useCallback(
    (permission?: string | null) => {
      if (!permission) return true;
      if (permissions.includes("*")) return true;
      return permissions.includes(permission);
    },
    [permissions],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      checked,
      error,
      permissions,
      activeBranchId,
      setActiveBranchId,
      can,
      reloadAuth,
      logout,
    }),
    [user, loading, checked, error, permissions, activeBranchId, setActiveBranchId, can, reloadAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
