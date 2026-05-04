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
import { getCurrentUserFromStorage } from "@/lib/current-user";

type ProductOption = {
  id: string;
  name?: string | null;
  title?: string | null;
  sku?: string | null;
  code?: string | null;
  productCode?: string | null;
  imageUrl?: string | null;
  price?: string | number | null;
  variants?: Array<{
    sku?: string | null;
    price?: string | number | null;
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
  { value: "ADMIN", label: "Admin tạo đơn" },
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

function getProductPrice(product?: ProductOption | null) {
  const raw = product?.price ?? product?.variants?.find((variant) => variant?.price)?.price ?? 0;
  return Number(raw || 0);
}

function normalizeDateForInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function userRoles(user: any) {
  return [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
    user?.roleCode,
  ]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);
}

function isAdminOrOwner(user: any) {
  const roles = userRoles(user);
  return roles.includes("admin") || roles.includes("owner");
}

function getStatusMeta(row: Promotion) {
  const now = Date.now();
  const start = row.startAt ? new Date(row.startAt).getTime() : null;
  const end = row.endAt ? new Date(row.endAt).getTime() : null;

  if (row.status !== "ACTIVE") {
    return {
      label: "Tạm tắt",
      className: "bg-neutral-100 text-neutral-600 border-neutral-200",
      dot: "bg-neutral-400",
      tone: "neutral",
    };
  }

  if (start && start > now) {
    return {
      label: "Chờ chạy",
      className: "bg-blue-50 text-blue-700 border-blue-100",
      dot: "bg-blue-500",
      tone: "blue",
    };
  }

  if (end && end < now) {
    return {
      label: "Hết hạn",
      className: "bg-red-50 text-red-700 border-red-100",
      dot: "bg-red-500",
      tone: "red",
    };
  }

  if (end) {
    const hoursLeft = (end - now) / 36e5;
    if (hoursLeft <= 72) {
      return {
        label: "Sắp hết hạn",
        className: "bg-amber-50 text-amber-700 border-amber-100",
        dot: "bg-amber-500",
        tone: "amber",
      };
    }
  }

  return {
    label: "Đang chạy",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    dot: "bg-emerald-500",
    tone: "emerald",
  };
}

function getTimeProgress(row: Promotion) {
  if (!row.startAt || !row.endAt) return null;
  const start = new Date(row.startAt).getTime();
  const end = new Date(row.endAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

function formatDiscount(row: Pick<Promotion, "discountType" | "discountValue">) {
  return row.discountType === "PERCENT"
    ? `${Number(row.discountValue || 0)}%`
    : `${money.format(Number(row.discountValue || 0))}đ`;
}

function safeDate(value?: string | null) {
  if (!value) return "Không giới hạn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không hợp lệ";
  return date.toLocaleString("vi-VN");
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[26px] border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export default function PromotionsPageClient() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const adminMode = isAdminOrOwner(currentUser);

  const [productKeyword, setProductKeyword] = useState("");
  const [productSearching, setProductSearching] = useState(false);
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | PromotionType>("ALL");

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

  useEffect(() => {
    setCurrentUser(getCurrentUserFromStorage());
  }, []);

  const activeCount = useMemo(
    () => rows.filter((item) => item.status === "ACTIVE").length,
    [rows],
  );

  const productDiscountCount = useMemo(
    () => rows.filter((item) => item.type === "PRODUCT_DISCOUNT").length,
    [rows],
  );

  const orderDiscountCount = useMemo(
    () => rows.filter((item) => item.type === "ORDER_DISCOUNT").length,
    [rows],
  );

  const expiringSoonCount = useMemo(() => {
    return rows.filter((row) => getStatusMeta(row).label === "Sắp hết hạn").length;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && row.type !== typeFilter) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter]);

  const selectedProductPreview = useMemo(() => {
    const first = selectedProducts[0];
    if (!first) return null;
    const price = getProductPrice(first) || 520000;
    const discount = form.discountType === "PERCENT"
      ? Math.round((price * Number(form.discountValue || 0)) / 100)
      : Number(form.discountValue || 0);
    return {
      name: getProductName(first),
      before: price,
      discount: Math.min(discount, price),
      after: Math.max(0, price - Math.min(discount, price)),
    };
  }, [selectedProducts, form.discountType, form.discountValue]);

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
    if (selectedProducts.some((item) => String(item.id) === String(product.id))) return;

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
    setFormOpen(true);
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
      if (editingId) await updatePromotion(editingId, payload);
      else await createPromotion(payload);
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
    if (!adminMode) {
      alert("Chỉ admin/owner được xoá khuyến mại.");
      return;
    }
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

  const typeLabel = (type: PromotionType) => type === "PRODUCT_DISCOUNT" ? "Giảm sản phẩm" : "Giảm toàn đơn";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-400">
            Promotion Center V3
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            Điều khiển khuyến mại tự động
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Nhân viên dùng chế độ cơ bản. Admin/Owner thấy thêm insight và công cụ nâng cao.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormOpen((value) => !value)}
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            {formOpen ? "Thu gọn form" : "Tạo khuyến mại"}
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-neutral-500">Tổng khuyến mại</div>
          <div className="mt-2 text-3xl font-bold text-neutral-950">{rows.length}</div>
          <div className="mt-2 text-xs text-neutral-400">Rule đang có trong hệ thống</div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-neutral-500">Đang hoạt động</div>
          <div className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</div>
          <div className="mt-2 text-xs text-neutral-400">Tự áp dụng khi bán hàng</div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-neutral-500">Giảm theo sản phẩm</div>
          <div className="mt-2 text-3xl font-bold text-neutral-950">{productDiscountCount}</div>
          <div className="mt-2 text-xs text-neutral-400">Rule gắn trực tiếp sản phẩm</div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-neutral-500">Cơ chế</div>
          <div className="mt-2 text-lg font-semibold text-neutral-950">Auto apply</div>
          <div className="mt-2 text-xs text-emerald-600">POS + tạo đơn đều preview realtime</div>
        </Card>
      </div>

      {adminMode ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
                  Admin Insight
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950">
                  Tổng quan sức khoẻ khuyến mại
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Đây là khu nâng cao chỉ admin/owner thấy. Dữ liệu hiệu quả doanh thu sẽ nối thêm ở V3 tiếp theo.
                </p>
              </div>
              <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                Admin only
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs text-neutral-500">Rule toàn đơn</div>
                <div className="mt-2 text-2xl font-bold">{orderDiscountCount}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs text-neutral-500">Sắp hết hạn</div>
                <div className="mt-2 text-2xl font-bold text-amber-700">{expiringSoonCount}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs text-neutral-500">Stacking</div>
                <div className="mt-2 text-sm font-semibold text-neutral-900">Theo priority</div>
                <div className="mt-1 text-xs text-neutral-500">Backend apply lại khi submit</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Control
            </p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">V3 nâng cao</h2>
            <div className="mt-4 space-y-2 text-sm text-neutral-600">
              <div className="rounded-2xl bg-neutral-50 p-3">Chuẩn bị: báo cáo số đơn áp dụng KM</div>
              <div className="rounded-2xl bg-neutral-50 p-3">Chuẩn bị: doanh thu do KM tạo ra</div>
              <div className="rounded-2xl bg-neutral-50 p-3">Chuẩn bị: cảnh báo rule trùng / đốt margin</div>
            </div>
          </Card>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {formOpen ? (
        <Card className="overflow-hidden">
          <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
                  Basic Builder
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-950">
                  {editingId ? "Sửa khuyến mại" : "Tạo khuyến mại mới"}
                </h2>
                <p className="text-sm text-neutral-500">
                  Nhân viên chỉ dùng phần cơ bản này: sản phẩm/toàn đơn, phạm vi, thời gian.
                </p>
              </div>

              {editingId ? (
                <button
                  onClick={resetForm}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
                >
                  Huỷ sửa
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="text-sm font-medium text-neutral-700">Tên khuyến mại</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="VD: Sale polo hè 10%"
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700">Loại</label>
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
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  >
                    <option value="PRODUCT_DISCOUNT">Giảm theo sản phẩm</option>
                    <option value="ORDER_DISCOUNT">Giảm toàn đơn</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700">Kiểu giảm</label>
                  <select
                    value={form.discountType}
                    onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value as PromotionDiscountType }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  >
                    <option value="PERCENT">Giảm %</option>
                    <option value="FIXED_AMOUNT">Giảm tiền cố định</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700">Giá trị giảm</label>
                  <input
                    type="number"
                    value={form.discountValue}
                    onChange={(event) => setForm((prev) => ({ ...prev, discountValue: Number(event.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>

                {form.type === "ORDER_DISCOUNT" ? (
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Đơn tối thiểu</label>
                    <input
                      type="number"
                      value={form.minOrderAmount ?? ""}
                      onChange={(event) => setForm((prev) => ({ ...prev, minOrderAmount: Number(event.target.value) }))}
                      placeholder="VD: 500000"
                      className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="text-sm font-medium text-neutral-700">Chi nhánh áp dụng</label>
                  <select
                    value={form.branchId || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
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
                  <label className="text-sm font-medium text-neutral-700">Kênh bán áp dụng</label>
                  <select
                    value={form.salesChannel || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, salesChannel: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  >
                    {SALES_CHANNELS.map((channel) => (
                      <option key={channel.value || "ALL"} value={channel.value}>{channel.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700">Bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={form.startAt || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700">Kết thúc</label>
                  <input
                    type="datetime-local"
                    value={form.endAt || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                  />
                </div>

                {adminMode ? (
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Độ ưu tiên</label>
                    <input
                      type="number"
                      value={form.priority ?? 0}
                      onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))}
                      className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                    />
                  </div>
                ) : null}
              </div>

              {form.type === "PRODUCT_DISCOUNT" ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-neutral-700">Sản phẩm áp dụng</label>
                      <input
                        value={productKeyword}
                        onChange={(event) => setProductKeyword(event.target.value)}
                        placeholder="Gõ tên sản phẩm / SKU để tìm"
                        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div className="text-sm text-neutral-500">
                      Đã chọn <b className="text-neutral-950">{selectedProducts.length}</b> sản phẩm
                    </div>
                  </div>

                  {productSearching ? <div className="mt-3 text-sm text-neutral-500">Đang tìm sản phẩm...</div> : null}

                  {productResults.length ? (
                    <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
                      {productResults.map((product) => {
                        const selected = selectedProducts.some((item) => String(item.id) === String(product.id));
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => selectProduct(product)}
                            disabled={selected}
                            className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-emerald-50"
                          >
                            <div>
                              <div className="font-semibold text-neutral-950">{getProductName(product)}</div>
                              <div className="text-xs text-neutral-500">{getProductSku(product) || product.id}</div>
                            </div>
                            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold">
                              {selected ? "Đã chọn" : "Chọn"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : productKeyword.trim().length >= 2 && !productSearching ? (
                    <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-500">
                      Không thấy sản phẩm phù hợp.
                    </div>
                  ) : null}

                  {selectedProducts.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedProducts.map((product) => (
                        <div key={product.id} className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm">
                          <span className="font-medium text-neutral-950">{getProductName(product)}</span>
                          <span className="text-xs text-neutral-500">{getProductSku(product)}</span>
                          <button type="button" onClick={() => removeSelectedProduct(String(product.id))} className="text-xs font-bold text-red-600">×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-neutral-700">Ghi chú</label>
                <textarea
                  value={form.note ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-950 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Preview</p>
                <h3 className="mt-2 text-lg font-semibold">Khuyến mại sẽ hoạt động thế nào?</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="text-neutral-400">Loại</span>
                    <span className="font-semibold">{typeLabel(form.type)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="text-neutral-400">Mức giảm</span>
                    <span className="font-semibold">{formatDiscount({ discountType: form.discountType, discountValue: form.discountValue })}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <span className="text-neutral-400">Phạm vi</span>
                    <span className="font-semibold text-right">{form.branchId ? branches.find((b) => b.id === form.branchId)?.name || form.branchId : "Tất cả chi nhánh"}</span>
                  </div>
                  {selectedProductPreview ? (
                    <div className="rounded-2xl bg-white/10 p-3">
                      <div className="text-xs text-neutral-300">Ví dụ sản phẩm</div>
                      <div className="mt-1 font-semibold">{selectedProductPreview.name}</div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span>{money.format(selectedProductPreview.before)}đ</span>
                        <span className="text-emerald-300">-{money.format(selectedProductPreview.discount)}đ</span>
                        <span>{money.format(selectedProductPreview.after)}đ</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {adminMode ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="font-semibold">Admin note</div>
                  <p className="mt-1">Priority cao hơn sẽ được tính trước. V3 sau sẽ thêm giới hạn lượt dùng, margin guard và báo cáo hiệu quả.</p>
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                {editingId ? (
                  <button onClick={resetForm} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700">Huỷ</button>
                ) : null}
                <button
                  onClick={submit}
                  disabled={saving}
                  className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : editingId ? "Lưu khuyến mại" : "Tạo khuyến mại"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Promotion list</p>
              <h2 className="mt-1 text-lg font-bold text-neutral-950">Danh sách khuyến mại</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as any)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Tạm tắt</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as any)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="ALL">Tất cả loại</option>
                <option value="PRODUCT_DISCOUNT">Giảm sản phẩm</option>
                <option value="ORDER_DISCOUNT">Giảm toàn đơn</option>
              </select>
              {adminMode ? (
                <button type="button" onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold">
                  {viewMode === "cards" ? "Xem bảng" : "Xem card"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-500">Đang tải...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">Chưa có khuyến mại phù hợp</div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {filteredRows.map((row) => {
              const status = getStatusMeta(row);
              const progress = getTimeProgress(row);
              return (
                <div key={row.id} className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{typeLabel(row.type)}</span>
                      </div>
                      <h3 className="mt-3 truncate text-lg font-semibold text-neutral-950">{row.name}</h3>
                      {row.note ? <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{row.note}</p> : null}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-neutral-950">{formatDiscount(row)}</div>
                      <div className="text-xs text-neutral-500">Priority {row.priority}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-neutral-50 p-3">
                      <div className="text-xs text-neutral-500">Điều kiện</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">
                        {row.type === "ORDER_DISCOUNT" ? `Đơn từ ${money.format(Number(row.minOrderAmount ?? 0))}đ` : `${row.products?.length ?? 0} sản phẩm`}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-3">
                      <div className="text-xs text-neutral-500">Chi nhánh</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{branchLabel(row)}</div>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-3">
                      <div className="text-xs text-neutral-500">Kênh</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{channelLabel(row.salesChannel)}</div>
                    </div>
                  </div>

                  {row.type === "PRODUCT_DISCOUNT" ? (
                    <div className="mt-4 text-xs text-neutral-500">
                      {(row.products ?? []).slice(0, 3).map((item) => getProductName(item.product)).join(", ")}
                      {(row.products?.length ?? 0) > 3 ? "..." : ""}
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs text-neutral-500">
                    {safeDate(row.startAt)} → {safeDate(row.endAt)}
                  </div>

                  {progress !== null ? (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-neutral-900" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">Đã đi qua {progress}% thời gian chạy</div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button onClick={() => editPromotion(row)} className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold">Sửa</button>
                    <button onClick={() => toggleStatus(row)} className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold">{row.status === "ACTIVE" ? "Tắt" : "Bật"}</button>
                    {adminMode ? <button onClick={() => remove(row.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Xoá</button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
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
                {filteredRows.map((row) => {
                  const status = getStatusMeta(row);
                  return (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-5 py-4"><div className="font-semibold text-neutral-950">{row.name}</div>{row.note ? <div className="mt-1 text-xs text-neutral-500">{row.note}</div> : null}</td>
                      <td className="px-5 py-4">{typeLabel(row.type)}</td>
                      <td className="px-5 py-4 font-semibold">{formatDiscount(row)}</td>
                      <td className="px-5 py-4">{row.type === "ORDER_DISCOUNT" ? `Đơn từ ${money.format(Number(row.minOrderAmount ?? 0))}đ` : `${row.products?.length ?? 0} sản phẩm`}</td>
                      <td className="px-5 py-4"><div>{branchLabel(row)}</div><div className="mt-1 text-xs text-neutral-500">{channelLabel(row.salesChannel)}</div></td>
                      <td className="px-5 py-4 text-xs text-neutral-600"><div>{safeDate(row.startAt)}</div><div className="mt-1">→ {safeDate(row.endAt)}</div></td>
                      <td className="px-5 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                      <td className="px-5 py-4">{row.priority}</td>
                      <td className="px-5 py-4 text-right"><button onClick={() => editPromotion(row)} className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold">Sửa</button><button onClick={() => toggleStatus(row)} className="mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold">{row.status === "ACTIVE" ? "Tắt" : "Bật"}</button>{adminMode ? <button onClick={() => remove(row.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">Xoá</button> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
