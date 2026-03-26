"use client";

import { useState } from "react";

type Decision = {
  id: number;
  name: string;
  status: "PENDING" | "APPROVED";
};

export default function AutopilotPage() {
  const [decisions, setDecisions] = useState<Decision[]>([
    { id: 1, name: "Scale Campaign A", status: "PENDING" },
    { id: 2, name: "Cut Ad B", status: "PENDING" },
    { id: 3, name: "Increase budget C", status: "APPROVED" },
  ]);

  const approve = (id: number) => {
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "APPROVED" } : d
      )
    );
  };

  const approveAll = () => {
    setDecisions((prev) =>
      prev.map((d) => ({ ...d, status: "APPROVED" }))
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Autopilot</h1>

      <button
        onClick={approveAll}
        className="px-4 py-2 bg-black text-white rounded-xl"
      >
        Approve All
      </button>

      <div className="space-y-3">
        {decisions.map((d) => (
          <div
            key={d.id}
            className="flex justify-between items-center p-4 border rounded-xl bg-white"
          >
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-sm text-gray-500">
                {d.status}
              </div>
            </div>

            {d.status === "PENDING" && (
              <button
                onClick={() => approve(d.id)}
                className="px-3 py-1 bg-green-600 text-white rounded-lg"
              >
                Approve
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}