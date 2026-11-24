import { type Brand, make } from "ts-brand";
import { z } from "zod";

import { BitcoinAddressUtils } from "../utils/BitcoinAddressUtils.js";

/**
 * A Pay-to-Script-Hash (P2SH) Bitcoin address (base58check), including nested SegWit.\n * Starts with `3` on Bitcoin Mainnet or `2` on Bitcoin Testnet.
 *
 * Example: `"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"`
 */
export type BitcoinScriptHashAddress = Brand<string, "BitcoinScriptHashAddress">;
export const BitcoinScriptHashAddress = make<BitcoinScriptHashAddress>();

/** Zod schema: a P2SH Bitcoin address (3… / 2…). */
export const BitcoinScriptHashAddressSchema = z
  .string()
  .trim()
  .refine((s) => BitcoinAddressUtils.isBase58Version(s, BitcoinAddressUtils.P2SH_VERSIONS), {
    message: "must be a P2SH Bitcoin address (3… / 2…)",
  })
  .transform((s) => BitcoinScriptHashAddress(s));
