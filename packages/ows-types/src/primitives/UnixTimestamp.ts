import { type Brand, make } from "ts-brand";

/**
 * Unix time in **seconds** (not JavaScript milliseconds from `Date.now()`).
 *
 * Example: `1719792000` ≈ `2024-07-01T00:00:00Z`
 */
export type UnixTimestamp = Brand<number, "UnixTimestamp">;
export const UnixTimestamp = make<UnixTimestamp>();
