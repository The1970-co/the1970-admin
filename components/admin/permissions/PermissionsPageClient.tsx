"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getBranches, type BranchItem } from "@/lib/products-api";

type PermissionGroupKey =
  | "products"
  | "orders"
  | "inventory"
  | "reports"
  | "customers"
  | "system";

type RoleItem = {
  id: string;
  name: string;
  scope: "ALL_BRANCHES" | "ONE_BRANCH";
  description: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  permissions: Record<PermissionGroupKey, string[]>;
};

type EmployeeItem = {
  id: string;
  code: string;
  name: string;
  roleId: string;
  branchId?: string | null;
  branch: string;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt?: string | null;
};

type PermissionGroupMeta = {
  title: string;
  desc: string;
  allPermissions: string[];
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
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
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
      type={type}
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

const permissionGroupMeta: Record<PermissionGroupKey, PermissionGroupMeta> = {
  products: {
    title: "Sản phẩm",
    desc: "Ai được xem, tạo và can thiệp dữ liệu sản phẩm.",
    allPermissions: [
      "Xem sản phẩm",
      "Tạo sản phẩm",
      "Thêm variant",
      "Đổi trạng thái sản phẩm",
    ],
  },
  orders: {
    title: "Đơn hàng",
    desc: "Ai được tạo, sửa, duyệt và đẩy đơn sang hãng vận chuyển.",
    allPermissions: [
      "Xem tất cả đơn",
      "Xem đơn chi nhánh",
      "Xem đơn được phụ trách",
      "Tạo đơn hàng",
      "Sửa đơn hàng",
      "Duyệt đơn hàng",
      "Đẩy đơn sang hãng vận chuyển",
    ],
  },
  inventory: {
    title: "Kho vận hành",
    desc: "Ai được xem tồn, kiểm kho, nhập hàng và chuyển hàng.",
    allPermissions: [
      "Xem tồn kho toàn hệ thống",
      "Xem tồn kho chi nhánh",
      "Kiểm kho",
      "Xác nhận kiểm kho",
      "Nhập hàng",
      "Chuyển hàng",
      "Chuyển hàng giữa chi nhánh",
    ],
  },
  reports: {
    title: "Báo cáo",
    desc: "Ai được xem báo cáo chi nhánh hoặc toàn hệ thống.",
    allPermissions: [
      "Xem báo cáo chi nhánh",
      "Xem báo cáo toàn hệ thống",
      "Xem lợi nhuận",
      "Xem ROAS thật",
    ],
  },
  customers: {
    title: "Khách hàng",
    desc: "Ai được truy cập dữ liệu khách hàng.",
    allPermissions: ["Xem khách hàng"],
  },
  system: {
    title: "Hệ thống",
    desc: "Ai được phân quyền và cấu hình hệ thống.",
    allPermissions: ["Phân quyền vai trò", "Cấu hình hệ thống"],
  },
};

const rolesSeed: RoleItem[] = [
  {
    id: "owner",
    name: "Owner",
    scope: "ALL_BRANCHES",
    description: "Toàn quyền hệ thống.",
    createdAt: "07/08/2025",
    updatedAt: "18/03/2026",
    note: "Owner",
    permissions: {
      products: [...permissionGroupMeta.products.allPermissions],
      orders: [
        "Xem tất cả đơn",
        "Tạo đơn hàng",
        "Sửa đơn hàng",
        "Duyệt đơn hàng",
        "Đẩy đơn sang hãng vận chuyển",
      ],
      inventory: [
        "Xem tồn kho toàn hệ thống",
        "Kiểm kho",
        "Xác nhận kiểm kho",
        "Nhập hàng",
        "Chuyển hàng giữa chi nhánh",
      ],
      reports: [...permissionGroupMeta.reports.allPermissions],
      customers: ["Xem khách hàng"],
      system: [...permissionGroupMeta.system.allPermissions],
    },
  },
  {
    id: "branch-manager",
    name: "Quản lý chi nhánh",
    scope: "ONE_BRANCH",
    description:
      "Quản lý vận hành của một chi nhánh, không thấy toàn hệ thống.",
    createdAt: "08/08/2025",
    updatedAt: "18/03/2026",
    note: "Theo chi nhánh",
    permissions: {
      products: ["Xem sản phẩm", "Tạo sản phẩm", "Thêm variant"],
      orders: [
        "Xem đơn chi nhánh",
        "Tạo đơn hàng",
        "Sửa đơn hàng",
        "Duyệt đơn hàng",
        "Đẩy đơn sang hãng vận chuyển",
      ],
      inventory: [
        "Xem tồn kho chi nhánh",
        "Kiểm kho",
        "Xác nhận kiểm kho",
        "Nhập hàng",
        "Chuyển hàng",
      ],
      reports: [],
      customers: ["Xem khách hàng"],
      system: [],
    },
  },
  {
    id: "fulltime",
    name: "Nhân viên fulltime",
    scope: "ONE_BRANCH",
    description:
      "Vận hành mạnh hơn bán lẻ, được xử lý đơn và đẩy sang hãng vận chuyển.",
    createdAt: "07/08/2025",
    updatedAt: "18/03/2026",
    note: "Không xem báo cáo",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [
        "Xem đơn chi nhánh",
        "Tạo đơn hàng",
        "Sửa đơn hàng",
        "Đẩy đơn sang hãng vận chuyển",
      ],
      inventory: [
        "Xem tồn kho chi nhánh",
        "Kiểm kho",
        "Nhập hàng",
        "Chuyển hàng",
      ],
      reports: [],
      customers: ["Xem khách hàng"],
      system: [],
    },
  },
  {
    id: "retail-staff",
    name: "Nhân viên bán lẻ",
    scope: "ONE_BRANCH",
    description:
      "Tập trung bán hàng tại quầy, quyền gọn và an toàn hơn fulltime.",
    createdAt: "05/12/2025",
    updatedAt: "18/03/2026",
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
    createdAt: "18/03/2026",
    updatedAt: "18/03/2026",
    note: "Không xử lý đơn bán",
    permissions: {
      products: ["Xem sản phẩm"],
      orders: [],
      inventory: [
        "Xem tồn kho chi nhánh",
        "Kiểm kho",
        "Xác nhận kiểm kho",
      ],
      reports: [],
      customers: [],
      system: [],
    },
  },
];

