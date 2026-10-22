import { getAddressEncoder } from "@solana/addresses";

import { Base64String } from "../primitives/Base64String.js";
import { Base64UrlEncodedString } from "../primitives/Base64UrlEncodedString.js";
import type { EVMAccountAddress } from "../primitives/EVMAccountAddress.js";
import type { EVMContractAddress } from "../primitives/EVMContractAddress.js";
import { HexString } from "../primitives/HexString.js";
import type { SolanaAccountAddress } from "../primitives/SolanaAccountAddress.js";
import type { SolanaATAAddress } from "../primitives/SolanaATAAddress.js";
import type { SolanaProgramAddress } from "../primitives/SolanaProgramAddress.js";

import { SolanaAddressUtils } from "./SolanaAddressUtils.js";

/** EVM account or contract address (same 20-byte wire shape). */
export type EVMAddressLike = EVMAccountAddress | EVMContractAddress;

/** Solana 32-byte pubkey brands (account / program / ATA). */
export type SolanaPubkeyLike =
  | SolanaAccountAddress
  | SolanaProgramAddress
  | SolanaATAAddress;

/**
 * Shared branded encoding/decoding helpers (hex, UTF-8, base64, base64url).
 * Prefer these over local copies outside `@1shotapi/ows-signer`.
 */
export class ConversionUtils {
  /** Decode a `0x`-prefixed {@link HexString} to bytes (pads odd-length hex). */
  static hexToBytes(hex: HexString): Uint8Array {
    let stripped = String(hex);
    if (stripped.startsWith("0x") || stripped.startsWith("0X")) {
      stripped = stripped.slice(2);
    }
    if (stripped.length % 2 !== 0) {
      stripped = `0${stripped}`;
    }
    const bytes = new Uint8Array(stripped.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * Narrow an unknown value to {@link Uint8Array}, or throw.
   * @param label — included in the error message (e.g. field name).
   */
  static asUint8Array(value: unknown, label = "value"): Uint8Array {
    if (!(value instanceof Uint8Array)) {
      throw new Error(`${label} must be bytes`);
    }
    return value;
  }

  /** Encode bytes as a `0x`-prefixed {@link HexString}. */
  static bytesToHex(bytes: Uint8Array): HexString {
    return HexString(
      `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`,
    );
  }

  /**
   * Left-pad a 20-byte EVM address to `bytes32` (32-byte hex).
   * Accepts checksummed or lowercase `0x` addresses; output is lowercase.
   * Does not perform EIP-55 checksum validation — pass a branded
   * {@link EVMAccountAddress} / {@link EVMContractAddress} (or equivalent).
   */
  static addressToBytes32Hex(address: EVMAddressLike | `0x${string}`): HexString {
    const normalized = String(address).toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
      throw new Error(
        "address must be a 20-byte 0x-prefixed hex string",
      );
    }
    return HexString(`0x${"0".repeat(24)}${normalized.slice(2)}`);
  }

  /**
   * Left-pad a 20-byte EVM address to a 32-byte Solana pubkey (CCTP
   * `mintRecipient` when burning on Solana toward an EVM destination).
   */
  static addressToSolanaPubkeyBytes(
    address: EVMAddressLike,
  ): Uint8Array {
    return ConversionUtils.hexToBytes(
      ConversionUtils.addressToBytes32Hex(address),
    );
  }

  /**
   * Encode a Solana base58 pubkey (account / program / ATA) as `bytes32` hex
   * (CCTP `mintRecipient` when burning on EVM toward Solana).
   */
  static solanaAccountToBytes32(address: SolanaPubkeyLike): HexString {
    const bytes = new Uint8Array(
      getAddressEncoder().encode(SolanaAddressUtils.toKitAddress(address)),
    );
    if (bytes.length !== 32) {
      throw new Error("Solana address must encode to 32 bytes");
    }
    return ConversionUtils.bytesToHex(bytes);
  }

  /** UTF-8 encode a string, then {@link bytesToHex}. */
  static utf8ToHex(value: string): HexString {
    return ConversionUtils.bytesToHex(new TextEncoder().encode(value));
  }

  /** Encode bytes as standard base64 ({@link Base64String}). */
  static bytesToBase64(bytes: Uint8Array): Base64String {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return Base64String(btoa(binary));
  }

  /** Decode standard base64 ({@link Base64String}) to bytes. */
  static base64ToBytes(value: Base64String): Uint8Array {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  /** Encode bytes as unpadded base64url. */
  static bytesToBase64Url(bytes: Uint8Array): Base64UrlEncodedString {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return Base64UrlEncodedString(
      btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    );
  }

  /** Decode unpadded (or padded) base64url to bytes. */
  static base64UrlToBytes(value: Base64UrlEncodedString): Uint8Array {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /** UTF-8 JSON → branded base64url (JWT header/payload segments). */
  static encodeJsonBase64Url(value: unknown): Base64UrlEncodedString {
    return ConversionUtils.bytesToBase64Url(
      new TextEncoder().encode(JSON.stringify(value)),
    );
  }

  /** Decode a base64url JSON segment (unpadded JWT header/payload). */
  static decodeJsonBase64Url<T>(segment: string): T {
    const bytes = ConversionUtils.base64UrlToBytes(
      Base64UrlEncodedString(segment),
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }
}
