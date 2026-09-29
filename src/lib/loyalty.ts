import { Types } from "mongoose";
import { Customer, LoyaltyTransaction } from "@/models";
import type { LoyaltyTransactionType } from "@/models";
import {
  DEFAULT_LOYALTY_SETTINGS,
  PLANS,
  type LoyaltySettings,
  type SubscriptionPlan,
} from "@/lib/constants";

export function loyaltySettings(
  settings?: Partial<LoyaltySettings> | null
): LoyaltySettings {
  return { ...DEFAULT_LOYALTY_SETTINGS, ...(settings ?? {}) };
}

/**
 * The programme as it actually runs: switched off when the restaurant's
 * plan does not include loyalty, whatever the settings say. Balances stay.
 */
export function effectiveLoyalty(restaurant?: {
  loyaltySettings?: Partial<LoyaltySettings> | null;
  subscriptionPlan?: SubscriptionPlan;
} | null): LoyaltySettings {
  const settings = loyaltySettings(restaurant?.loyaltySettings);
  const planAllows = PLANS[restaurant?.subscriptionPlan ?? "starter"].loyalty;
  return { ...settings, enabled: settings.enabled && planAllows };
}

/** Points earned on a spend: whole points only, rounded down. */
export function pointsForSpend(spend: number, settings: LoyaltySettings) {
  if (!settings.enabled || spend <= 0) return 0;
  return Math.floor((spend / 100) * settings.pointsPer100Taka);
}

/** Taka a number of points takes off a bill. */
export function pointsValue(points: number, settings: LoyaltySettings) {
  return Math.round(points * settings.pointValueTaka * 100) / 100;
}

/**
 * Moves a guest's balance and records why. Spending uses a conditional
 * update so two tills cannot spend the same points; returns null when the
 * balance is too low.
 */
export async function changePoints(entry: {
  restaurantId: string | Types.ObjectId;
  customerId: string | Types.ObjectId;
  type: LoyaltyTransactionType;
  points: number;
  orderId?: Types.ObjectId;
  note?: string;
  actorId?: string | Types.ObjectId;
}) {
  if (!Number.isInteger(entry.points) || entry.points === 0) return null;

  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(entry.customerId),
    restaurantId: new Types.ObjectId(entry.restaurantId),
  };
  if (entry.points < 0) filter.loyaltyPoints = { $gte: -entry.points };

  const customer = await Customer.findOneAndUpdate(
    filter,
    { $inc: { loyaltyPoints: entry.points } },
    { new: true }
  )
    .select("loyaltyPoints")
    .lean();
  if (!customer) return null;

  const transaction = await LoyaltyTransaction.create({
    restaurantId: new Types.ObjectId(entry.restaurantId),
    customerId: new Types.ObjectId(entry.customerId),
    type: entry.type,
    points: entry.points,
    balanceAfter: customer.loyaltyPoints,
    orderId: entry.orderId,
    note: entry.note,
    actorId: entry.actorId ? new Types.ObjectId(entry.actorId) : undefined,
  });

  return { balance: customer.loyaltyPoints, transaction };
}
