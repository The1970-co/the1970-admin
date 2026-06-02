import { apiFetch } from "@/lib/api";
export type ViettelPostInventory = {
  group_address_id?: number;
  groupAddressId?: number;
  cus_id?: number;
  cusId?: number;
  name?: string;
  phone?: string;
  address?: string;
  province_id?: number;
  provinceId?: number;
  district_id?: number;
  districtId?: number;
  wards_id?: number;
  wardsId?: number;
  ward_id?: number;
  wardId?: number;
};


export type PickupCarrier = "ghn" | "viettelpost" | "ahamove";

export type PickupLocation = {
  id: string;
  carrier: PickupCarrier;
  label: string;
  name?: string;
  phone?: string;
  address?: string;

  ghnShopId?: number;
  ghnFromDistrictId?: number;
  ghnFromWardCode?: string;

  viettelGroupAddressId?: number;
  groupAddressId?: number;
  viettelProvinceId?: number;
  viettelDistrictId?: number;
  viettelWardId?: number;
};

export type CreateOrderMode = "draft" | "approve" | "ship";

export type DeliveryRequirementKey =
  | "CHOXEMHANG_KHONGTHU"
  | "CHOXEMHANG_CHOTHU"
  | "KHONGCHOXEMHANG";

export type CarrierDeliveryNoteFields = {
  /** Ghi chú gửi sang hãng vận chuyển / hiển thị trên phiếu in. */
  note?: string;
  /** Alias cho một số backend/mẫu in cũ đang đọc shippingNote. */
  shippingNote?: string;
  /** Giá trị UI nội bộ để giữ đúng lựa chọn gốc. */
  deliveryRequirement?: DeliveryRequirementKey | string;
  /** Mã GHN: CHOXEMHANGKHONGTHU / CHOXEMHANG / KHONGCHOXEMHANG. */
  requiredNote?: string;
  /** Alias snake_case cho backend/hãng dùng required_note. */
  required_note?: string;
  /** Nhãn tiếng Việt: Cho xem hàng, không cho thử... */
  requiredNoteLabel?: string;
  /** GHN: bật/tắt yêu cầu giao thất bại thu tiền. */
  failedDeliveryFee30k?: boolean;
  /** GHN: số tiền thu khi giao thất bại. */
  failedDeliveryCodAmount?: number;
  /** Alias camelCase cho backend cũ/mới. */
  codFailedAmount?: number;
  /** Alias snake_case đúng payload GHN. */
  cod_failed_amount?: number;
};

export type OrderProductVariant = {
  id: string;
  sku: string;
  color?: string;
  size?: string;
  price: number;
  stock: number;
  productCode?: string;
  branchStocks?: Record<string, number>;
};

export type OrderProduct = {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  variants: OrderProductVariant[];
};

export type CreateOrderShippingSnapshot = {
  shippingAddressId?: string;
  shippingFee?: number;
  customerShippingFee?: number;
  ghnActualFee?: number;
  shippingRecipientName?: string;
  shippingPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingWard?: string;
  shippingDistrict?: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
  shippingGhnDistrictId?: number;
  shippingGhnWardCode?: string;
  shippingPartner?: string;
  shippingPayer?: string;
  skipAutoShipment?: boolean;
  note?: string;
  shippingNote?: string;
  deliveryRequirement?: DeliveryRequirementKey | string;
  requiredNote?: string;
  required_note?: string;
  requiredNoteLabel?: string;
  failedDeliveryFee30k?: boolean;
  failedDeliveryCodAmount?: number;
  codFailedAmount?: number;
  cod_failed_amount?: number;
  selectedServiceId?: number;
  selectedServiceTypeId?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
};

export type CreateOrderPayload = {
  customerId?: string;
  salesChannel: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  note?: string;
  mode?: CreateOrderMode;
  discountAmount?: number;
  shippingFee?: number;
  shipFee?: number;
  deliveryFee?: number;
  paidAmount?: number;
  paymentSourceId?: string | null;
  paymentNote?: string;
  skipAutoShipment?: boolean;
  deliveryMethod?: string;
  shippingMethod?: string;
  fulfillmentType?: string;
  shippingNote?: string;
  deliveryRequirement?: DeliveryRequirementKey | string;
  requiredNote?: string;
  required_note?: string;
  requiredNoteLabel?: string;
  failedDeliveryFee30k?: boolean;
  failedDeliveryCodAmount?: number;
  codFailedAmount?: number;
  cod_failed_amount?: number;
  finalAmount?: number;
  items: Array<{
    variantId: string;
    qty: number;
  }>;
  shippingSnapshot?: CreateOrderShippingSnapshot;
};

