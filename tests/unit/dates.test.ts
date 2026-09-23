import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  currentTime,
  dateToDayKey,
  dayKeyToDate,
  dayStartInstant,
  isDayKey,
  monthStartKey,
  slotInstant,
  todayKey,
} from "@/lib/dates";

describe("dates (Asia/Dhaka)", () => {
  it("uses the Dhaka calendar day, not UTC", () => {
    // 20:30 UTC on 20 Sep is 02:30 on 21 Sep in Dhaka.
    const lateUtc = new Date("2026-09-20T20:30:00Z");
    expect(todayKey(lateUtc)).toBe("2026-09-21");
    expect(currentTime(lateUtc)).toBe("02:30");
  });

  it("stores calendar days as UTC midnight and round-trips", () => {
    const stored = dayKeyToDate("2026-09-21");
    expect(stored.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(dateToDayKey(stored)).toBe("2026-09-21");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysToKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds month starts with offsets", () => {
    expect(monthStartKey("2026-09-21")).toBe("2026-09-01");
    expect(monthStartKey("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("converts Dhaka wall-clock times to real instants", () => {
    expect(dayStartInstant("2026-09-21").toISOString()).toBe(
      "2026-09-20T18:00:00.000Z"
    );
    expect(slotInstant("2026-09-21", "19:30").toISOString()).toBe(
      "2026-09-21T13:30:00.000Z"
    );
  });

  it("validates day keys", () => {
    expect(isDayKey("2026-09-21")).toBe(true);
    expect(isDayKey("2026-9-21")).toBe(false);
    expect(isDayKey("2026-09-21T10:00:00Z")).toBe(false);
    expect(isDayKey("not-a-date")).toBe(false);
  });
});
