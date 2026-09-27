import { NextRequest, NextResponse } from "next/server";
import { setGuestCookie, verifyGuestSignInToken } from "@/lib/guest-session";
import { appOrigin } from "@/lib/email/booking-emails";

/** The emailed sign-in link lands here, sets the guest cookie and moves on. */
export async function GET(request: NextRequest) {
  const origin = appOrigin(request.nextUrl.origin);
  const email = verifyGuestSignInToken(
    request.nextUrl.searchParams.get("token") ?? undefined
  );

  if (!email) {
    return NextResponse.redirect(new URL("/account?link=expired", origin));
  }

  const response = NextResponse.redirect(new URL("/account", origin));
  setGuestCookie(response, email);
  return response;
}
