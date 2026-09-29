import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { closePayment, settlePayment } from "@/lib/subscription-payments";

/**
 * SSLCommerz's server-to-server notification (IPN). It arrives even when
 * the owner closes the tab after paying. As with the browser return, the
 * payment is confirmed with the validation service before it counts.
 */
export async function POST(request: NextRequest) {
  try {
    const fields = new URLSearchParams(await request.text());
    const tranId = fields.get("tran_id");
    const valId = fields.get("val_id");
    const status = fields.get("status");
    if (!tranId) {
      return NextResponse.json({ received: false }, { status: 400 });
    }

    await connectDB();
    let outcome: string;
    if ((status === "VALID" || status === "VALIDATED") && valId) {
      outcome = await settlePayment(tranId, valId);
    } else {
      outcome = status === "CANCELLED" ? "cancelled" : "failed";
      await closePayment(tranId, outcome as "failed" | "cancelled", fields.get("error") || undefined);
    }
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.error("[billing] IPN handling failed", error);
    // A 500 makes SSLCommerz retry later, which is what we want.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
