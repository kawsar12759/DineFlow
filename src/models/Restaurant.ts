import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  SUBSCRIPTION_PLANS,
  type BillingSettings,
  type BookingSettings,
  type SubscriptionPlan,
} from "@/lib/constants";

export interface IRestaurant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  subscriptionPlan: SubscriptionPlan;
  cuisine?: string;
  description?: string;
  logo?: string;
  phone?: string;
  email?: string;
  website?: string;
  /** Show the public storefront at /r/<slug>. */
  isPublished: boolean;
  bookingSettings: BookingSettings;
  billingSettings: BillingSettings;
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
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    isPublished: { type: Boolean, default: true },
    bookingSettings: {
      diningDurationMinutes: {
        type: Number,
        min: 30,
        max: 300,
        default: DEFAULT_BOOKING_SETTINGS.diningDurationMinutes,
      },
      slotIntervalMinutes: {
        type: Number,
        min: 15,
        max: 60,
        default: DEFAULT_BOOKING_SETTINGS.slotIntervalMinutes,
      },
      maxPartySize: {
        type: Number,
        min: 1,
        max: 50,
        default: DEFAULT_BOOKING_SETTINGS.maxPartySize,
      },
      minLeadMinutes: {
        type: Number,
        min: 0,
        max: 10080,
        default: DEFAULT_BOOKING_SETTINGS.minLeadMinutes,
      },
      maxDaysAhead: {
        type: Number,
        min: 1,
        max: 365,
        default: DEFAULT_BOOKING_SETTINGS.maxDaysAhead,
      },
      autoApprove: {
        type: Boolean,
        default: DEFAULT_BOOKING_SETTINGS.autoApprove,
      },
    },
    billingSettings: {
      vatPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: DEFAULT_BILLING_SETTINGS.vatPercent,
      },
      serviceChargePercent: {
        type: Number,
        min: 0,
        max: 100,
        default: DEFAULT_BILLING_SETTINGS.serviceChargePercent,
      },
    },
  },
  { timestamps: true }
);

export const Restaurant: Model<IRestaurant> =
  mongoose.models.Restaurant ||
  mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);
