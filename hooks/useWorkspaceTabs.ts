"use client";

import { useEffect, useState } from "react";
import {
  getWorkspaceTabs,
  addWorkspaceTab,
  removeWorkspaceTab,
  type WorkspaceTab,
} from "@/lib/workspace-tabs";

export function useWorkspaceTabs() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);

  const refresh = () => {
    setTabs(getWorkspaceTabs());
  };

  useEffect(() => {
    // load lần đầu
    refresh();

    const handleStorage = () => refresh();
    const handleFocus = () => refresh();
    const handleCustom = () => refresh();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("workspace-tabs-changed", handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("workspace-tabs-changed", handleCustom);
    };
  }, []);

  const addTab = (tab: WorkspaceTab) => {
    addWorkspaceTab(tab);
    // không cần refresh vì đã có event
  };

  const removeTab = (href: string) => {
    removeWorkspaceTab(href);
    // không cần refresh vì đã có event
  };

  return {
    tabs,
    addTab,
    removeTab,
    refresh,
  };
}