function scopeBadge(scope: RoleItem["scope"]) {
  return scope === "ALL_BRANCHES" ? "Toàn hệ thống" : "Theo chi nhánh";
}

function groupHasAllPermissions(role: RoleItem, groupKey: PermissionGroupKey) {
  const current = role.permissions[groupKey] || [];
  const all = permissionGroupMeta[groupKey].allPermissions;
  return all.length > 0 && all.every((item) => current.includes(item));
}

function groupPermissionSummary(role: RoleItem, groupKey: PermissionGroupKey) {
  const current = role.permissions[groupKey] || [];
  if (!current.length) return "Chưa có quyền";
  if (current.length <= 3) return `Có quyền: ${current.join(", ")}`;
  return `Có quyền: ${current.slice(0, 3).join(", ")} +${
    current.length - 3
  } quyền khác`;
}

function roleSummary(role: RoleItem) {
  return (Object.keys(permissionGroupMeta) as PermissionGroupKey[]).map(
    (key) => {
      const count = role.permissions[key]?.length || 0;
      return {
        key,
        title: permissionGroupMeta[key].title,
        count,
        enabled: count > 0,
      };
    }
  );
}

function formatLastLogin(value?: string | null) {
  if (!value) return "Chưa đăng nhập";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa đăng nhập";
  return d.toLocaleString("vi-VN");
}

