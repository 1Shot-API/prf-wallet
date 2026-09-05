import type { BitcoinChainId } from "../primitives/BitcoinChainId.js";
import type { BitcoinSegwitAccountAddress } from "../primitives/BitcoinSegwitAccountAddress.js";

/** Namespaced Postmate wire keys for Bitcoin methods. */
export const BITCOIN_WIRE_METHODS = {
  getAccountAddresses: "bitcoin.getAccountAddresses",
} as const;

export type BitcoinWireMethod =
  (typeof BITCOIN_WIRE_METHODS)[keyof typeof BITCOIN_WIRE_METHODS];

/**
 * An address descriptor conforming to the Reown / BIP-122 static-wallet pattern.
 */
export interface IBitcoinAccountAddressEntry {
  address: BitcoinSegwitAccountAddress;
  /** Compressed public key in hex format without 0x prefix. */
  publicKey?: string;
  /** Derivation path (omitted for static non-HD wallets). */
  path?: string;
  /** Intention of the address (e.g. "payment" or "ordinal"). */
  intention?: "payment" | "ordinal" | string;
}

export interface IBitcoinGetAccountAddressesParams {
  account?: string;
  intentions?: string[];
  chainId?: BitcoinChainId;
}

/** Shared contract for proxy.bitcoin (host) and wallet.bitcoin (branding). */
export interface IOpenWalletBitcoinProvider {
  getAccountAddresses(
    params?: IBitcoinGetAccountAddressesParams,
  ): Promise<IBitcoinAccountAddressEntry[]>;
}