export type CreatedOrder = {
  id: string;
  orderCode: string;
};

export type CustomerLookupResult = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  totalOrders?: number;
  totalSpent?: number | string;
  addresses?: any[];
  pricePolicyName?: string;
  defaultDiscountPercent?: number;
};

export type CreateCustomerPayload = {
  legacyCode?: string;
  fullName: string;
  phone: string;
  email?: string;
  source?: string;
  addressLine1?: string;
  addressLine2?: string;
  ward?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  recipientName?: string;
  customerNote?: string;
  label?: string;
  isDefaultAddress?: boolean;
};

export type SearchCustomerItem = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  addresses?: any[];
  pricePolicyName?: string;
  defaultDiscountPercent?: number;
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
  fromDistrictId?: number;
  fromWardCode?: string;
  fromName?: string;
  fromPhone?: string;
  fromAddress?: string;
};

export type ShipmentQuoteResult = {
  serviceId: number;
  serviceTypeId: number;
  shortName?: string;
  fee?: any;
  leadtime?: any;
  [key: string]: any;
};

export type ResolveGhnAddressPayload = {
  province?: string;
  district?: string;
  ward?: string;
};

export type ResolveGhnAddressResult = {
  provinceId?: number;
  districtId?: number;
  wardCode?: string;
  provinceName?: string;
  districtName?: string;
  wardName?: string;
};

export type CreateGhnShipmentPayload = CarrierDeliveryNoteFields & {
  toName: string;
  toPhone: string;
  toAddress: string;
  toDistrictId: number;
  toWardCode: string;
  codAmount: number;
  clientOrderCode: string;
  content?: string;
  fromDistrictId?: number;
  fromWardCode?: string;
  fromName?: string;
  fromPhone?: string;
  fromAddress?: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  insuranceValue?: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    length: number;
    width: number;
    height: number;
    weight: number;
    category?: string;
  }>;
};

export type AhamoveQuoteItem = {
  name: string;
  num?: number;
  quantity?: number;
  price?: number;
  weight?: number;
};

export type AhamoveQuotePayload = {
  fromName?: string;
  fromPhone?: string;
  fromAddress?: string;
  toName: string;
  toPhone: string;
  toAddress: string;
  codAmount?: number;
  serviceId?: string;
  services?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  payment_method?: string;
  paymentMethod?: string;
  order_time?: number;
  orderTime?: number;
  note?: string;
  items?: AhamoveQuoteItem[];
};

export type CreateAhamoveShipmentPayload = AhamoveQuotePayload &
  CarrierDeliveryNoteFields & {
    clientOrderCode?: string;
    orderCode?: string;
  };

export type ViettelPostQuotePayload = {
  toName?: string;
  toPhone?: string;
  toAddress?: string;
  toProvince?: string;
  toDistrict?: string;
  toWard?: string;

  fromName?: string;
  fromPhone?: string;
  fromAddress?: string;

  senderGroupAddressId?: number;
  senderProvinceId?: number;
  senderDistrictId?: number;
  senderWardId?: number;

  province?: string;
  district?: string;
  ward?: string;

  codAmount?: number;
  productPrice?: number;
  insuranceValue?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  services?: string;
};
export type CreateViettelPostShipmentPayload = ViettelPostQuotePayload &
  CarrierDeliveryNoteFields & {
    clientOrderCode?: string;
    orderCode?: string;
    serviceCode?: string;
    content?: string;
    items?: Array<{
      name: string;
      quantity?: number;
      qty?: number;
      num?: number;
      price?: number;
      weight?: number;
    }>;
  };

