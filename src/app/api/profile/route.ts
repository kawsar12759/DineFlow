import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { User } from "@/models";
import { profileUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  requireTenantSession,
} from "@/lib/api-helpers";

/** The signed-in user's own account. */
export async function GET() {
  try {
    const ctx = await requireTenantSession();
    const user = await User.findById(ctx.userId)
      .select("name email phone position shift role branchId")
      .populate("branchId", "name")
      .lean();
    if (!user) throw new ApiError("User not found", 404);

    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const input = await parseBody(request, profileUpdateSchema);

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.phone !== undefined) update.phone = input.phone || undefined;

    // Changing the password requires proving the current one.
    if (input.newPassword) {
      const user = await User.findById(ctx.userId).select("+password").lean();
      if (!user) throw new ApiError("User not found", 404);

      const matches = await bcrypt.compare(
        input.currentPassword ?? "",
        user.password
      );
      if (!matches) throw new ApiError("Current password is incorrect", 403);

      update.password = await bcrypt.hash(input.newPassword, 12);
    }

    if (Object.keys(update).length === 0) {
      throw new ApiError("Nothing to update", 400);
    }

    const user = await User.findByIdAndUpdate(
      ctx.userId,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select("name email phone position shift role")
      .lean();

    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}
