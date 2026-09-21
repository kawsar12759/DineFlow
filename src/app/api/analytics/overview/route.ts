import { Types } from "mongoose";
import { Branch, Customer, Reservation } from "@/models";
import {
  handleApiError,
  ok,
  requireTenantSession,
} from "@/lib/api-helpers";
import { percentChange } from "@/lib/utils";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const ctx = await requireTenantSession();
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      todaysReservations,
      yesterdaysReservations,
      revenueAgg,
      prevRevenueAgg,
      occupancyAgg,
      totalCapacityAgg,
      popularItems,
      activeCustomers,
      totalCustomers,
      pendingCount,
    ] = await Promise.all([
      Reservation.countDocuments({
        restaurantId,
        date: { $gte: todayStart, $lt: tomorrowStart },
      }),
      Reservation.countDocuments({
        restaurantId,
        date: {
          $gte: new Date(todayStart.getTime() - 86400000),
          $lt: todayStart,
        },
      }),
      Reservation.aggregate([
        {
          $match: {
            restaurantId,
            status: "completed",
            date: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$estimatedSpend" } } },
      ]),
      Reservation.aggregate([
        {
          $match: {
            restaurantId,
            status: "completed",
            date: { $gte: prevMonthStart, $lt: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$estimatedSpend" } } },
      ]),
      Reservation.aggregate([
        {
          $match: {
            restaurantId,
            date: { $gte: todayStart, $lt: tomorrowStart },
            status: { $in: ["approved", "seated", "completed"] },
          },
        },
        { $group: { _id: null, guests: { $sum: "$guests" } } },
      ]),
      Branch.aggregate([
        { $match: { restaurantId, isActive: true } },
        { $group: { _id: null, capacity: { $sum: "$capacity" } } },
      ]),
      Reservation.aggregate([
        {
          $match: {
            restaurantId,
            status: { $in: ["completed", "seated", "approved"] },
            date: { $gte: thirtyDaysAgo },
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
      Reservation.countDocuments({ restaurantId, status: "pending" }),
    ]);

    const revenue = revenueAgg[0]?.total ?? 0;
    const prevRevenue = prevRevenueAgg[0]?.total ?? 0;
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
