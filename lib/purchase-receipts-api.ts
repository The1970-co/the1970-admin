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

export type PurchaseReceiptPayment = {
  id: string;
  receiptId: string;
  paymentSourceId?: string | null;
  amount: number;
  note?: string | null;
  paidById?: string | null;
  paidByName?: string | null;
  paidAt: string;
  paymentSource?: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
};

export type PurchaseReceipt = {
  id: string;
  receiptCode: string;
  supplierId?: string | null;
  branchId: string;
  status:
    | "DRAFT"
    | "PAYMENT_REQUESTED"
    | "PARTIALLY_PAID"
    | "PAID"
    | "STOCK_IMPORTED"
    | "COMPLETED"
    | "CANCELLED";
  note?: string | null;
  confirmedAt?: string | null;
  supplier?: { id: string; name: string; code: string } | null;
  branch?: { id: string; name: string };
  items: PurchaseReceiptItem[];
  purchaseReceiptPayments?: PurchaseReceiptPayment[];
};

function normalizeReceipt(receipt: any): PurchaseReceipt {
  return {
    ...receipt,
    items: Array.isArray(receipt?.items) ? receipt.items : [],
    purchaseReceiptPayments: Array.isArray(receipt?.purchaseReceiptPayments)
      ? receipt.purchaseReceiptPayments
      : [],
  };
}

export async function getPurchaseReceipts(): Promise<PurchaseReceipt[]> {
  const data = await request<any[]>("/purchase-receipts");
  if (!Array.isArray(data)) return [];
  return data.map(normalizeReceipt);
}

export async function createPurchaseReceipt(payload: {
  supplierId?: string;
  branchId: string;
  note?: string;
  createdById?: string;
  items: { variantId: string; qty: number; unitCost?: number }[];
}) {
  const data = await request<any>("/purchase-receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeReceipt(data);
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
  const data = await request<any>(`/purchase-receipts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeReceipt(data);
}

export async function requestPaymentPurchaseReceipt(id: string) {
  const data = await request<any>(`/purchase-receipts/${id}/request-payment`, {
    method: "PATCH",
  });
  return normalizeReceipt(data);
}

export async function payPurchaseReceipt(
  id: string,
  payload: {
    paymentSourceId?: string | null;
    amount?: number;
    note?: string;
    paidById?: string;
    paidByName?: string;
  }
) {
  const data = await request<any>(`/purchase-receipts/${id}/pay`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeReceipt(data);
}

export async function importStockPurchaseReceipt(id: string, createdById?: string) {
  const data = await request<any>(`/purchase-receipts/${id}/import-stock`, {
    method: "PATCH",
    body: JSON.stringify({ createdById }),
  });
  return normalizeReceipt(data);
}

export async function completePurchaseReceipt(id: string) {
  const data = await request<any>(`/purchase-receipts/${id}/complete`, {
    method: "PATCH",
  });
  return normalizeReceipt(data);
}

export async function cancelPurchaseReceipt(id: string) {
  const data = await request<any>(`/purchase-receipts/${id}/cancel`, {
    method: "PATCH",
  });
  return normalizeReceipt(data);
}
