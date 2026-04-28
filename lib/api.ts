import { API_BASE } from "@/lib/api-base";
import { getTokenFromStorage, clearCurrentUserFromStorage } from "@/lib/current-user";


type RequestOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const { auth = true, headers, ...rest } = options;

  const token = getTokenFromStorage();

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  if (auth) {
    finalHeaders.Authorization = `Bearer ${token || ""}`;
  }

  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;

  if (!isFormData && !finalHeaders["Content-Type"] && rest.body) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    cache: "no-store",
  });

  if (res.status === 401) {
    clearCurrentUserFromStorage();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
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
    throw new Error(data?.message || `Request failed: ${res.status}`);
  }

  return data as T;
}