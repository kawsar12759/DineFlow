import { NextRequest } from "next/server";
import type { HydratedDocument } from "mongoose";
import {
  Branch,
  Customer,
  Reservation,
  Restaurant,
  WaitlistEntry,
  type IWaitlistEntry,
} from "@/models";
import { waitlistUpdateSchema } from "@/lib/validations";
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
import { bookingSettings } from "@/lib/availability";
import { assignTables, claimTables } from "@/lib/table-assignment";
import { claimSlotCapacity } from "@/lib/capacity";
import { currentTime } from "@/lib/dates";
import { trackEvent } from "@/lib/analytics";

type RouteParams = { params: Promise<{ id: string }> };

/** Seating a waiting party creates a walk-in reservation on a free table. */
async function seatEntry(
  ctx: Awaited<ReturnType<typeof requireTenantSession>>,
  entry: HydratedDocument<IWaitlistEntry>,
  time: string
) {
  const [branch, restaurant] = await Promise.all([
    Branch.findById(entry.branchId).lean(),
    Restaurant.findById(ctx.restaurantId).select("bookingSettings").lean(),
  ]);
  if (!branch) throw new ApiError("Branch not found", 404);
  const settings = bookingSettings(restaurant?.bookingSettings);

  const seating = await assignTables({
    branchId: branch._id,
    date: entry.date,
    time,
    guests: entry.guests,
    duration: settings.diningDurationMinutes,
  });
  if (seating.noFit) {
    throw new ApiError("No table free right now — keep the party waiting", 409);
  }

  // Walk-ins rarely have an email; key the guest record off their phone.
  const email = `walkin-${entry._id.toString()}@walk-in.dineflow`;
  const customer = await Customer.findOneAndUpdate(
    { email, ...tenantFilter(ctx) },
    {
      $setOnInsert: {
        name: entry.name,
        phone: entry.phone,
        ...tenantFilter(ctx),
      },
    },
    { new: true, upsert: true }
  );

  const reservation = await Reservation.create({
    ...tenantFilter(ctx),
    branchId: branch._id,
    customerId: customer._id,
    tableIds: seating.tableIds,
    date: entry.date,
    time,
    guests: entry.guests,
    specialRequests: entry.notes,
    status: "seated",
  });

  const claimed = seating.usesTables
    ? await claimTables(reservation, settings.diningDurationMinutes)
    : await claimSlotCapacity(
        reservation,
        branch.capacity,
        settings.diningDurationMinutes
      );
  if (!claimed) {
    throw new ApiError("That table was taken — please try again", 409);
  }

  await trackEvent(ctx.restaurantId, "reservation_created", {
    reservationId: reservation._id.toString(),
    branchId: branch._id.toString(),
    guests: entry.guests,
    source: "waitlist",
  });

  entry.status = "seated";
  entry.reservationId = reservation._id;
  entry.seatedAt = new Date();
  await entry.save();

  return { entry: entry.toObject(), reservationId: reservation._id.toString() };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const input = await parseBody(request, waitlistUpdateSchema);

    const entry = await WaitlistEntry.findOne({
      _id: parseObjectId(id, "waitlist id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    });
    if (!entry) throw new ApiError("Waitlist entry not found", 404);

    if (input.status === "seated") {
      if (entry.status === "seated") {
        throw new ApiError("This party is already seated", 409);
      }
      const result = await seatEntry(ctx, entry, input.time ?? currentTime());
      return ok(result);
    }

    if (input.status) entry.status = input.status;
    if (input.quotedMinutes !== undefined) {
      entry.quotedMinutes = input.quotedMinutes;
    }
    await entry.save();

    return ok(entry);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;

    const entry = await WaitlistEntry.findOneAndDelete({
      _id: parseObjectId(id, "waitlist id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    }).lean();
    if (!entry) throw new ApiError("Waitlist entry not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
