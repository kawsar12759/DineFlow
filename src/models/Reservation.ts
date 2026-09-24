import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/lib/constants";

export interface IReservation extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  customerId: Types.ObjectId;
  /** Tables holding this booking; empty when the branch has no tables yet. */
  tableIds: Types.ObjectId[];
  date: Date;
  time: string;
  guests: number;
  status: ReservationStatus;
  specialRequests?: string;
  estimatedSpend?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    tableIds: [{ type: Schema.Types.ObjectId, ref: "Table", index: true }],
    date: { type: Date, required: true },
    time: { type: String, required: true },
    guests: { type: Number, required: true, min: 1, max: 50 },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "pending",
      index: true,
    },
    specialRequests: { type: String, trim: true },
    estimatedSpend: { type: Number, min: 0 },
  },
  { timestamps: true }
);

ReservationSchema.index({ restaurantId: 1, date: 1 });
ReservationSchema.index({ restaurantId: 1, status: 1, date: 1 });

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation ||
  mongoose.model<IReservation>("Reservation", ReservationSchema);
