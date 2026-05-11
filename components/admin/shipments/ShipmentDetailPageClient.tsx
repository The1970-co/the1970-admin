"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type TimelineItem = {
  id: string;
  status: string;
  title: string;
  description: string;
  location: string;
  time: string;
  driverName?: string | null;
  driverPhone?: string | null;
  driverPlate?: string | null;
  eta?: string | null;
  locationText?: string | null;
  partnerStatus?: string | null;
  rawStatus?: string | null;
  eventCode?: string | null;
  eventTime?: string | null;
  note?: string | null;
  raw?: any;
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
    trackingUrl?: string | null;
    ahamoveTrackingUrl?: string | null;
    driver?: {
      driverName?: string | null;
      driverPhone?: string | null;
      driverPlate?: string | null;
      eta?: string | null;
      locationText?: string | null;
    } | null;
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

  if (
    s.includes("SUCCESS") ||
    s.includes("DELIVERED") ||
    s.includes("COMPLETED")
  )
    return "green";
  if (
    s.includes("DELIVERING") ||
    s.includes("PICKING") ||
    s.includes("READY") ||
    s.includes("ASSIGNING") ||
    s.includes("ACCEPTED") ||
    s.includes("IN PROCESS") ||
    s.includes("IN_PROCESS")
  )
    return "amber";
  if (s.includes("FAILED") || s.includes("CANCEL") || s.includes("RETURN"))
    return "red";
  if (s.includes("TRANSIT") || s.includes("CREATED") || s.includes("IDLE"))
    return "blue";
  return "gray";
}

function getShipmentStage(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (
    s.includes("SUCCESS") ||
    s.includes("DELIVERED") ||
    s.includes("COMPLETED")
  )
    return 5;
  if (
    s.includes("DELIVERING") ||
    s.includes("IN PROCESS") ||
    s.includes("IN_PROCESS")
  )
    return 4;
  if (s.includes("TRANSIT") || s.includes("SORT")) return 3;
  if (
    s.includes("PICKING") ||
    s.includes("READY") ||
    s.includes("ACCEPTED")
  )
    return 2;
  if (
    s.includes("CREATED") ||
    s.includes("NOT_CREATED") ||
    s.includes("ASSIGNING") ||
    s.includes("IDLE")
  )
    return 1;

  return 1;
}

function isAhamoveCarrier(carrier?: string | null) {
  return String(carrier || "").toUpperCase().includes("AHAMOVE");
}

function normalizeStatusLabel(status?: string | null, partnerStatus?: string | null) {
  const s = String(status || partnerStatus || "").toUpperCase();

  if (s.includes("ASSIGNING") || s.includes("IDLE")) return "Đang tìm tài xế";
  if (s.includes("ACCEPTED")) return "Tài xế đã nhận đơn";
  if (s.includes("PICKING") || s.includes("READY")) return "Tài xế đang lấy hàng";
  if (s.includes("IN PROCESS") || s.includes("IN_PROCESS") || s.includes("DELIVERING")) {
    return "Đang giao hàng";
  }
  if (s.includes("TRANSIT") || s.includes("SORT")) return "Đang trung chuyển";
  if (s.includes("COMPLETED") || s.includes("DELIVERED") || s.includes("SUCCESS")) {
    return "Giao hàng thành công";
  }
  if (s.includes("CANCEL")) return "Đã huỷ vận đơn";
  if (s.includes("RETURN")) return "Đang hoàn hàng";
  if (s.includes("FAILED")) return "Giao thất bại";
  if (s.includes("CREATED")) return "Đã tạo vận đơn";

  return status || partnerStatus || "Đang cập nhật";
}

function isFinalShipmentStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();

  return (
    s.includes("COMPLETED") ||
    s.includes("DELIVERED") ||
    s.includes("SUCCESS") ||
    s.includes("CANCEL") ||
    s.includes("FAILED") ||
    s.includes("RETURN")
  );
}

