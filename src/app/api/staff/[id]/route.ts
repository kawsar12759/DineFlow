import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { User } from "@/models";
import { staffUpdateSchema } from "@/lib/validations";
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const input = await parseBody(request, staffUpdateSchema);

    if (ctx.role === "manager" && input.role === "manager") {
      throw new ApiError("Managers cannot promote to manager", 403);
    }

    const { password, branchId, ...rest } = input;
    const update: Record<string, unknown> = { ...rest };
    if (password) {
      update.password = await bcrypt.hash(password, 12);
    }
    if (branchId !== undefined) {
      update.branchId = branchId ? parseObjectId(branchId, "branch id") : null;
    }

    const member = await User.findOneAndUpdate(
      {
        _id: parseObjectId(id, "staff id"),
        ...tenantFilter(ctx),
        role: { $in: ["manager", "staff"] },
      },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!member) throw new ApiError("Staff member not found", 404);

    return ok(member);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner"]);
    const { id } = await params;

    const member = await User.findOneAndDelete({
      _id: parseObjectId(id, "staff id"),
      ...tenantFilter(ctx),
      role: { $in: ["manager", "staff"] },
    }).lean();

    if (!member) throw new ApiError("Staff member not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
