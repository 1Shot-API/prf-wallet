import type { BitcoinChainId } from "./BitcoinChainId.js";
import { BitcoinChainIdSchema } from "./BitcoinChainId.js";
import type { EVMChainId } from "./EVMChainId.js";
import { EVMChainIdSchema } from "./EVMChainId.js";
import type { SolanaChainId } from "./SolanaChainId.js";
import { SolanaChainIdSchema } from "./SolanaChainId.js";
import { z } from "zod";

/**
 * Union of supported chain ID types across all chain technologies.
 * EVM uses EIP-155 hex (`0x…`); Bitcoin / Solana use descriptive string sentinels.
 *
 * Example: `"0x1"` | `"Bitcoin"` | `"Solana"`
 */
export type OWSChainId = EVMChainId | BitcoinChainId | SolanaChainId;

/** Zod schema: EVM, Bitcoin, or Solana chain id. */
export const OWSChainIdSchema = z.union([
  EVMChainIdSchema,
  BitcoinChainIdSchema,
  SolanaChainIdSchema,
]);
