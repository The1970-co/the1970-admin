import { API_BASE } from "@/lib/api-base";

export type PaymentSourceItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  branchId?: string | null;
  isActive: boolean;
  sortOrder?: number;
  note?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

export async function getPaymentSources(): Promise<PaymentSourceItem[]> {
  const data = await request<any[]>("/payment-sources");
  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    id: String(item.id),
    code: String(item.code || ""),
    name: String(item.name || ""),
    type: String(item.type || ""),
    branchId: item.branchId || null,
    isActive: Boolean(item.isActive),
    sortOrder: Number(item.sortOrder || 0),
    note: item.note || null,
  }));
}
