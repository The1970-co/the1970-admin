"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  downloadStocktakeSessionExcel,
  listStocktakeSessions,
  type StocktakeSessionListItem,
} from "@/lib/stocktake-api";
import { getBranches, type BranchItem } from "@/lib/products-api";
import { getCurrentUserFromStorage } from "@/lib/current-user";
import type { AppRole } from "@/lib/authz";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "black";

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: Tone }) {
  const styles: Record<Tone, string> = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    black: "border-neutral-950 bg-neutral-950 text-white",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}

function statusTone(status?: string): Tone {
  const s = String(status || "").toUpperCase();
  if (s === "APPLIED") return "green";
  if (s === "FINISHED") return "blue";
  if (s === "IN_PROGRESS") return "amber";
  if (s === "PAUSED") return "amber";
  if (s === "CANCELLED") return "red";
  return "gray";
}

function statusLabel(status?: string) {
  const s = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    IN_PROGRESS: "Đang kiểm",
    PAUSED: "Tạm dừng",
    FINISHED: "Đã kết thúc kiểm",
    APPLIED: "Đã chốt tồn",
    CANCELLED: "Đã huỷ",
  };
  return labels[s] || s || "—";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

function collectPermissionKeys(user: any) {
  const keys = new Set<string>();
  if (Array.isArray(user?.permissions)) user.permissions.forEach((key: any) => key && keys.add(String(key)));
  if (Array.isArray(user?.permissionKeys)) user.permissionKeys.forEach((key: any) => key && keys.add(String(key)));
  if (Array.isArray(user?.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => {
      if (Array.isArray(row?.permissionKeys)) row.permissionKeys.forEach((key: any) => key && keys.add(String(key)));
    });
  }
  return keys;
}

function isOwnerOrAdmin(user: any) {
  const roles = [...(Array.isArray(user?.roles) ? user.roles : []), user?.role]
    .map((role: any) => String(role || "").toLowerCase())
    .filter(Boolean);
  return roles.includes("owner") || roles.includes("admin");
}

function hasUserPermission(user: any, permission: string) {
  if (isOwnerOrAdmin(user)) return true;
  const keys = collectPermissionKeys(user);
  return keys.has("*") || keys.has(permission);
}

export default function StocktakeSessionsPageClient() {
  const [sessions, setSessions] = useState<StocktakeSessionListItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);
    if (!user) return;
    setRole(user.role as AppRole);
    setCurrentBranchId(user.branchId || null);
    if (user.role !== "admin" && user.role !== "owner" && user.branchId) {
      setBranchId(user.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";
  const canOpenRealtime = hasUserPermission(currentUser, "stocktake.view");
  const canExportStocktake = hasUserPermission(currentUser, "stocktake.excel.export");

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);
      setBranchId((prev) => prev || (!isOwner && currentBranchId ? currentBranchId : ""));
    } catch {}
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      setMessage("");
      const data = await listStocktakeSessions({ branchId, status, from, to });
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được lịch sử kiểm kho.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, currentBranchId]);

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, status, from, to]);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const visibleSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((item) => `${item.id} ${item.name} ${item.note || ""} ${item.branchId} ${branchMap.get(item.branchId) || ""}`.toLowerCase().includes(q));
  }, [sessions, query, branchMap]);

  const total = visibleSessions.length;
  const applied = visibleSessions.filter((s) => String(s.status).toUpperCase() === "APPLIED").length;
  const running = visibleSessions.filter((s) => ["DRAFT", "IN_PROGRESS", "PAUSED"].includes(String(s.status).toUpperCase())).length;
  const finished = visibleSessions.filter((s) => String(s.status).toUpperCase() === "FINISHED").length;

  return (
    <div className="min-h-screen space-y-5 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-950">Lịch sử kiểm kho</h1>
          <p className="mt-1 text-sm text-neutral-500">Xem lại toàn bộ phiên kiểm, lọc chưa kiểm / chênh lệch và xuất Excel.</p>
        </div>
        {canOpenRealtime ? <Link href="/stocktake" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">
          + Vào màn kiểm realtime
        </Link> : null}
      </div>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</div> : null}

      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:grid-cols-4">
        <div className="border-r border-neutral-200 p-5 last:border-r-0"><p className="text-sm font-medium text-neutral-500">Tổng phiên</p><p className="mt-1 text-2xl font-extrabold">{total}</p></div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0"><p className="text-sm font-medium text-neutral-500">Đang mở</p><p className="mt-1 text-2xl font-extrabold text-amber-600">{running}</p></div>
        <div className="border-r border-neutral-200 p-5 last:border-r-0"><p className="text-sm font-medium text-neutral-500">Chờ chốt tồn</p><p className="mt-1 text-2xl font-extrabold text-blue-600">{finished}</p></div>
        <div className="p-5"><p className="text-sm font-medium text-neutral-500">Đã chốt tồn</p><p className="mt-1 text-2xl font-extrabold text-green-600">{applied}</p></div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="text-xs font-semibold text-neutral-500 md:col-span-2">Tìm kiếm
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã phiên, tên phiên, ghi chú..." className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500" />
          </label>
          <label className="text-xs font-semibold text-neutral-500">Chi nhánh
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!isOwner} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500 disabled:bg-neutral-50">
              <option value="">Tất cả</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-neutral-500">Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500">
              <option value="ALL">Tất cả</option>
              <option value="DRAFT">Nháp</option>
              <option value="IN_PROGRESS">Đang kiểm</option>
              <option value="PAUSED">Tạm dừng</option>
              <option value="FINISHED">Đã kết thúc kiểm</option>
              <option value="APPLIED">Đã chốt tồn</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-neutral-500">Từ ngày
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500" />
          </label>
          <label className="text-xs font-semibold text-neutral-500">Đến ngày
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium outline-none focus:border-neutral-500" />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4">
          <p className="text-base font-bold text-neutral-950">Danh sách phiên kiểm</p>
          <button onClick={() => void loadSessions()} className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50">Refresh</button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-bold">Phiên</th>
                <th className="px-4 py-3 font-bold">Chi nhánh</th>
                <th className="px-4 py-3 font-bold">Trạng thái</th>
                <th className="px-4 py-3 font-bold">Bắt đầu</th>
                <th className="px-4 py-3 font-bold">Kết thúc</th>
                <th className="px-4 py-3 font-bold">Máy / lượt scan</th>
                <th className="px-4 py-3 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">Đang tải lịch sử...</td></tr>
              ) : visibleSessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">Chưa có phiên kiểm phù hợp.</td></tr>
              ) : visibleSessions.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50/70">
                  <td className="px-4 py-3">
                    <Link href={`/stocktake-sessions/${item.id}`} className="font-bold text-neutral-950 hover:underline">{item.name || item.id}</Link>
                    <p className="mt-1 font-mono text-xs text-neutral-400">{item.id}</p>
                    {item.note ? <p className="mt-1 max-w-md truncate text-xs text-neutral-500">{item.note}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-neutral-700">{branchMap.get(item.branchId) || item.branchId}</td>
                  <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></td>
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(item.startedAt || item.createdAt)}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(item.finishedAt || item.appliedAt)}</td>
                  <td className="px-4 py-3 text-neutral-600">{item.workers?.length || 0} máy · {item._count?.scanEvents || 0} lượt</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/stocktake-sessions/${item.id}`} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50">Xem chi tiết</Link>
                      {canExportStocktake ? <button onClick={() => void downloadStocktakeSessionExcel(item.id, `kiem-kho-${item.id}.xlsx`)} className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100">Xuất Excel</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
