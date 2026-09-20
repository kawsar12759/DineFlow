import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Branch, Restaurant } from "@/models";
import { handleApiError, ok } from "@/lib/api-helpers";

/** Public branch directory for the marketing site. No auth required. */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const search = request.nextUrl.searchParams.get("search")?.trim();

    const filter: Record<string, unknown> = { isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }

    const branches = await Branch.find(filter)
      .sort({ createdAt: -1 })
      .limit(60)
      .select("name address capacity contactInfo openingHours image restaurantId")
      .lean();

    const restaurantIds = [...new Set(branches.map((b) => String(b.restaurantId)))];
    const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } })
      .select("name cuisine")
      .lean();
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    return ok(
      branches.map((branch) => ({
        ...branch,
        restaurant: restaurantMap.get(String(branch.restaurantId)) ?? null,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
