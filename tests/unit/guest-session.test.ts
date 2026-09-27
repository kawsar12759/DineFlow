import { beforeAll, describe, expect, it } from "vitest";
import {
  guestSessionToken,
  guestSignInToken,
  SESSION_DAYS,
  SIGN_IN_LINK_MINUTES,
  verifyGuestSessionToken,
  verifyGuestSignInToken,
} from "@/lib/guest-session";
import {
  bookingToken,
  feedbackToken,
  verifyBookingToken,
  verifyFeedbackToken,
} from "@/lib/booking-token";

beforeAll(() => {
  process.env.AUTH_SECRET ??= "test-secret";
});

const now = Date.UTC(2026, 8, 26, 10);

describe("guest sign-in links", () => {
  it("round-trips the email, lower-cased", () => {
    const token = guestSignInToken("Guest@Example.com", now);
    expect(verifyGuestSignInToken(token, now + 60_000)).toBe("guest@example.com");
  });

  it("expire", () => {
    const token = guestSignInToken("guest@example.com", now);
    const later = now + SIGN_IN_LINK_MINUTES * 60_000 + 1;
    expect(verifyGuestSignInToken(token, later)).toBeNull();
  });

  it("reject a changed email or expiry", () => {
    const token = guestSignInToken("guest@example.com", now);
    const [, expires, signature] = token.split(".");
    const otherEmail = Buffer.from("someone@else.com").toString("base64url");
    expect(verifyGuestSignInToken(`${otherEmail}.${expires}.${signature}`, now)).toBeNull();

    const [email] = token.split(".");
    expect(
      verifyGuestSignInToken(`${email}.${Number(expires) + 86_400_000}.${signature}`, now)
    ).toBeNull();
  });

  it("cannot be used as a session cookie, or the other way round", () => {
    const link = guestSignInToken("guest@example.com", now);
    const session = guestSessionToken("guest@example.com", now);
    expect(verifyGuestSessionToken(link, now)).toBeNull();
    expect(verifyGuestSignInToken(session, now)).toBeNull();
  });

  it("sessions last the configured number of days", () => {
    const session = guestSessionToken("guest@example.com", now);
    expect(verifyGuestSessionToken(session, now + (SESSION_DAYS - 1) * 86_400_000)).toBe(
      "guest@example.com"
    );
    expect(verifyGuestSessionToken(session, now + (SESSION_DAYS + 1) * 86_400_000)).toBeNull();
  });
});

describe("reservation links", () => {
  const id = "650000000000000000000001";

  it("booking and feedback links are not interchangeable", () => {
    expect(verifyBookingToken(bookingToken(id))).toBe(id);
    expect(verifyFeedbackToken(feedbackToken(id))).toBe(id);
    expect(verifyBookingToken(feedbackToken(id))).toBeNull();
    expect(verifyFeedbackToken(bookingToken(id))).toBeNull();
  });
});
