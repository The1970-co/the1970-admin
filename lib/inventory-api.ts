import { API_BASE } from "@/lib/api-base";
import {
  getTokenFromStorage,
  clearCurrentUserFromStorage,
} from "@/lib/current-user";

export type InventoryMovement = {
  id: string;
  type: string;
  qty: number;
  note?: string;
  refType?: string;
  refId?: string;
  refCode?: string | null;
  branchId?: string;
  createdAt?: string | null;
  createdAtIso?: string | null;
  createdAtText?: string | null;
  updatedAt?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  beforeQty?: number | null;
  afterQty?: number | null;
  status?: string | null;
  sku: string;
  barcode?: string | null;
  productName: string;
  productId?: string | null;
  variantId?: string | null;
  color?: string;
  size?: string;
};

export type InventoryMovementActor = {
  id: string;
  label: string;
  name?: string | null;
  email?: string | null;
  type?: string | null;
  branchId?: string | null;
  branchName?: string | null;
};

function getAuthHeaders(initHeaders?: HeadersInit): HeadersInit {
  const token = getTokenFromStorage();

  return {
    Accept: "application/json",
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

function normalizeNullableString(value: any) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeMovement(raw: any): InventoryMovement {
  const createdAtIso =
    normalizeNullableString(raw.createdAtIso) || normalizeNullableString(raw.createdAt);

  return {
    id: String(raw.id || ""),
    type: String(raw.type || ""),
    qty: Number(raw.qty || 0),
    note: raw.note || "",
    refType: raw.refType || "",
    refId: raw.refId || "",
    refCode: raw.refCode || raw.orderCode || raw.purchaseReceiptCode || null,
    branchId: raw.branchId || "",
    createdAt: createdAtIso,
    createdAtIso,
    createdAtText: raw.createdAtText || null,
    updatedAt: raw.updatedAt || null,
    createdById: raw.createdById || raw.actorId || null,
    createdByName:
      raw.createdByName ||
      raw.actorName ||
      raw.createdBy?.fullName ||
      raw.createdBy?.name ||
      raw.createdBy?.email ||
      null,
    createdByEmail: raw.createdByEmail || raw.actorEmail || raw.createdBy?.email || null,
    actorId: raw.actorId || raw.createdById || null,
    actorName:
      raw.actorName ||
      raw.createdByName ||
      raw.createdBy?.fullName ||
      raw.createdBy?.name ||
      raw.createdBy?.email ||
      null,
    actorEmail: raw.actorEmail || raw.createdByEmail || raw.createdBy?.email || null,
    beforeQty:
      raw.beforeQty === null || raw.beforeQty === undefined
        ? null
        : Number(raw.beforeQty),
    afterQty:
      raw.afterQty === null || raw.afterQty === undefined
        ? null
        : Number(raw.afterQty),
    status: raw.status || null,
    sku: raw.sku || "",
    barcode: raw.barcode || raw.barCode || null,
    productName: raw.productName || "",
    productId: raw.productId || null,
    variantId: raw.variantId || raw.productVariantId || null,
    color: raw.color || "",
    size: raw.size || "",
  };
}

export async function getInventoryMovements(limit = 100): Promise<InventoryMovement[]> {
  const data = await request<any[]>(`/inventory/movements/history?limit=${limit}`);
  return data.map(normalizeMovement);
}

export async function getInventoryMovementActors(): Promise<InventoryMovementActor[]> {
  return request<InventoryMovementActor[]>("/inventory/movements/actors");
}

export async function getInventoryMovementsByProduct(
  productId: string,
  limit = 120,
): Promise<InventoryMovement[]> {
  const data = await request<any[]>(
    `/inventory/movements/product/${encodeURIComponent(productId)}?limit=${limit}`,
  );
  return data.map(normalizeMovement);
}
