"use client";

import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import WorkspaceTabs from "@/components/admin/layout/WorkspaceTabs";
import BranchTransferNotifications from "@/components/admin/BranchTransferNotifications";
import { getRoleLabel } from "@/lib/authz";
import {
  clearCurrentUserFromStorage,
  getCurrentUserFromStorage,
} from "@/lib/current-user";

type MenuItem = {
  href?: string;
  label: string;
  permission: string;
  children?: MenuItem[];
};

const MENU: MenuItem[] = [
  { href: "/control", label: "Tổng quan", permission: "menu.dashboard" },
  {
    label: "Đơn hàng",
    permission: "menu.orders",
    children: [
      { href: "/orders", label: "Danh sách", permission: "menu.orders" },
      { href: "/create-order", label: "Tạo đơn", permission: "menu.create_order" },
      { href: "/pos", label: "POS bán tại quầy", permission: "menu.pos" },
      { href: "/returns", label: "Đơn trả hàng", permission: "menu.returns" },
    ],
  },
  {
    label: "Sản phẩm",
    permission: "menu.products",
    children: [
      { href: "/products", label: "Danh sách", permission: "menu.products" },
      { href: "/promotions", label: "Khuyến mại", permission: "menu.promotions" },
      { href: "/control/product-categories", label: "Danh mục", permission: "menu.product_categories" },
      { href: "/control/suppliers", label: "Nhà cung cấp", permission: "menu.suppliers" },
    ],
  },
  {
    label: "Kho",
    permission: "menu.inventory",
    children: [
      { href: "/inventory", label: "Kho hàng", permission: "menu.inventory" },
      { href: "/inventory-logs", label: "Lịch sử kho", permission: "menu.inventory_logs" },
      { href: "/control/purchase-receipts", label: "Phiếu nhập", permission: "menu.purchase_receipt" },
      { href: "/control/stock-transfers", label: "Phiếu chuyển kho", permission: "menu.stock_transfer" },
      { href: "/stocktake", label: "Kiểm kho", permission: "menu.stocktake" },
      { href: "/control/warehouse-map", label: "Sơ đồ kho 3D", permission: "menu.warehouse_map" },
    ],
  },
  {
    label: "Tài chính",
    permission: "menu.finance",
    children: [
      { href: "/finance/daily", label: "Tổng quan dòng tiền", permission: "menu.finance" },
      { href: "/finance/ghn-reconciliation", label: "Đối soát COD GHN", permission: "menu.shipping_reconcile" },
      { href: "/finance/revenue", label: "Báo cáo doanh thu", permission: "menu.reports" },
      { href: "/finance/supplier-payments", label: "Thanh toán nhà cung cấp", permission: "menu.supplier_payments" },
    ],
  },
  {
    label: "Vận hành nâng cao",
    permission: "menu.autopilot",
    children: [
      { href: "/control/autopilot", label: "Autopilot", permission: "menu.autopilot" },
      { href: "/control/ai-content", label: "AI Content", permission: "menu.ai_content" },
    ],
  },
  { href: "/permissions", label: "Phân quyền", permission: "menu.permissions" },
  { href: "/settings", label: "Cấu hình", permission: "menu.settings" },
  { href: "/control/customers", label: "Khách hàng", permission: "menu.customers" },
];

type BranchPermission = {
  branchId?: string | null;
  canView?: boolean;
  canSell?: boolean;
  canViewOwnOrders?: boolean;
  canViewBranchOrders?: boolean;
  canCreateOrder?: boolean;
  canApproveOrder?: boolean;
  canCancelOrder?: boolean;
  canHandleReturn?: boolean;
  canStocktake?: boolean;
  canTransferStock?: boolean;
  canReceiveStock?: boolean;
  canViewStock?: boolean;
  canManageStock?: boolean;
  canViewCustomer?: boolean;
  canEditCustomer?: boolean;
};

type BranchRole = {
  branchId?: string | null;
  roleCode?: string | null;
};

