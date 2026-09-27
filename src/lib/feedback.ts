import { Types } from "mongoose";
import { Branch, Customer, Feedback, Reservation, Restaurant } from "@/models";
import {
  DEFAULT_FEEDBACK_SETTINGS,
  type FeedbackSettings,
} from "@/lib/constants";
import { feedbackUrl } from "@/lib/booking-token";
import { dateToDayKey } from "@/lib/dates";
import { appOrigin, isRealEmail } from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { feedbackRequestEmail } from "@/lib/email/templates";

export function feedbackSettings(
  settings?: Partial<FeedbackSettings> | null
): FeedbackSettings {
  return { ...DEFAULT_FEEDBACK_SETTINGS, ...(settings ?? {}) };
}

/**
 * Emails the guest a link to rate a finished visit — once per booking.
 * Never throws: a failed email must not fail closing the bill.
 */
export async function requestFeedback(
  reservationId: Types.ObjectId,
  options: { origin?: string; pointsEarned?: number } = {}
) {
  try {
    // Claim the booking first so two paths finishing it cannot both email.
    const reservation = await Reservation.findOneAndUpdate(
      {
        _id: reservationId,
        status: "completed",
        feedbackRequestedAt: { $exists: false },
      },
      { $set: { feedbackRequestedAt: new Date() } },
      { new: true }
    ).lean();
    if (!reservation) return false;

    const [restaurant, customer, branch] = await Promise.all([
      Restaurant.findById(reservation.restaurantId)
        .select("name feedbackSettings loyaltySettings")
        .lean(),
      Customer.findById(reservation.customerId)
        .select("name email loyaltyPoints")
        .lean(),
      Branch.findById(reservation.branchId).select("name").lean(),
    ]);
    if (!restaurant || !customer || !branch) return false;
    if (!feedbackSettings(restaurant.feedbackSettings).requestAfterVisit) {
      return false;
    }
    if (!isRealEmail(customer.email)) return false;

    const template = feedbackRequestEmail({
      guestName: customer.name,
      restaurantName: restaurant.name,
      branchName: branch.name,
      date: dateToDayKey(reservation.date),
      url: feedbackUrl(reservation._id.toString(), appOrigin(options.origin)),
      pointsEarned: options.pointsEarned,
      pointsBalance: options.pointsEarned ? customer.loyaltyPoints : undefined,
    });
    await sendEmail({ to: customer.email, ...template });
    return true;
  } catch (error) {
    console.error("[feedback] could not request feedback", error);
    return false;
  }
}

export interface RatingSummary {
  count: number;
  average: number;
  /** Count of 1★ … 5★, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
}

/** Average and star distribution for the reviews matching `match`. */
export async function ratingSummary(
  match: Record<string, unknown>
): Promise<RatingSummary> {
  const rows: { _id: number; count: number }[] = await Feedback.aggregate([
    { $match: match },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0];
  let count = 0;
  let sum = 0;
  for (const row of rows) {
    distribution[row._id - 1] = row.count;
    count += row.count;
    sum += row._id * row.count;
  }

  return {
    count,
    average: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    distribution,
  };
}

/** "Farhana R." — how guests are named on the public page. */
export function publicGuestName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