export type AhamoveQuoteResult =
  | {
      serviceId?: string;
      service_id?: string;
      fee?: number;
      totalFee?: number;
      total_fee?: number;
      totalPrice?: number;
      total_price?: number;
      distance?: number;
      duration?: number;
      raw?: any;
      data?: any;
    }
  | Array<any>;

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
    return [] as unknown as T;
  }

  return JSON.parse(text) as T;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  return Number(value || 0);
}

function normalizeBranchStocks(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      toNumber(value),
    ]),
  );
}

function normalizeSalesChannel(input: string) {
  return input === "ADMIN"
    ? "SHOWROOM"
    : input === "FACEBOOK"
      ? "FACEBOOK_MANUAL"
      : input;
}

export async function getProductsForOrder(): Promise<OrderProduct[]> {
  const raw = await request<any>("/products?page=1&pageSize=1000&limit=1000");

  const products = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

  return products.map((product: any) => {
    const productCode = String(
      product.sku ||
        product.code ||
        product.productCode ||
        product.mainSku ||
        product.slug ||
        "",
    );

    return {
      id: String(product.id),
      name: String(product.name || ""),
      slug: product.slug || "",
      imageUrl: product.imageUrl || product.thumbnailUrl || "",
      variants: Array.isArray(product.variants)
        ? product.variants.map((variant: any) => {
            const branchStocks = normalizeBranchStocks(
              variant.inventoryByBranch || variant.branchStocks,
            );

            const stock =
              Object.keys(branchStocks).length > 0
                ? Object.values(branchStocks).reduce(
                    (sum, qty) => sum + toNumber(qty),
                    0,
                  )
                : Array.isArray(variant.inventoryItems)
                  ? variant.inventoryItems.reduce(
                      (sum: number, item: any) =>
                        sum + toNumber(item.availableQty),
                      0,
                    )
                  : toNumber(variant.stock ?? variant.availableQty ?? 0);

            return {
              id: String(variant.id),
              sku: String(variant.sku || ""),
              productCode,
              color: variant.color || "",
              size: variant.size || "",
              price: toNumber(variant.price),
              stock,
              branchStocks:
                Object.keys(branchStocks).length > 0
                  ? branchStocks
                  : Array.isArray(variant.inventoryItems)
                    ? Object.fromEntries(
                        variant.inventoryItems.map((item: any) => [
                          String(item.branchId),
                          toNumber(item.availableQty),
                        ]),
                      )
                    : {},
            };
          })
        : [],
    };
  });
}

export async function findCustomerByPhone(phone: string): Promise<any[]> {
  const cleaned = String(phone || "").replace(/\D/g, "");

  const candidates = cleaned
    ? [
        `/customers/search?phone=${cleaned}`,
        `/customers/search?q=${cleaned}`,
        `/customers?search=${cleaned}`,
        `/customers?phone=${cleaned}`,
      ]
    : [`/customers/search`, `/customers/search?phone=`, `/customers`];

  for (const path of candidates) {
    try {
      const data = await request<any>(path);

      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.data)) return data.data;
      if (data) return [data];
    } catch {
      continue;
    }
  }

  return [];
}

