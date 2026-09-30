import { randomBytes } from "crypto";
import { Types } from "mongoose";
import {
  Restaurant,
  SubscriptionPayment,
  User,
  nextSequence,
  type ISubscriptionPayment,
} from "@/models";
import { ApiError } from "@/lib/api-error";
import { PLANS, type BillingPeriod, type SubscriptionPlan } from "@/lib/constants";
import { extendSubscription, planPrice } from "@/lib/subscription";
import {
  createSession,
  gatewayConfig,
  isSuccessfulValidation,
  validatePayment,
} from "@/lib/sslcommerz";
import { recordActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email/send";
import { subscriptionReceiptEmail } from "@/lib/email/templates";
import { appOrigin } from "@/lib/email/booking-emails";
import { formatCurrency } from "@/lib/utils";
import { logger } from "@/lib/logger";

/**
 * Subscription payments: start a checkout, then settle it once SSLCommerz
 * confirms. The owner's browser coming back and SSLCommerz's IPN call can
 * arrive in either order, or both at once — settling is idempotent.
 */

function newTranId() {
  return `DF${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function startCheckout(input: {
  restaurantId: string;
  userId: string;
  plan: SubscriptionPlan;
  period: BillingPeriod;
  origin: string;
}) {
  const config = gatewayConfig();
  if (!config) {
    throw new ApiError("Online payment is not set up on this server yet", 503);
  }
  if (!PLANS[input.plan].selfServe) {
    throw new ApiError("Enterprise is arranged with our sales team — please contact us", 400);
  }
  const amount = planPrice(input.plan, input.period);
  if (!amount) throw new ApiError("This plan cannot be bought online", 400);

  const [restaurant, user] = await Promise.all([
    Restaurant.findById(input.restaurantId).select("name").lean(),
    User.findById(input.userId).select("name email phone").lean(),
  ]);
  if (!restaurant || !user) throw new ApiError("Restaurant not found", 404);

  const payment = await SubscriptionPayment.create({
    restaurantId: restaurant._id,
    plan: input.plan,
    period: input.period,
    amount,
    tranId: newTranId(),
    initiatedBy: user._id,
  });

  const base = `${appOrigin(input.origin).replace(/\/$/, "")}/api/billing/sslcommerz`;
  try {
    return await createSession(config, {
      tranId: payment.tranId,
      amount,
      productName: `DineFlow ${PLANS[input.plan].name} (${input.period}) — ${restaurant.name}`,
      customer: { name: user.name, email: user.email, phone: user.phone },
      successUrl: `${base}/return?result=success`,
      failUrl: `${base}/return?result=fail`,
      cancelUrl: `${base}/return?result=cancel`,
      ipnUrl: `${base}/ipn`,
    });
  } catch (error) {
    payment.status = "failed";
    payment.failureReason = "Could not open the payment page";
    await payment.save();
    logger.error("SSLCommerz session failed", { error });
    throw new ApiError("The payment page could not be opened. Please try again.", 502);
  }
}

export type SettleResult = "paid" | "review" | "failed" | "unknown";

/** Confirms a payment with SSLCommerz and, if it is real, extends access. */
export async function settlePayment(tranId: string, valId: string): Promise<SettleResult> {
  const config = gatewayConfig();
  if (!config) return "unknown";

  const payment = await SubscriptionPayment.findOne({ tranId });
  if (!payment) return "unknown";
  if (payment.status === "paid") return "paid";

  const validation = await validatePayment(config, valId);
  if (!validation || !isSuccessfulValidation(validation)) {
    await closePayment(tranId, "failed", "SSLCommerz did not confirm the payment");
    return "failed";
  }

  // The confirmation must be for this payment, in full, in taka.
  if (
    validation.tranId !== payment.tranId ||
    validation.currency !== "BDT" ||
    Math.abs(validation.amount - payment.amount) > 0.01
  ) {
    await closePayment(tranId, "failed", "Payment details did not match");
    logger.error("SSLCommerz validation mismatch", { tranId, validation });
    return "failed";
  }

  const gatewayDetails = {
    valId: validation.valId,
    bankTranId: validation.bankTranId,
    cardType: validation.cardType,
    riskLevel: validation.riskLevel,
    riskTitle: validation.riskTitle,
  };

  if (validation.riskLevel === "1") {
    await SubscriptionPayment.updateOne(
      { _id: payment._id, status: { $ne: "paid" } },
      { $set: { status: "review", gatewayDetails } }
    );
    return "review";
  }

  // Whether this call or a concurrent one applied it, the payment is paid.
  await applyPayment(payment._id, gatewayDetails);
  return "paid";
}

/**
 * Marks a confirmed payment paid and extends the restaurant. Exactly one
 * caller wins the claim; the others see it already paid. Also used when
 * DineFlow staff approve a payment held for review.
 */
export async function applyPayment(
  paymentId: Types.ObjectId,
  gatewayDetails?: ISubscriptionPayment["gatewayDetails"]
) {
  const now = new Date();
  const payment = await SubscriptionPayment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ["pending", "failed", "cancelled", "review"] } },
    {
      $set: { status: "paid", paidAt: now, ...(gatewayDetails ? { gatewayDetails } : {}) },
      $unset: { failureReason: "" },
    },
    { new: true }
  );
  if (!payment) return false;

  // Extend from the restaurant's current state; retry if another payment
  // for the same restaurant moved it in the meantime.
  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const restaurant = await Restaurant.findById(payment.restaurantId)
      .select("subscriptionPlan subscriptionEndsAt onTrial createdAt")
      .lean();
    if (!restaurant) break;

    const next = extendSubscription(restaurant, payment, now);
    const updated = await Restaurant.updateOne(
      {
        _id: restaurant._id,
        subscriptionEndsAt: restaurant.subscriptionEndsAt ?? { $exists: false },
      },
      {
        $set: {
          subscriptionPlan: next.plan,
          subscriptionEndsAt: next.periodEnd,
          onTrial: false,
        },
      }
    );
    if (updated.modifiedCount === 1) {
      periodStart = next.periodStart;
      periodEnd = next.periodEnd;
      break;
    }
  }

  const year = now.getUTCFullYear();
  payment.invoiceNumber = `DF-${year}-${String(await nextSequence(`invoice-${year}`)).padStart(6, "0")}`;
  payment.periodStart = periodStart;
  payment.periodEnd = periodEnd;
  await payment.save();

  await recordActivity({
    restaurantId: payment.restaurantId,
    actorId: payment.initiatedBy,
    action: "billing.paid",
    targetType: "subscription",
    targetId: payment._id,
    summary: `Paid ${formatCurrency(payment.amount)} for ${PLANS[payment.plan].name} (${payment.period}) — invoice ${payment.invoiceNumber}`,
  });

  await sendReceipt(payment);
  return true;
}

async function sendReceipt(payment: ISubscriptionPayment) {
  try {
    const restaurant = await Restaurant.findById(payment.restaurantId)
      .select("name ownerId")
      .lean();
    const owner = restaurant
      ? await User.findById(restaurant.ownerId).select("name email").lean()
      : null;
    if (!restaurant || !owner) return;

    await sendEmail({
      to: owner.email,
      ...subscriptionReceiptEmail({
        name: owner.name,
        restaurantName: restaurant.name,
        planName: PLANS[payment.plan].name,
        period: payment.period,
        amount: payment.amount,
        invoiceNumber: payment.invoiceNumber!,
        paidUntil: payment.periodEnd,
        url: `${appOrigin()}/dashboard/billing/invoices/${payment._id}`,
      }),
    });
  } catch (error) {
    logger.error("Subscription receipt email failed", { error });
  }
}

/** Records a failed or cancelled attempt; never overwrites a paid one. */
export async function closePayment(
  tranId: string,
  status: "failed" | "cancelled",
  reason?: string
) {
  await SubscriptionPayment.updateOne(
    { tranId, status: "pending" },
    { $set: { status, failureReason: reason } }
  );
}
