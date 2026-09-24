import { NextRequest } from "next/server";
import { Branch, Customer, Reservation, Restaurant } from "@/models";
import { ApiError, handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { verifyBookingToken } from "@/lib/booking-token";
import { publicBookingUpdateSchema } from "@/lib/validations";
import { assertBookable, bookingSettings } from "@/lib/availability";
import { assignTables, claimTables } from "@/lib/table-assignment";
import { claimSlotCapacity } from "@/lib/capacity";
import { dateToDayKey, dayKeyToDate } from "@/lib/dates";
import { enforceRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

type RouteParams = { params: Promise<{ token: string }> };

/** Loads the booking a signed guest link points at. */
async function loadBooking(token: string) {
  const reservationId = verifyBookingToken(token);
  if (!reservationId) throw new ApiError("This booking link is not valid", 404);

  await connectDB();
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw new ApiError("Booking not found", 404);

  const [branch, restaurant] = await Promise.all([
    Branch.findById(reservation.branchId).lean(),
    Restaurant.findById(reservation.restaurantId)
      .select("name slug bookingSettings phone")
      .lean(),
  ]);
  if (!branch || !restaurant) throw new ApiError("Booking not found", 404);

  return { reservation, branch, restaurant };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const { reservation, branch, restaurant } = await loadBooking(token);
    const customer = await Customer.findById(reservation.customerId)
      .select("name email phone")
      .lean();

    return ok({
      reservationId: reservation._id.toString(),
      date: dateToDayKey(reservation.date),
      time: reservation.time,
      guests: reservation.guests,
      status: reservation.status,
      specialRequests: reservation.specialRequests,
      guest: { name: customer?.name ?? "", email: customer?.email ?? "" },
      branch: {
        _id: branch._id.toString(),
        name: branch.name,
        address: branch.address,
        phone: branch.contactInfo?.phone,
      },
      restaurant: {
        name: restaurant.name,
        slug: restaurant.slug,
        phone: restaurant.phone,
      },
      settings: bookingSettings(restaurant.bookingSettings),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Guests may cancel, or move their booking to another free slot. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    enforceRateLimit(request, "public-booking-update", 10, 10 * 60_000);
    const { token } = await params;
    const input = await parseBody(request, publicBookingUpdateSchema);
    const { reservation, branch, restaurant } = await loadBooking(token);

    if (!["pending", "approved"].includes(reservation.status)) {
      throw new ApiError(
        `This booking is ${reservation.status} and can no longer be changed online`,
        409
      );
    }

    const settings = bookingSettings(restaurant.bookingSettings);

    if (input.action === "cancel") {
      reservation.status = "cancelled";
      await reservation.save();

      await trackEvent(reservation.restaurantId, "reservation_status_changed", {
        reservationId: reservation._id.toString(),
        from: "approved",
        to: "cancelled",
        by: "guest",
      });

      return ok({ status: reservation.status });
    }

    // Reschedule
    const dayKey = input.date ?? dateToDayKey(reservation.date);
    const time = input.time ?? reservation.time;
    const guests = input.guests ?? reservation.guests;

    assertBookable({
      branch,
      branchName: branch.name,
      dayKey,
      time,
      guests,
      settings,
    });

    const seating = await assignTables({
      branchId: branch._id,
      date: dayKeyToDate(dayKey),
      time,
      guests,
      duration: settings.diningDurationMinutes,
      excludeReservationId: reservation._id,
    });
    if (seating.noFit) {
      throw new ApiError("That time is fully booked — please pick another", 409);
    }

    reservation.date = dayKeyToDate(dayKey);
    reservation.time = time;
    reservation.guests = guests;
    reservation.tableIds = seating.tableIds;
    // Changing a confirmed booking sends it back for approval unless the
    // restaurant confirms automatically.
    reservation.status = settings.autoApprove ? "approved" : "pending";
    await reservation.save();

    const claimed = seating.usesTables
      ? await claimTables(reservation, settings.diningDurationMinutes)
      : await claimSlotCapacity(
          reservation,
          branch.capacity,
          settings.diningDurationMinutes
        );
    if (!claimed) {
      throw new ApiError("That time was just taken — please pick another", 409);
    }

    return ok({
      date: dateToDayKey(reservation.date),
      time: reservation.time,
      guests: reservation.guests,
      status: reservation.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
