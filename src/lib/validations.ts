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

// ---------- Branches ----------

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
  openingHours: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const branchUpdateSchema = branchSchema.partial();

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
