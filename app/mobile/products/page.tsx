"use client";

import { API_BASE } from "@/lib/api-base";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BranchOption = {
  id: string;
  name: string;
};

type MobileProductVariant = {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  status: string;
  price: number;
  costPrice: number;
  availableQty: number;
  reservedQty: number;
  incomingQty: number;
};

type MobileProduct = {
  id: string;
  name: string;
  category: string | null;
  productType: string | null;
  brand: string | null;
  imageUrl: string | null;
  status: string;
  variantCount: number;
  totalAvailable: number;
  totalReserved: number;
  totalIncoming: number;
  minPrice: number;
  maxPrice: number;
  variants: MobileProductVariant[];
};

function money(v: number) {
  return new Intl.NumberFormat("vi-VN").format(v || 0);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "Đang bán",
    INACTIVE: "Tạm ẩn",
    DRAFT: "Nháp",
  };

  return map[status] || status;
}

async function fetchWithAuth<T>(path: string): Promise<T> {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/mobile/login";
    throw new Error("Thiếu token");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/mobile/login";
    throw new Error("Phiên đăng nhập hết hạn");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Không tải được sản phẩm");
  }

  return res.json();
}

export default function MobileProductsPage() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [products, setProducts] = useState<MobileProduct[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("branchId", branchId);
      params.set("status", status);
      params.set("take", "80");
      if (query.trim()) params.set("q", query.trim());

      const [branchRes, productRes] = await Promise.all([
        fetchWithAuth<BranchOption[]>("/mobile/branches"),
        fetchWithAuth<MobileProduct[]>(`/mobile/products?${params.toString()}`),
      ]);

      setBranches(branchRes);
      setProducts(productRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, status, query]);

  const summary = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.totalProducts += 1;
        acc.totalVariants += product.variantCount;
        acc.totalAvailable += product.totalAvailable;
        return acc;
      },
      { totalProducts: 0, totalVariants: 0, totalAvailable: 0 }
    );
  }, [products]);

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto min-h-screen w-full max-w-md bg-neutral-100 px-4 py-4 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-neutral-500">The 1970 Operations</div>
            <h1 className="text-xl font-bold text-neutral-950">Sản phẩm</h1>
          </div>

          <Link
            href="/mobile/home"
            className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm"
          >
            Home
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-xs text-neutral-500">Sản phẩm</div>
            <div className="mt-1 text-xl font-bold text-neutral-950">
              {summary.totalProducts}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-xs text-neutral-500">Biến thể</div>
            <div className="mt-1 text-xl font-bold text-neutral-950">
              {summary.totalVariants}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-xs text-neutral-500">Tồn</div>
            <div className="mt-1 text-xl font-bold text-neutral-950">
              {summary.totalAvailable}
            </div>
          </div>
        </div>

        <div className="mb-4 space-y-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery(searchText);
              }}
              placeholder="Tên sản phẩm hoặc SKU..."
              className="h-11 min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setQuery(searchText)}
              className="h-11 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white"
            >
              Tìm
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-11 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium outline-none"
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang bán</option>
              <option value="INACTIVE">Tạm ẩn</option>
              <option value="DRAFT">Nháp</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
            Không có sản phẩm.
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const expanded = expandedId === product.id;
              return (
                <div
                  key={product.id}
                  className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : product.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-bold text-neutral-950">
                          {product.name}
                        </div>
                        <div className="mt-1 text-sm text-neutral-500">
                          {product.category || product.productType || "Chưa phân loại"}
                        </div>
                      </div>

                      <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                        {statusLabel(product.status)}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <div className="text-neutral-500">Tồn</div>
                        <div className="mt-1 text-lg font-bold text-neutral-950">
                          {product.totalAvailable}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <div className="text-neutral-500">Biến thể</div>
                        <div className="mt-1 text-lg font-bold text-neutral-950">
                          {product.variantCount}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <div className="text-neutral-500">Giá</div>
                        <div className="mt-1 text-sm font-bold text-neutral-950">
                          {money(product.minPrice)}
                        </div>
                      </div>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                      {product.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="rounded-2xl bg-neutral-50 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-neutral-950">
                                {variant.sku}
                              </div>
                              <div className="mt-1 text-neutral-500">
                                {(variant.color || "-")} / {(variant.size || "-")}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-neutral-950">
                                {variant.availableQty}
                              </div>
                              <div className="text-xs text-neutral-500">còn</div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                            <span>Giá: {money(variant.price)}</span>
                            <span>Giữ: {variant.reservedQty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
