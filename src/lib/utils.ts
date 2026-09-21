import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY_SYMBOL, LOCALE, TIMEZONE } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "en-IN" gives the lakh/crore digit grouping used in Bangladesh (12,34,567).
const wholeAmount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const fractionalAmount = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a BDT amount, e.g. ৳12,34,567 or ৳450.50. */
export function formatCurrency(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const formatter = Number.isInteger(abs) ? wholeAmount : fractionalAmount;
  return `${sign}${CURRENCY_SYMBOL}${formatter.format(abs)}`;
}

/** Short BDT amount for chart axes: ৳950, ৳12.5K, ৳3.4L, ৳1.2Cr. */
export function formatCompactCurrency(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const units: [number, string][] = [
    [10_000_000, "Cr"],
    [100_000, "L"],
    [1_000, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const value = Math.round((abs / size) * 10) / 10;
      return `${sign}${CURRENCY_SYMBOL}${value}${suffix}`;
    }
  }
  return `${sign}${CURRENCY_SYMBOL}${Math.round(abs)}`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// Day-first dates ("21 Sep 2026") built from parts, because some ICU
// versions abbreviate September as "Sept" in en-GB.
function formatDayMonth(date: Date, timeZone: string, withYear: boolean) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return [get("day"), get("month"), withYear ? get("year") : undefined]
    .filter(Boolean)
    .join(" ");
}

/** Formats a date in Bangladesh time, e.g. "21 Sep 2026". */
export function formatDate(date: string | Date) {
  return formatDayMonth(new Date(date), TIMEZONE, true);
}

/** Formats a "YYYY-MM-DD" day key as "21 Sep" without timezone shifting. */
export function formatDayKey(key: string) {
  return formatDayMonth(new Date(`${key}T00:00:00Z`), "UTC", false);
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
