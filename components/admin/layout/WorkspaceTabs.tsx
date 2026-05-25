"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useWorkspaceTabs } from "@/hooks/useWorkspaceTabs";

function WorkspaceTabsInner() {
  const { tabs, removeTab } = useWorkspaceTabs();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPath = `${pathname}${
    searchParams?.toString() ? `?${searchParams.toString()}` : ""
  }`;

  if (!tabs.length) return null;

  return (
    <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || currentPath === tab.href;

          return (
            <div
              key={`${tab.type}-${tab.href}`}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm transition ${
                isActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Link href={tab.href} prefetch={false} className="max-w-[190px] truncate">
                {tab.title}
              </Link>

              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeTab(tab.href);
                }}
                className={`rounded-full p-1 transition ${
                  isActive
                    ? "text-white/70 hover:bg-white/15 hover:text-white"
                    : "text-neutral-400 hover:bg-neutral-200 hover:text-black"
                }`}
                aria-label={`Đóng tab ${tab.title}`}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkspaceTabs() {
  return (
    <Suspense fallback={null}>
      <WorkspaceTabsInner />
    </Suspense>
  );
}