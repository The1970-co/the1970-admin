"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  quoteShipment,
  resolveGhnAddress,
  type ShipmentQuoteResult,
} from "@/lib/create-order-api";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function getFeeNumber(row: ShipmentQuoteResult) {
  return Number(
    row?.fee?.total ||
      row?.fee?.total_fee ||
      row?.fee?.service_fee ||
      row?.fee ||
      0
  );
}

function normalizeSpaces(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeProvinceName(value?: string | null) {
  return normalizeSpaces(value)
    .replace(/^(tỉnh|thành phố|tp\.?|tp)\s+/i, "")
    .trim();
}

function normalizeDistrictName(value?: string | null) {
  return normalizeSpaces(value)
    .replace(
      /^(quận|huyện|thị xã|thành phố|tp\.?|tp|xã|phường|thị trấn)\s+/i,
      ""
    )
    .trim();
}

function normalizeWardName(value?: string | null) {
  return normalizeSpaces(value)
    .replace(/^(xã|phường|thị trấn)\s+/i, "")
    .trim();
}

export type ShippingUiMode = "carrier" | "external" | "pickup" | "schedule";
export type AddressMode = "legacy" | "new";

type Props = {
  orderItems: Array<{
    productName: string;
    sku: string;
    qty: number;
    price: number;
  }>;
  province?: string;
  district?: string;
  ward?: string;

  legacyProvince?: string;
  legacyDistrict?: string;
  legacyWard?: string;

  codAmount: number;
  initialWeight?: number;
  initialLength?: number;
  initialWidth?: number;
  initialHeight?: number;

  onApply: (payload: {
    shippingFee: number;
    shippingPartner: string;
    shippingMode: string;
    selectedServiceId?: number;
    selectedServiceTypeId?: number;
    weight: number;
    length: number;
    width: number;
    height: number;
    ghnDistrictId?: number;
    ghnWardCode?: string;
    uiMode: ShippingUiMode;
    addressMode: AddressMode;
  }) => void;
};

const UI_MODE_OPTIONS: Array<{
  value: ShippingUiMode;
  label: string;
  description: string;
}> = [
  {
    value: "carrier",
    label: "Đẩy qua hãng vận chuyển",
    description: "Ưu tiên GHN để lấy phí ship và đẩy đơn.",
  },
  {
    value: "external",
    label: "Đẩy vận chuyển ngoài",
    description: "Shipper ngoài / đối tác ngoài hệ thống.",
  },
  {
    value: "pickup",
    label: "Khách nhận tại cửa hàng",
    description: "Không tính phí ship.",
  },
  {
    value: "schedule",
    label: "Giao hàng sau",
    description: "Tạo đơn trước, xử lý ship sau.",
  },
];

const PARTNER_OPTIONS = [
  { value: "ghn", label: "GHN", enabled: true },
  { value: "ghtk", label: "GHTK", enabled: false },
  { value: "grab", label: "Grab", enabled: false },
  { value: "ahamove", label: "Ahamove", enabled: false },
  { value: "outside", label: "Vận chuyển ngoài", enabled: false },
];

export default function ShippingQuotePanel({
  orderItems,
  province,
  district,
  ward,
  legacyProvince,
  legacyDistrict,
  legacyWard,
  codAmount,
  initialWeight = 200,
  initialLength = 10,
  initialWidth = 10,
  initialHeight = 10,
  onApply,
}: Props) {
  const onApplyRef = useRef(onApply);

  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  const [uiMode, setUiMode] = useState<ShippingUiMode>("carrier");
  const [addressMode, setAddressMode] = useState<AddressMode>("legacy");
  const [shippingPartner, setShippingPartner] = useState("ghn");

  const [weight, setWeight] = useState(String(initialWeight));
  const [length, setLength] = useState(String(initialLength));
  const [width, setWidth] = useState(String(initialWidth));
  const [height, setHeight] = useState(String(initialHeight));

  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<ShipmentQuoteResult[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const activeProvince = addressMode === "new" ? province : legacyProvince || province;
  const activeDistrict = addressMode === "new" ? district : legacyDistrict || district;
  const activeWard = addressMode === "new" ? ward : legacyWard || ward;

  const normalizedProvince = useMemo(
    () => normalizeProvinceName(activeProvince),
    [activeProvince]
  );
  const normalizedDistrict = useMemo(
    () => normalizeDistrictName(activeDistrict),
    [activeDistrict]
  );
  const normalizedWard = useMemo(() => normalizeWardName(activeWard), [activeWard]);

  const selectedQuote =
    quotes.find((q) => q.serviceId === selectedServiceId) || null;

  const quoteItems = useMemo(() => {
    return orderItems
      .filter((item) => Number(item.qty || 0) > 0)
      .map((item) => ({
        name: item.productName || item.sku || "Sản phẩm",
        quantity: Number(item.qty || 0),
        length: Number(length || 10),
        width: Number(width || 10),
        height: Number(height || 10),
        weight: Math.max(
          1,
          Math.floor(Number(weight || initialWeight) / Math.max(orderItems.length, 1))
        ),
      }));
  }, [orderItems, length, width, height, weight, initialWeight]);

  useEffect(() => {
    if (uiMode === "pickup") {
      setQuotes([]);
      setSelectedServiceId(null);
      setError("");
      setHint("Khách nhận tại shop nên không tính phí ship.");
      onApplyRef.current({
        shippingFee: 0,
        shippingPartner: "pickup",
        shippingMode: "pickup",
        weight: Number(weight || initialWeight),
        length: Number(length || initialLength),
        width: Number(width || initialWidth),
        height: Number(height || initialHeight),
        uiMode,
        addressMode,
      });
      return;
    }

    if (uiMode === "external" || uiMode === "schedule") {
      setQuotes([]);
      setSelectedServiceId(null);
      setError("");
      setHint(
        uiMode === "external"
          ? "Đang dùng vận chuyển ngoài. Chưa lấy phí tự động."
          : "Đơn giao sau. Có thể quote lại khi chốt gửi hãng."
      );
      onApplyRef.current({
        shippingFee: 0,
        shippingPartner: uiMode === "external" ? "outside" : "schedule",
        shippingMode: uiMode,
        weight: Number(weight || initialWeight),
        length: Number(length || initialLength),
        width: Number(width || initialWidth),
        height: Number(height || initialHeight),
        uiMode,
        addressMode,
      });
      return;
    }

    if (shippingPartner !== "ghn") {
      setQuotes([]);
      setSelectedServiceId(null);
      setError("");
      setHint("Hiện mới bật quote tự động cho GHN. Các hãng khác để sẵn giao diện trước.");
      return;
    }

    const run = async () => {
      if (!normalizedProvince || !normalizedDistrict || !normalizedWard) {
        setQuotes([]);
        setSelectedServiceId(null);
        setError("");
        setHint("Thiếu tỉnh/thành, quận/huyện hoặc xã/phường để tính phí ship.");
        return;
      }

      if (!orderItems.length || !quoteItems.length) {
        setQuotes([]);
        setSelectedServiceId(null);
        setError("");
        setHint("Cần có ít nhất 1 sản phẩm trong đơn để tính phí ship.");
        return;
      }

      try {
        setLoading(true);
        setError("");
        setHint("Đang resolve địa chỉ GHN...");

        const resolved = await resolveGhnAddress({
          province: normalizedProvince,
          district: normalizedDistrict,
          ward: normalizedWard,
        });

        if (!resolved?.districtId || !resolved?.wardCode) {
          throw new Error(
            `Không map được địa chỉ GHN. Province="${normalizedProvince}", District="${normalizedDistrict}", Ward="${normalizedWard}".`
          );
        }

        setHint("Đang lấy báo giá GHN...");

        const data = await quoteShipment({
          toDistrictId: Number(resolved.districtId),
          toWardCode: String(resolved.wardCode),
          insuranceValue: codAmount,
          length: Number(length || initialLength),
          width: Number(width || initialWidth),
          height: Number(height || initialHeight),
          weight: Number(weight || initialWeight),
          items: quoteItems,
        });

        const rows = Array.isArray(data) ? data : [];
        setQuotes(rows);

        if (rows.length > 0) {
          const sorted = [...rows].sort(
            (a, b) => getFeeNumber(a) - getFeeNumber(b)
          );
          const best = sorted[0];
          setSelectedServiceId(best.serviceId);
          setHint("Đã tự chọn dịch vụ GHN rẻ nhất.");

          onApplyRef.current({
            shippingFee: getFeeNumber(best),
            shippingPartner: "ghn",
            shippingMode: "partner",
            selectedServiceId: best.serviceId,
            selectedServiceTypeId: best.serviceTypeId,
            weight: Number(weight || initialWeight),
            length: Number(length || initialLength),
            width: Number(width || initialWidth),
            height: Number(height || initialHeight),
            ghnDistrictId: resolved.districtId,
            ghnWardCode: resolved.wardCode,
            uiMode,
            addressMode,
          });
        } else {
          setSelectedServiceId(null);
          setHint("GHN không trả về dịch vụ phù hợp cho địa chỉ này.");
        }
      } catch (err) {
        setQuotes([]);
        setSelectedServiceId(null);
        setError(
          err instanceof Error ? err.message : "Không lấy được phí ship."
        );
        setHint("");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 350);

    return () => clearTimeout(timer);
  }, [
    normalizedProvince,
    normalizedDistrict,
    normalizedWard,
    orderItems,
    quoteItems,
    codAmount,
    length,
    width,
    height,
    weight,
    uiMode,
    shippingPartner,
    addressMode,
    initialWeight,
    initialLength,
    initialWidth,
    initialHeight,
  ]);

  return (
    <div className="rounded-3xl border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Vận chuyển</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Chọn kiểu giao hàng giống flow Sapo. GHN được bật trước để quote phí.
          </p>
        </div>

        <div className="text-sm text-neutral-500">
          {loading
            ? "Đang tính phí..."
            : quotes.length > 0
              ? "Đã cập nhật"
              : "Chưa có dữ liệu"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {UI_MODE_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setUiMode(item.value)}
            className={`rounded-2xl border p-3 text-left transition ${
              uiMode === item.value
                ? "border-neutral-900 bg-neutral-50"
                : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <div className="text-sm font-medium text-neutral-900">{item.label}</div>
            <div className="mt-1 text-xs text-neutral-500">{item.description}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAddressMode("legacy")}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            addressMode === "legacy"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
          }`}
        >
          Địa chỉ cũ
        </button>
        <button
          type="button"
          onClick={() => setAddressMode("new")}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            addressMode === "new"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
          }`}
        >
          Địa chỉ mới
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {PARTNER_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={!item.enabled}
            onClick={() => item.enabled && setShippingPartner(item.value)}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              shippingPartner === item.value
                ? "border-neutral-900 bg-neutral-50"
                : "border-neutral-200"
            } ${item.enabled ? "hover:bg-neutral-50" : "cursor-not-allowed opacity-50"}`}
          >
            <div className="text-sm font-medium">{item.label}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {item.enabled ? "Đang bật" : "Sẽ bật sau"}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Khối lượng (g)
          </p>
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Dài (cm)</p>
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Rộng (cm)</p>
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Cao (cm)</p>
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <div className="grid gap-y-2 md:grid-cols-[150px_1fr]">
          <span className="text-neutral-500">Tỉnh / Thành</span>
          <span>{normalizedProvince || "—"}</span>

          <span className="text-neutral-500">Quận / Huyện</span>
          <span>{normalizedDistrict || "—"}</span>

          <span className="text-neutral-500">Xã / Phường</span>
          <span>{normalizedWard || "—"}</span>
        </div>
      </div>

      {hint ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {hint}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
            Chưa có báo giá vận chuyển.
          </div>
        ) : (
          quotes.map((row) => {
            const checked = selectedServiceId === row.serviceId;
            const feeNumber = getFeeNumber(row);

            return (
              <label
                key={`${row.serviceId}-${row.serviceTypeId}`}
                className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 ${
                  checked
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={checked}
                    onChange={() => {
                      setSelectedServiceId(row.serviceId);
                      onApplyRef.current({
                        shippingFee: feeNumber,
                        shippingPartner: "ghn",
                        shippingMode: "partner",
                        selectedServiceId: row.serviceId,
                        selectedServiceTypeId: row.serviceTypeId,
                        weight: Number(weight || initialWeight),
                        length: Number(length || initialLength),
                        width: Number(width || initialWidth),
                        height: Number(height || initialHeight),
                        uiMode,
                        addressMode,
                      });
                    }}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">
                      {row.shortName || `Service ${row.serviceId}`}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      serviceId: {row.serviceId} · type: {row.serviceTypeId}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-semibold">{currency(feeNumber)}</p>
                </div>
              </label>
            );
          })
        )}
      </div>

      {selectedQuote ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Dịch vụ đang chọn</span>
            <span className="font-medium">
              {selectedQuote.shortName || selectedQuote.serviceId}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-neutral-500">Phí ship</span>
            <span className="font-semibold">
              {currency(getFeeNumber(selectedQuote))}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}