import { API_BASE } from "@/lib/api-base";

export type WebsiteSettings = {
  market: string;
  cartEnabled: boolean;
  checkoutEnabled: boolean;
  newCustomerDiscountEnabled: boolean;
  newCustomerDiscountPercent: number;
  messengerEnabled: boolean;
  messengerUrl?: string | null;
  zaloEnabled: boolean;
  zaloUrl?: string | null;
  defaultBranchId?: string | null;
};

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
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `API error ${res.status}`);
  return json?.data || json;
}

export const getWebsiteSettings = (market = "VN") =>
  request(`/website/settings?market=${encodeURIComponent(market)}`);

export const saveWebsiteSettings = (body: Partial<WebsiteSettings>, market = "VN") =>
  request(`/website/settings?market=${encodeURIComponent(market)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
