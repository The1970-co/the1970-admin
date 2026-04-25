const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

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

export type PurchaseReceiptItem = {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  color?: string | null;
  size?: string | null;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

export type PurchaseReceipt = {
  id: string;
  receiptCode: string;
  supplierId?: string | null;
  branchId: string;
  status: "DRAFT" | "STOCK_IMPORTED" | "COMPLETED" | "CANCELLED";
  note?: string | null;
  confirmedAt?: string | null;
  supplier?: { id: string; name: string; code: string } | null;
  branch?: { id: string; name: string };
  items: PurchaseReceiptItem[];
};

export async function getPurchaseReceipts(): Promise<PurchaseReceipt[]> {
  return request<PurchaseReceipt[]>("/purchase-receipts");
}

export async function createPurchaseReceipt(payload: {
  supplierId?: string;
  branchId: string;
  note?: string;
  createdById?: string;
  items: { variantId: string; qty: number; unitCost?: number }[];
}) {
  return request<PurchaseReceipt>("/purchase-receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePurchaseReceipt(
  id: string,
  payload: {
    supplierId?: string | null;
    branchId?: string;
    note?: string;
    items?: { variantId: string; qty: number; unitCost?: number }[];
  }
) {
  return request<PurchaseReceipt>(`/purchase-receipts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function importStockPurchaseReceipt(id: string, createdById?: string) {
  return request<PurchaseReceipt>(`/purchase-receipts/${id}/import-stock`, {
    method: "PATCH",
    body: JSON.stringify({ createdById }),
  });
}

export async function completePurchaseReceipt(id: string) {
  return request<PurchaseReceipt>(`/purchase-receipts/${id}/complete`, {
    method: "PATCH",
  });
}

export async function cancelPurchaseReceipt(id: string) {
  return request<PurchaseReceipt>(`/purchase-receipts/${id}/cancel`, {
    method: "PATCH",
  });
}