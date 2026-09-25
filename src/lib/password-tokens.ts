import { createHash, randomBytes } from "crypto";
import type { Types } from "mongoose";
import { User } from "@/models";

/**
 * One-time links for staff invites and password resets. The raw token only
 * ever exists in the email; the database stores its SHA-256, so a leaked
 * database dump cannot be used to take over accounts.
 */

export const INVITE_TTL_HOURS = 72;
export const RESET_TTL_HOURS = 2;

export type TokenPurpose = "invite" | "reset";

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a token for a user and returns the raw value for the email. */
export async function issuePasswordToken(
  userId: Types.ObjectId | string,
  purpose: TokenPurpose
) {
  const token = randomBytes(32).toString("base64url");
  const hours = purpose === "invite" ? INVITE_TTL_HOURS : RESET_TTL_HOURS;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        passwordTokenHash: hash(token),
        passwordTokenExpires: new Date(Date.now() + hours * 60 * 60_000),
        passwordTokenPurpose: purpose,
      },
    }
  );

  return { token, expiresInHours: hours };
}

/** Looks up an unexpired token. Returns null when it is invalid or used. */
export async function findUserByToken(token: string) {
  if (!token) return null;

  const user = await User.findOne({ passwordTokenHash: hash(token) })
    .select("+passwordTokenHash +passwordTokenExpires +passwordTokenPurpose name email role isActive")
    .lean();

  if (!user || !user.isActive) return null;
  if (!user.passwordTokenExpires || user.passwordTokenExpires < new Date()) {
    return null;
  }
  return user;
}

/** Clears the token so the link cannot be reused. */
export async function consumePasswordToken(userId: Types.ObjectId | string) {
  await User.updateOne(
    { _id: userId },
    {
      $unset: {
        passwordTokenHash: "",
        passwordTokenExpires: "",
        passwordTokenPurpose: "",
      },
    }
  );
}

export function passwordLinkUrl(token: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(token)}`;
}
