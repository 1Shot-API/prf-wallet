import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * SubjectPublicKeyInfo (SPKI) DER public key (base64url).
 * Browser `AuthenticatorAttestationResponse.getPublicKey()` form;
 * suitable for Web Crypto `importKey` / Node `createPublicKey`.
 *
 * Example: `"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…"` (base64url SPKI)
 */
export type SPKIPublicKey = Brand<string, "SPKIPublicKey">;
export const SPKIPublicKey = make<SPKIPublicKey>();

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Zod schema: base64url SPKI public key. */
export const SPKIPublicKeySchema = z
  .string()
  .min(1)
  .refine((s) => BASE64URL_RE.test(s), {
    message: "must be a base64url SPKI public key",
  })
  .transform((s) => SPKIPublicKey(s));
