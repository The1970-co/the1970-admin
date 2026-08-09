"use client";

import { API_BASE } from "@/lib/api-base";
import { apiJson } from "@/lib/api";
import { getMobileToken } from "@/lib/mobile-auth-token";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BranchOption = {
  id: string;
  name: string;
};

type MobileProductVariant = {
  id: string;
  productId?: string;
  sku: string;
  color: string | null;
  size: string | null;
  status: string;
  price: number;
  costPrice: number;
  imageUrl?: string | null;
  availableQty: number;
  reservedQty: number;
  incomingQty: number;
};

type MobileProduct = {
  id: string;
  name: string;
  slug?: string;
  category: string | null;
  productType: string | null;
  brand: string | null;
  imageUrl: string | null;
  colorImages?: Record<string, string>;
  imagesByColor?: Record<string, string>;
  status: string;
  variantCount: number;
  totalAvailable: number;
  totalReserved: number;
  totalIncoming: number;
  minPrice: number;
  maxPrice: number;
  variants: MobileProductVariant[];
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

function absoluteImageUrl(value?: string | null) {
  const src = String(value || "").trim();
  if (!src) return "";
  return src.startsWith("http") ? src : `${API_BASE}${src}`;
}

function normalizeColorKey(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function getProductColorRepresentatives(product: MobileProduct) {
  const seen = new Set<string>();
  const colorMap = product.colorImages || product.imagesByColor || {};
  const output: Array<{ key: string; label: string; image: string }> = [];

  for (const variant of product.variants || []) {
    const label = String(variant.color || "Khác").trim() || "Khác";
    const key = normalizeColorKey(label) || "KHAC";
    if (seen.has(key)) continue;
    seen.add(key);

    const image = absoluteImageUrl(
      variant.imageUrl ||
        colorMap[key] ||
        colorMap[label] ||
        product.imageUrl ||
        "",
    );

    output.push({ key, label, image });
  }

  if (!output.length && product.imageUrl) {
    output.push({
      key: "DEFAULT",
      label: "Ảnh chính",
      image: absoluteImageUrl(product.imageUrl),
    });
  }

  return output.slice(0, 8);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "Đang bán",
    INACTIVE: "Tạm ẩn",
    DRAFT: "Nháp",
  };
  return map[status] || status;
}

function extractRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function fetchWithAuth<T>(path: string): Promise<T> {
  // Native app có thể giữ token trong Preferences trong khi localStorage của WebView
  // chưa hydrate kịp. getMobileToken() sẽ phục hồi và đồng bộ token trước request.
  await getMobileToken();

  // Không bao giờ tự xóa token / redirect login chỉ vì một API sản phẩm trả 401.
  // apiJson vẫn thử refresh token; nếu refresh thất bại thì chỉ throw để màn hình báo lỗi.
  return apiJson<T>(path, {
    redirectOnUnauthorized: false,
    timeoutMs: 30000,
  } as any);
}

export default function MobileProductsPage() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [products, setProducts] = useState<MobileProduct[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
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
      params.set("take", "300");
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all") params.set("category", category);

      // Gọi 1 API nhẹ trước để nếu access token vừa hết hạn thì apiJson
      // chỉ refresh đúng 1 lần trước khi các request sản phẩm chạy song song.
      // Tránh 3 request cùng lúc đều ăn 401 và tạo race logout trên WebView.
      let nextBranches = branches;
      if (nextBranches.length === 0) {
        const branchPayload = await fetchWithAuth<any>("/mobile/branches");
        nextBranches = extractRows(branchPayload) as BranchOption[];
        setBranches(nextBranches);
      }

      const needCategories = categoryOptions.length === 0;

      const [productPayload, categoryPayload] = await Promise.all([
        fetchWithAuth<any>(`/mobile/products?${params.toString()}`),
        needCategories
          ? fetchWithAuth<any>("/products/category-options").catch(() => [])
          : Promise.resolve(null),
      ]);

      const productRows = extractRows(productPayload) as MobileProduct[];
      const apiCategories = categoryPayload
        ? extractRows(categoryPayload).map(String)
        : categoryOptions;

      setProducts(productRows);

      if (needCategories) {
        setCategoryOptions(
          Array.from(
            new Set(
              [
                ...apiCategories,
                ...productRows.map((product) => String(product.category || "").trim()),
              ].filter(Boolean),
            ),
          ).sort((a, b) => a.localeCompare(b, "vi")),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, status, category, query]);

  const visibleProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter(
      (product) =>
        String(product.category || "").trim().toLocaleLowerCase("vi") ===
        category.trim().toLocaleLowerCase("vi"),
    );
  }, [products, category]);

  const summary = useMemo(() => {
    return visibleProducts.reduce(
      (acc, product) => {
        acc.totalProducts += 1;
        acc.totalVariants += Number(product.variantCount || product.variants?.length || 0);
        acc.totalAvailable += Number(product.totalAvailable || 0);
        return acc;
      },
      { totalProducts: 0, totalVariants: 0, totalAvailable: 0 },
    );
  }, [visibleProducts]);

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
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                  setQuery(searchText.trim());
                }
              }}
              placeholder="Tên sản phẩm hoặc SKU..."
              className="h-11 min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base outline-none"
            />
            <button
              type="button"
              onClick={() => {
                document.activeElement instanceof HTMLElement &&
                  document.activeElement.blur();
                setQuery(searchText.trim());
              }}
              className="h-11 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white"
            >
              Tìm
            </button>
          </div>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium outline-none"
          >
            <option value="all">Tất cả danh mục</option>
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
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
              onChange={(event) => setStatus(event.target.value)}
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
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
            Không có sản phẩm phù hợp.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleProducts.map((product) => {
              const expanded = expandedId === product.id;
              return (
                <div
                  key={product.id}
                  className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <Link
                    href={`/mobile/products/${encodeURIComponent(product.id)}`}
                    onClick={() => {
                      document.activeElement instanceof HTMLElement &&
                        document.activeElement.blur();
                    }}
                    className="block w-full text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                        {absoluteImageUrl(product.imageUrl) ? (
                          <img
                            src={absoluteImageUrl(product.imageUrl)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-base font-bold leading-5 text-neutral-950">
                              {product.name}
                            </div>
                            <div className="mt-1 text-sm text-neutral-500">
                              {product.category ||
                                product.productType ||
                                "Chưa phân loại"}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                            {statusLabel(product.status)}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
                          {getProductColorRepresentatives(product).map((color) => (
                            <div
                              key={color.key}
                              title={color.label}
                              className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-sm ring-1 ring-neutral-200"
                            >
                              {color.image ? (
                                <img
                                  src={color.image}
                                  alt={color.label}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[9px] font-black text-neutral-500">
                                  {color.label.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                          {getProductColorRepresentatives(product).length > 0 ? (
                            <span className="ml-1 truncate text-xs text-neutral-500">
                              {getProductColorRepresentatives(product).length} màu
                            </span>
                          ) : null}
                        </div>
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
                          {product.variantCount || product.variants?.length || 0}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <div className="text-neutral-500">Giá</div>
                        <div className="mt-1 text-sm font-bold text-neutral-950">
                          {money(product.minPrice)}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : product.id)}
                    className="mt-3 w-full rounded-2xl border border-neutral-200 py-2 text-sm font-semibold"
                  >
                    {expanded ? "Thu gọn SKU" : "Xem nhanh SKU"}
                  </button>

                  {expanded ? (
                    <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                      {(product.variants || []).map((variant) => (
                        <Link
                          href={`/mobile/products/${encodeURIComponent(product.id)}`}
                          key={variant.id}
                          className="block rounded-2xl bg-neutral-50 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-neutral-950">
                                {variant.sku}
                              </div>
                              <div className="mt-1 text-neutral-500">
                                {variant.color || "-"} / {variant.size || "-"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-neutral-950">
                                {variant.availableQty}
                              </div>
                              <div className="text-xs text-neutral-500">còn</div>
                            </div>
                          </div>
                        </Link>
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
