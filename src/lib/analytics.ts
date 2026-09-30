import { Types } from "mongoose";
import { AnalyticsEvent } from "@/models";
import type { AnalyticsEventType } from "@/lib/constants";
import { logger } from "@/lib/logger";

/**
 * Fire-and-forget analytics event tracking. Never throws — analytics
 * must not break business operations.
 */
export async function trackEvent(
  restaurantId: string | Types.ObjectId,
  type: AnalyticsEventType,
  metadata: Record<string, unknown> = {}
) {
  try {
    await AnalyticsEvent.create({
      restaurantId: new Types.ObjectId(restaurantId),
      type,
      metadata,
    });
  } catch (error) {
    logger.error("Failed to track analytics event", { type, error });
  }
}
