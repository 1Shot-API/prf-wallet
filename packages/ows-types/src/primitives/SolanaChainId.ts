import { type Brand, make } from "ts-brand";

/**
 * A Solana cluster id sentinel.
 */
export type SolanaChainId = Brand<
  "Solana" | "SolanaDevnet" | "SolanaTestnet",
  "SolanaChainId"
>;
export const SolanaChainId = make<SolanaChainId>();

export const SOLANA_MAINNET_CHAIN_ID: SolanaChainId = SolanaChainId("Solana");
export const SOLANA_DEVNET_CHAIN_ID: SolanaChainId =
  SolanaChainId("SolanaDevnet");
export const SOLANA_TESTNET_CHAIN_ID: SolanaChainId =
  SolanaChainId("SolanaTestnet");
