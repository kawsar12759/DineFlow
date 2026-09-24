import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Branch, Reservation, Restaurant, Table } from "@/models";
import {
  ApiError,
  handleApiError,
  ok,
  parseObjectId,
} from "@/lib/api-helpers";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { dayKeyToDate, isDayKey } from "@/lib/dates";
import {
  bookingSettings,
  describeHours,
  isClosedOn,
  slotAvailability,
} from "@/lib/availability";

/**
 * Open time slots for a branch on a day, so the booking form only offers
 * times that are within opening hours and still have seats.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const branchId = searchParams.get("branchId");
    const date = searchParams.get("date");
    const guests = Math.max(1, Number(searchParams.get("guests")) || 1);

    if (!branchId) throw new ApiError("branchId is required", 400);
    if (!date || !isDayKey(date)) throw new ApiError("Invalid date", 400);

    await connectDB();

    const branch = await Branch.findOne({
      _id: parseObjectId(branchId, "branch id"),
      isActive: true,
    }).lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurant = await Restaurant.findById(branch.restaurantId)
      .select("bookingSettings")
      .lean();
    const settings = bookingSettings(restaurant?.bookingSettings);

    const [bookings, tables] = await Promise.all([
      Reservation.find({
        branchId: new Types.ObjectId(branchId),
        date: dayKeyToDate(date),
        status: { $in: ACTIVE_RESERVATION_STATUSES },
      })
        .select("time guests tableIds")
        .lean(),
      Table.find({ branchId: new Types.ObjectId(branchId), isActive: true })
        .select("name seats zone")
        .lean(),
    ]);

    return ok({
      date,
      closed: isClosedOn(branch, date),
      hours: describeHours(branch.hours),
      capacity: branch.capacity,
      maxPartySize: settings.maxPartySize,
      partyTooLarge: guests > settings.maxPartySize,
      slots: slotAvailability({
        branch,
        dayKey: date,
        settings,
        capacity: branch.capacity,
        bookings: bookings.map((booking) => ({
          time: booking.time,
          guests: booking.guests,
          tableIds: (booking.tableIds ?? []).map(String),
        })),
        tables: tables.map((table) => ({
          _id: table._id.toString(),
          name: table.name,
          seats: table.seats,
          zone: table.zone,
        })),
        guests,
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
