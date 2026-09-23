import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { User } from "@/models";
import { GET } from "@/app/signed-out/route";
import { connectTestDb, resetDb, seedTwoTenants, signInAs } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

beforeAll(() => connectTestDb("signed-out"));
afterAll(() => mongoose.disconnect());
beforeEach(async () => {
  await resetDb();
  seed = await seedTwoTenants();
});

function request() {
  return new NextRequest("http://localhost/signed-out", {
    headers: {
      cookie: "authjs.session-token=abc; authjs.csrf-token=keep; theme=dark",
    },
  });
}

/** Cookie names the response deletes (Max-Age=0 / expired). */
function clearedCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((c) => /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c))
    .map((c) => c.split("=")[0]);
}

describe("/signed-out", () => {
  it("clears the session cookie of a deactivated user and explains why", async () => {
    await User.updateOne({ _id: seed.staffA._id }, { isActive: false });
    signInAs(seed.staffA);

    const response = await GET(request());

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?reason=inactive"
    );
    expect(clearedCookies(response)).toEqual(["authjs.session-token"]);
  });

  it("does not log out an active user (no logout-by-link)", async () => {
    signInAs(seed.staffA);

    const response = await GET(request());

    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    expect(clearedCookies(response)).toEqual([]);
  });

  it("also clears the cookie when the account was deleted", async () => {
    await User.deleteOne({ _id: seed.staffA._id });
    signInAs(seed.staffA);

    const response = await GET(request());

    expect(response.headers.get("location")).toContain("/login?reason=inactive");
    expect(clearedCookies(response)).toContain("authjs.session-token");
  });
});
