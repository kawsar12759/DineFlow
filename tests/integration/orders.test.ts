import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { Customer, MenuItem, Order, Reservation, Table } from "@/models";
import * as ordersRoute from "@/app/api/orders/route";
import * as orderRoute from "@/app/api/orders/[id]/route";
import * as orderItemRoute from "@/app/api/orders/[id]/items/[itemId]/route";
import * as payRoute from "@/app/api/orders/[id]/pay/route";
import * as kitchenRoute from "@/app/api/kitchen/route";
import * as overviewRoute from "@/app/api/analytics/overview/route";
import { dayKeyToDate, todayKey } from "@/lib/dates";
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

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;
let dishes: { _id: mongoose.Types.ObjectId; name: string; price: number }[];
let table: { _id: mongoose.Types.ObjectId };

beforeAll(() => connectTestDb("orders"));
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();

  dishes = await MenuItem.create([
    {
      restaurantId: seed.restaurantA._id,
      name: "Grilled Prawns",
      price: 890,
      category: "Starters",
    },
    {
      restaurantId: seed.restaurantA._id,
      name: "Mango Lassi",
      price: 320,
      category: "Drinks",
    },
  ]);

  table = await Table.create({
    restaurantId: seed.restaurantA._id,
    branchId: seed.branchA1._id,
    name: "T1",
    seats: 4,
    zone: "Main",
  });
});

async function openOrder(body: Record<string, unknown> = {}) {
  const response = await ordersRoute.POST(
    jsonRequest("/api/orders", "POST", {
      branchId: seed.branchA1._id.toString(),
      tableIds: [table._id.toString()],
      guests: 2,
      ...body,
    })
  );
  const json = await response.json();
  return { response, order: json.data as { _id: string; orderNumber: number } };
}

async function addDish(orderId: string, index = 0, quantity = 1) {
  return orderRoute.POST(
    jsonRequest(`/api/orders/${orderId}`, "POST", {
      items: [{ menuItemId: dishes[index]._id.toString(), quantity }],
    }),
    params(orderId)
  );
}

describe("opening orders", () => {
  it("numbers tickets per branch per day", async () => {
    signInAs(seed.ownerA);

    const first = await openOrder();
    const second = await openOrder();

    expect(first.order.orderNumber).toBe(1);
    expect(second.order.orderNumber).toBe(2);
  });

  it("takes the table, guests and customer from a booking", async () => {
    const reservation = await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      tableIds: [table._id],
      date: dayKeyToDate(todayKey()),
      time: "19:00",
      guests: 4,
      status: "seated",
    });

    signInAs(seed.ownerA);
    const { order } = await openOrder({
      reservationId: reservation._id.toString(),
      branchId: undefined,
      tableIds: undefined,
      guests: undefined,
    });

    const stored = await Order.findById(order._id).lean();
    expect(stored?.guests).toBe(4);
    expect(stored?.customerId?.toString()).toBe(seed.customerA._id.toString());
    expect(stored?.tableIds[0].toString()).toBe(table._id.toString());
  });

  it("refuses a second open order for the same booking", async () => {
    const reservation = await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(todayKey()),
      time: "19:00",
      guests: 2,
      status: "seated",
    });

    signInAs(seed.ownerA);
    await openOrder({ reservationId: reservation._id.toString() });
    const { response } = await openOrder({
      reservationId: reservation._id.toString(),
    });

    expect(response.status).toBe(409);
  });
});

describe("the bill", () => {
  it("copies today's price and totals with service charge and VAT", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    await addDish(order._id, 0, 2); // 2 × 890

    // A later menu price change must not rewrite the open bill.
    await MenuItem.updateOne({ _id: dishes[0]._id }, { price: 2000 });

    const stored = await Order.findById(order._id).lean();
    expect(stored?.items[0].unitPrice).toBe(890);
    expect(stored?.subtotal).toBe(1780);
    expect(stored?.serviceChargeAmount).toBe(178);
    expect(stored?.vatAmount).toBe(89);
    expect(stored?.total).toBe(2047);
  });

  it("lets a manager discount but not a staff member", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    await addDish(order._id, 0);

    signInAs(seed.staffA);
    const forbidden = await orderRoute.PATCH(
      jsonRequest(`/api/orders/${order._id}`, "PATCH", { discountAmount: 100 }),
      params(order._id)
    );
    expect(forbidden.status).toBe(403);

    signInAs(seed.ownerA);
    const allowed = await orderRoute.PATCH(
      jsonRequest(`/api/orders/${order._id}`, "PATCH", { discountAmount: 90 }),
      params(order._id)
    );
    const body = await allowed.json();
    expect(body.data.discountAmount).toBe(90);
    expect(body.data.total).toBe(920); // (890 − 90) + 10% + 5%
  });

  it("keeps voided items on the ticket but off the bill", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    await addDish(order._id, 0);
    const withItems = await (await addDish(order._id, 1)).json();
    const itemId = withItems.data.items[0]._id;

    const response = await orderItemRoute.PATCH(
      jsonRequest(`/api/orders/${order._id}/items/${itemId}`, "PATCH", {
        voided: true,
      }),
      routeParams({ id: order._id, itemId })
    );
    const body = await response.json();

    expect(body.data.items).toHaveLength(2);
    expect(body.data.subtotal).toBe(320);
  });

  it("removes an unsent line but not one the kitchen has", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    const added = await (await addDish(order._id, 0)).json();
    const itemId = added.data.items[0]._id;

    await orderRoute.PATCH(
      jsonRequest(`/api/orders/${order._id}`, "PATCH", { sendToKitchen: true }),
      params(order._id)
    );

    const refused = await orderItemRoute.DELETE(
      jsonRequest(`/api/orders/${order._id}/items/${itemId}`, "DELETE"),
      routeParams({ id: order._id, itemId })
    );
    expect(refused.status).toBe(409);
  });
});

