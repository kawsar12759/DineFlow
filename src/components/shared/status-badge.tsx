import { cn } from "@/lib/utils";
import {
  RESERVATION_STATUS_META,
  type ReservationStatus,
} from "@/lib/constants";

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = RESERVATION_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}
