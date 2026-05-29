"use client";

import Link from "next/link";
import { API_BASE } from "@/lib/api-base";
import { useEffect, useMemo, useState } from "react";

const ISSUE_LABELS: Record<string, string> = {
  NOT_FOUND_INTERNAL_ORDER: "Không tìm thấy đơn",
  PARTIAL_RETURN: "Có mã hoàn _PR",
  MISSING_PARTIAL_DELIVERY_RECORD: "Thiếu phiếu giao 1 phần",
  PARTIAL_DELIVERY_AMOUNT_MISMATCH: "Lệch tiền giao 1 phần",
  MATCHED_BY_PARTIAL_DELIVERY: "Khớp qua giao 1 phần",
  PARTIAL_RETURN_NOT_RECEIVED: "Chưa nhập kho hoàn",
  COD_MISMATCH: "Lệch COD",
  FEE_MISMATCH: "Lệch phí",
};

const ACTION_ISSUES = new Set([
  "BATCH_SAVED",
  "USER_CONFIRMED",
  "COD_RECONCILIATION_PAID",
]);

type HistoryIssueSummary = {
  code: string;
  label: string;
  count: number;
};

type HistoryBatch = {
  id: string;
  fileName?: string | null;
  transferCode?: string | null;
  transferDate?: string | null;
  sourceType?: string | null;
  parserMode?: string | null;
  status?: string | null;
  note?: string | null;
  totalRows?: number;
  matchedRows?: number;
  mismatchRows?: number;
  paidRows?: number;
  confirmedRows?: number;
  savedRows?: number;
  notFoundRows?: number;
  codMismatchRows?: number;
  feeMismatchRows?: number;
  issueSummary?: HistoryIssueSummary[];
  totalCodAmount?: number;
  totalFeeAmount?: number;
  totalNetAmount?: number;
  createdAt?: string | null;
  savedAt?: string | null;
  confirmedAt?: string | null;
  paidAt?: string | null;
};

type HistoryRow = {
  id: string;
  batchId?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  shipmentId?: string | null;
  ghnCode?: string | null;
  customerOrderCode?: string | null;
  ghnStatus?: string | null;
  codAmount?: number | null;
  serviceFee?: number | null;
  totalReconcileAmount?: number | null;
  reconciliationStatus?: string | null;
  issues?: string[] | string | null;
  actionStatus?: string | null;
  sourceType?: string | null;
  savedAt?: string | null;
  confirmedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
};

type HistoryDetailResponse = {
  batch: HistoryBatch;
  rows: HistoryRow[];
};

