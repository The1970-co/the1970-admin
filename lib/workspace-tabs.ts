"use client";

export type WorkspaceTab = {
  id: string;
  title: string;
  href: string;
  type: "product" | "order" | "customer" | "inventory" | "other";
};

const KEY = "the1970_workspace_tabs";
const MAX_TABS = 8;

function notifyWorkspaceTabsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("workspace-tabs-changed"));
}

export function getWorkspaceTabs(): WorkspaceTab[] {
  if (typeof window === "undefined") return [];

  try {
    const value = localStorage.getItem(KEY);
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkspaceTabs(tabs: WorkspaceTab[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(tabs.slice(-MAX_TABS)));
  notifyWorkspaceTabsChanged();
}

export function addWorkspaceTab(tab: WorkspaceTab) {
  const tabs = getWorkspaceTabs();
  const filtered = tabs.filter((item) => item.href !== tab.href);
  saveWorkspaceTabs([...filtered, tab]);
}

export function removeWorkspaceTab(href: string) {
  const tabs = getWorkspaceTabs().filter((item) => item.href !== href);
  saveWorkspaceTabs(tabs);
}

export function clearWorkspaceTabs() {
  saveWorkspaceTabs([]);
}
