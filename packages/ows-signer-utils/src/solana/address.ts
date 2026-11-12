import {
  ConversionUtils,
  HexString,
  SolanaAccountAddress,
  type ED25519PublicKey,
} from "@1shotapi/ows-types";
import { base58 } from "@scure/base";

/** Solana address = base58-encoded ed25519 public key (32 bytes). */
export function addressFromEd25519PublicKey(
  ed25519PublicKey: ED25519PublicKey,
): SolanaAccountAddress {
  return SolanaAccountAddress(
    base58.encode(ConversionUtils.hexToBytes(HexString(ed25519PublicKey))),
  );
}
