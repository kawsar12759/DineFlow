export const ROLES = [
  "super_admin",
  "owner",
  "manager",
  "staff",
  "customer",
] as const;

export type Role = (typeof ROLES)[number];

export const DASHBOARD_ROLES: Role[] = [
  "super_admin",
  "owner",
  "manager",
  "staff",
];

export const RESERVATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Statuses that hold seats at a branch. */
export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "approved",
  "seated",
];

/** Allowed reservation lifecycle moves. */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["seated", "cancelled", "no_show"],
  rejected: [],
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Fallback booking rules; each restaurant can override them in Settings. */
export const DEFAULT_BOOKING_SETTINGS = {
  /** How long a party holds its seats. */
  diningDurationMinutes: 90,
  /** Gap between bookable times. */
  slotIntervalMinutes: 30,
  maxPartySize: 20,
  /** How soon before a slot a guest may still book it. */
  minLeadMinutes: 60,
  maxDaysAhead: 60,
  /** Confirm public bookings automatically instead of leaving them pending. */
  autoApprove: false,
} as const;

/** Bill defaults; Bangladeshi restaurants usually charge 5% VAT and 10% service. */
export const DEFAULT_BILLING_SETTINGS = {
  vatPercent: 5,
  serviceChargePercent: 10,
} as const;

/**
 * Loyalty is opt-in per restaurant. Guests earn points on what they pay
 * for food (after discounts, before VAT and service) and spend them as
 * taka off a later bill.
 */
export const DEFAULT_LOYALTY_SETTINGS = {
  enabled: false,
  /** Points earned for every ৳100 spent. */
  pointsPer100Taka: 5,
  /** What one point is worth off a bill, in BDT. */
  pointValueTaka: 1,
  /** Smallest number of points a guest may redeem at once. */
  minRedeemPoints: 100,
};

export type LoyaltySettings = {
  enabled: boolean;
  pointsPer100Taka: number;
  pointValueTaka: number;
  minRedeemPoints: number;
};

/** After a visit, guests are emailed a link to rate it. */
export const DEFAULT_FEEDBACK_SETTINGS = {
  requestAfterVisit: true,
  /** Show the average rating and guest comments on the public page. */
  showOnPublicPage: true,
};

export type FeedbackSettings = {
  requestAfterVisit: boolean;
  showOnPublicPage: boolean;
};

/** How long after a visit the feedback link keeps working. */
export const FEEDBACK_WINDOW_DAYS = 30;

export type BillingSettings = {
  vatPercent: number;
  serviceChargePercent: number;
};

export type BookingSettings = {
  -readonly [K in keyof typeof DEFAULT_BOOKING_SETTINGS]: typeof DEFAULT_BOOKING_SETTINGS[K] extends boolean
    ? boolean
    : number;
};

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface OpeningHour {
  /** 0 = Sunday. */
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

/** Open every day 12:00-23:00 — the common pattern for Dhaka restaurants. */
export const DEFAULT_OPENING_HOURS: OpeningHour[] = DAYS_OF_WEEK.map(
  (_, day) => ({ day, open: "12:00", close: "23:00", closed: false })
);

export const RESERVATION_STATUS_META: Record<
  ReservationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60",
  },
  seated: {
    label: "Seated",
    className: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
  },
  completed: {
    label: "Completed",
    className: "bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/60",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-50 dark:bg-slate-950/40 text-slate-500 border-slate-200 dark:border-slate-800/60",
  },
  no_show: {
    label: "No-show",
    className: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60",
  },
};

export const MENU_CATEGORIES = [
  "Starters",
  "Mains",
  "Desserts",
  "Drinks",
  "Sides",
  "Specials",
] as const;

export const ALLERGENS = [
  "gluten",
  "dairy",
  "nuts",
  "shellfish",
  "soy",
  "eggs",
  "fish",
  "sesame",
] as const;

export const SUBSCRIPTION_PLANS = ["starter", "growth", "enterprise"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/** Monthly subscription price in BDT; null means custom (sales-led). */
export const PLAN_MONTHLY_PRICE: Record<SubscriptionPlan, number | null> = {
  starter: 2999,
  growth: 7999,
  enterprise: null,
};

export const BILLING_PERIODS = ["monthly", "yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** A year costs ten months: two months free for paying up front. */
export const YEARLY_MONTHS_CHARGED = 10;

export interface PlanDefinition {
  name: string;
  /** null = unlimited. */
  maxBranches: number | null;
  /** Managers and staff; the owner is not counted. null = unlimited. */
  maxStaff: number | null;
  /** How far back analytics charts can look, in days. */
  analyticsDays: number;
  loyalty: boolean;
  /** Can be bought online; Enterprise is arranged with sales. */
  selfServe: boolean;
}

/**
 * What each plan includes. The pricing page and the server-side limit
 * checks both read from here, so they cannot disagree.
 */
export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  starter: {
    name: "Starter",
    maxBranches: 1,
    maxStaff: 2,
    analyticsDays: 30,
    loyalty: false,
    selfServe: true,
  },
  growth: {
    name: "Growth",
    maxBranches: 10,
    maxStaff: null,
    analyticsDays: 90,
    loyalty: true,
    selfServe: true,
  },
  enterprise: {
    name: "Enterprise",
    maxBranches: null,
    maxStaff: null,
    analyticsDays: 90,
    loyalty: true,
    selfServe: false,
  },
};

/** New restaurants get this long free, on the Starter plan. */
export const TRIAL_DAYS = 14;
/** After a paid period ends, the restaurant keeps working this long. */
export const GRACE_DAYS = 7;

export const ANALYTICS_EVENT_TYPES = [
  "reservation_created",
  "reservation_status_changed",
  "menu_item_viewed",
  "menu_item_created",
  "customer_created",
  "branch_created",
  "revenue_recorded",
  "system",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const STAFF_SHIFTS = ["morning", "afternoon", "evening", "night"] as const;

export const APP_NAME = "DineFlow";

// DineFlow serves restaurants in Bangladesh only — money, dates and
// addresses are localised app-wide from these constants.
export const COUNTRY = "Bangladesh";
export const CURRENCY = "BDT";
export const CURRENCY_SYMBOL = "৳";
export const TIMEZONE = "Asia/Dhaka";
export const LOCALE = "en-GB";
export const PHONE_PLACEHOLDER = "+880 1712-345678";

export const BD_DIVISIONS = [
  "Barishal",
  "Chattogram",
  "Dhaka",
  "Khulna",
  "Mymensingh",
  "Rajshahi",
  "Rangpur",
  "Sylhet",
] as const;
export const PAGE_SIZE = 10;

/** How each payment method is written for people (bKash is a brand name). */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  other: "Other",
};
