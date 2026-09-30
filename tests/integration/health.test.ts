import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { connectTestDb } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeAll(async () => {
  await connectTestDb("health");
});

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.database.ok).toBe(true);
    expect(body.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
