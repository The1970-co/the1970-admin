import { API_BASE } from "@/lib/api-base";

function token() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("the1970_token") ||
    ""
  );
}

async function request(path: string, init?: RequestInit) {
  const t = token();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(json?.message)
      ? json.message.join(", ")
      : json?.message;
    throw new Error(message || `API error ${res.status}`);
  }
  return json?.data || json;
}

export type WebsiteImageDraft = {
  url: string;
  altVi?: string;
  altEn?: string;
  sortOrder?: number;
};

export type WebsiteProductPayload = {
  productId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketVn: boolean;
  marketInternational: boolean;
  featured: boolean;
  sortOrder: number;
  titleVi: string;
  titleEn?: string;
  shortDescriptionVi?: string;
  shortDescriptionEn?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  coverImageUrl?: string;
  seoTitleVi?: string;
  seoTitleEn?: string;
  seoDescriptionVi?: string;
  seoDescriptionEn?: string;
  images: WebsiteImageDraft[];
};

export function getWebsiteProducts(q = "") {
  return request(`/website/products?q=${encodeURIComponent(q)}`);
}
export function createWebsiteProduct(body: WebsiteProductPayload) {
  return request("/website/products", { method: "POST", body: JSON.stringify(body) });
}
export function updateWebsiteProduct(id: string, body: WebsiteProductPayload) {
  return request(`/website/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
export function deleteWebsiteProduct(id: string) {
  return request(`/website/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function searchMasterProducts(q: string) {
  const t = token();
  const res = await fetch(`${API_BASE}/products?q=${encodeURIComponent(q)}&limit=30`, {
    headers: {
      Accept: "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || "Không tìm được sản phẩm nội bộ.");
  return Array.isArray(json) ? json : json?.data || json?.items || [];
}

export async function uploadWebsiteImage(file: File) {
  const t = token();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/products/upload-image`, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || "Upload ảnh thất bại.");
  const url = String(json?.url || json?.secure_url || json?.data?.url || "").trim();
  if (!url) throw new Error("Backend không trả URL ảnh.");
  return url;
}
