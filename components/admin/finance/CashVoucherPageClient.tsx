"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getCurrentUserFromStorage, getWorkingBranchId } from "@/lib/current-user";

type VoucherType = "RECEIPT" | "PAYMENT";
type VoucherStatus = "ALL" | "DRAFT" | "CONFIRMED" | "CANCELLED";
type QuickRange = "today" | "yesterday" | "7d" | "30d" | "custom";

type Props = {
  type: VoucherType;
};

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRange(type: QuickRange) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (type === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { from: toDateInput(d), to: toDateInput(d) };
  }

  if (type === "7d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: toDateInput(d), to: toDateInput(today) };
  }

  if (type === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return { from: toDateInput(d), to: toDateInput(today) };
  }

  return { from: toDateInput(today), to: toDateInput(today) };
}

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

function statusLabel(status: string) {
  if (status === "DRAFT") return "Nháp";
  if (status === "CONFIRMED") return "Đã xác nhận";
  if (status === "CANCELLED") return "Đã huỷ";
  return status || "—";
}

function statusClass(status: string) {
  if (status === "CONFIRMED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function normalizeMoneySourceName(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isCashSource(source: any) {
  const text = normalizeMoneySourceName(
    [source?.name, source?.code, source?.type].filter(Boolean).join(" ")
  );

  return (
    text.includes("tien mat") ||
    text.includes("cash") ||
    text.includes("tm") ||
    text.includes("quy tien mat")
  );
}

function branchAliasTokens(branch: any, currentUser?: any) {
  const rawValues = [
    branch?.code,
    branch?.name,
    branch?.shortName,
    branch?.slug,
    currentUser?.branchCode,
    currentUser?.workingBranchCode,
    currentUser?.branch?.code,
    currentUser?.branch?.name,
    currentUser?.workingBranch?.code,
    currentUser?.workingBranch?.name,
    currentUser?.name,
    currentUser?.username,
    currentUser?.displayName,
  ];

  const text = rawValues
    .map((value) => normalizeMoneySourceName(value))
    .filter(Boolean)
    .join(" ");

  const tokens = new Set<string>();

  rawValues.forEach((value) => {
    const normalized = normalizeMoneySourceName(value);
    if (!normalized) return;

    tokens.add(normalized);

    normalized
      .split(/[^a-z0-9]+/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => tokens.add(part));

    const words = normalized
      .split(/[^a-z0-9]+/g)
      .map((part) => part.trim())
      .filter(Boolean);

    if (words.length > 1) {
      tokens.add(words.map((word) => word[0]).join(""));
    }
  });

  [
    ["quoc oai", "qo"],
    ["quoc-oai", "qo"],
    ["thai ha", "th"],
    ["thai-ha", "th"],
    ["chua lang", "cl"],
    ["chua-lang", "cl"],
    ["xa dan", "xd"],
    ["xa-dan", "xd"],
  ].forEach(([name, code]) => {
    if (text.includes(name) || text.includes(code)) {
      tokens.add(name.replace("-", " "));
      tokens.add(code);
    }
  });

  return Array.from(tokens).filter(Boolean);
}

function sourceMatchesBranch(source: any, branch: any, currentUser?: any) {
  if (!source) return false;

  if (source.branchId && branch?.id && String(source.branchId) === String(branch.id)) {
    return true;
  }

  const sourceText = normalizeMoneySourceName(
    [source?.name, source?.code, source?.description, source?.branchCode, source?.branchName]
      .filter(Boolean)
      .join(" ")
  );

  const tokens = branchAliasTokens(branch, currentUser);

  return tokens.some((token) => {
    if (!token || token.length < 2) return false;
    return sourceText.includes(token);
  });
}

function findCashSourceForBranch(sources: any[], branch: any, currentUser?: any) {
  const cashSources = sources.filter((source) => isCashSource(source));

  if (!cashSources.length) return null;
  if (!branch && !currentUser) return cashSources[0] || null;

  return (
    cashSources.find((source) => sourceMatchesBranch(source, branch, currentUser)) ||
    null
  );
}

function creatorKey(row: any) {
  return row.createdByName || row.staffName || row.createdById || row.staffId || "—";
}



function cashSourceOptionsForBranch(sources: any[], branch: any, currentUser?: any) {
  const cashSources = sources.filter((source) => isCashSource(source));
  const matched = cashSources.filter((source) => sourceMatchesBranch(source, branch, currentUser));

  // Tuyệt đối không fallback sang tiền mặt chi nhánh khác.
  // Nếu QO chưa có TIỀN MẶT QO thì trả rỗng để UI báo cấu hình thiếu,
  // tránh ghi nhầm vào TIỀN MẶT CL/TH/XD.
  return matched;
}

function sourceDisplay(row: any) {
  const source = row.paymentSourceName || row.paymentSourceCode || row.paymentSourceId || "Tiền mặt";
  const branch = row.branchName || row.branchId || "";
  return branch ? `${source} · ${branch}` : source;
}

function creatorDisplay(row: any) {
  return row.createdByName || row.staffName || row.createdById || row.staffId || "—";
}

function hasPermission(user: any, key: string) {
  const keys = new Set<string>();

  const add = (items?: any[]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const value = String(item || "").trim();
      if (value) keys.add(value);
    });
  };

  add(user?.permissions);
  add(user?.permissionKeys);

  if (Array.isArray(user?.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => add(row?.permissionKeys));
  }

  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].map((role) => String(role || "").toLowerCase());

  return roles.includes("owner") || roles.includes("admin") || keys.has("*") || keys.has(key);
}

