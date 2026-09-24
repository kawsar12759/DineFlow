import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed links guests use to manage their own booking, without an account.
 * The token is `<reservationId>.<hmac>`; nothing secret is stored in it, and
 * a tampered id fails the signature check.
 */

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(reservationId: string) {
  return createHmac("sha256", secret())
    .update(`booking:${reservationId}`)
    .digest("base64url");
}

export function bookingToken(reservationId: string) {
  return `${reservationId}.${sign(reservationId)}`;
}

/** Returns the reservation id, or null when the token is invalid. */
export function verifyBookingToken(token: string): string | null {
  const [reservationId, signature] = token.split(".");
  if (!reservationId || !signature) return null;
  if (!/^[a-f\d]{24}$/i.test(reservationId)) return null;

  const expected = Buffer.from(sign(reservationId));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return null;

  return timingSafeEqual(expected, received) ? reservationId : null;
}

/** Absolute link a guest can open to manage their booking. */
export function bookingManageUrl(reservationId: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/booking/${bookingToken(reservationId)}`;
}
