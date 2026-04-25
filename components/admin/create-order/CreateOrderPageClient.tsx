"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  createOrder,
  createGhnShipment,
  findCustomerByPhone,
  getProductsForOrder,
  quoteShipment,
  resolveGhnAddress,
  type CreateOrderMode,
  type CreateOrderPayload,
  type OrderProduct,
  type ShipmentQuoteResult,
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
type DeliveryRequirement =
  | "CHOXEMHANG_KHONGTHU"
  | "CHOXEMHANG_CHOTHU"
  | "KHONGCHOXEMHANG";

type OrderLine = {
  variantId: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
  price: number;
  stock: number;
  qty: number;
  discount: number;
  imageUrl?: string;
};

type SearchCustomerLite = {
  id?: string;
  fullName?: string;
  phone?: string;
  email?: string;
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

type ShippingQuoteApplyPayload = {
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
};

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function parseNumber(value: string | number) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[^\d.-]/g, "");
  return Number(cleaned || 0);
}

function normalizeSpaces(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
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

function stripProvincePrefix(value?: string | null) {
  return normalizeAddressToken(value).replace(/^(tinh|thanh pho|tp)\s+/, "").trim();
}

function stripDistrictPrefix(value?: string | null) {
  return normalizeAddressToken(value).replace(
    /^(quan|huyen|thi xa|thanh pho|tp)\s+/,
    ""
  ).trim();
}

function stripWardPrefix(value?: string | null) {
  return normalizeAddressToken(value).replace(/^(xa|phuong|thi tran)\s+/, "").trim();
}

const ADMIN_MERGE_ALIASES: Record<string, string> = {
  "thi tran phuc tho": "xa phuc tho",
};

function getFeeNumber(row: ShipmentQuoteResult) {
  return Number(
    (row as any)?.fee?.total ||
      (row as any)?.fee?.total_fee ||
      (row as any)?.fee?.service_fee ||
      (row as any)?.fee ||
      0
  );
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
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function findBestProvinceName(
  raw: string,
  provinceOptions: ProvinceItem[]
): string | null {
  const normalized = normalizeAddressToken(raw);
  const candidates = provinceOptions.map((item) => ({
    original: item.name,
    key1: stripProvincePrefix(item.name),
    key2: normalizeAddressToken(item.name),
  }));

  const hit =
    candidates.find((item) => normalized.includes(item.key2)) ||
    candidates.find((item) => normalized.includes(item.key1));

  return hit?.original || null;
}

function findBestDistrictName(
  raw: string,
  districtOptions: DistrictItem[]
): string | null {
  const normalized = normalizeAddressToken(raw);
  const candidates = districtOptions.map((item) => ({
    original: item.name,
    key1: stripDistrictPrefix(item.name),
    key2: normalizeAddressToken(item.name),
  }));

  const hit =
    candidates.find((item) => normalized.includes(item.key2)) ||
    candidates.find((item) => normalized.includes(item.key1));

  return hit?.original || null;
}

function findBestWardName(raw: string, wardOptions: WardItem[]): string | null {
  const normalizedRaw = normalizeAddressToken(raw);
  const replaced = Object.entries(ADMIN_MERGE_ALIASES).reduce((acc, [from, to]) => {
    return acc.includes(from) ? acc.replaceAll(from, to) : acc;
  }, normalizedRaw);

  const candidates = wardOptions.map((item) => ({
    original: item.name,
    key1: stripWardPrefix(item.name),
    key2: normalizeAddressToken(item.name),
  }));

  const hit =
    candidates.find((item) => replaced.includes(item.key2)) ||
    candidates.find((item) => replaced.includes(item.key1)) ||
    candidates.find((item) => normalizedRaw.includes(item.key2)) ||
    candidates.find((item) => normalizedRaw.includes(item.key1));

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
          <button type="button" onClick={onClose} className="text-xl text-neutral-500">
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
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: CreateOrderMode) => void | Promise<void>;
}) {
  if (!open) return null;

  const items = [
    {
      value: "draft" as const,
      title: "Tạo nháp",
      description: "Lưu đơn ở bước đặt hàng.",
    },
    {
      value: "approve" as const,
      title: "Tạo và duyệt",
      description: "Chuyển đơn sang bước duyệt để kho xử lý.",
    },
    {
      value: "ship" as const,
      title: "Tạo và xuất kho",
      description: "Đi thẳng tới xuất kho và gửi vận chuyển.",
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
            className="rounded-xl px-3 py-2 text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => void onSelect(item.value)}
              className="flex w-full items-start justify-between rounded-2xl border border-neutral-200 p-4 text-left transition hover:border-black hover:bg-neutral-50"
            >
              <div>
                <div className="text-base font-semibold">{item.title}</div>
                <div className="mt-1 text-sm text-neutral-500">
                  {item.description}
                </div>
              </div>

              <div className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white">
                Chọn
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

const shippingPartnerOptions = [
  { value: "ghn", label: "GHN", enabled: true },
  { value: "ghtk", label: "GHTK", enabled: false },
  { value: "viettelpost", label: "Viettel Post", enabled: false },
  { value: "grab", label: "Grab Express", enabled: false },
  { value: "ahamove", label: "Ahamove", enabled: false },
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
  const applyShippingRef = useRef<((payload: ShippingQuoteApplyPayload) => void) | null>(null);
  const phoneLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneSuggestionRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const [createMode, setCreateMode] = useState<CreateOrderMode>("draft");
  const [modePickerOpen, setModePickerOpen] = useState(false);

  const [userBranchIds, setUserBranchIds] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [salesChannel, setSalesChannel] = useState("ADMIN");
  const [branchId, setBranchId] = useState("");

  const [phoneSearching, setPhoneSearching] = useState(false);
  const [customerHint, setCustomerHint] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPolicyLabel, setCustomerPolicyLabel] = useState("");
  const [customerDiscountPercent, setCustomerDiscountPercent] = useState(0);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestionItem[]>([]);
  const [customerSuggestionOpen, setCustomerSuggestionOpen] = useState(false);
const [customerDefaultSuggestions, setCustomerDefaultSuggestions] = useState<
  CustomerSuggestionItem[]
>([]);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddressItem[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [provinceOptions, setProvinceOptions] = useState<ProvinceItem[]>([]);
  const [addressDistrictOptions, setAddressDistrictOptions] = useState<DistrictItem[]>([]);
  const [addressWardOptions, setAddressWardOptions] = useState<WardItem[]>([]);
  const [newCustomerDistrictOptions, setNewCustomerDistrictOptions] = useState<DistrictItem[]>([]);
  const [newCustomerWardOptions, setNewCustomerWardOptions] = useState<WardItem[]>([]);

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
  const [shippingFee, setShippingFee] = useState("0");
  const [couponCode, setCouponCode] = useState("");
  const [customerPaid, setCustomerPaid] = useState("0");
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
const [paymentSourceId, setPaymentSourceId] = useState("");
  const [shippingMode, setShippingMode] = useState<ShippingMode>("partner");
  const [shippingPayer, setShippingPayer] = useState<ShippingPayer>("customer");
  const [shippingUiMode, setShippingUiMode] = useState<ShippingUiMode>("carrier");
  const [shippingPartner, setShippingPartner] = useState("ghn");
  const [deliveryRequirement, setDeliveryRequirement] =
    useState<DeliveryRequirement>("CHOXEMHANG_KHONGTHU");

  const [ghnDistrictId, setGhnDistrictId] = useState<number | undefined>();
  const [ghnWardCode, setGhnWardCode] = useState<string | undefined>();
  const [selectedShippingServiceId, setSelectedShippingServiceId] = useState<
    number | undefined
  >();
  const [selectedShippingServiceTypeId, setSelectedShippingServiceTypeId] =
    useState<number | undefined>();

  const [shippingWeight, setShippingWeight] = useState(200);
  const [shippingLength, setShippingLength] = useState(10);
  const [shippingWidth, setShippingWidth] = useState(10);
  const [shippingHeight, setShippingHeight] = useState(10);

  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingHint, setShippingHint] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [shippingQuotes, setShippingQuotes] = useState<ShipmentQuoteResult[]>([]);

  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");

  const [newCustomerName, setNewCustomerName] = useState("");
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

  const [newCustomerSmartAddressInput, setNewCustomerSmartAddressInput] = useState("");
  const [newCustomerSmartAddressHint, setNewCustomerSmartAddressHint] = useState("");
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
              ""
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
                  (item.code && userBranchIds.includes(item.code))
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
      const province = provinceOptions.find((item) => item.name === addressProvince);
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
      const district = addressDistrictOptions.find((item) => item.name === addressDistrict);
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
      const province = provinceOptions.find((item) => item.name === newCustomerProvince);
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
        (item) => item.name === newCustomerDistrict
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
    () => provinceOptions.map((item) => ({ value: item.name, label: item.name })),
    [provinceOptions]
  );

  const addressDistrictSelectOptions = useMemo(
    () =>
      addressDistrictOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [addressDistrictOptions]
  );

  const addressWardSelectOptions = useMemo(
    () =>
      addressWardOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [addressWardOptions]
  );

  const newCustomerDistrictSelectOptions = useMemo(
    () =>
      newCustomerDistrictOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [newCustomerDistrictOptions]
  );

  const newCustomerWardSelectOptions = useMemo(
    () =>
      newCustomerWardOptions.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [newCustomerWardOptions]
  );

  const allVariants = useMemo(() => {
    const currentUser = getCurrentUserFromStorage();
    const canPickBranch = isOwnerUser(currentUser);

    return products.flatMap((product) =>
      product.variants
        .map((variant) => {
          const branchStocks: Record<string, number> =
            ((variant as any).branchStocks as Record<string, number>) || {};
          let stock = 0;

          if (canPickBranch) {
            stock = Object.keys(branchStocks).reduce(
              (sum, key) => sum + Number(branchStocks[key] || 0),
              0
            );
          } else {
            stock = Number(branchStocks[branchId] || 0);
          }

          return {
            ...variant,
            productName: product.name,
            imageUrl: (product as any).imageUrl,
            stock,
          };
        })
        .filter((variant) => variant.stock > 0)
    );
  }, [products, branchId]);

  const filteredVariants = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return allVariants;
    return allVariants.filter((variant) => {
      return (
        String(variant.sku || "").toLowerCase().includes(q) ||
        String((variant as any).productName || "").toLowerCase().includes(q) ||
        String((variant as any).color || "").toLowerCase().includes(q) ||
        String((variant as any).size || "").toLowerCase().includes(q)
      );
    });
  }, [allVariants, productSearch]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    [lines]
  );

  const lineDiscountTotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.discount || 0), 0),
    [lines]
  );

  const manualDiscount = parseNumber(discountTotal);
  const fee = parseNumber(shippingFee);
  const paid = parseNumber(customerPaid);
  const totalDiscount = lineDiscountTotal + manualDiscount;
  const customerMustPay = Math.max(0, subtotal - totalDiscount + fee);
  const remaining = Math.max(0, customerMustPay - paid);
