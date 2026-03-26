"use client";
// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";

const currentUser = { name: "Admin The 1970", role: "ADMIN" };

const hasPermission = (role, group, keyword) => {
  const items = role?.permissions?.[group] || [];
  return items.some((item) => item.toLowerCase().includes(keyword.toLowerCase()));
};

const canAccessTab = (role, tabId) => {
  if (!role) return false;
  if (role.id === "admin") return true;
  switch (tabId) {
    case "dashboard":
      return true;
    case "orders":
      return hasPermission(role, "orders", "xem đơn");
    case "create-order":
      return hasPermission(role, "orders", "tạo đơn");
    case "products":
      return hasPermission(role, "products", "xem sản phẩm");
    case "inventory":
      return hasPermission(role, "inventory", "xem tồn kho");
    case "stocktake":
      return hasPermission(role, "inventory", "kiểm kho");
    case "ads":
      return hasPermission(role, "orders", "hãng vận chuyển") || hasPermission(role, "reports", "xem báo cáo");
    case "ai-content":
      return hasPermission(role, "products", "xem sản phẩm") && hasPermission(role, "orders", "tạo đơn");
    case "reports":
      return hasPermission(role, "reports", "xem báo cáo");
    case "permissions":
      return hasPermission(role, "system", "phân quyền");
    default:
      return false;
  }
};

const branches = [
  { id: "b1", name: "Hoàn Kiếm", code: "HK" },
  { id: "b2", name: "Hai Bà Trưng", code: "HBT" },
  { id: "b3", name: "Online Warehouse", code: "OL" },
];

const productGroups = ["T-Shirt", "Shirt", "Polo", "Outerwear", "Knitwear", "Accessories"];
const productTypes = ["Core", "New Arrival", "Best Seller", "Seasonal", "Limited"];
const brandOptions = ["The 1970", "The 1970 Heritage", "The 1970 Studio"];

const initialProducts = [
  {
    id: "p1",
    name: "QS794 Palm",
    slug: "qs794-palm",
    category: "T-Shirt",
    productType: "Best Seller",
    brand: "The 1970",
    weight: 220,
    imageUrl: "https://placehold.co/600x600?text=QS794+Palm",
    status: "ACTIVE",
    description: "Áo phông The 1970 phom gọn, chất cotton dày đứng form.",
    variants: [
      { id: "v1", sku: "QS794-GREEN-S", color: "Green", size: "S", price: 390000, costPrice: 220000, stock: 12, branchStocks: { b1: 4, b2: 3, b3: 5 } },
      { id: "v2", sku: "QS794-GREEN-M", color: "Green", size: "M", price: 390000, costPrice: 220000, stock: 8, branchStocks: { b1: 2, b2: 2, b3: 4 } },
      { id: "v3", sku: "QS794-GREEN-L", color: "Green", size: "L", price: 390000, costPrice: 220000, stock: 4, branchStocks: { b1: 1, b2: 1, b3: 2 } },
    ],
  },
  {
    id: "p2",
    name: "SM902 Rêu Đen",
    slug: "sm902-reu-den",
    category: "Shirt",
    productType: "Core",
    brand: "The 1970",
    weight: 340,
    imageUrl: "https://placehold.co/600x600?text=SM902+Reu+Den",
    status: "ACTIVE",
    description: "Sơ mi flannel mềm ấm, màu rêu đen trầm nam tính.",
    variants: [
      { id: "v4", sku: "SM902-REUDEN-M", color: "Rêu Đen", size: "M", price: 620000, costPrice: 360000, stock: 7, branchStocks: { b1: 2, b2: 2, b3: 3 } },
      { id: "v5", sku: "SM902-REUDEN-L", color: "Rêu Đen", size: "L", price: 620000, costPrice: 360000, stock: 5, branchStocks: { b1: 1, b2: 1, b3: 3 } },
    ],
  },
  {
    id: "p3",
    name: "Heritage Tee Tobacco",
    slug: "heritage-tee-tobacco",
    category: "T-Shirt",
    productType: "New Arrival",
    brand: "The 1970 Heritage",
    weight: 240,
    imageUrl: "https://placehold.co/600x600?text=Heritage+Tee",
    status: "ACTIVE",
    description: "Dòng heritage với bo cổ contrast, vibe classic American.",
    variants: [
      { id: "v6", sku: "HTB-TOBACCO-S", color: "Tobacco", size: "S", price: 450000, costPrice: 260000, stock: 2, branchStocks: { b1: 1, b2: 0, b3: 1 } },
      { id: "v7", sku: "HTB-TOBACCO-M", color: "Tobacco", size: "M", price: 450000, costPrice: 260000, stock: 1, branchStocks: { b1: 0, b2: 0, b3: 1 } },
    ],
  },
];

const initialOrders = [
  {
    id: "o1",
    orderCode: "ORD-1774A",
    createdAt: "2026-03-25 09:20",
    salesChannel: "VN_WEB",
    paymentStatus: "AWAITING_PAYMENT",
    orderStatus: "PENDING",
    customerName: "Khách lẻ web",
    customerPhone: "0988 111 222",
    branchId: "b3",
    note: "Test đơn từ web riêng",
    grandTotal: 780000,
    items: [{ variantId: "v1", sku: "QS794-GREEN-S", productName: "QS794 Palm", color: "Green", size: "S", qty: 2, unitPrice: 390000, lineTotal: 780000 }],
  },
  {
    id: "o2",
    orderCode: "ORD-1774B",
    createdAt: "2026-03-25 10:05",
    salesChannel: "ADMIN",
    paymentStatus: "PAID",
    orderStatus: "CONFIRMED",
    customerName: "Nguyễn Minh",
    customerPhone: "0903 222 888",
    branchId: "b1",
    note: "Đơn tạo tay tại shop",
    grandTotal: 620000,
    items: [{ variantId: "v4", sku: "SM902-REUDEN-M", productName: "SM902 Rêu Đen", color: "Rêu Đen", size: "M", qty: 1, unitPrice: 620000, lineTotal: 620000 }],
  },
  {
    id: "o3",
    orderCode: "ORD-1774C",
    createdAt: "2026-03-25 11:10",
    salesChannel: "FACEBOOK",
    paymentStatus: "PENDING_COD",
    orderStatus: "PROCESSING",
    customerName: "Trần Hoàng",
    customerPhone: "0912 333 666",
    branchId: "b2",
    note: "Ship hỏa tốc nội thành",
    grandTotal: 900000,
    items: [{ variantId: "v6", sku: "HTB-TOBACCO-S", productName: "Heritage Tee Tobacco", color: "Tobacco", size: "S", qty: 2, unitPrice: 450000, lineTotal: 900000 }],
  },
];

const initialStocktakes = [
  { id: "st1", branchId: "b1", createdAt: "2026-03-25 08:30", status: "IN_PROGRESS", note: "Kiểm nhanh đầu ngày", lines: [{ sku: "QS794-GREEN-S", systemStock: 4, countedStock: 4, diff: 0 }] },
  { id: "st2", branchId: "b3", createdAt: "2026-03-24 18:10", status: "COMPLETED", note: "Chốt kho cuối ngày", lines: [{ sku: "SM902-REUDEN-L", systemStock: 3, countedStock: 2, diff: -1, reason: "Thiếu hàng thực tế" }] },
];

const roleTemplates = [
  {
    id: "admin",
    name: "Admin / Owner",
    scope: "ALL_BRANCHES",
    description: "Toàn quyền hệ thống, nhìn được báo cáo và giá vốn.",
    activeEmployees: 1,
    inactiveEmployees: 0,
    createdAt: "07/08/2025",
    updatedAt: "18/03/2026",
    note: "Owner",
    permissions: {
      products: ["Xem sản phẩm", "Tạo sản phẩm", "Thêm variant", "Đổi trạng thái sản phẩm", "Xem giá nhập", "Sửa giá nhập"],
      orders: ["Xem tất cả đơn", "Tạo đơn hàng", "Sửa đơn hàng", "Duyệt đơn hàng", "Đẩy đơn sang hãng vận chuyển"],
      inventory: ["Xem tồn kho toàn hệ thống", "Kiểm kho", "Xác nhận kiểm kho", "Nhập hàng", "Chuyển hàng giữa chi nhánh"],
      reports: ["Xem báo cáo chi nhánh", "Xem báo cáo toàn hệ thống", "Xem lợi nhuận", "Xem ROAS thật"],
      customers: ["Xem khách hàng"],
      system: ["Phân quyền vai trò", "Cấu hình hệ thống"],
    },
  },
  {
    id: "branch-manager",
    name: "Quản lý chi nhánh",
    scope: "ONE_BRANCH",
    description: "Quản lý vận hành của một chi nhánh, không thấy toàn hệ thống.",
    activeEmployees: 2,
    inactiveEmployees: 0,
    createdAt: "08/08/2025",
    updatedAt: "18/03/2026",
    note: "Theo chi nhánh",
    permissions: {
      products: ["Xem sản phẩm", "Tạo sản phẩm", "Thêm variant"],
      orders: ["Xem đơn chi nhánh", "Tạo đơn hàng", "Sửa đơn hàng", "Duyệt đơn hàng", "Đẩy đơn sang hãng vận chuyển"],
      inventory: ["Xem tồn kho chi nhánh", "Kiểm kho", "Xác nhận kiểm kho", "Nhập hàng", "Chuyển hàng"],
      reports: ["Xem báo cáo chi nhánh"],
      customers: ["Xem khách hàng"],
      system: [],
    },
  },
  {
    id: "fulltime",
    name: "Nhân viên fulltime",
    scope: "ONE_BRANCH",
    description: "Vận hành mạnh hơn bán lẻ, được xử lý đơn và đẩy sang hãng vận chuyển.",
    activeEmployees: 4,
    inactiveEmployees: 1,
    createdAt: "07/08/2025",
    updatedAt: "18/03/2026",
    note: "Không xem báo cáo",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: ["Xem đơn chi nhánh", "Tạo đơn hàng", "Sửa đơn hàng", "Đẩy đơn sang hãng vận chuyển"],
      inventory: ["Xem tồn kho chi nhánh", "Kiểm kho", "Nhập hàng", "Chuyển hàng"],
      reports: [],
      customers: ["Xem khách hàng"],
      system: [],
    },
  },
  {
    id: "retail-staff",
    name: "Nhân viên bán lẻ",
    scope: "ONE_BRANCH",
    description: "Tập trung bán hàng tại quầy, quyền gọn và an toàn hơn fulltime.",
    activeEmployees: 13,
    inactiveEmployees: 0,
    createdAt: "07/08/2025",
    updatedAt: "05/12/2025",
    note: "Không xem báo cáo, không đụng kho",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: ["Xem đơn được phụ trách", "Tạo đơn hàng"],
      inventory: ["Xem tồn kho chi nhánh"],
      reports: [],
      customers: ["Xem khách hàng"],
      system: [],
    },
  },
  {
    id: "stock-auditor",
    name: "Nhân viên kiểm kho",
    scope: "ONE_BRANCH",
    description: "Chỉ tập trung kiểm kho và đối chiếu tồn.",
    activeEmployees: 1,
    inactiveEmployees: 1,
    createdAt: "07/08/2025",
    updatedAt: "18/03/2026",
    note: "Không xử lý đơn bán",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [],
      inventory: ["Xem tồn kho chi nhánh", "Kiểm kho"],
      reports: [],
      customers: [],
      system: [],
    },
  },
];

const initialEmployees = [
  { id: "u1", name: "Anh Kiều", code: "NV001", status: "WORKING", roleId: "admin", branchIds: ["b1", "b2", "b3"] },
  { id: "u2", name: "Mai Anh", code: "NV014", status: "WORKING", roleId: "branch-manager", branchIds: ["b1"] },
  { id: "u3", name: "Tuấn HBT", code: "NV021", status: "WORKING", roleId: "branch-manager", branchIds: ["b2"] },
  { id: "u4", name: "Quỳnh QQ", code: "NV031", status: "WORKING", roleId: "fulltime", branchIds: ["b1"] },
  { id: "u5", name: "Phương HK", code: "NV032", status: "WORKING", roleId: "fulltime", branchIds: ["b1"] },
  { id: "u6", name: "Lan HBT", code: "NV033", status: "WORKING", roleId: "fulltime", branchIds: ["b2"] },
  { id: "u7", name: "Minh OL", code: "NV034", status: "WORKING", roleId: "fulltime", branchIds: ["b3"] },
  { id: "u8", name: "Ngọc Store", code: "NV041", status: "WORKING", roleId: "retail-staff", branchIds: ["b1"] },
  { id: "u9", name: "Hà Store", code: "NV042", status: "WORKING", roleId: "retail-staff", branchIds: ["b1"] },
  { id: "u10", name: "Linh Store", code: "NV043", status: "WORKING", roleId: "retail-staff", branchIds: ["b2"] },
  { id: "u11", name: "Dũng Kho", code: "NV051", status: "WORKING", roleId: "stock-auditor", branchIds: ["b3"] },
  { id: "u12", name: "Cường Cũ", code: "NV099", status: "INACTIVE", roleId: "fulltime", branchIds: ["b1"] },
];

const permissionGroups = [
  { key: "products", label: "Sản phẩm" },
  { key: "orders", label: "Đơn hàng" },
  { key: "inventory", label: "Kho vận hành" },
  { key: "reports", label: "Báo cáo" },
  { key: "customers", label: "Khách hàng" },
  { key: "system", label: "Hệ thống" },
];

const permissionGroupDescriptions = {
  products: "Ai được xem, tạo và can thiệp dữ liệu sản phẩm.",
  orders: "Ai được tạo, sửa, duyệt và đẩy đơn sang hãng vận chuyển.",
  inventory: "Ai được xem tồn, kiểm kho, nhập hàng và chuyển hàng.",
  reports: "Ai được xem báo cáo chi nhánh hoặc toàn hệ thống.",
  customers: "Ai được truy cập dữ liệu khách hàng.",
  system: "Ai được phân quyền và cấu hình hệ thống.",
};

function summarizePermissions(items) {
  if (!items || !items.length) return "Chưa có quyền";
  if (items.length <= 3) return `Có quyền: ${items.join(", ")}`;
  return `Có quyền: ${items.slice(0, 3).join(", ")} +${items.length - 3} quyền khác`;
}

function PermissionModuleCard({ label, description, items }) {
  const [open, setOpen] = useState(false);
  const hasItems = items && items.length > 0;
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{label}</p>
            <Badge tone={hasItems ? "blue" : "gray"}>{hasItems ? `${items.length} quyền` : "Không có"}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
          <p className="mt-3 text-sm text-neutral-700 italic">{summarizePermissions(items)}</p>
        </div>
        <span className="text-neutral-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          {hasItems ? (
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  <span className="text-blue-600">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Role này không được cấp quyền ở nhóm này.</p>
          )}
        </div>
      )}
    </div>
  );
}

const initialAdsMappings = [
  {
    id: "m1",
    sku: "QS794-GREEN-S",
    productName: "QS794 Palm",
    campaignName: "QS794 Palm Conversion",
    campaignId: "cmp_1970_001",
    adsetName: "QS794 Green Core",
    adsetId: "adset_1970_001",
    channel: "FACEBOOK",
    status: "CONNECTED",
    spendToday: 850000,
    revenueToday: 2860000,
    roasToday: 3.36,
    budgetDaily: 1200000,
    lastAction: "Không có",
  },
  {
    id: "m2",
    sku: "SM902-REUDEN-M",
    productName: "SM902 Rêu Đen",
    campaignName: "SM902 Traffic to Purchase",
    campaignId: "cmp_1970_002",
    adsetName: "SM902 Broad",
    adsetId: "adset_1970_002",
    channel: "FACEBOOK",
    status: "CONNECTED",
    spendToday: 430000,
    revenueToday: 620000,
    roasToday: 1.44,
    budgetDaily: 800000,
    lastAction: "Giữ nguyên",
  },
  {
    id: "m3",
    sku: "HTB-TOBACCO-S",
    productName: "Heritage Tee Tobacco",
    campaignName: "Heritage Tee Launch",
    campaignId: "cmp_1970_003",
    adsetName: "Heritage Tee Interest",
    adsetId: "adset_1970_003",
    channel: "FACEBOOK",
    status: "NEEDS_MAPPING",
    spendToday: 0,
    revenueToday: 0,
    roasToday: 0,
    budgetDaily: 0,
    lastAction: "Chưa map",
  },
];

const currency = (n) => new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
const formatDate = () => new Date().toLocaleString("vi-VN");
const branchName = (id) => branches.find((b) => b.id === id)?.name || "—";

