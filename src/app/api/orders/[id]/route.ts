import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Customer, MenuItem, Order, Reservation, Restaurant } from "@/models";
import { orderItemsSchema, orderUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  branchFilter,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { applyTotals } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";
import { recordActivity } from "@/lib/activity";
import { loyaltySettings, pointsValue } from "@/lib/loyalty";

type RouteParams = { params: Promise<{ id: string }> };

async function loadOrder(
  ctx: Awaited<ReturnType<typeof requireTenantSession>>,
  id: string
) {
  const order = await Order.findOne({
    _id: parseObjectId(id, "order id"),
    ...tenantFilter(ctx),
    ...branchFilter(ctx),
  });
  if (!order) throw new ApiError("Order not found", 404);
  return order;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;

    const order = await Order.findOne({
      _id: parseObjectId(id, "order id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    })
      .populate("tableIds", "name seats")
      .populate("customerId", "name phone email loyaltyPoints")
      .populate("branchId", "name")
      .lean();
    if (!order) throw new ApiError("Order not found", 404);

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Adds lines to an open order, copying today's name and price. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const input = await parseBody(request, orderItemsSchema);

    const order = await loadOrder(ctx, id);
    if (order.status !== "open") {
      throw new ApiError(`This order is ${order.status} and cannot be changed`, 409);
    }

    const menuItems = await MenuItem.find({
      _id: { $in: input.items.map((item) => parseObjectId(item.menuItemId, "menu item id")) },
      ...tenantFilter(ctx),
    })
      .select("name price")
      .lean();
    const byId = new Map(menuItems.map((item) => [item._id.toString(), item]));

    for (const line of input.items) {
      const menuItem = byId.get(line.menuItemId);
      if (!menuItem) throw new ApiError("Menu item not found", 404);

      // Ordering the same dish again just adds to the existing line, as long
      // as it has no note of its own and the kitchen has not seen it yet.
      const existing = order.items.find(
        (item) =>
          item.menuItemId?.toString() === menuItem._id.toString() &&
          !item.sentAt &&
          !item.voided &&
          !item.notes &&
          !line.notes
      );
      if (existing) {
        existing.quantity = Math.min(99, existing.quantity + (line.quantity ?? 1));
        continue;
      }

      order.items.push({
        _id: new Types.ObjectId(),
        menuItemId: menuItem._id,
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: line.quantity ?? 1,
        notes: line.notes || undefined,
        status: "queued",
        voided: false,
      });
    }

    applyTotals(order);
    await order.save();

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Discount, cover count, sending queued lines to the kitchen, attaching a
 * guest, or spending their loyalty points.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const input = await parseBody(request, orderUpdateSchema);

    const order = await loadOrder(ctx, id);
    if (order.status !== "open") {
      throw new ApiError(`This order is ${order.status} and cannot be changed`, 409);
    }

    if (input.guests !== undefined) order.guests = input.guests;

    if (input.discountAmount !== undefined) {
      // Discounts are a manager decision.
      if (ctx.role === "staff") {
        throw new ApiError("Only a manager can apply a discount", 403);
      }
      order.discountAmount = input.discountAmount;
    }

    if (input.customerId !== undefined) {
      // A booking's order belongs to whoever booked.
      if (order.reservationId) {
        throw new ApiError("This order belongs to a booking's guest", 409);
      }
      if (input.customerId === null) {
        order.customerId = undefined;
      } else {
        const customer = await Customer.findOne({
          _id: parseObjectId(input.customerId, "customer id"),
          ...tenantFilter(ctx),
        })
          .select("_id")
          .lean();
        if (!customer) throw new ApiError("Customer not found", 404);
        order.customerId = customer._id;
      }
      // Points belong to the guest they were taken from.
      order.loyaltyPointsRedeemed = 0;
      order.loyaltyDiscount = 0;
    }

    if (input.redeemPoints !== undefined) {
      if (input.redeemPoints === 0) {
        order.loyaltyPointsRedeemed = 0;
        order.loyaltyDiscount = 0;
      } else {
        if (!order.customerId) {
          throw new ApiError("Attach a guest before redeeming points", 400);
        }
        const [restaurant, customer] = await Promise.all([
          Restaurant.findById(ctx.restaurantId).select("loyaltySettings").lean(),
          Customer.findOne({ _id: order.customerId, ...tenantFilter(ctx) })
            .select("loyaltyPoints")
            .lean(),
        ]);
        const loyalty = loyaltySettings(restaurant?.loyaltySettings);
        if (!loyalty.enabled) {
          throw new ApiError("The loyalty programme is turned off", 400);
        }
        if (input.redeemPoints < loyalty.minRedeemPoints) {
          throw new ApiError(
            `At least ${loyalty.minRedeemPoints} points must be redeemed at once`,
            400
          );
        }
        if (!customer || customer.loyaltyPoints < input.redeemPoints) {
          throw new ApiError(
            `The guest has only ${customer?.loyaltyPoints ?? 0} points`,
            400
          );
        }

        const value = pointsValue(input.redeemPoints, loyalty);
        const payable = Math.max(0, order.subtotal - order.discountAmount);
        if (value > payable + 0.001) {
          throw new ApiError(
            `${input.redeemPoints} points are worth ${formatCurrency(value)}, more than the ${formatCurrency(payable)} bill`,
            400
          );
        }
        order.loyaltyPointsRedeemed = input.redeemPoints;
        order.loyaltyDiscount = value;
      }
    }

    let sent = 0;
    if (input.sendToKitchen) {
      const now = new Date();
      for (const item of order.items) {
        if (!item.voided && item.status === "queued" && !item.sentAt) {
          item.sentAt = now;
          sent += 1;
        }
      }
    }

    applyTotals(order);
    await order.save();

    if (sent > 0) {
      await recordActivity({
        restaurantId: ctx.restaurantId,
        branchId: order.branchId,
        actorId: ctx.userId,
        action: "order.sent",
        targetType: "order",
        targetId: order._id,
        summary: `Sent ${sent} item(s) from order #${order.orderNumber} to the kitchen`,
      });
    }

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Voids an open order (mistakes, walkouts). Paid orders stay for the record. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;

    const order = await loadOrder(ctx, id);
    if (order.status === "paid") {
      throw new ApiError("A paid order cannot be voided", 409);
    }

    order.status = "void";
    await order.save();

    // Free the booking from this order so a new one can be opened.
    if (order.reservationId) {
      await Reservation.updateOne(
        { _id: order.reservationId, ...tenantFilter(ctx) },
        { $unset: { orderId: "" } }
      );
    }
    await recordActivity({
      restaurantId: ctx.restaurantId,
      branchId: order.branchId,
      actorId: ctx.userId,
      action: "order.voided",
      targetType: "order",
      targetId: order._id,
      summary: `Voided order #${order.orderNumber}`,
    });

    return ok({ voided: true });
  } catch (error) {
    return handleApiError(error);
  }
}
