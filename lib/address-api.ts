import { API_BASE } from "@/lib/api-base";

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

  if (!res.ok) throw new Error("API error");

  return res.json();
}

export async function getProvinces(): Promise<ProvinceItem[]> {
  return request("/address/provinces");
}

export async function getDistricts(provinceId: number) {
  return request(`/address/districts?provinceId=${provinceId}`);
}

export async function getWards(districtId: number) {
  return request(`/address/wards?districtId=${districtId}`);
}