import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CredentialClaimName } from "@1shotapi/ows-types";
import { issueDemoSdJwtVc } from "../src/sd-jwt-vc/issuer.js";
import { buildSdJwtVcPresentation } from "../src/sd-jwt-vc/presentation.js";
import { verifySdJwtVcPresentation } from "../src/sd-jwt-vc/verify.js";
import {
  createDemoHolderSigner,
} from "../src/sd-jwt-vc/jwk-holder-signer.js";
import { DEMO_HOLDER_PUBLIC_JWK } from "../src/sd-jwt-vc/demo-keys.js";
import { MOCK_KYC_ISSUER_ID } from "../src/mock/fixtures.js";

describe("SD-JWT VC presentation", () => {
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

    const built = await buildSdJwtVcPresentation({
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

    assert.ok(built.presentation.includes("~"));
    assert.deepEqual(built.disclosedClaims, ["ageOver18", "country"]);

    const verified = await verifySdJwtVcPresentation({
      presentation: built.presentation,
      holderPublicKeyJwk: DEMO_HOLDER_PUBLIC_JWK,
      nonce: "test-nonce",
      audience: "https://verifier.example",
    });
    assert.equal(verified.valid, true);
    assert.equal(verified.payload?.country, "US");
  });
});
