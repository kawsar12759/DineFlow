/**
 * Starts DineFlow for the Playwright suite against a throwaway database.
 *
 * Usage: started by playwright.config.ts (npm run test:e2e). It
 *   1. starts an in-memory MongoDB and seeds the fixture in e2e/fixture.ts,
 *   2. builds the app into .next-e2e (so a running `npm run dev` is untouched),
 *      unless E2E_SKIP_BUILD=1 and a build is already there,
 *   3. runs `next start` on E2E_PORT (3100) with that database.
 *
 * Nothing here reads .env.local's database: every variable the app needs is
 * set explicitly, and variables already in the environment win over .env files.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Branch, Customer, MenuItem, Reservation, Restaurant, Table, User } from "../src/models";
import { addDaysToKey, dayKeyToDate, todayKey } from "../src/lib/dates";
import { ACTIVE, ADMIN, E2E_PORT, EXPIRED, PASSWORD } from "../e2e/fixture";

const DAY_MS = 86_400_000;
const DIST_DIR = ".next-e2e";
const nextBin = path.join("node_modules", "next", "dist", "bin", "next");

async function seed(uri: string) {
  await mongoose.connect(uri);
  const password = await bcrypt.hash(PASSWORD, 10);
  const now = Date.now();

  // ---------- Active tenant ----------
  const owner = await User.create({ ...ACTIVE.owner, password, role: "owner" });
  const restaurant = await Restaurant.create({
    name: ACTIVE.name,
    slug: ACTIVE.slug,
    ownerId: owner._id,
    cuisine: "Bengali",
    subscriptionPlan: "growth",
    onTrial: false,
    subscriptionEndsAt: new Date(now + 60 * DAY_MS),
    // Guest bookings are confirmed straight away.
    bookingSettings: { autoApprove: true },
  });
  owner.restaurantId = restaurant._id;
  await owner.save();

  const branch = await Branch.create({
    restaurantId: restaurant._id,
    name: ACTIVE.branch,
    address: { street: "Road 11, Gulshan 2", city: "Dhaka" },
    capacity: 40,
  });
  await Table.create(
    [2, 2, 4, 4, 6].map((seats, i) => ({
      restaurantId: restaurant._id,
      branchId: branch._id,
      name: `T${i + 1}`,
      seats,
    }))
  );
  await MenuItem.create([
    { restaurantId: restaurant._id, name: "Shorshe Ilish", price: 850, category: "Mains" },
    { restaurantId: restaurant._id, name: "Beef Tehari", price: 420, category: "Mains" },
    { restaurantId: restaurant._id, name: "Mishti Doi", price: 150, category: "Desserts" },
  ]);

  const guest = await Customer.create({
    restaurantId: restaurant._id,
    ...ACTIVE.seededGuest,
  });
  await Reservation.create({
    restaurantId: restaurant._id,
    branchId: branch._id,
    customerId: guest._id,
    date: dayKeyToDate(addDaysToKey(todayKey(), 1)),
    time: "19:00",
    guests: 4,
    status: "approved",
  });

  // ---------- Tenant whose subscription has run out ----------
  const expiredOwner = await User.create({ ...EXPIRED.owner, password, role: "owner" });
  const expired = await Restaurant.create({
    name: EXPIRED.name,
    slug: EXPIRED.slug,
    ownerId: expiredOwner._id,
    subscriptionPlan: "starter",
    onTrial: false,
    subscriptionEndsAt: new Date(now - 30 * DAY_MS),
  });
  expiredOwner.restaurantId = expired._id;
  await expiredOwner.save();
  await Branch.create({
    restaurantId: expired._id,
    name: "Lalbagh",
    address: { street: "Lalbagh Road", city: "Dhaka" },
    capacity: 20,
  });

  // ---------- DineFlow operator ----------
  await User.create({ ...ADMIN, password, role: "super_admin" });

  await mongoose.disconnect();
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("dineflow-e2e");
  await seed(uri);
  console.log(`[e2e] seeded ${uri}`);

  const origin = `http://localhost:${E2E_PORT}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: DIST_DIR,
    MONGODB_URI: uri,
    AUTH_SECRET: "e2e-auth-secret-not-for-production-use",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: origin,
    APP_URL: origin,
    // No real email, payments or proxy in tests.
    RESEND_API_KEY: "",
    SSLCOMMERZ_STORE_ID: "",
    SSLCOMMERZ_STORE_PASSWORD: "",
    TRUSTED_PROXY_HOPS: "0",
    CRON_SECRET: "e2e-cron-secret",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "warn",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  const built = existsSync(path.join(DIST_DIR, "BUILD_ID"));
  if (!(process.env.E2E_SKIP_BUILD === "1" && built)) {
    console.log("[e2e] building into .next-e2e …");
    const build = spawnSync(process.execPath, [nextBin, "build"], { env, stdio: "inherit" });
    if (build.status !== 0) {
      await mongo.stop();
      process.exit(build.status ?? 1);
    }
  }

  const server = spawn(process.execPath, [nextBin, "start", "-p", String(E2E_PORT)], {
    env,
    stdio: "inherit",
  });

  const shutdown = async () => {
    server.kill();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  server.on("exit", async (code) => {
    await mongo.stop();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[e2e] server failed to start", error);
  process.exit(1);
});
