import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Standard base64-encoded string (`A–Z` / `a–z` / `0–9` / `+` / `/`, optional `=` padding).
 * Distinct from {@link Base64UrlEncodedString} (JWT / URL-safe alphabet).
 *
 * Example: `"SGVsbG8gV29ybGQ="`
 */
export type Base64String = Brand<string, "Base64String">;
export const Base64String = make<Base64String>();

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Zod schema: standard base64 (with optional padding). */
export const Base64StringSchema = z
  .string()
  .min(1)
  .refine((s) => BASE64_RE.test(s), {
    message: "must be a base64-encoded string",
  })
  .transform((s) => Base64String(s));
