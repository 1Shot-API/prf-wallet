import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Signing Layer AES-256-GCM envelope:
 * `ows-aes1:0x` ‖ version(1) ‖ IV(12) ‖ ciphertext+tag.
 *
 * Example: `"ows-aes1:0x01…"`.
 */
export type AES256CipherTextEnvelope = Brand<
  string,
  "AES256CipherTextEnvelope"
>;
export const AES256CipherTextEnvelope = make<AES256CipherTextEnvelope>();

/** Zod schema: `ows-aes1:` prefix + 0x hex payload. */
export const AES256CipherTextEnvelopeSchema = z
  .string()
  .regex(/^ows-aes1:0x[0-9a-fA-F]+$/, {
    message: "must be an ows-aes1:0x… AES-256 envelope",
  })
  .transform((s) => AES256CipherTextEnvelope(s));
