import { NextResponse, type NextRequest } from "next/server";

/**
 * Scheduled jobs are called with CRON_SECRET as a bearer token (Vercel Cron
 * does this) or ?secret=. Returns a response to send back when refused.
 */
export function cronAuthError(request: NextRequest) {
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
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
