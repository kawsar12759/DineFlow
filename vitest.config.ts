import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Route handlers sign guest booking links; auth is not exercised here.
    env: { AUTH_SECRET: "test-secret-for-booking-tokens" },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // The first run downloads a MongoDB binary for the integration tests.
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
