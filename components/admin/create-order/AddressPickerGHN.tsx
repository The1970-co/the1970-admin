"use client";

import { useEffect, useState } from "react";
import {
  getGhnDistricts,
  getGhnProvinces,
  getGhnWards,
  type GhnDistrict,
  type GhnProvince,
  type GhnWard,
} from "@/lib/create-order-api";

type Props = {
  initialProvinceName?: string;
  initialDistrictName?: string;
  initialWardName?: string;
  onChange: (payload: {
    provinceId?: number;
    districtId?: number;
    wardCode?: string;
    provinceName?: string;
    districtName?: string;
    wardName?: string;
  }) => void;
};

export default function AddressPickerGHN({
  initialProvinceName,
  initialDistrictName,
  initialWardName,
  onChange,
}: Props) {
  const [provinces, setProvinces] = useState<GhnProvince[]>([]);
  const [districts, setDistricts] = useState<GhnDistrict[]>([]);
  const [wards, setWards] = useState<GhnWard[]>([]);

  const [provinceId, setProvinceId] = useState<number | "">("");
  const [districtId, setDistrictId] = useState<number | "">("");
  const [wardCode, setWardCode] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const rows = await getGhnProvinces();
      setProvinces(rows);

      if (initialProvinceName) {
        const found = rows.find(
          (p) =>
            p.ProvinceName.trim().toLowerCase() ===
            initialProvinceName.trim().toLowerCase()
        );
        if (found) setProvinceId(found.ProvinceID);
      }
    })();
  }, [initialProvinceName]);

  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setDistrictId("");
      setWards([]);
      setWardCode("");
      return;
    }

    void (async () => {
      const rows = await getGhnDistricts(Number(provinceId));
      setDistricts(rows);

      if (initialDistrictName) {
        const found = rows.find(
          (d) =>
            d.DistrictName.trim().toLowerCase() ===
            initialDistrictName.trim().toLowerCase()
        );
        if (found) setDistrictId(found.DistrictID);
      }
    })();
  }, [provinceId, initialDistrictName]);

  useEffect(() => {
    if (!districtId) {
      setWards([]);
      setWardCode("");
      return;
    }

    void (async () => {
      const rows = await getGhnWards(Number(districtId));
      setWards(rows);

      if (initialWardName) {
        const found = rows.find(
          (w) =>
            w.WardName.trim().toLowerCase() ===
            initialWardName.trim().toLowerCase()
        );
        if (found) setWardCode(found.WardCode);
      }
    })();
  }, [districtId, initialWardName]);

  useEffect(() => {
    const province = provinces.find((p) => p.ProvinceID === provinceId);
    const district = districts.find((d) => d.DistrictID === districtId);
    const ward = wards.find((w) => w.WardCode === wardCode);

    onChange({
      provinceId: typeof provinceId === "number" ? provinceId : undefined,
      districtId: typeof districtId === "number" ? districtId : undefined,
      wardCode: wardCode || undefined,
      provinceName: province?.ProvinceName,
      districtName: district?.DistrictName,
      wardName: ward?.WardName,
    });
  }, [provinceId, districtId, wardCode, provinces, districts, wards, onChange]);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <select
        className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
        value={provinceId}
        onChange={(e) => {
          setProvinceId(e.target.value ? Number(e.target.value) : "");
          setDistrictId("");
          setWardCode("");
        }}
      >
        <option value="">Chọn tỉnh / thành</option>
        {provinces.map((province) => (
          <option key={province.ProvinceID} value={province.ProvinceID}>
            {province.ProvinceName}
          </option>
        ))}
      </select>

      <select
        className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
        value={districtId}
        onChange={(e) => {
          setDistrictId(e.target.value ? Number(e.target.value) : "");
          setWardCode("");
        }}
      >
        <option value="">Chọn quận / huyện</option>
        {districts.map((district) => (
          <option key={district.DistrictID} value={district.DistrictID}>
            {district.DistrictName}
          </option>
        ))}
      </select>

      <select
        className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
        value={wardCode}
        onChange={(e) => setWardCode(e.target.value)}
      >
        <option value="">Chọn phường / xã</option>
        {wards.map((ward) => (
          <option key={ward.WardCode} value={ward.WardCode}>
            {ward.WardName}
          </option>
        ))}
      </select>
    </div>
  );
}