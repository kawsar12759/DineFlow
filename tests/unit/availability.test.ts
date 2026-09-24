import { describe, expect, it } from "vitest";
import {
  assertBookable,
  bookableSlots,
  bookingSettings,
  describeHours,
  isClosedOn,
  slotAvailability,
} from "@/lib/availability";
import { DEFAULT_OPENING_HOURS } from "@/lib/constants";
import { slotInstant } from "@/lib/dates";
import { ApiError } from "@/lib/api-error";

const hours = (open: string, close: string, closedDays: number[] = []) =>
  DEFAULT_OPENING_HOURS.map((entry) => ({
    ...entry,
    open,
    close,
    closed: closedDays.includes(entry.day),
  }));

const settings = bookingSettings();
// 2026-09-23 is a Wednesday; 2026-09-25 a Friday.
const WED = "2026-09-23";
const FRI = "2026-09-25";

describe("bookableSlots", () => {
  it("runs from opening to the last seating that finishes by closing", () => {
    const slots = bookableSlots({ hours: hours("12:00", "15:00") }, WED, settings);
    // 90-minute seatings every 30 minutes: 12:00 … 13:30 (ends 15:00).
    expect(slots).toEqual(["12:00", "12:30", "13:00", "13:30"]);
  });

  it("follows the restaurant's slot interval and dining duration", () => {
    const slots = bookableSlots({ hours: hours("18:00", "21:00") }, WED, {
      ...settings,
      slotIntervalMinutes: 60,
      diningDurationMinutes: 120,
    });
    expect(slots).toEqual(["18:00", "19:00"]);
  });

  it("handles closing after midnight", () => {
    const slots = bookableSlots({ hours: hours("22:00", "01:00") }, WED, settings);
    expect(slots).toEqual(["22:00", "22:30", "23:00", "23:30"]);
  });

  it("is empty on a closed weekday or a closure date", () => {
    const branch = { hours: hours("12:00", "23:00", [5]) };
    expect(bookableSlots(branch, FRI, settings)).toEqual([]);
    expect(isClosedOn(branch, FRI)).toBe(true);

    const closed = {
      hours: hours("12:00", "23:00"),
      closures: [{ date: new Date(`${WED}T00:00:00Z`) }],
    };
    expect(isClosedOn(closed, WED)).toBe(true);
    expect(bookableSlots(closed, WED, settings)).toEqual([]);
  });
});

describe("slotAvailability", () => {
  const branch = { hours: hours("18:00", "22:00") };
  const now = slotInstant("2026-09-22", "12:00"); // the day before

  it("reports seats left and marks full slots", () => {
    const slots = slotAvailability({
      branch,
      dayKey: WED,
      settings,
      capacity: 10,
      bookings: [{ time: "19:00", guests: 8 }],
      guests: 4,
      now,
    });

    const at19 = slots.find((slot) => slot.time === "19:00")!;
    expect(at19).toMatchObject({ seatsLeft: 2, available: false, reason: "full" });
    // 20:30 starts after the 19:00 party's 90 minutes are over.
    expect(slots.find((slot) => slot.time === "20:30")).toMatchObject({
      seatsLeft: 10,
      available: true,
    });
  });

  it("marks slots inside the lead time as past", () => {
    const slots = slotAvailability({
      branch,
      dayKey: WED,
      settings,
      capacity: 10,
      bookings: [],
      now: slotInstant(WED, "18:30"),
    });
    expect(slots.find((slot) => slot.time === "18:00")?.reason).toBe("past");
    expect(slots.find((slot) => slot.time === "19:00")?.reason).toBe("past");
    // Default lead time is 60 minutes, so 19:30 is the first bookable slot.
    expect(slots.find((slot) => slot.time === "19:30")?.available).toBe(true);
  });
});

describe("assertBookable", () => {
  const branch = { hours: hours("18:00", "22:00", [5]) };
  const base = {
    branch,
    branchName: "Gulshan",
    guests: 2,
    settings,
    now: slotInstant("2026-09-22", "12:00"),
  };
  const expectError = (fn: () => void, match: RegExp) => {
    expect(fn).toThrow(ApiError);
    expect(fn).toThrow(match);
  };

  it("accepts a slot inside serving hours", () => {
    expect(() =>
      assertBookable({ ...base, dayKey: WED, time: "19:00" })
    ).not.toThrow();
  });

  it("rejects times outside serving hours", () => {
    expectError(
      () => assertBookable({ ...base, dayKey: WED, time: "09:00" }),
      /outside serving hours/
    );
    // 21:00 + 90 minutes would run past closing.
    expectError(
      () => assertBookable({ ...base, dayKey: WED, time: "21:00" }),
      /outside serving hours/
    );
  });

  it("rejects closed days, past dates and parties that are too large", () => {
    expectError(
      () => assertBookable({ ...base, dayKey: FRI, time: "19:00" }),
      /closed on Friday/
    );
    expectError(
      () => assertBookable({ ...base, dayKey: "2020-01-01", time: "19:00" }),
      /date in the future/
    );
    expectError(
      () => assertBookable({ ...base, dayKey: WED, time: "19:00", guests: 99 }),
      /more than 20/
    );
  });

  it("enforces lead time and how far ahead guests may book", () => {
    expectError(
      () =>
        assertBookable({
          ...base,
          dayKey: WED,
          time: "19:00",
          now: slotInstant(WED, "18:30"),
        }),
      /at least 1 hour/
    );
    expectError(
      () => assertBookable({ ...base, dayKey: "2027-09-23", time: "19:00" }),
      /60 days in advance/
    );
  });

  it("lets staff book by phone outside those two limits", () => {
    const staff = { ...base, mode: "staff" as const };
    expect(() =>
      assertBookable({
        ...staff,
        dayKey: WED,
        time: "19:00",
        now: slotInstant(WED, "18:55"),
      })
    ).not.toThrow();
    expect(() =>
      assertBookable({ ...staff, dayKey: "2027-09-23", time: "19:00" })
    ).not.toThrow();
    // Opening hours still apply to staff.
    expectError(
      () => assertBookable({ ...staff, dayKey: FRI, time: "19:00" }),
      /closed on Friday/
    );
  });
});

describe("describeHours", () => {
  it("groups days that share the same hours", () => {
    expect(describeHours(hours("12:00", "23:00"))).toBe("Daily 12:00–23:00");
    expect(describeHours(hours("17:00", "23:00", [5]))).toBe(
      "Sat–Thu 17:00–23:00 · Fri closed"
    );
  });
});
