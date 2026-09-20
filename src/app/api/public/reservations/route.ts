import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Branch, Customer, Reservation } from "@/models";
import { publicReservationSchema } from "@/lib/validations";
import { ApiError, handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";

/**
 * Public booking endpoint used by the marketing site reservation form.
 * The tenant (restaurantId) is derived from the chosen branch — never
 * trusted directly from arbitrary client input alone.
 */
export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, publicReservationSchema);

    await connectDB();

    const branch = await Branch.findOne({
      _id: new Types.ObjectId(input.branchId),
      restaurantId: new Types.ObjectId(input.restaurantId),
      isActive: true,
    }).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurantId = branch.restaurantId;

    const reservationDate = new Date(input.date);
    if (reservationDate < new Date(new Date().toDateString())) {
      throw new ApiError("Reservation date cannot be in the past", 400);
    }

    // Capacity guard: reject if this slot is already at branch capacity.
    const existingGuests = await Reservation.aggregate([
      {
        $match: {
          branchId: branch._id,
          date: reservationDate,
          time: input.time,
          status: { $in: ["pending", "approved", "seated"] },
        },
      },
      { $group: { _id: null, guests: { $sum: "$guests" } } },
    ]);

    if ((existingGuests[0]?.guests ?? 0) + input.guests > branch.capacity) {
      throw new ApiError(
        "This time slot is fully booked — please choose another time",
        409
      );
    }

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
      date: reservationDate,
      time: input.time,
      guests: input.guests,
      specialRequests: input.specialRequests,
      status: "pending",
    });

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
