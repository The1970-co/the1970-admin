import { API_BASE } from "@/lib/api-base";
export type ApplyStocktakeRow = {
  variantId?: string;
  sku: string;
  counted: number;
  system: number;
  diff: number;
  status: "MATCH" | "MISMATCH" | "NOT_FOUND";
  reason?: string;
  note?: string;
};

export type ApplyStocktakePayload = {
  sessionName: string;
  sessionNote?: string;
  branchId: string;
  rows: ApplyStocktakeRow[];
};

export type ApplyStocktakeResponse = {
  ok: boolean;
  refId: string;
  sessionName: string;
  branchId: string;
  adjustedCount: number;
  totalDelta: number;
  sessionNote?: string;
};


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

export async function applyStocktake(
  payload: ApplyStocktakePayload
): Promise<ApplyStocktakeResponse> {
  return request<ApplyStocktakeResponse>("/stocktake/apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}