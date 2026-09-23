import { ApiError } from "@/lib/api-error";

/**
 * Fixed-window, in-memory rate limiter for public endpoints.
 *
 * State lives in this server instance, which is enough for a single Node
 * server. On multi-instance/serverless deployments each instance counts
 * separately; swap the store for Redis/Upstash when that matters.
 */

interface Window {
  count: number;
  resetAt: number;
}

interface RateLimitState {
  store: Map<string, Window>;
  lastSweep: number;
}

declare global {
  var rateLimitState: RateLimitState | undefined;
}

// Kept on globalThis (like the Mongo connection in db.ts) so counters survive
// dev-server recompiles and are shared if several bundles include this module.
const state: RateLimitState = (globalThis.rateLimitState ??= {
  store: new Map(),
  lastSweep: 0,
});
const store = state.store;

function sweep(now: number) {
  if (now - state.lastSweep < 60_000) return;
  state.lastSweep = now;
  for (const [key, window] of store) {
    if (window.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  sweep(now);
  const existing = store.get(key);
  const window =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

  window.count += 1;
  store.set(key, window);

  return {
    allowed: window.count <= limit,
    remaining: Math.max(0, limit - window.count),
    retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000),
  };
}

/**
 * The client IP as seen by our own proxy.
 *
 * Clients can send any X-Forwarded-For they like, so the leftmost entries
 * are untrusted. Each proxy appends the address it received the request
 * from, which makes the entry `TRUSTED_PROXY_HOPS` from the right (default
 * 1: Vercel, or a single nginx/Caddy in front of the app) the real client.
 * Returns null when there is no proxy header: Next.js does not expose the
 * socket address, so there is no trustworthy IP to key on.
 */
export function clientIp(
  request: Request,
  trustedHops = Number(process.env.TRUSTED_PROXY_HOPS) || 1
) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (forwarded?.length) {
    return forwarded[Math.max(0, forwarded.length - trustedHops)];
  }
  return null;
}

/**
 * Throws 429 when `request`'s IP exceeds `limit` hits per window for `bucket`.
 * Without a known client IP the check is skipped: a shared bucket would let
 * one abuser block the endpoint for every visitor.
 */
export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number
) {
  const ip = clientIp(request);
  if (!ip) return;
  const result = rateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (!result.allowed) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    throw new ApiError(
      `Too many attempts — please try again in ${minutes} minute${minutes === 1 ? "" : "s"}`,
      429
    );
  }
}

/** Test-only: clears all counters. */
export function resetRateLimits() {
  store.clear();
}
