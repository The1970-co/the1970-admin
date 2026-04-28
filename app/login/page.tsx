"use client";

import { API_BASE } from "@/lib/api-base";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setCurrentUserToStorage,
  setTokenToStorage,
  clearCurrentUserFromStorage,
} from "@/lib/current-user";


function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
          <path d="M9.9 5.2A12.6 12.6 0 0 1 12 5c6.5 0 10 7 10 7a16.3 16.3 0 0 1-4.1 4.8" />
          <path d="M6.2 6.2C3.8 7.8 2 12 2 12a16.7 16.3 0 0 0 7 5.7" />
        </>
      )}
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [secondPassword, setSecondPassword] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [step, setStep] = useState<"login" | "second">("login");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saveSession = (data: any) => {
    const token = data?.token || data?.accessToken || data?.access_token;
    const user = data?.user || data?.staff || data?.data?.user;

    if (!token) throw new Error("Backend không trả về token.");
    if (!user) throw new Error("Backend không trả về user.");

    setTokenToStorage(token);
    setCurrentUserToStorage(user);

    router.replace("/control");
    const role = String(user?.role || user?.appRole || user?.type || "").toLowerCase();
    if (role === "retail-staff") {
      router.replace("/pos");
      return;
    }

    if (role === "fulltime") {
      router.replace("/create-order");
      return;
    }

    if (role === "owner" || role === "admin") {
      router.replace("/control");
      return;
    }

    setError("Tài khoản chưa được gán màn hình truy cập. Vui lòng liên hệ quản trị viên.");
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();

    try {
      setLoading(true);
      setError("");
      clearCurrentUserFromStorage();

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: employeeCode.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Đăng nhập thất bại.");
      }

      if (data?.needsSecondPassword) {
        setTempToken(data.tempToken);
        setSecondPassword("");
        setStep("second");
        return;
      }

      saveSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSecondPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!/^\d{6}$/.test(secondPassword)) {
      setError("Mã bảo mật lớp 2 phải gồm đúng 6 số.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/auth/second-password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, secondPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Mã bảo mật lớp 2 không đúng.");
      }

      saveSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực lớp 2 thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <div className="grid min-h-screen xl:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden overflow-hidden bg-neutral-950 xl:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.06),_transparent_26%)]" />

          <div className="relative flex h-full flex-col justify-between p-12 text-white">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.34em] text-white/42">
                The 1970 Operations
              </p>
              <h1 className="mt-7 text-5xl font-semibold tracking-[-0.05em] text-white">
                Staff Login
              </h1>
            </div>

            <div className="space-y-4">
              <div className="rounded-[30px] border border-white/10 bg-white/[0.04] px-6 py-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                  Internal System
                </p>
                <p className="mt-3 text-base leading-7 text-white/58">
                  Dành cho vận hành nội bộ, bán hàng, kho và quản trị hệ thống.
                </p>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.04] px-6 py-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                  Restricted Access
                </p>
                <p className="mt-3 text-base leading-7 text-white/58">
                  Truy cập theo tài khoản nhân viên đã được cấp quyền trong hệ
                  thống.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-[520px]">
            <div className="rounded-[38px] border border-neutral-200 bg-white p-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] md:p-10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                  Admin panel
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-neutral-900">
                  {step === "login"
                    ? "Đăng nhập nhân viên"
                    : "Xác thực bảo mật"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  {step === "login"
                    ? "Đăng nhập bằng tài khoản nhân viên được cấp quyền."
                    : "Nhập mã bảo mật lớp 2 để tiếp tục."}
                </p>
              </div>

              {step === "login" ? (
                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Tài khoản nhân viên
                    </label>
                    <input
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder="VD: NV001 / ADMIN"
                      autoComplete="off"
                      name="staff-code-1970"
                      className="h-14 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none transition focus:border-neutral-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu"
                        autoComplete="current-password"
                        name="password"
                        className="h-14 w-full rounded-2xl border border-neutral-300 px-4 pr-12 text-sm outline-none transition focus:border-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-neutral-900"
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 ${loading ? "cursor-not-allowed opacity-70" : ""
                      }`}
                  >
                    {loading ? "Đang đăng nhập..." : "Vào hệ thống"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSecondPassword} className="mt-8 space-y-5">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Tài khoản này đã bật bảo mật lớp 2. Không lưu mã này trên
                    trình duyệt.
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Mã bảo mật lớp 2
                    </label>
                    <input
                      type="text"
                      name="the1970-security-code"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      inputMode="numeric"
                      maxLength={6}
                      value={secondPassword}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setSecondPassword(val);
                      }}
                      placeholder="Nhập mã bảo mật lớp 2"
                      className="h-14 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none transition focus:border-neutral-900"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || !secondPassword}
                    className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 ${loading ? "cursor-not-allowed opacity-70" : ""
                      }`}
                  >
                    {loading ? "Đang xác thực..." : "Xác nhận bảo mật"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("login");
                      setTempToken("");
                      setSecondPassword("");
                      setError("");
                    }}
                    className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Quay lại đăng nhập
                  </button>
                </form>
              )}

              <div className="mt-6 text-xs text-neutral-400">
                API:{" "}
                {step === "login"
                  ? `${API_BASE}/auth/login`
                  : `${API_BASE}/auth/second-password/verify`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
