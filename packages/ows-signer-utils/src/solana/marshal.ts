import { base58 } from "@scure/base";
import {
  ConversionUtils,
  HexString,
  SolanaSignature,
} from "@1shotapi/ows-types";

const SOLANA_SIGN_SCHEME = "ed25519" as const;

/** Hex payload for Signing Layer `signDigest` with scheme `ed25519`. */
export function digestDataForSolanaBytes(bytes: Uint8Array) {
  return ConversionUtils.bytesToHex(bytes);
}

export function solanaSignatureFromHex(signatureHex: `0x${string}`): SolanaSignature {
  const bytes = ConversionUtils.hexToBytes(HexString(signatureHex));
  if (bytes.length !== 64) {
    throw new Error(
      `Solana ed25519 signature must be 64 bytes, got ${bytes.length}`,
    );
  }
  return SolanaSignature(base58.encode(bytes));
}

export function solanaSignatureToBytes(signature: SolanaSignature): Uint8Array {
  return base58.decode(signature);
}

export { SOLANA_SIGN_SCHEME };
