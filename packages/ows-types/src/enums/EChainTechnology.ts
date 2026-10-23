import { z } from "zod";

/**
 * Chain technology / address family for multi-chain wallet UX.
 */
export enum EChainTechnology {
  Evm = "evm",
  Solana = "solana",
  Bitcoin = "bitcoin",
}

/** Zod schema: {@link EChainTechnology} string values. */
export const EChainTechnologySchema = z.enum([
  EChainTechnology.Evm,
  EChainTechnology.Solana,
  EChainTechnology.Bitcoin,
]);