useEffect(() => {
  const selected = paymentSources.find((s) => s.id === paymentSourceId);
  if (!selected) return;

  if (selected.type === "COD") {
    setCustomerPaid("0");
  }

  if (selected.type === "CASH" || selected.type === "BANK") {
    setCustomerPaid(String(customerMustPay));
  }
}, [paymentSourceId, paymentSources, customerMustPay]);
  const previewBranch =
    branchOptions.find((item) => item.value === branchId)?.label || branchId || "—";

  const selectedAddress =
    customerAddresses.find((item) => item.id === selectedAddressId) || null;

  const currentProvinceRaw = selectedAddress?.province || addressProvince;
  const currentDistrictRaw = (selectedAddress as any)?.district || addressDistrict;
  const currentWardRaw = selectedAddress?.ward || addressWard;

  const quoteProvince = normalizeProvinceName(currentProvinceRaw || "");
  const quoteDistrict = normalizeDistrictName(currentDistrictRaw || "");
  const quoteWard = normalizeWardName(currentWardRaw || "");

  const quoteItems = useMemo(() => {
    return lines
      .filter((item) => Number(item.qty || 0) > 0)
      .map((item) => ({
        name: item.productName || item.sku || "Sản phẩm",
        quantity: Number(item.qty || 0),
        length: Number(shippingLength || 10),
        width: Number(shippingWidth || 10),
        height: Number(shippingHeight || 10),
        weight: Math.max(
          1,
          Math.floor(Number(shippingWeight || 200) / Math.max(lines.length, 1))
        ),
      }));
  }, [lines, shippingLength, shippingWidth, shippingHeight, shippingWeight]);

  const selectedQuote =
    shippingQuotes.find((q) => q.serviceId === selectedShippingServiceId) || null;

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
  };

  const loadCustomerAddressBook = async (nextCustomerId: string) => {
    const rows = await getCustomerAddresses(nextCustomerId);
    setCustomerAddresses(rows);

    const defaultAddress = rows.find((item) => item.isDefault) || rows[0] || null;

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
      customer?.fullName || customer?.name || customer?.customerName || "Khách hàng"
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
  setCustomerPhone(value);
  setCustomerHint("");

  if (phoneLookupTimerRef.current) {
    clearTimeout(phoneLookupTimerRef.current);
    phoneLookupTimerRef.current = null;
  }

  const cleaned = normalizePhone(value);

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
          : "Chưa có khách cũ cho từ khóa này."
      );
    } catch {
      setCustomerSuggestions([]);
      setCustomerSuggestionOpen(false);
      setCustomerHint("");
    } finally {
      setPhoneSearching(false);
    }
  }, 120);
};

  const handlePickSuggestedCustomer = async (customer: CustomerSuggestionItem) => {
    setCustomerSuggestions([]);
    setCustomerSuggestionOpen(false);
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
    const province = provinceOptions.find((item) => item.name === provinceName);
    if (!province?.id) return;

    const districts = await getDistricts(province.id);
    setAddressDistrictOptions(districts);

    const districtName = findBestDistrictName(addressOnly, districts);
    if (!districtName) {
      setAddressLine1(addressOnly);
      setAddressDistrict("");
      setAddressWard("");
      setSmartAddressHint("Đã lấy tên/sđt và nhận diện tỉnh / thành, chưa chắc quận huyện.");
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

    setAddressLine1(cleanupDetailAddress(detail || addressOnly));

    const normalizedRaw = normalizeAddressToken(addressOnly);
    const aliasMatched = Object.keys(ADMIN_MERGE_ALIASES).some((key) =>
      normalizedRaw.includes(key)
    );

    setSmartAddressHint(
      wardName
        ? aliasMatched
          ? "Đã tự map tên người nhận, sđt và địa chỉ cũ sang địa chỉ sau sáp nhập."
          : "Đã tự nhận diện người nhận, sđt, tỉnh / huyện / xã."
        : "Đã lấy tên/sđt và nhận diện tỉnh / huyện, chưa chắc xã."
    );
  } catch {
    setSmartAddressHint("Đã thử tách người nhận / sđt / địa chỉ nhưng chưa map hết được.");
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
      setCustomerName(parsed.recipientName);
    }

    if (parsed.phone) {
      setNewCustomerPhone(parsed.phone);
    }

    const addressOnly = parsed.addressText || raw;

    const provinceName = findBestProvinceName(addressOnly, provinceOptions);
    if (!provinceName) {
      setNewCustomerAddressLine(addressOnly);
      setNewCustomerSmartAddressHint("Đã lấy tên/sđt, nhưng chưa nhận ra tỉnh / thành.");
      return;
    }

    setNewCustomerProvince(provinceName);
    const province = provinceOptions.find((item) => item.name === provinceName);
    if (!province?.id) return;

    const districts = await getDistricts(province.id);
    setNewCustomerDistrictOptions(districts);

    const districtName = findBestDistrictName(addressOnly, districts);
    if (!districtName) {
      setNewCustomerAddressLine(addressOnly);
      setNewCustomerDistrict("");
      setNewCustomerWard("");
      setNewCustomerSmartAddressHint(
        "Đã lấy tên/sđt và nhận diện tỉnh / thành, cần kiểm tra thêm quận huyện."
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

    setNewCustomerAddressLine(cleanupDetailAddress(detail || addressOnly));

    const normalizedRaw = normalizeAddressToken(addressOnly);
    const aliasMatched = Object.keys(ADMIN_MERGE_ALIASES).some((key) =>
      normalizedRaw.includes(key)
    );

    setNewCustomerSmartAddressHint(
      wardName
        ? aliasMatched
          ? "Đã tự map tên người nhận, sđt và địa chỉ cũ sang địa chỉ sau sáp nhập."
          : "Đã tự nhận diện người nhận, sđt, tỉnh / huyện / xã."
        : "Đã lấy tên/sđt và nhận diện tỉnh / huyện, chưa chắc xã."
    );
  } catch {
    setNewCustomerAddressLine(raw);
    setNewCustomerSmartAddressHint(
      "Đã thử tách người nhận / sđt / địa chỉ nhưng chưa map hết."
    );
  } finally {
    setNewCustomerSmartAddressLoading(false);
  }
};
  useEffect(() => {
    if (customerDiscountPercent > 0 && subtotal > 0) {
      setDiscountTotal(String(Math.floor((subtotal * customerDiscountPercent) / 100)));
    }
  }, [subtotal, customerDiscountPercent]);

  const addVariantToOrder = (variantId: string) => {
    const found = allVariants.find((v) => v.id === variantId);
    if (!found) return;

    setLines((prev) => {
      const existing = prev.find((line) => line.variantId === variantId);
      if (existing) {
        return prev.map((line) =>
          line.variantId === variantId
            ? {
                ...line,
                qty: Math.min(line.qty + 1, line.stock || line.qty + 1),
              }
            : line
        );
      }

      return [
        ...prev,
        {
          variantId: found.id,
          sku: found.sku,
          productName: (found as any).productName,
          color: (found as any).color,
          size: (found as any).size,
          price: Number(found.price || 0),
          stock: Number((found as any).stock || 0),
          qty: 1,
          discount: 0,
          imageUrl: (found as any).imageUrl,
        },
      ];
    });
  };

  const handleBarcodeAdd = () => {
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;

    const found = allVariants.find(
      (v) =>
        String(v.sku || "").toLowerCase() === code ||
        String(v.sku || "").toLowerCase().includes(code)
    );

    if (!found) {
      setError(`Không tìm thấy SKU / mã vạch: ${barcodeInput}`);
      return;
    }

    addVariantToOrder(found.id);
    setBarcodeInput("");
    setError(null);
  };

  const updateLine = (variantId: string, patch: Partial<OrderLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.variantId !== variantId) return line;
        const next = { ...line, ...patch };
        if (next.qty < 1) next.qty = 1;
        if (next.qty > next.stock) next.qty = next.stock || 1;
        if (next.discount < 0) next.discount = 0;
        return next;
      })
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
    setSalesChannel("ADMIN");
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
    setShippingFee("0");
    setCouponCode("");
    setCustomerPaid("0");
    setShippingMode("partner");
    setShippingPayer("customer");
    setShippingUiMode("carrier");
    setShippingPartner("ghn");
    setDeliveryRequirement("CHOXEMHANG_KHONGTHU");
    setGhnDistrictId(undefined);
    setGhnWardCode(undefined);
    setSelectedShippingServiceId(undefined);
    setSelectedShippingServiceTypeId(undefined);
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
    setNewCustomerName("");
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
    if (!newCustomerName.trim()) {
      setNewCustomerError("Chưa nhập tên khách.");
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
        fullName: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim() || undefined,
        source: salesChannel,
        addressLine1: newCustomerAddressLine.trim() || undefined,
        addressLine2: newCustomerAddressLine2.trim() || undefined,
        ward: normalizeWardName(newCustomerWard),
        district: normalizeDistrictName(newCustomerDistrict),
        province: normalizeProvinceName(newCustomerProvince),
        postalCode: newCustomerPostalCode.trim() || undefined,
        recipientName:
          newCustomerRecipientName.trim() || newCustomerName.trim(),
        customerNote: newCustomerNote.trim() || undefined,
        label: "Địa chỉ giao hàng",
        isDefaultAddress: true,
      };

      const created: any = await createCustomer(payload);

      setCustomerId(created.id || null);
      setCustomerName(created.fullName || newCustomerName.trim());
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
          return current ? `${current}\n${newCustomerNote.trim()}` : newCustomerNote.trim();
        });
      }

      setCustomerHint(`Đã tạo và áp dụng khách mới: ${created.fullName}`);
      setCustomerPolicyLabel(String(created.pricePolicyName || ""));
      setCustomerDiscountPercent(Number(created.defaultDiscountPercent || 0));
      setNewCustomerOpen(false);
      resetNewCustomerForm();
    } catch (err) {
      setNewCustomerError(
        err instanceof Error ? err.message : "Không tạo được khách hàng."
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
        err instanceof Error ? err.message : "Không lưu được địa chỉ."
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
        err instanceof Error ? err.message : "Không đổi được địa chỉ mặc định."
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
    applyShippingRef.current = (payload: ShippingQuoteApplyPayload) => {
      setShippingFee(String(payload.shippingFee || 0));
      setShippingMode(payload.shippingMode === "pickup" ? "pickup" : "partner");
      setShippingPartner(payload.shippingPartner || "ghn");
      setSelectedShippingServiceId(payload.selectedServiceId);
      setSelectedShippingServiceTypeId(payload.selectedServiceTypeId);
      setShippingWeight(payload.weight);
      setShippingLength(payload.length);
      setShippingWidth(payload.width);
      setShippingHeight(payload.height);
      setGhnDistrictId(payload.ghnDistrictId);
      setGhnWardCode(payload.ghnWardCode);
    };
  }, []);

  useEffect(() => {
    if (shippingUiMode === "pickup") {
      setShippingFee("0");
      setShippingHint("Khách nhận tại cửa hàng nên không tính phí ship.");
      setShippingError("");
      setShippingQuotes([]);
      setSelectedShippingServiceId(undefined);
      setSelectedShippingServiceTypeId(undefined);
      setShippingMode("pickup");
      setShippingPartner("pickup");
      return;
    }

    if (shippingUiMode === "external") {
      setShippingHint("Đang dùng vận chuyển ngoài. Có thể nhập phí ship tay nếu cần.");
      setShippingError("");
      setShippingQuotes([]);
      setSelectedShippingServiceId(undefined);
      setSelectedShippingServiceTypeId(undefined);
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
      return;
    }

    if (shippingPartner !== "ghn") {
      setShippingHint("Hiện mới bật quote tự động cho GHN.");
      setShippingError("");
      setShippingQuotes([]);
      return;
    }

    const run = async () => {
      if (!quoteProvince || !quoteDistrict || !quoteWard) {
        setShippingQuotes([]);
        setSelectedShippingServiceId(undefined);
        setSelectedShippingServiceTypeId(undefined);
        setShippingError("");
        setShippingHint("Thiếu tỉnh/thành, quận/huyện hoặc xã/phường để tính phí ship.");
        return;
      }

      if (!quoteItems.length) {
        setShippingQuotes([]);
        setSelectedShippingServiceId(undefined);
        setSelectedShippingServiceTypeId(undefined);
        setShippingError("");
        setShippingHint("Cần có ít nhất 1 sản phẩm trong đơn để tính phí ship.");
        return;
      }

      try {
        setShippingLoading(true);
        setShippingError("");
        setShippingHint("Đang resolve địa chỉ GHN...");

        const resolved = await resolveGhnAddress({
          province: quoteProvince,
          district: quoteDistrict,
          ward: quoteWard,
        });

        if (!resolved?.districtId || !resolved?.wardCode) {
          throw new Error(
            `Không map được địa chỉ GHN. Province="${quoteProvince}", District="${quoteDistrict}", Ward="${quoteWard}".`
          );
        }

        setShippingHint("Đang lấy báo giá GHN...");

        const rows = await quoteShipment({
          toDistrictId: Number(resolved.districtId),
          toWardCode: String(resolved.wardCode),
          insuranceValue: customerMustPay,
          length: Number(shippingLength || 10),
          width: Number(shippingWidth || 10),
          height: Number(shippingHeight || 10),
          weight: Number(shippingWeight || 200),
          items: quoteItems,
        });

        const data = Array.isArray(rows) ? rows : [];
        setShippingQuotes(data);

        if (!data.length) {
          setShippingHint("GHN không trả về dịch vụ phù hợp cho địa chỉ này.");
          return;
        }

        const best = [...data].sort((a, b) => getFeeNumber(a) - getFeeNumber(b))[0];
        setSelectedShippingServiceId(best.serviceId);
        setSelectedShippingServiceTypeId(best.serviceTypeId);
        setShippingHint("Đã tự chọn dịch vụ GHN rẻ nhất.");
        applyShippingRef.current?.({
          shippingFee: getFeeNumber(best),
          shippingPartner: "ghn",
          shippingMode: "partner",
          selectedServiceId: best.serviceId,
          selectedServiceTypeId: best.serviceTypeId,
          weight: Number(shippingWeight || 200),
          length: Number(shippingLength || 10),
          width: Number(shippingWidth || 10),
          height: Number(shippingHeight || 10),
          ghnDistrictId: resolved.districtId,
          ghnWardCode: resolved.wardCode,
        });
      } catch (err) {
        setShippingQuotes([]);
        setSelectedShippingServiceId(undefined);
        setSelectedShippingServiceTypeId(undefined);
        setShippingHint("");
        setShippingError(
          err instanceof Error ? err.message : "Không lấy được phí ship."
        );
      } finally {
        setShippingLoading(false);
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 350);

    return () => clearTimeout(timer);
  }, [
    quoteProvince,
    quoteDistrict,
    quoteWard,
    quoteItems,
    customerMustPay,
    shippingLength,
    shippingWidth,
    shippingHeight,
    shippingWeight,
    shippingUiMode,
    shippingPartner,
  ]);

  const handleSubmit = async (mode: CreateOrderMode) => {
    const currentUser = getCurrentUserFromStorage();

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

    const invalidLine = lines.find((line) => line.qty < 1 || line.qty > line.stock);
    if (invalidLine) {
      setError(`Số lượng không hợp lệ cho ${invalidLine.sku}.`);
      return;
    }

    if (mode === "ship" && shippingUiMode === "carrier" && shippingPartner === "ghn") {
      if (!shippingAddress.trim()) {
        setError("Thiếu địa chỉ giao hàng.");
        return;
      }

      if (!ghnDistrictId || !ghnWardCode) {
        setError("Địa chỉ chưa map được GHN.");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage("");

      const extraNoteParts = [
        note.trim() ? `Ghi chú: ${note.trim()}` : "",
        shippingAddress.trim() ? `Địa chỉ: ${shippingAddress.trim()}` : "",
        tags.trim() ? `Tags: ${tags.trim()}` : "",
        couponCode.trim() ? `Mã giảm giá: ${couponCode.trim()}` : "",
        customerId ? `CustomerId: ${customerId}` : "",
        selectedAddressId ? `CustomerAddressId: ${selectedAddressId}` : "",
        customerPolicyLabel ? `Policy: ${customerPolicyLabel}` : "",
        customerDiscountPercent
          ? `Chiết khấu mặc định: ${customerDiscountPercent}%`
          : "",
        `Giảm giá tay: ${manualDiscount}`,
        `Giảm giá dòng: ${lineDiscountTotal}`,
        `Phí ship: ${fee}`,
        `Khách đã trả: ${paid}`,
        `Còn phải trả: ${remaining}`,
        `Kiểu vận chuyển UI: ${shippingUiMode}`,
        `Cách giao: ${shippingMode}`,
        `Đơn vị giao: ${shippingPartner}`,
        `Người trả ship: ${shippingPayer}`,
        `Yêu cầu giao hàng: ${requiredNoteLabel(deliveryRequirement)}`,
        selectedShippingServiceId ? `GHN ServiceId: ${selectedShippingServiceId}` : "",
        selectedShippingServiceTypeId
          ? `GHN ServiceTypeId: ${selectedShippingServiceTypeId}`
          : "",
        `Khối lượng: ${shippingWeight}g`,
        `Kích thước: ${shippingLength}x${shippingWidth}x${shippingHeight}`,
        ghnDistrictId ? `GHN DistrictId: ${ghnDistrictId}` : "",
        ghnWardCode ? `GHN WardCode: ${ghnWardCode}` : "",
      ].filter(Boolean);

const payload: CreateOrderPayload = {
  ...(customerId ? ({ customerId } as any) : {}),
  salesChannel: salesChannel as any,
  branchId,
  customerName: customerName.trim(),
  customerPhone: customerPhone.trim(),
  note: extraNoteParts.join(" | "),
  mode,
  items: lines.map((line) => ({
    variantId: line.variantId,
    qty: Number(line.qty),
  })),

  paymentSourceId,
  paidAmount: Number(customerPaid || 0),
  paymentNote: note,

        shippingSnapshot: {
          shippingAddressId: selectedAddress?.id || undefined,
          shippingRecipientName:
            selectedAddress?.recipientName || customerName.trim(),
          shippingPhone: selectedAddress?.phone || customerPhone.trim(),
          shippingAddressLine1:
            selectedAddress?.addressLine1 || addressLine1.trim() || shippingAddress.trim() || undefined,
          shippingAddressLine2:
            selectedAddress?.addressLine2 || addressLine2.trim() || undefined,
          shippingWard: quoteWard || undefined,
          shippingDistrict: quoteDistrict || undefined,
          shippingProvince: quoteProvince || undefined,
          shippingPostalCode: selectedAddress?.postalCode || addressPostalCode || undefined,
          shippingGhnDistrictId: ghnDistrictId ?? undefined,
          shippingGhnWardCode: ghnWardCode || undefined,
          shippingPartner,
          shippingPayer,
          requiredNote: mapRequiredNoteForGhn(deliveryRequirement),
          selectedServiceId: selectedShippingServiceId,
          selectedServiceTypeId: selectedShippingServiceTypeId,
          weight: shippingWeight,
          length: shippingLength,
          width: shippingWidth,
          height: shippingHeight,
        },
      };

const created = await createOrder(payload);

let ghnTrackingCode = "";

if (
  mode === "ship" &&
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
    toDistrictId: Number(ghnDistrictId),
    toWardCode: String(ghnWardCode),
    codAmount: remaining > 0 ? remaining : 0,
    insuranceValue: customerMustPay,
    note: note.trim() || "",
    requiredNote: mapRequiredNoteForGhn(deliveryRequirement),
    clientOrderCode: created.orderCode,
    content: `Đơn hàng ${created.orderCode}`,
    weight: shippingWeight,
    length: shippingLength,
    width: shippingWidth,
    height: shippingHeight,
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
          Number(shippingWeight || 200) / Math.max(lines.length, 1)
        )
      ),
      category: "Hàng hóa",
    })),
  });

  ghnTrackingCode =
    ghnCreated?.shipment?.trackingCode ||
    ghnCreated?.trackingCode ||
    ghnCreated?.ghn?.order_code ||
    ghnCreated?.ghn?.order_code_return ||
    "";
}

