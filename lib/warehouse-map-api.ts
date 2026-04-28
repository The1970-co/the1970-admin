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

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export type WarehouseShelf = {
  id: string;
  rackId: string;
  code: string;
  floorNo: number;
  label?: string | null;
};

export type WarehouseRack = {
  id: string;
  mapId: string;
  branchId: string;
  floorId?: string | null;
  zoneId?: string | null;
  code: string;
  name: string;
  zone: string;
  aisle: string;
  rackNo: string;
  floors: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  status: "PENDING" | "IN_PROGRESS" | "FINISHED" | "MISMATCH" | string;
  note?: string | null;
  shelves?: WarehouseShelf[];
};

export type WarehouseFloor = {
  id: string;
  mapId: string;
  name: string;
  level: number;
  note?: string | null;
  zones?: WarehouseZone[];
  doors?: WarehouseDoor[];
};

export type WarehouseZone = {
  id: string;
  mapId: string;
  floorId: string;
  name: string;
  type: "STORAGE" | "OFFICE" | "PACKING" | "RETURN" | "WALKWAY" | "OTHER" | string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string | null;
  note?: string | null;
};

export type WarehouseDoor = {
  id: string;
  mapId: string;
  floorId: string;
  name: string;
  side: "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | string;
  x: number;
  y: number;
  width: number;
};

export type WarehouseMap = {
  id: string;
  branchId: string;
  name: string;
  code: string;
  note?: string | null;
  width: number;
  height: number;
  racks: WarehouseRack[];
  floors?: WarehouseFloor[];
  zones?: WarehouseZone[];
  doors?: WarehouseDoor[];
};

export type CustomLayoutAisle = {
  aisle: string;
  rackCount: number;
  floors?: number;
};

export async function listWarehouseMaps(branchId?: string) {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return request<WarehouseMap[]>(`/warehouse-map${qs}`);
}

export async function getWarehouseMap(id: string) {
  return request<WarehouseMap>(`/warehouse-map/${id}`);
}

export async function getFullWarehouseMap(id: string) {
  return request<WarehouseMap>(`/warehouse-map/${id}/full`);
}

export async function createWarehouseMap(payload: {
  branchId: string;
  name: string;
  code: string;
  note?: string;
  width?: number;
  height?: number;
}) {
  return request<WarehouseMap>("/warehouse-map", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createQuickLayout(mapId: string) {
  return request<{ ok: boolean; created: number; updated?: number; total?: number; message?: string }>(
    `/warehouse-map/${mapId}/quick-layout`,
    { method: "POST" }
  );
}

export async function createCustomWarehouseLayout(
  mapId: string,
  payload: { zone?: string; resetBeforeCreate?: boolean; floorId?: string; aisles: CustomLayoutAisle[] }
) {
  return request<{ ok: boolean; created: number; updated: number; total: number; message?: string }>(
    `/warehouse-map/${mapId}/custom-layout`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function resetWarehouseLayout(mapId: string) {
  return request<{ ok: boolean; message?: string }>(`/warehouse-map/${mapId}/reset-layout`, {
    method: "POST",
  });
}

export async function createRack(payload: {
  mapId: string;
  branchId: string;
  floorId?: string;
  zoneId?: string;
  name: string;
  zone: string;
  aisle: string;
  rackNo: string;
  floors?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  note?: string;
}) {
  return request<WarehouseRack>("/warehouse-map/racks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRack(id: string, payload: Partial<WarehouseRack>) {
  return request<WarehouseRack>(`/warehouse-map/racks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRack(id: string) {
  return request<WarehouseRack>(`/warehouse-map/racks/${id}`, {
    method: "DELETE",
  });
}

export async function createWarehouseFloor(mapId: string, payload: { name: string; level: number; note?: string }) {
  return request<WarehouseFloor>(`/warehouse-map/${mapId}/floors`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createWarehouseZone(
  mapId: string,
  payload: {
    floorId: string;
    name: string;
    type: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    color?: string;
    note?: string;
  }
) {
  return request<WarehouseZone>(`/warehouse-map/${mapId}/zones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWarehouseZone(zoneId: string, payload: Partial<WarehouseZone>) {
  return request<WarehouseZone>(`/warehouse-map/zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWarehouseZone(zoneId: string) {
  return request<{ ok: boolean }>(`/warehouse-map/zones/${zoneId}`, {
    method: "DELETE",
  });
}

export async function createWarehouseDoor(
  mapId: string,
  payload: { floorId: string; name?: string; side?: string; x?: number; y?: number; width?: number }
) {
  return request<WarehouseDoor>(`/warehouse-map/${mapId}/doors`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWarehouseDoor(doorId: string, payload: Partial<WarehouseDoor>) {
  return request<WarehouseDoor>(`/warehouse-map/doors/${doorId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWarehouseDoor(doorId: string) {
  return request<{ ok: boolean }>(`/warehouse-map/doors/${doorId}`, {
    method: "DELETE",
  });
}
