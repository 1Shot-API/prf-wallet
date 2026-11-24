import { bech32, bech32m, createBase58check } from "@scure/base";
import { sha256 } from "viem";

/** Decoded SegWit address (BIP-173 v0 bech32, BIP-350 v1+ bech32m). */
export interface IBitcoinSegwitProgram {
  version: number;
  program: Uint8Array;
}

/** Decoded legacy base58check address: version byte + 20-byte hash. */
export interface IBitcoinBase58Payload {
  version: number;
  hash: Uint8Array;
}

/**
 * Network-agnostic Bitcoin address decoding (mainnet `bc` / base58 0x00, 0x05;
 * testnet `tb` / base58 0x6f, 0xc4). Backs the Bitcoin address primitive schemas.
 */
export class BitcoinAddressUtils {
  /** P2PKH version bytes: mainnet, testnet. */
  static readonly P2PKH_VERSIONS: ReadonlySet<number> = new Set([0x00, 0x6f]);
  /** P2SH version bytes: mainnet, testnet. */
  static readonly P2SH_VERSIONS: ReadonlySet<number> = new Set([0x05, 0xc4]);

  private static readonly SEGWIT_PREFIXES: ReadonlySet<string> = new Set(["bc", "tb"]);
  private static readonly base58check = createBase58check((data: Uint8Array) =>
    sha256(data, "bytes"),
  );

  /**
   * Decode a mainnet / testnet SegWit address. Enforces single case, the
   * checksum variant for the witness version, and BIP-141 program lengths.
   */
  static decodeSegwit(input: string): IBitcoinSegwitProgram | undefined {
    if (input !== input.toLowerCase() && input !== input.toUpperCase()) {
      return undefined;
    }
    const lower = input.toLowerCase() as `${string}1${string}`;
    for (const codec of [bech32, bech32m]) {
      let decoded: ReturnType<typeof bech32.decode>;
      try {
        decoded = codec.decode(lower);
      } catch {
        continue;
      }
      if (!BitcoinAddressUtils.SEGWIT_PREFIXES.has(decoded.prefix)) return undefined;
      const version = decoded.words[0];
      if (version === undefined || version > 16) return undefined;
      if ((version === 0) !== (codec === bech32)) return undefined;
      let program: Uint8Array;
      try {
        program = codec.fromWords(decoded.words.slice(1));
      } catch {
        return undefined;
      }
      if (program.length < 2 || program.length > 40) return undefined;
      return { version, program };
    }
    return undefined;
  }

  /** Decode a base58check P2PKH / P2SH address (21-byte payload). */
  static decodeBase58(input: string): IBitcoinBase58Payload | undefined {
    let payload: Uint8Array;
    try {
      payload = BitcoinAddressUtils.base58check.decode(input);
    } catch {
      return undefined;
    }
    if (payload.length !== 21) return undefined;
    return { version: payload[0]!, hash: payload.subarray(1) };
  }

  static isSegwitProgram(
    input: string,
    version: number,
    programLength: number,
  ): boolean {
    const decoded = BitcoinAddressUtils.decodeSegwit(input.trim());
    return (
      decoded !== undefined &&
      decoded.version === version &&
      decoded.program.length === programLength
    );
  }

  static isBase58Version(input: string, versions: ReadonlySet<number>): boolean {
    const decoded = BitcoinAddressUtils.decodeBase58(input.trim());
    return decoded !== undefined && versions.has(decoded.version);
  }
}
