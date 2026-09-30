import type { Instrumentation } from "next";
import { logger } from "@/lib/logger";

/**
 * Next.js calls this for errors thrown while rendering pages, in route
 * handlers, server actions and middleware — including ones no try/catch
 * reached — so every server failure lands in the structured log with its route.
 */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  logger.error("Unhandled server error", {
    error,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    runtime: process.env.NEXT_RUNTIME,
  });
};
