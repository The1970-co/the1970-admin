const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

function getTokenFromStorage() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getTokenFromStorage();

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

export type StocktakeAreaScopeType = "MAP" | "AISLE" | "RACK";

export type StocktakeArea = {
  id: string;
  sessionId: string;
  branchId: string;
  mapId?: string | null;
  scopeType: StocktakeAreaScopeType;
  aisle?: string | null;
  rackId?: string | null;
  rackCode?: string | null;
  label: string;
  status: string;
};

export async function createStocktakeArea(payload: {
  sessionId: string;
  branchId: string;
  mapId?: string;
  scopeType: StocktakeAreaScopeType;
  aisle?: string;
  rackId?: string;
  rackCode?: string;
  label: string;
}) {
  return request<StocktakeArea>("/stocktake-areas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}