const ROLE_PERMISSION_KEYS: Record<string, Array<keyof BranchPermission>> = {
  owner: [
    "canView",
    "canSell",
    "canViewOwnOrders",
    "canViewBranchOrders",
    "canCreateOrder",
    "canApproveOrder",
    "canCancelOrder",
    "canHandleReturn",
    "canStocktake",
    "canTransferStock",
    "canReceiveStock",
    "canViewStock",
    "canManageStock",
    "canViewCustomer",
    "canEditCustomer",
  ],
  admin: [
    "canView",
    "canSell",
    "canViewOwnOrders",
    "canViewBranchOrders",
    "canCreateOrder",
    "canApproveOrder",
    "canCancelOrder",
    "canHandleReturn",
    "canStocktake",
    "canTransferStock",
    "canReceiveStock",
    "canViewStock",
    "canManageStock",
    "canViewCustomer",
    "canEditCustomer",
  ],
  "branch-manager": [
    "canView",
    "canSell",
    "canViewOwnOrders",
    "canViewBranchOrders",
    "canCreateOrder",
    "canApproveOrder",
    "canCancelOrder",
    "canHandleReturn",
    "canStocktake",
    "canTransferStock",
    "canReceiveStock",
    "canViewStock",
    "canManageStock",
    "canViewCustomer",
    "canEditCustomer",
  ],
  fulltime: [
    "canView",
    "canSell",
    "canViewOwnOrders",
    "canViewBranchOrders",
    "canCreateOrder",
    "canHandleReturn",
    "canStocktake",
    "canTransferStock",
    "canReceiveStock",
    "canViewStock",
    "canViewCustomer",
  ],
  "retail-staff": [
    "canView",
    "canSell",
    "canViewOwnOrders",
    "canCreateOrder",
    "canHandleReturn",
    "canViewStock",
    "canViewCustomer",
  ],
  "stock-auditor": ["canView", "canViewStock", "canStocktake"],
  "stock-staff": [
    "canView",
    "canViewStock",
    "canManageStock",
    "canStocktake",
    "canTransferStock",
    "canReceiveStock",
  ],
};

function userRoles(user: any) {
  return [...(Array.isArray(user?.roles) ? user.roles : []), user?.role]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);
}

function isOwnerOrAdmin(user: any) {
  const roles = userRoles(user);
  return roles.includes("owner") || roles.includes("admin");
}

function getUserPermissionKeys(user: any) {
  const keys = new Set<string>();

  if (Array.isArray(user?.permissions)) {
    user.permissions.forEach((permission: any) => {
      if (permission) keys.add(String(permission));
    });
  }

  if (Array.isArray(user?.permissionKeys)) {
    user.permissionKeys.forEach((permission: any) => {
      if (permission) keys.add(String(permission));
    });
  }

  const branchPermissions = Array.isArray(user?.branchPermissions)
    ? user.branchPermissions
    : [];

  branchPermissions.forEach((row: any) => {
    if (Array.isArray(row?.permissionKeys)) {
      row.permissionKeys.forEach((permission: any) => {
        if (permission) keys.add(String(permission));
      });
    }
  });

  return keys;
}

function hasDirectAppPermission(user: any, permission: string) {
  if (isOwnerOrAdmin(user)) return true;
  return getUserPermissionKeys(user).has(permission);
}

function normalizeId(value: any) {
  return String(value || "").trim();
}

function getCurrentBranchId(user: any) {
  return normalizeId(user?.branchId || user?.workingBranchId || user?.currentBranchId);
}

function getScopedMenuPermissionKeys(user: any) {
  const keys = new Set<string>();
  const currentBranchId = getCurrentBranchId(user);
  const rows = Array.isArray(user?.branchPermissions) ? user.branchPermissions : [];

  // Với nhân viên theo chi nhánh, menu phải lấy từ permissionKeys của đúng chi nhánh đang làm việc.
  // Không fallback từ branchRoles/legacy flags/action permissions để tránh tick action làm lòi menu.
  const scopedRows = currentBranchId
    ? rows.filter((row: any) => normalizeId(row?.branchId) === currentBranchId)
    : rows;

  scopedRows.forEach((row: any) => {
    if (Array.isArray(row?.permissionKeys)) {
      row.permissionKeys.forEach((permission: any) => {
        const key = String(permission || "");
        if (key.startsWith("menu.")) keys.add(key);
      });
    }
  });

  // Chỉ dùng global menu keys khi user không có branchPermissions.
  // Tránh case nhân viên cũ còn cache/global key làm hiện menu sai chi nhánh.
  if (!rows.length) {
    [...(Array.isArray(user?.permissions) ? user.permissions : []), ...(Array.isArray(user?.permissionKeys) ? user.permissionKeys : [])].forEach((permission: any) => {
      const key = String(permission || "");
      if (key.startsWith("menu.")) keys.add(key);
    });
  }

  return keys;
}

