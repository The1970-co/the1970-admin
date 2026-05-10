"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import WorkspaceTabs from "@/components/admin/layout/WorkspaceTabs";
import BranchTransferNotifications from "@/components/admin/BranchTransferNotifications";
import { getRoleLabel } from "@/lib/authz";
import { useAuth } from "@/components/admin/auth/AuthProvider";
import { getRequiredPermissionForPath } from "@/lib/route-permissions";
import { PERMISSIONS } from "@/lib/permissions";

type MenuItem = {
  href?: string;
  label: string;
  permission: string;
  children?: MenuItem[];
};

const MENU: MenuItem[] = [
  { href: "/control", label: "Tổng quan", permission: PERMISSIONS.MENU_DASHBOARD },
  {
    label: "Đơn hàng",
    permission: PERMISSIONS.MENU_ORDERS,
    children: [
      { href: "/orders", label: "Danh sách", permission: PERMISSIONS.MENU_ORDERS },
      { href: "/create-order", label: "Tạo đơn", permission: PERMISSIONS.MENU_CREATE_ORDER },
      { href: "/pos", label: "POS bán tại quầy", permission: PERMISSIONS.MENU_POS },
      { href: "/returns", label: "Đơn trả hàng", permission: PERMISSIONS.MENU_RETURNS },
    ],
  },
  {
    label: "Sản phẩm",
    permission: PERMISSIONS.MENU_PRODUCTS,
    children: [
      { href: "/products", label: "Danh sách", permission: PERMISSIONS.MENU_PRODUCTS },
      { href: "/promotions", label: "Khuyến mại", permission: PERMISSIONS.MENU_PROMOTIONS },
      { href: "/control/product-categories", label: "Danh mục", permission: PERMISSIONS.MENU_PRODUCT_CATEGORIES },
      { href: "/control/suppliers", label: "Nhà cung cấp", permission: PERMISSIONS.MENU_SUPPLIERS },
    ],
  },
  {
    label: "Kho",
    permission: PERMISSIONS.MENU_INVENTORY,
    children: [
      { href: "/inventory", label: "Kho hàng", permission: PERMISSIONS.MENU_INVENTORY },
      { href: "/inventory-logs", label: "Lịch sử kho", permission: PERMISSIONS.MENU_INVENTORY_LOGS },
      { href: "/control/purchase-receipts", label: "Phiếu nhập", permission: PERMISSIONS.MENU_PURCHASE_RECEIPT },
      { href: "/control/stock-transfers", label: "Phiếu chuyển kho", permission: PERMISSIONS.MENU_STOCK_TRANSFER },
      { href: "/stocktake", label: "Kiểm kho", permission: PERMISSIONS.MENU_STOCKTAKE },
      { href: "/control/warehouse-map", label: "Sơ đồ kho 3D", permission: PERMISSIONS.MENU_WAREHOUSE_MAP },
    ],
  },
  {
    label: "Tài chính",
    permission: PERMISSIONS.MENU_FINANCE,
    children: [
      { href: "/finance/daily", label: "Tổng quan dòng tiền", permission: PERMISSIONS.MENU_FINANCE },
      { href: "/finance/cash-receipts", label: "Phiếu thu", permission: "menu.cash_voucher" },
      { href: "/finance/cash-payments", label: "Phiếu chi", permission: "menu.cash_voucher" },
      { href: "/finance/ghn-reconciliation", label: "Đối soát COD GHN", permission: PERMISSIONS.MENU_SHIPPING_RECONCILE },
      { href: "/finance/local-delivery", label: "Đối soát nội thành", permission: PERMISSIONS.MENU_SHIPPING_RECONCILE },
      { href: "/finance/revenue", label: "Báo cáo doanh thu", permission: PERMISSIONS.MENU_REPORTS },
      { href: "/finance/supplier-payments", label: "Thanh toán nhà cung cấp", permission: PERMISSIONS.MENU_SUPPLIER_PAYMENTS },
    ],
  },
  {
    label: "Vận hành nâng cao",
    permission: PERMISSIONS.MENU_AUTOPILOT,
    children: [
      { href: "/control/autopilot", label: "Autopilot", permission: PERMISSIONS.MENU_AUTOPILOT },
      { href: "/control/ai-content", label: "AI Content", permission: PERMISSIONS.MENU_AI_CONTENT },
    ],
  },
  {
    label: "Hệ thống",
    permission: "menu.system_group",
    children: [
      { href: "/permissions", label: "Phân quyền", permission: PERMISSIONS.MENU_PERMISSIONS },
      { href: "/settings", label: "Cấu hình", permission: PERMISSIONS.MENU_SETTINGS },
      { href: "/print-center", label: "Trung tâm in ấn", permission: PERMISSIONS.MENU_PRINT_CENTER },
    ],
  },
  {
    label: "Khách hàng",
    permission: PERMISSIONS.MENU_CUSTOMERS,
    children: [
      { href: "/control/customers", label: "Danh sách khách hàng", permission: PERMISSIONS.MENU_CUSTOMERS },
    ],
  },
];

function userRoles(user: any) {
  return [...(Array.isArray(user?.roles) ? user.roles : []), user?.role]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);
}

