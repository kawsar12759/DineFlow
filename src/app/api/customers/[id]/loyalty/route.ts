import { NextRequest } from "next/server";
import { Customer } from "@/models";
import { loyaltyAdjustSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { changePoints } from "@/lib/loyalty";
import { recordActivity } from "@/lib/activity";

type RouteParams = { params: Promise<{ id: string }> };

/** Manually add or remove points (goodwill, corrections), with a reason. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const input = await parseBody(request, loyaltyAdjustSchema);

    const customer = await Customer.findOne({
      _id: parseObjectId(id, "customer id"),
      ...tenantFilter(ctx),
    })
      .select("name loyaltyPoints")
      .lean();
    if (!customer) throw new ApiError("Customer not found", 404);

    const result = await changePoints({
      restaurantId: ctx.restaurantId,
      customerId: customer._id,
      type: "adjust",
      points: input.points,
      note: input.note,
      actorId: ctx.userId,
    });
    if (!result) {
      throw new ApiError(
        `${customer.name} has only ${customer.loyaltyPoints} points to remove`,
        400
      );
    }

    await recordActivity({
      restaurantId: ctx.restaurantId,
      actorId: ctx.userId,
      action: "loyalty.adjusted",
      targetType: "customer",
      targetId: customer._id,
      summary: `${input.points > 0 ? "Added" : "Removed"} ${Math.abs(input.points)} points ${input.points > 0 ? "to" : "from"} ${customer.name}: ${input.note}`,
    });

    return ok({ balance: result.balance });
  } catch (error) {
    return handleApiError(error);
  }
}
