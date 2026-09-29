import { Types } from "mongoose";
import { Branch, User } from "@/models";
import { ApiError } from "@/lib/api-error";
import { PLANS } from "@/lib/constants";
import { formatLimit } from "@/lib/subscription";
import type { SessionContext } from "@/lib/api-helpers";

/**
 * Plan limits, checked on the server whenever something that counts towards
 * a limit is created or switched back on. 402 tells the dashboard to point
 * the owner at Billing.
 */

function upgradeMessage(ctx: SessionContext, what: string) {
  const plan = PLANS[ctx.subscription.plan];
  return `Your ${plan.name} plan includes ${what}. Upgrade in Billing to add more.`;
}

export async function assertCanAddBranch(ctx: SessionContext) {
  const limit = PLANS[ctx.subscription.plan].maxBranches;
  if (limit === null) return;
  const active = await Branch.countDocuments({
    restaurantId: new Types.ObjectId(ctx.restaurantId),
    isActive: true,
  });
  if (active >= limit) {
    throw new ApiError(upgradeMessage(ctx, formatLimit(limit, "branch", "branches")), 402);
  }
}

export async function assertCanAddStaff(ctx: SessionContext) {
  const limit = PLANS[ctx.subscription.plan].maxStaff;
  if (limit === null) return;
  const active = await User.countDocuments({
    restaurantId: new Types.ObjectId(ctx.restaurantId),
    role: { $in: ["manager", "staff"] },
    isActive: true,
  });
  if (active >= limit) {
    throw new ApiError(
      upgradeMessage(ctx, formatLimit(limit, "staff account")),
      402
    );
  }
}

export function assertPlanHasLoyalty(ctx: SessionContext) {
  if (!PLANS[ctx.subscription.plan].loyalty) {
    throw new ApiError(
      `Loyalty points are part of the Growth plan. Upgrade in Billing to turn them on.`,
      402
    );
  }
}
