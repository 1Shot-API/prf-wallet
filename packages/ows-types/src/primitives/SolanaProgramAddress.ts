import { address, type Address } from "@solana/addresses";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana **program** id (executable account).
 * Same wire shape as {@link SolanaAccountAddress}; branded separately so call
 * sites do not mix user wallets with System / Token / ATA / CCTP programs.
 *
 * Example: `"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"`
 */
export type SolanaProgramAddress = Brand<string, "SolanaProgramAddress">;
export const SolanaProgramAddress = make<SolanaProgramAddress>();

/** Zod schema: Solana program id validated via `@solana/addresses`. */
export const SolanaProgramAddressSchema = z.string().transform((s, ctx) => {
  try {
    return SolanaProgramAddress(address(s.trim()) as string);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "must be a base58 Solana program address (32-byte public key)",
    });
    return z.NEVER;
  }
});

/** Coerce a branded program address to Kit {@link Address}. */
export function solanaProgramAddressToKit(
  value: SolanaProgramAddress,
): Address {
  return address(value);
}
