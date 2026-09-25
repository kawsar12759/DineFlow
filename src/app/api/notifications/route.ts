import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Notification } from "@/models";
import {
  handleApiError,
  ok,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";

/** Recent alerts for the signed-in user's restaurant (and branch, for staff). */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const limit = Math.min(
      50,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 15)
    );
    const userId = new Types.ObjectId(ctx.userId);

    // Branch-scoped staff see their branch's alerts plus restaurant-wide ones.
    const scope = ctx.branchScope
      ? {
          $or: [
            { branchId: new Types.ObjectId(ctx.branchScope) },
            { branchId: { $exists: false } },
            { branchId: null },
          ],
        }
      : {};
    const filter = { ...tenantFilter(ctx), ...scope };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ ...filter, readBy: { $ne: userId } }),
    ]);

    return ok({
      unreadCount,
      notifications: notifications.map((notification) => ({
        _id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        createdAt: notification.createdAt,
        read: (notification.readBy ?? []).some(
          (id) => id.toString() === ctx.userId
        ),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Marks everything currently visible as read for this user. */
export async function PATCH() {
  try {
    const ctx = await requireTenantSession();
    const userId = new Types.ObjectId(ctx.userId);

    const result = await Notification.updateMany(
      { ...tenantFilter(ctx), readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    return ok({ markedRead: result.modifiedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
