import type {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialIssuer,
  CredentialOfferUri,
  CredentialScope,
} from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialOffer } from "./offer.js";

export type CredentialConfigurationMetadata = {
  format: CredentialFormatId;
  scope?: CredentialScope;
};

export type IssuerMetadata = {
  credentialIssuer: CredentialIssuer;
  credentialConfigurationsSupported: Record<
    CredentialConfigurationId,
    CredentialConfigurationMetadata
  >;
};

/** OID4VCI credential-request proof (`proof_type: jwt`). */
export type Oid4vciJwtProof = {
  proof_type: "jwt";
  jwt: string;
};

/**
 * Wallet-supplied holder key material and proof-of-possession for issuance.
 * Mock and HTTP clients verify {@link proof} before embedding `cnf.jwk`.
 */
export type CredentialIssuanceContext = {
  /** Holder public key embedded as SD-JWT VC `cnf.jwk` after PoP verification. */
  holderPublicKeyJwk: JsonWebKey;
  /** OID4VCI JWT proof proving possession of {@link holderPublicKeyJwk}. */
  proof: Oid4vciJwtProof;
  /** Issuer C-nonce echoed in the proof when the issuer supplied one. */
  nonce?: string;
};

export interface Oid4vciClient {
  resolveOffer(uri: CredentialOfferUri): Promise<CredentialOffer>;
  fetchIssuerMetadata(issuer: CredentialIssuer): Promise<IssuerMetadata>;
  requestCredential(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
    context?: CredentialIssuanceContext,
  ): Promise<StoredCredential>;
}
