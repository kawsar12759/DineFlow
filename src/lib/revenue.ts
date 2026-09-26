import type { PipelineStage, Types } from "mongoose";
import { Order, Reservation } from "@/models";

/**
 * Revenue comes from paid orders. Bookings completed without an order (a
 * branch that does not use the till yet, or a spend typed in by hand) are
 * added from their estimated spend — `Reservation.orderId` marks the ones
 * already billed, so nothing is counted twice.
 */

interface Window {
  restaurantId: Types.ObjectId;
  from: Date;
  /** Exclusive. */
  to: Date;
  branchId?: Types.ObjectId;
}

function orderMatch({ restaurantId, from, to, branchId }: Window) {
  return {
    restaurantId,
    status: "paid",
    serviceDate: { $gte: from, $lt: to },
    ...(branchId ? { branchId } : {}),
  };
}

function reservationMatch({ restaurantId, from, to, branchId }: Window) {
  return {
    restaurantId,
    status: "completed",
    orderId: { $exists: false },
    date: { $gte: from, $lt: to },
    ...(branchId ? { branchId } : {}),
  };
}

/** Total revenue in a window. */
export async function revenueTotal(window: Window) {
  const [orders, reservations] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch(window) },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Reservation.aggregate([
      { $match: reservationMatch(window) },
      { $group: { _id: null, total: { $sum: "$estimatedSpend" } } },
    ]),
  ]);

  return (orders[0]?.total ?? 0) + (reservations[0]?.total ?? 0);
}

/** Revenue per "YYYY-MM-DD" day. */
export async function revenueByDay(window: Window) {
  const dayOf = (field: string): PipelineStage.Group["$group"]["_id"] => ({
    $dateToString: { format: "%Y-%m-%d", date: `$${field}` },
  });

  const [orders, reservations] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch(window) },
      { $group: { _id: dayOf("serviceDate"), revenue: { $sum: "$total" } } },
    ]),
    Reservation.aggregate([
      { $match: reservationMatch(window) },
      { $group: { _id: dayOf("date"), revenue: { $sum: "$estimatedSpend" } } },
    ]),
  ]);

  const byDay = new Map<string, number>();
  for (const row of [...orders, ...reservations]) {
    byDay.set(row._id, (byDay.get(row._id) ?? 0) + (row.revenue ?? 0));
  }
  return byDay;
}

/** Revenue per branch id. */
export async function revenueByBranch(window: Window) {
  const [orders, reservations] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch(window) },
      { $group: { _id: "$branchId", revenue: { $sum: "$total" } } },
    ]),
    Reservation.aggregate([
      { $match: reservationMatch(window) },
      { $group: { _id: "$branchId", revenue: { $sum: "$estimatedSpend" } } },
    ]),
  ]);

  const byBranch = new Map<string, number>();
  for (const row of [...orders, ...reservations]) {
    const key = String(row._id);
    byBranch.set(key, (byBranch.get(key) ?? 0) + (row.revenue ?? 0));
  }
  return byBranch;
}
