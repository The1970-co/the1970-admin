"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBranches,
  getProducts,
  type BranchItem,
  type ProductItem,
} from "@/lib/products-api";
import { applyStocktake } from "@/lib/stocktake-api";
import { hasPermission, type AppRole } from "@/lib/authz";
import { getCurrentUserFromStorage } from "@/lib/current-user";

function formatDate() {
  return new Date().toLocaleString("vi-VN");
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition";
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";
  const state = disabled ? "cursor-not-allowed opacity-50" : "";
  return <button onClick={onClick} disabled={disabled} className={`${base} ${tone} ${state}`}>{children}</button>;
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
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

const mismatchReasons = [
  "Sai vị trí để hàng",
  "Thiếu hàng thực tế",
  "Dư hàng thực tế",
  "Lỗi nhập/xuất trước đó",
  "Mất tem / quét sai",
  "Khác",
];

type StocktakeRow = {
  sku: string;
  counted: number;
  system: number;
  diff: number;
  status: "MATCH" | "MISMATCH" | "NOT_FOUND";
  variant: any;
  reason: string;
  note: string;
  scannedBy: string;
  scannedAt: string;
};

type StocktakeSession = {
  id: string;
  name: string;
  branchId: string;
  mode: "LIVE" | "CSV";
  status: string;
  note: string;
  createdAt: string;
  totalRows: number;
  mismatchRows: number;
};

export default function StocktakePageClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<AppRole>("admin");
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [preview, setPreview] = useState<StocktakeRow[]>([]);
  const [scanMode, setScanMode] = useState<"LIVE" | "CSV">("LIVE");
  const [liveSku, setLiveSku] = useState("");
  const [liveRows, setLiveRows] = useState<StocktakeRow[]>([]);
  const [sessionNote, setSessionNote] = useState("");
  const [sessionName, setSessionName] = useState("Kiểm kho cuối ngày");
  const [sessionStatus, setSessionStatus] = useState("DRAFT");
  const [showOnlyMismatch, setShowOnlyMismatch] = useState(false);
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUserFromStorage();
    if (!currentUser) return;

    setRole(currentUser.role as AppRole);
    setCurrentBranchId(currentUser.branchId || null);

    if (currentUser.role !== "admin" && currentUser.role !== "owner" && currentUser.branchId) {
      setBranchId(currentUser.branchId);
    }
  }, []);

  const isOwner = role === "admin" || role === "owner";

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const data = await getBranches();
        setBranches(data);

        setBranchId((prev) => {
          if (prev) return prev;
          if (!isOwner && currentBranchId) return currentBranchId;
          return data[0]?.id || "";
        });
      } finally {
        setLoadingBranches(false);
      }
    };

    void loadBranches();
  }, [isOwner, currentBranchId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu sản phẩm.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const visibleBranches = useMemo(() => {
    if (isOwner) return branches;
    return branches.filter((branch) => branch.id === currentBranchId);
  }, [branches, isOwner, currentBranchId]);

  const allVariants = useMemo(
    () =>
      products.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          productName: product.name,
        }))
      ),
    [products]
  );

  const canApplyStocktake = hasPermission(role, "stocktake.apply");

  const buildRow = (sku: string, counted: number, variant: any, system: number): StocktakeRow => ({
    sku,
    counted,
    system,
    diff: counted - system,
    status: variant ? (counted === system ? "MATCH" : "MISMATCH") : "NOT_FOUND",
    variant,
    reason: counted === system ? "" : "Khác",
    note: "",
    scannedBy: "Nhân viên",
    scannedAt: formatDate(),
  });

  const parseCSV = () => {
    const trimmed = fileContent.trim();
    if (!trimmed) {
      setPreview([]);
      setMessage("Chưa có nội dung CSV để preview.");
      return;
    }

    const lines = trimmed.split(String.fromCharCode(10));
    const rows = lines
      .slice(1)
      .map((line) => {
        const [skuRaw, countedRaw] = line.split(",");
        const sku = (skuRaw || "").trim();
        const counted = Number((countedRaw || "0").trim());
        const variant = allVariants.find((v) => v.sku === sku);
        const system = Number(variant?.branchStocks?.[branchId] || 0);
        return buildRow(sku, counted, variant, system);
      })
      .filter((row) => row.sku);

    setPreview(rows);
    setSessionStatus("REVIEWING");
    setMessage(`Đã preview ${rows.length} dòng từ file CSV.`);
  };

  const handleLiveScan = () => {
    const sku = liveSku.trim();
    if (!sku) return;

    const variant = allVariants.find((v) => v.sku === sku);
    const system = Number(variant?.branchStocks?.[branchId] || 0);

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
            scannedAt: formatDate(),
          };
        });
      }

      return [...prev, buildRow(sku, 1, variant, system)];
    });

    setSessionStatus("IN_PROGRESS");
    setLiveSku("");
    setMessage(`Đã ghi nhận SKU ${sku}.`);
  };

  const rows = scanMode === "LIVE" ? liveRows : preview;

  const updateRowField = (
    sku: string,
    field: "counted" | "reason" | "note",
    value: string
  ) => {
    const updater = (prev: StocktakeRow[]): StocktakeRow[] =>
      prev.map((row): StocktakeRow => {
        if (row.sku !== sku) return row;

        if (field === "counted") {
          const counted = Number(value || 0);
          const diff = counted - row.system;
          const status: "MATCH" | "MISMATCH" | "NOT_FOUND" = row.variant
            ? counted === row.system
              ? "MATCH"
              : "MISMATCH"
            : "NOT_FOUND";

          return {
            ...row,
            counted,
            diff,
            status,
            reason: status === "MATCH" ? "" : row.reason || "Khác",
          };
        }

        if (field === "reason") {
          return {
            ...row,
            reason: value,
          };
        }

        return {
          ...row,
          note: value,
        };
      });

    if (scanMode === "LIVE") {
      setLiveRows(updater);
    } else {
      setPreview(updater);
    }
  };

  const visibleRows = showOnlyMismatch ? rows.filter((row) => row.status !== "MATCH") : rows;

  const mismatchCount = rows.filter((row) => row.status !== "MATCH").length;
  const matchedCount = rows.filter((row) => row.status === "MATCH").length;
  const notFoundCount = rows.filter((row) => row.status === "NOT_FOUND").length;

  const finishSession = async () => {
    if (!rows.length) {
      setMessage("Chưa có dữ liệu kiểm kho.");
      return;
    }

    if (!canApplyStocktake) {
      setMessage("Role hiện tại không có quyền chốt kiểm kho.");
      return;
    }

    try {
      setApplying(true);
      setMessage("");

      const payload = {
        sessionName,
        sessionNote,
        branchId,
        rows: rows.map((row) => ({
          variantId: row.variant?.id,
          sku: row.sku,
          counted: row.counted,
          system: row.system,
          diff: row.diff,
          status: row.status,
          reason: row.reason,
          note: row.note,
        })),
      };

      const result = await applyStocktake(payload);

      const session: StocktakeSession = {
        id: String(Date.now()),
        name: sessionName,
        branchId,
        mode: scanMode,
        status: "FINISHED",
        note: sessionNote,
        createdAt: formatDate(),
        totalRows: rows.length,
        mismatchRows: mismatchCount,
      };

      setSessions((prev) => [session, ...prev]);
      setSessionStatus("FINISHED");
      setMessage(
        `Đã apply kiểm kho. Điều chỉnh ${result.adjustedCount} dòng, tổng delta ${
          result.totalDelta > 0 ? `+${result.totalDelta}` : result.totalDelta
        }.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không apply được stocktake.");
    } finally {
      setApplying(false);
    }
  };

  const resetSession = () => {
    setFileContent("");
    setPreview([]);
    setLiveRows([]);
    setSessionNote("");
    setSessionName("Kiểm kho cuối ngày");
    setSessionStatus("DRAFT");
    setShowOnlyMismatch(false);
    setMessage("Đã reset phiên kiểm kho.");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Kiểm kho</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Hỗ trợ cả quét LIVE bằng máy tít và review CSV trước khi chốt phiên kiểm kho.
        </p>
      </div>

      {!canApplyStocktake ? (
        <Panel className="p-4">
          <p className="text-sm text-amber-700">
            Role hiện tại chỉ được xem kiểm kho, không được chốt apply điều chỉnh.
          </p>
        </Panel>
      ) : null}

      {error ? (
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="p-4">
          <p className="text-sm text-neutral-700">{message}</p>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <div className="grid gap-4 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Tên phiên</label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Chi nhánh</label>
            <select
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={!isOwner}
            >
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Chế độ kiểm</label>
            <div className="flex gap-2">
              <Button variant={scanMode === "LIVE" ? "primary" : "secondary"} onClick={() => setScanMode("LIVE")}>
                LIVE
              </Button>
              <Button variant={scanMode === "CSV" ? "primary" : "secondary"} onClick={() => setScanMode("CSV")}>
                CSV
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Trạng thái phiên</label>
            <div className="flex gap-2">
              <Badge tone={sessionStatus === "FINISHED" ? "green" : sessionStatus === "REVIEWING" ? "blue" : "amber"}>
                {sessionStatus}
              </Badge>
              <Badge tone="gray">{rows.length} dòng</Badge>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium">Ghi chú phiên</label>
          <input
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder="Ví dụ: kiểm cuối ngày ca tối, ưu tiên khu sale rack"
          />
        </div>

        {scanMode === "LIVE" ? (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <label className="mb-2 block text-sm font-medium">Ô nhận barcode từ máy bluetooth</label>
            <input
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3"
              value={liveSku}
              onChange={(e) => setLiveSku(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLiveScan();
                }
              }}
              placeholder="Bấm vào đây rồi dùng máy tít để bắn mã"
              autoFocus
            />
            <p className="mt-2 text-xs text-neutral-500">
              Máy scan bluetooth thường nhập mã rồi tự gửi Enter. Hệ sẽ cộng dồn nếu quét cùng SKU nhiều lần.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleLiveScan}>Ghi 1 lần quét</Button>
              <Button variant="secondary" onClick={() => setLiveRows([])}>Xóa live rows</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <label className="mb-2 block text-sm font-medium">Paste CSV (sku,counted_qty)</label>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-neutral-300 p-3"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder={`sku,counted_qty
QS794-GREEN-S,3`}
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={parseCSV}>Preview file</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFileContent("");
                  setPreview([]);
                }}
              >
                Xóa file
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-4">
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">Rows</p>
          <h3 className="mt-2 text-2xl font-semibold">{rows.length}</h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">MATCH</p>
          <h3 className="mt-2 text-2xl font-semibold text-green-700">{matchedCount}</h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">MISMATCH</p>
          <h3 className="mt-2 text-2xl font-semibold text-amber-700">{mismatchCount}</h3>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-neutral-500">NOT_FOUND</p>
          <h3 className="mt-2 text-2xl font-semibold text-red-700">{notFoundCount}</h3>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant={showOnlyMismatch ? "primary" : "secondary"} onClick={() => setShowOnlyMismatch((v) => !v)}>
              {showOnlyMismatch ? "Đang lọc mismatch" : "Hiện tất cả"}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetSession}>Reset phiên</Button>
            <Button
              onClick={() => void finishSession()}
              disabled={!rows.length || applying || !canApplyStocktake}
            >
              {applying ? "Đang apply..." : "Chốt phiên kiểm kho"}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-4">
          <p className="font-medium text-neutral-900">Review rows</p>
          <p className="mt-1 text-sm text-neutral-500">{visibleRows.length} dòng hiển thị</p>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="p-5 text-sm text-neutral-500">Đang tải dữ liệu...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">System</th>
                  <th className="px-4 py-3 font-medium">Counted</th>
                  <th className="px-4 py-3 font-medium">Diff</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Lý do lệch</th>
                  <th className="px-4 py-3 font-medium">Ghi chú</th>
                  <th className="px-4 py-3 font-medium">Nhân viên</th>
                  <th className="px-4 py-3 font-medium">Thời gian</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={`${row.sku}-${i}`} className="border-t border-neutral-200 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.sku}</p>
                      {row.variant?.productName ? (
                        <p className="mt-1 text-xs text-neutral-500">{row.variant.productName}</p>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">{row.system}</td>

                    <td className="px-4 py-3">
                      <input
                        className="w-20 rounded-xl border border-neutral-300 px-3 py-2"
                        type="number"
                        value={row.counted}
                        onChange={(e) => updateRowField(row.sku, "counted", e.target.value)}
                      />
                    </td>

                    <td
                      className={`px-4 py-3 font-medium ${
                        row.diff === 0 ? "text-emerald-600" : row.diff > 0 ? "text-blue-600" : "text-red-500"
                      }`}
                    >
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </td>

                    <td className="px-4 py-3">
                      <Badge tone={row.status === "MATCH" ? "green" : row.status === "MISMATCH" ? "amber" : "red"}>
                        {row.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      {row.status === "MATCH" ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <select
                          className="rounded-xl border border-neutral-300 px-3 py-2"
                          value={row.reason || "Khác"}
                          onChange={(e) => updateRowField(row.sku, "reason", e.target.value)}
                        >
                          {mismatchReasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {row.status === "MATCH" ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <input
                          className="w-full min-w-[160px] rounded-xl border border-neutral-300 px-3 py-2"
                          value={row.note}
                          onChange={(e) => updateRowField(row.sku, "note", e.target.value)}
                          placeholder="Ghi chú"
                        />
                      )}
                    </td>

                    <td className="px-4 py-3">{row.scannedBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.scannedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <h3 className="text-lg font-semibold">Lịch sử phiên kiểm kho</h3>
        <div className="mt-4 space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-neutral-500">Chưa có phiên kiểm kho nào được chốt.</p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{session.name}</p>
                  <Badge tone="blue">{session.mode}</Badge>
                  <Badge tone="green">{session.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  {branches.find((b) => b.id === session.branchId)?.name || session.branchId} · {session.createdAt}
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  {session.totalRows} rows · {session.mismatchRows} mismatch
                </p>
                {session.note ? <p className="mt-2 text-sm text-neutral-600">{session.note}</p> : null}
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}