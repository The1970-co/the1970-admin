"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustInventory,
  auditSapoFile,
  auditTwoSapoFiles,
  getInventoryMovements,
  getInventorySummary,
  getMissingCostProducts,
  importStockReport,
  transferInventory,
  updateMissingCostBulk,
  type InventoryMovementRow,
  type InventorySummary,
  type MissingCostItem,
} from "@/lib/inventory-action-api";

type TabKey =
  | "missing-cost"
  | "lock-cost"
  | "ledger"
  | "inventory-layers"
  | "upload-stock"
  | "adjust"
  | "transfer";

type Props = {
  currentUser?: any;
  defaultBranchId?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const cardClass =
  "rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-md";

export default function InventoryActionCenter({
  currentUser,
  defaultBranchId,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("ledger");
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [missingCostRows, setMissingCostRows] = useState<MissingCostItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [costInputs, setCostInputs] = useState<Record<string, string>>({});

  const [adjustForm, setAdjustForm] = useState({
    variantId: "",
    branchId: defaultBranchId || "",
    qty: "1",
    type: "IN" as "IN" | "OUT" | "SET",
    note: "",
  });

  const [transferForm, setTransferForm] = useState({
    variantId: "",
    fromBranchId: defaultBranchId || "",
    toBranchId: "",
    qty: "1",
    note: "",
  });

  const [stockFile, setStockFile] = useState<File | null>(null);
  const [auditFile, setAuditFile] = useState<File | null>(null);
  const [stockReportFile, setStockReportFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const role = String(currentUser?.role || "").toLowerCase();
  const roles = Array.isArray(currentUser?.roles)
    ? currentUser.roles.map((item: any) => String(item || "").toLowerCase())
    : [];
  const isAdmin = role === "owner" || role === "admin" || roles.includes("owner") || roles.includes("admin");

  function getPermissionKeys() {
    const keys = new Set<string>();

    if (Array.isArray(currentUser?.permissions)) {
      currentUser.permissions.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray(currentUser?.permissionKeys)) {
      currentUser.permissionKeys.forEach((key: any) => {
        if (key) keys.add(String(key));
      });
    }

    if (Array.isArray(currentUser?.branchPermissions)) {
      currentUser.branchPermissions.forEach((row: any) => {
        if (Array.isArray(row?.permissionKeys)) {
          row.permissionKeys.forEach((key: any) => {
            if (key) keys.add(String(key));
          });
        }
      });
    }

    return keys;
  }

  function can(permission: string) {
    if (isAdmin) return true;
    const keys = getPermissionKeys();
    return keys.has("*") || keys.has(permission);
  }

  const canViewInventory = can("inventory.view");
  const canViewLogs = can("inventory.logs.view");
  const canViewCost = can("inventory.value.view") || can("products.cost.view");
  const canEditCost = can("products.cost.edit") || can("purchase_receipt.cost.edit");
  const canImportStockReport = can("inventory.excel.import");
  const canAuditExcel = can("inventory.excel.audit");
  const canAdjustInventory = can("inventory.adjust") || can("inventory.manage");
  const canTransferInventory = can("inventory.transfer") || can("inventory.manage");

  const tabPermissions: Record<TabKey, boolean> = {
    "missing-cost": canViewCost || canEditCost,
    "lock-cost": canViewCost || canEditCost,
    "ledger": canViewLogs,
    "inventory-layers": canViewInventory,
    "upload-stock": canImportStockReport || canAuditExcel,
    "adjust": canAdjustInventory,
    "transfer": canTransferInventory,
  };

  const adminOnlyTabs: TabKey[] = [
    "missing-cost",
    "lock-cost",
    "upload-stock",
    "adjust",
    "transfer",
  ];

  const missingCostCount = missingCostRows.length;

  async function reloadSummary() {
    const data = await getInventorySummary(defaultBranchId);
    setSummary(data);
  }

  async function loadMissingCost() {
    setLoading(true);
    setError("");
    try {
      const res = await getMissingCostProducts();
      setMissingCostRows(res.data || []);
      const nextInputs: Record<string, string> = {};
      for (const item of res.data || []) {
        nextInputs[item.id] = "";
      }
      setCostInputs(nextInputs);
    } catch (err: any) {
      setError(err.message || "Không tải được SKU thiếu giá nhập.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements() {
    setLoading(true);
    setError("");
    try {
      const rows = await getInventoryMovements(100);
      setMovements(rows || []);
    } catch (err: any) {
      setError(err.message || "Không tải được ledger kho.");
    } finally {
      setLoading(false);
    }
  }

  async function reloadAll() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([reloadSummary(), loadMissingCost(), loadMovements()]);
    } catch (err: any) {
      setError(err.message || "Không tải được dữ liệu kho.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBranchId]);

  useEffect(() => {
    if (!tabPermissions[activeTab]) {
      setActiveTab(canViewLogs ? "ledger" : "inventory-layers");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canViewLogs, tabPermissions]);

  async function saveMissingCosts() {
    if (!canEditCost) {
      setError("Bạn không có quyền cập nhật giá vốn.");
      return;
    }

    const items = Object.entries(costInputs)
      .map(([variantId, raw]) => ({
        variantId,
        costPrice: Number(String(raw || "").replace(/[^\d]/g, "")),
        sku: missingCostRows.find((x) => x.id === variantId)?.sku,
      }))
      .filter((item) => item.costPrice > 0);

    if (!items.length) {
      setError("Chưa nhập giá vốn hợp lệ.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await updateMissingCostBulk(items);
      setMessage(`Đã cập nhật ${res.updated} SKU thiếu giá vốn.`);
      await Promise.all([loadMissingCost(), reloadSummary()]);
    } catch (err: any) {
      setError(err.message || "Cập nhật giá vốn thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAdjust() {
    if (!canAdjustInventory) {
      setError("Bạn không có quyền điều chỉnh kho.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await adjustInventory({
        variantId: adjustForm.variantId.trim(),
        branchId: adjustForm.branchId.trim(),
        qty: Number(adjustForm.qty),
        type: adjustForm.type,
        note: adjustForm.note.trim(),
      });
      setMessage("Đã điều chỉnh kho và ghi ledger.");
      await Promise.all([reloadSummary(), loadMovements()]);
    } catch (err: any) {
      setError(err.message || "Điều chỉnh kho thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function submitTransfer() {
    if (!canTransferInventory) {
      setError("Bạn không có quyền chuyển kho.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await transferInventory({
        variantId: transferForm.variantId.trim(),
        fromBranchId: transferForm.fromBranchId.trim(),
        toBranchId: transferForm.toBranchId.trim(),
        qty: Number(transferForm.qty),
        note: transferForm.note.trim(),
      });
      setMessage("Đã chuyển kho và ghi ledger 2 chiều.");
      await Promise.all([reloadSummary(), loadMovements()]);
    } catch (err: any) {
      setError(err.message || "Chuyển kho thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function submitImportStock() {
    if (!canImportStockReport) {
      setError("Bạn không có quyền import tồn kho.");
      return;
    }

    if (!stockFile) {
      setError("Chưa chọn file báo cáo tồn kho.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setUploadResult(null);

    try {
      const res = await importStockReport(stockFile);
      setUploadResult(res);
      setMessage("Import tồn kho thành công.");
      await Promise.all([reloadSummary(), loadMissingCost(), loadMovements()]);
    } catch (err: any) {
      setError(err.message || "Import tồn kho thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAuditOneFile() {
    if (!canAuditExcel) {
      setError("Bạn không có quyền đối chiếu SAPO.");
      return;
    }

    if (!auditFile) {
      setError("Chưa chọn file SAPO để đối chiếu.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setUploadResult(null);

    try {
      const res = await auditSapoFile(auditFile);
      setUploadResult(res);
      setMessage("Đã đối chiếu file SAPO.");
    } catch (err: any) {
      setError(err.message || "Đối chiếu thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAuditTwoFiles() {
    if (!canAuditExcel) {
      setError("Bạn không có quyền đối chiếu SAPO.");
      return;
    }

    if (!stockReportFile || !productFile) {
      setError("Cần chọn đủ 2 file: báo cáo tồn kho và danh sách sản phẩm.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setUploadResult(null);

    try {
      const res = await auditTwoSapoFiles(stockReportFile, productFile);
      setUploadResult(res);
      setMessage("Đã đối chiếu 2 file SAPO.");
    } catch (err: any) {
      setError(err.message || "Đối chiếu 2 file thất bại.");
    } finally {
      setLoading(false);
    }
  }

  const cards = useMemo(
    () => [
      {
        key: "missing-cost" as TabKey,
        title: "SP thiếu giá nhập",
        value: missingCostCount,
        desc: "Bấm để xem SKU thiếu cost và cập nhật hàng loạt.",
      },
      {
        key: "lock-cost" as TabKey,
        title: "Lock Cost",
        value: missingCostCount > 0 ? "Đang cảnh báo" : "OK",
        desc: "SKU thiếu giá vốn sẽ bị chặn khi thao tác kho.",
      },
      {
        key: "ledger" as TabKey,
        title: "Ledger kho",
        value: movements.length,
        desc: "Lịch sử nhập/xuất/chuyển/điều chỉnh kho.",
      },
      {
        key: "inventory-layers" as TabKey,
        title: "Inventory 2 lớp",
        value: summary ? money(summary.totalQty) : "—",
        desc: "availableQty / reservedQty / incomingQty.",
      },
      {
        key: "upload-stock" as TabKey,
        title: "Upload báo cáo tồn kho",
        value: "Excel",
        desc: "Import hoặc đối chiếu file SAPO.",
      },
      {
        key: "adjust" as TabKey,
        title: "Điều chỉnh kho",
        value: "IN/OUT/SET",
        desc: "Nhập, xuất hoặc set tồn cho SKU.",
      },
      {
        key: "transfer" as TabKey,
        title: "Chuyển kho",
        value: "2 chiều",
        desc: "Trừ kho gửi, cộng kho nhận, ghi ledger.",
      },
    ],
    [missingCostCount, movements.length, summary],
  );

  const visibleCards = useMemo(
    () => cards.filter((card) => tabPermissions[card.key]),
    [cards, tabPermissions],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visibleCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => {
              setActiveTab(card.key);
              setError("");
              setMessage("");
              if (card.key === "missing-cost" || card.key === "lock-cost") loadMissingCost();
              if (card.key === "ledger") loadMovements();
            }}
            className={`${cardClass} ${
              activeTab === card.key ? "border-neutral-950 ring-2 ring-neutral-950/10" : ""
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {card.title}
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-950">{card.value}</div>
            <div className="mt-1 text-sm text-neutral-500">{card.desc}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-950">
              {visibleCards.find((x) => x.key === activeTab)?.title}
            </h2>
            <p className="text-sm text-neutral-500">
              {isAdmin
                ? "Admin/Owner được thao tác đầy đủ."
                : "Nhân viên chỉ xem tồn kho và ledger được phân quyền."}
            </p>
          </div>

          <button
            type="button"
            onClick={reloadAll}
            disabled={loading || !canEditCost}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
          >
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        ) : null}

        {(canViewCost || canEditCost) && (activeTab === "missing-cost" || activeTab === "lock-cost") ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-neutral-900">
                Tổng SKU thiếu giá vốn: {missingCostRows.length}
              </div>

              {canEditCost ? (
                <button
                  type="button"
                  onClick={saveMissingCosts}
                  disabled={loading}
                  className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Lưu giá vốn hàng loạt
                </button>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Sản phẩm</th>
                    <th className="px-3 py-2">Màu</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Giá vốn</th>
                  </tr>
                </thead>
                <tbody>
                  {missingCostRows.map((item) => (
                    <tr key={item.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-semibold">{item.sku || "—"}</td>
                      <td className="px-3 py-2">{item.product?.name || "—"}</td>
                      <td className="px-3 py-2">{item.color || "—"}</td>
                      <td className="px-3 py-2">{item.size || "—"}</td>
                      <td className="px-3 py-2">
                        {isAdmin ? (
                          <input
                            value={costInputs[item.id] || ""}
                            onChange={(e) =>
                              setCostInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="VD: 226000"
                            className="w-36 rounded-lg border border-neutral-200 px-3 py-2"
                          />
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                            Thiếu giá vốn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!missingCostRows.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                        Không còn SKU thiếu giá vốn.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "ledger" ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Sản phẩm</th>
                  <th className="px-3 py-2">Kho</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">SL</th>
                  <th className="px-3 py-2">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{row.createdAt}</td>
                    <td className="px-3 py-2 font-semibold">{row.sku || "—"}</td>
                    <td className="px-3 py-2">{row.productName || "—"}</td>
                    <td className="px-3 py-2">{row.branchId}</td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2 font-bold">{row.qty}</td>
                    <td className="px-3 py-2">{row.note || row.refType || "—"}</td>
                  </tr>
                ))}

                {!movements.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                      Chưa có ledger kho.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeTab === "inventory-layers" ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500">availableQty</div>
              <div className="mt-1 text-2xl font-bold">{summary ? money(summary.totalQty) : "—"}</div>
              <div className="mt-1 text-xs text-neutral-500">Tồn bán được.</div>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500">reservedQty</div>
              <div className="mt-1 text-2xl font-bold">Đọc từ inventory list</div>
              <div className="mt-1 text-xs text-neutral-500">Tồn đã giữ cho đơn, cần nối thêm order reserve.</div>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500">incomingQty</div>
              <div className="mt-1 text-2xl font-bold">Đọc từ inventory list</div>
              <div className="mt-1 text-xs text-neutral-500">Hàng đang chuyển về, cần nối stock transfer pending.</div>
            </div>
          </div>
        ) : null}

        {(canImportStockReport || canAuditExcel) && activeTab === "upload-stock" ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="font-bold">Import báo cáo tồn kho</div>
              <p className="mt-1 text-sm text-neutral-500">
                Ghi DB thật. Chỉ dùng khi đã chắc file đúng.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setStockFile(e.target.files?.[0] || null)}
                className="mt-4 block w-full text-sm"
              />
              <button
                type="button"
                onClick={submitImportStock}
                disabled={loading || !canImportStockReport}
                className="mt-4 rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Import vào DB
              </button>
            </div>

            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="font-bold">Đối chiếu 1 file SAPO</div>
              <p className="mt-1 text-sm text-neutral-500">
                So file với hệ thống, chưa ghi DB.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setAuditFile(e.target.files?.[0] || null)}
                className="mt-4 block w-full text-sm"
              />
              <button
                type="button"
                onClick={submitAuditOneFile}
                disabled={loading || !canAuditExcel}
                className="mt-4 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold hover:bg-neutral-50 disabled:opacity-50"
              >
                Đối chiếu
              </button>
            </div>

            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="font-bold">Đối chiếu 2 file SAPO</div>
              <p className="mt-1 text-sm text-neutral-500">
                Báo cáo tồn kho + danh sách sản phẩm.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setStockReportFile(e.target.files?.[0] || null)}
                className="mt-4 block w-full text-sm"
              />
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setProductFile(e.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm"
              />
              <button
                type="button"
                onClick={submitAuditTwoFiles}
                disabled={loading || !canAuditExcel}
                className="mt-4 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold hover:bg-neutral-50 disabled:opacity-50"
              >
                Đối chiếu 2 file
              </button>
            </div>

            {uploadResult ? (
              <pre className="xl:col-span-3 max-h-96 overflow-auto rounded-xl bg-neutral-950 p-4 text-xs text-white">
                {JSON.stringify(uploadResult, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}

        {canAdjustInventory && activeTab === "adjust" ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={adjustForm.variantId}
              onChange={(e) => setAdjustForm((p) => ({ ...p, variantId: e.target.value }))}
              placeholder="variantId"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <input
              value={adjustForm.branchId}
              onChange={(e) => setAdjustForm((p) => ({ ...p, branchId: e.target.value }))}
              placeholder="branchId VD: CL"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <input
              value={adjustForm.qty}
              onChange={(e) => setAdjustForm((p) => ({ ...p, qty: e.target.value }))}
              placeholder="Số lượng"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <select
              value={adjustForm.type}
              onChange={(e) =>
                setAdjustForm((p) => ({ ...p, type: e.target.value as "IN" | "OUT" | "SET" }))
              }
              className="rounded-xl border border-neutral-200 px-3 py-2"
            >
              <option value="IN">Nhập thêm</option>
              <option value="OUT">Xuất bớt</option>
              <option value="SET">Set tồn</option>
            </select>
            <input
              value={adjustForm.note}
              onChange={(e) => setAdjustForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Lý do"
              className="md:col-span-2 rounded-xl border border-neutral-200 px-3 py-2"
            />
            <button
              type="button"
              onClick={submitAdjust}
              disabled={loading || !canImportStockReport}
              className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Ghi điều chỉnh kho
            </button>
          </div>
        ) : null}

        {canTransferInventory && activeTab === "transfer" ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={transferForm.variantId}
              onChange={(e) => setTransferForm((p) => ({ ...p, variantId: e.target.value }))}
              placeholder="variantId"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <input
              value={transferForm.qty}
              onChange={(e) => setTransferForm((p) => ({ ...p, qty: e.target.value }))}
              placeholder="Số lượng"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <input
              value={transferForm.fromBranchId}
              onChange={(e) => setTransferForm((p) => ({ ...p, fromBranchId: e.target.value }))}
              placeholder="Kho chuyển VD: QO"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <input
              value={transferForm.toBranchId}
              onChange={(e) => setTransferForm((p) => ({ ...p, toBranchId: e.target.value }))}
              placeholder="Kho nhận VD: CL"
              className="rounded-xl border border-neutral-200 px-3 py-2"
            />
            <input
              value={transferForm.note}
              onChange={(e) => setTransferForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Ghi chú"
              className="md:col-span-2 rounded-xl border border-neutral-200 px-3 py-2"
            />
            <button
              type="button"
              onClick={submitTransfer}
              disabled={loading || !canImportStockReport}
              className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Ghi chuyển kho
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
