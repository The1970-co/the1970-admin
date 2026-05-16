"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  quoteShipment,
  quoteAhamoveShipment,
  quoteViettelPostShipment,
  resolveGhnAddress,
  getViettelPostInventories,
  type ShipmentQuoteResult,
  type ViettelPostInventory,
} from "@/lib/create-order-api";

type PaymentRow = {
  id?: string;
  method?: string | null;
  amount?: number | string | null;
  sourceName?: string | null;
  paymentSourceId?: string | null;
  paymentSource?: {
    id?: string | null;

    name?: string | null;
    code?: string | null;
    type?: string | null;
  } | null;
};

type OrderItem = {
  id: string;
  variantId?: string | null;
  sku?: string | null;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderDetail = {
  id: string;
  orderCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  branchId?: string | null;
  createdByStaffName?: string | null;
  createdByStaffId?: string | null;
  salesChannel?: string | null;
  soldAt?: string | null;
  createdAt?: string | null;
  totalAmount?: number;
  finalAmount?: number;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  status?: string | null;
  payments?: PaymentRow[];
  items?: OrderItem[];
  isReturnable?: boolean;
  shippingRecipientName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingWard?: string | null;
  shippingDistrict?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;
  shippingGhnDistrictId?: number | string | null;
  shippingGhnWardCode?: string | null;
  note?: string | null;
};

type BranchOption = {
  id: string;
  name: string;
  code?: string;
};

type PaymentSource = {
  id: string;
  name: string;
  code?: string;
  type?: string;
  branchId?: string | null;
  isActive?: boolean;
};

type ReturnLine = OrderItem & {
  returnQty: number;
  reason: string;
  alreadyReturnedQty?: number;
  maxReturnQty?: number;
};

type ExchangeLine = {
  id: string;
  variantId?: string | null;
  sku?: string | null;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  price: number;
  stock?: number;
  qty: number;
};

type ExchangeShippingQuote = ShipmentQuoteResult & {
  _carrier?: "ghn" | "ahamove" | "viettelpost" | string;
  _quoteKey?: string;
  _serviceName?: string;
  _leadtimeLabel?: string;
  _badges?: string[];
  _applyFeeToInput?: boolean;
  _ghnDistrictId?: number;
  _ghnWardCode?: string;
  _ahamoveServiceId?: string;
  _viettelServiceCode?: string;
  _fee?: number;
};

const CARRIER_ORDER = ["ghn", "viettelpost", "ahamove"];

function normalizeCarrierCode(value?: string | null) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (raw.includes("viettel") || raw === "vtp") return "viettelpost";
  if (raw.includes("aha")) return "ahamove";
  return "ghn";
}

function carrierLabel(value?: string | null) {
  const code = normalizeCarrierCode(value);
  if (code === "viettelpost") return "Viettel Post";
  if (code === "ahamove") return "AhaMove";
  return "GHN";
}

function getQuoteFee(row?: any) {
  if (!row) return 0;
  return Number(
    row?._fee ||
      row?.fee?.total ||
      row?.fee?.total_fee ||
      row?.fee?.service_fee ||
      row?.data?.user_price_details?.total_fee ||
      row?.data?.user_price_details?.total_price ||
      row?.data?.total_price ||
      row?.data?.total_fee ||
      row?.data?.service_fee ||
      row?.totalFee ||
      row?.total_fee ||
      row?.totalPrice ||
      row?.total_price ||
      row?.fee ||
      0,
  );
}

function getQuoteCarrier(row?: any) {
  return normalizeCarrierCode(
    row?._carrier || row?.carrier || row?.provider || "ghn",
  );
}

function getQuoteKey(row: any) {
  const carrier = getQuoteCarrier(row);

  return String(
    row?._quoteKey ||
      row?._ahamoveServiceId ||
      row?.service_id ||
      row?.serviceId ||
      row?._viettelServiceCode ||
      row?.serviceCode ||
      [
        carrier,
        row?.serviceId || 0,
        row?.serviceTypeId || 0,
        row?._serviceName || row?.shortName || row?.serviceName || "",
        row?._leadtimeLabel || "",
        getQuoteFee(row) || "",
      ].join("-"),
  );
}

function getQuoteDisplayName(row: any) {
  const carrier = getQuoteCarrier(row);
  const rawName =
    row?._serviceName ||
    row?.shortName ||
    row?.serviceName ||
    row?.name ||
    row?.service_id ||
    row?._viettelServiceCode ||
    row?.serviceCode ||
    "Dịch vụ";

  return `${carrierLabel(carrier)} - ${rawName}`;
}

function getQuoteLeadtimeLabel(row: any) {
  if (row?._leadtimeLabel) return String(row._leadtimeLabel);
  if (row?.leadtime?.label) return String(row.leadtime.label);

  const from =
    row?.leadtime?.from_estimate_date || row?.leadtime?.fromEstimateDate;
  const to = row?.leadtime?.to_estimate_date || row?.leadtime?.toEstimateDate;
  if (from || to) return [from, to].filter(Boolean).join(" → ");

  const durationMinutes = Number(row?._durationMinutes || row?.duration || 0);
  if (durationMinutes) {
    if (durationMinutes < 60) return `${durationMinutes} phút`;
    return `${Math.round((durationMinutes / 60) * 10) / 10} giờ`;
  }

  return "Đang cập nhật";
}

type ShippingUiMode = "carrier" | "external" | "pickup" | "schedule";

