import { NextRequest } from "next/server";
import { cronAuthError } from "@/lib/cron";
import { connectDB } from "@/lib/db";
import { Reservation } from "@/models";
import { handleApiError, ok } from "@/lib/api-helpers";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { sendBookingReminder } from "@/lib/email/booking-emails";
import { logger } from "@/lib/logger";

/**
 * Sends "see you tomorrow" emails. Meant to run once a day from a scheduler
 * (Vercel Cron or any curl job) with the CRON_SECRET as a bearer token.
 */
export async function GET(request: NextRequest) {
  try {
    const refused = cronAuthError(request);
    if (refused) return refused;

    await connectDB();

    const tomorrow = addDaysToKey(todayKey(), 1);
    const reservations = await Reservation.find({
      date: dayKeyToDate(tomorrow),
      status: { $in: ["approved", "pending"] },
      reminderSentAt: { $exists: false },
    })
      .select("restaurantId branchId customerId date time guests")
      .limit(500)
      .lean();

    let sent = 0;
    let skipped = 0;
    for (const reservation of reservations) {
      const delivered = await sendBookingReminder(reservation);
      if (delivered) {
        await Reservation.updateOne(
          { _id: reservation._id },
          { $set: { reminderSentAt: new Date() } }
        );
        sent += 1;
      } else {
        skipped += 1;
      }
    }

    const summary = { date: tomorrow, considered: reservations.length, sent, skipped };
    logger.info("Cron: booking reminders finished", summary);
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
