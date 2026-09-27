import { NextResponse } from "next/server";
import { clearGuestCookie } from "@/lib/guest-session";

export async function POST() {
  const response = NextResponse.json({ success: true, data: { signedOut: true } });
  clearGuestCookie(response);
  return response;
}
