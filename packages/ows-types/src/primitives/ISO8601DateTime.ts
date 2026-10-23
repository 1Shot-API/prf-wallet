import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * ISO 8601 date-time string.
 *
 * Example: `"2026-07-07T23:21:00.000Z"`
 */
export type ISO8601DateTime = Brand<string, "ISO8601DateTime">;
export const ISO8601DateTime = make<ISO8601DateTime>();

/** Zod schema: non-empty string with a finite `Date.parse` value. */
export const ISO8601DateTimeSchema = z
  .string()
  .min(1)
  .refine((s) => Number.isFinite(Date.parse(s)), {
    message: "must be a valid ISO 8601 date-time",
  })
  .transform((s) => ISO8601DateTime(s));
