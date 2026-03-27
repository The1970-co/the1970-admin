"use client";

import { useEffect, useState } from "react";

type Metric = {
  label: string;
  value: string;
};

export default function DashboardPage({
  products,
  orders,
  lowStockVariants,
  activities,
  setTab,
}: any) {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    setMetrics([
      { label: "Revenue", value: "32.4M" },
      { label: "Orders", value: String(orders?.length || 0) },
      { label: "ROAS", value: "3.84" },
      { label: "Pending Ads", value: "6" },
    ]);
  }, [orders]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="p-4 rounded-2xl shadow bg-white border">
            <div className="text-sm text-gray-500">{m.label}</div>
            <div className="text-xl font-bold">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-4 bg-white">
        <h2 className="font-medium mb-2">System Status</h2>
        <p className="text-sm text-gray-600">
          All systems running. Autopilot ready.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-1">Products</div>
          <div className="text-2xl font-bold">{products?.length || 0}</div>
        </div>

        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-1">Low Stock Variants</div>
          <div className="text-2xl font-bold">{lowStockVariants?.length || 0}</div>
        </div>

        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm text-gray-500 mb-1">Activities</div>
          <div className="text-2xl font-bold">{activities?.length || 0}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setTab?.("orders")}
          className="px-4 py-2 rounded-xl bg-black text-white"
        >
          Go to Orders
        </button>

        <button
          onClick={() => setTab?.("products")}
          className="px-4 py-2 rounded-xl border"
        >
          Go to Products
        </button>
      </div>
    </div>
  );
}