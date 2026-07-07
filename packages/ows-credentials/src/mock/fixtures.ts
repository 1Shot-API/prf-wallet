import {
  CredentialClaimName,
  CredentialConfigurationId,
  CredentialId,
  CredentialIssuer,
  CredentialTypeName,
  ISO8601DateTime,
  UriString,
} from "@1shotapi/ows-types";
import type { StoredCredential } from "../types/credential.js";
import type { CredentialOffer } from "../types/offer.js";
import type { PresentationDefinition } from "../types/presentation.js";
import type { IssuerTrustMetadata } from "../types/trust.js";
import type { KycProfilePolicy } from "../types/kyc-profile.js";

/** MOCK — not a valid SD-JWT VC or cryptographic credential. */
export const MOCK_KYC_ISSUER_ID = CredentialIssuer(
  "https://kyc.demo.issuer.example",
);

export const MOCK_KYC_OFFER_URI = UriString("mock://kyc-offer/demo");

export const MOCK_KYC_PRESENTATION_URI = UriString(
  "mock://kyc-presentation/demo",
);

export const MOCK_CREDENTIAL_ID = CredentialId("cred_mock_kyc_001");

export const MOCK_KYC_OFFER: CredentialOffer = {
  credentialIssuer: MOCK_KYC_ISSUER_ID,
  credentialConfigurationIds: [CredentialConfigurationId("KycCredential")],
};

export const MOCK_KYC_PRESENTATION_REQUEST: PresentationDefinition = {
  id: "mock-presentation-001",
  verifier: {
    id: UriString("https://verifier.demo.example"),
    name: "Demo Verifier",
  },
  requestedClaims: [
    CredentialClaimName("ageOver18"),
    CredentialClaimName("country"),
  ],
  credentialTypes: [CredentialTypeName("KycCredential")],
  nonce: "mock-nonce-abc",
};

export const MOCK_ISSUER_TRUST: IssuerTrustMetadata = {
  issuerId: MOCK_KYC_ISSUER_ID,
  name: "Demo KYC Issuer",
  assuranceLevels: ["substantial", "high"],
  jurisdictions: ["US", "GB"],
};

export const MOCK_KYC_POLICY: KycProfilePolicy = {
  requiredClaims: [
    CredentialClaimName("ageOver18"),
    CredentialClaimName("country"),
  ],
  minAssuranceLevel: "substantial",
  maxAgeDays: 365,
  allowedIssuers: [MOCK_KYC_ISSUER_ID],
};

/** MOCK — opaque blob, not a valid SD-JWT VC. */
export const MOCK_CREDENTIAL_PAYLOAD =
  "MOCK_SD_JWT_VC~eyJ0eXAiOiJKV1QifQ~MOCK_DISCLOSURES";

/** MOCK — opaque presentation blob. */
export const MOCK_PRESENTATION_PAYLOAD =
  "MOCK_PRESENTATION~eyJ0eXAiOiJKV1QifQ~ageOver18,country";

export function createMockStoredCredential(): StoredCredential {
  const issuedAt = ISO8601DateTime(new Date().toISOString());
  const validUntil = ISO8601DateTime(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  );
  return {
    credentialId: MOCK_CREDENTIAL_ID,
    format: "sd-jwt-vc",
    type: [
      CredentialTypeName("VerifiableCredential"),
      CredentialTypeName("KycCredential"),
    ],
    issuer: MOCK_KYC_ISSUER_ID,
    issuedAt,
    validUntil,
    payload: MOCK_CREDENTIAL_PAYLOAD,
    semantic: {
      type: [
        CredentialTypeName("VerifiableCredential"),
        CredentialTypeName("KycCredential"),
      ],
      issuer: MOCK_KYC_ISSUER_ID,
      validFrom: issuedAt,
      validUntil,
      credentialSubject: {
        ageOver18: true,
        country: "US",
        assuranceLevel: "substantial",
        verifiedAt: issuedAt,
      },
      credentialSchema: {
        id: UriString("https://schemas.ows.example/kyc/v1"),
        type: "JsonSchema",
      },
    },
  };
}
