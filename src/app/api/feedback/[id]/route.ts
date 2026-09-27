import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Customer, Feedback, Restaurant } from "@/models";
import { feedbackUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  branchFilter,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { recordActivity } from "@/lib/activity";
import { isRealEmail } from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { feedbackReplyEmail } from "@/lib/email/templates";

type RouteParams = { params: Promise<{ id: string }> };

/** Reply to a review (emailed to the guest) or hide it from the public page. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const input = await parseBody(request, feedbackUpdateSchema);

    const feedback = await Feedback.findOne({
      _id: parseObjectId(id, "feedback id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    });
    if (!feedback) throw new ApiError("Feedback not found", 404);

    const firstReply = input.reply !== undefined && !feedback.reply?.body;
    if (input.reply !== undefined) {
      feedback.reply = {
        body: input.reply,
        repliedAt: new Date(),
        repliedBy: new Types.ObjectId(ctx.userId),
      };
    }
    if (input.isPublic !== undefined) feedback.isPublic = input.isPublic;
    await feedback.save();

    if (input.reply !== undefined) {
      // Only the first reply is emailed; later edits fix typos quietly.
      if (firstReply) {
        const [customer, restaurant] = await Promise.all([
          Customer.findById(feedback.customerId).select("name email").lean(),
          Restaurant.findById(ctx.restaurantId).select("name email").lean(),
        ]);
        if (customer && restaurant && isRealEmail(customer.email)) {
          await sendEmail({
            to: customer.email,
            replyTo: restaurant.email,
            ...feedbackReplyEmail({
              guestName: customer.name,
              restaurantName: restaurant.name,
              reply: input.reply,
            }),
          });
        }
      }
      await recordActivity({
        restaurantId: ctx.restaurantId,
        branchId: feedback.branchId,
        actorId: ctx.userId,
        action: "feedback.replied",
        targetType: "feedback",
        targetId: feedback._id,
        summary: `Replied to a ${feedback.rating}★ review`,
      });
    }
    if (input.isPublic !== undefined) {
      await recordActivity({
        restaurantId: ctx.restaurantId,
        branchId: feedback.branchId,
        actorId: ctx.userId,
        action: input.isPublic ? "feedback.shown" : "feedback.hidden",
        targetType: "feedback",
        targetId: feedback._id,
        summary: `${input.isPublic ? "Showed" : "Hid"} a ${feedback.rating}★ review ${input.isPublic ? "on" : "from"} the public page`,
      });
    }

    return ok(feedback);
  } catch (error) {
    return handleApiError(error);
  }
}
