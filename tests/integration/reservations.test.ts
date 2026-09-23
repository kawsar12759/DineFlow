import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Customer, Reservation, User } from "@/models";
import * as reservationsRoute from "@/app/api/reservations/route";
import * as reservationRoute from "@/app/api/reservations/[id]/route";
import * as publicReservationsRoute from "@/app/api/public/reservations/route";
import { dayKeyToDate } from "@/lib/dates";
import {
  TOMORROW,
  connectTestDb,
  jsonRequest,
  params,
  resetDb,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(() => connectTestDb("reservations"));
afterAll(() => mongoose.disconnect());
beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
});

function reservationFor(
  tenant: "A" | "B",
  overrides: Record<string, unknown> = {}
) {
  const isA = tenant === "A";
  return Reservation.create({
    restaurantId: isA ? seed.restaurantA._id : seed.restaurantB._id,
    branchId: isA ? seed.branchA1._id : seed.branchB._id,
    customerId: isA ? seed.customerA._id : seed.customerB._id,
    date: dayKeyToDate(TOMORROW()),
    time: "19:00",
    guests: 2,
    ...overrides,
  });
}

function publicBooking(overrides: Record<string, unknown> = {}, ip?: string) {
  return publicReservationsRoute.POST(
    jsonRequest(
      "/api/public/reservations",
      "POST",
      {
        restaurantId: seed.restaurantA._id.toString(),
        branchId: seed.branchA1._id.toString(),
        name: "Nusrat Jahan",
        email: "nusrat@example.com",
        date: TOMORROW(),
        time: "19:00",
        guests: 2,
        ...overrides,
      },
      ip
    )
  );
}

