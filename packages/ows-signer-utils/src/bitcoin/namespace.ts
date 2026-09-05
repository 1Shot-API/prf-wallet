import {
  BITCOIN_MAINNET_CHAIN_ID,
  ConversionUtils,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress,
  type CeremonyUiParams,
  type CredentialId,
  type SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import type { OWSSigner } from "../owssigner.js";
import { addressFromSecp256k1PublicKey } from "./address.js";
import {
  finalizeBitcoinTransaction,
  prepareBitcoinTransaction,
  type IBitcoinSignedTransactionResult,
  type IBitcoinUnsignedTransaction,
} from "./marshal.js";

export type BitcoinCallOptions = CeremonyUiParams & {
  credentialId?: CredentialId;
};

export class BitcoinSigner {
  constructor(private readonly signer: OWSSigner) {}

  /**
   * Return the P2WPKH address for the given chain ID (mainnet -1 or testnet -2).
   */
  async getAccountAddress(
    chainId: BitcoinChainId = BITCOIN_MAINNET_CHAIN_ID,
    options?: BitcoinCallOptions,
  ): Promise<BitcoinSegwitAccountAddress> {
    const cached = this.signer.getCachedBitcoinSegwitAddress(chainId);
    if (cached) return cached;

    const publicKeyData = await this.signer.getPublicKey({
      credentialId: options?.credentialId ?? this.signer.getCredentialId(),
      explanationHeader: options?.explanationHeader,
      explanationText: options?.explanationText,
      confirmButtonText: options?.confirmButtonText,
      denyButtonText: options?.denyButtonText,
    });

    const address = addressFromSecp256k1PublicKey(
      publicKeyData.secp256k1PublicKey,
      chainId,
    );
    this.signer.setCachedBitcoinSegwitAddress(chainId, address);
    return address;
  }

  /**
   * Sign one or more Bitcoin P2WPKH transactions in a single ceremony.
   */
  async signTransaction(
    transactions: IBitcoinUnsignedTransaction[],
    options?: BitcoinCallOptions,
  ): Promise<IBitcoinSignedTransactionResult[]> {
    if (transactions.length === 0) return [];

    let publicKey: SECP256K1PublicKey | undefined =
      this.signer.getLastPublicKeyData()?.secp256k1PublicKey;

    if (!publicKey) {
      const pubKeyData = await this.signer.getPublicKey({
        credentialId: options?.credentialId ?? this.signer.getCredentialId(),
        explanationHeader: options?.explanationHeader,
        explanationText: options?.explanationText,
        confirmButtonText: options?.confirmButtonText,
        denyButtonText: options?.denyButtonText,
      });
      publicKey = pubKeyData.secp256k1PublicKey;
    }

    const preparedList = transactions.map((tx) =>
      prepareBitcoinTransaction(tx, publicKey!),
    );

    const allDigests = preparedList.flatMap((p) =>
      p.sighashes.map((sh) => ({
        digestData: ConversionUtils.bytesToHex(sh),
        scheme: "secp256k1-ecdsa" as const,
      })),
    );

    const results = await this.signer.signDigest(allDigests, {
      credentialId: options?.credentialId ?? this.signer.getCredentialId(),
      explanationHeader: options?.explanationHeader,
      explanationText: options?.explanationText,
      confirmButtonText: options?.confirmButtonText,
      denyButtonText: options?.denyButtonText,
    });

    let offset = 0;
    const signedResults: IBitcoinSignedTransactionResult[] = [];

    for (const prepared of preparedList) {
      const count = prepared.sighashes.length;
      const txSignatures = results
        .slice(offset, offset + count)
        .map((r) => r.signature);
      offset += count;

      const finalized = finalizeBitcoinTransaction(prepared, txSignatures);
      signedResults.push(finalized);
    }

    return signedResults;
  }
}
