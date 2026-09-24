import { DEFAULT_BOOKING_SETTINGS } from "@/lib/constants";
import { timeToMinutes } from "@/lib/dates";

/**
 * Table fitting and assignment. Pure functions only — safe to import from
 * client components (no Mongoose).
 */

export interface TableLike {
  _id: string;
  name: string;
  seats: number;
  zone?: string;
}

export interface TableBooking {
  time: string;
  tableIds: string[];
}

/** Do two seatings of `duration` starting at these times overlap? */
export function seatingsOverlap(
  a: string,
  b: string,
  duration: number = DEFAULT_BOOKING_SETTINGS.diningDurationMinutes
) {
  return Math.abs(timeToMinutes(a) - timeToMinutes(b)) < duration;
}

/** Tables with nobody seated at them during [time, time + duration). */
export function freeTablesAt(
  tables: TableLike[],
  bookings: TableBooking[],
  time: string,
  duration: number = DEFAULT_BOOKING_SETTINGS.diningDurationMinutes
) {
  const taken = new Set(
    bookings
      .filter((booking) => seatingsOverlap(booking.time, time, duration))
      .flatMap((booking) => booking.tableIds.map(String))
  );
  return tables.filter((table) => !taken.has(String(table._id)));
}

/**
 * Smallest set of tables that seats a party, preferring one table and the
 * least wasted seats. Joins up to `maxTables` tables in the same zone,
 * because pushing tables together across zones is not practical.
 */
export function pickTables(
  available: TableLike[],
  guests: number,
  maxTables = 3
): TableLike[] | null {
  const sorted = [...available].sort(
    (a, b) => a.seats - b.seats || a.name.localeCompare(b.name)
  );

  const single = sorted.find((table) => table.seats >= guests);
  if (single) return [single];

  // Join tables within a zone, fewest tables first, then least waste.
  const zones = new Map<string, TableLike[]>();
  for (const table of sorted) {
    const zone = table.zone ?? "";
    zones.set(zone, [...(zones.get(zone) ?? []), table]);
  }

  let best: TableLike[] | null = null;
  for (const tables of zones.values()) {
    // Largest first so a join uses as few tables as possible.
    const descending = [...tables].sort((a, b) => b.seats - a.seats);
    for (let size = 2; size <= Math.min(maxTables, descending.length); size++) {
      const combo = descending.slice(0, size);
      const seats = combo.reduce((sum, table) => sum + table.seats, 0);
      if (seats < guests) continue;
      if (
        !best ||
        combo.length < best.length ||
        (combo.length === best.length &&
          seats < best.reduce((sum, table) => sum + table.seats, 0))
      ) {
        best = combo;
      }
      break;
    }
  }
  return best;
}

/** Can this party be seated at this time? */
export function canSeatParty(
  tables: TableLike[],
  bookings: TableBooking[],
  time: string,
  guests: number,
  duration: number = DEFAULT_BOOKING_SETTINGS.diningDurationMinutes
) {
  return pickTables(freeTablesAt(tables, bookings, time, duration), guests) !== null;
}

/** Seats still free during a seating — used for "x seats left" hints. */
export function freeSeatsAt(
  tables: TableLike[],
  bookings: TableBooking[],
  time: string,
  duration: number = DEFAULT_BOOKING_SETTINGS.diningDurationMinutes
) {
  return freeTablesAt(tables, bookings, time, duration).reduce(
    (sum, table) => sum + table.seats,
    0
  );
}
