/**
 * The data scripts/e2e-server.ts seeds before the app starts. Specs import
 * these so the two stay in step.
 */
export const PASSWORD = "e2e-password-123";

export const ACTIVE = {
  name: "Shorshe Kitchen",
  slug: "shorshe-kitchen",
  owner: { name: "Nusrat Jahan", email: "owner@shorshe.test" },
  branch: "Gulshan",
  /** Booked for tomorrow, so it is on the reservations list. */
  seededGuest: { name: "Rahim Uddin", email: "rahim@guest.test" },
};

/** A restaurant whose paid subscription ended a month ago. */
export const EXPIRED = {
  name: "Old Dhaka Grill",
  slug: "old-dhaka-grill",
  owner: { name: "Tanvir Ahmed", email: "owner@olddhaka.test" },
};

export const ADMIN = { name: "DineFlow Support", email: "admin@dineflow.test" };

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
