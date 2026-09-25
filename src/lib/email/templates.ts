import { APP_NAME } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/utils";

/**
 * Plain, table-free HTML that survives most email clients, plus a text
 * version for those that prefer it.
 */

interface Template {
  subject: string;
  html: string;
  text: string;
}

function layout({
  heading,
  intro,
  details,
  cta,
  footer,
}: {
  heading: string;
  intro: string;
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  footer?: string;
}) {
  const rows = (details ?? [])
    .map(
      (detail) =>
        `<p style="margin:0 0 6px;font-size:14px;color:#334155"><strong style="color:#0f172a">${detail.label}:</strong> ${detail.value}</p>`
    )
    .join("");

  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block">${cta.label}</a></p>
       <p style="margin:0 0 16px;font-size:12px;color:#64748b">Or paste this link into your browser:<br>${cta.url}</p>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${heading}</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#334155">${intro}</p>
    ${rows}
    ${button}
    ${footer ? `<p style="margin:18px 0 0;font-size:12px;color:#64748b">${footer}</p>` : ""}
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#94a3b8;text-align:center">Sent by ${APP_NAME}</p>
</body></html>`;
}

function textVersion({
  heading,
  intro,
  details,
  cta,
  footer,
}: {
  heading: string;
  intro: string;
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  footer?: string;
}) {
  return [
    heading,
    "",
    intro,
    "",
    ...(details ?? []).map((detail) => `${detail.label}: ${detail.value}`),
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(footer ? ["", footer] : []),
  ].join("\n");
}

export interface BookingEmailData {
  guestName: string;
  restaurantName: string;
  branchName: string;
  branchAddress: string;
  branchPhone?: string;
  /** Day key, e.g. "2026-09-25". */
  date: string;
  time: string;
  guests: number;
  manageUrl: string;
}

function bookingDetails(data: BookingEmailData) {
  return [
    { label: "Restaurant", value: `${data.restaurantName} — ${data.branchName}` },
    { label: "When", value: `${formatDate(`${data.date}T00:00:00Z`)} at ${formatTime(data.time)}` },
    { label: "Party", value: `${data.guests} ${data.guests === 1 ? "guest" : "guests"}` },
    { label: "Address", value: data.branchAddress },
    ...(data.branchPhone ? [{ label: "Phone", value: data.branchPhone }] : []),
  ];
}

/** Sent as soon as a guest books. */
export function bookingReceivedEmail(
  data: BookingEmailData,
  confirmed: boolean
): Template {
  const content = {
    heading: confirmed ? "Your table is confirmed" : "We have your request",
    intro: confirmed
      ? `Hi ${data.guestName}, your table at ${data.restaurantName} is confirmed. We look forward to seeing you.`
      : `Hi ${data.guestName}, thanks for your booking request. ${data.restaurantName} will confirm it shortly.`,
    details: bookingDetails(data),
    cta: { label: "View or change your booking", url: data.manageUrl },
    footer: "Plans changed? Use the link above to move or cancel your booking.",
  };

  return {
    subject: confirmed
      ? `Table confirmed at ${data.restaurantName}`
      : `Booking request received — ${data.restaurantName}`,
    html: layout(content),
    text: textVersion(content),
  };
}

/** Sent when staff approve a pending request. */
export function bookingApprovedEmail(data: BookingEmailData): Template {
  const content = {
    heading: "Your table is confirmed",
    intro: `Hi ${data.guestName}, ${data.restaurantName} has confirmed your booking.`,
    details: bookingDetails(data),
    cta: { label: "View or change your booking", url: data.manageUrl },
  };

  return {
    subject: `Table confirmed at ${data.restaurantName}`,
    html: layout(content),
    text: textVersion(content),
  };
}

/** Sent when staff reject or cancel a booking. */
export function bookingCancelledEmail(
  data: BookingEmailData,
  reason: "rejected" | "cancelled"
): Template {
  const content = {
    heading:
      reason === "rejected" ? "We could not take this booking" : "Your booking is cancelled",
    intro:
      reason === "rejected"
        ? `Hi ${data.guestName}, unfortunately ${data.restaurantName} cannot take your booking for this time.`
        : `Hi ${data.guestName}, your booking at ${data.restaurantName} has been cancelled.`,
    details: bookingDetails(data),
    footer: data.branchPhone
      ? `To find another time, call ${data.branchPhone} or book again online.`
      : "You are welcome to book another time online.",
  };

  return {
    subject:
      reason === "rejected"
        ? `Booking not available — ${data.restaurantName}`
        : `Booking cancelled — ${data.restaurantName}`,
    html: layout(content),
    text: textVersion(content),
  };
}

/** Sent the day before a visit. */
export function bookingReminderEmail(data: BookingEmailData): Template {
  const content = {
    heading: `See you tomorrow, ${data.guestName}`,
    intro: `A quick reminder of your booking at ${data.restaurantName}.`,
    details: bookingDetails(data),
    cta: { label: "View or change your booking", url: data.manageUrl },
    footer: "If you can no longer make it, please cancel so we can free the table.",
  };

  return {
    subject: `Reminder: your table at ${data.restaurantName} tomorrow`,
    html: layout(content),
    text: textVersion(content),
  };
}

/** Sent when an owner or manager invites a team member. */
export function staffInviteEmail(data: {
  name: string;
  restaurantName: string;
  inviterName: string;
  roleLabel: string;
  url: string;
  expiresInHours: number;
}): Template {
  const content = {
    heading: `Join ${data.restaurantName} on ${APP_NAME}`,
    intro: `Hi ${data.name}, ${data.inviterName} has added you to ${data.restaurantName} as ${data.roleLabel}. Set a password to get started.`,
    cta: { label: "Set your password", url: data.url },
    footer: `This link expires in ${data.expiresInHours} hours. If you were not expecting it, you can ignore this email.`,
  };

  return {
    subject: `You have been added to ${data.restaurantName}`,
    html: layout(content),
    text: textVersion(content),
  };
}

/** Sent for a forgotten password. */
export function passwordResetEmail(data: {
  name: string;
  url: string;
  expiresInHours: number;
}): Template {
  const content = {
    heading: "Reset your password",
    intro: `Hi ${data.name}, use the link below to choose a new password.`,
    cta: { label: "Choose a new password", url: data.url },
    footer: `This link expires in ${data.expiresInHours} hour(s). If you did not ask for it, nothing has changed — you can ignore this email.`,
  };

  return {
    subject: `Reset your ${APP_NAME} password`,
    html: layout(content),
    text: textVersion(content),
  };
}
