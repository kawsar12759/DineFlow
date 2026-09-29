import { describe, expect, it } from "vitest";
import {
  extendSubscription,
  planPrice,
  reminderStage,
  subscriptionState,
} from "@/lib/subscription";

const DAY = 86_400_000;
const now = new Date(Date.UTC(2026, 8, 28, 6));
const days = (n: number) => new Date(now.getTime() + n * DAY);

describe("planPrice", () => {
  it("charges ten months for a year, and nothing online for Enterprise", () => {
    expect(planPrice("starter", "monthly")).toBe(2999);
    expect(planPrice("growth", "yearly")).toBe(79990);
    expect(planPrice("enterprise", "monthly")).toBeNull();
  });
});

describe("subscriptionState", () => {
  it("is on trial until the trial ends, then stops straight away", () => {
    const trial = { subscriptionPlan: "starter" as const, onTrial: true, subscriptionEndsAt: days(3) };
    expect(subscriptionState(trial, now)).toMatchObject({
      status: "trial",
      daysLeft: 3,
      readOnly: false,
    });
    // A trial has no grace period.
    expect(subscriptionState({ ...trial, subscriptionEndsAt: days(-1) }, now)).toMatchObject({
      status: "expired",
      readOnly: true,
      acceptingBookings: false,
    });
  });

  it("gives a paid plan seven days' grace before pausing", () => {
    const paid = { subscriptionPlan: "growth" as const, onTrial: false };
    expect(subscriptionState({ ...paid, subscriptionEndsAt: days(10) }, now).status).toBe("active");
    expect(subscriptionState({ ...paid, subscriptionEndsAt: days(-3) }, now)).toMatchObject({
      status: "grace",
      readOnly: false,
      acceptingBookings: true,
    });
    expect(subscriptionState({ ...paid, subscriptionEndsAt: days(-8) }, now)).toMatchObject({
      status: "expired",
      readOnly: true,
    });
  });

  it("is suspended whatever has been paid", () => {
    const state = subscriptionState(
      {
        subscriptionPlan: "growth",
        onTrial: false,
        subscriptionEndsAt: days(200),
        suspendedAt: days(-1),
        suspendedReason: "Chargeback",
      },
      now
    );
    expect(state).toMatchObject({ status: "suspended", readOnly: true, suspendedReason: "Chargeback" });
  });

  it("counts a trial from sign-up for restaurants that predate billing", () => {
    const state = subscriptionState(
      { subscriptionPlan: "starter", createdAt: days(-20) },
      now
    );
    expect(state.status).toBe("expired");
    expect(state.endsAt.getTime()).toBe(days(-6).getTime());
  });
});

describe("extendSubscription", () => {
  it("adds a renewal after the time already paid for", () => {
    const next = extendSubscription(
      { subscriptionPlan: "growth", onTrial: false, subscriptionEndsAt: days(10) },
      { plan: "growth", period: "monthly" },
      now
    );
    expect(next.periodStart.getTime()).toBe(days(10).getTime());
    expect(next.periodEnd.toISOString()).toBe("2026-11-08T06:00:00.000Z");
  });

  it("starts from today once the old period has run out", () => {
    const next = extendSubscription(
      { subscriptionPlan: "starter", onTrial: false, subscriptionEndsAt: days(-30) },
      { plan: "starter", period: "yearly" },
      now
    );
    expect(next.periodStart.getTime()).toBe(now.getTime());
    expect(next.periodEnd.toISOString()).toBe("2027-09-28T06:00:00.000Z");
  });

  it("converts paid days left when switching plan, at the price ratio", () => {
    const next = extendSubscription(
      { subscriptionPlan: "starter", onTrial: false, subscriptionEndsAt: days(30) },
      { plan: "growth", period: "monthly" },
      now
    );
    // 30 days of ৳2,999 Starter is worth about 11.2 days of ৳7,999 Growth.
    const carriedDays = (next.periodStart.getTime() - now.getTime()) / DAY;
    expect(carriedDays).toBeCloseTo((30 * 2999) / 7999, 5);
    expect(next.plan).toBe("growth");
  });

  it("carries trial days over as they are", () => {
    const next = extendSubscription(
      { subscriptionPlan: "starter", onTrial: true, subscriptionEndsAt: days(5) },
      { plan: "growth", period: "monthly" },
      now
    );
    expect(next.periodStart.getTime()).toBe(days(5).getTime());
  });
});

describe("reminderStage", () => {
  const paid = { subscriptionPlan: "growth" as const, onTrial: false };
  const stage = (endsIn: number) =>
    reminderStage(subscriptionState({ ...paid, subscriptionEndsAt: days(endsIn) }, now), now);

  it("reminds a week ahead, three days ahead, in grace, and once paused", () => {
    expect(stage(20)).toBeNull();
    expect(stage(6)).toBe("7d");
    expect(stage(2)).toBe("3d");
    expect(stage(-2)).toBe("grace");
    expect(stage(-9)).toBe("expired");
    // Long paused restaurants are not emailed every day forever.
    expect(stage(-30)).toBeNull();
  });
});
