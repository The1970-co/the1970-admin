import { API_BASE } from "@/lib/api-base";
export type OrderStatus =
  | "NEW"
  | "APPROVED"
  | "PACKING"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderPaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "PENDING_COD"
  | "REFUNDED"
  | "FAILED";

export type OrderFulfillmentStatus =
  | "UNFULFILLED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED";

export type AdminOrderItem = {
  id?: string;
  variantId?: string | null;
  sku: string;
  productName: string;
  color?: string | null;
  size?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type AdminShipment = {
  id?: string;
  carrier?: string | null;
  trackingCode?: string | null;
  shippingStatus?: string | null;
  shippingFee?: number | null;
  codAmount?: number | null;
  note?: string | null;
  metadata?: any;
};

export type AdminOrder = {
  id: string;
  orderCode: string;
  branchId?: string | null;
  salesChannel: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus?: OrderFulfillmentStatus | string | null;

  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;

  note?: string | null;

  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  finalAmount: number;

  createdAt: string;
  updatedAt?: string;

  items: AdminOrderItem[];
  shipment?: AdminShipment | null;

  shippingRecipientName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingWard?: string | null;
  shippingDistrict?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;
  shippingGhnDistrictId?: number | null;
  shippingGhnWardCode?: string | null;
};

export type UpdateOrderPayload = {
  customerName?: string;
  customerPhone?: string;
  note?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingWard?: string;
  shippingDistrict?: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
  shippingFee?: number;
};

export type ShipmentQuoteItem = {
  name: string;
  quantity: number;
  length: number;
  width: number;
  height: number;
  weight: number;
};

export type ShipmentQuotePayload = {
  toDistrictId: number;
  toWardCode: string;
  insuranceValue?: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  items?: ShipmentQuoteItem[];
};

export type ShipmentQuoteResult = {
  serviceId: number;
  serviceTypeId: number;
  shortName?: string;
  fee?: any;
  leadtime?: any;
};

export type CreateShipmentItemPayload = {
  name: string;
  quantity: number;
  price: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  category?: string;
};

export type CreateShipmentPayload = {
  clientOrderCode: string;
  toName: string;
  toPhone: string;
  toAddress: string;
  toWardCode: string;
  toDistrictId: number;
  codAmount: number;
  content?: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  insuranceValue?: number;
  note?: string;
  requiredNote?: string;
  items: CreateShipmentItemPayload[];
};


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    console.log("[orders-api] request", `${API_BASE}${path}`);

    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    console.log("[orders-api] status", path, res.status);

    if (!res.ok) {
      let message = `Request failed: ${res.status}`;
      try {
        const data = await res.json();
        message = Array.isArray(data?.message)
          ? data.message.join(", ")
          : data?.message || message;
      } catch {}
      throw new Error(message);
    }

    const text = await res.text();
    console.log("[orders-api] raw text", path, text);

    if (!text) {
      return ([] as unknown) as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      console.error("[orders-api] json parse error", path, err);
      throw new Error(`Response JSON không hợp lệ: ${path}`);
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timeout: ${path}`);
    }
    console.error("[orders-api] error", path, err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  return Number(value || 0);
}

function normalizeDate(value: unknown) {
  if (!value) return "";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("vi-VN");
  } catch {
    return String(value);
  }
}

function normalizeOrderItem(item: any): AdminOrderItem {
  return {
    id: item?.id ? String(item.id) : undefined,
    variantId: item?.variantId ? String(item.variantId) : null,
    sku: String(item?.sku || ""),
    productName: String(item?.productName || ""),
    color: item?.color || null,
    size: item?.size || null,
    qty: toNumber(item?.qty),
    unitPrice: toNumber(item?.unitPrice),
    lineTotal: toNumber(item?.lineTotal),
  };
}

function normalizeShipment(shipment: any): AdminShipment | null {
  if (!shipment) return null;

  return {
    id: shipment?.id ? String(shipment.id) : undefined,
    carrier: shipment?.carrier || null,
    trackingCode: shipment?.trackingCode || null,
    shippingStatus: shipment?.shippingStatus || null,
    shippingFee:
      shipment?.shippingFee === null || shipment?.shippingFee === undefined
        ? null
        : toNumber(shipment.shippingFee),
    codAmount:
      shipment?.codAmount === null || shipment?.codAmount === undefined
        ? null
        : toNumber(shipment.codAmount),
    note: shipment?.note || null,
    metadata: shipment?.metadata,
  };
}

function normalizeOrder(order: any): AdminOrder {
  return {
    id: String(order?.id || ""),
    orderCode: String(order?.orderCode || ""),
    branchId: order?.branchId || null,
    salesChannel: String(order?.salesChannel || ""),
    status: String(order?.status || "NEW") as OrderStatus,
    paymentStatus: String(order?.paymentStatus || "UNPAID") as OrderPaymentStatus,
    fulfillmentStatus: order?.fulfillmentStatus || null,

    customerId: order?.customerId || null,
    customerName: order?.customerName || null,
    customerPhone: order?.customerPhone || null,

    note: order?.note || null,

    totalAmount: toNumber(order?.totalAmount),
    discountAmount: toNumber(order?.discountAmount),
    shippingFee: toNumber(order?.shippingFee),
    finalAmount: toNumber(order?.finalAmount),

    createdAt: normalizeDate(order?.createdAt),
    updatedAt: order?.updatedAt ? normalizeDate(order.updatedAt) : undefined,

    items: Array.isArray(order?.items)
      ? order.items.map(normalizeOrderItem)
      : [],
    shipment: normalizeShipment(order?.shipment),

    shippingRecipientName: order?.shippingRecipientName || null,
    shippingPhone: order?.shippingPhone || null,
    shippingAddressLine1: order?.shippingAddressLine1 || null,
    shippingAddressLine2: order?.shippingAddressLine2 || null,
    shippingWard: order?.shippingWard || null,
    shippingDistrict: order?.shippingDistrict || null,
    shippingCity: order?.shippingCity || null,
    shippingProvince: order?.shippingProvince || null,
    shippingPostalCode: order?.shippingPostalCode || null,
    shippingGhnDistrictId:
      order?.shippingGhnDistrictId === null ||
      order?.shippingGhnDistrictId === undefined
        ? null
        : Number(order.shippingGhnDistrictId),
    shippingGhnWardCode: order?.shippingGhnWardCode || null,
  };
}

export async function getOrders(): Promise<AdminOrder[]> {
  console.log("[orders-api] getOrders start");

  const data = await request<any>("/orders");

  console.log("[orders-api] getOrders data", data);

  const rawOrders = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];

  console.log("[orders-api] getOrders rawOrders", rawOrders);

  return rawOrders.map(normalizeOrder);
}

export async function getOrderById(id: string): Promise<AdminOrder> {
  const data = await request<any>(`/orders/${id}`);
  return normalizeOrder(data?.data || data);
}

export async function updateOrder(
  id: string,
  payload: UpdateOrderPayload
): Promise<AdminOrder> {
  const data = await request<any>(`/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeOrder(data?.data || data);
}

export async function updateOrderDetail(
  id: string,
  payload: UpdateOrderPayload
): Promise<AdminOrder> {
  return updateOrder(id, payload);
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<AdminOrder> {
  const data = await request<any>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return normalizeOrder(data?.data || data);
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: OrderPaymentStatus
): Promise<AdminOrder> {
  const data = await request<any>(`/orders/${id}/payment-status`, {
    method: "PATCH",
    body: JSON.stringify({ paymentStatus }),
  });

  return normalizeOrder(data?.data || data);
}

export async function quoteShipment(
  payload: ShipmentQuotePayload
): Promise<ShipmentQuoteResult[]> {
  const data = await request<any[]>("/shipments/ghn/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return Array.isArray(data) ? data : [];
}

export async function createShipment(
  id: string,
  payload: CreateShipmentPayload
): Promise<any> {
  return request<any>(`/shipments/${id}/ghn/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}