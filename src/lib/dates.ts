import { TIMEZONE } from "@/lib/constants";

/**
 * Date conventions (Bangladesh time, UTC+6, no daylight saving):
 *
 * - A "day key" is a Dhaka calendar day as "YYYY-MM-DD".
 * - Calendar-day fields (e.g. `Reservation.date`) are stored as UTC midnight
 *   of their day key, so "2026-09-21" is stored as 2026-09-21T00:00:00Z.
 *   Grouping those fields in MongoDB therefore uses UTC.
 * - Real timestamps (`createdAt`, etc.) are true instants; group them with
 *   `timezone: TIMEZONE` in aggregations.
 */

const DHAKA_UTC_OFFSET = "+06:00";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function isDayKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** The Dhaka calendar day an instant falls on. */
export function dayKeyOf(instant: Date) {
  return dayKeyFormatter.format(instant);
}

/** Today's Dhaka calendar day. */
export function todayKey(now = new Date()) {
  return dayKeyOf(now);
}

/** Current Dhaka wall-clock time as "HH:MM". */
export function currentTime(now = new Date()) {
  return timeFormatter.format(now);
}

/** Stored value for a calendar-day field: UTC midnight of the day key. */
export function dayKeyToDate(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

/** Day key of a stored calendar-day field. */
export function dateToDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysToKey(key: string, days: number) {
  return dateToDayKey(new Date(dayKeyToDate(key).getTime() + days * DAY_MS));
}

/** First day of the month containing `key`, shifted by `monthOffset` months. */
export function monthStartKey(key: string, monthOffset = 0) {
  const date = dayKeyToDate(key);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + monthOffset);
  return dateToDayKey(date);
}

/** The real instant a Dhaka day begins (for filtering timestamps). */
export function dayStartInstant(key: string) {
  return new Date(`${key}T00:00:00${DHAKA_UTC_OFFSET}`);
}

/** The real instant of a Dhaka day + "HH:MM" wall-clock time. */
export function slotInstant(key: string, time: string) {
  return new Date(`${key}T${time}:00${DHAKA_UTC_OFFSET}`);
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
