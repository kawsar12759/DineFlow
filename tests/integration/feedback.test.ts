import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import mongoose from "mongoose";
import { Feedback, MenuItem, Notification, Reservation, Restaurant } from "@/models";
import * as ordersRoute from "@/app/api/orders/route";
import * as orderRoute from "@/app/api/orders/[id]/route";
import * as payRoute from "@/app/api/orders/[id]/pay/route";
import * as reservationRoute from "@/app/api/reservations/[id]/route";
import * as publicFeedbackRoute from "@/app/api/public/feedback/[token]/route";
import * as feedbackRoute from "@/app/api/feedback/route";
import * as feedbackItemRoute from "@/app/api/feedback/[id]/route";
import { feedbackToken, bookingToken } from "@/lib/booking-token";
import { sendEmail } from "@/lib/email/send";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
import {
  connectTestDb,
  jsonRequest,
  params,
  resetDb,
  routeParams,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: false, provider: "console" })),
}));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(() => connectTestDb("feedback"));
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  (sendEmail as Mock).mockClear();
  seed = await seedTwoTenants();
});

function visit(overrides: Record<string, unknown> = {}) {
  return Reservation.create({
    restaurantId: seed.restaurantA._id,
    branchId: seed.branchA1._id,
    customerId: seed.customerA._id,
    date: dayKeyToDate(todayKey()),
    time: "19:00",
    guests: 2,
    status: "completed",
    ...overrides,
  });
}

function submit(token: string, body: Record<string, unknown>) {
  return publicFeedbackRoute.POST(
    jsonRequest(`/api/public/feedback/${token}`, "POST", body),
    routeParams({ token })
  );
}

function feedbackEmails() {
  return (sendEmail as Mock).mock.calls
    .map(([message]) => message)
    .filter((message) => message.subject.startsWith("How was your visit"));
}

