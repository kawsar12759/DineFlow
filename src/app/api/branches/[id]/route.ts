import { NextRequest } from "next/server";
import { Branch, Reservation } from "@/models";
import { branchUpdateSchema } from "@/lib/validations";
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

    const branch = await Branch.findOne({
      _id: parseObjectId(id, "branch id"),
      ...tenantFilter(ctx),
    }).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    return ok(branch);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const input = await parseBody(request, branchUpdateSchema);

    const branch = await Branch.findOneAndUpdate(
      { _id: parseObjectId(id, "branch id"), ...tenantFilter(ctx) },
      { $set: input },
      { new: true, runValidators: true }
    ).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    return ok(branch);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner"]);
    const { id } = await params;
    const branchId = parseObjectId(id, "branch id");

    const activeReservations = await Reservation.countDocuments({
      branchId,
      ...tenantFilter(ctx),
      status: { $in: ["pending", "approved", "seated"] },
    });

    if (activeReservations > 0) {
      throw new ApiError(
        `Cannot delete branch with ${activeReservations} active reservation(s)`,
        409
      );
    }

    const branch = await Branch.findOneAndDelete({
      _id: branchId,
      ...tenantFilter(ctx),
    }).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
