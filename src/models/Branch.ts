import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

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
  openingHours?: string;
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
    openingHours: { type: String, trim: true },
    image: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BranchSchema.index({ restaurantId: 1, name: 1 });

export const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>("Branch", BranchSchema);
