import { NextRequest } from "next/server";
import { Customer, Reservation } from "@/models";
import { reservationStatusSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";
import type { ReservationStatus } from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["seated", "cancelled"],
  rejected: [],
  seated: ["completed"],
  completed: [],
  cancelled: [],
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;

    const reservation = await Reservation.findOne({
      _id: parseObjectId(id, "reservation id"),
      ...tenantFilter(ctx),
    })
      .populate("branchId", "name address")
      .populate("customerId", "name email phone")
      .lean();

    if (!reservation) throw new ApiError("Reservation not found", 404);

    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const { status } = await parseBody(request, reservationStatusSchema);

    const reservation = await Reservation.findOne({
      _id: parseObjectId(id, "reservation id"),
      ...tenantFilter(ctx),
    });

    if (!reservation) throw new ApiError("Reservation not found", 404);

    const allowed = ALLOWED_TRANSITIONS[reservation.status];
    if (!allowed.includes(status)) {
      throw new ApiError(
        `Cannot move reservation from "${reservation.status}" to "${status}"`,
        409
      );
    }

    const previousStatus = reservation.status;
    reservation.status = status;
    await reservation.save();

    // Completing a reservation records a visit on the customer profile.
    if (status === "completed") {
      const spend = reservation.estimatedSpend ?? 0;
      await Customer.findOneAndUpdate(
        { _id: reservation.customerId, ...tenantFilter(ctx) },
        {
          $push: {
            visitHistory: {
              date: reservation.date,
              branchId: reservation.branchId,
              spend,
              guests: reservation.guests,
            },
          },
          $inc: { totalSpend: spend, visitCount: 1 },
        }
      );

      if (spend > 0) {
        await trackEvent(ctx.restaurantId, "revenue_recorded", {
          reservationId: reservation._id.toString(),
          branchId: reservation.branchId.toString(),
          amount: spend,
        });
      }
    }

    await trackEvent(ctx.restaurantId, "reservation_status_changed", {
      reservationId: reservation._id.toString(),
      from: previousStatus,
      to: status,
      by: ctx.userId,
    });

    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;

    const reservation = await Reservation.findOneAndDelete({
      _id: parseObjectId(id, "reservation id"),
      ...tenantFilter(ctx),
    }).lean();

    if (!reservation) throw new ApiError("Reservation not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
