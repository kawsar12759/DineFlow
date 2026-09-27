import { Types } from "mongoose";
import { Order, type IOrder } from "@/models";
import { computeBill } from "@/lib/billing";
import type { BillingSettings } from "@/lib/constants";

/** Recomputes and stores the money on an order from its current lines. */
export function applyTotals(order: IOrder, billing?: BillingSettings) {
  if (billing) {
    order.vatPercent = billing.vatPercent;
    order.serviceChargePercent = billing.serviceChargePercent;
  }

  const lines = order.items.map((item) => ({
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    voided: item.voided,
  }));
  const charges = {
    discountAmount: order.discountAmount,
    loyaltyDiscount: order.loyaltyDiscount ?? 0,
    vatPercent: order.vatPercent,
    serviceChargePercent: order.serviceChargePercent,
  };
  let totals = computeBill(lines, charges);

  // Points are redeemed whole: if the bill shrank below their value (a dish
  // removed, a bigger discount), drop the redemption instead of silently
  // spending points for less than they are worth.
  if (totals.loyaltyDiscount < charges.loyaltyDiscount) {
    order.loyaltyPointsRedeemed = 0;
    order.loyaltyDiscount = 0;
    totals = computeBill(lines, { ...charges, loyaltyDiscount: 0 });
  }

  order.subtotal = totals.subtotal;
  order.discountAmount = totals.discountAmount;
  order.serviceChargeAmount = totals.serviceChargeAmount;
  order.vatAmount = totals.vatAmount;
  order.total = totals.total;
  return totals;
}

/**
 * Next ticket number for a branch on a service day. Numbers restart daily,
 * which is what staff expect when they call out "order 12".
 */
export async function nextOrderNumber(
  branchId: Types.ObjectId,
  serviceDate: Date
) {
  const last = await Order.findOne({ branchId, serviceDate })
    .sort({ orderNumber: -1 })
    .select("orderNumber")
    .lean();
  return (last?.orderNumber ?? 0) + 1;
}
