import { apiFetch } from "@/lib/api";

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
  sessionName?: string;
  branchId?: string;
  adjustedCount: number;
  totalDelta: number;
  sessionNote?: string;
  status?: string;
};

export type StocktakeSessionListItem = {
  id: string;
  branchId: string;
  name: string;
  note?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  appliedAt?: string | null;
  workers?: Array<{ id: string; name: string; zone?: string | null; deviceName?: string | null; status?: string | null }>;
  _count?: { scanEvents?: number };
};

export type StocktakeKpi = {
  totalSnapshotSku?: number;
  totalSku: number;
  totalRows?: number;
  countedSku: number;
  uncountedSku: number;
  matchedSku: number;
  mismatchSku: number;
  discrepancySku?: number;
  notFoundSku: number;
  overSku?: number;
  shortSku?: number;
  totalSnapshotQty: number;
  totalCountedQty: number;
  totalDiffQty: number;
  totalDiffValue: number;
};

export type StocktakeSessionDetail = StocktakeSessionListItem & {
  kpi?: StocktakeKpi;
  recentLogs?: StocktakeLogItem[];
};

export type StocktakeItemStatus = "MATCH" | "MISMATCH" | "UNCOUNTED" | "NOT_FOUND" | string;

export type StocktakeDetailItem = {
  sessionId?: string;
  branchId?: string;
  variantId?: string | null;
  sku: string;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  barcode?: string | null;
  snapshotQty: number;
  countedQty: number;
  diff: number;
  unitCost?: number;
  costPrice?: number;
  diffValue?: number;
  valueDiff?: number;
  status: StocktakeItemStatus;
  statusLabel?: string;
  diffType?: string;
  isCounted?: boolean;
  zone?: string | null;
  rackCode?: string | null;
  locationCode?: string | null;
  workerId?: string | null;
  workerName?: string | null;
  lastScannedAt?: string | null;
  eventCount?: number;
};

export type StocktakeLogItem = {
  id: string;
  createdAt: string;
  sessionId: string;
  workerId?: string | null;
  workerName?: string | null;
  branchId?: string;
  variantId?: string | null;
  sku: string;
  barcode?: string | null;
  qtyDelta: number;
  zone?: string | null;
  locationCode?: string | null;
  status: string;
  note?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init as any);

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

export type StocktakeSessionListResponse = {
  items: StocktakeSessionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type StocktakeSessionsOverview = {
  total: number;
  running: number;
  finished: number;
  applied: number;
  cancelled: number;
  totalWorkers: number;
  totalScanEvents: number;
};

export async function applyStocktake(payload: ApplyStocktakePayload): Promise<ApplyStocktakeResponse> {
  return request<ApplyStocktakeResponse>("/stocktake/apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listStocktakeSessions(params?: {
  branchId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<StocktakeSessionListResponse> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set("branchId", params.branchId);
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const data = await request<StocktakeSessionListResponse | StocktakeSessionListItem[]>(`/stocktake-sessions${suffix}`);

  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      limit: data.length || params?.limit || 50,
      totalPages: 1,
    };
  }

  return data;
}

export async function getStocktakeSessionsOverview(params?: {
  branchId?: string;
  status?: string;
  from?: string;
  to?: string;
}): Promise<StocktakeSessionsOverview> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set("branchId", params.branchId);
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const suffix = q.toString() ? `?${q.toString()}` : "";

  return request<StocktakeSessionsOverview>(`/stocktake-sessions/summary/overview${suffix}`);
}

export async function getStocktakeSessionDetail(id: string): Promise<StocktakeSessionDetail> {
  return request<StocktakeSessionDetail>(`/stocktake-sessions/${id}/detail`);
}

export async function getStocktakeSessionItems(
  id: string,
  params?: { status?: string; q?: string },
): Promise<StocktakeDetailItem[]> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.q) q.set("q", params.q);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const data = await request<StocktakeDetailItem[] | { rows?: StocktakeDetailItem[] }>(`/stocktake-sessions/${id}/items${suffix}`);
  return Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
}

export async function getStocktakeUnscannedItems(id: string, qText?: string): Promise<StocktakeDetailItem[]> {
  const q = new URLSearchParams();
  if (qText) q.set("q", qText);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const data = await request<StocktakeDetailItem[] | { rows?: StocktakeDetailItem[] }>(`/stocktake-sessions/${id}/unscanned${suffix}`);
  return Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
}

export async function getStocktakeDiscrepancyItems(id: string, qText?: string): Promise<StocktakeDetailItem[]> {
  const q = new URLSearchParams();
  if (qText) q.set("q", qText);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const data = await request<StocktakeDetailItem[] | { rows?: StocktakeDetailItem[] }>(`/stocktake-sessions/${id}/discrepancies${suffix}`);
  return Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
}

export async function getStocktakeSessionLogs(id: string): Promise<StocktakeLogItem[]> {
  return request<StocktakeLogItem[]>(`/stocktake-sessions/${id}/logs`);
}

export async function applyStocktakeSession(id: string, note?: string): Promise<ApplyStocktakeResponse> {
  return request<ApplyStocktakeResponse>(`/stocktake-sessions/${id}/apply`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export async function finishStocktakeSession(id: string) {
  return request(`/stocktake-sessions/${id}/finish`, { method: "PATCH" });
}

export async function downloadStocktakeSessionExcel(id: string, fallbackFileName = "kiem-kho.xlsx") {
  const res = await apiFetch(`/stocktake-sessions/${id}/export-excel`, {
    cache: "no-store",
  } as any);

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const matched = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const fileName = matched?.[1] ? decodeURIComponent(matched[1]) : fallbackFileName;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function cancelStocktakeSession(id: string): Promise<StocktakeSessionListItem> {
  return request<StocktakeSessionListItem>(`/stocktake-sessions/${id}/cancel`, {
    method: "PATCH",
  });
}

export async function deleteStocktakeSession(id: string): Promise<{ ok: boolean; deleted: boolean; id: string }> {
  return request<{ ok: boolean; deleted: boolean; id: string }>(`/stocktake-sessions/${id}`, {
    method: "DELETE",
  });
}
