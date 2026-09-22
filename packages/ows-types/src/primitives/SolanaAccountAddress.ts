import { base58 } from "@scure/base";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana account address (32-byte ed25519 public key).
 *
 * Example: `"4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw"`
 */
export type SolanaAccountAddress = Brand<string, "SolanaAccountAddress">;
export const SolanaAccountAddress = make<SolanaAccountAddress>();

const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(input: string): boolean {
  const trimmed = input.trim();
  if (!SOLANA_BASE58_RE.test(trimmed)) {
    return false;
  }
  try {
    return base58.decode(trimmed).length === 32;
  } catch {
    return false;
  }
}

/** Zod schema: Solana base58 address decoding to 32 bytes. */
export const SolanaAccountAddressSchema = z
  .string()
  .refine(isValidSolanaAddress, {
    message: "must be a base58 Solana address (32-byte public key)",
  })
  .transform((s) => SolanaAccountAddress(s.trim()));