describe("asking for feedback", () => {
  it("emails the guest once when the bill for their booking is paid", async () => {
    const reservation = await visit({ status: "seated" });
    const dish = await MenuItem.create({
      restaurantId: seed.restaurantA._id,
      name: "Fuchka",
      price: 250,
      category: "Starters",
    });

    signInAs(seed.ownerA);
    const opened = await ordersRoute.POST(
      jsonRequest("/api/orders", "POST", { reservationId: reservation._id.toString() })
    );
    const { data: order } = await opened.json();
    await orderRoute.POST(
      jsonRequest(`/api/orders/${order._id}`, "POST", {
        items: [{ menuItemId: dish._id.toString() }],
      }),
      params(order._id)
    );
    await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", { method: "bkash" }),
      params(order._id)
    );

    const emails = feedbackEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("guest@a.test");
    expect(emails[0].text).toContain(`/feedback/${feedbackToken(reservation._id.toString())}`);
    expect((await Reservation.findById(reservation._id).lean())?.feedbackRequestedAt).toBeDefined();
  });

  it("emails when staff complete a booking, and not when turned off", async () => {
    const reservation = await visit({ status: "seated" });
    signInAs(seed.ownerA);
    await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${reservation._id}`, "PATCH", { status: "completed" }),
      params(reservation._id.toString())
    );
    expect(feedbackEmails()).toHaveLength(1);

    await Restaurant.updateOne(
      { _id: seed.restaurantA._id },
      { $set: { "feedbackSettings.requestAfterVisit": false } }
    );
    const second = await visit({ status: "seated", time: "21:00" });
    await reservationRoute.PATCH(
      jsonRequest(`/api/reservations/${second._id}`, "PATCH", { status: "completed" }),
      params(second._id.toString())
    );
    expect(feedbackEmails()).toHaveLength(1);
  });
});

describe("leaving feedback", () => {
  it("records one rating per visit and tells the team", async () => {
    const reservation = await visit();
    const token = feedbackToken(reservation._id.toString());

    const before = await publicFeedbackRoute.GET(
      jsonRequest(`/api/public/feedback/${token}`),
      routeParams({ token })
    );
    const { data: shown } = await before.json();
    expect(shown).toMatchObject({ open: true, feedback: null, guestName: "Guest A" });

    const response = await submit(token, { rating: 2, comment: "Slow service" });
    expect(response.status).toBe(201);

    const again = await submit(token, { rating: 5 });
    expect(again.status).toBe(409);

    const stored = await Feedback.find({ reservationId: reservation._id }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ rating: 2, comment: "Slow service", isPublic: true });

    const alert = await Notification.findOne({ type: "feedback_received" }).lean();
    expect(alert?.title).toContain("★★☆☆☆");
    expect(alert?.restaurantId.toString()).toBe(seed.restaurantA._id.toString());
  });

  it("refuses visits that have not happened, closed windows, and bad links", async () => {
    const upcoming = await visit({ status: "approved" });
    expect((await submit(feedbackToken(upcoming._id.toString()), { rating: 5 })).status).toBe(409);

    const old = await visit({ date: dayKeyToDate(addDaysToKey(todayKey(), -45)) });
    expect((await submit(feedbackToken(old._id.toString()), { rating: 5 })).status).toBe(409);

    // A booking-management link must not work as a feedback link.
    const done = await visit();
    expect((await submit(bookingToken(done._id.toString()), { rating: 5 })).status).toBe(404);

    expect((await submit(feedbackToken(done._id.toString()), { rating: 9 })).status).toBe(422);
  });
});

describe("the feedback page", () => {
  async function review(branch: "A1" | "A2", rating: number, comment?: string) {
    const reservation = await visit({
      branchId: branch === "A1" ? seed.branchA1._id : seed.branchA2._id,
      time: `${10 + (await Feedback.countDocuments())}:00`,
    });
    await submit(feedbackToken(reservation._id.toString()), { rating, comment });
  }

  beforeEach(async () => {
    await review("A1", 5, "Lovely");
    await review("A1", 4);
    await review("A2", 1, "Cold food");
    // Another restaurant's review must never show up.
    const other = await Reservation.create({
      restaurantId: seed.restaurantB._id,
      branchId: seed.branchB._id,
      customerId: seed.customerB._id,
      date: dayKeyToDate(todayKey()),
      time: "20:00",
      guests: 2,
      status: "completed",
    });
    await submit(feedbackToken(other._id.toString()), { rating: 3 });
  });

  async function list(query = "") {
    const response = await feedbackRoute.GET(jsonRequest(`/api/feedback?${query}`));
    return response.json();
  }

  it("summarises the restaurant's own reviews", async () => {
    signInAs(seed.ownerA);
    const body = await list();
    expect(body.data).toHaveLength(3);
    expect(body.summary).toEqual({ count: 3, average: 3.3, distribution: [1, 0, 0, 1, 1] });

    const lowOnly = await list("rating=1");
    expect(lowOnly.data).toHaveLength(1);
    // Filters narrow the list, not the summary.
    expect(lowOnly.summary.count).toBe(3);
  });

  it("shows branch staff only their branch", async () => {
    signInAs(seed.staffA);
    const body = await list();
    expect(body.data).toHaveLength(2);
    expect(body.summary.count).toBe(2);

    const other = await feedbackRoute.GET(
      jsonRequest(`/api/feedback?branchId=${seed.branchA2._id}`)
    );
    expect(other.status).toBe(403);
  });

  it("lets a manager reply (emailing the guest once) and hide a review", async () => {
    const target = await Feedback.findOne({ rating: 1 }).lean();
    const id = target!._id.toString();
    const patch = (body: Record<string, unknown>) =>
      feedbackItemRoute.PATCH(jsonRequest(`/api/feedback/${id}`, "PATCH", body), params(id));

    signInAs(seed.staffA);
    expect((await patch({ reply: "Sorry" })).status).toBe(403);

    signInAs(seed.ownerB);
    expect((await patch({ reply: "Sorry" })).status).toBe(404);

    signInAs(seed.ownerA);
    (sendEmail as Mock).mockClear();
    expect((await patch({ reply: "We are sorry — please come back" })).status).toBe(200);
    expect((await patch({ reply: "We are sorry — please come back as our guest" })).status).toBe(200);
    const replies = (sendEmail as Mock).mock.calls.filter(([message]) =>
      message.subject.includes("replied to your feedback")
    );
    expect(replies).toHaveLength(1);

    expect((await patch({ isPublic: false })).status).toBe(200);
    const stored = await Feedback.findById(id).lean();
    expect(stored?.reply?.body).toBe("We are sorry — please come back as our guest");
    expect(stored?.isPublic).toBe(false);

    expect((await list("replied=no")).data).toHaveLength(2);
  });
});
