import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Customer, Order, Reservation } from "@/models";
import { orderPaymentSchema } from "@/lib/validations";
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
import { trackEvent } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Closes the bill. This is where revenue becomes real: the paid total is
 * recorded on the order, on the guest's profile, and on the booking, which
 * is completed at the same time.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const input = await parseBody(request, orderPaymentSchema);

    const order = await Order.findOne({
      _id: parseObjectId(id, "order id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    });
    if (!order) throw new ApiError("Order not found", 404);
    if (order.status === "paid") {
      throw new ApiError("This order is already paid", 409);
    }
    if (order.status === "void") {
      throw new ApiError("A voided order cannot be paid", 409);
    }

    const billable = order.items.filter((item) => !item.voided);
    if (billable.length === 0) {
      throw new ApiError("Add something to the order before closing it", 400);
    }

    const totals = applyTotals(order);
    // `amount` is what the guest handed over; the bill itself is the total.
    const tendered = input.amount ?? totals.total;
    if (tendered + 0.01 < totals.total) {
      throw new ApiError(
        `That is less than the bill of ${formatCurrency(totals.total)}`,
        400
      );
    }

    order.status = "paid";
    order.closedBy = new Types.ObjectId(ctx.userId);
    order.payment = {
      method: input.method,
      amount: totals.total,
      tendered: tendered > totals.total ? tendered : undefined,
      changeGiven:
        tendered > totals.total
          ? Math.round((tendered - totals.total) * 100) / 100
          : undefined,
      reference: input.reference || undefined,
      paidAt: new Date(),
      receivedBy: order.closedBy,
    };
    await order.save();

    // The booking is finished, and the guest's history gets the real spend.
    if (order.reservationId) {
      const reservation = await Reservation.findOne({
        _id: order.reservationId,
        ...tenantFilter(ctx),
      });
      if (reservation) {
        // Linking the order keeps revenue from being counted twice.
        reservation.orderId = order._id;
        reservation.estimatedSpend = totals.total;
        if (reservation.status !== "completed") reservation.status = "completed";
        await reservation.save();
      }
    }

    if (order.customerId) {
      await Customer.findOneAndUpdate(
        { _id: order.customerId, ...tenantFilter(ctx) },
        {
          $push: {
            visitHistory: {
              date: order.serviceDate,
              branchId: order.branchId,
              spend: totals.total,
              guests: order.guests ?? 1,
            },
          },
          $inc: { totalSpend: totals.total, visitCount: 1 },
        }
      );
    }

    await trackEvent(ctx.restaurantId, "revenue_recorded", {
      orderId: order._id.toString(),
      reservationId: order.reservationId?.toString(),
      branchId: order.branchId.toString(),
      amount: totals.total,
      method: input.method,
    });

    await recordActivity({
      restaurantId: ctx.restaurantId,
      branchId: order.branchId,
      actorId: ctx.userId,
      action: "order.paid",
      targetType: "order",
      targetId: order._id,
      summary: `Closed order #${order.orderNumber} — ${formatCurrency(totals.total)} by ${input.method}`,
    });

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}
