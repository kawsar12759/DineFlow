import { z } from "zod";
import {
  ALLERGENS,
  MENU_CATEGORIES,
  RESERVATION_STATUSES,
  STAFF_SHIFTS,
} from "@/lib/constants";
import { isDayKey } from "@/lib/dates";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const dayKey = z.string().refine(isDayKey, { message: "Invalid date (YYYY-MM-DD)" });

// ---------- Auth ----------

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  restaurantName: z
    .string()
    .min(2, "Restaurant name must be at least 2 characters")
    .max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ---------- Restaurant settings ----------

const time24 = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)");

export const restaurantProfileSchema = z.object({
  name: z.string().min(2, "Restaurant name is required").max(100),
  cuisine: z.string().max(60).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  logo: z.string().url("Enter a valid image URL").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
});

export const bookingSettingsSchema = z.object({
  diningDurationMinutes: z.coerce.number().int().min(30).max(300),
  slotIntervalMinutes: z.coerce.number().int().min(15).max(60),
  maxPartySize: z.coerce.number().int().min(1).max(50),
  minLeadMinutes: z.coerce.number().int().min(0).max(10080),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  autoApprove: z.boolean(),
});

export const settingsUpdateSchema = z.object({
  profile: restaurantProfileSchema.partial().optional(),
  bookingSettings: bookingSettingsSchema.partial().optional(),
});

// ---------- Branches ----------

const openingHoursSchema = z
  .array(
    z.object({
      day: z.coerce.number().int().min(0).max(6),
      open: time24,
      close: time24,
      closed: z.boolean().default(false),
    })
  )
  .length(7, "Provide hours for all seven days");

const closuresSchema = z.array(
  z.object({
    date: dayKey,
    reason: z.string().max(120).optional().or(z.literal("")),
  })
);

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name is required").max(100),
  address: z.object({
    street: z.string().min(2, "Street is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().min(2, "Country is required").default("Bangladesh"),
  }),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  contactInfo: z
    .object({
      phone: z.string().optional(),
      email: z.string().email("Invalid email").optional().or(z.literal("")),
    })
    .optional(),
  hours: openingHoursSchema.optional(),
  closures: closuresSchema.optional(),
  image: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const branchUpdateSchema = branchSchema.partial();

// ---------- Tables ----------

export const tableSchema = z.object({
  branchId: objectId,
  name: z.string().min(1, "Table name is required").max(30),
  seats: z.coerce.number().int().min(1, "At least 1 seat").max(30),
  zone: z.string().max(40).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const tableUpdateSchema = tableSchema.partial().omit({ branchId: true });

// ---------- Menu items ----------

export const menuItemSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  category: z.enum(MENU_CATEGORIES),
  branchId: objectId.optional().or(z.literal("")),
  image: z.string().url().optional().or(z.literal("")),
  availability: z.boolean().default(true),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  preparationTime: z.coerce.number().int().min(0).optional(),
});

export const menuItemUpdateSchema = menuItemSchema.partial();

// ---------- Reservations ----------

export const reservationSchema = z.object({
  branchId: objectId,
  /** Walk-ins are created already seated; online bookings start pending. */
  status: z.enum(["pending", "approved", "seated"]).optional(),
  customerId: objectId.optional(),
  customer: z
    .object({
      name: z.string().min(2, "Name is required"),
      email: z.string().email("Invalid email"),
      phone: z.string().optional(),
    })
    .optional(),
  date: dayKey,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)"),
  guests: z.coerce.number().int().min(1).max(50),
  specialRequests: z.string().max(500).optional(),
  estimatedSpend: z.coerce.number().min(0).optional(),
});

export const reservationStatusSchema = z.object({
  status: z.enum(RESERVATION_STATUSES),
});

/** Status change, reschedule and/or table move — at least one of them. */
export const reservationUpdateSchema = z
  .object({
    status: z.enum(RESERVATION_STATUSES).optional(),
    date: dayKey.optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)")
      .optional(),
    guests: z.coerce.number().int().min(1).max(50).optional(),
    tableIds: z.array(objectId).max(4).optional(),
    estimatedSpend: z.coerce.number().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

// Public booking form (marketing site) — includes restaurant selection
export const publicReservationSchema = z.object({
  restaurantId: objectId,
  branchId: objectId,
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  date: dayKey,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)"),
  guests: z.coerce.number().int().min(1).max(50),
  specialRequests: z.string().max(500).optional(),
});

// ---------- Waitlist ----------

export const waitlistSchema = z.object({
  branchId: objectId,
  date: dayKey,
  name: z.string().min(2, "Name is required").max(80),
  phone: z.string().max(30).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(50),
  quotedMinutes: z.coerce.number().int().min(0).max(600).optional(),
  notes: z.string().max(300).optional().or(z.literal("")),
});

export const waitlistUpdateSchema = z.object({
  status: z.enum(["waiting", "seated", "left"]).optional(),
  quotedMinutes: z.coerce.number().int().min(0).max(600).optional(),
  /** Time to seat the party at when marking it seated; defaults to now. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)")
    .optional(),
});

/** What a guest may change through their booking link. */
export const publicBookingUpdateSchema = z
  .object({
    action: z.enum(["cancel", "reschedule"]),
    date: dayKey.optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)")
      .optional(),
    guests: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine(
    (value) =>
      value.action === "cancel" ||
      value.date !== undefined ||
      value.time !== undefined ||
      value.guests !== undefined,
    { message: "Choose a new date, time or party size" }
  );

// ---------- Customers ----------

export const customerSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional(),
});

export const customerUpdateSchema = customerSchema.partial();

export const visitSchema = z.object({
  date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date",
  }),
  branchId: objectId.optional(),
  spend: z.coerce.number().min(0).default(0),
  guests: z.coerce.number().int().min(1).default(1),
});

// ---------- Staff ----------

export const staffSchema = z.object({
  name: z.string().min(2, "Name is required").max(80),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["manager", "staff"]),
  branchId: objectId.optional().or(z.literal("")),
  shift: z.enum(STAFF_SHIFTS).optional(),
  position: z.string().max(80).optional(),
  phone: z.string().optional(),
});

export const staffUpdateSchema = staffSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(8).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
  });

// ---------- Profile ----------

export const profileUpdateSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(80).optional(),
    phone: z.string().max(30).optional().or(z.literal("")),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (value) => !value.newPassword || !!value.currentPassword,
    { message: "Enter your current password", path: ["currentPassword"] }
  );

// ---------- Contact ----------

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  subject: z.string().min(2, "Subject is required").max(150),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type PublicReservationInput = z.infer<typeof publicReservationSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type StaffInput = z.infer<typeof staffSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type TableInput = z.infer<typeof tableSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type RestaurantProfileInput = z.infer<typeof restaurantProfileSchema>;
export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;
