import { NextRequest } from "next/server";
import { Restaurant } from "@/models";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireSuperAdmin,
} from "@/lib/api-helpers";
import { adminRestaurantUpdateSchema } from "@/lib/validations";
import { subscriptionState } from "@/lib/subscription";
import { recordActivity } from "@/lib/activity";
import { PLANS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Support actions on one restaurant: extend free days, change plan, suspend
 * or reinstate. Each needs a note, and is written to the restaurant's own
 * activity log so its owner can see what DineFlow changed.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await params;
    const input = await parseBody(request, adminRestaurantUpdateSchema);

    const restaurant = await Restaurant.findById(parseObjectId(id, "restaurant id"));
    if (!restaurant) throw new ApiError("Restaurant not found", 404);

    const changes: string[] = [];

    if (input.extendDays) {
      const state = subscriptionState(restaurant);
      // Extend from today if it has already run out, so the days are usable.
      const from = Math.max(Date.now(), state.endsAt.getTime());
      restaurant.subscriptionEndsAt = new Date(from + input.extendDays * 86_400_000);
      changes.push(
        `extended by ${input.extendDays} days to ${formatDate(restaurant.subscriptionEndsAt)}`
      );
    }

    if (input.plan && input.plan !== restaurant.subscriptionPlan) {
      changes.push(
        `plan changed from ${PLANS[restaurant.subscriptionPlan].name} to ${PLANS[input.plan].name}`
      );
      restaurant.subscriptionPlan = input.plan;
    }

    if (input.suspended === true && !restaurant.suspendedAt) {
      restaurant.suspendedAt = new Date();
      restaurant.suspendedReason = input.note;
      changes.push("suspended");
    } else if (input.suspended === false && restaurant.suspendedAt) {
      restaurant.suspendedAt = undefined;
      restaurant.suspendedReason = undefined;
      changes.push("reinstated");
    }

    if (changes.length === 0) throw new ApiError("Nothing changed", 400);
    await restaurant.save();

    await recordActivity({
      restaurantId: restaurant._id,
      actorId: admin.userId,
      actorName: "DineFlow support",
      action: "billing.admin",
      targetType: "restaurant",
      targetId: restaurant._id,
      summary: `Subscription ${changes.join(", ")} (${input.note})`,
    });

    return ok({ subscription: subscriptionState(restaurant) });
  } catch (error) {
    return handleApiError(error);
  }
}
