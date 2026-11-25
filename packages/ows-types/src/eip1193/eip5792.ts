import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  HexString,
} from "../primitives/index.js";

/** `wallet_sendCalls` / `wallet_getCallsStatus` version this wallet speaks. */
export const WALLET_CALLS_VERSION = "2.0.0" as const;

export type AtomicCapabilityStatus = "supported" | "ready" | "unsupported";

export interface IAtomicCapability {
  status: AtomicCapabilityStatus;
}

/**
 * Capability object on `wallet_sendCalls`. `optional: true` means a wallet
 * that does not implement the capability still processes the batch.
 */
export interface IWalletCallCapability {
  optional?: boolean;
  [key: string]: unknown;
}

export interface IWalletCall {
  to?: EVMAccountAddress;
  data?: HexString;
  value?: HexString;
  capabilities?: Record<string, IWalletCallCapability>;
}

/** EIP-5792 `wallet_sendCalls` params object (the single tuple element). */
export interface ISendCallsParams {
  version: typeof WALLET_CALLS_VERSION;
  id?: string;
  from?: EVMAccountAddress;
  chainId: EVMChainId;
  atomicRequired: boolean;
  calls: readonly IWalletCall[];
  capabilities?: Record<string, IWalletCallCapability>;
}

export interface ISendCallsResult {
  id: string;
  capabilities?: Record<string, unknown>;
}

export interface ICallsReceiptLog {
  address: EVMAccountAddress;
  data: HexString;
  topics: HexString[];
}

/** Subset of an `eth_getTransactionReceipt` object, per EIP-5792. */
export interface ICallsReceipt {
  logs: ICallsReceiptLog[];
  /** `0x1` success, `0x0` revert. */
  status: HexString;
  blockHash: HexString;
  blockNumber: HexString;
  gasUsed: HexString;
  transactionHash: EVMTransactionHash;
}

export interface IGetCallsStatusResult {
  version: typeof WALLET_CALLS_VERSION;
  id: string;
  chainId: EVMChainId;
  status: number;
  atomic: boolean;
  receipts?: ICallsReceipt[];
  capabilities?: Record<string, unknown>;
}

/** Hex chain id → capabilities. `"0x0"` means every chain. */
export type IGetCapabilitiesResult = Record<
  string,
  {
    atomic?: IAtomicCapability;
  }
>;
