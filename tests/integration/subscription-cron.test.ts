import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { Restaurant, SubscriptionPayment } from "@/models";
import * as cronRoute from "@/app/api/cron/subscriptions/route";
import { sendEmail } from "@/lib/email/send";
import { connectTestDb, resetDb, seedTwoTenants } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: false, provider: "console" })),
}));

const DAY = 86_400_000;
type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(async () => {
  process.env.CRON_SECRET = "cron-test-secret";
  await connectTestDb("subscription-cron");
});
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  (sendEmail as Mock).mockClear();
  seed = await seedTwoTenants();
});

function run(secret = "cron-test-secret") {
  return cronRoute.GET(
    new NextRequest("http://localhost/api/cron/subscriptions", {
      headers: { authorization: `Bearer ${secret}` },
    })
  );
}

describe("subscription reminders", () => {
  it("needs the cron secret", async () => {
    expect((await run("wrong")).status).toBe(401);
  });

  it("emails each owner once per stage", async () => {
    await Restaurant.updateOne(
      { _id: seed.restaurantA._id },
      { $set: { onTrial: false, subscriptionEndsAt: new Date(Date.now() + 2 * DAY) } }
    );
    await Restaurant.updateOne(
      { _id: seed.restaurantB._id },
      { $set: { onTrial: false, subscriptionEndsAt: new Date(Date.now() - 2 * DAY) } }
    );

    const first = await (await run()).json();
    expect(first.data.remindersSent).toBe(2);
    const subjects = (sendEmail as Mock).mock.calls.map(([m]) => `${m.to}: ${m.subject}`).sort();
    expect(subjects[0]).toMatch(/^owner@a\.test: 3 days left/);
    expect(subjects[1]).toMatch(/^owner@b\.test: Action needed/);

    // Running again the same day sends nothing new.
    const second = await (await run()).json();
    expect(second.data.remindersSent).toBe(0);
    expect((sendEmail as Mock).mock.calls).toHaveLength(2);
  });

  it("closes checkouts abandoned for over a day", async () => {
    await SubscriptionPayment.create({
      restaurantId: seed.restaurantA._id,
      plan: "starter",
      period: "monthly",
      amount: 2999,
      tranId: "OLD1",
      createdAt: new Date(Date.now() - 2 * DAY),
    });
    const { data } = await (await run()).json();
    expect(data.abandonedCheckouts).toBe(1);
    expect((await SubscriptionPayment.findOne({ tranId: "OLD1" }).lean())?.status).toBe("cancelled");
  });
});
