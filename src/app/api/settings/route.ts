import { NextRequest } from "next/server";
import { Restaurant } from "@/models";
import { settingsUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  requireTenantSession,
} from "@/lib/api-helpers";
import { bookingSettings } from "@/lib/availability";

/** Restaurant profile + booking rules. Readable by any dashboard user. */
export async function GET() {
  try {
    const ctx = await requireTenantSession();
    const restaurant = await Restaurant.findById(ctx.restaurantId).lean();
    if (!restaurant) throw new ApiError("Restaurant not found", 404);

    return ok({
      ...restaurant,
      bookingSettings: bookingSettings(restaurant.bookingSettings),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner"]);
    const input = await parseBody(request, settingsUpdateSchema);

    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.profile ?? {})) {
      // Empty strings clear optional fields rather than storing "".
      update[key] = value === "" ? undefined : value;
    }
    for (const [key, value] of Object.entries(input.bookingSettings ?? {})) {
      update[`bookingSettings.${key}`] = value;
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

    return ok({
      ...restaurant,
      bookingSettings: bookingSettings(restaurant.bookingSettings),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
