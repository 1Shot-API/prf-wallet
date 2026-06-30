import type { OWSSigner } from "../owssigner.js";
import { addressFromEd25519PublicKey } from "./address.js";

export type SolanaCallOptions = {
  credentialId?: string;
};

export class SolanaSigner {
  constructor(private readonly signer: OWSSigner) {}

  async getAccountAddress(options?: SolanaCallOptions): Promise<string> {
    const publicKey = await this.signer.getPublicKey({
      credentialId: options?.credentialId ?? this.signer.getCredentialId(),
    });
    return addressFromEd25519PublicKey(publicKey.ed25519PublicKey);
  }
}
