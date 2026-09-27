import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import {
  Branch,
  Customer,
  Feedback,
  LoyaltyTransaction,
  Reservation,
  Restaurant,
} from "@/models";
import { ApiError, handleApiError, ok } from "@/lib/api-helpers";
import { guestEmail } from "@/lib/guest-session";
import { bookingToken, feedbackToken } from "@/lib/booking-token";
import { dateToDayKey, todayKey, addDaysToKey } from "@/lib/dates";
import { loyaltySettings } from "@/lib/loyalty";
import {
  ACTIVE_RESERVATION_STATUSES,
  FEEDBACK_WINDOW_DAYS,
} from "@/lib/constants";

/**
 * Everything a signed-in guest has with DineFlow restaurants: one customer
 * profile per restaurant (matched by email), their bookings, points and
 * reviews. Guests only ever see records carrying their own email.
 */
export async function GET(request: NextRequest) {
  try {
    const email = guestEmail(request);
    if (!email) throw new ApiError("Please sign in", 401);

    await connectDB();
    const customers = await Customer.find({ email })
      .select("restaurantId name loyaltyPoints visitCount totalSpend updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    const customerIds = customers.map((customer) => customer._id);

    const [restaurants, reservations, transactions] = await Promise.all([
      Restaurant.find({ _id: { $in: customers.map((c) => c.restaurantId) } })
        .select("name slug cuisine isPublished loyaltySettings")
        .lean(),
      Reservation.find({ customerId: { $in: customerIds } })
        .sort({ date: -1, time: -1 })
        .limit(100)
        .select("restaurantId branchId date time guests status")
        .lean(),
      LoyaltyTransaction.find({ customerId: { $in: customerIds } })
        .sort({ createdAt: -1 })
        .limit(60)
        .select("customerId type points note createdAt")
        .lean(),
    ]);

    const [branches, feedback] = await Promise.all([
      Branch.find({ _id: { $in: reservations.map((r) => r.branchId) } })
        .select("name address")
        .lean(),
      Feedback.find({ reservationId: { $in: reservations.map((r) => r._id) } })
        .select("reservationId rating reply")
        .lean(),
    ]);

    const restaurantById = new Map(restaurants.map((r) => [r._id.toString(), r]));
    const branchById = new Map(branches.map((b) => [b._id.toString(), b]));
    const feedbackByVisit = new Map(
      feedback.map((f) => [f.reservationId.toString(), f])
    );

    const today = todayKey();
    const feedbackCutoff = addDaysToKey(today, -FEEDBACK_WINDOW_DAYS);

    const visits = reservations.flatMap((reservation) => {
      const restaurant = restaurantById.get(reservation.restaurantId.toString());
      const branch = branchById.get(reservation.branchId.toString());
      if (!restaurant || !branch) return [];

      const id = reservation._id.toString();
      const date = dateToDayKey(reservation.date);
      const review = feedbackByVisit.get(id);
      const upcoming =
        date >= today &&
        (ACTIVE_RESERVATION_STATUSES as string[]).includes(reservation.status);

      return [
        {
          _id: id,
          upcoming,
          date,
          time: reservation.time,
          guests: reservation.guests,
          status: reservation.status,
          restaurant: { name: restaurant.name, slug: restaurant.slug },
          branch: {
            name: branch.name,
            address: `${branch.address.street}, ${branch.address.city}`,
          },
          manageUrl: upcoming ? `/booking/${bookingToken(id)}` : undefined,
          feedback: review
            ? { rating: review.rating, replied: !!review.reply?.body }
            : null,
          feedbackUrl:
            !review && reservation.status === "completed" && date >= feedbackCutoff
              ? `/feedback/${feedbackToken(id)}`
              : undefined,
        },
      ];
    });

    const memberships = customers.flatMap((customer) => {
      const restaurant = restaurantById.get(customer.restaurantId.toString());
      if (!restaurant) return [];
      const loyalty = loyaltySettings(restaurant.loyaltySettings);
      return [
        {
          restaurant: {
            name: restaurant.name,
            slug: restaurant.isPublished ? restaurant.slug : undefined,
            cuisine: restaurant.cuisine,
          },
          visitCount: customer.visitCount,
          totalSpend: customer.totalSpend,
          loyalty: loyalty.enabled
            ? {
                points: customer.loyaltyPoints ?? 0,
                pointValueTaka: loyalty.pointValueTaka,
                pointsPer100Taka: loyalty.pointsPer100Taka,
                minRedeemPoints: loyalty.minRedeemPoints,
                history: transactions
                  .filter((t) =>
                    (t.customerId as Types.ObjectId).equals(customer._id)
                  )
                  .slice(0, 5)
                  .map((t) => ({
                    type: t.type,
                    points: t.points,
                    note: t.note,
                    createdAt: t.createdAt,
                  })),
              }
            : null,
        },
      ];
    });

    return ok({
      email,
      name: customers[0]?.name ?? "",
      memberships,
      upcoming: visits.filter((visit) => visit.upcoming).reverse(),
      past: visits.filter((visit) => !visit.upcoming).slice(0, 30),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
