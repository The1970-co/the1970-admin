"use client";

import { API_BASE } from "@/lib/api-base";
import { useMemo, useState, type ReactNode } from "react";

const ISSUE_LABELS: Record<string, string> = {
  NOT_FOUND_INTERNAL_ORDER: "Chưa tìm thấy đơn nội bộ",
  PARTIAL_RETURN: "Có mã hoàn _PR",
  MISSING_PARTIAL_DELIVERY_RECORD: "Thiếu phiếu giao 1 phần",
  PARTIAL_DELIVERY_AMOUNT_MISMATCH: "Lệch tiền phiếu giao 1 phần",
  MATCHED_BY_PARTIAL_DELIVERY: "Khớp qua phiếu giao 1 phần",
  PARTIAL_RETURN_NOT_RECEIVED: "Chưa nhập kho hàng hoàn",
  COD_MISMATCH: "Lệch COD",
  FEE_MISMATCH: "Lệch phí",
};

const ALL_GHN_STATUSES = "__ALL_GHN_STATUSES__";
const DELIVERED_ONLY = "__DELIVERED_ONLY__";

type Row = {
  rowNumber: number;
  ghnOrderCode?: string;
  customerOrderCode?: string;
  systemOrderCode?: string | null;
  internalOrderId?: string | null;
  systemOrderStatus?: string | null;
  storeName?: string;
  recipientName?: string;
  ghnStatus?: string;
  codAmount: number;
  serviceFee: number;
  totalReconcileAmount: number;
  systemCodAmount?: number;
  systemShippingFee?: number;

  hasPrInFile?: boolean;
  partialDeliveryRecordId?: string | null;
  partialDeliveryAdjustedCod?: number;
  partialDeliveryOriginalCod?: number;
  partialDeliveryMatched?: boolean;
  partialReturnReceived?: boolean | null;
  partialReturnReceivedAt?: string | null;

  issueTypes: string[];
};

type Result = {
  batch: {
    fileName: string;
    transferCode?: string;
    transferDate?: string;
    totalRows: number;
    matchedRows: number;
    mismatchRows: number;
    totalCodAmount: number;
    totalFeeAmount: number;
    totalNetAmount: number;
    parserMode?: string;
  };
  rows: Row[];
  summary: {
    notFoundOrder: number;
    codMismatch: number;
    feeMismatch: number;
    partialReturn: number;
    matchedByPartialDelivery?: number;
    partialReturnNotReceived?: number;
    noMoney: number;
  };
};

type ExcelStatusOption = {
  label: string;
  value: string;
  count: number;
  delivered: boolean;
};

type ExcelPreview = {
  fileName: string;
  sheetName: string;
  headerRowIndex: number;
  statusColumnIndex: number;
  totalStatusRows: number;
  statusOptions: ExcelStatusOption[];
};

