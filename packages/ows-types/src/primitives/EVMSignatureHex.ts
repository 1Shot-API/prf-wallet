import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A hex-encoded ECDSA signature (EIP-191, EIP-712, etc.).
 * Typically `0x` + 65-byte secp256k1 signature (130 hex chars).
 *
 * Example: `"0x" + 130 hex characters`
 */
export type EVMSignatureHex = Brand<`0x${string}`, "EVMSignatureHex">;
export const EVMSignatureHex = make<EVMSignatureHex>();

/** Zod schema: 0x-prefixed hex signature (min 65 bytes / length ≥ 132). */
export const EVMSignatureHexSchema = z
  .string()
  .refine((s) => /^0x[0-9a-fA-F]+$/.test(s) && s.length >= 132, {
    message: "must be 0x-prefixed hex signature (min 65 bytes)",
  })
  .transform((s) => EVMSignatureHex(s as `0x${string}`));