function getAhamoveTrackingUrl(detail?: ShipmentDetailResponse | null, tracking?: TrackingResponse | null) {
  const rawTracking: any = tracking?.tracking || {};
  const rawDetail: any = detail || {};

  return (
    rawTracking.trackingUrl ||
    rawTracking.ahamoveTrackingUrl ||
    rawTracking.raw?.tracking_url ||
    rawTracking.raw?.shared_link ||
    rawTracking.raw?.data?.tracking_url ||
    rawTracking.raw?.data?.shared_link ||
    rawDetail.ahamoveTrackingUrl ||
    rawDetail.trackingUrl ||
    ""
  );
}

function getDriverInfo(tracking?: TrackingResponse | null) {
  const raw: any = tracking?.tracking || {};
  const driver = raw.driver || {};
  const newestEvent = Array.isArray(raw.timeline) ? raw.timeline[0] || {} : {};

  return {
    name:
      driver.driverName ||
      raw.driverName ||
      newestEvent.driverName ||
      "Chưa có tài xế",
    phone:
      driver.driverPhone ||
      raw.driverPhone ||
      newestEvent.driverPhone ||
      "",
    plate:
      driver.driverPlate ||
      raw.driverPlate ||
      newestEvent.driverPlate ||
      "",
    eta:
      driver.eta ||
      raw.eta ||
      newestEvent.eta ||
      "",
    location:
      driver.locationText ||
      raw.locationText ||
      newestEvent.locationText ||
      newestEvent.location ||
      "",
  };
}

function buildFallbackTimeline(
  detail: ShipmentDetailResponse,
  tracking?: TrackingResponse | null
): TimelineItem[] {
  const rawTimeline = tracking?.tracking?.timeline || [];

  if (rawTimeline.length) {
    return rawTimeline;
  }

  const status =
    tracking?.tracking?.shippingStatus ||
    tracking?.tracking?.partnerStatus ||
    detail.shippingStatus ||
    detail.partnerStatus ||
    "CREATED";

  return [
    {
      id: "current-status",
      status,
      title: normalizeStatusLabel(status, detail.partnerStatus),
      description: isAhamoveCarrier(detail.carrier)
        ? "AhaMove đã nhận đơn. Hệ thống đang tự động cập nhật trạng thái realtime."
        : "Đơn đã được tạo trên hãng vận chuyển. Hệ thống đang cập nhật hành trình.",
      location: "",
      time: tracking?.fetchedAt || new Date().toISOString(),
    },
    {
      id: "created",
      status: "CREATED",
      title: "Đã tạo vận đơn",
      description: `Mã vận đơn ${detail.trackingCode || "—"} đã được ghi nhận trong hệ thống.`,
      location: "",
      time: "",
    },
  ];
}

