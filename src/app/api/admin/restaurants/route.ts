import { NextRequest } from "next/server";
import { Branch, Restaurant, SubscriptionPayment, User } from "@/models";
import { handleApiError, ok, requireSuperAdmin } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { subscriptionState } from "@/lib/subscription";
import { PLAN_MONTHLY_PRICE, YEARLY_MONTHS_CHARGED } from "@/lib/constants";

const DAY_MS = 86_400_000;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every restaurant on DineFlow with its subscription, for DineFlow's own
 * operators, plus the headline numbers for the admin overview.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    await connectDB();
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const statusFilter = request.nextUrl.searchParams.get("status");

    const filter = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { slug: { $regex: escapeRegex(search), $options: "i" } },
          ],
        }
      : {};

    const restaurants = await Restaurant.find(filter)
      .select(
        "name slug ownerId subscriptionPlan subscriptionEndsAt onTrial suspendedAt suspendedReason createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const ids = restaurants.map((restaurant) => restaurant._id);

    const [owners, branchCounts, lastPayments, revenue30d, review] = await Promise.all([
      User.find({ _id: { $in: restaurants.map((r) => r.ownerId) } })
        .select("name email")
        .lean(),
      Branch.aggregate([
        { $match: { restaurantId: { $in: ids }, isActive: true } },
        { $group: { _id: "$restaurantId", count: { $sum: 1 } } },
      ]),
      SubscriptionPayment.aggregate([
        { $match: { restaurantId: { $in: ids }, status: "paid" } },
        { $sort: { paidAt: -1 } },
        {
          $group: {
            _id: "$restaurantId",
            paidAt: { $first: "$paidAt" },
            amount: { $first: "$amount" },
            period: { $first: "$period" },
          },
        },
      ]),
      SubscriptionPayment.aggregate([
        {
          $match: {
            status: "paid",
            paidAt: { $gte: new Date(Date.now() - 30 * DAY_MS) },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      SubscriptionPayment.countDocuments({ status: "review" }),
    ]);

    const ownerById = new Map(owners.map((o) => [o._id.toString(), o]));
    const branchesById = new Map(
      branchCounts.map((b) => [String(b._id), b.count as number])
    );
    const paymentById = new Map(lastPayments.map((p) => [String(p._id), p]));

    const rows = restaurants.map((restaurant) => {
      const owner = ownerById.get(restaurant.ownerId.toString());
      const lastPayment = paymentById.get(restaurant._id.toString());
      return {
        _id: restaurant._id.toString(),
        name: restaurant.name,
        slug: restaurant.slug,
        owner: owner ? { name: owner.name, email: owner.email } : null,
        createdAt: restaurant.createdAt,
        branches: branchesById.get(restaurant._id.toString()) ?? 0,
        subscription: subscriptionState(restaurant),
        lastPayment: lastPayment
          ? {
              paidAt: lastPayment.paidAt as Date,
              amount: lastPayment.amount as number,
              period: lastPayment.period as string,
            }
          : null,
      };
    });

    // Monthly recurring revenue: paying restaurants at their plan's price,
    // yearly payers counted at a twelfth of what their year costs.
    const mrr = rows.reduce((sum, row) => {
      const s = row.subscription;
      if (s.onTrial || !["active", "grace"].includes(s.status)) return sum;
      const monthly = PLAN_MONTHLY_PRICE[s.plan];
      if (!monthly) return sum;
      return (
        sum +
        (row.lastPayment?.period === "yearly"
          ? (monthly * YEARLY_MONTHS_CHARGED) / 12
          : monthly)
      );
    }, 0);

    const counts = { trial: 0, active: 0, grace: 0, expired: 0, suspended: 0 };
    for (const row of rows) counts[row.subscription.status] += 1;

    return ok({
      summary: {
        restaurants: rows.length,
        ...counts,
        mrr: Math.round(mrr),
        revenue30d: revenue30d[0]?.total ?? 0,
        paymentsInReview: review,
      },
      restaurants:
        statusFilter && statusFilter !== "all"
          ? rows.filter((row) => row.subscription.status === statusFilter)
          : rows,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
