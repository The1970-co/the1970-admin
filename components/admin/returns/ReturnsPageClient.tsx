"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PaymentRow = {
  id?: string;
  method?: string | null;
  amount?: number | string | null;
  sourceName?: string | null;
  paymentSource?: {
    name?: string | null;
    code?: string | null;
    type?: string | null;
  } | null;
};

type OrderItem = {
  id: string;
  variantId?: string | null;
  sku?: string | null;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderDetail = {
  id: string;
  orderCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  branchId?: string | null;
  createdByStaffName?: string | null;
  createdByStaffId?: string | null;
  salesChannel?: string | null;
  soldAt?: string | null;
  createdAt?: string | null;
  totalAmount?: number;
  finalAmount?: number;
  paymentStatus?: string | null;
  payments?: PaymentRow[];
  items?: OrderItem[];
};

type BranchOption = {
  id: string;
  name: string;
  code?: string;
};

type PaymentSource = {
  id: string;
  name: string;
  code?: string;
  type?: string;
  branchId?: string | null;
  isActive?: boolean;
};

type ReturnLine = OrderItem & {
  returnQty: number;
  reason: string;
};

function money(value?: number | string | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function apiGet(path: string) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Không tải được dữ liệu.");
  }

  return json;
}

async function apiPost(path: string, body: any) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Không lưu được phiếu đổi trả.");
  }

  return json;
}

function normalizeBranchName(value?: string | null) {
  return String(value || "").trim() || "—";
}

