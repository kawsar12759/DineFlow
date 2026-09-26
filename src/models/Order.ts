import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const ORDER_STATUSES = ["open", "paid", "void"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Kitchen progress of a single line. */
export const ORDER_ITEM_STATUSES = [
  "queued",
  "preparing",
  "ready",
  "served",
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "bkash",
  "nagad",
  "rocket",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface IOrderItem {
  _id: Types.ObjectId;
  menuItemId?: Types.ObjectId;
  /** Name and price are copied when ordered, so later menu edits don't rewrite history. */
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  status: OrderItemStatus;
  voided: boolean;
  sentAt?: Date;
  readyAt?: Date;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  /** Per-branch, per-day ticket number shown to staff. */
  orderNumber: number;
  /** The Dhaka service day (UTC midnight), so numbering resets daily. */
  serviceDate: Date;
  reservationId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  tableIds: Types.ObjectId[];
  guests?: number;
  items: IOrderItem[];
  status: OrderStatus;
  discountAmount: number;
  vatPercent: number;
  serviceChargePercent: number;
  subtotal: number;
  vatAmount: number;
  serviceChargeAmount: number;
  total: number;
  payment?: {
    method: PaymentMethod;
    /** The bill total that was settled. */
    amount: number;
    /** Cash handed over, when more than the bill. */
    tendered?: number;
    changeGiven?: number;
    reference?: string;
    paidAt: Date;
    receivedBy?: Types.ObjectId;
  };
  openedBy?: Types.ObjectId;
  closedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem" },
  name: { type: String, required: true, trim: true },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 99 },
  notes: { type: String, trim: true, maxlength: 200 },
  status: { type: String, enum: ORDER_ITEM_STATUSES, default: "queued" },
  voided: { type: Boolean, default: false },
  sentAt: { type: Date },
  readyAt: { type: Date },
});

const OrderSchema = new Schema<IOrder>(
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
    orderNumber: { type: Number, required: true },
    serviceDate: { type: Date, required: true, index: true },
    reservationId: { type: Schema.Types.ObjectId, ref: "Reservation", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    tableIds: [{ type: Schema.Types.ObjectId, ref: "Table" }],
    guests: { type: Number, min: 1, max: 50 },
    items: { type: [OrderItemSchema], default: [] },
    status: { type: String, enum: ORDER_STATUSES, default: "open", index: true },
    discountAmount: { type: Number, default: 0, min: 0 },
    vatPercent: { type: Number, default: 0, min: 0, max: 100 },
    serviceChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    subtotal: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    serviceChargeAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS },
      amount: { type: Number, min: 0 },
      tendered: { type: Number, min: 0 },
      changeGiven: { type: Number, min: 0 },
      reference: { type: String, trim: true },
      paidAt: { type: Date },
      receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    openedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

OrderSchema.index({ branchId: 1, serviceDate: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
