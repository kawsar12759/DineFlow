import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Branch, Reservation } from "@/models";
import * as settingsRoute from "@/app/api/settings/route";
import * as availabilityRoute from "@/app/api/public/availability/route";
import * as publicReservationsRoute from "@/app/api/public/reservations/route";
import { dayKeyToDate } from "@/lib/dates";
import {
  TOMORROW,
  connectTestDb,
  jsonRequest,
  resetDb,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(() => connectTestDb("settings"));
afterAll(() => mongoose.disconnect());
beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
});

/** Books through the public endpoint; each call uses its own IP to dodge rate limits. */
let ipCounter = 0;
function publicBooking(overrides: Record<string, unknown> = {}) {
  ipCounter += 1;
  return publicReservationsRoute.POST(
    jsonRequest(
      "/api/public/reservations",
      "POST",
      {
        restaurantId: seed.restaurantA._id.toString(),
        branchId: seed.branchA1._id.toString(),
        name: "Nusrat Jahan",
        email: `guest${ipCounter}@example.com`,
        date: TOMORROW(),
        time: "19:00",
        guests: 2,
        ...overrides,
      },
      `198.51.100.${ipCounter}`
    )
  );
}

describe("settings API", () => {
  it("returns booking rules with defaults filled in", async () => {
    signInAs(seed.ownerA);
    const body = await (await settingsRoute.GET()).json();

    expect(body.data.bookingSettings).toMatchObject({
      diningDurationMinutes: 90,
      slotIntervalMinutes: 30,
      maxPartySize: 20,
      autoApprove: false,
    });
  });

  it("lets the owner change rules but not staff", async () => {
    signInAs(seed.staffA);
    const forbidden = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", {
        bookingSettings: { maxPartySize: 4 },
      })
    );
    expect(forbidden.status).toBe(403);

    signInAs(seed.ownerA);
    const allowed = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", {
        profile: { name: "Ember & Oak", cuisine: "Continental" },
        bookingSettings: { maxPartySize: 4, autoApprove: true },
      })
    );
    const body = await allowed.json();

    expect(allowed.status).toBe(200);
    expect(body.data.name).toBe("Ember & Oak");
    expect(body.data.bookingSettings).toMatchObject({
      maxPartySize: 4,
      autoApprove: true,
      // Untouched rules keep their values.
      diningDurationMinutes: 90,
    });
  });

  it("rejects values outside the allowed range", async () => {
    signInAs(seed.ownerA);
    const response = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", {
        bookingSettings: { diningDurationMinutes: 5 },
      })
    );
    expect(response.status).toBe(422);
  });
});

describe("booking rules are enforced", () => {
  it("rejects a time outside serving hours", async () => {
    // Seeded branches use the default 12:00-23:00.
    const response = await publicBooking({ time: "03:00" });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/outside serving hours/);
  });

  it("rejects a day the branch is closed", async () => {
    const closedDay = TOMORROW();
    await Branch.updateOne(
      { _id: seed.branchA1._id },
      { $set: { closures: [{ date: dayKeyToDate(closedDay), reason: "Holiday" }] } }
    );

    const response = await publicBooking({ date: closedDay });
    expect(response.status).toBe(409);
  });

  it("rejects a party larger than the restaurant allows", async () => {
    signInAs(seed.ownerA);
    await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", {
        bookingSettings: { maxPartySize: 4 },
      })
    );

    const response = await publicBooking({ guests: 6 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/more than 4/);
  });

  it("confirms bookings straight away when auto-approve is on", async () => {
    signInAs(seed.ownerA);
    await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", {
        bookingSettings: { autoApprove: true },
      })
    );

    const body = await (await publicBooking()).json();
    expect(body.data.status).toBe("approved");
  });

  it("refuses online bookings when the restaurant is unpublished", async () => {
    signInAs(seed.ownerA);
    await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", { profile: { isPublished: false } })
    );

    const response = await publicBooking();
    expect(response.status).toBe(404);
  });
});

describe("availability endpoint", () => {
  it("offers slots within opening hours and hides full ones", async () => {
    // Branch capacity is 10; a party of 8 at 19:00 leaves 2 seats.
    await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(TOMORROW()),
      time: "19:00",
      guests: 8,
      status: "approved",
    });

    const response = await availabilityRoute.GET(
      jsonRequest(
        `/api/public/availability?branchId=${seed.branchA1._id}&date=${TOMORROW()}&guests=4`
      )
    );
    const body = await response.json();

    expect(body.data.closed).toBe(false);
    expect(body.data.hours).toBe("Daily 12:00–23:00");
    expect(body.data.slots[0].time).toBe("12:00");
    expect(body.data.slots.at(-1).time).toBe("21:30");

    const at19 = body.data.slots.find((slot: { time: string }) => slot.time === "19:00");
    expect(at19).toMatchObject({ seatsLeft: 2, available: false, reason: "full" });
  });

  it("reports a closed day instead of slots", async () => {
    await Branch.updateOne(
      { _id: seed.branchA1._id },
      { $set: { closures: [{ date: dayKeyToDate(TOMORROW()) }] } }
    );

    const body = await (
      await availabilityRoute.GET(
        jsonRequest(
          `/api/public/availability?branchId=${seed.branchA1._id}&date=${TOMORROW()}`
        )
      )
    ).json();

    expect(body.data.closed).toBe(true);
    expect(body.data.slots).toEqual([]);
  });
});
