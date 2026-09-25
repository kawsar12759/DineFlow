import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Reservation } from "@/models";
import { handleApiError, ok } from "@/lib/api-helpers";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { sendBookingReminder } from "@/lib/email/booking-emails";

/**
 * Sends "see you tomorrow" emails. Meant to run once a day from a scheduler
 * (Vercel Cron or any curl job) with the CRON_SECRET as a bearer token.
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET is not configured" },
        { status: 503 }
      );
    }

    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    return ok({ date: tomorrow, considered: reservations.length, sent, skipped });
  } catch (error) {
    return handleApiError(error);
  }
}
