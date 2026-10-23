import { address, type Address } from "@solana/addresses";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana account address (32-byte ed25519 public key).
 * Same wire shape as Kit {@link Address}; branded so call sites do not mix
 * wallets with program ids or mints.
 *
 * Example: `"4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw"`
 */
export type SolanaAccountAddress = Brand<string, "SolanaAccountAddress">;
export const SolanaAccountAddress = make<SolanaAccountAddress>();

/** Zod schema: Solana base58 address validated via `@solana/addresses`. */
export const SolanaAccountAddressSchema = z.string().transform((s, ctx) => {
  try {
    return SolanaAccountAddress(address(s.trim()) as string);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "must be a base58 Solana address (32-byte public key)",
    });
    return z.NEVER;
  }
});

/** Coerce a branded account address to Kit {@link Address}. */
export function solanaAccountAddressToKit(
  value: SolanaAccountAddress,
): Address {
  return address(value);
}
