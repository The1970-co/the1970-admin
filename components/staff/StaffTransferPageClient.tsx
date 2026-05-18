"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api-base";
import {
  getCurrentUserFromStorage,
  getCurrentUserPermissions,
  getTokenFromStorage,
} from "@/lib/current-user";

type BranchOption = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

type StaffOption = {
  id: string;
  code?: string | null;
  name: string;
  username?: string | null;
  phone?: string | null;
  role?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  branchRoles?: Array<{
    branchId: string;
    branchName?: string | null;
    roleCode?: string | null;
    branch?: {
      id?: string;
      name?: string | null;
      code?: string | null;
    } | null;
  }>;
};

type OptionsResponse = {
  branches: BranchOption[];
  staff: StaffOption[];
};

function getAuthHeaders() {
  const token = getTokenFromStorage();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;

    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || message;
    } catch {}

    throw new Error(message);
  }

  return res.json();
}

const STAFF_TRANSFER_VIEW_KEYS = [
  "menu.staff_transfer",
  "staff.transfer_branch.view",
  "staff.transfer_branch",
];

const STAFF_TRANSFER_SUBMIT_KEYS = ["staff.transfer_branch"];

function uniqueStrings(values: any[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function collectNestedPermissionKeys(value: any, depth = 0): string[] {
  if (!value || depth > 4) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNestedPermissionKeys(item, depth + 1));
  }

  if (typeof value === "string") return [value];

  if (typeof value !== "object") return [];

  return uniqueStrings([
    ...collectNestedPermissionKeys(value.permissionKeys, depth + 1),
    ...collectNestedPermissionKeys(value.extraPermissionKeys, depth + 1),
    ...collectNestedPermissionKeys(value.permissions, depth + 1),
    ...collectNestedPermissionKeys(value.keys, depth + 1),
    ...collectNestedPermissionKeys(value.branchPermissions, depth + 1),
    ...collectNestedPermissionKeys(value.staffBranchPermissions, depth + 1),
  ]);
}

function getEffectiveCurrentUserPermissions() {
  const user = getCurrentUserFromStorage();

  return uniqueStrings([
    ...getCurrentUserPermissions(user),
    ...collectNestedPermissionKeys(user),
  ]);
}

function hasAnyPermission(permissions: string[], keys: string[]) {
  return permissions.includes("*") || keys.some((key) => permissions.includes(key));
}

function canUseStaffTransfer() {
  return hasAnyPermission(getEffectiveCurrentUserPermissions(), STAFF_TRANSFER_VIEW_KEYS);
}

function canSubmitStaffTransfer() {
  return hasAnyPermission(getEffectiveCurrentUserPermissions(), STAFF_TRANSFER_SUBMIT_KEYS);
}


const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin vận hành",
  accountant: "Kế toán",
  "branch-manager": "Quản lý chi nhánh",
  fulltime: "Nhân viên fulltime",
  "retail-staff": "Nhân viên bán lẻ",
  "stock-staff": "Nhân viên kho",
  "stock-auditor": "Nhân viên kiểm kho",
};

function formatRoleLabel(role?: string | null) {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_LABELS[key] || role || "Chưa gán";
}

function formatBranch(branch?: BranchOption | null) {
  if (!branch) return "—";
  return branch.code ? `${branch.name} (${branch.code})` : branch.name;
}

function formatStaffBranch(staff?: StaffOption | null) {
  if (!staff) return "—";

  const roles = Array.isArray(staff.branchRoles) ? staff.branchRoles : [];

  if (roles.length) {
    return roles
      .map((row) => row.branchName || row.branch?.name || row.branchId)
      .filter(Boolean)
      .join(", ");
  }

  return staff.branchName || staff.branchId || "—";
}

function getStaffCurrentBranchId(staff?: StaffOption | null) {
  return staff?.branchId || staff?.branchRoles?.[0]?.branchId || "";
}

function getStaffCurrentRole(staff?: StaffOption | null, branchId?: string) {
  if (!staff) return "retail-staff";

  return (
    staff.branchRoles?.find((row) => row.branchId === branchId)?.roleCode ||
    staff.branchRoles?.[0]?.roleCode ||
    staff.role ||
    "retail-staff"
  );
}

function getStaffRoleChips(staff?: StaffOption | null) {
  if (!staff) return [];

  const roles = Array.isArray(staff.branchRoles) ? staff.branchRoles : [];

  if (roles.length) {
    return roles.map((row) => ({
      branchId: row.branchId,
      branchName: row.branchName || row.branch?.name || row.branchId,
      roleCode: row.roleCode || staff.role || "retail-staff",
    }));
  }

  return [
    {
      branchId: staff.branchId || "",
      branchName: staff.branchName || staff.branchId || "—",
      roleCode: staff.role || "retail-staff",
    },
  ];
}

