import { type Brand, make } from "ts-brand";
import { z } from "zod";

import { BitcoinAddressUtils } from "../utils/BitcoinAddressUtils.js";

/**
 * A Native SegWit Pay-to-Witness-Script-Hash (P2WSH) Bitcoin address\n * (bech32, witness v0, 32-byte program). Starts with `bc1q` / `tb1q`.
 *
 * Example: `"bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"`
 */
export type BitcoinSegwitScriptAddress = Brand<string, "BitcoinSegwitScriptAddress">;
export const BitcoinSegwitScriptAddress = make<BitcoinSegwitScriptAddress>();

/** Zod schema: a Native SegWit P2WSH Bitcoin address (bc1q / tb1q, 32-byte program). */
export const BitcoinSegwitScriptAddressSchema = /* @__PURE__ */ z
  .string()
  .trim()
  .refine((s) => BitcoinAddressUtils.isSegwitProgram(s, 0, 32), {
    message: "must be a Native SegWit P2WSH Bitcoin address (bc1q / tb1q, 32-byte program)",
  })
  .transform((s) => BitcoinSegwitScriptAddress(s.toLowerCase()));
