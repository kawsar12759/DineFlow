import { NextRequest } from "next/server";
import { Customer, Feedback, LoyaltyTransaction, Reservation, Restaurant } from "@/models";
import { customerUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  requireWriteSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { effectiveLoyalty } from "@/lib/loyalty";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const customerId = parseObjectId(id, "customer id");

    const [customer, reservations, loyaltyHistory, feedback, restaurant] = await Promise.all([
      Customer.findOne({ _id: customerId, ...tenantFilter(ctx) })
        .populate("visitHistory.branchId", "name")
        .lean(),
      Reservation.find({ customerId, ...tenantFilter(ctx) })
        .sort({ date: -1 })
        .limit(20)
        .populate("branchId", "name")
        .lean(),
      LoyaltyTransaction.find({ customerId, ...tenantFilter(ctx) })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("actorId", "name")
        .lean(),
      Feedback.find({ customerId, ...tenantFilter(ctx) })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("branchId", "name")
        .lean(),
      Restaurant.findById(ctx.restaurantId)
        .select("loyaltySettings subscriptionPlan")
        .lean(),
    ]);

    if (!customer) throw new ApiError("Customer not found", 404);

    return ok({
      customer,
      reservations,
      loyaltyHistory,
      feedback,
      loyalty: effectiveLoyalty(restaurant),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireWriteSession();
    const { id } = await params;
    const input = await parseBody(request, customerUpdateSchema);

    const customer = await Customer.findOneAndUpdate(
      { _id: parseObjectId(id, "customer id"), ...tenantFilter(ctx) },
      { $set: input },
      { new: true, runValidators: true }
    ).lean();

    if (!customer) throw new ApiError("Customer not found", 404);

    return ok(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireWriteSession(["super_admin", "owner", "manager"]);
    const { id } = await params;

    const customer = await Customer.findOneAndDelete({
      _id: parseObjectId(id, "customer id"),
      ...tenantFilter(ctx),
    }).lean();

    if (!customer) throw new ApiError("Customer not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
