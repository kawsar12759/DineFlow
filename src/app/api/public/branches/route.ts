import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Branch, Restaurant } from "@/models";
import { handleApiError, ok } from "@/lib/api-helpers";
import { describeHours } from "@/lib/availability";

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

    const published = await Restaurant.find({ isPublished: true })
      .select("name slug cuisine")
      .lean();
    const restaurantMap = new Map(published.map((r) => [String(r._id), r]));
    filter.restaurantId = { $in: published.map((r) => r._id) };

    const branches = await Branch.find(filter)
      .sort({ createdAt: -1 })
      .limit(60)
      .select("name address capacity contactInfo hours image restaurantId")
      .lean();

    return ok(
      branches.map((branch) => ({
        ...branch,
        openingHours: describeHours(branch.hours),
        restaurant: restaurantMap.get(String(branch.restaurantId)) ?? null,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
