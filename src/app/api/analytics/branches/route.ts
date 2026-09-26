import { Types } from "mongoose";
import { Branch, Reservation } from "@/models";
import { handleApiError, ok, requireTenantSession } from "@/lib/api-helpers";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { revenueByBranch } from "@/lib/revenue";

/** Per-branch performance: reservations, revenue, covers, utilization. */
export async function GET() {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    // Last 30 Dhaka days, today included; future bookings are excluded.
    const today = todayKey();
    const since = dayKeyToDate(addDaysToKey(today, -29));
    const until = dayKeyToDate(addDaysToKey(today, 1));

    const [branches, performance, revenueByBranchMap] = await Promise.all([
      Branch.find({ restaurantId }).lean(),
      Reservation.aggregate([
        { $match: { restaurantId, date: { $gte: since, $lt: until } } },
        {
          $group: {
            _id: "$branchId",
            reservations: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            covers: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["completed", "seated"]] },
                  "$guests",
                  0,
                ],
              },
            },
          },
        },
      ]),
      revenueByBranch({ restaurantId, from: since, to: until }),
    ]);

    const perfMap = new Map(performance.map((p) => [String(p._id), p]));

    const data = branches.map((branch) => {
      const perf = perfMap.get(String(branch._id));
      return {
        _id: branch._id,
        name: branch.name,
        city: branch.address?.city,
        capacity: branch.capacity,
        isActive: branch.isActive,
        reservations: perf?.reservations ?? 0,
        completed: perf?.completed ?? 0,
        revenue: revenueByBranchMap.get(String(branch._id)) ?? 0,
        covers: perf?.covers ?? 0,
        // covers over the period vs theoretical capacity (capacity × 30 days)
        utilization:
          branch.capacity > 0
            ? Math.min(
                100,
                Math.round(((perf?.covers ?? 0) / (branch.capacity * 30)) * 100)
              )
            : 0,
      };
    });

    data.sort((a, b) => b.revenue - a.revenue);

    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}
