import { NextRequest } from "next/server";
import { Branch, Customer, Reservation, Restaurant } from "@/models";
import { reservationSchema } from "@/lib/validations";
import {
  ApiError,
  assertBranchAccess,
  branchFilter,
  handleApiError,
  ok,
  paginated,
  parseBody,
  parseObjectId,
  parsePagination,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";
import { claimSlotCapacity } from "@/lib/capacity";
import { dayKeyToDate, isDayKey } from "@/lib/dates";
import { assertBookable, bookingSettings } from "@/lib/availability";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const status = searchParams.get("status");
    const branchId = searchParams.get("branchId");
    const date = searchParams.get("date");

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    };
    if (status && status !== "all") filter.status = status;
    if (branchId && branchId !== "all") {
      assertBranchAccess(ctx, branchId);
      filter.branchId = parseObjectId(branchId, "branch id");
    }
    if (date) {
      if (!isDayKey(date)) throw new ApiError("Invalid date", 400);
      filter.date = dayKeyToDate(date);
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(limit)
        .populate("branchId", "name")
        .populate("customerId", "name email phone")
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    return paginated(reservations, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const input = await parseBody(request, reservationSchema);

    assertBranchAccess(ctx, input.branchId);
    const branch = await Branch.findOne({
      _id: parseObjectId(input.branchId, "branch id"),
      ...tenantFilter(ctx),
    }).lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const restaurant = await Restaurant.findById(ctx.restaurantId)
      .select("bookingSettings")
      .lean();
    const settings = bookingSettings(restaurant?.bookingSettings);

    assertBookable({
      branch,
      branchName: branch.name,
      dayKey: input.date,
      time: input.time,
      guests: input.guests,
      settings,
      mode: "staff",
    });

    let customerId;
    if (input.customerId) {
      const customer = await Customer.findOne({
        _id: parseObjectId(input.customerId, "customer id"),
        ...tenantFilter(ctx),
      }).lean();
      if (!customer) throw new ApiError("Customer not found", 404);
      customerId = customer._id;
    } else if (input.customer) {
      const customer = await Customer.findOneAndUpdate(
        { email: input.customer.email.toLowerCase(), ...tenantFilter(ctx) },
        {
          $setOnInsert: {
            name: input.customer.name,
            phone: input.customer.phone,
            ...tenantFilter(ctx),
          },
        },
        { new: true, upsert: true }
      );
      customerId = customer._id;
      if (customer.createdAt.getTime() === customer.updatedAt.getTime()) {
        await trackEvent(ctx.restaurantId, "customer_created", {
          customerId: customer._id.toString(),
          source: "reservation",
        });
      }
    } else {
      throw new ApiError("Either customerId or customer details required", 400);
    }

    const reservation = await Reservation.create({
      ...tenantFilter(ctx),
      branchId: branch._id,
      customerId,
      date: dayKeyToDate(input.date),
      time: input.time,
      guests: input.guests,
      specialRequests: input.specialRequests,
      estimatedSpend: input.estimatedSpend,
      status: "pending",
    });

    if (
      !(await claimSlotCapacity(
        reservation,
        branch.capacity,
        settings.diningDurationMinutes
      ))
    ) {
      throw new ApiError(
        `${branch.name} is fully booked around ${input.time} — choose another time`,
        409
      );
    }

    await trackEvent(ctx.restaurantId, "reservation_created", {
      reservationId: reservation._id.toString(),
      branchId: branch._id.toString(),
      guests: input.guests,
      source: "dashboard",
    });

    return ok(reservation, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
