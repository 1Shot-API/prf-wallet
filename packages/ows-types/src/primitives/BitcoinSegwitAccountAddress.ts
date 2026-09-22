import { bech32 } from "@scure/base";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

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

function isValidSegwitP2wpkh(input: string): boolean {
  try {
    const trimmed = input.trim().toLowerCase();
    const decoded = bech32.decode(trimmed);
    if (decoded.prefix !== "bc" && decoded.prefix !== "tb") {
      return false;
    }
    const version = decoded.words[0];
    if (version !== 0) {
      return false;
    }
    const program = bech32.fromWords(decoded.words.slice(1));
    return program.length === 20;
  } catch {
    return false;
  }
}

/** Zod schema: Native SegWit P2WPKH (`bc1q` / `tb1q`), bech32-validated. */
export const BitcoinSegwitAccountAddressSchema = z
  .string()
  .refine(isValidSegwitP2wpkh, {
    message: "must be a Native SegWit P2WPKH address (bc1q / tb1q)",
  })
  .transform((s) => BitcoinSegwitAccountAddress(s.trim().toLowerCase()));
