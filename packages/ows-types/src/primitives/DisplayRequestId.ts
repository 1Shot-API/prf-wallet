import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Correlates a branding-layer display request with the host response.
 * Typically a monotonic decimal string from the branding session counter.
 *
 * Example: `"1"`
 */
export type DisplayRequestId = Brand<string, "DisplayRequestId">;
export const DisplayRequestId = make<DisplayRequestId>();

/** Zod schema: non-empty display request id string. */
export const DisplayRequestIdSchema = z
  .string()
  .min(1, { message: "must be a non-empty display request id" })
  .transform((s) => DisplayRequestId(s));
