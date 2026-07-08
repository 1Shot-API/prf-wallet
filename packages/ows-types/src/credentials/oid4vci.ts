import type {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialIssuer,
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
};

export type CredentialIssuanceContext = {
  /** Holder public key (`cnf.jwk`) bound into the issued SD-JWT VC. */
  holderPublicKeyJwk?: JsonWebKey;
};

export interface Oid4vciClient {
  resolveOffer(uri: UriString): Promise<CredentialOffer>;
  fetchIssuerMetadata(issuer: CredentialIssuer): Promise<IssuerMetadata>;
  requestCredential(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
    context?: CredentialIssuanceContext,
  ): Promise<StoredCredential>;
}
