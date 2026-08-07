"use client";

import { apiJson } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { getMobileToken } from "@/lib/mobile-auth-token";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, History, RefreshCw, Shirt, Store } from "lucide-react";

type InventoryMovement = {
  id: string;
  type: string;
  qty: number;
  note?: string;
  refType?: string;
  refId?: string;
  refCode?: string | null;
  branchId?: string;
  branchName?: string;
  createdAt?: string | null;
  createdAtIso?: string | null;
  createdAtText?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  sku?: string;
  productId?: string | null;
  variantId?: string | null;
  color?: string;
  size?: string;
};

type BranchStock = {
  branchId?: string;
  branchName?: string;
  availableQty?: number;
  reservedQty?: number;
  incomingQty?: number;
};

type Variant = {
  id?: string;
  productId?: string;
  sku?: string;
  color?: string | null;
  size?: string | null;
  status?: string;
  price?: number;
  costPrice?: number;
  imageUrl?: string | null;
  stock?: number;
  availableQty?: number;
  reservedQty?: number;
  incomingQty?: number;
  inventoryByBranch?: Record<string, number>;
  branches?: BranchStock[];
  inventoryItems?: Array<{
    branchId?: string;
    branch?: { id?: string; name?: string };
    availableQty?: number;
    reservedQty?: number;
    incomingQty?: number;
  }>;
};

type Product = {
  id: string;
  name: string;
  slug?: string;
  category?: string | null;
  productType?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  status?: string;
  description?: string | null;
  variantCount?: number;
  totalAvailable?: number;
  totalReserved?: number;
  totalIncoming?: number;
  minPrice?: number;
  maxPrice?: number;
  colorImages?: Record<string, string>;
  imagesByColor?: Record<string, string>;
  variants?: Variant[];
};

async function api<T>(path: string): Promise<T> {
  // Đảm bảo token native được hydrate lại vào WebView trước khi gọi API.
  // Tránh case app còn đăng nhập nhưng localStorage tạm thời chưa có token.
  await getMobileToken();

  return apiJson<T>(path, {
    redirectOnUnauthorized: false,
    timeoutMs: 30000,
  } as any);
}

