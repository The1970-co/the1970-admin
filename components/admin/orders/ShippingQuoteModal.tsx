"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  order: any;
  onClose: () => void;
  onCreated: () => void;
};

type QuoteItem = {
  serviceId: number;
  serviceTypeId: number;
  shortName: string;
  fee: {
    total: number;
    service_fee?: number;
    insurance_fee?: number;
  };
  leadtime?: any;
};

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function getLeadtimeText(leadtime: any) {
  if (!leadtime) return "";

  const raw =
    leadtime?.leadtime ||
    leadtime?.leadtime_order?.from_estimate_date ||
    leadtime?.from_estimate_date ||
    "";

  if (!raw) return "";

  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN");
  } catch {
    return "";
  }
}

export default function ShippingQuoteModal({
  open,
  order,
  onClose,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [selected, setSelected] = useState<QuoteItem | null>(null);
  const [error, setError] = useState("");

  const cheapestId = useMemo(() => {
    if (!quotes.length) return null;
    return [...quotes].sort((a, b) => Number(a.fee.total) - Number(b.fee.total))[0]
      ?.serviceId;
  }, [quotes]);

  const light = quotes.filter((q) => q.serviceTypeId !== 5);
  const heavy = quotes.filter((q) => q.serviceTypeId === 5);

  useEffect(() => {
    if (!open || !order) return;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setQuotes([]);
        setSelected(null);

        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const weight = 500;
        const length = 20;
        const width = 20;
        const height = 10;

        const res = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/shipments/ghn/quote`,
  {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            toDistrictId:
              order.shippingGhnDistrictId ||
              order.toDistrictId ||
              order.ghnDistrictId,
            toWardCode:
              order.shippingGhnWardCode ||
              order.toWardCode ||
              order.ghnWardCode,
            insuranceValue: Number(order.finalAmount || 0),
            weight,
            length,
            width,
            height,
            items:
              order.items?.map((i: any) => ({
                name: i.productName || i.sku || "Sản phẩm",
                quantity: Number(i.qty || 1),
                price: Number(i.unitPrice || 0),
                weight,
                length,
                width,
                height,
              })) || [],
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.message || "Không lấy được báo giá GHN.");
        }

        const data = Array.isArray(json) ? json : [];
        setQuotes(data);

        if (data.length > 0) {
          const cheapest = [...data].sort(
            (a, b) => Number(a.fee.total) - Number(b.fee.total)
          )[0];
          setSelected(cheapest);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi lấy báo giá GHN.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, order]);

  const handleCreate = async () => {
    if (!order || !selected) return;

    try {
      setCreating(true);
      setError("");

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const res = await fetch(`${API_BASE}/shipments/${order.id}/create`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || "Tạo vận đơn thất bại.");
      }

      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo vận đơn thất bại.");
    } finally {
      setCreating(false);
    }
  };

  const renderQuote = (q: QuoteItem) => {
    const isSelected = selected?.serviceId === q.serviceId;
    const isCheapest = cheapestId === q.serviceId;
    const eta = getLeadtimeText(q.leadtime);

    return (
      <button
        key={`${q.serviceId}-${q.serviceTypeId}`}
        type="button"
        onClick={() => setSelected(q)}
        className={`w-full rounded-2xl border p-4 text-left transition ${
          isSelected
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-200 bg-white hover:border-neutral-400"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-neutral-900">{q.shortName}</p>
              {isCheapest ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  Rẻ nhất
                </span>
              ) : null}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                type {q.serviceTypeId}
              </span>
            </div>

            {eta ? (
              <p className="mt-1 text-xs text-neutral-500">Dự kiến giao: {eta}</p>
            ) : (
              <p className="mt-1 text-xs text-neutral-500">GHN service #{q.serviceId}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-lg font-semibold">{money(q.fee.total)}</p>
            {q.fee.service_fee ? (
              <p className="text-[11px] text-neutral-500">
                Phí VC: {money(q.fee.service_fee)}
              </p>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[640px] rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Chọn dịch vụ vận chuyển</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {order?.orderCode || "—"} · {order?.customerName || "—"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1 text-sm hover:bg-neutral-50"
          >
            Đóng
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">
            Đang lấy báo giá GHN...
          </div>
        ) : (
          <div className="mt-5 max-h-[520px] space-y-5 overflow-auto pr-1">
            {light.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-700">
                  Hàng nhẹ
                </p>
                <div className="space-y-2">{light.map(renderQuote)}</div>
              </div>
            ) : null}

            {heavy.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-700">
                  Hàng nặng
                </p>
                <div className="space-y-2">{heavy.map(renderQuote)}</div>
              </div>
            ) : null}

            {!quotes.length && !error ? (
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">
                Chưa có dịch vụ GHN phù hợp.
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <div className="text-sm text-neutral-500">
            {selected ? (
              <>
                Đang chọn:{" "}
                <span className="font-medium text-neutral-900">
                  {selected.shortName} · {money(selected.fee.total)}
                </span>
              </>
            ) : (
              "Chưa chọn dịch vụ"
            )}
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!selected || loading || creating}
            className="rounded-2xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Đang tạo..." : "Tạo vận đơn"}
          </button>
        </div>
      </div>
    </div>
  );
}