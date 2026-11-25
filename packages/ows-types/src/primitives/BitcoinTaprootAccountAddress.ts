import { type Brand, make } from "ts-brand";
import { z } from "zod";

import { BitcoinAddressUtils } from "../utils/BitcoinAddressUtils.js";

/**
 * A Taproot (P2TR) Bitcoin address (bech32m, witness v1, 32-byte x-only key).\n * Starts with `bc1p` on Bitcoin Mainnet or `tb1p` on Bitcoin Testnet.
 *
 * Example: `"bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0"`
 */
export type BitcoinTaprootAccountAddress = Brand<string, "BitcoinTaprootAccountAddress">;
export const BitcoinTaprootAccountAddress = make<BitcoinTaprootAccountAddress>();

/** Zod schema: a Taproot P2TR Bitcoin address (bc1p / tb1p). */
export const BitcoinTaprootAccountAddressSchema = /* @__PURE__ */ z
  .string()
  .trim()
  .refine((s) => BitcoinAddressUtils.isSegwitProgram(s, 1, 32), {
    message: "must be a Taproot P2TR Bitcoin address (bc1p / tb1p)",
  })
  .transform((s) => BitcoinTaprootAccountAddress(s.toLowerCase()));
