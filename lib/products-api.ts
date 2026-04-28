import { API_BASE } from "@/lib/api-base";
export type BranchStockMap = Record<string, number>;

export type ProductVariant = {
  id: string;
  sku: string;
  color?: string;
  size?: string;
  price?: number;
  costPrice?: number;
  stock: number;
  branchStocks?: BranchStockMap;
};

export type ProductItem = {
  id: string;
  name: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  brand?: string;
  weight?: number;
  imageUrl?: string;
  status?: string;
  description?: string;
  variants: ProductVariant[];
};

export type BranchItem = {
  id: string;
  name: string;
};

export type CreateProductPayload = {
  name: string;
  slug: string;
  category?: string;
  categoryId?: string;
  brand: string;
  weight: number;
  imageUrl?: string;
  description?: string;
  defaultPrice: number;
  defaultCostPrice: number;
  colorOptions: string[];
  sizeOptions: string[];
  defaultBranchStocks: Record<string, number>;
};

export type UpdateProductPayload = {
  name?: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  brand?: string;
  weight?: number;
  imageUrl?: string;
  description?: string;
  defaultPrice?: number;
  defaultCostPrice?: number;
  colors?: string[];
  sizes?: string[];
  branchStocks?: Record<string, number>;
  applyPriceToAllVariants?: boolean;
};

export type AddVariantPayload = {
  color: string;
  size: string;
  price: number;
  costPrice: number;
  branchStocks: Record<string, number>;
};


async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  return Number(value || 0);
}

function normalizeBranchStocks(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      toNumber(value),
    ])
  );
}

function getCurrentRole(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role || null;
  } catch {
    return null;
  }
}

function canViewCost(role?: string | null) {
  return role === "admin" || role === "owner";
}

export async function getBranches(): Promise<BranchItem[]> {
  const data = await request<any[]>("/branches");

  if (!Array.isArray(data)) return [];

  return data.map((item) => ({
    id: String(item.id),
    name: String(item.name || item.label || item.branchName || item.id),
  }));
}

export async function getProducts(params?: {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  status?: string;
}) {
  const role = getCurrentRole();
  const showCost = canViewCost(role);

  const search = new URLSearchParams();

  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.q) search.set("q", params.q);
  if (params?.category && params.category !== "ALL") {
    search.set("category", params.category);
  }
  if (params?.status && params.status !== "ALL") {
    search.set("status", params.status);
  }

  const result = await request<any>(
    `/products${search.toString() ? `?${search.toString()}` : ""}`
  );

  const rawProducts = Array.isArray(result) ? result : result?.data || [];

  const data: ProductItem[] = rawProducts.map((product: any) => {
    const variants: ProductVariant[] = Array.isArray(product.variants)
      ? product.variants.map((variant: any) => {
          const branchStocks = normalizeBranchStocks(variant.inventoryByBranch) || {};

          const stock =
            Object.keys(branchStocks).length > 0
              ? Object.values(branchStocks).reduce(
                  (sum, qty) => sum + toNumber(qty),
                  0
                )
              : Array.isArray(variant.inventoryItems)
                ? variant.inventoryItems.reduce(
                    (sum: number, item: any) => sum + toNumber(item.availableQty),
                    0
                  )
                : 0;

          return {
            id: String(variant.id),
            sku: String(variant.sku || ""),
            color: variant.color || "",
            size: variant.size || "",
            price: toNumber(variant.price),
            ...(showCost ? { costPrice: toNumber(variant.costPrice) } : {}),
            stock,
            branchStocks:
              Object.keys(branchStocks).length > 0
                ? branchStocks
                : Array.isArray(variant.inventoryItems)
                  ? Object.fromEntries(
                      variant.inventoryItems.map((item: any) => [
                        String(item.branchId),
                        toNumber(item.availableQty),
                      ])
                    )
                  : {},
          };
        })
      : [];

    return {
      id: String(product.id),
      name: String(product.name || ""),
      slug: product.slug || "",
      category: product.category || "",
      categoryId: product.categoryId || "",
      brand: product.brand || "The 1970",
      weight: toNumber(product.weight),
      imageUrl: product.imageUrl || "",
      status: product.status || "DRAFT",
      description: product.description || "",
      variants,
    };
  });

  return {
    data,
    total: Number(result?.total ?? data.length),
    page: Number(result?.page ?? params?.page ?? 1),
    limit: Number(result?.limit ?? params?.limit ?? data.length),
  };
}


export async function createProduct(payload: CreateProductPayload) {
  return request<any>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(
  productId: string,
  payload: UpdateProductPayload
) {
  return request<any>(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(productId: string) {
  return request<any>(`/products/${productId}`, {
    method: "DELETE",
  });
}

export async function addVariant(productId: string, payload: AddVariantPayload) {
  return request<any>(`/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleProductStatus(productId: string) {
  return request<any>(`/products/${productId}/status`, {
    method: "PATCH",
  });
}

export async function importProductsFiles(files: File[], overwrite = true) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("overwrite", overwrite ? "true" : "false");

  const res = await fetch(`${API_BASE}/products/import`, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Import sản phẩm thất bại.");
  }

  return data;
}

export async function uploadProductImage(file: File) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/products/upload-image`, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Upload ảnh thất bại.");
  }

  return data as {
    success: boolean;
    filename?: string;
    url: string;
    public_id?: string;
  };
}
export async function syncProductCategories() {
  return request<any>("/products/sync-categories", {
    method: "POST",
  });
}