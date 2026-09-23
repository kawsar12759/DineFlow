import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Branch, Customer, Reservation } from "@/models";
import { publicReservationSchema } from "@/lib/validations";
import { ApiError, handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";
import { claimSlotCapacity } from "@/lib/capacity";
import { dayKeyToDate, slotInstant } from "@/lib/dates";
import { enforceRateLimit } from "@/lib/rate-limit";

const MAX_DAYS_AHEAD = 90;

/**
 * Public booking endpoint used by the marketing site reservation form.
 * The tenant (restaurantId) is derived from the chosen branch — never
 * trusted directly from arbitrary client input alone.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, "public-reservation", 5, 10 * 60_000);
    const input = await parseBody(request, publicReservationSchema);

    const slot = slotInstant(input.date, input.time);
    const now = Date.now();
    if (slot.getTime() <= now) {
      throw new ApiError("Please choose a time in the future", 400);
    }
    if (slot.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60_000) {
      throw new ApiError(
        `Bookings open up to ${MAX_DAYS_AHEAD} days in advance`,
        400
      );
    }

    await connectDB();

    const branch = await Branch.findOne({
      _id: new Types.ObjectId(input.branchId),
      restaurantId: new Types.ObjectId(input.restaurantId),
      isActive: true,
    }).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurantId = branch.restaurantId;

    const customer = await Customer.findOneAndUpdate(
      { email: input.email.toLowerCase(), restaurantId },
      {
        $setOnInsert: {
          name: input.name,
          phone: input.phone,
          restaurantId,
        },
      },
      { new: true, upsert: true }
    );

    const reservation = await Reservation.create({
      restaurantId,
      branchId: branch._id,
      customerId: customer._id,
      date: dayKeyToDate(input.date),
      time: input.time,
      guests: input.guests,
      specialRequests: input.specialRequests,
      status: "pending",
    });

    if (!(await claimSlotCapacity(reservation, branch.capacity))) {
      throw new ApiError(
        "This time slot is fully booked — please choose another time",
        409
      );
    }

    await trackEvent(restaurantId, "reservation_created", {
      reservationId: reservation._id.toString(),
      branchId: branch._id.toString(),
      guests: input.guests,
      source: "public_site",
    });

    return ok(
      {
        reservationId: reservation._id.toString(),
        status: reservation.status,
        branch: branch.name,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
