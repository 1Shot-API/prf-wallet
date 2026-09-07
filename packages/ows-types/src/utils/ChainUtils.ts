import { EChainTechnology } from "../enums/EChainTechnology.js";
import {
  BITCOIN_CAIP2,
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  type BitcoinChainId as BitcoinChainIdType,
} from "../primitives/BitcoinChainId.js";
import {
  EVMChainId,
  type EVMChainId as EVMChainIdType,
} from "../primitives/EVMChainId.js";
import type { OWSChainId } from "../primitives/OWSChainId.js";
import {
  SOLANA_DEVNET_CHAIN_ID,
  SOLANA_MAINNET_CHAIN_ID,
  SOLANA_TESTNET_CHAIN_ID,
  type SolanaChainId as SolanaChainIdType,
} from "../primitives/SolanaChainId.js";

const EVM_CHAIN_ID_RE = /^0x[0-9a-fA-F]+$/;

/**
 * Narrow / normalize {@link OWSChainId} values across EVM, Bitcoin, and Solana.
 */
export class ChainUtils {
  static isBitcoinChainId(chainId: unknown): chainId is BitcoinChainIdType {
    return (
      chainId === BITCOIN_MAINNET_CHAIN_ID ||
      chainId === BITCOIN_TESTNET_CHAIN_ID
    );
  }

  /** Brand a known Bitcoin sentinel, or throw. */
  static asBitcoinChainId(chainId: unknown): BitcoinChainIdType {
    if (ChainUtils.isBitcoinChainId(chainId)) {
      return chainId;
    }
    throw new Error(`Invalid BitcoinChainId: ${String(chainId)}`);
  }

  static isEVMChainId(chainId: unknown): chainId is EVMChainIdType {
    return typeof chainId === "string" && EVM_CHAIN_ID_RE.test(chainId);
  }

  /** Brand a hex EIP-155 chain id, or throw. */
  static asEVMChainId(chainId: unknown): EVMChainIdType {
    if (typeof chainId !== "string" || !EVM_CHAIN_ID_RE.test(chainId)) {
      throw new Error(`Invalid EVMChainId: ${String(chainId)}`);
    }
    return EVMChainId(chainId.toLowerCase() as `0x${string}`);
  }

  static isSolanaChainId(chainId: unknown): chainId is SolanaChainIdType {
    return (
      chainId === SOLANA_MAINNET_CHAIN_ID ||
      chainId === SOLANA_DEVNET_CHAIN_ID ||
      chainId === SOLANA_TESTNET_CHAIN_ID
    );
  }

  /** Brand a known Solana sentinel, or throw. */
  static asSolanaChainId(chainId: unknown): SolanaChainIdType {
    if (ChainUtils.isSolanaChainId(chainId)) {
      return chainId;
    }
    throw new Error(`Invalid SolanaChainId: ${String(chainId)}`);
  }

  /** Map a branded chain id to its address / signing family. */
  static technologyFor(chainId: OWSChainId): EChainTechnology {
    if (ChainUtils.isBitcoinChainId(chainId)) {
      return EChainTechnology.Bitcoin;
    }
    if (ChainUtils.isSolanaChainId(chainId)) {
      return EChainTechnology.Solana;
    }
    return EChainTechnology.Evm;
  }

  static bitcoinChainIdToCaip2(chainId: BitcoinChainIdType): string {
    return chainId === BITCOIN_MAINNET_CHAIN_ID
      ? BITCOIN_CAIP2.MAINNET
      : BITCOIN_CAIP2.TESTNET;
  }

  static caip2ToBitcoinChainId(
    caip2: string,
  ): BitcoinChainIdType | undefined {
    if (caip2 === BITCOIN_CAIP2.MAINNET) return BITCOIN_MAINNET_CHAIN_ID;
    if (caip2 === BITCOIN_CAIP2.TESTNET) return BITCOIN_TESTNET_CHAIN_ID;
    return undefined;
  }
}
