import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { Customer, Feedback, Reservation, Restaurant } from "@/models";
import * as signInRoute from "@/app/api/guest/sign-in/route";
import * as verifyRoute from "@/app/api/guest/verify/route";
import * as portalRoute from "@/app/api/guest/portal/route";
import * as signOutRoute from "@/app/api/guest/sign-out/route";
import { sendEmail } from "@/lib/email/send";
import { GUEST_COOKIE, guestSessionToken } from "@/lib/guest-session";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { connectTestDb, jsonRequest, resetDb, seedTwoTenants } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: false, provider: "console" })),
}));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(() => connectTestDb("guest-portal"));
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  (sendEmail as Mock).mockClear();
  seed = await seedTwoTenants();
});

function signIn(email: string, ip?: string) {
  return signInRoute.POST(jsonRequest("/api/guest/sign-in", "POST", { email }, ip));
}

function portal(email?: string) {
  const request = new NextRequest("http://localhost/api/guest/portal", {
    headers: email ? { cookie: `${GUEST_COOKIE}=${guestSessionToken(email)}` } : {},
  });
  return portalRoute.GET(request);
}

describe("signing in", () => {
  it("emails a link only to guests we know, with the same answer either way", async () => {
    const known = await signIn("Guest@A.test");
    const unknown = await signIn("nobody@example.com");

    expect(known.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());

    const calls = (sendEmail as Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].to).toBe("guest@a.test");
    expect(calls[0][0].text).toMatch(/\/api\/guest\/verify\?token=/);
  });

  it("limits how many links one address gets", async () => {
    for (let i = 0; i < 5; i++) await signIn("guest@a.test", `198.51.100.${i}`);
    expect((sendEmail as Mock).mock.calls).toHaveLength(3);
  });

  it("turns a valid link into a session cookie, and a bad one into a retry", async () => {
    await signIn("guest@a.test");
    const link = (sendEmail as Mock).mock.calls[0][0].text.match(
      /https?:\/\/\S+\/api\/guest\/verify\?token=\S+/
    )![0];

    const response = await verifyRoute.GET(new NextRequest(link));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(/\/account$/);
    const cookie = response.cookies.get(GUEST_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toBeTruthy();

    const bad = await verifyRoute.GET(
      new NextRequest("http://localhost/api/guest/verify?token=forged.123.abc")
    );
    expect(bad.headers.get("location")).toMatch(/\/account\?link=expired$/);
    expect(bad.cookies.get(GUEST_COOKIE)).toBeUndefined();
  });

  it("signs out by clearing the cookie", async () => {
    const response = await signOutRoute.POST();
    expect(response.cookies.get(GUEST_COOKIE)?.value).toBe("");
  });
});

describe("the portal", () => {
  it("needs a session", async () => {
    expect((await portal()).status).toBe(401);
  });

  it("brings together the guest's bookings, points and reviews at every restaurant", async () => {
    // The same person booked at B under the same email.
    const alsoAtB = await Customer.create({
      restaurantId: seed.restaurantB._id,
      name: "Guest A",
      email: "guest@a.test",
      loyaltyPoints: 40,
    });
    await Restaurant.updateOne(
      { _id: seed.restaurantB._id },
      { $set: { "loyaltySettings.enabled": true, subscriptionPlan: "growth" } }
    );
    await Customer.updateOne({ _id: seed.customerA._id }, { $set: { loyaltyPoints: 999 } });

    const upcoming = await Reservation.create({
      restaurantId: seed.restaurantB._id,
      branchId: seed.branchB._id,
      customerId: alsoAtB._id,
      date: dayKeyToDate(addDaysToKey(todayKey(), 2)),
      time: "20:00",
      guests: 3,
      status: "approved",
    });
    const rated = await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(addDaysToKey(todayKey(), -3)),
      time: "19:00",
      guests: 2,
      status: "completed",
    });
    const unrated = await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA2._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(addDaysToKey(todayKey(), -1)),
      time: "13:00",
      guests: 2,
      status: "completed",
    });
    await Feedback.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      reservationId: rated._id,
      customerId: seed.customerA._id,
      rating: 4,
    });
    // Someone else's booking at the same restaurant.
    await Reservation.create({
      restaurantId: seed.restaurantB._id,
      branchId: seed.branchB._id,
      customerId: seed.customerB._id,
      date: dayKeyToDate(addDaysToKey(todayKey(), 2)),
      time: "21:00",
      guests: 2,
      status: "approved",
    });

    const response = await portal("guest@a.test");
    expect(response.status).toBe(200);
    const { data } = await response.json();

    expect(data.memberships).toHaveLength(2);
    const atA = data.memberships.find((m: { restaurant: { name: string } }) => m.restaurant.name === "A");
    const atB = data.memberships.find((m: { restaurant: { name: string } }) => m.restaurant.name === "B");
    // A has no loyalty programme, so its balance is not shown.
    expect(atA.loyalty).toBeNull();
    expect(atB.loyalty.points).toBe(40);

    expect(data.upcoming).toHaveLength(1);
    expect(data.upcoming[0]._id).toBe(upcoming._id.toString());
    expect(data.upcoming[0].manageUrl).toMatch(/^\/booking\//);

    expect(data.past.map((v: { _id: string }) => v._id)).toEqual([
      unrated._id.toString(),
      rated._id.toString(),
    ]);
    expect(data.past[0].feedbackUrl).toMatch(/^\/feedback\//);
    expect(data.past[1].feedback).toEqual({ rating: 4, replied: false });
    expect(data.past[1].feedbackUrl).toBeUndefined();
  });
});
