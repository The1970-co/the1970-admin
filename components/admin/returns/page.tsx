"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReturnItem = { itemType?: string; sku?: string | null; productName?: string | null; qty?: number };
type ReturnRow = {
  id: string; code: string; type: string; status: string;
  originalOrderId: string; originalOrder?: { orderCode?: string; customerName?: string; customerPhone?: string } | null;
  returnReceiveBranchId?: string | null; handledAtBranchId?: string | null;
  createdAt?: string | null; createdAtIso?: string | null;
  returnAmount?: number; refundAmount?: number; extraChargeAmount?: number;
  items?: ReturnItem[];
};
type OrderSearchRow = { id: string; orderCode: string; customerName?: string; customerPhone?: string; branchId?: string };
const statusOptions = [
  ["ALL", "Tất cả trạng thái"], ["PENDING", "Chờ nhận hàng"],
  ["COMPLETED", "Đã hoàn thành"], ["CANCELLED", "Đã hủy"],
  ["DRAFT", "Nháp"],
];
const typeOptions = [["ALL", "Tất cả loại phiếu"], ["RETURN", "Trả hàng"], ["RETURN_EXCHANGE", "Đổi hàng"]];
const money = (value: number | undefined) => new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
const labelStatus = (value: string) => ({ PENDING: "Chờ nhận hàng", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", DRAFT: "Nháp" } as Record<string, string>)[value] || value;

export default function ReturnsSearchPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [branchId, setBranchId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [orders, setOrders] = useState<OrderSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [orderError, setOrderError] = useState("");

  const headers = () => {
    const token = localStorage.getItem("token");
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "ALL") params.set("status", status);
      if (type !== "ALL") params.set("type", type);
      if (branchId !== "ALL") params.set("branchId", branchId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${API_BASE}/returns?${params.toString()}`, { headers: headers(), cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(json?.message) ? json.message.join(", ") : json?.message || "Không tải được danh sách đổi/trả.");
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu."); }
    finally { setLoading(false); }
  }, [q, status, type, branchId, from, to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/returns`, { headers: headers(), cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (cancelled) return;
        const data: ReturnRow[] = Array.isArray(json?.data) ? json.data : [];
        setBranches([...new Set(data.map((r) => r.returnReceiveBranchId).filter((id): id is string => !!id))].sort());
      }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const totalRefund = useMemo(() => rows.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0), [rows]);
  const searchOrders = async () => {
    if (!orderQuery.trim()) return;
    setSearching(true); setOrderError("");
    try {
      const res = await fetch(`${API_BASE}/returns/search-orders?q=${encodeURIComponent(orderQuery.trim())}`, { headers: headers() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Không tìm được đơn hàng.");
      setOrders(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    } catch (e) { setOrderError(e instanceof Error ? e.message : "Lỗi tìm đơn."); }
    finally { setSearching(false); }
  };
  const reset = () => { setQ(""); setStatus("ALL"); setType("ALL"); setBranchId("ALL"); setFrom(""); setTo(""); };
  const field = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 min-w-0";

  return <div className="p-4 md:p-6 space-y-5 text-gray-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold">Danh sách đổi / trả hàng</h1><p className="text-xs text-gray-500 mt-1">Lọc phiếu RTN theo trạng thái, loại phiếu, chi nhánh và thời gian.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{loading ? "Đang tải..." : "Làm mới"}</button>
    </div>
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <input className={field} aria-label="Tìm mã phiếu, mã đơn, khách hàng hoặc SKU" placeholder="Mã RTN / đơn / SĐT / SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={field} aria-label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={field} aria-label="Loại phiếu" value={type} onChange={(e) => setType(e.target.value)}>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={field} aria-label="Chi nhánh nhận trả" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="ALL">Tất cả chi nhánh</option>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <label className="flex flex-col gap-1 text-xs text-gray-500">Từ ngày<input className={field} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">Đến ngày<input className={field} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-gray-600">Hiển thị <b>{rows.length}</b> phiếu (tối đa 500) · Tổng tiền hoàn <b>{money(totalRefund)}</b></div><button type="button" onClick={reset} className="rounded-lg border px-3 py-2 text-xs">Xóa bộ lọc</button></div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="bg-gray-50 text-gray-500"><tr>{["Mã phiếu / ngày tạo", "Đơn gốc", "Khách hàng", "Chi nhánh", "Loại phiếu", "Trạng thái", "Sản phẩm", "Giá trị trả", "Hoàn tiền", "Thu thêm"].map((x) => <th key={x} className="px-3 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map((r) => <tr key={r.id} className="hover:bg-gray-50">
        <td className="px-3 py-3"><Link href={`/returns/${encodeURIComponent(r.id)}`} className="font-semibold text-blue-700 hover:underline">{r.code}</Link><div className="text-gray-400 mt-1">{r.createdAt || "—"}</div></td>
        <td className="px-3 py-3">{r.originalOrder?.orderCode || r.originalOrderId}</td>
        <td className="px-3 py-3">{r.originalOrder?.customerName || "—"}<div className="text-gray-500">{r.originalOrder?.customerPhone}</div></td>
        <td className="px-3 py-3">{r.returnReceiveBranchId || "—"}</td>
        <td className="px-3 py-3">{r.type === "RETURN_EXCHANGE" ? "Đổi hàng" : r.type === "RETURN" ? "Trả hàng" : r.type}</td>
        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 font-medium ${r.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : r.status === "CANCELLED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{labelStatus(r.status)}</span></td>
        <td className="px-3 py-3 max-w-52"><div className="line-clamp-2">{(r.items || []).filter((i) => i.itemType !== "EXCHANGE").map((i) => `${i.sku || i.productName || "Sản phẩm"} ×${i.qty || 0}`).join(", ") || "—"}</div></td>
        <td className="px-3 py-3 whitespace-nowrap">{money(r.returnAmount)}</td><td className="px-3 py-3 whitespace-nowrap">{money(r.refundAmount)}</td><td className="px-3 py-3 whitespace-nowrap">{money(r.extraChargeAmount)}</td>
      </tr>)}{!loading && !rows.length && <tr><td colSpan={10} className="py-8 text-center text-gray-400">Không tìm thấy phiếu đổi/trả phù hợp.</td></tr>}</tbody></table></div>
    </section>
    <section className="rounded-xl border bg-white p-4 space-y-3"><h2 className="font-semibold text-sm">Tạo phiếu đổi/trả từ đơn gốc</h2>
      <form onSubmit={(e) => { e.preventDefault(); void searchOrders(); }} className="flex flex-wrap gap-2"><input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} className={`${field} flex-1`} placeholder="SĐT / mã đơn / SKU" /><button type="submit" disabled={searching} className="rounded-lg bg-black text-white px-5 py-2 text-sm disabled:opacity-50">{searching ? "Đang tìm" : "Tìm đơn"}</button></form>
      {orderError && <p className="text-sm text-red-600">{orderError}</p>}
      <div className="grid gap-2 md:grid-cols-2">{orders.map((o) => <Link key={o.id} href={`/returns/create?orderId=${encodeURIComponent(o.id)}`} className="block rounded-lg border p-3 hover:bg-gray-50"><div className="font-semibold text-sm">{o.orderCode}</div><p className="text-xs text-gray-500">{o.customerName} · {o.customerPhone} · {o.branchId}</p></Link>)}</div>
    </section>
  </div>;
}
