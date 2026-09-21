import { Types } from "mongoose";
import { Branch, Reservation } from "@/models";
import { handleApiError, ok, requireTenantSession } from "@/lib/api-helpers";

/** Per-branch performance: reservations, revenue, covers, utilization. */
export async function GET() {
  try {
    const ctx = await requireTenantSession();
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [branches, performance] = await Promise.all([
      Branch.find({ restaurantId }).lean(),
      Reservation.aggregate([
        { $match: { restaurantId, date: { $gte: since } } },
        {
          $group: {
            _id: "$branchId",
            reservations: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "completed"] },
                  { $ifNull: ["$estimatedSpend", 0] },
                  0,
                ],
              },
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
        revenue: perf?.revenue ?? 0,
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
