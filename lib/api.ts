import { API_BASE } from "@/lib/api-base";
import {
  getTokenFromStorage,
  setTokenToStorage,
  clearCurrentUserFromStorage,
  getWorkingBranchId,
} from "@/lib/current-user";

type RequestOptions = RequestInit & {
  auth?: boolean;
  skipRefresh?: boolean;
  redirectOnUnauthorized?: boolean;
  timeoutMs?: number;
};

let refreshPromise: Promise<string | null> | null = null;

function isAuthPath(path: string) {
  return path === "/auth/me" || path === "/auth/refresh" || path === "/auth/logout";
}

function isMobileContext() {
  if (typeof window === "undefined") return false;

  const pathname = window.location.pathname || "";
  if (pathname === "/mobile" || pathname.startsWith("/mobile/")) return true;

  try {
    return (
      localStorage.getItem("the1970_login_from") === "mobile" ||
      localStorage.getItem("the1970_force_mobile") === "1"
    );
  } catch {
    return false;
  }
}

async function restoreNativeMobileSession() {
  if (!isMobileContext()) return "";

  try {
    const mobileAuth = await import("@/lib/mobile-auth-token");
    const token = await mobileAuth.getMobileToken();
    await mobileAuth.restoreMobileUser();
    return token || "";
  } catch (error) {
    console.warn("[API_MOBILE_SESSION_RESTORE_FAILED]", error);
    return "";
  }
}

async function getRequestToken() {
  const token = getTokenFromStorage();
  if (token) return token;

  return restoreNativeMobileSession();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs?: number) {
  if (!timeoutMs || timeoutMs <= 0 || typeof AbortController === "undefined") {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetchWithTimeout(
      `${API_BASE}/auth/refresh`,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      },
      10000,
    )
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const token = data?.accessToken || data?.token;
        if (!token) return null;
        setTokenToStorage(token);
        return token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;

  if (isMobileContext()) {
    // Mobile chỉ về login mobile, không clear native Preferences ở đây.
    // Nếu clear cả native session thì app sẽ bị logout sau khi để lâu dù vẫn còn token/user lưu bền.
    window.location.href = "/mobile/login";
    return;
  }

  // Web admin giữ nguyên hành vi cũ.
  clearCurrentUserFromStorage();
  window.location.href = "/login";
}

function unauthorizedMessage() {
  return isMobileContext()
    ? "Phiên mobile cần xác thực lại, vui lòng đăng nhập lại."
    : "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.";
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const {
    auth = true,
    skipRefresh = false,
    redirectOnUnauthorized = true,
    timeoutMs,
    headers,
    ...rest
  } = options;

  const makeRequest = async (token?: string | null) => {
    const finalHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };

    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

    const activeBranchId = getWorkingBranchId();
    if (auth && activeBranchId && !finalHeaders["x-active-branch-id"]) {
      finalHeaders["x-active-branch-id"] = activeBranchId;
      finalHeaders["x-branch-id"] = activeBranchId;
    }

    const isFormData =
      typeof FormData !== "undefined" && rest.body instanceof FormData;

    if (!isFormData && !finalHeaders["Content-Type"] && rest.body) {
      finalHeaders["Content-Type"] = "application/json";
    }

    const effectiveTimeoutMs = timeoutMs ?? (isAuthPath(path) ? 10000 : undefined);

    return fetchWithTimeout(
      `${API_BASE}${path}`,
      {
        ...rest,
        headers: finalHeaders,
        credentials: "include",
        cache: "no-store",
      },
      effectiveTimeoutMs,
    );
  };

  let requestToken = auth ? await getRequestToken() : null;
  let res = await makeRequest(requestToken);

  if (res.status !== 401 || !auth || skipRefresh) return res;

  const refreshedToken = await refreshAccessToken();
  const nativeMobileToken = refreshedToken ? "" : await restoreNativeMobileSession();
  const retryToken = refreshedToken || nativeMobileToken || "";

  if (!retryToken) {
    if (redirectOnUnauthorized) redirectToLogin();
    throw new Error(unauthorizedMessage());
  }

  res = await makeRequest(retryToken);

  if (res.status === 401) {
    if (redirectOnUnauthorized) redirectToLogin();
    throw new Error(unauthorizedMessage());
  }

  return res;
}

export async function apiJson<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed: ${res.status}`);
  }

  return data as T;
}