export default function PermissionsPageClient() {
  const [roles, setRoles] = useState<RoleItem[]>(rolesSeed);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState("fulltime");
  const [message, setMessage] = useState("");

  const [quickName, setQuickName] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [quickRoleId, setQuickRoleId] = useState("retail-staff");
  const [quickBranchId, setQuickBranchId] = useState("");

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
    null
  );
  const [editRoleId, setEditRoleId] = useState("fulltime");
  const [editBranchId, setEditBranchId] = useState("");

  const [resetPasswordForId, setResetPasswordForId] = useState<string | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || roles[0],
    [roles, selectedRoleId]
  );

  const roleEmployees = useMemo(
    () => employees.filter((employee) => employee.roleId === selectedRoleId),
    [employees, selectedRoleId]
  );

  const totalWorking = employees.filter((e) => e.status === "ACTIVE").length;
  const totalInactive = employees.filter((e) => e.status === "INACTIVE").length;
  const branchRoles = roles.filter((role) => role.scope === "ONE_BRANCH").length;
  const summary = roleSummary(selectedRole);

  const getBranchName = (branchId?: string | null) => {
    if (!branchId) return "Toàn hệ thống";
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  function mapApiStaffToEmployee(item: any): EmployeeItem {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      roleId: item.role ?? item.roleId,
      branchId: item.branchId ?? null,
      branch:
        item.branchName ??
        getBranchName(item.branchId) ??
        item.branch ??
        "Toàn hệ thống",
      status: item.isActive ? "ACTIVE" : "INACTIVE",
      lastLoginAt: item.lastLoginAt ?? null,
    };
  }

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);

      setQuickBranchId((prev) => prev || data[0]?.id || "");
      setEditBranchId((prev) => prev || data[0]?.id || "");
    } catch {
      setMessage("Không tải được danh sách chi nhánh.");
    }
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      setMessage("");
      const data = await apiJson<any[]>("/staff");
      setEmployees(Array.isArray(data) ? data.map(mapApiStaffToEmployee) : []);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách nhân sự."
      );
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      void loadEmployees();
    }
  }, [branches.length]);

  const quickAssignUser = async () => {
    if (!quickName.trim() || !quickCode.trim() || !quickPassword.trim()) {
      setMessage("Thiếu tên, mã nhân viên hoặc mật khẩu.");
      return;
    }

    try {
      await apiJson("/staff", {
        method: "POST",
        body: JSON.stringify({
          code: quickCode.trim(),
          name: quickName.trim(),
          role: quickRoleId,
          branchId: quickBranchId || null,
          password: quickPassword.trim(),
        }),
      });

      await loadEmployees();
      setSelectedRoleId(quickRoleId);
      setQuickName("");
      setQuickCode("");
      setQuickPassword("");
      setMessage("Đã lưu nhân viên vào database.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Lưu nhân viên thất bại."
      );
    }
  };

  const toggleEmployee = async (employeeId: string) => {
    const current = employees.find((e) => e.id === employeeId);
    if (!current) return;

    const nextStatus = current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      await apiJson(`/staff/${employeeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      await loadEmployees();
      setMessage("Đã cập nhật trạng thái nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Cập nhật trạng thái thất bại."
      );
    }
  };

  const startEditEmployee = (employee: EmployeeItem) => {
    setEditingEmployeeId(employee.id);
    setEditRoleId(employee.roleId);
    setEditBranchId(employee.branchId || branches[0]?.id || "");
  };

  const saveEmployeeRoleAssignment = async () => {
    if (!editingEmployeeId) return;

    try {
      await apiJson(`/staff/${editingEmployeeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: editRoleId,
          branchId: editBranchId || null,
        }),
      });

      await loadEmployees();
      setSelectedRoleId(editRoleId);
      setEditingEmployeeId(null);
      setMessage("Đã cập nhật gán role cho nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Cập nhật gán role thất bại."
      );
    }
  };

  const changePassword = async (employeeId: string) => {
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setMessage("Mật khẩu mới tối thiểu 4 ký tự.");
      return;
    }

    try {
      await apiJson(`/staff/${employeeId}/password`, {
        method: "PATCH",
        body: JSON.stringify({
          password: newPassword.trim(),
        }),
      });

      setNewPassword("");
      setResetPasswordForId(null);
      setMessage("Đã đổi mật khẩu nhân viên.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Đổi mật khẩu thất bại."
      );
    }
  };

  const updateRolePermission = (
    roleId: string,
    groupKey: PermissionGroupKey,
    permissionName: string,
    checked: boolean
  ) => {
    if (groupKey === "reports" && roleId !== "owner") {
      setMessage("Chỉ Owner mới được cấp quyền Báo cáo.");
      return;
    }

    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;

        const currentSet = new Set(role.permissions[groupKey] || []);

        if (checked) currentSet.add(permissionName);
        else currentSet.delete(permissionName);

        return {
          ...role,
          updatedAt: new Date().toLocaleDateString("vi-VN"),
          permissions: {
            ...role.permissions,
            [groupKey]: Array.from(currentSet),
          },
        };
      })
    );

    setMessage("Đã cập nhật quyền của role.");
  };

  const togglePermissionGroup = (
    roleId: string,
    groupKey: PermissionGroupKey,
    checked: boolean
  ) => {
    if (groupKey === "reports" && roleId !== "owner") {
      setMessage("Chỉ Owner mới được cấp quyền Báo cáo.");
      return;
    }

    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;

        return {
          ...role,
          updatedAt: new Date().toLocaleDateString("vi-VN"),
          permissions: {
            ...role.permissions,
            [groupKey]: checked
              ? [...permissionGroupMeta[groupKey].allPermissions]
              : [],
          },
        };
      })
    );

    setMessage("Đã cập nhật nhóm quyền.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Phân quyền
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Gán user vào role, nhìn nhanh role đang có quyền gì và chỉnh quyền chi
          tiết theo từng nhóm.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard title="Tổng vai trò" value={roles.length} sub="Bản tinh gọn" />
        <StatCard
          title="Role theo chi nhánh"
          value={branchRoles}
          sub="Chỉ thấy dữ liệu chi nhánh phụ trách"
        />
        <StatCard
          title="Nhân sự đang làm"
          value={totalWorking}
          sub="Toàn hệ thống"
        />
        <StatCard
          title="Nhân sự đã nghỉ"
          value={totalInactive}
          sub="Lưu để audit"
        />
      </div>

      {message ? (
        <Panel className="px-5 py-4">
          <p className="text-sm text-neutral-700">{message}</p>
        </Panel>
      ) : null}

      <Panel>
        <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_1.1fr_1fr_0.7fr_0.7fr_auto]">
          <input
            className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Tên nhân viên"
          />
          <input
            className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={quickCode}
            onChange={(e) => setQuickCode(e.target.value)}
            placeholder="Mã nhân viên"
          />
          <input
            type="password"
            className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={quickPassword}
            onChange={(e) => setQuickPassword(e.target.value)}
            placeholder="Mật khẩu"
          />
          <select
            className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={quickRoleId}
            onChange={(e) => setQuickRoleId(e.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <select
            className="h-14 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={quickBranchId}
            onChange={(e) => setQuickBranchId(e.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <Button onClick={quickAssignUser} className="h-14">
            + Gán user
          </Button>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  Danh sách vai trò
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Chọn role để xem phạm vi, user được gán và quyền chi tiết.
                </p>
              </div>
              <Badge tone="blue">Role → User → Branch</Badge>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-200 text-sm text-neutral-400">
                    <th className="pb-3 font-medium">Vai trò</th>
                    <th className="pb-3 font-medium">Đang làm</th>
                    <th className="pb-3 font-medium">Phạm vi</th>
                    <th className="pb-3 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`cursor-pointer border-b border-neutral-100 transition ${
                        selectedRoleId === role.id
                          ? "bg-neutral-50"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <td className="py-4">
                        <div className="font-medium text-neutral-900">
                          {role.name}
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">
                          {role.updatedAt}
                        </div>
                      </td>
                      <td className="py-4 text-sm text-neutral-700">
                        {
                          employees.filter(
                            (employee) =>
                              employee.roleId === role.id &&
                              employee.status === "ACTIVE"
                          ).length
                        }
                      </td>
                      <td className="py-4">
                        <Badge
                          tone={
                            role.scope === "ALL_BRANCHES" ? "red" : "blue"
                          }
                        >
                          {scopeBadge(role.scope)}
                        </Badge>
                      </td>
                      <td className="py-4 text-sm text-neutral-500">
                        {role.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-semibold text-neutral-900">
              {selectedRole.name}
            </h3>
            <Badge tone="blue">{scopeBadge(selectedRole.scope)}</Badge>
            <Badge tone="amber">{selectedRole.note}</Badge>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {selectedRole.description}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Đang được gán</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
                {roleEmployees.length}
              </p>
            </div>
            <div className="rounded-3xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Ngày tạo</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
                {selectedRole.createdAt}
              </p>
            </div>
            <div className="rounded-3xl border border-neutral-200 p-4">
              <p className="text-sm text-neutral-500">Cập nhật cuối</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
                {selectedRole.updatedAt}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-neutral-900">
                Role đang có quyền gì
              </h4>
              <Badge tone="blue">Role summary</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summary.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-neutral-200 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-neutral-900">
                      {item.title}
                    </span>
                    <Badge tone={item.enabled ? "green" : "gray"}>
                      {item.enabled ? `${item.count} quyền` : "Không có"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-neutral-900">
              User đang được gán role này
            </h3>
            <Badge tone="blue">{roleEmployees.length} user</Badge>
          </div>

          <div className="mt-4 space-y-4">
            {loadingEmployees ? (
              <p className="text-sm text-neutral-500">Đang tải nhân sự...</p>
            ) : roleEmployees.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Chưa có user cho role này.
              </p>
            ) : (
              roleEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="rounded-3xl border border-neutral-200 px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-medium text-neutral-900">
                          {employee.name}
                        </span>
                        <Badge
                          tone={
                            employee.status === "ACTIVE" ? "green" : "gray"
                          }
                        >
                          {employee.status === "ACTIVE"
                            ? "Đang làm"
                            : "Đã nghỉ"}
                        </Badge>
                        <Badge tone="gray">{employee.code}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">
                        Chi nhánh phụ trách: {employee.branch}
                      </p>
                      <p className="mt-1 text-sm text-neutral-400">
                        Lần đăng nhập cuối:{" "}
                        {formatLastLogin(employee.lastLoginAt)}
                      </p>

                      {editingEmployeeId === employee.id ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <select
                            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                            value={editRoleId}
                            onChange={(e) => setEditRoleId(e.target.value)}
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>

                          <select
                            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                            value={editBranchId}
                            onChange={(e) => setEditBranchId(e.target.value)}
                          >
                            {branches.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                          </select>

                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              onClick={saveEmployeeRoleAssignment}
                            >
                              Lưu
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setEditingEmployeeId(null)}
                            >
                              Hủy
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {resetPasswordForId === employee.id ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="h-11 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                            placeholder="Mật khẩu mới"
                          />
                          <Button
                            variant="primary"
                            onClick={() => changePassword(employee.id)}
                          >
                            Lưu mật khẩu
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setResetPasswordForId(null);
                              setNewPassword("");
                            }}
                          >
                            Hủy
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => startEditEmployee(employee)}
                      >
                        Sửa gán role
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setResetPasswordForId(employee.id);
                          setNewPassword("");
                        }}
                      >
                        Đổi mật khẩu
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => toggleEmployee(employee.id)}
                      >
                        {employee.status === "ACTIVE"
                          ? "Cho nghỉ"
                          : "Kích hoạt lại"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">
                Phân quyền chi tiết
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Tick từng quyền hoặc tick cả nhóm để cấp nhanh cho role đang
                chọn.
              </p>
            </div>
            <Badge tone="blue">Permission summary</Badge>
          </div>

          <div className="mt-4 space-y-4">
            {(Object.keys(permissionGroupMeta) as PermissionGroupKey[]).map(
              (key) => {
                const meta = permissionGroupMeta[key];
                const currentPermissions = selectedRole.permissions[key] || [];
                const allChecked = groupHasAllPermissions(selectedRole, key);
                const isReportsGroupLocked =
                  key === "reports" && selectedRole.id !== "owner";

                return (
                  <details
                    key={key}
                    open
                    className="group rounded-3xl border border-neutral-200 bg-white px-4 py-4"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-medium text-neutral-900">
                            {meta.title}
                          </span>
                          <Badge
                            tone={currentPermissions.length ? "blue" : "gray"}
                          >
                            {currentPermissions.length
                              ? `${currentPermissions.length} quyền`
                              : "Không có"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-neutral-500">
                          {meta.desc}
                        </p>
                        <p className="mt-3 text-sm italic text-neutral-600">
                          {groupPermissionSummary(selectedRole, key)}
                        </p>
                      </div>
                      <span className="mt-1 text-neutral-400 transition group-open:rotate-90">
                        ›
                      </span>
                    </summary>

                    <div className="mt-4 border-t border-neutral-200 pt-4">
                      {isReportsGroupLocked ? (
                        <p className="mb-3 text-sm text-amber-600">
                          Nhóm Báo cáo chỉ Owner mới được cấp quyền.
                        </p>
                      ) : null}

                      <label className="mb-4 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          disabled={isReportsGroupLocked}
                          onChange={(e) =>
                            togglePermissionGroup(
                              selectedRole.id,
                              key,
                              e.target.checked
                            )
                          }
                        />
                        Tick toàn bộ nhóm {meta.title}
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        {meta.allPermissions.map((permissionName) => {
                          const checked =
                            currentPermissions.includes(permissionName);

                          return (
                            <label
                              key={permissionName}
                              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                                isReportsGroupLocked
                                  ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                                  : "border-neutral-200 text-neutral-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isReportsGroupLocked}
                                onChange={(e) =>
                                  updateRolePermission(
                                    selectedRole.id,
                                    key,
                                    permissionName,
                                    e.target.checked
                                  )
                                }
                              />
                              <span
                                className={checked ? "text-neutral-900" : ""}
                              >
                                {permissionName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                );
              }
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}