"use client";

import { API_BASE } from "@/lib/api-base";
import { useMemo, useState } from "react";

type TotpSetupResponse = {
  ok: boolean;
  secret?: string;
  otpauthUrl?: string;
  qrCodeDataUrl?: string;
  message?: string;
};

type TotpVerifyResponse = {
  ok: boolean;
  message?: string;
};

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "dark";
}) {
  const style =
    tone === "dark"
      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
      : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${style} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {children}
    </button>
  );
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export default function GoogleAuthPage() {
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const statusText = useMemo(() => {
    if (success) return "Đã bật";
    if (qrCodeDataUrl) return "Đã tạo QR";
    return "Chưa bật";
  }, [success, qrCodeDataUrl]);

  const handleSetup = async () => {
    try {
      setLoadingSetup(true);
      setMessage("");
      setSuccess(false);

      const token = getToken();
      if (!token) {
        throw new Error("Không tìm thấy token đăng nhập.");
      }

      const res = await fetch("${API_BASE}/auth/totp/setup", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = (await res.json().catch(() => null)) as TotpSetupResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Không tạo được mã QR.");
      }

      setQrCodeDataUrl(json.qrCodeDataUrl || "");
      setSecret(json.secret || "");
      setMessage(json.message || "Đã tạo mã QR.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tạo được mã QR.");
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      setMessage("");

      const token = getToken();
      if (!token) {
        throw new Error("Không tìm thấy token đăng nhập.");
      }

      if (!code.trim()) {
        throw new Error("Nhập mã authen 6 số trước khi xác nhận.");
      }

      const res = await fetch("${API_BASE}/auth/totp/verify-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
        }),
      });

      const json = (await res.json().catch(() => null)) as TotpVerifyResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Xác nhận Google Authenticator thất bại.");
      }

      setSuccess(true);
      setMessage(json.message || "Đã bật Google Authenticator.");
    } catch (err) {
      setSuccess(false);
      setMessage(
        err instanceof Error ? err.message : "Xác nhận Google Authenticator thất bại."
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen space-y-4 bg-neutral-50 p-4">
      <Panel className="px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">
          The 1970 Operations
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-neutral-900">
          Thiết lập Google Authenticator
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Dùng cho xác nhận thay đổi COD trong chi tiết đơn hàng.
        </p>
      </Panel>

      {message ? (
        <Panel className="px-4 py-3">
          <p
            className={`text-sm ${
              success ? "text-emerald-600" : "text-neutral-700"
            }`}
          >
            {message}
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Trạng thái</p>
              <p className="mt-1 text-sm text-neutral-500">
                Google Authenticator của chủ / admin
              </p>
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : qrCodeDataUrl
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-neutral-200 bg-neutral-100 text-neutral-700"
              }`}
            >
              {statusText}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <ActionButton
              tone="dark"
              onClick={() => void handleSetup()}
              disabled={loadingSetup}
            >
              {loadingSetup ? "Đang tạo QR..." : "Tạo mã QR"}
            </ActionButton>

            <p className="text-xs leading-6 text-neutral-500">
              Bấm tạo mã QR, mở app Google Authenticator trên điện thoại, quét mã,
              rồi nhập mã 6 số để xác nhận bật.
            </p>
          </div>

          {secret ? (
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium text-neutral-500">Secret dự phòng</p>
              <p className="mt-2 break-all font-mono text-[13px] text-neutral-900">
                {secret}
              </p>
            </div>
          ) : null}
        </Panel>

        <Panel className="p-5">
          <div className="grid gap-5 md:grid-cols-[280px_1fr]">
            <div className="flex items-center justify-center">
              <div className="flex h-[280px] w-[280px] items-center justify-center rounded-[24px] border border-dashed border-neutral-300 bg-neutral-50">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Google Authenticator"
                    className="h-[240px] w-[240px] rounded-2xl border border-neutral-200 bg-white p-3"
                  />
                ) : (
                  <div className="px-6 text-center text-sm text-neutral-400">
                    Chưa có mã QR
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <h2 className="text-[17px] font-semibold text-neutral-900">
                Xác nhận bật Google Authenticator
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Sau khi quét QR trên điện thoại, nhập mã 6 số mà ứng dụng hiển thị để hoàn tất thiết lập.
              </p>

              <div className="mt-5">
                <label className="mb-1.5 block text-[12px] font-medium text-neutral-600">
                  Mã authen
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Nhập mã 6 số"
                  className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>

              <div className="mt-4">
                <ActionButton
                  tone="dark"
                  onClick={() => void handleVerify()}
                  disabled={!qrCodeDataUrl || verifying}
                >
                  {verifying ? "Đang xác nhận..." : "Xác nhận bật"}
                </ActionButton>
              </div>

              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs leading-6 text-blue-700">
                  Sau khi bật xong, mã trong Google Authenticator sẽ được dùng khi xác nhận thay đổi COD.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
