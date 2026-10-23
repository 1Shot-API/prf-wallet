import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CredentialClaimName, CredentialIssuer } from "../src/index.js";
import { PresentationUtils } from "../src/utils/credentials/PresentationUtils.js";
import {
  issueDemoSdJwtVc,
  createDemoHolderSigner,
} from "./demo-fixtures.js";

const MOCK_KYC_ISSUER_ID = CredentialIssuer("https://kyc.demo.issuer.example");

describe("PresentationUtils", () => {
  it("unpacks selectively disclosed claims into the subject map", async () => {
    const holderSigner = createDemoHolderSigner();
    const holderJwk = await holderSigner.publicKeyJwk();
    const subject = { ageOver18: true, country: "US" };
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

    const unpacked = await PresentationUtils.unpackSubject(payload);
    assert.equal(unpacked.ageOver18, true);
    assert.equal(unpacked.country, "US");
  });

  it("builds selective disclosure presentation with kb+jwt", async () => {
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
        // Empty subject mimics JWT-peek storage that omitted SD disclosures.
        semantic: {
          type: ["VerifiableCredential", "KycCredential"] as never,
          issuer: MOCK_KYC_ISSUER_ID,
          credentialSubject: {},
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
  });
});
