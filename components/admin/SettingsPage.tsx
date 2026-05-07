"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import PrintTemplatesTab from "@/components/admin/settings/PrintTemplatesTab";

type SettingsTab =
  | "warehouses"
  | "shipping"
  | "mapping"
  | "printing"
  | "paymentSources"
  | "salesChannels"
  | "security";

type WarehouseItem = {
  id: string;
  code: string;
  name: string;
  type: "STORE" | "ONLINE" | "MAIN";
  address: string;
  manager: string;
  phone: string;
  isActive: boolean;
  allowRetailSale: boolean;
  allowOnlineAllocation: boolean;
  note: string;
  email?: string;
};

type ShippingProviderItem = {
  id: string;
  code: string;
  name: string;
  mode: "SANDBOX" | "PRODUCTION";
  apiKey: string;
  shopId: string;
  isConnected: boolean;
  isActive: boolean;
  note: string;
};

type PaymentSourceItem = {
  id: string;
  code: string;
  name: string;
  type: "CASH" | "BANK" | "CARD" | "COD" | "PARTIAL" | "EXCHANGE" | "OTHER";
  branchId?: string | null;
  isActive: boolean;
  sortOrder: number;
  note?: string | null;
};

type SalesChannelItem = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  note?: string;
};

const SALES_CHANNELS_STORAGE_KEY = "the1970_sales_channels";

const defaultSalesChannels: SalesChannelItem[] = [
  {
    id: "facebook_manual",
    code: "FACEBOOK_MANUAL",
    name: "Facebook",
    isActive: true,
    sortOrder: 10,
    note: "Đơn chốt tay từ Facebook",
  },
  {
    id: "pos",
    code: "POS",
    name: "POS",
    isActive: true,
    sortOrder: 20,
    note: "Bán tại quầy",
  },
  {
    id: "showroom",
    code: "SHOWROOM",
    name: "Showroom",
    isActive: true,
    sortOrder: 30,
    note: "Đơn showroom",
  },
  {
    id: "vn_web",
    code: "VN_WEB",
    name: "Website VN",
    isActive: true,
    sortOrder: 40,
    note: "Website Việt Nam",
  },
];

function normalizeSalesChannelCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

type OperationMapping = {
  webDefaultWarehouseId: string;
  facebookDefaultWarehouseId: string;
  tiktokDefaultWarehouseId: string;
  defaultCodProviderId: string;
  defaultInnerCityProviderId: string;
};

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "danger"
        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${state} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-600 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Panel>
      <div className="p-5">
        <p className="text-sm text-neutral-500">{title}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">
          {value}
        </p>
        <p className="mt-2 text-sm text-neutral-400">{sub}</p>
      </div>
    </Panel>
  );
}

const shippingSeed: ShippingProviderItem[] = [
  {
    id: "s1",
    code: "GHTK",
    name: "Giao Hàng Tiết Kiệm",
    mode: "SANDBOX",
    apiKey: "",
    shopId: "",
    isConnected: false,
    isActive: true,
    note: "Chưa nối token",
  },
  {
    id: "s2",
    code: "GHN",
    name: "Giao Hàng Nhanh",
    mode: "SANDBOX",
    apiKey: "",
    shopId: "",
    isConnected: false,
    isActive: true,
    note: "Chưa nối token",
  },
  {
    id: "s3",
    code: "AHAMOVE",
    name: "Ahamove",
    mode: "SANDBOX",
    apiKey: "",
    shopId: "",
    isConnected: false,
    isActive: false,
    note: "Để cho nội thành sau",
  },
];

