import type { Types } from "mongoose";
import { Branch, Customer, Restaurant } from "@/models";
import { bookingManageUrl } from "@/lib/booking-token";
import { dateToDayKey } from "@/lib/dates";
import { sendEmail } from "@/lib/email/send";
import {
  bookingApprovedEmail,
  bookingCancelledEmail,
  bookingReceivedEmail,
  bookingReminderEmail,
  type BookingEmailData,
} from "@/lib/email/templates";

/** Walk-ins get a placeholder address; never email those. */
function isRealEmail(email: string) {
  return !!email && !email.endsWith("@walk-in.dineflow");
}

export function appOrigin(fallback?: string) {
  return process.env.APP_URL ?? fallback ?? "http://localhost:3000";
}

interface ReservationLike {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  customerId: Types.ObjectId;
  date: Date;
  time: string;
  guests: number;
}

/** Gathers everything a booking email needs. Returns null when we should not send. */
export async function bookingEmailData(
  reservation: ReservationLike,
  origin?: string
): Promise<(BookingEmailData & { to: string }) | null> {
  const [customer, branch, restaurant] = await Promise.all([
    Customer.findById(reservation.customerId).select("name email").lean(),
    Branch.findById(reservation.branchId).select("name address contactInfo").lean(),
    Restaurant.findById(reservation.restaurantId).select("name").lean(),
  ]);

  if (!customer || !branch || !restaurant) return null;
  if (!isRealEmail(customer.email)) return null;

  return {
    to: customer.email,
    guestName: customer.name,
    restaurantName: restaurant.name,
    branchName: branch.name,
    branchAddress: `${branch.address.street}, ${branch.address.city}`,
    branchPhone: branch.contactInfo?.phone,
    date: dateToDayKey(reservation.date),
    time: reservation.time,
    guests: reservation.guests,
    manageUrl: bookingManageUrl(reservation._id.toString(), appOrigin(origin)),
  };
}

export async function sendBookingReceived(
  reservation: ReservationLike,
  confirmed: boolean,
  origin?: string
) {
  const data = await bookingEmailData(reservation, origin);
  if (!data) return;
  const template = bookingReceivedEmail(data, confirmed);
  await sendEmail({ to: data.to, ...template });
}

export async function sendBookingApproved(
  reservation: ReservationLike,
  origin?: string
) {
  const data = await bookingEmailData(reservation, origin);
  if (!data) return;
  const template = bookingApprovedEmail(data);
  await sendEmail({ to: data.to, ...template });
}

export async function sendBookingCancelled(
  reservation: ReservationLike,
  reason: "rejected" | "cancelled",
  origin?: string
) {
  const data = await bookingEmailData(reservation, origin);
  if (!data) return;
  const template = bookingCancelledEmail(data, reason);
  await sendEmail({ to: data.to, ...template });
}

export async function sendBookingReminder(reservation: ReservationLike) {
  const data = await bookingEmailData(reservation);
  if (!data) return false;
  const template = bookingReminderEmail(data);
  const result = await sendEmail({ to: data.to, ...template });
  return result.provider === "console" || result.sent;
}
