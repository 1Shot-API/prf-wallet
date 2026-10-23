import { getAddress } from "viem";
import { getEnsAddress } from "viem/actions";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  type BitcoinChainId,
  BitcoinSegwitAccountAddress,
  EVMAccountAddress,
  type EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { bech32 } from "@scure/base";
import type { IBlockchainProvider } from "./IBlockchainProvider.js";

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const EVM_ADDRESS_BARE_RE = /^[0-9a-fA-F]{40}$/;
/** Solana base58 alphabet (no 0, O, I, l). */
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
   * Validate a Bitcoin Native SegWit (P2WPKH) address:
   * bech32-decoded witness version 0, 20-byte witness program, and matching HRP.
   * Rejects non-Segwit formats (hex, legacy base58, and Taproot bc1p/tb1p).
   */
  validateBitcoinSegwitAddress(
    input: string,
    chainId: BitcoinChainId = BITCOIN_MAINNET_CHAIN_ID,
  ): BitcoinSegwitAccountAddress {
    const trimmed = input.trim().toLowerCase();
    const expectedHrp = chainId === BITCOIN_MAINNET_CHAIN_ID ? "bc" : "tb";

    try {
      const decoded = bech32.decode(trimmed);
      if (decoded.prefix !== expectedHrp) {
        throw new Error(
          `Bitcoin address HRP "${decoded.prefix}" does not match expected "${expectedHrp}" for chain ${chainId}`,
        );
      }

      // Witness version 0 (P2WPKH)
      const version = decoded.words[0];
      if (version !== 0) {
        throw new Error(
          `Expected witness version 0 for P2WPKH SegWit address, got version ${version}`,
        );
      }

      // Program bytes (words after version converted from 5-bit to 8-bit)
      const program = bech32.fromWords(decoded.words.slice(1));
      if (program.length !== 20) {
        throw new Error(
          `Expected 20-byte witness program for P2WPKH SegWit address, got ${program.length} bytes`,
        );
      }

      return BitcoinSegwitAccountAddress(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid Bitcoin SegWit address: ${input} (${msg})`);
    }
  }
}
