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
const AUTH_RELOAD_TTL_MS = 2 * 60 * 1000;
const AUTH_EVENT_DEBOUNCE_MS = 1500;

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
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

  const logout = useCallback(async () => {
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
      setUser(null);
      setChecked(true);
      setLoading(false);
      router.replace("/login");
    }
  }, [router]);

  const reloadAuth = useCallback(async () => {
    const currentPath = pathnameRef.current;

    if (reloadPromiseRef.current) {
      return reloadPromiseRef.current;
    }

    if (isPublicPath(currentPath)) {
      const cachedUser = syncCachedUser();
      setError("");
      return cachedUser;
    }

    const token = getTokenFromStorage();

    if (!token) {
      setUser(null);
      setChecked(true);
      setLoading(false);
      setError("");
      router.replace("/login");
      return null;
    }

    const cachedUser = getCurrentUserFromStorage();

    if (cachedUser) {
      setUser(cachedUser);
      setActiveBranchIdState(getActiveBranchIdFromStorage(cachedUser));
      setChecked(true);
      setLoading(false);
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
        setUser(nextUser);
        setActiveBranchIdState(getActiveBranchIdFromStorage(nextUser));
        setChecked(true);
        setLoading(false);
        setError("");
        lastReloadAtRef.current = Date.now();

        return nextUser;
      } catch (err) {
        /**
         * Không xoá cache ngay khi /auth/me timeout hoặc đang refresh.
         * Các API vận hành vẫn được JwtGuard xác thực bằng access token/refresh flow.
         * Chỉ đá login khi không còn cả token lẫn cached user.
         */
        const latestToken = getTokenFromStorage();
        const latestUser = getCurrentUserFromStorage();
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Không xác thực được phiên đăng nhập.";
        const isAuthExpired =
          errorMessage.includes("hết hạn") ||
          errorMessage.includes("Unauthorized") ||
          errorMessage.includes("401");

        if (latestToken && latestUser && !isAuthExpired) {
          setUser(latestUser);
          setActiveBranchIdState(getActiveBranchIdFromStorage(latestUser));
          setChecked(true);
          setLoading(false);
          setError("");
          return latestUser;
        }

        setUser(null);
        setError(errorMessage);

        clearCurrentUserFromStorage();
        router.replace("/login");
        return null;
      } finally {
        reloadPromiseRef.current = null;
        setChecked(true);
        setLoading(false);
      }
    })();

    reloadPromiseRef.current = run;
    return run;
  }, [router, syncCachedUser]);

  useEffect(() => {
    const cachedUser = syncCachedUser();

    if (isPublicPath(pathname)) return;

    const token = getTokenFromStorage();
    if (!token) {
      router.replace("/login");
      return;
    }

    const isStale = Date.now() - lastReloadAtRef.current > AUTH_RELOAD_TTL_MS;

    if (!cachedUser || isStale) {
      void reloadAuth();
    }
  }, [pathname, reloadAuth, router, syncCachedUser]);

  useEffect(() => {
    const handleAuthChanged = () => {
      syncCachedUser();

      const now = Date.now();
      if (now - lastAuthEventAtRef.current < AUTH_EVENT_DEBOUNCE_MS) return;
      lastAuthEventAtRef.current = now;

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
  }, [logout, pathname, reloadAuth]);

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
