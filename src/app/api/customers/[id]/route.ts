import { NextRequest } from "next/server";
import { Customer, Reservation } from "@/models";
import { customerUpdateSchema } from "@/lib/validations";
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
    const customerId = parseObjectId(id, "customer id");

    const [customer, reservations] = await Promise.all([
      Customer.findOne({ _id: customerId, ...tenantFilter(ctx) })
        .populate("visitHistory.branchId", "name")
        .lean(),
      Reservation.find({ customerId, ...tenantFilter(ctx) })
        .sort({ date: -1 })
        .limit(20)
        .populate("branchId", "name")
        .lean(),
    ]);

    if (!customer) throw new ApiError("Customer not found", 404);

    return ok({ customer, reservations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession();
    const { id } = await params;
    const input = await parseBody(request, customerUpdateSchema);

    const customer = await Customer.findOneAndUpdate(
      { _id: parseObjectId(id, "customer id"), ...tenantFilter(ctx) },
      { $set: input },
      { new: true, runValidators: true }
    ).lean();

    if (!customer) throw new ApiError("Customer not found", 404);

    return ok(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { id } = await params;

    const customer = await Customer.findOneAndDelete({
      _id: parseObjectId(id, "customer id"),
      ...tenantFilter(ctx),
    }).lean();

    if (!customer) throw new ApiError("Customer not found", 404);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
