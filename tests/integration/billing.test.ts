import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { ActivityLog, Branch, Restaurant, SubscriptionPayment, User } from "@/models";
import * as billingRoute from "@/app/api/billing/route";
import * as checkoutRoute from "@/app/api/billing/checkout/route";
import * as returnRoute from "@/app/api/billing/sslcommerz/return/route";
import * as ipnRoute from "@/app/api/billing/sslcommerz/ipn/route";
import * as branchesRoute from "@/app/api/branches/route";
import * as staffRoute from "@/app/api/staff/route";
import * as settingsRoute from "@/app/api/settings/route";
import * as profileRoute from "@/app/api/profile/route";
import * as publicReservationsRoute from "@/app/api/public/reservations/route";
import * as adminRestaurantsRoute from "@/app/api/admin/restaurants/route";
import * as adminRestaurantRoute from "@/app/api/admin/restaurants/[id]/route";
import * as adminPaymentRoute from "@/app/api/admin/payments/[id]/route";
import { validatePayment } from "@/lib/sslcommerz";
import { sendEmail } from "@/lib/email/send";
import {
  connectTestDb,
  jsonRequest,
  params,
  resetDb,
  seedTwoTenants,
  signInAs,
  TOMORROW,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: false, provider: "console" })),
}));
vi.mock("@/lib/sslcommerz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sslcommerz")>();
  return {
    ...actual,
    gatewayConfig: () => ({ storeId: "test", storePassword: "test", sandbox: true }),
    createSession: vi.fn(async () => "https://sandbox.sslcommerz.com/pay/abc"),
    validatePayment: vi.fn(),
  };
});

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;
const DAY = 86_400_000;

beforeAll(() => connectTestDb("billing"));
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  (sendEmail as Mock).mockClear();
  (validatePayment as Mock).mockReset();
  seed = await seedTwoTenants();
});

async function checkout(plan = "growth", period = "monthly") {
  const response = await checkoutRoute.POST(
    jsonRequest("/api/billing/checkout", "POST", { plan, period })
  );
  return { response, body: await response.json() };
}

/** SSLCommerz confirming a payment for `payment`, as its validation API would. */
function confirmed(payment: { tranId: string; amount: number }, extra: Record<string, unknown> = {}) {
  (validatePayment as Mock).mockResolvedValue({
    status: "VALID",
    tranId: payment.tranId,
    valId: "VAL123",
    amount: payment.amount,
    currency: "BDT",
    bankTranId: "BANK1",
    cardType: "BKASH-BKash",
    riskLevel: "0",
    ...extra,
  });
}