function getTimelineDateValue(item: TimelineItem) {
  return item.eventTime || item.time || "";
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimelineDateHeader(value?: string | null) {
  const date = safeDate(value);
  if (!date) return "Không rõ ngày";
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTimelineTime(value?: string | null) {
  const date = safeDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTimelineGroupKey(item: TimelineItem) {
  const date = safeDate(getTimelineDateValue(item));
  if (!date) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTimelineExtraNote(item: TimelineItem) {
  const candidates = [
    item.note,
    item.eventCode,
    item.rawStatus,
    item.partnerStatus,
    (item.raw as any)?.code,
    (item.raw as any)?.action,
    (item.raw as any)?.status,
    (item.raw as any)?.sub_status,
    (item.raw as any)?.order_code,
    (item.raw as any)?.client_order_code,
    (item.raw as any)?.description,
    (item.raw as any)?.reason,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const unique = Array.from(new Set(candidates));
  return unique.find((value) =>
    /_PR|giao\s*1\s*phần|giao\s*một\s*phần|partial|return|hoàn|fail|thất bại/i.test(value),
  ) || "";
}

function getTimelineIcon(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s.includes("DELIVERED") || s.includes("SUCCESS") || s.includes("COMPLETED")) return "✓";
  if (s.includes("FAILED") || s.includes("CANCEL") || s.includes("RETURN")) return "!";
  if (s.includes("DELIVERING") || s.includes("IN_PROCESS")) return "→";
  if (s.includes("TRANSIT") || s.includes("SORT")) return "↔";
  if (s.includes("PICK") || s.includes("READY")) return "↑";
  return "•";
}

function normalizeTimelineItem(item: TimelineItem): TimelineItem {
  const raw: any = item.raw || {};
  const title =
    item.title ||
    raw.status_name ||
    raw.action_name ||
    raw.action ||
    normalizeStatusLabel(item.status, item.partnerStatus);

  const description =
    item.description ||
    raw.description ||
    raw.detail ||
    raw.reason ||
    raw.message ||
    "";

  const location =
    item.location ||
    item.locationText ||
    raw.location ||
    raw.hub_name ||
    raw.area ||
    raw.address ||
    raw.warehouse ||
    "";

  return {
    ...item,
    title,
    description,
    location,
    time: item.time || item.eventTime || raw.updated_date || raw.action_at || raw.created_date || "",
    partnerStatus: item.partnerStatus || raw.status_name || raw.status || null,
    rawStatus: item.rawStatus || raw.status || raw.action || null,
    eventCode: item.eventCode || raw.code || raw.action_code || null,
  };
}

function groupTimelineItems(items: TimelineItem[]) {
  const normalized = items.map(normalizeTimelineItem).sort((a, b) => {
    const ta = safeDate(getTimelineDateValue(a))?.getTime() || 0;
    const tb = safeDate(getTimelineDateValue(b))?.getTime() || 0;
    return tb - ta;
  });

  const groups: Array<{ key: string; label: string; items: TimelineItem[] }> = [];

  for (const item of normalized) {
    const key = getTimelineGroupKey(item);
    const found = groups.find((group) => group.key === key);
    if (found) {
      found.items.push(item);
    } else {
      groups.push({
        key,
        label: formatTimelineDateHeader(getTimelineDateValue(item)),
        items: [item],
      });
    }
  }

  return groups;
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
        fetch(`${API_BASE}/shipments/${shipmentId}`, {
          headers,
          cache: "no-store",
        }),
        fetch(
          `${API_BASE}/shipments/${shipmentId}/tracking${
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

      setDetail(detailJson);

      if (!trackingRes.ok) {
        setTracking({
          tracking: {
            shipmentId,
            carrier: detailJson?.carrier || "AHAMOVE",
            trackingCode: detailJson?.trackingCode || "",
            shippingStatus: detailJson?.shippingStatus || "CREATED",
            partnerStatus: detailJson?.partnerStatus || "",
            codAmount: Number(detailJson?.codAmount || 0),
            shippingFee: Number(detailJson?.shippingFee || 0),
            timeline: [],
          },
          cached: false,
          fetchedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30000).toISOString(),
        } as any);

        setError("");
        return;
      }

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

    const tick = () => {
      const status =
        tracking?.tracking.shippingStatus ||
        tracking?.tracking.partnerStatus ||
        detail?.shippingStatus ||
        detail?.partnerStatus;

      if (isFinalShipmentStatus(status)) {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
          autoRefreshRef.current = null;
        }
        return;
      }

      void loadAll(false, true);
    };

    const intervalMs =
      typeof document !== "undefined" && document.hidden ? 60000 : 15000;

    autoRefreshRef.current = setInterval(tick, intervalMs);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [
    shipmentId,
    detail?.shippingStatus,
    detail?.partnerStatus,
    tracking?.tracking.shippingStatus,
    tracking?.tracking.partnerStatus,
  ]);

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

  const currentStatus =
    tracking?.tracking.shippingStatus ||
    tracking?.tracking.partnerStatus ||
    detail.shippingStatus ||
    detail.partnerStatus;

  const currentLabel = normalizeStatusLabel(currentStatus, detail.partnerStatus);
  const timelineItems = buildFallbackTimeline(detail, tracking);
  const timelineGroups = groupTimelineItems(timelineItems);
  const driverInfo = getDriverInfo(tracking);
  const ahamoveTrackingUrl = getAhamoveTrackingUrl(detail, tracking);
  const isAhamove = isAhamoveCarrier(detail.carrier);
  const isViettelPost = String(detail.carrier || "")
    .toUpperCase()
    .includes("VIETTEL");

  const externalTrackingUrl = isAhamove
    ? ahamoveTrackingUrl
    : isViettelPost
      ? detail.trackingCode
        ? `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?q=${detail.trackingCode}`
        : ""
      : detail.trackingCode
        ? `https://donhang.ghn.vn/?order_code=${detail.trackingCode}`
        : "";
  const canCallDriver = Boolean(driverInfo.phone);
  const shouldShowDriverPanel = isAhamove || Boolean(driverInfo.phone || driverInfo.plate);

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
                {currentLabel}
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

            {externalTrackingUrl ? (
              <a
                href={externalTrackingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800"
              >
                {isAhamove
                  ? "Mở AhaMove"
                  : isViettelPost
                    ? "Mở ViettelPost"
                    : "Mở GHN"}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            Trạng thái
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950">
            {currentLabel}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {tracking?.tracking.partnerStatus || detail.partnerStatus || "Đang cập nhật"}
          </div>
        </div>

        <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            COD phải thu
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950">
            {currency(tracking?.tracking.codAmount ?? detail.codAmount)}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {detail.carrier}
          </div>
        </div>

        <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            Phí vận chuyển
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950">
            {currency(tracking?.tracking.shippingFee ?? detail.shippingFee)}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            Mã vận đơn {detail.trackingCode || "—"}
          </div>
        </div>

        <div className="rounded-[22px] border border-neutral-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            Tài xế
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950">
            {driverInfo.name}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {driverInfo.plate || driverInfo.phone || "Đang chờ phân tài xế"}
          </div>
        </div>
      </div>

      <ShipmentProgress
        status={currentStatus}
        dangerLabel={currentLabel}
      />

      <div className="grid gap-4 xl:grid-cols-[1.8fr_0.8fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-neutral-900">
                  Lịch sử đơn hàng
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Đồng bộ chi tiết từ hãng vận chuyển: trạng thái, bưu cục/kho, ghi chú và thời gian từng chặng.
                </p>
              </div>
              <Badge tone={toneForStatus(currentStatus)}>{detail.carrier}</Badge>
            </div>

            <div className="p-5">
              {timelineGroups.length ? (
                <div className="overflow-hidden rounded-2xl border border-neutral-200">
                  <div className="grid grid-cols-[230px_1fr_110px] bg-neutral-100 px-4 py-3 text-[12px] font-semibold text-neutral-700">
                    <div>Ngày / trạng thái</div>
                    <div>Chi tiết</div>
                    <div className="text-right">Thời gian</div>
                  </div>

                  {timelineGroups.map((group) => (
                    <div key={group.key}>
                      <div className="grid grid-cols-[230px_1fr_110px] border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-[12px] font-semibold text-neutral-900">
                        <div>{group.label}</div>
                        <div>Chi tiết</div>
                        <div className="text-right">Thời gian</div>
                      </div>

                      {group.items.map((item, index) => {
                        const globalIndex = timelineItems.findIndex((row) => row.id === item.id);
                        const isLatest = globalIndex === 0 || (group.key === timelineGroups[0]?.key && index === 0);
                        const tone = toneForStatus(item.status || item.partnerStatus);
                        const icon = getTimelineIcon(item.status || item.partnerStatus);
                        const extraNote = getTimelineExtraNote(item);
                        const rowTone =
                          tone === "green"
                            ? "text-blue-700"
                            : tone === "red"
                              ? "text-red-700"
                              : tone === "amber"
                                ? "text-amber-700"
                                : "text-neutral-800";

                        return (
                          <div
                            key={item.id}
                            className={`grid grid-cols-[230px_1fr_110px] gap-4 border-t border-neutral-100 px-4 py-3 text-sm ${
                              isLatest ? "bg-blue-50/40" : "bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  tone === "green"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : tone === "red"
                                      ? "bg-red-100 text-red-700"
                                      : tone === "amber"
                                        ? "bg-amber-100 text-amber-700"
                                        : tone === "blue"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-neutral-100 text-neutral-600"
                                }`}
                              >
                                {icon}
                              </span>
                              <div className="min-w-0">
                                <div className={`font-medium ${isLatest ? "font-semibold" : ""} ${rowTone}`}>
                                  {item.title || normalizeStatusLabel(item.status, item.partnerStatus)}
                                </div>
                                {item.rawStatus || item.partnerStatus ? (
                                  <div className="mt-1 text-[11px] text-neutral-400">
                                    {item.rawStatus || item.partnerStatus}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className={`${isLatest ? "font-semibold text-blue-800" : "text-neutral-800"}`}>
                                {item.description || item.title || "Cập nhật vận đơn"}
                              </div>

                              {extraNote ? (
                                <div className="mt-1 font-semibold text-orange-600 underline decoration-orange-300 underline-offset-2">
                                  {extraNote}
                                </div>
                              ) : null}

                              {item.location ? (
                                <div className="mt-1 text-xs text-neutral-500">
                                  {item.location}
                                </div>
                              ) : null}

                              {item.driverName || item.driverPhone || item.driverPlate ? (
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                                  {item.driverName ? <span>Tài xế: {item.driverName}</span> : null}
                                  {item.driverPhone ? <span>SĐT: {item.driverPhone}</span> : null}
                                  {item.driverPlate ? <span>Biển số: {item.driverPlate}</span> : null}
                                </div>
                              ) : null}
                            </div>

                            <div className={`text-right text-sm ${isLatest ? "font-semibold text-blue-700" : "text-neutral-700"}`}>
                              {formatTimelineTime(getTimelineDateValue(item))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
                  Chưa có dữ liệu hành trình từ hãng. Hệ thống vẫn đang theo dõi và sẽ tự cập nhật.
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
                  {currentLabel}
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

          {shouldShowDriverPanel ? (
            <div className="rounded-[22px] border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-neutral-900">
                    Tài xế / realtime
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Thông tin lấy từ hãng vận chuyển khi tài xế đã nhận đơn.
                  </p>
                </div>
                <Badge tone="blue">{isAhamove ? "AhaMove" : detail.carrier}</Badge>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                    {driverInfo.name && driverInfo.name !== "Chưa có tài xế"
                      ? driverInfo.name.slice(0, 1).toUpperCase()
                      : "TX"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-950">
                      {driverInfo.name}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {driverInfo.location || "Đang chờ hãng cập nhật vị trí"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">SĐT</span>
                    <span>{driverInfo.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Biển số</span>
                    <span>{driverInfo.plate || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">ETA</span>
                    <span>{driverInfo.eta || "—"}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a
                    href={canCallDriver ? `tel:${driverInfo.phone}` : undefined}
                    className={`rounded-xl border px-3 py-2 text-center text-sm ${
                      canCallDriver
                        ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
                        : "pointer-events-none border-neutral-200 bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    Gọi tài xế
                  </a>
                  <a
                    href={externalTrackingUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-xl border px-3 py-2 text-center text-sm ${
                      externalTrackingUrl
                        ? "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
                        : "pointer-events-none border-neutral-200 bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {isAhamove
                      ? "Mở AhaMove"
                      : isViettelPost
                        ? "Mở ViettelPost"
                        : "Mở GHN"}
                  </a>
                </div>
              </div>
            </div>
          ) : null}

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