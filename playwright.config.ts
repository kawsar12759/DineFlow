import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./e2e/fixture";

const baseURL = `http://localhost:${E2E_PORT}`;

/**
 * End-to-end tests run against a production build on a seeded in-memory
 * database (scripts/e2e-server.ts). The specs share that database, so each
 * one works on its own data instead of relying on run order.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Dhaka",
    locale: "en-GB",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: `${baseURL}/api/health`,
    // Never test against a developer's own server and database.
    reuseExistingServer: false,
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
