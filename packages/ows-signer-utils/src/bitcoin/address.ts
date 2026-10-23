import {
  BITCOIN_MAINNET_CHAIN_ID,
  ConversionUtils,
  HexString,
  type BitcoinChainId,
  BitcoinSegwitAccountAddress,
  type SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import * as btc from "@scure/btc-signer";

export function compressSecp256k1PublicKey(
  uncompressed: SECP256K1PublicKey | Uint8Array,
): Uint8Array {
  const bytes =
    uncompressed instanceof Uint8Array
      ? uncompressed
      : ConversionUtils.hexToBytes(HexString(uncompressed));

  if (bytes.length === 33) {
    return bytes;
  }

  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error(
      `Invalid uncompressed secp256k1 public key: expected 65 bytes starting with 0x04, got length ${bytes.length}`,
    );
  }

  const compressed = new Uint8Array(33);
  compressed[0] = (bytes[64]! & 1) === 0 ? 2 : 3;
  compressed.set(bytes.subarray(1, 33), 1);
  return compressed;
}

export function bitcoinNetworkForChainId(chainId: BitcoinChainId) {
  return chainId === BITCOIN_MAINNET_CHAIN_ID
    ? btc.NETWORK
    : btc.TEST_NETWORK;
}

/**
 * Derive a Native SegWit (P2WPKH, bc1q/tb1q) address from a secp256k1 public key.
 */
export function addressFromSecp256k1PublicKey(
  publicKey: SECP256K1PublicKey | Uint8Array,
  chainId: BitcoinChainId = BITCOIN_MAINNET_CHAIN_ID,
): BitcoinSegwitAccountAddress {
  const compressed = compressSecp256k1PublicKey(publicKey);
  const network = bitcoinNetworkForChainId(chainId);
  const p2w = btc.p2wpkh(compressed, network);
  if (!p2w.address) {
    throw new Error("Failed to derive P2WPKH address");
  }
  return BitcoinSegwitAccountAddress(p2w.address);
}
