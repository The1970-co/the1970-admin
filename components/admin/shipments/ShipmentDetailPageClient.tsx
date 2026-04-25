"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type TimelineItem = {
  id: string;
  status: string;
  title: string;
  description: string;
  location: string;
  time: string;
};

type ShipmentDetailResponse = {
  id: string;
  trackingCode?: string | null;
  carrier: string;
  shippingStatus: string;
  partnerStatus?: string | null;
  shippingFee?: number | null;
  codAmount?: number | null;
  order?: {
    id: string;
    orderCode: string;
    customerName?: string | null;
    customerPhone?: string | null;
    shippingRecipientName?: string | null;
    shippingPhone?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingWard?: string | null;
    shippingDistrict?: string | null;
    shippingProvince?: string | null;
    items?: Array<{
      id: string;
      productName?: string;
      sku?: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
};

type TrackingResponse = {
  source: string;
  cached: boolean;
  fetchedAt: string;
  expiresAt: string;
  tracking: {
    trackingCode: string;
    carrier: string;
    shippingStatus: string;
    partnerStatus: string;
    codAmount: number;
    shippingFee: number;
    updatedAt?: string | null;
    from: {
      name: string;
      phone: string;
      address: string;
    };
    to: {
      name: string;
      phone: string;
      address: string;
    };
    timeline: TimelineItem[];
  };
};

function currency(n?: number | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function toneForStatus(
  status?: string | null
): "gray" | "green" | "amber" | "red" | "blue" {
  const s = String(status || "").toUpperCase();

  if (s.includes("SUCCESS") || s.includes("DELIVERED")) return "green";
  if (s.includes("DELIVERING") || s.includes("PICKING") || s.includes("READY"))
    return "amber";
  if (s.includes("FAILED") || s.includes("CANCEL") || s.includes("RETURN"))
    return "red";
  if (s.includes("TRANSIT") || s.includes("CREATED")) return "blue";
  return "gray";
}

function getShipmentStage(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (s.includes("SUCCESS") || s.includes("DELIVERED")) return 5;
  if (s.includes("DELIVERING")) return 4;
  if (s.includes("TRANSIT")) return 3;
  if (s.includes("PICKING") || s.includes("READY")) return 2;
  if (s.includes("CREATED") || s.includes("NOT_CREATED")) return 1;

  return 1;
}

function ShipmentProgress({
  status,
  dangerLabel,
}: {
  status?: string | null;
  dangerLabel?: string | null;
}) {
  const current = getShipmentStage(status);

  const steps = [
    { key: 1, label: "Tạo đơn" },
    { key: 2, label: "Chờ lấy hàng" },
    { key: 3, label: "Trung chuyển" },
    { key: 4, label: "Đang giao" },
    { key: 5, label: "Hoàn tất" },
  ];

  const upperDanger = String(dangerLabel || "").toUpperCase();
  const isDanger =
    upperDanger.includes("CANCEL") ||
    upperDanger.includes("HỦY") ||
    upperDanger.includes("FAILED") ||
    upperDanger.includes("THẤT BẠI") ||
    upperDanger.includes("RETURN");

  return (
    <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-neutral-900">
          Tiến trình giao hàng
        </h2>

        {isDanger ? (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
            {dangerLabel || "Có sự cố"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            Đang theo dõi
          </span>
        )}
      </div>

      <div className="mt-5 flex items-start justify-between gap-2 overflow-x-auto">
        {steps.map((step, index) => {
          const active = current >= step.key;
          const isLast = index === steps.length - 1;

          return (
            <div
              key={step.key}
              className={`flex min-w-[110px] flex-1 items-center ${
                isLast ? "max-w-[140px]" : ""
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-semibold ${
                    active
                      ? isDanger && step.key === current
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-400"
                  }`}
                >
                  {step.key}
                </div>
                <div
                  className={`mt-2 text-[11px] font-medium ${
                    active ? "text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {step.label}
                </div>
              </div>

              {!isLast ? (
                <div
                  className={`mx-2 h-[2px] flex-1 ${
                    current > step.key ? "bg-neutral-900" : "bg-neutral-200"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-neutral-200/80 ${className}`}
    />
  );
}

function ShipmentDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-neutral-200 bg-white px-5 py-4">
        <SkeletonBlock className="h-4 w-36" />
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-8 w-56" />
            <div className="mt-3 flex flex-wrap gap-2">
              <SkeletonBlock className="h-5 w-24 rounded-full" />
              <SkeletonBlock className="h-5 w-40 rounded-full" />
              <SkeletonBlock className="h-5 w-48 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-36" />
            <SkeletonBlock className="h-10 w-24" />
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-6 w-24 rounded-full" />
        </div>
        <div className="mt-5 flex items-start justify-between gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex min-w-[110px] flex-1 items-center">
              <div className="flex flex-col items-center text-center">
                <SkeletonBlock className="h-9 w-9 rounded-full" />
                <SkeletonBlock className="mt-2 h-3 w-16" />
              </div>
              {i !== 5 ? (
                <SkeletonBlock className="mx-2 h-[2px] flex-1 rounded-none" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <SkeletonBlock className="h-5 w-40" />
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-neutral-200 p-4">
                  <SkeletonBlock className="h-4 w-44" />
                  <SkeletonBlock className="mt-2 h-3 w-64" />
                  <SkeletonBlock className="mt-2 h-3 w-24" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <SkeletonBlock className="h-5 w-36" />
            <div className="mt-4 space-y-2">
              <SkeletonBlock className="h-4 w-52" />
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-4 w-full" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <SkeletonBlock className="h-5 w-36" />
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <SkeletonBlock className="h-5 w-28" />
            <div className="mt-4 space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3"
                >
                  <div className="flex-1">
                    <SkeletonBlock className="h-4 w-36" />
                    <SkeletonBlock className="mt-2 h-3 w-24" />
                  </div>
                  <SkeletonBlock className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShipmentDetailPageClient({
  shipmentId,
}: {
  shipmentId: string;
}) {
  const [detail, setDetail] = useState<ShipmentDetailResponse | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [softRefreshing, setSoftRefreshing] = useState(false);
  const [error, setError] = useState("");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fullAddress = useMemo(() => {
    if (!detail) return "";
    return [
      detail.order?.shippingAddressLine1,
      detail.order?.shippingAddressLine2,
      detail.order?.shippingWard,
      detail.order?.shippingDistrict,
      detail.order?.shippingProvince,
    ]
      .filter(Boolean)
      .join(", ");
  }, [detail]);

  const loadAll = async (
    force = false,
    silent = false
  ) => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!silent) {
        if (force) setRefreshing(true);
        else setLoading(true);
      } else {
        setSoftRefreshing(true);
      }

      if (!silent) setError("");

      const headers = {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const [detailRes, trackingRes] = await Promise.all([
        fetch(`http://localhost:3001/shipments/${shipmentId}`, {
          headers,
          cache: "no-store",
        }),
        fetch(
          `http://localhost:3001/shipments/${shipmentId}/tracking${
            force ? "?force=1" : ""
          }`,
          {
            headers,
            cache: "no-store",
          }
        ),
      ]);

      const detailJson = await detailRes.json().catch(() => null);
      const trackingJson = await trackingRes.json().catch(() => null);

      if (!detailRes.ok) {
        throw new Error(
          detailJson?.message || "Không tải được phiếu giao hàng."
        );
      }

      if (!trackingRes.ok) {
        throw new Error(
          trackingJson?.message || "Không tải được hành trình đơn."
        );
      }

      setDetail(detailJson);
      setTracking(trackingJson);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Tải dữ liệu thất bại.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSoftRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAll(false, false);
  }, [shipmentId]);

  useEffect(() => {
    if (!shipmentId) return;

    autoRefreshRef.current = setInterval(() => {
      void loadAll(false, true);
    }, 45000);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [shipmentId]);

  if (loading) {
    return <ShipmentDetailSkeleton />;
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-red-600">
        {error || "Không tìm thấy phiếu giao hàng."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-neutral-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href={`/orders/${detail.order?.id || ""}`}
              className="text-[12px] text-neutral-500 hover:text-neutral-900"
            >
              ← Quay lại đơn hàng
            </Link>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-tight text-neutral-900">
                {detail.order?.orderCode || "Phiếu giao hàng"}
              </h1>
              <Badge
                tone={toneForStatus(
                  tracking?.tracking.shippingStatus || detail.shippingStatus
                )}
              >
                {tracking?.tracking.timeline?.[0]?.title ||
                  tracking?.tracking.partnerStatus ||
                  detail.partnerStatus ||
                  detail.shippingStatus}
              </Badge>

              {softRefreshing ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-600">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
                  Đang cập nhật nhẹ
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
              <span>
                {detail.carrier} · Mã vận đơn: {detail.trackingCode || "—"}
              </span>
              {tracking?.cached ? (
                <span>
                  Dùng cache tới{" "}
                  {new Date(tracking.expiresAt).toLocaleString("vi-VN")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void loadAll(true, false)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
            >
              {refreshing ? "Đang làm mới..." : "Làm mới trạng thái"}
            </button>

            {detail.trackingCode ? (
              <a
                href={`https://donhang.ghn.vn/?order_code=${detail.trackingCode}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800"
              >
                Mở GHN
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <ShipmentProgress
        status={tracking?.tracking.shippingStatus || detail.shippingStatus}
        dangerLabel={
          tracking?.tracking.timeline?.[0]?.title ||
          tracking?.tracking.partnerStatus ||
          detail.partnerStatus ||
          null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.8fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">
              Hành trình đơn hàng
            </h2>

            <div className="mt-4 space-y-4">
              {(tracking?.tracking.timeline || []).length ? (
                tracking!.tracking.timeline.map((item, index) => {
                  const isLatest = index === 0;
                  const dotTone = toneForStatus(item.status);

                  const dotClass =
                    dotTone === "green"
                      ? "bg-emerald-500"
                      : dotTone === "amber"
                      ? "bg-amber-500"
                      : dotTone === "red"
                      ? "bg-red-500"
                      : dotTone === "blue"
                      ? "bg-blue-500"
                      : "bg-neutral-400";

                  return (
                    <div
                      key={item.id}
                      className={`relative pl-6 ${!isLatest ? "opacity-90" : ""}`}
                    >
                      <div className="absolute left-0 top-1 h-full w-px bg-neutral-200" />
                      <div
                        className={`absolute left-[-5px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${dotClass}`}
                      />

                      <div
                        className={`grid grid-cols-[1fr_auto] gap-4 rounded-xl border px-4 py-3 ${
                          isLatest
                            ? "border-neutral-300 bg-neutral-50"
                            : "border-neutral-200 bg-white"
                        }`}
                      >
                        <div>
                          <div
                            className={`text-sm ${
                              isLatest
                                ? "font-semibold text-neutral-900"
                                : "font-medium text-neutral-800"
                            }`}
                          >
                            {item.title}
                          </div>

                          {item.description ? (
                            <div className="mt-1 text-sm text-neutral-600">
                              {item.description}
                            </div>
                          ) : null}

                          {item.location ? (
                            <div className="mt-1 text-xs text-neutral-500">
                              {item.location}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right text-xs text-neutral-500">
                          {item.time
                            ? new Date(item.time).toLocaleString("vi-VN")
                            : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-neutral-500">
                  Chưa có dữ liệu hành trình.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">
              Thông tin người nhận
            </h2>
            <div className="mt-4 grid gap-2 text-sm">
              <div>
                <span className="text-neutral-500">Người nhận:</span>{" "}
                {detail.order?.shippingRecipientName ||
                  detail.order?.customerName ||
                  "—"}
              </div>
              <div>
                <span className="text-neutral-500">SĐT:</span>{" "}
                {detail.order?.shippingPhone ||
                  detail.order?.customerPhone ||
                  "—"}
              </div>
              <div>
                <span className="text-neutral-500">Địa chỉ:</span>{" "}
                {fullAddress || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">
              Tổng quan giao hàng
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Trạng thái hiện tại</span>
                <span>
                  {tracking?.tracking.timeline?.[0]?.title ||
                    tracking?.tracking.partnerStatus ||
                    detail.partnerStatus ||
                    detail.shippingStatus}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Mã vận đơn</span>
                <span>{detail.trackingCode || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">ĐVVC</span>
                <span>{detail.carrier}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">COD</span>
                <span>
                  {currency(tracking?.tracking.codAmount ?? detail.codAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Phí ship</span>
                <span>
                  {currency(
                    tracking?.tracking.shippingFee ?? detail.shippingFee
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">Cập nhật lần cuối</span>
                <span>
                  {tracking?.tracking.updatedAt
                    ? new Date(tracking.tracking.updatedAt).toLocaleString(
                        "vi-VN"
                      )
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
            <h2 className="text-[15px] font-semibold text-neutral-900">
              Sản phẩm ({detail.order?.items?.length || 0})
            </h2>
            <div className="mt-4 space-y-3">
              {(detail.order?.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-neutral-900">
                      {item.productName || item.sku || "Sản phẩm"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {item.sku || "—"} · SL: {item.qty}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-neutral-900">
                    {currency(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}