"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { getBranches, type BranchItem } from "@/lib/products-api";
import {
  getActiveBranchIdFromStorage,
  getCurrentUserFromStorage,
} from "@/lib/current-user";
import {
  ChevronRight,
  ClipboardList,
  Filter,
  RefreshCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "black";

type StocktakeSession = {
  id: string;
  branchId?: string | null;
  name?: string | null;
  note?: string | null;
  status?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  appliedAt?: string | null;
  snapshotPurgedAt?: string | null;
  code?: string | null;
  sessionCode?: string | null;
  createdByName?: string | null;
  finishedByName?: string | null;
  appliedByName?: string | null;
  workers?: Array<{
    id?: string;
    name?: string | null;
    staffName?: string | null;
    username?: string | null;
    deviceName?: string | null;
    zone?: string | null;
  }>;
  kpi?: {
    totalSku?: number;
    countedSku?: number;
    uncountedSku?: number;
    mismatchSku?: number;
    discrepancySku?: number;
    totalDiffQty?: number;
    totalDiffValue?: number;
  } | null;
  _count?: {
    scanEvents?: number;
    workers?: number;
    items?: number;
  };
  scanEventCount?: number;
  scanCount?: number;
};

type StocktakeListResponse = {
  items?: StocktakeSession[];
  data?: StocktakeSession[];
  sessions?: StocktakeSession[];
  total?: number;
  totalPages?: number;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "IN_PROGRESS", label: "Đang kiểm" },
  { value: "PAUSED", label: "Tạm dừng" },
  { value: "FINISHED", label: "Đã kết thúc" },
  { value: "APPLIED", label: "Đã chốt tồn" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

function cleanBranchId(value: any) {
  const text = String(value || "").trim();
  if (!text || ["ALL", "all", "null", "undefined", "*"].includes(text)) return "";
  return text;
}

function normalizeBranchRows(input: any): BranchItem[] {
  const raw = Array.isArray(input)
    ? input
    : Array.isArray(input?.items)
      ? input.items
      : Array.isArray(input?.data)
        ? input.data
        : Array.isArray(input?.branches)
          ? input.branches
          : [];

  const seen = new Set<string>();
  return raw
    .map((row: any) => {
      const id = cleanBranchId(row?.id || row?.branchId || row?.value || row?.code);
      const name = String(row?.name || row?.branchName || row?.label || id || "").trim();
      return id ? ({ ...row, id, name } as BranchItem) : null;
    })
    .filter((row: BranchItem | null): row is BranchItem => {
      if (!row || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
}

function branchRowsFromUser(user: any): BranchItem[] {
  const rows: BranchItem[] = [];
  const seen = new Set<string>();
  const add = (idValue: any, nameValue?: any) => {
    const id = cleanBranchId(idValue);
    if (!id || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, name: String(nameValue || id) } as BranchItem);
  };

  add(user?.activeBranchId, user?.activeBranchName || user?.branchName);
  add(user?.workingBranchId, user?.workingBranchName || user?.branchName);
  add(user?.branchId, user?.branchName);

  if (Array.isArray(user?.branchOptions)) {
    user.branchOptions.forEach((row: any) => add(row?.branchId || row?.id, row?.branchName || row?.name));
  }
  if (Array.isArray(user?.branchRoles)) {
    user.branchRoles.forEach((row: any) => add(row?.branchId || row?.branch?.id, row?.branchName || row?.branch?.name));
  }
  if (Array.isArray(user?.branchPermissions)) {
    user.branchPermissions.forEach((row: any) => add(row?.branchId || row?.branch?.id, row?.branchName || row?.branch?.name));
  }

  return rows;
}

function statusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    IN_PROGRESS: "Đang kiểm",
    PAUSED: "Tạm dừng",
    FINISHED: "Đã kết thúc",
    APPLIED: "Đã chốt tồn",
    CANCELLED: "Đã huỷ",
  };
  return labels[s] || s || "—";
}

function statusTone(status?: string | null): Tone {
  const s = String(status || "").toUpperCase();
  if (s === "APPLIED") return "green";
  if (s === "FINISHED") return "blue";
  if (s === "IN_PROGRESS" || s === "PAUSED") return "amber";
  if (s === "CANCELLED") return "red";
  return "gray";
}

function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    gray: "border-neutral-200 bg-neutral-100 text-neutral-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    black: "border-neutral-950 bg-neutral-950 text-white",
  };
  return map[tone];
}

