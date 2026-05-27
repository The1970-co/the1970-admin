import { API_BASE } from "./api-base";

async function request(path: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!res.ok) return [];

  const data = await res.json().catch(() => []);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  return [];
}

function uniqueById(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of rows) {
    const id = String(row?.id || row?.sku || row?.code || "").trim();
    if (!id || map.has(id)) continue;
    map.set(id, row);
  }
  return Array.from(map.values());
}

export async function searchPromotionProducts(keyword: string) {
  const q = encodeURIComponent(keyword.trim());
  if (!q) return [];

  const candidates = [
    `/products?q=${q}&page=1&pageSize=50&includeVariants=true`,
    `/products?search=${q}&page=1&pageSize=50&includeVariants=true`,
    `/products?keyword=${q}&page=1&pageSize=50&includeVariants=true`,
    `/products/search?q=${q}&page=1&pageSize=50&includeVariants=true`,
    `/products/variants?q=${q}&page=1&pageSize=50`,
  ];

  const results: any[] = [];

  for (const path of candidates) {
    const rows = await request(path);
    if (rows.length) results.push(...rows);
  }

  return uniqueById(results);
}

export async function getPromotionBranches() {
  const candidates = ["/branches", "/settings/branches", "/inventory/branches"];

  for (const path of candidates) {
    const rows = await request(path);
    if (rows.length) return rows;
  }

  return [];
}
