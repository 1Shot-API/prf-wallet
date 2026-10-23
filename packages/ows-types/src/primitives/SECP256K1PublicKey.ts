import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Hex-encoded **uncompressed** secp256k1 public key (`0x04` ‖ X ‖ Y = 65 bytes).
 * Produced by the Signing Layer via `secpGetPublicKey(priv, false)` for viem
 * `publicKeyToAddress`; compress before Bitcoin P2WPKH derivation.
 *
 * Example: `"0x04" + 128 hex characters`
 */
export type SECP256K1PublicKey = Brand<`0x${string}`, "SECP256K1PublicKey">;
export const SECP256K1PublicKey = make<SECP256K1PublicKey>();

/** Zod schema: uncompressed secp256k1 public key (`0x04` + 64 bytes). */
export const SECP256K1PublicKeySchema = z
  .string()
  .regex(/^0x04[0-9a-fA-F]{128}$/i, {
    message: "must be uncompressed secp256k1 public key (0x04 + 64 bytes)",
  })
  .transform((s) => SECP256K1PublicKey(s.toLowerCase() as `0x${string}`));
