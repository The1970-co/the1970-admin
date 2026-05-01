import { API_BASE } from "@/lib/api-base";

function getToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("the1970_token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();

  const headers: HeadersInit = {
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data?.message
        ? Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message
        : `API lỗi ${res.status}`;

    throw new Error(message);
  }

  return data;
}

export type InventorySummary = {
  totalInventoryValue: number;
  totalQty: number;
  totalProducts: number;
  totalSkus: number;
  lowStockSkus: number;
  highestBranch: string;
  branchValues: Record<string, number>;
};

export type MissingCostItem = {
  id: string;
  sku: string;
  color?: string;
  size?: string;
  costPrice?: number;
  product?: {
    id: string;
    name: string;
    category?: string;
  };
};

export type InventoryMovementRow = {
  id: string;
  type: string;
  qty: number;
  beforeQty?: number;
  afterQty?: number;
  note?: string;
  refType?: string;
  refId?: string;
  branchId: string;
  createdAt: string;
  sku?: string;
  productName?: string;
  color?: string;
  size?: string;
};

export async function getInventorySummary(branchId?: string) {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return apiFetch(`/inventory/summary${query}`) as Promise<InventorySummary>;
}

export async function getMissingCostProducts() {
  return apiFetch("/products/missing-cost") as Promise<{
    success: boolean;
    total: number;
    data: MissingCostItem[];
  }>;
}

export async function updateMissingCostBulk(
  items: Array<{ variantId: string; sku?: string; costPrice: number }>,
) {
  return apiFetch("/products/missing-cost/bulk-update", {
    method: "PATCH",
    body: JSON.stringify({ items }),
  }) as Promise<{ success: boolean; updated: number }>;
}

export async function getInventoryMovements(limit = 100) {
  return apiFetch(`/inventory/movements/history?limit=${limit}`) as Promise<InventoryMovementRow[]>;
}

export async function adjustInventory(body: {
  variantId: string;
  branchId?: string;
  qty: number;
  type: "IN" | "OUT" | "SET";
  note?: string;
}) {
  return apiFetch("/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function transferInventory(body: {
  variantId: string;
  qty: number;
  fromBranchId: string;
  toBranchId: string;
  note?: string;
}) {
  return apiFetch("/inventory/transfer", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function importStockReport(file: File) {
  const form = new FormData();
  form.append("file", file);

  return apiFetch("/inventory/import-stock-report", {
    method: "POST",
    body: form,
  });
}

export async function auditSapoFile(file: File) {
  const form = new FormData();
  form.append("file", file);

  return apiFetch("/inventory/audit-sapo-file", {
    method: "POST",
    body: form,
  });
}

export async function auditTwoSapoFiles(stockReportFile: File, productFile: File) {
  const form = new FormData();
  form.append("stockReportFile", stockReportFile);
  form.append("productFile", productFile);

  return apiFetch("/inventory/audit-two-sapo-files", {
    method: "POST",
    body: form,
  });
}
