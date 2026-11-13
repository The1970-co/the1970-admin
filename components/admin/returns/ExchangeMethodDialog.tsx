"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Method = "COMBINED" | "SEPARATE" | "CUSTOMER" | "MANUAL";
type ReturnRow = { id: string; code: string; status: string; originalOrderId: string; exchangeOrderId?: string | null; returnAmount?: number; items?: Array<{ itemType?: string; sku?: string; productName?: string; qty?: number }> };
const methods: Array<{ id: Method; title: string; detail: string }> = [
  { id: "COMBINED", title: "Giao hàng mới, thu hồi hàng cũ cùng chuyến (GHN)", detail: "Shipper giao sản phẩm mới và thu hồi sản phẩm cũ trong cùng chuyến. Hệ thống tính COD chênh lệch và ghi chú thu hồi trên vận đơn; cần xác nhận với GHN/shipper." },
  { id: "SEPARATE", title: "Thu hồi hàng riêng – Nhận hàng trước, gửi đổi sau", detail: "Shop tự tạo vận đơn thu hồi bằng tài khoản GHN bên ngoài. Lưu phiếu chờ hàng về; kho xác nhận đã nhận rồi mới chọn hàng đổi và tạo đơn giao mới." },
  { id: "CUSTOMER", title: "Khách trả hàng trực tiếp tại cửa hàng", detail: "Nhân viên nhận và kiểm tra hàng tại quầy, chọn sản phẩm đổi hoặc hoàn tiền chênh lệch. Không cần tạo vận đơn và không tính phí giao hàng." },
  { id: "MANUAL", title: "Bổ sung thu hồi hàng cho đơn đã tạo", detail: "Đơn mới đã tạo hoặc đang giao thì khách phát sinh trả hàng cũ. Chọn đúng đơn gốc và sản phẩm thu hồi để liên kết; không tự thay đổi COD." },
];

