import {
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { base58 } from "@scure/base";
import { hexToBytes, type Hex } from "viem";

/** Solana address = base58-encoded ed25519 public key (32 bytes). */
export function addressFromEd25519PublicKey(
  ed25519PublicKey: Hex,
): SolanaAccountAddress {
  return SolanaAccountAddress(base58.encode(hexToBytes(ed25519PublicKey)));
}
