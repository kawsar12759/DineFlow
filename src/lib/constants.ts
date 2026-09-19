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
export const PAGE_SIZE = 10;
