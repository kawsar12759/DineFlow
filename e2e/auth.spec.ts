import { expect, test } from "@playwright/test";
import { ACTIVE, ADMIN } from "./fixture";
import { expectToast, signIn } from "./helpers";

test("a wrong password is refused", async ({ page }) => {
  await signIn(page, ACTIVE.owner.email, "not-the-password");
  await expectToast(page, "Invalid email or password");
  await expect(page).toHaveURL(/\/login/);
});

test("an owner signs in to their dashboard and out again", async ({ page }) => {
  await signIn(page, ACTIVE.owner.email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Owners cannot reach DineFlow's own admin area.
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("a DineFlow operator lands in the admin area", async ({ page }) => {
  await signIn(page, ADMIN.email);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "DineFlow admin" })).toBeVisible();
  await expect(page.getByText(ACTIVE.name)).toBeVisible();
});
