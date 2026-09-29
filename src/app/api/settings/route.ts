import { NextRequest } from "next/server";
import { Restaurant, type IRestaurant } from "@/models";
import { settingsUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  requireTenantSession,
  requireWriteSession,
} from "@/lib/api-helpers";
import { billingSettings, bookingSettings } from "@/lib/availability";
import { recordActivity } from "@/lib/activity";
import { loyaltySettings } from "@/lib/loyalty";
import { feedbackSettings } from "@/lib/feedback";
import { assertPlanHasLoyalty } from "@/lib/plan-limits";
import { PLANS } from "@/lib/constants";

function withDefaults<T extends Pick<
  IRestaurant,
  "bookingSettings" | "billingSettings" | "loyaltySettings" | "feedbackSettings"
>>(restaurant: T) {
  return {
    ...restaurant,
    bookingSettings: bookingSettings(restaurant.bookingSettings),
    billingSettings: billingSettings(restaurant.billingSettings),
    loyaltySettings: loyaltySettings(restaurant.loyaltySettings),
    feedbackSettings: feedbackSettings(restaurant.feedbackSettings),
  };
}

const SECTION_LABELS = {
  profile: "the restaurant profile",
  bookingSettings: "booking rules",
  billingSettings: "bill settings",
  loyaltySettings: "the loyalty programme",
  feedbackSettings: "feedback settings",
} as const;

/** Restaurant profile + booking rules. Readable by any dashboard user. */
export async function GET() {
  try {
    const ctx = await requireTenantSession();
    const restaurant = await Restaurant.findById(ctx.restaurantId).lean();
    if (!restaurant) throw new ApiError("Restaurant not found", 404);

    return ok({
      ...withDefaults(restaurant),
      planIncludesLoyalty: PLANS[ctx.subscription.plan].loyalty,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireWriteSession(["super_admin", "owner"]);
    const input = await parseBody(request, settingsUpdateSchema);

    if (input.loyaltySettings?.enabled) assertPlanHasLoyalty(ctx);

    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.profile ?? {})) {
      // Empty strings clear optional fields rather than storing "".
      update[key] = value === "" ? undefined : value;
    }
    for (const section of [
      "bookingSettings",
      "billingSettings",
      "loyaltySettings",
      "feedbackSettings",
    ] as const) {
      for (const [key, value] of Object.entries(input[section] ?? {})) {
        update[`${section}.${key}`] = value;
      }
    }

    if (Object.keys(update).length === 0) {
      throw new ApiError("Nothing to update", 400);
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      ctx.restaurantId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!restaurant) throw new ApiError("Restaurant not found", 404);

    await recordActivity({
      restaurantId: ctx.restaurantId,
      actorId: ctx.userId,
      action: "settings.updated",
      targetType: "restaurant",
      targetId: restaurant._id,
      summary: `Updated ${(Object.keys(input) as (keyof typeof SECTION_LABELS)[])
        .filter((key) => input[key])
        .map((key) => SECTION_LABELS[key])
        .join(" and ")}`,
    });

    return ok({
      ...withDefaults(restaurant),
      planIncludesLoyalty: PLANS[ctx.subscription.plan].loyalty,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
