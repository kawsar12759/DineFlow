import type { Types } from "mongoose";
import { Reservation } from "@/models";
import {
  ACTIVE_RESERVATION_STATUSES,
  DEFAULT_BOOKING_SETTINGS,
} from "@/lib/constants";
import { peakGuests } from "@/lib/seating";

export { peakGuests, type SlotBooking } from "@/lib/seating";

/**
 * Race-safe capacity check, run right after a reservation is inserted.
 * Only reservations created before this one (by ObjectId order, which every
 * concurrent request sees the same way) count. So when two requests race for
 * the last seats, the later one is rejected and the earlier one kept.
 * Returns false (and deletes the reservation) when the branch would be overbooked.
 */
export async function claimSlotCapacity(
  reservation: {
    _id: Types.ObjectId;
    branchId: Types.ObjectId;
    date: Date;
    time: string;
  },
  capacity: number,
  duration: number = DEFAULT_BOOKING_SETTINGS.diningDurationMinutes
) {
  const sameDay = await Reservation.find({
    branchId: reservation.branchId,
    date: reservation.date,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    _id: { $lte: reservation._id },
  })
    .select("time guests")
    .lean();

  if (peakGuests(sameDay, reservation.time, duration) <= capacity) return true;

  await Reservation.deleteOne({ _id: reservation._id });
  return false;
}
