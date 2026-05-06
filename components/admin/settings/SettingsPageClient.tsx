"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";

type BranchItem = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
};

type WarehouseUI = {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
};

type TotpSetupResult = {
  ok?: boolean;
  secret?: string;
  otpauthUrl?: string;
  qrCodeDataUrl?: string;
  message?: string;
};

function copyText(value: string) {
  if (!value) return;
  void navigator.clipboard?.writeText(value);
}

function Button({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
}) {
  const base = "px-4 py-2 rounded-xl text-sm font-semibold border transition";

  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white border-neutral-900"
      : variant === "danger"
        ? "bg-red-50 text-red-600 border-red-200"
        : "bg-white text-neutral-900 border-neutral-300";

  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`}>
      {children}
    </button>
  );
}

export default function SettingsPageClient() {
  const [branches, setBranches] = useState<WarehouseUI[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [message, setMessage] = useState("");

  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResult | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpVerifying, setTotpVerifying] = useState(false);
  const [totpMessage, setTotpMessage] = useState("");
  const [totpError, setTotpError] = useState("");

  const selectedWarehouse = branches.find((b) => b.id === selectedId);

  const cleanTotpCode = useMemo(() => {
    return String(totpCode || "").replace(/\D/g, "").slice(0, 6);
  }, [totpCode]);

  const loadBranches = async () => {
    try {
      const data: BranchItem[] = await apiJson("/branches");

      const mapped: WarehouseUI[] = data.map((b) => ({
        id: b.id,
        code: b.id,
        name: b.name,
        address: b.address || "",
        phone: b.phone || "",
        email: b.email || "",
        isActive: b.isActive,
      }));

      setBranches(mapped);

      if (mapped.length && !selectedId) {
        setSelectedId(mapped[0].id);
      }
    } catch (err) {
      console.error(err);
      setMessage("Không tải được danh sách kho.");
    }
  };

  useEffect(() => {
    void loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addWarehouse = async () => {
    const code = prompt("Nhập mã kho (vd: QO)");
    if (!code) return;

    const name = prompt("Nhập tên kho");
    if (!name) return;

    try {
      await apiJson("/branches", {
        method: "POST",
        body: JSON.stringify({
          id: code.trim(),
          name: name.trim(),
          address: "",
          phone: "",
          email: "",
        }),
      });

      await loadBranches();
      setSelectedId(code.trim());
      setMessage("Đã tạo kho.");
    } catch (err) {
      console.error(err);
      setMessage("Tạo kho thất bại.");
    }
  };

const saveWarehouseToDb = async () => {
  if (!selectedWarehouse) return;

  console.log("SAVE:", selectedWarehouse); // 👈 ĐẶT Ở ĐÂY

  const nextCode = selectedWarehouse.code.trim();

  try {
    await apiJson(`/branches/${selectedWarehouse.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        newId: nextCode,
        name: selectedWarehouse.name.trim(),
        address: selectedWarehouse.address.trim(),
        phone: selectedWarehouse.phone.trim(),
        email: selectedWarehouse.email.trim(),
      }),
    });

    setSelectedId(nextCode);
    setMessage("Đã lưu kho.");
  } catch (err) {
    console.error(err);
  }
};

  const toggleWarehouse = async (id: string) => {
    try {
      await apiJson(`/branches/${id}/deactivate`, {
        method: "PATCH",
      });

      await loadBranches();
      setMessage("Đã cập nhật trạng thái kho.");
    } catch (err) {
      console.error(err);
      setMessage("Lỗi cập nhật kho.");
    }
  };

  const deleteWarehouse = (id: string) => {
    const ok = confirm("Xóa kho này?");
    if (!ok) return;

    setBranches((prev) => prev.filter((b) => b.id !== id));
    setSelectedId("");
    setMessage("Đã xóa kho trên giao diện. Backend chưa xóa.");
  };

  const updateField = (key: keyof WarehouseUI, value: string) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === selectedId ? { ...b, [key]: value } : b))
    );
  };

  const setupTotp = async () => {
    try {
      setTotpLoading(true);
      setTotpError("");
      setTotpMessage("");

      const data: TotpSetupResult = await apiJson("/auth/totp/setup", {
        method: "POST",
      });

      setTotpSetupData(data);
      setTotpMessage(data.message || "Đã tạo mã QR. Quét bằng Google Authenticator.");
    } catch (err) {
      console.error(err);
      setTotpError(err instanceof Error ? err.message : "Không tạo được mã QR authen.");
    } finally {
      setTotpLoading(false);
    }
  };

  const verifyTotp = async () => {
    if (cleanTotpCode.length !== 6) {
      setTotpError("Nhập đủ mã 6 số từ Google Authenticator.");
      return;
    }

    try {
      setTotpVerifying(true);
      setTotpError("");
      setTotpMessage("");

      const data: { ok?: boolean; message?: string } = await apiJson(
        "/auth/totp/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ code: cleanTotpCode }),
        }
      );

      setTotpMessage(data.message || "Đã bật Google Authenticator.");
      setTotpCode("");
    } catch (err) {
      console.error(err);
      setTotpError(err instanceof Error ? err.message : "Mã authen không đúng.");
    } finally {
      setTotpVerifying(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Cài đặt kho hàng</h1>

      {message && <div className="text-sm text-green-600">{message}</div>}

      <div className="flex gap-6">
        <div className="w-[260px] border rounded-2xl p-3 space-y-2">
          {branches.map((b) => (
            <div
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`p-3 rounded-xl cursor-pointer border ${selectedId === b.id
                  ? "bg-neutral-100 border-neutral-400"
                  : "border-neutral-200"
                }`}
            >
              <div className="font-semibold">{b.name}</div>
              <div className="text-xs text-neutral-500">{b.code}</div>
              {b.phone && (
                <div className="text-xs text-neutral-400 mt-1">{b.phone}</div>
              )}
            </div>
          ))}

          <Button variant="secondary" onClick={addWarehouse}>
            + Thêm kho
          </Button>
        </div>

        {selectedWarehouse && (
          <div className="flex-1 border rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-lg">Chi tiết kho</h2>

            <div>
              <label className="text-sm">Mã kho</label>
              <input
                value={selectedWarehouse.code}
                onChange={(e) => updateField("code", e.target.value)}
                className="w-full border px-3 py-2 rounded-xl mt-1"
              />
            </div>

            <div>
              <label className="text-sm">Tên kho</label>
              <input
                value={selectedWarehouse.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full border px-3 py-2 rounded-xl mt-1"
              />
            </div>

            <div>
              <label className="text-sm">Địa chỉ</label>
              <input
                value={selectedWarehouse.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="w-full border px-3 py-2 rounded-xl mt-1"
              />
            </div>

            <div>
              <label className="text-sm">Số điện thoại</label>
              <input
                value={selectedWarehouse.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full border px-3 py-2 rounded-xl mt-1"
              />
            </div>

            <div>
              <label className="text-sm">Email</label>
              <input
                value={selectedWarehouse.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full border px-3 py-2 rounded-xl mt-1"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => void saveWarehouseToDb()}>
                Lưu thay đổi
              </Button>

              <Button
                variant="secondary"
                onClick={() => toggleWarehouse(selectedWarehouse.id)}
              >
                {selectedWarehouse.isActive ? "Tắt kho" : "Bật kho"}
              </Button>

              <Button
                variant="danger"
                onClick={() => deleteWarehouse(selectedWarehouse.id)}
              >
                Xóa
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-2xl p-5 space-y-5 bg-white">
        <div>
          <h2 className="font-semibold text-lg">Google Authenticator</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Cấu hình mã authen để xác nhận các thao tác nhạy cảm như giao hàng một phần,
            sửa COD hoặc duyệt thao tác quan trọng.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
            {totpSetupData?.qrCodeDataUrl ? (
              <img
                src={totpSetupData.qrCodeDataUrl}
                alt="Google Authenticator QR"
                className="h-52 w-52 rounded-xl bg-white object-contain p-2"
              />
            ) : (
              <div className="text-center text-sm text-neutral-500">
                Bấm tạo mã QR để cài Google Authenticator.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
              <div className="font-semibold text-neutral-800">Cách cài</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Bấm “Tạo mã QR”.</li>
                <li>Mở Google Authenticator hoặc Authy trên điện thoại.</li>
                <li>Quét QR hiển thị trên màn hình.</li>
                <li>Nhập mã 6 số rồi bấm “Bật authen”.</li>
              </ol>
            </div>

            {totpSetupData?.secret ? (
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                  Secret dự phòng
                </div>
                <div className="mt-2 flex gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
                    {totpSetupData.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(totpSetupData.secret || "")}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 md:flex-row">
              <Button onClick={() => void setupTotp()}>
                {totpLoading ? "Đang tạo..." : "Tạo mã QR"}
              </Button>

              <input
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                placeholder="Nhập mã 6 số"
                className="rounded-xl border px-3 py-2 text-sm"
              />

              <Button
                variant="secondary"
                onClick={() => void verifyTotp()}
              >
                {totpVerifying ? "Đang xác nhận..." : "Bật authen"}
              </Button>
            </div>

            {totpMessage ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {totpMessage}
              </div>
            ) : null}

            {totpError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {totpError}
              </div>
            ) : null}

            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Lưu ý: mã này sẽ được dùng cho phần giao hàng một phần / sửa COD.
              Nếu chưa có owner/admin nào bật authen, thao tác nhạy cảm sẽ báo
              “Chủ chưa bật Google Authenticator.”
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}