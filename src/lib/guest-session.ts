import type { NextRequest, NextResponse } from "next/server";
import { signValue, signatureMatches } from "@/lib/booking-token";

/**
 * Guests sign in to their portal with a link emailed to them — no password.
 * Both the link and the session cookie are `<email>.<expiry>.<hmac>`, signed
 * under different purposes so a sign-in link cannot be used as a cookie.
 *
 * The link stays valid until it expires rather than being single-use, so an
 * email scanner that opens it first does not lock the guest out.
 */

export const GUEST_COOKIE = "df_guest";
export const SIGN_IN_LINK_MINUTES = 20;
export const SESSION_DAYS = 30;

type Purpose = "guest-link" | "guest-session";

function issue(purpose: Purpose, email: string, ttlMs: number, now = Date.now()) {
  const encoded = Buffer.from(email.toLowerCase()).toString("base64url");
  const expires = String(now + ttlMs);
  const payload = `${encoded}.${expires}`;
  return `${payload}.${signValue(purpose, payload)}`;
}

function verify(purpose: Purpose, token: string | undefined, now = Date.now()) {
  if (!token) return null;
  const [encoded, expires, signature] = token.split(".");
  if (!encoded || !expires || !signature) return null;
  if (!signatureMatches(signValue(purpose, `${encoded}.${expires}`), signature)) {
    return null;
  }
  if (!/^\d+$/.test(expires) || Number(expires) < now) return null;

  const email = Buffer.from(encoded, "base64url").toString();
  return email.includes("@") ? email : null;
}

export function guestSignInToken(email: string, now?: number) {
  return issue("guest-link", email, SIGN_IN_LINK_MINUTES * 60_000, now);
}

/** Returns the email a sign-in link was issued for, or null. */
export function verifyGuestSignInToken(token: string | undefined, now?: number) {
  return verify("guest-link", token, now);
}

export function guestSessionToken(email: string, now?: number) {
  return issue("guest-session", email, SESSION_DAYS * 86_400_000, now);
}

export function verifyGuestSessionToken(token: string | undefined, now?: number) {
  return verify("guest-session", token, now);
}

export function guestSignInUrl(token: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/api/guest/verify?token=${encodeURIComponent(token)}`;
}

/** The signed-in guest's email, or null. */
export function guestEmail(request: NextRequest) {
  return verifyGuestSessionToken(request.cookies.get(GUEST_COOKIE)?.value);
}

export function setGuestCookie(response: NextResponse, email: string) {
  response.cookies.set(GUEST_COOKIE, guestSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearGuestCookie(response: NextResponse) {
  response.cookies.set(GUEST_COOKIE, "", { path: "/", maxAge: 0 });
}
