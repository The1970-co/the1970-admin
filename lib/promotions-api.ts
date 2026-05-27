import { API_BASE } from "./api-base";

export type PromotionType = "PRODUCT_DISCOUNT" | "ORDER_DISCOUNT";
export type PromotionDiscountType = "PERCENT" | "FIXED_AMOUNT";
export type PromotionStatus = "ACTIVE" | "INACTIVE";

export type PromotionPayload = {
  name: string;
  type: PromotionType;
  status?: PromotionStatus;
  discountType: PromotionDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  branchId?: string;
  salesChannel?: string;
  startAt?: string;
  endAt?: string;
  priority?: number;
  note?: string;
  productIds?: string[];
  variantIds?: string[];
};

async function request(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }

  return res.json();
}

export function getPromotions() {
  return request("/promotions");
}

export function createPromotion(payload: PromotionPayload) {
  return request("/promotions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePromotion(id: string, payload: Partial<PromotionPayload>) {
  return request(`/promotions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePromotion(id: string) {
  return request(`/promotions/${id}`, {
    method: "DELETE",
  });
}
