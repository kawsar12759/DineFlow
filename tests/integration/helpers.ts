import { inject, type Mock } from "vitest";
import mongoose, { type Types } from "mongoose";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Branch, Customer, Restaurant, User } from "@/models";
import { resetRateLimits } from "@/lib/rate-limit";
import { addDaysToKey, todayKey } from "@/lib/dates";

/** Connects to a fresh database on the shared in-memory server. */
export async function connectTestDb(name: string) {
  const uri = new URL(inject("mongoUri"));
  uri.pathname = `/${name}`;
  process.env.MONGODB_URI = uri.toString();
  await connectDB();
  await mongoose.connection.dropDatabase();
}

export async function resetDb() {
  await mongoose.connection.dropDatabase();
  resetRateLimits();
}

/** Signs a user in for the next route-handler calls (`@/auth` must be mocked). */
export function signInAs(user: { _id: Types.ObjectId } | null) {
  (auth as unknown as Mock).mockResolvedValue(
    user ? { user: { id: user._id.toString() } } : null
  );
}

export function jsonRequest(
  url: string,
  method = "GET",
  body?: unknown,
  ip = "203.0.113.1"
) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Route params for handlers that use a name other than "id". */
export function routeParams<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}

/** A booking day safely in the future. */
export const TOMORROW = () => addDaysToKey(todayKey(), 1);

/** Two tenants: A (owner, branch-scoped staff, two branches) and B (owner, one branch). */
export async function seedTwoTenants() {
  const ownerA = await User.create({
    name: "Owner A",
    email: "owner@a.test",
    password: "x",
    role: "owner",
  });
  const restaurantA = await Restaurant.create({
    name: "A",
    slug: "a",
    ownerId: ownerA._id,
  });
  ownerA.restaurantId = restaurantA._id;
  await ownerA.save();

  const [branchA1, branchA2] = await Branch.create([
    {
      restaurantId: restaurantA._id,
      name: "Gulshan",
      address: { street: "Road 1", city: "Dhaka" },
      capacity: 10,
    },
    {
      restaurantId: restaurantA._id,
      name: "Dhanmondi",
      address: { street: "Road 2", city: "Dhaka" },
      capacity: 10,
    },
  ]);

  const staffA = await User.create({
    name: "Staff A",
    email: "staff@a.test",
    password: "x",
    role: "staff",
    restaurantId: restaurantA._id,
    branchId: branchA1._id,
  });

  const ownerB = await User.create({
    name: "Owner B",
    email: "owner@b.test",
    password: "x",
    role: "owner",
  });
  const restaurantB = await Restaurant.create({
    name: "B",
    slug: "b",
    ownerId: ownerB._id,
  });
  ownerB.restaurantId = restaurantB._id;
  await ownerB.save();

  const branchB = await Branch.create({
    restaurantId: restaurantB._id,
    name: "Banani",
    address: { street: "Road 3", city: "Dhaka" },
    capacity: 10,
  });

  const [customerA, customerB] = await Customer.create([
    { restaurantId: restaurantA._id, name: "Guest A", email: "guest@a.test" },
    { restaurantId: restaurantB._id, name: "Guest B", email: "guest@b.test" },
  ]);

  return {
    ownerA,
    staffA,
    restaurantA,
    branchA1,
    branchA2,
    customerA,
    ownerB,
    restaurantB,
    branchB,
    customerB,
  };
}
