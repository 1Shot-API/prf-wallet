import { getAddress } from "viem";
import { getEnsAddress } from "viem/actions";
import {
  BitcoinAccountAddress,
  EVMAccountAddress,
  type EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "./IBlockchainProvider.js";

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const EVM_ADDRESS_BARE_RE = /^[0-9a-fA-F]{40}$/;
/** Solana base58 alphabet (no 0, O, I, l). */
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BITCOIN_HEX_RE = /^(0x)?[0-9a-fA-F]{40,64}$/;
const BITCOIN_BECH32_RE = /^(bc1|tb1|bcrt1)[0-9a-z]{6,87}$/i;
const BITCOIN_BASE58_RE = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{25,35}$/;

/**
 * Validates and brands account addresses. EVM paths may resolve ENS via the
 * injected {@link IBlockchainProvider}.
 */
export class AddressUtils {
  constructor(private readonly blockchain: IBlockchainProvider) {}

  /**
   * Normalize a hex EVM address (EIP-55 checksum) or resolve an ENS name on
   * `chainId` (also returned checksummed).
   */
  async validateEVMAddress(
    input: string,
    chainId: EVMChainId,
  ): Promise<EVMAccountAddress> {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error("Empty address");
    }

    if (trimmed.includes(".")) {
      const client = this.blockchain.getPublicClient(chainId);
      const resolved = await getEnsAddress(client, { name: trimmed });
      if (!resolved) {
        throw new Error(`Unable to resolve ENS name: ${trimmed}`);
      }
      return EVMAccountAddress(getAddress(resolved));
    }

    let hex = trimmed;
    if (EVM_ADDRESS_BARE_RE.test(hex)) {
      hex = `0x${hex}`;
    }
    if (!EVM_ADDRESS_RE.test(hex)) {
      throw new Error(`Invalid EVM address: ${input}`);
    }
    try {
      return EVMAccountAddress(getAddress(hex as `0x${string}`));
    } catch {
      throw new Error(`Invalid EVM address: ${input}`);
    }
  }

  /** Validate a Solana base58 address. */
  validateSolanaAddress(input: string): SolanaAccountAddress {
    const trimmed = input.trim();
    if (!SOLANA_BASE58_RE.test(trimmed)) {
      throw new Error(`Invalid Solana address: ${input}`);
    }
    return SolanaAccountAddress(trimmed);
  }

  /**
   * Validate a Bitcoin address (hex with optional 0x, bech32, or base58 legacy).
   */
  validateBitcoinAddress(input: string): BitcoinAccountAddress {
    const trimmed = input.trim();
    if (BITCOIN_HEX_RE.test(trimmed)) {
      const withPrefix = trimmed.startsWith("0x") || trimmed.startsWith("0X")
        ? `0x${trimmed.slice(2).toLowerCase()}`
        : `0x${trimmed.toLowerCase()}`;
      return BitcoinAccountAddress(withPrefix);
    }
    if (BITCOIN_BECH32_RE.test(trimmed) || BITCOIN_BASE58_RE.test(trimmed)) {
      return BitcoinAccountAddress(trimmed);
    }
    throw new Error(`Invalid Bitcoin address: ${input}`);
  }
}
