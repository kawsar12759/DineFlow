import { NextRequest } from "next/server";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  requireTenantSession,
} from "@/lib/api-helpers";
import { billingCheckoutSchema } from "@/lib/validations";
import { startCheckout } from "@/lib/subscription-payments";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Starts paying for a plan. Deliberately not behind the write guard: an
 * expired restaurant must still be able to pay. Suspended ones cannot.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, "billing-checkout", 10, 10 * 60_000);
    const ctx = await requireTenantSession(["owner"]);
    const input = await parseBody(request, billingCheckoutSchema);

    if (ctx.subscription.status === "suspended") {
      throw new ApiError(
        "This restaurant is suspended. Please contact DineFlow support.",
        402
      );
    }

    const url = await startCheckout({
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      plan: input.plan,
      period: input.period,
      origin: request.nextUrl.origin,
    });
    return ok({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
