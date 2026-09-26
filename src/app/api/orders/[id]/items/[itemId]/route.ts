import { NextRequest } from "next/server";
import { Order } from "@/models";
import { orderItemUpdateSchema } from "@/lib/validations";
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
import { recordActivity } from "@/lib/activity";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

/** Changes one line: quantity, notes, kitchen progress, or void it. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id, itemId } = await params;
    const input = await parseBody(request, orderItemUpdateSchema);

    const order = await Order.findOne({
      _id: parseObjectId(id, "order id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    });
    if (!order) throw new ApiError("Order not found", 404);
    if (order.status !== "open") {
      throw new ApiError(`This order is ${order.status} and cannot be changed`, 409);
    }

    const item = order.items.find(
      (line) => line._id.toString() === parseObjectId(itemId, "item id").toString()
    );
    if (!item) throw new ApiError("Order item not found", 404);

    if (input.quantity !== undefined) item.quantity = input.quantity;
    if (input.notes !== undefined) item.notes = input.notes || undefined;

    if (input.status !== undefined) {
      item.status = input.status;
      if (input.status === "ready" && !item.readyAt) item.readyAt = new Date();
      // Anything the kitchen touches counts as sent.
      if (input.status !== "queued" && !item.sentAt) item.sentAt = new Date();
    }

    if (input.voided !== undefined) {
      // Taking a dish off the bill is a manager decision.
      if (input.voided && ctx.role === "staff") {
        throw new ApiError("Only a manager can void an item", 403);
      }
      item.voided = input.voided;
      if (input.voided) {
        await recordActivity({
          restaurantId: ctx.restaurantId,
          branchId: order.branchId,
          actorId: ctx.userId,
          action: "order.item_voided",
          targetType: "order",
          targetId: order._id,
          summary: `Voided ${item.quantity}× ${item.name} on order #${order.orderNumber}`,
        });
      }
    }

    applyTotals(order);
    await order.save();

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Removes a line that was never sent to the kitchen. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id, itemId } = await params;

    const order = await Order.findOne({
      _id: parseObjectId(id, "order id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    });
    if (!order) throw new ApiError("Order not found", 404);
    if (order.status !== "open") {
      throw new ApiError(`This order is ${order.status} and cannot be changed`, 409);
    }

    const item = order.items.find((line) => line._id.toString() === itemId);
    if (!item) throw new ApiError("Order item not found", 404);
    if (item.sentAt) {
      throw new ApiError(
        "This item is already with the kitchen — void it instead",
        409
      );
    }

    order.items = order.items.filter(
      (line) => line._id.toString() !== item._id.toString()
    );
    applyTotals(order);
    await order.save();

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}