export default function CashVoucherPageClient({ type }: Props) {
  const currentUser = getCurrentUserFromStorage();

  const userRoles = [
    ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
    currentUser?.role,
  ]
    .map((role) => String(role || "").toLowerCase())
    .filter(Boolean);

  const isGlobalFinanceUser =
    userRoles.includes("owner") ||
    userRoles.includes("admin") ||
    currentUser?.role === "OWNER" ||
    currentUser?.role === "ADMIN" ||
    (Array.isArray(currentUser?.permissions) && currentUser.permissions.includes("*"));

  const currentBranchId =
    getWorkingBranchId(currentUser) ||
    currentUser?.branchId ||
    currentUser?.workingBranchId ||
    currentUser?.branch?.id ||
    "";

  const isReceipt = type === "RECEIPT";
  const title = isReceipt ? "Phiếu thu" : "Phiếu chi";
  const subtitle = isReceipt
    ? "Ghi nhận các khoản tiền vào ngoài đơn hàng: thu cọc, thu khác, điều chỉnh quỹ."
    : "Ghi nhận các khoản tiền ra: chi vận hành, chi NCC ngoài phiếu nhập, hoàn tiền thủ công.";

  const createPermission = isReceipt
    ? "cash_voucher.create_receipt"
    : "cash_voucher.create_payment";
  const editPermission = isReceipt
    ? "cash_voucher.edit_receipt"
    : "cash_voucher.edit_payment";
  const confirmPermission = isReceipt
    ? "cash_voucher.confirm_receipt"
    : "cash_voucher.confirm_payment";
  const cancelPermission = isReceipt
    ? "cash_voucher.cancel_receipt"
    : "cash_voucher.cancel_payment";
  const deletePermission = isReceipt
    ? "cash_voucher.delete_receipt"
    : "cash_voucher.delete_payment";

  const canView = isReceipt
    ? (
      hasPermission(currentUser, "cash_voucher.view_receipt") ||
      hasPermission(currentUser, "cash_voucher.view")
    )
    : (
      hasPermission(currentUser, "cash_voucher.view_payment") ||
      hasPermission(currentUser, "cash_voucher.view")
    );
  const roleText = String(
    currentUser?.role ||
    currentUser?.userRole ||
    currentUser?.primaryRole ||
    currentUser?.appRole ||
    ""
  ).toUpperCase();

  const isPowerFinanceUser =
    roleText.includes("OWNER") ||
    roleText.includes("ADMIN") ||
    hasPermission(currentUser, "system.manage");

  const canCreate = hasPermission(currentUser, createPermission) || isPowerFinanceUser;
  const canEdit = hasPermission(currentUser, editPermission) || isPowerFinanceUser;
  const canConfirm = hasPermission(currentUser, confirmPermission) || isPowerFinanceUser;
  const canCancel = hasPermission(currentUser, cancelPermission) || isPowerFinanceUser;
  const canDelete = hasPermission(currentUser, deletePermission) || canCancel || isPowerFinanceUser;
  const canExport = hasPermission(currentUser, "cash_voucher.export") || isPowerFinanceUser;
  const canChooseAnyPaymentSource = isGlobalFinanceUser || isPowerFinanceUser;

  const initialRange = useMemo(() => getRange("today"), []);
  const [quickRange, setQuickRange] = useState<QuickRange>("today");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [branchId, setBranchId] = useState("ALL");
  const [paymentSourceId, setPaymentSourceId] = useState("ALL");
  const [status, setStatus] = useState<VoucherStatus>("ALL");
  const [q, setQ] = useState("");

  const [branches, setBranches] = useState<any[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("ALL");
  const [confirmDialog, setConfirmDialog] = useState<{
    kind: "confirm" | "cancel" | "delete";
    row: any;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const allowedBranches = useMemo(() => {
    if (isGlobalFinanceUser || !currentBranchId) return branches;
    return branches.filter((branch) => String(branch.id) === String(currentBranchId));
  }, [branches, currentBranchId, isGlobalFinanceUser]);

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    branchId: "",
    paymentSourceId: "",
    amount: "",
    category: "",
    title: "",
    partnerName: "",
    partnerPhone: "",
    note: "",
  });

  const selectedFormBranchId =
    (!isGlobalFinanceUser && currentBranchId ? currentBranchId : form.branchId) ||
    allowedBranches[0]?.id ||
    currentBranchId ||
    branches[0]?.id ||
    "";

  const selectedFormBranch =
    branches.find((branch) => String(branch.id) === String(selectedFormBranchId)) ||
    allowedBranches[0] ||
    null;

  const cashPaymentSource = findCashSourceForBranch(paymentSources, selectedFormBranch, currentUser);
  const cashSourceOptions = useMemo(
    () => cashSourceOptionsForBranch(paymentSources, selectedFormBranch, currentUser),
    [paymentSources, selectedFormBranch, currentUser]
  );

  const formPaymentSourceOptions = useMemo(() => {
    if (!canChooseAnyPaymentSource) return cashSourceOptions;

    const selectedBranchSources = paymentSources.filter((source) =>
      sourceMatchesBranch(source, selectedFormBranch, currentUser),
    );
    const otherSources = paymentSources.filter(
      (source) => !selectedBranchSources.some((item) => String(item.id) === String(source.id)),
    );

    // Admin/owner được chọn đủ nguồn tiền. Nguồn cùng chi nhánh được đẩy lên trước,
    // nhưng vẫn giữ toàn bộ nguồn khác để có thể tạo phiếu chuyển/điều chỉnh đúng quỹ.
    return [...selectedBranchSources, ...otherSources];
  }, [canChooseAnyPaymentSource, cashSourceOptions, currentUser, paymentSources, selectedFormBranch]);

  const effectiveFormPaymentSourceId = canChooseAnyPaymentSource
    ? form.paymentSourceId
    : cashPaymentSource?.id || form.paymentSourceId;

  const resetForm = () => {
    setEditing(null);
    setForm({
      branchId: allowedBranches[0]?.id || currentBranchId || branches[0]?.id || "",
      paymentSourceId: canChooseAnyPaymentSource
        ? formPaymentSourceOptions[0]?.id || paymentSources[0]?.id || ""
        : cashPaymentSource?.id || "",
      amount: "",
      category: isReceipt ? "Thu khác" : "Chi khác",
      title: "",
      partnerName: "",
      partnerPhone: "",
      note: "",
    });
  };

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range === "custom") return;
    const next = getRange(range);
    setDateFrom(next.from);
    setDateTo(next.to);
  };

  const loadMeta = async () => {
    const [branchRows, sourceRows] = await Promise.all([
      apiJson<any[]>("/branches").catch(() => []),
      apiJson<any[]>("/payment-sources").catch(() => []),
    ]);

    const nextBranches = Array.isArray(branchRows) ? branchRows : [];
    const nextSources = Array.isArray(sourceRows) ? sourceRows : [];
    const branchForDefault = !isGlobalFinanceUser && currentBranchId
      ? nextBranches.find((branch) => String(branch.id) === String(currentBranchId))
      : nextBranches[0];

    const defaultCashSource =
      findCashSourceForBranch(nextSources, branchForDefault, currentUser) ||
      null;
    const defaultPaymentSource = canChooseAnyPaymentSource
      ? nextSources.find((source) => sourceMatchesBranch(source, branchForDefault, currentUser)) || nextSources[0] || null
      : defaultCashSource;

    setBranches(nextBranches);
    setPaymentSources(nextSources);

    if (!isGlobalFinanceUser && currentBranchId) {
      setBranchId(currentBranchId);
      setPaymentSourceId("ALL");
      setForm((prev) => ({
        ...prev,
        branchId: prev.branchId || currentBranchId,
        paymentSourceId: prev.paymentSourceId || defaultPaymentSource?.id || "",
      }));
    } else {
      setPaymentSourceId((prev) => prev || "ALL");
      setForm((prev) => ({
        ...prev,
        branchId: prev.branchId || nextBranches[0]?.id || "",
        paymentSourceId: prev.paymentSourceId || defaultPaymentSource?.id || "",
      }));
    }
  };

  const loadData = async () => {
    if (!canView) return;
    setLoading(true);
    setActionError("");
    try {
      const params = new URLSearchParams({
        type,
        dateFrom,
        dateTo,
        branchId: !isGlobalFinanceUser && currentBranchId ? currentBranchId : branchId,
        paymentSourceId,
        status,
        q,
      });

      const data = await apiJson<any>(`/finance/cash-vouchers?${params.toString()}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(data?.summary || {});
    } catch (error: any) {
      setActionError(error?.message || "Không tải được danh sách phiếu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    const handleActiveBranchChanged = () => {
      window.location.reload();
    };

    window.addEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
    return () => {
      window.removeEventListener("the1970:active-branch-changed", handleActiveBranchChanged);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [type, dateFrom, dateTo, branchId, paymentSourceId, status, q, canView]);

  useEffect(() => {
    if (!isGlobalFinanceUser && currentBranchId && branchId !== currentBranchId) {
      setBranchId(currentBranchId);
    }

    if (!form.branchId) {
      const defaultBranchId = allowedBranches[0]?.id || currentBranchId || branches[0]?.id;
      if (defaultBranchId) {
        setForm((prev) => ({ ...prev, branchId: defaultBranchId }));
      }
    }

    if (!canChooseAnyPaymentSource && cashPaymentSource?.id && form.paymentSourceId !== cashPaymentSource.id) {
      setForm((prev) => ({ ...prev, paymentSourceId: cashPaymentSource.id }));
    }

    if (canChooseAnyPaymentSource && !form.paymentSourceId && formPaymentSourceOptions[0]?.id) {
      setForm((prev) => ({ ...prev, paymentSourceId: formPaymentSourceOptions[0].id }));
    }
  }, [
    allowedBranches,
    branches,
    branchId,
    canChooseAnyPaymentSource,
    cashPaymentSource,
    currentBranchId,
    form.branchId,
    form.paymentSourceId,
    formPaymentSourceOptions,
    isGlobalFinanceUser,
  ]);

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      branchId: row.branchId || "",
      paymentSourceId: row.paymentSourceId || "",
      amount: String(Number(row.amount || 0)),
      category: row.category || "",
      title: row.title || "",
      partnerName: row.partnerName || "",
      partnerPhone: row.partnerPhone || "",
      note: row.note || "",
    });
  };

  const saveVoucher = async () => {
    if (editing && !canEdit) {
      alert("Bạn không có quyền sửa phiếu.");
      return;
    }
    if (!editing && !canCreate) {
      alert("Bạn không có quyền tạo phiếu.");
      return;
    }

    setSaving(true);
    setActionMessage("");
    setActionError("");

    try {
      const payload = {
        type,
        branchId: (!isGlobalFinanceUser && currentBranchId ? currentBranchId : form.branchId) || undefined,
        paymentSourceId: effectiveFormPaymentSourceId || undefined,
        amount: Number(String(form.amount || "").replace(/[^\d]/g, "")),
        category: form.category.trim() || undefined,
        title: form.title.trim(),
        partnerName: form.partnerName.trim() || undefined,
        partnerPhone: form.partnerPhone.trim() || undefined,
        note: form.note.trim() || undefined,
        createdById: currentUser?.id,
        createdByName: currentUser?.name || currentUser?.username || currentUser?.email,
      };

      if (!payload.title || payload.amount <= 0) {
        setActionError("Nhập đủ nội dung và số tiền hợp lệ.");
        return;
      }

      if (!payload.paymentSourceId) {
        setActionError(canChooseAnyPaymentSource ? "Chọn nguồn tiền cho phiếu." : "Chưa tìm thấy nguồn tiền mặt đúng với chi nhánh đang làm việc.");
        return;
      }

      let saved: any;

      if (editing) {
        saved = await apiJson(`/finance/cash-vouchers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setRows((prev) =>
          prev.map((row) => (row.id === editing.id ? { ...row, ...saved } : row)),
        );
        setActionMessage(`Đã lưu thay đổi ${title.toLowerCase()} ${saved?.voucherCode || saved?.code || ""}.`);
      } else {
        saved = await apiJson("/finance/cash-vouchers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setRows((prev) => [saved, ...prev]);
        setActionMessage(`Đã tạo ${title.toLowerCase()} ${saved?.voucherCode || saved?.code || ""}.`);
      }

      resetForm();
    } catch (error: any) {
      setActionError(error?.message || `Không tạo được ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const confirmVoucher = async (row: any) => {
    if (!canConfirm) {
      setActionError("Bạn không có quyền xác nhận phiếu.");
      return;
    }

    setConfirmDialog({ kind: "confirm", row });
  };

  const cancelVoucher = async (row: any) => {
    if (!canCancel) {
      setActionError("Bạn không có quyền huỷ phiếu.");
      return;
    }

    setCancelReason("");
    setConfirmDialog({ kind: "cancel", row });
  };

  const deleteVoucher = async (row: any) => {
    if (!canDelete) {
      setActionError("Bạn không có quyền xoá phiếu.");
      return;
    }

    setConfirmDialog({ kind: "delete", row });
  };

  const runDialogAction = async () => {
    if (!confirmDialog?.row) return;

    const row = confirmDialog.row;

    setActionMessage("");
    setActionError("");

    try {
      if (confirmDialog.kind === "confirm") {
        const saved: any = await apiJson(`/finance/cash-vouchers/${row.id}/confirm`, {
          method: "PATCH",
          body: JSON.stringify({
            confirmedById: currentUser?.id,
            confirmedByName: currentUser?.name || currentUser?.username,
          }),
        });

        setActionMessage(`Đã xác nhận ${title.toLowerCase()} ${saved?.voucherCode || row.voucherCode || ""}.`);
      }

      if (confirmDialog.kind === "cancel") {
        const saved: any = await apiJson(`/finance/cash-vouchers/${row.id}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({
            cancelledById: currentUser?.id,
            cancelledByName: currentUser?.name || currentUser?.username,
            note: cancelReason || row.note,
          }),
        });

        setActionMessage(`Đã huỷ ${title.toLowerCase()} ${saved?.voucherCode || row.voucherCode || ""}.`);
      }

      if (confirmDialog.kind === "delete") {
        await apiJson(`/finance/cash-vouchers/${row.id}`, {
          method: "DELETE",
        });

        setActionMessage(`Đã xoá ${title.toLowerCase()} ${row.voucherCode || row.code || ""}.`);
      }

      setConfirmDialog(null);
      setCancelReason("");
      await loadData();
    } catch (error: any) {
      setActionError(error?.message || `Không thực hiện được thao tác với ${title.toLowerCase()}.`);
    }
  };

  const creatorOptions = useMemo(() => {
    const names = rows
      .map((row) => creatorKey(row))
      .filter((name) => name && name !== "—");

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (creatorFilter === "ALL") return rows;
    return rows.filter((row) => creatorKey(row) === creatorFilter);
  }, [rows, creatorFilter]);

  const exportCsv = () => {
    const header = ["Mã phiếu", "Loại", "Trạng thái", "Chi nhánh", "Nguồn tiền", "Số tiền", "Nội dung", "Đối tượng", "Ngày tạo"];
    const body = visibleRows.map((row) => [
      row.voucherCode,
      row.type,
      statusLabel(row.status),
      row.branchName || row.branchId || "",
      row.paymentSourceName || row.paymentSourceId || "",
      row.amount,
      row.title,
      row.partnerName || "",
      dateText(row.createdAt),
    ]);

    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isReceipt ? "phieu-thu" : "phieu-chi"}-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
        Bạn không có quyền xem {title.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {actionMessage ? (
        <div className="fixed right-6 top-24 z-[80] max-w-md rounded-3xl border border-emerald-200 bg-white p-4 text-sm shadow-2xl shadow-emerald-950/10">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-800">✓</div>
            <div className="min-w-0">
              <p className="font-bold text-emerald-800">Thao tác thành công</p>
              <p className="mt-1 text-neutral-700">{actionMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage("")}
              className="ml-2 rounded-full px-2 py-1 text-neutral-900 placeholder:text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div className="fixed right-6 top-24 z-[80] max-w-md rounded-3xl border border-red-200 bg-white p-4 text-sm shadow-2xl shadow-red-950/10">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg font-black text-red-800">!</div>
            <div className="min-w-0">
              <p className="font-bold text-red-800">Không thực hiện được</p>
              <p className="mt-1 text-neutral-700">{actionError}</p>
            </div>
            <button
              type="button"
              onClick={() => setActionError("")}
              className="ml-2 rounded-full px-2 py-1 text-neutral-900 placeholder:text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${
                confirmDialog.kind === "confirm"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}>
                {confirmDialog.kind === "confirm" ? "✓" : "!"}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-neutral-950">
                  {confirmDialog.kind === "confirm"
                    ? `Xác nhận ${title.toLowerCase()}`
                    : confirmDialog.kind === "cancel"
                      ? `Huỷ ${title.toLowerCase()}`
                      : `Xoá ${title.toLowerCase()}`}
                </h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Mã phiếu <b>{confirmDialog.row?.voucherCode || confirmDialog.row?.code}</b> · số tiền <b>{currency(confirmDialog.row?.amount)}</b>
                </p>

                {confirmDialog.kind === "cancel" ? (
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    className="mt-4 min-h-24 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                    placeholder="Nhập lý do huỷ phiếu..."
                  />
                ) : null}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDialog(null);
                      setCancelReason("");
                    }}
                    className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold"
                  >
                    Để sau
                  </button>
                  <button
                    type="button"
                    onClick={() => void runDialogAction()}
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${
                      confirmDialog.kind === "confirm" ? "bg-emerald-700" : "bg-red-700"
                    }`}
                  >
                    {confirmDialog.kind === "confirm" ? "Xác nhận ngay" : confirmDialog.kind === "cancel" ? "Huỷ phiếu" : "Xoá phiếu"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-neutral-900 placeholder:text-neutral-500">Tài chính / {title}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-900 placeholder:text-neutral-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/daily"
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900"
          >
            Tổng quan dòng tiền
          </Link>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!canExport}
            className="rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
          >
            Xuất Excel/CSV
          </button>
        </div>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-500">Khoảng thời gian</p>
            <div className="flex flex-wrap gap-2">
              {[
                ["today", "Hôm nay"],
                ["yesterday", "Hôm qua"],
                ["7d", "7 ngày"],
                ["30d", "30 ngày"],
                ["custom", "Tuỳ chọn"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => applyQuickRange(value as QuickRange)}
                  className={`rounded-xl px-3 py-2 text-sm ${quickRange === value ? "bg-black text-white" : "border border-neutral-200 bg-white"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Từ ngày">
            <input type="date" value={dateFrom} onChange={(e) => { setQuickRange("custom"); setDateFrom(e.target.value); }} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" />
          </Field>
          <Field label="Đến ngày">
            <input type="date" value={dateTo} onChange={(e) => { setQuickRange("custom"); setDateTo(e.target.value); }} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" />
          </Field>
          <Field label="Chi nhánh">
            <select
              value={!isGlobalFinanceUser && currentBranchId ? currentBranchId : branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={!isGlobalFinanceUser}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500 disabled:opacity-100 disabled:bg-neutral-50 disabled:text-neutral-950"
            >
              {isGlobalFinanceUser ? <option value="ALL">Tất cả chi nhánh</option> : null}
              {allowedBranches.map((b) => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
            </select>
          </Field>
          <Field label="Nguồn tiền">
            <select
              value={paymentSourceId}
              onChange={(e) => setPaymentSourceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500"
            >
              <option value="ALL">Tất cả nguồn tiền</option>
              {paymentSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name || source.code || source.id}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button onClick={() => void loadData()} className="h-11 rounded-xl bg-black px-5 text-sm font-medium text-white">
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px_220px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã phiếu, nội dung, đối tượng, ghi chú..." className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" />
          <select value={status} onChange={(e) => setStatus(e.target.value as VoucherStatus)} className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="CANCELLED">Đã huỷ</option>
          </select>

          <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)} className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500">
            <option value="ALL">Tất cả người tạo</option>
            {creatorOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label={isReceipt ? "Tổng phiếu thu" : "Tổng phiếu chi"} value={currency(isReceipt ? summary.totalReceipt : summary.totalPayment)} />
        <Stat label="Đã xác nhận" value={currency(isReceipt ? summary.confirmedReceipt : summary.confirmedPayment)} />
        <Stat label="Chờ xác nhận" value={currency(summary.pendingAmount)} />
        <Stat label="Dòng tiền ròng" value={currency(summary.netCashFlow)} />
      </div>

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">
            {editing ? `Sửa ${title.toLowerCase()}` : `Tạo ${title.toLowerCase()}`}
          </h2>

          <div className="mt-4 space-y-3">
            <Field label="Chi nhánh">
              <select
                value={!isGlobalFinanceUser && currentBranchId ? currentBranchId : form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                disabled={!isGlobalFinanceUser}
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500 disabled:opacity-100 disabled:bg-neutral-50 disabled:text-neutral-950"
              >
                <option value="">Chọn chi nhánh</option>
                {allowedBranches.map((b) => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
              </select>
            </Field>
            <Field label="Nguồn tiền">
              <select
                value={effectiveFormPaymentSourceId || ""}
                onChange={(e) => setForm({ ...form, paymentSourceId: e.target.value })}
                disabled={!canChooseAnyPaymentSource}
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500 disabled:opacity-100 disabled:bg-neutral-50 disabled:text-neutral-950"
              >
                <option value="">Chọn nguồn tiền</option>
                {formPaymentSourceOptions.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name || source.code || source.id}
                  </option>
                ))}
              </select>

              {canChooseAnyPaymentSource ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Admin/owner được chọn tất cả nguồn tiền: tiền mặt, chuyển khoản, ví, COD hoặc nguồn nội bộ đã cấu hình.
                </p>
              ) : cashPaymentSource ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Đã tự khoá đúng quỹ tiền mặt theo chi nhánh {selectedFormBranch?.name || selectedFormBranch?.code || "làm việc"}.
                </p>
              ) : (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  Chưa có nguồn tiền mặt đúng chi nhánh {selectedFormBranch?.code || selectedFormBranch?.name || ""}. Cần tạo/mở nguồn TIỀN MẶT {selectedFormBranch?.code || ""} trong cấu hình nguồn tiền.
                </p>
              )}
            </Field>
            <Field label="Số tiền">
              <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" placeholder="Nhập số tiền" />
            </Field>
            <Field label="Nhóm khoản">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" placeholder={isReceipt ? "Thu khác / Thu cọc..." : "Chi vận hành / Chi khác..."} />
            </Field>
            <Field label="Nội dung">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" placeholder="Ví dụ: Thu cọc khách A" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Đối tượng">
                <input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" placeholder="Khách/NCC/người nhận" />
              </Field>
              <Field label="SĐT">
                <input value={form.partnerPhone} onChange={(e) => setForm({ ...form, partnerPhone: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" placeholder="Số điện thoại" />
              </Field>
            </div>
            <Field label="Ghi chú">
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="min-h-24 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-950 placeholder:text-neutral-500" placeholder="Ghi chú nội bộ..." />
            </Field>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={saving || !effectiveFormPaymentSourceId || (!editing && !canCreate) || (editing && !canEdit)}
                onClick={saveVoucher}
                className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : `Tạo ${title.toLowerCase()}`}
              </button>
              <button onClick={resetForm} className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold">
                Làm mới
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">Danh sách {title.toLowerCase()}</h2>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-900 placeholder:text-neutral-500">{visibleRows.length} / {rows.length} phiếu trong khoảng lọc.</p>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Tải lại
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Mã phiếu</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3">Nguồn / kho</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Người tạo</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-semibold">{row.voucherCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-neutral-500">
                        {[row.category, row.partnerName, row.partnerPhone].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {row.note ? <div className="mt-1 text-xs text-neutral-900 placeholder:text-neutral-500">{row.note}</div> : null}
                    </td>
                    <td className="px-4 py-3">{sourceDisplay(row)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{currency(row.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{creatorDisplay(row)}</td>
                    <td className="px-4 py-3">{dateText(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button disabled={row.status !== "DRAFT" || !canEdit} onClick={() => openEdit(row)} className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40">
                          Sửa
                        </button>
                        <button disabled={row.status !== "DRAFT" || !canConfirm} onClick={() => confirmVoucher(row)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40">
                          Xác nhận
                        </button>
                        <button disabled={row.status === "CANCELLED" || !canCancel} onClick={() => cancelVoucher(row)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">
                          Huỷ
                        </button>
                        <button
                          disabled={!canDelete}
                          onClick={() => deleteVoucher(row)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                      Chưa có dữ liệu {title.toLowerCase()}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{value}</p>
    </div>
  );
}
