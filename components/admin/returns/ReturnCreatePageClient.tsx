"use client";

import { API_BASE } from "@/lib/api-base";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PaymentRow = {
  id?: string;
  method?: string | null;
  amount?: number | string | null;
  sourceName?: string | null;
  paymentSourceId?: string | null;
  paymentSource?: {
    id?: string | null;

    
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
  fulfillmentStatus?: string | null;
  status?: string | null;
  payments?: PaymentRow[];
  items?: OrderItem[];
  isReturnable?: boolean;
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
  alreadyReturnedQty?: number;
  maxReturnQty?: number;
};

type ExchangeLine = {
  id: string;
  sku?: string | null;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  price: number;
  stock?: number;
  qty: number;
};

function money(value?: number | string | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function normalizeRows(input: any) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.items)) return input.items;
  if (Array.isArray(input?.rows)) return input.rows;
  return [];
}

function isReturnableOrder(order: OrderDetail | null) {
  if (!order) return false;

  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();
  const fulfillmentStatus = String(order.fulfillmentStatus || "").toUpperCase();

  return (
    order.isReturnable === true ||
    status === "COMPLETED" ||
    fulfillmentStatus === "FULFILLED" ||
    (paymentStatus === "PAID" && fulfillmentStatus !== "UNFULFILLED")
  );
}

