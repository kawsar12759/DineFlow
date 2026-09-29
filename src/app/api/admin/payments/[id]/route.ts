import { NextRequest } from "next/server";
import { z } from "zod";
import { SubscriptionPayment } from "@/models";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireSuperAdmin,
} from "@/lib/api-helpers";
import { applyPayment } from "@/lib/subscription-payments";
import { recordActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/utils";

type RouteParams = { params: Promise<{ id: string }> };

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().min(3, "Say why").max(300),
});

/**
 * Decides a payment SSLCommerz held for review (flagged as risky).
 * Approving applies it exactly like a normal payment; rejecting leaves the
 * restaurant's access as it was.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await params;
    const input = await parseBody(request, decisionSchema);

    const payment = await SubscriptionPayment.findById(parseObjectId(id, "payment id"));
    if (!payment) throw new ApiError("Payment not found", 404);
    if (payment.status !== "review") {
      throw new ApiError(`This payment is ${payment.status}, not waiting for review`, 409);
    }

    if (input.decision === "approve") {
      await applyPayment(payment._id);
    } else {
      await SubscriptionPayment.updateOne(
        { _id: payment._id, status: "review" },
        { $set: { status: "failed", failureReason: `Rejected on review: ${input.note}` } }
      );
    }

    await recordActivity({
      restaurantId: payment.restaurantId,
      actorId: admin.userId,
      actorName: "DineFlow support",
      action: "billing.review",
      targetType: "subscription",
      targetId: payment._id,
      summary: `${input.decision === "approve" ? "Approved" : "Rejected"} a ${formatCurrency(payment.amount)} payment held for review (${input.note})`,
    });

    return ok(await SubscriptionPayment.findById(payment._id).lean());
  } catch (error) {
    return handleApiError(error);
  }
}
