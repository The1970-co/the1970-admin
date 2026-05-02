"use client";

export function getCurrentReturnUrl() {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

export function openInNewTabWithFrom(path: string) {
  const from = getCurrentReturnUrl();
  const url = `${path}${path.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function getReturnUrlFromSearchParams(
  searchParams: URLSearchParams,
  fallback: string
) {
  return searchParams.get("from") || fallback;
}
