import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { ActivityLog, Notification, Reservation } from "@/models";
import * as publicReservationsRoute from "@/app/api/public/reservations/route";
import * as reservationRoute from "@/app/api/reservations/[id]/route";
import * as notificationsRoute from "@/app/api/notifications/route";
import * as activityRoute from "@/app/api/activity/route";
import * as cronRoute from "@/app/api/cron/reminders/route";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
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

beforeAll(() => connectTestDb("notifications"));
afterAll(() => mongoose.disconnect());
beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
});

let ip = 0;
async function book(overrides: Record<string, unknown> = {}) {
  ip += 1;
  const response = await publicReservationsRoute.POST(
    jsonRequest(
      "/api/public/reservations",
      "POST",
      {
        restaurantId: seed.restaurantA._id.toString(),
        branchId: seed.branchA1._id.toString(),
        name: "Nusrat Jahan",
        email: `guest${ip}@example.com`,
        date: TOMORROW(),
        time: "19:00",
        guests: 2,
        ...overrides,
      },
      `198.51.100.${ip}`
    )
  );
  const body = await response.json();
  return body.data.reservationId as string;
}

describe("notifications", () => {
  it("alerts the team when a guest books", async () => {
    await book();

    const notification = await Notification.findOne({
      restaurantId: seed.restaurantA._id,
    }).lean();

    expect(notification?.type).toBe("reservation_created");
    expect(notification?.title).toContain("Gulshan");
    expect(notification?.body).toContain("needs approval");
  });

  it("counts unread and marks everything read", async () => {
    await book();
    await book();

    signInAs(seed.ownerA);
    const before = await (
      await notificationsRoute.GET(jsonRequest("/api/notifications"))
    ).json();
    expect(before.data.unreadCount).toBe(2);
    expect(before.data.notifications[0].read).toBe(false);

    await notificationsRoute.PATCH();

    const after = await (
      await notificationsRoute.GET(jsonRequest("/api/notifications"))
    ).json();
    expect(after.data.unreadCount).toBe(0);
    expect(after.data.notifications[0].read).toBe(true);
  });

  it("keeps each restaurant's alerts to itself", async () => {
    await book();

    signInAs(seed.ownerB);
    const body = await (
      await notificationsRoute.GET(jsonRequest("/api/notifications"))
    ).json();
    expect(body.data.notifications).toHaveLength(0);
  });

  it("shows branch-scoped staff their branch and restaurant-wide alerts", async () => {
    await book(); // branch A1, where the staff member works
    await Notification.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA2._id,
      type: "reservation_created",
      title: "Other branch",
      readBy: [],
    });
    await Notification.create({
      restaurantId: seed.restaurantA._id,
      type: "system",
      title: "Restaurant-wide notice",
      readBy: [],
    });

    signInAs(seed.staffA);
    const body = await (
      await notificationsRoute.GET(jsonRequest("/api/notifications"))
    ).json();

    const titles = body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain("Restaurant-wide notice");
    expect(titles.some((title: string) => title.includes("Gulshan"))).toBe(true);
    expect(titles).not.toContain("Other branch");
  });
});

describe("activity log", () => {
  it("records the booking and who changed it", async () => {
    const id = await book();

    signInAs(seed.ownerA);
    await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${id}`, "PATCH", { status: "approved" }),
      params(id)
    );

    const entries = await ActivityLog.find({ restaurantId: seed.restaurantA._id })
      .sort({ createdAt: 1 })
      .lean();

    expect(entries[0]).toMatchObject({
      action: "reservation.created",
      actorName: "Nusrat Jahan",
    });
    expect(entries.at(-1)).toMatchObject({
      action: "reservation.approved",
      actorName: "Owner A",
    });
  });

  it("is readable by managers but not staff", async () => {
    await book();

    signInAs(seed.staffA);
    const forbidden = await activityRoute.GET(jsonRequest("/api/activity"));
    expect(forbidden.status).toBe(403);

    signInAs(seed.ownerA);
    const allowed = await activityRoute.GET(jsonRequest("/api/activity"));
    const body = await allowed.json();
    expect(allowed.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("filters by what changed", async () => {
    await book();

    signInAs(seed.ownerA);
    const body = await (
      await activityRoute.GET(jsonRequest("/api/activity?action=waitlist"))
    ).json();
    expect(body.data).toHaveLength(0);
  });
});

describe("reminder cron", () => {
  const secret = "cron-secret";

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
  });

  function run(token?: string) {
    return cronRoute.GET(
      jsonRequest(
        `/api/cron/reminders${token ? `?secret=${token}` : ""}`
      )
    );
  }

  it("refuses without the secret", async () => {
    expect((await run()).status).toBe(401);
    expect((await run("wrong")).status).toBe(401);
  });

  it("reminds tomorrow's guests once", async () => {
    const id = await book();

    const first = await (await run(secret)).json();
    expect(first.data.sent).toBe(1);
    expect(
      (await Reservation.findById(id).lean())?.reminderSentAt
    ).toBeInstanceOf(Date);

    // A second run the same day must not email anyone again.
    const second = await (await run(secret)).json();
    expect(second.data.sent).toBe(0);
  });

  it("ignores bookings on other days and cancelled ones", async () => {
    const cancelled = await book();
    await Reservation.updateOne({ _id: cancelled }, { status: "cancelled" });
    await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(addDaysToKey(todayKey(), 5)),
      time: "19:00",
      guests: 2,
      status: "approved",
    });

    const body = await (await run(secret)).json();
    expect(body.data.sent).toBe(0);
  });
});
