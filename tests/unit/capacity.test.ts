import { describe, expect, it } from "vitest";
import { peakGuests } from "@/lib/capacity";

describe("peakGuests (90-minute seatings)", () => {
  it("is zero with no bookings", () => {
    expect(peakGuests([], "19:00")).toBe(0);
  });

  it("counts a party still seated from an earlier slot", () => {
    // 18:30 party is seated until 20:00, so it overlaps a 19:00 arrival.
    expect(peakGuests([{ time: "18:30", guests: 6 }], "19:00")).toBe(6);
  });

  it("ignores a party that has already left", () => {
    expect(peakGuests([{ time: "17:30", guests: 6 }], "19:00")).toBe(0);
  });

  it("counts parties arriving during the stay", () => {
    expect(peakGuests([{ time: "20:00", guests: 4 }], "19:00")).toBe(4);
    expect(peakGuests([{ time: "20:30", guests: 4 }], "19:00")).toBe(0);
  });

  it("takes the peak, not the sum of everything in the window", () => {
    // 18:00 leaves at 19:30; 20:00 arrives after that. They never overlap each other.
    const bookings = [
      { time: "18:00", guests: 10 },
      { time: "20:00", guests: 8 },
    ];
    expect(peakGuests(bookings, "19:00")).toBe(10);
  });

  it("adds up parties seated at the same moment", () => {
    const bookings = [
      { time: "19:00", guests: 4 },
      { time: "19:30", guests: 5 },
      { time: "18:00", guests: 3 },
    ];
    // At 19:30: 19:00 (4) + 19:30 (5); the 18:00 party left at 19:30.
    expect(peakGuests(bookings, "19:00")).toBe(9);
  });
});
