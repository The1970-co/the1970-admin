"use client";

type CreateOrderMode = "draft" | "approve" | "ship";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: CreateOrderMode) => void;
};

const MODES = [
  {
    value: "draft" as const,
    title: "Tạo nháp",
    description: "Lưu đơn ở bước đặt hàng.",
  },
  {
    value: "approve" as const,
    title: "Tạo và duyệt",
    description: "Chuyển đơn sang bước duyệt để kho xử lý.",
  },
  {
    value: "ship" as const,
    title: "Tạo và xuất kho",
    description: "Đi thẳng tới xuất kho và gửi vận chuyển.",
  },
];

export default function CreateOrderModePicker({
  open,
  onClose,
  onSelect,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">Chọn cách tạo đơn</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Mỗi lựa chọn sẽ đưa đơn tới một bước xử lý khác nhau.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onSelect(mode.value)}
              className="flex w-full items-start justify-between rounded-2xl border border-neutral-200 p-4 text-left transition hover:border-black hover:bg-neutral-50"
            >
              <div>
                <div className="text-base font-semibold">{mode.title}</div>
                <div className="mt-1 text-sm text-neutral-500">
                  {mode.description}
                </div>
              </div>

              <div className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white">
                Chọn
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}