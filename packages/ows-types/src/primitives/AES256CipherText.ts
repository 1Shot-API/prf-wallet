import { type Brand, make } from "ts-brand";

/**
 * AES-256-GCM ciphertext envelope (branded string).
 * Concrete packaging (version prefix, IV, ciphertext) is defined when PRF seal
 * is implemented in the Signing Layer — reuse AES-GCM envelope spirit from
 * recovery crypto, not passphrase PBKDF2.
 */
export type AES256CipherText = Brand<string, "AES256CipherText">;
export const AES256CipherText = make<AES256CipherText>();
