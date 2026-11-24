import { type Brand, make } from "ts-brand";
import { z } from "zod";

import { BitcoinAddressUtils } from "../utils/BitcoinAddressUtils.js";

/**
 * A Bitcoin Native SegWit (P2WPKH) account address.
 * Starts with `bc1q` on Bitcoin Mainnet or `tb1q` on Bitcoin Testnet.
 *
 * Example: `"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"`
 */
export type BitcoinSegwitAccountAddress = Brand<
  string,
  "BitcoinSegwitAccountAddress"
>;
export const BitcoinSegwitAccountAddress = make<BitcoinSegwitAccountAddress>();

/** Zod schema: Native SegWit P2WPKH (`bc1q` / `tb1q`), bech32-validated. */
export const BitcoinSegwitAccountAddressSchema = z
  .string()
  .trim()
  .refine((s) => BitcoinAddressUtils.isSegwitProgram(s, 0, 20), {
    message: "must be a Native SegWit P2WPKH address (bc1q / tb1q)",
  })
  .transform((s) => BitcoinSegwitAccountAddress(s.toLowerCase()));
