import { describe, expect, it } from "vitest";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDayKey,
} from "@/lib/utils";

describe("BDT formatting", () => {
  it("uses ৳ with lakh/crore grouping", () => {
    expect(formatCurrency(1234567)).toBe("৳12,34,567");
    expect(formatCurrency(450.5)).toBe("৳450.50");
    expect(formatCurrency(-90)).toBe("-৳90");
  });

  it("abbreviates for chart axes", () => {
    expect(formatCompactCurrency(950)).toBe("৳950");
    expect(formatCompactCurrency(12_500)).toBe("৳12.5K");
    expect(formatCompactCurrency(345_000)).toBe("৳3.5L");
    expect(formatCompactCurrency(12_000_000)).toBe("৳1.2Cr");
  });
});

describe("date formatting", () => {
  it("shows dates in Dhaka time, day first", () => {
    expect(formatDate("2026-09-20T20:00:00Z")).toBe("21 Sep 2026");
  });

  it("formats day keys without shifting", () => {
    expect(formatDayKey("2026-09-01")).toBe("1 Sep");
  });
});
