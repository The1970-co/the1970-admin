"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import {
  bulkDeleteStockTransfers,
  cancelStockTransfer,
  completeStockTransfer,
  confirmStockTransfer,
  getStockTransferDetail,
  type StockTransfer,
} from "@/lib/stock-transfers-api";
import {
  findPrintTemplate,
  loadPrintTemplates,
  type PrintPaperSize,
  type PrintTemplateConfig,
} from "@/lib/print-template-config";
import {
  openPrintDocument,
  renderOrderTemplateHtml,
} from "@/lib/print-template-engine";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
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
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

function statusBadge(status?: string) {
  if (status === "COMPLETED") return <Badge tone="green">Hoàn tất</Badge>;
  if (status === "CANCELLED") return <Badge tone="red">Đã hủy</Badge>;
  if (status === "CONFIRMED") return <Badge tone="blue">Chờ nhận hàng</Badge>;
  if (status === "IN_TRANSIT") return <Badge tone="blue">Đang chuyển</Badge>;
  if (status === "PENDING") return <Badge tone="amber">Chờ xác nhận</Badge>;
  return <Badge tone="amber">Nháp</Badge>;
}

function formatDateTime(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

type EditItem = {
  rowId: string;
  variantId: string;
  sku: string;
  productName: string;
  color?: string;
  size?: string;
  qty: string;
};

function getTransferItemKey(item: any, index: number) {
  return String(item?.id || item?.variantId || `${index}`);
}

export default function StockTransferDetailPageClient({
  transferId,
}: {
  transferId: string;
}) {
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [editItems, setEditItems] = useState<EditItem[]>([]);

  async function loadDetail() {
    try {
      setLoading(true);
      setError(null);
      const data = await getStockTransferDetail(transferId);
      setTransfer(data);
      setEditNote(data?.note || "");
      setEditItems(
        (Array.isArray(data?.items) ? data.items : []).map((item: any, index: number) => ({
          rowId: getTransferItemKey(item, index),
          variantId: item.variantId || item.variant?.id || "",
          sku: item.sku || item.variant?.sku || "",
          productName: item.productName || item.variant?.product?.name || "",
          color: item.color || item.variant?.color || "",
          size: item.size || item.variant?.size || "",
          qty: String(Number(item.qty || 0)),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết phiếu chuyển kho.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId]);

  const items = Array.isArray(transfer?.items) ? transfer.items : [];
  const totalQty = useMemo(
    () => items.reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0),
    [items],
  );

  const editTotalQty = useMemo(
    () => editItems.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [editItems],
  );

  const fromName =
    transfer?.fromBranch?.name ||
    (transfer as any)?.fromBranchName ||
    transfer?.fromBranchId ||
    "—";
  const toName =
    transfer?.toBranch?.name ||
    (transfer as any)?.toBranchName ||
    transfer?.toBranchId ||
    "—";

  const senderName =
    (transfer as any)?.confirmedByName ||
    (transfer as any)?.sentByName ||
    (transfer as any)?.senderName ||
    (transfer as any)?.createdByName ||
    "—";
  const sentAt =
    (transfer as any)?.confirmedAt ||
    (transfer as any)?.sentAt ||
    (transfer as any)?.createdAt;
  const receiverName =
    (transfer as any)?.completedByName ||
    (transfer as any)?.receivedByName ||
    (transfer as any)?.receiverName ||
    (transfer as any)?.receivedBy?.name ||
    "—";
  const receivedAt =
    (transfer as any)?.completedAt ||
    (transfer as any)?.receivedAt ||
    null;

  const canEditDraft = transfer?.status === "DRAFT" || transfer?.status === "PENDING";
  const canConfirm = transfer?.status === "DRAFT" || transfer?.status === "PENDING";
  const canReceive = transfer?.status === "CONFIRMED" || transfer?.status === "IN_TRANSIT";
  const canCancel = transfer?.status !== "COMPLETED" && transfer?.status !== "CANCELLED";
  const canDelete = transfer?.status === "DRAFT" || transfer?.status === "PENDING" || transfer?.status === "CANCELLED";

  function buildTransferPrintOrder(currentTransfer: StockTransfer) {
    const mappedItems = (currentTransfer.items || []).map((item: any) => ({
      productName: item.productName || item.name || item.variant?.product?.name || "Sản phẩm",
      sku: item.sku || item.variant?.sku || "",
      color: item.color || item.variant?.color || "",
      size: item.size || item.variant?.size || "",
      qty: Number(item.qty ?? item.quantity ?? 0),
    }));

    const printTotalQty = mappedItems.reduce(
      (sum: number, item: any) => sum + Number(item.qty || 0),
      0,
    );

    return {
      ...currentTransfer,
      referenceCode: currentTransfer.transferCode || currentTransfer.id,
      orderCode: currentTransfer.transferCode || currentTransfer.id,
      createdAt: formatDateTime((currentTransfer as any).createdAt || (currentTransfer as any).updatedAt),
      branchName: `${fromName} → ${toName}`,
      warehouseName: "THE 1970",
      warehousePhone: "",
      warehouseAddress: "",
      customerName: `${toName} - ${receiverName}`,
      shippingRecipientName: receiverName,
      customerPhone: "",
      shippingPhone: "",
      note: [
        `Kho gửi: ${fromName}`,
        `Người gửi: ${senderName}`,
        `Thời gian gửi: ${formatDateTime(sentAt)}`,
        `Kho nhận: ${toName}`,
        `Người nhận: ${receiverName}`,
        `Thời gian nhận: ${formatDateTime(receivedAt)}`,
        currentTransfer.note ? `Ghi chú: ${currentTransfer.note}` : "",
      ].filter(Boolean).join(" | "),
      items: mappedItems,
      totalQty: printTotalQty,
    };
  }

  function getTransferPrintTemplate(paperSize: PrintPaperSize) {
    const templates = loadPrintTemplates();
    return (
      findPrintTemplate({
        templates,
        branchId: "__default__",
        templateType: "transfer",
        paperSize,
      }) ||
      templates.find(
        (template) => template.templateType === "transfer" && template.paperSize === paperSize,
      ) ||
      null
    );
  }

  function printTransfer(paperSize: PrintPaperSize) {
    if (!transfer) return;

    const template = getTransferPrintTemplate(paperSize);
    if (!template) {
      setError(`Chưa có mẫu in phiếu chuyển kho khổ ${paperSize}.`);
      return;
    }

    const normalizedTemplate = {
      ...template,
      showOrderCode: (template as any).showOrderCode !== false,
      showCreatedAt: (template as any).showCreatedAt !== false,
      showCustomerName: (template as any).showCustomerName !== false,
      showCustomerPhone: (template as any).showCustomerPhone === true,
      showShippingAddress: (template as any).showShippingAddress === true,
      showItems: (template as any).showItems !== false,
      showItemQty: (template as any).showItemQty !== false,
      showBarcode: template.showBarcode !== false,
      showQr: template.showQr !== false,
      showNote: template.showNote !== false,
    } as PrintTemplateConfig;

    const bodyHtml = `<div class="print-page"><div class="print-page-inner">${renderOrderTemplateHtml({
      order: buildTransferPrintOrder(transfer),
      template: normalizedTemplate,
    })}</div></div>`;

    openPrintDocument({
      title: `In phiếu kho ${transfer.transferCode || transfer.id}`,
      paperSize,
      bodyHtml,
    });
  }

  function updateEditItem(rowId: string, qty: string) {
    setEditItems((prev) =>
      prev.map((item) => (item.rowId === rowId ? { ...item, qty } : item)),
    );
  }

  function removeEditItem(rowId: string) {
    setEditItems((prev) => prev.filter((item) => item.rowId !== rowId));
  }

  async function saveEdit() {
    if (!transfer) return;

    const validItems = editItems
      .map((item) => ({ ...item, qtyNumber: Number(item.qty || 0) }))
      .filter((item) => item.variantId && item.qtyNumber > 0);

    if (!validItems.length) {
      setError("Phiếu chuyển kho phải có ít nhất 1 dòng hàng.");
      return;
    }

    try {
      setBusyAction("save");
      setError(null);
      setNotice(null);

      const res = await apiFetch(`/stock-transfers/${transfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBranchId: transfer.fromBranchId,
          toBranchId: transfer.toBranchId,
          note: editNote.trim() || undefined,
          items: validItems.map((item) => ({
            variantId: item.variantId,
            qty: item.qtyNumber,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Không lưu được phiếu chuyển kho.");
      }

      setNotice("Đã lưu thay đổi phiếu chuyển kho.");
      setEditMode(false);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được phiếu chuyển kho.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(action: "confirm" | "receive" | "cancel" | "delete") {
    if (!transfer) return;

    const confirmText = {
      confirm: "Xác nhận chuyển phiếu này?",
      receive: "Xác nhận bên nhận đã nhận đủ hàng? Sau bước này hệ thống sẽ trừ/cộng kho.",
      cancel: "Hủy phiếu chuyển kho này?",
      delete: `Xóa hẳn phiếu ${transfer.transferCode || transfer.id}? Hành động này không hoàn tác.`,
    }[action];

    if (!window.confirm(confirmText)) return;

    try {
      setBusyAction(action);
      setError(null);
      setNotice(null);

      if (action === "confirm") {
        await confirmStockTransfer(transfer.id);
        setNotice("Đã xác nhận chuyển kho.");
      }

      if (action === "receive") {
        await completeStockTransfer(transfer.id);
        setNotice("Đã xác nhận nhận đủ và hoàn tất chuyển kho.");
      }

      if (action === "cancel") {
        await cancelStockTransfer(transfer.id);
        setNotice("Đã hủy phiếu chuyển kho.");
      }

      if (action === "delete") {
        await bulkDeleteStockTransfers([transfer.id]);
        setNotice("Đã xóa phiếu chuyển kho.");
        window.setTimeout(() => window.close(), 500);
        return;
      }

      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được thao tác.");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <Panel className="p-4">
          <p className="text-sm text-neutral-500">Đang tải chi tiết phiếu chuyển kho...</p>
        </Panel>
      </div>
    );
  }

  if (error && !transfer) {
    return (
      <div className="space-y-4 p-5">
        <Panel className="p-4">
          <p className="text-sm text-red-600">{error || "Không tìm thấy phiếu chuyển kho."}</p>
        </Panel>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="space-y-4 p-5">
        <Panel className="p-4">
          <p className="text-sm text-red-600">Không tìm thấy phiếu chuyển kho.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-3xl bg-neutral-950 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              THE 1970 WAREHOUSE
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-[30px] font-semibold tracking-tight">
                {transfer.transferCode || transfer.id}
              </h2>
              {statusBadge(transfer.status)}
            </div>
            <p className="mt-1 text-sm text-neutral-300">
              {fromName} → {toName}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => printTransfer("80mm")}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              In phiếu kho
            </button>
            <button
              type="button"
              onClick={() => printTransfer("A4")}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              In A4
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              Đóng tab
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Tổng số lượng</p>
            <p className="mt-1 text-2xl font-semibold">{editMode ? editTotalQty : totalQty}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Số dòng SKU</p>
            <p className="mt-1 text-2xl font-semibold">{editMode ? editItems.length : items.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Người tạo</p>
            <p className="mt-1 text-sm font-semibold">{(transfer as any).createdByName || "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <p className="text-xs text-neutral-400">Thời gian tạo</p>
            <p className="mt-1 text-sm font-semibold">{formatDateTime((transfer as any).createdAt)}</p>
          </div>
        </div>
      </div>

      <Panel className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Thao tác phiếu</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              In, sửa phiếu nháp, xác nhận chuyển/nhận đủ, hủy hoặc xóa phiếu test.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {editMode && canEditDraft ? (
              <>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={busyAction === "save"}
                  className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === "save" ? "Đang lưu..." : "Lưu sửa"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setEditNote(transfer.note || "");
                    setEditItems(
                      items.map((item: any, index: number) => ({
                        rowId: getTransferItemKey(item, index),
                        variantId: item.variantId || item.variant?.id || "",
                        sku: item.sku || item.variant?.sku || "",
                        productName: item.productName || item.variant?.product?.name || "",
                        color: item.color || item.variant?.color || "",
                        size: item.size || item.variant?.size || "",
                        qty: String(Number(item.qty || 0)),
                      })),
                    );
                  }}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Hủy sửa
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!canEditDraft) return;
                  setEditMode(true);
                }}
                disabled={!canEditDraft || Boolean(busyAction)}
                title={canEditDraft ? "Sửa phiếu nháp/chờ xác nhận" : "Chỉ sửa được phiếu Nháp hoặc Chờ xác nhận"}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
              >
                Sửa phiếu
              </button>
            )}

            <button
              type="button"
              onClick={() => void runAction("confirm")}
              disabled={!canConfirm || Boolean(busyAction)}
              title={canConfirm ? "Xác nhận kho gửi đã chuyển hàng" : "Chỉ xác nhận chuyển khi phiếu còn Nháp/Chờ xác nhận"}
              className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              {busyAction === "confirm" ? "Đang xác nhận..." : "Xác nhận chuyển"}
            </button>

            <button
              type="button"
              onClick={() => void runAction("receive")}
              disabled={!canReceive || Boolean(busyAction)}
              title={canReceive ? "Xác nhận kho nhận đã nhận đủ hàng" : "Chỉ nhận đủ sau khi phiếu đã xác nhận chuyển"}
              className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              {busyAction === "receive" ? "Đang nhận..." : "Xác nhận nhận đủ"}
            </button>

            <button
              type="button"
              onClick={() => void runAction("cancel")}
              disabled={!canCancel || Boolean(busyAction)}
              title={canCancel ? "Hủy phiếu chuyển kho" : "Phiếu đã hoàn tất/đã hủy thì không hủy tiếp được"}
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              {busyAction === "cancel" ? "Đang hủy..." : "Hủy phiếu"}
            </button>

            <button
              type="button"
              onClick={() => void runAction("delete")}
              disabled={!canDelete || Boolean(busyAction)}
              title={canDelete ? "Xóa phiếu nháp/chờ xác nhận" : "Chỉ xóa được phiếu Nháp hoặc Chờ xác nhận để tránh lệch tồn kho"}
              className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              {busyAction === "delete" ? "Đang xóa..." : "Xóa phiếu"}
            </button>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="p-3">
          <p className="text-sm text-red-600">{error}</p>
        </Panel>
      ) : null}

      {notice ? (
        <Panel className="p-3">
          <p className="text-sm text-green-700">{notice}</p>
        </Panel>
      ) : null}

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-neutral-500">Kho xuất</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{fromName}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Kho nhận</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{toName}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Nguồn tạo</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{(transfer as any).sourceType || "MANUAL"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Mã nguồn</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{(transfer as any).sourceRefId || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Người gửi</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{senderName}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Thời gian gửi</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{formatDateTime(sentAt)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Người nhận</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{receiverName}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Thời gian nhận</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{formatDateTime(receivedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Ghi chú</p>
            {editMode ? (
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none"
                placeholder="Ghi chú phiếu chuyển kho"
              />
            ) : (
              <p className="mt-1 text-sm font-semibold text-neutral-900">{transfer.note || "—"}</p>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="border-b border-neutral-200 p-4">
          <p className="text-sm font-semibold text-neutral-900">Danh sách sản phẩm chuyển kho</p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Màu</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Số lượng</th>
                {editMode ? <th className="px-4 py-3 text-right">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {(editMode ? editItems : items).map((item: any, index: number) => {
                const rowId = editMode ? item.rowId : getTransferItemKey(item, index);
                return (
                  <tr key={rowId} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-semibold text-neutral-900">{item.sku || item.variant?.sku || "—"}</td>
                    <td className="px-4 py-3 text-neutral-700">{item.productName || item.variant?.product?.name || "—"}</td>
                    <td className="px-4 py-3 text-neutral-700">{item.color || item.variant?.color || "—"}</td>
                    <td className="px-4 py-3 text-neutral-700">{item.size || item.variant?.size || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                      {editMode ? (
                        <input
                          value={item.qty}
                          onChange={(e) => updateEditItem(rowId, e.target.value)}
                          className="ml-auto w-24 rounded-xl border border-neutral-300 px-3 py-2 text-right text-sm outline-none"
                          inputMode="numeric"
                        />
                      ) : (
                        Number(item.qty || 0)
                      )}
                    </td>
                    {editMode ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeEditItem(rowId)}
                          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                        >
                          Xóa dòng
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
