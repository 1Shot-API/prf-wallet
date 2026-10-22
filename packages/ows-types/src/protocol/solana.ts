import type { Base64String } from "../primitives/Base64String.js";
import type { DomainString } from "../primitives/DomainString.js";
import type { ISO8601DateTime } from "../primitives/ISO8601DateTime.js";
import type { SolanaAccountAddress } from "../primitives/SolanaAccountAddress.js";
import type { SolanaChainId } from "../primitives/SolanaChainId.js";
import type { SolanaSignature } from "../primitives/SolanaSignature.js";
import type { SolanaTransactionHash } from "../primitives/SolanaTransactionHash.js";
import type { UriString } from "../primitives/UriString.js";

/**
 * Namespaced Postmate wire keys for Solana methods (Host ↔ Branding).
 *
 * Anticipated Wallet Standard / product mapping:
 * - connect / account → {@link SOLANA_WIRE_METHODS.getAccountAddress}
 * - `solana:signMessage` → {@link SOLANA_WIRE_METHODS.signMessage}
 * - `solana:signIn` (SIWS) → {@link SOLANA_WIRE_METHODS.signIn} (Branding formats; signs via message)
 * - `solana:signTransaction` → {@link SOLANA_WIRE_METHODS.signTransaction}
 * - `solana:signAndSendTransaction` → {@link SOLANA_WIRE_METHODS.signAndSendTransaction}
 */
export const SOLANA_WIRE_METHODS = {
  getAccountAddress: "solana.getAccountAddress",
  signMessage: "solana.signMessage",
  signTransaction: "solana.signTransaction",
  signAndSendTransaction: "solana.signAndSendTransaction",
  signIn: "solana.signIn",
} as const;

export type SolanaWireMethod =
  (typeof SOLANA_WIRE_METHODS)[keyof typeof SOLANA_WIRE_METHODS];

export interface ISolanaGetAccountAddressParams {
  chainId?: SolanaChainId;
}

/** Compiled transaction message bytes as base64 (Host/Branding wire). */
export interface ISolanaSignMessageParams {
  /** One or more UTF-8 / arbitrary message payloads as base64. */
  messages: Base64String[];
}

export interface ISolanaSignMessageResult {
  signatures: SolanaSignature[];
}

export interface ISolanaSignTransactionParams {
  /**
   * One or more compiled Solana transaction **message** payloads as base64
   * (Kit `messageBytes` / Wallet Standard serialized message — not a full
   * signed wire transaction).
   */
  transactions: Base64String[];
}

export interface ISolanaSignTransactionResult {
  signatures: SolanaSignature[];
}

export interface ISolanaSignAndSendTransactionParams {
  /** Compiled transaction message bytes as base64. */
  transaction: Base64String;
  chainId?: SolanaChainId;
}

export interface ISolanaSignAndSendTransactionResult {
  signature: SolanaTransactionHash;
}

/**
 * SIWS input fields (Wallet Standard `solana:signIn`). Branding constructs the
 * message; structure refined in Phase 5.
 *
 * Timestamps stay {@link ISO8601DateTime} (SIWS wire is ISO strings), not
 * {@link UnixTimestamp}.
 */
export interface ISolanaSignInParams {
  domain?: DomainString;
  address?: SolanaAccountAddress;
  /** Free-form purpose text (no newlines in SIWS). */
  statement?: string;
  uri?: UriString;
  /** SIWS version string (typically `"1"`). */
  version?: string;
  chainId?: SolanaChainId;
  /** Replay nonce (≥8 alphanumeric in SIWS). */
  nonce?: string;
  issuedAt?: ISO8601DateTime;
  expirationTime?: ISO8601DateTime;
  notBefore?: ISO8601DateTime;
  requestId?: string;
  resources?: UriString[];
}

export interface ISolanaSignInResult {
  account: SolanaAccountAddress;
  /** UTF-8 message bytes that were signed, as standard base64. */
  signedMessage: Base64String;
  signature: SolanaSignature;
}

/** Shared contract for `proxy.solana` (host) and `wallet.solana` (branding). */
export interface IOpenWalletSolanaProvider {
  getAccountAddress(
    params?: ISolanaGetAccountAddressParams,
  ): Promise<SolanaAccountAddress>;

  signMessage(
    params: ISolanaSignMessageParams,
  ): Promise<ISolanaSignMessageResult>;

  signTransaction(
    params: ISolanaSignTransactionParams,
  ): Promise<ISolanaSignTransactionResult>;

  signAndSendTransaction(
    params: ISolanaSignAndSendTransactionParams,
  ): Promise<ISolanaSignAndSendTransactionResult>;

  signIn(params?: ISolanaSignInParams): Promise<ISolanaSignInResult>;
}
