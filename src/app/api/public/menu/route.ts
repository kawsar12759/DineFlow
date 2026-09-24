import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { MenuItem, Restaurant } from "@/models";
import { handleApiError, paginated, parsePagination } from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";

/** Public searchable menu for the marketing site. No auth required. */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category");

    const published = await Restaurant.find({ isPublished: true })
      .select("name slug")
      .lean();
    const restaurantMap = new Map(published.map((r) => [String(r._id), r]));

    const filter: Record<string, unknown> = {
      availability: true,
      restaurantId: { $in: published.map((r) => r._id) },
    };
    if (search) filter.name = { $regex: search, $options: "i" };
    if (category && category !== "all") filter.category = category;

    const [items, total] = await Promise.all([
      MenuItem.find(filter)
        .sort({ popularityScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name description price category image allergens preparationTime restaurantId")
        .lean(),
      MenuItem.countDocuments(filter),
    ]);

    // Record view events for popularity analytics (sampled to first page).
    if (page === 1 && items.length > 0) {
      const sample = items.slice(0, 3);
      void Promise.all(
        sample.map((item) =>
          trackEvent(item.restaurantId, "menu_item_viewed", {
            menuItemId: String(item._id),
            source: "public_menu",
          })
        )
      );
    }

    return paginated(
      items.map((item) => ({
        ...item,
        restaurant: restaurantMap.get(String(item.restaurantId)) ?? null,
      })),
      total,
      page,
      limit
    );
  } catch (error) {
    return handleApiError(error);
  }
}
