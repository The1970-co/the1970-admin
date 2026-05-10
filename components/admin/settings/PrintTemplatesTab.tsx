"use client";

import { useMemo, useState } from "react";
import {
  buildDefaultPrintTemplates,
  getBranchOptions,
  loadPrintTemplates,
  type PrintPaperSize,
  type PrintTemplateConfig,
  type PrintTemplateType,
  savePrintTemplates,
} from "@/lib/print-template-config";
import { renderTemplatePreviewHtml } from "@/lib/print-template-engine";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-neutral-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
}) {
  const tones =
    variant === "primary"
      ? "bg-neutral-900 text-white border-neutral-900"
      : variant === "danger"
        ? "bg-red-600 text-white border-red-600"
        : "bg-white text-neutral-900 border-neutral-300";

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium ${tones}`}
      type="button"
    >
      {children}
    </button>
  );
}

const typeOptions: { value: PrintTemplateType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả loại mẫu" },
  { value: "shipping", label: "Phiếu giao hàng" },
  { value: "sales", label: "Phiếu bán hàng" },
  { value: "transfer", label: "Phiếu nhập / chuyển kho" },
  { value: "product_label", label: "Tem sản phẩm" },
];

const paperOptions: PrintPaperSize[] = ["50mm", "80mm", "A4", "A5"];

function typeLabel(type: PrintTemplateType) {
  if (type === "shipping") return "Phiếu giao hàng";
  if (type === "sales") return "Phiếu bán hàng";
  if (type === "product_label") return "Tem sản phẩm";
  return "Phiếu nhập / chuyển kho";
}

function fieldVisible(
  selected: PrintTemplateConfig,
  key: keyof PrintTemplateConfig,
) {
  const value = selected[key];
  return typeof value === "boolean" ? value : true;
}

const printFieldGroups: Array<{
  title: string;
  items: Array<{ key: keyof PrintTemplateConfig; label: string }>;
}> = [
  {
    title: "Thông tin đơn / khách",
    items: [
      { key: "showOrderCode", label: "Hiện mã đơn" },
      { key: "showCreatedAt", label: "Hiện ngày tạo" },
      { key: "showCustomerName", label: "Hiện người nhận / khách" },
      { key: "showCustomerPhone", label: "Hiện SĐT" },
      { key: "showShippingAddress", label: "Hiện địa chỉ" },
    ],
  },
  {
    title: "Hàng hoá / thanh toán",
    items: [
      { key: "showItems", label: "Hiện bảng sản phẩm" },
      { key: "showItemQty", label: "Hiện cột SL" },
      { key: "showCod", label: "Hiện COD" },
      { key: "showShippingFee", label: "Hiện phí ship" },
      { key: "showNote", label: "Hiện ghi chú" },
    ],
  },
  {
    title: "Mã quét / cuối phiếu",
    items: [
      { key: "showBarcode", label: "Hiện mã vạch" },
      { key: "showQr", label: "Hiện QR" },
      { key: "showFooter", label: "Hiện ghi chú cuối phiếu" },
    ],
  },
];

export default function PrintTemplatesTab() {
  const [rows, setRows] = useState<PrintTemplateConfig[]>(() =>
    loadPrintTemplates(),
  );
  const [selectedId, setSelectedId] = useState<string>(
    () => loadPrintTemplates()[0]?.id || "",
  );
  const [filterBranch, setFilterBranch] = useState("ALL");
  const [filterType, setFilterType] = useState<"ALL" | PrintTemplateType>(
    "ALL",
  );
  const [savedMsg, setSavedMsg] = useState("");

  const selected = rows.find((r) => r.id === selectedId) || null;
  const branchOptions = getBranchOptions();

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const okBranch = filterBranch === "ALL" || r.branchId === filterBranch;
      const okType = filterType === "ALL" || r.templateType === filterType;
      return okBranch && okType;
    });
  }, [rows, filterBranch, filterType]);

  const previewHtml = useMemo(() => {
    if (!selected) return "";
    return renderTemplatePreviewHtml(selected);
  }, [selected]);

  const updateSelected = (patch: Partial<PrintTemplateConfig>) => {
    if (!selected) return;
    setRows((prev) =>
      prev.map((row) => (row.id === selected.id ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = () => {
    savePrintTemplates(rows);
    setSavedMsg("Đã lưu cấu hình mẫu in.");
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const handleResetDefaults = () => {
    const ok = window.confirm("Khôi phục toàn bộ mẫu in mặc định?");
    if (!ok) return;
    const defaults = buildDefaultPrintTemplates();
    setRows(defaults);
    setSelectedId(defaults[0]?.id || "");
    savePrintTemplates(defaults);
    setSavedMsg("Đã khôi phục mẫu mặc định.");
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const resetSelectedTemplate = () => {
    if (!selected) return;

    const defaults = buildDefaultPrintTemplates();
    const replacement = defaults.find(
      (row) =>
        row.branchId === selected.branchId &&
        row.templateType === selected.templateType &&
        row.paperSize === selected.paperSize,
    );

    if (!replacement) return;

    const updated = {
      ...replacement,
      id: selected.id,
      isDefault: selected.isDefault,
    };

    setRows((prev) =>
      prev.map((row) => (row.id === selected.id ? updated : row)),
    );
    setSelectedId(selected.id);
    setSavedMsg("Đã reset riêng mẫu đang chọn. Bấm Lưu cấu hình để áp dụng.");
    setTimeout(() => setSavedMsg(""), 2500);
  };

  const setAsDefault = () => {
    if (!selected) return;
    setRows((prev) =>
      prev.map((row) => {
        if (
          row.branchId === selected.branchId &&
          row.templateType === selected.templateType &&
          row.paperSize === selected.paperSize
        ) {
          return {
            ...row,
            isDefault: row.id === selected.id,
          };
        }
        return row;
      }),
    );
  };

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Mẫu in
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Cấu hình template in mặc định theo chi nhánh. Các checkbox sẽ ăn
              vào preview và bản in thật.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} variant="primary">
              Lưu cấu hình
            </Button>
            <Button onClick={handleResetDefaults} variant="danger">
              Khôi phục mặc định
            </Button>
          </div>
        </div>

        {savedMsg ? (
          <p className="mt-3 text-sm text-emerald-600">{savedMsg}</p>
        ) : null}
      </Panel>

      <Panel className="p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <select
            className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
          >
            <option value="ALL">Tất cả chi nhánh</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            className="h-12 rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value as "ALL" | PrintTemplateType)
            }
          >
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[0.7fr_0.75fr_1fr]">
        <Panel className="overflow-hidden">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h4 className="text-lg font-semibold text-neutral-900">
              Danh sách mẫu
            </h4>
          </div>

          <div className="max-h-[72vh] overflow-auto">
            {filteredRows.map((row) => (
              <button
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`block w-full border-b border-neutral-100 px-5 py-4 text-left hover:bg-neutral-50 ${
                  selectedId === row.id ? "bg-neutral-50" : "bg-white"
                }`}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {row.name}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {row.branchName} · {typeLabel(row.templateType)} ·{" "}
                      {row.paperSize}
                    </p>
                  </div>

                  {row.isDefault ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      Mặc định
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          {!selected ? (
            <p className="text-sm text-neutral-500">
              Chọn một mẫu để chỉnh sửa.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xl font-semibold text-neutral-900">
                    {selected.name}
                  </h4>
                  <p className="mt-1 text-sm text-neutral-500">
                    {selected.branchName} · {typeLabel(selected.templateType)} ·{" "}
                    {selected.paperSize}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={resetSelectedTemplate}>Reset mẫu này</Button>
                  <Button onClick={setAsDefault}>Đặt mặc định</Button>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Tên mẫu
                  </label>
                  <input
                    className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Tiêu đề
                    </label>
                    <input
                      className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                      value={selected.title}
                      onChange={(e) =>
                        updateSelected({ title: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Khổ giấy
                    </label>
                    <select
                      className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                      value={selected.paperSize}
                      onChange={(e) =>
                        updateSelected({
                          paperSize: e.target.value as PrintPaperSize,
                        })
                      }
                    >
                      {paperOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Tên cửa hàng / kho
                  </label>
                  <input
                    className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selected.storeName}
                    onChange={(e) =>
                      updateSelected({ storeName: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      SĐT cửa hàng
                    </label>
                    <input
                      className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                      value={selected.storePhone}
                      onChange={(e) =>
                        updateSelected({ storePhone: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Ghi chú cuối phiếu
                    </label>
                    <input
                      className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                      value={selected.footerNote}
                      onChange={(e) =>
                        updateSelected({ footerNote: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Địa chỉ cửa hàng
                  </label>
                  <input
                    className="h-12 w-full rounded-2xl border border-neutral-300 px-4 text-sm outline-none"
                    value={selected.storeAddress}
                    onChange={(e) =>
                      updateSelected({ storeAddress: e.target.value })
                    }
                  />
                </div>

                {printFieldGroups.map((group) => (
                  <div key={group.title}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {group.title}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {group.items.map((item) => (
                        <label
                          key={String(item.key)}
                          className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700"
                        >
                          <input
                            type="checkbox"
                            checked={fieldVisible(selected, item.key)}
                            onChange={(e) =>
                              updateSelected({
                                [item.key]: e.target.checked,
                              } as Partial<PrintTemplateConfig>)
                            }
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    HTML template
                  </label>
                  <textarea
                    value={selected.templateHtml}
                    onChange={(e) =>
                      updateSelected({ templateHtml: e.target.value })
                    }
                    className="min-h-[420px] w-full rounded-2xl border border-neutral-300 px-4 py-3 text-xs outline-none"
                  />
                  <p className="mt-2 text-xs text-neutral-500">
                    Muốn checkbox ăn chuẩn nhất thì dùng template mặc định mới
                    có token block: orderMetaBlock, customerBlock, itemsBlock,
                    financialBlock, barcodeBlock, qrBlock, footerBlock.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="mb-3">
            <h4 className="text-lg font-semibold text-neutral-900">
              Xem trước
            </h4>
            <p className="mt-1 text-sm text-neutral-500">
              Preview đang render bằng dữ liệu demo thật, có barcode + QR.
            </p>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
            <div
              className="mx-auto bg-white p-4 shadow-sm"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
