import { address, type Address } from "@solana/addresses";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana **associated token account** (ATA) address.
 * Same wire shape as {@link SolanaAccountAddress} / {@link SolanaMintAddress};
 * branded separately so mint catalogs, wallets, and ATAs stay distinct
 * (e.g. CCTP `mintRecipient`, tracked-asset ATA fields).
 */
export type SolanaATAAddress = Brand<string, "SolanaATAAddress">;
export const SolanaATAAddress = make<SolanaATAAddress>();

/** Zod schema: Solana ATA address validated via `@solana/addresses`. */
export const SolanaATAAddressSchema = z.string().transform((s, ctx) => {
  try {
    return SolanaATAAddress(address(s.trim()) as string);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "must be a base58 Solana ATA address (32-byte public key)",
    });
    return z.NEVER;
  }
});

/** Coerce a branded ATA address to Kit {@link Address}. */
export function solanaAtaAddressToKit(value: SolanaATAAddress): Address {
  return address(value);
}
