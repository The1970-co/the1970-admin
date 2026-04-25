"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

export default function SearchableSelect({
  value,
  options,
  placeholder = "Chọn",
  searchPlaceholder = "Tìm nhanh...",
  onChange,
  disabled = false,
  emptyText = "Không có dữ liệu",
}: {
  value: string;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyText?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((item) => item.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          setQuery("");
        }}
        className={`flex w-full items-center justify-between rounded-2xl border border-neutral-300 px-4 py-3 text-left text-sm outline-none ${
          disabled ? "cursor-not-allowed bg-neutral-100 text-neutral-400" : "bg-white"
        }`}
      >
        <span className={selected ? "text-neutral-900" : "text-neutral-400"}>
          {selected?.label || placeholder}
        </span>
        <span className="ml-3 text-neutral-400">▾</span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="max-h-64 overflow-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-neutral-500">
                {emptyText}
              </div>
            ) : (
              filtered.map((item) => {
                const active = item.value === value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <span>{item.label}</span>
                    {active ? <span>✓</span> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}