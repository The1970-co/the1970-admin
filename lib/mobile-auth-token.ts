import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "the1970_mobile_token";
const USER_KEY = "the1970_mobile_user";

function safeLocalStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeLocalStorageGet(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeLocalStorageRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; secure; samesite=lax`;
  } catch {}
}

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`));

    return match ? decodeURIComponent(match.split("=")[1] || "") : "";
  } catch {
    return "";
  }
}

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function hydrateToken(token: string) {
  if (!token) return;

  safeLocalStorageSet("token", token);
  safeLocalStorageSet("accessToken", token);
  safeLocalStorageSet("the1970_access_token", token);
  setCookie(TOKEN_KEY, token, 60 * 60 * 24 * 90);
}

function hydrateUser(user: unknown) {
  if (!user) return;

  const text = typeof user === "string" ? user : JSON.stringify(user || {});
  safeLocalStorageSet("currentUser", text);
  safeLocalStorageSet("the1970_current_user", text);
  safeLocalStorageSet("the1970_mobile_user", text);
}

export async function saveMobileSession(token: string, user?: unknown) {
  if (!token) return;

  hydrateToken(token);
  hydrateUser(user || {});
  safeLocalStorageSet("the1970_login_from", "mobile");

  if (isNativeApp()) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
    await Preferences.set({ key: USER_KEY, value: JSON.stringify(user || {}) });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("the1970:auth-changed"));
  }
}

export async function getMobileToken() {
  let token =
    safeLocalStorageGet("token") ||
    safeLocalStorageGet("accessToken") ||
    safeLocalStorageGet("the1970_access_token") ||
    getCookie(TOKEN_KEY) ||
    "";

  if (!token && isNativeApp()) {
    const result = await Preferences.get({ key: TOKEN_KEY });
    token = result.value || "";
  }

  if (token) hydrateToken(token);
  return token;
}

export async function restoreMobileUser() {
  let userText =
    safeLocalStorageGet("the1970_mobile_user") ||
    safeLocalStorageGet("the1970_current_user") ||
    safeLocalStorageGet("currentUser") ||
    "";

  if (!userText && isNativeApp()) {
    const result = await Preferences.get({ key: USER_KEY });
    userText = result.value || "";
  }

  if (userText) {
    hydrateUser(userText);
    try {
      return JSON.parse(userText);
    } catch {
      return null;
    }
  }

  return null;
}

export async function clearMobileSession() {
  safeLocalStorageRemove("token");
  safeLocalStorageRemove("accessToken");
  safeLocalStorageRemove("the1970_access_token");
  safeLocalStorageRemove("currentUser");
  safeLocalStorageRemove("the1970_current_user");
  safeLocalStorageRemove("the1970_mobile_user");
  safeLocalStorageRemove("the1970_login_from");
  setCookie(TOKEN_KEY, "", 0);

  if (isNativeApp()) {
    await Preferences.remove({ key: TOKEN_KEY });
    await Preferences.remove({ key: USER_KEY });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("the1970:auth-changed"));
  }
}
