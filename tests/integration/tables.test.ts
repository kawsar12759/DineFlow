import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Customer, Reservation, Table, WaitlistEntry } from "@/models";
import * as reservationRoute from "@/app/api/reservations/[id]/route";
import * as publicReservationsRoute from "@/app/api/public/reservations/route";
import * as availabilityRoute from "@/app/api/public/availability/route";
import * as waitlistRoute from "@/app/api/waitlist/route";
import * as waitlistEntryRoute from "@/app/api/waitlist/[id]/route";
import * as guestBookingRoute from "@/app/api/public/bookings/[token]/route";
import { bookingToken } from "@/lib/booking-token";
import {
  TOMORROW,
  connectTestDb,
  jsonRequest,
  params,
  resetDb,
  routeParams,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;
let tables: { _id: mongoose.Types.ObjectId; name: string; seats: number }[];

beforeAll(() => connectTestDb("tables"));
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
  // Branch A1 gets one 2-top and one 4-top, both in the same zone.
  tables = await Table.create([
    {
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      name: "T1",
      seats: 2,
      zone: "Main",
    },
    {
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      name: "T2",
      seats: 4,
      zone: "Main",
    },
  ]);
});

let ip = 0;
function publicBooking(overrides: Record<string, unknown> = {}) {
  ip += 1;
  return publicReservationsRoute.POST(
    jsonRequest(
      "/api/public/reservations",
      "POST",
      {
        restaurantId: seed.restaurantA._id.toString(),
        branchId: seed.branchA1._id.toString(),
        name: "Guest",
        email: `guest${ip}@example.com`,
        date: TOMORROW(),
        time: "19:00",
        guests: 2,
        ...overrides,
      },
      `198.51.100.${ip}`
    )
  );
}

describe("seating bookings at tables", () => {
  it("seats a party at the smallest table that fits", async () => {
    const body = await (await publicBooking({ guests: 2 })).json();
    const reservation = await Reservation.findById(body.data.reservationId).lean();

    expect(reservation?.tableIds).toHaveLength(1);
    expect(reservation!.tableIds[0].toString()).toBe(tables[0]._id.toString());
  });

  it("refuses when no table is left for the whole seating", async () => {
    await publicBooking({ guests: 2 }); // takes T1
    await publicBooking({ guests: 4 }); // takes T2

    const third = await publicBooking({ guests: 2, time: "19:30" });
    const body = await third.json();

    expect(third.status).toBe(409);
    expect(body.error).toMatch(/No table free/);
  });

  it("frees tables for a later seating", async () => {
    await publicBooking({ guests: 4 }); // T2 from 19:00 to 20:30
    const later = await publicBooking({ guests: 4, time: "20:30" });
    expect(later.status).toBe(201);
  });

  it("joins tables for a party no single table fits", async () => {
    const body = await (await publicBooking({ guests: 6 })).json();
    const reservation = await Reservation.findById(body.data.reservationId).lean();
    expect(reservation?.tableIds).toHaveLength(2);
  });

  it("gives the tables to exactly one of two simultaneous bookings", async () => {
    // Only T2 can take 4 guests.
    const [first, second] = await Promise.all([
      publicBooking({ guests: 4 }),
      publicBooking({ guests: 4 }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await Reservation.countDocuments({ status: "pending" })).toBe(1);
  });

  it("reports slots as full in availability once tables are taken", async () => {
    await publicBooking({ guests: 2 });
    await publicBooking({ guests: 4 });

    const body = await (
      await availabilityRoute.GET(
        jsonRequest(
          `/api/public/availability?branchId=${seed.branchA1._id}&date=${TOMORROW()}&guests=2`
        )
      )
    ).json();

    const at19 = body.data.slots.find((s: { time: string }) => s.time === "19:00");
    const at2030 = body.data.slots.find((s: { time: string }) => s.time === "20:30");
    expect(at19).toMatchObject({ available: false, reason: "full" });
    expect(at2030.available).toBe(true);
  });
});

describe("moving and rescheduling from the dashboard", () => {
  async function bookingAt(time: string, guests = 2) {
    const body = await (await publicBooking({ time, guests })).json();
    return body.data.reservationId as string;
  }

  it("moves a booking to another free table", async () => {
    const id = await bookingAt("19:00", 2); // T1
    signInAs(seed.ownerA);

    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${id}`, "PATCH", {
        tableIds: [tables[1]._id.toString()],
      }),
      params(id)
    );

    expect(response.status).toBe(200);
    const reservation = await Reservation.findById(id).lean();
    expect(reservation!.tableIds[0].toString()).toBe(tables[1]._id.toString());
  });

  it("refuses a table that is already taken for that seating", async () => {
    const first = await bookingAt("19:00", 2); // T1
    await bookingAt("19:30", 4); // T2
    signInAs(seed.ownerA);

    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${first}`, "PATCH", {
        tableIds: [tables[1]._id.toString()],
      }),
      params(first)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/already taken/);
  });

  it("refuses a table that is too small", async () => {
    const id = await bookingAt("19:00", 4); // T2
    signInAs(seed.ownerA);

    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${id}`, "PATCH", {
        tableIds: [tables[0]._id.toString()],
      }),
      params(id)
    );
    expect(response.status).toBe(409);
  });

  it("re-seats a booking when its time changes", async () => {
    const id = await bookingAt("19:00", 2);
    signInAs(seed.ownerA);

    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${id}`, "PATCH", { time: "20:00" }),
      params(id)
    );

    expect(response.status).toBe(200);
    const reservation = await Reservation.findById(id).lean();
    expect(reservation?.time).toBe("20:00");
    expect(reservation?.tableIds).toHaveLength(1);
  });

  it("counts a no-show against the customer", async () => {
    const id = await bookingAt("19:00", 2);
    signInAs(seed.ownerA);

    await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${id}`, "PATCH", { status: "approved" }),
      params(id)
    );
    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${id}`, "PATCH", { status: "no_show" }),
      params(id)
    );

    expect(response.status).toBe(200);
    const reservation = await Reservation.findById(id).lean();
    const customer = await Customer.findById(reservation!.customerId).lean();
    expect(customer?.noShowCount).toBe(1);
  });
});

