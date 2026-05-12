export type BadgeTone =
  | "gray"
  | "blue"
  | "orange"
  | "purple"
  | "green"
  | "red"
  | "yellow";

export const ORDER_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới tạo",
  APPROVED: "Đã duyệt",
  PACKING: "Đang xử lý",
  SHIPPED: "Đã gửi hàng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  PENDING_COD: "Chờ thu COD",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thanh toán lỗi",
};

export const FULFILLMENT_STATUS_LABEL: Record<string, string> = {
  UNFULFILLED: "Chưa xử lý",
  PROCESSING: "Đang đóng gói",
  PARTIAL: "Giao một phần",
  SHIPPED: "Đã giao hãng",
  FULFILLED: "Đã giao thành công",
  DELIVERED: "Đã giao thành công",
  RETURNED: "Đã trả hàng",
};

export const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "gray",
  APPROVED: "blue",
  PACKING: "orange",
  SHIPPED: "purple",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const PAYMENT_STATUS_TONE: Record<string, BadgeTone> = {
  UNPAID: "yellow",
  PARTIAL: "orange",
  PAID: "green",
  PENDING_COD: "blue",
  REFUNDED: "purple",
  FAILED: "red",
};

export const FULFILLMENT_STATUS_TONE: Record<string, BadgeTone> = {
  UNFULFILLED: "gray",
  PROCESSING: "orange",
  PARTIAL: "orange",
  SHIPPED: "blue",
  FULFILLED: "green",
  DELIVERED: "green",
  RETURNED: "purple",
};

export function getOrderStatusLabel(status?: string | null) {
  if (!status) return "—";
  return ORDER_STATUS_LABEL[status] || status;
}

export function getPaymentStatusLabel(status?: string | null) {
  if (!status) return "—";
  return PAYMENT_STATUS_LABEL[status] || status;
}

export function getFulfillmentStatusLabel(status?: string | null) {
  if (!status) return "—";
  return FULFILLMENT_STATUS_LABEL[status] || status;
}

export function getOrderStatusTone(status?: string | null): BadgeTone {
  if (!status) return "gray";
  return ORDER_STATUS_TONE[status] || "gray";
}

export function getPaymentStatusTone(status?: string | null): BadgeTone {
  if (!status) return "gray";
  return PAYMENT_STATUS_TONE[status] || "gray";
}

export function getFulfillmentStatusTone(status?: string | null): BadgeTone {
  if (!status) return "gray";
  return FULFILLMENT_STATUS_TONE[status] || "gray";
}

export function badgeToneClass(tone: BadgeTone) {
  switch (tone) {
    case "blue":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "orange":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "purple":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "green":
      return "border-green-200 bg-green-50 text-green-700";
    case "red":
      return "border-red-200 bg-red-50 text-red-700";
    case "yellow":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "gray":
    default:
      return "border-neutral-200 bg-neutral-100 text-neutral-700";
  }
}