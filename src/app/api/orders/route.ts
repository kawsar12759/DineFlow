import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Branch, Order, Reservation, Restaurant } from "@/models";
import { orderCreateSchema } from "@/lib/validations";
import {
  ApiError,
  assertBranchAccess,
  branchFilter,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { billingSettings } from "@/lib/availability";
import { nextOrderNumber } from "@/lib/orders";
import { dayKeyToDate, isDayKey, todayKey } from "@/lib/dates";
import { recordActivity } from "@/lib/activity";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? "open";
    const date = searchParams.get("date");
    const branchId = searchParams.get("branchId");

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    };
    if (status !== "all") filter.status = status;
    if (branchId && branchId !== "all") {
      assertBranchAccess(ctx, branchId);
      filter.branchId = parseObjectId(branchId, "branch id");
    }
    if (date) {
      if (!isDayKey(date)) throw new ApiError("Invalid date", 400);
      filter.serviceDate = dayKeyToDate(date);
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("tableIds", "name")
      .populate("customerId", "name")
      .populate("branchId", "name")
      .lean();

    return ok(orders);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Opens a ticket, either for a seated reservation or straight onto tables. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const input = await parseBody(request, orderCreateSchema);

    let branchId: Types.ObjectId;
    let tableIds: Types.ObjectId[] = [];
    let customerId: Types.ObjectId | undefined;
    let guests = input.guests;
    let reservationId: Types.ObjectId | undefined;

    if (input.reservationId) {
      const reservation = await Reservation.findOne({
        _id: parseObjectId(input.reservationId, "reservation id"),
        ...tenantFilter(ctx),
        ...branchFilter(ctx),
      }).lean();
      if (!reservation) throw new ApiError("Reservation not found", 404);

      const existing = await Order.findOne({
        reservationId: reservation._id,
        status: "open",
      })
        .select("_id")
        .lean();
      if (existing) {
        throw new ApiError("This booking already has an open order", 409);
      }

      branchId = reservation.branchId;
      tableIds = (reservation.tableIds ?? []) as Types.ObjectId[];
      customerId = reservation.customerId;
      guests = guests ?? reservation.guests;
      reservationId = reservation._id;
    } else {
      assertBranchAccess(ctx, input.branchId!);
      branchId = parseObjectId(input.branchId!, "branch id");
      tableIds = (input.tableIds ?? []).map((id) => parseObjectId(id, "table id"));
    }

    const branch = await Branch.findOne({
      _id: branchId,
      ...tenantFilter(ctx),
    })
      .select("name")
      .lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurant = await Restaurant.findById(ctx.restaurantId)
      .select("billingSettings")
      .lean();
    const billing = billingSettings(restaurant?.billingSettings);
    const serviceDate = dayKeyToDate(todayKey());

    // Ticket numbers are unique per branch per day; retry once if two
    // waiters open an order at the same moment.
    let order;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await Order.create({
          ...tenantFilter(ctx),
          branchId,
          orderNumber: await nextOrderNumber(branchId, serviceDate),
          serviceDate,
          reservationId,
          customerId,
          tableIds,
          guests,
          items: [],
          vatPercent: billing.vatPercent,
          serviceChargePercent: billing.serviceChargePercent,
          openedBy: ctx.userId,
        });
        break;
      } catch (error) {
        const duplicate =
          typeof error === "object" &&
          error !== null &&
          (error as { code?: number }).code === 11000;
        if (!duplicate || attempt === 2) throw error;
      }
    }
    if (!order) throw new ApiError("Could not open the order", 500);

    await recordActivity({
      restaurantId: ctx.restaurantId,
      branchId,
      actorId: ctx.userId,
      action: "order.opened",
      targetType: "order",
      targetId: order._id,
      summary: `Opened order #${order.orderNumber} at ${branch.name}`,
    });

    return ok(order, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
