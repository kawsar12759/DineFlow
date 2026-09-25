import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "reservation_created",
  "reservation_cancelled",
  "reservation_changed",
  "waitlist_added",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** An in-app alert for a restaurant's team. */
export interface INotification extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  /** Set when only one branch's team cares about it. */
  branchId?: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  /** Dashboard path this alert points at. */
  link?: string;
  /** Users who have read it; unread is "my id is not in here". */
  readBy: Types.ObjectId[];
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    link: { type: String, trim: true },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ restaurantId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
