"use client";

import { API_BASE } from "@/lib/api-base";
import { useState } from "react";
import Link from "next/link";

export default function ReturnsSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const search = async () => {
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${API_BASE}/returns/search-orders?q=${encodeURIComponent(q)}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    const data = await res.json();
    setResults(data || []);
  };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold">Đổi trả hàng</h1>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border px-3 py-2 w-full"
          placeholder="SĐT / mã đơn / SKU"
        />
        <button onClick={search} className="bg-black text-white px-4">
          Tìm
        </button>
      </div>

      <div className="space-y-3">
        {results.map((o) => (
          <Link
            key={o.id}
            href={`/returns/create?orderId=${o.id}`}
            className="block border p-3 rounded"
          >
            <div className="font-semibold">{o.orderCode}</div>
            <div className="text-sm text-gray-500">
              {o.customerName} · {o.customerPhone}
            </div>
            <div className="text-xs text-gray-400">
              Chi nhánh: {o.branchId}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}