describe("tenant isolation", () => {
  it("lists only the signed-in tenant's reservations", async () => {
    await reservationFor("A");
    await reservationFor("B");

    signInAs(seed.ownerA);
    const response = await reservationsRoute.GET(jsonRequest("/api/reservations"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].restaurantId).toBe(seed.restaurantA._id.toString());
  });

  it("returns 404 for another tenant's reservation, even by id", async () => {
    const other = await reservationFor("B");

    signInAs(seed.ownerA);
    const read = await reservationRoute.GET(
      jsonRequest(`/api/reservations/${other._id}`),
      params(other._id.toString())
    );
    const update = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${other._id}`, "PATCH", { status: "approved" }),
      params(other._id.toString())
    );

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect((await Reservation.findById(other._id))?.status).toBe("pending");
  });

  it("refuses to book into another tenant's branch", async () => {
    signInAs(seed.ownerA);
    const response = await reservationsRoute.POST(
      jsonRequest("/api/reservations", "POST", {
        branchId: seed.branchB._id.toString(),
        customerId: seed.customerA._id.toString(),
        date: TOMORROW(),
        time: "19:00",
        guests: 2,
      })
    );
    expect(response.status).toBe(404);
  });
});

describe("session revalidation", () => {
  it("rejects a deactivated user whose token is still valid", async () => {
    await User.updateOne({ _id: seed.ownerA._id }, { isActive: false });

    signInAs(seed.ownerA);
    const response = await reservationsRoute.GET(jsonRequest("/api/reservations"));
    expect(response.status).toBe(401);
  });

  it("uses the current role from the database, not the token", async () => {
    // Demoted to staff after signing in: manager-only deletion must now fail.
    await User.updateOne({ _id: seed.ownerA._id }, { role: "staff" });
    const reservation = await reservationFor("A");

    signInAs(seed.ownerA);
    const response = await reservationRoute.DELETE(
      jsonRequest(`/api/reservations/${reservation._id}`, "DELETE"),
      params(reservation._id.toString())
    );
    expect(response.status).toBe(403);
  });
});

describe("branch scoping for staff", () => {
  it("only lists reservations at the staff member's branch", async () => {
    await reservationFor("A");
    await reservationFor("A", { branchId: seed.branchA2._id });

    signInAs(seed.staffA);
    const body = await (
      await reservationsRoute.GET(jsonRequest("/api/reservations"))
    ).json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].branchId._id).toBe(seed.branchA1._id.toString());
  });

  it("cannot read or book at another branch", async () => {
    const elsewhere = await reservationFor("A", { branchId: seed.branchA2._id });

    signInAs(seed.staffA);
    const read = await reservationRoute.GET(
      jsonRequest(`/api/reservations/${elsewhere._id}`),
      params(elsewhere._id.toString())
    );
    const create = await reservationsRoute.POST(
      jsonRequest("/api/reservations", "POST", {
        branchId: seed.branchA2._id.toString(),
        customerId: seed.customerA._id.toString(),
        date: TOMORROW(),
        time: "19:00",
        guests: 2,
      })
    );

    expect(read.status).toBe(404);
    expect(create.status).toBe(403);
  });
});

describe("status lifecycle", () => {
  it("rejects skipping steps", async () => {
    const reservation = await reservationFor("A");
    signInAs(seed.ownerA);
    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${reservation._id}`, "PATCH", {
        status: "completed",
      }),
      params(reservation._id.toString())
    );
    expect(response.status).toBe(409);
  });

  it("records a visit and spend when completed", async () => {
    const reservation = await reservationFor("A", {
      status: "seated",
      estimatedSpend: 4200,
      guests: 3,
    });
    signInAs(seed.ownerA);
    const response = await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${reservation._id}`, "PATCH", {
        status: "completed",
      }),
      params(reservation._id.toString())
    );

    expect(response.status).toBe(200);
    const customer = await Customer.findById(seed.customerA._id).lean();
    expect(customer?.visitCount).toBe(1);
    expect(customer?.totalSpend).toBe(4200);
  });
});

describe("public booking", () => {
  it("books a future slot and stores the Dhaka day at UTC midnight", async () => {
    const response = await publicBooking();
    const body = await response.json();

    expect(response.status).toBe(201);
    const stored = await Reservation.findById(body.data.reservationId).lean();
    expect(stored?.date.toISOString()).toBe(`${TOMORROW()}T00:00:00.000Z`);
    expect(stored?.restaurantId.toString()).toBe(seed.restaurantA._id.toString());
  });

  it("rejects times in the past", async () => {
    const response = await publicBooking({ date: "2020-01-01" });
    expect(response.status).toBe(400);
  });

  it("rejects a branch that does not belong to the given restaurant", async () => {
    const response = await publicBooking({
      branchId: seed.branchB._id.toString(),
    });
    expect(response.status).toBe(404);
  });

  it("counts parties still seated from an earlier slot against capacity", async () => {
    // Branch capacity is 10. 8 guests at 18:30 are still seated at 19:00.
    await reservationFor("A", { time: "18:30", guests: 8 });

    const overlapping = await publicBooking({ time: "19:00", guests: 3 });
    const afterTheyLeave = await publicBooking({ time: "20:00", guests: 3 }, "203.0.113.2");

    expect(overlapping.status).toBe(409);
    expect(afterTheyLeave.status).toBe(201);
    expect(await Reservation.countDocuments({ time: "19:00" })).toBe(0);
  });

  it("lets exactly one of two simultaneous requests take the last seats", async () => {
    await reservationFor("A", { guests: 6 });

    const results = await Promise.all([
      publicBooking({ guests: 4, email: "one@example.com" }, "203.0.113.10"),
      publicBooking({ guests: 4, email: "two@example.com" }, "203.0.113.11"),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const seated = await Reservation.aggregate([
      { $match: { branchId: seed.branchA1._id } },
      { $group: { _id: null, guests: { $sum: "$guests" } } },
    ]);
    expect(seated[0].guests).toBe(10);
  });

  it("rate-limits repeated bookings from one IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await publicBooking({
        guests: 1,
        email: `guest${i}@example.com`,
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