function hasExplicitBranchPermission(
  user: any,
  keys: Array<keyof BranchPermission>,
) {
  if (isOwnerOrAdmin(user)) return true;

  const permissionRows = Array.isArray(user?.branchPermissions)
    ? user.branchPermissions
    : [];

  return permissionRows.some((row: BranchPermission) =>
    keys.some((key) => Boolean(row?.[key])),
  );
}

function hasAnyBranchPermission(
  user: any,
  keys: Array<keyof BranchPermission>,
) {
  if (isOwnerOrAdmin(user)) return true;

  const hasLegacyPermission = hasExplicitBranchPermission(user, keys);

  if (hasLegacyPermission) return true;

  const roleRows = Array.isArray(user?.branchRoles) ? user.branchRoles : [];

  return roleRows.some((row: BranchRole) => {
    const roleCode = String(row?.roleCode || "").toLowerCase();
    const rolePermissions = ROLE_PERMISSION_KEYS[roleCode] || [];
    return keys.some((key) => rolePermissions.includes(key));
  });
}

function hasAnyAppPermission(user: any, permissions: string[]) {
  if (isOwnerOrAdmin(user)) return true;
  return permissions.some((permission) => hasDirectAppPermission(user, permission));
}

function canSeeMenuItem(user: any, item: MenuItem) {
  if (!user) return false;
  if (isOwnerOrAdmin(user)) return true;

  // Sidebar chỉ được điều khiển bằng quyền menu.*.
  // Action permissions như orders.create, orders.approve, inventory.view... không được làm hiện menu.
  if (!String(item.permission || "").startsWith("menu.")) return false;

  return getScopedMenuPermissionKeys(user).has(item.permission);
}

