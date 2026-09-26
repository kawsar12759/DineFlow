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

  const totals = computeBill(
    order.items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      voided: item.voided,
    })),
    {
      discountAmount: order.discountAmount,
      vatPercent: order.vatPercent,
      serviceChargePercent: order.serviceChargePercent,
    }
  );

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
