import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import {
  Customer,
  LoyaltyTransaction,
  MenuItem,
  Order,
  Reservation,
  Restaurant,
} from "@/models";
import * as ordersRoute from "@/app/api/orders/route";
import * as orderRoute from "@/app/api/orders/[id]/route";
import * as payRoute from "@/app/api/orders/[id]/pay/route";
import * as loyaltyRoute from "@/app/api/customers/[id]/loyalty/route";
import * as customerRoute from "@/app/api/customers/[id]/route";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import {
  connectTestDb,
  jsonRequest,
  params,
  resetDb,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: false, provider: "console" })),
}));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;
let dishId: string;

beforeAll(() => connectTestDb("loyalty"));
afterAll(() => mongoose.disconnect());

beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
  await Restaurant.updateOne(
    { _id: seed.restaurantA._id },
    {
      $set: {
        loyaltySettings: {
          enabled: true,
          pointsPer100Taka: 5,
          pointValueTaka: 1,
          minRedeemPoints: 100,
        },
        billingSettings: { vatPercent: 5, serviceChargePercent: 10 },
      },
    }
  );
  const dish = await MenuItem.create({
    restaurantId: seed.restaurantA._id,
    name: "Kacchi Biryani",
    price: 1000,
    category: "Mains",
  });
  dishId = dish._id.toString();
});

/** Opens a table order with one ৳1,000 dish. */
async function orderWithDish(quantity = 1) {
  const response = await ordersRoute.POST(
    jsonRequest("/api/orders", "POST", { branchId: seed.branchA1._id.toString(), guests: 2 })
  );
  const { data: order } = await response.json();
  await orderRoute.POST(
    jsonRequest(`/api/orders/${order._id}`, "POST", {
      items: [{ menuItemId: dishId, quantity }],
    }),
    params(order._id)
  );
  return order._id as string;
}

function patchOrder(id: string, body: Record<string, unknown>) {
  return orderRoute.PATCH(jsonRequest(`/api/orders/${id}`, "PATCH", body), params(id));
}

function pay(id: string) {
  return payRoute.POST(
    jsonRequest(`/api/orders/${id}/pay`, "POST", { method: "cash" }),
    params(id)
  );
}

describe("earning points", () => {
  it("awards points on the food after discounts when the bill is paid", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish(2);
    await patchOrder(id, { customerId: seed.customerA._id.toString(), discountAmount: 200 });

    const response = await pay(id);
    expect(response.status).toBe(200);
    const { data } = await response.json();

    // ৳2,000 − ৳200 discount = ৳1,800 of food → 90 points (not on VAT/service).
    expect(data.loyaltyPointsEarned).toBe(90);
    const customer = await Customer.findById(seed.customerA._id).lean();
    expect(customer?.loyaltyPoints).toBe(90);

    const ledger = await LoyaltyTransaction.find({ customerId: seed.customerA._id }).lean();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "earn", points: 90, balanceAfter: 90 });
  });

  it("awards nothing when the programme is off or no guest is attached", async () => {
    signInAs(seed.ownerA);
    const anonymous = await orderWithDish();
    const { data: first } = await (await pay(anonymous)).json();
    expect(first.loyaltyPointsEarned).toBe(0);

    await Restaurant.updateOne(
      { _id: seed.restaurantA._id },
      { $set: { "loyaltySettings.enabled": false } }
    );
    const withGuest = await orderWithDish();
    await patchOrder(withGuest, { customerId: seed.customerA._id.toString() });
    await pay(withGuest);

    expect((await Customer.findById(seed.customerA._id).lean())?.loyaltyPoints).toBe(0);
  });

  it("uses the booking's guest for a booking's order", async () => {
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
    const response = await ordersRoute.POST(
      jsonRequest("/api/orders", "POST", { reservationId: reservation._id.toString() })
    );
    const { data: order } = await response.json();

    const change = await patchOrder(order._id, { customerId: null });
    expect(change.status).toBe(409);
  });
});

describe("attaching a guest", () => {
  it("refuses a guest from another restaurant", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    const response = await patchOrder(id, { customerId: seed.customerB._id.toString() });
    expect(response.status).toBe(404);
  });
});

