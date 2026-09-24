import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IVisit {
  date: Date;
  branchId?: Types.ObjectId;
  spend: number;
  guests: number;
}

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  visitHistory: IVisit[];
  totalSpend: number;
  visitCount: number;
  noShowCount: number;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    visitHistory: [
      {
        date: { type: Date, required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
        spend: { type: Number, default: 0 },
        guests: { type: Number, default: 1 },
      },
    ],
    totalSpend: { type: Number, default: 0 },
    visitCount: { type: Number, default: 0 },
    noShowCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ restaurantId: 1, email: 1 }, { unique: true });
CustomerSchema.index({ restaurantId: 1, name: "text" });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);
