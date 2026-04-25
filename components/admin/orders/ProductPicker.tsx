"use client";

import { memo, useEffect, useRef, useState } from "react";

type ProductVariant = {
  id: string;
  productName: string;
  sku: string;
  color?: string;
  size?: string;
  price: number;
};

function ProductPicker({
  value = "",
  onSelect,
}: {
  value?: string;
  onSelect: (variant: ProductVariant) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const keyword = query.trim();

    if (keyword.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);

        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        const res = await fetch(
          `http://localhost:3001/products?q=${encodeURIComponent(keyword)}`,
          {
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          }
        );

        const json = await res.json().catch(() => []);
        const variants: ProductVariant[] = [];

        (json || []).forEach((p: any) => {
          (p.variants || []).forEach((v: any) => {
            variants.push({
              id: String(v.id),
              productName: p.name,
              sku: v.sku,
              color: v.color,
              size: v.size,
              price: Number(v.priceVnd || v.price || 0),
            });
          });
        });

        setResults(variants.slice(0, 20));
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    };

    const t = window.setTimeout(run, 350);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  return (
    <div ref={rootRef} className="relative w-full min-w-[340px]">
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Tìm sản phẩm / SKU..."
        className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-[12px] outline-none focus:border-neutral-500"
      />

      {open ? (
        <div className="absolute left-0 right-0 top-[46px] z-[100] max-h-80 min-w-[420px] overflow-auto rounded-2xl border border-neutral-200 bg-white p-1 shadow-2xl">
          {loading ? (
            <div className="px-3 py-2 text-xs text-neutral-500">
              Đang tìm...
            </div>
          ) : query.trim().length < 2 ? (
            <div className="px-3 py-2 text-xs text-neutral-500">
              Nhập ít nhất 2 ký tự
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-500">
              Không có kết quả
            </div>
          ) : (
            results.map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => {
                  onSelect(v);
                  setQuery(v.productName);
                  setResults([]);
                  setOpen(false);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left hover:bg-neutral-50"
              >
                <div className="text-[12px] font-medium text-neutral-900">
                  {v.productName}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  {v.sku} • {v.color || "-"} • {v.size || "-"} •{" "}
                  {v.price.toLocaleString("vi-VN")}đ
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default memo(ProductPicker);