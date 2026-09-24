import { describe, expect, it } from "vitest";
import {
  canSeatParty,
  freeSeatsAt,
  freeTablesAt,
  pickTables,
  seatingsOverlap,
} from "@/lib/tables";

const tables = [
  { _id: "t2a", name: "T1", seats: 2, zone: "Main" },
  { _id: "t2b", name: "T2", seats: 2, zone: "Main" },
  { _id: "t4", name: "T3", seats: 4, zone: "Main" },
  { _id: "t6", name: "T4", seats: 6, zone: "Terrace" },
];

describe("seatingsOverlap", () => {
  it("overlaps within the dining duration", () => {
    expect(seatingsOverlap("19:00", "20:00", 90)).toBe(true);
    expect(seatingsOverlap("19:00", "20:30", 90)).toBe(false);
    expect(seatingsOverlap("19:00", "17:45", 90)).toBe(true);
  });
});

describe("freeTablesAt", () => {
  it("excludes tables held by an overlapping booking", () => {
    const free = freeTablesAt(
      tables,
      [{ time: "18:30", tableIds: ["t4"] }],
      "19:00",
      90
    );
    expect(free.map((t) => t._id)).toEqual(["t2a", "t2b", "t6"]);
  });

  it("frees tables once the earlier party has left", () => {
    const free = freeTablesAt(
      tables,
      [{ time: "17:00", tableIds: ["t4"] }],
      "19:00",
      90
    );
    expect(free).toHaveLength(4);
  });
});

describe("pickTables", () => {
  it("uses the smallest table that fits", () => {
    expect(pickTables(tables, 2)?.map((t) => t._id)).toEqual(["t2a"]);
    expect(pickTables(tables, 3)?.map((t) => t._id)).toEqual(["t4"]);
    expect(pickTables(tables, 5)?.map((t) => t._id)).toEqual(["t6"]);
  });

  it("joins tables in one zone when no single table fits", () => {
    const picked = pickTables(tables, 8);
    expect(picked?.every((table) => table.zone === "Main")).toBe(true);
    expect(picked!.reduce((sum, t) => sum + t.seats, 0)).toBeGreaterThanOrEqual(8);
  });

  it("returns null when the party cannot be seated", () => {
    expect(pickTables([{ _id: "a", name: "A", seats: 2 }], 6)).toBeNull();
    expect(pickTables([], 2)).toBeNull();
  });

  it("does not join tables across zones", () => {
    const split = [
      { _id: "a", name: "A", seats: 4, zone: "Main" },
      { _id: "b", name: "B", seats: 4, zone: "Terrace" },
    ];
    expect(pickTables(split, 8)).toBeNull();
  });
});

describe("canSeatParty and freeSeatsAt", () => {
  it("reflects what is left during a seating", () => {
    const bookings = [{ time: "19:00", tableIds: ["t6", "t4"] }];
    expect(freeSeatsAt(tables, bookings, "19:30", 90)).toBe(4);
    expect(canSeatParty(tables, bookings, "19:30", 2, 90)).toBe(true);
    // Only 2-tops are left, and they are in the same zone: 2 + 2 = 4.
    expect(canSeatParty(tables, bookings, "19:30", 4, 90)).toBe(true);
    expect(canSeatParty(tables, bookings, "19:30", 5, 90)).toBe(false);
  });
});
