import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Unix time in **seconds** (not JavaScript milliseconds from `Date.now()`).
 *
 * Example: `1719792000` ≈ `2024-07-01T00:00:00Z`
 */
export type UnixTimestamp = Brand<number, "UnixTimestamp">;
export const UnixTimestamp = make<UnixTimestamp>();

/** Zod schema: Unix timestamp in seconds (non-negative integer). */
export const UnixTimestampSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((n) => UnixTimestamp(n));