describe("kitchen", () => {
  it("only shows dishes that were sent, and drops them once served", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    const added = await (await addDish(order._id, 0)).json();
    const itemId = added.data.items[0]._id;

    const before = await (
      await kitchenRoute.GET(jsonRequest("/api/kitchen"))
    ).json();
    expect(before.data.tickets).toHaveLength(0);

    await orderRoute.PATCH(
      jsonRequest(`/api/orders/${order._id}`, "PATCH", { sendToKitchen: true }),
      params(order._id)
    );

    const sent = await (await kitchenRoute.GET(jsonRequest("/api/kitchen"))).json();
    expect(sent.data.tickets[0].items[0]).toMatchObject({
      name: "Grilled Prawns",
      status: "queued",
    });

    await orderItemRoute.PATCH(
      jsonRequest(`/api/orders/${order._id}/items/${itemId}`, "PATCH", {
        status: "served",
      }),
      routeParams({ id: order._id, itemId })
    );

    const after = await (await kitchenRoute.GET(jsonRequest("/api/kitchen"))).json();
    expect(after.data.tickets).toHaveLength(0);
  });
});

describe("closing the bill", () => {
  async function seatedBooking() {
    return Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      tableIds: [table._id],
      date: dayKeyToDate(todayKey()),
      time: "19:00",
      guests: 2,
      status: "seated",
    });
  }

  it("records the payment, completes the booking and credits the guest", async () => {
    const reservation = await seatedBooking();
    signInAs(seed.ownerA);
    const { order } = await openOrder({
      reservationId: reservation._id.toString(),
    });
    await addDish(order._id, 0, 2); // 1780 + 10% + 5% = 2047

    const response = await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", { method: "bkash" }),
      params(order._id)
    );
    expect(response.status).toBe(200);

    const stored = await Order.findById(order._id).lean();
    expect(stored?.status).toBe("paid");
    expect(stored?.payment?.method).toBe("bkash");
    expect(stored?.payment?.amount).toBe(2047);

    const booking = await Reservation.findById(reservation._id).lean();
    expect(booking?.status).toBe("completed");
    expect(booking?.estimatedSpend).toBe(2047);
    expect(booking?.orderId?.toString()).toBe(order._id);

    const customer = await Customer.findById(seed.customerA._id).lean();
    expect(customer?.visitCount).toBe(1);
    expect(customer?.totalSpend).toBe(2047);
  });

  it("records the bill as paid and keeps cash and change apart", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    await addDish(order._id, 1); // 320 + 10% + 5% = 368

    await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", {
        method: "cash",
        amount: 500,
      }),
      params(order._id)
    );

    const stored = await Order.findById(order._id).lean();
    expect(stored?.total).toBe(368);
    expect(stored?.payment?.amount).toBe(368);
    expect(stored?.payment?.tendered).toBe(500);
    expect(stored?.payment?.changeGiven).toBe(132);
  });

  it("refuses short payment, empty orders and paying twice", async () => {
    signInAs(seed.ownerA);

    const { order: empty } = await openOrder();
    const emptyResponse = await payRoute.POST(
      jsonRequest(`/api/orders/${empty._id}/pay`, "POST", { method: "cash" }),
      params(empty._id)
    );
    expect(emptyResponse.status).toBe(400);

    const { order } = await openOrder();
    await addDish(order._id, 0);

    const short = await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", {
        method: "cash",
        amount: 100,
      }),
      params(order._id)
    );
    expect(short.status).toBe(400);

    await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", { method: "cash" }),
      params(order._id)
    );
    const again = await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", { method: "cash" }),
      params(order._id)
    );
    expect(again.status).toBe(409);
  });

  it("locks a paid order against changes", async () => {
    signInAs(seed.ownerA);
    const { order } = await openOrder();
    await addDish(order._id, 0);
    await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", { method: "cash" }),
      params(order._id)
    );

    const response = await addDish(order._id, 1);
    expect(response.status).toBe(409);
  });
});

describe("revenue", () => {
  it("counts paid bills, and bookings that were never billed, once each", async () => {
    signInAs(seed.ownerA);

    // A booking settled through an order.
    const reservation = await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(todayKey()),
      time: "19:00",
      guests: 2,
      status: "seated",
    });
    const { order } = await openOrder({ reservationId: reservation._id.toString() });
    await addDish(order._id, 0, 2); // total 2047
    await payRoute.POST(
      jsonRequest(`/api/orders/${order._id}/pay`, "POST", { method: "cash" }),
      params(order._id)
    );

    // A completed booking with a spend typed in by hand, no order.
    await Reservation.create({
      restaurantId: seed.restaurantA._id,
      branchId: seed.branchA1._id,
      customerId: seed.customerA._id,
      date: dayKeyToDate(todayKey()),
      time: "13:00",
      guests: 2,
      status: "completed",
      estimatedSpend: 1000,
    });

    const body = await (await overviewRoute.GET()).json();
    expect(body.data.revenue).toBe(3047);
  });
});
