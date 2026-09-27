import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/** A guest's rating of one visit, left through their emailed feedback link. */
export interface IFeedback extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  /** One review per visit. */
  reservationId: Types.ObjectId;
  customerId: Types.ObjectId;
  /** 1–5 stars. */
  rating: number;
  comment?: string;
  /** Staff can hide a review from the public page (abuse, private details). */
  isPublic: boolean;
  reply?: {
    body: string;
    repliedAt: Date;
    repliedBy?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
      unique: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    isPublic: { type: Boolean, default: true },
    reply: {
      body: { type: String, trim: true, maxlength: 1000 },
      repliedAt: { type: Date },
      repliedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
  },
  { timestamps: true }
);

FeedbackSchema.index({ restaurantId: 1, createdAt: -1 });
FeedbackSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });
FeedbackSchema.index({ customerId: 1 });

export const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>("Feedback", FeedbackSchema);
