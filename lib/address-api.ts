const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

export type ProvinceItem = {
  id: number;
  name: string;
  code?: string;
};

export type DistrictItem = {
  id: number;
  name: string;
};

export type WardItem = {
  code: string;
  name: string;
};

async function request<T>(path: string): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

  return res.json();
}

export async function getProvinces(): Promise<ProvinceItem[]> {
  return request<ProvinceItem[]>("/address/provinces");
}

export async function getDistricts(provinceId: number): Promise<DistrictItem[]> {
  return request<DistrictItem[]>(`/address/districts?provinceId=${provinceId}`);
}

export async function getWards(districtId: number): Promise<WardItem[]> {
  return request<WardItem[]>(`/address/wards?districtId=${districtId}`);
}