import { Types } from "mongoose";
import type { SessionContext } from "@/lib/api-helpers";

/**
 * Branch-scoped users see restaurant-wide menu items (no branchId) plus
 * items specific to their own branch.
 */
export function menuBranchFilter(ctx: SessionContext) {
  return ctx.branchScope
    ? { branchId: { $in: [null, new Types.ObjectId(ctx.branchScope)] } }
    : {};
}
