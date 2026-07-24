import type { CeremonyUiParams, SolanaAccountAddress } from "@1shotapi/ows-types";
import type { OWSSigner } from "../owssigner.js";
import { addressFromEd25519PublicKey } from "./address.js";

export type SolanaCallOptions = CeremonyUiParams & {
  credentialId?: string;
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
}
