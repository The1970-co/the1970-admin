"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, PackageSearch, ShoppingBag, User } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", href: "/mobile", icon: Home, match: ["/mobile"] },
  { label: "Báo cáo", href: "/mobile/reports/overview", icon: BarChart3, match: ["/mobile/reports"] },
  { label: "Đơn", href: "/mobile/orders", icon: ShoppingBag, match: ["/mobile/orders"] },
  { label: "SP", href: "/mobile/products", icon: PackageSearch, match: ["/mobile/products"] },
  { label: "Tôi", href: "/mobile/profile", icon: User, match: ["/mobile/profile", "/mobile/account"] },
];

function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]) {
  if (item.href === "/mobile") return pathname === "/mobile" || pathname === "/mobile/home";
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MobileBottomNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[1.5rem] bg-neutral-100 p-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[54px] flex-col items-center justify-center rounded-[1.15rem] px-1 text-[11px] font-bold transition active:scale-[0.96] ${
                active ? "bg-neutral-950 text-white shadow-sm" : "text-neutral-500"
              }`}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
