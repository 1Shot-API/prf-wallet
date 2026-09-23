import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A Solana cluster id sentinel.
 *
 * Example: `"Solana"`
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

/** Zod schema: Solana cluster sentinel. */
export const SolanaChainIdSchema = z
  .enum(["Solana", "SolanaDevnet", "SolanaTestnet"])
  .transform((s) => SolanaChainId(s));