const shippingUiModeOptions: Array<{
  value: ShippingUiMode;
  label: string;
  description: string;
}> = [
  {
    value: "carrier",
    label: "Đẩy qua hãng vận chuyển",
    description:
      "Chọn GHN hoặc AhaMove hoặc Viettel Post để lấy phí ship và đẩy đơn.",
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

const shippingPartnerOptions: Array<{
  value: string;
  label: string;
  enabled: boolean;
}> = [
  { value: "ghn", label: "GHN", enabled: true },
  { value: "ghtk", label: "GHTK", enabled: false },
  { value: "viettelpost", label: "Viettel Post", enabled: true },
  { value: "grab", label: "Grab Express", enabled: false },
  { value: "ahamove", label: "AhaMove", enabled: true },
  { value: "outside", label: "Vận chuyển ngoài", enabled: false },
];

const carrierMetaMap: Record<
  string,
  { name: string; short: string; sub: string; accent: string; soft: string }
> = {
  ghn: {
    name: "GHN",
    short: "GHN",
    sub: "Giao hàng nhanh",
    accent: "border-orange-200 bg-orange-50 text-orange-700",
    soft: "bg-orange-50/55",
  },
  viettelpost: {
    name: "Viettel Post",
    short: "VTP",
    sub: "Viettel Post",
    accent: "border-red-200 bg-red-50 text-red-700",
    soft: "bg-red-50/45",
  },
  ahamove: {
    name: "AhaMove",
    short: "AHA",
    sub: "Nội thành / tài xế tức thì",
    accent: "border-blue-200 bg-blue-50 text-blue-700",
    soft: "bg-blue-50/55",
  },
};

function getQuoteMeta(rowOrCarrier?: any) {
  const carrier =
    typeof rowOrCarrier === "string"
      ? normalizeCarrierCode(rowOrCarrier)
      : getQuoteCarrier(rowOrCarrier);
  return carrierMetaMap[carrier] || carrierMetaMap.ghn;
}

function getQuoteServiceCleanName(row: any) {
  const raw =
    row?._serviceName ||
    row?.shortName ||
    row?.serviceName ||
    row?.name ||
    row?.service_id ||
    row?._viettelServiceCode ||
    row?.serviceCode ||
    "Dịch vụ";

  return String(raw)
    .replace(/^(GHN|AhaMove|Viettel Post)\s*[-·]\s*/i, "")
    .trim();
}

function getSmartQuoteNote(row: any) {
  const carrier = getQuoteCarrier(row);
  if (carrier === "ahamove") return "Ưu tiên tốc độ giao hàng";
  if (carrier === "viettelpost") return "Phù hợp tuyến tỉnh / liên tỉnh";
  return "Cân bằng tốt giữa phí và độ ổn định";
}

function getQuoteBadges(row: any) {
  return Array.isArray(row?._badges) ? row._badges : [];
}

function uniqQuotes(rows: ExchangeShippingQuote[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getQuoteKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function parseStructuredNoteValue(note?: string | null, prefix?: string) {
  if (!note || !prefix) return "";

  const parts = String(note)
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  const found = parts.find((item) => item.startsWith(prefix));
  return found ? found.replace(prefix, "").trim() : "";
}

function buildOrderFullAddress(order?: OrderDetail | null) {
  if (!order) return "";

  const structured = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    order.shippingWard,
    order.shippingDistrict,
    order.shippingProvince,
    order.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    structured ||
    parseStructuredNoteValue(order.note, "Địa chỉ:") ||
    parseStructuredNoteValue(order.note, "Dia chi:") ||
    ""
  );
}

function getCustomerCheckRows(order?: OrderDetail | null) {
  const fullAddress = buildOrderFullAddress(order);
  return [
    { label: "Khách hàng", value: order?.customerName || "—" },
    { label: "SĐT khách", value: order?.customerPhone || "—" },
    {
      label: "Người nhận",
      value: order?.shippingRecipientName || order?.customerName || "—",
    },
    {
      label: "SĐT nhận",
      value: order?.shippingPhone || order?.customerPhone || "—",
    },
    { label: "Địa chỉ giao", value: fullAddress || "—" },
    {
      label: "Ghi chú giao",
      value:
        parseStructuredNoteValue(order?.note, "Ghi chú giao hàng:") ||
        parseStructuredNoteValue(order?.note, "Ghi chú:") ||
        "—",
    },
  ];
}

function buildQuoteItems(lines: ExchangeLine[]) {
  const itemWeight = Math.max(200, Math.round(500 / Math.max(lines.length, 1)));
  return lines.map((line) => ({
    name: line.productName || line.sku || "Sản phẩm đổi",
    quantity: Math.max(1, Number(line.qty || 1)),
    num: Math.max(1, Number(line.qty || 1)),
    price: Number(line.price || 0),
    length: 20,
    width: 20,
    height: 5,
    weight: itemWeight,
  }));
}

function money(value?: number | string | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function apiGet(path: string) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Không tải được dữ liệu.");
  }

  return json;
}

async function apiPost(path: string, body: any) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Không lưu được phiếu đổi trả.");
  }

  return json;
}

function normalizeRows(input: any) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.items)) return input.items;
  if (Array.isArray(input?.rows)) return input.rows;
  return [];
}

function isReturnableOrder(order: OrderDetail | null) {
  if (!order) return false;

  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();
  const fulfillmentStatus = String(order.fulfillmentStatus || "").toUpperCase();

  return (
    order.isReturnable === true ||
    status === "COMPLETED" ||
    fulfillmentStatus === "FULFILLED" ||
    (paymentStatus === "PAID" && fulfillmentStatus !== "UNFULFILLED")
  );
}

