import type {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialIssuer,
  CredentialOfferUri,
  CredentialScope,
  UriString,
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
  /** Absolute credential endpoint URL (from well-known). */
  credentialEndpoint?: UriString;
  /** Absolute token endpoint URL (issuer or AS). */
  tokenEndpoint?: UriString;
  /** Optional JWKS URI for issuer keys. */
  jwksUri?: UriString;
  /** Proof types the issuer accepts (e.g. `jwt`). */
  proofTypesSupported?: string[];
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
  /** Wallet attestation JWT when the issuer requires one. */
  walletAttestationJwt?: string;
};

/** Result of pre-authorized token exchange (optional on mock clients). */
export type CredentialRequestPreparation = {
  accessToken?: string;
  /** Issuer C-nonce for the holder proof JWT. */
  cNonce?: string;
  cNonceExpiresIn?: number;
};

export interface IOid4vciClient {
  resolveOffer(uri: CredentialOfferUri): Promise<CredentialOffer>;
  fetchIssuerMetadata(issuer: CredentialIssuer): Promise<IssuerMetadata>;
  /**
   * Optional pre-authorized token step. HTTP clients implement this to obtain
   * `c_nonce` before the wallet builds the PoP JWT. Mock clients omit it.
   */
  prepareCredentialRequest?(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
  ): Promise<CredentialRequestPreparation>;
  requestCredential(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
    context?: CredentialIssuanceContext,
  ): Promise<StoredCredential>;
}