export default function ExchangeMethodDialog({orderId, orderCode, onClose, onLinked}: {orderId: string; orderCode: string; onClose: ()=>void; onLinked: ()=>void}) {
  const [method, setMethod] = useState<Method>("COMBINED");
  const [sourceId, setSourceId] = useState("");
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [selected, setSelected] = useState("");
  const [sourceOrder, setSourceOrder] = useState<any>(null);
  const [manualItems, setManualItems] = useState<Record<string,number>>({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const load = async () => {
    if (!sourceId.trim()) {setError("Nhập mã đơn gốc để tìm các phiếu RTN đã lập."); return;}
    setBusy(true); setError(""); setRows([]); setSelected(""); setNotice(""); setSourceOrder(null); setManualItems({});
    try {
      const originalRes = await apiFetch(`/returns/source-order/${encodeURIComponent(sourceId.trim())}`, { cache: "no-store" });
      if (!originalRes.ok) throw new Error("Không tìm thấy đơn gốc hoặc không có quyền truy cập.");
      const originalData = await originalRes.json();
      setSourceOrder(originalData?.data || originalData?.order || originalData);
      const response = await apiFetch(`/returns/by-order/${encodeURIComponent(sourceId.trim())}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Không đọc được phiếu đổi/trả của đơn gốc.");
      const json = await response.json();
      const data: ReturnRow[] = Array.isArray(json?.data) ? json.data : [];
      setRows(data.filter(r => r.status !== "CANCELLED" && (!r.exchangeOrderId || r.exchangeOrderId === orderId)));
      if (!data.length) setNotice("Đơn gốc chưa có phiếu RTN. Cần tạo phiếu thu hồi trước, không được tự gán hàng trả bằng cách trừ COD.");
    } catch(e) {setError(e instanceof Error ? e.message : "Không tìm được đơn gốc.");}
    finally {setBusy(false);}
  };
  const createManual = async () => {
    const items = Object.entries(manualItems).filter(([,qty])=>qty>0).map(([orderItemId,qty])=>({orderItemId,qty}));
    if (!sourceOrder?.id || !items.length) {setError("Chọn ít nhất một sản phẩm cần thu hồi."); return;}
    setBusy(true); setError("");
    try {
      const res = await apiFetch("/returns/manual-collection", {method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({originalOrderId:sourceOrder.id,exchangeOrderId:orderId,items})});
      const json = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(json?.message || "Không tạo được phiếu thu hồi.");
      onLinked();
    } catch(e) {setError(e instanceof Error ? e.message : "Không lưu được yêu cầu thu hồi.");}
    finally {setBusy(false);}
  };
  const save = async () => {
    if (!selected) {setError("Chọn đúng phiếu RTN chứa hàng thực tế khách trả."); return;}
    setBusy(true); setError("");
    try {
      const res = await apiFetch("/returns/link-existing-exchange", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({returnId: selected, exchangeOrderId: orderId})});
      const json = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(json?.message || "Không thể liên kết phiếu RTN.");
      onLinked();
    } catch(e) {setError(e instanceof Error ? e.message : "Không thể liên kết.");}
    finally {setBusy(false);}
  };
  return <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Chọn phương thức đổi trả">
    <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div><h2 className="text-lg font-semibold tracking-tight text-neutral-950">Đổi / Trả hàng</h2>
          <p className="mt-1 text-xs text-neutral-500">Đơn đang xem: {orderCode}. Chọn phương thức thu hồi trước khi tiếp tục.</p></div>
        <button type="button" onClick={onClose} className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700">Đóng</button>
      </div>
      <div className="mt-4 space-y-2">
        {methods.map(m => <label key={m.id} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${method === m.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}>
          <input type="radio" name="exchange-method" className="mt-0.5 accent-neutral-950" checked={method === m.id} onChange={()=>{setMethod(m.id);setError("");}} />
          <span><span className="block text-sm font-semibold text-neutral-900">{m.title}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{m.detail}</span></span>
        </label>)}
      </div>
      {method === "MANUAL" ? <div className="mt-4 rounded-md border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold text-neutral-950">Gắn phiếu thu hồi đã có vào đơn giao độc lập</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-600">Nhập mã đơn gốc (đơn khách đã mua hàng cũ). Chỉ hiện các phiếu RTN chưa gắn với đơn giao khác. Chọn đúng phiếu có sản phẩm thu hồi. Không tự thay COD, thanh toán hay tồn kho.</p>
        <div className="mt-3 flex gap-2"><input className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" placeholder="ORD-... đơn gốc" value={sourceId} onChange={e=>setSourceId(e.target.value)} />
          <button type="button" disabled={busy} onClick={load} className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Tìm RTN</button></div>
        {rows.length ? <div className="mt-3 space-y-2">{rows.map(r => <label key={r.id} className={`flex cursor-pointer gap-2 rounded-md border p-3 ${selected === r.id ? "border-neutral-950" : "border-neutral-200"}`}><input type="radio" checked={selected === r.id} onChange={()=>setSelected(r.id)} /><span className="text-xs"><b>{r.code}</b> · {r.status} · {(r.items || []).filter(i=>!i.itemType || i.itemType === "RETURN").map(i=>`${i.sku||i.productName} ×${i.qty}`).join(", ") || "Không có sản phẩm trả"}</span></label>)}</div> : null}
        {sourceOrder?.items?.length ? <div className="mt-4 border-t border-neutral-200 pt-3">
          <p className="mb-2 text-xs font-semibold text-neutral-900">Hoặc chọn tay hàng khách mới yêu cầu thu hồi từ đơn gốc</p>
          <div className="space-y-2">{sourceOrder.items.map((item:any) => {
            const available = Math.max(0,Number(item.maxReturnQty ?? item.qty ?? 0));
            return <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 p-2 text-xs">
              <span>{item.sku || item.productName} · {item.color||""} {item.size||""} (còn được trả: {available})</span>
              <input aria-label={`Số lượng thu hồi ${item.sku||item.productName}`} type="number" min={0} max={available} disabled={!available}
                value={manualItems[item.id] || 0} onChange={e=>setManualItems(prev=>({...prev,[item.id]:Math.max(0,Math.min(available,Number(e.target.value)||0))}))}
                className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-right" />
            </div>})}</div>
          <button type="button" disabled={busy || !Object.values(manualItems).some(q=>q>0)} onClick={createManual}
            className="mt-3 rounded-md bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Ghi nhận hàng thu hồi mới · Chờ kho nhận</button>
          <p className="mt-2 text-[11px] text-neutral-500">Tạo RTN mới có liên kết thật với đơn giao này. Không sửa COD, không trả tiền, không nhập kho trước khi nhận hàng.</p>
        </div> : null}
        {notice ? <p className="mt-2 text-xs text-amber-700">{notice}</p> : null}
        <div className="mt-3 flex items-center justify-end gap-2"><button type="button" disabled={busy || !selected} onClick={save} className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Xác nhận liên kết phiếu RTN</button></div>
        <p className="mt-2 text-[11px] text-neutral-500">Nếu khách vừa phát sinh nhu cầu trả hàng và chưa có RTN, mở đơn gốc để tạo phiếu ghi nhận hàng trả trước. Không khai báo “kho đã nhận” khi shipper mới nhận hàng.</p>
      </div> : <div className="mt-5 flex justify-end"><Link href={`/returns/create?orderId=${encodeURIComponent(orderId)}&collectionMethod=${method}`} className="rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">Tiếp tục tạo phiếu</Link></div>}
      {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div> : null}
    </div>
  </div>;
}
