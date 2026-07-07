import type { UriString, CredentialIssuer } from "@1shotapi/ows-types";
import type { Oid4vciClient } from "./client.js";
import type { CredentialOffer } from "../types/offer.js";
import type { StoredCredential } from "../types/credential.js";
import type { IssuerMetadata } from "./client.js";
import {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialScope,
} from "@1shotapi/ows-types";
import {
  MOCK_KYC_OFFER,
  MOCK_KYC_OFFER_URI,
  createMockStoredCredential,
} from "../mock/fixtures.js";

/** MOCK OID4VCI client — resolves mock:// URIs to fixtures only. */
export class MockOid4vciClient implements Oid4vciClient {
  async resolveOffer(uri: UriString): Promise<CredentialOffer> {
    if (uri === MOCK_KYC_OFFER_URI || uri.startsWith("mock://kyc-offer")) {
      return { ...MOCK_KYC_OFFER };
    }
    throw new Error(`MockOid4vciClient: unknown offer URI: ${uri}`);
  }

  async fetchIssuerMetadata(issuer: CredentialIssuer): Promise<IssuerMetadata> {
    return {
      credentialIssuer: issuer,
      credentialConfigurationsSupported: {
        [CredentialConfigurationId("KycCredential")]: {
          format: CredentialFormatId("sd-jwt-vc"),
          scope: CredentialScope("kyc"),
        },
      },
    };
  }

  async requestCredential(
    _offer: CredentialOffer,
    _metadata: IssuerMetadata,
  ): Promise<StoredCredential> {
    return createMockStoredCredential();
  }
}
