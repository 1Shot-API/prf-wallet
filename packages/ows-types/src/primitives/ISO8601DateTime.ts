import { type Brand, make } from "ts-brand";

/** ISO 8601 date-time string (e.g. `2026-07-07T23:21:00.000Z`). */
export type ISO8601DateTime = Brand<string, "ISO8601DateTime">;
export const ISO8601DateTime = make<ISO8601DateTime>();
