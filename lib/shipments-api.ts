import { API_BASE } from "./api-base";

function getAuthHeaders() {
  if (typeof window === "undefined") {
    return {
      "Content-Type": "application/json",
    };
  }

  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    "";

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Shipment request failed");
  }

  return data as T;
}

export const quoteAhamove = (data: any) =>
  request("/shipments/ahamove/quote", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createAhamove = (orderId: string, data: any) =>
  request(`/shipments/${orderId}/ahamove/create`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const cancelAhamove = (orderId: string) =>
  request(`/shipments/${orderId}/ahamove/cancel`, {
    method: "POST",
  });

export const trackAhamove = (shipmentId: string) =>
  request(`/shipments/${shipmentId}/ahamove/tracking`, {
    method: "GET",
  });
