import { API_BASE } from "@/lib/api-base";
import {
  getTokenFromStorage,
  setTokenToStorage,
  clearCurrentUserFromStorage,
  getWorkingBranchId,
  setCurrentUserToStorage,
} from "@/lib/current-user";

type RequestOptions = RequestInit & {
  auth?: boolean;
  skipRefresh?: boolean;
  redirectOnUnauthorized?: boolean;
  timeoutMs?: number;
};

let refreshPromise: Promise<string | null> | null = null;
let mobileRefreshPromise: Promise<string | null> | null = null;

function isAuthPath(path: string) {
  return path === "/auth/me" || path === "/auth/refresh" || path === "/auth/logout";
}

function isMobileRuntime() {
  if (typeof window === "undefined") return false;

  const pathname = window.location?.pathname || "";
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

async function getMobileAccessToken() {
  try {
    const mod = await import("@/lib/mobile-auth-token");
    return await mod.getMobileToken();
  } catch {
    return "";
  }
}

async function refreshMobileAccessToken() {
  if (!mobileRefreshPromise) {
    mobileRefreshPromise = (async () => {
      try {
        const mobileAuth = await import("@/lib/mobile-auth-token");
        const refreshToken = await mobileAuth.getMobileRefreshToken();
        if (!refreshToken) return null;

        const res = await fetchWithTimeout(
          `${API_BASE}/auth/refresh`,
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
          },
          10000,
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn("[mobile-auth] refresh rejected", res.status, text.slice(0, 300));
          return null;
        }

        const data = await res.json().catch(() => null);
        const token =
          data?.accessToken ||
          data?.token ||
          data?.data?.accessToken ||
          data?.data?.token ||
          "";
        const nextRefreshToken =
          data?.refreshToken ||
          data?.refresh_token ||
          data?.data?.refreshToken ||
          data?.data?.refresh_token ||
          refreshToken;
        const user = data?.user || data?.staff || data?.data?.user || null;

        if (!token) return null;

        const cachedUser = user || (await mobileAuth.restoreMobileUser());

        setTokenToStorage(token);
        if (cachedUser) setCurrentUserToStorage(cachedUser);
        await mobileAuth.saveMobileSession(token, cachedUser || undefined, nextRefreshToken);

        return token as string;
      } catch (error) {
        console.warn("[mobile-auth] refresh failed", error);
        return null;
      } finally {
        mobileRefreshPromise = null;
      }
    })();
  }

  return mobileRefreshPromise;
}

async function refreshWebAccessToken() {
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

async function refreshAccessToken(mobile: boolean) {
  return mobile ? refreshMobileAccessToken() : refreshWebAccessToken();
}

async function hasMobileRefreshToken() {
  if (!isMobileRuntime()) return false;
  try {
    const mobileAuth = await import("@/lib/mobile-auth-token");
    return Boolean(await mobileAuth.getMobileRefreshToken());
  } catch {
    return false;
  }
}

function redirectToLogin(mobile: boolean) {
  if (mobile) {
    // Mobile không xoá native Preferences ở api wrapper.
    // Nếu refresh thật sự fail, chỉ đưa về login mobile, tránh rơi sang /login web.
    clearCurrentUserFromStorage();
    if (typeof window !== "undefined") window.location.href = "/mobile/login";
    return;
  }

  clearCurrentUserFromStorage();
  if (typeof window !== "undefined") window.location.href = "/login";
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

  const mobile = isMobileRuntime();

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

  const initialToken = getTokenFromStorage() || (mobile ? await getMobileAccessToken() : "");
  let res = await makeRequest(initialToken);

  if (res.status !== 401 || !auth || skipRefresh) return res;

  const newToken = await refreshAccessToken(mobile);

  if (!newToken) {
    // Mobile: đừng đá thẳng về login khi refresh lỗi tạm thời sau 15 phút.
    // Nếu còn refreshToken trong Preferences/localStorage thì giữ app ở màn hiện tại để user thử lại.
    if (mobile && (await hasMobileRefreshToken())) {
      throw new Error("Không làm mới được phiên đăng nhập. Vui lòng thử tải lại màn hình.");
    }

    if (redirectOnUnauthorized) redirectToLogin(mobile);
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  res = await makeRequest(newToken);

  if (res.status === 401) {
    if (mobile && (await hasMobileRefreshToken())) {
      throw new Error("Phiên mobile chưa xác thực được request sau khi refresh. Vui lòng thử lại.");
    }

    if (redirectOnUnauthorized) redirectToLogin(mobile);
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
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