describe("waitlist", () => {
  it("seats a waiting party on a free table", async () => {
    signInAs(seed.ownerA);
    const created = await waitlistRoute.POST(
      jsonRequest("/api/waitlist", "POST", {
        branchId: seed.branchA1._id.toString(),
        date: TOMORROW(),
        name: "Walk-in party",
        guests: 2,
      })
    );
    const entry = (await created.json()).data;
    expect(created.status).toBe(201);

    const seated = await waitlistEntryRoute.PATCH(
      jsonRequest(`/api/waitlist/${entry._id}`, "PATCH", {
        status: "seated",
        time: "19:00",
      }),
      params(entry._id)
    );
    const body = await seated.json();

    expect(seated.status).toBe(200);
    const reservation = await Reservation.findById(body.data.reservationId).lean();
    expect(reservation?.status).toBe("seated");
    expect(reservation?.tableIds).toHaveLength(1);
    expect((await WaitlistEntry.findById(entry._id))?.status).toBe("seated");
  });

  it("keeps the party waiting when the floor is full", async () => {
    await publicBooking({ guests: 2, time: "19:00" });
    await publicBooking({ guests: 4, time: "19:00" });

    signInAs(seed.ownerA);
    const entry = (
      await (
        await waitlistRoute.POST(
          jsonRequest("/api/waitlist", "POST", {
            branchId: seed.branchA1._id.toString(),
            date: TOMORROW(),
            name: "Hopeful party",
            guests: 2,
          })
        )
      ).json()
    ).data;

    const response = await waitlistEntryRoute.PATCH(
      jsonRequest(`/api/waitlist/${entry._id}`, "PATCH", {
        status: "seated",
        time: "19:00",
      }),
      params(entry._id)
    );

    expect(response.status).toBe(409);
    expect((await WaitlistEntry.findById(entry._id))?.status).toBe("waiting");
  });
});

describe("guest booking links", () => {
  async function bookingWithToken() {
    const body = await (await publicBooking()).json();
    return {
      id: body.data.reservationId as string,
      token: bookingToken(body.data.reservationId),
      manageUrl: body.data.manageUrl as string,
    };
  }

  it("returns the booking for a valid link and rejects a tampered one", async () => {
    const { token, id, manageUrl } = await bookingWithToken();
    expect(manageUrl).toContain(`/booking/${token}`);

    const ok = await guestBookingRoute.GET(
      jsonRequest(`/api/public/bookings/${token}`),
      routeParams({ token })
    );
    const body = await ok.json();
    expect(ok.status).toBe(200);
    expect(body.data.reservationId).toBe(id);

    const otherId = new mongoose.Types.ObjectId().toString();
    const tampered = `${otherId}.${token.split(".")[1]}`;
    const bad = await guestBookingRoute.GET(
      jsonRequest(`/api/public/bookings/${tampered}`),
      routeParams({ token: tampered })
    );
    expect(bad.status).toBe(404);
  });

  it("lets the guest cancel, which frees the table", async () => {
    const { id, token } = await bookingWithToken();

    const response = await guestBookingRoute.PATCH(
      jsonRequest(`/api/public/bookings/${token}`, "PATCH", { action: "cancel" }),
      routeParams({ token })
    );

    expect(response.status).toBe(200);
    expect((await Reservation.findById(id))?.status).toBe("cancelled");

    // The table is free again for another party.
    const next = await publicBooking({ guests: 2, time: "19:00" });
    expect(next.status).toBe(201);
  });

  it("lets the guest move to another free slot", async () => {
    const { id, token } = await bookingWithToken();

    const response = await guestBookingRoute.PATCH(
      jsonRequest(`/api/public/bookings/${token}`, "PATCH", {
        action: "reschedule",
        time: "20:30",
      }),
      routeParams({ token })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.time).toBe("20:30");
    expect((await Reservation.findById(id))?.time).toBe("20:30");
  });

  it("refuses changes to a completed booking", async () => {
    const { id, token } = await bookingWithToken();
    await Reservation.updateOne({ _id: id }, { status: "completed" });

    const response = await guestBookingRoute.PATCH(
      jsonRequest(`/api/public/bookings/${token}`, "PATCH", { action: "cancel" }),
      routeParams({ token })
    );
    expect(response.status).toBe(409);
  });

  it("applies opening hours to guest reschedules", async () => {
    const { token } = await bookingWithToken();

    const response = await guestBookingRoute.PATCH(
      jsonRequest(`/api/public/bookings/${token}`, "PATCH", {
        action: "reschedule",
        time: "03:00",
      }),
      routeParams({ token })
    );
    expect(response.status).toBe(409);
  });
});

describe("branch without tables", () => {
  it("still books against total seat capacity", async () => {
    // Branch A2 has no tables; capacity is 10.
    const response = await publicReservationsRoute.POST(
      jsonRequest(
        "/api/public/reservations",
        "POST",
        {
          restaurantId: seed.restaurantA._id.toString(),
          branchId: seed.branchA2._id.toString(),
          name: "Guest",
          email: "nofloor@example.com",
          date: TOMORROW(),
          time: "19:00",
          guests: 8,
        },
        "198.51.100.200"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    const reservation = await Reservation.findById(body.data.reservationId).lean();
    expect(reservation?.tableIds).toHaveLength(0);
  });
});
