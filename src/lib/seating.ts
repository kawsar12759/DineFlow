import { DEFAULT_BOOKING_SETTINGS } from "@/lib/constants";

/**
 * Pure seating maths, safe to import from client components — it must not
 * pull in Mongoose models (see capacity.ts for the database-side checks).
 */

export interface SlotBooking {
  time: string;
  guests: number;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Highest number of guests seated at once during a party's stay
 * [time, time + duration). Occupancy only rises when a booking starts, so the
 * peak is at the new party's start or at a later booking's start inside the window.
 */
export function peakGuests(
  bookings: SlotBooking[],
  time: string,
  duration: number = DEFAULT_BOOKING_SETTINGS.diningDurationMinutes
) {
  const start = timeToMinutes(time);
  const end = start + duration;
  const intervals = bookings.map((booking) => {
    const bookingStart = timeToMinutes(booking.time);
    return {
      start: bookingStart,
      end: bookingStart + duration,
      guests: booking.guests,
    };
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
