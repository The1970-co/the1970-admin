"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  createOrder,
  createGhnShipment,
  createAhamoveShipment,
  createViettelPostShipment,
  findCustomerByPhone,
  getProductsForOrder,
  quoteShipment,
  quoteAhamoveShipment,
  quoteViettelPostShipment,
  getViettelPostInventories,
  getPickupLocations,
  resolveGhnAddress,
  getOrderForCopy,
  type CreateOrderMode,
  type CreateOrderPayload,
  type OrderProduct,
  type ShipmentQuoteResult,
  type ViettelPostInventory,
  type PickupLocation,
} from "@/lib/create-order-api";
import {
  createCustomerAddress,
  getCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  type CustomerAddressItem,
} from "@/lib/customers-api";
import {
  getProvinces,
  getDistricts,
  getWards,
  type ProvinceItem,
  type DistrictItem,
  type WardItem,
} from "@/lib/address-api";
import { BRANCH_LABELS } from "@/lib/authz";
import {
  getCurrentUserFromStorage,
  getUserBranchIds,
  isOwnerUser,
} from "@/lib/current-user";

type ShippingMode = "partner" | "pickup";
type ShippingPayer = "shop" | "customer";
type ShippingUiMode = "carrier" | "external" | "pickup" | "schedule";
type AhamovePaymentMethod = "BALANCE" | "CASH" | "CASH_BY_RECIPIENT";

const AHAMOVE_PAYMENT_METHOD_STORAGE_KEY = "the1970_ahamove_payment_method";
const AHAMOVE_PAYMENT_METHOD_OPTIONS: Array<{
  value: AhamovePaymentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "BALANCE",
    label: "Trừ ví / công nợ AhaMove",
    description: "AhaMove trừ tiền từ ví hoặc hạn mức công nợ của shop.",
  },
  {
    value: "CASH",
    label: "Shop trả tiền mặt cho tài xế",
    description: "Tài xế thu phí ship từ shop lúc lấy hàng.",
  },
  {
    value: "CASH_BY_RECIPIENT",
    label: "Khách trả tiền ship",
    description: "Tài xế thu phí ship từ khách nhận hàng.",
  },
];

function normalizeAhamovePaymentMethod(value?: string | null): AhamovePaymentMethod {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "CASH" || normalized === "CASH_BY_RECIPIENT" || normalized === "BALANCE") {
    return normalized as AhamovePaymentMethod;
  }
  return "BALANCE";
}

function getAhamovePaymentMethodLabel(value?: string | null) {
  const method = normalizeAhamovePaymentMethod(value);
  return AHAMOVE_PAYMENT_METHOD_OPTIONS.find((item) => item.value === method)?.label || "Trừ ví / công nợ AhaMove";
}

function getAhamovePaymentMethodDescription(value?: string | null) {
  const method = normalizeAhamovePaymentMethod(value);
  return AHAMOVE_PAYMENT_METHOD_OPTIONS.find((item) => item.value === method)?.description || "AhaMove trừ tiền từ ví hoặc hạn mức công nợ của shop.";
}

function inferShippingPayerFromAhamovePaymentMethod(value?: string | null): ShippingPayer {
  return normalizeAhamovePaymentMethod(value) === "CASH_BY_RECIPIENT" ? "customer" : "shop";
}

const CARRIER_PICKUP_MAPPING_STORAGE_KEY = "the1970_carrier_pickup_mapping";
const CUSTOM_AHAMOVE_PICKUPS_STORAGE_KEY = "the1970_custom_ahamove_pickups";

type CarrierPickupMapping = Record<
  string,
  {
    ghn?: string;
    viettelpost?: string;
    ahamove?: string;
  }
>;

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readCustomAhamovePickups(): PickupLocation[] {
  if (typeof window === "undefined") return [];
  const raw = safeJsonParse(localStorage.getItem(CUSTOM_AHAMOVE_PICKUPS_STORAGE_KEY));
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item: any, index) => {
      const id = String(item?.id || `ahamove-custom-${index}`);
      const name = String(item?.name || item?.label || "").trim();
      const phone = String(item?.phone || "").trim();
      const address = String(item?.address || "").trim();

      if (!name && !phone && !address) return null;

      return {
        id,
        carrier: "ahamove" as const,
        label: name || address || id,
        name: name || address || "Điểm lấy hàng AhaMove",
        phone,
        address,
      } satisfies PickupLocation;
    })
    .filter(Boolean) as PickupLocation[];
}

function mergeCustomAhamovePickups(rows: PickupLocation[]) {
  const customRows = readCustomAhamovePickups();
  return [
    ...rows.filter((item) => !String(item.id).startsWith("ahamove-custom-")),
    ...customRows,
  ];
}
type DeliveryRequirement =
  | "CHOXEMHANG_KHONGTHU"
  | "CHOXEMHANG_CHOTHU"
  | "KHONGCHOXEMHANG";

type OrderLine = {
  productId?: string | null;
  variantId: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
  price: number;
  stock: number;
  totalStock?: number;
  branchStock?: number;
  branchStocks?: Record<string, number>;
  qty: number;
  discount: number;
  imageUrl?: string;
};

type SearchCustomerLite = {
  id?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  customerNote?: string;
  note?: string;
  pricePolicyName?: string;
  defaultDiscountPercent?: number;
  addresses?: CustomerAddressItem[];
  addressLine1?: string;
  addressLine2?: string;
  province?: string;
  district?: string;
  ward?: string;
};

type CustomerSuggestionItem = SearchCustomerLite & {
  label: string;
  subLabel?: string;
};

type BranchOption = {
  value: string;
  label: string;
  code?: string;
  type?: string;
  isActive?: boolean;
};

type PromotionRow = {
  id: string;
  name: string;
  type: "PRODUCT_DISCOUNT" | "ORDER_DISCOUNT";
  status: "ACTIVE" | "INACTIVE";
  discountType: "PERCENT" | "FIXED_AMOUNT";
  discountValue: string | number;
  minOrderAmount?: string | number | null;
  branchId?: string | null;
  salesChannel?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  products?: Array<{
    productId?: string | null;
    product?: { id?: string | null } | null;
  }>;
  priority?: number | string | null;
};

function isPromotionActiveForContext(
  promotion: PromotionRow,
  input: { branchId?: string | null; salesChannel?: string | null },
) {
  if (promotion.status !== "ACTIVE") return false;

  const now = Date.now();
  if (promotion.startAt && new Date(promotion.startAt).getTime() > now)
    return false;
  if (promotion.endAt && new Date(promotion.endAt).getTime() < now)
    return false;

  if (
    promotion.branchId &&
    input.branchId &&
    String(promotion.branchId) !== String(input.branchId)
  )
    return false;
  if (promotion.branchId && !input.branchId) return false;

  if (
    promotion.salesChannel &&
    input.salesChannel &&
    String(promotion.salesChannel).toUpperCase() !==
      String(input.salesChannel).toUpperCase()
  ) {
    return false;
  }
  if (promotion.salesChannel && !input.salesChannel) return false;

  return true;
}

function calculatePromotionDiscount(input: {
  promotions: PromotionRow[];
  lines: Array<{ productId?: string | null; price: number; qty: number }>;
  branchId?: string | null;
  salesChannel?: string | null;
}) {
  const subtotal = input.lines.reduce(
    (sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0),
    0,
  );

  const workingLines = input.lines.map((line) => ({
    ...line,
    discountAmount: 0,
  }));

  let productDiscount = 0;
  let orderDiscount = 0;
  const appliedNames: string[] = [];
  const discountedProductIds = new Set<string>();
  const breakdown: Array<{
    id: string;
    name: string;
    type: "PRODUCT_DISCOUNT" | "ORDER_DISCOUNT";
    discountAmount: number;
  }> = [];

  const activePromotions = input.promotions
    .filter((promotion) => isPromotionActiveForContext(promotion, input))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  for (const promotion of activePromotions) {
    if (promotion.type === "PRODUCT_DISCOUNT") {
      const productIds = new Set(
        (promotion.products || [])
          .map((row) => String(row.productId || row.product?.id || ""))
          .filter(Boolean),
      );

      let discountForPromotion = 0;

      for (const line of workingLines) {
        if (!line.productId || !productIds.has(String(line.productId)))
          continue;

        const qty = Math.max(1, Number(line.qty || 0));
        const alreadyDiscountedPerUnit = Number(line.discountAmount || 0) / qty;
        const base = Math.max(
          0,
          Number(line.price || 0) - alreadyDiscountedPerUnit,
        );
        const discountPerUnit =
          promotion.discountType === "PERCENT"
            ? (base * Number(promotion.discountValue || 0)) / 100
            : Number(promotion.discountValue || 0);

        const safeDiscount = Math.min(base, Math.max(0, discountPerUnit)) * qty;
        line.discountAmount += safeDiscount;
        discountForPromotion += safeDiscount;
        discountedProductIds.add(String(line.productId));
      }

      if (discountForPromotion > 0) {
        productDiscount += discountForPromotion;
        appliedNames.push(promotion.name);
        breakdown.push({
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          discountAmount: discountForPromotion,
        });
      }
    }

    if (promotion.type === "ORDER_DISCOUNT") {
      const minOrderAmount = Number(promotion.minOrderAmount || 0);
      if (subtotal < minOrderAmount) continue;

      const orderBase = Math.max(0, subtotal - productDiscount - orderDiscount);
      const discount =
        promotion.discountType === "PERCENT"
          ? (orderBase * Number(promotion.discountValue || 0)) / 100
          : Number(promotion.discountValue || 0);

      const safeDiscount = Math.min(orderBase, Math.max(0, discount));
      if (safeDiscount > 0) {
        orderDiscount += safeDiscount;
        appliedNames.push(promotion.name);
        breakdown.push({
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          discountAmount: safeDiscount,
        });
      }
    }
  }

  return {
    productDiscount,
    orderDiscount,
    totalDiscount: productDiscount + orderDiscount,
    appliedNames: Array.from(new Set(appliedNames)),
    discountedProductIds: Array.from(discountedProductIds),
    breakdown,
  };
}

type ShippingQuoteApplyPayload = {
  shippingFee: number;
  applyFeeToInput?: boolean;
  shippingPartner: string;
  shippingMode: string;
  selectedServiceId?: number;
  selectedServiceTypeId?: number;
  selectedQuoteKey?: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  ghnDistrictId?: number;
  ghnWardCode?: string;
};

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function parseNumber(value: string | number) {
  if (typeof value === "number") return value;
  // Tiền VND đang hiển thị dạng 1.005.000, dấu chấm là phân tách nghìn.
  // Không dùng Number("5.000") vì JS sẽ hiểu thành số thập phân 5.
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  return Number(cleaned || 0);
}

function formatVndInput(value: string | number) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function getCurrentUserPermissionKeysFromStorage() {
  const user = getCurrentUserFromStorage() as any;
  const keys = new Set<string>();

  if (isOwnerUser(user)) keys.add("*");

  if (Array.isArray(user?.permissions)) {
    user.permissions.forEach((key: any) => {
      const value = String(key || "").trim();
      if (value) keys.add(value);
    });
  }

  if (Array.isArray(user?.permissionKeys)) {
    user.permissionKeys.forEach((key: any) => {
      const value = String(key || "").trim();
      if (value) keys.add(value);
    });
  }

  if (Array.isArray(user?.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => {
      if (!Array.isArray(row?.permissionKeys)) return;
      row.permissionKeys.forEach((key: any) => {
        const value = String(key || "").trim();
        if (value) keys.add(value);
      });
    });
  }

  return keys;
}

function hasCurrentUserPermission(permission: string) {
  const keys = getCurrentUserPermissionKeysFromStorage();
  return keys.has("*") || keys.has(permission);
}

