import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { ApiError, handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  consumePasswordToken,
  findUserByToken,
} from "@/lib/password-tokens";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Tells the set-password page whether a link is still good. */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    await connectDB();
    const user = await findUserByToken(token);

    if (!user) return ok({ valid: false });

    return ok({
      valid: true,
      purpose: user.passwordTokenPurpose ?? "reset",
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Sets the password and burns the link. */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, "set-password", 10, 15 * 60_000);
    const input = await parseBody(request, schema);

    await connectDB();
    const user = await findUserByToken(input.token);
    if (!user) {
      throw new ApiError("This link has expired or has already been used", 400);
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { password: await bcrypt.hash(input.password, 12) } }
    );
    await consumePasswordToken(user._id);

    return ok({ email: user.email });
  } catch (error) {
    return handleApiError(error);
  }
}
