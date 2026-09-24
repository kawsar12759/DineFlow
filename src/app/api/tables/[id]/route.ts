import { NextRequest } from "next/server";
import { Reservation, Table } from "@/models";
import { tableUpdateSchema } from "@/lib/validations";
import {
  ApiError,
  branchFilter,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { dayKeyToDate, todayKey } from "@/lib/dates";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const input = await parseBody(request, tableUpdateSchema);

    const update: Record<string, unknown> = { ...input };
    if (input.zone !== undefined) update.zone = input.zone || undefined;

    const table = await Table.findOneAndUpdate(
      {
        _id: parseObjectId(id, "table id"),
        ...tenantFilter(ctx),
        ...branchFilter(ctx),
      },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!table) throw new ApiError("Table not found", 404);

    return ok(table);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;
    const tableId = parseObjectId(id, "table id");

    // Refuse while upcoming bookings still hold this table.
    const upcoming = await Reservation.countDocuments({
      ...tenantFilter(ctx),
      tableIds: tableId,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      date: { $gte: dayKeyToDate(todayKey()) },
    });
    if (upcoming > 0) {
      throw new ApiError(
        `Cannot delete: ${upcoming} upcoming booking(s) are seated at this table. Deactivate it instead.`,
        409
      );
    }

    const table = await Table.findOneAndDelete({
      _id: tableId,
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
    }).lean();

    if (!table) throw new ApiError("Table not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
