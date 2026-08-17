"use client";

import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { apiJson } from "@/lib/api";
import { getMobileToken } from "@/lib/mobile-auth-token";
import {
  CheckCircle2,
  Factory,
  PackageCheck,
  RefreshCw,
  Scissors,
  Shirt,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SampleStatus =
  | "IDEA"
  | "FABRIC_SELECTED"
  | "SAMPLING"
  | "SAMPLE_READY"
  | "REVISING"
  | "APPROVED_FOR_PRODUCTION"
  | "IN_PRODUCTION"
  | "COMPLETED"
  | "ON_HOLD";

type ProductionStatus =
  | "DRAFT"
  | "PLANNING"
  | "READY"
  | "SENT"
  | "CUTTING"
  | "SEWING"
  | "QC"
  | "COMPLETED"
  | "CANCELLED";

type SampleRow = {
  id: string;
  code: string;
  name: string;
  status: SampleStatus;
  coverImageUrl?: string | null;
  assigneeName?: string | null;
  nextAction?: string | null;
  updatedAt?: string | null;
};

type ProductionOrder = {
  id: string;
  code: string;
  status: ProductionStatus;
  updatedAt?: string | null;
  designSampleId?: string | null;
  sample?: {
    id?: string;
    code?: string;
    name?: string;
    coverImageUrl?: string | null;
  } | null;
  factory?: {
    id?: string;
    code?: string;
    name?: string;
  } | null;
};

type TabKey = "samples" | "production";

const SAMPLE_STEPS: Array<{
  status: SampleStatus;
  label: string;
  nextAction?: string;
}> = [
  { status: "SAMPLING", label: "Đang làm mẫu", nextAction: "Chờ nhà may trả mẫu" },
  { status: "SAMPLE_READY", label: "Nhà may trả mẫu", nextAction: "Duyệt mẫu" },
  { status: "REVISING", label: "Sửa mẫu", nextAction: "Chờ mẫu sửa" },
  { status: "APPROVED_FOR_PRODUCTION", label: "Duyệt SX", nextAction: "Chuẩn bị sản xuất" },
];

const PRODUCTION_STEPS: Array<{ status: ProductionStatus; label: string }> = [
  { status: "READY", label: "Chờ cắt" },
  { status: "SENT", label: "Đã giao nhà may" },
  { status: "CUTTING", label: "Bắt đầu cắt" },
  { status: "SEWING", label: "Đang may" },
  { status: "QC", label: "QC / hoàn thiện" },
  { status: "COMPLETED", label: "Đã SX xong" },
];

const SAMPLE_LABEL: Record<string, string> = {
  IDEA: "Ý tưởng",
  FABRIC_SELECTED: "Đã chọn vải",
  SAMPLING: "Đang làm mẫu",
  SAMPLE_READY: "Nhà may trả mẫu",
  REVISING: "Đang sửa mẫu",
  APPROVED_FOR_PRODUCTION: "Đã duyệt SX",
  IN_PRODUCTION: "Đang sản xuất",
  COMPLETED: "Hoàn tất",
  ON_HOLD: "Tạm dừng",
};

const PRODUCTION_LABEL: Record<string, string> = {
  DRAFT: "Chưa triển khai",
  PLANNING: "Chuẩn bị SX",
  READY: "Chờ cắt",
  SENT: "Đã giao nhà may",
  CUTTING: "Đang cắt",
  SEWING: "Đang may",
  QC: "QC / hoàn thiện",
  COMPLETED: "Đã SX xong",
  CANCELLED: "Đã huỷ",
};

async function api<T = any>(path: string, init: RequestInit = {}) {
  await getMobileToken();
  return apiJson<T>(path, { ...init, redirectOnUnauthorized: false } as any);
}

function statusClass(status: string) {
  if (["COMPLETED", "APPROVED_FOR_PRODUCTION"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["CUTTING", "SEWING", "IN_PRODUCTION", "SAMPLING"].includes(status)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (["SAMPLE_READY", "READY", "SENT", "QC"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["REVISING", "ON_HOLD", "CANCELLED"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(
        status,
      )}`}
    >
      {label}
    </span>
  );
}

function updatedText(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MobileProductionPage() {
  const [tab, setTab] = useState<TabKey>("samples");
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [sampleRows, orderRows] = await Promise.all([
        api<SampleRow[]>("/sample-fabric/samples"),
        api<ProductionOrder[]>("/production/orders"),
      ]);

      setSamples(Array.isArray(sampleRows) ? sampleRows : []);
      setOrders(Array.isArray(orderRows) ? orderRows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu sản xuất.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeSamples = useMemo(
    () =>
      samples.filter(
        (row) =>
          !["COMPLETED", "ON_HOLD"].includes(String(row.status || "").toUpperCase()),
      ),
    [samples],
  );

  const completedOrders = useMemo(
    () => orders.filter((row) => row.status === "COMPLETED").length,
    [orders],
  );

  async function setSampleStatus(
    row: SampleRow,
    status: SampleStatus,
    nextAction?: string,
  ) {
    const key = `sample:${row.id}:${status}`;
    try {
      setBusyKey(key);
      setError("");
      setMessage("");

      await api(`/sample-fabric/samples/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          nextAction: nextAction || null,
        }),
      });

      setSamples((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status,
                nextAction: nextAction || null,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      setMessage(`${row.code}: ${SAMPLE_LABEL[status] || status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được trạng thái mẫu.");
    } finally {
      setBusyKey("");
    }
  }

  async function setProductionStatus(
    row: ProductionOrder,
    status: ProductionStatus,
  ) {
    const key = `order:${row.id}:${status}`;
    try {
      setBusyKey(key);
      setError("");
      setMessage("");

      await api(`/production/orders/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setOrders((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, status, updatedAt: new Date().toISOString() }
            : item,
        ),
      );

      // Khi bắt đầu SX / hoàn thành SX, đồng bộ trạng thái mẫu nếu tài khoản có quyền sửa mẫu.
      if (
        row.designSampleId &&
        (status === "CUTTING" || status === "COMPLETED")
      ) {
        try {
          await api(`/sample-fabric/samples/${row.designSampleId}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: status === "COMPLETED" ? "COMPLETED" : "IN_PRODUCTION",
              nextAction:
                status === "COMPLETED" ? "Sản xuất hoàn tất" : "Đang sản xuất",
            }),
          });

          setSamples((current) =>
            current.map((item) =>
              item.id === row.designSampleId
                ? {
                    ...item,
                    status:
                      status === "COMPLETED"
                        ? ("COMPLETED" as SampleStatus)
                        : ("IN_PRODUCTION" as SampleStatus),
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
          );
        } catch {
          // Không chặn cập nhật lệnh SX nếu tài khoản chỉ có quyền production.edit.
        }
      }

      setMessage(`${row.code}: ${PRODUCTION_LABEL[status] || status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được lệnh sản xuất.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <main className="min-h-[100dvh] bg-neutral-100 pb-[calc(112px+env(safe-area-inset-bottom))] text-neutral-950">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 pb-4 pt-[calc(16px+env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Sản xuất
              </div>
              <h1 className="mt-1 text-xl font-black">Cập nhật nhanh</h1>
            </div>
            <button
              type="button"
              disabled={loading || Boolean(busyKey)}
              onClick={() => void load()}
              className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setTab("samples")}
              className={`rounded-xl px-3 py-2.5 text-xs font-black ${
                tab === "samples" ? "bg-white shadow-sm" : "text-neutral-500"
              }`}
            >
              Mẫu · {activeSamples.length}
            </button>
            <button
              type="button"
              onClick={() => setTab("production")}
              className={`rounded-xl px-3 py-2.5 text-xs font-black ${
                tab === "production" ? "bg-white shadow-sm" : "text-neutral-500"
              }`}
            >
              Sản xuất · {orders.length}
            </button>
          </div>
        </header>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/mobile/samples"
              className="rounded-3xl bg-neutral-950 p-4 text-white shadow-sm active:scale-[0.985]"
            >
              <Shirt className="h-6 w-6" />
              <div className="mt-4 font-black">Mẫu mã</div>
              <div className="mt-1 text-xs text-neutral-300">Tạo mẫu nhanh</div>
            </Link>
            <Link
              href="/mobile/fabric"
              className="rounded-3xl bg-white p-4 shadow-sm active:scale-[0.985]"
            >
              <Scissors className="h-6 w-6" />
              <div className="mt-4 font-black">Vải về</div>
              <div className="mt-1 text-xs text-neutral-400">Cây, màu, ảnh</div>
            </Link>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
              {message}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">
              Đang tải...
            </div>
          ) : null}

          {!loading && tab === "samples" ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm font-black">Mẫu đang triển khai</div>
                  <div className="mt-1 text-xs text-neutral-400">
                    Bấm trạng thái ngay khi nhà may trả mẫu hoặc mẫu được duyệt.
                  </div>
                </div>
                <Sparkles className="h-5 w-5 text-neutral-300" />
              </div>

              {activeSamples.map((row) => (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-[26px] bg-white shadow-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-neutral-400">
                          {row.code}
                        </div>
                        <div className="mt-1 truncate text-base font-black">
                          {row.name}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={row.status}
                            label={SAMPLE_LABEL[row.status] || row.status}
                          />
                          {row.assigneeName ? (
                            <span className="text-[10px] font-bold text-neutral-400">
                              {row.assigneeName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {row.status === "APPROVED_FOR_PRODUCTION" ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Shirt className="h-6 w-6 text-neutral-300" />
                      )}
                    </div>

                    {row.nextAction ? (
                      <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                        Tiếp theo: <b>{row.nextAction}</b>
                      </div>
                    ) : null}

                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {SAMPLE_STEPS.map((step) => {
                        const active = row.status === step.status;
                        const busy = busyKey === `sample:${row.id}:${step.status}`;
                        return (
                          <button
                            key={step.status}
                            type="button"
                            disabled={Boolean(busyKey) || active}
                            onClick={() =>
                              void setSampleStatus(row, step.status, step.nextAction)
                            }
                            className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${
                              active
                                ? "border-neutral-950 bg-neutral-950 text-white"
                                : "border-neutral-200 bg-white text-neutral-600"
                            } disabled:opacity-50`}
                          >
                            {busy ? "Đang lưu..." : step.label}
                          </button>
                        );
                      })}
                    </div>

                    {row.updatedAt ? (
                      <div className="mt-2 text-[10px] text-neutral-400">
                        Cập nhật {updatedText(row.updatedAt)}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}

              {!activeSamples.length ? (
                <div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">
                  Không có mẫu đang triển khai.
                </div>
              ) : null}
            </section>
          ) : null}

          {!loading && tab === "production" ? (
            <section className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-[10px] font-bold text-neutral-400">Tổng lệnh</div>
                  <div className="mt-1 text-xl font-black">{orders.length}</div>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-[10px] font-bold text-neutral-400">Đang làm</div>
                  <div className="mt-1 text-xl font-black">
                    {
                      orders.filter((x) =>
                        ["CUTTING", "SEWING", "QC"].includes(x.status),
                      ).length
                    }
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-[10px] font-bold text-neutral-400">Đã xong</div>
                  <div className="mt-1 text-xl font-black">{completedOrders}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-black">Lệnh sản xuất</div>
                <div className="mt-1 text-xs text-neutral-400">
                  Cập nhật ngay khi giao nhà may, bắt đầu cắt hoặc hoàn thành.
                </div>
              </div>

              {orders.map((row) => (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-[26px] bg-white shadow-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-neutral-400">
                          {row.code}
                        </div>
                        <div className="mt-1 text-base font-black">
                          {row.sample?.code || "—"} · {row.sample?.name || "Chưa có tên"}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={row.status}
                            label={PRODUCTION_LABEL[row.status] || row.status}
                          />
                          <span className="text-[10px] font-bold text-neutral-400">
                            {row.factory?.name || "Chưa chọn nhà may"}
                          </span>
                        </div>
                      </div>
                      {row.status === "COMPLETED" ? (
                        <PackageCheck className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Factory className="h-6 w-6 text-neutral-300" />
                      )}
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {PRODUCTION_STEPS.map((step) => {
                        const active = row.status === step.status;
                        const busy = busyKey === `order:${row.id}:${step.status}`;
                        return (
                          <button
                            key={step.status}
                            type="button"
                            disabled={Boolean(busyKey) || active}
                            onClick={() => void setProductionStatus(row, step.status)}
                            className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${
                              step.status === "COMPLETED" && active
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : active
                                  ? "border-neutral-950 bg-neutral-950 text-white"
                                  : "border-neutral-200 bg-white text-neutral-600"
                            } disabled:opacity-50`}
                          >
                            {busy ? "Đang lưu..." : step.label}
                          </button>
                        );
                      })}
                    </div>

                    {row.updatedAt ? (
                      <div className="mt-2 text-[10px] text-neutral-400">
                        Cập nhật {updatedText(row.updatedAt)}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}

              {!orders.length ? (
                <div className="rounded-3xl bg-white p-10 text-center text-sm font-bold text-neutral-400">
                  Chưa có lệnh sản xuất.
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}
