import { NextRequest } from "next/server";
import { Branch } from "@/models";
import { branchSchema } from "@/lib/validations";
import {
  handleApiError,
  ok,
  paginated,
  parseBody,
  parsePagination,
  branchFilter,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx, "_id"),
    };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }

    const [branches, total] = await Promise.all([
      Branch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Branch.countDocuments(filter),
    ]);

    return paginated(branches, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const input = await parseBody(request, branchSchema);

    const branch = await Branch.create({
      ...input,
      ...tenantFilter(ctx),
    });

    await trackEvent(ctx.restaurantId, "branch_created", {
      branchId: branch._id.toString(),
      name: branch.name,
    });

    return ok(branch, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
