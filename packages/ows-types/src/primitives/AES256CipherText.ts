import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Raw AES-256-GCM ciphertext bytes as a `0x`-prefixed hex string
 * (IV / version / packaging live on {@link AES256CipherTextEnvelope}).
 *
 * Example: `"0x" + ciphertext and tag hex`
 */
export type AES256CipherText = Brand<`0x${string}`, "AES256CipherText">;
export const AES256CipherText = make<AES256CipherText>();

/** Zod schema: non-empty 0x-prefixed hex ciphertext. */
export const AES256CipherTextSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, {
    message: "must be a non-empty 0x-prefixed hex ciphertext",
  })
  .transform((s) => AES256CipherText(s as `0x${string}`));
