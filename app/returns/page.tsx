"use client";

import AdminShell from "@/components/admin/AdminShell";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useEffect, useState } from "react";

type SearchOrderRow = {
  id: string;
  orderCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  branchId?: string | null;
  createdByStaffName?: string | null;
  soldAt?: string | null;
  finalAmount?: number;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  items?: Array<{
    id: string;
    sku?: string | null;
    productName?: string | null;
    qty?: number;
  }>;
};

type ReturnRow = {
  id: string;
  code: string;
  status?: string | null;
  type?: string | null;
  originalOrderId?: string | null;
  originalBranchId?: string | null;
  handledByStaffName?: string | null;
  handledAtBranchId?: string | null;
  returnReceiveBranchId?: string | null;
  exchangeIssueBranchId?: string | null;
  returnAmount?: number;
  exchangeAmount?: number;
  differenceAmount?: number;
  refundAmount?: number;
  extraChargeAmount?: number;
  refundPaymentSourceId?: string | null;
  extraChargePaymentSourceId?: string | null;
  note?: string | null;
  createdAt?: string | null;
};

type ReturnDetail = ReturnRow & {
  originalStaffName?: string | null;
  handledByStaffId?: string | null;
  originalOrder?: {
    id: string;
    orderCode: string;
    branchId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    createdByStaffName?: string | null;
    soldAt?: string | null;
    finalAmount?: number;
    paymentStatus?: string | null;
    fulfillmentStatus?: string | null;
    payments?: Array<{
      id?: string;
      sourceName?: string | null;
      method?: string | null;
      amount?: number;
    }>;
  } | null;
  items?: Array<{
    id: string;
    itemType?: string | null;
    sku?: string | null;
    productName?: string | null;
    qty?: number;
    unitPrice?: number;
    refundPrice?: number;
    lineTotal?: number;
    reason?: string | null;
  }>;
  cashVouchers?: Array<{
    id: string;
    code?: string | null;
    direction?: string | null;
    voucherType?: string | null;
    amount?: number;
    paymentSourceId?: string | null;
    branchId?: string | null;
    staffName?: string | null;
    note?: string | null;
    createdAt?: string | null;
  }>;
};

