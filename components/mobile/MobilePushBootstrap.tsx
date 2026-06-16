"use client";

import { API_BASE } from "@/lib/api-base";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect } from "react";

function getAuthToken() {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("the1970_access_token") ||
    ""
  );
}

async function savePushToken(token: string) {
  const accessToken = getAuthToken();
  if (!accessToken || !token) return;

  await fetch(`${API_BASE}/mobile/push/register`, {
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
  }).catch((error) => {
    console.error("[MobilePush] save token failed", error);
  });
}

export default function MobilePushBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;

    async function setupPush() {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (!active || permission.receive !== "granted") return;

        await PushNotifications.removeAllListeners();

        PushNotifications.addListener("registration", async (token) => {
          await savePushToken(token.value);
        });

        PushNotifications.addListener("registrationError", (error) => {
          console.error("[MobilePush] registration error", error);
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          const data = event.notification.data || {};
          const orderId = data.orderId || data.order_id;

          if (orderId) {
            window.location.href = `/mobile/orders/${orderId}`;
            return;
          }

          window.location.href = "/mobile";
        });

        await PushNotifications.register();
      } catch (error) {
        console.error("[MobilePush] setup failed", error);
      }
    }

    void setupPush();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
