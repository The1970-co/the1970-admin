"use client";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Xác nhận",
  description,
  confirmText = "Xác nhận",
  cancelText = "Huỷ",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* ICON */}
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <span className={danger ? "text-red-500" : "text-neutral-700"}>
            {danger ? "⚠️ Hành động nguy hiểm" : "Xác nhận thao tác"}
          </span>
        </div>

        {/* TITLE */}
        <h2 className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>

        {/* DESC */}
        {description && (
          <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
            {description}
          </p>
        )}

        {/* ACTION */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-neutral-900 hover:bg-neutral-800"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}