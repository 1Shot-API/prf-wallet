import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CredentialClaimName, CredentialIssuer, PresentationUtils } from "@1shotapi/ows-types";
import { verifySdJwtVcPresentation } from "../src/credentials/verify.js";
import {
  issueDemoSdJwtVc,
  createDemoHolderSigner,
  DEMO_HOLDER_PUBLIC_JWK,
  DEMO_ISSUER_PUBLIC_JWK,
} from "./demo-fixtures.js";

const MOCK_KYC_ISSUER_ID = CredentialIssuer("https://kyc.demo.issuer.example");

describe("SD-JWT VC verify", () => {
  it("issues, presents with kb+jwt, and verifies", async () => {
    const holderSigner = createDemoHolderSigner();
    const holderJwk = await holderSigner.publicKeyJwk();

    const subject = {
      ageOver18: true,
      country: "US",
    };

    const payload = await issueDemoSdJwtVc({
      issuer: MOCK_KYC_ISSUER_ID,
      vct: "KycCredential",
      claims: subject,
      disclosableClaims: [
        CredentialClaimName("ageOver18"),
        CredentialClaimName("country"),
      ],
      holderPublicKeyJwk: holderJwk,
    });

    const built = await PresentationUtils.build({
      credential: {
        credentialId: "cred_test" as never,
        format: "sd-jwt-vc",
        type: ["VerifiableCredential", "KycCredential"] as never,
        issuer: MOCK_KYC_ISSUER_ID,
        issuedAt: new Date().toISOString() as never,
        payload,
        semantic: {
          type: ["VerifiableCredential", "KycCredential"] as never,
          issuer: MOCK_KYC_ISSUER_ID,
          credentialSubject: subject,
        },
      },
      definition: {
        id: "test",
        verifier: { id: "https://verifier.example" as never, name: "Verifier" },
        requestedClaims: [
          CredentialClaimName("ageOver18"),
          CredentialClaimName("country"),
        ],
        nonce: "test-nonce",
        audience: "https://verifier.example",
      },
      holderSigner,
    });

    const verified = await verifySdJwtVcPresentation({
      presentation: built.presentation,
      issuerPublicKeyJwk: DEMO_ISSUER_PUBLIC_JWK,
      holderPublicKeyJwk: DEMO_HOLDER_PUBLIC_JWK,
      nonce: "test-nonce",
      audience: "https://verifier.example",
    });
    assert.equal(verified.valid, true);
    assert.equal(verified.payload?.country, "US");
  });

  it("rejects kb+jwt audience mismatch", async () => {
    const holderSigner = createDemoHolderSigner();
    const holderJwk = await holderSigner.publicKeyJwk();

    const subject = {
      ageOver18: true,
      country: "US",
    };

    const payload = await issueDemoSdJwtVc({
      issuer: MOCK_KYC_ISSUER_ID,
      vct: "KycCredential",
      claims: subject,
      disclosableClaims: [
        CredentialClaimName("ageOver18"),
        CredentialClaimName("country"),
      ],
      holderPublicKeyJwk: holderJwk,
    });

    const built = await PresentationUtils.build({
      credential: {
        credentialId: "cred_test" as never,
        format: "sd-jwt-vc",
        type: ["VerifiableCredential", "KycCredential"] as never,
        issuer: MOCK_KYC_ISSUER_ID,
        issuedAt: new Date().toISOString() as never,
        payload,
        semantic: {
          type: ["VerifiableCredential", "KycCredential"] as never,
          issuer: MOCK_KYC_ISSUER_ID,
          credentialSubject: subject,
        },
      },
      definition: {
        id: "test",
        verifier: { id: "https://verifier.example" as never, name: "Verifier" },
        requestedClaims: [
          CredentialClaimName("ageOver18"),
          CredentialClaimName("country"),
        ],
        nonce: "test-nonce",
        audience: "https://verifier.example",
      },
      holderSigner,
    });

    const verified = await verifySdJwtVcPresentation({
      presentation: built.presentation,
      issuerPublicKeyJwk: DEMO_ISSUER_PUBLIC_JWK,
      holderPublicKeyJwk: DEMO_HOLDER_PUBLIC_JWK,
      nonce: "test-nonce",
      audience: "https://wrong-audience.example",
    });
    assert.equal(verified.valid, false);
    assert.ok(verified.reasons.some((r) => /audience/i.test(r)));
  });
});
