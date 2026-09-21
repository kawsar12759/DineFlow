import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Customer, Reservation } from "@/models";
import { handleApiError, ok, requireTenantSession } from "@/lib/api-helpers";

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

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const dateGroup = {
      $dateToString: { format: "%Y-%m-%d", date: "$date" },
    };

    const [reservationSeries, revenueSeries, customerSeries] =
      await Promise.all([
        Reservation.aggregate([
          { $match: { restaurantId, date: { $gte: since } } },
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
              status: "completed",
              date: { $gte: since },
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
          { $match: { restaurantId, createdAt: { $gte: since } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
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
      const day = new Date(since);
      day.setDate(day.getDate() + i);
      const key = day.toISOString().slice(0, 10);
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
