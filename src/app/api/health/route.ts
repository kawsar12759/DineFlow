import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Liveness + database check for uptime monitors and load balancers.
 * 200 when MongoDB answers a ping, 503 otherwise. Public and uncached;
 * it reveals nothing beyond whether the app is up and which build is live.
 */
export async function GET() {
  const started = Date.now();
  let database: { ok: boolean; latencyMs?: number; error?: string };

  try {
    await withTimeout(
      (async () => {
        await connectDB();
        await mongoose.connection.db!.admin().ping();
      })(),
      DB_TIMEOUT_MS
    );
    database = { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    logger.error("Health check: database unreachable", { error });
    database = { ok: false, error: "Database unreachable" };
  }

  return NextResponse.json(
    {
      status: database.ok ? "ok" : "unavailable",
      database,
      version: process.env.npm_package_version ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    },
    {
      status: database.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
