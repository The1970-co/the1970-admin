"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const MOBILE_HOME_URL = "https://operations.the1970.co/mobile";

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function shouldStayOnPath(pathname: string) {
  return pathname === "/mobile" || pathname.startsWith("/mobile/");
}

export default function MobileNativeRedirectGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isNativeApp()) return;
    if (shouldStayOnPath(pathname)) return;

    // Trong app iOS, nếu AuthProvider/login web lỡ đẩy sang /control, /login,
    // /orders, /products, /finance... thì kéo ngược về mobile shell ngay.
    try {
      localStorage.setItem("the1970_force_mobile", "1");
      localStorage.setItem("the1970_login_from", "mobile");
    } catch {}

    window.location.replace(MOBILE_HOME_URL);
  }, [pathname]);

  return null;
}
