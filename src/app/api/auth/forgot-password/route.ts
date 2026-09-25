import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  issuePasswordToken,
  passwordLinkUrl,
  RESET_TTL_HOURS,
} from "@/lib/password-tokens";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { appOrigin } from "@/lib/email/booking-emails";

const schema = z.object({ email: z.string().email("Invalid email") });

/**
 * Starts a password reset. Always answers the same way, so the response
 * cannot be used to discover which emails have accounts.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, "forgot-password", 5, 15 * 60_000);
    const { email } = await parseBody(request, schema);

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() })
      .select("name email isActive")
      .lean();

    if (user?.isActive) {
      const { token, expiresInHours } = await issuePasswordToken(
        user._id,
        "reset"
      );
      const template = passwordResetEmail({
        name: user.name,
        url: passwordLinkUrl(token, appOrigin(request.nextUrl.origin)),
        expiresInHours,
      });
      await sendEmail({ to: user.email, ...template });
    }

    return ok({
      message: `If that email has an account, a reset link is on its way. It expires in ${RESET_TTL_HOURS} hours.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
