import { API_BASE } from "@/lib/api-base";
export type CustomerAddressItem = {
  id: string;
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerItem = {
  id: string;
  legacyCode?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  customerGroup?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  points?: number | null;
  totalSpent?: number | string | null;
  totalOrders?: number | null;
  lastOrderAt?: string | null;

  defaultDiscountPercent?: number | null;
  pricePolicyName?: string | null;
  customerNote?: string | null;
  lastImportedAt?: string | null;
  lastImportedSource?: string | null;

  createdAt?: string;
  updatedAt?: string;
  addresses?: CustomerAddressItem[];
};

export type CreateCustomerPayload = {
  legacyCode?: string;
  fullName: string;
  phone?: string;
  email?: string;
  source?: string;
  customerGroup?: string;
  gender?: string;
  birthDate?: string;
  points?: number;

  totalSpent?: number;
  totalOrders?: number;
  lastOrderAt?: string;

  defaultDiscountPercent?: number;
  pricePolicyName?: string;
  customerNote?: string;
  lastImportedSource?: string;

  addressLine1?: string;
  addressLine2?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  label?: string;
  recipientName?: string;
  isDefaultAddress?: boolean;
};

export type UpdateCustomerPayload = {
  legacyCode?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  source?: string;
  customerGroup?: string;
  gender?: string;
  birthDate?: string;
  points?: number;

  totalSpent?: number;
  totalOrders?: number;
  lastOrderAt?: string;

  defaultDiscountPercent?: number;
  pricePolicyName?: string;
  customerNote?: string;
  lastImportedSource?: string;

  addressLine1?: string;
  addressLine2?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  label?: string;
  recipientName?: string;
  isDefaultAddress?: boolean;
};

export type CreateCustomerAddressPayload = {
  label?: string;
  recipientName?: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
};

export type UpdateCustomerAddressPayload = {
  label?: string;
  recipientName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
};


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("auth_token")
      : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = "API request failed";
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || JSON.stringify(data);
    } catch {
      const text = await res.text();
      message = text || message;
    }
    throw new Error(message);
  }

  return res.json();
}

export async function getCustomers(): Promise<CustomerItem[]> {
  return request<CustomerItem[]>("/customers");
}

export async function getCustomerById(id: string): Promise<CustomerItem> {
  return request<CustomerItem>(`/customers/${id}`);
}

export async function getCustomerImportHistory(id: string): Promise<any> {
  return request<any>(`/customers/${id}/import-history`);
}

export async function getCustomerAddresses(
  customerId: string
): Promise<CustomerAddressItem[]> {
  return request<CustomerAddressItem[]>(`/customers/${customerId}/addresses`);
}

export async function createCustomerAddress(
  customerId: string,
  payload: CreateCustomerAddressPayload
): Promise<CustomerAddressItem> {
  return request<CustomerAddressItem>(`/customers/${customerId}/addresses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  payload: UpdateCustomerAddressPayload
): Promise<CustomerAddressItem> {
  return request<CustomerAddressItem>(
    `/customers/${customerId}/addresses/${addressId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function setDefaultCustomerAddress(
  customerId: string,
  addressId: string
): Promise<CustomerAddressItem[]> {
  return request<CustomerAddressItem[]>(
    `/customers/${customerId}/addresses/${addressId}/set-default`,
    {
      method: "POST",
    }
  );
}

export async function createCustomer(
  payload: CreateCustomerPayload
): Promise<CustomerItem> {
  return request<CustomerItem>("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload
): Promise<CustomerItem> {
  return request<CustomerItem>(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}