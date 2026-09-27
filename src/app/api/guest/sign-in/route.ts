import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models";
import { handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { guestSignInSchema } from "@/lib/validations";
import { enforceRateLimit, rateLimit } from "@/lib/rate-limit";
import {
  guestSignInToken,
  guestSignInUrl,
  SIGN_IN_LINK_MINUTES,
} from "@/lib/guest-session";
import { appOrigin, isRealEmail } from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { guestSignInEmail } from "@/lib/email/templates";

/**
 * Emails a sign-in link to a guest who has booked somewhere. The answer is
 * the same whether or not we know the email, so this cannot be used to find
 * out who has eaten where.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, "guest-sign-in", 5, 10 * 60_000);
    const { email } = await parseBody(request, guestSignInSchema);
    const normalised = email.toLowerCase();

    // Also cap per address, so one inbox cannot be flooded from many IPs.
    const perEmail = rateLimit(`guest-sign-in-email:${normalised}`, 3, 10 * 60_000);

    await connectDB();
    const known =
      isRealEmail(normalised) &&
      (await Customer.exists({ email: normalised }));

    if (known && perEmail.allowed) {
      const url = guestSignInUrl(
        guestSignInToken(normalised),
        appOrigin(request.nextUrl.origin)
      );
      await sendEmail({
        to: normalised,
        ...guestSignInEmail({ url, expiresInMinutes: SIGN_IN_LINK_MINUTES }),
      });
    }

    return ok({
      message:
        "If you have booked with a DineFlow restaurant using this email, a sign-in link is on its way.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
