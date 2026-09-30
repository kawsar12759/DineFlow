import { expect, test } from "@playwright/test";

test("health check reports the database as reachable", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.database.ok).toBe(true);
});

test("the marketing home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DineFlow/);
  await expect(page.getByRole("link", { name: /sign in|log in/i }).first()).toBeVisible();
});

test("the dashboard sends signed-out visitors to the login page", async ({ page }) => {
  await page.goto("/dashboard/reservations");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});

test("an unknown storefront is a 404", async ({ page }) => {
  const response = await page.goto("/r/no-such-restaurant");
  expect(response?.status()).toBe(404);
});

test("API errors come back as JSON, not HTML", async ({ request }) => {
  const response = await request.get("/api/reservations");
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ success: false });
});
