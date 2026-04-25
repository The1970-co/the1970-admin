"use client";

import {
  ORDER_TIMELINE,
  getTimelineStepIndex,
  OrderStatus,
} from "@/lib/orders/order-status";

type Props = {
  status: OrderStatus;
};

export default function OrderTimeline({ status }: Props) {
  const activeIndex = getTimelineStepIndex(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ORDER_TIMELINE.map((step, index) => {
        const done = index <= activeIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-black text-white"
                  : "border border-neutral-300 text-neutral-400"
              }`}
            >
              {index + 1}
            </div>

            <span
              className={`text-sm ${
                done ? "text-black" : "text-neutral-400"
              }`}
            >
              {step.label}
            </span>

            {index < ORDER_TIMELINE.length - 1 && (
              <div className="h-px w-8 bg-neutral-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}