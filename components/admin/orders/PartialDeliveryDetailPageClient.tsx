"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PartialDeliveryItem = {
  id?: string;
  productName?: string | null;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  orderedQty?: number | null;
  deliveredQty?: number | null;
  returnedQty?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  actionType?: string | null;
};

type PartialDeliveryRecord = {
  id: string;
  code?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  ghnTrackingCode?: string | null;
  originalCod?: number | null;
  adjustedCod?: number | null;
  reason?: string | null;
  note?: string | null;
  approvedBy?: string | null;
  handledAt?: string | null;
  createdAt?: string | null;
  returnOrderId?: string | null;
  returnOrderCode?: string | null;
  returnTrackingCode?: string | null;
  returnStatus?: string | null;
  returnOrder?: {
    id?: string;
    orderCode?: string | null;
    status?: string | null;
    fulfillmentStatus?: string | null;
    shipment?: {
      trackingCode?: string | null;
      shippingStatus?: string | null;
      partnerStatus?: string | null;
    } | null;
  } | null;
  items?: PartialDeliveryItem[];
  keptItems?: PartialDeliveryItem[];
  returnedItems?: PartialDeliveryItem[];
};

function currency(value?: number | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function returnStatusText(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (!s || s === "PENDING_RETURN") return "Chờ đơn hoàn";
  if (s === "RETURNED" || s.includes("SUCCESS") || s.includes("COMPLETED")) {
    return "Đã hoàn về";
  }
  if (s.includes("CANCEL")) return "Đã huỷ hoàn";
  if (s.includes("FAIL") || s.includes("LOST") || s.includes("DAMAGE")) {
    return "Hoàn lỗi / cần kiểm tra";
  }
  if (
    s.includes("RETURN") ||
    s.includes("TRANSIT") ||
    s.includes("DELIVER") ||
    s.includes("PICK")
  ) {
    return "Đang hoàn về";
  }

  return status || "—";
}

function itemsOf(
  record: PartialDeliveryRecord | null,
  action: "KEPT" | "RETURNED"
) {
  if (!record) return [];

  if (action === "KEPT" && record.keptItems?.length) {
    return record.keptItems;
  }

  if (action === "RETURNED" && record.returnedItems?.length) {
    return record.returnedItems;
  }

  return (record.items || []).filter((item) => {
    const type = String(item.actionType || "").toUpperCase();

    return (
      type === action ||
      (action === "RETURNED" &&
        Number(item.returnedQty || 0) > 0)
    );
  });
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="mt-2 text-[18px] font-semibold text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function ItemTable({
  title,
  rows,
}: {
  title: string;
  rows: PartialDeliveryItem[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900">
        {title}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-white text-[11px] uppercase text-neutral-500">
          <tr>
            <th className="px-4 py-2 text-left">SKU</th>
            <th className="px-4 py-2 text-left">Sản phẩm</th>
            <th className="px-4 py-2 text-left">Màu / Size</th>
            <th className="px-4 py-2 text-right">SL</th>
            <th className="px-4 py-2 text-right">Đơn giá</th>
            <th className="px-4 py-2 text-right">Thành tiền</th>
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((item, index) => (
              <tr
                key={`${item.id || item.sku}-${index}`}
                className="border-t border-neutral-100"
              >
                <td className="px-4 py-3 font-medium text-neutral-900">
                  {item.sku || "—"}
                </td>

                <td className="px-4 py-3 text-neutral-700">
                  {item.productName || "—"}
                </td>

                <td className="px-4 py-3 text-neutral-700">
                  {[item.color, item.size]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </td>

                <td className="px-4 py-3 text-right font-semibold">
                  {Number(
                    item.qty ||
                      item.returnedQty ||
                      item.deliveredQty ||
                      0
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  {currency(item.unitPrice)}
                </td>

                <td className="px-4 py-3 text-right font-semibold">
                  {currency(item.lineTotal)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-neutral-400"
              >
                Chưa có dữ liệu
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PartialDeliveryDetailPageClient({
  orderId,
  partialDeliveryId,
}: {
  orderId: string;
  partialDeliveryId: string;
}) {
  const [record, setRecord] =
    useState<PartialDeliveryRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");

        const endpoint = partialDeliveryId.startsWith(
          "runtime-partial-"
        )
          ? `/orders/${orderId}`
          : `/partial-delivery/${partialDeliveryId}`;

        const res = await apiFetch(endpoint, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            json?.message ||
              "Không tải được phiếu giao hàng 1 phần."
          );
        }

        if (
          partialDeliveryId.startsWith("runtime-partial-")
        ) {
          const partial = Array.isArray(
            json?.partialDeliveries
          )
            ? json.partialDeliveries.find(
                (item: any) =>
                  String(item?.id) ===
                  String(partialDeliveryId)
              )
            : null;

          if (!partial) {
            throw new Error(
              "Không tìm thấy phiếu giao hàng 1 phần."
            );
          }

          setRecord(partial);
        } else {
          setRecord(json);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được phiếu giao hàng 1 phần."
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [orderId, partialDeliveryId]);

  const keptItems = useMemo(
    () => itemsOf(record, "KEPT"),
    [record]
  );

  const returnedItems = useMemo(
    () => itemsOf(record, "RETURNED"),
    [record]
  );

  if (loading) {
    return (
      <div className="p-6 text-sm text-neutral-500">
        Đang tải phiếu giao hàng 1 phần...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="p-6 text-sm text-red-600">
        {error || "Không tìm thấy phiếu."}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/orders/${orderId}`}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            ← Quay lại đơn gốc
          </Link>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            {record.code || "Phiếu giao hàng 1 phần"}
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Đơn gốc {record.orderCode} · xử lý lúc{" "}
            {formatDateTime(
              record.handledAt || record.createdAt
            )}
          </p>
        </div>

        <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
          {returnStatusText(record.returnStatus)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MiniStat
          label="COD ban đầu"
          value={currency(record.originalCod)}
        />

        <MiniStat
          label="COD sau điều chỉnh"
          value={currency(record.adjustedCod)}
        />

        <MiniStat
          label="Người xử lý"
          value={record.approvedBy || "—"}
        />

        <MiniStat
          label="Mã vận đơn gốc"
          value={record.ghnTrackingCode || "—"}
        />
      </div>

      <ItemTable
        title="Sản phẩm khách lấy"
        rows={keptItems}
      />

      <ItemTable
        title="Sản phẩm hoàn về"
        rows={returnedItems}
      />
    </div>
  );
}