function normalizeSpaces(value?: string | null) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeSkuSearch(value?: string | null) {
  return removeVietnameseTones(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSearchText(value?: string | null) {
  return removeVietnameseTones(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProvinceName(value?: string | null) {
  return normalizeSpaces(value)
    .replace(/^(tỉnh|thành phố|tp\.?|tp)\s+/i, "")
    .trim();
}

function normalizeDistrictName(value?: string | null) {
  return normalizeSpaces(value)
    .replace(/^(quận|huyện|thị xã|thành phố|tp\.?|tp)\s+/i, "")
    .trim();
}

function normalizeWardName(value?: string | null) {
  return normalizeSpaces(value)
    .replace(/^(xã|phường|thị trấn)\s+/i, "")
    .trim();
}

function normalizeCarrierAddressPart(value?: string | null) {
  return normalizeSpaces(value)
    .replace(/\b(TP|Tp|tp)\.?\s+/g, "Thành phố ")
    .replace(/\bTT\.?\s+/gi, "Thị trấn ")
    .replace(/\bH\.?\s+/gi, "Huyện ")
    .replace(/\bQ\.?\s+/gi, "Quận ")
    .replace(/\bP\.?\s+/gi, "Phường ")
    .replace(/\bX\.?\s+/gi, "Xã ")
    .replace(/Đăk/gi, "Đắk")
    .replace(/Dak/gi, "Đắk")
    .replace(/Đắk R\s*Lấp/gi, "Đắk R'Lấp")
    .replace(/Đăk R\s*Lấp/gi, "Đắk R'Lấp")
    .replace(/Đắk Rlấp/gi, "Đắk R'Lấp")
    .replace(/Đắk R Lấp/gi, "Đắk R'Lấp")
    .trim();
}

function normalizeCarrierProvince(value?: string | null) {
  const cleaned = normalizeCarrierAddressPart(value);
  const token = normalizeAddressToken(cleaned);

  if (token === "hcm" || token === "ho chi minh" || token === "sai gon") {
    return "Hồ Chí Minh";
  }

  if (token === "ha noi") return "Hà Nội";
  if (token === "dak nong" || token === "dac nong") return "Đắk Nông";
  if (token === "dak lak" || token === "dac lak") return "Đắk Lắk";

  return cleaned;
}

function normalizeCarrierDistrict(value?: string | null) {
  const cleaned = normalizeCarrierAddressPart(value);
  const token = normalizeAddressToken(cleaned);

  if (token === "dak r lap" || token === "dak rlap" || token === "dak r lấp") {
    return "Đắk R'Lấp";
  }

  if (token === "tan binh") return "Tân Bình";
  if (token === "quoc oai") return "Quốc Oai";

  return cleaned;
}

function normalizeCarrierWard(value?: string | null) {
  const cleaned = normalizeCarrierAddressPart(value);
  const token = normalizeAddressToken(cleaned);

  if (
    token === "kien duc" ||
    token === "tt kien duc" ||
    token === "thi tran kien duc"
  ) {
    return "Kiến Đức";
  }

  if (token === "sai son") return "Sài Sơn";

  return cleaned;
}

function getViettelOldCarrierAddressOverride(input: {
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  address?: string | null;
}) {
  const rawText = [input.address, input.ward, input.district, input.province]
    .filter(Boolean)
    .join(" ");
  const token = normalizeAddressToken(rawText);

  if (
    token.includes("quoc oai") &&
    (token.includes("sai son") ||
      token.includes("cho thay") ||
      token.includes("chợ thầy"))
  ) {
    return {
      province: "Hà Nội",
      district: "Quốc Oai",
      ward: "Sài Sơn",
    };
  }

  if (
    (token.includes("dak r") || token.includes("dac r")) &&
    token.includes("kien duc")
  ) {
    return {
      province: "Đắk Nông",
      district: "Đắk R'Lấp",
      ward: "Kiến Đức",
    };
  }

  return {
    province: input.province || "",
    district: input.district || "",
    ward: input.ward || "",
  };
}

function buildCarrierToAddress(input: {
  addressLine?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
}) {
  const detail = normalizeCarrierAddressPart(input.addressLine || "");
  const ward = normalizeCarrierWard(input.ward || "");
  const district = normalizeCarrierDistrict(input.district || "");
  const province = normalizeCarrierProvince(input.province || "");

  return [detail, ward, district, province]
    .filter(Boolean)
    .filter((item, index, arr) => {
      const current = normalizeAddressToken(item);
      return (
        arr.findIndex((other) => normalizeAddressToken(other) === current) ===
        index
      );
    })
    .join(", ");
}

function removeVietnameseTones(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeAddressToken(value?: string | null) {
  return removeVietnameseTones(String(value || ""))
    .toLowerCase()
    .replace(/[,.;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function normalizeAddressCompact(value?: string | null) {
  return normalizeAddressToken(value).replace(/[^a-z0-9]/g, "");
}

function addressCandidateScore(raw: string, candidate: string) {
  const rawToken = normalizeAddressToken(raw);
  const rawCompact = normalizeAddressCompact(raw);
  const candidateToken = normalizeAddressToken(candidate);
  const candidateCompact = normalizeAddressCompact(candidate);

  if (!candidateToken || !candidateCompact) return 0;
  if (rawToken.includes(candidateToken)) return 100;
  if (rawCompact.includes(candidateCompact)) return 95;

  const strippedCandidate = candidateToken
    .replace(/^(tinh|thanh pho|tp|quan|huyen|thi xa|xa|phuong|thi tran)\s+/, "")
    .trim();
  const strippedCompact = strippedCandidate.replace(/[^a-z0-9]/g, "");

  if (strippedCandidate && rawToken.includes(strippedCandidate)) return 90;
  if (strippedCompact && rawCompact.includes(strippedCompact)) return 88;

  const words = strippedCandidate.split(/\s+/).filter(Boolean);
  if (words.length && words.every((word) => rawToken.includes(word))) return 75;

  return 0;
}

type SearchableSelectOption = { value: string; label: string };

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Tìm hoặc chọn",
  searchPlaceholder = "Gõ để tìm...",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const selectedLabel = options.find((item) => item.value === value)?.label || "";
  const normalizedKeyword = normalizeSearchText(keyword);
  const filteredOptions = useMemo(() => {
    if (!normalizedKeyword) return options;
    const compactKeyword = normalizedKeyword.replace(/[^a-z0-9]/g, "");
    return options
      .map((item) => {
        const labelText = normalizeSearchText(item.label);
        const labelCompact = labelText.replace(/[^a-z0-9]/g, "");
        const score = labelText.includes(normalizedKeyword)
          ? 100
          : labelCompact.includes(compactKeyword)
            ? 90
            : normalizedKeyword
                .split(/\s+/)
                .filter(Boolean)
                .every((term) => labelText.includes(term))
              ? 70
              : 0;
        return { item, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "vi"))
      .map((row) => row.item);
  }, [options, normalizedKeyword]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          setKeyword("");
        }}
        className={`flex w-full items-center justify-between rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-left text-sm outline-none ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-neutral-400"}`}
      >
        <span className={selectedLabel ? "text-neutral-900" : "text-neutral-500"}>
          {selectedLabel || placeholder}
        </span>
        <span className="text-neutral-400">⌄</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-100 p-2">
            <input
              autoFocus
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-50"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
            {filteredOptions.length ? (
              filteredOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 ${item.value === value ? "bg-neutral-100 font-semibold text-neutral-900" : "text-neutral-700"}`}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                    setKeyword("");
                  }}
                >
                  {item.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-neutral-500">Không tìm thấy địa điểm phù hợp</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function stripProvincePrefix(value?: string | null) {
  return normalizeAddressToken(value)
    .replace(/^(tinh|thanh pho|tp)\s+/, "")
    .trim();
}

function stripDistrictPrefix(value?: string | null) {
  return normalizeAddressToken(value)
    .replace(/^(quan|huyen|thi xa|thanh pho|tp)\s+/, "")
    .trim();
}

function stripWardPrefix(value?: string | null) {
  return normalizeAddressToken(value)
    .replace(/^(xa|phuong|thi tran)\s+/, "")
    .trim();
}

const ADMIN_MERGE_ALIASES: Record<string, string> = {
  "thi tran phuc tho": "xa phuc tho",
};

function getFeeNumber(row: ShipmentQuoteResult) {
  const raw = row as any;
  return Number(
    raw?.fee?.total ||
      raw?.fee?.total_fee ||
      raw?.fee?.service_fee ||
      raw?.data?.user_price_details?.total_fee ||
      raw?.data?.user_price_details?.total_price ||
      raw?.data?.total_price ||
      raw?.data?.total_fee ||
      raw?.data?.service_fee ||
      raw?.fee ||
      0,
  );
}

function getQuoteCarrier(row: ShipmentQuoteResult) {
  return String((row as any)?._carrier || "ghn").toLowerCase();
}

function getQuoteKey(row: ShipmentQuoteResult) {
  const raw = row as any;
  const carrier = getQuoteCarrier(row);

  return String(
    raw?._quoteKey ||
      raw?._ahamoveServiceId ||
      raw?.service_id ||
      raw?.serviceCode ||
      raw?._viettelServiceCode ||
      [
        carrier,
        row.serviceId || 0,
        row.serviceTypeId || 0,
        raw?._serviceName || "",
        raw?.shortName || "",
        raw?.serviceName || "",
        raw?._durationMinutes || "",
        getFeeNumber(row) || "",
      ].join("-"),
  );
}

function getQuoteDisplayName(row: ShipmentQuoteResult) {
  const carrier = getQuoteCarrier(row);
  const rawName =
    (row as any).shortName ||
    (row as any).serviceName ||
    (row as any)._serviceName ||
    `Dịch vụ ${row.serviceId}`;

  if (carrier === "ahamove") {
    return `AhaMove - ${rawName}`;
  }

  if (carrier === "viettelpost") {
    return `Viettel Post - ${rawName}`;
  }

  if (carrier === "ghn") {
    return `GHN - ${rawName}`;
  }

  return rawName;
}

function getQuoteLeadtimeLabel(row: ShipmentQuoteResult) {
  const leadtime = (row as any)?.leadtime;
  const direct = (row as any)?._leadtimeLabel || leadtime?.label;
  if (direct) return String(direct);

  const from = leadtime?.from_estimate_date || leadtime?.fromEstimateDate;
  const to = leadtime?.to_estimate_date || leadtime?.toEstimateDate;
  if (from || to) return [from, to].filter(Boolean).join(" → ");

  const durationMinutes = Number((row as any)?._durationMinutes || 0);
  if (durationMinutes) {
    if (durationMinutes < 60) return `${durationMinutes} phút`;
    const hours = Math.round((durationMinutes / 60) * 10) / 10;
    return `${hours} giờ`;
  }

  return "Đang cập nhật";
}

function getQuoteBadges(row: ShipmentQuoteResult) {
  return Array.isArray((row as any)?._badges) ? (row as any)._badges : [];
}

function normalizeAhamoveQuoteItems(rawQuote: any) {
  if (Array.isArray(rawQuote)) return rawQuote;
  if (Array.isArray(rawQuote?.data)) return rawQuote.data;
  if (Array.isArray(rawQuote?.estimates)) return rawQuote.estimates;
  if (Array.isArray(rawQuote?.data?.estimates)) return rawQuote.data.estimates;
  if (Array.isArray(rawQuote?.services)) return rawQuote.services;
  if (Array.isArray(rawQuote?.data?.services)) return rawQuote.data.services;
  return rawQuote ? [rawQuote] : [];
}

function shouldShowAhamoveService(
  serviceLabel: string,
  shippingWeight: number,
) {
  return true;
}

function getAhamoveServiceDisplayName(serviceLabel: string) {
  const label = String(serviceLabel || "").toUpperCase();

  if (label.includes("TRUCK-1000")) return "Xe tải 1000kg";
  if (label.includes("TRUCK-2000")) return "Xe tải 2000kg";
  if (label.includes("TRUCK-5000")) return "Xe tải 5000kg";
  if (
    label.includes("2H") ||
    label.includes("SAVING") ||
    label.includes("ECONOMY")
  ) {
    return "Siêu Tốc - Tiết Kiệm";
  }
  if (label.includes("BIKE") || label.includes("EXPRESS")) return "Siêu Tốc";

  return serviceLabel || "AhaMove";
}

function parseAhamoveQuoteFee(rawQuote: any) {
  const quoteData = rawQuote?.data || rawQuote || {};
  const quoteFee = Number(
    quoteData?.user_price_details?.total_fee ||
      quoteData?.user_price_details?.total_price ||
      quoteData?.total_fee ||
      quoteData?.totalFee ||
      quoteData?.total_price ||
      quoteData?.totalPrice ||
      quoteData?.subtotal_price ||
      quoteData?.subtotalPrice ||
      quoteData?.service_fee ||
      quoteData?.serviceFee ||
      quoteData?.distance_fee ||
      quoteData?.distanceFee ||
      rawQuote?.fee ||
      rawQuote?.totalFee ||
      rawQuote?.total_fee ||
      0,
  );

  const serviceLabel =
    rawQuote?._serviceName ||
    rawQuote?._ahamoveServiceId ||
    rawQuote?.service_id ||
    rawQuote?.serviceId ||
    quoteData?.service_id ||
    quoteData?.serviceId ||
    "HAN-BIKE";

  const distanceKm = Number(quoteData?.distance || 0);
  const durationSeconds = Number(quoteData?.duration || 0);
  const durationMinutes = durationSeconds
    ? Math.max(1, Math.round(durationSeconds / 60))
    : 0;

  return {
    quoteFee,
    serviceLabel: String(serviceLabel),
    distanceKm,
    durationMinutes,
    raw: rawQuote,
  };
}

function withQuoteBadges(rows: ShipmentQuoteResult[]) {
  const valid = rows.filter((row) => getFeeNumber(row) > 0);
  if (!valid.length) return rows;

  const cheapestFee = Math.min(...valid.map(getFeeNumber));
  const fastestMinutes = Math.min(
    ...valid
      .map((row) => Number((row as any)?._durationMinutes || 0))
      .filter((value) => value > 0),
  );

  const hasFastest = Number.isFinite(fastestMinutes);
  const recommendedKey =
    valid.find(
      (row) =>
        getQuoteCarrier(row) === "ghn" && getFeeNumber(row) === cheapestFee,
    ) ||
    valid.find((row) => getFeeNumber(row) === cheapestFee) ||
    valid[0];

  return rows.map((row) => {
    const badges: string[] = [];
    const fee = getFeeNumber(row);
    const minutes = Number((row as any)?._durationMinutes || 0);

    if (fee > 0 && fee === cheapestFee) badges.push("Rẻ nhất");
    if (hasFastest && minutes > 0 && minutes === fastestMinutes)
      badges.push("Nhanh nhất");
    if (getQuoteKey(row) === getQuoteKey(recommendedKey))
      badges.push("Khuyên dùng");

    return {
      ...(row as any),
      _badges: Array.from(new Set(badges)),
    } as ShipmentQuoteResult;
  });
}

function getCarrierMeta(carrier: string) {
  const normalized = String(carrier || "").toLowerCase();

  if (normalized === "viettelpost") {
    return {
      name: "Viettel Post",
      sub: "Liên tỉnh / COD",
      short: "VTP",
      accent: "border-red-200 bg-red-50 text-red-700",
      soft: "bg-red-50",
      ring: "ring-red-200",
    };
  }

  if (normalized === "ahamove") {
    return {
      name: "AhaMove",
      sub: "Nội thành realtime",
      short: "AHA",
      accent: "border-orange-200 bg-orange-50 text-orange-700",
      soft: "bg-orange-50",
      ring: "ring-orange-200",
    };
  }

  return {
    name: "GHN",
    sub: "Giao hàng nhanh",
    short: "GHN",
    accent: "border-amber-200 bg-amber-50 text-amber-700",
    soft: "bg-amber-50",
    ring: "ring-amber-200",
  };
}

function getSmartQuoteNote(row: ShipmentQuoteResult) {
  const carrier = getQuoteCarrier(row);
  const name = getQuoteDisplayName(row).toLowerCase();
  const badges = getQuoteBadges(row);

  if (badges.includes("Khuyên dùng"))
    return "Cân bằng tốt giữa phí và độ ổn định";
  if (badges.includes("Rẻ nhất")) return "Tối ưu chi phí cho đơn này";
  if (badges.includes("Nhanh nhất")) return "Ưu tiên tốc độ giao hàng";
  if (carrier === "viettelpost" && name.includes("tiêu chuẩn"))
    return "Gói VTP tiết kiệm, hợp đơn COD liên tỉnh";
  if (carrier === "viettelpost" && name.includes("nhanh"))
    return "Gói VTP cân bằng tốc độ và chi phí";
  if (carrier === "ahamove") return "Phù hợp nội thành cần realtime";
  if (carrier === "ghn") return "Gói phổ thông, dễ vận hành";
  return "Có thể chọn cho đơn này";
}

function getQuoteServiceCleanName(row: ShipmentQuoteResult) {
  const carrier = getQuoteCarrier(row);
  const display = getQuoteDisplayName(row);

  return display
    .replace(/^GHN\s*-\s*/i, "")
    .replace(/^AhaMove\s*-\s*/i, "")
    .replace(/^Viettel\s*Post\s*-\s*/i, "")
    .replace(/^Viettel\s*Post\s*-\s*Viettel\s*Post\s*-\s*/i, "")
    .replace(/^Viettel\s*Post\s*-\s*/i, "")
    .replace(carrier === "viettelpost" ? /^Viettel\s*Post\s*-\s*/i : /^$/, "")
    .trim();
}

function groupQuotesByCarrier(rows: ShipmentQuoteResult[]) {
  const order = ["ghn", "viettelpost", "ahamove"];
  const grouped = new Map<string, ShipmentQuoteResult[]>();

  for (const row of rows) {
    const carrier = getQuoteCarrier(row);
    grouped.set(carrier, [...(grouped.get(carrier) || []), row]);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map(([carrier, quotes]) => ({
      carrier,
      meta: getCarrierMeta(carrier),
      quotes: [...quotes].sort((a, b) => getFeeNumber(a) - getFeeNumber(b)),
    }));
}

function getShippingInsight(
  row: ShipmentQuoteResult | null,
  customerFee: number,
) {
  if (!row) {
    return {
      label: "Chưa chọn gói",
      className: "border-neutral-200 bg-neutral-50 text-neutral-600",
    };
  }

  const partnerFee = getFeeNumber(row);
  const diff = Number(customerFee || 0) - partnerFee;

  if (diff > 0) {
    return {
      label: `Khách trả dư ${currency(diff)}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (diff < 0) {
    return {
      label: `Shop bù ${currency(Math.abs(diff))}`,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: "Hòa phí ship",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function formatAddress(address?: CustomerAddressItem | null) {
  if (!address) return "";
  return [
    address.addressLine1,
    address.addressLine2,
    address.ward,
    (address as any).district,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
}

function addressShortLabel(address?: CustomerAddressItem | null) {
  if (!address) return "—";
  return address.label || address.recipientName || "Địa chỉ";
}

function requiredNoteLabel(value: DeliveryRequirement) {
  if (value === "CHOXEMHANG_KHONGTHU") return "Cho xem hàng, không cho thử";
  if (value === "CHOXEMHANG_CHOTHU") return "Cho xem hàng, cho thử";
  return "Không cho xem hàng";
}

function mapRequiredNoteForGhn(value: DeliveryRequirement) {
  if (value === "CHOXEMHANG_KHONGTHU") return "CHOXEMHANGKHONGTHU";
  if (value === "CHOXEMHANG_CHOTHU") return "CHOXEMHANG";
  return "KHONGCHOXEMHANG";
}

function buildCustomerFacingShippingNote(input: {
  orderNote?: string;
  deliveryRequirement: DeliveryRequirement;
}) {
  const parts = [
    requiredNoteLabel(input.deliveryRequirement),
    String(input.orderNote || "").trim(),
  ].filter(Boolean);

  return Array.from(new Set(parts)).join(" | ");
}

function branchLabelFromAny(row: any) {
  return (
    row?.displayName ||
    row?.name ||
    row?.branchName ||
    row?.warehouseName ||
    row?.title ||
    row?.label ||
    row?.code ||
    "Chi nhánh"
  );
}
function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    API_BASE
  ).replace(/\/$/, "");
}

function normalizeColorImageKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function resolveVariantImageUrl(product: any, variant: any) {
  const directVariantImage = String(
    variant?.imageUrl || variant?.image || variant?.image_url || "",
  ).trim();

  if (directVariantImage) return directVariantImage;

  const colorKey = normalizeColorImageKey(variant?.color);
  const colorImages =
    product?.colorImages || product?.imagesByColor || product?.colorImageMap || {};

  if (
    colorKey &&
    colorImages &&
    typeof colorImages === "object" &&
    !Array.isArray(colorImages)
  ) {
    const matched = Object.entries(colorImages).find(
      ([key, value]) =>
        normalizeColorImageKey(key) === colorKey &&
        String(value || "").trim(),
    );

    if (matched) return String(matched[1] || "").trim();
  }

  return String(
    product?.imageUrl || product?.image || product?.thumbnailUrl || "",
  ).trim();
}

function extractCopyOrderNoteValue(
  note: string | undefined | null,
  labels: string[],
) {
  const raw = String(note || "");
  if (!raw.trim()) return "";

  const parts = raw
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const label of labels) {
    const found = parts.find((part) =>
      part.toLowerCase().startsWith(label.toLowerCase()),
    );
    if (found) {
      return found.slice(label.length).trim();
    }
  }

  return "";
}

function splitCopyOrderAddress(fullAddress: string) {
  const parts = String(fullAddress || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { line1: "", ward: "", district: "", province: "" };
  }

  if (parts.length === 1) {
    return { line1: parts[0], ward: "", district: "", province: "" };
  }

  if (parts.length === 2) {
    return { line1: parts[0], ward: "", district: "", province: parts[1] };
  }

  if (parts.length === 3) {
    return {
      line1: parts[0],
      ward: "",
      district: parts[1],
      province: parts[2],
    };
  }

  return {
    line1: parts.slice(0, -3).join(", "),
    ward: parts[parts.length - 3] || "",
    district: parts[parts.length - 2] || "",
    province: parts[parts.length - 1] || "",
  };
}

function isCopyOrderSystemNoteSegment(value?: string | null) {
  const lower = String(value || "")
    .toLowerCase()
    .trim();

  return (
    lower.startsWith("địa chỉ:") ||
    lower.startsWith("dia chi:") ||
    lower.startsWith("address:") ||
    lower.startsWith("customerid:") ||
    lower.startsWith("customer id:") ||
    lower.startsWith("customer_id:") ||
    lower.startsWith("customeraddressid:") ||
    lower.startsWith("customeraddress id:") ||
    lower.startsWith("customeraddress:") ||
    lower.startsWith("giảm giá tay:") ||
    lower.startsWith("giam gia tay:") ||
    lower.startsWith("giảm giá dòng:") ||
    lower.startsWith("giam gia dong:") ||
    lower.startsWith("giảm giá:") ||
    lower.startsWith("giam gia:") ||
    lower.startsWith("phí ship:") ||
    lower.startsWith("phi ship:") ||
    lower.startsWith("khách đã trả:") ||
    lower.startsWith("khach da tra:") ||
    lower.startsWith("còn phải trả:") ||
    lower.startsWith("con phai tra:") ||
    lower.startsWith("kiểu vận chuyển ui:") ||
    lower.startsWith("kieu van chuyen ui:") ||
    lower.startsWith("cách giao:") ||
    lower.startsWith("cach giao:") ||
    lower.startsWith("partner:") ||
    lower.startsWith("đơn vị giao:") ||
    lower.startsWith("don vi giao:") ||
    lower.startsWith("yêu cầu giao hàng:") ||
    lower.startsWith("yeu cau giao hang:") ||
    lower.startsWith("ghn service") ||
    lower.startsWith("khối lượng:") ||
    lower.startsWith("khoi luong:") ||
    lower.startsWith("kích thước:") ||
    lower.startsWith("kich thuoc:") ||
    lower.startsWith("ghn districtid:") ||
    lower.startsWith("ghn wardcode:")
  );
}

function getCleanCopyOrderNote(note?: string | null) {
  const raw = String(note || "").trim();
  if (!raw) return "";

  const parts = raw
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  const explicitNotes = parts
    .filter((part) =>
      /^(Ghi chú nội bộ|Ghi chú đơn hàng|Ghi chú giao hàng|Ghi chú):/i.test(
        part,
      ),
    )
    .map((part) =>
      part
        .replace(/^Ghi chú nội bộ:\s*/i, "")
        .replace(/^Ghi chú đơn hàng:\s*/i, "")
        .replace(/^Ghi chú giao hàng:\s*/i, "")
        .replace(/^Ghi chú:\s*/i, "")
        .trim(),
    )
    .filter((part) => part && !isCopyOrderSystemNoteSegment(part));

  if (explicitNotes.length) return explicitNotes.join(" | ");

  if (parts.length > 1) return "";

  return isCopyOrderSystemNoteSegment(raw) ? "" : raw;
}

function findBestProvinceName(
  raw: string,
  provinceOptions: ProvinceItem[],
): string | null {
  const hit = provinceOptions
    .map((item) => ({ original: item.name, score: addressCandidateScore(raw, item.name) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.original.length - a.original.length)[0];

  return hit?.original || null;
}

function findBestDistrictName(
  raw: string,
  districtOptions: DistrictItem[],
): string | null {
  const hit = districtOptions
    .map((item) => ({ original: item.name, score: addressCandidateScore(raw, item.name) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.original.length - a.original.length)[0];

  return hit?.original || null;
}

function findBestWardName(raw: string, wardOptions: WardItem[]): string | null {
  const normalizedRaw = normalizeAddressToken(raw);
  const replaced = Object.entries(ADMIN_MERGE_ALIASES).reduce(
    (acc, [from, to]) => {
      return acc.includes(from) ? acc.replaceAll(from, to) : acc;
    },
    normalizedRaw,
  );

  const hit = wardOptions
    .map((item) => ({
      original: item.name,
      score: Math.max(addressCandidateScore(raw, item.name), addressCandidateScore(replaced, item.name)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.original.length - a.original.length)[0];

  return hit?.original || null;
}

function extractDetailAddress(raw: string, parts: string[]) {
  let result = raw;
  for (const part of parts) {
    if (!part) continue;
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "ig"), " ");
  }
  return result
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .trim()
    .replace(/^,|,$/g, "");
}

function cleanupParsedDetailAddress(raw: string, parts: string[]) {
  let result = cleanupDetailAddress(extractDetailAddress(raw, parts));
  const normalizedParts = parts
    .map((part) => normalizeAddressToken(part))
    .filter(Boolean);

  result = result
    .split(/[,;]/)
    .map((segment) => segment.trim())
    .filter((segment) => {
      const normalizedSegment = normalizeAddressToken(segment);
      if (!normalizedSegment) return false;
      return !normalizedParts.some(
        (part) =>
          normalizedSegment === part || normalizedSegment.includes(part),
      );
    })
    .join(", ");

  return cleanupDetailAddress(result);
}
function extractPhoneFromRawAddress(raw: string) {
  const matches = String(raw || "").match(/(?:\+?84|0)\d{8,10}/g);
  if (!matches?.length) return { phone: "", cleaned: raw };

  const phone = matches[0].replace(/^\+84/, "0");
  const cleaned = raw.replace(matches[0], " ").replace(/\s+/g, " ").trim();
  return { phone, cleaned };
}

function extractRecipientNameFromRawAddress(raw: string) {
  const normalized = String(raw || "").trim();
  if (!normalized) return { recipientName: "", cleaned: raw };

  const splitters = [" - ", " – ", ",", ";", "|"];
  for (const splitter of splitters) {
    if (normalized.includes(splitter)) {
      const [first, ...rest] = normalized.split(splitter);
      const firstPart = first.trim();

      if (
        firstPart &&
        !/\d/.test(firstPart) &&
        firstPart.length <= 40 &&
        firstPart.split(" ").length <= 6
      ) {
        return {
          recipientName: firstPart,
          cleaned: rest.join(splitter).trim(),
        };
      }
    }
  }

  return { recipientName: "", cleaned: raw };
}

function cleanupDetailAddress(value: string) {
  return String(value || "")
    .replace(/\(\s*cũ\s*\)/gi, " ")
    .replace(/\b(sdt|so dien thoai|dien thoai|phone)\b[:\-]?\s*/gi, " ")
    .replace(/\b(nguoi nhan|ten|khach hang)\b[:\-]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .trim()
    .replace(/^,|,$/g, "");
}

function parseRecipientPhoneAndAddress(raw: string) {
  let working = String(raw || "").trim();

  const phoneResult = extractPhoneFromRawAddress(working);
  working = phoneResult.cleaned;

  const nameResult = extractRecipientNameFromRawAddress(working);
  working = nameResult.cleaned;

  return {
    recipientName: nameResult.recipientName,
    phone: phoneResult.phone,
    addressText: cleanupDetailAddress(working),
  };
}
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "ghost"
        ? "bg-transparent text-neutral-700 hover:bg-neutral-100"
        : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
    >
      {children}
    </button>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        className={`w-full ${maxWidthClass} max-h-[92vh] overflow-auto rounded-3xl bg-white p-5 shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[28px] font-semibold tracking-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-neutral-500"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModePicker({
  open,
  onClose,
  onSelect,
  saving = false,
  canCreateDraft = true,
  canCreateApprove = true,
  canCreateShip = true,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: CreateOrderMode) => void | Promise<void>;
  saving?: boolean;
  canCreateDraft?: boolean;
  canCreateApprove?: boolean;
  canCreateShip?: boolean;
}) {
  if (!open) return null;

  const items = [
    {
      value: "draft" as const,
      title: "Tạo nháp",
      description: "Lưu đơn ở bước đặt hàng.",
      allowed: canCreateDraft,
      lockedText: "Thiếu quyền orders.create",
    },
    {
      value: "approve" as const,
      title: "Tạo và duyệt",
      description: "Chuyển đơn sang bước duyệt để kho xử lý.",
      allowed: canCreateApprove,
      lockedText: "Thiếu quyền orders.approve",
    },
    {
      value: "ship" as const,
      title: "Tạo và xuất kho",
      description: "Đi thẳng tới xuất kho và gửi vận chuyển.",
      allowed: canCreateShip,
      lockedText: "Thiếu quyền orders.pack_ship",
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">Chọn cách tạo đơn</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Mỗi lựa chọn sẽ đưa đơn tới một bước xử lý khác nhau.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`rounded-xl px-3 py-2 text-neutral-500 hover:bg-neutral-100 ${saving ? "cursor-not-allowed opacity-40" : ""}`}
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                if (saving || !item.allowed) return;
                void onSelect(item.value);
              }}
              disabled={saving || !item.allowed}
              className={`flex w-full items-start justify-between rounded-2xl border border-neutral-200 p-4 text-left transition hover:border-black hover:bg-neutral-50 ${saving || !item.allowed ? "pointer-events-none opacity-50" : ""}`}
            >
              <div>
                <div className="text-base font-semibold">{item.title}</div>
                <div className="mt-1 text-sm text-neutral-500">
                  {item.description}
                </div>
                {!item.allowed ? (
                  <div className="mt-2 text-xs font-semibold text-red-600">
                    {item.lockedText}
                  </div>
                ) : null}
              </div>

              <div
                className={`rounded-xl px-3 py-2 text-sm font-medium ${item.allowed ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"}`}
              >
                {saving ? "Đang xử lý..." : item.allowed ? "Chọn" : "Bị khóa"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const salesChannels = [
  { value: "ADMIN", label: "ADMIN" },
  { value: "VN_WEB", label: "VN_WEB" },
  { value: "FACEBOOK", label: "FACEBOOK" },
  { value: "SHOWROOM", label: "SHOWROOM" },
];

const shippingUiModeOptions: Array<{
  value: ShippingUiMode;
  label: string;
  description: string;
}> = [
  {
    value: "carrier",
    label: "Đẩy qua hãng vận chuyển",
    description: "Chọn GHN hoặc AhaMove để lấy phí ship và đẩy đơn.",
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

const shippingPartnerOptions = [
  { value: "ghn", label: "GHN", enabled: true },
  { value: "ghtk", label: "GHTK", enabled: false },
  { value: "viettelpost", label: "Viettel Post", enabled: true },
  { value: "grab", label: "Grab Express", enabled: false },
  { value: "ahamove", label: "AhaMove", enabled: true },
  { value: "outside", label: "Vận chuyển ngoài", enabled: false },
];

const deliveryRequirementOptions: Array<{
  value: DeliveryRequirement;
  label: string;
}> = [
  { value: "CHOXEMHANG_KHONGTHU", label: "Cho xem hàng, không cho thử" },
  { value: "CHOXEMHANG_CHOTHU", label: "Cho xem hàng, cho thử" },
  { value: "KHONGCHOXEMHANG", label: "Không cho xem hàng" },
];

export default function CreateOrderPageClient() {
  const applyShippingRef = useRef<
    ((payload: ShippingQuoteApplyPayload) => void) | null
  >(null);
  const shippingStateRef = useRef({
    shippingUiMode: "carrier" as ShippingUiMode,
    shippingMode: "partner" as ShippingMode,
    shippingPartner: "ghn",
  });
  const phoneLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const phoneLookupSeqRef = useRef(0);
  const suppressPhoneSuggestionRef = useRef(false);
  const phoneSuggestionRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [stockWarningMessage, setStockWarningMessage] = useState("");
  const [copyingOrder, setCopyingOrder] = useState(false);

  const [createMode, setCreateMode] = useState<CreateOrderMode>("draft");
  const [modePickerOpen, setModePickerOpen] = useState(false);

  const [userBranchIds, setUserBranchIds] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [salesChannel, setSalesChannel] = useState("FACEBOOK");
  const [branchId, setBranchId] = useState("");

  const [phoneSearching, setPhoneSearching] = useState(false);
  const [customerHint, setCustomerHint] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPolicyLabel, setCustomerPolicyLabel] = useState("");
  const [customerDiscountPercent, setCustomerDiscountPercent] = useState(0);
  const [customerSuggestions, setCustomerSuggestions] = useState<
    CustomerSuggestionItem[]
  >([]);
  const [customerSuggestionOpen, setCustomerSuggestionOpen] = useState(false);
  const [customerDefaultSuggestions, setCustomerDefaultSuggestions] = useState<
    CustomerSuggestionItem[]
  >([]);
  const [customerAddresses, setCustomerAddresses] = useState<
    CustomerAddressItem[]
  >([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );

  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [provinceOptions, setProvinceOptions] = useState<ProvinceItem[]>([]);
  const [addressDistrictOptions, setAddressDistrictOptions] = useState<
    DistrictItem[]
  >([]);
  const [addressWardOptions, setAddressWardOptions] = useState<WardItem[]>([]);
  const [newCustomerDistrictOptions, setNewCustomerDistrictOptions] = useState<
    DistrictItem[]
  >([]);
  const [newCustomerWardOptions, setNewCustomerWardOptions] = useState<
    WardItem[]
  >([]);

  const [addressLabel, setAddressLabel] = useState("Địa chỉ giao hàng");
  const [addressRecipientName, setAddressRecipientName] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [addressEmail, setAddressEmail] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressWard, setAddressWard] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressSaveAsDefault, setAddressSaveAsDefault] = useState(true);

  const [smartAddressInput, setSmartAddressInput] = useState("");
  const [smartAddressHint, setSmartAddressHint] = useState("");
  const [smartAddressLoading, setSmartAddressLoading] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);

  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");

  const [discountTotal, setDiscountTotal] = useState("0");
  const [shippingFee, setShippingFee] = useState("30000");
  const [couponCode, setCouponCode] = useState("");
  const [customerPaid, setCustomerPaid] = useState("0");
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [shippingMode, setShippingMode] = useState<ShippingMode>("partner");
  const [shippingPayer, setShippingPayer] = useState<ShippingPayer>("shop");
  const [shippingUiMode, setShippingUiMode] =
    useState<ShippingUiMode>("carrier");
  const [shippingPartner, setShippingPartner] = useState("ghn");
  const [ahamovePaymentMethod, setAhamovePaymentMethod] =
    useState<AhamovePaymentMethod>("BALANCE");
  const [deliveryRequirement, setDeliveryRequirement] =
    useState<DeliveryRequirement>("CHOXEMHANG_KHONGTHU");

  const [ghnDistrictId, setGhnDistrictId] = useState<number | undefined>();
  const [ghnWardCode, setGhnWardCode] = useState<string | undefined>();
  const [selectedShippingServiceId, setSelectedShippingServiceId] = useState<
    number | undefined
  >();
  const [selectedShippingServiceTypeId, setSelectedShippingServiceTypeId] =
    useState<number | undefined>();
  const [selectedShippingQuoteKey, setSelectedShippingQuoteKey] = useState("");

  const [shippingWeight, setShippingWeight] = useState(200);
  const [shippingLength, setShippingLength] = useState(10);
  const [shippingWidth, setShippingWidth] = useState(10);
  const [shippingHeight, setShippingHeight] = useState(10);

  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingHint, setShippingHint] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [shippingQuotes, setShippingQuotes] = useState<ShipmentQuoteResult[]>(
    [],
  );
  const shippingQuoteStableKeyRef = useRef("");
  const shippingQuoteRequestSeqRef = useRef(0);
  const [viettelInventories, setViettelInventories] = useState<
    ViettelPostInventory[]
  >([]);
  const [viettelInventoryLoading, setViettelInventoryLoading] = useState(false);
  const [selectedViettelInventoryId, setSelectedViettelInventoryId] = useState<
    number | undefined
  >();
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [pickupLocationsLoading, setPickupLocationsLoading] = useState(false);
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState(
    "default",
  );

  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");

  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerRecipientName, setNewCustomerRecipientName] = useState("");
  const [newCustomerProvince, setNewCustomerProvince] = useState("");
  const [newCustomerDistrict, setNewCustomerDistrict] = useState("");
  const [newCustomerWard, setNewCustomerWard] = useState("");
  const [newCustomerPostalCode, setNewCustomerPostalCode] = useState("");
  const [newCustomerAddressLine, setNewCustomerAddressLine] = useState("");
  const [newCustomerAddressLine2, setNewCustomerAddressLine2] = useState("");
  const [newCustomerCode, setNewCustomerCode] = useState("");
  const [newCustomerTags, setNewCustomerTags] = useState("");
  const [newCustomerNote, setNewCustomerNote] = useState("");

  const [newCustomerSmartAddressInput, setNewCustomerSmartAddressInput] =
    useState("");
  const [newCustomerSmartAddressHint, setNewCustomerSmartAddressHint] =
    useState("");
  const [newCustomerSmartAddressLoading, setNewCustomerSmartAddressLoading] =
    useState(false);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      setError(null);
      const data = await getProductsForOrder();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sản phẩm.");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    const copyFrom =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("copyFrom")
        : "";

    if (!copyFrom) return;

    setCopyingOrder(true);
    setSuccessMessage("Đang sao chép đơn hàng cũ...");
  }, []);

  useEffect(() => {
    const run = async () => {
      const copyFrom =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("copyFrom")
          : "";

      if (!copyFrom || !products.length) return;

      try {
        setCopyingOrder(true);
        setError(null);
        setSuccessMessage("Đang sao chép đơn hàng cũ...");

        const rawOrder = await getOrderForCopy(copyFrom);
        const order =
          rawOrder?.data?.id || rawOrder?.data?.orderCode
            ? rawOrder.data
            : rawOrder?.order?.id || rawOrder?.order?.orderCode
              ? rawOrder.order
              : rawOrder?.item?.id || rawOrder?.item?.orderCode
                ? rawOrder.item
                : rawOrder;

        const snap =
          order?.shippingSnapshot ||
          order?.shipment?.shippingSnapshot ||
          order?.shipment ||
          order?.shipping ||
          {};

        const customer =
          order?.customer ||
          order?.customerInfo ||
          order?.buyer ||
          order?.recipient ||
          {};

        const noteCustomerId = extractCopyOrderNoteValue(order?.note, [
          "CustomerId:",
          "Customer ID:",
          "customer_id:",
        ]);

        const noteCustomerAddressId = extractCopyOrderNoteValue(order?.note, [
          "CustomerAddressId:",
          "CustomerAddress ID:",
          "customerAddressId:",
        ]);

        const noteAddress = extractCopyOrderNoteValue(order?.note, [
          "Địa chỉ:",
          "Dia chi:",
          "Address:",
        ]);

        const nextCustomerId =
          order?.customerId || customer?.id || noteCustomerId || null;

        const nextCustomerName =
          order?.customerName ||
          order?.customerFullName ||
          order?.receiverName ||
          order?.recipientName ||
          order?.toName ||
          snap?.shippingRecipientName ||
          snap?.toName ||
          customer?.fullName ||
          customer?.name ||
          customer?.customerName ||
          "";

        const nextCustomerPhone =
          order?.customerPhone ||
          order?.phone ||
          order?.receiverPhone ||
          order?.recipientPhone ||
          order?.toPhone ||
          snap?.shippingPhone ||
          snap?.toPhone ||
          customer?.phone ||
          "";

        setCustomerId(nextCustomerId);
        setCustomerName(nextCustomerName);
        setCustomerPhone(nextCustomerPhone);
        setCustomerHint(nextCustomerId ? `Khách cũ: ${nextCustomerName}` : "");
        setSalesChannel(order?.salesChannel || "FACEBOOK");

        if (order?.branchId) {
          setBranchId(order.branchId);
        }

        setNote(
          getCleanCopyOrderNote(
            order?.internalNote ||
              order?.orderNote ||
              order?.customerNote ||
              order?.shippingNote ||
              order?.note ||
              "",
          ),
        );

        const preferredAddressId =
          snap?.shippingAddressId ||
          order?.shippingAddressId ||
          order?.customerAddressId ||
          noteCustomerAddressId ||
          customer?.defaultAddressId ||
          "";

        let addressApplied = false;

        if (nextCustomerId) {
          try {
            const rows = await getCustomerAddresses(String(nextCustomerId));
            setCustomerAddresses(rows);

            const selected =
              rows.find(
                (item) => String(item.id) === String(preferredAddressId),
              ) ||
              rows.find((item) => item.isDefault) ||
              rows[0] ||
              null;

            if (selected) {
              setSelectedAddressId(selected.id);
              setAddressRecipientName(
                selected.recipientName || nextCustomerName || "",
              );
              setAddressPhone(selected.phone || nextCustomerPhone || "");
              setAddressProvince(selected.province || "");
              setAddressDistrict((selected as any).district || "");
              setAddressWard(selected.ward || "");
              setAddressLine1(selected.addressLine1 || "");
              setAddressLine2(selected.addressLine2 || "");
              setAddressPostalCode(selected.postalCode || "");

              const full = formatAddress(selected);
              setShippingAddress(full);
              setSmartAddressInput(full);
              addressApplied = true;
            }
          } catch {
            setCustomerAddresses([]);
            setSelectedAddressId(null);
          }
        }

        if (!addressApplied) {
          const rawAddress =
            snap?.shippingAddress ||
            snap?.toAddress ||
            order?.shippingAddress ||
            order?.fullAddress ||
            order?.address ||
            customer?.fullAddress ||
            customer?.address ||
            noteAddress ||
            "";

          const parsedAddress = splitCopyOrderAddress(rawAddress);

          const fallbackAddressLine1 =
            snap?.shippingAddressLine1 ||
            snap?.addressLine1 ||
            order?.shippingAddressLine1 ||
            order?.addressLine1 ||
            customer?.addressLine1 ||
            parsedAddress.line1 ||
            rawAddress ||
            "";

          const fallbackWard =
            snap?.shippingWard ||
            snap?.ward ||
            order?.shippingWard ||
            order?.ward ||
            customer?.ward ||
            parsedAddress.ward ||
            "";

          const fallbackDistrict =
            snap?.shippingDistrict ||
            snap?.district ||
            order?.shippingDistrict ||
            order?.district ||
            customer?.district ||
            parsedAddress.district ||
            "";

          const fallbackProvince =
            snap?.shippingProvince ||
            snap?.province ||
            order?.shippingProvince ||
            order?.province ||
            customer?.province ||
            parsedAddress.province ||
            "";

          const fallbackFull = [
            fallbackAddressLine1,
            fallbackWard,
            fallbackDistrict,
            fallbackProvince,
          ]
            .filter(Boolean)
            .join(", ");

          setAddressRecipientName(nextCustomerName);
          setAddressPhone(nextCustomerPhone);
          setAddressLine1(fallbackAddressLine1);
          setAddressLine2(
            snap?.shippingAddressLine2 || order?.shippingAddressLine2 || "",
          );
          setAddressWard(fallbackWard);
          setAddressDistrict(fallbackDistrict);
          setAddressProvince(fallbackProvince);

          if (fallbackFull) {
            const copiedAddressId = String(
              preferredAddressId || "copied-order-address",
            );

            const copiedAddress = {
              id: copiedAddressId,
              label: "Địa chỉ sao chép",
              recipientName: nextCustomerName,
              phone: nextCustomerPhone,
              addressLine1: fallbackAddressLine1,
              addressLine2:
                snap?.shippingAddressLine2 || order?.shippingAddressLine2 || "",
              ward: fallbackWard,
              district: fallbackDistrict,
              province: fallbackProvince,
              isDefault: true,
            } as CustomerAddressItem;

            setCustomerAddresses([copiedAddress]);
            setSelectedAddressId(copiedAddressId);
          } else {
            setSelectedAddressId(null);
          }

          setShippingAddress(fallbackFull);
          setSmartAddressInput(fallbackFull);
        }

        setShippingFee(
          String(order?.shippingFee ?? snap?.shippingFee ?? 30000),
        );
        setCustomerPaid("0");

        setShippingMode("partner");
        setShippingUiMode("carrier");
        setShippingPartner("ghn");

        setSelectedShippingServiceId(undefined);
        setSelectedShippingServiceTypeId(undefined);
        setSelectedShippingQuoteKey("");
        setShippingQuotes([]);

        const orderItems = Array.isArray(order?.items)
          ? order.items
          : Array.isArray(order?.orderItems)
            ? order.orderItems
            : Array.isArray(order?.lines)
              ? order.lines
              : [];

        const allProductVariants = products.flatMap((p) =>
          p.variants.map((v) => ({
            productId: p.id,
            productName: p.name,
            ...v,
            imageUrl: resolveVariantImageUrl(p, v),
          })),
        );

        const nextLines = orderItems
          .map((item: any) => {
            const variantId = String(
              item.variantId ||
                item.productVariantId ||
                item.variant?.id ||
                item.productVariant?.id ||
                "",
            );

            const itemSku = String(
              item.sku ||
                item.variantSku ||
                item.productVariant?.sku ||
                item.variant?.sku ||
                "",
            );

            const found = allProductVariants.find(
              (v) => String(v.id) === variantId || String(v.sku) === itemSku,
            );

            const safeVariantId = found?.id || variantId;
            const safeSku = found?.sku || itemSku;

            if (!safeVariantId && !safeSku) return null;

            return {
              productId:
                found?.productId ||
                item.productId ||
                item.product?.id ||
                item.productVariant?.productId ||
                null,
              variantId: safeVariantId,
              sku: safeSku,
              productName:
                found?.productName ||
                item.productName ||
                item.name ||
                item.product?.name ||
                item.productVariant?.product?.name ||
                safeSku ||
                "Sản phẩm",
              color:
                found?.color ||
                item.color ||
                item.variant?.color ||
                item.productVariant?.color ||
                "",
              size:
                found?.size ||
                item.size ||
                item.variant?.size ||
                item.productVariant?.size ||
                "",
              price: Number(
                item.price ??
                  item.unitPrice ??
                  item.salePrice ??
                  item.productVariant?.price ??
                  found?.price ??
                  0,
              ),
              stock: Number(found?.stock || 0),
              totalStock: Number(
                (found as any)?.totalStock || found?.stock || 0,
              ),
              branchStock: Number(
                (found as any)?.branchStock || found?.stock || 0,
              ),
              branchStocks: found?.branchStocks || {},
              qty: Number(
                item.qty ?? item.quantity ?? item.quantityOrdered ?? 1,
              ),
              discount: Number(item.discount ?? item.discountAmount ?? 0),
              imageUrl: found?.imageUrl || item.imageUrl || "",
            };
          })
          .filter(Boolean) as OrderLine[];

        setLines(nextLines);

        setSuccessMessage(
          `Đã sao chép đơn ${order?.orderCode || copyFrom}. Chọn lại hãng vận chuyển rồi tạo đơn mới.`,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không sao chép được đơn hàng.",
        );
      } finally {
        setCopyingOrder(false);
      }
    };

    void run();
  }, [products]);

  useEffect(() => {
    const run = async () => {
      try {
        setViettelInventoryLoading(true);
        setPickupLocationsLoading(true);

        const [inventoryRows, pickupRows] = await Promise.all([
          getViettelPostInventories().catch(() => [] as ViettelPostInventory[]),
          getPickupLocations().catch(() => [] as PickupLocation[]),
        ]);

        setViettelInventories(inventoryRows);
        setPickupLocations(mergeCustomAhamovePickups(pickupRows));

        setSelectedViettelInventoryId((current) => {
          if (current && inventoryRows.some((row) => row.groupAddressId === current))
            return current;
          const preferred =
            inventoryRows.find((row) => row.phone === "0975615475") ||
            inventoryRows.find((row) =>
              normalizeAddressToken(row.address).includes("sai son"),
            ) ||
            inventoryRows[0];
          return preferred?.groupAddressId;
        });
      } catch {
        setViettelInventories([]);
        setPickupLocations(mergeCustomAhamovePickups([]));
      } finally {
        setViettelInventoryLoading(false);
        setPickupLocationsLoading(false);
      }
    };

    void run();
  }, []);

  const selectedViettelInventory = useMemo(
    () =>
      viettelInventories.find(
        (item) => item.groupAddressId === selectedViettelInventoryId,
      ) || null,
    [viettelInventories, selectedViettelInventoryId],
  );

  const carrierPickupLocations = useMemo(() => {
    if (shippingUiMode !== "carrier") return [];
    return pickupLocations.filter(
      (item) => String(item.carrier || "").toLowerCase() === shippingPartner,
    );
  }, [pickupLocations, shippingPartner, shippingUiMode]);

  const selectedCarrierPickup = useMemo(() => {
    if (shippingUiMode !== "carrier") return null;
    if (selectedPickupLocationId === "default") return null;
    return (
      carrierPickupLocations.find(
        (item) => String(item.id) === String(selectedPickupLocationId),
      ) || null
    );
  }, [carrierPickupLocations, selectedPickupLocationId, shippingUiMode]);

  useEffect(() => {
    if (shippingUiMode !== "carrier") {
      setSelectedPickupLocationId("default");
      return;
    }

    let configuredPickupId = "default";

    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(CARRIER_PICKUP_MAPPING_STORAGE_KEY)
          : null;
      const mapping = raw ? (JSON.parse(raw) as CarrierPickupMapping) : {};
      const branchMapping = mapping?.[branchId] || {};
      configuredPickupId =
        String(branchMapping?.[shippingPartner as keyof typeof branchMapping] || "") ||
        "default";
    } catch {
      configuredPickupId = "default";
    }

    setSelectedPickupLocationId(() => {
      if (configuredPickupId === "default") return "default";
      return carrierPickupLocations.some(
        (item) => String(item.id) === String(configuredPickupId),
      )
        ? configuredPickupId
        : "default";
    });
  }, [branchId, carrierPickupLocations, shippingPartner, shippingUiMode]);

  useEffect(() => {
    if (shippingPartner !== "viettelpost" || !selectedCarrierPickup) return;
    const groupAddressId = Number(
      selectedCarrierPickup.viettelGroupAddressId ||
        selectedCarrierPickup.groupAddressId ||
        0,
    );
    if (groupAddressId) setSelectedViettelInventoryId(groupAddressId);
  }, [selectedCarrierPickup, shippingPartner]);

  useEffect(() => {
    const run = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const res = await fetch(`${apiBase}/promotions`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });

        if (!res.ok) return;

        const json = await res.json();
        const rows = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.items)
              ? json.items
              : [];

        setPromotions(rows);
      } catch {
        setPromotions([]);
      }
    };

    void run();
  }, []);
  useEffect(() => {
    const run = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const res = await fetch(`${apiBase}/payment-sources`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : [];

        setPaymentSources(rows);
      } catch {}
    };

    void run();
  }, []);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;
    const ids = getUserBranchIds(currentUser);
    setUserBranchIds(ids);
  }, []);

  useEffect(() => {
    const run = async () => {
      const currentUser = getCurrentUserFromStorage();
      const canPickAll = isOwnerUser(currentUser);
      const apiBase = getApiBaseUrl();
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      try {
        setBranchLoading(true);

        const candidates = [
          `${apiBase}/branches`,
          `${apiBase}/settings/branches`,
          `${apiBase}/warehouses`,
          `${apiBase}/settings/warehouses`,
        ];

        let rows: any[] = [];

        for (const url of candidates) {
          try {
            const res = await fetch(url, {
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              cache: "no-store",
            });

            if (!res.ok) continue;

            const json = await res.json();
            const list = Array.isArray(json)
              ? json
              : Array.isArray(json?.items)
                ? json.items
                : Array.isArray(json?.data)
                  ? json.data
                  : [];

            if (list.length) {
              rows = list;
              break;
            }
          } catch {
            continue;
          }
        }

        const mapped: BranchOption[] = rows
          .map((row: any) => ({
            value: String(
              row?.id ??
                row?.branchId ??
                row?.warehouseId ??
                row?.code ??
                row?.slug ??
                "",
            ),
            label: branchLabelFromAny(row),
            code: row?.code ? String(row.code) : undefined,
            type: row?.type ? String(row.type) : undefined,
            isActive: row?.isActive !== false,
          }))
          .filter((item) => item.value);

        const filtered =
          mapped.length > 0
            ? canPickAll
              ? mapped
              : mapped.filter(
                  (item) =>
                    userBranchIds.includes(item.value) ||
                    (item.code && userBranchIds.includes(item.code)),
                )
            : Object.entries(BRANCH_LABELS)
                .filter(([id]) => canPickAll || userBranchIds.includes(id))
                .map(([id, label]) => ({ value: id, label }));

        setBranchOptions(filtered);
        setBranchId((prev) => {
          if (prev && filtered.some((item) => item.value === prev)) return prev;
          return filtered[0]?.value || "";
        });
      } catch {
        const fallback = Object.entries(BRANCH_LABELS)
          .filter(([id]) => canPickAll || userBranchIds.includes(id))
          .map(([id, label]) => ({ value: id, label }));

        setBranchOptions(fallback);
        setBranchId((prev) => prev || fallback[0]?.value || "");
      } finally {
        setBranchLoading(false);
      }
    };

    if (userBranchIds.length || isOwnerUser(getCurrentUserFromStorage())) {
      void run();
    }
  }, [userBranchIds]);

  useEffect(() => {
    const run = async () => {
      try {
        const rows = await getProvinces();
        setProvinceOptions(rows);
        if (rows.length) {
          setAddressProvince((prev) => prev || rows[0].name);
          setNewCustomerProvince((prev) => prev || rows[0].name);
        }
      } catch (err) {
        console.error(err);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      const province = provinceOptions.find(
        (item) => item.name === addressProvince,
      );
      if (!province?.id) {
        setAddressDistrictOptions([]);
        setAddressDistrict("");
        setAddressWardOptions([]);
        setAddressWard("");
        return;
      }

      try {
        const rows = await getDistricts(province.id);
        setAddressDistrictOptions(rows);
      } catch {
        setAddressDistrictOptions([]);
      }
    };
    void run();
  }, [addressProvince, provinceOptions]);

  useEffect(() => {
    const run = async () => {
      const district = addressDistrictOptions.find(
        (item) => item.name === addressDistrict,
      );
      if (!district?.id) {
        setAddressWardOptions([]);
        setAddressWard("");
        return;
      }

      try {
        const rows = await getWards(district.id);
        setAddressWardOptions(rows);
      } catch {
        setAddressWardOptions([]);
      }
    };
    void run();
  }, [addressDistrict, addressDistrictOptions]);

  useEffect(() => {
    const run = async () => {
      const province = provinceOptions.find(
        (item) => item.name === newCustomerProvince,
      );
      if (!province?.id) {
        setNewCustomerDistrictOptions([]);
        setNewCustomerDistrict("");
        setNewCustomerWardOptions([]);
        setNewCustomerWard("");
        return;
      }

      try {
        const rows = await getDistricts(province.id);
        setNewCustomerDistrictOptions(rows);
      } catch {
        setNewCustomerDistrictOptions([]);
      }
    };
    void run();
  }, [newCustomerProvince, provinceOptions]);

  useEffect(() => {
    const run = async () => {
      const district = newCustomerDistrictOptions.find(
        (item) => item.name === newCustomerDistrict,
      );
      if (!district?.id) {
        setNewCustomerWardOptions([]);
        setNewCustomerWard("");
        return;
      }

      try {
        const rows = await getWards(district.id);
        setNewCustomerWardOptions(rows);
      } catch {
        setNewCustomerWardOptions([]);
      }
    };
    void run();
  }, [newCustomerDistrict, newCustomerDistrictOptions]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!phoneSuggestionRef.current) return;
      if (!phoneSuggestionRef.current.contains(event.target as Node)) {
        setCustomerSuggestionOpen(false);
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    return () => {
      if (phoneLookupTimerRef.current) {
        clearTimeout(phoneLookupTimerRef.current);
      }
    };
  }, []);

  const provinceSelectOptions = useMemo(
    () =>
      provinceOptions.map((item) => ({ value: item.name, label: item.name })),
    [provinceOptions],
  );

  const addressDistrictSelectOptions = useMemo(
    () =>
      addressDistrictOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [addressDistrictOptions],
  );

  const addressWardSelectOptions = useMemo(
    () =>
      addressWardOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [addressWardOptions],
  );

  const newCustomerDistrictSelectOptions = useMemo(
    () =>
      newCustomerDistrictOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [newCustomerDistrictOptions],
  );

  const newCustomerWardSelectOptions = useMemo(
    () =>
      newCustomerWardOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [newCustomerWardOptions],
  );

  const allVariants = useMemo(() => {
    const currentUser = getCurrentUserFromStorage();
    const canPickBranch = isOwnerUser(currentUser);

    return products.flatMap((product) =>
      product.variants.map((variant) => {
        const branchStocks: Record<string, number> =
          ((variant as any).branchStocks as Record<string, number>) || {};

        const totalStock = Object.keys(branchStocks).reduce(
          (sum, key) => sum + Number(branchStocks[key] || 0),
          0,
        );

        // ✅ Không ẩn sản phẩm khi chi nhánh đang làm việc hết hàng.
        // Tồn theo branch chỉ dùng để hiển thị/cảnh báo, không dùng để chặn tìm kiếm.
        const branchStock = Number(branchStocks[branchId] || 0);
        const stock = canPickBranch ? totalStock : branchStock;

        return {
          ...variant,
          productId: (product as any).id,
          productName: product.name,
          imageUrl: resolveVariantImageUrl(product, variant),
          stock,
          totalStock,
          branchStock,
          branchStocks,
        };
      }),
    );
  }, [products, branchId]);

  const buildStockWarning = (item: any, qty = 1) => {
    const totalStock = Number(item?.totalStock ?? item?.stock ?? 0);
    const branchStock = Number(item?.branchStock ?? item?.stock ?? 0);
    const sku = String(item?.sku || "Sản phẩm");

    if (totalStock <= 0) {
      return `Cảnh báo: ${sku} đã hết hàng ở tất cả chi nhánh. Vẫn cho phép tạo đơn và sẽ xuất âm kho.`;
    }

    if (branchStock < qty) {
      return `Cảnh báo: ${sku} không đủ tồn ở chi nhánh này. Tồn CN ${branchStock}, cần ${qty}. Vẫn cho phép tạo đơn và sẽ xuất âm kho tại chi nhánh đang bán.`;
    }

    return "";
  };

  const stockWarnings = useMemo(() => {
    return lines
      .map((line) => buildStockWarning(line, Number(line.qty || 1)))
      .filter(Boolean);
  }, [lines]);

  const filteredVariants = useMemo(() => {
    const raw = productSearch.trim();
    const skuQuery = normalizeSkuSearch(raw);
    const textQuery = normalizeSearchText(raw);

    // Ô tìm sản phẩm mới được mở danh sách gợi ý.
    // Ô scan chỉ dùng để cộng mã chính xác vào đơn, không làm xổ list để tránh nhìn như nhảy sang SKU khác.
    if (!skuQuery && !textQuery) return [];

    return allVariants.filter((variant) => {
      const sku = normalizeSkuSearch(variant.sku || "");
      const productName = normalizeSearchText(
        (variant as any).productName || "",
      );
      const color = normalizeSearchText((variant as any).color || "");
      const size = normalizeSearchText((variant as any).size || "");
      const combinedText = [productName, color, size].filter(Boolean).join(" ");

      return (
        Boolean(skuQuery && sku.includes(skuQuery)) ||
        Boolean(textQuery && combinedText.includes(textQuery))
      );
    });
  }, [allVariants, productSearch]);

  const shouldShowProductResults = productSearch.trim().length > 0;

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    [lines],
  );

  const lineDiscountTotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.discount || 0), 0),
    [lines],
  );

  const manualDiscount = parseNumber(discountTotal);
  const fee = parseNumber(shippingFee);
  const paid = parseNumber(customerPaid);
  const promotionPreview = useMemo(
    () =>
      calculatePromotionDiscount({
        promotions,
        lines,
        branchId,
        salesChannel:
          shippingUiMode === "pickup" || shippingMode === "pickup"
            ? "POS"
            : salesChannel,
      }),
    [promotions, lines, branchId, salesChannel, shippingUiMode, shippingMode],
  );
  const autoPromotionDiscount = promotionPreview.totalDiscount;
  const discountedProductIdSet = useMemo(
    () => new Set(promotionPreview.discountedProductIds || []),
    [promotionPreview.discountedProductIds],
  );
  const totalDiscount =
    lineDiscountTotal + manualDiscount + autoPromotionDiscount;
  const customerMustPay = Math.max(0, subtotal - totalDiscount + fee);
  const remaining = Math.max(0, customerMustPay - paid);
  const orderValueForInsurance = Math.max(0, subtotal - totalDiscount);

  useEffect(() => {
    const selected = paymentSources.find((s) => s.id === paymentSourceId);
    if (!selected) return;

    // Chỉ nguồn COD mới tự đưa khách đã trả về 0.
    // Tiền mặt/chuyển khoản phải giữ nguyên số nhân viên nhập tay.
    if (String(selected.type || "").toUpperCase() === "COD") {
      setCustomerPaid("0");
    }
  }, [paymentSourceId, paymentSources]);

  const visiblePaymentSources = useMemo(() => {
    const selectedBranch = branchOptions.find(
      (item) =>
        String(item.value) === String(branchId) ||
        String(item.code || "") === String(branchId),
    );

    const selectedBranchTexts = [
      branchId,
      selectedBranch?.code,
      selectedBranch?.label,
      (BRANCH_LABELS as Record<string, string>)[branchId],
      branchId === "QO" ? "QUOC OAI" : "",
      branchId === "TH" ? "THAI HA" : "",
      branchId === "XD" ? "XA DAN" : "",
      branchId === "CL" ? "CHUA LANG" : "",
    ]
      .filter(Boolean)
      .map((value) => normalizeSearchText(String(value)));

    const knownBranchTokens = [
      "qo",
      "quoc oai",
      "th",
      "thai ha",
      "xd",
      "xa dan",
      "cl",
      "chua lang",
    ];

    return paymentSources.filter((source) => {
      if (source.isActive === false) return false;

      const sourceBranchId =
        source.branchId ||
        source.branch?.id ||
        source.warehouseId ||
        source.storeId;

      if (sourceBranchId) {
        return (
          String(sourceBranchId) === String(branchId) ||
          String(sourceBranchId) === String(selectedBranch?.code || "")
        );
      }

      const sourceText = normalizeSearchText(
        [
          source.name,
          source.label,
          source.code,
          source.branch?.name,
          source.branch?.code,
        ]
          .filter(Boolean)
          .join(" "),
      );

      const hasBranchMarker = knownBranchTokens.some((token) =>
        sourceText.includes(token),
      );

      if (!hasBranchMarker) return true;

      return selectedBranchTexts.some(
        (token) => token && sourceText.includes(token),
      );
    });
  }, [paymentSources, branchId, branchOptions]);

  useEffect(() => {
    if (!paymentSourceId) return;

    const stillValid = visiblePaymentSources.some(
      (s) => String(s.id) === String(paymentSourceId),
    );

    if (!stillValid) setPaymentSourceId("");
  }, [visiblePaymentSources, paymentSourceId]);

  const previewBranch =
    branchOptions.find((item) => item.value === branchId)?.label ||
    branchId ||
    "—";

  const selectedAddress =
    customerAddresses.find((item) => item.id === selectedAddressId) || null;
  const customerAddressDisplay = formatAddress(selectedAddress) || "";
  const currentProvinceRaw = selectedAddress?.province || addressProvince;
  const currentDistrictRaw =
    (selectedAddress as any)?.district || addressDistrict;
  const currentWardRaw = selectedAddress?.ward || addressWard;

  const quoteProvince = normalizeProvinceName(currentProvinceRaw || "");
  const quoteDistrict = normalizeDistrictName(currentDistrictRaw || "");
  const quoteWard = normalizeWardName(currentWardRaw || "");

  const carrierQuoteProvince = normalizeCarrierProvince(quoteProvince);
  const carrierQuoteDistrict = normalizeCarrierDistrict(quoteDistrict);
  const carrierQuoteWard = normalizeCarrierWard(quoteWard);
  const carrierToAddress = buildCarrierToAddress({
    addressLine:
      selectedAddress?.addressLine1 ||
      addressLine1.trim() ||
      shippingAddress.trim(),
    ward: carrierQuoteWard,
    district: carrierQuoteDistrict,
    province: carrierQuoteProvince,
  });

  const viettelOldCarrierAddress = getViettelOldCarrierAddressOverride({
    address:
      selectedAddress?.addressLine1 ||
      addressLine1.trim() ||
      shippingAddress.trim(),
    province: quoteProvince,
    district: quoteDistrict,
    ward: quoteWard,
  });

  const quoteItems = useMemo(() => {
    const activeLines = lines.filter((item) => Number(item.qty || 0) > 0);

    // Cho phép báo phí ngay khi đã có địa chỉ, chưa cần chọn sản phẩm.
    // Sapo bắt buộc có hàng để tính kiện; mình dùng kiện mặc định 200g để tăng tốc tạo đơn.
    if (!activeLines.length) {
      return [
        {
          name: "Sản phẩm mặc định",
          quantity: 1,
          length: Number(shippingLength || 10),
          width: Number(shippingWidth || 10),
          height: Number(shippingHeight || 10),
          weight: Number(shippingWeight || 200),
        },
      ];
    }

    return activeLines.map((item) => ({
      name: item.productName || item.sku || "Sản phẩm",
      quantity: Number(item.qty || 0),
      length: Number(shippingLength || 10),
      width: Number(shippingWidth || 10),
      height: Number(shippingHeight || 10),
      weight: Math.max(
        1,
        Math.floor(Number(shippingWeight || 200) / Math.max(activeLines.length, 1)),
      ),
    }));
  }, [lines, shippingLength, shippingWidth, shippingHeight, shippingWeight]);

  const shippingQuoteStableKey = useMemo(() => {
    const toAddress =
      carrierToAddress ||
      selectedAddress?.addressLine1 ||
      addressLine1.trim() ||
      shippingAddress.trim();

    return JSON.stringify({
      uiMode: shippingUiMode,
      fromAddress: normalizeSpaces(selectedCarrierPickup?.address || "default"),
      fromPhone: normalizePhone(selectedCarrierPickup?.phone || ""),
      pickupLocationId: selectedPickupLocationId || "default",
      toAddress: normalizeSpaces(toAddress),
      province: normalizeSpaces(quoteProvince),
      district: normalizeSpaces(quoteDistrict),
      ward: normalizeSpaces(quoteWard),
      weight: Number(shippingWeight || 200),
      length: Number(shippingLength || 10),
      width: Number(shippingWidth || 10),
      height: Number(shippingHeight || 10),
    });
  }, [
    shippingUiMode,
    selectedCarrierPickup?.address,
    selectedCarrierPickup?.phone,
    selectedPickupLocationId,
    carrierToAddress,
    selectedAddress?.addressLine1,
    addressLine1,
    shippingAddress,
    quoteProvince,
    quoteDistrict,
    quoteWard,
    shippingWeight,
    shippingLength,
    shippingWidth,
    shippingHeight,
  ]);

  const selectedQuote =
    shippingQuotes.find(
      (q) => selectedShippingQuoteKey && getQuoteKey(q) === selectedShippingQuoteKey && !(q as any)?._disabled,
    ) ||
    shippingQuotes.find(
      (q) =>
        getQuoteCarrier(q) === shippingPartner &&
        q.serviceId === selectedShippingServiceId &&
        q.serviceTypeId === selectedShippingServiceTypeId &&
        !(q as any)?._disabled,
    ) ||
    null;


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setAhamovePaymentMethod(
        normalizeAhamovePaymentMethod(
          localStorage.getItem(AHAMOVE_PAYMENT_METHOD_STORAGE_KEY),
        ),
      );
    } catch {
      setAhamovePaymentMethod("BALANCE");
    }
  }, []);

  const ahamovePaymentMethodLabel = getAhamovePaymentMethodLabel(ahamovePaymentMethod);
  const ahamovePaymentMethodDescription = getAhamovePaymentMethodDescription(ahamovePaymentMethod);

  const handleAhamovePaymentMethodChange = (nextValue: AhamovePaymentMethod) => {
    const safeValue = normalizeAhamovePaymentMethod(nextValue);
    setAhamovePaymentMethod(safeValue);
    setShippingPayer(inferShippingPayerFromAhamovePaymentMethod(safeValue));
    try {
      localStorage.setItem(AHAMOVE_PAYMENT_METHOD_STORAGE_KEY, safeValue);
    } catch {
      // ignore localStorage error
    }
  };

  const appendCustomerFacingNote = (value?: string | null) => {
    const next = String(value || "").trim();
    if (!next) return;

    setNote((prev) => {
      const current = String(prev || "").trim();
      if (!current) return next;
      if (current.toLowerCase().includes(next.toLowerCase())) return current;
      return `${current}\n${next}`;
    });
  };

  const resetAddressForm = () => {
    setAddressError("");
    setEditingAddressId(null);
    setAddressLabel("Địa chỉ giao hàng");
    setAddressRecipientName(customerName || "");
    setAddressPhone(customerPhone || "");
    setAddressEmail("");
    setAddressProvince(provinceOptions[0]?.name || "");
    setAddressDistrict("");
    setAddressWard("");
    setAddressPostalCode("");
    setAddressLine1("");
    setAddressLine2("");
    setAddressSaveAsDefault(true);
    setSmartAddressInput("");
    setSmartAddressHint("");
  };

  const applySelectedAddress = (address: CustomerAddressItem) => {
    setSelectedAddressId(address.id);
    const full = [
      address.addressLine1,
      address.addressLine2,
      address.ward,
      (address as any).district,
      address.province,
    ]
      .filter(Boolean)
      .join(", ");

    setShippingAddress(full);
    setSmartAddressInput(full);

    if (address.recipientName) setCustomerName(address.recipientName);
    if (address.phone) setCustomerPhone(address.phone);

    setAddressProvince(address.province || "");
    setAddressDistrict((address as any).district || "");
    setAddressWard(address.ward || "");
    setAddressLine1(address.addressLine1 || "");
    setAddressLine2(address.addressLine2 || "");

    setGhnDistrictId((address as any).ghnDistrictId ?? undefined);
    setGhnWardCode((address as any).ghnWardCode || undefined);

    appendCustomerFacingNote(
      (address as any).shippingNote ||
        (address as any).deliveryNote ||
        (address as any).note ||
        (address as any).customerNote ||
        "",
    );
  };

  const loadCustomerAddressBook = async (nextCustomerId: string) => {
    const rows = await getCustomerAddresses(nextCustomerId);
    setCustomerAddresses(rows);

    const defaultAddress =
      rows.find((item) => item.isDefault) || rows[0] || null;

    if (defaultAddress) {
      applySelectedAddress(defaultAddress);
    } else {
      setSelectedAddressId(null);
      setShippingAddress("");
      setSmartAddressInput("");
    }
  };

  const applyCustomerSelection = async (customer: SearchCustomerLite) => {
    setCustomerId(customer.id || null);
    setCustomerName(customer.fullName || "");
    setCustomerPhone(customer.phone || "");
    setCustomerHint(`Khách cũ: ${customer.fullName || ""}`);
    setCustomerPolicyLabel(String(customer.pricePolicyName || ""));
    setCustomerDiscountPercent(Number(customer.defaultDiscountPercent || 0));
    appendCustomerFacingNote(
      (customer as any).customerNote ||
        (customer as any).note ||
        (customer as any).defaultAddress?.note ||
        (customer as any).defaultAddress?.shippingNote ||
        "",
    );

    if (customer.id) {
      try {
        await loadCustomerAddressBook(customer.id);
      } catch {}
    }
  };

  const clearCustomerLookupState = () => {
    setCustomerId(null);
    setCustomerPolicyLabel("");
    setCustomerDiscountPercent(0);
    setCustomerAddresses([]);
    setSelectedAddressId(null);
    setCustomerSuggestions(customerDefaultSuggestions);
    setCustomerSuggestionOpen(customerDefaultSuggestions.length > 0);
  };

  const buildCustomerSuggestion = (customer: any): CustomerSuggestionItem => {
    const fullName = String(
      customer?.fullName ||
        customer?.name ||
        customer?.customerName ||
        "Khách hàng",
    );
    const phone = String(customer?.phone || "");
    const email = String(customer?.email || "");
    const address =
      customer?.defaultAddress?.addressLine1 ||
      customer?.addressLine1 ||
      customer?.address ||
      "";

    return {
      ...customer,
      id: customer?.id ? String(customer.id) : undefined,
      fullName,
      phone,
      email,
      customerNote:
        customer?.customerNote ||
        customer?.note ||
        customer?.defaultAddress?.note ||
        customer?.defaultAddress?.shippingNote ||
        "",
      label: `${fullName}${phone ? ` · ${phone}` : ""}`,
      subLabel: [email, address].filter(Boolean).join(" · "),
    };
  };

  const loadDefaultCustomerSuggestions = async () => {
    try {
      const result: any = await findCustomerByPhone("");

      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.data)
            ? result.data
            : result
              ? [result]
              : [];

      const normalizedRows = rows
        .filter(Boolean)
        .map(buildCustomerSuggestion)
        .slice(0, 12);

      setCustomerDefaultSuggestions(normalizedRows);
      setCustomerSuggestions(normalizedRows);
      setCustomerSuggestionOpen(normalizedRows.length > 0);
    } catch {
      setCustomerDefaultSuggestions([]);
      setCustomerSuggestions([]);
      setCustomerSuggestionOpen(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    suppressPhoneSuggestionRef.current = false;
    setCustomerPhone(value);
    setCustomerHint("");

    if (phoneLookupTimerRef.current) {
      clearTimeout(phoneLookupTimerRef.current);
      phoneLookupTimerRef.current = null;
    }

    const cleaned = normalizePhone(value);

    const lookupSeq = ++phoneLookupSeqRef.current;

    if (cleaned.length < 1) {
      setCustomerSuggestions(customerDefaultSuggestions);
      setCustomerSuggestionOpen(customerDefaultSuggestions.length > 0);
      setCustomerHint("");
      return;
    }

    phoneLookupTimerRef.current = setTimeout(async () => {
      try {
        setPhoneSearching(true);

        const result: any = await findCustomerByPhone(cleaned);

        const rows = Array.isArray(result)
          ? result
          : Array.isArray(result?.items)
            ? result.items
            : Array.isArray(result?.data)
              ? result.data
              : result
                ? [result]
                : [];

        if (
          lookupSeq !== phoneLookupSeqRef.current ||
          suppressPhoneSuggestionRef.current
        ) {
          return;
        }

        const normalizedRows = rows
          .filter(Boolean)
          .map(buildCustomerSuggestion)
          .filter((item) => {
            const phone = normalizePhone(item.phone);
            const name = removeVietnameseTones(String(item.fullName || ""))
              .toLowerCase()
              .trim();
            const keyword = removeVietnameseTones(String(value || ""))
              .toLowerCase()
              .trim();

            return phone.includes(cleaned) || name.includes(keyword);
          })
          .slice(0, 12);

        setCustomerSuggestions(normalizedRows);
        setCustomerSuggestionOpen(normalizedRows.length > 0);
        setCustomerHint(
          normalizedRows.length
            ? `Tìm thấy ${normalizedRows.length} khách.`
            : "Chưa có khách cũ cho từ khóa này.",
        );
      } catch {
        if (
          lookupSeq !== phoneLookupSeqRef.current ||
          suppressPhoneSuggestionRef.current
        ) {
          return;
        }

        setCustomerSuggestions([]);
        setCustomerSuggestionOpen(false);
        setCustomerHint("");
      } finally {
        if (lookupSeq === phoneLookupSeqRef.current) {
          setPhoneSearching(false);
        }
      }
    }, 120);
  };

  const handlePickSuggestedCustomer = async (
    customer: CustomerSuggestionItem,
  ) => {
    suppressPhoneSuggestionRef.current = true;
    phoneLookupSeqRef.current += 1;

    if (phoneLookupTimerRef.current) {
      clearTimeout(phoneLookupTimerRef.current);
      phoneLookupTimerRef.current = null;
    }

    setCustomerSuggestions([]);
    setCustomerSuggestionOpen(false);
    setPhoneSearching(false);

    await applyCustomerSelection(customer);
  };

  const handleSmartAddressApply = async (rawValue: string) => {
    const raw = String(rawValue || "").trim();
    setSmartAddressInput(raw);

    if (!raw) {
      setSmartAddressHint("");
      return;
    }

    try {
      setSmartAddressLoading(true);
      setSmartAddressHint("");

      const parsed = parseRecipientPhoneAndAddress(raw);

      if (parsed.recipientName) {
        setAddressRecipientName(parsed.recipientName);
        setCustomerName(parsed.recipientName);
      }

      if (parsed.phone) {
        setAddressPhone(parsed.phone);
        setCustomerPhone(parsed.phone);
      }

      const addressOnly = parsed.addressText || raw;
      setShippingAddress(addressOnly);

      const provinceName = findBestProvinceName(addressOnly, provinceOptions);
      if (!provinceName) {
        setAddressLine1(addressOnly);
        setSmartAddressHint("Đã lấy tên/sđt, nhưng chưa nhận ra tỉnh / thành.");
        return;
      }

      setAddressProvince(provinceName);
      const province = provinceOptions.find(
        (item) => item.name === provinceName,
      );
      if (!province?.id) return;

      const districts = await getDistricts(province.id);
      setAddressDistrictOptions(districts);

      const districtName = findBestDistrictName(addressOnly, districts);
      if (!districtName) {
        setAddressLine1(addressOnly);
        setAddressDistrict("");
        setAddressWard("");
        setSmartAddressHint(
          "Đã lấy tên/sđt và nhận diện tỉnh / thành, chưa chắc quận huyện.",
        );
        return;
      }

      setAddressDistrict(districtName);
      const district = districts.find((item) => item.name === districtName);
      if (!district?.id) return;

      const wards = await getWards(district.id);
      setAddressWardOptions(wards);

      const wardName = findBestWardName(addressOnly, wards);
      if (wardName) {
        setAddressWard(wardName);
      } else {
        setAddressWard("");
      }

      const detail = extractDetailAddress(addressOnly, [
        provinceName,
        districtName,
        wardName || "",
      ]);

      setAddressLine1(
        cleanupParsedDetailAddress(addressOnly, [
          provinceName,
          districtName,
          wardName || "",
        ]) || cleanupDetailAddress(detail || addressOnly),
      );

      const normalizedRaw = normalizeAddressToken(addressOnly);
      const aliasMatched = Object.keys(ADMIN_MERGE_ALIASES).some((key) =>
        normalizedRaw.includes(key),
      );

      setSmartAddressHint(
        wardName
          ? aliasMatched
            ? "Đã tự map tên người nhận, sđt và địa chỉ cũ sang địa chỉ sau sáp nhập."
            : "Đã tự nhận diện người nhận, sđt, tỉnh / huyện / xã."
          : "Đã lấy tên/sđt và nhận diện tỉnh / huyện, chưa chắc xã.",
      );
    } catch {
      setSmartAddressHint(
        "Đã thử tách người nhận / sđt / địa chỉ nhưng chưa map hết được.",
      );
    } finally {
      setSmartAddressLoading(false);
    }
  };
  const handleNewCustomerSmartAddressApply = async (rawValue: string) => {
    const raw = String(rawValue || "").trim();
    setNewCustomerSmartAddressInput(raw);

    if (!raw) {
      setNewCustomerSmartAddressHint("");
      return;
    }

    try {
      setNewCustomerSmartAddressLoading(true);
      setNewCustomerSmartAddressHint("");

      const parsed = parseRecipientPhoneAndAddress(raw);

      if (parsed.recipientName) {
        setNewCustomerRecipientName(parsed.recipientName);
      }

      if (parsed.phone) {
        setNewCustomerPhone(parsed.phone);
      }

      const addressOnly = parsed.addressText || raw;

      const provinceName = findBestProvinceName(addressOnly, provinceOptions);
      if (!provinceName) {
        setNewCustomerAddressLine(addressOnly);
        setNewCustomerSmartAddressHint(
          "Đã lấy tên/sđt, nhưng chưa nhận ra tỉnh / thành.",
        );
        return;
      }

      setNewCustomerProvince(provinceName);
      const province = provinceOptions.find(
        (item) => item.name === provinceName,
      );
      if (!province?.id) return;

      const districts = await getDistricts(province.id);
      setNewCustomerDistrictOptions(districts);

      const districtName = findBestDistrictName(addressOnly, districts);
      if (!districtName) {
        setNewCustomerAddressLine(addressOnly);
        setNewCustomerDistrict("");
        setNewCustomerWard("");
        setNewCustomerSmartAddressHint(
          "Đã lấy tên/sđt và nhận diện tỉnh / thành, cần kiểm tra thêm quận huyện.",
        );
        return;
      }

      setNewCustomerDistrict(districtName);
      const district = districts.find((item) => item.name === districtName);
      if (!district?.id) return;

      const wards = await getWards(district.id);
      setNewCustomerWardOptions(wards);

      const wardName = findBestWardName(addressOnly, wards);
      if (wardName) {
        setNewCustomerWard(wardName);
      } else {
        setNewCustomerWard("");
      }

      const detail = extractDetailAddress(addressOnly, [
        provinceName,
        districtName,
        wardName || "",
      ]);

      setNewCustomerAddressLine(
        cleanupParsedDetailAddress(addressOnly, [
          provinceName,
          districtName,
          wardName || "",
        ]) || cleanupDetailAddress(detail || addressOnly),
      );

      const normalizedRaw = normalizeAddressToken(addressOnly);
      const aliasMatched = Object.keys(ADMIN_MERGE_ALIASES).some((key) =>
        normalizedRaw.includes(key),
      );

      setNewCustomerSmartAddressHint(
        wardName
          ? aliasMatched
            ? "Đã tự map tên người nhận, sđt và địa chỉ cũ sang địa chỉ sau sáp nhập."
            : "Đã tự nhận diện người nhận, sđt, tỉnh / huyện / xã."
          : "Đã lấy tên/sđt và nhận diện tỉnh / huyện, chưa chắc xã.",
      );
    } catch {
      setNewCustomerAddressLine(raw);
      setNewCustomerSmartAddressHint(
        "Đã thử tách người nhận / sđt / địa chỉ nhưng chưa map hết.",
      );
    } finally {
      setNewCustomerSmartAddressLoading(false);
    }
  };
  useEffect(() => {
    if (customerDiscountPercent > 0 && subtotal > 0) {
      setDiscountTotal(
        String(Math.floor((subtotal * customerDiscountPercent) / 100)),
      );
    }
  }, [subtotal, customerDiscountPercent]);

  const addVariantToOrder = (variantId: string) => {
    const found = allVariants.find((v) => v.id === variantId);
    if (!found) return;

    const stockWarning = buildStockWarning(found, 1);
    setStockWarningMessage(stockWarning);

    setProductSearch("");
    setBarcodeInput("");

    setLines((prev) => {
      const existing = prev.find((line) => line.variantId === variantId);
      if (existing) {
        return prev.map((line) =>
          line.variantId === variantId
            ? {
                ...line,
                // ✅ Cho phép bán âm, không giới hạn số lượng theo tồn kho hiện tại.
                qty: line.qty + 1,
              }
            : line,
        );
      }

      return [
        ...prev,
        {
          productId:
            (found as any).productId || (found as any).product?.id || null,
          variantId: found.id,
          sku: found.sku,
          productName: (found as any).productName,
          color: (found as any).color,
          size: (found as any).size,
          price: Number(found.price || 0),
          stock: Number((found as any).stock || 0),
          totalStock: Number(
            (found as any).totalStock ?? (found as any).stock ?? 0,
          ),
          branchStock: Number(
            (found as any).branchStock ?? (found as any).stock ?? 0,
          ),
          branchStocks:
            ((found as any).branchStocks as Record<string, number>) || {},
          qty: 1,
          discount: 0,
          imageUrl: (found as any).imageUrl,
        },
      ];
    });
  };

  const handleBarcodeAdd = (rawCode?: string) => {
    const originalCode = String(rawCode ?? barcodeInput ?? "").trim();
    const code = normalizeSkuSearch(originalCode);
    if (!code) return;

    const exactFound = allVariants.find((v) => {
      const sku = normalizeSkuSearch(v.sku || "");
      const id = normalizeSkuSearch((v as any).id || "");
      const barcode = normalizeSkuSearch((v as any).barcode || "");
      const barcodeValue = normalizeSkuSearch((v as any).barcodeValue || "");

      return (
        sku === code ||
        id === code ||
        barcode === code ||
        barcodeValue === code
      );
    });

    if (exactFound) {
      addVariantToOrder(exactFound.id);
      setBarcodeInput("");
      setProductSearch("");
      setError(null);
      return;
    }

    // Chỉ cho match gần đúng khi mã đủ dài và chỉ khớp duy nhất 1 variant.
    // Tránh trường hợp tít thiếu/kẹt ký tự rồi cộng nhầm sang SKU gần giống.
    const looseMatches = allVariants.filter((v) => {
      const sku = normalizeSkuSearch(v.sku || "");
      return code.length >= 6 && sku.includes(code);
    });

    if (looseMatches.length === 1) {
      addVariantToOrder(looseMatches[0].id);
      setBarcodeInput("");
      setProductSearch("");
      setError(null);
      return;
    }

    if (looseMatches.length > 1) {
      setError(`Mã ${originalCode} khớp nhiều sản phẩm, cần quét/nhập đủ SKU.`);
      return;
    }

    setError(`Không tìm thấy SKU / mã vạch: ${originalCode}`);
  };

  const updateLine = (variantId: string, patch: Partial<OrderLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.variantId !== variantId) return line;
        const next = { ...line, ...patch };
        if (next.qty < 1) next.qty = 1;
        // ✅ Cho phép bán âm, không tự ép số lượng về tồn kho.
        if (next.discount < 0) next.discount = 0;
        return next;
      }),
    );
  };

  const removeLine = (variantId: string) => {
    setLines((prev) => prev.filter((line) => line.variantId !== variantId));
  };

  const resetForm = () => {
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setShippingAddress("");
    setSalesChannel("FACEBOOK");
    setBranchId(branchOptions[0]?.value || "");
    setCustomerHint("");
    setCustomerPolicyLabel("");
    setCustomerDiscountPercent(0);
    setCustomerSuggestions([]);
    setCustomerSuggestionOpen(false);
    setCustomerAddresses([]);
    setSelectedAddressId(null);
    setAddressProvince(provinceOptions[0]?.name || "");
    setAddressDistrict("");
    setAddressWard("");
    setAddressLine1("");
    setAddressLine2("");
    setSmartAddressInput("");
    setSmartAddressHint("");
    setProductSearch("");
    setBarcodeInput("");
    setLines([]);
    setTags("");
    setNote("");
    setDiscountTotal("0");
    setShippingFee("30000");
    setCouponCode("");
    setCustomerPaid("0");
    setShippingMode("partner");
    setShippingPayer("shop");
    setShippingUiMode("carrier");
    setShippingPartner("ghn");
    setDeliveryRequirement("CHOXEMHANG_KHONGTHU");
    setGhnDistrictId(undefined);
    setGhnWardCode(undefined);
    setSelectedShippingServiceId(undefined);
    setSelectedShippingServiceTypeId(undefined);
    setSelectedShippingQuoteKey("");
    setShippingWeight(200);
    setShippingLength(10);
    setShippingWidth(10);
    setShippingHeight(10);
    setShippingHint("");
    setShippingError("");
    setShippingQuotes([]);
    setError(null);
    setSuccessMessage("");
  };

  const resetNewCustomerForm = () => {
    setNewCustomerError("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerRecipientName("");
    setNewCustomerProvince(provinceOptions[0]?.name || "");
    setNewCustomerDistrict("");
    setNewCustomerWard("");
    setNewCustomerPostalCode("");
    setNewCustomerAddressLine("");
    setNewCustomerAddressLine2("");
    setNewCustomerCode("");
    setNewCustomerTags("");
    setNewCustomerNote("");
    setNewCustomerSmartAddressInput("");
    setNewCustomerSmartAddressHint("");
  };

  const createNewCustomerAndApply = async () => {
    const recipientName = newCustomerRecipientName.trim();

    if (!recipientName) {
      setNewCustomerError("Chưa nhập người nhận.");
      return;
    }

    if (!newCustomerPhone.trim()) {
      setNewCustomerError("Chưa nhập số điện thoại.");
      return;
    }

    if (!newCustomerAddressLine.trim()) {
      setNewCustomerError("Chưa nhập địa chỉ cụ thể.");
      return;
    }

    if (!newCustomerProvince.trim()) {
      setNewCustomerError("Chưa chọn tỉnh / thành.");
      return;
    }

    if (!newCustomerDistrict.trim()) {
      setNewCustomerError("Chưa chọn quận / huyện.");
      return;
    }

    if (!newCustomerWard.trim()) {
      setNewCustomerError("Chưa chọn xã / phường.");
      return;
    }

    try {
      setNewCustomerSaving(true);
      setNewCustomerError("");

      const payload: any = {
        legacyCode: newCustomerCode.trim() || undefined,
        fullName: recipientName,
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim() || undefined,
        source: salesChannel,
        addressLine1: newCustomerAddressLine.trim() || undefined,
        addressLine2: newCustomerAddressLine2.trim() || undefined,
        ward: normalizeWardName(newCustomerWard),
        district: normalizeDistrictName(newCustomerDistrict),
        province: normalizeProvinceName(newCustomerProvince),
        postalCode: newCustomerPostalCode.trim() || undefined,
        recipientName,
        customerNote: newCustomerNote.trim() || undefined,
        label: "Địa chỉ giao hàng",
        isDefaultAddress: true,
      };

      const created: any = await createCustomer(payload);

      setCustomerId(created.id || null);
      setCustomerName(created.fullName || recipientName);
      setCustomerPhone(created.phone || newCustomerPhone.trim());

      if (created.id) {
        await loadCustomerAddressBook(created.id);
      }

      if (newCustomerTags.trim()) {
        setTags((prev) => {
          const current = prev.trim();
          return current
            ? `${current}${current.endsWith(",") ? " " : ", "}${newCustomerTags.trim()}`
            : newCustomerTags.trim();
        });
      }

      if (newCustomerNote.trim()) {
        setNote((prev) => {
          const current = prev.trim();
          return current
            ? `${current}\n${newCustomerNote.trim()}`
            : newCustomerNote.trim();
        });
      }

      setCustomerHint(`Đã tạo và áp dụng khách mới: ${created.fullName}`);
      setCustomerPolicyLabel(String(created.pricePolicyName || ""));
      setCustomerDiscountPercent(Number(created.defaultDiscountPercent || 0));
      setNewCustomerOpen(false);
      resetNewCustomerForm();
    } catch (err) {
      setNewCustomerError(
        err instanceof Error ? err.message : "Không tạo được khách hàng.",
      );
    } finally {
      setNewCustomerSaving(false);
    }
  };

  const saveAddress = async () => {
    if (!customerId) {
      setAddressError("Cần chọn khách hàng trước khi lưu địa chỉ.");
      return;
    }

    if (!addressRecipientName.trim()) {
      setAddressError("Chưa nhập người nhận.");
      return;
    }

    if (!addressPhone.trim()) {
      setAddressError("Chưa nhập số điện thoại.");
      return;
    }

    if (!addressLine1.trim()) {
      setAddressError("Chưa nhập địa chỉ cụ thể.");
      return;
    }

    if (!addressProvince.trim()) {
      setAddressError("Chưa chọn tỉnh / thành.");
      return;
    }

    if (!addressDistrict.trim()) {
      setAddressError("Chưa chọn quận / huyện.");
      return;
    }

    if (!addressWard.trim()) {
      setAddressError("Chưa chọn xã / phường.");
      return;
    }

    const payload: any = {
      label: addressLabel.trim() || "Địa chỉ",
      recipientName: addressRecipientName.trim(),
      phone: addressPhone.trim(),
      email: addressEmail.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      postalCode: addressPostalCode.trim() || undefined,
      isDefault: addressSaveAsDefault,
      province: normalizeProvinceName(addressProvince),
      district: normalizeDistrictName(addressDistrict),
      ward: normalizeWardName(addressWard),
    };

    try {
      setAddressSaving(true);
      setAddressError("");

      if (editingAddressId) {
        await updateCustomerAddress(customerId, editingAddressId, payload);
      } else {
        await createCustomerAddress(customerId, payload);
      }

      await loadCustomerAddressBook(customerId);
      setAddressEditorOpen(false);
      setAddressSelectorOpen(true);
    } catch (err) {
      setAddressError(
        err instanceof Error ? err.message : "Không lưu được địa chỉ.",
      );
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!customerId) return;

    try {
      const rows = await setDefaultCustomerAddress(customerId, addressId);
      setCustomerAddresses(rows);
      const next = rows.find((item) => item.id === addressId) || rows[0];
      if (next) {
        applySelectedAddress(next);
      }
    } catch (err) {
      setAddressError(
        err instanceof Error ? err.message : "Không đổi được địa chỉ mặc định.",
      );
    }
  };

  const openAddressSelector = async () => {
    if (!customerId) {
      setCustomerHint("Chọn khách hàng trước.");
      return;
    }

    try {
      await loadCustomerAddressBook(customerId);
      setAddressSelectorOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được địa chỉ.");
    }
  };

  const openCreateAddressModal = () => {
    resetAddressForm();
    setAddressSelectorOpen(false);
    setAddressEditorOpen(true);
  };

  const openEditAddressModal = (address: CustomerAddressItem) => {
    setAddressError("");
    setEditingAddressId(address.id);
    setAddressLabel(address.label || "Địa chỉ");
    setAddressRecipientName(address.recipientName || customerName || "");
    setAddressPhone(address.phone || customerPhone || "");
    setAddressEmail((address as any).email || "");
    setAddressProvince(address.province || provinceOptions[0]?.name || "");
    setAddressDistrict((address as any).district || "");
    setAddressWard(address.ward || "");
    setAddressPostalCode(address.postalCode || "");
    setAddressLine1(address.addressLine1 || "");
    setAddressLine2(address.addressLine2 || "");
    setAddressSaveAsDefault(Boolean(address.isDefault));
    setSmartAddressInput(formatAddress(address));
    setAddressSelectorOpen(false);
    setAddressEditorOpen(true);
  };

  useEffect(() => {
    shippingStateRef.current = {
      shippingUiMode,
      shippingMode,
      shippingPartner,
    };
  }, [shippingUiMode, shippingMode, shippingPartner]);

  useEffect(() => {
    applyShippingRef.current = (payload: ShippingQuoteApplyPayload) => {
      setShippingFee((prev) => {
        if (payload.shippingMode === "pickup") return "0";

        // ✅ Giữ nguyên phí ship nhân viên nhập tay.
        // Nếu nhân viên nhập free ship = 0 thì không được tự cộng lại 30.000.
        // Báo giá GHN/AhaMove/ViettelPost chỉ dùng để tham khảo chi phí đối tác.
        const current = String(prev ?? "").trim();
        return current === "" ? "30000" : current;
      });
      setShippingMode(payload.shippingMode === "pickup" ? "pickup" : "partner");
      setShippingPartner(payload.shippingPartner || "ghn");
      setSelectedShippingServiceId(payload.selectedServiceId);
      setSelectedShippingServiceTypeId(payload.selectedServiceTypeId);
      setSelectedShippingQuoteKey(payload.selectedQuoteKey || "");
      setShippingWeight(payload.weight);
      setShippingLength(payload.length);
      setShippingWidth(payload.width);
      setShippingHeight(payload.height);
      setGhnDistrictId(payload.ghnDistrictId);
      setGhnWardCode(payload.ghnWardCode);
    };
  }, []);

  useEffect(() => {
    if (
      shippingUiMode === "carrier" &&
      (shippingPartner === "ghn" || shippingPartner === "ahamove")
    ) {
      // ✅ Chỉ set mặc định khi ô phí ship đang trống.
      // Không ép 0 thành 30.000 vì 0 là free ship do nhân viên nhập.
      setShippingFee((prev) => {
        const current = String(prev ?? "").trim();
        return current === "" ? "30000" : current;
      });
    }
  }, [shippingUiMode, shippingPartner]);

  useEffect(() => {
    const isPickupShipping =
      shippingUiMode === "pickup" ||
      shippingMode === "pickup" ||
      shippingPartner === "pickup";

    if (isPickupShipping) {
      setShippingFee("0");
      setShippingHint("Khách nhận tại cửa hàng nên không tính phí ship.");
      setShippingError("");
      setShippingLoading(false);
      setShippingQuotes([]);
      setSelectedShippingServiceId(undefined);
      setSelectedShippingServiceTypeId(undefined);
      setSelectedShippingQuoteKey("");
      setGhnDistrictId(undefined);
      setGhnWardCode(undefined);
      setShippingMode("pickup");
      setShippingPartner("pickup");
      setError((prev) => {
        if (!prev) return prev;
        const text = prev.toLowerCase();
        return text.includes("ghn") ||
          text.includes("giao hàng") ||
          text.includes("địa chỉ")
          ? null
          : prev;
      });
      return;
    }

    if (shippingUiMode === "external") {
      setShippingHint(
        "Đang dùng vận chuyển ngoài. Có thể nhập phí ship tay nếu cần.",
      );
      setShippingError("");
      setShippingQuotes([]);
      setSelectedShippingServiceId(undefined);
      setSelectedShippingServiceTypeId(undefined);
      setSelectedShippingQuoteKey("");
      setShippingPartner("outside");
      setShippingMode("partner");
      return;
    }

    if (shippingUiMode === "schedule") {
      setShippingHint("Đơn giao hàng sau. Có thể quote lại khi chốt gửi hãng.");
      setShippingError("");
      setShippingQuotes([]);
      setSelectedShippingServiceId(undefined);
      setSelectedShippingServiceTypeId(undefined);
      setSelectedShippingQuoteKey("");
      return;
    }

    if (shippingUiMode !== "carrier") {
      setShippingQuotes([]);
      setSelectedShippingQuoteKey("");
      shippingQuoteStableKeyRef.current = "";
      return;
    }

    if (shippingQuoteStableKeyRef.current === shippingQuoteStableKey) {
      return;
    }

    const run = async () => {
      const requestSeq = ++shippingQuoteRequestSeqRef.current;
      shippingQuoteStableKeyRef.current = shippingQuoteStableKey;
      const toAddress =
        carrierToAddress ||
        selectedAddress?.addressLine1 ||
        addressLine1.trim() ||
        shippingAddress.trim();

      const errors: string[] = [];
      const resultQuotes: ShipmentQuoteResult[] = [];

      try {
        setShippingLoading((prev) => (shippingQuotes.length ? prev : true));
        setShippingError("");

        let resolved: any = null;

        if (quoteProvince && quoteDistrict && quoteWard) {
          try {
            resolved = await resolveGhnAddress({
              province: quoteProvince,
              district: quoteDistrict,
              ward: quoteWard,
            });

            if (!resolved?.districtId || !resolved?.wardCode) {
              throw new Error("Không map được địa chỉ GHN.");
            }

            const ghnRows = await quoteShipment({
              toDistrictId: Number(resolved.districtId),
              toWardCode: String(resolved.wardCode),
              insuranceValue: orderValueForInsurance,
              length: Number(shippingLength || 10),
              width: Number(shippingWidth || 10),
              height: Number(shippingHeight || 10),
              weight: Number(shippingWeight || 200),
              items: quoteItems,
              fromDistrictId: selectedCarrierPickup?.ghnFromDistrictId,
              fromWardCode: selectedCarrierPickup?.ghnFromWardCode,
              fromName: selectedCarrierPickup?.name,
              fromPhone: selectedCarrierPickup?.phone,
              fromAddress: selectedCarrierPickup?.address,
            });

            const mappedGhn = (Array.isArray(ghnRows) ? ghnRows : []).map(
              (row) => ({
                ...(row as any),
                _carrier: "ghn",
                _quoteKey: `ghn-${row.serviceId || 0}-${row.serviceTypeId || 0}`,
                _serviceName:
                  (row as any).shortName ||
                  (row as any).serviceName ||
                  `GHN ${row.serviceId}`,
                _leadtimeLabel: getQuoteLeadtimeLabel(row),
                _ghnDistrictId: Number(resolved.districtId),
                _ghnWardCode: String(resolved.wardCode),
                _applyFeeToInput: true,
              }),
            ) as ShipmentQuoteResult[];

            resultQuotes.push(...mappedGhn);
            setGhnDistrictId(Number(resolved.districtId));
            setGhnWardCode(String(resolved.wardCode));
          } catch (err) {
            errors.push(
              err instanceof Error
                ? `GHN: ${err.message}`
                : "GHN: Không lấy được báo giá.",
            );
          }
        } else {
          errors.push("GHN: Thiếu tỉnh/thành, quận/huyện hoặc xã/phường.");
        }

        if (toAddress) {
          try {
            const rawAhamoveQuote = await quoteAhamoveShipment({
              fromName: selectedCarrierPickup?.name,
              fromPhone: selectedCarrierPickup?.phone,
              fromAddress: selectedCarrierPickup?.address,
              toName:
                selectedAddress?.recipientName ||
                customerName.trim() ||
                "Khách hàng",
              toPhone: selectedAddress?.phone || customerPhone.trim(),
              toAddress,
              codAmount: remaining > 0 ? remaining : 0,
              services:
                "HAN-BIKE,HAN-2H,HAN-TRUCK-1000,HAN-TRUCK-2000,HAN-TRUCK-5000",
              serviceId: "HAN-BIKE",
              payment_method: ahamovePaymentMethod,
              paymentMethod: ahamovePaymentMethod,
              weight: Number(shippingWeight || 200),
              length: Number(shippingLength || 10),
              width: Number(shippingWidth || 10),
              height: Number(shippingHeight || 10),
              note: note.trim() || "",
              items: quoteItems.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                num: item.quantity,
                price: 0,
                weight: item.weight,
              })),
            });

            const ahamoveRows = normalizeAhamoveQuoteItems(rawAhamoveQuote)
              .map((item: any) => parseAhamoveQuoteFee(item))
              .filter((parsed: any) =>
                shouldShowAhamoveService(
                  parsed.serviceLabel,
                  Number(shippingWeight || 200),
                ),
              );

            for (const parsed of ahamoveRows) {
              const ahamoveQuote: ShipmentQuoteResult = {
                serviceId: 0,
                serviceTypeId: 0,
                shortName: getAhamoveServiceDisplayName(parsed.serviceLabel),
                fee: {
                  total: parsed.quoteFee,
                  total_fee: parsed.quoteFee,
                  service_fee: parsed.quoteFee,
                },
                leadtime: {
                  label:
                    parsed.distanceKm || parsed.durationMinutes
                      ? `${parsed.distanceKm ? `${parsed.distanceKm}km` : ""}${
                          parsed.distanceKm && parsed.durationMinutes
                            ? " · "
                            : ""
                        }${parsed.durationMinutes ? `${parsed.durationMinutes} phút` : ""}`
                      : "Nội thành",
                },
                ...({
                  _carrier: "ahamove",
                  _quoteKey: `ahamove-${parsed.serviceLabel}`,
                  _serviceName: parsed.serviceLabel,
                  _durationMinutes: parsed.durationMinutes,
                  _distanceKm: parsed.distanceKm,
                  _raw: parsed.raw,
                  _disabled: Boolean((parsed.raw as any)?._disabled),
                  _disabledReason: (parsed.raw as any)?._disabledReason || "",
                  _applyFeeToInput: parsed.quoteFee > 0 && !Boolean((parsed.raw as any)?._disabled),
                } as any),
              };

              resultQuotes.push(ahamoveQuote);
            }
          } catch (err) {
            errors.push(
              err instanceof Error
                ? `AhaMove: ${err.message}`
                : "AhaMove: Không lấy được báo giá.",
            );
          }
        } else {
          errors.push("AhaMove: Thiếu địa chỉ giao hàng.");
        }

        if (quoteProvince && quoteDistrict) {
          try {
            const viettelRows = await quoteViettelPostShipment({
              toName:
                selectedAddress?.recipientName ||
                customerName.trim() ||
                "Khách hàng",
              toPhone: selectedAddress?.phone || customerPhone.trim(),
              toAddress,
              services: "VHT,VTK,VCN",
              senderGroupAddressId:
                selectedCarrierPickup?.viettelGroupAddressId ||
                selectedCarrierPickup?.groupAddressId ||
                selectedViettelInventory?.groupAddressId,
              senderProvinceId:
                selectedCarrierPickup?.viettelProvinceId ||
                selectedViettelInventory?.provinceId,
              senderDistrictId:
                selectedCarrierPickup?.viettelDistrictId ||
                selectedViettelInventory?.districtId,
              senderWardId:
                selectedCarrierPickup?.viettelWardId ||
                selectedViettelInventory?.wardId,
              fromName: selectedCarrierPickup?.name || selectedViettelInventory?.name,
              fromPhone: selectedCarrierPickup?.phone || selectedViettelInventory?.phone,
              fromAddress: selectedCarrierPickup?.address || selectedViettelInventory?.address,
              province: viettelOldCarrierAddress.province,
              district: viettelOldCarrierAddress.district,
              ward: viettelOldCarrierAddress.ward,
              toProvince: viettelOldCarrierAddress.province,
              toDistrict: viettelOldCarrierAddress.district,
              toWard: viettelOldCarrierAddress.ward,
              codAmount: remaining > 0 ? remaining : 0,
              productPrice: orderValueForInsurance,
              insuranceValue: orderValueForInsurance,
              weight: Number(shippingWeight || 200),
              length: Number(shippingLength || 10),
              width: Number(shippingWidth || 10),
              height: Number(shippingHeight || 10),
            });

            const mappedViettel = (
              Array.isArray(viettelRows) ? viettelRows : []
            ).map(
              (row: any, index: number) =>
                ({
                  ...row,
                  _carrier: "viettelpost",
                  _quoteKey:
                    row._quoteKey ||
                    `viettelpost-${row._viettelServiceCode || row.shortName || index}`,
                  _serviceName:
                    row._serviceName ||
                    row.shortName ||
                    row.serviceName ||
                    row._viettelServiceCode ||
                    "Viettel Post",
                  _applyFeeToInput: !(row as any)?._disabled,
                }) as ShipmentQuoteResult,
            );

            resultQuotes.push(...mappedViettel);
          } catch (err) {
            errors.push(
              err instanceof Error
                ? `ViettelPost: ${err.message}`
                : "ViettelPost: Không lấy được báo giá.",
            );
          }
        } else {
          errors.push("ViettelPost: Thiếu tỉnh/thành hoặc quận/huyện.");
        }

        const sortedQuotes = withQuoteBadges(resultQuotes).sort((a, b) => {
          const carrierA = getQuoteCarrier(a);
          const carrierB = getQuoteCarrier(b);
          if (carrierA !== carrierB) {
            const order = ["ghn", "viettelpost", "ahamove"];
            return order.indexOf(carrierA) - order.indexOf(carrierB);
          }
          return getFeeNumber(a) - getFeeNumber(b);
        });

        if (requestSeq !== shippingQuoteRequestSeqRef.current) return;

        setShippingQuotes(sortedQuotes);

        if (!sortedQuotes.length) {
          setShippingHint("");
          setShippingError(
            errors.join(" | ") || "Không lấy được phí vận chuyển.",
          );
          setSelectedShippingServiceId(undefined);
          setSelectedShippingServiceTypeId(undefined);
          return;
        }

        const currentCarrierQuotes = sortedQuotes.filter(
          (row) => getQuoteCarrier(row) === shippingPartner,
        );
        const recommended =
          sortedQuotes.find((row) =>
            getQuoteBadges(row).includes("Khuyên dùng"),
          ) || sortedQuotes[0];
        const selected =
          currentCarrierQuotes[0] || recommended || sortedQuotes[0];

        applyShippingRef.current?.({
          shippingFee: getFeeNumber(selected),
          applyFeeToInput: Boolean((selected as any)._applyFeeToInput),
          shippingPartner: getQuoteCarrier(selected),
          shippingMode: "partner",
          selectedServiceId: selected.serviceId,
          selectedServiceTypeId: selected.serviceTypeId,
          selectedQuoteKey: getQuoteKey(selected),
          weight: Number(shippingWeight || 200),
          length: Number(shippingLength || 10),
          width: Number(shippingWidth || 10),
          height: Number(shippingHeight || 10),
          ghnDistrictId:
            (selected as any)._ghnDistrictId || resolved?.districtId,
          ghnWardCode: (selected as any)._ghnWardCode || resolved?.wardCode,
        });

        setShippingHint(
          `Đã so sánh ${sortedQuotes.length} gói vận chuyển. Đang chọn ${getQuoteDisplayName(selected)}. Phí đối tác: ${currency(getFeeNumber(selected))} | Khách đang trả: ${currency(parseNumber(shippingFee))}.`,
        );
        setShippingError(errors.length ? errors.join(" | ") : "");
      } catch (err) {
        if (requestSeq !== shippingQuoteRequestSeqRef.current) return;
        shippingQuoteStableKeyRef.current = "";
        setShippingQuotes([]);
        setSelectedShippingServiceId(undefined);
        setSelectedShippingServiceTypeId(undefined);
        setSelectedShippingQuoteKey("");
        setShippingHint("");
        setShippingError(
          err instanceof Error ? err.message : "Không lấy được phí ship.",
        );
      } finally {
        if (requestSeq === shippingQuoteRequestSeqRef.current) {
          setShippingLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 700);

    return () => clearTimeout(timer);
  }, [shippingQuoteStableKey]);

  const canCreateOrder = hasCurrentUserPermission("orders.create");
  const canApproveOrder = hasCurrentUserPermission("orders.approve");
  const canPackShipOrder = hasCurrentUserPermission("orders.pack_ship");

  const canCreateDraftOrder = canCreateOrder;
  const canCreateApproveOrder = canCreateOrder && canApproveOrder;
  const canCreateShipOrder = canCreateOrder && canPackShipOrder;

  function getCreateModePermissionError(mode: CreateOrderMode) {
    if (!canCreateOrder) return "Bạn không có quyền tạo đơn hàng.";
    if (mode === "approve" && !canApproveOrder)
      return "Bạn không có quyền tạo và duyệt đơn.";
    if (mode === "ship" && !canPackShipOrder)
      return "Bạn không có quyền tạo và xuất kho đơn.";
    return "";
  }

  const handleSubmit = async (mode: CreateOrderMode) => {
    if (saving) return;

    const currentUser = getCurrentUserFromStorage();
    const permissionError = getCreateModePermissionError(mode);

    if (permissionError) {
      setError(permissionError);
      return;
    }

    if (!isOwnerUser(currentUser) && !userBranchIds.includes(branchId)) {
      setError("Không thể tạo đơn ngoài chi nhánh được gán.");
      return;
    }

    if (!customerName.trim()) {
      setError("Chưa nhập tên khách.");
      return;
    }

    if (!customerPhone.trim()) {
      setError("Chưa nhập số điện thoại.");
      return;
    }

    if (!lines.length) {
      setError("Chưa có sản phẩm nào trong đơn.");
      return;
    }

    const invalidLine = lines.find((line) => line.qty < 1);
    if (invalidLine) {
      setError(`Số lượng không hợp lệ cho ${invalidLine.sku}.`);
      return;
    }

    const nextStockWarnings = lines
      .map((line) => buildStockWarning(line, Number(line.qty || 1)))
      .filter(Boolean);
    setStockWarningMessage(nextStockWarnings[0] || "");

    const isPickupOrder =
      shippingUiMode === "pickup" ||
      shippingMode === "pickup" ||
      shippingPartner === "pickup";
    const finalCreateMode: CreateOrderMode =
      isPickupOrder && mode !== "draft" ? "ship" : mode;

    let submitGhnDistrictId = ghnDistrictId;
    let submitGhnWardCode = ghnWardCode;

    if (
      !isPickupOrder &&
      mode === "ship" &&
      shippingUiMode === "carrier" &&
      (shippingPartner === "ghn" || shippingPartner === "ahamove")
    ) {
      if (!shippingAddress.trim()) {
        setError("Thiếu địa chỉ giao hàng.");
        return;
      }

      if (
        shippingPartner === "ghn" &&
        (!submitGhnDistrictId || !submitGhnWardCode)
      ) {
        if (!quoteProvince || !quoteDistrict || !quoteWard) {
          setError("Địa chỉ chưa map được GHN.");
          return;
        }

        try {
          setSaving(true);
          setError(null);
          setShippingError("");
          setShippingHint("Đang map lại địa chỉ GHN trước khi tạo đơn...");

          const resolved = await resolveGhnAddress({
            province: quoteProvince,
            district: quoteDistrict,
            ward: quoteWard,
          });

          if (!resolved?.districtId || !resolved?.wardCode) {
            setError("Địa chỉ chưa map được GHN.");
            setSaving(false);
            return;
          }

          submitGhnDistrictId = Number(resolved.districtId);
          submitGhnWardCode = String(resolved.wardCode);
          setGhnDistrictId(submitGhnDistrictId);
          setGhnWardCode(submitGhnWardCode);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Địa chỉ chưa map được GHN.",
          );
          setSaving(false);
          return;
        }
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage("");

      const effectivePaymentSourceId =
        paymentSourceId ||
        (isPickupOrder ? String(visiblePaymentSources[0]?.id || "") : "");
      const effectivePaidAmount = isPickupOrder
        ? customerMustPay
        : parseNumber(customerPaid);

      const customerFacingShippingNote = buildCustomerFacingShippingNote({
        orderNote: note,
        deliveryRequirement,
      });

      const extraNoteParts = [
        customerFacingShippingNote
          ? `Ghi chú giao hàng: ${customerFacingShippingNote}`
          : "",
        note.trim() ? `Ghi chú đơn hàng: ${note.trim()}` : "",
        shippingAddress.trim() ? `Địa chỉ: ${shippingAddress.trim()}` : "",
        tags.trim() ? `Ghi chú nội bộ: ${tags.trim()}` : "",
        couponCode.trim() ? `Mã giảm giá: ${couponCode.trim()}` : "",
        customerId ? `CustomerId: ${customerId}` : "",
        selectedAddressId ? `CustomerAddressId: ${selectedAddressId}` : "",
        customerPolicyLabel ? `Policy: ${customerPolicyLabel}` : "",
        customerDiscountPercent
          ? `Chiết khấu mặc định: ${customerDiscountPercent}%`
          : "",
        `Giảm giá tay: ${manualDiscount}`,
        `Giảm giá dòng: ${lineDiscountTotal}`,
        autoPromotionDiscount
          ? `Khuyến mại tự động: ${autoPromotionDiscount}`
          : "",
        `Phí ship: ${fee}`,
        `Khách đã trả: ${effectivePaidAmount}`,
        `Còn phải trả: ${remaining}`,
        `Kiểu vận chuyển UI: ${shippingUiMode}`,
        `Cách giao: ${shippingMode}`,
        `Đơn vị giao: ${shippingPartner}`,
        isPickupOrder ? "Nhận tại cửa hàng: true" : "",
        `Người trả ship: ${shippingPayer}`,
        `Yêu cầu giao hàng: ${requiredNoteLabel(deliveryRequirement)}`,
        selectedShippingServiceId
          ? `GHN ServiceId: ${selectedShippingServiceId}`
          : "",
        selectedShippingServiceTypeId
          ? `GHN ServiceTypeId: ${selectedShippingServiceTypeId}`
          : "",
        `Khối lượng: ${shippingWeight}g`,
        `Kích thước: ${shippingLength}x${shippingWidth}x${shippingHeight}`,
        submitGhnDistrictId ? `GHN DistrictId: ${submitGhnDistrictId}` : "",
        submitGhnWardCode ? `GHN WardCode: ${submitGhnWardCode}` : "",
      ].filter(Boolean);

      const shouldCreateCarrierShipmentManually =
        !isPickupOrder &&
        finalCreateMode === "ship" &&
        shippingUiMode === "carrier";

      const payload = {
        ...(customerId ? ({ customerId } as any) : {}),
        salesChannel: (isPickupOrder ? "POS" : salesChannel) as any,
        branchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        note: extraNoteParts.join(" | "),
        mode: finalCreateMode,
        skipAutoShipment: shouldCreateCarrierShipmentManually,

        // Pickup phải được gửi rõ xuống backend để backend set COMPLETED + FULFILLED như POS.
        deliveryMethod: isPickupOrder ? "PICKUP" : "DELIVERY",
        shippingMethod: isPickupOrder ? "PICKUP" : shippingPartner,
        fulfillmentType: isPickupOrder ? "PICKUP" : "DELIVERY",

        items: lines.map((line) => ({
          variantId: line.variantId,
          qty: Number(line.qty),
        })),

        ...(effectivePaymentSourceId
          ? { paymentSourceId: effectivePaymentSourceId }
          : {}),
        paidAmount: effectivePaidAmount,
        paymentNote: note,
        discountAmount: manualDiscount + lineDiscountTotal,
        shippingFee: isPickupOrder ? 0 : Number(fee || 0),
        shipFee: isPickupOrder ? 0 : Number(fee || 0),
        deliveryFee: isPickupOrder ? 0 : Number(fee || 0),
        finalAmount: customerMustPay,

        // Lưu yêu cầu giao hàng ở cả tầng Order để trang chi tiết / mẫu in đọc được,
        // kể cả đơn chưa đẩy hãng vận chuyển.
        shippingNote: isPickupOrder ? undefined : customerFacingShippingNote,
        deliveryRequirement: isPickupOrder ? undefined : deliveryRequirement,
        requiredNote: isPickupOrder
          ? undefined
          : mapRequiredNoteForGhn(deliveryRequirement),
        required_note: isPickupOrder
          ? undefined
          : mapRequiredNoteForGhn(deliveryRequirement),
        requiredNoteLabel: isPickupOrder
          ? undefined
          : requiredNoteLabel(deliveryRequirement),

        shippingSnapshot: {
          skipAutoShipment: shouldCreateCarrierShipmentManually,
          shippingFee: isPickupOrder ? 0 : Number(fee || 0),
          shipFee: isPickupOrder ? 0 : Number(fee || 0),
          fee: isPickupOrder ? 0 : Number(fee || 0),
          shippingAddressId: isPickupOrder
            ? undefined
            : selectedAddress?.id || undefined,
          shippingRecipientName:
            selectedAddress?.recipientName || customerName.trim(),
          shippingPhone: selectedAddress?.phone || customerPhone.trim(),
          shippingAddressLine1: isPickupOrder
            ? "Khách nhận tại cửa hàng"
            : selectedAddress?.addressLine1 ||
              addressLine1.trim() ||
              shippingAddress.trim() ||
              undefined,
          shippingAddressLine2: isPickupOrder
            ? undefined
            : selectedAddress?.addressLine2 || addressLine2.trim() || undefined,
          shippingWard: isPickupOrder ? undefined : quoteWard || undefined,
          shippingDistrict: isPickupOrder
            ? undefined
            : quoteDistrict || undefined,
          shippingProvince: isPickupOrder
            ? undefined
            : quoteProvince || undefined,
          shippingPostalCode: isPickupOrder
            ? undefined
            : selectedAddress?.postalCode || addressPostalCode || undefined,
          shippingGhnDistrictId: isPickupOrder
            ? undefined
            : (submitGhnDistrictId ?? undefined),
          shippingGhnWardCode: isPickupOrder
            ? undefined
            : submitGhnWardCode || undefined,
          ghnDistrictId: isPickupOrder
            ? undefined
            : (submitGhnDistrictId ?? undefined),
          ghnWardCode: isPickupOrder
            ? undefined
            : submitGhnWardCode || undefined,
          shippingPartner: isPickupOrder ? "pickup" : shippingPartner,
          shippingPayer,
          note: isPickupOrder ? undefined : customerFacingShippingNote,
          shippingNote: isPickupOrder ? undefined : customerFacingShippingNote,
          deliveryRequirement: isPickupOrder ? undefined : deliveryRequirement,
          requiredNote: isPickupOrder
            ? undefined
            : mapRequiredNoteForGhn(deliveryRequirement),
          required_note: isPickupOrder
            ? undefined
            : mapRequiredNoteForGhn(deliveryRequirement),
          requiredNoteLabel: isPickupOrder
            ? undefined
            : requiredNoteLabel(deliveryRequirement),
          selectedServiceId: isPickupOrder
            ? undefined
            : selectedShippingServiceId,
          selectedServiceTypeId: isPickupOrder
            ? undefined
            : selectedShippingServiceTypeId,
          shippingQuoteKey: isPickupOrder
            ? undefined
            : selectedQuote
              ? getQuoteKey(selectedQuote)
              : undefined,
          carrier: isPickupOrder ? "pickup" : shippingPartner,
          pickupLocationId: isPickupOrder ? undefined : selectedCarrierPickup?.id,
          pickupLocationName: isPickupOrder ? undefined : selectedCarrierPickup?.name,
          pickupLocationPhone: isPickupOrder ? undefined : selectedCarrierPickup?.phone,
          pickupLocationAddress: isPickupOrder ? undefined : selectedCarrierPickup?.address,
          viettelServiceCode:
            !isPickupOrder && shippingPartner === "viettelpost"
              ? (selectedQuote as any)?._viettelServiceCode ||
                (selectedQuote as any)?._serviceName ||
                undefined
              : undefined,
          viettelSenderGroupAddressId:
            !isPickupOrder && shippingPartner === "viettelpost"
              ? (selectedQuote as any)?._viettelSenderGroupAddressId ||
                selectedViettelInventory?.groupAddressId ||
                undefined
              : undefined,
          viettelReceiverProvinceId:
            !isPickupOrder && shippingPartner === "viettelpost"
              ? (selectedQuote as any)?._viettelReceiverProvinceId || undefined
              : undefined,
          viettelReceiverDistrictId:
            !isPickupOrder && shippingPartner === "viettelpost"
              ? (selectedQuote as any)?._viettelReceiverDistrictId || undefined
              : undefined,
          viettelReceiverWardId:
            !isPickupOrder && shippingPartner === "viettelpost"
              ? (selectedQuote as any)?._viettelReceiverWardId || undefined
              : undefined,
          weight: shippingWeight,
          length: shippingLength,
          width: shippingWidth,
          height: shippingHeight,
        },
      } as CreateOrderPayload & Record<string, any>;

      const created = await createOrder(payload);

      let carrierTrackingCode = "";

      if (
        !isPickupOrder &&
        finalCreateMode === "ship" &&
        shippingUiMode === "carrier" &&
        shippingPartner === "ghn"
      ) {
        const ghnCreated = await createGhnShipment(created.id, {
          toName: selectedAddress?.recipientName || customerName.trim(),
          toPhone: selectedAddress?.phone || customerPhone.trim(),
          toAddress:
            selectedAddress?.addressLine1 ||
            addressLine1.trim() ||
            shippingAddress.trim(),
          toDistrictId: Number(submitGhnDistrictId),
          toWardCode: String(submitGhnWardCode),
          codAmount: remaining > 0 ? remaining : 0,
          insuranceValue: customerMustPay,
          note: customerFacingShippingNote,
          deliveryRequirement,
          requiredNote: mapRequiredNoteForGhn(deliveryRequirement),
          required_note: mapRequiredNoteForGhn(deliveryRequirement),
          requiredNoteLabel: requiredNoteLabel(deliveryRequirement),
          clientOrderCode: created.orderCode,
          content: `Đơn hàng ${created.orderCode}`,
          weight: shippingWeight,
          length: shippingLength,
          width: shippingWidth,
          height: shippingHeight,
          fromDistrictId: selectedCarrierPickup?.ghnFromDistrictId,
          fromWardCode: selectedCarrierPickup?.ghnFromWardCode,
          fromName: selectedCarrierPickup?.name,
          fromPhone: selectedCarrierPickup?.phone,
          fromAddress: selectedCarrierPickup?.address,
          items: lines.map((line) => ({
            name: line.productName || line.sku || "Sản phẩm",
            quantity: Number(line.qty || 0),
            price: Number(line.price || 0),
            length: Number(shippingLength || 10),
            width: Number(shippingWidth || 10),
            height: Number(shippingHeight || 10),
            weight: Math.max(
              1,
              Math.floor(
                Number(shippingWeight || 200) / Math.max(lines.length, 1),
              ),
            ),
            category: "Hàng hóa",
          })),
        });

        carrierTrackingCode =
          ghnCreated?.shipment?.trackingCode ||
          ghnCreated?.trackingCode ||
          ghnCreated?.ghn?.order_code ||
          ghnCreated?.ghn?.order_code_return ||
          "";
      }

      if (
        !isPickupOrder &&
        finalCreateMode === "ship" &&
        shippingUiMode === "carrier" &&
        shippingPartner === "ahamove"
      ) {
        const toAddress =
          selectedAddress?.addressLine1 ||
          addressLine1.trim() ||
          shippingAddress.trim();

        const ahamoveCreated = await createAhamoveShipment(created.id, {
          fromName: selectedCarrierPickup?.name,
          fromPhone: selectedCarrierPickup?.phone,
          fromAddress: selectedCarrierPickup?.address,
          toName: selectedAddress?.recipientName || customerName.trim(),
          toPhone: selectedAddress?.phone || customerPhone.trim(),
          toAddress,
          codAmount: remaining > 0 ? remaining : 0,
          serviceId:
            (
              shippingQuotes.find(
                (quote) =>
                  getQuoteCarrier(quote) === "ahamove" &&
                  quote.serviceId === selectedShippingServiceId &&
                  quote.serviceTypeId === selectedShippingServiceTypeId,
              ) as any
            )?._serviceName || "HAN-BIKE",
          payment_method: ahamovePaymentMethod,
          clientOrderCode: created.orderCode,
          orderCode: created.orderCode,
          note: customerFacingShippingNote,
          deliveryRequirement,
          requiredNote: mapRequiredNoteForGhn(deliveryRequirement),
          required_note: mapRequiredNoteForGhn(deliveryRequirement),
          requiredNoteLabel: requiredNoteLabel(deliveryRequirement),
          items: lines.map((line) => ({
            name: line.productName || line.sku || "Sản phẩm",
            quantity: Number(line.qty || 0),
            num: Number(line.qty || 0),
            price: Number(line.price || 0),
            weight: Math.max(
              1,
              Math.floor(
                Number(shippingWeight || 200) / Math.max(lines.length, 1),
              ),
            ),
          })),
        });

        carrierTrackingCode =
          ahamoveCreated?.shipment?.trackingCode ||
          ahamoveCreated?.trackingCode ||
          ahamoveCreated?.ahamoveOrderId ||
          ahamoveCreated?.order_id ||
          ahamoveCreated?.id ||
          "";
      }

      if (
        !isPickupOrder &&
        finalCreateMode === "ship" &&
        shippingUiMode === "carrier" &&
        shippingPartner === "viettelpost"
      ) {
        const toAddress =
          selectedAddress?.addressLine1 ||
          addressLine1.trim() ||
          shippingAddress.trim();

        const selectedViettelQuote = shippingQuotes.find(
          (quote) =>
            getQuoteCarrier(quote) === "viettelpost" &&
            !(quote as any)?._disabled &&
            quote.serviceId === selectedShippingServiceId &&
            quote.serviceTypeId === selectedShippingServiceTypeId,
        );

        const viettelCreated = await createViettelPostShipment(created.id, {
          toName: selectedAddress?.recipientName || customerName.trim(),
          toPhone: selectedAddress?.phone || customerPhone.trim(),
          toAddress,
          senderGroupAddressId:
            selectedCarrierPickup?.viettelGroupAddressId ||
            selectedCarrierPickup?.groupAddressId ||
            selectedViettelInventory?.groupAddressId,
          senderProvinceId:
            selectedCarrierPickup?.viettelProvinceId ||
            selectedViettelInventory?.provinceId,
          senderDistrictId:
            selectedCarrierPickup?.viettelDistrictId ||
            selectedViettelInventory?.districtId,
          senderWardId:
            selectedCarrierPickup?.viettelWardId ||
            selectedViettelInventory?.wardId,
          fromName: selectedCarrierPickup?.name || selectedViettelInventory?.name,
          fromPhone: selectedCarrierPickup?.phone || selectedViettelInventory?.phone,
          fromAddress: selectedCarrierPickup?.address || selectedViettelInventory?.address,
          toProvince: quoteProvince,
          toDistrict: quoteDistrict,
          toWard: quoteWard,
          province: quoteProvince,
          district: quoteDistrict,
          ward: quoteWard,
          codAmount: remaining > 0 ? remaining : 0,
          insuranceValue: customerMustPay,
          productPrice: customerMustPay,
          serviceCode:
            (selectedViettelQuote as any)?._viettelServiceCode ||
            (selectedViettelQuote as any)?._serviceName ||
            "VCN",
          clientOrderCode: created.orderCode,
          orderCode: created.orderCode,
          content: `Đơn hàng ${created.orderCode}`,
          note: customerFacingShippingNote,
          shippingNote: customerFacingShippingNote,
          deliveryRequirement,
          requiredNote: mapRequiredNoteForGhn(deliveryRequirement),
          required_note: mapRequiredNoteForGhn(deliveryRequirement),
          requiredNoteLabel: requiredNoteLabel(deliveryRequirement),
          weight: shippingWeight,
          length: shippingLength,
          width: shippingWidth,
          height: shippingHeight,
          items: lines.map((line) => ({
            name: line.productName || line.sku || "Sản phẩm",
            quantity: Number(line.qty || 0),
            price: Number(line.price || 0),
            weight: Math.max(
              1,
              Math.floor(
                Number(shippingWeight || 200) / Math.max(lines.length, 1),
              ),
            ),
          })),
        });

        carrierTrackingCode =
          viettelCreated?.shipment?.trackingCode ||
          viettelCreated?.trackingCode ||
          viettelCreated?.viettelpost?.ORDER_NUMBER ||
          viettelCreated?.viettelpost?.order_number ||
          viettelCreated?.viettelpost?.data?.ORDER_NUMBER ||
          "";
      }

      setModePickerOpen(false);

      const nextSearch = new URLSearchParams({
        created: "1",
      });

      if (carrierTrackingCode) {
        nextSearch.set("tracking", carrierTrackingCode);
      }

      router.push(
        `/orders/${encodeURIComponent(created.id)}?${nextSearch.toString()}`,
      );
      return;
    } catch (err: any) {
      setError(err?.message || "Tạo đơn thất bại.");
      setSaving(false);
    }
  };

  const compactCustomerSummary = [
    customerName || "Khách lẻ",
    customerPhone || "",
    customerPolicyLabel || "",
  ]
    .filter(Boolean)
    .join(" · ");

  const isPickupView =
    shippingUiMode === "pickup" ||
    shippingMode === "pickup" ||
    shippingPartner === "pickup";
  const shouldShowGlobalError =
    Boolean(error) &&
    !(
      isPickupView &&
      (String(error).toLowerCase().includes("ghn") ||
        String(error).toLowerCase().includes("giao hàng") ||
        String(error).toLowerCase().includes("địa chỉ"))
    );

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5 p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tạo đơn</h2>
          <p className="mt-1 text-sm text-neutral-500"></p>
        </div>

        {shouldShowGlobalError ? (
          <Panel className="p-4">
            <p className="text-sm text-red-600">{error}</p>
          </Panel>
        ) : null}

        {stockWarningMessage || stockWarnings.length ? (
          <Panel className="border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              {stockWarningMessage || stockWarnings[0]}
            </p>
          </Panel>
        ) : null}

        {successMessage ? (
          <Panel className="p-4">
            <p className="text-sm text-green-600">{successMessage}</p>
          </Panel>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.65fr_0.95fr]">
          <div className="space-y-5">
            <Panel className="p-4">
              <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Thông tin khách hàng
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        Nhập tên và tra khách cũ bằng số điện thoại.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        resetNewCustomerForm();
                        setNewCustomerOpen(true);
                      }}
                    >
                      + Khách mới
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Tên khách hàng"
                    />

                    <div
                      className="relative"
                      ref={phoneSuggestionRef}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                        value={customerPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        onFocus={() => {
                          if (suppressPhoneSuggestionRef.current) return;

                          if (customerPhone.trim()) {
                            if (customerSuggestions.length)
                              setCustomerSuggestionOpen(true);
                            return;
                          }

                          if (customerDefaultSuggestions.length) {
                            setCustomerSuggestions(customerDefaultSuggestions);
                            setCustomerSuggestionOpen(true);
                            return;
                          }

                          void loadDefaultCustomerSuggestions();
                        }}
                        placeholder="Nhập sđt để tìm khách cũ"
                      />

                      {customerSuggestionOpen &&
                      customerSuggestions.length > 0 ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[280px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                          {customerSuggestions.map((item, index) => (
                            <button
                              key={`${item.id || item.phone || "customer"}-${index}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() =>
                                void handlePickSuggestedCustomer(item)
                              }
                              className="flex w-full flex-col rounded-xl px-3 py-3 text-left transition hover:bg-neutral-50"
                            >
                              <span className="text-sm font-semibold text-neutral-900">
                                {item.fullName || "Khách hàng"}
                                {item.phone ? ` · ${item.phone}` : ""}
                              </span>
                              {item.subLabel ? (
                                <span className="mt-1 text-xs text-neutral-500">
                                  {item.subLabel}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-300 p-4">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm font-medium"
                        onClick={() => void openAddressSelector()}
                      >
                        Thay đổi
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (!customerId) {
                            setCustomerHint("Cần chọn khách hàng trước.");
                            return;
                          }

                          openCreateAddressModal();
                        }}
                        disabled={!customerId}
                      >
                        + Địa chỉ mới
                      </Button>
                    </div>

                    <div className="mt-3 min-h-[54px] rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-800">
                      {customerAddressDisplay ? (
                        customerAddressDisplay
                      ) : (
                        <span className="text-neutral-400">
                          Chưa có địa chỉ khách hàng
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAddress ? (
                        <>
                          <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
                            {addressShortLabel(selectedAddress)}
                          </span>
                          {selectedAddress.isDefault ? (
                            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                              Mặc định
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
                      {customerId ? "Khách cũ" : "Khách lẻ"}
                    </span>
                    {customerPolicyLabel ? (
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {customerPolicyLabel}
                      </span>
                    ) : null}
                    {customerDiscountPercent > 0 ? (
                      <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        Giảm {customerDiscountPercent}%
                      </span>
                    ) : null}
                    {customerHint ? (
                      <span className="inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-500">
                        {phoneSearching ? "Đang tìm..." : customerHint}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">
                      Kênh bán
                    </p>
                    <select
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={salesChannel}
                      onChange={(e) => setSalesChannel(e.target.value)}
                    >
                      {salesChannels.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">
                      Chi nhánh
                    </p>
                    {branchLoading ? (
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                        Đang tải kho hàng...
                      </div>
                    ) : branchOptions.length <= 1 &&
                      !isOwnerUser(getCurrentUserFromStorage()) ? (
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                        {branchOptions[0]?.label || "—"}
                      </div>
                    ) : (
                      <select
                        className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                      >
                        {branchOptions.map((branch) => (
                          <option key={branch.value} value={branch.value}>
                            {branch.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">
                      Người trả ship
                    </p>
                    <select
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={shippingPayer}
                      onChange={(e) =>
                        setShippingPayer(e.target.value as ShippingPayer)
                      }
                    >
                      <option value="customer">Khách trả</option>
                      <option value="shop">Shop trả</option>
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">
                      Yêu cầu giao hàng
                    </p>
                    <select
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={deliveryRequirement}
                      onChange={(e) =>
                        setDeliveryRequirement(
                          e.target.value as DeliveryRequirement,
                        )
                      }
                    >
                      {deliveryRequirementOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="border-b border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Sản phẩm trong đơn
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Tìm sản phẩm, quét mã vạch / SKU và thêm nhanh vào đơn.
                    </p>
                  </div>
                  <div className="text-sm text-neutral-400">
                    {lines.length} dòng sản phẩm
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_300px]">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    placeholder="Tìm theo tên sản phẩm, SKU, màu, size..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      placeholder="Quét mã vạch / SKU..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          handleBarcodeAdd();
                        }
                      }}
                      autoComplete="off"
                    />
                    <Button onClick={() => handleBarcodeAdd()}>Quét</Button>
                  </div>
                </div>

                {shouldShowProductResults ? (
                  <div className="mt-4 max-h-[260px] overflow-auto rounded-2xl border border-neutral-200">
                    {loadingProducts ? (
                      <div className="p-4 text-sm text-neutral-500">
                        Đang tải sản phẩm...
                      </div>
                    ) : filteredVariants.length === 0 ? (
                      <div className="p-4 text-sm text-neutral-500">
                        Không có variant phù hợp.
                      </div>
                    ) : (
                      filteredVariants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => addVariantToOrder(variant.id)}
                          className="flex w-full items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3 text-left transition hover:bg-neutral-50"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                              {(variant as any).imageUrl ? (
                                <img
                                  src={(variant as any).imageUrl}
                                  alt={(variant as any).productName || variant.sku || "Sản phẩm"}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900">
                                {variant.sku}
                              </p>
                              <p className="mt-1 text-sm text-neutral-700">
                                {(variant as any).productName}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {(variant as any).color || "—"} /{" "}
                                {(variant as any).size || "—"}
                              </p>
                              {Number((variant as any).totalStock || 0) <= 0 ? (
                                <p className="mt-1 text-xs font-semibold text-red-600">
                                  Hết hàng toàn hệ thống · vẫn cho phép tạo đơn âm
                                  kho
                                </p>
                              ) : Number((variant as any).branchStock || 0) <=
                                0 ? (
                                <p className="mt-1 text-xs font-medium text-amber-700">
                                  Chi nhánh này hết hàng · còn{" "}
                                  {Number((variant as any).totalStock || 0)} ở chi
                                  nhánh khác
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-medium">
                              {currency((variant as any).price)}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              Tồn CN:{" "}
                              {Number(
                                (variant as any).branchStock ??
                                  (variant as any).stock ??
                                  0,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-neutral-400">
                              Tổng tồn:{" "}
                              {Number(
                                (variant as any).totalStock ??
                                  (variant as any).stock ??
                                  0,
                              )}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[64px_72px_minmax(220px,1.4fr)_100px_120px_120px_140px_84px] border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <div>STT</div>
                    <div>Ảnh</div>
                    <div>Sản phẩm</div>
                    <div>SL</div>
                    <div>Đơn giá</div>
                    <div>Giảm dòng</div>
                    <div>Thành tiền</div>
                    <div></div>
                  </div>

                  {lines.length === 0 ? (
                    <div className="m-4 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                      Chưa có sản phẩm nào trong đơn.
                    </div>
                  ) : (
                    lines.map((line, index) => {
                      const lineTotal = Math.max(
                        0,
                        line.price * line.qty - line.discount,
                      );
                      return (
                        <div
                          key={line.variantId}
                          className="grid grid-cols-[64px_72px_minmax(220px,1.4fr)_100px_120px_120px_140px_84px] items-center border-b border-neutral-200 px-4 py-4"
                        >
                          <div className="text-sm text-neutral-500">
                            {index + 1}
                          </div>

                          <div>
                            <div className="h-12 w-12 overflow-hidden rounded-xl bg-neutral-100">
                              {line.imageUrl ? (
                                <img
                                  src={line.imageUrl}
                                  alt={line.productName}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                          </div>

                          <div className="pr-4">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{line.productName}</p>
                              {line.productId &&
                              discountedProductIdSet.has(
                                String(line.productId),
                              ) ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  Đang KM
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-neutral-500">
                              {line.sku}
                            </p>
                            <p className="mt-1 text-xs text-neutral-400">
                              {line.color || "—"} / {line.size || "—"} · Tồn CN{" "}
                              {Number(
                                (line as any).branchStock ?? line.stock ?? 0,
                              )}{" "}
                              · Tổng tồn{" "}
                              {Number(
                                (line as any).totalStock ?? line.stock ?? 0,
                              )}
                            </p>
                            {Number(
                              (line as any).totalStock ?? line.stock ?? 0,
                            ) <= 0 ? (
                              <p className="mt-1 text-xs font-semibold text-red-600">
                                Hết hàng toàn hệ thống · đơn này sẽ xuất âm kho.
                              </p>
                            ) : Number(
                                (line as any).branchStock ?? line.stock ?? 0,
                              ) < Number(line.qty || 1) ? (
                              <p className="mt-1 text-xs font-medium text-amber-700">
                                Không đủ tồn ở chi nhánh này · vẫn cho phép bán
                                âm.
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <input
                              type="number"
                              min={1}
                              value={line.qty}
                              onChange={(e) =>
                                updateLine(line.variantId, {
                                  qty: Number(e.target.value) || 1,
                                })
                              }
                              className="w-20 rounded-xl border border-neutral-300 px-3 py-2 outline-none"
                            />
                          </div>

                          <div>
                            <input
                              value={line.price}
                              onChange={(e) =>
                                updateLine(line.variantId, {
                                  price: parseNumber(e.target.value),
                                })
                              }
                              className="w-24 rounded-xl border border-neutral-300 px-3 py-2 outline-none"
                            />
                          </div>

                          <div>
                            <input
                              value={line.discount}
                              onChange={(e) =>
                                updateLine(line.variantId, {
                                  discount: parseNumber(e.target.value),
                                })
                              }
                              className="w-24 rounded-xl border border-neutral-300 px-3 py-2 outline-none"
                            />
                          </div>

                          <div className="font-medium">
                            {currency(lineTotal)}
                          </div>

                          <div className="text-right">
                            <Button
                              variant="secondary"
                              onClick={() => removeLine(line.variantId)}
                            >
                              Xóa
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Panel>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Panel className="p-4">
                <h3 className="text-base font-semibold">Ghi chú</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">
                      Ghi chú nội bộ
                    </p>
                    <textarea
                      className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="VD: khách VIP, lưu ý nội bộ, ưu tiên xử lý"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">
                      Ghi chú đơn hàng
                    </p>
                    <textarea
                      className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="VD: Hàng tặng gói riêng / lưu ý giao hàng"
                    />
                  </div>
                </div>
              </Panel>

              <Panel className="p-4">
                <h3 className="text-base font-semibold">
                  Giao hàng & khuyến mãi
                </h3>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-medium text-neutral-700">
                        Mã giảm giá
                      </p>
                      <input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="VD: 1970VIP"
                        className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-neutral-700">
                        Yêu cầu giao hàng
                      </p>
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                        {requiredNoteLabel(deliveryRequirement)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="grid grid-cols-[150px_1fr] gap-y-2 text-sm">
                      <span className="text-neutral-500">Khách hàng</span>
                      <span>{compactCustomerSummary || "—"}</span>

                      <span className="text-neutral-500">Chi nhánh</span>
                      <span>{previewBranch}</span>

                      <span className="text-neutral-500">Địa chỉ</span>
                      <span>{shippingAddress || "—"}</span>

                      <span className="text-neutral-500">Kiểu giao</span>
                      <span>
                        {shippingUiMode === "carrier"
                          ? "Đẩy qua hãng vận chuyển"
                          : shippingUiMode === "external"
                            ? "Đẩy vận chuyển ngoài"
                            : shippingUiMode === "pickup"
                              ? "Khách nhận tại cửa hàng"
                              : "Giao hàng sau"}
                      </span>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            <Panel className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">Vận chuyển</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Chọn kiểu giao hàng, GHN quote tự động khi đủ địa chỉ.
                  </p>
                </div>

                <div className="text-sm text-neutral-500">
                  {shippingLoading
                    ? "Đang tính phí..."
                    : shippingQuotes.length > 0
                      ? "Đã cập nhật"
                      : "Chưa có dữ liệu"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shippingUiModeOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setShippingUiMode(item.value)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      shippingUiMode === item.value
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="text-sm font-medium text-neutral-900">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {item.description}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-6">
                {shippingPartnerOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    disabled={!item.enabled}
                    onClick={() =>
                      item.enabled && setShippingPartner(item.value)
                    }
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      shippingPartner === item.value
                        ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                        : "border-neutral-200 bg-white text-neutral-900"
                    } ${item.enabled ? "hover:border-neutral-900" : "cursor-not-allowed opacity-50"}`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div
                      className={`mt-1 text-xs ${
                        shippingPartner === item.value ? "text-neutral-200" : "text-neutral-500"
                      }`}
                    >
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
                    value={shippingWeight}
                    onChange={(e) =>
                      setShippingWeight(parseNumber(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-700">
                    Dài (cm)
                  </p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingLength}
                    onChange={(e) =>
                      setShippingLength(parseNumber(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-700">
                    Rộng (cm)
                  </p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingWidth}
                    onChange={(e) =>
                      setShippingWidth(parseNumber(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-700">
                    Cao (cm)
                  </p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingHeight}
                    onChange={(e) =>
                      setShippingHeight(parseNumber(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <div className="grid gap-y-2 md:grid-cols-[150px_1fr]">
                  <span className="text-neutral-500">Tỉnh / Thành</span>
                  <span>{quoteProvince || "—"}</span>

                  <span className="text-neutral-500">Quận / Huyện</span>
                  <span>{quoteDistrict || "—"}</span>

                  <span className="text-neutral-500">Xã / Phường</span>
                  <span>{quoteWard || "—"}</span>
                </div>
              </div>

              {shippingUiMode === "carrier" && selectedCarrierPickup ? (
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  Kho lấy hàng đã cấu hình: <span className="font-semibold text-neutral-900">{selectedCarrierPickup.name || selectedCarrierPickup.label}</span>
                  {selectedCarrierPickup.address ? ` · ${selectedCarrierPickup.address}` : ""}
                </div>
              ) : null}

              {shippingHint ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  {shippingHint}
                </div>
              ) : null}

              {shippingError && shippingUiMode !== "pickup" ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {shippingError}
                </div>
              ) : null}

              {shippingLoading &&
              shippingUiMode === "carrier" &&
              !shippingQuotes.length ? (
                <div className="mt-4 overflow-hidden rounded-3xl border border-dashed border-neutral-300 bg-white shadow-sm">
                  <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="text-sm font-semibold text-neutral-950">
                      Đang chuẩn bị bảng phí vận chuyển
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      Tự động lấy tối đa khoảng 11 gói GHN / ViettelPost /
                      AhaMove khi đủ địa chỉ.
                    </div>
                  </div>
                  <div className="grid gap-3 p-4 md:grid-cols-3">
                    {["GHN", "Viettel Post", "AhaMove"].map((carrier) => (
                      <div
                        key={carrier}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                      >
                        <div className="h-4 w-24 rounded bg-neutral-200" />
                        <div className="mt-3 h-6 w-32 rounded bg-neutral-200" />
                        <div className="mt-3 h-3 w-full rounded bg-neutral-200" />
                        <div className="mt-2 h-3 w-2/3 rounded bg-neutral-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {shippingQuotes.length > 0
                ? (() => {
                    const customerShippingFee = parseNumber(shippingFee) || 0;
                    const activeQuote =
                      selectedQuote ||
                      shippingQuotes.find(
                        (q) =>
                          getQuoteCarrier(q) === shippingPartner &&
                          q.serviceId === selectedShippingServiceId &&
                          q.serviceTypeId === selectedShippingServiceTypeId &&
                          !(q as any)?._disabled,
                      ) ||
                      null;

                    const validQuotes = shippingQuotes.filter(
                      (quote) =>
                        getFeeNumber(quote) > 0 && !(quote as any)?._disabled,
                    );
                    const cheapestQuote = [...validQuotes].sort(
                      (a, b) => getFeeNumber(a) - getFeeNumber(b),
                    )[0];
                    const fastestQuote = [...validQuotes]
                      .filter(
                        (quote) =>
                          Number((quote as any)?._durationMinutes || 0) > 0,
                      )
                      .sort(
                        (a, b) =>
                          Number((a as any)?._durationMinutes || 0) -
                          Number((b as any)?._durationMinutes || 0),
                      )[0];
                    const recommendedQuote =
                      validQuotes.find((quote) =>
                        getQuoteBadges(quote).includes("Khuyên dùng"),
                      ) ||
                      cheapestQuote ||
                      validQuotes[0];

                    const quickCards = [
                      {
                        key: "recommended",
                        title: "Khuyên dùng",
                        quote: recommendedQuote,
                        tone: "emerald",
                      },
                      {
                        key: "cheapest",
                        title: "Rẻ nhất",
                        quote: cheapestQuote,
                        tone: "orange",
                      },
                      {
                        key: "fastest",
                        title: "Nhanh nhất",
                        quote: fastestQuote,
                        tone: "blue",
                      },
                    ].filter((item) => item.quote);

                    const groupedQuotes = groupQuotesByCarrier(shippingQuotes);
                    const insight = getShippingInsight(
                      activeQuote,
                      customerShippingFee,
                    );

                    const applyQuote = (quote: ShipmentQuoteResult) => {
                      const carrier = getQuoteCarrier(quote);
                      const feeValue = getFeeNumber(quote);

                      applyShippingRef.current?.({
                        shippingFee: feeValue,
                        applyFeeToInput: Boolean(
                          (quote as any)._applyFeeToInput,
                        ),
                        shippingPartner: carrier,
                        shippingMode: "partner",
                        selectedServiceId: quote.serviceId,
                        selectedServiceTypeId: quote.serviceTypeId,
                        selectedQuoteKey: getQuoteKey(quote),
                        weight: Number(shippingWeight || 200),
                        length: Number(shippingLength || 10),
                        width: Number(shippingWidth || 10),
                        height: Number(shippingHeight || 10),
                        ghnDistrictId:
                          (quote as any)._ghnDistrictId || ghnDistrictId,
                        ghnWardCode: (quote as any)._ghnWardCode || ghnWardCode,
                      });
                    };

                    return (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          {quickCards.map((item) => {
                            const quote = item.quote as ShipmentQuoteResult;
                            const carrier = getQuoteCarrier(quote);
                            const meta = getCarrierMeta(carrier);
                            const active =
                              activeQuote &&
                              getQuoteKey(activeQuote) === getQuoteKey(quote);
                            const feeValue = getFeeNumber(quote);

                            const tone =
                              item.tone === "emerald"
                                ? "border-emerald-200 bg-emerald-50"
                                : item.tone === "blue"
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-orange-200 bg-orange-50";

                            return (
                              <button
                                key={`${item.key}-${getQuoteKey(quote)}`}
                                type="button"
                                onClick={() => applyQuote(quote)}
                                className={`rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                                  active
                                    ? "border-neutral-900 bg-white ring-2 ring-neutral-900/10"
                                    : tone
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-neutral-700">
                                    {item.title}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.accent}`}
                                  >
                                    {meta.short}
                                  </span>
                                </div>

                                <div className="mt-3 text-sm font-semibold text-neutral-950">
                                  {meta.name} ·{" "}
                                  {getQuoteServiceCleanName(quote)}
                                </div>

                                <div className="mt-2 flex items-end justify-between gap-3">
                                  <div>
                                    <div className="text-2xl font-bold tracking-tight text-neutral-950">
                                      {currency(feeValue)}
                                    </div>
                                    <div className="mt-1 text-xs text-neutral-600">
                                      {getQuoteLeadtimeLabel(quote)}
                                    </div>
                                  </div>
                                  <div className="text-right text-[11px] font-medium text-neutral-500">
                                    {getSmartQuoteNote(quote)}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${insight.className}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{insight.label}</span>
                            <span className="text-xs font-medium opacity-80">
                              Phí khách đang trả:{" "}
                              {currency(customerShippingFee)} · Gói đang chọn:{" "}
                              {activeQuote
                                ? currency(getFeeNumber(activeQuote))
                                : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
                          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-neutral-950">
                                  So sánh gói vận chuyển
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-500">
                                  Nhóm theo hãng, chọn nhanh gói phù hợp cho đơn
                                  này.
                                </div>
                              </div>
                              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-600 shadow-sm">
                                {shippingQuotes.length} gói
                              </div>
                            </div>
                          </div>

                          <div className="divide-y divide-neutral-100">
                            {groupedQuotes.map((group) => (
                              <div
                                key={group.carrier}
                                className="grid grid-cols-[148px_1fr]"
                              >
                                <div
                                  className={`border-r border-neutral-100 p-4 ${group.meta.soft}`}
                                >
                                  <div className="sticky top-3">
                                    <div
                                      className={`inline-flex rounded-2xl border px-3 py-2 text-sm font-bold ${group.meta.accent}`}
                                    >
                                      {group.meta.name}
                                    </div>
                                    <div className="mt-2 text-xs text-neutral-500">
                                      {group.meta.sub}
                                    </div>
                                    <div className="mt-3 text-[11px] font-semibold text-neutral-500">
                                      {group.quotes.length} lựa chọn
                                    </div>

                                    {group.carrier === "ahamove" ? (
                                      <div className="mt-3 rounded-2xl border border-orange-200 bg-white/80 p-2">
                                        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-orange-700">
                                          Thanh toán Aha
                                        </div>
                                        <div className="grid gap-1.5">
                                          {AHAMOVE_PAYMENT_METHOD_OPTIONS.map((item) => (
                                            <button
                                              key={item.value}
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                handleAhamovePaymentMethodChange(item.value);
                                              }}
                                              className={`rounded-xl border px-2 py-2 text-left text-[11px] leading-4 transition ${
                                                ahamovePaymentMethod === item.value
                                                  ? "border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                                                  : "border-orange-100 bg-white text-neutral-600 hover:border-orange-300"
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold">{item.label}</span>
                                                <span
                                                  className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                                                    ahamovePaymentMethod === item.value
                                                      ? "border-orange-600 bg-orange-600"
                                                      : "border-orange-200 bg-white"
                                                  }`}
                                                />
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                        <div className="mt-2 rounded-xl bg-orange-50 px-2 py-1.5 text-[11px] leading-4 text-orange-800">
                                          API: <span className="font-semibold">{ahamovePaymentMethod}</span> · {shippingPayer === "customer" ? "Khách chịu phí" : "Shop chịu phí"}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="divide-y divide-neutral-100">
                                  {group.quotes.map((quote) => {
                                    const carrier = getQuoteCarrier(quote);
                                    const active =
                                      selectedShippingQuoteKey
                                        ? getQuoteKey(quote) === selectedShippingQuoteKey
                                        : carrier === shippingPartner &&
                                          quote.serviceId ===
                                            selectedShippingServiceId &&
                                          quote.serviceTypeId ===
                                            selectedShippingServiceTypeId;
                                    const badges = getQuoteBadges(quote);
                                    const feeValue = getFeeNumber(quote);
                                    const disabled = Boolean(
                                      (quote as any)?._disabled,
                                    );

                                    return (
                                      <button
                                        key={getQuoteKey(quote)}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => applyQuote(quote)}
                                        className={`grid w-full grid-cols-[1fr_150px_128px] items-center gap-3 px-4 py-3 text-left transition ${
                                          active
                                            ? "bg-neutral-50 ring-1 ring-inset ring-neutral-900"
                                            : "hover:bg-neutral-50"
                                        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <span
                                            className={`mt-1 h-4 w-4 rounded-full border ${
                                              active
                                                ? "border-neutral-900 bg-neutral-900"
                                                : "border-neutral-300 bg-white"
                                            }`}
                                          />
                                          <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="text-sm font-semibold text-neutral-950">
                                                {getQuoteServiceCleanName(
                                                  quote,
                                                )}
                                              </span>
                                              {badges.map((badge) => (
                                                <span
                                                  key={badge}
                                                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                                    badge === "Rẻ nhất"
                                                      ? "bg-orange-50 text-orange-600"
                                                      : badge === "Nhanh nhất"
                                                        ? "bg-blue-50 text-blue-600"
                                                        : "bg-emerald-50 text-emerald-700"
                                                  }`}
                                                >
                                                  {badge}
                                                </span>
                                              ))}
                                            </div>

                                            <div className="mt-1 text-xs text-neutral-500">
                                              {getSmartQuoteNote(quote)}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="text-sm text-neutral-700">
                                          {getQuoteLeadtimeLabel(quote)}
                                        </div>

                                        <div className="text-right">
                                          <div className="text-sm font-bold text-neutral-950">
                                            {currency(feeValue)}
                                          </div>
                                          <div className="mt-0.5 text-[11px] text-neutral-400">
                                            Service {quote.serviceId}
                                            {quote.serviceTypeId
                                              ? ` · Type ${quote.serviceTypeId}`
                                              : ""}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                : null}
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel className="overflow-hidden">
              <div className="border-b border-neutral-200 p-4">
                <h3 className="text-lg font-semibold">Chốt đơn</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Tóm tắt thanh toán và xác nhận tạo đơn.
                </p>
              </div>

              <div className="space-y-4 p-4">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <div className="grid grid-cols-[110px_1fr] gap-y-2">
                    <span className="text-neutral-500">Khách hàng</span>
                    <span>{customerName || "—"}</span>

                    <span className="text-neutral-500">Điện thoại</span>
                    <span>{customerPhone || "—"}</span>

                    <span className="text-neutral-500">Kênh bán</span>
                    <span>{salesChannel}</span>

                    <span className="text-neutral-500">Chi nhánh</span>
                    <span>{previewBranch}</span>

                    <span className="text-neutral-500">Vận chuyển</span>
                    <span>
                      {shippingPartner === "ahamove"
                        ? "AhaMove"
                        : shippingPartner === "viettelpost"
                          ? "Viettel Post"
                          : shippingPartner === "ghn"
                            ? "GHN"
                            : shippingPartner}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">
                      Tổng tiền hàng ({lines.length} SP)
                    </span>
                    <span>{currency(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-500">Giảm giá nhập tay</span>
                    <input
                      className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none"
                      value={formatVndInput(discountTotal)}
                      onChange={(e) =>
                        setDiscountTotal(String(parseNumber(e.target.value)))
                      }
                      inputMode="numeric"
                    />
                  </div>

                  {autoPromotionDiscount > 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Khuyến mại tự động</span>
                        <span>-{currency(autoPromotionDiscount)}</span>
                      </div>
                      {promotionPreview.breakdown.length ? (
                        <div className="mt-1 space-y-0.5 text-xs">
                          {promotionPreview.breakdown.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between gap-3"
                            >
                              <span>{item.name}</span>
                              <span>-{currency(item.discountAmount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-500">Phí ship</span>
                      <input
                        className="w-32 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none focus:border-neutral-900"
                        value={formatVndInput(shippingFee)}
                        onChange={(e) =>
                          setShippingFee(String(parseNumber(e.target.value)))
                        }
                        inputMode="numeric"
                        placeholder="30000"
                      />
                    </div>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-3" />

                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Khách phải trả</span>
                    <span>{currency(customerMustPay)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-500">Khách đã trả</span>
                    <input
                      className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none"
                      value={formatVndInput(customerPaid)}
                      onChange={(e) =>
                        setCustomerPaid(String(parseNumber(e.target.value)))
                      }
                    />
                    {/* 🔥 Nguồn tiền */}
                    <div className="mt-3">
                      <label className="text-xs font-medium text-neutral-500">
                        Nguồn tiền
                      </label>

                      <select
                        value={paymentSourceId}
                        onChange={(e) => setPaymentSourceId(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                      >
                        <option value="">Chọn nguồn tiền</option>
                        {visiblePaymentSources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name || source.label || source.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Còn phải trả</span>
                    <span>{currency(remaining)}</span>
                  </div>
                </div>

                <Button
                  className="w-full py-3"
                  onClick={() => setModePickerOpen(true)}
                  disabled={
                    saving || copyingOrder || !lines.length || !canCreateOrder
                  }
                >
                  {copyingOrder
                    ? "Đang sao chép..."
                    : saving
                      ? "Đang tạo..."
                      : canCreateOrder
                        ? "Tạo đơn"
                        : "Bạn không có quyền tạo đơn"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Reset
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </form>

      <CreateModePicker
        open={modePickerOpen}
        saving={saving}
        canCreateDraft={canCreateDraftOrder}
        canCreateApprove={canCreateApproveOrder}
        canCreateShip={canCreateShipOrder}
        onClose={() => {
          if (!saving) setModePickerOpen(false);
        }}
        onSelect={async (mode) => {
          if (saving) return;
          setCreateMode(mode);
          setModePickerOpen(false);
          await handleSubmit(mode);
        }}
      />

      {saving ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/10 px-4 pb-8">
          <div className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-800 shadow-2xl">
            Đang xử lý đơn hàng, không tắt trình duyệt...
          </div>
        </div>
      ) : null}

      <Modal
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        title="Khách mới"
      >
        <div className="space-y-4">
          {newCustomerError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {newCustomerError}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Người nhận
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerRecipientName}
                onChange={(e) => setNewCustomerRecipientName(e.target.value)}
                placeholder="Tên người nhận / khách hàng"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Số điện thoại
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Email</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Mã khách
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerCode}
                onChange={(e) => setNewCustomerCode(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Postal code
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerPostalCode}
                onChange={(e) => setNewCustomerPostalCode(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Địa chỉ thông minh
            </p>
            <textarea
              className="min-h-[84px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={newCustomerSmartAddressInput}
              onChange={(e) => setNewCustomerSmartAddressInput(e.target.value)}
              onBlur={(e) =>
                void handleNewCustomerSmartAddressApply(e.target.value)
              }
              placeholder="Paste nguyên địa chỉ khách để tự điền Tỉnh / Huyện / Xã"
            />
            {newCustomerSmartAddressHint ? (
              <p className="mt-2 text-xs text-neutral-500">
                {newCustomerSmartAddressLoading
                  ? "Đang phân tích..."
                  : newCustomerSmartAddressHint}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Tỉnh / Thành
              </p>
              <SearchableSelect
                value={newCustomerProvince}
                onChange={setNewCustomerProvince}
                options={provinceSelectOptions}
                placeholder="Chọn tỉnh / thành"
                searchPlaceholder="Gõ tỉnh / thành, ví dụ: dak lak"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Quận / Huyện
              </p>
              <SearchableSelect
                value={newCustomerDistrict}
                onChange={setNewCustomerDistrict}
                options={newCustomerDistrictSelectOptions}
                placeholder="Chọn quận / huyện"
                searchPlaceholder="Gõ quận / huyện, ví dụ: krong bong"
                disabled={!newCustomerProvince}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Xã / Phường
              </p>
              <SearchableSelect
                value={newCustomerWard}
                onChange={setNewCustomerWard}
                options={newCustomerWardSelectOptions}
                placeholder="Chọn xã / phường"
                searchPlaceholder="Gõ xã / phường, ví dụ: hoa phong"
                disabled={!newCustomerDistrict}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Địa chỉ cụ thể
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerAddressLine}
                onChange={(e) => setNewCustomerAddressLine(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Địa chỉ dòng 2
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerAddressLine2}
                onChange={(e) => setNewCustomerAddressLine2(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Ghi chú nội bộ
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerTags}
                onChange={(e) => setNewCustomerTags(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Ghi chú
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerNote}
                onChange={(e) => setNewCustomerNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setNewCustomerOpen(false)}
            >
              Đóng
            </Button>
            <Button
              onClick={() => void createNewCustomerAndApply()}
              disabled={newCustomerSaving}
            >
              {newCustomerSaving ? "Đang tạo..." : "Tạo và áp dụng"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={addressSelectorOpen}
        onClose={() => setAddressSelectorOpen(false)}
        title="Thay đổi địa chỉ"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              Chọn từ sổ địa chỉ khách hàng hoặc tạo địa chỉ mới.
            </p>
            <Button variant="secondary" onClick={openCreateAddressModal}>
              + Thêm mới
            </Button>
          </div>

          {!customerAddresses.length ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
              Khách hàng này chưa có địa chỉ nào.
            </div>
          ) : (
            <div className="space-y-3">
              {customerAddresses.map((address) => {
                const isActive = address.id === selectedAddressId;
                return (
                  <div
                    key={address.id}
                    className={`rounded-2xl border p-4 ${
                      isActive
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {addressShortLabel(address)}
                          </span>
                          {address.isDefault ? (
                            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                              Mặc định
                            </span>
                          ) : null}
                        </div>

                        <div className="text-sm text-neutral-700">
                          {address.recipientName || customerName || "—"}
                          {address.phone ? ` · ${address.phone}` : ""}
                        </div>

                        <div className="text-sm text-neutral-500">
                          {formatAddress(address)}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant={isActive ? "primary" : "secondary"}
                          onClick={() => {
                            applySelectedAddress(address);
                            setAddressSelectorOpen(false);
                          }}
                        >
                          {isActive ? "Đang dùng" : "Chọn"}
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() => openEditAddressModal(address)}
                        >
                          Sửa
                        </Button>

                        {!address.isDefault ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void handleSetDefaultAddress(address.id)
                            }
                          >
                            Đặt mặc định
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={addressEditorOpen}
        onClose={() => setAddressEditorOpen(false)}
        title={editingAddressId ? "Sửa địa chỉ" : "Địa chỉ mới"}
      >
        <div className="space-y-4">
          {addressError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {addressError}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Địa chỉ thông minh
            </p>
            <textarea
              className="min-h-[84px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={smartAddressInput}
              onChange={(e) => setSmartAddressInput(e.target.value)}
              onBlur={(e) => void handleSmartAddressApply(e.target.value)}
              placeholder="Paste nguyên địa chỉ để tự map tỉnh / huyện / xã"
            />
            {smartAddressHint ? (
              <p className="mt-2 text-xs text-neutral-500">
                {smartAddressLoading ? "Đang phân tích..." : smartAddressHint}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Nhãn địa chỉ
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Người nhận
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressRecipientName}
                onChange={(e) => setAddressRecipientName(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Số điện thoại
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressPhone}
                onChange={(e) => setAddressPhone(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Email</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressEmail}
                onChange={(e) => setAddressEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Tỉnh / Thành
              </p>
              <SearchableSelect
                value={addressProvince}
                onChange={setAddressProvince}
                options={provinceSelectOptions}
                placeholder="Chọn tỉnh / thành"
                searchPlaceholder="Gõ tỉnh / thành, ví dụ: dak lak"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Quận / Huyện
              </p>
              <SearchableSelect
                value={addressDistrict}
                onChange={setAddressDistrict}
                options={addressDistrictSelectOptions}
                placeholder="Chọn quận / huyện"
                searchPlaceholder="Gõ quận / huyện, ví dụ: krong bong"
                disabled={!addressProvince}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Xã / Phường
              </p>
              <SearchableSelect
                value={addressWard}
                onChange={setAddressWard}
                options={addressWardSelectOptions}
                placeholder="Chọn xã / phường"
                searchPlaceholder="Gõ xã / phường, ví dụ: hoa phong"
                disabled={!addressDistrict}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Địa chỉ cụ thể
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Địa chỉ dòng 2
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Postal code
              </p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
              />
            </div>

            <label className="mt-8 flex items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={addressSaveAsDefault}
                onChange={(e) => setAddressSaveAsDefault(e.target.checked)}
              />
              Đặt làm địa chỉ mặc định
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setAddressEditorOpen(false)}
            >
              Đóng
            </Button>
            <Button onClick={() => void saveAddress()} disabled={addressSaving}>
              {addressSaving ? "Đang lưu..." : "Lưu địa chỉ"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
