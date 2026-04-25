"use client";

import { useEffect, useRef, useState } from "react";
import { searchCustomers, type SearchCustomerItem } from "@/lib/create-order-api";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (customer: SearchCustomerItem) => void;
};

export default function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchCustomerItem[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const rows = await searchCustomers(value);
        setResults(rows);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder="Tìm khách theo tên hoặc số điện thoại"
      />

      {open ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
          {loading ? (
            <div className="px-4 py-3 text-sm text-neutral-500">Đang tìm khách...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-neutral-500">Không có khách phù hợp.</div>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onSelect(customer);
                  setOpen(false);
                }}
                className="block w-full border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50"
              >
                <div className="font-medium text-neutral-900">
                  {customer.fullName}
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {customer.phone || "—"}
                  {customer.pricePolicyName ? ` · ${customer.pricePolicyName}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}