describe("redeeming points", () => {
  beforeEach(async () => {
    await Customer.updateOne({ _id: seed.customerA._id }, { $set: { loyaltyPoints: 300 } });
  });

  it("takes points off the bill and spends them when it is paid", async () => {
    signInAs(seed.staffA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString() });

    const applied = await patchOrder(id, { redeemPoints: 200 });
    expect(applied.status).toBe(200);
    const { data: order } = await applied.json();
    expect(order.loyaltyDiscount).toBe(200);
    // ৳800 after points, +10% service +5% VAT.
    expect(order.total).toBe(920);

    const { data: paid } = await (await pay(id)).json();
    expect(paid.total).toBe(920);
    // Earned on the ৳800 actually paid for food.
    expect(paid.loyaltyPointsEarned).toBe(40);

    const customer = await Customer.findById(seed.customerA._id).lean();
    expect(customer?.loyaltyPoints).toBe(300 - 200 + 40);
    const types = (await LoyaltyTransaction.find().sort({ _id: 1 }).lean()).map((t) => t.type);
    expect(types).toEqual(["redeem", "earn"]);
  });

  it("refuses too few points, more than the guest has, or more than the bill", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString() });

    expect((await patchOrder(id, { redeemPoints: 50 })).status).toBe(400);
    expect((await patchOrder(id, { redeemPoints: 400 })).status).toBe(400);

    await Customer.updateOne({ _id: seed.customerA._id }, { $set: { loyaltyPoints: 5000 } });
    expect((await patchOrder(id, { redeemPoints: 1500 })).status).toBe(400);
  });

  it("drops the redemption if the bill shrinks below it", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString(), redeemPoints: 250 });

    // A ৳900 discount leaves ৳100 of food — less than the ৳250 of points.
    await patchOrder(id, { discountAmount: 900 });
    const order = await Order.findById(id).lean();
    expect(order?.loyaltyPointsRedeemed).toBe(0);
    expect(order?.loyaltyDiscount).toBe(0);
  });

  it("will not close the bill if the points were spent elsewhere meanwhile", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString(), redeemPoints: 200 });
    await Customer.updateOne({ _id: seed.customerA._id }, { $set: { loyaltyPoints: 50 } });

    const response = await pay(id);
    expect(response.status).toBe(409);
    expect((await Order.findById(id).lean())?.status).toBe("open");
    expect((await Customer.findById(seed.customerA._id).lean())?.loyaltyPoints).toBe(50);
  });

  it("takes payment and points once when two tills pay at the same moment", async () => {
    // Enough points for every till to redeem, so only the claim stops them.
    await Customer.updateOne({ _id: seed.customerA._id }, { $set: { loyaltyPoints: 1000 } });
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString(), redeemPoints: 200 });

    const responses = await Promise.all([pay(id), pay(id), pay(id)]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409]);

    const customer = await Customer.findById(seed.customerA._id).lean();
    // 1000 − 200 redeemed once + 40 earned once.
    expect(customer?.loyaltyPoints).toBe(840);
    expect(customer?.visitCount).toBe(1);
    const order = await Order.findById(id).lean();
    expect(order?.status).toBe("paid");
    expect(order?.payingAt).toBeUndefined();
  });

  it("lets the bill be paid again after a failed attempt", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString(), redeemPoints: 200 });
    await Customer.updateOne({ _id: seed.customerA._id }, { $set: { loyaltyPoints: 50 } });
    expect((await pay(id)).status).toBe(409);

    await patchOrder(id, { redeemPoints: 0 });
    expect((await pay(id)).status).toBe(200);
  });

  it("clears the redemption when the guest changes", async () => {
    signInAs(seed.ownerA);
    const id = await orderWithDish();
    await patchOrder(id, { customerId: seed.customerA._id.toString(), redeemPoints: 200 });
    await patchOrder(id, { customerId: null });

    const order = await Order.findById(id).lean();
    expect(order?.loyaltyPointsRedeemed).toBe(0);
    expect(order?.total).toBe(1150);
  });
});

describe("manual adjustments", () => {
  function adjust(id: string, body: Record<string, unknown>) {
    return loyaltyRoute.POST(
      jsonRequest(`/api/customers/${id}/loyalty`, "POST", body),
      params(id)
    );
  }

  it("lets a manager add and remove points with a reason", async () => {
    signInAs(seed.ownerA);
    const id = seed.customerA._id.toString();

    const added = await adjust(id, { points: 120, note: "Sorry for the wait" });
    expect(added.status).toBe(200);
    expect((await added.json()).data.balance).toBe(120);

    expect((await adjust(id, { points: -500, note: "Mistake" })).status).toBe(400);
    expect((await adjust(id, { points: -20, note: "Mistake" })).status).toBe(200);

    const detail = await customerRoute.GET(jsonRequest(`/api/customers/${id}`), params(id));
    const { data } = await detail.json();
    expect(data.customer.loyaltyPoints).toBe(100);
    expect(data.loyaltyHistory.map((t: { points: number }) => t.points)).toEqual([-20, 120]);
    expect(data.loyalty.enabled).toBe(true);
  });

  it("is not open to staff, other restaurants, or reasonless changes", async () => {
    signInAs(seed.staffA);
    expect(
      (await adjust(seed.customerA._id.toString(), { points: 10, note: "Nice guest" })).status
    ).toBe(403);

    signInAs(seed.ownerB);
    expect(
      (await adjust(seed.customerA._id.toString(), { points: 10, note: "Nice guest" })).status
    ).toBe(404);

    signInAs(seed.ownerA);
    expect((await adjust(seed.customerA._id.toString(), { points: 10 })).status).toBe(422);
  });
});
