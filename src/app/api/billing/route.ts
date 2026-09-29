import { Types } from "mongoose";
import { Branch, SubscriptionPayment, User } from "@/models";
import { handleApiError, ok, requireTenantSession } from "@/lib/api-helpers";
import { PLANS, SUBSCRIPTION_PLANS } from "@/lib/constants";
import { planPrice } from "@/lib/subscription";
import { gatewayConfig } from "@/lib/sslcommerz";

/** The owner's billing page: plan, status, usage against limits, payments. */
export async function GET() {
  try {
    const ctx = await requireTenantSession(["owner"]);
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    const [branches, staff, payments] = await Promise.all([
      Branch.countDocuments({ restaurantId, isActive: true }),
      User.countDocuments({
        restaurantId,
        role: { $in: ["manager", "staff"] },
        isActive: true,
      }),
      SubscriptionPayment.find({ restaurantId, status: { $ne: "pending" } })
        .sort({ createdAt: -1 })
        .limit(24)
        .select("plan period amount status invoiceNumber periodStart periodEnd paidAt createdAt failureReason")
        .lean(),
    ]);

    return ok({
      subscription: ctx.subscription,
      usage: { branches, staff },
      plans: SUBSCRIPTION_PLANS.map((id) => ({
        id,
        ...PLANS[id],
        monthly: planPrice(id, "monthly"),
        yearly: planPrice(id, "yearly"),
      })),
      payments,
      paymentsEnabled: !!gatewayConfig(),
      sandbox: gatewayConfig()?.sandbox ?? true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