setModePickerOpen(false);

const nextSearch = new URLSearchParams({
  created: "1",
});

if (ghnTrackingCode) {
  nextSearch.set("tracking", ghnTrackingCode);
}

router.push(`/orders/${encodeURIComponent(created.id)}?${nextSearch.toString()}`);
return;

} catch (err: any) {
  setError(err?.message || "Tạo đơn thất bại.");
} finally {
  setSaving(false);
}
};

  const compactCustomerSummary = [customerName || "Khách lẻ", customerPhone || "", customerPolicyLabel || ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5 p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tạo đơn</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Sapo-style UI: tìm nhanh địa chỉ, quét mã vạch, quote GHN.
          </p>
        </div>

        {error ? (
          <Panel className="p-4">
            <p className="text-sm text-red-600">{error}</p>
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
                      <h3 className="text-lg font-semibold">Thông tin khách hàng</h3>
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
  if (customerPhone.trim()) {
    if (customerSuggestions.length) setCustomerSuggestionOpen(true);
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

                      {customerSuggestionOpen && customerSuggestions.length > 0 ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[280px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                          {customerSuggestions.map((item, index) => (
                            <button
                              key={`${item.id || item.phone || "customer"}-${index}`}
                              type="button"
                              onClick={() => void handlePickSuggestedCustomer(item)}
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
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          Địa chỉ giao hàng
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Chọn từ sổ địa chỉ khách hoặc tạo mới ngay tại đây.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => void openAddressSelector()}>
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
                    </div>

                    <div className="mb-3">
                      <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ thông minh</p>
                      <textarea
                        className="min-h-[84px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                        value={smartAddressInput}
                        onChange={(e) => setSmartAddressInput(e.target.value)}
                        onBlur={(e) => void handleSmartAddressApply(e.target.value)}
                        placeholder="Paste nguyên địa chỉ khách vào đây để tự map tỉnh / huyện / xã"
                      />
                      {smartAddressHint ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          {smartAddressLoading ? "Đang phân tích..." : smartAddressHint}
                        </p>
                      ) : null}
                    </div>

                    <textarea
                      className="min-h-[90px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Địa chỉ giao hàng"
                    />

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
                    <p className="mb-2 text-sm font-medium text-neutral-700">Kênh bán</p>
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
                    <p className="mb-2 text-sm font-medium text-neutral-700">Chi nhánh</p>
                    {branchLoading ? (
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                        Đang tải kho hàng...
                      </div>
                    ) : branchOptions.length <= 1 && !isOwnerUser(getCurrentUserFromStorage()) ? (
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
                      onChange={(e) => setShippingPayer(e.target.value as ShippingPayer)}
                    >
                      <option value="customer">Khách trả</option>
                      <option value="shop">Shop trả</option>
                    </select>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">Yêu cầu giao hàng</p>
                    <select
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={deliveryRequirement}
                      onChange={(e) =>
                        setDeliveryRequirement(e.target.value as DeliveryRequirement)
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
                    <h3 className="text-lg font-semibold">Sản phẩm trong đơn</h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Tìm sản phẩm, quét mã vạch / SKU và thêm nhanh vào đơn.
                    </p>
                  </div>
                  <div className="text-sm text-neutral-400">{lines.length} dòng sản phẩm</div>
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
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleBarcodeAdd();
                        }
                      }}
                    />
                    <Button onClick={handleBarcodeAdd}>Quét</Button>
                  </div>
                </div>

                <div className="mt-4 max-h-[260px] overflow-auto rounded-2xl border border-neutral-200">
                  {loadingProducts ? (
                    <div className="p-4 text-sm text-neutral-500">Đang tải sản phẩm...</div>
                  ) : filteredVariants.length === 0 ? (
                    <div className="p-4 text-sm text-neutral-500">Không có variant phù hợp.</div>
                  ) : (
                    filteredVariants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => addVariantToOrder(variant.id)}
                        className="flex w-full items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3 text-left transition hover:bg-neutral-50"
                      >
                        <div>
                          <p className="font-semibold text-neutral-900">{variant.sku}</p>
                          <p className="mt-1 text-sm text-neutral-700">
                            {(variant as any).productName}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {(variant as any).color || "—"} / {(variant as any).size || "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{currency((variant as any).price)}</p>
                          <p className="mt-1 text-xs text-neutral-500">Tồn {(variant as any).stock}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
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
                      const lineTotal = Math.max(0, line.price * line.qty - line.discount);
                      return (
                        <div
                          key={line.variantId}
                          className="grid grid-cols-[64px_72px_minmax(220px,1.4fr)_100px_120px_120px_140px_84px] items-center border-b border-neutral-200 px-4 py-4"
                        >
                          <div className="text-sm text-neutral-500">{index + 1}</div>

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
                            <p className="font-medium">{line.productName}</p>
                            <p className="mt-1 text-sm text-neutral-500">{line.sku}</p>
                            <p className="mt-1 text-xs text-neutral-400">
                              {line.color || "—"} / {line.size || "—"} · Tồn {line.stock}
                            </p>
                          </div>

                          <div>
                            <input
                              type="number"
                              min={1}
                              max={line.stock}
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

                          <div className="font-medium">{currency(lineTotal)}</div>

                          <div className="text-right">
                            <Button variant="secondary" onClick={() => removeLine(line.variantId)}>
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
                <h3 className="text-base font-semibold">Tags & ghi chú</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-neutral-700">Tags</p>
                    <textarea
                      className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="VD: VIP, chốt live, ưu tiên ship"
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
                      placeholder="VD: Hàng tặng gói riêng"
                    />
                  </div>
                </div>
              </Panel>

              <Panel className="p-4">
                <h3 className="text-base font-semibold">Giao hàng & khuyến mãi</h3>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-medium text-neutral-700">Mã giảm giá</p>
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
                    <div className="text-sm font-medium text-neutral-900">{item.label}</div>
                    <div className="mt-1 text-xs text-neutral-500">{item.description}</div>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-6">
                {shippingPartnerOptions.map((item) => (
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
                  <p className="mb-2 text-sm font-medium text-neutral-700">Khối lượng (g)</p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingWeight}
                    onChange={(e) => setShippingWeight(parseNumber(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-700">Dài (cm)</p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingLength}
                    onChange={(e) => setShippingLength(parseNumber(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-700">Rộng (cm)</p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingWidth}
                    onChange={(e) => setShippingWidth(parseNumber(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-700">Cao (cm)</p>
                  <input
                    className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                    value={shippingHeight}
                    onChange={(e) => setShippingHeight(parseNumber(e.target.value) || 0)}
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

              {shippingHint ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  {shippingHint}
                </div>
              ) : null}

              {shippingError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {shippingError}
                </div>
              ) : null}

              {shippingQuotes.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {shippingQuotes.map((quote) => {
                    const active = quote.serviceId === selectedShippingServiceId;
                    return (
                      <button
                        key={`${quote.serviceId}-${quote.serviceTypeId}`}
                        type="button"
                        onClick={() =>
                          applyShippingRef.current?.({
                            shippingFee: getFeeNumber(quote),
                            shippingPartner: "ghn",
                            shippingMode: "partner",
                            selectedServiceId: quote.serviceId,
                            selectedServiceTypeId: quote.serviceTypeId,
                            weight: Number(shippingWeight || 200),
                            length: Number(shippingLength || 10),
                            width: Number(shippingWidth || 10),
                            height: Number(shippingHeight || 10),
                            ghnDistrictId,
                            ghnWardCode,
                          })
                        }
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                          active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">
                            {(quote as any).shortName ||
                              (quote as any).serviceName ||
                              `Dịch vụ ${quote.serviceId}`}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            ServiceId: {quote.serviceId}
                            {quote.serviceTypeId ? ` · TypeId: ${quote.serviceTypeId}` : ""}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{currency(getFeeNumber(quote))}</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
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
                    <span>{shippingPartner}</span>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Tổng tiền hàng ({lines.length} SP)</span>
                    <span>{currency(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-500">Giảm giá</span>
                    <input
                      className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none"
                      value={discountTotal}
                      onChange={(e) => setDiscountTotal(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-500">Phí ship</span>
                    <input
                      className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none"
                      value={shippingFee}
                      onChange={(e) => setShippingFee(e.target.value)}
                    />
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
                      value={customerPaid}
                      onChange={(e) => setCustomerPaid(e.target.value)}
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
    {paymentSources.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
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
                  disabled={saving || !lines.length}
                >
                  {saving ? "Đang tạo..." : "Tạo đơn"}
                </Button>

                <Button variant="secondary" className="w-full" onClick={resetForm}>
                  Reset
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </form>

      <CreateModePicker
        open={modePickerOpen}
        onClose={() => setModePickerOpen(false)}
        onSelect={async (mode) => {
          setCreateMode(mode);
          await handleSubmit(mode);
        }}
      />

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
              <p className="mb-2 text-sm font-medium text-neutral-700">Tên khách</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Số điện thoại</p>
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
              <p className="mb-2 text-sm font-medium text-neutral-700">Người nhận</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerRecipientName}
                onChange={(e) => setNewCustomerRecipientName(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Mã khách</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerCode}
                onChange={(e) => setNewCustomerCode(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Postal code</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerPostalCode}
                onChange={(e) => setNewCustomerPostalCode(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ thông minh</p>
            <textarea
              className="min-h-[84px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={newCustomerSmartAddressInput}
              onChange={(e) => setNewCustomerSmartAddressInput(e.target.value)}
              onBlur={(e) => void handleNewCustomerSmartAddressApply(e.target.value)}
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
              <p className="mb-2 text-sm font-medium text-neutral-700">Tỉnh / Thành</p>
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerProvince}
                onChange={(e) => setNewCustomerProvince(e.target.value)}
              >
                {provinceSelectOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Quận / Huyện</p>
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerDistrict}
                onChange={(e) => setNewCustomerDistrict(e.target.value)}
              >
                <option value="">Chọn quận / huyện</option>
                {newCustomerDistrictSelectOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Xã / Phường</p>
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerWard}
                onChange={(e) => setNewCustomerWard(e.target.value)}
              >
                <option value="">Chọn xã / phường</option>
                {newCustomerWardSelectOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ cụ thể</p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerAddressLine}
                onChange={(e) => setNewCustomerAddressLine(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ dòng 2</p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerAddressLine2}
                onChange={(e) => setNewCustomerAddressLine2(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Tags</p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerTags}
                onChange={(e) => setNewCustomerTags(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Ghi chú</p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={newCustomerNote}
                onChange={(e) => setNewCustomerNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setNewCustomerOpen(false)}>
              Đóng
            </Button>
            <Button onClick={() => void createNewCustomerAndApply()} disabled={newCustomerSaving}>
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
                      isActive ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
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

                        <div className="text-sm text-neutral-500">{formatAddress(address)}</div>
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

                        <Button variant="ghost" onClick={() => openEditAddressModal(address)}>
                          Sửa
                        </Button>

                        {!address.isDefault ? (
                          <Button
                            variant="ghost"
                            onClick={() => void handleSetDefaultAddress(address.id)}
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
            <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ thông minh</p>
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
              <p className="mb-2 text-sm font-medium text-neutral-700">Nhãn địa chỉ</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Người nhận</p>
              <input
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressRecipientName}
                onChange={(e) => setAddressRecipientName(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Số điện thoại</p>
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
              <p className="mb-2 text-sm font-medium text-neutral-700">Tỉnh / Thành</p>
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressProvince}
                onChange={(e) => setAddressProvince(e.target.value)}
              >
                {provinceSelectOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Quận / Huyện</p>
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressDistrict}
                onChange={(e) => setAddressDistrict(e.target.value)}
              >
                <option value="">Chọn quận / huyện</option>
                {addressDistrictSelectOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Xã / Phường</p>
              <select
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressWard}
                onChange={(e) => setAddressWard(e.target.value)}
              >
                <option value="">Chọn xã / phường</option>
                {addressWardSelectOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ cụ thể</p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Địa chỉ dòng 2</p>
              <textarea
                className="min-h-[88px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">Postal code</p>
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
            <Button variant="secondary" onClick={() => setAddressEditorOpen(false)}>
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