export default function ReturnCreatePageClient({
  orderId,
}: {
  orderId: string;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);

  const [receiveBranchId, setReceiveBranchId] = useState("");
  const [exchangeIssueBranchId, setExchangeIssueBranchId] = useState("");

  const [refundPaymentSourceId, setRefundPaymentSourceId] = useState("");
  const [extraChargePaymentSourceId, setExtraChargePaymentSourceId] =
    useState("");

  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [exchangeLines, setExchangeLines] = useState<ExchangeLine[]>([]);

  const [exchangeSearch, setExchangeSearch] = useState("");
  const [exchangeResults, setExchangeResults] = useState<ExchangeLine[]>([]);
  const [searchingExchange, setSearchingExchange] = useState(false);

  const [note, setNote] = useState("");
  const [shippingFeeInput, setShippingFeeInput] = useState("30000");
  const [shippingUiMode, setShippingUiMode] =
    useState<ShippingUiMode>("carrier");
  const [shippingPartner, setShippingPartner] = useState("ghn");
  const [shippingWeight, setShippingWeight] = useState(200);
  const [shippingLength, setShippingLength] = useState(10);
  const [shippingWidth, setShippingWidth] = useState(10);
  const [shippingHeight, setShippingHeight] = useState(10);
  const [shippingQuotes, setShippingQuotes] = useState<ExchangeShippingQuote[]>(
    [],
  );
  const [selectedShippingQuoteKey, setSelectedShippingQuoteKey] = useState("");
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState("");
  const lastAutoQuoteKeyRef = useRef("");
  const [viettelInventories, setViettelInventories] = useState<
    ViettelPostInventory[]
  >([]);
  const [statusMode, setStatusMode] = useState<"COMPLETED" | "DRAFT">(
    "COMPLETED",
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const branchName = (id?: string | null) => {
    if (!id) return "—";
    return branches.find((branch) => branch.id === id)?.name || id;
  };

  const activePaymentSources = useMemo(() => {
    return paymentSources.filter((source) => source.isActive !== false);
  }, [paymentSources]);

  const paymentSourcesForBranch = (targetBranchId: string) => {
    if (!targetBranchId) return activePaymentSources;

    const targetBranch = branches.find(
      (branch) => branch.id === targetBranchId,
    );
    const targetCode = targetBranch?.code || targetBranch?.id || targetBranchId;
    const targetName = targetBranch?.name || targetBranchId;

    return activePaymentSources.filter((source) => {
      const sourceBranch = source.branchId || "";
      if (!sourceBranch) return true;

      return (
        String(sourceBranch) === String(targetBranchId) ||
        String(sourceBranch) === String(targetCode) ||
        normalizeText(sourceBranch) === normalizeText(targetName) ||
        normalizeText(sourceBranch) === "all" ||
        normalizeText(sourceBranch) === "tat ca"
      );
    });
  };

  const refundPaymentSources = useMemo(() => {
    return paymentSourcesForBranch(receiveBranchId);
  }, [activePaymentSources, branches, receiveBranchId]);

  const extraChargePaymentSources = useMemo(() => {
    // Thu thêm là tiền đi vào quầy/chi nhánh xử lý, không phụ thuộc kho xuất hàng đổi.
    return paymentSourcesForBranch(receiveBranchId);
  }, [activePaymentSources, branches, receiveBranchId]);

  const returnTotal = useMemo(() => {
    return returnLines.reduce((sum, line) => {
      return sum + toNumber(line.unitPrice) * toNumber(line.returnQty);
    }, 0);
  }, [returnLines]);

  const exchangeTotal = useMemo(() => {
    return exchangeLines.reduce((sum, line) => {
      return sum + toNumber(line.price) * toNumber(line.qty);
    }, 0);
  }, [exchangeLines]);

  const selectedShippingQuote = useMemo(() => {
    return (
      shippingQuotes.find(
        (row) => getQuoteKey(row) === selectedShippingQuoteKey,
      ) || null
    );
  }, [shippingQuotes, selectedShippingQuoteKey]);

  const selectedQuoteFee = useMemo(
    () => getQuoteFee(selectedShippingQuote),
    [selectedShippingQuote],
  );

  const quoteProvince =
    order?.shippingProvince ||
    parseStructuredNoteValue(order?.note, "Tỉnh / Thành:") ||
    "—";
  const quoteDistrict =
    order?.shippingDistrict ||
    parseStructuredNoteValue(order?.note, "Quận / Huyện:") ||
    "—";
  const quoteWard =
    order?.shippingWard ||
    parseStructuredNoteValue(order?.note, "Xã / Phường:") ||
    "—";
  const shippingAddressText = buildOrderFullAddress(order) || "—";

  const autoQuoteKey = useMemo(() => {
    if (!order?.id || !exchangeLines.length) return "";
    const toAddress = buildOrderFullAddress(order);
    if (!toAddress) return "";

    return JSON.stringify({
      orderId: order.id,
      items: exchangeLines.map((line) => ({
        variantId: line.variantId,
        sku: line.sku,
        qty: Number(line.qty || 0),
        price: Number(line.price || 0),
      })),
      address: toAddress,
      province: order.shippingProvince || "",
      district: order.shippingDistrict || "",
      ward: order.shippingWard || "",
      ghnDistrictId: order.shippingGhnDistrictId || "",
      ghnWardCode: order.shippingGhnWardCode || "",
      weight: shippingWeight,
      length: shippingLength,
      width: shippingWidth,
      height: shippingHeight,
    });
  }, [
    order?.id,
    order?.shippingAddressLine1,
    order?.shippingAddressLine2,
    order?.shippingWard,
    order?.shippingDistrict,
    order?.shippingProvince,
    order?.shippingPostalCode,
    order?.shippingGhnDistrictId,
    order?.shippingGhnWardCode,
    exchangeLines,
    shippingWeight,
    shippingLength,
    shippingWidth,
    shippingHeight,
  ]);

  const groupedQuotes = useMemo(() => {
    const map = new Map<string, ExchangeShippingQuote[]>();
    uniqQuotes(shippingQuotes).forEach((row) => {
      const carrier = getQuoteCarrier(row);
      const list = map.get(carrier) || [];
      list.push(row);
      map.set(carrier, list);
    });

    return Array.from(map.entries())
      .sort((a, b) => CARRIER_ORDER.indexOf(a[0]) - CARRIER_ORDER.indexOf(b[0]))
      .map(([carrier, quotes]) => ({
        carrier,
        meta: getQuoteMeta(carrier),
        quotes: quotes.sort((a, b) => getQuoteFee(a) - getQuoteFee(b)),
      }));
  }, [shippingQuotes]);

  const highlightQuotes = useMemo(() => {
    const sorted = uniqQuotes(shippingQuotes)
      .filter((row) => getQuoteFee(row) > 0)
      .sort((a, b) => getQuoteFee(a) - getQuoteFee(b));

    if (!sorted.length)
      return [] as Array<{
        key: string;
        title: string;
        tone: string;
        quote: ExchangeShippingQuote;
      }>;

    const cheapest = sorted[0];
    const fastest =
      sorted.find((row) => getQuoteCarrier(row) === "ahamove") || sorted[0];
    const recommended =
      sorted.find((row) => getQuoteCarrier(row) === "ghn") || cheapest;

    const picks = [
      {
        key: "recommended",
        title: "Khuyến dùng",
        tone: "orange",
        quote: recommended,
      },
      { key: "cheapest", title: "Rẻ nhất", tone: "emerald", quote: cheapest },
      { key: "fastest", title: "Nhanh nhất", tone: "blue", quote: fastest },
    ];

    const seen = new Set<string>();
    return picks.filter((item) => {
      const key = item.key + getQuoteKey(item.quote);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [shippingQuotes]);

  const quoteInsight = useMemo(() => {
    if (!selectedShippingQuote) {
      return {
        label: "Chưa chọn gói vận chuyển.",
        className: "border-neutral-200 bg-neutral-50 text-neutral-600",
      };
    }

    const selectedFee = getQuoteFee(selectedShippingQuote);
    const customerFee = toNumber(shippingFeeInput);
    const diff = customerFee - selectedFee;

    if (diff > 0) {
      return {
        label: `Khách trả dư ${money(diff)} so với phí hãng.`,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (diff < 0) {
      return {
        label: `Shop đang bù ${money(Math.abs(diff))} phí vận chuyển.`,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    return {
      label: "Phí khách trả đang khớp với gói vận chuyển đã chọn.",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }, [selectedShippingQuote, shippingFeeInput]);

  const shippingFee = useMemo(() => {
    return exchangeLines.length ? Math.max(0, toNumber(shippingFeeInput || 0)) : 0;
  }, [exchangeLines.length, shippingFeeInput]);

  // Tiền khách cần trả cho đơn đổi mới = hàng đổi + phí ship - hàng trả.
  const customerPayableAmount = Math.max(
    0,
    exchangeTotal + shippingFee - returnTotal,
  );
  const differenceAmount = returnTotal - exchangeTotal - shippingFee;
  const refundAmount = differenceAmount > 0 ? differenceAmount : 0;
  const extraChargeAmount = customerPayableAmount;

  const selectedReturnQty = useMemo(() => {
    return returnLines.reduce((sum, line) => sum + toNumber(line.returnQty), 0);
  }, [returnLines]);

  const selectedExchangeQty = useMemo(() => {
    return exchangeLines.reduce((sum, line) => sum + toNumber(line.qty), 0);
  }, [exchangeLines]);

  const canSubmit = useMemo(() => {
    if (!order) return false;
    if (!isReturnableOrder(order)) return false;
    if (saving) return false;
    if (!receiveBranchId) return false;
    if (selectedReturnQty <= 0 && selectedExchangeQty <= 0) return false;
    if (refundAmount > 0 && !refundPaymentSourceId) return false;
    if (extraChargeAmount > 0 && !extraChargePaymentSourceId) return false;
    return true;
  }, [
    order,
    saving,
    receiveBranchId,
    selectedReturnQty,
    selectedExchangeQty,
    refundAmount,
    extraChargeAmount,
    refundPaymentSourceId,
    extraChargePaymentSourceId,
  ]);

  const canShipSubmit = useMemo(() => {
    if (!order) return false;
    if (!isReturnableOrder(order)) return false;
    if (saving) return false;
    if (!receiveBranchId) return false;
    if (selectedReturnQty <= 0 && selectedExchangeQty <= 0) return false;
    if (selectedExchangeQty <= 0) return false;
    if (refundAmount > 0 && !refundPaymentSourceId) return false;
    return true;
  }, [
    order,
    saving,
    receiveBranchId,
    selectedReturnQty,
    selectedExchangeQty,
    refundAmount,
    refundPaymentSourceId,
  ]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        if (!orderId) {
          throw new Error("Thiếu orderId.");
        }

        const [orderJson, branchJson, paymentJson] = await Promise.all([
          apiGet(`/returns/source-order/${encodeURIComponent(orderId)}`),
          apiGet("/branches").catch(() => []),
          apiGet("/payment-sources").catch(() => []),
        ]);

        const sourceDetail: OrderDetail =
          orderJson?.data || orderJson?.order || orderJson;

        // Source-order dùng riêng cho đổi/trả, nhưng một số bản backend cũ chưa trả đủ
        // shippingAddressLine1 / shippingWard / shippingDistrict / shippingProvince / GHN ids.
        // Gọi thêm chi tiết đơn thường để merge địa chỉ, tránh màn báo giá HVC bị trống địa chỉ.
        const fullOrderJson = sourceDetail?.id
          ? await apiGet(
              `/orders/${encodeURIComponent(sourceDetail.id)}`,
            ).catch(() => null)
          : null;
        const fullOrder: Partial<OrderDetail> =
          fullOrderJson?.data || fullOrderJson?.order || fullOrderJson || {};
        const detail: OrderDetail = {
          ...sourceDetail,
          ...Object.fromEntries(
            Object.entries(fullOrder).filter(
              ([, value]) =>
                value !== undefined && value !== null && value !== "",
            ),
          ),
          // Giữ items/payments từ source-order vì đã được tính max trả / dữ liệu đổi trả chuẩn hơn.
          items:
            Array.isArray(sourceDetail?.items) && sourceDetail.items.length
              ? sourceDetail.items
              : fullOrder.items,
          payments:
            Array.isArray(sourceDetail?.payments) &&
            sourceDetail.payments.length
              ? sourceDetail.payments
              : fullOrder.payments,
        } as OrderDetail;

        const branchRows = normalizeRows(branchJson);
        const paymentRows = normalizeRows(paymentJson);

        const normalizedBranches = branchRows
          .map((row: any) => ({
            id: String(row.id || row.code || ""),
            name: String(
              row.name || row.displayName || row.code || "Chi nhánh",
            ),
            code: row.code ? String(row.code) : undefined,
          }))
          .filter((row: BranchOption) => row.id);

        const normalizedSources = paymentRows
          .map((row: any) => ({
            id: String(row.id || ""),
            name: String(row.name || row.label || row.code || "Nguồn tiền"),
            code: row.code ? String(row.code) : undefined,
            type: row.type ? String(row.type) : undefined,
            branchId: row.branchId ? String(row.branchId) : null,
            isActive: row.isActive !== false,
          }))
          .filter((row: PaymentSource) => row.id);

        setOrder(detail);
        setBranches(normalizedBranches);
        setPaymentSources(normalizedSources);

        setReceiveBranchId(detail.branchId || "");
        setExchangeIssueBranchId(detail.branchId || "");

        const items = Array.isArray(detail.items) ? detail.items : [];

        setReturnLines(
          items.map((item) => ({
            ...item,
            returnQty: Number(item.qty || 0),
            reason: "Khách trả hàng",
            alreadyReturnedQty: 0,
            maxReturnQty: Number(item.qty || 0),
          })),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được phiếu đổi trả.",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [orderId]);

  useEffect(() => {
    getViettelPostInventories()
      .then((rows) => setViettelInventories(Array.isArray(rows) ? rows : []))
      .catch(() => setViettelInventories([]));
  }, []);

  useEffect(() => {
    if (!exchangeLines.length) {
      setShippingQuotes([]);
      setSelectedShippingQuoteKey("");
      setShippingQuoteError("");
      return;
    }

    if (!selectedShippingQuoteKey && shippingQuotes.length) {
      const sorted = [...shippingQuotes].sort((a, b) => {
        const carrierA = getQuoteCarrier(a);
        const carrierB = getQuoteCarrier(b);
        if (carrierA !== carrierB) {
          return (
            CARRIER_ORDER.indexOf(carrierA) - CARRIER_ORDER.indexOf(carrierB)
          );
        }
        return getQuoteFee(a) - getQuoteFee(b);
      });

      const recommended = sorted[0];
      if (recommended) {
        setSelectedShippingQuoteKey(getQuoteKey(recommended));
        setShippingPartner(getQuoteCarrier(recommended));
      }
    }
  }, [exchangeLines.length, shippingQuotes, selectedShippingQuoteKey]);

  useEffect(() => {
    if (!selectedShippingQuote) return;

    const carrier = getQuoteCarrier(selectedShippingQuote);

    setShippingPartner(carrier);
  }, [selectedShippingQuote]);

  useEffect(() => {
    if (refundAmount <= 0) return;
    const stillValid = refundPaymentSources.some(
      (source) => String(source.id) === String(refundPaymentSourceId),
    );

    if (refundPaymentSourceId && stillValid) return;

    setRefundPaymentSourceId(refundPaymentSources[0]?.id || "");
  }, [refundAmount, refundPaymentSourceId, refundPaymentSources]);

  useEffect(() => {
    if (extraChargeAmount <= 0) return;
    const stillValid = extraChargePaymentSources.some(
      (source) => String(source.id) === String(extraChargePaymentSourceId),
    );

    if (extraChargePaymentSourceId && stillValid) return;

    setExtraChargePaymentSourceId(extraChargePaymentSources[0]?.id || "");
  }, [
    extraChargeAmount,
    extraChargePaymentSourceId,
    extraChargePaymentSources,
  ]);

  useEffect(() => {
    const keyword = exchangeSearch.trim();

    if (keyword.length < 2) {
      setExchangeResults([]);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setSearchingExchange(true);

        const token = getToken();

        const res = await fetch(
          `${API_BASE}/products?q=${encodeURIComponent(keyword)}`,
          {
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          },
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setExchangeResults([]);
          return;
        }

        const productRows = normalizeRows(json);
        const variants: ExchangeLine[] = [];

        productRows.forEach((product: any) => {
          const productName = String(
            product.name || product.productName || "Sản phẩm",
          );

          const productVariants = Array.isArray(product.variants)
            ? product.variants
            : Array.isArray(product.productVariants)
              ? product.productVariants
              : [];

          if (productVariants.length) {
            productVariants.forEach((variant: any) => {
              variants.push({
                id: String(variant.id || ""),
                sku: String(variant.sku || ""),
                productName: String(variant.productName || productName),
                color: variant.color || variant.colorName || "",
                size: variant.size || variant.sizeName || "",
                price: Number(
                  variant.priceVnd || variant.price || product.price || 0,
                ),
                stock: Number(variant.stock || variant.availableQty || 0),
                qty: 1,
              });
            });
          } else if (product.id) {
            variants.push({
              id: String(product.variantId || product.id),
              sku: String(product.sku || ""),
              productName,
              color: product.color || "",
              size: product.size || "",
              price: Number(product.priceVnd || product.price || 0),
              stock: Number(product.stock || product.availableQty || 0),
              qty: 1,
            });
          }
        });

        setExchangeResults(variants.filter((item) => item.id).slice(0, 20));
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setExchangeResults([]);
        }
      } finally {
        setSearchingExchange(false);
      }
    };

    const timer = window.setTimeout(run, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [exchangeSearch]);

  const updateReturnQty = (itemId: string, value: number) => {
    setReturnLines((prev) =>
      prev.map((line) => {
        if (line.id !== itemId) return line;

        const maxQty = Number(line.maxReturnQty ?? line.qty ?? 0);
        const safeQty = Math.max(0, Math.min(Number(value || 0), maxQty));

        return {
          ...line,
          returnQty: safeQty,
        };
      }),
    );
  };

  const addExchangeLine = (variant: ExchangeLine) => {
    setExchangeLines((prev) => {
      const existed = prev.find((line) => line.id === variant.id);

      if (existed) {
        return prev.map((line) =>
          line.id === variant.id
            ? {
                ...line,
                qty: Number(line.qty || 0) + 1,
              }
            : line,
        );
      }

      return [
        ...prev,
        {
          ...variant,
          qty: 1,
        },
      ];
    });

    setExchangeSearch("");
    setExchangeResults([]);
  };

  const updateExchangeQty = (variantId: string, value: number) => {
    setExchangeLines((prev) =>
      prev.map((line) =>
        line.id === variantId
          ? {
              ...line,
              qty: Math.max(1, Number(value || 1)),
            }
          : line,
      ),
    );
  };

  const removeExchangeLine = (variantId: string) => {
    setExchangeLines((prev) => prev.filter((line) => line.id !== variantId));
  };

  const validateBeforeSubmit = (forShipping = false) => {
    if (!order) {
      return "Không có đơn gốc.";
    }

    if (!isReturnableOrder(order)) {
      return "Đơn này chưa đủ điều kiện đổi/trả. Chỉ xử lý khi đơn đã hoàn thành/đã giao/đã thanh toán hợp lệ.";
    }

    if (!receiveBranchId) {
      return "Chưa chọn chi nhánh/kho nhận hàng trả.";
    }

    if (selectedReturnQty <= 0 && selectedExchangeQty <= 0) {
      return "Chưa có sản phẩm trả hoặc sản phẩm đổi.";
    }

    const invalidReturn = returnLines.find(
      (line) =>
        Number(line.returnQty || 0) >
        Number(line.maxReturnQty ?? line.qty ?? 0),
    );

    if (invalidReturn) {
      return `Sản phẩm ${invalidReturn.sku || invalidReturn.productName || ""} vượt số lượng được trả.`;
    }

    if (refundAmount > 0 && !refundPaymentSourceId) {
      return "Chưa chọn nguồn tiền hoàn khách.";
    }

    if (!forShipping && extraChargeAmount > 0 && !extraChargePaymentSourceId) {
      return "Chưa chọn nguồn tiền khách bù thêm.";
    }

    if (forShipping && exchangeLines.length && !selectedShippingQuote) {
      return "Chưa chọn gói vận chuyển HVC. Bấm lấy báo giá rồi chọn một gói trước khi gửi.";
    }

    return "";
  };

  const refreshShippingQuotes = async () => {
    if (!order) return;

    if (!exchangeLines.length) {
      setShippingQuoteError("Chưa có sản phẩm đổi để báo giá vận chuyển.");
      return;
    }

    const toAddress = buildOrderFullAddress(order);
    if (!toAddress) {
      setShippingQuoteError(
        "Đơn gốc chưa có địa chỉ giao hàng để báo giá HVC.",
      );
      return;
    }

    const quoteItems = buildQuoteItems(exchangeLines);
    const weight = Math.max(
      1,
      Number(shippingWeight || 0) ||
        quoteItems.reduce(
          (sum, item) =>
            sum + Number(item.weight || 0) * Number(item.quantity || 1),
          0,
        ),
    );
    const length = Math.max(1, Number(shippingLength || 0) || 10);
    const width = Math.max(1, Number(shippingWidth || 0) || 10);
    const height = Math.max(1, Number(shippingHeight || 0) || 10);
    const insuranceValue = Math.max(exchangeTotal, customerPayableAmount, 0);
    const codAmount = Math.max(0, customerPayableAmount);
    const errors: string[] = [];
    const rows: ExchangeShippingQuote[] = [];

    try {
      setShippingQuoteLoading(true);
      setShippingQuoteError("");

      let ghnDistrictId = Number(order.shippingGhnDistrictId || 0);
      let ghnWardCode = String(order.shippingGhnWardCode || "");

      if (
        (!ghnDistrictId || !ghnWardCode) &&
        order.shippingProvince &&
        order.shippingDistrict &&
        order.shippingWard
      ) {
        try {
          const resolved = await resolveGhnAddress({
            province: order.shippingProvince,
            district: order.shippingDistrict,
            ward: order.shippingWard,
          });
          ghnDistrictId = Number(resolved?.districtId || 0);
          ghnWardCode = String(resolved?.wardCode || "");
        } catch (err) {
          errors.push(
            err instanceof Error
              ? `GHN map địa chỉ: ${err.message}`
              : "GHN: Không map được địa chỉ.",
          );
        }
      }

      if (ghnDistrictId && ghnWardCode) {
        try {
          const ghnRows = await quoteShipment({
            toDistrictId: ghnDistrictId,
            toWardCode: ghnWardCode,
            insuranceValue,
            length,
            width,
            height,
            weight,
            items: quoteItems,
          });

          rows.push(
            ...(Array.isArray(ghnRows) ? ghnRows : []).map((row: any) => ({
              ...(row as any),
              _carrier: "ghn",
              _quoteKey: `ghn-${row.serviceId || 0}-${row.serviceTypeId || 0}`,
              _serviceName:
                row.shortName ||
                row.serviceName ||
                `GHN ${row.serviceId || ""}`,
              _leadtimeLabel: getQuoteLeadtimeLabel(row),
              _ghnDistrictId: ghnDistrictId,
              _ghnWardCode: ghnWardCode,
              _fee: getQuoteFee(row),
              _applyFeeToInput: true,
            })),
          );
        } catch (err) {
          errors.push(
            err instanceof Error
              ? `GHN: ${err.message}`
              : "GHN: Không lấy được báo giá.",
          );
        }
      } else {
        errors.push("GHN: Thiếu quận/huyện hoặc phường/xã GHN.");
      }

      try {
        const ahamoveRaw = await quoteAhamoveShipment({
          toName:
            order.shippingRecipientName || order.customerName || "Khách hàng",
          toPhone: order.shippingPhone || order.customerPhone || "",
          toAddress,
          codAmount,
          weight,
          length,
          width,
          height,
          note: "Đơn đổi/trả",
          items: quoteItems.map((item) => ({
            name: item.name,
            num: item.quantity,
            quantity: item.quantity,
            price: item.price,
            weight: item.weight,
          })),
        });

        rows.push(
          ...normalizeAhamoveQuoteItems(ahamoveRaw).map(
            (row: any, index: number) => {
              const serviceId = String(
                row.serviceId ||
                  row.service_id ||
                  row.id ||
                  row.service ||
                  `AHAMOVE-${index}`,
              );
              return {
                ...(row as any),
                serviceId: index + 1,
                _carrier: "ahamove",
                _quoteKey: `ahamove-${serviceId}-${index}`,
                _serviceName:
                  row.name || row.serviceName || row.service_name || serviceId,
                _ahamoveServiceId: serviceId,
                _leadtimeLabel: getQuoteLeadtimeLabel(row),
                _fee: getQuoteFee(row),
                _applyFeeToInput: true,
              } as ExchangeShippingQuote;
            },
          ),
        );
      } catch (err) {
        errors.push(
          err instanceof Error
            ? `AhaMove: ${err.message}`
            : "AhaMove: Không lấy được báo giá.",
        );
      }

      try {
        const primaryVtp = viettelInventories[0] as any;
        const viettelRows = await quoteViettelPostShipment({
          toName:
            order.shippingRecipientName || order.customerName || "Khách hàng",
          toPhone: order.shippingPhone || order.customerPhone || "",
          toAddress: order.shippingAddressLine1 || toAddress,
          toProvince: order.shippingProvince || "",
          toDistrict: order.shippingDistrict || "",
          toWard: order.shippingWard || "",
          province: order.shippingProvince || "",
          district: order.shippingDistrict || "",
          ward: order.shippingWard || "",
          senderGroupAddressId:
            Number(
              primaryVtp?.groupAddressId || primaryVtp?.group_address_id || 0,
            ) || undefined,
          senderProvinceId:
            Number(primaryVtp?.provinceId || primaryVtp?.province_id || 0) ||
            undefined,
          senderDistrictId:
            Number(primaryVtp?.districtId || primaryVtp?.district_id || 0) ||
            undefined,
          senderWardId:
            Number(
              primaryVtp?.wardId ||
                primaryVtp?.ward_id ||
                primaryVtp?.wards_id ||
                0,
            ) || undefined,
          codAmount,
          productPrice: insuranceValue,
          insuranceValue,
          weight,
          length,
          width,
          height,
        });

        rows.push(
          ...(Array.isArray(viettelRows) ? viettelRows : []).map(
            (row: any, index: number) => ({
              ...(row as any),
              _carrier: "viettelpost",
              _quoteKey:
                row._quoteKey ||
                `viettelpost-${row._viettelServiceCode || row.serviceCode || row.shortName || index}`,
              _serviceName:
                row._serviceName ||
                row.shortName ||
                row.serviceName ||
                row._viettelServiceCode ||
                row.serviceCode ||
                "Viettel Post",
              _viettelServiceCode:
                row._viettelServiceCode ||
                row.serviceCode ||
                row.orderService ||
                row.code ||
                row.shortName ||
                "VCN",
              _leadtimeLabel: getQuoteLeadtimeLabel(row),
              _fee: getQuoteFee(row),
              _applyFeeToInput: !row._disabled,
            }),
          ),
        );
      } catch (err) {
        errors.push(
          err instanceof Error
            ? `ViettelPost: ${err.message}`
            : "ViettelPost: Không lấy được báo giá.",
        );
      }

      const sorted = rows
        .filter((row) => getQuoteFee(row) > 0)
        .sort((a, b) => {
          const carrierA = getQuoteCarrier(a);
          const carrierB = getQuoteCarrier(b);
          if (carrierA !== carrierB) {
            return (
              CARRIER_ORDER.indexOf(carrierA) - CARRIER_ORDER.indexOf(carrierB)
            );
          }
          return getQuoteFee(a) - getQuoteFee(b);
        });

      setShippingQuotes(sorted);

      if (sorted.length) {
        const current =
          sorted.find((row) => getQuoteKey(row) === selectedShippingQuoteKey) ||
          sorted[0];
        setSelectedShippingQuoteKey(getQuoteKey(current));
        setShippingPartner(getQuoteCarrier(current));
      }

      setShippingQuoteError(
        sorted.length
          ? errors.length
            ? `Đã lấy ${sorted.length} gói. Một số hãng lỗi: ${errors.join(" | ")}`
            : ""
          : errors.join(" | ") || "Không lấy được báo giá HVC.",
      );
    } finally {
      setShippingQuoteLoading(false);
    }
  };

  useEffect(() => {
    if (!autoQuoteKey) return;
    if (shippingQuoteLoading) return;
    if (lastAutoQuoteKeyRef.current === autoQuoteKey) return;

    lastAutoQuoteKeyRef.current = autoQuoteKey;
    void refreshShippingQuotes();
  }, [autoQuoteKey]);

  const buildReturnPayload = (selectedReturnItems: ReturnLine[]) => ({
    originalOrderId: order?.id,
    originalBranchId: order?.branchId || null,
    originalStaffId: order?.createdByStaffId || null,

    handledAtBranchId: receiveBranchId,
    returnReceiveBranchId: receiveBranchId,
    exchangeIssueBranchId: exchangeIssueBranchId || receiveBranchId,

    type: exchangeLines.length ? "RETURN_EXCHANGE" : "RETURN",
    status: statusMode,

    shippingFee,
    customerPayableAmount,
    shippingPartner: normalizeCarrierCode(
      selectedShippingQuote?._carrier || shippingPartner,
    ),
    selectedQuoteKey: selectedShippingQuote
      ? getQuoteKey(selectedShippingQuote)
      : selectedShippingQuoteKey || null,
    selectedShippingQuote: selectedShippingQuote || null,
    selectedServiceId: selectedShippingQuote?.serviceId || null,
    selectedServiceTypeId: selectedShippingQuote?.serviceTypeId || null,
    serviceCode:
      (selectedShippingQuote as any)?._viettelServiceCode ||
      (selectedShippingQuote as any)?.serviceCode ||
      (selectedShippingQuote as any)?.orderService ||
      null,
    viettelServiceCode:
      (selectedShippingQuote as any)?._viettelServiceCode ||
      (selectedShippingQuote as any)?.serviceCode ||
      null,
    ahamoveServiceId:
      (selectedShippingQuote as any)?._ahamoveServiceId ||
      (selectedShippingQuote as any)?.service_id ||
      null,
    ghnDistrictId:
      (selectedShippingQuote as any)?._ghnDistrictId ||
      order?.shippingGhnDistrictId ||
      null,
    ghnWardCode:
      (selectedShippingQuote as any)?._ghnWardCode ||
      order?.shippingGhnWardCode ||
      null,

    refundPaymentSourceId: refundAmount > 0 ? refundPaymentSourceId : null,
    extraChargePaymentSourceId:
      extraChargeAmount > 0 ? extraChargePaymentSourceId : null,

    note,

    items: [
      ...selectedReturnItems.map((line) => ({
        itemType: "RETURN",
        orderItemId: line.id,
        variantId: line.variantId || null,
        sku: line.sku || null,
        productName: line.productName || null,
        qty: Number(line.returnQty || 0),
        unitPrice: Number(line.unitPrice || 0),
        refundPrice: Number(line.unitPrice || 0),
        reason: line.reason || null,
      })),
      ...exchangeLines.map((line) => ({
        itemType: "EXCHANGE",
        orderItemId: null,
        variantId: line.id,
        sku: line.sku || null,
        productName: line.productName || null,
        qty: Number(line.qty || 0),
        unitPrice: Number(line.price || 0),
        refundPrice: Number(line.price || 0),
        reason: "Sản phẩm đổi cho khách",
      })),
    ],
  });

  const handleSave = async () => {
    if (!order) return;

    const validationMessage = validateBeforeSubmit(false);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const selectedReturnItems = returnLines.filter(
      (line) => Number(line.returnQty || 0) > 0,
    );

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const created = await apiPost(
        "/returns",
        buildReturnPayload(selectedReturnItems),
      );

      setMessage(`Đã tạo phiếu đổi/trả ${created?.code || ""}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không lưu được phiếu đổi trả.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndShip = async () => {
    if (!order) return;

    if (!exchangeLines.length) {
      setError("Chưa có sản phẩm đổi để gửi vận chuyển.");
      return;
    }

    const validationMessage = validateBeforeSubmit(true);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const selectedReturnItems = returnLines.filter(
      (line) => Number(line.returnQty || 0) > 0,
    );

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const created = await apiPost(
        "/returns/create-exchange-shipment",
        buildReturnPayload(selectedReturnItems),
      );

      setMessage(
        `Đã tạo đơn đổi/trả ${created?.code || ""}${created?.exchangeOrderCode ? ` · Đơn đổi ${created.exchangeOrderCode}` : ""}${created?.exchangeTrackingCode ? ` · VĐ ${created.exchangeTrackingCode}` : ""}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tạo được đơn đổi và vận đơn HVC.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        Đang tải màn đổi trả...
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        Không tìm thấy đơn hàng.
      </div>
    );
  }

  const returnable = isReturnableOrder(order);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/returns"
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            ← Quay lại đơn trả hàng
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            Tạo đơn đổi / trả hàng
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Đơn gốc:{" "}
            <Link
              href={`/orders/${order.id}`}
              className="font-semibold text-blue-600 hover:underline"
            >
              {order.orderCode}
            </Link>
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit}
          className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-300"
        >
          {saving ? "Đang lưu..." : "Lưu phiếu đổi/trả"}
        </button>
      </div>

      {!returnable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Đơn này chưa đủ điều kiện đổi/trả. Chỉ nên xử lý khi đơn đã hoàn
          thành/đã giao/đã thanh toán hợp lệ.
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-semibold text-neutral-900">
                Thông tin đơn gốc
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Dùng để xác định chi nhánh bán, nhân viên bán và nguồn tiền ban
                đầu.
              </p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
              <Info
                label="Khách hàng"
                value={`${order.customerName || "Khách lẻ"}${order.customerPhone ? ` · ${order.customerPhone}` : ""}`}
              />
              <Info label="Chi nhánh bán" value={branchName(order.branchId)} />
              <Info
                label="Nhân viên bán/tạo"
                value={order.createdByStaffName || "—"}
              />
              <Info
                label="Ngày bán"
                value={order.soldAt || order.createdAt || "—"}
              />
              <Info
                label="Trạng thái đơn"
                value={`${order.status || "—"} / ${order.paymentStatus || "—"} / ${order.fulfillmentStatus || "—"}`}
              />
              <Info label="Tổng đơn" value={money(order.finalAmount)} />
            </div>

            <div className="border-t border-neutral-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Nguồn tiền khách đã thanh toán
              </p>

              <div className="mt-3 space-y-2">
                {Array.isArray(order.payments) && order.payments.length ? (
                  order.payments.map((payment, index) => (
                    <div
                      key={payment.id || index}
                      className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-neutral-800">
                        {payment.sourceName ||
                          payment.paymentSource?.name ||
                          payment.method ||
                          "Nguồn tiền"}
                      </span>
                      <span className="font-semibold">
                        {money(payment.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                    Chưa có dữ liệu nguồn tiền.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-neutral-900">Sản phẩm trả</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Không cho chọn vượt số lượng đã mua. Backend vẫn chặn trả
                  trùng.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReturnLines((prev) =>
                      prev.map((line) => ({
                        ...line,
                        returnQty: Number(line.maxReturnQty ?? line.qty ?? 0),
                      })),
                    )
                  }
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                >
                  Trả toàn bộ
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReturnLines((prev) =>
                      prev.map((line) => ({ ...line, returnQty: 0 })),
                    )
                  }
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <div className="grid min-w-[880px] grid-cols-[1fr_80px_100px_120px_130px_180px] border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-xs font-semibold uppercase text-neutral-500">
                <div>Sản phẩm</div>
                <div>Đã mua</div>
                <div>Còn trả</div>
                <div>SL trả</div>
                <div>Tiền hoàn</div>
                <div>Lý do</div>
              </div>

              {returnLines.map((line) => {
                const maxReturnQty = Number(line.maxReturnQty ?? line.qty ?? 0);

                return (
                  <div
                    key={line.id}
                    className="grid min-w-[880px] grid-cols-[1fr_80px_100px_120px_130px_180px] items-center border-b border-neutral-100 px-5 py-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-neutral-900">
                        {line.productName || "Sản phẩm"}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {line.sku || "—"} · {line.color || "—"} /{" "}
                        {line.size || "—"} · {money(line.unitPrice)}
                      </div>
                    </div>

                    <div>{line.qty}</div>
                    <div>{maxReturnQty}</div>

                    <input
                      value={line.returnQty}
                      onChange={(e) =>
                        updateReturnQty(line.id, Number(e.target.value || 0))
                      }
                      className="h-10 w-20 rounded-xl border border-neutral-200 px-3 text-center outline-none focus:border-neutral-900"
                    />

                    <div className="font-semibold">
                      {money(
                        toNumber(line.unitPrice) * toNumber(line.returnQty),
                      )}
                    </div>

                    <input
                      value={line.reason}
                      onChange={(e) =>
                        setReturnLines((prev) =>
                          prev.map((item) =>
                            item.id === line.id
                              ? { ...item, reason: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-10 rounded-xl border border-neutral-200 px-3 outline-none focus:border-neutral-900"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-semibold text-neutral-900">Sản phẩm đổi</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Nếu tiền hàng đổi lớn hơn tiền hàng trả, hệ thống sẽ tạo phiếu
                thu.
              </p>
            </div>

            <div className="p-5">
              <div className="relative">
                <input
                  value={exchangeSearch}
                  onChange={(e) => setExchangeSearch(e.target.value)}
                  placeholder="Tìm SKU / tên sản phẩm đổi..."
                  className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-neutral-900"
                />

                {exchangeSearch.trim().length >= 2 ? (
                  <div className="absolute left-0 right-0 top-12 z-30 max-h-72 overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
                    {searchingExchange ? (
                      <div className="px-4 py-3 text-sm text-neutral-500">
                        Đang tìm...
                      </div>
                    ) : exchangeResults.length ? (
                      exchangeResults.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => addExchangeLine(variant)}
                          className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-left text-sm hover:bg-neutral-50"
                        >
                          <div>
                            <div className="font-semibold">
                              {variant.sku || "Không SKU"}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {variant.productName} · {variant.color || "—"} /{" "}
                              {variant.size || "—"}
                            </div>
                          </div>
                          <div className="font-semibold">
                            {money(variant.price)}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-neutral-500">
                        Không có sản phẩm.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                <div className="grid grid-cols-[1fr_110px_130px_40px] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500">
                  <div>Sản phẩm đổi</div>
                  <div>SL</div>
                  <div>Thành tiền</div>
                  <div />
                </div>

                {exchangeLines.length ? (
                  exchangeLines.map((line) => (
                    <div
                      key={line.id}
                      className="grid grid-cols-[1fr_110px_130px_40px] items-center border-t border-neutral-100 px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-neutral-900">
                          {line.productName}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {line.sku || "—"} · {line.color || "—"} /{" "}
                          {line.size || "—"} · {money(line.price)}
                        </div>
                      </div>

                      <input
                        value={line.qty}
                        onChange={(e) =>
                          updateExchangeQty(
                            line.id,
                            Number(e.target.value || 1),
                          )
                        }
                        className="h-10 w-20 rounded-xl border border-neutral-200 px-3 text-center outline-none focus:border-neutral-900"
                      />

                      <div className="font-semibold">
                        {money(line.price * line.qty)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeExchangeLine(line.id)}
                        className="h-9 w-9 rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-neutral-100 px-4 py-6 text-center text-sm text-neutral-400">
                    Chưa có sản phẩm đổi.
                  </div>
                )}
              </div>
            </div>
          </section>

          {exchangeLines.length ? (
            <section className="rounded-3xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">Vận chuyển</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Chọn kiểu giao hàng, so sánh GHN / AhaMove / Viettel Post
                    giống màn tạo đơn.
                  </p>
                </div>

                <div className="text-sm text-neutral-500">
                  {shippingQuoteLoading
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
                    onClick={() => {
                      if (!item.enabled) return;
                      setShippingPartner(item.value);
                      const firstQuote = shippingQuotes.find(
                        (row) => getQuoteCarrier(row) === item.value,
                      );
                      if (firstQuote) {
                        setSelectedShippingQuoteKey(getQuoteKey(firstQuote));
                      }
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      shippingPartner === item.value
                        ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                        : "border-neutral-200 bg-white text-neutral-900"
                    } ${item.enabled ? "hover:border-neutral-900" : "cursor-not-allowed opacity-50"}`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div
                      className={`mt-1 text-xs ${shippingPartner === item.value ? "text-neutral-200" : "text-neutral-500"}`}
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
                      setShippingWeight(Math.max(1, toNumber(e.target.value)))
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
                      setShippingLength(Math.max(1, toNumber(e.target.value)))
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
                      setShippingWidth(Math.max(1, toNumber(e.target.value)))
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
                      setShippingHeight(Math.max(1, toNumber(e.target.value)))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <div className="grid gap-y-2 md:grid-cols-[150px_1fr]">
                  <span className="text-neutral-500">Tỉnh / Thành</span>
                  <span>{quoteProvince}</span>
                  <span className="text-neutral-500">Quận / Huyện</span>
                  <span>{quoteDistrict}</span>
                  <span className="text-neutral-500">Xã / Phường</span>
                  <span>{quoteWard}</span>
                  <span className="text-neutral-500">Địa chỉ giao</span>
                  <span>{shippingAddressText}</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                Kho lấy hàng đã cấu hình:{" "}
                <span className="font-semibold text-neutral-900">
                  {branchName(exchangeIssueBranchId || receiveBranchId)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <span>
                  {shippingQuotes.length
                    ? `Đã so sánh ${shippingQuotes.length} gói vận chuyển. Đang chọn ${carrierLabel(shippingPartner)}. Phí đối tác: ${money(selectedQuoteFee)} | Khách đang trả: ${money(shippingFee)}.`
                    : "Đang tự lấy báo giá. Có thể bấm Lấy báo giá để refresh lại GHN, AhaMove và Viettel Post."}
                </span>
                <button
                  type="button"
                  onClick={() => void refreshShippingQuotes()}
                  disabled={shippingQuoteLoading}
                  className="rounded-xl bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:bg-neutral-300"
                >
                  {shippingQuoteLoading ? "Đang lấy..." : "Lấy báo giá"}
                </button>
              </div>

              {shippingQuoteError ? (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${shippingQuotes.length ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}
                >
                  {shippingQuoteError}
                </div>
              ) : null}

              {shippingQuotes.length ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 xl:grid-cols-3">
                    {highlightQuotes.map((item) => {
                      const quote = item.quote;
                      const quoteKey = getQuoteKey(quote);
                      const active = quoteKey === selectedShippingQuoteKey;
                      const meta = getQuoteMeta(quote);
                      const feeValue = getQuoteFee(quote);
                      const tone =
                        item.tone === "emerald"
                          ? "border-emerald-200 bg-emerald-50"
                          : item.tone === "blue"
                            ? "border-blue-200 bg-blue-50"
                            : "border-orange-200 bg-orange-50";

                      return (
                        <button
                          key={`${item.key}-${quoteKey}`}
                          type="button"
                          onClick={() => {
                            setSelectedShippingQuoteKey(quoteKey);
                            setShippingPartner(getQuoteCarrier(quote));
                          }}
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
                            {meta.name} · {getQuoteServiceCleanName(quote)}
                          </div>

                          <div className="mt-2 flex items-end justify-between gap-3">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-neutral-950">
                                {money(feeValue)}
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
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${quoteInsight.className}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{quoteInsight.label}</span>
                      <span className="text-xs font-medium opacity-80">
                        Phí khách đang trả: {money(shippingFee)} · Gói đang
                        chọn:{" "}
                        {selectedShippingQuote
                          ? money(getQuoteFee(selectedShippingQuote))
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
                            Nhóm theo hãng, chọn nhanh gói phù hợp cho đơn đổi
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
                            </div>
                          </div>

                          <div className="divide-y divide-neutral-100">
                            {group.quotes.map((quote) => {
                              const quoteKey = getQuoteKey(quote);
                              const active =
                                quoteKey === selectedShippingQuoteKey;
                              const badges = getQuoteBadges(quote);
                              const feeValue = getQuoteFee(quote);

                              return (
                                <button
                                  key={quoteKey}
                                  type="button"
                                  onClick={() => {
                                    setSelectedShippingQuoteKey(quoteKey);
                                    setShippingPartner(getQuoteCarrier(quote));
                                  }}
                                  className={`grid w-full grid-cols-[28px_1fr_140px] items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 ${
                                    active ? "bg-neutral-50" : "bg-white"
                                  }`}
                                >
                                  <span
                                    className={`h-3 w-3 rounded-full border ${active ? "border-neutral-950 bg-neutral-950" : "border-neutral-300 bg-white"}`}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-neutral-950">
                                        {getQuoteServiceCleanName(quote)}
                                      </span>
                                      {badges.map((badge: string) => (
                                        <span
                                          key={badge}
                                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                                        >
                                          {badge}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="mt-1 text-xs text-neutral-500">
                                      {getSmartQuoteNote(quote)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-neutral-950">
                                      {money(feeValue)}
                                    </div>
                                    <div className="mt-1 text-[10px] text-neutral-400">
                                      {getQuoteLeadtimeLabel(quote)}
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
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900">
              Thông tin phiếu trả
            </h2>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Kiểm tra thông tin khách / giao hàng
              </div>
              <div className="mt-3 space-y-2">
                {getCustomerCheckRows(order).map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[92px_1fr] gap-2 text-xs leading-5"
                  >
                    <span className="text-blue-700/70">{row.label}</span>
                    <span className="font-semibold text-neutral-950">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <InfoLine
              label="Chi nhánh bán gốc"
              value={branchName(order.branchId)}
            />
            <InfoLine
              label="Nhân viên bán gốc"
              value={order.createdByStaffName || "—"}
            />
            <InfoLine
              label="Chi nhánh nhận trả"
              value={branchName(receiveBranchId)}
            />
            <InfoLine
              label="Kho xuất hàng đổi"
              value={branchName(exchangeIssueBranchId)}
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Chi nhánh/kho nhận hàng trả
            </label>
            <select
              value={receiveBranchId}
              onChange={(e) => setReceiveBranchId(e.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Kho xuất sản phẩm đổi
            </label>
            <select
              value={exchangeIssueBranchId}
              onChange={(e) => setExchangeIssueBranchId(e.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            {exchangeLines.length ? (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Phí ship thu khách
                </label>
                <input
                  value={shippingFeeInput}
                  onChange={(e) => setShippingFeeInput(e.target.value)}
                  inputMode="numeric"
                  className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
                  placeholder="30000"
                />

                <div className="mt-3 rounded-xl bg-white px-3 py-3 text-xs leading-5 text-neutral-600">
                  <div className="flex justify-between gap-3">
                    <span>HVC đang chọn</span>
                    <strong>
                      {selectedShippingQuote
                        ? `${carrierLabel(shippingPartner)} · ${getQuoteServiceCleanName(selectedShippingQuote)}`
                        : "Chưa chọn gói"}
                    </strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>Phí hãng</span>
                    <strong>
                      {selectedShippingQuote ? money(selectedQuoteFee) : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            {refundAmount > 0 ? (
              <>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Nguồn tiền hoàn khách
                </label>
                <select
                  value={refundPaymentSourceId}
                  onChange={(e) => setRefundPaymentSourceId(e.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
                >
                  <option value="">Chọn nguồn tiền hoàn</option>
                  {refundPaymentSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                      {source.type ? ` · ${source.type}` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {extraChargeAmount > 0 ? (
              <>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Nguồn tiền khách bù thêm
                </label>
                <select
                  value={extraChargePaymentSourceId}
                  onChange={(e) =>
                    setExtraChargePaymentSourceId(e.target.value)
                  }
                  className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
                >
                  <option value="">Chọn nguồn tiền thu thêm</option>
                  {extraChargePaymentSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                      {source.type ? ` · ${source.type}` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {differenceAmount === 0 ? (
              <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
                Đổi ngang tiền, không phát sinh phiếu thu/chi.
              </div>
            ) : null}

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Trạng thái
            </label>
            <select
              value={statusMode}
              onChange={(e) =>
                setStatusMode(e.target.value as "COMPLETED" | "DRAFT")
              }
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="COMPLETED">Đã nhận hàng và xử lý</option>
              <option value="DRAFT">Lưu nháp</option>
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Ghi chú
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Khách đổi size, hoàn tiền mặt..."
              className="mt-2 min-h-[96px] w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm outline-none focus:border-neutral-900"
            />
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900">Tổng kết</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Tiền hàng trả</span>
                <strong>{money(returnTotal)}</strong>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-500">Tiền hàng đổi</span>
                <strong>{money(exchangeTotal)}</strong>
              </div>

              {exchangeLines.length ? (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Phí ship thu khách</span>
                  <strong>{money(shippingFee)}</strong>
                </div>
              ) : null}

              <div className="border-t border-neutral-100 pt-3" />

              <div className="flex justify-between text-base">
                <span className="font-semibold">
                  {refundAmount > 0
                    ? "Shop hoàn khách"
                    : customerPayableAmount > 0
                      ? "Khách cần trả / COD"
                      : "Đổi ngang"}
                </span>
                <strong className="text-xl">
                  {refundAmount > 0
                    ? money(refundAmount)
                    : money(customerPayableAmount)}
                </strong>
              </div>

              {differenceAmount > 0 ? (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                  Khi tạo phiếu, hệ thống sinh phiếu chi OUT từ nguồn tiền hoàn
                  khách.
                </div>
              ) : null}

              {customerPayableAmount > 0 ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
                  Nếu gửi vận chuyển, COD của đơn đổi sẽ là{" "}
                  {money(customerPayableAmount)}.
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit}
              className="mt-5 h-12 w-full rounded-2xl bg-neutral-950 font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              {saving ? "Đang lưu..." : "Lưu phiếu đổi/trả"}
            </button>

            {exchangeLines.length ? (
              <button
                type="button"
                onClick={handleSaveAndShip}
                disabled={!canShipSubmit || saving}
                className="mt-3 h-12 w-full rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 disabled:bg-neutral-300"
              >
                {saving ? "Đang xử lý..." : "Tạo đơn đổi & gửi HVC"}
              </button>
            ) : null}

            {!canSubmit ? (
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Kiểm tra điều kiện đơn, chi nhánh nhận trả, sản phẩm và nguồn
                tiền tương ứng trước khi tạo.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">
        {value || "—"}
      </p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex justify-between gap-3 text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-semibold text-neutral-900">
        {value || "—"}
      </span>
    </div>
  );
}
