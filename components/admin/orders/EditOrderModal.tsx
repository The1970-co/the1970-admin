"use client";

import { useEffect, useState } from "react";
import { type AdminOrder, updateOrder } from "@/lib/orders-api";

type Props = {
  open: boolean;
  order: AdminOrder | null;
  onClose: () => void;
  onSaved: (updated: AdminOrder) => void;
};

export default function EditOrderModal({
  open,
  order,
  onClose,
  onSaved,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingWard, setShippingWard] = useState("");
  const [shippingDistrict, setShippingDistrict] = useState("");
  const [shippingProvince, setShippingProvince] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingFee, setShippingFee] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!order) return;

    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setShippingAddressLine1(order.shippingAddressLine1 || "");
    setShippingAddressLine2(order.shippingAddressLine2 || "");
    setShippingWard(order.shippingWard || "");
    setShippingDistrict(order.shippingDistrict || "");
    setShippingProvince(order.shippingProvince || "");
    setShippingPostalCode(order.shippingPostalCode || "");
    setShippingFee(String(order.shippingFee || 0));
    setNote(order.note || "");
    setError("");
  }, [order]);

  if (!open || !order) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const updated = await updateOrder(order.id, {
        customerName,
        customerPhone,
        shippingAddressLine1,
        shippingAddressLine2,
        shippingWard,
        shippingDistrict,
        shippingProvince,
        shippingPostalCode,
        shippingFee: Number(shippingFee || 0),
        note,
      });

      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được đơn.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Sửa đơn</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Chỉnh nhanh thông tin khách, địa chỉ giao và ghi chú.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Tên khách
            </p>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Số điện thoại
            </p>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Địa chỉ dòng 1
            </p>
            <input
              value={shippingAddressLine1}
              onChange={(e) => setShippingAddressLine1(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Địa chỉ dòng 2
            </p>
            <input
              value={shippingAddressLine2}
              onChange={(e) => setShippingAddressLine2(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Phường / xã
            </p>
            <input
              value={shippingWard}
              onChange={(e) => setShippingWard(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Quận / huyện
            </p>
            <input
              value={shippingDistrict}
              onChange={(e) => setShippingDistrict(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Tỉnh / thành
            </p>
            <input
              value={shippingProvince}
              onChange={(e) => setShippingProvince(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Mã bưu điện
            </p>
            <input
              value={shippingPostalCode}
              onChange={(e) => setShippingPostalCode(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Phí ship
            </p>
            <input
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Ghi chú
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[100px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium"
          >
            Đóng
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}