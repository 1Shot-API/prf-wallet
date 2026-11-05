import { base58 } from "@scure/base";
import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A base58-encoded 64-byte Ed25519 signature (Solana message / tx signature wire).
 *
 * Example: `"5VERv8NMvzbJ…"` (length varies with base58 encoding of 64 bytes)
 */
export type SolanaSignature = Brand<string, "SolanaSignature">;
export const SolanaSignature = make<SolanaSignature>();

function isValidSolanaSignature(input: string): boolean {
  const trimmed = input.trim();
  try {
    return base58.decode(trimmed).length === 64;
  } catch {
    return false;
  }
}

/** Zod schema: base58 Ed25519 signature decoding to 64 bytes. */
export const SolanaSignatureSchema = z
  .string()
  .refine(isValidSolanaSignature, {
    message: "must be a base58 Solana signature (64-byte ed25519)",
  })
  .transform((s) => SolanaSignature(s.trim()));