export default function GhnCodReconciliationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [transferDate, setTransferDate] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelPreview | null>(null);
  const [excelPreviewError, setExcelPreviewError] = useState("");
  const [uploadStatusFilter, setUploadStatusFilter] = useState(DELIVERED_ONLY);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState("ALL");

  const uploadFilterSummary = useMemo(() => {
    if (!excelPreview) {
      return {
        selectedRows: 0,
        totalRows: 0,
        selectedLabel: "Chưa đọc file",
      };
    }

    if (uploadStatusFilter === ALL_GHN_STATUSES) {
      return {
        selectedRows: excelPreview.totalStatusRows,
        totalRows: excelPreview.totalStatusRows,
        selectedLabel: "Tất cả trạng thái",
      };
    }

    if (uploadStatusFilter === DELIVERED_ONLY) {
      const selectedRows = excelPreview.statusOptions
        .filter((item) => item.delivered)
        .reduce((sum, item) => sum + item.count, 0);

      return {
        selectedRows,
        totalRows: excelPreview.totalStatusRows,
        selectedLabel: "Chỉ đơn giao thành công",
      };
    }

    const selectedOption = excelPreview.statusOptions.find(
      (item) => item.value === uploadStatusFilter
    );

    return {
      selectedRows: selectedOption?.count || 0,
      totalRows: excelPreview.totalStatusRows,
      selectedLabel: selectedOption?.label || uploadStatusFilter,
    };
  }, [excelPreview, uploadStatusFilter]);

  const rows = useMemo(() => {
    if (!result) return [];

    if (filter === "ALL") return result.rows;

    if (filter === "MATCHED") {
      return result.rows.filter((r) => r.issueTypes.length === 0);
    }

    return result.rows.filter((r) => r.issueTypes.includes(filter));
  }, [result, filter]);

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    setFilter("ALL");
    setExcelPreview(null);
    setExcelPreviewError("");
    setUploadStatusFilter(DELIVERED_ONLY);

    if (!nextFile) return;

    setParsingExcel(true);
    try {
      const preview = await readGhnExcelPreview(nextFile);
      setExcelPreview(preview);

      const hasDeliveredStatus = preview.statusOptions.some((item) => item.delivered);
      setUploadStatusFilter(hasDeliveredStatus ? DELIVERED_ONLY : ALL_GHN_STATUSES);
    } catch (err) {
      setExcelPreviewError(
        err instanceof Error
          ? err.message
          : "Không đọc được trạng thái GHN trong file Excel."
      );
      setUploadStatusFilter(ALL_GHN_STATUSES);
    } finally {
      setParsingExcel(false);
    }
  }

  async function uploadAndRun() {
    if (!file) {
      alert("Chọn file Excel GHN trước.");
      return;
    }

    if (uploadStatusFilter !== ALL_GHN_STATUSES && excelPreviewError) {
      alert("Chưa đọc được danh sách trạng thái trong file. Chọn lại file hoặc đổi bộ lọc thành Tất cả trạng thái.");
      return;
    }

    if (uploadStatusFilter !== ALL_GHN_STATUSES && excelPreview && uploadFilterSummary.selectedRows <= 0) {
      alert("Bộ lọc hiện tại không có dòng nào để gửi đối soát.");
      return;
    }

    const uploadFile = await buildFilteredGhnExcelFile(file, uploadStatusFilter, excelPreview);

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("transferDate", transferDate);
    fd.append("transferCode", transferCode);
    fd.append("note", note);
    fd.append("clientStatusFilter", uploadFilterSummary.selectedLabel);
    fd.append("clientFilteredRows", String(uploadFilterSummary.selectedRows));
    fd.append("clientTotalStatusRows", String(uploadFilterSummary.totalRows));

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/finance/ghn-cod-reconciliation/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Upload thất bại.");
      }

      setResult(json);
      setFilter("ALL");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-neutral-500">Tài chính / Đối soát COD GHN</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
          Đối soát COD GHN
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Upload file phiên chuyển tiền từ GHN, đọc tổng tiền đầu file và đối chiếu với đơn nội bộ.
        </p>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-950">
          1. Upload file phiên chuyển tiền GHN
        </h2>

        <div className="mt-4 grid gap-5 lg:grid-cols-[360px_1fr_auto]">
          <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center">
            <div className="text-sm font-medium text-neutral-800">
              Kéo thả file Excel vào đây
            </div>
            <div className="mt-1 text-sm text-neutral-500">hoặc</div>
            <div className="mt-3 rounded-xl border bg-white px-4 py-2 text-sm">
              Chọn file
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.numbers"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            {file ? (
              <div className="mt-3 max-w-[300px] truncate text-xs text-neutral-500">
                {file.name}
              </div>
            ) : null}
          </label>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Ngày chuyển tiền">
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </Field>

              <Field label="Mã phiên / mã đối soát">
                <input
                  value={transferCode}
                  onChange={(e) => setTransferCode(e.target.value)}
                  placeholder="Để trống sẽ tự đọc từ file"
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </Field>

              <Field label="Ghi chú">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú..."
                  className="w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Lọc trạng thái GHN trước khi gửi core">
                  <select
                    value={uploadStatusFilter}
                    onChange={(e) => setUploadStatusFilter(e.target.value)}
                    disabled={!file || parsingExcel}
                    className="min-w-[280px] rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value={DELIVERED_ONLY}>Chỉ đơn giao thành công</option>
                    <option value={ALL_GHN_STATUSES}>Tất cả trạng thái trong file</option>
                    {excelPreview?.statusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
                  <div className="text-xs font-semibold text-neutral-500">Sẽ gửi đối soát</div>
                  <div className="mt-1 font-bold text-neutral-950">
                    {parsingExcel
                      ? "Đang đọc file..."
                      : `${uploadFilterSummary.selectedRows} / ${uploadFilterSummary.totalRows} dòng có trạng thái`}
                  </div>
                </div>

                {excelPreview ? (
                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
                    <div className="text-xs font-semibold text-neutral-500">Sheet / dòng tiêu đề</div>
                    <div className="mt-1 font-semibold text-neutral-950">
                      {excelPreview.sheetName} · dòng {excelPreview.headerRowIndex + 1}
                    </div>
                  </div>
                ) : null}
              </div>

              {excelPreviewError ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  {excelPreviewError} File sẽ được gửi nguyên bản nếu chọn “Tất cả trạng thái”.
                </div>
              ) : null}

              {uploadStatusFilter === ALL_GHN_STATUSES && file ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  Đang chọn tất cả trạng thái, hệ thống sẽ gửi cả đơn đang trung chuyển / nhập kho / hoàn lên đối soát. Chỉ dùng khi cần kiểm tra toàn bộ file.
                </div>
              ) : null}

              {uploadStatusFilter === DELIVERED_ONLY && file ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Mặc định chỉ gửi các dòng GHN có trạng thái giao thành công. Core giữ nguyên, FE sẽ tạo file Excel đã lọc rồi mới upload.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end justify-center gap-3">
            <button
              onClick={uploadAndRun}
              disabled={loading || parsingExcel}
              className="rounded-2xl bg-neutral-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Đang đối soát..." : parsingExcel ? "Đang đọc file..." : "Chạy đối soát"}
            </button>

            <button
              onClick={() => {
                setFile(null);
                setResult(null);
                setTransferCode("");
                setTransferDate("");
                setNote("");
                setFilter("ALL");
                setExcelPreview(null);
                setExcelPreviewError("");
                setUploadStatusFilter(DELIVERED_ONLY);
              }}
              className="text-sm text-blue-600"
            >
              Xóa dữ liệu
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-5">
        <Stat
          title="Tổng đối soát GHN"
          value={money(result?.batch.totalCodAmount)}
          sub={result ? "Lấy từ summary file GHN" : "Chưa upload file"}
        />
        <Stat
          title="Phí chuyển khoản"
          value={money(result?.batch.totalFeeAmount)}
          sub="Theo file GHN"
          danger={(result?.batch.totalFeeAmount || 0) < 0}
        />
        <Stat
          title="Thực nhận"
          value={money(result?.batch.totalNetAmount)}
          sub="Sau phí chuyển khoản"
        />
        <Stat
          title="Không tìm thấy đơn"
          value={String(result?.summary.notFoundOrder || 0)}
          sub="Chưa có trong nội bộ"
          danger={(result?.summary.notFoundOrder || 0) > 0}
        />
        <Stat
          title="Trạng thái"
          value={result ? (result.batch.mismatchRows > 0 ? "Cần kiểm tra" : "Khớp") : "-"}
          sub={result ? `${result.batch.mismatchRows} dòng cần xử lý` : "Chưa có dữ liệu"}
          danger={(result?.batch.mismatchRows || 0) > 0}
        />
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">2. Tổng quan đối soát</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-8">
          <Mini label="Tổng dòng" value={result?.batch.totalRows || 0} />
          <Mini label="Khớp" value={result?.batch.matchedRows || 0} ok />
          <Mini label="Chưa khớp" value={result?.batch.mismatchRows || 0} danger />
          <Mini label="Không tìm thấy đơn" value={result?.summary.notFoundOrder || 0} danger />
          <Mini label="Lệch COD" value={result?.summary.codMismatch || 0} warn />
          <Mini label="Lệch phí" value={result?.summary.feeMismatch || 0} warn />
          <Mini label="Giao 1 phần" value={result?.summary.partialReturn || 0} warn />
          <Mini label="Chưa nhập kho hoàn" value={result?.summary.partialReturnNotReceived || 0} warn />
        </div>
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">3. Danh sách đối soát</h2>

          <div className="flex flex-wrap gap-2">
            <Filter active={filter === "ALL"} onClick={() => setFilter("ALL")}>
              Tất cả
            </Filter>
            <Filter active={filter === "MATCHED"} onClick={() => setFilter("MATCHED")}>
              Khớp
            </Filter>
            <Filter
              active={filter === "NOT_FOUND_INTERNAL_ORDER"}
              onClick={() => setFilter("NOT_FOUND_INTERNAL_ORDER")}
            >
              Không tìm thấy đơn
            </Filter>
            <Filter active={filter === "COD_MISMATCH"} onClick={() => setFilter("COD_MISMATCH")}>
              Lệch COD
            </Filter>
            <Filter active={filter === "FEE_MISMATCH"} onClick={() => setFilter("FEE_MISMATCH")}>
              Lệch phí
            </Filter>
            <Filter active={filter === "PARTIAL_RETURN"} onClick={() => setFilter("PARTIAL_RETURN")}>
              Giao 1 phần
            </Filter>
            <Filter
              active={filter === "PARTIAL_RETURN_NOT_RECEIVED"}
              onClick={() => setFilter("PARTIAL_RETURN_NOT_RECEIVED")}
            >
              Chưa nhập kho hoàn
            </Filter>
            <Filter
              active={filter === "MATCHED_BY_PARTIAL_DELIVERY"}
              onClick={() => setFilter("MATCHED_BY_PARTIAL_DELIVERY")}
            >
              Khớp qua giao 1 phần
            </Filter>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-2xl border">
          <table className="min-w-[1550px] w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Đơn nội bộ</th>
                <th className="px-4 py-3">Mã đơn KH trong file</th>
                <th className="px-4 py-3">Mã đơn GHN</th>
                <th className="px-4 py-3">Cửa hàng</th>
                <th className="px-4 py-3">Trạng thái GHN</th>
                <th className="px-4 py-3 text-right">COD GHN</th>
                <th className="px-4 py-3 text-right">Phí GHN</th>
                <th className="px-4 py-3 text-right">Tổng đối soát</th>
                <th className="px-4 py-3">Tình trạng</th>
                <th className="px-4 py-3">Vấn đề</th>
                <th className="px-4 py-3">Hoàn / giao 1 phần</th>
              </tr>
            </thead>

            <tbody>
              {rows.length ? (
                rows.map((row, index) => {
                  const fee = Number(row.serviceFee || 0);
                  const isMatchedByPartial = row.issueTypes.includes("MATCHED_BY_PARTIAL_DELIVERY");
                  const blockingIssues = row.issueTypes.filter(
                    (x) => x !== "MATCHED_BY_PARTIAL_DELIVERY"
                  );
                  const hasIssue = blockingIssues.length > 0;

                  return (
                    <tr key={`${row.rowNumber}-${index}`} className="border-t align-top">
                      <td className="px-4 py-3">{index + 1}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {row.systemOrderCode || "Chưa có"}
                        </div>
                        {row.systemOrderStatus ? (
                          <div className="mt-1 text-xs text-neutral-500">
                            {row.systemOrderStatus}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">{row.customerOrderCode || "-"}</td>
                      <td className="px-4 py-3 font-medium">{row.ghnOrderCode || "-"}</td>
                      <td className="px-4 py-3">{row.storeName || "-"}</td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
                          {row.ghnStatus || "-"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">{money(row.codAmount)}</td>
                      <td className="px-4 py-3 text-right">{money(fee)}</td>
                      <td className="px-4 py-3 text-right">
                        {money(row.totalReconcileAmount)}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          isMatchedByPartial={isMatchedByPartial}
                          hasIssue={hasIssue}
                        />
                      </td>

                      <td className="px-4 py-3">
                        {row.issueTypes.length
                          ? row.issueTypes.map((x) => ISSUE_LABELS[x] || x).join(", ")
                          : "Khớp"}
                      </td>

                      <td className="px-4 py-3">
                        {row.issueTypes.includes("PARTIAL_RETURN") || row.hasPrInFile ? (
                          <div className="space-y-1">
                            <div className="font-medium text-amber-700">Có mã _PR</div>

                            {row.partialDeliveryRecordId ? (
                              <div className="text-xs text-neutral-600">
                                Phiếu giao 1 phần: {row.partialDeliveryRecordId}
                              </div>
                            ) : (
                              <div className="text-xs text-red-600">
                                Chưa tìm thấy phiếu giao 1 phần
                              </div>
                            )}

                            {row.partialDeliveryAdjustedCod ? (
                              <div className="text-xs text-neutral-600">
                                Tiền phiếu: {money(row.partialDeliveryAdjustedCod)}
                              </div>
                            ) : null}

                            {row.partialReturnReceived === true ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                                Đã nhập kho hoàn
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                Chưa nhập kho hoàn
                              </span>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-neutral-500">
                    Chưa có dữ liệu. Upload file GHN để chạy đối soát.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({
  isMatchedByPartial,
  hasIssue,
}: {
  isMatchedByPartial: boolean;
  hasIssue: boolean;
}) {
  if (isMatchedByPartial && !hasIssue) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
        Khớp qua giao 1 phần
      </span>
    );
  }

  if (hasIssue) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
        Cần kiểm tra
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
      Khớp
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <div className="mb-2 text-sm text-neutral-500">{label}</div>
      {children}
    </label>
  );
}

function Stat({
  title,
  value,
  sub,
  danger,
}: {
  title: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[24px] border bg-white p-5 shadow-sm">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className={`mt-3 text-2xl font-semibold ${danger ? "text-red-600" : "text-neutral-950"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{sub}</div>
    </div>
  );
}

function Mini({
  label,
  value,
  ok,
  warn,
  danger,
}: {
  label: string;
  value: number;
  ok?: boolean;
  warn?: boolean;
  danger?: boolean;
}) {
  const cls = ok
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : danger
      ? "bg-red-50 text-red-700 border-red-100"
      : warn
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-neutral-50 text-neutral-800 border-neutral-200";

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-sm">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Filter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm ${
        active ? "bg-neutral-950 text-white" : "border bg-white text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}

function money(value?: number | null) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}

async function readGhnExcelPreview(file: File): Promise<ExcelPreview> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("File Excel không có sheet dữ liệu.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const headerInfo = findGhnStatusHeader(matrix);

  if (!headerInfo) {
    throw new Error("Không tìm thấy cột trạng thái GHN trong file Excel.");
  }

  const statusCount = new Map<string, number>();

  for (let index = headerInfo.headerRowIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] || [];
    const status = cleanCell(row[headerInfo.statusColumnIndex]);

    if (!status) continue;

    statusCount.set(status, (statusCount.get(status) || 0) + 1);
  }

  const statusOptions = Array.from(statusCount.entries())
    .map(([label, count]) => ({
      label,
      value: label,
      count,
      delivered: isDeliveredGhnStatus(label),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));

  return {
    fileName: file.name,
    sheetName,
    headerRowIndex: headerInfo.headerRowIndex,
    statusColumnIndex: headerInfo.statusColumnIndex,
    totalStatusRows: statusOptions.reduce((sum, item) => sum + item.count, 0),
    statusOptions,
  };
}

async function buildFilteredGhnExcelFile(
  file: File,
  statusFilter: string,
  preview: ExcelPreview | null
): Promise<File> {
  if (statusFilter === ALL_GHN_STATUSES || !preview) {
    return file;
  }

  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) return file;

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const filteredMatrix = matrix.filter((row, index) => {
    if (index <= preview.headerRowIndex) return true;

    const status = cleanCell(row?.[preview.statusColumnIndex]);

    // Giữ lại các dòng không có trạng thái để không làm mất các dòng ghi chú/tổng hợp nếu file GHN có footer.
    if (!status) return true;

    return shouldKeepGhnStatus(status, statusFilter);
  });

  const nextWorkbook = XLSX.utils.book_new();
  const nextSheet = XLSX.utils.aoa_to_sheet(filteredMatrix);
  XLSX.utils.book_append_sheet(nextWorkbook, nextSheet, sheetName);

  const output = XLSX.write(nextWorkbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new File([blob], getFilteredFileName(file.name, statusFilter), {
    type: blob.type,
  });
}

function findGhnStatusHeader(matrix: unknown[][]) {
  let bestMatch: { headerRowIndex: number; statusColumnIndex: number; score: number } | null = null;

  matrix.forEach((row, rowIndex) => {
    const cells = row.map((cell) => normalizeText(cell));
    const statusColumnIndex = cells.findIndex((cell) => isLikelyGhnStatusHeader(cell));

    if (statusColumnIndex < 0) return;

    const joined = cells.join(" ");
    let score = 1;

    if (joined.includes("ma don")) score += 2;
    if (joined.includes("cod")) score += 2;
    if (joined.includes("phi")) score += 1;
    if (joined.includes("cua hang") || joined.includes("shop")) score += 1;
    if (joined.includes("ghn")) score += 1;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { headerRowIndex: rowIndex, statusColumnIndex, score };
    }
  });

  if (!bestMatch) return null;

  return {
    headerRowIndex: bestMatch.headerRowIndex,
    statusColumnIndex: bestMatch.statusColumnIndex,
  };
}

function isLikelyGhnStatusHeader(normalizedCell: string) {
  if (!normalizedCell) return false;

  return (
    normalizedCell === "trang thai" ||
    normalizedCell.includes("trang thai ghn") ||
    normalizedCell.includes("trang thai don") ||
    normalizedCell.includes("trang thai giao") ||
    normalizedCell.includes("status")
  );
}

function shouldKeepGhnStatus(status: string, statusFilter: string) {
  if (statusFilter === ALL_GHN_STATUSES) return true;
  if (statusFilter === DELIVERED_ONLY) return isDeliveredGhnStatus(status);

  return cleanCell(status) === cleanCell(statusFilter);
}

function isDeliveredGhnStatus(value: unknown) {
  const text = normalizeText(value);

  return (
    text.includes("giao thanh cong") ||
    text.includes("da giao") ||
    text.includes("delivered") ||
    text.includes("completed") ||
    text.includes("delivery success") ||
    text.includes("thanh cong")
  );
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: unknown) {
  return cleanCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getFilteredFileName(fileName: string, statusFilter: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;

  const suffix = statusFilter === DELIVERED_ONLY ? "giao-thanh-cong" : slugify(statusFilter);

  return `${baseName}-filtered-${suffix}.xlsx`;
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ghn-status";
}