function browserReturn(result: string, fields: Record<string, string>) {
  return returnRoute.POST(
    new NextRequest(`http://localhost/api/billing/sslcommerz/return?result=${result}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    })
  );
}

function ipn(fields: Record<string, string>) {
  return ipnRoute.POST(
    new NextRequest("http://localhost/api/billing/sslcommerz/ipn", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    })
  );
}

async function setSubscription(fields: Record<string, unknown>, restaurant = seed.restaurantA) {
  await Restaurant.updateOne({ _id: restaurant._id }, { $set: fields });
}

describe("paying for a plan", () => {
  it("opens a checkout for the owner only", async () => {
    signInAs(seed.staffA);
    expect((await checkout()).response.status).toBe(403);

    signInAs(seed.ownerA);
    const { response, body } = await checkout("growth", "yearly");
    expect(response.status).toBe(200);
    expect(body.data.url).toContain("sslcommerz");

    const payment = await SubscriptionPayment.findOne({ restaurantId: seed.restaurantA._id }).lean();
    expect(payment).toMatchObject({ plan: "growth", period: "yearly", amount: 79990, status: "pending" });

    expect((await checkout("enterprise")).response.status).toBe(422);
  });

  it("extends access, numbers the invoice and emails a receipt once confirmed", async () => {
    signInAs(seed.ownerA);
    await checkout("growth", "monthly");
    const payment = (await SubscriptionPayment.findOne().lean())!;
    confirmed(payment);

    const response = await browserReturn("success", { tran_id: payment.tranId, val_id: "VAL123" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(/\/dashboard\/billing\?payment=paid$/);

    const paid = (await SubscriptionPayment.findById(payment._id).lean())!;
    expect(paid.status).toBe("paid");
    expect(paid.invoiceNumber).toMatch(/^DF-\d{4}-000001$/);
    expect(paid.gatewayDetails?.bankTranId).toBe("BANK1");

    const restaurant = (await Restaurant.findById(seed.restaurantA._id).lean())!;
    expect(restaurant.subscriptionPlan).toBe("growth");
    expect(restaurant.onTrial).toBe(false);
    expect(restaurant.subscriptionEndsAt!.getTime()).toBe(paid.periodEnd!.getTime());

    const receipts = (sendEmail as Mock).mock.calls.filter(([m]) => m.subject.startsWith("Receipt"));
    expect(receipts).toHaveLength(1);
    expect(receipts[0][0].to).toBe("owner@a.test");

    const activity = await ActivityLog.findOne({ action: "billing.paid" }).lean();
    expect(activity?.restaurantId.toString()).toBe(seed.restaurantA._id.toString());
  });

  it("applies a payment once when the browser and SSLCommerz's IPN both arrive", async () => {
    signInAs(seed.ownerA);
    await checkout("starter", "monthly");
    const payment = (await SubscriptionPayment.findOne().lean())!;
    confirmed(payment);

    const fields = { tran_id: payment.tranId, val_id: "VAL123", status: "VALID" };
    await Promise.all([browserReturn("success", fields), ipn(fields), ipn(fields)]);

    const restaurant = (await Restaurant.findById(seed.restaurantA._id).lean())!;
    const paid = (await SubscriptionPayment.findById(payment._id).lean())!;
    // One month added, not three.
    expect(restaurant.subscriptionEndsAt!.getTime()).toBe(paid.periodEnd!.getTime());
    const receipts = (sendEmail as Mock).mock.calls.filter(([m]) => m.subject.startsWith("Receipt"));
    expect(receipts).toHaveLength(1);
  });

  it("never trusts the browser without SSLCommerz's confirmation", async () => {
    signInAs(seed.ownerA);
    await checkout();
    const payment = (await SubscriptionPayment.findOne().lean())!;

    // Forged "success": the validation service does not know this payment.
    (validatePayment as Mock).mockResolvedValue({ status: "INVALID_TRANSACTION", tranId: "", valId: "", amount: 0, currency: "BDT" });
    const forged = await browserReturn("success", { tran_id: payment.tranId, val_id: "FAKE" });
    expect(forged.headers.get("location")).toMatch(/payment=failed$/);

    // A real but smaller payment must not buy the bigger plan.
    confirmed(payment, { amount: 10 });
    await browserReturn("success", { tran_id: payment.tranId, val_id: "VAL123" });

    // Someone else's payment must not count for this one.
    confirmed({ tranId: "OTHER", amount: payment.amount });
    await ipn({ tran_id: payment.tranId, val_id: "VAL123", status: "VALID" });

    expect((await SubscriptionPayment.findById(payment._id).lean())!.status).toBe("failed");
    expect((await Restaurant.findById(seed.restaurantA._id).lean())!.onTrial).toBe(true);
  });

  it("holds a payment SSLCommerz flags as risky until DineFlow approves it", async () => {
    signInAs(seed.ownerA);
    await checkout();
    const payment = (await SubscriptionPayment.findOne().lean())!;
    confirmed(payment, { riskLevel: "1", riskTitle: "Card from a risky BIN" });

    const response = await browserReturn("success", { tran_id: payment.tranId, val_id: "VAL123" });
    expect(response.headers.get("location")).toMatch(/payment=review$/);
    expect((await Restaurant.findById(seed.restaurantA._id).lean())!.onTrial).toBe(true);

    const admin = await User.create({ name: "Ops", email: "ops@dineflow.test", password: "x", role: "super_admin" });
    signInAs(seed.ownerA);
    const decide = (body: Record<string, unknown>) =>
      adminPaymentRoute.PATCH(
        jsonRequest(`/api/admin/payments/${payment._id}`, "PATCH", body),
        params(payment._id.toString())
      );
    expect((await decide({ decision: "approve", note: "Checked" })).status).toBe(403);

    signInAs(admin);
    expect((await decide({ decision: "approve", note: "Called the owner" })).status).toBe(200);
    const restaurant = (await Restaurant.findById(seed.restaurantA._id).lean())!;
    expect(restaurant.onTrial).toBe(false);
    expect(restaurant.subscriptionPlan).toBe("growth");
  });

  it("records cancelled and failed attempts without touching access", async () => {
    signInAs(seed.ownerA);
    await checkout();
    const payment = (await SubscriptionPayment.findOne().lean())!;
    const response = await browserReturn("cancel", { tran_id: payment.tranId });
    expect(response.headers.get("location")).toMatch(/payment=cancelled$/);
    expect((await SubscriptionPayment.findById(payment._id).lean())!.status).toBe("cancelled");

    const list = await billingRoute.GET();
    const { data } = await list.json();
    expect(data.payments).toHaveLength(1);
    expect(data.subscription.status).toBe("trial");
  });
});

describe("when a subscription runs out", () => {
  it("keeps working through the grace period", async () => {
    await setSubscription({ onTrial: false, subscriptionEndsAt: new Date(Date.now() - 3 * DAY) });
    signInAs(seed.ownerA);
    const response = await staffRoute.POST(
      jsonRequest("/api/staff", "POST", { name: "New Waiter", email: "w@a.test", password: "password123", role: "staff" })
    );
    expect(response.status).toBe(201);
  });

  it("pauses changes but not reading, paying or the owner's own profile", async () => {
    await setSubscription({ onTrial: false, subscriptionEndsAt: new Date(Date.now() - 10 * DAY) });
    signInAs(seed.ownerA);

    const write = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", { profile: { cuisine: "Thai" } })
    );
    expect(write.status).toBe(402);
    expect((await write.json()).error).toMatch(/Renew it in Billing/);

    expect((await settingsRoute.GET()).status).toBe(200);
    expect((await profileRoute.PATCH(jsonRequest("/api/profile", "PATCH", { name: "Owner Again" }))).status).toBe(200);
    expect((await checkout("starter")).response.status).toBe(200);
  });

  it("stops online bookings, and starts them again after payment", async () => {
    await setSubscription({ onTrial: true, subscriptionEndsAt: new Date(Date.now() - DAY) });
    const book = () =>
      publicReservationsRoute.POST(
        jsonRequest("/api/public/reservations", "POST", {
          restaurantId: seed.restaurantA._id.toString(),
          branchId: seed.branchA1._id.toString(),
          name: "Walk Up",
          email: "walkup@example.com",
          date: TOMORROW(),
          time: "19:00",
          guests: 2,
        })
      );
    expect((await book()).status).toBe(404);

    signInAs(seed.ownerA);
    await checkout("starter");
    const payment = (await SubscriptionPayment.findOne().lean())!;
    confirmed(payment);
    await ipn({ tran_id: payment.tranId, val_id: "VAL123", status: "VALID" });

    expect((await book()).status).toBe(201);
  });
});

describe("plan limits", () => {
  it("holds Starter to one branch and two staff accounts", async () => {
    // Tenant A already has two branches; B has one.
    signInAs(seed.ownerB);
    const branch = await branchesRoute.POST(
      jsonRequest("/api/branches", "POST", {
        name: "Second",
        address: { street: "Road 9", city: "Dhaka", country: "Bangladesh" },
        capacity: 20,
      })
    );
    expect(branch.status).toBe(402);
    expect((await branch.json()).error).toMatch(/Starter plan includes 1 branch/);

    const addStaff = (email: string) =>
      staffRoute.POST(
        jsonRequest("/api/staff", "POST", { name: "Someone", email, password: "password123", role: "staff" })
      );
    expect((await addStaff("one@b.test")).status).toBe(201);
    expect((await addStaff("two@b.test")).status).toBe(201);
    expect((await addStaff("three@b.test")).status).toBe(402);

    await setSubscription({ subscriptionPlan: "growth" }, seed.restaurantB);
    expect((await addStaff("three@b.test")).status).toBe(201);
    expect(await Branch.countDocuments({ restaurantId: seed.restaurantB._id })).toBe(1);
  });

  it("keeps loyalty off on Starter", async () => {
    signInAs(seed.ownerB);
    const response = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", { loyaltySettings: { enabled: true } })
    );
    expect(response.status).toBe(402);
    const { data } = await (await settingsRoute.GET()).json();
    expect(data.planIncludesLoyalty).toBe(false);
  });
});

describe("DineFlow admin", () => {
  let admin: { _id: mongoose.Types.ObjectId };
  beforeEach(async () => {
    admin = await User.create({ name: "Ops", email: "ops@dineflow.test", password: "x", role: "super_admin" });
  });

  it("is closed to restaurant owners", async () => {
    signInAs(seed.ownerA);
    expect((await adminRestaurantsRoute.GET(jsonRequest("/api/admin/restaurants"))).status).toBe(403);
  });

  it("lists every restaurant with its subscription", async () => {
    await setSubscription({ onTrial: false, subscriptionEndsAt: new Date(Date.now() - 10 * DAY) }, seed.restaurantB);
    signInAs(admin);
    const { data } = await (await adminRestaurantsRoute.GET(jsonRequest("/api/admin/restaurants"))).json();
    expect(data.summary).toMatchObject({ restaurants: 2, trial: 1, expired: 1 });

    const paused = await (
      await adminRestaurantsRoute.GET(jsonRequest("/api/admin/restaurants?status=expired"))
    ).json();
    expect(paused.data.restaurants.map((r: { name: string }) => r.name)).toEqual(["B"]);
  });

  it("extends, suspends and reinstates, recording each in the restaurant's log", async () => {
    signInAs(admin);
    const patch = (body: Record<string, unknown>) =>
      adminRestaurantRoute.PATCH(
        jsonRequest(`/api/admin/restaurants/${seed.restaurantA._id}`, "PATCH", body),
        params(seed.restaurantA._id.toString())
      );

    expect((await patch({ extendDays: 14 })).status).toBe(422);
    const before = (await Restaurant.findById(seed.restaurantA._id).lean())!;
    expect((await patch({ extendDays: 14, note: "Goodwill for downtime" })).status).toBe(200);
    const after = (await Restaurant.findById(seed.restaurantA._id).lean())!;
    const beforeEnd = before.subscriptionEndsAt?.getTime() ?? before.createdAt.getTime() + 14 * DAY;
    expect(after.subscriptionEndsAt!.getTime() - beforeEnd).toBe(14 * DAY);

    expect((await patch({ suspended: true, note: "Chargeback on card" })).status).toBe(200);
    signInAs(seed.ownerA);
    const blocked = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", { profile: { cuisine: "Thai" } })
    );
    expect(blocked.status).toBe(402);
    expect((await blocked.json()).error).toMatch(/suspended/);
    expect((await checkout()).response.status).toBe(402);

    signInAs(admin);
    expect((await patch({ suspended: false, note: "Resolved with the bank" })).status).toBe(200);

    const log = await ActivityLog.find({ restaurantId: seed.restaurantA._id, action: "billing.admin" })
      .sort({ createdAt: 1 })
      .lean();
    expect(log.map((entry) => entry.actorName)).toEqual(["DineFlow support", "DineFlow support", "DineFlow support"]);
    expect(log[1].summary).toMatch(/suspended.*Chargeback/);
  });
});
