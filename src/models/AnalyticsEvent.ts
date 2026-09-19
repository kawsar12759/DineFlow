import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from "@/lib/constants";

export interface IAnalyticsEvent extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  type: AnalyticsEventType;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ANALYTICS_EVENT_TYPES,
      required: true,
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AnalyticsEventSchema.index({ restaurantId: 1, type: 1, createdAt: -1 });

export const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema);
