import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { ROLES, STAFF_SHIFTS, type Role } from "@/lib/constants";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: Role;
  restaurantId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  shift?: (typeof STAFF_SHIFTS)[number];
  position?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "customer", index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    shift: { type: String, enum: STAFF_SHIFTS },
    position: { type: String, trim: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ restaurantId: 1, role: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
