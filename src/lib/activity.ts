import { Types } from "mongoose";
import { ActivityLog, Notification, User } from "@/models";
import type { NotificationType } from "@/models";

/**
 * Activity and notifications are bookkeeping: they must never break the
 * operation that triggered them, so every failure is logged and swallowed.
 */

export async function recordActivity(entry: {
  restaurantId: string | Types.ObjectId;
  branchId?: string | Types.ObjectId;
  actorId?: string | Types.ObjectId;
  /** Falls back to the user's name, or "Guest" for booking-link actions. */
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string | Types.ObjectId;
  summary: string;
}) {
  try {
    let actorName = entry.actorName;
    if (!actorName && entry.actorId) {
      const user = await User.findById(entry.actorId).select("name").lean();
      actorName = user?.name;
    }

    await ActivityLog.create({
      restaurantId: new Types.ObjectId(entry.restaurantId),
      branchId: entry.branchId ? new Types.ObjectId(entry.branchId) : undefined,
      actorId: entry.actorId ? new Types.ObjectId(entry.actorId) : undefined,
      actorName: actorName ?? "Guest",
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ? new Types.ObjectId(entry.targetId) : undefined,
      summary: entry.summary,
    });
  } catch (error) {
    console.error("[activity] failed to record", entry.action, error);
  }
}

export async function notifyTeam(entry: {
  restaurantId: string | Types.ObjectId;
  branchId?: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    await Notification.create({
      restaurantId: new Types.ObjectId(entry.restaurantId),
      branchId: entry.branchId ? new Types.ObjectId(entry.branchId) : undefined,
      type: entry.type,
      title: entry.title,
      body: entry.body,
      link: entry.link,
      readBy: [],
    });
  } catch (error) {
    console.error("[notify] failed to create", entry.type, error);
  }
}
