import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * WebAuthn authenticator credential public key as COSE CBOR (base64url).
 * Native form from attestation authenticator data (`credentialPublicKey`).
 *
 * Example: `"pQECAyYgASFYI…"` (base64url COSE key)
 */
export type COSEPublicKey = Brand<string, "COSEPublicKey">;
export const COSEPublicKey = make<COSEPublicKey>();

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Zod schema: base64url COSE public key. */
export const COSEPublicKeySchema = z
  .string()
  .min(1)
  .refine((s) => BASE64URL_RE.test(s), {
    message: "must be a base64url COSE public key",
  })
  .transform((s) => COSEPublicKey(s));
