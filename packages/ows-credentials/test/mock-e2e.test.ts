import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DemoCredentialFlow,
  validateMockPresentation,
} from "../src/mock/demo-flow.js";
import {
  MOCK_KYC_POLICY,
  MOCK_KYC_ISSUER_ID,
} from "../src/mock/fixtures.js";
import { CredentialOfferUri, CredentialTypeName, PresentationRequestUri } from "@1shotapi/ows-types";

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

  it("fails presentation without stored credential", async () => {
    const flow = new DemoCredentialFlow();

    await assert.rejects(
      () => flow.present(),
      /No matching credentials/,
    );
  });
});
