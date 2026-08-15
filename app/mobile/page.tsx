"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { getCurrentUserFromStorage, getCurrentUserPermissions } from "@/lib/current-user";
import { BarChart3, Bot, Boxes, ClipboardCheck, ShoppingBag, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function rolesOf(user: any) {
  return [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
    user?.roleCode,
    user?.staffRole,
  ]
    .map((item) => String(item || "").toLowerCase())
    .filter(Boolean);
}

function isOwnerOrAdmin(user: any) {
  const roles = rolesOf(user);
  return roles.includes("owner") || roles.includes("admin");
}

function hasAny(keys: string[], candidates: string[]) {
  return candidates.some((key) => keys.includes(key));
}

function isStocktakeOnlyUser(user: any) {
  if (!user || isOwnerOrAdmin(user)) return false;
  const keys = getCurrentUserPermissions(user, user?.activeBranchId || user?.branchId);
  if (keys.includes("*")) return false;

  const hasStocktake = hasAny(keys, [
    "stocktake.view",
    "stocktake.scan",
    "stocktake.create",
    "stocktake.apply",
    "stocktake.edit",
    "inventory.stocktake",
  ]);

  const hasOtherMobileArea = hasAny(keys, [
    "dashboard.view",
    "reports.view",
    "orders.view",
    "orders.create",
    "finance.view",
    "cash_voucher.view",
    "products.view",
    "inventory.view",
    "marketing.view",
  ]);

  const roleText = rolesOf(user).join(" ");
  return (
    (hasStocktake && !hasOtherMobileArea) ||
    roleText.includes("stocktake") ||
    roleText.includes("kiemkho") ||
    roleText.includes("kiểm kho")
  );
}

function MainCard({
  href,
  eyebrow,
  title,
  description,
  icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[2rem] bg-neutral-950 p-6 text-white shadow-sm transition active:scale-[0.985]"
    >
      <div className="inline-flex rounded-2xl bg-white/10 p-3 text-white">{icon}</div>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-white/40">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black leading-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-white/60">{description}</p>
    </Link>
  );
}

function SmallCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[150px] flex-col justify-between rounded-[1.75rem] bg-neutral-950 p-5 text-white shadow-sm transition active:scale-[0.985]"
    >
      <div className="text-white">{icon}</div>
      <div>
        <div className="text-lg font-black leading-tight">{title}</div>
        <div className="mt-2 text-xs leading-5 text-white/55">{description}</div>
      </div>
    </Link>
  );
}

export default function MobileEntryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const current = getCurrentUserFromStorage();
    setUser(current);
    if (isStocktakeOnlyUser(current)) router.replace("/mobile/stocktake");
  }, [router]);

  const stocktakeOnly = useMemo(() => isStocktakeOnlyUser(user), [user]);

  if (stocktakeOnly) {
    return (
      <main className="min-h-[100dvh] bg-neutral-100 px-5 py-14 pb-32 text-neutral-950">
        <div className="mx-auto max-w-md">
          <div className="rounded-[2rem] bg-neutral-950 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/45">The 1970 Operations</p>
            <h1 className="mt-4 text-3xl font-black">Kiểm kho mobile</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">Tài khoản này chỉ dùng cho kiểm kho trên điện thoại.</p>
          </div>
          <Link href="/mobile/stocktake" className="mt-5 flex items-center gap-4 rounded-[2rem] bg-neutral-950 p-5 text-white shadow-sm active:scale-[0.985]">
            <div className="rounded-2xl bg-white/10 p-3 text-white"><ClipboardCheck className="h-6 w-6" /></div>
            <div>
              <p className="text-lg font-black">Vào kiểm kho</p>
              <p className="mt-1 text-sm text-white/55">Quét mã vạch, nhập số lượng, tiếp tục phiên đang mở.</p>
            </div>
          </Link>
        </div>
        <MobileBottomNav />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 pt-14">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">The 1970 Operations</div>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-neutral-950">Bạn muốn xem gì hôm nay?</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">Chọn một khu vực để xem nhanh tình hình vận hành, doanh thu, đơn hàng và kiểm kho.</p>
        </div>

        <div className="flex flex-col gap-5">
          <MainCard
            href="/mobile/reports/overview"
            eyebrow="Báo cáo vận hành"
            title="Tổng quan báo cáo"
            description="Đơn hàng đã tạo, doanh thu, sản phẩm bán chạy và cảnh báo tồn kho."
            icon={<BarChart3 className="h-7 w-7" />}
          />

          <MainCard
            href="/mobile/finance/daily"
            eyebrow="Dòng tiền hôm nay"
            title="Tổng quan nguồn tiền"
            description="Tiền mặt, chuyển khoản, COD pending, phiếu thu chi và số dư cuối ngày."
            icon={<WalletCards className="h-7 w-7" />}
          />

          <div className="grid grid-cols-2 gap-4">
            <SmallCard
              href="/mobile/orders"
              title="Đơn hàng"
              description="Xem đơn mới, chi tiết đơn."
              icon={<ShoppingBag className="h-7 w-7" />}
            />
            <SmallCard
              href="/mobile/products"
              title="Sản phẩm"
              description="Tra SKU, tồn kho, biến thể."
              icon={<Boxes className="h-7 w-7" />}
            />
            <SmallCard
              href="/mobile/stocktake"
              title="Kiểm kho"
              description="Quét mã vạch, nhập số lượng."
              icon={<ClipboardCheck className="h-7 w-7" />}
            />
            <SmallCard
              href="/mobile/autopilot"
              title="Autopilot"
              description="Ads, scale, tồn kho, bài mới."
              icon={<Bot className="h-7 w-7" />}
            />
          </div>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
