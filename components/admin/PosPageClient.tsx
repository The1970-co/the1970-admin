"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createOrder,
  findCustomerByPhone,
  getProductsForOrder,
  type OrderProduct,
} from "@/lib/create-order-api";
import {
  getCurrentUserFromStorage,
  getUserBranchIds,
  isOwnerUser,
} from "@/lib/current-user";

type PosLine = {
  variantId: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
  price: number;
  stock: number;
  qty: number;
  imageUrl?: string;
};

type ReturnLine = {
  id: string;
  variantId?: string;
  sku?: string;
  productName?: string;
  color?: string;
  size?: string;
  price: number;
  orderedQty: number;
  returnQty: number;
};

type BranchOption = {
  value: string;
  label: string;
  code?: string;
  isActive?: boolean;
};

type OrderTab = {
  id: string;
  name: string;
};

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function moneyNumber(value: string | number) {
  return Number(String(value || "0").replace(/[^\d]/g, "") || 0);
}

function formatMoneyInput(value: string | number) {
  const n = moneyNumber(value);
  if (!n) return "";
  return new Intl.NumberFormat("vi-VN").format(n);
}

function normalize(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "${API_BASE}"
  ).replace(/\/$/, "");
}

function branchLabelFromAny(row: any) {
  return (
    row?.displayName ||
    row?.name ||
    row?.branchName ||
    row?.warehouseName ||
    row?.title ||
    row?.label ||
    row?.code ||
    "Chi nhánh"
  );
}

