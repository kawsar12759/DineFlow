import { describe, expect, it } from "vitest";
import { loyaltySettings, pointsForSpend, pointsValue } from "@/lib/loyalty";

const on = loyaltySettings({
  enabled: true,
  pointsPer100Taka: 5,
  pointValueTaka: 1,
  minRedeemPoints: 100,
});

describe("pointsForSpend", () => {
  it("earns whole points per ৳100, rounded down", () => {
    expect(pointsForSpend(1000, on)).toBe(50);
    expect(pointsForSpend(1999, on)).toBe(99);
    expect(pointsForSpend(19, on)).toBe(0);
  });

  it("earns nothing when the programme is off", () => {
    expect(pointsForSpend(5000, loyaltySettings({ enabled: false }))).toBe(0);
  });

  it("handles fractional rates", () => {
    expect(pointsForSpend(1000, { ...on, pointsPer100Taka: 2.5 })).toBe(25);
  });
});

describe("pointsValue", () => {
  it("converts points to taka", () => {
    expect(pointsValue(150, on)).toBe(150);
    expect(pointsValue(150, { ...on, pointValueTaka: 0.5 })).toBe(75);
  });
});

describe("loyaltySettings", () => {
  it("is off by default", () => {
    expect(loyaltySettings(undefined).enabled).toBe(false);
  });
});
