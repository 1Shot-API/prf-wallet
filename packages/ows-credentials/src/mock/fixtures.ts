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
import { issueDemoSdJwtVc } from "../sd-jwt-vc/issuer.js";
import { DEMO_HOLDER_PUBLIC_JWK } from "../sd-jwt-vc/demo-keys.js";

/** MOCK KYC issuer — signs demo SD-JWT VCs with a fixed test keypair. */
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
  audience: "https://verifier.demo.example",
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

export async function createMockStoredCredential(): Promise<StoredCredential> {
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
    holderPublicKeyJwk: DEMO_HOLDER_PUBLIC_JWK,
  });
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
        id: UriString("https://schemas.ows.example/kyc/v1"),
        type: "JsonSchema",
      },
    },
  };
}