export default function GhnCodReconciliationHistoryDetailPageClient({
  batchId,
}: {
  batchId: string;
}) {
  const [data, setData] = useState<HistoryDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function loadDetail() {
    if (!batchId) return;

    setLoading(true);
    setMessage("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(
        `${API_BASE}/finance/ghn-cod-reconciliation/history/${encodeURIComponent(batchId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Không tải được chi tiết phiên đối soát GHN.");
      }

      setData(json);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không tải được chi tiết phiên đối soát GHN.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [batchId]);

  const batch = data?.batch;
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  const issueOptions = useMemo(() => {
    const counts = new Map<string, number>();

    rows.forEach((row) => {
      const issues = getBusinessIssues(row);
      if (!issues.length) {
        counts.set("MATCHED", (counts.get("MATCHED") || 0) + 1);
        return;
      }

      issues.forEach((issue) => {
        counts.set(issue, (counts.get(issue) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([code, count]) => ({
        code,
        label: code === "MATCHED" ? "Khớp" : ISSUE_LABELS[code] || code,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const blob = [
        row.orderCode,
        row.ghnCode,
        row.customerOrderCode,
        row.ghnStatus,
        row.reconciliationStatus,
        row.actionStatus,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      if (q && !blob.includes(q)) return false;

      const businessIssues = getBusinessIssues(row);
      const actionStatus = String(row.actionStatus || "").toUpperCase();
      const reconciliationStatus = String(row.reconciliationStatus || "").toUpperCase();

      if (issueFilter !== "ALL") {
        if (issueFilter === "MATCHED") {
          if (businessIssues.length) return false;
        } else if (!businessIssues.includes(issueFilter)) {
          return false;
        }
      }

      if (statusFilter !== "ALL") {
        if (statusFilter === "PAID" && !isPaidRow(row)) return false;
        if (statusFilter === "CONFIRMED" && !isConfirmedRow(row)) return false;
        if (statusFilter === "DRAFT" && (isConfirmedRow(row) || isPaidRow(row) || actionStatus === "SAVED")) return false;
        if (
          !["PAID", "CONFIRMED", "DRAFT"].includes(statusFilter) &&
          actionStatus !== statusFilter &&
          reconciliationStatus !== statusFilter
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rows, query, issueFilter, statusFilter]);

  const summary = useMemo(() => {
    const issueRows = rows.filter((row) => getBusinessIssues(row).length > 0);
    const paidRows = rows.filter(isPaidRow);
    const confirmedRows = rows.filter(isConfirmedRow);
    const cod = rows.reduce((sum, row) => sum + Number(row.codAmount || 0), 0);
    const fee = rows.reduce((sum, row) => sum + Number(row.serviceFee || 0), 0);
    const net = rows.reduce((sum, row) => sum + Number(row.totalReconcileAmount || 0), 0);

    return {
      totalRows: rows.length,
      paidRows: paidRows.length,
      confirmedRows: confirmedRows.length,
      issueRows: issueRows.length,
      cod,
      fee,
      net,
    };
  }, [rows]);

  return (
    <div className="space-y-5 bg-[#f7f7f8] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">
            Tài chính / Đối soát COD GHN / Chi tiết phiên
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            {batch?.transferCode || batch?.fileName || "Chi tiết phiên đối soát"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Xem toàn bộ đơn đã được lưu/xác nhận/thanh toán trong phiên đối soát này.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/ghn-reconciliation"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            ← Về đối soát GHN
          </Link>
          <button
            onClick={() => void loadDetail()}
            disabled={loading}
            className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Stat title="Tổng dòng" value={formatNumber(summary.totalRows)} />
          <Stat title="Đã thanh toán" value={formatNumber(summary.paidRows)} ok />
          <Stat title="Đã xác nhận" value={formatNumber(summary.confirmedRows)} />
          <Stat title="Có vấn đề" value={formatNumber(summary.issueRows)} danger={summary.issueRows > 0} />
          <Stat title="COD" value={money(summary.cod)} />
          <Stat title="Phí" value={money(summary.fee)} danger={summary.fee < 0} />
          <Stat title="Thực nhận" value={money(summary.net)} />
          <Stat title="Nguồn" value={batch?.sourceType === "MANUAL_INPUT" ? "Nhập tay" : "Excel GHN"} />
        </div>

        <div className="mt-4 grid gap-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-4 md:grid-cols-3">
          <Info label="Mã phiên" value={batch?.id} mono />
          <Info label="Tên file / ghi chú" value={batch?.fileName || batch?.note || "Đối soát nhập tay"} />
          <Info label="Trạng thái phiên" value={statusLabel(batch?.status)} />
          <Info label="Tạo phiên" value={formatDateTime(batch?.createdAt)} />
          <Info label="Xác nhận" value={formatDateTime(batch?.confirmedAt)} />
          <Info label="Thanh toán" value={formatDateTime(batch?.paidAt)} />
        </div>

        {Array.isArray(batch?.issueSummary) && batch.issueSummary.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm font-extrabold text-amber-900">Lý do cần kiểm tra trong phiên</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {batch.issueSummary.map((item) => (
                <span
                  key={item.code}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800"
                >
                  {item.label}: {formatNumber(item.count)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Danh sách đơn trong phiên</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Đang hiển thị <b>{formatNumber(filteredRows.length)}</b> / <b>{formatNumber(rows.length)}</b> dòng.
            </p>
          </div>

          <div className="grid w-full gap-2 md:w-auto md:grid-cols-[320px_220px_220px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã đơn, mã GHN, mã KH/file..."
              className="h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
            />
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="ALL">Tất cả kết quả</option>
              {issueOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="ALL">Tất cả trạng thái ĐS</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="SAVED">Đã lưu</option>
              <option value="DRAFT">Nháp/chưa chốt</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-2xl border border-neutral-200">
          <table className="w-full min-w-[1420px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Đơn nội bộ</th>
                <th className="px-4 py-3">Mã GHN</th>
                <th className="px-4 py-3">Trạng thái GHN</th>
                <th className="px-4 py-3 text-right">COD</th>
                <th className="px-4 py-3 text-right">Phí</th>
                <th className="px-4 py-3 text-right">Thực nhận</th>
                <th className="px-4 py-3">Đối soát</th>
                <th className="px-4 py-3">Vấn đề</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Mở đơn</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                    Đang tải chi tiết phiên đối soát...
                  </td>
                </tr>
              ) : filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t align-top hover:bg-neutral-50/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-950">{row.orderCode || "Chưa có"}</div>
                      {row.customerOrderCode ? (
                        <div className="mt-1 text-xs text-neutral-400">KH/file: {row.customerOrderCode}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold text-purple-700">
                      {row.ghnCode || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {formatGhnStatus(row.ghnStatus)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{money(row.codAmount)}</td>
                    <td className="px-4 py-3 text-right">{money(row.serviceFee)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(row.totalReconcileAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.actionStatus || row.reconciliationStatus} />
                    </td>
                    <td className="max-w-[300px] px-4 py-3">
                      {formatHistoryIssues(row.issues)}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      <div>Lưu: {formatDateTime(row.savedAt)}</div>
                      {row.confirmedAt ? <div>Xác nhận: {formatDateTime(row.confirmedAt)}</div> : null}
                      {row.paidAt ? <div>TT: {formatDateTime(row.paidAt)}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.orderId ? (
                        <Link
                          href={`/orders/${row.orderId}`}
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Chi tiết đơn
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                    Không có dòng nào phù hợp bộ lọc.
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

function Stat({
  title,
  value,
  ok,
  danger,
}: {
  title: string;
  value: string;
  ok?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</div>
      <div className={`mt-2 text-xl font-extrabold ${danger ? "text-red-600" : ok ? "text-emerald-600" : "text-neutral-950"}`}>
        {value}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`mt-1 text-sm font-semibold text-neutral-800 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status || "").toUpperCase();
  const label = statusLabel(s);

  if (["PAID", "COD_RECONCILIATION_PAID"].includes(s)) {
    return <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">{label}</span>;
  }

  if (["CONFIRMED", "USER_CONFIRMED"].includes(s)) {
    return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{label}</span>;
  }

  if (["SAVED", "BATCH_SAVED"].includes(s)) {
    return <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-700">{label}</span>;
  }

  if (["MISMATCH", "NOT_FOUND"].includes(s)) {
    return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{label}</span>;
  }

  return <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">{label}</span>;
}

function statusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();

  const labels: Record<string, string> = {
    PAID: "Đã thanh toán",
    COD_RECONCILIATION_PAID: "Đã thanh toán",
    CONFIRMED: "Đã xác nhận",
    USER_CONFIRMED: "Đã xác nhận",
    SAVED: "Đã lưu",
    BATCH_SAVED: "Đã lưu",
    DRAFT: "Nháp",
    MATCHED: "Khớp",
    MATCHED_BY_PARTIAL_DELIVERY: "Khớp qua giao 1 phần",
    MISMATCH: "Lệch",
    NOT_FOUND: "Không tìm thấy",
  };

  return labels[s] || status || "—";
}

