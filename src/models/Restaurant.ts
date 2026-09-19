import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/constants";

export interface IRestaurant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  subscriptionPlan: SubscriptionPlan;
  cuisine?: string;
  description?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionPlan: {
      type: String,
      enum: SUBSCRIPTION_PLANS,
      default: "starter",
    },
    cuisine: { type: String, trim: true },
    description: { type: String, trim: true },
    logo: { type: String },
  },
  { timestamps: true }
);

export const Restaurant: Model<IRestaurant> =
  mongoose.models.Restaurant ||
  mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);
