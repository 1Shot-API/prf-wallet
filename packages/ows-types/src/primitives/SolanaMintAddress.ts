import { address, type Address } from "@solana/addresses";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana **mint** account (SPL Token / Token-2022).
 * Same wire shape as {@link SolanaAccountAddress}; branded separately so asset
 * catalogs do not mix mints with user wallets or program ids.
 *
 * Example (mainnet USDC): `"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"`
 */
export type SolanaMintAddress = Brand<string, "SolanaMintAddress">;
export const SolanaMintAddress = make<SolanaMintAddress>();

/** Zod schema: Solana mint address validated via `@solana/addresses`. */
export const SolanaMintAddressSchema = z.string().transform((s, ctx) => {
  try {
    return SolanaMintAddress(address(s.trim()) as string);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "must be a base58 Solana mint address (32-byte public key)",
    });
    return z.NEVER;
  }
});

/** Coerce a branded mint address to Kit {@link Address}. */
export function solanaMintAddressToKit(value: SolanaMintAddress): Address {
  return address(value);
}
