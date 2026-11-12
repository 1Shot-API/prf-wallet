import { base58 } from "@scure/base";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana transaction id (explorer tx hash).
 * On Solana this is the ed25519 signature of the transaction — same wire
 * shape as a message {@link SolanaSignature}, branded so call sites do not
 * mix message signatures with submitted transaction ids.
 */
export type SolanaTransactionHash = Brand<string, "SolanaTransactionHash">;
export const SolanaTransactionHash = make<SolanaTransactionHash>();

function isValidSolanaTxHash(input: string): boolean {
  const trimmed = input.trim();
  try {
    return base58.decode(trimmed).length === 64;
  } catch {
    return false;
  }
}

/** Zod schema: base58 Solana transaction id decoding to 64 bytes. */
export const SolanaTransactionHashSchema = z
  .string()
  .refine(isValidSolanaTxHash, {
    message: "must be a base58 Solana transaction hash (64-byte ed25519)",
  })
  .transform((s) => SolanaTransactionHash(s.trim()));
