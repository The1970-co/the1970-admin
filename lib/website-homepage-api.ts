import type {
  HomepageConfig,
  HomepageImage,
  HomepageItem,
  HomepageBlock,
  HomepageBlockType,
} from "./website-homepage-types";

export type {
  HomepageConfig,
  HomepageImage,
  HomepageItem,
  HomepageBlock,
  HomepageBlockType,
};

const PROD_CORE =
  "https://the1970-core-api-production.up.railway.app";

function base() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();

    if (
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return (
        process.env.NEXT_PUBLIC_CORE_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:3001"
      ).replace(/\/$/, "");
    }

    if (
      host === "operations.the1970.co"
    ) {
      return PROD_CORE;
    }
  }

  return (
    process.env.NEXT_PUBLIC_CORE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    PROD_CORE
  ).replace(/\/$/, "");
}

function token() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("the1970_token") ||
    ""
  );
}

async function request(
  path: string,
  init?: RequestInit,
) {
  const t = token();

  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(t
        ? { Authorization: `Bearer ${t}` }
        : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      json?.message || `API error ${res.status}`,
    );
  }

  return json?.data || json;
}

export function getHomepageAdmin(
  market = "VN",
) {
  return request(
    `/website/homepage?market=${encodeURIComponent(
      market,
    )}`,
  );
}

export function saveHomepageDraft(
  config: HomepageConfig,
  market = "VN",
) {
  return request(
    `/website/homepage?market=${encodeURIComponent(
      market,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({ config }),
    },
  );
}

export function publishHomepage(
  market = "VN",
) {
  return request(
    `/website/homepage/publish?market=${encodeURIComponent(
      market,
    )}`,
    {
      method: "POST",
    },
  );
}
