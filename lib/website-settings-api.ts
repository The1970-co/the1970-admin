import { API_BASE } from "@/lib/api-base";

export type WebsiteSettings = {
  id?: string;
  market: string;
  cartEnabled: boolean;
  checkoutEnabled: boolean;
  newCustomerDiscountEnabled: boolean;
  newCustomerDiscountPercent: number;
  messengerEnabled: boolean;
  messengerUrl: string;
  zaloEnabled: boolean;
  zaloUrl: string;
  defaultBranchId: string;
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
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.message || `API error ${response.status}`);
  }

  return json?.data || json;
}

export function getWebsiteSettings(market = "VN") {
  return request(`/website/settings?market=${encodeURIComponent(market)}`);
}

export function saveWebsiteSettings(
  body: Partial<WebsiteSettings>,
  market = "VN",
) {
  return request(`/website/settings?market=${encodeURIComponent(market)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
