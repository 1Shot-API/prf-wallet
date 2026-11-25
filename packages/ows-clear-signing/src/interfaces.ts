import type {
  ClearSigningCanonicalString,
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
} from "@1shotapi/ows-types";

/** Kind of rendered value, so the UI can pick an affordance (copy button, token icon, …). */
export enum EClearSigningDisplayKind {
  Text = "text",
  Address = "address",
  TokenAmount = "tokenAmount",
  NativeAmount = "nativeAmount",
  Date = "date",
  Nft = "nft",
  Calldata = "calldata",
}

/** Transaction being clear-signed (the ERC-7730 EVM transaction container). */
export interface IClearSigningTransaction {
  chainId: EVMChainId;
  from: EVMAccountAddress;
  to: EVMContractAddress;
  data: HexString;
  /** Native value in wei, `0x` hex (as on `eth_sendTransaction`). */
  value: HexString;
}

/** EIP-712 field definition. */
export interface IClearSigningTypedDataField {
  name: string;
  type: string;
}

/** EIP-712 payload (structurally compatible with `eth_signTypedData_v4` input). */
export interface IClearSigningTypedData {
  types: Record<string, ReadonlyArray<IClearSigningTypedDataField>>;
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
}

/** Token symbol + decimals used by `amount` / `tokenAmount` / `tokenTicker`. */
export interface IClearSigningTokenMetadata {
  symbol: string;
  decimals: number;
}

/**
 * Wallet-supplied lookups. The formatter never does network I/O itself; implementations may
 * read local registries, on-chain ERC-20 metadata, address books, etc. Return `null` when
 * unknown; the formatter falls back to raw values with a warning.
 */
export interface IClearSigningEnvironment {
  getTokenMetadata(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<IClearSigningTokenMetadata | null>;
  getNativeCurrency(chainId: EVMChainId): IClearSigningTokenMetadata;
  getChainName(chainId: EVMChainId): string | null;
  getAddressName(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<string | null>;
}

/** One rendered row. */
export interface IClearSigningDisplayField {
  label: string;
  /** Formatted value for display. */
  value: string;
  /** Unformatted value (decimal integers, checksummed addresses, hex bytes) for a raw view. */
  rawValue: ClearSigningCanonicalString;
  kind: EClearSigningDisplayKind;
  /** Set for address-like values (addressName, raw address, calldata callee, nft collection). */
  address: EVMAccountAddress | null;
  /** Set for token-denominated values. */
  tokenAddress: EVMContractAddress | null;
  /** Non-fatal caveat to surface next to the value (e.g. "Unknown token"). */
  warning: string | null;
  /** `visible: "optional"` — UI may collapse it. */
  optional: boolean;
}

/** Label/value pair from an object-form `intent`. */
export interface IClearSigningIntentDetail {
  label: string;
  value: string;
}

/** Fully rendered clear-signing screen model. */
export interface IClearSigningDisplay {
  /** Plain intent; for object intents, the values joined with " · ". */
  intent: string;
  intentDetails: IClearSigningIntentDetail[];
  /** `interpolatedIntent` rendered, or `null` if absent or any interpolation failed. */
  interpolatedIntent: string | null;
  contractName: string | null;
  owner: string | null;
  url: string | null;
  fields: IClearSigningDisplayField[];
}
