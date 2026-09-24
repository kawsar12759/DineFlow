import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/** A physical table at a branch. Bookings are assigned to tables when a
 *  branch has any; branches without tables fall back to total seat capacity. */
export interface ITable extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  /** Label guests and staff use, e.g. "T1" or "Terrace 3". */
  name: string;
  seats: number;
  zone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
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
    name: { type: String, required: true, trim: true },
    seats: { type: Number, required: true, min: 1, max: 30 },
    zone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Table names are unique within a branch.
TableSchema.index({ branchId: 1, name: 1 }, { unique: true });

export const Table: Model<ITable> =
  mongoose.models.Table || mongoose.model<ITable>("Table", TableSchema);
