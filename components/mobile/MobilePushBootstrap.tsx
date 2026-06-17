"use client";

import { API_BASE } from "@/lib/api-base";
import { getMobileToken } from "@/lib/mobile-auth-token";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect, useRef } from "react";

function rememberDebug(message: string, extra?: unknown) {
  if (typeof window === "undefined") return;

  try {
    const line = `[${new Date().toISOString()}] ${message}${
      extra ? ` ${JSON.stringify(extra)}` : ""
    }`;
    console.info("[MobilePush]", message, extra || "");
    localStorage.setItem("the1970_mobile_push_debug", line);
  } catch {
    // ignore debug storage errors
  }
}

async function savePushToken(token: string) {
  if (!token) {
    rememberDebug("skip register: empty APNs token");
    return;
  }

  const accessToken = await getMobileToken();

  if (!accessToken) {
    rememberDebug("skip register: missing auth token");
    return;
  }

  const response = await fetch(`${API_BASE}/mobile/push/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      platform: "ios",
      provider: "apns",
      token,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    rememberDebug("register failed", {
      status: response.status,
      body: text.slice(0, 300),
    });
    return;
  }

  rememberDebug("register success", { status: response.status });
}

export default function MobilePushBootstrap() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!Capacitor.isNativePlatform()) {
      rememberDebug("skip: not native platform");
      return;
    }

    let active = true;

    async function setupPush() {
      try {
        rememberDebug("setup start", { platform: Capacitor.getPlatform() });

        await PushNotifications.removeAllListeners();

        await PushNotifications.addListener("registration", async (token) => {
          rememberDebug("registration token received", {
            tokenLength: token.value?.length || 0,
          });
          await savePushToken(token.value);
        });

        await PushNotifications.addListener("registrationError", (error) => {
          rememberDebug("registration error", error);
        });

        await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          const data = event.notification.data || {};
          const orderId = data.orderId || data.order_id;

          if (orderId) {
            window.location.href = `/mobile/orders/${orderId}`;
            return;
          }

          window.location.href = "/mobile";
        });

        const permission = await PushNotifications.requestPermissions();
        rememberDebug("permission result", permission);

        if (!active || permission.receive !== "granted") return;

        await PushNotifications.register();
        rememberDebug("register called");
      } catch (error) {
        rememberDebug("setup failed", error);
      }
    }

    void setupPush();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
