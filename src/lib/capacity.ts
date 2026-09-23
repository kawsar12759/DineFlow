import type { Types } from "mongoose";
import { Reservation } from "@/models";
import {
  ACTIVE_RESERVATION_STATUSES,
  DINING_DURATION_MINUTES,
} from "@/lib/constants";
import { timeToMinutes } from "@/lib/dates";

export interface SlotBooking {
  time: string;
  guests: number;
}

/**
 * Highest number of guests seated at once during a party's stay
 * [time, time + duration). Occupancy only rises when a booking starts, so the
 * peak is at the new party's start or at a later booking's start inside the window.
 */
export function peakGuests(
  bookings: SlotBooking[],
  time: string,
  duration = DINING_DURATION_MINUTES
) {
  const start = timeToMinutes(time);
  const end = start + duration;
  const intervals = bookings.map((booking) => {
    const bookingStart = timeToMinutes(booking.time);
    return { start: bookingStart, end: bookingStart + duration, guests: booking.guests };
  });

  const checkpoints = [
    start,
    ...intervals.map((i) => i.start).filter((s) => s > start && s < end),
  ];

  return Math.max(
    0,
    ...checkpoints.map((point) =>
      intervals
        .filter((i) => i.start <= point && point < i.end)
        .reduce((sum, i) => sum + i.guests, 0)
    )
  );
}

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
  capacity: number
) {
  const sameDay = await Reservation.find({
    branchId: reservation.branchId,
    date: reservation.date,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    _id: { $lte: reservation._id },
  })
    .select("time guests")
    .lean();

  if (peakGuests(sameDay, reservation.time) <= capacity) return true;

  await Reservation.deleteOne({ _id: reservation._id });
  return false;
}