function Panel({ children, className = "" }) {
  return <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", className = "", disabled = false, type = "button" }) {
  const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : variant === "success"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "opacity-50 cursor-not-allowed" : "";
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${tone} ${state} ${className}`}>{children}</button>;
}

function Badge({ children, tone = "gray" }) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

function StatCard({ title, value, sub }) {
  return (
    <Panel>
      <div className="p-5">
        <p className="text-sm text-neutral-500">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{value}</h3>
        <p className="mt-2 text-xs text-neutral-500">{sub}</p>
      </div>
    </Panel>
  );
}

function SectionTitle({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-xl text-neutral-500">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Header({ search, setSearch, user, employees, activeEmployeeId, setActiveEmployeeId }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">The 1970 Operations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin System</h1>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:w-[320px]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nhanh order, SKU, sản phẩm..." />
        {user.role === "ADMIN" && (
          <select className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:w-[260px]" value={activeEmployeeId} onChange={(e) => setActiveEmployeeId(e.target.value)}>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}
          </select>
        )}
        <div className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">{user.role === "ADMIN" ? "Admin preview" : "Staff view"}</div>
      </div>
    </div>
  );
}

function toneForStatus(value) {
  if (["ACTIVE", "CONFIRMED", "FULFILLED", "PAID", "COMPLETED", "CONNECTED"].includes(value)) return "green";
  if (["AWAITING_PAYMENT", "PENDING", "PENDING_COD", "PROCESSING", "IN_PROGRESS"].includes(value)) return "amber";
  if (["CANCELLED", "FAILED", "INACTIVE", "NEEDS_MAPPING"].includes(value)) return "red";
  return "gray";
}

function DashboardPage({ setTab, activities }) {
  const [selectedDay, setSelectedDay] = useState("25");
  const [range, setRange] = useState("30d");
  const [channelFilter, setChannelFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [decisionMode, setDecisionMode] = useState("profit");
  const [selectedProduct, setSelectedProduct] = useState("QS794 Palm");
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [warRoomTab, setWarRoomTab] = useState("live");
  const [autoActionEnabled, setAutoActionEnabled] = useState(true);
  const [approvalMode, setApprovalMode] = useState(true);
  const [floatingApprovalOpen, setFloatingApprovalOpen] = useState(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [autoMode, setAutoMode] = useState("SEMI");
  const [pendingApprovals, setPendingApprovals] = useState([
    {
      id: "apr-001",
      title: "Scale QS794 Palm",
      actionType: "scale15",
      reason: "ROAS tốt, tồn kho an toàn",
      createdAt: "09:26",
    },
  ]);
  const [actionLog, setActionLog] = useState([
    { id: 1, time: "09:10", title: "Tăng ngân sách QS794 Palm", detail: "Tăng ngân sách theo điều kiện scale hiện tại" },
    { id: 2, time: "08:42", title: "Theo dõi checkout", detail: "Đánh dấu cần kiểm tra phí ship" },
  ]);
  const [lastPendingCount, setLastPendingCount] = useState(1);
  const [budgetGuard, setBudgetGuard] = useState({
    maxScalePercent: 20,
    maxDailyCuts: 2,
    cutsUsedToday: 1,
  });
  const [metaConnection, setMetaConnection] = useState({
    connected: true,
    mode: "dry_run",
    account: "act_2384_The1970",
    lastSync: "09:41",
    permissions: ["ads_read", "ads_management"],
  });
  const [scheduledTasks] = useState([
    { id: "sch-9", time: "09:00", title: "Morning Risk Check", action: "auto_cut", note: "Kiểm tra risk và auto cut nếu ROAS xấu" },
    { id: "sch-20", time: "20:00", title: "Evening Growth Check", action: "scale15", note: "Scale nhẹ nếu decision an toàn" },
  ]);

  const commandCenterRef = useRef(null);
  const focusCommandCenter = () => {
    commandCenterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const kpis = [
    { label: "Doanh thu hôm nay", value: "42.8M", delta: "+12.4%" },
    { label: "Đơn hàng", value: "128", delta: "+8.1%" },
    { label: "AOV", value: "334K", delta: "+4.7%" },
    { label: "ROAS", value: "3.92x", delta: "+0.31" },
    { label: "Lợi nhuận ước tính", value: "11.6M", delta: "+9.2%" },
  ];

  const dailyRevenue = [
    { day: "01", revenue: "18.2M", orders: 41, roas: "2.84x" },
    { day: "02", revenue: "21.4M", orders: 46, roas: "3.02x" },
    { day: "03", revenue: "19.8M", orders: 43, roas: "2.76x" },
    { day: "04", revenue: "24.6M", orders: 55, roas: "3.11x" },
    { day: "05", revenue: "22.1M", orders: 49, roas: "2.95x" },
    { day: "06", revenue: "27.8M", orders: 61, roas: "3.28x" },
    { day: "07", revenue: "25.9M", orders: 58, roas: "3.01x" },
    { day: "08", revenue: "31.2M", orders: 67, roas: "3.34x" },
    { day: "09", revenue: "28.7M", orders: 63, roas: "3.08x" },
    { day: "10", revenue: "33.9M", orders: 72, roas: "3.47x" },
    { day: "11", revenue: "30.6M", orders: 69, roas: "3.12x" },
    { day: "12", revenue: "36.4M", orders: 78, roas: "3.58x" },
    { day: "13", revenue: "34.2M", orders: 73, roas: "3.21x" },
    { day: "14", revenue: "38.1M", orders: 81, roas: "3.64x" },
    { day: "15", revenue: "35.5M", orders: 76, roas: "3.18x" },
    { day: "16", revenue: "40.8M", orders: 88, roas: "3.72x" },
    { day: "17", revenue: "37.9M", orders: 83, roas: "3.33x" },
    { day: "18", revenue: "42.6M", orders: 92, roas: "3.88x" },
    { day: "19", revenue: "39.4M", orders: 86, roas: "3.41x" },
    { day: "20", revenue: "45.1M", orders: 96, roas: "4.05x" },
    { day: "21", revenue: "41.8M", orders: 91, roas: "3.62x" },
    { day: "22", revenue: "47.3M", orders: 102, roas: "4.11x" },
    { day: "23", revenue: "43.7M", orders: 95, roas: "3.90x" },
    { day: "24", revenue: "49.5M", orders: 108, roas: "4.19x" },
    { day: "25", revenue: "42.8M", orders: 128, roas: "3.92x" },
  ];

  const dailyDetail = {
    "25": {
      summary: { revenue: "42.8M", orders: 128, adSpend: "10.9M", roas: "3.92x" },
      products: [
        { name: "QS794 Palm", sold: 18, revenue: "5.4M", stockLeft: 22 },
        { name: "SM902 Rêu Đen", sold: 12, revenue: "4.2M", stockLeft: 8 },
        { name: "Vintage Olive Tee", sold: 9, revenue: "2.7M", stockLeft: 15 },
      ],
      channels: [
        { name: "Website", value: "22.0M", percent: 51 },
        { name: "Facebook Ads", value: "14.0M", percent: 33 },
        { name: "TikTok", value: "6.8M", percent: 16 },
      ],
      warehouses: [
        { name: "Kho Hà Nội", orders: 54 },
        { name: "Kho Sài Gòn", orders: 39 },
        { name: "Kho Online", orders: 35 },
      ],
    },
    "24": {
      summary: { revenue: "49.5M", orders: 108, adSpend: "11.8M", roas: "4.19x" },
      products: [
        { name: "QS794 Palm", sold: 15, revenue: "4.5M", stockLeft: 24 },
        { name: "Heritage Sage Tee", sold: 11, revenue: "3.3M", stockLeft: 11 },
        { name: "SM902 Rêu Đen", sold: 10, revenue: "3.5M", stockLeft: 9 },
      ],
      channels: [
        { name: "Website", value: "25.0M", percent: 51 },
        { name: "Facebook Ads", value: "18.0M", percent: 36 },
        { name: "TikTok", value: "6.5M", percent: 13 },
      ],
      warehouses: [
        { name: "Kho Hà Nội", orders: 48 },
        { name: "Kho Sài Gòn", orders: 34 },
        { name: "Kho Online", orders: 26 },
      ],
    },
  };

  const costConfig = { cogsRate: 0.35, shippingPerOrder: 25000 };

  const topProducts = [
    { name: "QS794 Palm", sold: 48, revenue: "14.4M", stock: 22, category: "T-Shirt" },
    { name: "SM902 Rêu Đen", sold: 33, revenue: "12.1M", stock: 8, category: "Shirt" },
    { name: "Vintage Olive Tee", sold: 29, revenue: "8.7M", stock: 15, category: "T-Shirt" },
    { name: "Heritage Sage Tee", sold: 21, revenue: "6.5M", stock: 11, category: "T-Shirt" },
  ];

  const productInsight = {
    "QS794 Palm": {
      summary: { revenue: "14.4M", sold: 48, bestChannel: "Website" },
      variants: [
        { name: "Green / M", sold: 16, stock: 7 },
        { name: "Green / L", sold: 12, stock: 5 },
        { name: "Green / XL", sold: 9, stock: 4 },
      ],
      channels: [
        { name: "Website", revenue: "7.6M", percent: 53 },
        { name: "Facebook Ads", revenue: "4.3M", percent: 30 },
        { name: "TikTok", revenue: "2.5M", percent: 17 },
      ],
      warehouses: [
        { name: "Kho Hà Nội", stock: 12 },
        { name: "Kho Sài Gòn", stock: 6 },
        { name: "Kho Online", stock: 4 },
      ],
    },
    "SM902 Rêu Đen": {
      summary: { revenue: "12.1M", sold: 33, bestChannel: "Facebook Ads" },
      variants: [
        { name: "L", sold: 11, stock: 3 },
        { name: "M", sold: 9, stock: 2 },
        { name: "XL", sold: 7, stock: 3 },
      ],
      channels: [
        { name: "Facebook Ads", revenue: "5.4M", percent: 45 },
        { name: "Website", revenue: "4.1M", percent: 34 },
        { name: "TikTok", revenue: "2.6M", percent: 21 },
      ],
      warehouses: [
        { name: "Kho Sài Gòn", stock: 4 },
        { name: "Kho Hà Nội", stock: 2 },
        { name: "Kho Online", stock: 2 },
      ],
    },
    "Vintage Olive Tee": {
      summary: { revenue: "8.7M", sold: 29, bestChannel: "Website" },
      variants: [
        { name: "Olive / XL", sold: 9, stock: 4 },
        { name: "Olive / L", sold: 8, stock: 5 },
        { name: "Olive / M", sold: 6, stock: 3 },
      ],
      channels: [
        { name: "Website", revenue: "4.5M", percent: 52 },
        { name: "TikTok", revenue: "2.3M", percent: 26 },
        { name: "Facebook Ads", revenue: "1.9M", percent: 22 },
      ],
      warehouses: [
        { name: "Kho Online", stock: 7 },
        { name: "Kho Hà Nội", stock: 5 },
        { name: "Kho Sài Gòn", stock: 3 },
      ],
    },
    "Heritage Sage Tee": {
      summary: { revenue: "6.5M", sold: 21, bestChannel: "Website" },
      variants: [
        { name: "Sage / L", sold: 8, stock: 4 },
        { name: "Sage / M", sold: 6, stock: 4 },
        { name: "Sage / XL", sold: 4, stock: 3 },
      ],
      channels: [
        { name: "Website", revenue: "3.8M", percent: 58 },
        { name: "Facebook Ads", revenue: "1.6M", percent: 25 },
        { name: "TikTok", revenue: "1.1M", percent: 17 },
      ],
      warehouses: [
        { name: "Kho Hà Nội", stock: 6 },
        { name: "Kho Online", stock: 3 },
        { name: "Kho Sài Gòn", stock: 2 },
      ],
    },
  };

  const warehouseStock = [
    { name: "Kho Hà Nội", value: 46 },
    { name: "Kho Sài Gòn", value: 32 },
    { name: "Kho Online", value: 22 },
  ];

  const channels = [
    { name: "Website", revenue: "61.2M", percent: 52, spend: "16.8M", spendPercent: 31 },
    { name: "Facebook", revenue: "34.8M", percent: 30, spend: "28.4M", spendPercent: 52 },
    { name: "TikTok", revenue: "14.5M", percent: 12, spend: "7.9M", spendPercent: 15 },
    { name: "Shopify checkout", revenue: "7.1M", percent: 6, spend: "1.2M", spendPercent: 2 },
  ];

  const funnel = [
    { step: "Visits", value: "18.4K", width: "100%" },
    { step: "Add to cart", value: "2.96K", width: "68%" },
    { step: "Checkout", value: "1.12K", width: "42%" },
    { step: "Purchase", value: "324", width: "24%" },
  ];

  const parseMoneyM = (value) => parseFloat(String(value).replace(/[^0-9.]/g, ""));
  const latestDayData = dailyRevenue[dailyRevenue.length - 1];
  const previousDayData = dailyRevenue[dailyRevenue.length - 2];
  const revenueAlert = parseFloat(latestDayData.revenue) < parseFloat(previousDayData.revenue);
  const roasAlert = parseFloat(latestDayData.roas) < 3;
  const lowStockAlert = topProducts.filter((item) => item.stock <= 10);
  const checkoutValue = parseFloat(funnel.find((x) => x.step === "Checkout")?.value.replace("K", "") || "0");
  const purchaseValue = parseFloat(funnel.find((x) => x.step === "Purchase")?.value.replace("K", "") || "0");
  const checkoutToPurchaseRate = checkoutValue > 0 ? (purchaseValue / (checkoutValue * 1000)) * 100 : 0;
  const todayRevenue = parseFloat(latestDayData.revenue);
  const yesterdayRevenue = parseFloat(previousDayData.revenue);
  const revenueDiff = todayRevenue - yesterdayRevenue;
  const revenueDiffPercent = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  const last7Days = dailyRevenue.slice(-7);
  const avg7dRevenue = last7Days.reduce((sum, item) => sum + parseFloat(item.revenue), 0) / last7Days.length;
  const avg7dRoas = last7Days.reduce((sum, item) => sum + parseFloat(item.roas), 0) / last7Days.length;
  const todayVs7dPercent = ((todayRevenue - avg7dRevenue) / avg7dRevenue) * 100;

  const enrichedProducts = topProducts.map((product, idx) => {
    const insight = productInsight[product.name];
    const avgRoas = dailyRevenue.slice(-7).reduce((sum, d) => sum + parseFloat(d.roas), 0) / 7;
    const revenueM = parseMoneyM(product.revenue);
    const estimatedAdSpend = revenueM / (avgRoas - idx * 0.18 + 0.12);
    const estimatedCogs = revenueM * costConfig.cogsRate;
    const estimatedShipping = (product.sold * costConfig.shippingPerOrder) / 1000000;
    const estimatedProfit = revenueM - estimatedAdSpend - estimatedCogs - estimatedShipping;
    const daysToStockout = product.stock > 0 ? Math.max(1, Math.round(product.stock / Math.max(1, product.sold / 7))) : 0;
    const dominantChannel = insight?.summary.bestChannel || "Website";
    const adjustedRoas = Number((avgRoas - idx * 0.18 + 0.12).toFixed(2));
    return {
      ...product,
      avgRoas: adjustedRoas,
      estimatedProfit: Number(estimatedProfit.toFixed(1)),
      daysToStockout,
      dominantChannel,
      isLowRoas: adjustedRoas < 3,
      isScaleLocked: daysToStockout < 5,
    };
  });

  const forecastStock = enrichedProducts
    .map((p) => ({ name: p.name, days: p.daysToStockout, stock: p.stock }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  const moneyFlowInsights = channels
    .map((channel) => ({
      ...channel,
      imbalance: channel.spendPercent - channel.percent,
    }))
    .sort((a, b) => Math.abs(b.imbalance) - Math.abs(a.imbalance));

  const liveAlerts = [
    revenueAlert
      ? { level: "critical", title: "Doanh thu hôm nay đang thấp hơn hôm qua", desc: `${latestDayData.revenue} so với ${previousDayData.revenue}. Nên kiểm tra ads và checkout ngay.` }
      : { level: "good", title: "Doanh thu hôm nay vẫn giữ ổn", desc: `${latestDayData.revenue} và chưa có dấu hiệu tụt mạnh so với hôm qua.` },
    roasAlert
      ? { level: "critical", title: "ROAS hôm nay dưới ngưỡng an toàn", desc: `ROAS hiện tại ${latestDayData.roas}. Nên rà lại nhóm ads và creative.` }
      : { level: "good", title: "ROAS hôm nay vẫn ở mức tốt", desc: `ROAS hiện tại ${latestDayData.roas}, vẫn đủ dư địa để giữ ngân sách.` },
    {
      level: lowStockAlert.length > 0 ? "warn" : "good",
      title: lowStockAlert.length > 0 ? "Có SKU cần theo dõi tồn kho gấp" : "Tồn kho đang ổn định",
      desc: lowStockAlert.length > 0 ? `${lowStockAlert.map((item) => item.name).join(", ")} đang tồn thấp, nên cân nhắc nhập thêm hoặc giảm ads.` : "Chưa có SKU nào rơi vào vùng tồn thấp.",
    },
  ];

  const decisionEngine = (products) => {
    const decisions = [];
    products.forEach((p) => {
      const reasons = [];
      let actionLabel = "Xem chi tiết";
      let priority = "medium";
      let confidence = 72;
      let route = "marketing";
      let type = "watch";
      let shortAction = "Theo dõi";

      if (decisionMode !== "inventory" && p.avgRoas >= 3.4 && p.stock > 10 && p.estimatedProfit > 3) {
        type = "scale";
        priority = "high";
        confidence = 91;
        actionLabel = "Mở Marketing";
        shortAction = "SCALE NGAY";
        route = "marketing";
        reasons.push(`ROAS TB ${p.avgRoas}x`, `tồn ${p.stock} sp`, `lãi ước tính ${p.estimatedProfit}M`);
      }
      if (p.daysToStockout <= 5 || p.stock <= 10 || decisionMode === "inventory") {
        type = "protect";
        priority = p.daysToStockout <= 3 ? "critical" : "high";
        confidence = p.daysToStockout <= 3 ? 96 : 88;
        actionLabel = "Mở Kho";
        shortAction = "BẢO VỆ TỒN";
        route = "inventory";
        reasons.push(`còn ${p.stock} sp`, `ước tính hết sau ${p.daysToStockout} ngày`);
      }
      if (decisionMode === "profit" && p.estimatedProfit < 2.5 && p.avgRoas < 3) {
        type = "cut";
        priority = "high";
        confidence = 89;
        actionLabel = "Rà ads";
        shortAction = "CẮT NGÂN SÁCH";
        route = "marketing";
        reasons.push(`profit thấp ${p.estimatedProfit}M`, `ROAS ${p.avgRoas}x`);
      }
      if (!reasons.length) return;
      decisions.push({
        type,
        title: shortAction,
        detailTitle: type === "scale" ? `Scale ${p.name}` : type === "protect" ? `Sắp hết hàng ${p.name}` : type === "cut" ? `Giảm ngân sách ${p.name}` : `Theo dõi ${p.name}`,
        desc: reasons.join(" • "),
        productName: p.name,
        channel: p.dominantChannel,
        confidence,
        priority,
        actionLabel,
        quickAction: type === "scale" ? "scale15" : type === "protect" ? "protect" : type === "cut" ? "auto_cut" : "watch",
        action: () => {
          setSelectedProduct(p.name);
          focusCommandCenter();
          setSelectedDecision({
            ...p,
            title: type === "scale" ? `Scale ${p.name}` : type === "protect" ? `Sắp hết hàng ${p.name}` : type === "cut" ? `Giảm ngân sách ${p.name}` : `Theo dõi ${p.name}`,
            desc: reasons.join(" • "),
            productName: p.name,
            channel: p.dominantChannel,
            confidence,
            priority,
            actionLabel,
            route,
            quickAction: type === "scale" ? "scale15" : type === "protect" ? "protect" : type === "cut" ? "auto_cut" : "watch",
          });
        },
      });
    });
    if (checkoutToPurchaseRate < 35) {
      decisions.push({
        type: "optimize",
        title: "FIX CHECKOUT",
        detailTitle: "Tối ưu bước checkout",
        desc: `Checkout → Purchase mới ${checkoutToPurchaseRate.toFixed(1)}%. Nên kiểm tra phí ship và UX thanh toán.`,
        productName: "Funnel system",
        channel: "Website",
        confidence: 93,
        priority: "critical",
        actionLabel: "Mở Orders",
        quickAction: "watch",
        action: () => {
          focusCommandCenter();
          setSelectedDecision({
            type: "optimize",
            title: "Tối ưu bước checkout",
            desc: `Checkout → Purchase mới ${checkoutToPurchaseRate.toFixed(1)}%. Nên kiểm tra phí ship và UX thanh toán.`,
            productName: "Funnel system",
            channel: "Website",
            confidence: 93,
            priority: "critical",
            actionLabel: "Mở Orders",
            route: "orders",
            quickAction: "watch",
          });
        },
      });
    }
    return decisions
      .sort((a, b) => {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        return (order[b.priority] || 0) - (order[a.priority] || 0) || b.confidence - a.confidence;
      })
      .slice(0, 4);
  };

  const decisionInsights = decisionEngine(enrichedProducts);
  const selectedProductMetrics = enrichedProducts.find((p) => p.name === selectedProduct);
  const selectedDecisionStatus = selectedDecision
    ? selectedDecision.priority === "critical"
      ? "Dừng ads"
      : selectedDecision.route === "inventory" || selectedProductMetrics?.isScaleLocked
      ? "HOLD"
      : selectedProductMetrics?.isLowRoas
      ? "OPTIMIZE"
      : "SAFE TO SCALE"
    : null;
  const selectedDecisionScore = selectedDecision
    ? Math.min(
        10,
        Math.max(
          1,
          Number(
            (((selectedDecision.confidence || 70) / 12) +
              (selectedDecision.priority === "critical" ? 1.6 : selectedDecision.priority === "high" ? 1.1 : 0.6) +
              (selectedDecisionStatus === "SAFE TO SCALE" ? 1.2 : selectedDecisionStatus === "OPTIMIZE" ? 0.7 : 0.4)).toFixed(1)
          )
        )
      )
    : null;
  const incidentLevel = revenueAlert && roasAlert && lowStockAlert.length > 0 ? "system_risk" : revenueAlert && roasAlert ? "critical" : lowStockAlert.length > 0 || roasAlert ? "warning" : "normal";

  const getScaleLevel = (p) => {
    if (!p) return "locked";
    const roas = p.avgRoas || 0;
    const orders = p.sold || 0;
    const daysToStockout = p.daysToStockout || 0;
    if (daysToStockout < 5) return "locked";
    if (roas >= 3.6 && orders >= 40) return "scale25";
    if (roas >= 3 && orders >= 20) return "scale15";
    return "watch";
  };
  const scaleLevel = selectedProductMetrics ? getScaleLevel(selectedProductMetrics) : "locked";

  const renderBadge = (text) => {
    const styles = {
      "Hôm nay": "bg-stone-900 text-white",
      "Hôm qua": "bg-stone-200 text-stone-900",
      "Trong tháng": "bg-stone-100 text-stone-600",
    };
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[text] || "bg-stone-100 text-stone-700"}`}>{text}</span>;
  };

  const renderAlertBadge = (level) => {
    const styles = {
      critical: "bg-red-100 text-red-700",
      warn: "bg-amber-100 text-amber-700",
      good: "bg-emerald-100 text-emerald-700",
      high: "bg-red-100 text-red-700",
      medium: "bg-amber-100 text-amber-700",
      low: "bg-stone-100 text-stone-700",
    };
    const labels = {
      critical: "Cảnh báo",
      warn: "Theo dõi",
      good: "Ổn định",
      high: "Ưu tiên cao",
      medium: "Ưu tiên vừa",
      low: "Ưu tiên thấp",
    };
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[level] || styles.good}`}>{labels[level] || "Ổn định"}</span>;
  };

  const renderDecisionStatus = (status) => {
    const styles = {
      "SAFE TO SCALE": "bg-emerald-100 text-emerald-700",
      HOLD: "bg-amber-100 text-amber-700",
      "Dừng ads": "bg-red-100 text-red-700",
      OPTIMIZE: "bg-blue-100 text-blue-700",
    };
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] || "bg-stone-100 text-stone-700"}`}>{status}</span>;
  };

  const systemStatus = (() => {
    if (incidentLevel === "system_risk") return { label: "SYSTEM STATUS: SYSTEM RISK", tone: "text-red-700", items: ["Doanh thu giảm", "ROAS rủi ro", `${lowStockAlert.length} SKU sắp hết`] };
    if (incidentLevel === "critical") return { label: "SYSTEM STATUS: CRITICAL", tone: "text-red-700", items: ["Doanh thu giảm", "ROAS cần can thiệp", "Kiểm tra ads ngay"] };
    if (incidentLevel === "warning") return { label: "SYSTEM STATUS: WARNING", tone: "text-amber-700", items: ["ROAS ổn", "Doanh thu giảm", `${lowStockAlert.length} SKU cảnh báo tồn`] };
    return { label: "SYSTEM STATUS: SAFE", tone: "text-emerald-700", items: ["Doanh thu ổn", "ROAS ổn", "Tồn kho cân bằng"] };
  })();

  const runDecisionAction = (decision, actionType) => {
    const requestedScale = actionType === "scale25" ? 25 : actionType === "scale15" ? 15 : 0;
    const guardedActionType = requestedScale > budgetGuard.maxScalePercent ? "scale15" : actionType;
    const actionMap = {
      scale15: "Tăng ngân sách +15%",
      scale25: "Tăng ngân sách +25%",
      protect: "Sắp hết hàng",
      audit: "Rà soát ngay",
      watch: "Đánh dấu theo dõi",
      auto_cut: "Auto giảm ngân sách",
      auto_lock: "Auto khóa scale",
    };
    const detailMap = {
      scale15: "Áp dụng tăng nhẹ cho nhóm hiệu quả tốt",
      scale25: "Áp dụng tăng mạnh cho SKU đang thắng",
      protect: "Giảm ưu tiên ads và theo dõi tồn kho sát hơn",
      audit: "Đưa vào danh sách kiểm tra trong ngày",
      watch: "Ghi chú để theo dõi ở ca vận hành tiếp theo",
      auto_cut: "Tự động giảm mức độ scale do rủi ro ROAS / profit",
      auto_lock: "Tự động khóa nút scale vì tồn kho xuống vùng nguy hiểm",
    };
    if (guardedActionType === "auto_cut" && budgetGuard.cutsUsedToday >= budgetGuard.maxDailyCuts) return;
    if (guardedActionType === "auto_cut") setBudgetGuard((prev) => ({ ...prev, cutsUsedToday: prev.cutsUsedToday + 1 }));
    setSelectedDecision({ ...decision, lastAction: actionMap[guardedActionType] });
    setActionLog((prev) => [{ id: Date.now() + Math.random(), time: "Bây giờ", title: `${metaConnection.mode === "live" ? "LIVE" : "SIM"} • ${actionMap[guardedActionType]} • ${decision.title || decision.detailTitle || decision.productName}`, detail: detailMap[guardedActionType] }, ...prev].slice(0, 6));
  };

  const requestDecisionAction = (decision, actionType) => {
    const needsApproval = approvalMode && ["scale15", "scale25", "protect"].includes(actionType);
    if (!decision) return;
    if (needsApproval) {
      setPendingApprovals((prev) => [{ id: `${Date.now()}-${actionType}`, title: decision.title || decision.detailTitle, actionType, reason: decision.desc, createdAt: "Bây giờ", decision }, ...prev].slice(0, 4));
      return;
    }
    runDecisionAction(decision, actionType);
  };

  const resolveApproval = (approvalId, approved) => {
    const item = pendingApprovals.find((x) => x.id === approvalId);
    if (!item) return;
    if (approved && item.decision) runDecisionAction(item.decision, item.actionType);
    setPendingApprovals((prev) => prev.filter((x) => x.id !== approvalId));
  };

  const resolveAllApprovals = (approved) => {
    const items = [...pendingApprovals];
    items.forEach((item) => {
      if (approved && item.decision) runDecisionAction(item.decision, item.actionType);
    });
    setPendingApprovals([]);
  };

  const maybeAutoRespond = (decision) => {
    if (!autoActionEnabled || !decision || !metaConnection.connected) return;
    const canTouchBudget = metaConnection.mode === "live";
    if (decision.priority === "critical") {
      runDecisionAction(decision, decision.route === "inventory" ? "auto_lock" : canTouchBudget ? "auto_cut" : "audit");
      return;
    }
    if (selectedProductMetrics?.isScaleLocked) {
      runDecisionAction(decision, "auto_lock");
      return;
    }
    if (autoMode === "SAFE") return;
    if (autoMode === "SEMI" && decision.type === "scale") {
      requestDecisionAction(decision, "scale15");
      return;
    }
    if (autoMode === "AGGRESSIVE") {
      if (decision.type === "scale") runDecisionAction(decision, canTouchBudget ? "scale15" : "watch");
      if (decision.type === "cut") runDecisionAction(decision, canTouchBudget ? "auto_cut" : "audit");
    }
  };

  const playAlertSound = (tone = "soft") => {
    if (!soundAlertsEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = tone === "critical" ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (tone === "critical" ? 0.35 : 0.2));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (tone === "critical" ? 0.35 : 0.2));
    } catch (e) {}
  };

  const undoLastAction = (logId) => {
    const item = actionLog.find((x) => x.id === logId);
    if (!item) return;
    setActionLog((prev) => [{ id: Date.now() + Math.random(), time: "Bây giờ", title: `UNDO • ${item.title}`, detail: "Rollback mô phỏng về trạng thái trước đó." }, ...prev.filter((x) => x.id !== logId)].slice(0, 6));
  };

  const runScheduledTask = (task) => {
    const targetDecision = decisionInsights[0];
    if (!targetDecision) return;
    if (task.action === "auto_cut") runDecisionAction(targetDecision, "auto_cut");
    if (task.action === "scale15") requestDecisionAction(targetDecision, "scale15");
  };

  useEffect(() => {
    if (pendingApprovals.length > lastPendingCount) playAlertSound("soft");
    if (incidentLevel === "critical" || incidentLevel === "system_risk") playAlertSound("critical");
    setLastPendingCount(pendingApprovals.length);
  }, [pendingApprovals.length, incidentLevel, soundAlertsEnabled]);

  const incidentTone = {
    system_risk: {
      wrap: "border-red-400 bg-red-100 shadow-[0_0_0_1px_rgba(248,113,113,0.3)] animate-pulse",
      label: "SYSTEM RISK",
      title: "Nhiều tín hiệu xấu cùng lúc — cần ưu tiên xử lý cấp tốc",
      sub: "Doanh thu, ROAS và tồn kho đang cùng tạo áp lực lên hệ thống.",
    },
    critical: {
      wrap: "border-red-300 bg-red-50 shadow-[0_0_0_1px_rgba(248,113,113,0.25)] animate-pulse",
      label: "CRITICAL",
      title: "Hiệu suất đang tụt mạnh — cần xử lý ngay trong ca này",
      sub: "ROAS và doanh thu đang cho tín hiệu xấu.",
    },
    warning: {
      wrap: "border-amber-300 bg-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]",
      label: "WARNING",
      title: "Có tín hiệu rủi ro cần theo dõi sát",
      sub: "Một số chỉ số đã chạm ngưỡng cảnh báo.",
    },
    normal: {
      wrap: "border-emerald-300 bg-emerald-50",
      label: "NORMAL",
      title: "Hệ thống đang ổn định",
      sub: "Chưa có cụm rủi ro lớn cần kích hoạt incident mode.",
    },
  };
  const incidentUi = incidentTone[incidentLevel];

  return (
    <>
      {pendingApprovals.length > 0 && floatingApprovalOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[320px] rounded-3xl border border-stone-700 bg-stone-900 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-stone-700 p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Approval</div>
              <div className="text-sm font-medium">{pendingApprovals.length} pending</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => resolveAllApprovals(true)} className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-stone-900">Duyệt tất</button>
              <button onClick={() => setFloatingApprovalOpen(false)} className="text-xs text-stone-400 hover:text-white">Ẩn</button>
            </div>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="border-b border-stone-800 p-4">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-xs text-stone-400">{item.actionType}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => resolveApproval(item.id, true)} className="flex-1 rounded-full bg-white py-1 text-xs text-stone-900">Duyệt</button>
                  <button onClick={() => resolveApproval(item.id, false)} className="flex-1 rounded-full border border-stone-600 py-1 text-xs">Từ chối</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6 font-[Georgia] text-stone-900">
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="font-sans text-xs uppercase tracking-[0.24em] text-stone-500">Autopilot Ecom System</div>
              <h2 className="mt-2 text-3xl">{systemStatus.label}</h2>
              <div className={`mt-2 font-sans text-sm ${systemStatus.tone}`}>{systemStatus.items.join(" • ")}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:w-[520px]">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-xs uppercase tracking-[0.16em] text-neutral-400">Auto mode</div><div className="mt-2 flex gap-2">{["SAFE","SEMI","AGGRESSIVE"].map((mode)=><button key={mode} onClick={()=>setAutoMode(mode)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${autoMode===mode?"bg-stone-900 text-white":"border border-stone-300 bg-white text-stone-700"}`}>{mode}</button>)}</div></div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-xs uppercase tracking-[0.16em] text-neutral-400">Meta</div><div className="mt-2 text-sm font-medium">{metaConnection.connected ? metaConnection.mode === "live" ? "LIVE READY" : "DRY RUN" : "NOT CONNECTED"}</div><div className="mt-1 text-xs text-neutral-500">{metaConnection.account}</div></div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-xs uppercase tracking-[0.16em] text-neutral-400">Auto scheduler</div><div className="mt-2 text-sm font-medium">{scheduledTasks.length} lịch chạy</div><div className="mt-1 text-xs text-neutral-500">09:00 / 20:00</div></div>
            </div>
          </div>
        </section>

        {incidentLevel !== "normal" && (
          <div className={`rounded-3xl border p-5 shadow-sm ${incidentUi.wrap}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-sans text-xs uppercase tracking-[0.3em] text-stone-600">{incidentUi.label}</div>
                <h2 className="mt-2 text-2xl text-stone-900">{incidentUi.title}</h2>
                <div className="mt-2 font-sans text-sm text-stone-600">{incidentUi.sub}</div>
              </div>
              <div className="flex items-center gap-2">
                {renderAlertBadge(incidentLevel === "system_risk" ? "critical" : incidentLevel === "critical" ? "high" : "warn")}
                <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-stone-700">War Room Activated</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/80 p-4"><div className="text-sm text-stone-500">Doanh thu</div><div className={`mt-2 text-lg font-semibold ${revenueAlert ? "text-red-600" : "text-emerald-600"}`}>{revenueAlert ? "Đang giảm" : "Ổn định"}</div></div>
              <div className="rounded-2xl bg-white/80 p-4"><div className="text-sm text-stone-500">ROAS</div><div className={`mt-2 text-lg font-semibold ${roasAlert ? "text-red-600" : "text-emerald-600"}`}>{roasAlert ? "Dưới ngưỡng 3" : "An toàn"}</div></div>
              <div className="rounded-2xl bg-white/80 p-4"><div className="text-sm text-stone-500">Tồn kho</div><div className={`mt-2 text-lg font-semibold ${lowStockAlert.length > 0 ? "text-red-600" : "text-emerald-600"}`}>{lowStockAlert.length > 0 ? `${lowStockAlert.length} SKU sắp hết` : "Ổn định"}</div></div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-sans text-sm text-stone-700">
              <span>Ưu tiên xử lý: kiểm tra ads → checkout → tồn kho.</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2">
                  <input type="checkbox" checked={autoActionEnabled} onChange={(e) => setAutoActionEnabled(e.target.checked)} />
                  <span>Auto Action</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2">
                  <input type="checkbox" checked={soundAlertsEnabled} onChange={(e) => setSoundAlertsEnabled(e.target.checked)} />
                  <span>Sound Alert</span>
                </label>
                <button onClick={() => setMetaConnection((prev) => ({ ...prev, mode: prev.mode === "live" ? "dry_run" : "live" }))} className={`rounded-full px-3 py-2 text-xs font-medium ${metaConnection.mode === "live" ? "bg-red-100 text-red-700" : "bg-stone-900 text-white"}`}>
                  {metaConnection.mode === "live" ? "LIVE MODE" : "DRY RUN"}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="font-sans text-xs uppercase tracking-[0.24em] text-stone-500">Bộ lọc nhanh</div>
              <div className="mt-2 flex flex-wrap gap-2 font-sans">
                {[
                  { key: "today", label: "Hôm nay" },
                  { key: "7d", label: "7 ngày" },
                  { key: "30d", label: "30 ngày" },
                  { key: "month", label: "Tháng này" },
                ].map((item) => (
                  <button key={item.key} onClick={() => setRange(item.key)} className={`rounded-full px-4 py-2 text-sm transition ${range === item.key ? "bg-stone-900 text-white" : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"}`}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:w-[420px]">
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm font-sans text-stone-700 outline-none">
                <option value="all">Tất cả kênh</option>
                <option value="website">Website</option>
                <option value="facebook">Facebook Ads</option>
                <option value="tiktok">TikTok</option>
                <option value="shopify">Shopify checkout</option>
              </select>
              <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm font-sans text-stone-700 outline-none">
                <option value="all">Tất cả chi nhánh / kho</option>
                <option value="hn">Kho Hà Nội</option>
                <option value="sg">Kho Sài Gòn</option>
                <option value="online">Kho Online</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="font-sans text-xs uppercase tracking-[0.24em] text-stone-500">Decision AI Pro</div>
              <h2 className="mt-2 text-2xl">Động cơ ra quyết định</h2>
              <p className="mt-1 font-sans text-sm text-stone-500">Ưu tiên theo lợi nhuận, tồn kho, ROAS và điểm nghẽn funnel.</p>
            </div>
            <div className="flex flex-wrap gap-2 font-sans">
              {[
                { key: "profit", label: "Ưu tiên profit" },
                { key: "growth", label: "Ưu tiên tăng trưởng" },
                { key: "inventory", label: "Ưu tiên tồn kho" },
              ].map((mode) => (
                <button key={mode.key} onClick={() => setDecisionMode(mode.key)} className={`rounded-full px-4 py-2 text-sm transition ${decisionMode === mode.key ? "bg-stone-900 text-white" : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"}`}>{mode.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="grid h-fit auto-rows-min content-start grid-cols-1 gap-4 self-start xl:grid-cols-2">
              {decisionInsights.map((item) => (
                <div key={item.detailTitle} className={`h-[168px] overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition ${selectedDecision?.title === item.detailTitle ? "border-stone-900 bg-stone-100" : "border-stone-200 bg-stone-50 hover:shadow-md"}`}>
                  <button onClick={() => { item.action(); maybeAutoRespond(item); }} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{item.title}</div>
                        <div className="mt-1 text-base font-medium text-stone-900">{item.detailTitle}</div>
                      </div>
                      {renderAlertBadge(item.priority)}
                    </div>
                    <div className="mt-1 min-h-[34px] line-clamp-2 font-sans text-xs text-stone-600">{item.desc}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-sans text-stone-500">
                      <span>{item.channel}</span>
                      <span>{item.confidence}%</span>
                    </div>
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate font-sans text-xs text-stone-700">{item.productName}</div>
                    <div className="flex gap-2">
                      <button onClick={() => { item.action(); requestDecisionAction(item, item.quickAction); }} className="rounded-full bg-stone-900 px-3 py-1.5 text-[11px] font-medium text-white">Execute</button>
                      <button onClick={() => item.action()} className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-800">Open</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div ref={commandCenterRef} className="rounded-3xl border border-stone-200 bg-stone-900 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-sans text-xs uppercase tracking-[0.24em] text-stone-400">Command Center</div>
                  <h3 className="mt-2 text-2xl">Hành động ngay trên Tổng quan</h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDecisionStatus ? renderDecisionStatus(selectedDecisionStatus) : null}
                  {selectedDecisionScore ? <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-900">Score {selectedDecisionScore}/10</span> : null}
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${metaConnection.mode === "live" ? "bg-red-100 text-red-700" : "bg-white/10 text-white"}`}>{metaConnection.mode === "live" ? "Live execution" : "Dry run only"}</span>
                  {selectedDecision?.priority ? renderAlertBadge(selectedDecision.priority) : <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Chọn 1 decision</span>}
                </div>
              </div>

              {selectedDecision ? (
                <>
                  <div className="mt-5 rounded-3xl border border-stone-700 bg-white/5 p-4">
                    <div className="text-lg font-medium">{selectedDecision.title}</div>
                    <div className="mt-2 font-sans text-sm text-stone-300">{selectedDecision.desc}</div>
                    <div className="mt-4 grid grid-cols-2 gap-3 font-sans text-sm">
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-stone-400">SKU / nhóm</div><div className="mt-1 text-white">{selectedDecision.productName}</div></div>
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-stone-400">Kênh</div><div className="mt-1 text-white">{selectedDecision.channel}</div></div>
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-stone-400">Decision score</div><div className="mt-1 text-white">{selectedDecisionScore ? `${selectedDecisionScore}/10` : "—"}</div></div>
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-stone-400">Action cuối</div><div className="mt-1 text-white">{selectedDecision.lastAction || "Chưa chạy"}</div></div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 font-sans text-sm">
                    <button onClick={() => requestDecisionAction(selectedDecision, "scale15")} disabled={scaleLevel === "locked" || !metaConnection.connected} className={`rounded-2xl px-4 py-3 font-medium transition ${scaleLevel === "locked" ? "cursor-not-allowed bg-stone-300 text-stone-500 line-through" : "bg-white text-stone-900 hover:bg-stone-200"}`}>
                      {scaleLevel === "locked" ? "🔒 Khóa scale" : scaleLevel === "scale25" || scaleLevel === "scale15" ? "+15% ngân sách" : "Theo dõi"}
                    </button>
                    <button onClick={() => requestDecisionAction(selectedDecision, "scale25")} disabled={scaleLevel !== "scale25" || !metaConnection.connected} className={`rounded-2xl px-4 py-3 font-medium transition ${scaleLevel !== "scale25" || !metaConnection.connected ? "cursor-not-allowed bg-stone-700/40 text-stone-400 line-through" : "bg-stone-700 text-white hover:bg-stone-600"}`}>
                      {scaleLevel === "locked" ? "🔒 Khóa scale" : scaleLevel === "scale25" ? "+25% ngân sách" : "Chưa đủ điều kiện"}
                    </button>
                    <button onClick={() => requestDecisionAction(selectedDecision, "protect")} className="rounded-2xl border border-stone-600 px-4 py-3 text-white hover:bg-white/10">Sắp hết hàng</button>
                    <button onClick={() => runDecisionAction(selectedDecision, "audit")} className="rounded-2xl border border-stone-600 px-4 py-3 text-white hover:bg-white/10">Cần kiểm tra</button>
                  </div>

                  <div className="mt-5 rounded-3xl border border-stone-700 p-4">
                    {pendingApprovals.length > 0 && (
                      <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-100/10 p-3">
                        <div className="font-sans text-xs uppercase tracking-[0.18em] text-amber-300">Approval queue</div>
                        <div className="mt-3 space-y-2">
                          {pendingApprovals.map((item) => (
                            <div key={item.id} className="rounded-2xl bg-white/5 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-white">{item.title}</div>
                                  <div className="mt-1 font-sans text-xs text-stone-300">{item.actionType} • {item.createdAt}</div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => resolveApproval(item.id, true)} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-900">Duyệt</button>
                                  <button onClick={() => resolveApproval(item.id, false)} className="rounded-full border border-stone-500 px-3 py-1 text-xs text-white">Từ chối</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mb-4 rounded-2xl border border-stone-700 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-sans text-xs uppercase tracking-[0.18em] text-stone-400">Auto Scheduler</div>
                        <div className="flex gap-2">
                          {scheduledTasks.map((task) => (
                            <button key={task.id} onClick={() => runScheduledTask(task)} className="rounded-full border border-stone-500 px-3 py-1 text-[11px] text-white hover:bg-white/10">{task.time}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mb-4 rounded-2xl bg-white/5 p-3 font-sans text-xs text-stone-300">
                      {metaConnection.connected ? (metaConnection.mode === "live" ? `Meta Ads đang ở chế độ LIVE. Các action hợp lệ sẽ có thể được đẩy sang ${metaConnection.account} khi tích hợp API thật.` : "Meta Ads đang ở chế độ DRY RUN. Hệ thống hiện chỉ mô phỏng lệnh và ghi log.") : "Chưa kết nối Meta Ads. Auto Action sẽ không tác động ra ngoài."}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-sans text-sm uppercase tracking-[0.18em] text-stone-400">Action log</div>
                      <div className="flex gap-2">
                        <button onClick={() => resolveAllApprovals(true)} className="rounded-full border border-stone-600 px-3 py-1 text-xs text-white hover:bg-white/10">Duyệt tất</button>
                        <button onClick={() => resolveAllApprovals(false)} className="rounded-full border border-stone-600 px-3 py-1 text-xs text-white hover:bg-white/10">Từ chối tất</button>
                        <button onClick={() => runDecisionAction(selectedDecision, "watch")} className="rounded-full border border-stone-600 px-3 py-1 text-xs text-white hover:bg-white/10">Ghi chú</button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {actionLog.map((log) => (
                        <div key={log.id} className="rounded-2xl bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-white">{log.title}</div>
                            <div className="text-xs text-stone-400">{log.time}</div>
                          </div>
                          <div className="mt-1 font-sans text-xs text-stone-300">{log.detail}</div>
                          {["Tăng ngân sách", "Auto giảm", "LIVE", "SIM"].some((word) => log.title.includes(word)) && (
                            <button onClick={() => undoLastAction(log.id)} className="mt-2 rounded-full border border-stone-500 px-3 py-1 text-[11px] text-white hover:bg-white/10">Undo</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-3xl border border-stone-700 bg-white/5 p-5 font-sans text-sm text-stone-300">Chọn một quyết định ở bên trái để xem ngữ cảnh và xử lý ngay tại màn Tổng quan.</div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {liveAlerts.map((alert) => (
            <div key={alert.title} className={`rounded-3xl border p-5 shadow-sm ${alert.level === "critical" ? "border-red-200 bg-red-50" : alert.level === "warn" ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg">{alert.title}</div>
                {renderAlertBadge(alert.level)}
              </div>
              <div className="mt-3 font-sans text-sm text-stone-600">{alert.desc}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="col-span-1 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-4">
            <div>
              <div className="font-sans text-xs uppercase tracking-[0.24em] text-stone-500">War Room</div>
              <h2 className="mt-2 text-2xl">Tình trạng realtime hôm nay</h2>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 font-sans">
              {[
                { key: "live", label: "Realtime" },
                { key: "compare", label: "So với 7 ngày" },
                { key: "forecast", label: "Forecast tồn kho" },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setWarRoomTab(tab.key)} className={`rounded-full px-4 py-2 text-sm transition ${warRoomTab === tab.key ? "bg-stone-900 text-white" : "border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100"}`}>{tab.label}</button>
              ))}
            </div>
            {warRoomTab === "live" && (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 p-4"><div className="font-sans text-sm text-stone-500">So với hôm qua</div><div className="mt-2 text-2xl font-semibold">{revenueDiff >= 0 ? "+" : ""}{revenueDiff.toFixed(1)}M</div><div className={`text-sm ${revenueDiffPercent >= 0 ? "text-green-600" : "text-red-600"}`}>{revenueDiffPercent.toFixed(1)}%</div></div>
                <div className={`rounded-2xl p-4 ${checkoutToPurchaseRate < 35 ? "bg-red-50 ring-1 ring-red-200" : "bg-stone-50"}`}><div className="font-sans text-sm text-stone-500">Checkout → Purchase</div><div className="mt-2 text-2xl font-semibold">{checkoutToPurchaseRate.toFixed(1)}%</div><div className="text-sm text-stone-500">Điểm nghẽn funnel</div></div>
                <div className="rounded-2xl bg-stone-50 p-4"><div className="font-sans text-sm text-stone-500">Sắp hết hàng</div><div className="mt-2 space-y-1">{forecastStock.map((item) => <div key={item.name} className="text-sm text-stone-700">{item.name} • {item.days} ngày</div>)}</div></div>
              </div>
            )}
            {warRoomTab === "compare" && (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 p-4"><div className="font-sans text-sm text-stone-500">Doanh thu hôm nay</div><div className="mt-2 text-2xl font-semibold">{todayRevenue.toFixed(1)}M</div><div className={`text-sm ${todayVs7dPercent >= 0 ? "text-green-600" : "text-red-600"}`}>{todayVs7dPercent >= 0 ? "+" : ""}{todayVs7dPercent.toFixed(1)}% so với TB 7 ngày</div></div>
                <div className="rounded-2xl bg-stone-50 p-4"><div className="font-sans text-sm text-stone-500">TB doanh thu 7 ngày</div><div className="mt-2 text-2xl font-semibold">{avg7dRevenue.toFixed(1)}M</div><div className="text-sm text-stone-500">Chuẩn tham chiếu ngắn hạn</div></div>
                <div className={`rounded-2xl p-4 ${avg7dRoas < 3 ? "bg-red-50 ring-1 ring-red-200" : "bg-stone-50"}`}><div className="font-sans text-sm text-stone-500">ROAS TB 7 ngày</div><div className="mt-2 text-2xl font-semibold">{avg7dRoas.toFixed(2)}x</div><div className="text-sm text-stone-500">Mốc quyết định giữ / scale ads</div></div>
              </div>
            )}
            {warRoomTab === "forecast" && (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {forecastStock.map((item) => (
                  <div key={item.name} className={`rounded-2xl p-4 ${item.days < 5 ? "bg-amber-50 ring-1 ring-amber-200" : "bg-stone-50"}`}>
                    <div className="font-sans text-sm text-stone-500">{item.name}</div>
                    <div className="mt-2 text-2xl font-semibold">{item.days} ngày</div>
                    <div className="text-sm text-stone-500">Tồn hiện tại: {item.stock} sản phẩm</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {kpis.map((item) => (
            <div key={item.label} className={`rounded-3xl border p-5 shadow-sm ${item.label === "ROAS" && parseFloat(latestDayData.roas) < 3 ? "border-red-200 bg-red-50" : "border-stone-200 bg-white"}`}>
              <div className="font-sans text-sm text-stone-500">{item.label}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-3xl leading-none">{item.value}</div>
                <div className="rounded-full bg-stone-100 px-3 py-1 font-sans text-xs font-medium text-stone-700">{item.delta}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl">Doanh thu từng ngày trong tháng</h2>
                <p className="mt-1 font-sans text-sm text-stone-500">Mở ra là thấy ngay hôm nay, hôm qua và các ngày gần nhất bán được bao nhiêu</p>
              </div>
              <div className="rounded-full bg-stone-100 px-4 py-2 font-sans text-sm text-stone-700">Tháng 03</div>
            </div>
            <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200">
              <div className="grid grid-cols-[72px_1fr_110px_90px_90px_110px] bg-stone-900 px-4 py-3 font-sans text-xs uppercase tracking-[0.18em] text-stone-300">
                <div>Ngày</div><div>Ghi chú</div><div className="text-right">Doanh thu</div><div className="text-right">Đơn</div><div className="text-right">ROAS</div><div className="text-right">So với hôm qua</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto bg-white">
                {dailyRevenue.slice().reverse().map((item, index) => {
                  const latestDay = dailyRevenue[dailyRevenue.length - 1]?.day;
                  const yesterdayDay = dailyRevenue[dailyRevenue.length - 2]?.day;
                  const note = item.day === latestDay ? "Hôm nay" : item.day === yesterdayDay ? "Hôm qua" : "Trong tháng";
                  const currentIndex = dailyRevenue.findIndex((d) => d.day === item.day);
                  const prev = dailyRevenue[currentIndex - 1];
                  let change = null;
                  if (prev) {
                    const curVal = parseFloat(item.revenue);
                    const prevVal = parseFloat(prev.revenue);
                    change = ((curVal - prevVal) / prevVal) * 100;
                  }
                  const isSelected = selectedDay === item.day;
                  return (
                    <div key={item.day} onClick={() => setSelectedDay(item.day)} className={`grid cursor-pointer grid-cols-[72px_1fr_110px_90px_90px_110px] items-center px-4 py-3 font-sans text-sm transition ${isSelected ? "bg-stone-100" : "hover:bg-stone-50"} ${index !== dailyRevenue.length - 1 ? "border-b border-stone-100" : ""}`}>
                      <div className="font-medium text-stone-900">{item.day}</div>
                      <div>{renderBadge(note)}</div>
                      <div className="text-right font-medium text-stone-900">{item.revenue}</div>
                      <div className="text-right text-stone-600">{item.orders}</div>
                      <div className="text-right font-medium text-stone-900">{item.roas}</div>
                      <div className="text-right">{change !== null ? <span className={`text-sm font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</span> : <span className="text-stone-400">—</span>}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedDay && dailyDetail[selectedDay] && (
              <div className="mt-5 rounded-3xl border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-sans text-xs uppercase tracking-[0.24em] text-stone-500">Drill-down ngày {selectedDay}</div>
                    <h3 className="mt-2 text-2xl">Chi tiết vận hành trong ngày</h3>
                  </div>
                  <button onClick={() => setSelectedDay(null)} className="rounded-full border border-stone-300 bg-white px-4 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100">Đóng chi tiết</button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-5">
                  <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="font-sans text-sm text-stone-500">Doanh thu</div><div className="mt-2 text-3xl">{dailyDetail[selectedDay].summary.revenue}</div></div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="font-sans text-sm text-stone-500">Đơn hàng</div><div className="mt-2 text-3xl">{dailyDetail[selectedDay].summary.orders}</div></div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm"><div className="font-sans text-sm text-stone-500">Chi phí ads</div><div className="mt-2 text-3xl">{dailyDetail[selectedDay].summary.adSpend}</div></div>
                  <div className="rounded-3xl bg-stone-900 p-4 text-white shadow-sm"><div className="font-sans text-sm text-stone-400">ROAS ngày</div><div className="mt-2 text-3xl">{dailyDetail[selectedDay].summary.roas}</div></div>
                  <div className="rounded-3xl bg-emerald-100 p-4 shadow-sm"><div className="font-sans text-sm text-emerald-700">Lợi nhuận ước tính</div><div className="mt-2 text-3xl text-emerald-900">{(() => {
                    const revenue = parseFloat(dailyDetail[selectedDay].summary.revenue);
                    const ad = parseFloat(dailyDetail[selectedDay].summary.adSpend);
                    const cogs = revenue * costConfig.cogsRate;
                    const ship = (dailyDetail[selectedDay].summary.orders * costConfig.shippingPerOrder) / 1000000;
                    const profit = revenue - ad - cogs - ship;
                    return profit.toFixed(1) + "M";
                  })()}</div></div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl">Funnel</h2>
              <p className="mt-1 font-sans text-sm text-stone-500">Từ traffic tới purchase</p>
              <div className="mt-6 space-y-4">
                {funnel.map((item) => (
                  <div key={item.step}>
                    <div className="mb-2 flex items-center justify-between font-sans text-sm"><span className="text-stone-700">{item.step}</span><span className="font-medium text-stone-900">{item.value}</span></div>
                    <div className="h-4 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-stone-800" style={{ width: item.width }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl">Money Flow Insight</h2>
              <p className="mt-1 font-sans text-sm text-stone-500">Tiền đang chảy ở đâu, kênh nào đang đốt mạnh hơn phần doanh thu mang về.</p>
              <div className="mt-5 space-y-3">
                {moneyFlowInsights.slice(0, 4).map((item) => (
                  <div key={item.name} className={`rounded-2xl border p-4 ${item.imbalance > 8 ? "border-red-200 bg-red-50" : item.imbalance < -8 ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-stone-50"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{item.name}</div>
                      <Badge tone={item.imbalance > 8 ? "red" : item.imbalance < -8 ? "green" : "amber"}>{item.imbalance > 8 ? "Inefficient" : item.imbalance < -8 ? "Efficient" : "Balanced"}</Badge>
                    </div>
                    <div className="mt-2 font-sans text-sm text-stone-600">Chi {item.spendPercent}% ngân sách nhưng mang về {item.percent}% doanh thu.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl">Top sản phẩm</h2><p className="mt-1 font-sans text-sm text-stone-500">Những SKU đang kéo doanh thu mạnh nhất</p></div></div>
            <div className="mt-5 space-y-3">
              {topProducts.map((item, idx) => (
                <button key={item.name} onClick={() => setSelectedProduct(item.name)} className={`grid w-full grid-cols-[40px_1fr_auto_auto] items-center gap-3 rounded-2xl px-4 py-3 text-left font-sans transition ${selectedProduct === item.name ? "bg-stone-100 ring-1 ring-stone-300" : "bg-stone-50 hover:bg-stone-100"}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-sm text-white">{idx + 1}</div>
                  <div><div className="font-medium text-stone-900">{item.name}</div><div className="text-xs text-stone-500">{item.category} • Tồn kho: {item.stock}</div></div>
                  <div className="text-sm text-stone-600">{item.sold} sp</div>
                  <div className="text-sm font-medium text-stone-900">{item.revenue}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl">Doanh thu theo kênh</h2>
            <p className="mt-1 font-sans text-sm text-stone-500">Nhìn nhanh website, Facebook, TikTok, Shopify checkout</p>
            <div className="mt-5 space-y-4">
              {channels.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between font-sans text-sm"><span>{item.name}</span><span className="font-medium">{item.revenue}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-stone-800" style={{ width: `${item.percent}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div><h2 className="text-2xl">Kho & phân bổ tồn</h2><p className="mt-1 font-sans text-sm text-stone-500">Theo từng kho để nhập hàng và điều chuyển cho chuẩn</p></div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {warehouseStock.map((item) => (
                <div key={item.name} className="rounded-3xl bg-stone-50 p-5 text-center font-sans">
                  <div className="text-sm text-stone-500">{item.name}</div>
                  <div className="mt-3 text-4xl font-semibold text-stone-900">{item.value}%</div>
                  <div className="mt-2 text-xs text-stone-500">Tỷ trọng tồn kho hiện tại</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-stone-900 p-5 text-stone-100 shadow-sm">
            <div className="text-xs uppercase tracking-[0.28em] text-stone-400">Quick Insight</div>
            <h2 className="mt-3 text-2xl leading-tight">Điểm cần chú ý hôm nay</h2>
            <div className="mt-5 space-y-4 font-sans text-sm text-stone-300">
              <div className="rounded-2xl border border-stone-700 p-4">Website đang đóng góp <span className="font-medium text-white">52%</span> doanh thu toàn kênh.</div>
              <div className="rounded-2xl border border-stone-700 p-4">Mẫu <span className="font-medium text-white">SM902 Rêu Đen</span> chỉ còn tồn thấp, nên nhập thêm sớm.</div>
              <div className="rounded-2xl border border-stone-700 p-4">Funnel từ checkout → purchase còn hụt, nên theo dõi bước thanh toán kỹ hơn.</div>
              <button onClick={() => setTab("ads")} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-stone-900">Mở Ads Command</button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ReportsPage({ orders, products }) {
  const today = "2026-03-25";
  const ordersToday = orders.filter((o) => String(o.createdAt).startsWith(today));
  const successfulToday = ordersToday.filter((o) => o.paymentStatus === "PAID");
  const revenueToday = successfulToday.reduce((sum, o) => sum + o.grandTotal, 0);

  const costMap = Object.fromEntries(
    products.flatMap((p) => p.variants.map((v) => [v.id, Number(v.costPrice || 0)]))
  );
  const profitToday = successfulToday.reduce((sum, o) => {
    return (
      sum +
      o.items.reduce(
        (s, i) => s + (i.unitPrice - Number(costMap[i.variantId] || 0)) * i.qty,
        0
      )
    );
  }, 0);
  const roasReal = revenueToday ? (profitToday / revenueToday).toFixed(2) : 0;

  const byChannel = ["ADMIN", "VN_WEB", "FACEBOOK", "TIKTOK"].map((channel) => ({
    channel,
    count: ordersToday.filter((o) => o.salesChannel === channel).length,
    revenue: ordersToday
      .filter((o) => o.salesChannel === channel && o.paymentStatus === "PAID")
      .reduce((s, o) => s + o.grandTotal, 0),
  }));

  return (
    <div className="space-y-6">
      <SectionTitle title="Báo cáo" description="Admin only · nhìn thẳng vào tiền thật + quyết định ads." />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Đơn hôm nay" value={ordersToday.length} sub="Tổng đơn" />
        <StatCard title="Đơn paid" value={successfulToday.length} sub="Đơn thành công" />
        <StatCard title="Doanh thu" value={currency(revenueToday)} sub="Gross" />
        <StatCard title="Lợi nhuận" value={currency(profitToday)} sub="Sau giá vốn" />
        <StatCard title="ROAS thật" value={roasReal} sub="Profit / Revenue" />
      </div>

      <Panel>
        <div className="p-5">
          <h3 className="text-lg font-semibold">Hiệu quả theo kênh bán</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-500">
                <tr>
                  <th className="pb-3 font-medium">Kênh</th>
                  <th className="pb-3 font-medium">Số đơn</th>
                  <th className="pb-3 font-medium">Đơn paid</th>
                  <th className="pb-3 font-medium">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map((row) => {
                  const paidCount = ordersToday.filter(
                    (o) => o.salesChannel === row.channel && o.paymentStatus === "PAID"
                  ).length;
                  return (
                    <tr key={row.channel} className="border-t border-neutral-200">
                      <td className="py-3">{row.channel}</td>
                      <td className="py-3">{row.count}</td>
                      <td className="py-3">{paidCount}</td>
                      <td className="py-3">{currency(row.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ProductsPage({ products, onCreateProduct, onAddVariant, onToggleProductStatus, onGenerateVariants, onUpdateVariantPricing, productAuditLogs, isAdmin }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);
  const [detailProductId, setDetailProductId] = useState(null);
  const [imageName, setImageName] = useState("");
  const [editingPrices, setEditingPrices] = useState({});

  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "T-Shirt",
    productType: "Core",
    brand: "The 1970",
    weight: "",
    imageUrl: "",
    description: "",
    defaultPrice: "",
    defaultCostPrice: "",
    colorOptions: "Black, White, Green, Tobacco",
    sizeOptions: "S, M, L, XL",
    defaultBranchStocks: { b1: "", b2: "", b3: "" },
  });

  const [variantForm, setVariantForm] = useState({
    sku: "",
    color: "",
    size: "",
    price: "",
    costPrice: "",
    branchStocks: { b1: "", b2: "", b3: "" },
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter((p) => {
      const matchQuery =
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q));
      const matchCategory = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchQuery && matchCategory && matchStatus;
    });
  }, [products, query, categoryFilter, statusFilter]);

  const activeProduct = products.find((p) => p.id === activeProductId) || null;
  const detailProduct = products.find((p) => p.id === detailProductId) || null;
  const detailLogs = detailProduct ? productAuditLogs.filter((log) => log.productId === detailProduct.id).slice(0, 8) : [];
  const suggestedColors = activeProduct?.colorOptions || [];
  const suggestedSizes = activeProduct?.sizeOptions || [];
  const totalVariants = products.reduce((sum, product) => sum + product.variants.length, 0);
  const activeProducts = products.filter((p) => p.status === "ACTIVE").length;
  const lowStockCount = products.flatMap((p) => p.variants).filter((v) => v.stock <= 3).length;
  const totalCatalogValue = products.flatMap((p) => p.variants).reduce((sum, v) => sum + Number(v.price || 0) * Number(v.stock || 0), 0);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, imageUrl: localUrl }));
    setImageName(file.name);
  };

  const resetProductForm = () => {
    setForm({
      name: "",
      slug: "",
      category: "T-Shirt",
      productType: "Core",
      brand: "The 1970",
      weight: "",
      imageUrl: "",
      description: "",
      defaultPrice: "",
      defaultCostPrice: "",
      colorOptions: "Black, White, Green, Tobacco",
      sizeOptions: "S, M, L, XL",
      defaultBranchStocks: { b1: "", b2: "", b3: "" },
    });
    setImageName("");
  };

  const resetVariantForm = () => {
    setVariantForm({
      sku: "",
      color: "",
      size: "",
      price: "",
      costPrice: "",
      branchStocks: { b1: "", b2: "", b3: "" },
    });
  };

  const branchQtyForProduct = (product, branchId) => product.variants.reduce((sum, variant) => sum + Number(variant.branchStocks?.[branchId] || 0), 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Sản phẩm"
        description="Catalog gọn hơn: xem nhanh tình trạng sản phẩm, tồn và giá trị hàng đang treo trên catalog."
        action={isAdmin ? <Button onClick={() => setOpen(true)}>+ Thêm sản phẩm</Button> : null}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sản phẩm active" value={activeProducts} sub="Đang cho phép bán" />
        <StatCard title="Tổng variants" value={totalVariants} sub="Tất cả size / màu đang có" />
        <StatCard title="SKU tồn thấp" value={lowStockCount} sub="<= 3 sản phẩm" />
        <StatCard title="Giá trị catalog" value={currency(totalCatalogValue)} sub="Giá bán x tồn kho" />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo sản phẩm mới">
        <div className="grid gap-4">
          <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên sản phẩm" />
          <div className="grid gap-4 md:grid-cols-2">
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Mã sản phẩm / slug" />
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {productGroups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
              {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
              {brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Khối lượng" />
              <div className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-500">g</div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div className="space-y-3">
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Link ảnh đại diện / thumbnail" />
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600 hover:bg-neutral-50">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                Tải ảnh từ máy
              </label>
              {imageName ? <p className="text-xs text-neutral-500">Đã chọn: {imageName}</p> : null}
            </div>
            <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50">
              {form.imageUrl ? <img src={form.imageUrl} alt="preview" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-[56px] items-center justify-center text-xs text-neutral-400">Ảnh đại diện</div>}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} placeholder="Giá bán mặc định" />
            {isAdmin ? <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={form.defaultCostPrice} onChange={(e) => setForm({ ...form, defaultCostPrice: e.target.value })} placeholder="Giá nhập (admin)" /> : null}
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.colorOptions} onChange={(e) => setForm({ ...form, colorOptions: e.target.value })} placeholder="Màu: Black, White, Green" />
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.sizeOptions} onChange={(e) => setForm({ ...form, sizeOptions: e.target.value })} placeholder="Size: S, M, L, XL" />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium">Số lượng mặc định theo từng kho</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id}>
                  <label className="mb-2 block text-xs text-neutral-500">{branch.name}</label>
                  <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={form.defaultBranchStocks?.[branch.id] || ""} onChange={(e) => setForm({ ...form, defaultBranchStocks: { ...(form.defaultBranchStocks || {}), [branch.id]: e.target.value } })} placeholder="0" />
                </div>
              ))}
            </div>
          </div>
          <textarea className="min-h-[110px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Đóng</Button>
            <Button onClick={() => { onCreateProduct(form); resetProductForm(); setOpen(false); }}>Lưu sản phẩm</Button>
          </div>
        </div>
      </Modal>

      <Modal open={variantOpen} onClose={() => setVariantOpen(false)} title={`Thêm variant${activeProduct ? ` · ${activeProduct.name}` : ""}`}>
        <div className="grid gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Tạo nhanh toàn bộ tổ hợp màu × size</p>
                <p className="mt-1 text-xs text-neutral-500">Dựa trên danh sách thuộc tính của sản phẩm hiện tại.</p>
              </div>
              <Button variant="secondary" onClick={() => { if (!activeProductId) return; onGenerateVariants(activeProductId); setVariantOpen(false); }}>Generate variants</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {suggestedColors.map((color) => <Badge key={color} tone="blue">{color}</Badge>)}
              {suggestedSizes.map((size) => <Badge key={size} tone="gray">{size}</Badge>)}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} placeholder="SKU" />
            <div>
              <input list={`colors-${activeProductId || 'default'}`} className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} placeholder="Chọn màu" />
              <datalist id={`colors-${activeProductId || 'default'}`}>{(activeProduct?.colorOptions || []).map((color, idx) => <option key={idx} value={color} />)}</datalist>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <input list={`sizes-${activeProductId || 'default'}`} className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={variantForm.size} onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })} placeholder="Chọn size" />
              <datalist id={`sizes-${activeProductId || 'default'}`}>{(activeProduct?.sizeOptions || []).map((size, idx) => <option key={idx} value={size} />)}</datalist>
            </div>
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={variantForm.price} onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })} placeholder="Giá bán" />
            {isAdmin ? <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={variantForm.costPrice} onChange={(e) => setVariantForm({ ...variantForm, costPrice: e.target.value })} placeholder="Giá nhập" /> : null}
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium">Số lượng theo từng kho</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id}>
                  <label className="mb-2 block text-xs text-neutral-500">{branch.name}</label>
                  <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" type="number" value={variantForm.branchStocks?.[branch.id] ?? activeProduct?.defaultBranchStocks?.[branch.id] ?? ""} onChange={(e) => setVariantForm({ ...variantForm, branchStocks: { ...(variantForm.branchStocks || {}), [branch.id]: e.target.value } })} placeholder="0" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVariantOpen(false)}>Đóng</Button>
            <Button onClick={() => { if (!activeProductId) return; onAddVariant(activeProductId, variantForm); resetVariantForm(); setVariantOpen(false); }}>Lưu variant</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailProduct} onClose={() => setDetailProductId(null)} title={detailProduct ? `Chi tiết sản phẩm · ${detailProduct.name}` : "Chi tiết sản phẩm"}>
        {detailProduct ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                {detailProduct.imageUrl ? <img src={detailProduct.imageUrl} alt={detailProduct.name} className="h-full w-full object-cover" /> : <div className="flex min-h-[180px] items-center justify-center text-sm text-neutral-400">No image</div>}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{detailProduct.name}</h3>
                  <Badge tone={toneForStatus(detailProduct.status)}>{detailProduct.status}</Badge>
                  <Badge tone="blue">{detailProduct.category}</Badge>
                </div>
                <p className="mt-2 text-sm text-neutral-500">/{detailProduct.slug} · {detailProduct.brand} · {detailProduct.productType || "Core"}</p>
                <p className="mt-2 text-sm text-neutral-500">Khối lượng: {detailProduct.weight || 0}g</p>
                <p className="mt-3 text-sm text-neutral-700">{detailProduct.description || "—"}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Sản phẩm đang có ở kho nào</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {branches.map((branch) => <div key={branch.id} className="rounded-2xl border border-neutral-200 p-4"><p className="text-sm text-neutral-500">{branch.name}</p><p className="mt-2 text-xl font-semibold">{branchQtyForProduct(detailProduct, branch.id)} pcs</p></div>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="pb-3 font-medium">SKU</th>
                    <th className="pb-3 font-medium">Màu / Size</th>
                    <th className="pb-3 font-medium">Giá bán</th>
                    {isAdmin ? <th className="pb-3 font-medium">Giá nhập</th> : null}
                    <th className="pb-3 font-medium">Tổng tồn</th>
                    <th className="pb-3 font-medium">HK</th>
                    <th className="pb-3 font-medium">HBT</th>
                    <th className="pb-3 font-medium">OL</th>
                    {isAdmin ? <th className="pb-3 font-medium">Biên lợi nhuận</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {detailProduct.variants.map((variant) => {
                    const currentEdit = editingPrices[variant.id] || { price: variant.price, costPrice: variant.costPrice || 0 };
                    const margin = Number(currentEdit.price || 0) - Number(currentEdit.costPrice || 0);
                    return (
                      <tr key={variant.id} className="border-t border-neutral-200 align-top">
                        <td className="py-3">{variant.sku}</td>
                        <td className="py-3">{variant.color} / {variant.size}</td>
                        <td className="py-3"><input className="w-28 rounded-xl border border-neutral-300 px-3 py-2 outline-none" type="number" value={currentEdit.price} disabled={!isAdmin} onChange={(e) => setEditingPrices((prev) => ({ ...prev, [variant.id]: { ...(prev[variant.id] || { price: variant.price, costPrice: variant.costPrice || 0 }), price: e.target.value } }))} onBlur={() => { if (!isAdmin) return; onUpdateVariantPricing(detailProduct.id, variant.id, { price: Number((editingPrices[variant.id]?.price ?? variant.price) || 0) }); }} /></td>
                        {isAdmin ? <td className="py-3"><input className="w-28 rounded-xl border border-neutral-300 px-3 py-2 outline-none" type="number" value={currentEdit.costPrice} onChange={(e) => setEditingPrices((prev) => ({ ...prev, [variant.id]: { ...(prev[variant.id] || { price: variant.price, costPrice: variant.costPrice || 0 }), costPrice: e.target.value } }))} onBlur={() => { onUpdateVariantPricing(detailProduct.id, variant.id, { costPrice: Number((editingPrices[variant.id]?.costPrice ?? variant.costPrice) || 0) }); }} /></td> : null}
                        <td className="py-3">{variant.stock}</td>
                        <td className="py-3">{variant.branchStocks?.b1 || 0}</td>
                        <td className="py-3">{variant.branchStocks?.b2 || 0}</td>
                        <td className="py-3">{variant.branchStocks?.b3 || 0}</td>
                        {isAdmin ? <td className="py-3">{margin < 0 ? <Badge tone="red">Lỗ {currency(Math.abs(margin))}</Badge> : <Badge tone="green">Lãi {currency(margin)}</Badge>}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Lịch sử giá / audit log</h4>
              <div className="mt-3 space-y-2">
                {detailLogs.length === 0 ? <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">Chưa có thay đổi giá nào.</div> : detailLogs.map((log) => <div key={log.id} className="rounded-2xl border border-neutral-200 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{log.sku}</p><p className="text-xs text-neutral-500">{log.time}</p></div><p className="mt-1 text-neutral-700">{log.message}</p><p className="mt-1 text-xs text-neutral-500">Người sửa: {log.actor}</p></div>)}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Panel>
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto] md:items-center">
          <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên, slug, category hoặc SKU..." />
          <select className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="ALL">Tất cả nhóm</option>
            {productGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
          <select className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <div className="text-sm text-neutral-500">{filtered.length} sản phẩm</div>
        </div>
      </Panel>

      <div className="grid gap-4">
        {filtered.map((product) => {
          const productStock = product.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
          const branchBadges = branches.map((branch) => ({ id: branch.id, qty: branchQtyForProduct(product, branch.id), name: branch.code }));
          return (
            <Panel key={product.id}>
              <div className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <button className="h-20 w-20 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50" onClick={() => setDetailProductId(product.id)}>
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">No image</div>}
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button className="text-left text-lg font-semibold" onClick={() => setDetailProductId(product.id)}>{product.name}</button>
                        <Badge tone={toneForStatus(product.status)}>{product.status}</Badge>
                        <Badge tone="blue">{product.category}</Badge>
                        <Badge tone={productStock <= 3 ? "red" : "gray"}>Tồn {productStock}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">/{product.slug} · {product.brand} · {product.productType || "Core"} · {product.weight || 0}g</p>
                      <p className="mt-2 max-w-3xl text-sm text-neutral-600">{product.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">{branchBadges.map((item) => <Badge key={item.id} tone={item.qty <= 1 ? "amber" : "gray"}>{item.name}: {item.qty}</Badge>)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdmin ? <Button variant="secondary" onClick={() => { setActiveProductId(product.id); setVariantOpen(true); }}>+ Thêm variant</Button> : null}
                    {isAdmin ? <Button variant="secondary" onClick={() => onToggleProductStatus(product.id)}>{product.status === "ACTIVE" ? "Disable" : "Enable"}</Button> : null}
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function OrdersPage({ orders, onUpdateOrderStatus, onUpdatePaymentStatus, canEditOrders, canPushShipping }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || null);
  const [query, setQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");

  const filteredOrders = useMemo(() => {
    const q = query.toLowerCase();
    return orders.filter((order) => {
      const matchQuery =
        order.orderCode.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.customerPhone.toLowerCase().includes(q) ||
        order.items.some(
          (item) =>
            item.sku.toLowerCase().includes(q) ||
            item.productName.toLowerCase().includes(q)
        );
      const matchOrder = orderFilter === "ALL" || order.orderStatus === orderFilter;
      const matchPayment = paymentFilter === "ALL" || order.paymentStatus === paymentFilter;
      const matchChannel = channelFilter === "ALL" || order.salesChannel === channelFilter;
      return matchQuery && matchOrder && matchPayment && matchChannel;
    });
  }, [orders, query, orderFilter, paymentFilter, channelFilter]);

  const selected =
    filteredOrders.find((o) => o.id === selectedId) ||
    orders.find((o) => o.id === selectedId) ||
    null;

  const pendingCount = filteredOrders.filter((o) => ["PENDING", "PROCESSING"].includes(o.orderStatus)).length;
  const codCount = filteredOrders.filter((o) => o.paymentStatus === "PENDING_COD").length;
  const waitingPushCount = filteredOrders.filter(
    (o) => ["CONFIRMED", "PROCESSING"].includes(o.orderStatus) && o.paymentStatus !== "FAILED"
  ).length;
  const todayRevenue = filteredOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Đơn hàng"
        description="Operations board cho nhân viên: lọc nhanh, xử lý nhanh và nhìn rõ đơn nào cần đẩy tiếp."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Đơn cần xử lý" value={pendingCount} sub="PENDING + PROCESSING" />
        <StatCard title="Đơn COD" value={codCount} sub="Chờ giao / thu tiền" />
        <StatCard title="Chờ đẩy hãng" value={waitingPushCount} sub="Có thể fulfill" />
        <StatCard title="Doanh thu paid" value={currency(todayRevenue)} sub="Theo bộ lọc hiện tại" />
      </div>

      <Panel>
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_180px]">
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, khách hàng, số điện thoại, SKU..."
          />
          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái đơn</option>
            <option value="PENDING">PENDING</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="FULFILLED">FULFILLED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="AWAITING_PAYMENT">AWAITING_PAYMENT</option>
            <option value="PAID">PAID</option>
            <option value="PENDING_COD">PENDING_COD</option>
            <option value="FAILED">FAILED</option>
          </select>
          <select
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="ALL">Tất cả kênh</option>
            <option value="ADMIN">ADMIN</option>
            <option value="VN_WEB">VN_WEB</option>
            <option value="FACEBOOK">FACEBOOK</option>
            <option value="TIKTOK">TIKTOK</option>
          </select>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const urgent = ["PENDING", "PROCESSING"].includes(order.orderStatus);
            const pushable = ["CONFIRMED", "PROCESSING"].includes(order.orderStatus) && order.paymentStatus !== "FAILED";
            return (
              <Panel key={order.id}>
                <button className="w-full p-5 text-left" onClick={() => setSelectedId(order.id)}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold">{order.orderCode}</h3>
                        <Badge tone={toneForStatus(order.orderStatus)}>{order.orderStatus}</Badge>
                        <Badge tone={toneForStatus(order.paymentStatus)}>{order.paymentStatus}</Badge>
                        {urgent ? <Badge tone="amber">Cần xử lý</Badge> : null}
                        {pushable ? <Badge tone="blue">Có thể đẩy hãng</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">
                        {order.customerName} · {order.customerPhone}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {order.createdAt} · {order.salesChannel} · {branchName(order.branchId)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {order.items.map((item, idx) => (
                          <Badge key={idx} tone="gray">
                            {item.sku} × {item.qty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{currency(order.grandTotal)}</p>
                      <p className="mt-1 text-sm text-neutral-500">{order.items.length} item</p>
                    </div>
                  </div>
                </button>
              </Panel>
            );
          })}
          {filteredOrders.length === 0 ? (
            <Panel>
              <div className="p-6 text-sm text-neutral-500">Không có đơn phù hợp bộ lọc hiện tại.</div>
            </Panel>
          ) : null}
        </div>

        <Panel className="h-fit xl:sticky xl:top-6">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Chi tiết đơn</h3>
              {selected ? <Badge tone="gray">{branchName(selected.branchId)}</Badge> : null}
            </div>

            {!selected ? (
              <p className="mt-4 text-sm text-neutral-500">Chọn một đơn để xem chi tiết.</p>
            ) : (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">{selected.orderCode}</h3>
                    <Badge tone={toneForStatus(selected.orderStatus)}>{selected.orderStatus}</Badge>
                    <Badge tone={toneForStatus(selected.paymentStatus)}>{selected.paymentStatus}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    {selected.createdAt} · {selected.salesChannel}
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Khách hàng</span>
                    <span className="font-medium">{selected.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Điện thoại</span>
                    <span className="font-medium">{selected.customerPhone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Chi nhánh</span>
                    <span className="font-medium">{branchName(selected.branchId)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Tổng tiền</span>
                    <span className="font-medium">{currency(selected.grandTotal)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-neutral-500">Ghi chú</span>
                    <span className="max-w-[240px] text-right font-medium">{selected.note || "—"}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {selected.items.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-neutral-500">
                            {item.sku} · {item.color} / {item.size}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p>x{item.qty}</p>
                          <p className="font-medium">{currency(item.lineTotal)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled={!canEditOrders || selected.orderStatus === "CONFIRMED"}
                    onClick={() => onUpdateOrderStatus(selected.id, "CONFIRMED")}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="success"
                    disabled={!canEditOrders || selected.paymentStatus === "PAID"}
                    onClick={() => onUpdatePaymentStatus(selected.id, "PAID")}
                  >
                    Mark Paid
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!canPushShipping || selected.orderStatus === "FULFILLED" || selected.orderStatus === "CANCELLED"}
                    onClick={() => onUpdateOrderStatus(selected.id, "FULFILLED")}
                  >
                    Đẩy hãng / Fulfill
                  </Button>
                  <Button
                    variant="danger"
                    disabled={!canEditOrders || selected.orderStatus === "CANCELLED"}
                    onClick={() => onUpdateOrderStatus(selected.id, "CANCELLED")}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                  <p className="font-medium text-neutral-900">Checklist xử lý</p>
                  <div className="mt-3 space-y-2">
                    <p>• Confirm đơn khi đã chốt thông tin và giữ hàng.</p>
                    <p>• Mark Paid cho đơn chuyển khoản hoặc đã nhận tiền.</p>
                    <p>• Đẩy hãng / Fulfill khi đơn sẵn sàng giao.</p>
                    <p>• Chỉ cancel khi khách hủy hoặc lỗi xử lý.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function InventoryPage({ products, onOpenStocktake }) {
  const [query, setQuery] = useState("");
  const variants = products.flatMap((product) => product.variants.map((variant) => ({ ...variant, productName: product.name, productId: product.id })));
  const filtered = variants.filter((v) => {
    const q = query.toLowerCase();
    return v.sku.toLowerCase().includes(q) || v.productName.toLowerCase().includes(q) || v.color.toLowerCase().includes(q) || v.size.toLowerCase().includes(q);
  });

  const branchSummary = branches.map((branch) => {
    const qty = filtered.reduce((sum, variant) => sum + Number(variant.branchStocks?.[branch.id] || 0), 0);
    const value = filtered.reduce((sum, variant) => sum + Number(variant.branchStocks?.[branch.id] || 0) * Number(variant.price || 0), 0);
    return { ...branch, qty, value };
  });

  const totalInventoryValue = branchSummary.reduce((s, b) => s + b.value, 0);
  const topValueBranch = branchSummary.reduce((best, b) => (!best || b.value > best.value ? b : best), null);
  const lowStockRows = filtered.filter((variant) => variant.stock <= 3).slice(0, 6);
  const deadStockRows = filtered.filter((variant) => variant.stock >= 1 && variant.stock <= 2).slice(0, 4);
  const stockHeatmap = branches.map((branch) => ({
    ...branch,
    alert: filtered.filter((variant) => Number(variant.branchStocks?.[branch.id] || 0) <= 1).length,
    healthy: filtered.filter((variant) => Number(variant.branchStocks?.[branch.id] || 0) >= 2).length,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle title="Kho hàng" description="Kho chỉ đọc số liệu. Muốn đổi tồn phải đi qua kiểm kho để có log và khóa rủi ro." action={<Button variant="secondary" onClick={onOpenStocktake}>Đi tới kiểm kho</Button>} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {branchSummary.map((branch) => <StatCard key={branch.id} title={branch.name} value={`${branch.qty} pcs`} sub={`Giá trị kho: ${currency(branch.value)}`} />)}
        <StatCard title="Tổng giá trị toàn kho" value={currency(totalInventoryValue)} sub="Tổng hàng đang nằm trên kho" />
        <StatCard title="Chi nhánh ôm hàng nhiều nhất" value={topValueBranch ? topValueBranch.code : "—"} sub={topValueBranch ? `${topValueBranch.name} · ${currency(topValueBranch.value)}` : "Chưa có dữ liệu"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Heatmap tồn kho theo chi nhánh</h3>
              <Badge tone="blue">Read only</Badge>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {stockHeatmap.map((branch) => (
                <div key={branch.id} className="rounded-2xl border border-neutral-200 p-4">
                  <p className="font-medium">{branch.name}</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-neutral-500">SKU khỏe</span><span className="font-medium text-emerald-600">{branch.healthy}</span></div>
                    <div className="flex items-center justify-between"><span className="text-neutral-500">SKU cảnh báo</span><span className="font-medium text-red-500">{branch.alert}</span></div>
                    <div className="h-3 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-neutral-900" style={{ width: `${Math.max(8, Math.min(100, (branch.healthy / Math.max(1, branch.healthy + branch.alert)) * 100))}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-5">
            <h3 className="text-lg font-semibold">SKU cần chú ý</h3>
            <div className="mt-4 space-y-3">
              {lowStockRows.length === 0 ? <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">Không có SKU sắp hết hàng.</div> : lowStockRows.map((variant) => <div key={variant.id} className="rounded-2xl border border-neutral-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{variant.productName}</p><p className="text-sm text-neutral-500">{variant.sku} · {variant.color} / {variant.size}</p></div><Badge tone="red">Còn {variant.stock}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{branches.map((branch) => <Badge key={branch.id} tone={(variant.branchStocks?.[branch.id] || 0) === 0 ? "red" : "blue"}>{branch.code}: {variant.branchStocks?.[branch.id] || 0}</Badge>)}</div></div>)}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <div className="p-5">
            <h3 className="text-lg font-semibold">Hàng chậm / dễ chết tồn</h3>
            <div className="mt-4 space-y-3">
              {deadStockRows.length === 0 ? <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">Chưa có SKU nào ở vùng chết tồn.</div> : deadStockRows.map((variant) => <div key={variant.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{variant.productName}</p><p className="text-sm text-neutral-500">{variant.sku}</p></div><Badge tone="amber">Tồn thấp {variant.stock}</Badge></div><p className="mt-2 text-sm text-neutral-500">Nên cân nhắc gom kho, giảm ads hoặc đẩy hàng nhanh hơn.</p></div>)}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-5">
            <h3 className="text-lg font-semibold">Nguyên tắc kho</h3>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <p>• Không chỉnh tồn trực tiếp trong tab kho.</p>
              <p>• Muốn đổi số lượng phải vào kiểm kho để có lịch sử.</p>
              <p>• Tab này dùng để đối chiếu vốn, phân bổ hàng và nhìn nhịp tồn theo chi nhánh.</p>
              <p>• Nhân viên chỉ đọc, quản lý mới quyết định hành động tiếp theo.</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="p-4">
          <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:max-w-md" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo SKU, tên sản phẩm, màu, size..." />
        </div>
      </Panel>

      <Panel>
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="pb-3 font-medium">Sản phẩm</th>
                <th className="pb-3 font-medium">SKU</th>
                <th className="pb-3 font-medium">Màu / Size</th>
                <th className="pb-3 font-medium">Giá</th>
                <th className="pb-3 font-medium">Tổng stock</th>
                <th className="pb-3 font-medium">Chi nhánh</th>
                <th className="pb-3 font-medium">Giá trị theo chi nhánh</th>
                <th className="pb-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((variant) => (
                <tr key={variant.id} className="border-t border-neutral-200 align-top">
                  <td className="py-3">{variant.productName}</td>
                  <td className="py-3">{variant.sku}</td>
                  <td className="py-3">{variant.color} / {variant.size}</td>
                  <td className="py-3">{currency(variant.price)}</td>
                  <td className="py-3">{variant.stock}</td>
                  <td className="py-3"><div className="flex flex-col gap-2">{branches.map((branch) => <div key={branch.id} className="flex items-center gap-2"><Badge tone={(variant.branchStocks?.[branch.id] || 0) <= 1 ? "red" : "blue"}>{branch.code}</Badge><span>{variant.branchStocks?.[branch.id] || 0} pcs</span></div>)}</div></td>
                  <td className="py-3"><div className="flex flex-col gap-2 text-sm">{branches.map((branch) => { const qty = Number(variant.branchStocks?.[branch.id] || 0); return <div key={branch.id} className="flex items-center gap-2"><span className="w-10 text-neutral-500">{branch.code}</span><span>{currency(qty * Number(variant.price || 0))}</span></div>; })}</div></td>
                  <td className="py-3">{variant.stock <= 0 ? <Badge tone="red">Hết hàng</Badge> : variant.stock <= 3 ? <Badge tone="amber">Sắp hết</Badge> : <Badge tone="green">Ổn</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function StocktakePage({ products, stocktakes, onCreateStocktake, onFinishStocktakeSession, currentUser, canApproveStocktake }) {
  const [branchId, setBranchId] = useState("b1");
  const [fileContent, setFileContent] = useState("");
  const [preview, setPreview] = useState([]);
  const [scanMode, setScanMode] = useState("LIVE");
  const [liveSku, setLiveSku] = useState("");
  const [liveRows, setLiveRows] = useState([]);
  const [sessionNote, setSessionNote] = useState("");
  const [sessionName, setSessionName] = useState("Kiểm kho cuối ngày");
  const [sessionStatus, setSessionStatus] = useState("DRAFT");
  const [showOnlyMismatch, setShowOnlyMismatch] = useState(false);

  const allVariants = products.flatMap((product) => product.variants.map((variant) => ({ ...variant, productName: product.name })));
  const mismatchReasons = ["Sai vị trí để hàng", "Thiếu hàng thực tế", "Dư hàng thực tế", "Lỗi nhập/xuất trước đó", "Mất tem / quét sai", "Khác"];

  const buildRow = (sku, counted, variant, system) => ({
    sku,
    counted,
    system,
    diff: counted - system,
    status: variant ? (counted === system ? "MATCH" : "MISMATCH") : "NOT_FOUND",
    variant,
    reason: counted === system ? "" : "Khác",
    note: "",
    scannedBy: currentUser?.name || "Nhân viên",
    scannedAt: formatDate(),
  });

  const parseCSV = () => {
    const trimmed = fileContent.trim();
    if (!trimmed) { setPreview([]); return; }
    const lines = trimmed.split(String.fromCharCode(10));
    const rows = lines.slice(1).map((line) => {
      const [skuRaw, countedRaw] = line.split(",");
      const sku = (skuRaw || "").trim();
      const counted = Number((countedRaw || "0").trim());
      const variant = allVariants.find((v) => v.sku === sku);
      const system = variant?.branchStocks?.[branchId] || 0;
      return buildRow(sku, counted, variant, system);
    }).filter((row) => row.sku);
    setPreview(rows);
    setSessionStatus("REVIEWING");
  };

  const handleLiveScan = () => {
    const sku = liveSku.trim();
    if (!sku) return;
    const variant = allVariants.find((v) => v.sku === sku);
    const system = variant?.branchStocks?.[branchId] || 0;
    setLiveRows((prev) => {
      const existing = prev.find((row) => row.sku === sku);
      if (existing) {
        return prev.map((row) => {
          if (row.sku !== sku) return row;
          const nextCounted = row.counted + 1;
          const nextStatus = variant ? (nextCounted === row.system ? "MATCH" : "MISMATCH") : "NOT_FOUND";
          return {
            ...row,
            counted: nextCounted,
            diff: nextCounted - row.system,
            status: nextStatus,
            reason: nextStatus === "MATCH" ? "" : row.reason || "Khác",
            scannedBy: currentUser?.name || "Nhân viên",
            scannedAt: formatDate(),
          };
        });
      }
      return [buildRow(sku, 1, variant, system), ...prev];
    });
    setSessionStatus("SCANNING");
    setLiveSku("");
  };

  const updateRowField = (sku, field, value) => {
    const setter = scanMode === "LIVE" ? setLiveRows : setPreview;
    setter((prev) => prev.map((row) => {
      if (row.sku !== sku) return row;
      if (field === "counted") {
        const counted = Number(value || 0);
        const status = row.variant ? (counted === row.system ? "MATCH" : "MISMATCH") : "NOT_FOUND";
        return { ...row, counted, diff: counted - row.system, status, reason: status === "MATCH" ? "" : row.reason || "Khác" };
      }
      return { ...row, [field]: value };
    }));
  };

  const dataRows = scanMode === "LIVE" ? liveRows : preview;
  const visibleRows = showOnlyMismatch ? dataRows.filter((row) => row.status !== "MATCH") : dataRows;
  const totalMismatch = dataRows.filter((row) => row.status === "MISMATCH").length;
  const totalMatch = dataRows.filter((row) => row.status === "MATCH").length;
  const totalNotFound = dataRows.filter((row) => row.status === "NOT_FOUND").length;
  const totalCountedUnits = dataRows.reduce((sum, row) => sum + Number(row.counted || 0), 0);
  const totalSystemUnits = dataRows.reduce((sum, row) => sum + Number(row.system || 0), 0);
  const accuracyRate = dataRows.length ? Math.round((totalMatch / dataRows.length) * 100) : 0;
  const latestSessions = stocktakes.slice(0, 5);

  const applyStocktake = () => {
    dataRows.forEach((row) => {
      if (!row.variant) return;
      onCreateStocktake(branchId, row.variant, row.counted, {
        reason: row.reason,
        note: row.note,
        scannedBy: row.scannedBy,
        scannedAt: row.scannedAt,
        sessionNote: sessionName + (sessionNote ? " · " + sessionNote : ""),
      });
    });
    setSessionStatus("APPROVED");
    setPreview([]);
    setLiveRows([]);
    setFileContent("");
    setLiveSku("");
  };

  const submitForApproval = () => {
    setSessionStatus("WAITING_APPROVAL");
    onFinishStocktakeSession({
      branchId,
      mode: scanMode,
      note: sessionName + (sessionNote ? " · " + sessionNote : ""),
      totalRows: dataRows.length,
      mismatchCount: totalMismatch,
      notFoundCount: totalNotFound,
    });
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Kiểm kho" description="Nâng lên kiểu session thật: có phiên kiểm, mode scan, tỷ lệ khớp, mismatch review và lịch sử xử lý rõ ràng." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Khớp" value={totalMatch} sub="SKU khớp với hệ thống" />
        <StatCard title="Lệch" value={totalMismatch} sub="Cần xác nhận lý do" />
        <StatCard title="Mã lỗi" value={totalNotFound} sub="Không tìm thấy SKU" />
        <StatCard title="Độ chính xác" value={`${accuracyRate}%`} sub="Tính trên toàn phiên" />
        <StatCard title="Đơn vị đã đếm" value={totalCountedUnits} sub={`System đang là ${totalSystemUnits}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel>
          <div className="space-y-5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Phiên kiểm kho</h3>
                <p className="mt-1 text-sm text-neutral-500">Đặt tên phiên, chọn chi nhánh và mode scan trước khi xử lý.</p>
              </div>
              <Badge tone={sessionStatus === "APPROVED" ? "green" : sessionStatus === "WAITING_APPROVAL" ? "amber" : sessionStatus === "SCANNING" ? "amber" : "blue"}>{sessionStatus}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Tên phiên</label>
                <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="VD: Kiểm cuối ngày HK" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Chi nhánh</label>
                <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3" value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Chế độ</label>
                <div className="flex gap-2">
                  <Button variant={scanMode === "LIVE" ? "primary" : "secondary"} onClick={() => setScanMode("LIVE")}>Máy tít</Button>
                  <Button variant={scanMode === "CSV" ? "primary" : "secondary"} onClick={() => setScanMode("CSV")}>File</Button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Mismatch</label>
                <Button variant={showOnlyMismatch ? "primary" : "secondary"} onClick={() => setShowOnlyMismatch((v) => !v)}>{showOnlyMismatch ? "Đang lọc mismatch" : "Hiện tất cả"}</Button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Ghi chú phiên kiểm kho</label>
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3" value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} placeholder="VD: Kiểm nhanh cuối ngày ca tối" />
            </div>

            {scanMode === "LIVE" ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <label className="mb-2 block text-sm font-medium">Ô nhận barcode từ máy bluetooth</label>
                <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3" value={liveSku} onChange={(e) => setLiveSku(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLiveScan(); } }} placeholder="Bấm vào đây rồi dùng máy tít để bắn mã" autoFocus />
                <p className="mt-2 text-xs text-neutral-500">Máy scan bluetooth thường nhập mã rồi tự gửi Enter. Hệ sẽ cộng dồn nếu quét cùng SKU nhiều lần.</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleLiveScan}>Ghi 1 lần quét</Button>
                  <Button variant="secondary" onClick={() => setLiveRows([])}>Xóa danh sách quét</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <label className="mb-2 block text-sm font-medium">Paste CSV (sku,counted_qty)</label>
                <textarea className="min-h-[120px] w-full rounded-2xl border border-neutral-300 p-3" value={fileContent} onChange={(e) => setFileContent(e.target.value)} placeholder={`sku,counted_qty
QS794-GREEN-S,3`} />
                <div className="mt-3 flex gap-2">
                  <Button onClick={parseCSV}>Preview file</Button>
                  <Button variant="secondary" onClick={() => { setFileContent(""); setPreview([]); }}>Xóa file</Button>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm"><p className="text-neutral-500">Nhân viên kiểm</p><p className="mt-2 font-medium">{currentUser?.name}</p></div>
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm"><p className="text-neutral-500">Phiên đang xử lý</p><p className="mt-2 font-medium">{sessionName}</p></div>
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm"><p className="text-neutral-500">Chi nhánh</p><p className="mt-2 font-medium">{branchName(branchId)}</p></div>
              <div className="rounded-2xl border border-neutral-200 p-4 text-sm"><p className="text-neutral-500">Quyền xác nhận</p><p className="mt-2 font-medium">{canApproveStocktake ? "Được xác nhận" : "Chỉ preview"}</p></div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={submitForApproval} disabled={!dataRows.length}>Gửi chờ duyệt</Button>
              <Button variant="success" onClick={applyStocktake} disabled={!dataRows.length || !canApproveStocktake}>Duyệt và cập nhật kho</Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Lịch sử phiên gần đây</h3>
              <Badge tone="blue">{latestSessions.length} phiên</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {latestSessions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{branchName(item.branchId)}</p>
                      <p className="mt-1 text-sm text-neutral-500">{item.createdAt}</p>
                    </div>
                    <Badge tone={toneForStatus(item.status)}>{item.status}</Badge>
                  </div>
                  {item.note && <p className="mt-2 text-sm text-neutral-600">{item.note}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge tone="gray">{item.lines.length} dòng</Badge>
                    <Badge tone="amber">{item.lines.filter((line) => Number(line.diff) !== 0).length} lệch</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {dataRows.length > 0 && (
        <Panel>
          <div className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Preview kiểm kho</h3>
                <p className="mt-1 text-sm text-neutral-500">Rà mismatch trước khi chốt cập nhật tồn. Chỉ account có quyền xác nhận kiểm kho mới được bấm cập nhật.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="green">Khớp: {totalMatch}</Badge>
                <Badge tone="amber">Lệch: {totalMismatch}</Badge>
                <Badge tone="red">Mã lỗi: {totalNotFound}</Badge>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pb-3">SKU</th>
                    <th className="pb-3">System</th>
                    <th className="pb-3">Counted</th>
                    <th className="pb-3">Diff</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Lý do lệch</th>
                    <th className="pb-3">Ghi chú</th>
                    <th className="pb-3">Nhân viên</th>
                    <th className="pb-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="py-3">
                        <p className="font-medium">{row.sku}</p>
                        {row.variant?.productName && <p className="mt-1 text-xs text-neutral-500">{row.variant.productName}</p>}
                      </td>
                      <td className="py-3">{row.system}</td>
                      <td className="py-3"><input className="w-20 rounded-xl border border-neutral-300 px-3 py-2" type="number" value={row.counted} onChange={(e) => updateRowField(row.sku, "counted", e.target.value)} /></td>
                      <td className={`py-3 font-medium ${row.diff === 0 ? "text-emerald-600" : row.diff > 0 ? "text-blue-600" : "text-red-500"}`}>{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                      <td className="py-3"><Badge tone={row.status === "MATCH" ? "green" : row.status === "MISMATCH" ? "amber" : "red"}>{row.status}</Badge></td>
                      <td className="py-3">{row.status === "MATCH" ? <span className="text-neutral-400">—</span> : <select className="rounded-xl border border-neutral-300 px-3 py-2" value={row.reason || "Khác"} onChange={(e) => updateRowField(row.sku, "reason", e.target.value)}>{mismatchReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select>}</td>
                      <td className="py-3">{row.status === "MATCH" ? <span className="text-neutral-400">—</span> : <input className="w-[180px] rounded-xl border border-neutral-300 px-3 py-2" value={row.note || ""} onChange={(e) => updateRowField(row.sku, "note", e.target.value)} placeholder="Ghi chú thêm" />}</td>
                      <td className="py-3 text-sm text-neutral-600">{row.scannedBy}</td>
                      <td className="py-3 text-sm text-neutral-500">{row.scannedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="p-5">
          <h3 className="text-lg font-semibold">Phiếu kiểm kho gần đây</h3>
          <div className="mt-4 space-y-3">
            {stocktakes.map((item) => (
              <div key={item.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{branchName(item.branchId)}</p>
                    <p className="mt-1 text-sm text-neutral-500">{item.createdAt}</p>
                  </div>
                  <Badge tone={toneForStatus(item.status)}>{item.status}</Badge>
                </div>
                {item.note && <p className="mt-2 text-sm text-neutral-600">{item.note}</p>}
                <div className="mt-3 space-y-2">
                  {item.lines.map((line, idx) => (
                    <div key={idx} className="rounded-2xl bg-neutral-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-medium">{line.sku}</span>
                        <span>System {line.systemStock} / Counted {line.countedStock} / Diff {line.diff}</span>
                      </div>
                      {(line.reason || line.note || line.scannedBy) && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                          {line.reason && <span>Lý do: {line.reason}</span>}
                          {line.note && <span>Ghi chú: {line.note}</span>}
                          {line.scannedBy && <span>Nhân viên: {line.scannedBy}</span>}
                          {line.scannedAt && <span>Lúc: {line.scannedAt}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function CreateOrderPage({ products, onCreateOrder }) {
  const [salesChannel, setSalesChannel] = useState("ADMIN");
  const [branchId, setBranchId] = useState("b1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [shippingMode, setShippingMode] = useState("partner");
  const [shippingPartner, setShippingPartner] = useState("GHN");
  const [shippingPayer, setShippingPayer] = useState("SHOP");
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [customerPaid, setCustomerPaid] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [showExtraCustomerFields, setShowExtraCustomerFields] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    province: "Hà Nội",
    ward: "",
    addressLine: "",
    customerCode: "",
    owner: currentUser.name,
    tags: "",
    note: "",
  });

  const allVariants = useMemo(
    () =>
      products.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          productName: product.name,
          disabled: product.status !== "ACTIVE",
          branchStock: Number(variant.branchStocks?.[branchId] || 0),
          imageUrl: product.imageUrl || "",
        }))
      ),
    [products, branchId]
  );

  const searchedVariants = useMemo(() => {
    const q = query.toLowerCase().trim();
    return allVariants
      .filter((variant) => {
        return (
          !q ||
          variant.productName.toLowerCase().includes(q) ||
          variant.sku.toLowerCase().includes(q) ||
          variant.color.toLowerCase().includes(q) ||
          variant.size.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.branchStock !== b.branchStock) return b.branchStock - a.branchStock;
        return a.productName.localeCompare(b.productName);
      })
      .slice(0, 10);
  }, [allVariants, query]);

  const addItem = (variant) => {
    setSelectedRows((prev) => {
      const existing = prev.find((row) => row.variantId === variant.id);
      if (existing) {
        return prev.map((row) => {
          if (row.variantId !== variant.id) return row;
          const nextQty = Math.min(row.qty + 1, Math.max(1, variant.branchStock));
          return {
            ...row,
            qty: nextQty,
            lineTotal: Math.max(0, nextQty * row.unitPrice - row.discount),
            stock: variant.branchStock,
          };
        });
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          color: variant.color,
          size: variant.size,
          qty: 1,
          unitPrice: variant.price,
          discount: 0,
          lineTotal: variant.price,
          stock: variant.branchStock,
          imageUrl: variant.imageUrl,
        },
      ];
    });
    if (!customerName) setCustomerName("Khách lẻ tại quầy");
    setQuery("");
    setHighlightedIndex(0);
  };

  const updateRow = (variantId, field, value) => {
    setSelectedRows((prev) =>
      prev.map((row) => {
        if (row.variantId !== variantId) return row;
        const next = {
          ...row,
          [field]: field === "qty" || field === "unitPrice" || field === "discount" ? Number(value || 0) : value,
        };
        next.qty = Math.max(1, Math.min(next.qty, Math.max(1, row.stock)));
        next.lineTotal = Math.max(0, next.qty * next.unitPrice - next.discount);
        return next;
      })
    );
  };

  const removeRow = (variantId) => setSelectedRows((prev) => prev.filter((row) => row.variantId !== variantId));

  const handleSearchKeyDown = (e) => {
    if (!query.trim() || searchedVariants.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % searchedVariants.length);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + searchedVariants.length) % searchedVariants.length);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = searchedVariants[highlightedIndex] || searchedVariants[0];
      if (target && !target.disabled && target.branchStock > 0) addItem(target);
    }
    if (e.key === "Escape") {
      setQuery("");
      setHighlightedIndex(0);
    }
  };

  const subTotal = selectedRows.reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.unitPrice || 0), 0);
  const lineDiscount = selectedRows.reduce((sum, row) => sum + Number(row.discount || 0), 0);
  const couponDiscount = couponCode.trim() ? Number(discount || 0) : 0;
  const grandTotal = Math.max(0, subTotal - lineDiscount - couponDiscount + Number(shippingFee || 0));
  const amountDue = Math.max(0, grandTotal - Number(customerPaid || 0));
  const canCreate = selectedRows.length > 0 && customerName.trim() && customerPhone.trim();

  const applyNewCustomer = () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;
    const compactAddress = [newCustomer.addressLine, newCustomer.ward, newCustomer.province].filter(Boolean).join(", ");
    setCustomerName(newCustomer.name.trim());
    setCustomerPhone(newCustomer.phone.trim());
    if (compactAddress) setCustomerAddress(compactAddress);
    if (newCustomer.tags.trim()) setTags((prev) => [prev, newCustomer.tags].filter(Boolean).join(prev ? ", " : ""));
    if (newCustomer.note.trim()) setNote((prev) => [prev, newCustomer.note].filter(Boolean).join(prev ? " · " : ""));
    setCustomerModalOpen(false);
    setShowExtraCustomerFields(false);
    setNewCustomer({
      name: "",
      phone: "",
      province: "Hà Nội",
      ward: "",
      addressLine: "",
      customerCode: "",
      owner: currentUser.name,
      tags: "",
      note: "",
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Modal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} title="Thêm mới khách hàng">
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Popup này đã được rút gọn để nằm gọn trong một khung màn hình khi đang tạo đơn.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Tên khách hàng *</label>
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.name} onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nhập tên khách hàng" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Số điện thoại *</label>
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.phone} onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Nhập số điện thoại" />
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Địa chỉ giao hàng</p>
                <p className="mt-1 text-xs text-neutral-500">Gom theo 3 trường chính để không phải kéo quá sâu.</p>
              </div>
              <Badge tone="blue">Compact</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Khu vực</label>
                <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.province} onChange={(e) => setNewCustomer((prev) => ({ ...prev, province: e.target.value }))}>
                  <option>Hà Nội</option>
                  <option>Hồ Chí Minh</option>
                  <option>Đà Nẵng</option>
                  <option>Hải Phòng</option>
                  <option>Cần Thơ</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Phường xã</label>
                <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.ward} onChange={(e) => setNewCustomer((prev) => ({ ...prev, ward: e.target.value }))} placeholder="Nhập phường / xã" />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">Địa chỉ cụ thể</label>
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.addressLine} onChange={(e) => setNewCustomer((prev) => ({ ...prev, addressLine: e.target.value }))} placeholder="Số nhà, tên đường, toà nhà..." />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Mã khách hàng</label>
              <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.customerCode} onChange={(e) => setNewCustomer((prev) => ({ ...prev, customerCode: e.target.value }))} placeholder="Mặc định / optional" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Nhân viên phụ trách</label>
              <input className="w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 outline-none" value={newCustomer.owner} onChange={(e) => setNewCustomer((prev) => ({ ...prev, owner: e.target.value }))} placeholder="Nhân viên phụ trách" />
            </div>
          </div>
          <div>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => setShowExtraCustomerFields((v) => !v)}>
              {showExtraCustomerFields ? "− Thu gọn thông tin thêm" : "+ Thông tin thêm"}
            </button>
            {showExtraCustomerFields ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Tags</label>
                  <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.tags} onChange={(e) => setNewCustomer((prev) => ({ ...prev, tags: e.target.value }))} placeholder="VIP, khách mới..." />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Ghi chú</label>
                  <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newCustomer.note} onChange={(e) => setNewCustomer((prev) => ({ ...prev, note: e.target.value }))} placeholder="Thông tin thêm" />
                </div>
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-neutral-200 bg-white pt-4">
            <Button variant="secondary" onClick={() => setCustomerModalOpen(false)}>Thoát</Button>
            <Button onClick={applyNewCustomer} disabled={!newCustomer.name.trim() || !newCustomer.phone.trim()}>Thêm khách hàng</Button>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">
        <SectionTitle title="Tạo đơn" description="Nâng cấp theo flow bán hàng thật: thêm nhiều sản phẩm, phí ship, giảm giá và xử lý khách hàng ngay trong popup." />

        <Panel>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">Thông tin khách hàng</p>
                <p className="mt-1 text-xs text-neutral-500">Giữ phần nhập chính thật gọn, thêm khách mới trong popup compact.</p>
              </div>
              <Button variant="secondary" onClick={() => setCustomerModalOpen(true)}>+ Khách hàng mới</Button>
            </div>
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Tên khách" />
            <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Số điện thoại" />
            <textarea className="min-h-[96px] rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:col-span-2" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Địa chỉ giao hàng" />
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)}>
              <option value="ADMIN">ADMIN</option>
              <option value="VN_WEB">VN_WEB</option>
              <option value="FACEBOOK">FACEBOOK</option>
              <option value="TIKTOK">TIKTOK</option>
            </select>
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        </Panel>

        <Panel>
          <div className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Thêm sản phẩm vào đơn</h3>
                <p className="mt-1 text-sm text-neutral-500">Gõ tên sản phẩm, SKU, màu hoặc size rồi chọn nhanh.</p>
              </div>
              <div className="text-sm text-neutral-500">{selectedRows.length} dòng sản phẩm</div>
            </div>
            <div className="relative mt-4">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3.5 outline-none" value={query} onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(0); }} onKeyDown={handleSearchKeyDown} placeholder="Tìm sản phẩm, SKU, màu, size..." />
              {query.trim() ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
                  {searchedVariants.length === 0 ? (
                    <div className="p-4 text-sm text-neutral-500">Không thấy sản phẩm phù hợp.</div>
                  ) : (
                    <div className="max-h-[360px] overflow-auto p-2">
                      {searchedVariants.map((variant, idx) => (
                        <button key={variant.id} onClick={() => addItem(variant)} disabled={variant.disabled || variant.branchStock <= 0} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition disabled:opacity-50 ${highlightedIndex === idx ? "bg-neutral-100" : "hover:bg-neutral-50"}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-neutral-900">{variant.productName}</p>
                              <Badge tone={variant.branchStock <= 3 ? "amber" : "blue"}>Tồn CN {variant.branchStock}</Badge>
                            </div>
                            <p className="mt-1 truncate text-sm text-neutral-500">{variant.sku} · {variant.color} / {variant.size}</p>
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            <div className="font-medium text-neutral-900">{currency(variant.price)}</div>
                            <div className="mt-1 text-xs text-neutral-500">{branchName(branchId)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedRows.slice(0, 6).map((row) => (
                <div key={row.variantId} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700">
                  {row.sku} × {row.qty}
                </div>
              ))}
              {selectedRows.length > 6 ? <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500">+{selectedRows.length - 6} dòng khác</div> : null}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="overflow-x-auto p-5">
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-500">
                <tr>
                  <th className="pb-3 font-medium">STT</th>
                  <th className="pb-3 font-medium">Ảnh</th>
                  <th className="pb-3 font-medium">Tên sản phẩm</th>
                  <th className="pb-3 font-medium">Số lượng</th>
                  <th className="pb-3 font-medium">Đơn giá</th>
                  <th className="pb-3 font-medium">Chiết khấu</th>
                  <th className="pb-3 font-medium">Thành tiền</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row, idx) => (
                  <tr key={row.variantId} className="border-t border-neutral-200 align-top">
                    <td className="py-4">{idx + 1}</td>
                    <td className="py-4"><div className="h-12 w-12 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">{row.imageUrl ? <img src={row.imageUrl} alt={row.productName} className="h-full w-full object-cover" /> : null}</div></td>
                    <td className="py-4"><p className="font-medium">{row.productName} · {row.color} · {row.size}</p><p className="mt-1 text-sm text-neutral-500">{row.sku}</p></td>
                    <td className="py-4"><input className="w-20 rounded-xl border border-neutral-300 px-3 py-2 outline-none" type="number" min={1} max={row.stock} value={row.qty} onChange={(e) => updateRow(row.variantId, "qty", e.target.value)} /></td>
                    <td className="py-4"><input className="w-28 rounded-xl border border-neutral-300 px-3 py-2 outline-none" type="number" value={row.unitPrice} onChange={(e) => updateRow(row.variantId, "unitPrice", e.target.value)} /></td>
                    <td className="py-4"><input className="w-24 rounded-xl border border-neutral-300 px-3 py-2 outline-none" type="number" value={row.discount} onChange={(e) => updateRow(row.variantId, "discount", e.target.value)} /></td>
                    <td className="py-4 font-medium">{currency(row.lineTotal)}</td>
                    <td className="py-4"><button onClick={() => removeRow(row.variantId)} className="text-xl text-neutral-400 hover:text-red-500">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedRows.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">Chưa có sản phẩm nào trong đơn.</div> : null}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-sm font-medium">Tags</label>
                <textarea className="min-h-[72px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VD: VIP, chốt live, ưu tiên ship" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Ghi chú đơn hàng</label>
                <textarea className="min-h-[72px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Hàng tặng gói riêng" />
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Tổng tiền ({selectedRows.length} sản phẩm)</span><span>{currency(subTotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Giảm giá</span><input className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} /></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Phí giao hàng</span><input className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none" type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value || 0))} /></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Mã giảm giá</span><input className="w-32 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="VD: 1970VIP" /></div>
              <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 text-base font-semibold"><span>Khách phải trả</span><span>{currency(grandTotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Khách đã trả</span><input className="w-28 rounded-xl border border-neutral-300 px-3 py-2 text-right outline-none" type="number" value={customerPaid} onChange={(e) => setCustomerPaid(Number(e.target.value || 0))} /></div>
              <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 text-base font-semibold"><span>Còn phải trả</span><span>{currency(amountDue)}</span></div>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-neutral-500">Cách giao</span>
                <label className="flex items-center gap-2"><input type="radio" checked={shippingMode === "partner"} onChange={() => setShippingMode("partner")} />Đối tác</label>
                <label className="flex items-center gap-2"><input type="radio" checked={shippingMode === "pickup"} onChange={() => setShippingMode("pickup")} />Nhận tại shop</label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={shippingPartner} onChange={(e) => setShippingPartner(e.target.value)}>
                  <option value="GHN">GHN</option>
                  <option value="GHTK">GHTK</option>
                  <option value="VNPOST">VNPost</option>
                </select>
                <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={shippingPayer} onChange={(e) => setShippingPayer(e.target.value)}>
                  <option value="SHOP">Shop trả</option>
                  <option value="CUSTOMER">Khách trả</option>
                </select>
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex justify-end">
          <Button className="min-w-[220px]" disabled={!canCreate} onClick={() => {
            onCreateOrder({
              salesChannel,
              note: note || "Đơn tạo tay từ admin",
              customerName,
              customerPhone,
              branchId,
              items: selectedRows.map((row) => ({ variantId: row.variantId, qty: row.qty })),
            });
            setSelectedRows([]);
            setCustomerName("");
            setCustomerPhone("");
            setCustomerAddress("");
            setTags("");
            setNote("");
            setDiscount(0);
            setShippingFee(0);
            setCouponCode("");
            setCustomerPaid(0);
            setQuery("");
            setHighlightedIndex(0);
          }}>Tạo đơn hàng</Button>
        </div>
      </div>

      <Panel>
        <div className="p-5">
          <h3 className="text-lg font-semibold">Xem trước đơn</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Khách hàng</span><span className="font-medium">{customerName || "—"}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Điện thoại</span><span className="font-medium">{customerPhone || "—"}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Kênh bán</span><span className="font-medium">{salesChannel}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Chi nhánh</span><span className="font-medium">{branchName(branchId)}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Giao hàng</span><span className="font-medium">{shippingMode}</span></div>
            </div>
            <div className="space-y-3">
              {selectedRows.map((row) => (
                <div key={row.variantId} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.productName}</p>
                      <p className="mt-1 text-sm text-neutral-500">{row.sku} · {row.color} / {row.size}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>x{row.qty}</p>
                      <p className="font-medium">{currency(row.lineTotal)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {selectedRows.length === 0 ? <p className="text-sm text-neutral-500">Chưa chọn sản phẩm.</p> : null}
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Tổng tiền hàng</span><span>{currency(subTotal)}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Giảm giá</span><span>- {currency(lineDiscount + couponDiscount)}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Phí ship</span><span>{currency(shippingFee)}</span></div>
              <div className="mt-2 flex items-center justify-between font-medium"><span>Khách phải trả</span><span>{currency(grandTotal)}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="text-neutral-500">Khách đã trả</span><span>{currency(customerPaid)}</span></div>
              <div className="mt-2 flex items-center justify-between font-medium"><span>Còn phải trả</span><span>{currency(amountDue)}</span></div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AdsPage({ mappings, setMappings, currentUser, pushActivity }) {
  const [automationLevel, setAutomationLevel] = useState("manual");
  const [metaConnected, setMetaConnected] = useState(false);
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("act_123456789");
  const [apiBaseUrl, setApiBaseUrl] = useState("https://the1970-core-api-production.up.railway.app");
  const [dryRun, setDryRun] = useState(true);
  const [selectedMappingId, setSelectedMappingId] = useState(initialAdsMappings[0]?.id || "m1");
  const [executionOutput, setExecutionOutput] = useState("Chưa chạy execute nào.");
  const [autopilotTab, setAutopilotTab] = useState("overview");
  const [decisionLogs, setDecisionLogs] = useState([
    { id: "d1", time: "09:12", sku: "QS794-GREEN-S", decision: "Scale +20%", reason: "ROAS 3.36, tồn còn tốt, budget còn room", action: "applied", rollbackBudget: 1200000, nextBudget: 1440000 },
    { id: "d2", time: "08:46", sku: "SM902-REUDEN-M", decision: "Giảm -15%", reason: "ROAS 1.44, spend cao hơn doanh thu mang về", action: "suggested", rollbackBudget: 800000, nextBudget: 680000 },
  ]);
  const [liveAlerts, setLiveAlerts] = useState([
    { id: "a1", level: "high", title: "QS794 Palm đủ điều kiện scale", desc: "ROAS đang vượt 3.0 và tồn kho còn an toàn." },
    { id: "a2", level: "critical", title: "SM902 cần giảm budget", desc: "ROAS dưới ngưỡng 1.5 trong khi spend vẫn đang tăng." },
  ]);

  const connectedCount = mappings.filter((m) => m.status === "CONNECTED").length;
  const scaleCandidates = mappings.filter((m) => m.roasToday >= 2.5 && m.budgetDaily > 0);
  const weakCandidates = mappings.filter((m) => m.roasToday > 0 && m.roasToday < 1.8);
  const selectedMapping = mappings.find((m) => m.id === selectedMappingId) || mappings[0];
  const historyPoints = mappings
    .filter((m) => m.status === "CONNECTED")
    .map((m, idx) => ({
      id: m.id,
      sku: m.sku,
      roas: m.roasToday,
      spend: Math.round(m.spendToday / 1000),
      revenue: Math.round(m.revenueToday / 1000),
      budget: Math.round(m.budgetDaily / 1000),
      trend: [0.74, 0.92, 0.81, 1.04, 1.18, 0.96, 1.12].map((v, i) => Math.max(18, Math.round((m.roasToday * 18) + i * 6 + v * 8 - idx * 7))),
    }));
  const selectedHistory = historyPoints.find((item) => item.id === selectedMappingId) || historyPoints[0];

  const connectMeta = () => {
    setMetaConnected(true);
    pushActivity(`Đã kết nối Meta Ads account ${accountId}.`);
    setLiveAlerts((prev) => [{ id: `alert-${Date.now()}`, level: "good", title: "Meta đã kết nối", desc: `Ad account ${accountId} đã sẵn sàng cho execute.` }, ...prev].slice(0, 5));
  };

  const logDecision = (mapping, decision, reason, action, nextBudget, rollbackBudget) => {
    setDecisionLogs((prev) => [{ id: `d-${Date.now()}-${Math.random()}`, time: formatDate(), sku: mapping.sku, decision, reason, action, nextBudget, rollbackBudget }, ...prev].slice(0, 10));
  };

  const updateBudget = (id, percent, label) => {
    const target = mappings.find((m) => m.id === id);
    if (!target) return;
    const nextBudget = Math.round(target.budgetDaily * (1 + percent / 100));
    setMappings((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      return { ...m, budgetDaily: nextBudget, lastAction: `${label} ${percent > 0 ? `+${percent}%` : `${percent}%`} · ${formatDate()}` };
    }));
    logDecision(target, `${label} ${percent > 0 ? `+${percent}%` : `${percent}%`}`, percent > 0 ? `ROAS ${target.roasToday.toFixed(2)} đủ tốt để scale` : `ROAS ${target.roasToday.toFixed(2)} cần hạ budget`, "applied", nextBudget, target.budgetDaily);
    pushActivity(`Autopilot: ${label} cho ${target.sku}.`);
  };

  const pauseAdset = (id) => {
    const target = mappings.find((m) => m.id === id);
    if (!target) return;
    setMappings((prev) => prev.map((m) => m.id === id ? { ...m, lastAction: `Pause ad set · ${formatDate()}` } : m));
    logDecision(target, "Pause ad set", `ROAS ${target.roasToday.toFixed(2)} dưới ngưỡng an toàn`, "applied", target.budgetDaily, target.budgetDaily);
    pushActivity(`Autopilot: pause ad set cho ${target.sku}.`);
  };

  const rollbackDecision = (logId) => {
    const item = decisionLogs.find((log) => log.id === logId);
    if (!item) return;
    const target = mappings.find((m) => m.sku === item.sku);
    if (!target) return;
    setMappings((prev) => prev.map((m) => m.id === target.id ? { ...m, budgetDaily: item.rollbackBudget || m.budgetDaily, lastAction: `Rollback từ ${item.decision} · ${formatDate()}` } : m));
    logDecision(target, `Rollback ${item.decision}`, `Khôi phục về budget trước thay đổi`, "rollback", item.rollbackBudget || target.budgetDaily, item.nextBudget || target.budgetDaily);
    pushActivity(`Autopilot: rollback cho ${item.sku}.`);
  };

  const runAutoDecision = () => {
    if (automationLevel === "manual") return;
    const nextLogs = [];
    setMappings((prev) => prev.map((m) => {
      if (m.roasToday >= 2.5 && m.status === "CONNECTED") {
        const nextBudget = Math.round(m.budgetDaily * 1.2);
        nextLogs.push({ mapping: m, decision: automationLevel === "semi" ? "Đề xuất scale +20%" : "Auto scale +20%", reason: `ROAS ${m.roasToday.toFixed(2)} vượt ngưỡng 2.5`, action: automationLevel === "semi" ? "suggested" : "applied", nextBudget, rollbackBudget: m.budgetDaily });
        return { ...m, budgetDaily: automationLevel === "auto" ? nextBudget : m.budgetDaily, lastAction: automationLevel === "semi" ? `Đề xuất scale +20%` : `Auto scale +20% · ${formatDate()}` };
      }
      if (automationLevel === "auto" && m.roasToday > 0 && m.roasToday < 1.5) {
        nextLogs.push({ mapping: m, decision: "Auto pause", reason: `ROAS ${m.roasToday.toFixed(2)} dưới 1.5`, action: "applied", nextBudget: m.budgetDaily, rollbackBudget: m.budgetDaily });
        return { ...m, lastAction: `Auto pause · ${formatDate()}` };
      }
      return m;
    }));
    nextLogs.forEach((item) => logDecision(item.mapping, item.decision, item.reason, item.action, item.nextBudget, item.rollbackBudget));
    if (nextLogs.length) {
      setLiveAlerts((prev) => [{ id: `alert-${Date.now()}`, level: automationLevel === "auto" ? "critical" : "high", title: `Autopilot vừa chạy ${nextLogs.length} quyết định`, desc: automationLevel === "auto" ? "Đã áp rule thật lên budget / pause." : "Đã tạo các gợi ý để duyệt." }, ...prev].slice(0, 5));
    }
    pushActivity(`Autopilot: chạy rule ${automationLevel}.`);
  };

  const endpointPreview = `${apiBaseUrl.replace(/\/$/, "")}/autopilot/execute`;
  const productionCode = `export class MetaAdsService {
  constructor(private readonly token: string, private readonly apiVersion = "v20.0") {}

  async updateAdsetBudget(adsetId: string, budgetMinor: number) {
    const url = new URL(\`https://graph.facebook.com/\${this.apiVersion}/\${adsetId}\`);
    const body = new URLSearchParams({
      access_token: this.token,
      daily_budget: String(budgetMinor),
    });
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async pauseAdset(adsetId: string) {
    const url = new URL(\`https://graph.facebook.com/\${this.apiVersion}/\${adsetId}\`);
    const body = new URLSearchParams({
      access_token: this.token,
      status: "PAUSED",
    });
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

export async function executeAutopilotDecision(payload: {
  token: string;
  action: "scale15" | "scale25" | "cut15" | "pause";
  adsetId: string;
  currentBudgetMinor: number;
}) {
  const meta = new MetaAdsService(payload.token);
  if (payload.action === "pause") return meta.pauseAdset(payload.adsetId);
  const factor = payload.action === "scale25" ? 1.25 : payload.action === "scale15" ? 1.15 : 0.85;
  const nextBudget = Math.round(payload.currentBudgetMinor * factor);
  return meta.updateAdsetBudget(payload.adsetId, nextBudget);
}`;

  const autopilotApiCode = `import { Body, Controller, Post } from "@nestjs/common";

class ExecuteDto {
  token!: string;
  action!: "scale15" | "scale25" | "cut15" | "pause";
  adsetId!: string;
  currentBudgetMinor!: number;
  dryRun?: boolean;
}

@Controller("autopilot")
export class AutopilotController {
  @Post("execute")
  async execute(@Body() dto: ExecuteDto) {
    if (dto.dryRun) {
      return {
        ok: true,
        mode: "dry_run",
        preview: dto,
      };
    }
    return executeAutopilotDecision(dto);
  }
}`;

  const executeAgainstApi = async (action) => {
    if (!selectedMapping) return;
    const payload = {
      token,
      action,
      adsetId: selectedMapping.adsetId,
      currentBudgetMinor: selectedMapping.budgetDaily,
      dryRun,
    };
    try {
      const res = await fetch(endpointPreview, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      setExecutionOutput(JSON.stringify(data, null, 2));
      logDecision(selectedMapping, `Execute ${action}`, dryRun ? "Dry run từ UI Autopilot" : "Live execute từ UI Autopilot", dryRun ? "preview" : "applied", selectedMapping.budgetDaily, selectedMapping.budgetDaily);
      setLiveAlerts((prev) => [{ id: `alert-${Date.now()}`, level: dryRun ? "good" : "high", title: `Đã chạy ${action} cho ${selectedMapping.sku}`, desc: dryRun ? "Mới là preview response từ backend." : "Đã gửi execute thật xuống backend." }, ...prev].slice(0, 5));
      pushActivity(`Autopilot API execute ${action} cho ${selectedMapping.sku}.`);
    } catch (error) {
      setExecutionOutput(String(error));
      setLiveAlerts((prev) => [{ id: `alert-${Date.now()}`, level: "critical", title: `Lỗi execute ${action}`, desc: String(error) }, ...prev].slice(0, 5));
    }
  };

  const alertTone = (level) => level === "critical" ? "red" : level === "high" ? "amber" : "green";

  return (
    <div className="space-y-6">
      <SectionTitle title="Autopilot" description="Gộp Ads + Automation vào một chỗ: overview, control và automation engine." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Meta connection" value={metaConnected ? "Connected" : "Not connected"} sub={metaConnected ? accountId : "Cần token + ad account"} />
        <StatCard title="Automation level" value={automationLevel.toUpperCase()} sub="Mức 1 / 2 / 3" />
        <StatCard title="SKU đã map" value={connectedCount} sub="Connected to Meta" />
        <StatCard title="Nên scale" value={scaleCandidates.length} sub="ROAS >= 2.5" />
        <StatCard title="Yếu / nên pause" value={weakCandidates.length} sub="ROAS < 1.8" />
      </div>

      <Panel>
        <div className="flex flex-wrap gap-2 p-5">
          {[
            { id: "overview", label: "Overview" },
            { id: "control", label: "Control" },
            { id: "automation", label: "Automation" },
          ].map((item) => (
            <button key={item.id} onClick={() => setAutopilotTab(item.id)} className={`rounded-full px-4 py-2 text-sm font-medium ${autopilotTab === item.id ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </Panel>

      {autopilotTab === "overview" && (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Real-time alert</h3>
                  <Badge tone="blue">Live feed</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {liveAlerts.map((alert) => (
                    <div key={alert.id} className={`rounded-2xl border p-4 ${alert.level === "critical" ? "border-red-200 bg-red-50" : alert.level === "high" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{alert.title}</p>
                        <Badge tone={alertTone(alert.level)}>{alert.level}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-neutral-600">{alert.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">History graph</h3>
                  <Badge tone="amber">7 phiên gần nhất</Badge>
                </div>
                {selectedHistory ? (
                  <div className="mt-4">
                    <div className="mb-4 flex items-center justify-between gap-3 text-sm text-neutral-600">
                      <span>{selectedHistory.sku}</span>
                      <span>ROAS {selectedHistory.roas.toFixed(2)} · Budget {selectedHistory.budget}k</span>
                    </div>
                    <div className="flex h-44 items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      {selectedHistory.trend.map((point, idx) => (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                          <div className="w-full rounded-t-xl bg-neutral-900" style={{ height: `${point}px` }} />
                          <span className="text-[10px] text-neutral-400">D{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-2xl border border-neutral-200 p-3"><span className="text-neutral-500">Spend</span><div className="mt-1 font-medium">{selectedHistory.spend}k</div></div>
                      <div className="rounded-2xl border border-neutral-200 p-3"><span className="text-neutral-500">Revenue</span><div className="mt-1 font-medium">{selectedHistory.revenue}k</div></div>
                      <div className="rounded-2xl border border-neutral-200 p-3"><span className="text-neutral-500">Budget</span><div className="mt-1 font-medium">{selectedHistory.budget}k</div></div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-neutral-500">Chưa có dữ liệu đồ thị.</div>
                )}
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Decision log</h3>
                <Badge tone="blue">Tại sao scale / cut</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {decisionLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{log.sku}</p>
                          <Badge tone={log.action === "applied" ? "green" : log.action === "rollback" ? "amber" : "blue"}>{log.action}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-neutral-900">{log.decision}</p>
                        <p className="mt-2 text-sm text-neutral-500">{log.reason}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-neutral-500">{log.time}</div>
                        <Button variant="secondary" onClick={() => rollbackDecision(log.id)}>Rollback 1 click</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </>
      )}

      {autopilotTab === "control" && (
        <>
          <Panel>
            <div className="grid gap-4 p-5 xl:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Kết nối Meta</h3>
                <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Ad account ID" />
                <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Access token" />
                <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="API base URL" />
                <div className="flex items-center gap-3">
                  <Button onClick={connectMeta} disabled={!accountId}>Connect Meta</Button>
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />Dry run</label>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">3 mức tự động</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <button onClick={() => setAutomationLevel("manual")} className={`rounded-2xl border p-4 text-left ${automationLevel === "manual" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>
                    <p className="font-medium">Mức 1</p>
                    <p className="mt-1 text-xs opacity-80">Chỉ gợi ý</p>
                  </button>
                  <button onClick={() => setAutomationLevel("semi")} className={`rounded-2xl border p-4 text-left ${automationLevel === "semi" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>
                    <p className="font-medium">Mức 2</p>
                    <p className="mt-1 text-xs opacity-80">Có nút bấm scale</p>
                  </button>
                  <button onClick={() => setAutomationLevel("auto")} className={`rounded-2xl border p-4 text-left ${automationLevel === "auto" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>
                    <p className="font-medium">Mức 3</p>
                    <p className="mt-1 text-xs opacity-80">Rule tự động</p>
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={runAutoDecision}>Run rule now</Button>
                  <Badge tone={automationLevel === "auto" ? "red" : automationLevel === "semi" ? "amber" : "blue"}>{automationLevel.toUpperCase()}</Badge>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="grid gap-4 p-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div>
                <h3 className="text-lg font-semibold">SKU ↔ Campaign / Ad Set Mapping</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-neutral-500">
                      <tr>
                        <th className="pb-3 font-medium">SKU</th>
                        <th className="pb-3 font-medium">Campaign</th>
                        <th className="pb-3 font-medium">Ad set</th>
                        <th className="pb-3 font-medium">ROAS hôm nay</th>
                        <th className="pb-3 font-medium">Budget ngày</th>
                        <th className="pb-3 font-medium">Trạng thái</th>
                        <th className="pb-3 font-medium">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => (
                        <tr key={m.id} className={`border-t border-neutral-200 align-top ${selectedMappingId === m.id ? "bg-neutral-50" : ""}`}>
                          <td className="py-3"><button className="text-left" onClick={() => setSelectedMappingId(m.id)}><p className="font-medium">{m.sku}</p><p className="text-xs text-neutral-500">{m.productName}</p></button></td>
                          <td className="py-3"><p>{m.campaignName}</p><p className="text-xs text-neutral-500">{m.campaignId}</p></td>
                          <td className="py-3"><p>{m.adsetName}</p><p className="text-xs text-neutral-500">{m.adsetId}</p></td>
                          <td className="py-3">{m.roasToday.toFixed(2)}</td>
                          <td className="py-3">{currency(m.budgetDaily)}</td>
                          <td className="py-3"><Badge tone={toneForStatus(m.status)}>{m.status}</Badge><p className="mt-2 text-xs text-neutral-500">{m.lastAction}</p></td>
                          <td className="py-3">
                            <div className="flex flex-col gap-2">
                              <Button disabled={m.status !== "CONNECTED" || automationLevel === "manual"} onClick={() => updateBudget(m.id, 20, "Scale budget")}>+20%</Button>
                              <Button variant="secondary" disabled={m.status !== "CONNECTED"} onClick={() => updateBudget(m.id, -15, "Giảm budget")}>-15%</Button>
                              <Button variant="danger" disabled={m.status !== "CONNECTED"} onClick={() => pauseAdset(m.id)}>Pause</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Execute thật qua API</h3>
                    <Badge tone={dryRun ? "amber" : "green"}>{dryRun ? "DRY RUN" : "LIVE"}</Badge>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-2xl border border-neutral-200 bg-white p-3"><span className="text-neutral-500">Endpoint</span><div className="mt-1 font-mono text-xs break-all">{endpointPreview}</div></div>
                    <div className="rounded-2xl border border-neutral-200 bg-white p-3"><span className="text-neutral-500">Ad set đang chọn</span><div className="mt-1 font-medium">{selectedMapping?.adsetId || "—"}</div></div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => executeAgainstApi("scale15")} disabled={!selectedMapping || !token}>Execute +15%</Button>
                      <Button variant="secondary" onClick={() => executeAgainstApi("scale25")} disabled={!selectedMapping || !token}>Execute +25%</Button>
                      <Button variant="secondary" onClick={() => executeAgainstApi("cut15")} disabled={!selectedMapping || !token}>Execute -15%</Button>
                      <Button variant="danger" onClick={() => executeAgainstApi("pause")} disabled={!selectedMapping || !token}>Pause thật</Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-neutral-200 bg-neutral-900 p-5 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Execution output</h3>
                    <button onClick={() => navigator.clipboard.writeText(executionOutput)} className="rounded-full border border-white/20 px-3 py-1 text-xs">Copy</button>
                  </div>
                  <pre className="mt-4 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-2xl bg-black/20 p-4 text-xs text-stone-200">{executionOutput}</pre>
                </div>
              </div>
            </div>
          </Panel>
        </>
      )}

      {autopilotTab === "automation" && (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Code execute + Meta API</h3>
                  <button onClick={() => navigator.clipboard.writeText(productionCode)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs">Copy</button>
                </div>
                <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl bg-neutral-950 p-4 text-xs text-neutral-200">{productionCode}</pre>
              </div>
            </Panel>
            <Panel>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Nest API /autopilot/execute</h3>
                  <button onClick={() => navigator.clipboard.writeText(autopilotApiCode)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs">Copy</button>
                </div>
                <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl bg-neutral-950 p-4 text-xs text-neutral-200">{autopilotApiCode}</pre>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel>
              <div className="p-5">
                <h3 className="text-lg font-semibold">3 mức vận hành</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border p-4"><p className="font-medium">Mức 1 · Manual</p><p className="mt-1 text-neutral-500">Chỉ hiển thị gợi ý. Người vận hành tự quyết định ngoài Ads Manager.</p></div>
                  <div className="rounded-2xl border p-4"><p className="font-medium">Mức 2 · Semi-auto</p><p className="mt-1 text-neutral-500">Dashboard gợi ý, staff bấm nút scale / giảm / pause trên hệ thống.</p></div>
                  <div className="rounded-2xl border p-4"><p className="font-medium">Mức 3 · Auto</p><p className="mt-1 text-neutral-500">Rule chạy tự động có guardrail: scale nhẹ ad set tốt, pause ad set yếu.</p></div>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="p-5">
                <h3 className="text-lg font-semibold">Nguyên tắc an toàn</h3>
                <div className="mt-4 space-y-3 text-sm text-neutral-600">
                  <p>• Chỉ scale nếu SKU còn hàng và ROAS đủ tốt.</p>
                  <p>• Chỉ tăng ngân sách nhẹ 15–25% mỗi lần.</p>
                  <p>• Tự động pause khi ROAS quá thấp ở mức 3.</p>
                  <p>• Mọi hành động đều ghi vào decision log và có rollback 1 click.</p>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function AIContentPage({ products, orders, adsMappings, pushActivity }) {
  const [selectedSku, setSelectedSku] = useState("QS794-GREEN-S");
  const [tone, setTone] = useState("classic");
  const [objective, setObjective] = useState("scale");

  const allVariants = products.flatMap((product) =>
    product.variants.map((variant) => ({ ...variant, productName: product.name, productDescription: product.description }))
  );
  const selectedVariant = allVariants.find((v) => v.sku === selectedSku) || allVariants[0];
  const soldQty = orders.flatMap((o) => o.items).filter((i) => i.sku === selectedSku).reduce((s, i) => s + i.qty, 0);
  const mapping = adsMappings.find((m) => m.sku === selectedSku);
  const roas = mapping?.roasToday || 0;
  const stock = selectedVariant?.stock || 0;

  const toneMap = {
    classic: "classic American, heritage, refined old-money",
    aggressive: "direct response, mạnh tay, rõ lợi ích mua ngay",
    minimal: "ít chữ, gọn, tinh tế, editorial",
  };

  const headlineSet = {
    scale: [
      `${selectedVariant?.productName} đang là mã sáng nhất hôm nay`,
      `Mẫu bán tốt, form đẹp, dễ chốt nhất lúc này`,
      `Một chiếc tee rất dễ mặc và đang bán cực ổn`,
    ],
    launch: [
      `New drop cho tủ đồ hằng ngày`,
      `Một lựa chọn mới nhưng rất đúng chất The 1970`,
      `Lên outfit gọn và có mood ngay từ lần mặc đầu`,
    ],
    clearance: [
      `Mã đẹp nhưng cần đẩy nhanh hơn`,
      `Cơ hội chốt nhanh trước khi đổi set hàng`,
      `Một lựa chọn đáng thử với mức xuống tiền dễ hơn`,
    ],
  };

  const captionSet = {
    scale: [
      `${selectedVariant?.productName} là mẫu đang chạy tốt nhờ phom gọn, màu dễ mặc và chất vải đứng form. Nếu đang tìm một item có thể mặc đi làm, đi chơi, lên ảnh vẫn gọn thì đây là mã rất đáng thử.`,
      `${selectedVariant?.productName} giữ đúng tinh thần The 1970: mặc lên gọn người, màu sắc nam tính và rất dễ phối với jeans, chinos hoặc layer nhẹ. Đây là kiểu sản phẩm nhìn đơn giản nhưng mặc vào ra form ngay.`,
      `Không phải mẫu nào cũng vừa có mood classic vừa dễ bán. ${selectedVariant?.productName} đang cho thấy điều đó khá rõ: dễ mặc, dễ lên outfit và hợp nhiều nhóm khách nam mặc hằng ngày.`,
    ],
    launch: [
      `${selectedVariant?.productName} là hướng đi đúng cho khách thích sự gọn gàng nhưng không quá basic. Vibe cổ điển vừa đủ, phom mặc hằng ngày rất dễ tiếp cận và hợp để mở đầu một đợt test nội dung mới.`,
      `Nếu muốn ra mắt một mã theo đúng tinh thần heritage của The 1970, ${selectedVariant?.productName} là kiểu sản phẩm rất dễ kể câu chuyện: form đẹp, chất tử tế, màu sắc có chiều sâu.`,
      `Một mẫu mới nhưng không khó mặc. ${selectedVariant?.productName} phù hợp với hướng nội dung editorial, classic và vẫn đủ commercial để chạy ads test nhanh.`,
    ],
    clearance: [
      `${selectedVariant?.productName} vẫn là một mã đẹp, nhưng lúc này nên đổi angle tiếp cận: nói rõ lợi ích mặc lên, gợi ý outfit và thêm một chút urgency để đẩy tốc độ ra hàng.`,
      `Nếu muốn xả stock nhanh mà không làm mất chất brand, hãy đi theo hướng “mã dễ mặc nhất tuần này” cho ${selectedVariant?.productName}, thay vì viết quá nhiều về thông số kỹ thuật.`,
      `Đây không phải sản phẩm yếu, mà là sản phẩm đang cần đúng content hơn. Với ${selectedVariant?.productName}, angle hợp lý sẽ là: dễ mặc, gọn dáng, có sẵn size và nên thử ngay lúc này.`,
    ],
  };

  const ctaSet = {
    scale: ["Nhấn xem sản phẩm", "Chọn size còn sẵn", "Xem ngay trước khi hết size đẹp"],
    launch: ["Xem drop mới", "Khám phá sản phẩm mới", "Xem full look"],
    clearance: ["Xem giá hiện tại", "Chốt nhanh size còn sẵn", "Vào xem trước khi đổi set hàng"],
  };

  const generateImagePreview = (concept) => {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
        <rect width='100%' height='100%' fill='#f5f5f5'/>
        <text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='#111' font-family='Arial'>
          ${concept.headline.slice(0,30)}
        </text>
        <text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='#555' font-family='Arial'>
          The 1970 Preview
        </text>
      </svg>
    `)}`;
  };

  const imageSuggestions = [
    `Mock preview: nền be + model đứng thẳng, overlay chữ nhỏ góc trái`,
    `Mock preview: ảnh lifestyle ngoài trời tone film, hơi grain`,
    `Ảnh 1: clean studio, thấy rõ form áo ${selectedVariant?.color || ""} và texture vải`,
    `Ảnh 2: outfit full-body với jeans/chinos để nhấn fit và vibe ${toneMap[tone]}`,
    `Ảnh 3: close-up cổ áo, vai áo, bề mặt vải để tăng cảm giác chất lượng`,
    `Ảnh 4: editorial crop với overlay text ngắn như “Best Seller” hoặc “New Season”`,
  ];

  const videoSuggestions = [
    `Video 1: quay mẫu bước vào khung hình, 3 góc cơ bản, 6–10 giây`,
    `Video 2: cận cảnh chất vải + bo cổ + tay áo, nhịp nhanh để chạy Reels`,
    `Video 3: before/after outfit với cùng quần để thấy chiếc áo lên mood rõ hơn`,
  ];

  const targetingSuggestions = [
    tone === "classic" ? "Nam 24–38, quan tâm Ralph Lauren, menswear classic, heritage style" : null,
    tone === "aggressive" ? "Broad nam 22–34 + lookalike purchasers nếu có data" : null,
    tone === "minimal" ? "Retarget người đã vào web hoặc xem IG/Facebook content editorial" : null,
    objective === "scale" ? "Ưu tiên ad set đang có ROAS tốt, tăng 20% budget nếu còn stock" : null,
    objective === "clearance" ? "Dùng audience retarget + angle urgency + offer nhẹ" : null,
  ].filter(Boolean);

  const [seed, setSeed] = useState(0);
  const shuffle = (arr) => [...arr].sort(() => 0.5 - Math.random());
  const contentCards = shuffle(headlineSet[objective]).map((headline, idx) => ({
    headline,
    caption: shuffle(captionSet[objective])[idx],
    cta: shuffle(ctaSet[objective])[idx],
  }));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="AI Content"
        description="Full mode: generate caption, angle, gợi ý ảnh/video và target ads cho từng SKU."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSeed(Date.now())}>🔄 Generate lại</Button>
            <Button onClick={() => pushActivity(`AI Content: tạo content cho ${selectedSku}.`)}>Lưu vào activity</Button>
          </div>
        }
      />

      <Panel>
        <div className="grid gap-4 p-5 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <label className="mb-2 block text-sm font-medium">Chọn SKU</label>
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)}>
              {allVariants.map((variant) => <option key={variant.id} value={variant.sku}>{variant.productName} · {variant.sku}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Vibe content</label>
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="classic">Classic</option>
              <option value="aggressive">Aggressive</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Mục tiêu</label>
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={objective} onChange={(e) => setObjective(e.target.value)}>
              <option value="scale">Scale</option>
              <option value="launch">Launch</option>
              <option value="clearance">Clearance</option>
            </select>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="SKU đang chọn" value={selectedSku} sub={selectedVariant?.productName || "—"} />
        <StatCard title="Đã bán" value={soldQty} sub="Từ dữ liệu đơn hàng" />
        <StatCard title="ROAS hôm nay" value={roas ? roas.toFixed(2) : "0.00"} sub="Theo mapping ads" />
        <StatCard title="Stock hiện tại" value={stock} sub="Tồn để scale" />
        <StatCard title="Vibe" value={tone.toUpperCase()} sub={toneMap[tone]} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="p-5">
            <h3 className="text-lg font-semibold">3 concept ads đề xuất</h3>
            <div className="mt-4 space-y-4">
              {contentCards.map((card, idx) => (
                <div key={idx} className="rounded-2xl border border-neutral-200 p-4 relative">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">Concept {idx + 1}</p>
                  <p className="mt-2 font-semibold">{card.headline}</p>
                  <p className="mt-3 text-sm leading-6 text-neutral-700">{card.caption}</p>
                  <img src={generateImagePreview(card)} className="mt-3 w-full rounded-xl border" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="blue">CTA: {card.cta}</Badge>
                    <Badge tone={objective === "scale" ? "green" : objective === "clearance" ? "amber" : "gray"}>{objective.toUpperCase()}</Badge>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText([card.headline, card.caption, `CTA: ${card.cta}`].join(String.fromCharCode(10) + String.fromCharCode(10)))} className="absolute top-3 right-3 rounded-lg border bg-white px-2 py-1 text-xs hover:bg-neutral-100">Copy</button>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Gợi ý ảnh</h3>
              <div className="mt-4 space-y-3 text-sm text-neutral-700">
                {imageSuggestions.map((item, idx) => <div key={idx} className="rounded-2xl border border-neutral-200 p-3">{item}</div>)}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Gợi ý video</h3>
              <div className="mt-4 space-y-3 text-sm text-neutral-700">
                {videoSuggestions.map((item, idx) => <div key={idx} className="rounded-2xl border border-neutral-200 p-3">{item}</div>)}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Gợi ý target ads</h3>
              <div className="mt-4 space-y-3 text-sm text-neutral-700">
                {targetingSuggestions.map((item, idx) => <div key={idx} className="rounded-2xl border border-neutral-200 p-3">{item}</div>)}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PermissionsPage({ employees, setEmployees }) {
  const [selectedRoleId, setSelectedRoleId] = useState("fulltime");
  const [editingUserId, setEditingUserId] = useState(null);
  const [newEmployee, setNewEmployee] = useState({ name: "", code: "", roleId: "retail-staff", branchIds: ["b1"] });

  const selectedRole = roleTemplates.find((role) => role.id === selectedRoleId) || roleTemplates[0];
  const branchScopedRoles = roleTemplates.filter((role) => role.scope === "ONE_BRANCH").length;
  const totalActive = employees.filter((e) => e.status === "WORKING").length;
  const totalInactive = employees.filter((e) => e.status === "INACTIVE").length;
  const assignedEmployees = employees.filter((employee) => employee.roleId === selectedRoleId);

  const updateEmployeeRole = (employeeId, roleId) => {
    setEmployees((prev) => prev.map((employee) => {
      if (employee.id !== employeeId) return employee;
      const role = roleTemplates.find((r) => r.id === roleId);
      return {
        ...employee,
        roleId,
        branchIds: role?.scope === "ALL_BRANCHES" ? branches.map((b) => b.id) : [employee.branchIds?.[0] || "b1"],
      };
    }));
  };

  const updateEmployeeBranch = (employeeId, branchId) => {
    setEmployees((prev) => prev.map((employee) => employee.id === employeeId ? { ...employee, branchIds: [branchId] } : employee));
  };

  const toggleEmployeeStatus = (employeeId) => {
    setEmployees((prev) => prev.map((employee) => employee.id === employeeId ? { ...employee, status: employee.status === "WORKING" ? "INACTIVE" : "WORKING" } : employee));
  };

  const addEmployee = () => {
    if (!newEmployee.name.trim() || !newEmployee.code.trim()) return;
    const role = roleTemplates.find((r) => r.id === newEmployee.roleId);
    setEmployees((prev) => [{
      id: `u${Date.now()}`,
      name: newEmployee.name.trim(),
      code: newEmployee.code.trim(),
      status: "WORKING",
      roleId: newEmployee.roleId,
      branchIds: role?.scope === "ALL_BRANCHES" ? branches.map((b) => b.id) : newEmployee.branchIds,
    }, ...prev]);
    setNewEmployee({ name: "", code: "", roleId: "retail-staff", branchIds: ["b1"] });
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Phân quyền" description="Gán user vào role và khóa dữ liệu theo chi nhánh phụ trách." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tổng vai trò" value={roleTemplates.length} sub="Bản tinh gọn" />
        <StatCard title="Role theo chi nhánh" value={branchScopedRoles} sub="Chỉ thấy dữ liệu chi nhánh phụ trách" />
        <StatCard title="Nhân sự đang làm" value={totalActive} sub="Toàn hệ thống" />
        <StatCard title="Nhân sự đã nghỉ" value={totalInactive} sub="Lưu để audit" />
      </div>

      <Panel>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_1fr_1fr_180px]">
          <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newEmployee.name} onChange={(e) => setNewEmployee((prev) => ({ ...prev, name: e.target.value }))} placeholder="Tên nhân viên" />
          <input className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newEmployee.code} onChange={(e) => setNewEmployee((prev) => ({ ...prev, code: e.target.value }))} placeholder="Mã nhân viên" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newEmployee.roleId} onChange={(e) => setNewEmployee((prev) => ({ ...prev, roleId: e.target.value }))}>
              {roleTemplates.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={newEmployee.branchIds[0]} onChange={(e) => setNewEmployee((prev) => ({ ...prev, branchIds: [e.target.value] }))} disabled={roleTemplates.find((r) => r.id === newEmployee.roleId)?.scope === "ALL_BRANCHES"}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <Button onClick={addEmployee}>+ Gán user</Button>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Danh sách vai trò</h3>
                <p className="mt-1 text-sm text-neutral-500">Chọn role để xem ai đang được gán và họ phụ trách chi nhánh nào.</p>
              </div>
              <Badge tone="blue">Role → User → Branch</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="pb-3 font-medium">Vai trò</th>
                    <th className="pb-3 font-medium">Đang làm</th>
                    <th className="pb-3 font-medium">Phạm vi</th>
                    <th className="pb-3 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {roleTemplates.map((role) => {
                    const active = selectedRoleId === role.id;
                    const activeCount = employees.filter((e) => e.roleId === role.id && e.status === "WORKING").length;
                    return (
                      <tr key={role.id} className={`border-t border-neutral-200 ${active ? "bg-neutral-50" : ""}`}>
                        <td className="py-3">
                          <button className="text-left" onClick={() => setSelectedRoleId(role.id)}>
                            <p className="font-medium text-neutral-900">{role.name}</p>
                            <p className="text-xs text-neutral-500">{role.updatedAt}</p>
                          </button>
                        </td>
                        <td className="py-3">{activeCount}</td>
                        <td className="py-3"><Badge tone={role.scope === "ALL_BRANCHES" ? "red" : "blue"}>{role.scope === "ALL_BRANCHES" ? "Toàn hệ thống" : "Theo chi nhánh"}</Badge></td>
                        <td className="py-3 text-neutral-600">{role.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold">{selectedRole.name}</h3>
                <Badge tone={selectedRole.scope === "ALL_BRANCHES" ? "red" : "blue"}>{selectedRole.scope === "ALL_BRANCHES" ? "Toàn hệ thống" : "Theo chi nhánh"}</Badge>
                {selectedRole.permissions.reports.length === 0 && <Badge tone="amber">Không có báo cáo</Badge>}
              </div>
              <p className="mt-2 text-sm text-neutral-600">{selectedRole.description}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-neutral-200 p-4"><p className="text-sm text-neutral-500">Đang được gán</p><p className="mt-2 text-2xl font-semibold">{assignedEmployees.length}</p></div>
                <div className="rounded-2xl border border-neutral-200 p-4"><p className="text-sm text-neutral-500">Ngày tạo</p><p className="mt-2 text-lg font-semibold">{selectedRole.createdAt}</p></div>
                <div className="rounded-2xl border border-neutral-200 p-4"><p className="text-sm text-neutral-500">Cập nhật cuối</p><p className="mt-2 text-lg font-semibold">{selectedRole.updatedAt}</p></div>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">User đang được gán role này</h3>
                <Badge tone="blue">{assignedEmployees.length} user</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {assignedEmployees.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-500">Chưa có user nào được gán vào role này.</div>
                ) : (
                  assignedEmployees.map((employee) => {
                    const isEditing = editingUserId === employee.id;
                    const employeeRole = roleTemplates.find((r) => r.id === employee.roleId);
                    return (
                      <div key={employee.id} className="rounded-2xl border border-neutral-200 p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{employee.name}</p>
                              <Badge tone={employee.status === "WORKING" ? "green" : "gray"}>{employee.status === "WORKING" ? "Đang làm" : "Đã nghỉ"}</Badge>
                              <Badge tone="gray">{employee.code}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-neutral-500">Chi nhánh phụ trách: {employeeRole?.scope === "ALL_BRANCHES" ? "Toàn hệ thống" : employee.branchIds.map((id) => branchName(id)).join(", ")}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setEditingUserId(isEditing ? null : employee.id)}>{isEditing ? "Đóng" : "Sửa gán role"}</Button>
                            <Button variant="secondary" onClick={() => toggleEmployeeStatus(employee.id)}>{employee.status === "WORKING" ? "Cho nghỉ" : "Kích hoạt lại"}</Button>
                          </div>
                        </div>
                        {isEditing && (
                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={employee.roleId} onChange={(e) => updateEmployeeRole(employee.id, e.target.value)}>
                              {roleTemplates.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                            </select>
                            <select className="w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none" value={employee.branchIds?.[0] || "b1"} onChange={(e) => updateEmployeeBranch(employee.id, e.target.value)} disabled={roleTemplates.find((r) => r.id === employee.roleId)?.scope === "ALL_BRANCHES"}>
                              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Phân quyền chi tiết</h3>
                  <p className="mt-1 text-sm text-neutral-500">Chuẩn enterprise: mỗi module có mô tả, summary quyền đang có và danh sách quyền chi tiết khi mở rộng.</p>
                </div>
                <Badge tone="blue">Permission summary</Badge>
              </div>
              <div className="mt-4 space-y-4">
                {permissionGroups.map((group) => {
                  const items = selectedRole.permissions[group.key] || [];
                  return (
                    <PermissionModuleCard
                      key={group.key}
                      label={group.label}
                      description={permissionGroupDescriptions[group.key]}
                      items={items}
                    />
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function The1970AdminStarter() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [stocktakes, setStocktakes] = useState(initialStocktakes);
  const [adsMappings, setAdsMappings] = useState(initialAdsMappings);
  const [globalSearch, setGlobalSearch] = useState("");
  const [activities, setActivities] = useState([
    { id: "pl1", message: "Giá QS794-GREEN-S được set 390.000đ / cost 220.000đ", time: "25/03/2026 09:15" },
    { id: "a1", message: "Đã tạo đơn ORD-1774C từ kênh FACEBOOK.", time: "25/03/2026 11:10" },
    { id: "a2", message: "Đã xác nhận đơn ORD-1774B.", time: "25/03/2026 10:08" },
    { id: "a3", message: "Đã thêm sản phẩm Heritage Tee Tobacco.", time: "25/03/2026 09:40" },
  ]);
  const [employees, setEmployees] = useState(initialEmployees);
  const [activeEmployeeId, setActiveEmployeeId] = useState("u1");
  const [productAuditLogs, setProductAuditLogs] = useState([
    { id: "log1", productId: "p1", sku: "QS794-GREEN-S", actor: "Admin The 1970", time: "25/03/2026 09:15", message: "Tạo giá bán 390.000đ, giá nhập 220.000đ" },
    { id: "log2", productId: "p2", sku: "SM902-REUDEN-M", actor: "Admin The 1970", time: "25/03/2026 09:22", message: "Điều chỉnh giá bán 650.000đ → 620.000đ" },
  ]);
  const activeEmployee = employees.find((employee) => employee.id === activeEmployeeId) || employees[0];
  const activeRole = roleTemplates.find((role) => role.id === activeEmployee?.roleId) || roleTemplates[0];
  const sessionIsAdmin = activeRole?.id === "admin";
  const scopedBranchIds = activeRole?.scope === "ALL_BRANCHES" ? branches.map((b) => b.id) : (activeEmployee?.branchIds || []);
  const visibleProducts = useMemo(() => {
    const q = globalSearch.toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));
  }, [products, globalSearch]);
  const visibleOrders = useMemo(() => {
    const q = globalSearch.toLowerCase();
    const branchFiltered = orders.filter((o) => scopedBranchIds.includes(o.branchId));
    if (!q) return branchFiltered;
    return branchFiltered.filter((o) => o.orderCode.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerPhone.toLowerCase().includes(q) || o.items.some((item) => item.sku.toLowerCase().includes(q) || item.productName.toLowerCase().includes(q)));
  }, [orders, globalSearch, scopedBranchIds]);
  const scopedProducts = useMemo(() => products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => {
      const nextBranchStocks = Object.fromEntries(branches.filter((branch) => scopedBranchIds.includes(branch.id)).map((branch) => [branch.id, Number(variant.branchStocks?.[branch.id] || 0)]));
      const nextTotal = Object.values(nextBranchStocks).reduce((sum, n) => sum + Number(n || 0), 0);
      return { ...variant, branchStocks: nextBranchStocks, stock: nextTotal };
    }),
  })).filter((product) => product.variants.some((variant) => variant.stock > 0 || hasPermission(activeRole, "products", "xem sản phẩm"))), [products, scopedBranchIds, activeRole]);
  const visibleScopedProducts = useMemo(() => {
    const q = globalSearch.toLowerCase();
    if (!q) return scopedProducts;
    return scopedProducts.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));
  }, [scopedProducts, globalSearch]);
  const lowStockVariants = scopedProducts.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))).filter((v) => v.stock <= 3);
  const menu = [{ id: "dashboard", label: "Tổng quan" },
    { id: "orders", label: "Đơn hàng" },
    { id: "create-order", label: "Tạo đơn" },
    { id: "products", label: "Sản phẩm" },
    { id: "inventory", label: "Kho hàng" },
    { id: "stocktake", label: "Kiểm kho" },
    { id: "ads", label: "Autopilot" },
    { id: "ai-content", label: "AI Content" },
    ...(currentUser.role === "ADMIN" ? [{ id: "reports", label: "Báo cáo" }, { id: "permissions", label: "Phân quyền" }] : []),
  ];
  const pushActivity = (message) => setActivities((prev) => [{ id: `a${Date.now()}`, message, time: formatDate() }, ...prev]);
  const createProduct = (payload) => {
    if (!payload.name || !payload.slug) return;
    const next = { id: `p${Date.now()}`, name: payload.name, slug: payload.slug, category: payload.category, productType: payload.productType, brand: payload.brand, weight: Number(payload.weight || 0), imageUrl: payload.imageUrl, description: payload.description, defaultPrice: Number(payload.defaultPrice || 0), defaultCostPrice: Number(payload.defaultCostPrice || 0), defaultBranchStocks: Object.fromEntries(branches.map((branch) => [branch.id, Number(payload.defaultBranchStocks?.[branch.id] || 0)])), colorOptions: String(payload.colorOptions || "").split(",").map((s) => s.trim()).filter(Boolean), sizeOptions: String(payload.sizeOptions || "").split(",").map((s) => s.trim()).filter(Boolean), status: "ACTIVE", variants: [] };
    setProducts((prev) => [next, ...prev]);
    pushActivity(`Đã thêm sản phẩm ${payload.name}.`);
  };
  const addVariant = (productId, payload) => {
    if (!payload.sku || !payload.color || !payload.size) return;
    const productRef = products.find((p) => p.id === productId);
    const baseStocks = Object.fromEntries(branches.map((branch) => [branch.id, Number(payload.branchStocks?.[branch.id] ?? productRef?.defaultBranchStocks?.[branch.id] ?? 0)]));
    const totalStock = Object.values(baseStocks).reduce((sum, n) => sum + Number(n || 0), 0);
    setProducts((prev) => prev.map((product) => product.id === productId ? { ...product, variants: [...product.variants, { id: `v${Date.now()}`, sku: payload.sku, color: payload.color, size: payload.size, price: Number(payload.price || product.defaultPrice || 0), costPrice: sessionIsAdmin ? Number(payload.costPrice || product.defaultCostPrice || 0) : (product.defaultCostPrice || 0), stock: totalStock, branchStocks: baseStocks }] } : product));
    setProductAuditLogs((prev) => [{ id: `log${Date.now()}`, productId, sku: payload.sku, actor: currentUser.name, time: formatDate(), message: `Tạo variant với giá bán ${currency(payload.price || productRef?.defaultPrice || 0)}${sessionIsAdmin ? ` · giá nhập ${currency(payload.costPrice || productRef?.defaultCostPrice || 0)}` : ""}` }, ...prev]);
    pushActivity(`Đã thêm variant ${payload.sku}.`);
  };

  const updateVariantPricing = (productId, variantId, patch) => {
    if (!sessionIsAdmin) return;
    let auditPayload = null;
    setProducts((prev) => prev.map((product) => {
      if (product.id !== productId) return product;
      return {
        ...product,
        variants: product.variants.map((variant) => {
          if (variant.id !== variantId) return variant;
          const next = { ...variant, ...patch };
          const messages = [];
          if (patch.price !== undefined && Number(patch.price) !== Number(variant.price)) {
            messages.push(`giá bán ${currency(variant.price)} → ${currency(patch.price)}`);
          }
          if (patch.costPrice !== undefined && Number(patch.costPrice) !== Number(variant.costPrice || 0)) {
            messages.push(`giá nhập ${currency(variant.costPrice || 0)} → ${currency(patch.costPrice)}`);
          }
          if (messages.length) {
            auditPayload = { productId, sku: variant.sku, actor: currentUser.name, time: formatDate(), message: `Cập nhật ${messages.join(" · ")}` };
          }
          return next;
        }),
      };
    }));
    if (auditPayload) {
      setProductAuditLogs((prev) => [{ id: `log${Date.now()}`, ...auditPayload }, ...prev]);
      pushActivity(`Đã cập nhật giá cho ${auditPayload.sku}.`);
    }
  };
  const toggleProductStatus = (productId) => {
    let productName = "";
    setProducts((prev) => prev.map((product) => { if (product.id !== productId) return product; productName = product.name; return { ...product, status: product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }; }));
    pushActivity(`Đã đổi trạng thái sản phẩm ${productName}.`);
  };
  const updateOrderStatus = (id, orderStatus) => {
    let code = "";
    setOrders((prev) => prev.map((o) => { if (o.id !== id) return o; code = o.orderCode; return { ...o, orderStatus }; }));
    pushActivity(`Đã cập nhật trạng thái đơn ${code} → ${orderStatus}.`);
  };
  const updatePaymentStatus = (id, paymentStatus) => {
    let code = "";
    setOrders((prev) => prev.map((o) => { if (o.id !== id) return o; code = o.orderCode; return { ...o, paymentStatus }; }));
    pushActivity(`Đã cập nhật thanh toán đơn ${code} → ${paymentStatus}.`);
  };
  const adjustStock = (variantId, diff) => {
    let touchedSku = "";
    setProducts((prev) => prev.map((product) => ({ ...product, variants: product.variants.map((variant) => { if (variant.id !== variantId) return variant; touchedSku = variant.sku; const nextTotal = Math.max(0, variant.stock + diff); const currentBranch = "b1"; const nextBranchStocks = { ...(variant.branchStocks || {}), [currentBranch]: Math.max(0, (variant.branchStocks?.[currentBranch] || 0) + diff) }; return { ...variant, stock: nextTotal, branchStocks: nextBranchStocks }; }) })));
    pushActivity(`Đã điều chỉnh tồn kho ${touchedSku} ${diff > 0 ? `+${diff}` : diff}.`);
  };
  const createStocktake = (branchId, variant, countedStock, meta = {}) => {
    const systemStock = variant.branchStocks?.[branchId] || 0;
    const diff = countedStock - systemStock;
    const newStocktake = { id: `st${Date.now()}`, branchId, createdAt: formatDate(), status: "COMPLETED", note: meta.sessionNote || "", lines: [{ sku: variant.sku, systemStock, countedStock, diff, reason: meta.reason || "", note: meta.note || "", scannedBy: meta.scannedBy || currentUser.name, scannedAt: meta.scannedAt || formatDate() }] };
    setStocktakes((prev) => [newStocktake, ...prev]);
    setProducts((prev) => prev.map((product) => ({ ...product, variants: product.variants.map((item) => { if (item.id !== variant.id) return item; const nextBranchStocks = { ...(item.branchStocks || {}), [branchId]: countedStock }; const nextTotal = Object.values(nextBranchStocks).reduce((s, n) => s + Number(n || 0), 0); return { ...item, branchStocks: nextBranchStocks, stock: nextTotal }; }) })));
    pushActivity(`Đã kiểm kho ${variant.sku} tại ${branchName(branchId)}.`);
  };
  const finishStocktakeSession = ({ branchId, mode, note, totalRows, mismatchCount, notFoundCount }) => {
    pushActivity(`Đã kết thúc phiên kiểm kho ${branchName(branchId)} · ${mode} · ${totalRows} dòng · lệch ${mismatchCount} · lỗi mã ${notFoundCount}.`);
    setStocktakes((prev) => prev.map((item, index) => index === 0 ? { ...item, note: note || item.note || "" } : item));
  };
  const createOrder = ({ salesChannel, note, customerName, customerPhone, branchId, items }) => {
    const variantId = items[0].variantId;
    const qty = items[0].qty;
    const variant = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))).find((v) => v.id === variantId);
    if (!variant || qty > variant.stock) return;
    const newOrder = { id: `o${Date.now()}`, orderCode: `ORD-${Math.floor(Math.random() * 100000)}`, createdAt: formatDate(), salesChannel, paymentStatus: salesChannel === "ADMIN" ? "PENDING_COD" : "AWAITING_PAYMENT", orderStatus: "PENDING", customerName, customerPhone, branchId, note, grandTotal: variant.price * qty, items: [{ variantId: variant.id, sku: variant.sku, productName: variant.productName, color: variant.color, size: variant.size, qty, unitPrice: variant.price, lineTotal: variant.price * qty }] };
    setOrders((prev) => [newOrder, ...prev]);
    setProducts((prev) => prev.map((p) => ({ ...p, variants: p.variants.map((v) => { if (v.id !== variantId) return v; const nextBranchStocks = { ...(v.branchStocks || {}), [branchId]: Math.max(0, (v.branchStocks?.[branchId] || 0) - qty) }; const nextTotal = Object.values(nextBranchStocks).reduce((s, n) => s + Number(n || 0), 0); return { ...v, stock: nextTotal, branchStocks: nextBranchStocks }; }) })));
    pushActivity(`Đã tạo đơn ${newOrder.orderCode} cho ${customerName}.`);
    setTab("orders");
  };
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-neutral-200 bg-white p-4 lg:p-6">
          <div className="mb-8"><p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Admin Panel</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">The 1970</h1><p className="mt-1 text-sm text-neutral-500">Core operations dashboard</p></div>
          <nav className="space-y-2">{menu.filter((item) => canAccessTab(activeRole, item.id)).map((item) => { const active = tab === item.id; return <button key={item.id} onClick={() => setTab(item.id)} className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}>{item.label}</button>; })}</nav>
          <div className="mt-8 rounded-3xl bg-neutral-100 p-4 text-sm text-neutral-600"><p className="font-medium text-neutral-900">Nguyên tắc menu</p><p className="mt-2">Ít mục nhưng đúng flow: bán hàng, sản phẩm, kho, kiểm kho, ads, báo cáo.</p></div>
        </aside>
        <main className="p-4 lg:p-8">
          <Header search={globalSearch} setSearch={setGlobalSearch} user={currentUser} employees={employees.filter((e) => e.status === "WORKING")} activeEmployeeId={activeEmployeeId} setActiveEmployeeId={setActiveEmployeeId} />
          {tab === "dashboard" && <DashboardPage products={visibleScopedProducts} orders={visibleOrders} lowStockVariants={lowStockVariants} activities={activities} setTab={setTab} />}
          {tab === "reports" && canAccessTab(activeRole, "reports") && <ReportsPage orders={visibleOrders} products={scopedProducts} />}
          {tab === "products" && <ProductsPage products={visibleScopedProducts} onCreateProduct={createProduct} onAddVariant={addVariant} onToggleProductStatus={toggleProductStatus} onUpdateVariantPricing={updateVariantPricing} productAuditLogs={productAuditLogs} isAdmin={sessionIsAdmin} onGenerateVariants={(productId) => {
            setProducts((prev) => prev.map((product) => {
              if (product.id !== productId) return product;
              const colors = product.colorOptions || [];
              const sizes = product.sizeOptions || [];
              const existingKeys = new Set(product.variants.map((v) => `${v.color}__${v.size}`));
              const nextVariants = [...product.variants];
              colors.forEach((color) => {
                sizes.forEach((size) => {
                  const key = `${color}__${size}`;
                  if (existingKeys.has(key)) return;
                  const slugPart = String(product.slug || product.name).replace(/[^a-zA-Z0-9]+/g, "-").toUpperCase();
                  const colorPart = String(color).replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
                  const sizePart = String(size).replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
                  const branchStocks = Object.fromEntries(branches.map((branch) => [branch.id, Number(product.defaultBranchStocks?.[branch.id] || 0)]));
                  nextVariants.push({
                    id: `v${Date.now()}_${colorPart}_${sizePart}`,
                    sku: `${slugPart}-${colorPart}-${sizePart}`,
                    color,
                    size,
                    price: Number(product.defaultPrice || 0),
                    costPrice: Number(product.defaultCostPrice || 0),
                    stock: Object.values(branchStocks).reduce((sum, n) => sum + Number(n || 0), 0),
                    branchStocks,
                  });
                });
              });
              return { ...product, variants: nextVariants };
            }));
            setProductAuditLogs((prev) => [{ id: `log${Date.now()}`, productId, sku: "AUTO", actor: currentUser.name, time: formatDate(), message: "Generate variants tự động từ màu × size, lấy theo giá bán mặc định + tồn mặc định từng kho" }, ...prev]);
            pushActivity("Đã generate variants tự động từ màu × size.");
          }} />}
          {tab === "orders" && <OrdersPage orders={visibleOrders} onUpdateOrderStatus={updateOrderStatus} onUpdatePaymentStatus={updatePaymentStatus} canEditOrders={hasPermission(activeRole, "orders", "sửa đơn") || hasPermission(activeRole, "orders", "duyệt đơn") || sessionIsAdmin} canPushShipping={hasPermission(activeRole, "orders", "hãng vận chuyển") || sessionIsAdmin} />}
          {tab === "create-order" && <CreateOrderPage products={visibleScopedProducts} onCreateOrder={createOrder} />}
          {tab === "inventory" && <InventoryPage products={scopedProducts} onOpenStocktake={() => setTab("stocktake")} />}
          {tab === "stocktake" && <StocktakePage products={scopedProducts} stocktakes={stocktakes.filter((item) => scopedBranchIds.includes(item.branchId))} onCreateStocktake={createStocktake} onFinishStocktakeSession={finishStocktakeSession} currentUser={currentUser} canApproveStocktake={hasPermission(activeRole, "inventory", "xác nhận kiểm kho") || sessionIsAdmin} />}
          {tab === "ads" && canAccessTab(activeRole, "ads") && <AdsPage mappings={adsMappings} setMappings={setAdsMappings} currentUser={currentUser} pushActivity={pushActivity} />}
          {tab === "ai-content" && canAccessTab(activeRole, "ai-content") && <AIContentPage products={scopedProducts} orders={visibleOrders} adsMappings={adsMappings} pushActivity={pushActivity} />}
          {tab === "permissions" && canAccessTab(activeRole, "permissions") && <PermissionsPage employees={employees} setEmployees={setEmployees} />}
        </main>
      </div>
    </div>
  );
}