export async function createCustomer(
  payload: CreateCustomerPayload,
): Promise<CustomerLookupResult> {
  const body = {
    legacyCode: payload.legacyCode?.trim() || undefined,
    fullName: payload.fullName.trim(),
    phone: String(payload.phone || "").replace(/\D/g, ""),
    email: payload.email?.trim() || undefined,
    source: payload.source || "ADMIN",
    addressLine1: payload.addressLine1?.trim() || undefined,
    addressLine2: payload.addressLine2?.trim() || undefined,
    ward: payload.ward?.trim() || undefined,
    district: payload.district?.trim() || undefined,
    province: payload.province?.trim() || undefined,
    postalCode: payload.postalCode?.trim() || undefined,
    recipientName: payload.recipientName?.trim() || undefined,
    customerNote: payload.customerNote?.trim() || undefined,
    label: payload.label?.trim() || undefined,
    isDefaultAddress: payload.isDefaultAddress ?? true,
  };

  const data = await request<any>("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: String(data.id),
    fullName: String(data.fullName || ""),
    phone: data.phone || null,
    email: data.email || null,
    totalOrders: typeof data.totalOrders === "number" ? data.totalOrders : 0,
    totalSpent: data.totalSpent ?? 0,
    addresses: Array.isArray(data.addresses) ? data.addresses : [],
    pricePolicyName: data.pricePolicyName || "",
    defaultDiscountPercent: Number(data.defaultDiscountPercent || 0),
  };
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreatedOrder> {
  const customerShippingFee = toNumber(
    payload.shippingFee ??
      payload.shipFee ??
      payload.deliveryFee ??
      payload.shippingSnapshot?.shippingFee ??
      payload.shippingSnapshot?.customerShippingFee ??
      0,
  );

  const body = {
    customerId: payload.customerId,
    salesChannel: normalizeSalesChannel(payload.salesChannel),
    note: payload.note || "",
    customerName: payload.customerName,
    customerPhone: String(payload.customerPhone || "").replace(/\D/g, ""),
    branchId: payload.branchId,
    mode: payload.mode || "draft",
    discountAmount: toNumber(payload.discountAmount || 0),
    shippingFee: customerShippingFee,
    shipFee: customerShippingFee,
    deliveryFee: customerShippingFee,
    paidAmount:
      payload.paidAmount !== undefined
        ? toNumber(payload.paidAmount)
        : undefined,
    paymentSourceId: payload.paymentSourceId || undefined,
    paymentNote: payload.paymentNote || payload.note || "",
    skipAutoShipment: payload.skipAutoShipment,
    deliveryMethod: payload.deliveryMethod,
    shippingMethod: payload.shippingMethod,
    fulfillmentType: payload.fulfillmentType,
    shippingNote: payload.shippingNote,
    deliveryRequirement: payload.deliveryRequirement,
    requiredNote: payload.requiredNote,
    required_note: payload.required_note,
    requiredNoteLabel: payload.requiredNoteLabel,
    failedDeliveryFee30k: payload.failedDeliveryFee30k,
    failedDeliveryCodAmount: payload.failedDeliveryCodAmount,
    codFailedAmount: payload.codFailedAmount,
    cod_failed_amount: payload.cod_failed_amount,
    finalAmount:
      payload.finalAmount !== undefined
        ? toNumber(payload.finalAmount)
        : undefined,
    shippingSnapshot: payload.shippingSnapshot
      ? {
          skipAutoShipment: payload.shippingSnapshot.skipAutoShipment,
          note: payload.shippingSnapshot.note,
          shippingNote: payload.shippingSnapshot.shippingNote,
          deliveryRequirement: payload.shippingSnapshot.deliveryRequirement,
          requiredNote: payload.shippingSnapshot.requiredNote,
          required_note: payload.shippingSnapshot.required_note,
          requiredNoteLabel: payload.shippingSnapshot.requiredNoteLabel,
          failedDeliveryFee30k: payload.shippingSnapshot.failedDeliveryFee30k,
          failedDeliveryCodAmount: payload.shippingSnapshot.failedDeliveryCodAmount,
          codFailedAmount: payload.shippingSnapshot.codFailedAmount,
          cod_failed_amount: payload.shippingSnapshot.cod_failed_amount,
          shippingAddressId: payload.shippingSnapshot.shippingAddressId,
          shippingFee: customerShippingFee,
          customerShippingFee,
          ghnActualFee: toNumber(payload.shippingSnapshot.ghnActualFee || 0),
          shippingRecipientName: payload.shippingSnapshot.shippingRecipientName,
          shippingPhone: payload.shippingSnapshot.shippingPhone,
          shippingAddressLine1: payload.shippingSnapshot.shippingAddressLine1,
          shippingAddressLine2: payload.shippingSnapshot.shippingAddressLine2,
          shippingWard: payload.shippingSnapshot.shippingWard,
          shippingDistrict: payload.shippingSnapshot.shippingDistrict,
          shippingProvince: payload.shippingSnapshot.shippingProvince,
          shippingPostalCode: payload.shippingSnapshot.shippingPostalCode,
          ghnDistrictId: payload.shippingSnapshot.shippingGhnDistrictId,
          ghnWardCode: payload.shippingSnapshot.shippingGhnWardCode,
          shippingPartner: payload.shippingSnapshot.shippingPartner,
          shippingPayer: payload.shippingSnapshot.shippingPayer,
          selectedServiceId: payload.shippingSnapshot.selectedServiceId,
          selectedServiceTypeId: payload.shippingSnapshot.selectedServiceTypeId,
          weight: payload.shippingSnapshot.weight,
          length: payload.shippingSnapshot.length,
          width: payload.shippingSnapshot.width,
          height: payload.shippingSnapshot.height,
        }
      : undefined,
    items: payload.items.map((item) => ({
      variantId: item.variantId,
      qty: Number(item.qty || 0),
    })),
  };

  const data = await request<any>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: String(data.id),
    orderCode: String(data.orderCode || ""),
  };
}

