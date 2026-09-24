import { EChainTechnology } from "../enums/EChainTechnology.js";
import { OwsInvalidParamsError } from "../errors/rpc.js";
import {
  BITCOIN_CAIP2,
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  type BitcoinChainId as BitcoinChainIdType,
} from "../primitives/BitcoinChainId.js";
import {
  EVMChainIdSchema,
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

  /**
   * Normalize an EIP-155 chain id into a branded {@link EVMChainId}
   * (`0x` + lowercase hex, no leading zeros).
   *
   * Accepts hex strings (`0x01`, `0XAA`), decimal strings (`8453`),
   * numbers, and bigints. Trims string input. Prefer this at validation /
   * derivation boundaries so branded ids compare with `===`.
   *
   * @throws {OwsInvalidParamsError} when `value` is not a valid chain id
   */
  static asEVMChainId(value: number | string | bigint): EVMChainIdType {
    try {
      if (typeof value === "number") {
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          throw new OwsInvalidParamsError(`Invalid chainId: ${String(value)}`);
        }
        return EVMChainIdSchema.parse(`0x${BigInt(value).toString(16)}`);
      }
      if (typeof value === "bigint") {
        if (value < 0n) {
          throw new OwsInvalidParamsError(`Invalid chainId: ${String(value)}`);
        }
        return EVMChainIdSchema.parse(`0x${value.toString(16)}`);
      }
      const trimmed = value.trim();
      if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
        // Schema requires a lowercase `0x` prefix; hex body case is normalized by BigInt.
        return EVMChainIdSchema.parse(`0x${trimmed.slice(2)}`);
      }
      if (/^[0-9]+$/.test(trimmed)) {
        return EVMChainIdSchema.parse(`0x${BigInt(trimmed).toString(16)}`);
      }
      throw new OwsInvalidParamsError(`Invalid chainId: ${String(value)}`);
    } catch (error) {
      if (error instanceof OwsInvalidParamsError) throw error;
      throw new OwsInvalidParamsError(`Invalid chainId: ${String(value)}`);
    }
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
