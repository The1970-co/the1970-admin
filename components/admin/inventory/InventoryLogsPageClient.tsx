"use client";

import { useEffect, useMemo, useState } from "react";
import { getBranches, type BranchItem } from "@/lib/products-api";
import { getInventoryMovements, type InventoryMovement } from "@/lib/inventory-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
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
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function movementTone(type: string, qty: number): "gray" | "green" | "amber" | "red" | "blue" {
  if (type === "SALE") return "red";
  if (type === "CANCEL" || type === "RETURN" || type === "IMPORT") return "green";
  if (type === "ADJUSTMENT") return "amber";
  if (qty > 0) return "green";
  if (qty < 0) return "red";
  return "gray";
}

const ALL_BRANCH_VALUE = "ALL";

export default function InventoryLogsPageClient() {
  const [rows, setRows] = useState<InventoryMovement[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState<string>(ALL_BRANCH_VALUE);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setRole(currentUser.role as AppRole);
    setCurrentBranchId(currentUser.branchId || null);

    if (currentUser.role !== "admin" && currentUser.role !== "owner" && currentUser.branchId) {
      setBranchFilter(currentUser.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";
  const canViewLogs = hasPermission(role, "inventory.logs.view");

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
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getInventoryMovements();
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được lịch sử kho.");
      } finally {
        setLoading(false);
      }
    };

    if (canViewLogs) {
      void load();
    }
  }, [canViewLogs]);

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const scopedRows = useMemo(() => {
    if (isOwner) return rows;

    return rows.filter((row) => {
      if (!row.branchId) return false;
      return row.branchId === currentBranchId;
    });
  }, [rows, isOwner, currentBranchId]);

  const types = useMemo(
    () => Array.from(new Set(scopedRows.map((r) => r.type))).filter(Boolean),
    [scopedRows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return scopedRows.filter((row) => {
      const matchQuery =
        !q ||
        row.sku.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        String(row.color || "").toLowerCase().includes(q) ||
        String(row.size || "").toLowerCase().includes(q) ||
        String(row.note || "").toLowerCase().includes(q) ||
        String(row.refType || "").toLowerCase().includes(q) ||
        String(row.refId || "").toLowerCase().includes(q);

      const matchType = typeFilter === "ALL" || row.type === typeFilter;
      const matchBranch =
        branchFilter === ALL_BRANCH_VALUE ? true : row.branchId === branchFilter;

      return matchQuery && matchType && matchBranch;
    });
  }, [scopedRows, query, typeFilter, branchFilter]);

  const totalIn = filtered.filter((r) => r.qty > 0).reduce((sum, r) => sum + r.qty, 0);
  const totalOut = Math.abs(filtered.filter((r) => r.qty < 0).reduce((sum, r) => sum + r.qty, 0));

  const branchOptions = useMemo(() => {
    const scoped = visibleBranches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }));

    if (isOwner) {
      return [{ value: ALL_BRANCH_VALUE, label: "Tất cả chi nhánh" }, ...scoped];
    }

    return scoped;
  }, [visibleBranches, isOwner]);

  const getBranchLabel = (branchId?: string | null) => {
    if (!branchId) return "—";
    return branches.find((branch) => branch.id === branchId)?.name || branchId;
  };

  if (!canViewLogs) {
    return (
      <Panel className="p-6">
        <p className="text-sm text-red-600">Role hiện tại không có quyền xem lịch sử kho.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Lịch sử kho</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Theo dõi mọi biến động nhập, xuất, hoàn và điều chỉnh kho trong đúng scope được phép xem.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng dòng log</p>
          <h3 className="mt-2 text-2xl font-semibold">{filtered.length}</h3>
          <p className="mt-2 text-xs text-neutral-500">
            {isOwner
              ? "Toàn hệ thống"
              : `Scope: ${visibleBranches.map((b) => b.name).join(", ") || "Chưa gán chi nhánh"}`}
          </p>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng cộng kho</p>
          <h3 className="mt-2 text-2xl font-semibold text-green-700">+{totalIn}</h3>
          <p className="mt-2 text-xs text-neutral-500">Nhập / hoàn / điều chỉnh tăng</p>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Tổng trừ kho</p>
          <h3 className="mt-2 text-2xl font-semibold text-red-700">-{totalOut}</h3>
          <p className="mt-2 text-xs text-neutral-500">Bán / điều chỉnh giảm</p>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.9fr_0.9fr_auto]">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm SKU, sản phẩm, note, ref..."
          />

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Tất cả loại</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={!isOwner && !loadingBranches}
          >
            {branchOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filtered.length} dòng
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
          <p className="font-medium text-neutral-900">Bảng lịch sử biến động</p>
          <p className="mt-1 text-sm text-neutral-500">Dòng mới nhất ở trên cùng</p>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">Đang tải lịch sử kho...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Thời gian</th>
                  <th className="px-4 py-3 font-medium">Chi nhánh</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium">Variant</th>
                  <th className="px-4 py-3 font-medium">Loại</th>
                  <th className="px-4 py-3 font-medium">SL</th>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Ghi chú</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-200">
                    <td className="px-4 py-3 whitespace-nowrap">{row.createdAt}</td>
                    <td className="px-4 py-3">
                      {row.branchId ? (
                        getBranchLabel(row.branchId)
                      ) : (
                        <Badge tone="gray">Chưa map</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.sku}</td>
                    <td className="px-4 py-3">{row.productName}</td>
                    <td className="px-4 py-3">
                      {row.color || "—"} / {row.size || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={movementTone(row.type, row.qty)}>{row.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={row.qty >= 0 ? "font-medium text-green-600" : "font-medium text-red-600"}>
                        {row.qty > 0 ? `+${row.qty}` : row.qty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.refType || "—"}
                      {row.refId ? ` · ${row.refId.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-4 py-3">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}