import type { BitcoinChainId } from "./BitcoinChainId.js";
import type { EVMChainId } from "./EVMChainId.js";
import type { SolanaChainId } from "./SolanaChainId.js";

/**
 * Union of supported chain ID types across all chain technologies.
 * EVM uses EIP-155 hex (`0x…`); Bitcoin / Solana use descriptive string sentinels.
 */
export type OWSChainId = EVMChainId | BitcoinChainId | SolanaChainId;
