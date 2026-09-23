import { NextRequest } from "next/server";
import { MenuItem } from "@/models";
import { menuItemSchema } from "@/lib/validations";
import {
  handleApiError,
  ok,
  paginated,
  parseBody,
  parseObjectId,
  parsePagination,
  assertBranchAccess,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { menuBranchFilter } from "@/lib/menu-scope";
import { trackEvent } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category");
    const branchId = searchParams.get("branchId");
    const availability = searchParams.get("availability");

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...menuBranchFilter(ctx),
    };
    if (search) filter.name = { $regex: search, $options: "i" };
    if (category && category !== "all") filter.category = category;
    if (branchId) {
      assertBranchAccess(ctx, branchId);
      filter.branchId = parseObjectId(branchId, "branch id");
    }
    if (availability === "true") filter.availability = true;
    if (availability === "false") filter.availability = false;

    const [items, total] = await Promise.all([
      MenuItem.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("branchId", "name")
        .lean(),
      MenuItem.countDocuments(filter),
    ]);

    return paginated(items, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const input = await parseBody(request, menuItemSchema);

    const { branchId, ...rest } = input;

    const item = await MenuItem.create({
      ...rest,
      ...(branchId ? { branchId: parseObjectId(branchId, "branch id") } : {}),
      ...tenantFilter(ctx),
    });

    await trackEvent(ctx.restaurantId, "menu_item_created", {
      menuItemId: item._id.toString(),
      name: item.name,
      category: item.category,
    });

    return ok(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