function extractRows(payload: any): Product[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

async function fetchProduct(rawId: string): Promise<Product> {
  const id = decodeURIComponent(String(rawId || "").trim());
  if (!id) throw new Error("Thiếu mã sản phẩm");

  // Backend hiện có endpoint chi tiết chuẩn là /products/:id.
  // Không gọi thử /mobile/products/:id trước nữa vì endpoint đó không tồn tại
  // và tạo request 404 mỗi lần mở trang chi tiết.
  const detailPaths = [
    `/products/${encodeURIComponent(id)}`,
  ];

  for (const path of detailPaths) {
    try {
      const result = await api<any>(path);
      if (result?.id) return result as Product;
    } catch {
      // thử nguồn tiếp theo
    }
  }

  const listPaths = [
    `/mobile/products?take=500&q=${encodeURIComponent(id)}`,
    `/products?limit=500&q=${encodeURIComponent(id)}`,
  ];

  for (const path of listPaths) {
    try {
      const payload = await api<any>(path);
      const rows = extractRows(payload);
      const found = rows.find((item) => {
        if (String(item?.id || "") === id || String(item?.slug || "") === id) return true;
        return (item?.variants || []).some(
          (variant: Variant) =>
            String(variant?.id || "") === id ||
            String(variant?.sku || "").toUpperCase() === id.toUpperCase(),
        );
      });
      if (found) return found;
    } catch {
      // thử nguồn tiếp theo
    }
  }

  throw new Error("Không tìm thấy sản phẩm");
}

function money(value?: number | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function imageUrl(src?: string | null) {
  if (!src) return "";
  return src.startsWith("http") ? src : `${API_BASE}${src}`;
}

function normalizeColor(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function colorImage(product: Product, variant: Variant) {
  const key = normalizeColor(variant.color);
  const map = product.colorImages || product.imagesByColor || {};
  return imageUrl(
    variant.imageUrl ||
      map[key] ||
      map[String(variant.color || "")] ||
      product.imageUrl ||
      "",
  );
}

function totalStock(product: Product) {
  const variantTotal = (product.variants || []).reduce(
    (sum, variant) => sum + variantStock(variant),
    0,
  );

  // API chi tiết có thể không trả totalAvailable hoặc trả 0 mặc định,
  // trong khi tồn thật nằm trong stock / inventoryByBranch / inventoryItems.
  if (variantTotal > 0) return variantTotal;
  return Number(product.totalAvailable || 0);
}

function getVariantBranches(variant?: Variant): BranchStock[] {
  if (!variant) return [];

  if (Array.isArray(variant.branches) && variant.branches.length) {
    return variant.branches.map((branch) => ({
      branchId: branch.branchId,
      branchName: branch.branchName || branch.branchId,
      availableQty: Number(branch.availableQty || 0),
      reservedQty: Number(branch.reservedQty || 0),
      incomingQty: Number(branch.incomingQty || 0),
    }));
  }

  if (Array.isArray(variant.inventoryItems) && variant.inventoryItems.length) {
    return variant.inventoryItems.map((item) => ({
      branchId: item.branchId || item.branch?.id,
      branchName: item.branch?.name || item.branchId || item.branch?.id,
      availableQty: Number(item.availableQty || 0),
      reservedQty: Number(item.reservedQty || 0),
      incomingQty: Number(item.incomingQty || 0),
    }));
  }

  if (variant.inventoryByBranch && typeof variant.inventoryByBranch === "object") {
    return Object.entries(variant.inventoryByBranch).map(([branchId, qty]) => ({
      branchId,
      branchName: branchId,
      availableQty: Number(qty || 0),
      reservedQty: 0,
      incomingQty: 0,
    }));
  }

  return [];
}

function variantStock(variant?: Variant) {
  if (!variant) return 0;
  if (typeof variant.stock === "number") return variant.stock;
  if (typeof variant.availableQty === "number") return variant.availableQty;
  return getVariantBranches(variant).reduce(
    (sum, branch) => sum + Number(branch.availableQty || 0),
    0,
  );
}

function getMobileAuthToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("the1970_token") ||
    ""
  );
}

function normalizeMovement(raw: any): InventoryMovement {
  return {
    id: String(raw?.id || ""),
    type: String(raw?.type || ""),
    qty: Number(raw?.qty || 0),
    note: raw?.note || "",
    refType: raw?.refType || "",
    refId: raw?.refId || "",
    refCode: raw?.refCode || raw?.orderCode || null,
    branchId: raw?.branchId || "",
    branchName: raw?.branchName || raw?.branch?.name || "",
    createdAt: raw?.createdAtIso || raw?.createdAt || null,
    createdAtIso: raw?.createdAtIso || raw?.createdAt || null,
    createdAtText: raw?.createdAtText || null,
    createdByName:
      raw?.createdByName ||
      raw?.actorName ||
      raw?.createdBy?.fullName ||
      raw?.createdBy?.name ||
      null,
    createdByEmail: raw?.createdByEmail || raw?.actorEmail || null,
    actorName:
      raw?.actorName ||
      raw?.createdByName ||
      raw?.createdBy?.fullName ||
      raw?.createdBy?.name ||
      null,
    actorEmail: raw?.actorEmail || raw?.createdByEmail || null,
    sku: raw?.sku || "",
    productId: raw?.productId || null,
    variantId: raw?.variantId || raw?.productVariantId || null,
    color: raw?.color || "",
    size: raw?.size || "",
  };
}

async function fetchInventoryHistorySafely(
  productId: string,
  limit = 200,
): Promise<InventoryMovement[]> {
  const token = (await getMobileToken()) || getMobileAuthToken();
  if (!token) return [];

  const response = await fetch(
    `${API_BASE}/inventory/movements/product/${encodeURIComponent(productId)}?limit=${limit}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      credentials: "include",
    },
  );

  // Trang chi tiết không được tự xóa token hoặc đẩy người dùng ra ngoài.
  // 401/403 chỉ làm ẩn lịch sử và giữ nguyên phiên đăng nhập hiện tại.
  if (response.status === 401 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Không tải được lịch sử kho (${response.status}).`);
  }

  const payload = await response.json().catch(() => []);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return rows.map(normalizeMovement);
}

function movementLabel(type?: string) {
  const labels: Record<string, string> = {
    IMPORT: "Nhập kho",
    SALE: "Bán hàng",
    CANCEL: "Huỷ đơn / hoàn tồn",
    RETURN: "Khách trả hàng",
    ADJUSTMENT: "Điều chỉnh kho",
    RESERVE: "Giữ hàng",
    RELEASE: "Xả giữ hàng",
    STOCKTAKE: "Kiểm kho",
    TRANSFER_IN: "Nhận chuyển kho",
    TRANSFER_OUT: "Xuất chuyển kho",
  };
  const key = String(type || "").toUpperCase();
  return labels[key] || key || "Biến động kho";
}

