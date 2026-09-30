import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Restaurant, SubscriptionPayment, User } from "@/models";
import { handleApiError, ok } from "@/lib/api-helpers";
import { cronAuthError } from "@/lib/cron";
import { reminderStage, subscriptionState } from "@/lib/subscription";
import { PLANS } from "@/lib/constants";
import { sendEmail } from "@/lib/email/send";
import { subscriptionReminderEmail } from "@/lib/email/templates";
import { appOrigin } from "@/lib/email/booking-emails";
import { logger } from "@/lib/logger";

const DAY_MS = 86_400_000;

/**
 * Daily: renewal reminders (7 days, 3 days, ended, paused), each sent once
 * per subscription period, and tidying checkouts abandoned for over a day.
 */
export async function GET(request: NextRequest) {
  try {
    const refused = cronAuthError(request);
    if (refused) return refused;

    await connectDB();
    const now = new Date();

    const abandoned = await SubscriptionPayment.updateMany(
      { status: "pending", createdAt: { $lt: new Date(now.getTime() - DAY_MS) } },
      { $set: { status: "cancelled", failureReason: "Checkout was not completed" } }
    );

    // Anything ending within a week, or ended within the last fortnight.
    const restaurants = await Restaurant.find({
      suspendedAt: { $exists: false },
      $or: [
        {
          subscriptionEndsAt: {
            $lte: new Date(now.getTime() + 8 * DAY_MS),
            $gte: new Date(now.getTime() - 15 * DAY_MS),
          },
        },
        { subscriptionEndsAt: { $exists: false } },
      ],
    })
      .select("name ownerId subscriptionPlan subscriptionEndsAt onTrial suspendedAt createdAt subscriptionNotices")
      .limit(1000)
      .lean();

    let sent = 0;
    for (const restaurant of restaurants) {
      const state = subscriptionState(restaurant, now);
      const stage = reminderStage(state, now);
      if (!stage) continue;

      const key = `${state.endsAt.toISOString()}:${stage}`;
      if (restaurant.subscriptionNotices?.includes(key)) continue;

      const owner = await User.findById(restaurant.ownerId).select("name email").lean();
      if (!owner) continue;

      // Claim the notice first so two overlapping runs cannot both send it.
      const claimed = await Restaurant.updateOne(
        { _id: restaurant._id, subscriptionNotices: { $ne: key } },
        { $push: { subscriptionNotices: { $each: [key], $slice: -20 } } }
      );
      if (claimed.modifiedCount === 0) continue;

      await sendEmail({
        to: owner.email,
        ...subscriptionReminderEmail({
          name: owner.name,
          restaurantName: restaurant.name,
          planName: PLANS[state.plan].name,
          stage,
          onTrial: state.onTrial,
          endsAt: state.endsAt,
          cutoffAt: state.cutoffAt,
          url: `${appOrigin(request.nextUrl.origin)}/dashboard/billing`,
        }),
      });
      sent += 1;
    }

    const summary = {
      considered: restaurants.length,
      remindersSent: sent,
      abandonedCheckouts: abandoned.modifiedCount,
    };
    logger.info("Cron: subscription reminders finished", summary);
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
