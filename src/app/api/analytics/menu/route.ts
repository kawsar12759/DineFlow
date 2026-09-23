import { Types } from "mongoose";
import { AnalyticsEvent, MenuItem } from "@/models";
import { handleApiError, ok, requireTenantSession } from "@/lib/api-helpers";
import { addDaysToKey, dayStartInstant, todayKey } from "@/lib/dates";

/** Menu popularity: view events per item + category distribution. */
export async function GET() {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const restaurantId = new Types.ObjectId(ctx.restaurantId);

    // View events are real timestamps: last 30 days in Dhaka time.
    const since = dayStartInstant(addDaysToKey(todayKey(), -29));

    const [views, categories, items] = await Promise.all([
      AnalyticsEvent.aggregate([
        {
          $match: {
            restaurantId,
            type: "menu_item_viewed",
            createdAt: { $gte: since },
          },
        },
        { $group: { _id: "$metadata.menuItemId", views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),
      MenuItem.aggregate([
        { $match: { restaurantId } },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            avgPrice: { $avg: "$price" },
            available: {
              $sum: { $cond: ["$availability", 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
      ]),
      MenuItem.find({ restaurantId })
        .sort({ popularityScore: -1 })
        .limit(10)
        .select("name category price popularityScore availability")
        .lean(),
    ]);

    const viewIds = views
      .map((v) => v._id)
      .filter((id): id is string => typeof id === "string" && Types.ObjectId.isValid(id));

    const viewedItems = await MenuItem.find({
      _id: { $in: viewIds.map((id) => new Types.ObjectId(id)) },
      restaurantId,
    })
      .select("name category price")
      .lean();

    const itemMap = new Map(viewedItems.map((item) => [String(item._id), item]));

    const topViewed = views
      .map((view) => {
        const item = itemMap.get(String(view._id));
        if (!item) return null;
        return {
          _id: view._id,
          name: item.name,
          category: item.category,
          price: item.price,
          views: view.views,
        };
      })
      .filter(Boolean);

    return ok({
      topViewed,
      categories: categories.map((c) => ({
        category: c._id,
        count: c.count,
        available: c.available,
        avgPrice: Math.round(c.avgPrice * 100) / 100,
      })),
      topByScore: items,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
