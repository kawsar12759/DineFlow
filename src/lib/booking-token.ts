import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed links guests use to manage their own booking or rate a visit,
 * without an account.
 * The token is `<reservationId>.<hmac>`; nothing secret is stored in it, and
 * a tampered id fails the signature check.
 */

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

/** Each link type signs under its own purpose, so one can't stand in for another. */
type Purpose = "booking" | "feedback";

export function signValue(purpose: string, value: string) {
  return createHmac("sha256", secret())
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

export function signatureMatches(expected: string, received: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

function reservationToken(purpose: Purpose, reservationId: string) {
  return `${reservationId}.${signValue(purpose, reservationId)}`;
}

function verifyReservationToken(purpose: Purpose, token: string) {
  const [reservationId, signature] = token.split(".");
  if (!reservationId || !signature) return null;
  if (!/^[a-f\d]{24}$/i.test(reservationId)) return null;
  return signatureMatches(signValue(purpose, reservationId), signature)
    ? reservationId
    : null;
}

export function bookingToken(reservationId: string) {
  return reservationToken("booking", reservationId);
}

/** Returns the reservation id, or null when the token is invalid. */
export function verifyBookingToken(token: string): string | null {
  return verifyReservationToken("booking", token);
}

export function feedbackToken(reservationId: string) {
  return reservationToken("feedback", reservationId);
}

/** Returns the reservation id, or null when the token is invalid. */
export function verifyFeedbackToken(token: string): string | null {
  return verifyReservationToken("feedback", token);
}

/** Absolute link a guest can open to rate their visit. */
export function feedbackUrl(reservationId: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/feedback/${feedbackToken(reservationId)}`;
}

/** Absolute link a guest can open to manage their booking. */
export function bookingManageUrl(reservationId: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/booking/${bookingToken(reservationId)}`;
}
