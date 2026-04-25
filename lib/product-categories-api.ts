const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

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

export type ProductCategoryItem = {
  id: string;
  name: string;
  code: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    products: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export async function getCategories(): Promise<ProductCategoryItem[]> {
  return request<ProductCategoryItem[]>("/categories");
}

export async function createCategory(payload: {
  name: string;
  code: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}) {
  return request<ProductCategoryItem>("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export async function deleteCategory(id: string) {
  return request(`/categories/${id}`, {
    method: "DELETE",
  });
}

export async function updateCategory(
  id: string,
  payload: {
    name?: string;
    code?: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  return request<ProductCategoryItem>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function toggleCategory(id: string) {
  return request<ProductCategoryItem>(`/categories/${id}/toggle`, {
    method: "PATCH",
  });
}