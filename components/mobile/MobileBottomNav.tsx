"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Home, User, WalletCards } from "lucide-react";

const items = [
  { label: "Home", href: "/mobile", icon: Home },
  { label: "Báo cáo", href: "/mobile/reports/overview", icon: BarChart3 },
  { label: "Nguồn tiền", href: "/mobile/finance/daily", icon: WalletCards },
  { label: "Sản phẩm", href: "/mobile/products", icon: Boxes },
  { label: "Tôi", href: "/mobile/profile", icon: User },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto grid h-[72px] max-w-md grid-cols-5 pb-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/mobile" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${active ? "text-neutral-950" : "text-neutral-400"}`}>
              <span className={`flex h-8 w-10 items-center justify-center rounded-2xl ${active ? "bg-neutral-950 text-white" : "bg-transparent"}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
