import { apiJson } from "@/lib/api";

export type FinanceDailyParams = {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  paymentSourceId?: string;
  status?: string;
  q?: string;
};

export type LocalDeliveryReconciliationParams = {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  carrier?: string;
  status?: string;
  q?: string;
};

export type MarkLocalDeliveryDeliveredPayload = {
  collectCod?: boolean;
  paymentSourceId?: string;
  amount?: number;
  note?: string;
};

function cleanParams(params: Record<string, any>) {
  const search = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (!text) return;
    search.set(key, text);
  });

  return search.toString();
}

export async function getFinanceDaily(params: FinanceDailyParams = {}) {
  const query = cleanParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    branchId: params.branchId || "ALL",
    paymentSourceId: params.paymentSourceId || "ALL",
    status: params.status || "ALL",
    q: params.q || "",
  });

  return apiJson<any>(`/finance/daily${query ? `?${query}` : ""}`);
}

export async function getLocalDeliveryReconciliation(
  params: LocalDeliveryReconciliationParams = {}
) {
  const query = cleanParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    branchId: params.branchId || "ALL",
    carrier: params.carrier || "ALL",
    status: params.status || "ALL",
    q: params.q || "",
  });

  return apiJson<any>(
    `/finance/local-delivery-reconciliation${query ? `?${query}` : ""}`
  );
}

export async function markLocalDeliveryDelivered(
  orderId: string,
  payload: MarkLocalDeliveryDeliveredPayload = {}
) {
  return apiJson<any>(
    `/finance/local-delivery-reconciliation/${encodeURIComponent(orderId)}/delivered`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function markLocalDeliveryCodReceived(params: {
  orderId: string;
  paymentSourceId?: string;
  amount?: number;
  note?: string;
}) {
  return apiJson<any>(
    `/finance/local-delivery-reconciliation/${encodeURIComponent(params.orderId)}/cod-received`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentSourceId: params.paymentSourceId,
        amount: params.amount,
        note: params.note,
      }),
    }
  );
}
