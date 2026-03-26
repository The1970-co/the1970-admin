"use client";

import { useEffect, useState } from "react";

type Metric = {
  label: string;
  value: string;
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    // fake data (sau này nối API thật)
    setMetrics([
      { label: "Revenue", value: "32.4M" },
      { label: "Orders", value: "128" },
      { label: "ROAS", value: "3.84" },
      { label: "Pending Ads", value: "6" },
    ]);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl shadow bg-white border"
          >
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
    </div>
  );
}