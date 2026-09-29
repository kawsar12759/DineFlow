import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import {
  BILLING_PERIODS,
  SUBSCRIPTION_PLANS,
  type BillingPeriod,
  type SubscriptionPlan,
} from "@/lib/constants";

export const SUBSCRIPTION_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  /** SSLCommerz flagged the payment as risky; DineFlow staff decide. */
  "review",
] as const;
export type SubscriptionPaymentStatus =
  (typeof SUBSCRIPTION_PAYMENT_STATUSES)[number];

/** One attempt to pay for a subscription period, and its invoice once paid. */
export interface ISubscriptionPayment extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  plan: SubscriptionPlan;
  period: BillingPeriod;
  /** BDT charged. */
  amount: number;
  /** Our reference sent to SSLCommerz; unique per attempt. */
  tranId: string;
  status: SubscriptionPaymentStatus;
  gateway: "sslcommerz";
  /** Sequential, e.g. "DF-2026-000042"; set when paid. */
  invoiceNumber?: string;
  /** The access this payment bought. */
  periodStart?: Date;
  periodEnd?: Date;
  paidAt?: Date;
  initiatedBy?: Types.ObjectId;
  /** From SSLCommerz's validation service. */
  gatewayDetails?: {
    valId?: string;
    bankTranId?: string;
    cardType?: string;
    riskLevel?: string;
    riskTitle?: string;
  };
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPaymentSchema = new Schema<ISubscriptionPayment>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    plan: { type: String, enum: SUBSCRIPTION_PLANS, required: true },
    period: { type: String, enum: BILLING_PERIODS, required: true },
    amount: { type: Number, required: true, min: 0 },
    tranId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: SUBSCRIPTION_PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    gateway: { type: String, enum: ["sslcommerz"], default: "sslcommerz" },
    invoiceNumber: { type: String, unique: true, sparse: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    paidAt: { type: Date },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    gatewayDetails: {
      valId: { type: String },
      bankTranId: { type: String },
      cardType: { type: String },
      riskLevel: { type: String },
      riskTitle: { type: String },
    },
    failureReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

SubscriptionPaymentSchema.index({ restaurantId: 1, createdAt: -1 });

export const SubscriptionPayment: Model<ISubscriptionPayment> =
  mongoose.models.SubscriptionPayment ||
  mongoose.model<ISubscriptionPayment>(
    "SubscriptionPayment",
    SubscriptionPaymentSchema
  );
