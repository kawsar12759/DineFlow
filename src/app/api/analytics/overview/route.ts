import { Types } from "mongoose";
import { Branch, Customer, Reservation } from "@/models";
import {
  branchFilter,
  handleApiError,
  ok,
  requireTenantSession,
} from "@/lib/api-helpers";
import { percentChange } from "@/lib/utils";
import { revenueTotal } from "@/lib/revenue";
import {
  addDaysToKey,
  dayKeyToDate,
  monthStartKey,
  todayKey,
} from "@/lib/dates";

export async function GET() {
  try {
    const ctx = await requireTenantSession();
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    // Staff assigned to a branch see that branch's numbers only.
    const scope = branchFilter(ctx);
    const branchScope = branchFilter(ctx, "_id");

    const today = todayKey();
    const todayStart = dayKeyToDate(today);
    const tomorrowStart = dayKeyToDate(addDaysToKey(today, 1));
    const yesterdayStart = dayKeyToDate(addDaysToKey(today, -1));
    const monthStart = dayKeyToDate(monthStartKey(today));
    const prevMonthStart = dayKeyToDate(monthStartKey(today, -1));
    const thirtyDaysAgo = dayKeyToDate(addDaysToKey(today, -30));

    // Compare month-to-date against the same number of days last month.
    const daysElapsed = Number(today.slice(8, 10));
    const prevComparableEnd = new Date(
      Math.min(
        dayKeyToDate(addDaysToKey(monthStartKey(today, -1), daysElapsed)).getTime(),
        monthStart.getTime()
      )
    );

    const branchScopeId = ctx.branchScope
      ? new Types.ObjectId(ctx.branchScope)
      : undefined;

    const [
      todaysReservations,
      yesterdaysReservations,
      revenue,
      prevRevenue,
      occupancyAgg,
      totalCapacityAgg,
      popularItems,
      activeCustomers,
      totalCustomers,
      pendingCount,
    ] = await Promise.all([
      Reservation.countDocuments({
        restaurantId,
        ...scope,
        date: { $gte: todayStart, $lt: tomorrowStart },
      }),
      Reservation.countDocuments({
        restaurantId,
        ...scope,
        date: { $gte: yesterdayStart, $lt: todayStart },
      }),
      revenueTotal({
        restaurantId,
        from: monthStart,
        to: tomorrowStart,
        branchId: branchScopeId,
      }),
      revenueTotal({
        restaurantId,
        from: prevMonthStart,
        to: prevComparableEnd,
        branchId: branchScopeId,
      }),
      Reservation.aggregate([
        {
          $match: {
            restaurantId,
            ...scope,
            date: { $gte: todayStart, $lt: tomorrowStart },
            status: { $in: ["approved", "seated", "completed"] },
          },
        },
        { $group: { _id: null, guests: { $sum: "$guests" } } },
      ]),
      Branch.aggregate([
        { $match: { restaurantId, ...branchScope, isActive: true } },
        { $group: { _id: null, capacity: { $sum: "$capacity" } } },
      ]),
      Reservation.aggregate([
        {
          $match: {
            restaurantId,
            ...scope,
            status: { $in: ["completed", "seated", "approved"] },
            date: { $gte: thirtyDaysAgo, $lt: tomorrowStart },
          },
        },
        { $group: { _id: "$branchId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "branches",
            localField: "_id",
            foreignField: "_id",
            as: "branch",
          },
        },
        { $unwind: "$branch" },
        { $project: { name: "$branch.name", count: 1 } },
      ]),
      Customer.countDocuments({
        restaurantId,
        "visitHistory.date": { $gte: thirtyDaysAgo },
      }),
      Customer.countDocuments({ restaurantId }),
      Reservation.countDocuments({ restaurantId, ...scope, status: "pending" }),
    ]);

    const guestsToday = occupancyAgg[0]?.guests ?? 0;
    const totalCapacity = totalCapacityAgg[0]?.capacity ?? 0;

    return ok({
      todaysReservations,
      reservationsDelta: percentChange(todaysReservations, yesterdaysReservations),
      revenue,
      revenueDelta: percentChange(revenue, prevRevenue),
      occupancyRate:
        totalCapacity > 0
          ? Math.min(100, Math.round((guestsToday / totalCapacity) * 100))
          : 0,
      guestsToday,
      totalCapacity,
      popularBranches: popularItems,
      activeCustomers,
      totalCustomers,
      pendingReservations: pendingCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
