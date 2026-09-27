import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const LOYALTY_TRANSACTION_TYPES = ["earn", "redeem", "adjust"] as const;
export type LoyaltyTransactionType = (typeof LOYALTY_TRANSACTION_TYPES)[number];

/**
 * Every change to a guest's points balance, so the balance on the customer
 * can always be explained.
 */
export interface ILoyaltyTransaction extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  customerId: Types.ObjectId;
  type: LoyaltyTransactionType;
  /** Positive when earned or added, negative when spent or removed. */
  points: number;
  balanceAfter: number;
  orderId?: Types.ObjectId;
  note?: string;
  actorId?: Types.ObjectId;
  createdAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    type: { type: String, enum: LOYALTY_TRANSACTION_TYPES, required: true },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    note: { type: String, trim: true, maxlength: 200 },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LoyaltyTransactionSchema.index({ customerId: 1, createdAt: -1 });

export const LoyaltyTransaction: Model<ILoyaltyTransaction> =
  mongoose.models.LoyaltyTransaction ||
  mongoose.model<ILoyaltyTransaction>(
    "LoyaltyTransaction",
    LoyaltyTransactionSchema
  );
