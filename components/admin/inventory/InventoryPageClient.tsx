"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

type ViewRole = AppRole | "owner";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  href,
  disabled = false,
}: {
  children: React.ReactNode;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "inline-flex items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50";

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      disabled={disabled}
      className={`${className} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {children}
    </button>
  );
}

type InventoryRow = {
  productId: string;
  productName: string;
  slug: string;
  category: string;
  variantId: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  totalStock: number;
  branchStocks: Record<string, number>;
};

const ALL_BRANCH_VALUE = "ALL";
const LOW_STOCK_THRESHOLD = 3;

export default function InventoryPageClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<ViewRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>(ALL_BRANCH_VALUE);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    const nextRole = (currentUser.role || "admin") as ViewRole;
    setRole(nextRole);
    setCurrentBranchId(currentUser.branchId || null);

    const isPrivileged = nextRole === "admin" || nextRole === "owner";
    if (!isPrivileged && currentUser.branchId) {
      setBranchFilter(currentUser.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";
  const canViewMoney = isOwner;

  const canViewInventory = hasPermission(role as AppRole, "inventory.view");
  const canViewLogs = hasPermission(role as AppRole, "inventory.logs.view");
  const canUseStocktake = hasPermission(role as AppRole, "stocktake.view");

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const data = await getBranches();
        setBranches(data);
      } finally {
        setLoadingBranches(false);
      }
    };

    void loadBranches();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được dữ liệu kho."
        );
      } finally {
        setLoading(false);
      }
    };

    if (canViewInventory) {
      void loadProducts();
    }
  }, [canViewInventory]);

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const rows = useMemo<InventoryRow[]>(() => {
    return products.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product.id,
        productName: product.name,
        slug: product.slug || "",
        category: product.category || "—",
        variantId: variant.id,
        sku: variant.sku,
        color: variant.color || "—",
        size: variant.size || "—",
        price: Number(variant.price || 0),
        totalStock: Number(variant.stock || 0),
        branchStocks: variant.branchStocks || {},
      }))
    );
  }, [products]);

  const visibleBranchOptions = useMemo(() => {
    const scoped = visibleBranches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));

    if (isOwner) {
      return [{ value: ALL_BRANCH_VALUE, label: "Tất cả chi nhánh" }, ...scoped];
    }

    return scoped;
  }, [visibleBranches, isOwner]);

  const getScopedQty = (row: InventoryRow, selectedBranchId: string) => {
    if (selectedBranchId === ALL_BRANCH_VALUE) {
      if (isOwner) return row.totalStock;
      return Number(row.branchStocks[currentBranchId || ""] || 0);
    }

    return Number(row.branchStocks[selectedBranchId] || 0);
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const scopedQty = getScopedQty(row, branchFilter);

      const matchQuery =
        !q ||
        row.productName.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q) ||
        row.size.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q);

      const matchLowStock = !lowStockOnly || scopedQty <= LOW_STOCK_THRESHOLD;

      return matchQuery && matchLowStock;
    });
  }, [rows, query, branchFilter, currentBranchId, isOwner, lowStockOnly]);

  const scopedTotalQty = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      return sum + getScopedQty(row, branchFilter);
    }, 0);
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const scopedTotalValue = useMemo(() => {
    return filteredRows.reduce((sum, row) => {
      return sum + getScopedQty(row, branchFilter) * row.price;
    }, 0);
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const trackedSkuCount = filteredRows.length;

  const lowStockCount = useMemo(() => {
    return filteredRows.filter(
      (row) => getScopedQty(row, branchFilter) <= LOW_STOCK_THRESHOLD
    ).length;
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const outOfStockCount = useMemo(() => {
    return filteredRows.filter((row) => getScopedQty(row, branchFilter) <= 0)
      .length;
  }, [filteredRows, branchFilter, currentBranchId, isOwner]);

  const topValueBranch = useMemo(() => {
    if (!visibleBranches.length) return "—";

    let bestBranch: BranchItem | null = null;
    let bestValue = -1;

    for (const branch of visibleBranches) {
      const value = rows.reduce((sum, row) => {
        return sum + row.price * Number(row.branchStocks[branch.id] || 0);
      }, 0);

      if (value > bestValue) {
        bestValue = value;
        bestBranch = branch;
      }
    }

    return bestBranch ? bestBranch.name : "—";
  }, [rows, visibleBranches]);

  const currentScopeLabel = useMemo(() => {
    if (branchFilter === ALL_BRANCH_VALUE) {
      return isOwner
        ? "Toàn hệ thống"
        : visibleBranches.map((b) => b.name).join(", ") || "Chưa gán chi nhánh";
    }

    return branches.find((b) => b.id === branchFilter)?.name || branchFilter;
  }, [branchFilter, isOwner, visibleBranches, branches]);

  if (!canViewInventory) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">
          Role hiện tại không có quyền xem kho hàng.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Kho hàng</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Kho chỉ đọc số liệu. Muốn đổi tồn phải đi qua kiểm kho để có log và
          khóa rủi ro.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {canUseStocktake ? (
          <Button href="/control/stocktake">Đi tới kiểm kho</Button>
        ) : null}
        {canViewLogs ? (
          <Button href="/control/inventory-logs">Lịch sử kho</Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canViewMoney ? (
          <Panel>
            <div className="p-5">
              <p className="text-sm text-neutral-500">Tổng giá trị tồn</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                {currency(scopedTotalValue)}
              </h3>
              <p className="mt-2 text-xs text-neutral-500">
                {branchFilter === ALL_BRANCH_VALUE
                  ? "Toàn hệ thống"
                  : `Theo ${currentScopeLabel}`}
              </p>
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="p-5">
              <p className="text-sm text-neutral-500">Tổng số lượng tồn</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                {scopedTotalQty}
              </h3>
              <p className="mt-2 text-xs text-neutral-500">
                Theo {currentScopeLabel}
              </p>
            </div>
          </Panel>
        )}

        <Panel>
          <div className="p-5">
            <p className="text-sm text-neutral-500">SKU đang theo dõi</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {trackedSkuCount}
            </h3>
            <p className="mt-2 text-xs text-neutral-500">
              Sau khi lọc theo scope và chi nhánh
            </p>
          </div>
        </Panel>

        <Panel>
          <div className="p-5">
            <p className="text-sm text-neutral-500">SKU tồn thấp</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {lowStockCount}
            </h3>
            <p className="mt-2 text-xs text-neutral-500">
              Ngưỡng ≤ {LOW_STOCK_THRESHOLD}
            </p>
          </div>
        </Panel>

        {canViewMoney ? (
          <Panel>
            <div className="p-5">
              <p className="text-sm text-neutral-500">
                Chi nhánh giá trị cao nhất
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                {topValueBranch}
              </h3>
              <p className="mt-2 text-xs text-neutral-500">
                Trong scope được phép xem
              </p>
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="p-5">
              <p className="text-sm text-neutral-500">SKU hết hàng</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                {outOfStockCount}
              </h3>
              <p className="mt-2 text-xs text-neutral-500">
                Theo scope hiện tại
              </p>
            </div>
          </Panel>
        )}
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.6fr_0.9fr_auto_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo SKU, tên sản phẩm, màu, size..."
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={!isOwner || loadingBranches}
          >
            {visibleBranchOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setLowStockOnly((v) => !v)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              lowStockOnly
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            {lowStockOnly ? "Đang lọc tồn thấp" : "Lọc tồn thấp"}
          </button>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filteredRows.length} SKU
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4">
          <p className="font-medium text-neutral-900">Danh sách tồn kho</p>
          <p className="mt-1 text-sm text-neutral-500">
            Scope hiện tại:{" "}
            {isOwner
              ? "Toàn hệ thống"
              : visibleBranches.map((b) => b.name).join(", ") ||
                "Chưa gán chi nhánh"}
          </p>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">
              Đang tải dữ liệu tồn kho...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">
              Không có dữ liệu phù hợp.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium">Danh mục</th>
                  <th className="px-4 py-3 font-medium">Phân loại</th>
                  {canViewMoney ? (
                    <th className="px-4 py-3 font-medium">Giá bán</th>
                  ) : null}
                  {visibleBranches.map((branch) => (
                    <th key={branch.id} className="px-4 py-3 font-medium">
                      {branch.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Tổng</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const scopedQty = getScopedQty(row, branchFilter);

                  return (
                    <tr
                      key={row.variantId}
                      className="border-t border-neutral-200"
                    >
                      <td className="px-4 py-3 font-medium">{row.sku}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-neutral-900">
                            {row.productName}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            /{row.slug || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">
                        {row.color} / {row.size}
                      </td>

                      {canViewMoney ? (
                        <td className="px-4 py-3">{currency(row.price)}</td>
                      ) : null}

                      {visibleBranches.map((branch) => (
                        <td key={branch.id} className="px-4 py-3">
                          {Number(row.branchStocks[branch.id] || 0)}
                        </td>
                      ))}

                      <td className="px-4 py-3 font-medium">{scopedQty}</td>
                      <td className="px-4 py-3">
                        {scopedQty <= 0 ? (
                          <Badge tone="red">Hết hàng</Badge>
                        ) : scopedQty <= LOW_STOCK_THRESHOLD ? (
                          <Badge tone="amber">Tồn thấp</Badge>
                        ) : (
                          <Badge tone="green">Ổn định</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}