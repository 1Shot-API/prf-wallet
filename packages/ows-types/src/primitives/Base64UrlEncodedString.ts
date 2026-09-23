import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Base64url-encoded string (no padding required; `-` / `_` alphabet).
 *
 * Example: `"SGVsbG8"`
 */
export type Base64UrlEncodedString = Brand<string, "Base64UrlEncodedString">;
export const Base64UrlEncodedString = make<Base64UrlEncodedString>();

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Zod schema: base64url charset (A–Z, a–z, 0–9, `-`, `_`). */
export const Base64UrlEncodedStringSchema = z
  .string()
  .min(1)
  .refine((s) => BASE64URL_RE.test(s), {
    message: "must be a base64url-encoded string",
  })
  .transform((s) => Base64UrlEncodedString(s));
