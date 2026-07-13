import {
  CredentialClaimName,
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialId,
  CredentialScope,
  CredentialTypeName,
  ISO8601DateTime,
  UriString,
  ProofUtils,
  type CredentialOfferUri,
  type CredentialIssuer,
  type Oid4vciClient,
  type CredentialIssuanceContext,
  type CredentialOffer,
  type StoredCredential,
  type IssuerMetadata,
} from "@1shotapi/ows-types";
import {
  MOCK_KYC_OFFER,
  MOCK_KYC_OFFER_URI,
  MOCK_KYC_ISSUER_ID,
  MOCK_OID4VCI_PROOF_NONCE,
} from "../fixtures.js";
import { issueDemoSdJwtVc } from "../demo/issuer.js";
import { DEMO_HOLDER_PUBLIC_JWK } from "../demo/demo-keys.js";

/** MOCK OID4VCI client — resolves mock:// URIs and issues real demo SD-JWT VCs. */
export class MockOid4vciClient implements Oid4vciClient {
  async resolveOffer(uri: CredentialOfferUri): Promise<CredentialOffer> {
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
    metadata: IssuerMetadata,
    context?: CredentialIssuanceContext,
  ): Promise<StoredCredential> {
    if (!context?.proof || !context.holderPublicKeyJwk) {
      throw new Error(
        "MockOid4vciClient: CredentialIssuanceContext with proof and holderPublicKeyJwk is required",
      );
    }

    const expectedNonce = context.nonce ?? MOCK_OID4VCI_PROOF_NONCE;
    const proofResult = await ProofUtils.verifyOid4vciProofJwt({
      jwt: context.proof.jwt,
      expectedAudience: metadata.credentialIssuer,
      expectedNonce,
    });
    if (!proofResult.valid || !proofResult.holderPublicKeyJwk) {
      throw new Error(
        `MockOid4vciClient: OID4VCI proof rejected: ${proofResult.reasons.join("; ")}`,
      );
    }

    const keyMatches = await ProofUtils.jwksEqualsByThumbprint(
      proofResult.holderPublicKeyJwk,
      context.holderPublicKeyJwk,
    );
    if (!keyMatches) {
      throw new Error(
        "MockOid4vciClient: proof jwk does not match holderPublicKeyJwk",
      );
    }

    const holderJwk = context.holderPublicKeyJwk;
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
          id: UriString("https://schemas.ows.example/kyc/v1"),
          type: "JsonSchema",
        },
      },
    };
  }
}

/** Public JWK for offline fixtures that still use the demo holder keypair. */
export { DEMO_HOLDER_PUBLIC_JWK };
