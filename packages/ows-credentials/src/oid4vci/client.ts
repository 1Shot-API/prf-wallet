import type {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialIssuer,
  CredentialScope,
  UriString,
} from "@1shotapi/ows-types";
import type { CredentialOffer } from "../types/offer.js";
import type { StoredCredential } from "../types/credential.js";

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

export interface Oid4vciClient {
  resolveOffer(uri: UriString): Promise<CredentialOffer>;
  fetchIssuerMetadata(issuer: CredentialIssuer): Promise<IssuerMetadata>;
  requestCredential(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
  ): Promise<StoredCredential>;
}
