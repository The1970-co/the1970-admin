"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { findPrintTemplate, loadPrintTemplates, savePrintTemplates } from "@/lib/print-template-config";
import {
  openProductLabelPrintDocument,
  renderProductLabelsHtml,
  type ProductLabelPrintItem,
  type ProductLabelPrintOptions,
} from "@/lib/print-template-engine";

const DRAFT_KEY = "the1970.print-center.product-labels.draft";
// Dùng localStorage để truyền draft từ tab Danh sách sản phẩm sang tab Trung tâm in ấn.
// sessionStorage là theo từng tab nên window.open(..., noopener) không đọc được draft mới.
function readStoredLabelDraft() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY) || "";
}

function writeStoredLabelDraft(value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, value);
  sessionStorage.setItem(DRAFT_KEY, value);
}

function removeStoredLabelDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
  sessionStorage.removeItem(DRAFT_KEY);
}

const PAPER_PRESETS_KEY = "the1970.print-center.product-label.paper-presets";

type LabelDraftRow = {
  key: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
};

type LabelDraft = {
  productId?: string;
  productName?: string;
  branchId?: string | null;
  rows: LabelDraftRow[];
};

type PaperPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
};

type ProductSearchItem = {
  id?: string;
  name?: string;
  slug?: string;
  price?: number;
  variants?: Array<{
    id?: string;
    sku?: string;
    size?: string;
    color?: string;
    price?: number;
    stock?: number;
    branchStocks?: Record<string, number>;
    inventoryByBranch?: Record<string, number>;
    inventoryItems?: Array<{ branchId?: string; availableQty?: number; qty?: number; stock?: number }>;
  }>;
};

const basePaperPresets: PaperPreset[] = [
  { id: "50x50", name: "Tem cuộn 50 × 50mm", width: 50, height: 50 },
  { id: "50x30", name: "Tem giá 50 × 30mm", width: 50, height: 30 },
  { id: "40x30", name: "Tem mini 40 × 30mm", width: 40, height: 30 },
  { id: "70x40", name: "Tem ngang 70 × 40mm", width: 70, height: 40 },
  { id: "custom", name: "Tự nhập kích thước", width: 50, height: 50 },
];

const printerOptions = [
  "Máy in mặc định",
  "Máy in tem 50x50",
  "Xprinter / Godex / TSC",
  "Máy in văn phòng",
];

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function sanitizeQty(value: string) {
  const qty = Math.floor(Number(String(value || "1").replace(/[^\d]/g, "")) || 1);
  return Math.max(1, qty);
}

