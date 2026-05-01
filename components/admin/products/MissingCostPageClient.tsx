"use client";

import { useEffect, useState } from "react";
import { getMissingCostProducts } from "@/lib/missing-cost-api";

export default function MissingCostPageClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await getMissingCostProducts();

      // 🔥 CHỈ SET DATA – KHÔNG LÀM GÌ KHÁC
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      alert("Lỗi load data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">
        Sản phẩm thiếu giá nhập ({rows.length})
      </h1>

      {/* 🔥 SCROLL BOX */}
      <div className="h-[600px] overflow-y-scroll border">
        {rows.map((r) => (
          <div
            key={r.id}
            className="border-b p-2 flex gap-4 text-sm"
          >
            <div className="w-[150px]">{r.sku}</div>
            <div className="w-[250px]">{r.product?.name}</div>
            <div className="w-[120px]">{r.color}</div>
            <div className="w-[80px]">{r.size}</div>
            <div className="w-[120px]">
              {Number(r.price).toLocaleString()}đ
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}