export default function StaffTransferPageClient() {
  const [allowed, setAllowed] = useState(false);
  const [canTransfer, setCanTransfer] = useState(false);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState("");
  const [staffId, setStaffId] = useState("");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [roleCode, setRoleCode] = useState("retail-staff");
  const [reason, setReason] = useState("");

  const [message, setMessage] = useState("");

  const branchMap = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch])),
    [branches],
  );

  const selectedStaff = useMemo(
    () => staff.find((item) => item.id === staffId) || null,
    [staff, staffId],
  );

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();

    return staff.filter((item) => {
      if (!q) return true;

      return [
        item.name,
        item.code,
        item.username,
        item.phone,
        item.role,
        item.branchName,
        item.branchId,
        ...(item.branchRoles || []).map((row) => `${row.branchName || row.branch?.name || ""} ${row.branchId || ""} ${row.roleCode || ""}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, staff]);

  const sourceBranch = branchMap.get(fromBranchId);
  const targetBranch = branchMap.get(toBranchId);

  const loadOptions = async () => {
    const hasViewFromStorage = canUseStaffTransfer();
    const hasTransferFromStorage = canSubmitStaffTransfer();

    setCanTransfer(hasTransferFromStorage);

    try {
      setLoading(true);
      setMessage("");

      const data = await apiJson<OptionsResponse>("/staff-transfer/options");

      // Backend là nguồn quyền cuối cùng. Không chặn sớm bằng localStorage vì token/user cache
      // có thể chưa kịp refresh sau khi admin vừa cấp quyền theo chi nhánh.
      setAllowed(true);
      setCanTransfer(true);
      setBranches(Array.isArray(data.branches) ? data.branches : []);
      setStaff(Array.isArray(data.staff) ? data.staff : []);
    } catch (error) {
      setAllowed(hasViewFromStorage);
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được dữ liệu chuyển chi nhánh.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedStaff) {
      setFromBranchId("");
      setRoleCode("retail-staff");
      return;
    }

    const currentBranchId = getStaffCurrentBranchId(selectedStaff);
    const currentRole = getStaffCurrentRole(selectedStaff, currentBranchId);

    setFromBranchId(currentBranchId);
    setRoleCode(String(currentRole || "retail-staff"));
    setToBranchId((prev) => (prev === currentBranchId ? "" : prev));
  }, [selectedStaff]);

  const resetForm = () => {
    setStaffId("");
    setFromBranchId("");
    setToBranchId("");
    setRoleCode("retail-staff");
    setReason("");
  };

  const transfer = async () => {
    if (!canTransfer) {
      setMessage("Bạn chỉ có quyền xem, chưa có quyền chuyển chi nhánh.");
      return;
    }

    if (!staffId) {
      setMessage("Chưa chọn nhân viên.");
      return;
    }

    if (!fromBranchId) {
      setMessage("Chưa xác định chi nhánh hiện tại.");
      return;
    }

    if (!toBranchId) {
      setMessage("Chưa chọn chi nhánh chuyển đến.");
      return;
    }

    if (fromBranchId === toBranchId) {
      setMessage("Chi nhánh chuyển đến đang trùng chi nhánh hiện tại.");
      return;
    }

    const ok = window.confirm(
      [
        `Chuyển ${selectedStaff?.name || "nhân viên"} sang chi nhánh mới?`,
        "",
        `Từ: ${formatBranch(sourceBranch)}`,
        `Đến: ${formatBranch(targetBranch)}`,
        `Vai trò mới: ${formatRoleLabel(roleCode)}`,
        "",
        "Sau khi chuyển, nhân viên sẽ bị đăng xuất để nhận quyền mới.",
      ].join("\n"),
    );

    if (!ok) return;

    try {
      setSubmitting(true);
      setMessage("");

      await apiJson("/staff-transfer/transfer-branch", {
        method: "PATCH",
        body: JSON.stringify({
          staffId,
          fromBranchId,
          toBranchId,
          roleCode,
          reason,
        }),
      });

      setMessage("Đã chuyển chi nhánh nhân viên và thu hồi phiên đăng nhập cũ.");
      resetForm();
      await loadOptions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không chuyển được chi nhánh.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] p-6 text-sm text-neutral-500">
        Đang tải dữ liệu chuyển chi nhánh...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          Bạn không có quyền dùng chức năng chuyển chi nhánh nhân viên.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-[#f7f7f8] p-5">
      <div className="rounded-[32px] bg-neutral-950 p-7 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-neutral-400">
          Staff Transfer Center
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Chuyển chi nhánh nhân viên
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-300">
          Trang riêng cho nhân viên quản lí: chọn nhân viên, chọn chi nhánh mới
          và xác nhận. Hệ thống tự cập nhật chi nhánh chính, role theo chi
          nhánh, quyền theo role và thu hồi phiên đăng nhập cũ.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">
                Danh sách nhân viên
              </p>
              <h2 className="mt-1 text-xl font-bold text-neutral-950">
                Chọn nhân viên cần chuyển
              </h2>
            </div>

            <button
              type="button"
              onClick={() => void loadOptions()}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Tải lại
            </button>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên, mã, SĐT, username, chi nhánh..."
            className="mt-4 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-neutral-500"
          />

          <div className="mt-4 max-h-[580px] overflow-auto rounded-2xl border border-neutral-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-xs uppercase tracking-[0.16em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Chi nhánh hiện tại</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3 text-right">Chọn</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {filteredStaff.map((item) => {
                  const active = item.id === staffId;
                  const currentBranchId = getStaffCurrentBranchId(item);

                  return (
                    <tr
                      key={item.id}
                      className={active ? "bg-neutral-950 text-white" : "hover:bg-neutral-50"}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold">{item.name}</div>
                        <div className={active ? "text-xs text-neutral-300" : "text-xs text-neutral-500"}>
                          {item.code || "—"} · {item.phone || item.username || "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        <div className="flex flex-wrap gap-1.5">
                          {getStaffRoleChips(item).map((chip) => (
                            <span
                              key={`${item.id}-${chip.branchId}-${chip.roleCode}`}
                              className={
                                active
                                  ? "rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white"
                                  : "rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-700"
                              }
                            >
                              {chip.branchName}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {getStaffRoleChips(item).map((chip) => (
                            <span
                              key={`${item.id}-${chip.branchId}-${chip.roleCode}-role`}
                              className={
                                active
                                  ? "rounded-full bg-white/10 px-2 py-1 text-xs font-bold"
                                  : "rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-700"
                              }
                            >
                              {formatRoleLabel(chip.roleCode)}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setStaffId(item.id)}
                          className={
                            active
                              ? "rounded-xl bg-white px-3 py-2 text-xs font-bold text-neutral-950"
                              : "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                          }
                        >
                          {active ? "Đang chọn" : "Chọn"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!filteredStaff.length ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-neutral-500"
                    >
                      Không có nhân viên phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">
            Chuyển chi nhánh
          </p>
          <h2 className="mt-1 text-xl font-bold text-neutral-950">
            Xác nhận điều chuyển
          </h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
                Nhân viên
              </p>
              <p className="mt-1 text-lg font-extrabold text-neutral-950">
                {selectedStaff?.name || "Chưa chọn"}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {selectedStaff?.code || "—"} ·{" "}
                {selectedStaff?.phone || selectedStaff?.username || "—"}
              </p>
            </div>

            <label className="block text-sm font-bold text-neutral-700">
              Chi nhánh hiện tại
              <select
                value={fromBranchId}
                onChange={(event) => setFromBranchId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-neutral-500"
              >
                <option value="">Chọn chi nhánh hiện tại</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {formatBranch(branch)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-neutral-700">
              Chuyển đến chi nhánh
              <select
                value={toBranchId}
                onChange={(event) => setToBranchId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-neutral-500"
              >
                <option value="">Chọn chi nhánh chuyển đến</option>
                {branches
                  .filter((branch) => branch.id !== fromBranchId)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {formatBranch(branch)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-neutral-700">
              Vai trò tại chi nhánh mới
              <select
                value={roleCode}
                onChange={(event) => setRoleCode(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-neutral-500"
              >
                <option value="retail-staff">Nhân viên bán lẻ</option>
                <option value="fulltime">Nhân viên fulltime</option>
                <option value="branch-manager">Quản lý chi nhánh</option>
                <option value="stock-staff">Nhân viên kho</option>
                <option value="stock-auditor">Nhân viên kiểm kho</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-neutral-700">
              Lý do chuyển
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="VD: điều phối nhân sự, hỗ trợ chi nhánh mới..."
                className="mt-2 min-h-[110px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-neutral-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm font-extrabold text-neutral-700 hover:bg-neutral-50"
              >
                Xoá chọn
              </button>

              <button
                type="button"
                onClick={transfer}
                disabled={submitting || !canTransfer}
                className="rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-extrabold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Đang chuyển..." : "Xác nhận chuyển"}
              </button>
            </div>

            {!canTransfer ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                Tài khoản này chỉ có quyền xem trang, chưa có quyền thực hiện
                chuyển chi nhánh.
              </p>
            ) : null}

            <p className="text-xs leading-5 text-neutral-500">
              Sau khi chuyển, hệ thống tự cập nhật chi nhánh chính, role theo
              chi nhánh mới, permission row mới và revoke phiên đăng nhập cũ để
              nhân viên nhận quyền mới khi đăng nhập lại.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