export default function ReturnCreatePageClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);

  const [receiveBranchId, setReceiveBranchId] = useState("");
  const [exchangeIssueBranchId, setExchangeIssueBranchId] = useState("");

  const [refundPaymentSourceId, setRefundPaymentSourceId] = useState("");
  const [extraChargePaymentSourceId, setExtraChargePaymentSourceId] = useState("");

  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [exchangeLines, setExchangeLines] = useState<ExchangeLine[]>([]);

  const [exchangeSearch, setExchangeSearch] = useState("");
  const [exchangeResults, setExchangeResults] = useState<ExchangeLine[]>([]);
  const [searchingExchange, setSearchingExchange] = useState(false);

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

  const paymentSourcesForBranch = (targetBranchId: string) => {
    if (!targetBranchId) return activePaymentSources;

    const targetBranch = branches.find((branch) => branch.id === targetBranchId);
    const targetCode = targetBranch?.code || targetBranch?.id || targetBranchId;
    const targetName = targetBranch?.name || targetBranchId;

    return activePaymentSources.filter((source) => {
      const sourceBranch = source.branchId || "";
      if (!sourceBranch) return true;

      return (
        String(sourceBranch) === String(targetBranchId) ||
        String(sourceBranch) === String(targetCode) ||
        normalizeText(sourceBranch) === normalizeText(targetName) ||
        normalizeText(sourceBranch) === "all" ||
        normalizeText(sourceBranch) === "tat ca"
      );
    });
  };

  const refundPaymentSources = useMemo(() => {
    return paymentSourcesForBranch(receiveBranchId);
  }, [activePaymentSources, branches, receiveBranchId]);

  const extraChargePaymentSources = useMemo(() => {
    // Thu thêm là tiền đi vào quầy/chi nhánh xử lý, không phụ thuộc kho xuất hàng đổi.
    return paymentSourcesForBranch(receiveBranchId);
  }, [activePaymentSources, branches, receiveBranchId]);

  const returnTotal = useMemo(() => {
    return returnLines.reduce((sum, line) => {
      return sum + toNumber(line.unitPrice) * toNumber(line.returnQty);
    }, 0);
  }, [returnLines]);

  const exchangeTotal = useMemo(() => {
    return exchangeLines.reduce((sum, line) => {
      return sum + toNumber(line.price) * toNumber(line.qty);
    }, 0);
  }, [exchangeLines]);

  const differenceAmount = returnTotal - exchangeTotal;
  const refundAmount = differenceAmount > 0 ? differenceAmount : 0;
  const extraChargeAmount = differenceAmount < 0 ? Math.abs(differenceAmount) : 0;

  const selectedReturnQty = useMemo(() => {
    return returnLines.reduce((sum, line) => sum + toNumber(line.returnQty), 0);
  }, [returnLines]);

  const selectedExchangeQty = useMemo(() => {
    return exchangeLines.reduce((sum, line) => sum + toNumber(line.qty), 0);
  }, [exchangeLines]);

  const canSubmit = useMemo(() => {
    if (!order) return false;
    if (!isReturnableOrder(order)) return false;
    if (saving) return false;
    if (!receiveBranchId) return false;
    if (selectedReturnQty <= 0 && selectedExchangeQty <= 0) return false;
    if (refundAmount > 0 && !refundPaymentSourceId) return false;
    if (extraChargeAmount > 0 && !extraChargePaymentSourceId) return false;
    return true;
  }, [
    order,
    saving,
    receiveBranchId,
    selectedReturnQty,
    selectedExchangeQty,
    refundAmount,
    extraChargeAmount,
    refundPaymentSourceId,
    extraChargePaymentSourceId,
  ]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        if (!orderId) {
          throw new Error("Thiếu orderId.");
        }

        const [orderJson, branchJson, paymentJson] = await Promise.all([
          apiGet(`/returns/source-order/${encodeURIComponent(orderId)}`),
          apiGet("/branches").catch(() => []),
          apiGet("/payment-sources").catch(() => []),
        ]);

        const detail: OrderDetail = orderJson?.data || orderJson?.order || orderJson;

        const branchRows = normalizeRows(branchJson);
        const paymentRows = normalizeRows(paymentJson);

        const normalizedBranches = branchRows
          .map((row: any) => ({
            id: String(row.id || row.code || ""),
            name: String(row.name || row.displayName || row.code || "Chi nhánh"),
            code: row.code ? String(row.code) : undefined,
          }))
          .filter((row: BranchOption) => row.id);

        const normalizedSources = paymentRows
          .map((row: any) => ({
            id: String(row.id || ""),
            name: String(row.name || row.label || row.code || "Nguồn tiền"),
            code: row.code ? String(row.code) : undefined,
            type: row.type ? String(row.type) : undefined,
            branchId: row.branchId ? String(row.branchId) : null,
            isActive: row.isActive !== false,
          }))
          .filter((row: PaymentSource) => row.id);

        setOrder(detail);
        setBranches(normalizedBranches);
        setPaymentSources(normalizedSources);

        setReceiveBranchId(detail.branchId || "");
        setExchangeIssueBranchId(detail.branchId || "");

        const items = Array.isArray(detail.items) ? detail.items : [];

        setReturnLines(
          items.map((item) => ({
            ...item,
            returnQty: Number(item.qty || 0),
            reason: "Khách trả hàng",
            alreadyReturnedQty: 0,
            maxReturnQty: Number(item.qty || 0),
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
    if (refundAmount <= 0) return;
    const stillValid = refundPaymentSources.some(
      (source) => String(source.id) === String(refundPaymentSourceId)
    );

    if (refundPaymentSourceId && stillValid) return;

    setRefundPaymentSourceId(refundPaymentSources[0]?.id || "");
  }, [refundAmount, refundPaymentSourceId, refundPaymentSources]);

  useEffect(() => {
    if (extraChargeAmount <= 0) return;
    const stillValid = extraChargePaymentSources.some(
      (source) => String(source.id) === String(extraChargePaymentSourceId)
    );

    if (extraChargePaymentSourceId && stillValid) return;

    setExtraChargePaymentSourceId(extraChargePaymentSources[0]?.id || "");
  }, [extraChargeAmount, extraChargePaymentSourceId, extraChargePaymentSources]);

  useEffect(() => {
    const keyword = exchangeSearch.trim();

    if (keyword.length < 2) {
      setExchangeResults([]);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setSearchingExchange(true);

        const token = getToken();

        const res = await fetch(`${API_BASE}/products?q=${encodeURIComponent(keyword)}`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setExchangeResults([]);
          return;
        }

        const productRows = normalizeRows(json);
        const variants: ExchangeLine[] = [];

        productRows.forEach((product: any) => {
          const productName = String(product.name || product.productName || "Sản phẩm");

          const productVariants = Array.isArray(product.variants)
            ? product.variants
            : Array.isArray(product.productVariants)
              ? product.productVariants
              : [];

          if (productVariants.length) {
            productVariants.forEach((variant: any) => {
              variants.push({
                id: String(variant.id || ""),
                sku: String(variant.sku || ""),
                productName: String(variant.productName || productName),
                color: variant.color || variant.colorName || "",
                size: variant.size || variant.sizeName || "",
                price: Number(variant.priceVnd || variant.price || product.price || 0),
                stock: Number(variant.stock || variant.availableQty || 0),
                qty: 1,
              });
            });
          } else if (product.id) {
            variants.push({
              id: String(product.variantId || product.id),
              sku: String(product.sku || ""),
              productName,
              color: product.color || "",
              size: product.size || "",
              price: Number(product.priceVnd || product.price || 0),
              stock: Number(product.stock || product.availableQty || 0),
              qty: 1,
            });
          }
        });

        setExchangeResults(variants.filter((item) => item.id).slice(0, 20));
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setExchangeResults([]);
        }
      } finally {
        setSearchingExchange(false);
      }
    };

    const timer = window.setTimeout(run, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [exchangeSearch]);

  const updateReturnQty = (itemId: string, value: number) => {
    setReturnLines((prev) =>
      prev.map((line) => {
        if (line.id !== itemId) return line;

        const maxQty = Number(line.maxReturnQty ?? line.qty ?? 0);
        const safeQty = Math.max(0, Math.min(Number(value || 0), maxQty));

        return {
          ...line,
          returnQty: safeQty,
        };
      })
    );
  };

  const addExchangeLine = (variant: ExchangeLine) => {
    setExchangeLines((prev) => {
      const existed = prev.find((line) => line.id === variant.id);

      if (existed) {
        return prev.map((line) =>
          line.id === variant.id
            ? {
                ...line,
                qty: Number(line.qty || 0) + 1,
              }
            : line
        );
      }

      return [
        ...prev,
        {
          ...variant,
          qty: 1,
        },
      ];
    });

    setExchangeSearch("");
    setExchangeResults([]);
  };

  const updateExchangeQty = (variantId: string, value: number) => {
    setExchangeLines((prev) =>
      prev.map((line) =>
        line.id === variantId
          ? {
              ...line,
              qty: Math.max(1, Number(value || 1)),
            }
          : line
      )
    );
  };

  const removeExchangeLine = (variantId: string) => {
    setExchangeLines((prev) => prev.filter((line) => line.id !== variantId));
  };

  const validateBeforeSubmit = () => {
    if (!order) {
      return "Không có đơn gốc.";
    }

    if (!isReturnableOrder(order)) {
      return "Đơn này chưa đủ điều kiện đổi/trả. Chỉ xử lý khi đơn đã hoàn thành/đã giao/đã thanh toán hợp lệ.";
    }

    if (!receiveBranchId) {
      return "Chưa chọn chi nhánh/kho nhận hàng trả.";
    }

    if (selectedReturnQty <= 0 && selectedExchangeQty <= 0) {
      return "Chưa có sản phẩm trả hoặc sản phẩm đổi.";
    }

    const invalidReturn = returnLines.find(
      (line) => Number(line.returnQty || 0) > Number(line.maxReturnQty ?? line.qty ?? 0)
    );

    if (invalidReturn) {
      return `Sản phẩm ${invalidReturn.sku || invalidReturn.productName || ""} vượt số lượng được trả.`;
    }

    if (refundAmount > 0 && !refundPaymentSourceId) {
      return "Chưa chọn nguồn tiền hoàn khách.";
    }

    if (extraChargeAmount > 0 && !extraChargePaymentSourceId) {
      return "Chưa chọn nguồn tiền khách bù thêm.";
    }

    return "";
  };

  const handleSave = async () => {
    if (!order) return;

    const validationMessage = validateBeforeSubmit();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const selectedReturnItems = returnLines.filter((line) => Number(line.returnQty || 0) > 0);

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
        exchangeIssueBranchId: exchangeIssueBranchId || receiveBranchId,

        type: exchangeLines.length ? "RETURN_EXCHANGE" : "RETURN",
        status: statusMode,

        refundPaymentSourceId: refundAmount > 0 ? refundPaymentSourceId : null,
        extraChargePaymentSourceId:
          extraChargeAmount > 0 ? extraChargePaymentSourceId : null,

        note,

        items: [
          ...selectedReturnItems.map((line) => ({
            itemType: "RETURN",
            orderItemId: line.id,
            variantId: line.variantId || null,
            sku: line.sku || null,
            productName: line.productName || null,
            qty: Number(line.returnQty || 0),
            unitPrice: Number(line.unitPrice || 0),
            refundPrice: Number(line.unitPrice || 0),
            reason: line.reason || null,
          })),
          ...exchangeLines.map((line) => ({
            itemType: "EXCHANGE",
            orderItemId: null,
            variantId: line.id,
            sku: line.sku || null,
            productName: line.productName || null,
            qty: Number(line.qty || 0),
            unitPrice: Number(line.price || 0),
            refundPrice: Number(line.price || 0),
            reason: "Sản phẩm đổi cho khách",
          })),
        ],
      };

      const created = await apiPost("/returns", payload);

      setMessage(`Đã tạo phiếu đổi/trả ${created?.code || ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được phiếu đổi trả.");
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

  const returnable = isReturnableOrder(order);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/returns"
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            ← Quay lại đơn trả hàng
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            Tạo phiếu đổi / trả hàng
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Đơn gốc:{" "}
            <Link
              href={`/orders/${order.id}`}
              className="font-semibold text-blue-600 hover:underline"
            >
              {order.orderCode}
            </Link>
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit}
          className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-300"
        >
          {saving ? "Đang lưu..." : "Tạo phiếu đổi/trả"}
        </button>
      </div>

      {!returnable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Đơn này chưa đủ điều kiện đổi/trả. Chỉ nên xử lý khi đơn đã hoàn thành/đã giao/đã thanh toán hợp lệ.
        </div>
      ) : null}

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

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
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
              <Info label="Trạng thái đơn" value={`${order.status || "—"} / ${order.paymentStatus || "—"} / ${order.fulfillmentStatus || "—"}`} />
              <Info label="Tổng đơn" value={money(order.finalAmount)} />
            </div>

            <div className="border-t border-neutral-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Nguồn tiền khách đã thanh toán
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
                  Không cho chọn vượt số lượng đã mua. Backend vẫn chặn trả trùng.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReturnLines((prev) =>
                      prev.map((line) => ({
                        ...line,
                        returnQty: Number(line.maxReturnQty ?? line.qty ?? 0),
                      }))
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
              <div className="grid min-w-[880px] grid-cols-[1fr_80px_100px_120px_130px_180px] border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-xs font-semibold uppercase text-neutral-500">
                <div>Sản phẩm</div>
                <div>Đã mua</div>
                <div>Còn trả</div>
                <div>SL trả</div>
                <div>Tiền hoàn</div>
                <div>Lý do</div>
              </div>

              {returnLines.map((line) => {
                const maxReturnQty = Number(line.maxReturnQty ?? line.qty ?? 0);

                return (
                  <div
                    key={line.id}
                    className="grid min-w-[880px] grid-cols-[1fr_80px_100px_120px_130px_180px] items-center border-b border-neutral-100 px-5 py-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-neutral-900">
                        {line.productName || "Sản phẩm"}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {line.sku || "—"} · {line.color || "—"} / {line.size || "—"} · {money(line.unitPrice)}
                      </div>
                    </div>

                    <div>{line.qty}</div>
                    <div>{maxReturnQty}</div>

                    <input
                      value={line.returnQty}
                      onChange={(e) => updateReturnQty(line.id, Number(e.target.value || 0))}
                      className="h-10 w-20 rounded-xl border border-neutral-200 px-3 text-center outline-none focus:border-neutral-900"
                    />

                    <div className="font-semibold">
                      {money(toNumber(line.unitPrice) * toNumber(line.returnQty))}
                    </div>

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
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-semibold text-neutral-900">Sản phẩm đổi</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Nếu tiền hàng đổi lớn hơn tiền hàng trả, hệ thống sẽ tạo phiếu thu.
              </p>
            </div>

            <div className="p-5">
              <div className="relative">
                <input
                  value={exchangeSearch}
                  onChange={(e) => setExchangeSearch(e.target.value)}
                  placeholder="Tìm SKU / tên sản phẩm đổi..."
                  className="h-11 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-neutral-900"
                />

                {exchangeSearch.trim().length >= 2 ? (
                  <div className="absolute left-0 right-0 top-12 z-30 max-h-72 overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
                    {searchingExchange ? (
                      <div className="px-4 py-3 text-sm text-neutral-500">Đang tìm...</div>
                    ) : exchangeResults.length ? (
                      exchangeResults.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => addExchangeLine(variant)}
                          className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-left text-sm hover:bg-neutral-50"
                        >
                          <div>
                            <div className="font-semibold">{variant.sku || "Không SKU"}</div>
                            <div className="text-xs text-neutral-500">
                              {variant.productName} · {variant.color || "—"} / {variant.size || "—"}
                            </div>
                          </div>
                          <div className="font-semibold">{money(variant.price)}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-neutral-500">Không có sản phẩm.</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                <div className="grid grid-cols-[1fr_110px_130px_40px] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500">
                  <div>Sản phẩm đổi</div>
                  <div>SL</div>
                  <div>Thành tiền</div>
                  <div />
                </div>

                {exchangeLines.length ? (
                  exchangeLines.map((line) => (
                    <div
                      key={line.id}
                      className="grid grid-cols-[1fr_110px_130px_40px] items-center border-t border-neutral-100 px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-neutral-900">{line.productName}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {line.sku || "—"} · {line.color || "—"} / {line.size || "—"} · {money(line.price)}
                        </div>
                      </div>

                      <input
                        value={line.qty}
                        onChange={(e) => updateExchangeQty(line.id, Number(e.target.value || 1))}
                        className="h-10 w-20 rounded-xl border border-neutral-200 px-3 text-center outline-none focus:border-neutral-900"
                      />

                      <div className="font-semibold">{money(line.price * line.qty)}</div>

                      <button
                        type="button"
                        onClick={() => removeExchangeLine(line.id)}
                        className="h-9 w-9 rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="border-t border-neutral-100 px-4 py-6 text-center text-sm text-neutral-400">
                    Chưa có sản phẩm đổi.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900">Thông tin phiếu trả</h2>

            <InfoLine label="Chi nhánh bán gốc" value={branchName(order.branchId)} />
            <InfoLine label="Nhân viên bán gốc" value={order.createdByStaffName || "—"} />
            <InfoLine label="Chi nhánh nhận trả" value={branchName(receiveBranchId)} />
            <InfoLine label="Kho xuất hàng đổi" value={branchName(exchangeIssueBranchId)} />

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
              Kho xuất sản phẩm đổi
            </label>
            <select
              value={exchangeIssueBranchId}
              onChange={(e) => setExchangeIssueBranchId(e.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            {refundAmount > 0 ? (
              <>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Nguồn tiền hoàn khách
                </label>
                <select
                  value={refundPaymentSourceId}
                  onChange={(e) => setRefundPaymentSourceId(e.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
                >
                  <option value="">Chọn nguồn tiền hoàn</option>
                  {refundPaymentSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}{source.type ? ` · ${source.type}` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {extraChargeAmount > 0 ? (
              <>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Nguồn tiền khách bù thêm
                </label>
                <select
                  value={extraChargePaymentSourceId}
                  onChange={(e) => setExtraChargePaymentSourceId(e.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
                >
                  <option value="">Chọn nguồn tiền thu thêm</option>
                  {extraChargePaymentSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}{source.type ? ` · ${source.type}` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {differenceAmount === 0 ? (
              <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
                Đổi ngang tiền, không phát sinh phiếu thu/chi.
              </div>
            ) : null}

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
                <span className="text-neutral-500">Tiền hàng trả</span>
                <strong>{money(returnTotal)}</strong>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-500">Tiền hàng đổi</span>
                <strong>{money(exchangeTotal)}</strong>
              </div>

              <div className="border-t border-neutral-100 pt-3" />

              <div className="flex justify-between text-base">
                <span className="font-semibold">
                  {differenceAmount > 0
                    ? "Shop hoàn khách"
                    : differenceAmount < 0
                      ? "Khách bù thêm"
                      : "Đổi ngang"}
                </span>
                <strong className="text-xl">
                  {differenceAmount === 0 ? "0đ" : money(Math.abs(differenceAmount))}
                </strong>
              </div>

              {differenceAmount > 0 ? (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                  Khi tạo phiếu, hệ thống sinh phiếu chi OUT từ nguồn tiền hoàn khách.
                </div>
              ) : null}

              {differenceAmount < 0 ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
                  Khi tạo phiếu, hệ thống sinh phiếu thu IN vào nguồn tiền khách bù thêm.
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit}
              className="mt-5 h-12 w-full rounded-2xl bg-neutral-950 font-bold text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              {saving ? "Đang lưu..." : "Tạo phiếu đổi/trả"}
            </button>

            {!canSubmit ? (
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Kiểm tra điều kiện đơn, chi nhánh nhận trả, sản phẩm và nguồn tiền tương ứng trước khi tạo.
              </p>
            ) : null}
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
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value || "—"}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex justify-between gap-3 text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-semibold text-neutral-900">{value || "—"}</span>
    </div>
  );
}
