import { NextRequest } from "next/server";
import { Branch, Order } from "@/models";
import {
  ApiError,
  assertBranchAccess,
  branchFilter,
  handleApiError,
  ok,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { dayKeyToDate, todayKey } from "@/lib/dates";

/** Tickets the kitchen still has to cook, oldest first. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const branchParam = request.nextUrl.searchParams.get("branchId");

    if (branchParam) assertBranchAccess(ctx, branchParam);
    let branchId = branchParam ?? ctx.branchScope ?? null;
    if (!branchId) {
      const first = await Branch.findOne({ ...tenantFilter(ctx), isActive: true })
        .sort({ _id: 1 })
        .select("_id")
        .lean();
      branchId = first?._id.toString() ?? null;
    }
    if (!branchId) throw new ApiError("No branch found", 404);

    const branch = await Branch.findOne({
      _id: parseObjectId(branchId, "branch id"),
      ...tenantFilter(ctx),
      ...branchFilter(ctx, "_id"),
    })
      .select("name")
      .lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const orders = await Order.find({
      ...tenantFilter(ctx),
      branchId: branch._id,
      status: "open",
      serviceDate: dayKeyToDate(todayKey()),
      "items.sentAt": { $exists: true },
    })
      .sort({ orderNumber: 1 })
      .populate("tableIds", "name")
      .lean();

    const tickets = orders
      .map((order) => ({
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        guests: order.guests,
        tables: (order.tableIds as unknown as { name: string }[]).map(
          (table) => table.name
        ),
        openedAt: order.createdAt,
        items: order.items
          .filter((item) => item.sentAt && !item.voided && item.status !== "served")
          .map((item) => ({
            _id: item._id.toString(),
            name: item.name,
            quantity: item.quantity,
            notes: item.notes,
            status: item.status,
            sentAt: item.sentAt,
          })),
      }))
      .filter((ticket) => ticket.items.length > 0);

    return ok({
      branch: { _id: branch._id.toString(), name: branch.name },
      tickets,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
