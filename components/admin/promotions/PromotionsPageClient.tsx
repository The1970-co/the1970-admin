"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPromotion,
  deletePromotion,
  getPromotions,
  PromotionDiscountType,
  PromotionPayload,
  PromotionType,
  updatePromotion,
} from "@/lib/promotions-api";
import {
  getPromotionBranches,
  searchPromotionProducts,
} from "@/lib/promotion-support-api";

type ProductOption = {
  id: string;
  name?: string | null;
  title?: string | null;
  sku?: string | null;
  code?: string | null;
  productCode?: string | null;
  variants?: Array<{
    sku?: string | null;
  }>;
};

type BranchOption = {
  id: string;
  name?: string | null;
  code?: string | null;
};

type Promotion = {
  id: string;
  name: string;
  type: PromotionType;
  status: "ACTIVE" | "INACTIVE";
  discountType: PromotionDiscountType;
  discountValue: string | number;
  minOrderAmount?: string | number | null;
  branchId?: string | null;
  salesChannel?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  priority: number;
  note?: string | null;
  branch?: BranchOption | null;
  products?: {
    productId?: string;
    product?: ProductOption;
  }[];
};

const money = new Intl.NumberFormat("vi-VN");

const SALES_CHANNELS = [
  { value: "", label: "Tất cả kênh" },
  { value: "POS", label: "POS bán tại quầy" },
  { value: "SHOWROOM", label: "Showroom" },
  { value: "VN_WEB", label: "Website VN" },
  { value: "INTL_WEB", label: "Website quốc tế" },
  { value: "FACEBOOK_MANUAL", label: "Facebook" },
  { value: "OTHER", label: "Khác" },
];

function getProductName(product?: ProductOption | null) {
  if (!product) return "Không rõ sản phẩm";
  return product.name || product.title || product.productCode || product.code || product.id;
}

function getProductSku(product?: ProductOption | null) {
  if (!product) return "";
  return (
    product.sku ||
    product.code ||
    product.productCode ||
    product.variants?.find((variant) => variant?.sku)?.sku ||
    ""
  );
}

function normalizeDateForInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function PromotionsPageClient() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [productKeyword, setProductKeyword] = useState("");
  const [productSearching, setProductSearching] = useState(false);
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<PromotionPayload>({
    name: "",
    type: "PRODUCT_DISCOUNT",
    status: "ACTIVE",
    discountType: "PERCENT",
    discountValue: 10,
    priority: 0,
    branchId: "",
    salesChannel: "",
    productIds: [],
  });

  const activeCount = useMemo(
    () => rows.filter((item) => item.status === "ACTIVE").length,
    [rows],
  );

  const productDiscountCount = useMemo(
    () => rows.filter((item) => item.type === "PRODUCT_DISCOUNT").length,
    [rows],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getPromotions();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được khuyến mại");
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches() {
    const data = await getPromotionBranches();
    setBranches(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
    loadBranches();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const keyword = productKeyword.trim();
      if (keyword.length < 2) {
        setProductResults([]);
        return;
      }

      setProductSearching(true);
      try {
        const data = await searchPromotionProducts(keyword);
        if (!cancelled) {
          setProductResults(Array.isArray(data) ? data : []);
        }
      } finally {
        if (!cancelled) setProductSearching(false);
      }
    }

    const timer = window.setTimeout(run, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [productKeyword]);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      type: "PRODUCT_DISCOUNT",
      status: "ACTIVE",
      discountType: "PERCENT",
      discountValue: 10,
      priority: 0,
      branchId: "",
      salesChannel: "",
      productIds: [],
    });
    setProductKeyword("");
    setProductResults([]);
    setSelectedProducts([]);
  }

  function selectProduct(product: ProductOption) {
    if (!product?.id) return;
    if (selectedProducts.some((item) => String(item.id) === String(product.id))) {
      return;
    }

    const nextSelected = [...selectedProducts, product];
    setSelectedProducts(nextSelected);
    setForm((prev) => ({
      ...prev,
      productIds: nextSelected.map((item) => String(item.id)),
    }));
  }

  function removeSelectedProduct(productId: string) {
    const nextSelected = selectedProducts.filter(
      (item) => String(item.id) !== String(productId),
    );
    setSelectedProducts(nextSelected);
    setForm((prev) => ({
      ...prev,
      productIds: nextSelected.map((item) => String(item.id)),
    }));
  }

  function editPromotion(row: Promotion) {
    const selected = (row.products ?? [])
      .map((item) => item.product)
      .filter(Boolean) as ProductOption[];

    setEditingId(row.id);
    setSelectedProducts(selected);
    setProductKeyword("");
    setProductResults([]);
    setForm({
      name: row.name,
      type: row.type,
      status: row.status,
      discountType: row.discountType,
      discountValue: Number(row.discountValue || 0),
      minOrderAmount:
        row.minOrderAmount === null || row.minOrderAmount === undefined
          ? undefined
          : Number(row.minOrderAmount || 0),
      branchId: row.branchId || "",
      salesChannel: row.salesChannel || "",
      startAt: normalizeDateForInput(row.startAt),
      endAt: normalizeDateForInput(row.endAt),
      priority: Number(row.priority || 0),
      note: row.note || "",
      productIds: selected.map((item) => String(item.id)),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateForm() {
    if (!form.name.trim()) return "Nhập tên khuyến mại";
    if (Number(form.discountValue || 0) <= 0) return "Giá trị giảm phải lớn hơn 0";
    if (form.discountType === "PERCENT" && Number(form.discountValue || 0) > 100) {
      return "Giảm theo % không được lớn hơn 100";
    }
    if (form.type === "PRODUCT_DISCOUNT" && !selectedProducts.length) {
      return "Khuyến mại theo sản phẩm phải chọn ít nhất 1 sản phẩm";
    }
    if (form.type === "ORDER_DISCOUNT" && Number(form.minOrderAmount || 0) < 0) {
      return "Đơn tối thiểu không hợp lệ";
    }
    if (form.startAt && form.endAt && new Date(form.startAt) > new Date(form.endAt)) {
      return "Ngày bắt đầu không được lớn hơn ngày kết thúc";
    }
    return "";
  }

  async function submit() {
    const message = validateForm();
    if (message) {
      alert(message);
      return;
    }

    const payload: PromotionPayload = {
      ...form,
      branchId: form.branchId || undefined,
      salesChannel: form.salesChannel || undefined,
      startAt: form.startAt || undefined,
      endAt: form.endAt || undefined,
      minOrderAmount:
        form.type === "ORDER_DISCOUNT" ? Number(form.minOrderAmount || 0) : undefined,
      productIds:
        form.type === "PRODUCT_DISCOUNT"
          ? selectedProducts.map((item) => String(item.id))
          : [],
    };

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updatePromotion(editingId, payload);
      } else {
        await createPromotion(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu khuyến mại thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: Promotion) {
    await updatePromotion(row.id, {
      status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Xoá khuyến mại này?")) return;
    await deletePromotion(id);
    await load();
  }

  function branchLabel(row: Promotion) {
    if (!row.branchId) return "Tất cả chi nhánh";
    return row.branch?.name || row.branch?.code || row.branchId;
  }

  function channelLabel(value?: string | null) {
    if (!value) return "Tất cả kênh";
    return SALES_CHANNELS.find((item) => item.value === value)?.label || value;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Tổng khuyến mại</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{rows.length}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Đang hoạt động</div>
          <div className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Giảm theo sản phẩm</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{productDiscountCount}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Cơ chế</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">
            Tự động áp dụng khi bán hàng
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? "Sửa khuyến mại" : "Tạo khuyến mại mới"}
            </h2>
            <p className="text-sm text-gray-500">
              Hỗ trợ giảm theo sản phẩm, giảm toàn đơn, chi nhánh, kênh bán và thời gian hiệu lực.
            </p>
          </div>

          {editingId ? (
            <button
              onClick={resetForm}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
            >
              Huỷ sửa
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Tên khuyến mại</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="VD: Sale polo hè 10%"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Loại</label>
            <select
              value={form.type}
              onChange={(event) => {
                const type = event.target.value as PromotionType;
                setForm((prev) => ({
                  ...prev,
                  type,
                  productIds: type === "PRODUCT_DISCOUNT" ? prev.productIds : [],
                }));
                if (type !== "PRODUCT_DISCOUNT") setSelectedProducts([]);
              }}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            >
              <option value="PRODUCT_DISCOUNT">Giảm theo sản phẩm</option>
              <option value="ORDER_DISCOUNT">Giảm toàn đơn</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Kiểu giảm</label>
            <select
              value={form.discountType}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  discountType: event.target.value as PromotionDiscountType,
                }))
              }
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            >
              <option value="PERCENT">Giảm %</option>
              <option value="FIXED_AMOUNT">Giảm tiền cố định</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Giá trị giảm</label>
            <input
              type="number"
              value={form.discountValue}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, discountValue: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>

          {form.type === "ORDER_DISCOUNT" ? (
            <div>
              <label className="text-sm font-medium text-gray-700">Đơn tối thiểu</label>
              <input
                type="number"
                value={form.minOrderAmount ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    minOrderAmount: Number(event.target.value),
                  }))
                }
                placeholder="VD: 500000"
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
              />
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-gray-700">Chi nhánh áp dụng</label>
            <select
              value={form.branchId || ""}
              onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.code || branch.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Kênh bán áp dụng</label>
            <select
              value={form.salesChannel || ""}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, salesChannel: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            >
              {SALES_CHANNELS.map((channel) => (
                <option key={channel.value || "ALL"} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Độ ưu tiên</label>
            <input
              type="number"
              value={form.priority ?? 0}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Bắt đầu</label>
            <input
              type="datetime-local"
              value={form.startAt || ""}
              onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Kết thúc</label>
            <input
              type="datetime-local"
              value={form.endAt || ""}
              onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
        </div>

        {form.type === "PRODUCT_DISCOUNT" ? (
          <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Sản phẩm áp dụng</label>
                <input
                  value={productKeyword}
                  onChange={(event) => setProductKeyword(event.target.value)}
                  placeholder="Gõ tên sản phẩm / SKU để tìm"
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-black"
                />
              </div>
              <div className="text-sm text-gray-500">
                Đã chọn <b className="text-gray-900">{selectedProducts.length}</b> sản phẩm
              </div>
            </div>

            {productSearching ? (
              <div className="mt-3 text-sm text-gray-500">Đang tìm sản phẩm...</div>
            ) : null}

            {productResults.length ? (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border bg-white">
                {productResults.map((product) => {
                  const selected = selectedProducts.some(
                    (item) => String(item.id) === String(product.id),
                  );
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      disabled={selected}
                      className="flex w-full items-center justify-between border-b px-4 py-3 text-left text-sm last:border-b-0 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-emerald-50"
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{getProductName(product)}</div>
                        <div className="text-xs text-gray-500">{getProductSku(product) || product.id}</div>
                      </div>
                      <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                        {selected ? "Đã chọn" : "Chọn"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : productKeyword.trim().length >= 2 && !productSearching ? (
              <div className="mt-3 rounded-xl border bg-white p-3 text-sm text-gray-500">
                Không thấy sản phẩm phù hợp. Nếu API sản phẩm của m dùng route khác, gửi tao file products-api để map đúng.
              </div>
            ) : null}

            {selectedProducts.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-900">{getProductName(product)}</span>
                    <span className="text-xs text-gray-500">{getProductSku(product)}</span>
                    <button
                      type="button"
                      onClick={() => removeSelectedProduct(String(product.id))}
                      className="text-xs font-bold text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700">Ghi chú</label>
          <textarea
            value={form.note ?? ""}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black"
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          {editingId ? (
            <button
              onClick={resetForm}
              className="rounded-xl border px-5 py-2 text-sm font-semibold text-gray-700"
            >
              Huỷ
            </button>
          ) : null}
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : editingId ? "Lưu khuyến mại" : "Tạo khuyến mại"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-bold text-gray-900">Danh sách khuyến mại</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Tên</th>
                <th className="px-5 py-3">Loại</th>
                <th className="px-5 py-3">Giảm</th>
                <th className="px-5 py-3">Điều kiện</th>
                <th className="px-5 py-3">Phạm vi</th>
                <th className="px-5 py-3">Thời gian</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Ưu tiên</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center">
                    Đang tải...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center">
                    Chưa có khuyến mại
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{row.name}</div>
                      {row.note ? <div className="mt-1 text-xs text-gray-500">{row.note}</div> : null}
                    </td>
                    <td className="px-5 py-4">
                      {row.type === "PRODUCT_DISCOUNT" ? "Giảm sản phẩm" : "Giảm toàn đơn"}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {row.discountType === "PERCENT"
                        ? `${row.discountValue}%`
                        : `${money.format(Number(row.discountValue))}đ`}
                    </td>
                    <td className="px-5 py-4">
                      {row.type === "ORDER_DISCOUNT" ? (
                        `Đơn từ ${money.format(Number(row.minOrderAmount ?? 0))}đ`
                      ) : (
                        <div>
                          <div>{row.products?.length ?? 0} sản phẩm</div>
                          <div className="mt-1 max-w-[260px] text-xs text-gray-500">
                            {(row.products ?? [])
                              .slice(0, 3)
                              .map((item) => getProductName(item.product))
                              .join(", ")}
                            {(row.products?.length ?? 0) > 3 ? "..." : ""}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div>{branchLabel(row)}</div>
                      <div className="mt-1 text-xs text-gray-500">{channelLabel(row.salesChannel)}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      <div>{row.startAt ? new Date(row.startAt).toLocaleString("vi-VN") : "Không giới hạn"}</div>
                      <div className="mt-1">→ {row.endAt ? new Date(row.endAt).toLocaleString("vi-VN") : "Không giới hạn"}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          row.status === "ACTIVE"
                            ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                            : "rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600"
                        }
                      >
                        {row.status === "ACTIVE" ? "Đang chạy" : "Tạm tắt"}
                      </span>
                    </td>
                    <td className="px-5 py-4">{row.priority}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => editPromotion(row)}
                        className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => toggleStatus(row)}
                        className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      >
                        {row.status === "ACTIVE" ? "Tắt" : "Bật"}
                      </button>
                      <button
                        onClick={() => remove(row.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
