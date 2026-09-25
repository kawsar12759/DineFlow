import { NextRequest } from "next/server";
import { ActivityLog } from "@/models";
import {
  branchFilter,
  handleApiError,
  paginated,
  parsePagination,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";

/** Who changed what. Owners and managers only. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams);
    const action = request.nextUrl.searchParams.get("action");

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    };
    if (action && action !== "all") {
      filter.action = { $regex: `^${action}`, $options: "i" };
    }

    const [entries, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("branchId", "name")
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return paginated(entries, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}
