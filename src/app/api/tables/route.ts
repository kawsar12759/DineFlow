import { NextRequest } from "next/server";
import { Branch, Table } from "@/models";
import { tableSchema } from "@/lib/validations";
import {
  ApiError,
  assertBranchAccess,
  branchFilter,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const branchId = request.nextUrl.searchParams.get("branchId");

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    };
    if (branchId && branchId !== "all") {
      assertBranchAccess(ctx, branchId);
      filter.branchId = parseObjectId(branchId, "branch id");
    }

    const tables = await Table.find(filter)
      .sort({ zone: 1, name: 1 })
      .populate("branchId", "name")
      .lean();

    return ok(tables);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const input = await parseBody(request, tableSchema);

    assertBranchAccess(ctx, input.branchId);
    const branch = await Branch.findOne({
      _id: parseObjectId(input.branchId, "branch id"),
      ...tenantFilter(ctx),
    }).lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const duplicate = await Table.findOne({
      branchId: branch._id,
      name: input.name,
    }).lean();
    if (duplicate) {
      throw new ApiError(`${branch.name} already has a table "${input.name}"`, 409);
    }

    const table = await Table.create({
      ...tenantFilter(ctx),
      branchId: branch._id,
      name: input.name,
      seats: input.seats,
      zone: input.zone || undefined,
    });

    return ok(table, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
