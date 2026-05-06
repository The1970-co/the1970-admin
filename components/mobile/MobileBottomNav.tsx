"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Home,
  PackageSearch,
  Shirt,
  User,
} from "lucide-react";

const items = [
  { label: "Home", href: "/mobile/home", icon: Home },
  { label: "Đơn", href: "/mobile/orders", icon: ClipboardList },
  { label: "SP", href: "/mobile/products", icon: Shirt },
  { label: "Kho", href: "/mobile/inventory", icon: PackageSearch },
  { label: "Tôi", href: "/mobile/profile", icon: User },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-medium active:scale-95 transition ${
                active ? "text-neutral-950" : "text-neutral-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
