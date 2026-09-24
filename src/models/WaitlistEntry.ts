import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const WAITLIST_STATUSES = ["waiting", "seated", "left"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

/** A party waiting for a table, usually a walk-in on a busy night. */
export interface IWaitlistEntry extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  /** The Dhaka day this party is waiting on (UTC midnight). */
  date: Date;
  name: string;
  phone?: string;
  guests: number;
  /** Wait time quoted to the guest, in minutes. */
  quotedMinutes?: number;
  notes?: string;
  status: WaitlistStatus;
  reservationId?: Types.ObjectId;
  seatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistEntrySchema = new Schema<IWaitlistEntry>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    guests: { type: Number, required: true, min: 1, max: 50 },
    quotedMinutes: { type: Number, min: 0, max: 600 },
    notes: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: WAITLIST_STATUSES,
      default: "waiting",
      index: true,
    },
    reservationId: { type: Schema.Types.ObjectId, ref: "Reservation" },
    seatedAt: { type: Date },
  },
  { timestamps: true }
);

WaitlistEntrySchema.index({ branchId: 1, date: 1, status: 1 });

export const WaitlistEntry: Model<IWaitlistEntry> =
  mongoose.models.WaitlistEntry ||
  mongoose.model<IWaitlistEntry>("WaitlistEntry", WaitlistEntrySchema);
