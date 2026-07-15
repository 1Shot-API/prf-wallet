import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DemoCredentialFlow,
  validateMockPresentation,
  MockOid4vciClient,
  MOCK_KYC_POLICY,
  MOCK_KYC_ISSUER_ID,
  InMemoryIssuerTrustRegistry,
} from "../src/index.js";
import {
  CredentialIssuer,
  CredentialOfferUri,
  CredentialTypeName,
  ISO8601DateTime,
  PresentationRequestUri,
} from "@1shotapi/ows-types";

describe("mock credential e2e flow", () => {
  it("issuer offer → store → present → verify", async () => {
    const flow = new DemoCredentialFlow();

    const receipt = await flow.acceptOffer({
      credentialOfferUri: CredentialOfferUri("mock://kyc-offer/demo"),
    });
    assert.ok(receipt.credentialId);

    const listed = await flow.list({ type: CredentialTypeName("KycCredential") });
    assert.equal(listed.length, 1);

    const presentation = await flow.present({
      requestUri: PresentationRequestUri("mock://kyc-presentation/demo"),
    });

    assert.ok(presentation.presentation.startsWith("eyJ"));
    assert.deepEqual(presentation.disclosedClaims, ["ageOver18", "country"]);

    const verification = await validateMockPresentation(
      presentation,
      MOCK_KYC_POLICY,
      MOCK_KYC_ISSUER_ID,
    );
    assert.equal(verification.valid, true);
    assert.equal(verification.reasons.length, 0);
    assert.equal(verification.disclosedClaims.country, "US");
    assert.equal(verification.disclosedClaims.ageOver18, true);
    assert.ok(verification.holderThumbprint);
    assert.equal(verification.custody.every((step) => step.ok), true);
  });

  it("rejects issuance without OID4VCI proof", async () => {
    const client = new MockOid4vciClient();
    const offer = await client.resolveOffer(
      CredentialOfferUri("mock://kyc-offer/demo"),
    );
    const metadata = await client.fetchIssuerMetadata(offer.credentialIssuer);
    await assert.rejects(
      () => client.requestCredential(offer, metadata),
      /proof/,
    );
  });

  it("rejects presentation when user declines", async () => {
    const flow = new DemoCredentialFlow({
      approvePresentation: async () => false,
    });

    await flow.acceptOffer();

    await assert.rejects(
      () => flow.present(),
      /User rejected presentation/,
    );
  });

  it("rejects untrusted issuer before issuance", async () => {
    const flow = new DemoCredentialFlow({
      trust: new InMemoryIssuerTrustRegistry([]),
    });
    await assert.rejects(() => flow.acceptOffer(), /Untrusted issuer/);
  });

  it("fails closed when credential status is revoked", async () => {
    const flow = new DemoCredentialFlow({
      status: {
        async checkStatus(credential) {
          return {
            credentialId: credential.credentialId,
            status: "revoked",
            checkedAt: ISO8601DateTime(new Date().toISOString()),
          };
        },
      },
    });
    await assert.rejects(() => flow.acceptOffer(), /revoked/);
  });

  it("filters matches by acceptedIssuers on present", async () => {
    const flow = new DemoCredentialFlow();
    await flow.acceptOffer();
    await assert.rejects(
      () =>
        flow.present({
          requestUri: PresentationRequestUri("mock://kyc-presentation/demo"),
          acceptedIssuers: [
            CredentialIssuer("https://other.issuer.example"),
          ],
        }),
      /No matching credentials/,
    );
  });
});
