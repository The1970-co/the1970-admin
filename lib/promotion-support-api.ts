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
  return [];
}

export async function searchPromotionProducts(keyword: string) {
  const q = encodeURIComponent(keyword.trim());
  const candidates = [
    `/products?q=${q}&page=1&pageSize=20`,
    `/products?search=${q}&page=1&pageSize=20`,
    `/products?keyword=${q}&page=1&pageSize=20`,
  ];

  for (const path of candidates) {
    const rows = await request(path);
    if (rows.length) return rows;
  }

  return [];
}

export async function getPromotionBranches() {
  const candidates = ["/branches", "/settings/branches", "/inventory/branches"];

  for (const path of candidates) {
    const rows = await request(path);
    if (rows.length) return rows;
  }

  return [];
}
