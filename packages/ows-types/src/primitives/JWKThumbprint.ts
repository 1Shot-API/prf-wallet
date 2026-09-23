import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * RFC 7638 JWK Thumbprint (SHA-256), base64url-encoded.
 *
 * Example: `"NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs"`
 */
export type JWKThumbprint = Brand<string, "JWKThumbprint">;
export const JWKThumbprint = make<JWKThumbprint>();

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Zod schema: base64url JWK thumbprint. */
export const JWKThumbprintSchema = z
  .string()
  .min(1)
  .refine((s) => BASE64URL_RE.test(s), {
    message: "must be a base64url JWK thumbprint",
  })
  .transform((s) => JWKThumbprint(s));
