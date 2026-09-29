import { NextRequest } from "next/server";
import { SubscriptionPayment } from "@/models";
import {
  handleApiError,
  paginated,
  parsePagination,
  requireSuperAdmin,
} from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";

/** Subscription payments across DineFlow, newest first. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    await connectDB();
    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status");
    const filter = status && status !== "all" ? { status } : {};

    const [payments, total] = await Promise.all([
      SubscriptionPayment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("restaurantId", "name slug")
        .lean(),
      SubscriptionPayment.countDocuments(filter),
    ]);

    return paginated(payments, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}
