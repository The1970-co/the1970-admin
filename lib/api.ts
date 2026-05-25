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

  let res = await makeRequest(getTokenFromStorage());

  if (res.status !== 401 || !auth || skipRefresh) return res;

  const newToken = await refreshAccessToken();

  if (!newToken) {
    if (redirectOnUnauthorized) redirectToLogin();
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  res = await makeRequest(newToken);

  if (res.status === 401) {
    if (redirectOnUnauthorized) redirectToLogin();
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
