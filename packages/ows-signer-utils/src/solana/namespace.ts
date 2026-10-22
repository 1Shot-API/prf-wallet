import type {
  CeremonyUiParams,
  CredentialId,
  SolanaAccountAddress,
  SolanaSignature,
} from "@1shotapi/ows-types";
import type { OWSSigner } from "../owssigner.js";
import { addressFromEd25519PublicKey } from "./address.js";
import {
  digestDataForSolanaBytes,
  SOLANA_SIGN_SCHEME,
  solanaSignatureFromHex,
  solanaSignatureToBytes,
} from "./marshal.js";

export type SolanaCallOptions = CeremonyUiParams & {
  credentialId?: CredentialId;
};

/** Compiled Solana transaction message bytes (Kit `messageBytes` / Standard). */
export type ISolanaSignTransactionInput = {
  messageBytes: Uint8Array;
};

export type ISolanaSignedTransaction = {
  signature: SolanaSignature;
  signatureBytes: Uint8Array;
};

export class SolanaSigner {
  constructor(private readonly signer: OWSSigner) {}

  async getAccountAddress(
    options?: SolanaCallOptions,
  ): Promise<SolanaAccountAddress> {
    const cached = this.signer.getCachedSolanaAddress();
    if (cached) return cached;

    const publicKey = await this.signer.getPublicKey({
      credentialId: options?.credentialId ?? this.signer.getCredentialId(),
      explanationHeader: options?.explanationHeader,
      explanationText: options?.explanationText,
      confirmButtonText: options?.confirmButtonText,
      denyButtonText: options?.denyButtonText,
    });
    const address = addressFromEd25519PublicKey(publicKey.ed25519PublicKey);
    this.signer.setCachedSolanaAddress(address);
    return address;
  }

  /**
   * Sign one or more arbitrary messages (Ed25519 over the raw bytes).
   * Used by Wallet Standard `solana:signMessage` and SIWS (after Branding
   * formats the message).
   */
  async signMessage(
    messages: readonly Uint8Array[],
    options?: SolanaCallOptions,
  ): Promise<SolanaSignature[]> {
    if (messages.length === 0) return [];
    const results = await this.signer.signDigest(
      messages.map((message) => ({
        digestData: digestDataForSolanaBytes(message),
        scheme: SOLANA_SIGN_SCHEME,
      })),
      {
        credentialId: options?.credentialId ?? this.signer.getCredentialId(),
        explanationHeader: options?.explanationHeader,
        explanationText: options?.explanationText,
        confirmButtonText: options?.confirmButtonText,
        denyButtonText: options?.denyButtonText,
      },
    );
    return results.map((r) => solanaSignatureFromHex(r.signature));
  }

  /**
   * Sign one or more compiled Solana transaction **messages** (Ed25519 over
   * `messageBytes`). Branding/Kit supplies the bytes; Host may submit via
   * Alchemy after merging signatures.
   */
  async signTransaction(
    transactions: readonly ISolanaSignTransactionInput[],
    options?: SolanaCallOptions,
  ): Promise<ISolanaSignedTransaction[]> {
    if (transactions.length === 0) return [];
    const results = await this.signer.signDigest(
      transactions.map((tx) => ({
        digestData: digestDataForSolanaBytes(tx.messageBytes),
        scheme: SOLANA_SIGN_SCHEME,
      })),
      {
        credentialId: options?.credentialId ?? this.signer.getCredentialId(),
        explanationHeader: options?.explanationHeader,
        explanationText: options?.explanationText,
        confirmButtonText: options?.confirmButtonText,
        denyButtonText: options?.denyButtonText,
      },
    );
    return results.map((r) => {
      const signature = solanaSignatureFromHex(r.signature);
      return {
        signature,
        signatureBytes: solanaSignatureToBytes(signature),
      };
    });
  }
}
