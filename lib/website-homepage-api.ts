import { API_BASE } from "@/lib/api-base";

export type HomepageImage = { id: string; url: string; altVi?: string; altEn?: string; link?: string };
export type HomepageItem = {
  id: string; titleVi: string; titleEn: string; subtitleVi: string; subtitleEn: string;
  bodyVi: string; bodyEn: string; ctaVi: string; ctaEn: string; link: string;
  mediaMode: "single" | "slider"; autoplayMs: number; images: HomepageImage[];
};
export type HomepageBlockType = "HERO_SPLIT" | "CARD_ROW" | "STORY_WIDE" | "STORY_SPLIT" | "PRODUCT_GRID";
export type HomepageBlock = {
  id: string; type: HomepageBlockType; enabled: boolean; titleVi: string; titleEn: string;
  layout: string; settings: Record<string, any>; items: HomepageItem[];
};
export type HomepageConfig = { version: number; blocks: HomepageBlock[] };

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || localStorage.getItem("accessToken") || localStorage.getItem("the1970_token") || "";
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
  if (!res.ok) throw new Error(json?.message || `API error ${res.status}`);
  return json?.data || json;
}

export function getHomepageAdmin(market = "VN") {
  return request(`/website/homepage?market=${encodeURIComponent(market)}`);
}
export function saveHomepageDraft(config: HomepageConfig, market = "VN") {
  return request(`/website/homepage?market=${encodeURIComponent(market)}`, {
    method: "PATCH", body: JSON.stringify({ config }),
  });
}
export function publishHomepage(market = "VN") {
  return request(`/website/homepage/publish?market=${encodeURIComponent(market)}`, { method: "POST" });
}
