import { NextRequest } from "next/server";
import { Branch, Customer, Feedback, Reservation, Restaurant } from "@/models";
import { ApiError, handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { verifyFeedbackToken } from "@/lib/booking-token";
import { feedbackSubmitSchema } from "@/lib/validations";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notifyTeam } from "@/lib/activity";
import { dateToDayKey } from "@/lib/dates";
import { FEEDBACK_WINDOW_DAYS } from "@/lib/constants";

type RouteParams = { params: Promise<{ token: string }> };

/** Loads the visit a signed feedback link points at. */
async function loadVisit(token: string) {
  const reservationId = verifyFeedbackToken(token);
  if (!reservationId) throw new ApiError("This feedback link is not valid", 404);

  await connectDB();
  const reservation = await Reservation.findById(reservationId).lean();
  if (!reservation) throw new ApiError("Visit not found", 404);

  const [branch, restaurant, customer, feedback] = await Promise.all([
    Branch.findById(reservation.branchId).select("name").lean(),
    Restaurant.findById(reservation.restaurantId).select("name slug").lean(),
    Customer.findById(reservation.customerId).select("name").lean(),
    Feedback.findOne({ reservationId: reservation._id })
      .select("rating comment createdAt")
      .lean(),
  ]);
  if (!branch || !restaurant) throw new ApiError("Visit not found", 404);

  // The window counts from the visit day, so late bills don't shorten it.
  const closesAt =
    reservation.date.getTime() + (FEEDBACK_WINDOW_DAYS + 1) * 86_400_000;

  return {
    reservation,
    branch,
    restaurant,
    customer,
    feedback,
    open: reservation.status === "completed" && Date.now() < closesAt,
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const visit = await loadVisit(token);

    return ok({
      restaurant: { name: visit.restaurant.name, slug: visit.restaurant.slug },
      branch: visit.branch.name,
      date: dateToDayKey(visit.reservation.date),
      time: visit.reservation.time,
      guests: visit.reservation.guests,
      guestName: visit.customer?.name ?? "",
      feedback: visit.feedback
        ? { rating: visit.feedback.rating, comment: visit.feedback.comment }
        : null,
      open: visit.open,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    enforceRateLimit(request, "public-feedback", 10, 10 * 60_000);
    const { token } = await params;
    const input = await parseBody(request, feedbackSubmitSchema);
    const visit = await loadVisit(token);

    if (visit.feedback) {
      throw new ApiError("You have already rated this visit — thank you", 409);
    }
    if (!visit.open) {
      throw new ApiError(
        visit.reservation.status === "completed"
          ? "Feedback for this visit has closed"
          : "You can rate this visit once it is over",
        409
      );
    }

    let feedback;
    try {
      feedback = await Feedback.create({
        restaurantId: visit.reservation.restaurantId,
        branchId: visit.reservation.branchId,
        reservationId: visit.reservation._id,
        customerId: visit.reservation.customerId,
        rating: input.rating,
        comment: input.comment || undefined,
      });
    } catch (error) {
      // Two submits at once: the unique reservationId index keeps one.
      if ((error as { code?: number }).code === 11000) {
        throw new ApiError("You have already rated this visit — thank you", 409);
      }
      throw error;
    }

    const stars = "★".repeat(input.rating) + "☆".repeat(5 - input.rating);
    await notifyTeam({
      restaurantId: visit.reservation.restaurantId,
      branchId: visit.reservation.branchId,
      type: "feedback_received",
      title: `${stars} from ${visit.customer?.name ?? "a guest"} · ${visit.branch.name}`,
      body: input.comment
        ? input.comment.length > 120
          ? `${input.comment.slice(0, 117)}…`
          : input.comment
        : undefined,
      link: "/dashboard/feedback",
    });

    return ok(
      { rating: feedback.rating, comment: feedback.comment },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
