import { NextRequest } from "next/server";
import { Branch, Reservation, Restaurant, Table } from "@/models";
import {
  ApiError,
  assertBranchAccess,
  branchFilter,
  handleApiError,
  ok,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { bookingSettings, bookableSlots, describeHours, isClosedOn } from "@/lib/availability";
import { dayKeyToDate, isDayKey, todayKey } from "@/lib/dates";

/** Everything the floor view needs for one branch on one day. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") ?? todayKey();
    const branchParam = searchParams.get("branchId");

    if (!isDayKey(date)) throw new ApiError("Invalid date", 400);

    // Branch-scoped staff may only ask for their own branch.
    if (branchParam) assertBranchAccess(ctx, branchParam);
    let branchId: string | null = branchParam ?? ctx.branchScope ?? null;
    if (!branchId) {
      const first = await Branch.findOne({ ...tenantFilter(ctx), isActive: true })
        .sort({ _id: 1 })
        .select("_id")
        .lean();
      branchId = first?._id.toString() ?? null;
    }
    if (!branchId) throw new ApiError("No branch found", 404);
    assertBranchAccess(ctx, branchId);

    const branch = await Branch.findOne({
      _id: parseObjectId(branchId, "branch id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx, "_id"),
    }).lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurant = await Restaurant.findById(ctx.restaurantId)
      .select("bookingSettings")
      .lean();
    const settings = bookingSettings(restaurant?.bookingSettings);

    const [tables, reservations] = await Promise.all([
      // Ordered by name so zones appear in their natural floor order.
      Table.find({ branchId: branch._id, isActive: true })
        .sort({ name: 1 })
        .select("name seats zone")
        .lean(),
      Reservation.find({
        ...tenantFilter(ctx),
        branchId: branch._id,
        date: dayKeyToDate(date),
      })
        .sort({ time: 1 })
        .populate("customerId", "name phone email noShowCount")
        .lean(),
    ]);

    return ok({
      date,
      branch: {
        _id: branch._id.toString(),
        name: branch.name,
        capacity: branch.capacity,
        hours: describeHours(branch.hours),
      },
      settings,
      closed: isClosedOn(branch, date),
      slots: bookableSlots(branch, date, settings),
      tables: tables.map((table) => ({
        _id: table._id.toString(),
        name: table.name,
        seats: table.seats,
        zone: table.zone ?? "Unzoned",
      })),
      reservations: reservations.map((reservation) => ({
        _id: reservation._id.toString(),
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
        specialRequests: reservation.specialRequests,
        estimatedSpend: reservation.estimatedSpend,
        tableIds: (reservation.tableIds ?? []).map(String),
        customer: reservation.customerId as unknown as {
          _id: string;
          name: string;
          phone?: string;
          email: string;
          noShowCount?: number;
        },
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
