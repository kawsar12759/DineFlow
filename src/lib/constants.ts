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
  approved: ["seated", "cancelled"],
  rejected: [],
  seated: ["completed"],
  completed: [],
  cancelled: [],
};

/** How long a party holds its seats, used for capacity checks. */
export const DINING_DURATION_MINUTES = 90;

export const RESERVATION_STATUS_META: Record<
  ReservationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  seated: {
    label: "Seated",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  completed: {
    label: "Completed",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-50 text-slate-500 border-slate-200",
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
