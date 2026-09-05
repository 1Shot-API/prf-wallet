import type { BitcoinChainId } from "./BitcoinChainId.js";
import type { EVMChainId } from "./EVMChainId.js";

/**
 * Union of supported chain ID types across all chain technologies.
 */
export type OWSChainId = EVMChainId | BitcoinChainId;
