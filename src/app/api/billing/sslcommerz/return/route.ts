import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { closePayment, settlePayment } from "@/lib/subscription-payments";
import { appOrigin } from "@/lib/email/booking-emails";
import { logger } from "@/lib/logger";

/**
 * Where SSLCommerz sends the owner's browser after the payment page, as a
 * form POST. The browser's word is not trusted: a "success" is checked with
 * SSLCommerz's validation service before anything changes.
 */
async function handle(request: NextRequest) {
  const result = request.nextUrl.searchParams.get("result");
  let fields: URLSearchParams;
  if (request.method === "POST") {
    const body = await request.text();
    fields = new URLSearchParams(body);
  } else {
    fields = request.nextUrl.searchParams;
  }
  const tranId = fields.get("tran_id") ?? "";
  const valId = fields.get("val_id") ?? "";

  let outcome = "failed";
  try {
    await connectDB();
    if (result === "success" && tranId && valId) {
      outcome = await settlePayment(tranId, valId);
    } else if (tranId) {
      outcome = result === "cancel" ? "cancelled" : "failed";
      await closePayment(
        tranId,
        outcome as "failed" | "cancelled",
        fields.get("error") || undefined
      );
    }
  } catch (error) {
    logger.error("SSLCommerz return handling failed", { error });
    outcome = "unknown";
  }

  // 303 turns the gateway's POST into a normal page load.
  return NextResponse.redirect(
    new URL(`/dashboard/billing?payment=${outcome}`, appOrigin(request.nextUrl.origin)),
    303
  );
}

export const POST = handle;
export const GET = handle;