export default function ReturnCreatePageClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [receiveBranchId, setReceiveBranchId] = useState("");
  const [refundPaymentSourceId, setRefundPaymentSourceId] = useState("");
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [note, setNote] = useState("");
  const [statusMode, setStatusMode] = useState<"COMPLETED" | "DRAFT">("COMPLETED");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const branchName = (id?: string | null) => {
    if (!id) return "—";
    return branches.find((branch) => branch.id === id)?.name || id;
  };

  const activePaymentSources = useMemo(() => {
    return paymentSources.filter((source) => source.isActive !== false);
  }, [paymentSources]);

  const branchPaymentSources = useMemo(() => {
    if (!receiveBranchId) return activePaymentSources;

    return activePaymentSources.filter((source) => {
      if (!source.branchId) return true;
      return String(source.branchId) === String(receiveBranchId);
    });
  }, [activePaymentSources, receiveBranchId]);

  const returnTotal = useMemo(() => {
    return returnLines.reduce(
      (sum, line) => sum + toNumber(line.unitPrice) * toNumber(line.returnQty),
      0
    );
  }, [returnLines]);

  const selectedQty = useMemo(() => {
    return returnLines.reduce((sum, line) => sum + toNumber(line.returnQty), 0);
  }, [returnLines]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");

        if (!orderId) {
          throw new Error("Thiếu orderId.");
        }

        const [orderJson, branchJson, paymentJson] = await Promise.all([
          apiGet(`/returns/source-order/${encodeURIComponent(orderId)}`),
          apiGet("/branches").catch(() => []),
          apiGet("/payment-sources").catch(() => []),
        ]);

        const detail: OrderDetail = orderJson?.data || orderJson?.order || orderJson;
        const branchRows = Array.isArray(branchJson)
          ? branchJson
          : Array.isArray(branchJson?.items)
            ? branchJson.items
            : Array.isArray(branchJson?.data)
              ? branchJson.data
              : [];

        const paymentRows = Array.isArray(paymentJson)
          ? paymentJson
          : Array.isArray(paymentJson?.items)
            ? paymentJson.items
            : Array.isArray(paymentJson?.data)
              ? paymentJson.data
              : [];

        setOrder(detail);

        setBranches(
          branchRows
            .map((row: any) => ({
              id: String(row.id || row.code || ""),
              name: String(row.name || row.displayName || row.code || "Chi nhánh"),
              code: row.code ? String(row.code) : undefined,
            }))
            .filter((row: BranchOption) => row.id)
        );

        setPaymentSources(
          paymentRows
            .map((row: any) => ({
              id: String(row.id || ""),
              name: String(row.name || row.label || row.code || "Nguồn tiền"),
              code: row.code ? String(row.code) : undefined,
              type: row.type ? String(row.type) : undefined,
              branchId: row.branchId ? String(row.branchId) : null,
              isActive: row.isActive !== false,
            }))
            .filter((row: PaymentSource) => row.id)
        );

        setReceiveBranchId(detail.branchId || "");

        const items = Array.isArray(detail.items) ? detail.items : [];

        setReturnLines(
          items.map((item) => ({
            ...item,
            returnQty: Number(item.qty || 0),
            reason: "Khách trả hàng",
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được phiếu đổi trả.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [orderId]);

  useEffect(() => {
    if (!refundPaymentSourceId && branchPaymentSources[0]?.id) {
      setRefundPaymentSourceId(branchPaymentSources[0].id);
    }
  }, [branchPaymentSources, refundPaymentSourceId]);

  const updateReturnQty = (itemId: string, value: number) => {
    setReturnLines((prev) =>
      prev.map((line) =>
        line.id === itemId
          ? {
              ...line,
              returnQty: Math.max(0, Math.min(Number(value || 0), Number(line.qty || 0))),
            }
          : line
      )
    );
  };

  const handleSave = async () => {
    if (!order) return;

    const selectedItems = returnLines.filter((line) => Number(line.returnQty || 0) > 0);

    if (!selectedItems.length) {
      setError("Chưa chọn sản phẩm trả.");
      return;
    }

    if (!receiveBranchId) {
      setError("Chưa chọn chi nhánh/kho nhận hàng trả.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        originalOrderId: order.id,
        originalBranchId: order.branchId || null,
        originalStaffId: order.createdByStaffId || null,
        handledAtBranchId: receiveBranchId,
        returnReceiveBranchId: receiveBranchId,
        type: "RETURN",
        status: statusMode,
        refundAmount: returnTotal,
        refundPaymentSourceId: refundPaymentSourceId || null,
        note,
        items: selectedItems.map((line) => ({
          orderItemId: line.id,
          variantId: line.variantId || null,
          sku: line.sku || null,
          productName: line.productName || null,
          qty: Number(line.returnQty || 0),
          unitPrice: Number(line.unitPrice || 0),
          refundPrice: Number(line.unitPrice || 0),
          reason: line.reason || null,
        })),
      };

      await apiPost("/returns", payload);

      setMessage("Đã tạo phiếu đổi/trả hàng.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không lưu được phiếu đổi trả. Kiểm tra backend /returns."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        Đang tải màn đổi trả...
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        Không tìm thấy đơn hàng.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/orders/${order.id}`} className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">
            ← Quay lại đơn hàng
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            Tạo phiếu đổi / trả hàng
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Đơn gốc: <span className="font-semibold text-neutral-900">{order.orderCode}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || selectedQty <= 0}
          className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-300"
        >
          {saving ? "Đang lưu..." : "Tạo phiếu đổi/trả"}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-semibold text-neutral-900">Thông tin đơn gốc</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Dùng để xác định chi nhánh bán, nhân viên bán và nguồn tiền ban đầu.
              </p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
              <Info label="Khách hàng" value={`${order.customerName || "Khách lẻ"}${order.customerPhone ? ` · ${order.customerPhone}` : ""}`} />
              <Info label="Chi nhánh bán" value={branchName(order.branchId)} />
              <Info label="Nhân viên bán/tạo" value={order.createdByStaffName || "—"} />
              <Info label="Ngày bán" value={order.soldAt || order.createdAt || "—"} />
              <Info label="Kênh bán" value={order.salesChannel || "—"} />
              <Info label="Tổng đơn" value={money(order.finalAmount)} />
            </div>

            <div className="border-t border-neutral-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Nguồn tiền đã thanh toán
              </p>

              <div className="mt-3 space-y-2">
                {Array.isArray(order.payments) && order.payments.length ? (
                  order.payments.map((payment, index) => (
                    <div
                      key={payment.id || index}
                      className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-neutral-800">
                        {payment.sourceName ||
                          payment.paymentSource?.name ||
                          payment.method ||
                          "Nguồn tiền"}
                      </span>
                      <span className="font-semibold">{money(payment.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                    Chưa có dữ liệu nguồn tiền.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-neutral-900">Sản phẩm trả</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Mặc định chọn trả toàn bộ. Có thể chỉnh số lượng từng dòng.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReturnLines((prev) =>
                      prev.map((line) => ({ ...line, returnQty: Number(line.qty || 0) }))
                    )
                  }
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                >
                  Trả toàn bộ
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReturnLines((prev) => prev.map((line) => ({ ...line, returnQty: 0 })))
                  }
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <div className="grid min-w-[780px] grid-cols-[1fr_90px_110px_130px_180px] border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-xs font-semibold uppercase text-neutral-500">
                <div>Sản phẩm</div>
                <div>Đã mua</div>
                <div>SL trả</div>
                <div>Tiền hoàn</div>
                <div>Lý do</div>
              </div>

              {returnLines.map((line) => (
                <div
                  key={line.id}
                  className="grid min-w-[780px] grid-cols-[1fr_90px_110px_130px_180px] items-center border-b border-neutral-100 px-5 py-3 text-sm"
                >
                  <div>
                    <div className="font-semibold text-neutral-900">{line.productName || "Sản phẩm"}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {line.sku || "—"} · {line.color || "—"} / {line.size || "—"} · {money(line.unitPrice)}
                    </div>
                  </div>

                  <div>{line.qty}</div>

                  <input
                    value={line.returnQty}
                    onChange={(e) => updateReturnQty(line.id, Number(e.target.value || 0))}
                    className="h-10 w-20 rounded-xl border border-neutral-200 px-3 text-center outline-none focus:border-neutral-900"
                  />

                  <div className="font-semibold">{money(toNumber(line.unitPrice) * toNumber(line.returnQty))}</div>

                  <input
                    value={line.reason}
                    onChange={(e) =>
                      setReturnLines((prev) =>
                        prev.map((item) =>
                          item.id === line.id ? { ...item, reason: e.target.value } : item
                        )
                      )
                    }
                    className="h-10 rounded-xl border border-neutral-200 px-3 outline-none focus:border-neutral-900"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900">Xử lý phiếu</h2>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Chi nhánh/kho nhận hàng trả
            </label>
            <select
              value={receiveBranchId}
              onChange={(e) => setReceiveBranchId(e.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Nguồn tiền hoàn / thu thêm
            </label>
            <select
              value={refundPaymentSourceId}
              onChange={(e) => setRefundPaymentSourceId(e.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Chọn nguồn tiền</option>
              {branchPaymentSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Trạng thái
            </label>
            <select
              value={statusMode}
              onChange={(e) => setStatusMode(e.target.value as "COMPLETED" | "DRAFT")}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="COMPLETED">Đã nhận hàng và xử lý</option>
              <option value="DRAFT">Lưu nháp</option>
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Ghi chú
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Khách đổi size, hoàn tiền mặt..."
              className="mt-2 min-h-[96px] w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm outline-none focus:border-neutral-900"
            />
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900">Tổng kết</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Số dòng trả</span>
                <strong>{returnLines.filter((line) => Number(line.returnQty) > 0).length}</strong>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-500">Tổng SL trả</span>
                <strong>{selectedQty}</strong>
              </div>

              <div className="border-t border-neutral-100 pt-3" />

              <div className="flex justify-between text-base">
                <span className="font-semibold">Cần hoàn khách</span>
                <strong className="text-xl">{money(returnTotal)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || selectedQty <= 0}
              className="mt-5 h-12 w-full rounded-2xl bg-neutral-950 font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              {saving ? "Đang lưu..." : "Tạo phiếu đổi/trả"}
            </button>

            <p className="mt-3 text-xs leading-5 text-neutral-500">
              Nếu bấm lưu báo lỗi backend /returns, nghĩa là cần thêm controller/service returns ở core-api.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{normalizeBranchName(value)}</p>
    </div>
  );
}
