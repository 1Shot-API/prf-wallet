import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A hex-encoded Bitcoin wire signature (DER signature + SIGHASH byte, e.g. SIGHASH_ALL `0x01`).
 *
 * Example: `"0x30440220…01"`
 */
export type BitcoinSignatureHex = Brand<`0x${string}`, "BitcoinSignatureHex">;
export const BitcoinSignatureHex = make<BitcoinSignatureHex>();

/** Zod schema: 0x-prefixed hex Bitcoin wire signature. */
export const BitcoinSignatureHexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, {
    message: "must be a 0x-prefixed hex Bitcoin signature",
  })
  .transform((s) => BitcoinSignatureHex(s as `0x${string}`));
