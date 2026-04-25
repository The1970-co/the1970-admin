import {
  badgeToneClass,
  getFulfillmentStatusLabel,
  getFulfillmentStatusTone,
  getOrderStatusLabel,
  getOrderStatusTone,
  getPaymentStatusLabel,
  getPaymentStatusTone,
} from "@/lib/order-status-ui";

type Props = {
  type: "order" | "payment" | "fulfillment";
  value?: string | null;
  className?: string;
};

export default function StatusBadge({
  type,
  value,
  className = "",
}: Props) {
  const label =
    type === "order"
      ? getOrderStatusLabel(value)
      : type === "payment"
        ? getPaymentStatusLabel(value)
        : getFulfillmentStatusLabel(value);

  const tone =
    type === "order"
      ? getOrderStatusTone(value)
      : type === "payment"
        ? getPaymentStatusTone(value)
        : getFulfillmentStatusTone(value);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeToneClass(
        tone
      )} ${className}`}
    >
      {label}
    </span>
  );
}