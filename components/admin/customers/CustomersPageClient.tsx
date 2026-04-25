"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  createCustomer,
  getCustomers,
  updateCustomer,
  type CreateCustomerPayload,
  type CustomerItem,
  type UpdateCustomerPayload,
} from "@/lib/customers-api";
import RoleGuard from "@/components/admin/RoleGuard";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function currency(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN").format(d);
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}
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
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
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
    gray: "bg-neutral-100 text-neutral-700 border-neutral-200",
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
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{value}</h3>
        <p className="mt-2 text-xs text-neutral-500">{sub}</p>
      </div>
    </Panel>
  );
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
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

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-3xl font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-xl text-neutral-500">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type ParsedRow = Record<string, any>;

type ImportPreviewRow = {
  legacyCode: string;
  fullName: string;
  phone: string;
  email: string;
  customerGroup: string;
  gender: string;
  birthDate: string;
  points: number;
  totalSpent: number;
  totalOrders: number;
  lastOrderAt: string;
  addressLine1: string;
  ward: string;
  district: string;
  province: string;
};

function normalizeNumber(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).replace(/[^\d.-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeader(value: any) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*:]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findValue(row: ParsedRow, keys: string[]) {
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    const matched = rowKeys.find((k) => normalizeHeader(k) === normalizedKey);
    if (matched) {
      const value = row[matched];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return "";
}

function detectHeaderRowIndex(sheetData: any[][]) {
  return sheetData.findIndex((row) => {
    if (!Array.isArray(row)) return false;

    const joined = row
      .map((cell) => normalizeHeader(cell))
      .join(" | ");

    return (
      joined.includes("ten khach hang") ||
      joined.includes("dien thoai") ||
      joined.includes("ma khach hang")
    );
  });
}

function buildRowsFromSheetData(
  sheetData: any[][],
  headerRowIndex: number
): ParsedRow[] {
  const headerRow = (sheetData[headerRowIndex] || []).map((cell) =>
    String(cell ?? "").trim()
  );

  const rows: ParsedRow[] = [];

  for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
    const rowArray = sheetData[i];
    if (!Array.isArray(rowArray)) continue;

    const rowObject: ParsedRow = {};

    for (let col = 0; col < headerRow.length; col++) {
      const header = headerRow[col];
      if (!header) continue;
      rowObject[header] = rowArray[col] ?? "";
    }

    rows.push(rowObject);
  }

  return rows;
}

function downloadCustomerTemplate() {
  const headers = [
    [
      "Mã khách hàng",
      "Tên khách hàng",
      "Điện thoại",
      "Email",
      "Mã nhóm khách hàng",
      "Ngày sinh",
      "Giới tính",
      "Điểm hiện tại",
      "Tổng chi tiêu",
      "SL đơn hàng",
      "Ngày mua cuối cùng",
      "Địa chỉ",
      "Phường xã",
      "Quận huyện",
      "Tỉnh thành",
      "Chiết khấu mặc định (%)",
      "Chính sách giá",
      "Ghi chú",
    ],
    [
      "CUZN37920",
      "Nguyễn Văn A",
      "0988123456",
      "",
      "VIP",
      "1998-01-20",
      "Nam",
      120,
      2500000,
      5,
      "2026-04-10",
      "12 Tràng Tiền",
      "Tràng Tiền",
      "Hoàn Kiếm",
      "Hà Nội",
      10,
      "Khách thân thiết",
      "Mua đều mỗi tháng",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "customers_template");
  XLSX.writeFile(wb, "customers_import_template.xlsx");
}

async function importCustomersFiles(files: File[]) {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("auth_token") ||
    "";

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("overwrite", "true");

  const res = await fetch(`${API_URL}/imports/customers`, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Import khách hàng thất bại.");
  }

  return data;
}

function getDefaultAddress(item?: CustomerItem | null) {
  if (!item?.addresses?.length) return null;
  return (
    item.addresses.find((address: any) => address.isDefault) ||
    item.addresses[0] ||
    null
  );
}

export default function CustomersPageClient() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [role, setRole] = useState<AppRole>("admin");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(
    null
  );

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importFileNames, setImportFileNames] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const [legacyCode, setLegacyCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customerGroup, setCustomerGroup] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [points, setPoints] = useState("");
  const [source, setSource] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");

  const [editLegacyCode, setEditLegacyCode] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCustomerGroup, setEditCustomerGroup] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editTotalSpent, setEditTotalSpent] = useState("");
  const [editTotalOrders, setEditTotalOrders] = useState("");
  const [editLastOrderAt, setEditLastOrderAt] = useState("");
  const [editDiscountPercent, setEditDiscountPercent] = useState("");
  const [editPricePolicyName, setEditPricePolicyName] = useState("");
  const [editCustomerNote, setEditCustomerNote] = useState("");
  const [editAddressLine1, setEditAddressLine1] = useState("");
  const [editAddressLine2, setEditAddressLine2] = useState("");
  const [editWard, setEditWard] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editCountry, setEditCountry] = useState("Vietnam");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editLabel, setEditLabel] = useState("Mặc định");
  const [editRecipientName, setEditRecipientName] = useState("");

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (currentUser?.role) {
      setRole(currentUser.role);
    }
  }, []);

  const canManageCustomers =
    hasPermission(role, "customers.view") || role === "admin";

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được khách hàng."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((item: any) => {
      return (
        String(item.legacyCode || "").toLowerCase().includes(q) ||
        String(item.fullName || item.name || "").toLowerCase().includes(q) ||
        String(item.phone || "").toLowerCase().includes(q) ||
        String(item.email || "").toLowerCase().includes(q) ||
        String(item.customerGroup || "").toLowerCase().includes(q) ||
        String(item.pricePolicyName || "").toLowerCase().includes(q)
      );
    });
  }, [customers, query]);

  const totalSpent = filteredCustomers.reduce(
    (sum, item: any) => sum + Number(item.totalSpent || 0),
    0
  );

  const totalOrders = filteredCustomers.reduce(
    (sum, item: any) => sum + Number(item.totalOrders || 0),
    0
  );

  const withPhoneCount = filteredCustomers.filter(
    (item: any) => !!String(item.phone || "").trim()
  ).length;

  const vipCount = filteredCustomers.filter((item: any) =>
    String(item.customerGroup || "").toLowerCase().includes("vip")
  ).length;

  const resetCreateForm = () => {
    setLegacyCode("");
    setFullName("");
    setPhone("");
    setEmail("");
    setCustomerGroup("");
    setGender("");
    setBirthDate("");
    setPoints("");
    setSource("");
    setAddressLine1("");
    setWard("");
    setDistrict("");
    setProvince("");
  };

  const resetImportForm = () => {
    setSelectedFiles([]);
    setImportFileNames([]);
    setImportRows([]);
    setImportErrors([]);
  };

  const populateDetailForm = (customer: CustomerItem) => {
    const defaultAddress = getDefaultAddress(customer);

    setEditLegacyCode(String(customer.legacyCode || ""));
    setEditFullName(String(customer.fullName || ""));
    setEditPhone(String(customer.phone || ""));
    setEditEmail(String(customer.email || ""));
    setEditCustomerGroup(String(customer.customerGroup || ""));
    setEditGender(String(customer.gender || ""));
    setEditBirthDate(
      customer.birthDate ? String(customer.birthDate).slice(0, 10) : ""
    );
    setEditPoints(String(customer.points ?? 0));
    setEditTotalSpent(String(Number(customer.totalSpent || 0)));
    setEditTotalOrders(String(Number(customer.totalOrders || 0)));
    setEditLastOrderAt(
      customer.lastOrderAt ? String(customer.lastOrderAt).slice(0, 16) : ""
    );
    setEditDiscountPercent(
      customer.defaultDiscountPercent !== null &&
        customer.defaultDiscountPercent !== undefined
        ? String(customer.defaultDiscountPercent)
        : ""
    );
    setEditPricePolicyName(String(customer.pricePolicyName || ""));
    setEditCustomerNote(String(customer.customerNote || ""));
    setEditAddressLine1(String(defaultAddress?.addressLine1 || ""));
    setEditAddressLine2(String(defaultAddress?.addressLine2 || ""));
    setEditWard(String(defaultAddress?.ward || ""));
    setEditDistrict(String(defaultAddress?.district || ""));
    setEditCity(String(defaultAddress?.city || ""));
    setEditProvince(String(defaultAddress?.province || ""));
    setEditCountry(String(defaultAddress?.country || "Vietnam"));
    setEditPostalCode(String(defaultAddress?.postalCode || ""));
    setEditLabel(String(defaultAddress?.label || "Mặc định"));
    setEditRecipientName(
      String(defaultAddress?.recipientName || customer.fullName || "")
    );
  };

  const handleOpenDetail = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    populateDetailForm(customer);
    setDetailOpen(true);
  };

  const handleCreateCustomer = async () => {
    if (!fullName.trim()) {
      setActionMessage("Chưa nhập tên khách hàng.");
      return;
    }

    if (!legacyCode.trim() && !phone.trim() && !email.trim()) {
      setActionMessage("Cần ít nhất mã khách hàng, số điện thoại hoặc email.");
      return;
    }

    try {
      setCreating(true);
      setActionMessage("");

      const payload: CreateCustomerPayload = {
        legacyCode: legacyCode.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        customerGroup: customerGroup.trim(),
        gender: gender.trim(),
        birthDate: birthDate.trim(),
        points: Number(points || 0),
        source: source.trim(),
        addressLine1: addressLine1.trim(),
        ward: ward.trim(),
        district: district.trim(),
        province: province.trim(),
      };

      await createCustomer(payload);
      setCreateOpen(false);
      resetCreateForm();
      await loadCustomers();
      setActionMessage("Đã tạo khách hàng mới.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không tạo được khách hàng."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedCustomer?.id) return;

    if (!editFullName.trim()) {
      setActionMessage("Tên khách hàng không được để trống.");
      return;
    }

    if (
      !editLegacyCode.trim() &&
      !editPhone.trim() &&
      !editEmail.trim()
    ) {
      setActionMessage("Cần ít nhất mã khách hàng, số điện thoại hoặc email.");
      return;
    }

    try {
      setSavingDetail(true);
      setActionMessage("");

      const payload: UpdateCustomerPayload = {
        legacyCode: editLegacyCode.trim() || undefined,
        fullName: editFullName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        customerGroup: editCustomerGroup.trim() || undefined,
        gender: editGender.trim() || undefined,
        birthDate: editBirthDate.trim() || undefined,
        points: editPoints.trim() ? Number(editPoints) : undefined,
        totalSpent: editTotalSpent.trim() ? Number(editTotalSpent) : undefined,
        totalOrders: editTotalOrders.trim()
          ? Number(editTotalOrders)
          : undefined,
        lastOrderAt: editLastOrderAt.trim() || undefined,
        defaultDiscountPercent: editDiscountPercent.trim()
          ? Number(editDiscountPercent)
          : undefined,
        pricePolicyName: editPricePolicyName.trim() || undefined,
        customerNote: editCustomerNote.trim() || undefined,
        addressLine1: editAddressLine1.trim() || undefined,
        addressLine2: editAddressLine2.trim() || undefined,
        ward: editWard.trim() || undefined,
        district: editDistrict.trim() || undefined,
        city: editCity.trim() || undefined,
        province: editProvince.trim() || undefined,
        country: editCountry.trim() || undefined,
        postalCode: editPostalCode.trim() || undefined,
        label: editLabel.trim() || undefined,
        recipientName: editRecipientName.trim() || undefined,
        isDefaultAddress: true,
      };

      await updateCustomer(selectedCustomer.id, payload);
      await loadCustomers();
      setDetailOpen(false);
      setSelectedCustomer(null);
      setActionMessage("Đã cập nhật khách hàng.");
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Không cập nhật được khách hàng."
      );
    } finally {
      setSavingDetail(false);
    }
  };

  const parseCustomerRows = (rows: ParsedRow[]) => {
    const errors: string[] = [];

    const normalized = rows
      .map((row, index) => {
        const previewRow: ImportPreviewRow = {
          legacyCode: findValue(row, [
            "Mã khách hàng",
            "customer code",
            "code",
            "ma khach hang",
            "mã khách hàng",
            "ma kh",
            "mã kh",
          ]),
          fullName: findValue(row, [
            "Tên khách hàng",
            "full name",
            "customer name",
            "name",
            "ho ten",
            "họ tên",
            "ten",
          ]),
          phone: findValue(row, [
            "Điện thoại",
            "phone",
            "mobile",
            "sdt",
            "so dien thoai",
            "số điện thoại",
          ]),
          email: findValue(row, ["Email", "email", "e-mail"]),
          customerGroup: findValue(row, [
            "Mã nhóm khách hàng",
            "Nhóm khách hàng",
            "customer group",
            "group",
          ]),
          gender: findValue(row, ["Giới tính", "gender", "gioi tinh"]),
          birthDate: findValue(row, [
            "Ngày sinh",
            "birthdate",
            "birthday",
            "ngay sinh",
            "dob",
          ]),
          points: normalizeNumber(
            findValue(row, ["Điểm hiện tại", "points", "diem", "point"])
          ),
          totalSpent: normalizeNumber(
            findValue(row, ["Tổng chi tiêu", "total spent", "tong chi tieu"])
          ),
          totalOrders: normalizeNumber(
            findValue(row, ["SL đơn hàng", "total orders", "so don", "sl don hang"])
          ),
          lastOrderAt: findValue(row, [
            "Ngày mua cuối cùng",
            "last order at",
            "ngay mua cuoi cung",
          ]),
          addressLine1: findValue(row, ["Địa chỉ", "address", "dia chi"]),
          ward: findValue(row, ["Phường xã", "ward", "phuong xa", "phuong", "xa"]),
          district: findValue(row, [
            "Quận huyện",
            "district",
            "quan huyen",
            "quan",
            "huyen",
          ]),
          province: findValue(row, [
            "Tỉnh thành",
            "province",
            "city",
            "tinh thanh",
            "tinh",
          ]),
        };

        if (!previewRow.fullName) {
          errors.push(`Dòng ${index + 2}: thiếu Tên khách hàng`);
        }

        if (!previewRow.legacyCode && !previewRow.phone && !previewRow.email) {
          errors.push(`Dòng ${index + 2}: thiếu Mã khách hàng, SĐT và Email`);
        }

        return previewRow;
      })
      .filter((item) => item.fullName || item.legacyCode || item.phone || item.email);

    return { normalized, errors };
  };

  const handleImportFiles = async (files: FileList | null) => {
    const pickedFiles = Array.from(files || []);
    setSelectedFiles(pickedFiles);
    setImportFileNames(pickedFiles.map((f) => f.name));
    setImportRows([]);
    setImportErrors([]);

    if (!pickedFiles.length) return;

    const previewRows: ImportPreviewRow[] = [];
    const previewErrors: string[] = [];

    for (const file of pickedFiles) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: "",
        });

        const headerRowIndex = detectHeaderRowIndex(sheetData);

        if (headerRowIndex === -1) {
          previewErrors.push(`${file.name}: không tìm thấy dòng tiêu đề hợp lệ.`);
          continue;
        }

        const rawRows = buildRowsFromSheetData(sheetData, headerRowIndex).filter(
          (row) =>
            Object.values(row).some(
              (value) => String(value ?? "").trim() !== ""
            )
        );

        if (!rawRows.length) {
          previewErrors.push(`${file.name}: file không có dữ liệu.`);
          continue;
        }

        const { normalized, errors } = parseCustomerRows(rawRows);
        previewRows.push(...normalized.slice(0, 30));
        previewErrors.push(...errors.slice(0, 30));
      } catch {
        previewErrors.push(`${file.name}: không đọc được file.`);
      }
    }

    setImportRows(previewRows);
    setImportErrors(previewErrors);
  };

  const handleCommitImport = async () => {
    if (!selectedFiles.length) {
      setActionMessage("Chưa có file để import.");
      return;
    }

    try {
      setImporting(true);
      setActionMessage("");

      const result = await importCustomersFiles(selectedFiles);
      await loadCustomers();
      setImportOpen(false);

      const filesCount = result?.results?.length || selectedFiles.length;
      const successCount = (result?.results || []).reduce(
        (sum: number, item: any) => sum + Number(item.successRows || 0),
        0
      );
      const failedCount = (result?.results || []).reduce(
        (sum: number, item: any) => sum + Number(item.failedRows || 0),
        0
      );

      resetImportForm();
      setActionMessage(
        `Đã import ${filesCount} file. Thành công ${successCount} dòng, lỗi ${failedCount} dòng.`
      );
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Import khách hàng thất bại."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <SectionTitle
        title="Khách hàng"
        description="Quản lý dữ liệu khách, tìm kiếm nhanh, import excel và theo dõi nhóm khách giá trị cao."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setImportOpen(true)}
              className="rounded-full"
            >
              Nhập Excel
            </Button>

            <RoleGuard permission="customers.view">
              <Button
                onClick={() => setCreateOpen(true)}
                className="rounded-full"
              >
                + Thêm khách hàng
              </Button>
            </RoleGuard>
          </div>
        }
      />

      {!canManageCustomers ? (
        <Panel className="p-4">
          <p className="text-sm text-amber-700">
            Role hiện tại: <strong>{role}</strong>. Một số thao tác khách hàng
            đang bị giới hạn.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tổng khách"
          value={filteredCustomers.length}
          sub="Đang hiển thị theo bộ lọc"
        />
        <StatCard
          title="Khách VIP"
          value={vipCount}
          sub="Nhóm khách có chứa VIP"
        />
        <StatCard
          title="Có số điện thoại"
          value={withPhoneCount}
          sub="Khách có dữ liệu liên hệ"
        />
        <StatCard
          title="Tổng chi tiêu"
          value={currency(totalSpent)}
          sub={`Tổng ${totalOrders} đơn hàng`}
        />
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mã KH, tên, số điện thoại, email, nhóm khách..."
          />
          <div className="flex items-center justify-end text-sm text-neutral-500">
            {filteredCustomers.length} khách hàng
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {actionMessage ? (
        <Panel className="p-4">
          <p className="text-sm text-neutral-700">{actionMessage}</p>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 font-medium text-neutral-600">Mã KH</th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Khách hàng
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Liên hệ
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Nhóm KH
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Chính sách
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">Điểm</th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Chi tiêu
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Đơn hàng
                </th>
                <th className="px-4 py-3 font-medium text-neutral-600">
                  Mua cuối
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-neutral-500">
                    Đang tải khách hàng...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-neutral-500">
                    Không có khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((item: any) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-neutral-200 transition hover:bg-neutral-50"
                    onClick={() => handleOpenDetail(item)}
                  >
                    <td className="px-4 py-4">
                      <span className="font-medium text-neutral-900">
                        {item.legacyCode || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-neutral-900">
                        {item.fullName || item.name}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {item.gender || "—"}
                        {item.birthDate
                          ? ` · ${formatDate(item.birthDate)}`
                          : ""}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div>{item.phone || "—"}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {item.email || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {item.customerGroup ? (
                        <Badge tone="blue">{item.customerGroup}</Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-sm text-neutral-900">
                        {item.pricePolicyName || "—"}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {item.defaultDiscountPercent !== null &&
                        item.defaultDiscountPercent !== undefined
                          ? `${item.defaultDiscountPercent}%`
                          : "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">{Number(item.points || 0)}</td>

                    <td className="px-4 py-4">
                      {currency(Number(item.totalSpent || 0))}
                    </td>

                    <td className="px-4 py-4">
                      {Number(item.totalOrders || 0)}
                    </td>

                    <td className="px-4 py-4">
                      {formatDate(item.lastOrderAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Nhập khách hàng từ Excel"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={downloadCustomerTemplate}>
              Tải file mẫu
            </Button>
            {importFileNames.length ? (
              <Badge tone="blue">{importFileNames.length} file đã chọn</Badge>
            ) : null}
          </div>

          <Panel className="p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-800">
                  Upload file Excel
                </p>
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={async (e) => {
                    await handleImportFiles(e.target.files);
                  }}
                  className="block w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm"
                />
                <div className="mt-2 text-xs text-neutral-500">
                  {importFileNames.length ? (
                    <div className="space-y-1">
                      {importFileNames.map((name) => (
                        <div key={name}>{name}</div>
                      ))}
                    </div>
                  ) : (
                    "Hỗ trợ .xlsx, .xls, .csv. Có thể chọn nhiều file cùng lúc."
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={resetImportForm}>
                  Reset
                </Button>
                <Button
                  onClick={() => void handleCommitImport()}
                  disabled={importing || !selectedFiles.length}
                >
                  {importing ? "Đang import..." : "Import thật"}
                </Button>
              </div>
            </div>
          </Panel>

          {importErrors.length > 0 ? (
            <Panel className="border-red-200 p-4">
              <p className="mb-3 text-sm font-medium text-red-700">
                Cảnh báo dữ liệu preview
              </p>
              <div className="space-y-2">
                {importErrors.slice(0, 20).map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {item}
                  </div>
                ))}
                {importErrors.length > 20 ? (
                  <div className="text-xs text-neutral-500">
                    Còn {importErrors.length - 20} cảnh báo khác...
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Preview dữ liệu
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {importRows.length} dòng preview đầu tiên
                </p>
              </div>
              {importRows.length ? (
                <Badge tone="blue">Sẵn sàng import</Badge>
              ) : null}
            </div>

            {!importRows.length ? (
              <p className="text-sm text-neutral-500">
                Chưa có dữ liệu preview.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      {Object.keys(importRows[0]).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-3 font-medium text-neutral-600"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, idx) => (
                      <tr key={idx} className="border-t border-neutral-200">
                        {Object.keys(importRows[0]).map((key) => (
                          <td
                            key={key}
                            className="px-3 py-3 align-top text-neutral-700"
                          >
                            {String((row as any)[key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo khách hàng mới"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={legacyCode}
              onChange={(e) => setLegacyCode(e.target.value)}
              placeholder="Mã khách hàng"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tên khách hàng"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Số điện thoại"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={customerGroup}
              onChange={(e) => setCustomerGroup(e.target.value)}
              placeholder="Nhóm khách hàng"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Nguồn"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              placeholder="Ngày sinh"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Giới tính"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Điểm hiện tại"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none md:col-span-3"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Địa chỉ"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              placeholder="Phường / Xã"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Quận / Huyện"
            />
            <input
              className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Tỉnh / Thành"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Đóng
            </Button>
            <Button onClick={() => void handleCreateCustomer()} disabled={creating}>
              {creating ? "Đang lưu..." : "Lưu khách hàng"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết khách hàng"
      >
        {!selectedCustomer ? null : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Tổng chi tiêu"
                value={currency(Number(selectedCustomer.totalSpent || 0))}
                sub="Giá trị khách hàng"
              />
              <StatCard
                title="Tổng đơn"
                value={Number(selectedCustomer.totalOrders || 0)}
                sub="Số đơn đã mua"
              />
              <StatCard
                title="Điểm hiện tại"
                value={Number(selectedCustomer.points || 0)}
                sub="Điểm tích lũy"
              />
              <StatCard
                title="Giảm mặc định"
                value={
                  selectedCustomer.defaultDiscountPercent !== null &&
                  selectedCustomer.defaultDiscountPercent !== undefined
                    ? `${selectedCustomer.defaultDiscountPercent}%`
                    : "—"
                }
                sub="Chính sách riêng"
              />
            </div>

            <Panel className="p-5">
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-neutral-900">
                  Thông tin cơ bản
                </h4>
                <p className="mt-1 text-sm text-neutral-500">
                  Sửa trực tiếp hồ sơ khách hàng và chính sách áp dụng.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editLegacyCode}
                  onChange={(e) => setEditLegacyCode(e.target.value)}
                  placeholder="Mã khách hàng"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Tên khách hàng"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Số điện thoại"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editCustomerGroup}
                  onChange={(e) => setEditCustomerGroup(e.target.value)}
                  placeholder="Nhóm khách hàng"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  placeholder="Giới tính"
                />
                <input
                  type="date"
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                />
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-neutral-900">
                  Chính sách khách hàng
                </h4>
                <p className="mt-1 text-sm text-neutral-500">
                  Thiết lập chiết khấu và chính sách giá riêng cho khách này.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editPoints}
                  onChange={(e) => setEditPoints(e.target.value)}
                  placeholder="Điểm hiện tại"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editTotalSpent}
                  onChange={(e) => setEditTotalSpent(e.target.value)}
                  placeholder="Tổng chi tiêu"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editTotalOrders}
                  onChange={(e) => setEditTotalOrders(e.target.value)}
                  placeholder="Tổng đơn"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editDiscountPercent}
                  onChange={(e) => setEditDiscountPercent(e.target.value)}
                  placeholder="Chiết khấu mặc định (%)"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editPricePolicyName}
                  onChange={(e) => setEditPricePolicyName(e.target.value)}
                  placeholder="Tên chính sách giá"
                />
                <input
                  type="datetime-local"
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editLastOrderAt}
                  onChange={(e) => setEditLastOrderAt(e.target.value)}
                />
              </div>

              <div className="mt-4">
                <textarea
                  className="min-h-[120px] w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editCustomerNote}
                  onChange={(e) => setEditCustomerNote(e.target.value)}
                  placeholder="Ghi chú nội bộ về khách hàng"
                />
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-neutral-900">
                  Địa chỉ mặc định
                </h4>
                <p className="mt-1 text-sm text-neutral-500">
                  Địa chỉ này sẽ dùng khi tạo đơn nhanh cho khách hàng.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Nhãn địa chỉ"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editRecipientName}
                  onChange={(e) => setEditRecipientName(e.target.value)}
                  placeholder="Người nhận"
                />
              </div>

              <div className="mt-4 grid gap-4">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editAddressLine1}
                  onChange={(e) => setEditAddressLine1(e.target.value)}
                  placeholder="Địa chỉ dòng 1"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editAddressLine2}
                  onChange={(e) => setEditAddressLine2(e.target.value)}
                  placeholder="Địa chỉ dòng 2"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editWard}
                  onChange={(e) => setEditWard(e.target.value)}
                  placeholder="Phường / Xã"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value)}
                  placeholder="Quận / Huyện"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Thành phố"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editProvince}
                  onChange={(e) => setEditProvince(e.target.value)}
                  placeholder="Tỉnh / Thành"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  placeholder="Quốc gia"
                />
                <input
                  className="rounded-2xl border border-neutral-300 px-4 py-3 outline-none"
                  value={editPostalCode}
                  onChange={(e) => setEditPostalCode(e.target.value)}
                  placeholder="Mã bưu điện"
                />
              </div>
            </Panel>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDetailOpen(false)}>
                Đóng
              </Button>
              <Button
                onClick={() => void handleSaveDetail()}
                disabled={savingDetail}
              >
                {savingDetail ? "Đang lưu..." : "Lưu cập nhật"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}