import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Customer, Reservation } from "@/models";
import {
  branchFilter,
  handleApiError,
  ok,
  requireTenantSession,
} from "@/lib/api-helpers";
import { TIMEZONE } from "@/lib/constants";
import {
  addDaysToKey,
  dayKeyToDate,
  dayStartInstant,
  todayKey,
} from "@/lib/dates";

/**
 * Daily time series for the dashboard charts: reservations, revenue,
 * and new customers per day over the requested window.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    const days = Math.min(
      90,
      Math.max(7, Number(request.nextUrl.searchParams.get("days")) || 30)
    );

    const scope = branchFilter(ctx);
    const today = todayKey();
    const sinceKey = addDaysToKey(today, -(days - 1));
    // Reservation dates are stored as UTC midnight of their Dhaka day;
    // customer createdAt is a real instant, so it is bucketed in Dhaka time.
    const since = dayKeyToDate(sinceKey);
    const until = dayKeyToDate(addDaysToKey(today, 1));

    const dateGroup = {
      $dateToString: { format: "%Y-%m-%d", date: "$date" },
    };

    const [reservationSeries, revenueSeries, customerSeries] =
      await Promise.all([
        Reservation.aggregate([
          { $match: { restaurantId, ...scope, date: { $gte: since, $lt: until } } },
          {
            $group: {
              _id: dateGroup,
              total: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
              },
              cancelled: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["cancelled", "rejected"]] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Reservation.aggregate([
          {
            $match: {
              restaurantId,
              ...scope,
              status: "completed",
              date: { $gte: since, $lt: until },
            },
          },
          {
            $group: {
              _id: dateGroup,
              revenue: { $sum: "$estimatedSpend" },
              covers: { $sum: "$guests" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Customer.aggregate([
          { $match: { restaurantId, createdAt: { $gte: dayStartInstant(sinceKey) } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                  timezone: TIMEZONE,
                },
              },
              newCustomers: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    // Zero-fill so charts render continuous series.
    const series: {
      date: string;
      reservations: number;
      completed: number;
      cancelled: number;
      revenue: number;
      covers: number;
      newCustomers: number;
    }[] = [];

    const reservationMap = new Map(reservationSeries.map((r) => [r._id, r]));
    const revenueMap = new Map(revenueSeries.map((r) => [r._id, r]));
    const customerMap = new Map(customerSeries.map((r) => [r._id, r]));

    for (let i = 0; i < days; i++) {
      const key = addDaysToKey(sinceKey, i);
      series.push({
        date: key,
        reservations: reservationMap.get(key)?.total ?? 0,
        completed: reservationMap.get(key)?.completed ?? 0,
        cancelled: reservationMap.get(key)?.cancelled ?? 0,
        revenue: revenueMap.get(key)?.revenue ?? 0,
        covers: revenueMap.get(key)?.covers ?? 0,
        newCustomers: customerMap.get(key)?.newCustomers ?? 0,
      });
    }

    return ok({ days, series });
  } catch (error) {
    return handleApiError(error);
  }
}