function normalizeDisplayName(value?: string | null) {
  return String(value || "")
    .replace(/\s+-\s+[A-Za-z0-9À-ỹ]+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeBranchCode(value?: string | null) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  if (/^[A-Z0-9]{1,4}$/.test(raw)) return raw;

  const words = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function getHeaderStaffName(user: any) {
  const name = normalizeDisplayName(user?.name);
  const branchCode = normalizeBranchCode(
    user?.branchCode || user?.branchName || user?.branch || user?.branchId,
  );
  if (!name) return "Tài khoản";
  if (name.includes(" - ")) return name;
  return branchCode ? `${name} - ${branchCode}` : name;
}

function getPasswordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function getPasswordLabel(score: number) {
  if (score <= 2) return "Yếu";
  if (score === 3 || score === 4) return "Khá";
  return "Mạnh";
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
              (child) => pathname === child.href,
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
                        onClick={onNavigate}
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
              onClick={onNavigate}
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
    </>
  );
}

export default function AdminShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [openChangePassword, setOpenChangePassword] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const pathname = usePathname();

  useEffect(() => {
    const storedUser = getCurrentUserFromStorage();
    setCurrentUser(storedUser);

    apiJson("/auth/me")
      .then((data) => {
        const nextUser = data?.user || data;
        if (!nextUser) return;

        setCurrentUser(nextUser);

        try {
          localStorage.setItem("currentUser", JSON.stringify(nextUser));
          localStorage.setItem(
            "the1970_current_user",
            JSON.stringify(nextUser),
          );
        } catch {
          // ignore storage sync error
        }
      })
      .catch(() => {
        // dùng user trong localStorage nếu auth/me lỗi
      });
  }, []);

  const passwordScore = useMemo(
    () => getPasswordScore(newPassword),
    [newPassword],
  );
  const passwordValid = passwordScore === 5;
  const passwordMatch = newPassword && newPassword === confirmPassword;

  const visibleMenu = useMemo(() => {
    if (!currentUser?.role) return [];

    return MENU.map((item) => {
      if (item.children?.length) {
        const visibleChildren = item.children.filter((child) =>
          canSeeMenuItem(currentUser, child),
        );

        if (!visibleChildren.length) return null;

        return { ...item, children: visibleChildren };
      }

      if (!canSeeMenuItem(currentUser, item)) return null;
      return item;
    }).filter(Boolean) as MenuItem[];
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await apiJson("/auth/logout", {
        method: "POST",
      });
    } catch {
      // vẫn logout local nếu backend lỗi
    } finally {
      clearCurrentUserFromStorage();
      window.location.href = "/login";
    }
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

  const resetPasswordModal = () => {
    setOpenChangePassword(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword.trim()) {
      setPasswordError("Vui lòng nhập mật khẩu cũ.");
      return;
    }

    if (!passwordValid) {
      setPasswordError(
        "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.",
      );
      return;
    }

    if (!passwordMatch) {
      setPasswordError("Mật khẩu nhập lại chưa khớp.");
      return;
    }

    try {
      setPasswordSaving(true);

      await apiJson("/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      setPasswordSuccess("Đổi mật khẩu thành công.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        resetPasswordModal();
      }, 700);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Đổi mật khẩu thất bại.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

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
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-lg text-neutral-900 lg:hidden"
                  aria-label="Mở menu"
                >
                  ☰
                </button>

                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500 md:text-[14px] md:tracking-[0.34em]">
                    The 1970 Operations
                  </p>
                  <h2 className="mt-1 truncate text-[18px] font-semibold tracking-tight text-neutral-900 md:text-[18px]">
                    {title || "Admin System"}
                  </h2>
                </div>
              </div>

              <div className="hidden flex-col gap-3 md:flex md:flex-row md:items-center">
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
                        {getHeaderStaffName(currentUser)}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Chi nhánh làm việc
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
                  onClick={() => setOpenChangePassword(true)}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-50"
                >
                  Đổi mật khẩu
                </button>

                <button
                  onClick={handleLogout}
                  className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 transition hover:bg-neutral-50"
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 md:hidden">
              {currentUser ? (
                <div className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="truncate text-xs font-medium text-neutral-900">
                    {getHeaderStaffName(currentUser)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {currentUser?.role ? getRoleLabel(currentUser.role) : "Tài khoản"}
                  </div>
                </div>
              ) : null}

              <button
                onClick={() => setOpenChangePassword(true)}
                className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700"
              >
                Mật khẩu
              </button>

              <button
                onClick={handleLogout}
                className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700"
              >
                Thoát
              </button>
            </div>
          </header>

          <WorkspaceTabs />

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 pb-24 md:p-6">
            {children}
          </main>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Đóng menu"
          />

          <aside className="relative h-full w-[84vw] max-w-[330px] overflow-y-auto bg-white px-5 py-6 shadow-2xl">
            <div className="mb-5 flex justify-end">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Đóng
              </button>
            </div>

            <SidebarContent
              visibleMenu={visibleMenu}
              pathname={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <BranchTransferNotifications />

      {openChangePassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-neutral-950">
                  Đổi mật khẩu admin
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Áp dụng cho tài khoản đang đăng nhập.
                </p>
              </div>

              <button
                onClick={resetPasswordModal}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Đóng
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Mật khẩu cũ
                </label>
                <div className="mt-2 flex rounded-2xl border border-neutral-300 bg-white">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                    placeholder="Nhập mật khẩu cũ"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword((v) => !v)}
                    className="px-4 text-sm text-neutral-500"
                  >
                    {showOldPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Mật khẩu mới
                </label>
                <div className="mt-2 flex rounded-2xl border border-neutral-300 bg-white">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                    placeholder="Ít nhất 8 ký tự"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="px-4 text-sm text-neutral-500"
                  >
                    {showNewPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div
                        key={item}
                        className={`h-2 flex-1 rounded-full ${
                          passwordScore >= item
                            ? passwordScore <= 2
                              ? "bg-red-500"
                              : passwordScore <= 4
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            : "bg-neutral-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    Độ mạnh:{" "}
                    <span className="font-medium text-neutral-800">
                      {getPasswordLabel(passwordScore)}
                    </span>
                    . Yêu cầu: 8 ký tự, chữ hoa, chữ thường, số và ký tự đặc
                    biệt.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">
                  Nhập lại mật khẩu mới
                </label>
                <div className="mt-2 flex rounded-2xl border border-neutral-300 bg-white">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="px-4 text-sm text-neutral-500"
                  >
                    {showConfirmPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>

                {confirmPassword ? (
                  <p
                    className={`mt-2 text-xs ${
                      passwordMatch ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {passwordMatch
                      ? "Mật khẩu nhập lại khớp."
                      : "Mật khẩu nhập lại chưa khớp."}
                  </p>
                ) : null}
              </div>

              {passwordError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {passwordError}
                </div>
              ) : null}

              {passwordSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  {passwordSuccess}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-4">
              <button
                onClick={resetPasswordModal}
                className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleChangePassword}
                disabled={
                  passwordSaving ||
                  !oldPassword ||
                  !passwordValid ||
                  !passwordMatch
                }
                className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passwordSaving ? "Đang lưu..." : "Lưu mật khẩu"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
