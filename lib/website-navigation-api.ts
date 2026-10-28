import { API_BASE } from "@/lib/api-base";

export type WebsiteNavLink = {
  id: string;
  labelVi: string;
  labelEn: string;
  link: string;
  enabled: boolean;
};

export type WebsiteNavColumn = {
  id: string;
  titleVi: string;
  titleEn: string;
  links: WebsiteNavLink[];
};

export type WebsiteNavPromo = {
  id: string;
  enabled: boolean;
  imageUrl: string;
  titleVi: string;
  titleEn: string;
  link: string;
};

export type WebsiteNavigationSettings = {
  menuFontFamily: "SERIF" | "SANS";
  menuFontSize: number;
  menuGap: number;
  megaMenuHeightVh: number;
  megaOverlayOpacity: number;
  headerSticky: boolean;
  announcementEnabled: boolean;
  announcementTextVi: string;
  announcementLink: string;

  // Logo header có thể upload từ Admin. Optional để tương thích config cũ.
  headerLogoUrl?: string;
  headerLogoWidth?: number;
  headerLogoAlign?: "LEFT" | "CENTER" | "RIGHT";
};

export type WebsiteNavItem = {
  id: string;
  enabled: boolean;
  type: "LINK" | "MEGA";
  labelVi: string;
  labelEn: string;
  link: string;
  columns: WebsiteNavColumn[];
  promos: WebsiteNavPromo[];

  // Backward compatibility với config cũ.
  promo?: Omit<WebsiteNavPromo, "id">;
};

export type WebsiteNavigationConfig = {
  version: number;
  settings: WebsiteNavigationSettings;
  items: WebsiteNavItem[];
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

export function getWebsiteNavigation(market = "VN") {
  return request(`/website/navigation?market=${encodeURIComponent(market)}`);
}

export function saveWebsiteNavigation(
  config: WebsiteNavigationConfig,
  market = "VN",
) {
  return request(`/website/navigation?market=${encodeURIComponent(market)}`, {
    method: "PATCH",
    body: JSON.stringify({ config }),
  });
}

export function publishWebsiteNavigation(market = "VN") {
  return request(
    `/website/navigation/publish?market=${encodeURIComponent(market)}`,
    { method: "POST" },
  );
}
