"use client";

import { useState } from "react";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

type Template = {
  id: string;
  branch: string;
  type: string;
  size: string;
  storeName: string;
  phone: string;
  address: string;
};

const DEFAULTS: Template[] = [
  {
    id: "1",
    branch: "thai-ha",
    type: "shipping",
    size: "80mm",
    storeName: "THE 1970 - Thái Hà",
    phone: "0975615475",
    address: "Thái Hà, Hà Nội",
  },
  {
    id: "2",
    branch: "chua-lang",
    type: "shipping",
    size: "80mm",
    storeName: "THE 1970 - Chùa Láng",
    phone: "0975615475",
    address: "Chùa Láng, Hà Nội",
  },
];

export default function PrintTemplatesPageClient() {
  const [data, setData] = useState(DEFAULTS);
  const [selected, setSelected] = useState(DEFAULTS[0]);

  const update = (key: keyof Template, value: string) => {
    const updated = { ...selected, [key]: value };
    setSelected(updated);
    setData((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel>
        <h3 className="font-semibold mb-3">Danh sách mẫu</h3>

        {data.map((t) => (
          <div
            key={t.id}
            onClick={() => setSelected(t)}
            className={`p-3 border rounded-lg mb-2 cursor-pointer ${
              selected.id === t.id ? "bg-neutral-100" : ""
            }`}
          >
            <p className="text-sm font-medium">{t.storeName}</p>
            <p className="text-xs text-neutral-500">
              {t.branch} · {t.type} · {t.size}
            </p>
          </div>
        ))}
      </Panel>

      <Panel>
        <h3 className="font-semibold mb-3">Chỉnh sửa</h3>

        <div className="space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={selected.storeName}
            onChange={(e) => update("storeName", e.target.value)}
          />

          <input
            className="w-full border rounded-lg px-3 py-2"
            value={selected.phone}
            onChange={(e) => update("phone", e.target.value)}
          />

          <input
            className="w-full border rounded-lg px-3 py-2"
            value={selected.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
      </Panel>
    </div>
  );
}