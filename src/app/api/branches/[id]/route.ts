import { NextRequest } from "next/server";
import { Branch, Reservation } from "@/models";
import { branchUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  branchFilter,
  requireTenantSession,
  requireWriteSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { assertCanAddBranch } from "@/lib/plan-limits";
import { assertTenantImage, deleteReplacedImage } from "@/lib/cloudinary";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;

    const branch = await Branch.findOne({
      _id: parseObjectId(id, "branch id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx, "_id"),
    }).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    return ok(branch);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireWriteSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const { image, ...input } = await parseBody(request, branchUpdateSchema);
    const branchId = parseObjectId(id, "branch id");

    const current = await Branch.findOne({ _id: branchId, ...tenantFilter(ctx) })
      .select("isActive image")
      .lean();
    if (!current) throw new ApiError("Branch not found", 404);

    // Switching a closed branch back on counts towards the plan's limit.
    if (input.isActive === true && !current.isActive) await assertCanAddBranch(ctx);

    const set: Record<string, unknown> = { ...input };
    const update: Record<string, unknown> = {};
    if (image !== undefined) {
      assertTenantImage(image, ctx.restaurantId, current.image);
      if (image) set.image = image;
      else update.$unset = { image: 1 };
    }
    if (Object.keys(set).length > 0) update.$set = set;

    const branch = await Branch.findOneAndUpdate(
      { _id: branchId, ...tenantFilter(ctx) },
      update,
      { new: true, runValidators: true }
    ).lean();

    if (!branch) throw new ApiError("Branch not found", 404);

    if (image !== undefined) {
      await deleteReplacedImage(current.image, branch.image, ctx.restaurantId);
    }

    return ok(branch);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireWriteSession(["super_admin", "owner"]);
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

    await deleteReplacedImage(branch.image, null, ctx.restaurantId);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