function money(value?: number | string | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
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

function ReturnsPageClient() {
  const [q, setQ] = useState("");
  const [orderRows, setOrderRows] = useState<SearchOrderRow[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSearched, setOrderSearched] = useState(false);

  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [returnQ, setReturnQ] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);

  const [selectedReturnId, setSelectedReturnId] = useState("");
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState("");

  const searchOrders = async () => {
    const keyword = q.trim();

    if (keyword.length < 2) {
      setError("Nhập tối thiểu 2 ký tự: SĐT, mã đơn, tên khách hoặc SKU.");
      return;
    }

    try {
      setOrderLoading(true);
      setError("");
      setOrderSearched(true);

      const json = await apiGet(
        `/returns/search-orders?q=${encodeURIComponent(keyword)}`
      );

      setOrderRows(Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tìm được đơn.");
      setOrderRows([]);
    } finally {
      setOrderLoading(false);
    }
  };

  const loadReturns = async () => {
    try {
      setReturnLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (returnQ.trim()) params.set("q", returnQ.trim());

      const json = await apiGet(`/returns?${params.toString()}`);

      setReturnRows(Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách phiếu đổi/trả."
      );
      setReturnRows([]);
    } finally {
      setReturnLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setSelectedReturnId(id);
      setDetailLoading(true);
      setError("");

      const json = await apiGet(`/returns/${encodeURIComponent(id)}`);
      setDetail(json?.data || json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết phiếu.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadReturns();
  }, []);

  const returnItems = (detail?.items || []).filter((item) => item.itemType !== "EXCHANGE");
  const exchangeItems = (detail?.items || []).filter((item) => item.itemType === "EXCHANGE");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Đơn trả hàng
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Một màn để tìm đơn gốc, tạo đổi/trả, xem danh sách phiếu và xem chi tiết.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReturns()}
          className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
        >
          Làm mới danh sách
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-900">Tạo phiếu đổi/trả từ đơn gốc</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Nhân viên chi nhánh vẫn tìm được đơn toàn hệ thống tại màn này.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void searchOrders();
            }}
            placeholder="Nhập SĐT / mã đơn / tên khách / SKU..."
            className="h-12 min-w-0 flex-1 rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-neutral-900"
          />

          <button
            type="button"
            onClick={searchOrders}
            disabled={orderLoading}
            className="h-12 rounded-2xl bg-neutral-950 px-6 text-sm font-bold text-white disabled:bg-neutral-300"
          >
            {orderLoading ? "Đang tìm..." : "Tìm đơn"}
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
          <div className="grid min-w-[960px] grid-cols-[170px_190px_120px_150px_130px_1fr_140px] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500">
            <div>Mã đơn</div>
            <div>Khách hàng</div>
            <div>Chi nhánh bán</div>
            <div>Nhân viên bán</div>
            <div>Tổng tiền</div>
            <div>Sản phẩm</div>
            <div />
          </div>

          {orderRows.length ? (
            orderRows.map((order) => (
              <div
                key={order.id}
                className="grid min-w-[960px] grid-cols-[170px_190px_120px_150px_130px_1fr_140px] items-center border-t border-neutral-100 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold text-neutral-900">{order.orderCode}</div>
                  <div className="mt-1 text-xs text-neutral-500">{order.soldAt || "—"}</div>
                </div>

                <div>
                  <div className="font-medium">{order.customerName || "Khách lẻ"}</div>
                  <div className="mt-1 text-xs text-neutral-500">{order.customerPhone || "—"}</div>
                </div>

                <div className="font-medium">{order.branchId || "—"}</div>
                <div>{order.createdByStaffName || "—"}</div>
                <div className="font-semibold">{money(order.finalAmount)}</div>

                <div className="truncate text-xs text-neutral-500">
                  {(order.items || [])
                    .slice(0, 3)
                    .map((item) => `${item.sku || ""} ${item.productName || ""}`.trim())
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>

                <Link
                  href={`/returns/create?orderId=${order.id}`}
                  className="rounded-2xl bg-neutral-950 px-4 py-2 text-center text-xs font-bold text-white hover:bg-neutral-800"
                >
                  Tạo đổi/trả
                </Link>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">
              {orderSearched ? "Không tìm thấy đơn phù hợp." : "Nhập thông tin để tìm đơn cần đổi/trả."}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="rounded-3xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-neutral-900">Danh sách phiếu đổi/trả</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Bấm mã phiếu để xem đầy đủ: đơn gốc, ai tạo, chi nhánh, sản phẩm, tiền thu/chi.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                value={returnQ}
                onChange={(e) => setReturnQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadReturns();
                }}
                placeholder="Tìm mã phiếu..."
                className="h-10 w-[220px] rounded-2xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-900"
              />
              <button
                type="button"
                onClick={loadReturns}
                disabled={returnLoading}
                className="h-10 rounded-2xl bg-neutral-950 px-4 text-xs font-bold text-white disabled:bg-neutral-300"
              >
                {returnLoading ? "Tải..." : "Tìm"}
              </button>
            </div>
          </div>

          <div className="overflow-auto">
            <div className="grid min-w-[1080px] grid-cols-[150px_150px_110px_120px_120px_120px_130px_150px_1fr] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500">
              <div>Mã phiếu</div>
              <div>Ngày tạo</div>
              <div>Trạng thái</div>
              <div>Tiền trả</div>
              <div>Tiền đổi</div>
              <div>Chênh lệch</div>
              <div>Chi nhánh nhận</div>
              <div>Nhân viên xử lý</div>
              <div>Ghi chú</div>
            </div>

            {returnRows.length ? (
              returnRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void openDetail(row.id)}
                  className={`grid min-w-[1080px] grid-cols-[150px_150px_110px_120px_120px_120px_130px_150px_1fr] items-center border-t border-neutral-100 px-4 py-3 text-left text-sm hover:bg-neutral-50 ${
                    selectedReturnId === row.id ? "bg-neutral-50" : ""
                  }`}
                >
                  <div className="font-semibold text-blue-600">{row.code}</div>
                  <div className="text-xs text-neutral-500">{row.createdAt || "—"}</div>
                  <div>
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold">
                      {row.status || "—"}
                    </span>
                  </div>
                  <div>{money(row.returnAmount)}</div>
                  <div>{money(row.exchangeAmount)}</div>
                  <div>{money(Math.abs(Number(row.differenceAmount || 0)))}</div>
                  <div>{row.returnReceiveBranchId || "—"}</div>
                  <div>{row.handledByStaffName || "—"}</div>
                  <div className="truncate text-xs text-neutral-500">{row.note || "—"}</div>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-neutral-400">
                {returnLoading ? "Đang tải danh sách..." : "Chưa có phiếu đổi/trả nào."}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="font-semibold text-neutral-900">Chi tiết phiếu</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Xem đơn gốc, phiếu trả, tiền thu/chi và kho xử lý.
            </p>
          </div>

          {detailLoading ? (
            <div className="p-5 text-sm text-neutral-500">Đang tải chi tiết...</div>
          ) : detail ? (
            <div className="space-y-5 p-5">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">Mã phiếu</div>
                <div className="mt-1 text-xl font-bold text-neutral-950">{detail.code}</div>
                <div className="mt-1 text-xs text-neutral-500">{detail.createdAt || "—"}</div>
              </div>

              <div className="grid gap-2 text-sm">
                <InfoLine label="Trạng thái" value={detail.status || "—"} />
                <InfoLine label="Loại phiếu" value={detail.type || "—"} />
                <InfoLine label="Chi nhánh bán gốc" value={detail.originalBranchId || "—"} />
                <InfoLine label="Nhân viên bán gốc" value={detail.originalStaffName || detail.originalOrder?.createdByStaffName || "—"} />
                <InfoLine label="Chi nhánh xử lý" value={detail.handledAtBranchId || "—"} />
                <InfoLine label="Kho nhận hàng trả" value={detail.returnReceiveBranchId || "—"} />
                <InfoLine label="Kho xuất hàng đổi" value={detail.exchangeIssueBranchId || "—"} />
                <InfoLine label="Nhân viên xử lý" value={detail.handledByStaffName || "—"} />
              </div>

              {detail.originalOrder ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-xs font-semibold uppercase text-neutral-500">Đơn gốc</div>
                  <Link
                    href={`/orders/${detail.originalOrder.id}`}
                    className="mt-1 block font-semibold text-blue-600 hover:underline"
                  >
                    {detail.originalOrder.orderCode}
                  </Link>
                  <div className="mt-2 text-xs text-neutral-600">
                    {detail.originalOrder.customerName || "Khách lẻ"} · {detail.originalOrder.customerPhone || "—"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">
                    Tổng đơn: <b>{money(detail.originalOrder.finalAmount)}</b>
                  </div>

                  <div className="mt-3 space-y-1">
                    {(detail.originalOrder.payments || []).length ? (
                      detail.originalOrder.payments!.map((payment, index) => (
                        <div key={payment.id || index} className="flex justify-between text-xs">
                          <span>{payment.sourceName || payment.method || "Nguồn tiền"}</span>
                          <b>{money(payment.amount)}</b>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-neutral-400">Chưa có nguồn tiền đơn gốc.</div>
                    )}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">Sản phẩm trả</div>
                {returnItems.length ? (
                  <div className="space-y-2">
                    {returnItems.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-neutral-50 p-3 text-sm">
                        <div className="font-semibold">{item.productName || item.sku || "Sản phẩm"}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          SL {item.qty} · {money(item.lineTotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">Không có sản phẩm trả.</div>
                )}
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">Sản phẩm đổi</div>
                {exchangeItems.length ? (
                  <div className="space-y-2">
                    {exchangeItems.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-neutral-50 p-3 text-sm">
                        <div className="font-semibold">{item.productName || item.sku || "Sản phẩm"}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          SL {item.qty} · {money(item.lineTotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">Không có sản phẩm đổi.</div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
                <InfoLine label="Tiền hàng trả" value={money(detail.returnAmount)} />
                <InfoLine label="Tiền hàng đổi" value={money(detail.exchangeAmount)} />
                <InfoLine label="Chênh lệch" value={money(Math.abs(Number(detail.differenceAmount || 0)))} />
                <InfoLine label="Hoàn khách" value={money(detail.refundAmount)} />
                <InfoLine label="Khách bù thêm" value={money(detail.extraChargeAmount)} />
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-neutral-500">Phiếu thu/chi</div>
                {(detail.cashVouchers || []).length ? (
                  <div className="space-y-2">
                    {detail.cashVouchers!.map((voucher) => (
                      <div key={voucher.id} className="rounded-2xl bg-neutral-50 p-3 text-sm">
                        <div className="flex justify-between">
                          <b>{voucher.code}</b>
                          <b>{voucher.direction === "OUT" ? "-" : "+"}{money(voucher.amount)}</b>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {voucher.voucherType} · {voucher.paymentSourceId || "—"} · {voucher.staffName || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">Chưa phát sinh phiếu thu/chi.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm text-neutral-400">
              Bấm vào mã phiếu trong danh sách để xem chi tiết.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <AdminShell title="Đơn trả hàng">
      <PagePermissionGuard permissions={["menu.returns", "returns.view", "returns.create"]} fallbackPath="/orders">
        <ReturnsPageClient />
      </PagePermissionGuard>
    </AdminShell>
  );
}
