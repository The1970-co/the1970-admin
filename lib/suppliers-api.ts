import { API_BASE } from "@/lib/api-base";

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

export type SupplierItem = {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  isActive: boolean;
  _count?: {
    receipts: number;
  };
};

export async function getSuppliers(): Promise<SupplierItem[]> {
  return request<SupplierItem[]>("/suppliers");
}

export async function createSupplier(payload: {
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}) {
  return request<SupplierItem>("/suppliers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupplier(
  id: string,
  payload: {
    name?: string;
    code?: string;
    phone?: string;
    email?: string;
    address?: string;
    note?: string;
    isActive?: boolean;
  }
) {
  return request<SupplierItem>(`/suppliers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function toggleSupplier(id: string) {
  return request<SupplierItem>(`/suppliers/${id}/toggle`, {
    method: "PATCH",
  });
}