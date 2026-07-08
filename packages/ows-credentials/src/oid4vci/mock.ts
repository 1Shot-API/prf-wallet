import type { UriString, CredentialIssuer } from "@1shotapi/ows-types";
import {
  CredentialClaimName,
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialId,
  CredentialScope,
  CredentialTypeName,
  ISO8601DateTime,
} from "@1shotapi/ows-types";
import type { Oid4vciClient, CredentialIssuanceContext } from "./client.js";
import type { CredentialOffer } from "../types/offer.js";
import type { StoredCredential } from "../types/credential.js";
import type { IssuerMetadata } from "./client.js";
import {
  MOCK_KYC_OFFER,
  MOCK_KYC_OFFER_URI,
  MOCK_KYC_ISSUER_ID,
} from "../mock/fixtures.js";
import { issueDemoSdJwtVc } from "../sd-jwt-vc/issuer.js";
import {
  createDemoHolderSigner,
} from "../sd-jwt-vc/jwk-holder-signer.js";
import { DEMO_HOLDER_PUBLIC_JWK } from "../sd-jwt-vc/demo-keys.js";

/** MOCK OID4VCI client — resolves mock:// URIs and issues real demo SD-JWT VCs. */
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
    context?: CredentialIssuanceContext,
  ): Promise<StoredCredential> {
    const holderJwk =
      context?.holderPublicKeyJwk ??
      (await createDemoHolderSigner().publicKeyJwk());

    const issuedAt = ISO8601DateTime(new Date().toISOString());
    const validUntil = ISO8601DateTime(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    );

    const subject = {
      ageOver18: true,
      country: "US",
      assuranceLevel: "substantial",
      verifiedAt: issuedAt,
    };

    const payload = await issueDemoSdJwtVc({
      issuer: MOCK_KYC_ISSUER_ID,
      vct: "KycCredential",
      claims: subject,
      disclosableClaims: [
        CredentialClaimName("ageOver18"),
        CredentialClaimName("country"),
        CredentialClaimName("assuranceLevel"),
        CredentialClaimName("verifiedAt"),
      ],
      holderPublicKeyJwk: holderJwk,
    });

    return {
      credentialId: CredentialId(`cred_mock_kyc_${Date.now()}`),
      format: "sd-jwt-vc",
      type: [
        CredentialTypeName("VerifiableCredential"),
        CredentialTypeName("KycCredential"),
      ],
      issuer: MOCK_KYC_ISSUER_ID,
      issuedAt,
      validUntil,
      payload,
      semantic: {
        type: [
          CredentialTypeName("VerifiableCredential"),
          CredentialTypeName("KycCredential"),
        ],
        issuer: MOCK_KYC_ISSUER_ID,
        validFrom: issuedAt,
        validUntil,
        credentialSubject: subject,
        credentialSchema: {
          id: "https://schemas.ows.example/kyc/v1" as UriString,
          type: "JsonSchema",
        },
      },
    };
  }
}

/** Public JWK used when mock issuance runs without a wallet holder signer. */
export { DEMO_HOLDER_PUBLIC_JWK };
