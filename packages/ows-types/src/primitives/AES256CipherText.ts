import { type Brand, make } from "ts-brand";

/**
 * AES-256-GCM ciphertext envelope (branded string).
 *
 * Signing Layer packaging: `ows-aes1:0x` ‖ version(1) ‖ IV(12) ‖ ciphertext+tag.
 * Key is HKDF-SHA256 from the wallet secp256k1 scalar with info `ows-v1/aes256-gcm`
 * (same material as `signDigest`; not passphrase PBKDF2).
 */
export type AES256CipherText = Brand<string, "AES256CipherText">;
export const AES256CipherText = make<AES256CipherText>();