export async function resolveGhnAddress(
  payload: ResolveGhnAddressPayload,
): Promise<ResolveGhnAddressResult> {
  return request<ResolveGhnAddressResult>("/shipments/ghn/resolve-address", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quoteShipment(
  payload: ShipmentQuotePayload,
): Promise<ShipmentQuoteResult[]> {
  const data = await request<any[]>("/shipments/ghn/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return Array.isArray(data) ? data : [];
}

export async function createGhnShipment(
  orderId: string,
  payload: CreateGhnShipmentPayload,
) {
  return request<any>(`/shipments/${orderId}/ghn/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quoteAhamoveShipment(
  payload: AhamoveQuotePayload,
): Promise<AhamoveQuoteResult> {
  return request<AhamoveQuoteResult>("/shipments/ahamove/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quoteViettelPostShipment(
  payload: ViettelPostQuotePayload,
): Promise<ShipmentQuoteResult[]> {
  const data = await request<any>("/shipments/viettelpost/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];
}

export async function createViettelPostShipment(
  orderId: string,
  payload: CreateViettelPostShipmentPayload,
) {
  return request<any>(`/shipments/${orderId}/viettelpost/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelViettelPostShipment(orderId: string) {
  return request<any>(`/shipments/${orderId}/viettelpost/cancel`, {
    method: "POST",
  });
}

export async function createAhamoveShipment(
  orderId: string,
  payload: CreateAhamoveShipmentPayload,
) {
  return request<any>(`/shipments/${orderId}/ahamove/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function trackAhamoveShipmentById(shipmentId: string) {
  return request<any>(`/shipments/ahamove/${shipmentId}/tracking`, {
    method: "GET",
  });
}

export async function cancelAhamoveShipment(orderId: string) {
  return request<any>(`/shipments/${orderId}/ahamove/cancel`, {
    method: "POST",
  });
}

export async function trackGhnShipment(payload: {
  orderCode?: string;
  clientOrderCode?: string;
}) {
  return request<any>("/shipments/ghn/track", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export type GhnProvince = {
  ProvinceID: number;
  ProvinceName: string;
};

export type GhnDistrict = {
  DistrictID: number;
  DistrictName: string;
  ProvinceID?: number;
};

export type GhnWard = {
  WardCode: string;
  WardName: string;
  DistrictID?: number;
};

export async function getGhnProvinces(): Promise<GhnProvince[]> {
  const data = await request<any>("/addresses/ghn/provinces");
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getGhnDistricts(
  provinceId: number,
): Promise<GhnDistrict[]> {
  const data = await request<any>(
    `/addresses/ghn/districts?provinceId=${provinceId}`,
  );
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getGhnWards(districtId: number): Promise<GhnWard[]> {
  const data = await request<any>(
    `/addresses/ghn/wards?districtId=${districtId}`,
  );
  return Array.isArray(data) ? data : data?.data || [];
}
export async function searchCustomers(
  query = "",
): Promise<SearchCustomerItem[]> {
  const cleaned = String(query || "").trim();

  const candidates = cleaned
    ? [
        `/customers/search?q=${encodeURIComponent(cleaned)}`,
        `/customers/search?phone=${encodeURIComponent(cleaned)}`,
        `/customers?search=${encodeURIComponent(cleaned)}`,
      ]
    : ["/customers/search", "/customers"];

  for (const path of candidates) {
    try {
      const data = await request<any>(path);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.data)) return data.data;
    } catch {
      continue;
    }
  }

  return [];
}
function normalizeViettelPostInventory(
  row: ViettelPostInventory,
): ViettelPostInventory {
  return {
    ...row,
    groupAddressId: row.groupAddressId ?? row.group_address_id,
    cusId: row.cusId ?? row.cus_id,
    provinceId: row.provinceId ?? row.province_id,
    districtId: row.districtId ?? row.district_id,
    wardId: row.wardId ?? row.ward_id ?? row.wards_id,
  };
}

export async function getPickupLocations(): Promise<PickupLocation[]> {
  const apiBase =
    process.env.NEXT_PUBLIC_CORE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("the1970_access_token") ||
        ""
      : "";

  const url = apiBase
    ? `${apiBase.replace(/\/$/, "")}/shipments/pickup-locations`
    : "/shipments/pickup-locations";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    let message = "Không load được kho lấy hàng";
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  const data = await res.json();

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rows.map((row: any) => ({
    ...row,
    id: String(
      row.id ||
        `${row.carrier || "carrier"}-${
          row.groupAddressId ||
          row.viettelGroupAddressId ||
          row.ghnShopId ||
          row.address ||
          "default"
        }`,
    ),
    carrier: String(row.carrier || "").toLowerCase() as PickupCarrier,
    label: String(row.label || row.name || row.address || "Kho lấy hàng"),
  }));
}

export async function getViettelPostInventories(): Promise<
  ViettelPostInventory[]
> {
  const data = await request<any>("/shipments/viettelpost/inventories");

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.vtp_inventories)
        ? data.vtp_inventories
        : Array.isArray(data?.inventories)
          ? data.inventories
          : [];

  return rows.map((row: ViettelPostInventory) =>
    normalizeViettelPostInventory(row),
  );
}

export async function getOrderForCopy(orderIdOrCode: string): Promise<any> {
  const rawKey = String(orderIdOrCode || "").trim();
  const key = encodeURIComponent(rawKey);

  const unwrapOrder = (data: any): any => {
    if (!data) return null;
    if (data?.id || data?.orderCode) return data;
    if (data?.data?.id || data?.data?.orderCode) return data.data;
    if (data?.order?.id || data?.order?.orderCode) return data.order;
    if (data?.item?.id || data?.item?.orderCode) return data.item;
    return data;
  };

  const normalizeList = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.orders)) return data.orders;
    return [];
  };

  const findExactOrder = (rows: any[]) => {
    const upperKey = rawKey.toUpperCase();
    return rows.find((row) => {
      return (
        String(row?.id || "").toUpperCase() === upperKey ||
        String(row?.orderCode || "").toUpperCase() === upperKey ||
        String(row?.code || "").toUpperCase() === upperKey
      );
    });
  };

  const fetchDetailById = async (order: any) => {
    const unwrapped = unwrapOrder(order);
    const id = unwrapped?.id ? String(unwrapped.id) : "";

    if (!id) return unwrapped;

    try {
      const detail = await request<any>(`/orders/${encodeURIComponent(id)}`);
      const detailOrder = unwrapOrder(detail);
      if (detailOrder?.id || detailOrder?.orderCode) return detailOrder;
    } catch {
      // Nếu detail lỗi thì vẫn trả dữ liệu tìm được.
    }

    return unwrapped;
  };

  const directCandidates = [
    `/orders/${key}`,
    `/orders/by-code/${key}`,
    `/orders/code/${key}`,
  ];

  for (const path of directCandidates) {
    try {
      const data = await request<any>(path);
      const directOrder = unwrapOrder(data);

      if (directOrder?.id || directOrder?.orderCode) {
        return await fetchDetailById(directOrder);
      }

      const rows = normalizeList(data);
      const found = findExactOrder(rows);
      if (found) return await fetchDetailById(found);
    } catch {
      continue;
    }
  }

  const listCandidates = [
    `/orders?page=1&pageSize=1000`,
    `/orders?page=1&limit=1000`,
    `/orders?search=${key}`,
    `/orders?q=${key}`,
    `/orders?orderCode=${key}`,
  ];

  for (const path of listCandidates) {
    try {
      const data = await request<any>(path);
      const rows = normalizeList(data);
      const found = findExactOrder(rows);

      if (found) {
        return await fetchDetailById(found);
      }
    } catch {
      continue;
    }
  }

  throw new Error("Không tìm thấy đơn hàng để sao chép.");
}
