"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  code: string;
  name: string;
  type: string;
};

const API = "http://localhost:3001";

export default function PaymentSourcesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("CASH");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  const load = async () => {
    const res = await fetch(`${API}/payment-sources`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name || !code) return;

    await fetch(`${API}/payment-sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name,
        code,
        type,
      }),
    });

    setName("");
    setCode("");
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Nguồn tiền</h1>

      {/* Form */}
      <div className="flex gap-2">
        <input
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="border px-3 h-9 rounded"
        />
        <input
          placeholder="Tên"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border px-3 h-9 rounded"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border px-3 h-9 rounded"
        >
          <option value="CASH">Tiền mặt</option>
          <option value="BANK">Chuyển khoản</option>
          <option value="CARD">Quẹt thẻ</option>
          <option value="COD">COD</option>
          <option value="PARTIAL">Một phần</option>
        </select>

        <button
          onClick={create}
          className="bg-black text-white px-4 rounded"
        >
          Thêm
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map((i) => (
          <div
            key={i.id}
            className="flex justify-between border p-3 rounded"
          >
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-gray-500">
                {i.code} • {i.type}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}