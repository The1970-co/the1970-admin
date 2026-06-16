"use client";

import { API_BASE } from "@/lib/api-base";
import { useState } from "react";
export default function MobileLoginPage() {

  const [username, setUsername] = useState("ADMIN");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Đăng nhập thất bại");
      }

      if (data?.needsSecondPassword) {
        throw new Error("Tài khoản này đang bật bảo mật lớp 2. Vui lòng đăng nhập trên bản web hoặc tắt bảo mật lớp 2 cho tài khoản mobile.");
      }

      const token = data?.token || data?.accessToken || data?.access_token;
      const user = data?.user || data?.staff || data?.data?.user || {};

      if (!token) {
        throw new Error("Không nhận được token");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("accessToken", token);
      localStorage.setItem("the1970_access_token", token);
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("the1970_current_user", JSON.stringify(user));
      localStorage.setItem("the1970_mobile_user", JSON.stringify(user));
      localStorage.setItem("the1970_login_from", "mobile");
      window.dispatchEvent(new Event("the1970:auth-changed"));

      // Dùng hard reload để WebView/Next guard đọc lại token mới ngay lập tức.
      // Nếu dùng router.replace, lần login đầu có thể còn state cũ và bị đá sang /control.
      window.location.replace("/mobile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
            The 1970
          </div>
          <h1 className="mt-2 text-3xl font-bold text-neutral-950">
            Operations Mobile
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Đăng nhập để xem báo cáo, tồn kho và cảnh báo vận hành.
          </p>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Tài khoản
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base font-medium text-neutral-950 outline-none"
                placeholder="ADMIN"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Mật khẩu
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base font-medium text-neutral-950 outline-none"
                placeholder="••••••"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-neutral-950 text-base font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </div>
        </div>

        <div className="mt-5 text-center text-xs text-neutral-400">
          Internal use only · The 1970 Operations
        </div>
      </div>
    </div>
  );
}
