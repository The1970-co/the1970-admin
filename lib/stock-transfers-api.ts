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

export type TransferDirection =
  | "OUTBOUND_TO_BRANCH"
  | "INBOUND_FROM_BRANCH";

export type TransferSourceType = "AUTO" | "REQUEST" | "MANUAL";

export type TransferStatus =
  | "DRAFT"
  | "PENDING"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED";

export type StockTransferItem = {
  id: string;
  transferId?: string;
  variantId: string;
  sku?: string | null;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  qty: number;
};

export type StockTransfer = {
  id: string;
  transferCode: string;
  code?: string;
  direction: TransferDirection;
  sourceType: TransferSourceType;
  sourceRefId?: string | null;

  fromBranchId: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName?: string;

  note?: string | null;
  status: TransferStatus;

  totalLines?: number;
  totalQty?: number;

  createdAt?: string;
  updatedAt?: string;
  confirmedAt?: string | null;
  completedAt?: string | null;

  fromBranch?: { id: string; name: string };
  toBranch?: { id: string; name: string };

  items?: StockTransferItem[];
};

export type OutboundSuggestion = {
  variantId: string;
  sku: string;
  productName: string;
  color?: string | null;
  size?: string | null;

  fromBranchId: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName: string;

  qoAvailableQty?: number;
  storeAvailableQty: number;
  branchMinTarget: number;
  suggestedQty: number;

  soldQty?: number;
  salesVelocityDays?: number;

  reason: string;
};

export async function getStockTransfers(params?: {
  direction?: TransferDirection;
  sourceType?: TransferSourceType;
  status?: TransferStatus;
  branchId?: string;
  keyword?: string;
}): Promise<StockTransfer[]> {
  const search = new URLSearchParams();

  if (params?.direction) search.set("direction", params.direction);
  if (params?.sourceType) search.set("sourceType", params.sourceType);
  if (params?.status) search.set("status", params.status);
  if (params?.branchId) search.set("branchId", params.branchId);
  if (params?.keyword) search.set("keyword", params.keyword);

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request<StockTransfer[]>(`/stock-transfers${suffix}`);
}

export async function getStockTransferDetail(
  id: string
): Promise<StockTransfer> {
  return request<StockTransfer>(`/stock-transfers/${id}`);
}

export async function createStockTransfer(payload: {
  fromBranchId: string;
  toBranchId: string;
  note?: string;
  items: { variantId: string; qty: number }[];
}) {
  const direction =
    payload.toBranchId === "QO" ? "INBOUND_FROM_BRANCH" : "OUTBOUND_TO_BRANCH";

  return request<StockTransfer>("/stock-transfers", {
    method: "POST",
    body: JSON.stringify({
      direction,
      sourceType: "MANUAL",
      fromBranchId: payload.fromBranchId,
      toBranchId: payload.toBranchId,
      note: payload.note,
      createdById: "web-admin",
      createdByName: "Admin Web",
      items: payload.items,
    }),
  });
}

export async function confirmStockTransfer(id: string) {
  return request(`/stock-transfers/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CONFIRMED",
      confirmedById: "web-admin",
      confirmedByName: "Admin Web",
    }),
  });
}

export async function cancelStockTransfer(id: string) {
  return request(`/stock-transfers/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CANCELLED",
    }),
  });
}

export async function previewOutboundSuggestions(payload: {
  maxPerVariant?: number;
  branchMinTargets?: Record<string, number>;
  toBranchIds?: string[];
  season?: "ALL" | "SUMMER" | "WINTER";
  salesVelocityDays?: number;
  minSoldQty?: number;
}) {
  return request<{
    defaultMinTarget?: number;
    maxPerVariant?: number;
    branchMinTargets?: Record<string, number>;
    toBranchIds?: string[];
    season?: "ALL" | "SUMMER" | "WINTER";
    salesVelocityDays?: number;
    minSoldQty?: number;
    total: number;
    suggestions: OutboundSuggestion[];
  }>("/stock-transfers/suggestions/outbound/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createOutboundTransfersFromSuggestions(payload: {
  maxPerVariant?: number;
  branchMinTargets?: Record<string, number>;
  toBranchIds?: string[];
  season?: "ALL" | "SUMMER" | "WINTER";
  salesVelocityDays?: number;
  minSoldQty?: number;
  createdById?: string;
  createdByName?: string;
}) {
  return request<{
    success: boolean;
    createdCount: number;
    transfers: StockTransfer[];
  }>("/stock-transfers/suggestions/outbound/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSelectedOutboundTransfersFromSuggestions(payload: {
  createdById?: string;
  createdByName?: string;
  items: {
    variantId: string;
    toBranchId: string;
    qty: number;
  }[];
}) {
  return request<{
    success: boolean;
    createdCount: number;
    transfers: StockTransfer[];
  }>("/stock-transfers/suggestions/outbound/create-selected", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  
}
  export async function runAutoRebalanceNow() {
  return request<{
    success: boolean;
    createdCount: number;
  }>("/stock-transfers/auto-rebalance/run-now", {
    method: "POST",
  });
}