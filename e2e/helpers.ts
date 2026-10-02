import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "./fixture";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** A day key (YYYY-MM-DD) in Dhaka time, `days` from today. */
export function dhakaDayKey(days: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
    new Date(Date.now() + days * 86_400_000)
  );
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text })).toBeVisible();
}
