"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getRoleLabel,
  hasPermission,
  type PermissionKey,
} from "@/lib/authz";
import {
  clearCurrentUserFromStorage,
  getCurrentUserFromStorage,
} from "@/lib/current-user";

type MenuItem = {
  href?: string;
  label: string;
  permission: PermissionKey;
  children?: MenuItem[];
};

const MENU: MenuItem[] = [
  { href: "/control", label: "Tổng quan", permission: "dashboard.view" },

  {
    label: "Đơn hàng",
    permission: "orders.view",
    children: [
      { href: "/orders", label: "Danh sách", permission: "orders.view" },
      { href: "/create-order", label: "Tạo đơn", permission: "orders.create" },
    ],
  },

  {
    label: "Sản phẩm",
    permission: "products.view",
    children: [
      { href: "/products", label: "Danh sách", permission: "products.view" },
      {
        href: "/control/product-categories",
        label: "Danh mục",
        permission: "products.view",
      },
      {
        href: "/control/suppliers",
        label: "Nhà cung cấp",
        permission: "products.view",
      },
      {
        href: "/control/purchase-receipts",
        label: "Phiếu nhập",
        permission: "inventory.view",
      },
      {
        href: "/control/stock-transfers",
        label: "Phiếu chuyển kho",
        permission: "inventory.view",
      },
    ],
  },

  {
    label: "Kho",
    permission: "inventory.view",
    children: [
      { href: "/inventory", label: "Kho hàng", permission: "inventory.view" },
      {
        href: "/inventory-logs",
        label: "Lịch sử kho",
        permission: "inventory.logs.view",
      },
      { href: "/stocktake", label: "Kiểm kho", permission: "stocktake.view" },
    ],
  },

  // 🔥 NEW: TÀI CHÍNH
  {
    label: "Tài chính",
    permission: "reports.view",
    children: [
      {
        href: "/finance/daily",
        label: "Đối soát",
        permission: "reports.view",
      },
    ],
  },

  {
    label: "Vận hành nâng cao",
    permission: "autopilot.view",
    children: [
      {
        href: "/control/autopilot",
        label: "Autopilot",
        permission: "autopilot.view",
      },
      {
        href: "/control/ai-content",
        label: "AI Content",
        permission: "ai_content.view",
      },
    ],
  },

  { href: "/permissions", label: "Phân quyền", permission: "permissions.view" },
  { href: "/settings", label: "Cấu hình", permission: "system.manage" },
  {
    href: "/control/customers",
    label: "Khách hàng",
    permission: "customers.view",
  },
];

export default function AdminShell({
  children,
}: {
  children: ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);
  }, []);

  const visibleMenu = useMemo(() => {
    if (!currentUser?.role) return [];

    return MENU.map((item) => {
      if (!hasPermission(currentUser.role, item.permission)) return null;

      if (item.children?.length) {
        const visibleChildren = item.children.filter((child) =>
          hasPermission(currentUser.role, child.permission)
        );

        if (!visibleChildren.length) return null;

        return {
          ...item,
          children: visibleChildren,
        };
      }

      return item;
    }).filter(Boolean) as MenuItem[];
  }, [currentUser]);

  const handleLogout = () => {
    clearCurrentUserFromStorage();
    window.location.href = "/login";
  };

  const initials = useMemo(() => {
    if (!currentUser?.name) return "U";
    return currentUser.name
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [currentUser]);

  return (
    <div className="h-screen overflow-hidden bg-neutral-50">
      <div
        className="grid h-screen"
        style={{ gridTemplateColumns: "250px minmax(0, 1fr)" }}
      >
        <aside className="h-screen overflow-y-auto border-r border-neutral-200 bg-white px-5 py-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.30em] text-neutral-400">
              Admin panel
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              The 1970
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Core operations dashboard
            </p>
          </div>

          <nav className="mt-8 space-y-3">
            {visibleMenu.map((item) => {
              if (item.children?.length) {
                const parentActive = item.children.some(
                  (child) => pathname === child.href
                );

                return (
                  <div
                    key={item.label}
                    className={`rounded-[26px] border px-3 py-3 transition ${
                      parentActive
                        ? "border-neutral-300 bg-neutral-50"
                        : "border-neutral-200 bg-white"
                    }`}
                  >
                    <div className="px-2 pb-2 text-sm font-semibold text-neutral-950">
                      {item.label}
                    </div>

                    <div className="space-y-1">
                      {item.children.map((child) => {
                        const isActive = pathname === child.href;

                        return (
                          <Link
                            key={child.href}
                            href={child.href!}
                            className={`block rounded-2xl px-3 py-2.5 text-sm transition ${
                              isActive
                                ? "bg-neutral-900 font-medium text-white shadow-sm"
                                : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={`block rounded-2xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-neutral-900 font-medium text-white shadow-sm"
                      : "text-neutral-800 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-[24px] border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
            <p className="font-medium text-neutral-700">Nguyên tắc menu</p>
            <p className="mt-2">
              Ưu tiên rõ nhóm thao tác chính: đơn hàng, sản phẩm, kho, vận hành.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-neutral-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[14px] font-medium uppercase tracking-[0.34em] text-neutral-500">
                  The 1970 Operations
                </p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-neutral-900">
                  Admin System
                </h2>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
                  placeholder="Tìm nhanh order, SKU, sản phẩm..."
                />

                {currentUser ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                      {initials}
                    </div>
                    <div className="leading-tight">
                      <div className="text-sm font-medium text-neutral-900">
                        {currentUser.name} · {currentUser.code}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {currentUser.branchName ||
                          currentUser.branchId ||
                          "Toàn hệ thống"}
                      </div>
                    </div>
                  </div>
                ) : null}

                {currentUser?.role ? (
                  <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
                    {getRoleLabel(currentUser.role)}
                  </div>
                ) : null}

                <button
                  onClick={handleLogout}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-50"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}