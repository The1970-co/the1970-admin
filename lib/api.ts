import { API_BASE } from "@/lib/api-base";
import {
  getTokenFromStorage,
  setTokenToStorage,
  clearCurrentUserFromStorage,
} from "@/lib/current-user";

type RequestOptions = RequestInit & {
  auth?: boolean;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
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

  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const { auth = true, skipRefresh = false, headers, ...rest } = options;

  const makeRequest = async (token?: string | null) => {
    const finalHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };

    if (auth && token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }

    const isFormData =
      typeof FormData !== "undefined" && rest.body instanceof FormData;

    if (!isFormData && !finalHeaders["Content-Type"] && rest.body) {
      finalHeaders["Content-Type"] = "application/json";
    }

    return fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: finalHeaders,
      credentials: "include",
      cache: "no-store",
    });
  };

  const token = getTokenFromStorage();
  let res = await makeRequest(token);

  if (res.status !== 401 || !auth || skipRefresh) {
    return res;
  }

  const newToken = await refreshAccessToken();

  if (!newToken) {
    redirectToLogin();
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  res = await makeRequest(newToken);

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  return res;
}

export async function apiJson<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const res = await apiFetch(path, options);

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed: ${res.status}`
    );
  }

  return data as T;
}