import { expect, test } from "@playwright/test";
import { ACTIVE, EXPIRED } from "./fixture";
import { dhakaDayKey, expectToast, signIn } from "./helpers";

test("a guest books a table, the restaurant sees it, and the guest cancels", async ({
  page,
  browser,
}) => {
  const guest = { name: "Farhana Akter", email: `farhana+${Date.now()}@guest.test` };

  await page.goto(`/r/${ACTIVE.slug}`);
  await expect(page.getByRole("heading", { name: ACTIVE.name })).toBeVisible();

  await page.getByLabel("Date").fill(dhakaDayKey(2));
  await page.getByLabel("Guests").fill("3");
  await page.getByRole("button", { name: "8:00 PM" }).click();
  await page.getByLabel("Full name").fill(guest.name);
  await page.getByLabel("Email").fill(guest.email);
  await page.getByRole("button", { name: "Book 3 for 8:00 PM" }).click();

  await expect(page.getByRole("heading", { name: "Table confirmed" })).toBeVisible();

  // The owner sees the new booking.
  const staff = await browser.newPage();
  await signIn(staff, ACTIVE.owner.email);
  await expect(staff).toHaveURL(/\/dashboard$/);
  await staff.goto("/dashboard/reservations");
  await expect(staff.getByText(guest.name)).toBeVisible();
  await staff.close();

  // The guest cancels from the link in their confirmation.
  await page.getByRole("link", { name: "View or change your booking" }).click();
  await expect(page).toHaveURL(/\/booking\//);
  await expect(page.getByText(`3 guests · ${guest.name}`)).toBeVisible();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
  await expectToast(page, "Booking cancelled");
  await expect(page.getByText("can no longer be changed online")).toBeVisible();
});

test("a restaurant with a lapsed subscription stops taking online bookings", async ({
  page,
}) => {
  await page.goto(`/r/${EXPIRED.slug}`);
  await expect(page.getByText("Online booking is paused")).toBeVisible();
});
