import { base58 } from "@scure/base";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded Solana **transaction** signature / signature status id
 * (explorer tx id). Same wire shape as {@link SolanaSignature}; branded so
 * call sites do not mix message signatures with submitted transaction ids.
 */
export type SolanaTransactionSignature = Brand<
  string,
  "SolanaTransactionSignature"
>;
export const SolanaTransactionSignature = make<SolanaTransactionSignature>();

function isValidSolanaTxSignature(input: string): boolean {
  const trimmed = input.trim();
  try {
    return base58.decode(trimmed).length === 64;
  } catch {
    return false;
  }
}

/** Zod schema: base58 Solana transaction signature decoding to 64 bytes. */
export const SolanaTransactionSignatureSchema = z
  .string()
  .refine(isValidSolanaTxSignature, {
    message: "must be a base58 Solana transaction signature (64-byte ed25519)",
  })
  .transform((s) => SolanaTransactionSignature(s.trim()));
