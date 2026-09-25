import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Branch, Customer, Reservation, Restaurant } from "@/models";
import { publicReservationSchema } from "@/lib/validations";
import { ApiError, handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";
import { claimSlotCapacity } from "@/lib/capacity";
import { assignTables, claimTables } from "@/lib/table-assignment";
import { dayKeyToDate } from "@/lib/dates";
import { assertBookable, bookingSettings } from "@/lib/availability";
import { enforceRateLimit } from "@/lib/rate-limit";
import { bookingManageUrl } from "@/lib/booking-token";
import { sendBookingReceived } from "@/lib/email/booking-emails";
import { notifyTeam, recordActivity } from "@/lib/activity";
import { formatTime } from "@/lib/utils";

/**
 * Public booking endpoint used by the marketing site reservation form.
 * The tenant (restaurantId) is derived from the chosen branch — never
 * trusted directly from arbitrary client input alone.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, "public-reservation", 5, 10 * 60_000);
    const input = await parseBody(request, publicReservationSchema);

    await connectDB();

    const branch = await Branch.findOne({
      _id: new Types.ObjectId(input.branchId),
      restaurantId: new Types.ObjectId(input.restaurantId),
      isActive: true,
    }).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurantId = branch.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId)
      .select("bookingSettings isPublished")
      .lean();
    if (!restaurant?.isPublished) {
      throw new ApiError("This restaurant is not taking online bookings", 404);
    }
    const settings = bookingSettings(restaurant.bookingSettings);

    assertBookable({
      branch,
      branchName: branch.name,
      dayKey: input.date,
      time: input.time,
      guests: input.guests,
      settings,
    });

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

    const seating = await assignTables({
      branchId: branch._id,
      date: dayKeyToDate(input.date),
      time: input.time,
      guests: input.guests,
      duration: settings.diningDurationMinutes,
    });
    if (seating.noFit) {
      throw new ApiError(
        "No table free for that time — please choose another slot",
        409
      );
    }

    const reservation = await Reservation.create({
      restaurantId,
      branchId: branch._id,
      customerId: customer._id,
      tableIds: seating.tableIds,
      date: dayKeyToDate(input.date),
      time: input.time,
      guests: input.guests,
      specialRequests: input.specialRequests,
      status: settings.autoApprove ? "approved" : "pending",
    });

    // Tables (when the branch uses them) or total seats decide the race.
    const claimed = seating.usesTables
      ? await claimTables(reservation, settings.diningDurationMinutes)
      : await claimSlotCapacity(
          reservation,
          branch.capacity,
          settings.diningDurationMinutes
        );
    if (!claimed) {
      throw new ApiError(
        "This time slot is fully booked — please choose another time",
        409
      );
    }

    const confirmed = reservation.status === "approved";
    await sendBookingReceived(reservation, confirmed, request.nextUrl.origin);
    await notifyTeam({
      restaurantId,
      branchId: branch._id,
      type: "reservation_created",
      title: `New booking · ${branch.name}`,
      body: `${input.name} · ${input.guests} ${input.guests === 1 ? "guest" : "guests"} · ${formatTime(input.time)}${confirmed ? "" : " · needs approval"}`,
      link: "/dashboard/reservations?status=pending",
    });
    await recordActivity({
      restaurantId,
      branchId: branch._id,
      actorName: input.name,
      action: "reservation.created",
      targetType: "reservation",
      targetId: reservation._id,
      summary: `${input.name} booked ${input.guests} for ${formatTime(input.time)} at ${branch.name} (online)`,
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
        // Link the guest can use to change or cancel their booking.
        manageUrl: bookingManageUrl(
          reservation._id.toString(),
          request.nextUrl.origin
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
