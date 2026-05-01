import { API_BASE } from "@/lib/api-base";
import { getTokenFromStorage, clearCurrentUserFromStorage } from "@/lib/current-user";

function getAuthHeaders(initHeaders?: HeadersInit): HeadersInit {
  const token = getTokenFromStorage();

  return {
    Authorization: `Bearer ${token || ""}`,
    ...(initHeaders || {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: getAuthHeaders(init?.headers),
  });

  if (res.status === 401) {
    clearCurrentUserFromStorage();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Phiên đăng nhập hết hạn");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function uploadMissingCostExcel(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return request<{
    success: boolean;
    total: number;
    data: any[];
  }>("/products/missing-cost-from-excel", {
    method: "POST",
    body: formData,
  });
}