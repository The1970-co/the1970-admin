import { API_BASE } from "@/lib/api-base";
import { getTokenFromStorage, clearCurrentUserFromStorage } from "@/lib/current-user";

export type MissingCostItem = {
  id: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  costPrice: number;
  stock: number;
  productId: string;
  productName: string;
  productSlug: string;
  category: string;
  imageUrl: string;
};

function getAuthHeaders(initHeaders?: HeadersInit): HeadersInit {
  const token = getTokenFromStorage();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || ""}`,
    ...(initHeaders || {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: getAuthHeaders(init?.headers),
    cache: "no-store",
  });

  if (res.status === 401) {
    clearCurrentUserFromStorage();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {}
    throw new Error(message);
  }

  // 🔥 FIX QUAN TRỌNG: KHÔNG dùng text + parse nữa
  // vì backend m đã trả JSON rồi
  return res.json();
}

export async function getMissingCostProducts() {
  return request<{
    success: boolean;
    total: number;
    data: MissingCostItem[];
  }>("/products/missing-cost");
}

export async function updateMissingCostBulk(
  items: Array<{ variantId: string; sku: string; costPrice: number }>
) {
  return request<{
    success: boolean;
    updated: number;
  }>("/products/missing-cost/bulk-update", {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}