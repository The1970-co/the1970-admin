"use client";

import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
  productId?: string | null;
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

type PaymentRow = {
  id: string;
  paymentSourceId: string;
  amount: string;
};

type BranchOption = {
  value: string;
  label: string;
  code?: string;
  isActive?: boolean;
};


type PromotionRow = {
  id: string;
  name: string;
  type: "PRODUCT_DISCOUNT" | "ORDER_DISCOUNT";
  status: "ACTIVE" | "INACTIVE";
  discountType: "PERCENT" | "FIXED_AMOUNT";
  discountValue: string | number;
  minOrderAmount?: string | number | null;
  branchId?: string | null;
  salesChannel?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  products?: Array<{ productId?: string | null; product?: { id?: string | null } | null }>;
  priority?: number | string | null;
};

function isPromotionActiveForContext(
  promotion: PromotionRow,
  input: { branchId?: string | null; salesChannel?: string | null }
) {
  if (promotion.status !== "ACTIVE") return false;

  const now = Date.now();
  if (promotion.startAt && new Date(promotion.startAt).getTime() > now) return false;
  if (promotion.endAt && new Date(promotion.endAt).getTime() < now) return false;

  if (promotion.branchId && input.branchId && String(promotion.branchId) !== String(input.branchId)) return false;
  if (promotion.branchId && !input.branchId) return false;

  if (
    promotion.salesChannel &&
    input.salesChannel &&
    String(promotion.salesChannel).toUpperCase() !== String(input.salesChannel).toUpperCase()
  ) {
    return false;
  }
  if (promotion.salesChannel && !input.salesChannel) return false;

  return true;
}

