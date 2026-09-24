import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Branch, Customer, Reservation, Restaurant, Table } from "@/models";
import { reservationUpdateSchema } from "@/lib/validations";
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
import { trackEvent } from "@/lib/analytics";
import {
  ACTIVE_RESERVATION_STATUSES,
  RESERVATION_TRANSITIONS,
} from "@/lib/constants";
import { assertBookable, bookingSettings } from "@/lib/availability";
import { assignTables, claimTables } from "@/lib/table-assignment";
import { claimSlotCapacity } from "@/lib/capacity";
import { dateToDayKey, dayKeyToDate } from "@/lib/dates";
import { freeTablesAt } from "@/lib/tables";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;

    const reservation = await Reservation.findOne({
      _id: parseObjectId(id, "reservation id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    })
      .populate("branchId", "name address")
      .populate("customerId", "name email phone")
      .populate("tableIds", "name seats zone")
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
    const input = await parseBody(request, reservationUpdateSchema);

    const reservation = await Reservation.findOne({
      _id: parseObjectId(id, "reservation id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    });
    if (!reservation) throw new ApiError("Reservation not found", 404);

    const [branch, restaurant] = await Promise.all([
      Branch.findById(reservation.branchId).lean(),
      Restaurant.findById(ctx.restaurantId).select("bookingSettings").lean(),
    ]);
    if (!branch) throw new ApiError("Branch not found", 404);
    const settings = bookingSettings(restaurant?.bookingSettings);

    const previousStatus = reservation.status;
    const rescheduling =
      input.date !== undefined ||
      input.time !== undefined ||
      input.guests !== undefined;

    // ---- Reschedule / party size ----
    if (rescheduling) {
      if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) {
        throw new ApiError(
          `A ${reservation.status} reservation cannot be moved`,
          409
        );
      }

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
        mode: "staff",
      });

      reservation.date = dayKeyToDate(dayKey);
      reservation.time = time;
      reservation.guests = guests;

      // Re-seat, unless the caller picked tables explicitly in this request.
      if (input.tableIds === undefined) {
        const seating = await assignTables({
          branchId: branch._id,
          date: reservation.date,
          time,
          guests,
          duration: settings.diningDurationMinutes,
          excludeReservationId: reservation._id,
        });
        if (seating.noFit) {
          throw new ApiError(
            `No table free at ${branch.name} for ${guests} at ${time}`,
            409
          );
        }
        reservation.tableIds = seating.tableIds;
      }
    }

    // ---- Move to specific tables ----
    if (input.tableIds !== undefined) {
      const ids = input.tableIds.map((value) => parseObjectId(value, "table id"));

      const tables = await Table.find({
        _id: { $in: ids },
        branchId: reservation.branchId,
        isActive: true,
      })
        .select("name seats zone")
        .lean();
      if (tables.length !== ids.length) {
        throw new ApiError("Table not found at this branch", 404);
      }

      const others = await Reservation.find({
        branchId: reservation.branchId,
        date: reservation.date,
        status: { $in: ACTIVE_RESERVATION_STATUSES },
        _id: { $ne: reservation._id },
      })
        .select("time tableIds")
        .lean();

      const free = freeTablesAt(
        tables.map((table) => ({
          _id: table._id.toString(),
          name: table.name,
          seats: table.seats,
          zone: table.zone,
        })),
        others.map((booking) => ({
          time: booking.time,
          tableIds: (booking.tableIds ?? []).map(String),
        })),
        reservation.time,
        settings.diningDurationMinutes
      );
      if (free.length !== ids.length) {
        throw new ApiError(
          "That table is already taken for this seating",
          409
        );
      }

      const seats = tables.reduce((sum, table) => sum + table.seats, 0);
      if (seats < reservation.guests) {
        throw new ApiError(
          `Those tables seat ${seats}, but the party is ${reservation.guests}`,
          409
        );
      }

      reservation.tableIds = ids;
    }

    // ---- Status change ----
    if (input.status && input.status !== reservation.status) {
      const allowed = RESERVATION_TRANSITIONS[reservation.status];
      if (!allowed.includes(input.status)) {
        throw new ApiError(
          `Cannot move reservation from "${reservation.status}" to "${input.status}"`,
          409
        );
      }
      reservation.status = input.status;
    }

    if (input.estimatedSpend !== undefined) {
      reservation.estimatedSpend = input.estimatedSpend;
    }

    await reservation.save();

    // Re-check seating after any change that could clash with a concurrent one.
    if (rescheduling || input.tableIds !== undefined) {
      const seated =
        reservation.tableIds.length > 0
          ? await claimTables(
              {
                _id: reservation._id,
                branchId: reservation.branchId,
                date: reservation.date,
                time: reservation.time,
                guests: reservation.guests,
                tableIds: reservation.tableIds as Types.ObjectId[],
              },
              settings.diningDurationMinutes
            )
          : await claimSlotCapacity(
              reservation,
              branch.capacity,
              settings.diningDurationMinutes
            );
      if (!seated) {
        throw new ApiError(
          "That seating was taken while saving — please try another",
          409
        );
      }
    }

    // Completing a reservation records a visit on the customer profile.
    if (reservation.status === "completed" && previousStatus !== "completed") {
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

    // No-shows count against the customer's profile.
    if (reservation.status === "no_show" && previousStatus !== "no_show") {
      await Customer.findOneAndUpdate(
        { _id: reservation.customerId, ...tenantFilter(ctx) },
        { $inc: { noShowCount: 1 } }
      );
    }

    if (input.status && input.status !== previousStatus) {
      await trackEvent(ctx.restaurantId, "reservation_status_changed", {
        reservationId: reservation._id.toString(),
        from: previousStatus,
        to: reservation.status,
        by: ctx.userId,
      });
    }

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
