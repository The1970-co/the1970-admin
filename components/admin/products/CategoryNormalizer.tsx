"use client";

import { API_BASE } from "@/lib/api-base";
import { useMemo, useState } from "react";
import Link from "next/link";


function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*:]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CategoryNormalizer({
  categories,
  onDone,
}: {
  categories: string[];
  onDone: () => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const groupedSuggestions = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const category of categories) {
      const clean = String(category || "").trim();
      if (!clean) continue;
      const key = normalizeHeader(clean);
      map.set(key, [...(map.get(key) || []), clean]);
    }

    return Array.from(map.values()).filter((items) => items.length > 1);
  }, [categories]);

  const toggle = (category: string) => {
    setSelected((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const applySuggestion = (items: string[]) => {
    setSelected(items);
    setTarget(items[0] || "");
  };

  const handleMerge = async () => {
    const cleanTarget = target.trim();

    if (!selected.length) {
      setMessage("Chọn ít nhất 1 danh mục cần chuẩn hoá.");
      return;
    }

    if (!cleanTarget) {
      setMessage("Nhập tên danh mục chuẩn.");
      return;
    }

    try {
      setBusy(true);
      setMessage("Đang chuẩn hoá danh mục...");

      let updated = 0;

      for (const oldName of selected) {
        const res = await fetch(`${API_BASE}/products/rename-category`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldName, newName: cleanTarget }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Không đổi được danh mục ${oldName}`);
        }

        const data = await res.json().catch(() => null);
        updated += Number(data?.updated || 0);
      }

      setSelected([]);
      setTarget("");
      setMessage(`Đã chuẩn hoá ${updated} sản phẩm về danh mục "${cleanTarget}".`);
      await onDone();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Chuẩn hoá danh mục thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Chuẩn hoá danh mục sản phẩm</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Gộp các tên lệch dấu, viết hoa/thường về 1 tên chuẩn. Sau khi gộp, filter danh mục sẽ sạch hơn.
          </p>
        </div>

        <Link
          href="/control/product-categories"
          className="inline-flex rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Cấu hình danh mục
        </Link>
      </div>

      {groupedSuggestions.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Gợi ý danh mục có thể bị trùng
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {groupedSuggestions.slice(0, 8).map((items) => (
              <button
                key={items.join("|")}
                type="button"
                onClick={() => applySuggestion(items)}
                className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                {items.join(" / ")}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="max-h-56 overflow-auto rounded-2xl border border-neutral-200 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            {categories.map((category) => (
              <label
                key={category}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-neutral-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(category)}
                  onChange={() => toggle(category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Tên danh mục chuẩn, ví dụ: Áo sơ mi"
          />

          <button
            type="button"
            disabled={busy}
            onClick={handleMerge}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Đang gộp..." : "Gộp về tên chuẩn"}
          </button>

          {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}