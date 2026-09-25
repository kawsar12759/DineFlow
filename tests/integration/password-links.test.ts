import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "@/models";
import * as staffRoute from "@/app/api/staff/route";
import * as forgotRoute from "@/app/api/auth/forgot-password/route";
import * as setPasswordRoute from "@/app/api/auth/set-password/route";
import { issuePasswordToken } from "@/lib/password-tokens";
import {
  connectTestDb,
  jsonRequest,
  resetDb,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(() => connectTestDb("password-links"));
afterAll(() => mongoose.disconnect());
beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
});

/** Password tokens are stored hashed, so tests mint their own raw token. */
async function tokenFor(userId: mongoose.Types.ObjectId, purpose: "invite" | "reset") {
  const { token } = await issuePasswordToken(userId, purpose);
  return token;
}

describe("staff invites", () => {
  it("creates the member with an invite instead of a password", async () => {
    signInAs(seed.ownerA);

    const response = await staffRoute.POST(
      jsonRequest("/api/staff", "POST", {
        name: "Rahim Uddin",
        email: "rahim@a.test",
        role: "staff",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.invited).toBe(true);

    const member = await User.findOne({ email: "rahim@a.test" })
      .select("+password +passwordTokenHash +passwordTokenPurpose")
      .lean();
    expect(member?.passwordTokenHash).toBeTruthy();
    expect(member?.passwordTokenPurpose).toBe("invite");
    // The placeholder password is random, so it cannot be guessed or reused.
    expect(await bcrypt.compare("password123", member!.password)).toBe(false);
  });

  it("still allows setting a password directly", async () => {
    signInAs(seed.ownerA);

    const response = await staffRoute.POST(
      jsonRequest("/api/staff", "POST", {
        name: "Sumaiya Akter",
        email: "sumaiya@a.test",
        role: "staff",
        password: "password123",
      })
    );
    const body = await response.json();

    expect(body.data.invited).toBe(false);
    const member = await User.findOne({ email: "sumaiya@a.test" })
      .select("+password +passwordTokenHash")
      .lean();
    expect(await bcrypt.compare("password123", member!.password)).toBe(true);
    expect(member?.passwordTokenHash).toBeUndefined();
  });
});

describe("forgot password", () => {
  it("answers the same whether or not the account exists", async () => {
    const known = await forgotRoute.POST(
      jsonRequest("/api/auth/forgot-password", "POST", { email: "owner@a.test" }, "203.0.113.1")
    );
    const unknown = await forgotRoute.POST(
      jsonRequest("/api/auth/forgot-password", "POST", { email: "nobody@a.test" }, "203.0.113.2")
    );

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it("issues a token only for the real account", async () => {
    await forgotRoute.POST(
      jsonRequest("/api/auth/forgot-password", "POST", { email: "owner@a.test" }, "203.0.113.3")
    );

    const owner = await User.findById(seed.ownerA._id)
      .select("+passwordTokenHash +passwordTokenPurpose")
      .lean();
    expect(owner?.passwordTokenHash).toBeTruthy();
    expect(owner?.passwordTokenPurpose).toBe("reset");
  });

  it("does not send to a deactivated account", async () => {
    await User.updateOne({ _id: seed.staffA._id }, { isActive: false });
    await forgotRoute.POST(
      jsonRequest("/api/auth/forgot-password", "POST", { email: "staff@a.test" }, "203.0.113.4")
    );

    const staff = await User.findById(seed.staffA._id)
      .select("+passwordTokenHash")
      .lean();
    expect(staff?.passwordTokenHash).toBeUndefined();
  });
});

describe("set password", () => {
  it("reports whether a link is usable", async () => {
    const token = await tokenFor(seed.ownerA._id, "reset");

    const good = await (
      await setPasswordRoute.GET(
        jsonRequest(`/api/auth/set-password?token=${encodeURIComponent(token)}`)
      )
    ).json();
    expect(good.data).toMatchObject({ valid: true, purpose: "reset" });

    const bad = await (
      await setPasswordRoute.GET(jsonRequest("/api/auth/set-password?token=nope"))
    ).json();
    expect(bad.data.valid).toBe(false);
  });

  it("sets the password and burns the link", async () => {
    const token = await tokenFor(seed.ownerA._id, "reset");

    const response = await setPasswordRoute.POST(
      jsonRequest("/api/auth/set-password", "POST", {
        token,
        password: "brand-new-password",
      }, "203.0.113.5")
    );
    expect(response.status).toBe(200);

    const owner = await User.findById(seed.ownerA._id)
      .select("+password +passwordTokenHash")
      .lean();
    expect(await bcrypt.compare("brand-new-password", owner!.password)).toBe(true);
    expect(owner?.passwordTokenHash).toBeUndefined();

    // The same link cannot be used twice.
    const reuse = await setPasswordRoute.POST(
      jsonRequest("/api/auth/set-password", "POST", {
        token,
        password: "another-password",
      }, "203.0.113.6")
    );
    expect(reuse.status).toBe(400);
  });

  it("rejects an expired link", async () => {
    const token = await tokenFor(seed.ownerA._id, "invite");
    await User.updateOne(
      { _id: seed.ownerA._id },
      { $set: { passwordTokenExpires: new Date(Date.now() - 1000) } }
    );

    const response = await setPasswordRoute.POST(
      jsonRequest("/api/auth/set-password", "POST", {
        token,
        password: "brand-new-password",
      }, "203.0.113.7")
    );
    expect(response.status).toBe(400);
  });

  it("rejects a short password", async () => {
    const token = await tokenFor(seed.ownerA._id, "reset");
    const response = await setPasswordRoute.POST(
      jsonRequest("/api/auth/set-password", "POST", { token, password: "short" }, "203.0.113.8")
    );
    expect(response.status).toBe(422);
  });
});
