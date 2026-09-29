import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_FEEDBACK_SETTINGS,
  DEFAULT_LOYALTY_SETTINGS,
  SUBSCRIPTION_PLANS,
  type BillingSettings,
  type BookingSettings,
  type FeedbackSettings,
  type LoyaltySettings,
  type SubscriptionPlan,
} from "@/lib/constants";

export interface IRestaurant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  subscriptionPlan: SubscriptionPlan;
  /** Paid (or trial) access runs until this moment. */
  subscriptionEndsAt?: Date;
  /** True until the first successful payment. */
  onTrial: boolean;
  /** Set by DineFlow staff to switch a restaurant off, whatever it has paid. */
  suspendedAt?: Date;
  suspendedReason?: string;
  /** Reminder emails already sent, as "<endsAt ISO>:<stage>", so each goes once. */
  subscriptionNotices: string[];
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
  loyaltySettings: LoyaltySettings;
  feedbackSettings: FeedbackSettings;
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
    subscriptionEndsAt: { type: Date, index: true },
    onTrial: { type: Boolean, default: true },
    suspendedAt: { type: Date },
    suspendedReason: { type: String, trim: true, maxlength: 300 },
    subscriptionNotices: { type: [String], default: [] },
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
    loyaltySettings: {
      enabled: { type: Boolean, default: DEFAULT_LOYALTY_SETTINGS.enabled },
      pointsPer100Taka: {
        type: Number,
        min: 0,
        max: 100,
        default: DEFAULT_LOYALTY_SETTINGS.pointsPer100Taka,
      },
      pointValueTaka: {
        type: Number,
        min: 0.01,
        max: 100,
        default: DEFAULT_LOYALTY_SETTINGS.pointValueTaka,
      },
      minRedeemPoints: {
        type: Number,
        min: 1,
        max: 100000,
        default: DEFAULT_LOYALTY_SETTINGS.minRedeemPoints,
      },
    },
    feedbackSettings: {
      requestAfterVisit: {
        type: Boolean,
        default: DEFAULT_FEEDBACK_SETTINGS.requestAfterVisit,
      },
      showOnPublicPage: {
        type: Boolean,
        default: DEFAULT_FEEDBACK_SETTINGS.showOnPublicPage,
      },
    },
  },
  { timestamps: true }
);

export const Restaurant: Model<IRestaurant> =
  mongoose.models.Restaurant ||
  mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);
