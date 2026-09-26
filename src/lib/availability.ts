import { ApiError } from "@/lib/api-error";
import {
  DAYS_OF_WEEK,
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  type BillingSettings,
  type BookingSettings,
  type OpeningHour,
} from "@/lib/constants";
import {
  addDaysToKey,
  dayKeyToDate,
  slotInstant,
  timeToMinutes,
  todayKey,
} from "@/lib/dates";
import { peakGuests, type SlotBooking } from "@/lib/seating";
import {
  canSeatParty,
  freeSeatsAt,
  type TableBooking,
  type TableLike,
} from "@/lib/tables";

export function minutesToTime(minutes: number) {
  const total = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

export function bookingSettings(
  settings?: Partial<BookingSettings> | null
): BookingSettings {
  return { ...DEFAULT_BOOKING_SETTINGS, ...(settings ?? {}) };
}

export function billingSettings(
  settings?: Partial<BillingSettings> | null
): BillingSettings {
  return { ...DEFAULT_BILLING_SETTINGS, ...(settings ?? {}) };
}

/** The weekday (0 = Sunday) a Dhaka day key falls on. */
export function weekdayOf(dayKey: string) {
  return dayKeyToDate(dayKey).getUTCDay();
}

export function hoursForDay(hours: OpeningHour[] | undefined, dayKey: string) {
  return hours?.find((entry) => entry.day === weekdayOf(dayKey)) ?? null;
}

export function isClosedOn(
  branch: { hours?: OpeningHour[]; closures?: { date: Date }[] },
  dayKey: string
) {
  const day = hoursForDay(branch.hours, dayKey);
  if (!day || day.closed) return true;
  const stamp = dayKeyToDate(dayKey).getTime();
  return (branch.closures ?? []).some(
    (closure) => new Date(closure.date).getTime() === stamp
  );
}

/**
 * Bookable start times for a day: from opening until the last seating that
 * still finishes by closing time. A closing time past midnight (e.g. 01:00)
 * is treated as belonging to the same service.
 */
export function bookableSlots(
  branch: { hours?: OpeningHour[]; closures?: { date: Date }[] },
  dayKey: string,
  settings: BookingSettings
) {
  if (isClosedOn(branch, dayKey)) return [];
  const day = hoursForDay(branch.hours, dayKey)!;

  const open = timeToMinutes(day.open);
  const closeRaw = timeToMinutes(day.close);
  const close = closeRaw <= open ? closeRaw + 1440 : closeRaw;
  const lastSeating = close - settings.diningDurationMinutes;

  const slots: string[] = [];
  for (
    let minute = open;
    minute <= lastSeating;
    minute += settings.slotIntervalMinutes
  ) {
    slots.push(minutesToTime(minute));
  }
  return slots;
}

export interface SlotStatus {
  time: string;
  seatsLeft: number;
  available: boolean;
  /** Why the slot cannot be booked, for the UI. */
  reason?: "past" | "full" | "party";
}

/**
 * Slot-by-slot availability for a branch on one day. When the branch has
 * tables, a slot is bookable only if the party actually fits on the free
 * tables; otherwise total seat capacity is used.
 */
export function slotAvailability({
  branch,
  dayKey,
  settings,
  capacity,
  bookings,
  tables,
  guests = 1,
  now = new Date(),
}: {
  branch: { hours?: OpeningHour[]; closures?: { date: Date }[] };
  dayKey: string;
  settings: BookingSettings;
  capacity: number;
  bookings: (SlotBooking & { tableIds?: string[] })[];
  tables?: TableLike[];
  guests?: number;
  now?: Date;
}): SlotStatus[] {
  const earliest = now.getTime() + settings.minLeadMinutes * 60_000;
  const partyTooLarge = guests > settings.maxPartySize;
  const useTables = !!tables?.length;
  const tableBookings: TableBooking[] = bookings.map((booking) => ({
    time: booking.time,
    tableIds: booking.tableIds ?? [],
  }));

  return bookableSlots(branch, dayKey, settings).map((time) => {
    const duration = settings.diningDurationMinutes;
    const seatsLeft = useTables
      ? freeSeatsAt(tables!, tableBookings, time, duration)
      : Math.max(0, capacity - peakGuests(bookings, time, duration));
    const fits = useTables
      ? canSeatParty(tables!, tableBookings, time, guests, duration)
      : seatsLeft >= guests;

    if (partyTooLarge) {
      return { time, seatsLeft, available: false, reason: "party" as const };
    }
    if (slotInstant(dayKey, time).getTime() < earliest) {
      return { time, seatsLeft, available: false, reason: "past" as const };
    }
    if (!fits) {
      return { time, seatsLeft, available: false, reason: "full" as const };
    }
    return { time, seatsLeft, available: true };
  });
}

/**
 * Validates a booking request against the restaurant's rules and the
 * branch's schedule. Throws ApiError with a guest-readable message.
 * Capacity is checked separately, when the reservation is inserted.
 */
export function assertBookable({
  branch,
  branchName,
  dayKey,
  time,
  guests,
  settings,
  now = new Date(),
  mode = "public",
}: {
  branch: { hours?: OpeningHour[]; closures?: { date: Date }[] };
  branchName: string;
  dayKey: string;
  time: string;
  guests: number;
  settings: BookingSettings;
  now?: Date;
  /** Staff booking by phone: opening hours and capacity still apply, but
   *  lead time and the how-far-ahead limit do not. */
  mode?: "public" | "staff";
}) {
  if (guests > settings.maxPartySize) {
    throw new ApiError(
      `Parties of more than ${settings.maxPartySize} need to be arranged with the restaurant directly`,
      400
    );
  }

  const today = todayKey(now);
  if (dayKey < today) {
    throw new ApiError("Please choose a date in the future", 400);
  }
  if (mode === "public" && dayKey > addDaysToKey(today, settings.maxDaysAhead)) {
    throw new ApiError(
      `Bookings open up to ${settings.maxDaysAhead} days in advance`,
      400
    );
  }

  if (isClosedOn(branch, dayKey)) {
    throw new ApiError(
      `${branchName} is closed on ${DAYS_OF_WEEK[weekdayOf(dayKey)]}, ${dayKey}`,
      409
    );
  }

  if (!bookableSlots(branch, dayKey, settings).includes(time)) {
    const day = hoursForDay(branch.hours, dayKey)!;
    throw new ApiError(
      `${branchName} takes bookings between ${day.open} and ${day.close} — ${time} is outside serving hours`,
      409
    );
  }

  const leadMs = slotInstant(dayKey, time).getTime() - now.getTime();
  if (mode === "staff") {
    if (leadMs < -settings.diningDurationMinutes * 60_000) {
      throw new ApiError("That seating has already finished", 400);
    }
    return;
  }
  if (leadMs < settings.minLeadMinutes * 60_000) {
    const hours = settings.minLeadMinutes / 60;
    throw new ApiError(
      settings.minLeadMinutes >= 60
        ? `Please book at least ${hours % 1 === 0 ? hours : hours.toFixed(1)} hour(s) ahead`
        : `Please book at least ${settings.minLeadMinutes} minutes ahead`,
      400
    );
  }
}

/** Human-readable weekly hours, e.g. "Sat–Thu 12:00–23:00 · Fri closed". */
export function describeHours(hours: OpeningHour[] | undefined) {
  if (!hours?.length) return "";
  // Bangladeshi weeks run Saturday to Friday.
  const order = [6, 0, 1, 2, 3, 4, 5];
  const short = (day: number) => DAYS_OF_WEEK[day].slice(0, 3);

  const groups: { days: number[]; label: string }[] = [];
  for (const day of order) {
    const entry = hours.find((h) => h.day === day);
    if (!entry) continue;
    const label = entry.closed ? "closed" : `${entry.open}–${entry.close}`;
    const last = groups.at(-1);
    if (last && last.label === label) last.days.push(day);
    else groups.push({ days: [day], label });
  }

  return groups
    .map(({ days, label }) => {
      const span =
        days.length === 1
          ? short(days[0])
          : days.length === 7
            ? "Daily"
            : `${short(days[0])}–${short(days.at(-1)!)}`;
      return `${span} ${label}`;
    })
    .join(" · ");
}
