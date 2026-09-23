import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { loadActiveUser } from "@/lib/api-helpers";

/** Auth.js session cookie names (plain and __Secure- variants, plus JWT chunks). */
function isSessionCookie(name: string) {
  return /^(__Secure-)?(authjs|next-auth)\.session-token(\.\d+)?$/.test(name);
}

/**
 * Ends a session the server no longer accepts (a deactivated or deleted
 * account) and sends the user to sign-in with an explanation.
 *
 * Done server-side so the cookie is removed in this response: a client-side
 * signOut races the session provider, whose in-flight /api/auth/session
 * response can re-issue the cookie. Active users are sent back to the
 * dashboard untouched, so this URL cannot be used to log people out.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const activeUser = session?.user ? await loadActiveUser(session.user.id) : null;

  if (activeUser) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.redirect(
    new URL("/login?reason=inactive", request.url)
  );
  for (const cookie of request.cookies.getAll()) {
    if (isSessionCookie(cookie.name)) response.cookies.delete(cookie.name);
  }
  return response;
}
