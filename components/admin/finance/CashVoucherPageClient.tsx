"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getCurrentUserFromStorage } from "@/lib/current-user";

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

  const canView = hasPermission(currentUser, "cash_voucher.view");
  const canCreate = hasPermission(currentUser, createPermission);
  const canEdit = hasPermission(currentUser, editPermission);
  const canConfirm = hasPermission(currentUser, confirmPermission);
  const canCancel = hasPermission(currentUser, cancelPermission);
  const canDelete = hasPermission(currentUser, deletePermission) || canCancel;
  const canExport = hasPermission(currentUser, "cash_voucher.export");

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

  const allowedBranches = useMemo(() => {
    if (isGlobalFinanceUser || !currentBranchId) return branches;
    return branches.filter((branch) => String(branch.id) === String(currentBranchId));
  }, [branches, currentBranchId, isGlobalFinanceUser]);

  const cashPaymentSource =
    paymentSources.find((source) => isCashSource(source)) || paymentSources[0] || null;

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

  const resetForm = () => {
    setEditing(null);
    setForm({
      branchId: allowedBranches[0]?.id || currentBranchId || branches[0]?.id || "",
      paymentSourceId: cashPaymentSource?.id || paymentSources[0]?.id || "",
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
    const defaultCashSource =
      nextSources.find((source) => isCashSource(source)) || nextSources[0] || null;

    setBranches(nextBranches);
    setPaymentSources(nextSources);

    if (!isGlobalFinanceUser && currentBranchId) {
      setBranchId(currentBranchId);
      setPaymentSourceId(defaultCashSource?.id || "ALL");
      setForm((prev) => ({
        ...prev,
        branchId: prev.branchId || currentBranchId,
        paymentSourceId: prev.paymentSourceId || defaultCashSource?.id || "",
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        branchId: prev.branchId || nextBranches[0]?.id || "",
        paymentSourceId: prev.paymentSourceId || defaultCashSource?.id || "",
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

    if (!form.paymentSourceId && cashPaymentSource?.id) {
      setForm((prev) => ({ ...prev, paymentSourceId: cashPaymentSource.id }));
    }
  }, [
    allowedBranches,
    branches,
    branchId,
    cashPaymentSource,
    currentBranchId,
    form.branchId,
    form.paymentSourceId,
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
        paymentSourceId: cashPaymentSource?.id || form.paymentSourceId || undefined,
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
      alert("Bạn không có quyền xác nhận phiếu.");
      return;
    }

    if (!window.confirm(`Xác nhận ${title.toLowerCase()} ${row.voucherCode}?`)) return;

    await apiJson(`/finance/cash-vouchers/${row.id}/confirm`, {
      method: "PATCH",
      body: JSON.stringify({
        confirmedById: currentUser?.id,
        confirmedByName: currentUser?.name || currentUser?.username,
      }),
    });
    await loadData();
  };

  const cancelVoucher = async (row: any) => {
    if (!canCancel) {
      alert("Bạn không có quyền huỷ phiếu.");
      return;
    }

    const reason = window.prompt(`Lý do huỷ ${title.toLowerCase()} ${row.voucherCode}?`);
    if (reason === null) return;

    await apiJson(`/finance/cash-vouchers/${row.id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({
        cancelledById: currentUser?.id,
        cancelledByName: currentUser?.name || currentUser?.username,
        note: reason || row.note,
      }),
    });
    await loadData();
  };

  const deleteVoucher = async (row: any) => {
    if (!canDelete) {
      alert("Bạn không có quyền xoá phiếu.");
      return;
    }

    if (row.status === "CONFIRMED") {
      alert("Phiếu đã xác nhận không được xoá. Hãy huỷ phiếu nếu cần điều chỉnh.");
      return;
    }

    if (!window.confirm(`Xoá ${title.toLowerCase()} ${row.voucherCode || row.code}?`)) return;

    setActionMessage("");
    setActionError("");

    try {
      await apiJson(`/finance/cash-vouchers/${row.id}`, {
        method: "DELETE",
      });

      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setActionMessage(`Đã xoá ${title.toLowerCase()} ${row.voucherCode || row.code || ""}.`);
    } catch (error: any) {
      setActionError(error?.message || `Không xoá được ${title.toLowerCase()}.`);
    }
  };


  const exportCsv = () => {
    const header = ["Mã phiếu", "Loại", "Trạng thái", "Chi nhánh", "Nguồn tiền", "Số tiền", "Nội dung", "Đối tượng", "Ngày tạo"];
    const body = rows.map((row) => [
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
        <div className="fixed right-6 top-24 z-[80] flex max-w-md items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          <span>{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage("")}
            className="rounded-full px-2 text-emerald-700 hover:bg-emerald-100"
          >
            ×
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="fixed right-6 top-24 z-[80] flex max-w-md items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError("")}
            className="rounded-full px-2 text-red-700 hover:bg-red-100"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-neutral-500">Tài chính / {title}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">{subtitle}</p>
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
                  className={`rounded-xl px-3 py-2 text-sm ${
                    quickRange === value ? "bg-black text-white" : "border border-neutral-200 bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Từ ngày">
            <input type="date" value={dateFrom} onChange={(e) => { setQuickRange("custom"); setDateFrom(e.target.value); }} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" />
          </Field>
          <Field label="Đến ngày">
            <input type="date" value={dateTo} onChange={(e) => { setQuickRange("custom"); setDateTo(e.target.value); }} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" />
          </Field>
          <Field label="Chi nhánh">
            <select
              value={!isGlobalFinanceUser && currentBranchId ? currentBranchId : branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={!isGlobalFinanceUser}
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm disabled:bg-neutral-50 disabled:text-neutral-500"
            >
              {isGlobalFinanceUser ? <option value="ALL">Tất cả chi nhánh</option> : null}
              {allowedBranches.map((b) => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
            </select>
          </Field>
          <Field label="Nguồn tiền">
            <select
              value={cashPaymentSource?.id || paymentSourceId}
              onChange={(e) => setPaymentSourceId(e.target.value)}
              disabled
              className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm disabled:bg-neutral-50 disabled:text-neutral-500"
            >
              {cashPaymentSource ? (
                <option value={cashPaymentSource.id}>{cashPaymentSource.name}</option>
              ) : (
                <option value="ALL">Tiền mặt</option>
              )}
            </select>
          </Field>
          <div className="flex items-end">
            <button onClick={() => void loadData()} className="h-11 rounded-xl bg-black px-5 text-sm font-medium text-white">
              {loading ? "Đang lọc..." : "Lọc"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã phiếu, nội dung, đối tượng, ghi chú..." className="h-11 rounded-xl border border-neutral-200 px-3 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value as VoucherStatus)} className="h-11 rounded-xl border border-neutral-200 px-3 text-sm">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="CANCELLED">Đã huỷ</option>
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
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm disabled:bg-neutral-50 disabled:text-neutral-500"
              >
                <option value="">Chọn chi nhánh</option>
                {allowedBranches.map((b) => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
              </select>
            </Field>
            <Field label="Nguồn tiền">
              <select
                value={cashPaymentSource?.id || form.paymentSourceId}
                onChange={(e) => setForm({ ...form, paymentSourceId: e.target.value })}
                disabled
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm disabled:bg-neutral-50 disabled:text-neutral-500"
              >
                {cashPaymentSource ? (
                  <option value={cashPaymentSource.id}>{cashPaymentSource.name}</option>
                ) : (
                  <option value="">Tiền mặt</option>
                )}
              </select>
            </Field>
            <Field label="Số tiền">
              <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" placeholder="Nhập số tiền" />
            </Field>
            <Field label="Nhóm khoản">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" placeholder={isReceipt ? "Thu khác / Thu cọc..." : "Chi vận hành / Chi khác..."} />
            </Field>
            <Field label="Nội dung">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" placeholder="Ví dụ: Thu cọc khách A" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Đối tượng">
                <input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" placeholder="Khách/NCC/người nhận" />
              </Field>
              <Field label="SĐT">
                <input value={form.partnerPhone} onChange={(e) => setForm({ ...form, partnerPhone: e.target.value })} className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm" placeholder="Số điện thoại" />
              </Field>
            </div>
            <Field label="Ghi chú">
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="min-h-24 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" placeholder="Ghi chú nội bộ..." />
            </Field>

            <div className="flex flex-wrap gap-2">
              <button disabled={saving || (!editing && !canCreate) || (editing && !canEdit)} onClick={saveVoucher} className="rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
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
              <p className="text-sm text-neutral-500">{rows.length} phiếu trong khoảng lọc.</p>
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
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-semibold">{row.voucherCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-neutral-500">
                        {[row.category, row.partnerName, row.partnerPhone].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {row.note ? <div className="mt-1 text-xs text-neutral-400">{row.note}</div> : null}
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
                          disabled={row.status === "CONFIRMED" || !canDelete}
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
