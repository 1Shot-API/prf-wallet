import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProofUtils } from "../src/utils/credentials/ProofUtils.js";
import { createDemoHolderSigner } from "./demo-fixtures.js";

describe("ProofUtils", () => {
  it("builds and verifies a holder proof", async () => {
    const holderSigner = createDemoHolderSigner();
    const audience = "https://kyc.demo.issuer.example";
    const nonce = "issuance-nonce-1";

    const jwt = await ProofUtils.buildOid4vciProofJwt({
      holderSigner,
      audience,
      nonce,
    });

    const verified = await ProofUtils.verifyOid4vciProofJwt({
      jwt,
      expectedAudience: audience,
      expectedNonce: nonce,
    });

    assert.equal(verified.valid, true);
    assert.equal(verified.reasons.length, 0);
    assert.ok(verified.holderPublicKeyJwk);

    const expectedJwk = await holderSigner.publicKeyJwk();
    assert.equal(
      await ProofUtils.jwksEqualsByThumbprint(
        verified.holderPublicKeyJwk!,
        expectedJwk,
      ),
      true,
    );
  });

  it("rejects wrong audience", async () => {
    const holderSigner = createDemoHolderSigner();
    const jwt = await ProofUtils.buildOid4vciProofJwt({
      holderSigner,
      audience: "https://kyc.demo.issuer.example",
      nonce: "n1",
    });

    const verified = await ProofUtils.verifyOid4vciProofJwt({
      jwt,
      expectedAudience: "https://other.issuer.example",
      expectedNonce: "n1",
    });

    assert.equal(verified.valid, false);
    assert.ok(verified.reasons.some((r) => r.includes("audience")));
  });

  it("computes stable JWK thumbprints", async () => {
    const holderSigner = createDemoHolderSigner();
    const jwk = await holderSigner.publicKeyJwk();
    const a = await ProofUtils.jwkThumbprint(jwk);
    const b = await ProofUtils.jwkThumbprint(jwk);
    assert.equal(a, b);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });
});
