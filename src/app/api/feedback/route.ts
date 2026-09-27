import { NextRequest, NextResponse } from "next/server";
import { Feedback } from "@/models";
import {
  assertBranchAccess,
  branchFilter,
  handleApiError,
  parseObjectId,
  parsePagination,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { ratingSummary } from "@/lib/feedback";

/**
 * Guest reviews, newest first, with the rating summary for the same branch
 * and period (the star/reply filters narrow the list, not the summary).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const scope: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    };
    const branchId = searchParams.get("branchId");
    if (branchId && branchId !== "all") {
      assertBranchAccess(ctx, branchId);
      scope.branchId = parseObjectId(branchId, "branch id");
    }
    const days = Number(searchParams.get("days"));
    if (days > 0) {
      scope.createdAt = { $gte: new Date(Date.now() - days * 86_400_000) };
    }

    const filter: Record<string, unknown> = { ...scope };
    const rating = Number(searchParams.get("rating"));
    if (rating >= 1 && rating <= 5) filter.rating = rating;
    if (searchParams.get("replied") === "no") filter["reply.body"] = { $exists: false };

    const [items, total, summary] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "name email")
        .populate("branchId", "name")
        .populate("reservationId", "date time guests")
        .lean(),
      Feedback.countDocuments(filter),
      ratingSummary(scope),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      summary,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
