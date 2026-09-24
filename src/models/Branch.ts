import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { DEFAULT_OPENING_HOURS, type OpeningHour } from "@/lib/constants";

export interface IClosure {
  /** UTC midnight of the closed Dhaka day. */
  date: Date;
  reason?: string;
}

export interface IBranch extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zip?: string;
    country: string;
  };
  capacity: number;
  contactInfo: {
    phone?: string;
    email?: string;
  };
  /** Weekly schedule, one entry per weekday (0 = Sunday). */
  hours: OpeningHour[];
  /** One-off closures (holidays, private events). */
  closures: IClosure[];
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
      country: { type: String, required: true, trim: true, default: "Bangladesh" },
    },
    capacity: { type: Number, required: true, min: 1 },
    contactInfo: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    hours: {
      type: [
        {
          _id: false,
          day: { type: Number, required: true, min: 0, max: 6 },
          open: { type: String, required: true },
          close: { type: String, required: true },
          closed: { type: Boolean, default: false },
        },
      ],
      default: () => DEFAULT_OPENING_HOURS,
    },
    closures: [
      {
        _id: false,
        date: { type: Date, required: true },
        reason: { type: String, trim: true },
      },
    ],
    image: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BranchSchema.index({ restaurantId: 1, name: 1 });

export const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>("Branch", BranchSchema);
