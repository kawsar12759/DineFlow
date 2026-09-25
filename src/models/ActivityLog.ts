import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/** Who changed what, so an owner can see how the day was run. */
export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId?: Types.ObjectId;
  /** Null for guest actions taken through a booking link. */
  actorId?: Types.ObjectId;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId;
  /** One line describing the change, written when it happens. */
  summary: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, required: true, trim: true },
    targetId: { type: Schema.Types.ObjectId },
    summary: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ restaurantId: 1, createdAt: -1 });

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
