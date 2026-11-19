"use client";

import { API_BASE } from "@/lib/api-base";
import { getMobileToken } from "@/lib/mobile-auth-token";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect } from "react";

function rememberDebug(message: string, extra?: unknown) {
  if (typeof window === "undefined") return;
  try {
    const line = `[${new Date().toISOString()}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ""}`;
    console.info("[MobilePush]", message, extra ?? "");
    localStorage.setItem("the1970_mobile_push_debug", line);
  } catch {
    // Debug logging must never prevent registration.
  }
}

export default function MobilePushBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let apnsToken = "";
    let synced = false;
    let sending = false;
    let registering = false;
    let lastRegisterAt = 0;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    async function syncToServer(force = false) {
      if (disposed || !apnsToken || sending || (synced && !force)) return;
      const jwt = await getMobileToken();
      if (disposed) return;
      if (!jwt) {
        rememberDebug("APNs token pending: waiting for login", { suffix: apnsToken.slice(-6) });
        return;
      }

      sending = true;
      try {
        const response = await fetch(`${API_BASE}/mobile/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ platform: "ios", provider: "apns", token: apnsToken }),
        });
        if (!response.ok) {
          synced = false;
          rememberDebug("push register failed", { status: response.status, suffix: apnsToken.slice(-6) });
          return;
        }
        synced = true;
        rememberDebug("push register success", { suffix: apnsToken.slice(-6), status: response.status });
      } catch (error) {
        synced = false;
        rememberDebug("push register network error", String(error));
      } finally {
        sending = false;
      }
    }

    async function requestNativeToken() {
      if (disposed || registering || Date.now() - lastRegisterAt < 10000) return;
      registering = true;
      lastRegisterAt = Date.now();
      try {
        const permission = await PushNotifications.checkPermissions();
        if (permission.receive !== "granted") {
          rememberDebug("push permission not granted", permission);
          return;
        }
        await PushNotifications.register();
        rememberDebug("APNs register requested");
      } catch (error) {
        rememberDebug("APNs register failed", String(error));
      } finally {
        registering = false;
      }
    }

    async function setup() {
      try {
        // Do not removeAllListeners: other parts of the app may own their listeners.
        listeners.push(await PushNotifications.addListener("registration", ({ value }) => {
          if (disposed) return;
          if (apnsToken !== value) synced = false;
          apnsToken = value || "";
          rememberDebug("APNs token received", { suffix: apnsToken.slice(-6), length: apnsToken.length });
          void syncToServer();
        }));
        listeners.push(await PushNotifications.addListener("registrationError", error => {
          rememberDebug("APNs registration error", error);
        }));
        listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", event => {
          const data = event.notification.data || {};
          const orderId = data.orderId || data.order_id;
          if (data.type === 'meta_autopilot') window.location.href = '/mobile/autopilot';
          else if (orderId) window.location.href = `/mobile/orders/${encodeURIComponent(String(orderId))}`;
          else if (data.type === "business_report" && (data.kind === "product" || data.kind === "product_test")) {
            const day = /^\d{4}-\d{2}-\d{2}$/.test(String(data.day || "")) ? `?day=${encodeURIComponent(String(data.day))}` : "";
            window.location.href = `/mobile/reports/products${day}`;
          }
          else if (data.type === "business_report") {
            const day = /^\d{4}-\d{2}-\d{2}$/.test(String(data.day || ""))
              ? `?day=${encodeURIComponent(String(data.day))}` : "";
            window.location.href = `/mobile/reports/business${day}`;
          }
          else window.location.href = "/mobile";
        }));

        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
          permission = await PushNotifications.requestPermissions();
        }
        rememberDebug("push permission", permission);
        if (!disposed && permission.receive === "granted") await requestNativeToken();
      } catch (error) {
        rememberDebug("push bootstrap failed", String(error));
      }
    }

    const onResume = () => {
      if (disposed) return;
      // Reassign the token to whichever account is currently logged in.
      if (apnsToken) void syncToServer(true);
      else void requestNativeToken();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onVisibility);

    // If APNs registration happens before JWT is stored, retry after login.
    const retry = window.setInterval(() => {
      if (disposed || document.visibilityState !== "visible") return;
      if (apnsToken) void syncToServer();
      else void requestNativeToken();
    }, 15000);

    void setup();

    return () => {
      disposed = true;
      window.clearInterval(retry);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
      listeners.forEach(listener => { void listener.remove(); });
    };
  }, []);

  return null;
}