function getBusinessIssues(row: HistoryRow) {
  const issues = normalizeIssues(row.issues).filter((issue) => !ACTION_ISSUES.has(issue));
  return issues.filter((issue) => issue !== "MATCHED_BY_PARTIAL_DELIVERY");
}

function normalizeIssues(value: HistoryRow["issues"]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatHistoryIssues(value: HistoryRow["issues"]) {
  const issues = normalizeIssues(value).filter((issue) => !ACTION_ISSUES.has(issue));

  if (!issues.length) return "Khớp";

  return (
    <div className="flex flex-wrap gap-1">
      {issues.map((issue) => (
        <span
          key={issue}
          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"
        >
          {ISSUE_LABELS[issue] || issue}
        </span>
      ))}
    </div>
  );
}

function isPaidRow(row: HistoryRow) {
  const status = String(row.actionStatus || row.reconciliationStatus || "").toUpperCase();
  return Boolean(row.paidAt) || ["PAID", "COD_RECONCILIATION_PAID"].includes(status);
}

function isConfirmedRow(row: HistoryRow) {
  const status = String(row.actionStatus || row.reconciliationStatus || "").toUpperCase();
  return Boolean(row.confirmedAt) || Boolean(row.paidAt) || ["CONFIRMED", "PAID", "USER_CONFIRMED", "COD_RECONCILIATION_PAID"].includes(status);
}

function formatGhnStatus(value?: string | null) {
  const raw = String(value || "").trim();
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!raw) return "—";
  if (
    text === "delivered" ||
    text.includes("giao thanh cong") ||
    text.includes("da giao") ||
    text.includes("delivery success") ||
    text.includes("completed")
  ) {
    return "Giao hàng thành công";
  }
  if (text.includes("giao hang khong thanh cong") || text.includes("failed")) {
    return "Giao hàng không thành công";
  }
  if (text.includes("return") || text.includes("hoan")) {
    return "Đang hoàn / đã hoàn";
  }

  return raw;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function money(value?: number | null) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
}
