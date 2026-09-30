import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, serializeError } from "@/lib/logger";
import { handleApiError } from "@/lib/api-helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("is silent in tests unless LOG_LEVEL asks otherwise", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("hidden");
    expect(spy).not.toHaveBeenCalled();
  });

  it("writes one JSON line per entry in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("too detailed");
    logger.info("Cron finished", { sent: 3 });
    logger.error("Boom", { error: new Error("disk full") });

    expect(out).toHaveBeenCalledTimes(1);
    const info = JSON.parse(out.mock.calls[0][0]);
    expect(info).toMatchObject({ level: "info", msg: "Cron finished", sent: 3 });
    expect(Date.parse(info.time)).not.toBeNaN();

    const error = JSON.parse(err.mock.calls[0][0]);
    expect(error).toMatchObject({ level: "error", msg: "Boom", error: { name: "Error", message: "disk full" } });
    expect(error.error.stack).toContain("disk full");
  });

  it("still logs when a field cannot be serialised", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.info("Odd payload", { circular });
    expect(JSON.parse(out.mock.calls[0][0])).toMatchObject({ msg: "Odd payload" });
  });

  it("keeps an error's cause", () => {
    const error = new Error("outer", { cause: new Error("inner") });
    expect(serializeError(error)).toMatchObject({ message: "outer", cause: { message: "inner" } });
    expect(serializeError("plain")).toEqual({ message: "plain" });
  });
});

describe("handleApiError", () => {
  it("hides internal errors behind a reference that is also logged", async () => {
    vi.stubEnv("LOG_LEVEL", "error");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleApiError(new Error("connection reset"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.errorId).toMatch(/^[0-9a-f]{8}$/);
    expect(body.error).toContain(body.errorId);
    expect(body.error).not.toContain("connection reset");
    expect(JSON.stringify(logged.mock.calls)).toContain(body.errorId);
  });
});