function safeNumber(value: string | number, fallback: number) {
  const next = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function defaultDraft(): LabelDraft {
  return {
    productName: "Chưa chọn sản phẩm",
    branchId: "__default__",
    rows: [],
  };
}

function stockOfVariant(variant: any): number {
  if (variant?.stock !== undefined && variant?.stock !== null) {
    return Number(variant.stock || 0);
  }

  const branchStocks =
    (variant?.branchStocks || variant?.inventoryByBranch || {}) as Record<string, any>;
  const branchTotal = Object.values(branchStocks).reduce<number>(
    (sum, qty) => sum + Number(qty || 0),
    0,
  );

  if (branchTotal !== 0 || Object.keys(branchStocks).length > 0) return branchTotal;

  const inventoryItems = Array.isArray(variant?.inventoryItems)
    ? variant.inventoryItems
    : [];

  return inventoryItems.reduce(
    (sum: number, item: any) =>
      sum + Number(item?.availableQty ?? item?.qty ?? item?.stock ?? 0),
    0,
  );
}

function getProductDisplayName(product?: ProductSearchItem | null) {
  return product?.name || product?.slug || product?.id || "Sản phẩm";
}

function normalizeProductRows(raw: any): ProductSearchItem[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  return rows.map((product: any) => ({
    ...product,
    id: product?.id ? String(product.id) : undefined,
    name: product?.name ? String(product.name) : "",
    slug: product?.slug ? String(product.slug) : "",
    price: Number(product?.price || product?.defaultPrice || 0),
    variants: Array.isArray(product?.variants) ? product.variants : [],
  }));
}

function normalizeDraftRows(rows: LabelDraftRow[]) {
  const bySku = new Map<string, LabelDraftRow>();

  rows.forEach((row) => {
    const key = String(row.key || row.sku || "").trim();
    const sku = String(row.sku || key).trim();
    if (!key || !sku) return;

    bySku.set(sku.toUpperCase(), {
      key,
      productName: row.productName || "Sản phẩm",
      sku,
      size: row.size || "",
      color: row.color || "",
      price: Number(row.price || 0),
      stock: Number(row.stock || 0),
    });
  });

  return Array.from(bySku.values());
}

function draftFromProduct(product: ProductSearchItem): LabelDraft {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const productName = product?.name || product?.slug || "Sản phẩm";

  if (!variants.length) {
    return {
      productId: product?.id,
      productName,
      branchId: "__default__",
      rows: [
        {
          key: product?.slug || product?.id || productName,
          productName,
          sku: product?.slug || product?.id || productName,
          size: "",
          color: "",
          price: Number(product?.price || 0),
          stock: 0,
        },
      ],
    };
  }

  return {
    productId: product?.id,
    productName,
    branchId: "__default__",
    rows: variants.map((variant, index) => {
      const sku = variant?.sku || `${product?.slug || product?.id || "SKU"}-${index + 1}`;
      return {
        key: sku,
        productName,
        sku,
        size: variant?.size || "",
        color: variant?.color || "",
        price: Number(variant?.price || product?.price || 0),
        stock: stockOfVariant(variant),
      };
    }),
  };
}

function rowsFromProduct(product: ProductSearchItem, onlySku?: string): LabelDraftRow[] {
  const productDraft = draftFromProduct(product);
  const wantedSku = String(onlySku || "").trim();
  const rows = wantedSku
    ? productDraft.rows.filter((row) => row.sku === wantedSku || row.key === wantedSku)
    : productDraft.rows;

  return normalizeDraftRows(rows);
}

async function readProductList(keyword: string) {
  const params = new URLSearchParams({ page: "1", limit: "50" });
  if (keyword.trim()) params.set("q", keyword.trim());

  const res = await apiFetch(`/products?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || "Không tải được sản phẩm.");
  }

  return normalizeProductRows(await res.json());
}

async function readProductDetail(product: ProductSearchItem) {
  if (!product?.id) return product;

  try {
    const res = await apiFetch(`/products/${encodeURIComponent(product.id)}`, {
      cache: "no-store",
    });

    if (!res.ok) return product;

    const detail = await res.json();
    return normalizeProductRows([detail])[0] || product;
  } catch {
    return product;
  }
}

export default function ProductLabelsPrintCenterClient() {
  const [draft, setDraft] = useState<LabelDraft>(() => defaultDraft());
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [printerName, setPrinterName] = useState("Máy in mặc định");
  const [paperId, setPaperId] = useState("50x50");
  const [customWidthMm, setCustomWidthMm] = useState("50");
  const [customHeightMm, setCustomHeightMm] = useState("50");
  const [gapMm, setGapMm] = useState("0.4");
  const [scale, setScale] = useState("100");
  const [barcodeWidthMm, setBarcodeWidthMm] = useState("47");
  const [barcodeHeightMm, setBarcodeHeightMm] = useState("10.5");
  const [qrSizeMm, setQrSizeMm] = useState("13");
  const [priceMode, setPriceMode] = useState<"retail" | "hidden">("retail");
  const [showProductName, setShowProductName] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showSize, setShowSize] = useState(true);
  const [showColor, setShowColor] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showWebsite, setShowWebsite] = useState(true);
  const [showRecycle, setShowRecycle] = useState(true);
  const [showMadeInVietnam, setShowMadeInVietnam] = useState(true);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customPaperPresets, setCustomPaperPresets] = useState<PaperPreset[]>([]);
  const [templateName, setTemplateName] = useState("Tem tuỳ chỉnh");
  const draftMutationSeq = useRef(0);

  const isLegacyDemoDraft = (value: any) => {
    const rows = Array.isArray(value?.rows) ? value.rows : [];
    if (!rows.length) return false;
    return rows.some((row: any) =>
      String(row?.sku || "").toUpperCase() === "AP938-T-S" ||
      String(row?.key || "").toUpperCase() === "DEMO-S",
    );
  };

  const applyDraft = (
    nextDraft: LabelDraft,
    previousQtyMap: Record<string, string> = qtyMap,
    bumpSeq = true,
  ) => {
    if (bumpSeq) draftMutationSeq.current += 1;
    const nextRows = normalizeDraftRows(nextDraft.rows || []);
    const cleanDraft: LabelDraft = {
      ...nextDraft,
      productName: nextDraft.productName || "Sản phẩm",
      branchId: nextDraft.branchId || "__default__",
      rows: nextRows,
    };

    setDraft(cleanDraft);
    setSelectedMap(Object.fromEntries(nextRows.map((row) => [row.key, true])));
    setQtyMap(
      Object.fromEntries(
        nextRows.map((row) => [row.key, previousQtyMap[row.key] || "1"]),
      ),
    );
    writeStoredLabelDraft(JSON.stringify(cleanDraft));
  };

  const appendRowsToDraft = (
    rows: LabelDraftRow[],
    source?: { productName?: string; productId?: string; branchId?: string | null },
  ) => {
    const nextRows = normalizeDraftRows([...draft.rows, ...rows]);
    const nextDraft: LabelDraft = {
      productId: draft.productId || source?.productId,
      productName:
        draft.rows.length > 0 && draft.productName !== "Chưa chọn sản phẩm"
          ? draft.productName
          : source?.productName || "Sản phẩm đã chọn",
      branchId: draft.branchId || source?.branchId || "__default__",
      rows: nextRows,
    };

    applyDraft(nextDraft, qtyMap);
    setMessage(`Đã thêm ${rows.length} SKU. Tổng hiện có ${nextRows.length} SKU trong bảng in.`);
  };

  const buildKeyedRows = (product: ProductSearchItem, onlySku?: string) => {
    return rowsFromProduct(product, onlySku).map((row) => ({
      ...row,
      key: `${product.id || product.slug || row.productName}:${row.sku}`,
    }));
  };

  const replaceDraftWithProduct = async (product: ProductSearchItem, onlySku?: string) => {
    const actionSeq = ++draftMutationSeq.current;

    try {
      setLoadingProducts(true);
      setMessage("");

      const immediateRows = buildKeyedRows(product, onlySku);
      if (immediateRows.length) {
        applyDraft(
          {
            productId: product.id,
            productName: getProductDisplayName(product),
            branchId: draft.branchId || "__default__",
            rows: immediateRows,
          },
          {},
          false,
        );
        setPickerOpen(false);
        setMessage(
          onlySku
            ? `Đã chọn SKU ${onlySku}.`
            : `Đã chọn ${getProductDisplayName(product)} với ${immediateRows.length} SKU.`,
        );
      }

      const detail = await readProductDetail(product);
      if (actionSeq !== draftMutationSeq.current) return;

      const rows = buildKeyedRows(detail, onlySku);
      if (!rows.length) {
        setMessage("Sản phẩm này chưa có SKU để in tem.");
        return;
      }

      applyDraft(
        {
          productId: detail.id || product.id,
          productName: getProductDisplayName(detail),
          branchId: draft.branchId || "__default__",
          rows,
        },
        {},
        false,
      );
      setPickerOpen(false);
      setMessage(
        onlySku
          ? `Đã chọn SKU ${onlySku}.`
          : `Đã chọn ${getProductDisplayName(detail)} với ${rows.length} SKU.`,
      );
    } catch (err) {
      if (actionSeq === draftMutationSeq.current) {
        setMessage(err instanceof Error ? err.message : "Không chọn được sản phẩm.");
      }
    } finally {
      if (actionSeq === draftMutationSeq.current) setLoadingProducts(false);
    }
  };

  const appendProductRows = async (product: ProductSearchItem, onlySku?: string) => {
    const actionSeq = ++draftMutationSeq.current;

    try {
      setLoadingProducts(true);
      setMessage("");
      const detail = await readProductDetail(product);
      if (actionSeq !== draftMutationSeq.current) return;

      const rows = buildKeyedRows(detail, onlySku);

      if (!rows.length) {
        setMessage("Sản phẩm này chưa có SKU để in tem.");
        return;
      }

      appendRowsToDraft(rows, {
        productId: detail.id,
        productName: getProductDisplayName(detail),
        branchId: draft.branchId || "__default__",
      });
      setPickerOpen(false);
    } catch (err) {
      if (actionSeq === draftMutationSeq.current) {
        setMessage(err instanceof Error ? err.message : "Không thêm được sản phẩm.");
      }
    } finally {
      if (actionSeq === draftMutationSeq.current) setLoadingProducts(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAPER_PRESETS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setCustomPaperPresets(
          parsed
            .map((item: any) => ({
              id: String(item.id || `custom_${Date.now()}`),
              name: String(item.name || "Tem tuỳ chỉnh"),
              width: safeNumber(item.width, 50),
              height: safeNumber(item.height, 50),
            }))
            .filter((item: PaperPreset) => item.width > 0 && item.height > 0),
        );
      }
    } catch {
      setCustomPaperPresets([]);
    }
  }, []);

  useEffect(() => {
    const hydrateDraft = async () => {
      const hydrateSeq = ++draftMutationSeq.current;

      try {
        const raw = readStoredLabelDraft();
        if (!raw) {
          if (hydrateSeq !== draftMutationSeq.current) return;
          setPickerOpen(true);
          await loadProductsForPicker("");
          return;
        }

        const parsed = JSON.parse(raw) as LabelDraft;
        if (!Array.isArray(parsed?.rows) || !parsed.rows.length || isLegacyDemoDraft(parsed)) {
          removeStoredLabelDraft();
          if (hydrateSeq !== draftMutationSeq.current) return;
          setPickerOpen(true);
          await loadProductsForPicker("");
          return;
        }

        // Quan trọng: nếu mở từ danh sách sản phẩm mà draft chỉ có 1 SKU,
        // gọi lại /products/:id để bung đủ toàn bộ mã con cho sản phẩm cha.
        if (parsed.productId && parsed.rows.length <= 1) {
          const detail = await readProductDetail({ id: parsed.productId, name: parsed.productName });
          if (hydrateSeq !== draftMutationSeq.current) return;

          const expandedRows = buildKeyedRows(detail);

          if (expandedRows.length > parsed.rows.length) {
            applyDraft(
              {
                productId: detail.id || parsed.productId,
                productName: getProductDisplayName(detail) || parsed.productName,
                branchId: parsed.branchId || "__default__",
                rows: expandedRows,
              },
              {},
              false,
            );
            setMessage(`Đã bung đủ ${expandedRows.length} SKU của ${getProductDisplayName(detail)}.`);
            return;
          }
        }

        if (hydrateSeq !== draftMutationSeq.current) return;
        applyDraft(parsed, {}, false);
      } catch {
        if (hydrateSeq !== draftMutationSeq.current) return;
        setPickerOpen(true);
        await loadProductsForPicker("");
      }
    };

    void hydrateDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (draft.rows.length && !Object.keys(selectedMap).length) {
      setSelectedMap(Object.fromEntries(draft.rows.map((row) => [row.key, true])));
      setQtyMap(Object.fromEntries(draft.rows.map((row) => [row.key, "1"])));
    }
  }, [draft.rows, selectedMap]);

  const loadProductsForPicker = async (keyword = productQuery) => {
    try {
      setLoadingProducts(true);
      setMessage("");
      const rows = await readProductList(keyword);
      setProductResults(rows);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được sản phẩm.");
      setProductResults([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const openProductPicker = () => {
    setPickerOpen(true);
    void loadProductsForPicker("");
  };

  const paperPresets = useMemo(() => {
    const customOption = basePaperPresets.find((item) => item.id === "custom")!;
    return [
      ...basePaperPresets.filter((item) => item.id !== "custom"),
      ...customPaperPresets,
      customOption,
    ];
  }, [customPaperPresets]);

  const selectedPreset = paperPresets.find((item) => item.id === paperId) || paperPresets[0];
  const isCustomPaper = paperId === "custom";
  const paper = {
    ...selectedPreset,
    width: isCustomPaper ? safeNumber(customWidthMm, 50) : selectedPreset.width,
    height: isCustomPaper ? safeNumber(customHeightMm, 50) : selectedPreset.height,
  };

  const template = useMemo(() => {
    const templates = loadPrintTemplates();
    return findPrintTemplate({
      templates,
      branchId: draft.branchId || "__default__",
      templateType: "product_label",
      paperSize: "50mm",
    });
  }, [draft.branchId]);

  const options: ProductLabelPrintOptions = {
    gapMm: Number(gapMm || 0),
    scale: Number(scale || 100),
    paperWidthMm: paper.width,
    paperHeightMm: paper.height,
    barcodeWidthMm: safeNumber(barcodeWidthMm, 47),
    barcodeHeightMm: safeNumber(barcodeHeightMm, 10.5),
    qrSizeMm: safeNumber(qrSizeMm, 13),
    showProductName,
    showBarcode,
    showSku,
    showSize,
    showColor,
    showPrice,
    showQr,
    showWebsite,
    showRecycle,
    showMadeInVietnam,
  };

  const selectedRows = draft.rows.filter((row) => selectedMap[row.key]);

  const printItems: ProductLabelPrintItem[] = selectedRows.map((row) => ({
    productName: row.productName,
    sku: row.sku,
    barcode: row.sku,
    qrValue: row.sku,
    size: row.size,
    color: row.color,
    price: priceMode === "hidden" || !showPrice ? 0 : row.price,
    quantity: sanitizeQty(qtyMap[row.key] || "1"),
  }));

  const totalPrintQty = printItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const previewHtml = printItems.length
    ? renderProductLabelsHtml({ items: printItems, template, options })
    : `<div style="font-family:Arial,sans-serif;padding:16px;color:#666;">Chưa chọn SKU để preview.</div>`;

  const toggleAll = (checked: boolean) => {
    setSelectedMap(Object.fromEntries(draft.rows.map((row) => [row.key, checked])));
  };

  const setQtyForAll = (mode: "one" | "stock") => {
    setQtyMap(
      Object.fromEntries(
        draft.rows.map((row) => [row.key, mode === "stock" ? String(Math.max(1, Number(row.stock || 0))) : "1"]),
      ),
    );
  };

  const handleSaveLabelTemplate = () => {
    const width = safeNumber(customWidthMm, paper.width || 50);
    const height = safeNumber(customHeightMm, paper.height || 50);
    const name = `${templateName.trim() || "Tem tuỳ chỉnh"} ${width}×${height}mm`;
    const id = `custom_${width}x${height}_${Date.now()}`;

    const nextPreset: PaperPreset = { id, name, width, height };
    const nextPresets = [...customPaperPresets, nextPreset];
    setCustomPaperPresets(nextPresets);
    localStorage.setItem(PAPER_PRESETS_KEY, JSON.stringify(nextPresets));
    setPaperId(id);

    const templates = loadPrintTemplates();
    const source = template || findPrintTemplate({
      templates,
      branchId: draft.branchId || "__default__",
      templateType: "product_label",
      paperSize: "50mm",
    });

    savePrintTemplates([
      ...templates,
      {
        ...(source || templates[0]),
        id,
        name,
        branchId: draft.branchId || "__default__",
        branchName: draft.branchId || "DEFAULT",
        templateType: "product_label",
        paperSize: "50mm",
        isDefault: false,
        title: "TEM SẢN PHẨM",
        footerNote: "",
        showBarcode,
        showQr,
      },
    ] as any);

    setMessage(`Đã lưu mẫu ${name}.`);
  };

  const handlePrint = () => {
    if (!printItems.length) {
      setMessage("Chưa chọn SKU để in tem.");
      return;
    }

    openProductLabelPrintDocument({
      title: `In tem ${draft.productName || "sản phẩm"}`,
      items: printItems,
      template,
      options,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/print-center" className="text-sm text-neutral-500 hover:text-neutral-950">
            ← Trung tâm in ấn
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            In tem {draft.productName || "sản phẩm"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Chọn sản phẩm/SKU, số tem, khổ giấy, khoảng hở, scale, barcode/QR và các trường hiển thị trước khi in.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openProductPicker}
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Chọn sản phẩm cần in
          </button>
          <Link href="/products" className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
            Quay lại sản phẩm
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            In tem
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950">Chọn SKU và số tem</h2>
                <p className="mt-1 text-sm text-neutral-500">Mặc định 1 tem / SKU. Có thể in theo tồn kho hoặc nhập số lượng từng dòng.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => toggleAll(true)} className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">Chọn tất cả</button>
                <button type="button" onClick={() => toggleAll(false)} className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">Bỏ chọn</button>
                <button type="button" onClick={() => setQtyForAll("one")} className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">SL = 1</button>
                <button type="button" onClick={() => setQtyForAll("stock")} className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">In theo tồn</button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">In</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Màu</th>
                    <th className="px-4 py-3">Tồn</th>
                    <th className="px-4 py-3">Giá</th>
                    <th className="px-4 py-3">Số tem</th>
                  </tr>
                </thead>
                <tbody>
                  {!draft.rows.length ? (
                    <tr className="border-t border-neutral-100">
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                        Chưa chọn SKU. Bấm “Chọn sản phẩm cần in” để lấy danh sách sản phẩm và mã con.
                      </td>
                    </tr>
                  ) : null}
                  {draft.rows.map((row) => (
                    <tr key={row.key} className="border-t border-neutral-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedMap[row.key])}
                          onChange={(event) => setSelectedMap((prev) => ({ ...prev, [row.key]: event.target.checked }))}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-950">{row.sku}</td>
                      <td className="px-4 py-3">{row.size || "—"}</td>
                      <td className="px-4 py-3">{row.color || "—"}</td>
                      <td className="px-4 py-3">{row.stock}</td>
                      <td className="px-4 py-3">{currency(row.price)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={qtyMap[row.key] || "1"}
                          onChange={(event) => setQtyMap((prev) => ({ ...prev, [row.key]: event.target.value }))}
                          className="w-24 rounded-2xl border border-neutral-300 px-3 py-2 text-center outline-none focus:border-neutral-900"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-950">Cấu hình khổ in</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Máy in</span>
                <select value={printerName} onChange={(event) => setPrinterName(event.target.value)} className="w-full rounded-2xl border border-neutral-300 px-3 py-3 outline-none focus:border-neutral-900">
                  {printerOptions.map((name) => <option key={name}>{name}</option>)}
                </select>
                <span className="block text-xs text-neutral-500">Web không chọn máy in trực tiếp được, máy thật chọn ở hộp thoại trình duyệt.</span>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Khổ tem</span>
                <select value={paperId} onChange={(event) => {
                    const nextId = event.target.value;
                    setPaperId(nextId);
                    const found = paperPresets.find((item) => item.id === nextId);
                    if (found && nextId !== "custom") {
                      setCustomWidthMm(String(found.width));
                      setCustomHeightMm(String(found.height));
                    }
                  }} className="w-full rounded-2xl border border-neutral-300 px-3 py-3 outline-none focus:border-neutral-900">
                  {paperPresets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Rộng tem (mm)</span>
                <input type="number" min="10" step="0.1" disabled={!isCustomPaper} value={isCustomPaper ? customWidthMm : String(paper.width)} onChange={(event) => setCustomWidthMm(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none disabled:bg-neutral-50 focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Cao tem (mm)</span>
                <input type="number" min="10" step="0.1" disabled={!isCustomPaper} value={isCustomPaper ? customHeightMm : String(paper.height)} onChange={(event) => setCustomHeightMm(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none disabled:bg-neutral-50 focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Khoảng hở mỗi tem (mm)</span>
                <input type="number" min="0" step="0.1" value={gapMm} onChange={(event) => setGapMm(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Thu phóng (%)</span>
                <input type="number" min="0" step="0.1" value={scale} onChange={(event) => setScale(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Barcode rộng (mm)</span>
                <input type="number" min="0" step="0.1" value={barcodeWidthMm} onChange={(event) => setBarcodeWidthMm(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Barcode cao (mm)</span>
                <input type="number" min="0" step="0.1" value={barcodeHeightMm} onChange={(event) => setBarcodeHeightMm(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">QR size (mm)</span>
                <input type="number" min="0" step="0.1" value={qrSizeMm} onChange={(event) => setQrSizeMm(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none focus:border-neutral-900" />
              </label>

              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium text-neutral-700">Tên mẫu lưu</span>
                <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-3 outline-none focus:border-neutral-900" placeholder="VD: Tem 80x80 treo tag" />
              </label>

              <div className="flex items-end">
                <button type="button" onClick={handleSaveLabelTemplate} className="w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800">
                  Lưu mẫu in
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-950">Tuỳ chọn hiển thị</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                [showProductName, setShowProductName, "Tên sản phẩm"],
                [showBarcode, setShowBarcode, "Barcode"],
                [showSku, setShowSku, "SKU"],
                [showSize, setShowSize, "Size"],
                [showColor, setShowColor, "Màu"],
                [showPrice, setShowPrice, "Giá"],
                [showQr, setShowQr, "QR"],
                [showWebsite, setShowWebsite, "THE1970.VN"],
                [showRecycle, setShowRecycle, "Icon recycle"],
                [showMadeInVietnam, setShowMadeInVietnam, "Made in Vietnam"],
              ].map(([checked, setter, label]) => (
                <label key={String(label)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={(event) => (setter as (next: boolean) => void)(event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span>{String(label)}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 max-w-sm">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-700">Giá bán</span>
                <select value={priceMode} onChange={(event) => setPriceMode(event.target.value as "retail" | "hidden")} className="w-full rounded-2xl border border-neutral-300 px-3 py-3 outline-none focus:border-neutral-900">
                  <option value="retail">Hiện giá bán lẻ</option>
                  <option value="hidden">Ẩn giá</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <aside className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm lg:sticky lg:top-5 lg:h-[calc(100vh-40px)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">Preview trước khi in</h2>
              <p className="mt-1 text-sm text-neutral-500">Đang hiện đủ {totalPrintQty} tem sẽ in</p>
            </div>
            <button type="button" onClick={handlePrint} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              In tem
            </button>
          </div>

          <div className="mt-4 h-[calc(100%-96px)] overflow-auto rounded-3xl bg-neutral-100 p-4">
            <div className="origin-top scale-[0.78]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </aside>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-950">Chọn sản phẩm cần in</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Tìm theo tên, mã chính hoặc SKU con. Có thể chọn cả sản phẩm cha hoặc từng mã con.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Đóng
              </button>
            </div>

            <div className="flex gap-2 p-5">
              <input
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadProductsForPicker(productQuery);
                }}
                className="h-12 flex-1 rounded-2xl border border-neutral-300 px-4 text-sm outline-none focus:border-neutral-900"
                placeholder="Tìm tên sản phẩm, mã chính, SKU con..."
              />
              <button
                type="button"
                onClick={() => void loadProductsForPicker(productQuery)}
                disabled={loadingProducts}
                className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {loadingProducts ? "Đang tìm..." : "Tìm"}
              </button>
            </div>

            <div className="max-h-[58vh] overflow-auto border-t border-neutral-100">
              {productResults.map((product) => {
                const productName = getProductDisplayName(product);
                const variants = Array.isArray(product.variants) ? product.variants : [];

                return (
                  <div key={product.id || product.slug || product.name} className="border-b border-neutral-100 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-base font-semibold text-neutral-950">{productName}</div>
                        <div className="mt-1 text-sm text-neutral-500">
                          Mã chính: {product.slug || "—"} · {variants.length} SKU con
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void replaceDraftWithProduct(product)}
                          className="rounded-2xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                        >
                          Chọn cả mã chính
                        </button>
                        <button
                          type="button"
                          onClick={() => void appendProductRows(product)}
                          className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                        >
                          Thêm tất cả SKU
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                          <tr>
                            <th className="px-3 py-2">SKU con</th>
                            <th className="px-3 py-2">Size</th>
                            <th className="px-3 py-2">Màu</th>
                            <th className="px-3 py-2">Tồn</th>
                            <th className="px-3 py-2 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!variants.length ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-neutral-500">
                                Sản phẩm này chưa có SKU con trong dữ liệu trả về.
                              </td>
                            </tr>
                          ) : null}

                          {variants.map((variant, index) => {
                            const sku = String(variant?.sku || `${product.slug || product.id || "SKU"}-${index + 1}`);
                            return (
                              <tr key={`${product.id || product.slug}:${sku}`} className="border-t border-neutral-100">
                                <td className="px-3 py-2 font-medium text-neutral-950">{sku}</td>
                                <td className="px-3 py-2">{variant?.size || "—"}</td>
                                <td className="px-3 py-2">{variant?.color || "—"}</td>
                                <td className="px-3 py-2">{stockOfVariant(variant)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void replaceDraftWithProduct(product, sku)}
                                      className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                                    >
                                      Chọn SKU này
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void appendProductRows(product, sku)}
                                      className="rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                                    >
                                      Thêm SKU
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {!loadingProducts && !productResults.length ? (
                <div className="p-8 text-center text-sm text-neutral-500">Chưa có sản phẩm phù hợp.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
