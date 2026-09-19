import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { ALLERGENS, MENU_CATEGORIES } from "@/lib/constants";

export interface IMenuItem extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId?: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  category: (typeof MENU_CATEGORIES)[number];
  image?: string;
  availability: boolean;
  allergens: (typeof ALLERGENS)[number][];
  preparationTime?: number;
  popularityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: MENU_CATEGORIES,
      required: true,
      index: true,
    },
    image: { type: String },
    availability: { type: Boolean, default: true },
    allergens: [{ type: String, enum: ALLERGENS }],
    preparationTime: { type: Number, min: 0 },
    popularityScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MenuItemSchema.index({ restaurantId: 1, category: 1 });
MenuItemSchema.index({ restaurantId: 1, name: "text" });

export const MenuItem: Model<IMenuItem> =
  mongoose.models.MenuItem ||
  mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);
