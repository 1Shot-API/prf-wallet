import { EVMTransactionHashSchema } from "./EVMTransactionHash.js";
import type { EVMTransactionHash } from "./EVMTransactionHash.js";
import { SolanaTransactionHashSchema } from "./SolanaTransactionHash.js";
import type { SolanaTransactionHash } from "./SolanaTransactionHash.js";

/**
 * Cross-chain transaction id for APIs that can surface either an EVM hex
 * hash or a Solana base58 transaction id (e.g. CCTP burn / Iris forward).
 */
export type TransactionHash = EVMTransactionHash | SolanaTransactionHash;

/**
 * Brand a raw explorer / Iris tx id as EVM or Solana. Returns null when
 * neither shape matches.
 */
export function parseTransactionHash(raw: string): TransactionHash | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const evm = EVMTransactionHashSchema.safeParse(trimmed);
  if (evm.success) {
    return evm.data;
  }
  const solana = SolanaTransactionHashSchema.safeParse(trimmed);
  if (solana.success) {
    return solana.data;
  }
  return null;
}
