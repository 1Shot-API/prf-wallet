import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Hex-encoded Ed25519 public key (`0x` + 32 bytes / 64 hex chars).
 *
 * Example: `"0x" + 64 hex characters`
 */
export type ED25519PublicKey = Brand<`0x${string}`, "ED25519PublicKey">;
export const ED25519PublicKey = make<ED25519PublicKey>();

/** Zod schema: 0x-prefixed 32-byte Ed25519 public key. */
export const ED25519PublicKeySchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/i, {
    message: "must be a 32-byte 0x hex Ed25519 public key",
  })
  .transform((s) => ED25519PublicKey(s.toLowerCase() as `0x${string}`));
