import { addMonths } from "date-fns";
import {
  GRACE_DAYS,
  PLAN_MONTHLY_PRICE,
  PLANS,
  TRIAL_DAYS,
  YEARLY_MONTHS_CHARGED,
  type BillingPeriod,
  type SubscriptionPlan,
} from "@/lib/constants";

/**
 * Subscription status is worked out from dates rather than stored, so it is
 * always current without a job flipping flags at midnight:
 *
 *   trial / active ──endsAt──▶ grace (paid plans only) ──+7 days──▶ expired
 *
 * Suspension by DineFlow staff overrides everything.
 */

const DAY_MS = 86_400_000;

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "suspended";

export interface SubscriptionFields {
  subscriptionPlan: SubscriptionPlan;
  subscriptionEndsAt?: Date | null;
  onTrial?: boolean;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  createdAt?: Date;
}

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  onTrial: boolean;
  endsAt: Date;
  /** When the restaurant stops working if nobody pays. */
  cutoffAt: Date;
  /** Whole days until `endsAt` (negative once past). */
  daysLeft: number;
  /** Changes are refused; reading and paying still work. */
  readOnly: boolean;
  /** The public page takes online bookings. */
  acceptingBookings: boolean;
  suspendedReason?: string;
}

export function planPrice(plan: SubscriptionPlan, period: BillingPeriod) {
  const monthly = PLAN_MONTHLY_PRICE[plan];
  if (monthly === null) return null;
  return period === "yearly" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** Restaurants from before billing existed get a trial counted from sign-up. */
function endsAtOf(fields: SubscriptionFields) {
  if (fields.subscriptionEndsAt) return new Date(fields.subscriptionEndsAt);
  const created = fields.createdAt ? new Date(fields.createdAt).getTime() : Date.now();
  return new Date(created + TRIAL_DAYS * DAY_MS);
}

export function subscriptionState(
  fields: SubscriptionFields,
  now = new Date()
): SubscriptionState {
  const onTrial = fields.onTrial ?? true;
  const endsAt = endsAtOf(fields);
  // A trial has no grace period: there is nothing unpaid to protect.
  const cutoffAt = new Date(endsAt.getTime() + (onTrial ? 0 : GRACE_DAYS * DAY_MS));
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS);

  let status: SubscriptionStatus;
  if (fields.suspendedAt) status = "suspended";
  else if (now < endsAt) status = onTrial ? "trial" : "active";
  else if (now < cutoffAt) status = "grace";
  else status = "expired";

  const working = status !== "expired" && status !== "suspended";
  return {
    plan: fields.subscriptionPlan,
    status,
    onTrial,
    endsAt,
    cutoffAt,
    daysLeft,
    readOnly: !working,
    acceptingBookings: working,
    suspendedReason: fields.suspendedReason ?? undefined,
  };
}

/**
 * The access a new payment buys.
 *
 * - Same plan: added on after the current end, so paying early loses nothing.
 * - Different plan: starts now, and paid time left on the old plan is
 *   converted at the price ratio (a month of Starter left becomes about
 *   11 days of Growth), so nobody pays twice for the same days.
 * - Trial time left is carried over as it is.
 */
export function extendSubscription(
  current: SubscriptionFields,
  purchase: { plan: SubscriptionPlan; period: BillingPeriod },
  now = new Date()
) {
  const endsAt = endsAtOf(current);
  const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
  const onTrial = current.onTrial ?? true;

  let carriedMs = remainingMs;
  if (!onTrial && purchase.plan !== current.subscriptionPlan) {
    const oldPrice = PLAN_MONTHLY_PRICE[current.subscriptionPlan];
    const newPrice = PLAN_MONTHLY_PRICE[purchase.plan];
    if (oldPrice && newPrice) carriedMs = remainingMs * (oldPrice / newPrice);
  }

  const periodStart = new Date(now.getTime() + carriedMs);
  const periodEnd = addMonths(periodStart, purchase.period === "yearly" ? 12 : 1);
  return { plan: purchase.plan, periodStart, periodEnd };
}

export function planAllowsLoyalty(plan: SubscriptionPlan) {
  return PLANS[plan].loyalty;
}

/** "1 branch", "10 branches", "unlimited staff accounts". */
export function formatLimit(value: number | null, noun: string, plural = `${noun}s`) {
  if (value === null) return `unlimited ${plural}`;
  return `${value} ${value === 1 ? noun : plural}`;
}

export type ReminderStage = "7d" | "3d" | "grace" | "expired";

/** Which reminder, if any, a restaurant is due today. */
export function reminderStage(state: SubscriptionState, now = new Date()): ReminderStage | null {
  if (state.status === "suspended") return null;
  if (state.status === "trial" || state.status === "active") {
    if (state.daysLeft <= 3) return "3d";
    if (state.daysLeft <= 7) return "7d";
    return null;
  }
  if (state.status === "grace") return "grace";
  // Only tell them once, soon after it happens — not every day forever.
  if (now.getTime() - state.cutoffAt.getTime() < 7 * DAY_MS) return "expired";
  return null;
}
