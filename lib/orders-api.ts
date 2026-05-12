import { apiFetch } from "@/lib/api";
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


export type AdminPartialDeliveryItem = {
  id?: string;
  orderItemId?: string | null;
  variantId?: string | null;
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

export type AdminPartialDelivery = {
  id: string;
  code?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  ghnTrackingCode?: string | null;
  originalCod?: number | null;
  adjustedCod?: number | null;
  shippingFee?: number | null;
  reason?: string | null;
  note?: string | null;
  approvedBy?: string | null;
  approvedById?: string | null;
  handledAt?: string | null;
  createdAt?: string | null;
  returnOrderId?: string | null;
  returnOrderCode?: string | null;
  returnTrackingCode?: string | null;
  returnStatus?: string | null;
  returnReceivedAt?: string | null;
  items?: AdminPartialDeliveryItem[];
  keptItems?: AdminPartialDeliveryItem[];
  returnedItems?: AdminPartialDeliveryItem[];
  returnOrder?: {
    id?: string;
    orderCode?: string | null;
    status?: string | null;
    fulfillmentStatus?: string | null;
    paymentStatus?: string | null;
    createdAt?: string | null;
    shipment?: AdminShipment | null;
  } | null;
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
  partialDeliveries?: AdminPartialDelivery[];
  isPartialDelivery?: boolean;
  partialReason?: string | null;

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
  const res = await apiFetch(path, {
    ...init,
    cache: "no-store",
  });

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

  if (!text) {
    return ([] as unknown) as T;
  }

  return JSON.parse(text) as T;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  return Number(value || 0);
}

function normalizeDate(value: unknown) {
  if (!value) return "";
  return String(value);
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



export async function deleteOrder(id: string): Promise<{ success?: boolean; message?: string }> {
  return request<{ success?: boolean; message?: string }>(`/orders/${id}`, {
    method: "DELETE",
  });
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

export type LocalDeliveryOrder = AdminOrder & {
  shipmentId?: string | null;
  carrierName?: string | null;
  trackingCode?: string | null;
  localStatus?: string | null;
  localStatusLabel?: string | null;
  shippingStatus?: string | null;
  partnerStatus?: string | null;
  ahamoveStatus?: string | null;
  codAmount?: number | null;
  paidAmount?: number | null;
  needCollectAmount?: number | null;
  address?: string | null;
  note?: string | null;
};

export type GetLocalDeliveryOrdersParams = {
  keyword?: string;
  q?: string;
  status?: string;
  carrier?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type MarkLocalDeliveryCodReceivedPayload = {
  paymentSourceId?: string | null;
  amount?: number;
  note?: string;
};

function normalizeLocalDeliveryOrder(row: any): LocalDeliveryOrder {
  const baseSource = row?.order || row;
  const normalized = normalizeOrder(baseSource) as LocalDeliveryOrder;

  return {
    ...normalized,
    id: String(row?.orderId || normalized.id || ""),
    orderCode: String(row?.orderCode || normalized.orderCode || ""),
    shipmentId: row?.shipmentId || row?.shipment?.id || null,
    carrierName:
      row?.carrierName ||
      row?.carrier ||
      row?.shipment?.carrier ||
      null,
    trackingCode:
      row?.trackingCode ||
      row?.shipment?.trackingCode ||
      null,
    localStatus:
      row?.localStatus ||
      row?.localDeliveryStatus ||
      row?.shipment?.shippingStatus ||
      null,
    localStatusLabel:
      row?.localStatusLabel ||
      row?.localDeliveryStatusLabel ||
      null,
    shippingStatus:
      row?.shippingStatus ||
      row?.shipment?.shippingStatus ||
      null,
    partnerStatus:
      row?.partnerStatus ||
      row?.shipment?.partnerStatus ||
      null,
    ahamoveStatus:
      row?.ahamoveStatus ||
      row?.shipment?.ahamoveStatus ||
      null,
    codAmount:
      row?.codAmount === null || row?.codAmount === undefined
        ? normalized.shipment?.codAmount ?? null
        : toNumber(row.codAmount),
    paidAmount:
      row?.paidAmount === null || row?.paidAmount === undefined
        ? null
        : toNumber(row.paidAmount),
    needCollectAmount:
      row?.needCollectAmount === null || row?.needCollectAmount === undefined
        ? null
        : toNumber(row.needCollectAmount),
    address:
      row?.address ||
      row?.shippingAddressLine1 ||
      normalized.shippingAddressLine1 ||
      null,
    note: row?.note || normalized.note || null,
  };
}

export async function getLocalDeliveryOrders(
  params: GetLocalDeliveryOrdersParams = {}
): Promise<LocalDeliveryOrder[]> {
  const search = new URLSearchParams();

  const keyword = params.keyword || params.q || "";
  if (keyword) search.set("q", keyword);
  if (params.status && params.status !== "ALL") search.set("status", params.status);
  if (params.carrier && params.carrier !== "ALL") search.set("carrier", params.carrier);
  if (params.branchId && params.branchId !== "ALL") search.set("branchId", params.branchId);
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);

  const query = search.toString();
  const data = await request<any>(
    `/finance/local-delivery-reconciliation${query ? `?${query}` : ""}`
  );

  const rawOrders = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : [];

  return rawOrders.map(normalizeLocalDeliveryOrder);
}

export async function markLocalDeliveryDelivered(
  orderId: string
): Promise<LocalDeliveryOrder> {
  const data = await request<any>(
    `/finance/local-delivery-reconciliation/${encodeURIComponent(orderId)}/delivered`,
    {
      method: "PATCH",
      body: JSON.stringify({ collectCod: false }),
    }
  );

  return normalizeLocalDeliveryOrder(data?.data || data);
}

export async function markLocalDeliveryCodReceived(
  orderIdOrPayload:
    | string
    | ({
        orderId: string;
      } & MarkLocalDeliveryCodReceivedPayload),
  maybePayload: MarkLocalDeliveryCodReceivedPayload = {}
): Promise<LocalDeliveryOrder> {
  const orderId =
    typeof orderIdOrPayload === "string"
      ? orderIdOrPayload
      : orderIdOrPayload.orderId;

  const payload =
    typeof orderIdOrPayload === "string"
      ? maybePayload
      : {
          paymentSourceId: orderIdOrPayload.paymentSourceId,
          amount: orderIdOrPayload.amount,
          note: orderIdOrPayload.note,
        };

  const data = await request<any>(
    `/finance/local-delivery-reconciliation/${encodeURIComponent(orderId)}/cod-received`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  return normalizeLocalDeliveryOrder(data?.data || data);
}