const mappingSeed: OperationMapping = {
  webDefaultWarehouseId: "",
  facebookDefaultWarehouseId: "",
  tiktokDefaultWarehouseId: "",
  defaultCodProviderId: "s1",
  defaultInnerCityProviderId: "s3",
};

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("warehouses");
  const [message, setMessage] = useState("");
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  const [shippingProviders, setShippingProviders] =
    useState<ShippingProviderItem[]>(shippingSeed);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    shippingSeed[0].id
  );

  const [mapping, setMapping] = useState<OperationMapping>(mappingSeed);

  const [paymentSources, setPaymentSources] = useState<PaymentSourceItem[]>([]);
  const [paymentSourceForm, setPaymentSourceForm] = useState({
    code: "",
    name: "",
    type: "CASH" as PaymentSourceItem["type"],
    branchId: "",
    sortOrder: 0,
    note: "",
  });
  const [savingPaymentSource, setSavingPaymentSource] = useState(false);

  const [salesChannels, setSalesChannels] = useState<SalesChannelItem[]>([]);
  const [salesChannelForm, setSalesChannelForm] = useState({
    code: "",
    name: "",
    sortOrder: 0,
    note: "",
  });

  const [totpSetupData, setTotpSetupData] = useState<any>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpVerifying, setTotpVerifying] = useState(false);
  const [totpMessage, setTotpMessage] = useState("");
  const [totpError, setTotpError] = useState("");

  const [newWarehouse, setNewWarehouse] = useState<Omit<WarehouseItem, "id">>({
    code: "",
    name: "",
    type: "STORE",
    address: "",
    manager: "",
    phone: "",
    isActive: true,
    allowRetailSale: true,
    allowOnlineAllocation: true,
    note: "",
  });

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0],
    [warehouses, selectedWarehouseId]
  );

  const selectedProvider = useMemo(
    () =>
      shippingProviders.find((p) => p.id === selectedProviderId) ||
      shippingProviders[0],
    [shippingProviders, selectedProviderId]
  );

  const activeWarehouses = warehouses.filter((w) => w.isActive).length;
  const activeProviders = shippingProviders.filter((p) => p.isActive).length;
  const connectedProviders = shippingProviders.filter(
    (p) => p.isConnected
  ).length;

  const loadBranches = async () => {
    try {
      const data = await apiJson<any[]>("/branches");

      const mapped: WarehouseItem[] = Array.isArray(data)
        ? data.map((b) => ({
          id: String(b.id),
          code: String(b.id),
          name: String(b.name || b.id),
          type: "STORE",
          address: String(b.address || ""),
          manager: "",
          phone: String(b.phone || ""),
          isActive: Boolean(
            typeof b.isActive === "boolean" ? b.isActive : true
          ),
          allowRetailSale: true,
          allowOnlineAllocation: true,
          note: "",
        }))
        : [];

      setWarehouses(mapped);

      setSelectedWarehouseId((prev) => {
        if (prev && mapped.some((w) => w.id === prev)) return prev;
        return mapped[0]?.id || "";
      });

      setMapping((prev) => ({
        ...prev,
        webDefaultWarehouseId:
          prev.webDefaultWarehouseId || mapped[0]?.id || "",
        facebookDefaultWarehouseId:
          prev.facebookDefaultWarehouseId || mapped[0]?.id || "",
        tiktokDefaultWarehouseId:
          prev.tiktokDefaultWarehouseId || mapped[0]?.id || "",
      }));
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không load được danh sách kho."
      );
    }
  };

  useEffect(() => {
    void loadBranches();
    void loadPaymentSources();
    loadSalesChannels();
  }, []);

  const loadSalesChannels = () => {
    try {
      const raw = localStorage.getItem(SALES_CHANNELS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const list = Array.isArray(parsed) && parsed.length ? parsed : defaultSalesChannels;
      setSalesChannels(
        list
          .map((item: any, index: number) => ({
            id: String(item.id || item.code || `channel_${index}`),
            code: normalizeSalesChannelCode(item.code || item.id || ""),
            name: String(item.name || item.code || ""),
            isActive: typeof item.isActive === "boolean" ? item.isActive : true,
            sortOrder: Number(item.sortOrder || index + 1),
            note: String(item.note || ""),
          }))
          .filter((item: SalesChannelItem) => item.code && item.name)
          .sort((a: SalesChannelItem, b: SalesChannelItem) => a.sortOrder - b.sortOrder)
      );
    } catch {
      setSalesChannels(defaultSalesChannels);
    }
  };

  const saveSalesChannels = (items: SalesChannelItem[]) => {
    const cleaned = [...items]
      .map((item, index) => ({
        ...item,
        code: normalizeSalesChannelCode(item.code),
        name: String(item.name || "").trim(),
        sortOrder: Number(item.sortOrder || index + 1),
      }))
      .filter((item) => item.code && item.name)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    setSalesChannels(cleaned);
    localStorage.setItem(SALES_CHANNELS_STORAGE_KEY, JSON.stringify(cleaned));
    setMessage("Đã lưu kênh bán. Màn tạo đơn sẽ dùng danh sách này.");
  };

  const createSalesChannel = () => {
    const code = normalizeSalesChannelCode(salesChannelForm.code);
    const name = salesChannelForm.name.trim();

    if (!code || !name) {
      setMessage("Thiếu mã kênh bán hoặc tên hiển thị.");
      return;
    }

    if (salesChannels.some((item) => item.code === code)) {
      setMessage("Mã kênh bán đã tồn tại.");
      return;
    }

    const next: SalesChannelItem = {
      id: `${code.toLowerCase()}_${Date.now()}`,
      code,
      name,
      isActive: true,
      sortOrder: Number(salesChannelForm.sortOrder || salesChannels.length + 1),
      note: salesChannelForm.note.trim(),
    };

    saveSalesChannels([...salesChannels, next]);
    setSalesChannelForm({
      code: "",
      name: "",
      sortOrder: 0,
      note: "",
    });
  };

  const updateSalesChannel = (
    id: string,
    patch: Partial<SalesChannelItem>
  ) => {
    saveSalesChannels(
      salesChannels.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              code:
                patch.code !== undefined
                  ? normalizeSalesChannelCode(patch.code)
                  : item.code,
            }
          : item
      )
    );
  };

  const deleteSalesChannel = (id: string) => {
    saveSalesChannels(salesChannels.filter((item) => item.id !== id));
  };
  const loadPaymentSources = async () => {
    try {
      const data = await apiJson<PaymentSourceItem[]>("/payment-sources");
      setPaymentSources(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Không load được nguồn tiền."
      );
    }
  };

  const createPaymentSource = async () => {
    if (!paymentSourceForm.code.trim() || !paymentSourceForm.name.trim()) {
      setMessage("Thiếu mã nguồn tiền hoặc tên hiển thị.");
      return;
    }

    try {
      setSavingPaymentSource(true);
      setMessage("");

      await apiJson("/payment-sources", {
        method: "POST",
        body: JSON.stringify({
          code: paymentSourceForm.code.trim(),
          name: paymentSourceForm.name.trim(),
          type: paymentSourceForm.type,
          branchId: paymentSourceForm.branchId || null,
          sortOrder: Number(paymentSourceForm.sortOrder || 0),
          note: paymentSourceForm.note.trim() || null,
        }),
      });

      setPaymentSourceForm({
        code: "",
        name: "",
        type: "CASH",
        branchId: "",
        sortOrder: 0,
        note: "",
      });

      await loadPaymentSources();
      setMessage("Đã thêm nguồn tiền.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Tạo nguồn tiền thất bại.");
    } finally {
      setSavingPaymentSource(false);
    }
  };
  const saveWarehouseDetail = <K extends keyof WarehouseItem>(
    field: K,
    value: WarehouseItem[K]
  ) => {
    if (!selectedWarehouse) return;

    setWarehouses((prev) =>
      prev.map((w) =>
        w.id === selectedWarehouse.id ? { ...w, [field]: value } : w
      )
    );
    setMessage("");
  };

  const saveWarehouseToDb = async () => {
    if (!selectedWarehouseId) return;

    const latestWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
    if (!latestWarehouse) return;

    const newId = latestWarehouse.code.trim();
    const newName = latestWarehouse.name.trim();

    if (!newId) {
      setMessage("Thiếu mã kho.");
      return;
    }

    if (!newName) {
      setMessage("Thiếu tên kho.");
      return;
    }

    try {
      setSavingWarehouse(true);
      setMessage("");

      await apiJson(`/branches/${latestWarehouse.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          newId,
          name: newName,
          address: latestWarehouse.address?.trim() || "",
          phone: latestWarehouse.phone?.trim() || "",
          email: latestWarehouse.email?.trim() || "",
        }),
      });

      await loadBranches();
      setSelectedWarehouseId(newId);
      setMessage("Đã lưu thay đổi kho vào database.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Lưu thay đổi kho thất bại."
      );
    } finally {
      setSavingWarehouse(false);
    }
  };

const addWarehouse = async () => {
  if (!newWarehouse.code.trim() || !newWarehouse.name.trim()) {
    setMessage("Thiếu mã kho hoặc tên kho.");
    return;
  }

  try {
    await apiJson("/branches", {
      method: "POST",
      body: JSON.stringify({
        id: newWarehouse.code.trim(),
        name: newWarehouse.name.trim(),
        address: newWarehouse.address?.trim() || "",
        phone: newWarehouse.phone?.trim() || "",
      }),
    });

    await loadBranches();
    setSelectedWarehouseId(newWarehouse.code.trim());

    setNewWarehouse({
      code: "",
      name: "",
      type: "STORE",
      address: "",
      manager: "",
      phone: "",
      isActive: true,
      allowRetailSale: true,
      allowOnlineAllocation: true,
      note: "",
    });

    setMessage("Đã thêm kho mới vào database.");
  } catch (err) {
    setMessage(err instanceof Error ? err.message : "Tạo kho thất bại.");
  }
};

  const toggleWarehouse = async (warehouseId: string) => {
    try {
      await apiJson(`/branches/${warehouseId}/deactivate`, {
        method: "PATCH",
      });

      await loadBranches();
      setMessage("Đã đổi trạng thái kho.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Đổi trạng thái kho thất bại."
      );
    }
  };

  const deleteWarehouse = (warehouseId: string) => {
    const isUsedInMapping =
      mapping.webDefaultWarehouseId === warehouseId ||
      mapping.facebookDefaultWarehouseId === warehouseId ||
      mapping.tiktokDefaultWarehouseId === warehouseId;

    if (isUsedInMapping) {
      setMessage("Kho này đang được dùng trong mapping vận hành, chưa thể xóa.");
      return;
    }

    setMessage("Hiện chưa nối API xóa kho. Tạm dùng deactivate.");
  };

  const saveProviderDetail = <K extends keyof ShippingProviderItem>(
    field: K,
    value: ShippingProviderItem[K]
  ) => {
    if (!selectedProvider) return;
    setShippingProviders((prev) =>
      prev.map((p) =>
        p.id === selectedProvider.id ? { ...p, [field]: value } : p
      )
    );
    setMessage("Đã cập nhật hãng vận chuyển.");
  };

  const testProviderConnection = () => {
    if (!selectedProvider) return;
    setShippingProviders((prev) =>
      prev.map((p) =>
        p.id === selectedProvider.id
          ? { ...p, isConnected: !!p.apiKey && !!p.shopId }
          : p
      )
    );
    setMessage("Đã test kết nối local.");
  };

  const saveMapping = <K extends keyof OperationMapping>(
    key: K,
    value: OperationMapping[K]
  ) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
    setMessage("Đã lưu mapping vận hành.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Cấu hình
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Quản lý kho, hãng vận chuyển, mapping vận hành và mẫu in mặc định.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          title="Tổng kho"
          value={warehouses.length}
          sub="Bao gồm kho cửa hàng và kho online"
        />
        <StatCard
          title="Kho đang hoạt động"
          value={activeWarehouses}
          sub="Được dùng trong hệ thống"
        />
        <StatCard
          title="Hãng vận chuyển bật"
          value={activeProviders}
          sub="Có thể dùng để đẩy đơn"
        />
        <StatCard
          title="Đã kết nối"
          value={connectedProviders}
          sub="Test local token / shop id"
        />
      </div>

      {message ? (
        <Panel className="px-5 py-4">
          <p className="text-sm text-neutral-700">{message}</p>
        </Panel>
      ) : null}

      <Panel>
        <div className="flex flex-wrap gap-2 p-4">
          <button
            onClick={() => setTab("warehouses")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "warehouses"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Kho hàng
          </button>
          <button
            onClick={() => setTab("shipping")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "shipping"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Hãng vận chuyển
          </button>
          <button
            onClick={() => setTab("mapping")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "mapping"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Mapping vận hành
          </button>
          <button
            onClick={() => setTab("printing")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "printing"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Mẫu in
          </button>
          <button
            onClick={() => setTab("paymentSources")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "paymentSources"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Nguồn tiền
          </button>

          <button
            onClick={() => setTab("salesChannels")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "salesChannels"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Kênh bán
          </button>

          <button
            onClick={() => setTab("security")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "security"
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 bg-white text-neutral-700"
              }`}
          >
            Bảo mật
          </button>
        </div>

      </Panel>

      {tab === "warehouses" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <Panel className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900">
                    Danh sách kho
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Chọn kho để chỉnh chi tiết và bật / tắt vai trò vận hành.
                  </p>
                </div>
                <Badge tone="blue">Warehouse config</Badge>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-200 text-sm text-neutral-400">
                      <th className="pb-3 font-medium">Kho</th>
                      <th className="pb-3 font-medium">Loại</th>
                      <th className="pb-3 font-medium">Online</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((warehouse) => (
                      <tr
                        key={warehouse.id}
                        onClick={() => setSelectedWarehouseId(warehouse.id)}
                        className={`cursor-pointer border-b border-neutral-100 transition ${selectedWarehouseId === warehouse.id
                          ? "bg-neutral-50"
                          : "hover:bg-neutral-50"
                          }`}
                      >
                        <td className="py-4">
                          <div className="font-medium text-neutral-900">
                            {warehouse.name}
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {warehouse.code}
                          </div>
                        </td>
                        <td className="py-4 text-sm text-neutral-700">
                          {warehouse.type}
                        </td>
                        <td className="py-4">
                          <Badge
                            tone={
                              warehouse.allowOnlineAllocation ? "blue" : "gray"
                            }
                          >
                            {warehouse.allowOnlineAllocation ? "Có" : "Không"}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <Badge tone={warehouse.isActive ? "green" : "gray"}>
                            {warehouse.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900">
                    Chi tiết kho
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Đây là nơi thay cho kho mặc định hard-code trước đó.
                  </p>
                </div>

                {selectedWarehouse && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void saveWarehouseToDb()}
                      disabled={savingWarehouse}
                    >
                      {savingWarehouse ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => toggleWarehouse(selectedWarehouse.id)}
                    >
                      {selectedWarehouse.isActive ? "Tắt kho" : "Bật kho"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => deleteWarehouse(selectedWarehouse.id)}
                    >
                      Xóa kho
                    </Button>
                  </div>
                )}
              </div>

              {selectedWarehouse && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selectedWarehouse.name}
                    onChange={(e) =>
                      saveWarehouseDetail("name", e.target.value)
                    }
                    placeholder="Tên kho"
                  />

                  <input
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selectedWarehouse.code}
                    onChange={(e) =>
                      saveWarehouseDetail("code", e.target.value)
                    }
                    placeholder="Mã kho"
                  />

                  <select
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selectedWarehouse.type}
                    onChange={(e) =>
                      saveWarehouseDetail(
                        "type",
                        e.target.value as WarehouseItem["type"]
                      )
                    }
                  >
                    <option value="STORE">STORE</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="MAIN">MAIN</option>
                  </select>

                  <input
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selectedWarehouse.manager}
                    onChange={(e) =>
                      saveWarehouseDetail("manager", e.target.value)
                    }
                    placeholder="Người phụ trách"
                  />

                  <input
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
                    value={selectedWarehouse.address}
                    onChange={(e) =>
                      saveWarehouseDetail("address", e.target.value)
                    }
                    placeholder="Địa chỉ"
                  />

                  <input
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selectedWarehouse.phone}
                    onChange={(e) =>
                      saveWarehouseDetail("phone", e.target.value)
                    }
                    placeholder="Số điện thoại"
                  />

                  <input
                    className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selectedWarehouse.note}
                    onChange={(e) =>
                      saveWarehouseDetail("note", e.target.value)
                    }
                    placeholder="Ghi chú"
                  />

                  <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={selectedWarehouse.allowRetailSale}
                      onChange={(e) =>
                        saveWarehouseDetail(
                          "allowRetailSale",
                          e.target.checked
                        )
                      }
                    />
                    Cho bán trực tiếp tại kho này
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={selectedWarehouse.allowOnlineAllocation}
                      onChange={(e) =>
                        saveWarehouseDetail(
                          "allowOnlineAllocation",
                          e.target.checked
                        )
                      }
                    />
                    Cho phân bổ tồn online
                  </label>
                </div>
              )}
            </Panel>

            <Panel className="p-5">
              <h3 className="text-xl font-semibold text-neutral-900">
                Thêm kho mới
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={newWarehouse.name}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Tên kho"
                />

                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={newWarehouse.code}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      code: e.target.value,
                    }))
                  }
                  placeholder="Mã kho"
                />

                <select
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={newWarehouse.type}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      type: e.target.value as WarehouseItem["type"],
                    }))
                  }
                >
                  <option value="STORE">STORE</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="MAIN">MAIN</option>
                </select>

                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={newWarehouse.manager}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      manager: e.target.value,
                    }))
                  }
                  placeholder="Người phụ trách"
                />

                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
                  value={newWarehouse.address}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Địa chỉ"
                />

                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={newWarehouse.phone}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="Số điện thoại"
                />

                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={newWarehouse.note}
                  onChange={(e) =>
                    setNewWarehouse((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                  placeholder="Ghi chú"
                />

                <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newWarehouse.allowRetailSale}
                    onChange={(e) =>
                      setNewWarehouse((prev) => ({
                        ...prev,
                        allowRetailSale: e.target.checked,
                      }))
                    }
                  />
                  Cho bán trực tiếp
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newWarehouse.allowOnlineAllocation}
                    onChange={(e) =>
                      setNewWarehouse((prev) => ({
                        ...prev,
                        allowOnlineAllocation: e.target.checked,
                      }))
                    }
                  />
                  Cho phân bổ online
                </label>
              </div>

              <div className="mt-4">
                <Button onClick={() => void addWarehouse()}>
                  Lưu kho mới
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab === "shipping" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <Panel className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900">
                    Hãng vận chuyển
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Bật / tắt hãng và lưu token, shop id để chuẩn bị nối API thật.
                  </p>
                </div>
                <Badge tone="blue">Shipping providers</Badge>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-200 text-sm text-neutral-400">
                      <th className="pb-3 font-medium">Hãng</th>
                      <th className="pb-3 font-medium">Mode</th>
                      <th className="pb-3 font-medium">Kết nối</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shippingProviders.map((provider) => (
                      <tr
                        key={provider.id}
                        onClick={() => setSelectedProviderId(provider.id)}
                        className={`cursor-pointer border-b border-neutral-100 transition ${selectedProviderId === provider.id
                          ? "bg-neutral-50"
                          : "hover:bg-neutral-50"
                          }`}
                      >
                        <td className="py-4">
                          <div className="font-medium text-neutral-900">
                            {provider.name}
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {provider.code}
                          </div>
                        </td>
                        <td className="py-4 text-sm text-neutral-700">
                          {provider.mode}
                        </td>
                        <td className="py-4">
                          <Badge tone={provider.isConnected ? "green" : "gray"}>
                            {provider.isConnected ? "Connected" : "Not connected"}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <Badge tone={provider.isActive ? "blue" : "gray"}>
                            {provider.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  Chi tiết kết nối
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Tạm thời mới lưu local. Hôm sau sẽ nối API thật.
                </p>
              </div>
              {selectedProvider && (
                <Badge tone={selectedProvider.isConnected ? "green" : "amber"}>
                  {selectedProvider.isConnected ? "Đã test OK" : "Chưa test"}
                </Badge>
              )}
            </div>

            {selectedProvider && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={selectedProvider.code}
                  onChange={(e) => saveProviderDetail("code", e.target.value)}
                  placeholder="Mã hãng"
                />
                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={selectedProvider.name}
                  onChange={(e) => saveProviderDetail("name", e.target.value)}
                  placeholder="Tên hãng"
                />
                <select
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={selectedProvider.mode}
                  onChange={(e) =>
                    saveProviderDetail(
                      "mode",
                      e.target.value as ShippingProviderItem["mode"]
                    )
                  }
                >
                  <option value="SANDBOX">SANDBOX</option>
                  <option value="PRODUCTION">PRODUCTION</option>
                </select>
                <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={selectedProvider.isActive}
                    onChange={(e) =>
                      saveProviderDetail("isActive", e.target.checked)
                    }
                  />
                  Bật hãng này
                </label>

                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
                  value={selectedProvider.apiKey}
                  onChange={(e) => saveProviderDetail("apiKey", e.target.value)}
                  placeholder="API key / token"
                />
                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
                  value={selectedProvider.shopId}
                  onChange={(e) => saveProviderDetail("shopId", e.target.value)}
                  placeholder="Shop ID / Client ID"
                />
                <input
                  className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none md:col-span-2"
                  value={selectedProvider.note}
                  onChange={(e) => saveProviderDetail("note", e.target.value)}
                  placeholder="Ghi chú"
                />
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button variant="secondary" onClick={testProviderConnection}>
                Test kết nối
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "mapping" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel className="p-5">
            <h3 className="text-xl font-semibold text-neutral-900">
              Kho mặc định theo nguồn đơn
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-sm text-neutral-500">Website</p>
                <select
                  className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={mapping.webDefaultWarehouseId}
                  onChange={(e) =>
                    saveMapping("webDefaultWarehouseId", e.target.value)
                  }
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm text-neutral-500">Facebook</p>
                <select
                  className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={mapping.facebookDefaultWarehouseId}
                  onChange={(e) =>
                    saveMapping("facebookDefaultWarehouseId", e.target.value)
                  }
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm text-neutral-500">TikTok</p>
                <select
                  className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={mapping.tiktokDefaultWarehouseId}
                  onChange={(e) =>
                    saveMapping("tiktokDefaultWarehouseId", e.target.value)
                  }
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="text-xl font-semibold text-neutral-900">
              Hãng vận chuyển mặc định
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-sm text-neutral-500">COD mặc định</p>
                <select
                  className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={mapping.defaultCodProviderId}
                  onChange={(e) =>
                    saveMapping("defaultCodProviderId", e.target.value)
                  }
                >
                  {shippingProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm text-neutral-500">Nội thành mặc định</p>
                <select
                  className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                  value={mapping.defaultInnerCityProviderId}
                  onChange={(e) =>
                    saveMapping("defaultInnerCityProviderId", e.target.value)
                  }
                >
                  {shippingProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-800">
                  Gợi ý vận hành
                </p>
                <div className="mt-2 space-y-1 text-sm text-neutral-500">
                  <p>• Web / Facebook / TikTok nên map về kho online trước.</p>
                  <p>• Kho cửa hàng chỉ bật online allocation khi muốn chia tồn.</p>
                  <p>• Hãng nội thành có thể để Ahamove hoặc Lalamove sau.</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
      {tab === "paymentSources" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel className="overflow-hidden">
            <div className="p-5">
              <h3 className="text-xl font-semibold text-neutral-900">
                Danh sách nguồn tiền
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Các nguồn tiền này sẽ hiện trong màn tạo đơn.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-200 text-sm text-neutral-400">
                      <th className="pb-3 font-medium">Nguồn tiền</th>
                      <th className="pb-3 font-medium">Loại</th>
                      <th className="pb-3 font-medium">Chi nhánh</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSources.map((item) => (
                      <tr key={item.id} className="border-b border-neutral-100">
                        <td className="py-4">
                          <div className="font-medium text-neutral-900">
                            {item.name}
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {item.code}
                          </div>
                        </td>
                        <td className="py-4 text-sm text-neutral-700">{item.type}</td>
                        <td className="py-4 text-sm text-neutral-700">
                          {warehouses.find((w) => w.id === item.branchId)?.name ||
                            item.branchId ||
                            "Tất cả"}
                        </td>
                        <td className="py-4">
                          <Badge tone={item.isActive ? "green" : "gray"}>
                            {item.isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="text-xl font-semibold text-neutral-900">
              Thêm nguồn tiền
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={paymentSourceForm.code}
                onChange={(e) =>
                  setPaymentSourceForm((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="Mã nguồn tiền, VD: BANK_QO"
              />

              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={paymentSourceForm.name}
                onChange={(e) =>
                  setPaymentSourceForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Tên hiển thị, VD: Quốc Oai - CK"
              />

              <select
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={paymentSourceForm.type}
                onChange={(e) =>
                  setPaymentSourceForm((prev) => ({
                    ...prev,
                    type: e.target.value as PaymentSourceItem["type"],
                  }))
                }
              >
                <option value="CASH">Tiền mặt</option>
                <option value="BANK">Chuyển khoản</option>
                <option value="CARD">Quẹt thẻ</option>
                <option value="COD">COD</option>
                <option value="PARTIAL">Thanh toán một phần</option>
                <option value="EXCHANGE">Đổi hàng</option>
                <option value="OTHER">Khác</option>
              </select>

              <select
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={paymentSourceForm.branchId}
                onChange={(e) =>
                  setPaymentSourceForm((prev) => ({
                    ...prev,
                    branchId: e.target.value,
                  }))
                }
              >
                <option value="">Tất cả chi nhánh</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>

              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={paymentSourceForm.sortOrder}
                onChange={(e) =>
                  setPaymentSourceForm((prev) => ({
                    ...prev,
                    sortOrder: Number(e.target.value || 0),
                  }))
                }
                placeholder="Thứ tự"
              />

              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={paymentSourceForm.note}
                onChange={(e) =>
                  setPaymentSourceForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Ghi chú"
              />
            </div>

            <div className="mt-4">
              <Button
                onClick={() => void createPaymentSource()}
                disabled={savingPaymentSource}
              >
                {savingPaymentSource ? "Đang thêm..." : "Thêm nguồn tiền"}
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {tab === "salesChannels" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel className="overflow-hidden">
            <div className="p-5">
              <h3 className="text-xl font-semibold text-neutral-900">
                Danh sách kênh bán
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Các kênh này sẽ được dùng trong màn tạo đơn và danh sách đơn hàng.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-200 text-sm text-neutral-400">
                      <th className="pb-3 font-medium">Kênh bán</th>
                      <th className="pb-3 font-medium">Mã lưu DB</th>
                      <th className="pb-3 font-medium">Thứ tự</th>
                      <th className="pb-3 font-medium">Trạng thái</th>
                      <th className="pb-3 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesChannels.map((item) => (
                      <tr key={item.id} className="border-b border-neutral-100">
                        <td className="py-4">
                          <input
                            className="h-10 w-full rounded-2xl border border-neutral-300 px-3 text-sm outline-none"
                            value={item.name}
                            onChange={(e) =>
                              updateSalesChannel(item.id, { name: e.target.value })
                            }
                          />
                          <div className="mt-1 text-xs text-neutral-400">
                            {item.note || "—"}
                          </div>
                        </td>
                        <td className="py-4">
                          <input
                            className="h-10 w-full rounded-2xl border border-neutral-300 px-3 text-sm uppercase outline-none"
                            value={item.code}
                            onChange={(e) =>
                              updateSalesChannel(item.id, { code: e.target.value })
                            }
                          />
                        </td>
                        <td className="py-4">
                          <input
                            type="number"
                            className="h-10 w-24 rounded-2xl border border-neutral-300 px-3 text-sm outline-none"
                            value={item.sortOrder}
                            onChange={(e) =>
                              updateSalesChannel(item.id, {
                                sortOrder: Number(e.target.value || 0),
                              })
                            }
                          />
                        </td>
                        <td className="py-4">
                          <button
                            onClick={() =>
                              updateSalesChannel(item.id, {
                                isActive: !item.isActive,
                              })
                            }
                          >
                            <Badge tone={item.isActive ? "green" : "gray"}>
                              {item.isActive ? "ACTIVE" : "INACTIVE"}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-4">
                          <Button
                            variant="danger"
                            onClick={() => deleteSalesChannel(item.id)}
                          >
                            Xoá
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="text-xl font-semibold text-neutral-900">
              Thêm kênh bán
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Ví dụ: Facebook, TikTok, Shopee, Zalo, Website, Showroom.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={salesChannelForm.code}
                onChange={(e) =>
                  setSalesChannelForm((prev) => ({
                    ...prev,
                    code: e.target.value,
                  }))
                }
                placeholder="Mã, VD: FACEBOOK_MANUAL"
              />

              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={salesChannelForm.name}
                onChange={(e) =>
                  setSalesChannelForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Tên hiển thị, VD: Facebook"
              />

              <input
                type="number"
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={salesChannelForm.sortOrder}
                onChange={(e) =>
                  setSalesChannelForm((prev) => ({
                    ...prev,
                    sortOrder: Number(e.target.value || 0),
                  }))
                }
                placeholder="Thứ tự"
              />

              <input
                className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                value={salesChannelForm.note}
                onChange={(e) =>
                  setSalesChannelForm((prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
                placeholder="Ghi chú"
              />
            </div>

            <div className="mt-4 flex gap-3">
              <Button onClick={createSalesChannel}>Thêm kênh bán</Button>
              <Button
                variant="secondary"
                onClick={() => saveSalesChannels(defaultSalesChannels)}
              >
                Khôi phục mặc định
              </Button>
            </div>

            <div className="mt-5 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              Mã kênh bán là giá trị lưu trong đơn hàng. Tên hiển thị là nhãn
              đẹp trên UI. Màn tạo đơn cần đọc cùng key localStorage:
              <span className="font-semibold"> the1970_sales_channels</span>.
            </div>
          </Panel>
        </div>
      )}

      {tab === "printing" && <PrintTemplatesTab />}

      {tab === "security" && (
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Google Authenticator
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Dùng để xác nhận giao hàng 1 phần, sửa COD và thao tác nhạy cảm.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[260px_1fr]">
            <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
              {totpSetupData?.qrCodeDataUrl ? (
                <img
                  src={totpSetupData.qrCodeDataUrl}
                  alt="QR"
                  className="h-56 w-56 rounded-2xl bg-white object-contain p-2"
                />
              ) : (
                <div className="text-center text-sm text-neutral-500">
                  Bấm tạo mã QR để cài authen.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-neutral-50 p-4">
                <div className="font-semibold text-neutral-900">
                  Cách cài
                </div>

                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-600">
                  <li>Bấm “Tạo mã QR”.</li>
                  <li>Mở Google Authenticator trên điện thoại.</li>
                  <li>Quét mã QR.</li>
                  <li>Nhập mã 6 số để bật authen.</li>
                </ol>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={async () => {
                    try {
                      setTotpLoading(true);
                      setTotpError("");

                      const data = await apiJson("/auth/totp/setup", {
                        method: "POST",
                      });

                      setTotpSetupData(data);
                    } catch (err: any) {
                      setTotpError(err?.message || "Không tạo được QR.");
                    } finally {
                      setTotpLoading(false);
                    }
                  }}
                >
                  {totpLoading ? "Đang tạo..." : "Tạo mã QR"}
                </Button>

                <input
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="Nhập mã 6 số"
                  className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                />

                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      setTotpVerifying(true);
                      setTotpError("");

                      const data = await apiJson(
                        "/auth/totp/verify-setup",
                        {
                          method: "POST",
                          body: JSON.stringify({
                            code: totpCode,
                          }),
                        }
                      );

                      setTotpMessage(
                        data?.message || "Đã bật authen."
                      );
                    } catch (err: any) {
                      setTotpError(
                        err?.message || "Mã authen không đúng."
                      );
                    } finally {
                      setTotpVerifying(false);
                    }
                  }}
                >
                  {totpVerifying
                    ? "Đang xác nhận..."
                    : "Bật authen"}
                </Button>
              </div>

              {totpMessage ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {totpMessage}
                </div>
              ) : null}

              {totpError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {totpError}
                </div>
              ) : null}
            </div>
          </div>
        </Panel>
      )}

    </div>
  );
}