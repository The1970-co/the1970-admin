"use client";

import { useState } from "react";
import { uploadMissingCostExcel } from "@/lib/missing-cost-excel-api";
type Row = {
  SKU?: string;
  sku?: string;
  "Tên sản phẩm"?: string;
  name?: string;
  "Màu"?: string;
  color?: string;
  "Size"?: string;
  size?: string;
  "Giá bán"?: number;
  price?: number;
  "Giá nhập"?: number;
  costPrice?: number;
};

function format(n: any) {
  return Number(n || 0).toLocaleString("vi-VN") + "đ";
}

export default function MissingCostFromExcelPageClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    missing: 0,
  });

  async function handleUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        "http://localhost:3001/products/missing-cost-from-excel",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      const list = data.data || [];

      setRows(list);

      setSummary({
        total: list.length,
        missing: list.length,
      });
    } catch (err) {
      console.error(err);
      alert("Upload lỗi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-bold">
          Kiểm tra sản phẩm thiếu giá nhập (Excel)
        </h1>
        <p className="text-sm text-gray-500">
          Upload file SAPO → hệ thống lọc ra sản phẩm chưa có giá nhập
        </p>
      </div>

      {/* UPLOAD */}
      <div className="flex items-center gap-4">
        <input type="file" onChange={handleUpload} />
        {loading && <span>Đang xử lý...</span>}
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl">
          <div className="text-sm text-gray-500">Tổng dòng</div>
          <div className="text-lg font-bold">{summary.total}</div>
        </div>

        <div className="p-4 border rounded-xl">
          <div className="text-sm text-gray-500">Thiếu giá nhập</div>
          <div className="text-lg font-bold text-red-600">
            {summary.missing}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="border rounded-xl overflow-hidden">
        {/* HEADER */}
        <div className="grid grid-cols-7 bg-gray-100 text-sm font-medium p-2">
          <div>SKU</div>
          <div>Tên</div>
          <div>Màu</div>
          <div>Size</div>
          <div>Giá bán</div>
          <div>Giá nhập</div>
          <div>Trạng thái</div>
        </div>

        {/* BODY */}
        <div className="h-[600px] overflow-y-auto">
          {rows.map((r, i) => {
            const cost =
              r["Giá nhập"] ?? r.costPrice ?? 0;

            const isMissing = Number(cost) <= 0;

            return (
              <div
                key={i}
                className={`grid grid-cols-7 text-sm p-2 border-b ${
                  isMissing ? "bg-red-50" : ""
                }`}
              >
                <div>{r["SKU"] || r.sku}</div>

                <div>
                  {r["Tên sản phẩm"] || r.name}
                </div>

                <div>{r["Màu"] || r.color}</div>

                <div>{r["Size"] || r.size}</div>

                <div>
                  {format(r["Giá bán"] || r.price)}
                </div>

                <div className="text-red-600">
                  {cost ? format(cost) : "0"}
                </div>

                <div>
                  {isMissing ? (
                    <span className="text-red-600 font-medium">
                      Thiếu giá
                    </span>
                  ) : (
                    <span className="text-green-600">
                      OK
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && !loading && (
            <div className="p-6 text-center text-gray-400">
              Chưa có dữ liệu
            </div>
          )}
        </div>
      </div>
    </div>
  );
}