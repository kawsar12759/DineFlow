import { NextRequest } from "next/server";
import { MenuItem } from "@/models";
import { menuItemUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;

    const item = await MenuItem.findOne({
      _id: parseObjectId(id, "menu item id"),
      ...tenantFilter(ctx),
    })
      .populate("branchId", "name")
      .lean();

    if (!item) throw new ApiError("Menu item not found", 404);

    return ok(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession([
      "super_admin",
      "owner",
      "manager",
      "staff",
    ]);
    const { id } = await params;
    const input = await parseBody(request, menuItemUpdateSchema);

    // Staff may only toggle availability — not edit the item itself.
    if (ctx.role === "staff") {
      const keys = Object.keys(input);
      const allowed = keys.every((key) => key === "availability");
      if (!allowed) {
        throw new ApiError("Staff can only update availability", 403);
      }
    }

    const { branchId, ...rest } = input;
    const update: Record<string, unknown> = { ...rest };
    if (branchId !== undefined) {
      update.branchId = branchId
        ? parseObjectId(branchId, "branch id")
        : null;
    }

    const item = await MenuItem.findOneAndUpdate(
      { _id: parseObjectId(id, "menu item id"), ...tenantFilter(ctx) },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!item) throw new ApiError("Menu item not found", 404);

    return ok(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;

    const item = await MenuItem.findOneAndDelete({
      _id: parseObjectId(id, "menu item id"),
      ...tenantFilter(ctx),
    }).lean();

    if (!item) throw new ApiError("Menu item not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
