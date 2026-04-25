import { getTokenFromStorage, clearCurrentUserFromStorage } from "@/lib/current-user";

export type InventoryMovement = {
  id: string;
  type: string;
  qty: number;
  note?: string;
  refType?: string;
  refId?: string;
  branchId?: string;
  createdAt: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  "http://localhost:3001";

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
    cache: "no-store",
  });

  if (res.status === 401) {
    clearCurrentUserFromStorage();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
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

  return res.json();
}

function normalizeMovement(raw: any): InventoryMovement {
  return {
    id: String(raw.id),
    type: String(raw.type || ""),
    qty: Number(raw.qty || 0),
    note: raw.note || "",
    refType: raw.refType || "",
    refId: raw.refId || "",
    branchId: raw.branchId || "",
    createdAt: raw.createdAt
      ? new Date(raw.createdAt).toLocaleString("vi-VN")
      : "",
    sku: raw.sku || "",
    productName: raw.productName || "",
    color: raw.color || "",
    size: raw.size || "",
  };
}

export async function getInventoryMovements(): Promise<InventoryMovement[]> {
  const data = await request<any[]>("/orders/inventory-movements/history");
  return data.map(normalizeMovement);
}