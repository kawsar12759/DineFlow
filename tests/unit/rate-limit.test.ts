import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000, now).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("resets after the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) rateLimit("k", 3, 60_000, now);
    expect(rateLimit("k", 3, 60_000, now + 60_001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) rateLimit("a", 3, 60_000, now);
    expect(rateLimit("b", 3, 60_000, now).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  const withForwarded = (value?: string) =>
    new Request("http://localhost/", {
      headers: value ? { "x-forwarded-for": value } : {},
    });

  it("ignores client-supplied entries in front of the proxy's", () => {
    // Attacker sent "10.9.9.1"; the proxy appended the real address.
    expect(clientIp(withForwarded("10.9.9.1, 192.0.2.50"))).toBe("192.0.2.50");
    expect(clientIp(withForwarded("10.9.9.2, 192.0.2.50"))).toBe("192.0.2.50");
  });

  it("uses the only entry when the proxy overwrites the header (Vercel)", () => {
    expect(clientIp(withForwarded("192.0.2.50"))).toBe("192.0.2.50");
  });

  it("supports more than one trusted proxy hop", () => {
    expect(clientIp(withForwarded("10.9.9.1, 192.0.2.50, 172.16.0.1"), 2)).toBe(
      "192.0.2.50"
    );
  });

  it("returns null without a proxy header (no shared bucket)", () => {
    expect(clientIp(withForwarded())).toBeNull();
  });
});
