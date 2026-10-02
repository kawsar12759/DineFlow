import { expect, test } from "@playwright/test";
import { ACTIVE, EXPIRED } from "./fixture";
import { signIn } from "./helpers";

test("the reservations list shows seeded bookings", async ({ page }) => {
  await signIn(page, ACTIVE.owner.email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/reservations");
  await expect(
    page.getByText(ACTIVE.seededGuest.name).filter({ visible: true })
  ).toBeVisible();
});

test("tenants only see their own data", async ({ page }) => {
  await signIn(page, EXPIRED.owner.email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/reservations");
  await expect(page.getByRole("heading", { name: "Reservations" })).toBeVisible();
  await expect(page.getByText(ACTIVE.seededGuest.name)).toHaveCount(0);
});

test("an owner whose subscription ended is told the dashboard is read-only", async ({
  page,
}) => {
  await signIn(page, EXPIRED.owner.email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Your subscription has ended")).toBeVisible();
});
