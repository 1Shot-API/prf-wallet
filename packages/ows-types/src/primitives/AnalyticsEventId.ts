import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Client-generated UUID correlating a Branding→Host analytics notification.
 *
 * Example: `"550e8400-e29b-41d4-a716-446655440000"`
 */
export type AnalyticsEventId = Brand<string, "AnalyticsEventId">;
export const AnalyticsEventId = make<AnalyticsEventId>();

/** Zod schema: UUID string. */
export const AnalyticsEventIdSchema = z
  .uuid({ message: "must be a UUID" })
  .transform((s) => AnalyticsEventId(s));
