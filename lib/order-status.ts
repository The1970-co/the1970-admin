export type OrderStatus =
  | "NEW"
  | "APPROVED"
  | "PACKING"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "PENDING_COD"
  | "REFUNDED"
  | "FAILED";

export type OrderAction =
  | "approve"
  | "start_packing"
  | "ship"
  | "complete"
  | "cancel"
  | "sync_shipment";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Đặt hàng",
  APPROVED: "Duyệt",
  PACKING: "Đóng gói",
  SHIPPED: "Xuất kho",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  PENDING_COD: "COD chờ thu",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thanh toán lỗi",
};

export const ORDER_ACTION_LABEL: Record<OrderAction, string> = {
  approve: "Duyệt",
  start_packing: "Đóng gói",
  ship: "Xuất kho",
  complete: "Hoàn thành",
  cancel: "Hủy đơn",
  sync_shipment: "Đồng bộ GHN",
};

export function getOrderActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case "NEW":
      return ["approve", "cancel"];
    case "APPROVED":
      return ["start_packing", "cancel"];
    case "PACKING":
      return ["ship", "cancel"];
    case "SHIPPED":
      return ["sync_shipment", "complete"];
    default:
      return [];
  }
}

export const ORDER_TIMELINE = [
  { key: "NEW", label: "Đặt hàng" },
  { key: "APPROVED", label: "Duyệt" },
  { key: "PACKING", label: "Đóng gói" },
  { key: "SHIPPED", label: "Xuất kho" },
  { key: "COMPLETED", label: "Hoàn thành" },
] as const;

export const CREATE_ORDER_MODES = [
  {
    value: "draft",
    title: "Tạo nháp",
    description: "Lưu đơn ở bước đặt hàng.",
    targetStatus: "NEW",
  },
  {
    value: "approve",
    title: "Tạo và duyệt",
    description: "Chuyển đơn sang bước duyệt để kho xử lý.",
    targetStatus: "APPROVED",
  },
  {
    value: "ship",
    title: "Tạo và xuất kho",
    description: "Đi thẳng tới xuất kho và gửi vận chuyển.",
    targetStatus: "SHIPPED",
  },
] as const;

export function getTimelineStepIndex(status: OrderStatus) {
  return ORDER_TIMELINE.findIndex((step) => step.key === status);
}