function movementTime(row: InventoryMovement) {
  const raw = (row as any).createdAtIso || row.createdAt;
  if (!raw) return "Chưa ghi nhận";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String((row as any).createdAtText || raw);
  return date.toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function movementActor(row: InventoryMovement) {
  const item = row as any;
  return (
    item.actorName ||
    item.createdByName ||
    item.employeeName ||
    item.staffName ||
    item.userName ||
    item.actorEmail ||
    item.createdByEmail ||
    "Chưa ghi nhận"
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[1.75rem] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-neutral-100">
          {icon}
        </div>
        <h2 className="min-w-0 text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function MobileProductDetailPage() {
  const params = useParams();
  const rawParam = params?.id;
  const id = decodeURIComponent(
    String(Array.isArray(rawParam) ? rawParam[0] : rawParam || "").trim(),
  );

  const [product, setProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState<InventoryMovement[]>([]);
  const [historyVisibleCount, setHistoryVisibleCount] = useState(40);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.documentElement.style.overflowX = "";
      document.body.style.overflowX = "";
    };
  }, []);

  const loadHistory = useCallback(async (productId: string) => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const rows = await fetchInventoryHistorySafely(productId, 200);
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setHistory([]);
      setHistoryError(
        err instanceof Error ? err.message : "Không tải được lịch sử kho.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!id) {
        setLoading(false);
        setError("Thiếu mã sản phẩm");
        return;
      }

      try {
        silent ? setRefreshing(true) : setLoading(true);
        setError("");
        const result = await fetchProduct(id);
        setProduct(result);
        setHistoryVisibleCount(40);
        setSelected((current) => {
          if (
            current &&
            (result.variants || []).some(
              (variant) => (variant.id || variant.sku) === current,
            )
          ) {
            return current;
          }
          return result.variants?.[0]?.id || result.variants?.[0]?.sku || "";
        });
        await loadHistory(result.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, loadHistory],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const variant = useMemo(
    () =>
      product?.variants?.find((item) => (item.id || item.sku) === selected) ||
      product?.variants?.[0],
    [product, selected],
  );

  const colorGroups = useMemo(() => {
    const map = new Map<string, Variant[]>();
    for (const item of product?.variants || []) {
      const key = normalizeColor(item.color) || "KHÁC";
      const rows = map.get(key) || [];
      rows.push(item);
      map.set(key, rows);
    }
    return Array.from(map.entries()).map(([key, rows]) => ({
      key,
      label: rows[0]?.color || "Khác",
      image: product ? colorImage(product, rows[0]) : "",
      totalStock: rows.reduce((sum, row) => sum + variantStock(row), 0),
      rows,
    }));
  }, [product]);

  const branches = getVariantBranches(variant);
  const variantCount = product?.variantCount || product?.variants?.length || 0;
  const selectedVariantHistory = history.filter(
    (row: any) => !variant?.id || !row.variantId || String(row.variantId) === String(variant.id),
  );
  const historyRows = selectedVariantHistory.length ? selectedVariantHistory : history;

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-100 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden px-4 pb-28 pt-5">
        <header className="mb-5 flex min-w-0 items-center justify-between gap-3">
          <Link
            href="/mobile/products"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">
              Chi tiết
            </div>
            <div className="truncate text-lg font-black">
              {product?.name || "Sản phẩm"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </header>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-[1.75rem] bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : product ? (
          <div className="min-w-0 space-y-4">
            <section className="min-w-0 overflow-hidden rounded-[2rem] bg-neutral-950 text-white shadow-xl shadow-neutral-300">
              <div className="aspect-square bg-neutral-900">
                {imageUrl(product.imageUrl) ? (
                  <img
                    src={imageUrl(product.imageUrl)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/35">
                    No image
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="text-sm text-white/45">
                  {product.category ||
                    product.productType ||
                    product.brand ||
                    "The 1970"}
                </div>
                <h1 className="mt-2 break-words text-2xl font-black leading-tight">
                  {product.name}
                </h1>
                <div className="mt-5 grid min-w-0 grid-cols-3 gap-3">
                  <div className="min-w-0 rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-white/45">Tồn</div>
                    <div className="mt-1 truncate text-2xl font-black">
                      {totalStock(product)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-white/45">Mẫu</div>
                    <div className="mt-1 truncate text-2xl font-black">
                      {variantCount}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-white/45">Giá</div>
                    <div className="mt-1 truncate text-sm font-black">
                      {money(variant?.price || product.minPrice)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <Section title="Biến thể" icon={<Shirt className="h-5 w-5" />}>
              <div className="-mx-1 flex max-w-full gap-3 overflow-x-auto px-1 pb-2">
                {colorGroups.map((group) => (
                  <div key={group.key} className="w-[132px] shrink-0">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                        {group.image ? (
                          <img
                            src={group.image}
                            alt={group.label}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-black">
                          {group.label}
                        </span>
                        <span className="block text-[11px] font-semibold text-neutral-500">
                          Tồn {group.totalStock}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.rows.map((item) => {
                        const key = item.id || item.sku || "";
                        const active = key === (variant?.id || variant?.sku);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelected(key)}
                            className={`w-full rounded-2xl border px-3 py-2.5 text-left ${
                              active
                                ? "border-neutral-950 bg-neutral-950 text-white"
                                : "border-neutral-200 bg-neutral-50 text-neutral-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-black">
                                {item.size || "Size"}
                              </div>
                              <div
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
                                  active
                                    ? "bg-white/15 text-white"
                                    : variantStock(item) > 0
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-neutral-200 text-neutral-500"
                                }`}
                              >
                                Tồn {variantStock(item)}
                              </div>
                            </div>
                            <div className="mt-1 truncate text-[11px] opacity-70">
                              {item.sku || "—"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Tồn theo chi nhánh" icon={<Store className="h-5 w-5" />}>
              <div className="mb-3 flex items-center justify-between rounded-2xl bg-neutral-950 px-4 py-3 text-white">
                <div className="min-w-0">
                  <div className="truncate text-xs text-white/55">
                    {variant?.sku || "Biến thể đang chọn"}
                  </div>
                  <div className="mt-0.5 text-sm font-black">
                    {variant?.color || "—"} / {variant?.size || "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-white/55">Tổng tồn</div>
                  <div className="text-2xl font-black">{variantStock(variant)}</div>
                </div>
              </div>
              {branches.length === 0 ? (
                <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                  Biến thể này chưa có bản ghi tồn kho theo chi nhánh.
                </div>
              ) : (
                <div className="space-y-3">
                  {branches.map((branch, index) => (
                    <div
                      key={`${branch.branchId}-${index}`}
                      className="flex items-center justify-between rounded-2xl bg-neutral-50 p-4"
                    >
                      <div>
                        <div className="font-black">
                          {branch.branchName || branch.branchId || "Chi nhánh"}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          Giữ {branch.reservedQty || 0} · Sắp về{" "}
                          {branch.incomingQty || 0}
                        </div>
                      </div>
                      <div
                        className={`text-2xl font-black ${
                          Number(branch.availableQty || 0) <= 0
                            ? "text-rose-700"
                            : Number(branch.availableQty || 0) <= 3
                              ? "text-amber-700"
                              : "text-neutral-950"
                        }`}
                      >
                        {branch.availableQty || 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Thông tin nhanh" icon={<Boxes className="h-5 w-5" />}>
              <div className="divide-y divide-neutral-100">
                {[
                  ["SKU", variant?.sku || "—"],
                  ["Trạng thái", product.status || variant?.status || "—"],
                  ["Giá bán", money(variant?.price)],
                  ["Giá nhập", money(variant?.costPrice)],
                  ["Tồn biến thể", String(variantStock(variant))],
                  ["Đang giữ", String(variant?.reservedQty || 0)],
                  ["Sắp về", String(variant?.incomingQty || 0)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-3 py-3 text-sm"
                  >
                    <span className="text-neutral-500">{label}</span>
                    <span className="min-w-0 break-all text-right font-black">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Lịch sử kho" icon={<History className="h-5 w-5" />}>
              {historyLoading ? (
                <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                  Đang tải lịch sử kho...
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  {historyError}
                </div>
              ) : historyRows.length === 0 ? (
                <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                  Chưa có lịch sử kho cho sản phẩm này.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyRows.slice(0, historyVisibleCount).map((row: any) => {
                    const qty = Number(row.qty || 0);
                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black">
                                {movementLabel(row.type)}
                              </span>
                              <span className="text-xs text-neutral-500">
                                {row.branchName || row.branchId || "—"}
                              </span>
                            </div>
                            <div className="mt-2 text-sm font-black">
                              {row.sku || variant?.sku || "SKU"} ·{" "}
                              {row.color || variant?.color || "—"} /{" "}
                              {row.size || variant?.size || "—"}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {movementTime(row)} · {movementActor(row)}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {row.refCode || row.refId || row.refType || "—"}
                            </div>
                            {row.note ? (
                              <div className="mt-1 text-xs text-neutral-500">
                                {row.note}
                              </div>
                            ) : null}
                          </div>
                          <div
                            className={`shrink-0 text-lg font-black ${
                              qty >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {qty > 0 ? `+${qty}` : qty}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-1 text-center">
                    <div className="mb-2 text-xs text-neutral-500">
                      Đang hiển thị {Math.min(historyVisibleCount, historyRows.length)} / {historyRows.length} biến động gần nhất.
                    </div>
                    {historyVisibleCount < historyRows.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryVisibleCount((current) =>
                            Math.min(current + 40, historyRows.length),
                          )
                        }
                        className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-900"
                      >
                        Xem thêm 40 bản ghi
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </Section>
          </div>
        ) : null}

        <MobileBottomNav />
      </div>
    </div>
  );
}
