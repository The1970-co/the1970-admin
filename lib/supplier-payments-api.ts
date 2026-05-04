import { API_BASE } from "@/lib/api-base";
import type { PurchaseReceipt } from "@/lib/purchase-receipts-api";

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

function normalizeReceipt(receipt: any): PurchaseReceipt {
  return {
    ...receipt,
    items: Array.isArray(receipt?.items) ? receipt.items : [],
    purchaseReceiptPayments: Array.isArray(receipt?.purchaseReceiptPayments)
      ? receipt.purchaseReceiptPayments
      : [],
  };
}

export async function getSupplierPaymentReceipts(): Promise<PurchaseReceipt[]> {
  const data = await request<any[]>("/supplier-payments");
  if (!Array.isArray(data)) return [];
  return data.map(normalizeReceipt);
}

export async function updateSupplierPaymentItemCosts(
  receiptId: string,
  payload: {
    items: {
      itemId: string;
      unitCost: number;
    }[];
  }
) {
  const data = await request<any>(`/supplier-payments/receipt/${receiptId}/item-costs`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return normalizeReceipt(data);
}

export async function paySupplierReceipt(payload: {
  receiptId: string;
  amount: number;
  paymentSourceId: string;
  note?: string;
  paidById?: string;
  paidByName?: string;
}) {
  const data = await request<any>("/supplier-payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeReceipt(data);
}