function normalizeDisplayName(value?: string | null) {
  return String(value || "")
    .replace(/\s+-\s+[A-Za-z0-9À-ỹ]+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeBranchCode(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^[A-Z0-9]{1,4}$/.test(raw)) return raw;

  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function getHeaderStaffName(user: any) {
  const name = normalizeDisplayName(user?.name);
  const branchCode = normalizeBranchCode(user?.branchCode || user?.branchName || user?.branch || user?.branchId);
  if (!name) return "Tài khoản";
  return branchCode ? `${name} - ${branchCode}` : name;
}

function filterMenu(items: MenuItem[], can: (permission?: string | null) => boolean): MenuItem[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const children = filterMenu(item.children, can);
        if (!children.length) return null;
        return { ...item, children };
      }

      return can(item.permission) ? item : null;
    })
    .filter(Boolean) as MenuItem[];
}

function getFirstHref(items: MenuItem[]): string {
  for (const item of items) {
    if (item.href) return item.href;
    const child = getFirstHref(item.children || []);
    if (child) return child;
  }
  return "";
}

function SidebarContent({
  visibleMenu,
  pathname,
  onNavigate,
}: {
  visibleMenu: MenuItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div>
        <p className="text-[11px] uppercase tracking-[0.30em] text-neutral-400">Admin panel</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">The 1970</h1>
        <p className="mt-1 text-sm text-neutral-500">Core operations dashboard</p>
      </div>

      <nav className="mt-8 space-y-3">
        {visibleMenu.map((item) => {
          if (item.children?.length) {
            const parentActive = item.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
            return (
              <div key={item.label} className={`rounded-[26px] border px-3 py-3 transition ${parentActive ? "border-neutral-300 bg-neutral-50" : "border-neutral-200 bg-white"}`}>
                <div className="px-2 pb-2 text-sm font-semibold text-neutral-950">{item.label}</div>
                <div className="space-y-1">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                    return (
                      <Link key={child.href} href={child.href!} onClick={onNavigate} className={`block rounded-2xl px-3 py-2.5 text-sm transition ${isActive ? "bg-neutral-900 font-medium text-white shadow-sm" : "text-neutral-700 hover:bg-neutral-100"}`}>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href!} onClick={onNavigate} className={`block rounded-2xl px-4 py-3 text-sm transition ${isActive ? "bg-neutral-900 font-medium text-white shadow-sm" : "text-neutral-800 hover:bg-neutral-100"}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function AdminShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { user, loading, checked, error, can, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleMenu = useMemo(() => filterMenu(MENU, can), [can]);
  const requiredPermission = useMemo(() => getRequiredPermissionForPath(pathname), [pathname]);
  const canAccessCurrentRoute = !requiredPermission || can(requiredPermission);

  useEffect(() => {
    if (!checked || loading || !user || canAccessCurrentRoute) return;
    const firstHref = getFirstHref(visibleMenu);
    if (firstHref && pathname !== firstHref) router.replace(firstHref);
  }, [checked, loading, user, canAccessCurrentRoute, visibleMenu, pathname, router]);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();
  }, [user]);

  if (!checked || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        Đang kiểm tra quyền từ hệ thống...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        {error || "Phiên đăng nhập không hợp lệ."}
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-neutral-50">
      <div className="flex h-screen">
        <aside className="hidden h-screen w-[250px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-white px-5 py-6 lg:block">
          <SidebarContent visibleMenu={visibleMenu} pathname={pathname} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-neutral-200 bg-white px-3 py-3 md:px-6 md:py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <button type="button" onClick={() => setMobileMenuOpen(true)} className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-lg text-neutral-900 lg:hidden" aria-label="Mở menu">
                  ☰
                </button>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500 md:text-[14px] md:tracking-[0.34em]">The 1970 Operations</p>
                  <h2 className="mt-1 truncate text-[18px] font-semibold tracking-tight text-neutral-900 md:text-[18px]">{title || "Admin System"}</h2>
                </div>
              </div>

              <div className="hidden flex-col gap-3 md:flex md:flex-row md:items-center">
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">{initials}</div>
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-neutral-900">{getHeaderStaffName(user)}</div>
                    <div className="mt-1 text-xs text-neutral-500">Chi nhánh làm việc</div>
                  </div>
                </div>

                {userRoles(user).length ? <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">{getRoleLabel(userRoles(user)[0])}</div> : null}

                <button onClick={logout} className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-50">
                  Đăng xuất
                </button>
              </div>
            </div>
          </header>

          <WorkspaceTabs />

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 pb-24 md:p-6">
            {canAccessCurrentRoute ? (
              children
            ) : (
              <div className="rounded-[28px] border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
                Tài khoản này chưa được cấp quyền truy cập màn này.
              </div>
            )}
          </main>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} aria-label="Đóng menu" />
          <aside className="relative h-full w-[84vw] max-w-[330px] overflow-y-auto bg-white px-5 py-6 shadow-2xl">
            <div className="mb-5 flex justify-end">
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50">Đóng</button>
            </div>
            <SidebarContent visibleMenu={visibleMenu} pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      ) : null}

      <BranchTransferNotifications />
    </div>
  );
}