function formatNumber(value?: number | string | null) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function diffText(value?: number | string | null) {
  const n = Number(value || 0);
  return n > 0 ? `+${formatNumber(n)}` : formatNumber(n);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getSessionDisplayCode(item: StocktakeSession, branchName?: string) {
  const explicit = String(item.code || item.sessionCode || "").trim();
  if (explicit) return explicit.toUpperCase();

  const branchCode = String(branchName || item.branchId || "CN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase() || "CN";
  const shortId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return shortId ? `KK-${branchCode}-${shortId}` : `KK-${branchCode}`;
}

function workerText(item: StocktakeSession) {
  const names = (item.workers || [])
    .map((worker: any) => worker?.name || worker?.staffName || worker?.username || "")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const unique = Array.from(new Set(names));
  if (!unique.length) return "Chưa có nhân viên";
  if (unique.length <= 2) return unique.join(", ");
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

function scanCount(item: StocktakeSession) {
  return Number(item._count?.scanEvents || item.scanEventCount || item.scanCount || 0);
}

export default function MobileStocktakeHistoryPage() {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    const fromUser = branchRowsFromUser(user);
    const activeBranch = cleanBranchId(getActiveBranchIdFromStorage(user));
    if (fromUser.length) setBranches(fromUser);
    if (activeBranch) setBranchId(activeBranch);
    else if (fromUser.length === 1) setBranchId(fromUser[0].id);

    void getBranches()
      .then((data) => {
        const rows = normalizeBranchRows(data);
        if (!rows.length) return;
        setBranches((prev) => {
          const map = new Map<string, BranchItem>();
          [...prev, ...rows].forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        });
        setBranchId((prev) => cleanBranchId(prev) || activeBranch || rows[0]?.id || "");
      })
      .catch(() => null);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (status && status !== "ALL") params.set("status", status);
    if (query.trim()) {
      params.set("query", query.trim());
      params.set("productQuery", query.trim());
      params.set("sku", query.trim());
    }
    params.set("page", String(page));
    params.set("limit", "20");

    try {
      const data = await apiJson<StocktakeListResponse>(`/stocktake-sessions?${params.toString()}`, {
        timeoutMs: 20000,
      } as any);
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.sessions)
            ? data.sessions
            : [];

      setSessions(items);
      setTotal(Number(data?.total || items.length || 0));
      setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
    } catch (err) {
      setSessions([]);
      setTotal(0);
      setTotalPages(1);
      setMessage(err instanceof Error ? err.message : "Không tải được lịch sử kiểm kho.");
    } finally {
      setLoading(false);
    }
  }, [branchId, page, query, status]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleSearch = () => {
    setPage(1);
    setQuery(queryDraft.trim());
  };

  return (
    <main className="min-h-screen bg-[#f3f3f3] px-4 pb-32 pt-[calc(16px+env(safe-area-inset-top))] text-neutral-950">
      <section className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.42em] text-white/50">
              Mobile
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight">
              Lịch sử kiểm kho
            </h1>
            <p className="mt-4 text-base font-semibold leading-7 text-white/65">
              Xem nhanh các phiên đã tạo, đang kiểm, đã kết thúc và đã chốt tồn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadSessions()}
            className="rounded-full bg-white/10 p-3 text-white active:scale-95"
            aria-label="Tải lại"
          >
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-bold text-white/45">Tổng phiên</p>
            <p className="mt-2 text-2xl font-black">{formatNumber(total)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-bold text-white/45">Trang</p>
            <p className="mt-2 text-2xl font-black">{page}/{totalPages}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-neutral-400">
          <Filter className="h-4 w-4" /> Bộ lọc
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">Chi nhánh</span>
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setPage(1);
              }}
              className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
            >
              <option value="">Tất cả</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">Trạng thái</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-bold outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-neutral-200 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-neutral-400" />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearch();
              }}
              placeholder="Tìm phiên, SKU, ghi chú..."
              className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-2xl bg-neutral-950 px-4 text-sm font-black text-white active:scale-95"
          >
            Tìm
          </button>
        </div>
      </section>

      {message ? (
        <section className="mt-4 rounded-[1.5rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {message}
        </section>
      ) : null}

      <section className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-[1.5rem] bg-white p-5 text-sm font-bold text-neutral-500 shadow-sm">
            Đang tải lịch sử kiểm kho...
          </div>
        ) : sessions.length ? (
          sessions.map((item) => {
            const branchName = branchMap.get(String(item.branchId || "")) || String(item.branchId || "—");
            const kpi = item.kpi || {};
            const mismatch = Number(kpi.mismatchSku ?? kpi.discrepancySku ?? 0);
            const counted = Number(kpi.countedSku ?? 0);
            const totalSku = Number(kpi.totalSku ?? item._count?.items ?? 0);

            return (
              <Link
                key={item.id}
                href={`/mobile/stocktake-history/${item.id}`}
                className="block rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-400">
                      {getSessionDisplayCode(item, branchName)} · {branchName}
                    </p>
                    <h2 className="mt-2 line-clamp-2 text-xl font-black tracking-tight">
                      {item.name || "Phiên kiểm kho"}
                    </h2>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${toneClass(statusTone(item.status))}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[11px] font-bold text-neutral-400">Đã kiểm</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(counted)}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[11px] font-bold text-neutral-400">Lệch SKU</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(mismatch)}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-100 p-3">
                    <p className="text-[11px] font-bold text-neutral-400">Scan</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(scanCount(item))}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm font-bold text-neutral-500">
                  <span className="min-w-0 truncate">
                    {formatDateTime(item.createdAt)} · {workerText(item)}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
                </div>

                {totalSku > 0 || Number(kpi.totalDiffQty || 0) !== 0 ? (
                  <p className="mt-2 text-xs font-bold text-neutral-400">
                    Tổng SKU {formatNumber(totalSku)} · lệch tồn {diffText(kpi.totalDiffQty)}
                  </p>
                ) : null}
              </Link>
            );
          })
        ) : (
          <div className="rounded-[1.5rem] bg-white p-6 text-center shadow-sm">
            <ClipboardList className="mx-auto h-9 w-9 text-neutral-300" />
            <p className="mt-3 text-base font-black">Chưa có phiên phù hợp</p>
            <p className="mt-1 text-sm font-semibold text-neutral-500">Đổi bộ lọc hoặc tạo phiên kiểm kho mới.</p>
          </div>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="h-12 flex-1 rounded-2xl border border-neutral-300 bg-white text-sm font-black disabled:opacity-40"
        >
          Trước
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((value) => value + 1)}
          className="h-12 flex-1 rounded-2xl bg-neutral-950 text-sm font-black text-white disabled:opacity-40"
        >
          Sau
        </button>
      </div>

      <MobileBottomNav />
    </main>
  );
}