export default function PosPageClient() {
  const router = useRouter();

  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<PosLine[]>([]);
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);

  const [orderTabs, setOrderTabs] = useState<OrderTab[]>([
    { id: "1", name: "Đơn 1" },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");

  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [paymentSourceId, setPaymentSourceId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);

  const [paidAmount, setPaidAmount] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoType, setPromoType] = useState<"amount" | "percent">("amount");
  const [promoValue, setPromoValue] = useState("");

  const [cashVoucherOpen, setCashVoucherOpen] = useState(false);
  const [voucherType, setVoucherType] = useState<"income" | "expense">("income");
  const [voucherAmount, setVoucherAmount] = useState("");
  const [voucherReason, setVoucherReason] = useState("");

  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const [returnFormOpen, setReturnFormOpen] = useState(false);
  const [returnSearch, setReturnSearch] = useState("");
  const [returnOrders, setReturnOrders] = useState<any[]>([]);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<any | null>(null);
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [exchangeLines, setExchangeLines] = useState<PosLine[]>([]);
  const [returnNote, setReturnNote] = useState("");
  const [returnReceived, setReturnReceived] = useState(true);
  const [exchangeSearch, setExchangeSearch] = useState("");

  const currentUser =
    typeof window !== "undefined" ? getCurrentUserFromStorage() : null;
  const userBranchIds = currentUser ? getUserBranchIds(currentUser) : [];
  const canPickAll = isOwnerUser(currentUser);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    [lines]
  );

  const discountNumber = moneyNumber(discount);
  const mustPay = Math.max(0, subtotal - discountNumber);
  const paid = moneyNumber(paidAmount);
  const change = Math.max(0, paid - mustPay);

  const currentBranchLabel =
    branchOptions.find((item) => item.value === branchId)?.label || branchId;

  useEffect(() => {
    const run = async () => {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("token");

      const candidates = [
        `${apiBase}/branches`,
        `${apiBase}/settings/branches`,
        `${apiBase}/warehouses`,
        `${apiBase}/settings/warehouses`,
      ];

      let rows: any[] = [];

      for (const url of candidates) {
        try {
          const res = await fetch(url, {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
          });

          if (!res.ok) continue;

          const json = await res.json();
          const list = Array.isArray(json)
            ? json
            : Array.isArray(json?.items)
              ? json.items
              : Array.isArray(json?.data)
                ? json.data
                : [];

          if (list.length) {
            rows = list;
            break;
          }
        } catch {
          continue;
        }
      }

      const mapped: BranchOption[] = rows
        .map((row: any) => ({
          value: String(
            row?.id ?? row?.branchId ?? row?.warehouseId ?? row?.code ?? ""
          ),
          label: branchLabelFromAny(row),
          code: row?.code ? String(row.code) : undefined,
          isActive: row?.isActive !== false,
        }))
        .filter((item) => item.value && item.isActive !== false);

      const filtered = canPickAll
        ? mapped
        : mapped.filter(
          (item) =>
            userBranchIds.includes(item.value) ||
            (item.code && userBranchIds.includes(item.code))
        );

      setBranchOptions(filtered);

      setBranchId((prev) => {
        if (prev && filtered.some((item) => item.value === prev)) return prev;
        return filtered[0]?.value || "";
      });
    };

    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await getProductsForOrder();
        setProducts(data);
      } catch {
        setError("Không tải được sản phẩm.");
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("token");

      const res = await fetch(`${apiBase}/payment-sources`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      if (!res.ok) return;

      const json = await res.json();
      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.items)
          ? json.items
          : [];

      setPaymentSources(rows);
    };

    void run();
  }, []);

  const visiblePaymentSources = useMemo(() => {
    return paymentSources.filter((s) => {
      if (s.isActive === false) return false;

      const sourceBranch =
        s.branchId ||
        s.branch?.id ||
        s.branchCode ||
        s.branch?.code ||
        s.branchName ||
        s.branch?.name ||
        s.warehouseId ||
        s.storeId ||
        s.branch ||
        "";

      if (
        !sourceBranch ||
        normalize(sourceBranch) === "tat ca" ||
        normalize(sourceBranch) === "all" ||
        normalize(sourceBranch) === "all branches"
      ) {
        return true;
      }

      return (
        String(sourceBranch) === String(branchId) ||
        normalize(sourceBranch) === normalize(currentBranchLabel)
      );
    });
  }, [paymentSources, branchId, currentBranchLabel]);

  useEffect(() => {
    const first = visiblePaymentSources[0];

    if (!paymentSourceId && first?.id) {
      setPaymentSourceId(String(first.id));
      return;
    }

    const stillValid = visiblePaymentSources.some(
      (s) => String(s.id) === String(paymentSourceId)
    );

    if (paymentSourceId && !stillValid) {
      setPaymentSourceId(first?.id ? String(first.id) : "");
    }
  }, [visiblePaymentSources, paymentSourceId]);

  useEffect(() => {
    setPaidAmount(String(mustPay));
  }, [mustPay]);

  const allVariants = useMemo(() => {
    return products.flatMap((product) =>
      product.variants
        .map((variant: any) => {
          const branchStocks: Record<string, number> = variant.branchStocks || {};
          const stock = canPickAll
            ? Object.values(branchStocks).reduce((a, b) => a + Number(b || 0), 0)
            : Number(branchStocks[branchId] || 0);

          return {
            ...variant,
            productName: product.name,
            productCode:
              (product as any).sku ||
              (product as any).code ||
              (product as any).slug ||
              "",
            imageUrl: (product as any).imageUrl,
            stock,
          };
        })
        .filter((v: any) => Number(v.stock || 0) > 0)
    );
  }, [products, branchId, canPickAll]);

  const filteredVariants = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];

    return allVariants
      .filter((v: any) => {
        return (
          String(v.sku || "").toLowerCase().includes(q) ||
          String(v.productCode || "").toLowerCase().includes(q) ||
          String(v.productName || "").toLowerCase().includes(q) ||
          String(v.color || "").toLowerCase().includes(q) ||
          String(v.size || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [allVariants, productSearch]);

  const exchangeFilteredVariants = useMemo(() => {
    const q = exchangeSearch.trim().toLowerCase();
    if (!q) return [];

    return allVariants
      .filter((v: any) => {
        return (
          String(v.sku || "").toLowerCase().includes(q) ||
          String(v.productName || "").toLowerCase().includes(q) ||
          String(v.color || "").toLowerCase().includes(q) ||
          String(v.size || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [allVariants, exchangeSearch]);

  const addVariant = (variant: any) => {
    setLines((prev) => {
      const existed = prev.find((line) => line.variantId === variant.id);

      if (existed) {
        return prev.map((line) =>
          line.variantId === variant.id
            ? { ...line, qty: Math.min(line.qty + 1, line.stock) }
            : line
        );
      }

      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          color: variant.color,
          size: variant.size,
          price: Number(variant.price || 0),
          stock: Number(variant.stock || 0),
          qty: 1,
          imageUrl: variant.imageUrl,
        },
      ];
    });

    setProductSearch("");
    setError("");
  };

  const addExchangeVariant = (variant: any) => {
    setExchangeLines((prev) => {
      const existed = prev.find((line) => line.variantId === variant.id);

      if (existed) {
        return prev.map((line) =>
          line.variantId === variant.id
            ? { ...line, qty: Math.min(line.qty + 1, line.stock) }
            : line
        );
      }

      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          color: variant.color,
          size: variant.size,
          price: Number(variant.price || 0),
          stock: Number(variant.stock || 0),
          qty: 1,
          imageUrl: variant.imageUrl,
        },
      ];
    });

    setExchangeSearch("");
  };

  const updateQty = (variantId: string, qty: number) => {
    setLines((prev) =>
      prev.map((line) =>
        line.variantId === variantId
          ? { ...line, qty: Math.max(1, Math.min(qty, line.stock || 1)) }
          : line
      )
    );
  };

  const updateExchangeQty = (variantId: string, qty: number) => {
    setExchangeLines((prev) =>
      prev.map((line) =>
        line.variantId === variantId
          ? { ...line, qty: Math.max(1, Math.min(qty, line.stock || 1)) }
          : line
      )
    );
  };

  const removeLine = (variantId: string) => {
    setLines((prev) => prev.filter((line) => line.variantId !== variantId));
  };

  const removeExchangeLine = (variantId: string) => {
    setExchangeLines((prev) => prev.filter((line) => line.variantId !== variantId));
  };

  const clearOrder = () => {
    setLines([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerSuggestions([]);
    setPaidAmount("0");
    setDiscount("0");
    setNote("");
    setError("");
  };

  const createNewTab = () => {
    clearOrder();

    const nextNumber = orderTabs.length + 1;
    const next = {
      id: String(Date.now()),
      name: `Đơn ${nextNumber}`,
    };

    setOrderTabs((prev) => [...prev, next]);
    setActiveTabId(next.id);
  };

  const handleCustomerPhoneChange = async (value: string) => {
    setCustomerPhone(value);

    const phone = value.replace(/\D/g, "");
    if (phone.length < 3) {
      setCustomerSuggestions([]);
      return;
    }

    try {
      setCustomerSearching(true);
      const result: any = await findCustomerByPhone(phone);

      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.data)
            ? result.data
            : result
              ? [result]
              : [];

      setCustomerSuggestions(rows.slice(0, 8));
    } finally {
      setCustomerSearching(false);
    }
  };

  const searchReturnOrders = async () => {
    if (!returnSearch.trim()) return;

    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${apiBase}/orders?search=${encodeURIComponent(returnSearch)}&limit=20`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      setError("Không tải được danh sách đơn.");
      return;
    }

    const json = await res.json();
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data)
          ? json.data
          : [];

    setReturnOrders(rows);
  };

  const pickReturnOrder = async (order: any) => {
    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem("token");

    const res = await fetch(`${apiBase}/orders/${order.id}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    const detail = res.ok ? await res.json() : order;
    const items = detail.items || detail.orderItems || detail.lines || [];

    setSelectedReturnOrder(detail);
    setReturnLines(
      items.map((item: any) => ({
        id: item.id || item.variantId || item.variant?.id,
        variantId: item.variantId || item.variant?.id,
        sku: item.sku || item.variant?.sku,
        productName: item.productName || item.product?.name || item.name,
        color: item.color || item.variant?.color,
        size: item.size || item.variant?.size,
        price: Number(item.price || item.unitPrice || item.salePrice || 0),
        orderedQty: Number(item.qty || item.quantity || 1),
        returnQty: 0,
      }))
    );

    setExchangeLines([]);
    setReturnPickerOpen(false);
    setReturnFormOpen(true);
  };

  const quickAmounts = useMemo(() => {
    const base = mustPay;
    const roundUp = Math.ceil(base / 100000) * 100000;
    return Array.from(new Set([base, roundUp, 500000, 1000000, 2000000])).filter(
      (n) => n > 0
    );
  }, [mustPay]);

  const quickActions = [
    { label: "Thêm dịch vụ", action: () => setError("Tính năng thêm dịch vụ sẽ làm sau.") },
    { label: "Chiết khấu đơn", action: () => setPromoOpen(true) },
    { label: "Khuyến mãi", action: () => setPromoOpen(true) },
    { label: "Đổi quà", action: () => setError("Tính năng đổi quà sẽ làm sau.") },
    { label: "Đổi giá bán hàng", action: () => setError("Đổi giá cần phân quyền riêng.") },
    { label: "Phiếu thu/chi", action: () => setCashVoucherOpen(true) },
    { label: "Thông tin khách hàng", action: () => setError("Nhập SĐT để tìm khách hàng.") },
    { label: "Xoá toàn bộ", action: clearOrder },
    {
      label: "Đổi trả hàng",
      action: () => {
        setReturnSearch("");
        setReturnOrders([]);
        setReturnPickerOpen(true);
      },
    },
    { label: "Xem danh sách đơn", action: () => router.push("/orders") },
    { label: "Tất cả thao tác", action: () => setError("Menu thao tác nâng cao sẽ làm sau.") },
  ];

  const handlePay = async () => {
    if (!branchId) {
      setError("Chưa có chi nhánh.");
      return;
    }

    if (!lines.length) {
      setError("Chưa có sản phẩm trong đơn.");
      return;
    }

    if (!paymentSourceId) {
      setError("Chưa chọn nguồn tiền.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const created = await createOrder({
        salesChannel: "SHOWROOM" as any,
        branchId,
        customerName: customerName.trim() || "Khách lẻ",
        customerPhone: customerPhone.trim() || "",
        note: [
          "Đơn POS bán tại quầy",
          note.trim() ? `Ghi chú: ${note.trim()}` : "",
          discountNumber ? `Giảm giá POS: ${discountNumber}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
        mode: "approve" as any,
        paymentSourceId,
        paidAmount: paid,
        paymentNote: "Thanh toán POS",
        items: lines.map((line) => ({
          variantId: line.variantId,
          qty: Number(line.qty),
        })),
      } as any);

      router.push(`/orders/${encodeURIComponent(created.id)}?created=1&pos=1`);
    } catch (err: any) {
      setError(err?.message || "Thanh toán thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-72px)] overflow-hidden bg-[#f5f5f3]">
      <div className="grid h-full grid-cols-[1fr_360px] overflow-hidden">
        <main className="flex min-w-0 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-neutral-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredVariants[0]) {
                      addVariant(filteredVariants[0]);
                    }
                  }}
                  placeholder="Thêm sản phẩm vào đơn / quét SKU..."
                  className="h-10 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 outline-none focus:border-black"
                  autoFocus
                />

                {filteredVariants.length ? (
                  <div className="absolute left-0 right-0 top-12 z-30 max-h-96 overflow-auto rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl">
                    {filteredVariants.map((variant: any) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => addVariant(variant)}
                        className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50"
                      >
                        <div>
                          <div className="font-semibold">{variant.sku}</div>
                          <div className="text-sm text-neutral-500">
                            {variant.productName} · {variant.color} / {variant.size}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{currency(variant.price)}</div>
                          <div className="text-xs text-neutral-500">
                            Tồn {variant.stock}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {canPickAll ? (
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-10 rounded-2xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900"
                >
                  {branchOptions.map((branch) => (
                    <option key={branch.value} value={branch.value}>
                      {branch.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold">
                  {currentBranchLabel}
                </div>
              )}

              <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">
                {orderTabs.find((tab) => tab.id === activeTabId)?.name || "Đơn 1"}
              </div>

              <button
                type="button"
                onClick={createNewTab}
                className="h-10 w-10 rounded-2xl bg-neutral-950 text-xl font-semibold text-white"
              >
                +
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <div className="grid grid-cols-[48px_64px_120px_1fr_100px_110px_120px_40px] border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <div>STT</div>
              <div>Ảnh</div>
              <div>Mã SKU</div>
              <div>Tên sản phẩm</div>
              <div>SL</div>
              <div>Đơn giá</div>
              <div>Thành tiền</div>
              <div />
            </div>

            {!lines.length ? (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-neutral-400">
                Đơn hàng của bạn chưa có sản phẩm nào
              </div>
            ) : (
              lines.map((line, index) => (
                <div
                  key={line.variantId}
                  className="grid grid-cols-[48px_64px_120px_1fr_100px_110px_120px_40px] items-center border-b border-neutral-100 px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  <div className="text-neutral-500">{index + 1}</div>

                  <div>
                    {line.imageUrl ? (
                      <img
                        src={line.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-neutral-100" />
                    )}
                  </div>

                  <div className="font-semibold">{line.sku}</div>

                  <div>
                    <div className="font-medium">{line.productName}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {line.color || "—"} / {line.size || "—"} · Tồn {line.stock}
                    </div>
                  </div>

                  <div className="flex h-9 w-[90px] items-center rounded-xl border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => updateQty(line.variantId, line.qty - 1)}
                      className="h-9 w-7 text-neutral-500"
                    >
                      -
                    </button>
                    <input
                      value={line.qty}
                      onChange={(e) =>
                        updateQty(line.variantId, Number(e.target.value || 1))
                      }
                      className="h-9 w-8 text-center outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(line.variantId, line.qty + 1)}
                      className="h-9 w-7 text-neutral-500"
                    >
                      +
                    </button>
                  </div>

                  <div>{currency(line.price)}</div>

                  <div className="font-semibold">
                    {currency(line.price * line.qty)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(line.variantId)}
                    className="h-8 w-8 rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 border-t border-neutral-200 bg-white p-2">
            <div className="grid grid-cols-6 gap-2">
              {quickActions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="h-9 rounded-2xl bg-neutral-100 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="h-full overflow-hidden border-l border-neutral-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Thanh toán POS</div>
              <div className="mt-1 text-xs text-neutral-500">
                Kênh bán: POS tại quầy
              </div>
            </div>

            <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
              F1
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <input
                value={customerPhone}
                onChange={(e) => void handleCustomerPhoneChange(e.target.value)}
                placeholder="SĐT khách hàng (F4)"
                className="h-10 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-black"
              />

              {customerSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
                  {customerSuggestions.map((customer) => (
                    <button
                      key={customer.id || customer.phone}
                      type="button"
                      onClick={() => {
                        setCustomerName(customer.fullName || customer.name || "");
                        setCustomerPhone(customer.phone || "");
                        setCustomerSuggestions([]);
                      }}
                      className="block w-full border-b border-neutral-100 px-4 py-3 text-left text-sm hover:bg-neutral-50"
                    >
                      <div className="font-semibold">
                        {customer.fullName || customer.name || "Khách hàng"}
                      </div>
                      <div className="text-xs text-neutral-500">{customer.phone}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={customerSearching ? "Đang tìm khách..." : "Tên khách hàng"}
              className="h-10 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-black"
            />

            <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-500">
              <input type="checkbox" disabled />
              Giao hàng
              <span className="ml-auto text-xs text-neutral-400">Tắt trong POS</span>
            </label>
          </div>

          <div className="my-3 border-t border-neutral-100" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tổng tiền ({lines.length} SP)</span>
              <strong>{currency(subtotal)}</strong>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Chiết khấu</span>
              <input
                value={formatMoneyInput(discount)}
                onChange={(e) => setDiscount(String(moneyNumber(e.target.value)))}
                className="h-9 w-32 rounded-xl border border-neutral-200 px-3 text-right outline-none"
              />
            </div>

            <div className="border-t border-neutral-100 pt-2" />

            <div className="flex justify-between text-base">
              <span className="font-semibold">Khách phải trả</span>
              <strong className="text-xl">{currency(mustPay)}</strong>
            </div>
          </div>

          <div className="my-3 border-t border-neutral-100" />

          <label className="text-sm font-semibold">Nguồn tiền</label>
          <select
            value={paymentSourceId}
            onChange={(e) => setPaymentSourceId(e.target.value)}
            className="mt-2 h-10 w-full rounded-2xl border border-neutral-200 px-4 text-sm outline-none"
          >
            <option value="">Chọn nguồn tiền</option>
            {visiblePaymentSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name || source.label || source.displayName || source.code}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-sm font-semibold">Khách đưa</label>
          <input
            value={formatMoneyInput(paidAmount)}
            onChange={(e) => setPaidAmount(String(moneyNumber(e.target.value)))}
            className="mt-2 h-11 w-full rounded-2xl border border-neutral-200 px-4 text-right text-lg font-semibold outline-none"
          />

          <div className="mt-2 grid grid-cols-3 gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setPaidAmount(String(amount))}
                className="rounded-xl bg-neutral-100 px-2 py-2 text-xs font-medium hover:bg-neutral-200"
              >
                {currency(amount).replace("đ", "")}
              </button>
            ))}
          </div>

          <div className="mt-3 flex justify-between text-sm">
            <span>Tiền thừa trả khách</span>
            <strong>{currency(change)}</strong>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú đơn hàng"
            className="mt-3 min-h-[58px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none"
          />

          {error ? (
            <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handlePay}
            disabled={saving || !lines.length}
            className="mt-3 h-12 w-full rounded-2xl bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-neutral-300"
          >
            {saving ? "ĐANG LƯU..." : "THANH TOÁN (F1)"}
          </button>

          <button
            type="button"
            onClick={clearOrder}
            className="mt-2 h-10 w-full rounded-2xl border border-neutral-200 text-sm font-medium"
          >
            Reset
          </button>
        </aside>
      </div>

      {promoOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Khuyến mãi / chiết khấu</h3>
              <button onClick={() => setPromoOpen(false)}>×</button>
            </div>

            <select
              value={promoType}
              onChange={(e) => setPromoType(e.target.value as any)}
              className="h-11 w-full rounded-2xl border px-4"
            >
              <option value="amount">Giảm số tiền</option>
              <option value="percent">Giảm %</option>
            </select>

            <input
              value={formatMoneyInput(promoValue)}
              onChange={(e) => setPromoValue(String(moneyNumber(e.target.value)))}
              placeholder="Nhập giá trị"
              className="mt-3 h-11 w-full rounded-2xl border px-4"
            />

            <button
              onClick={() => {
                const value = moneyNumber(promoValue);
                const nextDiscount =
                  promoType === "percent" ? Math.floor((subtotal * value) / 100) : value;

                setDiscount(String(nextDiscount));
                setNote((prev) =>
                  [
                    prev,
                    `Khuyến mãi POS: ${promoType === "percent" ? `${value}%` : currency(value)
                    }`,
                  ]
                    .filter(Boolean)
                    .join(" | ")
                );
                setPromoOpen(false);
              }}
              className="mt-4 h-11 w-full rounded-2xl bg-black text-white"
            >
              Áp dụng
            </button>
          </div>
        </div>
      ) : null}

      {cashVoucherOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Phiếu thu / chi</h3>
              <button onClick={() => setCashVoucherOpen(false)}>×</button>
            </div>

            <select
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value as any)}
              className="h-11 w-full rounded-2xl border px-4"
            >
              <option value="income">Phiếu thu</option>
              <option value="expense">Phiếu chi</option>
            </select>

            <input
              value={formatMoneyInput(voucherAmount)}
              onChange={(e) => setVoucherAmount(String(moneyNumber(e.target.value)))}
              placeholder="Số tiền"
              className="mt-3 h-11 w-full rounded-2xl border px-4"
            />

            <textarea
              value={voucherReason}
              onChange={(e) => setVoucherReason(e.target.value)}
              placeholder="Lý do"
              className="mt-3 min-h-[90px] w-full rounded-2xl border px-4 py-3"
            />

            <button
              onClick={() => {
                setNote((prev) =>
                  [
                    prev,
                    `${voucherType === "income" ? "Phiếu thu" : "Phiếu chi"} POS: ${currency(
                      moneyNumber(voucherAmount)
                    )} - ${voucherReason || "không có lý do"}`,
                  ]
                    .filter(Boolean)
                    .join(" | ")
                );
                setCashVoucherOpen(false);
              }}
              className="mt-4 h-11 w-full rounded-2xl bg-black text-white"
            >
              Lưu tạm vào ghi chú
            </button>
          </div>
        </div>
      ) : null}

      {returnPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Chọn đơn đổi trả</h3>
              <button onClick={() => setReturnPickerOpen(false)}>×</button>
            </div>

            <div className="flex gap-3">
              <input
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void searchReturnOrders();
                }}
                placeholder="Nhập mã đơn / SĐT / tên khách..."
                className="h-11 flex-1 rounded-2xl border border-neutral-200 px-4 outline-none"
              />

              <button
                disabled={!returnSearch.trim()}
                onClick={searchReturnOrders}
                className={`h-11 rounded-2xl px-5 font-semibold ${returnSearch.trim()
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-200 text-neutral-400"
                  }`}
              >
                Tìm kiếm
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
              <div className="grid grid-cols-[140px_140px_1fr_140px_110px] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500">
                <div>Mã đơn</div>
                <div>Ngày tạo</div>
                <div>Khách hàng</div>
                <div>Tổng tiền</div>
                <div />
              </div>

              {returnOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[140px_140px_1fr_140px_110px] items-center border-t border-neutral-100 px-4 py-3 text-sm"
                >
                  <div className="font-semibold">
                    {order.orderCode || order.code || order.id}
                  </div>
                  <div>{String(order.createdAt || "").slice(0, 10)}</div>
                  <div>{order.customerName || order.customer?.fullName || "Khách lẻ"}</div>
                  <div>{currency(order.total || order.totalAmount || order.grandTotal || 0)}</div>
                  <button
                    onClick={() => void pickReturnOrder(order)}
                    className="rounded-xl border border-blue-500 px-3 py-2 text-sm font-semibold text-blue-600"
                  >
                    Chọn đơn
                  </button>
                </div>
              ))}

              {!returnOrders.length ? (
                <div className="px-4 py-10 text-center text-sm text-neutral-400">
                  Nhập thông tin để tìm đơn đổi trả
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {returnFormOpen && selectedReturnOrder ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/35 p-4">
          <div className="mx-auto w-full max-w-6xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Tạo phiếu đổi trả hàng</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Đơn gốc: {selectedReturnOrder.orderCode || selectedReturnOrder.code}
                </p>
              </div>
              <button onClick={() => setReturnFormOpen(false)}>×</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-neutral-200 p-4">
                  <h4 className="font-semibold">Sản phẩm trả</h4>

                  <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200">
                    <div className="grid grid-cols-[1fr_100px_120px_120px] bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500">
                      <div>Sản phẩm</div>
                      <div>Đã mua</div>
                      <div>SL trả</div>
                      <div>Tiền trả</div>
                    </div>

                    {returnLines.map((line) => (
                      <div
                        key={line.id}
                        className="grid grid-cols-[1fr_100px_120px_120px] items-center border-t border-neutral-100 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">{line.productName}</div>
                          <div className="text-xs text-neutral-500">
                            {line.sku} · {line.color} / {line.size}
                          </div>
                        </div>
                        <div>{line.orderedQty}</div>
                        <input
                          value={line.returnQty}
                          onChange={(e) => {
                            const qty = Math.max(
                              0,
                              Math.min(Number(e.target.value || 0), line.orderedQty)
                            );
                            setReturnLines((prev) =>
                              prev.map((x) =>
                                x.id === line.id ? { ...x, returnQty: qty } : x
                              )
                            );
                          }}
                          className="h-10 w-20 rounded-xl border border-neutral-200 px-3 text-center"
                        />
                        <div className="font-semibold">
                          {currency(line.price * line.returnQty)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-neutral-200 p-4">
                  <h4 className="font-semibold">Sản phẩm đổi</h4>

                  <div className="relative mt-3">
                    <input
                      value={exchangeSearch}
                      onChange={(e) => setExchangeSearch(e.target.value)}
                      placeholder="Tìm sản phẩm đổi / quét SKU..."
                      className="h-11 w-full rounded-2xl border border-neutral-200 px-4 outline-none"
                    />

                    {exchangeFilteredVariants.length > 0 ? (
                      <div className="absolute left-0 right-0 top-12 z-30 max-h-60 overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-xl">
                        {exchangeFilteredVariants.map((variant: any) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => addExchangeVariant(variant)}
                            className="flex w-full justify-between border-b px-4 py-3 text-left text-sm hover:bg-neutral-50"
                          >
                            <div>
                              <div className="font-semibold">{variant.sku}</div>
                              <div className="text-neutral-500">
                                {variant.productName} · {variant.color} / {variant.size}
                              </div>
                            </div>
                            <div className="font-semibold">{currency(variant.price)}</div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {exchangeLines.map((line) => (
                      <div
                        key={line.variantId}
                        className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">{line.productName}</div>
                          <div className="text-xs text-neutral-500">
                            {line.sku} · {line.color} / {line.size}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-[90px] items-center rounded-xl border border-neutral-200">
                            <button
                              type="button"
                              onClick={() => updateExchangeQty(line.variantId, line.qty - 1)}
                              className="h-9 w-7"
                            >
                              -
                            </button>
                            <input
                              value={line.qty}
                              onChange={(e) =>
                                updateExchangeQty(line.variantId, Number(e.target.value || 1))
                              }
                              className="h-9 w-8 text-center outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateExchangeQty(line.variantId, line.qty + 1)}
                              className="h-9 w-7"
                            >
                              +
                            </button>
                          </div>

                          <div className="w-24 text-right font-semibold">
                            {currency(line.price * line.qty)}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeExchangeLine(line.variantId)}
                            className="text-neutral-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-neutral-200 p-4">
                  <h4 className="font-semibold">Nhận hàng trả lại</h4>
                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() => setReturnReceived(true)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${returnReceived
                        ? "border-blue-600 text-blue-600"
                        : "border-neutral-200"
                        }`}
                    >
                      Đã nhận và nhập kho
                    </button>
                    <button
                      onClick={() => setReturnReceived(false)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${!returnReceived
                        ? "border-blue-600 text-blue-600"
                        : "border-neutral-200"
                        }`}
                    >
                      Chưa nhận hàng
                    </button>
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-neutral-200 p-4">
                <h4 className="font-semibold">Hoàn tiền / bù tiền</h4>

                {(() => {
                  const returnTotal = returnLines.reduce(
                    (sum, line) => sum + line.price * line.returnQty,
                    0
                  );
                  const exchangeTotal = exchangeLines.reduce(
                    (sum, line) => sum + line.price * line.qty,
                    0
                  );
                  const diff = returnTotal - exchangeTotal;

                  return (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Tiền hàng trả</span>
                        <strong>{currency(returnTotal)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Tiền hàng đổi</span>
                        <strong>{currency(exchangeTotal)}</strong>
                      </div>
                      <div className="border-t pt-3" />
                      <div className="flex justify-between text-base">
                        <span className="font-semibold">
                          {diff >= 0 ? "Cần hoàn khách" : "Khách trả thêm"}
                        </span>
                        <strong>{currency(Math.abs(diff))}</strong>
                      </div>
                    </div>
                  );
                })()}

                <textarea
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Ghi chú đổi trả"
                  className="mt-5 min-h-[90px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                />

                <button
                  onClick={() => {
                    const returnTotal = returnLines.reduce(
                      (sum, line) => sum + line.price * line.returnQty,
                      0
                    );
                    const exchangeTotal = exchangeLines.reduce(
                      (sum, line) => sum + line.price * line.qty,
                      0
                    );
                    const diff = returnTotal - exchangeTotal;

                    setNote((prev) =>
                      [
                        prev,
                        `Đổi trả đơn ${selectedReturnOrder.orderCode || selectedReturnOrder.code
                        }`,
                        returnReceived ? "Đã nhận hàng trả" : "Chưa nhận hàng trả",
                        `Tiền hàng trả: ${currency(returnTotal)}`,
                        `Tiền hàng đổi: ${currency(exchangeTotal)}`,
                        diff >= 0
                          ? `Cần hoàn khách: ${currency(diff)}`
                          : `Khách trả thêm: ${currency(Math.abs(diff))}`,
                        returnNote ? `Ghi chú: ${returnNote}` : "",
                      ]
                        .filter(Boolean)
                        .join(" | ")
                    );

                    setLines(exchangeLines);

                    if (diff > 0) {
                      setDiscount(String(Math.min(diff, exchangeTotal)));
                    } else {
                      setDiscount("0");
                    }

                    setReturnFormOpen(false);
                  }}
                  className="mt-5 h-12 w-full rounded-2xl bg-blue-600 font-semibold text-white"
                >
                  Áp dụng phiếu đổi trả
                </button>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}