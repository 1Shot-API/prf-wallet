import type { IHolderSigner } from "./holder-signer.js";

/** OID4VCI JWT proof `typ` header value. */
export const OID4VCI_PROOF_JWT_TYP = "openid4vci-proof+jwt";

export type BuildOid4vciProofJwtInput = {
  holderSigner: IHolderSigner;
  /** Credential issuer identifier (`aud`). */
  audience: string;
  /** C-nonce from the issuer when available. */
  nonce?: string;
};

export type VerifyOid4vciProofJwtInput = {
  jwt: string;
  expectedAudience: string;
  expectedNonce?: string;
};

export type VerifyOid4vciProofJwtResult = {
  valid: boolean;
  holderPublicKeyJwk?: JsonWebKey;
  reasons: string[];
};
