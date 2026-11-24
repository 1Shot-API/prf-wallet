import { type Brand, make } from "ts-brand";
import { z } from "zod";

import { BitcoinAddressUtils } from "../utils/BitcoinAddressUtils.js";

/**
 * A legacy Pay-to-PubKey-Hash (P2PKH) Bitcoin address (base58check).\n * Starts with `1` on Bitcoin Mainnet or `m` / `n` on Bitcoin Testnet.
 *
 * Example: `"1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"`
 */
export type BitcoinLegacyAccountAddress = Brand<string, "BitcoinLegacyAccountAddress">;
export const BitcoinLegacyAccountAddress = make<BitcoinLegacyAccountAddress>();

/** Zod schema: a legacy P2PKH Bitcoin address (1… / m… / n…). */
export const BitcoinLegacyAccountAddressSchema = z
  .string()
  .trim()
  .refine((s) => BitcoinAddressUtils.isBase58Version(s, BitcoinAddressUtils.P2PKH_VERSIONS), {
    message: "must be a legacy P2PKH Bitcoin address (1… / m… / n…)",
  })
  .transform((s) => BitcoinLegacyAccountAddress(s));
