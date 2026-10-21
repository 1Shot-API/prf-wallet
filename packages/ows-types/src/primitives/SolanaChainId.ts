import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A Solana cluster id as a Wallet Standard / CAIP-2 sentinel.
 *
 * Example: `"solana:mainnet"`
 */
export type SolanaChainId = Brand<
  "solana:mainnet" | "solana:devnet" | "solana:testnet",
  "SolanaChainId"
>;
export const SolanaChainId = make<SolanaChainId>();

export const SOLANA_MAINNET_CHAIN_ID: SolanaChainId =
  SolanaChainId("solana:mainnet");
export const SOLANA_DEVNET_CHAIN_ID: SolanaChainId =
  SolanaChainId("solana:devnet");
export const SOLANA_TESTNET_CHAIN_ID: SolanaChainId =
  SolanaChainId("solana:testnet");

/**
 * CAIP-2 / Wallet Standard cluster identifiers.
 * Identical to the branded sentinels (kept for parity with {@link BITCOIN_CAIP2}).
 */
export const SOLANA_CAIP2 = {
  MAINNET: "solana:mainnet",
  DEVNET: "solana:devnet",
  TESTNET: "solana:testnet",
} as const;

/** Zod schema: Solana CAIP-2 cluster sentinel. */
export const SolanaChainIdSchema = z
  .enum(["solana:mainnet", "solana:devnet", "solana:testnet"])
  .transform((s) => SolanaChainId(s));
