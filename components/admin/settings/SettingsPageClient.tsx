"use client";

import { useEffect, useState } from "react";
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

  const selectedWarehouse = branches.find((b) => b.id === selectedId);

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
    </div>
  );
}