function calculatePromotionDiscount(input: {
  promotions: PromotionRow[];
  lines: Array<{ productId?: string | null; price: number; qty: number }>;
  branchId?: string | null;
  salesChannel?: string | null;
}) {
  const subtotal = input.lines.reduce(
    (sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0),
    0
  );

  const workingLines = input.lines.map((line) => ({
    ...line,
    discountAmount: 0,
  }));

  let productDiscount = 0;
  let orderDiscount = 0;
  const appliedNames: string[] = [];
  const discountedProductIds = new Set<string>();
  const breakdown: Array<{
    id: string;
    name: string;
    type: "PRODUCT_DISCOUNT" | "ORDER_DISCOUNT";
    discountAmount: number;
  }> = [];

  const activePromotions = input.promotions
    .filter((promotion) => isPromotionActiveForContext(promotion, input))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  for (const promotion of activePromotions) {
    if (promotion.type === "PRODUCT_DISCOUNT") {
      const productIds = new Set(
        (promotion.products || [])
          .map((row) => String(row.productId || row.product?.id || ""))
          .filter(Boolean)
      );

      let discountForPromotion = 0;

      for (const line of workingLines) {
        if (!line.productId || !productIds.has(String(line.productId))) continue;

        const qty = Math.max(1, Number(line.qty || 0));
        const alreadyDiscountedPerUnit = Number(line.discountAmount || 0) / qty;
        const base = Math.max(0, Number(line.price || 0) - alreadyDiscountedPerUnit);
        const discountPerUnit =
          promotion.discountType === "PERCENT"
            ? (base * Number(promotion.discountValue || 0)) / 100
            : Number(promotion.discountValue || 0);

        const safeDiscount = Math.min(base, Math.max(0, discountPerUnit)) * qty;
        line.discountAmount += safeDiscount;
        discountForPromotion += safeDiscount;
        discountedProductIds.add(String(line.productId));
      }

      if (discountForPromotion > 0) {
        productDiscount += discountForPromotion;
        appliedNames.push(promotion.name);
        breakdown.push({
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          discountAmount: discountForPromotion,
        });
      }
    }

    if (promotion.type === "ORDER_DISCOUNT") {
      const minOrderAmount = Number(promotion.minOrderAmount || 0);
      if (subtotal < minOrderAmount) continue;

      const orderBase = Math.max(0, subtotal - productDiscount - orderDiscount);
      const discount =
        promotion.discountType === "PERCENT"
          ? (orderBase * Number(promotion.discountValue || 0)) / 100
          : Number(promotion.discountValue || 0);

      const safeDiscount = Math.min(orderBase, Math.max(0, discount));
      if (safeDiscount > 0) {
        orderDiscount += safeDiscount;
        appliedNames.push(promotion.name);
        breakdown.push({
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          discountAmount: safeDiscount,
        });
      }
    }
  }

  return {
    productDiscount,
    orderDiscount,
    totalDiscount: productDiscount + orderDiscount,
    appliedNames: Array.from(new Set(appliedNames)),
    discountedProductIds: Array.from(discountedProductIds),
    breakdown,
  };
}

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
    API_BASE
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
  const searchRef = useRef<HTMLInputElement | null>(null);
  const customerSearchVersionRef = useRef(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<PosLine[]>([]);
  const [branchId, setBranchId] = useState("");
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);

  const [orderTabs, setOrderTabs] = useState<OrderTab[]>([
    { id: "1", name: "Đơn 1" },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");

  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: "pay-1", paymentSourceId: "", amount: "0" },
  ]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);

  const [paidAmount, setPaidAmount] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
  const promotionPreview = useMemo(
    () =>
      calculatePromotionDiscount({
        promotions,
        lines,
        branchId,
        salesChannel: "POS",
      }),
    [promotions, lines, branchId]
  );
  const autoPromotionDiscount = promotionPreview.totalDiscount;
  const discountedProductIdSet = useMemo(
    () => new Set(promotionPreview.discountedProductIds || []),
    [promotionPreview.discountedProductIds]
  );
  const totalDiscountNumber = discountNumber + autoPromotionDiscount;
  const mustPay = Math.max(0, subtotal - totalDiscountNumber);
  const totalPaid = useMemo(
    () => paymentRows.reduce((sum, row) => sum + moneyNumber(row.amount), 0),
    [paymentRows]
  );
  const change = Math.max(0, totalPaid - mustPay);

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
      try {
        const apiBase = getApiBaseUrl();
        const token = localStorage.getItem("token");
        const res = await fetch(`${apiBase}/promotions`, {
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
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.items)
              ? json.items
              : [];

        setPromotions(rows);
      } catch {
        setPromotions([]);
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

    setPaymentRows((prev) => {
      const rows = prev.length
        ? prev
        : [{ id: `pay-${Date.now()}`, paymentSourceId: "", amount: "0" }];

      return rows.map((row, index) => {
        const stillValid = visiblePaymentSources.some(
          (source) => String(source.id) === String(row.paymentSourceId)
        );

        if (row.paymentSourceId && stillValid) return row;

        return {
          ...row,
          paymentSourceId: index === 0 && first?.id ? String(first.id) : "",
        };
      });
    });
  }, [visiblePaymentSources]);

  useEffect(() => {
    setPaidAmount(String(mustPay));
    setPaymentRows((prev) => {
      if (prev.length !== 1) return prev;
      return [{ ...prev[0], amount: String(mustPay) }];
    });
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
            productId: (product as any).id,
            productName: product.name,
            productCode:
              variant.productCode ||
              (product as any).sku ||
              (product as any).code ||
              (product as any).productCode ||
              (product as any).mainSku ||
              product.slug ||
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
          String(v.productCode || "").toLowerCase().includes(q) ||
          String(v.productName || "").toLowerCase().includes(q) ||
          String(v.color || "").toLowerCase().includes(q) ||
          String(v.size || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [allVariants, exchangeSearch]);

  const playScanSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.08);
    } catch { }
  };

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
          productId: variant.productId || variant.product?.id || null,
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
    setHighlightId(variant.id);
    playScanSound();

    setTimeout(() => setHighlightId(null), 650);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  useEffect(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return;
    if (filteredVariants.length !== 1) return;

    const variant = filteredVariants[0];
    const isExact =
      String(variant.sku || "").toLowerCase() === q ||
      String(variant.productCode || "").toLowerCase() === q;

    if (isExact) addVariant(variant);
  }, [filteredVariants, productSearch]);

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
          productId: variant.productId || variant.product?.id || null,
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
    setPaymentRows([{ id: "pay-1", paymentSourceId: visiblePaymentSources[0]?.id ? String(visiblePaymentSources[0].id) : "", amount: "0" }]);
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
  const version = ++customerSearchVersionRef.current;
  setCustomerPhone(value);

  const phone = value.replace(/\D/g, "");
  if (phone.length < 3) {
    setCustomerSuggestions([]);
    return;
  }

  try {
    setCustomerSearching(true);
    const result: any = await findCustomerByPhone(phone);

    if (version !== customerSearchVersionRef.current) return;

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
    if (version === customerSearchVersionRef.current) {
      setCustomerSearching(false);
    }
  }
};

  const searchReturnOrders = async () => {
    if (!returnSearch.trim()) return;

    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${apiBase}/orders?search=${encodeURIComponent(returnSearch)}&limit=20&status=COMPLETED`,
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

    const rawDetail = res.ok ? await res.json() : order;
    const detail = rawDetail?.data || rawDetail?.order || rawDetail;

    const items =
      (Array.isArray(detail?.items) && detail.items) ||
      (Array.isArray(detail?.orderItems) && detail.orderItems) ||
      (Array.isArray(detail?.lines) && detail.lines) ||
      (Array.isArray(rawDetail?.items) && rawDetail.items) ||
      (Array.isArray(rawDetail?.orderItems) && rawDetail.orderItems) ||
      (Array.isArray(rawDetail?.lines) && rawDetail.lines) ||
      [];

    console.log("RETURN DETAIL RAW:", rawDetail);
    console.log("RETURN DETAIL:", detail);
    console.log("RETURN ITEMS:", items);

    const mappedReturnLines = items.map((item: any) => {
      const variant = item.variant || item.productVariant || {};
      const product = item.product || variant.product || {};
      const orderedQty = Number(item.qty || item.quantity || item.orderedQty || 1);

      return {
        id: String(item.id || item.variantId || variant.id || crypto.randomUUID()),
        variantId: item.variantId || variant.id,
        sku: item.sku || variant.sku || "",
        productName:
          item.productName ||
          item.name ||
          product.name ||
          variant.productName ||
          "Sản phẩm",
        color: item.color || variant.color || "",
        size: item.size || variant.size || "",
        price: Number(
          item.price ||
          item.unitPrice ||
          item.salePrice ||
          item.finalPrice ||
          item.priceAtSale ||
          0
        ),
        orderedQty,
        returnQty: orderedQty,
      };
    });
    customerSearchVersionRef.current++;

    setSelectedReturnOrder(detail);
    setReturnLines(mappedReturnLines);
    setExchangeLines([]);
    setReturnNote("");
    setReturnReceived(true);

    setCustomerName(
      detail.customerName ||
        detail.customer?.fullName ||
        detail.customer?.name ||
        customerName
    );

    setCustomerPhone(detail.customerPhone || detail.customer?.phone || customerPhone);
    setCustomerSuggestions([]);
    setCustomerSearching(false);

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

  const updatePaymentRow = (
    id: string,
    patch: Partial<Pick<PaymentRow, "paymentSourceId" | "amount">>
  ) => {
    setPaymentRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const addPaymentRow = () => {
    const remaining = Math.max(0, mustPay - totalPaid);
    setPaymentRows((prev) => [
      ...prev,
      {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        paymentSourceId: visiblePaymentSources[0]?.id
          ? String(visiblePaymentSources[0].id)
          : "",
        amount: remaining ? String(remaining) : "0",
      },
    ]);
  };

  const removePaymentRow = (id: string) => {
    setPaymentRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)
    );
  };

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

  const stopCameraScan = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    setCameraScanning(false);
    setCameraOpen(false);
  };

  const startCameraScan = async () => {
    try {
      setError("");
      setCameraOpen(true);
      setCameraScanning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const BarcodeDetectorClass = (window as any).BarcodeDetector;

      if (!BarcodeDetectorClass) {
        setError("Trình duyệt này chưa hỗ trợ camera scan. Dùng máy quét barcode hoặc nhập SKU.");
        return;
      }

      const detector = new BarcodeDetectorClass({
        formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"],
      });

      const scanLoop = async () => {
        if (!videoRef.current || !cameraStreamRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          const rawValue = codes?.[0]?.rawValue;

          if (rawValue) {
            const code = String(rawValue).trim().toLowerCase();
            const found = allVariants.find(
              (v: any) =>
                String(v.sku || "").toLowerCase() === code ||
                String(v.productCode || "").toLowerCase() === code
            );

            if (found) {
              addVariant(found);
              stopCameraScan();
              return;
            }

            setProductSearch(rawValue);
          }
        } catch { }

        requestAnimationFrame(scanLoop);
      };

      requestAnimationFrame(scanLoop);
    } catch {
      setCameraScanning(false);
      setError("Không mở được camera. Kiểm tra quyền camera của trình duyệt.");
    }
  };

  useEffect(() => {
    if (!products.length) return;

    try {
      localStorage.setItem("the1970_pos_products_cache", JSON.stringify(products));
      setOfflineReady(true);
    } catch {
      setOfflineReady(false);
    }
  }, [products]);

  useEffect(() => {
    if (products.length) return;

    try {
      const cached = localStorage.getItem("the1970_pos_products_cache");
      if (!cached) return;
      const rows = JSON.parse(cached);
      if (Array.isArray(rows) && rows.length) {
        setProducts(rows);
        setOfflineReady(true);
      }
    } catch {
      setOfflineReady(false);
    }
  }, [products.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (e.key === "F1") {
        e.preventDefault();
        void handlePay();
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (cameraOpen) {
          e.preventDefault();
          stopCameraScan();
          return;
        }
        if (returnFormOpen) {
          e.preventDefault();
          setReturnFormOpen(false);
          return;
        }
        if (returnPickerOpen) {
          e.preventDefault();
          setReturnPickerOpen(false);
          return;
        }
      }

      if (e.key === "Enter" && document.activeElement === searchRef.current) {
        e.preventDefault();
        if (filteredVariants[0]) addVariant(filteredVariants[0]);
        return;
      }

      if (isTyping && document.activeElement !== searchRef.current) return;

      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;

        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);

        barcodeTimerRef.current = setTimeout(() => {
          const code = barcodeBufferRef.current.trim().toLowerCase();
          barcodeBufferRef.current = "";

          if (code.length < 4) return;

          const found = allVariants.find(
            (v: any) =>
              String(v.sku || "").toLowerCase() === code ||
              String(v.productCode || "").toLowerCase() === code
          );

          if (found) addVariant(found);
          else setProductSearch(code);
        }, 90);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allVariants, filteredVariants, cameraOpen, returnPickerOpen, returnFormOpen, lines, branchId, paymentRows, totalPaid, discountNumber, note, customerName, customerPhone]);

  useEffect(() => {
    return () => stopCameraScan();
  }, []);
const handlePay = async () => {
  if (!branchId) {
    setError("Chưa có chi nhánh.");
    return;
  }

  if (!lines.length) {
    setError("Chưa có sản phẩm trong đơn.");
    return;
  }

  if (!customerPhone.trim() && !customerName.trim()) {
    setError("Cần nhập SĐT hoặc tên khách hàng trước khi thanh toán.");
    return;
  }

  const validPayments = paymentRows
    .map((row) => ({
      paymentSourceId: row.paymentSourceId,
      amount: moneyNumber(row.amount),
    }))
    .filter((row) => row.paymentSourceId && row.amount > 0);

  if (!validPayments.length) {
    setError("Chưa nhập nguồn tiền thanh toán.");
    return;
  }

  if (validPayments.reduce((sum, row) => sum + row.amount, 0) < mustPay) {
    setError("Tổng tiền khách thanh toán chưa đủ.");
    return;
  }

  try {
    setSaving(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      salesChannel: "POS" as any,
      isPosSale: true,
      branchId,
      customerName: customerName.trim() || "Khách POS",
      customerPhone: customerPhone.trim() || "",
      note: [
        "Đơn POS bán tại quầy",
        note.trim() ? `Ghi chú: ${note.trim()}` : "",
        discountNumber ? `Giảm giá POS nhập tay: ${discountNumber}` : "",
        autoPromotionDiscount ? `Khuyến mại tự động: ${autoPromotionDiscount}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      mode: "approve" as any,
      discountAmount: discountNumber,
      payments: validPayments,
      paymentSourceId: validPayments[0]?.paymentSourceId || "",
      paidAmount: validPayments.reduce((sum, row) => sum + row.amount, 0),
      paymentNote: "Thanh toán POS",
      items: lines.map((line) => ({
        variantId: line.variantId,
        qty: Number(line.qty),
      })),
    };

    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem("token");

    const posPayStartedAt = performance.now();

    const res = await fetch(`${apiBase}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const created = await res.json().catch(() => null);

    console.log(
      "[POS PAY] /orders request ms:",
      Math.round(performance.now() - posPayStartedAt)
    );

    if (!res.ok) {
      throw new Error(created?.message || "Thanh toán thất bại.");
    }

    setSuccessMessage("Tạo đơn POS thành công. Đang mở chi tiết đơn...");

    setTimeout(() => {
      const createdOrder = created?.data || created?.order || created;
      router.push(`/orders/${encodeURIComponent(createdOrder.id)}?created=1&pos=1`);
    }, 500);
  } catch (err: any) {
    setError(err?.message || "Thanh toán thất bại.");
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="h-[calc(100vh-145px)] overflow-hidden rounded-[28px] border border-neutral-200 bg-[#f5f5f3] shadow-sm">
      <div className="grid h-full grid-cols-[minmax(0,1fr)_390px] overflow-hidden">
        <main className="flex min-w-0 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-neutral-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchRef}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredVariants[0]) {
                      addVariant(filteredVariants[0]);
                    }
                  }}
                  placeholder="Thêm sản phẩm vào đơn / quét SKU..."
                  className="h-12 w-full rounded-[20px] border border-neutral-300 bg-white px-5 text-[15px] font-medium text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-100"
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
                title="Tạo tab đơn mới"
              >
                +
              </button>

              <button
                type="button"
                onClick={startCameraScan}
                className="h-10 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                title="Scan bằng camera"
              >
                Camera
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
                  className={`grid grid-cols-[48px_64px_120px_1fr_100px_110px_120px_40px] items-center border-b border-neutral-100 px-4 py-2 text-sm transition ${highlightId === line.variantId ? "bg-amber-100" : "hover:bg-neutral-50"
                    }`}
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
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{line.productName}</div>
                      {line.productId && discountedProductIdSet.has(String(line.productId)) ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Đang KM
                        </span>
                      ) : null}
                    </div>
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

          <div className="shrink-0 border-t border-neutral-200 bg-white p-3">
            <div className="grid grid-cols-5 gap-3">
              {quickActions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="h-11 rounded-2xl bg-neutral-100 px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-200"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="h-full overflow-hidden border-l border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Thanh toán POS</div>
              <div className="mt-1 text-xs text-neutral-500">
                Kênh bán: POS tại quầy
              </div>
            </div>

            <div className="flex items-center gap-2">
              {offlineReady ? (
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Offline ready
                </div>
              ) : null}
              <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                F1
              </div>
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
                        customerSearchVersionRef.current++;
                        setCustomerName(customer.fullName || customer.name || "");
                        setCustomerPhone(customer.phone || "");
                        setCustomerSuggestions([]);
                        setCustomerSearching(false);
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
              <span>Chiết khấu nhập tay</span>
              <input
                value={formatMoneyInput(discount)}
                onChange={(e) => setDiscount(String(moneyNumber(e.target.value)))}
                className="h-9 w-32 rounded-xl border border-neutral-200 px-3 text-right outline-none"
              />
            </div>

            {autoPromotionDiscount > 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
                <div className="flex justify-between font-semibold">
                  <span>Khuyến mại tự động</span>
                  <span>-{currency(autoPromotionDiscount)}</span>
                </div>
                {promotionPreview.breakdown.length ? (
                  <div className="mt-1 space-y-0.5 text-xs">
                    {promotionPreview.breakdown.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3">
                        <span>{item.name}</span>
                        <span>-{currency(item.discountAmount)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-neutral-100 pt-2" />

            <div className="flex justify-between text-base">
              <span className="font-semibold">Khách phải trả</span>
              <strong className="text-xl">{currency(mustPay)}</strong>
            </div>
          </div>

          <div className="my-3 border-t border-neutral-100" />

          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="text-sm font-semibold">Nguồn tiền</label>
            <button
              type="button"
              onClick={addPaymentRow}
              className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              + Thêm nguồn
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {paymentRows.map((row, index) => (
              <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_128px_28px] gap-2">
                <select
                  value={row.paymentSourceId}
                  onChange={(e) =>
                    updatePaymentRow(row.id, { paymentSourceId: e.target.value })
                  }
                  className="h-10 min-w-0 rounded-2xl border border-neutral-200 px-3 text-sm outline-none"
                >
                  <option value="">Chọn nguồn tiền</option>
                  {visiblePaymentSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name || source.label || source.displayName || source.code}
                    </option>
                  ))}
                </select>

                <input
                  value={formatMoneyInput(row.amount)}
                  onChange={(e) =>
                    updatePaymentRow(row.id, {
                      amount: String(moneyNumber(e.target.value)),
                    })
                  }
                  placeholder="Số tiền"
                  className="h-10 rounded-2xl border border-neutral-200 px-3 text-right text-sm font-semibold outline-none"
                />

                <button
                  type="button"
                  onClick={() => removePaymentRow(row.id)}
                  disabled={paymentRows.length <= 1}
                  className="h-10 rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  title={index === 0 ? "Nguồn chính" : "Xoá nguồn"}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() =>
                  setPaymentRows((prev) =>
                    prev.length
                      ? [{ ...prev[0], amount: String(amount) }, ...prev.slice(1)]
                      : [{ id: "pay-1", paymentSourceId: "", amount: String(amount) }]
                  )
                }
                className="rounded-xl bg-neutral-100 px-2 py-2 text-xs font-medium hover:bg-neutral-200"
              >
                {currency(amount).replace("đ", "")}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Khách đã thanh toán</span>
              <strong>{currency(totalPaid)}</strong>
            </div>
            <div className="flex justify-between">
              <span>{totalPaid >= mustPay ? "Tiền thừa trả khách" : "Còn thiếu"}</span>
              <strong className={totalPaid >= mustPay ? "" : "text-red-600"}>
                {currency(totalPaid >= mustPay ? change : mustPay - totalPaid)}
              </strong>
            </div>
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

          {successMessage ? (
            <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handlePay}
            disabled={saving || !lines.length}
            className="mt-4 h-14 w-full rounded-[22px] bg-neutral-950 text-base font-bold text-white shadow-lg shadow-neutral-200 transition hover:bg-neutral-800 disabled:bg-neutral-300 disabled:shadow-none"
          >
            {saving ? "ĐANG LƯU..." : "THANH TOÁN (F1)"}
          </button>

          <button
            type="button"
            onClick={clearOrder}
            className="mt-3 h-11 w-full rounded-[18px] border border-neutral-200 bg-white text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
          >
            Reset
          </button>
        </aside>
      </div>

      {cameraOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Scan barcode bằng camera</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Đưa mã vạch/QR vào giữa khung. Nhấn Esc để đóng.
                </p>
              </div>
              <button
                type="button"
                onClick={stopCameraScan}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Đóng
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} className="h-[360px] w-full object-cover" muted playsInline />
            </div>

            <div className="mt-3 text-center text-xs text-neutral-500">
              {cameraScanning ? "Đang quét..." : "Đang chờ quyền camera..."}
            </div>
          </div>
        </div>
      ) : null}

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={() => setReturnPickerOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[82vh] overflow-hidden rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Chọn đơn đổi trả</h3>
                <p className="mt-1 text-sm text-neutral-500">Chọn đơn là tự tick trả toàn bộ. ESC hoặc click ngoài để đóng.</p>
              </div>
              <button
                type="button"
                onClick={() => setReturnPickerOpen(false)}
                className="h-10 w-10 rounded-full bg-neutral-100 text-lg font-semibold hover:bg-neutral-200"
                title="Đóng"
              >
                ×
              </button>
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

            <div className="mt-4 max-h-[58vh] overflow-auto rounded-2xl border border-neutral-200">
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
        <div
          className="fixed inset-0 z-50 overflow-auto bg-black/35 p-4"
          onClick={() => setReturnFormOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-6xl rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Tạo phiếu đổi trả hàng</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Đơn gốc: {selectedReturnOrder.orderCode || selectedReturnOrder.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnFormOpen(false)}
                className="h-10 w-10 rounded-full bg-neutral-100 text-lg font-semibold hover:bg-neutral-200"
                title="Đóng"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">Sản phẩm trả</h4>
                      <p className="mt-1 text-xs text-neutral-500">Mặc định đã chọn trả toàn bộ. Có thể chỉnh số lượng từng dòng.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReturnLines((prev) => prev.map((line) => ({ ...line, returnQty: line.orderedQty })))}
                        className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                      >
                        Trả toàn bộ
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnLines((prev) => prev.map((line) => ({ ...line, returnQty: 0 })))}
                        className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

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
                <h4 className="font-semibold">Tự tính hoàn tiền / bù tiền</h4>
                <p className="mt-1 text-xs text-neutral-500">POS tự ghi chú hoàn tiền hoặc khách bù thêm theo chênh lệch.</p>

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
                    const returnedItems = returnLines.filter((line) => line.returnQty > 0);

                    if (!returnedItems.length) {
                      setError("Chưa chọn sản phẩm trả.");
                      return;
                    }

                    const returnTotal = returnedItems.reduce(
                      (sum, line) => sum + line.price * line.returnQty,
                      0
                    );
                    const exchangeTotal = exchangeLines.reduce(
                      (sum, line) => sum + line.price * line.qty,
                      0
                    );
                    const diff = returnTotal - exchangeTotal;

                    const refundText =
                      diff > 0
                        ? `Tự động hoàn khách: ${currency(diff)}`
                        : diff < 0
                          ? `Khách cần bù thêm: ${currency(Math.abs(diff))}`
                          : "Đổi ngang: không phát sinh hoàn/bù";

                    setNote((prev) =>
                      [
                        prev,
                        `Đổi trả đơn ${selectedReturnOrder.orderCode || selectedReturnOrder.code}`,
                        returnReceived ? "Đã nhận hàng trả" : "Chưa nhận hàng trả",
                        `Sản phẩm trả: ${returnedItems.map((line) => `${line.sku || line.productName} x${line.returnQty}`).join(", ")}`,
                        exchangeLines.length
                          ? `Sản phẩm đổi: ${exchangeLines.map((line) => `${line.sku || line.productName} x${line.qty}`).join(", ")}`
                          : "Không có sản phẩm đổi",
                        `Tiền hàng trả: ${currency(returnTotal)}`,
                        `Tiền hàng đổi: ${currency(exchangeTotal)}`,
                        refundText,
                        returnNote ? `Ghi chú: ${returnNote}` : "",
                      ]
                        .filter(Boolean)
                        .join(" | ")
                    );

                    setLines(exchangeLines);

                    if (diff > 0) {
                      setDiscount(String(exchangeTotal));
                      setPaidAmount("0");
                      setPaymentRows((prev) =>
                        prev.length ? [{ ...prev[0], amount: "0" }, ...prev.slice(1)] : prev
                      );
                    } else if (diff < 0) {
                      setDiscount(String(returnTotal));
                      setPaidAmount(String(Math.abs(diff)));
                      setPaymentRows((prev) =>
                        prev.length
                          ? [{ ...prev[0], amount: String(Math.abs(diff)) }, ...prev.slice(1)]
                          : [{ id: "pay-1", paymentSourceId: "", amount: String(Math.abs(diff)) }]
                      );
                    } else {
                      setDiscount(String(exchangeTotal));
                      setPaidAmount("0");
                      setPaymentRows((prev) =>
                        prev.length ? [{ ...prev[0], amount: "0" }, ...prev.slice(1)] : prev
                      );
                    }

                    setReturnFormOpen(false);
                    setError(
                      diff > 0
                        ? `Đã áp dụng đổi trả. Cần hoàn khách ${currency(diff)}.`
                        : diff < 0
                          ? `Đã áp dụng đổi trả. Khách cần bù ${currency(Math.abs(diff))}.`
                          : "Đã áp dụng đổi ngang."
                    );
                  }}
                  className="mt-5 h-12 w-full rounded-2xl bg-neutral-950 font-semibold text-white hover:bg-neutral-800"
                >
                  Áp dụng 1 click
                </button>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}